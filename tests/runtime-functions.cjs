/* node tests/runtime-functions.cjs — RUNTIME-FUNCTIONS-1: funciones propias del estudiante (void / int / float / long / bool / byte,
   parámetros por valor, return, llamadas en expresiones, pausa() y botonInicio() dentro de funciones).
   Todo se comprueba ejecutando el intérprete real (generadores cooperativos gobernados por update()), no leyendo el código fuente.
   Límite de llamadas anidadas: 64 (MAX_CALL_DEPTH). */
'use strict';
const assert=require('node:assert/strict');
const {load}=require('./sim1/harness.cjs');
let checks=0;const test=(n,f)=>{f();checks++;console.log('OK · '+n);};
const plain=h=>String(h.el('msg').innerHTML).replace(/<[^>]+>/g,'');
const G=(h,n)=>h.js(`scopes[0].${n}`);
function sim(code,ms=200,id='s01'){
 const h=load();h.js(`changeTrack('${id}')`);h.program(code);h.tick(Math.ceil(ms*0.12));return h;   // ms de tiempo simulado (120 ticks/s)
}
const ok=(h)=>{assert.ok(!/✖/.test(plain(h)),plain(h));};
const err=(code,re,ms=200)=>{const h=sim(code,ms);assert.match(plain(h),re,plain(h));return h;};
const W='void setup(){}';

// ── sintaxis y retorno ─────────────────────────────────────────────────────────
test('1. void f() sin parámetros',()=>{const h=sim(`int a=0;void f(){a=7;}${W}void loop(){f();finPrograma();}`);ok(h);assert.equal(G(h,'a'),7);});
test('2. void f(int)',()=>{const h=sim(`int a=0;void f(int x){a=x+1;}${W}void loop(){f(4);finPrograma();}`);ok(h);assert.equal(G(h,'a'),5);});
test('3. int f()',()=>{const h=sim(`int a=0;int f(){return 9;}${W}void loop(){a=f();finPrograma();}`);ok(h);assert.equal(G(h,'a'),9);});
test('4. int f(int)',()=>{const h=sim(`int a=0;int f(int x){return x*2;}${W}void loop(){a=f(21);finPrograma();}`);ok(h);assert.equal(G(h,'a'),42);});
test('5. dos parámetros',()=>{const h=sim(`int a=0;int suma(int a,int b){return a+b;}${W}void loop(){a=suma(2,3);finPrograma();}`);ok(h);assert.equal(G(h,'a'),5);});
test('6. retorno float (y la división usa tipo float)',()=>{const h=sim(`float a=0;float b=0;float f(){return 2.5;}${W}void loop(){a=f();b=f()/2;finPrograma();}`);ok(h);assert.equal(G(h,'a'),2.5);assert.equal(G(h,'b'),1.25);});
test('7. retorno bool 7→1, int 3.9→3, long truncado, byte módulo 256',()=>{
 const h=sim(`int i=0;int b=0;long l=0;int y=0;int fi(){return 3.9;}bool fb(){return 7;}long fl(){return 123456.8;}byte fy(){return 300;}${W}void loop(){i=fi();b=fb();l=fl();y=fy();finPrograma();}`);
 ok(h);assert.equal(G(h,'i'),3);assert.equal(G(h,'b'),1);assert.equal(G(h,'l'),123456);assert.equal(G(h,'y'),44);});
test('8. parámetros tipados: float conserva decimales, int los trunca, bool normaliza',()=>{
 const h=sim(`float f=0;int i=0;int b=0;void p(float x,int y,bool z){f=x;i=y;b=z;}${W}void loop(){p(1.5,2.9,5);finPrograma();}`);
 ok(h);assert.equal(G(h,'f'),1.5);assert.equal(G(h,'i'),2);assert.equal(G(h,'b'),1);});
test('9. los parámetros se pasan por valor',()=>{const h=sim(`int a=5;void cambiar(int x){x=100;}${W}void loop(){cambiar(a);finPrograma();}`);ok(h);assert.equal(G(h,'a'),5);});

// ── scopes ─────────────────────────────────────────────────────────────────────
test('10. la función lee una global',()=>{const h=sim(`int g=11;int r=0;int f(){return g+1;}${W}void loop(){r=f();finPrograma();}`);ok(h);assert.equal(G(h,'r'),12);});
test('11. la función modifica una global',()=>{const h=sim(`int c=0;void sumar(){c+=1;}${W}void loop(){sumar();sumar();sumar();finPrograma();}`);ok(h);assert.equal(G(h,'c'),3);});
test('12. variable local de función (no queda visible fuera)',()=>{
 const h=sim(`int r=0;void f(){int t=4;r=t;}${W}void loop(){f();finPrograma();}`);ok(h);assert.equal(G(h,'r'),4);assert.equal(h.js('"t" in scopes[0]'),false);
 err(`void f(){int t=4;}${W}void loop(){f();t=1;}`,/«t» no está declarada/);});
test('13. una local sombrea una global sin modificarla',()=>{const h=sim(`int n=10;int r=0;void prueba(){int n=3;r=n;}${W}void loop(){prueba();finPrograma();}`);ok(h);assert.equal(G(h,'n'),10);assert.equal(G(h,'r'),3);});
test('13b. los locales del llamador no son visibles dentro de la función',()=>{err(`void f(){int z=x;}${W}void loop(){int x=1;f();}`,/«x» no está declarada/);});
test('13c. cada llamada tiene sus propios locales (no se arrastran entre llamadas)',()=>{
 const h=sim(`int a=0;int b=0;int f(int x){int t=x;t+=1;return t;}${W}void loop(){a=f(1);b=f(10);finPrograma();}`);ok(h);assert.equal(G(h,'a'),2);assert.equal(G(h,'b'),11);});

// ── orden de declaración ───────────────────────────────────────────────────────
test('14. función declarada después de loop()',()=>{const h=sim(`int a=0;${W}void loop(){a=triple(3);finPrograma();}int triple(int x){return x*3;}`);ok(h);assert.equal(G(h,'a'),9);});
test('14b. función declarada antes de setup() y de loop()',()=>{const h=sim(`int a=0;void helper(){a=5;}void setup(){helper();}void loop(){finPrograma();}`);ok(h);assert.equal(G(h,'a'),5);});
test('15. una función llama a otra (aunque esté declarada después)',()=>{const h=sim(`int a=0;void f(){g();}void g(){a=8;}${W}void loop(){f();finPrograma();}`);ok(h);assert.equal(G(h,'a'),8);});
test('16. llamada como expresión: inicializador, condición de if, aritmética y argumento',()=>{
 const k=sim(`int a=0;int b=0;int c=0;int d(){return 5;}void setup(){inicializarMovimiento();}void loop(){int x=d();if(d()<8){a=1;}b=x;c=d()+d()*2;avanzar(d());finPrograma();}`);
 ok(k);assert.equal(G(k,'a'),1);assert.equal(G(k,'b'),5);assert.equal(G(k,'c'),15);});
test('17. llamadas anidadas en expresión: f(g(2))',()=>{const h=sim(`int a=0;int doble(int x){return x*2;}int cuatro(int x){return doble(doble(x));}${W}void loop(){a=cuatro(3)+doble(doble(1));finPrograma();}`);ok(h);assert.equal(G(h,'a'),16);});
test('17b. avanzar(velocidad(leerDistanciaSonar())) del enunciado',()=>{
 const h=sim(`int velocidad(int distancia){if(distancia<8){return 0;}if(distancia<=12){return 20;}return 40;}void setup(){inicializarMovimiento();inicializarSensores();}void loop(){int d=leerDistanciaSonar();int v=velocidad(d);avanzar(v);}`,300);
 ok(h);assert.equal(h.js('R.L'),40);assert.equal(h.js('R.R'),40);});

// ── return ─────────────────────────────────────────────────────────────────────
test('18. return temprano dentro de if (solo sale de la función)',()=>{
 const h=sim(`int a=0;int b=0;int c=0;int signo(int x){if(x<0){return -1;}if(x>0){return 1;}return 0;}${W}void loop(){a=signo(-5);b=signo(7);c=signo(0);finPrograma();}`);
 ok(h);assert.equal(G(h,'a'),-1);assert.equal(G(h,'b'),1);assert.equal(G(h,'c'),0);});
test('19. return dentro de while',()=>{
 const h=sim(`int r=0;int busca(int n){int i=0;while(i<100){i++;if(i==n){return i*10;}}return -1;}${W}void loop(){r=busca(4);finPrograma();}`,300);
 ok(h);assert.equal(G(h,'r'),40);});
test('20. return; en void sale de la función pero no del programa',()=>{
 const h=sim(`int a=0;int b=0;void f(int x){if(x>0){return;}a=99;}${W}void loop(){f(1);b=1;f(0);finPrograma();}`);
 ok(h);assert.equal(G(h,'a'),99,'f(0) llegó al final');assert.equal(G(h,'b'),1,'tras return; loop() continuó');});
test('20b. return; dentro de loop() termina solo esa iteración; return no ejecuta lo posterior',()=>{
 const h=sim(`int n=0;int z=0;void setup(){}void loop(){n++;if(n>=3){return;}z++;}`,500);ok(h);assert.equal(G(h,'z'),2);assert.ok(G(h,'n')>3);});
test('20c. return dentro de bloques anidados {} sale de la función',()=>{
 const h=sim(`int r=0;int f(){{if(1){while(1){return 6;}}}return 0;}${W}void loop(){r=f();finPrograma();}`);ok(h);assert.equal(G(h,'r'),6);});
test('21. void con return valor → error',()=>{err(`void f(){return 3;}${W}void loop(){f();}`,/void no devuelve valor/);});
test('22. función con valor y return vacío → error',()=>{err(`int f(){return;}${W}void loop(){f();}`,/«f\(\)» necesita un valor/);});
test('23. función no-void que termina sin return → error de ejecución claro',()=>{
 const h=err(`int velocidad(int d){if(d<8){return 0;}}${W}void loop(){int v=velocidad(50);}`,/La función «velocidad\(\)» terminó sin devolver un valor\./);assert.equal(h.js('running'),0);assert.equal(h.js('scopes.length'),1,'los scopes locales desaparecieron');});
test('24. return fuera de función → error',()=>{err('return 5;',/«return» solo se puede usar dentro de una función/);});

// ── resolución de llamadas y nombres ───────────────────────────────────────────
test('25. aridad incorrecta',()=>{err(`void girar(int v){}${W}void loop(){girar();}`,/«girar\(\)» necesita 1 valor y recibió 0\./);err(`int s(int a,int b){return a;}${W}void loop(){int x=s(1);}`,/«s\(\)» necesita 2 valores y recibió 1\./);});
test('26. función desconocida (con sugerencia a propias y del robot)',()=>{
 err(`void girar(int v){}${W}void loop(){girra(3);}`,/No conozco la función «girra\(\)»\. ¿Quisiste escribir «girar\(\)»\?/);
 err(`${W}void loop(){avansar(3);}`,/¿Quisiste escribir «avanzar\(\)»\?/);});
test('27. el nombre colisiona con una función del robot / setup / loop',()=>{
 err(`void avanzar(int v){}${W}void loop(){}`,/«avanzar» ya es una función del robot/);
 err(`void pausa(){}${W}void loop(){}`,/«pausa» ya es una función del robot/);
 err(`int setup(){return 1;}void loop(){}`,/«setup\(\)» debe ser «void setup\(\)» y no recibe parámetros/);
 err(`void loop(int x){}${W}`,/«loop\(\)» debe ser «void loop\(\)»/);
 err(`void setup(){}void setup(){}void loop(){}`,/«setup\(\)» ya está declarada/);});
test('28. función duplicada',()=>{err(`void f(){}void f(int x){}${W}void loop(){}`,/La función «f\(\)» ya está declarada \(línea 1\)/);});
test('29. parámetro duplicado',()=>{err(`void f(int a,int a){}${W}void loop(){}`,/El parámetro «a» está repetido en «f\(\)»/);});
test('29b. función con el nombre de una variable global; parámetro sin tipo; prototipo',()=>{
 err(`int x=1;void x(){}${W}void loop(){}`,/«x» ya es una variable global/);
 err(`void f(a){}${W}void loop(){}`,/Cada parámetro necesita un tipo/);
 err(`void f();${W}void loop(){}`,/No hace falta declarar «f\(\)» antes/);});
test('12b. una función void no puede usarse como valor; sí como sentencia',()=>{
 err(`void seguir(){}${W}void loop(){int x=seguir();}`,/«seguir\(\)» es una función void/);
 err(`void seguir(){}${W}void loop(){avanzar(seguir());}`,/es una función void/);
 ok(sim(`void seguir(){}${W}void loop(){seguir();finPrograma();}`));});
test('29c. variable no declarada dentro de una función se detecta antes de ejecutar',()=>{const h=err(`void f(){q=1;}${W}void loop(){f();}`,/«q» no está declarada/);assert.equal(h.js('running'),0);});

// ── pausa() y botonInicio() cooperativos dentro de funciones ──────────────────
test('30. pausa() dentro de una función suspende exactamente allí y reanuda desde allí',()=>{
 const h=sim(`int a=0;int b=0;void baile(){a=1;pausa(500);b=1;}void setup(){inicializarMovimiento();}void loop(){baile();finPrograma();}`,0);
 h.tick(30);assert.equal(G(h,'a'),1);assert.equal(G(h,'b'),0,'aún en pausa');
 h.tick(20);assert.equal(G(h,'b'),0,'~0,42 s: sigue');h.tick(30);assert.equal(G(h,'b'),1,'tras 0,5 s reanuda y no re-ejecuta desde el inicio');});
test('30b. enunciado: avanzar(30); pausa(500); detenerse(); dentro de baile()',()=>{
 const h=sim(`void baile(){avanzar(30);pausa(500);detenerse();}void setup(){inicializarMovimiento();}void loop(){baile();finPrograma();}`,0);
 h.tick(30);assert.equal(h.js('R.L'),30);h.tick(60);h.tick(20);assert.equal(h.js('R.L'),0);assert.equal(h.js('running'),0);});
test('31. pausa() dentro de una función anidada conserva el stack',()=>{
 const h=sim(`int t=0;void a(){t=1;b();t=3;}void b(){pausa(100);t=2;pausa(100);}void setup(){}void loop(){a();finPrograma();}`,0);
 h.tick(5);assert.equal(G(h,'t'),1);h.tick(15);assert.equal(G(h,'t'),2);h.tick(15);assert.equal(G(h,'t'),3);});
test('32. función con pausa + return: el valor llega tras la pausa',()=>{
 const h=sim(`int r=0;int medirDespues(){pausa(500);return leerDistanciaSonar();}void setup(){inicializarSensores();}void loop(){r=medirDespues();finPrograma();}`,0);
 h.tick(30);assert.equal(G(h,'r'),0,'todavía no volvió');assert.equal(h.js('running'),1);h.tick(40);h.tick(30);assert.equal(G(h,'r'),18);assert.equal(h.js('running'),0);});
test('32b. expresión → función → pausa → return (dos llamadas en una misma expresión, izquierda→derecha)',()=>{
 const h=sim(`int r=0;int n=0;int f(){pausa(100);n=n*10+1;return n;}int g(){pausa(100);n=n*10+2;return n;}void setup(){}void loop(){r=f()+g();finPrograma();}`,0);
 h.tick(60);assert.equal(G(h,'n'),12,'f() corrió antes que g()');assert.equal(G(h,'r'),13);});
const press=h=>h.el('pulsador').events.click();
test('33. botonInicio() dentro de una función (llamada desde setup)',()=>{
 const h=sim(`int a=0;void esperarUsuario(){botonInicio();}void setup(){inicializarMovimiento();a=1;esperarUsuario();a=2;}void loop(){pausa(10);}`,500);
 ok(h);assert.equal(G(h,'a'),1);assert.equal(h.js('waitingButton'),1);assert.equal(h.js('btn'),0);
 press(h);h.tick(60);assert.equal(G(h,'a'),2,'volvió de botonInicio y de la función');assert.equal(h.js('waitingButton'),0);assert.equal(h.js('btn'),1,'no consume el Pulsador (nivel)');});
test('34. botonInicio() en función anidada',()=>{
 const h=sim(`int a=0;void p(){botonInicio();a=a+10;}void q(){a=1;p();a=a+100;}void setup(){q();}void loop(){pausa(10);}`,500);
 assert.equal(G(h,'a'),1);assert.equal(h.js('waitingButton'),1);press(h);h.tick(60);assert.equal(G(h,'a'),111);});
test('34b. la espera dentro de una función se refleja en el estado visible',()=>{
 const h=sim(`void arrancar(){botonInicio();avanzar(30);}void setup(){inicializarMovimiento();arrancar();}void loop(){}`,0);
 h.tick(60);h.js('frame(16)');h.js('frame(40)');assert.equal(h.el('statusBadge').textContent,'ESPERANDO PULSADOR');assert.equal(h.js('R.L'),0);
 press(h);h.tick(40);assert.equal(h.js('R.L'),30);assert.equal(h.js('R.R'),30);});
test('35. Reiniciar cancela la espera que ocurre dentro de una función',()=>{
 const h=sim(`int a=0;void e(){botonInicio();a=2;}void setup(){e();}void loop(){}`,300);
 assert.equal(h.js('waitingButton'),1);h.el('reset').events.click();
 assert.equal(h.js('waitingButton'),0);assert.equal(h.js('running'),0);assert.equal(h.js('it'),null);h.tick(60);assert.equal(h.js('R.L')+h.js('R.R'),0);});

// ── finPrograma(), cortocircuito, orden, recursión ────────────────────────────
test('36. finPrograma() dentro de una función detiene todo el programa',()=>{
 const h=sim(`int a=0;int b=0;void terminar(){finPrograma();a=1;}int f(){terminar();b=1;return 1;}void setup(){}void loop(){int x=f();a=5;avanzar(30);}`,300);
 ok(h);assert.equal(h.js('running'),0);assert.equal(G(h,'a'),0,'nada posterior a finPrograma()');assert.equal(G(h,'b'),0);assert.equal(h.js('R.L'),0);assert.equal(h.js('scopes.length'),1);});
test('36b. return NO equivale a finPrograma(): el programa sigue ejecutándose',()=>{
 const h=sim(`int n=0;void f(){return;}void setup(){}void loop(){f();n++;}`,200);assert.ok(G(h,'n')>1);assert.equal(h.js('running'),1);});
test('37. && mantiene el cortocircuito (f() no se llama si el izquierdo es 0)',()=>{
 const h=sim(`int n=0;int r=7;int f(){n++;return 1;}${W}void loop(){r=0&&f();finPrograma();}`);ok(h);assert.equal(G(h,'n'),0);assert.equal(G(h,'r'),0);
 const k=sim(`int n=0;int r=0;int f(){n++;return 1;}${W}void loop(){r=1&&f();finPrograma();}`);assert.equal(G(k,'n'),1);assert.equal(G(k,'r'),1);});
test('38. || mantiene el cortocircuito',()=>{
 const h=sim(`int n=0;int r=0;int f(){n++;return 0;}${W}void loop(){r=1||f();finPrograma();}`);assert.equal(G(h,'n'),0);assert.equal(G(h,'r'),1);
 const k=sim(`int n=0;int r=9;int f(){n++;return 0;}${W}void loop(){r=0||f();finPrograma();}`);assert.equal(G(k,'n'),1);assert.equal(G(k,'r'),0);});
test('39. orden de evaluación izquierda→derecha (con globales)',()=>{
 const h=sim(`int t=0;int r=0;int a(){t=t*10+1;return t;}int b(){t=t*10+2;return t;}${W}void loop(){r=a()-b();finPrograma();}`);ok(h);assert.equal(G(h,'t'),12);assert.equal(G(h,'r'),1-12);
 const k=sim(`int t=0;int r=0;int a(int x){t=t*10+x;return x;}${W}void loop(){r=a(1)+a(2)*a(3);finPrograma();}`);assert.equal(G(k,'t'),123);assert.equal(G(k,'r'),7);});
test('40. recursión sin fin: límite determinista de 64 llamadas y error amigable',()=>{
 const h=err(`void f(){f();}${W}void loop(){f();}`,/Demasiadas llamadas anidadas; revisa si una función se está llamando a sí misma sin terminar\./,100);
 assert.equal(h.js('running'),0);assert.equal(h.js('scopes.length'),1);assert.equal(h.js('callDepth'),0,'la pila quedó limpia');
 assert.equal(h.js('MAX_CALL_DEPTH'),64);});
test('40b. recursión finita dentro del límite funciona (fact(5)); 63 anidadas sí, 70 no',()=>{
 const h=sim(`int r=0;int fact(int n){if(n<=1){return 1;}return n*fact(n-1);}${W}void loop(){r=fact(5);finPrograma();}`);ok(h);assert.equal(G(h,'r'),120);
 const ok63=sim(`int r=0;int d(int n){if(n==0){return 0;}return 1+d(n-1);}${W}void loop(){r=d(62);finPrograma();}`);ok(ok63);assert.equal(G(ok63,'r'),62);
 err(`int r=0;int d(int n){if(n==0){return 0;}return 1+d(n-1);}${W}void loop(){r=d(70);}`,/Demasiadas llamadas anidadas/);});
test('40c. un error de ejecución dentro de una función restaura los scopes',()=>{
 const h=err(`int f(int x){return 10/x;}${W}void loop(){int a=f(0);}`,/No se puede dividir por cero/);assert.equal(h.js('scopes.length'),1);assert.equal(h.js('callDepth'),0);});
test('40d. dos programas seguidos no comparten funciones ni profundidad',()=>{
 const h=sim(`int a=0;int f(){return 1;}${W}void loop(){a=f();finPrograma();}`);assert.equal(G(h,'a'),1);
 h.program(`int a=0;${W}void loop(){a=f();}`);assert.match(plain(h),/No conozco la función «f\(\)»/);});

// ── API existente intacta + patrones curriculares literales ───────────────────
test('41. API del robot, mensajes y while siguen igual (sin funciones propias)',()=>{
 const h=sim(`int a=0;void setup(){inicializarMovimiento();}void loop(){while(a<3){a++;}avanzar(30);}`);ok(h);assert.equal(G(h,'a'),3);assert.equal(h.js('R.L'),30);
 err(`void setup(){}void loop(){avansar(3);}`,/¿Quisiste escribir «avanzar\(\)»\?/);
 err(`void setup(){}void loop(){for(;;){}}`,/«for» no está disponible/);});
test('41b. el parser ya no limita las funciones a setup/loop, pero conserva sus otros errores',()=>{
 err(`void setup(){}`,/Falta la función void loop\(\)/);
 err(`int x=1;x=2;void loop(){}`,/Fuera de las funciones solo puedes declarar variables/);
 err(`void`,/Falta el nombre después de void/);});
test('S04 literal: baile() con avanzar(100); pausa(500); detenerse()',()=>{
 const h=sim(`void baile() {\n  avanzar(100);\n  pausa(500);\n  detenerse();\n}\n\nvoid setup() {\n  inicializarMovimiento();\n}\n\nvoid loop() {\n  baile();\n  finPrograma();\n}`,0);
 ok(h);h.tick(30);assert.equal(h.js('R.L'),100);h.tick(60);h.tick(20);assert.equal(h.js('R.L'),0);assert.equal(h.js('running'),0);
 const v=sim(`void leerSensores() {\n  int izq = leerSensorLineaIzquierdo();\n  int centro = leerSensorLineaCentral();\n  int der = leerSensorLineaDerecho();\n}\nvoid setup(){inicializarSensores();}\nvoid loop(){leerSensores();}`);ok(v);});
test('S06 literal: velocidad(distancia) y seguidor(sensor, vel, umbral)',()=>{
 const code=`int velocidad(int distancia) {\n  if (distancia < 8) {\n    return 0;\n  }\n\n  if (distancia <= 12) {\n    return 20;\n  }\n\n  return 40;\n}\n\nvoid seguidor(int sensor, int vel, int umbral) {\n  if (sensor >= umbral) {\n    avanzar(vel);\n  } else {\n    girarDerecha(vel);\n  }\n}\n\nvoid setup() {\n  inicializarMovimiento();\n  inicializarSensores();\n}\n\nvoid loop() {\n  int d = leerDistanciaSonar();\n  seguidor(leerSensorLineaCentral(), velocidad(d), 500);\n}`;
 const h=sim(code,300);ok(h);assert.equal(h.js('R.L'),40,'sobre la línea central con sonar libre: avanzar(40)');assert.equal(h.js('R.R'),40);
 for(const [d,v] of [[5,0],[8,20],[12,20],[13,40],[200,40]]){const k=sim(`int r=0;int velocidad(int distancia){if(distancia<8){return 0;}if(distancia<=12){return 20;}return 40;}${W}void loop(){r=velocidad(${d});finPrograma();}`);assert.equal(G(k,'r'),v,'d='+d);}});
test('S08/S01 con funciones: el seguidor de 3 sensores en una función recorre la línea igual que inline',()=>{
 const inline=`void setup(){inicializarMovimiento();inicializarSensores();}void loop(){bool i=lineaIzquierda();bool c=lineaCentral();bool d=lineaDerecha();if(c){avanzar(30);}else if(i){avanzar(10,30);}else if(d){avanzar(30,10);}else{avanzar(20);}}`;
 const fn=`void seguir(bool i,bool c,bool d){if(c){avanzar(30);}else if(i){avanzar(10,30);}else if(d){avanzar(30,10);}else{avanzar(20);}}void setup(){inicializarMovimiento();inicializarSensores();}void loop(){seguir(lineaIzquierda(),lineaCentral(),lineaDerecha());}`;
 const a=sim(inline,4000,'s02'),b=sim(fn,4000,'s02');
 assert.equal(a.js('R.x'),b.js('R.x'));assert.equal(a.js('R.y'),b.js('R.y'));assert.equal(a.js('R.th'),b.js('R.th'));});

test('42. tipado de builtins: las void sirven como sentencia y se rechazan como valor; las de lectura devuelven número',()=>{
 ok(sim(`void setup(){inicializarMovimiento();inicializarPantalla();}void loop(){avanzar(30);pausa(100);detenerse();borrarPantalla();finPrograma();}`));
 ok(sim(`void setup(){botonInicio();}void loop(){finPrograma();}`));
 err(`int x=0;${W}void loop(){x=pausa(500);}`,/«pausa\(\)» es una función void: no devuelve ningún valor y no puede usarse dentro de una expresión\./);
 err(`${W}void loop(){int x=pausa(500);}`,/«pausa\(\)» es una función void/);
 err(`${W}void loop(){int y=botonInicio();}`,/«botonInicio\(\)» es una función void/);
 err(`${W}void loop(){int z=avanzar(30);}`,/«avanzar\(\)» es una función void/);
 err(`${W}void loop(){avanzar(pausa(5));}`,/«pausa\(\)» es una función void/);
 err(`${W}void loop(){if(detenerse()){}}`,/«detenerse\(\)» es una función void/);
 for(const n of ['avanzar','retroceder','girarDerecha','girarIzquierda','detenerse','pausa','finPrograma','botonInicio','escribirPantalla','borrarPantalla','apagarPantalla','prenderPantalla','inicializarMovimiento','inicializarSensores','inicializarCabeza','inicializarGolpe','inicializarPantalla','apagarCabeza','moverServoYaw','moverServoPitch','moverServoGolpe']){
  const args={avanzar:'1',retroceder:'1',girarDerecha:'1',girarIzquierda:'1',pausa:'1',escribirPantalla:'0,0,1',moverServoYaw:'1',moverServoPitch:'1',moverServoGolpe:'1'}[n]||'';
  err(`${W}void loop(){int v=${n}(${args});}`,new RegExp('«'+n+'\\(\\)» es una función void'));}
 const h=sim(`int a=0;int b=0;int c=0;int d=0;int e=0;int f=0;void setup(){inicializarSensores();}void loop(){a=leerBoton();b=leerDistanciaSonar();c=leerSensorLineaCentral();d=leerLineaNormalizada(1);e=leerSensorObstaculoIzquierdo()+leerUmbralLinea();f=lineaCentral()+lineaIzquierda()+lineaDerecha()+leerSensorLineaIzquierdo()+leerSensorLineaDerecho()+leerSensorObstaculoDerecho();finPrograma();}`);
 ok(h);assert.equal(G(h,'a'),0);assert.equal(G(h,'b'),18);assert.equal(G(h,'c'),865);assert.equal(G(h,'e'),500);
 err(`void seguir(){}${W}void loop(){int x=seguir();}`,/«seguir\(\)» es una función void: no devuelve ningún valor y no puede usarse dentro de una expresión\./);});
test('42b. pausa() y botonInicio() como sentencias dentro de funciones propias siguen propagando el yield',()=>{
 const h=sim(`int t=0;void p(){t=1;pausa(100);t=2;botonInicio();t=3;}void setup(){p();}void loop(){pausa(10);}`,0);
 h.tick(5);assert.equal(G(h,'t'),1);h.tick(15);assert.equal(G(h,'t'),2);assert.equal(h.js('waitingButton'),1);h.el('pulsador').events.click();h.tick(10);assert.equal(G(h,'t'),3);});

console.log(`\n${checks} comprobaciones RUNTIME-FUNCTIONS-1 superadas.`);
