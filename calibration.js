/* Calibración virtual: referencias por canal. No conecta con hardware real. */
'use strict';
window.BITIRO_STORAGE = {
 get(key){try{return localStorage.getItem(key);}catch{return null;}},
 set(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}},
 remove(key){try{localStorage.removeItem(key);return true;}catch{return false;}}
};
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
 const raw=coverage=>Math.round(155+710*Math.max(0,Math.min(1,coverage)));
 const normalized=(value,k)=>Math.round(Math.max(0,Math.min(1000,(value-profile.white[k])*1000/(profile.black[k]-profile.white[k]))));
 const detected=(value,k)=>normalized(value,k)>=profile.threshold;
 function save(next){if(!validate(next))throw new Error('Cada sensor necesita al menos 100 puntos de contraste; usa valores entre 0 y 1023.');profile=JSON.parse(JSON.stringify(next));return BITIRO_STORAGE.set(key,JSON.stringify(profile));}
 return {geometry,raw,normalized,detected,validate,save,defaults,get profile(){return JSON.parse(JSON.stringify(profile));}};
})();
