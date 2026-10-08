# Integración experimental del IROH 3D (SIM-3D-INTEGRATION-1 y -2)

Estado: **prototipo reversible, experimental**. Solo se activa con `?robot=iroh`. El robot legacy sigue siendo el default.
No hay commit ni deploy. Esta copia no es producción.

## 1. Principio

**Blender = fuente maestra visual. BITIRO renderer = representación runtime optimizada de esa fuente.**

El modelo IROH-BLENDER-1.1 es una *referencia visual*. La física del simulador NO se modifica para que coincida con él.
Quedan separados estrictamente:

| ROBOT PHYSICS (no se toca) | ROBOT VISUAL MODEL (esto) |
|---|---|
| `R.x`, `R.y`, `R.th`, `HIT` (`IROH_MECHANICS.spec`), `LINE_SENSOR.geometry`, sonar funcional, wheelbase, `strike-physics.js`, colisión, runtime, intérprete, pistas, props | `renderer3d.js` (selector + llamada), `iroh-visual.js`, `assets/iroh/iroh-render-v1.js` |

La geometría física medida ya entró en `e980d3d` (PHYSICAL-GEOMETRY-2, `docs/physical-geometry.md`). **SIM-3D-INTEGRATION-2** pone el modelo VISUAL de acuerdo con esa geometría (sección 11); la física sigue sin leerse ni escribirse desde el modelo.

## 2. Auditoría del renderer actual (Phase 1)

- `renderer3d.js` es un rasterizador de polígonos en Canvas 2D con algoritmo del pintor (sin WebGL). Cada frame `render()` (simulator.js) construye
  `robot = {x, y, heading, lineCenter, lineActive[3], strikerAngle, trail}` con interpolación entre pose previa y actual, y llama a `renderScene3D(canvas, track, robot, obstacles, camera)`.
- Escena estática (mesa, líneas, bases) cacheada por pista (`staticScenes`). El robot se **reconstruye cada frame** como lista de caras `{points, fill, layer, alpha, stroke}`, se proyecta, se ordena (capa, luego distancia media) y se rellena.
- Marco local del robot: `local(f, r, y)` con `f` = delante, `r` = derecha del robot, `y` = altura; mundo = `(X(R.x), y, Z(R.y)) + f·(cos h, sin h) + r·(−sin h, cos h)`, con `h = R.th − π/2` (`heading`). Unidades: cm.
- Piezas animadas hoy: **solo el palo de golpe** (`robot.strikerAngle`, misma cinemática que `strike-physics.js`) y el color de los LED de los 3 sensores (`robot.lineActive`). Las **ruedas no giran** (radios fijos); no hay cabeza móvil.
- El renderer consume del robot: `x, y, heading, lineActive, strikerAngle, trail`. No lee `R`, `HIT` salvo `IROH_MECHANICS.spec` para el palo de golpe y `LINE_SENSOR.geometry` para barra/huellas de sensores.
- `cameraRig(track, robot, camera, w, h)`: UNA sola matemática de cámara para dibujar y para `pickGround` / `projectGround` (usados por Calibration Mode). Solo usa `robot.x/y` (cámara `follow`). **No depende de la geometría del robot**, por lo que cambiar el modelo visual no la afecta.
- Calibration Mode (`calibration-mode.js`) usa `BITIRO_SCENE_VIEW.pickGround/projectGround` y `BITIRO_MANUAL` (pose manual, límites con `HIT.bodyRadius`). El LED de detección se apaga en calibración (`lineActive` = false) — sin cambios.
- Robot legacy: **504 caras** por frame (`LEGACY_ROBOT_RENDER_FACES`, medido en la perspectiva por defecto de S01; incluye sombra, huellas y palo de golpe).

## 3. Opciones evaluadas (Phase 2)

| | A. Mesh triangulado simplificado | B. Especificación runtime de polígonos generada desde el GLB | C. Equivalente manual con primitivas del renderer |
|---|---|---|---|
| Fidelidad | alta | alta (silueta, ruedas de 5 radios, cabeza, ultrasónico, pan/tilt, sensores) | media; deriva del Blender |
| Caras/frame | 3224 triángulos (≈ 6,4× el legacy) o decimado manual | 950 polígonos en el asset → **≈ 480 tras culling de caras traseras** | ≈ legacy |
| CPU | alta (painter sort sobre ~1600 caras visibles) | ≈ legacy (medido, ver informe) | ≈ legacy |
| Asset | ~190 KB | **≈ 60 KB** | 0 (código) |
| Mantenimiento | requiere decimador o un LOD hecho a mano | **regenerable por script, determinista** | cada cambio del Blender se re-teclea; ya ocurrió con el procedural actual |
| Articulaciones | piezas separadas posibles | piezas nombradas del Blender conservadas (`WHEEL_*`, `HEAD_*`, `SERVO`…) | totales |

**Elegida: B.** A se descarta por costo de CPU/caras con painter sorting; C porque rompe la relación «Blender es la fuente» y no es regenerable.
Three.js/WebGL quedan fuera del alcance por regla del bloque.

## 4. Formato del asset runtime (Phase 5)

`assets/iroh/iroh-render-v1.js` — script clásico (carga estática desde `index.html`, sin `fetch`, sin loader GLTF), versionado por nombre:

```js
window.IROH_RENDER_V1 = Object.freeze({
  version:'iroh-render-v1', source:'iroh_lowpoly.glb', sourceSha256:'…', unit:0.01,   // enteros en 0,01 cm
  stats:{sourceTriangles, polygons, parts}, palette:['#rrggbb', …], names:['CASTER', …],
  parts:[ [ [colorIdx, f,r,up, f,r,up, …], … ], … ]                                   // un array de polígonos por pieza
});
```

Es **solo apariencia**: sin física, sin sensores funcionales, sin medidas del simulador, sin fotos ni referencia al `.blend`.

### Regeneración reproducible

```bash
node tools/build-iroh-render-asset.mjs [ruta/iroh_lowpoly.glb]        # por defecto ../../exports/iroh_lowpoly.glb
node tools/build-iroh-render-asset.mjs --check                        # verifica que el asset coincide byte a byte
```

Sin dependencias. Lee el GLB con Node puro (`exports/iroh_lowpoly.glb`, generado por `scripts/build_iroh.py` desde `blender/iroh_master.blend`), compone las traslaciones de nodo, convierte al marco de BITIRO, **fusiona triángulos coplanares del mismo material en polígonos** (3224 → ~1000) y aplica una política por pieza (tabla `POLICY` en el script):

- `keep`: fusión coplanar completa; se descartan polígonos < 0,035 cm² (tornillos, patillas). `CASTER` usa 0,3 cm².
- `hull`: caja envolvente (servos, soportes, placas IR: cajas en el Blender real).
- `drop`: cables (`WIRES_SIMPLIFIED`).
- Una pieza `keep` que supere 140 polígonos (salvo ruedas, chasis, placa roja, caster) pasa a `hull`.
- Los agujeros de las placas (ventanas de motor, ranura de cable) no se conservan: se rellena el contorno exterior.

Cambiar el modelo en Blender → exportar GLB → `build-iroh-render-asset.mjs` → el asset cambia. El test `tests/iroh-visual.cjs` (#2) falla si el asset deja de ser regenerable.

## 5. Escala y marcos (Phase 6)

```
Blender (Z arriba, FRONT = −Y, izquierda = +X, 1 BU = 1 m)
  ── glTF export (Y arriba): X izq, Y arriba, Z delante ──
      f  = +Z_gltf = −Y_Blender    (delante del robot)
      r  = −X_gltf = −X_Blender    (DERECHA del robot; Blender +X es la izquierda)
      up = +Y_gltf = +Z_Blender    (altura sobre el suelo)
  ── × 10 000 → enteros de 0,01 cm (asset) ──
  ── × unit × IROH_VISUAL_SCALE (iroh-visual.js) → local(f, r, up) del renderer, cm ──
  ── renderer3d.js local(): mundo = (X(R.x), up, Z(R.y)) + f·(cos h, sin h) + r·(−sin h, cos h),  h = R.th − π/2 ──
```

La transformación glTF → (f, r, up) tiene determinante −1 (invierte lateralidad); el generador invierte el devanado de cada triángulo para conservar «antihorario visto desde fuera» (normal de Newell hacia fuera), que el renderer usa para el culling de caras traseras.
La orientación coincide con `R.th` porque se usa exactamente el mismo `local()` que el robot legacy. **Desde INTEGRATION-2 el origen del asset es `R` = centro del eje de ruedas** (en INTEGRATION-1 era el centro de la placa, `IROH_ROOT` del Blender); la reubicación Blender→R se hace en el generador (sección 11).

**`IROH_VISUAL_SCALE = 1`** (`iroh-visual.js`): 1 cm del Blender = 1 cm del renderer. Se eligió 1 porque el modelo conserva las dimensiones físicas medidas (placa 17,6 × 11,0; ruedas Ø6,5; alto 20,8; ancho exterior 12,5). No se escala para «llenar» la huella física del simulador.

### Diferencias conocidas modelo visual ↔ física (estado tras INTEGRATION-2)

| Aspecto | Visual (asset en marco R) | Física del simulador | Estado |
|---|---|---|---|
| Separación de ruedas | 10,0 cm centro-centro (12,5 exterior) | `base=10` | **alineado** (INT-2) |
| Eje de ruedas | f = 0 (= R) | R = eje | **alineado** (INT-2) |
| Centro de placa | −2,3 cm, borde frontal +6,5 | solo documentado | **alineado** (INT-2) |
| Sensor de línea | PCB centradas en (+8,0 ; 0 / ±1,9) | `LINE_SENSOR.geometry = {8, 1.9}` | **alineado**; el punto óptico centrado en la PCB es SUPUESTO |
| Cara del sonar | caras TX/RX ≈ +6,64 (PHOTO-CONSTRAINED / PROVISIONAL) | origen del sonar `SONAR_FACE_FORWARD` = +7,40 (6,50 + 0,90, DERIVED_FROM_PHYSICAL_MEASUREMENTS) | **desacople visual pendiente 7,40 − 6,64 = 0,76 cm (el visual va 0,76 cm por detrás; se corregirá aparte)** |
| Servo / pivote del palo | `SERVO` centrado en `pivotForward` 8,6 | `IROH_MECHANICS.spec` | **alineado**; el pivote es SUPUESTO de simulación |
| Radio del cuerpo | −11,1 … +9,5 cm desde R (placa 17,6 × 11,0) | `bodyRadius` 8,3 | **SIN alinear a propósito** (SIMULATION_ASSUMPTION; pendiente de PHYSICAL-COLLISION-1) |
| Largo de PCB de sensor | 3,0 (Blender) | 3,1 medido | residual 0,1 cm, sin corregir (no afecta a la física) |
| Palo de golpe | no existe en el modelo; se dibuja con `IROH_MECHANICS.spec` | pivote 8,6, largo 13,2 | sin cambios |
| Caster | atrás (como el robot real) | el robot legacy lo dibuja delante | sin cambios |

## 6. Sensores visuales vs funcionales (Phase 9)

Las placas `LINE_SENSOR_L/C/R` del modelo son **solo visuales**. NO cambian `LINE_SENSOR.geometry`, `readLine()` ni el muestreo. Las **huellas** de lectura (círculos sobre el suelo) siguen dibujadas en los puntos *funcionales* `LINE_SENSOR.geometry` (hoy `front=8, spread=1.9`), como en legacy. Desde INTEGRATION-2 las PCB visuales están centradas sobre esos mismos puntos, así que cada huella queda bajo su PCB (INTEGRATION-1 las mostraba ≈ 3 cm detrás). La huella sigue siendo la fuente de verdad de dónde lee la física; la PCB solo la acompaña. El LED de detección sigue oculto en Calibration Mode.

## 7. Selector legacy / iroh-v1 (Phase 4)

- `?robot=iroh` → `iroh-v1`. Cualquier otro valor o ausencia → `legacy` (default). Sin `localStorage`, sin control visible para el estudiante.
- Implementación: `renderer3d.js` calcula `ROBOT_MODEL` una vez al cargar. **Carga (SIM-3D-INTEGRATION-2A): `<script>` estáticos en `index.html`** (`assets/iroh/iroh-render-v1.js` e `iroh-visual.js`, antes de `renderer3d.js`; autoalojados, `script-src 'self'`, sin inline, sin CDN, sin `eval`, **sin `document.write`**). Justificación del coste en legacy: se descargan ≈ 60 KB (cacheables) y solo se evalúa la definición del módulo; `iroh-visual.js` procesa el asset de forma perezosa en la primera llamada a `build()`/`frame`, que solo ocurre con `?robot=iroh` (`IROH_VISUAL.prepared === false` en legacy). `tests/ui-contract.cjs` se actualiza si fija la lista de scripts.
- Fallback: si el flag está activo pero el modelo no cargó (`IROH_VISUAL`/`IROH_RENDER_V1` ausentes), `renderScene3D` dibuja el robot legacy. `window.BITIRO_RENDER_STATS = {model, robotFaces}` informa del modelo realmente dibujado y del nº de caras del robot por frame.
- Rollback: borrar `?robot=iroh` de la URL; o eliminar `iroh-visual.js`, `assets/iroh/`, sus dos `<script>` de `index.html` y las líneas marcadas `SIM-3D-INTEGRATION-1`/`iroh` en `renderer3d.js` (el robot legacy queda byte a byte igual: su código solo se envolvió en `if(iroh)…else{…}`).

## 8. Presupuesto de caras (Phase 15)

Regla de diseño: IROH ≤ 600 caras Canvas por frame (no es una medida física ni un test dogmático).

- Asset: 950 polígonos (de 3224 triángulos).
- Por frame: el renderer hace **culling de caras traseras** (los sólidos del Blender son cerrados) con la normal exterior precomputada → **≈ 450–480** caras del robot (incluye sombra, huellas y palo de golpe), frente a **504** del legacy.
- Medición real en `docs`/informe de la auditoría y en `tests/iroh-visual.cjs` (#10).

## 9. Articulaciones (Phase 8)

El asset conserva piezas separadas con nombre (`WHEEL_L/R`, `HEAD_RED_PLATE`, `ULTRASONIC_*`, `HEAD_SERVO_*`, `SERVO`…), por lo que una futura rotación de ruedas o `HEAD-SERVO` puede aplicarse por pieza (`HEAD_PIVOT` del Blender está en (0, −6, 10,6) cm). **No se implementó ninguna articulación nueva**: ruedas sin giro (igual que legacy), cabeza en pose neutral, palo de golpe animado como siempre.

## 10. Lo que NO entra

Fotografías, `.blend`, backups, `source-zips`, referencias privadas: no se copian al simulador. Solo el asset derivado y esta documentación técnica.

## 11. Alineación con la geometría medida (SIM-3D-INTEGRATION-2)

Marco: **R = centro del eje de ruedas**. `tools/build-iroh-render-asset.mjs` traslada cada pieza **solo en `f`** (`r` y `up` intactos) con la tabla `RELOCATE`/`shift*`; los desplazamientos se **miden sobre el propio GLB**, no se copian del Blender, y se imprimen al regenerar (`df=…`).

| Grupo de piezas | Condición | Clase | Desplazamiento en f |
|---|---|---|---|
| chasis, placas, electrónica, separadores, caster, sensores de obstáculo | centro de placa = −2,3 (borde frontal +6,5) | DERIVED_FROM_PHYSICAL_MEASUREMENTS | −2,30 |
| `WHEEL_L/R`, `MOTOR_L/R` | centros de rueda = (0, ±5,0) | PHYSICALLY_MEASURED | −2,00 (el eje del Blender estaba a +2,0: ESTIMADO DE FOTO; lo medido manda) |
| `LINE_SENSOR_C/L/R` + soporte | punto óptico central = +8,0; laterales ±1,9 | PHYSICALLY_MEASURED / DERIVED_FROM_PHYSICAL_PCB_GEOMETRY | −1,30 |
| cabeza (`HEAD_*`, `ULTRASONIC_*`) | centro de la base negra = +3,95 (traslación rígida); cara TX/RX ≈ +6,64; el sonar funcional está en +7,40 (desacople visual pendiente 0,76) | DERIVED_FROM_PHYSICAL_MEASUREMENTS (base) / PHOTO-CONSTRAINED, PROVISIONAL (TX/RX) | −2,05 (antes −4,69) |
| `SERVO`, `FRONT_MECHANISM` | centro del servo = `pivotForward` 8,6 | SIMULATION_ASSUMPTION (visual sigue a la física) | −1,00 |
| `LCD` | posición de placa (la base de la cabeza ya no lo limita) | ESTIMADO DE FOTO | −2,30 (antes −2,79 con holgura +1 mm) |

Lo que **no** se tocó: `simulator.js`, `calibration.js`, `strike-physics.js` (`bodyRadius`, striker), intérprete/runtime, pistas, starters, goldens, `max` de rueda, rampa del motor. El modelo sigue sin leer ni escribir `R`, `HIT` ni `LINE_SENSOR`.
`renderer3d.js` solo añade, bajo el flag, un desplazamiento de 0,8 cm a la sombra elíptica (el cuerpo ya no está centrado en R). El robot legacy no cambia.

Pruebas: `tests/iroh-visual.cjs` #11–#14 comparan el asset con las constantes funcionales **leídas** del simulador (nunca al revés).

### Validación pendiente (no ejecutable en este servidor)
No hay Chrome/Chromium en la máquina de trabajo: `tests/iroh-visual-ui.mjs`, `tests/calibration-ui.mjs` con `BITIRO_TEST_QUERY=?robot=iroh` y `tests/perf/iroh-ab.mjs` quedan **PENDING LOCAL BROWSER VALIDATION**. En su lugar: capturas SVG generadas con el renderer real (sin navegador) y un A/B de CPU de `renderScene3D` en Node (`tests/perf/iroh-ab-node.cjs`), que **no sustituyen** la medición en navegador.

## 9. Encuadre de la cámara Robot con IROH (SIM-3D-INTEGRATION-2A)

- **Causa del recorte**: el preset `robot` (`follow`, `elevation .45`, `azimuth −1,12`, `distance .37`) miraba al suelo bajo `R` desde `0,37 × max(ancho,alto de la pista)` (51,8 cm en S01). El IROH mide ≈ 20,8 cm de alto (vs ≈ 8 del legacy), así que la cabeza salía por el borde superior (≈ −124 px en un canvas de 790×520).
- **Solución** (`robotFrame()` en `renderer3d.js`, solo con `?robot=iroh`, `follow` y `camera.distance ≲ .6`): el objetivo sube al centro vertical del modelo (`IROH_VISUAL.frame.centerUp`) y la distancia sale de la esfera envolvente del asset (`frame.radius`, calculada de sus vértices) y del tamaño real del canvas, con un margen del 12 %. `camera.distance` sigue siendo el zoom del usuario (relativo al preset `.37`). El peso baja a 0 en `distance .6`, de modo que `follow` (`.8`), `perspective`, `top` y Calibration quedan idénticos. Sin constantes por escenario.
- Parámetros: antes → objetivo `y = 0`, distancia `0,37·reach`; ahora → objetivo `y ≈ 10,4 cm`, distancia ≈ 70 cm (depende del aspecto del canvas). Legacy: sin cambios.
- Límite conocido: en esta cámara la vista es desde DELANTE del robot; el obstáculo frontal de S01 queda entre la cámara y el robot, bajo el borde inferior (igual de fuera de cuadro que con el robot legacy). Mostrarlo exigiría alejar la cámara hasta que el robot ocupe ≈ 40 % del alto. Se deja como decisión pendiente.

## 10. Barra del striker (SIM-3D-INTEGRATION-2A)

- Origen: **solo** el overlay de `renderer3d.js` (geometría de `IROH_MECHANICS.spec`). El asset no trae barra (`SERVO` y `FRONT_MECHANISM` terminan en up 5,8 y no tienen palo): **no hay duplicación**.
- Mejora visual sin medidas nuevas: tapa circular de radio = semiancho de la barra sobre el pivote y sesgo de profundidad para que la barra (que nace a 5,18 cm, por debajo de la cara superior del servo, 5,8) no quede tapada por el servo. Pivote 8,6, largo 13,2, semiancho, ángulos, velocidad, colisión y HIT no cambian.
- Deuda: la barra sigue siendo una prisma delgada (1,04 cm de ancho, 13,2 de largo) sin horn/brazo modelado en el Blender. Un rediseño exigiría medidas del palo real; no se inventan.
