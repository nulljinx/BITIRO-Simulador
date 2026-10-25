/* BITIRO Simulador · FIRVI 2025 · Etapa B: MOTOR DE COMPETENCIA (rondas, reloj, calibración, falta de progreso, checkpoint, intentos).
   Módulo SIN DOM y con reloj inyectable: la máquina de estados es el único lugar donde vive el estado de la competencia; la interfaz
   (firvi-competition-ui.js) solo la lee y le envía órdenes. NO hay puntuación (Etapa C, firvi-scoring.js): aquí solo se OBSERVAN y REGISTRAN hechos.

   Garantías de diseño:
   · Reloj de competencia = reloj de pared (`clock.now()`), independiente del tiempo interno de simulación. Pausa, paso a paso y velocidad no lo detienen.
   · El simulador nunca es dirigido: el motor solo (a) coloca al robot en una reposición AUTORIZADA, (b) en el inicio del recorrido (robot en la base) y
     (c) quita/restaura obstáculos antes de la ronda. Durante la marcha normal solo observa la pose.
   · Nada se decide con conocimiento oculto: el cuarto superado se detecta por el cruce físico continuo de un plano, no por la ficha naranja.
   FUENTES (Bases FIRVI 2025 V2): V.C.4–8 (8 min con calibración; inicio tras calibrar; sin calibrar durante el recorrido), V.D.1 (sin subir código),
   V.E (obstáculos), V.F.5–6 (checkpoint por ronda), V.G (falta de progreso, reposición, tres intentos puntuables). Decisiones PROVISIONALES: ver
   PROVISIONAL y docs/firvi-2025.md. */
'use strict';
window.BITIRO_FIRVI_COMPETITION=(()=>{
 const ROUND_MS=8*60*1000,ROUNDS=2,SCORING_ATTEMPTS=3,CONTINUITY_CM=3,END_REACHED_CM=14;
 const S=Object.freeze({PREPARATION:'preparation',CALIBRATION:'calibration',RUNNING:'running',NO_PROGRESS:'no-progress',REPOSITION:'reposition-authorized',FINISHED:'finished'});
 const ACTIVE=[S.CALIBRATION,S.RUNNING,S.NO_PROGRESS,S.REPOSITION];
 /* Tabla de transiciones: ÚNICA fuente de las órdenes válidas. */
 const TRANSITIONS=Object.freeze({
  startRound:{from:[S.PREPARATION],to:S.CALIBRATION},
  beginRun:{from:[S.CALIBRATION],to:S.RUNNING},
  declareNoProgress:{from:[S.RUNNING],to:S.NO_PROGRESS},
  reposition:{from:[S.NO_PROGRESS],to:S.REPOSITION},
  programRestarted:{from:[S.REPOSITION],to:S.RUNNING},
  finishRound:{from:ACTIVE,to:S.FINISHED},
  nextRound:{from:[S.FINISHED],to:S.PREPARATION}
 });
 /* Decisiones que las bases no cierran. Se registran con cada hecho para que Etapa C y el juez las vean. */
 const PROVISIONAL=Object.freeze({
  obstacleDecisionLock:'La decisión de mantener o retirar obstáculos se fija al iniciar la ronda (V.E.1: se informa «antes del inicio» y no cambia durante ella).',
  fieldRestoredAtRun:'Al comenzar el recorrido puntuable el campo se restaura (obstáculos en su sitio) y el robot se coloca en la base inicial (V.C.7); las bases no dicen qué pasa con lo movido durante la calibración.',
  roomMembership:'El cuarto de un punto se decide por los planos de entrada de cada cuarto (la zona de pasillo pertenece al cuarto anterior hasta el plano de entrada del siguiente).',
  repositionRoom2:'Falta en el 2.º cuarto → baldosa de la ficha naranja (V.F.5: nuevo punto de inicio). V.G.4 dice «última baldosa del cuarto anterior»; esa alternativa se registra en cada reposición.',
  repositionRoom3:'Las bases no definen el 3.er cuarto: se generaliza V.G.4 (última baldosa del cuarto anterior).',
  extraAttempts:'Los reinicios son ilimitados (V.G.6) pero solo los tres primeros por cuarto quedan marcados como puntuables; los demás se registran sin puntos.',
  roomOvercome:'«Cuarto superado» se registra al cruzar físicamente, con movimiento continuo y en recorrido puntuable, el plano de entrada del cuarto siguiente. El seguimiento completo de la línea y los gaps lo valorará la Etapa C.',
  clock:'El reloj de competencia es de pared; el simulador corre a 1× mientras haya ronda activa. Si el equipo se retrasa por el rendimiento del navegador, el reloj no espera.'
 });
 const hashSource=src=>{let h=2166136261;for(let i=0;i<src.length;i++){h^=src.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');};
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

 /* Una SESIÓN = un recorrido (A o B). Dos rondas, cada una con su registro; nada se comparte entre sesiones. */
 function createSession({track,adapter,clock}){
  const comp=track.competition,dir=comp.direction,planes=comp.planes;
  let state=S.PREPARATION,roundNumber=1,round=null,frozenSource=null,programStartedThisAttempt=false,lastPose=null,denied='';
  let obstacleDecision='keep';
  const rounds=[];
  const nowMs=()=>clock.now();
  const elapsed=()=>round?Math.min(ROUND_MS,(round.endClock??nowMs())-round.startClock):0;
  const log=(type,data={})=>{if(round)round.events.push({type,clockMs:Math.round(nowMs()-round.startClock),simTime:adapter.simTime(),seq:typeof adapter.seq==='function'?adapter.seq():null,state,...data});};
  const deny=reason=>{denied=reason;return {ok:false,reason};};
  const can=(cmd)=>TRANSITIONS[cmd].from.includes(state);
  const go=(cmd)=>{state=TRANSITIONS[cmd].to;};
  /* Ordinal del cuarto (1.º, 2.º, 3.º en el sentido de ESTE recorrido) de una posición, por los planos de entrada. */
  const ordinalOf=pose=>{let o=1;for(let k=0;k<planes.length;k++)if(dir*(pose.x-planes[k])>=0)o=k+2;return o;};
  const newRound=n=>({number:n,obstacles:obstacleDecision,startClock:null,endClock:null,finishedBy:null,calibrationMs:null,run:null,
   attempts:{1:{current:1},2:{current:0},3:{current:0}},overcome:{},checkpoint:{enabled:false},faults:[],repositions:[],events:[],physicsDuringCalibration:[],physics:[],endReached:null});

  function startRound(){
   if(!can('startRound'))return deny('La ronda solo puede iniciarse desde la preparación.');
   round=newRound(roundNumber);round.obstacles=obstacleDecision;
   adapter.setObstaclesRemoved(obstacleDecision==='remove');adapter.hardReset();
   go('startRound');round.startClock=nowMs();frozenSource=null;programStartedThisAttempt=false;lastPose=null;
   log('round-start',{round:roundNumber,obstacles:obstacleDecision,limitMs:ROUND_MS,provisional:'obstacleDecisionLock'});
   return {ok:true};
  }
  function setObstacleDecision(v){
   if(state!==S.PREPARATION)return deny('La decisión sobre los obstáculos solo puede tomarse antes de iniciar la ronda.');
   if(v!=='keep'&&v!=='remove')return deny('Decisión no válida.');
   obstacleDecision=v;adapter.setObstaclesRemoved(v==='remove');adapter.hardReset();return {ok:true,decision:v};
  }
  function beginRun(){
   if(!can('beginRun'))return deny('El recorrido puntuable solo comienza tras la calibración.');
   round.calibrationMs=Math.round(nowMs()-round.startClock);
   round.physicsDuringCalibration=adapter.physicsLog();
   frozenSource=adapter.source();
   adapter.hardReset();                                   // campo restaurado y robot en la base inicial (V.C.7); también apaga el programa de la calibración
   go('beginRun');programStartedThisAttempt=false;lastPose=null;
   round.run={beganAtClockMs:Math.round(nowMs()-round.startClock),programHash:hashSource(frozenSource),startPose:adapter.pose()};
   log('run-begin',{programHash:round.run.programHash,calibrationMs:round.calibrationMs,startPose:round.run.startPose,provisional:'fieldRestoredAtRun'});
   return {ok:true};
  }
  /* ── observación de la marcha (el simulador llama en cada paso físico; el motor NO escribe en el simulador) ── */
  function observe(pose){
   if(state!==S.RUNNING){lastPose=null;return;}
   const prev=lastPose;lastPose={x:pose.x,y:pose.y};
   if(!prev||dist(prev,pose)>CONTINUITY_CM)return;                   // un salto de pose no es avance físico
   for(let k=1;k<=planes.length;k++){
    if(round.overcome[k]||(k>1&&!round.overcome[k-1]))continue;
    const plane=planes[k-1];
    if(dir*(prev.x-plane)<0&&dir*(pose.x-plane)>=0)markOvercome(k,pose);
   }
   if(round.overcome[planes.length]&&!round.endReached&&dist(pose,comp.endTip)<=END_REACHED_CM){
    round.endReached={clockMs:Math.round(nowMs()-round.startClock),simTime:adapter.simTime(),attempt:round.attempts[planes.length+1].current};
    log('end-reached',{attempt:round.endReached.attempt});
   }
  }
  function markOvercome(k,pose){
   const attempt=round.attempts[k].current;
   round.overcome[k]={clockMs:Math.round(nowMs()-round.startClock),simTime:adapter.simTime(),attempt,scoringEligible:attempt<=SCORING_ATTEMPTS,pose:{x:pose.x,y:pose.y}};
   log('room-overcome',{room:k,attempt,scoringEligible:attempt<=SCORING_ATTEMPTS,provisional:'roomOvercome'});
   if(k+1<=3&&!round.attempts[k+1].current)round.attempts[k+1].current=1;
   if(k===1){
    round.checkpoint={enabled:true,room:1,clockMs:round.overcome[1].clockMs,tile:comp.reposition.checkpoint.pose,token:comp.reposition.checkpoint.token};
    log('checkpoint-enabled',{room:1});
   }
  }
  /* ── falta de progreso y reposición ── */
  function declareNoProgress(){
   if(!can('declareNoProgress'))return deny('Solo el recorrido puntuable en curso admite declarar falta de progreso.');
   const pose=adapter.pose(),room=ordinalOf(pose),att=round.attempts[room],failed=att.current;
   const target=repositionTarget(room);
   const fault={room,attempt:failed,scoringEligible:failed<=SCORING_ATTEMPTS,clockMs:Math.round(nowMs()-round.startClock),simTime:adapter.simTime(),previousPose:{...pose},allowed:target};
   round.faults.push(fault);att.current=failed+1;
   adapter.stopProgram();go('declareNoProgress');programStartedThisAttempt=false;lastPose=null;
   log('no-progress-declared',{room,attempt:failed,scoringEligible:failed<=SCORING_ATTEMPTS,previousPose:fault.previousPose,allowed:target,provisional:'extraAttempts'});
   return {ok:true,fault};
  }
  function repositionTarget(room){
   const r=comp.reposition;
   if(room===1)return {rule:'start-base',pose:r.start,basis:'V.G.4: falta en el primer cuarto → baldosa inicial (base inicial).'};
   if(room===2){
    if(round.checkpoint.enabled)return {rule:'checkpoint-tile',pose:r.checkpoint.pose,alternative:{rule:'previous-room-last-tile',pose:r.previousRoomLastTile2},basis:'V.F.5: la ficha naranja es el nuevo punto de inicio de esta ronda.',provisional:'repositionRoom2'};
    return {rule:'start-base',pose:r.start,basis:'Checkpoint no habilitado: no hay punto de inicio nuevo.'};
   }
   return {rule:'previous-room-last-tile',pose:r.previousRoomLastTile3,basis:'V.G.4 generalizado al 3.er cuarto.',provisional:'repositionRoom3'};
  }
  function reposition(){
   if(!can('reposition'))return deny('La reposición solo se autoriza tras declarar falta de progreso.');
   const fault=round.faults[round.faults.length-1],pose=fault.allowed.pose;
   const placed=adapter.placeRobot(pose);
   if(!placed.ok)return deny('Posición ocupada: '+placed.reason);
   go('reposition');lastPose=null;programStartedThisAttempt=false;
   round.repositions.push({clockMs:Math.round(nowMs()-round.startClock),simTime:adapter.simTime(),room:fault.room,pose:{...pose},rule:fault.allowed.rule});
   log('reposition',{room:fault.room,pose,rule:fault.allowed.rule});
   return {ok:true,pose};
  }
  /* ── programa del usuario ── */
  function mayStartProgram(src){
   if(state===S.FINISHED)return deny('La ronda terminó: el robot no puede ejecutar programas.');
   if(state===S.NO_PROGRESS)return deny('Falta de progreso declarada: pide la reposición del robot antes de reiniciar el programa.');
   if(state===S.RUNNING||state===S.REPOSITION){
    if(src!==frozenSource)return deny('Recorrido puntuable: no se puede modificar ni subir código.');
    if(state===S.RUNNING&&programStartedThisAttempt)return deny('El programa de este intento ya se inició: solo se reinicia tras una falta de progreso y reposición.');
   }
   denied='';return {ok:true};
  }
  function programStarted(){
   if(state===S.REPOSITION){go('programRestarted');programStartedThisAttempt=true;lastPose=null;log('attempt-restart',{attempts:{...Object.fromEntries(Object.entries(round.attempts).map(([k,v])=>[k,v.current]))}});return;}
   if(state===S.RUNNING){programStartedThisAttempt=true;log('program-started',{programHash:hashSource(adapter.source())});}
   else if(state===S.CALIBRATION)log('calibration-program-run');
  }
  function finishRound(by='captain'){
   if(!can('finishRound'))return deny('No hay una ronda en curso.');
   const wasRunning=state===S.RUNNING||state===S.NO_PROGRESS||state===S.REPOSITION;
   adapter.stopProgram();
   round.endClock=by==='time'?round.startClock+ROUND_MS:nowMs();round.finishedBy=by;
   log('round-finish',{by,elapsedMs:Math.min(ROUND_MS,Math.round(round.endClock-round.startClock)),ranCourse:wasRunning});
   Object.assign(round,capture());go('finishRound');rounds.push(round);
   return {ok:true,by};
  }
  /* Hechos físicos e interacciones OBSERVADOS (copias de solo lectura): los consume el evaluador (firvi-scoring.js). Un adaptador sin estos registros devuelve vacío. */
  function capture(){
   const opt=(fn,empty)=>typeof adapter[fn]==='function'?adapter[fn]():empty;
   return {physics:adapter.physicsLog(),interaction:opt('interactionLog',[]),trace:opt('traceLog',[]),obstacleState:opt('obstacles',null)};
  }
  /* Ronda en curso con los registros actuales (para el panel de evaluación en vivo); no modifica la ronda. */
  function liveRound(){return round?{...round,...capture()}:null;}
  function nextRound(){
   if(!can('nextRound'))return deny('La ronda aún no termina.');
   if(roundNumber>=ROUNDS)return deny('Las dos rondas ya se disputaron.');
   roundNumber++;go('nextRound');round=null;frozenSource=null;obstacleDecision='keep';lastPose=null;
   adapter.setObstaclesRemoved(false);adapter.hardReset();return {ok:true,round:roundNumber};
  }
  /* Comprueba el límite de 8 minutos con el RELOJ de competencia (la interfaz lo invoca con su temporizador; las pruebas, con reloj falso). */
  function poll(){if(ACTIVE.includes(state)&&nowMs()-round.startClock>=ROUND_MS)finishRound('time');return state;}

  return {
   transitions:TRANSITIONS,
   get state(){return state;},get roundNumber(){return roundNumber;},get round(){return round;},get rounds(){return rounds.slice();},get track(){return track;},
   get obstacleDecision(){return obstacleDecision;},get lastDenied(){return denied;},get complete(){return state===S.FINISHED&&roundNumber>=ROUNDS;},
   get frozenSource(){return frozenSource;},
   active:()=>ACTIVE.includes(state),
   // Permisos derivados del estado (la interfaz y el simulador SOLO consultan estas funciones).
   editLocked:()=>state===S.RUNNING||state===S.NO_PROGRESS||state===S.REPOSITION,
   calibrationAllowed:()=>!(state===S.RUNNING||state===S.NO_PROGRESS||state===S.REPOSITION),
   timeLocked:()=>ACTIVE.includes(state),                          // sin pausa, sin paso a paso, velocidad 1×
   worldLocked:()=>state===S.RUNNING||state===S.NO_PROGRESS||state===S.REPOSITION,   // sin reinicio ni movimiento manual del robot
   trackChangeLocked:()=>ACTIVE.includes(state),
   elapsedMs:elapsed,remainingMs:()=>round?Math.max(0,ROUND_MS-elapsed()):ROUND_MS,
   attemptsView:()=>round?Object.fromEntries(Object.entries(round.attempts).map(([k,v])=>[k,{current:v.current,scoringEligible:v.current>0&&v.current<=SCORING_ATTEMPTS}])):null,
   currentRoom:()=>ordinalOf(adapter.pose()),
   liveRound,setObstacleDecision,startRound,beginRun,declareNoProgress,reposition,finishRound,nextRound,poll,observe,mayStartProgram,programStarted
  };
 }

 /* Fachada global: la usan simulator.js e iroh-runtime.js (ganchos) y la interfaz. Sin modo competencia activo, todos los ganchos son neutros. */
 const sessions=new Map();let on=false,clock={now:()=>performance.now()};
 const world=()=>window.BITIRO_WORLD&&window.BITIRO_WORLD.track&&window.BITIRO_WORLD.track();
 const eligible=t=>!!(t&&t.competition==='firvi-2025'&&t.competitionSpec);
 const current=()=>{const t=world();if(!on||!eligible(t))return null;
  if(!sessions.has(t.id))sessions.set(t.id,createSession({track:{...t,competition:t.competitionSpec},adapter:window.BITIRO_SIM_ADAPTER,clock}));
  return sessions.get(t.id);};
 const facade={
  S,ROUND_MS,ROUNDS,SCORING_ATTEMPTS,TRANSITIONS,PROVISIONAL,hashSource,createSession,
  setClock(c){clock=c;sessions.clear();},
  get on(){return on;},
  enter(){const t=world();if(!eligible(t))return {ok:false,reason:'Esta pista no tiene modo competencia.'};on=true;current();return {ok:true};},
  leave(){const s=current();if(s&&s.active())return {ok:false,reason:'Hay una ronda en curso.'};on=false;return {ok:true};},
  session:()=>current(),
  sessions:()=>new Map(sessions),
  // ── ganchos del simulador ──
  active:()=>!!(current()&&current().active()),
  timeLocked:()=>!!(current()&&current().timeLocked()),
  softReset:()=>!!(current()&&current().worldLocked()),
  manualLocked:()=>!!(current()&&current().worldLocked()),
  canCalibrate:()=>!(current()&&!current().calibrationAllowed()),
  blocksTrackChange:()=>!!(current()&&current().trackChangeLocked()),
  observe(pose){const s=current();if(s)s.observe(pose);},
  poll(){const s=current();return s?s.poll():null;},
  mayStartProgram(src){const s=current();return s?s.mayStartProgram(src):{ok:true};},
  programStarted(){const s=current();if(s)s.programStarted();},
  get denial(){const s=current();return s?s.lastDenied:'';}
 };
 return Object.freeze(facade);
})();
window.BITIRO_COMPETITION=window.BITIRO_FIRVI_COMPETITION;
