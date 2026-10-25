#!/usr/bin/env node
// FIRVI-2025-UI-FINAL — ajustes de interfaz: selector A/B legible, panel del juez en tarjetas (360/390), totales sin desfase, escena visible con la evaluación
// abierta en escritorio y «Ejecutar» a mano en móvil. Solo presentación: no toca pista, física, motor ni puntuación.
//   node tests/firvi-ui-final.mjs          # requiere Chrome/Chromium; sin él, se omite con código 0.
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


const key = async (page, k, code, vk) => { for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, ...(type === 'keyDown' && k === 'Enter' ? { text: '\r' } : {}) }); await sleep(250); };
const txt = (page, id) => q(page, `document.getElementById('${id}').textContent`);
const openEval = (page) => q(page, "(()=>{const d=document.getElementById('compEval');d.open=true;d.dispatchEvent(new Event('toggle'));})()");
const cards = (page) => q(page, `[...document.querySelectorAll('#evalBody tr')].map(tr=>({label:tr.cells[0].textContent,st:tr.querySelector('.eval-st').dataset.st}))`);
const rect = (page, sel) => q(page, `(()=>{const e=document.querySelector('${sel}');if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),l:Math.round(r.left),r:Math.round(r.right)}})()`);
const SWEEP = `void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(1200);botonInicio();}
void loop(){avanzar(20);pausa(5);}`;
const finishRound1 = async (page) => { await click(page, 'compStart'); await setSrc(page, SWEEP); await click(page, 'compRun'); await click(page, 'run'); await sleep(1500); await click(page, 'compFinish'); await sleep(900); };

for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [360, 740]]) {
  const page = await open(w, h);
  await test(`${w}px · el selector distingue «FIRVI 2025 · A» y «FIRVI 2025 · B» sin truncar`, async () => {
    for (const [id, label] of [['firvi-2025', 'FIRVI 2025 · A'], ['firvi-2025-b', 'FIRVI 2025 · B']]) {
      await choose(page, id);
      assert.equal(await q(page, "document.getElementById('track').selectedOptions[0].textContent"), label);
      const fits = await q(page, "(()=>{const s=document.getElementById('track'),c=document.createElement('canvas').getContext('2d'),cs=getComputedStyle(s);c.font=cs.font;return s.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-c.measureText(s.selectedOptions[0].textContent).width})()");
      assert.ok(fits > 0, `el texto no cabe en el selector (${fits}px)`);
      assert.match(await txt(page, 'sceneSource'), new RegExp(`Recorrido ${label.slice(-1)} ·`), 'descripción completa del recorrido a la vista');
    }
  });
  await test(`${w}px · los totales y el encabezado cambian al instante en cada transición, sin cerrar y reabrir`, async () => {
    await choose(page, 'firvi-2025'); await click(page, 'competitionToggle'); await openEval(page); await sleep(300);
    assert.match(await txt(page, 'evalTotals'), /Ronda 1 en preparación/);
    await click(page, 'compStart'); await sleep(150);
    assert.match(await txt(page, 'evalTotals'), /Ronda 1: 0 pts confirmados .*\(en curso\)/, 'tras «Iniciar ronda»: ' + await txt(page, 'evalTotals'));
    assert.equal(await txt(page, 'evalHeadline'), 'Ronda 1: 0 pts · Ronda 2: — pts');
    await setSrc(page, SWEEP); await click(page, 'compRun'); await click(page, 'run'); await sleep(1200);
    await click(page, 'compFinish'); await sleep(150);
    assert.match(await txt(page, 'evalTotals'), /\(voluntaria\)/, 'tras finalizar: ' + await txt(page, 'evalTotals'));
    assert.ok(!/aún no comienza/.test(await txt(page, 'evalTotals')));
    assert.equal((await cards(page)).length, 8);
    await click(page, 'compNext'); await sleep(150);
    assert.match(await txt(page, 'evalTotals'), /Ronda 2 en preparación/, 'el panel sigue a la ronda 2: ' + await txt(page, 'evalTotals'));
    assert.equal(await q(page, "document.getElementById('evalTab2').getAttribute('aria-pressed')"), 'true');
    await click(page, 'compStart'); await sleep(150);
    assert.match(await txt(page, 'evalTotals'), /Ronda 2: 0 pts confirmados/);
    assert.equal(await txt(page, 'evalHeadline'), 'Ronda 1: 0 pts · Ronda 2: 0 pts');
    await click(page, 'compRun'); await click(page, 'run'); await sleep(1200);
    await click(page, 'compFault'); await sleep(150);
    assert.ok(!/aún no comienza/.test(await txt(page, 'evalTotals')), 'tras una falta la ronda sigue evaluándose');
    await click(page, 'compFinish'); await sleep(150);
    assert.match(await txt(page, 'evalTotals'), /Ronda 2: .*\(voluntaria\)/);
  });
  await page.close();
}

for (const [w, h] of [[390, 844], [360, 740]]) {
  const page = await open(w, h);
  await test(`${w}px · panel del juez en tarjetas: sin tabla horizontal, acciones de 44 px visibles, Quitar decisión`, async () => {
    await choose(page, 'firvi-2025'); await click(page, 'competitionToggle'); await finishRound1(page); await openEval(page); await sleep(400);
    const dw = await q(page, '[document.documentElement.scrollWidth,window.innerWidth]'); assert.ok(dw[0] <= dw[1] + 1, 'sin desborde de la página: ' + dw);
    const wrap = await rect(page, '#evalScroll'), tbl = await rect(page, '#evalTable');
    assert.ok(tbl.w <= wrap.w + 1, `la tabla no excede su contenedor (${tbl.w} > ${wrap.w})`);
    assert.equal(await q(page, "document.getElementById('evalScroll').scrollWidth<=document.getElementById('evalScroll').clientWidth+1"), true, 'sin scroll horizontal interno');
    const btns = await q(page, `[...document.querySelectorAll('#evalBody button')].map(b=>{const r=b.getBoundingClientRect();return [b.textContent,Math.round(r.height),Math.round(r.width),r.left>=0&&r.right<=innerWidth]})`);
    assert.ok(btns.length >= 16); for (const [t, bh, bw, inside] of btns) { assert.ok(bh >= 44, `${t}: alto ${bh}`); assert.ok(bw >= 100 && inside, `${t}: ancho ${bw}`); }
    const first = await q(page, "(()=>{const tr=document.querySelector('#evalBody tr');return [...tr.cells].map(c=>c.textContent.slice(0,30)).join(' | ')+' :: '+tr.getAttribute('role')+' '+tr.cells[0].getAttribute('role')})()");
    assert.match(first, /:: row cell/);
    // decidir: Conceder → Quitar decisión visible → Quitar
    const label = 'Seguimiento';
    const act = (sel) => q(page, `[...document.querySelectorAll('#evalBody tr')].find(tr=>/${label}/.test(tr.cells[0].textContent)).querySelector('${sel}').click()`);
    const line = () => cards(page).then((x) => x.find((y) => new RegExp(label).test(y.label)));
    const auto = (await line()).st; await act('button[aria-label^=Conceder]'); await sleep(200); assert.equal((await line()).st, 'validated-judge');
    const un = await q(page, `(()=>{const b=[...document.querySelectorAll('#evalBody tr')].find(tr=>/${label}/.test(tr.cells[0].textContent)).querySelector('button[aria-label^=Quitar]');const r=b.getBoundingClientRect();return [b.textContent,Math.round(r.height)]})()`);
    assert.equal(un[0], 'Quitar decisión'); assert.ok(un[1] >= 44);
    await act('button[aria-label^=Quitar]'); await sleep(200); assert.equal((await line()).st, auto, 'quitar devuelve el resultado automático');
    await shot(page, `juez-${w}`);
  });
  await test(`${w}px · «Ejecutar» junto a las órdenes tras «Comenzar recorrido» y respeta los bloqueos`, async () => {
    await click(page, 'compNext'); await click(page, 'compStart');
    const vis = () => q(page, "(()=>{const b=document.getElementById('compExecute');return !b.hidden&&getComputedStyle(b).display!=='none'})()");
    assert.equal(await vis(), false, 'oculto antes de comenzar el recorrido');
    await setSrc(page, SWEEP); await click(page, 'compRun');
    assert.equal(await vis(), true);
    assert.equal(await q(page, "document.getElementById('src').readOnly"), true, 'el código sigue bloqueado');
    const r = await rect(page, '#compExecute'); assert.ok(r.h >= 44, 'alto táctil ' + r.h);
    const top = await q(page, "document.getElementById('compExecute').getBoundingClientRect().top"); assert.ok(top < 700, 'a la vista sin desplazarse: ' + top);
    assert.equal(await txt(page, 'statusBadge'), 'EN ESPERA');
    await click(page, 'compExecute'); await sleep(700);
    assert.notEqual(await txt(page, 'statusBadge'), 'EN ESPERA', 'el programa corre por la misma vía que «Ejecutar»');
    assert.match(await txt(page, 'msg'), /Sintaxis validada/);
    await click(page, 'compExecute'); await sleep(300);
    assert.match(await txt(page, 'msg'), /ya se inició/, 'el motor sigue negando el segundo inicio del mismo intento: no hay atajo');
    await click(page, 'compFinish'); assert.equal(await vis(), false, 'oculto al terminar la ronda');
  });
  await page.close();
}

const desk = await open(1440, 900);
await test('1440 px · con la evaluación abierta la escena 3D sigue a la vista y la tabla se desplaza dentro de su panel', async () => {
  await choose(desk, 'firvi-2025'); await click(desk, 'competitionToggle'); await finishRound1(desk);
  const closed = await rect(desk, '#sceneWrap'); await openEval(desk); await sleep(400);
  const sc = await rect(desk, '#sceneWrap'); assert.ok(sc.h >= 300, 'escena: ' + sc.h); assert.ok(sc.w > 700);
  assert.ok(closed.h - sc.h < 200, `cierra ${closed.h} abre ${sc.h}`);
  const top = await q(desk, "document.getElementById('sceneWrap').getBoundingClientRect().top"); assert.ok(top < 800, 'escena visible: ' + top);
  assert.equal(await q(desk, "(()=>{const e=document.getElementById('evalScroll');return e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==='auto'})()"), true);
  await shot(desk, 'escritorio-evaluacion');
});
await test('teclado: la tabla es alcanzable con Tab y Conceder se activa con Enter; el foco es visible', async () => {
  await q(desk, "document.getElementById('evalTab2').focus()"); await q(desk, "document.getElementById('evalTab1').focus()");
  let hit = null; for (let i = 0; i < 6 && !hit; i++) { await key(desk, 'Tab', 'Tab', 9); hit = await q(desk, "(()=>{const a=document.activeElement;return a&&a.closest&&a.closest('#evalBody')&&a.tagName==='BUTTON'?a.getAttribute('aria-label'):null})()"); }
  assert.ok(hit && /^Conceder/.test(hit), 'foco en el primer botón del juez: ' + hit);
  assert.notEqual(await q(desk, "getComputedStyle(document.activeElement).outlineStyle"), 'none');
  const target = hit.replace(/^Conceder /, '');
  await key(desk, 'Enter', 'Enter', 13);
  const st = await q(desk, `(()=>{const tr=[...document.querySelectorAll('#evalBody tr')].find(tr=>tr.cells[0].textContent.startsWith(${JSON.stringify(target.slice(0, 12))}));return tr.querySelector('.eval-st').dataset.st})()`);
  assert.equal(st, 'validated-judge', 'Enter concedió ' + target);
  assert.match(await q(desk, "(document.activeElement.getAttribute('aria-label')||'')"), /^(Conceder|No conceder|Quitar|Intento)/, 'el foco no se pierde al redibujar');
});
await test('regresión: pista S01 sin barra de competencia, sin «Ejecutar» de competencia y selector intacto', async () => {
  await choose(desk, 's01');
  assert.equal(await q(desk, "document.getElementById('competitionToggle').hidden"), true);
  assert.equal(await q(desk, "document.getElementById('compEval').hidden"), true);
  assert.equal(await q(desk, "document.getElementById('compExecute').hidden"), true);
  assert.equal(await q(desk, "document.getElementById('track').selectedOptions[0].textContent"), 'S01 · Seguir línea');
});
await test('sin errores de consola ni excepciones durante toda la sesión', async () => { assert.deepEqual(errors, []); });
browser.close?.(); server.close();
console.log(`\n${n} pruebas FIRVI-UI-FINAL OK`);
process.exit(0);
