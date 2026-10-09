/* node tests/ui-contract.cjs — contrato entre index.html y los scripts v4.
   Los tests headless usan un DOM simulado que acepta cualquier id; este test comprueba el HTML real:
   cada id que leen los scripts existe, no hay ids duplicados y el orden de scripts es el esperado. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};

test('Sin ids duplicados en index.html',()=>{
 const dup=ids.filter((v,i)=>ids.indexOf(v)!==i);assert.deepEqual(dup,[]);
});
test('Todos los ids que usan los scripts existen en el HTML',()=>{
 const used=new Set();
 for(const f of ['simulator.js','iroh-runtime.js','renderer3d.js','calibration.js','ui-shell.js','calibration-mode.js','scenario-editor.js']){
  const src=fs.readFileSync(path.join(root,f),'utf8');
  for(const m of src.matchAll(/(?:\$app|\$|getElementById)\('([A-Za-z0-9_-]+)'\)/g))used.add(m[1]);
 }
 // Ids construidos dinámicamente en los scripts: 'val'+S, 'bar'+S, 'state'+S (S∈L,C,R), 'ir'+k, 'white'+k, 'black'+k (k∈0..2)
 for(const s of ['L','C','R'])for(const p of ['val'])used.add(p+s);   // «Más datos» retirado: ya no hay bar*/state*
 for(const k of [0,1])used.add('ir'+k);
 for(const k of [0,1,2]){used.add('white'+k);used.add('black'+k);}
 const missing=[...used].filter(id=>!ids.includes(id));
 assert.deepEqual(missing,[],'Ids usados por los scripts y ausentes del HTML: '+missing.join(', '));
 console.log('   ids comprobados: '+used.size);
});
test('Clases que consultan los scripts existen (.cam con data-view, .threshold-marker)',()=>{
 for(const v of ['perspective','top','follow','robot'])assert.match(html,new RegExp(`class="cam[^"]*" data-view="${v}"`));
 assert.equal((html.match(/class="threshold-marker"/g)||[]).length,0,'los marcadores vivían solo en «Más datos»; simulator.js los consulta con querySelectorAll (no-op sin elementos)');
});
test('Scripts en el orden v4 y ui-shell.js al final',()=>{
 const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(scripts,['tracks.js','extra-tracks.js','calibration.js','iroh-runtime.js','strike-physics.js','scenario-props.js','renderer3d.js','starters.js','simulator.js','syntax-highlight.js','ui-shell.js','calibration-mode.js','scenario-editor.js']);
});
test('Controles de la vista normal y ausencia de elementos pedagógicos visibles',()=>{
 for(const id of ['track','run','pause','reset','step','src','lcd','sonar','codeToggle'])assert.ok(ids.includes(id),id);
 // Fuera de los nodos de compatibilidad ocultos no debe haber contenido de sesiones ni misiones.
 const visible=html.replace(/<div hidden aria-hidden="true">.*?<\/div>/s,'').replace(/<dialog id="calibrationDialog".*?<\/dialog>/s,'');
 for(const word of [/misi[oó]n/i,/objetivos?\b/i,/\bOA\b/,/mentor/i,/progreso/i,/completad[oa]/i,/sesi[oó]n/i,/Tu experimento/i])assert.ok(!word.test(visible.replace(/<!--.*?-->/gs,'')),String(word));
});
test('Los cinco nodos legacy están dentro de un contenedor oculto (hidden + aria-hidden) y siguen en el DOM',()=>{
 const wrapper=html.match(/<div hidden aria-hidden="true">(.*?)<\/div>/s);
 assert.ok(wrapper,'contenedor oculto ausente');
 for(const id of ['calibrate','calibrationSummary','lessonTitle','lessonGoal','lessonQuestion'])assert.match(wrapper[1],new RegExp(`id="${id}"`),id);
 assert.match(wrapper[1],/<button id="calibrate" type="button" tabindex="-1">/);
});
test('PILOT-2: sin fila de título; controles secundarios en «Más»; telemetría compacta y datos avanzados en «Más datos»',()=>{
 assert.ok(!/workspace-heading/.test(html),'la fila de título redundante debe estar eliminada');
 assert.match(html,/<h1 class="sr-only">/,'conserva un h1 accesible');
 const menu=html.match(/<details class="menu pop" id="moreMenu">(.*?)<\/details>/s);assert.ok(menu,'menú Más');
 for(const id of ['codeToggle','speed','quality','showTrail','demo','clawLeft','clawCenter','clawRight','reference'])assert.match(menu[1],new RegExp(`id="${id}"`),id+' debe estar en «Más»');
 for(const id of ['ir0','ir1','pulsador'])assert.ok(!menu[1].includes(`id="${id}"`),id+' ya NO va en «Más»: es una entrada siempre visible');
 const strip=html.match(/<div class="telemetry-strip".*?<\/details>/s);assert.ok(strip,'franja de telemetría');
 for(const id of ['valL','valC','valR','sonar','motors','strikerStatus','lcd'])assert.match(strip[0],new RegExp(`id="${id}"`),id+' debe estar en la vista principal');
 for(const id of ['barL','barC','barR','stateL','stateC','stateR'])assert.ok(!strip[0].includes(`id="${id}"`),id+' no debe estar en la vista principal');
 assert.ok(!/more-data/.test(html),'«Más datos» retirado del HTML');
 for(const id of ['position','movedObjects','decision','runEvidence'])assert.ok(!ids.includes(id),id+' pertenecía a «Más datos» y ya no existe');
 for(const f of ['simulator.js','ui-shell.js','calibration-mode.js','scenario-editor.js'])assert.ok(!/\$app\('(?:position|movedObjects|decision|runEvidence)'\)/.test(fs.readFileSync(path.join(root,f),'utf8')),f+' no debe referenciar elementos retirados');
 assert.ok(!/1000 \/ 1000/.test(html),'no debe haber texto «1000 / 1000» estático');
});
test('PILOT-2: el editor documenta la salida con teclado y el canvas no depende de una columna lateral',()=>{
 assert.match(html,/Esc y luego Tab salen del editor/);
 assert.ok(!/class="telemetry-panel"|simulation-body/.test(html),'sin columna lateral de telemetría');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 assert.ok(!/\.simulation-body\{[^}]*grid-template-columns/.test(css));
});
test('PILOT-4: el <textarea> sigue siendo la entrada real; la capa de resaltado es decorativa y el editor tiene respaldo sin JS',()=>{
 const stack=html.match(/<div class="code-stack">(.*?)<\/div><\/div>/s);assert.ok(stack,'pila textarea + capa');
 assert.match(stack[1],/<textarea id="src"/);assert.match(stack[1],/<div class="hl-clip" aria-hidden="true">/);assert.match(stack[1],/<pre class="hl" id="hl"><\/pre>/);
 assert.ok(!/<textarea[^>]*\sstyle=/.test(html)&&!/class="hl[^"]*"[^>]*\sstyle=/.test(html),'sin estilos inline (CSP)');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 // El texto del textarea solo se hace transparente cuando la capa está activa (.has-hl): sin JS el código se ve.
 assert.match(css,/\.has-hl #src\{color:transparent/);assert.ok(!/(^|\})#src\{[^}]*color:transparent/m.test(css));
 assert.match(css,/forced-colors:active/);assert.match(css,/\.hl\{[^}]*pointer-events:none/);assert.match(css,/\.hl-clip\{[^}]*pointer-events:none/);
 // Métricas idénticas en textarea y capa (alineación): misma fuente, interlineado y relleno.
 const shared=css.match(/#src,\.hl\{([^}]*)\}/);assert.ok(shared,'reglas compartidas #src,.hl');for(const f of ['font:400 14px/24px','tab-size:2','white-space:pre','padding:12px 14px 12px 12px'])assert.ok(shared[1].includes(f),f);
});
test('PILOT-4: tokens de sintaxis = tema «bitiro-night» del Lab y LCD con bisel',()=>{
 const tokens=fs.readFileSync(path.join(root,'tokens.css'),'utf8');
 for(const [name,hex] of [['syn-api','#FF9A62'],['syn-keyword','#82B6D9'],['syn-string','#9FD4AF'],['syn-comment','#A3AAB2'],['syn-number','#F4C07A'],['syn-operator','#DCDCDC'],['syn-text','#E8E4DB'],['editor-selection','#63432E'],['editor-cursor','#FFAF75'],['syn-bracket-1','#FFD700'],['syn-bracket-2','#DA70D6'],['syn-bracket-3','#179FFF']])
  assert.match(tokens,new RegExp('--'+name+':'+hex+'(?![0-9A-Fa-f])','i'),name);
 assert.match(html,/<div class="lcd-bezel"><pre id="lcd"/);
 assert.ok(fs.existsSync(path.join(root,'syntax-highlight.js')));
});
test('Micro-pulido: cabecera sin «Local · Sin conexión» (pasa a «Más»), selector de pista de ancho fijo y deshabilitados claros',()=>{
 const header=html.match(/<header class="topbar">.*?<\/header>/s)[0];
 assert.ok(!/Sin conexión|top-note/.test(header),'la cabecera solo lleva la marca');
 const menu=html.match(/<details class="menu pop" id="moreMenu">(.*?)<\/details>/s)[1];assert.match(menu,/<p class="menu-note">Local · Sin conexión<\/p>/);
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 // El selector no puede crecer con nombres largos: ancho y máximo fijos (184 px; 150 px entre 1024 y 1279) y la <select> al 100 %.
 assert.match(css,/\.track-field\{[^}]*flex:0 1 184px;width:184px;max-width:184px\}/);assert.match(css,/\.track-field\{flex-basis:150px;width:150px;max-width:150px\}/);
 assert.match(css,/\.track-field select\{width:100%;text-overflow:ellipsis/);
 // Pausar / Paso / Reiniciar: misma altura que la toolbar (28 px) y deshabilitado visible sin depender de la opacidad.
 assert.match(css,/\.runtime-actions button\{min-height:28px;padding:4px 12px;font-weight:600\}/);assert.match(css,/\.runtime-actions button:disabled\{opacity:1;background:var\(--surface-panel-soft\)/);
});
test('PILOT-5: franja «Entradas» siempre visible con una sola representación interactiva por entrada',()=>{
 const strip=html.match(/<div class="inputs-strip" role="group" aria-label="Entradas del robot">(.*?)<\/div>\n/s);assert.ok(strip,'franja de entradas');
 const chips=[...strip[1].matchAll(/<button type="button" id="(\w+)" class="input-chip" aria-pressed="false" aria-label="([^"]+)">/g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(chips,[['pulsador','Pulsador'],['ir0','IR izquierdo'],['ir1','IR derecho']]);          // orden: Pulsador | IR izquierdo | IR derecho
 for(const id of ['pulsador','ir0','ir1'])assert.equal(html.split(`id="${id}"`).length-1,1,id+' aparece una sola vez');
 assert.ok(!/<details[^>]*>(?:(?!<\/details>).)*id="pulsador"/s.test(html),'las entradas no están dentro de ningún <details>/menú');
 assert.ok(html.indexOf('class="inputs-strip"')<html.indexOf('class="runtime-bar"'),'las entradas van antes de los controles de ejecución');
 assert.equal((strip[1].match(/<strong aria-hidden="true">Libre<\/strong>/g)||[]).length,3,'el estado visible no se duplica para lectores de pantalla (lo da aria-pressed)');
});
test('PILOT-5: S01–S08 sin selector de soluciones; «Restaurar código inicial» con confirmación; ejemplos solo en práctica libre',()=>{
 assert.match(html,/<label class="example-field" id="exampleField" hidden>/,'el selector de ejemplos arranca oculto (la pista inicial es S01)');
 assert.match(html,/<button type="button" id="restoreStarter" class="restore-button">Restaurar código inicial<\/button>/);
 const dlg=html.match(/<dialog id="restoreDialog"[^>]*>(.*?)<\/dialog>/s);assert.ok(dlg);assert.match(dlg[1],/id="restoreConfirm"/);assert.match(dlg[1],/id="restoreCancel"/);assert.ok(!/<form/.test(dlg[1]),'sin <form> (CSP form-action none)');
 assert.ok(fs.existsSync(path.join(root,'starters.js')));
 const help=html.match(/<dialog id="guideDialog".*?<\/dialog>/s)[0];   // la ayuda «Funciones y límites» pasó a la Guía (SIM-UI-RELEASE)
 assert.match(help,/leerBoton\(\)/);assert.match(help,/leerSensorObstaculoIzquierdo\(\)/);
});
test('Fuentes locales referenciadas existen y no se cargan recursos externos (el único enlace absoluto es la marca hacia el Lab)',()=>{
 const css=fs.readFileSync(path.join(root,'tokens.css'),'utf8');
 for(const m of css.matchAll(/url\(([^)]+)\)/g))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
 for(const f of ['tokens.css','styles.css'])assert.ok(!/https?:\/\//.test(fs.readFileSync(path.join(root,f),'utf8')),f+' contiene una URL externa');
 const absolute=[...html.replace(/<!--.*?-->/gs,'').matchAll(/https?:\/\/[^"'\s)<]+/g)].map(m=>m[0]);
 assert.deepEqual(absolute,[],'sin enlaces absolutos: el logo ya no navega a BITIRO Lab');
 for(const m of html.matchAll(/<(?:script|img|link|source|iframe)\b[^>]*\b(?:src|href)="([^"]+)"/g))assert.ok(!/^(?:https?:)?\/\//.test(m[1]),'recurso externo: '+m[1]);
});
test('NAV-1 (SIM-UI-RELEASE): el logo es un elemento visual sin navegación y la cabecera no contiene enlaces',()=>{
 const header=html.match(/<header class="topbar">.*?<\/header>/s)[0];
 assert.ok(!/<a\b/.test(header),'la cabecera no tiene enlaces');
 assert.ok(!/href=|target=|rel=/.test(header.match(/<div class="brand"[^>]*>/)[0]),'el logo no lleva href/target/rel');
 assert.match(header,/<div class="brand">/);
 assert.match(header,/<strong>BITIRO <span>Simulador<\/span><\/strong><small>Simulador libre del IROH<\/small>/);   // texto visible sin cambios
 assert.ok(!/>\s*Inicio\s*</.test(header));
 assert.ok(!/bitiro-piloto/.test(html),'sin referencias a BITIRO Lab');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');assert.match(css,/\.brand\{color:inherit;display:inline-flex/);
});
test('Guía: botón y diálogo integrados (ids, aria, cierre) y cableados en ui-shell.js',()=>{
 assert.match(html,/<button[^>]*id="guideOpen"[^>]*aria-haspopup="dialog"[^>]*aria-controls="guideDialog"/);
 assert.match(html,/<dialog id="guideDialog"[^>]*aria-labelledby="guideTitle"[^>]*aria-describedby="guideSub"/);
 for(const id of ['guideTitle','guideSub','guideClose'])assert.ok(ids.includes(id),id);
 assert.equal(ids.filter(i=>i==='guideDialog').length,1);
 const shell=fs.readFileSync(path.join(root,'ui-shell.js'),'utf8');
 for(const w of ["guideOpen.addEventListener('click'","guideClose?.addEventListener('click'","e.target===guideDialog"])assert.ok(shell.includes(w),w);
 assert.ok(!/<script[^>]*src="https?:/.test(html));
});
console.log(`\n${checks} comprobaciones de contrato de interfaz superadas.`);
