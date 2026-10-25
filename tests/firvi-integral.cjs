/* FIRVI-2025 · VALIDACIÓN INTEGRAL AUTÓNOMA (simulador real; sin mocks del robot).
   node tests/firvi-integral.cjs
   Un ÚNICO programa de referencia (tests/integration/reference-program.iroh) basado en sensores —línea ×3, sonar, servo— recorre la pista completa A y B dentro del
   motor de competencia (calibración incluida, sin reposiciones, sin tocar el código) y el evaluador puntúa la ronda. El programa NO conoce coordenadas, rutas ni la posición
   de los prismas; el arnés sí (para colocar al robot en las pruebas de aislamiento y para medir). La pista, la física y los umbrales del evaluador no se modifican.
   Los casos se ejecutan en procesos paralelos (cada uno es una simulación completa). La prueba en navegador con el reloj de pared está en tests/firvi-integral-ui.mjs. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const L=require('./integration/lib.cjs');

const WORKER=path.join(__dirname,'integration','worker.cjs');
const pool=Math.max(2,Math.min(10,os.cpus().length-1));
const queue=[];let running=0;
function job(spec){return new Promise((res,rej)=>{queue.push({spec,res,rej});pump();});}
function pump(){while(running<pool&&queue.length){const j=queue.shift();running++;
 const p=spawn(process.execPath,[WORKER,JSON.stringify(j.spec)]);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);
 p.on('close',code=>{running--;try{j.res(JSON.parse(out.trim().split('\n').pop()));}catch(e){j.rej(new Error('caso '+JSON.stringify(j.spec).slice(0,120)+' → '+(err||out).slice(0,300)));}pump();});}}

// Prismas: [recorrido, s del prisma en ese recorrido, id, garra aparcada al llegar (el 1.º se barre de −1 a +1; el 2.º de +1 a −1), ordinal]
const PRISMS=[['A',96,'obstacle-room1',-1,1],['A',633,'obstacle-room3',1,2],['B',98,'obstacle-room3',-1,1],['B',634,'obstacle-room1',1,2]];
const ARRIVALS=[];for(const d of [85,65,50])for(const [lat,dh] of [[0,0],[1.5,8],[-1.5,-8]])ARRIVALS.push({d,lat,dh});
const SC_PARAMS={clearanceCm:8.3};

let n=0;const report=[];
const test=async(name,fn)=>{await fn();n++;console.log('OK · '+name);};

(async()=>{
 // Se lanzan todos los casos a la vez (el pool los reparte).
 const prism=PRISMS.map(([k,sp,id,park,ord])=>({k,id,ord,rows:ARRIVALS.map(a=>({a,p:job({type:'prism',k,id,pre:ord===2,parked:park,startS:sp-a.d,lat:a.lat,dh:a.dh,seconds:60})}))}));
 const fullA=job({type:'full',k:'A'}),fullB=job({type:'full',k:'B'});
 const noObsA=job({type:'full',k:'A',obstacles:'remove'}),noObsB=job({type:'full',k:'B',obstacles:'remove'});
 const weak=L.readProgram(path.join(__dirname,'integration','legacy-single-sweep.iroh'));
 const weakA=job({type:'full',k:'A',program:weak,limitS:200});
 const noSweep=L.readProgram().replace('moverServoGolpe(0-p);pausa(1500);','');
 const noSweepA=job({type:'full',k:'A',program:noSweep,limitS:150});

 await test('aislamiento · prismas 1.º y 2.º, ambos recorridos, 9 llegadas razonables cada uno: el abanico los desplaza (sin empujes) y la trayectoria queda libre (≥ 8,3 cm del eje)',async()=>{
  for(const pr of prism){
   const res=await Promise.all(pr.rows.map(r=>r.p));
   res.forEach((r,i)=>{const a=pr.rows[i].a,tag=`${pr.k} ${pr.id} (${pr.ord}.º) d=${a.d} lat=${a.lat} rumbo=${a.dh}`;
    assert.ok(r.sweeps>=1,tag+': hubo abanico');assert.equal(r.pushes,0,tag+': sin empujes del chasis/garra fija');assert.ok(r.movedCm>=5,tag+': desplazado '+r.movedCm);
    assert.ok(r.clearCm>=SC_PARAMS.clearanceCm,tag+': trayectoria libre ('+r.clearCm+' cm)');assert.ok(r.originClearCm<SC_PARAMS.clearanceCm,tag+': el prisma bloqueaba la línea en su origen');});
   report.push(`${pr.k} ${pr.id}: despeje ${Math.min(...res.map(r=>r.clearCm))}–${Math.max(...res.map(r=>r.clearCm))} cm, desplazado ${Math.min(...res.map(r=>r.movedCm))}–${Math.max(...res.map(r=>r.movedCm))} cm`);
  }
 });
 await test('aislamiento · tras el prisma el robot sigue por la línea y recupera la marcha (pasa de largo, sin quedar detenido ni salir de la pista antes del final)',async()=>{
  for(const pr of prism){const res=await Promise.all(pr.rows.map(r=>r.p));
   res.forEach((r,i)=>{const a=pr.rows[i].a,sp=PRISMS.find(x=>x[0]===pr.k&&x[2]===pr.id)[1];assert.ok(r.s>sp+25||r.s>=725,`${pr.k} ${pr.id} d=${a.d}: llegó a s=${r.s} (prisma en ${sp})`);assert.ok(r.contacts<=40,`contactos: ${r.contacts}`);});}
 });
 const A=await fullA,B=await fullB;
 const must=(r,k)=>{
  assert.equal(r.state,'finished');assert.ok(r.endReached,k+': llegó a la zona final');assert.deepEqual(r.overcome,['1','2']);assert.equal(r.faults,0,'sin faltas de progreso');assert.equal(r.repositions,0,'sin reposiciones');
  assert.equal(r.checkpoint,true,'checkpoint habilitado al superar el cuarto 1');assert.equal(r.editDenied,true,'edición de código rechazada durante el recorrido');
  assert.ok(r.events.includes('run-begin')&&r.events.includes('program-started')&&r.events.includes('end-reached')&&r.events.includes('round-finish'));
  assert.ok(!r.events.includes('reposition')&&!r.events.includes('no-progress-declared'));
  assert.ok(r.elapsedClockS<480,'dentro de 8:00: '+r.elapsedClockS);
 };
 await test('INTEGRAL A: una ejecución autónoma, sin reposiciones, cuartos 1–3, tres gaps y dos prismas por abanico, llegada a la zona final; 220 pts automáticos y 80 pendientes del juez',async()=>{
  must(A,'A');assert.equal(A.track,'firvi-2025');
  assert.equal(A.m['touch-start'].st,'validated-auto');assert.equal(A.m['room-initial'].pts,60);assert.equal(A.m['room-final'].pts,60);assert.equal(A.m['gaps'].pts,30);
  assert.equal(A.m['obstacle:obstacle-room1'].pts,30);assert.equal(A.m['obstacle:obstacle-room3'].pts,30);
  assert.equal(A.m['line-following'].st,'pending');assert.equal(A.m['line-following'].judge,true);assert.equal(A.m['final-task'].st,'pending');assert.equal(A.m['final-task'].judge,true);
  assert.equal(A.total,220);assert.equal(A.pendingPotential,80);assert.deepEqual(A.integrity,{unauthorizedJumps:0,traceGaps:0,unverifiedStarts:0});
 });
 await test('INTEGRAL B (sentido opuesto, sin ruta premapeada): mismas condiciones y mismo resultado; registro y evaluación INDEPENDIENTES de A',async()=>{
  must(B,'B');assert.equal(B.track,'firvi-2025-b');
  assert.equal(B.m['room-initial'].pts,60);assert.equal(B.m['room-final'].pts,60);assert.equal(B.m['gaps'].pts,30);assert.equal(B.m['obstacle:obstacle-room1'].pts,30);assert.equal(B.m['obstacle:obstacle-room3'].pts,30);
  assert.equal(B.m['line-following'].st,'pending');assert.equal(B.m['final-task'].st,'pending');assert.equal(B.total,220);assert.equal(B.pendingPotential,80);
  assert.notEqual(A.track,B.track,'sesiones distintas');
 });
 await test('control comparativo SIN obstáculos: el mismo programa completa A y B; los obstáculos «no aplican» y el máximo baja a 240; el programa no inventa barridos',async()=>{
  const a=await noObsA,b=await noObsB;
  for(const r of [a,b]){must(r,r.k);assert.equal(r.m['obstacle:obstacle-room1'].st,'not-applicable');assert.equal(r.m['obstacle:obstacle-room3'].st,'not-applicable');
   assert.equal(r.total,160,'10 + 60 + 30 + 60');assert.equal(r.pendingPotential,80);}
 });
 await test('NEGATIVO · el programa heredado (un solo barrido, garra al centro) SIGUE detenido en el 2.º prisma: no llega a la zona final ni suma room-final',async()=>{
  const r=await weakA;assert.equal(r.endReached,false);assert.ok(r.m['obstacle:obstacle-room1'].pts===30);assert.equal(r.m['obstacle:obstacle-room3'].pts,0);assert.equal(r.m['room-final'].pts,0);
 });
 await test('NEGATIVO · sin la orden de barrido el robot no puntúa obstáculos ni llega a la zona final (el contacto con el prisma no es abanico)',async()=>{
  const r=await noSweepA;assert.equal(r.endReached,false);assert.equal(r.m['obstacle:obstacle-room1'].pts,0);assert.equal(r.m['obstacle:obstacle-room3'].pts,0);assert.equal(r.m['room-final'].pts,0);
 });
 await test('el programa de referencia no conoce la pista: sin coordenadas, ni rutas ni accesos a la física, y es una prueba aparte (no es el inicial de los estudiantes)',()=>{
  const src=L.readProgram();
  assert.ok(!/BITIRO_|IROH_|simTime|\bR\.x\b|\bR\.y\b|placeRobot|hardReset|obstacles\b/.test(src));
  const calls=new Set([...src.matchAll(/\b([a-zA-Z]+)\(/g)].map(m=>m[1]));
  const allowed=new Set(['setup','loop','seguir','barrer','if','while','avanzar','detenerse','pausa','inicializarMovimiento','inicializarSensores','inicializarGolpe','moverServoGolpe','botonInicio','lineaIzquierda','lineaCentral','lineaDerecha','leerDistanciaSonar','int','bool','void']);
  for(const c of calls)assert.ok(allowed.has(c),'llamada no permitida: '+c);
  const starters=fs.readFileSync(path.join(__dirname,'..','starters.js'),'utf8');assert.ok(!starters.includes('seguir(')&&!starters.includes('barrer('),'no es un starter de los estudiantes');
  assert.ok(!/\b(2[0-9]{2}|3[0-9]{2})\.\d/.test(src.replace(/\/\/.*$/gm,'')),'sin coordenadas numéricas de la pista');
 });
 console.log('\n'+report.join('\n'));
 console.log(`\n${n} comprobaciones de integración autónoma superadas`);
})().catch(e=>{console.error(e);process.exit(1);});
