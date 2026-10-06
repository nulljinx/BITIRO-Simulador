'use strict';
const assert=require('node:assert/strict');
const {ctx,js,el,saved}=require('./smoke.cjs');
let checks=0;function test(name,fn){fn();checks++;console.log('OK · '+name);}
const tick=(seconds)=>{for(let n=0;n<Math.round(seconds*120);n++)js('update(1/120)');};
const program=code=>{el('src').value=code;js('start()');};
test('Calibración por canal, extremos, saturación y umbral inclusivo',()=>{
 js('LINE_SENSOR.save({...LINE_SENSOR.defaults(),calibrated:true})');
 assert.equal(js('LINE_SENSOR.normalized(155,0)'),0);assert.equal(js('LINE_SENSOR.normalized(865,2)'),1000);
 assert.equal(js('LINE_SENSOR.normalized(0,0)'),0);assert.equal(js('LINE_SENSOR.normalized(1023,2)'),1000);
 assert.equal(js('LINE_SENSOR.detected(510,0)'),true);assert.equal(js('LINE_SENSOR.detected(509,0)'),false);
 js('LINE_SENSOR.save({...LINE_SENSOR.defaults(),white:[100,200,300],black:[900,800,700]})');
 for(let k=0;k<3;k++)assert.equal(js(`LINE_SENSOR.normalized(500,${k})`),500);
});
test('Polaridad inversa y rechazo de contraste insuficiente',()=>{
 js('LINE_SENSOR.save({...LINE_SENSOR.defaults(),white:[900,900,900],black:[100,100,100]})');
 assert.equal(js('LINE_SENSOR.detected(100,1)'),true);assert.equal(js('LINE_SENSOR.detected(900,1)'),false);
 assert.throws(()=>js('LINE_SENSOR.save({...LINE_SENSOR.defaults(),white:[800,155,155]})'));
 assert.throws(()=>js('LINE_SENSOR.save({...LINE_SENSOR.defaults(),threshold:NaN})'));
 js('LINE_SENSOR.save(LINE_SENSOR.defaults())');
});
test('Persistencia y recuperación frente a almacenamiento no disponible',()=>{
 assert.ok(saved.has('bitiro:line-calibration:v1'));
 const original=ctx.localStorage.setItem;ctx.localStorage.setItem=()=>{throw Error('bloqueado');};
 assert.equal(js('LINE_SENSOR.save(LINE_SENSOR.defaults())'),false);
 assert.doesNotThrow(()=>js("changeTrack('s01')"));ctx.localStorage.setItem=original;
});
test('Calibrar pausa sin perder posición y cancelar no aplica cambios',()=>{
 program('void setup(){inicializarMovimiento();} void loop(){avanzar(30);}');tick(.3);
 const y=js('R.y');el('calibrate').events.click();tick(.5);assert.equal(js('R.y'),y);
 el('threshold').value=800;el('calibrationClose').events.click();assert.equal(js('LINE_SENSOR.profile.threshold'),500);
 assert.equal(js('paused'),true);el('pause').events.click();assert.equal(js('paused'),false);
});
test('Formulario guarda referencias y muestra su estado',()=>{
 el('calibrate').events.click();el('sampleWhite').events.click();el('sampleBlack').events.click();
 el('threshold').value=650;el('calibrationForm').events.submit({preventDefault(){}});
 assert.equal(js('LINE_SENSOR.profile.threshold'),650);assert.match(el('calibrationSummary').textContent,/Calibrado/);
 js('LINE_SENSOR.save(LINE_SENSOR.defaults())');
});
test('API calibrada respeta inicialización y conserva lectura bruta',()=>{
 program('void setup(){} void loop(){int a=lineaCentral();finPrograma();}');tick(.02);
 assert.match(el('msg').innerHTML,/inicializarSensores/);
 program('void setup(){inicializarSensores();} void loop(){int a=leerLineaNormalizada(3);}');tick(.02);
 assert.match(el('msg').innerHTML,/sensor debe ser/);
 js('window.resetRobot()');assert.equal(js('readLine(1)'),865);
});
test('finPrograma interrumpe setup, loop y bucles anidados',()=>{
 program('void setup(){inicializarMovimiento();finPrograma();avanzar(100);} void loop(){avanzar(100);}');tick(.1);
 assert.equal(js('R.L'),0);assert.equal(js('R.y'),130);assert.equal(js('mode'),'idle');
 program('void setup(){inicializarMovimiento();} void loop(){while(true){finPrograma();avanzar(100);}avanzar(100);}');tick(.1);
 assert.equal(js('R.L'),0);assert.equal(js('R.y'),130);
});
test('Operadores lógicos devuelven 0/1 y hacen cortocircuito',()=>{
 program('int resultado=0;void setup(){resultado=2&&3;finPrograma();}void loop(){}');tick(.02);assert.equal(js('scopes[0].resultado'),1);
 program('int resultado=0;void setup(){resultado=2||(1/0);finPrograma();}void loop(){}');tick(.02);assert.equal(js('scopes[0].resultado'),1);
});
test('Errores numéricos detienen el programa',()=>{
 for(const code of ['pausa(-1);','int n=3%0;']){program('void setup(){}void loop(){'+code+'}');tick(.02);assert.equal(js('running'),0);assert.match(el('msg').innerHTML,/Error/);}
});
test('Tipos: división float, truncado int, bool y byte',()=>{
 program('float a=1.0;float b=0;int c=0;bool d=false;byte e=0;void setup(){b=a/2;c=3.9;d=7;e=258;finPrograma();}void loop(){}');tick(.02);
 assert.equal(js('scopes[0].b'),.5);assert.equal(js('scopes[0].c'),3);assert.equal(js('scopes[0].d'),1);assert.equal(js('scopes[0].e'),2);
 program('float a=0;void setup(){a=1.0/2;finPrograma();}void loop(){}');tick(.02);assert.equal(js('scopes[0].a'),.5);
});
test('Pausas encadenadas conservan el tiempo simulado',()=>{
 program('int estado=0;void setup(){pausa(100);estado=1;pausa(100);estado=2;finPrograma();}void loop(){}');
 tick(.1);assert.equal(js('scopes[0].estado'),0);tick(1/120);assert.equal(js('scopes[0].estado'),1);
 tick(.1);assert.equal(js('scopes[0].estado'),2);
});
test('Paso avanza exactamente 0,1 s y permanece en pausa',()=>{
 program('void setup(){}void loop(){}');el('pause').events.click();const time=js('simTime');
 el('step').events.click();assert.ok(Math.abs(js('simTime')-time-.1)<1e-8);assert.equal(js('paused'),true);
});
test('Misma simulación a 30, 60 y 144 fps; velocidad 4× sin recorte',()=>{
 const positions=[];
 for(const fps of [30,60,144]){
  program('void setup(){inicializarMovimiento();}void loop(){avanzar(30);}');js('last=0;acc=0');el('speed').value='4';
  for(let n=1;n<=fps;n++)js(`frame(${n*1000/fps})`);
  positions.push(js('R.y'));assert.ok(Math.abs(js('simTime')-4)<.01);
 }
 assert.ok(Math.max(...positions)-Math.min(...positions)<.07);el('speed').value='1';
});
test('Arranque gradual y detenerse sin deriva residual',()=>{
 program('void setup(){inicializarMovimiento();avanzar(100);pausa(200);detenerse();pausa(1000);}void loop(){}');
 tick(1/120);assert.ok(js('wheel.left')>0&&js('wheel.left')<100);tick(.25);const y=js('R.y');tick(.4);assert.equal(js('R.y'),y);
});
test('Sonar mide desde el transductor a caras, con giro y altura',()=>{
 js('resetRobot();R.x=50;R.y=130;R.th=0;activeObstacles=[{x:46,y:94,width:8,height:8,visualHeightCm:15.6}]');
 assert.equal(js('readSonarDistance()'),18);
 js('R.th=Math.PI/2;activeObstacles=[{x:80,y:127,width:16,height:6,visualHeightCm:15.6}]');assert.equal(js('readSonarDistance()'),20);
 js('activeObstacles[0].visualHeightCm=3');assert.equal(js('readSonarDistance()'),200);
});
test('Comandos de motor giran hacia el lado anunciado',()=>{
 for(const [command,sign] of [['girarDerecha',1],['girarIzquierda',-1]]){program(`void setup(){inicializarMovimiento();}void loop(){${command}(20);}`);tick(.2);assert.ok(js('R.th')*sign>0);}
});
test('IR manual se conserva al iniciar código y demostración',()=>{
 js('setIR(0,1);setIR(1,1)');program('void setup(){}void loop(){}');assert.equal(js('ir[0]+ir[1]'),2);
 el('demo').events.click();assert.equal(js('ir[0]+ir[1]'),2);
});
test('Diez pistas tienen guía y rutas remuestreadas sin saltos largos',()=>{
 for(const id of js('Object.keys(sourceTracks)')){js(`changeTrack('${id}')`);assert.ok(el('lessonGoal').textContent.length>20);
  assert.ok(js('demoPath.every((p,i)=>!i||Math.hypot(p[0]-demoPath[i-1][0],p[1]-demoPath[i-1][1])<1.501)'));
 }
});
test('Todos los ejemplos validan y comienzan sin errores',()=>{
 js("changeTrack('s01')");for(let n=0;n<5;n++){program(js(`EJ[${n}]`));tick(.1);assert.doesNotMatch(el('msg').innerHTML,/class=err/);}
});
test('Los circuitos cerrados comienzan alineados con sensores sobre línea',()=>{
 for(const id of ['s03','oval','ocho']){
  js(`changeTrack('${id}')`);assert.ok(js('[0,1,2].some(k=>LINE_SENSOR.detected(readLine(k),k))'),id);
  program(js('EJ[0]'));tick(.5);assert.ok(js('runDistance')>1,id+' avanza con su código');
 }
});
test('S07 · Repaso: superficie neutra sin plotter oficial (sin línea, zonas ni cajas) y sin copiar S03',()=>{
 js("changeTrack('s07')");assert.equal(js('track.paths.length+track.zones.length+track.markers.length+activeObstacles.length'),0);
 assert.equal(js('track.neutral'),true);assert.equal(js('track.official'),false);assert.match(js('track.name'),/sin pista propia/);
 assert.equal(js("document.getElementById('reference').hidden"),true,'sin plotter de referencia');
 assert.ok(js('readLine(0)')<200&&js('readLine(1)')<200,'toda la superficie es blanca');
 program(js('EJ[0]'));tick(.5);js("changeTrack('s01')");
});
test('Demo real S01: parar, golpear, continuar y finalizar sin reiniciar',()=>{
 js("changeTrack('s01')");el('demo').events.click();let struck=false;
 for(let n=0;n<120*80;n++){
  js('update(1/120)');
  if(js('resumeDemoAfterStrike')&&!struck){el('strike').events.click();struck=true;}
  if(struck&&js('mode')==='idle'&&!js('resumeDemoAfterStrike'))break;
 }
 assert.equal(js('movedCount'),1);assert.equal(el('statusBadge').textContent,'RECORRIDO VISUALIZADO');
});
console.log(`\n${checks} grupos de regresión v4 superados, además de la suite mecánica original.`);
