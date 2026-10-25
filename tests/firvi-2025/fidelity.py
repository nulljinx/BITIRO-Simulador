#!/usr/bin/env python3
"""FIRVI-2025-A · Fidelidad de la línea modelada frente a la Figura 1 de las bases (herramienta de desarrollo, no forma parte de `npm test`).

   python3 tests/firvi-2025/fidelity.py RUTA/bases-firvi-2025.pdf [salida-diff.png]

Extrae la Figura 1 (página 2, raster 825 × 333 px) con `pdfimages`, aísla los trazos gruesos (descarta la cuadrícula fina), superpone la línea
de `firvi-2025.js` a la escala de la figura (80 px = 30 cm) y mide la distancia entre ambas máscaras. Requiere pdfimages, node, numpy, scipy y PIL.
El PDF no se versiona en el repositorio."""
import json, subprocess, sys, tempfile, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

pdf = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else None
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
tmp = tempfile.mkdtemp()
subprocess.run(['pdfimages', '-png', '-f', '2', '-l', '2', pdf, os.path.join(tmp, 'p')], check=True)
fig = next(os.path.join(tmp, f) for f in sorted(os.listdir(tmp)) if Image.open(os.path.join(tmp, f)).size == (825, 333))
js = "global.window={};for(const f of ['tracks.js','extra-tracks.js','firvi-2025.js'])require('./'+f);const t=window.BITIRO_TRACKS['firvi-2025'];console.log(JSON.stringify(t.paths))"
paths = json.loads(subprocess.run(['node', '-e', js], cwd=root, capture_output=True, text=True, check=True).stdout)

im = np.array(Image.open(fig).convert('RGB')); H, W, _ = im.shape
fig_mask = ndi.binary_dilation(ndi.binary_erosion((im < 60).all(axis=2), np.ones((5, 5))), np.ones((5, 5)))
x0 = [25, 273, 521]            # esquina de la grilla de cada cuarto en la figura (px)
mdl = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(mdl)
for p in paths:
    for a, b in zip(p['p'], p['p'][1:]):
        ka, kb = min(2, int(a[0] // 120)), min(2, int(b[0] // 120))
        dr.line([(x0[ka] + (a[0] - 15 - ka * 120) / .375, (a[1] - 15) / .375), (x0[kb] + (b[0] - 15 - kb * 120) / .375, (b[1] - 15) / .375)], fill=255, width=11)
model = np.array(mdl) > 0
for xa, xb, ya, yb in [(20, 60, 262, 298), (728, 765, 22, 58)]:   # las flechas rojas ocultan el inicio de la línea en la figura
    model[ya:yb, xa:xb] = False; fig_mask[ya:yb, xa:xb] = False
d_model = ndi.distance_transform_edt(~model); d_fig = ndi.distance_transform_edt(~fig_mask)
print('IoU de máscaras (grosor de la figura, 11 px): %.3f' % ((fig_mask & model).sum() / (fig_mask | model).sum()))
print('figura → modelo: %.1f %% a ≤2 px, %.1f %% a ≤3 px, máx %.1f px (%.2f cm)' % (100 * (d_model[fig_mask] <= 2).mean(), 100 * (d_model[fig_mask] <= 3).mean(), d_model[fig_mask].max(), d_model[fig_mask].max() * .375))
print('modelo → figura: %.1f %% a ≤2 px, %.1f %% a ≤3 px, máx %.1f px (%.2f cm)' % (100 * (d_fig[model] <= 2).mean(), 100 * (d_fig[model] <= 3).mean(), d_fig[model].max(), d_fig[model].max() * .375))
if out:
    img = np.full((H, W, 3), 255, np.uint8); img[fig_mask & ~model] = (255, 0, 0); img[model & ~fig_mask] = (0, 0, 255); img[fig_mask & model] = (0, 0, 0)
    Image.fromarray(img).resize((W * 2, H * 2), Image.NEAREST).save(out); print('diff guardado en', out)
