/* MOTOR-DYNAMICS-1 · Sonda reproducible de dinámica de rueda y bang-bang de UN sensor.
   Solo mide; no modifica el producto. 240 %/s sigue siendo SIMULATION ASSUMPTION (sin calibrar contra IROH físico).
   CLI:  node tests/sim1/motor-probe.cjs   (imprime respuesta de motor + matriz bang-bang) */
'use strict';
const {load,FIXED_DT}=require('./harness.cjs');

// Programa del caso de regresión: UN sensor central, sin memoria, retardo, histéresis ni PID.
const bangBang=(V,thr,pol)=>`void setup(){inicializarMovimiento();inicializarSensores();} void loop(){ if(leerSensorLineaCentral()>${thr}){${pol==='A'?`avanzar(${V},0)`:`avanzar(0,${V})`};}else{${pol==='A'?`avanzar(0,${V})`:`avanzar(${V},0)`};} }`;

// Sigue el óvalo (centro 50,70; línea x=86 en y=70, ancho 2.6). pose: x inicial, th=0 (norte).
function runBangBang({V,thr=500,pol='A',x=84.7,seconds=30}){
 const h=load();h.js("changeTrack('oval')");h.program(bangBang(V,thr,pol));
 h.js(`R.x=${x};R.y=70;R.th=0`);
 const path=h.js('BITIRO_TRACKS.oval.paths[0].p');
 const dist=(px,py)=>{let m=Infinity;for(let i=0;i<path.length-1;i++){const [ax,ay]=path[i],[bx,by]=path[i+1],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));m=Math.min(m,Math.hypot(px-ax-t*dx,py-ay-t*dy));}return m;};
 const ticks=Math.round(seconds/FIXED_DT);let prevSide=null,transitions=0,prevAng=Math.atan2(70-70,x-50),ang=0,maxDist=0,lapTime=null;
 for(let i=1;i<=ticks;i++){
  h.js('update(1/120)');
  const side=h.js('readLine(1)')>thr;if(prevSide!==null&&side!==prevSide)transitions++;prevSide=side;
  const px=h.js('R.x'),py=h.js('R.y');let a=Math.atan2(py-70,px-50),d=a-prevAng;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;ang+=d;prevAng=a;
  maxDist=Math.max(maxDist,dist(px,py));
  if(lapTime===null&&Math.abs(ang)>=2*Math.PI)lapTime=i*FIXED_DT;
  if(h.js('mode')!=='code')break;
 }
 const t=h.js('simTime'),dd=h.js('runDistance');
 return {V,thr,pol,x,seconds:t,distanceCm:dd,meanSpeed:dd/t,progressDeg:Math.abs(ang)*180/Math.PI,transitions,maxDistFromLine:maxDist,lapTime,mode:h.js('mode')};
}

// Respuesta de una rueda: fija R.L/R.R directamente (sin programa) y mide tick a tick.
function wheelTrace(from,to,ticks=200){
 const h=load();h.js("changeTrack('s01')");h.program('void setup(){inicializarMovimiento();} void loop(){}');
 h.js(`R.L=${from[0]};R.R=${from[1]};wheel.left=${from[0]};wheel.right=${from[1]}`);
 h.js(`R.L=${to[0]};R.R=${to[1]}`);
 const out=[{L:from[0],R:from[1],th:h.js('R.th')}];
 for(let i=0;i<ticks;i++){h.js('update(1/120)');out.push({L:h.js('wheel.left'),R:h.js('wheel.right'),th:h.js('R.th')});}
 return out;
}
module.exports={runBangBang,wheelTrace,bangBang};

if(require.main===module){
 const t90=(tr,tgt,from)=>{const i=tr.findIndex(s=>Math.abs(s.L-tgt)<1e-9);return i<0?null:i*FIXED_DT;};
 console.log('# Respuesta de motor (una rueda)');
 for(const V of [15,25,35,50]){const up=wheelTrace([0,0],[V,V]),dn=wheelTrace([V,V],[0,0]);
  console.log(`0→${V}: ${t90(up,V).toFixed(4)} s | ${V}→0: ${t90(dn,0).toFixed(4)} s | pendiente ${(V/t90(up,V)).toFixed(1)} vs ${(V/t90(dn,0)).toFixed(1)} %/s`);}
 const tr=wheelTrace([50,0],[0,50]),dth=i=>((tr[i].th-tr[0].th)*180/Math.PI).toFixed(2);
 const cross=tr.findIndex(s=>s.L<s.R),endR=tr.findIndex(s=>s.L===0&&s.R===50);
 console.log('(50,0)→(0,50): [L,R] cada 10 ticks:',tr.filter((s,i)=>i%10===0&&i<=50).map(s=>`[${s.L.toFixed(1)},${s.R.toFixed(1)}]`).join(' '));
 console.log(`  ω=(L-R)/100·23/12 rad/s: inicio ${((50-0)/100*23/12).toFixed(3)}, final ${((0-50)/100*23/12).toFixed(3)}; cambio de signo (L<R) en tick ${cross} (${(cross*FIXED_DT).toFixed(4)} s), θ girado hasta ese tick ${dth(cross)}°`);
 console.log(`  rampa completa en tick ${endR} (${(endR*FIXED_DT).toFixed(4)} s); θ total girado ${dth(endR)}°`);
 console.log('\n# Bang-bang 1 sensor, óvalo, 30 s simulados');
 for(const pol of ['A','B'])for(const x of [84.7,87.3])for(const thr of [390,500])for(const V of [15,25,35,50]){
  const r=runBangBang({V,thr,pol,x});
  console.log(`pol=${pol} x0=${x} thr=${thr} V=${V}: dist=${r.distanceCm.toFixed(1)} cm, v̄=${r.meanSpeed.toFixed(2)} cm/s, prog=${r.progressDeg.toFixed(0)}°, trans=${r.transitions}, maxDist=${r.maxDistFromLine.toFixed(1)} cm, vuelta=${r.lapTime?r.lapTime.toFixed(1)+' s':'no'}, mode=${r.mode}`);}
}
