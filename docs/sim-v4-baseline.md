# BITIRO Simulador · Baseline v4 (comportamiento congelado)

- **Fecha de la caracterización:** 2026-10-06
- **Versión:** BITIRO Lab · Simulador 3D · v4 (importado en el commit `e2e555e`, «import BITIRO simulator v4 baseline»)
- **Entorno de verificación:** Node v24.20.0, Linux (WSL2). Sin dependencias instaladas.
- **Propósito:** describir qué hace hoy el simulador v4, con evidencia ejecutable. Los valores de este documento son **comportamiento v4 congelado**, no medidas reales del robot IROH.

## 1. Paso temporal

| Elemento | Valor v4 | Dónde |
|---|---|---|
| Paso fijo | `FIXED_DT = 1/120` s (0,008333…) | `simulator.js` |
| Acumulador | `acc += min(delta, 0.1 s) × velocidad`, tope `acc ≤ 0.5 s`; `while (acc ≥ FIXED_DT) update(FIXED_DT)` | `frame()` |
| Velocidad | 0,5× / 1× / 2× / 4× (multiplica `delta`, no el paso) | `#speed` |
| Pausa / pestaña oculta / diálogo de calibración | `acc = 0` | `frame()`, `visibilitychange`, `#calibrate` |
| Botón «Paso +0,1 s» | 12 llamadas a `update(FIXED_DT)` (= 0,1 s), permanece en pausa | `#step` |
| Interpolación visual | `a = acc / FIXED_DT` entre `previousPose` y la pose actual (solo render) | `render()` |
| Reloj / aleatoriedad | Ninguno: no hay `Math.random` ni lecturas de reloj de pared en la simulación (verificado por escaneo de fuentes en `tests/sim1.cjs`) | — |

`update(dt)` acepta cualquier `dt`; los tests existentes la llaman con 1/60 y 1/120. Los goldens SIM-1 usan siempre 1/120.

## 2. Geometría (unidades: cm, plano de pista; eje de rumbo `th` medido desde −Y del lienzo)

Pose del robot `R = {x, y, th, L, R}`. Vector adelante = `(sin th, −cos th)`; derecha = `(cos th, sin th)`.

**Mecánica del golpe** (`IROH_MECHANICS.spec`, `strike-physics.js`):

| Campo | Valor |
|---|---|
| `pivotForward` / `pivotRight` | 8,6 / 0 |
| `length` (barra) | 13,2 |
| `halfWidth` | 0,52 |
| `bottomHeight` / `topHeight` | 5,18 / 6,32 |
| `servoBodyHeight` | 4,4 |
| `sonarHeight` | 15,1 |
| `restAngle` | −65° |
| `sweepPerCommand` | 2° por unidad de comando |
| `maxCommand` | 65 |
| `commandRate` | 95 comandos/s |
| `bodyRadius` (colisión cuerpo–caja, círculo) | 8,3 |

Ángulo de la barra = `restAngle + sweepPerCommand × comando` (comando 0 → −65°; 65 → +65°).

**Cajas:** rectángulos alineados a ejes `{x, y, width, height, movable, visualHeightCm}`; `visualHeightCm` por defecto 15,6. La caja de práctica de S01 es `practice-box` en (46, 94), 8×8 cm, movible.

## 3. Cinemática (`simulator.js`, `update`)

- Velocidad de rueda: `v_rueda = (orden/100) × 23` cm/s (23 cm/s al 100 %).
- `v = (vL + vR)/2`; `ω = (vL − vR) / base`, con **`base = 12` cm** (ver §10).
- Rampa de aceleración de cada rueda: `approach(valor, objetivo)` = `valor + clamp(objetivo − valor, ±240·dt)` (unidades de orden, 240 %/s). Si el objetivo es exactamente 0, la rueda se detiene de inmediato.
- Integración con subpasos: `n = max(1, ceil(|v·dt|/0,30 + |ω·dt|/0,025))`; en cada subpaso se gira y avanza; si el cuerpo o la barra solapan una caja, el robot se detiene (`L=R=0`, ruedas a 0) y no avanza ese subpaso.
- Salida del área: se detiene con estado `FUERA DE PISTA` si `x < −16`, `x > w+16`, `y < −16` o `y > h+16`.
- Medición del giro estable: `girarDerecha(20)` produce ω = 2·0,2·23/12 = 0,7667 rad/s (caracterizado en `tests/sim1.cjs`).

**Servo del golpe:** avanza hacia el objetivo a `commandRate·dt` por tick; cada paso de `MECH.advance` se subdivide en pasos de ≤ 0,55 unidades de comando, evalúa el solape barra–caja (Liang–Barsky contra AABB ensanchada `halfWidth`) y desplaza la caja con la mejor solución de una rejilla de candidatos (deriva máx. 0,44 cm por subpaso), sin permitir que la caja entre en el cuerpo, en otra caja o fuera de la arena. Contra objeto fijo el servo se detiene (`blocked`). El botón «Golpe» ejecuta ciclo 0→65 con retorno tras 0,55 s (`pulse`).

**Demostración guiada:** controlador separado del código del alumno que sigue una ruta por pista (`createDemoPath`, remuestreada a 1,5 cm); look-ahead de 2 puntos, `turn = clamp(diff·32, ±32)`, velocidad 25 (0 si `|diff| > 1`). Se detiene en estado `OBSTÁCULO` ante una caja a ≤ 13 cm y continúa tras el golpe (`resumeDemoAfterStrike`).

## 4. Sensores de línea

- Geometría (`LINE_SENSOR.geometry`): **`front = 6` cm, `spread = 2,8` cm**. Sensor `k∈{0,1,2}` en `pose + front·adelante + (k−1)·spread·derecha`.
- Lectura (`readLine(k)`): distancia `d` al borde del segmento de línea más cercano (toda la pista); `blend = clamp((1,05 − d)/1,7, 0, 1)`; `raw = round(155 + 710·blend)`.
- **Blanco ≈ 155, negro ≈ 865** (`raw(0)=155`, `raw(1)=865`, `raw(0,5)=510`). Sin ruido, sin offsets por sensor, sin variación entre sensores.
- Perfil de calibración por defecto: `white=[155,155,155]`, `black=[865,865,865]`, `threshold=500`, `calibrated=false`; `normalized = round(clamp((raw − white)·1000/(black − white), 0, 1000))`; `detected = normalized ≥ threshold` (inclusivo). Perfil válido si contraste ≥ 100 por sensor y umbral ∈ [100, 900].

## 5. Sonar (`readSonarDistance`)

- Origen: `pose + 9,83 cm` hacia adelante.
- **Tres rayos a −6°, 0° y +6°** (`±Math.PI/30`).
- Cada rayo se intersecta con las cajas (AABB); solo cuentan cajas con `visualHeightCm ≥ 15,1`.
- Alcance máximo y valor «sin objeto»: **200**; resultado `round(mínimo)`. Una caja a más de 200 cm devuelve 200 igual que «sin caja».
- No hay paredes, ruido ni ángulo de incidencia.
- Evidencia: el golden `sonar_range` (distancias 5–195 cm, límite de altura 15,1/15,0, caja a 200,5 y 300 cm, rayos laterales con caja de 1 cm que solo el rayo ±6° alcanza, giro de 90°).

## 6. Golpe / cajas — resumen de contratos observables

Cuerpo y barra nunca atraviesan una caja; el golpe remoto no mueve nada; un objeto fijo bloquea el servo; la caja se cuenta como desplazada una sola vez (`movedCount`); el servo vuelve a 0 sin contar golpes falsos. El golden `servo_sweep` (sin obstáculos) registra el ciclo **0→65 en 83 ticks y 65→0 en 83 ticks más** (166 en total, `stroke(65)` luego `stroke(0)`).

## 7. Runtime Arduino (`iroh-runtime.js`)

Subconjunto didáctico de Arduino/C++: `void setup()`/`void loop()`, variables `int/float/long/bool/byte` con coerción, `if/else`, `while`, operadores aritméticos/lógicos con cortocircuito, `+=`/`-=`. Sin `eval` ni JS arbitrario. `pausa(ms)` cede control; `while` cede 8 ms por iteración; `loop()` cede 0 entre iteraciones. Modo estricto si hay `setup/loop`: exige `inicializarSensores/Movimiento/Golpe` (aviso y lectura 0/200 si falta). Errores con mensaje en español, número de línea y sugerencia por distancia de Levenshtein (p. ej. «No conozco la función «avansar()». ¿Quisiste escribir «avanzar()»?»). Caso `LCD`: `escribirPantalla(col, fila, valor)` escribe en `lcd[fila]` de 16 columnas.

Caracterizado en `tests/golden/runtime.json` (mensajes y estados completos): inicialización válida, `avanzar`, `girarDerecha`, lectura de línea (`leerLineaNormalizada`, `leerSensorLineaCentral`, `lineaCentral`, `leerUmbralLinea`), sonar, LCD, golpe, `while`, cuatro errores conocidos y un aviso del modo estricto. La gramática y los mensajes no se modifican en SIM-1.

## 8. Storage (solo `localStorage`)

| Clave | Contenido | Comportamiento v4 |
|---|---|---|
| `bitiro:line-calibration:v1` | `{version:1, white[3], black[3], threshold, calibrated}` | Se lee al cargar; si falta, no es JSON, `version≠1`, contraste < 100, umbral fuera de [100, 900] o hay valores no numéricos → perfil por defecto (la clave **no** se borra ni se reescribe). `save()` valida, actualiza el perfil en memoria y escribe la clave; devuelve `false` si el almacenamiento falla (el perfil en memoria queda actualizado). |
| `bitiro:standalone:code:<trackId>` | Código del editor por pista | Se escribe al editar, al elegir ejemplo y al cambiar de pista; se carga sin validar (un valor arbitrario se carga tal cual; un valor vacío cae al ejemplo `EJ[0]`). |

Con almacenamiento bloqueado: ninguna operación lanza, se usan los valores por defecto y `save()` devuelve `false`. La aplicación no lee ni escribe ninguna clave `v2`. Esta caracterización no migra nada.

## 9. Tests

| Comando | Qué cubre |
|---|---|
| `node tests/smoke.cjs` | Cinemática y golpe reales (suite mecánica original). |
| `node tests/regression.cjs` | 21 grupos de regresión v4 (calibración, runtime, pausa/paso, FPS, sonar, pistas, demo S01…). |
| `node tests/sim1.cjs` | SIM-1: goldens a 1/120, determinismo en procesos limpios, caracterización (runtime, geometría, storage) y controles negativos. |

Goldens (`tests/golden/*.json`): `s01_straight`, `s01_turn`, `s02_three_sensors`, `oval_continuous`, `s01_demo_strike`, `sonar_range`, `servo_sweep` (+ `runtime`, `storage`). Cada muestra registra `tick`, `x`, `y`, `theta`, ruedas actuales y objetivos, ángulo del golpe, tres lecturas brutas y, cuando aplica, sonar y posiciones de cajas. Todos se generan con `FIXED_DT = 1/120` y se comparan **exactamente**; el umbral de respaldo de 1e-9 solo existe para comparar contra el archivo en otra plataforma y en esta no se usó (diferencia máxima 0). Regenerar un golden exige `SIM1_UPDATE=1`.

## 10. Discrepancia conocida: wheelbase — estado **UNRESOLVED / PENDING PHYSICAL MEASUREMENT**

| Fuente | Valor |
|---|---|
| Física (`simulator.js`, `base=12`) | 12 cm entre ruedas |
| Render (`renderer3d.js`, `const mid=side*9.1`, `side ∈ {−1, 1}`) | centros de rueda a ±9,1 cm ≈ **18,2 cm** |

No se ha determinado cuál refleja el IROH real, y este baseline **no asume que 18,2 sea correcto**. Se mantiene `base = 12` y no se corrige. Efecto: la tasa de giro simulada (`ω = (vL − vR)/base`) depende directamente de este valor; con 18,2 sería 0,5055 rad/s en lugar de 0,7667 rad/s para `girarDerecha(20)`. El control negativo de `tests/sim1.cjs` demuestra que cambiarlo rompe los goldens de giro.
