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
 for(const f of ['simulator.js','iroh-runtime.js','renderer3d.js','calibration.js','ui-shell.js']){
  const src=fs.readFileSync(path.join(root,f),'utf8');
  for(const m of src.matchAll(/(?:\$app|\$|getElementById)\('([A-Za-z0-9_-]+)'\)/g))used.add(m[1]);
 }
 // Ids construidos dinámicamente en los scripts: 'val'+S, 'bar'+S, 'state'+S (S∈L,C,R), 'ir'+k, 'white'+k, 'black'+k (k∈0..2)
 for(const s of ['L','C','R'])for(const p of ['val','bar','state'])used.add(p+s);
 for(const k of [0,1])used.add('ir'+k);
 for(const k of [0,1,2]){used.add('white'+k);used.add('black'+k);}
 const missing=[...used].filter(id=>!ids.includes(id));
 assert.deepEqual(missing,[],'Ids usados por los scripts y ausentes del HTML: '+missing.join(', '));
 console.log('   ids comprobados: '+used.size);
});
test('Clases que consultan los scripts existen (.cam con data-view, .threshold-marker)',()=>{
 for(const v of ['perspective','top','follow','robot'])assert.match(html,new RegExp(`class="cam[^"]*" data-view="${v}"`));
 assert.ok((html.match(/class="threshold-marker"/g)||[]).length>=3);
});
test('Scripts en el orden v4 y ui-shell.js al final',()=>{
 const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(scripts,['tracks.js','extra-tracks.js','calibration.js','iroh-runtime.js','strike-physics.js','renderer3d.js','simulator.js','ui-shell.js']);
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
 for(const id of ['codeToggle','speed','quality','showTrail','ir0','ir1','demo','strike','reference'])assert.match(menu[1],new RegExp(`id="${id}"`),id+' debe estar en «Más»');
 const strip=html.match(/<div class="telemetry-strip".*?<details class="more-data pop"/s);assert.ok(strip,'franja de telemetría');
 for(const id of ['valL','valC','valR','sonar','motors','strikerStatus','lcd'])assert.match(strip[0],new RegExp(`id="${id}"`),id+' debe estar en la vista principal');
 for(const id of ['barL','barC','barR','stateL','stateC','stateR'])assert.ok(!strip[0].includes(`id="${id}"`),id+' no debe estar en la vista principal');
 const more=html.match(/<details class="more-data pop".*?<\/details>/s);assert.ok(more);
 for(const id of ['stateL','stateC','stateR','position','movedObjects'])assert.match(more[0],new RegExp(`id="${id}"`),id);
 assert.ok(!/1000 \/ 1000/.test(html),'no debe haber texto «1000 / 1000» estático');
});
test('PILOT-2: el editor documenta la salida con teclado y el canvas no depende de una columna lateral',()=>{
 assert.match(html,/Esc y luego Tab salen del editor/);
 assert.ok(!/class="telemetry-panel"|simulation-body/.test(html),'sin columna lateral de telemetría');
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 assert.ok(!/\.simulation-body\{[^}]*grid-template-columns/.test(css));
});
test('Fuentes locales referenciadas existen y no hay recursos externos',()=>{
 const css=fs.readFileSync(path.join(root,'tokens.css'),'utf8');
 for(const m of css.matchAll(/url\(([^)]+)\)/g))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
 for(const f of ['index.html','tokens.css','styles.css'])assert.ok(!/https?:\/\//.test(fs.readFileSync(path.join(root,f),'utf8').replace(/<!--.*?-->/gs,'')),f+' contiene una URL externa');
});
console.log(`\n${checks} comprobaciones de contrato de interfaz superadas.`);
