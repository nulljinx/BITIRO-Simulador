/* node tests/calibration.cjs — SIM-CALIBRATION-1 (lógica): modelo simulado de sensor + light field + pose manual + runtime + LCD.
   Todo se comprueba ejecutando el código real del producto con el harness headless de SIM-1 (sin navegador, sin red).
   La interfaz (layout, arrastre con puntero, 1366/1024/390) se prueba en el navegador con tests/calibration-ui.mjs.
   If the NNJ did not program a reading to appear on the LCD, calibration does not show it.
   The simulated sensor model is not yet a physical calibration of the real IROH hardware. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {load,root}=require('./sim1/harness.cjs');
const {S}=require('./sim1/scenarios.cjs');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const read=(...a)=>fs.readFileSync(path.join(root,a[a.length-1]),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));   // el harness corre en un vm: los objetos/arrays tienen otro realm
const sensors=h=>[0,1,2].map(k=>h.js(`readLine(${k})`));
const setPose=(h,x,y,th)=>h.js(`R.x=${x};R.y=${y};R.th=${th};previousPose={x:R.x,y:R.y,th:R.th,angle:0}`);
const LEGACY='compute(k,surface,x,y,DEFAULT)';
const PRINT_CENTER='void setup(){inicializarMovimiento();inicializarSensores();inicializarPantalla();} void loop(){escribirPantalla(0,0,leerSensorLineaCentral());}';
const SILENT='void setup(){inicializarMovimiento();inicializarSensores();inicializarPantalla();} void loop(){avanzar(20);}';

// ───────── Modelo de sensor ─────────
test('Escala preservada: LINE_SENSOR.raw/geometry/normalized/detected y umbral 500 intactos (0–1023, 155 blanco … 865 negro)',()=>{
 const h=load();
 assert.deepEqual(plain(h.js('LINE_SENSOR.geometry')),{front:6,spread:2.8});
 assert.equal(h.js('LINE_SENSOR.raw(0)'),155);assert.equal(h.js('LINE_SENSOR.raw(1)'),865);
 assert.equal(h.js('LINE_SENSOR.normalized(155,0)'),0);assert.equal(h.js('LINE_SENSOR.normalized(865,2)'),1000);
 assert.equal(h.js('LINE_SENSOR.profile.threshold'),500);assert.equal(h.js('LINE_SENSOR.profile.calibrated'),false);
});
test('REFERENCIA DETERMINISTA: valores numéricos EXACTOS de LINE_SENSOR.read() en posiciones fijas (congelan el modelo SIMULADO)',()=>{
 // Estos valores congelan el modelo SIMULADO de SIM-CALIBRATION-1 (ganancia, desplazamiento, light field y variación local).
 // NO son mediciones físicas del IROH real y deberán revisarse durante PHYSICAL-CALIBRATION.
 // Un cambio futuro de ganancia (1,03→1,06), desplazamiento (+4→+8), light field o variación local rompe esta prueba a propósito.
 // (x,y) = posición del SENSOR sobre el plotter en cm; cobertura 0 = blanco, 1 = negro; orden L/C/R.
 const REF=[
  {x:50,y:100,coverage:0,expected:[161,155,144]},{x:50,y:100,coverage:1,expected:[886,859,827]},
  {x:28,y:45,coverage:0,expected:[166,159,151]},{x:28,y:45,coverage:1,expected:[913,885,854]},
 ];
 const h=load();
 for(const r of REF){
  const got=plain(h.js(`[0,1,2].map(k=>LINE_SENSOR.read(k,${r.coverage},${r.x},${r.y}))`));
  assert.deepEqual(got,r.expected,`LINE_SENSOR.read en (${r.x},${r.y}) cobertura ${r.coverage}: obtenido ${got} esperado ${r.expected}`);
 }
});
test('Compatibilidad: con el modelo NEUTRO la lectura es EXACTAMENTE la anterior (barrido de cobertura × 3 sensores × posiciones)',()=>{
 const h=load();
 const bad=h.js(`(()=>{let n=0;for(let c=0;c<=1.0001;c+=.0025)for(const k of [0,1,2])for(const [x,y] of [[0,0],[12.3,45.6],[50,100],[99,199]])
  if(SENSOR_MODEL.compute(k,155+710*Math.min(1,c),x,y,SENSOR_MODEL.NEUTRAL)!==LINE_SENSOR.raw(c))n++;return n})()`);
 assert.equal(bad,0);
});
test('Los umbrales de los fixtures se mantienen: en TODO el plotter, blanco < umbral < negro con margen (sin detectar blanco ni perder el negro)',()=>{
 const h=load();
 const r=plain(h.js(`(()=>{let wMax=0,bMin=1e9,wDet=0,bMiss=0,n=0;
  for(let x=0;x<=100;x+=1)for(let y=0;y<=200;y+=1)for(const k of [0,1,2]){
   const w=LINE_SENSOR.read(k,0,x,y),b=LINE_SENSOR.read(k,1,x,y);n++;
   wMax=Math.max(wMax,w);bMin=Math.min(bMin,b);
   if(LINE_SENSOR.detected(w,k))wDet++;if(!LINE_SENSOR.detected(b,k))bMiss++;}
  return {wMax,bMin,wDet,bMiss,n}})()`));
 assert.equal(r.wDet,0,'ninguna lectura de blanco debe superar el umbral 500');
 assert.equal(r.bMiss,0,'toda lectura de negro debe superar el umbral 500');
 assert.ok(r.wMax<=200,'blanco máx '+r.wMax);assert.ok(r.bMin>=780,'negro mín '+r.bMin);
 console.log(`   rango blanco ≤ ${r.wMax}, negro ≥ ${r.bMin} (${r.n} lecturas)`);
});
test('Lecturas enteras en 0–1023, dependen del sensor y son DISTINTAS entre izquierdo/central/derecho sobre superficie uniforme (estable)',()=>{
 const h=load();
 const r=h.js(`(()=>{let minSpread=1e9,same=0,n=0;
  for(let x=2;x<=98;x+=3)for(let y=2;y<=198;y+=3){const v=[0,1,2].map(k=>LINE_SENSOR.read(k,0,x,y));n++;
   if(v.some(q=>!Number.isInteger(q)||q<0||q>1023))return {int:false};
   if(v[0]===v[1]||v[1]===v[2]||v[0]===v[2])same++;minSpread=Math.min(minSpread,v[0]-v[2]);}
  return {int:true,same,minSpread,n}})()`);
 assert.equal(r.int,true);assert.equal(r.same,0,'los tres sensores nunca coinciden sobre blanco uniforme');
 assert.ok(r.minSpread>=10,'diferencia izquierdo−derecho ≥ 10 puntos: '+r.minSpread);
 // estable: repetir la misma lectura no cambia nada
 const a=plain(h.js('[0,1,2].map(k=>LINE_SENSOR.read(k,0,33.3,77.7))')),b=plain(h.js('[0,1,2].map(k=>LINE_SENSOR.read(k,0,33.3,77.7))'));assert.deepEqual(a,b);
});
test('DETERMINISMO: misma pose → misma lectura; mover a otra pose y volver EXACTAMENTE a P recupera los valores (estricto)',()=>{
 const h=load();h.js("changeTrack('s02')");
 const P=[[49.23,140,0],[40.7,120.3,0.4],[62.1,95.5,-1.1],[30,60.25,2.2]];
 for(const [x,y,th] of P){
  setPose(h,x,y,th);const first=sensors(h);
  for(let i=0;i<50;i++)assert.deepEqual(sensors(h),first);                    // repetido: idéntico
  setPose(h,x+17.3,y-23.9,th+.7);const other=sensors(h);                        // otra pose
  setPose(h,x,y,th);assert.deepEqual(sensors(h),first,'volver a P recupera la lectura');
  assert.notDeepEqual(other,first,'otra pose da otra lectura');
 }
});
test('SIN ALEATORIEDAD NI RELOJ: el camino de lectura no usa Math.random/Date/performance/frameCounter/simTime (fuente y ejecución)',()=>{
 const cal=read('calibration.js');
 const model=cal.slice(cal.indexOf('window.BITIRO_LIGHT_FIELD'),cal.indexOf('window.LINE_SENSOR'));
 const sim=read(root,'simulator.js');const rl=sim.slice(sim.indexOf('window.readLine=function'),sim.indexOf('// Cinemática centralizada'));
 const bad=/Math\s*\.\s*random|Date\s*\.\s*now|new\s+Date|performance\s*\.\s*now|frameCounter|simTime|requestAnimationFrame|crypto/;
 assert.ok(model.length>500&&rl.length>100,'bloques localizados');
 assert.ok(!bad.test(model),'modelo de sensor / light field');assert.ok(!bad.test(rl),'readLine');
 // ejecución: si el camino de lectura tocara el azar o el reloj, estos stubs lanzarían
 const h=load();h.js("changeTrack('s02')");
 const realRandom=Math.random;Math.random=()=>{throw new Error('Math.random en lectura de sensor');};
 const realNow=h.ctx.performance.now;h.ctx.performance.now=()=>{throw new Error('performance.now en lectura de sensor');};
 const realDate=h.ctx.Date;h.ctx.Date={now(){throw new Error('Date.now en lectura de sensor');}};
 try{for(let i=0;i<30;i++){setPose(h,40+i,100+i,i*.1);sensors(h);}
  h.js('simTime=123.4;frameCounter=987');const a=sensors(h);h.js('simTime=0;frameCounter=0');assert.deepEqual(sensors(h),a,'independiente de simTime/frameCounter');
 }finally{Math.random=realRandom;h.ctx.performance.now=realNow;h.ctx.Date=realDate;}
});
test('Posición REAL de cada sensor: usa front=6 y spread=2.8 con la rotación R.th (izquierdo/central/derecho); no usa R.x/R.y para los tres',()=>{
 const h=load();h.js("changeTrack('s01')");
 const dark=k=>sensors(h)[k]>600;
 // th=0 (frente hacia −y): los sensores quedan en x = R.x + (k−1)·2.8, y = R.y − 6. Línea vertical bajo SOLO el sensor k.
 for(const k of [0,1,2]){
  h.js(`track.paths=[{w:1.2,p:[[${50+(k-1)*2.8},60],[${50+(k-1)*2.8},140]]}]`);setPose(h,50,100,0);
  assert.deepEqual([0,1,2].map(dark),[0,1,2].map(q=>q===k),'th=0 línea bajo sensor '+k);
 }
 // th=π/2 (frente hacia +x): sensores en x = R.x + 6, y = R.y + (k−1)·2.8. Línea horizontal bajo SOLO el sensor k.
 for(const k of [0,1,2]){
  h.js(`track.paths=[{w:1.2,p:[[40,${100+(k-1)*2.8}],[120,${100+(k-1)*2.8}]]}]`);setPose(h,50,100,Math.PI/2);
  assert.deepEqual([0,1,2].map(dark),[0,1,2].map(q=>q===k),'th=π/2 línea bajo sensor '+k);
 }
 // las tres posiciones son distintas entre sí
 h.js(`track.paths=[{w:1.2,p:[[50,60],[50,140]]}]`);setPose(h,50,100,0);assert.deepEqual([0,1,2].map(dark),[false,true,false]);
});
test('Superficie: barrer el sensor central de claro → oscuro → claro responde de forma consistente (blanco < umbral < negro, simétrico)',()=>{
 const h=load();h.js("changeTrack('s01')");
 h.js(`track.paths=[{w:2.6,p:[[50,60],[50,140]]}]`);
 const row=[];for(let i=-60;i<=60;i++){setPose(h,50+i*.1,100,0);row.push(h.js('readLine(1)'));}
 assert.ok(row[0]<200&&row[row.length-1]<200,'extremos claros');assert.ok(Math.max(...row)>780,'centro oscuro');
 const mid=row.indexOf(Math.max(...row));assert.ok(Math.abs(mid-60)<=8,'máximo cerca de la línea');
 // monótona creciente hasta el máximo (con variación local ≤ 3 puntos) y decreciente después
 let up=0,down=0;for(let i=1;i<row.length;i++){if(i<=mid&&row[i]<row[i-1]-4)up++;if(i>mid&&row[i]>row[i-1]+4)down++;}
 assert.equal(up,0);assert.equal(down,0);
});
test('LIGHT FIELD: continuo, acotado, determinista; mismo tipo de superficie en dos zonas alejadas puede leerse distinto; volver recupera el valor',()=>{
 const h=load();
 const r=h.js(`(()=>{const F=BITIRO_LIGHT_FIELD;let lo=9,hi=0,jump=0;
  for(let x=0;x<=100;x+=.5)for(let y=0;y<=200;y+=.5){const v=F.lightAt(x,y);lo=Math.min(lo,v);hi=Math.max(hi,v);
   if(x<100)jump=Math.max(jump,Math.abs(F.lightAt(x+.5,y)-v));if(y<200)jump=Math.max(jump,Math.abs(F.lightAt(x,y+.5)-v));}
  const a=[0,1,2].map(k=>LINE_SENSOR.read(k,0,28,45)),b=[0,1,2].map(k=>LINE_SENSOR.read(k,0,74,125)),a2=[0,1,2].map(k=>LINE_SENSOR.read(k,0,28,45));
  return {lo,hi,jump,a,b,a2,pure:F.lightAt(10,10)===F.lightAt(10,10)}})()`);
 assert.ok(r.lo>=.9&&r.hi<=1.1,`rango ${r.lo.toFixed(3)}–${r.hi.toFixed(3)}`);assert.ok(r.jump<.01,'sin saltos: '+r.jump);assert.ok(r.pure);
 assert.ok(r.a.some((v,k)=>Math.abs(v-r.b[k])>=5),'zonas alejadas: lectura distinta '+r.a+' vs '+r.b);
 assert.deepEqual(r.a,r.a2,'volver a la posición recupera el resultado');
});
test('Variación local: pequeña (≤ ±2,2), suave (Lipschitz), determinista y con efecto a 1–2 cm; media ≈ 0',()=>{
 const h=load();
 const r=h.js(`(()=>{const M=SENSOR_MODEL;let mx=0,lip=0,sum=0,n=0,eff=0;
  for(let x=0;x<=60;x+=.37)for(let y=0;y<=60;y+=.41)for(const k of [0,1,2]){const v=M.micro(k,x,y);mx=Math.max(mx,Math.abs(v));sum+=v;n++;
   lip=Math.max(lip,Math.abs(M.micro(k,x+.1,y)-v)/.1,Math.abs(M.micro(k,x,y+.1)-v)/.1);
   const d=Math.max(Math.abs(M.micro(k,x+1.5,y)-v),Math.abs(M.micro(k,x,y+1.5)-v));if(d>=.5)eff++;}
  return {mx,lip,mean:sum/n,effFrac:eff/n,again:M.micro(1,3.3,4.4)===M.micro(1,3.3,4.4)}})()`);
 assert.ok(r.mx<=2.2+1e-9,'amplitud '+r.mx);assert.ok(r.lip<=8,'suave: pendiente máx '+r.lip.toFixed(2)+' por cm');assert.ok(Math.abs(r.mean)<.3,'media '+r.mean);
 assert.ok(r.effFrac>.4,'mover 1,5 cm cambia la variación en ≥40 % de los puntos: '+r.effFrac.toFixed(2));assert.ok(r.again);
});
test('Perfiles de sensor SIMULADOS centralizados en calibration.js (ganancia/offset pequeños); ningún otro archivo del producto los define',()=>{
 const h=load();
 const d=plain(h.js('({gain:[...SENSOR_MODEL.DEFAULT.gain],offset:[...SENSOR_MODEL.DEFAULT.offset],amp:SENSOR_MODEL.DEFAULT.microAmp})'));
 assert.ok(d.gain.every(g=>Math.abs(g-1)<=.05),'ganancias dentro de ±5 %');assert.ok(d.offset.every(o=>Math.abs(o)<=8),'offsets ≤ 8 puntos');assert.ok(d.amp<=3);
 for(const f of ['simulator.js','iroh-runtime.js','renderer3d.js','ui-shell.js','calibration-mode.js','strike-physics.js','tracks.js','extra-tracks.js','scenario-props.js','scenario-editor.js'])
  assert.ok(!/gain\s*:|offset\s*:\s*\[|microAmp|lightAt\s*[=(]/.test(read(root,f).replace(/lightAt\s*:/g,'')),f+' no debe definir números del modelo');
 assert.match(read(root,'calibration.js'),/not yet a physical calibration of the real IROH hardware/);
});

// ───────── Pose manual y runtime ─────────
test('Pose manual: place() mueve R.x/R.y/R.th (finitos), respeta el área útil y rechaza entradas no finitas',()=>{
 const h=load();h.js("changeTrack('s02')");
 const b=plain(h.js('BITIRO_MANUAL.bounds()'));assert.ok(Math.abs(b.minX-8.3)<1e-9&&b.maxX===100-8.3&&b.maxY===200-8.3);
 assert.equal(h.js('BITIRO_MANUAL.place(30,150,0.5)'),true);assert.deepEqual([h.js('R.x'),h.js('R.y'),h.js('R.th')],[30,150,.5]);
 h.js('BITIRO_MANUAL.place(-500,-500,0)');assert.deepEqual([h.js('R.x'),h.js('R.y')],[b.minX,b.minY]);
 h.js('BITIRO_MANUAL.place(9999,9999,0)');assert.deepEqual([h.js('R.x'),h.js('R.y')],[b.maxX,b.maxY]);
 for(const bad of ['NaN,10,0','10,Infinity,0','10,10,NaN','undefined,1,1'])assert.equal(h.js(`BITIRO_MANUAL.place(${bad})`),false);
 assert.deepEqual([h.js('R.x'),h.js('R.y')],[b.maxX,b.maxY],'una entrada no finita no cambia la pose');
 h.js('BITIRO_MANUAL.place(50,100,7*Math.PI)');assert.ok(Math.abs(h.js('R.th'))<=Math.PI+1e-9&&Number.isFinite(h.js('R.th')),'ángulo normalizado');
});
test('Pose manual: no coloca el robot encima de una caja (props intactos)',()=>{
 const h=load();h.js("changeTrack('s01')");
 const box=plain(h.js('activeObstacles.map(o=>({x:o.x,y:o.y,w:o.width,h:o.height}))'))[0];assert.ok(box,'S01 tiene caja de práctica');
 h.js(`R.x=50;R.y=130;R.th=0`);h.js(`BITIRO_MANUAL.place(${box.x+box.w/2},${box.y+box.h/2},0)`);
 assert.equal(h.js('IROH_MECHANICS.bodyOverlapsBox({x:R.x,y:R.y,th:R.th},activeObstacles[0])'),false,'el cuerpo no solapa la caja');
 assert.deepEqual(plain(h.js('activeObstacles.map(o=>[o.x,o.y])')),[[box.x,box.y]],'la caja no se movió');
});
// Colocación manual — ramas de colisión. La caja de práctica de S01 está en (46,94) de 8×8 cm y el cuerpo del IROH tiene radio 8,3 cm.
// Salvedad: manual placement collision currently protects the robot body; the gripper footprint is not part of this placement guard.
// (La protección de colocación manual solo considera el cuerpo del robot; la huella de la garra no forma parte de esta guarda. Deuda técnica conocida.)
const placeCase=(from,to,th)=>{
 const h=load();h.js("changeTrack('s01')");
 const box=plain(h.js('activeObstacles.map(o=>[o.x,o.y,o.width,o.height])'));
 h.js(`R.x=${from[0]};R.y=${from[1]};R.th=0`);
 const overlaps=(x,y)=>h.js(`IROH_MECHANICS.bodyOverlapsBox({x:${x},y:${y},th:0},activeObstacles[0])`);
 return {h,box,overlaps,res:()=>h.js(`BITIRO_MANUAL.place(${to[0]},${to[1]},${th})`),pose:()=>[h.js('R.x'),h.js('R.y')],th:()=>h.js('R.th'),
  boxNow:()=>plain(h.js('activeObstacles.map(o=>[o.x,o.y,o.width,o.height])')),bodyInside:()=>overlaps(h.js('R.x'),h.js('R.y'))};
};
test('Colocación manual · SLIDE por el eje X: la pose completa y el eje Y chocan, X solo es libre → cambia X, Y conserva su valor',()=>{
 const c=placeCase([30,115],[50,98],.7);
 assert.equal(c.overlaps(30,115),false,'inicio libre');assert.equal(c.overlaps(50,98),true,'X+Y bloqueado');assert.equal(c.overlaps(50,115),false,'solo X libre');
 assert.equal(c.res(),true);const [x,y]=c.pose();
 assert.equal(x,50,'X aceptado');assert.equal(y,115,'Y conserva el valor anterior');assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(c.th()));
 assert.ok(Math.abs(c.th()-.7)<1e-12,'th sigue el comportamiento actual de place(): se aplica');
 assert.equal(c.bodyInside(),false,'el robot no queda dentro de la caja');assert.deepEqual(c.boxNow(),c.box,'la caja no se movió');
});
test('Colocación manual · SLIDE por el eje Y: la pose completa y X solo chocan, Y solo es libre → cambia Y, X conserva su valor',()=>{
 const c=placeCase([30,100],[50,92],-.4);
 assert.equal(c.overlaps(30,100),false,'inicio libre');assert.equal(c.overlaps(50,92),true,'X+Y bloqueado');assert.equal(c.overlaps(50,100),true,'solo X bloqueado');assert.equal(c.overlaps(30,92),false,'solo Y libre');
 assert.equal(c.res(),true);const [x,y]=c.pose();
 assert.equal(y,92,'Y aceptado');assert.equal(x,30,'X conserva el valor anterior');assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(c.th()));
 assert.ok(Math.abs(c.th()+.4)<1e-12,'th aplicado');
 assert.equal(c.bodyInside(),false);assert.deepEqual(c.boxNow(),c.box,'la caja no se movió');
});
test('Colocación manual · AMBOS EJES BLOQUEADOS: X+Y, X solo e Y solo chocan → R.x y R.y no cambian, la caja no se mueve, th sigue el comportamiento actual',()=>{
 const c=placeCase([38,110],[52,100],1.1);
 assert.equal(c.overlaps(38,110),false,'inicio libre');assert.equal(c.overlaps(52,100),true,'X+Y bloqueado');assert.equal(c.overlaps(52,110),true,'solo X bloqueado');assert.equal(c.overlaps(38,100),true,'solo Y bloqueado');
 const before=c.pose();assert.equal(c.res(),true,'place() devuelve true aunque rechace la posición (comportamiento actual)');const after=c.pose();
 assert.deepEqual(after,before,'la posición no cambia');assert.deepEqual(after,[38,110]);assert.ok(Number.isFinite(after[0])&&Number.isFinite(after[1])&&Number.isFinite(c.th()));
 assert.ok(Math.abs(c.th()-1.1)<1e-12,'th actualmente se aplica aunque la posición se rechace (comportamiento definido por place())');
 assert.equal(c.bodyInside(),false);assert.deepEqual(c.boxNow(),c.box,'la caja no se movió');
});
test('RUNTIME CONTINÚA durante el arrastre: simTime avanza, el programa sigue, los motores no se reinician; al soltar continúa desde la nueva pose',()=>{
 const h=load();h.js("changeTrack('s02')");h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(30);}');
 h.tick(60);const t0=h.js('simTime'),L0=h.js('R.L'),w0=h.js('wheel.left');assert.equal(h.js('mode'),'code');assert.ok(L0>0&&w0>0);
 h.js('BITIRO_MANUAL.begin()');assert.equal(h.js('BITIRO_MANUAL.dragging'),true);
 h.js('BITIRO_MANUAL.place(35,120,0.3)');const px=h.js('R.x'),py=h.js('R.y'),pth=h.js('R.th');
 h.tick(60);                                                                  // 0,5 s simulados MIENTRAS se arrastra
 assert.ok(Math.abs(h.js('simTime')-t0-0.5)<1e-9,'simTime sigue avanzando: '+(h.js('simTime')-t0));
 assert.equal(h.js('mode'),'code');assert.equal(h.js('running'),1);assert.equal(h.js('R.L'),L0,'motores intactos');assert.ok(h.js('wheel.left')>=w0);
 assert.deepEqual([h.js('R.x'),h.js('R.y'),h.js('R.th')],[px,py,pth],'la pose manual tiene prioridad sobre la integración');
 h.js('BITIRO_MANUAL.end()');assert.equal(h.js('BITIRO_MANUAL.dragging'),false);
 h.tick(60);assert.ok(h.js('R.y')<py-.5||h.js('R.x')!==px,'al soltar, el robot avanza desde la nueva pose');
 assert.equal(h.js('mode'),'code');assert.ok(Number.isFinite(h.js('R.x'))&&Number.isFinite(h.js('R.y'))&&Number.isFinite(h.js('R.th')));
});
test('ROTACIÓN manual: place(x,y,th) cambia R.th (finito) sin mover R.x/R.y ni reiniciar; el programa y simTime continúan',()=>{
 const h=load();h.js("changeTrack('s02')");h.program('void setup(){inicializarMovimiento();} void loop(){detenerse();}');
 h.tick(30);const x=h.js('R.x'),y=h.js('R.y'),t=h.js('simTime');
 for(const th of [0,.5,-1.2,Math.PI/2,3]){h.js('BITIRO_MANUAL.begin()');h.js(`BITIRO_MANUAL.place(R.x,R.y,${th})`);h.tick(5);h.js('BITIRO_MANUAL.end()');
  assert.ok(Math.abs(h.js('R.th')-th)<1e-9);assert.equal(h.js('R.x'),x);assert.equal(h.js('R.y'),y);}
 assert.ok(h.js('simTime')>t);assert.equal(h.js('mode'),'code');
});
test('Pose manual con el programa DETENIDO o PAUSADO: se puede mover y las lecturas siguen la nueva pose; el estado de ejecución no cambia',()=>{
 const h=load();h.js("changeTrack('s02')");
 assert.equal(h.js('mode'),'idle');h.js('BITIRO_MANUAL.place(45,100,.2)');assert.equal(h.js('mode'),'idle');assert.equal(h.js('simTime'),0);
 h.program(PRINT_CENTER);h.tick(10);h.el('pause').events.click();assert.equal(h.js('paused'),true);
 const a=sensors(h);h.js('BITIRO_MANUAL.place(30,60,1)');assert.notDeepEqual(sensors(h),a);assert.equal(h.js('paused'),true);assert.equal(h.js('mode'),'code');
});

test('Salir de calibración durante un arrastre suelta el robot (dragging=false) y deja el runtime corriendo',()=>{
 const h=load();h.js("changeTrack('s02')");h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(30);}');h.tick(30);
 h.js('BITIRO_MANUAL.calibration=true');h.js('BITIRO_MANUAL.begin()');assert.equal(h.js('BITIRO_MANUAL.dragging'),true);
 h.js('BITIRO_MANUAL.calibration=false');assert.equal(h.js('BITIRO_MANUAL.dragging'),false);
 const y=h.js('R.y');h.tick(30);assert.ok(h.js('R.y')<y,'el robot vuelve a avanzar');assert.equal(h.js('mode'),'code');
});

// ───────── LCD controlada por el programa ─────────
test('LCD: con un programa que NO imprime sensores, el modo calibración no escribe nada en la LCD ni expone valores',()=>{
 const h=load();h.js("changeTrack('s02')");h.program(SILENT);h.tick(30);
 h.js('BITIRO_MANUAL.calibration=true');h.js('BITIRO_MANUAL.begin()');h.js('BITIRO_MANUAL.place(40,90,.4)');h.tick(30);h.js('BITIRO_MANUAL.end()');h.tick(30);h.js('updateTelemetry()');
 assert.deepEqual(plain(h.js('lcd')),['',''],'la LCD sigue vacía');
 assert.equal(String(h.el('lcd').textContent).replace(/\s/g,''),'');
 h.js('BITIRO_MANUAL.calibration=false');
});
test('LCD: con un programa que imprime una lectura, la LCD la muestra según el PROGRAMA y cambia al mover el robot (calibración no escribe)',()=>{
 const h=load();h.js("changeTrack('s02')");h.program(PRINT_CENTER);h.js('BITIRO_MANUAL.calibration=true');
 h.tick(10);h.js('updateTelemetry()');
 const shown=()=>String(h.el('lcd').textContent).split('\n')[0].trim();
 assert.equal(shown(),String(h.js('readLine(1)')),'la LCD muestra lo que el programa leyó');
 const first=shown();
 h.js('BITIRO_MANUAL.begin()');h.js('BITIRO_MANUAL.place(30,60,1)');h.js('BITIRO_MANUAL.end()');h.tick(10);h.js('updateTelemetry()');
 assert.equal(shown(),String(h.js('readLine(1)')));assert.notEqual(shown(),first,'otra pose → otra lectura en la LCD');
 // el módulo de calibración no escribe en la LCD: ni en su fuente ni por la ruta de la API
 const cm=read(root,'calibration-mode.js').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 assert.ok(!/lcd|escribirPantalla|readLine|LINE_SENSOR|SENSOR_MODEL|lightAt/i.test(cm),'calibration-mode.js no lee sensores ni escribe en la LCD');
});
test('Sin lecturas fuera de la LCD: en calibración el LED de detección del 3D se apaga y el CSS oculta toda la telemetría salvo la LCD',()=>{
 const h=load();h.js("changeTrack('s02')");
 let last=null;h.ctx.renderScene3D=(c,t,robot)=>{last=robot;};
 h.js('draw()');assert.equal(plain(last.lineActive).length,3);
 // pose con la línea bajo el sensor central: detecta en vista normal
 h.js("track.paths=[{w:2.6,p:[[50,60],[50,140]]}]");setPose(h,50,100,0);h.js('draw()');assert.deepEqual(plain(last.lineActive),[false,true,false]);
 h.js('BITIRO_MANUAL.calibration=true');h.js('draw()');assert.deepEqual(plain(last.lineActive),[false,false,false],'sin detección visible en calibración');
 h.js('BITIRO_MANUAL.calibration=false');h.js('draw()');assert.deepEqual(plain(last.lineActive),[false,true,false]);
 const css=read(root,'styles.css');
 for(const sel of ['.telemetry-strip>.tcell:not(.lcd-cell)','.telemetry-strip>.more-data','.simulator-toolbar','.code-panel','.inputs-strip'])
  assert.ok(css.includes('.workspace.calibration-mode '+sel),'CSS oculta '+sel+' en calibración');
 const html=read(root,'index.html');assert.ok(html.indexOf('id="lcd"')<html.indexOf('</details>',html.indexOf('lcd-cell')),'la LCD vive en la franja de telemetría');
 // los valores de sensores (valL/valC/valR) están dentro de .tcell no-LCD → ocultos
 const strip=html.match(/<div class="telemetry-strip".*?<details class="more-data pop"/s)[0];
 const tcells=strip.split('<div class="tcell').slice(1);const withVal=tcells.filter(c=>/id="val[LCR]"/.test(c));
 assert.equal(withVal.length,1);assert.ok(!withVal[0].startsWith(' lcd-cell'));
});
test('No hay calibración automática en modo alumno: sin botones AUTO/DETECTAR/CALCULAR/CAPTURAR ni sugerencia de umbral (el diálogo v1 sigue oculto)',()=>{
 const html=read(root,'index.html'),js=read(root,'calibration-mode.js'),visible=html.replace(/<div hidden aria-hidden="true">.*?<\/div>/s,'').replace(/<dialog id="calibrationDialog".*?<\/dialog>/s,'');
 for(const w of [/AUTO[- ]?CALIBR/i,/DETECTAR UMBRAL/i,/CALCULAR UMBRAL/i,/CAPTURAR (NEGRO|BLANCO)/i,/umbral sugerido/i,/histograma/i,/m[ií]n(imo)?\s*\/\s*m[aá]x/i])
  assert.ok(!w.test(visible)&&!w.test(js),String(w));
 const layer=html.match(/<div class="calibration-layer".*?<\/p>/s)[0];
 assert.ok(!/\d{3}/.test(layer.replace(/viewBox="[^"]*"|stroke-width="[^"]*"|width="\d+"|height="\d+"|d="[^"]*"/g,'')),'la capa de calibración no contiene lecturas');
});

// ───────── Compatibilidad con los goldens SIM-1 ─────────
test('Con el modelo NEUTRO las trazas SIM-1 coinciden EXACTAMENTE con las de antes de SIM-CALIBRATION-1 (hashes guardados de los goldens anteriores)',()=>{
 const legacy=JSON.parse(read(root,'tests/golden/sensor-model-legacy-hashes.json'));
 const patches=[{file:'calibration.js',from:'read:(k,surface,x,y)=>'+LEGACY,to:'read:(k,surface,x,y)=>compute(k,surface,x,y,NEUTRAL)'}];
 const sha=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16);
 assert.deepEqual(Object.keys(legacy.hashes).sort(),Object.keys(S).sort(),'mismos escenarios');
 for(const name of Object.keys(S))assert.equal(sha(S[name]({patches})),legacy.hashes[name],'traza neutra '+name+' == golden anterior');
});

console.log(`\n${checks} comprobaciones SIM-CALIBRATION-1 (lógica) correctas.`);
