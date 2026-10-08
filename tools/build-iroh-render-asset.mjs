#!/usr/bin/env node
/* BITIRO · Generador del asset visual runtime IROH render v1.
   Uso:  node tools/build-iroh-render-asset.mjs [ruta/iroh_lowpoly.glb] [--check]
   Entrada : GLB exportado del modelo Blender maestro (no se lee el .blend, ni fotos).
   Salida  : assets/iroh/iroh-render-v1.js  (script clásico, carga síncrona, sin fetch).
   Sin dependencias: lee el GLB con Node puro, fusiona triángulos coplanares del mismo material en polígonos,
   descarta piezas/detalles bajo el umbral visual y cuantiza a 0,01 cm. Determinista: misma entrada → mismo archivo.

   Marco de salida (marco local del renderer, ver docs/iroh-3d-integration.md):
     f  = hacia delante del robot  = glTF +Z  (Blender −Y)
     r  = hacia la DERECHA del robot = glTF −X (Blender −X; Blender +X es la izquierda)
     up = altura sobre el suelo     = glTF +Y  (Blender +Z)
   Unidades del asset: 0,01 cm enteros (1 unidad Blender = 1 m → ×10000).

   SIM-3D-INTEGRATION-2: el origen del asset ya NO es el centro de la placa sino R = centro del eje de ruedas (docs/physical-geometry.md).
   Tras convertir al marco (f, r, up) cada pieza recibe un desplazamiento longitudinal (tabla RELOCATE, solo f; r y up no cambian). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const check = process.argv.includes('--check');
const glbPath = path.resolve(args[0] || path.join(root, '..', '..', 'exports', 'iroh_lowpoly.glb'));
const outPath = path.join(root, 'assets', 'iroh', 'iroh-render-v1.js');

/* ───────── Política por pieza ─────────
   keep   : fusión coplanar completa
   drop   : no entra al asset runtime (detalle microscópico / cables)
   hull   : se sustituye por su caja envolvente alineada a los ejes (5 caras visibles)
   Las piezas nombradas aquí son las de IROH-BLENDER-1.1. Cualquier nodo nuevo del GLB se conserva (keep). */
const POLICY = {
  CASTER: 'keep', CHASSIS_LOWER: 'keep', CHASSIS_UPPER: 'keep', ELECTRONICS: 'keep', FRONT_MECHANISM: 'hull',
  HEAD_BASE: 'hull', HEAD_MECHANISM: 'keep', HEAD_RED_PLATE: 'keep', HEAD_SERVO_TILT: 'hull',
  ULTRASONIC_RX: 'keep', ULTRASONIC_TX: 'keep', ULTRASONIC_BODY: 'keep', HEAD_SERVO_PAN: 'hull',
  LCD: 'keep', LINE_SENSOR_BRACKET: 'hull', LINE_SENSOR_C: 'keep', LINE_SENSOR_L: 'keep', LINE_SENSOR_R: 'keep',
  MOTOR_L: 'keep', MOTOR_R: 'keep', OBSTACLE_SENSOR_L: 'hull', OBSTACLE_SENSOR_R: 'hull', SERVO: 'hull',
  SPACERS: 'keep', WHEEL_L: 'keep', WHEEL_R: 'keep', WIRES_SIMPLIFIED: 'drop',
};
/* Una pieza 'keep' que aún supere este tope de polígonos se reduce a 'hull' salvo que esté en EXEMPT. */
const MAX_POLYS = 140;
const EXEMPT = new Set(['WHEEL_L', 'WHEEL_R', 'CHASSIS_LOWER', 'CHASSIS_UPPER', 'HEAD_RED_PLATE', 'CASTER']);
/* Polígonos más pequeños que esto (cm²) se descartan: tornillos, patillas, etc. (no afecta silueta). */
const MIN_AREA_CM2 = 0.035;
/* Umbral propio para piezas pequeñas muy facetadas (esfera del caster): conserva la silueta, no cada faceta. */
const MIN_AREA_BY_PART = { CASTER: 0.3 };
const Q = 10000; // m → 0,01 cm

/* ───────── Reubicación Blender → R (SIM-3D-INTEGRATION-2) ─────────
   En el Blender maestro el origen es el centro de la placa y el eje de ruedas queda a +2,0 cm (WHEEL_Y = −2,0: ESTIMADO DE FOTO).
   Los valores MEDIDOS FÍSICAMENTE mandan sobre ese estimado (CLAUDE.md del taller IROH 3D) y fijan el marco R = eje:
     centro de la placa = −2,3 cm (borde frontal +6,5)  PHYSICALLY_MEASURED/DERIVED → todo el chasis, salvo lo listado abajo
     centros de rueda    = f 0, r ±5,0                   PHYSICALLY_MEASURED          → WHEEL_*, MOTOR_*: el eje del Blender (+2,0) pasa a 0
     sensor central      = f +8,0                        PHYSICALLY_MEASURED          → PCB de línea centrada en 8,0 (punto óptico centrado: SUPUESTO)
     sensores laterales  = r ±1,9                        DERIVED_FROM_PHYSICAL_PCB_GEOMETRY (el Blender ya los tiene en ±1,9)
     base negra de la cabeza = centro +3,95 (3,50 × 3,20; borde delantero +5,70, trasero +2,20)  DERIVED_FROM_PHYSICAL_MEASUREMENTS
                                                          → toda la cabeza (HEAD_*, ULTRASONIC_*) se traslada RÍGIDAMENTE hasta que el centro de HEAD_BASE cae en 3,95
     HEAD_BASE: footprint visual escalado a 3,50 × 3,20 medido (solo la base; lo montado conserva su posición)
     cara de TX/RX resultante ≈ +6,64                    PHOTO-CONSTRAINED / PROVISIONAL_PHYSICAL_GEOMETRY (no es PHYSICALLY_MEASURED directo).
                                                          El +4,0 anterior (mal interpretado como plano de TX/RX) sigue siendo el origen FUNCIONAL del sonar,
                                                          pendiente de corrección funcional; este generador no lo toca ni lo usa.
     pivote del servo de golpe = HIT.pivotForward 8,6    SIMULATION_ASSUMPTION        → SERVO y FRONT_MECHANISM se centran en el pivote que ya dibuja el palo
   Solo cambia f. Nada de esto entra a la física: es el modelo VISUAL poniéndose de acuerdo con ella. */
const PLATE_CENTER_F = -2.3, AXLE_F = 0, SENSOR_F = 8.0, HEAD_BASE_CENTER_F = 3.95, HEAD_BASE_LEN = 3.5, HEAD_BASE_WID = 3.2, STRIKER_PIVOT_F = 8.6;
const HEAD_PARTS = new Set(['HEAD_BASE', 'HEAD_MECHANISM', 'HEAD_RED_PLATE', 'HEAD_SERVO_TILT', 'HEAD_SERVO_PAN', 'ULTRASONIC_RX', 'ULTRASONIC_TX', 'ULTRASONIC_BODY']);
const AXLE_PARTS = new Set(['WHEEL_L', 'WHEEL_R', 'MOTOR_L', 'MOTOR_R']);
const SENSOR_PARTS = new Set(['LINE_SENSOR_C', 'LINE_SENSOR_L', 'LINE_SENSOR_R', 'LINE_SENSOR_BRACKET']);
const STRIKER_PARTS = new Set(['SERVO', 'FRONT_MECHANISM']);

/* ───────── Lectura GLB ───────── */
const buf = fs.readFileSync(glbPath);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('No es un GLB');
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = buf.slice(binStart);
const sha = crypto.createHash('sha256').update(buf).digest('hex');

function accessor(i) {
  const a = gltf.accessors[i], bv = gltf.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  const read = a.componentType === 5126 ? (o) => bin.readFloatLE(o) : a.componentType === 5125 ? (o) => bin.readUInt32LE(o) : (o) => bin.readUInt16LE(o);
  const size = a.componentType === 5123 ? 2 : 4, stride = bv.byteStride || size * comps;
  for (let k = 0; k < a.count; k++) { const row = []; for (let c = 0; c < comps; c++) row.push(read(off + k * stride + c * size)); out.push(comps === 1 ? row[0] : row); }
  return out;
}
// Posición mundial del nodo (el GLB solo usa traslaciones; se verifica).
const parent = new Map();
gltf.nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
function worldT(i) {
  let t = [0, 0, 0], k = i;
  while (k != null) {
    const n = gltf.nodes[k];
    if (n.rotation && n.rotation.some((v, j) => Math.abs(v - [0, 0, 0, 1][j]) > 1e-9)) throw new Error('rotación no soportada en ' + n.name);
    if (n.scale && n.scale.some((v) => Math.abs(v - 1) > 1e-9)) throw new Error('escala no soportada en ' + n.name);
    if (n.translation) t = t.map((v, j) => v + n.translation[j]);
    k = parent.get(k);
  }
  return t;
}
// glTF (x izquierda, y arriba, z delante) → (f, r, up) en 0,01 cm
const toLocal = (p) => [Math.round(p[2] * Q), Math.round(-p[0] * Q), Math.round(p[1] * Q)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/* ───────── Triángulos por nodo ───────── */
function nodeTriangles(i) {
  const n = gltf.nodes[i];
  if (n.mesh == null) return [];
  const t = worldT(i), tris = [];
  for (const p of gltf.meshes[n.mesh].primitives) {
    const pos = accessor(p.attributes.POSITION).map((v) => toLocal([v[0] + t[0], v[1] + t[1], v[2] + t[2]]));
    const idx = accessor(p.indices);
    // glTF→(f,r,up) tiene det = −1 (invierte la lateralidad): se invierte el devanado para que el asset conserve
    // la convención «antihorario visto desde fuera» (normal de Newell hacia fuera) en el marco (f, r, up).
    for (let k = 0; k < idx.length; k += 3) tris.push({ v: [pos[idx[k]], pos[idx[k + 2]], pos[idx[k + 1]]], m: p.material });
  }
  return tris;
}

/* ───────── Fusión coplanar ───────── */
const key = (v) => v.join(',');
function triNormal(t) { return unit(cross(sub(t.v[1], t.v[0]), sub(t.v[2], t.v[0]))); }
function merge(tris) {
  const n = tris.length, parentIdx = tris.map((_, i) => i);
  const find = (x) => { while (parentIdx[x] !== x) { parentIdx[x] = parentIdx[parentIdx[x]]; x = parentIdx[x]; } return x; };
  const normals = tris.map(triNormal), edges = new Map();
  tris.forEach((t, i) => { for (let e = 0; e < 3; e++) { const a = key(t.v[e]), b = key(t.v[(e + 1) % 3]), k = a < b ? a + '|' + b : b + '|' + a; (edges.get(k) || edges.set(k, []).get(k)).push(i); } });
  for (const list of edges.values()) {
    if (list.length !== 2) continue;
    const [a, b] = list;
    if (tris[a].m !== tris[b].m) continue;
    if (dot(normals[a], normals[b]) < 0.99995) continue;
    // mismo plano (no solo paralelo)
    if (Math.abs(dot(normals[a], sub(tris[b].v[0], tris[a].v[0]))) > 3) continue;
    parentIdx[find(a)] = find(b);
  }
  const groups = new Map();
  tris.forEach((_, i) => { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(i); });
  const polys = [];
  for (const ids of groups.values()) {
    // aristas dirigidas que no tienen su opuesta dentro del grupo = contorno
    const dir = new Map();
    for (const i of ids) for (let e = 0; e < 3; e++) { const a = key(tris[i].v[e]), b = key(tris[i].v[(e + 1) % 3]); dir.set(a + '>' + b, [tris[i].v[e], tris[i].v[(e + 1) % 3]]); }
    const next = new Map(); let ok = true;
    for (const [k, [pa, pb]] of dir) {
      const [a, b] = k.split('>');
      if (dir.has(b + '>' + a)) continue;
      if (!next.has(a)) next.set(a, []);
      next.get(a).push({ to: b, pa, pb });
    }
    const loops = [], used = new Set();
    for (const [a0, list0] of next) {
      for (const e0 of list0) {
        const id0 = a0 + '>' + e0.to; if (used.has(id0)) continue;
        const loop = []; let a = a0, e = e0, guard = 0;
        while (e && !used.has(a + '>' + e.to) && guard++ < 5000) {
          used.add(a + '>' + e.to); loop.push(e.pa);
          const cands = (next.get(e.to) || []).filter((c) => !used.has(e.to + '>' + c.to));
          a = e.to; e = cands[0];
        }
        loops.push(loop);
      }
    }
    if (!loops.length) ok = false;
    const nrm = normals[ids[0]];
    const area = (lp) => { let s = [0, 0, 0]; for (let k = 0; k < lp.length; k++) s = s.map((v, j) => v + cross(lp[k], lp[(k + 1) % lp.length])[j]); return Math.abs(dot(s, nrm)) / 2; };
    loops.sort((a, b) => area(b) - area(a));
    let outline = ok ? loops[0] : null;
    if (outline) outline = dropCollinear(outline);
    if (!outline || outline.length < 3) { for (const i of ids) polys.push({ v: tris[i].v, m: tris[ids[0]].m }); continue; }
    polys.push({ v: outline, m: tris[ids[0]].m });
  }
  return polys;
}
function dropCollinear(lp) {
  let out = lp.slice(), changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let k = 0; k < out.length; k++) {
      const a = out[(k + out.length - 1) % out.length], b = out[k], c = out[(k + 1) % out.length];
      const ab = sub(b, a), bc = sub(c, b);
      if (len(cross(ab, bc)) <= 1e-6 * len(ab) * len(bc) + 1e-9 || len(ab) < 1) { out.splice(k, 1); changed = true; break; }
    }
  }
  return out;
}
const polyArea = (p) => { let s = [0, 0, 0]; for (let k = 0; k < p.v.length; k++) s = s.map((x, j) => x + cross(p.v[k], p.v[(k + 1) % p.v.length])[j]); return len(s) / 2 / 1e4; }; // cm²
const polyNormal = (p) => { let s = [0, 0, 0]; for (let k = 0; k < p.v.length; k++) s = s.map((x, j) => x + cross(p.v[k], p.v[(k + 1) % p.v.length])[j]); return unit(s); };

function hullBox(tris, mat) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const t of tris) for (const v of t.v) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], v[j]); mx[j] = Math.max(mx[j], v[j]); }
  const P = (f, r, u) => [f ? mx[0] : mn[0], r ? mx[1] : mn[1], u ? mx[2] : mn[2]];
  // caras con normal hacia fuera (devanado CCW visto desde fuera)
  const faces = [
    [P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)], [P(0, 0, 0), P(0, 0, 1), P(0, 1, 1), P(0, 1, 0)],
    [P(0, 1, 0), P(0, 1, 1), P(1, 1, 1), P(1, 1, 0)], [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)],
    [P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)], [P(0, 0, 0), P(0, 1, 0), P(1, 1, 0), P(1, 0, 0)],
  ];
  return faces.map((v) => ({ v, m: mat }));
}

/* ───────── Construcción ───────── */
const mats = gltf.materials.map((m) => '#' + m.pbrMetallicRoughness.baseColorFactor.slice(0, 3).map((c) => {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, '0');
}).join(''));
const parts = [], report = [];
let srcTris = 0, outFaces = 0;
/* Reubicación: los desplazamientos se miden sobre la propia geometría del GLB (no sobre números del Blender copiados aquí). */
const nodeTris = new Map();
for (let i = 0; i < gltf.nodes.length; i++) if (gltf.nodes[i].mesh != null) nodeTris.set(gltf.nodes[i].name, nodeTriangles(i));
const need = (name) => { const t = nodeTris.get(name); if (!t) throw new Error('falta la pieza ' + name + ' en el GLB'); return t; };
const fRange = (names) => { const f = names.flatMap((n) => need(n).flatMap((t) => t.v.map((v) => v[0]))); return [Math.min(...f), Math.max(...f)]; };
const fCenter = (names) => { const [a, b] = fRange(names); return (a + b) / 2; };
const cm = (v) => Math.round(v * 100);   // cm → 0,01 cm
const shiftPlate = cm(PLATE_CENTER_F) - fCenter(['CHASSIS_LOWER']);   // centro de la placa del GLB → −2,3 (el Blender lo tiene en 0)
const shiftAxle = cm(AXLE_F) - fCenter(['WHEEL_L', 'WHEEL_R']);        // eje de ruedas del GLB → 0
const shiftSensor = cm(SENSOR_F) - fCenter(['LINE_SENSOR_C']);         // punto óptico (centro de PCB) → +8,0
const shiftSonar = cm(HEAD_BASE_CENTER_F) - fCenter(['HEAD_BASE']);   // traslación rígida de la cabeza: centro de la base negra → +3,95 (TX/RX ≈ +6,64)
const shiftStriker = cm(STRIKER_PIVOT_F) - fCenter(['SERVO']);         // servo de golpe → pivote del palo
/* El LCD es ESTIMADO DE FOTO: cede ante la cabeza y, si hiciera falta, queda 1 mm detrás de la base (VISUAL_CLEARANCE_ADJUSTMENT; con la base en 2,20 ya no se activa). */
const shiftLcd = Math.min(shiftPlate, fRange(['HEAD_BASE'])[0] + shiftSonar - 10 - fRange(['LCD'])[1]);
const shiftFor = (name) => name === 'LCD' ? shiftLcd : AXLE_PARTS.has(name) ? shiftAxle : SENSOR_PARTS.has(name) ? shiftSensor : HEAD_PARTS.has(name) ? shiftSonar : STRIKER_PARTS.has(name) ? shiftStriker : shiftPlate;
const relocation = {};
for (let i = 0; i < gltf.nodes.length; i++) {
  const n = gltf.nodes[i];
  if (n.mesh == null) continue;
  const df = shiftFor(n.name);
  relocation[n.name] = df / 100;
  const tris = nodeTris.get(n.name); srcTris += tris.length;
  for (const t of tris) t.v = t.v.map((v) => [v[0] + df, v[1], v[2]]);
  if (n.name === 'HEAD_BASE') {   /* SIM-3D-INTEGRATION-2A.1: footprint MEDIDO 3,50 × 3,20 (el Blender tiene ≈3,6 × 4,0); centro en f +3,95, r 0; la altura no cambia y las piezas montadas NO se mueven */
    const ext = (j) => { const a = tris.flatMap((t) => t.v.map((v) => v[j])); return [Math.min(...a), Math.max(...a)]; };
    const [f0, f1] = ext(0), [r0, r1] = ext(1), fc = (f0 + f1) / 2, rc = (r0 + r1) / 2;
    const kf = cm(HEAD_BASE_LEN) / (f1 - f0), kr = cm(HEAD_BASE_WID) / (r1 - r0);
    for (const t of tris) t.v = t.v.map((v) => [Math.round(fc + (v[0] - fc) * kf), Math.round(0 + (v[1] - rc) * kr), v[2]]);
  }
  let policy = POLICY[n.name] || 'keep';
  if (policy === 'drop') { report.push([n.name, tris.length, 0, 'drop', 'df=' + (df / 100).toFixed(2)]); continue; }
  let polys;
  if (policy === 'hull') polys = hullBox(tris, tris[0].m);
  else {
    polys = merge(tris).filter((p) => polyArea(p) >= (MIN_AREA_BY_PART[n.name] ?? MIN_AREA_CM2));
    if (polys.length > MAX_POLYS && !EXEMPT.has(n.name)) { policy = 'hull(>' + MAX_POLYS + ')'; polys = hullBox(tris, tris[0].m); }
  }
  // Las piezas con polígonos hull toman el material dominante por área en el casco; los hull ya llevan material de su primer triángulo.
  const faces = polys.map((p) => ({ m: p.m, n: polyNormal(p), v: p.v }));
  outFaces += faces.length;
  report.push([n.name, tris.length, faces.length, policy, 'df=' + (df / 100).toFixed(2)]);
  parts.push({ name: n.name, faces });
}

/* ───────── Emisión ───────── */
const used = [...new Set(parts.flatMap((p) => p.faces.map((f) => f.m)))].sort((a, b) => a - b);
const palette = used.map((m) => mats[m]), remap = new Map(used.map((m, k) => [m, k]));
const names = parts.map((p) => p.name);
const data = parts.map((p) => p.faces.map((f) => [remap.get(f.m), ...f.v.flat()]));
const body = `/* AUTO-GENERADO por tools/build-iroh-render-asset.mjs — NO EDITAR A MANO.
   Fuente: exports/iroh_lowpoly.glb (IROH-BLENDER-1.1)  sha256=${sha}
   Formato: parts[i] = [[colorIdx, f,r,up, f,r,up, ...], ...] (nombres en names), enteros en 0,01 cm, marco local (f=delante, r=derecha, up=altura).
   Marco: origen = R = centro del eje de ruedas (SIM-3D-INTEGRATION-2); placa en f=−2,3, ruedas en r=±5,0.
   Es solo apariencia: no contiene física, sensores funcionales ni medidas del simulador. */
'use strict';
window.IROH_RENDER_V1=Object.freeze({
 version:'iroh-render-v1',frame:'R-axle-center',source:'iroh_lowpoly.glb',sourceSha256:'${sha}',unit:0.01,
 stats:Object.freeze({sourceTriangles:${srcTris},polygons:${outFaces},parts:${parts.length}}),
 palette:${JSON.stringify(palette)},
 names:${JSON.stringify(names)},
 parts:${JSON.stringify(data)}
});
`;
if (check) {
  const cur = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (cur !== body) { console.error('El asset NO coincide con la regeneración desde el GLB'); process.exit(1); }
  console.log('Asset reproducible: coincide byte a byte con la regeneración (' + outFaces + ' polígonos).');
} else {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body);
  console.log(report.map((r) => r.join('\t')).join('\n'));
  console.log(`\nGLB ${buf.length} B · triángulos fuente ${srcTris} · polígonos runtime ${outFaces} · asset ${Buffer.byteLength(body)} B → ${path.relative(root, outPath)}`);
}
