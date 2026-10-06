/* node tests/scenario-props.cjs — SCENARIO-PROPS-1: escenario configurable (cajas) separado de la pista.
   TRACK = suelo · DEFAULT SCENARIO = objetos sugeridos · USER SCENARIO = guardado por pista · ACTIVE WORLD = copia física de una ejecución.
   Principio: simulador libre; ninguna pista exige objetos, rutas ni bases. */
'use strict';
const assert=require('node:assert/strict');
const {load}=require('./sim1/harness.cjs');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const KEY=id=>'bitiro:standalone:scenario:v1:'+id;
const IDS=['s01','s02','s03','s04','s05','s06','s07','s08','oval','ocho'];
// Los objetos creados dentro del contexto vm tienen otros prototipos: se normalizan por JSON para deepEqual.
const wrap=h=>{const raw=h.js;h.js=s=>{const v=raw(s);return v&&typeof v==='object'?JSON.parse(JSON.stringify(v)):v;};return h;};
const fresh=(id='s01',storage)=>{const h=wrap(load({storage}));h.js(`changeTrack('${id}')`);return h;};
const obs=h=>h.js('activeObstacles.map(o=>({id:o.id,x:o.x,y:o.y,width:o.width,height:o.height,movable:o.movable}))');
const S=h=>h.js('BITIRO_SCENARIO'),track=(h)=>h.js('track');
const apply=(h,list,opts)=>h.js(`BITIRO_WORLD.apply(${JSON.stringify(list)},${JSON.stringify(opts||{})})`);

test('1. S01 por defecto contiene practice-box (46, 94, 8×8, movible, no oficial) y sceneTrack ya no lleva obstáculos',()=>{
 const h=fresh('s01');assert.deepEqual(obs(h),[{id:'practice-box',x:46,y:94,width:8,height:8,movable:true}]);
 assert.equal(h.js('BITIRO_SCENARIO.defaults("s01")[0].official'),false);
 assert.equal(h.js('"obstacles" in sceneTrack'),false,'sceneTrack = solo geometría');
 assert.equal(h.js('sceneTrack.paths.length>0&&sceneTrack.finishZones.length===2'),true);
});
test('2. S02–S08, Óvalo y Ocho por defecto sin objetos (S06 sin caja)',()=>{
 for(const id of IDS.filter(i=>i!=='s01')){const h=fresh(id);assert.deepEqual(obs(h),[],id);}
});
test('3. «[]» persistido vence al predeterminado y la demo no inventa la caja',()=>{
 const h=fresh('s01',{[KEY('s01')]:'[]'});assert.deepEqual(obs(h),[]);
 h.el('demo').events.click();for(let n=0;n<120*80&&h.js('mode')==='demo';n++)h.js('update(1/120)');
 assert.deepEqual(obs(h),[],'la demo no crea ni borra props');assert.equal(h.js('mode'),'idle');
 assert.equal(h.el('statusBadge').textContent,'RECORRIDO VISUALIZADO','sin caja, la demo recorre y termina sin error');
});
test('4. Restaurar predeterminado elimina el override y recupera practice-box',()=>{
 const h=fresh('s01');assert.equal(apply(h,[]),true);assert.ok(h.saved.has(KEY('s01')));assert.deepEqual(obs(h),[]);
 h.js("changeTrack('s02');changeTrack('s01')");assert.deepEqual(obs(h),[],'el vacío elegido sobrevive al cambio de pista');
 apply(h,[],{useDefault:true});assert.equal(h.saved.has(KEY('s01')),false,'override eliminado');
 assert.deepEqual(obs(h).map(o=>o.id),['practice-box']);
});
test('5. Escenarios aislados por pista y claves de código intactas',()=>{
 const h=fresh('s02');const r=h.js('BITIRO_SCENARIO.addBox([],track,20,80)');assert.equal(r.ok,true);apply(h,r.list);
 assert.equal(obs(h).length,1);h.js("changeTrack('s03')");assert.deepEqual(obs(h),[]);
 h.js("changeTrack('s01')");assert.deepEqual(obs(h).map(o=>o.id),['practice-box']);
 h.js("changeTrack('s02')");assert.equal(obs(h)[0].id,'user-box-1');
 assert.deepEqual([...h.saved.keys()].filter(k=>k.includes(':scenario:')),[KEY('s02')]);
 assert.ok(![...h.saved.keys()].some(k=>k.startsWith('bitiro:standalone:code:')&&k.includes('scenario')));
});
test('6. Ids de usuario deterministas: user-box-N con el siguiente entero libre; practice-box conserva su id',()=>{
 const h=fresh('s01');let list=h.js('BITIRO_WORLD.scenario()');
 for(const [x,y] of [[10,40],[30,40],[60,40]]){const r=h.js(`BITIRO_SCENARIO.addBox(${JSON.stringify(list)},track,${x},${y})`);assert.ok(r.ok);list=r.list;}
 assert.deepEqual(list.map(b=>b.id),['practice-box','user-box-1','user-box-2','user-box-3']);
 list=h.js(`BITIRO_SCENARIO.removeBox(${JSON.stringify(list)},"user-box-2")`);
 assert.equal(h.js(`BITIRO_SCENARIO.nextId(${JSON.stringify(list)})`),'user-box-2','reutiliza el entero libre más bajo');
 assert.deepEqual(h.js('BITIRO_SCENARIO.nextId([])'),'user-box-1');
});
test('7–9. Añadir, mover y eliminar caja (operaciones puras sobre el borrador)',()=>{
 const h=fresh('s02');const L=JSON.stringify;
 const a=h.js('BITIRO_SCENARIO.addBox([],track,20.04,80)');assert.equal(a.ok,true);assert.deepEqual([a.box.x,a.box.y,a.box.width,a.box.height],[20,80,8,8]);
 const m=h.js(`BITIRO_SCENARIO.moveBox(${L(a.list)},track,"user-box-1",30,90)`);assert.equal(m.ok,true);assert.deepEqual([m.list[0].x,m.list[0].y],[30,90]);
 assert.deepEqual([a.list[0].x,a.list[0].y],[20,80],'el borrador anterior no se muta');
 assert.deepEqual(h.js(`BITIRO_SCENARIO.removeBox(${L(m.list)},"user-box-1")`),[]);
 assert.equal(h.js(`BITIRO_SCENARIO.moveBox(${L(m.list)},track,"nope",1,1)`).ok,false);
 assert.equal(h.js(`BITIRO_SCENARIO.moveBox(${L(m.list)},track,"user-box-1",NaN,1)`).ok,false);
});
test('10. Impide salir de la pista (cualquier borde)',()=>{
 const h=fresh('s02');const t=track(h);
 for(const [x,y] of [[-1,50],[t.w-7,50],[50,-1],[50,t.h-7],[0,50],[50,0]]){const r=h.js(`BITIRO_SCENARIO.addBox([],track,${x},${y})`);assert.equal(r.ok,false,`${x},${y}`);assert.match(r.reason,/fuera de los límites/);}
 assert.equal(h.js(`BITIRO_SCENARIO.addBox([],track,${t.w-8-.4},${t.h-8-.4})`).ok,true,'el límite exacto sí es válido');
});
test('11. Impide superponer cajas (y permite tocarse sin solaparse)',()=>{
 const h=fresh('s02');const a=h.js('BITIRO_SCENARIO.addBox([],track,20,80)'),L=JSON.stringify(a.list);
 const r=h.js(`BITIRO_SCENARIO.addBox(${L},track,24,84)`);assert.equal(r.ok,false);assert.match(r.reason,/otra caja/);
 assert.equal(h.js(`BITIRO_SCENARIO.addBox(${L},track,28,80)`).ok,true,'contiguas sin solape');
 const two=h.js(`BITIRO_SCENARIO.addBox(${L},track,40,80)`).list;
 assert.equal(h.js(`BITIRO_SCENARIO.moveBox(${JSON.stringify(two)},track,"user-box-2",22,80)`).ok,false,'mover encima de otra');
});
test('12. Impide solapar el cuerpo del IROH en defaultStart y atravesar el mecanismo de golpe en reposo',()=>{
 for(const id of ['s01','s02','s04','s06','s08','oval']){
  const h=fresh(id),t=track(h);
  const r=h.js(`BITIRO_SCENARIO.addBox([],track,${t.start.x-4},${t.start.y-4})`);assert.equal(r.ok,false,id);assert.match(r.reason,/robot/);
  // Mecanismo: existe alguna posición que no toca el cuerpo pero sí la barra recogida, y se rechaza con su propio motivo.
  const found=h.js(`(()=>{const M=IROH_MECHANICS,p={x:track.start.x,y:track.start.y,th:track.start.heading+Math.PI/2};
   for(let y=0;y<track.h-8;y+=.5)for(let x=0;x<track.w-8;x+=.5){const b={id:'p',x,y,width:8,height:8};
    if(M.insideArena(b,track)&&!M.bodyOverlapsBox(p,b)&&M.barOverlapsBox(p,0,b))return BITIRO_SCENARIO.placementError(b,[],track);}return null;})()`);
  if(found!==null)assert.match(found,/mecanismo de golpe/,id);
 }
});
test('13–14. Reiniciar restaura la caja configurada; el golpe mueve solo el MUNDO ACTIVO y no la configuración guardada',()=>{
 const h=fresh('s01');apply(h,[{id:'user-box-1',x:40,y:90,width:8,height:8,movable:true}]);
 const saved=h.saved.get(KEY('s01'));assert.deepEqual(obs(h).map(o=>[o.id,o.x,o.y]),[['user-box-1',40,90]]);
 h.js('R.x=48;R.y=116;R.th=0;previousPose={x:R.x,y:R.y,th:R.th,angle:0}');h.js('stroke(65)');h.tick(400);
 const moved=obs(h)[0];assert.ok(moved.x!==40||moved.y!==90,'el golpe movió la caja activa');assert.ok(h.js('movedCount')>=1);
 assert.equal(h.saved.get(KEY('s01')),saved,'la configuración persistida no cambia');
 assert.deepEqual(h.js('BITIRO_WORLD.scenario()').map(o=>[o.x,o.y]),[[40,90]],'el escenario guardado en memoria tampoco');
 h.js('window.resetRobot()');assert.deepEqual(obs(h).map(o=>[o.x,o.y]),[[40,90]],'Reiniciar vuelve a (40,90)');
 assert.equal(h.js('track.start.x')===h.js('R.x'),true,'robot restaurado');assert.equal(h.js('code=0,1'),1);
});
test('15. El sonar ve una caja creada por el usuario y no ve una fuera de su cono; el cuerpo no la atraviesa',()=>{
 const h=fresh('s02');const t=track(h);
 apply(h,[{id:'user-box-1',x:t.start.x-4,y:110,width:8,height:8,movable:false}]);
 const d=h.js('readSonarDistance()');assert.ok(Math.abs(d-23.2)<1,'detectada a '+d+' cm (esperado ≈23,2)');
 apply(h,[{id:'user-box-1',x:5,y:110,width:8,height:8,movable:false}]);assert.equal(h.js('readSonarDistance()'),200,'fuera del cono');
 apply(h,[{id:'user-box-1',x:t.start.x-4,y:110,width:8,height:8,movable:false}]);
 h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(40);}');
 for(let n=0;n<120*6;n++){h.js('update(1/120)');assert.equal(h.js('IROH_MECHANICS.bodyOverlapsBox({x:R.x,y:R.y,th:R.th},activeObstacles[0])'),false,'cuerpo dentro de la caja en tick '+n);}
 assert.ok(h.js('R.y')>110+8,'el chasis se detuvo ante la caja sin cruzarla: y='+h.js('R.y'));
});
test('15b. Varias cajas: ninguna se atraviesa con otra tras un golpe',()=>{
 const h=fresh('s01');
 apply(h,[{id:'user-box-1',x:46,y:94,width:8,height:8,movable:true},{id:'user-box-2',x:55,y:94,width:8,height:8,movable:true}]);
 h.js('R.x=50;R.y=116;R.th=0;previousPose={x:R.x,y:R.y,th:R.th,angle:0}');h.js('stroke(65)');
 for(let n=0;n<600;n++){h.js('update(1/120)');assert.equal(h.js('IROH_MECHANICS.boxBox(activeObstacles[0],activeObstacles[1])'),false,'cajas solapadas en tick '+n);}
});
test('16. boxSlots de S08 son metadata: no generan obstáculos ni cajas',()=>{
 const h=fresh('s08');assert.equal(track(h).boxSlots.length,4);assert.deepEqual(obs(h),[]);assert.deepEqual(track(h).obstacles,[]);
 assert.deepEqual(h.js('BITIRO_SCENARIO.defaults("s08")'),[]);
});
test('17. Persistencia robusta: JSON corrupto → predeterminado; almacenamiento bloqueado → se conserva en la sesión; cajas inválidas guardadas se descartan',()=>{
 assert.deepEqual(obs(fresh('s01',{[KEY('s01')]:'{no es json'})).map(o=>o.id),['practice-box']);
 assert.deepEqual(obs(fresh('s01',{[KEY('s01')]:'{"a":1}'})).map(o=>o.id),['practice-box'],'un objeto no es una lista');
 const bad=JSON.stringify([{id:'a',x:-50,y:10},{id:'b',x:20,y:80},{id:'b',x:60,y:80},{x:1,y:1}]);
 assert.deepEqual(obs(fresh('s02',{[KEY('s02')]:bad})).map(o=>o.id),['b'],'fuera de pista, duplicado y sin id se descartan');
 const h=wrap(load({blocked:true}));h.js("changeTrack('s02')");
 assert.equal(apply(h,[{id:'user-box-1',x:20,y:80,width:8,height:8,movable:true}]),false,'no se pudo guardar');
 assert.equal(obs(h).length,1);h.js("changeTrack('s03');changeTrack('s02')");assert.equal(obs(h).length,1,'sigue en memoria durante la sesión');
});
test('18. Sin reloj ni aleatoriedad en el módulo; el footprint es fijo 8×8 aunque la entrada diga otra cosa',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'..','scenario-props.js'),'utf8');assert.ok(!/Math\s*\.\s*random|Date\s*\.\s*now|new\s+Date|crypto/.test(src));
 const h=fresh('s02');assert.deepEqual(h.js('BITIRO_SCENARIO.normalize([{id:"z",x:1,y:2,width:30,height:1}])'),[{id:'z',x:1,y:2,width:8,height:8,movable:true}]);
});
console.log(`\n${checks} comprobaciones SCENARIO-PROPS-1 superadas.`);
