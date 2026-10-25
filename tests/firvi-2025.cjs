/* FIRVI-2025-A · Pista, sensores, gaps, obstáculos y aislamiento del escenario `firvi-2025` (Etapa A).
   node tests/firvi-2025.cjs
   No hay evaluador ni modo competencia en esta etapa: aquí se comprueba la GEOMETRÍA y la FÍSICA que luego observarán las Etapas B/C. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {load,root}=require('./sim1/harness.cjs');

let n=0;
const test=(name,fn)=>{fn();n++;console.log('OK · '+name);};
// Los valores del simulador vienen de otro contexto vm: se comparan por contenido (JSON), no por prototipo.
const same=(a,b,msg)=>assert.equal(JSON.stringify(a),JSON.stringify(b),msg);
const notSame=(a,b,msg)=>assert.notEqual(JSON.stringify(a),JSON.stringify(b),msg);
const near=(a,b,eps,msg)=>assert.ok(Math.abs(a-b)<=eps,`${msg||''} ${a} ≠ ${b} (±${eps})`);
const EXTRA=['line-geometry.js','firvi-2025.js','firvi-competition.js'];
const make=(o={})=>load({extraFiles:EXTRA,...o});
/* Geometría EFECTIVA del robot que se está probando (no se fija aquí): barra de sensores y origen del sonar. Variante evaluada: HEAD-CANVAS (sensores 6,0 / 2,8 cm;
   sonar a 9,83 cm del eje). En la variante medida de main serían 8,0 / 1,9 y 7,40: las pruebas que dependen del hardware se derivan de esta configuración. */
const GEO=(()=>{const h=make();return {front:h.js('LINE_SENSOR.geometry.front'),spread:h.js('LINE_SENSOR.geometry.spread'),sonar:h.js('HEAD_SONAR.params.faceForward.value')};})();
const emptyScenario=id=>({['bitiro:standalone:scenario:v1:'+id]:'[]'});

// Datos puros, sin simulador: solo tracks + firvi-2025.js.
const pure=(withFirvi=true)=>{
 const ctx={window:null};ctx.window=ctx;vm.createContext(ctx);
 for(const f of ['tracks.js','extra-tracks.js',...(withFirvi?EXTRA:[])])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
 return ctx.window;
};
const W=pure(),F=W.BITIRO_FIRVI_2025,A=W.BITIRO_TRACKS['firvi-2025'],B=W.BITIRO_TRACKS['firvi-2025-b'];
const S=F.spec;

/* ── 1 · Geometría documentada ─────────────────────────────────────────────────────────────── */
test('dimensiones documentadas: baldosa 30, cuarto 4×3 baldosas, margen 15, tres cuartos',()=>{
 assert.equal(S.TILE_CM,30);assert.equal(S.MARGIN_CM,15);assert.equal(S.ROOMS,3);
 assert.equal(S.ROOM_COLS*S.ROOM_ROWS,12,'12 baldosas por cuarto (4 × 3)');
 assert.equal(S.ROOM_W,S.ROOM_COLS*30+30);assert.equal(S.ROOM_H,S.ROOM_ROWS*30+30);
 same([S.ROOM_H,S.ROOM_W].sort((a,b)=>b-a),[150,120],'la figura de dimensiones rotula 150 × 120 cm por cuarto con márgenes');
 assert.equal(A.w,360);assert.equal(A.h,150);assert.equal(B.w,360);assert.equal(B.h,150);
});
test('línea negra de 1 a 2 cm y escala de la figura = baldosa de 30 cm',()=>{
 assert.ok(S.LINE_WIDTH_CM>=1&&S.LINE_WIDTH_CM<=2);
 for(const t of [A,B])for(const p of t.paths)assert.equal(p.w,S.LINE_WIDTH_CM);
 near(S.FIG_TILE_PX*S.PX,30,1e-9,'80 px = 30 cm');
});
test('todo el trazo cae dentro de la pista y dentro de las baldosas o del pasillo',()=>{
 for(const t of [A,B])for(const p of t.paths)for(const [x,y] of p.p){
  assert.ok(x>=0&&x<=t.w&&y>=0&&y<=t.h,`${p.id} (${x},${y}) fuera del mundo`);
  assert.ok(y>=S.MARGIN_CM&&y<=t.h-S.MARGIN_CM,`${p.id} invade el margen horizontal (${y})`);
 }
});
test('A y B comparten exactamente la misma línea; solo cambian la base INICIO, el sentido y las props',()=>{
 same(A.paths,B.paths);
 notSame(A.start,B.start);
 near(A.start.heading,0,1e-12);near(B.start.heading,Math.PI,1e-12);
});
test('bases INICIO: dentro de las baldosas de los cuartos extremos y con la línea al frente',()=>{
 const tipA=F.starts.A.lineTip,tipB=F.starts.B.lineTip;
 assert.ok(tipA.x>=S.MARGIN_CM&&tipA.x<S.MARGIN_CM+90,'A en el cuarto 1');
 assert.ok(tipB.x>=2*S.ROOM_W+S.MARGIN_CM&&tipB.x<=2*S.ROOM_W+S.MARGIN_CM+90,'B en el cuarto 3');
 // La punta de la línea es el primer vértice (A) o el último (B) del trazo; cada recorrido es el inverso del otro.
 const main1=A.paths.find(p=>p.id==='main-1').p,main2=A.paths.find(p=>p.id==='main-2').p;
 near(main1[0][0],tipA.x,1e-6);near(main1[0][1],tipA.y,1e-6);
 const last=main2[main2.length-1];near(last[0],tipB.x,1e-6);near(last[1],tipB.y,1e-6);
 // Fila de INICIO: A en la fila 4 (inferior), B en la fila 1 (superior) = simetría de media vuelta del plano.
 near(tipA.y,S.MARGIN_CM+3.5*S.TILE_CM,1e-6);near(tipB.y,S.MARGIN_CM+0.5*S.TILE_CM,1e-6);
});
test('simetría de media vuelta del plano (la figura la declara; tolerancia de medición 1,5 cm)',()=>{
 // Punto de rotación: centro del cuarto 2. Cada vértice de la línea debe tener, tras girar 180°, otro vértice de la línea a < 1,5 cm.
 const cx=S.WORLD_W/2,cy=S.WORLD_H/2,all=A.paths.flatMap(p=>p.p);
 const seg=[];for(const p of A.paths)for(let i=1;i<p.p.length;i++)seg.push([p.p[i-1],p.p[i]]);
 const dist=(q)=>Math.min(...seg.map(([a,b])=>{const vx=b[0]-a[0],vy=b[1]-a[1],d=vx*vx+vy*vy,t=d?Math.max(0,Math.min(1,((q[0]-a[0])*vx+(q[1]-a[1])*vy)/d)):0;return Math.hypot(q[0]-a[0]-t*vx,q[1]-a[1]-t*vy);}));
 let worst=0;for(const q of all)worst=Math.max(worst,dist([2*cx-q[0],2*cy-q[1]]));
 assert.ok(worst<=1.5,`desviación de simetría ${worst.toFixed(2)} cm`);
});

/* ── 2 · Gaps, topes y pasillos: ausencia REAL de trazo ───────────────────────────────────── */
const coverDist=(t,x,y)=>W.BITIRO_LINE_GEOMETRY.distance(t.paths,x,y);   // fuente compartida con sensor y renderer
test('tres gaps: ausencia real de trazo; bordes y extremos exactos con extremos planos (geometría compartida)',()=>{
 assert.equal(F.gapRanges.length,3);
 const G=W.BITIRO_LINE_GEOMETRY,mm=.05;
 for(const g of F.gapRanges){
  const x=g.x,mid=(g.y0+g.y1)/2;
  if(g.id!=='gap-2'){
   // CENTRO: blanco a más de medio gap del trazo más cercano; BORDES: justo en el extremo del trazo es negro (≤0) y 0,05 cm más allá es blanco (>0).
   assert.ok(coverDist(A,x,mid)>=(g.y1-g.y0)/2-1e-6,g.id+' centro');
   assert.ok(coverDist(A,x,g.y0)<=1e-9,g.id+' el extremo superior del trazo es negro');assert.ok(coverDist(A,x,g.y0+mm)>0,g.id+' 0,05 cm después del extremo ya es blanco');
   assert.ok(coverDist(A,x,g.y1)<=1e-9,g.id+' el extremo inferior del trazo es negro');assert.ok(coverDist(A,x,g.y1-mm)>0,g.id+' 0,05 cm antes del extremo ya es blanco');
   for(let y=g.y0+mm;y<=g.y1-mm;y+=.05)assert.ok(coverDist(A,x,y)>0,`${g.id}: y=${y.toFixed(2)} toca trazo`);
   // El ancho de la cinta se respeta en el extremo: a ±0,9 cm del eje sigue habiendo negro justo antes del extremo y ninguno después.
   assert.ok(coverDist(A,x+.9,g.y0-.1)<=0&&coverDist(A,x-.9,g.y0-.1)<=0,g.id+' ancho de 2 cm en el extremo');
   assert.ok(coverDist(A,x+.9,g.y0+mm)>0&&coverDist(A,x+1.1,g.y0-.1)>0,g.id+' el trazo no se ensancha ni se alarga (sin tapa redonda)');
  }else{
   // gap-2: entre los topes (a ±1 cm de los ejes de los topes) solo hay blanco en el eje.
   for(let y=g.y0+1.1;y<=g.y1-1.1;y+=.05)assert.ok(coverDist(A,x,y)>0,`gap-2 y=${y.toFixed(2)}`);
  }
 }
 // largos medidos de la figura (px × 0,375): 21 px · 62 px (entre ejes de topes) · 20 px
 near(F.gapRanges[0].y1-F.gapRanges[0].y0,21*.375,1e-6,'gap-1');near(F.gapRanges[1].y1-F.gapRanges[1].y0,62*.375,1e-6,'gap-2');near(F.gapRanges[2].y1-F.gapRanges[2].y0,20*.375,1e-6,'gap-3');
});
test('una sola geometría: los polígonos que dibuja el renderer son exactamente el conjunto que el sensor considera negro',()=>{
 const G=W.BITIRO_LINE_GEOMETRY;
 const inPoly=(poly,x,y)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
 const polys=A.paths.flatMap(p=>G.polygons(p));
 let seed=7;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;let checked=0,edge=0;
 for(let k=0;k<60000;k++){
  const x=rnd()*360,y=15+rnd()*120,d=G.distance(A.paths,x,y);
  if(Math.abs(d)<.02){edge++;continue;}          // franja de 0,2 mm sobre el borde: el disco de uniones es un polígono de 32 lados
  assert.equal(polys.some(q=>inPoly(q,x,y)),d<0,`(${x.toFixed(3)},${y.toFixed(3)}) d=${d.toFixed(3)}`);checked++;
 }
 assert.ok(checked>59000);
 // el sensor del simulador usa esa misma distancia: la lectura se acerca a negro/blanco según su signo
 const h=make({storage:emptyScenario('firvi-2025')});h.js("changeTrack('firvi-2025')");
 for(let k=0;k<400;k++){const x=rnd()*340+10,y=15+rnd()*120;
  assert.equal(h.js(`closestSegment(${x},${y}).dist`),G.distance(h.js('track.paths'),x,y));}
 // las pistas existentes siguen con el modelo anterior (tapa redonda): su closestSegment no usa esta geometría
 h.js("changeTrack('s01')");assert.equal(h.js('track.capStyle'),undefined);assert.ok(h.js('typeof closestSegment(50,100).x')==='number');
});
test('dos topes transversales de 30 cm con tramo de línea que llega a cada uno',()=>{
 const bars=A.paths.filter(p=>p.role==='transverse');assert.equal(bars.length,2);
 for(const b of bars){near(Math.abs(b.p[1][0]-b.p[0][0]),30,1e-6,b.id);near(b.p[0][1],b.p[1][1],1e-9);}
 const stubs=A.paths.filter(p=>p.role==='stub');assert.equal(stubs.length,2);
});
test('los pasillos son líneas rectas continuas entre cuartos (sin gap en los pasillos)',()=>{
 for(const x of [105+15,225+15]){ // mitad de cada pasillo (30 cm entre baldosas de cuartos contiguos)
  const y=x<200?S.MARGIN_CM+0.5*S.TILE_CM:S.MARGIN_CM+3.5*S.TILE_CM;
  assert.ok(coverDist(A,x,y)<=0,`pasillo en x=${x}`);
 }
});

/* ── 3 · Sensores: los tres leen la geometría dibujada ────────────────────────────────────── */
const sensors=(h,x,y,heading)=>{h.js(`R.x=${x};R.y=${y};R.th=${heading}+Math.PI/2`);return [0,1,2].map(k=>h.js(`LINE_SENSOR.detected(readLine(${k}),${k})`));};
const sensorXY=(x,y,th)=>[0,1,2].map(k=>({x:x+GEO.front*Math.sin(th)+(k-1)*GEO.spread*Math.cos(th),y:y-GEO.front*Math.cos(th)+(k-1)*GEO.spread*Math.sin(th)}));
test('sensores: negro sobre la línea, blanco en los tres gaps, tres negros sobre un tope',()=>{
 const h=make({storage:emptyScenario('firvi-2025')});h.js("changeTrack('firvi-2025')");
 const x=F.gapRanges[0].x,heading=Math.PI/2;                       // robot mirando hacia +y (bajando)
 const at=y=>sensors(h,x,y-GEO.front,heading);                             // sensor central en (x,y)
 assert.equal(at(F.gapRanges[0].y0-3)[1],true);
 for(const g of F.gapRanges){const mid=(g.y0+g.y1)/2;
  if(g.id==='gap-2'){ // evita los topes: el centro del gap-2 está a ≥ 8 cm de ambos
   same(at(mid),[false,false,false],g.id);continue;}
  same(at(mid),[false,false,false],'sensores en blanco dentro de '+g.id);
 }
 assert.equal(at(F.gapRanges[0].y1+3)[1],true,'línea después del gap-1 (tramo hacia el tope)');
 const barY=A.paths.find(p=>p.id==='room2-bar-top').p[0][1];
 same(at(barY),[true,true,true],'tope: los tres sensores ven negro');
 // El valor numérico distingue negro de blanco con la escala vigente del sensor.
 h.js(`R.x=${x};R.y=${F.gapRanges[0].y0-3-GEO.front};R.th=${heading}+Math.PI/2`);
 assert.ok(h.js('readLine(1)')>650,'negro ≈ 850');
 h.js(`R.y=${(F.gapRanges[0].y0+F.gapRanges[0].y1)/2-GEO.front}`);assert.ok(h.js('readLine(1)')<300,'blanco ≈ 155');
});
test('el sensor lee los mismos trazos que se dibujan (sceneTrack = track.paths)',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");
 const scene=h.js('sceneTrack'),t=h.js('track');
 assert.equal(scene.paths.length,t.paths.length);
 scene.paths.forEach((p,i)=>{assert.equal(p.points.length,t.paths[i].p.length);assert.equal(p.widthCm,t.paths[i].w);
  p.points.forEach((q,j)=>{assert.equal(q.x,t.paths[i].p[j][0]);assert.equal(q.y,t.paths[i].p[j][1]);});});
 assert.equal(scene.physicalWidthCm,360);assert.equal(scene.physicalHeightCm,150);
});
test('barrido de sensores a lo largo de toda la línea: cada vértice es negro con el sensor encima',()=>{
 const h=make({storage:emptyScenario('firvi-2025')});h.js("changeTrack('firvi-2025')");
 let checked=0;
 for(const p of A.paths)for(let i=0;i<p.p.length;i+=3){
  const [x,y]=p.p[i],heading=0; // la lectura central solo depende de la posición del sensor central
  h.js(`R.x=${x-GEO.front};R.y=${y};R.th=${heading}+Math.PI/2`);
  assert.ok(h.js('LINE_SENSOR.detected(readLine(1),1)'),`${p.id}[${i}] (${x.toFixed(1)},${y.toFixed(1)}) debe leerse negro`);checked++;
 }
 assert.ok(checked>80);
});
const FOLLOWER=`void setup(){inicializarMovimiento();inicializarSensores();}
int ult=0;int lost=0;
void loop(){bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;
const runSegment=(route,pose,goal,seconds=120)=>{
 const h=make({storage:emptyScenario(route)});h.js(`changeTrack('${route}')`);h.program(FOLLOWER);
 if(pose)h.js(`R.x=${pose[0]};R.y=${pose[1]};R.th=${pose[2]};previousPose={x:R.x,y:R.y,th:R.th,angle:0}`);
 let t=0,ok=false;for(;t<120*seconds;t++){h.js('update(1/120)');if(goal(h.js('R.x'),h.js('R.y'))){ok=true;break;}if(h.js('mode')!=='code')break;}
 return {ok,t:t/120,x:h.js('R.x'),y:h.js('R.y'),collisions:h.js('collisionCount'),moved:h.js('movedCount')};
};
// Tramos del recorrido con el MISMO programa de solo sensores (sin obstáculos). Un tramo parte de la base INICIO real; los demás, de una pose
// alineada antes del tramo (como las demás pruebas del repo). Un recorrido continuo exige control de rumbo a la salida del arco del cuarto 2
// (el seguidor genérico llega torcido al primer gap y se desvía): limitación documentada, no un defecto de la pista.
const P=Math.PI;
const SEGMENTS=[
 ['firvi-2025','A1 base INICIO → pasillo 1',null,(x,y)=>x>150&&y<40],
 ['firvi-2025','A2 los tres gaps y los dos topes del cuarto 2',[180,38,P],(x,y)=>x>230&&y>110],
 ['firvi-2025','A3 cuarto 3 → base INICIO opuesta',[250,120,P/2],(x,y)=>x>325&&y<40],
 ['firvi-2025-b','B1 base INICIO → pasillo 2',null,(x,y)=>x<235&&y>110],
 ['firvi-2025-b','B2 los tres gaps (en sentido inverso)',[180,115,0],(x,y)=>x<150&&y<40],
 ['firvi-2025-b','B3 cuarto 1 → base INICIO opuesta',[150,30,-P/2],(x,y)=>x<35&&y>110]
];
for(const [route,name,pose,goal] of SEGMENTS)test('tramo '+name+': un programa solo de sensores lo recorre sin colisiones',()=>{
 const r=runSegment(route,pose,goal);assert.ok(r.ok,`${name}: no llegó (t=${r.t.toFixed(0)} s, x=${r.x.toFixed(0)}, y=${r.y.toFixed(0)})`);assert.equal(r.collisions,0);
});
test('sentido de avance: A parte del cuarto 1 hacia +x y B del cuarto 3 hacia −x; el progreso de cada uno es monótono en su sentido',()=>{
 for(const [route,sign] of [['firvi-2025',1],['firvi-2025-b',-1]]){
  const h=make({storage:emptyScenario(route)});h.js(`changeTrack('${route}')`);h.program(FOLLOWER);
  const x0=h.js('R.x');let best=0;
  for(let t=0;t<120*60;t++){h.js("update(1/120)");best=Math.max(best,sign*(h.js('R.x')-x0));}
  assert.ok(best>100,route+' avanza en su sentido');
  const seq=h.js('track.sequence');assert.equal(seq.startRoom,sign>0?1:3);assert.equal(seq.finalRoom,sign>0?3:1);assert.equal(seq.checkpointRoom,2);
 }
});
test('A y B se evalúan por separado: estado, código, escenario, registro físico y checkpoint propios',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");
 h.js('activeObstacles[0].x+=3;physicsEvents.push({kind:"push",id:"x"})');h.el('src').value='// A';
 h.js("changeTrack('firvi-2025-b')");
 assert.equal(h.js('physicsEvents.length'),0,'el registro físico no pasa de un recorrido al otro');
 assert.equal(h.js('activeObstacles.length'),2);near(h.js('activeObstacles[0].x'),h.js("BITIRO_SCENARIO.defaults('firvi-2025-b')[0].x"),1e-9);
 assert.ok(h.js('R.x')>330,'B arranca en su propio INICIO');
 assert.equal(h.saved.get('bitiro:standalone:code:firvi-2025'),'// A');assert.equal(h.saved.get('bitiro:standalone:code:firvi-2025-b'),undefined);
 const cpA=W.BITIRO_TRACKS['firvi-2025'].landmarks.checkpoint,cpB=W.BITIRO_TRACKS['firvi-2025-b'].landmarks.checkpoint;
 notSame(cpA,cpB,'fichas naranja distintas');assert.ok(cpA.x<S.ROOM_W*1.5&&cpB.x>S.ROOM_W*1.5,'cada ficha en su lado del cuarto 2');
 same(W.BITIRO_TRACKS['firvi-2025'].paths,W.BITIRO_TRACKS['firvi-2025-b'].paths);
});

/* ── 4 · Obstáculos: prisma triangular de 13 cm × 20 cm ───────────────────────────────────── */
const M=()=>make().ctx.IROH_MECHANICS;
const mkPrism=(M_,cx,cy,rot)=>({id:'p',shape:'triangular-prism',...M_.prism(cx,cy,rot,13),movable:true,visualHeightCm:20});
test('prisma: tres caras de 13 cm, 20 cm de alto, dos obstáculos por recorrido y dentro del arena',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");
 const obs=h.js('activeObstacles');assert.equal(obs.length,2,'«máximo dos» obstáculos puntuables');
 for(const o of obs){
  assert.equal(o.shape,'triangular-prism');assert.equal(o.visualHeightCm,20);assert.equal(o.poly.length,3);
  for(let i=0;i<3;i++){const a=o.poly[i],b=o.poly[(i+1)%3];near(Math.hypot(a[0]-b[0],a[1]-b[1]),13,1e-4,'lado');}
  assert.ok(o.x>=.35&&o.y>=.35&&o.x+o.width<=360-.35&&o.y+o.height<=150-.35);
  near(o.height,13,1e-4);near(o.width,13*Math.sqrt(3)/2,1e-4,'altura del triángulo equilátero');
 }
 // Cada obstáculo cae sobre la línea (bases III.E.1: «alrededor de la línea o encima de ésta»).
 for(const o of obs)assert.ok(coverDist(A,o.cx,o.cy)<=0.5,o.id+' sobre la línea');
 // Están dentro de un cuarto: el primero en el cuarto 1 y el segundo en el 3.
 assert.ok(obs[0].cx<S.ROOM_W&&obs[1].cx>2*S.ROOM_W);
});
test('prisma: una cara plana mira al robot que llega en ambos recorridos (supuesto documentado)',()=>{
 const a=make();a.js("changeTrack('firvi-2025')");const b=make();b.js("changeTrack('firvi-2025-b')");
 const flatFacesPlusX=o=>{const xs=o.poly.map(q=>q[0]);return xs.filter(x=>Math.abs(x-Math.max(...xs))<1e-4).length===2;};
 assert.ok(flatFacesPlusX(a.js('activeObstacles')[0]),'A llega desde +x');
 assert.ok(!flatFacesPlusX(b.js('activeObstacles')[0]),'B llega desde −x: cara plana hacia −x');
});
test('sonar: detecta el prisma (20 cm > altura del transductor) con la distancia geométrica exacta',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");h.js('R.x=88;R.y=90;R.th=-Math.PI/2');
 const face=h.js('activeObstacles[0].poly').reduce((m,q)=>Math.max(m,q[0]),-1);
 assert.equal(h.js('readSonarDistance()'),Math.round(88-GEO.sonar-face));
 h.js('R.y=60');assert.equal(h.js('readSonarDistance()'),200,'sin obstáculo en el haz: alcance máximo');
 h.js('R.x=60.4;R.y=120;R.th=Math.PI');assert.equal(h.js('readSonarDistance()'),200,'mirando a otro lado');
});
test('sonar: el haz mide contra el triángulo, no contra su caja envolvente (esquina vacía)',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");
 const o=h.js('activeObstacles[0]');
 // Robot al oeste mirando a +x a la altura de la esquina vacía de la caja (y = borde superior + .5): la caja daría ≈ o.x − origen.
 const y=o.y+.5,x=30,origin=x+GEO.sonar;
 h.js(`R.x=${x};R.y=${y};R.th=Math.PI/2`);
 const reading=h.js('readSonarDistance()'),bboxDistance=Math.round(o.x-origin);
 assert.ok(reading>bboxDistance+4,`lectura ${reading} cm debe superar la de la caja envolvente (${bboxDistance} cm)`);
 assert.ok(reading<200,'el triángulo sigue siendo detectado');
});
test('garra: el barrido solo desplaza el prisma si la barra lo toca; fuera de alcance no lo mueve',()=>{
 const m=M(),track={w:360,h:150},pose={x:88,y:90,th:-Math.PI/2};
 const near_=mkPrism(m,68,80.5,180),far=mkPrism(m,70,60,180);far.id='far';
 const hit=m.advance(pose,0,75,[near_],track);
 assert.ok(hit.hits.includes('p'),'la barra al barrer por delante toca el prisma cercano');
 const moved=hit.changes.get('p');assert.ok(Math.hypot(moved.x-near_.x,moved.y-near_.y)>.02);
 assert.equal(moved.poly.length,3,'el prisma conserva su polígono al desplazarse');
 near(moved.poly[0][0]-near_.poly[0][0],moved.x-near_.x,1e-9);near(moved.poly[0][1]-near_.poly[0][1],moved.y-near_.y,1e-9);
 const miss=m.advance(pose,0,75,[far],track);
 same(miss.hits,[]);assert.equal(miss.changes.size,0,'obstáculo fuera del arco: nada se mueve');
 assert.equal(m.barOverlapsBox(pose,0,mkPrism(m,50,90,0)),false,'más allá del alcance de la barra (21,8 cm)');
});
test('garra: el contacto usa la forma triangular, no la caja envolvente (esquina vacía)',()=>{
 const m=M(),tri=mkPrism(m,64.5,90,0);                                   // vértice agudo hacia +x
 const box={id:'box',x:tri.x,y:tri.y,width:tri.width,height:tri.height,movable:true,visualHeightCm:20};   // misma envolvente, sin polígono
 const probe={x:88,y:78.8,th:-Math.PI/2};
 let boxOnly=0,prismOnly=0;
 for(let ang=-75;ang<=75;ang+=1){const b=m.barOverlapsBox(probe,ang,box),p=m.barOverlapsBox(probe,ang,tri);if(b&&!p)boxOnly++;if(p&&!b)prismOnly++;}
 assert.ok(boxOnly>0,'hay ángulos donde la caja envolvente tocaría y el prisma no');
 assert.equal(prismOnly,0,'el prisma está contenido en su envolvente: nunca toca donde la caja no');
});
test('cuerpo: el chasis nunca desplaza el prisma; el contacto detiene al robot',()=>{
 const m=M(),track={w:360,h:150},tri=mkPrism(m,60,90,180);
 const old={x:80,y:90,th:-Math.PI/2},deep={x:62,y:90,th:-Math.PI/2};          // el centro entraría a < 8,3 cm del polígono
 const r=m.advanceRobotPose(old,deep,0,[tri],track);
 assert.ok(r.blocked,'el cuerpo no atraviesa ni empuja');assert.equal(r.changes.size,0);
 same([r.pose.x,r.pose.y],[80,90],'el robot queda en la última pose válida');
});
test('empuje por traslación con la barra fija mueve el prisma a la par; con giro, bloquea',()=>{
 const m=M(),track={w:360,h:150},tri=mkPrism(m,60,90,180);
 const a={x:86.5,y:90,th:-Math.PI/2},b={x:85.9,y:90,th:-Math.PI/2};               // la punta (21,8 cm) pasa de 0,95 a 0,35 cm de la cara plana en x≈63,75
 assert.equal(m.barOverlapsBox(a,0,tri),false,'precondición: sin contacto antes');assert.ok(m.barOverlapsBox(b,0,tri),'precondición: contacto después');
 const r=m.advanceRobotPose(a,b,0,[tri],track);
 assert.ok(!r.blocked&&r.hits.includes('p'),'la barra empuja el prisma');const q=r.changes.get('p');near(q.x-tri.x,-.6,1e-9,'avanza lo mismo que el robot');near(q.y-tri.y,0,1e-9);
 assert.equal(q.poly.length,3);
 const t2={x:85.5,y:90,th:-Math.PI/2+.05},contact={x:85,y:90,th:-Math.PI/2};
 assert.ok(m.barOverlapsBox(contact,0,tri),'precondición: la barra toca');
 const spin=m.advanceRobotPose(contact,{...contact,th:contact.th+.05},0,[tri],track);
 assert.equal(spin.blocked?.reason,'rotation','girar con la barra tocando detiene al robot');
});
test('programa del usuario: avanza con el golpe en 0° y mueve el prisma por contacto; sin tocar, nada se mueve',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");
 h.program('void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();} void loop(){avanzar(20);}');
 h.js('R.x=88;R.y=90;R.th=-Math.PI/2;previousPose={x:R.x,y:R.y,th:R.th,angle:0}');
 const before=h.js('activeObstacles.map(o=>[o.x,o.y])');
 h.tick(120*2);
 const after=h.js('activeObstacles.map(o=>[o.x,o.y])');
 assert.ok(after[0][0]<before[0][0]-1,'el prisma fue empujado hacia −x');same(after[1],before[1],'el otro obstáculo no se tocó');
 assert.equal(h.js('movedCount'),1);
 // Sin tocarlo (se detiene antes) nada cambia.
 const g=make();g.js("changeTrack('firvi-2025')");g.program('void setup(){inicializarMovimiento();} void loop(){detenerse();}');
 g.js('R.x=88;R.y=90;R.th=-Math.PI/2');const b2=g.js('JSON.stringify(activeObstacles)');g.tick(240);assert.equal(g.js('JSON.stringify(activeObstacles)'),b2);assert.equal(g.js('movedCount'),0);
});
test('Reiniciar restaura los prismas desde la configuración (la física solo muta la copia activa)',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");const pristine=h.js('JSON.stringify(activeObstacles)');
 h.js('activeObstacles[0].x+=5;activeObstacles[0].poly=activeObstacles[0].poly.map(q=>[q[0]+5,q[1]])');
 h.js('window.resetRobot()');assert.equal(h.js('JSON.stringify(activeObstacles)'),pristine);
});

/* ── 4b · Secuencia completa con obstáculo: contacto ≠ empuje ≠ barrido ───────────────────────── */
// Programa de usuario (solo sensores, sonar y servo; ningún dato del plano): sigue la línea con el brazo recogido a la izquierda; al detectar el
// prisma con el sonar se detiene, hace el abanico de izquierda a derecha (V.E.3), recoge el brazo y retoma el seguimiento.
const SWEEP_PROGRAM=(pre,sweep,threshold)=>`void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(${pre});pausa(1200);}
int ult=0;int lost=0;int done=0;
void loop(){
 if(done==0 && leerDistanciaSonar()<=${threshold}){
  detenerse();pausa(300);moverServoGolpe(${sweep});pausa(1500);moverServoGolpe(0);pausa(1200);done=1;
 }
 bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i||c||d){lost=0;}else{lost=lost+1;}
 if(i&&c&&d){avanzar(24);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(26);}
 else if(lost<900){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 pausa(5);}`;
const runSequence=(program,seconds=90,route='firvi-2025')=>{
 const h=make();h.js(`changeTrack('${route}')`);h.program(program);
 const prism0=JSON.parse(h.js('JSON.stringify(activeObstacles[0])')),trace={sonarAtFirstSweep:null,maxServo:-99,minServo:99,passedAt:null};
 for(let t=0;t<120*seconds;t++){
  h.js('update(1/120)');
  const a=h.js('striker.angle');trace.maxServo=Math.max(trace.maxServo,a);trace.minServo=Math.min(trace.minServo,a);
  if(trace.sonarAtFirstSweep===null&&h.js('BITIRO_PHYSICS_LOG().some(e=>e.kind==="sweep")'))trace.sonarAtFirstSweep=h.js('readSonarDistance()');
  if(h.js('R.x')>150&&h.js('R.y')<40){trace.passedAt=t/120;break;}
  if(h.js('mode')!=='code')break;
 }
 return {h,prism0,trace,log:h.js('BITIRO_PHYSICS_LOG()'),prism:JSON.parse(h.js('JSON.stringify(activeObstacles[0])'))};
};
test('SECUENCIA: sigue la línea → sonar detecta el prisma → abanico válido del servo → el barrido lo desplaza → retoma la línea y lo supera',()=>{
 const r=runSequence(SWEEP_PROGRAM(-1,1,14));
 const kinds=r.log.map(e=>e.kind);
 assert.ok(r.trace.passedAt!==null,'el robot supera el prisma y llega al pasillo 1 por sus sensores');
 assert.ok(kinds.includes('sweep'),'hay desplazamiento por barrido del servo');
 assert.ok(!kinds.includes('push'),'ningún desplazamiento por empuje del robot');assert.ok(!kinds.includes('contact'),'ningún bloqueo');
 assert.equal(r.log.filter(e=>e.kind==='sweep').every(e=>e.id==='obstacle-room1'&&e.detail==='servo'),true);
 assert.ok(r.trace.minServo<=-74.9&&r.trace.maxServo>=60,`abanico real de izquierda a derecha (servo ${r.trace.minServo.toFixed(0)}° → ${r.trace.maxServo.toFixed(0)}°)`);
 assert.equal(r.h.js('collisionCount'),0);assert.equal(r.h.js('movedCount'),1);
 // La orden del abanico se dio tras la detección: el sonar leyó ≤ 14 cm justo antes de que el servo barriera.
 assert.ok(r.trace.sonarAtFirstSweep!==null&&r.trace.sonarAtFirstSweep<=20,`sonar al iniciar el contacto: ${r.trace.sonarAtFirstSweep}`);
 // Desplazamiento físico: el prisma salió de la línea (ya no solapa el trazo) y conserva su forma.
 const moved=Math.hypot(r.prism.x-r.prism0.x,r.prism.y-r.prism0.y);assert.ok(moved>5,`desplazado ${moved.toFixed(1)} cm`);
 for(let i=0;i<3;i++){const a=r.prism.poly[i],b=r.prism.poly[(i+1)%3];near(Math.hypot(a[0]-b[0],a[1]-b[1]),13,1e-4,'lado intacto');}
 const G=W.BITIRO_LINE_GEOMETRY;let minGap=Infinity;
 for(const q of r.prism.poly)minGap=Math.min(minGap,G.distance(A.paths,q[0],q[1]));
 assert.ok(minGap>0,'ningún vértice del prisma queda sobre la línea');
 near(r.h.js('activeObstacles[1].x'),r.h.js("BITIRO_SCENARIO.defaults('firvi-2025')[1].x"),1e-9);
 assert.equal(r.log.length,1,'un solo hecho físico (barrido continuo) y ningún contacto adicional');
});
test('SECUENCIA (reproducible): dos ejecuciones idénticas dan el mismo registro y la misma pose del prisma',()=>{
 const a=runSequence(SWEEP_PROGRAM(-1,1,14)),b=runSequence(SWEEP_PROGRAM(-1,1,14));
 same(a.log,b.log);same(a.prism,b.prism);near(a.trace.passedAt,b.trace.passedAt,0);
});
test('SECUENCIA en el Recorrido B: el prisma del cuarto 3 se aparta con el abanico (sentido inverso, cara plana hacia −x)',()=>{
 // En B el robot llega desde el este; el sonar detecta el prisma 2 y el abanico (derecha→izquierda del robot) lo desplaza sin empujarlo.
 // Con la geometría HEAD-CANVAS (sensores a 6 cm, sonar a 9,83 cm) el prisma del cuarto 3 de B queda justo a la salida de una vuelta en U: el seguidor mínimo de arriba
 // lo ve a 10 cm con el robot aún girando (26° respecto de la línea) y el primer barrido lo deja sobre la línea. Aquí se usa el programa de referencia de la integración
 // (tests/integration/reference-program.iroh), que solo se apoya en sus sensores, el sonar y el servo, y espera el Pulsador.
 const h=make();h.js("changeTrack('firvi-2025-b')");
 h.program(require('node:fs').readFileSync(require('node:path').join(__dirname,'integration','reference-program.iroh'),'utf8'));
 let done=false;
 for(let t=0;t<120*100&&!done;t++){h.js('update(1/120)');if(t===360)h.js('pressTouchSensor(1)');if(h.js('R.x')<255&&h.js('R.y')>110)done=true;if(h.js('mode')!=='code')break;}
 const log=h.js('BITIRO_PHYSICS_LOG()').filter(e=>e.kind!=='touch'),kinds=log.map(e=>e.kind);   // el Pulsador es un hecho físico aparte
 // En B el primer prisma que encuentra es el del cuarto 3 (obstacle-room3).
 assert.ok(done,'B supera el cuarto 3 y entra al pasillo 2');
 assert.ok(kinds.includes('sweep')&&!kinds.includes('push')&&!kinds.includes('contact'),JSON.stringify(log));
 assert.equal(log[0].id,'obstacle-room3');
});
test('CLASIFICACIÓN: sin abanico (servo centrado) no hay barrido; el contacto se registra como contacto o como empuje, nunca como barrido',()=>{
 // Seguidor sin servo: llega al prisma con la barra al centro. La física lo empuja por traslación o lo bloquea al girar con la barra tocando.
 const r=runSequence(SWEEP_PROGRAM(0,0,0),40);
 const kinds=r.log.map(e=>e.kind);
 assert.ok(!kinds.includes('sweep'),'sin movimiento del servo no hay barrido');
 assert.ok(kinds.includes('contact')||kinds.includes('push'),'el contacto queda registrado: '+JSON.stringify(r.log));
 assert.equal(r.trace.passedAt,null,'el prisma sobre la línea sigue obstruyendo: el robot no lo atraviesa');
});
test('CLASIFICACIÓN: empuje por traslación = «push» (el robot avanza con la barra en 0°); no cuenta como barrido',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");
 h.program('void setup(){inicializarMovimiento();inicializarGolpe();} void loop(){avanzar(20);}');
 h.js('R.x=88;R.y=90;R.th=-Math.PI/2;previousPose={x:R.x,y:R.y,th:R.th,angle:0}');h.tick(120*2);
 const log=h.js('BITIRO_PHYSICS_LOG()');assert.ok(log.some(e=>e.kind==='push'&&e.id==='obstacle-room1'&&e.detail==='translation'));assert.ok(!log.some(e=>e.kind==='sweep'));
 assert.equal(h.js('ui.feedback.textContent').includes('prisma triangular'),true,'el aviso nombra el prisma, no una «caja»');
});
test('CLASIFICACIÓN: el barrido fuera de alcance no genera ningún hecho (el abanico no mueve objetos a distancia)',()=>{
 const r=runSequence(SWEEP_PROGRAM(0,1,16),12);          // se detiene a 16 cm del sonar: la punta de la barra queda ≈ 1,6 cm antes del prisma
 assert.equal(r.log.length,0,JSON.stringify(r.log));same([r.prism.x,r.prism.y],[r.prism0.x,r.prism0.y]);
});
test('mensajes: el prisma se nombra «prisma triangular»; las cajas de S01–S08 conservan su texto original',()=>{
 const m=M(),track={w:360,h:150};
 const tri=mkPrism(m,60,90,180),contact={x:85,y:90,th:-Math.PI/2};
 const spin=m.advanceRobotPose(contact,{...contact,th:contact.th+.05},0,[tri],track);
 assert.match(spin.blocked.message,/prisma triangular/);assert.ok(!/caja/.test(spin.blocked.message));
 const box={id:'b',x:56,y:86,width:8,height:8,movable:true,visualHeightCm:15.6},spinBox=m.advanceRobotPose(contact,{...contact,th:contact.th+.05},0,[box],track);
 assert.equal(spinBox.blocked.message,'La garra tocó una caja durante un giro: el robot se detuvo.');
 // sin espacio: prisma contra el borde del arena
 const wall=mkPrism(m,8,90,180),a={x:34,y:90,th:-Math.PI/2},b={x:33.6,y:90,th:-Math.PI/2};
 const noSpace=m.advanceRobotPose(a,b,0,[wall],{w:360,h:150});
 if(noSpace.blocked)assert.match(noSpace.blocked.message,/prisma triangular/);
});

/* ── 4c · Referencias planas INICIO y checkpoint ──────────────────────────────────────────────── */
test('referencias: INICIO y ficha naranja de cada recorrido a partir de la figura; los cuadros rojos NO se dibujan ni se sensan',()=>{
 for(const [t,route,heading] of [[A,'A',0],[B,'B',Math.PI]]){
  const kinds=t.references.map(r=>r.kind).sort();same(kinds,['checkpoint','start','start-other']);
  const st=t.references.find(r=>r.kind==='start');near(st.heading,heading,1e-12);near(st.x,F.starts[route].lineTip.x,1e-9);
  const cp=t.references.find(r=>r.kind==='checkpoint');near(cp.x,F.checkpoints[route].x,1e-9);
  assert.ok(!t.references.some(r=>/red|cuadro|square/i.test(JSON.stringify(r))),'sin atribuir función a los cuadros rojos');
  assert.equal(t.landmarks.redSquares.length,5);
 }
 const h=make({storage:emptyScenario('firvi-2025')});h.js("changeTrack('firvi-2025')");
 h.js('R.x=12;R.y=120;R.th=Math.PI/2');                              // sensores sobre la flecha INICIO (detrás de la línea): el suelo rojo plano no es línea
 assert.deepEqual([0,1,2].map(k=>h.js(`LINE_SENSOR.detected(readLine(${k}),${k})`)),[false,false,false]);
});

/* ── 5 · Aislamiento respecto de S01–S08, Óvalo y Ocho ────────────────────────────────────── */
test('aislamiento: las pistas existentes y sus cajas predeterminadas son idénticas con y sin firvi-2025.js',()=>{
 const without=pure(false),withF=pure(true);
 const ids=Object.keys(without.BITIRO_TRACKS);assert.equal(ids.length,10);
 for(const id of ids)assert.equal(JSON.stringify(withF.BITIRO_TRACKS[id]),JSON.stringify(without.BITIRO_TRACKS[id]),id);
 for(const id of Object.keys(without.BITIRO_SCENARIO_PROPS))assert.equal(JSON.stringify(withF.BITIRO_SCENARIO_PROPS[id]),JSON.stringify(without.BITIRO_SCENARIO_PROPS[id]),'props '+id);
 same(Object.keys(withF.BITIRO_TRACKS).filter(k=>!ids.includes(k)).sort(),['firvi-2025','firvi-2025-b']);
});
test('aislamiento: las pistas existentes no llevan marcas FIRVI ni cambian su modelo de escenario (cajas de 8 × 8 cm)',()=>{
 const h=make();
 for(const id of ['s01','s02','s03','s04','s05','s06','s07','s08','oval','ocho']){
  const t=h.js(`BITIRO_TRACKS['${id}']`);assert.equal(t.competition,undefined,id);assert.equal(t.noDemo,undefined,id);assert.equal(t.scenarioEditable,undefined,id);
 }
 h.js("changeTrack('s01')");const o=h.js('activeObstacles');assert.equal(o.length,1);assert.equal(o[0].poly,undefined);assert.equal(o[0].width,8);assert.equal(o[0].shape,undefined);
});
test('aislamiento: la física de cajas AABB es idéntica a la de HEAD (comparación aleatoria determinista)',()=>{
 let oldSrc;try{oldSrc=execFileSync('git',['show','HEAD:strike-physics.js'],{cwd:root,encoding:'utf8'});}catch{console.log('   (sin git: se omite la comparación con HEAD)');return;}
 const loadPhys=src=>{const c={window:null};c.window=c;vm.createContext(c);vm.runInContext(src,c);return c.IROH_MECHANICS;};
 const oldM=loadPhys(oldSrc),newM=loadPhys(fs.readFileSync(path.join(root,'strike-physics.js'),'utf8'));
 let seed=12345;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
 const track={w:100,h:140};
 const cmp=(a,b,l)=>assert.equal(JSON.stringify(a,(k,v)=>v instanceof Map?[...v]:v),JSON.stringify(b,(k,v)=>v instanceof Map?[...v]:v),l);
 for(let i=0;i<400;i++){
  const pose={x:20+rnd()*60,y:20+rnd()*100,th:rnd()*6.28},box={id:'b',x:pose.x+(rnd()-.5)*40,y:pose.y+(rnd()-.5)*40,width:8,height:8,movable:rnd()>.2,visualHeightCm:15.6};
  const ang=-75+rnd()*150,ang2=-75+rnd()*150;
  cmp(oldM.barOverlapsBox(pose,ang,box),newM.barOverlapsBox(pose,ang,box),'bar');
  cmp(oldM.bodyOverlapsBox(pose,box),newM.bodyOverlapsBox(pose,box),'body');
  cmp(oldM.advance(pose,ang,ang2,[box],track),newM.advance(pose,ang,ang2,[box],track),'advance');
  const to={x:pose.x+(rnd()-.5)*.8,y:pose.y+(rnd()-.5)*.8,th:pose.th+(rnd()<.5?0:(rnd()-.5)*.02)};
  cmp(oldM.advanceRobotPose(pose,to,ang,[box],track),newM.advanceRobotPose(pose,to,ang,[box],track),'pose');
 }
});

/* ── 6 · Sin ayudas artificiales ni evaluador en el movimiento ───────────────────────────── */
test('sin ayudas: un programa en lazo abierto no es corregido por el simulador (la pista no gobierna al robot)',()=>{
 const run=(mutate)=>{const h=make({storage:emptyScenario('firvi-2025')});h.js("changeTrack('firvi-2025')");mutate&&mutate(h);
  h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(30,20);}');h.tick(120*6);return [h.js('R.x'),h.js('R.y'),h.js('R.th')];};
 const withLine=run();
 const noLine=run(h=>h.js('track.paths.length=0'));            // misma ejecución sin ninguna línea en el suelo
 same(withLine,noLine,'si el robot ignora los sensores, la pista no afecta a la trayectoria');
});
test('sin ayudas: detenido no se mueve; un programa que no gira conserva el rumbo aunque la línea se curve',()=>{
 const h=make({storage:emptyScenario('firvi-2025')});h.js("changeTrack('firvi-2025')");
 h.js('window.resetRobot()');const p0=h.js('[R.x,R.y,R.th]');h.tick(120*10);same(h.js('[R.x,R.y,R.th]'),p0,'en reposo, sin programa');
 h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(30);}');h.tick(120*5);
 near(h.js('R.th'),p0[2],1e-9,'rumbo conservado');near(h.js('R.y'),p0[1],1e-9,'sin desviación lateral');
});
test('el estado de la pista no cambia durante la ejecución (sin evaluador que escriba sobre ella)',()=>{
 const h=make({storage:emptyScenario('firvi-2025')});h.js("changeTrack('firvi-2025')");
 const snap=h.js('JSON.stringify(track)');h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(30,25);}');h.tick(120*8);
 assert.equal(h.js('JSON.stringify(track)'),snap);
 assert.equal(h.js('BITIRO_COMPETITION.on'),false,'en modalidad práctica el motor de competencia está apagado y sus ganchos son neutros');
});
test('la demostración guiada está desactivada en FIRVI 2025 (el robot solo obedece al código del usuario)',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");
 const p0=h.js('[R.x,R.y,R.th]');
 // El handler del botón existe y no mueve al robot.
 assert.equal(typeof h.el('demo').events.click,'function','el botón Demo tiene su manejador');h.el('demo').events.click();h.tick(240);
 assert.equal(h.js('mode'),'idle');same(h.js('[R.x,R.y,R.th]'),p0);
});

/* ── 7 · Integración con selector, almacenamiento y escenario ─────────────────────────────── */
test('selector e índice: las dos pistas FIRVI existen, el script se carga tras extra-tracks.js y antes de scenario-props.js',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes('<option value="firvi-2025">')&&html.includes('<option value="firvi-2025-b">'));
 const order=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
 assert.ok(order.indexOf('extra-tracks.js')<order.indexOf('firvi-2025.js')&&order.indexOf('firvi-2025.js')<order.indexOf('scenario-props.js'));
});
test('código por pista: FIRVI usa su propia clave y no toca el código de S01–S08',()=>{
 const h=make();h.js("changeTrack('s01')");h.el('src').value='// código de S01';h.js("changeTrack('firvi-2025')");
 assert.equal(h.saved.get('bitiro:standalone:code:s01'),'// código de S01');
 h.el('src').value='// código FIRVI';h.js("changeTrack('s01')");
 assert.equal(h.saved.get('bitiro:standalone:code:firvi-2025'),'// código FIRVI');
 assert.equal(h.el('src').value,'// código de S01');
});
test('Editar escenario queda deshabilitado en FIRVI (los prismas son parte del escenario de la etapa) y vuelve a estar activo en S01',()=>{
 const h=make();h.js("changeTrack('firvi-2025')");assert.equal(h.el('editScenario').disabled,true);
 h.js("changeTrack('s01')");assert.equal(h.el('editScenario').disabled,false);
});
test('el escenario guardado ([]) vacía los prismas: base para «retirar obstáculos» de la Etapa B',()=>{
 const h=make({storage:emptyScenario('firvi-2025')});h.js("changeTrack('firvi-2025')");assert.equal(h.js('activeObstacles.length'),0);
 assert.equal(h.js('sonarClear=readSonarDistance()'),200);
});
test('fidelidad declarada: documentado / medido / supuesto / por validar están separados y no vacíos',()=>{
 for(const k of ['documented','measuredFromFigure','assumed','needsValidation'])assert.ok(F.fidelity[k].length>0,k);
 assert.ok(A.startInfo.official===false&&A.official===false,'ninguna geometría se declara oficial');
 assert.match(A.source,/aproximada/);
});

console.log(`\n${n} pruebas FIRVI-2025-A OK`);
