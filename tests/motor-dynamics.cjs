/* node tests/motor-dynamics.cjs — MOTOR-DYNAMICS-1
   Congela la rampa SIMÉTRICA de rueda (aceleración y frenado a la misma pendiente, 240 %/s) y el caso de
   regresión «un sensor + bang-bang». 240 %/s es una SIMULATION ASSUMPTION: NO está calibrada contra IROH físico. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load,FIXED_DT,root}=require('./sim1/harness.cjs');
const {runBangBang,wheelTrace}=require('./sim1/motor-probe.cjs');
let n=0;const test=(name,fn)=>{fn();n++;console.log('OK · '+name);};
const STEP=240*FIXED_DT,EPS=1e-9;

// ── Dinámica de aproximación de rueda ──
const CASES=[['A',0,50],['B',50,0],['C',0,-50],['D',-50,0],['E',50,-50],['F',-50,50]];
for(const [id,a,b] of CASES)test(`${id}. ${a} → ${b}: pendiente máxima 240 %/s, sin salto, sin overshoot, ruedas idénticas`,()=>{
 const tr=wheelTrace([a,a],[b,b],80);
 const dir=Math.sign(b-a);
 for(let i=1;i<tr.length;i++){
  for(const k of ['L','R']){
   const d=tr[i][k]-tr[i-1][k];
   assert.ok(Math.abs(d)<=STEP+EPS,`${id} tick ${i}: |Δ|=${Math.abs(d)} > 240·dt`);
   assert.ok(d*dir>=-EPS,`${id} tick ${i}: retrocede`);                 // monótono hacia el target
   assert.ok((tr[i][k]-b)*dir<=EPS,`${id} tick ${i}: overshoot`);       // nunca pasa del target
   const remaining=Math.abs(b-tr[i-1][k]);
   assert.ok(Math.abs(Math.abs(d)-Math.min(STEP,remaining))<EPS,`${id} tick ${i}: no usa la pendiente completa`);
  }
  assert.equal(tr[i].L,tr[i].R,'ambas ruedas usan la misma regla');
 }
 assert.ok(Math.abs(tr[1].L-a)<=STEP+EPS&&tr[1].L!==b,'sin salto instantáneo al target (incl. 0)');
 assert.equal(tr.at(-1).L,b);assert.equal(tr.at(-1).R,b);                // alcanza el target exacto
});
test('Simetría de signo: traza(−a→−b) == −traza(a→b)',()=>{
 for(const [a,b] of [[0,50],[50,0],[50,-50]]){
  const p=wheelTrace([a,a],[b,b],80),m=wheelTrace([-a,-a],[-b,-b],80);
  p.forEach((s,i)=>{assert.ok(Math.abs(s.L+m[i].L)<EPS&&Math.abs(s.R+m[i].R)<EPS);});
 }
});
test('Ruedas independientes: (50,0)→(0,50) aplica la misma rampa a cada rueda',()=>{
 const tr=wheelTrace([50,0],[0,50],40);
 for(let i=1;i<tr.length;i++){assert.ok(Math.abs(tr[i].L-Math.max(0,50-i*STEP))<EPS);assert.ok(Math.abs(tr[i].R-Math.min(50,i*STEP))<EPS);}
});
test('Frenado y aceleración tardan lo mismo (V→0 == 0→V) para V=15,25,35,50',()=>{
 for(const V of [15,25,35,50]){
  const up=wheelTrace([0,0],[V,V],60).findIndex(s=>s.L===V),dn=wheelTrace([V,V],[0,0],60).findIndex(s=>s.L===0);
  assert.ok(up>1&&up===dn,`V=${V}: subida ${up} ticks vs bajada ${dn}`);
 }
});

// ── Constantes mecánicas congeladas (este bloque NO toca geometría) ──
test('Constantes sin cambios: max=23, base=12, bodyRadius=8.3, front=6, spread=2.8, rampa 240',()=>{
 const sim=fs.readFileSync(path.join(root,'simulator.js'),'utf8'),cal=fs.readFileSync(path.join(root,'calibration.js'),'utf8'),sp=fs.readFileSync(path.join(root,'strike-physics.js'),'utf8');
 assert.ok(sim.includes('const max=23, vL=wheel.left/100*max,vR=wheel.right/100*max,base=12;'));
 assert.ok(sim.includes('const approach=(value,target)=>value+clamp(target-value,-240*dt,240*dt);'),'approach simétrico, sin rama target===0');
 assert.ok(!/target===0\?0/.test(sim));
 assert.ok(sp.includes('bodyRadius: 8.3,'));
 assert.ok(cal.includes('Object.freeze({front:6,spread:2.8})'));
 const h=load();assert.deepEqual(JSON.parse(JSON.stringify(h.js('LINE_SENSOR.geometry'))),{front:6,spread:2.8});
});

// ── Parada normal (detenerse) vs parada dura (estado terminal mode='idle') ──
// Invariante: cualquier update que deje mode==='idle' deja también wheel=[0,0]. detenerse() NO cambia mode: frena con rampa.
const HARD_STOP_OFF=[{file:'simulator.js',from:" if(mode==='idle'){wheel.left=wheel.right=0;}\n else{wheel.left=approach(wheel.left,R.L);wheel.right=approach(wheel.right,R.R);}",to:' {wheel.left=approach(wheel.left,R.L);wheel.right=approach(wheel.right,R.R);}'}];
function firstIdleUpdate(h,max=120*60){for(let i=0;i<max;i++){h.js('update(1/120)');if(h.js('mode')==='idle')return {i,wheel:[h.js('wheel.left'),h.js('wheel.right')],L:h.js('R.L'),R:h.js('R.R')};}return null;}
const finProg=h=>{h.js("changeTrack('s01')");h.program('void setup(){inicializarMovimiento();avanzar(100);pausa(300);finPrograma();} void loop(){}');};
const demo=h=>{h.js("changeTrack('s01')");h.el('demo').events.click();};
test('finPrograma() es parada dura: el update que pasa a idle deja wheel=[0,0]',()=>{
 const h=load();finProg(h);const r=firstIdleUpdate(h);
 assert.ok(r&&r.wheel[0]===0&&r.wheel[1]===0,JSON.stringify(r));
});
test('Demo (obstáculo de la demo): el update que pasa a idle deja wheel=[0,0]',()=>{
 const h=load();demo(h);const r=firstIdleUpdate(h);
 assert.ok(r&&r.wheel[0]===0&&r.wheel[1]===0,JSON.stringify(r));
});
test('Control negativo: sin la parada dura explícita, esos updates terminan en idle con ruedas ≠ 0',()=>{
 const h=load({patches:HARD_STOP_OFF});finProg(h);const r=firstIdleUpdate(h);
 assert.ok(r&&(r.wheel[0]!==0||r.wheel[1]!==0),'se esperaba residuo: '+JSON.stringify(r));
});
test('detenerse() NO es parada dura: mode sigue en code y la rueda baja por la rampa',()=>{
 const h=load();h.js("changeTrack('s01')");h.program('void setup(){inicializarMovimiento();avanzar(100);pausa(300);detenerse();pausa(2000);} void loop(){}');
 let prev=0,saw=false;
 for(let i=0;i<120;i++){h.js('update(1/120)');const w=h.js('wheel.left');
  if(h.js('R.L')===0&&prev>STEP){assert.equal(h.js('mode'),'code');assert.ok(w>0&&prev-w<=STEP+EPS);saw=true;break;}prev=w;}
 assert.ok(saw);
});

// ── Regresión: UN sensor central + bang-bang en oval ──
test('Bang-bang de un sensor: V cambia materialmente la respuesta (V=15,25,35,50, umbral 500, 20 s)',()=>{
 const r={};for(const V of [15,25,35,50])r[V]=runBangBang({V,thr:500,pol:'A',x:84.7,seconds:20});
 for(const V of [15,25,35,50]){
  assert.ok(r[V].meanSpeed>1,`V=${V}: v̄=${r[V].meanSpeed} cm/s (el defecto era ≈0.31 independiente de V)`);
  assert.ok(r[V].transitions>=20,`V=${V}: pocas transiciones blanco/negro (${r[V].transitions})`);
  assert.ok(r[V].maxDistFromLine<4,`V=${V}: se aleja del borde (${r[V].maxDistFromLine} cm)`);
  assert.equal(r[V].mode,'code');
 }
 assert.ok(r[50].distanceCm>2*r[15].distanceCm,'V=50 debe avanzar >2× que V=15');
 assert.ok(r[50].progressDeg>2*r[15].progressDeg,'progreso angular: V=50 >2× V=15');
 assert.ok(r[15].distanceCm<r[25].distanceCm&&r[25].distanceCm<r[35].distanceCm&&r[35].distanceCm<r[50].distanceCm,'monótono en V');
});
test('Bang-bang de un sensor: polaridad B también sigue el borde y depende de V',()=>{
 const a=runBangBang({V:15,thr:500,pol:'B',x:84.7,seconds:20}),b=runBangBang({V:50,thr:500,pol:'B',x:84.7,seconds:20});
 for(const r of [a,b]){assert.ok(r.transitions>=20&&r.maxDistFromLine<4&&r.meanSpeed>1);}
 assert.ok(b.distanceCm>2*a.distanceCm);
});

console.log(`\n${n} comprobaciones MOTOR-DYNAMICS-1 superadas.`);
