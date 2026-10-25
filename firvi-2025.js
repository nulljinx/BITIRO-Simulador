/* BITIRO Simulador · Escenario FIRVI 2025 (Final Nacional de Robótica Educativa, Fundación Gabriel & Mary Mustakis).
   Fuente única: «Bases generales ROB FIRVI 2025 – V2», sección III (texto) y Figura 1 «Vista completa del escenario de competencia» (p. 2).
   TRACK = geometría impresa · SCENARIO PROP = prismas triangulares · DEFAULT START = pose al cargar. La puntuación, las rondas y el reloj NO
   viven aquí (Etapas B y C); esta pista no contiene lógica de competencia y no guía al robot.

   PROCEDENCIA DE CADA DATO (ver también docs/firvi-2025.md):
   · DOCUMENTADO (texto de las bases): baldosa 30 × 30 cm · cuarto de 4 × 3 baldosas · margen de seguridad de 15 cm por arista, extensión de la
     pista · tres cuartos en fila · línea negra de 1 a 2 cm · obstáculo = prisma triangular, 13 cm por cara, 20 cm de alto.
   · MEDIDO DE LA FIGURA 1 (aproximado): el trazado de la línea. La figura es un esquema raster sin cotas; se midió en píxeles con la baldosa
     (80 px) = 30 cm y se redujo a rectas y arcos de circunferencia. Incertidumbre estimada ≈ ±0,5 cm en rectas y ±1 cm en arcos.
     El grosor dibujado (≈ 4 cm) está exagerado respecto de la regla (1–2 cm): se usa LINE_WIDTH_CM.
   · SUPUESTO (las bases no lo acotan): longitud del pasillo (aquí, los márgenes contiguos: 30 cm), largo de los topes transversales
     (30 cm, el ancho de una baldosa, medido en la figura), orientación de los prismas, qué cuadros rojos son obstáculos, ausencia de paredes. */
'use strict';
(()=>{
 const T=window.BITIRO_TRACKS;
 const TILE_CM=30,ROOM_COLS=3,ROOM_ROWS=4,MARGIN_CM=15,ROOMS=3;          // documentado (la figura dibuja cada cuarto de 3 baldosas de ancho × 4 de alto)
 const LINE_WIDTH_CM=2;                                                   // regla: 1 a 2 cm; se toma el máximo para que 3 sensores de 1,9 cm de separación la vean
 const FIG_TILE_PX=80,PX=TILE_CM/FIG_TILE_PX;                              // escala de la Figura 1 (0,375 cm/px)
 const ROOM_W=ROOM_COLS*TILE_CM+2*MARGIN_CM,ROOM_H=ROOM_ROWS*TILE_CM+2*MARGIN_CM;   // 120 × 150 cm por cuarto con márgenes (la figura de dimensiones lo rotula 150 × 120)
 const WORLD_W=ROOMS*ROOM_W,WORLD_H=ROOM_H;                               // 360 × 150 cm: los márgenes de cuartos contiguos forman el pasillo (supuesto)
 const OBSTACLE_SIDE_CM=13,OBSTACLE_HEIGHT_CM=20;                          // documentado

 // Figura 1 (px locales del cuarto: (0,0) = esquina de la grilla de baldosas) → cm del mundo.
 const wx=(room,px)=>Math.round((MARGIN_CM+room*ROOM_W+px*PX)*1000)/1000;
 const wy=py=>Math.round((MARGIN_CM+py*PX)*1000)/1000;
 const pt=(room,px,py)=>[wx(room,px),wy(py)];
 // Arco de circunferencia (ángulos de pantalla: x=cx+r·cos a, y=cy+r·sin a) muestreado a cuerdas ≤ ~1,5 cm.
 function arc(room,cx,cy,r,a0,a1){
  const n=Math.max(4,Math.ceil(Math.abs(a1-a0)*Math.PI/180*r*PX/1.5)),out=[];
  for(let i=0;i<=n;i++){const a=(a0+(a1-a0)*i/n)*Math.PI/180;out.push(pt(room,cx+r*Math.cos(a),cy+r*Math.sin(a)));}
  return out;
 }
 const join=(...parts)=>{const out=[];for(const p of parts)for(const q of p){const l=out[out.length-1];if(!l||Math.hypot(l[0]-q[0],l[1]-q[1])>1e-6)out.push(q);}return out;};

 /* Trazo en el sentido del Recorrido A (de INICIO izquierdo-abajo a INICIO derecho-arriba). Todas las medidas salen de la Figura 1. */
 const TRACE={
  // Cuarto 1: serpiente de tres vueltas. Entra por la base inicial (flecha roja) en la fila inferior.
  room1:join(
   [pt(0,28,280)],[pt(0,159.5,280)],arc(0,159.5,240,40,90,-90),[pt(0,80.5,200)],
   arc(0,80.5,160,40,90,270),arc(0,80.5,80,40,90,0),[pt(0,120.5,70)],arc(0,150.5,70,30,180,270),[pt(0,240,40)]),
  // Pasillo 1→2: recta a y de la fila superior; los márgenes contiguos de 15 + 15 cm no llevan otro trazo.
  corridor1:join([pt(0,240,40),pt(1,0,40)]),
  // Cuarto 2: entrada superior, giro a la derecha y bajada vertical con tres interrupciones (gaps) y dos topes transversales.
  room2Entry:join([pt(1,0,40)],[pt(1,80,40)],arc(1,80,80,40,270,360),[pt(1,120,80)],[pt(1,120,91.5)]),
  room2StubTop:join([pt(1,120,112.5)],[pt(1,120,130)]),
  room2BarTop:join([pt(1,80,130)],[pt(1,160,130)]),
  room2BarBottom:join([pt(1,80,192)],[pt(1,160,192)]),
  room2StubBottom:join([pt(1,120,192)],[pt(1,120,209.5)]),
  room2Exit:join([pt(1,120,229.5)],[pt(1,120,240)],arc(1,160,240,40,180,90),[pt(1,240,280)]),
  corridor2:join([pt(1,240,280),pt(2,0,280)]),
  // Cuarto 3: sube por una ese, da una vuelta cerrada y sale por la fila superior hacia la base final (INICIO del otro recorrido).
  room3:join(
   [pt(2,0,280)],[pt(2,80,280)],arc(2,80,240,40,90,0),arc(2,160,240,40,180,270),
   arc(2,160,160,40,90,-90),[pt(2,80.5,120)],arc(2,80.5,80,40,90,270),[pt(2,216,40)])
 };
 const PATH_DEFS=[
  ['room1-a-corridor1','',[...TRACE.room1,...TRACE.corridor1.slice(1)]],
  ['room2-entry','',[...TRACE.room2Entry.slice(0)]],            // continúa sin interrupción desde el pasillo 1 (se une abajo)
  ['room2-stub-top','stub',TRACE.room2StubTop],
  ['room2-bar-top','transverse',TRACE.room2BarTop],
  ['room2-bar-bottom','transverse',TRACE.room2BarBottom],
  ['room2-stub-bottom','stub',TRACE.room2StubBottom],
  ['room2-exit-a-room3','',[...TRACE.room2Exit,...TRACE.corridor2.slice(1),...TRACE.room3.slice(1)]]
 ];
 // El pasillo 1 y la entrada del cuarto 2 son un solo trazo continuo (sin gap): se funden en la lista final.
 const buildPaths=()=>{
  const main=[...PATH_DEFS[0][2],...PATH_DEFS[1][2].slice(1)];
  return [
   {id:'main-1',role:'trunk',w:LINE_WIDTH_CM,p:main},
   {id:'room2-stub-top',role:'stub',w:LINE_WIDTH_CM,p:PATH_DEFS[2][2]},
   {id:'room2-bar-top',role:'transverse',w:LINE_WIDTH_CM,p:PATH_DEFS[3][2]},
   {id:'room2-bar-bottom',role:'transverse',w:LINE_WIDTH_CM,p:PATH_DEFS[4][2]},
   {id:'room2-stub-bottom',role:'stub',w:LINE_WIDTH_CM,p:PATH_DEFS[5][2]},
   {id:'main-2',role:'trunk',w:LINE_WIDTH_CM,p:PATH_DEFS[6][2]}
  ];
 };

 /* Interrupciones de la línea en la bajada del cuarto 2, en cm del mundo (eje x = const). La ausencia de trazo es real: no hay path ahí. */
 const gapRanges=(()=>{
  const x=wx(1,120);
  return [
   {id:'gap-1',x,y0:wy(91.5),y1:wy(112.5),basis:'medido de la Figura 1'},
   {id:'gap-2',x,y0:wy(130),y1:wy(192),basis:'medido de la Figura 1 (entre los centros de los topes; incluye el cuadro rojo central)'},
   {id:'gap-3',x,y0:wy(209.5),y1:wy(229.5),basis:'medido de la Figura 1'}
  ];
 })();

 // Cuadros rojos de la Figura 1 (la leyenda no está en las bases). Centros en cm del mundo.
 const redSquares=[
  {id:'sq-room1',room:0,px:[146-25,200],note:'sobre la línea, cuarto 1'},
  {id:'sq-room2-top',room:1,px:[313-273,40],note:'sobre la línea, junto a la ficha naranja del Recorrido A'},
  {id:'sq-room2-center',room:1,px:[393-273,160],note:'centro del cuarto 2, entre los dos topes (¿«intersección» de la tarea final?)'},
  {id:'sq-room2-bottom',room:1,px:[475-273,280],note:'sobre la línea, junto a la ficha naranja del Recorrido B'},
  {id:'sq-room3',room:2,px:[641-521,120],note:'sobre la línea, cuarto 3'}
 ].map(s=>({id:s.id,room:s.room,x:wx(s.room,s.px[0]),y:wy(s.px[1]),sizeCm:7.5,basis:'posición medida de la Figura 1; significado NO definido en las bases',note:s.note}));
 const checkpoints={
  A:{x:wx(1,287-273),y:wy(15),room:1,basis:'ficha naranja de la Figura 1 (esquina superior izquierda del cuarto 2); posición aproximada'},
  B:{x:wx(1,498-273),y:wy(305),room:1,basis:'ficha naranja de la Figura 1 (esquina inferior derecha del cuarto 2); posición aproximada'}
 };

 // Obstáculos por defecto: INFERENCIA. Las bases fijan «máximo dos» y «dentro de los cuartos» pero no sus posiciones. Se toman los dos
 // cuadros rojos de los cuartos extremos, que ambos recorridos atraviesan, uno en el cuarto inicial y otro en el final. Editable en etapas posteriores.
 const obstacleCentres={room1:redSquares[0],room3:redSquares[4]};
 const propsFor=route=>{
  // Orientación (supuesto): una cara plana mira al robot que llega (en ambos cuadros el recorrido A avanza hacia −x y el B hacia +x).
  // rotationDeg=0 deja un vértice hacia +x y la cara plana hacia −x; 180° lo invierte.
  const rot=route==='A'?180:0;
  return [
   {id:'obstacle-room1',shape:'triangular-prism',cx:obstacleCentres.room1.x,cy:obstacleCentres.room1.y,rotationDeg:rot,sideCm:OBSTACLE_SIDE_CM,visualHeightCm:OBSTACLE_HEIGHT_CM,movable:true,official:false},
   {id:'obstacle-room3',shape:'triangular-prism',cx:obstacleCentres.room3.x,cy:obstacleCentres.room3.y,rotationDeg:rot,sideCm:OBSTACLE_SIDE_CM,visualHeightCm:OBSTACLE_HEIGHT_CM,movable:true,official:false}
  ];
 };

 /* Bases de inicio (flechas rojas «INICIO»). La línea arranca en la punta de la flecha; el robot se coloca con los sensores sobre ella. */
 const starts={
  A:{x:Math.round((wx(0,28)-4.5)*1000)/1000,y:wy(280),heading:0,
     lineTip:{x:wx(0,28),y:wy(280)}},
  B:{x:Math.round((wx(2,216)+4.5)*1000)/1000,y:wy(40),heading:Math.PI,
     lineTip:{x:wx(2,216),y:wy(40)}}
 };

 const fidelity=Object.freeze({
  documented:['baldosa 30×30 cm','cuarto 4×3 baldosas','margen 15 cm','tres cuartos en fila','línea negra 1–2 cm (se usa '+LINE_WIDTH_CM+' cm)','prisma triangular 13 cm por cara × 20 cm de alto'],
  measuredFromFigure:['trazado de la línea (rectas y arcos)','posición y largo de los tres gaps','posición y largo de los dos topes transversales','posición de las bases INICIO','posición de las fichas naranja','posición de los cuadros rojos'],
  assumed:['pasillo = márgenes contiguos (30 cm) sin paredes ni puertas','largo de los topes = 30 cm','prismas equiláteros con una cara plana hacia la marcha','obstáculos por defecto en los cuadros rojos de los cuartos 1 y 3','dos recorridos = la misma línea recorrida desde cada INICIO'],
  needsValidation:['significado de los cinco cuadros rojos','«intersección» de la tarea final','posición de la ficha de checkpoint vs. «última baldosa del cuarto anterior»','longitud real de pasillos y existencia de paredes/puertas','cómo coexisten dos equipos simultáneos sobre la misma línea']
 });

 const baseTrack=(route)=>({
  id:route==='A'?'firvi-2025':'firvi-2025-b',
  name:'FIRVI 2025 · Recorrido '+route,
  w:WORLD_W,h:WORLD_H,
  paths:buildPaths(),zones:[],markers:[],obstacles:[],
  start:{x:starts[route].x,y:starts[route].y,heading:starts[route].heading},
  startInfo:{official:false,basis:'Base INICIO de la Figura 1 (medida del raster); los sensores quedan sobre el inicio de la línea. No es una coordenada oficial acotada.'},
  official:false,competition:'firvi-2025',capStyle:'butt',route,scenarioEditable:false,noDemo:true,
  source:'Bases generales ROB FIRVI 2025 V2 · Figura 1 (p. 2) · reconstrucción aproximada medida del esquema',
  note:'FIRVI 2025 · Recorrido '+route+': reconstrucción de la Figura 1 de las bases (geometría aproximada, no oficial). Programa tu propio código; no hay guía automática.',
  landmarks:{checkpoint:checkpoints[route],redSquares,gaps:gapRanges},
  // Sentido de avance de CADA recorrido (independientes entre sí: código, escenario, registro físico y reinicio son por pista).
  sequence:{rooms:route==='A'?[1,2,3]:[3,2,1],startRoom:route==='A'?1:3,finalRoom:route==='A'?3:1,checkpointRoom:2,travel:route==='A'?'izquierda→derecha':'derecha→izquierda'},
  autoFit:true,
  // Especificación para el motor de competencia (firvi-competition.js). Todas las poses son de robot (centro, rumbo desde +x) con los sensores sobre la línea
  // dentro de la baldosa indicada. Planos = x donde empieza la grilla de baldosas del cuarto siguiente (documentado: baldosa 30 cm, margen 15 cm).
  competitionSpec:(()=>{
   const A=route==='A',pose=(x,y,h)=>({x,y,heading:h}),H=A?0:Math.PI;
   return {
    direction:A?1:-1,planes:A?[MARGIN_CM+ROOM_W,MARGIN_CM+2*ROOM_W]:[MARGIN_CM+2*ROOM_W-30,MARGIN_CM+ROOM_W-30],   // A: 135 y 255 · B: 225 y 105
    endTip:{x:starts[A?'B':'A'].lineTip.x,y:starts[A?'B':'A'].lineTip.y},
    reposition:{
     start:pose(starts[route].x,starts[route].y,starts[route].heading),
     checkpoint:{pose:A?pose(140,wy(40),H):pose(220,wy(280),H),token:{x:checkpoints[route].x,y:checkpoints[route].y},basis:'baldosa de la ficha naranja de la Figura 1 (esquina de la baldosa de entrada al cuarto 2); pose derivada sobre la línea de esa baldosa'},
     previousRoomLastTile2:A?pose(88,wy(40),H):pose(270,wy(280),H),     // última baldosa del 1.er cuarto del recorrido (alternativa de V.G.4)
     previousRoomLastTile3:A?pose(200,wy(280),H):pose(160,wy(40),H)     // última baldosa del 2.º cuarto
    }
   };
  })(),
  // Referencias PLANAS del plano (no se leen con los sensores): INICIO propio (flecha roja), el otro INICIO (atenuado, es el final de este recorrido) y la
  // ficha naranja de ESTE recorrido. Los cuadros rojos NO se dibujan: su significado no está definido en las bases.
  references:[
   {kind:'start',x:starts[route].lineTip.x,y:starts[route].lineTip.y,heading:starts[route].heading,label:'INICIO'},
   {kind:'start-other',x:starts[route==='A'?'B':'A'].lineTip.x,y:starts[route==='A'?'B':'A'].lineTip.y,heading:starts[route==='A'?'B':'A'].heading,label:'INICIO (otro recorrido)'},
   {kind:'checkpoint',x:checkpoints[route].x,y:checkpoints[route].y,label:'ficha naranja (checkpoint)'}
  ]
 });
 T['firvi-2025']=baseTrack('A');
 T['firvi-2025-b']=baseTrack('B');
 window.BITIRO_SCENARIO_PROPS=Object.assign(window.BITIRO_SCENARIO_PROPS||{},{'firvi-2025':propsFor('A'),'firvi-2025-b':propsFor('B')});
 window.BITIRO_FIRVI_2025=Object.freeze({
  spec:Object.freeze({TILE_CM,ROOM_COLS,ROOM_ROWS,MARGIN_CM,ROOMS,ROOM_W,ROOM_H,WORLD_W,WORLD_H,LINE_WIDTH_CM,OBSTACLE_SIDE_CM,OBSTACLE_HEIGHT_CM,FIG_TILE_PX,PX}),
  fidelity,figureToWorld:(room,px,py)=>pt(room,px,py),gapRanges,redSquares,checkpoints,starts
 });
})();
