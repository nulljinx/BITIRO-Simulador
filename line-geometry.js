/* BITIRO Simulador · Fuente geométrica ÚNICA del trazo con extremos planos (cinta real: el extremo de la cinta es recto).
   La usan el sensor de línea (simulator.js → closestSegment) y el renderer (renderer3d.js) de las pistas con `capStyle:'butt'` (FIRVI 2025),
   de modo que lo que el usuario ve y lo que lee el sensor es el MISMO conjunto de puntos: cada segmento es un rectángulo del ancho de la cinta;
   las uniones interiores de una polilínea (curvas muestreadas) llevan un disco de radio ½ ancho para no abrir cuñas; los dos extremos libres
   del trazo quedan planos. Las pistas S01–S08, Óvalo y Ocho no declaran `capStyle` y siguen con el modelo anterior (tapa redonda) sin cambio. */
'use strict';
window.BITIRO_LINE_GEOMETRY=(()=>{
 const DISC_SIDES=32;
 /* Distancia con signo (cm) del punto (px,py) al trazo `path` {w,p:[[x,y]…]}: negativa dentro, 0 en el borde. */
 function pathDistance(path,px,py){
  const pts=path.p,hy=path.w/2;let best=Infinity;
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],vx=b[0]-a[0],vy=b[1]-a[1],len=Math.hypot(vx,vy);
   if(len<1e-12)continue;
   const ux=vx/len,uy=vy/len,dx=px-(a[0]+b[0])/2,dy=py-(a[1]+b[1])/2,u=dx*ux+dy*uy,v=-dx*uy+dy*ux;
   const ox=Math.abs(u)-len/2,oy=Math.abs(v)-hy;
   best=Math.min(best,ox>0||oy>0?Math.hypot(Math.max(ox,0),Math.max(oy,0)):Math.max(ox,oy));
  }
  for(let i=1;i<pts.length-1;i++)best=Math.min(best,Math.hypot(px-pts[i][0],py-pts[i][1])-hy);   // uniones interiores redondeadas
  return best;
 }
 const distance=(paths,px,py)=>paths.reduce((m,p)=>Math.min(m,pathDistance(p,px,py)),Infinity);
 /* Polígonos (cm del plano de pista) cuya unión es exactamente el trazo: un rectángulo por segmento y un disco por unión interior. */
 function polygons(path){
  const out=[],pts=path.p,hy=path.w/2;
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-12)continue;
   const nx=-(b[1]-a[1])/len*hy,ny=(b[0]-a[0])/len*hy;
   out.push([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]);
  }
  for(let i=1;i<pts.length-1;i++){
   const disc=[];for(let k=0;k<DISC_SIDES;k++){const t=2*Math.PI*k/DISC_SIDES;disc.push([pts[i][0]+hy*Math.cos(t),pts[i][1]+hy*Math.sin(t)]);}
   out.push(disc);
  }
  return out;
 }
 return Object.freeze({DISC_SIDES,pathDistance,distance,polygons});
})();
