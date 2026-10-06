/* SIM-1 · Caracterización de runtime, geometría congelada, cinemática y storage del baseline v4.
   Describe el comportamiento ACTUAL; no afirma que sean medidas reales del IROH. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {load,root}=require('./harness.cjs');
const strip=h=>String(h).replace(/<[^>]*>/g,'');

function runtimeCases(){
 const cases=[];
 const run=(label,code,ticks,{track='s01',vars=[],setup}={})=>{
  const h=load();h.js(`changeTrack('${track}')`);if(setup)setup(h);
  h.program(code);h.tick(ticks);
  const scope=h.js('scopes[0]');
  cases.push({label,code,ticks,msg:strip(h.el('msg').innerHTML),running:h.js('running'),mode:h.js('mode'),
   motors:[h.js('R.L'),h.js('R.R')],pose:[h.js('R.x'),h.js('R.y'),h.js('R.th')],lcd:h.js('lcd.slice()'),
   striker:h.js('striker.angle'),vars:Object.fromEntries(vars.map(v=>[v,scope[v]]))});
 };
 run('inicialización válida','void setup(){inicializarMovimiento();inicializarSensores();botonInicio();} void loop(){}',5);
 run('avanzar(30) tras 1 s','void setup(){inicializarMovimiento();} void loop(){avanzar(30);}',120);
 run('girarDerecha(20) tras 2 s','void setup(){inicializarMovimiento();} void loop(){girarDerecha(20);}',240);
 run('lectura de línea (S01 inicio)','int a=0;int b=0;bool c=false;int u=0;void setup(){inicializarSensores();} void loop(){a=leerLineaNormalizada(1);b=leerSensorLineaCentral();c=lineaCentral();u=leerUmbralLinea();finPrograma();}',10,{vars:['a','b','c','u']});
 run('sonar con caja de práctica','int d=0;void setup(){inicializarSensores();} void loop(){d=leerDistanciaSonar();finPrograma();}',10,{vars:['d']});
 run('LCD escribirPantalla(col,fila,valor)','void setup(){inicializarPantalla();} void loop(){escribirPantalla(0,0,123);escribirPantalla(4,1,45);finPrograma();}',10);
 run('golpe moverServoGolpe(65) a 0,5 s','void setup(){inicializarGolpe();} void loop(){moverServoGolpe(65);pausa(900);moverServoGolpe(0);pausa(900);}',60,{setup:h=>h.js('activeObstacles=[]')});
 run('golpe tras 1,5 s (ya retraído a medias)','void setup(){inicializarGolpe();} void loop(){moverServoGolpe(65);pausa(900);moverServoGolpe(0);pausa(900);}',180,{setup:h=>h.js('activeObstacles=[]')});
 run('while con acumulador','int n=0;void setup(){} void loop(){while(n<3){n+=1;}finPrograma();}',10,{vars:['n']});
 run('error: función desconocida con sugerencia','void setup(){} void loop(){avansar(30);}',2);
 run('error: variable no declarada','void setup(){} void loop(){x=3;}',2);
 run('error: falta loop','void setup(){}',2);
 run('error: argumento fuera de rango','void setup(){inicializarSensores();} void loop(){int a=leerLineaNormalizada(3);}',2);
 run('aviso estricto: sensor sin inicializar','void setup(){} void loop(){int a=lineaCentral();finPrograma();}',3);
 return cases;
}

function storageCases(){
 const out=[];
 const v1='bitiro:line-calibration:v1',codeKey=t=>'bitiro:standalone:code:'+t;
 const snapKeys=h=>[...h.saved.keys()].sort();
 const prof=h=>h.js('LINE_SENSOR.profile');
 {const h=load();out.push({case:'sin claves previas',profile:prof(h),keys:snapKeys(h),src_is_EJ0:h.el('src').value===h.js('EJ[0]')});}
 {const good={version:1,white:[100,110,120],black:[900,910,920],threshold:600,calibrated:true};
  const h=load({storage:{[v1]:JSON.stringify(good)}});out.push({case:'v1 válida se carga tal cual',profile:prof(h)});}
 for(const [name,raw] of [['JSON corrupto','{no es json'],['versión 2 en la clave v1',JSON.stringify({version:2,white:[155,155,155],black:[865,865,865],threshold:500,calibrated:true})],
  ['contraste < 100',JSON.stringify({version:1,white:[400,400,400],black:[450,450,450],threshold:500,calibrated:true})],['umbral fuera de rango',JSON.stringify({version:1,white:[155,155,155],black:[865,865,865],threshold:50,calibrated:true})],['valor no numérico',JSON.stringify({version:1,white:[155,'x',155],black:[865,865,865],threshold:500,calibrated:true})],['null','null']]){
  const h=load({storage:{[v1]:raw}});out.push({case:'v1 inválida → defaults: '+name,profile:prof(h),keyUntouched:h.saved.get(v1)===raw});}
 {const h=load();const ok=h.js('LINE_SENSOR.save({...LINE_SENSOR.defaults(),threshold:640,calibrated:true})');
  out.push({case:'save escribe solo la clave v1',returned:ok,stored:JSON.parse(h.saved.get(v1)),keys:snapKeys(h)});}
 {const h=load();h.js("changeTrack('s02')");h.el('src').value='// pista S02';h.js("changeTrack('s01')");h.js("changeTrack('s02')");
  out.push({case:'código por pista: ida y vuelta',keys:snapKeys(h),s02:h.saved.get(codeKey('s02')),srcNow:h.el('src').value,s01Stored:h.saved.get(codeKey('s01'))});}
 {const h=load({storage:{[codeKey('s01')]:'\u0000basura<script>x</script>'}});out.push({case:'código guardado arbitrario se carga sin validar',src:h.el('src').value});}
 {const h=load({storage:{[codeKey('s01')]:''}});out.push({case:'código guardado vacío cae a EJ[0]',src_is_EJ0:h.el('src').value===h.js('EJ[0]')});}
 {const h=load({blocked:true});
  const threw=(()=>{try{h.js("changeTrack('s02')");h.js("changeTrack('s01')");return false;}catch{return true;}})();
  out.push({case:'storage bloqueado desde el arranque',profile:prof(h),saveReturned:h.js('LINE_SENSOR.save(LINE_SENSOR.defaults())'),changeTrackThrew:threw,src_is_EJ0:h.el('src').value===h.js('EJ[0]'),keys:snapKeys(h)});}
 {const h=load();h.behavior.blocked=true;
  out.push({case:'storage se bloquea tras cargar: save devuelve false pero el perfil queda en memoria',saveReturned:h.js('LINE_SENSOR.save({...LINE_SENSOR.defaults(),calibrated:true})'),profileInMemoryCalibrated:prof(h).calibrated===true,keys:snapKeys(h)});}
 {const h=load();h.js('LINE_SENSOR.save(LINE_SENSOR.defaults())');h.js("changeTrack('s03')");
  out.push({case:'v2 nunca se lee ni se escribe',v2Keys:snapKeys(h).filter(k=>/v2/.test(k)),keys:snapKeys(h)});}
 return out;
}

function geometry(){
 return JSON.parse(JSON.stringify(geometryRaw())); // normaliza objetos del contexto vm
}
function geometryRaw(){
 const h=load();const {js}=h;
 const src=f=>fs.readFileSync(path.join(root,f),'utf8');
 const m=(f,re)=>{const r=src(f).match(re);if(!r)throw new Error('No encontrado '+re+' en '+f);return r;};
 return {
  fixedDt:js('FIXED_DT'),fixedDtIs1over120:js('FIXED_DT')===1/120,
  lineSensor:{geometry:js('LINE_SENSOR.geometry'),rawWhite:js('LINE_SENSOR.raw(0)'),rawBlack:js('LINE_SENSOR.raw(1)'),rawHalf:js('LINE_SENSOR.raw(.5)'),defaults:js('LINE_SENSOR.defaults()')},
  mechanics:js('IROH_MECHANICS.spec'),
  sonar:{rayOffsetsDeg:[-6,0,6],rayOffsetSource:m('simulator.js',/for\(const offset of \[(-Math\.PI\/30,0,Math\.PI\/30)\]\)/)[1],originForwardCm:9.83,maxRangeCm:200,minObstacleHeightCm:15.1},
  kinematics:{physicsWheelbaseCm:+m('simulator.js',/base=(\d+(?:\.\d+)?);/)[1],maxSpeedCmPerSecAt100:+m('simulator.js',/const max=(\d+)/)[1],wheelRampPctPerSec:+m('simulator.js',/240\*dt/)[0].match(/\d+/)[0],substepTranslationCm:.30,substepRotationRad:.025},
  rendererVisual:{wheelCenterOffsetCmPerSide:+m('renderer3d.js',/const mid=side\*(\d+(?:\.\d+)?)/)[1],sides:[-1,1]},
 };
}

function yawRate(patches=[]){
 const h=load({patches});h.js("changeTrack('s01')");h.program('void setup(){inicializarMovimiento();} void loop(){girarDerecha(20);}');
 h.tick(120);const a=h.js('R.th');h.tick(120);return {thetaAt1s:a,thetaAt2s:h.js('R.th'),radPerSec:h.js('R.th')-a};
}
module.exports={runtimeCases,storageCases,geometry,yawRate,strip};
