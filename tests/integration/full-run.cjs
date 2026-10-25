/* FIRVI-2025 · Ejecución INTEGRAL autónoma en una ronda del motor de competencia (reloj inyectable, calibración incluida, sin reposiciones).
     node tests/integration/full-run.cjs [A|B] [--program ruta]
   El programa de referencia corre una sola vez, sin tocar código durante el recorrido, y el evaluador (firvi-scoring.js) puntúa la ronda terminada.
   No hay mocks del robot: es el simulador real. El resultado se informa tal cual, sea cual sea. */
'use strict';
const L=require('./lib.cjs');
const route=process.argv[2]==='B'?'B':'A';
const pi=process.argv.indexOf('--program');const program=L.readProgram(pi>0?process.argv[pi+1]:undefined);
const quiet=process.argv.includes('--quiet');
function run(route,program,{calibrationS=20,limitS=420,press=3,obstacles='keep'}={}){
 const h=L.load({extraFiles:L.EXTRA});const clock={t:1000,now:()=>clock.t};
 const C=h.ctx.BITIRO_COMPETITION;C.setClock(clock);h.js(`changeTrack('${L.ID[route]}')`);C.enter();
 const s=C.session();s.setObstacleDecision(obstacles);s.startRound();
 h.el('src').value=program;clock.t+=calibrationS*1000;       // calibración incluida en los 8:00
 const begin=s.beginRun();if(!begin.ok)throw new Error(begin.reason);
 h.js('start()');
 const step=sec=>{for(let t=0;t<Math.round(sec*120);t++){h.js('update(1/120)');clock.t+=1000/120;s.poll();if(s.state==='finished'||s.round.endReached)return;}};
 step(press);h.js('pressTouchSensor(1)');
 const edit=s.mayStartProgram(program+' ');           // intento de editar el código en el recorrido: debe rechazarse
 let t=press;while(t<limitS&&s.state!=='finished'&&!s.round.endReached){step(1);t++;}
 const endAt=Math.round(s.elapsedMs()/1000);
 s.finishRound(s.round.endReached?'captain':'captain');
 const res=h.ctx.BITIRO_FIRVI_SCORING.forSession(s).round(1);
 return {h,s,res,editDenied:!edit.ok,editReason:edit.reason,elapsedS:endAt,simS:Math.round(h.js('simTime'))};
}
module.exports={run};
if(require.main===module){
 const r=run(route,program);const rd=r.s.rounds[0];
 console.log(JSON.stringify({route,elapsedClockS:r.elapsedS,simSeconds:r.simS,state:r.s.state,finishedBy:rd.finishedBy,overcome:Object.keys(rd.overcome),endReached:!!rd.endReached,faults:rd.faults.length,repositions:rd.repositions.length,checkpoint:rd.checkpoint.enabled,editBlockedDuringRun:r.editDenied,collisions:r.h.js('collisionCount')}));
 if(!quiet){for(const m of r.res.milestones)console.log(' ',m.id.padEnd(26),m.status.padEnd(15),String(m.points).padStart(3),'|',m.reason.slice(0,170));
  console.log('TOTAL confirmado',r.res.total,'· pendiente de juez (potencial)',r.res.pendingPotential,'· tiempo ronda (ms)',r.res.timeMs,'· integridad',JSON.stringify(r.res.integrity));}
}
