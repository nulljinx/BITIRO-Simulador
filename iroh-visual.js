/* BITIRO · Apariencia visual IROH v1 (SIM-3D-INTEGRATION-2, experimental).
   Dibuja el asset derivado del modelo Blender (assets/iroh/iroh-render-v1.js) con el renderer Canvas 2D existente.
   SOLO VISUAL: no lee ni escribe R, HIT, LINE_SENSOR ni el runtime; renderer3d.js lo invoca únicamente con ?robot=iroh. Se carga con <script> estático (sin document.write).
   SIM-3D-INTEGRATION-2: el asset ya viene en el marco R (R = centro del eje de ruedas; placa en −2,3; ruedas a ±5,0; PCB de sensor en +8,0/±1,9;
   TX/RX visual ≈ +6,64 cm (provisional); sonar FUNCIONAL en +7,40 cm (DERIVED_FROM_PHYSICAL_MEASUREMENTS; desacople visual pendiente 0,76 cm, el visual no se movió)). Esa reubicación la hace tools/build-iroh-render-asset.mjs; aquí no se desplaza ni se escala nada.

   Cadena de transformación (ver docs/iroh-3d-integration.md):
     Blender (X izq, −Y delante, Z arriba, 1 BU = 1 m)
       → asset (f = delante, r = derecha, up = altura; 0,01 cm)         [tools/build-iroh-render-asset.mjs]
       → × IROH_VISUAL_SCALE → local(f, r, up) del renderer (cm)        [esta función]
       → mundo: (X(R.x), up, Z(R.y)) + f·(cos h, sin h) + r·(−sin h, cos h), con h = R.th − π/2   [renderer3d.js]
   El origen del asset es R = centro del eje de ruedas y coincide con (R.x, R.y). */
'use strict';
window.IROH_VISUAL = !window.IROH_RENDER_V1 ? undefined : (() => {   // sin asset → sin modelo: el renderer cae al robot legacy
 /* Escala uniforme asset → renderer. 1 = centímetros reales del modelo Blender (placa 17,6 × 11 cm, rueda Ø6,5, ancho entre centros de rueda 10,0).
    La física NO se adapta a esta escala (bodyRadius 8,3, max, rampa y striker son supuestos de simulación). */
 const IROH_VISUAL_SCALE = 1;
 const asset = window.IROH_RENDER_V1;
 const k = asset.unit * IROH_VISUAL_SCALE;
 /* Carga estática (SIM-3D-INTEGRATION-2A): index.html incluye este script y el asset siempre, pero NO se procesa nada hasta que
    renderer3d.js llama a build()/frame con ?robot=iroh; con el selector legacy solo se evalúa esta definición (sin recorrer el asset). */
 let faces = null, framing = null;
 const prepare = () => {
  if (faces) return faces;
  faces = [];
  asset.parts.forEach((part, pi) => {
   for (const f of part) {
    const v = [];
    for (let i = 1; i < f.length; i += 3) v.push([f[i] * k, f[i + 1] * k, f[i + 2] * k]);
    // normal exterior en el marco (f, r, up) por Newell; el generador deja el devanado antihorario visto desde fuera
    let nf = 0, nr = 0, nu = 0;
    for (let i = 0; i < v.length; i++) {
     const a = v[i], b = v[(i + 1) % v.length];
     nf += (a[1] - b[1]) * (a[2] + b[2]); nr += (a[2] - b[2]) * (a[0] + b[0]); nu += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const l = Math.hypot(nf, nr, nu) || 1;
    faces.push({ fill: asset.palette[f[0]], v, n: [nf / l, nr / l, nu / l], part: pi });
   }
  });
  return faces;
 };
 /* Esfera envolvente para encuadrar la cámara Robot: centro vertical = mitad de la altura del modelo, radio = distancia máxima de un
    vértice a (f=0, r=0, up=centerUp). Se deriva solo de los vértices del asset (no de medidas físicas ni de la física del simulador). */
 const frame = () => {
  if (framing) return framing;
  let top = 0;
  for (const q of prepare()) for (const p of q.v) top = Math.max(top, p[2]);
  const centerUp = top / 2;
  let r2 = 0;
  for (const q of faces) for (const p of q.v) r2 = Math.max(r2, p[0] * p[0] + p[1] * p[1] + (p[2] - centerUp) * (p[2] - centerUp));
  return (framing = Object.freeze({ centerUp, radius: Math.sqrt(r2), height: top }));
 };
 /* build: añade a `faces` del renderer las caras visibles del modelo.
    local(f, r, up) → punto de mundo; opts.position = cámara; opts.heading = rumbo visual. Devuelve nº de caras añadidas. */
 function build(out, local, opts) {
  const cam = opts.position, h = opts.heading, f2x = Math.cos(h), f2z = Math.sin(h);
  let added = 0;
  for (const q of prepare()) {
   const p0 = local(q.v[0][0], q.v[0][1], q.v[0][2]);
   // normal en mundo: f·(cos h, sin h) + r·(−sin h, cos h), vertical = up
   const nx = (q.n[0] * f2x - q.n[1] * f2z), nz = (q.n[0] * f2z + q.n[1] * f2x), ny = q.n[2];
   if (nx * (cam.x - p0.x) + ny * (cam.y - p0.y) + nz * (cam.z - p0.z) <= 0) continue;   // cara de espaldas a la cámara
   const pts = [p0];
   for (let i = 1; i < q.v.length; i++) pts.push(local(q.v[i][0], q.v[i][1], q.v[i][2]));
   out.push({ points: pts, fill: q.fill, layer: 4, alpha: 1, stroke: null });
   added++;
  }
  return added;
 }
 return Object.freeze({ IROH_VISUAL_SCALE, build, get frame() { return frame(); }, get assetFaces() { return prepare().length; }, get prepared() { return !!faces; } });
})();
