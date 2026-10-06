/* BITIRO Simulador · código inicial de cada pista y migración del código guardado en el navegador.
   - S01–S08 empiezan con un starter propio (estructura mínima, sin la solución de la sesión). Los ejemplos completos
     solo existen en las pistas de práctica libre (Óvalo y Ocho).
   - Migración (sin borrar nada del alumno): si no hay código guardado, o si el código guardado es EXACTAMENTE uno de los
     cinco ejemplos que la versión anterior cargaba por defecto, se muestra el starter; si difiere en un solo carácter, se
     conserva íntegro. Las pistas libres no se migran. Módulo puro (sin DOM ni almacenamiento). */
'use strict';
(()=>{
 const FREE=Object.freeze(['oval','ocho']);
 // Títulos de las pistas (los mismos nombres que muestra el selector; no describen la solución).
 const TITLES=Object.freeze({s01:'S01 · Seguir línea y mover obstáculo',s02:'S02 · Tres sensores y elección de base',s03:'S03 · Conteo de obstáculos e intersecciones',s04:'S04 · Tramos y espacios de línea',s05:'S05 · Sensores IR y elección de ruta',s06:'S06 · Sonar, cajas y velocidad',s07:'S07 · Repaso · sin pista propia',s08:'S08 · Clasificación y desafío final'});
 // Inicializaciones que el starter del Lab incluye en cada sesión (S04 no usa la LCD).
 const INITS=Object.freeze({s04:['inicializarMovimiento','inicializarSensores']});
 const DEFAULT_INITS=Object.freeze(['inicializarMovimiento','inicializarSensores','inicializarPantalla']);
 // Los cinco ejemplos que el simulador v4 entregaba (EJ[0] por defecto) y que pudieron quedar guardados sin que el alumno los escribiera.
 const LEGACY=Object.freeze([
  "// Tres sensores: usa la calibración guardada.\n// 1 = negro; 0 = blanco. Los motores reciben izq., der.\nvoid setup() {\n  inicializarMovimiento();\n  inicializarSensores();\n  botonInicio();\n}\n\nvoid loop() {\n  bool izq = lineaIzquierda();\n  bool centro = lineaCentral();\n  bool der = lineaDerecha();\n\n  if (izq && centro && der) {\n    // Barra o cruce: conserva el rumbo.\n    avanzar(25);\n  }\n  else if (izq && !der) {\n    avanzar(12, 35);  // gira hacia la izquierda\n  }\n  else if (der && !izq) {\n    avanzar(35, 12);  // gira hacia la derecha\n  }\n  else if (centro) {\n    avanzar(35);\n  }\n  else {\n    // Sin línea: detente y revisa tu estrategia.\n    detenerse();\n  }\n}",
  "// Seguidor de línea con 1 sensor (sigue el borde)\nint umbral = leerUmbralLinea();\n\nvoid setup() {\n  inicializarMovimiento();\n  inicializarSensores();\n  botonInicio();\n}\n\nvoid loop() {\n  int sC = leerLineaNormalizada(1);\n  if (sC >= umbral) {\n    avanzar(30, 90);\n  }\n  else {\n    avanzar(90, 30);\n  }\n}",
  "void setup() {\n  inicializarMovimiento();\n  inicializarSensores();\n  botonInicio();\n}\n\nvoid loop() {\n  // ¡Escribe aquí tu programa!\n}",
  "// Sigue la línea y se detiene si un sensor IR detecta un obstáculo\nint umbral = leerUmbralLinea();\n\nvoid setup() {\n  inicializarMovimiento();\n  inicializarSensores();\n  botonInicio();\n}\n\nvoid loop() {\n  int obsI = leerSensorObstaculoIzquierdo();\n  int obsD = leerSensorObstaculoDerecho();\n  int sC = leerLineaNormalizada(1);\n\n  if (obsI == 1 || obsD == 1) {\n    detenerse();\n  }\n  else if (sC >= umbral) {\n    avanzar(30, 90);\n  }\n  else {\n    avanzar(90, 30);\n  }\n}",
  "// Golpe con sonar: acércate ANTES de accionar el servo.\n// El golpe no mueve objetos a distancia ni atraviesa cajas.\nvoid setup() {\n  inicializarMovimiento();\n  inicializarSensores();\n  inicializarGolpe();\n}\n\nvoid loop() {\n  int distancia = leerDistanciaSonar();\n  if (distancia <= 10) {\n    detenerse();\n    moverServoGolpe(65);\n    pausa(950);  // espera a que el golpe termine el barrido\n    moverServoGolpe(0);\n    pausa(900);  // regreso a posición recogida\n  }\n  else {\n    avanzar(30);\n  }\n}"
 ]);
 const isFree=id=>FREE.includes(id);
 const hasStarter=id=>Object.prototype.hasOwnProperty.call(TITLES,id);
 function starter(id){
  if(!hasStarter(id))return null;
  const inits=(INITS[id]||DEFAULT_INITS).map(n=>'  '+n+'();').join('\n');
  return '// BITIRO Simulador · '+TITLES[id]+'\n#include <KnightRoboticsLibs_Iroh.h>\n\nvoid setup() {\n'+inits+'\n}\n\nvoid loop() {\n  // Divide el desafío en tareas pequeñas.\n  // Escribe aquí tu programa.\n}\n';
 }
 const isLegacyExample=code=>LEGACY.includes(code);
 // Código que debe mostrar el editor al abrir una pista. `saved` es lo guardado en el navegador (o null); `fallback` el ejemplo por defecto de las pistas libres.
 function resolve(id,saved,fallback=''){
  const has=typeof saved==='string'&&saved!=='';
  if(isFree(id)||!hasStarter(id))return has?saved:fallback;     // práctica libre (y pistas desconocidas): no se migra
  if(!has||isLegacyExample(saved))return starter(id);              // sin código o ejemplo legacy exacto → starter
  return saved;                                                    // cualquier otro texto, aunque difiera en un carácter → íntegro
 }
 // ¿El código actual es distinto del starter? (para pedir confirmación antes de restaurar)
 const isModified=(id,code)=>hasStarter(id)&&code!==starter(id);
 const api=Object.freeze({freeTracks:FREE,isFree,hasStarter,starter,legacyExamples:LEGACY,isLegacyExample,resolve,isModified});
 if(typeof window!=='undefined')window.BITIRO_STARTERS=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
