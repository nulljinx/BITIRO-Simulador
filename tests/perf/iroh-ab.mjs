#!/usr/bin/env node
// SIM-3D-INTEGRATION-2 — A/B de rendimiento legacy vs iroh-v1 en la MISMA máquina, sesión y proceso de Chrome (reutiliza cdp.mjs).
//   node --experimental-websocket tests/perf/iroh-ab.mjs [--window 20] [--reps 2] [--warmup 3] [--out archivo.json]
// Robot quieto en S01 (sin programa), misma pista y cámara; pestaña nueva por corrida; orden alternado por repetición (legacy,iroh / iroh,legacy).
// Mide: FPS, p50/p95/p99 de frame, % de hilo principal (Performance.getMetrics TaskDuration), long tasks, startup, RSS del renderer.
// Los números absolutos NO son comparables con SIM-LOW-END-1 (otro entorno); importa el DELTA A/B.
// Synthetic CPU throttling is not a substitute for validation on actual school hardware.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newPage } from './cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const WINDOW_S = Number(arg('window', 20)), REPS = Number(arg('reps', 2)), WARM_S = Number(arg('warmup', 3));
const OUT = arg('out', path.join(ROOT, 'tests/perf/results/iroh-ab.json'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'content-security-policy': CSP, 'cache-control': 'max-age=3600', 'x-content-type-options': 'nosniff' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch({ port: 9374 });

const INIT = `(()=>{const T=[],P=window.__p={lt:[],ready:null};
 const tick=t=>{T.push(t);if(P.ready===null&&typeof frameCounter!=='undefined'&&frameCounter>=2)P.ready=performance.now();requestAnimationFrame(tick)};requestAnimationFrame(tick);
 try{new PerformanceObserver(l=>{for(const e of l.getEntries())P.lt.push(e.duration)}).observe({type:'longtask',buffered:true})}catch{}
 P.n=()=>T.length;P.slice=a=>T.slice(a);})()`;
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const rss = async (page) => { try { const { processInfo } = await browser.send('SystemInfo.getProcessInfo'); const r = processInfo.filter((p) => p.type === 'renderer'); const kb = (pid) => Number(fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]) / 1024; return Math.max(...r.map((p) => kb(p.id))); } catch { return null; } };

async function run({ model, mode, rate, camera }) {
  const page = await newPage(browser);
  try {
    await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Performance.enable');
    const errs = []; page.on('Runtime.exceptionThrown', (p) => errs.push(p.exceptionDetails.text));
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await page.send('Emulation.setCPUThrottlingRate', { rate });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT });
    const loaded = new Promise((r) => page.on('Page.loadEventFired', r));
    await page.send('Page.navigate', { url: BASE + (model === 'iroh' ? '?robot=iroh' : '') }); await loaded;
    for (let i = 0; i < 300 && (await page.evaluate('window.__p.ready')) === null; i++) await sleep(100);
    const nav = await page.evaluate('(()=>{const n=performance.getEntriesByType("navigation")[0];return {dcl:n.domContentLoadedEventEnd,load:n.loadEventEnd,ready:window.__p.ready,res:performance.getEntriesByType("resource").filter(r=>/iroh/.test(r.name)).map(r=>[r.name.split("/").pop(),r.transferSize,r.encodedBodySize,r.duration])}})()');
    if (camera) await page.evaluate(`document.querySelector('.cam[data-view="${camera}"]').click()`);
    if (mode === 'calibration') await page.evaluate("document.getElementById('calibrationMode').click()");
    await sleep(WARM_S * 1000);
    const stats = await page.evaluate('BITIRO_RENDER_STATS');
    const m0 = Object.fromEntries((await page.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const a = await page.evaluate('window.__p.n()'), lt0 = await page.evaluate('window.__p.lt.length');
    await sleep(WINDOW_S * 1000);
    const m1 = Object.fromEntries((await page.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const t = await page.evaluate(`window.__p.slice(${a})`), lt = (await page.evaluate('window.__p.lt')).slice(lt0);
    const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
    const wall = m1.Timestamp - m0.Timestamp;
    return { model, mode, rate, camera: camera || 'perspective', fps: ((t.length - 1) / (t[t.length - 1] - t[0])) * 1000, p50: pct(d, .5), p95: pct(d, .95), p99: pct(d, .99), max: Math.max(...d),
      mainThreadPct: 100 * (m1.TaskDuration - m0.TaskDuration) / wall, scriptPct: 100 * (m1.ScriptDuration - m0.ScriptDuration) / wall, longTasks: lt.length, longTaskMs: lt.reduce((s, x) => s + x, 0),
      rssMB: await rss(page), startup: { dcl: nav.dcl, load: nav.load, ready: nav.ready }, assets: nav.res, robotFaces: stats.robotFaces, errors: errs.length };
  } finally { await page.close(); }
}

const plan = [];
for (const mode of ['normal', 'calibration']) for (const rate of [1, 4]) plan.push({ mode, rate });
plan.push({ mode: 'normal', rate: 4, camera: 'robot' }, { mode: 'normal', rate: 1, camera: 'robot' });
const results = [];
for (const cell of plan) for (let rep = 0; rep < REPS; rep++) {
  for (const model of rep % 2 ? ['iroh', 'legacy'] : ['legacy', 'iroh']) {
    const r = { ...(await run({ model, ...cell })), rep: rep + 1 }; results.push(r);
    console.log(`${cell.mode.padEnd(11)} ${(cell.camera || 'persp').padEnd(6)} ${cell.rate === 1 ? 'P0' : 'P1'} ${model.padEnd(6)} rep${rep + 1} fps ${r.fps.toFixed(1)} p95 ${r.p95.toFixed(1)} p99 ${r.p99.toFixed(1)} main ${r.mainThreadPct.toFixed(1)}% LT ${r.longTasks} faces ${r.robotFaces} rss ${r.rssMB?.toFixed(0)}MB`);
    await sleep(1500);
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ chrome: browser.version?.Browser, node: process.version, windowS: WINDOW_S, reps: REPS, results }, null, 1));
await browser.close(); server.close();
