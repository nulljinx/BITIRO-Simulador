/* BITIRO · Mecanismo de golpe y colisión 2D en centímetros del plano de pista.
   Una sola especificación física compartida entre simulación, pruebas y escena 3D. */
'use strict';
window.IROH_MECHANICS = (() => {
 const spec = Object.freeze({
  pivotForward: 8.6, pivotRight: 0, length: 13.2,
  halfWidth: .52, bottomHeight: 5.18, topHeight: 6.32,
  servoBodyHeight: 4.4, sonarHeight: 15.1,
  restAngle: -65, sweepPerCommand: 2, maxCommand: 65,
  commandRate: 95, bodyRadius: 8.3,
 });
 const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
 const basis=pose=>({f:{x:Math.sin(pose.th),y:-Math.cos(pose.th)},r:{x:Math.cos(pose.th),y:Math.sin(pose.th)}});
 const worldPoint=(pose,f,r)=>{const b=basis(pose);return {x:pose.x+b.f.x*f+b.r.x*r,y:pose.y+b.f.y*f+b.r.y*r};};
 const sweepAngle=cmd=>(spec.restAngle+spec.sweepPerCommand*cmd)*Math.PI/180;
 function segment(pose,command){
  const a=sweepAngle(command),p=worldPoint(pose,spec.pivotForward,spec.pivotRight);
  return [p,worldPoint(pose,spec.pivotForward+spec.length*Math.cos(a),spec.pivotRight+spec.length*Math.sin(a))];
 }
 // Liang–Barsky: centro de la barra barrido frente a AABB expandida por el
 // grosor del palo. Usamos < y EPS para no tratar las superficies tangentes
 // como penetración. El contacto se detecta asimismo con la separación real.
 function barOverlapsBox(pose,command,ob,pad=spec.halfWidth){
  const height=ob.visualHeightCm??15.6;
  if(height < spec.bottomHeight+1e-6 || spec.topHeight < -.45)return false;
  const [a,b]=segment(pose,command),loX=ob.x-pad,hiX=ob.x+ob.width+pad,loY=ob.y-pad,hiY=ob.y+ob.height+pad;
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
 // La caja solo se mueve si el palo la toca. Si no cabe, el servo se detiene.
 function advance(pose,oldCmd,newCmd,obstacles,track){
  const hits=[],changes=new Map();
  let current=oldCmd;const steps=Math.max(1,Math.ceil(Math.abs(newCmd-oldCmd)/.55)),dCmd=(newCmd-oldCmd)/steps;
  for(let step=0;step<steps;step++){
   const next=current+dCmd;
   const angle=sweepAngle(current),nextAngle=sweepAngle(next),delta=nextAngle-angle;
   for(const ob of obstacles){
    const now=changes.get(ob.id)||ob;
    if(!barOverlapsBox(pose,next,now))continue;
    if(!now.movable||next<current)return {command:current,changes,hits,blocked:next<current?'El golpe no puede retraerse a través del obstáculo.':'El golpe encontró un obstáculo fijo.'};
    const b=basis(pose),sign=Math.sign(delta)||1;
    // La punta describe un arco; su tangente empuja hacia un lado y, al
    // extenderse, ligeramente hacia delante. Ambos ejes en cm reales.
    const tipForward=spec.length*(Math.cos(nextAngle)-Math.cos(angle));
    const tipRight=spec.length*(Math.sin(nextAngle)-Math.sin(angle));
    const maxDrift=.44;
    let best=null,bestCost=Infinity;
    // Muestras en la dirección del barrido, siempre con restricción de
    // velocidad y verificando colisión de la BARRA ENTERA, cuerpo y límites.
    for(let ifwd=-1;ifwd<=8;ifwd++)for(let iside=0;iside<=10;iside++){
     const forward=ifwd*.075,side=sign*iside*.065;
     if(Math.hypot(forward,side)>maxDrift+1e-8)continue;
     const trial={...now,x:now.x+b.f.x*forward+b.r.x*side,y:now.y+b.f.y*forward+b.r.y*side};
     if(!insideArena(trial,track)||bodyOverlapsBox(pose,trial)||barOverlapsBox(pose,next,trial))continue;
     if(obstacles.some(other=>other.id!==ob.id&&boxBox(trial,changes.get(other.id)||other)))continue;
     const cost=(forward-tipForward)**2+(side-tipRight)**2 + (.015)*(forward**2+side**2);
     if(cost<bestCost){bestCost=cost;best=trial;}
    }
    if(!best)return {command:current,changes,hits,blocked:'El golpe se detuvo: falta espacio para mover la caja sin atravesarla.'};
    changes.set(now.id,best);
    if(Math.hypot(best.x-ob.x,best.y-ob.y)>.02&&!hits.includes(now.id))hits.push(now.id);
   }
   current=next;
  }
  return {command:current,changes,hits,blocked:null};
 }
 return {spec,clamp,basis,worldPoint,sweepAngle,segment,barOverlapsBox,bodyOverlapsBox,insideArena,boxBox,advance};
})();
