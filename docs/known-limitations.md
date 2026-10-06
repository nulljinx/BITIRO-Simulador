# Limitaciones conocidas

Este documento diferencia limitaciones deliberadas, trabajo pendiente y discrepancias que necesitan medición física antes de modificarse.

## Prioridades actuales (tras SESSION-VALIDATION-2)

| Prioridad | Elemento |
|---|---|
| **P0** | ninguno |
| **P1** | HEAD-SERVO (cabeza yaw/pitch + sonar orientable); elementos de línea/intersección temporales para S03/S06 |
| **P2** | diferencias de velocidad, sensores y sonar entre standalone y Lab; acoplamiento garra-sonar; IR/Pulsador sin rebote; `millis()` |
| **P3** | `const`; aliases `*Robot`; starts prácticos; documentación y medición física |

`millis()` es una limitación de compatibilidad (bonus opcional de S06), **no** el bloqueo principal de S06: lo que impide el 100 % de S06 es la intersección que el plotter oficial no imprime. Las funciones propias ya no figuran como pendientes.

## Cabeza y sonar orientable

`inicializarCabeza()`, `moverServoYaw()`, `moverServoPitch()` y `apagarCabeza()` son reconocidas pero no tienen efecto físico. El sonar permanece fijo al eje frontal.

Impacto principal: S07 no puede reproducirse completa y S08 necesita una estrategia alternativa girando el cuerpo.

## Sonar

Modelo actual:

- origen: 9,83 cm delante del centro;
- tres rayos: −6°, 0°, +6°;
- máximo/sin objeto: 200;
- sin ruido ni ángulo de incidencia;
- sin zona muerta del sensor real.

El Lab histórico usa un modelo distinto (más rayos y cono mayor). No debe alinearse por intuición: conviene medir el hardware real.

## Garra vs sonar

Con garra centrada, la punta queda aproximadamente a 21,8 cm del centro del robot, mientras el sonar nace a 9,83 cm. En determinadas aproximaciones una caja puede entrar en contacto con la barra cuando el sonar está cerca de 12 cm.

Este acoplamiento afecta S03/S06 y requiere validación física antes de cambiar geometría o umbrales.

## Wheelbase

- física actual: 12 cm;
- renderer: centros de rueda separados ~18,2 unidades de mundo;
- observación física aproximada previa: ~9,0–9,3 cm centro-centro, no medida perpendicular definitiva.

El valor real está pendiente. Cambiarlo modifica directamente la tasa de giro y rompe goldens.

## Diferencias standalone / Lab

La última auditoría detectó diferencias en:

- curva velocidad→cm/s;
- valores negro/blanco;
- sonar;
- tiempos de giro.

Por ello un `.ino` calibrado para el Lab puede no recorrer igual el standalone aunque la lógica sea correcta.

## Lenguaje incompleto respecto de Arduino/C++

Actualmente faltan:

- `const`;
- `for`;
- `switch`;
- arrays;
- `do-while`;
- `break`;
- operador ternario;
- `millis()`;
- `delay()`;
- `analogRead()`;
- alias como `inicializarSensoresRobot` / `inicializarPantallaRobot` usados en algunos materiales.

Funciones propias, parámetros y `return` sí están soportados desde `RUNTIME-FUNCTIONS-1`.

## Entradas manuales

IR y Pulsador son toggles. No simulan rebote ni una pulsación física momentánea. Esto limita una reproducción fiel de actividades que enseñan debounce (S05).

## Pistas y elementos temporales

- S03: el plotter oficial no tiene barras de intersección que el material puede colocar con cinta.
- S06: el plotter oficial no contiene la intersección mencionada por otra parte del material.
- Scenario Props actualmente modela cajas, no cinta/barras de línea configurables.
- S02/S04/S05 usan starts prácticos que pueden quedar después de una barra de salida.
- S07 no tiene plotter oficial propio.

## Material curricular ambiguo

Hallazgos documentados:

- S03: materiales antiguos hablan de IR y material 2025 de ultrasonido;
- S02: “intersección” vs “segunda intersección”;
- S05: una vs dos paradas/intersecciones según fuente;
- S06/S07: rangos de sonar no completamente consistentes;
- S08: definición de líneas A/B y caso 0 cajas no confirmados.

El simulador no debe inventar una regla para resolver estas ambigüedades.

## Modelo determinista

No hay ruido ni aleatoriedad por defecto. Esto permite pruebas exactas, pero significa que tiempos calibrados pueden repetirse de manera más perfecta que en hardware real.

## Renderer

La escena es procedural sobre Canvas. No representa aún un modelo CAD medido ni una simulación rígida 3D completa.

## Licencia

El repositorio es público pero actualmente no declara licencia de software propia. Los materiales educativos y recursos de terceros mantienen sus derechos y condiciones.
