/* node tests/runtime-start.cjs — RUNTIME-START-1: botonInicio() como barrera cooperativa de NIVEL sobre el Pulsador.
   leerBoton() = consulta inmediata (1/0). botonInicio() = el intérprete se detiene EN esa llamada hasta que leerBoton()==1;
   no consume ni libera el Pulsador. Como la librería real (while(1){ if(digitalRead(pin)==1) break; }) y el Lab.
   La espera se comprueba ejecutando el intérprete real (fotogramas reales de simulator.js), nunca buscando texto en el código. */
'use strict';
const assert=require('node:assert/strict');
const {load}=require('./sim1/harness.cjs');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const SETUP=(mid,loop='pausa(10);')=>`int a=0;void setup(){inicializarMovimiento();a=1;${mid}a=2;}void loop(){${loop}}`;
const BARRIER=SETUP('botonInicio();');
function sim(id='s01'){
 const h=load();h.js(`changeTrack('${id}')`);h.t=0;
 h.frames=ms=>{for(let n=0;n<Math.ceil(ms/16);n++){h.t+=16;h.js(`frame(${h.t})`);}};   // fotogramas reales: update() + syncWaiting()
 h.a=()=>h.js('scopes[0].a');h.badge=()=>h.el('statusBadge').textContent;h.feedback=()=>h.el('feedback').textContent;
 h.press=()=>h.el('pulsador').events.click();h.btn=()=>h.js('btn');h.waiting=()=>h.js('waitingButton');
 return h;
}
const speed=h=>Math.abs(h.js('R.L'))+Math.abs(h.js('R.R'));

test('1. Sin botonInicio() el programa empieza inmediatamente (sin espera implícita)',()=>{
 const h=sim();h.program('void setup(){inicializarMovimiento();}void loop(){avanzar(30);}');h.frames(300);
 assert.equal(h.waiting(),0);assert.equal(h.badge(),'EJECUTANDO');assert.ok(speed(h)>0);assert.ok(h.js('R.y')<130,'el robot avanzó');
});
test('2–4. Con botonInicio() el intérprete se detiene EN la llamada: lo anterior se ejecutó, lo posterior no',()=>{
 const h=sim();h.program(BARRIER);h.frames(500);
 assert.equal(h.a(),1,'a=1 (antes) sí; a=2 (después) todavía no');assert.equal(h.waiting(),1);
 assert.equal(h.badge(),'ESPERANDO PULSADOR');assert.equal(h.feedback(),'El programa está esperando el Pulsador.');
 assert.equal(h.js('running'),1);assert.equal(speed(h),0);assert.equal(h.js('R.y'),130,'robot quieto');
 assert.equal(h.js('mode'),'code');
});
test('5. Pulsar permite continuar: setup termina y loop comienza (una sola vez)',()=>{
 const h=sim();h.program(SETUP('botonInicio();','avanzar(30);'));h.frames(300);assert.equal(h.a(),1);assert.equal(speed(h),0);
 h.press();h.frames(300);
 assert.equal(h.a(),2);assert.equal(h.waiting(),0);assert.equal(h.badge(),'EJECUTANDO');assert.equal(h.feedback(),'Ejecutando el programa didáctico del editor.');
 assert.ok(speed(h)>0&&h.js('R.y')<130,'loop() avanza');
});
test('6–7. leerBoton() sigue devolviendo 1/0 y botonInicio() no consume ni libera el Pulsador',()=>{
 const h=sim();h.program('int b=9;int c=9;void setup(){inicializarSensores();botonInicio();b=leerBoton();}void loop(){c=leerBoton();pausa(10);}');
 h.frames(200);assert.equal(h.js('scopes[0].b'),9,'aún no leyó: sigue esperando');
 h.press();h.frames(200);assert.equal(h.js('scopes[0].b'),1);assert.equal(h.js('scopes[0].c'),1);assert.equal(h.btn(),1,'sigue Presionado');
 assert.equal(h.el('pulsador').attrs['aria-pressed'],'true');
 h.press();h.frames(100);assert.equal(h.js('scopes[0].c'),0,'leerBoton() sigue la entrada: liberar → 0');assert.equal(h.btn(),0);
 // leerBoton() en loop sin botonInicio nunca espera
 const g=sim();g.program('void setup(){inicializarMovimiento();inicializarSensores();}void loop(){if(leerBoton()==1){avanzar(30);}else{detenerse();}}');
 g.frames(200);assert.equal(speed(g),0);assert.equal(g.waiting(),0);g.press();g.frames(200);assert.ok(speed(g)>0);g.press();g.frames(200);assert.equal(speed(g),0);
});
test('8. Pulsador ya presionado antes de Ejecutar: botonInicio() deja pasar de inmediato (start() conserva la entrada)',()=>{
 const h=sim();h.press();assert.equal(h.btn(),1);h.program(BARRIER);h.frames(100);
 assert.equal(h.a(),2);assert.equal(h.waiting(),0);assert.equal(h.badge(),'EJECUTANDO');assert.equal(h.btn(),1);
});
test('9. Dos botonInicio() seguidos pasan si el Pulsador sigue presionado',()=>{
 const h=sim();h.program(SETUP('botonInicio();botonInicio();'));h.frames(100);assert.equal(h.a(),1);h.press();h.frames(100);assert.equal(h.a(),2);assert.equal(h.btn(),1);
 const g=sim();g.press();g.program(SETUP('botonInicio();botonInicio();'));g.frames(100);assert.equal(g.a(),2,'ya presionado: ambas pasan');
});
test('10. Si el Pulsador se libera entre ambas llamadas, la segunda espera',()=>{
 const h=sim();h.program(`int a=0;void setup(){a=1;botonInicio();a=2;pausa(300);botonInicio();a=3;}void loop(){pausa(10);}`);
 h.frames(100);h.press();h.frames(200);assert.equal(h.a(),2,'primera pasó; dentro de pausa(300)');
 h.press();assert.equal(h.btn(),0);h.frames(600);assert.equal(h.a(),2,'segunda barrera: espera');assert.equal(h.waiting(),1);assert.equal(h.badge(),'ESPERANDO PULSADOR');
 h.press();h.frames(100);assert.equal(h.a(),3);assert.equal(h.badge(),'EJECUTANDO');
});
test('botonInicio() no detiene el movimiento previo (no inventa detenerse()) ni cambia órdenes anteriores',()=>{
 const h=sim();h.program('void setup(){inicializarMovimiento();avanzar(20);botonInicio();}void loop(){pausa(10);}');h.frames(400);
 assert.equal(h.waiting(),1);assert.ok(speed(h)>0,'la orden previa sigue vigente: la barrera solo detiene el intérprete');
});
test('11. Reiniciar cancela la espera, libera Pulsador e IR y vuelve a EN ESPERA',()=>{
 const h=sim();h.el('ir0').events.click();h.program(BARRIER);h.frames(100);assert.equal(h.waiting(),1);assert.equal(h.js('ir[0]'),1);
 h.el('reset').events.click();
 assert.equal(h.waiting(),0);assert.equal(h.js('running'),0);assert.equal(h.badge(),'EN ESPERA');assert.equal(h.btn(),0);assert.equal(h.js('ir[0]'),0);assert.equal(h.js('it'),null);
 h.frames(300);assert.equal(h.a(),1,'el programa cancelado no avanza (ni siquiera al pulsar)');h.press();h.frames(300);assert.equal(h.badge(),'EN ESPERA');
});
test('12. Cambiar de pista cancela la espera',()=>{
 const h=sim();h.program(BARRIER);h.frames(100);assert.equal(h.waiting(),1);
 h.js("changeTrack('s02')");assert.equal(h.waiting(),0);assert.equal(h.js('running'),0);assert.equal(h.badge(),'EN ESPERA');
 h.press();h.frames(200);assert.equal(h.badge(),'EN ESPERA');
});
test('13. Un error cancela la espera y no deja «ESPERANDO PULSADOR»; una nueva ejecución no hereda la espera',()=>{
 const h=sim();h.program(BARRIER);h.frames(100);assert.equal(h.badge(),'ESPERANDO PULSADOR');
 h.js("fail({m:'error de prueba',ln:1})");h.frames(100);
 assert.equal(h.waiting(),0);assert.equal(h.js('running'),0);assert.notEqual(h.badge(),'ESPERANDO PULSADOR');assert.equal(h.badge(),'DETENIDO');
 // nueva ejecución tras la espera: arranca limpia
 const g=sim();g.program(BARRIER);g.frames(100);g.program('int a=0;void setup(){a=5;}void loop(){pausa(10);}');g.frames(100);
 assert.equal(g.waiting(),0);assert.equal(g.a(),5);assert.equal(g.badge(),'EJECUTANDO');
 // un error de sintaxis al re-ejecutar también cancela la espera
 const k=sim();k.program(BARRIER);k.frames(100);k.program('void setup(){');k.frames(50);assert.equal(k.waiting(),0);assert.equal(k.js('running'),0);assert.equal(k.badge(),'EN ESPERA');
});
test('14. Pausar mientras espera: EN PAUSA; el intérprete no avanza',()=>{
 const h=sim();h.program(BARRIER);h.frames(100);assert.equal(h.badge(),'ESPERANDO PULSADOR');
 h.el('pause').events.click();assert.equal(h.badge(),'EN PAUSA');assert.equal(h.el('pause').textContent,'Continuar');
 h.frames(500);assert.equal(h.a(),1);assert.equal(h.badge(),'EN PAUSA');
});
test('15–16. Pulsar durante la pausa registra la entrada pero no avanza; Continuar entonces permite avanzar',()=>{
 const h=sim();h.program(SETUP('botonInicio();','avanzar(30);'));h.frames(100);
 h.el('pause').events.click();h.press();h.el('ir1').events.click();
 assert.equal(h.btn(),1);assert.equal(h.js('ir[1]'),1);h.frames(500);assert.equal(h.a(),1,'EN PAUSA: no avanza aunque el Pulsador esté presionado');assert.equal(h.badge(),'EN PAUSA');
 h.el('pause').events.click();assert.equal(h.badge(),'EJECUTANDO','con el Pulsador presionado ya no se espera');
 h.frames(300);assert.equal(h.a(),2);assert.equal(h.waiting(),0);assert.ok(speed(h)>0);
});
test('17. Continuar sin pulsar vuelve a ESPERANDO PULSADOR',()=>{
 const h=sim();h.program(BARRIER);h.frames(100);h.el('pause').events.click();h.frames(200);
 h.el('pause').events.click();assert.equal(h.badge(),'ESPERANDO PULSADOR');h.frames(300);assert.equal(h.a(),1);assert.equal(h.badge(),'ESPERANDO PULSADOR');
 h.press();h.frames(100);assert.equal(h.a(),2);
});
test('18. IR y Pulsador siguen siendo editables durante la espera; Pausar y Reiniciar siguen activos',()=>{
 const h=sim();h.program(BARRIER);h.frames(100);
 for(const k of [0,1]){h.el('ir'+k).events.click();assert.equal(h.js(`ir[${k}]`),1);}
 h.el('ir0').events.click();assert.equal(h.js('ir[0]'),0);
 assert.equal(h.el('pause').disabled,false);assert.equal(h.el('reset').disabled,false);assert.equal(h.waiting(),1,'tocar IR no libera la barrera');
 h.press();h.press();h.frames(100);assert.equal(h.waiting(),1,'presionar y soltar antes del siguiente fotograma no cuenta: sigue esperando');
});
test('Estado de UI: la espera no cambia otros estados (demo, FINALIZADO) ni se muestra fuera de modo código',()=>{
 const h=sim();h.el('demo').events.click();h.frames(200);assert.equal(h.js('waitingButton'),0);assert.notEqual(h.badge(),'ESPERANDO PULSADOR');
 const g=sim();g.program('void setup(){inicializarMovimiento();finPrograma();}void loop(){pausa(10);}');g.frames(100);assert.equal(g.badge(),'FINALIZADO');
});
test('Ejemplo EJ[0] (Óvalo/Ocho): espera el Pulsador y al presionarlo comienza el recorrido',()=>{
 for(const id of ['oval','ocho']){const h=sim(id);h.program(h.js('EJ[0]'));h.frames(500);
  assert.equal(h.badge(),'ESPERANDO PULSADOR',id);assert.equal(speed(h),0);assert.equal(h.js('runDistance'),0);
  h.press();h.frames(1000);assert.equal(h.badge(),'EJECUTANDO',id);assert.ok(h.js('runDistance')>1,id+' recorre');}
});
test('El intérprete no se bloquea: la espera es cooperativa (el reloj simulado avanza y la UI responde)',()=>{
 const h=sim();h.program(BARRIER);const t0=h.js('simTime');h.frames(1000);assert.ok(h.js('simTime')>t0+0.9,'el tiempo simulado avanza mientras espera');
});
console.log(`\n${checks} comprobaciones RUNTIME-START-1 superadas.`);
