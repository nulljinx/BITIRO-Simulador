/* Calibración virtual: referencias por canal. No conecta con hardware real. */
'use strict';
window.BITIRO_STORAGE = {
 get(key){try{return localStorage.getItem(key);}catch{return null;}},
 set(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}},
 remove(key){try{localStorage.removeItem(key);return true;}catch{return false;}}
};
/* ───────────────────────────────────────────────────────────────────────────────────────────────
   MODELO SIMULADO DE SENSOR + CAMPO DE LUZ (SIM-CALIBRATION-1).
   The simulated sensor model is not yet a physical calibration of the real IROH hardware.
   Los números de este bloque son SIMULADOS (pequeñas diferencias deterministas relativas a la escala didáctica 0–1023
   ya existente). No son valores medidos del IROH real: PHYSICAL-CALIBRATION los sustituirá por parámetros medidos.
   Todo es una función pura de (sensor, superficie, posición): misma pose + mismo escenario => misma lectura.
   Sin azar, sin reloj y sin contadores de frame en el camino de lectura (lo comprueban tests/calibration.cjs y el escáner de tests/sim1.cjs).
   TRACK = superficie (tracks.js); LIGHT FIELD = iluminación ambiental espacial (aquí). La pista no guarda luz. */
window.BITIRO_LIGHT_FIELD = (()=>{
 // Factor de iluminación continuo y suave, en coordenadas del plotter (cm). 1 = iluminación neutra.
 const params=Object.freeze({
  gradient:Object.freeze({x0:50,perCm:.0006}),                         // leve gradiente a lo ancho del plotter
  bright:Object.freeze({amp:.035,cx:28,cy:45,sx:26,sy:34}),             // zona algo más iluminada
  shade:Object.freeze({amp:-.045,cx:74,cy:125,sx:20,sy:30})            // zona algo sombreada
 });
 const bump=(x,y,b)=>b.amp*Math.exp(-(((x-b.cx)/b.sx)**2+((y-b.cy)/b.sy)**2)/2);
 function lightAt(x,y){return 1+params.gradient.perCm*(x-params.gradient.x0)+bump(x,y,params.bright)+bump(x,y,params.shade);}
 return Object.freeze({lightAt,params});
})();
window.SENSOR_MODEL = (()=>{
 // Perfil SIMULADO de cada sensor de línea (0 izquierdo, 1 central, 2 derecho): ganancia y desplazamiento relativos.
 const DEFAULT=Object.freeze({
  gain:Object.freeze([1.03,1.00,.97]),
  offset:Object.freeze([4,0,-3]),
  microAmp:2.2,
  light:(x,y)=>window.BITIRO_LIGHT_FIELD.lightAt(x,y)
 });
 // Configuración neutra: reproduce EXACTAMENTE la lectura anterior (usada por las pruebas de compatibilidad).
 const NEUTRAL=Object.freeze({gain:Object.freeze([1,1,1]),offset:Object.freeze([0,0,0]),microAmp:0,light:()=>1});
 const PHASE=Object.freeze([[.7,1.9,2.6],[2.2,.4,1.3],[1.1,2.8,.2]]);
 // Variación local pequeña, suave y determinista (función de sensor y posición): unos ±2 puntos con periodo de ~3 cm.
 function micro(k,x,y,amp=DEFAULT.microAmp){
  if(!amp)return 0;
  const p=PHASE[k];
  return amp*(.62*Math.sin(2.07*x+p[0])*Math.cos(1.73*y+p[1])+.38*Math.sin(1.31*(x-y)+p[2]*3.1));
 }
 /* surface = lectura de superficie en la escala didáctica (155 blanco … 865 negro, sin redondear);
    (x,y) = posición REAL del sensor sobre el plotter, en cm. Devuelve un entero 0–1023. */
 function compute(k,surface,x,y,cfg=DEFAULT){
  const v=surface*cfg.light(x,y)*cfg.gain[k]+cfg.offset[k]+micro(k,x,y,cfg.microAmp);
  return Math.max(0,Math.min(1023,Math.round(v)));
 }
 return Object.freeze({DEFAULT,NEUTRAL,compute,micro,read:(k,surface,x,y)=>compute(k,surface,x,y,DEFAULT)});
})();
window.LINE_SENSOR = (()=>{
 const geometry=Object.freeze({front:6,spread:2.8});
 const defaults=()=>({version:1,white:[155,155,155],black:[865,865,865],threshold:500,calibrated:false});
 const key='bitiro:line-calibration:v1';
 function validate(p){
  if(!p||p.version!==1||!Number.isFinite(p.threshold)||p.threshold<100||p.threshold>900)return false;
  for(const field of ['white','black'])if(!Array.isArray(p[field])||p[field].length!==3||p[field].some(v=>!Number.isFinite(v)||v<0||v>1023))return false;
  return p.white.every((v,k)=>Math.abs(p.black[k]-v)>=100);
 }
 let profile=defaults();
 try{const saved=JSON.parse(BITIRO_STORAGE.get(key));if(validate(saved))profile=saved;}catch{}
 // El banco usa el mismo modelo óptico que la pista, sin ruido aleatorio.
 const rawSurface=coverage=>155+710*Math.max(0,Math.min(1,coverage));
 const raw=coverage=>Math.round(rawSurface(coverage));
 // Lectura del sensor k en la posición (x,y) del plotter: superficie × luz × perfil + variación local (ver SENSOR_MODEL).
 const read=(k,coverage,x,y)=>SENSOR_MODEL.read(k,rawSurface(coverage),x,y);
 const normalized=(value,k)=>Math.round(Math.max(0,Math.min(1000,(value-profile.white[k])*1000/(profile.black[k]-profile.white[k]))));
 const detected=(value,k)=>normalized(value,k)>=profile.threshold;
 function save(next){if(!validate(next))throw new Error('Cada sensor necesita al menos 100 puntos de contraste; usa valores entre 0 y 1023.');profile=JSON.parse(JSON.stringify(next));return BITIRO_STORAGE.set(key,JSON.stringify(profile));}
 return {geometry,raw,read,normalized,detected,validate,save,defaults,get profile(){return JSON.parse(JSON.stringify(profile));}};
})();
