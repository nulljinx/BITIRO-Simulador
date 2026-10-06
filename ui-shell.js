/* BITIRO Simulador · comportamiento de la capa de interfaz (sin física ni runtime).
   Solo cableado de presentación: menú secundario, telemetría colapsable, botón Ejecutar de la barra,
   nombre de archivo y números de línea del editor. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 // Menú «Más»: se cierra con Escape (devolviendo el foco) y al hacer clic fuera.
 const menu=$('moreMenu');
 if(menu){
  document.addEventListener('click',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
  menu.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();}});
  // Acciones del menú que cambian el estado del simulador cierran el panel para ver el resultado.
  for(const id of ['demo','strike','reference'])$(id)?.addEventListener('click',()=>{menu.open=false;});
 }
 // Telemetría: siempre abierta en escritorio; colapsable en móvil.
 const telemetry=$('telemetry'),wide=matchMedia('(min-width:768px)');
 const syncTelemetry=()=>{if(telemetry&&wide.matches)telemetry.open=true;};
 wide.addEventListener?.('change',syncTelemetry);syncTelemetry();
 if(telemetry&&!wide.matches)telemetry.open=false;
 // «Ejecutar» de la barra del simulador ejecuta el mismo programa del editor (start() es global de iroh-runtime.js).
 $('runBar')?.addEventListener('click',()=>{start();});
 // Nombre de archivo según la pista.
 const track=$('track'),fileName=$('fileName');
 const syncName=()=>{if(track&&fileName)fileName.textContent='programa_'+track.value+'.ino';};
 track?.addEventListener('change',syncName);syncName();
 // Números de línea: el intérprete informa errores «línea N».
 const src=$('src'),gutter=$('gutter');
 if(src&&gutter){
  let lastValue=null,lastTop=-1;
  const sync=()=>{
   if(src.value!==lastValue){lastValue=src.value;const n=lastValue.split('\n').length;let t='';for(let i=1;i<=n;i++)t+=i+(i<n?'\n':'');gutter.textContent=t;}
   if(src.scrollTop!==lastTop){lastTop=src.scrollTop;gutter.scrollTop=lastTop;}
   requestAnimationFrame(sync);
  };
  requestAnimationFrame(sync);
 }
})();
