# Modo calibración (SIM-CALIBRATION-1)

Estado: **simulación determinista**. No es una calibración física del hardware.

> The simulated sensor model is not yet a physical calibration of the real IROH hardware.
>
> If the NNJ did not program a reading to appear on the LCD, calibration does not show it.

## Qué es
Un modo de **interfaz** para que el NNJ estime por sí mismo el umbral de sus sensores de línea:

1. Escribe su programa e inicializa/lee los sensores que quiera.
2. Decide qué valores imprimir en la LCD (`escribirPantalla(...)`) y lo ejecuta.
3. Pulsa **Calibración**. El editor se oculta y el plotter se amplía (vista superior). El programa **sigue ejecutándose**.
4. Arrastra el IROH por el plotter y lo gira con el asa. Observa **solo** en la LCD lo que *su programa* decidió mostrar.
5. Estima su umbral. **Salir de calibración** restaura el editor y el layout.

Entrar o salir es un cambio de interfaz, no de runtime: no recarga, no recompila, no reinicia, no cambia el código ni el estado de ejecución
(si corría, sigue corriendo; si estaba detenido, sigue detenido).

## Qué NO hace
No muestra valores crudos, panel de sensores, mínimos/máximos, promedios, umbral sugerido o «correcto», histogramas, gráficos, mapas de calor,
recomendaciones, «negro = X / blanco = Y» ni sugerencias de código. No tiene captura automática de blanco/negro ni cálculo de umbral. El LED de
detección del modelo 3D se apaga en calibración para no revelar lecturas. **No escribe en la LCD**: solo el programa del alumno puede hacerlo.
El diálogo de calibración v1 (`bitiro:line-calibration:v1`) sigue oculto y sin uso; no se migra ni se borra (rollback).

## Cómo se preserva el runtime (pose manual)
`window.BITIRO_MANUAL` (`simulator.js`) es la única vía para mover el robot a mano. Mientras `dragging` es `true`, `update(dt)` omite **solo** la
integración cinemática (0 subpasos): el intérprete, `simTime`, los motores (`R.L`/`R.R`, `wheel`) y el programa siguen corriendo, así que el motor
no «pelea» con el puntero. Al soltar, el robot continúa desde la nueva pose. `place(x, y, th)`:
- exige valores finitos y normaliza el ángulo;
- deja el centro a ≥ `bodyRadius` (8,3 cm) de cada borde del plotter;
- no coloca el cuerpo encima de una caja (si la pose pedida solapa, se desliza por un eje o se queda);
- no cambia geometría, escala, sensores, props ni pistas.

Salvedad (deuda técnica conocida): manual placement collision currently protects the robot body; the gripper footprint is not part of this placement guard.
Tras colocar el robot, la garra puede quedar solapada con una caja.

Al soltar se corta el rastro visual para no dibujar una recta entre poses.

## Interacción
`calibration-mode.js` usa **Pointer Events** (ratón, lápiz y táctil): una zona de agarre sobre el robot (≥ 44 px) y un asa de rotación por delante;
el frente del robot apunta al puntero. Alternativa de teclado: flechas mueven el robot 1 cm (Mayús 5 cm) y, en el asa, giran 5° (Mayús 1°); Esc sale.
No hay campos numéricos de X/Y/ángulo ni deslizadores de coordenadas. La conversión píxel ↔ plano usa la misma cámara que el renderer
(`BITIRO_SCENE_VIEW` en `renderer3d.js`).

## Modelo de sensor simulado (`calibration.js`)
Cada sensor lee **su** posición real: `front = 6 cm`, `spread = 2,8 cm`, rotados por `R.th` (geometría sin cambios). La lectura conserva la escala
didáctica 0–1023 (blanco ≈ 155, negro ≈ 865) y es función pura de (sensor, superficie, posición):

`lectura = round( superficie × luz(x, y) × ganancia[k] + desplazamiento[k] + variaciónLocal(k, x, y) )`

- **Superficie**: el modelo anterior (distancia a la línea → cobertura → 155…865).
- **Light field** (`BITIRO_LIGHT_FIELD.lightAt(x, y)`): iluminación ambiental espacial, continua y suave (leve gradiente + una zona algo más iluminada y otra
  algo sombreada), ≈ 0,97–1,03. Es un concepto **separado de la pista**: no se guarda en el plotter ni son obstáculos/props.
- **Perfil de cada sensor** (`SENSOR_MODEL.DEFAULT`): ganancia `[1,03; 1,00; 0,97]` y desplazamiento `[+4; 0; −3]`. Son números **SIMULADOS**, centralizados y
  fáciles de sustituir; no son valores medidos del IROH real.
- **Variación local**: ±2,2 puntos, suave (periodo ≈ 3 cm), función de sensor y posición.
- **Determinismo**: misma pose + mismo escenario ⇒ misma lectura. No usa `Math.random()`, reloj ni contadores de frame (lo comprueba `tests/calibration.cjs`
  por escaneo de fuente y por ejecución con esas fuentes bloqueadas). Con `SENSOR_MODEL.NEUTRAL` la lectura es exactamente la anterior.
- Efecto práctico: sobre blanco, las lecturas varían ≈ 141–171; sobre negro ≈ 808–924; el umbral 500 de los programas existentes se mantiene (ningún blanco lo
  supera y ningún negro queda por debajo en todo el plotter).

El light field **no se dibuja** (no hay mapa de calor ni sombreado visible): existe solo en el modelo de sensores.

## Pruebas
- `node tests/calibration.cjs` — modelo, determinismo, posiciones de sensores, light field, pose manual, runtime, LCD, compatibilidad con los goldens anteriores.
- `node tests/calibration-ui.mjs` — navegador real (Chrome por CDP): entrar/salir sin recargar, arrastre, rotación, teclado, táctil, límites, 1366/1024/390 px
  (se omite si no hay Chrome). Reutiliza `tests/perf/cdp.mjs`.
- Los goldens SIM-1 cambiaron **solo** por el modelo de sensor: cuatro (`s01_straight`, `s01_turn`, `s01_demo_strike`, `servo_sweep`) únicamente en el campo `sensors`;
  `s02_three_sensors` y `oval_continuous` además desplazan su trayectoria como máximo 0,2 cm y 0,02 rad porque su programa decide con los sensores; `runtime` cambia un caso
  de lectura. `tests/golden/sensor-model-legacy-hashes.json` guarda los hashes de las 7 trazas SIM-1 anteriores y `tests/calibration.cjs` comprueba que con el modelo neutro
  se reproducen exactamente (no demuestra equivalencia para otros programas, pistas o poses).
- `tests/calibration.cjs` incluye una **prueba de referencia determinista** con valores numéricos exactos de `LINE_SENSOR.read()` en dos posiciones: congela el modelo
  SIMULADO (no son mediciones físicas) y fallará a propósito si cambian ganancias, desplazamientos, light field o variación local.

## Despliegue
**`calibration-mode.js` is a required runtime asset.** Es un archivo nuevo y debe publicarse junto con `index.html`, que ya lo referencia.

Actualmente el despliegue parece usar una lista o inclusión explícita **fuera de este repositorio** (aquí no hay script de despliegue; `docs/current-baseline.md` cuenta
«15 archivos en la raíz + 14 assets», una lista que no incluye este archivo). Por tanto, **antes del próximo despliegue debe comprobarse que `calibration-mode.js`
está presente en producción junto con `index.html`**. Sin él la página carga, pero el botón «Calibración» queda visible e inerte y el navegador registra un 404.

`docs/current-baseline.md` no se actualiza en este bloque: se actualizará cuando el nuevo baseline esté committed, desplegado y verificado.

## Limitaciones y decisiones pendientes
- **Colocación manual**: solo protege el cuerpo del robot (ver arriba); la huella de la garra no forma parte de esa guarda.
- **Umbral preexistente**: `leerUmbralLinea()` es una API preexistente que devuelve el umbral del perfil (500 por defecto), y el marcador visual del umbral en «Más datos» también
  es preexistente. Ninguno se muestra dentro del modo calibración (el marcador queda oculto junto con «Más datos»). Se conservan por compatibilidad en este bloque.
  Antes del piloto educativo debe decidirse si siguen formando parte de la experiencia del estudiante.
- **Calibración v1 legacy**: sigue incluida pero oculta (ver «Qué NO hace»); su retirada es una decisión posterior.

## Pendiente: PHYSICAL-CALIBRATION
Medir en el IROH real las lecturas sobre papel blanco y línea negra bajo iluminación conocida; sustituir ganancias, desplazamientos y el light field por
parámetros medidos; decidir si la escala 0–1023 se mantiene; validar la geometría de los sensores (`front`, `spread`) y el comportamiento sobre la superficie real.
Mientras eso no ocurra, no debe afirmarse que estos valores correspondan al hardware.
