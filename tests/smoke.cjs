/* node tests/smoke.cjs — pruebas de cinemática reales (sin navegador/red). */
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const saved=new Map(),nodes=new Map();
function el(id){
 if(!nodes.has(id))nodes.set(id,{
  id,value:id==='quality'?'standard':'',textContent:'',innerHTML:'',style:{},dataset:{},hidden:false,
  disabled:false,classList:{toggle(){},add(){},remove(){}},setAttribute(){},
  events:{},addEventListener(type,fn){this.events[type]=fn;},querySelector(){return el(id+'.sub')},focus(){},
  showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},
  getBoundingClientRect(){return {width:700,height:480}},scrollIntoView(){},requestFullscreen(){}
 });
 return nodes.get(id);
}
const document={addEventListener(){},getElementById:el,querySelectorAll(q){return q==='.cam'?['perspective','top','follow','robot'].map(v=>({...el('cam_'+v),dataset:{view:v}})):[];}};
const ctx={document,window:null,console,performance:{now:()=>0},Math,Number,Date,
 localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
 devicePixelRatio:1,clamp:(n,a,b)=>Math.max(a,Math.min(n,b)),
 requestAnimationFrame(){},renderScene3D(){}};
ctx.window=ctx;vm.createContext(ctx);
for(const file of ['tracks.js','extra-tracks.js','calibration.js','iroh-runtime.js','strike-physics.js','scenario-props.js','simulator.js']){
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
}
const js=src=>vm.runInContext(src,ctx);
assert.equal(el('codePanel').hidden,false,'Editor visible');
assert.equal(js('Object.keys(sourceTracks).length'),10,'Diez pistas');
assert.equal(js('HIT.pivotRight'),0,'Palo central en robot');
assert.equal(js('HIT.sonarHeight'),15.1,'Altura sonar coherente');
assert.equal(js('activeObstacles[0].visualHeightCm'),15.6,'Caja aproximadamente a altura sonar');
assert.equal(js('rodTouchesBox(0,activeObstacles[0])'),false,'La garra centrada no nace atravesando caja');
let leftAngle=js('window.IROH_MECHANICS.sweepAngle(window.IROH_MECHANICS.commandAngle(-1))'),centerAngle=js('window.IROH_MECHANICS.sweepAngle(window.IROH_MECHANICS.commandAngle(0))'),rightAngle=js('window.IROH_MECHANICS.sweepAngle(window.IROH_MECHANICS.commandAngle(1))');
assert.ok(leftAngle<0&&centerAngle===0&&rightAngle>0,'La garra barre alrededor del eje central: izquierda − / centro 0 / derecha +');
assert.ok(Math.abs(leftAngle+rightAngle)<1e-7,'Giro simétrico hacia ambos lados');
// Sin cercanía, no hay contacto ni movimiento remoto.
js('setStrikerPosition(1)');for(let k=0;k<55;k++)js('update(1/60)');
assert.equal(js('movedCount'),0,'Golpe remoto no mueve caja');
assert.equal(js('activeObstacles[0].x'),46,'Caja no se teletransporta');
js("window.resetRobot();setStrikerPosition(-1);mode='demo';demoPath=createDemoPath(track);demoIndex=0;");   // como la demo visual: garra apartada (−1) antes de acercarse
for(let k=0;k<2400;k++){js('update(1/60)');if(js('mode')==='idle')break;}
assert.equal(el('statusBadge').textContent,'OBSTÁCULO','Demo detecta caja');
assert.equal(js('rodTouchesBox(striker.angle,activeObstacles[0])'),false,'Demo no penetra con la garra');
const start=js('({x:activeObstacles[0].x,y:activeObstacles[0].y})');
// La garra ya está a la izquierda (−1): barrido de izquierda a derecha (+1).
js('setStrikerPosition(1)');
let last=js('({x:activeObstacles[0].x,y:activeObstacles[0].y})');
for(let k=0;k<90;k++){
 js('update(1/60)');
 assert.equal(js('rodTouchesBox(striker.angle,activeObstacles[0])'),false,'Palo atraviesa caja en paso '+k);
 assert.equal(js('bodyTouchesBox(R.x,R.y,activeObstacles[0])'),false,'Caja entra en el chasis en paso '+k);
 const now=js('({x:activeObstacles[0].x,y:activeObstacles[0].y})');
 assert.ok(Math.hypot(now.x-last.x,now.y-last.y)<1.7,'Objeto teleportado en paso '+k);
 last=now;
}
assert.equal(js('movedCount'),1,'Cuenta la caja una sola vez');
assert.ok(js('activeObstacles[0].x')>start.x+10,'El golpe abre espacio por el lateral');
assert.ok(js('striker.angle')>74,'El servo completa su barrido sin atravesar');
js('setStrikerPosition(0)');for(let k=0;k<80;k++){
 js('update(1/60)');assert.equal(js('rodTouchesBox(striker.angle,activeObstacles[0])'),false,'Retorno sin atravesar');
}
assert.ok(Math.abs(js('striker.angle'))<.01,'El servo vuelve al centro');
assert.equal(js('movedCount'),1,'Retraer no cuenta golpes falsos');
// Una demostración detenida debe CONTINUAR tras el golpe, sin resetear la pista.
js('window.resetRobot();setStrikerPosition(-1);mode="demo";demoPath=createDemoPath(track);demoIndex=0');
for(let k=0;k<2400;k++){js('update(1/60)');if(js('mode')==='idle')break;}
assert.equal(js('resumeDemoAfterStrike'),true);
const beforeResume=js('({x:R.x,y:R.y})');
js('demoStrike(1)');   // ciclo propio de la demo guiada: derecha → retorno automático al centro
for(let k=0;k<250;k++){
 js('update(1/60)');
 if(js('mode')==='demo')break;
}
assert.equal(js('mode'),'demo','La demostración continúa tras apartar la caja');
assert.ok(js('Math.hypot(R.x-'+beforeResume.x+',R.y-'+beforeResume.y+')')<3,'No reinicia la posición al continuar');
assert.equal(js('rodTouchesBox(striker.angle,activeObstacles[0])'),false);
// Ejemplo del editor: el sonar acerca al robot, espera a la caja y acciona
// el golpe. Debe funcionar SIN que el usuario manipule las coordenadas.
js('window.resetRobot()');el('src').value=js('EJ[4]');js('start()');
for(let k=0;k<1100;k++){
 js('update(1/60)');
 assert.equal(js('rodTouchesBox(striker.angle,activeObstacles[0])'),false,'Golpe por código no atraviesa caja');
 if(js('movedCount')===1&&js('striker.angle')>60)break;
}
assert.equal(js('movedCount'),1,'El ejemplo de sonar activa el golpe al llegar a la caja');
assert.ok(js('activeObstacles[0].x')>46+8,'El ejemplo del editor desplaza físicamente la caja');
// Objeto fijo: el servo se detiene, sin penetrar ni desplazar.
js('window.resetRobot()');js('R.x=50; R.y=122.238; activeObstacles[0].movable=false; striker.angle=-75; striker.target=-75; previousPose.angle=-75; setStrikerPosition(1)');
for(let k=0;k<70;k++){js('update(1/60)');assert.equal(js('rodTouchesBox(striker.angle,activeObstacles[0])'),false)}
assert.ok(js('striker.angle')<75,'Objeto fijo bloquea servo');
assert.equal(js('movedCount'),0,'Objeto fijo no desplazado');
// Un programa del alumno debe impulsar el servo en modo código.
js('window.resetRobot()');
el('src').value='void setup(){ inicializarMovimiento(); inicializarSensores(); inicializarGolpe(); } void loop(){ moverServoGolpe(1); pausa(900); moverServoGolpe(0); pausa(900); }';
js('start()');for(let k=0;k<54;k++)js('update(1/60)');
assert.equal(js('mode'),'code');
assert.ok(js('striker.angle')>1,'moverServoGolpe(1) activa movimiento real');
assert.equal(js('rodTouchesBox(striker.angle,activeObstacles[0])'),false);
// Persistencia del programa por pista.
js("changeTrack('s02')");el('src').value='// pista S02';js("changeTrack('s01')");
assert.ok(el('src').value.includes('moverServoGolpe'),'Código S01 conservado');
js("changeTrack('s02')");assert.equal(el('src').value,'// pista S02');
console.log('BITIRO pruebas OK: garra −1/0/+1, barrido bidireccional, altura sonar, colisión y desplazamiento continuo, retorno, obstáculo fijo, código y pistas.');
module.exports={ctx,js,el,saved};

