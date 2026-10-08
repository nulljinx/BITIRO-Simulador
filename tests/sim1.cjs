/* node tests/sim1.cjs — SIM-1: red de seguridad del baseline v4.
   - Goldens a FIXED_DT=1/120 comparados con tests/golden/*.json
   - Determinismo: cada golden se genera en DOS procesos limpios y debe ser idéntico byte a byte
   - Caracterización: runtime, geometría congelada, cinemática, storage
   - Controles negativos: parches EN MEMORIA (el producto en disco no se toca)
   Regenerar goldens (solo con intención explícita): SIM1_UPDATE=1 node tests/sim1.cjs */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {S}=require('./sim1/scenarios.cjs');
const C=require('./sim1/characterization.cjs');
const {root,load}=require('./sim1/harness.cjs');
const {probe,pixelCrosscheck}=require('./sim1/wheelbase-probe.cjs');
const GOLD=path.join(__dirname,'golden'),UPDATE=process.env.SIM1_UPDATE==='1',TOL=1e-9;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,12);
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('OK · '+name);};

// Un elemento por línea en cada arreglo de primer nivel: diffs legibles, archivos pequeños.
function fmt(obj){
 const parts=Object.entries(obj).map(([k,v])=>Array.isArray(v)?JSON.stringify(k)+':[\n'+v.map(x=>JSON.stringify(x)).join(',\n')+'\n]':JSON.stringify(k)+':'+JSON.stringify(v));
 return '{\n'+parts.join(',\n')+'\n}\n';
}
// Comparación exacta; si difiere, mide la diferencia numérica máxima (tolerancia solo informativa).
function compare(a,b,pathStr='$',acc={maxAbs:0,exact:true,first:null}){
 if(typeof a==='number'&&typeof b==='number'){
  if(a!==b){acc.exact=false;const d=Math.abs(a-b);if(!(d<=acc.maxAbs))acc.maxAbs=Number.isNaN(d)?Infinity:d;acc.first??=pathStr;}
 }else if(Array.isArray(a)&&Array.isArray(b)){
  if(a.length!==b.length){acc.exact=false;acc.maxAbs=Infinity;acc.first??=pathStr+'.length';}
  else a.forEach((v,i)=>compare(v,b[i],pathStr+'['+i+']',acc));
 }else if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const ka=Object.keys(a),kb=Object.keys(b);
  if(ka.join()!==kb.join()){acc.exact=false;acc.maxAbs=Infinity;acc.first??=pathStr+'.keys';}
  else for(const k of ka)compare(a[k],b[k],pathStr+'.'+k,acc);
 }else if(a!==b){acc.exact=false;acc.maxAbs=Infinity;acc.first??=pathStr;}
 return acc;
}
const sameWithinTol=c=>c.exact||c.maxAbs<=TOL;
const cleanProcess=name=>execFileSync(process.execPath,[path.join(__dirname,'sim1','trace-cli.cjs'),name],{encoding:'utf8',maxBuffer:1<<26});
const goldenPath=name=>path.join(GOLD,name+'.json');
const readGolden=name=>JSON.parse(fs.readFileSync(goldenPath(name),'utf8'));

// ───────── 1. Goldens + determinismo en procesos limpios ─────────
const traces={},report=[];
for(const name of Object.keys(S)){
 test(`Golden «${name}»: run1 == run2 (procesos limpios) y coincide con el archivo`,()=>{
  const r1=cleanProcess(name),r2=cleanProcess(name);
  assert.equal(r1,r2,'run1 y run2 deben ser idénticos byte a byte');
  const trace=JSON.parse(r1);traces[name]=trace;
  if(UPDATE||!fs.existsSync(goldenPath(name)))fs.writeFileSync(goldenPath(name),fmt(trace));
  const c=compare(trace,readGolden(name));
  assert.ok(sameWithinTol(c),`Golden ${name} difiere en ${c.first} (max |Δ|=${c.maxAbs})`);
  report.push({name,run1:sha(r1),run2:sha(r2),identical:r1===r2,exactVsFile:c.exact,maxAbsVsFile:c.maxAbs,bytes:r1.length});
 });
}
console.log('\nDeterminismo (sha256[0:12]) · run1 | run2 | idénticos | exacto vs archivo | máx|Δ|');
for(const r of report)console.log(' ',r.name.padEnd(20),r.run1,r.run2,r.identical,r.exactVsFile,r.maxAbsVsFile);
console.log('Tolerancia numérica usada: '+(report.every(r=>r.exactVsFile)?'NINGUNA (todas las trazas coinciden exactamente en esta plataforma)':'ver filas con exacto=false')+`; umbral de respaldo ${TOL} solo para comparar contra archivo entre plataformas.\n`);

// ───────── 2. Aserciones explícitas sobre lo que congelan los goldens ─────────
test('Goldens: ciclo del servo, caja desplazada una vez y rayos de sonar',()=>{
 const sv=traces.servo_sweep.meta;assert.equal(sv.tickReachedLeft,48);assert.equal(sv.tickReachedRight,143);assert.equal(sv.tickBackToCenter,191);   // −1 → +1 → 0: −75° → +75° → 0° a 190°/s
 const d=traces.s01_demo_strike.meta;assert.equal(d.movedCount,1);assert.equal(d.badge,'RECORRIDO VISUALIZADO');assert.equal(d.strikeTick,168);
 const sonar=Object.fromEntries(traces.sonar_range.cases.map(c=>[c.label,c.sonar]));
 assert.equal(sonar['frente d=18'],18);assert.equal(sonar['sin cajas'],200);assert.equal(sonar['lejos 300'],200);
 assert.equal(sonar['altura 15,1 (límite)']!==200,true);assert.equal(sonar['altura 15,0 (por debajo)'],200);
 for(const s of ['+','-']){assert.equal(sonar[`rayo ${s}6° caja lateral 4..5`],200);assert.equal(sonar[`rayo ${s}6° caja lateral 5..6`],50);assert.equal(sonar[`rayo ${s}6° caja lateral 6..7`],200);}
 const st=traces.s01_straight.samples;assert.equal(st.at(-1).theta,0);{const q=st.at(-1).sensors;assert.deepEqual(q.map(v=>v>=510),[false,true,false]);// Propiedad semántica (PHYSICAL-GEOMETRY-2A): blanco_ref < lateral < umbral < central. blanco_ref = lectura del MISMO sensor, en la MISMA pose,
  // sobre una pista sin líneas (incluye campo de luz y microvariación, determinista). Los laterales superan el blanco porque, con spread 1,9 cm
  // y línea de 2,6 cm, el sensor queda a 0,6 cm del borde (transición espacial esperada); siguen bajo el umbral, así que NO detectan.
  const last=st.at(-1),hw=load();hw.js("changeTrack('s01')");hw.js('track.paths=[]');hw.js(`R.x=${last.x};R.y=${last.y};R.th=${last.theta}`);
  const white=[0,1,2].map(k=>hw.js(`readLine(${k})`)),thr=load().js('LINE_SENSOR.profile.threshold');
  assert.equal(thr,500);for(const k of [0,2])assert.ok(white[k]<q[k]&&q[k]<thr,`lateral ${k}: blanco_ref ${white[k]} < ${q[k]} < ${thr}`);
  assert.ok(thr<q[1]&&q[1]>780,'central sobre la línea');}
});

// ───────── 3. Geometría congelada, cinemática y wheelbase ─────────
const geo=C.geometry();
test('Geometría física medida (PHYSICAL-GEOMETRY-2): sensor front=8 (PHYSICALLY_MEASURED) y spread=1,9 (DERIVED_FROM_PHYSICAL_PCB_GEOMETRY); sonar a 4,0 cm (PHYSICALLY_MEASURED)',()=>{
 assert.deepEqual(geo.lineSensor.geometry,{front:8,spread:1.9});assert.equal(geo.sonar.originForwardCm,4);
 assert.equal(geo.lineSensor.rawWhite,155);assert.equal(geo.lineSensor.rawBlack,865);
 assert.deepEqual(geo.sonar.rayOffsetsDeg,[-6,0,6]);assert.equal(geo.sonar.rayOffsetSource,'-Math.PI/30,0,Math.PI/30');
 assert.equal(geo.fixedDtIs1over120,true);assert.equal(geo.mechanics.length,13.2);assert.equal(geo.mechanics.pivotForward,8.6);
});
test('Wheelbase: física 10,0 cm (PHYSICALLY_MEASURED) vs visual legacy 18,2 cm → desajuste VISUAL pendiente de la integración IROH 3D',()=>{
 assert.equal(geo.kinematics.physicsWheelbaseCm,10);
 assert.equal(geo.rendererVisual.wheelCenterOffsetCmPerSide*2,18.2);
 const yaw=C.yawRate();assert.ok(Math.abs(yaw.radPerSec-(2*0.2*23)/10)<1e-9,'ω estable = (vL−vR)/10 = 0,92 rad/s');
 console.log('   wheelbase: physics=10 cm (PHYSICALLY_MEASURED) | renderer wheel centers=±9.1 → 18.2 cm (visual legacy, NO corregido en este bloque) | ω(girarDerecha(20))='+yaw.radPerSec.toFixed(6)+' rad/s');
});
test('Renderer: cadena constante→dibujo; centros de rueda efectivos 18,2 unidades de mundo (= cm de pista), sin escala posterior',()=>{
 const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} ≉ ${b}`);
 for(const [trackId,x,y,th] of [['s01',50,70,0],['s01',33,100,.7],['s05',50,120,2.2],['oval',86,70,-1.3]]){
  const r=probe({trackId,x,y,th});
  near(r.wheelCenterAbsR.left,9.1);near(r.wheelCenterAbsR.right,9.1);near(r.centerToCenterWorldCm,18.2);
  near(r.wheelCenterF.left,-2.3);near(r.wheelRadius,5.2);near(r.tireWidth,2.2);near(r.left.innerAbsR,8.0);near(r.left.outerAbsR,10.2);
  // Mismas coordenadas que la física: el vector rueda izquierda→derecha es la base «derecha» de IROH_MECHANICS.
  const dx=r.wheelTrackCoords.right.x-r.wheelTrackCoords.left.x,dy=r.wheelTrackCoords.right.y-r.wheelTrackCoords.left.y;
  near(Math.hypot(dx,dy),18.2,1e-9);near(dx/18.2,Math.cos(th));near(dy/18.2,Math.sin(th));
 }
 const px=pixelCrosscheck();near(px.groundPxPerUnit,2.5,1e-9);near(px.wheelCenterSeparationUnits,18.2,.1);
 console.log('   renderer effective wheelbase (world units = track cm, verificado en código y en píxeles): 18.2 | fidelidad al IROH real: TO BE VERIFIED');
});
test('Sin reloj de pared ni aleatoriedad en producto ni en SIM-1 (escaneo de fuentes)',()=>{
 const files=['calibration.js','calibration-mode.js','scenario-props.js','scenario-editor.js','extra-tracks.js','iroh-runtime.js','renderer3d.js','simulator.js','strike-physics.js','tracks.js','tests/sim1/harness.cjs','tests/sim1/scenarios.cjs','tests/sim1/characterization.cjs','tests/sim1/trace-cli.cjs'];
 const bad=/Math\s*\.\s*random|Date\s*\.\s*now|new\s+Date/;
 for(const f of files)assert.ok(!bad.test(fs.readFileSync(path.join(root,f),'utf8')),f);
});

// ───────── 4. Caracterización: runtime y storage ─────────
for(const [name,fn] of [['runtime',C.runtimeCases],['storage',C.storageCases]]){
 test(`Caracterización «${name}» coincide con golden y es determinista`,()=>{
  const a={cases:fn()},b={cases:fn()};assert.equal(JSON.stringify(a),JSON.stringify(b));
  if(UPDATE||!fs.existsSync(goldenPath(name)))fs.writeFileSync(goldenPath(name),fmt(a));
  const c=compare(a,readGolden(name));assert.ok(sameWithinTol(c),`${name}: ${c.first}`);
 });
}
test('Runtime: mensajes amigables y estados clave sin cambiar gramática',()=>{
 const g=Object.fromEntries(readGolden('runtime').cases.map(c=>[c.label,c]));
 assert.match(g['inicialización válida'].msg,/✔ Sintaxis validada/);
 assert.deepEqual(g['avanzar(30) tras 1 s'].motors,[30,30]);assert.deepEqual(g['girarDerecha(20) tras 2 s'].motors,[20,-20]);
 {const v=g['lectura de línea (S01 inicio)'].vars;assert.ok(v.b>=800&&v.b<=930,'negro sobre la línea (modelo simulado)');assert.equal(v.a,Math.round(Math.min(1000,Math.max(0,(v.b-155)*1000/710))),'normalizada coherente con la lectura');assert.equal(v.c,1);assert.equal(v.u,500);}
 assert.equal(g['sonar con caja de práctica'].vars.d,24);   // 18 + 5,83 (origen 4,0 cm en vez de 9,83)
 assert.deepEqual(g['LCD escribirPantalla(col,fila,valor)'].lcd,['123             ','    45          ']);
 assert.equal(g['golpe moverServoGolpe(1) a 0,5 s'].striker,75);   // +1 llega a +75° (derecha del robot) en 0,39 s a 190°/sassert.equal(g['golpe moverServoGolpe(65): valor no admitido, no mueve'].striker,0);assert.match(g['golpe moverServoGolpe(65): valor no admitido, no mueve'].msg,/admite -1, 0 o 1/);assert.equal(g['while con acumulador'].vars.n,3);
 assert.match(g['error: función desconocida con sugerencia'].msg,/¿Quisiste escribir «avanzar\(\)»\?/);
 assert.match(g['error: variable no declarada'].msg,/no está declarada/);
 assert.match(g['error: falta loop'].msg,/Falta la función void loop/);
 assert.match(g['aviso estricto: sensor sin inicializar'].msg,/inicializarSensores|sin llamar antes/);
});
test('Storage: v1 legacy, código por pista, bloqueado, inválido; sin migración ni claves v2',()=>{
 const s=Object.fromEntries(readGolden('storage').cases.map(c=>[c.case,c]));
 assert.equal(s['v1 válida se carga tal cual'].profile.threshold,600);
 for(const k of Object.keys(s).filter(k=>k.startsWith('v1 inválida')))assert.equal(s[k].profile.calibrated,false),assert.equal(s[k].keyUntouched,true);
 assert.deepEqual(s['save escribe solo la clave v1'].keys,['bitiro:line-calibration:v1']);
 assert.equal(s['storage bloqueado desde el arranque'].saveReturned,false);assert.equal(s['storage bloqueado desde el arranque'].changeTrackThrew,false);
 assert.deepEqual(s['v2 nunca se lee ni se escribe'].v2Keys,[]);
});

// ───────── 5. Controles negativos (parches en memoria; el producto NO se modifica) ─────────
const productHash=()=>['simulator.js','calibration.js','scenario-props.js','strike-physics.js','renderer3d.js','iroh-runtime.js','tracks.js','extra-tracks.js','index.html','styles.css'].map(f=>sha(fs.readFileSync(path.join(root,f),'utf8'))).join('');
const before=productHash();
const noSensors=o=>JSON.parse(JSON.stringify(o,(k,v)=>k==='sensors'?undefined:v));
const controls=[
 {id:'wheelbase 10 → 18.2',patch:{file:'simulator.js',from:'base=10;',to:'base=18.2;'},mustBreak:['s01_turn'],mustHold:['s01_straight','servo_sweep','sonar_range']},
 {id:'sensor front 8 → 9',patch:{file:'calibration.js',from:'front:8,spread:1.9',to:'front:9,spread:1.9'},mustBreak:['s02_three_sensors','oval_continuous'],mustHold:['servo_sweep'],
  // SIM-CALIBRATION-1: las lecturas `sensors` dependen de la posición real del sensor (light field), así que cambian al mover el sensor; el movimiento del servo no.
  holdIgnoresSensors:true},
 {id:'strike length 13.2 → 14.2',patch:{file:'strike-physics.js',from:'length: 13.2,',to:'length: 14.2,'},mustBreak:['s01_demo_strike'],mustHold:['s01_straight','oval_continuous']},
];
for(const ctl of controls){
 test(`Control negativo «${ctl.id}» rompe goldens esperados y no otros`,()=>{
  const res={};
  for(const name of Object.keys(S)){
   const t=JSON.parse(JSON.stringify(S[name]({patches:[ctl.patch]})));
   res[name]=!sameWithinTol(compare(t,readGolden(name)));
   if(ctl.holdIgnoresSensors&&ctl.mustHold.includes(name))res[name]=!sameWithinTol(compare(noSensors(t),noSensors(readGolden(name))));
  }
  console.log('   rompe: '+Object.keys(res).filter(k=>res[k]).join(', ')+' | intactos: '+Object.keys(res).filter(k=>!res[k]).join(', '));
  for(const n of ctl.mustBreak)assert.equal(res[n],true,`${ctl.id} debía romper ${n}`);
  for(const n of ctl.mustHold)assert.equal(res[n],false,`${ctl.id} no debía alterar ${n}`);
 });
}
test('Control negativo: el yaw rate cambia con base=18.2 (ω=0,5055 vs 0,92 rad/s)',()=>{
 const y=C.yawRate([{file:'simulator.js',from:'base=10;',to:'base=18.2;'}]);
 assert.ok(Math.abs(y.radPerSec-(2*0.2*23)/18.2)<1e-9);assert.ok(Math.abs(y.radPerSec-(2*0.2*23)/10)>.2);
});
test('Los parches no se aplican si el texto no existe (el control no puede pasar en vacío)',()=>{
 assert.throws(()=>S.s01_straight({patches:[{file:'simulator.js',from:'base=99;',to:'base=1;'}]}),/aparece 0 veces/);
});
test('Producto intacto en disco tras los controles negativos',()=>{assert.equal(productHash(),before);});
console.log(`\n${checks} comprobaciones SIM-1 superadas.`);
