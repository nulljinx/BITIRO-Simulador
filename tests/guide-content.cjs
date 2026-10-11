/* node tests/guide-content.cjs — SIM-GUIDE-NNJ-1: cada instrucción, ejemplo y afirmación técnica de la Guía se comprueba
   contra el intérprete real (iroh-runtime.js + simulator.js en el harness). La Guía no define el comportamiento: lo describe.
   - Toda llamada escrita en un <code> existe en el runtime (o es una función propia definida en la propia Guía).
   - Cada ejemplo corto (<pre class="guide-sig">) se ejecuta sin errores; los avisos solo aparecen en las instrucciones documentadas
     como «sin efecto».
   - Cada programa completo (<pre class="guide-program" data-program>) se ejecuta y produce el comportamiento que la Guía describe.
   - Los rangos, límites y funciones «no disponibles» que menciona el tema avanzado se verifican con el intérprete. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {load}=require('./sim1/harness.cjs');
const root=path.resolve(__dirname,'..');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dialog=html.match(/<dialog id="guideDialog"[^>]*>(.*?)<\/dialog>/s)[1];
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const strip=s=>decode(s.replace(/<[^>]+>/g,''));

const sigs=[...dialog.matchAll(/<pre class="guide-sig"(?: data-ctx="(\w+)")?><code>(.*?)<\/code><\/pre>/gs)].map(m=>({ctx:m[1]||'statements',code:decode(m[2])}));
const programs=Object.fromEntries([...dialog.matchAll(/<pre class="guide-program" data-program="(\w+)"[^>]*><code>(.*?)<\/code><\/pre>/gs)].map(m=>[m[1],decode(m[2])]));
const inlineCodes=[...dialog.matchAll(/<code>(.*?)<\/code>/gs)].map(m=>decode(m[1]));

function sim(id='s01'){
 const h=load();h.js(`changeTrack('${id}')`);h.t=0;
 h.frames=ms=>{for(let n=0;n<Math.ceil(ms/16);n++){h.t+=16;h.js(`frame(${h.t})`);}};
 h.msg=()=>h.el('msg').innerHTML;
 h.errors=()=>[...h.msg().matchAll(/class=err>([^<]*)/g)].map(m=>m[1]);
 h.warns=()=>[...h.msg().matchAll(/class=warn>([^<]*)/g)].map(m=>m[1]);
 h.deg=()=>h.js('R.th')*180/Math.PI;
 return h;
}
const FNKEYS=sim().js('Object.keys(FN)');

test('la Guía contiene ocho temas, ejemplos cortos y programas completos',()=>{
 assert.equal([...dialog.matchAll(/<details class="guide-topic"/g)].length,8);
 assert.ok(sigs.length>=30,'ejemplos cortos: '+sigs.length);
 assert.deepEqual(Object.keys(programs).sort(),['cuadrado','garra','pantalla','parar','primero','seguidor']);
 for(const name of Object.keys(programs))assert.match(dialog,new RegExp(`data-copy="${name}"`),'botón Copiar de '+name);
});

test('todas las llamadas escritas en la Guía existen en el runtime o son funciones propias definidas en la Guía',()=>{
 const own=new Set();
 for(const code of [...sigs.map(s=>s.code),...Object.values(programs)])for(const m of code.matchAll(/\b(?:void|int|float|long|bool|byte)\s+([A-Za-z_]\w*)\s*\(/g))own.add(m[1]);
 for(const reserved of ['setup','loop'])own.delete(reserved);
 const KEYWORDS=new Set(['if','while','else','setup','loop','millis','delay','analogRead']);   // las tres últimas aparecen solo en «no disponible»
 const seen=new Set();
 for(const code of [...inlineCodes,...sigs.map(s=>s.code),...Object.values(programs)])
  for(const m of code.replace(/"[^"]*"/g,'""').matchAll(/\b([A-Za-z_]\w*)\s*\(/g)){const n=m[1];seen.add(n);
   assert.ok(FNKEYS.includes(n)||own.has(n)||KEYWORDS.has(n),'«'+n+'()» no existe en el runtime ni se define en la Guía');}
 for(const f of FNKEYS)assert.ok(seen.has(f),'la Guía no muestra '+f+'()');
 assert.deepEqual([...own].sort(),['esquina','lado','recorrerUnSegundo','velocidadSegura'].sort());
});

const INIT='inicializarMovimiento();inicializarSensores();inicializarGolpe();';
const NO_EFFECT=/apagarPantalla|prenderPantalla|inicializarCabeza|apagarCabeza|moverServoYaw|moverServoPitch/;
const tops=sigs.filter(s=>s.ctx==='top').map(s=>s.code).join('\n');

test('cada ejemplo corto se ejecuta sin errores; solo las instrucciones «sin efecto» producen avisos',()=>{
 let n=0;
 for(const s of sigs){
  const h=sim();
  const code=s.ctx==='skeleton'?s.code
   :s.ctx==='setupdef'?`${s.code}\nvoid loop(){pausa(10);}`
   :s.ctx==='loopdef'?`void setup(){inicializarMovimiento();}\n${s.code}`
   :`${tops}\nvoid setup(){${INIT}\n${s.ctx==='top'?'':s.code}\n}\nvoid loop(){pausa(10);}`;
  h.program(code);h.frames(1200);
  assert.deepEqual(h.errors(),[],'error en el ejemplo:\n'+s.code);
  const warns=h.warns();
  if(NO_EFFECT.test(s.code))assert.ok(warns.length>0&&warns.every(w=>/no tiene efecto en este modelo/.test(w)),'aviso esperado en:\n'+s.code+'\n'+warns);
  else assert.deepEqual(warns,[],'avisos inesperados en:\n'+s.code);
  n++;
 }
 assert.equal(n,sigs.length);
});

test('Primeros pasos: el programa completo va primero y el orden enseña setup, loop, inicializar y ; { } sin provocar errores',()=>{
 const t1=dialog.match(/<details class="guide-topic" id="guide-primeros-pasos"[^>]*>(.*?)<\/details>/s)[1];
 const heads=[...t1.matchAll(/<h4>(.*?)<\/h4>/g)].map(m=>m[1]);
 assert.deepEqual(heads,['Mi primer programa','¿Qué es setup()?','¿Qué es loop()?','¿Qué significa inicializar?','Para qué sirven ; y { }','Lee los mensajes del simulador']);
 assert.ok(t1.indexOf('data-program="primero"')<t1.indexOf('¿Qué es setup()?'),'el programa va antes de las explicaciones');
 assert.match(t1,/<b>Qué hace:<\/b>/);assert.match(t1,/data-copy="primero"/);
 assert.ok(!/quita|elimina|borra[^.]*inicializar|provoca/i.test(strip(t1.replace(/<pre.*?<\/pre>/gs,''))),'sin ejercicios para provocar errores de inicialización');
});

test('legibilidad en móvil: ninguna línea de código supera 39 caracteres ni ningún comentario 34',()=>{
 for(const code of [...sigs.map(s=>s.code),...Object.values(programs)])for(const line of code.split('\n')){
  assert.ok(line.length<=39,'línea demasiado larga ('+line.length+'): '+line);
  const c=line.indexOf('//');if(c>=0)assert.ok(line.slice(c).length<=34,'comentario largo: '+line);
 }
});

test('metadatos de búsqueda: data-cmd y data-sig solo nombran funciones reales; cada comando tiene su tarjeta',()=>{
 const cmds=new Set(),KW=new Set(['if','while','setup','loop','void','int']);
 for(const m of dialog.matchAll(/<article class="guide-item[^"]*" data-cmd="([^"]*)" data-sig="([^"]*)" data-keywords="([^"]*)">/g)){
  for(const c of m[1].split(/\s+/).filter(Boolean)){assert.ok(FNKEYS.includes(c)||KW.has(c),'data-cmd desconocido: '+c);cmds.add(c);}
  for(const n of [...m[2].replace(/\b(?:void|int)\s+\w+\s*\(/g,'(').matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map(x=>x[1]))assert.ok(FNKEYS.includes(n)||KW.has(n),'data-sig desconocido: '+n);
 }
 assert.equal([...dialog.matchAll(/<article class="guide-item/g)].length,[...dialog.matchAll(/data-keywords="/g)].length,'todas las tarjetas tienen palabras clave');
 for(const f of FNKEYS)assert.ok(cmds.has(f),'ninguna tarjeta declara data-cmd para '+f);
});

test('programa «Mi primer programa»: escribe el saludo, avanza ≈ 1,5 s y termina',()=>{
 const h=sim();h.program(programs.primero);const y0=h.js('R.y');h.frames(4000);
 assert.deepEqual(h.errors(),[]);assert.deepEqual(h.warns(),[]);
 assert.ok(h.js('lcd')[0].startsWith('Hola, IROH'));
 const moved=y0-h.js('R.y');assert.ok(moved>8&&moved<20,'avanzó '+moved.toFixed(1)+' cm');
 assert.equal(h.js('mode'),'idle');assert.equal(h.el('statusBadge').textContent,'FINALIZADO');
});

test('programa «Seguidor de línea»: sigue el Óvalo sin salirse y sin avisos',()=>{
 const h=sim('oval');h.program(programs.seguidor);h.frames(24000);
 assert.deepEqual(h.errors(),[]);assert.deepEqual(h.warns(),[]);
 assert.equal(h.js('mode'),'code','sigue en ejecución (no salió de la pista)');
 assert.ok(h.js('runDistance')>100,'recorrido '+h.js('runDistance').toFixed(0)+' cm');
 assert.ok(h.js('lineSeconds')>10,'tiempo sobre la línea '+h.js('lineSeconds').toFixed(1)+' s');
});

test('programa «Detenerse ante una caja»: se detiene a menos de 17 cm sin empujar la caja',()=>{
 const h=sim('s01');h.program(programs.parar);h.frames(15000);
 assert.deepEqual(h.errors(),[]);assert.deepEqual(h.warns(),[]);
 assert.equal(h.js('R.L')+h.js('R.R'),0,'ruedas detenidas');
 const d=h.js('readSonarDistance()');assert.ok(d<17&&d>=12,'distancia al detenerse: '+d);
 assert.equal(h.js('movedCount'),0,'no tocó la caja');
 // Sin caja delante, avanza sin parar (lo que advierte la Guía)
 const free=sim('oval');free.program(programs.parar);free.frames(1500);assert.equal(free.js('readSonarDistance()'),200);assert.equal(free.js('R.L'),30);
});

test('programa «Mostrar la distancia»: escribe el rótulo y el valor del sonar en la LCD',()=>{
 const h=sim('s01');h.program(programs.pantalla);h.frames(8000);
 assert.deepEqual(h.errors(),[]);assert.deepEqual(h.warns(),[]);
 const [row0,row1]=h.js('lcd');assert.equal(row0.trimEnd(),'Distancia:');
 assert.equal(Number(row1),h.js('readSonarDistance()'));assert.equal(h.js('R.L')+h.js('R.R'),0);
});

test('programa «La garra se mueve sola»: recorre izquierda, derecha y centro',()=>{
 const h=sim();h.program(programs.garra);const targets=new Set();
 for(let i=0;i<60;i++){h.frames(100);targets.add(h.js('striker.target'));}
 assert.deepEqual(h.errors(),[]);assert.deepEqual(h.warns(),[]);
 assert.deepEqual([...targets].sort((a,b)=>a-b),[-75,0,75]);
});

test('programa «Dibujar un cuadrado»: cada esquina gira cerca de 90°',()=>{
 const h=sim();h.program(programs.cuadrado);const plateaus=[];
 for(let i=0;i<150;i++){h.frames(100);if(Math.abs(h.js('wheel.left'))<.5&&Math.abs(h.js('wheel.right'))<.5)plateaus.push(h.deg());}
 assert.deepEqual(h.errors(),[]);assert.deepEqual(h.warns(),[]);
 assert.ok(h.deg()>300,'completó más de tres cuartos de vuelta: '+h.deg().toFixed(0)+'°');
 for(const d of plateaus){const k=Math.round(d/90);assert.ok(Math.abs(d-k*90)<=15,'giro fuera de ±15° de un múltiplo de 90: '+d.toFixed(0));}
});

/* ---------- Afirmaciones técnicas de los temas ---------- */
const run=(code,ms=400,track='s01')=>{const h=sim(track);h.program(code);h.frames(ms);return h;};
const W=b=>`void setup(){${INIT}${b}}void loop(){pausa(10);}`;

test('movimiento: 0–100, avanzar con dos valores, giros y retroceder, y pausa() mantiene la última orden',()=>{
 let h=run(W('avanzar(20, 60);'));assert.deepEqual([h.js('R.L'),h.js('R.R')],[20,60]);
 h=run(W('retroceder(40);'));assert.deepEqual([h.js('R.L'),h.js('R.R')],[-40,-40]);
 h=run(W('girarDerecha(40);'));assert.deepEqual([h.js('R.L'),h.js('R.R')],[40,-40]);
 h=run(W('girarIzquierda(40);'));assert.deepEqual([h.js('R.L'),h.js('R.R')],[-40,40]);
 h=run(W('avanzar(40);pausa(2000);detenerse();'),500);assert.deepEqual([h.js('R.L'),h.js('R.R')],[40,40],'durante pausa() sigue la última orden');
 h.frames(2500);assert.deepEqual([h.js('R.L'),h.js('R.R')],[0,0]);
 h=run(W('avanzar(120);'));assert.deepEqual([h.js('R.L'),h.js('R.R')],[100,100]);assert.ok(h.warns().some(w=>/0 a 100/.test(w)),'aviso al pasar de 100');
 h=run(W('avanzar(40);finPrograma();'),600);assert.equal(h.js('mode'),'idle');assert.deepEqual([h.js('R.L'),h.js('R.R')],[0,0]);
 // curvar hacia el lado de la rueda más lenta: derecha más rápida → th decrece (izquierda)
 h=run(W('avanzar(20, 60);'),2500);assert.ok(h.deg()<-3,'curva hacia la izquierda: '+h.deg().toFixed(1)+'°');
});

test('línea: lecturas crudas 0–1023, normalizadas 0–1000, umbral 500 y funciones 1/0',()=>{
 const h=run(`int a=0;int b=0;int c=0;int u=0;int l=0;void setup(){${INIT}}void loop(){a=leerSensorLineaCentral();b=leerLineaNormalizada(1);c=lineaCentral();u=leerUmbralLinea();l=leerLineaNormalizada(1);pausa(10);}`,300,'oval');
 const g=n=>h.js(`scopes[0].${n}`);
 assert.ok(g('a')>=0&&g('a')<=1023);assert.ok(g('b')>=0&&g('b')<=1000);assert.ok(g('c')===0||g('c')===1);assert.equal(g('u'),500);
 // negro = valor alto; blanco = valor bajo (perfil por defecto)
 assert.ok(h.js('LINE_SENSOR.profile.black[0]')>h.js('LINE_SENSOR.profile.white[0]'));
 const bad=run(W('int x=leerLineaNormalizada(3);'));assert.ok(bad.errors().length>0,'sensor 3 no existe');
});

test('sonar: centímetros enteros, 200 sin objeto; infrarrojos y pulsador son entradas manuales (1/0)',()=>{
 const h=run(`int d=0;int i=9;int r=9;int p=9;void setup(){${INIT}}void loop(){d=leerDistanciaSonar();i=leerSensorObstaculoIzquierdo();r=leerSensorObstaculoDerecho();p=leerBoton();pausa(10);}`,300,'oval');
 const g=n=>h.js(`scopes[0].${n}`);
 assert.equal(g('d'),200);assert.deepEqual([g('i'),g('r'),g('p')],[0,0,0]);
 h.el('ir0').events.click();h.el('pulsador').events.click();h.frames(200);
 assert.deepEqual([g('i'),g('r'),g('p')],[1,0,1],'los activa el usuario, no las cajas');
 const s=run(`int d=0;void setup(){${INIT}}void loop(){d=leerDistanciaSonar();pausa(10);}`,300,'s01');
 const d=s.js('scopes[0].d');assert.ok(Number.isInteger(d)&&d>0&&d<200,'caja de S01 a '+d+' cm');
});

test('pantalla: 16 columnas × 2 filas, texto o número, borrarPantalla y recorte a 16',()=>{
 let h=run(W('escribirPantalla(0,0,"Hola");escribirPantalla(5,1,42);'));
 assert.equal(h.js('lcd')[0].trimEnd(),'Hola');assert.equal(h.js('lcd')[1],'     42         ');
 h=run(W('escribirPantalla(14,0,"ABCDE");'));assert.equal(h.js('lcd')[0],'              AB');
 h=run(W('escribirPantalla(0,0,"Hola");borrarPantalla();'));assert.deepEqual([...h.js('lcd')].map(r=>r.trim()),['','']);
 h=run(W('inicializarPantalla();'));assert.deepEqual(h.warns(),[]);
 h=run('void setup(){inicializarMovimiento();escribirPantalla(0,0,"Sin inicializar");}void loop(){pausa(10);}');
 assert.equal(h.js('lcd')[0].trimEnd(),'Sin inicializar','la LCD funciona aunque no se llame inicializarPantalla()');
});

test('garra: -1, 0 y 1; otros valores avisan y no mueven; inicializarGolpe() la lleva al centro',()=>{
 let h=run(W('moverServoGolpe(-1);'),1200);assert.equal(h.js('striker.target'),-75);
 h=run(W('moverServoGolpe(1);'),1200);assert.equal(h.js('striker.target'),75);
 h=run(W('moverServoGolpe(1);pausa(900);moverServoGolpe(0);'),2500);assert.equal(h.js('striker.target'),0);
 h=run(W('moverServoGolpe(2);'));assert.equal(h.js('striker.target'),0);assert.ok(h.warns().some(w=>/-1, 0 o 1/.test(w)));
 // sin inicializarGolpe() el modo estricto avisa y no mueve
 h=run('void setup(){inicializarMovimiento();moverServoGolpe(1);}void loop(){pausa(10);}');assert.ok(h.warns().some(w=>/inicializarGolpe/.test(w)));assert.equal(h.js('striker.target'),0);
});

test('inicialización estricta con setup()/loop() y sin ella en instrucciones sueltas',()=>{
 let h=run('void setup(){}void loop(){avanzar(30);}');assert.deepEqual([h.js('R.L'),h.js('R.R')],[0,0]);assert.ok(h.warns().some(w=>/inicializarMovimiento/.test(w)));
 h=run('avanzar(30);');assert.deepEqual([h.js('R.L'),h.js('R.R')],[30,30],'instrucciones sueltas se repiten y no exigen inicializar');assert.deepEqual(h.warns(),[]);
 h=run('#include <KnightRoboticsLibs_Iroh.h>\nvoid setup(){inicializarMovimiento();}void loop(){avanzar(10);}');assert.deepEqual(h.errors(),[]);
});

test('lenguaje: tipos, división entera, byte, HIGH/LOW, recursión de 64 niveles y nombres sin ñ',()=>{
 const val=(decl)=>{const h=run(`int r=0;void setup(){${decl}}void loop(){pausa(10);}`,200);assert.deepEqual(h.errors(),[],decl);return h.js('scopes[0].r');};
 assert.equal(val('r=7/2;'),3);assert.equal(val('float f=7/2;r=f;'),3,'7/2 da 3 aunque se guarde en float');
 assert.equal(val('byte b=300;r=b;'),44);assert.equal(val('r=HIGH+LOW;'),1);assert.equal(val('bool t=5;r=t;'),1);
 assert.equal(val('r=5;r+=2;r-=1;r++;'),7);assert.equal(val('r=10%4;'),2);
 // recursión: 60 niveles funciona; 70 se detiene con mensaje
 const rec=n=>run(`int r=0;int f(int k){if(k==0){return 0;}return 1+f(k-1);}void setup(){r=f(${n});}void loop(){pausa(10);}`,200);
 assert.deepEqual(rec(60).errors(),[]);assert.equal(rec(60).js('scopes[0].r'),60);assert.ok(rec(70).errors().some(e=>/anidadas/.test(e)));
 assert.ok(run('void setup(){int ñ=1;}void loop(){}').errors().length>0,'ñ no es válida en nombres');
 assert.ok(run('void setup(){int a="hola";}void loop(){}').errors().length>0,'el texto no se guarda en variables');
});

test('lo «no disponible» que lista la Guía produce error en el intérprete',()=>{
 const NO={
  'for':'void setup(){for(int i=0;i<3;i++){}}void loop(){}','const':'const int a=1;void loop(){}','switch':'void setup(){switch(1){}}void loop(){}',
  'do-while':'void setup(){do{}while(0);}void loop(){}','break':'void setup(){while(1){break;}}void loop(){}','arreglos':'void setup(){int a[3];}void loop(){}',
  '? :':'void setup(){int a=1?2:3;}void loop(){}','prototipo':'void f();void loop(){}','referencia':'void f(int &a){}void loop(){}',
  'valor por defecto':'void f(int a=1){}void loop(){}','*=':'void setup(){int a=2;a*=3;}void loop(){}','/=':'void setup(){int a=2;a/=2;}void loop(){}',
  'millis':'void setup(){int t=millis();}void loop(){}','delay':'void setup(){delay(100);}void loop(){}','analogRead':'void setup(){int a=analogRead(1);}void loop(){}',
  'Serial':'void setup(){Serial.begin(9600);}void loop(){}'};
 for(const [name,code] of Object.entries(NO))assert.ok(run(code,100).errors().length>0,name+' debería dar error');
 // la Guía los menciona todos
 const text=strip(dialog);for(const w of ['for','const','switch','do-while','break','millis()','delay()','analogRead()','Serial'])assert.ok(text.includes(w),'la Guía menciona '+w);
});

test('instrucciones sin efecto: avisan con ⚠; inicializarPantalla() no avisa',()=>{
 for(const c of ['apagarPantalla();','prenderPantalla();','inicializarCabeza();','apagarCabeza();','moverServoYaw(10);','moverServoPitch(10);']){
  const h=run(W(c));assert.deepEqual(h.errors(),[]);assert.ok(h.warns().some(w=>/no tiene efecto/.test(w)),c);}
 assert.deepEqual(run(W('inicializarPantalla();')).warns(),[]);
});

console.log(`\n${checks} comprobaciones de contenido de la Guía superadas.`);
