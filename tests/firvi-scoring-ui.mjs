#!/usr/bin/env node
// FIRVI-2025-C — panel de evaluación en navegador real: hitos, puntos, estado (cuatro estados distinguibles), procedencia, decisión del juez
// (solo tras la ronda), dos rondas por separado, sin ganador oficial, móvil sin desborde y sin errores de consola.
//   node tests/firvi-scoring-ui.mjs          # requiere Chrome/Chromium; sin él, se omite con código 0.
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
const browser = await launch({ port: 9397 });
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
const rows = (page) => q(page, `[...document.querySelectorAll('#evalBody tr')].map(tr=>({label:tr.cells[0].textContent,pts:tr.cells[1].textContent,st:tr.querySelector('.eval-st').dataset.st,stText:tr.querySelector('.eval-st').textContent,why:tr.cells[3].textContent,judge:tr.cells[4].textContent}))`);
const SWEEP = `void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(1200);botonInicio();}
int ult=0;int lost=0;int done=0;
void loop(){
 if(done==0 && leerDistanciaSonar()<=14){detenerse();pausa(300);moverServoGolpe(1);pausa(1500);moverServoGolpe(0);pausa(1200);done=1;}
 bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;

const page = await open();
await test('el panel de evaluación no aparece fuera de la competencia y es compacto dentro de ella', async () => {
  await choose(page, 'firvi-2025');
  assert.equal(await q(page, "document.getElementById('compEval').hidden"), true);
  await click(page, 'competitionToggle');
  assert.equal(await q(page, "document.getElementById('compEval').hidden"), false);
  assert.equal(await q(page, "document.getElementById('compEval').open"), false, 'plegado por defecto: la barra sigue compacta');
  const h = await q(page, "document.getElementById('competitionBar').getBoundingClientRect().height"); assert.ok(h < 150, 'barra con panel plegado: ' + h);
});

await test('ronda en curso: ocho hitos con puntos, estado, motivo y procedencia; el juez aún no puede decidir', async () => {
  await click(page, 'compStart'); await setSrc(page, SWEEP); await click(page, 'compRun'); await click(page, 'run'); await sleep(2500);
  await q(page, "document.getElementById('compEval').open=true"); await q(page, "document.getElementById('compEval').dispatchEvent(new Event('toggle'))"); await sleep(300);
  let r = await rows(page); assert.equal(r.length, 8);
  assert.equal(r.find((x) => /tacto/.test(x.label)).st, 'pending', 'el programa espera el Pulsador');
  await click(page, 'pulsador'); await sleep(2500);
  const t0 = Date.now(); do { await sleep(700); r = await rows(page); } while (r.find((x) => /abanico/.test(x.label) && /cuarto 1/.test(x.label)).st !== 'validated-auto' && Date.now() - t0 < 60000);
  assert.equal(r.find((x) => /tacto/.test(x.label)).st, 'validated-auto'); assert.equal(r.find((x) => /tacto/.test(x.label)).stText, 'Validado automáticamente');
  assert.equal(r.find((x) => /tacto/.test(x.label)).pts, '10 / 10');
  assert.equal(r.find((x) => /cuarto 1/.test(x.label) && /abanico/.test(x.label)).pts, '30 / 30');
  assert.equal(r.find((x) => /Seguimiento/.test(x.label)).st, 'pending'); assert.match(r.find((x) => /Seguimiento/.test(x.label)).judge, /Tras la ronda/);
  assert.match(r.find((x) => /tacto/.test(x.label)).why, /Procedencia:/);
  assert.match(await q(page, "document.getElementById('evalTotals').textContent"), /provisional/);
  await shot(page, 'eval-1-en-curso');
});

await test('ronda terminada: cuatro estados distinguibles (texto, no solo color); el juez valida, niega y quita sin tocar la física', async () => {
  const poseBefore = await q(page, 'JSON.stringify([R.x,R.y,activeObstacles.map(o=>[o.x,o.y])])');
  await click(page, 'compFinish'); await sleep(1300);
  const hist = await q(page, 'JSON.stringify(BITIRO_COMPETITION.session().rounds[0])');
  let r = await rows(page);
  const states = new Set(r.map((x) => x.st)); for (const s of ['validated-auto', 'pending', 'not-achieved']) assert.ok(states.has(s), 'falta el estado ' + s + ': ' + [...states]);
  const line = () => rows(page).then((x) => x.find((y) => /Seguimiento/.test(y.label)));
  assert.match((await line()).judge, /Conceder/);
  await q(page, "[...document.querySelectorAll('#evalBody tr')].find(tr=>/Seguimiento/.test(tr.cells[0].textContent)).querySelector('button[aria-label^=Conceder]').click()"); await sleep(300);
  let l = await line(); assert.equal(l.st, 'validated-judge'); assert.equal(l.stText, 'Validado por juez'); assert.equal(l.pts, '50 / 50'); assert.match(l.why, /decisión del juez|Validado por el juez/);
  assert.match(await q(page, "document.getElementById('evalTotals').textContent"), /confirmados/);
  await q(page, "[...document.querySelectorAll('#evalBody tr')].find(tr=>/Seguimiento/.test(tr.cells[0].textContent)).querySelector('button[aria-label^=\"No conceder\"]').click()"); await sleep(300);
  assert.equal((await line()).st, 'not-achieved');
  await q(page, "[...document.querySelectorAll('#evalBody tr')].find(tr=>/Seguimiento/.test(tr.cells[0].textContent)).querySelector('button[aria-label^=Quitar]').click()"); await sleep(300);
  assert.equal((await line()).st, 'pending', 'quitar la decisión devuelve el automático');
  assert.equal(await q(page, 'JSON.stringify(BITIRO_COMPETITION.session().rounds[0])'), hist, 'el historial de la ronda no cambió');
  assert.equal(await q(page, 'JSON.stringify([R.x,R.y,activeObstacles.map(o=>[o.x,o.y])])'), poseBefore, 'el juez no mueve el robot ni los obstáculos');
  await shot(page, 'eval-2-juez');
});

await test('dos rondas por separado; mejor ronda y suma informadas sin declarar ganador', async () => {
  await click(page, 'evalTab2'); await sleep(300);
  assert.match(await q(page, "document.getElementById('evalTotals').textContent"), /aún no comienza/);
  await click(page, 'evalTab1'); await sleep(300);
  const note = await q(page, "document.getElementById('evalNote').textContent");
  assert.match(note, /Mejor ronda/); assert.match(note, /Suma de rondas/); assert.match(note, /no se declara ganador/); assert.ok(!/ganador:|Ganador:/.test(note));
  assert.match(note, /pendientes de validación/);
});

await test('móvil (390 px): el panel no provoca desborde horizontal de la página', async () => {
  const pg = await open(390, 800); await choose(pg, 'firvi-2025'); await click(pg, 'competitionToggle');
  await q(pg, "(()=>{const d=document.getElementById('compEval');d.open=true;d.dispatchEvent(new Event('toggle'));})()"); await click(pg, 'compStart'); await sleep(500);
  const w = await q(pg, '[document.documentElement.scrollWidth,window.innerWidth]'); assert.ok(w[0] <= w[1] + 1, 'sin scroll horizontal: ' + w);
  await shot(pg, 'eval-3-movil'); await pg.close();
});

await test('sin errores de consola ni excepciones durante toda la sesión', async () => { assert.deepEqual(errors, []); });
await page.close(); browser.close?.(); server.close();
console.log(`\n${n} pruebas visuales FIRVI-2025-C OK`);
process.exit(0);
