/* SIM-3D-INTEGRATION-2 · Capturas SVG headless (legacy vs ?robot=iroh) generadas con el renderer real y sin navegador.
   Superponen los puntos FUNCIONALES (R, ruedas ±5,0, placa −2,3, sensores 8,0/±1,9, cara del sonar 4,0) para ver el acuerdo visual↔física.
     node tests/perf/iroh-render-svg.cjs     → tests/perf/results/iroh-3d/*.svg  (carpeta ignorada por git) */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {world,root}=require('./iroh-world.cjs');
const OUT=path.join(root,'tests/perf/results/iroh-3d');fs.mkdirSync(OUT,{recursive:true});
const W=1366,H=768;
const views=[['perspective','perspective'],['top','top'],['follow','follow'],['robot','robot']];
let n=0;
for(const q of ['','?robot=iroh']){
 const model=q?'iroh':'legacy';
 for(const [name,v] of views){
  const w=world(q,'svg',[W,H]);
  w.js(`cameraUI('${v}')`);w.js('paused=true;');w.js('render()');
  const body=w.svgBody().join('\n');
  // marcadores funcionales (solo anotación del SVG; leen la geometría, no la modifican)
  const pts=w.js(`(()=>{const cv=document.getElementById('scene'),r={x:R.x,y:R.y},M=IROH_MECHANICS,P=(f,s)=>{const g=M.worldPoint(R,f,s),p=BITIRO_SCENE_VIEW.projectGround(cv,sceneTrack,camera,r,g.x,g.y,0);return p?[p.x,p.y]:null};
   return {R:P(0,0),wheelL:P(0,-5),wheelR:P(0,5),plate:P(-2.3,0),sensorC:P(LINE_SENSOR.geometry.front,0),sensorL:P(LINE_SENSOR.geometry.front,-LINE_SENSOR.geometry.spread),sensorR:P(LINE_SENSOR.geometry.front,LINE_SENSOR.geometry.spread),sonar:P(4,0)}})()`);
  const colors={R:'#ff2d55',wheelL:'#00c2ff',wheelR:'#00c2ff',plate:'#ffd400',sensorC:'#00e676',sensorL:'#00e676',sensorR:'#00e676',sonar:'#d500f9'};
  const marks=Object.entries(pts).filter(([,p])=>p).map(([k,p])=>`<g><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="none" stroke="${colors[k]}" stroke-width="1.6"/><text x="${(p[0]+6).toFixed(1)}" y="${(p[1]-5).toFixed(1)}" font-size="10" font-family="monospace" fill="${colors[k]}" stroke="#000" stroke-width=".3">${k}</text></g>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#cfd8dc"/>${body}<g>${marks}</g><text x="12" y="20" font-size="13" font-family="monospace" fill="#102027">${model} · ${name} · puntos funcionales: R(rojo) ruedas±5,0(cian) placa−2,3(amarillo) sensores 8,0/±1,9(verde) sonar+4,0(violeta)</text></svg>`;
  fs.writeFileSync(path.join(OUT,`${model}_${name}_${W}x${H}.svg`),svg);n++;
  console.log(model.padEnd(7),name.padEnd(12),'elementos',w.svgBody().length,'caras robot',w.js('BITIRO_RENDER_STATS.robotFaces'));
 }
}
console.log(n+' SVG en '+path.relative(root,OUT));
