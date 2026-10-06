# Arquitectura actual de BITIRO Simulador

## Vista general

BITIRO Simulador es una aplicación web estática. No hay backend, base de datos ni servidor de ejecución: el programa del estudiante, la física y el renderer corren en el navegador.

```text
UI / editor
    ↓
iroh-runtime.js
    ↓
simulator.js ───────── scenario-props.js
    ↓                        ↓
strike-physics.js        active world
    ↓
renderer3d.js
```

Las pistas (`tracks.js`, `extra-tracks.js`) describen suelo/geometría. El escenario (`scenario-props.js`) describe objetos físicos configurables. El currículo no forma parte del motor.

## Runtime

`iroh-runtime.js` implementa:

- lexer/parser del subconjunto Arduino/C++;
- validación previa;
- scopes y tipos;
- funciones del robot;
- funciones propias del estudiante;
- scheduler cooperativo.

### Scheduler

La ejecución es determinista y cooperativa. Las expresiones y sentencias que pueden entrar a funciones propias se ejecutan mediante generadores. `pausa()` y `botonInicio()` propagan `yield` a través de llamadas anidadas hasta el ciclo de simulación.

No se usan Promises, `setTimeout` o `setInterval` para el tiempo pedagógico.

`finPrograma()` corta el programa completo; `return` solo termina la función actual.

Profundidad máxima: 64 llamadas anidadas.

## Ciclo de simulación

`simulator.js` usa `FIXED_DT = 1/120 s`. El renderer puede dibujar a otra frecuencia, pero el estado físico avanza en pasos fijos. Esto permite pruebas reproducibles y goldens deterministas.

Componentes principales del estado:

- pose y consignas del robot;
- ruedas actuales;
- entradas IR/Pulsador;
- LCD;
- garra;
- obstáculos activos;
- tiempo simulado;
- modo (idle/code/demo);
- pausa/espera de Pulsador.

## Movimiento

La cinemática es diferencial. Las órdenes se convierten a velocidades lineales de rueda y se integran con subpasos para reducir tunneling.

El wheelbase de física actual es 12 cm. El renderer dibuja centros de ruedas con una separación efectiva distinta; esta discrepancia está documentada y pendiente de medición física.

## Física de garra y cajas

`strike-physics.js` es la fuente compartida de geometría y contacto.

Dos casos separados:

1. **servo gira** (`advance`): resuelve el arco de la barra y desplaza cajas por contacto;
2. **robot se traslada con barra fija** (`advanceRobotPose`): una caja movible puede avanzar con la barra mientras exista una solución sin penetración.

Se validan límites del arena, cuerpo, barra y colisión caja-caja. No hay fuerzas a distancia.

## Sensores

### Línea

`calibration.js` define geometría, valores brutos, normalización y perfil persistido.

### Sonar

El sonar se calcula en `simulator.js` mediante ray casting contra AABB de cajas. Actualmente está fijo al frente; HEAD-SERVO deberá acoplar su orientación a yaw.

### IR y Pulsador

Son entradas manuales de UI, no sensores físicos automáticos de las cajas.

## Pistas y escenarios

`TRACK` y `SCENARIO PROP` están separados.

- `tracks.js` y `extra-tracks.js`: geometría de suelo;
- `scenario-props.js`: cajas predeterminadas, validación y persistencia;
- `scenario-editor.js`: edición accesible top-down;
- `activeObstacles`: copia mutable usada por la física durante una ejecución.

Reiniciar reconstruye `activeObstacles` desde la configuración guardada; mover una caja físicamente no modifica la configuración persistente.

## Renderer

`renderer3d.js` es un renderer procedural sobre Canvas con proyección perspectiva. No usa Three.js ni un modelo CAD. Comparte geometría crítica de la garra con `strike-physics.js` para evitar divergencia visual/física.

## Storage

Claves principales:

```text
bitiro:line-calibration:v1
bitiro:standalone:code:<trackId>
bitiro:standalone:scenario:v1:<trackId>
```

El código y los escenarios se guardan por pista. El almacenamiento bloqueado debe degradar sin romper la simulación.

## Separación demo / código

La demostración guiada usa un controlador propio y nunca se considera evidencia de que un programa del estudiante resolvió una actividad.

`Ejecutar código` aplica únicamente el algoritmo escrito por el usuario.

## Tests

Las suites se dividen por contrato:

- geometría de pistas;
- smoke/regresión;
- goldens y determinismo;
- UI;
- sintaxis;
- escenario;
- `botonInicio()`;
- garra;
- funciones propias.

Los goldens caracterizan comportamiento deliberadamente congelado. Cambiarlos exige una decisión explícita, no una regeneración automática.

## Dirección futura

La arquitectura aprobada a futuro separa `core/sim`, `core/spec`, `core/tracks`, runtime y escena/UI. Esa migración no debe cambiar por sí sola la autoridad física ni introducir lógica curricular en el motor.
