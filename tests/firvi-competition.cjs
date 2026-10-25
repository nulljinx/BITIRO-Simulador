/* FIRVI-2025-B · Motor de competencia: máquina de estados, reloj, calibración, falta de progreso, checkpoint, intentos, obstáculos, independencia A/B.
   node tests/firvi-competition.cjs
   Dos niveles: (1) el motor con un ADAPTADOR FALSO (rápido, determinista, control total de la pose); (2) el simulador real (harness) con reloj falso.
   No hay puntuación: se comprueban hechos registrados, no puntos. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {load,root}=require('./sim1/harness.cjs');

let n=0;
const test=(name,fn)=>{fn();n++;console.log('OK · '+name);};
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const near=(a,b,e,m)=>assert.ok(Math.abs(a-b)<=e,`${m||''} ${a} ≠ ${b}`);
const EXTRA=['line-geometry.js','firvi-2025.js','firvi-competition.js'];
const MIN=60000;

// ── nivel 1: motor puro ────────────────────────────────────────────────────────────────────
const pure=(()=>{const c={window:null,performance:{now:()=>0}};c.window=c;vm.createContext(c);
 for(const f of ['tracks.js','extra-tracks.js',...EXTRA])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});return c.window;})();
const C=pure.BITIRO_FIRVI_COMPETITION,S=C.S;
const trackOf=id=>{const t=pure.BITIRO_TRACKS[id];return {...t,competition:t.competitionSpec};};
const fakeClock=()=>{const c={t:1000,now:()=>c.t,advance:ms=>{c.t+=ms;}};return c;};
function fakeAdapter(startPose){
 const a={p:{...startPose},t:0,src:'// programa',removed:null,resets:0,stopped:0,placed:[],log:[],occupied:false,
  pose:()=>({...a.p}),simTime:()=>a.t,source:()=>a.src,physicsLog:()=>a.log.slice(),
  hardReset(){a.resets++;a.p={...startPose};a.log=[];},setObstaclesRemoved(f){a.removed=f;},stopProgram(){a.stopped++;},
  placeRobot(p){if(a.occupied)return {ok:false,reason:'ocupado'};a.p={x:p.x,y:p.y,heading:p.heading};a.placed.push({...p});return {ok:true};}};
 return a;
}
const mk=(route='firvi-2025')=>{const tr=trackOf(route),ad=fakeAdapter(tr.competition.reposition.start),clock=fakeClock();
 return {tr,ad,clock,s:C.createSession({track:tr,adapter:ad,clock})};};
// Avance físico continuo (pasos de 0,4 cm) a lo largo de y = const.
const walk=(ctx,x0,x1,y=30)=>{const step=x1>=x0?.4:-.4;for(let x=x0;step>0?x<=x1:x>=x1;x+=step){ctx.ad.p={x,y,heading:step>0?0:Math.PI};ctx.s.observe(ctx.ad.p);}};
const toRun2=c=>{c.clock.advance(MIN);c.s.beginRun();};
const toRun=ctx=>{assert.ok(ctx.s.startRound().ok);ctx.clock.advance(2*MIN);assert.ok(ctx.s.beginRun().ok);};

test('estados: la ronda recorre preparación → calibración → recorrido → falta → reposición → recorrido → finalizada',()=>{
 const c=mk();assert.equal(c.s.state,S.PREPARATION);
 assert.ok(c.s.startRound().ok);assert.equal(c.s.state,S.CALIBRATION);
 assert.ok(c.s.beginRun().ok);assert.equal(c.s.state,S.RUNNING);
 assert.ok(c.s.declareNoProgress().ok);assert.equal(c.s.state,S.NO_PROGRESS);
 assert.ok(c.s.reposition().ok);assert.equal(c.s.state,S.REPOSITION);
 c.s.programStarted();assert.equal(c.s.state,S.RUNNING);
 assert.ok(c.s.finishRound('captain').ok);assert.equal(c.s.state,S.FINISHED);
 assert.ok(c.s.nextRound().ok);assert.equal(c.s.state,S.PREPARATION);assert.equal(c.s.roundNumber,2);
});
test('estados: toda orden fuera de su tabla de transiciones se rechaza y no cambia nada',()=>{
 const cmds={startRound:s=>s.startRound(),beginRun:s=>s.beginRun(),declareNoProgress:s=>s.declareNoProgress(),reposition:s=>s.reposition(),finishRound:s=>s.finishRound('captain'),nextRound:s=>s.nextRound()};
 // llevar una sesión a cada estado y probar todas las órdenes
 const reach={
  [S.PREPARATION]:c=>{},
  [S.CALIBRATION]:c=>c.s.startRound(),
  [S.RUNNING]:c=>{c.s.startRound();c.s.beginRun();},
  [S.NO_PROGRESS]:c=>{c.s.startRound();c.s.beginRun();c.s.declareNoProgress();},
  [S.REPOSITION]:c=>{c.s.startRound();c.s.beginRun();c.s.declareNoProgress();c.s.reposition();},
  [S.FINISHED]:c=>{c.s.startRound();c.s.finishRound('captain');}
 };
 let denied=0;
 for(const [state,prep] of Object.entries(reach))for(const [cmd,run] of Object.entries(cmds)){
  const c=mk();prep(c);assert.equal(c.s.state,state);
  const before=JSON.stringify([c.s.state,c.s.roundNumber,c.ad.resets,c.ad.stopped,c.s.round&&c.s.round.events.length]);
  const r=run(c.s),allowed=C.TRANSITIONS[cmd].from.includes(state);
  assert.equal(r.ok,allowed,`${cmd} desde ${state}`);
  if(!allowed){denied++;assert.equal(JSON.stringify([c.s.state,c.s.roundNumber,c.ad.resets,c.ad.stopped,c.s.round&&c.s.round.events.length]),before,`${cmd} desde ${state} no debe cambiar nada`);assert.ok(r.reason.length>5);}
 }
 assert.ok(denied>20);
});
test('reloj: ocho minutos que incluyen la calibración; beginRun NO reinicia el reloj',()=>{
 const c=mk();c.s.startRound();const t0=c.clock.t;
 c.clock.advance(3*MIN);assert.equal(c.s.elapsedMs(),3*MIN);
 c.s.beginRun();assert.equal(c.s.round.calibrationMs,3*MIN);assert.equal(c.s.round.startClock,t0,'el inicio de ronda no se mueve');
 assert.equal(c.s.elapsedMs(),3*MIN,'el reloj sigue donde iba');assert.equal(c.s.remainingMs(),5*MIN);
 c.clock.advance(4*MIN+59000);c.s.poll();assert.equal(c.s.state,S.RUNNING,'a 7:59 aún corre');
 c.clock.advance(1000);assert.equal(c.s.poll(),S.FINISHED);
 assert.equal(c.s.round.finishedBy,'time');assert.equal(c.s.round.endClock-t0,8*MIN);assert.equal(c.s.remainingMs(),0);
 assert.equal(c.s.round.events.at(-1).type,'round-finish');assert.equal(c.s.round.events.at(-1).elapsedMs,8*MIN);
});
test('reloj: se agota también durante la calibración, la falta de progreso y la reposición',()=>{
 for(const prep of [c=>{},c=>{c.s.beginRun();c.s.declareNoProgress();},c=>{c.s.beginRun();c.s.declareNoProgress();c.s.reposition();}]){
  const c=mk();c.s.startRound();prep(c);c.clock.advance(8*MIN+5);assert.equal(c.s.poll(),S.FINISHED);assert.equal(c.s.round.finishedBy,'time');assert.equal(c.s.round.endClock-c.s.round.startClock,8*MIN,'el tiempo registrado se limita a 8:00');
 }
});
test('reloj: es independiente del tiempo simulado (el simulador puede ir más rápido, lento o detenido)',()=>{
 const c=mk();c.s.startRound();c.ad.t=1e6;c.clock.advance(1000);assert.equal(c.s.elapsedMs(),1000,'el tiempo simulado no mueve el reloj');
 c.ad.t=0;c.clock.advance(1000);assert.equal(c.s.elapsedMs(),2000,'un tiempo simulado detenido no lo frena');
});
test('permisos por estado: edición, calibración, tiempo y mundo bloqueados exactamente donde corresponde',()=>{
 const expect={ // [editLocked, calibrationAllowed, timeLocked, worldLocked, trackChangeLocked]
  [S.PREPARATION]:[false,true,false,false,false],[S.CALIBRATION]:[false,true,true,false,true],[S.RUNNING]:[true,false,true,true,true],
  [S.NO_PROGRESS]:[true,false,true,true,true],[S.REPOSITION]:[true,false,true,true,true],[S.FINISHED]:[false,true,false,false,false]};
 const reach={[S.PREPARATION]:c=>{},[S.CALIBRATION]:c=>c.s.startRound(),[S.RUNNING]:c=>{c.s.startRound();c.s.beginRun();},[S.NO_PROGRESS]:c=>{c.s.startRound();c.s.beginRun();c.s.declareNoProgress();},
  [S.REPOSITION]:c=>{c.s.startRound();c.s.beginRun();c.s.declareNoProgress();c.s.reposition();},[S.FINISHED]:c=>{c.s.startRound();c.s.finishRound('captain');}};
 for(const [state,prep] of Object.entries(reach)){const c=mk();prep(c);const s=c.s;
  same([s.editLocked(),s.calibrationAllowed(),s.timeLocked(),s.worldLocked(),s.trackChangeLocked()],expect[state],state);}
});
test('programa: se congela al comenzar el recorrido; solo se reinicia el mismo código tras una reposición',()=>{
 const c=mk();c.s.startRound();c.ad.src='// v1';assert.ok(c.s.mayStartProgram('// v2').ok,'en calibración se puede cambiar el programa');
 c.ad.src='// v3';c.s.beginRun();assert.equal(c.s.frozenSource,'// v3');
 let r=c.s.mayStartProgram('// otro');assert.ok(!r.ok);assert.match(r.reason,/modificar ni subir código/);
 assert.ok(c.s.mayStartProgram('// v3').ok);c.s.programStarted();
 r=c.s.mayStartProgram('// v3');assert.ok(!r.ok,'no se reinicia sin falta de progreso');
 c.s.declareNoProgress();assert.ok(!c.s.mayStartProgram('// v3').ok,'tras declarar la falta, primero la reposición');
 c.s.reposition();assert.ok(c.s.mayStartProgram('// v3').ok);assert.ok(!c.s.mayStartProgram('// v4').ok,'tras reponer tampoco se puede cambiar el código');
 assert.equal(c.s.round.events.find(e=>e.type==='run-begin').programHash,C.hashSource('// v3'),'se registra el programa con que se inició');
});
test('inicio: se registra la decisión de iniciar y el robot queda en la base con el campo restaurado',()=>{
 const c=mk();c.s.startRound();c.ad.p={x:200,y:60,heading:1};c.ad.log=[{kind:'push'}];const resets=c.ad.resets;
 c.clock.advance(90000);c.s.beginRun();
 assert.equal(c.ad.resets,resets+1);same(c.ad.p,c.tr.competition.reposition.start);assert.equal(c.ad.log.length,0,'el registro físico puntuable parte vacío');
 same(c.s.round.physicsDuringCalibration,[{kind:'push'}],'lo ocurrido en calibración se conserva aparte');
 const e=c.s.round.events.find(x=>x.type==='run-begin');assert.equal(e.clockMs,90000);assert.equal(e.provisional,'fieldRestoredAtRun');same(e.startPose,c.tr.competition.reposition.start);
});

// ── falta de progreso, reposición, intentos ─────────────────────────────────────────────────
test('falta de progreso: registra cuarto, intento, tiempo, posición previa y ubicación permitida; no hay sanciones automáticas',()=>{
 const c=mk();toRun(c);c.clock.advance(30000);c.ad.t=12.5;c.ad.p={x:90,y:60,heading:2};
 const r=c.s.declareNoProgress();assert.ok(r.ok);const f=r.fault;
 assert.equal(f.room,1);assert.equal(f.attempt,1);assert.equal(f.scoringEligible,true);assert.equal(f.clockMs,2*MIN+30000);assert.equal(f.simTime,12.5);
 same(f.previousPose,{x:90,y:60,heading:2});assert.equal(f.allowed.rule,'start-base');same(f.allowed.pose,c.tr.competition.reposition.start);assert.match(f.allowed.basis,/V\.G\.4/);
 assert.equal(c.ad.stopped,1,'el programa se detiene');same(c.ad.p,{x:90,y:60,heading:2},'declarar no mueve al robot');
 assert.equal(c.s.attemptsView()[1].current,2);assert.equal(c.s.round.faults.length,1);
});
test('falta de progreso: solo en el recorrido puntuable; nunca la declara el motor por sí solo',()=>{
 const c=mk();assert.ok(!c.s.declareNoProgress().ok);c.s.startRound();assert.ok(!c.s.declareNoProgress().ok,'ni en calibración');
 c.s.beginRun();c.clock.advance(7*MIN);c.ad.t=1e5;for(let i=0;i<500;i++)c.s.observe(c.ad.p);   // robot inmóvil 7 minutos (p. ej. esperando en un gap)
 assert.equal(c.s.state,S.RUNNING);assert.equal(c.s.round.faults.length,0,'ni un robot parado ni un gap generan falta automática');
});
test('reposición: solo tras declarar; coloca al robot en la ubicación permitida; no se puede elegir otra ni repetir',()=>{
 const c=mk();toRun(c);c.ad.p={x:50,y:100,heading:0};
 assert.ok(!c.s.reposition().ok,'sin falta declarada no hay reposición');
 c.s.declareNoProgress();assert.ok(c.s.reposition().ok);same(c.ad.p,c.tr.competition.reposition.start);assert.equal(c.ad.placed.length,1);
 assert.ok(!c.s.reposition().ok,'una reposición por falta');assert.equal(c.ad.placed.length,1);
 const c2=mk();toRun(c2);c2.s.declareNoProgress();c2.ad.occupied=true;const r=c2.s.reposition();assert.ok(!r.ok);assert.match(r.reason,/ocupada/);assert.equal(c2.s.state,S.NO_PROGRESS,'si no se puede colocar, sigue pendiente');
});
test('tres intentos puntuables por cuarto: del 4.º en adelante se registran sin elegibilidad; los cuartos llevan intentos independientes',()=>{
 const c=mk();toRun(c);const elig=[];
 for(let i=0;i<5;i++){const r=c.s.declareNoProgress();elig.push([r.fault.attempt,r.fault.scoringEligible]);c.s.reposition();c.s.programStarted();}
 same(elig,[[1,true],[2,true],[3,true],[4,false],[5,false]]);
 assert.equal(c.s.attemptsView()[1].current,6);assert.equal(c.s.attemptsView()[1].scoringEligible,false);
 assert.equal(c.s.attemptsView()[2].current,0,'el 2.º cuarto no ha empezado: sus intentos no se tocan');
 assert.ok(c.s.round.faults.every(f=>!('points' in f)&&!('score' in f)),'sin puntos en la Etapa B');
});

// ── cuartos superados y checkpoint ──────────────────────────────────────────────────────────
test('cuarto superado: cruce físico CONTINUO del plano de entrada del siguiente cuarto, solo en recorrido puntuable',()=>{
 const c=mk();c.s.startRound();c.ad.p={x:120,y:30,heading:0};walk(c,120,150);assert.equal(Object.keys(c.s.round.overcome).length,0,'en calibración no cuenta');
 c.s.beginRun();walk(c,100,134.5);assert.equal(c.s.round.overcome[1],undefined,'antes del plano no hay cuarto superado');
 c.ad.p={x:135.2,y:30,heading:0};c.s.observe(c.ad.p);
 const o=c.s.round.overcome[1];assert.ok(o);assert.equal(o.attempt,1);assert.equal(o.scoringEligible,true);
 assert.equal(c.s.round.events.filter(e=>e.type==='room-overcome').length,1,'se registra una sola vez');
});
test('checkpoint: se habilita únicamente al superar físicamente el 1.er cuarto; la ficha naranja no es un sensor',()=>{
 const c=mk();toRun(c);
 // «Tocar» la ficha con un salto de pose (sin recorrer el cuarto) no habilita nada
 c.ad.p={x:100,y:30,heading:0};c.s.observe(c.ad.p);c.ad.p={...c.tr.competition.reposition.checkpoint.token,heading:0};c.s.observe(c.ad.p);
 assert.equal(c.s.round.checkpoint.enabled,false);assert.equal(Object.keys(c.s.round.overcome).length,0,'un salto no es avance físico');
 // Rodear la ficha sin cruzar el plano tampoco: en el cuarto 1, hasta x=134
 walk(c,100,134);assert.equal(c.s.round.checkpoint.enabled,false);
 walk(c,134,136);assert.equal(c.s.round.checkpoint.enabled,true);assert.equal(c.s.round.checkpoint.room,1);
 const ev=c.s.round.events.map(e=>e.type);assert.ok(ev.indexOf('room-overcome')<ev.indexOf('checkpoint-enabled'));
 assert.equal(c.s.round.attempts[2].current,1,'comienza el 1.er intento del 2.º cuarto');
});
test('checkpoint: no se supera el 2.º cuarto sin haber superado el 1.º; el cruce hacia atrás no cuenta',()=>{
 const c=mk();toRun(c);c.ad.p={x:250,y:30,heading:0};c.s.observe(c.ad.p);walk(c,250,262);
 assert.equal(c.s.round.overcome[2],undefined,'el 2.º cuarto exige el 1.º');
 const b=mk('firvi-2025-b');toRun(b);b.ad.p={x:100,y:30,heading:0};walk(b,100,230,30);          // B yendo en sentido de A: no es progreso de B
 assert.equal(Object.keys(b.s.round.overcome).length,0);
});
test('reposición con checkpoint: falta en el 2.º cuarto → baldosa de la ficha naranja; sin él, base inicial; 3.er cuarto → última baldosa del 2.º',()=>{
 const c=mk();toRun(c);walk(c,100,140);assert.ok(c.s.round.checkpoint.enabled);c.ad.p={x:200,y:90,heading:1};
 const f=c.s.declareNoProgress().fault;assert.equal(f.room,2);assert.equal(f.allowed.rule,'checkpoint-tile');same(f.allowed.pose,c.tr.competition.reposition.checkpoint.pose);
 assert.equal(f.allowed.alternative.rule,'previous-room-last-tile');assert.equal(f.allowed.provisional,'repositionRoom2');
 c.s.reposition();same(c.ad.p,c.tr.competition.reposition.checkpoint.pose);c.s.programStarted();
 c.ad.p={x:260,y:30,heading:0};const f3=c.s.declareNoProgress().fault;assert.equal(f3.room,3);assert.equal(f3.allowed.rule,'previous-room-last-tile');same(f3.allowed.pose,c.tr.competition.reposition.previousRoomLastTile3);
 // Fallas del 1.er cuarto siguen yendo a la base aunque ya haya checkpoint: si el robot retrocede al cuarto 1
 c.s.reposition();c.s.programStarted();c.ad.p={x:50,y:60,heading:0};const f1=c.s.declareNoProgress().fault;assert.equal(f1.room,1);assert.equal(f1.allowed.rule,'start-base');
});
test('recorrido B: mismos mecanismos en sentido inverso (planos 225 y 105; ordinal por sentido de avance)',()=>{
 const c=mk('firvi-2025-b');toRun(c);c.ad.p={x:340,y:30,heading:Math.PI};walk(c,340,224,30);
 assert.ok(c.s.round.overcome[1]&&c.s.round.checkpoint.enabled);
 const f=(c.ad.p={x:180,y:60,heading:Math.PI},c.s.declareNoProgress().fault);assert.equal(f.room,2);same(f.allowed.pose,c.tr.competition.reposition.checkpoint.pose);
 assert.ok(f.allowed.pose.x>195&&f.allowed.pose.x<225,'la baldosa de B está en el lado derecho del cuarto 2');
});
test('final del recorrido: se registra el alcance de la base opuesta, sin puntuar',()=>{
 const c=mk();toRun(c);walk(c,100,140);c.ad.p={x:250,y:120,heading:0};c.s.observe(c.ad.p);walk(c,250,262,120);assert.ok(c.s.round.overcome[2]);
 walk(c,300,330,30);assert.ok(c.s.round.endReached,'llegó a la base opuesta');assert.ok(!('points' in c.s.round.endReached));
});

// ── rondas ──────────────────────────────────────────────────────────────────────────────────
test('dos rondas independientes: la 2.ª parte de cero y la 1.ª conserva su registro intacto',()=>{
 const c=mk();toRun(c);walk(c,100,140);c.s.declareNoProgress();c.s.reposition();c.s.programStarted();c.s.finishRound('captain');
 const r1=c.s.rounds[0],snapshot=JSON.stringify(r1);
 assert.ok(r1.checkpoint.enabled);assert.equal(r1.faults.length,1);assert.equal(r1.finishedBy,'captain');
 c.s.nextRound();assert.equal(c.s.roundNumber,2);assert.equal(c.s.round,null);
 c.clock.advance(5*MIN);c.s.startRound();const r2=c.s.round;
 assert.equal(r2.number,2);assert.equal(r2.checkpoint.enabled,false,'los checkpoints se reinician cada ronda (V.F.6)');assert.equal(r2.faults.length,0);same(r2.overcome,{});
 assert.equal(r2.attempts[1].current,1);assert.equal(r2.attempts[2].current,0);assert.equal(r2.startClock,c.clock.t,'reloj propio: parte de cero');assert.equal(c.s.elapsedMs(),0);
 assert.equal(JSON.stringify(c.s.rounds[0]),snapshot,'la ronda 1 no cambió');
 toRun2(c);c.s.finishRound('captain');assert.ok(c.s.complete);
 assert.ok(!c.s.nextRound().ok,'solo hay dos rondas');
});
test('registro de ronda: solo hechos y tiempos (sin puntaje) y con el tiempo de competencia, no el simulado',()=>{
 const c=mk();toRun(c);c.ad.t=77;c.clock.advance(10*1000);c.s.finishRound('captain');
 const r=c.s.rounds[0];assert.equal(r.finishedBy,'captain');assert.equal(r.endClock-r.startClock,2*MIN+10000);
 const json=JSON.stringify(r);assert.ok(!/"(points|score|puntaje|puntos)"/.test(json));
 assert.ok(r.events.every((e,i,a)=>i===0||e.clockMs>=a[i-1].clockMs),'eventos en orden de reloj');
});

// ── obstáculos ──────────────────────────────────────────────────────────────────────────────
test('obstáculos: se decide antes de iniciar; no se puede cambiar durante la ronda; cada ronda decide de nuevo',()=>{
 const c=mk();assert.ok(c.s.setObstacleDecision('remove').ok);assert.equal(c.ad.removed,true);
 assert.ok(c.s.setObstacleDecision('keep').ok);assert.equal(c.ad.removed,false);assert.ok(!c.s.setObstacleDecision('otro').ok);
 c.s.setObstacleDecision('remove');c.s.startRound();assert.equal(c.s.round.obstacles,'remove');assert.equal(c.ad.removed,true);
 for(const step of [()=>{},()=>c.s.beginRun(),()=>c.s.declareNoProgress(),()=>c.s.reposition()]){step();const r=c.s.setObstacleDecision('keep');assert.ok(!r.ok);assert.equal(c.ad.removed,true,'la decisión no cambia a mitad de ronda');}
 assert.equal(c.s.round.events.find(e=>e.type==='round-start').obstacles,'remove');
 c.s.finishRound('captain');assert.ok(!c.s.setObstacleDecision('keep').ok,'tampoco con la ronda terminada');
 c.s.nextRound();assert.equal(c.s.obstacleDecision,'keep','la ronda 2 vuelve a decidirse (por defecto, mantener)');assert.equal(c.ad.removed,false);
});

// ── independencia A / B ─────────────────────────────────────────────────────────────────────
test('A y B son sesiones independientes: reloj, ronda, intentos, checkpoint y obstáculos propios',()=>{
 const a=mk('firvi-2025'),b=mk('firvi-2025-b');
 toRun(a);walk(a,100,140);a.s.declareNoProgress();
 assert.equal(b.s.state,S.PREPARATION);assert.equal(b.s.round,null);
 b.s.setObstacleDecision('remove');assert.equal(a.ad.removed,false,'la decisión de B no toca a A (sigue «mantener»)');
 b.clock.advance(MIN);b.s.startRound();b.clock.advance(10*1000);
 assert.equal(a.s.elapsedMs(),2*MIN);assert.equal(b.s.elapsedMs(),10000,'relojes distintos');
 assert.equal(a.s.state,S.NO_PROGRESS);assert.equal(b.s.state,S.CALIBRATION);
 assert.ok(a.s.round.checkpoint.enabled);assert.equal(b.s.round.checkpoint.enabled,false);
 assert.equal(a.s.round.faults.length,1);assert.equal(b.s.round.faults.length,0);
 assert.equal(a.s.round.obstacles,'keep');assert.equal(b.s.round.obstacles,'remove');
 a.s.finishRound('captain');assert.equal(b.s.state,S.CALIBRATION,'terminar A no afecta a B');
 a.s.nextRound();assert.equal(a.s.roundNumber,2);assert.equal(b.s.roundNumber,1);
});

// ── nivel 2: simulador real ─────────────────────────────────────────────────────────────────
const real=(route='firvi-2025',opts={})=>{
 const h=load({extraFiles:EXTRA,...opts});const clock=fakeClock();h.js('BITIRO_COMPETITION').setClock;
 h.ctx.BITIRO_COMPETITION.setClock(clock);h.js(`changeTrack('${route}')`);
 assert.ok(h.ctx.BITIRO_COMPETITION.enter().ok);
 const ses=()=>h.ctx.BITIRO_COMPETITION.session();
 const run=(secs)=>{for(let t=0;t<Math.round(secs*120);t++){h.js('update(1/120)');clock.advance(1000/120);}};
 return {h,clock,ses,run};
};
const FOLLOW=`void setup(){inicializarMovimiento();inicializarSensores();}
int ult=0;int lost=0;
void loop(){bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;
const SWEEP=`void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(1200);}
int ult=0;int lost=0;int done=0;
void loop(){
 if(done==0 && leerDistanciaSonar()<=14){detenerse();pausa(300);moverServoGolpe(1);pausa(1500);moverServoGolpe(0);pausa(1200);done=1;}
 bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;

test('modo práctica intacto: sin competencia los ganchos son neutros (pausa, velocidad, reinicio, calibración, cambio de pista)',()=>{
 const h=load({extraFiles:EXTRA});h.js("changeTrack('s01')");
 assert.equal(h.ctx.BITIRO_COMPETITION.on,false);
 h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(20);}');h.tick(60);
 h.el('pause').events.click();assert.equal(h.js('paused'),true,'la pausa funciona');h.el('step').events.click();h.el('pause').events.click();assert.equal(h.js('paused'),false);
 h.js('R.x=70');h.js('window.resetRobot()');assert.equal(h.js('R.x'),h.js('track.start.x'),'Reiniciar vuelve a la base');
 h.js("changeTrack('s02')");assert.equal(h.js('chosen'),'s02','cambiar de pista funciona');
 assert.equal(h.js('BITIRO_COMPETITION.mayStartProgram("x").ok'),true);
});
test('velocidad, pausa y paso a paso no prolongan la ronda: bloqueados mientras hay ronda activa',()=>{
 const {h,ses}=real();ses().startRound();
 h.el('speed').value='4';h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(10);}');
 h.js('last=0;acc=0');h.js('frame(1000)');const t4=h.js('simTime');
 near(t4,0.1,.02,'con la ronda activa la velocidad se fuerza a 1× (0,1 s de simulación en un cuadro de 0,1 s)');
 h.el('pause').events.click();assert.equal(h.js('paused'),false,'la pausa no actúa');
 h.js('paused=true');const t0=h.js('simTime');h.el('step').events.click();assert.equal(h.js('simTime'),t0,'el paso a paso no actúa');
 // fuera de competencia la misma velocidad sí multiplica (práctica intacta)
 const p=load({extraFiles:EXTRA});p.js("changeTrack('firvi-2025')");p.el('speed').value='4';p.program('void setup(){inicializarMovimiento();} void loop(){avanzar(10);}');p.js('last=0;acc=0');p.js('frame(1000)');
 near(p.js('simTime'),0.4,.02,'práctica: 4× como siempre');
});
test('recorrido puntuable: edición, calibración, reinicio manual y cambio de pista bloqueados; el robot no se teletransporta al ejecutar',()=>{
 const {h,ses,clock}=real();const s=ses();s.startRound();h.el('src').value=FOLLOW;clock.advance(MIN);
 assert.ok(h.ctx.BITIRO_COMPETITION.canCalibrate(),'en calibración se puede calibrar');
 s.beginRun();assert.equal(h.ctx.BITIRO_COMPETITION.canCalibrate(),false);
 h.el('calibrate').events.click();assert.ok(!h.el('calibrationDialog').open,'no se abre el diálogo de calibración');
 h.el('src').value='// otro programa';h.js('start()');assert.equal(h.js('mode'),'idle');assert.match(h.el('msg').innerHTML,/modificar ni subir código/);
 h.el('src').value=FOLLOW;h.js('start()');assert.equal(h.js('mode'),'code','el programa congelado sí puede iniciarse');
 const before=h.js('[R.x,R.y,R.th]');h.js('window.BITIRO_MANUAL.calibration=true');assert.equal(h.js('BITIRO_MANUAL.place(150,60,0)'),false,'sin movimiento manual del robot');
 same(h.js('[R.x,R.y,R.th]'),before);
 h.js("changeTrack('firvi-2025-b')");assert.equal(h.js('chosen'),'firvi-2025','no se cambia de pista a mitad de ronda');
 h.run=undefined;
 // Ejecutar de nuevo (reinicio suave) no mueve al robot ni restaura obstáculos ni borra el registro
 h.js('R.x=60;R.y=118;activeObstacles[0].x+=2;');const obs=h.js('activeObstacles[0].x');
 h.el('src').value=FOLLOW;h.js('window.resetRobot()');assert.equal(h.js('R.x'),60);assert.equal(h.js('activeObstacles[0].x'),obs);
});
test('sensor de tacto: evento físico independiente y observable; el programa espera botonInicio() hasta que se activa',()=>{
 const {h,ses,run}=real();const s=ses();s.startRound();
 h.el('src').value='void setup(){inicializarMovimiento();inicializarSensores();botonInicio();} void loop(){avanzar(20);}';s.beginRun();h.js('start()');
 const x0=h.js('R.x');run(2);near(h.js('R.x'),x0,1e-9,'el robot espera el pulsador');
 assert.ok(!h.js('BITIRO_PHYSICS_LOG().some(e=>e.kind==="touch")'));
 h.js('pressTouchSensor(1)');run(2);assert.ok(h.js('R.x')>x0+3,'arranca tras el tacto');
 const log=h.js('BITIRO_PHYSICS_LOG()'),touch=log.filter(e=>e.kind==='touch');assert.equal(touch.length,1);assert.equal(touch[0].detail,'press');assert.ok(touch[0].t>=1.95,'registrado en su instante, no en el del inicio');
 h.js('pressTouchSensor(1)');assert.equal(h.js('BITIRO_PHYSICS_LOG().filter(e=>e.kind==="touch").length'),1,'sin cambio no hay evento nuevo');
 h.js('pressTouchSensor(0)');assert.equal(h.js('BITIRO_PHYSICS_LOG().filter(e=>e.kind==="touch").length'),2);
});
test('obstáculos retirados antes de la ronda: el mundo no los tiene y no hay eventos físicos sobre ellos',()=>{
 const {h,ses}=real();const s=ses();assert.equal(h.js('activeObstacles.length'),2);
 s.setObstacleDecision('remove');assert.equal(h.js('activeObstacles.length'),0);
 s.startRound();assert.equal(h.js('activeObstacles.length'),0);assert.equal(h.js('readSonarDistance()'),200);
 s.beginRun();assert.equal(h.js('activeObstacles.length'),0,'beginRun no los repone');
 s.finishRound('captain');s.nextRound();assert.equal(h.js('activeObstacles.length'),2,'la ronda 2 vuelve a decidir: por defecto se mantienen');
});
test('REPOSICIÓN real: el robot no se mueve al declarar, solo al reponer; no se teletransporta nunca durante la marcha normal',()=>{
 const {h,ses,clock,run}=real();const s=ses();s.startRound();clock.advance(MIN);h.el('src').value=FOLLOW;s.beginRun();
 h.js('start()');run(20);
 const moved=h.js('[R.x,R.y]');assert.ok(Math.hypot(moved[0]-21,moved[1]-120)>20);
 assert.ok(s.declareNoProgress().ok);assert.equal(h.js('mode'),'idle');same(h.js('[R.x,R.y]'),moved,'declarar no mueve al robot');run(3);same(h.js('[R.x,R.y]'),moved,'detenido tras declarar');
 assert.ok(s.reposition().ok);near(h.js('R.x'),21,1e-9);near(h.js('R.y'),120,1e-9);near(h.js('R.th'),Math.PI/2,1e-9,'rumbo de la base');
 h.js('start()');assert.equal(s.state,S.RUNNING);assert.equal(s.attemptsView()[1].current,2);
 // trayectoria continua: la pose entre pasos consecutivos nunca salta fuera de la marcha normal
 let prev=h.js('[R.x,R.y]'),maxJump=0;for(let t=0;t<120*10;t++){h.js('update(1/120)');const p=h.js('[R.x,R.y]');maxJump=Math.max(maxJump,Math.hypot(p[0]-prev[0],p[1]-prev[1]));prev=p;}
 assert.ok(maxJump<.5,`sin saltos de pose en la marcha normal (máx ${maxJump.toFixed(3)} cm/paso)`);
});
test('reposición con obstáculo encima: el motor no la fuerza ni mueve el obstáculo',()=>{
 const {h,ses,clock}=real();const s=ses();s.startRound();clock.advance(MIN);s.beginRun();s.declareNoProgress();
 h.js('activeObstacles[0].poly=activeObstacles[0].poly.map(q=>[q[0]-activeObstacles[0].x+16,q[1]-activeObstacles[0].y+112]);activeObstacles[0].x=16;activeObstacles[0].y=112');
 const r=s.reposition();assert.ok(!r.ok);assert.equal(s.state,S.NO_PROGRESS);assert.equal(h.js('activeObstacles[0].x'),16);
});

// ── ejemplo reproducible de una ronda completa ─────────────────────────────────────────────
const playRound=()=>{
 const {h,ses,clock,run}=real();const s=ses(),t0=clock.t;
 const log=[];const note=(m)=>log.push(`${((clock.t-t0)/1000).toFixed(1).padStart(6)} s · ${s.state.padEnd(20)} · ${m}`);
 note('preparación: se mantienen los obstáculos');assert.ok(s.setObstacleDecision('keep').ok);
 s.startRound();note('ronda iniciada (obstáculos: '+s.round.obstacles+')');
 // CALIBRACIÓN (cuenta para los 8 minutos): el equipo escribe y prueba su programa; se leen sensores.
 h.el('src').value=SWEEP;h.js('start()');run(4);note('calibración: prueba del programa, robot a x='+h.js('R.x').toFixed(0));
 clock.advance(80000);note('calibración: lecturas y ajustes (80 s de reloj)');
 assert.ok(s.beginRun().ok);note('recorrido puntuable iniciado (calibración = '+(s.round.calibrationMs/1000).toFixed(0)+' s)');
 h.js('start()');note('programa en marcha; espera el tacto');   // el programa de SWEEP no usa botonInicio: arranca solo
 for(let k=0;k<100&&!s.round.overcome[1];k++)run(1);note('x='+h.js('R.x').toFixed(0)+' y='+h.js('R.y').toFixed(0));   // el instante depende de la geometría del robot (HEAD-CANVAS: ≈ 64 s), no de un tiempo fijo
 const o1=s.round.overcome[1];assert.ok(o1,'superó el cuarto 1');note('cuarto 1 superado (intento '+o1.attempt+'), checkpoint habilitado');
 run(23);note('x='+h.js('R.x').toFixed(0)+' y='+h.js('R.y').toFixed(0)+' (decisión del capitán)');
 const f=s.declareNoProgress();assert.ok(f.ok);note('el capitán declara falta de progreso en el cuarto '+f.fault.room+' (intento '+f.fault.attempt+')');
 assert.ok(s.reposition().ok);note('reposición en '+f.fault.allowed.rule+' ('+f.fault.allowed.pose.x.toFixed(0)+', '+f.fault.allowed.pose.y.toFixed(0)+')');
 h.js('start()');note('programa reiniciado, intento '+s.attemptsView()[2].current+' del cuarto 2');
 run(10);assert.ok(s.finishRound('captain').ok);note('el capitán finaliza la ronda');
 return {h,s,log,clock};
};
test('RONDA COMPLETA reproducible (ronda 1, recorrido A): calibración → recorrido → cuarto 1 + checkpoint → falta en cuarto 2 → reposición → intento 2 → fin voluntario',()=>{
 const {s,log}=playRound();const r=s.rounds[0];
 assert.equal(r.finishedBy,'captain');assert.equal(r.calibrationMs,84000+0,'calibración medida con el reloj de competencia');
 assert.equal(r.faults.length,1);assert.equal(r.faults[0].room,2);assert.equal(r.faults[0].allowed.rule,'checkpoint-tile');
 assert.ok(r.checkpoint.enabled&&r.overcome[1]&&!r.overcome[3]);
 assert.ok(r.physics.some(e=>e.kind==='sweep'),'registro físico: el prisma se apartó con barrido');assert.ok(!r.physics.some(e=>e.kind==='push'));
 same(r.events.map(e=>e.type).filter((t,i,a)=>a.indexOf(t)===i),['round-start','calibration-program-run','run-begin','program-started','room-overcome','checkpoint-enabled','no-progress-declared','reposition','attempt-restart','round-finish']);
 if(process.env.SHOW_ROUND)console.log(log.join('\n'));
 // Determinista: otra ejecución idéntica produce el mismo registro de eventos.
 const again=playRound();same(again.s.rounds[0].events.map(e=>[e.type,e.clockMs,e.state]),r.events.map(e=>[e.type,e.clockMs,e.state]));
});
test('dos rondas seguidas con el simulador real: la 2.ª parte limpia (mundo, reloj, intentos, checkpoint, registro físico)',()=>{
 const {h,s,clock}=playRound();
 assert.ok(s.nextRound().ok);assert.equal(h.js('BITIRO_PHYSICS_LOG().length'),0);assert.equal(h.js('activeObstacles.length'),2);
 same(h.js('[R.x,R.y]'),[21,120]);
 s.setObstacleDecision('remove');s.startRound();assert.equal(h.js('activeObstacles.length'),0);assert.equal(s.round.number,2);assert.equal(s.elapsedMs(),0);
 assert.equal(s.round.checkpoint.enabled,false);assert.equal(s.attemptsView()[1].current,1);assert.equal(s.attemptsView()[2].current,0);
 assert.equal(s.rounds.length,1);assert.equal(s.rounds[0].obstacles,'keep');
});
test('A y B con el simulador real: cambiar de pista entre rondas conserva el estado de cada sesión',()=>{
 const {h,ses,clock,run}=real('firvi-2025');const A=ses();A.startRound();clock.advance(30000);A.finishRound('captain');
 h.js("changeTrack('firvi-2025-b')");assert.equal(h.js('chosen'),'firvi-2025-b');
 const B=ses();assert.notEqual(A,B);assert.equal(B.state,S.PREPARATION);assert.equal(B.roundNumber,1);assert.equal(A.state,S.FINISHED);
 B.startRound();assert.ok(h.js('R.x')>330);assert.equal(h.js('BITIRO_COMPETITION.blocksTrackChange()'),true);
 B.finishRound('captain');h.js("changeTrack('firvi-2025')");assert.equal(ses(),A);assert.equal(ses().state,S.FINISHED);assert.equal(ses().rounds[0].endClock-ses().rounds[0].startClock,30000);
});
test('modo competencia solo existe en FIRVI: las demás pistas lo rechazan y no se ven afectadas',()=>{
 const h=load({extraFiles:EXTRA});h.js("changeTrack('s03')");const r=h.ctx.BITIRO_COMPETITION.enter();assert.equal(r.ok,false);assert.equal(h.ctx.BITIRO_COMPETITION.on,false);
});

console.log(`\n${n} pruebas FIRVI-2025-B OK`);
