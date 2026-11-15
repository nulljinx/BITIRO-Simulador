// node --experimental-websocket tests/head-ui.mjs      (opcional: BASE_DIR=<árbol publicado> para comparaciones cruzadas y rendimiento; HEAD_SHOTS=<carpeta> para guardar capturas)
// HEAD-CANVAS-INTEGRATION-1 · Chrome real: giro 0°–180° en las 4 cámaras, pausa/paso/continuar/reiniciar, velocidades,
// compatibilidad del sonar a 90° en TODAS las pistas, cambio de pista, restaurar código, programas anteriores y presentación móvil.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
const { launch, newPage, findChrome } = await import('./perf/cdp.mjs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_DIR ? path.resolve(process.env.BASE_DIR) : null;
const SHOTS = process.env.HEAD_SHOTS ? path.resolve(process.env.HEAD_SHOTS) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
try { findChrome(); } catch { console.log('SKIP · sin Chrome'); process.exit(0); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
const e404 = [];
const mk = (dir) => new Promise((res) => { const s = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(dir, p); if (!f.startsWith(dir + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { e404.push(p); r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'content-security-policy': CSP, 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r); }); s.listen(0, '127.0.0.1', () => res(s)); });
const sApp = await mk(ROOT), sBase = BASE ? await mk(BASE) : null;
const URL_APP = `http://127.0.0.1:${sApp.address().port}/index.html`, URL_BASE = sBase ? `http://127.0.0.1:${sBase.address().port}/index.html` : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch({ port: 9392 });
const errors = [], checks = [], R = {};
const check = (id, ok, detail) => { checks.push({ id, ok: !!ok, detail }); console.log(ok ? 'OK  ' : 'FALLA', id, '·', (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300)); };
const hash = (b64) => crypto.createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex').slice(0, 16);
async function open(url, { w = 1366, h = 800, mobile = false, dsf = 1 } = {}) {
  const page = await newPage(browser); await page.send('Page.enable'); await page.send('Runtime.enable');
  browser.on((m) => { if (m.sessionId !== page.sessionId) return; if (m.method === 'Runtime.exceptionThrown') errors.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error ' + JSON.stringify(m.params.args.map((a) => a.value || a.description)).slice(0, 200)); });
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile });
  await page.send('Page.navigate', { url }); await sleep(1600); return page;
}
const track = (p, id) => p.evaluate(`(()=>{const t=document.getElementById('track');t.value='${id}';t.dispatchEvent(new Event('change'))})()`).then(() => sleep(400));
const view = (p, v) => p.evaluate(`document.querySelector('.cam[data-view="${v}"]').click()`).then(() => sleep(250));
const shot = async (p, name, full = false) => {
  const clip = full ? undefined : await p.evaluate(`(()=>{const r=document.getElementById('scene').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`);
  const s = await p.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
  if (SHOTS && name) fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(s.data, 'base64'));
  return hash(s.data);
};
const boxes = (p, slots) => p.evaluate(`(()=>{const bs=track.boxSlots;scenarioList=${JSON.stringify(slots)}.map((i,n)=>({id:'user-box-'+(n+1),x:bs[i].x,y:bs[i].y,width:8,height:8,movable:true}));resetRobot();return activeObstacles.length})()`);
const st = (p) => p.evaluate('({a:HEAD_SONAR.state.angle,t:HEAD_SONAR.state.target,sim:simTime,run:!!running,paused:paused,x:R.x,y:R.y,th:R.th,L:R.L,R:R.R})');
const loadProg = async (p, code) => { await p.evaluate(`document.getElementById('src').value=${JSON.stringify(code)};document.getElementById('run').click()`); await sleep(350); };
const SWEEP = `#include <KnightRoboticsLibs_Iroh.h>
void setup() { inicializarCabeza(); inicializarSensores(); moverServoYaw(90); botonInicio(); }
void loop() {
  moverServoYaw(180); pausa(4000);
  moverServoYaw(0);   pausa(4000);
}`;
const START = `R.x=37.853;R.y=${129.588 + 3.95};R.th=0;previousPose={x:R.x,y:R.y,th:R.th,angle:0};`;
// generador de poses y cajas reproducible, el mismo en ambas páginas
const POSES = `(()=>{let seed=24680;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const H=[10,15.1,15.6,18.9,20];
  return (T)=>Array.from({length:40},()=>{const x=10+rnd()*(T.w-20),y=10+rnd()*(T.h-20),th=(rnd()-.5)*2*Math.PI;
   return {x,y,th,boxes:Array.from({length:3},(_,i)=>{const r=8+rnd()*55,a=rnd()*2*Math.PI;return {id:'b'+i,x:x+r*Math.cos(a),y:y+r*Math.sin(a),width:8,height:8,movable:true,visualHeightCm:H[Math.floor(rnd()*H.length)]};})};});})()`;
const READ_ALL = (legacyToggle) => `(()=>{const ids=[...document.getElementById('track').options].map(o=>o.value);const gen=${POSES};const out={};
  for(const id of ids){const t=document.getElementById('track');t.value=id;t.dispatchEvent(new Event('change'));
   const T=JSON.parse(JSON.stringify(track));const rows=[];
   for(const p of gen(T)){scenarioList=p.boxes;resetRobot();R.x=p.x;R.y=p.y;R.th=p.th;
    if(window.HEAD_SONAR){HEAD_SONAR.command(90);for(let i=0;i<10;i++)HEAD_SONAR.step(0.1);}
    const a=readSonarDistance();let b=a;
    ${legacyToggle ? 'if(window.HEAD_SONAR){const hs=window.HEAD_SONAR;window.HEAD_SONAR=undefined;b=readSonarDistance();window.HEAD_SONAR=hs;}' : ''}
    rows.push([a,b]);}
   out[id]=rows;}
  return out;})()`;
try {
  // ───── U1 · giro 0°–180° en las 4 cámaras ─────
  {
    const page = await open(URL_APP);
    check('U0 el módulo de la cabeza está cargado en la página', await page.evaluate("typeof HEAD_SONAR==='object'&&HEAD_SONAR.available===true"), 'HEAD_SONAR.available');
    await track(page, 's08'); await boxes(page, [0, 1, 2, 3]);
    const hashes = {}, bodyPose = [];
    for (const v of ['perspective', 'top', 'follow', 'robot']) {
      await view(page, v); hashes[v] = {};
      for (const a of [0, 45, 90, 135, 180]) {
        await page.evaluate(`(()=>{HEAD_SONAR.reset();HEAD_SONAR.command(${a});for(let i=0;i<400;i++)HEAD_SONAR.step(1/120);${START}render();})()`); await sleep(120);
        const s = await st(page); bodyPose.push([s.x, s.y, s.th, s.L, s.R].join());
        if (s.a !== a) check(`U1 ángulo real ${a}`, false, s);
        hashes[v][a] = await shot(page, `giro_${v}_${String(a).padStart(3, '0')}`);
      }
    }
    check('U1 el giro es visible en las 4 cámaras (5 imágenes distintas por cámara)', Object.values(hashes).every((o) => new Set(Object.values(o)).size === 5), hashes);
    check('U1 el chasis no se mueve al girar la cabeza', new Set(bodyPose).size === 1, [...new Set(bodyPose)]);
    // intermedios durante un movimiento real con programa
    await view(page, 'robot'); await page.evaluate('resetRobot()'); await loadProg(page, SWEEP); await page.evaluate(START + `document.getElementById('pulsador').click()`);
    const seen = new Set(); const t0 = Date.now();
    while (Date.now() - t0 < 6000 && seen.size < 6) { const s = await st(page); if (s.a > 95 && s.a < 175 && s.a !== s.t) seen.add(Math.round(s.a / 5)); await sleep(40); }
    check('U1 movimiento progresivo: ángulos intermedios observados en Chrome', seen.size >= 3, [...seen].map((v) => v * 5));
    await page.close();
  }
  // ───── U2 · pausa, paso, continuar, reiniciar ─────
  {
    const page = await open(URL_APP);
    await track(page, 's08'); await boxes(page, [0, 1, 2, 3]); await view(page, 'robot');
    const h0 = await shot(page, 'p2_inicio');
    await loadProg(page, SWEEP); await page.evaluate(START + `document.getElementById('pulsador').click()`);
    let s; const t0 = Date.now(); do { await sleep(30); s = await st(page); } while (!(s.a > 120 && s.a < 175) && Date.now() - t0 < 10000);
    check('U2 cabeza en movimiento con ángulo intermedio', s.a > 120 && s.a < 175, s);
    await page.evaluate(`document.getElementById('pause').click()`); await sleep(120);
    const p1 = await st(page), hp1 = await shot(page, 'p2_pausa_a'); await sleep(800); const p2 = await st(page), hp2 = await shot(page, 'p2_pausa_b');
    check('U2 pausa congela ángulo, tiempo, cuerpo e imagen', p1.a === p2.a && p1.sim === p2.sim && p1.x === p2.x && p1.paused && hp1 === hp2, { a: [p1.a, p2.a], sim: [p1.sim, p2.sim] });
    await page.evaluate(`document.getElementById('step').click()`); await sleep(150); const sp = await st(page);
    check('U2 paso: 12 pasos fijos (18° a 180 °/s) y vuelve a pausa', sp.paused && (Math.abs(Math.abs(sp.a - p1.a) - 18) < 0.01 || sp.a === sp.t), { antes: p1.a, despues: sp.a });
    await page.evaluate(`document.getElementById('pause').click()`); await sleep(400); const c1 = await st(page);
    check('U2 continuar reanuda', !c1.paused && c1.sim > sp.sim && c1.a !== sp.a, { antes: sp.a, despues: c1.a });
    await page.evaluate(`document.getElementById('reset').click()`); await sleep(400); const r1 = await st(page), hr = await shot(page, 'p2_reiniciar');
    check('U2 reiniciar: cabeza 90°/90°, tiempo 0, programa detenido e imagen inicial', r1.a === 90 && r1.t === 90 && r1.sim === 0 && !r1.run && hr === h0, { r1, h0, hr });
    await page.close();
  }
  // ───── U3 · velocidades ─────
  {
    const rows = [];
    for (const sp of ['0.5', '1', '2', '4']) {
      const page = await open(URL_APP); await track(page, 's08'); await boxes(page, [0, 1, 2, 3]); await loadProg(page, SWEEP);
      await page.evaluate(START + `window.__rec={};const u=update;update=function(dt){u(dt);const r=window.__rec;if(r.t0===undefined&&HEAD_SONAR.state.target===180){r.t0=simTime;r.w0=performance.now();}if(r.t0!==undefined){const e=simTime-r.t0;if(e>=0.2&&r.a02===undefined)r.a02=HEAD_SONAR.state.angle;if(e>=0.4&&r.a04===undefined)r.a04=HEAD_SONAR.state.angle;if(e>=0.9&&r.a09===undefined){r.a09=HEAD_SONAR.state.angle;r.wall=performance.now();}}};document.getElementById('speed').value='${sp}';document.getElementById('speed').dispatchEvent(new Event('change'));`);
      await page.evaluate(`document.getElementById('pulsador').click()`);
      let rec = null; const t0 = Date.now(); while (Date.now() - t0 < 20000) { rec = await page.evaluate('window.__rec'); if (rec && rec.a09 !== undefined) break; await sleep(100); }
      rows.push({ v: Number(sp), a02: rec?.a02, a04: rec?.a04, a09: rec?.a09, razon: rec?.wall ? +(0.9 / ((rec.wall - rec.w0) / 1000)).toFixed(2) : null }); await page.close();
    }
    check('U3 mismo ángulo a igual tiempo simulado en 0,5×/1×/2×/4×', rows.every((r) => r.a02 === rows[0].a02 && r.a04 === rows[0].a04 && r.a09 === rows[0].a09 && r.a09 === 180), rows);
    check('U3 razón simulado/real ≈ velocidad (±30 %)', rows.every((r) => r.razon && Math.abs(r.razon / r.v - 1) < 0.3), rows.map((r) => [r.v, r.razon]));
  }
  // ───── U4 · sonar a 90° idéntico en TODAS las pistas ─────
  {
    const page = await open(URL_APP);
    const own = await page.evaluate(READ_ALL(true)); await page.close();
    const ids = Object.keys(own);
    let tot = 0, hit = 0, diff = [];
    for (const id of ids) for (const [a, b] of own[id]) { tot++; if (a < 200) hit++; if (a !== b) diff.push(id); }
    check(`U4 yaw 90° = ruta anterior del mismo simulador en ${ids.length} pistas (${tot} lecturas, ${hit} con caja)`, diff.length === 0 && ids.length >= 5 && hit > 50, { pistas: ids, diferencias: diff.length });
    R.sonar_pistas = ids;
    if (URL_BASE) {
      const pb = await open(URL_BASE); const base = await pb.evaluate(READ_ALL(false)); await pb.close();
      let d = 0; for (const id of ids) own[id].forEach(([a], i) => { if (base[id][i][0] !== a) d++; });
      check(`U4b yaw 90° idéntico a la PUBLICADA (otra página) en ${ids.length} pistas, ${tot} lecturas`, d === 0, { diferencias: d });
    }
  }
  // ───── U5 · cambio de pista, restaurar código, programas anteriores ─────
  {
    const page = await open(URL_APP); const ids = await page.evaluate(`[...document.getElementById('track').options].map(o=>o.value)`);
    await track(page, 's08'); await boxes(page, [0, 1, 2, 3]); await loadProg(page, SWEEP);
    await page.evaluate(`document.getElementById('pulsador').click()`); await sleep(700); const mid = await st(page);
    await track(page, ids[0]); const after = await st(page);
    check('U5 cambiar de pista con la cabeza girada: 90°/90° y programa detenido', mid.a !== 90 && after.a === 90 && after.t === 90 && !after.run, { mid: mid.a, after });
    const before = await page.evaluate(`document.getElementById('src').value`);
    await page.evaluate(`document.getElementById('src').value='int basura;';document.getElementById('restoreStarter').click()`); await sleep(250);
    await page.evaluate(`document.getElementById('restoreConfirm').click()`); await sleep(350);
    const restored = await page.evaluate(`document.getElementById('src').value`);
    check('U5 restaurar código inicial recupera el programa de la pista', restored === before && restored.length > 20, { len: restored.length });
    await page.evaluate(`document.getElementById('run').click()`); await sleep(250); await page.evaluate(`document.getElementById('pulsador').click()`); await sleep(1400);
    const again = await st(page);
    check('U5 el programa anterior se ejecuta de nuevo (cuerpo se mueve, cabeza al frente)', again.run && again.a === 90 && again.sim > 0.5, again);
    await track(page, 's08'); await boxes(page, [0, 1, 2, 3]); await loadProg(page, SWEEP);
    await page.evaluate(`document.getElementById('pulsador').click()`); await sleep(800);
    const again2 = await st(page);
    check('U5 el programa de cabeza se ejecuta de nuevo tras cambiar de pista', again2.run && again2.a !== 90, again2);
    await page.close();
    if (URL_BASE) {
      const run = async (url) => { const p = await open(url); const res = {}; await p.evaluate('window.requestAnimationFrame=()=>0'); await sleep(80);
        for (const id of ids) { await track(p, id); await p.evaluate(`document.getElementById('run').click()`); await sleep(120); await p.evaluate(`document.getElementById('pulsador').click()`);
          res[id] = await p.evaluate(`(()=>{for(let i=0;i<2400;i++)update(1/120);return {x:+R.x.toFixed(3),y:+R.y.toFixed(3),th:+R.th.toFixed(4),lcd:lcd.slice(),col:collisionCount,moved:movedCount,sim:+simTime.toFixed(2),running:!!running}})()`); }
        await p.close(); return res; };
      const b = await run(URL_BASE), a = await run(URL_APP);
      const bad = ids.filter((id) => JSON.stringify(a[id]) !== JSON.stringify(b[id]));
      check(`U5b programa inicial de cada una de las ${ids.length} pistas, 20 s: estado final idéntico a la publicada`, bad.length === 0, bad.length ? bad : 'idéntico');
    }
  }
  // ───── U6 · móvil ─────
  {
    const page = await open(URL_APP, { w: 390, h: 844, mobile: true, dsf: 2 });
    await track(page, 's08'); await boxes(page, [0, 1, 2, 3]); await view(page, 'robot');
    const o = await page.evaluate('({sw:document.documentElement.scrollWidth,iw:innerWidth,c:(()=>{const r=document.getElementById("scene").getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})()})');
    check('U6 móvil 390×844: sin desbordamiento horizontal y escena visible', o.sw <= o.iw + 1 && o.c[0] > 200 && o.c[1] > 100, o);
    const hs = new Set();
    for (const a of [0, 90, 180]) { await page.evaluate(`(()=>{HEAD_SONAR.reset();HEAD_SONAR.command(${a});for(let i=0;i<400;i++)HEAD_SONAR.step(1/120);${START}render();})()`); await sleep(150); hs.add(await shot(page, `movil_robot_${String(a).padStart(3, '0')}`, true)); }
    check('U6 móvil: la cabeza se ve girar (3 imágenes distintas)', hs.size === 3, [...hs]);
    await page.close();
  }
  // ───── U7 · rendimiento (solo con BASE_DIR) ─────
  if (URL_BASE) {
    // la medida única de fps con CPU emulada es ruidosa (±20 %): 3 rondas alternadas y mediana
    const samples = {};
    for (let round = 0; round < 3; round++) for (const [name, url] of [['publicada', URL_BASE], ['candidato', URL_APP]]) for (const [perfil, w, h, thr, mob] of [['escritorio', 1366, 800, 1, false], ['móvil CPU×4', 390, 844, 4, true]]) {
      const pg = await open(url, { w, h, mobile: mob, dsf: mob ? 2 : 1 }); await track(pg, 's08'); await boxes(pg, [0, 1, 2, 3]); await view(pg, 'robot');
      await pg.send('Emulation.setCPUThrottlingRate', { rate: thr }); await sleep(300); await loadProg(pg, SWEEP); await pg.evaluate(`document.getElementById('pulsador').click()`);
      const fps = await pg.evaluate(`new Promise(res=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<3000)requestAnimationFrame(f);else res(n/3);};requestAnimationFrame(f);})`);
      (samples[name + '/' + perfil] ||= []).push(+fps.toFixed(1)); await pg.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await pg.close();
    }
    const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const perf = Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, { fps: v, mediana: med(v) }]));
    R.perf = perf;
    check('U7 fps (mediana de 3 rondas alternadas) del candidato ≥ 85 % de la publicada, escritorio y móvil CPU×4 emulada', ['escritorio', 'móvil CPU×4'].every((pf) => perf['candidato/' + pf].mediana >= 0.85 * perf['publicada/' + pf].mediana), perf);
  }
  check('Sin errores de página ni excepciones', errors.length === 0, errors.length ? errors.slice(0, 4) : 'ninguno');
  check('Sin recursos 404', e404.length === 0, e404.length ? e404 : 'ninguno');
} catch (e) { console.log('EXCEPCIÓN', e && e.stack || e); checks.push({ id: 'excepción', ok: false, detail: String(e && e.message) }); }
finally {
  if (process.env.HEAD_UI_OUT) fs.writeFileSync(process.env.HEAD_UI_OUT, JSON.stringify({ ...R, checks }, null, 1));
  const ok = checks.filter((c) => c.ok).length; console.log(`\n${ok}/${checks.length} comprobaciones de interfaz de la cabeza móvil correctas.`);
  await browser.close(); sApp.close(); sBase?.close(); process.exit(ok === checks.length ? 0 : 1);
}
