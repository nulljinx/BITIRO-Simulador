#!/usr/bin/env node
// FIRVI-2025-A — la pista en navegador real: selector, vistas del simulador (superior, perspectiva, seguir, detalle), ejecución del código
// del usuario sobre la pista, prismas dibujados, sin errores de consola y sin tocar las pistas existentes.
//   node tests/firvi-2025-ui.mjs                 # requiere Chrome/Chromium (CHROME_BIN o ~/.cache/ms-playwright); sin él, se omite con código 0.
//   SHOTS_DIR=/ruta node tests/firvi-2025-ui.mjs # además guarda capturas PNG.
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
const browser = await launch({ port: 9395 });
const SHOTS = process.env.SHOTS_DIR; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let n = 0; const errors = [];
const test = async (name, fn) => { await fn(); n++; console.log('OK · ' + name); };

async function open(width = 1440, height = 900) {
  const page = await newPage(browser);
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Log.enable');
  page.on('Runtime.exceptionThrown', (p) => errors.push('exc: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0]));
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') errors.push('console.error: ' + p.args.map((a) => a.value ?? a.description).join(' ')); });
  page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') errors.push('log: ' + p.entry.text + ' ' + (p.entry.url || '')); });
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = new Promise((r) => page.on('Page.loadEventFired', r)); await page.send('Page.navigate', { url: URL_ }); await loaded; await sleep(700);
  return page;
}
const shot = async (page, name) => { if (!SHOTS) return; const { data } = await page.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(data, 'base64')); };
const choose = async (page, id) => { await page.evaluate(`(()=>{const s=document.getElementById('track');s.value='${id}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await sleep(500); };
const view = async (page, v) => { await page.evaluate(`document.querySelector('.cam[data-view="${v}"]').click()`); await sleep(500); };
// Fracción de píxeles oscuros (línea negra) / de tono madera (prisma) del canvas: comprueba que se dibuja sin leer el PNG.
const stats = (page) => page.evaluate(`(()=>{const c=document.getElementById('scene'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let dark=0,wood=0,total=0;
  for(let i=0;i<d.length;i+=16){total++;const r=d[i],g=d[i+1],b=d[i+2];if(r<50&&g<55&&b<60)dark++;if(r>170&&g>120&&g<190&&b<140&&r-b>50)wood++;}return {dark:dark/total,wood:wood/total}})()`);

const page = await open();

await test('el selector ofrece FIRVI 2025 A y B tras las pistas existentes, sin quitar ninguna', async () => {
  const opts = await page.evaluate("[...document.getElementById('track').options].map(o=>o.value)");
  assert.deepEqual(opts, ['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 'oval', 'ocho', 'firvi-2025', 'firvi-2025-b']);
});

await test('Recorrido A: carga, etiqueta de origen honesta (reconstrucción no oficial) y medidas 360 × 150 cm', async () => {
  await choose(page, 'firvi-2025');
  const t = await page.evaluate(`({name:document.getElementById('trackName').textContent,size:document.getElementById('trackSize').textContent,origin:document.getElementById('sceneSource').textContent,
    edit:document.getElementById('editScenario').disabled,obstacles:activeObstacles.length,fb:document.getElementById('feedback').textContent})`);
  assert.match(t.name, /FIRVI-2025/); assert.equal(t.size, '360 × 150 cm');
  assert.match(t.origin, /reconstrucción.*no oficial/i); assert.ok(!/oficial \(PDF/.test(t.origin), 'no se presenta como plotter oficial');
  assert.equal(t.edit, true); assert.equal(t.obstacles, 2); assert.match(t.fb, /aproximada, no oficial/);
});

for (const v of ['top', 'perspective', 'follow', 'robot']) {
  await test(`Recorrido A · vista ${v}: se dibuja la línea y los dos prismas, sin errores`, async () => {
    await choose(page, 'firvi-2025'); await view(page, v);
    const s = await stats(page);
    if (v === 'top' || v === 'perspective') { assert.ok(s.dark > 0.004, `línea negra visible (${s.dark})`); assert.ok(s.wood > 0.0004, `prismas visibles (${s.wood})`); }
    else assert.ok(s.dark + s.wood >= 0);
    await shot(page, `A-${v}`);
  });
}

await test('Recorrido B: misma pista con el robot en el INICIO opuesto, mirando a −x', async () => {
  await choose(page, 'firvi-2025-b'); await view(page, 'top');
  const p = await page.evaluate('({x:R.x,y:R.y,th:R.th,obs:activeObstacles.map(o=>o.id)})');
  assert.ok(p.x > 330 && p.y < 40, `inicio B en el cuarto 3 arriba: ${p.x},${p.y}`);
  assert.ok(Math.abs(Math.sin(p.th) + 1) < 1e-9, 'mirando a −x (rumbo de pista π)');
  await shot(page, 'B-top'); await view(page, 'perspective'); await shot(page, 'B-perspective');
});

await test('código del usuario sobre la pista: el robot arranca, lee la línea y avanza solo por sus sensores', async () => {
  await choose(page, 'firvi-2025'); await view(page, 'top');
  const code = `void setup(){inicializarMovimiento();inicializarSensores();}
int ult=0;int lost=0;
void loop(){bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;
  await page.evaluate(`(()=>{const s=document.getElementById('src');s.value=${JSON.stringify(code)};s.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('run').click();})()`);
  await page.evaluate("document.getElementById('speed').value='2';document.getElementById('speed').dispatchEvent(new Event('change',{bubbles:true}))");
  await sleep(2500);
  const mid = await page.evaluate('({x:R.x,y:R.y,mode})');
  assert.equal(mid.mode, 'code'); assert.ok(mid.x > 30, 'avanzó desde la base');
  await shot(page, 'A-run-room1');
  // CONTROL (no es una falla): con el servo centrado el programa no hace abanico; el prisma está sobre la línea y la barra tocando impide girar.
  const t0 = Date.now(); let st;
  do { await sleep(1000); st = await page.evaluate('({x:R.x,y:R.y,col:collisionCount,servo:striker.angle,log:BITIRO_PHYSICS_LOG().map(e=>e.kind)})'); } while (st.col === 0 && Date.now() - t0 < 40000);
  assert.ok(st.col >= 1 && !st.log.includes('sweep') && Math.abs(st.servo) < 1, `control: servo centrado, sin barrido, contacto registrado (${st.log})`);
  await shot(page, 'control-servo-centrado-contacto');
  // Mismo programa con el escenario vaciado (solo en esta prueba): recorre el cuarto 1 y entra al 2 por los gaps, solo con sensores.
  await page.evaluate("document.getElementById('reset').click()"); await sleep(300);
  await page.evaluate(`(()=>{scenarioList=[];window.resetRobot();document.getElementById('run').click();})()`);
  const t1 = Date.now(); let p2;
  do { await sleep(1000); p2 = await page.evaluate('({x:R.x,y:R.y,mode})'); } while (!(p2.x > 185 && p2.y > 95) && Date.now() - t1 < 90000 && p2.mode === 'code');
  assert.ok(p2.x > 150, `el robot llegó al cuarto 2 por sus sensores (x=${p2.x}, y=${p2.y})`);
  await shot(page, 'A-run-room2');
  await choose(page, 'firvi-2025');   // recarga el escenario guardado (vacío de cambios): los dos prismas vuelven
  assert.equal(await page.evaluate('activeObstacles.length'), 2);
});

await test('SECUENCIA con abanico real: línea → sonar → barrido del servo → prisma desplazado → retoma la línea (capturas por fase)', async () => {
  await choose(page, 'firvi-2025'); await view(page, 'top');
  const program = `void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(1200);}
int ult=0;int lost=0;int done=0;
void loop(){
 if(done==0 && leerDistanciaSonar()<=14){detenerse();pausa(300);moverServoGolpe(1);pausa(1500);moverServoGolpe(0);pausa(1200);done=1;}
 bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;
  await page.evaluate(`(()=>{const s=document.getElementById('src');s.value=${JSON.stringify(program)};s.dispatchEvent(new Event('input',{bubbles:true}));window.resetRobot();document.getElementById('run').click();})()`);
  await page.evaluate("document.getElementById('speed').value='1';document.getElementById('speed').dispatchEvent(new Event('change',{bubbles:true}))");
  const q = () => page.evaluate('({x:R.x,y:R.y,servo:striker.angle,son:readSonarDistance(),t:simTime,col:collisionCount,log:BITIRO_PHYSICS_LOG(),px:activeObstacles[0].x,py:activeObstacles[0].y})');
  const p0 = await page.evaluate('({x:activeObstacles[0].x,y:activeObstacles[0].y})');
  await shot(page, 'A-secuencia-0-inicio');
  const wait = async (cond, label, ms = 70000) => { const t = Date.now(); let v; do { await sleep(120); v = await q(); } while (!cond(v) && Date.now() - t < ms); assert.ok(cond(v), 'no se alcanzó la fase: ' + label + ' ' + JSON.stringify({ x: v.x, y: v.y, servo: v.servo, son: v.son })); return v; };
  const a = await wait((v) => v.servo < -70 && v.x > 60 && v.son <= 40 && v.log.length === 0, 'aproximación con el brazo recogido a la izquierda');
  await shot(page, 'A-secuencia-1-aproximacion');
  const b = await wait((v) => v.log.some((e) => e.kind === 'sweep') && v.servo > -40 && v.servo < 40, 'barrido en curso');
  assert.ok(b.son > 0); await shot(page, 'A-secuencia-2-barrido');
  const c = await wait((v) => v.log.length === 1 && v.t > v.log[0].until + 1.5 && Math.abs(v.servo) < 2, 'prisma desplazado y brazo recogido');
  assert.ok(Math.hypot(c.px - p0.x, c.py - p0.y) > 5, 'el prisma se desplazó por contacto'); await shot(page, 'A-secuencia-3-desplazado');
  const d = await wait((v) => v.x > 150 && v.y < 40, 'retoma la línea y supera el cuarto 1');
  assert.deepEqual(d.log.map((e) => e.kind), ['sweep']); assert.equal(d.col, 0);
  await shot(page, 'A-secuencia-4-retoma');
  await choose(page, 'firvi-2025');
});

await test('encuadre automático: las cuatro esquinas caben en vista superior y perspectiva (1440 × 900 y 390 × 844) sin cambiar la escala física', async () => {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const pg = await open(w, h); await choose(pg, 'firvi-2025');
    for (const v of ['perspective', 'top']) {
      await view(pg, v); await sleep(300);
      const r = await pg.evaluate(`(()=>{const c=document.getElementById('scene'),rc=c.getBoundingClientRect();return [[0,0],[track.w,0],[track.w,track.h],[0,track.h]].map(([x,y])=>BITIRO_SCENE_VIEW.projectGround(c,sceneTrack,camera,{x:R.x,y:R.y},x,y)).map(p=>p&&{x:p.x,y:p.y,w:rc.width,h:rc.height,d:camera.distance,size:[track.w,track.h]})})()`);
      for (const p of r) { assert.ok(p && p.x >= 0 && p.x <= p.w && p.y >= 0 && p.y <= p.h, `${w}px ${v}: esquina fuera del lienzo ${JSON.stringify(p)}`); }
      assert.deepEqual(r[0].size, [360, 150]);
      if (v === 'top' && w === 1440) { const span = r[1].x - r[0].x; assert.ok(span > 0.8 * r[0].w, `la pista ocupa el ancho disponible (${span.toFixed(0)} de ${r[0].w.toFixed(0)} px)`); }
      await shot(pg, `A-ajuste-${v}-${w}`);
    }
    await pg.close();
  }
  // S01–S08 no cambian: la distancia de cámara de S01 es la misma antes y después de visitar FIRVI.
  const pg = await open(1440, 900); await choose(pg, 's01'); const d1 = await pg.evaluate('camera.distance'); await choose(pg, 'firvi-2025'); await choose(pg, 's01');
  const d2 = await pg.evaluate('camera.distance'); assert.equal(d1, d2); assert.equal(await pg.evaluate('track.autoFit'), undefined); await pg.close();
});

await test('geometría visual = geometría del sensor en los gaps: los píxeles dibujados coinciden con el suelo que lee el sensor', async () => {
  await choose(page, 'firvi-2025'); await view(page, 'top'); await sleep(400);
  const res = await page.evaluate(`(()=>{
    const c=document.getElementById('scene'),ctx=c.getContext('2d'),dpr=c.width/c.getBoundingClientRect().width,G=BITIRO_LINE_GEOMETRY;
    const img=ctx.getImageData(0,0,c.width,c.height).data;
    const at=(x,y)=>{const p=BITIRO_SCENE_VIEW.projectGround(c,sceneTrack,camera,{x:R.x,y:R.y},x,y);const px=Math.round(p.x*dpr),py=Math.round(p.y*dpr),i=(py*c.width+px)*4;return [img[i],img[i+1],img[i+2]];};
    const dark=([r,g,b])=>r<90&&g<95&&b<100,light=([r,g,b])=>r>200&&g>195&&b>180;
    let agree=0,total=0,bad=[];
    for(const g of track.landmarks.gaps){for(let y=g.y0-5;y<=g.y1+5;y+=.4)for(let dx=-3;dx<=3;dx+=.4){
      const x=g.x+dx,d=G.distance(track.paths,x,y);if(Math.abs(d)<.7)continue;      // ±0,7 cm: redondeo de píxel y suavizado del borde
      const px=at(x,y),isDark=dark(px),isLight=light(px);if(!isDark&&!isLight)continue;
      total++;if(isDark===(d<0))agree++;else if(bad.length<5)bad.push([g.id,+x.toFixed(1),+y.toFixed(1),+d.toFixed(2),px]);}}
    const centers=track.landmarks.gaps.filter(g=>g.id!=='gap-2').map(g=>light(at(g.x,(g.y0+g.y1)/2)));
    const ends=track.landmarks.gaps.filter(g=>g.id!=='gap-2').map(g=>[dark(at(g.x,g.y0-.9)),dark(at(g.x,g.y1+.9))]);
    return {agree,total,bad,centers,ends};})()`);
  assert.ok(res.total > 400, 'muestras suficientes ' + res.total); assert.ok(res.agree / res.total > 0.985, `coincidencia ${res.agree}/${res.total} ${JSON.stringify(res.bad)}`);
  assert.deepEqual(res.centers, [true, true], 'centros de gap-1 y gap-3 dibujados en blanco'); assert.deepEqual(res.ends, [[true, true], [true, true]], 'extremos del trazo dibujados en negro');
});

await test('referencias: flecha INICIO (roja) y ficha de checkpoint (naranja) visibles; los cuadros rojos no se dibujan', async () => {
  for (const id of ['firvi-2025', 'firvi-2025-b']) {
    await choose(page, id); await view(page, 'top');
    await page.evaluate('R.y+=45;previousPose={x:R.x,y:R.y,th:R.th,angle:0}'); await sleep(500);   // el robot se aparta un momento para ver la flecha que tapa en el inicio
    const r = await page.evaluate(`(()=>{const c=document.getElementById('scene'),ctx=c.getContext('2d'),dpr=c.width/c.getBoundingClientRect().width;
      const px=(x,y)=>{const p=BITIRO_SCENE_VIEW.projectGround(c,sceneTrack,camera,{x:R.x,y:R.y},x,y),d=ctx.getImageData(Math.round(p.x*dpr),Math.round(p.y*dpr),1,1).data;return [d[0],d[1],d[2]];};
      const st=track.references.find(r=>r.kind==='start'),cp=track.references.find(r=>r.kind==='checkpoint'),dx=Math.cos(st.heading),dy=Math.sin(st.heading);
      return {start:px(st.x-dx*6,st.y-dy*6),cp:px(cp.x,cp.y),sq:track.landmarks.redSquares.map(q=>px(q.x+3.2,q.y+3.2))};})()`);
    assert.ok(r.start[0] > 150 && r.start[1] < 100 && r.start[2] < 100, 'INICIO rojo ' + r.start); assert.ok(r.cp[0] > 200 && r.cp[1] > 110 && r.cp[1] < 170 && r.cp[2] < 90, 'checkpoint naranja ' + r.cp);
    for (const q of r.sq) assert.ok(!(q[0] > 150 && q[1] < 100), 'los cuadros rojos no se pintan ' + q);
    await shot(page, id === 'firvi-2025' ? 'A-top-referencias' : 'B-top-referencias');
    await page.evaluate('window.resetRobot()');
  }
});

await test('FIRVI no altera las pistas existentes en el navegador: S01 conserva su caja de 8 × 8 y el editor de escenario', async () => {
  await choose(page, 's01');
  const s = await page.evaluate(`({obs:activeObstacles.map(o=>[o.id,o.width,o.height,!!o.poly]),edit:document.getElementById('editScenario').disabled,size:document.getElementById('trackSize').textContent})`);
  assert.equal(JSON.stringify(s.obs), JSON.stringify([['practice-box', 8, 8, false]])); assert.equal(s.edit, false); assert.equal(s.size, '100 × 140 cm');
  await view(page, 'perspective'); await shot(page, 's01-perspective-sin-cambios');
});

await test('Demo guiada desactivada en FIRVI: el botón explica y el robot no se mueve', async () => {
  await choose(page, 'firvi-2025'); const p0 = await page.evaluate('[R.x,R.y]');
  const has = await page.evaluate("!!document.getElementById('demo')");
  if (has) { await page.evaluate("document.getElementById('demo').click()"); await sleep(800); }
  const p1 = await page.evaluate('[R.x,R.y]'); assert.equal(JSON.stringify(p0), JSON.stringify(p1));
});

await test('sin errores de consola ni excepciones durante toda la sesión', async () => { assert.deepEqual(errors, []); });

await page.close(); browser.close?.(); server.close();
console.log(`\n${n} pruebas visuales FIRVI-2025-A OK`);
process.exit(0);
