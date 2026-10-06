/* node tests/track-reference/import-tracks.cjs [--check]
   TRACK-DIGITIZE-1 · Importa los candidatos aprobados (sim-candidate/sNN.json) a tracks.js (S01, S02) y extra-tracks.js (S03–S08).
   Separación conceptual:  TRACK = geometría impresa · SCENARIO PROP = caja/obstáculo en el mundo · DEFAULT START = pose cómoda al cargar
   · CURRICULUM = objetivos (fuera del core). Aquí el TRACK nunca lleva obstáculos y el start de S03/S06/S08 se DERIVA de la centerline.
   Con --check no escribe: falla si lo versionado difiere de lo que se generaría. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'..','..'),CAND=path.join(__dirname,'sim-candidate');
const FRONT=6,SPREAD=2.8,BODY_R=8.3,CLEAR=0.5; // calibration.js · strike-physics.js
const cand=id=>JSON.parse(fs.readFileSync(`${CAND}/${id}.json`,'utf8'));
const round=v=>+v.toFixed(3);
function segDist(t,x,y){let b=1e9;for(const p of t.paths){const q=p.p;for(let i=1;i<q.length;i++){const a=q[i-1],c=q[i],vx=c[0]-a[0],vy=c[1]-a[1],den=vx*vx+vy*vy,u=den?Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/den)):0;b=Math.min(b,Math.hypot(x-a[0]-u*vx,y-a[1]-u*vy)-p.w/2);}}return b;}
const blend=d=>Math.max(0,Math.min(1,(1.05-d)/1.7));
/* x de la centerline (path que cruza y) → pose con heading −π/2 */
function onLineAtY(t,y){for(const p of t.paths)for(let i=1;i<p.p.length;i++){const a=p.p[i-1],b=p.p[i];if((a[1]-y)*(b[1]-y)<=0&&a[1]!==b[1])return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);}throw new Error('sin cruce en y='+y);}
function zoneTop(t){return Math.min(...[...t.markers].filter(m=>/start/.test(m.kind)).map(m=>m.y));}
function derive(id,t){
 if(id==='s03'){ // punto más bajo de la centerline del lazo; heading = tangente local (sentido del path)
  const p=t.paths[0].p;let k=0;for(let i=1;i<p.length-1;i++)if(p[i][1]>p[k][1])k=i;
  const a=p[k-1],b=p[k+1];return {x:round(p[k][0]),y:round(p[k][1]),heading:round(Math.atan2(b[1]-a[1],b[0]-a[0])),official:false,
   basis:'Pose inicial de práctica derivada de la centerline (punto más bajo del lazo, heading = tangente local). El plotter S03 NO define salida oficial; no es un dato curricular.'};}
 // S04/S05/S06/S08: sobre la centerline, justo por encima de la zona roja inferior sin que el cuerpo (r=8.3) la toque
 const y=Math.floor((zoneTop(t)-BODY_R-CLEAR)*10)/10;
 const lab=id==='s04'||id==='s05';
 return {x:round(onLineAtY(t,y)),y,heading:round(-Math.PI/2),official:false,
  basis:lab?'Default de práctica: el start del Lab hacía solapar el cuerpo (r=8,3) con la zona roja inferior; se sube sobre la centerline oficial el mínimo necesario (cuerpo a ≥'+CLEAR+' cm de la zona). No es una salida oficial.'
   :'Default de práctica (provisional): el Lab marca esta pista «pendiente de validación». Sobre la centerline, cuerpo a ≥'+CLEAR+' cm de la zona roja inferior. No es una salida oficial.'};
}
function check(id,t){const s=t.start,errs=[];
 const fx=s.x+FRONT*Math.cos(s.heading),fy=s.y+FRONT*Math.sin(s.heading);
 if(!(blend(segDist(t,fx,fy))>0.5))errs.push('sensor central no ve la línea');
 if(!(s.x-BODY_R>=.35&&s.y-BODY_R>=.35&&s.x+BODY_R<=t.w-.35&&s.y+BODY_R<=t.h-.35))errs.push('cuerpo fuera de la hoja');
 for(const z of [...t.zones,...t.markers]){const xx=Math.max(z.x,Math.min(s.x,z.x+z.width)),yy=Math.max(z.y,Math.min(s.y,z.y+z.height));const d=Math.hypot(s.x-xx,s.y-yy);if(d<BODY_R+CLEAR-1e-9)errs.push(`cuerpo solapa/roza ${z.id} (${d.toFixed(2)} cm)`);}
 if(segDist(t,s.x,s.y)>0.5)errs.push('centro del robot a '+segDist(t,s.x,s.y).toFixed(2)+' cm del borde de la línea');
 assert.deepEqual(errs,[],id+': '+errs.join('; '));}
/* Etiqueta descriptiva de cada trazo impreso (solo nombra la geometría; la demostración visual la usa para elegir su ruta). */
const ROLES={s01:{p01_pdf74:'stem',p02_pdf75:'arc'},s02:{p02_pdf80:'stem',p00_pdf78:'branch-center',p01_pdf79:'arc'},
 s04:{p02_pdf74:'trunk',p01_pdf74:'trunk',p00_pdf0:'trunk'},
 s05:{p08_pdf479:'trunk',p07_pdf479:'trunk',p02_pdf80:'trunk',p00_pdf78:'branch-center',p01_pdf79:'arc',p09_pdf481:'stub',p10_pdf482:'stub'},
 s08:{p02_pdf74:'trunk',p01_pdf74:'trunk',p00_pdf74:'trunk',p08_pdf85:'trunk'}};
function trackOf(id){const c=cand(id);
 const t={id,name:c.name,w:c.w,h:c.h,paths:c.paths.map(p=>({id:p.id,...(ROLES[id]&&ROLES[id][p.id]?{role:ROLES[id][p.id]}:{}),w:p.w,p:p.p})),zones:c.zones,markers:c.markers,obstacles:[]};
 if(c.boxSlots&&c.boxSlots.length)t.boxSlots=c.boxSlots.map(({x,y,width,height})=>({x,y,width,height})); // posiciones señaladas por el material; NO son cajas
 if(c.gapsPdf&&c.gapsPdf.length)t.gaps=c.gapsPdf.map(({x,y,width,height})=>({x,y,width,height}));
 if(['s03','s04','s05','s06','s08'].includes(id))t.start=derive(id,t);else t.start={x:c.start.x,y:c.start.y,heading:c.start.heading};
 t.startInfo={official:['s03','s04','s05','s06','s08'].includes(id)?false:true,basis:t.start.basis||c.startBasis};delete t.start.basis;delete t.start.official;
 t.source=c.source;t.official=true;
 if(!t.startInfo.official)check(id,t);
 if(id==='s04'||id==='s05'){const o=c.start,n=t.start;t.startInfo.previous={x:o.x,y:o.y,heading:round(o.heading)};t.startInfo.displacementCm=round(Math.hypot(n.x-o.x,n.y-o.y));
  t.startInfo.bodyZoneClearanceCm=round(Math.min(...t.markers.filter(m=>/start/.test(m.kind)).map(z=>{const xx=Math.max(z.x,Math.min(n.x,z.x+z.width)),yy=Math.max(z.y,Math.min(n.y,z.y+z.height));return Math.hypot(n.x-xx,n.y-yy)-BODY_R;})));}
 return t;}
const js=o=>JSON.stringify(o);
/* ---- tracks.js: sustituye s01 y s02, conserva oval/ocho ---- */
const tracksSrc=fs.readFileSync(path.join(ROOT,'tracks.js'),'utf8');
const ctx={window:{}};require('vm').runInNewContext(tracksSrc,ctx);const all=JSON.parse(JSON.stringify(ctx.window.BITIRO_TRACKS));
const next={s01:trackOf('s01'),s02:trackOf('s02'),oval:all.oval,ocho:all.ocho};
const props={s01:[{id:'practice-box',x:46,y:94,width:8,height:8,movable:true,official:false}]};
const tracksOut=`/* Geometrías autocontenidas. S01 y S02: plotters oficiales reconstruidos desde los PDF vectoriales (TRACK-DIGITIZE-1, tests/track-reference/).
   TRACK = geometría impresa · SCENARIO PROP = objeto colocado en el mundo (BITIRO_SCENARIO_PROPS) · DEFAULT START = pose al cargar. */
window.BITIRO_TRACKS=${js(next)};
/* Props de escenario: NO forman parte de la pista impresa ni son datos oficiales. La caja de práctica de S01 conserva su pose histórica
   (46, 94) solo para no alterar la física del golpe; está pendiente de migrar a un sistema de props configurables. */
window.BITIRO_SCENARIO_PROPS=${js(props)};
`;
/* ---- extra-tracks.js ---- */
const extra={};for(const id of ['s03','s04','s05','s06','s08'])extra[id]=trackOf(id);
const header=`/* BITIRO · Plotters oficiales S03–S06 y S08 reconstruidos desde los PDF vectoriales (TRACK-DIGITIZE-1; datos en tests/track-reference/,
   regenerar con tests/track-reference/import-tracks.cjs). Centerlines, anchos, gaps y zonas son del PDF; el start de S03/S06/S08 es una
   pose de práctica derivada, NO un dato oficial. S07 (Repaso) no tiene plotter propio: es una superficie neutra sin geometría oficial.
   TRACK = geometría impresa · SCENARIO PROP = caja/obstáculo en el mundo · DEFAULT START = pose al cargar · CURRICULUM = fuera del core. */
`;
const extraOut=`${header}'use strict';
(()=>{
 const T=window.BITIRO_TRACKS;
 Object.assign(T,${js(extra)});
 T.s07={id:'s07',name:'S07 · Repaso · sin pista propia',w:100,h:140,paths:[],zones:[],markers:[],obstacles:[],start:{x:50,y:70,heading:-Math.PI/2},
  startInfo:{official:false,basis:'Superficie neutra de práctica.'},official:false,neutral:true,
  source:'Repaso · sin plotter oficial',note:'Repaso · sin plotter oficial: superficie vacía, sin línea ni zonas. Elige cualquier otra pista para practicar.'};
 // En circuitos cerrados de práctica, salir tangente a la línea permite que los sensores delanteros la vean desde el inicio.
 for(const id of ['oval','ocho']){
  const t=T[id],points=t.paths[0].p,a=points[0],b=points[1];
  t.start={...t.start,heading:Math.atan2(b[1]-a[1],b[0]-a[0])};
 }
})();
`;
if(process.argv.includes('--check')){assert.equal(fs.readFileSync(path.join(ROOT,'tracks.js'),'utf8'),tracksOut,'tracks.js desincronizado');assert.equal(fs.readFileSync(path.join(ROOT,'extra-tracks.js'),'utf8'),extraOut,'extra-tracks.js desincronizado');console.log('OK');}
else{fs.writeFileSync(path.join(ROOT,'tracks.js'),tracksOut);fs.writeFileSync(path.join(ROOT,'extra-tracks.js'),extraOut);
 for(const id of ['s03','s06','s08'])console.log(id,JSON.stringify(extra[id].start));}
