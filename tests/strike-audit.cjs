/* node tests/strike-audit.cjs — PILOT-5: auditoría del golpe S01 (SOLO LECTURA de la mecánica).
   No modifica tracks.js, strike-physics.js, renderer3d.js ni goldens: mide pose, caja, contacto y desplazamiento
   con el motor real, por moverServoGolpe y por golpe manual, y contrasta con controles negativos en memoria. */
'use strict';
const assert=require('node:assert/strict');
const {load}=require('./sim1/harness.cjs');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const BOX0={x:46,y:94,width:8,height:8};
const setup=(pose,patches)=>{const h=load({patches});h.js("changeTrack('s01')");h.js(`R.x=${pose.x};R.y=${pose.y};R.th=${pose.th||0};previousPose={x:R.x,y:R.y,th:R.th,angle:0}`);return h;};
const box=h=>{const o=h.js('activeObstacles')[0];return {x:o.x,y:o.y,width:o.width,height:o.height,movable:o.movable};};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const STRIKE='void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();} void loop(){moverServoGolpe(65);pausa(900);moverServoGolpe(0);pausa(900);}';
const APPROACH=d=>`void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();} void loop(){if(leerDistanciaSonar()<=${d}){detenerse();moverServoGolpe(65);pausa(950);moverServoGolpe(0);pausa(900);}else{avanzar(30);}}`;

/* Ejecuta tick a tick registrando caja, brazo y contacto (barra con holgura mínima) */
function trace(h,ticks){
 // Contacto de un tick = la barra (con la holgura de empuje de 0,44 cm de la mecánica) solapa la caja en ALGÚN comando
 // entre el del tick anterior y el actual, con la pose de cualquiera de los dos instantes (el robot también se mueve).
 const M=h.js('IROH_MECHANICS'),rows=[];let prev=box(h),prevCmd=h.js('striker.angle'),prevPose={x:h.js('R.x'),y:h.js('R.y'),th:h.js('R.th')};
 for(let i=0;i<ticks;i++){
  h.tick(1);const b=box(h),pose={x:h.js('R.x'),y:h.js('R.y'),th:h.js('R.th')},cmd=h.js('striker.angle');
  let contact=false;for(let k=0;k<=20&&!contact;k++){const c=prevCmd+(cmd-prevCmd)*k/20;contact=[prevPose,pose].some(p=>M.barOverlapsBox(p,c,prev,M.spec.halfWidth+.5));}
  rows.push({i,box:b,moved:dist(b,prev)>1e-9,cmd,contact,prev,pose,inside:M.insideArena(b,h.js('track')),body:M.bodyOverlapsBox(pose,b),count:h.js('movedCount')});
  prev=b;prevCmd=cmd;prevPose=pose;
 }
 return rows;
}

test('Pose inicial S01 y caja: robot (50,130) mirando a −y; caja 8×8 en (46,94), movible; brazo recogido en −65°',()=>{
 const h=setup({x:50,y:130});const M=h.js('IROH_MECHANICS');
 assert.deepEqual([h.js('R.x'),h.js('R.y'),h.js('R.th')],[50,130,0]);assert.deepEqual(box(h),{...BOX0,movable:true});
 assert.equal(h.js('activeObstacles.length'),1);assert.equal(h.js('movedCount'),0);
 assert.ok(Math.abs(M.sweepAngle(0)*180/Math.PI+65)<1e-9,'comando 0 = −65° (recogido)');assert.ok(Math.abs(M.sweepAngle(65)*180/Math.PI-65)<1e-9);
 const [pivot,tip]=M.segment({x:50,y:130,th:0},0);assert.ok(Math.abs(pivot.y-121.4)<1e-9,'pivote a 8,6 cm del centro');assert.ok(Math.abs(Math.hypot(tip.x-pivot.x,tip.y-pivot.y)-13.2)<1e-9,'palo de 13,2 cm');
 assert.ok(dist({x:50,y:130},{x:50,y:98})>28&&!M.bodyOverlapsBox({x:50,y:130,th:0},box(h)),'distancia robot–caja y sin solape inicial');
});
test('Sin contacto NO hay movimiento: golpe completo a distancia, la caja queda idéntica y movedCount=0',()=>{
 for(const y of [130]){const h=setup({x:50,y});h.program(STRIKE);const rows=trace(h,600);
  assert.ok(rows.some(r=>r.cmd>60),'el brazo sí se extiende (y='+y+')');
  assert.ok(rows.every(r=>!r.moved&&!r.contact),'sin contacto y sin movimiento (y='+y+')');assert.deepEqual(box(h),{...BOX0,movable:true});assert.equal(h.js('movedCount'),0);}
});
test('Con contacto: la caja solo se mueve en ticks con la barra tocándola; se mueve poco a poco, hacia el lado del barrido, dentro de la pista y sin traspasar el robot',()=>{
 const h=setup({x:50,y:130});h.program(APPROACH(10));const rows=trace(h,900);const moving=rows.filter(r=>r.moved);
 assert.ok(moving.length>0,'la caja se mueve');
 for(const r of moving){assert.ok(r.contact,`tick ${r.i}: movimiento sin contacto`);assert.ok(dist(r.box,r.prev)<=0.45+1e-6,`tick ${r.i}: salto ${dist(r.box,r.prev)} (sin teletransporte)`);}
 for(const r of rows){assert.ok(r.inside,'caja dentro de la pista');assert.ok(!r.body,'caja no atraviesa el cuerpo del robot');assert.equal(r.box.width,8);assert.equal(r.box.height,8);}
 const end=box(h);assert.ok(end.x>BOX0.x,'barrido de −65° a +65°: empuja hacia la derecha del robot (+x)');assert.ok(dist(end,BOX0)>1&&dist(end,BOX0)<40,'desplazamiento final acotado: '+dist(end,BOX0).toFixed(2));
 assert.equal(h.js('movedCount'),1,'movedCount cuenta la caja una sola vez');
 assert.equal(rows.filter(r=>r.count>0).length>0,true);assert.ok(rows.filter(r=>!r.moved&&!r.contact&&r.count>0&&r.i<moving[0].i).length===0,'movedCount no sube antes del primer movimiento');
});
test('Primer contacto: el ángulo y la posición del contacto son coherentes con la geometría (punta de la barra sobre la caja)',()=>{
 const h=setup({x:50,y:130});h.program(APPROACH(10));const rows=trace(h,900),first=rows.find(r=>r.moved);const M=h.js('IROH_MECHANICS');
 const [piv,tip]=M.segment(first.pose,first.cmd);assert.ok(first.cmd>0&&first.cmd<65,'contacto durante el barrido, comando '+first.cmd.toFixed(1));
 const inX=tip.x>=BOX0.x-0.6&&tip.x<=BOX0.x+BOX0.width+0.6,inY=tip.y>=BOX0.y-0.6&&tip.y<=BOX0.y+BOX0.height+0.6;
 assert.ok(M.barOverlapsBox(first.pose,first.cmd,first.prev),'la barra solapa la caja en el primer movimiento');
 assert.ok(inX||inY||dist(piv,{x:50,y:98})<14,'la barra está sobre/junto a la caja');
 assert.equal(h.js('striker.hitIds.size'),1);
});
test('Determinismo: dos ejecuciones idénticas dan exactamente la misma traza de caja y brazo',()=>{
 const run=()=>{const h=setup({x:50,y:130});h.program(APPROACH(10));return trace(h,700).map(r=>[r.box.x,r.box.y,r.cmd].join(','));};
 assert.deepEqual(run(),run());
});
test('Golpe manual (botón «Golpe manual»): mismas garantías que moverServoGolpe; sin contacto no mueve; con contacto empuja y cuenta',()=>{
 const far=setup({x:50,y:130});far.js('stroke(65)');far.tick(300);assert.deepEqual(box(far),{...BOX0,movable:true});assert.equal(far.js('movedCount'),0);assert.ok(far.js('striker.angle')>60);
 const near=setup({x:50,y:116});near.js('stroke(65)');const rows=trace(near,300);
 for(const r of rows.filter(r=>r.moved))assert.ok(r.contact);assert.ok(dist(box(near),BOX0)>1);assert.equal(near.js('movedCount'),1);assert.ok(rows.every(r=>r.inside&&!r.body));
 // manual y programa dan la misma caja final con el mismo estado inicial de pose
 const prog=setup({x:50,y:130});prog.program(APPROACH(10));prog.tick(900);
 assert.ok(box(prog).x>BOX0.x&&box(near).x>BOX0.x,'manual y programa empujan hacia el mismo lado (+x)');
});
test('El brazo vuelve a recogido (comando 0) sin arrastrar la caja hacia atrás: no se retrae a través de ella',()=>{
 const h=setup({x:50,y:130});h.program(APPROACH(10));const rows=trace(h,1500);
 assert.ok(rows.every(r=>r.inside&&!r.body));
 const last=rows[rows.length-1];assert.ok(last.cmd<=65);
 // el brazo no empuja la caja al retraerse: ningún tick con comando decreciente mueve la caja
 const retracting=rows.filter((r,i)=>i>0&&r.cmd<rows[i-1].cmd-1e-9);assert.ok(retracting.length>0,'hubo fase de retorno');
 assert.ok(retracting.every(r=>!r.moved),'la caja no se mueve mientras el brazo se retrae');
 assert.equal(h.js('movedCount'),1);
});
test('Cuerpo del robot sobre la caja o caja pegada a la pared: la caja nunca sale de la arena ni se superpone (borde)',()=>{
 const h=setup({x:50,y:116});h.js('activeObstacles[0].x=88.5;activeObstacles[0].y=94');h.js('stroke(65)');h.tick(400);
 const b=box(h);assert.ok(b.x+b.width<=100-0.35+1e-9,'caja dentro del límite derecho: '+(b.x+b.width));
});

/* ── Controles negativos: si se rompe la regla, la auditoría LO DETECTA ── */
test('Control negativo: un motor que mueve la caja sin contacto es detectado por la auditoría',()=>{
 const h=setup({x:50,y:130});h.program(STRIKE);
 h.js("(()=>{const o=activeObstacles[0];const f=moveRodTowards;moveRodTowards=function(d,dt){f(d,dt);o.x+=0.01;};})()");
 const rows=trace(h,200);assert.ok(rows.some(r=>r.moved&&!r.contact),'la auditoría detecta movimiento sin contacto');
});
test('Control negativo: si no se respeta el límite de la arena o el cuerpo, la comprobación falla',()=>{
 const h=setup({x:50,y:116});h.js('activeObstacles[0].x=99');assert.ok(!h.js('IROH_MECHANICS').insideArena(box(h),h.js('track')),'caja fuera detectada');
 const g=setup({x:50,y:100});assert.ok(g.js('IROH_MECHANICS').bodyOverlapsBox({x:50,y:100,th:0},box(g)),'solape con el cuerpo detectado');
});
console.log(`\n${checks} comprobaciones de auditoría del golpe S01 superadas.`);
