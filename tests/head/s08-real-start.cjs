/* S08-PRODUCTION-FIX-1 · Regresión con la POSICIÓN INICIAL REAL de S08 (track.start, tal como la publica la interfaz).
   Programas probados (sin tocar el código de ninguno):
     · docente  → tests/head/fixtures/s08_cabeza_docente.template.ino  (corregida: no llama a salirDeLaBase())
     · nnj      → examples/s08_nnj_simplificado.ino                     (archivo tal cual, sin plantilla)
   La pose NO se escribe a mano: createWorld() la deja como la deja resetRobot(), y aquí se comprueba contra track.start.
   Las pruebas históricas (runner.cjs / s08-matrix.cjs, pose START en zona roja) NO se modifican ni se mezclan con estas.
   El criterio «salir de la base» (10 pts) del evaluador histórico NO APLICA: el robot ya parte después de la barra inicial.
   Los resultados no se maquillan: cualquier caso fallido se imprime y devuelve código de salida 1.
   Cada caso se clasifica y se informa por separado: «base» (llega a una base y muestra Base:N), «sin-cajas» (0 cajas, LCD «SIN CAJAS»,
   sin base) y «espera» (IR anticipado que se mantiene: el robot llega a la primera intersección y espera indefinidamente).
   Además se verifica el HISTORIAL del LCD: el conteo «Cajas:N» mostrado antes de ser sustituido por «Base:» debe ser el real.
   Uso: node tests/head/s08-real-start.cjs [docente|nnj] [--quick] */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib.cjs');
const { evaluate } = require('./eval2.cjs');
const { IRPLANS, CAL, runPlan } = require('./runner.cjs');
const P2 = require('./s08-geometry.cjs');

const N1_Y = 59.1, N1_X = 37.85, N1_TOL = 2.5;   // primera intersección (misma identificación que runner.cjs)
const MIN_HOLD_S = 30;                          // espera mínima demostrada en la primera intersección (el caso corre 90 s)

const NAMES = ['g1-izq', 'g1-der', 'g2-izq', 'g2-der'];
const OUT = process.env.HEAD_S08_OUT || path.join(require('os').tmpdir(), 'head-s08-real-start');
const ROOT = L.ROOT;

function docenteSource() {
  let src = fs.readFileSync(path.join(__dirname, 'fixtures', 's08_cabeza_docente.template.ino'), 'utf8');
  const c = CAL.publicada;
  const val = { V: c.V, ACERCAR: c.acercar, CENTRAR: c.centrar, ENTRAR: c.entrar, ESPERA: 1200, LIMITE: 20 };
  for (const [k, v] of Object.entries(val)) src = src.replaceAll(`{{${k}}}`, String(v));
  return src;
}
const PROGRAMS = {
  docente: () => docenteSource(),
  nnj: () => fs.readFileSync(path.join(ROOT, 'examples', 's08_nnj_simplificado.ino'), 'utf8'),
};


/* Permanencia en la primera intersección: ¿llegó el sensor frontal al nodo N1 y se quedó (ejes parados, sin moverse) hasta el final? */
function holdInfo(w, g) {
  const N1 = P2.trackNodes(w.T).find((n) => Math.abs(n.y - N1_Y) < 0.6 && Math.abs(n.x - N1_X) < 1);
  if (!N1) return { n1: false };
  const near = (i) => { const [sx, sy] = P2.sensorPoint(g.x[i], g.y[i], g.th[i], w.geometry.front); return Math.hypot(sx - N1.x, sy - N1.y) <= N1_TOL; };
  const last = g.n - 1;
  // retrocede desde el final mientras siga en N1 con ejes parados y sin desplazarse respecto a la pose final
  let i = last;
  while (i >= 0 && near(i) && g.L[i] === 0 && g.R[i] === 0 && Math.hypot(g.x[i] - g.x[last], g.y[i] - g.y[last]) <= 0.1) i--;
  const first = i + 1;
  const reached = first <= last && near(last);
  // la primera vez que el sensor tocó N1 (llegada), para informar
  let arrive = -1; for (let k = 0; k < g.n; k++) if (near(k)) { arrive = k; break; }
  return { n1: true, reached, arriveS: arrive >= 0 ? +g.t[arrive].toFixed(2) : null, holdS: reached ? +(g.t[last] - g.t[first]).toFixed(2) : 0, sensorAtN1: near(last) };
}

/* Historial del LCD (entradas [t,[l0,l1]]): conteos «Cajas:N» y «Base:N» en el orden en que se mostraron. */
function lcdHistory(log) {
  const cajas = [], base = []; let firstBaseT = null;
  for (const [t, ln] of log.lcd) {
    const c = /Cajas:\s*(\d+)/.exec(ln[0] || ''), b = /Base:\s*(\d+)/.exec(ln[0] || '');
    if (b) { base.push({ t, n: +b[1] }); if (firstBaseT === null) firstBaseT = t; }
    else if (c) cajas.push({ t, n: +c[1], sinCajas: /SIN CAJAS/.test(ln[1] || '') });
  }
  const antes = cajas.filter((e) => firstBaseT === null || e.t < firstBaseT);
  return { cajas, base, cajasAntesDeBase: antes, firstBaseT };
}

function categoria(c) { return EXPECT_WAIT.test(c.ir) ? 'espera' : c.slots.length === 0 ? 'sin-cajas' : 'base'; }

/* Ejecución con los mismos planes de IR que el histórico (runPlan = run de runner.cjs). */
function runScenario(progName, slots, ir, { maxSeconds = 170 } = {}) {
  const src = PROGRAMS[progName]();
  const w = L.createWorld({ tree: 'app', slots, pose: null, code: src });
  if (w.compileError) return { error: w.compileError };
  // La pose inicial debe ser exactamente la publicada en track.start (no una copia manual de coordenadas).
  const st = w.h.js('JSON.parse(JSON.stringify(track.start))');
  const pose0 = { x: w.h.js('R.x'), y: w.h.js('R.y'), th: w.h.js('R.th') };
  const poseOk = pose0.x === st.x && pose0.y === st.y && Math.abs(pose0.th - (st.heading + Math.PI / 2)) < 1e-12;
  const ex = runPlan(w, { name: ir, events: IRPLANS[ir] || [] }, maxSeconds);
  const trueCount = slots.length;
  const res = evaluate({ world: w, exec: ex, trueCount });
  const salir = res.ev.salir.pts;                          // no aplica: se excluye del total y del máximo
  const obtenido = +(res.total - salir).toFixed(1), maximo = res.maxVerificable - 10;
  return { progName, slots, ir, trueCount, poseOk, pose0, start: st, res, obtenido, maximo, log: ex.log, finished: ex.finished, msg: w.msg(), hold: holdInfo(w, ex.log), lcdHist: lcdHistory(ex.log) };
}

const SUBSETS = []; for (let m = 0; m < 16; m++) SUBSETS.push([0, 1, 2, 3].filter((i) => m & (1 << i)));
SUBSETS.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));

function cases(quick) {
  const out = [];
  const label = (s) => s.map((i) => NAMES[i]).join('+') || 'ninguna';
  for (const slots of SUBSETS) {
    if (!slots.length) { out.push({ slots, ir: 'NINGUNO', tag: 'M1' }); continue; }
    if (quick && slots.length > 1 && slots.length < 4 && slots.join() !== '0,3' && slots.join() !== '0,1,2') continue;
    out.push({ slots, ir: 'L', tag: 'M1 ruta A' }, { slots, ir: 'R', tag: 'M1 ruta B' });
  }
  for (const [slots, ir] of [[[0, 1, 2], 'AMBOS→L'], [[0, 1, 2, 3], 'AMBOS→R'], [[1], 'AMBOS→R'], [[0, 1, 2], 'PREVIO-L→R'], [[0, 1, 2, 3], 'PREVIO-R→L'],
    [[0, 1, 2], 'NUEVO +0,5 s (R)'], [[0, 3], 'LIBERA Y REACTIVA (L→suelta→L)'], [[0, 1, 2], 'PULSO EN GAP (L, se suelta)'], [[0, 3], 'ANTICIPADO-L (se mantiene)']]) {
    if (quick && slots.length === 1) continue;
    out.push({ slots, ir, tag: 'M3 señal IR' });
  }
  return out.map((c) => ({ ...c, name: `${c.slots.length}cajas_${label(c.slots)}_${c.ir}` }));
}

/* Esperas legítimas: el programa NO debe seguir sin una activación exclusiva nueva; no es fallo mientras no colisione. */
const EXPECT_WAIT = /ANTICIPADO-L \(se mantiene\)/;

function check(r) {
  const f = [];
  if (r.error) return ['no compila: ' + r.error.slice(0, 100)];
  const ev = r.res.ev, lcd = r.res.finalLcd;
  if (!r.poseOk) f.push(`pose inicial ≠ track.start (${JSON.stringify(r.pose0)} vs ${JSON.stringify(r.start)})`);
  if (r.res.collisions !== 0) f.push(`colisiones ${r.res.collisions}`);
  if (r.res.moved !== 0) f.push(`cajas desplazadas ${r.res.moved}`);
  if (r.res.cuerpoDuranteCabeza.maxCm > 0.01) f.push(`cuerpo se movió ${r.res.cuerpoDuranteCabeza.maxCm} cm durante la lectura con cabeza`);
  const expectedWait = EXPECT_WAIT.test(r.ir);
  const H = r.lcdHist;
  if (expectedWait) {
    if (r.finished || /Base:/.test(lcd[0])) f.push('avanzó sin una activación IR nueva');
    // el conteo mostrado en el historial debe ser el real y no debe haber «Base:» nunca
    if (!H.cajas.length || H.cajas.some((e) => e.n !== r.trueCount)) f.push(`historial LCD Cajas ${JSON.stringify(H.cajas.map((e) => e.n))} ≠ ${r.trueCount}`);
    if (H.base.length) f.push(`el LCD mostró «Base:» ${JSON.stringify(H.base.map((e) => e.n))} sin activación IR nueva`);
    // demuestra que LLEGÓ a la primera intersección y PERMANECIÓ allí (no basta con «no terminó»)
    const h = r.hold;
    if (!h.n1) f.push('no se identificó la primera intersección (N1)');
    else if (!h.reached) f.push('no llegó a la primera intersección o no permaneció detenido en ella hasta el final');
    else if (h.holdS < MIN_HOLD_S) f.push(`permaneció solo ${h.holdS} s en N1 (< ${MIN_HOLD_S} s)`);
    return f;
  }
  if (H.base.length && r.trueCount === 0) f.push('«Base:» mostrado con 0 cajas');
  if (r.trueCount === 0) {
    if (H.cajas.length !== 1 || H.cajas[0].n !== 0 || !H.cajas[0].sinCajas) f.push(`historial LCD con 0 cajas: ${JSON.stringify(H.cajas)}`);
    if (!/Cajas:\s*0/.test(lcd[0]) || !/SIN CAJAS/.test(lcd[1])) f.push(`LCD sin cajas: ${JSON.stringify(lcd)}`);
    if (!r.finished) f.push('no terminó con 0 cajas');
    return f;
  }
  if (r.obtenido !== r.maximo) {
    const bad = Object.entries(ev).filter(([k, v]) => k !== 'salir' && v.verificable !== false && v.pts < v.max).map(([k, v]) => `${k} ${v.pts}/${v.max}`);
    f.push(`puntaje ${r.obtenido}/${r.maximo} (${bad.join(', ')})`);
  }
  if (ev.base.lcdBase !== r.trueCount) f.push(`LCD Base:${ev.base.lcdBase} ≠ ${r.trueCount}`);
  // Historial: todo «Cajas:N» mostrado antes de «Base:» debe ser el conteo real; y debe haber al menos uno, anterior al primer «Base:»
  if (!H.cajasAntesDeBase.length) f.push('historial LCD: nunca se mostró «Cajas:N» antes de «Base:»');
  else if (H.cajasAntesDeBase.some((e) => e.n !== r.trueCount)) f.push(`historial LCD: Cajas ${JSON.stringify(H.cajasAntesDeBase.map((e) => e.n))} antes de Base ≠ ${r.trueCount}`);
  if (H.base.length !== 1 || H.base[0].n !== r.trueCount) f.push(`historial LCD: Base ${JSON.stringify(H.base.map((e) => e.n))} ≠ [${r.trueCount}]`);
  if (!new RegExp(`Cajas:\\s*${r.trueCount}\\b`).test(lcd[0]) && !r.res.finalLcd.join('').includes('Base')) f.push(`LCD Cajas ${JSON.stringify(lcd)}`);
  return f;
}

function main() {
  const args = process.argv.slice(2), quick = args.includes('--quick');
  const progs = args.filter((a) => PROGRAMS[a]); if (!progs.length) progs.push('docente', 'nnj');
  fs.mkdirSync(OUT, { recursive: true });
  let bad = 0; const all = {};
  for (const p of progs) {
    const rows = [];
    for (const c of cases(quick)) {
      const r = runScenario(p, c.slots, c.ir, { maxSeconds: EXPECT_WAIT.test(c.ir) ? 90 : 170 });
      const f = check(r);
      const q = r.res;
      rows.push({ nombre: c.name, tag: c.tag, categoria: categoria(c), ok: f.length === 0, fallos: f, obtenido: r.obtenido, maximo: r.maximo, lcd: q && q.finalLcd, colisiones: q && q.collisions, cajasMovidas: q && q.moved,
        segundos: q && +q.seconds.toFixed(1), terminó: r.finished, pose0: r.pose0,
        historialCajas: r.lcdHist && r.lcdHist.cajas.map((e) => e.n), historialBase: r.lcdHist && r.lcdHist.base.map((e) => e.n), esperaN1: categoria(c) === 'espera' ? r.hold : undefined });
      if (f.length) bad++;
      console.log(`${f.length ? 'FALLA' : 'OK   '} [${p}] <${categoria(c)}> ${c.name.padEnd(48)} ${r.error ? '' : `${r.obtenido}/${r.maximo}`} LCD ${JSON.stringify(q && q.finalLcd)} col ${q && q.collisions} mov ${q && q.moved}${f.length ? '  ← ' + f.join('; ') : ''}`);
    }
    all[p] = rows;
    for (const cat of ['base', 'sin-cajas', 'espera']) {
      const cr = rows.filter((x) => x.categoria === cat);
      if (cr.length) console.log(`   ${p} · ${cat.padEnd(9)} ${cr.filter((x) => x.ok).length}/${cr.length} conformes` + (cat === 'espera' ? ' (espera indefinida en N1: ' + cr.map((x) => `llegada ${x.esperaN1 && x.esperaN1.arriveS} s, espera ${x.esperaN1 && x.esperaN1.holdS} s`).join('; ') + ')' : ''));
    }
    console.log(`== ${p}: ${rows.filter((x) => x.ok).length}/${rows.length} casos conformes`);
  }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(all, null, 1));
  console.log(bad ? `FALLAN ${bad} caso(s) (ver arriba; no se alteró escenario, física ni parámetros)` : 'S08 con posición inicial real: todos los casos conformes.');
  process.exit(bad ? 1 : 0);
}
if (require.main === module) main();
module.exports = { runScenario, cases, check, PROGRAMS };
