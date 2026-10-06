/* SIM-1 · Arnés headless independiente de smoke.cjs/regression.cjs.
   Carga los scripts del producto SIN modificarlos en disco. Los controles
   negativos aplican `patches` solo en memoria (cadena exacta → cadena nueva). */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const FILES=['tracks.js','extra-tracks.js','calibration.js','iroh-runtime.js','strike-physics.js','scenario-props.js','simulator.js'];
const FIXED_DT=1/120;

function load({patches=[],storage={},blocked=false}={}){
 const saved=new Map(Object.entries(storage)),nodes=new Map();
 const behavior={blocked:!!blocked};
 function el(id){
  if(!nodes.has(id))nodes.set(id,{
   id,value:id==='quality'?'standard':'',textContent:'',innerHTML:'',style:{},dataset:{},hidden:false,
   disabled:false,classList:{toggle(){},add(){},remove(){}},attrs:{},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return k in this.attrs?this.attrs[k]:null;},
   events:{},addEventListener(type,fn){this.events[type]=fn;},querySelector(){return el(id+'.sub')},focus(){},
   showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},
   getBoundingClientRect(){return {width:700,height:480}},scrollIntoView(){},requestFullscreen(){}
  });
  return nodes.get(id);
 }
 const document={addEventListener(){},getElementById:el,querySelectorAll(q){return q==='.cam'?['perspective','top','follow','robot'].map(v=>({...el('cam_'+v),dataset:{view:v}})):[];}};
 const localStorage={
  getItem:k=>{if(behavior.blocked)throw Error('bloqueado');return saved.has(k)?saved.get(k):null;},
  setItem:(k,v)=>{if(behavior.blocked)throw Error('bloqueado');saved.set(k,String(v));},
  removeItem:k=>{if(behavior.blocked)throw Error('bloqueado');saved.delete(k);}
 };
 // `clamp` global: simulator.js lo usa sin definirlo (lo aporta el entorno del navegador/pruebas v4).
 const ctx={document,window:null,console,performance:{now:()=>0},Math,Number,Date,localStorage,
  devicePixelRatio:1,clamp:(n,a,b)=>Math.max(a,Math.min(n,b)),requestAnimationFrame(){},renderScene3D(){}};
 ctx.window=ctx;vm.createContext(ctx);
 const pending=patches.map(p=>({...p,hit:0}));
 for(const file of FILES){
  let src=fs.readFileSync(path.join(root,file),'utf8');
  for(const p of pending)if(p.file===file){
   const count=src.split(p.from).length-1;
   if(count!==1)throw new Error(`Parche ${file}: «${p.from}» aparece ${count} veces (se esperaba 1)`);
   src=src.replace(p.from,()=>p.to);p.hit++;
  }
  vm.runInContext(src,ctx,{filename:file});
 }
 for(const p of pending)if(!p.hit)throw new Error('Parche sin aplicar: '+p.file);
 const js=s=>vm.runInContext(s,ctx);
 const program=code=>{el('src').value=code;js('start()');};
 const tick=n=>{for(let i=0;i<n;i++)js('update(1/120)');};
 return {ctx,js,el,saved,behavior,program,tick,FIXED_DT};
}
module.exports={load,root,FIXED_DT};
