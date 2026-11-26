/* IROH Simulator · comportamiento de la identidad visual: bienvenida por sesión de pestaña y diálogo «Acerca de».
   Capa de interfaz pura: no lee ni escribe estado del simulador, no toca física, sensores, editor ni pistas.
   Persistencia: UNA clave, `bitiro:standalone:welcome:session:v1` (valor «1»), en sessionStorage: vive lo que vive la pestaña.
   · Pestaña nueva (o ventana nueva): la bienvenida se abre sola.
   · Recargar la misma pestaña: no vuelve a abrirse.
   · Cerrar la pestaña y abrir el simulador en otra: se abre de nuevo.
   Los navegadores pueden copiar sessionStorage al duplicar una pestaña o restaurar una sesión; en esos casos la bienvenida no reaparece.
   Las claves del código, el escenario y la calibración viven en localStorage y no se tocan. El indicador antiguo de localStorage
   (`bitiro:standalone:welcome:v1`) NO se lee ni se borra: simplemente deja de usarse.
   Si el almacenamiento falla, la bienvenida NO se abre sola (nunca insistimos si no podemos recordar la elección) y sigue
   disponible desde «Acerca de» → «Ver la bienvenida».
   Si el navegador no soporta <dialog>, el simulador queda accesible sin bienvenida. Sin JavaScript, los <dialog> permanecen cerrados. */
'use strict';
(()=>{
 const KEY='bitiro:standalone:welcome:session:v1';
 const $=id=>document.getElementById(id);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');

 // ── Bienvenida ─────────────────────────────────────────────────────────────────────────────────────────────
 const welcome=$('welcome');
 if(welcome&&typeof welcome.showModal==='function'){
  const enter=$('welcomeEnter'),main=$('workspace'),img=$('welcomeImg');
  const store={
   get:()=>{try{return sessionStorage.getItem(KEY);}catch{return null;}},
   set:()=>{try{sessionStorage.setItem(KEY,'1');return true;}catch{return false;}},
   // ¿Podemos recordar la elección? Sonda de escritura y borrado con una clave propia, sin tocar la clave real.
   works:()=>{try{sessionStorage.setItem(KEY+':probe','1');sessionStorage.removeItem(KEY+':probe');return true;}catch{return false;}}
  };
  let opener=null,leaving=false;
  const open=from=>{
   if(welcome.open)return;
   opener=from||null;
   if(img)img.loading='eager';                       // la imagen solo se descarga cuando la bienvenida va a verse
   welcome.showModal();
   enter?.focus({preventScroll:true});
  };
  const finish=()=>{
   welcome.classList.remove('is-leaving');leaving=false;
   welcome.close();
   store.set();
   (opener||main)?.focus({preventScroll:true});
  };
  const dismiss=()=>{
   if(!welcome.open||leaving)return;
   if(reduced.matches){finish();return;}
   leaving=true;welcome.classList.add('is-leaving');
   let done=false;const go=()=>{if(!done){done=true;finish();}};
   welcome.addEventListener('animationend',e=>{if(e.target===welcome)go();},{once:true});
   setTimeout(go,400);                               // red de seguridad si no llega animationend
  };
  welcome.addEventListener('cancel',e=>{e.preventDefault();});             // Escape no cierra: solo «Entrar al simulador»
  // `cancel` no basta: sin interacción previa (o al repetir Escape) el navegador cierra el <dialog> sin permitir cancelarlo. Lo impiden
  // closedby="none" (index.html) y, donde no se admite, anular la tecla; solo mientras la bienvenida está abierta.
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&welcome.open)e.preventDefault();},true);
  enter?.addEventListener('click',dismiss);
  document.addEventListener('iroh:welcome-open',e=>open(e.detail&&e.detail.from));   // desde «Acerca de» → «Ver la bienvenida»
  if(!store.get()&&store.works())open(null);
 }

 // ── «Acerca de» ────────────────────────────────────────────────────────────────────────────────────────────
 const about=$('aboutDialog'),aboutBtn=$('aboutOpen');
 if(about&&aboutBtn&&typeof about.showModal==='function'){
  const done=$('aboutDone'),x=$('aboutClose'),toWelcome=$('aboutWelcome');
  const close=()=>{if(about.open)about.close();};
  aboutBtn.addEventListener('click',()=>{about.showModal();done?.focus({preventScroll:true});});
  done?.addEventListener('click',close);
  x?.addEventListener('click',close);
  about.addEventListener('close',()=>{if(!about.dataset.handoff)aboutBtn.focus({preventScroll:true});delete about.dataset.handoff;});
  toWelcome?.addEventListener('click',()=>{
   about.dataset.handoff='1';close();
   document.dispatchEvent(new CustomEvent('iroh:welcome-open',{detail:{from:aboutBtn}}));   // al cerrar la bienvenida el foco vuelve a «Acerca de»
  });
 }
})();
