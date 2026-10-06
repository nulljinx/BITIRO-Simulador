#!/usr/bin/env python3
"""TRACK-DIGITIZE-1 · extractor de geometría vectorial de los plotters oficiales ROB-002 (solo lectura de los PDF).

Uso: python3 extract.py <carpeta con los PDF> <carpeta de salida>
- Lee los paths con PyMuPDF (get_drawings): sin OCR ni digitalización manual.
- Normaliza SIEMPRE por página:  x_cm = x_pdf/ancho_pdf*ancho_nominal ; y_cm = y_pdf/alto_pdf*alto_nominal
  (convención física única: x=0 izquierda, y=0 arriba; es la misma del PDF, no se rota, recentra ni espeja).
- Centerline = path del trazo grueso; ancho = stroke width convertido a cm. Béziers aplanados con tolerancia TOL cm.
- Painter's algorithm: lo negro se recorta con lo pintado DESPUÉS (rectángulos blancos = gaps, zonas rojas/verdes).
"""
import fitz, glob, json, math, os, sys, re

NOMINAL = {'S01': (100, 140), 'S02': (100, 200), 'S03': (100, 180), 'S04': (100, 200),
           'S05': (100, 200), 'S06': (100, 200), 'S08': (100, 200)}
TOL = 0.02          # cm: error máximo de aplanado de curvas (verificado contra muestreo denso)
MIN_W = 1.0         # cm: trazos más finos son rotulado/logos
CAPS = {0: 'butt', 1: 'round', 2: 'square'}

def flatten_cubic(p0, p1, p2, p3, tol=TOL):
    out = []
    def dist(p, a, b):
        dx, dy = b[0]-a[0], b[1]-a[1]; d = math.hypot(dx, dy)
        if d < 1e-12: return math.hypot(p[0]-a[0], p[1]-a[1])
        return abs((p[0]-a[0])*dy - (p[1]-a[1])*dx) / d
    def rec(a, b, c, d, depth=0):
        if depth > 18 or max(dist(b, a, d), dist(c, a, d)) * 0.75 <= tol:
            out.append(d); return
        ab = mid(a, b); bc = mid(b, c); cd = mid(c, d); abc = mid(ab, bc); bcd = mid(bc, cd); m = mid(abc, bcd)
        rec(a, ab, abc, m, depth+1); rec(m, bcd, cd, d, depth+1)
    mid = lambda u, v: ((u[0]+v[0])/2, (u[1]+v[1])/2)
    rec(p0, p1, p2, p3); return out

def cubic_pt(p0, p1, p2, p3, t):
    u = 1-t
    return tuple(u**3*p0[k] + 3*u*u*t*p1[k] + 3*u*t*t*p2[k] + t**3*p3[k] for k in (0, 1))

def seg_dist(p, a, b):
    vx, vy = b[0]-a[0], b[1]-a[1]; den = vx*vx+vy*vy
    t = 0 if den == 0 else max(0, min(1, ((p[0]-a[0])*vx+(p[1]-a[1])*vy)/den))
    return math.hypot(p[0]-(a[0]+t*vx), p[1]-(a[1]+t*vy))

def clip_polyline_outside(pts, rect):
    """Devuelve los tramos de la polilínea que quedan FUERA del rectángulo (x0,y0,x1,y1), cortando en el borde."""
    x0, y0, x1, y1 = rect
    inside = lambda p: x0 < p[0] < x1 and y0 < p[1] < y1
    runs, cur = [], []
    def edge_cross(a, b):
        ts = []
        for axis, vals in ((0, (x0, x1)), (1, (y0, y1))):
            d = b[axis]-a[axis]
            if abs(d) < 1e-12: continue
            for v in vals:
                t = (v-a[axis])/d
                if 0 < t < 1:
                    q = (a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1]))
                    if x0-1e-9 <= q[0] <= x1+1e-9 and y0-1e-9 <= q[1] <= y1+1e-9: ts.append((t, q))
        return sorted(ts)
    prev = pts[0]
    if not inside(prev): cur.append(prev)
    for q in pts[1:]:
        cr = edge_cross(prev, q)
        pi, qi = inside(prev), inside(q)
        if pi and not qi:
            if cr: cur = [cr[-1][1]]
            cur.append(q)
        elif not pi and qi:
            if cr: cur.append(cr[0][1])
            if len(cur) > 1: runs.append(cur)
            cur = []
        elif not pi and not qi:
            if len(cr) >= 2:                      # el segmento atraviesa el rectángulo
                cur.append(cr[0][1])
                if len(cur) > 1: runs.append(cur)
                cur = [cr[-1][1], q]
            else: cur.append(q)
        prev = q
    if len(cur) > 1: runs.append(cur)
    return runs

def plength(pts): return sum(math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]) for i in range(1, len(pts)))

def extract(pdf, key):
    nw, nh = NOMINAL[key]
    pg = fitz.open(pdf)[0]; W, H = pg.rect.width, pg.rect.height
    sx, sy = nw/W, nh/H
    P = lambda p: (p.x*sx, p.y*sy)
    prims = []   # en orden de pintado
    for idx, d in enumerate(pg.get_drawings()):
        fill, col, w = d.get('fill'), d.get('color'), (d.get('width') or 0)
        r = d['rect']; rc = (r.x0*sx, r.y0*sy, r.x1*sx, r.y1*sy); rw, rh = rc[2]-rc[0], rc[3]-rc[1]
        is_re = d['items'][0][0] == 're' and len(d['items']) == 1
        if d['type'] in ('s',) and w*sx >= MIN_W and col and max(col) < .35:
            pts = []; cur = None
            for it in d['items']:
                if it[0] == 'l':
                    a, b = P(it[1]), P(it[2])
                    if not pts: pts.append(a)
                    pts.append(b)
                elif it[0] == 'c':
                    a, c1, c2, b = P(it[1]), P(it[2]), P(it[3]), P(it[4])
                    if not pts: pts.append(a)
                    pts.extend(flatten_cubic(a, c1, c2, b))
            # elimina duplicados consecutivos
            dd = [pts[0]]
            for q in pts[1:]:
                if math.hypot(q[0]-dd[-1][0], q[1]-dd[-1][1]) > 1e-6: dd.append(q)
            prims.append(dict(kind='stroke', idx=idx, w=w*sx, pts=dd, cap=CAPS.get((d.get('lineCap') or (0,))[0], 'butt'),
                              raw=[(it[0], [list(map(float, P(q))) for q in it[1:]]) for it in d['items']]))
        elif fill and is_re and rw >= 7 and rh >= 7:
            if min(fill) > .97: prims.append(dict(kind='white', idx=idx, rect=rc))
            elif fill[0] > .8 and fill[1] < .1 and fill[2] < .2: prims.append(dict(kind='red', idx=idx, rect=rc))
            elif fill[1] > .5 and fill[0] < .1 and fill[2] < .4: prims.append(dict(kind='green', idx=idx, rect=rc))
        elif fill and is_re and max(fill) < .3 and rw >= 10 and 1 <= rh <= 3 and idx < 200:
            prims.append(dict(kind='bar', idx=idx, rect=rc))           # barra negra rellena (rectángulo)
        elif d['type'] == 's' and col and col[1] > .5 and col[0] < .1 and (d.get('width') or 0) > 1 and is_re:
            prims.append(dict(kind='slot', idx=idx, rect=rc))          # recuadro verde fino (posición posible de caja)
    # --- zonas y gaps visibles
    zones = [p for p in prims if p['kind'] in ('red', 'green')]
    whites = [p for p in prims if p['kind'] == 'white']
    slots = [p for p in prims if p['kind'] == 'slot']
    paths = []
    def occluders(i): return [z['rect'] for z in zones + whites if z['idx'] > i]
    n_micro = 0
    for p in prims:
        if p['kind'] == 'stroke':
            runs = [p['pts']]
            for rect in occluders(p['idx']):
                nr = []
                for run in runs: nr.extend(clip_polyline_outside(run, rect))
                runs = nr
            o0, o1 = p['pts'][0], p['pts'][-1]
            near = lambda u, v: math.hypot(u[0]-v[0], u[1]-v[1]) < 1e-3
            for run in runs:
                if plength(run) < 0.5: n_micro += 1; continue
                # un extremo recortado por un gap/zona queda plano (butt); los originales conservan el cap del PDF
                cs = p['cap'] if near(run[0], o0) else 'butt'
                ce = p['cap'] if near(run[-1], o1) else 'butt'
                paths.append(dict(src=p['idx'], w=p['w'], cap=p['cap'], capStart=cs, capEnd=ce, pts=run, whole=(len(runs) == 1)))
        elif p['kind'] == 'bar':
            x0, y0, x1, y1 = p['rect']; hgt = y1-y0
            runs = [[(x0, (y0+y1)/2), (x1, (y0+y1)/2)]]
            paths.append(dict(src=p['idx'], w=hgt, cap='butt', capStart='butt', capEnd='butt', pts=runs[0], whole=True, fromRect=True))
    return dict(key=key, page_pt=(W, H), nominal=(nw, nh), scale=(sx, sy), prims=prims, paths=paths,
                zones=zones, whites=whites, slots=slots, micro=n_micro)

def build_models(ex):
    """Dos vistas del mismo trazado: 'official' (fiel al PDF, con caps) y 'sim' (cápsulas del motor, ver nota)."""
    nw, nh = ex['nominal']; off = []
    for i, p in enumerate(ex['paths']):
        off.append(dict(id='p%02d_pdf%d' % (i, p['src']), widthCm=round(p['w'], 4), cap=p['cap'], capStart=p['capStart'], capEnd=p['capEnd'],
                        points=[[round(x, 4), round(y, 4)] for x, y in p['pts']], pdfDrawing=p['src']))
    zones = []
    for z in sorted(ex['zones'], key=lambda z: (z['kind'] != 'green', z['rect'][0] if z['kind'] == 'green' else z['rect'][1])):
        x0, y0, x1, y1 = z['rect']
        zones.append(dict(color=z['kind'], x=round(x0, 3), y=round(y0, 3), width=round(x1-x0, 3), height=round(y1-y0, 3), pdfDrawing=z['idx']))
    gaps = [dict(x=round(g['rect'][0], 3), y=round(g['rect'][1], 3), width=round(g['rect'][2]-g['rect'][0], 3),
                 height=round(g['rect'][3]-g['rect'][1], 3), pdfDrawing=g['idx']) for g in ex['whites']]
    slots = [dict(x=round(s['rect'][0], 3), y=round(s['rect'][1], 3), width=round(s['rect'][2]-s['rect'][0], 3),
                  height=round(s['rect'][3]-s['rect'][1], 3), pdfDrawing=s['idx']) for s in ex['slots']]
    return dict(id=ex['key'].lower(), source=None, pagePt=[round(ex['page_pt'][0], 2), round(ex['page_pt'][1], 2)],
                physicalWidthCm=nw, physicalHeightCm=nh, scaleCmPerPt=[ex['scale'][0], ex['scale'][1]],
                convention='x=0 izquierda, y=0 arriba (idéntica al PDF; sin rotar/recentrar/espejar)',
                flattenToleranceCm=TOL, microStrokesIgnored=ex['micro'], paths=off, zones=zones, gaps=gaps, boxSlots=slots)

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(src, '*.pdf'))):
        key = [k for k in NOMINAL if re.search(r'ROB-002-' + k, f)][0]
        ex = extract(f, key); m = build_models(ex); m['source'] = os.path.basename(f)
        json.dump(m, open(os.path.join(out, key.lower() + '.json'), 'w'), ensure_ascii=False, indent=1)
        print(key, 'paths', len(m['paths']), 'zones', len(m['zones']), 'gaps', len(m['gaps']), 'slots', len(m['boxSlots']), 'micro', m['microStrokesIgnored'])
