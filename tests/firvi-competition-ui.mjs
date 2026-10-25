#!/usr/bin/env node
// FIRVI-2025-B — la competencia en navegador real: selector, vistas del simulador (superior, perspectiva, seguir, detalle), ejecución del código
// del usuario sobre la pista, prismas dibujados, sin errores de consola y sin tocar las pistas existentes.
//   node tests/firvi-competition-ui.mjs          # requiere Chrome/Chromium (CHROME_BIN o ~/.cache/ms-playwright); sin él, se omite con código 0.
//   SHOTS_DIR=/ruta node tests/firvi-competition-ui.mjs # además guarda capturas PNG.
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
const browser = await launch({ port: 9396 });
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
const choose = async (page, id) => { await page.evaluate(`(()=>{const s=document.getElementById('track');s.value='${id}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await sleep(500); };
const view = async (page, v) => { await page.evaluate(`document.querySelector('.cam[data-view="${v}"]').click()`); await sleep(500); };
// Fracción de píxeles oscuros (línea negra) / de tono madera (prisma) del canvas: comprueba que se dibuja sin leer el PNG.
const stats = (page) => page.evaluate(`(()=>{const c=document.getElementById('scene'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let dark=0,wood=0,total=0;
  for(let i=0;i<d.length;i+=16){total++;const r=d[i],g=d[i+1],b=d[i+2];if(r<50&&g<55&&b<60)dark++;if(r>170&&g>120&&g<190&&b<140&&r-b>50)wood++;}return {dark:dark/total,wood:wood/total}})()`);

const q = (page, e) => page.evaluate(e);
const click = async (page, id) => { await page.evaluate(`document.getElementById('${id}').click()`); await sleep(250); };
const vis = (page, id) => page.evaluate(`(()=>{const n=document.getElementById('${id}');return !!n&&!n.hidden&&n.offsetParent!==null})()`);
const dis = (page, id) => page.evaluate(`document.getElementById('${id}').disabled`);
const text = (page, id) => page.evaluate(`document.getElementById('${id}').textContent`);
const SWEEP = `void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(1200);}
int ult=0;int lost=0;int done=0;
void loop(){
 if(done==0 && leerDistanciaSonar()<=14){detenerse();pausa(300);moverServoGolpe(1);pausa(1500);moverServoGolpe(0);pausa(1200);done=1;}
 bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;
const setSrc = (page, code) => page.evaluate(`(()=>{const s=document.getElementById('src');s.value=${JSON.stringify(code)};s.dispatchEvent(new Event('input',{bubbles:true}));})()`);

const page = await open();

await test('práctica intacta: sin activar competencia no hay barra y todos los controles de depuración funcionan', async () => {
  await choose(page, 's01');
  assert.equal(await vis(page, 'competitionToggle'), false, 'S01 no ofrece competencia'); assert.equal(await vis(page, 'competitionBar'), false);
  await choose(page, 'firvi-2025');
  assert.equal(await vis(page, 'competitionToggle'), true, 'FIRVI ofrece el modo'); assert.equal(await vis(page, 'competitionBar'), false, 'la barra no aparece sola');
  assert.equal(await dis(page, 'speed'), false); assert.equal(await dis(page, 'reset'), false); assert.equal(await dis(page, 'calibrate'), false);
  assert.equal(await q(page, "document.getElementById('src').readOnly"), false);
});

await test('preparación: barra compacta con estado, reloj 08:00 y decisión de obstáculos', async () => {
  await click(page, 'competitionToggle');
  assert.equal(await vis(page, 'competitionBar'), true);
  assert.equal(await text(page, 'compState'), 'Preparación'); assert.equal(await text(page, 'compClock'), '08:00'); assert.match(await text(page, 'compRound'), /Ronda 1 de 2 · Recorrido A/);
  assert.deepEqual(await Promise.all(['compStart', 'compCalibrate', 'compRun', 'compFault', 'compReposition', 'compFinish', 'compNext'].map((id) => vis(page, id))), [true, false, false, false, false, false, false]);
  assert.equal(await vis(page, 'compObstaclesField'), true);
  const h = await q(page, "document.getElementById('competitionBar').getBoundingClientRect().height"); assert.ok(h < 110, 'barra compacta: ' + h);
  await shot(page, 'comp-0-preparacion');
});

await test('calibración: el reloj corre desde «Iniciar ronda»; depuración restringida; el código y la calibración siguen disponibles', async () => {
  await setSrc(page, SWEEP);
  await page.evaluate("(()=>{const s=document.getElementById('speed');s.value='4';})()");   // intento de acelerar antes de iniciar (en preparación es práctica)
  await click(page, 'compStart'); await sleep(1300);
  assert.equal(await text(page, 'compState'), 'Calibración'); const clock = await text(page, 'compClock'); assert.ok(clock < '08:00' && clock >= '07:55', 'el reloj ya corre: ' + clock);
  assert.equal(await dis(page, 'speed'), true); assert.equal(await q(page, "document.getElementById('speed').value"), '1', 'velocidad forzada a 1×');
  await click(page, 'run'); await sleep(1500); assert.equal(await dis(page, 'pause'), true, 'sin pausa en competencia'); assert.equal(await dis(page, 'step'), true);
  assert.equal(await q(page, "document.getElementById('src').readOnly"), false, 'en calibración se puede editar'); assert.equal(await dis(page, 'calibrate'), false);
  assert.equal(await dis(page, 'track'), true, 'no se cambia de pista a mitad de ronda');
  assert.deepEqual(await Promise.all(['compStart', 'compCalibrate', 'compRun', 'compFault', 'compFinish'].map((id) => vis(page, id))), [false, true, true, false, true]);
  await shot(page, 'comp-1-calibracion');
});

await test('comenzar recorrido: robot a la base, código/calibración/reinicio bloqueados, reloj sin reiniciarse, decisión registrada', async () => {
  const before = await text(page, 'compClock');
  await click(page, 'compRun');
  assert.equal(await text(page, 'compState'), 'Recorrido puntuable');
  const after = await text(page, 'compClock'); assert.ok(after <= before, `el reloj no se reinicia (${before} → ${after})`);
  const st = await q(page, `(()=>({x:R.x,y:R.y,ro:document.getElementById('src').readOnly,ex:document.getElementById('example').disabled,cal:document.getElementById('calibrate').disabled,reset:document.getElementById('reset').disabled,mode,
    ev:BITIRO_COMPETITION.session().round.events.map(e=>e.type)}))()`);
  assert.ok(Math.abs(st.x - 21) < 1e-6 && Math.abs(st.y - 120) < 1e-6, 'robot en la base inicial'); assert.equal(st.mode, 'idle', 'el programa de la calibración se apagó');
  assert.deepEqual([st.ro, st.ex, st.cal, st.reset], [true, true, true, true]); assert.ok(st.ev.includes('run-begin'));
  await shot(page, 'comp-2-recorrido-inicio');
  // El código no se puede cambiar por programa ni por teclado
  await q(page, "(()=>{const s=document.getElementById('src');s.readOnly=false;s.value='// otro';})()"); await click(page, 'run');
  assert.match(await text(page, 'msg'), /modificar ni subir código/); assert.equal(await q(page, 'mode'), 'idle');
  await setSrc(page, SWEEP);
});

await test('recorrido: el robot sigue la línea, aparta el prisma con el abanico y el registro físico distingue sweep/push/contact', async () => {
  await click(page, 'run');
  const t0 = Date.now(); let s;
  do { await sleep(500); s = await q(page, 'BITIRO_PHYSICS_LOG().map(e=>e.kind)'); } while (!s.includes('sweep') && Date.now() - t0 < 60000);
  assert.ok(s.includes('sweep') && !s.includes('push') && !s.includes('contact'), JSON.stringify(s));
  await sleep(4000); await shot(page, 'comp-3-recorrido-barrido');
});

await test('falta de progreso: la declara el capitán, queda registrada y el robot no se mueve hasta «Reponer robot»', async () => {
  await click(page, 'compFault');
  assert.equal(await text(page, 'compState'), 'Falta de progreso');
  const pos0 = await q(page, '[R.x,R.y]');   // tras declarar: leer la pose ANTES del clic era una carrera (el robot avanza en tiempo real hasta que el programa se apaga)
  const info = await q(page, `(()=>{const f=BITIRO_COMPETITION.session().round.faults[0];return {room:f.room,attempt:f.attempt,elig:f.scoringEligible,rule:f.allowed.rule,prev:f.previousPose,mode,note:document.getElementById('compNote').textContent}})()`);
  assert.equal(info.room, 1); assert.equal(info.attempt, 1); assert.equal(info.elig, true); assert.equal(info.rule, 'start-base'); assert.equal(info.mode, 'idle'); assert.match(info.note, /la base inicial/);
  await sleep(600); assert.equal(JSON.stringify(await q(page, '[R.x,R.y]')), JSON.stringify(pos0), 'detenido tras declarar');
  assert.deepEqual(await Promise.all(['compFault', 'compReposition', 'compFinish'].map((id) => vis(page, id))), [false, true, true]);
  await click(page, 'run'); assert.match(await text(page, 'msg'), /reposición/, 'primero la reposición');
  await shot(page, 'comp-4-falta-de-progreso');
  await click(page, 'compReposition');
  assert.equal(await text(page, 'compState'), 'Reposición autorizada');
  const pos = await q(page, '[R.x,R.y]'); assert.ok(Math.abs(pos[0] - 21) < 1e-6 && Math.abs(pos[1] - 120) < 1e-6, 'en la base inicial');
  await shot(page, 'comp-5-reposicion');
  await click(page, 'run'); await sleep(300); assert.equal(await text(page, 'compState'), 'Recorrido puntuable'); assert.match(await text(page, 'compInfo'), /intento 2/);
});

await test('finalizar ronda: se registra el tiempo y el resultado de hechos; el registro de la ronda no lleva puntaje', async () => {
  await sleep(2500); await click(page, 'compFinish');
  assert.equal(await text(page, 'compState'), 'Ronda finalizada');
  const r = await q(page, `(()=>{const r=BITIRO_COMPETITION.sessions().get('firvi-2025').rounds[0];return {by:r.finishedBy,faults:r.faults.length,elapsed:r.endClock-r.startClock,events:r.events.map(e=>e.type),sweep:r.physics.some(e=>e.kind==='sweep'),json:JSON.stringify(r)}})()`);
  assert.equal(r.by, 'captain'); assert.equal(r.faults, 1); assert.ok(r.elapsed > 8000 && r.elapsed < 120000); assert.ok(r.sweep); assert.ok(r.events.at(-1) === 'round-finish');
  assert.ok(!/"(points|score|puntaje|puntos)"/.test(r.json)); assert.ok(!/\d+\s*(pts|puntos)|puntaje/i.test(await text(page, 'compInfo') + await text(page, 'compNote')), 'el estado de la barra no muestra puntaje (la puntuación vive solo en el panel «Evaluación», Etapa C)');
  assert.equal(await dis(page, 'speed'), false); assert.equal(await dis(page, 'calibrate'), false); assert.equal(await q(page, "document.getElementById('src').readOnly"), false, 'tras la ronda se puede modificar el programa (V.A.3)');
  assert.equal(await vis(page, 'compNext'), true); await shot(page, 'comp-6-finalizada');
});

await test('ronda 2: reinicio de estado (reloj, intentos, checkpoint, obstáculos) y la ronda 1 conserva su registro', async () => {
  await click(page, 'compNext');
  assert.equal(await text(page, 'compState'), 'Preparación'); assert.match(await text(page, 'compRound'), /Ronda 2 de 2/); assert.equal(await text(page, 'compClock'), '08:00');
  await q(page, "(()=>{const s=document.getElementById('compObstacles');s.value='remove';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
  assert.equal(await q(page, 'activeObstacles.length'), 0, 'obstáculos retirados antes de la ronda');
  await click(page, 'compStart'); assert.equal(await q(page, "BITIRO_COMPETITION.session().round.obstacles"), 'remove');
  await q(page, "document.getElementById('compObstacles').value='keep'"); const dec = await q(page, 'BITIRO_COMPETITION.session().setObstacleDecision("keep").ok'); assert.equal(dec, false, 'la decisión ya no cambia');
  assert.equal(await q(page, "BITIRO_COMPETITION.session().rounds.length"), 1);
  await click(page, 'compFinish');
  assert.equal(await vis(page, 'compNext'), false, 'tras la 2.ª ronda no hay más'); assert.match(await text(page, 'compNote'), /dos rondas terminaron/);
  await shot(page, 'comp-7-ronda2-finalizada');
});

await test('recorrido B: sesión propia (reloj, ronda y estado) tras cambiar de pista entre rondas', async () => {
  await choose(page, 'firvi-2025-b');
  assert.match(await text(page, 'compRound'), /Ronda 1 de 2 · Recorrido B/); assert.equal(await text(page, 'compState'), 'Preparación'); assert.equal(await text(page, 'compClock'), '08:00');
  await choose(page, 'firvi-2025'); assert.match(await text(page, 'compRound'), /Ronda 2 de 2 · Recorrido A/); assert.equal(await text(page, 'compState'), 'Ronda finalizada');
  await click(page, 'competitionToggle'); assert.equal(await vis(page, 'competitionBar'), false, 'salir de competencia: vuelve la práctica');
  assert.equal(await dis(page, 'speed'), false);
});

await test('tiempo agotado: con reloj controlado, a los 8:00 la ronda termina sola (aunque la simulación esté pausada o acelerada)', async () => {
  const pg = await open(1440, 900); await choose(pg, 'firvi-2025');
  await pg.evaluate("window.__t=1000;BITIRO_COMPETITION.setClock({now:()=>window.__t})");
  await click(pg, 'competitionToggle'); await click(pg, 'compStart'); await pg.evaluate('window.__t+=3*60000'); await sleep(400);
  assert.equal(await text(pg, 'compClock'), '05:00'); await click(pg, 'compRun'); await pg.evaluate('window.__t+=4*60000+59000'); await sleep(400);
  assert.equal(await text(pg, 'compState'), 'Recorrido puntuable'); assert.equal(await text(pg, 'compClock'), '00:01');
  await pg.evaluate('window.__t+=1000'); await sleep(500);
  assert.equal(await text(pg, 'compState'), 'Ronda finalizada'); assert.equal(await text(pg, 'compClock'), '00:00');
  assert.equal(await q(pg, "BITIRO_COMPETITION.session().rounds[0].finishedBy"), 'time'); assert.match(await text(pg, 'compInfo'), /Terminó por tiempo/);
  await shot(pg, 'comp-8-tiempo-agotado'); await pg.close();
});

await test('sin errores de consola ni excepciones durante toda la sesión', async () => { assert.deepEqual(errors, []); });
await page.close(); browser.close?.(); server.close();
console.log(`\n${n} pruebas visuales FIRVI-2025-B OK`);
process.exit(0);
