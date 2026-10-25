# FIRVI 2025 · escenario de BITIRO Simulador (Etapas A, A.1, B y C)

Reproducción de la Final Nacional de Robótica Educativa FIRVI 2025 (Fundación Gabriel & Mary Mustakis) a partir de las
«Bases generales ROB FIRVI 2025 – V2», sección III y Figura 1 (p. 2). Pertenece a **BITIRO Simulador**, no a BITIRO Lab.

**Estado: Etapa A (pista funcional) y A.1 (cierre físico).** No hay rondas, reloj, intentos, checkpoints ni puntuación: ver «Qué falta».

## Dónde está

| Pieza | Archivo |
|---|---|
| Pistas `firvi-2025` (Recorrido A) y `firvi-2025-b` (Recorrido B), prismas, metadatos de procedencia | `firvi-2025.js` |
| Prisma triangular en la física compartida (opcional por obstáculo; las cajas AABB de S01–S08 no cambian) | `strike-physics.js` |
| Normalización del prisma en el escenario | `scenario-props.js` |
| Sonar contra polígono, aplicación del polígono al mover, demo desactivada, cámara apaisada | `simulator.js` |
| Dibujo del prisma | `renderer3d.js` |
| Pruebas | `tests/firvi-2025.cjs`, `tests/firvi-2025-ui.mjs`, `tests/firvi-2025/fidelity.py` |

## Fidelidad al plano

| Elemento | Estado | Fuente |
|---|---|---|
| Baldosa 30 × 30 cm | **Documentado** | III.B.1 |
| Cuarto de 4 × 3 baldosas (la figura lo dibuja de 3 de ancho × 4 de alto) | **Documentado** | III.A.3 |
| Margen de seguridad de 15 cm por arista, extensión de la pista | **Documentado** | III.B.2 |
| Cuarto con márgenes 120 × 150 cm (la figura de dimensiones lo rotula 150 × 120) | **Documentado** | Figura de III.B.3 |
| Tres cuartos en fila | **Documentado** | III.A.2 |
| Línea negra de 1 a 2 cm | **Documentado** (se usa 2 cm) | III.D.2 |
| Prisma triangular, 13 cm por cara, 20 cm de alto, móvil | **Documentado** | III.E.2 |
| Trazado de la línea (rectas y arcos) | **Medido de la Figura 1** | raster 825 × 333 px, 80 px = 30 cm |
| Posición y largo de los 3 gaps y los 2 topes transversales | **Medido de la Figura 1** | idem |
| Bases INICIO, fichas naranja, cuadros rojos | **Medido de la Figura 1** | idem |
| Longitud de los pasillos | **Supuesto**: márgenes contiguos (30 cm), sin paredes ni puertas | las bases no la acotan |
| Largo de los topes: 30 cm | **Supuesto** (medido en la figura: 1 baldosa) | |
| Orientación del prisma | **Supuesto**: una cara plana hacia el robot que llega | las bases no la fijan |
| Dos obstáculos por defecto en los cuadros rojos de los cuartos 1 y 3 | **Inferencia** | «máximo dos», «dentro de los cuartos» |
| Dos recorridos = la misma línea recorrida desde cada INICIO (giro de 180°) | **Interpretación** de la figura | III.A.5 |

Fidelidad medida (`python3 -I tests/firvi-2025/fidelity.py <bases.pdf>`): superponiendo la línea modelada sobre la Figura 1,
**99,7 % de los píxeles de la figura quedan a ≤ 3 px (1,1 cm) del modelo; el máximo es 1,6 cm**. La figura exagera el grosor
(≈ 4 cm); el simulador usa 2 cm. Ninguna geometría se declara oficial (`official:false`): el PDF no trae cotas del trazado.

Los extremos de la cinta son planos (cinta real) y los gaps tienen el largo medido de la figura (7,9 · 23,3 entre ejes de topes · 7,5 cm): ver A.1.

## Puntos que requieren validación (no resueltos)

1. **Significado de los cinco cuadros rojos.** Las bases no traen leyenda. Se tomaron los dos de los cuartos extremos como obstáculos; los otros tres
   (junto a cada ficha naranja y en el centro del cuarto 2) se registran en `landmarks.redSquares` sin función.
2. **«La intersección» de la tarea final (baile).** Hay topes transversales en el cuarto 2 y no hay otra intersección; no se ha fijado dónde ocurre.
3. **Checkpoint.** La ficha naranja de la figura cae en la baldosa de entrada del cuarto 2, pero V.G.4 manda devolver al robot a «la última baldosa del
   cuarto anterior».
4. **Pasillos, paredes y puertas.** III.C menciona puertas y pasillos con desniveles de hasta 3 mm; no hay dimensiones ni paredes en las bases.
5. **Simultaneidad.** Dos equipos sobre la misma línea desde extremos opuestos se cruzarían; las bases no lo explican.
6. **Contabilización de gaps (30 pts)** y **clasificación** (mejor ronda en VI.A.2 frente a suma de rondas en VI.B.1): sin resolver; pertenecen a la Etapa C.

## Garantías de la Etapa A

- La línea que lee el sensor es la que dibuja el renderer (`sceneTrack.paths` = `track.paths`); un gap es ausencia real de trazo.
- El simulador no dirige, corrige ni ayuda al robot: la demo guiada está desactivada en FIRVI y una prueba muestra que un programa que ignora los
  sensores sigue la misma trayectoria con y sin línea en el suelo.
- Un prisma solo se mueve por contacto físico con la barra (barrido del servo o empuje por traslación). El chasis nunca lo empuja.
- Las pistas y la física de S01–S08, Óvalo y Ocho no cambian: pistas idénticas con y sin `firvi-2025.js`; la física de cajas AABB se compara con
  la de `HEAD` en 400 casos deterministas; los goldens existentes siguen verdes.

## Etapa A.1 · cierre físico

- **Una sola geometría para el trazo.** `line-geometry.js` define la cinta: un rectángulo por segmento, discos solo en las uniones interiores de las
  curvas y **extremos libres planos**. El sensor (`closestSegment`) y el renderer de las pistas con `capStyle:'butt'` (FIRVI) usan esa misma
  definición; ya no hay trazos acortados ni compensaciones visuales. Pruebas: bordes, extremos y centros de los tres gaps (0,05 cm), 60 000 puntos
  aleatorios (el polígono dibujado ⇔ el sensor lo lee negro) y, en navegador, 99 %+ de coincidencia entre píxeles pintados y suelo sensado.
  `python3 -I tests/firvi-2025/gap-compare.py` genera la comparativa (diferencias fuera de la banda de 1 px del borde: 0). S01–S08, Óvalo y Ocho no
  declaran `capStyle` y conservan su modelo anterior (tapa redonda).
- **Secuencia con obstáculo, reproducible** (`SECUENCIA` en `tests/firvi-2025.cjs`, y en navegador con capturas por fase): el programa sigue la línea con
  el brazo recogido a la izquierda, el sonar detecta el prisma (≤ 14 cm), se detiene, hace el abanico izquierda→derecha (−75° → +75°), recoge el brazo y retoma
  la línea. El prisma se desplaza solo por contacto de la barra (≈ 20 cm, fuera de la línea) y el robot supera el cuarto 1 sin colisiones. Funciona en A (cuarto 1) y
  en B (cuarto 3). **No hizo falta cambiar la física.** El bloqueo de la captura anterior no era un defecto: con el servo centrado no hay abanico.
- **Registro pasivo de hechos físicos** (`BITIRO_PHYSICS_LOG()`): `sweep` (servo barre y desplaza), `push` (el robot empuja con la barra fija) y `contact`
  (bloqueo). El simulador solo escribe; nada lo lee para mover al robot. Es la entrada prevista del evaluador (Etapa C).
- **Mensajes**: «prisma triangular» en FIRVI; las cajas de S01–S08 conservan su texto exacto.
- **Encuadre automático** (`autoFit`, solo FIRVI): la distancia de cámara se calcula para que las cuatro esquinas quepan en vista superior y perspectiva; no cambia la
  escala física ni la cámara de las demás pistas.
- **Referencias planas**: flecha roja de INICIO propio, flecha atenuada del otro INICIO y ficha naranja del recorrido, tomadas de la figura. No se sensan. Los
  cinco cuadros rojos siguen **solo como metadatos** (`landmarks.redSquares`).
- **Recorridos independientes**: A (cuarto 1→3, hacia +x) y B (cuarto 3→1, hacia −x) comparten línea pero no estado: código, escenario, registro físico, ficha de
  checkpoint y reinicio son por pista (`track.sequence`).
- **Tramos en lugar de recorrido continuo.** Con los gaps exactos, el seguidor genérico de las pruebas no encadena el recorrido completo: llega al primer gap con
  rumbo torcido y se desvía. Se prueban seis tramos (base→pasillo, los tres gaps, cuarto 3→base opuesta; en A y B) con el mismo programa de sensores.
  Limitación documentada de la prueba, no de la pista.

Decisiones vigentes: los dos obstáculos son provisionales para entrenamiento; la ficha de checkpoint se asocia a superar el cuarto inicial; no hay paredes ni
puertas; los gaps puntuarán provisionalmente como un criterio conjunto de 30 pts; mejor ronda y suma de rondas se registrarán por separado; la «intersección»
final no se identifica automáticamente. **El PDF de las bases no se incorpora al repositorio** hasta revisar su licencia y condiciones de distribución.

## Etapa B · motor de competencia

Archivos: `firvi-competition.js` (motor puro, sin DOM, reloj inyectable), `firvi-competition-ui.js` (barra compacta), ganchos en `simulator.js` / `iroh-runtime.js`
(neutros fuera de competencia) y el adaptador `BITIRO_SIM_ADAPTER`. **No hay puntuación**: solo se registran hechos.

### Máquina de estados (única fuente: `TRANSITIONS`)

```text
preparación ──startRound──▶ calibración ──beginRun──▶ recorrido puntuable ──declareNoProgress──▶ falta de progreso
     ▲                          │                          ▲  │                                        │
     │                          │                          │  └────────────── finishRound ──┐          reposition
  nextRound                     └──────── finishRound ─────┼──────────────────────────────┤             ▼
     │                                                     └── programRestarted ◀── reposición autorizada ─┘
     └───────────────────────────────────── ronda finalizada ◀──────────────────────────────────────────────────── (voluntaria o 8:00)
```

Cada orden fuera de su fila se rechaza con motivo y sin efectos (prueba exhaustiva estado × orden). Los permisos (edición, calibración, tiempo, mundo,
cambio de pista) se derivan del estado; la interfaz y el simulador solo los consultan.

| Estado | Edición | Calibración | Pausa/paso/velocidad | Reinicio y movimiento manual | Cambio de pista |
|---|---|---|---|---|---|
| Preparación | sí | sí | sí (práctica) | sí | sí |
| Calibración | sí | sí | bloqueados (1×) | sí | no |
| Recorrido puntuable / falta / reposición | **no** | **no** | bloqueados (1×) | **no** | no |
| Ronda finalizada | sí (V.A.3) | sí | sí | sí | sí |

### Reloj
`clock.now()` (reloj de pared), independiente del tiempo simulado: 8 min desde «Iniciar ronda», **calibración incluida**; `beginRun` no lo reinicia; a las
8:00 la ronda termina sola (`finishedBy:'time'`, tiempo registrado = 8:00). Pausa, paso a paso y velocidad no lo mueven (y quedan bloqueados en ronda: la
velocidad se fuerza a 1× para que no se gane tiempo simulado). La práctica conserva todas las herramientas de depuración.

### Hechos que registra cada ronda (`round.events`, `faults`, `overcome`, `checkpoint`, `physics`)
`round-start` · `calibration-program-run` · `run-begin` (reloj, hash del programa, pose) · `program-started` · `room-overcome` (cuarto, intento, elegibilidad) ·
`checkpoint-enabled` · `no-progress-declared` (cuarto, intento, reloj, tiempo simulado, pose previa, ubicación permitida y su base) · `reposition` ·
`attempt-restart` · `end-reached` · `round-finish`. El **registro físico** (`BITIRO_PHYSICS_LOG()`) añade `touch` (press/release del Pulsador, evento físico
independiente) a `sweep`/`push`/`contact`. Los intentos 4.º en adelante se registran con `scoringEligible:false`; ningún registro lleva puntos.

### Decisiones provisionales (`BITIRO_FIRVI_COMPETITION.PROVISIONAL`; se copian a cada hecho que las usa)
1. La decisión de obstáculos se fija al iniciar la ronda (V.E.1).
2. Al comenzar el recorrido el campo se restaura y el robot va a la base (V.C.7); las bases no dicen qué pasa con lo movido en la calibración.
3. El cuarto de un punto se decide por los planos de entrada de cada cuarto.
4. Falta en el 2.º cuarto → **baldosa de la ficha naranja** (V.F.5; decisión del usuario en A.1); V.G.4 dice «última baldosa del cuarto anterior» y esa alternativa se
   registra en cada reposición. 3.er cuarto: se generaliza V.G.4.
5. Reinicios ilimitados, solo tres puntuables por cuarto.
6. «Cuarto superado» = cruce físico **continuo** del plano de entrada del siguiente cuarto en recorrido puntuable (un salto de pose no cuenta; la ficha naranja no es
   un sensor). Seguir la línea completa y los gaps lo valorará la Etapa C.
7. Reloj de pared con simulación a 1×: si el navegador se retrasa, el reloj no espera.

### Ambigüedades que permanecen
Significado de los cinco cuadros rojos; «intersección» de la tarea final (no se identifica); simultaneidad de dos equipos; pasillos/paredes/puertas; qué ocurre
con un obstáculo desplazado hacia la baldosa de reposición (el motor rechaza la reposición y no mueve nada; el juez tendría que despejarlo).

### Limitaciones
El estado de competencia vive en memoria (recargar la página lo pierde). Una reposición con obstáculo encima queda pendiente. La prueba de recorrido autónomo completo estuvo **pendiente** durante las Etapas A–C (con el programa genérico el robot superaba los cuartos 1 y 2 pero quedaba bloqueado por el segundo prisma); **se activó en la fase de integración** (ver «Integración autónoma»). No se tocó la pista ni la física.

### Dependencias para la Etapa C
Leer (sin escribir) `session.rounds[i]` y `BITIRO_PHYSICS_LOG()`: inicio por tacto (`touch` + `run-begin`), seguimiento de línea con tres sensores (hay que
observarlo; hoy solo existen lecturas), desplazamiento válido (`sweep` ≠ `push`; V.E.3 exige abanico), cuartos por intento (`room-overcome.attempt`), gaps (criterio conjunto de 30 pts,
provisional), tarea final (por definir), mejor ronda y suma de rondas por separado. Faltan además: identificar la «intersección» y el registro de «seguimiento completo».

## Etapa C · evaluación y puntuación

Archivos: `firvi-scoring.js` (evaluador puro, sin DOM, sin reloj), `firvi-scoring-ui.js` (panel «Evaluación» dentro de la barra de competencia), `tests/firvi-scoring.cjs`
(39 comprobaciones en C; 57 tras C.1) y `tests/firvi-scoring-ui.mjs` (6, navegador real). Capturas en `docs/firvi-2025-capturas-c/`.

### Arquitectura
`evaluateRound(registroDeRonda, contexto)` es una función **pura** de hechos ya observados. No existe ningún camino de escritura del evaluador hacia el simulador:
no mueve al robot, ni toca el escenario, los sensores o los obstáculos, y una prueba verifica que evaluar en vivo no cambia la pose, el tiempo ni los obstáculos.

| Entrada | Origen |
|---|---|
| `round.events` (run-begin, program-started, room-overcome, reposition, …) | motor de competencia (Etapa B) |
| `round.physics` = `BITIRO_PHYSICS_LOG()` (touch, sweep, push, contact) | simulador, solo escritura |
| `round.interaction` = `BITIRO_INTERACTION_LOG()` (gate-wait / gate-pass de `botonInicio()`, lecturas de `leerBoton()`) | **nuevo**: intérprete e simulador, pasivo |
| `round.trace` = `BITIRO_TRACE_LOG()` (20 Hz: pose, los 3 sensores físicos, qué sensores **consultó el programa**) | **nuevo**: simulador, pasivo |
| `round.obstacleState` (origen y posición final de cada obstáculo) | **nuevo**: adaptador, solo lectura |
| decisiones del juez | libro **append-only** aparte (`createJudgeBook`); jamás reescribe la ronda |

Cambios mínimos fuera del evaluador: ganchos neutros en `iroh-runtime.js` (`noteInteraction`), registros y muestreo en `simulator.js`, un número de secuencia (`seq`) que
ordena hechos discretos aunque compartan `simTime`, y `liveRound()`/`capture()` en el motor de competencia. La física, la geometría y la máquina de estados no se tocaron;
una prueba compara la pose/obstáculos con y sin consultar los registros.

### Hitos y qué se valida automáticamente

| Hito | Pts | Automático | Requiere al juez |
|---|---|---|---|
| Inicio por tacto | 10 | **Sí.** El programa debe esperar el Pulsador (`botonInicio()` o sondeo con `leerBoton()`), activarse **después** de iniciar el programa y el robot no debe haberse movido antes. Un touch aislado, un Pulsador ya presionado antes de iniciar, o un robot que arranca sin esperarlo → 0 | — |
| Seguimiento de línea con tres sensores | 50 | **Solo refuta**: sensor jamás consultado por el programa, o sin avance → *No conseguido* | **Siempre la concesión.** Leer los tres sensores y avanzar no prueba que el seguimiento se base en ellos; se muestra la evidencia (sensores consultados, % de la línea recorrida, saltos de pose, faltas) y queda *Pendiente · requiere al juez* |
| Obstáculo desplazado por abanico | 30 × máx. 2 | **Sí, solo con las tres evidencias de V.E.3** (C.1): barrido del servo (≥ 10° de recorrido), desplazamiento atribuible a ese barrido (≥ 2 cm) y **trayectoria liberada** (el prisma queda a ≥ 8,3 cm del eje de la línea, el radio de colisión del cuerpo, y así termina). Contacto, empuje o desplazamiento mínimo → 0. Obstáculos retirados → *No aplica* | Empuje previo, abanico simultáneo con avance, liberación completada por empuje, servo casi inmóvil, o registro sin posiciones/polígono → *Pendiente · requiere al juez* |
| Cuarto inicial / cuarto final | 60 · 40 · 20 | **Sí, si** el motor registró el cruce físico continuo **y** la traza lo respalda con evidencia FÍSICA (C.1): lectura de la cinta por un sensor a ≤ 3,5 cm del eje, rumbo acorde, avance sin saltos ni huecos, arranque en la pose autorizada y mando de los motores que responde al lado de la línea. El cuarto final exige además el **cuarto intermedio** superado y recorrido (no se puede omitir). 4.º intento en adelante: 0 pts (V.F.14) | Si falta cualquiera de esas evidencias (recorte, trayectoria paralela, cruce en recta, salto, hueco, sensores ignorados, reinicio con otra pose) → *Pendiente* (el juez indica el intento) |
| Gaps (criterio conjunto) | 30 | **Sí, si** los tres se recorren **en un mismo intento**: línea leída antes, tramo recto sin cinta (≤ 4 cm del eje, rumbo acorde) y línea leída después. Cruzar una coordenada, leer blanco, salir de lado o quedarse en el gap no basta; 1–2 de 3 → *No conseguido* | Gaps superados en intentos distintos con reinicios, o incompletos con la traza en duda (saltos/huecos) → *Pendiente* |
| Detención y baile final | 30 | **No.** La «intersección» no está identificada: el evaluador solo lista paradas candidatas en el cuarto intermedio | **Siempre** |

Evitar duplicados: cada hito se concede una sola vez (reinicios y eventos repetidos no suman); el intento de un cuarto es el que registró el motor al cruzar.
Sentido A/B: la trayectoria de referencia se invierte para B; la traza de B evaluada como A no puntúa.

### Estados (en texto, no solo color)
*Validado automáticamente* · *Validado por juez* · *Pendiente* (con «requiere al juez» cuando corresponde) · *No conseguido* · *No aplica*. El juez puede conceder, negar o
«quitar» (volver al automático) **solo después de la ronda** (VI.A.1); cada decisión queda en el libro y la vista siempre muestra qué decía el automático.
Las decisiones viven en memoria (como el estado de la competencia): recargar la página las pierde.

### Resultados
Por ronda: puntaje confirmado (y, aparte, los puntos que esperan al juez), tiempo de la ronda (parada voluntaria u 8:00) y tiempo estimado del último punto. Entre rondas: mejor
ronda y suma, **sin declarar ganador** (VI.A.2 «mejor ronda» contradice VI.B.1 «suma»). Un empate de puntaje se desempata por menor tiempo (V.F.15); no está claro si las bases
hablan de la duración de la ronda o del instante del último punto, y se informan ambos.

### Decisiones provisionales (`BITIRO_FIRVI_SCORING.PROVISIONAL`)
Primer inicio del programa para el tacto; umbrales del abanico (2 cm, 10°, 8,3 cm de liberación) y regla del primer contacto; **«cuarto inicial» = 1.º, «cuarto intermedio» = 2.º y «cuarto final» = 3.º del
recorrido A o B (CONFIRMADO por el usuario en C.1)**; evidencia física de la progresión por la línea (ver C.1; la tolerancia lateral de 10 cm de C se retiró); gaps como criterio conjunto de 30 pts; tarea final sin intersección.
Los umbrales de observación (`PARAMS`) no afectan la física.

### Limitaciones pendientes
- **Prueba de recorrido autónomo completo: PENDIENTE** (`tests/pending/firvi-full-autonomous-run.cjs`); sigue sin pasar y no se alteró. Por eso el cuarto final, los gaps y la tarea final se
  verifican con **trazas reales de tramos** del simulador y con rondas sintéticas, no con una ronda completa de un programa único.
- Un programa que ignora los sensores se detecta con evidencia indirecta (el mando no responde al lado de la línea), no con una prueba de causalidad: ver C.1, riesgos.
- Las decisiones del juez no persisten; no hay firma/acta (VI.A.1).
- La «intersección», los cinco cuadros rojos, las puertas/paredes y la simultaneidad de dos equipos siguen sin resolver.

## Etapa C.1 · cierre de fidelidad del evaluador

Alcance: corregir tres riesgos de falso positivo del evaluador (obstáculos, superación de cuartos, gaps) y revisar la instrumentación. No se rehicieron las Etapas A, A.1, B ni C; no se tocó la pista, la
física, BITIRO Lab, Supabase ni Aula Banco; no hay commit, push, merge ni deploy.

### 1 · Interpretación de los cuartos (confirmada)
- **Cuarto inicial** = el 1.º en el sentido del recorrido A o B (tabla 60 / 40 / 20 por intento).
- **Cuarto intermedio** = el 2.º; sin puntuación independiente por número de intento. Sus 30 pts de gaps (criterio conjunto, provisional) y los 30 de la tarea final viven ahí.
- **Cuarto final** = el 3.º (tabla 60 / 40 / 20).
- El cuarto intermedio **debe superarse** para completar el recorrido y no puede omitirse: el motor solo registra el cruce del plano 2 tras el del plano 1, y el evaluador no concede el cuarto final sin el cuarto intermedio
  superado **y recorrido con evidencia** (unión de los tramos fiables hasta ese instante).

### 2 · Obstáculos: de «≥ 2 cm» a «barrido + desplazamiento atribuible + trayectoria libre»
Problema de C: bastaba que el primer contacto fuera del servo y el prisma quedara a 2 cm de su origen; un desplazamiento mínimo no garantiza que el obstáculo haya salido del recorrido.
Ahora el registro físico guarda, por hecho (`sweep`/`push`), la **posición del obstáculo antes y después** (`from`/`to`, pasivo) y el adaptador expone el polígono del prisma. El evaluador exige:
1. el **primer** desplazamiento lo causó el servo; recorrido del servo ≥ 10° (abanico);
2. el desplazamiento atribuible al barrido (antes de cualquier empuje) ≥ 2 cm;
3. tras el barrido y al final, el prisma está a **≥ 8,3 cm del eje de la línea** (= `IROH_MECHANICS.spec.bodyRadius`: el cuerpo del robot pasa; una prueba lo fija) — verificación geométrica exacta polígono ↔ trayectoria.

Resultados: cumple todo → 30 pts (máx. 2). **Contacto sin retirada** (< 2 cm) o **desplazado pero aún sobre la trayectoria** → 0 (*No conseguido*; en curso, *Pendiente*). Empuje previo → 0. Casos ambiguos →
*Pendiente · requiere al juez*: abanico simultáneo con avance del robot, servo casi inmóvil, liberación completada por un empuje, obstáculo empujado de vuelta a la línea, registro sin posiciones o sin polígono.
Los prismas por defecto están sobre la línea (0 cm); en el simulador real, el abanico del programa de referencia los deja a 10–13 cm.

### 3 · Superación de cuartos: se retira la tolerancia lateral de 10 cm como evidencia
La progresión ya no se infiere por cercanía a la trayectoria. Una muestra solo **avanza la cobertura** si hay evidencia física:
- fuera de los gaps: un sensor **leyó la cinta** (hecho del simulador) y la barra de sensores (`LINE_SENSOR.geometry.front` delante del centro —6,0 cm en HEAD-CANVAS, 8,0 cm en la variante medida de main—, no el centro del robot) está a ≤ `spread + 1,6` cm del eje (4,4 cm en HEAD-CANVAS; 3,5 cm en la variante de main), con rumbo ≤ ~100° respecto de la tangente;
- dentro de un gap (no hay cinta): barra a ≤ 4 cm del eje del gap y rumbo acorde;
- una pérdida de línea se recupera solo si se retoma a ≤ 6 cm de donde se perdió; si no queda un **hueco** (recorte, atajo, trayectoria paralela) y el cuarto queda pendiente;
- el segmento arranca en la **pose autorizada** (base, o la pose del evento `reposition`) con la barra sobre la línea; saltos de pose sin reposición y huecos de tiempo de la traza (> 0,2 s) invalidan el intento;
- el **mando de los motores** (registrado ahora en la traza: `l`, `m`) debe responder al lado de la línea, comparado **dentro de cada clase de curvatura** para que «seguir la curva» no pase por «responder a los sensores». Un programa
  que lee los sensores y los ignora —misma trayectoria, mando fijo— da Δ ≈ 0 y queda pendiente del juez.

Pruebas negativas (en `tests/firvi-scoring.cjs`): recortes de curva (3 cuerdas), trayectoria paralela a 3/8/12 cm, cruce en recta de los planos, salto/teletransporte, hueco de 3 s, sensores consultados pero ignorados, rumbo invertido,
reinicio sin evento, con otra pose o sin pose, cuarto final sin cuarto intermedio (sin hecho, sin recorrido, tramo cortado, sensores ignorados). Los sensores de las trazas sintéticas se **calculan de la geometría** (no se fabrican).

### 4 · Gaps
30 pts conjuntos, provisional. Se distingue: **cruce válido con recuperación** (30 pts); **cruce parcial** (entra y no sale: no conseguido); **salida de pista sin recuperación** (se desvía > 4 cm: no conseguido);
**lectura de blanco sin superar** (detenido o girando: 0); **salto sobre la coordenada** (no conseguido); **gaps en intentos distintos con reinicios** (todos superados pero sin un intento completo → *Pendiente · juez*, porque las bases no dicen si el criterio conjunto lo admite).
En una ejecución real completa del programa de referencia el evaluador concedió los tres gaps de forma automática.

### 5 · Instrumentación y muestreo a 20 Hz
- Decisiones críticas ya **no dependen** del muestreo: el cruce de planos y la llegada a la base los registra el motor en cada paso físico (120 Hz); el abanico/empuje y el Pulsador, el registro físico por paso.
- La traza (20 Hz) solo respalda la progresión. Peor caso medido: la barra de sensores recorre ≤ 1,9 cm entre muestras (límite de continuidad usado: 3 cm); una prueba lo comprueba con el mando más exigente.
- La instrumentación sigue **pasiva**: `from`/`to`, `l`/`m` y los polígonos solo se escriben/leen; una prueba compara pose, tiempo y obstáculos con y sin consultar los registros.

### 6 · Pruebas existentes revisadas
- `tests/ui-contract.cjs`: el único cambio es añadir los scripts y el orden de la competencia (y los ids de las dos interfaces nuevas). Sin pruebas debilitadas.
- `tests/firvi-competition-ui.mjs`: el motor de Etapa B sigue sin puntuar (verifica que ni la barra de estado ni el registro de la ronda muestren puntaje); C.1 añade una prueba estructural: el motor no referencia al evaluador y sus hechos no tienen campos de puntaje.
- `tests/sim1/characterization.cjs` **no es un script de comprobación**: es un módulo de utilidades (`module.exports`) que importa `tests/sim1.cjs` (22 comprobaciones superadas). Ejecutarlo directamente no imprime nada **por diseño**; no hay comprobaciones ocultas sin ejecutar.
- En C.1 se **modificaron** pruebas de C solo cuando el criterio se endureció a propósito (obstáculos, cuartos, gaps): las trazas sintéticas ahora son físicamente coherentes (sensores calculados, barra delante del centro, pose de arranque autorizada) y los tramos
  reales parten de una pose autorizada sobre la línea. Dos afirmaciones de C dejaron de ser válidas y se corrigieron con motivo: el tramo real del cuarto final ya no se **concede** (un tramo suelto no demuestra el cuarto intermedio) y el abanico seguido de empujes
  ya no puntúa si la liberación la completó el empuje.

### 7 · Validación integral pendiente *(superada en la fase de integración: ver «Integración autónoma»)*
`tests/pending/firvi-full-autonomous-run.cjs` se conservó sin cambios en C.1 (fallaba por diseño con `FIRVI_E2E=1`). Diagnóstico de solo lectura: `FIRVI_DIAG=1 node tests/pending/firvi-full-run-diagnostic.cjs [A|B]`.
Hallazgos con el programa de referencia en el Recorrido A: supera los cuartos 1 y 2, los tres gaps y el abanico del primer prisma (130 pts automáticos), y se detiene en el **segundo prisma** (línea 613 de 731 cm, cuarto 3):
- el programa dispara el abanico **una sola vez** (`done`) y deja el servo en el centro; al llegar al 2.º prisma por la curva, la garra queda de través y el barrido no lo desplaza (o lo toca con una `contact: rotation` que detiene al robot);
- con el servo rearmado el barrido toca el prisma, pero no lo saca de la trayectoria (el evaluador no concede el obstáculo) y el robot queda detenido por contacto.
Se trata de una limitación **del programa** (y de la aproximación al 2.º prisma por una curva cerrada), no de la pista: no se alteró el trazado. Una ejecución integral aprobada debe demostrar, en una sola ronda real sin faltas de progreso,
`endReached`, cuartos 1 y 2 superados, y el evaluador concediendo cuarto inicial, gaps y cuarto final de forma automática con un único programa de sensores. Una concatenación de tramos **no** equivale a esa prueba y no se presenta como tal.

### 8 · Resultados: evidencia automática vs decisión del juez
Sin cambios de diseño: el libro del juez es append-only y aparte; registrar una decisión no cambia el historial físico (la prueba compara la ronda antes y después); mejor ronda y suma se informan por separado y sin ganador.
**Futuro (no implementado):** hoja de resultados **exportable y firmable** por ronda (puntos automáticos con su evidencia, decisiones del juez con nota y hora, firmas del capitán y del juez, hash del programa y del registro de la ronda), persistente fuera de la memoria de la página.

### Riesgos restantes para cerrar FIRVI 2025
1. **Prueba integral sin superar** (programa de referencia detenido en el 2.º prisma); sin ella, el cuarto final y el cuarto intermedio solo se validan por tramos reales + trazas sintéticas.
2. Umbrales de observación **provisionales** (3,5 cm, 4 cm, 6 cm, 8,3 cm, Δ de mando = 6): no los fijan las bases; deben contrastarse con rondas reales y con otros programas.
3. «Mando que responde a los sensores» es evidencia indirecta: un programa de trayecto precalculado muy preciso podría confundirse, y uno con seguimiento muy suave (pocas muestras con desvío ≥ 0,4 cm) cae a *Pendiente*. Por diseño el error es hacia el juez.
4. La liberación de la trayectoria usa el radio de colisión del cuerpo (8,3 cm, `SIMULATION_ASSUMPTION`, pendiente de PHYSICAL-COLLISION-1) y el eje de la línea, no el ancho real del robot ni de la cinta.
5. Ambigüedades de las bases sin resolver: «intersección» de la tarea final, significado de los cinco cuadros rojos, gaps en intentos distintos, pasillos/paredes, VI.A.2 vs VI.B.1, y si el desempate usa duración o último punto.
6. Estado y decisiones del juez en memoria; falta la hoja firmable. La traza limita 40 000 muestras (≈ 33 min de simulación, sobrada para 8 min).
7. Geometría de la pista medida de la Figura 1 (no oficial): los 3 gaps resultan de 7,9 / 23,3 / 7,5 cm sobre la línea medida.

## Integración autónoma · un solo programa completa A y B

Alcance: demostrar una ejecución integral con un **único programa autónomo basado en sensores**. No se rehicieron las Etapas A–C.1, no se tocaron la pista, la física, el evaluador ni sus umbrales
(`firvi-scoring.js`, `simulator.js` y `strike-physics.js` no cambiaron en esta fase), ni BITIRO Lab, Supabase o Aula Banco. No hay commit, push, merge ni deploy.
Todo lo nuevo vive en `tests/integration/` (programa, arnés, procesos de trabajo), `tests/firvi-integral.cjs`, `tests/firvi-integral-ui.mjs` y `docs/firvi-2025-integral/`.

### 1 · Diagnóstico del bloqueo en el 2.º prisma (A, B, C)
Programa heredado (Etapas A–C), Recorrido A: supera los cuartos 1 y 2, los tres gaps y el primer prisma, y se detiene en la línea 613 de 731 cm, a 22,5 cm del 2.º prisma (centro en 300, 60). Observaciones:

| Dato | Valor observado |
|---|---|
| Geometría | El prisma está sobre la recta de 40 cm que sigue a una vuelta en U (r ≈ 15 cm); su cara plana queda a ≈ 18 cm de la salida de la curva. La barra de golpe llega a 21,8 cm delante del centro. |
| Robot | Rumbo −144° a −148° al final de la U; los sensores leen 010/110; sonar 200 cm (el prisma está a −25° a −32° del eje: fuera de los rayos de ±6°) hasta que el sonar ve 13–14 cm. |
| Garra | Servo en 0° (el programa heredado vuelve al centro tras el 1.er barrido) → la barra apunta de frente. |
| Eventos | `contact: rotation` (la garra toca el prisma durante el giro y el motor detiene al robot), después `contact: body`; **0 `sweep` sobre el 2.º prisma** (el programa dispara el barrido una sola vez: `done=1`). |
| Geometría de colisión (comprobada) | Al primer contacto, barra ↔ prisma = 0,55 cm (relleno de la barra 0,52) y centro del robot ↔ prisma = 20,05 cm (> radio 8,3): el motor para por la **barra**, no por el chasis, y las dos pruebas del motor coinciden con la distancia polígono-segmento calculada aparte. |
| Con el servo rearmado (variante del mismo programa, pista intacta) | El barrido toca y desplaza el prisma (≈ 13 cm) pero no lo saca de la trayectoria: el evaluador no concede el obstáculo y el motor detiene al robot por contacto con el chasis. |

**Conclusión.** Las causas demostradas son **A** (insuficiencia del programa: barrido de una sola vez, garra al centro, sin acercamiento controlado ni elección del sentido) y **B** (limitación física razonable:
con una barra de 21,8 cm y el prisma a ≈ 18 cm de la salida de la curva, cualquier llegada con la garra de frente la hace tocar el prisma durante el giro, y la regla del motor es detener al robot). **C (defecto de simulación) no se encontró**:
la geometría de contacto es coherente con la que calcula la prueba independiente, el comportamiento es determinista y reproducible, y con otro programa el mismo prisma se aparta en 36 de 36 llegadas. No se puede afirmar, sin más, que «era solo el programa»:
la situación física obliga a aparcar la garra, quedar a distancia de golpe y elegir el sentido del barrido; el programa heredado no lo hacía. Incertidumbre residual: la posición de los prismas es una **inferencia** (docs, «Ambigüedades»); con otra posición oficial el margen cambiaría.

### 2 · Programa de referencia (`tests/integration/reference-program.iroh`)
Solo usa los tres sensores de línea, el sonar, el servo y el tiempo: **sin coordenadas, rutas, teletransportes ni accesos a la física** (una prueba lo comprueba). No es un starter ni un programa obligatorio de los estudiantes.
- *Seguimiento:* giro fuerte con un lado, suave con centro + un lado; recuerda de qué lado perdió la línea (`ult`) para recuperarla.
- *Fin de curva:* los sensores van 8 cm delante del eje, así que al acabar una curva el robot aún no terminó de girar. Una memoria con fuga del lado de las últimas correcciones (`acc`) hace que, al perder la línea, termine ese giro (≈ 5°, 0,3 s) una vez cada ≈ 15 s antes de avanzar recto. Es lo que permite entrar alineado al primer gap, que sigue a la curva con solo 4 cm de recta.
- *Gaps:* avance recto mientras no hay línea; al volver a verla sigue normal.
- *Obstáculos:* si el sonar ve algo a < 22 cm se acerca despacio **siguiendo la línea** hasta 13 cm (distancia de golpe), se detiene, barre con la garra desde su lado aparcado hacia el contrario y la devuelve (la garra nunca queda junto al prisma apartado). 15 s después aparca la garra del lado contrario, de modo que el siguiente obstáculo se barre en sentido opuesto.
- *Parámetros afinados por simulación* (declarados como tales): distancia de golpe 13 cm, giro de fin de curva 7 × 0,3 s, retención 15 s. Un barrido desde 11 cm deja el 2.º prisma a 7,3 cm de la línea; desde 12 cm, a 8,3 (en el límite); desde 13 cm, a 9,0. El giro de fin de curva es sensible: en aislamiento, 7 × 0,3 s (2,1) y 8 × 0,25 s (2,0) cruzan los tres gaps en 24 de 24 llegadas, 8 × 0,3 s (2,4) en 23, 9 × 0,3 s (2,7) en 18 y 10 × 0,4 s (4,0) en 1. No se ajustó ningún umbral del evaluador.
- Cambios respecto del heredado (`tests/integration/legacy-single-sweep.iroh`, conservado como control negativo): seguimiento en función `seguir`, compensación de fin de curva, acercamiento con distancia de golpe, garra aparcada y devuelta, sentido alterno por obstáculo, sin bandera de un solo uso.

### 3 · Pruebas de aislamiento (`tests/firvi-integral.cjs`)
Para cada uno de los cuatro prismas (1.º y 2.º, en A y en B) se coloca al robot en la línea **antes** del prisma con 9 llegadas razonables (85, 65 y 50 cm antes × desvío lateral ±1,5 cm × rumbo ±8°), con la garra aparcada como la dejaría el obstáculo anterior:

| Recorrido · prisma | Despeje final de la línea | Desplazamiento | Empujes | Resultado |
|---|---|---|---|---|
| A · 1.º (cuarto 1) | 10,4–13,1 cm | 17–20 cm | 0 | 9/9 liberan y siguen |
| A · 2.º (cuarto 3) | 8,9–9,3 cm | 15,5–15,9 cm | 0 | 9/9 |
| B · 1.º (cuarto 3) | 10,1–12,9 cm | 16,6–20 cm | 0 | 9/9 |
| B · 2.º (cuarto 1) | 8,9–9,3 cm | 15,5–15,9 cm | 0 | 9/9 |

El mismo programa supera el primer y el segundo prisma. **Control sin obstáculos** (decisión «retirar»): A y B se completan, los obstáculos «no aplican» y el confirmado es 160 de 240. Negativos: el programa heredado **sigue detenido en el 2.º prisma** (A: 130 pts, sin cuarto final) y, sin la orden de barrido, ni se puntúan los obstáculos ni se llega a la zona final.

### 4 · Resultado integral (motor de competencia, calibración incluida, sin reposiciones)
Una ejecución por recorrido, el código no se toca durante el recorrido (una orden de modificarlo es rechazada), sin faltas de progreso ni reposiciones, checkpoint habilitado al superar el cuarto 1:

| | Recorrido A | Recorrido B |
|---|---|---|
| Cuartos superados / zona final | 1, 2 / sí | 1, 2 / sí |
| Hitos automáticos | tacto 10 · cuarto inicial 60 · gaps 30 · cuarto final 60 · obstáculos 30 + 30 | ídem |
| **Confirmado** | **220 / 300** | **220 / 300** |
| Pendiente del juez | seguimiento con tres sensores (50) + tarea final (30) = **80** | ídem |
| Integridad | 0 saltos · 0 huecos · 0 arranques no verificados | ídem |

Los registros y las evaluaciones de A y B son independientes (sesiones, pistas y eventos distintos; en B el cuarto «inicial» es el 3.º físico).

### 5 · Ronda competitiva real (navegador, reloj de pared, `tests/firvi-integral-ui.mjs`)
Sin reloj falso ni atajos: se elige la pista, se activa la competencia, **Iniciar ronda** (corre el reloj de 8:00), 15 s de calibración, **Comenzar recorrido**, Ejecutar, se pulsa el Pulsador y se espera al robot. Verificado en la propia ronda: edición y cambio de pista bloqueados, estados
(Preparación → Calibración → Recorrido puntuable → Ronda finalizada), reloj 07:45 tras la calibración, superación de los cuartos 1 y 2 a los 78 y 117 s, checkpoint, `end-reached` a los 169 s (dentro de 8:00), eventos físicos (un `sweep` por prisma, sin `push` ni `contact`),
evaluación automática de 220 pts y 80 pendientes del juez, tiempo final 02:49 (parada voluntaria), mejor ronda y suma informadas sin ganador. Registros: `docs/firvi-2025-integral/ronda-real-A.json` y `ronda-real-B.json` (+ capturas).

**Tiempos de las distintas mediciones.** El programa recorre la pista en ≈153 s simulados en todas las mediciones; lo que cambia es la calibración incluida en el reloj de la ronda: 15,3 s en la ronda real de Chrome (reloj de pared: 15,5 + 153 ≈ 169 s), 20 s en `tests/integration/full-run.cjs` (≈173 s) y 60 s en `tests/pending/firvi-full-autonomous-run.cjs` (≈213 s). Los 213 s no son tiempo de pista: son 60 s de calibración + 153 s de recorrido. Las tres mediciones quedan dentro de los 8:00.

**Evidencia del cuarto final.** `end-reached` solo se registra si ya consta la superación del último plano (cuarto 2) y la punta del robot llega a la base opuesta (`firvi-competition.js`). Los 60 pts del cuarto final los otorga el evaluador solo si el cuarto intermedio consta superado y su recorrido fue continuo con lectura de sensores (`evidence.middleRoom`); si no, quedan pendientes del juez. La llegada a la zona geométrica no basta.

### 6 · Criterios de puntuación
Sin cambios: ni umbrales ni reglas del evaluador se modificaron para sumar puntos; los parámetros siguen marcados como provisionales. Los 50 pts de seguimiento con tres sensores y los 30 de la tarea final **permanecen pendientes del juez**.
En una ronda perfecta del programa de referencia el máximo confirmado automáticamente es 220 de 300.

### 7 · Pruebas
`tests/firvi-integral.cjs` (8 comprobaciones, ≈ 3 min, procesos paralelos), `tests/firvi-integral-ui.mjs` (ronda real, ≈ 3 min por recorrido, `FIRVI_ROUTES=A,B`) y `tests/pending/firvi-full-autonomous-run.cjs` (activada; `FIRVI_E2E=1`).
El diagnóstico (`tests/pending/firvi-full-run-diagnostic.cjs`) conserva el programa heredado para reproducir el bloqueo.

### 8 · Riesgos que impiden declarar finalizada la simulación
1. **Posiciones y orientación de los prismas son una inferencia** (sobre los cuadros rojos): el programa y sus parámetros están ajustados a esta disposición; con otra, habría que rehacer la afinación (no el evaluador).
2. **Margen estrecho en el 2.º prisma**: despeje de 8,9–9,3 cm frente al umbral de 8,3 cm (provisional). Un cambio de 1 cm en la distancia de golpe lo cruza. El criterio de liberación mide contra *toda* la ruta, incluidos tramos ya recorridos.
3. **Sensibilidad del programa** al giro de fin de curva y a la distancia de golpe (ventana estrecha, ver §2); no se probó con otros robots, cargas ni ruido en los sensores.
4. Una ejecución con una sola llegada por recorrido en ronda real; las 36 llegadas de aislamiento cubren desvíos pequeños, no un robot muy desalineado.
5. **Los 80 pts restantes dependen del juez** (seguimiento con tres sensores, tarea final); la «intersección» sigue sin identificar.
6. Ambigüedades de las bases sin resolver (cuadros rojos, gaps en intentos distintos, VI.A.2 vs VI.B.1, desempate), estado y decisiones del juez en memoria y falta de la hoja de resultados firmable.

## Qué falta

**Etapa B (comportamiento competitivo):** dos rondas de 8 min con calibración incluida y cronómetro; inicio de recorrido tras la calibración; falta de
progreso (V.G.1–2) y su detección; 3 intentos por cuarto; reinicio desde base/checkpoint (V.G.4–6); checkpoint al superar el cuarto inicial;
retirar obstáculos antes de la ronda (la base ya existe: escenario vacío); finalización voluntaria; restricciones de intervención durante la ronda
(sin subir código, sin recolocar piezas). Requiere decidir los puntos 1–5.

**Etapa C (evaluación):** un evaluador que **observe** (sin escribir en el simulador) inicio por tacto, tres sensores sobre la línea, obstáculos
desplazados **con movimiento de abanico** (V.E.3: hoy la física distingue barrido y empuje, pero el simulador aún no expone qué hecho produjo el
desplazamiento), cuartos superados por intento (60/40/20), gaps, tarea final; registrar mejor ronda y suma de rondas por separado; criterio de gaps
configurable.

## Variante HEAD-CANVAS (integración local PRE-DEPLOY-2A)

FIRVI se desarrolló sobre la geometría **medida de `main`** (sensores de línea a 8,0 cm del eje con 1,9 cm de separación, sonar a 7,40 cm, ruedas a 10 cm). Producción es HEAD-CANVAS
(sensores a 6,0 cm con 2,8 cm de separación, sonar a 9,83 cm con yaw de la cabeza, ruedas a 12 cm). Esta rama integra FIRVI **sobre HEAD-CANVAS sin trasladar la geometría de `main`**:
la física, los sensores, la cabeza y la garra son los de HEAD-CANVAS; las pistas S01–S08, Óvalo y Ocho se comportan igual (`tests/compare-head-canvas.cjs`).

### Qué se adaptó (y por qué)
| Elemento | Antes (geometría de main) | Ahora (HEAD-CANVAS) |
|---|---|---|
| Evaluador: barra de sensores | `sensorFrontCm = 8`, `tightCm = 3,5` fijos | se leen de `LINE_SENSOR.geometry`: `front` (6,0) y `spread + 1,6` (4,4 cm). Sin `LINE_SENSOR` (evaluador puro) se usa la referencia 8,0 / 1,9 |
| Expectativas de pruebas | literales 8, 1,9, 7,40 | derivadas de `LINE_SENSOR.geometry` y `HEAD_SONAR.params.faceForward` |
| Programa de referencia | tuneado para 8,0 / 1,9 / 7,40 (se conserva en `tests/integration/reference-program-main-geometry.iroh`) | nuevo `reference-program.iroh` (solo sensores, sonar, servo, Pulsador y tiempo) |
| Seguidores de prueba (SWEEPER, FOLLOWER) | sin búsqueda al perder la línea | balanceo corto al perder la línea (ver abajo) |
| Prueba de la secuencia B | seguidor mínimo | programa de referencia (el mínimo deja el prisma sobre la línea) |
| Instantes de la ronda | «a los 62 s superó el cuarto 1» | se espera a la condición (en HEAD-CANVAS ≈ 64 s) |

### Causas encontradas (diagnóstico del recorrido B, 22 233 colisiones)
1. **Prisma a la salida de una U (B: cuarto 3; en A, el cuarto 1 simétrico).** El sonar no ve el prisma hasta ≈ 10 cm (sale del haz de ±6° mientras el robot gira); el primer barrido
   empieza con el robot a ≈ 26° de la línea y deja el prisma sobre ella; el programa lo embiste. Es la interacción real entre geometría y programa, **no** un defecto del sonar con yaw
   (se verificó contra un cálculo geométrico independiente: lectura 10 cm = 9,8 cm al vértice) ni de la física (clase A: programa incompatible con la geometría).
2. **Segundo barrido (garra aparcada a +1).** Empuja el prisma hacia fuera de la curva siguiente y llega a 7,1–7,9 cm del eje (< 8,3 cm = radio del cuerpo): el evaluador lo rechaza con razón.
   La ventana de poses que sí alcanzan ≥ 8,3 cm es estrecha (máximo físico ≈ 9,2 cm). El programa retrocede ≈ 1,2 cm antes de ese barrido (700 ms a −8 %), con lo que queda a 8,3–9,0 cm.
   Retroceder más de ≈ 1,5 cm hace perder el contacto (el barrido no toca el prisma).
3. **Franja muerta de los sensores.** Con 2,8 cm de separación, una desviación de ≈ 1,3–1,6 cm de la cinta deja los tres sensores en blanco (con 1,9 cm casi no existe). El seguidor avanzaba
   recto «como en un gap» durante 68 cm y el evaluador rechazaba la progresión continua. El programa busca la cinta con un balanceo corto antes de seguir recto.
4. **Evaluador.** `sensorFrontCm` y `tightCm` estaban fijados a la geometría de main; ahora salen de la configuración efectiva.

### Resultado (HEAD-CANVAS, misma física que producción)
| | Recorrido A | Recorrido B |
|---|---|---|
| Completa / faltas / reposiciones / colisiones | sí / 0 / 0 / 0 | sí / 0 / 0 / 0 |
| Tiempo de ronda (reloj de competencia, con 20 s de calibración) | 182 s | 185 s |
| Confirmado | 220 / 300 | 220 / 300 |
| Pendiente del juez | 80 (seguimiento 50 + tarea final 30) | 80 |
| Despeje del prisma (1.º / 2.º) | 10,8 / 8,9 cm | 13,8 / 8,8 cm |

Aislamiento (4 prismas × 9 llegadas con desvíos de ±1,5 cm y ±8°): 36/36 con despeje ≥ 8,3 cm (A: 9,8–11,5 y 8,5–8,9 cm; B: 13,6–13,9 y 8,4–8,9 cm). Los segundos prismas tienen
**margen de solo 0,1–0,6 cm** sobre el umbral: es una limitación de la geometría del barrido, no un margen de diseño.

### Limitaciones conocidas
- El programa de referencia es sensible a su ajuste: el balanceo con amplitud 7 u 9 completa A y B con 220; con 6, 8, 10 y 12 puntúa menos o no termina. Se eligió 9 y se verificó con cuatro instantes de pulsación.
- El programa tuneado para main, ejecutado en HEAD-CANVAS, completa A pero no B (el robot embiste el primer prisma).
- Nada de esto se comprobó en el robot físico.
