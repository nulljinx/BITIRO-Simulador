#!/usr/bin/env node
// IROH Simulator — pruebas de NAVEGADOR de la identidad: bienvenida por sesión de pestaña, cabecera (solo «Acerca de») y «Acerca de».
//   node tests/iroh-brand-ui.mjs        # requiere Chrome/Chromium (CHROME_BIN o ~/.cache/ms-playwright). Sin Chrome FALLA (un SKIP no cuenta).
//   SHOTS_DIR=/ruta node tests/iroh-brand-ui.mjs   # además guarda capturas.
// Sirve la RAÍZ del repositorio con las cabeceras REALES de pages/_headers (CSP incluida): lo que se prueba es lo que Pages aplicaría.
// Las demás suites parten de «ya entré» (tests/perf/cdp.mjs siembra la clave en sessionStorage); esta abre con { seed: false } para ver la bienvenida real.
// «Pestaña nueva» = un target nuevo de CDP en el mismo navegador: comparte localStorage pero tiene sessionStorage PROPIO y vacío (como una pestaña real).
// Duplicar una pestaña o restaurar una sesión copia sessionStorage en los navegadores: ese caso NO es una pestaña nueva independiente (ver prueba 3d).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { launch, newPage, findChrome, WELCOME_KEY, WELCOME_LEGACY_KEY } from './perf/cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const STARTERS = require('../starters.js');
try { findChrome(); } catch (e) { console.error('FALLO · no hay Chrome/Chromium (define CHROME_BIN): ' + e.message); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = process.env.SHOTS_DIR; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

// ───────── servidor: raíz del repo + cabeceras de pages/_headers (bloque «/*») ─────────
const headers = {};
{ let inAll = false; for (const line of fs.readFileSync(path.join(ROOT, 'pages/_headers'), 'utf8').split('\n')) {
  if (/^\s*#/.test(line) || !line.trim()) continue;
  if (/^\S/.test(line)) { inAll = line.trim() === '/*'; continue; }
  if (inAll) { const i = line.indexOf(':'); headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); }
} }
assert.ok(headers['content-security-policy'], 'pages/_headers debe declarar la CSP');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const hits = [];
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); hits.push(p); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain', ...headers, 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch({ port: 9380 });

// ───────── utilidades ─────────
const logs = [];            // errores de consola, excepciones y violaciones de CSP de TODA la ejecución
const results = [];
const test = async (name, fn) => {
  try { const d = await fn(); results.push({ name, ok: true }); console.log('OK · ' + name + (d ? ' · ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 220) : '')); }
  catch (e) { results.push({ name, ok: false }); console.log('FALLO · ' + name + ' · ' + String(e.message).split('\n').slice(0, 4).join(' | ')); }
};
async function goto(page, url) { const l = new Promise((r) => page.on('Page.loadEventFired', r)); await page.send('Page.navigate', { url }); await l; await sleep(700); }
/** Abre la página (una PESTAÑA nueva cada vez). seen: marca «ya entré» en sessionStorage antes de cargar · blocked: almacenamiento que lanza excepciones · pre: scripts previos a la carga. */
async function open(w, h, { mobile = false, reduced = false, forced = false, seen = false, blocked = false, pre = [], clear = true, dsf = 1 } = {}) {
  const page = await newPage(browser, { seed: false });
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Log.enable');
  page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error' || /Content Security Policy/i.test(p.entry.text)) logs.push(p.entry.text); });
  page.on('Runtime.exceptionThrown', (p) => logs.push('EXC ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile });
  await page.send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }, { name: 'forced-colors', value: forced ? 'active' : 'none' }] });
  if (clear) { await goto(page, URL_); await page.evaluate('try{localStorage.clear()}catch(e){}'); }
  if (blocked) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `for(const m of ['getItem','setItem','removeItem'])Storage.prototype[m]=function(){throw new DOMException('bloqueado','SecurityError')}` });
  if (seen) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{sessionStorage.setItem(${JSON.stringify(WELCOME_KEY)},'1')}catch(e){}` });
  for (const src of pre) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: src });
  await goto(page, URL_);
  return page;
}
const key = async (page, k, code, vk, mods = 0, text) => {
  await page.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods, ...(text ? { text } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, modifiers: mods });
};
const shot = async (page, name) => { if (!SHOTS) return; const r = await page.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.data, 'base64')); };
const state = (page) => page.evaluate(`(()=>{const d=document.getElementById('welcome');return {open:d.open,modal:d.matches(':modal'),active:document.activeElement.id||document.activeElement.tagName,flag:(()=>{try{return sessionStorage.getItem(${JSON.stringify(WELCOME_KEY)})}catch(e){return 'ERR'}})(),lsFlags:(()=>{try{return [localStorage.getItem(${JSON.stringify(WELCOME_KEY)}),localStorage.getItem(${JSON.stringify(WELCOME_LEGACY_KEY)})]}catch(e){return 'ERR'}})()}})()`);
const runningInWelcome = (page) => page.evaluate(`document.getAnimations().filter(a=>a.playState==='running'&&a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('#welcome')).length`);
const infinite = (page) => page.evaluate(`document.getAnimations().filter(a=>a.effect&&a.effect.getComputedTiming().iterations===Infinity).length`);
const lsSnapshot = (page) => page.evaluate(`JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))`);
const click = (page, id) => page.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);

// ───────── 0. Recursos obligatorios (si faltan, FALLA: nunca se omite) ─────────
await test('0 · los recursos de la identidad existen en disco (mascota, isotipo, favicons, CSS y JS)', async () => {
  const need = ['assets/iroh-mascot-420.webp', 'assets/iroh-mascot-640.webp', 'assets/iroh-mascot-960.webp', 'assets/iroh-isotipo-68.webp', 'assets/iroh-favicon-32.png', 'assets/iroh-favicon-180.png', 'assets/iroh-favicon-192.png', 'iroh-brand.css', 'iroh-brand.js'];
  const missing = need.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  assert.deepEqual(missing, [], 'FALTAN recursos de la identidad (sin ellos esta suite y el build deben fallar): ' + missing.join(', '));
  return { mascotaKB: Math.round(fs.statSync(path.join(ROOT, 'assets/iroh-mascot-640.webp')).size / 1024) };
});

// ───────── 1–7. Bienvenida ─────────
await test('1 · primera visita: la bienvenida se abre, es modal y el foco va a «Entrar al simulador»', async () => {
  const p = await open(1440, 900); const s = await state(p);
  assert.equal(s.open, true); assert.equal(s.modal, true); assert.equal(s.active, 'welcomeEnter'); assert.equal(s.flag, null);
  const i = await p.evaluate(`({t:document.getElementById('welcome-title').textContent,ok:document.getElementById('welcomeImg').naturalWidth>0,b:document.getElementById('welcomeEnter').textContent.trim(),h1:document.querySelectorAll('h1').length,lang:document.documentElement.lang})`);
  assert.equal(i.t, '¡Bienvenido a IROH Simulator!'); assert.ok(i.ok, 'la mascota no cargó'); assert.equal(i.b, 'Entrar al simulador'); assert.equal(i.h1, 1); assert.equal(i.lang, 'es');
  await shot(p, 'bienvenida-1440x900.png'); await p.close(); return i;
});
await test('2 · «Entrar»: cierra, recuerda la elección, devuelve el foco y NO queda ninguna animación', async () => {
  const p = await open(1440, 900);
  assert.equal(await infinite(p), 0, 'no debe haber animaciones infinitas (WCAG 2.2.2)');
  await sleep(1600); assert.equal(await runningInWelcome(p), 0, 'tras la entrada no debe seguir moviéndose nada en la bienvenida');
  await click(p, 'welcomeEnter'); await sleep(600);
  const s = await state(p); assert.equal(s.open, false); assert.equal(s.flag, '1', 'la elección se recuerda en sessionStorage'); assert.equal(s.active, 'workspace');
  assert.deepEqual(s.lsFlags, [null, null], 'la bienvenida no escribe NINGÚN indicador en localStorage');
  assert.equal(await p.evaluate('document.getAnimations().filter(a=>/^w-/.test(a.animationName||"")).length'), 0);
  await p.close();
});
await test('3 · recargar LA MISMA pestaña: no vuelve a aparecer y NO descarga la mascota', async () => {
  const p = await open(1440, 900); await click(p, 'welcomeEnter'); await sleep(600);
  const n = hits.length; await goto(p, URL_); await sleep(400);
  assert.equal((await state(p)).open, false);
  const got = hits.slice(n); assert.ok(!got.some((h) => /iroh-mascot-/.test(h)), 'se descargó la mascota: ' + got.filter((h) => /mascot/.test(h)));
  const bytes = ['iroh-brand.css', 'iroh-brand.js', 'assets/iroh-isotipo-68.webp'].reduce((a, f) => a + fs.statSync(path.join(ROOT, f)).size, 0);
  assert.ok(bytes <= 40 * 1024, 'el peso fijo de la identidad para quien ya entró debe ser ≤ 40 KB: ' + bytes);
  await p.close(); return { pesoFijoKB: +(bytes / 1024).toFixed(1) };
});
await test('3b · pestaña NUEVA independiente: la bienvenida reaparece; recargar la misma no; el código guardado (localStorage) se conserva', async () => {
  const codigo = '// mi programa guardado\nvoid setup() {\n  inicializarMovimiento();\n}\nvoid loop() {\n  avanzar(30);\n}\n';
  const a = await open(1440, 900, { pre: [`try{localStorage.setItem('bitiro:standalone:code:s01',${JSON.stringify(codigo)})}catch(e){}`] });
  assert.equal((await state(a)).open, true, 'pestaña A: abre sola');
  await click(a, 'welcomeEnter'); await sleep(600); assert.equal((await state(a)).open, false);
  await a.send('Page.reload'); await sleep(900); assert.equal((await state(a)).open, false, 'recargar la misma pestaña (Page.reload) no la reabre');
  const snapA = await lsSnapshot(a);
  const b = await open(1440, 900, { clear: false });                        // pestaña B: sessionStorage propio y vacío; localStorage compartido
  const sb = await state(b); assert.equal(sb.open, true, 'pestaña nueva: la bienvenida debe aparecer otra vez'); assert.equal(sb.modal, true); assert.equal(sb.active, 'welcomeEnter'); assert.equal(sb.flag, null);
  assert.equal(await b.evaluate(`localStorage.getItem('bitiro:standalone:code:s01')`), codigo, 'el código del estudiante sigue ahí, sin migrar ni tocar');
  assert.equal(await lsSnapshot(b), snapA, 'localStorage idéntico: abrir la bienvenida en otra pestaña no cambia nada del código, escenario ni calibración');
  assert.equal((await state(a)).open, false, 'la pestaña A no se ve afectada por la B'); assert.equal((await state(a)).flag, '1');
  await click(b, 'welcomeEnter'); await sleep(600); await b.send('Page.reload'); await sleep(900); assert.equal((await state(b)).open, false, 'B también la recuerda al recargar');
  await b.close();                                                          // se cierra la pestaña…
  const c = await open(1440, 900, { clear: false });                        // …y se abre el simulador en otra nueva
  assert.equal((await state(c)).open, true, 'tras cerrar la pestaña y abrir otra, la bienvenida aparece de nuevo');
  assert.equal(await lsSnapshot(c), snapA, 'localStorage sigue idéntico'); await c.close(); await a.close();
});
await test('3c · el indicador ANTIGUO de localStorage (welcome:v1) no decide nada y NO se borra', async () => {
  const p = await open(1440, 900, { pre: [`try{localStorage.setItem(${JSON.stringify(WELCOME_LEGACY_KEY)},'1')}catch(e){}`] });
  const s = await state(p); assert.equal(s.open, true, 'con el indicador antiguo presente la bienvenida DEBE abrirse (pestaña nueva)'); assert.equal(s.lsFlags[1], '1');
  await click(p, 'welcomeEnter'); await sleep(600); const t = await state(p);
  assert.equal(t.open, false); assert.equal(t.flag, '1'); assert.equal(t.lsFlags[1], '1', 'el indicador antiguo sigue en localStorage (no se elimina automáticamente)'); assert.equal(t.lsFlags[0], null, 'no se crea la clave nueva en localStorage');
  await p.close();
});
await test('3d · pestaña duplicada o restaurada (el navegador copia sessionStorage): no reaparece; NO es una pestaña nueva independiente', async () => {
  // Chrome/Firefox copian sessionStorage al duplicar una pestaña o restaurar una sesión; lo simulamos sembrando la clave antes de cargar.
  const p = await open(1440, 900, { seen: true });
  assert.equal((await state(p)).open, false, 'con sessionStorage copiado la bienvenida no se abre sola'); assert.equal((await state(p)).flag, '1'); await p.close();
});
await test('4 · reapertura manual desde «Acerca de» → «Ver la bienvenida»; Escape cierra, devuelve el foco y no altera localStorage', async () => {
  const p = await open(1440, 900); await click(p, 'welcomeEnter'); await sleep(600);
  const antes = await lsSnapshot(p);
  await p.evaluate(`document.getElementById('aboutOpen').focus()`); await key(p, 'Enter', 'Enter', 13, 0, '\r'); await sleep(250);
  assert.equal(await p.evaluate(`document.getElementById('aboutDialog').open`), true);
  await p.evaluate(`document.getElementById('aboutWelcome').focus()`); await key(p, 'Enter', 'Enter', 13, 0, '\r'); await sleep(350);
  assert.equal((await state(p)).open, true, 'no reabrió'); assert.equal((await state(p)).active, 'welcomeEnter');
  await key(p, 'Escape', 'Escape', 27); await sleep(600);
  const s = await state(p); assert.equal(s.open, false); assert.equal(s.active, 'aboutOpen'); assert.equal(s.flag, '1');
  assert.equal(await lsSnapshot(p), antes, 'localStorage (código, escenario, calibración) idéntico tras reabrir y cerrar la bienvenida'); await p.close();
});
await test('4b · «Bienvenida» ya NO existe en la cabecera (ni oculta): solo «Acerca de», y la bienvenida se alcanza desde ahí', async () => {
  const out = {};
  for (const [w, h, m] of [[1440, 900, 0], [1024, 768, 0], [768, 1024, 1], [390, 844, 1]]) {
    const p = await open(w, h, { mobile: !!m, seen: true });
    const r = await p.evaluate(`(()=>{const tb=document.querySelector('.topbar');return {nodo:document.getElementById('welcomeReopen'),clase:tb.querySelectorAll('.topbar-btn--welcome').length,botones:[...tb.querySelectorAll('button')].map(b=>b.id),texto:/bienvenida/i.test(tb.textContent),html:/welcomeReopen/.test(document.documentElement.outerHTML),verBienv:document.getElementById('aboutWelcome').textContent.trim()}})()`);
    assert.equal(r.nodo, null, 'el nodo #welcomeReopen no debe existir'); assert.equal(r.clase, 0); assert.deepEqual(r.botones, ['aboutOpen']); assert.equal(r.texto, false, 'ni siquiera texto «Bienvenida» (visible u oculto) en la cabecera'); assert.equal(r.html, false);
    assert.equal(r.verBienv, 'Ver la bienvenida'); out[`${w}x${h}`] = r.botones; await p.close();
  } return out;
});
await test('5 · teclado: el foco queda atrapado en la bienvenida (Tab / Shift+Tab) y Enter activa el botón', async () => {
  const p = await open(1440, 900); const seen = new Set();
  const where = `(document.activeElement.closest('#welcome')?'':'FUERA:')+(document.activeElement.id||document.activeElement.tagName)`;
  for (let i = 0; i < 6; i++) { await key(p, 'Tab', 'Tab', 9); seen.add(await p.evaluate(where)); }
  for (let i = 0; i < 4; i++) { await key(p, 'Tab', 'Tab', 9, 8); seen.add(await p.evaluate(where)); }
  // BODY = el foco pasó al navegador (nativo en un <dialog> modal); lo que nunca puede ocurrir es llegar a la página de detrás.
  assert.ok(![...seen].some((x) => x.startsWith('FUERA') && x !== 'FUERA:BODY'), 'el foco salió a la página: ' + [...seen]);
  await p.evaluate(`document.getElementById('welcomeEnter').focus()`); await key(p, 'Enter', 'Enter', 13, 0, '\r'); await sleep(600);
  assert.equal((await state(p)).open, false); await p.close(); return [...seen];
});
await test('6 · almacenamiento bloqueado: no se abre sola, no falla y sigue disponible desde «Acerca de»', async () => {
  const before = logs.length;
  const p = await open(1440, 900, { blocked: true, clear: false });
  assert.equal(await p.evaluate(`document.getElementById('welcome').open`), false, 'no debe abrirse sola si no puede recordar la elección');
  await click(p, 'aboutOpen'); await sleep(200); await click(p, 'aboutWelcome'); await sleep(350); assert.equal(await p.evaluate(`document.getElementById('welcome').open`), true);
  await click(p, 'welcomeEnter'); await sleep(600); assert.equal(await p.evaluate(`document.getElementById('welcome').open`), false);
  assert.ok(await p.evaluate(`document.getElementById('workspace').getBoundingClientRect().height>300`), 'el simulador debe quedar visible');
  assert.deepEqual(logs.slice(before).filter((l) => /^EXC .*(welcome|iroh-brand)/i.test(l)), [], 'la bienvenida no debe lanzar excepciones con el almacenamiento bloqueado');
  await p.close();
});
await test('7 · prefers-reduced-motion: sin animaciones, contenido visible al instante y cierre inmediato', async () => {
  const p = await open(1440, 900, { reduced: true });
  const a = await p.evaluate(`({anims:document.getAnimations().length,op:getComputedStyle(document.querySelector('.welcome__mascot img')).opacity,titleOp:getComputedStyle(document.getElementById('welcome-title')).opacity,tx:getComputedStyle(document.querySelector('.welcome__roll')).transform})`);
  assert.equal(a.anims, 0); assert.equal(a.op, '1'); assert.equal(a.titleOp, '1'); assert.ok(a.tx === 'none' || a.tx === 'matrix(1, 0, 0, 1, 0, 0)');
  await click(p, 'welcomeEnter'); await sleep(80); assert.equal((await state(p)).open, false, 'con reduced motion el cierre es inmediato'); await p.close(); return a;
});

// ───────── 8. Responsive de la bienvenida ─────────
// Medición de la composición REAL de la bienvenida (estilos calculados, sin valores supuestos) y reglas que debe cumplir en cualquier viewport.
const measureWelcome = (p) => p.evaluate(`(()=>{const d=document.getElementById('welcome'),q=(s)=>document.querySelector(s),cs=(e)=>getComputedStyle(e),
  rc=(e)=>{const r=e.getBoundingClientRect();return {t:r.top,b:r.bottom,l:r.left,r:r.right,w:r.width,h:r.height}},cta=document.getElementById('welcomeEnter'),title=q('.welcome__title');
  const r={vw:innerWidth,vh:innerHeight,two:cs(q('.welcome__stage')).gridTemplateColumns.split(' ').length>1,
    essential:['welcome-title','welcomeEnter','welcomeImg','welcomeClose'].every((id)=>{const c=cs(document.getElementById(id));return c.display!=='none'&&c.visibility!=='hidden'}),
    hOver:d.scrollWidth>d.clientWidth+1,vScroll:d.scrollHeight>d.clientHeight+1,titlePx:parseFloat(cs(title).fontSize),titleClip:title.scrollWidth>title.clientWidth+1,
    title:rc(title),img:rc(document.getElementById('welcomeImg')),copy:rc(q('.welcome__copy')),cta:rc(cta),close:rc(document.getElementById('welcomeClose'))};
  d.scrollTop=d.scrollHeight; r.ctaAfterScroll=rc(cta); d.scrollTop=0; return r})()`);
function checkWelcome(r, label, { maxTitle = 3.1 * 16 } = {}) {
  const e = (c, m) => assert.ok(c, `${label}: ${m}`);
  e(!r.hOver, 'desborde horizontal'); e(r.essential, 'un elemento esencial está oculto (título, botón, mascota o cierre)');
  e(r.title.l >= -0.5 && r.title.r <= r.vw + 0.5 && !r.titleClip, `título cortado (${Math.round(r.title.l)}–${Math.round(r.title.r)} de ${r.vw})`);
  e(r.img.l >= -0.5 && r.img.r <= r.vw + 0.5, `mascota cortada en horizontal (${Math.round(r.img.l)}–${Math.round(r.img.r)} de ${r.vw})`);
  e(r.cta.h >= 44, 'botón principal < 44 px de alto'); e(r.titlePx <= maxTitle + 0.5, `título demasiado grande: ${r.titlePx}px (máx ${maxTitle})`);
  if (!r.vScroll) { e(r.cta.t >= 0 && r.cta.b <= r.vh, `botón fuera de pantalla (${Math.round(r.cta.t)}–${Math.round(r.cta.b)} de ${r.vh})`); e(r.img.t >= -1 && r.img.b <= r.vh + 1, 'mascota cortada en vertical'); }
  else e(r.ctaAfterScroll.b <= r.vh + 1 && r.ctaAfterScroll.t >= 0, 'con desplazamiento el botón debe quedar alcanzable');
  if (r.two) { e(r.img.h <= (r.vh < 520 ? 0.72 : 0.6) * r.vh + 1, `mascota demasiado grande para el alto: ${Math.round(r.img.h)} de ${r.vh}`); e(r.copy.r <= r.img.l + 1, 'texto y mascota se solapan'); }
}
const VPS = [[1920, 1080, 0], [1747, 860, 0], [1650, 900, 0], [1440, 900, 0], [1366, 768, 0], [1280, 720, 0], [1024, 768, 0], [768, 1024, 1], [820, 1180, 1], [390, 844, 1], [375, 667, 1], [320, 568, 1], [667, 375, 1], [812, 375, 1], [568, 320, 1]];
for (const [w, h, m] of VPS) await test(`8 · bienvenida ${w}×${h}${w > h && h < 520 ? ' (móvil horizontal)' : ''}: sin desborde ni scroll, botón y mascota visibles, objetivos ≥ 44 px`, async () => {
  const p = await open(w, h, { mobile: !!m }); await sleep(1300);
  const r = await p.evaluate(`(()=>{const d=document.getElementById('welcome'),c=document.getElementById('welcomeEnter').getBoundingClientRect(),im=document.getElementById('welcomeImg').getBoundingClientRect(),cl=document.getElementById('welcomeClose').getBoundingClientRect();
    return {hOverflow:d.scrollWidth>d.clientWidth+1,vScroll:d.scrollHeight>d.clientHeight+1,ctaTop:Math.round(c.top),ctaBottom:Math.round(c.bottom),ctaH:Math.round(c.height),imgH:Math.round(im.height),closeSize:Math.round(cl.width),descPx:parseFloat(getComputedStyle(document.querySelector('.welcome__desc')).fontSize),vh:innerHeight}})()`);
  assert.equal(r.hOverflow, false, 'desborde horizontal'); assert.ok(r.ctaTop >= 0 && r.ctaBottom <= r.vh, `botón fuera de pantalla (${r.ctaTop}-${r.ctaBottom} de ${r.vh})`);
  assert.ok(r.ctaH >= 44 && r.closeSize >= 44, 'objetivos < 44 px'); assert.ok(r.imgH >= (h < 620 ? 150 : 180), 'mascota demasiado pequeña ' + r.imgH);
  assert.ok(r.descPx >= (h < 360 ? 14 : 15), 'texto demasiado pequeño ' + r.descPx);
  if (w < 900 || h < 520) assert.equal(r.vScroll, false, 'la bienvenida necesita desplazarse');
  checkWelcome(await measureWelcome(p), `${w}×${h}`); await shot(p, `bienvenida-${w}x${h}.png`); await p.close(); return r;
});
// Zoom del navegador: 125 / 150 / 200 % equivalen a un viewport CSS más pequeño con más píxeles por píxel CSS.
const ZOOM_BASE = [[1920, 1080], [1747, 860], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [768, 1024], [390, 844]];
for (const z of [1.25, 1.5, 2]) for (const [w, h] of ZOOM_BASE) await test(`8z · bienvenida ${w}×${h} a zoom ${z * 100} % (${Math.round(w / z)}×${Math.round(h / z)} px CSS): composición sin cortes y botón alcanzable`, async () => {
  const p = await open(Math.round(w / z), Math.round(h / z), { dsf: z, clear: false }); await sleep(1300);
  const r = await measureWelcome(p); checkWelcome(r, `${w}×${h}@${z * 100}%`); await shot(p, `bienvenida-${w}x${h}-zoom${z * 100}.png`); await p.close();
  return { vp: `${r.vw}x${r.vh}`, dosCol: r.two, tituloPx: +r.titlePx.toFixed(1), mascotaH: Math.round(r.img.h), scroll: r.vScroll };
});
// Escala de fuente del sistema/navegador (tamaño de letra mayor): el texto crece, nada esencial se recorta y todo sigue alcanzable.
for (const f of [1.25, 1.5, 2]) for (const [w, h] of [[1440, 900], [1280, 720], [1024, 768], [390, 844], [320, 568]]) await test(`8f · bienvenida ${w}×${h} con letra al ${f * 100} %: sin cortes y botón alcanzable`, async () => {
  const p = await open(w, h, { mobile: w < 800, clear: false, pre: [`document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.fontSize='${f * 100}%'})`] }); await sleep(1300);
  assert.equal(await p.evaluate(`getComputedStyle(document.documentElement).fontSize`), `${16 * f}px`, 'la escala de letra no se aplicó');
  const r = await measureWelcome(p); checkWelcome(r, `${w}×${h} letra ${f * 100}%`, { maxTitle: 3.1 * 16 * f }); await shot(p, `bienvenida-${w}x${h}-letra${f * 100}.png`); await p.close();
  return { dosCol: r.two, tituloPx: +r.titlePx.toFixed(1), mascotaH: Math.round(r.img.h), scroll: r.vScroll };
});


// ───────── 9. Tras entrar: el simulador sigue intacto ─────────
await test('9 · tras entrar, el simulador funciona (pistas, editor, canvas) en escritorio, tablet y móvil sin desborde', async () => {
  const out = {};
  for (const [w, h, m] of [[1440, 900, 0], [1024, 768, 0], [768, 1024, 1], [375, 667, 1]]) {
    const p = await open(w, h, { mobile: !!m }); await click(p, 'welcomeEnter'); await sleep(600);
    await p.evaluate(`(()=>{const s=document.getElementById('track');s.value='s02';s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(500);
    const r = await p.evaluate(`({file:document.getElementById('fileName').textContent,stage:document.getElementById('stageLabel').textContent,code:document.getElementById('src').value.split('\\n')[0],canvas:(()=>{const c=document.getElementById('scene').getBoundingClientRect();return c.width>200&&c.height>150})(),hOver:document.documentElement.scrollWidth>innerWidth,anims:document.getAnimations().filter(a=>/^w-/.test(a.animationName||'')).length})`);
    assert.equal(r.file, 'programa_s02.ino'); assert.equal(r.stage, 'S02'); assert.ok(r.canvas, 'canvas con tamaño'); assert.equal(r.hOver, false); assert.equal(r.anims, 0);
    assert.match(r.code, /^\/\/ IROH Simulator · S02 · /, 'el starter nuevo dice IROH Simulator'); out[`${w}x${h}`] = r.file;
    await shot(p, `simulador-${w}x${h}.png`); await p.close();
  } return out;
});
await test('10 · transición: entrada y salida suceden sin saltos de maquetación (CLS) y sin errores', async () => {
  const p = await open(1440, 900);
  const cls = await p.evaluate(`new Promise(res=>{let c=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)c+=e.value}).observe({type:'layout-shift',buffered:true});setTimeout(()=>res(+c.toFixed(4)),500)})`);
  assert.ok(cls < 0.02, 'CLS ' + cls); await click(p, 'welcomeEnter'); await sleep(110); await shot(p, 'transicion-salida.png'); await sleep(500);
  assert.equal((await state(p)).open, false); await p.close(); return { cls };
});

// ───────── 11–13. Cabecera ─────────
const HEAD = [[1440, 900, 0], [1024, 768, 0], [820, 1180, 1], [768, 1024, 1], [600, 900, 1], [480, 800, 1], [390, 844, 1], [375, 667, 1], [320, 568, 1]];
for (const [w, h, m] of HEAD) await test(`11 · cabecera ${w}×${h}: marca completa, accesos correctos, sin desborde ni objetivos pequeños`, async () => {
  const p = await open(w, h, { mobile: !!m, seen: true });
  const r = await p.evaluate(`(()=>{const tb=document.querySelector('.topbar'),b=document.querySelector('.brand'),st=b.querySelector('strong'),sm=b.querySelector('small'),ab=document.getElementById('aboutOpen'),img=b.querySelector('img');
    const vis=e=>getComputedStyle(e).display!=='none',rc=e=>e.getBoundingClientRect(),lab=ab.querySelector('.topbar-label');
    return {h:Math.round(rc(tb).height),nombre:st.textContent,partes:[...st.childNodes].map(n=>n.nodeType===3?n.textContent.trim():n.tagName+':'+getComputedStyle(n).fontWeight),strongWeight:getComputedStyle(st).fontWeight,
      translateStrong:st.getAttribute('translate'),brandAttrs:[...b.attributes].map(a=>a.name),links:document.querySelectorAll('.topbar a').length,imgW:Math.round(rc(img).width),imgOk:img.complete&&img.naturalWidth>0,
      brandTrunc:b.scrollWidth>b.clientWidth+1,sub:vis(sm)?sm.textContent:null,nButtons:tb.querySelectorAll('button').length,noWelcome:!document.getElementById('welcomeReopen')&&!/bienvenida/i.test(tb.textContent),aboutW:Math.round(rc(ab).width),aboutH:Math.round(rc(ab).height),aboutRight:Math.round(rc(ab).right),aboutLeft:Math.round(rc(ab).left),brandRight:Math.round(rc(b).right),
      vw:innerWidth,labelClip:getComputedStyle(lab).position==='absolute',aboutName:ab.textContent.trim(),hOver:document.documentElement.scrollWidth>innerWidth}})()`);
  assert.equal(r.h, 56); assert.equal(r.nombre, 'IROH Simulator'); assert.deepEqual(r.partes, ['IROH', 'SPAN:400']); assert.equal(r.strongWeight, '600');
  assert.equal(r.translateStrong, 'no'); assert.deepEqual(r.brandAttrs, ['class'], 'la marca solo lleva class'); assert.equal(r.links, 0, 'la cabecera no tiene enlaces'); assert.equal(r.imgW, 34); assert.ok(r.imgOk, 'isotipo no cargó');
  assert.equal(r.brandTrunc, false); assert.equal(r.hOver, false); assert.equal(r.nButtons, 1, 'la cabecera solo tiene «Acerca de»'); assert.equal(r.noWelcome, true, '«Bienvenida» no existe en la cabecera a ningún ancho'); assert.equal(r.sub, w >= 768 ? 'Simulador libre' : null, 'subtítulo');
  assert.ok(r.aboutRight <= r.vw - 8, '«Acerca de» pegado al borde'); assert.ok(r.brandRight + 8 <= r.aboutLeft, 'la marca y «Acerca de» se pisan');
  if (m) assert.ok(r.aboutH >= 44 && r.aboutW >= 44, `objetivo táctil ${r.aboutW}×${r.aboutH}`);
  assert.equal(r.aboutName, 'Acerca de'); assert.equal(r.labelClip, w <= 479, 'etiqueta recortada (solo icono) únicamente ≤ 479 px');
  await shot(p, `cabecera-${w}x${h}.png`); await p.close(); return r;
});
await test('12 · orden de Tab tras la bienvenida: enlace de salto → Acerca de → barra del simulador', async () => {
  const p = await open(1440, 900, { seen: true }); const ids = [];
  for (let i = 0; i < 5; i++) { await key(p, 'Tab', 'Tab', 9); ids.push(await p.evaluate(`document.activeElement.id||document.activeElement.className||document.activeElement.tagName`)); }
  assert.equal(ids[0], 'skip-link'); assert.equal(ids[1], 'aboutOpen'); assert.equal(ids[2], 'track', 'tras la cabecera sigue la barra del simulador: ' + ids); await p.close(); return ids;
});

// ───────── 14–17. «Acerca de» ─────────
await test('13 · «Acerca de»: identifica a nulljinx, se cierra con Esc / X / Cerrar, atrapa el foco y lo devuelve', async () => {
  const p = await open(1440, 900, { seen: true });
  await p.evaluate(`document.getElementById('aboutOpen').focus()`); await key(p, 'Enter', 'Enter', 13, 0, '\r'); await sleep(250);
  const r = await p.evaluate(`(()=>{const d=document.getElementById('aboutDialog'),a=d.querySelector('a');return {open:d.open,modal:d.matches(':modal'),foco:document.activeElement.id,titulo:d.querySelector('h2').textContent,href:a.href,target:a.target,rel:a.rel,nombre:a.textContent.trim(),labelled:!!document.getElementById(d.getAttribute('aria-labelledby')),described:!!document.getElementById(d.getAttribute('aria-describedby')),filas:[...d.querySelectorAll('dt')].map(x=>x.textContent)}})()`);
  assert.equal(r.open, true); assert.equal(r.modal, true); assert.equal(r.foco, 'aboutDone'); assert.equal(r.titulo, 'Acerca de IROH Simulator'); assert.equal(r.href, 'https://nulljinx.com/');
  assert.equal(r.target, '_blank'); assert.ok(/noopener/.test(r.rel) && /noreferrer/.test(r.rel)); assert.ok(r.nombre.startsWith('nulljinx') && r.nombre.includes('pestaña nueva')); assert.ok(r.labelled && r.described);
  await key(p, 'Escape', 'Escape', 27); await sleep(250); let s = await p.evaluate(`({o:document.getElementById('aboutDialog').open,f:document.activeElement.id})`); assert.equal(s.o, false); assert.equal(s.f, 'aboutOpen');
  for (const id of ['aboutClose', 'aboutDone']) { await click(p, 'aboutOpen'); await sleep(150); await click(p, id); await sleep(150); s = await p.evaluate(`({o:document.getElementById('aboutDialog').open,f:document.activeElement.id})`); assert.equal(s.o, false); assert.equal(s.f, 'aboutOpen'); }
  await click(p, 'aboutOpen'); await sleep(150); const seen = new Set();
  for (let i = 0; i < 7; i++) { await key(p, 'Tab', 'Tab', 9); seen.add(await p.evaluate(`(document.activeElement.closest('#aboutDialog')?'':'FUERA:')+(document.activeElement.id||document.activeElement.tagName)`)); }
  assert.ok(![...seen].some((x) => x.startsWith('FUERA') && x !== 'FUERA:BODY'), 'el foco salió: ' + [...seen]);
  await p.close(); return { ...r, foco: [...seen] };
});
for (const [w, h, m] of [[1440, 900, 0], [768, 1024, 1], [375, 667, 1], [320, 568, 1], [667, 375, 1]]) await test(`14 · «Acerca de» ${w}×${h}: cabe en pantalla, botones siempre visibles y táctiles`, async () => {
  const p = await open(w, h, { mobile: !!m, seen: true }); await click(p, 'aboutOpen'); await sleep(300);
  const r = await p.evaluate(`(()=>{const d=document.getElementById('aboutDialog'),rc=d.getBoundingClientRect(),dn=document.getElementById('aboutDone').getBoundingClientRect(),bs=[...d.querySelectorAll('button,a')].map(b=>Math.round(b.getBoundingClientRect().height));return {top:Math.round(rc.top),bottom:Math.round(rc.bottom),left:Math.round(rc.left),right:Math.round(rc.right),vw:innerWidth,vh:innerHeight,hOver:d.scrollWidth>d.clientWidth+1,minAlto:Math.min(...bs),doneTop:Math.round(dn.top),doneBottom:Math.round(dn.bottom)}})()`);
  assert.ok(r.left >= 0 && r.right <= r.vw && r.top >= 0 && r.bottom <= r.vh, 'diálogo fuera de pantalla'); assert.equal(r.hOver, false);
  assert.ok(r.doneTop >= r.top && r.doneBottom <= r.vh, `el botón «Cerrar» no está a la vista (${r.doneTop}-${r.doneBottom} de ${r.vh})`);
  if (m) assert.ok(r.minAlto >= 44, 'botón táctil < 44 px: ' + r.minAlto);
  await shot(p, `acerca-de-${w}x${h}.png`); await p.close(); return r;
});
await test('15 · de «Acerca de» a la bienvenida y de vuelta: el foco regresa al origen', async () => {
  const p = await open(1440, 900, { seen: true }); await click(p, 'aboutOpen'); await sleep(200); await click(p, 'aboutWelcome'); await sleep(350);
  const a = await p.evaluate(`({about:document.getElementById('aboutDialog').open,welcome:document.getElementById('welcome').open,foco:document.activeElement.id})`);
  assert.equal(a.about, false); assert.equal(a.welcome, true); assert.equal(a.foco, 'welcomeEnter');
  await key(p, 'Escape', 'Escape', 27); await sleep(600); const b = await p.evaluate(`({welcome:document.getElementById('welcome').open,foco:document.activeElement.id})`);
  assert.equal(b.welcome, false); assert.equal(b.foco, 'aboutOpen'); await p.close(); return { abre: a, cierra: b };
});

// ───────── 16. Crédito nulljinx en la bienvenida ─────────
await test('16 · pie «Desarrollado por nulljinx»: texto exacto, enlace seguro, accesible por Tab con anillo visible', async () => {
  const p = await open(1440, 900);
  const r = await p.evaluate(`(()=>{const c=document.querySelector('.welcome__credit'),a=c.querySelector('a'),k=c.cloneNode(true);k.querySelectorAll('.sr-only').forEach(n=>n.remove());const rect=a.getBoundingClientRect(),cta=document.getElementById('welcomeEnter').getBoundingClientRect();
    return {texto:k.textContent.trim(),href:a.href,target:a.target,rel:a.rel,nombre:a.textContent,orden:[...document.querySelectorAll('#welcome button,#welcome a[href]')].map(e=>e.id||e.tagName),dist:Math.round(rect.top-cta.bottom),sub:getComputedStyle(a).textDecorationLine,translate:a.getAttribute('translate')}})()`);
  assert.equal(r.texto, 'Desarrollado por nulljinx'); assert.equal(r.href, 'https://nulljinx.com/'); assert.equal(r.target, '_blank'); assert.ok(/noopener/.test(r.rel) && /noreferrer/.test(r.rel)); assert.ok(r.nombre.includes('pestaña nueva'));
  assert.deepEqual(r.orden, ['welcomeClose', 'welcomeEnter', 'A']); assert.ok(r.dist >= 40, 'enlace demasiado cerca del botón principal: ' + r.dist); assert.equal(r.sub, 'underline');
  for (let i = 0; i < 6 && (await p.evaluate('document.activeElement.tagName')) !== 'A'; i++) await key(p, 'Tab', 'Tab', 9);
  const f = await p.evaluate(`(()=>{const a=document.activeElement;return {es:a.tagName,ring:getComputedStyle(a).outlineStyle+' '+getComputedStyle(a).outlineWidth,dentro:!!a.closest('#welcome')}})()`);
  assert.equal(f.es, 'A'); assert.equal(f.ring, 'solid 3px'); assert.ok(f.dentro); assert.equal((await state(p)).open, true, 'enfocar el enlace no cierra la bienvenida'); await p.close(); return r;
});
for (const [w, h, m] of [[1440, 900, 0], [1024, 768, 0], [768, 1024, 1], [820, 1180, 1]]) await test(`17 · crédito nulljinx ${w}×${h}: visible, objetivo táctil y sin desplazamiento`, async () => {
  const p = await open(w, h, { mobile: !!m }); await sleep(1100);
  const r = await p.evaluate(`(()=>{const a=document.querySelector('.welcome__credit a').getBoundingClientRect(),d=document.getElementById('welcome');return {top:Math.round(a.top),bottom:Math.round(a.bottom),alto:Math.round(a.height),vScroll:d.scrollHeight>d.clientHeight+1,vh:innerHeight}})()`);
  assert.ok(r.top >= 0 && r.bottom <= r.vh, 'enlace fuera de pantalla'); assert.equal(r.vScroll, false); if (m) assert.ok(r.alto >= 44, 'objetivo táctil < 44 px: ' + r.alto); await p.close(); return r;
});

// ───────── 18. Contraste (WCAG) sobre los estilos REALES ─────────
await test('18 · contraste WCAG de texto y controles, medido sobre los colores calculados (peor caso bajo el halo)', async () => {
  const p = await open(1440, 900);
  const c = await p.evaluate(`(()=>{const q=s=>document.querySelector(s),cs=(e,pr)=>getComputedStyle(e)[pr];const o=(s)=>({fg:cs(q(s),'color'),bg:cs(q(s),'backgroundColor')});
    return {title:o('#welcome-title'),desc:o('.welcome__desc'),eyebrow:o('.welcome__eyebrow'),hint:o('.welcome__hint'),credit:o('.welcome__credit'),creditLink:o('.welcome__credit a'),cta:o('#welcomeEnter'),num:o('.welcome__num'),
      brand:o('.brand strong'),brandSub:o('.brand small'),topbar:o('.topbar'),aboutBtn:o('#aboutOpen'),aboutDlg:o('#aboutDialog'),aboutLink:o('#aboutDialog a'),aboutDt:o('#aboutDialog dt'),aboutIcon:{fg:cs(q('#aboutOpen svg'),'color'),bg:cs(q('#aboutOpen'),'backgroundColor')}}})()`);
  const rgb = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = [r, g, b].map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]; };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return +((x + .05) / (y + .05)).toFixed(2); };
  const hex = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
  const stage = ['#06101F', '#0B1B32', '#062C7B'].map(hex);               // fondo marino y peor caso: azul al 42 % sobre marino
  const onStage = (fg) => Math.min(...stage.map((b) => cr(rgb(fg), b)));
  const opaque = (bg, fallback) => { const x = rgb(bg); return x.a > 0.99 ? x : rgb(fallback); };
  const topbarBg = opaque(c.topbar.bg, 'rgb(252,251,248)'), dlgBg = opaque(c.aboutDlg.bg, 'rgb(255,255,255)');
  const items = {
    'título (bienvenida)': [onStage(c.title.fg), 4.5], 'descripción': [onStage(c.desc.fg), 4.5], 'eyebrow': [onStage(c.eyebrow.fg), 4.5], 'pista «Tu código se guarda…»': [onStage(c.hint.fg), 4.5], 'crédito': [onStage(c.credit.fg), 4.5], 'enlace nulljinx': [onStage(c.creditLink.fg), 4.5],
    'botón «Entrar»': [cr(rgb(c.cta.fg), rgb(c.cta.bg)), 4.5], 'botón «Entrar» sobre el fondo (no texto)': [onStage(c.cta.bg), 3], 'número de paso': [cr(rgb(c.num.fg), rgb(c.num.bg)), 4.5],
    'cabecera: marca': [cr(rgb(c.brand.fg), topbarBg), 4.5], 'cabecera: subtítulo': [cr(rgb(c.brandSub.fg), topbarBg), 4.5], 'cabecera: «Acerca de»': [cr(rgb(c.aboutBtn.fg), opaque(c.aboutBtn.bg, 'rgb(252,251,248)')), 4.5], 'cabecera: icono (no texto)': [cr(rgb(c.aboutIcon.fg), opaque(c.aboutIcon.bg, 'rgb(252,251,248)')), 3],
    '«Acerca de»: enlace': [cr(rgb(c.aboutLink.fg), dlgBg), 4.5], '«Acerca de»: etiquetas': [cr(rgb(c.aboutDt.fg), dlgBg), 4.5],
  };
  const bad = Object.entries(items).filter(([, [v, min]]) => v < min); assert.equal(bad.length, 0, 'bajo el mínimo: ' + JSON.stringify(bad));
  await p.close(); return Object.fromEntries(Object.entries(items).map(([k, [v, min]]) => [k, `${v}:1 (mín ${min})`]));
});

// ───────── 19–20. Compatibilidad del código guardado ─────────
await test('19 · el código escrito por el estudiante se conserva al recargar y las claves guardadas no se alteran', async () => {
  const p = await open(1440, 900, { seen: true });
  const mio = '// mi programa\nvoid setup() {\n  inicializarMovimiento();\n}\nvoid loop() {\n  avanzar(30);\n}\n';
  await p.evaluate(`(()=>{const t=document.getElementById('src');t.focus();t.select()})()`); await p.send('Input.insertText', { text: mio }); await sleep(300);
  assert.equal(await p.evaluate(`document.getElementById('src').value`), mio);
  const keys = await p.evaluate(`Object.keys(localStorage).sort()`);
  const codeKey = keys.find((k) => /^bitiro:standalone:code:s01$/.test(k)); assert.ok(codeKey, 'el simulador sigue guardando bajo bitiro:standalone:code:<pista>: ' + keys);
  assert.equal(await p.evaluate(`localStorage.getItem(${JSON.stringify(codeKey)})`), mio, 'el valor guardado es exactamente lo escrito');
  const allowed = [/^bitiro:standalone:code:[a-z0-9]+$/, /^bitiro:standalone:scenario:v1:[a-z0-9]+$/, /^bitiro:line-calibration:v1$/];   // NINGUNA clave de bienvenida en localStorage (ni la antigua ni la nueva)
  for (const k of keys) assert.ok(allowed.some((re) => re.test(k)), 'clave inesperada en localStorage: ' + k);
  assert.deepEqual(await p.evaluate(`Object.keys(sessionStorage).sort()`), [WELCOME_KEY], 'sessionStorage solo contiene la clave de la bienvenida');
  await goto(p, URL_); assert.equal(await p.evaluate(`document.getElementById('src').value`), mio, 'tras recargar el editor muestra el mismo código');
  assert.equal(await p.evaluate(`localStorage.getItem(${JSON.stringify(codeKey)})`), mio); await p.close(); return { claves: keys };
});
await test('20 · un starter ANTIGUO guardado («// BITIRO Simulador · …») se muestra idéntico y «Restaurar código inicial» no pide confirmación', async () => {
  const viejo = STARTERS.legacyStarter('s01'), nuevo = STARTERS.starter('s01');
  assert.ok(viejo.startsWith('// BITIRO Simulador · S01') && nuevo.startsWith('// IROH Simulator · S01'));
  const p = await open(1440, 900, { seen: true, pre: [`try{localStorage.setItem('bitiro:standalone:code:s01',${JSON.stringify(viejo)})}catch(e){}`] });
  assert.equal(await p.evaluate(`document.getElementById('src').value`), viejo, 'el editor debe mostrar el starter antiguo carácter por carácter');
  assert.equal(await p.evaluate(`localStorage.getItem('bitiro:standalone:code:s01')`), viejo, 'cargar la página no reescribe lo guardado');
  await click(p, 'restoreStarter'); await sleep(300);
  assert.equal(await p.evaluate(`document.getElementById('restoreDialog').open`), false, 'el starter antiguo cuenta como «sin modificar»: no debe pedir confirmación');
  assert.equal(await p.evaluate(`document.getElementById('src').value`), nuevo, 'restaurar aplica el starter nuevo');
  await p.close();
  // contraprueba: si el alumno cambió UN carácter, sí pide confirmación y no pierde nada al cancelar
  const editado = viejo.replace('Simulador', 'Simulado');
  const q = await open(1440, 900, { seen: true, pre: [`try{localStorage.setItem('bitiro:standalone:code:s01',${JSON.stringify(editado)})}catch(e){}`] });
  assert.equal(await q.evaluate(`document.getElementById('src').value`), editado);
  await click(q, 'restoreStarter'); await sleep(300); assert.equal(await q.evaluate(`document.getElementById('restoreDialog').open`), true, 'con un carácter distinto debe pedir confirmación');
  await click(q, 'restoreCancel'); await sleep(200); assert.equal(await q.evaluate(`document.getElementById('src').value`), editado, 'cancelar conserva el código');
  assert.equal(await q.evaluate(`localStorage.getItem('bitiro:standalone:code:s01')`), editado); await q.close();
});

// ───────── 21. Consola limpia y CSP ─────────
await test('21 · sin violaciones de CSP, errores de consola ni excepciones en TODO el recorrido', async () => {
  const csp = logs.filter((l) => /Content Security Policy|Refused/i.test(l)); assert.equal(csp.length, 0, 'violaciones de CSP: ' + csp.join(' | '));
  const noise = logs.filter((l) => !/Failed to load resource.*(favicon)/i.test(l)); assert.equal(noise.length, 0, 'errores de consola: ' + noise.slice(0, 4).join(' | '));
  return 'sin errores';
});

await browser.close(); server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones de navegador de la identidad IROH Simulator correctas${failed.length ? ' · FALLAN: ' + failed.map((f) => f.name.split(' · ')[0]).join(', ') : ''}`);
process.exit(failed.length ? 1 : 0);
