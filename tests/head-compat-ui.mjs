// node --experimental-websocket tests/head-compat-ui.mjs   (opcional: OLD_DIR=<árbol con los archivos anteriores>)
// HEAD-CANVAS-INTEGRATION-1 · carga en Chrome real con combinaciones de archivos antiguos/nuevos y módulos de cabeza presentes/ausentes (404).
// Reproduce lo que ocurre durante un despliegue o con caché parcial. Sin OLD_DIR solo se prueban combinaciones con los archivos nuevos
// (index.html «antiguo» = el actual sin las dos etiquetas <script> de la cabeza).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const { launch, newPage, findChrome } = await import('./perf/cdp.mjs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = process.env.OLD_DIR ? path.resolve(process.env.OLD_DIR) : null;
try { findChrome(); } catch { console.log('SKIP · sin Chrome'); process.exit(0); }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'";
const VARIED = ['index.html', 'simulator.js', 'iroh-runtime.js', 'renderer3d.js'];
let combo = null;
const stripHead = (h) => h.replace('<script src="head-sonar.js"></script><script src="head-config.js"></script>', '');
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const name = p.slice(1);
  let body = null;
  if (name === 'head-sonar.js' && !combo.sonar) body = null;
  else if (name === 'head-config.js' && !combo.config) body = null;
  else {
    let dir = ROOT; const v = combo[name];
    if (VARIED.includes(name) && v === 'old') dir = OLD || ROOT;
    const f = path.join(dir, name);
    if (fs.existsSync(f) && fs.statSync(f).isFile() && f.startsWith(dir + path.sep)) { body = fs.readFileSync(f); if (name === 'index.html' && v === 'old' && !OLD) body = Buffer.from(stripHead(body.toString('utf8'))); }
  }
  if (body === null) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(name)] || 'application/octet-stream', 'content-security-policy': CSP, 'cache-control': 'no-store' }); r.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch({ port: 9391 });
const verOpts = OLD ? ['old', 'new'] : ['new'];
const combos = [];
for (const idx of ['old', 'new']) for (const sim of verOpts) for (const rt of verOpts) for (const rd of verOpts) for (const sonar of (idx === 'old' ? [true] : [true, false])) for (const config of (idx === 'old' ? [true] : [true, false]))
  combos.push({ 'index.html': idx, 'simulator.js': sim, 'iroh-runtime.js': rt, 'renderer3d.js': rd, sonar, config });
const OLD_PROGRAM = 'void setup(){inicializarMovimiento();inicializarSensores();} void loop(){ if(lineaCentral()){avanzar(30);}else if(lineaIzquierda()){avanzar(10,30);}else if(lineaDerecha()){avanzar(30,10);}else{avanzar(30);} }';
const HEAD_PROGRAM = '#include <KnightRoboticsLibs_Iroh.h>\nvoid setup(){inicializarCabeza();inicializarSensores();moverServoYaw(45);}\nvoid loop(){pausa(10);}';
let failures = 0, n = 0; const rows = []; let refPose = null;
try {
  for (const c of combos) {
    combo = c; n++;
    const page = await newPage(browser); const errors = [];
    await page.send('Page.enable'); await page.send('Runtime.enable');
    browser.on((m) => { if (m.sessionId !== page.sessionId) return; if (m.method === 'Runtime.exceptionThrown') errors.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 160)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error ' + JSON.stringify(m.params.args.map((a) => a.value || a.description)).slice(0, 120)); });
    await page.send('Page.navigate', { url: URL_ }); await sleep(900);
    const r = await page.evaluate(`(()=>{
      window.requestAnimationFrame=()=>0;
      const out={};const $=id=>document.getElementById(id);
      const msg=()=>$('msg').innerHTML.replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim();
      const t=$('track');t.value='s01';t.dispatchEvent(new Event('change'));
      $('src').value=${JSON.stringify(OLD_PROGRAM)};$('run').click();$('pulsador').click();
      for(let i=0;i<600;i++)update(1/120);
      out.pose=[R.x,R.y,R.th].map(v=>+v.toFixed(4)).join();out.msgOld=msg();
      $('reset').click();
      $('src').value=${JSON.stringify(HEAD_PROGRAM)};$('run').click();
      for(let i=0;i<300;i++)update(1/120);
      out.msgHead=msg();out.hasHead=typeof HEAD_SONAR==='object'&&HEAD_SONAR!==null;
      out.target=out.hasHead?HEAD_SONAR.state.target:null;out.angle=out.hasHead?HEAD_SONAR.state.angle:null;
      try{render();out.render='ok'}catch(e){out.render='ERROR '+e.message}
      return out;})()`);
    await page.close();
    const idxNew = c['index.html'] === 'new', headLoaded = idxNew && c.sonar;
    const why = [];
    if (errors.length) why.push('errores de página: ' + errors.join(' | '));
    if (r.render !== 'ok') why.push('render: ' + r.render);
    if (/class=err|✖|Error/.test(r.msgOld) || /✖/.test(r.msgOld)) why.push('programa anterior con error: ' + r.msgOld.slice(0, 100));
    if (/⚠/.test(r.msgOld)) why.push('programa anterior con avisos: ' + r.msgOld.slice(0, 100));
    if (refPose === null) refPose = r.pose; else if (r.pose !== refPose) why.push(`pose del programa anterior ${r.pose} ≠ ${refPose}`);
    if (/✖/.test(r.msgHead)) why.push('programa de cabeza con error: ' + r.msgHead.slice(0, 120));
    if (headLoaded && c['iroh-runtime.js'] === 'new') { if (/⚠/.test(r.msgHead)) why.push('aviso inesperado con módulo cargado: ' + r.msgHead.slice(0, 120)); if (r.target !== 45) why.push('objetivo ' + r.target + ' ≠ 45'); }
    else if (!/⚠.*no tiene efecto/.test(r.msgHead)) why.push('se esperaba aviso «no tiene efecto»: ' + r.msgHead.slice(0, 120));
    if (c['iroh-runtime.js'] === 'new' && !headLoaded && !/head-sonar\.js/.test(r.msgHead)) why.push('el aviso no explica la causa (head-sonar.js)');
    const name = `index:${c['index.html']} sim:${c['simulator.js']} runtime:${c['iroh-runtime.js']} render:${c['renderer3d.js']} sonar:${c.sonar ? 'sí' : '404'} config:${c.config ? 'sí' : '404'}`;
    rows.push({ combo: name, ok: why.length === 0, why, headLoaded, target: r.target, aviso: (r.msgHead.match(/⚠[^⚠]*/) || [''])[0].slice(0, 140) });
    if (why.length) { failures++; console.log('FALLA', name, '→', why.join(' ; ')); } else console.log('OK  ', name, headLoaded ? '(cabeza activa)' : '(sin cabeza)');
  }
} finally {
  if (process.env.HEAD_COMPAT_OUT) fs.writeFileSync(process.env.HEAD_COMPAT_OUT, JSON.stringify({ old: !!OLD, combos: rows }, null, 1));
  await browser.close(); server.close();
}
console.log(`\n${n - failures}/${n} combinaciones de carga correctas${OLD ? ' (con archivos antiguos y nuevos)' : ' (solo archivos nuevos)'}.`);
process.exit(failures ? 1 : 0);
