'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib.cjs');
const { evaluate } = require('./eval2.cjs');
const P2 = require('./s08-geometry.cjs');
const START = { x: 37.853, y: 171.7, th: 0 };          // dentro de la zona roja (cuerpo completo), como POC-2
const CAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 's08-calibracion.json')));
function program(version, o = {}, template = 's08_cabeza_docente.template.ino') {
  let src = fs.readFileSync(path.join(__dirname, 'fixtures', template), 'utf8');
  const c = CAL[version];
  const val = { V: c.V, ACERCAR: c.acercar, CENTRAR: c.centrar, ENTRAR: c.entrar, ESPERA: 1200, LIMITE: 20, ...o };
  for (const [k, v] of Object.entries(val)) src = src.replaceAll(`{{${k}}}`, String(v));
  return src;
}
const IRPLANS = {
  L: [{ k: 0, v: 1, after: 2.0 }], R: [{ k: 1, v: 1, after: 2.0 }],
  'AMBOS→L': [{ k: 0, v: 1, after: 2.0 }, { k: 1, v: 1, after: 2.0 }, { k: 1, v: 0, after: 4.0 }],
  'AMBOS→R': [{ k: 0, v: 1, after: 2.0 }, { k: 1, v: 1, after: 2.0 }, { k: 0, v: 0, after: 4.0 }],
  'PREVIO-L→R': [{ k: 0, v: 0, after: 2.0 }, { k: 1, v: 1, after: 4.0 }],
  'PREVIO-R→L': [{ k: 1, v: 0, after: 2.0 }, { k: 0, v: 1, after: 4.0 }],
  NINGUNO: [],
  'ANTICIPADO-L (se mantiene)': [],
  'ANTICIPADO-L→suelta→R': [{ k: 0, v: 0, after: 2.0 }, { k: 1, v: 1, after: 4.0 }],
  'NUEVO +0,5 s (R)': [{ k: 1, v: 1, after: 0.5 }],
  'LIBERA Y REACTIVA (L→suelta→L)': [{ k: 0, v: 0, after: 1.0 }, { k: 0, v: 1, after: 3.0 }],
  'PULSO EN GAP (L, se suelta)': [{ k: 0, v: 1, at: 8 }, { k: 0, v: 0, at: 9 }, { k: 1, v: 1, after: 2.0 }],
  'PULSO ANTES DE SALIR (R) + L tras parar': [{ k: 1, v: 1, at: 0.5 }, { k: 1, v: 0, at: 1.5 }, { k: 0, v: 1, after: 2.0 }],
};
const IRPRE = { 'PREVIO-L→R': [{ k: 0, v: 1 }], 'PREVIO-R→L': [{ k: 1, v: 1 }], 'ANTICIPADO-L (se mantiene)': [{ k: 0, v: 1 }], 'ANTICIPADO-L→suelta→R': [{ k: 0, v: 1 }], 'LIBERA Y REACTIVA (L→suelta→L)': [{ k: 0, v: 1 }] };
function run(world, plan, maxSeconds) {
  const { h } = world;
  for (const p of IRPRE[plan.name] || []) h.js(`setIR(${p.k},${p.v})`);
  h.el('pulsador').events.click?.();
  const steps = plan.events.map((p) => ({ ...p, done: false }));
  const N1 = P2.trackNodes(world.T).find((n) => Math.abs(n.y - 59.1) < 0.6 && Math.abs(n.x - 37.85) < 1);
  let stopStart = null, t0 = null, t = 0;
  for (; t < 120 * maxSeconds && h.js('running'); t++) {
    h.tick(1);
    if (t0 === null) {
      const x = h.js('R.x'), y = h.js('R.y'), th = h.js('R.th'), Lm = h.js('R.L'), Rm = h.js('R.R');
      const [sx, sy] = P2.sensorPoint(x, y, th, world.geometry.front);
      const near = Math.hypot(sx - N1.x, sy - N1.y) <= 2.5 && Lm === 0 && Rm === 0 && y < 90;
      if (near && stopStart === null) stopStart = h.js('simTime'); if (!near) stopStart = null;
      if (stopStart !== null && h.js('simTime') - stopStart >= 0.3) t0 = stopStart;
    }
    { const now = h.js('simTime'); for (const p of steps) { if (p.done) continue; if (p.at !== undefined ? now >= p.at : (t0 !== null && now >= t0 + p.after)) { h.js(`setIR(${p.k},${p.v})`); p.done = true; } } }
  }
  h.tick(120 * 1.2);
  const log = JSON.parse(JSON.stringify(h.js('__log')));
  return { log, finished: !h.js('running'), seconds: t / 120 };
}
function runCase({ version, slots, ir, pose = START, code = null, maxSeconds = 170, label = '', slew = null, trees = null, headCfg = null, progO = {}, boxHeight = null }) {
  const tree = trees || 'app';
  const src = code || program(version, progO);
  const w = L.createWorld({ tree, slots, pose, code: src, boxHeight });
  if (w.compileError) return { error: w.compileError };
  const cfg = { ...(slew ? { slewDegPerS: slew } : {}), ...(headCfg || {}) };
  if (Object.keys(cfg).length) { w.h.js(`HEAD_SONAR.configure(${w.faceRef},${JSON.stringify(cfg)})`); w.h.js('HEAD_SONAR.reset()'); }
  const ex = run(w, { name: ir, events: IRPLANS[ir] || [] }, maxSeconds);
  let globals = null; try { globals = JSON.parse(JSON.stringify(w.h.js('scopes[0]'))); } catch (e) {}
  const trueCount = slots.filter((s) => typeof s === 'number').length;
  const res = evaluate({ world: w, exec: ex, trueCount });
  return { version, tree, slots, ir, label, start: pose, res, log: ex.log, msg: w.msg(), globals };
}
module.exports = { START, CAL, program, runCase, IRPLANS };
if (require.main === module) {
  const [version = 'main', slotsArg = '0,1,2,3', ir = 'L'] = process.argv.slice(2);
  const slots = slotsArg === '-' ? [] : slotsArg.split(',').map(Number);
  const r = runCase({ version, slots, ir });
  if (r.error) { console.log('ERROR', r.error); process.exit(1); }
  const q = r.res;
  console.log(JSON.stringify({ total: q.total, maxVerificable: q.maxVerificable, pendiente: q.pendiente, lcd: q.finalLcd, col: q.collisions, moved: q.moved, s: q.seconds, fin: q.finished, cuerpoDuranteCabezaCm: q.cuerpoDuranteCabeza.maxCm }));
  for (const [k, v] of Object.entries(q.ev)) console.log(k.padEnd(14), `${v.pts}/${v.max}`, '|', v.evidencia.join(' ; '));
  console.log('msg:', r.msg.slice(0, 250));
}
