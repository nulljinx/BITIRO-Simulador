/* node tests/pilot5.cjs — PILOT-5: integridad didáctica y entradas del robot.
   Starters S01–S08 sin solución, migración del código guardado, Pulsador e IR frente al runtime real. */
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const S=require('../starters.js');
const {load}=require('./sim1/harness.cjs');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const TRACKS=['s01','s02','s03','s04','s05','s06','s07','s08'];
const sha=t=>crypto.createHash('sha256').update(t).digest('hex').slice(0,16);
const codeLines=src=>src.split('\n').filter(l=>l.trim()!==''&&!l.trim().startsWith('//')&&!l.startsWith('#include'));
const commentLines=src=>src.split('\n').filter(l=>l.trim().startsWith('//')).map(l=>l.trim());

/* ───────── 1. Starters ───────── */
test('S01–S08 tienen starter propio; Óvalo y Ocho no (conservan ejemplos completos)',()=>{
 for(const id of TRACKS){assert.equal(typeof S.starter(id),'string',id);assert.ok(S.hasStarter(id));assert.ok(!S.isFree(id));}
 for(const id of ['oval','ocho']){assert.equal(S.starter(id),null);assert.ok(S.isFree(id));assert.ok(!S.hasStarter(id));}
 assert.equal(S.starter('nope'),null);assert.deepEqual([...S.freeTracks],['oval','ocho']);
 assert.equal(new Set(TRACKS.map(S.starter)).size,8,'cada pista tiene un starter distinto');
});
test('Starters: solo estructura (setup/loop e inicializaciones); sin lógica de seguimiento, ruta, conteo, IR, sonar, golpe ni decisión',()=>{
 const forbidden=/\b(if|else|while|for|do|int|float|bool|byte|long|return|leer\w*|linea\w*|avanzar|retroceder|girar\w*|detenerse|pausa|escribirPantalla|borrarPantalla|apagarPantalla|prenderPantalla|moverServo\w*|finPrograma|botonInicio|millis)\b/;
 for(const id of TRACKS){
  const src=S.starter(id),code=codeLines(src);
  for(const l of code)assert.ok(!forbidden.test(l),`${id}: «${l}»`);
  // forma exacta: void setup(){ inicializar…(); } void loop(){ }
  const inits=code.filter(l=>/^  inicializar\w+\(\);$/.test(l)).map(l=>l.trim().replace('();',''));
  assert.deepEqual(code,['void setup() {',...inits.map(n=>'  '+n+'();'),'}','void loop() {','}'],id);
  assert.ok(inits.length>=2&&inits.length<=3&&inits.every(n=>['inicializarMovimiento','inicializarSensores','inicializarPantalla'].includes(n)),id);
  // los comentarios solo pueden ser el encabezado con el título de la pista y las dos líneas neutrales del Lab
  const cs=commentLines(src);assert.equal(cs.length,3,id);assert.match(cs[0],/^\/\/ BITIRO Simulador · S0[1-8] · /);
  assert.deepEqual(cs.slice(1),['// Divide el desafío en tareas pequeñas.','// Escribe aquí tu programa.']);
  assert.ok(src.endsWith('}\n'));assert.ok(src.includes('#include <KnightRoboticsLibs_Iroh.h>'));
 }
 assert.ok(!S.starter('s04').includes('inicializarPantalla'));      // S04 del Lab no usa la LCD
 for(const id of TRACKS.filter(t=>t!=='s04'))assert.ok(S.starter(id).includes('inicializarPantalla'),id);
 assert.ok(!TRACKS.some(id=>S.starter(id).includes('inicializarGolpe')),'el starter no inicializa el golpe: lo decide el alumno (igual que el Lab)');
});
test('Ningún starter contiene texto de los ejemplos completos legacy',()=>{
 for(const id of TRACKS){const src=S.starter(id);assert.ok(!S.isLegacyExample(src));
  for(const ex of S.legacyExamples)for(const line of ex.split('\n').map(l=>l.trim()).filter(l=>l.length>14&&!l.startsWith('//')&&!l.startsWith('#include')&&!/^inicializar\w+\(\);$/.test(l)&&l!=='void setup() {'&&l!=='void loop() {')){
   assert.ok(!src.includes(line),`${id} contiene «${line}»`);}}
});
test('Todos los starters son válidos para el intérprete, se ejecutan sin errores y el robot no se mueve solo',()=>{
 for(const id of TRACKS){const h=load();h.js(`changeTrack('${id}')`);const x=h.js('R.x'),y=h.js('R.y'),th=h.js('R.th');
  h.program(S.starter(id));h.tick(240);
  assert.doesNotMatch(h.el('msg').innerHTML,/class=err/,id);assert.equal(h.js('running'),1,id);assert.equal(h.js('R.L')+h.js('R.R'),0,id);
  assert.equal(h.js('R.x'),x);assert.equal(h.js('R.y'),y);assert.equal(h.js('R.th'),th);assert.equal(h.js('movedCount'),0);}
});

/* ───────── 2. Migración del código guardado ───────── */
test('Migración: sin código guardado → starter (S01–S08)',()=>{
 for(const id of TRACKS)for(const saved of [null,undefined,''])assert.equal(S.resolve(id,saved,'EJ0'),S.starter(id),id+' '+JSON.stringify(saved));
});
test('Migración: legacy EXACTO (cada uno de los 5 ejemplos) → starter',()=>{
 assert.equal(S.legacyExamples.length,5);
 for(const id of TRACKS)for(const ex of S.legacyExamples)assert.equal(S.resolve(id,ex,'EJ0'),S.starter(id),id);
});
test('Migración: legacy modificado aunque sea en un carácter → se conserva íntegro',()=>{
 for(const id of TRACKS)for(const ex of S.legacyExamples){
  const variants=[ex+' ',ex+'\n',' '+ex,ex.slice(0,-1),ex.slice(1),ex.replace('avanzar','avanzaR'),ex.replace(/\n/,'\r\n'),ex.replace('void','Void'),ex.replace('(','( ')];
  for(const v of variants.filter(v=>v!==ex)){assert.equal(S.resolve(id,v,'EJ0'),v,id+' '+JSON.stringify(v.slice(0,20)));}
 }
});
test('Migración: código propio (cualquiera) → se conserva íntegro; incluso el propio starter modificado',()=>{
 const own=['int x=1;','// mi programa','void setup(){}\nvoid loop(){avanzar(30);}','   ','\n',S.starter('s01')+'// nota\n'];
 for(const id of TRACKS)for(const c of own)assert.equal(S.resolve(id,c,'EJ0'),c);
 assert.equal(S.resolve('s02',S.starter('s02'),'EJ0'),S.starter('s02'));      // starter guardado (sin cambios) se mantiene
 assert.equal(S.resolve('s03',S.starter('s02'),'EJ0'),S.starter('s02'));      // el código guardado nunca se cambia por el de otra pista
});
test('Migración: Óvalo/Ocho no se migran (se conserva lo guardado, incluso un ejemplo legacy; sin nada → ejemplo por defecto)',()=>{
 for(const id of ['oval','ocho']){
  for(const ex of S.legacyExamples)assert.equal(S.resolve(id,ex,'EJ0'),ex);
  assert.equal(S.resolve(id,'mi código','EJ0'),'mi código');
  for(const saved of [null,undefined,''])assert.equal(S.resolve(id,saved,'EJ0'),'EJ0');
 }
 assert.equal(S.resolve('pista-nueva','algo','EJ0'),'algo');                  // pista desconocida: no se toca
});
test('Ejemplos legacy congelados (SHA-256) y los ejemplos de práctica libre siguen intactos y completos',()=>{
 assert.deepEqual(S.legacyExamples.map(sha),['a80e20bf2b72cc8e','be9318c04b2c88ba','e37478a28796d735','32290bd6dc7ffcd3','3d0ea10305a5031e']);
 const h=load();const EJ=Array.from(h.js('EJ.slice()'),String);
 assert.deepEqual(EJ.slice(0,4),[...S.legacyExamples].slice(0,4),'EJ[0–3] (práctica libre) no cambiaron');
 // EJ[4] se migró a la API oficial −1/0/+1; la versión v4 (0–65) queda congelada en LEGACY para reconocer código guardado.
 assert.notEqual(EJ[4],S.legacyExamples[4]);assert.ok(!/moverServoGolpe\(65\)/.test(EJ[4])&&/moverServoGolpe\(-1\)/.test(EJ[4])&&/moverServoGolpe\(1\)/.test(EJ[4])&&/moverServoGolpe\(0\)/.test(EJ[4]));
 assert.ok(/moverServoGolpe\(65\)/.test(S.legacyExamples[4]),'LEGACY conserva el ejemplo v4 original');
 assert.ok(Object.isFrozen(S.legacyExamples));
 for(const id of ['oval','ocho']){const g=load();g.js(`changeTrack('${id}')`);g.js('setButton(1)');g.program(g.js('EJ[0]'));g.tick(120);assert.equal(g.js('running'),1);assert.doesNotMatch(g.el('msg').innerHTML,/class=err/);}
});
test('isModified: distingue starter intacto de código distinto (para pedir confirmación)',()=>{
 for(const id of TRACKS){assert.equal(S.isModified(id,S.starter(id)),false);assert.equal(S.isModified(id,S.starter(id)+' '),true);assert.equal(S.isModified(id,''),true);}
 assert.equal(S.isModified('oval','x'),false);
});

/* ───────── 3. Pulsador e IR ↔ runtime ───────── */
const READ='int a=0;int b=0;int c=0;void setup(){inicializarSensores();}void loop(){a=leerSensorObstaculoIzquierdo();b=leerSensorObstaculoDerecho();c=leerBoton();pausa(10);}';
const vars=h=>({a:h.js('scopes[0].a'),b:h.js('scopes[0].b'),c:h.js('scopes[0].c')});
const ui=h=>({ir0:h.el('ir0').getAttribute('aria-pressed'),ir1:h.el('ir1').getAttribute('aria-pressed'),btn:h.el('pulsador').getAttribute('aria-pressed'),t0:h.el('ir0.sub').textContent,t1:h.el('ir1.sub').textContent,tb:h.el('pulsador.sub').textContent});
test('Semántica del Lab: el Pulsador y los IR ALTERNAN (clic = presionado/liberado); estado accesible y texto visible',()=>{
 const h=load();let u=ui(h);assert.deepEqual([u.ir0,u.ir1,u.btn,u.t0,u.t1,u.tb],['false','false','false','Libre','Libre','Libre']);
 h.el('pulsador').events.click();u=ui(h);assert.deepEqual([h.js('btn'),u.btn,u.tb],[1,'true','Presionado']);
 h.el('pulsador').events.click();u=ui(h);assert.deepEqual([h.js('btn'),u.btn,u.tb],[0,'false','Libre']);
 h.el('ir0').events.click();u=ui(h);assert.deepEqual([h.js('ir[0]'),h.js('ir[1]'),u.ir0,u.ir1,u.t0,u.t1],[1,0,'true','false','Activo','Libre']);
 h.el('ir1').events.click();h.el('ir0').events.click();u=ui(h);assert.deepEqual([h.js('ir[0]'),h.js('ir[1]'),u.t0,u.t1],[0,1,'Libre','Activo']);
});
test('leerBoton() ya no es «unavailable»: devuelve 1/0 según el Pulsador visible y no emite avisos',()=>{
 const h=load();h.program(READ);h.tick(5);assert.deepEqual(vars(h),{a:0,b:0,c:0});assert.doesNotMatch(h.el('msg').innerHTML,/no tiene efecto|warn/);
 h.el('pulsador').events.click();h.tick(5);assert.equal(vars(h).c,1);h.el('pulsador').events.click();h.tick(5);assert.equal(vars(h).c,0);
 assert.doesNotMatch(h.el('msg').innerHTML,/no tiene efecto/);
});
test('IR ↔ runtime: leerSensorObstaculoIzquierdo/Derecho reflejan exactamente las dos entradas visibles (4 combinaciones)',()=>{
 for(const [l,r] of [[0,0],[1,0],[0,1],[1,1]]){
  const h=load();h.program(READ);h.tick(3);
  if(l)h.el('ir0').events.click();if(r)h.el('ir1').events.click();h.tick(5);
  const u=ui(h);assert.deepEqual(vars(h),{a:l,b:r,c:0},`IR ${l}/${r}`);assert.deepEqual([u.ir0,u.ir1],[String(!!l),String(!!r)]);
 }
});
test('Entradas ANTES de ejecutar: se conservan al iniciar el programa y el programa las lee',()=>{
 const h=load();h.el('pulsador').events.click();h.el('ir0').events.click();h.program(READ);h.tick(5);
 assert.deepEqual(vars(h),{a:1,b:0,c:1});assert.deepEqual([h.js('btn'),h.js('ir[0]'),h.js('ir[1]')],[1,1,0]);assert.deepEqual([ui(h).btn,ui(h).ir0],['true','true']);
});
test('Entradas DURANTE la ejecución: los cambios se ven en la siguiente lectura (activar y liberar)',()=>{
 const h=load();h.program(READ);h.tick(5);assert.deepEqual(vars(h),{a:0,b:0,c:0});
 h.el('ir1').events.click();h.el('pulsador').events.click();h.tick(5);assert.deepEqual(vars(h),{a:0,b:1,c:1});
 h.el('ir1').events.click();h.tick(5);assert.deepEqual(vars(h),{a:0,b:0,c:1});
});
test('Entradas DURANTE la pausa: se aceptan al instante pero el programa solo las lee al continuar',()=>{
 const h=load();h.program(READ);h.tick(5);h.el('pause').events.click();assert.equal(h.js('paused'),true);
 h.el('ir0').events.click();h.el('pulsador').events.click();assert.deepEqual([h.js('ir[0]'),h.js('btn')],[1,1]);assert.deepEqual([ui(h).ir0,ui(h).btn],['true','true']);
 h.tick(20);assert.deepEqual(vars(h),{a:0,b:0,c:0},'en pausa no avanza el programa');
 h.el('pause').events.click();h.tick(8);assert.deepEqual(vars(h),{a:1,b:0,c:1});
});
test('Reiniciar LIBERA las entradas (como el Lab: «dejar IR y pulsador apagados»), detiene el programa y vuelve el texto a «Libre»',()=>{
 const h=load();h.program(READ);h.el('pulsador').events.click();h.el('ir0').events.click();h.el('ir1').events.click();h.tick(5);assert.deepEqual(vars(h),{a:1,b:1,c:1});
 h.el('reset').events.click();
 assert.deepEqual([h.js('btn'),h.js('ir[0]'),h.js('ir[1]'),h.js('running')],[0,0,0,0]);
 const u=ui(h);assert.deepEqual([u.btn,u.ir0,u.ir1,u.tb,u.t0,u.t1],['false','false','false','Libre','Libre','Libre']);
 h.program(READ);h.tick(5);assert.deepEqual(vars(h),{a:0,b:0,c:0},'tras reiniciar y volver a ejecutar, las entradas parten en reposo');
});
test('Cambiar de pista también libera las entradas; «Demostración» las conserva',()=>{
 const h=load();h.el('pulsador').events.click();h.el('ir0').events.click();h.js("changeTrack('s02')");assert.deepEqual([h.js('btn'),h.js('ir[0]')],[0,0]);
 h.el('pulsador').events.click();h.el('ir1').events.click();h.el('demo').events.click();assert.deepEqual([h.js('btn'),h.js('ir[0]'),h.js('ir[1]')],[1,0,1]);
});
test('botonInicio() espera de verdad al Pulsador (los ejemplos con botonInicio ya no arrancan solos); ver tests/runtime-start.cjs',()=>{
 const h=load();h.js("changeTrack('oval')");h.program(h.js('EJ[0]'));h.tick(120);
 assert.equal(h.js('waitingButton'),1);assert.equal(h.js('R.L')+h.js('R.R'),0,'EJ[0] espera el Pulsador antes de mover el robot');
 h.el('pulsador').events.click();h.tick(60);assert.ok(h.js('runDistance')>0.5,'al presionar el Pulsador comienza el recorrido');
});
console.log(`\n${checks} comprobaciones PILOT-5 (starters, migración y entradas) superadas.`);
