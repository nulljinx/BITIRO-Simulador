/* node tests/physical-geometry.cjs — PHYSICAL-GEOMETRY-2
   Congela la geometría FUNCIONAL del simulador con las medidas físicas del IROH entregadas por el usuario.

   Clasificación de cada valor (solo documentación; no se codifica en runtime):
     PHYSICALLY_MEASURED (medido por el usuario)
       wheelbase (centro-centro de ruedas)                  = 10,0 cm
       eje de ruedas → punto óptico del sensor central       =  8,0 cm  (LINE_SENSOR.geometry.front)
       eje de ruedas → cara frontal de los transductores     =  4,0 cm  (origen del sonar, simulator.js)
       PCB sensor de línea 1,4 × 3,1 cm; gap entre bordes 0,5 cm; placa 17,6 × 11,0 × 0,3; rueda Ø6,5 × 2,5; ancho exterior 12,5
     DERIVED_FROM_PHYSICAL_PCB_GEOMETRY
       sensor spread = 1,4 + 0,5 = 1,9 cm centro-centro (supone el punto óptico centrado lateralmente en cada PCB;
       la separación óptica NO fue medida directamente)
     DERIVED_FROM_PHYSICAL_MEASUREMENTS
       centro de placa = 6,5 − 17,6/2 = −2,3 cm respecto de R (2,3 cm DETRÁS del centro cinemático del eje). Solo documentado; no se aplica al renderer/Blender.
     SIMULATION_ASSUMPTION (sin calibrar contra el IROH físico; NO cambian en este bloque)
       max rueda = 23 cm/s, rampa de motor = 240 %/s, bodyRadius = 8,3 (NO es la envolvente física medida), sonarHeight = 15,1,
       geometría/ángulos/velocidad del striker, radio de colisión manual, ROBOT_R del editor de escenarios, campo de luz, ganancias/offsets del sensor. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load,FIXED_DT,root}=require('./sim1/harness.cjs');
const {runBangBang}=require('./sim1/motor-probe.cjs');
let n=0;const test=(name,fn)=>{fn();n++;console.log('OK · '+name);};
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const plain=o=>JSON.parse(JSON.stringify(o));
const near=(a,b,t,msg)=>assert.ok(Math.abs(a-b)<=t,`${msg||''} ${a} ≉ ${b} (±${t})`);

// ── 1. Valores congelados ──
test('PHYSICALLY_MEASURED: wheelbase=10,0; sensor front=8,0; cara del sonar a 4,0 cm de R',()=>{
 assert.ok(read('simulator.js').includes('vR=wheel.right/100*max,base=10;'));
 assert.deepEqual(plain(load().js('LINE_SENSOR.geometry')).front,8);
 assert.ok(read('simulator.js').includes('MECH.worldPoint(R,4.0,0)'));
 assert.ok(!/9\.83|base=12;|front:6/.test(read('simulator.js')+read('calibration.js')),'no quedan valores funcionales históricos');
});
test('DERIVED_FROM_PHYSICAL_PCB_GEOMETRY: spread = 1,4 + 0,5 = 1,9 cm',()=>{
 near(1.4+0.5,1.9,1e-12);assert.equal(load().js('LINE_SENSOR.geometry.spread'),1.9);
 assert.ok(Object.isFrozen(load().js('LINE_SENSOR.geometry')));
});
test('DERIVED_FROM_PHYSICAL_MEASUREMENTS: centro de placa = 6,5 − 17,6/2 = −2,3 cm respecto de R (documentado, no aplicado)',()=>{
 near(6.5-17.6/2,-2.3,1e-12);
});
test('SIMULATION_ASSUMPTION intactos: max=23, rampa=240, bodyRadius=8,3, sonarHeight=15,1 y striker',()=>{
 const sim=read('simulator.js');
 assert.ok(sim.includes('const max=23,'));assert.ok(sim.includes('clamp(target-value,-240*dt,240*dt)'));
 const spec=plain(load().js('IROH_MECHANICS.spec'));
 assert.deepEqual(spec,{pivotForward:8.6,pivotRight:0,length:13.2,halfWidth:.52,bottomHeight:5.18,topHeight:6.32,servoBodyHeight:4.4,sonarHeight:15.1,
  minAngleDeg:-75,centerAngleDeg:0,maxAngleDeg:75,angularRateDeg:190,subStepDeg:1.1,bodyRadius:8.3});
});
test('ROBOT_R del editor de escenarios y colisión manual no cambian (bodyRadius=8,3 sigue siendo SIMULATION_ASSUMPTION, no la envolvente física medida)',()=>{
 assert.ok(read('scenario-editor.js').includes('ROBOT_R=8.3'));
 assert.ok(read('strike-physics.js').includes('bodyRadius: 8.3,'));
});

// ── 2. Wheelbase: yaw rate y radio ──
function steady(cmd,L0=50,R0=0){   // avanzar(50,0): rueda izquierda 50 %, derecha parada
 const h=load();h.js("changeTrack('s01')");h.program(`void setup(){inicializarMovimiento();} void loop(){${cmd}}`);
 h.js('R.x=50;R.y=70;R.th=0');h.tick(60);   // 0,5 s: la rampa (50/240 = 0,208 s) ya terminó
 return h;
}
test('avanzar(50,0): rueda máx 50 % = 11,5 cm/s y ω estacionaria = 11,5/10 = 1,15 rad/s',()=>{
 const h=steady('avanzar(50,0);');
 near(h.js('wheel.left')/100*23,11.5,1e-12,'v rueda');assert.equal(h.js('wheel.right'),0);
 const t0=h.js('R.th');h.tick(60);const w=(h.js('R.th')-t0)/(60*FIXED_DT);
 near(w,1.15,1e-9,'ω');
 near((h.js('wheel.left')/100*23-0)/10,1.15,1e-12);
});
test('avanzar(50,0): R describe un círculo de radio 5,0 cm alrededor de la rueda parada (= wheelbase/2)',()=>{
 const h=steady('avanzar(50,0);');
 const stopped=()=>({x:h.js('R.x')+5*Math.cos(h.js('R.th')),y:h.js('R.y')+5*Math.sin(h.js('R.th'))});   // rueda derecha a +5,0 cm lateral
 const c0=stopped(),radii=[],pts=[];
 for(let i=0;i<120;i++){h.tick(1);const c=stopped();assert.ok(Math.hypot(c.x-c0.x,c.y-c0.y)<0.05,'la rueda parada permanece en su sitio (deriva '+Math.hypot(c.x-c0.x,c.y-c0.y)+')');
  radii.push(Math.hypot(h.js('R.x')-c0.x,h.js('R.y')-c0.y));}
 for(const r of radii)near(r,5.0,0.05,'radio de R');
 assert.equal(h.js('mode'),'code');
});
test('El radio sigue siendo wheelbase/2 con otro comando: avanzar(0,50) gira en sentido contrario con radio 5,0',()=>{
 const h=steady('avanzar(0,50);');const t0=h.js('R.th');h.tick(60);
 near((h.js('R.th')-t0)/(60*FIXED_DT),-1.15,1e-9);
});
test('Control negativo: con wheelbase 12 (histórico, en memoria) ω=0,9583 rad/s ≠ 1,15 — la prueba distingue',()=>{
 const h=load({patches:[{file:'simulator.js',from:'base=10;',to:'base=12;'}]});h.js("changeTrack('s01')");
 h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(50,0);}');h.js('R.x=50;R.y=70;R.th=0');h.tick(60);
 const t0=h.js('R.th');h.tick(60);const w=(h.js('R.th')-t0)/(60*FIXED_DT);near(w,11.5/12,1e-9);assert.ok(Math.abs(w-1.15)>.1);
});
test('MOTOR-DYNAMICS-1 intacto: la rampa 0→50 tarda 50/240 s con base=10 (la geometría no altera la dinámica)',()=>{
 const h=load();h.js("changeTrack('s01')");h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(50,0);}');
 let ticks=0;while(h.js('wheel.left')<50&&ticks<200){h.tick(1);ticks++;}
 assert.equal(ticks,Math.ceil(50/(240*FIXED_DT)-1e-9));
});

// ── 3. Sensor de línea ──
const unitPose=(h,x,y,th)=>h.js(`R.x=${x};R.y=${y};R.th=${th}`);
function lineSweep(k,{axis,range,th=0,tgt}){   // línea vertical (axis='x') u horizontal ('y') desplazada; lectura del sensor k
 const h=load();h.js("changeTrack('s01')");const out=[];
 for(const d of range){
  h.js(axis==='x'?`track.paths=[{w:1.2,p:[[${50+d},0],[${50+d},200]]}]`:`track.paths=[{w:1.2,p:[[0,${100+d}],[100,${100+d}]]}]`);
  unitPose(h,50,100,th);out.push([d,h.js(`readLine(${k})`)]);
 }
 return out;
}
const peak=pts=>{const m=Math.max(...pts.map(p=>p[1]));const top=pts.filter(p=>p[1]>m-1e-9);return top.reduce((s,p)=>s+p[0],0)/top.length;};
const rng=(a,b,s)=>{const r=[];for(let v=a;v<=b+1e-9;v+=s)r.push(+v.toFixed(6));return r;};
test('Barrido determinista lateral (th=0): picos del sensor L/C/R en x = −1,9 / 0 / +1,9 cm del eje longitudinal',()=>{
 for(const [k,x] of [[0,-1.9],[1,0],[2,1.9]]){
  const sw=lineSweep(k,{axis:'x',range:rng(-5,5,.05)});
  near(peak(sw),x,0.051,`sensor ${k}`);
  // el pico ocurre cuando la línea (offset d) pasa bajo el sensor: d = posición lateral del sensor (R en x=50)
  assert.ok(sw.find(p=>Math.abs(p[0]-x)<1e-6)[1]>800,'negro bajo la línea');
 }
});
test('Barrido determinista longitudinal (th=0): pico del sensor central a 8,0 cm por delante de R (y = R.y − 8)',()=>{
 const sw=lineSweep(1,{axis:'y',range:rng(-12,0,.05)});near(peak(sw),-8,0.051);
 const at=d=>sw.find(p=>Math.abs(p[0]-d)<1e-6)[1];
 assert.ok(at(-8)>800);assert.ok(at(-6)<200&&at(-10)<200,'a 6 y 10 cm es blanco');
});
test('Sensores giran con R.th: th=π/2 → sensor central en (R.x+8, R.y) y laterales en R.y ± 1,9',()=>{
 const h=load();h.js("changeTrack('s01')");
 for(const [k,dy] of [[0,-1.9],[1,0],[2,1.9]]){
  h.js(`track.paths=[{w:1.2,p:[[0,${100+dy}],[200,${100+dy}]]}]`);unitPose(h,50,100,Math.PI/2);
  assert.deepEqual([0,1,2].map(q=>h.js(`readLine(${q})`)>600),[0,1,2].map(q=>q===k));
 }
 h.js('track.paths=[{w:1.2,p:[[58,0],[58,200]]}]');unitPose(h,50,100,Math.PI/2);assert.ok(h.js('readLine(1)')>800);
});
test('CAMBIO GEOMÉTRICO vs MODELO DE LECTURA: el mismo punto físico da la misma lectura con la geometría histórica (6/2,8) y la nueva (8/1,9)',()=>{
 // Para cada sensor k hay una pose histórica R' que coloca su sensor exactamente en el mismo punto del plano que la pose nueva R:
 // R' = R + (front_new − front_old)·f + (k−1)(spread_new − spread_old)·r. Si el MODELO óptico no cambió, las lecturas son idénticas.
 const hn=load(),ho=load({patches:[{file:'calibration.js',from:'Object.freeze({front:8,spread:1.9})',to:'Object.freeze({front:6,spread:2.8})'}]});
 let compared=0;
 for(const h of [hn,ho]){h.js("changeTrack('s01')");}
 for(const th of [0,.7,1.9,-2.4])for(const [x,y] of [[50,100],[46.3,118.2],[38.1,90.7],[61.4,76.5]])for(const k of [0,1,2]){
  const f=[Math.sin(th),-Math.cos(th)],r=[Math.cos(th),Math.sin(th)];
  const dF=8-6,dR=(k-1)*(1.9-2.8);
  unitPose(hn,x,y,th);unitPose(ho,x+dF*f[0]+dR*r[0],y+dF*f[1]+dR*r[1],th);
  assert.equal(hn.js(`readLine(${k})`),ho.js(`readLine(${k})`),`k=${k} th=${th} (${x},${y})`);compared++;
 }
 assert.equal(compared,48);
});
test('Modelo óptico intacto: coverage/blend/superficie/luz/ganancia/offset/microvariación no se tocaron (fuente y hash histórico)',()=>{
 const src=read('simulator.js'),cal=read('calibration.js');
 assert.ok(src.includes('const blend=Math.max(0,Math.min(1,(1.05-near.dist)/1.7));'));
 assert.ok(src.includes('LINE_SENSOR.read(k,blend,x,y)'));
 assert.ok(cal.includes('gain')&&cal.includes('offset')&&cal.includes('microAmp'));
 assert.ok(cal.includes('const v=surface*cfg.light(x,y)*cfg.gain[k]+cfg.offset[k]+micro(k,x,y,cfg.microAmp);'));
});

// ── 4. Bang-bang de un sensor central (regresión) ──
test('Bang-bang 1 sensor, óvalo, umbral 500, polaridades A/B, V=25/50: sigue el borde, V=50 materialmente más rápido, sin perderse',()=>{
 const rows=[];
 for(const pol of ['A','B']){
  const r25=runBangBang({V:25,thr:500,pol,x:84.7,seconds:20}),r50=runBangBang({V:50,thr:500,pol,x:84.7,seconds:20});
  for(const r of [r25,r50]){
   assert.equal(r.mode,'code');assert.ok(r.transitions>=20,`pol ${pol} V=${r.V}: transiciones ${r.transitions}`);
   assert.ok(r.maxDistFromLine<4,`pol ${pol} V=${r.V}: se aleja ${r.maxDistFromLine} cm`);assert.ok(r.meanSpeed>1);
  }
  assert.ok(r50.distanceCm>1.5*r25.distanceCm,`pol ${pol}: V=50 (${r50.distanceCm}) debe ser >1,5× V=25 (${r25.distanceCm})`);
  assert.ok(r50.progressDeg>1.5*r25.progressDeg);
  rows.push(`pol=${pol} V25 dist=${r25.distanceCm.toFixed(1)} v̄=${r25.meanSpeed.toFixed(2)} tr=${r25.transitions} max=${r25.maxDistFromLine.toFixed(2)} | V50 dist=${r50.distanceCm.toFixed(1)} v̄=${r50.meanSpeed.toFixed(2)} tr=${r50.transitions} max=${r50.maxDistFromLine.toFixed(2)}`);
 }
 rows.forEach(r=>console.log('   '+r));
});

// ── 5. Sonar ──
test('Sonar: origen funcional = cara de los transductores a 4,0 cm de R; la lectura es la distancia desde ese origen',()=>{
 const h=load();h.js("changeTrack('s01')");
 for(const d of [5,10,18,24,50,100,150,195]){
  h.js(`R.x=50;R.y=130;R.th=0;activeObstacles=[{id:'b',x:46,y:${130-4-d-8},width:8,height:8,visualHeightCm:15.6}]`);
  assert.equal(h.js('readSonarDistance()'),d,'d='+d);
 }
 // caja a la distancia histórica 9,83 ⇒ ahora se mide d + 5,83 (la diferencia es exactamente el cambio de origen)
 h.js(`R.x=50;R.y=130;R.th=0;activeObstacles=[{id:'b',x:46,y:${130-9.83-18-8},width:8,height:8,visualHeightCm:15.6}]`);
 assert.equal(h.js('readSonarDistance()'),24);   // 18 + 5,83 = 23,83 → 24
});
test('Sonar: altura 15,1, rayos ±6°, alcance 200 y raycast sin cambios',()=>{
 const src=read('simulator.js');assert.ok(src.includes('for(const offset of [-Math.PI/30,0,Math.PI/30])'));
 const h=load();h.js("changeTrack('s01')");
 const put=(hh)=>h.js(`R.x=50;R.y=130;R.th=0;activeObstacles=[{id:'b',x:46,y:60,width:8,height:8,visualHeightCm:${hh}}]`);
 put(15.1);assert.ok(h.js('readSonarDistance()')<200);put(15.0);assert.equal(h.js('readSonarDistance()'),200);
 h.js('activeObstacles=[]');assert.equal(h.js('readSonarDistance()'),200);
 // rayo lateral +6°: caja fina a 50 cm del origen; cruza a 50·tan6° ≈ 5,25 cm
 const lat=L=>{h.js(`R.x=50;R.y=130;R.th=0;activeObstacles=[{id:'b',x:${50+L},y:${130-4-50-1},width:1,height:1,visualHeightCm:15.6}]`);return h.js('readSonarDistance()');};
 assert.equal(lat(4),200);assert.equal(lat(5),50);assert.equal(lat(6),200);   // mismo resultado que el golden histórico: solo la caja 5..6 cae en el rayo
});


// ── 5b. PHYSICAL-GEOMETRY-2A: ecuación old→new del sonar (sin redondeo), contacto de la barra y pose inicial de S01 ──
const RAW={file:'simulator.js',from:'return Math.round(nearest)',to:'return nearest'};      // solo en memoria: expone la distancia sin redondear
const OLD_ORIGIN={file:'simulator.js',from:'MECH.worldPoint(R,4.0,0)',to:'MECH.worldPoint(R,9.83,0)'};
const front=(h,fwd)=>{h.js(`R.x=50;R.y=130;R.th=0;activeObstacles=[{id:'b',x:46,y:${130-fwd-8},width:8,height:8,visualHeightCm:15.6}]`);return h.js('readSonarDistance()');};
test('Sonar old→new (fixture frontal, raycast real sin redondeo): lectura_nueva = lectura_antigua + 5,83 (9,83 − 4,0)',()=>{
 const o=load({patches:[RAW,OLD_ORIGIN]}),w=load({patches:[RAW]});for(const h of [o,w])h.js("changeTrack('s01')");
 for(const [oldRead,newRead] of [[5,10.83],[12,17.83],[18,23.83]]){
  const fwd=oldRead+9.83;   // obstacle_forward: distancia R → cara de la caja
  near(front(o,fwd),oldRead,1e-9,'old');near(front(w,fwd),newRead,1e-9,'new');near(front(w,fwd)-front(o,fwd),5.83,1e-9,'Δ');
 }
});
test('Contacto de la barra centrada con una caja: lectura ≈ 12,5 (origen antiguo) vs ≈ 18,3 (nuevo); misma posición física, Δ = 5,83',()=>{
 const hit=h=>{h.js("changeTrack('s01')");h.js("R.x=50;R.th=0;activeObstacles=[{id:'b',x:46,y:60,width:8,height:8,visualHeightCm:15.6}]");
  for(let y=130;y>60;y=+(y-.01).toFixed(2)){h.js(`R.y=${y}`);if(h.js('IROH_MECHANICS.barOverlapsBox(R,0,activeObstacles[0])'))return {y,read:h.js('readSonarDistance()')};}};
 const o=hit(load({patches:[RAW,OLD_ORIGIN]})),w=hit(load({patches:[RAW]}));
 assert.equal(o.y,w.y,'misma pose de contacto');near(w.read-o.read,5.83,1e-9);near(o.read,12.5,.1);near(w.read,18.3,.1);
});
test('S01 pose inicial (caracterización, sin corregir): central > umbral; laterales entre blanco_ref y umbral; sin solape ni colisión; starters corren sin error',()=>{
 const h=load();h.js("changeTrack('s01')");
 const q=[0,1,2].map(k=>h.js(`readLine(${k})`)),thr=h.js('LINE_SENSOR.profile.threshold');
 assert.deepEqual(q,[462,848,429]);   // antes de PHYSICAL-GEOMETRY-2: 881 / 848 / 819 (los tres sobre la barra transversal)
 const w=load();w.js("changeTrack('s01')");w.js('track.paths=[]');const white=[0,1,2].map(k=>w.js(`readLine(${k})`));
 assert.ok(thr<q[1]);for(const k of [0,2])assert.ok(white[k]<q[k]&&q[k]<thr,`lateral ${k}`);
 assert.deepEqual(plain(h.js('({x:R.x,y:R.y,th:R.th})')),{x:50,y:130,th:0});
 assert.equal(h.js('activeObstacles.some(o=>IROH_MECHANICS.bodyOverlapsBox(R,o))'),false);
 assert.equal(h.js('activeObstacles.some(o=>IROH_MECHANICS.barOverlapsBox(R,0,o))'),false);
 for(const code of ['void setup(){inicializarMovimiento();inicializarSensores();} void loop(){ if(leerSensorLineaCentral()>500){avanzar(30,90);}else{avanzar(90,30);} }',
  'void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();} void loop(){ int d=leerDistanciaSonar(); if(d<=10){detenerse();}else{avanzar(30);} }']){
  const r=load();r.js("changeTrack('s01')");r.program(code);r.tick(600);assert.equal(r.js('mode'),'code');assert.equal(r.js('running'),1);assert.ok(r.js('R.y')<130,'el starter se mueve');
 }
});

console.log(`\n${n} comprobaciones PHYSICAL-GEOMETRY-2 superadas.`);
