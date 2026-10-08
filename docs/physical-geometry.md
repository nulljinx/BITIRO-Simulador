# Geometría física funcional (PHYSICAL-GEOMETRY-2)

Este documento registra qué parte de la geometría **funcional** del simulador procede de medidas físicas del IROH entregadas por el usuario, qué es derivado y qué sigue siendo supuesto. **No afirma que el robot esté completamente calibrado.**

`R` = centro cinemático del eje de ruedas. Todas las distancias longitudinales se miden desde `R`, positivas hacia delante.

## Clasificación

| Valor | Antes | Ahora | Clase | Dónde vive |
|---|---|---|---|---|
| wheelbase (centro-centro de ruedas) | 12 | **10,0 cm** | PHYSICALLY_MEASURED | `simulator.js` (`base=10`) |
| sensor central: eje → punto óptico (`front`) | 6 | **8,0 cm** | PHYSICALLY_MEASURED | `calibration.js` (`LINE_SENSOR.geometry.front`) |
| cara frontal de los transductores (origen del sonar) | 9,83 | **4,0 cm** | PHYSICALLY_MEASURED | `simulator.js` (`readSonarDistance`) |
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
- Sonar: `lectura_nueva = lectura_antigua + 5,83 cm` para la misma cara de obstáculo (origen 4,0 vs 9,83 desde R; verificado sin redondeo). Misma posición física ⇒ lectura mayor; un umbral de lectura escrito para el origen antiguo dispara ahora con el obstáculo más cerca de R. Por eso `sesiones-s01-s08.md` pasó de 12 / 8 a 18 / 14 cm (equivalencia geométrica, no calibración del sonar); los starters no se tocaron.
- El modelo óptico (cobertura, mezcla, superficie, campo de luz, ganancia, offset, microvariación) y MOTOR-DYNAMICS-1 no cambiaron. El hash histórico del sensor neutro se verifica restaurando EN MEMORIA la geometría histórica (12 / 6 / 2,8 / 9,83), junto con la rampa histórica.

## Desajustes VISUALES restantes del renderer legacy (`renderer3d.js`, no corregidos aquí)

| Elemento | Renderer legacy | Física / medida |
|---|---|---|
| centros de rueda | ±9,1 → 18,2 cm | 10,0 cm |
| posición longitudinal del eje de ruedas | 2,3 cm detrás de R (`wheel(-2.3,…)`) | R = eje |
| diámetro de rueda | 10,4 cm (radio 5,2) | 6,5 cm |
| ancho de rueda | 2,2 | 2,5 |
| ancho de placa | ≈ 16,2 | 11,0 |
| cabeza del sonar | `sonar(9.48, ±2.45, 15.15)` | cara funcional a 4,0 (la cabeza visual no se movió) |
| PCB de sensores | consume `LINE_SENSOR.geometry` → se dibujan en 8,0 / ±1,9 automáticamente, pero sobre un soporte (8,0 de ancho) y un cuerpo legacy | PCB 3,1 × 1,4 |

Se resolverá en la integración IROH 3D.

## Notas para Blender / IROH 3D (siguiente bloque; no se editó nada aquí)

- `R` = centro del eje; centro de placa a **−2,3 cm** longitudinal; centros de rueda a **±5,0 cm** laterales.
- Punto funcional del sensor central **+8,0 cm**; sensores a **±1,9 cm** (derivado).
- Cara funcional del sonar **+4,0 cm**.
- Correcciones esperables al asset actual: reubicar eje/ruedas a R y reducir separación a 10,0; rueda Ø6,5 × 2,5; placa 17,6 × 11,0 × 0,3 centrada en −2,3; borde frontal de placa a +6,5; mover los transductores a +4,0 y los PCB de sensor a +8,0/±1,9 (PCB 3,1 × 1,4).
- La geometría visual debe seguir separada de la física del simulador.

## Estado de pruebas

`tests/physical-geometry.cjs` congela estos valores. La UI de calibración en Chrome (`tests/calibration-ui.mjs`) queda **PENDING LOCAL BROWSER VALIDATION** (no hay navegador utilizable en el servidor).
