/* node tests/track-digitize.cjs — TRACK-DIGITIZE-1: geometría reconstruida de los plotters oficiales (S01–S06, S08).
   Valida tests/track-reference/{official,sim-candidate}/*.json frente a mediciones congeladas del PDF y a las reglas del sensor del
   simulador (cápsula: distancia − w/2; blanco ≥ 1.05 cm). NO toca tracks.js/extra-tracks.js: es una comprobación de la propuesta.
   Si hay Python+PyMuPDF y los PDF de referencia, además regenera la extracción y exige que coincida con lo versionado. */
'use strict';
const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const cp=require('child_process');const os=require('os');
const DIR=path.join(__dirname,'track-reference');
const ids=['s01','s02','s03','s04','s05','s06','s08'];
const off=Object.fromEntries(ids.map(i=>[i,JSON.parse(fs.readFileSync(`${DIR}/official/${i}.json`,'utf8'))]));
const sim=Object.fromEntries(ids.map(i=>[i,JSON.parse(fs.readFileSync(`${DIR}/sim-candidate/${i}.json`,'utf8'))]));
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const near=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: ${a} ≠ ${b} (±${tol})`);

/* sensor idéntico al de simulator.js: cápsula + mezcla lineal */
function dist(t,x,y){let best=1e9;for(const p of t.paths){const q=p.p;for(let i=1;i<q.length;i++){const a=q[i-1],b=q[i],vx=b[0]-a[0],vy=b[1]-a[1],den=vx*vx+vy*vy,u=den?Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/den)):0;best=Math.min(best,Math.hypot(x-(a[0]+u*vx),y-(a[1]+u*vy))-p.w/2);}}return best;}
const blend=d=>Math.max(0,Math.min(1,(1.05-d)/1.7));
const black=(t,x,y)=>blend(dist(t,x,y))>0.5, white=(t,x,y)=>blend(dist(t,x,y))===0;
const extent=t=>{const xs=t.paths.flatMap(p=>p.p.map(q=>q[0])),ys=t.paths.flatMap(p=>p.p.map(q=>q[1]));return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];};
const rect=z=>[z.x,z.y,z.x+z.width,z.y+z.height];

test('Dimensiones físicas NOMINALES y escala por página (no global): S01–S04 en PDF de 80 cm, S05/S06/S08 en 100 cm',()=>{
 const nominal={s01:[100,140],s02:[100,200],s03:[100,180],s04:[100,200],s05:[100,200],s06:[100,200],s08:[100,200]};
 const pdfCm={s01:[80,112],s02:[80,160],s03:[80,144],s04:[80,160],s05:[100,200],s06:[100,200],s08:[100,200]};
 for(const id of ids){const o=off[id];assert.deepEqual([o.physicalWidthCm,o.physicalHeightCm],nominal[id],id);assert.deepEqual([sim[id].w,sim[id].h],nominal[id]);
  const [sx,sy]=o.scaleCmPerPt;near(sx*o.pagePt[0],nominal[id][0],0.01,id+' ancho');near(sy*o.pagePt[1],nominal[id][1],0.01,id+' alto');near(sx/sy,1,1e-4,id+' escala isótropa');
  near(o.pagePt[0]/72*2.54,pdfCm[id][0],0.05,id+' ancho del PDF en cm');near(o.pagePt[1]/72*2.54,pdfCm[id][1],0.05,id+' alto del PDF en cm');}
 near(off.s01.scaleCmPerPt[0]/off.s05.scaleCmPerPt[0],1.25,1e-4,'S01 se amplía ×1.25 respecto a S05');
});
test('Convención única (x=0 izquierda, y=0 arriba) y nada recentrado: todo cae dentro de la hoja; S08 NO está centrado en x=50',()=>{
 for(const id of ids){const [x0,y0,x1,y1]=extent(sim[id]);assert.ok(x0>0&&y0>0&&x1<sim[id].w&&y1<sim[id].h,id);}
 const main=sim.s08.paths.filter(p=>Math.abs(p.p[0][0]-p.p[1][0])<0.05&&p.p[0][0]>30&&p.p[0][0]<45&&Math.abs(p.p[1][1]-p.p[0][1])>20&&Math.min(p.p[0][1],p.p[1][1])>60);
 assert.equal(main.length,3,'tres tramos de la vertical principal');for(const p of main)near(p.p[0][0],37.85,0.02,'x de la vertical principal');
});
test('Extremos de los paths (centerline) y cajas envolventes frente al PDF',()=>{
 const exp={s01:[12.3,38.77,87.71,123.63],s02:[14.49,29.93,85.5,160.17],s03:[19.0,11.36,81.0,163.34],s04:[32.49,27.92,69.79,165.1],s05:[14.49,21.66,85.5,170.81],s06:[23.55,32.34,76.26,161.34],s08:[6.63,26.88,93.5,161.69]};
 for(const id of ids){const e=extent(sim[id]);e.forEach((v,k)=>near(v,exp[id][k],0.06,`${id} bbox[${k}]`));}
 // anchos de línea del PDF (cm)
 const w={s01:[2.6],s02:[2.6],s03:[2.6],s04:[1.5,2.5,2.6],s05:[2.44,2.52,2.57,2.58,2.6,2.62],s06:[2.0],s08:[2.6]};
 for(const id of ids){const got=[...new Set(off[id].paths.map(p=>+p.widthCm.toFixed(2)))].sort((a,b)=>a-b);assert.equal(got.length,w[id].length,id);got.forEach((v,k)=>near(v,w[id][k],0.02,id+' ancho'));}
});
test('Cantidad de segmentos independientes (paths) por pista',()=>{
 const n={s01:6,s02:7,s03:1,s04:6,s05:11,s06:1,s08:14};for(const id of ids)assert.equal(sim[id].paths.length,n[id],id);
 assert.equal(off.s01.microStrokesIgnored,4,'S01: 4 micro-trazos de 0.15 cm del empalme se descartan (están dentro del negro)');
});
test('Zonas: posiciones y tamaños (cm) del PDF',()=>{
 const exp={s01:[[11.0,18.77,20,20],[69.0,18.77,20,20]],
  s02:[[13.2,19.93,10,10],[45.0,19.93,10,10],[76.8,19.93,10,10],[40.0,160.17,20,20]],
  s03:[],s04:[[39.78,8.12,20.25,19.79],[40.0,166.4,20,20]],
  s05:[[13.19,12.17,10,10],[45.0,12.17,10,10],[76.8,12.17,10,10],[41.57,172.08,16,16]],
  s06:[[38.77,12.34,20,20],[39.0,162.34,20,20]],
  s08:[[8.44,16.88,10,10],[32.85,16.88,10,10],[57.27,16.88,10,10],[81.69,16.88,10,10],[27.81,161.69,20,20]]};
 for(const id of ids){const zs=[...sim[id].zones,...sim[id].markers].map(z=>[z.x,z.y,z.width,z.height]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const ex=[...exp[id]].sort((a,b)=>a[1]-b[1]||a[0]-b[0]);assert.equal(zs.length,ex.length,id+' nº de zonas');zs.forEach((z,i)=>z.forEach((v,k)=>near(v,ex[i][k],0.06,`${id} zona ${i}[${k}]`)));}
});
test('Gaps REALES: S04=2 (17.05 y 10.0 cm), S05=1 (10.0), S08=2 (10.0 y 10.0); S01/S02/S03/S06 sin gaps; el gap es ausencia de path, no una línea tapada',()=>{
 const gapsOf=(t,x,y0,y1)=>{const out=[];let start=null;for(let y=y0;y<=y1+1e-9;y+=0.05){const wh=dist(t,x,y)>0.001;if(wh&&start===null)start=y;if(!wh&&start!==null){out.push([start,y]);start=null;}}if(start!==null)out.push([start,y1]);return out.filter(g=>g[1]-g[0]>1);};
 const sig=(g)=>g.map(([a,b])=>[+a.toFixed(1),+b.toFixed(1)]);
 // recorridos verticales por el eje de cada línea entre la zona de partida y el final
 const s04=gapsOf(sim.s04,50,101,160),s05=gapsOf(sim.s05,49.57,131,170),s08=gapsOf(sim.s08,37.85,66,160);
 assert.equal(s04.length,2);near(s04[0][0],101.53,0.3,'S04 gap1 inicio (borde inferior de la barra)');
 const len=g=>g[1]-g[0];near(len(s04[0]),17.05,0.3,'S04 gap grande (visible entre barras)');near(len(s04[1]),10.0,0.3,'S04 gap pequeño');
 assert.equal(s05.length,1);near(len(s05[0]),10.0,0.3,'S05 gap');near((s05[0][0]+s05[0][1])/2,147.35,0.3,'S05 centro del gap');
 assert.equal(s08.length,2);near(len(s08[0]),10.0,0.3,'S08 gap 1');near(len(s08[1]),10.0,0.3,'S08 gap 2');near((s08[0][0]+s08[0][1])/2,95.23,0.3,'S08 gap 1 centro');near((s08[1][0]+s08[1][1])/2,129.59,0.3,'S08 gap 2 centro');
 assert.deepEqual([off.s04.gaps.length,off.s05.gaps.length,off.s08.gaps.length,off.s01.gaps.length,off.s02.gaps.length,off.s03.gaps.length,off.s06.gaps.length],[2,1,2,0,0,0,0]);
 // Los gaps son paths separados: la vertical principal de S08 está en 3 tramos y la de S04 en 2 (no hay un solo path que la cruce)
 const crossing=(t,x,ya,yb)=>t.paths.filter(p=>p.p.some((q,i)=>i&&((p.p[i-1][1]-ya)*(q[1]-ya)<0||(p.p[i-1][1]-yb)*(q[1]-yb)<0)&&Math.abs(q[0]-x)<1));
 assert.equal(crossing(sim.s08,37.85,95.23,95.23).length,0);assert.equal(crossing(sim.s08,37.85,129.59,129.59).length,0);assert.equal(crossing(sim.s05,49.57,147.35,147.35).length,0);
 assert.equal(crossing(sim.s04,50,141.6,141.6).length,0);assert.equal(crossing(sim.s04,50,110,110).length,0);
});
test('Sensores: BLANCO en el centro de cada gap (los tres sensores, separación 2.8 cm) y NEGRO sobre las líneas',()=>{
 const spots={s04:[[50,110],[50,141.6]],s05:[[49.57,147.35]],s08:[[37.85,95.23],[37.85,129.59]]};
 for(const [id,pts] of Object.entries(spots))for(const [x,y] of pts)for(const dx of [-2.8,0,2.8])assert.ok(white(sim[id],x+dx,y),`${id} (${x+dx},${y}) debe leer blanco`);
 for(const id of ids)for(const p of sim[id].paths){const q=p.p,m=q[Math.floor(q.length/2)];assert.ok(black(sim[id],m[0],m[1]),`${id} ${p.id} centro negro`);}
 // y los extremos de los tramos tocan el borde del gap (cápsula recortada): justo fuera del gap vuelve a ser negro
 assert.ok(black(sim.s08,37.85,89.5)&&black(sim.s08,37.85,100.9)&&black(sim.s05,49.57,141.8)&&black(sim.s05,49.57,152.9));
});
test('S03: circuito cerrado continuo, de doble lóbulo («8») SIN intersección',()=>{
 const t=sim.s03,p=t.paths[0].p;assert.equal(t.paths.length,1);near(Math.hypot(p[0][0]-p[p.length-1][0],p[0][1]-p[p.length-1][1]),0,0.05,'cierre');
 // sin autointersección (segmentos no adyacentes)
 const cross=(a,b,c,d)=>{const o=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;};
 let n=0;for(let i=1;i<p.length;i++)for(let j=i+2;j<p.length;j++){if(i===1&&j===p.length-1)continue;if(cross(p[i-1],p[i],p[j-1],p[j]))n++;}assert.equal(n,0,'cruces');
 // doble lóbulo: cintura estrecha (x entre 33.83 y 66.17 en y=87.4) y lóbulos anchos arriba y abajo
 const widthAt=y=>{const xs=[];for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];if((a[1]-y)*(b[1]-y)<0)xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));}return xs.length?Math.max(...xs)-Math.min(...xs):0;};
 assert.equal([30,87.4,140].map(widthAt).length,3);near(widthAt(87.4),32.34,0.3,'cintura');assert.ok(widthAt(35)>55&&widthAt(140)>55,'lóbulos');assert.ok(widthAt(87.4)<widthAt(35)*0.65);
 // cada lóbulo es convexo-ish y la separación de la cintura (≈29.7 cm libres) permite el robot (ancho 18.2) entre ambos lados
 assert.ok(widthAt(87.4)-2.6>20);
 assert.equal(sim.s03.zones.length+sim.s03.markers.length,0,'el PDF no marca zonas en S03');
});
test('S08: bases 1→4 de izquierda a derecha, 4 postes, 2 horizontales, 2 gaps, vertical principal bajo la base 2',()=>{
 const g=sim.s08.zones.filter(z=>z.kind==='finish-green');assert.deepEqual(g.map(z=>z.label),['Base 1','Base 2','Base 3','Base 4']);assert.ok(g.every((z,i)=>i===0||z.x>g[i-1].x));
 const cx=g.map(z=>z.x+z.width/2);[13.44,37.85,62.27,86.69].forEach((v,i)=>near(cx[i],v,0.05,'centro base '+(i+1)));
 const vert=sim.s08.paths.filter(p=>Math.abs(p.p[0][0]-p.p[1][0])<0.1&&Math.abs(p.p[1][1]-p.p[0][1])>30&&p.p[0][1]<30);assert.equal(vert.length,4,'4 postes verticales');
 vert.forEach((p,i)=>near(p.p[0][0],[13.44,37.85,62.27,86.69][i],0.05,'poste '+(i+1)));vert.forEach(p=>{const yEnd=Math.max(p.p[0][1],p.p[1][1]);near(yEnd+(Math.abs(p.p[0][0]-37.85)<0.1?0:p.w/2),65.45,0.2,'extremo inferior de poste (punta de la cápsula en el borde del PDF)');});
 const hor=sim.s08.paths.filter(p=>Math.abs(p.p[1][1]-p.p[0][1])<0.05&&Math.abs(p.p[1][0]-p.p[0][0])>80);assert.equal(hor.length,2);near(hor[0].p[0][1],44.57,0.05,'horizontal 1');near(hor[1].p[0][1],59.10,0.05,'horizontal 2');
 assert.equal(off.s08.gaps.length,2);assert.equal(off.s08.boxSlots.length,4,'4 recuadros de 8×8 cm junto a los gaps (posiciones posibles de cajas)');off.s08.boxSlots.forEach(s=>{near(s.width,8,0.02,'recuadro');near(s.height,8,0.02,'recuadro');});
 const red=sim.s08.markers[0];near(red.x+red.width/2,37.85,0.05,'zona roja bajo la columna 2');
});
test('S01: Y con dos zonas rojas superiores y T inferior; S02: tres bases con arco, ramal central y sinuoso; S04: zona verde superior y stem inferior; S05/S06 según PDF',()=>{
 const s01=sim.s01;assert.equal(s01.zones.length,2);assert.ok(s01.zones[0].x<50&&s01.zones[1].x>50);const T=s01.paths.find(p=>p.p.length===2&&Math.abs(p.p[0][1]-123.63)<0.05&&p.p[0][0]<45);near(T.p[0][0],39.996,0.05,'T inf izq');near(T.p[1][0],60.004,0.05,'T inf der');
 assert.ok(s01.paths.some(p=>Math.abs(p.p[0][0]-50)<0.05&&Math.abs(p.p[p.p.length-1][1]-74.72)<0.05),'tronco vertical hasta la bifurcación y=74.72');
 const s02=sim.s02;assert.equal(s02.zones.length,3);assert.equal(s02.markers.length,1);assert.ok(s02.paths.some(p=>p.p.length>40&&Math.abs(p.p[0][0]-81.76)<0.05),'arco superior');assert.ok(s02.paths.some(p=>p.p.length>40&&Math.abs(p.p[0][1]-160.17)<0.05),'sinuoso hacia la zona inferior');
 assert.ok(sim.s04.zones[0].y<10&&sim.s04.markers[0].y>160&&sim.s04.zones[0].kind==='finish-green');
 assert.equal(sim.s05.zones.length,3);assert.equal(sim.s05.markers.length,1);assert.equal(sim.s06.zones.length+sim.s06.markers.length,2);
 assert.equal(sim.s06.obstacles.length+sim.s01.obstacles.length+sim.s08.obstacles.length,0,'el plotter no contiene cajas: nada de obstáculos en la geometría (S06 sin caja)');
});
test('Start: sobre la línea (sensor central NEGRO, laterales dentro del ancho o cerca), fuera de gaps y cerca de la zona de salida prevista; heading hacia arriba (−π/2) salvo S03',()=>{
 const front=6,spread=2.8;
 for(const id of ['s01','s02','s04','s05','s06','s08']){const s=sim[id].start,t=sim[id];assert.ok(Math.abs(s.heading+Math.PI/2)<1e-9,id+' heading');
  const fx=s.x+front*Math.cos(s.heading),fy=s.y+front*Math.sin(s.heading);
  if(id==='s01'){assert.ok(!black(t,s.x,s.y),'S01: el robot parte DETRÁS de la T inferior (región de salida)');assert.ok(dist(t,fx,fy)<0.5,'S01: el sensor central queda en el borde de la T');}
  else assert.ok(black(t,fx,fy),id+': sensor central sobre la línea');
  const z=[...t.markers,...t.zones].find(z=>/start|salida/.test(z.kind+z.id));if(z){const [x0,y0,x1,y1]=rect(z);assert.ok(s.x>=x0-5&&s.x<=x1+5&&s.y<y0&&y0-s.y<12,`${id}: start ≈ ≤12 cm sobre el borde superior de la zona de salida`);}}
 const s3=sim.s03.start;assert.ok(dist(sim.s03,s3.x,s3.y)>5,'S03: el start del Lab queda FUERA de la línea (hallazgo; ver informe)');
});
test('Reproducibilidad: si hay PyMuPDF y los PDF, la extracción regenerada coincide con lo versionado',()=>{
 const REF=path.join(os.homedir(),'projects','BITIRO-plotters-reference');
 if(!fs.existsSync(REF)){console.log('   (omitido: no están los PDF de referencia)');return;}
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'td-'));const r=cp.spawnSync('python3',[path.join(DIR,'extract.py'),REF,tmp],{encoding:'utf8'});
 if(r.status!==0){console.log('   (omitido: python3/PyMuPDF no disponible)');return;}
 for(const id of ids){assert.deepEqual(JSON.parse(fs.readFileSync(`${tmp}/${id}.json`,'utf8')),off[id],id+' regenerado ≠ versionado');}
 fs.rmSync(tmp,{recursive:true,force:true});
});
test('IMPORTACIÓN: tracks.js/extra-tracks.js == candidatos (centerlines, zonas, gaps); sin obstáculos en la pista; S07 neutra; starts derivados válidos',()=>{
 const vm=require('vm'),ROOT=path.join(__dirname,'..');const ctx={window:{}};
 for(const f of ['tracks.js','extra-tracks.js'])vm.runInNewContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx);const T=JSON.parse(JSON.stringify(ctx.window.BITIRO_TRACKS)),PROPS=JSON.parse(JSON.stringify(ctx.window.BITIRO_SCENARIO_PROPS));
 for(const id of ids){assert.deepEqual(T[id].paths.map(p=>[p.w,p.p]),sim[id].paths.map(p=>[p.w,p.p]),id+' paths');assert.deepEqual(T[id].zones,sim[id].zones,id+' zonas');assert.deepEqual(T[id].markers,sim[id].markers,id+' markers');assert.deepEqual(T[id].obstacles,[],id+' sin obstáculos en la pista');}
 assert.equal(T.s08.boxSlots.length,4,'boxSlots S08 = metadata');assert.deepEqual(T.s08.obstacles,[]);
 assert.deepEqual(PROPS.s01.map(o=>[o.id,o.official]),[['practice-box',false]],'caja S01 = prop no oficial');assert.equal(PROPS.s06,undefined,'S06 sin caja');
 const s7=T.s07;assert.equal(s7.paths.length+s7.zones.length+s7.markers.length+s7.obstacles.length,0);assert.equal(s7.official,false);assert.match(s7.name,/sin pista propia/);
 for(const id of ['s03','s04','s05','s06','s08']){const t=T[id],s=t.start;assert.equal(t.startInfo.official,false,id);const fx=s.x+6*Math.cos(s.heading),fy=s.y+6*Math.sin(s.heading);assert.ok(black(t,fx,fy),id+' sensor central sobre la línea');
  assert.ok(dist(t,s.x,s.y)<0.5,id+' centro sobre la línea');for(const z of [...t.zones,...t.markers]){const xx=Math.max(z.x,Math.min(s.x,z.x+z.width)),yy=Math.max(z.y,Math.min(s.y,z.y+z.height));assert.ok(Math.hypot(s.x-xx,s.y-yy)>8.3,id+' cuerpo solapa '+z.id);}}
 assert.equal(T.s08.start.x,37.853);for(const id of ['s04','s05']){assert.ok(T[id].startInfo.bodyZoneClearanceCm>=0.5&&T[id].startInfo.displacementCm<3,id+' start corregido: clearance y desplazamiento mínimo');assert.ok(T[id].start.y<T[id].startInfo.previous.y,id);}assert.ok(Math.abs(T.s03.start.heading-Math.PI)<0.01);
});
console.log(`\n${checks} comprobaciones geométricas TRACK-DIGITIZE-1 superadas.`);
