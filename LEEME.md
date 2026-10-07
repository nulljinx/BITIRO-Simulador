# BITIRO Simulador · Guía técnica breve

BITIRO Simulador es una aplicación web estática para programar y observar un robot IROH virtual. No requiere cuenta ni backend para ejecutar la simulación.

Para una guía orientada a estudiantes y docentes consulta `docs/user-guide.md`. Para la API completa consulta `docs/api-iroh.md`.

## Abrir

En línea:

```text
https://simulador.nulljinx.com
```

Localmente sirve la carpeta por HTTP, por ejemplo:

```bash
python3 -m http.server 8080
```

Node.js solo es necesario para ejecutar las pruebas.

## Principio de funcionamiento

La pista o sesión nunca decide qué debe hacer el robot. El resultado depende del código, la física, los sensores, los actuadores, el escenario y las entradas manuales.

La demostración guiada es una visualización separada del código del estudiante y no constituye una solución ni una evaluación de misión.

## Movimiento

- paso fijo: `1/120 s`;
- velocidad de rueda máxima del modelo: `23 cm/s` al 100 %;
- aceleración gradual de ruedas: 240 %/s;
- wheelbase usado por la física: 12 cm, pendiente de validación frente al hardware real;
- `detenerse()` fija inmediatamente las consignas a cero.

`avanzar(izquierda, derecha)` permite consignas independientes. Una rueda izquierda más rápida gira hacia la derecha; una derecha más rápida gira hacia la izquierda.

## Sensores de línea

Tres sensores con geometría compartida entre lectura y visualización:

```cpp
leerSensorLineaIzquierdo();
leerSensorLineaCentral();
leerSensorLineaDerecho();
```

Funciones normalizadas:

```cpp
leerLineaNormalizada(0);
leerLineaNormalizada(1);
leerLineaNormalizada(2);
leerUmbralLinea();
lineaIzquierda();
lineaCentral();
lineaDerecha();
```

Modelo base: blanco ≈155, negro ≈865, umbral normalizado 500, con pequeñas diferencias **simuladas y deterministas** por sensor, posición e iluminación ambiental (`docs/calibration-mode.md`). No es una calibración física del IROH real. El botón «Calibración» abre el modo calibración (mover y girar el robot mientras el programa corre; solo la LCD del programa muestra lecturas). El diálogo de calibración v1 sigue oculto por compatibilidad.

## Sonar

`leerDistanciaSonar()` usa un modelo geométrico determinista con tres rayos `-6° / 0° / +6°`, origen 9,83 cm delante del centro del robot y valor máximo/sin objeto 200.

No es un modelo acústico completo y no reproduce ruido, incidencia, zona muerta o todos los rangos del hardware real.

## Pulsador e IR

Entradas manuales disponibles:

```cpp
leerBoton();
leerSensorObstaculoIzquierdo();
leerSensorObstaculoDerecho();
```

`botonInicio()` es una barrera cooperativa real: si el Pulsador está libre, el intérprete espera exactamente en esa llamada. Si ya estaba presionado, continúa inmediatamente. No consume ni libera automáticamente el estado.

Si el programa no llama `botonInicio()`, **Ejecutar** inicia inmediatamente.

## Garra

La API actual es:

```cpp
inicializarGolpe();
moverServoGolpe(-1); // izquierda
moverServoGolpe(0);  // centro
moverServoGolpe(1);  // derecha
```

La física interna usa aproximadamente `-75° / 0° / +75°`. Cualquier otro valor produce aviso y no mueve la garra.

La barra y las cajas se resuelven por contacto. El robot puede empujar una caja movible con la barra durante traslación si hay espacio; una caja fija, otra caja o el borde pueden bloquear el movimiento.

## Escenarios

`Más → Editar escenario` permite añadir, mover y eliminar cajas de 8×8 cm. El escenario se guarda por pista en `localStorage`.

- S01 incluye `practice-box` como escenario predeterminado no oficial.
- S06 no incluye caja predeterminada.
- S08 tiene cuatro `boxSlots` de referencia, pero no crea obstáculos automáticamente.

Reiniciar reconstruye el mundo activo desde el escenario guardado: la física nunca modifica permanentemente la configuración persistida.

## Lenguaje del estudiante

El editor usa un **intérprete de un subconjunto de Arduino/C++**, no un compilador de firmware.

Soporta:

- `int`, `float`, `long`, `bool`, `byte`;
- variables globales y locales;
- `if/else`, `while`;
- operadores aritméticos, comparación y lógicos con cortocircuito;
- funciones propias `void/int/float/long/bool/byte`;
- parámetros por valor;
- `return`;
- llamadas anidadas;
- hasta 64 niveles de llamadas;
- `pausa()` y `botonInicio()` dentro de funciones propias.

Las funciones propias pueden declararse antes o después de `setup()`/`loop()`. `loop()` sigue siendo obligatoria.

No soporta todavía `const`, `for`, `switch`, arrays, `do-while`, `break`, ternario, `millis()`, `delay()` ni `analogRead()`.

Las funciones `void` —propias o del robot— no pueden utilizarse como valores.

## Cabeza

Las funciones:

```cpp
inicializarCabeza();
moverServoYaw(...);
moverServoPitch(...);
apagarCabeza();
```

son reconocidas por la API, pero todavía no tienen efecto físico. El sonar permanece fijo al eje frontal del robot. Esto bloquea la reproducción fiel de S07 y limita S08.

## Geometría de sesiones

- S01–S06 y S08: geometrías reconstruidas desde referencias vectoriales oficiales.
- S07: superficie neutra de repaso, sin plotter oficial propio.
- Óvalo y Ocho: circuitos libres.

Las zonas pintadas no evalúan misiones y los gaps son ausencia real de línea.

## Verificación

La baseline actual mantiene 14 suites (más `tests/calibration-ui.mjs`, interfaz en navegador real; se omite sin Chrome):

```text
track-digitize
smoke
regression
sim1
ui-contract
ui-shell
syntax
pilot5
strike-audit
scenario-props
runtime-start
runtime-servo
runtime-functions
calibration
```

`tests/runtime-functions.cjs` cubre funciones propias, parámetros, `return`, scopes, recursión, orden de evaluación y propagación cooperativa de `pausa()`/`botonInicio()`.

Los goldens se comparan de forma determinista y no deben regenerarse sin revisión explícita.

## Archivos principales

- `iroh-runtime.js`: lexer/parser, validación, scheduler cooperativo y API.
- `simulator.js`: estado del robot, reloj, movimiento, sonar y coordinación del mundo.
- `strike-physics.js`: contacto de garra, cuerpo y cajas.
- `renderer3d.js`: escena procedural en Canvas.
- `calibration.js`: modelo simulado de sensores de línea, light field y persistencia de la calibración v1 (legacy).
- `calibration-mode.js`: interfaz del modo calibración.
- `tracks.js` / `extra-tracks.js`: geometrías.
- `scenario-props.js`: modelo y persistencia de cajas.
- `scenario-editor.js`: UI de edición del escenario.
- `starters.js`: código inicial por sesión.
- `tests/`: pruebas reproducibles.

Consulta también `docs/current-baseline.md`, `docs/architecture.md` y `docs/known-limitations.md`.
