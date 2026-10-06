# Estado funcional de sesiones S01–S08

## Alcance de esta matriz

La auditoría `SESSION-VALIDATION-1` se ejecutó sobre la baseline pública `5b548f2` antes de `RUNTIME-FUNCTIONS-1`. Se probaron programas reales, recorridos físicos, sensores, actuadores, escenarios y una prueba representativa en producción por sesión.

Después, `b5683f0` añadió funciones propias, parámetros y `return` sin cambiar física ni goldens. Por ello:

- los hallazgos físicos de la auditoría siguen siendo relevantes;
- los bloqueos de S04/S06 causados exclusivamente por funciones propias ya fueron eliminados;
- **S04 y S06 requieren una nueva validación integral antes de declararlas completas**.

## Resumen

| Sesión | Última validación integral | Situación tras RUNTIME-FUNCTIONS-1 |
|---|---|---|
| S01 | ✅ completa | ✅ sin bloqueo nuevo conocido |
| S02 | ✅ completa | ✅ sin bloqueo nuevo conocido |
| S03 | 🟡 parcial | 🟡 faltan intersecciones/props y existe ambigüedad IR vs sonar |
| S04 | 🔴 incompleta por lenguaje | 🟡 funciones ya disponibles; revalidación pendiente |
| S05 | 🟡 parcial | 🟡 rebote/entradas y material ambiguo siguen pendientes |
| S06 | 🔴 incompleta | 🟡 funciones ya disponibles, pero faltan intersección y compatibilidad `millis()` para bonus |
| S07 | 🔴 incompleta | 🔴 cabeza yaw/pitch + sonar orientable siguen faltando |
| S08 | 🟡 parcial | 🟡 4/4 bases funcionan, pero la solución fiel requiere cabeza/sonar lateral |

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

**Resultado de la auditoría original:** física realizable, lenguaje bloqueado.

Se logró recorrer gaps e intersecciones con código inline. El bloqueo era que los ejercicios exigían funciones propias como:

```cpp
void baile() { ... }
void leerSensores() { ... }
```

`RUNTIME-FUNCTIONS-1` eliminó ese bloqueo y los patrones literales de S04 ya validan y ejecutan en tests. Falta repetir la actividad punta a punta usando el código curricular estructurado en funciones.

## S05

**Resultado auditado:** realizable con limitaciones.

Con V=30 se alcanzaron las bases 1/2/3 según el conteo de activaciones del IR derecho. El robot esperó realmente el IR izquierdo en la intersección.

Limitaciones:

- IR y Pulsador son toggles, no botones momentáneos con rebote;
- la pauta pide considerar tiempo de rebote;
- slide y DI discrepan en la cantidad de intersecciones/paradas;
- a velocidades altas algunas rutas fallan.

Las funciones propias del starter del Lab ya son compatibles tras `RUNTIME-FUNCTIONS-1`, pero eso no resuelve el modelo de rebote.

## S06

**Resultado de la auditoría original:** flujo físico principal realizable, actividad completa bloqueada.

Funcionaron:

- sonar frontal;
- rangos de distancia;
- velocidad variable;
- caja como Scenario Prop;
- golpe;
- continuación hasta meta.

`RUNTIME-FUNCTIONS-1` habilitó los patrones `int velocidad(int)` y `void seguidor(...)` que antes fallaban.

Pendientes que siguen vigentes:

- el plotter oficial S06 no contiene la intersección usada por otra parte del material;
- el bonus de “aumentar velocidad tras 20 s” usa `millis()`, aún no implementado;
- garra centrada + umbral de sonar cercano a 12 cm requiere validación frente al hardware real.

## S07

**Resultado auditado:** no realizable completa.

Funcionan variables, IR, LCD, garra y sonar frontal. No están modelados físicamente:

```cpp
inicializarCabeza();
moverServoYaw(...);
moverServoPitch(...);
```

El sonar no cambia de orientación. Esto impide reproducir la actividad de mover la cabeza derecha→izquierda→centro y detectar una caja lateral.

S07 es el caso principal de aceptación para el futuro bloque HEAD-SERVO.

## S08

**Resultado auditado:** realizable con limitaciones.

Con 1, 2, 3 y 4 cajas ubicadas en `boxSlots`, y probando ambas rutas, se alcanzaron las cuatro bases (8/8 combinaciones) con LCD correcto y sin colisiones.

La prueba necesitó girar el cuerpo para mirar lateralmente con el sonar. Eso demuestra que la física/ruta es viable, pero no reproduce fielmente la intención de usar servos de cabeza.

Limitaciones:

- “línea A / línea B” no está identificada inequívocamente en el plotter;
- 0 cajas no tiene significado curricular confirmado;
- con cajas laterales la posición de la garra importa durante el giro;
- HEAD-SERVO permitiría una solución más fiel.

## Próximas validaciones

Después de `RUNTIME-FUNCTIONS-1` conviene ejecutar `SESSION-VALIDATION-2` con foco en:

1. S04 completa usando funciones propias reales;
2. S06 completa hasta donde permite el plotter, separando claramente el bonus `millis()`;
3. regresión S01–S03/S05/S08;
4. luego HEAD-SERVO y una nueva validación de S07/S08.
