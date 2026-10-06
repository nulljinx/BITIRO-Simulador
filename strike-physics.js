/* BITIRO · Mecanismo de golpe y colisión 2D en centímetros del plano de pista.
   Una sola especificación física compartida entre simulación, pruebas y escena 3D. */
'use strict';
window.IROH_MECHANICS = (() => {
 const spec = Object.freeze({
  pivotForward: 8.6, pivotRight: 0, length: 13.2,
  halfWidth: .52, bottomHeight: 5.18, topHeight: 6.32,
  servoBodyHeight: 4.4, sonarHeight: 15.1,
  // El ángulo del brazo se mide en GRADOS respecto del eje delantero del robot: 0° = centro, positivo = derecha DEL ROBOT.
  // API real del servo (KnightRoboticsLibs_Iroh): −1→165°, 0→90°, +1→15°; tomando 90° como eje delantero: −75°, 0°, +75°.
  minAngleDeg: -75, centerAngleDeg: 0, maxAngleDeg: 75,
  angularRateDeg: 190,   // velocidad angular del modelo v4 (95 comandos/s × 2°); sin medición real que la sustituya
  subStepDeg: 1.1,       // resolución del barrido continuo (≈ 0,55 comandos × 2° del modelo anterior)
  bodyRadius: 8.3,
 });
 // Posición pedagógica del servo (−1/0/+1) → ángulo físico interno. Es la ÚNICA traducción; null = valor no admitido.
 const POSITION_ANGLE=Object.freeze({'-1':-75,'0':0,'1':75});
 const commandAngle=cmd=>(typeof cmd==='number'&&Object.prototype.hasOwnProperty.call(POSITION_ANGLE,String(cmd)))?POSITION_ANGLE[String(cmd)]:null;
 const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
 const basis=pose=>({f:{x:Math.sin(pose.th),y:-Math.cos(pose.th)},r:{x:Math.cos(pose.th),y:Math.sin(pose.th)}});
 const worldPoint=(pose,f,r)=>{const b=basis(pose);return {x:pose.x+b.f.x*f+b.r.x*r,y:pose.y+b.f.y*f+b.r.y*r};};
 const sweepAngle=angleDeg=>angleDeg*Math.PI/180;
 function segment(pose,angleDeg){
  const a=sweepAngle(angleDeg),p=worldPoint(pose,spec.pivotForward,spec.pivotRight);
  return [p,worldPoint(pose,spec.pivotForward+spec.length*Math.cos(a),spec.pivotRight+spec.length*Math.sin(a))];
 }
 // Liang–Barsky: centro de la barra barrido frente a AABB expandida por el
 // grosor del palo. Usamos < y EPS para no tratar las superficies tangentes
 // como penetración. El contacto se detecta asimismo con la separación real.
 function barOverlapsBox(pose,angleDeg,ob,pad=spec.halfWidth){
  const height=ob.visualHeightCm??15.6;
  if(height < spec.bottomHeight+1e-6 || spec.topHeight < -.45)return false;
  const [a,b]=segment(pose,angleDeg),loX=ob.x-pad,hiX=ob.x+ob.width+pad,loY=ob.y-pad,hiY=ob.y+ob.height+pad;
  let lo=0,hi=1;
  for(const [p,d,min,max] of [[a.x,b.x-a.x,loX,hiX],[a.y,b.y-a.y,loY,hiY]]){
   if(Math.abs(d)<1e-10){if(p<=min+1e-7||p>=max-1e-7)return false;continue;}
   let t0=(min-p)/d,t1=(max-p)/d;if(t0>t1)[t0,t1]=[t1,t0];
   lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi-1e-9)return false;
  }
  return true;
 }
 function bodyOverlapsBox(pose,ob,radius=spec.bodyRadius){
  const xx=clamp(pose.x,ob.x,ob.x+ob.width),yy=clamp(pose.y,ob.y,ob.y+ob.height);
  return (pose.x-xx)**2+(pose.y-yy)**2<(radius-1e-5)**2;
 }
 const insideArena=(ob,track)=>ob.x>=.35&&ob.y>=.35&&ob.x+ob.width<=track.w-.35&&ob.y+ob.height<=track.h-.35;
 const boxBox=(a,b)=>a.x<b.x+b.width-1e-5&&a.x+a.width>b.x+1e-5&&a.y<b.y+b.height-1e-5&&a.y+a.height>b.y+1e-5;
 // Un servo real no teletransporta una caja. Por cada paso angular evaluamos
 // un barrido continuo con subpasos y aplicamos el menor corrimiento permitido.
 // La caja solo se mueve si el palo la toca. Si no cabe, el servo se detiene. El barrido es BIDIRECCIONAL: cualquier tramo
// angular (hacia la derecha, hacia la izquierda, hacia o desde el centro) pasa por la misma física de contacto.
function advance(pose,oldAngle,newAngle,obstacles,track){
  const hits=[],changes=new Map();
  let current=oldAngle;const steps=Math.max(1,Math.ceil(Math.abs(newAngle-oldAngle)/spec.subStepDeg-1e-9)),dAngle=(newAngle-oldAngle)/steps;
  for(let step=0;step<steps;step++){
   const next=current+dAngle;
   const angle=sweepAngle(current),nextAngle=sweepAngle(next);
   for(const ob of obstacles){
    const now=changes.get(ob.id)||ob;
    if(!barOverlapsBox(pose,next,now))continue;
    if(!now.movable)return {angle:current,changes,hits,blocked:'El golpe encontró un obstáculo fijo.'};
    const b=basis(pose);
    // La punta describe un arco: su desplazamiento (adelante, derecha) en este subpaso, con su signo, es la referencia
    // del empuje. Hacia la derecha la punta retrocede y avanza a la derecha; hacia la izquierda, al revés; cerca de ±75°
    // el movimiento es sobre todo longitudinal. Por eso la búsqueda es SIMÉTRICA en ambos ejes.
    const tipForward=spec.length*(Math.cos(nextAngle)-Math.cos(angle));
    const tipRight=spec.length*(Math.sin(nextAngle)-Math.sin(angle));
    const maxDrift=.44;
    let best=null,bestCost=Infinity;
    // Muestras deterministas (orden fijo) dentro del radio máximo de arrastre por subpaso, verificando colisión de la BARRA
    // ENTERA, cuerpo, límites y otras cajas.
    for(let ifwd=-8;ifwd<=8;ifwd++)for(let iside=-10;iside<=10;iside++){
     const forward=ifwd*.075,side=iside*.065;
     if(Math.hypot(forward,side)>maxDrift+1e-8)continue;
     const trial={...now,x:now.x+b.f.x*forward+b.r.x*side,y:now.y+b.f.y*forward+b.r.y*side};
     if(!insideArena(trial,track)||bodyOverlapsBox(pose,trial)||barOverlapsBox(pose,next,trial))continue;
     if(obstacles.some(other=>other.id!==ob.id&&boxBox(trial,changes.get(other.id)||other)))continue;
     const cost=(forward-tipForward)**2+(side-tipRight)**2 + (.015)*(forward**2+side**2);
     if(cost<bestCost){bestCost=cost;best=trial;}
    }
    if(!best)return {angle:current,changes,hits,blocked:'El golpe se detuvo: falta espacio para mover la caja sin atravesarla.'};
    changes.set(now.id,best);
    if(Math.hypot(best.x-ob.x,best.y-ob.y)>.02&&!hits.includes(now.id))hits.push(now.id);
   }
   current=next;
  }
  return {angle:current,changes,hits,blocked:null};
 }
 // Traslación del robot con la barra en una posición FIJA (caso B; el giro del servo es el caso A, `advance`).
 // Un subpaso de pose (oldPose → newPose) se acepta o se rechaza completo:
 //  · el cuerpo sobre cualquier caja → bloqueo (regla vigente: el chasis no empuja cajas);
 //  · la barra toca una caja fija → bloqueo;
 //  · la barra toca una caja movible durante una TRASLACIÓN pura → la caja avanza lo mismo que el robot (la separación
 //    relativa barra–caja no cambia, así que no hay penetración) si ello cabe en el arena, sin tocar el cuerpo ni otra caja;
 //  · si no cabe, o si hay giro, → bloqueo: el robot se queda en la última pose válida y nada se mueve.
 // Devuelve {pose, changes, hits, blocked}: `pose` = pose aceptada; `blocked` = null o {reason, message}.
 function advanceRobotPose(oldPose,newPose,angleDeg,obstacles,track){
  const stop=(reason,message)=>({pose:{x:oldPose.x,y:oldPose.y,th:oldPose.th},changes:new Map(),hits:[],blocked:{reason,message}});
  for(const ob of obstacles)if(bodyOverlapsBox(newPose,ob))return stop('body','Contacto con un obstáculo: el robot se detuvo.');
  const dx=newPose.x-oldPose.x,dy=newPose.y-oldPose.y,rotates=Math.abs(newPose.th-oldPose.th)>1e-9;
  const changes=new Map(),hits=[];
  for(const ob of obstacles){
   const now=changes.get(ob.id)||ob;
   if(!barOverlapsBox(newPose,angleDeg,now))continue;
   if(!now.movable)return stop('fixed','La garra tocó un obstáculo fijo: el robot se detuvo.');
   if(rotates)return stop('rotation','La garra tocó una caja durante un giro: el robot se detuvo.');
   const trial={...now,x:now.x+dx,y:now.y+dy};
   if(!insideArena(trial,track)||bodyOverlapsBox(newPose,trial)||barOverlapsBox(newPose,angleDeg,trial)||
      obstacles.some(other=>other.id!==ob.id&&boxBox(trial,changes.get(other.id)||other)))
    return stop('no-space','La caja no tiene espacio para desplazarse: el robot se detuvo.');
   changes.set(ob.id,trial);if(!hits.includes(ob.id))hits.push(ob.id);
  }
  return {pose:{x:newPose.x,y:newPose.y,th:newPose.th},changes,hits,blocked:null};
 }
 return {spec,commandAngle,clamp,basis,worldPoint,sweepAngle,segment,barOverlapsBox,bodyOverlapsBox,insideArena,boxBox,advance,advanceRobotPose};
})();
