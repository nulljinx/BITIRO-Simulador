/* BITIRO Simulador · comportamiento de la capa de interfaz (sin física ni runtime).
   Solo cableado de presentación: menús, telemetría colapsable, Ejecutar de la barra, nombre de archivo,
   números de línea y resaltado de sintaxis del editor, salida del editor con teclado, scroll al simulador al ejecutar en vista apilada y
   ajuste de la cámara de perspectiva al tamaño del canvas. No modifica simulator.js ni renderer3d.js:
   solo lee `camera`/`track` y llama a `updateZoom()` (globales de simulator.js). */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

 /* ── Ajuste de cámara ────────────────────────────────────────────────────────────────
    El renderer escala por min(ancho, alto) del canvas; en canvas casi cuadrados o verticales el plano de la
    pista sobresale por la derecha con la distancia base. Esta función pura devuelve el factor (≥ 1) por el
    que multiplicar la distancia BASE del preset de perspectiva. Tabla medida con la proyección del renderer:
    [alto de pista cm, factor máximo (canvas vertical), aspecto a partir del cual ya cabe sin factor]. */
 const FIT_TABLE=[[140,1.22,1.26],[180,1.12,1.14],[200,1.10,1.11]];
 const FIT_PORTRAIT_ASPECT=.95,FIT_MIN=1,FIT_MAX=1.25;
 function fitParams(trackHeightCm){
  const h=Number.isFinite(trackHeightCm)?trackHeightCm:140;
  if(h<=FIT_TABLE[0][0])return [FIT_TABLE[0][1],FIT_TABLE[0][2]];
  for(let i=1;i<FIT_TABLE.length;i++){
   const a=FIT_TABLE[i-1],b=FIT_TABLE[i];
   if(h<=b[0]){const t=(h-a[0])/(b[0]-a[0]);return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
  }
  const last=FIT_TABLE[FIT_TABLE.length-1];return [last[1],last[2]];
 }
 function getPerspectiveFitFactor(width,height,trackHeightCm=140){
  if(!(width>0)||!(height>0))return 1;
  const [kMax,kneeAspect]=fitParams(trackHeightCm),aspect=width/height;
  const t=clamp((kneeAspect-aspect)/(kneeAspect-FIT_PORTRAIT_ASPECT),0,1);
  return clamp(1+(kMax-1)*t,FIT_MIN,FIT_MAX);
 }

 const view={name:'perspective',base:null,touched:false};
 const camReady=()=>typeof camera!=='undefined'&&camera&&typeof track!=='undefined'&&track;
 const canvasEl=$('scene');
 // La distancia siempre se calcula desde la distancia BASE del preset (nunca desde el valor ya ajustado).
 function applyFit(){
  if(!camReady()||view.name!=='perspective'||view.touched||view.base===null||!canvasEl)return;
  const r=canvasEl.getBoundingClientRect();
  camera.distance=view.base*getPerspectiveFitFactor(r.width,r.height,track.h);
  if(typeof updateZoom==='function')updateZoom();
 }
 function onPreset(name){
  view.name=name;view.touched=false;
  view.base=name==='perspective'&&camReady()?camera.distance:null;
  applyFit();
 }
 const markTouched=()=>{view.touched=true;};
 for(const b of document.querySelectorAll('.cam'))b.addEventListener('click',()=>onPreset(b.dataset.view));
 $('track')?.addEventListener('change',()=>onPreset('perspective'));
 const wrap=$('sceneWrap');
 wrap?.addEventListener('wheel',markTouched,{passive:true});
 wrap?.addEventListener('pointermove',e=>{if(e.buttons&1)markTouched();});
 $('zoomIn')?.addEventListener('click',markTouched);$('zoomOut')?.addEventListener('click',markTouched);
 let fitFrame=0;
 const scheduleFit=()=>{if(fitFrame)return;fitFrame=requestAnimationFrame(()=>{fitFrame=0;applyFit();});};
 if(typeof ResizeObserver==='function'&&canvasEl)new ResizeObserver(scheduleFit).observe(canvasEl);
 else addEventListener('resize',scheduleFit);
 onPreset('perspective');

 /* ── Menús emergentes: Escape (devuelve el foco) y clic fuera ─────────────────────── */
 const pops=[...document.querySelectorAll('details.pop')];
 document.addEventListener('click',e=>{for(const d of pops)if(d.open&&!d.contains(e.target))d.open=false;});
 for(const d of pops)d.addEventListener('keydown',e=>{if(e.key==='Escape'&&d.open){d.open=false;d.querySelector('summary').focus();}});
 for(const id of ['demo','reference','codeToggle'])$(id)?.addEventListener('click',()=>{const m=$('moreMenu');if(m)m.open=false;});

 /* ── Guía del editor (UI-GUIDE-1): <dialog> de solo lectura; no toca la simulación ─────────── */
 const guideDialog=$('guideDialog'),guideOpen=$('guideOpen'),guideClose=$('guideClose');
 if(guideDialog&&guideOpen&&typeof guideDialog.showModal==='function'){
  guideOpen.addEventListener('click',()=>{if(!guideDialog.open)guideDialog.showModal();});
  guideClose?.addEventListener('click',()=>guideDialog.close());
  guideDialog.addEventListener('click',e=>{if(e.target===guideDialog)guideDialog.close();});
  guideDialog.addEventListener('close',()=>guideOpen.focus());

  /* Buscador de instrucciones (SIM-GUIDE-NNJ-2): sin tildes ni mayúsculas, con relevancia. Cada palabra puntúa según dónde aparece:
     4 nombre de la tarjeta o del comando · 3 firma · 2 palabras clave · 1 texto explicativo y ejemplos. Coincidencias de 2 a 4 = principales;
     las de 1 = relacionadas (se muestran después y plegadas). Los resultados son copias de las tarjetas, en orden visual = orden de tabulación. */
  const gSearch=$('guideSearch'),gStatus=$('guideSearchStatus'),gEmpty=$('guideEmpty'),gResults=$('guideResults');
  if(gSearch&&gResults){
   const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
   const gBody=guideDialog.querySelector('.guide-body');
   const topics=[...guideDialog.querySelectorAll('.guide-topic')];
   const items=[...guideDialog.querySelectorAll('.guide-item')].map((el,order)=>{
    const h=el.querySelector('h4'),d=el.dataset||{};
    return {el,order,topic:el.closest('.guide-topic'),name:norm((h?h.textContent:'')+' '+(d.cmd||'')),cmds:norm(d.cmd).split(/\s+/).filter(Boolean),
     sig:norm(d.sig),keys:norm(d.keywords),body:norm(el.textContent)};
   });
   const SECONDARY_SHOWN=3;
   let openBefore=null;
   const score=(it,words)=>{
    let min=9;
    for(const w of words){const t=it.name.includes(w)?4:it.sig.includes(w)?3:it.keys.includes(w)?2:it.body.includes(w)?1:0;if(!t)return 0;min=Math.min(min,t);}
    return min+(words.length===1&&it.cmds.includes(words[0])?.5:0);
   };
   const card=it=>{
    const c=it.el.cloneNode(true),num=it.topic&&it.topic.querySelector('.guide-num'),title=it.topic&&it.topic.querySelector('summary strong');
    if(num&&title){const l=document.createElement('p');l.className='guide-result-topic';l.textContent='Tema '+num.textContent+' · '+title.textContent;c.insertBefore(l,c.firstChild);}
    return c;
   };
   const section=(title,list)=>{
    const sec=document.createElement('section'),h=document.createElement('h3'),grid=document.createElement('div');
    h.className='guide-results-title';h.textContent=title;grid.className='guide-results-list';
    sec.appendChild(h);sec.appendChild(grid);list.forEach(it=>grid.appendChild(card(it)));
    return {sec,grid};
   };
   const plural=(n,one,many)=>n+' '+(n===1?one:many);
   gSearch.addEventListener('input',()=>{
    const words=norm(gSearch.value).split(/\s+/).filter(Boolean);
    if(gBody)gBody.scrollTop=0;
    if(!words.length){
     gResults.textContent='';gResults.hidden=true;
     topics.forEach((t,k)=>{t.hidden=false;if(openBefore)t.open=openBefore[k];});openBefore=null;
     if(gEmpty)gEmpty.hidden=true;if(gStatus)gStatus.textContent='';return;
    }
    if(!openBefore)openBefore=topics.map(t=>t.open);
    const hits=items.map(it=>({it,s:score(it,words)})).filter(x=>x.s>0).sort((x,y)=>y.s-x.s||x.it.order-y.it.order);
    const main=hits.filter(x=>x.s>=2).map(x=>x.it),rel=hits.filter(x=>x.s<2).map(x=>x.it);
    topics.forEach(t=>{t.hidden=true;});
    gResults.textContent='';gResults.hidden=hits.length===0;
    if(gEmpty)gEmpty.hidden=hits.length>0;
    if(main.length)gResults.appendChild(section('Resultados principales',main).sec);
    if(rel.length){
     const {sec,grid}=section(main.length?'También se menciona en':'Tarjetas que mencionan tu búsqueda',rel);
     const extra=[...grid.children].slice(SECONDARY_SHOWN);
     if(extra.length){
      extra.forEach(c=>{c.hidden=true;});
      const btn=document.createElement('button');btn.type='button';btn.className='guide-more';btn.setAttribute('aria-expanded','false');btn.textContent='Ver '+extra.length+' más';
      btn.addEventListener('click',()=>{const open=btn.getAttribute('aria-expanded')!=='true';extra.forEach(c=>{c.hidden=!open;});btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'Ver menos':'Ver '+extra.length+' más';});
      sec.appendChild(btn);
     }
     gResults.appendChild(sec);
    }
    if(gStatus)gStatus.textContent=hits.length?(main.length?plural(main.length,'resultado principal','resultados principales'):'Sin coincidencias directas')+(rel.length?(main.length?' y ':'; ')+plural(rel.length,'relacionado','relacionados'):''):'Sin resultados';
   });
  }

  /* Copiar ejemplos: Clipboard API cuando existe y, si no, selección + execCommand; siempre informa el resultado. */
  const gCopyStatus=$('guideCopyStatus');
  guideDialog.addEventListener('click',async e=>{
   const b=e.target&&e.target.closest?e.target.closest('.guide-copy'):null;if(!b)return;
   const pre=guideDialog.querySelector('[data-program="'+b.dataset.copy+'"]');if(!pre)return;
   const text=pre.textContent;let ok=false;
   try{if(typeof navigator!=='undefined'&&navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);ok=true;}}catch{}
   if(!ok){
    try{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';
     guideDialog.appendChild(ta);ta.select();ok=document.execCommand('copy');ta.remove();b.focus();}catch{ok=false;}
   }
   const label=b.dataset.label||(b.dataset.label=b.textContent);
   b.textContent=ok?'¡Copiado!':'No se pudo copiar';
   if(gCopyStatus)gCopyStatus.textContent=ok?'Programa copiado al portapapeles.':'No se pudo copiar. Selecciona el código y usa Ctrl+C.';
   setTimeout(()=>{b.textContent=label;},1800);
  });
 }

 /* ── Telemetría: siempre abierta en escritorio y apilado ancho; colapsable en móvil ─ */
 const telemetry=$('telemetry'),wide=matchMedia('(min-width:1024px)');
 const syncTelemetry=()=>{if(telemetry&&wide.matches)telemetry.open=true;};
 wide.addEventListener?.('change',syncTelemetry);syncTelemetry();
 if(telemetry&&!wide.matches)telemetry.open=false;

 /* ── Ejecutar de la barra (start() es global de iroh-runtime.js) ─────────────────── */
 const msg=$('msg'),src=$('src'),stacked=matchMedia('(max-width:1023px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const RUN_SETTLE_MS=120,behavior=()=>reduced.matches?'auto':'smooth';
 const headerHeight=()=>{const h=document.querySelector('.topbar');return h?h.getBoundingClientRect().height:0;};
 // Vista apilada: tras iniciar bien, llevar al simulador salvo que el canvas ya esté a la vista.
 function goToSimulator(){
  if(!stacked.matches||!canvasEl)return;
  const r=canvasEl.getBoundingClientRect();
  if(r.top>=headerHeight()-1&&r.bottom<=innerHeight+1)return;
  $('viewportHost')?.scrollIntoView({behavior:behavior(),block:'start'});
 }
 // Error de código: el mensaje y el foco permanecen asociados al editor (se reabre si estaba oculto).
 function showEditorError(){
  const panel=$('codePanel');
  if(panel&&panel.hidden)$('codeToggle')?.click();
  if(!msg)return;
  if(stacked.matches)msg.scrollIntoView({behavior:behavior(),block:'nearest'});
  msg.focus({preventScroll:true});
 }
 function afterRun(){
  if(!msg||msg.querySelector('.err')||!msg.querySelector('.ok'))return;
  // Un error de ejecución inmediato (primer ciclo) llega en pocos ms: se espera un instante para no
  // desplazar al simulador y volver enseguida al editor.
  setTimeout(()=>{if(!msg.querySelector('.err'))goToSimulator();},RUN_SETTLE_MS);
 }
 $('runBar')?.addEventListener('click',()=>{start();afterRun();});
 $('run')?.addEventListener('click',afterRun);
 src?.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))afterRun();});
 let errorCount=0;
 if(msg&&typeof MutationObserver==='function')new MutationObserver(()=>{
  const n=msg.querySelectorAll('.err').length;
  if(n>errorCount)showEditorError();
  errorCount=n;
 }).observe(msg,{childList:true});

 /* ── Editor: Tab inserta espacios (simulator.js); Escape y luego Tab salen del editor ─
    Escucha en CAPTURA sobre el contenedor, antes del manejador de simulator.js, y le corta la
    propagación solo cuando corresponde. Mayús+Tab siempre navega hacia atrás. */
 const area=document.querySelector('.editor-area');let released=false;
 if(area&&src){
  area.addEventListener('keydown',e=>{
   if(e.target!==src)return;
   if(e.key==='Escape'){released=true;return;}
   if(e.key==='Tab'){
    if(e.shiftKey||released){released=false;e.stopImmediatePropagation();} // navegación normal del navegador
    return;
   }
   if(!['Shift','Control','Alt','Meta'].includes(e.key))released=false;
  },true);
  src.addEventListener('blur',()=>{released=false;});
 }

 /* ── Nombre de archivo según la pista ─────────────────────────────────────────────── */
 const trackSel=$('track'),fileName=$('fileName');
 const syncName=()=>{if(trackSel&&fileName)fileName.textContent='programa_'+trackSel.value+'.ino';};
 trackSel?.addEventListener('change',syncName);syncName();

 /* ── Código inicial por pista (S01–S08) y práctica libre (Óvalo/Ocho) ───────────────
    S01–S08 abren con su starter (sin la solución); el código guardado se conserva salvo que sea EXACTAMENTE uno de los
    ejemplos legacy que la versión anterior cargaba sola. Óvalo y Ocho conservan ejemplos completos. La resolución es una
    función pura (starters.js); aquí solo se aplica al abrir cada pista y se alterna «Ejemplo» ↔ «Restaurar código inicial». */
 const STARTERS=window.BITIRO_STARTERS,exampleField=$('exampleField'),restoreBtn=$('restoreStarter'),restoreDialog=$('restoreDialog');
 if(STARTERS&&src&&trackSel){
  const storedCode=id=>{try{return typeof BITIRO_STORAGE!=='undefined'&&BITIRO_STORAGE?BITIRO_STORAGE.get('bitiro:standalone:code:'+id):null;}catch{return null;}};
  const syncMode=()=>{const free=STARTERS.isFree(trackSel.value);if(exampleField)exampleField.hidden=!free;if(restoreBtn)restoreBtn.hidden=free;};
  const applyTrackCode=()=>{
   const id=trackSel.value,want=STARTERS.resolve(id,storedCode(id),typeof EJ!=='undefined'?EJ[0]:'');
   if(src.value!==want)src.value=want;
   syncMode();
  };
  const say=text=>{if(msg)msg.textContent=text;};
  const doRestore=()=>{
   const target=STARTERS.starter(trackSel.value);if(target===null)return;
   src.value=target;src.dispatchEvent(new Event('input',{bubbles:true}));   // simulator.js guarda el código al recibir «input»
   say('Código inicial restaurado.');src.focus({preventScroll:true});
  };
  trackSel.addEventListener('change',applyTrackCode);
  restoreBtn?.addEventListener('click',()=>{
   const id=trackSel.value,target=STARTERS.starter(id);if(target===null)return;
   if(src.value===target){say('El código ya es el código inicial.');return;}
   // Solo se pide confirmación si hay algo que perder (código distinto del inicial y no vacío).
   if(src.value.trim()!==''&&STARTERS.isModified(id,src.value)&&restoreDialog&&typeof restoreDialog.showModal==='function'){restoreDialog.showModal();$('restoreCancel')?.focus();return;}
   doRestore();
  });
  $('restoreConfirm')?.addEventListener('click',()=>{restoreDialog?.close();doRestore();});
  $('restoreCancel')?.addEventListener('click',()=>{restoreDialog?.close();restoreBtn?.focus({preventScroll:true});});
  applyTrackCode();
 }

 /* ── Editor: números de línea, resaltado de sintaxis y línea activa ───────────────────
    El <textarea> sigue siendo la entrada real (texto, selección, scroll, teclado). La capa .hl (aria-hidden,
    pointer-events:none) pinta encima el mismo texto coloreado y se desplaza con su scroll. Las funciones IROH
    resaltadas son exactamente las que reconoce el intérprete (Object.keys(FN) de iroh-runtime.js). */
 const gutter=$('gutter'),hl=$('hl'),hlLine=$('hlLine'),hlClip=document.querySelector('.hl-clip'),syntax=window.BITIRO_SYNTAX;
 if(src&&gutter){
  const LINE_H=24,PAD_TOP=12;
  let lastValue=null,lastTop=-1,lastLeft=-1,lastSel=-1,lastW=-1,lastH=-1,apiNames=null,activeLine=-1;
  const lineOf=pos=>{let n=0;const v=src.value;for(let i=0;i<pos&&i<v.length;i++)if(v.charCodeAt(i)===10)n++;return n;};
  const paintGutter=count=>{let h='';for(let i=0;i<count;i++)h+='<span class="ln'+(i===activeLine?' on':'')+'">'+(i+1)+'</span>'+(i<count-1?'\n':'');gutter.innerHTML=h;};
  const applyScroll=()=>{
   const top=src.scrollTop,left=src.scrollLeft;
   if(top!==lastTop||left!==lastLeft){lastTop=top;lastLeft=left;gutter.scrollTop=top;if(hl)hl.style.transform='translate('+(-left)+'px,'+(-top)+'px)';placeLine();}
  };
  const placeLine=()=>{if(hlLine)hlLine.style.transform='translateY('+(PAD_TOP+activeLine*LINE_H-src.scrollTop)+'px)';};
  const sync=()=>{
   let valueChanged=false;
   if(src.value!==lastValue){
    valueChanged=true;lastValue=src.value;
    if(hl&&syntax){
     apiNames=apiNames||new Set(typeof FN!=='undefined'?Object.keys(FN):[]);
     hl.innerHTML=syntax.highlight(lastValue,apiNames);
     if(area&&!area.classList.contains('has-hl'))area.classList.add('has-hl');
    }
   }
   const sel=src.selectionStart;
   if(valueChanged||sel!==lastSel){
    lastSel=sel;const line=lineOf(sel);
    if(valueChanged||line!==activeLine){activeLine=line;paintGutter(lastValue.split('\n').length);placeLine();}
   }
   applyScroll();
   if(hlClip&&(src.clientWidth!==lastW||src.clientHeight!==lastH)){lastW=src.clientWidth;lastH=src.clientHeight;hlClip.style.width=lastW+'px';hlClip.style.height=lastH+'px';}
   requestAnimationFrame(sync);
  };
  src.addEventListener('scroll',applyScroll);
  requestAnimationFrame(sync);
 }
 window.BITIRO_UI=Object.freeze({getPerspectiveFitFactor});
})();
