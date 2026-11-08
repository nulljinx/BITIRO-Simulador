/* node tests/ux-engine-unchanged.cjs [--quick] — el cambio de mensajes NO altera el motor: mismos escenarios en una copia pristina de la BASE b06052b (git archive) y en el árbol de trabajo;
   se compara, cada 0,05 s de simulación, pose del robot, ruedas, ángulo/objetivo de la garra, base de cada obstáculo, collisionCount, movedCount, striker.blocked (sí/no)
   y el REGISTRO FÍSICO completo (kind, id, detalle, tiempo). Lo ÚNICO que se excluye es el texto de ui.feedback.
   BASE_REF=<ref> cambia la base (por omisión b06052b, el último commit SIN la mejora de avisos: HEAD ya la incluiría tras el commit). ORIG_ROOT=<carpeta> usa una copia pristina ya extraída.
   --quick omite los recorridos completos de FIRVI. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execSync}=require('node:child_process');
const WORK=path.resolve(__dirname,'..');
let ORIG=process.env.ORIG_ROOT;
const BASE_REF=process.env.BASE_REF||'b06052b';
if(!ORIG){ORIG=fs.mkdtempSync(path.join(os.tmpdir(),'bitiro-base-'));execSync(`git -C ${JSON.stringify(WORK)} archive ${BASE_REF} | tar -x -C ${JSON.stringify(ORIG)}`);}
const quick=process.argv.includes('--quick');
const EXTRA=['line-geometry.js','firvi-2025.js','firvi-competition.js','firvi-scoring.js'];
const B=(id,x,y,movable=true)=>({id,x,y,width:8,height:8,movable});
const S01=T=>`int golpeado = 0;\nvoid setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();moverServoGolpe(-1);pausa(900);}\nvoid loop(){int dist = leerDistanciaSonar();if (golpeado == 0 && dist <= ${T}) {detenerse();moverServoGolpe(1);pausa(900);moverServoGolpe(0);pausa(700);golpeado = 1;} else {bool i = lineaIzquierda();bool c = lineaCentral();bool d = lineaDerecha();if (c) { avanzar(30); } else if (i) { avanzar(10, 30); } else if (d) { avanzar(30, 10); } else { avanzar(25); }}}`;
const START='void setup(){inicializarMovimiento();}';
const REF=fs.readFileSync(path.join(WORK,'tests/integration/reference-program.iroh'),'utf8');
/* pose de s = 92 en FIRVI A (calculada con el árbol de trabajo; se pasa como número a ambos árboles) */
const LIB=require(path.join(WORK,'tests/integration/lib.cjs'));
const hW=LIB.load({extraFiles:LIB.EXTRA});hW.js("changeTrack('firvi-2025')");const P92=LIB.poseAt(LIB.geometry(hW,'A').R,92);
const SCEN=[
 {name:'S01 · barrido al leer ≤ 10 cm (la caja se despeja)',track:'s01',code:S01(10),secs:25},
 {name:'S01 · barrido al leer ≤ 12 cm (la caja queda en el camino y se empuja hasta el borde)',track:'s01',code:S01(12),secs:30},
 {name:'caja contra el borde: no-space, luego retroceso',track:'s02',boxes:[B('b',46,3)],pose:{x:50,y:60,th:0},code:START+'void loop(){avanzar(30);pausa(6000);retroceder(30);pausa(3000);detenerse();pausa(30000);}',secs:14},
 {name:'giro con la garra tocando una caja y retroceso',track:'s02',boxes:[B('b',40,80)],pose:{x:50,y:100,th:0},code:START+'void loop(){girarIzquierda(40);pausa(2500);retroceder(30);pausa(3000);detenerse();pausa(30000);}',secs:8},
 {name:'servo contra obstáculo fijo y retroceso',track:'s02',boxes:[B('f',46,70,false)],pose:{x:50,y:100,th:0},arm:75,code:'void setup(){inicializarMovimiento();inicializarGolpe();} void loop(){pausa(3000);retroceder(30);pausa(3000);detenerse();pausa(30000);}',secs:8},
 {name:'cuerpo contra caja fija (el chasis no empuja)',track:'s02',boxes:[B('b',52,70,false)],pose:{x:50,y:92,th:0},arm:-75,code:START+'void loop(){avanzar(30);}',secs:5},
 {name:'FIRVI A · barrido de la garra sobre el prisma 1',track:'firvi-2025',extra:true,firvi:{x:P92.x,y:P92.y,th:P92.h+Math.PI/2,arm:-75},code:'void setup(){inicializarMovimiento();inicializarGolpe();} void loop(){moverServoGolpe(1);pausa(1500);moverServoGolpe(0);pausa(1500);moverServoGolpe(-1);pausa(1500);}',secs:12},
];
if(!quick)for(const [k,id] of [['A','firvi-2025'],['B','firvi-2025-b']])SCEN.push({name:`FIRVI ${k} · recorrido nominal completo con el programa de referencia (ambos obstáculos)`,track:id,extra:true,press:true,code:REF,secs:175});
function runTree(root,sc){
 const {load}=require(path.join(root,'tests/sim1/harness.cjs'));
 const h=load({extraFiles:sc.extra?EXTRA:[]});h.js(`changeTrack('${sc.track}')`);
 if(sc.boxes)h.js(`BITIRO_WORLD.apply(${JSON.stringify(sc.boxes)})`);
 h.program(sc.code);
 const pose=sc.firvi?{x:sc.firvi.x,y:sc.firvi.y,th:sc.firvi.th}:sc.pose,arm=sc.firvi?sc.firvi.arm:sc.arm??0;
 if(pose)h.js(`R.x=${pose.x};R.y=${pose.y};R.th=${pose.th};striker.angle=${arm};striker.target=${arm};previousPose={x:R.x,y:R.y,th:R.th,angle:${arm}}`);
 const rows=[];let pressed=false;
 for(let i=0;i<sc.secs*120;i++){
  h.js('update(1/120)');if(sc.press&&!pressed&&i>=2*120){h.js('pressTouchSensor(1)');pressed=true;}
  if(i%6===0)rows.push(JSON.stringify(h.js(`({t:+simTime.toFixed(4),R:[R.x,R.y,R.th],w:[wheel.left,wheel.right],s:[striker.angle,striker.target,!!striker.blocked],o:activeObstacles.map(o=>[o.id,o.x,o.y,o.poly?o.poly:null]),c:[collisionCount,movedCount,wasContact],mode})`)));
 }
 const log=JSON.stringify(h.js("BITIRO_PHYSICS_LOG().map(e=>[e.kind,e.id,e.detail,e.t,e.servo,e.servoTo,e.steps])"));
 return {rows,log,n:h.js("BITIRO_PHYSICS_LOG().length")};
}
let checks=0;
for(const sc of SCEN){
 const a=runTree(ORIG,sc),b=runTree(WORK,sc);
 assert.equal(a.rows.length,b.rows.length);
 let first=-1;for(let i=0;i<a.rows.length;i++)if(a.rows[i]!==b.rows[i]){first=i;break;}
 assert.equal(first,-1,`${sc.name}: el estado físico difiere en la muestra ${first}\n  original: ${a.rows[first]}\n  nuevo:    ${b.rows[first]}`);
 assert.equal(a.log,b.log,`${sc.name}: el registro físico difiere`);
 checks++;console.log(`OK · ${sc.name}: ${a.rows.length} muestras de estado idénticas, registro físico idéntico (${a.n} eventos)`);
}
console.log(`\n${checks} escenarios · el motor (pose, ruedas, garra, obstáculos, contadores y registro físico) es idéntico al de la base; solo cambia el texto de ui.feedback`);
