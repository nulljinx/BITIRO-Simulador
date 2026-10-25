/* HEAD-CANVAS + FIRVI · comparación funcional con la versión HEAD-CANVAS (producción) en las pistas existentes.
     node tests/compare-head-canvas.cjs <ruta-del-árbol-HEAD-CANVAS>      (p. ej. ../BITIRO-Simulador-nnj)
   Corre el MISMO programa de sensores (seguidor de línea + sonar + barrido de la cabeza + abanico de la garra) en S01–S08, Óvalo y Ocho durante 40 s simulados, una vez
   con el árbol HEAD-CANVAS y otra con este árbol (con los módulos FIRVI cargados, como en index.html), y compara las dos series: pose, lecturas de línea y de sonar,
   ángulo de la cabeza y de la garra, colisiones y cajas movidas, cada 0,25 s. Es una comparación sobre ESTOS programas y pistas: NO demuestra equivalencia exacta en todo
   el comportamiento. Sin la ruta del árbol base, se omite con código 0. */
'use strict';
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');

const TRACKS=['s01','s02','s03','s04','s05','s06','s07','s08','oval','ocho'];
const PROGRAM=`void setup(){inicializarMovimiento();inicializarSensores();inicializarGolpe();inicializarCabeza();moverServoGolpe(-1);}
int k=0;int a=90;int ult=0;
void loop(){
 bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();
 if(i&&c&&d){avanzar(20);} else if(i){avanzar(8,26);ult=-1;} else if(d){avanzar(26,8);ult=1;} else if(c){avanzar(24);} else if(ult<0){avanzar(-8,22);} else {avanzar(22,-8);}
 k=k+1;
 if(k%150==0){a=a+30;if(a>180){a=0;}moverServoYaw(a);}
 if(k%400==0){moverServoGolpe(1);}
 if(k%400==200){moverServoGolpe(-1);}
 pausa(5);}`;

if(process.argv[2]==='--emit'){
  const root=process.argv[3];const withFirvi=process.argv[4]==='firvi';
  const {load}=require(path.join(root,'tests','sim1','harness.cjs'));
  const out={};
  for(const id of TRACKS){
    const h=load(withFirvi?{extraFiles:['line-geometry.js','firvi-2025.js','firvi-competition.js','firvi-scoring.js']}:{});
    h.js(`changeTrack('${id}')`);h.el('src').value=PROGRAM;h.js('start()');
    const rows=[];
    for(let t=0;t<120*40;t++){
      h.js('update(1/120)');
      if(t%30===0){
        const r=n=>Math.round(n*1000)/1000;
        rows.push([r(h.js('R.x')),r(h.js('R.y')),r(h.js('R.th')),h.js('readSonarDistance()'),[0,1,2].map(k=>h.js(`readLine(${k})`)).join('/'),r(h.js('striker.angle')),r(h.js('HEAD_SONAR.state.angle')),h.js('collisionCount'),h.js('movedCount'),h.js('mode')].join(','));
      }
    }
    out[id]={rows,sha:crypto.createHash('sha256').update(rows.join('\n')).digest('hex').slice(0,16)};
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const base=process.argv[2];
if(!base){console.log('OMITIDA · indique la ruta del árbol HEAD-CANVAS: node tests/compare-head-canvas.cjs ../BITIRO-Simulador-nnj');process.exit(0);}
const here=path.resolve(__dirname,'..'),baseRoot=path.resolve(base);
const emit=(root,mode)=>{const r=spawnSync(process.execPath,[__filename,'--emit',root,mode],{encoding:'utf8',maxBuffer:1<<28});if(r.status!==0)throw new Error('falló '+root+': '+(r.stderr||'').slice(0,400));return JSON.parse(r.stdout);};
const A=emit(baseRoot,'base'),B=emit(here,'firvi');
let diff=0;
for(const id of TRACKS){
  const same=A[id].sha===B[id].sha;
  let first='';
  if(!same){diff++;const n=Math.min(A[id].rows.length,B[id].rows.length);for(let i=0;i<n;i++)if(A[id].rows[i]!==B[id].rows[i]){first=` primera diferencia en t=${(i*.25).toFixed(2)} s\n    base: ${A[id].rows[i]}\n    este: ${B[id].rows[i]}`;break;}}
  console.log(`${id.padEnd(5)} ${same?'IDÉNTICA':'DIFIERE '}  base ${A[id].sha}  este ${B[id].sha}  (${A[id].rows.length} muestras)${first}`);
}
console.log(diff?`${diff} de ${TRACKS.length} pistas difieren`:`${TRACKS.length} de ${TRACKS.length} pistas idénticas en estas series (programa de sensores + cabeza + garra, 40 s)`);
process.exit(diff?1:0);
