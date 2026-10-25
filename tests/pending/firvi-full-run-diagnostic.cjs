/* FIRVI-2025 · DIAGNÓSTICO de la prueba pendiente de recorrido autónomo completo (tests/pending/firvi-full-autonomous-run.cjs).
   Solo OBSERVA: ejecuta el mismo programa de sensores en una ronda real (reloj falso, calibración, sin faltas) y, al detenerse el robot, informa DÓNDE y POR QUÉ
   (cuarto, distancia recorrida por la línea, cobertura, qué detecta el sonar, qué prisma toca, qué hizo el servo) y qué decide el evaluador sobre esa ronda.
   No modifica la pista, la física, el programa ni las pruebas; no es parte de la regresión y termina con código 0 aun cuando el recorrido no se complete.
     FIRVI_DIAG=1 node tests/pending/firvi-full-run-diagnostic.cjs [A|B]     (sin FIRVI_DIAG imprime «PENDIENTE» y sale) */
'use strict';
const fs=require('node:fs');
const {load}=require('../sim1/harness.cjs');
if(!process.env.FIRVI_DIAG){console.log('PENDIENTE · diagnóstico del recorrido autónomo completo (ejecuta con FIRVI_DIAG=1). Ver el encabezado de este archivo.');process.exit(0);}
const route=process.argv[2]==='B'?'firvi-2025-b':'firvi-2025';
const PROGRAM=process.env.FIRVI_E2E_PROGRAM?fs.readFileSync(process.env.FIRVI_E2E_PROGRAM,'utf8'):`void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(1200);botonInicio();}
int ult=0;int lost=0;int done=0;
void loop(){
 if(done==0 && leerDistanciaSonar()<=14){detenerse();pausa(300);moverServoGolpe(1);pausa(1500);moverServoGolpe(0);pausa(1200);done=1;}
 bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;
const EXTRA=['line-geometry.js','firvi-2025.js','firvi-competition.js','firvi-scoring.js'];
const h=load({extraFiles:EXTRA});const clock={t:0,now:()=>clock.t};h.ctx.BITIRO_COMPETITION.setClock(clock);h.js(`changeTrack('${route}')`);h.ctx.BITIRO_COMPETITION.enter();
const s=h.ctx.BITIRO_COMPETITION.session();
s.startRound();h.el('src').value=PROGRAM;clock.t+=60000;s.beginRun();h.js('start()');
const step=sec=>{for(let t=0;t<Math.round(sec*120);t++){h.js('update(1/120)');clock.t+=1000/120;s.poll();}};
step(3);h.js('pressTouchSensor(1)');
// avanza hasta que el robot lleve 20 s de simulación casi inmóvil o termine la ronda
let still=0,last=null,out=null;
for(let k=0;k<420&&s.state!=='finished';k++){
 step(1);const p=[h.js('R.x'),h.js('R.y')];
 if(last&&Math.hypot(p[0]-last[0],p[1]-last[1])<.3)still++;else still=0;last=p;
 if(still>=20||s.round.endReached){out=k;break;}
}
const SC=h.ctx.BITIRO_FIRVI_SCORING,trk=h.ctx.BITIRO_WORLD.track(),R=SC.routeOf({...trk,competition:trk.competitionSpec});
const trace=h.js('BITIRO_TRACE_LOG()'),phys=h.js('BITIRO_PHYSICS_LOG()');
const q=trace[trace.length-1],F=h.js('LINE_SENSOR.geometry.front'),sx=q.x+F*Math.cos(q.h),sy=q.y+F*Math.sin(q.h);
let best=null;for(let i=1;i<R.pts.length;i++){const a=R.pts[i-1],b=R.pts[i],dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((sx-a.x)*dx+(sy-a.y)*dy)/(dx*dx+dy*dy||1e-9))),d=Math.hypot(sx-a.x-u*dx,sy-a.y-u*dy);if(!best||d<best.d)best={d,s:a.s+u*(b.s-a.s)};}
const obs=h.ctx.BITIRO_SIM_ADAPTER.obstacles();
const info={route,simSeconds:Math.round(h.js('simTime')),state:s.state,stoppedAfterS:out,
 pose:{x:+q.x.toFixed(1),y:+q.y.toFixed(1),headingDeg:Math.round(q.h*180/Math.PI)},lineCmFromStart:Math.round(best.s),routeLenCm:Math.round(R.len),distToLineCm:+best.d.toFixed(1),
 roomsOvercome:Object.keys(s.round.overcome),endReached:!!s.round.endReached,faults:s.round.faults.length,collisions:h.js('collisionCount'),
 mode:h.js('mode'),running:h.js('running'),lcd:h.js('lcd.slice()'),sonarCm:Math.round(h.js('readSonarDistance()')),servoDeg:Math.round(h.js('striker.angle')),
 blocked:h.js('striker.blocked'),feedback:h.el('feedback').textContent,sensorsNow:q.s,motorsNow:[q.l,q.m],
 physicsEvents:phys.filter(e=>e.kind!=='touch').map(e=>({kind:e.kind,id:e.id,t:+e.t.toFixed(1),detail:String(e.detail).slice(0,70)})).slice(0,12),
 obstacles:obs.map(o=>({id:o.id,movedCm:+Math.hypot(o.x-o.x0,o.y-o.y0).toFixed(1),distToRobotCm:+Math.hypot((o.x+6.5)-q.x,(o.y+6)-q.y).toFixed(1)}))};
console.log(JSON.stringify(info,null,1));
s.finishRound('captain');const res=SC.forSession(s).round(1);
console.log('Evaluador:',res.milestones.map(m=>m.id+'='+m.status+(m.points?'('+m.points+')':'')).join(' · '),'· total confirmado',res.total,'· integridad',JSON.stringify(res.integrity));
const gaps=res.milestones.find(m=>m.id==='gaps');console.log('Gaps:',JSON.stringify(gaps.evidence.gaps.map(g=>[g.gap,g.traversedContinuously])));
console.log('\nUna ejecución integral aprobada debe demostrar, en UNA misma ronda real y sin faltas de progreso: tacto → cuarto 1 (obstáculo apartado por abanico) → cuarto 2 (3 gaps, 2 topes, tarea) → cuarto 3 (obstáculo) → base opuesta;\nesto es: endReached=true, overcome={1,2}, el evaluador concede room-initial, gaps y room-final de forma AUTOMÁTICA con un solo programa de sensores, sin alterar la pista.');
