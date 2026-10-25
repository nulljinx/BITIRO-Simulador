#!/usr/bin/env python3
"""FIRVI-2025-A.1 · Comparativa de un gap: izquierda = polígonos que dibuja el renderer (line-geometry.js), centro = puntos que el sensor lee como
   negro (distancia con signo ≤ 0), derecha = diferencia (debe quedar vacía). Uso: python3 tests/firvi-2025/gap-compare.py [salida.png]"""
import json, subprocess, sys, os
import numpy as np
from PIL import Image, ImageDraw
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
js = """global.window={};for(const f of ['tracks.js','extra-tracks.js','line-geometry.js','firvi-2025.js'])require('./'+f);
const t=window.BITIRO_TRACKS['firvi-2025'],G=window.BITIRO_LINE_GEOMETRY;
const out={gaps:t.landmarks.gaps,polys:t.paths.flatMap(p=>G.polygons(p))};
const x0=170,x1=190,y0=44,y1=100,S=40,W=(x1-x0)*S,H=(y1-y0)*S,d=[];
for(let j=0;j<H;j++)for(let i=0;i<W;i++)d.push(G.distance(t.paths,x0+(i+.5)/S,y0+(j+.5)/S)<=0?1:0);
out.view={x0,x1,y0,y1,S,W,H};out.sensor=d;console.log(JSON.stringify(out));"""
d = json.loads(subprocess.run(['node', '-e', js], cwd=root, capture_output=True, text=True, check=True).stdout)
v = d['view']; W, H, S = v['W'], v['H'], v['S']
draw = Image.new('L', (W, H), 255); dr = ImageDraw.Draw(draw)
for poly in d['polys']: dr.polygon([((x - v['x0']) * S, (y - v['y0']) * S) for x, y in poly], fill=0)
rend = np.array(draw) < 128; sens = np.array(d['sensor'], bool).reshape(H, W)
diff = rend ^ sens
from scipy import ndimage as ndi
edge = ndi.binary_dilation(sens, np.ones((3, 3))) & ~ndi.binary_erosion(sens, np.ones((3, 3)))   # banda de 1 px (0,025 cm) alrededor del borde del sensor
print('píxeles (1/40 cm): dibujo %d · sensor %d · diferentes %d (%.2f %% del trazo); diferentes fuera de la banda de 1 px del borde: %d' % (rend.sum(), sens.sum(), diff.sum(), 100 * diff.sum() / max(1, sens.sum()), (diff & ~edge).sum()))
img = np.full((H, W * 3 + 20, 3), 255, np.uint8)
img[:, :W][rend] = 0; img[:, W + 10:2 * W + 10][sens] = 0; img[:, 2 * W + 20:][diff] = (255, 0, 0)
im = Image.fromarray(img); g = ImageDraw.Draw(im)
for gap in d['gaps']:
    for k in range(3):
        for y in (gap['y0'], gap['y1']): g.line([(k * (W + 10), (y - v['y0']) * S), (k * (W + 10) + W, (y - v['y0']) * S)], fill=(0, 140, 255), width=1)
im.save(sys.argv[1] if len(sys.argv) > 1 else 'gap-compare.png')
