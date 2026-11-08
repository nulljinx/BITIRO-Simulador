/* node tests/contact-messages.cjs — avisos de contacto (ui.feedback) para NNJ: se RETIRAN cuando dejan de ser ciertos y NUNCA mientras siguen vigentes.
   Solo cambia el TEXTO de pantalla: la física, collisionCount, movedCount y BITIRO_PHYSICS_LOG no cambian (se comprueba aquí y con tests/ux-engine-unchanged.cjs).
   Reglas que se fijan:
     1. mientras el robot siga bloqueado O TOCANDO el obstáculo (aunque el programa ya no dé órdenes) el aviso permanece, por mucho que pase el tiempo;
     2. al retroceder/girar y terminar el contacto, el aviso pasa a «Contacto liberado. Comprueba que el camino esté despejado antes de avanzar.» (o «La garra ya no toca el obstáculo.»);
     3. un mensaje de otra procedencia (error, calibración…) nunca se pisa;
     4. «caja desplazada» no se presenta como «trayectoria liberada»: el resumen dice a cuántos cm de su POSICIÓN INICIAL está ESA caja y pide comprobar el camino;
        con varias cajas tocadas, o si no se puede atribuir, no lleva cifra. */
'use strict';
const assert=require('node:assert/strict');
const {load}=require('./sim1/harness.cjs');
const L=require('./integration/lib.cjs');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const B=(id,x,y,movable=true)=>({id,x,y,width:8,height:8,movable});
function world(boxes,{track='s02',pose={x:50,y:100,th:0},arm=0}={}){
 const h=load({});h.js(`changeTrack('${track}')`);h.js(`BITIRO_WORLD.apply(${JSON.stringify(boxes)})`);
 h.put=()=>h.js(`R.x=${pose.x};R.y=${pose.y};R.th=${pose.th};striker.angle=${arm};striker.target=${arm};previousPose={x:R.x,y:R.y,th:R.th,angle:${arm}}`);
 h.put();h.go=code=>{h.program(code);h.put();};   // start() recoloca al robot: la pose se fija DESPUÉS de cargar el programa
 h.fb=()=>h.el('feedback').textContent;h.sec=s=>h.tick(Math.round(s*120));h.t=()=>h.js('simTime');
 return h;
}
const START='void setup(){inicializarMovimiento();}';
const NO_CONTACT=/^Contacto liberado\. Comprueba que el camino esté despejado antes de avanzar\.$/;

test('caja sin espacio (contra el borde): el aviso aparece y PERMANECE mientras el robot sigue detenido contra ella, por mucho que pase el tiempo',()=>{
 const h=world([B('b',46,3)],{pose:{x:50,y:60,th:0}});h.go(START+'void loop(){avanzar(30);}');h.sec(8);
 assert.match(h.fb(),/La caja no tiene espacio para desplazarse: el robot se detuvo\. Cambia la trayectoria/);
 h.sec(40);assert.match(h.fb(),/La caja no tiene espacio/,'sigue bloqueado: el aviso no se retira');assert.ok(h.js('collisionCount')>=1,'el contador interno registra el contacto');
});
test('retroceder termina el contacto: el aviso se sustituye por «Contacto liberado…» (y no antes)',()=>{
 const h=world([B('b',46,3)],{pose:{x:50,y:60,th:0}});h.go(START+'void loop(){avanzar(30);pausa(6000);retroceder(30);pausa(1500);detenerse();pausa(30000);}');
 h.sec(5.8);assert.match(h.fb(),/no tiene espacio/,'bloqueado: aviso vigente');const yBlocked=h.js('R.y');
 h.sec(0.4);assert.match(h.fb(),/no tiene espacio/,'acaba de empezar a retroceder: el contacto termina a los ≈ 0,1 s y el aviso se conserva 0,6 s más (sin parpadeo)');
 h.sec(1.4);assert.match(h.fb(),NO_CONTACT);assert.ok(h.js('R.y')>yBlocked+3,'se alejó de la caja');
 assert.ok(h.js('collisionCount')>=1,'el contador interno registró el contacto (su valor exacto lo fija ux-engine-unchanged.cjs)');
});
test('robot detenido TOCANDO la caja (el programa dejó de dar órdenes): el aviso permanece, no se esconde un contacto real',()=>{
 const h=world([B('b',46,3)],{pose:{x:50,y:60,th:0}});h.go(START+'void loop(){avanzar(30);pausa(6000);detenerse();pausa(30000);}');
 h.sec(7);assert.match(h.fb(),/no tiene espacio/);h.sec(20);assert.match(h.fb(),/no tiene espacio/,'sigue tocando: el aviso sigue siendo cierto');
});
test('giro con la garra tocando una caja: aviso «durante un giro»; al retroceder y despegarse la garra se retira',()=>{
 const h=world([B('b',40,80)],{pose:{x:50,y:100,th:0}});h.go(START+'void loop(){girarIzquierda(40);pausa(2500);retroceder(30);pausa(3000);detenerse();pausa(30000);}');
 h.sec(2.0);assert.match(h.fb(),/La garra tocó una caja durante un giro: el robot se detuvo\. Cambia la trayectoria/);
 assert.ok(Math.abs(h.js('R.th'))<0.4,'el giro se detuvo al tocar');
 h.sec(0.7);assert.match(h.fb(),/durante un giro/,'acaba de empezar a retroceder: la barra sigue a menos de 1 cm de la caja');
 h.sec(2.3);assert.match(h.fb(),NO_CONTACT,'tras retroceder ≈ 17 cm la garra ya no toca la caja');
});
test('servo bloqueado por un obstáculo fijo: el aviso permanece mientras la garra lo toque; una orden nueva lo reemplaza; si la garra se libera sin orden nueva pasa a «La garra ya no toca el obstáculo»',()=>{
 const a=world([B('b',56,84,false)]);a.js('setStrikerPosition(1)');a.sec(3);
 assert.match(a.fb(),/obstáculo fijo/);a.sec(30);assert.match(a.fb(),/obstáculo fijo/,'sigue bloqueada: el aviso no se retira');
 a.js('setStrikerPosition(0)');assert.equal(a.fb(),'Garra: centro.','una orden nueva escribe su propio aviso: el de bloqueo viejo desaparece');
 // Caja fija DELANTE de la punta: la garra (que vuelve del lado derecho al centro) queda bloqueada; al retroceder el robot se libera sin orden nueva
 const b=world([B('f',46,70,false)],{arm:75});b.go('void setup(){inicializarMovimiento();inicializarGolpe();} void loop(){pausa(3000);retroceder(30);pausa(3000);detenerse();pausa(30000);}');
 b.sec(2.5);assert.match(b.fb(),/^El golpe encontró un obstáculo fijo\.$/,'la garra sigue bloqueada contra el obstáculo fijo');assert.match(b.js('striker.blocked'),/obstáculo fijo/);
 b.sec(2.5);assert.match(b.fb(),/^La garra ya no toca el obstáculo\.$/);assert.equal(b.js('striker.blocked'),null);assert.ok(Math.abs(b.js('striker.angle'))<1,'la garra terminó su recorrido hasta el centro');
});
test('un mensaje de OTRA procedencia (error, calibración…) nunca se pisa',()=>{
 const h=world([B('b',46,3)],{pose:{x:50,y:60,th:0}});h.go(START+'void loop(){avanzar(30);pausa(6000);retroceder(30);pausa(1500);detenerse();pausa(30000);}');
 h.sec(5.8);assert.match(h.fb(),/no tiene espacio/);
 h.el('feedback').textContent='Calibración aplicada y guardada en este navegador.';h.sec(6);
 assert.equal(h.fb(),'Calibración aplicada y guardada en este navegador.','no se sustituye un texto que este módulo no escribió');
});
test('mover ≠ despejar (S01, base 8 × 8 cm): lectura 10 cm → «La caja está a 19 cm de su posición inicial»; lectura 12 cm → «a 1 cm»; el resumen pide comprobar el camino y no afirma que esté libre',()=>{
 const code=T=>`int golpeado = 0;\nvoid setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(900);}\nvoid loop(){int dist = leerDistanciaSonar();if (golpeado == 0 && dist <= ${T}) {detenerse();moverServoGolpe(1);pausa(900);moverServoGolpe(0);pausa(700);golpeado = 1;} else {avanzar(30);}}`;
 for(const [T,expected] of [[10,/^La caja está a 19 cm de su posición inicial\. Comprueba que el camino esté despejado\.$/],[12,/^La caja está a 1 cm de su posición inicial\. Comprueba que el camino esté despejado\.$/]]){
  const h=load({});h.js("changeTrack('s01')");h.program(code(T));const seen=[];let real=null;
  for(let i=0;i<120*6;i++){h.tick(1);const f=h.el('feedback').textContent;if(seen[seen.length-1]!==f){seen.push(f);
   // la cifra es la distancia REAL de esa caja a su posición inicial del escenario EN ESE INSTANTE (la garra, al volver al centro, puede moverla un poco más después)
   if(real===null&&/^La caja está a .* de su posición inicial/.test(f))real=h.js("(()=>{const o=activeObstacles[0],o0=scenarioList[0];return Math.hypot(o.x-o0.x,o.y-o0.y);})()");}}
  const summary=seen.find(f=>/^La caja está a .* de su posición inicial/.test(f));
  assert.ok(summary,`T=${T}: debe aparecer el resumen. Mensajes: ${JSON.stringify(seen)}`);assert.match(summary,expected,`T=${T}: ${summary}`);
  const shown=/está a menos de 1 cm/.test(summary)?0:Number(/está a (\d+) cm/.exec(summary)[1]);
  assert.ok(Math.abs(real-shown)<=0.5+1e-9||(shown===0&&real<1),'cifra = distancia real a la posición inicial en ese instante: mostrado '+shown+' · real '+real.toFixed(2));
  assert.ok(!/(quedó|está|ya) (libre|despejad)/.test(summary),'el resumen no afirma que el camino esté libre: pide comprobarlo');
 }
});
test('varias cajas en el escenario: la cifra es de LA caja que tocó la garra (identificada), no de otra ni un acumulado',()=>{
 const h=world([B('a',46,66),B('c',10,10)],{pose:{x:50,y:100,th:0},arm:0});h.go(START+'void loop(){avanzar(30);}');
 h.js("activeObstacles[1].x+=30");   // la caja «c» está a 30 cm de su posición inicial, pero NO la tocó la garra
 const seen=[];for(let i=0;i<120*3;i++){h.tick(1);const f=h.fb();if(seen[seen.length-1]!==f)seen.push(f);}
 h.js("endActivity()");const s=h.fb();
 assert.match(s,/^La caja que tocó la garra está a \d+ cm de su posición inicial\. Comprueba que el camino esté despejado\.$/,JSON.stringify(seen));
 const a=h.js("(()=>{const o=activeObstacles.find(o=>o.id==='a'),o0=scenarioList.find(o=>o.id==='a');return Math.round(Math.hypot(o.x-o0.x,o.y-o0.y));})()");
 assert.equal(Number(/está a (\d+) cm/.exec(s)[1]),a,'la cifra es la de la caja «a» (tocada), no la de «c» (30 cm)');
});
test('dos cajas tocadas en el mismo contacto, o una caja que no se puede atribuir: el mensaje NO lleva cifra',()=>{
 const h=world([B('a',46,66),B('c',10,10)],{pose:{x:50,y:100,th:0}});h.go(START+'void loop(){pausa(100000);}');h.sec(0.1);
 h.js("activeObstacles[0].x+=5;activeObstacles[1].x+=7;noteContact('actividad','Garra: empuja una caja por contacto.',['a','c']);endActivity()");
 assert.match(h.fb(),/^Se movieron 2 objetos respecto de su posición inicial\. Comprueba que el camino esté despejado\.$/);assert.ok(!/\d+ cm/.test(h.fb()),'sin distancia numérica');
 h.js("noteContact('actividad','Garra: empuja una caja por contacto.',['no-existe']);endActivity()");
 assert.match(h.fb(),NO_CONTACT,'un objeto que no se puede atribuir: mensaje sin cifra');assert.ok(!/\d+ cm/.test(h.fb()));
});
test('prisma FIRVI (2 prismas en el escenario): el resumen nombra «El prisma que tocó la garra» y no «La caja»',()=>{
 const h=load({extraFiles:L.EXTRA});h.js("changeTrack('firvi-2025')");const g=L.geometry(h,'A'),p=L.poseAt(g.R,92);
 h.js(`R.x=${p.x};R.y=${p.y};R.th=${p.h+Math.PI/2};previousPose={x:R.x,y:R.y,th:R.th,angle:-75};striker.angle=-75;striker.target=-75;`);
 h.js('setStrikerPosition(1)');const seen=[];
 for(let i=0;i<120*4;i++){h.tick(1);const f=h.el('feedback').textContent;if(seen[seen.length-1]!==f)seen.push(f);}
 const s=seen.find(f=>/^El prisma que tocó la garra está a/.test(f));assert.ok(s,JSON.stringify(seen));assert.match(s,/^El prisma que tocó la garra está a \d+ cm de su posición inicial\. Comprueba que el camino esté despejado\.$/,'hay 2 prismas en el escenario: se identifica el que tocó la garra');
 assert.ok(seen.some(f=>/prisma triangular/.test(f)),'el aviso activo nombra el prisma');
});
test('los avisos ACTIVOS no cambian de texto (compatibilidad con pruebas y con la Guía)',()=>{
 const h=world([B('b',46,66)]);h.go(START+'void loop(){avanzar(30);}');h.sec(3);assert.match(h.fb(),/Garra: empuja una caja por contacto\./);
});
console.log(`\n${checks} pruebas · contact-messages`);
