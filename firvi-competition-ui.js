/* BITIRO Simulador · FIRVI 2025 · interfaz de competencia (Etapa B). Solo lee el motor (firvi-competition.js) y le envía órdenes; no guarda estado propio
   de la competencia. El estado de la ronda vive en la máquina de estados; aquí solo se muestra y se aplican los bloqueos que ese estado dicta. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id),C=window.BITIRO_FIRVI_COMPETITION;
 const bar=$('competitionBar'),toggle=$('competitionToggle');
 if(!C||!bar||!toggle)return;
 const S=C.S,el={round:$('compRound'),state:$('compState'),clock:$('compClock'),info:$('compInfo'),note:$('compNote'),obstacles:$('compObstacles'),obstaclesField:$('compObstaclesField'),
  start:$('compStart'),calibrate:$('compCalibrate'),run:$('compRun'),exec:$('compExecute'),fault:$('compFault'),reposition:$('compReposition'),finish:$('compFinish'),next:$('compNext')};
 const LABEL={[S.PREPARATION]:'Preparación',[S.CALIBRATION]:'Calibración',[S.RUNNING]:'Recorrido puntuable',[S.NO_PROGRESS]:'Falta de progreso',[S.REPOSITION]:'Reposición autorizada',[S.FINISHED]:'Ronda finalizada'};
 const mmss=ms=>{const t=Math.ceil(ms/1000),m=Math.floor(t/60);return String(m).padStart(2,'0')+':'+String(t%60).padStart(2,'0');};
 const track=()=>window.BITIRO_WORLD&&window.BITIRO_WORLD.track&&window.BITIRO_WORLD.track();
 const eligible=()=>{const t=track();return !!(t&&t.competition==='firvi-2025'&&t.competitionSpec);};
 // Término oficial de las bases (V.G); el texto se asigna aquí para que el HTML de la modalidad práctica no lo contenga.
 el.fault.textContent='Falta de progreso';el.fault.title='Solo el capitán puede declararla (V.G.3). Máximo tres intentos puntuables por cuarto.';
 const RULE={'start-base':'la base inicial','checkpoint-tile':'la baldosa de la ficha naranja','previous-room-last-tile':'la última baldosa del cuarto anterior'};
 let note='';
 const say=m=>{note=m;};
 const act=(fn)=>()=>{const r=fn();if(r&&r.ok===false)say(r.reason);else if(r&&r.ok)say('');render();};
 const set=(node,show,enabled=true)=>{if(!node)return;node.hidden=!show;node.disabled=!enabled;};
 const dis=(id,off)=>{const n=$(id);if(n)n.disabled=!!off;};

 function render(){
  const ok=eligible();
  toggle.hidden=!ok;
  if(!ok&&C.on&&!C.session()){C.leave();}
  const s=ok&&C.on?C.session():null;
  toggle.setAttribute('aria-pressed',String(!!s));toggle.textContent=s?'Salir de competencia':'Competencia';
  bar.hidden=!s;document.body.classList.toggle('competition-on',!!s);
  applyLocks(s);
  if(!s)return;
  const st=s.state,r=s.round;
  el.round.textContent='Ronda '+s.roundNumber+' de '+C.ROUNDS+' · Recorrido '+(s.track.route||'');
  el.state.textContent=LABEL[st];el.state.dataset.state=st;
  el.clock.textContent=mmss(s.remainingMs());el.clock.classList.toggle('warn',st!==S.PREPARATION&&s.remainingMs()<60000);
  el.clock.title='Reloj de competencia (8 min con calibración). No se detiene con pausa ni cambia con la velocidad.';
  set(el.obstaclesField,st===S.PREPARATION);if(st===S.PREPARATION)el.obstacles.value=s.obstacleDecision;
  set(el.start,st===S.PREPARATION);set(el.calibrate,st===S.CALIBRATION);set(el.run,st===S.CALIBRATION);
  set(el.exec,st===S.RUNNING||st===S.REPOSITION);set(el.fault,st===S.RUNNING);set(el.reposition,st===S.NO_PROGRESS);
  set(el.finish,[S.CALIBRATION,S.RUNNING,S.NO_PROGRESS,S.REPOSITION].includes(st));
  set(el.next,st===S.FINISHED&&!s.complete);
  const parts=[];
  if(r&&st!==S.PREPARATION){
   const at=s.attemptsView(),room=s.currentRoom();
   if([S.RUNNING,S.NO_PROGRESS,S.REPOSITION].includes(st))parts.push('Cuarto '+room+' · intento '+at[room].current+(at[room].scoringEligible?'':' (sin puntos)'));
   parts.push('Checkpoint: '+(r.checkpoint.enabled?'habilitado':'—'));parts.push('Faltas: '+r.faults.length);
   parts.push('Obstáculos: '+(r.obstacles==='remove'?'retirados':'en pista'));
   if(st===S.FINISHED)parts.push((r.finishedBy==='time'?'Terminó por tiempo':'Finalizada por el capitán')+' · '+mmss(Math.min(C.ROUND_MS,r.endClock-r.startClock)).replace(/^/,'tiempo '));
  }
  el.info.textContent=parts.join(' · ');
  let hint=note;
  if(!hint){
   if(st===S.PREPARATION)hint='Decide los obstáculos y pulsa «Iniciar ronda»: el reloj de 8 min corre desde ahí, calibración incluida.';
   else if(st===S.CALIBRATION)hint='Calibra y ajusta tu programa. «Comenzar recorrido» coloca el robot en la base y bloquea código y calibración.';
   else if(st===S.RUNNING)hint='Pulsa Ejecutar (y el Pulsador si tu programa lo espera). Solo el capitán puede declarar falta de progreso.';
   else if(st===S.NO_PROGRESS){const f=r.faults[r.faults.length-1];hint='Falta en el cuarto '+f.room+': el robot se repondrá en '+RULE[f.allowed.rule]+(f.allowed.provisional?' (decisión provisional)':'')+'.';}
   else if(st===S.REPOSITION)hint='Robot repuesto. Pulsa Ejecutar para reiniciar el mismo programa.';
   else hint=s.complete?'Las dos rondas terminaron.':'Puedes modificar el programa antes de la ronda siguiente.';
  }
  el.note.textContent=hint;
 }
 /* Bloqueos que dicta el estado (la lógica de permisos está en el motor; aquí solo se reflejan en los controles). */
 let wasLocked=false;
 function applyLocks(s){
  const edit=!!(s&&s.editLocked()),time=!!(s&&s.timeLocked()),world=!!(s&&s.worldLocked()),cal=!!(s&&!s.calibrationAllowed()),trk=!!(s&&s.trackChangeLocked());
  const src=$('src');if(src)src.readOnly=edit;
  dis('example',edit);dis('restoreStarter',edit);
  dis('pause',time||undefined);dis('step',time||undefined);dis('speed',time);
  if(time&&$('speed')&&$('speed').value!=='1')$('speed').value='1';
  dis('reset',world);dis('calibrate',cal);dis('calibrationMode',world);dis('track',trk);dis('codeToggle',false);
  if(world&&window.BITIRO_MANUAL&&window.BITIRO_MANUAL.calibration)window.BITIRO_MANUAL.calibration=false;
  if(!time&&wasLocked){dis('pause',true);}                 // al soltar el bloqueo vuelve el estado normal (la simulación habilita pausa al ejecutar)
  wasLocked=time;
 }
 toggle.addEventListener('click',()=>{const r=C.on?C.leave():C.enter();if(!r.ok)say(r.reason);else say('');render();});
 el.obstacles.addEventListener('change',()=>{const s=C.session();if(s){const r=s.setObstacleDecision(el.obstacles.value);if(!r.ok)say(r.reason);render();}});
 el.start.addEventListener('click',act(()=>C.session().startRound()));
 el.calibrate.addEventListener('click',()=>$('calibrate').click());
 el.run.addEventListener('click',act(()=>C.session().beginRun()));
 // «Ejecutar» junto a las órdenes de la ronda (solo se ve apilado): reenvía el clic al mismo botón de la barra de ejecución; no tiene lógica propia ni salta ningún bloqueo.
 el.exec.addEventListener('click',()=>$('runBar').click());
 el.fault.addEventListener('click',act(()=>C.session().declareNoProgress()));
 el.reposition.addEventListener('click',act(()=>C.session().reposition()));
 el.finish.addEventListener('click',act(()=>C.session().finishRound('captain')));
 el.next.addEventListener('click',act(()=>C.session().nextRound()));
 setInterval(()=>{if(C.on)C.poll();render();},250);
 document.addEventListener('visibilitychange',()=>{if(C.on)C.poll();render();});
 $('track')?.addEventListener('change',render);
 render();
})();
