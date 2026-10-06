/* node tests/runtime-servo.cjs — RUNTIME-SERVO-1: API oficial moverServoGolpe(-1/0/1) y golpe bidireccional.
   −1 = izquierda DEL ROBOT · 0 = centro (hacia delante) · +1 = derecha DEL ROBOT  →  −75° / 0° / +75° (el estudiante nunca ve los grados).
   Dos movimientos físicos distintos, ambos por contacto y sin atravesar nada:
     A. el servo gira  → la caja sigue el arco/tangente de la barra (advance)
     B. el robot avanza con la barra fija → la caja movible es empujada por la traslación (advanceRobotPose); fija/sin espacio → el robot se detiene.
   Principio: simulador libre; la pista no decide hacia dónde golpear. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {load}=require('./sim1/harness.cjs');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const wrap=h=>{const raw=h.js;h.js=s=>{const v=raw(s);return v&&typeof v==='object'?JSON.parse(JSON.stringify(v)):v;};return h;};
const B=(id,x,y,movable=true)=>({id,x,y,width:8,height:8,movable});
const KEY=id=>'bitiro:standalone:scenario:v1:'+id;
/* Mundo S02 (sin cajas por defecto) con cajas dadas; la pose del robot y de la garra se fijan a mano. */
function world(boxes=[],{track='s02',pose={x:50,y:100,th:0},arm=0,storage}={}){
 const h=wrap(load({storage}));h.js(`changeTrack('${track}')`);h.js(`BITIRO_WORLD.apply(${JSON.stringify(boxes)})`);
 h.put=(p=pose,a=arm)=>h.js(`R.x=${p.x};R.y=${p.y};R.th=${p.th||0};striker.angle=${a};striker.target=${a};previousPose={x:R.x,y:R.y,th:R.th,angle:${a}}`);
 h.put();
 h.boxes=()=>h.js('activeObstacles.map(o=>({id:o.id,x:o.x,y:o.y,movable:o.movable}))');
 h.cmd=c=>h.js(`setStrikerPosition(${c})`);
 h.angle=()=>h.js('striker.angle');
 return h;
}
/* Avanza ticks comprobando en CADA tick: sin penetración barra/cuerpo, dentro de la pista y sin solapar cajas entre sí. */
function run(h,ticks,{each}={}){
 const rows=[];
 for(let i=0;i<ticks;i++){
  h.tick(1);
  const bad=h.js(`(()=>{const M=IROH_MECHANICS,p={x:R.x,y:R.y,th:R.th},a=striker.angle,out=[];
   activeObstacles.forEach((o,i)=>{if(M.barOverlapsBox(p,a,o))out.push('barra atraviesa '+o.id);if(M.bodyOverlapsBox(p,o))out.push('cuerpo sobre '+o.id);if(!M.insideArena(o,track))out.push(o.id+' fuera de la pista');
    for(let j=i+1;j<activeObstacles.length;j++)if(M.boxBox(o,activeObstacles[j]))out.push(o.id+' solapa '+activeObstacles[j].id);});return out;})()`);
  assert.deepEqual(bad,[],`tick ${i}: ${bad.join(', ')}`);
  rows.push({angle:h.angle(),y:h.js('R.y'),x:h.js('R.x')});if(each)each(i,rows[i]);
 }
 return rows;
}
const settle=(h,ticks=200)=>run(h,ticks);

/* ───────── API ───────── */
const API=(v,setup='')=>`void setup(){inicializarGolpe();${setup}moverServoGolpe(${v});} void loop(){pausa(10);}`;
for(const [v,name,deg] of [[-1,'izquierda',-75],[0,'centro',0],[1,'derecha',75]]){
 test(`1–3. moverServoGolpe(${v}) = ${name}: llega a ${deg}° (continuo, no instantáneo)`,()=>{
  const h=world();h.program(API(v,v===0?'moverServoGolpe(1);pausa(100);':''));h.tick(20);
  if(v!==0)assert.ok(Math.abs(h.angle())<Math.abs(deg),'gira de forma continua: aún no llegó');
  h.tick(240);assert.ok(Math.abs(h.angle()-deg)<1e-6,`${h.angle()}° ≠ ${deg}°`);assert.equal(h.js('striker.target'),deg);
  assert.doesNotMatch(h.el('msg').innerHTML,/class=err|class=warn/);
 });
}
test('4–6. Valores no admitidos (65, 2, −2, 0,5, 1,5): aviso claro, la garra NO se mueve (sin clamp ni compatibilidad v4)',()=>{
 for(const v of ['65','2','-2','0.5','1.5','100']){
  const h=world();h.program(`void setup(){inicializarGolpe();moverServoGolpe(${v});} void loop(){pausa(10);}`);h.tick(120);
  assert.equal(h.angle(),0,v+': sin movimiento');assert.equal(h.js('striker.target'),0);assert.equal(h.js('running'),1,'el programa sigue funcionando (aviso, no error fatal)');
  assert.match(h.el('msg').innerHTML,/moverServoGolpe\(\) admite -1, 0 o 1\./,v);assert.doesNotMatch(h.el('msg').innerHTML,/class=err/);
 }
 // un valor inválido tras uno válido deja la posición anterior
 const h=world();h.program('void setup(){inicializarGolpe();moverServoGolpe(1);pausa(1000);moverServoGolpe(65);} void loop(){pausa(10);}');h.tick(300);
 assert.equal(h.js('striker.target'),75);assert.ok(Math.abs(h.angle()-75)<1e-6);
});
test('10–11. Reset deja la garra al centro (0°); inicializarGolpe() manda el centro',()=>{
 const h=world();h.cmd(1);h.tick(200);assert.equal(h.angle(),75);h.js('window.resetRobot()');assert.equal(h.angle(),0);assert.equal(h.js('striker.target'),0);
 const g=world();g.program('void setup(){inicializarGolpe();moverServoGolpe(1);pausa(1200);inicializarGolpe();pausa(1500);} void loop(){pausa(10);}');
 g.tick(130);assert.ok(Math.abs(g.angle()-75)<1e-6,'a la derecha');g.tick(200);assert.ok(Math.abs(g.angle())<1e-6,'inicializarGolpe() la devolvió al centro');
});
test('Modo estricto: moverServoGolpe() sin inicializarGolpe() avisa y no mueve; exige valor finito',()=>{
 const h=world();h.program('void setup(){moverServoGolpe(1);} void loop(){pausa(10);}');h.tick(120);
 assert.equal(h.angle(),0);assert.match(h.el('msg').innerHTML,/Inicializa el golpe con inicializarGolpe\(\)/);
});
test('12. Renderer y física usan el MISMO ángulo físico (grados): sin segunda conversión comando→grados',()=>{
 const h=world();let seen=null;h.ctx.renderScene3D=(c,t,robot)=>{seen=robot.strikerAngle;};
 h.cmd(1);h.tick(20);h.js('paused=true;render()');assert.equal(seen,h.angle());assert.ok(seen>0&&seen<75);
 const r=fs.readFileSync(path.join(__dirname,'..','renderer3d.js'),'utf8');
 assert.match(r,/IROH_MECHANICS\.sweepAngle\(robot\.strikerAngle/);assert.ok(!/commandAngle|moverServoGolpe|setStrikerPosition|positionAngle/.test(r),'el renderer no traduce comandos: solo recibe el ángulo físico');
 assert.deepEqual([-1,0,1,65,2].map(c=>h.js(`IROH_MECHANICS.commandAngle(${c})`)),[-75,0,75,null,null]);
 const [p,t]=h.js('IROH_MECHANICS.segment({x:50,y:100,th:0},-75)');assert.ok(t.x<p.x,'−75° apunta a la izquierda del robot (−x con el robot mirando a −y)');
 const [p2,t2]=h.js('IROH_MECHANICS.segment({x:50,y:100,th:0},75)');assert.ok(t2.x>p2.x,'+75° a la derecha');
 const [p3,t3]=h.js('IROH_MECHANICS.segment({x:50,y:100,th:0},0)');assert.ok(Math.abs(t3.x-p3.x)<1e-9&&t3.y<p3.y,'0° hacia delante');
});

/* ───────── Contacto bidireccional (servo gira) ───────── */
test('13. Contacto a la izquierda: −1 mueve la caja hacia la izquierda del robot, solo por contacto',()=>{
 const h=world([B('b',36,84)]);const x0=h.boxes()[0].x;h.cmd(-1);run(h,200);
 assert.ok(h.boxes()[0].x<x0-1,'la caja se desplazó a la izquierda');assert.equal(h.js('movedCount'),1);assert.equal(h.angle(),-75);
});
test('14. Contacto a la derecha: +1 mueve la caja hacia la derecha del robot, solo por contacto',()=>{
 const h=world([B('b',56,84)]);const x0=h.boxes()[0].x;h.cmd(1);run(h,200);
 assert.ok(h.boxes()[0].x>x0+1,'la caja se desplazó a la derecha');assert.equal(h.js('movedCount'),1);assert.equal(h.angle(),75);
});
test('15. Sin contacto no hay movimiento: ninguna orden mueve una caja fuera del alcance de la barra',()=>{
 const h=world([B('b',10,40),B('c',80,40),B('d',45,20)]);const before=JSON.stringify(h.boxes());
 for(const c of [-1,1,0,1,-1,0])h.cmd(c),run(h,160);
 assert.equal(JSON.stringify(h.boxes()),before);assert.equal(h.js('movedCount'),0);
});
test('16. Vuelta derecha → centro se resuelve con la física normal (empuja si la caja está en el recorrido; nada si ya salió)',()=>{
 // caja ya apartada: volver a 0 no la toca
 const a=world([B('b',56,84)]);a.cmd(1);run(a,200);const pushed=JSON.stringify(a.boxes());a.cmd(0);run(a,200);
 assert.equal(JSON.stringify(a.boxes()),pushed,'la caja que ya salió de la trayectoria no se mueve al volver');assert.equal(a.angle(),0);
 // caja EN el recorrido de vuelta (adelante-derecha): la barra que regresa al centro la empuja hacia la izquierda
 const h=world([B('b',52,76)],{arm:75});const x0=h.boxes()[0].x;h.cmd(0);run(h,200);
 assert.ok(h.boxes()[0].x<x0-0.5,'la barra que vuelve al centro desplaza la caja (x '+x0+' → '+h.boxes()[0].x+')');assert.equal(h.angle(),0);
});
test('17. Vuelta izquierda → centro (simétrica)',()=>{
 const a=world([B('b',36,84)]);a.cmd(-1);run(a,200);const pushed=JSON.stringify(a.boxes());a.cmd(0);run(a,200);assert.equal(JSON.stringify(a.boxes()),pushed);
 const h=world([B('b',40,76)],{arm:-75});const x0=h.boxes()[0].x;h.cmd(0);run(h,200);
 assert.ok(h.boxes()[0].x>x0+0.5,'la barra que vuelve desde la izquierda empuja la caja hacia la derecha');assert.equal(h.angle(),0);
});
test('18. Barrido izquierda → derecha atraviesa el eje frontal sin tunneling: la caja del frente sale por la derecha',()=>{
 const h=world([B('b',46,76)],{arm:-75});const x0=h.boxes()[0].x;h.cmd(1);run(h,260);
 assert.ok(h.boxes()[0].x>x0+3,'la caja del frente fue empujada a la derecha');assert.equal(h.angle(),75);assert.equal(h.js('movedCount'),1);
});
test('19. Barrido derecha → izquierda (simétrico)',()=>{
 const h=world([B('b',46,76)],{arm:75});const x0=h.boxes()[0].x;h.cmd(-1);run(h,260);
 assert.ok(h.boxes()[0].x<x0-3,'la caja del frente fue empujada a la izquierda');assert.equal(h.angle(),-75);
});
test('20. Dos cajas nunca se solapan ni se atraviesan (la que empuja se detiene contra la otra)',()=>{
 const h=world([B('a',56,84),B('b',65,84)]);h.cmd(1);run(h,300);
 const [a,b]=h.boxes();assert.ok(!h.js('IROH_MECHANICS.boxBox(activeObstacles[0],activeObstacles[1])'));assert.ok(a.x<b.x);
});
test('21. La caja nunca sale de la pista: contra el borde la garra se detiene',()=>{
 const h=world([B('b',91,84)],{pose:{x:84,y:100,th:0}});h.cmd(1);run(h,400);
 const b=h.boxes()[0];assert.ok(b.x+8<=100-0.35+1e-9,'caja dentro: '+(b.x+8));
});
test('22. El cuerpo del robot nunca es atravesado (comprobado en cada tick de todos los escenarios anteriores y aquí con una caja pegada al chasis)',()=>{
 const h=world([B('b',60,92)],{pose:{x:50,y:105,th:0}});h.cmd(1);run(h,300);
});
test('23. Obstáculo movable:false bloquea el servo: no se mueve ni se atraviesa',()=>{
 const h=world([B('b',56,84,false)]);const before=JSON.stringify(h.boxes());h.cmd(1);run(h,300);
 assert.equal(JSON.stringify(h.boxes()),before);assert.ok(h.angle()<75,'bloqueado antes de +75°: '+h.angle());assert.match(h.js('striker.blocked'),/obstáculo fijo/);
 h.js('updateTelemetry()');assert.match(h.el('strikerStatus').textContent,/BLOQUEADO/);
});
test('24. Una caja creada por el usuario (user-box-N) interactúa igual que practice-box',()=>{
 const h=world([B('user-box-1',56,84)]);h.cmd(1);run(h,200);assert.ok(h.boxes()[0].x>57);assert.equal(h.js('striker.hitIds.size'),1);
});
test('25. El practice-box por defecto de S01 sigue siendo válido con la garra centrada',()=>{
 const h=wrap(load());h.js("changeTrack('s01')");
 assert.deepEqual(h.js('activeObstacles.map(o=>[o.id,o.x,o.y])'),[['practice-box',46,94]]);
 assert.equal(h.js('BITIRO_SCENARIO.placementError(BITIRO_SCENARIO.defaults("s01")[0],[],track)'),null);
});
test('26. S01 vacío: la demo no crea caja, no prepara la garra y no inventa golpe',()=>{
 const h=wrap(load({storage:{[KEY('s01')]:'[]'}}));h.js("changeTrack('s01')");assert.deepEqual(h.js('activeObstacles'),[]);
 h.el('demo').events.click();assert.equal(h.js('striker.target'),0,'sin cajas no hay nada que preparar');
 for(let n=0;n<120*60&&h.js('mode')==='demo';n++)h.js('update(1/120)');
 assert.equal(h.js('activeObstacles.length'),0);assert.equal(h.js('movedCount'),0);assert.equal(h.js('striker.angle'),0);assert.equal(h.el('statusBadge').textContent,'RECORRIDO VISUALIZADO');
});
test('27–28. Garra manual: Izquierda / Centro / Derecha (sin retorno automático); deshabilitada durante el código',()=>{
 const h=wrap(load());h.js("changeTrack('s02')");h.angle=()=>h.js('striker.angle');
 h.el('clawLeft').events.click();h.tick(200);assert.equal(h.angle(),-75);h.js('updateTelemetry()');
 assert.equal(h.el('clawLeft').attrs['aria-pressed'],'true');assert.equal(h.el('clawCenter').attrs['aria-pressed'],'false');
 h.tick(100);assert.equal(h.angle(),-75,'no regresa sola');
 h.el('clawRight').events.click();h.tick(300);assert.equal(h.angle(),75);h.el('clawCenter').events.click();h.tick(300);assert.equal(h.angle(),0);
 h.js('updateTelemetry()');assert.equal(h.el('strikerStatus').textContent,'CENTRO · 0°');
 // durante el código: deshabilitados e ignoran clics
 h.program('void setup(){inicializarGolpe();} void loop(){pausa(10);}');h.tick(5);h.js('updateTelemetry()');
 for(const id of ['clawLeft','clawCenter','clawRight'])assert.equal(h.el(id).disabled,true,id);
 h.el('clawRight').events.click();h.tick(100);assert.equal(h.angle(),0,'ignorado en modo código');
 h.el('reset').events.click();h.js('updateTelemetry()');for(const id of ['clawLeft','clawCenter','clawRight'])assert.equal(h.el(id).disabled,false,id+' activo fuera de modo código');
});
test('Telemetría legible: CENTRO · 0° / IZQUIERDA · −75° / DERECHA · 75° / EN MOVIMIENTO / BLOQUEADO; sin RECOGIDO ni 0–65',()=>{
 const h=world();const t=()=>{h.js('updateTelemetry()');return h.el('strikerStatus').textContent;};
 assert.equal(t(),'CENTRO · 0°');h.cmd(-1);h.tick(10);assert.match(t(),/^-\d+° · EN MOVIMIENTO$/);h.tick(200);assert.equal(t(),'IZQUIERDA · -75°');
 h.cmd(1);h.tick(300);assert.equal(t(),'DERECHA · 75°');
 const src=fs.readFileSync(path.join(__dirname,'..','simulator.js'),'utf8');assert.ok(!/RECOGIDO|POSICIÓN FIJA/.test(src));
});
test('29. Determinismo: misma entrada → misma traza (caja, ángulo y pose)',()=>{
 const once=()=>{const h=world([B('b',46,76),B('c',56,84)],{arm:-75});h.cmd(1);const t=[];run(h,150,{each:()=>t.push(JSON.stringify([h.angle(),h.boxes()]))});h.cmd(0);run(h,150,{each:()=>t.push(JSON.stringify([h.angle(),h.boxes()]))});return t.join('|');};
 assert.equal(once(),once());
});
test('30. botonInicio() sigue funcionando sin cambios (espera el Pulsador y continúa)',()=>{
 const h=world();h.program('int a=0;void setup(){a=1;botonInicio();a=2;} void loop(){pausa(10);}');h.tick(200);assert.equal(h.js('scopes[0].a'),1);assert.equal(h.js('waitingButton'),1);
 h.el('pulsador').events.click();h.tick(50);assert.equal(h.js('scopes[0].a'),2);
});
test('EJ[4] (API oficial): aparta la garra a la izquierda, se acerca con el sonar, barre a la derecha y vuelve al centro; la caja se desplaza',()=>{
 const h=wrap(load());h.js("changeTrack('s01')");h.program(h.js('EJ[4]'));
 assert.match(h.js('EJ[4]'),/moverServoGolpe\(-1\)[\s\S]*moverServoGolpe\(1\)[\s\S]*moverServoGolpe\(0\)/);assert.doesNotMatch(h.js('EJ[4]'),/moverServoGolpe\(65\)/);
 let swept=false;for(let n=0;n<120*14;n++){h.js('update(1/120)');if(h.js('movedCount')>=1&&h.js('striker.angle')>70)swept=true;}
 assert.ok(swept,'alcanzó y golpeó');assert.ok(h.js('activeObstacles[0].x')>54,'practice-box desplazada hacia la derecha');assert.equal(h.js('striker.angle'),0,'terminó centrada');
 assert.doesNotMatch(h.el('msg').innerHTML,/class=err|class=warn/);
});

/* ───────── Traslación del robot con la barra fija (caso B) ───────── */
const DRIVE='void setup(){inicializarMovimiento();} void loop(){avanzar(30);}';
function drive(boxes,pose={x:50,y:100,th:0},arm=0){const h=world(boxes,{pose,arm});h.program(DRIVE);h.put(pose,arm);return h;}
test('A1. Robot avanza con la garra al centro y toca una caja movible: la caja se desplaza, la barra no la atraviesa y el robot continúa',()=>{
 const h=drive([B('b',46,66)]);const y0=h.boxes()[0].y;const rows=run(h,500);
 assert.ok(h.boxes()[0].y<y0-8,'la caja fue empujada hacia delante: '+y0+' → '+h.boxes()[0].y);assert.ok(rows[rows.length-1].y<rows[0].y-20,'el robot sigue avanzando mientras hay espacio');
 assert.equal(h.js('movedCount'),1);assert.match(h.el('feedback').textContent,/empuja una caja por contacto/);
});
test('A2. La misma caja con movable:false: el robot se detiene en la última pose válida',()=>{
 const h=drive([B('b',46,66,false)]);const before=JSON.stringify(h.boxes());const rows=run(h,500);
 assert.equal(JSON.stringify(h.boxes()),before);const yEnd=rows[rows.length-1].y;assert.equal(rows[rows.length-60].y,yEnd,'detenido');
 assert.ok(Math.abs(yEnd-(66+8+13.2+8.6+0.52))<0.3,'con la punta a ~0,5 cm de la caja: '+yEnd);assert.match(h.el('feedback').textContent,/obstáculo fijo/);assert.equal(h.js('movedCount'),0);
});
test('A3. Caja contra el borde de la arena: no sale y el robot se detiene',()=>{
 const h=drive([B('b',46,3)],{x:50,y:60,th:0});const rows=run(h,900);
 const b=h.boxes()[0];assert.ok(b.y>=0.35-1e-9,'dentro: '+b.y);assert.ok(Math.abs(b.y-0.35)<0.35,'quedó contra el borde');
 assert.equal(rows[rows.length-1].y,rows[rows.length-100].y,'robot detenido');assert.match(h.el('feedback').textContent,/no tiene espacio/);
});
test('A4. Caja A contra caja B: no se solapan; el movimiento se bloquea (no hay cadena de empuje)',()=>{
 const h=drive([B('a',46,66),B('b',46,52)]);const rows=run(h,700);
 const [a,b]=h.boxes();assert.equal(b.y,52,'B no se movió');assert.ok(a.y>=60-1e-6&&a.y<=60.1,'A quedó pegada a B: '+a.y);
 assert.equal(rows[rows.length-1].y,rows[rows.length-100].y,'robot detenido');
});
test('Giro con la barra tocando una caja: no se resuelve; el robot queda en la última pose válida (sin empuje rotacional)',()=>{
 const h=world([B('b',40,80)],{pose:{x:50,y:100,th:0}});h.program('void setup(){inicializarMovimiento();} void loop(){girarIzquierda(40);}');h.put({x:50,y:100,th:0},0);
 const b0=JSON.stringify(h.boxes());run(h,400);assert.equal(JSON.stringify(h.boxes()),b0,'la caja no se teletransporta ni se mueve');
 assert.ok(Math.abs(h.js('R.th'))<0.4,'el giro se detuvo al tocar: th='+h.js('R.th'));assert.match(h.el('feedback').textContent,/durante un giro/);
});
test('El cuerpo del robot no empuja cajas (regla vigente): el chasis contra una caja → bloqueo',()=>{
 const h=world([B('b',52,70)],{pose:{x:50,y:92,th:0}});h.program(DRIVE);h.put({x:50,y:92,th:0},-75);   // garra a un lado: el cuerpo llega primero
 const b0=JSON.stringify(h.boxes());run(h,300);assert.equal(JSON.stringify(h.boxes()),b0);assert.ok(h.js('R.y')>86&&h.js('R.y')<87,'frenó con el chasis: '+h.js('R.y'));
});
test('A5–A6. Reiniciar devuelve la caja a la posición configurada; el escenario persistido no cambia por la física del MUNDO ACTIVO',()=>{
 const h=drive([B('b',46,66)]);const saved=h.saved.get(KEY('s02'));assert.ok(saved);run(h,300);assert.ok(h.boxes()[0].y<66);
 assert.equal(h.saved.get(KEY('s02')),saved,'la clave guardada no cambió');assert.deepEqual(h.js('BITIRO_WORLD.scenario().map(o=>[o.x,o.y])'),[[46,66]]);
 h.js('window.resetRobot()');assert.deepEqual(h.boxes().map(o=>[o.x,o.y]),[[46,66]],'Reiniciar → posición configurada');assert.equal(h.angle(),0);
});
test('A7. La misma simulación dos veces da un resultado idéntico (empuje por traslación)',()=>{
 const once=()=>{const h=drive([B('b',46,66),B('c',60,60)]);const t=[];run(h,400,{each:(i,r)=>{if(i%10===0)t.push(JSON.stringify([r.x,r.y,h.boxes()]));}});return t.join('|');};
 assert.equal(once(),once());
});
test('Sin contacto el robot avanza con la barra fija sin mover nada (la traslación no empuja cajas a distancia)',()=>{
 const h=drive([B('b',10,60),B('c',80,60)]);const b0=JSON.stringify(h.boxes());run(h,300);assert.equal(JSON.stringify(h.boxes()),b0);assert.equal(h.js('movedCount'),0);
});
console.log(`\n${checks} comprobaciones RUNTIME-SERVO-1 superadas.`);
