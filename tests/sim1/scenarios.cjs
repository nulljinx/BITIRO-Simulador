/* SIM-1 · Escenarios golden. Cada uno devuelve {meta, samples}. Todo a FIXED_DT=1/120,
   sin reloj de pared ni aleatoriedad. Los números se guardan tal cual (JSON round-trip exacto). */
'use strict';
const {load}=require('./harness.cjs');

function snap(h,tick,{sonar=false,obstacles=false}={}){
 const {js}=h;
 const s={tick,x:js('R.x'),y:js('R.y'),theta:js('R.th'),
  wheel:[js('wheel.left'),js('wheel.right')],target:[js('R.L'),js('R.R')],
  striker:js('striker.angle'),sensors:[0,1,2].map(k=>js(`readLine(${k})`)),mode:js('mode')};
 if(sonar)s.sonar=js('readSonarDistance()');
 if(obstacles)s.obstacles=js('activeObstacles.map(o=>[o.id,o.x,o.y])');
 return s;
}
function run(h,ticks,stride,opts,until){
 const out=[snap(h,0,opts)];
 for(let t=1;t<=ticks;t++){
  h.js('update(1/120)');
  if(t%stride===0)out.push(snap(h,t,opts));
  if(until&&until(t)){if(t%stride)out.push(snap(h,t,opts));break;}
 }
 return out;
}
const S={};

S.s01_straight=o=>{const h=load(o);h.js("changeTrack('s01')");
 h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(30);}');
 return {meta:{track:'s01',program:'avanzar(30)',ticks:240,stride:12},samples:run(h,240,12)};};

S.s01_turn=o=>{const h=load(o);h.js("changeTrack('s01')");
 h.program('void setup(){inicializarMovimiento();} void loop(){avanzar(30);pausa(500);girarDerecha(40);pausa(800);girarIzquierda(40);pausa(800);detenerse();pausa(400);}');
 return {meta:{track:'s01',program:'avanzar 0,5 s; girarDerecha 0,8 s; girarIzquierda 0,8 s; detenerse',ticks:300,stride:6},samples:run(h,300,6)};};

S.s02_three_sensors=o=>{const h=load(o);h.js("changeTrack('s02')");
 // Barrido estático lateral sobre el tronco: tres lecturas brutas a distintas posiciones.
 const sweep=[];
 for(let i=-12;i<=12;i++){h.js(`R.x=49.23+${i*.5};R.y=140;R.th=0`);sweep.push({dx:i*.5,sensors:[0,1,2].map(k=>h.js(`readLine(${k})`))});}
 h.js("changeTrack('s02')");
 h.js('setButton(1)');   // EJ[0] llama a botonInicio(): el escenario aporta el Pulsador presionado ANTES de ejecutar
 h.program(h.js('EJ[0]'));
 return {meta:{track:'s02',note:'sweep: R.y=140,th=0; samples: EJ[0] (tres sensores)',ticks:600,stride:12},sweep,samples:run(h,600,12)};};

S.oval_continuous=o=>{const h=load(o);h.js("changeTrack('oval')");
 h.js('setButton(1)');   // EJ[0] llama a botonInicio(): el escenario aporta el Pulsador presionado ANTES de ejecutar
 h.program(h.js('EJ[0]'));
 return {meta:{track:'oval',program:'EJ[0]',ticks:2400,stride:24},samples:run(h,2400,24)};};

S.s01_demo_strike=o=>{const h=load(o);h.js("changeTrack('s01')");
 h.el('demo').events.click();
 const out=[snap(h,0,{obstacles:true})];let struck=false,tick=0,strikeTick=null;
 for(;tick<120*80;){
  tick++;h.js('update(1/120)');
  if(h.js('resumeDemoAfterStrike')&&!struck){h.el('clawRight').events.click();struck=true;strikeTick=tick;}
  const dense=struck&&tick-strikeTick<360;
  if(tick%(dense?6:24)===0)out.push(snap(h,tick,{obstacles:true}));
  if(struck&&h.js('mode')==='idle'&&!h.js('resumeDemoAfterStrike')){out.push(snap(h,tick,{obstacles:true}));break;}
 }
 return {meta:{track:'s01',mode:'demo',strikeTick,endTick:tick,movedCount:h.js('movedCount'),badge:h.el('statusBadge').textContent,stride:'24 antes/6 durante el golpe'},samples:out};};

S.sonar_range=o=>{const h=load(o);h.js("changeTrack('s01')");
 const cases=[];
 const put=(label,pose,boxes)=>{h.js(`R.x=${pose.x};R.y=${pose.y};R.th=${pose.th};activeObstacles=${JSON.stringify(boxes)}`);cases.push({label,pose,boxes,sonar:h.js('readSonarDistance()')});};
 const box=(x,y,w=8,hh=8,v=15.6)=>({id:'b',x,y,width:w,height:hh,visualHeightCm:v});
 // Robot en (50,130) mirando a -Y; el transductor está 9,83 cm por delante del centro.
 for(const d of [5,10,18,50,100,150,180,190,195]) put('frente d='+d,{x:50,y:130,th:0},[box(46,130-9.83-d-8)]);
 put('justo fuera de 200 (≈200,5)',{x:50,y:130,th:0},[box(46,130-9.83-200.5-8)]);
 put('lejos 300',{x:50,y:130,th:0},[box(46,-300)]);
 put('sin cajas',{x:50,y:130,th:0},[]);
 put('altura 3 cm (bajo el haz)',{x:50,y:130,th:0},[box(46,100,8,8,3)]);
 put('altura 15,1 (límite)',{x:50,y:130,th:0},[box(46,100,8,8,15.1)]);
 put('altura 15,0 (por debajo)',{x:50,y:130,th:0},[box(46,100,8,8,15.0)]);
 // Rayos laterales ±6°: caja fina de 1 cm a ~50 cm; el rayo lateral cruza a 50·tan6° ≈ 5,25 cm.
 for(const side of [-1,1])for(const L of [4,5,6]){
  const x=side>0?50+L:50-L-1;put(`rayo ${side>0?'+':'-'}6° caja lateral ${L}..${L+1}`,{x:50,y:130,th:0},[box(x,130-9.83-50-1,1,1)]);
 }
 put('giro 90°',{x:50,y:130,th:Math.PI/2},[box(80,127,16,6)]);
 return {meta:{track:'s01',note:'estático; sin ticks'},cases};};

S.servo_sweep=o=>{const h=load(o);h.js("changeTrack('s01')");
 h.js('activeObstacles=[]');
 const out=[snap(h,0)];let tick=0;const reached={left:null,right:null,center:null};
 const go=(cmd,key,test)=>{h.js(`setStrikerPosition(${cmd})`);for(;tick<2400;){tick++;h.js('update(1/120)');if(tick%6===0)out.push(snap(h,tick));if(test(h.js('striker.angle'))){reached[key]=tick;if(tick%6)out.push(snap(h,tick));break;}}};
 go(-1,'left',a=>a<=-75+1e-9);go(1,'right',a=>a>=75-1e-9);go(0,'center',a=>Math.abs(a)<=1e-9);
 return {meta:{track:'s01',note:'sin obstáculos; moverServoGolpe(-1) → (+1) → (0): −75° → +75° → 0°',tickReachedLeft:reached.left,tickReachedRight:reached.right,tickBackToCenter:reached.center,stride:6},samples:out};};

module.exports={S,snap};
