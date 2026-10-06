/* BITIRO Lab · Página autónoma de simulación. Sin API, login o dependencias externas. */
'use strict';
const $app=id=>document.getElementById(id);
const sourceTracks=window.BITIRO_TRACKS;
let chosen='s01',track,sceneTrack;
let mode='idle',paused=false,resumeDemoAfterStrike=false,simTime=0,last=performance.now(),acc=0,frameCounter=0;
let wheel={left:0,right:0},previousPose=null,trail=[],runDistance=0,lineSeconds=0,observedSeconds=0,collisionCount=0,wasContact=false;
const FIXED_DT=1/120;
let camera={azimuth:.10,elevation:.94,distance:1.80,follow:false};
let motion={dragging:false,x:0,y:0};
let observation=[155,865,155];
let activeObstacles=[],striker={angle:0,target:0,pulse:0,returning:false,hitIds:new Set(),blocked:null},movedCount=0,demoPath=[],demoIndex=0;
window.BITIRO_RENDER_QUALITY='standard';
const worldCv=$app('scene');
const ui={track:$app('track'),name:$app('trackName'),size:$app('trackSize'),badge:$app('statusBadge'),stage:$app('stageLabel'),origin:$app('sceneSource'), feedback:$app('feedback')};
const shorten=(str,n=35)=>str.length>n?str.slice(0,n-1)+'…':str;
// sceneTrack = solo geometría del suelo. Los objetos físicos viven en el escenario (scenario-props.js) y en activeObstacles (mundo activo).
let scenarioList=[];
function toScene(t){return {id:t.id,physicalWidthCm:t.w,physicalHeightCm:t.h,paths:t.paths.map(p=>({id:p.id,widthCm:p.w,points:p.p.map(([x,y])=>({x,y}))})),finishZones:t.zones,markers:t.markers,start:t.start};}
function changeTrack(name){
 if(track&&$app('src'))BITIRO_STORAGE.set('bitiro:standalone:code:'+chosen,$app('src').value);
 chosen=name;track=sourceTracks[name];sceneTrack=toScene(track);scenarioList=BITIRO_SCENARIO.load(chosen,track).list;
 if($app('src'))$app('src').value=BITIRO_STORAGE.get('bitiro:standalone:code:'+chosen)||EJ[0];ui.name.textContent=track.id.toUpperCase()+' / '+shorten(track.name.replace(/^S\d+ · /,''),32);ui.size.textContent=track.w+' × '+track.h+' cm';ui.stage.textContent=track.id.toUpperCase();
 ui.origin.textContent=['s01','s02'].includes(track.id)?'Pista de proyecto · '+track.id.toUpperCase():track.id==='s07'?'Repaso · sin plotter oficial':track.id.startsWith('s')?'Plotter oficial (PDF vectorial) · '+track.id.toUpperCase():'Circuito libre no institucional';
 $app('reference').hidden=!sourceImageForTrack(name);
 camera={azimuth:.10,elevation:.94,distance:track.h>165?1.90:1.80,follow:false};cameraUI('perspective');window.resetRobot();
 ui.feedback.textContent=track.note;ui.track.value=name;updateLesson();updateZoom();draw();
}
function setState(text){ui.badge.textContent=text;ui.badge.style.color=text==='EJECUTANDO'?'#8fdfbf':'#e4a57d';}
window.resetRobot=function(){
 // MUNDO ACTIVO: copia del escenario guardado; golpes y colisiones mueven solo esta copia y Reiniciar la restaura.
 activeObstacles=scenarioList.map(ob=>({...ob,visualHeightCm:ob.visualHeightCm ?? 15.6}));movedCount=0;striker={angle:0,target:0,pulse:0,returning:false,hitIds:new Set(),blocked:null};demoIndex=0;demoPath=resamplePath(createDemoPath(track));
 mode='idle';paused=false;resumeDemoAfterStrike=false;running=0;halt=0;wait=0;it=null;simTime=0;R.L=0;R.R=0;wheel={left:0,right:0};acc=0;trail=[];runDistance=0;lineSeconds=0;observedSeconds=0;collisionCount=0;wasContact=false;lcd=['',''];
 R.x=track.start.x;R.y=track.start.y;
 // IROH's legacy heading is measured from canvas negative Y; BITIRO track heading is measured from +X.
 R.th=track.start.heading+Math.PI/2;previousPose={x:R.x,y:R.y,th:R.th,angle:0};
 $app('step').disabled=true;
 setState('EN ESPERA');$app('pause').disabled=true;$app('pause').textContent='Pausar';
 if(typeof setIR==='function'){setIR(0,0);setIR(1,0);}
 if(typeof setButton==='function')setButton(0);
 if(mode==='idle')ui.feedback.textContent='Listo. Inicia una demostración o ejecuta tu código.';
 updateTelemetry();
};
window.onCodeStarted=function(){mode='code';paused=false;setState('EJECUTANDO');$app('pause').disabled=false;ui.feedback.textContent='Ejecutando el programa didáctico del editor.';};
window.onCodeStopped=function(){mode='idle';setState('DETENIDO');$app('pause').disabled=true;ui.feedback.textContent='El programa se detuvo por un error. Revisa el editor.';};
function closestSegment(px,py){
 let best=Infinity,closest=null;
 for(const line of track.paths){const pts=line.p;
  for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],vx=b[0]-a[0],vy=b[1]-a[1],den=vx*vx+vy*vy;
   const t=den?Math.max(0,Math.min(1,((px-a[0])*vx+(py-a[1])*vy)/den)):0;
   const x=a[0]+t*vx,y=a[1]+t*vy,d=Math.hypot(px-x,py-y)-line.w/2;
   if(d<best){best=d;closest={x,y,vx,vy,dist:d};}
  }
 }
 return closest||{x:px,y:py,vx:1,vy:0,dist:999};
}
window.readLine=function(k){
 const {spread,front}=LINE_SENSOR.geometry;
 const fx=Math.sin(R.th),fy=-Math.cos(R.th),rx=Math.cos(R.th),ry=Math.sin(R.th);
 const x=R.x+front*fx+(k-1)*spread*rx,y=R.y+front*fy+(k-1)*spread*ry;
 const near=closestSegment(x,y);
 // Escala didáctica de sensor reflectivo: negro alto (~850), blanco bajo (~155).
 // Coherente con el umbral 500 de los programas incluidos en el editor.
 const blend=Math.max(0,Math.min(1,(1.05-near.dist)/1.7));
 return LINE_SENSOR.raw(blend);
};
// Cinemática centralizada en strike-physics.js, compartida con el modelo 3D.
const MECH=window.IROH_MECHANICS, HIT=MECH.spec;
const forwardVector=()=>[Math.sin(R.th),-Math.cos(R.th)];
function nearbyObstacle(reach=200){
 const {f,r}=MECH.basis(R);let result=null,nearest=Infinity;
 for(const ob of activeObstacles){
  // Sonar frontal: proyecta el centro de la caja sobre el eje de marcha.
  const cx=ob.x+ob.width/2-R.x,cy=ob.y+ob.height/2-R.y;
  const forward=cx*f.x+cy*f.y,side=cx*r.x+cy*r.y;
  const lateralSpan=(Math.abs(ob.width*r.x)+Math.abs(ob.height*r.y))/2;
  if(forward>0&&forward<reach+Math.hypot(ob.width,ob.height)&&Math.abs(side)<lateralSpan+2.2&&forward<nearest){
   nearest=forward;result={ob,forward,side};
  }
 }
 return result;
}
// Sonar didáctico: haz central y dos rayos ±6°, desde la cara del transductor.
window.readSonarDistance=function(){
 const origin=MECH.worldPoint(R,9.83,0);let nearest=200;
 for(const offset of [-Math.PI/30,0,Math.PI/30]){
  const direction={x:Math.sin(R.th+offset),y:-Math.cos(R.th+offset)};
  for(const ob of activeObstacles){
   if((ob.visualHeightCm??15.6)<HIT.sonarHeight)continue;
   let lo=0,hi=200;
   for(const [p,d,min,max] of [[origin.x,direction.x,ob.x,ob.x+ob.width],[origin.y,direction.y,ob.y,ob.y+ob.height]]){
    if(Math.abs(d)<1e-9){if(p<min||p>max){hi=-1;break;}continue;}
    let a=(min-p)/d,b=(max-p)/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);
   }
   if(hi>=lo)nearest=Math.min(nearest,lo);
  }
 }
 return Math.round(nearest);
};
const rodSegment=(angle,pose=R)=>MECH.segment(pose,angle);
const rodTouchesBox=(angle,ob,pose=R)=>MECH.barOverlapsBox(pose,angle,ob);
const bodyTouchesBox=(x,y,ob)=>MECH.bodyOverlapsBox({...R,x,y},ob);
function moveRodTowards(desired,dt){
 if(Math.abs(desired-striker.angle)<1e-6)return;
 // El servo no atraviesa ni mueve cajas a distancia: una sola solución de
 // contacto valida el desplazamiento antes de modificar el mundo o la escena.
 const step=HIT.commandRate*dt*Math.sign(desired-striker.angle);
 const next=striker.angle+Math.sign(step)*Math.min(Math.abs(step),Math.abs(desired-striker.angle));
 const result=MECH.advance(R,striker.angle,next,activeObstacles,track);
 striker.angle=result.command;
 for(const [id,pos] of result.changes){
  const ob=activeObstacles.find(item=>item.id===id);
  if(ob){ob.x=pos.x;ob.y=pos.y;}
 }
 for(const id of result.hits)if(!striker.hitIds.has(id)){
  movedCount++;striker.hitIds.add(id);
 }
 if(result.hits.length)ui.feedback.textContent='Golpe: la varilla central contactó la caja y la está desplazando.';
 if(result.blocked){striker.blocked=result.blocked;ui.feedback.textContent=result.blocked;}
 else striker.blocked=null;
}
function stroke(angle){
 const target=MECH.clamp(Number(angle)||0,0,HIT.maxCommand);
 const previousTarget=striker.target;
 if(previousTarget===target&&striker.pulse===0)return;striker.target=target;striker.pulse=0;striker.returning=false;
 if(target>0){if(previousTarget===0&&striker.angle<.5)striker.hitIds.clear();ui.feedback.textContent='Golpe solicitado. El servo gira desde su posición recogida: solo mueve objetos mediante contacto.';}
 else ui.feedback.textContent='Golpe: regreso controlado a la posición recogida.';
}
window.setStrikerAngle=stroke;
function createDemoPath(t){
 // Recorridos didácticos: se separan explícitamente del código del alumno. Eligen trazos impresos por su `role` (descriptivo).
 const roleOf=r=>t.paths.filter(p=>p.role===r).map(p=>p.p);
 const up=pts=>pts[0][1]<pts[pts.length-1][1]?[...pts].reverse():pts; // orienta hacia y decreciente (hacia arriba)
 const trunk=()=>roleOf('trunk').sort((a,b)=>Math.max(...b.map(q=>q[1]))-Math.max(...a.map(q=>q[1]))).flatMap(up);
 // Un arco que pasa por la bifurcación se divide en su vértice más bajo (apex) y cada mitad sale hacia su extremo.
 const arcHalves=()=>{const a=roleOf('arc')[0],k=a.reduce((m,q,i)=>q[1]>a[m][1]?i:m,0);return {right:a.slice(0,k+1).reverse(),left:a.slice(k)};};
 const stubAt=(end)=>{const s=roleOf('stub').find(q=>Math.hypot(q[0][0]-end[0],q[0][1]-end[1])<4||Math.hypot(q[q.length-1][0]-end[0],q[q.length-1][1]-end[1])<4);return s?up(s):[];};
 if(t.id==='s01'){
  const upper=roleOf('arc')[0];const mid=Math.floor(upper.length/2);
  const branch=(ir[1]&&!ir[0])?upper.slice(mid):upper.slice(0,mid+1).reverse();
  return [[50,130],...roleOf('stem')[0],...branch];
 }
 if(t.id==='s02'){
  const h=arcHalves(),pick=ir[0]&&ir[1]?h.right:ir[1]?h.left:null;
  return [[t.start.x,t.start.y],...roleOf('stem')[0],...(pick||[...roleOf('branch-center')[0]].reverse())];
 }
 if(t.id==='s04'||t.id==='s08')return [[t.start.x,t.start.y],...trunk()];
 if(t.id==='s05'){
  const h=arcHalves(),pick=ir[0]&&ir[1]?h.right:ir[1]?h.left:null;
  const branch=pick?[...pick,...stubAt(pick[pick.length-1])]:up(roleOf('branch-center')[0]);
  return [[t.start.x,t.start.y],...trunk(),...branch];
 }
 const first=t.paths.find(p=>p.p.length>3)||t.paths[0];
 let pts=first?.p||[];
 if(pts.length){ // sigue el trazo desde el punto más cercano a la salida (circuitos cerrados: se rota el lazo)
  let k=0,best=Infinity;pts.forEach((q,i)=>{const d=Math.hypot(q[0]-t.start.x,q[1]-t.start.y);if(d<best){best=d;k=i;}});
  const closed=Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1])<1;
  if(k>0)pts=closed?[...pts.slice(k,-1),...pts.slice(0,k+1)]:pts.slice(k);
 }
 return [[t.start.x,t.start.y],...pts];
}
function demoDrive(){
 if(demoPath.length<2){R.L=R.R=0;return;}
 // Look-ahead: sigue la ruta de inicio y evita confundirse con el tope transversal
 // de salida o con las intersecciones de la pista.
 while(demoIndex<demoPath.length-2){
  const p=demoPath[demoIndex];if(Math.hypot(p[0]-R.x,p[1]-R.y)>3.8)break;
  demoIndex++;
 }
 const at=demoPath[Math.min(demoIndex+2,demoPath.length-1)];
 const target=Math.atan2(at[1]-R.y,at[0]-R.x);
 const actual=R.th-Math.PI/2;
 const diff=Math.atan2(Math.sin(target-actual),Math.cos(target-actual));
 const turn=clamp(diff*32,-32,32),speed=Math.abs(diff)>1.0?0:25;
 R.L=clamp(speed+turn,-48,48);R.R=clamp(speed-turn,-48,48);
 const last=demoPath[demoPath.length-1];
 if(demoIndex>=demoPath.length-3&&Math.hypot(last[0]-R.x,last[1]-R.y)<4){
  R.L=R.R=0;mode='idle';setState('RECORRIDO VISUALIZADO');$app('pause').disabled=true;
  ui.feedback.textContent='Demostración del trazado terminada; no implica superar la misión.';
 }
 const ob=nearbyObstacle(13);
 if(ob&&ob.forward-ob.ob.height/2<=HIT.pivotForward+HIT.length+1.2){R.L=R.R=0;mode='idle';resumeDemoAfterStrike=true;setState('OBSTÁCULO');$app('pause').disabled=true;ui.feedback.textContent='Un objeto impide avanzar. Acércate lo suficiente y usa «Golpe» para apartarlo.';}
}
function update(dt){
 if(paused)return;
 previousPose={x:R.x,y:R.y,th:R.th,angle:striker.angle};
 // El golpe tiene una trayectoria RECOGIDA (-65°) → extensión (0°) →
 // barrido (+65°). La orden del alumno fija la posición del servo; el botón
 // de demostración realiza un ciclo y luego lo devuelve a reposo.
 if(striker.pulse>0){
  if(!striker.returning){
   moveRodTowards(striker.target,dt);
   if(Math.abs(striker.angle-striker.target)<.01||striker.blocked){striker.returning=true;striker.pulse=.55;}
  }else{
   striker.pulse=Math.max(0,striker.pulse-dt);
   if(striker.pulse===0)striker.target=0;
  }
 }else if(Math.abs(striker.target-striker.angle)>.01){
  // En modo código, moverServoGolpe() también debe mover el servo de verdad.
  moveRodTowards(striker.target,dt);
 }
 if(resumeDemoAfterStrike&&mode==='idle'&&movedCount>0&&Math.abs(striker.angle)<.5&&striker.pulse===0&&
    !nearbyObstacle(HIT.pivotForward+HIT.length+4)){
  resumeDemoAfterStrike=false;mode='demo';setState('EJECUTANDO');$app('pause').disabled=false;
  ui.feedback.textContent='El golpe despejó la línea. La demostración continúa desde la posición actual.';
 }
 if(mode==='idle'){wheel.left=wheel.right=0;return;}
 if(mode==='demo')demoDrive();
 if(mode==='code'&&running&&!halt){try{
  if(wait>0)wait-=dt*1000;
  if(wait<=1e-7){const next=it.next();wait+=Math.max(0,Number(next.value)||0);if(wait<0)wait=0;}
 }catch(e){fail(e);mode='idle';}}
 if(halt){mode='idle';running=0;R.L=R.R=0;setState('FINALIZADO');$app('pause').disabled=true;}
 // Accélération limitée; arrêt explicite immédiat pour respecter detenerse().
 const approach=(value,target)=>target===0?0:value+clamp(target-value,-240*dt,240*dt);
 wheel.left=approach(wheel.left,R.L);wheel.right=approach(wheel.right,R.R);
 const max=23, vL=wheel.left/100*max,vR=wheel.right/100*max,base=12;
 const before={x:R.x,y:R.y};
 const v=(vL+vR)/2,omega=(vL-vR)/base;
 // Subpasos de traslación/rotación: no permitir atravesar por tunnelling en
 // una sola actualización a altas velocidades o tras un giro brusco.
 const substeps=Math.max(1,Math.ceil(Math.abs(v*dt)/.30+Math.abs(omega*dt)/.025));
 let blocked=false;
 for(let k=0;k<substeps;k++){
  const pose={...R,th:R.th+omega*dt/substeps};
  pose.x+=Math.sin(pose.th)*v*dt/substeps;
  pose.y-=Math.cos(pose.th)*v*dt/substeps;
  if(activeObstacles.some(ob=>MECH.bodyOverlapsBox(pose,ob)||MECH.barOverlapsBox(pose,striker.angle,ob))){
   blocked=true;R.L=R.R=0;wheel.left=wheel.right=0;break;
  }
  R.x=pose.x;R.y=pose.y;R.th=pose.th;
 }
 if(blocked){
  ui.feedback.textContent='Contacto con un obstáculo: el robot se detuvo. El golpe solo alcanza objetos frente al brazo; un contacto lateral requiere cambiar la trayectoria de tu programa.';
  if(mode==='demo'){mode='idle';resumeDemoAfterStrike=true;setState('OBSTÁCULO');$app('pause').disabled=true;}
 }
 if(blocked&&!wasContact)collisionCount++;wasContact=blocked;
 const traveled=Math.hypot(R.x-before.x,R.y-before.y);runDistance+=traveled;
 if(traveled>.0001){observedSeconds+=dt;if([0,1,2].some(k=>LINE_SENSOR.detected(readLine(k),k)))lineSeconds+=dt;}
 if(!trail.length||Math.hypot(R.x-trail[trail.length-1].x,R.y-trail[trail.length-1].y)>.8){trail.push({x:R.x,y:R.y});if(trail.length>1800)trail.shift();}
 simTime+=dt;
 if(R.x<-16||R.x>track.w+16||R.y<-16||R.y>track.h+16){mode='idle';running=0;R.L=R.R=0;setState('FUERA DE PISTA');ui.feedback.textContent='IROH salió del área de práctica. Pulsa Reiniciar.';$app('pause').disabled=true;}
}
function render(){
 // A 3D scene rendered by a local software rasterizer, not WebGL/Three.js.
 const a=paused||mode==='idle'?1:Math.min(1,acc/FIXED_DT),p=previousPose||{...R,angle:striker.angle};
 const robot={x:p.x+(R.x-p.x)*a,y:p.y+(R.y-p.y)*a,heading:p.th+(R.th-p.th)*a-Math.PI/2,lineCenter:readLine(1),lineActive:[0,1,2].map(k=>LINE_SENSOR.detected(readLine(k),k)),strikerAngle:p.angle+(striker.angle-p.angle)*a,trail:$app('showTrail').checked?trail:[]};
 renderScene3D(worldCv,sceneTrack,robot,activeObstacles,camera);
}
function draw(){if(sceneTrack)render();}
function updateTelemetry(){
 observation=[readLine(0),readLine(1),readLine(2)];
 for(const [s,i] of [['L',0],['C',1],['R',2]]){$app('val'+s).textContent=String(observation[i]).padStart(3,'0');const norm=LINE_SENSOR.normalized(observation[i],i),on=LINE_SENSOR.detected(observation[i],i);$app('bar'+s).style.width=norm/10+'%';$app('state'+s).textContent=norm+' / 1000 · '+(on?'NEGRO':'BLANCO');}
 $app('time').innerHTML=simTime.toFixed(1)+' <small>s</small>';
 $app('motors').textContent=Math.round(R.L)+' / '+Math.round(R.R);
 updateLearningTelemetry();
 $app('sonar').textContent=window.readSonarDistance()+' cm';
 $app('position').textContent=Math.round(R.x)+', '+Math.round(R.y)+' cm';
 $app('strikerStatus').textContent=Math.round(striker.angle)+'° · '+(striker.blocked?'BLOQUEADO':striker.pulse>0?'EN MOVIMIENTO':Math.abs(striker.angle)<.5?'RECOGIDO':'POSICIÓN FIJA');
 $app('movedObjects').textContent=String(movedCount);
 $app('lcd').textContent=lcd[0].padEnd(16).slice(0,16)+'\n'+lcd[1].padEnd(16).slice(0,16);
}
function frame(now){
 const speed=Number($app('speed').value)||1,delta=Math.max(0,Math.min(.1,(now-last)/1000));last=now;
 if(!document.hidden&&!paused){acc=Math.min(.5,acc+delta*speed);while(acc>=FIXED_DT){update(FIXED_DT);acc-=FIXED_DT;}}
 else acc=0;
 if((frameCounter++%4)===0)updateTelemetry();render();requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{last=performance.now();acc=0;});
function cameraUI(name){
 $app('viewLabel').textContent=({top:'VISTA SUPERIOR',perspective:'PERSPECTIVA LIBRE',follow:'SEGUIR IROH',robot:'DETALLE DEL ROBOT'})[name];
 document.querySelectorAll('.cam').forEach(b=>{const yes=b.dataset.view===name;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes));});
 if(name==='top'){camera.elevation=Math.PI/2-.02;camera.azimuth=Math.PI/2;camera.distance=2.3;camera.follow=false;}
 if(name==='perspective'){camera.elevation=.94;camera.azimuth=.10;camera.distance=track.h>165?1.90:1.80;camera.follow=false;}
 if(name==='follow'){camera.elevation=.75;camera.azimuth=-1.1;camera.distance=.8;camera.follow=true;}
 if(name==='robot'){camera.elevation=.45;camera.azimuth=-1.12;camera.distance=.37;camera.follow=true;}
 updateZoom();
}
document.querySelectorAll('.cam').forEach(b=>b.addEventListener('click',()=>cameraUI(b.dataset.view)));
ui.track.addEventListener('change',e=>changeTrack(e.target.value));
$app('quality').addEventListener('change',e=>{window.BITIRO_RENDER_QUALITY=e.target.value;draw();});
$app('demo').addEventListener('click',()=>{const inputs=[...ir],pressed=btn;window.resetRobot();inputs.forEach((v,k)=>setIR(k,v));setButton(pressed);demoPath=resamplePath(createDemoPath(track));demoIndex=0;mode='demo';setState('EJECUTANDO');$app('pause').disabled=false;ui.feedback.textContent='Demostración guiada por la ruta: no usa los sensores ni evalúa tu código. Prueba Ejecutar código para comprobar tu algoritmo.';});
$app('pause').addEventListener('click',()=>{paused=!paused;$app('pause').textContent=paused?'Continuar':'Pausar';setState(paused?'EN PAUSA':'EJECUTANDO');$app('step').disabled=!paused;acc=0;});
$app('step').addEventListener('click',()=>{if(!paused||mode==='idle')return;paused=false;for(let n=0;n<12;n++)update(FIXED_DT);paused=true;acc=0;updateTelemetry();draw();});
$app('reset').addEventListener('click',()=>{window.resetRobot();$app('msg').textContent='Simulación reiniciada; tu código se conserva.';});
$app('strike').addEventListener('click',()=>{
 if(mode==='code'){ui.feedback.textContent='En modo código, utiliza moverServoGolpe() en tu programa.';return;}stroke(65);striker.pulse=1;striker.returning=false;
});
$app('pulsador').addEventListener('click',()=>setButton(!btn));
for(const k of [0,1])$app('ir'+k).addEventListener('click',()=>{setIR(k,!ir[k]);if(mode==='demo'){demoPath=resamplePath(createDemoPath(track));demoIndex=Math.min(demoIndex,demoPath.length-2);}});
const codePanel=$app('codePanel');
const codeKey=id=>'bitiro:standalone:code:'+id;
function showCode(open,focus=false){
 codePanel.hidden=!open;$app('workspace').classList.toggle('editor-open',open);
 $app('codeToggle').setAttribute('aria-expanded',String(open));
 $app('codeToggle').innerHTML=open?'Ocultar editor <span aria-hidden="true">↙</span>':'Escribir código <span aria-hidden="true">&lt;/&gt;</span>';
 if(open&&focus){codePanel.scrollIntoView({behavior:'smooth',block:'nearest'});$app('src').focus({preventScroll:true});}
}
$app('codeToggle').addEventListener('click',()=>showCode(codePanel.hidden,true));
$app('codeClose').addEventListener('click',()=>showCode(false));
$app('example').addEventListener('change',e=>{$app('src').value=EJ[Number(e.target.value)];BITIRO_STORAGE.set(codeKey(chosen),$app('src').value);});
$app('src').value=BITIRO_STORAGE.get(codeKey(chosen))||EJ[0];
$app('src').addEventListener('input',()=>BITIRO_STORAGE.set(codeKey(chosen),$app('src').value));
$app('src').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const v=e.target;v.setRangeText('  ',v.selectionStart,v.selectionEnd,'end');}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();start();}});
$app('run').addEventListener('click',()=>start());
const wrap=$app('sceneWrap');
wrap.addEventListener('pointerdown',e=>{if(e.target!==worldCv)return;motion={dragging:true,x:e.clientX,y:e.clientY};worldCv.setPointerCapture(e.pointerId);});
wrap.addEventListener('pointermove',e=>{if(!motion.dragging)return;const dx=e.clientX-motion.x,dy=e.clientY-motion.y;motion.x=e.clientX;motion.y=e.clientY;$app('viewLabel').textContent='CÁMARA LIBRE';camera.azimuth+=dx*.007;camera.elevation=Math.max(.19,Math.min(Math.PI/2-.02,camera.elevation+dy*.006));document.querySelectorAll('.cam').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});});
const pointerStop=()=>{motion.dragging=false;};wrap.addEventListener('pointerup',pointerStop);wrap.addEventListener('pointercancel',pointerStop);
wrap.addEventListener('wheel',e=>{e.preventDefault();camera.distance=Math.max(.24,Math.min(3.4,camera.distance*(e.deltaY>0?1.09:.91)));updateZoom();},{passive:false});
function updateZoom(){ $app('zoomText').textContent=Math.round(180/camera.distance)+'%'; }
$app('zoomIn').addEventListener('click',()=>{camera.distance=Math.max(.24,camera.distance*.86);updateZoom();});
$app('zoomOut').addEventListener('click',()=>{camera.distance=Math.min(3.4,camera.distance*1.17);updateZoom();});
$app('full').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $app('viewportHost').requestFullscreen();}catch(e){ui.feedback.textContent='Este navegador no permite pantalla completa desde este archivo.';}});
const referenceDialog=$app('referenceDialog');
function sourceImageForTrack(id){return ['s01','s02','s03','s04','s05','s06','s08'].includes(id)?id:null;}
$app('reference').addEventListener('click',()=>{const id=sourceImageForTrack(chosen);if(!id)return;
 $app('referenceHeading').textContent='Plotter de referencia · '+chosen.toUpperCase();
 $app('referenceImg').src='assets/plotters/'+id+'.png';
 $app('referenceImg').alt='Imagen de referencia del plotter '+id.toUpperCase();
 referenceDialog.showModal();});
$app('referenceClose').addEventListener('click',()=>referenceDialog.close());
referenceDialog.addEventListener('click',e=>{if(e.target===referenceDialog)referenceDialog.close();});
initializeCalibration();changeTrack('s01');showCode(true);updateZoom();requestAnimationFrame(frame);

function resamplePath(points){
 if(!points.length)return [];
 // Algunos inicios están unos centímetros dentro del primer tramo. No
 // retroceder hasta el comienzo del plotter antes de iniciar la demostración.
 const start=points[0];
 for(let i=1;i<Math.min(points.length-1,12);i++){
  const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  if(!length)continue;const t=((start[0]-a[0])*dx+(start[1]-a[1])*dy)/length;
  if(t>=0&&t<=1&&Math.hypot(start[0]-a[0]-t*dx,start[1]-a[1]-t*dy)<.5){points=[start,...points.slice(i+1)];break;}
 }
 const result=[points[0]];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.5));for(let j=1;j<=n;j++)result.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}
 return result;
}
function updateLesson(){
 const lessons={
 s01:['Seguir y despejar','Relaciona la lectura de línea con el giro y usa el sonar antes de accionar el golpe.','¿Cuándo conviene detenerse?'],
 s02:['Elegir una ruta','Distingue una curva de una intersección y programa una decisión de ruta.','¿Qué significa ver tres negros?'],
 s03:['Contar eventos','Cuenta transiciones de blanco a negro; una lectura repetida no es un evento nuevo.','¿Cómo evitar contar dos veces?'],
 s04:['Recordar el último movimiento','Explora qué ocurre cuando la línea se interrumpe y limita el tiempo de búsqueda.','¿Qué haces si no hay línea?'],
 s05:['Decidir con entradas IR','Cambia las entradas IR manuales y explica cómo tu programa elige una rama.','¿Qué pasa con ambos IR activos?'],
 s06:['Distancia y velocidad','Observa el sonar, reduce la velocidad y detente antes del contacto.','¿Frenas antes de tocar la caja?'],
 s07:['Repetir y comparar','Superficie neutra sin plotter oficial: elige cualquier otra pista y cambia una sola condición entre ensayos.','¿Qué cambio explica el resultado?'],
 s08:['Integrar estrategias','Combina sensores y memoria de estado. La clasificación requiere tu propia lógica.','¿Qué evidencia valida tu decisión?'],
 oval:['Ajustar el seguimiento','Compara dos velocidades y observa cuánto tiempo detecta línea el robot.','¿Más rápido sigue siendo preciso?'],
 ocho:['Resolver un cruce','Observa el patrón de sensores en el cruce y decide cómo conservar el rumbo.','¿Cruce o final del recorrido?']
 };
 const [title,goal,question]=lessons[chosen];$app('lessonTitle').textContent=title;$app('lessonGoal').textContent=goal;$app('lessonQuestion').textContent=question;
}
function updateLearningTelemetry(){
 const bits=observation.map((v,k)=>LINE_SENSOR.detected(v,k)?1:0);
 const action=R.L===0&&R.R===0?'detenido':R.L===R.R?(R.L>0?'avance recto':'retroceso'):R.L>R.R?'giro a la derecha':'giro a la izquierda';
 const label=mode==='demo'||resumeDemoAfterStrike?'Demo guiada por ruta':mode==='code'?'Órdenes de tu programa':'Último estado';
 $app('decision').textContent=label+': ['+bits.join(' · ')+'] → '+action+'.';
 $app('runEvidence').textContent=runDistance.toFixed(1)+' cm recorridos · '+(observedSeconds?(100*lineSeconds/observedSeconds).toFixed(0)+'% con línea detectada en movimiento':'sin muestras en movimiento')+' · '+collisionCount+' contactos. Evidencia del ensayo; no es una nota ni certifica la misión.';
 $app('strike').disabled=mode==='code';
 $app('step').disabled=!paused||mode==='idle';
}
// API mínima para scenario-editor.js (el editor no toca el estado interno del simulador).
window.BITIRO_WORLD={
 track:()=>track,
 scenario:()=>BITIRO_SCENARIO.clone(scenarioList),
 // Consistencia física: no se edita el mundo a mitad de un tick. Si hay una ejecución, se pausa (no se reanuda sola al cancelar).
 beginEdit(){if(mode!=='idle'&&!paused){paused=true;setState('EN PAUSA');$app('pause').textContent='Continuar';$app('step').disabled=false;acc=0;}},
 // useDefault=true elimina el override guardado (vuelve al escenario predeterminado); si no, guarda `list` (incluso vacía) para esta pista.
 apply(list,{useDefault=false}={}){
  let saved=true;
  if(useDefault){BITIRO_SCENARIO.reset(chosen);scenarioList=BITIRO_SCENARIO.load(chosen,track).list;}
  else{scenarioList=BITIRO_SCENARIO.usable(list,track);saved=BITIRO_SCENARIO.save(chosen,scenarioList);}
  window.resetRobot();draw();return saved;
 },
 defaults:()=>BITIRO_SCENARIO.defaults(track.id)
};
function initializeCalibration(){
 const dialog=$app('calibrationDialog');let draft;
 const showProfile=()=>{
  const p=LINE_SENSOR.profile;$app('calibrationSummary').textContent=(p.calibrated?'Calibrado':'Referencias por defecto')+' · umbral '+p.threshold;
  document.querySelectorAll('.threshold-marker').forEach(el=>el.style.left=(p.threshold/10)+'%');
 };
 function populate(p){draft=p;for(let k=0;k<3;k++){ $app('white'+k).value=p.white[k];$app('black'+k).value=p.black[k];}$app('threshold').value=p.threshold;$app('thresholdValue').textContent=p.threshold+' / 1000';}
 $app('calibrate').addEventListener('click',()=>{
  paused=true;if(mode!=='idle'){setState('EN PAUSA');$app('pause').textContent='Continuar';}acc=0;
  populate(LINE_SENSOR.profile);$app('calibrationMessage').textContent='Mide las dos superficies y comprueba su contraste.';dialog.showModal();
 });
 $app('calibrationClose').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{if(mode==='idle')paused=false;});
 for(const [id,field,coverage] of [['sampleWhite','white',0],['sampleBlack','black',1]])$app(id).addEventListener('click',()=>{
  for(let k=0;k<3;k++)$app(field+k).value=LINE_SENSOR.raw(coverage);
  $app('calibrationMessage').textContent='Referencia '+(field==='white'?'blanca':'negra')+' medida en el banco virtual: '+LINE_SENSOR.raw(coverage)+' en cada sensor.';
 });
 $app('threshold').addEventListener('input',e=>$app('thresholdValue').textContent=e.target.value+' / 1000');
 $app('calibrationDefaults').addEventListener('click',()=>{populate(LINE_SENSOR.defaults());$app('calibrationMessage').textContent='Referencias restauradas en el formulario. Guarda para aplicarlas.';});
 $app('calibrationForm').addEventListener('submit',e=>{
  e.preventDefault();const next={...draft,white:[0,1,2].map(k=>Number($app('white'+k).value)),black:[0,1,2].map(k=>Number($app('black'+k).value)),threshold:Number($app('threshold').value),calibrated:true};
  try{const saved=LINE_SENSOR.save(next);showProfile();updateTelemetry();dialog.close();ui.feedback.textContent='Calibración aplicada'+(saved?' y guardada en este navegador.':'. El navegador no permite guardarla; se conserva en esta sesión.')+(paused&&mode!=='idle'?' Pulsa Continuar cuando quieras.':'');}
  catch(error){$app('calibrationMessage').textContent=error.message;}
 });
 showProfile();
}



