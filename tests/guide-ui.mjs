#!/usr/bin/env node
// SIM-GUIDE-NNJ-1 — la Guía por temas en navegador real: apertura, temas desplegables, búsqueda, copiar ejemplos,
// teclado, cierre, desplazamiento y ausencia de desbordes en escritorio (1440 px) y móvil (390 px).
//   node tests/guide-ui.mjs                  # requiere Chrome/Chromium (CHROME_BIN o ~/.cache/ms-playwright); sin él, se omite con código 0.
//   SHOTS_DIR=/ruta node tests/guide-ui.mjs  # además guarda capturas.
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
const browser = await launch({ port: 9394 });
const SHOTS = process.env.SHOTS_DIR; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let n = 0; const errors = [];
const test = async (name, fn) => { await fn(); n++; console.log('OK · ' + name); };

async function open(width, height, touch) {
  const page = await newPage(browser);
  await page.send('Page.enable'); await page.send('Runtime.enable');
  page.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails.text));
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push('console.error'); });
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: touch });
  if (touch) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const loaded = new Promise((r) => page.on('Page.loadEventFired', r)); await page.send('Page.navigate', { url: URL_ }); await loaded; await sleep(700);
  return page;
}
const key = async (page, k, code, vk, text) => { for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, ...(type === 'keyDown' && text ? { text } : {}) }); await sleep(60); };
const shot = async (page, name) => { if (!SHOTS) return; const { data } = await page.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name), Buffer.from(data, 'base64')); };
const q = (page, expr) => page.evaluate(`(()=>{const d=document.getElementById('guideDialog');return (${expr})})()`);
const type = async (page, text) => { await page.evaluate("document.getElementById('guideSearch').focus()"); await page.send('Input.insertText', { text }); await sleep(120); };
const clearSearch = async (page) => { await page.evaluate("(()=>{const s=document.getElementById('guideSearch');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));})()"); await sleep(80); };

for (const [label, w, h, touch] of [['escritorio 1440', 1440, 900, false], ['móvil 390', 390, 844, true]]) {
  const page = await open(w, h, touch);
  await page.evaluate("(()=>{if(document.getElementById('guideOpen').offsetParent===null)document.getElementById('codeToggle').click();})()"); await sleep(200);
  await page.evaluate("document.getElementById('guideOpen').click()"); await sleep(250);

  await test(`${label} · abre como diálogo modal dentro del viewport con 8 temas (solo el primero abierto)`, async () => {
    const st = await q(page, `(()=>{const r=d.getBoundingClientRect();return {open:d.open,modal:d.matches(':modal'),x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight,
      topics:[...d.querySelectorAll('.guide-topic')].map(t=>t.open),titles:[...d.querySelectorAll('.guide-topic summary strong')].map(s=>s.textContent)}})()`);
    assert.ok(st.open && st.modal);
    assert.ok(st.x >= 0 && st.y >= 0 && st.x + st.w <= st.vw + 1 && st.y + st.h <= st.vh + 1, 'dentro del viewport');
    assert.equal(st.titles.length, 8); assert.deepEqual(st.topics, [true, false, false, false, false, false, false, false]);
    await shot(page, `${w}-guia-inicio.png`);
  });

  await test(`${label} · sin desbordes: ni la página, ni el cuerpo, ni las tarjetas; objetivos táctiles suficientes`, async () => {
    await page.evaluate("document.querySelectorAll('#guideDialog .guide-topic').forEach(t=>t.open=true)"); await sleep(150);
    const st = await q(page, `(()=>{const b=d.querySelector('.guide-body'),over=[];
      for(const e of d.querySelectorAll('.guide-topic,.guide-item,.guide-topic-body,.guide-program-head')) if(e.scrollWidth>e.clientWidth+1) over.push(e.className+':'+e.scrollWidth+'>'+e.clientWidth);
      const sm=[...d.querySelectorAll('.guide-topic>summary,.guide-copy,.guide-search,#guideClose')].map(e=>{const r=e.getBoundingClientRect();return {c:e.className||e.id,h:r.height,w:r.width}});
      const pre=[...d.querySelectorAll('pre')].filter(p=>p.scrollWidth>p.clientWidth+1).map(p=>p.textContent.slice(0,30));
      return {pre,page:document.documentElement.scrollWidth>innerWidth,bodyH:b.scrollWidth>b.clientWidth+1,over,sm,scrollable:b.scrollHeight>b.clientHeight}})()`);
    assert.ok(!st.page && !st.bodyH, 'sin desbordamiento horizontal de página/cuerpo'); assert.deepEqual(st.over, []); assert.deepEqual(st.pre, [], 'ningún ejemplo de código necesita desplazamiento horizontal'); assert.ok(st.scrollable, 'el cuerpo se desplaza');
    if (touch) for (const s of st.sm) assert.ok(s.h >= 43.5, `objetivo táctil ≥ 44 px: ${s.c} ${s.h}`);
    await shot(page, `${w}-guia-todo-abierto.png`);
    await page.evaluate("document.querySelectorAll('#guideDialog .guide-topic').forEach((t,i)=>t.open=i===0)"); await sleep(100);
  });

  await test(`${label} · desplazamiento del cuerpo y de los programas largos`, async () => {
    await page.evaluate("document.querySelector('#guideDialog .guide-body').scrollTop=0");
    await page.evaluate("document.querySelector('#guideDialog .guide-body').scrollTop=300"); await sleep(100);
    assert.ok(await q(page, "d.querySelector('.guide-body').scrollTop>0"), 'cuerpo desplazable');
    const pre = await q(page, "(()=>{const p=d.querySelector('.guide-program');return {tab:p.tabIndex,ov:getComputedStyle(p).overflowX}})()");
    assert.equal(pre.tab, 0, 'los programas son enfocables con teclado'); assert.equal(pre.ov, 'auto');
  });

  await test(`${label} · teclado: Enter y Espacio abren/cierran un tema; Tab recorre buscador, temas y Copiar`, async () => {
    await page.evaluate("document.querySelector('#guide-movimiento summary').focus()");
    await key(page, 'Enter', 'Enter', 13, '\r'); assert.equal(await q(page, "d.querySelector('#guide-movimiento').open"), true, 'Enter abre');
    await key(page, ' ', 'Space', 32, ' '); assert.equal(await q(page, "d.querySelector('#guide-movimiento').open"), false, 'Espacio cierra');
    const seen = new Set();
    await page.evaluate("document.getElementById('guideClose').focus()");
    const outside = [];
    for (let i = 0; i < 14; i++) {
      await key(page, 'Tab', 'Tab', 9);
      const a = await page.evaluate("(()=>{const a=document.activeElement,d=document.getElementById('guideDialog');return {name:a.id||a.className||a.tagName,body:a===document.body,inside:d.contains(a)}})()");
      seen.add(a.name); if (!a.body && !a.inside) outside.push(a.name);
    }
    assert.deepEqual(outside, [], 'el foco nunca cae en la página que está detrás del diálogo modal');
    assert.ok(seen.has('guideSearch'), 'Tab llega al buscador'); assert.ok([...seen].some((s) => /guide-body/.test(s)), 'Tab llega al cuerpo desplazable');
  });

  const results = (pg) => q(pg, `(()=>{const r=document.getElementById('guideResults'),b=d.querySelector('.guide-body');
    const secs=[...r.querySelectorAll('section')].map(s=>({title:s.querySelector('h3').textContent,
      titles:[...s.querySelectorAll('.guide-results-list>.guide-item')].map(c=>c.querySelector('h4').textContent),
      shown:[...s.querySelectorAll('.guide-results-list>.guide-item')].filter(c=>!c.hidden).map(c=>c.querySelector('h4').textContent),
      more:(s.querySelector('.guide-more')||{}).textContent||null,expanded:(s.querySelector('.guide-more')||{getAttribute(){return null}}).getAttribute('aria-expanded')}));
    const first=r.querySelector('.guide-item');
    return {secs,scrollTop:b.scrollTop,resultsHidden:r.hidden,topicsVisible:[...d.querySelectorAll('.guide-topic')].filter(t=>!t.hidden).length,
      empty:!document.getElementById('guideEmpty').hidden,status:document.getElementById('guideSearchStatus').textContent,
      firstTop:first?first.getBoundingClientRect().top-b.getBoundingClientRect().top:null}})()`);
  const main = (r) => r.secs[0] ? r.secs[0].titles : [];

  await test(`${label} · búsqueda por nombre: «AVANZAR» pone primero los comandos y pliega lo secundario`, async () => {
    await clearSearch(page);
    await page.evaluate("document.querySelector('#guideDialog .guide-body').scrollTop=400"); await sleep(80);
    await type(page, 'AVANZAR');
    const r = await results(page);
    assert.deepEqual(main(r), ['Avanzar', 'Avanzar en curva']); assert.equal(r.secs[0].title, 'Resultados principales');
    assert.equal(r.secs[1].title, 'También se menciona en'); assert.equal(r.secs[1].shown.length, 3, 'solo 3 relacionadas a la vista');
    assert.ok(r.secs[1].titles.length > 3 && /^Ver \d+ más$/.test(r.secs[1].more) && r.secs[1].expanded === 'false');
    assert.ok(!r.secs[1].titles.slice(0, 2).includes('Avanzar'), 'lo principal no se repite como relacionado');
    assert.match(r.status, /^2 resultados principales y \d+ relacionados$/);
    assert.equal(r.scrollTop, 0, 'la búsqueda nueva vuelve al inicio'); assert.equal(r.topicsVisible, 0); assert.equal(r.resultsHidden, false);
    assert.ok(r.firstTop >= 0 && r.firstTop < 60, 'el primer resultado queda arriba: ' + r.firstTop);
    await shot(page, `${w}-guia-busqueda.png`);
    // expandir lo relacionado con el botón (teclado: Enter)
    await page.evaluate("document.querySelector('#guideResults .guide-more').focus()"); await key(page, 'Enter', 'Enter', 13, '\r');
    const e = await results(page); assert.equal(e.secs[1].shown.length, e.secs[1].titles.length); assert.equal(e.secs[1].expanded, 'true'); assert.equal(e.secs[1].more, 'Ver menos');
  });

  await test(`${label} · búsqueda por firma, palabras clave y descripción; sin tildes ni mayúsculas`, async () => {
    await clearSearch(page); await type(page, 'moverServoGolpe(');
    let r = await results(page); assert.deepEqual(main(r), ['Mover la garra']); assert.ok(r.secs[1].titles.includes('La garra se mueve sola'));
    await clearSearch(page); await type(page, 'escribirPantalla(columna');
    r = await results(page); assert.deepEqual(main(r), ['Escribir en la pantalla']);
    await clearSearch(page); await type(page, 'centimetros');   // palabra clave (sin tilde)
    r = await results(page); assert.equal(main(r)[0], 'Medir la distancia con el sonar');
    await clearSearch(page); await type(page, 'MILISEGUNDOS');
    r = await results(page); assert.equal(main(r)[0], 'Esperar');
    await clearSearch(page); await type(page, 'girar derecha');   // varias palabras: todas deben aparecer
    r = await results(page); assert.equal(main(r)[0], 'Girar a la derecha');
    await clearSearch(page); await type(page, 'justo delante');   // solo aparece en el texto explicativo
    r = await results(page); assert.equal(r.status.startsWith('Sin coincidencias directas'), true, r.status);
    assert.equal(r.secs.length, 1); assert.equal(r.secs[0].title, 'Tarjetas que mencionan tu búsqueda'); assert.ok(r.secs[0].titles.includes('Medir la distancia con el sonar'));
    await clearSearch(page); await type(page, 'Línea'); const a = await results(page);
    await clearSearch(page); await type(page, 'LINEA'); const b = await results(page);
    assert.deepEqual(a.secs.map((s) => s.titles), b.secs.map((s) => s.titles)); assert.ok(main(a).length > 0);
    await clearSearch(page); await type(page, 'zzzz'); r = await results(page);
    assert.equal(r.status, 'Sin resultados'); assert.equal(r.empty, true); assert.equal(r.resultsHidden, true);
  });

  await test(`${label} · búsqueda: teclado, Copiar dentro de resultados y restauración al limpiar`, async () => {
    await clearSearch(page); await type(page, 'AVANZAR');
    await page.evaluate("document.getElementById('guideSearch').focus()"); await key(page, 'Tab', 'Tab', 9);
    assert.ok(await page.evaluate("!!(document.activeElement.closest('#guideResults')||document.activeElement.closest('.guide-body'))"), 'Tab pasa del buscador a los resultados');
    await clearSearch(page); await type(page, 'primer programa');
    await page.evaluate("window.__copied=null;Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__copied=t}},configurable:true})");
    await page.evaluate("document.querySelector('#guideResults .guide-copy').click()"); await sleep(150);
    assert.match(await page.evaluate('window.__copied'), /Hola, IROH/); assert.equal(await q(page, "document.querySelector('#guideResults .guide-copy').textContent"), '¡Copiado!');
    await sleep(1900);
    await page.evaluate("document.querySelector('#guideDialog .guide-body').scrollTop=0");
    await clearSearch(page);
    const st = await q(page, `({results:document.getElementById('guideResults').hidden,topics:[...d.querySelectorAll('.guide-topic')].map(t=>t.hidden+':'+t.open).join(),
      status:document.getElementById('guideSearchStatus').textContent,scroll:d.querySelector('.guide-body').scrollTop,children:document.getElementById('guideResults').children.length})`);
    assert.equal(st.results, true); assert.equal(st.children, 0); assert.equal(st.status, ''); assert.equal(st.scroll, 0);
    assert.equal(st.topics, 'false:true,false:false,false:false,false:false,false:false,false:false,false:false,false:false');
  });

  await test(`${label} · copiar: Clipboard API, mensaje accesible y alternativa sin Clipboard`, async () => {
    await page.evaluate("document.getElementById('guide-primeros-pasos').open=true");
    await page.evaluate("window.__copied=null;Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__copied=t}},configurable:true})");
    const sel = "#guideDialog .guide-copy[data-copy='primero']";
    await page.evaluate(`document.querySelector("${sel}").scrollIntoView({block:'center'})`); await sleep(100);
    await page.evaluate(`document.querySelector("${sel}").click()`); await sleep(150);
    const r = await q(page, `({copied:window.__copied,label:d.querySelector("${sel}").textContent,status:document.getElementById('guideCopyStatus').textContent,
      expected:d.querySelector('[data-program="primero"]').textContent})`);
    assert.equal(r.copied, r.expected); assert.match(r.copied, /void setup\(\) \{[\s\S]*finPrograma\(\);/); assert.equal(r.label, '¡Copiado!'); assert.match(r.status, /copiado/i);
    await sleep(2000); assert.equal(await q(page, `d.querySelector("${sel}").textContent`), 'Copiar', 'la etiqueta se restaura');
    // sin Clipboard API: usa selección + execCommand
    await page.evaluate("window.__exec=null;Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});document.execCommand=c=>{window.__exec=[c,document.activeElement.tagName,document.activeElement.value];return true}");
    await page.evaluate(`document.querySelector("${sel}").click()`); await sleep(150);
    const f = await page.evaluate("window.__exec"); assert.equal(f[0], 'copy'); assert.equal(f[1], 'TEXTAREA'); assert.match(f[2], /Hola, IROH/);
    assert.equal(await q(page, `d.querySelector("${sel}").textContent`), '¡Copiado!');
    // si todo falla, lo dice
    await page.evaluate("document.execCommand=()=>false"); await sleep(1900);
    await page.evaluate(`document.querySelector("${sel}").click()`); await sleep(150);
    assert.equal(await q(page, `d.querySelector("${sel}").textContent`), 'No se pudo copiar'); assert.match(await q(page, "document.getElementById('guideCopyStatus').textContent"), /No se pudo copiar/);
    await sleep(1900);
  });

  await test(`${label} · cierre: Escape desde el buscador, ✕ y fondo; el foco vuelve a «Guía»`, async () => {
    await page.evaluate("document.getElementById('guideSearch').focus()");
    await key(page, 'Escape', 'Escape', 27); await sleep(200);
    assert.equal(await page.evaluate("document.getElementById('guideDialog').open"), false); assert.equal(await page.evaluate("document.activeElement.id"), 'guideOpen');
    await page.evaluate("document.getElementById('guideOpen').click()"); await sleep(150);
    await page.evaluate("document.getElementById('guideClose').click()"); await sleep(150);
    assert.equal(await page.evaluate("document.getElementById('guideDialog').open"), false);
    await page.evaluate("document.getElementById('guideOpen').click()"); await sleep(150);
    for (const t of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type: t, x: 2, y: 2, button: 'left', buttons: t === 'mousePressed' ? 1 : 0, clickCount: 1 });
    await sleep(200); assert.equal(await page.evaluate("document.getElementById('guideDialog').open"), false, 'cierra al pulsar el fondo');
  });

  await test(`${label} · la guía no altera la simulación ni el código del editor`, async () => {
    const before = await page.evaluate("document.getElementById('src').value");
    await page.evaluate("document.getElementById('guideOpen').click()"); await sleep(120);
    await page.evaluate("document.querySelector(\"#guideDialog .guide-copy\").click()"); await sleep(120);
    await page.evaluate("document.getElementById('guideClose').click()"); await sleep(120);
    assert.equal(await page.evaluate("document.getElementById('src').value"), before, 'copiar un ejemplo no modifica el editor');
  });
  await page.close();
}
await test('Sin excepciones de página ni errores de consola (incluye CSP estricta)', async () => { assert.deepEqual(errors, []); });
console.log(`\n${n} comprobaciones de la Guía por temas correctas (Chrome ${browser.version.Browser}).`);
await browser.close(); server.close(); process.exit(0);
