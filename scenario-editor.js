/* BITIRO · Editor del escenario (UI). Trabaja sobre un BORRADOR: nada cambia hasta «Aplicar».
   La lógica (modelo, validación física, persistencia) está en scenario-props.js; el estado del simulador, detrás de window.BITIRO_WORLD.
   La vista es un plano superior 2D propio (SVG, unidades = cm de la pista): no depende de la perspectiva 3D.
   No impone ninguna caja, ruta ni base: el estudiante coloca lo que quiera donde la física lo permita. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id),W=window.BITIRO_WORLD,S=window.BITIRO_SCENARIO;
 const dlg=$('scenarioDialog'),open=$('editScenario'),svg=$('scenarioMap');
 if(!dlg||!open||!svg||!W||!S||typeof dlg.showModal!=='function')return;
 const NS='http://www.w3.org/2000/svg',ROBOT_R=8.3;
 let track=null,draft=[],selected=null,armed=false,useDefault=false,drag=null,lastNote='';
 const node=(tag,attrs,parent)=>{const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n;};
 const note=text=>{lastNote=text;$('scenarioNote').textContent=text;};
 const label=id=>'Caja '+(draft.findIndex(b=>b.id===id)+1);
 const touch=()=>{useDefault=false;};            // cualquier edición propia convierte el borrador en escenario personalizado

 /* ── plano superior ─────────────────────────────────────────────────────────────── */
 function drawMap(){
  svg.replaceChildren();
  svg.setAttribute('viewBox','0 0 '+track.w+' '+track.h);svg.style.aspectRatio=track.w+' / '+track.h;
  node('rect',{class:'sc-floor',x:0,y:0,width:track.w,height:track.h},svg);
  for(const z of track.zones||[])node('rect',{class:'sc-zone '+(/red/.test(z.kind||'')?'red':'green'),x:z.x,y:z.y,width:z.width,height:z.height},svg);
  for(const m of track.markers||[])node('rect',{class:'sc-zone red',x:m.x,y:m.y,width:m.width,height:m.height},svg);
  for(const p of track.paths)node('polyline',{class:'sc-line',points:p.p.map(q=>q[0]+','+q[1]).join(' '),'stroke-width':p.w},svg);
  // Pose inicial del robot: solo referencia (círculo del cuerpo y flecha de avance).
  const s=track.start,g=node('g',{class:'sc-robot','aria-hidden':'true'},svg);
  node('circle',{cx:s.x,cy:s.y,r:ROBOT_R},g);
  node('line',{x1:s.x,y1:s.y,x2:s.x+ROBOT_R*Math.cos(s.heading),y2:s.y+ROBOT_R*Math.sin(s.heading)},g);
  draft.forEach((b,i)=>{
   const bg=node('g',{class:'sc-box'+(b.id===selected?' sel':''),'data-id':b.id},svg);
   node('rect',{x:b.x,y:b.y,width:b.width,height:b.height,rx:.6},bg);
   const t=node('text',{x:b.x+b.width/2,y:b.y+b.height/2,'text-anchor':'middle','dominant-baseline':'central'},bg);t.textContent=String(i+1);
  });
 }
 function drawList(){
  const ul=$('scenarioList');ul.replaceChildren();
  if(!draft.length){const li=document.createElement('li');li.className='scenario-empty';li.textContent='Escenario vacío.';ul.appendChild(li);}
  draft.forEach((b,i)=>{
   const li=document.createElement('li'),bt=document.createElement('button');
   bt.type='button';bt.className='button scenario-item';bt.textContent='Caja '+(i+1);bt.dataset.id=b.id;bt.setAttribute('aria-pressed',String(b.id===selected));
   bt.addEventListener('click',()=>{selected=b.id;armed=false;render();bt.focus({preventScroll:true});});
   li.appendChild(bt);ul.appendChild(li);
  });
 }
 function drawFields(){
  const b=draft.find(x=>x.id===selected),f=$('scenarioFields');
  f.disabled=!b;$('scenarioRemove').disabled=!b;
  $('scenarioSelName').textContent=b?label(b.id):'Sin caja seleccionada';
  $('scenarioX').value=b?b.x:'';$('scenarioY').value=b?b.y:'';
  $('scenarioX').max=String(track.w-S.SIZE);$('scenarioY').max=String(track.h-S.SIZE);$('scenarioX').min=$('scenarioY').min='0';
  $('scenarioAdd').setAttribute('aria-pressed',String(armed));
 }
 function render(){drawMap();drawList();drawFields();}

 /* ── operaciones ────────────────────────────────────────────────────────────────── */
 const pointOf=e=>{const m=svg.getScreenCTM();if(!m)return {x:0,y:0};const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return {x:p.x,y:p.y};};
 function commit(r,okText){
  if(!r.ok){if(r.reason!==lastNote)note(r.reason);return false;}
  draft=r.list;touch();if(okText)note(okText);return true;
 }
 svg.addEventListener('pointerdown',e=>{
  const g=e.target.closest&&e.target.closest('.sc-box'),p=pointOf(e);
  if(g){
   const b=draft.find(x=>x.id===g.dataset.id);if(!b)return;
   selected=b.id;armed=false;drag={id:b.id,dx:p.x-b.x,dy:p.y-b.y,pid:e.pointerId};
   try{svg.setPointerCapture(e.pointerId);}catch{/* sin captura: el arrastre sigue dentro del plano */}
   render();e.preventDefault();return;
  }
  if(armed){
   const r=S.addBox(draft,track,p.x-S.SIZE/2,p.y-S.SIZE/2);
   if(commit(r)){selected=r.box.id;armed=false;note(label(selected)+' añadida.');}
   render();e.preventDefault();return;
  }
  if(selected){selected=null;render();}
 });
 svg.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pid)return;
  const p=pointOf(e),r=S.moveBox(draft,track,drag.id,p.x-drag.dx,p.y-drag.dy);
  if(commit(r)){note('');const b=draft.find(x=>x.id===drag.id);
   const g=svg.querySelector('.sc-box[data-id="'+drag.id+'"]');
   if(g){g.firstChild.setAttribute('x',b.x);g.firstChild.setAttribute('y',b.y);g.lastChild.setAttribute('x',b.x+b.width/2);g.lastChild.setAttribute('y',b.y+b.height/2);}
   $('scenarioX').value=b.x;$('scenarioY').value=b.y;}
 });
 const endDrag=e=>{if(drag&&e.pointerId===drag.pid){try{svg.releasePointerCapture(e.pointerId);}catch{/* ya liberado */}drag=null;}};
 svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);

 $('scenarioAdd').addEventListener('click',e=>{
  if(e.detail===0){   // teclado o lector de pantalla: no hay puntero → primera posición libre desde el centro
   const r=S.firstFreeSpot(draft,track);
   if(commit(r)){selected=r.box.id;armed=false;note(label(selected)+' añadida. Ajusta X e Y.');render();$('scenarioX').focus();}else render();
   return;
  }
  armed=!armed;note(armed?'Toca el plano para colocar la caja.':'');drawFields();
 });
 $('scenarioRemove').addEventListener('click',()=>{
  if(!selected)return;const name=label(selected);draft=S.removeBox(draft,selected);selected=null;touch();note(name+' eliminada.');render();$('scenarioAdd').focus();
 });
 for(const id of ['scenarioX','scenarioY'])$(id).addEventListener('change',()=>{
  if(!selected)return;
  const r=S.moveBox(draft,track,selected,parseFloat($('scenarioX').value),parseFloat($('scenarioY').value));
  if(commit(r))note('');
  render();
 });
 $('scenarioClear').addEventListener('click',()=>{draft=[];selected=null;armed=false;useDefault=false;note('Escenario vacío. Pulsa Aplicar para guardarlo.');render();});
 $('scenarioDefault').addEventListener('click',()=>{draft=W.defaults();selected=null;armed=false;useDefault=true;note('Escenario predeterminado. Pulsa Aplicar para guardarlo.');render();});
 $('scenarioApply').addEventListener('click',()=>{
  const saved=W.apply(draft,{useDefault});dlg.close();
  const fb=$('feedback');if(fb)fb.textContent='Escenario aplicado: '+draft.length+(draft.length===1?' caja.':' cajas.')+(saved?'':' El navegador no permite guardarlo; se conserva en esta sesión.');
 });
 for(const id of ['scenarioCancel','scenarioClose'])$(id).addEventListener('click',()=>dlg.close());   // Escape también cierra y descarta
 dlg.addEventListener('close',()=>{drag=null;armed=false;const s=document.querySelector('#moreMenu > summary');if(s)s.focus({preventScroll:true});});

 open.addEventListener('click',()=>{
  const menu=$('moreMenu');if(menu)menu.open=false;
  W.beginEdit();track=W.track();draft=W.scenario();selected=null;armed=false;useDefault=false;lastNote='';
  note('');render();dlg.showModal();$('scenarioAdd').focus({preventScroll:true});
 });
})();
