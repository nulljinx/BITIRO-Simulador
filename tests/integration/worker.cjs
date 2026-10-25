/* Proceso de trabajo de tests/firvi-integral.cjs: ejecuta UN caso (aislamiento o ronda completa) y escribe su resultado en una línea JSON. */
'use strict';
const L=require('./lib.cjs');
const {run}=require('./full-run.cjs');
const job=JSON.parse(process.argv[2]);
const program=job.program||L.readProgram();
if(job.type==='prism'){
 // Aislamiento: el programa arranca ANTES del prisma (en el tramo de línea que lo precede), con la garra aparcada como la dejaría el obstáculo anterior.
 const r=L.trial({k:job.k,program:job.pre?program.replace('int p=-1','int p=1').replace('moverServoGolpe(-1);pausa(1200);',''):program,parked:job.parked,startS:job.startS,lat:job.lat,dHead:job.dh,seconds:job.seconds||60});
 const o=r.obs.find(x=>x.id===job.id);
 const ev=r.physics.filter(e=>e.id===job.id);
 console.log(JSON.stringify({s:r.s,t:r.t,off:r.offLineCm,mode:r.mode,movedCm:o.movedCm,clearCm:o.clearCm,originClearCm:o.originClearCm,sweeps:ev.filter(e=>e.kind==='sweep').length,pushes:ev.filter(e=>e.kind==='push').length,contacts:r.contacts,collisions:r.collisions}));
}else if(job.type==='full'){
 const r=run(job.k,program,{calibrationS:job.calibrationS||20,limitS:job.limitS||420,obstacles:job.obstacles||'keep'});
 const rd=r.s.rounds[0];
 console.log(JSON.stringify({k:job.k,state:r.s.state,elapsedClockS:r.elapsedS,simS:r.simS,overcome:Object.keys(rd.overcome),endReached:!!rd.endReached,faults:rd.faults.length,repositions:rd.repositions.length,checkpoint:rd.checkpoint.enabled,editDenied:r.editDenied,
  total:r.res.total,pendingPotential:r.res.pendingPotential,timeMs:r.res.timeMs,integrity:r.res.integrity,track:r.s.track.id,events:rd.events.map(e=>e.type),
  m:Object.fromEntries(r.res.milestones.map(m=>[m.id,{st:m.status,pts:m.points,judge:m.judgeRequired}]))}));
}
