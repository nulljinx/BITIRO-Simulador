/* node tests/head-firvi-compat.cjs — compatibilidad HEAD-CANVAS (cabeza móvil, sonar con yaw, modelo de altura) + FIRVI 2025 (prismas, competencia, evaluador).
   Variante de robot evaluada: HEAD-CANVAS (sensores de línea 6,0 / 2,8 cm; sonar a 9,83 cm del eje; ruedas a 12 cm). Ninguna expectativa fija esas cifras: salen de la configuración
   efectiva (LINE_SENSOR.geometry y HEAD_SONAR.params). La comparación con la versión HEAD-CANVAS completa está en tests/compare-head-canvas.cjs. */
'use strict';
const assert=require('node:assert/strict');
const {load}=require('./sim1/harness.cjs');
const EXTRA=['line-geometry.js','firvi-2025.js','firvi-competition.js','firvi-scoring.js'];
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const world=(track='firvi-2025',opts={})=>{const h=load({extraFiles:EXTRA,...opts});h.js(`changeTrack('${track}')`);return h;};
const deg=r=>r*180/Math.PI;

/* Distancia del origen del haz al polígono, calculada AQUÍ (segmento a segmento), sin usar IROH_MECHANICS.rayPoly. */
function rayPoly(o,d,poly){
 let best=Infinity;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],ex=b[0]-a[0],ey=b[1]-a[1],den=d.x*ey-d.y*ex;
  if(Math.abs(den)<1e-12)continue;
  const t=((a[0]-o.x)*ey-(a[1]-o.y)*ex)/den,u=((a[0]-o.x)*d.y-(a[1]-o.y)*d.x)/den;
  if(t>=0&&u>=0&&u<=1)best=Math.min(best,t);
 }
 return best;
}
const beam=(h,off=0)=>{const f=h.js('HEAD_SONAR.frame(R,IROH_MECHANICS)');const a=h.js('R.th')+f.yawRel+off;return {o:f.origin,d:{x:Math.sin(a),y:-Math.cos(a)}};};
const expectedSonar=(h,id)=>{
 const ob=h.js(`activeObstacles.find(o=>o.id==='${id}')`);let best=200;
 for(const off of [-Math.PI/30,0,Math.PI/30]){const {o,d}=beam(h,off);const t=rayPoly(o,d,ob.poly);if(t<=200)best=Math.min(best,t);}
 return Math.round(best);
};
const yawTo=(h,angle,x,y,th)=>{h.program(`void setup(){inicializarCabeza();moverServoYaw(${angle});} void loop(){pausa(50);}`);h.js(`R.x=${x};R.y=${y};R.th=${th};previousPose={x:R.x,y:R.y,th:R.th,angle:0}`);for(let t=0;t<120*3;t++)h.js('update(1/120)');};   // el programa reinicia al robot al arrancar: la pose se fija después

test('geometría efectiva: el robot evaluado es el de HEAD-CANVAS (no se trasladó nada de main)',()=>{
 const h=world();
 assert.equal(h.js('LINE_SENSOR.geometry.front'),6);assert.equal(h.js('LINE_SENSOR.geometry.spread'),2.8);
 assert.equal(h.js('HEAD_SONAR.params.faceForward.value'),9.83);assert.equal(h.js('HEAD_SONAR.heightModel'),true);
 assert.equal(h.js('IROH_MECHANICS.spec.bodyRadius'),8.3);
});

test('sonar con yaw 90° (cabeza al frente) mide contra el prisma exactamente como el cálculo geométrico independiente (origen a 9,83 cm del eje)',()=>{
 const h=world();const ob=h.js("activeObstacles.find(o=>o.id==='obstacle-room1')");
 const face=Math.max(...ob.poly.map(q=>q[0]));
 h.js(`R.x=${face+9.83+30};R.y=${ob.cy};R.th=-Math.PI/2`);   // mirando a −x, 30 cm por delante de la cara plana (la A llega por el este)
 const r=h.js('readSonarDistance()');
 assert.equal(r,expectedSonar(h,'obstacle-room1'));assert.equal(r,30,'30 cm entre la cara del transductor y la cara del prisma');
});

test('sonar con yaw ≠ 90°: gira el haz hacia el prisma (180° = izquierda del robot, 0° = derecha) y deja de verlo al apartarse',()=>{
 const h=world();const ob=h.js("activeObstacles.find(o=>o.id==='obstacle-room1')");
 // Robot mirando a +y (th=π), prisma a su izquierda o derecha según el signo del heading del mundo: se prueba contra el cálculo geométrico, no contra una convención fija.
 const seen={};
 for(const yaw of [0,45,90,135,180]){
  const w=world();
  yawTo(w,yaw,ob.cx-40,ob.cy,Math.PI/2);   // mirando a +x hacia el prisma
  const got=w.js('readSonarDistance()'),want=expectedSonar(w,'obstacle-room1');
  assert.equal(got,want,`yaw ${yaw}°: lectura ${got} vs geométrica ${want}`);
  seen[yaw]=got;
 }
 assert.ok(seen[90]<200,'al frente ve el prisma');assert.equal(seen[0],200,'a la derecha no lo ve');assert.equal(seen[180],200,'a la izquierda no lo ve');
});

test('modelo de altura de HEAD-CANVAS con prismas FIRVI: el prisma (20 cm) está por encima del transductor (15,1 cm) y se detecta; uno más bajo se ignora',()=>{
 const h=world();const ob=h.js("activeObstacles.find(o=>o.id==='obstacle-room1')");
 const face=Math.max(...ob.poly.map(q=>q[0]));
 h.js(`R.x=${face+9.83+25};R.y=${ob.cy};R.th=-Math.PI/2`);
 assert.equal(h.js('readSonarDistance()'),25);
 h.js("activeObstacles.find(o=>o.id==='obstacle-room1').visualHeightCm=10");   // por debajo de 15,1 cm: el haz pasa por encima
 assert.equal(h.js('readSonarDistance()'),200);
});

test('prisma y caja conviven: las cajas AABB de S06–S08 siguen por su camino (sin polígono) y el sonar con yaw las mide igual que antes',()=>{
 const h=world('s06');
 h.js("activeObstacles.push({id:'caja-prueba',x:100,y:100,width:8,height:8,movable:true,visualHeightCm:15.6})");   // S06 no trae cajas por omisión: se añade una de 8 × 8 cm
 const b=h.js('activeObstacles[0]');
 h.js(`R.x=${b.x-30};R.y=${b.y+b.height/2};R.th=Math.PI/2`);
 assert.equal(h.js('IROH_MECHANICS.polyOf(activeObstacles[0])'),null);
 assert.equal(h.js('readSonarDistance()'),Math.round(30-9.83));
});

test('cabeza y garra conservan sus responsabilidades en una pista FIRVI: moverServoYaw no mueve el golpe y moverServoGolpe no mueve la cabeza',()=>{
 const h=world();
 h.program('void setup(){inicializarCabeza();inicializarGolpe();moverServoYaw(45);} void loop(){pausa(50);}');
 for(let t=0;t<120*3;t++)h.js('update(1/120)');
 assert.equal(Math.round(h.js('HEAD_SONAR.state.angle')),45);assert.equal(h.js('striker.angle'),0,'la garra no se movió');
 const h2=world();
 h2.program('void setup(){inicializarCabeza();inicializarGolpe();moverServoGolpe(1);} void loop(){pausa(50);}');
 for(let t=0;t<120*3;t++)h2.js('update(1/120)');
 assert.equal(h2.js('HEAD_SONAR.state.angle'),90,'la cabeza sigue al frente');assert.ok(h2.js('striker.angle')>=74.9);
});

test('competencia: el reinicio suave durante el recorrido NO reinicia la cabeza (el servo no se mueve solo); el reinicio fuerte sí la deja al frente',()=>{
 const h=world();const clock={t:1000,now:()=>clock.t};const C=h.ctx.BITIRO_COMPETITION;C.setClock(clock);C.enter();
 const s=C.session();s.startRound();h.program('void setup(){inicializarCabeza();moverServoYaw(30);botonInicio();} void loop(){pausa(50);}');clock.t+=20000;s.beginRun();h.js('start()');
 for(let t=0;t<120*3;t++){h.js('update(1/120)');clock.t+=1000/120;}
 assert.equal(Math.round(h.js('HEAD_SONAR.state.angle')),30);
 const pose=h.js('[R.x,R.y,R.th].join()');
 h.js('window.resetRobot()');   // Ejecutar durante el recorrido puntuable: solo apaga el programa
 assert.equal(h.js('[R.x,R.y,R.th].join()'),pose,'el robot no se movió');assert.equal(Math.round(h.js('HEAD_SONAR.state.angle')),30,'la cabeza conserva su ángulo');assert.equal(h.js('mode'),'idle');
 assert.ok(s.finishRound('captain').ok);   // fuera del recorrido puntuable el reinicio es el normal: robot a la base y cabeza al frente
 h.ctx.BITIRO_SIM_ADAPTER.hardReset();
 assert.equal(h.js('HEAD_SONAR.state.angle'),90,'el reinicio fuerte (volver a la base) deja la cabeza al frente');
 assert.equal(h.js('R.x'),h.js('track.start.x'));
});

test('la orientación de la cabeza NO se transmite entre rondas ni entre pistas',()=>{
 const h=world();const clock={t:1000,now:()=>clock.t};const C=h.ctx.BITIRO_COMPETITION;C.setClock(clock);C.enter();
 const s=C.session();s.startRound();h.program('void setup(){inicializarCabeza();moverServoYaw(30);botonInicio();} void loop(){pausa(50);}');clock.t+=20000;s.beginRun();h.js('start()');
 for(let t=0;t<120*3;t++){h.js('update(1/120)');clock.t+=1000/120;}
 assert.equal(Math.round(h.js('HEAD_SONAR.state.angle')),30);
 assert.ok(s.finishRound('captain').ok);assert.ok(s.nextRound().ok);
 assert.equal(h.js('HEAD_SONAR.state.angle'),90,'la ronda 2 empieza con la cabeza al frente');
 h.js('HEAD_SONAR.state.angle=30');h.js("changeTrack('firvi-2025-b')");
 assert.equal(h.js('HEAD_SONAR.state.angle'),90,'otra pista: cabeza al frente');
});

test('secuencia física: la cabeza se mueve a su velocidad mientras corre el motor de competencia (HEAD_SONAR.step sigue en el paso de física) y no altera el reloj de competencia',()=>{
 const h=world();const clock={t:1000,now:()=>clock.t};const C=h.ctx.BITIRO_COMPETITION;C.setClock(clock);C.enter();
 const s=C.session();s.startRound();h.program('void setup(){inicializarCabeza();moverServoYaw(0);} void loop(){pausa(50);}');clock.t+=20000;s.beginRun();h.js('start()');
 const a0=h.js('HEAD_SONAR.state.angle');for(let t=0;t<30;t++){h.js('update(1/120)');clock.t+=1000/120;}
 const a1=h.js('HEAD_SONAR.state.angle');assert.ok(a1<a0&&a1>0,`giro progresivo (${a0} → ${a1})`);
 for(let t=0;t<120*3;t++){h.js('update(1/120)');clock.t+=1000/120;}
 assert.equal(Math.round(h.js('HEAD_SONAR.state.angle')),0);
 assert.equal(Math.round(s.elapsedMs()/100)/10,Math.round((clock.t-1000)/100)/10,'el reloj de competencia es el de pared, no el de la física');
});

test('el registro pasivo de FIRVI no cambia la física heredada: misma pose, sonar y cabeza con y sin consultar los registros',()=>{
 const run=poll=>{const h=world('s08');h.program('void setup(){inicializarMovimiento();inicializarSensores();inicializarCabeza();inicializarGolpe();} int k=0; void loop(){k=k+1; if(k%100==0){moverServoYaw(45+(k/100%4)*30);} avanzar(18); pausa(5);}');
  for(let t=0;t<120*20;t++){h.js('update(1/120)');if(poll&&t%7===0){h.js('BITIRO_TRACE_LOG()');h.js('BITIRO_PHYSICS_LOG()');h.js('BITIRO_INTERACTION_LOG()');}}
  return h.js('JSON.stringify([R.x,R.y,R.th,readSonarDistance(),HEAD_SONAR.state.angle,collisionCount,simTime])');};
 assert.equal(run(true),run(false));
});

test('las pistas S01–S08, Óvalo y Ocho no llevan marcas FIRVI y la barra de competencia no existe fuera de FIRVI',()=>{
 for(const id of ['s01','s02','s03','s04','s05','s06','s07','s08','oval','ocho']){
  const h=world(id);assert.equal(h.js('track.competition||null'),null,id);assert.equal(h.ctx.BITIRO_COMPETITION.on,false,id);
  assert.equal(h.js('track.capStyle||null'),null,id);assert.equal(h.js('(track.references||[]).length'),0,id);
 }
});

console.log(`${checks} comprobaciones de compatibilidad HEAD-CANVAS + FIRVI superadas.`);
