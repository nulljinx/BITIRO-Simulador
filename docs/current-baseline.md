# Baseline actual

## Identidad

Baseline de código documentada:

```text
b5683f0fcb25b06057ddcb87502a6acca3b75ccf
feat(runtime): support student-defined functions
```

La producción pública puede quedar temporalmente una versión detrás hasta completar el siguiente deploy.

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

13 suites principales verdes al cerrar RUNTIME-FUNCTIONS-1:

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

1. revalidación integral de sesiones S01–S08;
2. compatibilidad pequeña de runtime (`millis`, `const`, aliases) según necesidad curricular;
3. HEAD-SERVO: yaw/pitch + sonar orientable;
4. props de línea/intersección para actividades que usan cinta temporal;
5. medición física antes de alterar wheelbase, cono sonar o geometría de garra.
