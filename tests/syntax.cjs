/* node tests/syntax.cjs — resaltador del editor (syntax-highlight.js): puro, sin DOM.
   Criterios de color del Lab (tema bitiro-night) y reglas pedidas: la API IROH solo se colorea en llamadas reales,
   nunca dentro de comentarios ni cadenas, y el texto original no cambia jamás. */
'use strict';
const assert=require('node:assert/strict');
const S=require('../syntax-highlight.js');
const {load}=require('./sim1/harness.cjs');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const h=load();                                   // runtime real: FN es la fuente única de las funciones IROH
const FN=h.js('Object.keys(FN)');const API=new Set(FN);
const types=(src,filter)=>S.tokenize(src,API).filter(t=>t.type!=='plain'&&(!filter||filter(t))).map(t=>t.type+':'+t.text);
const only=(src,type)=>S.tokenize(src,API).filter(t=>t.type===type).map(t=>t.text);
const same=src=>S.tokenize(src,API).map(t=>t.text).join('')===src;

test('Lista de funciones IROH resaltadas = las que reconoce el intérprete (33)',()=>{
 assert.equal(FN.length,33);
 for(const n of ['inicializarSensores','inicializarMovimiento','inicializarGolpe','inicializarPantalla','avanzar','retroceder','detenerse','girarDerecha','girarIzquierda','pausa','leerLineaNormalizada','leerSensorLineaCentral','leerSensorLineaIzquierdo','leerSensorLineaDerecho','leerUmbralLinea','leerDistanciaSonar','lineaIzquierda','lineaCentral','lineaDerecha','escribirPantalla','borrarPantalla','moverServoGolpe','finPrograma','botonInicio','leerBoton'])assert.ok(API.has(n),n);
 // Nombres que NO existen en el runtime ni en la API del Lab: no se colorean.
 for(const n of ['leerLinea','leerSonar','stroke','millis'])assert.ok(!API.has(n),n+' no es una función del simulador');
 console.log('   resaltadas: '+FN.join(', '));
});
test('Una llamada real a la API va en «api»; sin paréntesis, desconocida o con typo, no',()=>{
 assert.deepEqual(only('avanzar(30);  pausa (20);\ndetenerse();','api'),['avanzar','pausa','detenerse']);
 assert.deepEqual(only('avanzar; x = avanzar + 1; avansar(5); miFuncion(1); leerSonar(); stroke(65);','api'),[]);
 assert.deepEqual(only('int pausa2 = 3; pausaX(1);','api'),[]);   // prefijos/sufijos de identificador
});
test('Comentarios y cadenas: ninguna función dentro se colorea (control negativo frente al Lab)',()=>{
 assert.deepEqual(only('// avanzar(20); inicializarSensores()\nx;','api'),[]);
 assert.deepEqual(only('/* pausa(5)\n detenerse() */ avanzar(1);','api'),['avanzar']);
 assert.deepEqual(only('escribirPantalla(0,0,"avanzar(10)"); \'pausa(1)\';','api'),['escribirPantalla']);
 assert.deepEqual(only('// c\navanzar(2); // pausa(3)','api'),['avanzar']);
 assert.deepEqual(only('"abierta avanzar(1)\navanzar(2);','api'),['avanzar']);  // cadena sin cerrar termina en el salto de línea
 assert.deepEqual(only('/* sin cerrar avanzar(1)\navanzar(2);','api'),[]);      // comentario de bloque sin cerrar llega al final
});
test('Palabras reservadas, tipos, números, operadores y cadenas (criterios del Lab)',()=>{
 assert.deepEqual(only('int float bool long void if else while true false byte for return','kw'),['int','float','bool','long','void','if','else','while','true','false','byte','for','return']);
 assert.deepEqual(only('x = 500; y = 3.5; z = 0x1F; w = 1e3; .5','num'),['500','3.5','0x1F','1e3','.5']);
 assert.deepEqual(only('a = b >= c && !d; e += 1; f < g; h, i;','op').join(''),'=>=&&!;+=;<;,;');
 assert.deepEqual(only('v1 = 7; _a2 = 3;','num'),['7','3']);                 // dígitos dentro de identificadores no son números
 assert.deepEqual(only('s = "hola \\"x\\" fin"; c = \'q\';','str'),['"hola \\"x\\" fin"',"'q'"]);
 assert.deepEqual(only('umbral variable setup loop','kw'),[]);                  // variables y setup/loop: texto normal
});
test('Directivas: #include como palabra reservada y la ruta como cadena',()=>{
 assert.deepEqual(types('#include <KnightRoboticsLibs_Iroh.h>\n'),['kw:#include','kw:<','str:KnightRoboticsLibs_Iroh.h','kw:>']);
 assert.deepEqual(types('  #define N 3\n'),['kw:#define','num:3']);
 assert.deepEqual(types('x = 1; # no es directiva').filter(t=>t.startsWith('kw')),[]);
});
test('Paréntesis por profundidad (dorado, orquídea, azul) y cierre inesperado',()=>{
 assert.deepEqual(S.tokenize('( [ { } ] )',API).filter(t=>/^b/.test(t.type)).map(t=>t.type+t.text),['b1(','b2[','b3{','b3}','b2]','b1)']);
 assert.equal(S.tokenize('((((x))))',API).filter(t=>/^b/.test(t.type)).map(t=>t.type[1]).join(''),'12311321');   // el ciclo de 3 colores vuelve a dorado en la 4.ª profundidad
 assert.deepEqual(S.tokenize(') x',API)[0],{type:'bx',text:')'});
 assert.deepEqual(S.tokenize('(// )\n)',API).filter(t=>/^b/.test(t.type)).map(t=>t.type),['b1','b1']);   // los paréntesis en comentarios no cuentan
});
test('El texto nunca cambia: tokenizar y volver a unir devuelve la entrada (casos y fuzz determinista)',()=>{
 for(const src of ['','\n','   ','void setup(){}','// x','/* x','"x','#','#include','#include <','a<b>c','áñ "é"','\r\nx\r\n','int\tx;\t//c'])assert.ok(same(src),JSON.stringify(src));
 let seed=12345;const rnd=n=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed%n;};
 const alphabet=['avanzar','pausa','(',')','{','}','[',']','"',"'",'//','/*','*/','#include','<','>','\n',' ','\t','int','x','1','2.5','=',';',',','&&','!','\\','é','&','<b>'];
 for(let k=0;k<400;k++){let s='';const len=rnd(40);for(let i=0;i<len;i++)s+=alphabet[rnd(alphabet.length)];assert.ok(same(s),JSON.stringify(s));}
});
test('HTML: escapa &, < y > y su texto visible es exactamente la entrada; solo clases (CSP, sin style)',()=>{
 const src='if (a < b && c > d) { x = "<b>&amp;</b>"; } // <script>';
 const html=S.highlight(src,API);
 assert.ok(!/<script|style=|on[a-z]+=/i.test(html));assert.ok(!html.includes('<b>'));
 const text=html.replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');assert.equal(text,src);
 assert.deepEqual([...new Set([...html.matchAll(/class="([^"]+)"/g)].map(m=>m[1]))].sort(),['t-b1','t-com','t-kw','t-num','t-op','t-str'].filter(c=>html.includes('class="'+c+'"')).sort());
});
test('Ejemplos del editor: todos resaltan sin perder texto y sin funciones dentro de comentarios',()=>{
 for(let i=0;i<5;i++){const code=h.js(`EJ[${i}]`);assert.ok(same(code),'EJ['+i+']');
  for(const t of S.tokenize(code,API))if(t.type==='com')assert.ok(!S.tokenize(t.text,API).some(x=>x.type==='api'));
  if(i!==2)assert.ok(only(code,'api').length>0,'EJ['+i+'] debe tener llamadas IROH');}
});
test('Determinista y rápido: 3000 líneas en menos de 400 ms',()=>{
 const src=Array.from({length:3000},(_,i)=>`  if (x${i} >= ${i}) { avanzar(${i%100}); } // c ${i}`).join('\n');
 const t0=process.hrtime.bigint();const a=S.highlight(src,API);const ms=Number(process.hrtime.bigint()-t0)/1e6;
 assert.equal(a,S.highlight(src,API));assert.ok(ms<400,ms+' ms');console.log('   3000 líneas: '+ms.toFixed(0)+' ms');
});
console.log(`\n${checks} comprobaciones del resaltador superadas.`);
