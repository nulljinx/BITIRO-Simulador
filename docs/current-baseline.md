# Baseline actual

## Identidad

Baseline funcional de `RUNTIME-FUNCTIONS-1` (último cambio del lenguaje y del intérprete):

```text
b5683f0fcb25b06057ddcb87502a6acca3b75ccf
feat(runtime): support student-defined functions
```

**Producción actual** (`https://simulador.nulljinx.com`): `SIM-CALIBRATION-1`, desplegado y verificado el 2026-10-07.

```text
PRODUCTION SHA:
84051cecce3058c7241d31f639cbe0c5f0c6b6e4
feat: add manual IROH calibration mode
```

Producción coincide byte a byte con ese commit. La documentación y los tests no se publican. `SIM-CALIBRATION-1` sí modificó el modelo de sensores, la interfaz y siete goldens (ver «Modo calibración y modelo de sensor simulado»); no modificó la física, el timestep ni las pistas.

Despliegue anterior: `61aba2555a59d0e41920caa10904932231010725` (2026-10-06) con `RUNTIME-FUNCTIONS-1`; desde `b5683f0` hasta ese commit, y hasta `a7631bd`, el runtime público era idéntico.

### Inventario runtime de producción

```text
16 archivos raíz  (13 JS + 2 CSS + index.html)
14 assets         (1 símbolo + 5 fuentes + 1 licencia OFL + 7 plotters)
30 archivos runtime en total
```

`calibration-mode.js` es un **asset runtime requerido**, desplegado y verificado. Si `index.html` llega a producción sin él, el botón «Calibración» queda visible pero inerte y el navegador registra un 404. El inventario anterior era de 29 archivos (15 raíz + 14 assets).

### Verificación del despliegue de SIM-CALIBRATION-1

Resumen, no contrato de infraestructura:

- producción == `84051cecce3058c7241d31f639cbe0c5f0c6b6e4` byte a byte (30 archivos);
- `calibration-mode.js` responde HTTP 200 y `index.html` lo referencia;
- 15/15 verificaciones post-deploy correctas en Chrome real;
- 0 errores de consola y 0 excepciones de runtime;
- 1366×768, 1024×768 y 390×844 verificados;
- CSP sin cambios.

Operación: se conserva el backup `/home/nulljinx/backups/bitiro-simulador-pre-84051ce.tar.gz`. Es solo el snapshot de rollback del despliegue anterior a `84051ce`; no es una política permanente de backups.

### Despliegue anterior (RUNTIME-FUNCTIONS-1, 2026-10-06)

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

### Modo calibración y modelo de sensor simulado

`SIM-CALIBRATION-1` (detalle en [`calibration-mode.md`](calibration-mode.md)):

- modo de calibración manual: el editor se oculta mientras se calibra;
- un programa del estudiante en ejecución sigue ejecutándose, y uno detenido sigue detenido;
- arrastre y rotación manuales del IROH;
- la LCD es la única salida de valores de sensor visible para el estudiante: si el programa no escribe una lectura en la LCD, la calibración no la muestra;
- no hay sugerencia automática de umbral;
- diferencias deterministas y simuladas entre los sensores izquierdo/central/derecho;
- campo de luz espacial determinista; PISTA (superficie) y CAMPO DE LUZ (iluminación) son conceptos separados;
- la escala de los sensores se mantiene en 0–1023;
- la calibración física del IROH real sigue pendiente (PHYSICAL-CALIBRATION): el modelo de sensor simulado todavía no es una calibración física.

Nota de rendimiento: el modo calibración es mediblemente más pesado que el renderizado normal. En un smoke de 20 s con dos repeticiones, P1 normal ≈ 49,7 FPS y P1 en calibración ≈ 40,4 FPS. No se ha demostrado la causa. Synthetic CPU throttling is not a substitute for validation on actual school hardware.

## Tests

En el ciclo de `SIM-CALIBRATION-1` se verificaron 15 suites: 14 de Node (las 13 anteriores más `tests/calibration.cjs`) y 1 de navegador real (`tests/calibration-ui.mjs`, Chrome por CDP; se omite si no hay Chrome). Las 13 suites anteriores se mantienen verdes:

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

Suites añadidas por `SIM-CALIBRATION-1`:

```text
calibration 26      (Node: modelo de sensor, light field, pose manual, runtime, LCD)
calibration-ui 13   (navegador real: entrar/salir, arrastre, rotación, teclado, táctil sintético, 1366/1024/390 px)
```

Los goldens no cambiaron durante `RUNTIME-FUNCTIONS-1`. `SIM-CALIBRATION-1` regeneró siete goldens solo por el modelo de sensor simulado (cuatro cambian únicamente el campo `sensors`; dos seguidores de línea desplazan su trayectoria como máximo 0,2 cm y 0,02 rad; `runtime` cambia una lectura). Con el modelo neutro, siete trazas SIM-1 reproducen exactamente las anteriores.

## Siguiente trabajo recomendado

1. HEAD-SERVO: yaw/pitch + sonar orientable (S07 y solución fiel de S08);
2. props de línea/intersección para actividades que usan cinta temporal (S03/S06);
3. compatibilidad pequeña de runtime (`millis`, `const`, aliases) según necesidad curricular;
4. medición física antes de alterar wheelbase, cono sonar, geometría de garra o curva de velocidad;
5. PHYSICAL-CALIBRATION: medir las lecturas de los sensores del IROH real y sustituir los parámetros simulados del modelo de sensor y del campo de luz.
