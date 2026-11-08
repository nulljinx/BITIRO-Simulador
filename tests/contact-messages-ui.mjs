#!/usr/bin/env node
// Avisos de contacto en la INTERFAZ REAL (Playwright + Chromium): ¿se retira el mensaje obsoleto y se conserva el vigente?
//   SERVE_ROOT=<carpeta con el simulador> LABEL=antes|despues OUT_DIR=<salida> [CASE=a,b] node tests/contact-messages-ui.mjs
//   «antes»   = copia pristina de la base b06052b (git archive b06052b, sin la mejora); «despues» = este árbol de trabajo. Mismos casos, mismo programa, mismas capturas.
// Registra CADA cambio de #feedback (MutationObserver) con su tiempo simulado, los episodios de contacto del robot (inicio/fin) y el estado de la interfaz 1,5 s después de terminar un contacto.
// Servidor local de solo lectura con la CSP del proyecto; no toca producción. Playwright: PLAYWRIGHT_MODULE o caché de npx; CHROME_BIN opcional.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(process.env.SERVE_ROOT || HERE);
const LABEL = process.env.LABEL || 'despues';
const OUT = path.resolve(HERE, process.env.OUT_DIR || path.join(os.tmpdir(), 'contact-messages-ui'));
fs.mkdirSync(OUT, { recursive: true });
const require_ = createRequire(import.meta.url);
const base = path.join(os.homedir(), '.npm/_npx');
const cands = [process.env.PLAYWRIGHT_MODULE, 'playwright', ...(fs.existsSync(base) ? fs.readdirSync(base).map((d) => path.join(base, d, 'node_modules/playwright')) : [])].filter(Boolean);
let chromium; for (const c of cands) { try { ({ chromium } = require_(c)); break; } catch { /* siguiente */ } }
if (!chromium) { console.log('SKIP · no hay el módulo playwright'); process.exit(0); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
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
const opts = { headless: true, args: ['--no-sandbox'] }; if (process.env.CHROME_BIN) opts.executablePath = process.env.CHROME_BIN;
const browser = await chromium.launch(opts);

const FOLLOW = `    bool i = lineaIzquierda();
    bool c = lineaCentral();
    bool d = lineaDerecha();
    if (c) { avanzar(30); }
    else if (i) { avanzar(10, 30); }
    else if (d) { avanzar(30, 10); }
    else { avanzar(25); }
`;
const sweepProgram = (T, recover) => `#include <KnightRoboticsLibs_Iroh.h>
int golpeado = 0;
int atascado = 0;
int recuperado = 0;
void setup() {
  inicializarMovimiento();
  inicializarSensores();
  inicializarGolpe();
  moverServoGolpe(-1);
  pausa(900);
}
void loop() {
  int dist = leerDistanciaSonar();
  if (golpeado == 0 && dist <= ${T}) {
    detenerse();
    moverServoGolpe(1);
    pausa(900);
    moverServoGolpe(0);
    pausa(700);
    golpeado = 1;
  } else {
${recover ? `    if (golpeado == 1 && recuperado == 0 && dist <= ${T}) { atascado = atascado + 1; } else { atascado = 0; }
    if (atascado > 1200) {
      retroceder(30);
      pausa(900);
      girarDerecha(30);
      pausa(700);
      detenerse();
      pausa(200);
      recuperado = 1;
    }
` : ''}${FOLLOW}  }
}
`;
const TURN = `#include <KnightRoboticsLibs_Iroh.h>
void setup() {
  inicializarMovimiento();
}
void loop() {
  avanzar(30);
  pausa(4300);
  detenerse();
  pausa(400);
  girarIzquierda(40);
  pausa(2500);
  retroceder(30);
  pausa(3500);
  detenerse();
  pausa(30000);
}
`;
const CASES = [
  { id: 's01-10cm', desc: 'S01 · barrido al leer ≤ 10 cm: la caja se despeja', code: sweepProgram(10, false), secs: 20 },
  { id: 's01-12cm', desc: 'S01 · barrido al leer ≤ 12 cm: la caja se mueve ≈ 1 cm y queda en el camino; el robot la empuja hasta el borde y se detiene', code: sweepProgram(12, false), secs: 40 },
  { id: 'retroceso', desc: 'S01 · igual que 12 cm, y tras la detención el programa retrocede y gira (órdenes válidas): el contacto termina', code: sweepProgram(12, true), secs: 60 },
  { id: 'giro-en-contacto', desc: 'S01 con una caja colocada por el usuario en (40, 80): el robot avanza con la garra al centro, se detiene con la punta junto a la caja, intenta girar a la izquierda (la garra la toca) y luego retrocede', code: TURN, secs: 16, scenario: [{ id: 'user-box-1', x: 40, y: 80, movable: true }] },
];

const INSTRUMENT = `(()=>{const w=window;w.__m={cambios:[],episodios:[],abierto:null,pendienteFoto:null};
 const fb=document.getElementById('feedback');
 new MutationObserver(()=>{__m.cambios.push({simTime:+simTime.toFixed(2),texto:fb.textContent});}).observe(fb,{childList:true,characterData:true,subtree:true});
 const u=w.update;w.update=function(dt){const r=u.apply(this,arguments);try{
   if(wasContact&&!__m.abierto){__m.abierto={inicio:+simTime.toFixed(2),fin:null,texto:fb.textContent};__m.episodios.push(__m.abierto);}
   if(!wasContact&&__m.abierto){__m.abierto.fin=+simTime.toFixed(2);__m.abierto=null;}
   for(const e of __m.episodios)if(e.fin!==null&&e.fin-e.inicio>=0.5&&!e.tras&&simTime>=e.fin+1.5){e.tras={simTime:+simTime.toFixed(2),texto:fb.textContent,enContacto:wasContact,bloqueoGarra:!!striker.blocked,pose:[+R.x.toFixed(1),+R.y.toFixed(1)]};__m.pendienteFoto=e.tras.simTime;}
  }catch(e){__m.error=String(e);}return r;};})()`;

async function runCase(c) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
  const problems = { js: [], console: [], requestFailed: [], bad: [], csp: [] };
  page.on('pageerror', (e) => problems.js.push(String(e.message || e).split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error') problems.console.push(m.text()); });
  page.on('requestfailed', (r) => problems.requestFailed.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) problems.bad.push(r.status() + ' ' + r.url()); });
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  if (c.scenario) await page.addInitScript((j) => { try { localStorage.setItem('bitiro:standalone:scenario:v1:s01', j); } catch { /* sin almacenamiento */ } }, JSON.stringify(c.scenario));
  await page.goto(URL_); await sleep(700);
  const ev = (e) => page.evaluate(e);
  await page.evaluate(() => { const s = document.getElementById('track'); s.value = 's01'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(500);
  await page.evaluate((code) => { const s = document.getElementById('src'); s.value = code; s.dispatchEvent(new Event('input', { bubbles: true })); }, c.code);
  await page.evaluate(() => { const s = document.getElementById('speed'); s.value = '4'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await ev(INSTRUMENT);
  await page.screenshot({ path: path.join(OUT, `${LABEL}-${c.id}-1-inicio.png`) });
  await page.evaluate(() => document.getElementById('run').click());
  const t0 = Date.now(); let shotBlock = false, shotSummary = false, shotAfter = false;
  while (Date.now() - t0 < 120000) {
    await sleep(120);
    const s = await ev(`({t:simTime,fb:document.getElementById('feedback').textContent,pend:__m.pendienteFoto,mode})`);
    if (!shotSummary && /de su posición inicial/.test(s.fb)) { shotSummary = true; await page.screenshot({ path: path.join(OUT, `${LABEL}-${c.id}-2-resumen-del-barrido.png`) }); }
    if (!shotBlock && /no tiene espacio|durante un giro|Contacto con un obstáculo/.test(s.fb)) { shotBlock = true; await page.screenshot({ path: path.join(OUT, `${LABEL}-${c.id}-3-contacto.png`) }); }
    if (!shotAfter && s.pend !== null) { shotAfter = true; await page.screenshot({ path: path.join(OUT, `${LABEL}-${c.id}-4-1.5s-despues-del-contacto.png`) }); }
    if (s.t >= c.secs || (s.mode === 'idle' && s.t > 3)) break;
  }
  await page.screenshot({ path: path.join(OUT, `${LABEL}-${c.id}-5-final.png`) });
  const m = await ev('window.__m');
  const fin = await ev(`({fb:document.getElementById('feedback').textContent,enContacto:wasContact,bloqueoGarra:!!striker.blocked,col:collisionCount,mov:movedCount,caja:[activeObstacles[0].x,activeObstacles[0].y]})`);
  const cambios = m.cambios.filter((x, i, a) => i === 0 || a[i - 1].texto !== x.texto);
  const largos = m.episodios.filter((e) => (e.fin ?? 1e9) - e.inicio >= 0.5 || e.fin === null);
  const res = { arbol: LABEL, caso: c.id, descripcion: c.desc, mensajes: cambios, episodiosDeContacto: m.episodios, tras1_5sDelUltimoContacto: [...m.episodios].reverse().find((e) => e.tras)?.tras || null, final: fin, problemas: { ...problems, csp: await ev('window.__csp') } };
  fs.writeFileSync(path.join(OUT, `${LABEL}-${c.id}.json`), JSON.stringify(res, null, 1));
  await ctx.close(); return res;
}
const only = process.env.CASE ? process.env.CASE.split(',') : null;
for (const c of CASES.filter((x) => !only || only.includes(x.id))) {
  const r = await runCase(c);
  console.log(`[${LABEL}] ${c.id}: ${r.mensajes.length} mensajes · ${r.tras1_5sDelUltimoContacto ? `1,5 s tras terminar el contacto: «${r.tras1_5sDelUltimoContacto.texto}» (enContacto=${r.tras1_5sDelUltimoContacto.enContacto}, bloqueoGarra=${r.tras1_5sDelUltimoContacto.bloqueoGarra})` : 'el contacto no terminó'} · final: «${r.final.fb}» · errores JS ${r.problemas.js.length}, CSP ${r.problemas.csp.length}`);
}
await browser.close(); server.close();
