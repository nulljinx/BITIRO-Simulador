#!/usr/bin/env python3
"""TRACK-DIGITIZE-1 · de 'official/*.json' (fiel al PDF) a un candidato con el esquema del simulador (SOLO propuesta; no se importa en runtime).

Adaptación explícita al motor: el simulador modela cada línea como CÁPSULA (distancia al segmento − w/2, extremos redondos).
Un extremo plano (butt) LIBRE del PDF se recorta w/2 hacia dentro para que la punta de la cápsula caiga justo en el borde del PDF
(así un gap de 10 cm sigue midiendo 10 cm). Los extremos que empalman con otra línea no se recortan (evita un «cuello» en el empalme).
Los caps cuadrados (square) y redondos se dejan: la cápsula los aproxima con esquinas redondeadas (error ≤ 0.36 cm² por esquina).
Start/heading, roles y rótulos de zonas NO salen del PDF: están anotados con su respaldo (Lab o analogía).
"""
import json, math, os, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
H_UP = -math.pi/2          # convención del simulador y del Lab: y hacia abajo, heading −π/2 = hacia arriba

# Semántica pedagógica. 'basis' dice de dónde sale cada dato (no del PDF).
SEMANTICS = {
 's01': dict(name='S01 · Seguir línea y mover obstáculo', start=(50.0, 130.0, H_UP), basis='Lab src/content/tracks/s01.json (start) · zonas rojas = bases finales (Lab finishZones)',
             roles={'red': 'finish-red'}, labels=lambda z, i, zs: 'Base izquierda' if z['x'] < 50 else 'Base derecha'),
 's02': dict(name='S02 · Tres sensores y elección de base', start=(49.23, 151.0, H_UP), basis='Lab s02.json (start, marcador start-red abajo, 3 bases)',
             roles={'red': 'start-red', 'green': 'finish-green'}),
 's03': dict(name='S03 · Contadores y ciclo while', start=(36.636, 172.359, 0.29), basis='Lab s03.json (start). OJO: el PDF no marca salida y este start queda FUERA de la línea (ver informe)',
             roles={}),
 's04': dict(name='S04 · Gaps y funciones', start=(50.0, 159.5, H_UP), basis='Lab s04.json (start; marcador base-inicial rojo abajo; meta verde arriba)',
             roles={'red': 'start-red', 'green': 'finish-green'}),
 's05': dict(name='S05 · Desafío intermedio', start=(49.55, 165.5, H_UP), basis='Lab s05.json (start; marcador base-inicial rojo abajo; 3 bases)',
             roles={'red': 'start-red', 'green': 'finish-green'}),
 's06': dict(name='S06 · Sonar, cajas y velocidad', start=(49.1, 155.4, H_UP), basis='SIN respaldo del Lab (S06 «pendiente de validación»). Analogía S04/S05: zona roja inferior = salida, centro ≈6.9 cm sobre su borde superior, sobre la línea',
             roles={'red': 'zone-red'}),
 's08': dict(name='S08 · Clasificación y desafío final', start=(37.85, 154.8, H_UP), basis='SIN respaldo del Lab (S08 «pendiente de validación»). Analogía S04/S05; la vertical principal NO está en x=50',
             roles={'red': 'start-red', 'green': 'finish-green'}),
}

def plen(p): return sum(math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]) for i in range(1, len(p)))
def pdist(q, pts):
    best = 1e9
    for i in range(1, len(pts)):
        a, b = pts[i-1], pts[i]; vx, vy = b[0]-a[0], b[1]-a[1]; den = vx*vx+vy*vy
        t = 0 if den == 0 else max(0, min(1, ((q[0]-a[0])*vx+(q[1]-a[1])*vy)/den))
        best = min(best, math.hypot(q[0]-(a[0]+t*vx), q[1]-(a[1]+t*vy)))
    return best

def trim(pts, d, at_start):
    """Recorta d cm desde un extremo siguiendo la polilínea."""
    pts = [list(p) for p in (pts if at_start else pts[::-1])]
    left = d
    while len(pts) > 1:
        seg = math.hypot(pts[1][0]-pts[0][0], pts[1][1]-pts[0][1])
        if seg > left + 1e-9:
            t = left/seg; pts[0] = [pts[0][0]+t*(pts[1][0]-pts[0][0]), pts[0][1]+t*(pts[1][1]-pts[0][1])]; break
        left -= seg; pts.pop(0)
    return pts if at_start else pts[::-1]

def build(off, key):
    sem = SEMANTICS[key]; paths = []
    for i, p in enumerate(off['paths']):
        pts = [list(q) for q in p['points']]; w = p['widthCm']
        closed = math.hypot(pts[0][0]-pts[-1][0], pts[0][1]-pts[-1][1]) < 0.05
        others = [q['points'] for j, q in enumerate(off['paths']) if j != i]
        notes = []
        if not closed:
            for end, cap, at_start in (('start', p['capStart'], True), ('end', p['capEnd'], False)):
                if cap != 'butt': continue
                e = pts[0] if at_start else pts[-1]
                joined = any(pdist(e, o) <= w/2 + 0.35 for o in others)
                if joined: notes.append(end+':empalme'); continue
                pts = trim(pts, w/2, at_start); notes.append(end+':recorte w/2')
        paths.append(dict(id=p['id'], w=round(w, 3), p=[[round(x, 3), round(y, 3)] for x, y in pts], note=','.join(notes)))
    zones, markers = [], []
    greens = sorted([z for z in off['zones'] if z['color'] == 'green'], key=lambda z: z['x'])
    reds = sorted([z for z in off['zones'] if z['color'] == 'red'], key=lambda z: z['y'])
    for gi, z in enumerate(greens):
        label = ('Base %d' % (gi+1)) if len(greens) > 1 else 'Meta'
        zones.append(dict(id='base%d' % (gi+1) if len(greens) > 1 else 'meta', label=label, x=z['x'], y=z['y'], width=z['width'], height=z['height'], kind='finish-green'))
    for ri, z in enumerate(reds):
        role = sem['roles'].get('red')
        zz = dict(x=z['x'], y=z['y'], width=z['width'], height=z['height'])
        if key == 's01':
            zones.append(dict(id='base-izq' if z['x'] < 50 else 'base-der', label='Base izquierda' if z['x'] < 50 else 'Base derecha', kind='finish-red', **zz))
        elif key == 's06':
            if ri == 0: zones.append(dict(id='meta', label='Meta (zona roja superior)', kind='finish-red', **zz))
            else: markers.append(dict(id='salida', label='Salida (zona roja inferior)', kind='start-red', **zz))
        else:
            markers.append(dict(id='base-inicial', label='', kind='start-red', **zz))
    return dict(id=key, name=sem['name'], w=off['physicalWidthCm'], h=off['physicalHeightCm'], paths=paths, zones=zones, markers=markers,
                obstacles=[], start=dict(x=sem['start'][0], y=sem['start'][1], heading=sem['start'][2]), startBasis=sem['basis'],
                source=off['source'], boxSlots=off.get('boxSlots', []), gapsPdf=off.get('gaps', []))

if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, 'sim-candidate'), exist_ok=True)
    for f in sorted(glob.glob(os.path.join(HERE, 'official', 's*.json'))):
        off = json.load(open(f)); key = off['id']; sim = build(off, key)
        json.dump(sim, open(os.path.join(HERE, 'sim-candidate', key+'.json'), 'w'), ensure_ascii=False, indent=1)
        print(key, 'paths', len(sim['paths']), 'pts', sum(len(p['p']) for p in sim['paths']))
