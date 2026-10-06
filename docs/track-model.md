# Modelo de pistas y escenarios

## Conceptos

| Concepto | Qué es | Dónde vive |
|---|---|---|
| **TRACK** | Geometría impresa: centerlines, anchos, gaps, zonas y marcas. | `tracks.js`, `extra-tracks.js` |
| **SCENARIO PROP** | Caja/obstáculo físico configurable. | `scenario-props.js` + persistencia por pista |
| **DEFAULT START** | Pose práctica al cargar una pista. | `track.start` / `track.startInfo` |
| **CURRICULUM** | Objetivos, desafío y evaluación pedagógica. | fuera del core del simulador |

La pista o la sesión nunca gobiernan al robot.

## Geometría oficial

Las pistas S01–S06 y S08 se reconstruyeron a partir de referencias vectoriales oficiales y se validan mediante la cadena de `tests/track-reference/`. Los gaps son ausencia real de trazo.

S07 es **Repaso · sin pista propia**: superficie neutra sin líneas, zonas u obstáculos, `official:false`.

Óvalo y Ocho son circuitos libres.

## Starts

| Pista | Start | Estado |
|---|---|---|
| S01, S02 | heredado de la referencia del Lab | referencia práctica existente |
| S03 | (50, 163,345), tangente al lazo | práctica; plotter sin salida oficial |
| S04 | (50,002, 157,6), −π/2 | práctica; evita solape con zona roja |
| S05 | (49,566, 163,2), −π/2 | práctica; evita solape con zona roja |
| S06 | (49,349, 153,5), −π/2 | provisional/práctica |
| S08 | (37,853, 152,8), −π/2 | provisional/práctica |

Un `DEFAULT START` no se presenta como coordenada oficial del plotter cuando la fuente no la define.

## Scenario Props

El modelo persistente usa:

```text
bitiro:standalone:scenario:v1:<trackId>
```

Semántica:

- clave ausente → escenario predeterminado;
- `[]` → escenario explícitamente vacío;
- lista válida → configuración del usuario;
- JSON corrupto/objetos inválidos → degradación segura al comportamiento definido por el modelo.

Las cajas son 8×8 cm y se validan contra:

- límites de pista;
- otras cajas;
- cuerpo del robot en el start;
- garra en posición inicial centrada.

El mundo activo es una copia mutable. La física puede mover cajas sin modificar el escenario persistido; Reiniciar reconstruye las posiciones configuradas.

## Predeterminados

- S01: `practice-box` en `(46,94)`, 8×8 cm, movible, **no oficial**.
- S02–S08: sin cajas predeterminadas.
- S06: sin caja porque el plotter no la contiene.
- S08: cuatro `boxSlots` como metadata de referencia; **no son obstáculos automáticos**.

## Editor

`Más → Editar escenario` permite añadir, seleccionar, arrastrar, editar X/Y, eliminar, vaciar y restaurar el escenario predeterminado. Cancelar descarta el borrador; Aplicar persiste la configuración.

## Elementos todavía no configurables

Scenario Props modela cajas. No modela todavía cinta o barras de línea agregadas temporalmente para actividades como S03/S06.
