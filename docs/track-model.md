# Modelo de pistas (TRACK-DIGITIZE-1)

| Concepto | Qué es | Dónde vive |
|---|---|---|
| **TRACK** | Geometría impresa oficial: centerlines, anchos, caps/empalmes, gaps reales, zonas | `tracks.js` (S01, S02), `extra-tracks.js` (S03–S06, S08) |
| **SCENARIO PROP** | Caja/obstáculo colocado en el mundo | `window.BITIRO_SCENARIO_PROPS` (`tracks.js`) |
| **DEFAULT START** | Pose cómoda al cargar la pista | `track.start` + `track.startInfo` |
| **CURRICULUM** | Objetivos y desafío | fuera del core del simulador |

La pista o la sesión nunca gobiernan al robot.

Los datos salen de `tests/track-reference/sim-candidate/*.json`; `node tests/track-reference/import-tracks.cjs` los importa y
`--check` verifica que lo versionado coincide. Los gaps son ausencia real de trazo; `boxSlots` de S08 son posiciones señaladas por el
material (metadata), no cajas.

## Starts
| Pista | Start | Origen |
|---|---|---|
| S01, S02 | del Lab | oficial (Lab) |
| S04 | (50,002, 157,6), −π/2 | práctica; antes (50, 159,5) del Lab solapaba la zona roja. Desplazamiento 1,9 cm; clearance cuerpo↔zona 0,50 cm |
| S05 | (49,566, 163,2), −π/2 | práctica; antes (49,55, 165,5) del Lab solapaba la zona roja. Desplazamiento 2,3 cm; clearance cuerpo↔zona 0,58 cm |
| S03 | (50, 163,345), heading ≈ π (tangente del lazo) | **pose de práctica**: el plotter S03 no define salida oficial |
| S06 | (49,349, 153,5), −π/2 | default de práctica provisional (Lab: «pendiente de validación») |
| S08 | (37,853, 152,8), −π/2 | default de práctica provisional; la vertical está en x≈37,85 |

S06/S08 se subieron ~1,9–2 cm respecto a la propuesta inicial (y=155,4/154,8): con radio de cuerpo 8,3 cm solapaban la zona roja inferior.

## S07
«Repaso · sin pista propia»: superficie neutra (sin línea, zonas ni obstáculos), `official:false`. No existe ROB-002-S07 ni se reutiliza S03.

## Cajas
- S06: sin caja (el PDF no la tiene).
- S01: `practice-box` (46, 94, 8×8) es un *prop* de escenario **no oficial** que conserva su pose para no alterar la física del golpe; pendiente de migrar a props configurables.
