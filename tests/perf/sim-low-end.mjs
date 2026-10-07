#!/usr/bin/env node
// SIM-LOW-END-1 — baseline de rendimiento en cliente (CPU/render/runtime/editor), con throttling sintético de CPU vía CDP.
// No modifica el producto: la instrumentación se inyecta con Page.addScriptToEvaluateOnNewDocument y Runtime.evaluate.
// Sirve la raíz del repo con un servidor estático local (sin red/CDN) y la misma CSP que producción.
//   node tests/perf/sim-low-end.mjs [--profiles p0,p1,p2] [--scenarios idle,simple,complex,props,editor] [--reps 3]
//        [--window 60] [--idle-window 30] [--warmup 5] [--cooldown 5] [--headed] [--long 300] [--out archivo.json]
// Synthetic CPU throttling is not a substitute for validation on actual school hardware.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newPage } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : (process.argv[i + 1]?.startsWith('--') || i + 1 >= process.argv.length ? true : process.argv[i + 1]); };
const PROFILES = { p0: { name: 'P0 BASELINE', rate: 1 }, p1: { name: 'P1 SCHOOL-LOW', rate: 4 }, p2: { name: 'P2 STRESS', rate: 6 } };
const profiles = String(arg('profiles', 'p0,p1,p2')).split(',');
const scenarios = String(arg('scenarios', 'idle,simple,complex,props,editor')).split(',');
const REPS = Number(arg('reps', 3));
const WINDOW_S = Number(arg('window', 60));
const IDLE_WINDOW_S = Number(arg('idle-window', 30));
const WARMUP_S = Number(arg('warmup', 5));
const COOLDOWN_S = Number(arg('cooldown', 5));
const HEADED = arg('headed', false) === true;
const LONG_S = Number(arg('long', 0));
const CPU_PROFILE_S = Number(arg('cpu-profile', 10));   // perfil de muestreo (solo repetición 1, tras la ventana medida); 0 = desactivado
const VIEWPORT = { width: 1366, height: 768 };
// Los timestamps de rAF caen en múltiplos de vsync (16,67 ms): 2 vsyncs = 33,3–33,4 ms y 3 = 50,0–50,1 ms. TOL se aplica SOLO a los contadores
// de frames excedidos (>33,3 / >50 / >100 ms) para que un frame de exactamente 2/3/6 vsyncs no cuente como «excedido» por 0,1 ms de cuantización.
// NO se aplica a p50/p95/p99 ni a la clasificación GREEN/YELLOW/RED.
const TOL = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── servidor estático (mismos headers de seguridad que producción; caché HTTP activa para medir con red caliente) ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'content-security-policy': CSP, 'cache-control': 'max-age=3600', 'x-content-type-options': 'nosniff' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

// ── instrumentación inyectada (solo observa) ──
const INIT = `(() => {
  const CAP = 40000, K = 6, F = new Float64Array(CAP * K); let n = 0;
  const P = window.__perf = { lt: [], ltSupported: false, uiReady: null, ed: [] };
  const val = (f) => { try { return f(); } catch { return NaN; } };
  const tick = (t) => {
    if (n < CAP) { const o = n * K; F[o] = t;
      F[o + 1] = val(() => simTime); F[o + 2] = val(() => R.x); F[o + 3] = val(() => R.y); F[o + 4] = val(() => R.th);
      F[o + 5] = val(() => (mode === 'code' ? 1 : mode === 'demo' ? 2 : 0) + (paused ? 10 : 0)); n++; }
    if (P.uiReady === null && val(() => frameCounter) >= 2) P.uiReady = performance.now();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); P.ltSupported = true; } catch {}
  // Event Timing: duración = retardo de entrada + procesamiento + hasta la presentación del siguiente frame (la API solo informa eventos >= 16 ms).
  P.evt = []; P.evtSupported = false;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.evt.push([e.name, e.duration, e.processingStart - e.startTime, e.processingEnd - e.processingStart]); }).observe({ type: 'event', durationThreshold: 16 }); P.evtSupported = true; } catch {}
  P.count = () => n;
  P.slice = (a, b) => Array.from(F.subarray(a * K, (b === undefined ? n : b) * K));
})();`;

// ── fixtures existentes (no se inventan programas) ──
// SIMPLE: ejemplo legacy «seguidor con 1 sensor» (EJ[1] / BITIRO_STARTERS.legacyExamples[1]) en S02; requiere Pulsador (botonInicio()).
// COMPLEX: «S06 literal» de tests/runtime-functions.cjs (funciones propias + sonar + decisiones + seguimiento) en S02.
// PROPS: APPROACH(10) de tests/strike-audit.cjs sobre la caja de práctica de S01 (sonar + prop + física + servo de golpe).
//        El robot sale de la pista a los ~23 s de simulación: si el programa termina, se pulsa Reiniciar y Ejecutar (acción normal del alumno).
// Las combinaciones se eligieron comprobando (tests/sim1/harness.cjs) que el programa sigue activo 60 s de simulación.
const S06_CODE = `int velocidad(int distancia) {\n  if (distancia < 8) {\n    return 0;\n  }\n\n  if (distancia <= 12) {\n    return 20;\n  }\n\n  return 40;\n}\n\nvoid seguidor(int sensor, int vel, int umbral) {\n  if (sensor >= umbral) {\n    avanzar(vel);\n  } else {\n    girarDerecha(vel);\n  }\n}\n\nvoid setup() {\n  inicializarMovimiento();\n  inicializarSensores();\n}\n\nvoid loop() {\n  int d = leerDistanciaSonar();\n  seguidor(leerSensorLineaCentral(), velocidad(d), 500);\n}`;
const APPROACH10 = 'void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(600);} void loop(){if(leerDistanciaSonar()<=10){detenerse();moverServoGolpe(1);pausa(900);moverServoGolpe(0);pausa(700);}else{avanzar(30);}}';
const SCENARIOS = {
  idle: { label: 'A IDLE', track: 's01', code: null, windowS: IDLE_WINDOW_S },
  simple: { label: 'B SIMPLE-RUNTIME', track: 's02', code: 'legacy1', pulsador: true, windowS: WINDOW_S },
  complex: { label: 'C COMPLEX-RUNTIME', track: 's02', code: S06_CODE, windowS: WINDOW_S },
  props: { label: 'D PROPS/PHYSICS', track: 's01', code: APPROACH10, restart: true, windowS: WINDOW_S },
  editor: { label: 'E EDITOR', track: 's02', code: 'legacy0', windowS: 0 },
};

// ── estadística ──
const sorted = (a) => [...a].sort((x, y) => x - y);
const pct = (a, q) => { if (!a.length) return null; const s = sorted(a), i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const median = (a) => pct(a.filter((x) => x != null && Number.isFinite(x)), 0.5);
const maxOf = (a) => { const v = a.filter((x) => x != null && Number.isFinite(x)); return v.length ? Math.max(...v) : null; };

function frameStats(F, K, i0, i1) {
  const t = []; for (let i = i0; i < i1; i++) t.push(F[i * K]);
  const d = []; for (let i = 1; i < t.length; i++) d.push(t[i] - t[i - 1]);
  const dur = t.length > 1 ? t[t.length - 1] - t[0] : 0;
  const over = (ms) => (d.length ? (100 * d.filter((x) => x > ms + TOL).length) / d.length : null);
  return { frames: t.length, capture_s: dur / 1000, fps: dur ? ((t.length - 1) / dur) * 1000 : null, p50: pct(d, 0.5), p95: pct(d, 0.95), p99: pct(d, 0.99), max: d.length ? Math.max(...d) : null,
    missed60: d.length ? (100 * d.filter((x) => x > 25).length) / d.length : null, over33: over(33.3), over50: over(50), over100: over(100), t0: t[0], t1: t[t.length - 1] };
}
// La clasificación usa el p95 LITERAL (sin TOL): GREEN <= 33.3 ms; YELLOW > 33.3 y <= 50 ms; RED > 50 ms.
const classify = (p95) => (p95 == null ? 'n/a' : p95 <= 33.3 ? 'GREEN' : p95 <= 50 ? 'YELLOW' : 'RED');

const readMem = () => fs.readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)/)?.[1] / 1024;
const cpuTimes = () => { const l = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].split(/\s+/).slice(1).map(Number); return { idle: l[3] + l[4], total: l.reduce((a, b) => a + b, 0) }; };
const hostBusy = (a, b) => 100 * (1 - (b.idle - a.idle) / (b.total - a.total));
function vmRss(pid) { try { return Number(fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]) / 1024; } catch { return null; } }

// ── una corrida (perfil × escenario × repetición) ──
async function runOne(browser, base, profile, key, rep, ref) {
  const sc = SCENARIOS[key], pr = PROFILES[profile];
  const page = await newPage(browser);
  try {
  const errors = [];
  const out = { profile, profile_name: pr.name, cpu_throttle: pr.rate, scenario: key, label: sc.label, rep, errors: 0, error_samples: [] };
  const hostA = cpuTimes(), memA = readMem(), loadA = os.loadavg()[0];
  try {
    await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Log.enable'); await page.send('Performance.enable');
    page.on('Runtime.exceptionThrown', (p) => errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0]));
    page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error' || p.type === 'assert') errors.push('console.' + p.type + ': ' + p.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160)); });
    page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') errors.push('log: ' + p.entry.text.slice(0, 160) + (p.entry.url ? ' ' + p.entry.url : '')); });
    await page.send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false });
    await page.send('Emulation.setCPUThrottlingRate', { rate: pr.rate });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT });
    const origin = new URL(base).origin;
    await page.send('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage,session_storage,indexeddb,cookies' });

    // Startup: navegación → UI utilizable (caché HTTP caliente)
    const loaded = new Promise((r) => page.on('Page.loadEventFired', r));
    await page.send('Page.navigate', { url: base });
    await loaded;
    for (let i = 0; i < 300 && (await page.evaluate('window.__perf.uiReady')) === null; i++) await sleep(100);
    await sleep(1500);
    const nav = await page.evaluate('(()=>{const n=performance.getEntriesByType("navigation")[0];return {dcl:n.domContentLoadedEventEnd,load:n.loadEventEnd,ready:window.__perf.uiReady}})()');
    const early = await page.evaluate('window.__perf.slice(0)');
    const EK = 6, ef = Float64Array.from(early);
    let stable = null;
    for (let i = 0; i + 10 < ef.length / EK; i++) { let ok = true; for (let j = i; j < i + 10; j++) if (ef[(j + 1) * EK] - ef[j * EK] > 50) { ok = false; break; } if (ok && ef[i * EK] >= nav.load) { stable = ef[i * EK]; break; } }
    out.startup = { dcl_ms: nav.dcl, load_ms: nav.load, ui_ready_ms: nav.ready, first_stable_frame_ms: stable };

    if (sc.track !== 's01') { await page.evaluate(`(()=>{const s=document.getElementById('track');s.value='${sc.track}';s.dispatchEvent(new Event('change'))})()`); await sleep(300); }
    const gc = async () => { await page.send('HeapProfiler.enable').catch(() => {}); await page.send('HeapProfiler.collectGarbage').catch(() => {}); };
    const metrics = async () => { const m = Object.fromEntries((await page.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value])); return { js_heap_used_mb: m.JSHeapUsedSize / 1048576, js_heap_total_mb: m.JSHeapTotalSize / 1048576, nodes: m.Nodes, documents: m.Documents, frames: m.Frames, layout_count: m.LayoutCount }; };
    const rendererRss = async () => { try { const pi = (await browser.send('SystemInfo.getProcessInfo')).processInfo; return maxOf(pi.filter((p) => p.type === 'renderer').map((p) => vmRss(p.id))); } catch { return null; } };
    await gc(); out.heap_loaded = await metrics();

    if (key === 'editor') { out.editor = await editorScenario(page, rep === 1 && CPU_PROFILE_S > 0); }
    else {
      let startIdx = null;
      if (sc.code) {
        const code = sc.code === 'legacy1' ? 'BITIRO_STARTERS.legacyExamples[1]' : sc.code === 'legacy0' ? 'BITIRO_STARTERS.legacyExamples[0]' : JSON.stringify(sc.code);
        await page.evaluate(`(()=>{const s=document.getElementById('src');s.value=${code};s.dispatchEvent(new Event('input'));${sc.pulsador ? "document.getElementById('pulsador').click();" : ''}document.getElementById('runBar').click();})()`);
        await sleep(300);
        const m = await page.evaluate('mode');
        if (m !== 'code') throw new Error('el programa no inició (mode=' + m + '): ' + (await page.evaluate("document.getElementById('msg').textContent")).slice(0, 120));
        startIdx = await page.evaluate('window.__perf.count()');
      }
      await sleep(WARMUP_S * 1000);
      await gc(); out.heap_start = await metrics(); out.rss_start_mb = await rendererRss();
      const rawMetrics = async () => Object.fromEntries((await page.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      // Mantiene el programa activo: si termina (p. ej. el robot sale de la pista) pulsa Reiniciar y Ejecutar, como haría el alumno.
      let cycles = 0;
      const sustain = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { await sleep(Math.min(500, end - Date.now())); if (sc.restart && (await page.evaluate("mode==='idle'"))) { cycles++; await page.evaluate(`(()=>{document.getElementById('reset').click();${sc.pulsador ? "document.getElementById('pulsador').click();" : ''}document.getElementById('runBar').click();})()`); } } };
      const i0 = await page.evaluate('window.__perf.count()'); const wallStart = Date.now(); const m0 = await rawMetrics();
      if (sc.restart) await sustain(sc.windowS * 1000); else await sleep(sc.windowS * 1000);
      const m1 = await rawMetrics(); const i1 = await page.evaluate('window.__perf.count()'); const wallMs = Date.now() - wallStart;
      const dw = m1.Timestamp - m0.Timestamp; const util = (k) => (100 * (m1[k] - m0[k])) / dw;
      out.main_thread = { task_pct: util('TaskDuration'), script_pct: util('ScriptDuration'), layout_pct: util('LayoutDuration'), style_pct: util('RecalcStyleDuration') };
      out.cycles = sc.restart ? cycles : null;
      const all = Float64Array.from(await page.evaluate(`window.__perf.slice(${startIdx ?? i0})`));
      const off0 = i0 - (startIdx ?? i0), off1 = i1 - (startIdx ?? i0);
      out.frames = frameStats(all, EK, off0, off1);
      out.wall_window_s = wallMs / 1000;
      const lt = await page.evaluate('({s:window.__perf.ltSupported,l:window.__perf.lt})');
      if (!lt.s) out.long_tasks = 'NOT OBSERVABLE';
      else { const { t0, t1 } = out.frames; const inW = lt.l.filter(([s]) => s >= t0 && s <= t1); const dur = (t1 - t0);
        const clipped = inW.reduce((a, [s, d]) => a + Math.max(0, Math.min(s + d, t1) - Math.max(s, t0)), 0);
        out.long_tasks = { count: inW.length, total_ms: inW.reduce((a, [, d]) => a + d, 0), max_ms: inW.length ? Math.max(...inW.map(([, d]) => d)) : 0, per_min: inW.length / (dur / 60000), pct_time: 100 * clipped / dur }; }
      await gc(); out.heap_end = await metrics(); out.rss_end_mb = await rendererRss();
      if (rep === 1 && sc.code && CPU_PROFILE_S > 0) out.cpu_profile = await cpuProfile(page, sustain);

      // simulation_speed_ratio y estado: solo sobre muestras con el programa corriendo (mode=code, no pausado)
      if (sc.code) {
        const act = []; for (let i = off0; i < off1; i++) if (all[i * EK + 5] === 1) act.push(i);
        // Se suman solo pares consecutivos con el programa activo y simTime no decreciente (un Reiniciar pone simTime a 0 y se excluye).
        const segs = []; let cds = 0, cdt = 0;
        for (let i = off0 + 1; i < off1; i++) if (all[i * EK + 5] === 1 && all[(i - 1) * EK + 5] === 1) { const d = all[i * EK + 1] - all[(i - 1) * EK + 1]; if (d >= 0) { cds += d; cdt += (all[i * EK] - all[(i - 1) * EK]) / 1000; } segs.push([cdt, cds]); }
        if (act.length > 2 && cdt > 0) { out.sim = { active_fraction: act.length / (off1 - off0), sim_s: cds, wall_s: cdt, speed_ratio: cds / cdt };
          let j = 0, mn = null; for (let i = 0; i < segs.length; i++) { if (j < i) j = i; while (j < segs.length && segs[j][0] - segs[i][0] < 5) j++; if (j >= segs.length) break; const r = (segs[j][1] - segs[i][1]) / (segs[j][0] - segs[i][0]); if (mn === null || r < mn) mn = r; }
          out.sim.speed_ratio_min_5s = mn; }
        else out.sim = { active_fraction: act.length / Math.max(1, off1 - off0), speed_ratio: null, note: 'programa no activo en la ventana' };
        // comparación de estado con P0 rep 1 en ticks coincidentes (misma simTime exacta)
        const table = new Map(); for (let i = 0; i < all.length / EK; i++) if (all[i * EK + 5] === 1) table.set(all[i * EK + 1], [all[i * EK + 2], all[i * EK + 3], all[i * EK + 4]]);
        if (profile === 'p0' && rep === 1) ref[key] = table;
        else if (ref[key]) { let n = 0, mx = 0; for (const [s, v] of table) { const r = ref[key].get(s); if (!r) continue; n++; mx = Math.max(mx, Math.abs(v[0] - r[0]), Math.abs(v[1] - r[1]), Math.abs(v[2] - r[2])); } out.state_vs_p0 = { matched_ticks: n, max_abs_diff: n ? mx : null }; }
        // salud del estado al final
        out.final = await page.evaluate(`(()=>{const f=[R.x,R.y,R.th,R.L,R.R,simTime].every(Number.isFinite);const c=document.getElementById('scene').getContext('2d');const d=c.getImageData(0,0,c.canvas.width,c.canvas.height).data;const seen=new Set();for(let i=0;i<d.length;i+=4*997)seen.add(d[i]<<16|d[i+1]<<8|d[i+2]);return {finite:f,mode,badge:document.getElementById('statusBadge').textContent,lcd_ok:document.getElementById('lcd').textContent.length>=16,canvas_colors:seen.size,editor_ok:document.getElementById('src').value.length>0&&!!document.getElementById('gutter').textContent,simTime,x:R.x,y:R.y}})()`);
        // pausa / continuar / reinicio responden
        const waitFor = async (expr, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(expr)) return Date.now() - t; await sleep(40); } return null; };
        await page.evaluate("document.getElementById('pause').click()"); const pLat = await waitFor('paused===true');
        const s1 = await page.evaluate('simTime'); await sleep(600); const s2 = await page.evaluate('simTime');
        await page.evaluate("document.getElementById('pause').click()"); const rLat = await waitFor('paused===false');
        await sleep(600); const s3 = await page.evaluate('simTime');
        await page.evaluate("document.getElementById('reset').click()"); const xLat = await waitFor("mode==='idle'&&simTime===0");
        out.controls = { pause_ms: pLat, frozen_while_paused: s1 === s2, resume_ms: rLat, advanced_after_resume: s3 > s2, reset_ms: xLat };
      }
    }
    out.rss_end_mb ??= await rendererRss();
  } catch (e) { out.failure = String(e.message || e); }
  out.errors = errors.length; out.error_samples = errors.slice(0, 5);
  out.host = { busy_pct: hostBusy(hostA, cpuTimes()), mem_available_mb_start: memA, mem_available_mb_end: readMem(), load1_start: loadA, load1_end: os.loadavg()[0] };
  return out;
  } finally { await page.close(); }
}

// ── perfil de CPU por muestreo (V8), agregado por archivo y por función; no afecta a la ventana medida ──
async function cpuProfile(page, sustain) {
  await page.send('Profiler.enable'); await page.send('Profiler.setSamplingInterval', { interval: 1000 }); await page.send('Profiler.start');
  await sustain(CPU_PROFILE_S * 1000);
  const { profile } = await page.send('Profiler.stop'); await page.send('Profiler.disable');
  return summarizeProfile(profile);
}
function summarizeProfile(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n])); const self = new Map(); let total = 0;
  profile.samples.forEach((id, i) => { const dt = profile.timeDeltas[i]; total += dt; self.set(id, (self.get(id) || 0) + dt); });
  const byFile = {}, byFn = {};
  for (const [id, t] of self) { const cf = byId.get(id).callFrame; const file = cf.url ? cf.url.split('/').pop() : cf.functionName || '(native)'; const fn = (cf.functionName || '(anonymous)') + (cf.url ? ' ' + file + ':' + (cf.lineNumber + 1) : '');
    byFile[file] = (byFile[file] || 0) + t; byFn[fn] = (byFn[fn] || 0) + t; }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ name: k, pct: (100 * v) / total, ms: v / 1000 }));
  return { seconds: total / 1e6, idle_pct: (100 * (byFile['(idle)'] || 0)) / total, gc_pct: (100 * (byFile['(garbage collector)'] || 0)) / total, by_file: top(byFile, 8), top_functions: top(byFn, 10) };
}

// ── E EDITOR: secuencia reproducible sobre un programa de tamaño representativo; simulador detenido ──
async function editorScenario(page, withProfile) {
  await page.evaluate("(()=>{const s=document.getElementById('src');s.value=BITIRO_STARTERS.legacyExamples[0];s.dispatchEvent(new Event('input'));s.focus();s.setSelectionRange(s.value.length,s.value.length);})()");
  const lines = await page.evaluate("document.getElementById('src').value.split('\\n').length");
  await sleep(500);
  const key = (type, o) => page.send('Input.dispatchKeyEvent', { type, ...o });
  const actions = [];
  const press = async (name, o, down = 'keyDown') => { const t = performance.now(); await key(down, o); await key('keyUp', { key: o.key, code: o.code, windowsVirtualKeyCode: o.windowsVirtualKeyCode }); actions.push({ name, rtt: performance.now() - t }); await sleep(30); };
  const lt0 = await page.evaluate('window.__perf.lt.length'), ev0 = await page.evaluate('window.__perf.evt.length'), f0 = await page.evaluate('window.__perf.count()');
  if (withProfile) { await page.send('Profiler.enable'); await page.send('Profiler.setSamplingInterval', { interval: 1000 }); await page.send('Profiler.start'); }
  const start = await page.evaluate('performance.now()');
  for (const ch of 'int x = 1; // prueba de edicion en el editor 123') await press('type', { key: ch, text: ch, code: 'KeyA', windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0) });
  for (let i = 0; i < 10; i++) await press('enter', { key: 'Enter', text: '\r', code: 'Enter', windowsVirtualKeyCode: 13 });
  for (let i = 0; i < 20; i++) await press('arrow', { key: i % 2 ? 'ArrowDown' : 'ArrowUp', code: i % 2 ? 'ArrowDown' : 'ArrowUp', windowsVirtualKeyCode: i % 2 ? 40 : 38 });
  for (let i = 0; i < 20; i++) await press('backspace', { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  for (let i = 0; i < 10; i++) await press('undo', { key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90, modifiers: 2, commands: ['undo'] });
  await sleep(300);
  const end = await page.evaluate('performance.now()');
  const cpu = withProfile ? summarizeProfile((await page.send('Profiler.stop')).profile) : null;
  const evAll = await page.evaluate('({s:window.__perf.evtSupported,e:window.__perf.evt})'); const evs = evAll.e.slice(ev0);
  const evKey = evs.filter(([n]) => /^(keydown|keyup|keypress|beforeinput|input)$/.test(n));
  const evStat = (i) => ({ p50: pct(evKey.map((x) => x[i]), 0.5), p95: pct(evKey.map((x) => x[i]), 0.95), max: evKey.length ? Math.max(...evKey.map((x) => x[i])) : null });
  const lt = (await page.evaluate('({s:window.__perf.ltSupported,l:window.__perf.lt})'));
  const ltw = lt.l.slice(lt0);
  const rtt = actions.map((a) => a.rtt);
  const final = await page.evaluate("document.getElementById('src').value.length");
  return { code_lines: lines, actions: actions.length, window_s: (end - start) / 1000, rtt_ms: { p50: pct(rtt, 0.5), p95: pct(rtt, 0.95), max: Math.max(...rtt) },
    event_timing: evAll.s ? { events_ge16ms: evKey.length, events_sent: actions.length * 2, duration_ms: evStat(1), input_delay_ms: evStat(2), processing_ms: evStat(3) } : 'NOT OBSERVABLE',
    long_tasks: lt.s ? { count: ltw.length, total_ms: ltw.reduce((a, [, d]) => a + d, 0), max_ms: ltw.length ? Math.max(...ltw.map(([, d]) => d)) : 0 } : 'NOT OBSERVABLE', frames_during: (await page.evaluate('window.__perf.count()')) - f0, final_chars: final, cpu_profile: cpu };
}

// ── ejecución prolongada: COMPLEX durante LONG_S con heap (tras GC) cada 60 s ──
async function longRun(browser, base, profile) {
  const pr = PROFILES[profile]; const page = await newPage(browser); const out = { profile, cpu_throttle: pr.rate, scenario: 'complex-long', duration_s: LONG_S, heap: [] };
  try {
    await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Performance.enable'); await page.send('HeapProfiler.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false });
    await page.send('Emulation.setCPUThrottlingRate', { rate: pr.rate });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT });
    await page.send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'local_storage,session_storage,indexeddb,cookies' });
    const loaded = new Promise((r) => page.on('Page.loadEventFired', r)); await page.send('Page.navigate', { url: base }); await loaded; await sleep(1500);
    await page.evaluate("(()=>{const s=document.getElementById('track');s.value='s02';s.dispatchEvent(new Event('change'))})()");
    await page.evaluate(`(()=>{const s=document.getElementById('src');s.value=${JSON.stringify(S06_CODE)};s.dispatchEvent(new Event('input'));document.getElementById('runBar').click();})()`);
    const snap = async (t) => { await page.send('HeapProfiler.collectGarbage'); const m = Object.fromEntries((await page.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value])); out.heap.push({ t_s: t, used_mb: m.JSHeapUsedSize / 1048576, total_mb: m.JSHeapTotalSize / 1048576, nodes: m.Nodes, documents: m.Documents }); };
    await sleep(3000); await snap(0);
    for (let t = 60; t <= LONG_S; t += 60) { await sleep(60000); await snap(t); }
    const all = Float64Array.from(await page.evaluate('window.__perf.slice(0)')); out.frames = frameStats(all, 6, Math.floor(all.length / 6 * 0.05), all.length / 6);
    out.mode_end = await page.evaluate('mode');
  } catch (e) { out.failure = String(e.message || e); } finally { await page.close(); }
  return out;
}

// ── resumen en Markdown ──
const f1 = (x, d = 1) => (x == null || !Number.isFinite(x) ? '–' : x.toFixed(d));
function summarize(results) {
  const md = []; const groups = new Map();
  for (const r of results) { const k = r.scenario + '|' + r.profile; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  md.push('### Frames, long tasks y memoria (mediana de repeticiones; entre paréntesis, peor p95)\n');
  md.push('scenario | profile | throttle | FPS | frame p50 | p95 (peor) | p99 | >33ms %† | >50ms %† | >100ms %† | class | long tasks | LT total ms | LT max ms | LT %tiempo | heap start→end MB | errores | fallos');
  md.push('---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---');
  const agg = {};
  for (const [k, rs] of groups) {
    if (rs[0].scenario === 'editor') continue;
    const ok = rs.filter((r) => r.frames); const fr = ok.map((r) => r.frames); const lt = ok.map((r) => r.long_tasks).filter((x) => x && x !== 'NOT OBSERVABLE');
    const p95 = median(fr.map((x) => x.p95));
    agg[k] = { p95, fps: median(fr.map((x) => x.fps)) };
    md.push([rs[0].label, rs[0].profile_name, rs[0].cpu_throttle + '×', f1(median(fr.map((x) => x.fps))), f1(median(fr.map((x) => x.p50))), f1(p95) + ' (' + f1(maxOf(fr.map((x) => x.p95))) + ')', f1(median(fr.map((x) => x.p99))) + ' (' + f1(maxOf(fr.map((x) => x.p99))) + ')',
      f1(median(fr.map((x) => x.over33))), f1(median(fr.map((x) => x.over50))), f1(median(fr.map((x) => x.over100))), classify(p95),
      lt.length ? f1(median(lt.map((x) => x.count)), 0) : 'NOT OBSERVABLE', lt.length ? f1(median(lt.map((x) => x.total_ms)), 0) : '–', lt.length ? f1(maxOf(lt.map((x) => x.max_ms)), 0) : '–', lt.length ? f1(median(lt.map((x) => x.pct_time))) : '–',
      f1(median(ok.map((r) => r.heap_start?.js_heap_used_mb))) + '→' + f1(median(ok.map((r) => r.heap_end?.js_heap_used_mb))), rs.reduce((a, r) => a + r.errors, 0), rs.filter((r) => r.failure).length].join(' | '));
  }
  md.push('\n† contadores de frames excedidos con 1 ms de tolerancia por cuantización de vsync. La clase GREEN/YELLOW/RED usa el p95 literal (≤33,3 / ≤50 / >50 ms). FPS = frames rAF / tiempo de captura.\n');
  md.push('### Hilo principal durante la ventana (Performance.getMetrics) y ciclos de reinicio\n');
  md.push('scenario | profile | tarea % | script % | layout % | style % | frames >25 ms (vsync perdido) % | ciclos Reiniciar/Ejecutar');
  md.push('---|---|---|---|---|---|---|---');
  for (const [k, rs] of groups) { const ok = rs.filter((r) => r.main_thread); if (!ok.length) continue;
    md.push([ok[0].label, ok[0].profile_name, f1(median(ok.map((r) => r.main_thread.task_pct))), f1(median(ok.map((r) => r.main_thread.script_pct))), f1(median(ok.map((r) => r.main_thread.layout_pct))), f1(median(ok.map((r) => r.main_thread.style_pct))), f1(median(ok.map((r) => r.frames.missed60))), ok[0].cycles == null ? '–' : ok.map((r) => r.cycles).join('/')].join(' | ')); }
  const cp = results.filter((r) => r.cpu_profile);
  if (cp.length) { md.push('\n### Perfil de CPU por muestreo (repetición 1, 10 s; % del tiempo muestreado, incluye idle)\n'); md.push('scenario | profile | idle % | GC % | por archivo (top) | funciones (top 4)'); md.push('---|---|---|---|---|---');
    for (const r of cp) md.push([r.label, r.profile_name, f1(r.cpu_profile.idle_pct), f1(r.cpu_profile.gc_pct), r.cpu_profile.by_file.filter((x) => x.name !== '(idle)').slice(0, 5).map((x) => x.name + ' ' + f1(x.pct)).join(', '), r.cpu_profile.top_functions.filter((x) => !x.name.startsWith('(idle)')).slice(0, 4).map((x) => x.name + ' ' + f1(x.pct)).join('; ')].join(' | ')); }
  const ecp = results.filter((r) => r.editor?.cpu_profile);
  if (ecp.length) { md.push('\n### Perfil de CPU durante el tecleo del editor (repetición 1; % del tiempo muestreado)\n'); md.push('profile | idle % | GC % | por archivo (top) | funciones (top 5)'); md.push('---|---|---|---|---');
    for (const r of ecp) { const c = r.editor.cpu_profile; md.push([r.profile_name, f1(c.idle_pct), f1(c.gc_pct), c.by_file.filter((x) => x.name !== '(idle)').slice(0, 6).map((x) => x.name + ' ' + f1(x.pct)).join(', '), c.top_functions.filter((x) => !x.name.startsWith('(idle)')).slice(0, 5).map((x) => x.name + ' ' + f1(x.pct)).join('; ')].join(' | ')); } }
  md.push('\n### Startup (todas las corridas del perfil; caché HTTP caliente, servidor local)\n');
  md.push('profile | DOMContentLoaded ms | load ms | UI utilizable ms | primer frame estable ms | n');
  md.push('---|---|---|---|---|---');
  for (const p of profiles) { const s = results.filter((r) => r.profile === p && r.startup).map((r) => r.startup); if (s.length) md.push([PROFILES[p].name, f1(median(s.map((x) => x.dcl_ms)), 0), f1(median(s.map((x) => x.load_ms)), 0), f1(median(s.map((x) => x.ui_ready_ms)), 0), f1(median(s.map((x) => x.first_stable_frame_ms)), 0), s.length].join(' | ')); }
  md.push('\n### Editor (simulador detenido)\n');
  md.push('profile | acciones | RTT CDP p50 | p95 | max | eventos de teclado informados (n; keydown/keypress/beforeinput/input/keyup ≥16 ms) | Event Timing duración p50 / p95 / max ms | retardo de entrada p95 ms | long tasks (n / total ms / max ms)');
  md.push('---|---|---|---|---|---|---|---|---');
  for (const p of profiles) { const e = results.filter((r) => r.profile === p && r.editor).map((r) => r.editor); if (e.length) md.push([PROFILES[p].name, e[0].actions, f1(median(e.map((x) => x.rtt_ms.p50))), f1(median(e.map((x) => x.rtt_ms.p95))), f1(maxOf(e.map((x) => x.rtt_ms.max))), e[0].event_timing === 'NOT OBSERVABLE' ? 'NOT OBSERVABLE' : f1(median(e.map((x) => x.event_timing.events_ge16ms)), 0), e[0].event_timing === 'NOT OBSERVABLE' ? '–' : [f1(median(e.map((x) => x.event_timing.duration_ms.p50)), 0), f1(median(e.map((x) => x.event_timing.duration_ms.p95)), 0), f1(maxOf(e.map((x) => x.event_timing.duration_ms.max)), 0)].join(' / '), e[0].event_timing === 'NOT OBSERVABLE' ? '–' : f1(median(e.map((x) => x.event_timing.input_delay_ms.p95)), 0),
    e[0].long_tasks === 'NOT OBSERVABLE' ? 'NOT OBSERVABLE' : [f1(median(e.map((x) => x.long_tasks.count)), 0), f1(median(e.map((x) => x.long_tasks.total_ms)), 0), f1(maxOf(e.map((x) => x.long_tasks.max_ms)), 0)].join(' / ')].join(' | ')); }
  md.push('\n### simulation_speed_ratio, corrección y controles (programas en ejecución)\n');
  md.push('scenario | profile | speed ratio (mediana) | mín. en 5 s | fracción activa | estado vs P0: ticks / diff máx | finite | canvas colores | pausa ms | reanuda ms | reinicio ms | pausa congela | avanza tras reanudar');
  md.push('---|---|---|---|---|---|---|---|---|---|---|---|---');
  for (const [k, rs] of groups) { const ok = rs.filter((r) => r.sim); if (!ok.length) continue;
    md.push([ok[0].label, ok[0].profile_name, f1(median(ok.map((r) => r.sim.speed_ratio)), 3), f1(median(ok.map((r) => r.sim.speed_ratio_min_5s)), 3), f1(median(ok.map((r) => r.sim.active_fraction)), 2),
      ok.some((r) => r.state_vs_p0) ? ok.filter((r) => r.state_vs_p0).map((r) => r.state_vs_p0.matched_ticks + ' / ' + (r.state_vs_p0.max_abs_diff ?? '–')).join('; ') : 'ref', ok.every((r) => r.final?.finite), f1(median(ok.map((r) => r.final?.canvas_colors)), 0),
      f1(median(ok.map((r) => r.controls?.pause_ms)), 0), f1(median(ok.map((r) => r.controls?.resume_ms)), 0), f1(median(ok.map((r) => r.controls?.reset_ms)), 0), ok.every((r) => r.controls?.frozen_while_paused), ok.every((r) => r.controls?.advanced_after_resume)].join(' | ')); }
  md.push('\n### Host durante las corridas\n');
  md.push('profile | host CPU ocupada % (mediana / máx) | MemAvailable MB mín | load1 máx');
  md.push('---|---|---|---');
  for (const p of profiles) { const h = results.filter((r) => r.profile === p).map((r) => r.host); if (h.length) md.push([PROFILES[p].name, f1(median(h.map((x) => x.busy_pct))) + ' / ' + f1(maxOf(h.map((x) => x.busy_pct))), f1(Math.min(...h.map((x) => x.mem_available_mb_end)), 0), f1(maxOf(h.map((x) => x.load1_end)))].join(' | ')); }
  return md.join('\n');
}

async function hostInfo(browser, base) {
  const page = await newPage(browser);
  let b, gpu = null;
  try {
  await page.send('Page.enable'); await page.send('Emulation.setDeviceMetricsOverride', { width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false });
  const loaded = new Promise((r) => page.on('Page.loadEventFired', r)); await page.send('Page.navigate', { url: base }); await loaded;
  b = await page.evaluate(`(()=>{const c=document.createElement('canvas');let r='sin WebGL';try{const g=c.getContext('webgl');if(g){const e=g.getExtension('WEBGL_debug_renderer_info');r=e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)}}catch(e){}return {ua:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory??null,dpr:devicePixelRatio,inner:innerWidth+'x'+innerHeight,webgl:r}})()`);
  try { const g = (await browser.send('SystemInfo.getInfo')); gpu = { devices: g.gpu.devices.map((d) => `${d.vendorString} ${d.deviceString}`), driver: g.gpu.driverVendor, feature_status: g.gpu.featureStatus }; } catch (e) { gpu = 'SystemInfo.getInfo: ' + e.message; }
  } finally { await page.close(); }
  const lines = fs.readFileSync('/proc/cpuinfo', 'utf8'), model = lines.match(/model name\s*:\s*(.*)/)?.[1];
  return { os: fs.readFileSync('/etc/os-release', 'utf8').match(/PRETTY_NAME="(.*)"/)?.[1], kernel: os.release(), cpu: model, threads: os.cpus().length, ram_total_mb: Math.round(os.totalmem() / 1048576), ram_available_mb_start: Math.round(readMem()),
    wsl: /microsoft/i.test(os.release()), wslg: !!process.env.WAYLAND_DISPLAY, dri: fs.existsSync('/dev/dri'), browser: b, gpu, node: process.version, headed: HEADED };
}

async function summarizeOnly(files) {
  // Fusiona resultados: un archivo posterior reemplaza los escenarios que contiene (mismo id de escenario).
  let results = []; let meta = null;
  for (const f of files) { const d = JSON.parse(fs.readFileSync(f, 'utf8')); meta ??= d.meta; const keys = new Set(d.results.map((r) => r.scenario)); results = results.filter((r) => !keys.has(r.scenario)).concat(d.results); }
  const order = Object.keys(SCENARIOS); results.sort((a, b) => order.indexOf(a.scenario) - order.indexOf(b.scenario));
  profiles.splice(0, profiles.length, ...Object.keys(PROFILES).filter((p) => results.some((r) => r.profile === p)));
  const md = summarize(results), out = arg('out', null);
  if (out) { fs.writeFileSync(out + '.md', md + '\n'); fs.writeFileSync(out + '.json', JSON.stringify({ meta, results }, null, 1)); }
  console.log(md);
}

async function main() {
  if (arg('summarize', null)) return summarizeOnly(String(arg('summarize')).split(','));
  const { server, url } = await serve();
  const browser = await launch({ headed: HEADED });
  const meta = { started: new Date().toISOString(), args: process.argv.slice(2), url, chrome: browser.version.Browser, protocol: browser.version['Protocol-Version'], profiles: profiles.map((p) => ({ id: p, ...PROFILES[p] })), viewport: VIEWPORT, reps: REPS };
  try {
    meta.host = await hostInfo(browser, url);
    console.log('host:', JSON.stringify(meta.host, null, 1));
    const results = [], ref = {}; const startAll = Date.now();
    // calentamiento de caché HTTP (no se mide)
    { const pg = await newPage(browser); try { await pg.send('Page.enable'); const l = new Promise((r) => pg.on('Page.loadEventFired', r)); await pg.send('Page.navigate', { url }); await l; await sleep(1000); } finally { await pg.close(); } }
    for (const profile of profiles) for (let rep = 1; rep <= REPS; rep++) for (const key of scenarios) {
      const r = await runOne(browser, url, profile, key, rep, ref); results.push(r);
      console.log(`[${((Date.now() - startAll) / 60000).toFixed(1)} min] ${r.profile_name} ${r.label} rep ${rep}: ` + (r.failure ? 'FALLO ' + r.failure : r.frames ? `fps=${f1(r.frames.fps)} p95=${f1(r.frames.p95)}ms p99=${f1(r.frames.p99)}ms ${classify(r.frames.p95)} err=${r.errors}` : r.editor ? `acciones=${r.editor.actions} RTT p95=${f1(r.editor.rtt_ms.p95)}ms eventTiming p95=${r.editor.event_timing === 'NOT OBSERVABLE' ? 'n/a' : f1(r.editor.event_timing.duration_ms.p95)}ms err=${r.errors}` : 'ok'));
      await sleep(COOLDOWN_S * 1000);
    }
    const longs = [];
    if (LONG_S) for (const profile of profiles.filter((p) => p !== 'p2')) { console.log('long run', profile); longs.push(await longRun(browser, url, profile)); }
    const outFile = arg('out', null) || path.join(HERE, 'results', 'sim-low-end-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const md = summarize(results);
    fs.writeFileSync(outFile, JSON.stringify({ meta, results, longs }, null, 1)); fs.writeFileSync(outFile.replace(/\.json$/, '.md'), md + '\n');
    console.log('\n' + md + '\n\nresultados:', outFile);
    if (longs.length) console.log(JSON.stringify(longs.map((l) => ({ profile: l.profile, heap: l.heap.map((h) => `${h.t_s}s:${h.used_mb.toFixed(2)}MB/${h.nodes}n`), fps: l.frames?.fps, failure: l.failure })), null, 1));
  } finally { await browser.close(); server.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
