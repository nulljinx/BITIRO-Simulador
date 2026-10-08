/* SIM-3D-INTEGRATION-2 · A/B de CPU del dibujo (legacy vs ?robot=iroh) SIN navegador: tiempo de render() con un canvas que solo cuenta.
   Mide construcción + proyección + ordenado de caras (lo que cambia entre modelos); NO mide rasterizado ni compositing de Chrome.
   Por eso NO sustituye a tests/perf/iroh-ab.mjs (pendiente de navegador local).
     node tests/perf/iroh-ab-node.cjs [--frames 1500] [--reps 5]     → tests/perf/results/iroh-ab-node.json */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {world,root}=require('./iroh-world.cjs');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:Number(process.argv[i+1]);};
const FRAMES=arg('frames',1500),REPS=arg('reps',5),WARM=200;
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(q*(s.length-1)))];};
function bench(q,view){
 const w=world(q,'count');w.js(`cameraUI('${view}')`);w.js('paused=true;');
 for(let i=0;i<WARM;i++)w.js('render()');
 const t=[];
 for(let i=0;i<FRAMES;i++){const a=process.hrtime.bigint();w.js('render()');t.push(Number(process.hrtime.bigint()-a)/1e6);}
 return {mean:t.reduce((s,x)=>s+x,0)/t.length,p50:pct(t,.5),p95:pct(t,.95),p99:pct(t,.99),faces:w.js('BITIRO_RENDER_STATS.robotFaces')};
}
const rows=[];
for(const view of ['perspective','top','robot'])for(let rep=0;rep<REPS;rep++)for(const q of (rep%2?['?robot=iroh','']:['','?robot=iroh'])){
 const r=bench(q,view);rows.push({view,model:q?'iroh':'legacy',rep:rep+1,...r});
}
const sum=[];
for(const view of ['perspective','top','robot']){
 const m=model=>{const r=rows.filter(x=>x.view===view&&x.model===model);const med=k=>pct(r.map(x=>x[k]),.5);return {mean:med('mean'),p50:med('p50'),p95:med('p95'),p99:med('p99'),faces:r[0].faces};};
 const L=m('legacy'),I=m('iroh');
 sum.push({view,legacy:L,iroh:I,deltaMeanPct:100*(I.mean/L.mean-1),deltaP95Pct:100*(I.p95/L.p95-1)});
 console.log(view.padEnd(12),'legacy mean '+L.mean.toFixed(3)+' ms p95 '+L.p95.toFixed(3)+' faces '+L.faces,'| iroh mean '+I.mean.toFixed(3)+' ms p95 '+I.p95.toFixed(3)+' faces '+I.faces,'| Δmean '+(100*(I.mean/L.mean-1)).toFixed(1)+'% Δp95 '+(100*(I.p95/L.p95-1)).toFixed(1)+'%');
}
fs.mkdirSync(path.join(root,'tests/perf/results'),{recursive:true});
fs.writeFileSync(path.join(root,'tests/perf/results/iroh-ab-node.json'),JSON.stringify({node:process.version,frames:FRAMES,reps:REPS,note:'CPU de dibujo en Node con canvas contador; no incluye rasterizado de Chrome',summary:sum,rows},null,1));
