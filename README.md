# BITIRO Simulador

Simulador web libre del robot educativo **IROH**, desarrollado como parte del ecosistema BITIRO.

**Probar en línea:** https://simulador.nulljinx.com  
**Repositorio:** https://github.com/nulljinx/BITIRO-Simulador  
**BITIRO Lab:** https://bitiro-piloto.nulljinx.com/

---

## ¿Qué es BITIRO Simulador?

BITIRO Simulador es un entorno web para **programar, observar y experimentar** con un robot IROH desde el navegador.

La idea central del proyecto es:

> **El simulador reproduce el robot y su entorno; no resuelve la actividad por el estudiante.**

Si el programa indica avanzar, el robot intenta avanzar.  
Si gira fuera de la línea, se sale de la línea.  
Si una condición está mal programada, el comportamiento también será incorrecto.

La intención es que estudiantes puedan:

**probar → observar → equivocarse → modificar → volver a intentar**

No requiere iniciar sesión ni un backend para ejecutar la simulación.

---

## Probar ahora

Abre:

**https://simulador.nulljinx.com**

Selecciona una pista, escribe o modifica el programa y pulsa **Ejecutar**.

El editor utiliza un subconjunto de sintaxis Arduino/C++ y funciones del robot IROH.

Ejemplo:

```cpp
void setup() {
    inicializarMovimiento();
    inicializarSensores();
}

void loop() {
    avanzar(30);
}

El simulador no evalúa si esa es la solución correcta de una sesión.
Ejecuta lo que está programado y permite observar el resultado.
Principio de producto
Una regla guía el desarrollo:
Las sesiones pueden configurar el mundo, pero nunca gobernar al robot.

El comportamiento de IROH debe depender únicamente de:
programa
+ física
+ sensores
+ actuadores
+ estado del entorno
+ entradas manuales

El simulador no debe decidir automáticamente:
- qué ruta es correcta;
- a qué base debe llegar el robot;
- cuándo una actividad está completada;
- qué movimiento debería realizar;
- qué código debe escribir el estudiante.
Ese acompañamiento pedagógico pertenece a BITIRO Lab.
Qué incluye actualmente
Entre las capacidades disponibles se encuentran:
- movimiento diferencial del robot;
- tres sensores de línea;
- sensor de distancia / sonar;
- entradas IR manuales;
- pulsador;
- pantalla LCD 16 × 2;
- servo de golpe;
- editor de código con resaltado de sintaxis;
- ejecución, pausa, paso y reinicio;
- vistas superior, perspectiva, seguimiento y robot;
- almacenamiento local del código por pista;
- pistas asociadas a las sesiones S01–S08;
- circuitos de práctica libre:
  - Óvalo;
  - Ocho.
El proyecto está en desarrollo activo y algunas capacidades del robot físico todavía están siendo modeladas o validadas.
Pistas y escenarios
BITIRO separa distintos conceptos para evitar mezclar la geometría oficial con los elementos de una actividad.
TRACK
Geometría física de la pista.

SCENARIO PROP
Caja, obstáculo u objeto colocado en el entorno.

DEFAULT START
Pose inicial práctica del robot al cargar una pista.

CURRICULUM
Objetivo, desafío y acompañamiento pedagógico.

La geometría de los plotters oficiales se valida directamente contra sus fuentes vectoriales para respetar:
- dimensiones físicas;
- anchos de línea;
- curvas;
- intersecciones;
- gaps;
- zonas;
- posición relativa de los elementos.
La sesión S07 es una sesión de repaso y no posee un plotter oficial propio.
Los circuitos Óvalo y Ocho son espacios de práctica libre y no representan pistas oficiales de una sesión.
Simulación libre
Elegir una pista de una sesión no obliga al robot a resolver esa sesión.
Por ejemplo:
avanzar(30);

hará que el robot intente avanzar aunque:
- se salga de la línea;
- vaya en una dirección incorrecta;
- choque;
- no cumpla el objetivo pedagógico;
- llegue a otra zona de la pista.
Eso es intencional.
BITIRO Simulador está pensado como un espacio de experimentación.
BITIRO Simulador y BITIRO Lab
Los dos proyectos cumplen funciones diferentes.
BITIRO Simulador	BITIRO Lab
Experimentación libre	Experiencia pedagógica estructurada
Programa y observa	Sesiones, actividades y acompañamiento
No entrega la solución	Puede presentar objetivos y evidencias
No evalúa automáticamente una misión	Puede contextualizar el aprendizaje
No requiere cuenta	Plataforma educativa
Motor de simulación	Contexto curricular


BITIRO Simulador puede utilizarse de forma independiente.
Entradas del robot
El simulador permite modificar entradas manuales del robot mientras se experimenta con el programa.
Actualmente incluye:
- pulsador;
- IR izquierdo;
- IR derecho.
Estas entradas forman parte del estado del robot y pueden ser consultadas desde el programa.
Ejemplo:
if (leerSensorObstaculoIzquierdo() == 1) {
    detenerse();
}

o:
if (leerBoton() == 1) {
    avanzar(30);
}

La intención es que el estudiante pueda provocar distintas condiciones y observar cómo responde su programa.
Sensores de línea
IROH dispone de tres sensores de línea:
leerSensorLineaIzquierdo();
leerSensorLineaCentral();
leerSensorLineaDerecho();

También existen funciones normalizadas utilizadas por el simulador para trabajar con calibración y detección.
Los sensores responden a la geometría real de la pista simulada.
Si existe un gap, el sensor debe leer el fondo y no una línea invisible.
Sonar
El sensor de distancia permite detectar objetos ubicados delante del robot.
leerDistanciaSonar();

La simulación actual utiliza un modelo geométrico determinista.
No pretende reproducir todos los fenómenos acústicos de un sensor ultrasónico real, pero sí permitir experimentar con distancia, detección y comportamiento del programa.
Servo de golpe
El simulador incluye física de contacto para el mecanismo de golpe del IROH.
El golpe puede interactuar con objetos del escenario cuando existe contacto físico.
No existen fuerzas a distancia: si el brazo no toca el objeto, el objeto no debe moverse.
Esta parte del simulador continúa siendo validada contra el comportamiento y la API del robot físico.
Editor
El editor permite escribir programas usando un subconjunto de Arduino/C++ y las funciones del IROH.
Incluye:
- resaltado de sintaxis;
- números de línea;
- ejecución con Ctrl + Enter;
- navegación de teclado;
- almacenamiento local del código por pista.
No es un compilador Arduino completo.
El intérprete implementa únicamente las construcciones necesarias para el entorno actual.
Ejecutar localmente
Clona el repositorio:
git clone https://github.com/nulljinx/BITIRO-Simulador.git
cd BITIRO-Simulador

El proyecto actual es una aplicación web estática.
Puedes servirla con cualquier servidor HTTP local.
Por ejemplo:
python3 -m http.server 8080

y abrir:
http://localhost:8080

No requiere:
- base de datos;
- backend;
- credenciales;
- servicios externos para ejecutar la simulación.
Arquitectura actual
La versión actual está construida con HTML, CSS y JavaScript sin dependencias externas en tiempo de ejecución.
Archivos principales:
index.html           interfaz principal
iroh-runtime.js      intérprete y API del IROH
simulator.js         ciclo y estado de simulación
strike-physics.js    física de contacto del golpe
renderer3d.js        representación visual
tracks.js            pistas base
extra-tracks.js      pistas adicionales
ui-shell.js          comportamiento de interfaz
syntax-highlight.js  resaltado del editor
tests/               pruebas deterministas y regresiones

La representación visual actual utiliza una proyección propia sobre Canvas.
No pretende ser todavía un modelo CAD exacto del robot físico.
Modelo de simulación
La simulación utiliza un paso temporal fijo y comportamiento determinista.
Esto permite que una misma ejecución, con:
mismo programa
+ mismo estado inicial
+ mismas entradas

produzca el mismo resultado.
Este comportamiento es importante tanto para pruebas como para comparar cambios del motor.
Pruebas
Con Node.js instalado puedes ejecutar las suites principales:
node tests/smoke.cjs
node tests/regression.cjs
node tests/sim1.cjs
node tests/ui-contract.cjs
node tests/ui-shell.cjs
node tests/syntax.cjs

El proyecto también contiene pruebas específicas para:
- geometría de pistas;
- física;
- sensores;
- escenarios;
- interfaz;
- comportamiento determinista;
- regresiones.
Los goldens de simulación no deben regenerarse automáticamente salvo cuando un cambio de comportamiento haya sido revisado y aprobado.
Estado del proyecto
BITIRO Simulador está en desarrollo activo.
Entre los trabajos en curso se encuentran:
- validación métrica de plotters oficiales;
- mayor fidelidad de sensores y actuadores;
- escenarios físicos configurables;
- modelado del movimiento de cabeza del IROH;
- evolución del servo de golpe;
- mejora progresiva del entorno visual 3D;
- separación entre simulación física y lógica curricular;
- mejora de la fidelidad entre el simulador y el robot físico.
Por esta razón pueden existir diferencias entre el simulador y el IROH real.
Si encuentras una, documentarla ayuda a mejorar el modelo.
Reportar problemas
Puedes abrir un Issue en este repositorio.
Idealmente incluye:
- pista utilizada;
- código ejecutado;
- pasos para reproducir;
- resultado observado;
- resultado esperado;
- navegador utilizado;
- captura o video si ayuda;
- comparación con el robot físico, si existe.
Las diferencias reproducibles entre el simulador y el IROH real son especialmente valiosas.
Documentación adicional
El repositorio contiene documentación técnica en:
LEEME.md
docs/

Parte de esa documentación describe etapas anteriores del simulador y puede quedar desactualizada durante el desarrollo.
Para la presentación general del proyecto, este README.md es la referencia principal.
Contribuciones
El repositorio es público para facilitar:
- revisión;
- pruebas;
- colaboración;
- detección de errores;
- comparación con el robot físico.
Si quieres proponer un cambio, abre primero un Issue explicando el problema o la mejora.
Esto ayuda a distinguir:
cambio de interfaz
cambio pedagógico
cambio de física
cambio de geometría
cambio de API

y evita mezclar modificaciones que deberían validarse por separado.
Licencia y materiales
El repositorio es público para facilitar revisión, prueba y colaboración.
Actualmente el repositorio no declara una licencia de software.
Que el código sea visible públicamente no implica por sí solo permiso para copiarlo, redistribuirlo o reutilizarlo fuera de lo permitido por la legislación aplicable.
Los materiales educativos, plotters, marcas, logotipos y otros recursos de terceros conservan sus respectivas autorías y condiciones de uso.
Antes de reutilizar o redistribuir partes del proyecto, revisa las licencias y derechos aplicables.
Créditos
BITIRO Simulador forma parte del proyecto BITIRO y toma como referencia el robot educativo IROH y los materiales utilizados en las experiencias ROB-002.
El objetivo es ofrecer un espacio donde aprender programación y robótica mediante experimentación:
programar, observar, ajustar y volver a probar
