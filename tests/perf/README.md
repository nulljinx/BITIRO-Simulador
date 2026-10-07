# tests/perf — SIM-LOW-END-1 (rendimiento en cliente)

Mide el costo en el **navegador** (render Canvas 2D, rAF, runtime, física, editor) con throttling sintético de CPU vía Chrome DevTools Protocol.
No mide servidor ni CDN (eso es `tests/load/`, SIM-LOAD-1). No es una suite funcional (`tests/*.cjs`) ni forma parte de ella.

> Synthetic CPU throttling is not a substitute for validation on actual school hardware.

## Qué hace
- Sirve la raíz del repo con un servidor estático local (Node, sin dependencias) con los mismos headers de seguridad/CSP que producción y caché HTTP activa
  (red caliente, sin CDN). **No hay build:** el producto son archivos estáticos; no se usa nginx.
- Lanza Chrome/Chromium (de `~/.cache/ms-playwright` o `CHROME_BIN`) y lo controla por CDP con el `WebSocket` nativo de Node ≥ 22 (sin Playwright ni npm).
- Instrumenta **sin tocar el producto** (`Page.addScriptToEvaluateOnNewDocument`, `Runtime.evaluate`, CDP): frames con `requestAnimationFrame`, `longtask`,
  Event Timing, `Performance.getMetrics`, perfil de CPU por muestreo (V8) y lectura de globals existentes (`simTime`, `R`, `mode`, `paused`, `frameCounter`).
- Viewport 1366×768, DPR 1, mismos en todos los perfiles.

## Perfiles (CPU throttling sintético; no equivalen a ningún equipo concreto)
| id | nombre | throttle |
|---|---|---|
| p0 | BASELINE | 1× |
| p1 | SCHOOL-LOW | 4× |
| p2 | STRESS | 6× |

Memoria: **MEMORY PRESSURE = NOT SIMULATED** (no se limita la RAM). Se mide memoria observable (JS heap tras GC, nodos, documentos, RSS del renderer).

## Escenarios (fixtures existentes del repo; no se inventan programas)
- **A IDLE** (S01, sin programa, 30 s): costo base de UI + escena.
- **B SIMPLE-RUNTIME** (S02, `EJ[1]` = seguidor de 1 sensor, Pulsador presionado, 60 s).
- **C COMPLEX-RUNTIME** (S02, «S06 literal» de `tests/runtime-functions.cjs`: funciones propias + sonar + decisiones, 60 s).
- **D PROPS/PHYSICS** (S01, `APPROACH(10)` de `tests/strike-audit.cjs` sobre la caja de práctica: sonar + prop + física + servo de golpe, 60 s).
  El robot sale de la pista a los ~23 s de simulación; el harness pulsa Reiniciar y Ejecutar cuando el programa termina (como lo haría el alumno) y reporta los ciclos.
- **E EDITOR** (simulador detenido; ~30 líneas): 108 acciones de teclado reales por CDP (escribir, Enter, flechas, Backspace, Ctrl+Z).
  El editor es un `<textarea>` con resaltado propio (`syntax-highlight.js`); **no es Monaco**.
- Las combinaciones programa/pista se eligieron comprobando con `tests/sim1/harness.cjs` que el programa sigue activo 60 s de simulación.

Cada `perfil × escenario` se repite 3 veces (se reporta la mediana y el peor p95/p99). Hay 5 s de calentamiento y 5 s de enfriamiento entre corridas.

### Aislamiento entre corridas
- Se reutiliza **un solo proceso de Chrome** durante toda la matriz (no hay browser ni contexto nuevo por corrida).
- Cada corrida usa una **pestaña nueva** (`Target.createTarget`) en el contexto por defecto.
- El almacenamiento por origen (`localStorage`, `sessionStorage`, IndexedDB y cookies) se limpia al empezar cada corrida.
- La **caché HTTP permanece caliente a propósito** (el bloque mide CPU/render, no red).
- Al cerrar cada página (`page.close()`) se cierra su target y también se elimina su listener CDP (`browser.on()` devuelve la función que lo desregistra);
  `page.close()` es idempotente y se llama en `finally`.

## Métricas
- Frames (rAF): FPS, delta p50/p95/p99/máx, % > 33,3 / 50 / 100 ms, % de frames > 25 ms (vsync de 60 Hz perdido). Clasificación orientativa, con el p95 **literal**:
  GREEN p95 ≤ 33,3 ms; YELLOW p95 > 33,3 y ≤ 50 ms; RED p95 > 50 ms. **No es un umbral de producto.**
  Los timestamps de rAF caen en múltiplos de vsync (2 vsyncs = 33,3–33,4 ms; 3 = 50,0–50,1), así que un p95 de 33,4 ms (2 vsyncs, ≈30 FPS) queda en YELLOW.
  **TOL (1 ms) se aplica solamente a los buckets de frames excedidos (> 33,3 / > 50 / > 100 ms). La clasificación GREEN/YELLOW/RED usa el p95 literal.**
  p50/p95/p99 se informan sin modificar.
- Long tasks (`PerformanceObserver('longtask')`, > 50 ms): cantidad, total, máximo, por minuto, % del tiempo.
- Hilo principal (`Performance.getMetrics`): % del tiempo en tareas, script, layout y style durante la ventana.
- Memoria: `JSHeapUsedSize`, `JSHeapTotalSize`, nodos, documentos, frames (tras `HeapProfiler.collectGarbage`, fuera de la ventana medida) y RSS del renderer (`/proc`).
  El RSS es **aproximado**: se toma el máximo entre los procesos renderer observables (incluida la pestaña `about:blank` inicial), y no debe confundirse con el JS heap.
  La ejecución prolongada (`--long`) toma el heap tras GC cada 60 s para buscar crecimiento sostenido.
- Startup: DOMContentLoaded, load, «UI utilizable» (2 frames de la app tras `load`) y primer frame estable (10 frames consecutivos ≤ 50 ms).
- Editor: RTT de `Input.dispatchKeyEvent` y Event Timing (duración, retardo de entrada, procesamiento; la API solo informa eventos ≥ 16 ms).
- `simulation_speed_ratio` = Δ`simTime` / Δtiempo real (mediana de la ventana y mínimo en tramos de 5 s). `simTime` es un global existente del simulador.
- Corrección bajo carga: errores de consola/excepciones, valores finitos (sin NaN/∞), canvas no vacío, LCD y editor presentes,
  Pausa/Continuar/Reiniciar responden. La comparación con P0 (`state_vs_p0`) usa los ticks coincidentes (mismo `simTime` exacto) frente a P0 rep 1 y compara **solamente
  `R.x`, `R.y` y `R.th`**; no demuestra equivalencia de sensores, LCD, caja ni ruedas. Los valores finitos (sin NaN/∞) se comprueban solo al final de la corrida.

## Uso
```
node tests/perf/sim-low-end.mjs                        # matriz completa (3 perfiles × 5 escenarios × 3 repeticiones)
node tests/perf/sim-low-end.mjs --profiles p0,p1 --scenarios idle,complex --reps 1 --window 20
node tests/perf/sim-low-end.mjs --long 300             # añade ejecución prolongada (P0 y P1) con heap cada 60 s
node tests/perf/sim-low-end.mjs --headed               # Chrome con ventana (WSLg/escritorio); por defecto headless=new
```
Opciones: `--profiles`, `--scenarios`, `--reps`, `--window` (60), `--idle-window` (30), `--warmup` (5), `--cooldown` (5), `--cpu-profile` (10 s, solo rep 1; 0 = off), `--long`, `--out`.
Resultados (`.json` + `.md`) en `tests/perf/results/` (ignorado por git).

## Reproducibilidad: el host cambia de velocidad
El throttling de CDP es **relativo** a la velocidad real del host. En este portátil (WSL2) el mismo código con el mismo throttle nominal varió ~1,6× entre sesiones
(utilización del hilo principal en P0: 25 % a 48 %; P1 en D: 36 a 59 FPS) y dentro de una misma sesión (repeticiones, deriva a lo largo de horas).
Por eso: (1) comparar escenarios solo dentro de una misma sesión; (2) leer siempre la utilización del hilo principal en P0 (coste por frame ≈ `tarea % × 16,7 ms`);
(3) reportar el rango entre repeticiones y sesiones, no una sola cifra. Los resultados incluyen `host.busy_pct`, `load1` y `MemAvailable` por corrida.
`--summarize a.json,b.json --out base` fusiona resultados (el archivo posterior reemplaza los escenarios que contiene).
`simulation_speed_ratio` se calcula sumando solo tramos continuos con el programa activo (un Reiniciar pone `simTime` a 0 y se excluye).
La comprobación de Pausa/Reiniciar puede caer entre ciclos de D (botón Pausar deshabilitado por diseño con el programa terminado); no es un fallo del simulador.
`iteration_duration` o equivalentes por fase no se miden; el costo por frame se infiere de `Performance.getMetrics`.

## Limitaciones
- El throttling de CPU de CDP escala el tiempo de la tarea del hilo principal; no reproduce caché, memoria, térmica, GPU ni el compositor de un equipo real.
- Sin GPU en este host (WSL2 sin `/dev/dri`): Canvas 2D y compositing en software. Un equipo con GPU puede comportarse distinto.
- rAF queda limitado a 60 Hz: en P0 el FPS no puede superar 60 y se oculta el margen; la utilización del hilo principal sí lo muestra.
- El servidor local no comprime (gzip/brotli) ni pasa por Cloudflare; no se mide red.
- Event Timing no informa eventos < 16 ms: sus percentiles están sesgados al alza en perfiles rápidos.
