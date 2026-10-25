/* FIRVI-2025 · RECORRIDO AUTÓNOMO COMPLETO, de extremo a extremo (sin evaluador): un ÚNICO programa basado en sensores lleva al robot desde la base INICIO hasta la base opuesta,
   atravesando los tres cuartos, los tres gaps y los dos topes y apartando los prismas con el abanico, DENTRO de una ronda real (reloj de competencia, calibración, sin faltas de
   progreso). La pista NO se altera para favorecer al programa.
   Estado: ACTIVADA EN LA FASE DE INTEGRACIÓN. Durante las Etapas A–C no existía un programa capaz (el seguidor genérico quedaba detenido en el 2.º prisma; ver docs/firvi-2025.md,
   «Integración autónoma»), por lo que estuvo PENDIENTE. Con el programa de referencia (tests/integration/reference-program.iroh) la comprobación pasa. La validación completa con el
   evaluador, el aislamiento y los controles negativos viven en tests/firvi-integral.cjs (y la ronda con el reloj de pared, en tests/firvi-integral-ui.mjs).
   Se mantiene aquí, fuera de `tests/*.cjs`, como comprobación mínima del motor; si no se pide, termina con código 0 y «OMITIDA»:
     FIRVI_E2E=1 node tests/pending/firvi-full-autonomous-run.cjs [A|B]     (código ≠ 0 si el robot no completa el recorrido)
     FIRVI_E2E_PROGRAM=ruta.iroh  usa otro programa (p. ej. tests/integration/legacy-single-sweep.iroh, que SIGUE sin completar el recorrido) */
'use strict';
const assert=require('node:assert/strict');
const {load}=require('../sim1/harness.cjs');
if(!process.env.FIRVI_E2E){console.log('OMITIDA · recorrido autónomo completo FIRVI 2025 (ejecuta con FIRVI_E2E=1; la validación completa es tests/firvi-integral.cjs). Ver el encabezado de este archivo.');process.exit(0);}
const route=process.argv[2]==='B'?'firvi-2025-b':'firvi-2025';
const PROGRAM=require('fs').readFileSync(process.env.FIRVI_E2E_PROGRAM||require('path').join(__dirname,'..','integration','reference-program.iroh'),'utf8');
const h=load({extraFiles:['line-geometry.js','firvi-2025.js','firvi-competition.js']});
const clock={t:0,now:()=>clock.t};h.ctx.BITIRO_COMPETITION.setClock(clock);h.js(`changeTrack('${route}')`);h.ctx.BITIRO_COMPETITION.enter();
const s=h.ctx.BITIRO_COMPETITION.session();
s.startRound();h.el('src').value=PROGRAM;clock.t+=60000;s.beginRun();h.js('start()');
for(let t=0;t<120*3;t++){h.js('update(1/120)');clock.t+=1000/120;}h.js('pressTouchSensor(1)');   // el programa de referencia espera el Pulsador (botonInicio)
for(let t=0;t<120*420&&s.state!=='finished';t++){h.js('update(1/120)');clock.t+=1000/120;s.poll();if(s.round.endReached)break;}
const r=s.round;console.log(JSON.stringify({route,state:s.state,elapsedS:Math.round(s.elapsedMs()/1000),overcome:Object.keys(r.overcome),endReached:!!r.endReached,faults:r.faults.length,collisions:h.js('collisionCount')}));
assert.ok(r.endReached,'el robot debe llegar a la base opuesta');assert.equal(r.faults.length,0,'sin faltas de progreso');assert.deepEqual(Object.keys(r.overcome),['1','2']);assert.ok(s.elapsedMs()<8*60*1000);
console.log('OK · recorrido autónomo completo');
