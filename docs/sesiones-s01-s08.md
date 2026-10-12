# Estado funcional de sesiones S01–S08

## Alcance de esta matriz

Este documento recoge dos auditorías funcionales con programas reales, recorridos físicos, sensores, actuadores y escenarios:

- **`SESSION-VALIDATION-1`**, sobre la baseline `5b548f2`, anterior a las funciones propias del estudiante;
- **`SESSION-VALIDATION-2`**, sobre `61aba25` (que incluye `b5683f0`, `RUNTIME-FUNCTIONS-1`), ejecutada localmente. Los programas de S01–S08 se reescribieron con funciones propias reales (`void` con y sin parámetros, `int` con `return`, funciones que llaman a funciones, `pausa()` y `botonInicio()` dentro de funciones).

`RUNTIME-FUNCTIONS-1` no cambió física, pistas ni goldens. Producción pública (`simulador.nulljinx.com`) fue desplegada con ese runtime y verificada el 2026-10-06 (dato histórico; la producción vigente es HEAD-CANVAS, 2026-10-12: ver [`release-sim-head-canvas.md`](release-sim-head-canvas.md) y [`current-baseline.md`](current-baseline.md)).

La regla de lectura: **los hallazgos físicos de la validación 1 siguen vigentes**; lo que cambió es el bloqueo de lenguaje.

## Matriz actual (SESSION-VALIDATION-2)

| Sesión | Movimiento | Línea | Gaps | IR | Pulsador | Sonar | LCD | Garra | Cabeza | Funciones | Escenario | Ruta/Base | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S01 | ✅ | ✅ | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ✅ izq/der | ✅ |
| S02 | ✅ | ✅ | N/A | ✅ | N/A | N/A | ✅ | N/A | N/A | ✅ | ✅ | ✅ 3/3 | ✅ |
| S03 | ✅ | ✅ | N/A | 🟡 | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | 🟡 | N/A | 🟡 |
| S04 | ✅ | ✅ | ✅ | N/A | N/A | N/A | N/A | N/A | N/A | ✅ | ✅ | ✅ meta | ✅ |
| S05 | ✅ | ✅ | ✅ | 🟡 | N/A | N/A | ✅ | N/A | N/A | ✅ | ✅ | ✅ 3/3 | 🟡 |
| S06 | ✅ | ✅ | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | 🟡 | 🟡 | 🟡 |
| S07 | ✅ | N/A | N/A | ✅ | ✅ | 🟡 | ✅ | ✅ | ❌ | ✅ | ✅ | N/A | 🔴 |
| S08 | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ 4/4 | 🟡 |

> La matriz anterior es el resultado histórico de SESSION-VALIDATION-2 y **no se ha modificado**: la columna «Cabeza» y los estados de S07/S08 corresponden a un simulador sin cabeza móvil. Lo que cambió con HEAD-CANVAS está en «Actualización HEAD-CANVAS» más abajo; ningún estado de sesión se reasigna sin una nueva validación formal.

## Comparación Validation-1 → Validation-2

| Sesión | Validation-1 | Validation-2 | Qué cambió |
|---|---|---|---|
| S01 | ✅ | ✅ | Sin cambio; idéntico con funciones propias (`golpearSegunIR()`, `esperarUsuario()`). |
| S02 | ✅ | ✅ | Idéntico al código inline, posición a posición, con el seguidor encapsulado en funciones. |
| S03 | 🟡 | 🟡 | Sin cambio; `detectarObstaculo()` funciona. Mismo diagnóstico: plotter sin barras de intersección; IR antiguo vs sonar. |
| S04 | 🔴 | ✅ | El bloqueo de funciones desapareció; actividad completa con funciones reales. |
| S05 | 🟡 | 🟡 | Mismos resultados; el starter del Lab ya valida. Sin cambio en rebote/IR toggle. |
| S06 | 🔴 | 🟡 | `int velocidad(int)` y `void seguidor(...)` funcionan; queda la intersección ausente del plotter. |
| S07 | 🔴 | 🔴 | Sin cambio; cabeza sigue sin modelo físico. |
| S08 | 🟡 | 🟡 | 8/8 combinaciones también con funciones propias. |

Resumen: **completas hoy: S01, S02, S04**. Parciales: S03, S05, S06, S08. No realizable completa: S07.

## S01

**Resultado auditado:** realizable completa.

Se verificó:

- Pulsador + `botonInicio()`;
- IR inicial;
- LCD;
- seguimiento simple;
- sonar;
- garra izquierda/centro/derecha;
- caja de escenario;
- finalización mediante entradas.

Con velocidad 20–100 se pudo completar el programa integrado probado, aunque a velocidades altas aumenta el desvío.

Limitaciones observadas:

- el sonar actual tiene cono estrecho ±6°;
- una caja descentrada puede ser tocada por la garra antes de entrar al cono;
- la `practice-box` predeterminada está en el tronco, mientras el Lab sitúa el obstáculo de la actividad en la base elegida.

## S02

**Resultado auditado:** realizable completa.

Se alcanzaron 3/3 bases con la lógica:

- IR derecho → Base 1;
- IR izquierdo → Base 2;
- ambos → Base 3.

Funcionó de forma robusta a V=20, 30 y 40. A velocidades superiores algunas curvas dejan de ser reproducibles con el mismo controlador.

Discrepancia: el material habla en algunos lugares de “segunda intersección”, pero el start práctico del simulador parte pasada la barra inferior.

## S03

**Resultado auditado:** realizable con limitaciones.

Funcionan:

- circuito cerrado;
- seguimiento con tres sensores;
- cajas;
- conteo por sonar;
- LCD;
- lógica anti-recuento.

Bloqueos:

- el plotter oficial no contiene las barras/intersecciones que la actividad puede colocar libremente con cinta;
- Scenario Props actualmente solo agrega cajas;
- materiales antiguos usan IR para obstáculos mientras materiales 2025 usan ultrasonido;
- los IR del simulador son entradas manuales, no sensores físicos de proximidad.

La parte de 180° disparada por intersecciones no puede reproducirse fielmente sin un prop de línea/barra.

## S04

**Resultado actual: ✅ realizable completa** (antes: 🔴 por lenguaje).

La validación 1 mostró que la física permitía recorrer gaps e intersecciones con código inline, pero los ejercicios exigían funciones propias. Con `RUNTIME-FUNCTIONS-1` se repitió la actividad completa **con una estructura de funciones real**:

- `void leerSensores()`, `void seguirLinea(int vel)` y `void cruzarGap(int vel)`;
- `int todoNegro()` / `int todoBlanco()` (con `return`);
- `void salirDeBarra(int vel, int ms)` con `pausa()` dentro de la función;
- `void esperar(int ms)`;
- `void cruzarHastaSiguienteInterseccion(int vel)`, que combina `while` con funciones que llaman a otras funciones;
- variables globales modificadas desde funciones (`intersecciones++`).

Se comprobó físicamente: salida, seguimiento, gap 1, intersección 1 con detención de 1 s, gap 2 cruzado con `while`, intersección 2 con detención de 1 s, tercera intersección y llegada a `meta`, con 0 colisiones y sin salir de la pista.

Referencia del informe (V=30, **no es un contrato del simulador**): I1 ≈ 4,6 s en y≈126,3; I2 ≈ 8,3 s en y≈107,7; I3/meta ≈ 31,2 s en (47,8; 34,5).

Velocidades: con un seguidor que prioriza «solo izquierdo / solo derecho» antes del central funcionó a V=20, 30, 40 y 60. A V=80 y V=100 funciona recalibrando el avance posterior a la barra (350–600 ms); sin recalibrarlo, la segunda barra se cuenta como tercera. El fallo inicial a V=20 con el primer seguidor era **del algoritmo, no de la física**.

Errores del alumno ejecutados sin corrección: sin caso GAP el robot se detiene antes del primer gap; una condición `||` en lugar de `&&` en `todoNegro()` produce falsas intersecciones; un umbral de 100 (el blanco simulado ronda 155) lo hace ver negro.

Notas: las funciones con parámetros son necesarias para reproducir los ejemplos de la clase; `return` es opcional pero útil. Las barras de intersección de S04 miden 1,5 cm, con lecturas marginales cerca del umbral 500.

## S05

**Resultado actual: 🟡 realizable con limitaciones** (sin cambio).

Con V=20, 30 y 40 se alcanzaron las bases 1/2/3 según el conteo de activaciones del IR derecho (1, 2, 3; con 4 y 6 se llega a Base 3). El robot esperó realmente el IR izquierdo en la intersección. Con la estructura en funciones (`contarActivaciones()`, `esperarIRIzquierdo()`, `elegirBase()`) los resultados reproducen los de la validación 1; a V=60 las activaciones 3, 4 y 6 terminan en Base 2.

Limitaciones:

- IR y Pulsador son toggles, no botones momentáneos con rebote;
- la pauta pide considerar tiempo de rebote;
- slide y DI discrepan en la cantidad de intersecciones/paradas;
- a velocidades altas algunas rutas fallan.

El starter del Lab para S05 (con `void leerSensores()`) ya valida en el simulador, pero eso no resuelve el modelo de rebote.

## S06

**Resultado actual: 🟡 parcial** (antes: 🔴 por lenguaje).

Con funciones propias reales (`int velocidad(int distancia)` con `return`, el `void seguidor(int sensor, int vel, int umbral)` de la clase, `seguir3(int vel)`, `golpear()`, `prepararGarra()`) se confirmó, con la caja como Scenario Prop (el plotter S06 no contiene caja):

- distancia > 12 cm → velocidad normal;
- 8–12 cm → velocidad reducida;
- < 8 cm → detener y golpear;
- continuación después del golpe hasta la `meta` del trazado disponible;
- LCD («CERCA», «FIN»);
- parámetros, `return` y variables locales que no escapan (el parámetro `distancia` no altera el global del mismo nombre).

Con 3 sensores, las ejecuciones a V=20, 30, 40 y 80 completaron el recorrido; a V=60 el robot quedó empujando la caja. Estas ejecuciones son observaciones puntuales de `SESSION-VALIDATION-2` y **no definen un rango operativo ni una relación monótona entre velocidad y éxito**: el resultado de V=60 puede ser una consecuencia emergente de física, temporización y geometría (la caja se ve tarde desde la curva), y no se corrigió ni se oculta. El `seguidor()` literal de la clase sigue una sola línea con un sensor y gira siempre a la derecha cuando ve blanco: es un ejemplo de sintaxis, no un seguidor capaz de recorrer la S-curva.

Errores del alumno ejecutados sin corrección: `velocidad()` que devuelve 40 con < 8 (no se detiene y empuja la caja), golpe hacia el lado en que la garra ya está retraída, garra al centro con umbral 12 y umbral de línea 100.

**Qué impide el 100 %** (separado):

- **Limitación principal — TRACK/MATERIAL:** el AE y la clase piden detenerse en una intersección, esperar un IR y girar según el lado, pero el plotter oficial S06 no imprime ninguna intersección (es una curva única). En la pauta AE son 40 de 120 puntos.
- **Bonus opcional — RUNTIME:** «aumentar velocidad tras 20 s» usa `millis()`, que aún no existe. Es una limitación de compatibilidad, no el bloqueo principal.

Sigue vigente la observación física de que, con garra centrada, el umbral de sonar cercano a 12 cm requiere validación frente al hardware real (ver [`known-limitations.md`](known-limitations.md)).

## S07

**Resultado actual: 🔴 no realizable completa** (sin cambio).

**Histórico (SESSION-VALIDATION-2):** funcionaban variables, IR, LCD, garra, funciones propias y sonar frontal; `inicializarCabeza()`, `moverServoYaw(...)` y `moverServoPitch(...)` se reconocían con aviso y no tenían efecto: con una caja a la derecha, el sonar leía 200 con yaw = 0 y 180. Eso impedía reproducir la actividad de mover la cabeza derecha→izquierda→centro y detectar una caja lateral.

**Actualización HEAD-CANVAS:** `inicializarCabeza()` y `moverServoYaw(angulo)` mueven una cabeza **virtual**, con ángulos intermedios y movimiento progresivo, y el sonar detecta objetos lateralmente cuando la cabeza gira (0° derecha, 180° izquierda). `moverServoPitch()` sigue sin efecto. S07 **no ha sido re-validada** como sesión (no tiene plotter propio y su actividad completa no se ejecutó de nuevo): su estado no cambia aquí hasta hacerlo, y nada de lo anterior está comprobado en el robot real.

S07 sigue siendo el caso principal de aceptación para esa re-validación.

## S08

**Resultado actual: 🟡 realizable con limitaciones** (sin cambio de estado).

Con 1, 2, 3 y 4 cajas agregadas por escenario (los `boxSlots` son metadata, no crean cajas) y ambas rutas A/B se validaron **8/8 combinaciones**, alcanzando las bases 1–4 con LCD correcto y sin colisiones. Se repitió con funciones propias (`seguirLinea`, `contarCajasLaterales`, `elegirBase`, `girar90`, `hayCaja`) y a V=20, 30, 40 y 60.

La solución funcional validada en SESSION-VALIDATION-2 **gira el cuerpo** para mirar lateralmente con el sonar. Eso demuestra que la física y la ruta son viables, pero no reproduce la intención de usar servomotores de cabeza.

**Actualización HEAD-CANVAS:** existen además dos soluciones docentes **independientes** que miran con la cabeza virtual sin mover el cuerpo (ver «Actualización HEAD-CANVAS» y «Corrección S08-PRODUCTION-FIX-1»). Solo están validadas en simulación, no son código inicial del estudiante, no se ejecutan solas y no demuestran nada sobre el robot físico. La estimación de la espera de la cabeza (`esperaCabeza = 1200 ms`) es una referencia virtual provisional, no una medición.

Limitaciones:

- «línea A / línea B» no está identificada inequívocamente en el plotter;
- 0 cajas no tiene significado curricular confirmado;
- con cajas laterales la posición de la garra importa durante el giro y al avanzar (con la garra a un lado, el robot puede empujar cajas laterales);
- las lecturas laterales rondan 3 cm, por debajo de la zona muerta del sensor real, que el modelo no simula.

## Actualización HEAD-CANVAS (cabeza virtual)

Fecha: 2026-10-12. Distingue tres niveles que no deben confundirse.

### 1. Capacidades virtuales comprobadas (en simulación, headless y Chrome)

| Capacidad | Evidencia |
|---|---|
| `moverServoYaw(angulo)` acepta ángulos continuos de 0° a 180° (se cuantiza a 1°, se limita con aviso) y el movimiento es progresivo (180 °/s, valor provisional) | pruebas `head-sonar` y `head-ui`; ángulos intermedios observados durante el giro |
| `leerDistanciaSonar()` mide según la orientación **real** de la cabeza: 0° derecha, 90° frente, 180° izquierda; detecta cajas laterales | prueba `head-sonar` (C2); matriz S08 |
| Con la cabeza al frente (90°) la lectura es idéntica a la anterior | 10 pistas, 400 lecturas frente a la versión publicada |
| Un programa NNJ de referencia resuelve S08 sin mover el cuerpo | matriz S08: 68 ejecuciones, 67 con todo lo verificable (la restante es una espera indefinida esperada); 0 colisiones; 0 cajas movidas; Base 2 = **90/90 verificables** |
| Los programas anteriores no cambian | programa inicial de las 10 pistas, 20 s simulados: estado final idéntico |
| Pausa, paso, continuar, reiniciar y velocidades 0,5×–4× con la cabeza | `head-ui` |

### 2. Actividades educativas

- La Guía documenta `inicializarCabeza()` y `moverServoYaw(grados)` (ángulos intermedios, giro progresivo, esperar con `pausa()` antes de leer el sonar). `moverServoPitch()` y `apagarCabeza()` siguen sin efecto y avisan.
- La actividad de S07 «mover la cabeza derecha→izquierda→centro y detectar una caja lateral» **puede programarse** en el simulador; la sesión no está re-validada formalmente.
- La solución de S08 con cabeza es una **referencia docente experimental**: no se publica como código inicial. La solución anterior que gira el cuerpo sigue siendo válida.
- **Base 2: 90/90 puntos verificables; los diez puntos de selección A/B siguen pendientes** (el recorrido por el tronco no distingue A de B; solo hay evidencia declarativa en la LCD).

### 3. Capacidades físicas todavía NO medidas (nada está validado en hardware real)

| Parámetro | Valor virtual | Estado |
|---|---|---|
| velocidad del giro | 180 °/s | provisional |
| espera de la cabeza | `esperaCabeza = 1200 ms` | referencia virtual provisional |
| alcance mecánico | 0°–180° | contrato de diseño |
| altura del sonar | 15,1 cm (el modelo 3D sugiere 18,1–19,7 cm) | incierta |
| altura de las cajas | 15,6 cm | supuesto; con 18,9 cm de sonar una caja de 15,6 cm no se detecta |
| zona muerta, ruido, tiempo de asentamiento, tope mecánico | no modelados | pendientes |
| pitch | sin modelo | sin implementar |
| animación | piezas del robot procedural; no representa el montaje real elevado; `?robot=iroh` no gira la cabeza | limitación visual |

**No se afirma que S07 ni S08 estén validadas sobre hardware real.**

## Corrección S08-PRODUCTION-FIX-1 (posición inicial)

Fecha: 2026-10-12. Tras publicar HEAD-CANVAS se detectó que el programa docente de S08 comenzaba con `salirDeLaBase()`, escrito para un robot **dentro de la zona roja**. La posición inicial publicada de S08 (`track.start`: 37,853 · 152,8 · −π/2) ya está **después** de la barra inicial (y = 161,69; zona roja y 161,7–181,7). El simulador no cambió: se corrigió el **programa de ejemplo**.

Se mantienen **dos soluciones independientes** (ver [`../examples/README.md`](../examples/README.md)): la referencia docente parametrizada (`tests/head/fixtures/s08_cabeza_docente.template.ino`, corregida) y la solución pedagógica NNJ simplificada (`examples/s08_nnj_simplificado.ino`, tal como la entregó el usuario). `starters.js` no se modifica.

Tres niveles de evidencia, que no se mezclan:

| Nivel | Qué es | Resultado |
|---|---|---|
| **Histórico** (sin cambios) | `tests/head/s08-matrix.cjs`: pose dentro de la zona roja, fixture `s08_cabeza_docente_historico.template.ino` (con `salirDeLaBase()`) | 68 ejecuciones, 67 con todo lo verificable; la restante es la espera indefinida esperada; 0 colisiones; 0 cajas movidas; Base 2 = 90/90 verificables |
| **Automatizado nuevo** | `tests/head/s08-real-start.cjs`: pose real de `track.start` (no copiada a mano), referencia docente corregida **y** solución NNJ | 40/40 casos por programa: 0, 1 (4 posiciones), 2, 3 y 4 cajas; rutas A y B; señales IR especiales; lecturas laterales con el cuerpo detenido; IR nuevo y exclusivo; base y LCD correctas; 0 colisiones; 0 cajas desplazadas. «Salir de la base» (10 pts) no aplica y se excluye. Base 2: 80/80 (= 90/90 menos esos 10 pts); A/B pendiente |
| **Manual del usuario** (producción, 2026-10-12) | referencia docente corregida y solución NNJ ejecutadas en el escenario probado | funcionaron: giro de cabeza, conteo de cajas, navegación y base correcta. Un escenario; sin registro en el repositorio |

Diferencias respecto del histórico: (1) el robot parte 19 cm más adelante y no hay tramo de salida; (2) no se exige `salirDeLaBase()`; (3) con la pose publicada la plantilla histórica **falla** («SIN CAJAS») y con la pose en zona roja la solución NNJ **no cuenta bien** (3 cajas → «Base: 2», control informativo): cada solución es válida solo para su pose de partida.

**Límites:** son pruebas de simulación determinista, sin ruido ni zona muerta del sonar real; S07 **no** se declara completa y S08 **no** se declara universalmente completa (A/B de línea sin identificar en el plotter, 0 cajas sin significado curricular confirmado, diez puntos A/B de Base 2 pendientes). Nada se probó en el robot físico.

## Próximas validaciones

1. Nueva validación formal de S07/S08 con la cabeza virtual (HEAD-CANVAS) y medición física de los parámetros de la cabeza (velocidad, alcance, alturas del sonar y de las cajas).
2. Props de línea/intersección y nueva revisión de S03/S06.
3. Compatibilidad pequeña de runtime (`millis`, `const`, aliases) según necesidad curricular.
4. Medición física antes de alterar garra, cono del sonar o velocidades.
