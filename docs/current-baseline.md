# Baseline actual

## Identidad

Baseline funcional de `RUNTIME-FUNCTIONS-1`:

```text
b5683f0fcb25b06057ddcb87502a6acca3b75ccf
feat(runtime): support student-defined functions
```

HEAD local desplegado y verificado en producción el 2026-10-06:

```text
61aba2555a59d0e41920caa10904932231010725
```

Los cambios posteriores al commit funcional `b5683f0` corresponden a documentación y no modifican el runtime, la física, las pistas ni los tests.

Producción verificada el 2026-10-06 con `RUNTIME-FUNCTIONS-1` (`https://simulador.nulljinx.com`). Los archivos runtime públicos coinciden con los del repositorio; la documentación y los tests no se publican.

Verificación del deploy (resumen, no contrato de infraestructura):

- 13 suites verdes antes del deploy;
- 29 archivos runtime (15 en la raíz + 14 assets);
- navegador en escritorio, tablet y móvil (1440 / 1024 / 390 px);
- 0 errores de consola, 0 respuestas HTTP ≥ 400, 0 violaciones CSP y sin desbordamiento horizontal;
- casos de funciones propias y `botonInicio()` dentro de funciones verificados en producción, además de S04 y S06.

`SESSION-VALIDATION-2` clasificó **S04 como completa** y **S06 como parcial** (intersección ausente del plotter; `millis()` solo afecta un bonus). Ver [`sesiones-s01-s08.md`](sesiones-s01-s08.md).

`docs/sim-v4-baseline.md` conserva la caracterización histórica del v4 importado y algunos deltas posteriores. Este documento resume el estado actual sin reescribir la historia de la baseline original.

## Cambios principales desde v4

### UI y navegación

- interfaz alineada visualmente con BITIRO Lab;
- responsive escritorio/móvil;
- navegación cruzada Lab ↔ Simulador;
- LCD 16×2 ampliada;
- controles secundarios agrupados en `Más`.

### Pistas

- S01–S06 y S08 alineadas con geometrías vectoriales de referencia;
- S07 neutral sin plotter oficial;
- gaps físicos reales;
- S08 `boxSlots` como metadata.

### Escenarios

- editor de cajas por pista;
- persistencia `scenario:v1`;
- S01 puede quedar explícitamente vacío;
- física mueve el mundo activo, no la configuración persistida.

### botonInicio

`botonInicio()` dejó de ser NOP y ahora suspende cooperativamente hasta Pulsador=1. La semántica es por nivel, no por flanco.

### Garra

API migrada de 0–65 a:

```text
-1 → izquierda → -75°
 0 → centro    →   0°
+1 → derecha   → +75°
```

Contacto bidireccional, retorno físico y empuje de cajas por traslación de la barra.

### Funciones propias

El runtime soporta funciones del estudiante con:

- tipos de retorno `void/int/float/long/bool/byte`;
- parámetros por valor;
- `return`;
- scopes;
- llamadas anidadas;
- `pausa()` y `botonInicio()` dentro de funciones;
- profundidad máxima 64.

Las 21 builtins `void` no pueden usarse como valores; las 12 funciones de lectura sí retornan número.

## Tests

13 suites principales verdes al cerrar RUNTIME-FUNCTIONS-1 y de nuevo en `SESSION-VALIDATION-2` y antes del deploy:

```text
track-digitize 13
smoke OK
regression 22
sim1 22
ui-contract 15
ui-shell 13
syntax 10
pilot5 20
strike-audit 10
scenario-props 16
runtime-start 18
runtime-servo 35
runtime-functions 63
```

Los goldens no cambiaron durante RUNTIME-FUNCTIONS-1.

## Siguiente trabajo recomendado

1. HEAD-SERVO: yaw/pitch + sonar orientable (S07 y solución fiel de S08);
2. props de línea/intersección para actividades que usan cinta temporal (S03/S06);
3. compatibilidad pequeña de runtime (`millis`, `const`, aliases) según necesidad curricular;
4. medición física antes de alterar wheelbase, cono sonar, geometría de garra o curva de velocidad.
