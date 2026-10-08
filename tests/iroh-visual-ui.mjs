#!/usr/bin/env node
// SIM-3D-INTEGRATION-2 (interfaz) — Chrome real por CDP: selector legacy/iroh-v1, carga del modelo bajo la CSP de producción,
// cámaras, Calibration Mode con el modelo IROH (reutiliza tests/calibration-ui.mjs con ?robot=iroh) y capturas.
//   node --experimental-websocket tests/iroh-visual-ui.mjs      (Node < 22 necesita el flag; sin Chrome/Chromium se omite con código 0)
// Capturas en tests/perf/results/iroh-3d/ (carpeta ignorada por git, fuera del runtime).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { launch, newPage, findChrome } from './perf/cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests/perf/results/iroh-3d');
try { findChrome(); } catch { console.log('SKIP · no hay Chrome/Chromium (define CHROME_BIN)'); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
const served = [];
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  served.push(p);
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain', 'content-security-policy': CSP, 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch({ port: 9373 });
let n = 0; const errors = [];
const test = async (name, fn) => { await fn(); n++; console.log('OK · ' + name); };

async function open(query, width, height) {
  const page = await newPage(browser);
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Log.enable');
  page.on('Runtime.exceptionThrown', (p) => errors.push('exc: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0]));
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push('console.error: ' + p.args.map((a) => a.value ?? a.description).join(' ')); });
  page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') errors.push('log: ' + p.entry.text + ' ' + (p.entry.url || '')); });
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = new Promise((r) => page.on('Page.loadEventFired', r));
  await page.send('Page.navigate', { url: BASE + query }); await loaded; await sleep(900);
  return page;
}
const shot = async (page, name, clipCanvas = false) => {
  const clip = clipCanvas ? await page.evaluate(`(()=>{const r=document.getElementById('scene').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`) : undefined;
  const s = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(s.data, 'base64'));
};
const view = async (page, v) => { await page.evaluate(`document.querySelector('.cam[data-view="${v}"]').click()`); await sleep(450); };
// Fracción de píxeles distintos del fondo en el canvas (comprueba que el modelo se dibuja, sin leer el .png).
const painted = (page) => page.evaluate(`(()=>{const c=document.getElementById('scene'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let k=0;for(let i=0;i<d.length;i+=16)if(d[i+3]&&(d[i]>80||d[i+1]>80||d[i+2]>80))k++;return k/(d.length/16)})()`);

await test('Default: sin parámetro el modelo es legacy y los scripts estáticos del IROH no procesan el asset', async () => {
  served.length = 0;
  const page = await open('', 1366, 768);
  assert.equal(await page.evaluate('BITIRO_ROBOT_MODEL'), 'legacy');
  assert.equal(await page.evaluate('BITIRO_RENDER_STATS.model'), 'legacy');
  // SIM-3D-INTEGRATION-2A: carga estática desde index.html (sin document.write); en legacy el asset se descarga pero no se procesa.
  assert.equal(await page.evaluate('IROH_VISUAL.prepared'), false, 'legacy no procesa el asset');
  assert.equal(await page.evaluate("[...document.scripts].filter(s=>!s.getAttribute('src')).length"), 0, 'sin scripts inline');
  assert.equal(await page.evaluate('localStorage.length'), 0, 'el selector no escribe en localStorage');
  await shot(page, 'legacy_perspective_1366x768'); await page.close();
});
await test('?robot=iroh: carga estática autoalojada bajo la CSP de producción; IROH_VISUAL activo; sin errores ni violaciones CSP', async () => {
  served.length = 0;
  const page = await open('?robot=iroh', 1366, 768);
  assert.equal(await page.evaluate('BITIRO_ROBOT_MODEL'), 'iroh-v1');
  assert.equal(await page.evaluate('BITIRO_RENDER_STATS.model'), 'iroh-v1');
  assert.ok(served.includes('/assets/iroh/iroh-render-v1.js') && served.includes('/iroh-visual.js'), served.join(','));
  const order = await page.evaluate("[...document.scripts].map(s=>s.getAttribute('src'))");
  assert.ok(order.indexOf('assets/iroh/iroh-render-v1.js') < order.indexOf('iroh-visual.js') && order.indexOf('iroh-visual.js') < order.indexOf('renderer3d.js'), 'orden estático asset → iroh-visual → renderer3d: ' + order.join(','));
  assert.equal(await page.evaluate('IROH_VISUAL.prepared'), true);
  assert.equal(await page.evaluate('localStorage.length'), 0, 'sin localStorage');
  assert.equal(await page.evaluate("document.querySelectorAll('[href*=robot],[data-robot],select#robotModel').length"), 0, 'sin control visible para el estudiante');
  assert.ok((await painted(page)) > 0.05);
  await page.close();
});
await test('Cámaras perspective / top / follow / robot con IROH: dibujan, no lanzan errores; capturas', async () => {
  const page = await open('?robot=iroh', 1366, 768);
  await page.evaluate("(()=>{const t=document.getElementById('track');t.value='s01';t.dispatchEvent(new Event('change'))})()"); await sleep(400);
  for (const v of ['perspective', 'top', 'follow', 'robot']) {
    await view(page, v);
    assert.ok((await painted(page)) > 0.03, v + ' dibuja contenido');
    assert.equal(await page.evaluate('BITIRO_RENDER_STATS.model'), 'iroh-v1');
    const faces = await page.evaluate('BITIRO_RENDER_STATS.robotFaces'); assert.ok(faces > 50 && faces <= 600, v + ' caras: ' + faces);
    if (v === 'robot') {   // SIM-3D-INTEGRATION-2A: el modelo completo (todos los vértices del asset) cabe en el canvas real, sin recortes
      const bb = await page.evaluate(`(()=>{const cv=document.getElementById('scene'),r=cv.getBoundingClientRect(),A=IROH_RENDER_V1,hd=R.th-Math.PI/2,pr={x:R.x,y:R.y};let a=1e9,b=-1e9,l=1e9,rr=-1e9;
        for(const part of A.parts)for(const f of part)for(let i=1;i<f.length;i+=3){const F=f[i]*A.unit,S=f[i+1]*A.unit,U=f[i+2]*A.unit,x=R.x+F*Math.cos(hd)-S*Math.sin(hd),y=R.y+F*Math.sin(hd)+S*Math.cos(hd);
          const p=BITIRO_SCENE_VIEW.projectGround(cv,sceneTrack,camera,pr,x,y,U);if(!p)return null;a=Math.min(a,p.y);b=Math.max(b,p.y);l=Math.min(l,p.x);rr=Math.max(rr,p.x)}
        return {top:a,bottom:b,left:l,right:rr,w:r.width,h:r.height}})()`);
      const m = Math.min(bb.w, bb.h) * 0.04;
      assert.ok(bb.top >= m && bb.bottom <= bb.h - m && bb.left >= m && bb.right <= bb.w - m, 'IROH recortado en camera=robot: ' + JSON.stringify(bb));
    }
    await shot(page, `iroh_${v}_1366x768`);
  }
  await page.close();
  const legacy = await open('', 1366, 768);
  for (const v of ['perspective', 'top', 'follow', 'robot']) { await view(legacy, v); await shot(legacy, `legacy_${v}_1366x768`); }
  await legacy.close();
});
await test('Calibration top con IROH en 1366×768, 1024×768 y 390×844 (capturas, modelo activo, sin desbordamiento)', async () => {
  for (const [w, h] of [[1366, 768], [1024, 768], [390, 844]]) {
    for (const q of ['?robot=iroh', '']) {
      const page = await open(q, w, h);
      await page.evaluate("document.getElementById('calibrationMode').click()"); await sleep(700);
      assert.equal(await page.evaluate('BITIRO_CALIBRATION.active'), true);
      assert.equal(await page.evaluate('BITIRO_RENDER_STATS.model'), q ? 'iroh-v1' : 'legacy');
      assert.ok(await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'sin desbordamiento horizontal');
      await shot(page, `${q ? 'iroh' : 'legacy'}_calibration_top_${w}x${h}`); await page.close();
    }
  }
});
await test('Calibration Mode completo (arrastre, asa, teclado, entrar/salir, táctil, viewports) con ?robot=iroh', async () => {
  const r = cp.spawnSync(process.execPath, ['--experimental-websocket', path.join(ROOT, 'tests/calibration-ui.mjs')], { encoding: 'utf8', env: { ...process.env, BITIRO_TEST_QUERY: '?robot=iroh' }, timeout: 300000 });
  assert.equal(r.status, 0, r.stdout.slice(-1500) + r.stderr.slice(-800));
  assert.match(r.stdout, /13 comprobaciones de interfaz SIM-CALIBRATION-1 correctas/);
});
assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | '));
console.log(`\n${n} comprobaciones de interfaz SIM-3D-INTEGRATION-2 correctas. Capturas: ${path.relative(ROOT, OUT)}/`);
await browser.close(); server.close();
