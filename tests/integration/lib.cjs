/* FIRVI-2025 · Integración autónoma: utilidades de las pruebas de aislamiento y de la ronda completa.
   El HARNESS (esta librería) sí conoce la geometría de la pista —para colocar al robot en una aproximación válida y para medir—; el PROGRAMA de referencia
   (reference-program.iroh) solo usa sus sensores, el sonar, el servo y el tiempo. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {load}=require('../sim1/harness.cjs');
const EXTRA=['line-geometry.js','firvi-2025.js','firvi-competition.js','firvi-scoring.js'];
const ID={A:'firvi-2025',B:'firvi-2025-b'};
const PROGRAM_FILE=path.join(__dirname,'reference-program.iroh');
const readProgram=(f=PROGRAM_FILE)=>fs.readFileSync(f,'utf8');
const F=load({}).js('LINE_SENSOR.geometry.front');   // barra de sensores por delante del eje: la del robot efectivo (HEAD-CANVAS: 6 cm; no se fija aquí)
function geometry(h,k){const t=h.ctx.BITIRO_TRACKS[ID[k]],SC=h.ctx.BITIRO_FIRVI_SCORING,R=SC.routeOf({...t,competition:t.competitionSpec});return {SC,R,track:t};}
const at=(R,s)=>{const p=R.pts;let i=1;while(i<p.length-1&&p[i].s<s)i++;const a=p[i-1],b=p[i],f=Math.max(0,Math.min(1,(s-a.s)/((b.s-a.s)||1)));return {x:a.x+f*(b.x-a.x),y:a.y+f*(b.y-a.y),h:Math.atan2(b.y-a.y,b.x-a.x)};};
function nearestS(R,x,y){let best=null;for(let i=1;i<R.pts.length;i++){const a=R.pts[i-1],b=R.pts[i],dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1e-9))),d=Math.hypot(x-a.x-u*dx,y-a.y-u*dy);if(!best||d<best.d)best={d,s:a.s+u*(b.s-a.s)};}return best;}
/* Pose del robot (centro y rumbo) con la barra de sensores sobre la línea en s, con desvío lateral (cm, + = izquierda) y de rumbo (grados). */
function poseAt(R,s,lat=0,dHead=0){const q=at(R,s),hd=q.h+dHead*Math.PI/180;const px=q.x-lat*Math.sin(q.h),py=q.y+lat*Math.cos(q.h);return {x:px-F*Math.cos(hd),y:py-F*Math.sin(hd),h:hd};}
/* Prueba de aislamiento: el programa corre solo (sin motor de competencia) desde una pose dada. */
function trial({parked=-1,k='A',program=readProgram(),startS,lat=0,dHead=0,seconds=40,press=true,obstacles=true,untilS=null,onTick=null}){
  const h=load({extraFiles:EXTRA,storage:obstacles?{}:{['bitiro:standalone:scenario:v1:'+ID[k]]:'[]'}});
  h.js(`changeTrack('${ID[k]}')`);
  const g=geometry(h,k),p=poseAt(g.R,startS,lat,dHead);
  h.el('src').value=program;
  h.js(`start()`);
  h.js(`R.x=${p.x};R.y=${p.y};R.th=${p.h+Math.PI/2};previousPose={x:R.x,y:R.y,th:R.th,angle:0}`);
  if(parked!==null)h.js(`striker.angle=striker.target=IROH_MECHANICS.commandAngle(${parked})`);   // llega con la garra aparcada, como tras setup()
  let pressed=false,t=0;const step=1/120;
  for(;t<seconds;t+=step){
   h.js('update(1/120)');
   if(press&&!pressed&&t>2){h.js('pressTouchSensor(1)');pressed=true;}
   if(onTick&&Math.round(t*120)%12===0)onTick(h,t,g);
   if(h.js('mode')!=='code')break;
  }
  const x=h.js('R.x'),y=h.js('R.y'),th=h.js('R.th'),hd=th-Math.PI/2,n=nearestS(g.R,x+F*Math.cos(hd),y+F*Math.sin(hd));
  const phys=h.js('BITIRO_PHYSICS_LOG()'),ob=h.ctx.BITIRO_SIM_ADAPTER.obstacles();
  const obs=ob.map(o=>{const poly=o.poly,p0=o.poly0;return {id:o.id,movedCm:+Math.hypot(o.x-o.x0,o.y-o.y0).toFixed(1),clearCm:+g.SC.distPolyRoute(poly,g.R).toFixed(1),originClearCm:+g.SC.distPolyRoute(p0,g.R).toFixed(1)};});
  return {h,g,t:+t.toFixed(1),mode:h.js('mode'),x:+x.toFixed(1),y:+y.toFixed(1),headDeg:Math.round(hd*180/Math.PI),s:+n.s.toFixed(0),offLineCm:+n.d.toFixed(1),obs,
   contacts:phys.filter(e=>e.kind==='contact').length,sweeps:phys.filter(e=>e.kind==='sweep').length,pushes:phys.filter(e=>e.kind==='push').length,physics:phys,collisions:h.js('collisionCount')};
}
module.exports={EXTRA,ID,F,load,readProgram,PROGRAM_FILE,geometry,at,nearestS,poseAt,trial};
