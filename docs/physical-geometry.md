# Geometría física funcional (PHYSICAL-GEOMETRY-2)

Este documento registra qué parte de la geometría **funcional** del simulador procede de medidas físicas del IROH entregadas por el usuario, qué es derivado y qué sigue siendo supuesto. **No afirma que el robot esté completamente calibrado.**

`R` = centro cinemático del eje de ruedas. Todas las distancias longitudinales se miden desde `R`, positivas hacia delante.

## Clasificación

| Valor | Antes | Ahora | Clase | Dónde vive |
|---|---|---|---|---|
| wheelbase (centro-centro de ruedas) | 12 | **10,0 cm** | PHYSICALLY_MEASURED | `simulator.js` (`base=10`) |
| sensor central: eje → punto óptico (`front`) | 6 | **8,0 cm** | PHYSICALLY_MEASURED | `calibration.js` (`LINE_SENSOR.geometry.front`) |
| cara frontal de los transductores (origen del sonar, `SONAR_FACE_FORWARD`) | 9,83 (histórico, sin fuente) → 4,0 (PHYSICAL-GEOMETRY-2, mal interpretado) | **7,40 cm** (SONAR-PHYSICAL-ORIGIN-1B) | DERIVED_FROM_PHYSICAL_MEASUREMENTS (6,50 PHYSICALLY_MEASURED + 0,90 PHYSICALLY_MEASURED) | `simulator.js` (`readSonarDistance`) |
| separación entre sensores (`spread`) | 2,8 | **1,9 cm** | DERIVED_FROM_PHYSICAL_PCB_GEOMETRY | `calibration.js` (`LINE_SENSOR.geometry.spread`) |
| centro de la placa respecto de R | — | **−2,3 cm** (2,3 cm detrás de R) | DERIVED_FROM_PHYSICAL_MEASUREMENTS | solo documentado |
| `max` rueda | 23 cm/s | 23 | SIMULATION_ASSUMPTION | `simulator.js` |
| rampa de motor | 240 %/s | 240 | SIMULATION_ASSUMPTION | `simulator.js` |
| `bodyRadius` | 8,3 | 8,3 | SIMULATION_ASSUMPTION (no es la envolvente física medida) | `strike-physics.js` |
| `sonarHeight` | 15,1 | 15,1 | SIMULATION_ASSUMPTION | `strike-physics.js` |
| geometría, ángulos y velocidad del striker | — | sin cambios | SIMULATION_ASSUMPTION | `strike-physics.js` |

Derivaciones:

- `spread = 1,4 (ancho PCB) + 0,5 (gap entre bordes) = 1,9 cm` centro-centro. Supone que el punto óptico está centrado lateralmente en cada PCB. **La separación óptica no se midió directamente.**
- `centro de placa = 6,5 (eje → borde frontal) − 17,6/2 = −2,3 cm`.

Otras medidas físicas entregadas (sin uso funcional todavía): placa 17,6 × 11,0 × 0,3 cm; ruedas Ø6,5 × 2,5 cm; ancho exterior rueda-a-rueda 12,5 cm; PCB de sensor 1,4 × 3,1 cm.

## Efectos observados en el modelo

- `avanzar(50,0)`: rueda al 50 % = 11,5 cm/s; ω estacionaria = 11,5/10 = 1,15 rad/s; `R` describe un círculo de radio 5,0 cm alrededor de la rueda parada.
- Con `spread = 1,9` y línea de 2,6 cm de ancho, los sensores laterales con el central sobre la línea quedan a 0,6 cm del borde y leen ≈ 320–350 (cobertura parcial, por debajo del umbral 500). No es un cambio del modelo óptico: es consecuencia geométrica.
- Sonar (PHYSICAL-GEOMETRY-2, **histórico**): el origen pasó de 9,83 a 4,0; esa corrección se reemplazó en SONAR-PHYSICAL-ORIGIN-1B (origen 7,40). Referencia: `lectura(7,40) = lectura(9,83) + 2,43` para la misma cara de obstáculo (9,83 − 7,40). Los umbrales 18 / 14 de PHYSICAL-GEOMETRY-2B fueron una compensación del simulador para el origen 4,0 (no calibrados físicamente) y se retiraron: ver `sesiones-s01-s08.md`.
- El modelo óptico (cobertura, mezcla, superficie, campo de luz, ganancia, offset, microvariación) y MOTOR-DYNAMICS-1 no cambiaron. El hash histórico del sensor neutro se verifica restaurando EN MEMORIA la geometría histórica (12 / 6 / 2,8 / 9,83), junto con la rampa histórica.

## Desajustes VISUALES: renderer legacy vs. modelo IROH

La geometría visual sigue **separada** de la física (`R`, `HIT`, `LINE_SENSOR` no leen el asset). Los dos apartados se conservan por separado.

### LEGACY renderer mismatch (histórico; el robot legacy NO cambió y sigue siendo el default)

Con el selector por defecto (sin `?robot=iroh`) `renderer3d.js` dibuja el robot procedural antiguo, así que estos desajustes **siguen presentes** en ese modo:

| Elemento | Renderer legacy | Física / medida |
|---|---|---|
| centros de rueda | ±9,1 → 18,2 cm | 10,0 cm |
| posición longitudinal del eje de ruedas | 2,3 cm detrás de R (`wheel(-2.3,…)`) | R = eje |
| diámetro de rueda | 10,4 cm (radio 5,2) | 6,5 cm |
| ancho de rueda | 2,2 | 2,5 |
| ancho de placa | ≈ 16,2 | 11,0 |
| cabeza del sonar | `sonar(9.48, ±2.45, 15.15)` | cara funcional a 7,40 (la cabeza visual no se movió; desacople visual pendiente 0,76) |
| PCB de sensores | consume `LINE_SENSOR.geometry` → se dibujan en 8,0 / ±1,9 automáticamente, pero sobre un soporte (8,0 de ancho) y un cuerpo legacy | PCB 3,1 × 1,4 |

### IROH renderer alignment (`?robot=iroh`, SIM-3D-INTEGRATION-2/2A; solo apariencia)

El asset `assets/iroh/iroh-render-v1.js` (derivado de `exports/iroh_lowpoly.glb`) se reubica en el marco `R` al generarlo (`tools/build-iroh-render-asset.mjs`); `iroh-visual.js` no desplaza ni escala nada:

| Elemento visual IROH | Valor | Clase / origen |
|---|---|---|
| centros de rueda; Ø × ancho | (0, ±5,0); 6,5 × 2,5 | PHYSICALLY_MEASURED (el asset sigue a la medida) |
| placa | 17,6 × 11,0 × 0,3, centro −2,3, borde frontal +6,5 | DERIVED_FROM_PHYSICAL_MEASUREMENTS |
| PCB de sensor (centro; ancho) | (8,0 ; 0 / ±1,9); 1,4 (el largo del Blender es 3,0 vs 3,1 medido: residual de 0,1 cm) | PHYSICALLY_MEASURED / DERIVED_FROM_PHYSICAL_PCB_GEOMETRY |
| servo, centro | = pivote del striker 8,6 | SIMULATION_ASSUMPTION: el visual sigue a la física, no al revés; **no** se reclasifica como PHYSICALLY_MEASURED |
| LCD | −2,30 (posición de placa). En INTEGRATION-2 llevaba −2,79 por una holgura de +1 mm | **VISUAL_CLEARANCE_ADJUSTMENT** (histórico, hoy inactivo): +1 mm para que el LCD (ESTIMADO DE FOTO) no invadiera la base de la cabeza. **No es una medida física** |
| base negra de la cabeza; centro +3,95 (+5,70 / +2,20) | traslación rígida de toda la cabeza | DERIVED_FROM_PHYSICAL_MEASUREMENTS |
| cara TX/RX | ≈ +6,64 | PHOTO-CONSTRAINED / PROVISIONAL_PHYSICAL_GEOMETRY; el sonar funcional está en +7,40 (desacople visual pendiente 0,76 cm) |
| barra del striker | dibujada por `renderer3d.js` con `IROH_MECHANICS.spec` (pivote 8,6, largo 13,2, semiancho 0,52); el asset no trae ninguna barra | SIMULATION_ASSUMPTION; sin cambios |
| cámara Robot | encuadre derivado de la esfera envolvente del asset (ver `docs/iroh-3d-integration.md` §7) | solo cámara; no es medida |

Se mantiene `bodyRadius = 8,3` = **SIMULATION_ASSUMPTION** (no es la envolvente física medida: el modelo visual se extiende de −11,1 a +9,5 cm desde R). Pivote 8,6, largo 13,2 y semiancho 0,52 siguen siendo SIMULATION_ASSUMPTION.

## Notas para Blender / IROH 3D (siguiente bloque; no se editó nada aquí)

- `R` = centro del eje; centro de placa a **−2,3 cm** longitudinal; centros de rueda a **±5,0 cm** laterales.
- Punto funcional del sensor central **+8,0 cm**; sensores a **±1,9 cm** (derivado).
- Cara funcional del sonar **+7,40 cm** (6,50 + 0,90; DERIVED_FROM_PHYSICAL_MEASUREMENTS).
- (Histórico, ya aplicadas en el asset IROH v1 por SIM-3D-INTEGRATION-2) Correcciones esperables al asset: reubicar eje/ruedas a R y reducir separación a 10,0; rueda Ø6,5 × 2,5; placa 17,6 × 11,0 × 0,3 centrada en −2,3; borde frontal de placa a +6,5; mover los transductores a +4,0 (superado: el origen funcional es ahora +7,40, ver SONAR-PHYSICAL-ORIGIN-1B) y los PCB de sensor a +8,0/±1,9 (PCB 3,1 × 1,4).
- La geometría visual debe seguir separada de la física del simulador.

## Estado de pruebas

`tests/physical-geometry.cjs` congela estos valores. La UI de calibración en Chrome (`tests/calibration-ui.mjs`) queda **PENDING LOCAL BROWSER VALIDATION** (no hay navegador utilizable en el servidor).

## Base negra de la cabeza y plano TX/RX (SIM-3D-INTEGRATION-2A, RESUELTO VISUALMENTE / PENDIENTE FUNCIONAL)

Medición autoritativa: R → borde delantero del acrílico = +6,50; holgura acrílico → borde delantero de la base negra = 0,80; base 3,50 (longitudinal) × 3,20 (transversal). Base: delante **+5,70**, centro **+3,95**, detrás **+2,20** (DERIVED_FROM_PHYSICAL_MEASUREMENTS).

Decisión tras las fotografías laterales y frontales (los transductores están claramente por delante de la base, no sobre su centro):

- Toda la cabeza (`HEAD_BASE`, servos pan/tilt, mecanismo, placa roja, PCB del sonar, TX/RX) se traslada **rígidamente +2,64 cm** (centro de `HEAD_BASE` 1,31 → 3,95) en `tools/build-iroh-render-asset.mjs`. No se deforma ni se mueve solo la base. SIM-3D-INTEGRATION-2A.1: solo el footprint visual de `HEAD_BASE` se ajusta a lo medido (Blender ≈ 3,6 × 4,0 → **3,50 × 3,20**, centro +3,95, lateral 0; bordes 2,20 / 5,70; holgura al acrílico 0,80); lo montado encima no se mueve.
- **Cara frontal de TX/RX ≈ +6,64 cm = PHOTO-CONSTRAINED / PROVISIONAL_PHYSICAL_GEOMETRY.** No se declara PHYSICALLY_MEASURED directo.
- **`+4,0` = valor previo mal interpretado como plano frontal de TX/RX; CORREGIDO funcionalmente en SONAR-PHYSICAL-ORIGIN-1B.** El origen del sonar es `SONAR_FACE_FORWARD = 7,40` cm = 6,50 (R → borde frontal de la placa, PHYSICALLY_MEASURED) + 0,90 (la cara de los cilindros TX/RX sobresale de la placa, PHYSICALLY_MEASURED) = DERIVED_FROM_PHYSICAL_MEASUREMENTS. El visual TX/RX ≈ +6,64 (PHOTO-CONSTRAINED / PROVISIONAL) **no se movió**: desacople visual pendiente 7,40 − 6,64 = 0,76 cm (el modelo 3D queda 0,76 cm por detrás), a corregir en un bloque aparte con las medidas del módulo 3D.
- El LCD (ESTIMADO DE FOTO) ya no necesita el ajuste de holgura de +1 mm (**VISUAL_CLEARANCE_ADJUSTMENT**): con la base en 2,20 queda en su posición de placa (−2,30), a ≈ 2,3 cm de la base. El generador conserva la regla por si volviera a invadir. No es medida física.
