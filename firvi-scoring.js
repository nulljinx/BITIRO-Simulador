/* BITIRO Simulador · FIRVI 2025 · Etapa C: EVALUADOR (puntuación por hito).
   Módulo SIN DOM, sin reloj y sin acceso al simulador: `evaluateRound(roundRecord, context)` es una función PURA de hechos ya observados.
   Entradas (todas de solo lectura, copiadas por el motor de competencia al terminar o consultar la ronda):
     · round.events        — hechos de la máquina de estados (run-begin, program-started, room-overcome, reposition, …), con simTime y seq
     · round.physics       — BITIRO_PHYSICS_LOG(): touch / sweep / push / contact
     · round.interaction   — BITIRO_INTERACTION_LOG(): gate-wait / gate-pass (botonInicio) y lecturas del Pulsador
     · round.trace         — BITIRO_TRACE_LOG(): pose, los tres sensores físicos y qué sensores CONSULTÓ el programa, a 20 Hz
     · round.obstacleState — posición de origen y final de cada obstáculo
     · decisiones del juez — libro append-only, separado del historial (jamás reescribe la ronda)
   El evaluador NO mueve al robot, ni toca el escenario, los sensores o los obstáculos; si cambian los umbrales no cambia la física.

   Cada hito devuelve: puntos, estado (validated-auto · validated-judge · pending · not-achieved · not-applicable), motivo y EVIDENCIA con procedencia.
   Regla general: si los hechos disponibles NO demuestran el criterio completo, el hito no se concede automáticamente; queda `pending` con
   `judgeRequired:true` (lo decide el juez) o `not-achieved` si los hechos lo refutan.

   FUENTES (Bases FIRVI 2025 V2): V.E.3 (abanico), V.F.3 (superación de un cuarto), V.F.7–14 (valores), V.F.15 (empates), V.G.1–2, VI.A.2 y VI.B.1 (clasificación). */
'use strict';
window.BITIRO_FIRVI_SCORING=(()=>{
 const POINTS=Object.freeze({touchStart:10,lineFollowing:50,obstacle:30,obstacleMax:2,room:Object.freeze({1:60,2:40,3:20}),gaps:30,finalTask:30});
 const ST=Object.freeze({AUTO:'validated-auto',JUDGE:'validated-judge',PENDING:'pending',NOT:'not-achieved',NA:'not-applicable'});
 /* Geometría de la barra de sensores: la del robot efectivo (LINE_SENSOR, calibration.js, que se carga después de este módulo: por eso se lee de forma perezosa).
    Sin LINE_SENSOR (evaluador puro en pruebas) se usa la geometría de referencia 8,0 / 1,9 cm; las pruebas indican qué variante evalúan.
    Una ronda REAL (forSession, ctx.requireGeometry) no tiene fallback: sin LINE_SENSOR el evaluador falla de forma explícita en vez de puntuar con una geometría ajena. */
 const effectiveSensor=()=>{const g=typeof LINE_SENSOR!=='undefined'&&LINE_SENSOR&&LINE_SENSOR.geometry;return g&&g.front>0&&g.spread>0?g:null;};
 const SENSOR=()=>effectiveSensor()||{front:8,spread:1.9};
 /* Umbrales de OBSERVACIÓN (no tocan la física). Provisionales: las bases no los fijan. */
 const PARAMS=Object.freeze({
  motionCm:0.5,            // desplazamiento mínimo del chasis respecto de la base para decir «se movió»
  displacementCm:2,        // desplazamiento mínimo atribuible al abanico (necesario, NO suficiente: además debe quedar libre la trayectoria)
  sweepMinDeg:10,          // recorrido mínimo del servo durante el golpe para llamarlo «abanico»
  clearanceCm:8.3,         // distancia mínima prisma ↔ eje de la línea para que el cuerpo del robot pase (= IROH_MECHANICS.spec.bodyRadius; la fija una prueba)
  get sensorFrontCm(){return SENSOR().front;},   // la barra de sensores va `front` cm por delante del centro: se lee de LINE_SENSOR.geometry (la geometría efectiva del robot; la fija una prueba)
  get tightCm(){return SENSOR().spread+1.6;},    // un sensor LEE la línea solo si está a ≤ 1 cm de su eje: con ±spread de separación, el centro de la barra queda a ≤ spread + 1 cm (+ 0,6 cm de holgura de muestreo a 20 Hz)
  gapLateralCm:4,          // dentro de un gap no hay cinta que leer: el centro de la barra debe seguir a ≤ 4 cm del eje del gap
  assocBackCm:3,assocAheadCm:14,   // ventana de asociación a la línea (NO evidencia: la evidencia exige lectura física del sensor + distancia ≤ tightCm)
  stepMaxCm:3,             // avance máximo entre dos muestras consecutivas a 20 Hz (el robot hace ≤ 1,2 cm; girando en el sitio el sensor hace ≤ 1,7 cm)
  blindMaxCm:6,            // tramo de línea que se puede PERDER y recuperar sin invalidar la continuidad (fuera de los gaps)
  headingMaxRad:1.75,      // rumbo máximo respecto de la tangente de la línea (≈ 100°): ir de reversa o de través no es seguir la línea
  seedPoseCm:5,seedLineCm:6,   // el segmento arranca en la pose autorizada y con la barra sobre la línea
  jumpCm:6,                // salto de pose entre muestras que NO es movimiento físico (a 20 Hz el robot avanza ≪ 6 cm)
  timeGapS:0.2,            // hueco de la traza (≥ 4 muestras perdidas): interrupción no explicada
  respErrCm:0.4,respNmin:12,respDeltaCmd:6,   // respuesta del mando al lado de la línea (ver `responsiveness`)
  startTolCm:6,endTolCm:16,planeTolCm:4,gapMarginCm:6,
  stopSpeedCmS:0.5,stopMinS:0.5
 });
 const PROVISIONAL=Object.freeze({
  touchFirstStart:'El inicio por tacto se evalúa sobre el PRIMER inicio del programa en el recorrido puntuable; un Pulsador ya presionado antes de iniciar el programa no acredita la activación.',
  lineFollowingJudge:'Las lecturas de sensores y la trayectoria no prueban «seguir la línea utilizando los tres sensores»: un programa podría leerlos y no usarlos. El evaluador refuta automáticamente (sensor jamás consultado, sin avance) pero la concesión de los 50 pts la valida el juez.',
  sweepFirstContact:'Un obstáculo puntúa cuando (1) su PRIMER desplazamiento lo causó el servo (abanico, ≥ '+PARAMS.sweepMinDeg+'° de recorrido), (2) el abanico lo desplazó ≥ '+PARAMS.displacementCm+' cm y (3) tras el abanico el prisma queda a ≥ '+PARAMS.clearanceCm+' cm del eje de la línea (el cuerpo del robot pasa) y así termina. Un empuje previo, un abanico simultáneo con avance, una liberación completada por empuje o la falta de posiciones registradas quedan PENDIENTES del juez; un contacto o empuje que no cumple no puntúa.',
  roomMapping:'CONFIRMADO por el usuario: «cuarto inicial» = el 1.º en el sentido del recorrido A o B; «cuarto intermedio» = el 2.º, sin puntuación independiente por número de intento (sus gaps —30 pts, criterio conjunto— y la tarea final —30 pts— viven ahí); «cuarto final» = el 3.º. El cuarto intermedio DEBE superarse para completar el recorrido: no se puede omitir.',
  roomProgression:'Cuarto superado = cruce físico continuo del plano (motor B) Y progresión por la línea en ese intento con evidencia FÍSICA: muestras en que un sensor leyó la cinta a ≤ '+PARAMS.tightCm+' cm de su eje, rumbo acorde, avance sin saltos, arranque en la pose autorizada, y mando de los motores que responde al lado de la línea (no basta consultar los sensores). Si falta cualquiera, queda pendiente del juez. La tolerancia lateral de 10 cm de la versión anterior se retiró: ya no es evidencia.',
  gapsJoint:'Gaps: 30 pts como criterio conjunto (los tres). Cada gap exige línea LEÍDA antes, recorrido recto del tramo ciego (≤ '+PARAMS.gapLateralCm+' cm del eje, rumbo acorde) y línea LEÍDA después, todo en UN mismo intento (segmento sin reposición); si los gaps se superaron en intentos distintos con reinicios, lo decide el juez.',
  finalTask:'La «intersección» de la tarea final no está identificada en las bases: el evaluador solo lista paradas candidatas en el cuarto intermedio; la tarea la valida el juez.',
  pointsAfterThird:'Sin puntos por superar un cuarto después del 3.er intento (V.F.14): se registra el hecho con 0 pts.',
  firstAttemptRule:'El intento de un cuarto es el que registró el motor de competencia al cruzar; reiniciar o contactar de nuevo no duplica puntos (cada hito se concede una sola vez).',
  tiebreakTime:'Tiempo de la ronda = duración (parada voluntaria u 8:00). También se informa el tiempo estimado del último punto; las bases (V.F.15) no dicen cuál de los dos desempata.',
  classification:'VI.A.2 (mejor ronda) contradice VI.B.1 (suma de rondas): se informan ambos y NO se declara ganador.'
 });

 /* ───────────────── geometría de referencia: trayectoria de la línea en el sentido del recorrido ───────────────── */
 const pushPt=(arr,x,y)=>{const l=arr[arr.length-1];if(!l||Math.hypot(l.x-x,l.y-y)>1e-9)arr.push({x,y});};
 function routeOf(track){
  const pieces=(track.paths||[]).filter(p=>p.role!=='transverse').map(p=>p.p.map(q=>({x:q[0],y:q[1]})));
  if(track.route==='B')pieces.reverse().forEach(p=>p.reverse());
  const pts=[],gaps=[];
  pieces.forEach((piece,i)=>{
   if(i>0){const a=pts[pts.length-1],b=piece[0];if(Math.hypot(a.x-b.x,a.y-b.y)>5)gaps.push({index:gaps.length+1,from:{x:a.x,y:a.y},to:{x:b.x,y:b.y},len:Math.hypot(a.x-b.x,a.y-b.y)});}
   piece.forEach(q=>pushPt(pts,q.x,q.y));
  });
  let s=0;pts.forEach((q,i)=>{if(i>0)s+=Math.hypot(q.x-pts[i-1].x,q.y-pts[i-1].y);q.s=s;});
  const at=(a,b)=>{const i=pts.findIndex(q=>Math.hypot(q.x-a.x,q.y-a.y)<1e-6);return i<0?null:pts[i].s;};
  gaps.forEach(g=>{g.s0=at(g.from);g.s1=at(g.to);});
  /* Tangente y curvatura firmada (rad/cm; + = gira a la izquierda del rumbo) de cada tramo, a ±6 cm: sirve para no confundir «sigue la curva» con «responde a los sensores». */
  const angAt=sv=>{let i=1;while(i<pts.length-1&&pts[i].s<sv)i++;const a=pts[Math.max(0,i-1)],b=pts[i];return Math.atan2(b.y-a.y,b.x-a.x);};
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  pts.forEach((q,i)=>{q.tan=i<pts.length-1?Math.atan2(pts[i+1].y-q.y,pts[i+1].x-q.x):(i>0?pts[i-1].tan:0);
   q.k=wrap(angAt(Math.min(s,q.s+6))-angAt(Math.max(0,q.s-6)))/Math.max(1,Math.min(s,q.s+6)-Math.max(0,q.s-6));});
  return {pts,len:s,gaps};
 }
 /* s (cm a lo largo de la línea) del primer punto cuyo x alcanza el plano en el sentido del recorrido. */
 function planeS(route,plane,dir){
  for(let i=1;i<route.pts.length;i++){const a=route.pts[i-1],b=route.pts[i];
   if(dir*(a.x-plane)<0&&dir*(b.x-plane)>=0){const f=(plane-a.x)/((b.x-a.x)||1);return a.s+f*(b.s-a.s);}}
  return null;
 }
 function nearest(route,x,y,sLo,sHi){
  const P=route.pts;let lo=0,hi=P.length-1;
  while(lo<hi){const m=(lo+hi)>>1;if(P[m+1].s<sLo)lo=m+1;else hi=m;}
  let best=null;
  for(let i=lo;i<P.length-1&&P[i].s<=sHi;i++){
   const a=P[i],b=P[i+1],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy||1e-12;
   let u=((x-a.x)*dx+(y-a.y)*dy)/l2;u=Math.max(0,Math.min(1,u));
   const px=a.x+u*dx,py=a.y+u*dy,d=Math.hypot(x-px,y-py);
   if(!best||d<best.d)best={d,s:a.s+u*(b.s-a.s),qx:px,qy:py,tan:a.tan,k:a.k};
  }
  return best;
 }
 const wrapAng=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const inGapS=(route,s)=>route.gaps.some(g=>s>=g.s0-.5&&s<=g.s1+.5);
 /* Progresión por la línea con EVIDENCIA FÍSICA. Una muestra solo AVANZA la cobertura si
     · fuera de un gap: un sensor leyó la cinta (hecho físico del simulador) Y la barra de sensores está a ≤ tightCm del eje de la línea Y el rumbo es el de la marcha;
     · dentro de un gap: la barra sigue a ≤ gapLateralCm del eje del gap con rumbo acorde (no hay cinta que leer).
   El avance se mide con la barra de sensores (8 cm por delante del centro), no con el centro del robot. Una pérdida de línea fuera de un gap se puede recuperar solo si
   la línea se retoma a ≤ blindMaxCm de donde se perdió; si no, queda un HUECO en la cobertura (recorte de curva, atajo paralelo, reposición no autorizada). Los trozos de línea
   no se «interpolan» con una tolerancia lateral: o hay lectura, o hay hueco. Un segmento nuevo se abre en cada reposición AUTORIZADA (evento del motor) y debe arrancar en la pose autorizada. */
 function progression(route,round){
  const trace=round.trace||[],evs=round.events||[];
  const repos=evs.filter(e=>e.type==='reposition').map(e=>({t:e.simTime,pose:e.pose||null})).sort((a,b)=>a.t-b.t);
  const cells=Math.ceil(route.len)+3,segments=[],jumps=[],F=PARAMS.sensorFrontCm;
  let seg=null,sCur=0,prev=null,ri=0,blind=false,blindT0=null;
  const open=(t0,expected)=>{seg={t0,expected,cover:new Uint8Array(cells),sMax:0,sStart:0,lostSamples:0,samples:0,unauthorizedJumps:0,timeGaps:0,seedOk:false,seedReason:'sin muestras',breaks:[],resp:[],maxBlindS:0};segments.push(seg);prev=null;blind=false;};
  const mark=(a,b)=>{const lo=Math.max(0,Math.floor(Math.min(a,b))),hi=Math.min(cells-1,Math.floor(Math.max(a,b)));for(let c=lo;c<=hi;c++)seg.cover[c]=1;};
  const startPose=round.run&&round.run.startPose;
  open(0,startPose?{x:startPose.x,y:startPose.y}:null);
  const seed=(smp,px,py,why)=>{
   const n=nearest(route,px,py,-1,route.len+1),ex=seg.expected;
   const poseOk=!!ex&&Math.hypot(smp.x-ex.x,smp.y-ex.y)<=PARAMS.seedPoseCm;
   seg.seedOk=poseOk&&!!n&&n.d<=PARAMS.seedLineCm;
   seg.seedReason=seg.seedOk?'':(!ex?'pose autorizada desconocida':!poseOk?'no arranca en la pose autorizada':'la barra de sensores no está sobre la línea al arrancar');
   if(n&&n.d<=PARAMS.seedLineCm+10){sCur=n.s;seg.sStart=n.s;if(seg.seedOk){mark(n.s,n.s);seg.sMax=Math.max(seg.sMax,n.s);}else seg.lostSamples++;blind=!seg.seedOk;blindT0=smp.t;}
   else{seg.lostSamples++;blind=true;blindT0=smp.t;}
  };
  for(const smp of trace){
   let reseed=false,authorized=false;
   while(ri<repos.length&&repos[ri].t<smp.t){if(repos[ri].t>=(prev?prev.t:-1)){open(repos[ri].t,repos[ri].pose?{x:repos[ri].pose.x,y:repos[ri].pose.y}:null);reseed=true;authorized=true;}ri++;}
   const px=smp.x+F*Math.cos(smp.h),py=smp.y+F*Math.sin(smp.h);
   if(prev&&smp.t-prev.t>PARAMS.timeGapS&&!reseed)seg.timeGaps++;
   if(prev&&Math.hypot(smp.x-prev.x,smp.y-prev.y)>PARAMS.jumpCm&&!reseed){jumps.push({t:smp.t,from:{x:prev.x,y:prev.y},to:{x:smp.x,y:smp.y}});seg.unauthorizedJumps++;reseed=true;}
   seg.samples++;
   if(!prev||reseed){
    if(!authorized&&prev){const n=nearest(route,px,py,-1,route.len+1);if(n&&n.d<=PARAMS.seedLineCm+10){sCur=n.s;blind=true;blindT0=smp.t;}else{blind=true;blindT0=smp.t;}seg.lostSamples++;}
    else seed(smp,px,py);
    prev=smp;continue;
   }
   const n=nearest(route,px,py,sCur-PARAMS.assocBackCm,sCur+PARAMS.assocAheadCm);
   const detected=smp.s.some(Boolean);
   let ok=false,gap=false;
   if(n){
    gap=inGapS(route,n.s);
    const headingOk=Math.abs(wrapAng(smp.h-n.tan))<=PARAMS.headingMaxRad;
    ok=headingOk&&(gap?n.d<=PARAMS.gapLateralCm:(detected&&n.d<=PARAMS.tightCm));
   }
   if(ok){
    const adv=n.s-sCur,limit=blind?PARAMS.blindMaxCm:PARAMS.stepMaxCm;
    if(adv>limit){seg.breaks.push({fromCm:Math.round(sCur),toCm:Math.round(n.s)});mark(n.s,n.s);sCur=n.s;}
    else if(adv>=0){mark(sCur,n.s);sCur=n.s;}
    seg.sMax=Math.max(seg.sMax,sCur);
    if(blind&&blindT0!=null)seg.maxBlindS=Math.max(seg.maxBlindS,smp.t-blindT0);
    blind=false;blindT0=null;
    if(!gap&&smp.l!==undefined&&smp.m!==undefined){
     const e=Math.cos(smp.h)*(n.qy-py)-Math.sin(smp.h)*(n.qx-px);    // + = la línea queda a la izquierda del rumbo
     seg.resp.push({s:n.s,e,u:smp.l-smp.m,cls:Math.abs(n.k)<.012?0:(n.k>0?1:-1)});
    }
   }else{
    seg.lostSamples++;if(!blind){blind=true;blindT0=smp.t;}
   }
   prev=smp;
  }
  return {segments,jumps};
 }
 const segmentAt=(prog,t)=>{let k=0;prog.segments.forEach((s,i)=>{if(s.t0<=t)k=i;});return prog.segments[k];};
 const trusted=seg=>seg.seedOk&&!seg.unauthorizedJumps&&!seg.timeGaps;
 /* ¿Todas las celdas de [a,b] están recorridas con evidencia en ese segmento? */
 function covered(seg,a,b){
  const lo=Math.max(0,Math.ceil(a)),hi=Math.floor(b);const missing=[];
  for(let c=lo;c<=hi;c++)if(!seg.cover[c]){const l=missing[missing.length-1];if(l&&l[1]===c-1)l[1]=c;else missing.push([c,c]);}
  return {ok:hi<lo?false:missing.length===0,missing,from:lo,to:hi};
 }
 /* Lo mismo sobre la UNIÓN de los segmentos fiables hasta el instante t (cada tramo ya fue validado por separado). */
 function coveredUnion(prog,t,a,b){
  const lo=Math.max(0,Math.ceil(a)),hi=Math.floor(b),missing=[],segs=prog.segments.filter(sg=>sg.t0<=t&&trusted(sg));
  for(let c=lo;c<=hi;c++)if(!segs.some(sg=>sg.cover[c])){const l=missing[missing.length-1];if(l&&l[1]===c-1)l[1]=c;else missing.push([c,c]);}
  return {ok:hi<lo?false:missing.length===0,missing,from:lo,to:hi};
 }
 /* ¿El mando de los motores RESPONDE al lado en que está la línea? Se compara, dentro de cada clase de curvatura (izquierda/recta/derecha), el mando medio (izq − der) con la línea a la
    izquierda frente a la línea a la derecha. Un programa que ignora los sensores (trayecto precalculado, tiempos fijos) da una diferencia ≈ 0 aunque sus sensores se «consulten» y
    su trayectoria coincida con la línea; el seguidor real da una diferencia grande y positiva. No prueba causalidad: es evidencia a favor; si no alcanza, decide el juez. */
 function responsiveness(seg,a,b){
  const by={},out={known:false,ok:false,classes:[]};
  for(const r of seg.resp){if(r.s<a||r.s>b||Math.abs(r.e)<PARAMS.respErrCm)continue;(by[r.cls]=by[r.cls]||{p:[],n:[]})[r.e>0?'p':'n'].push(r.u);}
  let sum=0,w=0;const mean=v=>v.reduce((x,y)=>x+y,0)/v.length;
  for(const [cls,g] of Object.entries(by)){
   if(g.p.length<PARAMS.respNmin||g.n.length<PARAMS.respNmin)continue;
   const d=mean(g.p)-mean(g.n),n=g.p.length+g.n.length;sum+=d*n;w+=n;out.classes.push({curvature:+cls,samples:n,deltaCmd:Math.round(d*10)/10});
  }
  if(!w)return out;
  out.known=true;out.deltaCmd=Math.round(sum/w*10)/10;out.ok=sum/w>=PARAMS.respDeltaCmd;return out;
 }
 /* Distancia (cm) entre dos polígonos convexos de un lado y un segmento: 0 si se tocan. Misma geometría que la física del golpe (strike-physics.js), sin depender de ella. */
 const inPoly=(px,py,poly)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
 const pSeg2=(px,py,ax,ay,bx,by)=>{const vx=bx-ax,vy=by-ay,den=vx*vx+vy*vy,t=den?Math.max(0,Math.min(1,((px-ax)*vx+(py-ay)*vy)/den)):0;return (px-ax-t*vx)**2+(py-ay-t*vy)**2;};
 const cr=(ax,ay,bx,by)=>ax*by-ay*bx;
 function distSegPoly(a,b,poly){
  if(inPoly(a.x,a.y,poly)||inPoly(b.x,b.y,poly))return 0;
  let best=Infinity;
  for(let i=0;i<poly.length;i++){
   const c=poly[i],d=poly[(i+1)%poly.length];
   const d1=cr(b.x-a.x,b.y-a.y,c[0]-a.x,c[1]-a.y),d2=cr(b.x-a.x,b.y-a.y,d[0]-a.x,d[1]-a.y),d3=cr(d[0]-c[0],d[1]-c[1],a.x-c[0],a.y-c[1]),d4=cr(d[0]-c[0],d[1]-c[1],b.x-c[0],b.y-c[1]);
   if(d1*d2<0&&d3*d4<0)return 0;
   best=Math.min(best,pSeg2(a.x,a.y,c[0],c[1],d[0],d[1]),pSeg2(b.x,b.y,c[0],c[1],d[0],d[1]),pSeg2(c[0],c[1],a.x,a.y,b.x,b.y),pSeg2(d[0],d[1],a.x,a.y,b.x,b.y));
  }
  return Math.sqrt(best);
 }
 const distPolyRoute=(poly,route)=>{let best=Infinity;for(let i=1;i<route.pts.length;i++)best=Math.min(best,distSegPoly(route.pts[i-1],route.pts[i],poly));return best;};

 /* ───────────────── utilidades ───────────────── */
 const pct=x=>Math.round(x*1000)/10;
 const roomPoints=attempt=>POINTS.room[attempt]||0;
 const ordinal=n=>n+'.º';
 function mk(id,label,max,extra={}){return {id,label,max,points:0,status:ST.PENDING,source:'none',judgeRequired:false,reason:'',attempt:null,achievedSimTime:null,evidence:{},provenance:[],potential:0,auto:null,judge:null,...extra};}
 const auto=(m,pts,reason,more={})=>Object.assign(m,{points:pts,status:ST.AUTO,source:'auto',reason,potential:0},more);
 const refuted=(m,reason,more={})=>Object.assign(m,{points:0,status:ST.NOT,source:'auto',reason,potential:0},more);
 const pending=(m,reason,{judge=false,potential=0}={})=>Object.assign(m,{points:0,status:ST.PENDING,source:'none',reason,judgeRequired:judge,potential});

 /* ───────────────── hitos ───────────────── */
 function touchStart(r,ctx){
  const m=mk('touch-start','Inicio por sensor de tacto',POINTS.touchStart);
  const ev=r.events||[],rb=ev.find(e=>e.type==='run-begin'),ps=rb&&ev.find(e=>e.type==='program-started');
  m.provenance=['round.events:program-started','physics:touch','interaction:gate-wait/gate-pass/button-read','trace:pose'];
  if(!rb)return ctx.final?refuted(m,'La ronda terminó sin recorrido puntuable.'):pending(m,'Aún no comienza el recorrido puntuable.');
  if(!ps)return ctx.final?refuted(m,'El programa no se inició en el recorrido puntuable.'):pending(m,'Esperando que se inicie el programa.');
  const S=ps.seq,phys=r.physics||[],inter=r.interaction||[],tr=r.trace||[],p0=(r.run&&r.run.startPose)||{x:tr[0]?tr[0].x:0,y:tr[0]?tr[0].y:0};
  const press=phys.find(e=>e.kind==='touch'&&e.detail==='press'&&e.seq>S);
  const heldBefore=phys.some(e=>e.kind==='touch'&&e.detail==='press'&&e.seq<S);
  const moved=smp=>Math.hypot(smp.x-p0.x,smp.y-p0.y)>PARAMS.motionCm;
  const firstMove=tr.find(moved);
  m.evidence={programStartSeq:S,pressSimTime:press?press.t:null,firstMotionSimTime:firstMove?firstMove.t:null,pressedBeforeProgram:heldBefore};
  if(!press){
   if(firstMove)return refuted(m,'El robot se movió sin que se activara el Pulsador después de iniciar el programa.'+(heldBefore?' (El Pulsador ya estaba presionado antes de iniciar: no acredita la activación.)':''),{provisionalRef:'touchFirstStart'});
   return ctx.final?refuted(m,'No se activó el Pulsador tras iniciar el programa.'+(heldBefore?' (Estaba presionado antes de iniciar.)':'')):pending(m,'Esperando la activación del Pulsador tras iniciar el programa.');
  }
  const gateWait=inter.find(e=>e.kind==='gate-wait'&&e.seq>S&&e.seq<press.seq),gatePass=inter.find(e=>e.kind==='gate-pass'&&e.seq>press.seq);
  const read0=inter.find(e=>e.kind==='button-read'&&e.detail===0&&e.seq>S&&e.seq<press.seq),read1=inter.find(e=>e.kind==='button-read'&&e.detail===1&&e.seq>press.seq);
  const viaGate=!!(gateWait&&gatePass),viaPoll=!!(read0&&read1);
  const movedBefore=tr.some(smp=>smp.t<=press.t&&moved(smp));
  m.evidence.waitedForButton=viaGate?'botonInicio':viaPoll?'leerBoton':null;m.evidence.movedBeforePress=movedBefore;
  if(movedBefore)return refuted(m,'El robot ya se movía cuando se activó el Pulsador: el movimiento no depende del tacto.',{provisionalRef:'touchFirstStart'});
  if(!viaGate&&!viaPoll)return ctx.final?refuted(m,'El Pulsador se activó, pero el programa no lo esperaba (ni botonInicio ni leerBoton antes de la activación): evento aislado.',{provisionalRef:'touchFirstStart'}):pending(m,'Pulsador activado: falta ver que el programa continúe por esa activación.');
  return auto(m,POINTS.touchStart,'El programa esperó el Pulsador ('+(viaGate?'botonInicio()':'leerBoton()')+'), se activó y solo entonces continuó; el robot no se movió antes.',{achievedSimTime:press.t,provisionalRef:'touchFirstStart'});
 }

 function lineFollowing(r,ctx,prog,route){
  const m=mk('line-following','Seguimiento de línea con tres sensores',POINTS.lineFollowing,{judgeRequired:true});
  m.provenance=['trace:r (sensores consultados por el programa)','trace:s (lectura física)','trace:pose','progresión por la línea'];
  const tr=(r.trace||[]);let mask=0;for(const s of tr)mask|=s.r;
  const reads=['izquierdo','central','derecho'].map((n,k)=>({sensor:n,consulted:!!(mask&(1<<k))}));
  const on=tr.filter(s=>s.s.some(Boolean)).length,best=prog.segments.reduce((a,s)=>Math.max(a,s.sMax-s.sStart),0);
  const lineCells=route.len-route.gaps.reduce((a,g)=>a+g.len,0);
  m.evidence={sensorsConsulted:reads,samples:tr.length,samplesWithAnySensorOnLine:on,onLineRatio:tr.length?pct(on/tr.length)/100:0,
   progressAlongLinePct:pct(Math.min(1,best/route.len)),faults:(r.faults||[]).length,unauthorizedJumps:prog.jumps.length,lineLengthCm:Math.round(lineCells)};
  if(ctx.final){
   const miss=reads.filter(x=>!x.consulted).map(x=>x.sensor);
   if(!tr.length||best<PARAMS.motionCm)return refuted(m,'El robot no avanzó por la línea.');
   if(miss.length)return refuted(m,'El programa nunca consultó el sensor '+miss.join(' ni ')+' durante el recorrido: no usa los tres sensores.');
  }
  return pending(m,(ctx.final?'Los tres sensores fueron consultados y el robot avanzó '+m.evidence.progressAlongLinePct+' % de la línea, pero eso no prueba que el seguimiento se base en ellos: ':'En curso. ')+'lo valida el juez ('+'V.F.8 / V.G.1).',{judge:true,potential:POINTS.lineFollowing});
 }

 const obstacleLabel=id=>{const k=/room(\d)/.exec(id);return 'Obstáculo '+(k?'del cuarto '+k[1]:'«'+id+'»')+' (abanico)';};
 const shift=(poly,dx,dy)=>poly.map(q=>[q[0]+dx,q[1]+dy]);
 /* Obstáculos. Un obstáculo puntúa SOLO con evidencia de las tres cosas que pide V.E.3: (1) barrido del servo, (2) desplazamiento físico atribuible a ese barrido y
    (3) trayectoria liberada. Cada desplazamiento se atribuye con la posición que registró el simulador ANTES y DESPUÉS de cada hecho (from/to), no con la posición final. */
 function obstacles(r,ctx,route){
  const out=[];
  const state=r.obstacleState&&r.obstacleState.length?r.obstacleState:null,ids=state?state.map(o=>o.id):(ctx.obstacleIds||[]);
  const phys=r.physics||[];
  if(r.obstacles==='remove'){return ids.map(id=>Object.assign(mk('obstacle:'+id,obstacleLabel(id),0),{status:ST.NA,reason:'Obstáculos retirados antes de la ronda (V.E.2): no hay puntaje asociado.'}));}
  const items=ids.map(id=>{
   const m=mk('obstacle:'+id,obstacleLabel(id),POINTS.obstacle);
   m.provenance=['physics:sweep/push (posición antes/después de cada hecho)','obstacleState (origen, final y polígono)','geometría de la línea (trayectoria liberada)'];
   const o=state&&state.find(x=>x.id===id),disp=o?Math.hypot(o.x-o.x0,o.y-o.y0):null;
   const evs=phys.filter(e=>e.id===id&&(e.kind==='sweep'||e.kind==='push')).sort((a,b)=>a.seq-b.seq),first=evs[0]||null;
   const sweeps=evs.filter(e=>e.kind==='sweep'),pushes=evs.filter(e=>e.kind==='push');
   m.evidence={displacementCm:disp===null?null:Math.round(disp*10)/10,firstDisplacingEvent:first?{kind:first.kind,simTime:first.t,servoFrom:first.servo,servoTo:first.servoTo}:null,sweeps:sweeps.length,pushes:pushes.length};
   const settle=(fn)=>ctx.final?fn():pending(m,'Abanico en curso: aún no se demuestra el desplazamiento y la trayectoria liberada.');
   if(!first){ctx.final?refuted(m,'El obstáculo no fue desplazado.'):pending(m,'El obstáculo aún no fue desplazado.');return m;}
   if(first.kind==='push'){refuted(m,'El primer desplazamiento fue un empuje (push) con la garra fija, no un movimiento de abanico (V.E.3).',{provisionalRef:'sweepFirstContact'});return m;}
   m.provisionalRef='sweepFirstContact';
   const judge=reason=>{pending(m,reason,{judge:true,potential:POINTS.obstacle});return m;};
   if(!first.from||!first.to)return judge('El registro del golpe no trae la posición del obstáculo antes y después: no se puede atribuir el desplazamiento al abanico. Lo decide el juez.');
   // prefijo de abanico: hechos de barrido anteriores a cualquier empuje
   const firstPush=pushes[0]||null,prefix=sweeps.filter(e=>!firstPush||e.seq<firstPush.seq),lastSweep=prefix[prefix.length-1];
   const origin=first.from,afterSweep=lastSweep.to,sweepDisp=Math.hypot(afterSweep.x-origin.x,afterSweep.y-origin.y);
   const travel=prefix.reduce((a,e)=>Math.max(a,Math.abs((e.servoTo??e.servo)-e.servo)),0);
   const overlap=pushes.some(p=>sweeps.some(sw=>p.t<=sw.until&&sw.t<=p.until));
   m.evidence.sweep={servoTravelDeg:travel,displacedBySweepCm:Math.round(sweepDisp*10)/10,pushedAfterwards:pushes.length>0,sweepAndDriveOverlap:overlap};
   const canGeo=!!(o&&o.poly0&&Number.isFinite(o.x0)&&route);
   if(!canGeo)return judge('No hay polígono del prisma registrado: no se puede demostrar que la trayectoria quedó libre. Lo decide el juez.');
   const clr=pos=>distPolyRoute(shift(o.poly0,pos.x-o.x0,pos.y-o.y0),route);
   const dOrigin=clr({x:o.x0,y:o.y0}),dSweep=clr(afterSweep),dFinal=clr({x:o.x,y:o.y});
   m.evidence.trajectory={onRouteAtOriginCm:Math.round(dOrigin*10)/10,afterSweepCm:Math.round(dSweep*10)/10,finalCm:Math.round(dFinal*10)/10,requiredCm:PARAMS.clearanceCm,blockedAtOrigin:dOrigin<PARAMS.clearanceCm};
   if(sweepDisp<PARAMS.displacementCm)return settle(()=>{refuted(m,'El abanico tocó el obstáculo pero lo desplazó solo '+m.evidence.sweep.displacedBySweepCm+' cm (< '+PARAMS.displacementCm+' cm): contacto, no retirada.');return m;})&&m;
   if(travel<PARAMS.sweepMinDeg)return judge('El obstáculo se movió con un recorrido del servo de solo '+travel+'° (< '+PARAMS.sweepMinDeg+'°): no es demostrable que sea un abanico. Lo decide el juez.');
   if(overlap)return judge('El abanico coincidió en el tiempo con el avance del robot (empuje simultáneo): no se puede separar qué movió el obstáculo. Lo decide el juez.');
   const clearSweep=dSweep>=PARAMS.clearanceCm,clearFinal=dFinal>=PARAMS.clearanceCm;
   if(clearSweep&&clearFinal){
    m.achievedSimTime=lastSweep.until;m.sweepOrder=first.seq;m.auto={status:ST.AUTO};return m;
   }
   if(clearSweep&&!clearFinal)return judge('El abanico liberó la trayectoria, pero el obstáculo terminó otra vez a '+m.evidence.trajectory.finalCm+' cm de la línea (< '+PARAMS.clearanceCm+' cm). Lo decide el juez.');
   if(clearFinal)return judge('El abanico lo dejó a '+m.evidence.trajectory.afterSweepCm+' cm de la línea (< '+PARAMS.clearanceCm+' cm) y la liberación se completó con empuje: no es atribuible solo al abanico. Lo decide el juez.');
   return settle(()=>{refuted(m,'El abanico lo desplazó '+m.evidence.sweep.displacedBySweepCm+' cm pero el obstáculo sigue a '+m.evidence.trajectory.finalCm+' cm del eje de la línea (< '+PARAMS.clearanceCm+' cm): la trayectoria no quedó libre.',{provisionalRef:'sweepFirstContact'});return m;})&&m;
  });
  const winners=items.filter(m=>m.auto).sort((a,b)=>a.sweepOrder-b.sweepOrder);
  winners.forEach((m,i)=>{
   if(i<POINTS.obstacleMax)auto(m,POINTS.obstacle,'Abanico del servo ('+m.evidence.firstDisplacingEvent.servoFrom+'° → '+m.evidence.firstDisplacingEvent.servoTo+'°) desplazó el prisma '+m.evidence.sweep.displacedBySweepCm+' cm y la trayectoria quedó libre (a '+m.evidence.trajectory.finalCm+' cm de la línea).',{auto:null});
   else refuted(m,'Excede el máximo de '+POINTS.obstacleMax+' obstáculos puntuables.',{auto:null});
  });
  return items;
 }

 const respText=x=>x.known?'mando que responde al lado de la línea (Δ '+x.deltaCmd+')':'sin muestras suficientes para comprobar si el mando responde a los sensores';
 function room(id,label,which,r,ctx,prog,route){
  const m=mk(id,label,POINTS.room[1]);
  m.provenance=['round.events:room-overcome / end-reached','round.attempts','progresión por la línea (lectura física de los sensores)','trace:saltos de pose, huecos, arranque','trace:mando de motores'];
  const sp=ctx.spec,dir=sp.direction;
  let fact,sa,sb,tolA,tolB;
  if(which==='initial'){fact=(r.overcome||{})[1];sa=0;sb=planeS(route,sp.planes[0],dir);tolA=PARAMS.startTolCm;tolB=PARAMS.planeTolCm;}
  else{fact=r.endReached;sa=planeS(route,sp.planes[1],dir);sb=route.len;tolA=0;tolB=PARAMS.endTolCm;}
  if(!fact)return ctx.final?refuted(m,which==='initial'?'El robot no cruzó el plano de salida del cuarto inicial en recorrido puntuable.':'El robot no llegó a la base final en recorrido puntuable.'):pending(m,'Aún no se supera el cuarto.');
  const attempt=fact.attempt,t=fact.simTime,seg=segmentAt(prog,t),cov=covered(seg,sa+tolA,sb-tolB),resp=responsiveness(seg,sa+tolA,sb-tolB);
  m.attempt=attempt;m.achievedSimTime=t;m.achievedClockMs=fact.clockMs;
  m.evidence={attempt,planeCrossedSimTime:t,progression:{requiredFromCm:Math.round(sa+tolA),requiredToCm:Math.round(sb-tolB),continuous:cov.ok,missingCm:cov.missing.map(x=>[x[0],x[1]]).slice(0,6),breaks:seg.breaks.slice(0,6),maxBlindS:Math.round(seg.maxBlindS*10)/10},
   seed:{ok:seg.seedOk,reason:seg.seedReason},unauthorizedJumpsInAttempt:seg.unauthorizedJumps,traceGapsInAttempt:seg.timeGaps,sensorResponse:resp};
  const why=[];
  if(!seg.seedOk)why.push('el intento no arranca en una pose autorizada sobre la línea ('+seg.seedReason+')');
  if(seg.unauthorizedJumps)why.push('hubo saltos de pose no autorizados (posible reubicación manual)');
  if(seg.timeGaps)why.push('la traza tiene huecos de tiempo (interrupción sin explicar)');
  if(!cov.ok)why.push('la progresión por la línea no es continua con lectura de los sensores (faltan tramos); cruzar el plano no basta (V.F.3)');
  if(which==='final'){
   const mid=coveredUnion(prog,t,planeS(route,sp.planes[0],dir)+PARAMS.planeTolCm,sa-PARAMS.planeTolCm);
   m.evidence.middleRoom={overcome:!!(r.overcome||{})[2],continuous:mid.ok,missingCm:mid.missing.map(x=>[x[0],x[1]]).slice(0,6)};
   if(!(r.overcome||{})[2])why.push('no consta que el cuarto intermedio se superara (no se puede omitir)');
   else if(!mid.ok)why.push('el cuarto intermedio no se recorrió de forma continua con lectura de los sensores');
  }
  if(!why.length&&!resp.known)why.push('no hay muestras suficientes para comprobar que el programa usa los sensores (el mando de los motores no se pudo comparar con el lado de la línea)');
  else if(!why.length&&!resp.ok)why.push('el mando de los motores NO responde al lado de la línea (Δ '+resp.deltaCmd+'): el programa parece ignorar los sensores aunque los consulte');
  if(why.length)return pending(m,'Cruzó el plano, pero '+why.join('; ')+'. Lo valida el juez.',{judge:true,potential:roomPoints(Math.min(attempt,4))});
  if(attempt>3)return refuted(m,'Cuarto superado en el intento '+attempt+': sin puntaje después del 3.er intento (V.F.14).',{provisionalRef:'pointsAfterThird',achievedWithoutPoints:true});
  m.max=POINTS.room[1];
  return auto(m,roomPoints(attempt),'Progresión continua con lectura física de la línea, '+respText(resp)+' y salida del cuarto en el intento '+attempt+' ('+roomPoints(attempt)+' pts).',{provisionalRef:'roomProgression'});
 }

 function gaps(r,ctx,prog,route){
  const m=mk('gaps','Superación de gaps (criterio conjunto)',POINTS.gaps);
  m.provenance=['progresión por la línea','trace:s (línea leída antes y después)','trace:saltos de pose y huecos','reposiciones autorizadas'];
  const per=route.gaps.map(g=>{
   const a=g.s0-PARAMS.gapMarginCm,b=g.s1+PARAMS.gapMarginCm,by=[];
   prog.segments.forEach((seg,i)=>{if(trusted(seg)&&covered(seg,a,b).ok)by.push(i);});
   return {gap:g.index,fromCm:Math.round(g.s0),toCm:Math.round(g.s1),lengthCm:Math.round(g.len*10)/10,traversedContinuously:by.length>0,attempts:by};
  });
  const n=per.filter(x=>x.traversedContinuously).length,all=n===per.length&&per.length>0;
  const oneSeg=all&&prog.segments.map((_,i)=>i).some(i=>per.every(x=>x.attempts.includes(i)));
  const dirty=prog.jumps.length>0||prog.segments.some(sg=>sg.timeGaps||!sg.seedOk&&sg.samples>0);
  m.evidence={gaps:per,traversed:n,of:per.length,inSingleAttempt:oneSeg,segments:prog.segments.length};
  if(oneSeg)return auto(m,POINTS.gaps,'Los '+n+' gaps se recorrieron en un mismo intento: línea leída antes, tramo recto sin cinta y línea leída después.',{provisionalRef:'gapsJoint'});
  if(all)return pending(m,'Los '+n+' gaps se superaron, pero en intentos distintos con reinicios: las bases no dicen si el criterio conjunto admite eso. Lo decide el juez.',{judge:true,potential:POINTS.gaps,provisionalRef:'gapsJoint'});
  if(ctx.final){
   if(dirty&&n>0)return pending(m,'Gaps incompletos ('+n+' de '+per.length+') y la traza tiene saltos, huecos o un arranque no verificado: no se puede refutar. Lo decide el juez.',{judge:true,potential:POINTS.gaps,provisionalRef:'gapsJoint'});
   return refuted(m,'Gaps incompletos: '+n+' de '+per.length+' recorridos con línea leída antes y después (criterio conjunto).',{provisionalRef:'gapsJoint'});
  }
  return pending(m,'En curso: '+n+' de '+per.length+' gaps recorridos.');
 }

 function finalTask(r,ctx){
  const m=mk('final-task','Detención y baile final',POINTS.finalTask,{judgeRequired:true});
  m.provenance=['trace:pose (paradas candidatas)','«intersección» sin identificar en las bases'];
  const sp=ctx.spec,dir=sp.direction,tr=r.trace||[];
  const inMiddle=p=>dir*(p.x-sp.planes[0])>=0&&dir*(p.x-sp.planes[1])<0;
  const cands=[];let run=null;
  const flush=()=>{if(run&&run.last.t-run.first.t>=PARAMS.stopMinS)cands.push({simTime:run.first.t,durationS:Math.round((run.last.t-run.first.t)*10)/10,x:Math.round(run.first.x*10)/10,y:Math.round(run.first.y*10)/10});run=null;};
  for(let i=1;i<tr.length;i++){
   const a=tr[i-1],b=tr[i],v=Math.hypot(b.x-a.x,b.y-a.y)/Math.max(1e-6,b.t-a.t),rot=Math.abs(b.h-a.h);
   if(inMiddle(b)&&v<=PARAMS.stopSpeedCmS&&rot<0.02){if(!run)run={first:a,last:b};else run.last=b;}else flush();
  }
  flush();
  m.evidence={intersectionIdentified:false,candidateStopsInMiddleRoom:cands.slice(0,8),note:'Parada candidata ≠ cumplimiento: sin intersección oficial el evaluador no puede decir que se detuvo «en la intersección».'};
  const reached=!!(r.overcome||{})[1];
  if(!reached&&ctx.final)return refuted(m,'El robot no llegó al cuarto intermedio.');
  return pending(m,'La «intersección» de la tarea final no está identificada en las bases: lo valida el juez.',{judge:true,potential:POINTS.finalTask});
 }

 /* ───────────────── juez ───────────────── */
 /* Decisiones: libro append-only. Una decisión nueva sobre el mismo hito reemplaza a la anterior EN LA VISTA, no en el libro; `clear` devuelve la vista al evaluador automático. */
 function createJudgeBook({isFinal=()=>true,now=()=>0}={}){
  const entries=[];
  const latest=(round,id)=>{for(let i=entries.length-1;i>=0;i--)if(entries[i].round===round&&entries[i].milestone===id)return entries[i];return null;};
  function decide(round,milestone,verdict,{attempt=null,note='',judge='Juez'}={}){
   if(!['award','deny','clear'].includes(verdict))return {ok:false,reason:'Decisión no válida.'};
   if(!isFinal(round))return {ok:false,reason:'El juez asigna los puntajes después de cada ronda (VI.A.1): la ronda aún no ha terminado.'};
   if(verdict==='award'&&/^room-/.test(milestone)&&!(Number.isInteger(attempt)&&attempt>=1))return {ok:false,reason:'Indica el intento (1.º, 2.º, 3.º…) en que se superó el cuarto.'};
   const e=Object.freeze({seq:entries.length+1,round,milestone,verdict,attempt,note:String(note||''),judge,at:now()});
   entries.push(e);return {ok:true,entry:e};
  }
  return Object.freeze({decide,latest,all:()=>entries.slice()});
 }
 function applyJudge(m,entry){
  if(!entry||entry.verdict==='clear')return m;
  const a={status:m.status,points:m.points,reason:m.reason};
  m.auto=a;m.judge={verdict:entry.verdict,attempt:entry.attempt,note:entry.note,judge:entry.judge,seq:entry.seq};m.source='judge';m.judgeRequired=false;m.potential=0;
  if(entry.verdict==='deny'){m.status=ST.NOT;m.points=0;m.reason='El juez no concede el hito'+(entry.note?': '+entry.note:'.');return m;}
  let pts=m.max;
  if(/^room-/.test(m.id)){const at=m.attempt||entry.attempt;m.attempt=m.attempt||at;pts=roomPoints(at);if(entry.attempt)m.attempt=entry.attempt,pts=roomPoints(entry.attempt);}
  if(m.status===ST.NA)return m;
  m.status=ST.JUDGE;m.points=pts;m.reason='Validado por el juez'+(entry.note?': '+entry.note:'.')+(pts===0?' (sin puntaje: intento > 3, V.F.14).':'');
  return m;
 }

 /* ───────────────── ronda ───────────────── */
 function evaluateRound(round,ctx0){
  const ctx={final:false,...ctx0};
  if(!round)return null;
  if(ctx.requireGeometry&&!effectiveSensor())throw new Error('FIRVI: falta la geometría efectiva de LINE_SENSOR; no se puntúa la ronda con una geometría de reserva.');
  const final=!!ctx.final,spec=ctx.spec,route=ctx.route||routeOf(ctx.track),prog=progression(route,round);
  const c={...ctx,final,spec,route};
  const ms=[touchStart(round,c),lineFollowing(round,c,prog,route),...obstacles(round,c,route),room('room-initial','Cuarto inicial','initial',round,c,prog,route),gaps(round,c,prog,route),finalTask(round,c),room('room-final','Cuarto final','final',round,c,prog,route)];
  // El juez puede decidir sobre cualquier hito, sobre los hechos ya observados; nunca modifica la ronda.
  const judge=ctx.judgeBook;
  ms.forEach(m=>{if(judge)applyJudge(m,judge.latest(round.number,m.id));});
  const confirmed=ms.reduce((a,m)=>a+((m.status===ST.AUTO||m.status===ST.JUDGE)?m.points:0),0);
  const potential=ms.reduce((a,m)=>a+(m.status===ST.PENDING?m.potential:0),0);
  const maxPossible=(()=>{let t=POINTS.touchStart+POINTS.lineFollowing+POINTS.gaps+POINTS.finalTask+2*POINTS.room[1];const obs=ms.filter(m=>/^obstacle:/.test(m.id)&&m.status!==ST.NA).length;return t+Math.min(obs,POINTS.obstacleMax)*POINTS.obstacle;})();
  const rawEnd=round.endClock!=null&&round.startClock!=null?round.endClock-round.startClock:null;
  const durationMs=rawEnd==null?null:Math.min(ctx.limitMs||480000,rawEnd);
  const rb=(round.events||[]).find(e=>e.type==='run-begin');
  const approxClock=m=>m.achievedClockMs!=null?m.achievedClockMs:(rb&&m.achievedSimTime!=null?Math.round(rb.clockMs+(m.achievedSimTime-rb.simTime)*1000):null);
  const scored=ms.filter(m=>(m.status===ST.AUTO||m.status===ST.JUDGE)&&m.points>0&&m.achievedSimTime!=null).map(approxClock).filter(x=>x!=null);
  return {
   round:round.number,final,finishedBy:round.finishedBy||null,obstacles:round.obstacles,
   milestones:ms,total:confirmed,pendingPotential:potential,maxPossible,
   timeMs:durationMs,lastPointClockMsApprox:scored.length?Math.max(...scored):null,
   pendingCriteria:ms.filter(m=>m.status===ST.PENDING&&m.judgeRequired).map(m=>({id:m.id,label:m.label,reason:m.reason})),
   integrity:{unauthorizedJumps:prog.jumps.length,traceGaps:prog.segments.reduce((a,sg)=>a+sg.timeGaps,0),unverifiedStarts:prog.segments.filter(sg=>sg.samples>0&&!sg.seedOk).length},
   provisional:PROVISIONAL
  };
 }

 /* Resumen de las dos rondas. NO declara ganador (clasificación contradictoria en las bases). */
 function summarize(results){
  const done=results.filter(Boolean);
  const finals=done.filter(r=>r.final);
  const best=finals.length?finals.slice().sort((a,b)=>b.total-a.total||(a.timeMs??Infinity)-(b.timeMs??Infinity))[0]:null;
  const pend=done.reduce((a,r)=>a+r.pendingCriteria.length,0);
  return {
   rounds:done.map(r=>({round:r.round,final:r.final,total:r.total,timeMs:r.timeMs,pendingPotential:r.pendingPotential,pendingCriteria:r.pendingCriteria.length})),
   bestRound:best?{round:best.round,total:best.total,timeMs:best.timeMs}:null,
   sumOfRounds:finals.reduce((a,r)=>a+r.total,0),
   sumTime:finals.reduce((a,r)=>a+(r.timeMs||0),0),
   complete:finals.length>=2,pendingJudgeItems:pend,
   officialWinner:null,
   notes:[PROVISIONAL.classification,PROVISIONAL.tiebreakTime,pend?'Hay '+pend+' criterio(s) pendiente(s) de validación del juez: los totales son provisionales.':'Sin criterios pendientes.']
  };
 }

 /* Evaluador de una SESIÓN de competencia: solo lee la sesión; el libro del juez es suyo. */
 function forSession(session,opts={}){
  const track=session.track,spec=track.competition,route=routeOf(track);
  const idsOf=()=>{const props=(window.BITIRO_SCENARIO_PROPS||{})[track.id]||[];return props.map(p=>p.id);};
  const book=opts.judgeBook||createJudgeBook({isFinal:n=>session.rounds.some(r=>r.number===n),now:opts.now});
  const ctx=(final)=>({final,spec,route,track,obstacleIds:idsOf(),judgeBook:book,limitMs:480000,requireGeometry:true});
  return {
   judge:book,route,
   round:n=>{const done=session.rounds.find(r=>r.number===n);if(done)return evaluateRound(done,ctx(true));
    const cur=session.round;if(cur&&cur.number===n&&session.state!=='finished'&&typeof session.liveRound==='function')return evaluateRound(session.liveRound(),ctx(false));return null;},
   summary(){const out=[1,2].map(n=>this.round(n));return {results:out,...summarize(out)};}
  };
 }

 return Object.freeze({POINTS,ST,PARAMS,PROVISIONAL,routeOf,planeS,progression,responsiveness,distPolyRoute,evaluateRound,summarize,createJudgeBook,forSession});
})();
