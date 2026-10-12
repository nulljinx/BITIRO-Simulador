/* VALIDATION-3 · C. Matriz integral S08 con el modelo corregido (cabeza progresiva 180 °/s PLACEHOLDER, esperaCabeza 1200 ms).
   Nada se reutiliza de POC-1/POC-2/AUDIT-2: ejecuciones nuevas, evaluador nuevo (copia), árboles nuevos. */
'use strict';
const fs = require('fs'), path = require('path');
const { runCase, START, program } = require('./runner.cjs');
const L = require('./lib.cjs');
const OUT = process.env.HEAD_S08_OUT || path.join(require('os').tmpdir(), 'head-s08');   // trazas y JSON (no se escriben en el repositorio)
fs.mkdirSync(path.join(OUT, 'traces'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'results'), { recursive: true });
const SUBSETS = []; for (let m = 0; m < 16; m++) SUBSETS.push([0, 1, 2, 3].filter((i) => m & (1 << i)));
SUBSETS.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
const NAMES = ['g1-izq', 'g1-der', 'g2-izq', 'g2-der'];
const slug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
function sample(g) {
  const reads = g.api.filter((a) => a[1] === 'leerDistanciaSonar').map((a) => ({ t: +a[0].toFixed(3), lectura: a[3], anguloReal: +(a[8] ?? 0).toFixed(1), objetivo: a[9], origenX: +(a[10] ?? 0).toFixed(2), origenY: +(a[5] ?? 0).toFixed(2), cuerpoQuieto: a[6] === 0 && a[7] === 0 }));
  return reads;
}
function trace(version, r, name) {
  const g = r.log, rows = ['t_s,x_cm,y_cm,rumbo_deg,sensores_ICD,motorL,motorR,IR_izqder,colisiones,cajasMovidas'];
  for (let i = 0; i < g.n; i += 6) rows.push([g.t[i].toFixed(2), g.x[i].toFixed(2), g.y[i].toFixed(2), (g.th[i] * 180 / Math.PI).toFixed(1), g.s[i], g.L[i], g.R[i], (g.ir[i] >> 1) + '' + (g.ir[i] & 1), g.col[i], g.moved[i]].join(','));
  fs.writeFileSync(path.join(OUT, 'traces', `app_${name}.csv`), rows.join('\n'));
  const rd = ['t_s,lectura_cm,angulo_real_deg,objetivo_deg,origen_x,origen_y,cuerpo_quieto'];
  for (const s of sample(g)) rd.push([s.t, s.lectura, s.anguloReal, s.objetivo, s.origenX, s.origenY, s.cuerpoQuieto ? 1 : 0].join(','));
  fs.writeFileSync(path.join(OUT, 'traces', `app_${name}_sonar.csv`), rd.join('\n'));
}
const slim = (r, extra = {}) => {
  if (r.error) return { error: r.error.slice(0, 120), ...extra };
  const e = r.res.ev, g = r.log;
  const reads = sample(g);
  return { version: r.version, cajas: r.slots.filter((s) => typeof s === 'number').length, slots: r.slots.map((i) => (typeof i === 'number' ? NAMES[i] : 'libre')), ir: r.ir, etiqueta: r.label, inicio: r.start,
    total: r.res.total, maxVerificable: r.res.maxVerificable, pendiente: r.res.pendiente, lcd: r.res.finalLcd, colisiones: r.res.collisions, cajasMovidas: r.res.moved, segundos: +r.res.seconds.toFixed(1), terminó: r.res.finished,
    posicionFinal: [+g.x[g.n - 1].toFixed(1), +g.y[g.n - 1].toFixed(1), +(g.th[g.n - 1] * 180 / Math.PI).toFixed(1)],
    lecturasSonar: reads.length, lecturasConCaja: reads.filter((s) => s.lectura < 20).length, anguloMinMax: reads.length ? [Math.min(...reads.map((s) => s.anguloReal)), Math.max(...reads.map((s) => s.anguloReal))] : null,
    cuerpoDuranteCabeza: r.res.cuerpoDuranteCabeza, criterios: Object.fromEntries(Object.entries(e).map(([k, v]) => [k, { pts: v.pts, max: v.max, ev: v.evidencia }])), ...extra };
};
const versions = ['publicada'];
let bad = 0;
for (const version of versions) {
  const rows = [];
  const add = (r, name, extra) => { if (!r.error && name) trace(version, r, name); rows.push(slim(r, extra)); };
  // M1 · 16 distribuciones × IR
  for (const slots of SUBSETS) for (const ir of slots.length ? ['L', 'R'] : ['NINGUNO']) add(runCase({ version, slots, ir, label: 'M1 matriz' }), `M1_${slots.length}cajas_${slots.map((i) => NAMES[i]).join('+') || 'ninguna'}_${ir}`);
  // M2 · ambos IR
  for (const [slots, ir] of [[[0, 1, 2], 'AMBOS→L'], [[0, 1, 2], 'AMBOS→R'], [[0, 1, 2, 3], 'AMBOS→L'], [[1], 'AMBOS→R']]) add(runCase({ version, slots, ir, label: 'M2 ambos IR' }), `M2_${slots.length}cajas_${slug(ir)}`);
  // M3 · señales anticipadas
  for (const [slots, ir] of [[[0, 1, 2], 'PREVIO-L→R'], [[0, 1, 2, 3], 'PREVIO-R→L'], [[2], 'ANTICIPADO-L→suelta→R'], [[0, 3], 'ANTICIPADO-L (se mantiene)'], [[0, 1, 2], 'PULSO EN GAP (L, se suelta)'], [[0, 3], 'PULSO ANTES DE SALIR (R) + L tras parar'], [[0, 1, 2], 'NUEVO +0,5 s (R)'], [[0, 3], 'LIBERA Y REACTIVA (L→suelta→L)'], [[0, 1, 2, 3], 'NUEVO +0,5 s (R)']])
    add(runCase({ version, slots, ir, label: 'M3 señal anticipada', maxSeconds: ir.startsWith('ANTICIPADO-L (se') ? 90 : 170 }), `M3_${slots.length}cajas_${slug(ir)}`);
  // M4 · perturbaciones iniciales
  const P = [['y=170,2', { ...START, y: 170.2 }], ['y=173,2', { ...START, y: 173.2 }], ['x−1,5', { ...START, x: START.x - 1.5 }], ['x+1,5', { ...START, x: START.x + 1.5 }], ['rumbo −4°', { ...START, th: -4 * Math.PI / 180 }], ['rumbo +4°', { ...START, th: 4 * Math.PI / 180 }]];
  for (const [name, pose] of P) for (const [slots, ir] of [[[0, 3], 'L'], [[0, 1, 2], 'R'], [[0, 1, 2, 3], 'L'], [[2], 'R']]) add(runCase({ version, slots, ir, pose, label: 'M4 perturbación ' + name }), null);
  fs.writeFileSync(path.join(OUT, 'results', 'matriz_app.json'), JSON.stringify(rows, null, 1));
  const good = rows.filter((r) => !r.error && r.total === r.maxVerificable);
  console.log(version, 'ejecuciones', rows.length, '· todo lo verificable:', good.length);
  const EXPECTED_WAIT = /ANTICIPADO-L \(se mantiene\)/;
  for (const r of rows.filter((r) => r.error || r.total !== r.maxVerificable)) { if (!(EXPECTED_WAIT.test(r.ir) && !r.terminó && r.colisiones === 0)) bad++; console.log('  ·', r.etiqueta, r.cajas, (r.slots || []).join('+'), r.ir, '→', r.error || `${r.total}/${r.maxVerificable} LCD ${JSON.stringify(r.lcd)} col ${r.colisiones}`); }
  if (rows.some((r) => !r.error && (r.colisiones > 0 || r.cajasMovidas > 0 || r.cuerpoDuranteCabeza.maxCm > 0.01))) bad++;
  console.log('  colisiones máx', Math.max(...rows.filter((r) => !r.error).map((r) => r.colisiones)), '· cajas movidas máx', Math.max(...rows.filter((r) => !r.error).map((r) => r.cajasMovidas)), '· cuerpo durante cabeza máx', Math.max(...rows.filter((r) => !r.error).map((r) => r.cuerpoDuranteCabeza.maxCm)), 'cm');
}

console.log(bad ? `FALLA: ${bad} caso(s) inesperado(s)` : 'Matriz S08 con cabeza móvil: todo lo verificable obtenido, 0 colisiones, 0 cajas movidas.');
process.exit(bad ? 1 : 0);
