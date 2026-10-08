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
| `minAngleDeg` / `centerAngleDeg` / `maxAngleDeg` | −75° / 0° / +75° (grados respecto del eje delantero; + = derecha DEL ROBOT) |
| `angularRateDeg` | 190°/s (= 95 comandos/s × 2° del modelo v4; sin medición real que la sustituya) |
| `subStepDeg` | 1,1° (resolución del barrido continuo; ≈ 0,55 comandos × 2° del modelo v4) |
| `bodyRadius` (colisión cuerpo–caja, círculo) | 8,3 |

> **RUNTIME-SERVO-1 cambió INTENCIONALMENTE el baseline físico del golpe.** El modelo v4 (comandos 0–65, reposo «recogido» a −65°, barrido
> unilateral) se reemplazó por la API oficial `moverServoGolpe(-1/0/1)` = izquierda / centro / derecha DEL ROBOT → −75° / 0° / +75° (servo real
> 165°/90°/15° con 90° como eje delantero). La garra parte centrada (0°). Los valores de esta tabla y del texto siguiente sobre «comando 0–65»
> describen el modelo v4 histórico y ya no están vigentes. La física trabaja siempre en grados; `IROH_MECHANICS.commandAngle` es la única traducción.
> Además: el servo contacta en ambos sentidos y el robot que avanza con la barra fija empuja por contacto una caja movible
> (`advanceRobotPose`); fija o sin espacio → el robot se detiene. Goldens regenerados como consecuencia: ver el informe de la tarea.

(Histórico v4) Ángulo de la barra = `−65° + 2° × comando` (comando 0 → −65°; 65 → +65°).

**Cajas:** rectángulos alineados a ejes `{x, y, width, height, movable, visualHeightCm}`; `visualHeightCm` por defecto 15,6. La caja de práctica de S01 es `practice-box` en (46, 94), 8×8 cm, movible.

## 3. Cinemática (`simulator.js`, `update`)

- Velocidad de rueda: `v_rueda = (orden/100) × 23` cm/s (23 cm/s al 100 %).
- `v = (vL + vR)/2`; `ω = (vL − vR) / base`, con **`base = 12` cm** (ver §10).
- Rampa de aceleración de cada rueda: `approach(valor, objetivo)` = `valor + clamp(objetivo − valor, ±240·dt)` (unidades de orden, 240 %/s), **para cualquier objetivo, incluido 0**: aceleración y frenado usan la misma pendiente (MOTOR-DYNAMICS-1). Los 240 %/s son una **SIMULATION ASSUMPTION**: no están calibrados contra el IROH físico (calibración pendiente). **Deceleración normal** (`detenerse()`, `avanzar(0,…)`: objetivo 0, `mode` sigue en `code`) usa esa rampa. **Parada dura** (ruedas a 0 en el mismo update, explícita en `simulator.js`): cualquier update que deja `mode='idle'` (`finPrograma()`/`halt`, error de ejecución, fuera de pista, fin u obstáculo de la demo), colisión con bloqueo y `resetRobot()`.
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

- Origen: `pose + 9,83 cm` hacia adelante en este baseline v4 **histórico**; desde PHYSICAL-GEOMETRY-2 es `pose + 4,0 cm` (PHYSICALLY_MEASURED).
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

## 10. Discrepancia conocida: wheelbase — HISTÓRICO (superado por PHYSICAL-GEOMETRY-2: física = 10,0 cm medido; el renderer sigue en 18,2, desajuste visual)

> Las tablas siguientes describen el estado v4/SIM-1 (base=12). Ver [`physical-geometry.md`](physical-geometry.md) para los valores vigentes.

### 10.1 Registro de valores (actualizado 2026-10-06)

| Concepto | Valor | Estado |
|---|---|---|
| physics baseline (`simulator.js`, `base=12`) | 12 cm | congelado; **no se cambia** |
| physical observation (dos fotografías con regla del IROH real) | ≈ 9,0–9,3 cm centro-centro entre ruedas principales | observación aproximada, no perpendicular |
| exact physical measurement | — | **pending** (requiere medición perpendicular definitiva) |
| renderer effective wheelbase | 18,2 unidades de mundo del renderer (= cm de pista); fidelidad al IROH real **TO BE VERIFIED** | ver 10.2 |

No se asume que 18,2 cm sea el wheelbase real. Tampoco se asume que 12 cm lo sea. Los goldens y el producto no se modifican por esta evidencia.

### 10.2 Cadena matemática: de la constante del renderer a la posición dibujada (`renderer3d.js`)

1. Constante: `wheel(forward, side, width, radius)` con `mid = side·9.1`, llamada con `side ∈ {−1, +1}`, `forward = −2.3`, `width = 2.2`, `radius = 5.2`. `mid` es el desplazamiento lateral del **centro de cada rueda** respecto al eje del robot; por tanto cada rueda está a 9,1 cm del eje y entre ambas hay **18,2 cm**. El valor 9,1 es un semi-ancho de vía, no una distancia centro-centro.
2. Caras del neumático: cara interior en `mid − side·width/2` = ±8,0; cara exterior en `mid + side·width/2` = ±10,2. Eje de rueda a altura 4 con radio 5,2 (la rueda baja a −1,2 y sube a 9,2).
3. Marco local: `local(f, r, y) = (X(robot.x) + f·f2[0] + r·r2[0], y, Z(robot.y) + f·f2[1] + r·r2[1])`, con `heading = th − π/2`, `f2 = [cos h, sin h] = [sin th, −cos th]` y `r2 = [−sin h, cos h] = [cos th, sin th]`. Son exactamente el vector «adelante» y «derecha» de la física (`IROH_MECHANICS.basis`). El eje lateral `r` de la rueda comparte base con el desplazamiento físico.
4. A mundo: `X(x) = x − pista.w/2`, `Z(z) = z − pista.h/2`. Es una traslación; **no hay factor de escala**. Las unidades del mundo del renderer son cm de pista (la rejilla se dibuja cada 10 unidades y la pista mide `physicalWidthCm × physicalHeightCm`).
5. Proyección: `rel = v − cámara`, `depth = rel·adelante`, `x_px = w/2 + (rel·derecha)·focal/depth`, `y_px = 0,46·h − (rel·arriba)·focal/depth`, con `focal = min(w,h)·1,68`. Es perspectiva pura; solo depende de la distancia a la cámara. No hay transformación posterior de escala, ni en la carga ni en el dibujo.

### 10.3 Evidencia ejecutable (`tests/sim1/wheelbase-probe.cjs`, comprobada en `tests/sim1.cjs`)

- Con `face()` instrumentada en memoria (el producto no se toca), las caras de los neumáticos están en `|r| ∈ [8,0; 10,2]` para ambos lados, centros de rueda en `|r| = 9,1`, **separación centro-centro 18,2**, `f = −2,3`, radio 5,2, ancho 2,2. Resultado idéntico en cuatro poses/pistas (S01, S05, óvalo; rumbos 0, 0,7, 2,2 y −1,3).
- Misma base que la física: el vector rueda izquierda → derecha, en coordenadas de pista, es `18,2·(cos th, sin th)`.
- Comprobación independiente en píxeles (vista superior, `th = 0`): la rejilla da 2,5 px por unidad; la separación de las tapas de las ruedas mide ≈ 20,43 unidades (esperado 20,4 = 18,2 + 2·1,1) → centros ≈ 18,23. Es decir, una unidad de mundo se dibuja como 1 cm de pista.

### 10.4 Conclusión sobre las hipótesis

- (a) **Sí**: dentro del renderer significa 18,2 entre centros de rueda.
- (b) **No**: no existe transformación o escala posterior.
- (c) **Parcial**: 9,1 es el semi-ancho; no es otra dimensión distinta del ancho de vía.
- (d) **No**: el sistema de coordenadas es coherente con la física (misma base adelante/derecha, mismas unidades).

Observación sin verificar: el valor 9,1 coincide numéricamente con la medida física aproximada de 9,0–9,3 cm centro-centro. Una posible explicación (hipótesis, no establecida) es que una distancia centro-centro completa se haya usado como semi-ancho; si fuera así, otras medidas del modelo visual que dependen del mismo marco también podrían estar en discusión (casco octogonal ±8,1; motores a ±6,7 con ancho 3,2; rueda de 10,4 de diámetro y 2,2 de ancho). Nada de esto se ha corregido ni confirmado.

### 10.5 Efecto en la simulación

La tasa de giro depende directamente de `base` (`ω = (vL − vR)/base`): para `girarDerecha(20)` es 0,7667 rad/s con 12 cm, 0,5055 con 18,2 y 1,0222 con 9 cm. El control negativo de `tests/sim1.cjs` demuestra que cambiar `base` rompe los goldens de giro; cuando se decida el valor real habrá que regenerarlos conscientemente (`SIM1_UPDATE=1`).
