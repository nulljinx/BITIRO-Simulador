/* SIM-3D-INTEGRATION-2 · Mundo headless para ejecutar el renderer REAL (renderer3d.js sin modificar) con un canvas grabador.
   Sin navegador: solo sirve para capturas SVG y para un A/B de CPU del dibujo. NO sustituye la validación en Chrome. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {load,root}=require('../sim1/harness.cjs');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

/* Contexto 2D grabador. mode 'count' solo cuenta; mode 'svg' acumula los elementos dibujados. */
function recorder(width,height,mode){
 const out=[];let path_=[],fillStyle='#000',strokeStyle='#000',alpha=1,lineWidth=1,font='',align='left',fills=0;
 const col=v=>typeof v==='string'?v:(v&&v.stops&&v.stops[0])||'#888';
 const pathD=()=>path_.join(' ');
 const api={
  beginPath(){path_=[];},closePath(){path_.push('Z');},moveTo(x,y){if(mode==='svg')path_.push(`M${x.toFixed(2)} ${y.toFixed(2)}`);},lineTo(x,y){if(mode==='svg')path_.push(`L${x.toFixed(2)} ${y.toFixed(2)}`);},
  arc(x,y,r){if(mode==='svg')path_.push(`M${(x+r).toFixed(2)} ${y.toFixed(2)}A${r} ${r} 0 1 0 ${(x-r).toFixed(2)} ${y.toFixed(2)}A${r} ${r} 0 1 0 ${(x+r).toFixed(2)} ${y.toFixed(2)}Z`);},
  ellipse(x,y,rx,ry){if(mode==='svg')path_.push(`M${(x+rx).toFixed(2)} ${y.toFixed(2)}A${rx} ${ry} 0 1 0 ${(x-rx).toFixed(2)} ${y.toFixed(2)}A${rx} ${ry} 0 1 0 ${(x+rx).toFixed(2)} ${y.toFixed(2)}Z`);},
  fill(){fills++;if(mode==='svg'&&path_.length)out.push(`<path d="${pathD()}" fill="${col(fillStyle)}" fill-opacity="${alpha}" stroke="none"/>`);},
  stroke(){if(mode==='svg'&&path_.length)out.push(`<path d="${pathD()}" fill="none" stroke="${col(strokeStyle)}" stroke-width="${lineWidth}" stroke-opacity="${alpha}"/>`);},
  fillRect(x,y,w,h){fills++;if(mode==='svg')out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${col(fillStyle)}" fill-opacity="${alpha}"/>`);},
  strokeRect(){},clearRect(){},save(){},restore(){},translate(){},rotate(){},scale(){},setTransform(){},clip(){},rect(){},setLineDash(){},
  fillText(t,x,y){if(mode==='svg')out.push(`<text x="${x}" y="${y}" fill="${col(fillStyle)}" font-family="system-ui,sans-serif" font-size="11" text-anchor="${align==='center'?'middle':'start'}">${String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`);},
  __out:()=>out,strokeText(){},measureText:t=>({width:String(t).length*6}),
  createLinearGradient:()=>({stops:[],addColorStop(o,c){this.stops.push(c);}}),createRadialGradient:()=>({stops:[],addColorStop(o,c){this.stops.push(c);}}),
 };
 return new Proxy(api,{
  get:(t,k)=>k in t?t[k]:k==='fillStyle'?fillStyle:k==='strokeStyle'?strokeStyle:k==='globalAlpha'?alpha:k==='lineWidth'?lineWidth:k==='font'?font:k==='textAlign'?align:()=>{},
  set:(t,k,v)=>{if(k==='fillStyle')fillStyle=v;else if(k==='strokeStyle')strokeStyle=v;else if(k==='globalAlpha')alpha=v;else if(k==='lineWidth')lineWidth=v;else if(k==='font')font=v;else if(k==='textAlign')align=v;return true;},
  });
}

function world(query='',mode='count',size=[1366,768]){
 const h=load();
 const rec=recorder(size[0],size[1],mode);
 h.el('scene').getContext=()=>rec;h.el('scene').getBoundingClientRect=()=>({width:size[0],height:size[1]});
 h.el('scene').width=size[0];h.el('scene').height=size[1];
 h.ctx.location={search:query};h.ctx.WeakMap=WeakMap;
 vm.runInContext(read('renderer3d.js')+';window.renderScene3D=renderScene3D;',h.ctx,{filename:'renderer3d.js'});
 if(query.includes('robot=iroh')){
  vm.runInContext(read('assets/iroh/iroh-render-v1.js'),h.ctx,{filename:'iroh-render-v1.js'});
  vm.runInContext(read('iroh-visual.js'),h.ctx,{filename:'iroh-visual.js'});
 }
 h.js("changeTrack('s01')");
 return {...h,rec,svgBody:()=>rec.__out()};
}
module.exports={world,root};
