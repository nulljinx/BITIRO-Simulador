#!/usr/bin/env node
// SIM-UI-RELEASE-1 — la marca del simulador no navega (clic, toque ni teclado) y la Guía sigue operativa.
//   node tests/brand-logo-ui.mjs        # requiere Chrome/Chromium (CHROME_BIN o ~/.cache/ms-playwright); sin él, se omite con código 0.
//   SHOTS_DIR=/ruta node tests/brand-logo-ui.mjs   # además guarda capturas 1440 px y 390 px.
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
const hits = [];
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); hits.push(p); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain', 'content-security-policy': CSP, 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch({ port: 9373 });
const SHOTS = process.env.SHOTS_DIR; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let n = 0; const errors = [];
const test = async (name, fn) => { await fn(); n++; console.log('OK · ' + name); };

async function open(width, height, touch) {
  const page = await newPage(browser);
  await page.send('Page.enable'); await page.send('Runtime.enable');
  page.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails.text));
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
  if (touch) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const loaded = new Promise((r) => page.on('Page.loadEventFired', r)); await page.send('Page.navigate', { url: URL_ }); await loaded; await sleep(700);
  return page;
}
const rect = (page, sel) => page.evaluate(`(()=>{const r=document.querySelector('${sel}').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}})()`);
const key = async (page, k, code, vk) => { for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk }); };
const shot = async (page, name) => { if (!SHOTS) return; const { data } = await page.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name), Buffer.from(data, 'base64')); };

for (const [label, w, h, touch] of [['escritorio 1440', 1440, 900, false], ['móvil 390', 390, 844, true]]) {
  const page = await open(w, h, touch);
  await test(`${label} · la marca no es enlace ni control, y su aspecto se conserva`, async () => {
    const info = await page.evaluate(`(()=>{const b=document.querySelector('.topbar .brand'),cs=getComputedStyle(b),img=b.querySelector('img'),r=img.getBoundingClientRect();
      return {tag:b.tagName,href:b.getAttribute('href'),attrs:[...b.attributes].map(a=>a.name),cursor:cs.cursor,links:document.querySelectorAll('.topbar a').length,
        closestA:!!b.closest('a'),imgOk:img.complete&&img.naturalWidth>0,imgW:r.width,text:b.textContent.replace(/\\s+/g,' ').trim(),tabbable:b.tabIndex}})()`);
    assert.equal(info.tag, 'DIV'); assert.equal(info.href, null); assert.deepEqual(info.attrs, ['class']);
    assert.notEqual(info.cursor, 'pointer'); assert.equal(info.links, 0); assert.equal(info.closestA, false); assert.equal(info.tabbable, -1);
    assert.ok(info.imgOk && info.imgW === 34, 'logo visible 34 px'); assert.match(info.text, /^BITIRO Simulador/);
  });
  await test(`${label} · clic/toque en la marca no navega ni abre pestañas`, async () => {
    const b = await rect(page, '.topbar .brand'); assert.ok(b.w > 20 && b.h > 20);
    const before = await page.evaluate('location.href'), hitsBefore = hits.length;
    await page.evaluate('window.__m=1;window.open=()=>{window.__opened=true;return null}');
    if (touch) { for (const type of ['touchStart', 'touchEnd']) await page.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchStart' ? [{ x: b.cx, y: b.cy }] : [] }); }
    for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: b.cx, y: b.cy, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
    await sleep(400);
    assert.equal(await page.evaluate('location.href'), before); assert.equal(await page.evaluate('window.__m'), 1, 'sin recarga');
    assert.notEqual(await page.evaluate('window.__opened'), true); assert.equal(hits.length, hitsBefore, 'sin peticiones nuevas');
  });
  await test(`${label} · teclado: Tab/Enter/Espacio no enfocan ni activan la marca`, async () => {
    const before = await page.evaluate('location.href');
    const seen = [];
    for (let i = 0; i < 12; i++) {
      await key(page, 'Tab', 'Tab', 9);
      seen.push(await page.evaluate(`(()=>{const a=document.activeElement;return {inBrand:!!a.closest('.brand'),id:a.id||a.className||a.tagName}})()`));
      await key(page, 'Enter', 'Enter', 13).catch(() => {});
      if (seen.at(-1).inBrand) break;
      await page.evaluate('(()=>{const d=document.getElementById("guideDialog");if(d&&d.open)d.close();})()');
    }
    assert.ok(seen.every((s) => !s.inBrand), 'la marca nunca recibe foco');
    await page.evaluate('document.querySelector(".topbar .brand").focus()'); await key(page, 'Enter', 'Enter', 13); await key(page, ' ', 'Space', 32); await sleep(300);
    assert.equal(await page.evaluate('location.href'), before); assert.equal(await page.evaluate('window.__m'), 1);
  });
  await shot(page, `${w}-inicio.png`);
  await test(`${label} · Guía: botón, apertura, contenido sin desbordes y cierre (✕, Escape, fondo)`, async () => {
    await page.evaluate('(()=>{const t=document.getElementById("codeToggle");const p=document.getElementById("codePanel");if(t&&getComputedStyle(document.getElementById("guideOpen")).display==="none"||document.getElementById("guideOpen").offsetParent===null)t.click();})()');
    await sleep(300);
    const g = await rect(page, '#guideOpen'); assert.ok(g.w > 30 && g.h >= (touch ? 44 : 28), 'botón Guía visible y táctil en móvil');
    assert.equal(await page.evaluate('document.getElementById("guideOpen").textContent'), 'Guía');
    const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 }); await sleep(250); };
    await click(g.cx, g.cy);
    const st = await page.evaluate(`(()=>{const d=document.getElementById('guideDialog'),r=d.getBoundingClientRect(),b=d.querySelector('.guide-body');
      return {open:d.open,modal:d.matches(':modal'),x:r.x,y:r.y,w:r.width,h:r.height,cards:d.querySelectorAll('.guide-card').length,bodyH:b.clientHeight,hOverflow:b.scrollWidth>b.clientWidth+1,
        pageOverflow:document.documentElement.scrollWidth>innerWidth,vw:innerWidth,vh:innerHeight,cardOut:[...d.querySelectorAll('.guide-card')].some(c=>c.scrollWidth>c.clientWidth+1)}})()`);
    assert.ok(st.open && st.modal && st.cards === 9, `modal abierto con 9 tarjetas (${st.cards})`);
    assert.ok(st.x >= 0 && st.y >= 0 && st.x + st.w <= st.vw + 1 && st.y + st.h <= st.vh + 1, 'diálogo dentro del viewport');
    assert.ok(!st.hOverflow && !st.cardOut && !st.pageOverflow, 'sin desbordamiento horizontal');
    await shot(page, `${w}-guia.png`);
    await page.evaluate('document.querySelector("#guideDialog .guide-body").scrollTop=99999'); await shot(page, `${w}-guia-final.png`);
    await key(page, 'Escape', 'Escape', 27); await sleep(200); assert.equal(await page.evaluate('document.getElementById("guideDialog").open'), false);
    assert.equal(await page.evaluate('document.activeElement.id'), 'guideOpen', 'foco vuelve al botón Guía');
    await click(g.cx, g.cy); await click((await rect(page, '#guideClose')).cx, (await rect(page, '#guideClose')).cy);
    assert.equal(await page.evaluate('document.getElementById("guideDialog").open'), false, 'cierra con ✕');
    await click(g.cx, g.cy); await click(2, 2); assert.equal(await page.evaluate('document.getElementById("guideDialog").open'), false, 'cierra al pulsar el fondo');
  });
  await page.close();
}
await test('Sin excepciones de página', async () => assert.deepEqual(errors, []));
console.log(`\n${n} comprobaciones de marca y Guía correctas (Chrome ${browser.version.Browser}).`);
await browser.close(); server.close();
