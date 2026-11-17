/* IROH Simulator · comportamiento de la identidad visual (SIM-IROH-UI-1): bienvenida de primera visita y diálogo «Acerca de».
   Capa de interfaz pura: no lee ni escribe estado del simulador, no toca física, sensores, editor ni pistas.
   Persistencia: UNA clave nueva, `bitiro:standalone:welcome:v1` (valor «1»), vía window.BITIRO_STORAGE. Las claves del código,
   el escenario y la calibración no se tocan. Si el almacenamiento falla, la bienvenida NO se abre sola (nunca insistimos
   si no podemos recordar la elección) y sigue disponible desde la cabecera.
   Si el navegador no soporta <dialog>, el simulador queda accesible sin bienvenida. Sin JavaScript, los <dialog> permanecen cerrados. */
'use strict';
(()=>{
 const KEY='bitiro:standalone:welcome:v1';
 const $=id=>document.getElementById(id);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');

 // ── Bienvenida ─────────────────────────────────────────────────────────────────────────────────────────────
 const welcome=$('welcome');
 if(welcome&&typeof welcome.showModal==='function'){
  const enter=$('welcomeEnter'),closeBtn=$('welcomeClose'),reopen=$('welcomeReopen'),main=$('workspace'),img=$('welcomeImg');
  const S=()=>window.BITIRO_STORAGE;
  const store={
   get:()=>{const s=S();if(s)return s.get(KEY);try{return localStorage.getItem(KEY);}catch{return null;}},
   set:()=>{const s=S();if(s)return s.set(KEY,'1');try{localStorage.setItem(KEY,'1');return true;}catch{return false;}},
   // ¿Podemos recordar la elección? Sonda de escritura y borrado con una clave propia, sin tocar la clave real.
   works:()=>{const s=S();if(!s)return false;return s.set(KEY+':probe','1')===true&&s.remove(KEY+':probe')===true;}
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
  welcome.addEventListener('cancel',e=>{e.preventDefault();dismiss();});   // Escape
  enter?.addEventListener('click',dismiss);
  closeBtn?.addEventListener('click',dismiss);
  reopen?.addEventListener('click',()=>open(reopen));
  document.addEventListener('iroh:welcome-open',e=>open(e.detail&&e.detail.from));   // p. ej. desde «Acerca de»
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
