/* BITIRO Simulador · MODO CALIBRACIÓN (SIM-CALIBRATION-1) — capa de interfaz.
   Entrar es un cambio de INTERFAZ, no de runtime: no recarga, no recompila, no reinicia, no cambia el programa ni el estado de ejecución.
   Oculta el editor y los controles de programación, amplía el plotter (vista superior) y deja solo la LCD; el alumno mueve y gira el IROH
   a mano para observar, en la LCD, lo que SU programa decidió mostrar.
   If the NNJ did not program a reading to appear on the LCD, calibration does not show it.
   Este archivo NO lee ni escribe lecturas de sensores y NO escribe en la LCD. Solo mueve la pose del robot mediante
   window.BITIRO_MANUAL (simulator.js), que da prioridad a la pose manual sin detener el runtime. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const ws=$('workspace'),btn=$('calibrationMode'),layer=$('calibrationLayer'),grab=$('calibrationGrab'),rot=$('calibrationRotate'),canvas=$('scene'),telemetry=$('telemetry');
 if(!ws||!btn||!layer||!grab||!rot||!canvas)return;
 const MANUAL=()=>window.BITIRO_MANUAL,VIEW=()=>window.BITIRO_SCENE_VIEW;
 const HANDLE_CM=18,MIN_GRAB_PX=36,MARGIN_PX=24,MOVE_CM=1,MOVE_BIG_CM=5,TURN_DEG=5,TURN_FINE_DEG=1;
 let active=false,saved=null,raf=0,drag=null,grabPx=0,zoomTouched=false;

 // Todas las posiciones están en coordenadas del plotter (cm); la conversión píxel ↔ plano usa la MISMA cámara que el renderer.
 const pose=()=>({x:R.x,y:R.y});
 const project=(x,y,z=0)=>VIEW().projectGround(canvas,sceneTrack,camera,pose(),x,y,z);
 const pick=e=>{const r=canvas.getBoundingClientRect();return VIEW().pickGround(canvas,sceneTrack,camera,pose(),e.clientX-r.left,e.clientY-r.top);};

 function layout(){
  const c=project(R.x,R.y);
  if(!c){grab.hidden=rot.hidden=true;return;}
  grab.hidden=rot.hidden=false;
  const edge=project(R.x+MANUAL().bounds().minX,R.y),bodyPx=edge?Math.hypot(edge.x-c.x,edge.y-c.y):0;
  const size=Math.round(2*Math.max(MIN_GRAB_PX,bodyPx+10));
  if(size!==grabPx){grabPx=size;grab.style.width=grab.style.height=size+'px';grab.style.marginLeft=grab.style.marginTop=(-size/2)+'px';}
  grab.style.transform=`translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px)`;
  // Asa de rotación por delante del robot, siempre dentro del canvas para que sea alcanzable.
  const fx=Math.sin(R.th),fy=-Math.cos(R.th),h=project(R.x+fx*HANDLE_CM,R.y+fy*HANDLE_CM);
  const rect=canvas.getBoundingClientRect();
  const hx=Math.min(rect.width-MARGIN_PX,Math.max(MARGIN_PX,(h||c).x)),hy=Math.min(rect.height-MARGIN_PX,Math.max(MARGIN_PX,(h||c).y));
  rot.style.transform=`translate(${hx.toFixed(1)}px,${hy.toFixed(1)}px)`;
 }
 function loop(){if(!active)return;layout();raf=requestAnimationFrame(loop);}

 // ── arrastre del robot (Pointer Events: ratón, lápiz y táctil) ──
 function startDrag(e,kind){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const g=pick(e);if(!g)return;
  e.preventDefault();
  e.currentTarget.setPointerCapture?.(e.pointerId);
  drag={id:e.pointerId,kind,dx:R.x-g.x,dy:R.y-g.y};
  MANUAL().begin();
 }
 function moveDrag(e){
  if(!drag||e.pointerId!==drag.id)return;
  const g=pick(e);if(!g)return;
  if(drag.kind==='move')MANUAL().place(g.x+drag.dx,g.y+drag.dy,R.th);
  else{const dx=g.x-R.x,dy=g.y-R.y;if(Math.hypot(dx,dy)>1.5)MANUAL().place(R.x,R.y,Math.atan2(dx,-dy));}   // el frente del robot apunta al puntero
 }
 function endDrag(e){
  if(!drag||(e&&e.pointerId!==undefined&&e.pointerId!==drag.id))return;
  drag=null;MANUAL().end();
 }
 for(const [el,kind] of [[grab,'move'],[rot,'turn']]){
  el.addEventListener('pointerdown',e=>startDrag(e,kind));
  el.addEventListener('pointermove',moveDrag);
  el.addEventListener('pointerup',endDrag);
  el.addEventListener('pointercancel',endDrag);
  el.addEventListener('lostpointercapture',endDrag);
 }
 // Teclado (alternativa accesible): flechas mueven 1 cm (Mayús 5 cm) en el plano del plotter; en el asa, giran 5° (Mayús 1°).
 grab.addEventListener('keydown',e=>{
  const step=e.shiftKey?MOVE_BIG_CM:MOVE_CM,d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(!d)return;e.preventDefault();
  MANUAL().begin();MANUAL().place(R.x+d[0]*step,R.y+d[1]*step,R.th);MANUAL().end();
 });
 rot.addEventListener('keydown',e=>{
  const sign={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1}[e.key];if(!sign)return;e.preventDefault();
  const rad=(e.shiftKey?TURN_FINE_DEG:TURN_DEG)*Math.PI/180;
  MANUAL().begin();MANUAL().place(R.x,R.y,R.th+sign*rad);MANUAL().end();
 });
 layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();exit();}});

 // Ajusta la distancia de la vista superior para que el plotter quepa entero en el canvas. Proyecta las cuatro esquinas del plotter con la
 // MISMA cámara del renderer y escala la distancia respecto del punto principal (centro horizontal, 46 % del alto). Si el alumno hace zoom, deja de reajustarse.
 const FIT_MARGIN_PX=14;
 function fitTop(){
  if(!active||zoomTouched||!sceneTrack)return;
  const r=canvas.getBoundingClientRect(),w=r.width,h=r.height;if(w<20||h<20)return;
  const Wt=sceneTrack.physicalWidthCm,Ht=sceneTrack.physicalHeightCm,p0={x:w/2,y:h*.46};
  const corners=[[0,0],[Wt,0],[0,Ht],[Wt,Ht]].map(([x,y])=>project(x,y));
  if(corners.some(c=>!c))return;
  let s=Infinity;
  for(const c of corners){
   const dx=c.x-p0.x,dy=c.y-p0.y;
   if(dx>1)s=Math.min(s,(w-FIT_MARGIN_PX-p0.x)/dx);else if(dx<-1)s=Math.min(s,(p0.x-FIT_MARGIN_PX)/-dx);
   if(dy>1)s=Math.min(s,(h-FIT_MARGIN_PX-p0.y)/dy);else if(dy<-1)s=Math.min(s,(p0.y-FIT_MARGIN_PX)/-dy);
  }
  if(!Number.isFinite(s)||s<=0)return;
  camera.distance=Math.min(3.4,Math.max(.24,camera.distance/s));updateZoom();
 }
 if(typeof ResizeObserver==='function')new ResizeObserver(()=>fitTop()).observe(canvas);
 for(const ev of ['wheel'])$('sceneWrap')?.addEventListener(ev,()=>{if(active)zoomTouched=true;},{passive:true});
 for(const id of ['zoomIn','zoomOut'])$(id)?.addEventListener('click',()=>{if(active)zoomTouched=true;});

 // Cambia de vista pulsando el botón real de cámara: así simulator.js y ui-shell.js (ajuste de distancia) se enteran por igual.
 function setView(name){const b=document.querySelector(`.cam[data-view="${name}"]`);if(b)b.click();else cameraUI(name);}

 // ── entrar / salir: solo interfaz ──
 function enter(){
  if(active)return;
  saved={
   camera:{...camera},viewLabel:$('viewLabel')?.textContent,
   activeCam:document.querySelector('.cam.active')?.dataset.view||'perspective',
   telemetryOpen:telemetry?telemetry.open:true
  };
  active=true;zoomTouched=false;
  MANUAL().calibration=true;                      // el LED de detección del 3D deja de revelar lecturas
  ws.classList.add('calibration-mode');
  if(telemetry)telemetry.open=true;               // la LCD debe verse aunque la telemetría estuviera plegada (vista apilada)
  setView('top');                                 // vista superior: la manipulación y la lectura del plotter son más claras
  fitTop();
  layer.hidden=false;
  btn.setAttribute('aria-pressed','true');btn.textContent='Salir de calibración';
  layout();raf=requestAnimationFrame(loop);
  grab.focus({preventScroll:true});
 }
 function exit(){
  if(!active)return;
  drag=null;MANUAL().end();
  active=false;cancelAnimationFrame(raf);
  MANUAL().calibration=false;
  layer.hidden=true;
  ws.classList.remove('calibration-mode');
  if(telemetry)telemetry.open=saved.telemetryOpen;
  setView(saved.activeCam);Object.assign(camera,saved.camera);updateZoom();
  if($('viewLabel')&&saved.viewLabel)$('viewLabel').textContent=saved.viewLabel;
  btn.setAttribute('aria-pressed','false');btn.textContent='Calibración';
  saved=null;btn.focus({preventScroll:true});
 }
 btn.addEventListener('click',()=>active?exit():enter());
 window.BITIRO_CALIBRATION=Object.freeze({enter,exit,get active(){return active;}});
})();
