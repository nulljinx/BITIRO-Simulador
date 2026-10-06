/* SIM-1 · Sonda de wheelbase del renderer. Solo lectura: instrumenta EN MEMORIA la función face()
   de renderer3d.js para obtener las coordenadas de mundo (cm) de las caras de las ruedas por el
   camino real del código, y las compara con la pose física. No modifica el producto. */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {root}=require('./harness.cjs');

function probe({x=50,y=70,th=0,camera={azimuth:.1,elevation:Math.PI/2-.02,distance:1.8,follow:false},trackId='s01'}={}){
 const faces=[],draws=[];
 const grad={addColorStop(){}};
 const c=new Proxy({},{get:(t,k)=>k==='createLinearGradient'?()=>grad:(k in t?t[k]:(...a)=>{if(k==='moveTo'||k==='lineTo')t.__pts.push(a);if(k==='beginPath')t.__pts=[];if(k==='fill'||k==='stroke')draws.push({fill:t.fillStyle,pts:t.__pts.slice()});}),set:(t,k,v)=>{t[k]=v;return true;}});
 c.__pts=[];
 const canvas={getContext:()=>c,getBoundingClientRect:()=>({width:700,height:480}),width:0,height:0};
 const ctx={window:null,console,Math,Number,devicePixelRatio:1,LINE_SENSOR:null,IROH_MECHANICS:null,WeakMap,Map,Array,Object,JSON};
 ctx.window=ctx;vm.createContext(ctx);
 for(const f of ['tracks.js','extra-tracks.js','calibration.js','strike-physics.js']){
  const src=fs.readFileSync(path.join(root,f),'utf8');
  vm.runInContext(f==='calibration.js'?src.replace("window.BITIRO_STORAGE","window.BITIRO_STORAGE"):src,Object.assign(ctx,{localStorage:{getItem:()=>null,setItem(){}}}),{filename:f});
 }
 const anchor='function face(list,pts,fill,layer=3,alpha=1,stroke=null){list.push(';
 let src=fs.readFileSync(path.join(root,'renderer3d.js'),'utf8');
 if(src.split(anchor).length!==2)throw new Error('ancla de face() no encontrada una vez');
 src=src.replace(anchor,()=>'function face(list,pts,fill,layer=3,alpha=1,stroke=null){window.__faces.push({pts:pts.map(p=>({x:p.x,y:p.y,z:p.z})),fill});list.push(');
 ctx.__faces=faces;
 vm.runInContext(src+';window.renderScene3D=renderScene3D;',ctx,{filename:'renderer3d.js'});
 const t=ctx.BITIRO_TRACKS[trackId];
 const scene={id:t.id,physicalWidthCm:t.w,physicalHeightCm:t.h,paths:t.paths.map(p=>({id:p.id,widthCm:p.w,points:p.p.map(([a,b])=>({x:a,y:b}))})),finishZones:t.zones,markers:t.markers,obstacles:t.obstacles,start:t.start};
 const heading=th-Math.PI/2; // misma conversión que simulator.js render(): heading = th − π/2
 faces.length=0;
 ctx.renderScene3D(canvas,scene,{x,y,heading,lineCenter:0,lineActive:[0,0,0],strikerAngle:0,trail:[]},[],camera);
 // Marco local del renderer (idéntico a local() en renderer3d.js): f2=[cos h, sin h], r2=[−sin h, cos h]
 const f2=[Math.cos(heading),Math.sin(heading)],r2=[-Math.sin(heading),Math.cos(heading)];
 const X0=x-scene.physicalWidthCm/2,Z0=y-scene.physicalHeightCm/2;
 const toLocal=p=>({f:(p.x-X0)*f2[0]+(p.z-Z0)*f2[1],r:(p.x-X0)*r2[0]+(p.z-Z0)*r2[1],h:p.y});
 // Caras de neumático: banda oscura alterna (#10171A, 4 vértices) y tapa exterior (#171D23, 16 vértices).
 const tire=faces.filter(f=>f.fill==='#10171A'&&f.pts.length===4);
 const caps=faces.filter(f=>f.fill==='#171D23'&&f.pts.length===16);
 const side={left:[],right:[]};
 const world={left:[],right:[]};
 for(const f of tire)for(const p of f.pts){const l=toLocal(p);side[l.r<0?'left':'right'].push(l);world[l.r<0?'left':'right'].push(p);}
 const meanXZ=a=>({x:a.reduce((s,p)=>s+p.x,0)/a.length+scene.physicalWidthCm/2,y:a.reduce((s,p)=>s+p.z,0)/a.length+scene.physicalHeightCm/2}); // de vuelta a coordenadas de pista (cm)
 const stat=a=>({innerAbsR:Math.min(...a.map(p=>Math.abs(p.r))),outerAbsR:Math.max(...a.map(p=>Math.abs(p.r))),fMin:Math.min(...a.map(p=>p.f)),fMax:Math.max(...a.map(p=>p.f)),hMin:Math.min(...a.map(p=>p.h)),hMax:Math.max(...a.map(p=>p.h))});
 const L=stat(side.left),Rr=stat(side.right);
 const centerAbs=s=>(s.innerAbsR+s.outerAbsR)/2;
 return {pose:{x,y,th},wheelTrackCoords:{left:meanXZ(world.left),right:meanXZ(world.right)},tireFaces:tire.length,caps:caps.length,left:L,right:Rr,
  wheelCenterAbsR:{left:centerAbs(L),right:centerAbs(Rr)},centerToCenterWorldCm:centerAbs(L)+centerAbs(Rr),
  wheelCenterF:{left:(L.fMin+L.fMax)/2,right:(Rr.fMin+Rr.fMax)/2},wheelRadius:(Rr.hMax-Rr.hMin)/2,tireWidth:Rr.outerAbsR-Rr.innerAbsR,
  trackCm:[scene.physicalWidthCm,scene.physicalHeightCm],
  draws,camera,scene,canvasPx:[700,480],
 };
}

/* Verificación independiente en píxeles (vista superior, th=0): la rejilla del suelo se dibuja cada 10 unidades de mundo;
   su paso en píxeles da px/cm en el suelo, y la separación de las dos tapas de rueda debe ser 20,4 unidades (±10,2). */
function pixelCrosscheck(){
 const cam={azimuth:Math.PI/2,elevation:Math.PI/2-.02,distance:2.3,follow:false};
 const r=probe({x:50,y:70,th:0,camera:cam});
 const cen=p=>({x:p.pts.reduce((s,q)=>s+q[0],0)/p.pts.length,y:p.pts.reduce((s,q)=>s+q[1],0)/p.pts.length});
 const area=p=>Math.abs(p.pts.reduce((s,q,i)=>{const n=p.pts[(i+1)%p.pts.length];return s+q[0]*n[1]-n[0]*q[1];},0))/2;
 const gap=a=>{const g=a.slice(1).map((v,i)=>v-a[i]).filter(v=>v>2).sort((p,q)=>p-q);return g[Math.floor(g.length/2)];};
 const grid=r.draws.filter(d=>d.fill==='#D8DCD8'&&d.pts.length>=4).map(cen);
 const uniq=k=>[...new Set(grid.map(g=>g[k].toFixed(1)))].map(Number).sort((a,b)=>a-b);
 const groundPxPerUnit=Math.max(gap(uniq('x')),gap(uniq('y')))/10;
 const caps=r.draws.filter(d=>d.pts.length===16).sort((a,b)=>area(b)-area(a)).slice(0,2).map(cen);
 const D=cam.distance*Math.max(...r.trackCm),h=4; // distancia de cámara en cm y altura del eje de rueda
 const px=Math.hypot(caps[0].x-caps[1].x,caps[0].y-caps[1].y);
 const capSeparationUnits=px/(groundPxPerUnit*D/(D-h));
 return {groundPxPerUnit,capGapPx:px,capSeparationUnits,wheelCenterSeparationUnits:capSeparationUnits-2.2};
}
module.exports={probe,pixelCrosscheck};
if(require.main===module){const r=probe({th:0.7});delete r.draws;delete r.scene;console.log(JSON.stringify(r,null,1));console.log(JSON.stringify(pixelCrosscheck()));}
