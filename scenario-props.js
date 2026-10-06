/* BITIRO · Scenario props: objetos físicos del escenario (cajas), separados de la pista.
   TRACK            = geometría impresa (tracks.js / extra-tracks.js)
   DEFAULT SCENARIO = objetos sugeridos al abrir una pista (window.BITIRO_SCENARIO_PROPS, tracks.js)
   USER SCENARIO    = configuración libre guardada por el usuario, una por pista
   ACTIVE WORLD     = copia física que usa simulator.js durante una ejecución (activeObstacles)
   Este módulo es lógica pura + persistencia: no conoce el DOM. No impone rutas, bases ni objetos obligatorios.
   Persistencia: clave inexistente → predeterminado · «[]» → escenario vacío elegido por el usuario · array con cajas → personalizado. */
'use strict';
window.BITIRO_SCENARIO=(()=>{
 const SIZE=8,ID_PREFIX='user-box-',KEY_PREFIX='bitiro:standalone:scenario:v1:';
 const session=new Map();                       // respaldo en memoria si el navegador no permite guardar
 const MECH=()=>window.IROH_MECHANICS;
 const key=id=>KEY_PREFIX+id;
 const round=v=>Math.round(v*10)/10;            // 0,1 cm: valores legibles y deterministas
 const finite=v=>typeof v==='number'&&Number.isFinite(v);

 /* ── modelo ─────────────────────────────────────────────────────────────────────── */
 function normalizeBox(b){
  if(!b||typeof b!=='object'||typeof b.id!=='string'||b.id===''||!finite(b.x)||!finite(b.y))return null;
  const out={id:b.id,x:round(b.x),y:round(b.y),width:SIZE,height:SIZE,movable:b.movable!==false};
  if(typeof b.official==='boolean')out.official=b.official;
  return out;
 }
 function normalize(list){
  const seen=new Set(),out=[];
  if(!Array.isArray(list))return out;
  for(const raw of list){const b=normalizeBox(raw);if(b&&!seen.has(b.id)){seen.add(b.id);out.push(b);}}
  return out;
 }
 const clone=list=>normalize(list);
 const defaults=trackId=>normalize((window.BITIRO_SCENARIO_PROPS||{})[trackId]||[]);
 function nextId(list){
  const used=new Set(list.map(b=>b.id));let n=1;
  while(used.has(ID_PREFIX+n))n++;
  return ID_PREFIX+n;
 }

 /* ── validación física: reutiliza IROH_MECHANICS (una sola física de colisión) ───── */
 const startPose=track=>({x:track.start.x,y:track.start.y,th:track.start.heading+Math.PI/2});
 /* null = válida; si no, texto breve. `others` = resto de cajas del escenario. */
 function placementError(box,others,track){
  const M=MECH(),pose=startPose(track);
  if(!M.insideArena(box,track))return 'La caja queda fuera de los límites de la pista.';
  if(others.some(o=>o.id!==box.id&&M.boxBox(box,o)))return 'La caja se superpone con otra caja.';
  if(M.bodyOverlapsBox(pose,box))return 'La caja se superpone con el robot en su posición inicial.';
  if(M.barOverlapsBox(pose,0,box))return 'La caja atraviesa el mecanismo de golpe en su posición inicial.';
  return null;
 }
 /* Devuelve solo las cajas físicamente válidas (un valor guardado manipulado o antiguo no rompe la simulación). */
 function usable(list,track){
  const out=[];
  for(const b of normalize(list))if(placementError(b,out,track)===null)out.push(b);
  return out;
 }

 /* ── operaciones sobre un borrador (puras: devuelven una lista nueva) ─────────────── */
 function addBox(list,track,x,y){
  const box={id:nextId(list),x:round(x),y:round(y),width:SIZE,height:SIZE,movable:true};
  const reason=placementError(box,list,track);
  return reason?{ok:false,reason,list}:{ok:true,box,list:[...list,box]};
 }
 function moveBox(list,track,id,x,y){
  const cur=list.find(b=>b.id===id);if(!cur)return {ok:false,reason:'La caja no existe.',list};
  if(!finite(x)||!finite(y))return {ok:false,reason:'Escribe una posición en centímetros.',list};
  const next={...cur,x:round(x),y:round(y)},reason=placementError(next,list,track);
  return reason?{ok:false,reason,list}:{ok:true,box:next,list:list.map(b=>b.id===id?next:b)};
 }
 const removeBox=(list,id)=>list.filter(b=>b.id!==id);
 /* Primera posición libre buscando desde el centro de la hoja (acceso por teclado: no hay que apuntar con el cursor). */
 function firstFreeSpot(list,track){
  const cx=track.w/2-SIZE/2,cy=track.h/2-SIZE/2,cand=[];
  for(let y=.5;y<=track.h-SIZE-.5;y+=2)for(let x=.5;x<=track.w-SIZE-.5;x+=2)cand.push([x,y]);
  cand.sort((a,b)=>Math.hypot(a[0]-cx,a[1]-cy)-Math.hypot(b[0]-cx,b[1]-cy)||a[1]-b[1]||a[0]-b[0]);
  for(const [x,y] of cand){const r=addBox(list,track,x,y);if(r.ok)return r;}
  return {ok:false,reason:'No hay espacio libre para otra caja.',list};
 }

 /* ── persistencia ───────────────────────────────────────────────────────────────── */
 const store=()=>window.BITIRO_STORAGE;
 function load(trackId,track){
  let raw=null;try{raw=store().get(key(trackId));}catch{raw=null;}
  let list=null,custom=false;
  if(raw!==null&&raw!==undefined){try{const parsed=JSON.parse(raw);if(Array.isArray(parsed)){list=normalize(parsed);custom=true;}}catch{/* corrupto → predeterminado */}}
  if(list===null&&session.has(trackId)){list=clone(session.get(trackId));custom=true;}
  if(list===null)list=defaults(trackId);
  return {list:track?usable(list,track):list,custom};
 }
 /* Devuelve true si quedó guardado en el navegador; false si solo se conserva en esta sesión. */
 function save(trackId,list){
  const clean=normalize(list);
  let ok=false;try{ok=!!store().set(key(trackId),JSON.stringify(clean));}catch{ok=false;}
  if(ok)session.delete(trackId);else session.set(trackId,clean);
  return ok;
 }
 function reset(trackId){
  session.delete(trackId);
  try{store().remove(key(trackId));}catch{/* sin almacenamiento: nada que borrar */}
 }
 return {SIZE,key,normalize,clone,defaults,nextId,placementError,usable,addBox,moveBox,removeBox,firstFreeSpot,load,save,reset};
})();
