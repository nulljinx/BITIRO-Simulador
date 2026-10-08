#!/usr/bin/env node
// SIM-CALIBRATION-1 (interfaz) — pruebas en un Chrome real controlado por CDP (reutiliza tests/perf/cdp.mjs; sin dependencias npm).
//   node tests/calibration-ui.mjs        # requiere Chrome/Chromium (CHROME_BIN o ~/.cache/ms-playwright); sin él, se omite con código 0.
// Sirve la raíz del repo en 127.0.0.1 con la misma CSP que producción. No contacta a producción.
// If the NNJ did not program a reading to appear on the LCD, calibration does not show it.
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
const URL_ = `http://127.0.0.1:${server.address().port}/` + (process.env.BITIRO_TEST_QUERY || '');   // opcional: p. ej. '?robot=iroh' (tests/iroh-visual-ui.mjs); vacío = comportamiento original
const browser = await launch({ port: 9372 });

const PRINT = 'void setup(){inicializarMovimiento();inicializarSensores();inicializarPantalla();}\\nvoid loop(){escribirPantalla(0,0,leerSensorLineaCentral());avanzar(20);}';
const PRINT_STILL = 'void setup(){inicializarMovimiento();inicializarSensores();inicializarPantalla();}\\nvoid loop(){escribirPantalla(0,0,leerSensorLineaCentral());detenerse();}';
const SILENT = 'void setup(){inicializarMovimiento();inicializarSensores();inicializarPantalla();}\\nvoid loop(){avanzar(20);}';
const SILENT_STILL = 'void setup(){inicializarMovimiento();inicializarSensores();inicializarPantalla();}\\nvoid loop(){detenerse();}';
let n = 0; const consoleErrors = [];
const test = async (name, fn) => { await fn(); n++; console.log('OK · ' + name); };

async function open(width, height, { touch = false } = {}) {
  const page = await newPage(browser);
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Log.enable');
  page.on('Runtime.exceptionThrown', (p) => consoleErrors.push('exc: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0]));
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') consoleErrors.push('console.error: ' + p.args.map((a) => a.value ?? a.description).join(' ')); });
  page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') consoleErrors.push('log: ' + p.entry.text + ' ' + (p.entry.url || '')); });
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
  if (touch) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.send('Storage.clearDataForOrigin', { origin: new URL(URL_).origin, storageTypes: 'local_storage' });
  const loaded = new Promise((r) => page.on('Page.loadEventFired', r)); await page.send('Page.navigate', { url: URL_ }); await loaded; await sleep(700);
  const ui = {
    page,
    ev: (e) => page.evaluate(e),
    async program(code, track = 's02') {
      await page.evaluate(`(()=>{const t=document.getElementById('track');t.value='${track}';t.dispatchEvent(new Event('change'));const s=document.getElementById('src');s.value='${code}';s.dispatchEvent(new Event('input'));document.getElementById('run').click();})()`);
      await sleep(500);
    },
    pose: () => page.evaluate('({x:R.x,y:R.y,th:R.th,simTime,mode,running,paused})'),
    rect: (sel) => page.evaluate(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}})()`),
    async mouse(type, x, y, buttons = 0) { await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 }); },
    async drag(from, to, steps = 12, midCheck) {
      await ui.mouse('mouseMoved', from.x, from.y); await ui.mouse('mousePressed', from.x, from.y, 1);
      for (let i = 1; i <= steps; i++) { await ui.mouse('mouseMoved', from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps, 1); await sleep(16); if (i === Math.floor(steps / 2) && midCheck) await midCheck(); }
      await ui.mouse('mouseReleased', to.x, to.y, 0); await sleep(60);
    },
    // posición en pantalla (coordenadas del cliente) del centro del robot, con la MISMA cámara del renderer
    screenOfRobot: () => page.evaluate(`(()=>{const c=document.getElementById('scene'),r=c.getBoundingClientRect(),p=BITIRO_SCENE_VIEW.projectGround(c,sceneTrack,camera,{x:R.x,y:R.y},R.x,R.y);return {x:r.left+p.x,y:r.top+p.y}})()`),
    toggle: () => page.evaluate("document.getElementById('calibrationMode').click()"),
    visibleText: () => page.evaluate(`(()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let t;
      while((t=w.nextNode())){const el=t.parentElement;if(!el||el.closest('script,style,noscript,#lcd,canvas'))continue;const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')continue;
       let hidden=false;for(let e=el;e;e=e.parentElement){const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden'||e.hidden){hidden=true;break;}}
       if(hidden)continue;const r=el.getBoundingClientRect();if(r.width===0||r.height===0)continue;const s=t.textContent.trim();if(s)out.push(s);}return out})()`),
    close: () => page.close(),
  };
  return ui;
}
const finite = (...v) => v.every(Number.isFinite);

// ─────────────────────────────── 1366 × 768 ───────────────────────────────
{
  const ui = await open(1366, 768);
  await ui.program(PRINT);
  await ui.ev('window.__marker=Math.random()'); const marker = await ui.ev('window.__marker');
  const codeBefore = await ui.ev("document.getElementById('src').value");
  const before = { canvas: await ui.rect('#scene'), pose: await ui.pose(), editor: await ui.rect('#codePanel') };
  const plotterArea = () => ui.ev(`(()=>{const c=document.getElementById('scene');const ps=[[0,0],[sceneTrack.physicalWidthCm,0],[0,sceneTrack.physicalHeightCm],[sceneTrack.physicalWidthCm,sceneTrack.physicalHeightCm]].map(([x,y])=>BITIRO_SCENE_VIEW.projectGround(c,sceneTrack,camera,{x:R.x,y:R.y},x,y));
    const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);return (Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys))})()`);
  const areaBefore = await plotterArea();
  await test('A · Entrar: no recarga, el código permanece, el editor se oculta, el plotter crece y la LCD queda visible', async () => {
    await ui.toggle(); await sleep(500);
    assert.equal(await ui.ev('window.__marker'), marker, 'sin recarga (marca en window intacta)');
    assert.equal(await ui.ev("performance.getEntriesByType('navigation').length"), 1);
    assert.equal(await ui.ev('BITIRO_CALIBRATION.active'), true);
    assert.equal(await ui.ev("document.getElementById('src').value"), codeBefore, 'código intacto');
    assert.equal(await ui.ev("getComputedStyle(document.getElementById('codePanel')).display"), 'none', 'editor oculto');
    assert.ok(before.editor.w > 300, 'el editor era visible antes');
    const after = await ui.rect('#scene'); assert.ok(after.w * after.h > before.canvas.w * before.canvas.h, 'el canvas crece');
    const areaAfter = await plotterArea(); assert.ok(areaAfter > areaBefore * 1.5, `plotter proyectado ${Math.round(areaBefore)} → ${Math.round(areaAfter)} px²`);
    const lcd = await ui.rect('#lcd'); assert.ok(lcd.w > 100 && lcd.h > 20 && lcd.y >= 0 && lcd.y + lcd.h <= 768 && lcd.x + lcd.w <= 1366, 'LCD visible dentro de la ventana');
    assert.equal(await ui.ev("document.getElementById('calibrationMode').getAttribute('aria-pressed')"), 'true');
  });
  await test('B · El programa que YA corría sigue corriendo al entrar: simTime avanza, mode=code, sin reinicio de pose', async () => {
    const p0 = await ui.pose(); await sleep(700); const p1 = await ui.pose();
    assert.equal(p1.mode, 'code'); assert.equal(p1.running, 1); assert.ok(p1.simTime - p0.simTime > 0.4, `simTime ${p0.simTime} → ${p1.simTime}`);
    assert.ok(p1.y < before.pose.y, 'el robot siguió avanzando (no volvió al inicio)');
  });
  await test('C/D · Sin datos automáticos: ningún valor de sensor visible fuera de la LCD; la LCD muestra lo que el programa escribe', async () => {
    const readings = await ui.ev('[0,1,2].map(k=>String(readLine(k)))');
    const texts = (await ui.visibleText()).join(' | ');
    for (const v of readings) assert.ok(!new RegExp(`(^|[^\\d])${v}([^\\d]|$)`).test(texts), `valor de sensor ${v} no debe aparecer fuera de la LCD: ${texts}`);
    for (const sel of ['#valL', '#valC', '#valR', '#sonar', '#motors', '#strikerStatus', '#moreData', '.inputs-strip', '.simulator-toolbar', '#decision', '#runEvidence']) {
      const shown = await ui.ev(`(()=>{const e=document.querySelector('${sel}');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'})()`);
      assert.equal(shown, false, sel + ' oculto en calibración');
    }
    const lcd = await ui.ev("document.getElementById('lcd').textContent.split('\\n')[0].trim()");
    assert.match(lcd, /^\d{3}$/, 'la LCD muestra la lectura que el PROGRAMA decidió imprimir: ' + lcd);
  });
  await test('E · Arrastrar el robot con el puntero: cambia R.x/R.y (finitos), el runtime sigue, la pose sigue al puntero y no se reinicia', async () => {
    await ui.program(PRINT_STILL); await ui.toggle(); await sleep(300);   // sale
    assert.equal(await ui.ev('BITIRO_CALIBRATION.active'), false); await ui.toggle(); await sleep(500);
    const p0 = await ui.pose(), g = await ui.rect('#calibrationGrab'), s0 = await ui.screenOfRobot();
    assert.ok(Math.hypot(g.cx - s0.x, g.cy - s0.y) < 3, 'la zona de agarre está sobre el robot');
    let mid = null;
    await ui.drag({ x: g.cx, y: g.cy }, { x: g.cx + 90, y: g.cy - 110 }, 12, async () => { mid = { drag: await ui.ev('BITIRO_MANUAL.dragging'), t: (await ui.pose()).simTime }; });
    const p1 = await ui.pose(); assert.equal(mid.drag, true, 'dragging=true durante el arrastre');
    assert.equal(await ui.ev('BITIRO_MANUAL.dragging'), false, 'dragging=false al soltar');
    assert.ok(finite(p1.x, p1.y, p1.th)); assert.ok(p1.x > p0.x + 5, 'se movió a la derecha'); assert.ok(p1.y < p0.y - 5, 'se movió hacia arriba');
    assert.ok(p1.simTime > p0.simTime, 'simTime no se detuvo'); assert.equal(p1.mode, 'code'); assert.equal(p1.running, 1);
    const s1 = await ui.screenOfRobot(); assert.ok(Math.hypot(s1.x - (g.cx + 90), s1.y - (g.cy - 110)) < 4, `el robot queda bajo el puntero (${s1.x.toFixed(1)},${s1.y.toFixed(1)})`);
    // la LCD sigue siendo del programa: tras mover, la lectura impresa corresponde a la nueva pose
    await sleep(300);
    const lcd = await ui.ev("document.getElementById('lcd').textContent.split('\\n')[0].trim()"), rd = await ui.ev('String(readLine(1))');
    assert.equal(lcd, rd, 'la LCD muestra la lectura del programa en la nueva pose');
  });
  await test('E · Límites: arrastrar fuera del plotter deja el centro dentro del área útil; no se coloca sobre una caja', async () => {
    const b = await ui.ev('BITIRO_MANUAL.bounds()'), c = await ui.rect('#scene'), g = await ui.rect('#calibrationGrab');
    for (const [dx, dy] of [[-2000, -2000], [2000, -2000], [2000, 2000], [-2000, 2000]]) {
      await ui.drag({ x: (await ui.rect('#calibrationGrab')).cx, y: (await ui.rect('#calibrationGrab')).cy }, { x: Math.min(c.x + c.w - 5, Math.max(c.x + 5, g.cx + dx)), y: Math.min(c.y + c.h - 5, Math.max(c.y + 5, g.cy + dy)) }, 8);
      const p = await ui.pose(); assert.ok(finite(p.x, p.y) && p.x >= b.minX - 1e-9 && p.x <= b.maxX + 1e-9 && p.y >= b.minY - 1e-9 && p.y <= b.maxY + 1e-9, `dentro del área: ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    await ui.toggle(); await ui.program(SILENT_STILL, 's01'); await ui.toggle(); await sleep(400);   // S01 tiene caja de práctica
    const box = await ui.ev('({x:activeObstacles[0].x+4,y:activeObstacles[0].y+4})'), tgt = await ui.ev(`(()=>{const c=document.getElementById('scene'),r=c.getBoundingClientRect(),p=BITIRO_SCENE_VIEW.projectGround(c,sceneTrack,camera,{x:R.x,y:R.y},${0},${0});return null})()`);
    const sc = await ui.ev(`(()=>{const c=document.getElementById('scene'),r=c.getBoundingClientRect(),p=BITIRO_SCENE_VIEW.projectGround(c,sceneTrack,camera,{x:R.x,y:R.y},${box.x},${box.y});return {x:r.left+p.x,y:r.top+p.y}})()`);
    const gg = await ui.rect('#calibrationGrab'); await ui.drag({ x: gg.cx, y: gg.cy }, sc, 14);
    assert.equal(await ui.ev('IROH_MECHANICS.bodyOverlapsBox({x:R.x,y:R.y,th:R.th},activeObstacles[0])'), false, 'el cuerpo no solapa la caja'); void tgt;
  });
  await test('F · Rotar con el asa: R.th cambia y apunta hacia el puntero; R.x/R.y y el runtime no cambian', async () => {
    await ui.toggle(); await ui.program(PRINT_STILL, 's02'); await ui.toggle(); await sleep(400);
    const p0 = await ui.pose(), h = await ui.rect('#calibrationRotate'), s = await ui.screenOfRobot();
    const target = { x: s.x + 120, y: s.y + 10 };     // a la derecha del robot en pantalla (vista superior): +x del plotter
    await ui.drag({ x: h.cx, y: h.cy }, target, 14);
    const p1 = await ui.pose();
    const expected = await ui.ev(`(()=>{const c=document.getElementById('scene'),r=c.getBoundingClientRect(),g=BITIRO_SCENE_VIEW.pickGround(c,sceneTrack,camera,{x:R.x,y:R.y},${target.x}-r.left,${target.y}-r.top);return Math.atan2(g.x-R.x,-(g.y-R.y))})()`);
    assert.ok(finite(p1.th)); assert.ok(Math.abs(Math.atan2(Math.sin(p1.th - expected), Math.cos(p1.th - expected))) < 0.06, `th=${p1.th.toFixed(3)} esperado ${expected.toFixed(3)}`);
    assert.ok(Math.abs(p1.th - p0.th) > 0.3, 'giró de verdad');
    assert.equal(p1.x, p0.x); assert.equal(p1.y, p0.y); assert.equal(p1.mode, 'code'); assert.ok(p1.simTime > p0.simTime);
  });
  await test('Teclado (accesible): flechas mueven 1 cm (Mayús 5 cm) y el asa gira 5° (Mayús 1°); Esc sale de la calibración', async () => {
    await ui.ev("document.getElementById('calibrationGrab').focus()"); const a = await ui.pose();
    await page_key(ui, 'ArrowRight'); const b = await ui.pose(); assert.ok(Math.abs(b.x - a.x - 1) < 1e-6 && b.y === a.y, 'ArrowRight = +1 cm');
    await page_key(ui, 'ArrowRight', 8); const c = await ui.pose(); assert.ok(Math.abs(c.x - b.x - 5) < 1e-6, 'Mayús+ArrowRight = +5 cm');
    await ui.ev("document.getElementById('calibrationRotate').focus()"); const t0 = (await ui.pose()).th;
    await page_key(ui, 'ArrowRight'); const t1 = (await ui.pose()).th; assert.ok(Math.abs(t1 - t0 - 5 * Math.PI / 180) < 1e-6, 'asa: +5°');
    await page_key(ui, 'ArrowLeft', 8); const t2 = (await ui.pose()).th; assert.ok(Math.abs(t2 - t1 + Math.PI / 180) < 1e-6, 'asa: Mayús −1°');
    await page_key(ui, 'Escape'); await sleep(150); assert.equal(await ui.ev('BITIRO_CALIBRATION.active'), false, 'Esc sale');
  });
  await test('Salir: restaura editor y layout, preserva código y marca de página (sin recarga) y el programa sigue ejecutándose', async () => {
    assert.equal(await ui.ev("getComputedStyle(document.getElementById('codePanel')).display"), 'flex', 'editor restaurado');
    assert.equal(await ui.ev('window.__marker'), marker); assert.equal(await ui.ev("performance.getEntriesByType('navigation').length"), 1);
    assert.equal(await ui.ev("document.getElementById('src').value.includes('detenerse')"), true, 'código del programa activo preservado');
    const p = await ui.pose(); assert.equal(p.mode, 'code'); assert.equal(await ui.ev("document.getElementById('calibrationMode').getAttribute('aria-pressed')"), 'false');
    assert.equal(await ui.ev("document.getElementById('calibrationLayer').hidden"), true);
    const t0 = p.simTime; await sleep(400); assert.ok((await ui.pose()).simTime > t0, 'simTime sigue avanzando tras salir');
    assert.equal(await ui.ev("document.getElementById('valC').getBoundingClientRect().width>0"), true, 'la telemetría normal vuelve');
  });
  await test('Programa DETENIDO: entrar/salir no lo arranca ni reinicia la simulación; moverlo sigue siendo posible', async () => {
    await ui.ev("document.getElementById('reset').click()"); await sleep(200);
    const p0 = await ui.pose(); assert.equal(p0.mode, 'idle'); await ui.toggle(); await sleep(400);
    const g = await ui.rect('#calibrationGrab'); await ui.drag({ x: g.cx, y: g.cy }, { x: g.cx + 40, y: g.cy - 30 }, 6);
    const p1 = await ui.pose(); assert.equal(p1.mode, 'idle'); assert.equal(p1.simTime, 0); assert.ok(p1.x !== p0.x);
    await ui.toggle(); await sleep(200); assert.equal((await ui.pose()).mode, 'idle');
  });
  await test('Táctil: arrastrar el robot con un dedo (Pointer Events pointerType=touch)', async () => {
    await ui.close();
    const t = await open(1024, 768, { touch: true }); await t.program(PRINT_STILL); await t.toggle(); await sleep(500);
    const g = await t.rect('#calibrationGrab'), p0 = await t.pose();
    const touch = (type, x, y) => t.page.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', g.cx, g.cy); for (let i = 1; i <= 8; i++) { await touch('touchMove', g.cx + 8 * i, g.cy - 6 * i); await sleep(16); } await touch('touchEnd', 0, 0); await sleep(80);
    const p1 = await t.pose(); assert.ok(p1.x > p0.x + 3 && p1.y < p0.y - 3, `táctil movió el robot (${p0.x.toFixed(1)},${p0.y.toFixed(1)}) → (${p1.x.toFixed(1)},${p1.y.toFixed(1)})`);
    assert.equal(await t.ev('BITIRO_MANUAL.dragging'), false); await t.close();
  });
}

async function page_key(ui, key, modifiers = 0) {
  const codes = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Escape: 27 };
  await ui.page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: codes[key], modifiers });
  await ui.page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: codes[key], modifiers });
  await sleep(40);
}

// ─────────────────────────────── 1024 y 390 ───────────────────────────────
for (const [w, h, touch] of [[1024, 768, false], [390, 844, true]]) {
  const ui = await open(w, h, { touch });
  await test(`Viewport ${w}×${h}: calibración usable (sin desbordamiento horizontal, LCD visible, controles y zona de agarre manipulables, programa corriendo)`, async () => {
    await ui.program(PRINT); await ui.toggle(); await sleep(600);
    const m = await ui.ev(`({sw:document.documentElement.scrollWidth,iw:innerWidth,sh:document.documentElement.scrollHeight,ih:innerHeight})`);
    assert.ok(m.sw <= m.iw, `sin overflow horizontal (${m.sw} ≤ ${m.iw})`);
    const lcd = await ui.rect('#lcd'); assert.ok(lcd.w > 100 && lcd.x >= 0 && lcd.x + lcd.w <= w && lcd.y + lcd.h <= h, `LCD visible: ${JSON.stringify(lcd)}`);
    const canvas = await ui.rect('#scene'); assert.ok(canvas.w >= 300 && canvas.h >= 300, `plotter manipulable ${Math.round(canvas.w)}×${Math.round(canvas.h)}`);
    const grab = await ui.rect('#calibrationGrab'), rot = await ui.rect('#calibrationRotate');
    assert.ok(grab.w >= 44 && grab.h >= 44 && rot.w >= 44 && rot.h >= 44, 'objetivos táctiles ≥ 44 px');
    for (const r of [grab, rot]) assert.ok(r.cx >= canvas.x && r.cx <= canvas.x + canvas.w && r.cy >= canvas.y && r.cy <= canvas.y + canvas.h, 'dentro del canvas');
    const btn = await ui.rect('#calibrationMode'); assert.ok(btn.w > 40 && btn.h >= 28 && btn.x + btn.w <= w, 'botón Salir accesible');
    for (const id of ['pause', 'reset']) { const r = await ui.rect('#' + id); assert.ok(r.w > 40 && r.h >= 28, id); }
    const p0 = await ui.pose(); await sleep(400); const p1 = await ui.pose(); assert.equal(p1.mode, 'code'); assert.ok(p1.simTime > p0.simTime);
    const texts = (await ui.visibleText()).join(' | '), reads = await ui.ev('[0,1,2].map(k=>String(readLine(k)))');
    for (const v of reads) assert.ok(!new RegExp(`(^|[^\\d])${v}([^\\d]|$)`).test(texts), `sin lecturas fuera de la LCD (${v})`);
    // arrastre con ratón/puntero también aquí
    await ui.drag({ x: grab.cx, y: grab.cy }, { x: grab.cx + 30, y: grab.cy - 40 }, 6); const p2 = await ui.pose(); assert.ok(finite(p2.x, p2.y, p2.th) && p2.mode === 'code');
    await ui.toggle(); await sleep(300); assert.equal(await ui.ev('BITIRO_CALIBRATION.active'), false);
    const m2 = await ui.ev('document.documentElement.scrollWidth<=innerWidth'); assert.equal(m2, true, 'sin overflow al salir');
  });
  await ui.close();
}

await test('Sin errores de consola ni excepciones en todo el recorrido', async () => { assert.deepEqual(consoleErrors, []); });
console.log(`\n${n} comprobaciones de interfaz SIM-CALIBRATION-1 correctas (Chrome ${browser.version.Browser}).`);
await browser.close(); server.close();
