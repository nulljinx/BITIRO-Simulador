/* FIRVI-2025-C · Evaluador y puntuación por hito (firvi-scoring.js) + instrumentación pasiva del simulador.
   node tests/firvi-scoring.cjs
   Dos niveles: (1) el evaluador puro con rondas SINTÉTICAS (hechos fabricados a propósito, para cubrir positivos y negativos de cada hito);
   (2) el simulador real en una ronda de competencia (programas de usuario reales, reloj falso).
   La prueba pendiente del recorrido autónomo completo NO está aquí: sigue en tests/pending/ y no se convierte en éxito. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {load,root}=require('./sim1/harness.cjs');

let n=0;
const test=(name,fn)=>{fn();n++;console.log('OK · '+name);};
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const EXTRA=['line-geometry.js','firvi-2025.js','firvi-competition.js','firvi-scoring.js'];

// ── nivel 1: evaluador puro ────────────────────────────────────────────────────────────────
const W=(()=>{const c={window:null,performance:{now:()=>0}};c.window=c;vm.createContext(c);
 for(const f of ['tracks.js','extra-tracks.js','calibration.js',...EXTRA])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});return c.window;})();
const SC=W.BITIRO_FIRVI_SCORING,P=SC.POINTS,ST=SC.ST;
const trackOf=id=>{const t=W.BITIRO_TRACKS[id];return {...t,competition:t.competitionSpec};};
const ctxFor=(id,final=true,judgeBook)=>{const track=trackOf(id);return {final,spec:track.competition,track,obstacleIds:(W.BITIRO_SCENARIO_PROPS[id]||[]).map(p=>p.id),judgeBook,limitMs:480000};};
const ROUTE={A:SC.routeOf(trackOf('firvi-2025')),B:SC.routeOf(trackOf('firvi-2025-b'))};
const ID={A:'firvi-2025',B:'firvi-2025-b'};
const {front:F,spread:SPREAD}=W.LINE_SENSOR.geometry;       // barra de sensores EFECTIVA (LINE_SENSOR.geometry de calibration.js; HEAD-CANVAS: 6,0 / 2,8 cm; la variante medida de main sería 8,0 / 1,9): el evaluador y los hechos sintéticos la comparten
/* Punto de la línea y tangente a la distancia s; `tape` = distancia del punto a la cinta REAL (los tramos de gap no tienen cinta). */
const at=(route,s)=>{const p=route.pts;let i=1;while(i<p.length-1&&p[i].s<s)i++;const a=p[i-1],b=p[i],f=Math.max(0,Math.min(1,(s-a.s)/((b.s-a.s)||1)));
 return {x:a.x+f*(b.x-a.x),y:a.y+f*(b.y-a.y),h:Math.atan2(b.y-a.y,b.x-a.x),k:a.k};};
const inGap=(route,s)=>route.gaps.some(g=>s>=g.s0-.5&&s<=g.s1+.5);
/* Distancia de un punto a la cinta física (la línea sin los conectores de los gaps). */
function tapeDist(k,x,y){const P=ROUTE[k].pts;let best=1e9;for(let i=1;i<P.length;i++){if(inGap(ROUTE[k],(P[i-1].s+P[i].s)/2))continue;
 const a=P[i-1],b=P[i],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy||1e-12,u=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/l2));best=Math.min(best,Math.hypot(x-a.x-u*dx,y-a.y-u*dy));}return best;}
/* Lectura FÍSICA de los tres sensores desde una pose (los sensores leen blanco si no hay cinta bajo ellos: no se fabrican). */
const senseAt=(k,x,y,h)=>[-SPREAD,0,SPREAD].map(o=>+(tapeDist(k,x+F*Math.cos(h)-o*Math.sin(h),y+F*Math.sin(h)+o*Math.cos(h))<=1));
/* Muestra a 20 Hz con la barra de sensores sobre el punto (px,py) de rumbo h; los sensores se calculan de la geometría. cmd = mando (izq−der). */
function sample(k,t,px,py,h,cmd,{mask=7,s=null}={}){
  const x=px-F*Math.cos(h),y=py-F*Math.sin(h);
  return {t:Math.round(t*1e6)/1e6,x,y,h,s:s||senseAt(k,x,y,h),r:mask,a:0,l:30+cmd/2,m:30-cmd/2};
}
/* Traza a 20 Hz (1 cm por muestra) con la barra de sensores sobre la línea, de s0 a s1.
   mode 'closed' (por omisión): el robot oscila ±0,7 cm y el mando corrige hacia la línea (como un seguidor real);
   'open': MISMA trayectoria pero el mando solo sigue la curvatura, ignorando los sensores; off: desplazamiento lateral (cm); back: rumbo invertido. */
function lineTrace(k,s0,s1,{t0=0,mask=7,mode='closed',off=0,back=false,step=1}={}){
  const out=[];let t=t0,i=0;
  for(let s=s0;s<=s1;s+=step,i++){
   t+=0.05;const q=at(ROUTE[k],s),wob=(Math.floor(i/6)%2?.7:-.7)+off,hd=back?q.h+Math.PI:q.h;
   const px=q.x-wob*Math.sin(q.h),py=q.y+wob*Math.cos(q.h);          // wob>0: la barra queda a la IZQUIERDA de la línea → la línea queda a la derecha
   const cls=Math.abs(q.k)<.012?0:(q.k>0?1:-1),e=-wob,cmd=cls*8+(mode==='closed'?14*Math.sign(e):0);
   out.push(sample(k,t,px,py,hd,cmd,{mask}));
  }
  return out;
}
const endT=tr=>tr.length?tr[tr.length-1].t:0;
/* Centro del robot cuando su barra de sensores está sobre la línea en s (pose de arranque / reposición para tramos sintéticos). */
const centerAt=(k,s)=>{const q=at(ROUTE[k],s);return {x:q.x-F*Math.cos(q.h),y:q.y-F*Math.sin(q.h),heading:q.h};};
/* Ronda sintética: run-begin y program-started ya registrados; el resto lo aporta cada prueba. startS: s de la línea donde arranca el intento (por omisión, la base INICIO). */
function round(k,o={}){
  const id=ID[k],sp=trackOf(id).competition,start=o.startS===undefined?sp.reposition.start:centerAt(k,o.startS);
  const props=obState(k);
  const r={number:o.number||1,obstacles:o.obstacles||'keep',startClock:0,endClock:o.endClock??300000,finishedBy:o.finishedBy??'captain',
   run:{startPose:{...start}},overcome:{},attempts:{1:{current:1},2:{current:0},3:{current:0}},faults:[],repositions:[],endReached:null,
   events:[{type:'run-begin',clockMs:120000,simTime:0,seq:1},{type:'program-started',clockMs:120000,simTime:0,seq:2}],
   physics:[],interaction:[],trace:[],obstacleState:o.obstacleState===undefined?props:o.obstacleState};
  return r;
}
const ev=(k,r,final=true,book)=>SC.evaluateRound(r,ctxFor(ID[k],final,book));
const m=(res,id)=>res.milestones.find(x=>x.id===id);
const sPlane=(k,i)=>SC.planeS(ROUTE[k],trackOf(ID[k]).competition.planes[i],trackOf(ID[k]).competition.direction);
const deepFreeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(deepFreeze);}return o;};
const reposEv=(k,s,simTime,seq=30)=>({type:'reposition',simTime,seq,room:1,rule:'start-base',pose:centerAt(k,s)});
/* Prismas del escenario (mismo cálculo que IROH_MECHANICS.prism) y su estado en la ronda. */
const prismPoly=(cx,cy,rotDeg,side)=>{const r=side/Math.sqrt(3),a0=rotDeg*Math.PI/180;return [0,1,2].map(i=>[cx+r*Math.cos(a0+i*2*Math.PI/3),cy+r*Math.sin(a0+i*2*Math.PI/3)]);};
const bbox=poly=>({x:Math.min(...poly.map(q=>q[0])),y:Math.min(...poly.map(q=>q[1]))});
function obState(k,moves={}){
  return (W.BITIRO_SCENARIO_PROPS[ID[k]]||[]).map(p=>{const poly0=prismPoly(p.cx,p.cy,p.rotationDeg,p.sideCm),b=bbox(poly0),d=moves[p.id]||{dx:0,dy:0};
   return {id:p.id,x:b.x+d.dx,y:b.y+d.dy,x0:b.x,y0:b.y,poly:poly0.map(q=>[q[0]+d.dx,q[1]+d.dy]),poly0};});
}
const propOf=(k,id)=>W.BITIRO_SCENARIO_PROPS[ID[k]].find(p=>p.id===id);
/* Desplazamiento (dx,dy) a lo largo de la normal de la línea que deja el prisma a ≥ need cm del eje (o el que se pida). */
function shiftFor(k,id,need){
  const p=propOf(k,id),poly0=prismPoly(p.cx,p.cy,p.rotationDeg,p.sideCm);let best=null;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])for(let d=0;d<=80;d+=.25){
   const dist=SC.distPolyRoute(poly0.map(q=>[q[0]+dx*d,q[1]+dy*d]),ROUTE[k]);
   if(dist>=need){if(!best||d<best.d)best={dx:dx*d,dy:dy*d,d,dist};break;}
  }
  return best;
}
/* Hecho del golpe con posiciones antes/después (tal como lo registra el simulador). */
const sweepEv=(k,id,from,to,{t=5,seq=10,servo=-60,servoTo=40,until}={})=>({kind:'sweep',id,detail:'servo',t,seq,until:until??t+1,steps:30,servo,servoTo,from,to});
const pushEv=(id,from,to,{t=7,seq=11,until}={})=>({kind:'push',id,detail:'translation',t,seq,until:until??t+.5,steps:5,servo:0,servoTo:0,from,to});
const posOf=(st,d=1)=>({x:st.x0+d*(st.x-st.x0),y:st.y0+d*(st.y-st.y0)});

test('valores de las bases FIRVI 2025: tacto 10 · línea 50 · obstáculo 30 (máx. 2) · cuartos 60/40/20 · gaps 30 · tarea final 30',()=>{
 assert.equal(P.touchStart,10);assert.equal(P.lineFollowing,50);assert.equal(P.obstacle,30);assert.equal(P.obstacleMax,2);
 same(P.room,{1:60,2:40,3:20});assert.equal(P.gaps,30);assert.equal(P.finalTask,30);
 const res=ev('A',round('A'),false);assert.equal(res.maxPossible,10+50+60+60+60+30+30,'máximo teórico: 300 pts');
});

// ── 1 · inicio por tacto ────────────────────────────────────────────────────────────────────
function touchRound({press=true,wait=true,movedBefore=false,heldBefore=false,poll=false}={}){
  const r=round('A');const start=r.run.startPose;
  const still=[0.05,0.1,0.15,0.2].map(t=>({t,x:start.x,y:start.y,h:0,s:[1,1,1],r:7,a:0}));
  if(heldBefore)r.physics.push({kind:'touch',detail:'press',t:0,seq:0});
  if(wait)r.interaction.push({kind:'gate-wait',detail:0,t:0.01,seq:3});
  if(poll)r.interaction.push({kind:'button-read',detail:0,t:0.01,seq:3});
  if(press)r.physics.push({kind:'touch',detail:'press',t:0.2,seq:4});
  if(wait&&press)r.interaction.push({kind:'gate-pass',detail:0,t:0.25,seq:5});
  if(poll&&press)r.interaction.push({kind:'button-read',detail:1,t:0.25,seq:5});
  const move=lineTrace('A',0,30,{t0:movedBefore?0:0.2});
  r.trace=movedBefore?move:[...still,...move];
  return r;
}
test('tacto: el programa espera botonInicio(), se activa el Pulsador y solo entonces avanza → 10 pts (automático)',()=>{
 const t=m(ev('A',touchRound()),'touch-start');
 assert.equal(t.status,ST.AUTO);assert.equal(t.points,10);assert.equal(t.source,'auto');assert.equal(t.evidence.waitedForButton,'botonInicio');
});
test('tacto: también cuenta el sondeo con leerBoton() (0 antes, 1 después de la activación)',()=>{
 const t=m(ev('A',touchRound({wait:false,poll:true})),'touch-start');assert.equal(t.status,ST.AUTO);assert.equal(t.evidence.waitedForButton,'leerBoton');
});
test('tacto NEGATIVO: sin Pulsador el robot arranca solo → no conseguido, sin puntos',()=>{
 const t=m(ev('A',touchRound({press:false,wait:false})),'touch-start');assert.equal(t.status,ST.NOT);assert.equal(t.points,0);
});
test('tacto NEGATIVO: un evento touch AISLADO (el programa no lo esperaba y ya se movía) no concede puntos',()=>{
 const r=touchRound({wait:false,movedBefore:true});const t=m(ev('A',r),'touch-start');
 assert.equal(t.status,ST.NOT);assert.equal(t.points,0);assert.ok(r.physics.some(e=>e.kind==='touch'),'el evento touch existe');
 const q=touchRound({wait:false});assert.equal(m(ev('A',q),'touch-start').status,ST.NOT,'pulsado pero el programa no lo esperaba (final)');
 assert.equal(m(ev('A',q,false),'touch-start').status,ST.PENDING,'en curso, todavía puede acreditarse');
});
test('tacto NEGATIVO: Pulsador ya presionado antes de iniciar el programa no acredita la activación',()=>{
 const r=touchRound({press:false,wait:false,heldBefore:true});const t=m(ev('A',r),'touch-start');assert.equal(t.status,ST.NOT);assert.equal(t.evidence.pressedBeforeProgram,true);
});
test('tacto NEGATIVO: el robot ya se movía cuando se activó el Pulsador',()=>{
 const t=m(ev('A',touchRound({movedBefore:true})),'touch-start');assert.equal(t.status,ST.NOT);assert.match(t.reason,/ya se movía|no se movió|dependa|depende/);
});

// ── 2 · seguimiento de línea con tres sensores ───────────────────────────────────────────────
test('línea: NUNCA se concede por lecturas/trayectoria; con los tres sensores consultados y avance queda pendiente del juez',()=>{
 const r=round('A');r.trace=lineTrace('A',0,ROUTE.A.len-10);
 const l=m(ev('A',r),'line-following');
 assert.equal(l.status,ST.PENDING);assert.equal(l.points,0);assert.equal(l.judgeRequired,true);assert.equal(l.potential,50);
 assert.ok(l.evidence.sensorsConsulted.every(s=>s.consulted));assert.ok(l.evidence.progressAlongLinePct>95);
});
test('línea NEGATIVO: un sensor jamás consultado por el programa → no conseguido (refutación automática)',()=>{
 const r=round('A');r.trace=lineTrace('A',0,300,{mask:1|4});     // el central nunca se lee
 const l=m(ev('A',r),'line-following');assert.equal(l.status,ST.NOT);assert.match(l.reason,/central/);
 assert.equal(m(ev('A',r,false),'line-following').status,ST.PENDING,'durante la ronda no se refuta todavía');
});
test('línea NEGATIVO: sin avance por la línea no hay nada que validar',()=>{
 const r=round('A');const s=r.run.startPose;r.trace=[0.05,0.1].map(t=>({t,x:s.x,y:s.y,h:0,s:[1,1,1],r:7,a:0}));
 assert.equal(m(ev('A',r),'line-following').status,ST.NOT);
});

// ── 3 · obstáculos ─────────────────────────────────────────────────────────────────────────
const OBS1='obstacle-room1',OBS3='obstacle-room3';
const clear1=shiftFor('A',OBS1,PARAMS_CLEAR()),clear3=shiftFor('A',OBS3,PARAMS_CLEAR());
function PARAMS_CLEAR(){return SC.PARAMS.clearanceCm+2;}
/* Ronda con el prisma 1 movido (dx,dy) y los hechos que se indiquen. */
const obsRound=(moves,physics)=>{const r=round('A',{obstacleState:obState('A',moves)});r.physics.push(...physics);return r;};
const st1=(moves)=>obState('A',moves).find(o=>o.id===OBS1);
const o1=(r)=>m(ev('A',r),'obstacle:'+OBS1),o1live=(r)=>m(ev('A',r,false),'obstacle:'+OBS1);
test('supuestos físicos del evaluador: franja de 8,3 cm = radio de colisión del cuerpo; barra de sensores = LINE_SENSOR.geometry (front y spread del robot efectivo)',()=>{
 const h=load();assert.equal(SC.PARAMS.clearanceCm,h.js('IROH_MECHANICS.spec.bodyRadius'));assert.equal(SC.PARAMS.sensorFrontCm,h.js('LINE_SENSOR.geometry.front'));
 assert.equal(SPREAD,h.js('LINE_SENSOR.geometry.spread'));
});
test('ronda REAL sin LINE_SENSOR: el evaluador falla de forma explícita (sin geometría de reserva); el evaluador puro conserva su referencia',()=>{
 const c={window:null,performance:{now:()=>0}};c.window=c;vm.createContext(c);
 for(const f of ['tracks.js','extra-tracks.js',...EXTRA])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});   // sin calibration.js
 const S=c.window.BITIRO_FIRVI_SCORING,t=c.window.BITIRO_TRACKS['firvi-2025'],track={...t,competition:t.competitionSpec};
 assert.equal(S.PARAMS.sensorFrontCm,8);assert.equal(S.PARAMS.tightCm,3.5);   // puro: referencia histórica
 const ev=S.forSession({track,rounds:[{number:1,events:[]}],state:'finished'});
 assert.throws(()=>ev.round(1),/geometría efectiva de LINE_SENSOR/);
 assert.ok(S.evaluateRound({number:1,events:[]},{final:true,spec:track.competition,track,obstacleIds:[]}),'sin requireGeometry el puro sigue evaluando');
});

test('los prismas por defecto BLOQUEAN la línea en su origen (a 0 cm) y hay un desplazamiento que la libera',()=>{
 for(const id of [OBS1,OBS3]){const st=obState('A').find(o=>o.id===id);assert.ok(SC.distPolyRoute(st.poly0,ROUTE.A)<SC.PARAMS.clearanceCm,id+' bloquea la línea');}
 assert.ok(clear1&&clear3,'existe un desplazamiento que lo deja libre');
});
test('obstáculo POSITIVO: el abanico desplaza el prisma, lo saca de la trayectoria y así queda → 30 pts; ni push ni contact puntúan como sweep',()=>{
 const mv={[OBS1]:clear1},st=st1(mv);
 const r=obsRound(mv,[sweepEv('A',OBS1,posOf(st,0),posOf(st,1))]);
 const res=ev('A',r),o=m(res,'obstacle:'+OBS1);assert.equal(o.status,ST.AUTO);assert.equal(o.points,30);assert.ok(o.evidence.trajectory.finalCm>=8.3);assert.equal(m(res,'obstacle:'+OBS3).status,ST.NOT);
 const push=obsRound(mv,[pushEv(OBS1,posOf(st,0),posOf(st,1)),{kind:'contact',id:null,detail:'x',t:6,seq:12}]);
 const p=o1(push);assert.equal(p.status,ST.NOT);assert.equal(p.points,0);assert.match(p.reason,/push|empuje/);
});
test('obstáculo NEGATIVO: el abanico lo toca pero no lo desplaza (< 2 cm) → contacto, sin puntos',()=>{
 const mv={[OBS1]:{dx:.5,dy:0}},st=st1(mv);
 const x=o1(obsRound(mv,[sweepEv('A',OBS1,posOf(st,0),posOf(st,1))]));assert.equal(x.status,ST.NOT);assert.match(x.reason,/contacto/);
});
test('obstáculo NEGATIVO CLAVE: desplazarlo ≥ 2 cm NO basta si sigue sobre la trayectoria (el cuerpo del robot no pasa) → sin puntos',()=>{
 for(const d of [2.5,4,6]){
  const mv={[OBS1]:{dx:clear1.dx?Math.sign(clear1.dx)*d:0,dy:clear1.dy?Math.sign(clear1.dy)*d:0}},st=st1(mv);
  const x=o1(obsRound(mv,[sweepEv('A',OBS1,posOf(st,0),posOf(st,1))]));
  assert.equal(x.status,ST.NOT,'desplazado '+d+' cm');assert.equal(x.points,0);assert.match(x.reason,/trayectoria no quedó libre/);assert.ok(x.evidence.trajectory.finalCm<8.3);
  assert.equal(o1live(obsRound(mv,[sweepEv('A',OBS1,posOf(st,0),posOf(st,1))])).status,ST.PENDING,'en curso solo pendiente');
 }
});
test('obstáculo: el empuje PREVIO invalida el abanico posterior; un empuje que completa la liberación deja la decisión al juez; un empuje posterior que la deja libre no quita el abanico',()=>{
 const full=st1({[OBS1]:clear1}),half={dx:clear1.dx/2,dy:clear1.dy/2},stHalf=st1({[OBS1]:half});
 // (a) empuje primero → no conseguido
 const a=obsRound({[OBS1]:clear1},[pushEv(OBS1,posOf(full,0),posOf(stHalf,1),{t:3,seq:9}),sweepEv('A',OBS1,posOf(stHalf,1),posOf(full,1),{t:5,seq:10})]);
 assert.equal(o1(a).status,ST.NOT);
 // (b) el abanico lo saca a la mitad (sigue en la línea) y el empuje completa → pendiente del juez, jamás automático
 const b=obsRound({[OBS1]:clear1},[sweepEv('A',OBS1,posOf(full,0),posOf(stHalf,1),{t:5,seq:10,until:6}),pushEv(OBS1,posOf(stHalf,1),posOf(full,1),{t:8,seq:11})]);
 const bb=o1(b);assert.equal(bb.status,ST.PENDING);assert.equal(bb.judgeRequired,true);assert.equal(bb.points,0);assert.equal(bb.potential,30);assert.match(bb.reason,/empuje/);
 // (c) el abanico lo deja libre y un empuje posterior lo mueve algo más sin volver a bloquear → 30 pts, una sola vez
 const farther=st1({[OBS1]:{dx:clear1.dx*1.2,dy:clear1.dy*1.2}});
 const c=obsRound({[OBS1]:{dx:clear1.dx*1.2,dy:clear1.dy*1.2}},[sweepEv('A',OBS1,posOf(full,0),posOf(full,1),{t:5,seq:10,until:6}),pushEv(OBS1,posOf(full,1),posOf(farther,1),{t:8,seq:11})]);
 const cc=ev('A',c);assert.equal(m(cc,'obstacle:'+OBS1).points,30);assert.equal(cc.total,30,'una sola vez');
 // (d) el abanico lo libera pero luego el robot lo empuja DE VUELTA a la línea → pendiente del juez
 const d=obsRound({[OBS1]:{dx:0,dy:0}},[sweepEv('A',OBS1,posOf(full,0),posOf(full,1),{t:5,seq:10,until:6}),pushEv(OBS1,posOf(full,1),posOf(full,0),{t:8,seq:11})]);
 const dd=o1(d);assert.equal(dd.status,ST.PENDING);assert.equal(dd.judgeRequired,true);assert.match(dd.reason,/otra vez/);
});
test('obstáculo: abanico simultáneo con el avance del robot, servo casi inmóvil o registro sin posiciones/polígono → no es demostrable: pendiente del juez',()=>{
 const st=st1({[OBS1]:clear1}),A=posOf(st,0),B=posOf(st,1);
 const sim=obsRound({[OBS1]:clear1},[sweepEv('A',OBS1,A,B,{t:5,seq:10,until:6}),pushEv(OBS1,B,B,{t:5.5,seq:11,until:6.5})]);
 const x=o1(sim);assert.equal(x.status,ST.PENDING);assert.match(x.reason,/coincidió|simult/);
 const lazy=obsRound({[OBS1]:clear1},[sweepEv('A',OBS1,A,B,{servo:0,servoTo:4})]);assert.equal(o1(lazy).status,ST.PENDING);assert.match(o1(lazy).reason,/abanico/);
 const nopos=obsRound({[OBS1]:clear1},[{kind:'sweep',id:OBS1,detail:'servo',t:5,seq:10,until:6,servo:-60,servoTo:40}]);assert.equal(o1(nopos).status,ST.PENDING);
 const nopoly=obsRound({[OBS1]:clear1},[sweepEv('A',OBS1,A,B)]);nopoly.obstacleState.forEach(o=>{delete o.poly0;delete o.poly;});
 assert.equal(o1(nopoly).status,ST.PENDING);assert.match(o1(nopoly).reason,/polígono/);
 for(const q of [sim,lazy,nopos,nopoly])assert.equal(ev('A',q).total,0,'nada de esto suma automáticamente');
});
test('obstáculo: máximo dos (un tercero, aunque sea válido, no suma) y los puntos se conceden una sola vez',()=>{
 const mv={[OBS1]:clear1,[OBS3]:clear3};
 const x3={id:'obstacle-x',cx:12,cy:12};const polyX=prismPoly(12,12,0,13),bx=bbox(polyX),shift=60;
 const states=[...obState('A',mv),{id:'obstacle-x',x:bx.x+shift,y:bx.y,x0:bx.x,y0:bx.y,poly:polyX.map(q=>[q[0]+shift,q[1]]),poly0:polyX}];
 const r=round('A',{obstacleState:states});
 states.forEach((st,i)=>r.physics.push(sweepEv('A',st.id,posOf(st,0),posOf(st,1),{t:10+i,seq:10+i})));
 const res=ev('A',r);assert.equal(res.milestones.filter(x=>/^obstacle:/.test(x.id)&&x.points===30).length,2);assert.equal(res.total,60);
 assert.match(m(res,'obstacle:obstacle-x').reason,/máximo/);
});
test('obstáculo: si el equipo retira los obstáculos antes de la ronda no hay puntaje (no aplica) y el máximo baja',()=>{
 const r=round('A',{obstacles:'remove',obstacleState:[]});const res=ev('A',r);
 assert.ok(res.milestones.filter(x=>/^obstacle:/.test(x.id)).every(x=>x.status===ST.NA&&x.points===0));assert.equal(res.maxPossible,10+50+60+60+30+30);
});

// ── 4 · cuartos: superación con evidencia física ────────────────────────────────────────────
/* Recorrido del cuarto inicial: attempts>1 → intentos fallidos con falta de progreso, reposición AUTORIZADA (con su pose) y nuevo intento. */
function fullRoom1(k,{attempts=1,mode='closed'}={}){
  const r=round(k);const s1=sPlane(k,0);
  let t=0;
  for(let a=1;a<attempts;a++){const part=lineTrace(k,0,100,{t0:t,mode});r.trace.push(...part);t=endT(part)+0.5;
   r.events.push({type:'no-progress-declared',simTime:t-0.3,seq:20+a*3,room:1,attempt:a},{...reposEv(k,0,t-0.2,21+a*3),pose:{...r.run.startPose}},{type:'attempt-restart',simTime:t,seq:22+a*3});}
  const part=lineTrace(k,3.5,s1+4,{t0:t,mode});r.trace.push(...part);
  const tt=endT(r.trace)-0.04;
  r.overcome[1]={clockMs:200000,simTime:tt,attempt:attempts,scoringEligible:attempts<=3,pose:{}};r.attempts[1].current=attempts;
  return r;
}
const room1=(r)=>m(ev('A',r),'room-initial');
test('cuarto inicial POSITIVO: intentos 1, 2 y 3 valen 60, 40 y 20 con lectura física de la línea y mando que responde a ella; el 4.º no da puntos (V.F.14)',()=>{
 const got=[1,2,3,4].map(a=>{const x=room1(fullRoom1('A',{attempts:a}));return [x.status,x.points,x.attempt];});
 same(got,[[ST.AUTO,60,1],[ST.AUTO,40,2],[ST.AUTO,20,3],[ST.NOT,0,4]]);
 const r4=room1(fullRoom1('A',{attempts:4}));assert.equal(r4.achievedWithoutPoints,true);assert.match(r4.reason,/3\.er intento/);
 assert.ok(room1(fullRoom1('A')).evidence.sensorResponse.ok);
});
test('cuarto NEGATIVO: recorte de curvas (cuerda entre dos puntos de la línea, sensores en blanco) → pendiente del juez aunque el motor registre el cruce del plano',()=>{
 const s1=sPlane('A',0);
 for(const [a,b] of [[20,110],[60,150],[130,s1+4]]){
  const r=round('A'),A=at(ROUTE.A,a),B=at(ROUTE.A,b);let t=0;
  r.trace=lineTrace('A',3.5,a);t=endT(r.trace);
  const n=Math.ceil(Math.hypot(B.x-A.x,B.y-A.y));
  for(let i=1;i<=n;i++){t+=.05;const f=i/n;r.trace.push(sample('A',t,A.x+f*(B.x-A.x),A.y+f*(B.y-A.y),Math.atan2(B.y-A.y,B.x-A.x),0));}
  r.trace.push(...lineTrace('A',b,s1+4,{t0:t}));
  r.overcome[1]={clockMs:1,simTime:endT(r.trace)-0.04,attempt:1,scoringEligible:true,pose:{}};
  const x=room1(r);assert.equal(x.status,ST.PENDING,'recorte '+a+'→'+b);assert.equal(x.points,0);assert.equal(x.judgeRequired,true);assert.equal(x.evidence.progression.continuous,false);
 }
});
test('cuarto NEGATIVO: trayectoria PARALELA fuera de la cinta (3, 8 y 12 cm de distancia) → los sensores leen blanco: sin cobertura, pendiente del juez',()=>{
 const s1=sPlane('A',0);
 for(const off of [3,8,12]){
  const r=round('A');r.trace=[...lineTrace('A',3.5,30),...lineTrace('A',31,s1+4,{off,t0:1.6})];
  r.overcome[1]={clockMs:1,simTime:endT(r.trace)-0.04,attempt:1,scoringEligible:true,pose:{}};
  const x=room1(r);assert.equal(x.status,ST.PENDING,'paralela a '+off+' cm');assert.equal(x.points,0);
  assert.ok(r.trace.slice(40).every(q=>!q.s.some(Boolean))||off<=3,'(los sensores leen blanco fuera de la cinta)');
 }
});
test('cuarto NEGATIVO: cruzar los planos de entrada y salida en línea recta, sin seguir la trayectoria → pendiente del juez',()=>{
 const sp=trackOf('firvi-2025').competition,start=sp.reposition.start,r=round('A');let t=0;
 for(let x=start.x;x<sp.planes[0]+6;x+=1){t+=.05;r.trace.push(sample('A',t,x+F,start.y,0,0));}
 r.overcome[1]={clockMs:1,simTime:t-0.04,attempt:1,scoringEligible:true,pose:{}};
 const x=room1(r);assert.equal(x.status,ST.PENDING);assert.equal(x.points,0);assert.equal(x.judgeRequired,true);
});
test('cuarto NEGATIVO: salto de pose o teletransporte (reubicación no autorizada) → pendiente del juez, registrado como integridad',()=>{
 const r=round('A'),s1=sPlane('A',0);
 r.trace=[...lineTrace('A',3.5,60),...lineTrace('A',200,s1+4,{t0:3.05})];       // salta 140 cm de línea
 r.overcome[1]={clockMs:1,simTime:endT(r.trace)-0.04,attempt:1,scoringEligible:true,pose:{}};
 const x=room1(r);assert.equal(x.status,ST.PENDING);assert.equal(x.points,0);assert.equal(x.judgeRequired,true);assert.equal(x.evidence.progression.continuous,false);
 assert.ok(x.evidence.unauthorizedJumpsInAttempt>=1,'el salto de pose queda registrado como reubicación no autorizada');
 // un salto SIN recorte también invalida el intento (la línea está cubierta, pero el robot fue reubicado)
 const q=round('A');q.trace=[...lineTrace('A',3.5,120)];const last=q.trace[q.trace.length-1];
 q.trace.push(...lineTrace('A',122,s1+4,{t0:last.t}).map((p,i)=>i===0?{...p,x:p.x+10}:p));
 q.overcome[1]={clockMs:1,simTime:endT(q.trace)-0.04,attempt:1,scoringEligible:true,pose:{}};
 assert.equal(room1(q).status,ST.PENDING);
});
test('cuarto NEGATIVO: interrupción no explicada (hueco de 3 s en la traza) → pendiente del juez',()=>{
 const r=round('A'),s1=sPlane('A',0);r.trace=[...lineTrace('A',3.5,100),...lineTrace('A',101,s1+4,{t0:5})];
 r.overcome[1]={clockMs:1,simTime:endT(r.trace)-0.04,attempt:1,scoringEligible:true,pose:{}};
 const x=room1(r);assert.equal(x.status,ST.PENDING);assert.equal(x.evidence.traceGapsInAttempt,1);
});
test('cuarto NEGATIVO: sensores CONSULTADOS pero IGNORADOS (misma trayectoria, mando que solo sigue la curva) → pendiente del juez; con mando que corrige, automático',()=>{
 const open=room1(fullRoom1('A',{mode:'open'}));
 assert.equal(open.status,ST.PENDING);assert.equal(open.points,0);assert.equal(open.judgeRequired,true);assert.equal(open.evidence.progression.continuous,true,'la trayectoria coincide con la línea');
 assert.ok(open.evidence.sensorResponse.known&&!open.evidence.sensorResponse.ok);assert.match(open.reason,/ignorar los sensores/);
 assert.equal(room1(fullRoom1('A')).status,ST.AUTO);
 const old=fullRoom1('A');old.trace.forEach(q=>{delete q.l;delete q.m;});
 assert.equal(room1(old).status,ST.PENDING,'sin registro del mando no se puede demostrar el uso de los sensores');
});
test('cuarto NEGATIVO: de reversa, con el rumbo invertido sobre la línea → no es seguir la línea',()=>{
 const r=round('A'),s1=sPlane('A',0);r.trace=lineTrace('A',3.5,s1+4,{back:true});
 r.overcome[1]={clockMs:1,simTime:endT(r.trace)-0.04,attempt:1,scoringEligible:true,pose:{}};
 assert.equal(room1(r).status,ST.PENDING);
});
test('cuarto: reinicios entre tramos — con reposición AUTORIZADA y arranque en la pose autorizada, sí; sin el evento, con otra pose o arrancando fuera de la línea, no',()=>{
 const base=()=>{const r=round('A'),s1=sPlane('A',0);r.trace=[...lineTrace('A',3.5,120),...lineTrace('A',3.5,s1+4,{t0:6.05})];r.overcome[1]={clockMs:1,simTime:endT(r.trace)-0.04,attempt:2,scoringEligible:true,pose:{}};return r;};
 const manual=base();assert.equal(room1(manual).status,ST.PENDING,'sin evento de reposición');
 const auth=base();auth.events.push(reposEv('A',3.5,6.07));
 const x=room1(auth);assert.equal(x.status,ST.AUTO);assert.equal(x.points,40);
 const elsewhere=base();elsewhere.events.push({...reposEv('A',3.5,6.07),pose:centerAt('A',80)});
 const y=room1(elsewhere);assert.equal(y.status,ST.PENDING);assert.match(y.reason,/pose autorizada/);
 const nopose=base();nopose.events.push({...reposEv('A',3.5,6.07),pose:undefined});assert.equal(room1(nopose).status,ST.PENDING,'una reposición sin pose no se puede verificar');
});
test('cuarto: sin cruce físico no hay puntos (al terminar: no conseguido; en curso: pendiente)',()=>{
 const r=round('A');r.trace=lineTrace('A',3.5,100);
 assert.equal(room1(r).status,ST.NOT);assert.equal(m(ev('A',r,false),'room-initial').status,ST.PENDING);
});
/* Recorrido hasta la base final desde la base INICIO, con la parte final a partir de una reposición en la última baldosa (para no depender de una ronda de 8 min). */
function finalLeg(k,{from=sPlane(k,1)-6,middleFrom=sPlane(k,0)-10,omitMiddle=false,overcome2=true,attempt=1,mode='closed'}={}){
  const r=round(k,{startS:omitMiddle?from:middleFrom+3.5});const end=ROUTE[k].len-8;
  r.trace=lineTrace(k,omitMiddle?from+3.5:middleFrom+3.5,end,{mode});
  if(overcome2)r.overcome[2]={clockMs:1,simTime:1,attempt:1,scoringEligible:true,pose:{}};
  r.endReached={clockMs:400000,simTime:endT(r.trace),attempt};
  return r;
}
test('cuarto final POSITIVO: 60/40/20 por intento; exige el cuarto intermedio superado y recorrido, y la progresión hasta la base final',()=>{
 for(const [att,pts] of [[1,60],[2,40],[3,20]]){
  const x=m(ev('A',finalLeg('A',{attempt:att})),'room-final');assert.equal(x.status,ST.AUTO,x.reason);assert.equal(x.points,pts);assert.equal(x.evidence.middleRoom.continuous,true);
 }
});
test('cuarto final NEGATIVO: el cuarto INTERMEDIO no se puede omitir (sin superarlo, o sin recorrerlo) ni se compensa con la base final',()=>{
 const skipFact=m(ev('A',finalLeg('A',{overcome2:false})),'room-final');assert.equal(skipFact.status,ST.PENDING);assert.equal(skipFact.points,0);assert.match(skipFact.reason,/intermedio/);
 const skipRoom=m(ev('A',finalLeg('A',{omitMiddle:true})),'room-final');assert.equal(skipRoom.status,ST.PENDING);assert.equal(skipRoom.points,0);assert.equal(skipRoom.evidence.middleRoom.continuous,false);assert.match(skipRoom.reason,/intermedio/);
 const cut=round('A',{startS:sPlane('A',1)-6+3.5});cut.trace=[...lineTrace('A',sPlane('A',1),sPlane('A',1)+30),...lineTrace('A',ROUTE.A.len-80,ROUTE.A.len-8,{t0:3.2})];
 cut.overcome[2]={clockMs:1,simTime:1,attempt:1,scoringEligible:true,pose:{}};cut.endReached={clockMs:1,simTime:endT(cut.trace),attempt:1};
 const y=m(ev('A',cut),'room-final');assert.equal(y.status,ST.PENDING);assert.equal(y.points,0);
 assert.equal(m(ev('A',finalLeg('A',{mode:'open'})),'room-final').status,ST.PENDING,'sensores ignorados');
});

// ── 5 · gaps y tarea final ─────────────────────────────────────────────────────────────────
const gapRound=(k,s0,s1,o={})=>{const r=round(k,{startS:s0+3.5});r.trace=lineTrace(k,s0+3.5,s1,o);return r;};
const gapsOf=(k,r,final=true)=>m(ev(k,r,final),'gaps');
test('gaps POSITIVO — cruce válido con recuperación de línea: línea leída antes, tramo recto sin cinta y línea leída después, en un mismo intento → 30 pts',()=>{
 const g=ROUTE.A.gaps;assert.equal(g.length,3);
 const x=gapsOf('A',gapRound('A',g[0].s0-20,g[2].s1+20));assert.equal(x.status,ST.AUTO);assert.equal(x.points,30);assert.equal(x.evidence.traversed,3);assert.equal(x.evidence.inSingleAttempt,true);
 assert.ok(lineTrace('A',g[0].s0-20,g[0].s0-15).some(q=>q.s.some(Boolean)),'(hay lectura de línea antes del gap)');
});
test('gaps NEGATIVO — cruce PARCIAL: entra al gap 2 y se queda o regresa sin salir → 2 de 3: no conseguido',()=>{
 const g=ROUTE.A.gaps,r=gapRound('A',g[0].s0-20,g[1].s0+(g[1].s1-g[1].s0)*.6);
 const x=gapsOf('A',r);assert.equal(x.status,ST.NOT);assert.equal(x.points,0);assert.equal(x.evidence.traversed,1);
 assert.equal(gapsOf('A',r,false).status,ST.PENDING,'en curso solo está pendiente');
 const two=gapsOf('A',gapRound('A',g[0].s0-20,g[1].s1+10));assert.equal(two.status,ST.NOT);assert.equal(two.evidence.traversed,2);
});
test('gaps NEGATIVO — SALIDA DE PISTA sin recuperación: en el gap 2 el robot se desvía de lado (> 4 cm del eje) y sigue paralelo → no conseguido',()=>{
 const g=ROUTE.A.gaps,r=round('A',{startS:g[0].s0-16.5});r.trace=lineTrace('A',g[0].s0-16.5,g[1].s0-3);let t=endT(r.trace);
 const q=at(ROUTE.A,g[1].s0-3);
 for(let i=1;i<=60;i++){t+=.05;const lat=Math.min(14,i*1.2);r.trace.push(sample('A',t,q.x-lat*Math.sin(q.h)+i*Math.cos(q.h),q.y+lat*Math.cos(q.h)+i*Math.sin(q.h),q.h,0));}
 const x=gapsOf('A',r);assert.equal(x.status,ST.NOT);assert.equal(x.points,0);assert.ok(x.evidence.traversed<3);
});
test('gaps NEGATIVO — lectura de blanco SIN superar el gap (se detiene en él, o gira en el sitio): no cuenta',()=>{
 const g=ROUTE.A.gaps,q=at(ROUTE.A,g[1].s0+10),r=round('A',{startS:g[1].s0+10-8});
 r.trace=[0.05,0.1,0.15].map(t=>sample('A',t,q.x,q.y,q.h,0));
 const x=gapsOf('A',r);assert.equal(x.points,0);assert.equal(x.evidence.traversed,0);
 const spin=round('A',{startS:g[1].s0+10-8});spin.trace=Array.from({length:60},(_,i)=>sample('A',(i+1)*.05,q.x,q.y,q.h+i*.1,0));assert.equal(gapsOf('A',spin).points,0);
});
test('gaps NEGATIVO — «cruzar la coordenada» por salto o teletransporte sobre un gap no concede los 30 pts',()=>{
 const g=ROUTE.A.gaps;
 const jump=round('A',{startS:g[0].s0-16.5});jump.trace=[...lineTrace('A',g[0].s0-16.5,g[0].s0+2),...lineTrace('A',g[0].s1+2,g[2].s1+20,{t0:3})];
 const b=gapsOf('A',jump);assert.notEqual(b.status,ST.AUTO);assert.equal(b.points,0);assert.equal(b.evidence.gaps[0].traversedContinuously,false);
});
test('gaps — intentos DISTINTOS con reinicios: cada gap se supera en un intento, pero el criterio conjunto no se concede solo → pendiente del juez',()=>{
 const g=ROUTE.A.gaps,r=round('A',{startS:g[0].s0-16.5});
 r.trace=lineTrace('A',g[0].s0-16.5,g[0].s1+12);let t=endT(r.trace)+.5;
 r.events.push(reposEv('A',g[1].s0-20,t-.1));
 r.trace.push(...lineTrace('A',g[1].s0-20+3.5,g[2].s1+20,{t0:t}));
 const x=gapsOf('A',r);assert.equal(x.status,ST.PENDING);assert.equal(x.points,0);assert.equal(x.judgeRequired,true);assert.equal(x.potential,30);assert.equal(x.evidence.traversed,3);assert.equal(x.evidence.inSingleAttempt,false);
});
test('gaps: la traza de B recorrida como si fuera A no cuenta; B en su propio sentido sí',()=>{
 const g=ROUTE.B.gaps;assert.equal(g.length,3);assert.ok(g[0].s0<g[1].s0,'las distancias de B crecen en su propio sentido');
 const b=gapRound('B',g[0].s0-20,g[2].s1+20);assert.equal(gapsOf('B',b).status,ST.AUTO);
 const wrong=round('A');wrong.trace=b.trace;assert.notEqual(gapsOf('A',wrong).status,ST.AUTO);
});
test('tarea final: la «intersección» no está identificada → nunca automática; paradas candidatas solo como evidencia; el juez decide',()=>{
 const r=round('A');r.overcome[1]={clockMs:1,simTime:1,attempt:1,scoringEligible:true,pose:{}};
 const s0=sPlane('A',0)+20;r.trace=lineTrace('A',s0,s0+30);const q=r.trace[r.trace.length-1];
 for(let i=1;i<=30;i++)r.trace.push({...q,t:Math.round((q.t+i*0.05)*1e6)/1e6});                    // se detiene 1,5 s
 for(let i=1;i<=40;i++)r.trace.push({...q,t:Math.round((q.t+1.5+i*0.05)*1e6)/1e6,h:q.h+i*0.1});    // y gira en el sitio
 const f=m(ev('A',r),'final-task');
 assert.equal(f.status,ST.PENDING);assert.equal(f.points,0);assert.equal(f.judgeRequired,true);assert.equal(f.evidence.intersectionIdentified,false);
 assert.ok(f.evidence.candidateStopsInMiddleRoom.length>=1);
 const none=round('A');assert.equal(m(ev('A',none),'final-task').status,ST.NOT,'jamás llegó al cuarto intermedio');
});

// ── 6 · juez ───────────────────────────────────────────────────────────────────────────────
test('juez: valida lo pendiente (línea y tarea final), registra su decisión y nunca altera la ronda ni los hechos',()=>{
 const r=round('A');r.trace=lineTrace('A',0,ROUTE.A.len-10);r.overcome[1]={clockMs:1,simTime:1,attempt:1,scoringEligible:true,pose:{}};
 const snapshot=JSON.stringify(r);deepFreeze(r);
 const book=SC.createJudgeBook({isFinal:nr=>nr===1});
 const before=ev('A',r,true,book);
 assert.ok(book.decide(1,'line-following','award',{note:'seguimiento correcto'}).ok);assert.ok(book.decide(1,'final-task','award').ok);
 const res=ev('A',r,true,book),l=m(res,'line-following'),f=m(res,'final-task');
 assert.equal(l.status,ST.JUDGE);assert.equal(l.points,50);assert.equal(l.source,'judge');assert.equal(l.auto.status,ST.PENDING,'queda a la vista lo que decía el automático');
 assert.equal(f.status,ST.JUDGE);assert.equal(res.total-before.total,80);
 assert.equal(JSON.stringify(r),snapshot,'la ronda original no cambia');
 book.decide(1,'line-following','deny');assert.equal(m(ev('A',r,true,book),'line-following').status,ST.NOT);
 book.decide(1,'line-following','clear');assert.equal(m(ev('A',r,true,book),'line-following').status,ST.PENDING,'«quitar» devuelve la vista al automático');
 assert.equal(book.all().length,4,'el libro conserva todas las decisiones (append-only)');
});
test('juez: solo después de la ronda; un cuarto concedido por el juez exige indicar el intento (y >3 no da puntos)',()=>{
 const book=SC.createJudgeBook({isFinal:nr=>nr===1});
 assert.ok(!book.decide(2,'line-following','award').ok,'la ronda 2 aún no terminó');assert.ok(!book.decide(1,'room-initial','award').ok);
 assert.ok(book.decide(1,'room-initial','award',{attempt:2}).ok);
 const r=round('A');const x=m(ev('A',r,true,book),'room-initial');assert.equal(x.status,ST.JUDGE);assert.equal(x.points,40);
 book.decide(1,'room-initial','award',{attempt:5});assert.equal(m(ev('A',r,true,book),'room-initial').points,0);
 assert.ok(!book.decide(1,'gaps','quizá').ok);
});

// ── 7 · terminación de la ronda ─────────────────────────────────────────────────────────────
test('ronda terminada voluntariamente vs agotada por tiempo: se conservan los puntos alcanzados y el tiempo es el de cada caso',()=>{
 const mk=(by,end)=>{const r=touchRound();r.finishedBy=by;r.endClock=end;return r;};
 const v=ev('A',mk('captain',200000)),t=ev('A',mk('time',480000));
 assert.equal(v.total,10);assert.equal(t.total,10);assert.equal(v.timeMs,200000);assert.equal(v.finishedBy,'captain');
 assert.equal(t.timeMs,480000);assert.equal(t.finishedBy,'time');assert.equal(ev('A',mk('time',999999)).timeMs,480000,'nunca más de 8:00');
 assert.ok(v.lastPointClockMsApprox>=120000,'tiempo estimado del último punto, informado aparte');
});

// ── 8 · independencia A / B, determinismo, resumen ──────────────────────────────────────────
test('A y B se evalúan en su sentido: las trazas y el cuarto inicial de B puntúan en B',()=>{
 const rb=fullRoom1('B');assert.equal(m(ev('B',rb),'room-initial').points,60);
 assert.notEqual(sPlane('A',0),null);assert.notEqual(sPlane('B',0),null);
 const book=SC.createJudgeBook();book.decide(1,'final-task','award');
 assert.equal(m(ev('B',round('B'),true,SC.createJudgeBook()),'final-task').status,ST.NOT,'el libro del juez de A no existe para B');
});
test('determinismo: la misma ronda da exactamente el mismo resultado y el evaluador no modifica sus entradas',()=>{
 const mv={[OBS1]:clear1},st=st1(mv);
 const r=fullRoom1('A',{attempts:2});r.physics.push(sweepEv('A',OBS1,posOf(st,0),posOf(st,1)));r.obstacleState=obState('A',mv);deepFreeze(r);
 const a=JSON.stringify(ev('A',r)),b=JSON.stringify(ev('A',r));assert.equal(a,b);
});
test('resumen: dos rondas por separado, mejor ronda y suma; NO declara ganador; los pendientes quedan a la vista',()=>{
 const r1=ev('A',fullRoom1('A')),r2=ev('A',fullRoom1('A',{attempts:2}));
 const sm=SC.summarize([r1,r2]);
 assert.equal(sm.sumOfRounds,r1.total+r2.total);assert.equal(sm.bestRound.round,1);assert.equal(sm.officialWinner,null);assert.equal(sm.complete,true);
 assert.ok(sm.notes.some(t=>/contradice|VI\.A\.2/.test(t)));assert.ok(sm.pendingJudgeItems>0);
 const tie=SC.summarize([{...r1,round:1,total:60,timeMs:300000},{...r1,round:2,total:60,timeMs:200000}]);assert.equal(tie.bestRound.round,2,'empate de puntaje: menor tiempo (V.F.15)');
 const live=SC.summarize([ev('A',round('A'),false),null]);assert.equal(live.complete,false);assert.equal(live.bestRound,null,'una ronda en curso no entra en mejor/suma');
});

// ── nivel 2: simulador real ────────────────────────────────────────────────────────────────
const MIN=60000;
const realRound=(program,{route='firvi-2025',press=3,seconds=60,obstacles='keep',press2=null,until=null}={})=>{   // until(s): avanza de 1 s en 1 s hasta que se cumpla (máx. `seconds`): el instante depende de la geometría del robot
 const h=load({extraFiles:EXTRA});const clock={t:1000,now:()=>clock.t};
 h.ctx.BITIRO_COMPETITION.setClock(clock);h.js(`changeTrack('${route}')`);h.ctx.BITIRO_COMPETITION.enter();
 const s=h.ctx.BITIRO_COMPETITION.session();
 s.setObstacleDecision(obstacles);s.startRound();h.el('src').value=program;clock.t+=MIN;s.beginRun();h.js('start()');
 const step=(sec)=>{for(let t=0;t<Math.round(sec*120);t++){h.js('update(1/120)');clock.t+=1000/120;}};
 if(press!==null){step(press);h.js('pressTouchSensor(1)');}
 if(until){for(let k=0;k<seconds&&!until(s);k++)step(1);}else step(seconds);
 return {h,s,clock,step};
};
const SWEEPER=gate=>`void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(1200);${gate?'botonInicio();':''}}
int ult=0;int lost=0;int done=0;
void loop(){
 if(done==0 && leerDistanciaSonar()<=14){detenerse();pausa(300);moverServoGolpe(1);pausa(1500);moverServoGolpe(0);pausa(1200);done=1;}
 bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<35){if(ult<0){avanzar(15,33);}else{avanzar(33,15);}} else if(lost<110){if(ult<0){avanzar(33,15);}else{avanzar(15,33);}}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;   // con sensores separados 2,8 cm hay una franja muerta junto a la línea: al perderla, un balanceo corto antes de seguir recto (ver reference-program.iroh)
const evalReal=(rr,final)=>{if(final)rr.s.finishRound('captain');return rr.h.ctx.BITIRO_FIRVI_SCORING.forSession(rr.s).round(1);};

test('SIMULADOR REAL (A): tacto + abanico + cuarto inicial en 1.er intento = 10 + 30 + 60; línea y tarea final quedan para el juez',()=>{
 const rr=realRound(SWEEPER(true),{seconds:100,until:s=>s.round.overcome[1]});
 assert.ok(rr.s.round.overcome[1],'el robot superó físicamente el cuarto 1');
 const res=evalReal(rr,true);
 assert.equal(m(res,'touch-start').status,ST.AUTO);assert.equal(m(res,'obstacle:obstacle-room1').points,30);assert.equal(m(res,'room-initial').points,60);
 assert.equal(res.total,100);assert.equal(m(res,'line-following').status,ST.PENDING);assert.equal(m(res,'final-task').status,ST.PENDING);
 assert.equal(m(res,'obstacle:obstacle-room3').status,ST.NOT);assert.equal(m(res,'room-final').status,ST.NOT);assert.equal(m(res,'gaps').status,ST.NOT);
 assert.ok(res.pendingCriteria.some(c=>c.id==='line-following'));assert.equal(res.integrity.unauthorizedJumps,0);
});
test('SIMULADOR REAL: reproducible (dos ejecuciones idénticas dan el mismo resultado) y la evaluación en vivo no modifica el simulador',()=>{
 const a=realRound(SWEEPER(true),{seconds:30}),b=realRound(SWEEPER(true),{seconds:30});
 const ka=a.h.ctx.BITIRO_FIRVI_SCORING.forSession(a.s);
 const pose0=a.h.js('JSON.stringify([R.x,R.y,R.th,simTime,activeObstacles.map(o=>[o.x,o.y])])');
 const live1=JSON.stringify(ka.round(1));const live2=JSON.stringify(ka.round(1));
 assert.equal(live1,live2);assert.equal(a.h.js('JSON.stringify([R.x,R.y,R.th,simTime,activeObstacles.map(o=>[o.x,o.y])])'),pose0,'evaluar no mueve nada');
 assert.equal(JSON.parse(live1).final,false,'ronda en curso: evaluación provisional');
 assert.equal(JSON.stringify(evalReal(a,true)),JSON.stringify(evalReal(b,true)));
});
test('SIMULADOR REAL NEGATIVO: sin botonInicio() el Pulsador es un evento aislado → sin 10 pts; el tacto sí cuenta con botonInicio()',()=>{
 const res=evalReal(realRound(SWEEPER(false),{seconds:10}),true);
 assert.equal(m(res,'touch-start').status,ST.NOT);assert.equal(m(res,'touch-start').points,0);
 const none=evalReal(realRound(SWEEPER(true),{press:null,seconds:10}),true);
 assert.equal(m(none,'touch-start').status,ST.NOT,'el programa espera el botón y nadie lo pulsa');
});
test('SIMULADOR REAL NEGATIVO: sin la orden de abanico, empujar el prisma con la barra no puntúa como sweep',()=>{
 const NOSWEEP=SWEEPER(true).replace('moverServoGolpe(1);pausa(1500);moverServoGolpe(0);pausa(1200);','').replace('moverServoGolpe(-1);pausa(1200);','moverServoGolpe(0);pausa(200);').replace('leerDistanciaSonar()<=14','leerDistanciaSonar()<=-1');
 const rr=realRound(NOSWEEP,{seconds:40});const kinds=rr.h.js('BITIRO_PHYSICS_LOG()').map(e=>e.kind);
 const res=evalReal(rr,true);
 assert.ok(kinds.includes('push')||kinds.includes('contact'),'el robot topa el prisma ('+kinds.join(',')+')');
 assert.equal(m(res,'obstacle:obstacle-room1').points,0);assert.equal(res.milestones.filter(x=>/^obstacle:/.test(x.id)&&x.points>0).length,0);
});
test('SIMULADOR REAL: obstáculos retirados → sin puntaje de obstáculos; un programa de solo sensores consulta los tres sensores',()=>{
 const rr=realRound(SWEEPER(true),{seconds:20,obstacles:'remove'});const res=evalReal(rr,true);
 assert.ok(res.milestones.filter(x=>/^obstacle:/.test(x.id)).every(x=>x.status===ST.NA));
 assert.ok(m(res,'line-following').evidence.sensorsConsulted.every(x=>x.consulted));
});
test('SIMULADOR REAL NEGATIVO: un programa que solo lee dos sensores no puede reclamar el seguimiento con tres',()=>{
 const TWO=`void setup(){inicializarMovimiento();inicializarSensores();botonInicio();}
void loop(){bool i=lineaIzquierda();bool d=lineaDerecha();if(i){avanzar(8,26);}else if(d){avanzar(26,8);}else{avanzar(24);}pausa(5);}`;
 const res=evalReal(realRound(TWO,{seconds:15}),true);const l=m(res,'line-following');
 assert.equal(l.status,ST.NOT);assert.match(l.reason,/central/);
});
test('SIMULADOR REAL: tramos físicos reales alimentan la evaluación de gaps y del cuarto final (trazas de un robot que sigue la línea)',()=>{
 // Tramos de la Etapa A.1 con el mismo programa de sensores; la traza y el registro vienen del simulador, los eventos de ronda se componen aquí.
 const FOLLOWER=`void setup(){inicializarMovimiento();inicializarSensores();}
int ult=0;int lost=0;
void loop(){bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<35){if(ult<0){avanzar(15,33);}else{avanzar(33,15);}} else if(lost<110){if(ult<0){avanzar(33,15);}else{avanzar(15,33);}}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;   // balanceo al perder la línea: ver SWEEPER
 const P_=Math.PI;
 const seg=(route,pose,goal)=>{
  const h=load({extraFiles:EXTRA,storage:{['bitiro:standalone:scenario:v1:'+route]:'[]'}});h.js(`changeTrack('${route}')`);h.program(FOLLOWER);
  h.js(`R.x=${pose[0]};R.y=${pose[1]};R.th=${pose[2]};previousPose={x:R.x,y:R.y,th:R.th,angle:0}`);
  // se descarta lo anterior al arranque del tramo: la traza empieza ya con el robot en su sitio
  let ok=false;for(let t=0;t<120*120;t++){h.js('update(1/120)');if(goal(h.js('R.x'),h.js('R.y'))){ok=true;break;}if(h.js('mode')!=='code')break;}
  assert.ok(ok,'el tramo '+route+' debe completarse');return {trace:h.js('BITIRO_TRACE_LOG()'),pose:{x:pose[0],y:pose[1]}};
 };
 const g1=ROUTE.A.gaps[0],c0=centerAt('A',g1.s0-14);     // el robot arranca sobre la línea, 14 cm antes del gap 1, con el rumbo de la línea (pose de reposición hipotética)
 const traceA2=seg('firvi-2025',[c0.x,c0.y,c0.heading+P_/2],(x,y)=>x>230&&y>110);
 const rA=round('A');rA.trace=traceA2.trace;rA.run.startPose=traceA2.pose;
 const g=m(ev('A',rA),'gaps');
 assert.equal(g.evidence.traversed,3,'el robot real recorrió los 3 gaps de forma continua: '+JSON.stringify(g.evidence.gaps));assert.equal(g.status,ST.AUTO);
 const c3=centerAt('A',sPlane('A',1)-12);
 const traceA3=seg('firvi-2025',[c3.x,c3.y,c3.heading+P_/2],(x,y)=>x>325&&y<40);
 const rF=round('A');rF.trace=traceA3.trace;rF.run.startPose=traceA3.pose;rF.overcome[2]={clockMs:1,simTime:1,attempt:1,scoringEligible:true,pose:{}};rF.endReached={clockMs:1,simTime:endT(traceA3.trace),attempt:1};
 const f=m(ev('A',rF),'room-final');
 assert.equal(f.evidence.progression.continuous,true,'el tramo real del cuarto final se recorre con lectura continua: '+JSON.stringify(f.evidence.progression));assert.ok(f.evidence.sensorResponse.ok,JSON.stringify(f.evidence.sensorResponse));
 assert.equal(f.status,ST.PENDING,'un tramo suelto NO demuestra el cuarto intermedio: no se concede');assert.equal(f.points,0);assert.match(f.reason,/intermedio/);
 const traceB2=seg('firvi-2025-b',[180,115,0],(x,y)=>x<150&&y<40);
 const rB=round('B');rB.trace=traceB2.trace;rB.run.startPose=traceB2.pose;assert.equal(m(ev('B',rB),'gaps').evidence.traversed,3,'B: gaps en sentido inverso');
});
test('instrumentación pasiva: el registro de sensores/interacción no cambia la física (misma pose y obstáculos con y sin consultarlo)',()=>{
 const run=(poll)=>{const h=load({extraFiles:EXTRA});h.js("changeTrack('firvi-2025')");h.program(SWEEPER(false));
  for(let t=0;t<120*30;t++){h.js('update(1/120)');if(poll&&t%7===0){h.js('BITIRO_TRACE_LOG()');h.js('BITIRO_INTERACTION_LOG()');h.js('BITIRO_PHYSICS_LOG()');h.js('BITIRO_SIM_ADAPTER.obstacles()');h.js('BITIRO_SIM_ADAPTER.traceLog()');}}
  return h.js('JSON.stringify([R.x,R.y,R.th,simTime,collisionCount,activeObstacles.map(o=>[o.x,o.y])])');};
 assert.equal(run(true),run(false));
});

test('muestreo a 20 Hz: el paso máximo de la barra de sensores entre dos muestras, incluso en el peor mando posible, queda por debajo del umbral de continuidad',()=>{
 // Peor caso: giro en el sitio a velocidad máxima y avance máximo con giro; el evaluador asume stepMaxCm entre muestras consecutivas.
 const worst=(body)=>{const h=load({extraFiles:EXTRA});h.js("changeTrack('firvi-2025')");h.program('void setup(){inicializarMovimiento();} void loop(){'+body+'}');
  let max=0;for(let t=0;t<120*6;t++)h.js('update(1/120)');
  const tr=h.js('BITIRO_TRACE_LOG()');for(let i=1;i<tr.length;i++){const a=tr[i-1],b=tr[i];
   max=Math.max(max,Math.hypot(b.x+F*Math.cos(b.h)-a.x-F*Math.cos(a.h),b.y+F*Math.sin(b.h)-a.y-F*Math.sin(a.h)),b.t-a.t>.06?99:0);}
  return {max,samples:tr.length,dt:tr.length>1?tr[1].t-tr[0].t:0};};
 for(const body of ['avanzar(100,-100);','avanzar(100,100);','avanzar(100,0);','avanzar(100,-30);']){
  const w=worst(body);assert.ok(w.samples>=100,'20 Hz: '+w.samples+' muestras en 6 s');assert.ok(Math.abs(w.dt-0.05)<1e-6,'una muestra cada 0,05 s');assert.ok(w.max<SC.PARAMS.stepMaxCm,body+' → '+w.max.toFixed(2)+' cm/muestra');
 }
});
test('las decisiones críticas no dependen del muestreo: cruce de planos (motor, 120 Hz), abanico/empuje (registro físico, 120 Hz) y toque se registran por paso físico, no por muestra de traza',()=>{
 const rr=realRound(SWEEPER(true),{seconds:30});
 const phys=rr.h.js('BITIRO_PHYSICS_LOG()'),sw=phys.find(e=>e.kind==='sweep');
 assert.ok(sw&&sw.from&&sw.to,'el golpe trae la posición del obstáculo antes y después');assert.ok(sw.steps>20,'se acumulan muchos pasos físicos por hecho ('+sw.steps+'): no se pierde un barrido entre muestras de 20 Hz');
 const tr=rr.h.js('BITIRO_TRACE_LOG()');assert.ok(sw.steps/120>0.05*2,'el barrido dura más de dos muestras de la traza');
 const src=fs.readFileSync(path.join(root,'firvi-competition.js'),'utf8');assert.match(src,/observe\(pose\)/);
 assert.match(fs.readFileSync(path.join(root,'simulator.js'),'utf8'),/BITIRO_COMPETITION\.observe\(\{x:R\.x,y:R\.y/,'el motor observa la pose en CADA paso físico (120 Hz)');
});
test('Etapa B sigue sin puntuar: el motor no referencia al evaluador, no calcula puntos y sus registros no llevan campos de puntaje; el evaluador no tiene ruta de escritura al simulador',()=>{
 const eng=fs.readFileSync(path.join(root,'firvi-competition.js'),'utf8');
 assert.ok(!/BITIRO_FIRVI_SCORING|evaluateRound|POINTS/.test(eng.replace(/\/\*[\s\S]*?\*\//g,'')),'el motor no importa ni llama al evaluador');
 const rr=realRound(SWEEPER(true),{seconds:25});rr.s.finishRound('captain');
 const json=JSON.stringify(rr.s.rounds[0].events)+JSON.stringify(rr.s.rounds[0].faults)+JSON.stringify(rr.s.rounds[0].overcome);
 assert.ok(!/"(points|score|puntaje|puntos|pts)"/.test(json),'sin puntos en los hechos del motor');
 const ev_=fs.readFileSync(path.join(root,'firvi-scoring.js'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 assert.ok(!/BITIRO_SIM_ADAPTER|placeRobot|hardReset|setObstaclesRemoved|stopProgram|BITIRO_COMPETITION/.test(ev_),'el evaluador no tiene acceso al adaptador ni al motor');
 assert.ok(!/document\.|\.style\./.test(ev_));
});

test('la prueba de recorrido autónomo completo ya no está pendiente: se conserva como comprobación mínima del motor y la validación integral con el evaluador vive en tests/firvi-integral.cjs',()=>{
 const f=path.join(__dirname,'pending','firvi-full-autonomous-run.cjs'),src=fs.readFileSync(f,'utf8');
 assert.match(src,/Estado: ACTIVADA/);assert.match(src,/FIRVI_E2E/);assert.match(src,/reference-program\.iroh/);
 const out=require('node:child_process').execFileSync(process.execPath,[f],{encoding:'utf8',env:{...process.env,FIRVI_E2E:''}});
 assert.match(out,/^OMITIDA/);
 assert.ok(fs.existsSync(path.join(__dirname,'firvi-integral.cjs'))&&fs.existsSync(path.join(__dirname,'integration','reference-program.iroh')));
});

console.log(`\n${n} comprobaciones de Etapa C en orden`);
