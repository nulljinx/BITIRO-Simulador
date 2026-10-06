/* node tests/ui-shell.cjs — contrato determinista de ui-shell.js con un DOM simulado (sin navegador):
   ajuste de cámara (función pura y sin acumulación), salida del editor con Escape+Tab, y scroll al
   simulador al ejecutar solo en vista apilada. Los comportamientos reales se verifican además en navegador. */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};

function makeEnv({stacked=false,reduced=false,wide=!stacked,editor=false}={}){
 const timers=[],rafs=[],calls=[];
 const mqs={'(max-width:1023px)':{matches:stacked},'(prefers-reduced-motion: reduce)':{matches:reduced},'(min-width:1024px)':{matches:wide}};
 const mq=q=>({...(mqs[q]||{matches:false}),get matches(){return (mqs[q]||{matches:false}).matches;},addEventListener(){}});
 function el(id,extra={}){
  const listeners={};
  const classes=new Set();
  return Object.assign({id,dataset:{},listeners,open:false,hidden:false,style:{},innerHTML:'',classList:{add:c=>classes.add(c),contains:c=>classes.has(c),remove:c=>classes.delete(c)},
   addEventListener(t,fn,cap){(listeners[t]=listeners[t]||[]).push({fn,cap:cap===true||(cap&&cap.capture)});},
   focus(o){calls.push(['focus',id,o]);},scrollIntoView(o){calls.push(['scrollIntoView',id,o]);},click(){calls.push(['click',id]);
    for(const l of listeners.click||[])l.fn({target:this});},
   getBoundingClientRect(){return {top:0,bottom:0,width:0,height:0};},querySelector(){return null;},querySelectorAll(){return [];},contains(){return false;}},extra);
 }
 const ids=['scene','track','sceneWrap','zoomIn','zoomOut','telemetry','msg','src','runBar','run','codePanel','codeToggle','viewportHost','moreMenu','demo','strike','reference','fileName','gutter'].concat(editor?['hl','hlLine']:[]);
 const els=Object.fromEntries(ids.map(i=>[i,el(i)]));
 els.src.value='';els.src.scrollTop=0;els.track.value='s01';
 els.moreMenu.querySelector=()=>el('summary');els.moreMenu.contains=()=>false;
 const canvasRect={top:700,bottom:1100,width:600,height:600};
 els.scene.getBoundingClientRect=()=>({...canvasRect});
 // contenido de #msg: lista de {cls}
 const msgChildren=[];
 els.msg.querySelector=s=>msgChildren.find(c=>'.'+c.cls===s)||null;
 els.msg.querySelectorAll=s=>msgChildren.filter(c=>'.'+c.cls===s);
 const area=el('editor-area');const topbar=el('topbar');topbar.getBoundingClientRect=()=>({height:56,top:0,bottom:56});
 const camBtns=['perspective','top','follow','robot'].map(v=>{const b=el('cam_'+v);b.dataset.view=v;return b;});
 const pop=els.moreMenu;
 const observers={resize:[],mutation:[]};
 const docListeners={};
 const hlClip=editor?el('hl-clip'):null;
 const doc={getElementById:i=>els[i]||null,querySelector:s=>s==='.topbar'?topbar:s==='.editor-area'?area:s==='.hl-clip'?hlClip:null,
  querySelectorAll:s=>s==='.cam'?camBtns:s==='details.pop'?[pop]:[],addEventListener(t,fn){(docListeners[t]=docListeners[t]||[]).push(fn);}};
 const ctx={document:doc,window:null,console,Math,Number,Array,Object,innerHeight:844,
  matchMedia:mq,
  ResizeObserver:class{constructor(cb){observers.resize.push(cb);}observe(){}},
  MutationObserver:class{constructor(cb){observers.mutation.push(cb);}observe(){}},
  requestAnimationFrame:fn=>{rafs.push(fn);return rafs.length;},
  setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
  camera:{azimuth:.1,elevation:.94,distance:1.8,follow:false},track:{h:140},
  updateZoom(){calls.push(['updateZoom',ctx.camera.distance]);},start(){calls.push(['start']);}};
 ctx.window=ctx;vm.createContext(ctx);
 if(editor){ctx.FN={avanzar:1,pausa:1,escribirPantalla:1};vm.runInContext(fs.readFileSync(path.join(root,'syntax-highlight.js'),'utf8'),ctx,{filename:'syntax-highlight.js'});}
 vm.runInContext(fs.readFileSync(path.join(root,'ui-shell.js'),'utf8'),ctx,{filename:'ui-shell.js'});
 const flushRaf=()=>{const q=rafs.splice(0);for(const f of q)f();};
 const flushTimers=()=>{const q=timers.splice(0);for(const t of q)t.fn();};
 // Despacha un evento de teclado en #src con captura en el contenedor y luego manejadores del propio elemento.
 function key(k,{shift=false,ctrl=false}={}){
  const e={key:k,shiftKey:shift,ctrlKey:ctrl,metaKey:false,target:els.src,defaultPrevented:false,stopped:false,
   preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
  for(const l of area.listeners.keydown||[])if(l.cap&&!e.stopped)l.fn(e);
  for(const l of els.src.listeners.keydown||[])if(!e.stopped)l.fn(e);
  return e;
 }
 return {hlClip,ctx,els,area,calls,mqs,canvasRect,observers,flushRaf,flushTimers,key,msgChildren,camBtns,timers,docListeners,
  setMsg(...classes){msgChildren.length=0;for(const c of classes)msgChildren.push({cls:c});},
  mutateMsg(){for(const cb of observers.mutation)cb([]);},
  resize(w,h){canvasRect.width=w;canvasRect.height=h;for(const cb of observers.resize)cb();flushRaf();}};
}

/* ---------- 1. Función pura ---------- */
const {getPerspectiveFitFactor:fit}=makeEnv().ctx.BITIRO_UI;
test('getPerspectiveFitFactor: pura, acotada a [1; 1,25] y monótona en el aspecto',()=>{
 for(const [w,h] of [[584,633],[327,459],[466,415],[0,100],[100,0],[NaN,5],[-3,4],[2000,100]]){
  const f=fit(w,h,140);assert.ok(f>=1&&f<=1.25,`${w}×${h} → ${f}`);assert.equal(fit(w,h,140),f);
 }
 assert.equal(fit(0,100),1);assert.equal(fit(100,0),1);assert.equal(fit(NaN,5),1);
 let prev=Infinity;for(let a=.4;a<=2.5;a+=.01){const f=fit(a*500,500,140);assert.ok(f<=prev+1e-12,'no monótona en '+a);prev=f;}
 // Valores medidos con la proyección del renderer (S01, 100×140): canvas casi cuadrado necesita ≈1,22; ancho ≥1,26 → 1.
 assert.ok(Math.abs(fit(584,633,140)-1.22)<1e-9);assert.equal(fit(1260,1000,140),1);assert.equal(fit(2000,500,140),1);
 // Pistas más altas necesitan menos corrección, de forma continua.
 assert.ok(fit(500,600,200)<fit(500,600,180)&&fit(500,600,180)<fit(500,600,140));
 assert.equal(fit(500,600),fit(500,600,140));assert.equal(fit(500,600,NaN),fit(500,600,140));
});

/* ---------- 2. Cámara: parte siempre de la distancia base ---------- */
test('Cámara: factor aplicado desde la base; sin acumulación al repetir pista, cámara o tamaño',()=>{
 const E=makeEnv();E.canvasRect.width=584;E.canvasRect.height=633;E.ctx.camera.distance=1.8;
 // ui-shell ya se ejecutó con el canvas por defecto (600×600); reiniciamos el escenario con eventos reales.
 const persp=E.camBtns[0],top=E.camBtns[1];
 const go=()=>{E.ctx.camera.distance=1.8;E.ctx.camera.follow=false;for(const l of persp.listeners.click)l.fn({target:persp});};
 go();const d1=E.ctx.camera.distance;assert.ok(Math.abs(d1-1.8*fit(584,633,140))<1e-12);
 for(let i=0;i<10;i++)go();assert.equal(E.ctx.camera.distance,d1);
 // Cambios repetidos de tamaño: siempre base × f(tamaño actual)
 for(const [w,h] of [[900,500],[584,633],[327,459],[584,633]]){E.resize(w,h);assert.ok(Math.abs(E.ctx.camera.distance-1.8*fit(w,h,140))<1e-12,`${w}×${h}`);}
 assert.equal(E.ctx.camera.distance,d1);
 // Cambio de pista (más alta) vuelve al preset: la base nueva es 1,9
 E.ctx.track={h:200};E.ctx.camera.distance=1.9;for(const l of E.els.track.listeners.change)l.fn({});assert.ok(Math.abs(E.ctx.camera.distance-1.9*fit(584,633,200))<1e-12);
 // Otras vistas no se tocan
 E.ctx.camera.distance=2.3;for(const l of top.listeners.click)l.fn({target:top});E.resize(327,459);assert.equal(E.ctx.camera.distance,2.3);
 // El indicador de zoom se refresca con la función existente de simulator.js
 assert.ok(E.calls.some(c=>c[0]==='updateZoom'));
});
test('Cámara: si el usuario hace zoom el redimensionado no lo pisa; Perspectiva lo restaura',()=>{
 const E=makeEnv();E.canvasRect.width=584;E.canvasRect.height=633;const persp=E.camBtns[0];
 E.ctx.camera.distance=1.8;for(const l of persp.listeners.click)l.fn({target:persp});
 E.ctx.camera.distance*=1.17;for(const l of E.els.zoomOut.listeners.click)l.fn({});const user=E.ctx.camera.distance;
 E.resize(327,459);assert.equal(E.ctx.camera.distance,user);
 E.ctx.camera.distance=1.8;for(const l of persp.listeners.click)l.fn({target:persp});assert.ok(Math.abs(E.ctx.camera.distance-1.8*fit(327,459,140))<1e-12);
});

/* ---------- 3. Editor: Tab inserta; Escape y luego Tab salen ---------- */
// Réplica fiel del manejador de simulator.js (se comprueba su existencia más abajo).
function installLegacyTab(E){E.els.src.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();E.calls.push(['legacy-insert-spaces']);}});}
test('simulator.js conserva el manejador de Tab que ui-shell.js debe respetar',()=>{
 const src=fs.readFileSync(path.join(root,'simulator.js'),'utf8');
 assert.match(src,/\$app\('src'\)\.addEventListener\('keydown',e=>\{if\(e\.key==='Tab'\)\{e\.preventDefault\(\);/);
});
test('Editor: Tab inserta espacios mientras se escribe; Escape + Tab sale; Mayús+Tab siempre sale',()=>{
 const E=makeEnv();installLegacyTab(E);const inserted=()=>E.calls.filter(c=>c[0]==='legacy-insert-spaces').length;
 let e=E.key('Tab');assert.equal(e.defaultPrevented,true);assert.equal(inserted(),1);          // inserta, retiene el foco
 E.key('Tab');assert.equal(inserted(),2);                                                      // sigue insertando
 E.key('Escape');e=E.key('Tab');assert.equal(e.defaultPrevented,false);assert.equal(inserted(),2); // Escape + Tab: navegación normal
 e=E.key('Tab');assert.equal(e.defaultPrevented,true);assert.equal(inserted(),3);              // la liberación es de un solo uso
 E.key('Escape');E.key('a');e=E.key('Tab');assert.equal(e.defaultPrevented,true);assert.equal(inserted(),4); // escribir cancela
 E.key('Escape');E.key('Shift');e=E.key('Tab');assert.equal(e.defaultPrevented,false);          // modificadores no cancelan
 e=E.key('Tab',{shift:true});assert.equal(e.defaultPrevented,false);assert.equal(inserted(),4); // Mayús+Tab no inserta
 E.key('Escape');for(const l of E.els.src.listeners.blur||[])l.fn();e=E.key('Tab');assert.equal(e.defaultPrevented,true); // blur reinicia
 e=E.key('Enter',{ctrl:true});assert.equal(e.defaultPrevented,false);                           // Ctrl+Enter no se intercepta
});

/* ---------- 4. Ejecutar: scroll al simulador solo en vista apilada ---------- */
const scrolls=E=>E.calls.filter(c=>c[0]==='scrollIntoView'&&c[1]==='viewportHost');
test('Apilado: tras iniciar bien se desplaza al simulador (suave), salvo con reduced-motion (inmediato)',()=>{
 for(const [reduced,expected] of [[false,'smooth'],[true,'auto']]){
  const E=makeEnv({stacked:true,reduced});E.canvasRect.top=900;E.canvasRect.bottom=1300;E.ctx.innerHeight=844;
  E.setMsg('ok');for(const l of E.els.run.listeners.click)l.fn({});assert.equal(scrolls(E).length,0,'debe esperar el instante de asentamiento');
  E.flushTimers();const s=scrolls(E);assert.equal(s.length,1);assert.equal(s[0][2].behavior,expected);assert.equal(s[0][2].block,'start');
 }
});
test('Apilado: si el canvas ya está visible no se desplaza; con Ejecutar de la barra e inicio por Ctrl+Enter también aplica',()=>{
 let E=makeEnv({stacked:true});E.canvasRect.top=120;E.canvasRect.bottom=520;E.setMsg('ok');for(const l of E.els.run.listeners.click)l.fn({});E.flushTimers();assert.equal(scrolls(E).length,0);
 E=makeEnv({stacked:true});E.canvasRect.top=900;E.canvasRect.bottom=1300;E.setMsg('ok');for(const l of E.els.runBar.listeners.click)l.fn({});assert.ok(E.calls.some(c=>c[0]==='start'));E.flushTimers();assert.equal(scrolls(E).length,1);
 E=makeEnv({stacked:true});E.canvasRect.top=900;E.canvasRect.bottom=1300;E.setMsg('ok');E.key('Enter',{ctrl:true});E.flushTimers();assert.equal(scrolls(E).length,1);
});
test('Escritorio (editor y simulador visibles): ejecutar no desplaza nada',()=>{
 const E=makeEnv({stacked:false});E.canvasRect.top=900;E.canvasRect.bottom=1300;E.setMsg('ok');
 for(const l of E.els.run.listeners.click)l.fn({});E.key('Enter',{ctrl:true});E.flushTimers();assert.equal(E.calls.filter(c=>c[0]==='scrollIntoView').length,0);
});
test('Errores: nunca van al simulador; el mensaje queda visible y con foco (apilado) y el editor se reabre si estaba oculto',()=>{
 let E=makeEnv({stacked:true});E.canvasRect.top=900;E.canvasRect.bottom=1300;E.setMsg('err');E.mutateMsg();
 assert.deepEqual(E.calls.filter(c=>c[0]==='scrollIntoView').map(c=>c[1]),['msg']);assert.ok(E.calls.some(c=>c[0]==='focus'&&c[1]==='msg'));
 for(const l of E.els.run.listeners.click)l.fn({});E.flushTimers();assert.equal(scrolls(E).length,0);
 // error de ejecución tardío tras ir al simulador: vuelve al mensaje
 E=makeEnv({stacked:true});E.canvasRect.top=900;E.canvasRect.bottom=1300;E.setMsg('ok');for(const l of E.els.run.listeners.click)l.fn({});E.flushTimers();assert.equal(scrolls(E).length,1);
 E.setMsg('ok','err');E.mutateMsg();assert.ok(E.calls.some(c=>c[0]==='scrollIntoView'&&c[1]==='msg'));
 // mismo error repetido sin nuevo aumento no vuelve a disparar
 const n=E.calls.length;E.setMsg('ok','err');E.mutateMsg();assert.equal(E.calls.length,n);
 // editor oculto en escritorio: se reabre vía #codeToggle y el mensaje recibe el foco
 E=makeEnv({stacked:false});E.els.codePanel.hidden=true;E.setMsg('err');E.mutateMsg();
 assert.ok(E.calls.some(c=>c[0]==='click'&&c[1]==='codeToggle'));assert.ok(E.calls.some(c=>c[0]==='focus'&&c[1]==='msg'));assert.equal(E.calls.filter(c=>c[0]==='scrollIntoView').length,0);
});
test('Menús: Escape cierra y el clic fuera cierra; la telemetría está abierta en escritorio y colapsada en móvil',()=>{
 const E=makeEnv({stacked:false});E.els.moreMenu.open=true;
 for(const l of E.els.moreMenu.listeners.keydown)l.fn({key:'Escape'});assert.equal(E.els.moreMenu.open,false);assert.ok(E.calls.some(c=>c[0]==='focus'));
 E.els.moreMenu.open=true;for(const f of E.docListeners.click)f({target:{}});assert.equal(E.els.moreMenu.open,false); // clic fuera
 E.els.moreMenu.open=true;E.els.moreMenu.contains=()=>true;for(const f of E.docListeners.click)f({target:{}});assert.equal(E.els.moreMenu.open,true); // clic dentro no cierra
 assert.equal(E.els.telemetry.open,true);
 const M=makeEnv({stacked:true,wide:false});assert.equal(M.els.telemetry.open,false);
});

/* ---------- 5. Editor: capa de resaltado sincronizada con el textarea real ---------- */
const plain=h=>h.replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
test('Editor: la capa refleja exactamente el texto del textarea y colorea solo la API del runtime',()=>{
 const E=makeEnv({editor:true});const src=E.els.src;
 src.value='// avanzar(1)\navanzar(30); x = pausa;\nescribirPantalla(0,0,"pausa(1)"); avansar(2); a < b && c';src.selectionStart=0;src.clientWidth=500;src.clientHeight=400;
 E.flushRaf();
 assert.equal(plain(E.els.hl.innerHTML),src.value);                                   // el resaltado no altera el texto
 assert.deepEqual([...E.els.hl.innerHTML.matchAll(/<span class="t-api">([^<]+)<\/span>/g)].map(m=>m[1]),['avanzar','escribirPantalla']);
 assert.ok(E.area.classList.contains('has-hl'));                                      // solo entonces el textarea se vuelve transparente
 assert.equal((E.els.gutter.innerHTML.match(/class="ln/g)||[]).length,3);assert.match(E.els.gutter.innerHTML,/class="ln on">1</);
 assert.equal(E.hlClip.style.width,'500px');assert.equal(E.hlClip.style.height,'400px');
 // cambios externos (cambio de pista/ejemplo) sin evento input: la capa se actualiza en el siguiente frame
 src.value='pausa(5);\n\n\nint x;';E.flushRaf();assert.equal(plain(E.els.hl.innerHTML),src.value);assert.equal((E.els.gutter.innerHTML.match(/class="ln/g)||[]).length,4);
 // mover el cursor cambia la línea activa
 src.selectionStart=src.value.indexOf('int');E.flushRaf();assert.match(E.els.gutter.innerHTML,/class="ln on">4</);
 assert.equal(E.els.hlLine.style.transform,'translateY('+(12+3*24)+'px)');
});
test('Editor: el scroll vertical y horizontal del textarea mueve la capa, el gutter y la línea activa',()=>{
 const E=makeEnv({editor:true});const src=E.els.src;src.value=Array.from({length:60},(_,i)=>'avanzar('+i+');').join('\n');src.selectionStart=src.value.indexOf('avanzar(10)');src.clientWidth=400;src.clientHeight=300;E.flushRaf();
 src.scrollTop=120;src.scrollLeft=30;for(const l of src.listeners.scroll)l.fn({});
 assert.equal(E.els.hl.style.transform,'translate(-30px,-120px)');assert.equal(E.els.gutter.scrollTop,120);assert.equal(E.els.hlLine.style.transform,'translateY('+(12+10*24-120)+'px)');
 src.scrollTop=0;src.scrollLeft=0;E.flushRaf();assert.equal(E.els.hl.style.transform,'translate(0px,0px)');
});
test('Editor: sin la capa (sin syntax-highlight.js) el textarea conserva su texto visible',()=>{
 const E=makeEnv({editor:false});E.els.src.value='avanzar(1);';E.flushRaf();assert.ok(!E.area.classList.contains('has-hl'));
});
console.log(`\n${checks} comprobaciones de ui-shell.js superadas.`);
