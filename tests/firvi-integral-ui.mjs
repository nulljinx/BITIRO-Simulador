#!/usr/bin/env node
// FIRVI-2025 · INTEGRACIÓN AUTÓNOMA en navegador real y con el reloj de pared de la competencia (sin reloj falso).
//   node tests/firvi-integral-ui.mjs          # requiere Chrome/Chromium; sin él, se omite con código 0. Tarda ≈ 3 min por recorrido.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { launch, newPage, findChrome } from './perf/cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { findChrome(); } catch { console.log('SKIP · no hay Chrome/Chromium (define CHROME_BIN)'); process.exit(0); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain', 'content-security-policy': CSP, 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch({ port: 9398 });
const SHOTS = process.env.SHOTS_DIR; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let n = 0; const errors = [];
const test = async (name, fn) => { await fn(); n++; console.log('OK · ' + name); };
async function open(width = 1440, height = 900) {
  const page = await newPage(browser);
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Log.enable');
  page.on('Runtime.exceptionThrown', (p) => errors.push('exc: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0]));
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push('console.error: ' + p.args.map((a) => a.value ?? a.description).join(' ')); });
  page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') errors.push('log: ' + p.entry.text + ' ' + (p.entry.url || '')); });
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = new Promise((r) => page.on('Page.loadEventFired', r)); await page.send('Page.navigate', { url: URL_ }); await loaded; await sleep(700);
  return page;
}
const shot = async (page, name) => { if (!SHOTS) return; const { data } = await page.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(data, 'base64')); };
const q = (page, e) => page.evaluate(e);
const click = async (page, id) => { await page.evaluate(`document.getElementById('${id}').click()`); await sleep(250); };
const choose = async (page, id) => { await page.evaluate(`(()=>{const s=document.getElementById('track');s.value='${id}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await sleep(500); };
const setSrc = (page, code) => page.evaluate(`(()=>{const s=document.getElementById('src');s.value=${JSON.stringify(code)};s.dispatchEvent(new Event('input',{bubbles:true}));})()`);

// ── Ronda COMPETITIVA REAL: reloj de pared (sin reloj falso), calibración incluida, un único programa autónomo, sin reposiciones ──
//   FIRVI_ROUTES=A,B node tests/firvi-integral-ui.mjs      (por omisión A y B; cada recorrido tarda ≈ 3 min en tiempo real)
//   RECORD_DIR=docs/firvi-2025-integral node ...           (guarda el registro de cada ronda en JSON)
const PROGRAM = fs.readFileSync(path.join(ROOT, 'tests', 'integration', 'reference-program.iroh'), 'utf8');
const ROUTES = (process.env.FIRVI_ROUTES || 'A,B').split(',');
const REC = process.env.RECORD_DIR; if (REC) fs.mkdirSync(path.join(ROOT, REC), { recursive: true });
const CAL_MS = Number(process.env.CAL_MS || 15000);
const mmss = (t) => t;

for (const route of ROUTES) {
  const track = route === 'B' ? 'firvi-2025-b' : 'firvi-2025';
  const page = await open();
  await test(`Recorrido ${route}: ronda real de punta a punta con el cronómetro de competencia (calibración incluida)`, async () => {
    await choose(page, track);
    await click(page, 'competitionToggle');
    assert.equal(await q(page, 'document.getElementById("compState").textContent'), 'Preparación');
    await setSrc(page, PROGRAM);
    const t0 = Date.now();
    await click(page, 'compStart'); assert.equal(await q(page, 'document.getElementById("compState").textContent'), 'Calibración');
    await sleep(CAL_MS);                                                        // tiempo de calibración: corre el reloj de la ronda
    const clockCal = await q(page, 'document.getElementById("compClock").textContent');
    await click(page, 'compRun');
    assert.equal(await q(page, 'document.getElementById("compState").textContent'), 'Recorrido puntuable');
    assert.equal(await q(page, 'document.getElementById("src").readOnly'), true, 'edición bloqueada durante el recorrido');
    assert.equal(await q(page, 'document.getElementById("track").disabled'), true);
    await click(page, 'run'); await sleep(2500);
    await click(page, 'pulsador');                                              // el programa esperaba el Pulsador
    let end = false, polls = 0, last = '';
    while (!end && Date.now() - t0 < 470000) {
      await sleep(2000); polls++;
      const st = await q(page, `(()=>{const r=BITIRO_COMPETITION.session().round;return {end:!!r.endReached,state:BITIRO_COMPETITION.session().state,overcome:Object.keys(r.overcome),clock:document.getElementById('compClock').textContent}})()`);
      end = st.end || st.state === 'finished'; last = JSON.stringify(st);
    }
    const midClock = await q(page, 'document.getElementById("compClock").textContent');
    assert.ok(end, 'el robot debe llegar a la zona final antes de las 8:00: ' + last);
    const wall = Math.round((Date.now() - t0) / 1000);
    assert.ok(wall < 480, 'dentro de los 8 minutos: ' + wall + ' s');
    // código ajeno durante el recorrido: rechazado
    await q(page, "(()=>{const s=document.getElementById('src');s.readOnly=false;s.value='// otro';})()");
    await click(page, 'run'); assert.match(await q(page, 'document.getElementById("msg").textContent'), /modificar ni subir código|ya se inició|terminó/);
    await q(page, "document.getElementById('src').readOnly=true");
    await click(page, 'compFinish');
    assert.equal(await q(page, 'document.getElementById("compState").textContent'), 'Ronda finalizada');
    await q(page, 'document.getElementById("compEval").open=true'); await sleep(600);
    const out = await q(page, `(()=>{const s=BITIRO_COMPETITION.session(),r=s.rounds[0],ev=BITIRO_FIRVI_SCORING.forSession(s).round(1);
      return {route:'${route}',track:s.track.id,wallClockS:Math.round(r.endClock-r.startClock)/1000,calibrationMs:r.calibrationMs,finishedBy:r.finishedBy,overcome:r.overcome,endReached:r.endReached,faults:r.faults,repositions:r.repositions,checkpoint:r.checkpoint,
       events:r.events.map(e=>({type:e.type,clockMs:e.clockMs,simTime:e.simTime,state:e.state})),physics:r.physics.filter(e=>e.kind!=='touch').map(e=>({kind:e.kind,id:e.id,t:e.t,steps:e.steps,servo:e.servo,servoTo:e.servoTo,from:e.from,to:e.to})).slice(0,40),
       obstacles:r.obstacleState.map(o=>({id:o.id,from:[o.x0,o.y0],to:[o.x,o.y]})),traceSamples:r.trace.length,
       evaluation:{total:ev.total,pendingPotential:ev.pendingPotential,maxPossible:ev.maxPossible,timeMs:ev.timeMs,lastPointClockMsApprox:ev.lastPointClockMsApprox,integrity:ev.integrity,pendingCriteria:ev.pendingCriteria,
        milestones:ev.milestones.map(m=>({id:m.id,status:m.status,points:m.points,max:m.max,source:m.source,attempt:m.attempt,judgeRequired:m.judgeRequired,reason:m.reason}))},
       summary:(()=>{const x=BITIRO_FIRVI_SCORING.forSession(s).summary();return {bestRound:x.bestRound,sumOfRounds:x.sumOfRounds,officialWinner:x.officialWinner,notes:x.notes}})(),
       ui:{headline:document.getElementById('evalHeadline').textContent,totals:document.getElementById('evalTotals').textContent}}})()`);
    assert.equal(out.finishedBy, 'captain'); assert.ok(out.endReached, 'endReached'); assert.deepEqual(Object.keys(out.overcome), ['1', '2']);
    assert.equal(out.faults.length, 0, 'sin faltas de progreso'); assert.equal(out.repositions.length, 0, 'sin reposiciones'); assert.equal(out.checkpoint.enabled, true);
    const st = Object.fromEntries(out.evaluation.milestones.map((m) => [m.id, m]));
    assert.equal(st['touch-start'].status, 'validated-auto'); assert.equal(st['room-initial'].points, 60); assert.equal(st['room-final'].points, 60); assert.equal(st['gaps'].status, 'validated-auto');
    assert.equal(st['obstacle:obstacle-room1'].points, 30); assert.equal(st['obstacle:obstacle-room3'].points, 30);
    assert.equal(st['line-following'].status, 'pending'); assert.equal(st['line-following'].judgeRequired, true); assert.equal(st['final-task'].status, 'pending');
    assert.equal(out.evaluation.total, 220, 'confirmado automáticamente'); assert.equal(out.evaluation.pendingPotential, 80, 'pendiente del juez');
    assert.deepEqual(out.evaluation.pendingCriteria.map((c) => c.id).sort(), ['final-task', 'line-following']);
    assert.deepEqual(out.evaluation.integrity, { unauthorizedJumps: 0, traceGaps: 0, unverifiedStarts: 0 });
    assert.equal(out.summary.officialWinner, null);
    out.clockAtCalibrationEnd = clockCal; out.clockAtEnd = midClock; out.wallElapsedS = wall;
    console.log(`   ${route}: reloj ${clockCal} al terminar la calibración · ronda en ${out.wallClockS} s de reloj de pared (${wall} s totales) · confirmado ${out.evaluation.total} pts + ${out.evaluation.pendingPotential} pendientes del juez`);
    if (REC) fs.writeFileSync(path.join(ROOT, REC, `ronda-real-${route}.json`), JSON.stringify(out, null, 1));
    await shot(page, 'integral-' + route);
  });
  await page.close?.();
}
await test('sin errores de consola ni excepciones durante las rondas reales', async () => { assert.deepEqual(errors, []); });
console.log(`\n${n} pruebas de integración en navegador real OK`);
await browser.close?.(); server.close(); process.exit(0);
