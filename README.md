# BITIRO Simulador

Simulador web gratuito para programar y experimentar con el robot educativo **IROH** desde el navegador.

**Probar en línea:** https://simulador.nulljinx.com  
**Repositorio:** https://github.com/nulljinx/BITIRO-Simulador  
**BITIRO Lab:** https://bitiro-piloto.nulljinx.com/

**Última versión etiquetada:** `v0.9.0-rc.1`

> Estado: **Release Candidate / beta avanzada**. No es una versión v1.0 estable: el proyecto sigue en desarrollo activo y algunas capacidades del robot físico todavía están pendientes de modelado o validación.
>
> La rama `main` puede contener cambios posteriores a la última versión etiquetada y también puede ir por delante del despliegue público. No todo lo presente en `main` está necesariamente desplegado en `simulador.nulljinx.com` (ver [Producción vs. main](#producción-vs-main)).

## Qué es

BITIRO Simulador ejecuta el programa del estudiante sobre un robot virtual con física, sensores, actuadores y un entorno configurable. No resuelve la actividad ni decide qué ruta, base o movimiento es correcto.

La regla de producto es:

> **Las sesiones configuran el mundo; nunca gobiernan al robot.**

El comportamiento depende únicamente de:

```text
programa + física + sensores + actuadores + escenario + entradas manuales
```

Si el código está mal, el robot puede salirse de la línea, elegir otra base, chocar o quedarse detenido. Eso es intencional: el objetivo es **probar, observar, equivocarse, modificar y volver a intentar**.

## Capacidades actuales

- movimiento diferencial con paso fijo determinista;
- dinámica de motores con aceleración y frenado simétricos;
- geometría funcional del IROH alineada con mediciones físicas (ver [Geometría física](#geometría-física-del-iroh));
- modo de calibración manual;
- modelo visual IROH 3D medido (experimental, mediante `?robot=iroh`), con renderer Canvas2D, sin Three.js/WebGL por ahora;
- pruebas específicas de geometría y de visual IROH;
- tres sensores de línea;
- sonar frontal geométrico;
- IR izquierdo y derecho como entradas manuales;
- Pulsador y `botonInicio()` como barrera real de ejecución;
- LCD 16×2;
- garra de golpe oficial `-1 / 0 / +1`;
- cajas físicas configurables mediante **Editar escenario**;
- funciones propias del estudiante con parámetros y `return`;
- ejecución, pausa, paso y reinicio;
- almacenamiento local del código por pista y del escenario por pista;
- pistas S01–S08, más Óvalo y Ocho;
- UI responsive para escritorio y móvil.

### Funciones propias

El intérprete admite, entre otros patrones:

```cpp
int velocidad(int sensor) {
    if (sensor > 700) return 20;
    if (sensor > 500) return 30;
    return 40;
}

void seguir(int sensor, int vel, int umbral) {
    if (sensor >= umbral) avanzar(vel);
    else girarDerecha(vel);
}
```

Las llamadas pueden contener `pausa()` y `botonInicio()`; el runtime suspende y reanuda cooperativamente sin bloquear el navegador.

## Ejemplo mínimo

```cpp
void setup() {
    inicializarMovimiento();
    inicializarSensores();
    botonInicio();
}

void loop() {
    if (lineaCentral()) {
        avanzar(30);
    } else if (lineaIzquierda()) {
        avanzar(10, 30);
    } else if (lineaDerecha()) {
        avanzar(30, 10);
    } else {
        detenerse();
    }
}
```

Al pulsar **Ejecutar**, el programa llega a `botonInicio()` y espera al **Pulsador**. Si el programa no contiene `botonInicio()`, comienza inmediatamente.

## Pistas, escenarios y currículo

BITIRO separa cuatro conceptos:

| Concepto | Significado |
|---|---|
| **TRACK** | Geometría de la pista: líneas, curvas, gaps, zonas y referencias impresas. |
| **SCENARIO PROP** | Caja u obstáculo físico colocado en el mundo. |
| **DEFAULT START** | Pose inicial práctica al cargar una pista. |
| **CURRICULUM** | Objetivo, desafío, guía y evidencia pedagógica; no pertenece al motor libre. |

S01–S06 y S08 usan geometrías reconstruidas desde los plotters vectoriales de referencia. S07 es una sesión de repaso sin plotter propio y se representa con una superficie neutra. Óvalo y Ocho son circuitos libres.

Las cajas de una actividad no se convierten en parte de la pista. S01 incluye una `practice-box` predeterminada no oficial; el usuario puede editar, vaciar o restaurar escenarios. Los cuatro `boxSlots` de S08 son metadata de referencia y **no crean cajas automáticamente**.

Más detalles: [`docs/track-model.md`](docs/track-model.md).

## Garra de golpe

La API educativa es:

```cpp
moverServoGolpe(-1);  // izquierda del robot
moverServoGolpe(0);   // centro
moverServoGolpe(1);   // derecha del robot
```

El modelo físico actual usa aproximadamente `-75° / 0° / +75°`. La barra y las cajas interactúan por contacto: no hay fuerza a distancia ni atravesado de objetos. Una caja movible puede ser desplazada por el giro de la garra o por la traslación del robot cuando la barra la empuja y existe espacio.

## Estado de las sesiones

Última validación funcional integral de sesiones: `SESSION-VALIDATION-2` (programas reales con funciones propias, recorridos físicos y escenarios). Es anterior a la geometría medida y a la integración IROH 3D de `v0.9.0-rc.1`.

| Sesión | Estado |
|---|---|
| S01 | ✅ completa |
| S02 | ✅ completa |
| S03 | 🟡 parcial |
| S04 | ✅ completa |
| S05 | 🟡 parcial |
| S06 | 🟡 parcial |
| S07 | 🔴 no realizable completa |
| S08 | 🟡 parcial |

- **S04** quedó validada completa con funciones propias en el runtime: gaps, intersecciones y meta con funciones propias reales.
- **S06** ya ejecuta `int velocidad(int)`, `void seguidor(...)`, `return` y su flujo físico principal (velocidad normal/reducida, detención, golpe y continuación). Sigue parcial porque la intersección que exige el material no está impresa en el plotter oficial. `millis()` afecta solo a un bonus opcional; no es el bloqueo principal.
- **S07** sigue bloqueada por HEAD-SERVO (cabeza yaw/pitch y sonar orientable).
- **S03, S05 y S08** mantienen limitaciones de pista, entradas o modelo del sensor.

Consulta [`docs/sesiones-s01-s08.md`](docs/sesiones-s01-s08.md) para la evidencia y las limitaciones por sesión.

### Producción vs. main

- `main`: contiene `v0.9.0-rc.1` (última versión etiquetada) y puede incluir cambios posteriores.
- El despliegue público estable (`simulador.nulljinx.com`) puede ir por detrás de `main`.
- La integración IROH 3D y la geometría más reciente no deben darse por desplegadas mientras no exista un deploy confirmado.

## Geometría física del IROH

Los valores se clasifican así:

- **PHYSICALLY_MEASURED**: medido sobre el robot físico.
- **DERIVED_FROM_PHYSICAL_MEASUREMENTS**: derivado de forma autorizada a partir de esas mediciones.
- **Provisional**: restringido por fotos o pendiente de revisión; no es una medición directa.

Ejes en cm respecto al punto de referencia R del robot (positivo hacia el frente):

| Elemento | Valor | Estado |
|---|---|---|
| Wheelbase | 10.0 (centros de rueda a ±5.0) | medido / derivado |
| Rueda | Ø 6.5 × ancho 2.5 | medido |
| Placa inferior | 17.6 × 11.0 × 0.3; centro −2.3 respecto a R; frente +6.5 | medido / derivado |
| Sensor de línea central | +8.0 | medido |
| Sensores de línea laterales | ±1.9 | medido |
| PCB del sensor de línea | 1.4 × 3.1 | medido |
| HEAD_BASE | 3.50 × 3.20; centro +3.95; frente +5.70; atrás +2.20 | medido / derivado |
| TX/RX visual | ≈ +6.64 | provisional (restringido por fotos) |
| Origen funcional del sonar | +7.40 | derivado de medidas físicas (6.50 + 0.90) |

> **Importante:** el origen funcional del sonar es `+7.40` cm = 6.50 (R → borde frontal de la placa, medido) + 0.90 (la cara de TX/RX sobresale de la placa, medido): DERIVED_FROM_PHYSICAL_MEASUREMENTS. El `+6.64` visual **no** es una medición directa y todavía no está alineado con el origen funcional (desacople visual pendiente: 7.40 − 6.64 = 0.76 cm).

Más detalles: [`docs/physical-geometry.md`](docs/physical-geometry.md) y [`docs/iroh-3d-integration.md`](docs/iroh-3d-integration.md).

## Modelos visuales

| Selección | Renderer |
|---|---|
| por defecto | 3D clásico/legacy |
| `?robot=iroh` | modelo IROH 3D medido, experimental |

Ambos comparten la misma física, el mismo R, los mismos sensores, el mismo runtime, las mismas pistas y las mismas colisiones funcionales. **Cambiar el modelo visual no debe cambiar la trayectoria ni el programa.**

El modelo IROH usa `assets/iroh/iroh-render-v1.js`, `iroh-visual.js` y `renderer3d.js`. El asset deriva del modelo Blender mediante `tools/build-iroh-render-asset.mjs`.

Este modelo es una representación medida y aproximada; no es un gemelo digital final ni ultra realista. Todavía no existe un selector visible 2D/3D/realista: pertenece a `DISPLAY-MODES-1` (futuro).

### Rendimiento

La comparación A/B local en Chrome no mostró una regresión sostenida del modelo IROH frente al renderer legacy en los perfiles probados. El rendimiento real depende del hardware y del navegador.

## Lenguaje soportado

BITIRO usa un intérprete didáctico de un subconjunto de Arduino/C++.

Actualmente soporta:

- `int`, `float`, `long`, `bool`, `byte`;
- variables globales y locales;
- `if / else`;
- `while`;
- operadores aritméticos, comparación y `&& / || / !`;
- `++`, `--`, `+=`, `-=`;
- funciones propias `void/int/float/long/bool/byte`;
- parámetros por valor;
- `return`;
- llamadas anidadas y recursión limitada a 64 niveles;
- `pausa()` y `botonInicio()` dentro de funciones propias.

No es un compilador Arduino completo. Entre lo aún no soportado están `const`, `for`, `switch`, arrays, `do-while`, `break`, operador ternario, `millis()`, `delay()` y `analogRead()`.

API completa: [`docs/api-iroh.md`](docs/api-iroh.md).

## Arquitectura

La versión actual es una aplicación web estática en HTML, CSS y JavaScript, sin backend ni dependencias de runtime externas.

```text
index.html            interfaz
ui-shell.js           interacción de UI
calibration-mode.js   modo calibración (solo interfaz: mover/girar el IROH)
syntax-highlight.js   resaltado del editor
iroh-runtime.js       parser, intérprete y API educativa
simulator.js          estado, reloj y ciclo de simulación
strike-physics.js     contacto de garra/cajas
renderer3d.js         renderer procedural sobre Canvas
iroh-visual.js        integración visual del modelo IROH medido
assets/iroh/iroh-render-v1.js   asset de render IROH (derivado del modelo Blender)
tools/build-iroh-render-asset.mjs   genera el asset desde el modelo Blender
calibration.js        modelo simulado de sensores de línea + light field
tracks.js             pistas base
extra-tracks.js       pistas adicionales
scenario-props.js     modelo y persistencia de cajas
scenario-editor.js    editor accesible de escenario
starters.js           código inicial por sesión
tests/                pruebas deterministas y regresiones
```

```text
SIMULATION STATE
      ↓
renderer  (legacy / IROH)
```

El renderer legacy y el IROH comparten el mismo estado funcional de la simulación. Ambos dibujan sobre Canvas2D; no es un CAD ni un motor WebGL.

Más detalles: [`docs/architecture.md`](docs/architecture.md).

## Ejecutar localmente

```bash
git clone https://github.com/nulljinx/BITIRO-Simulador.git
cd BITIRO-Simulador
python3 -m http.server 8080
```

Abre `http://localhost:8080`.

No requiere base de datos, cuenta, credenciales ni servicios externos para ejecutar la simulación.

## Pruebas

La validación integral ejecuta actualmente 17 suites Node `tests/*.cjs`, además de pruebas específicas en Chrome. No se enumeran todas; algunas relevantes:

```bash
node tests/physical-geometry.cjs   # geometría física medida
node tests/motor-dynamics.cjs      # aceleración/frenado simétricos
node tests/iroh-visual.cjs         # visual IROH
node tests/calibration-ui.mjs      # navegador real (Chrome por CDP); se omite sin Chrome
node tests/iroh-visual-ui.mjs      # navegador real (Chrome por CDP)
node tests/perf/iroh-ab.mjs        # comparación A/B de rendimiento legacy vs IROH
```

Modo calibración y modelo de sensor simulado: [`docs/calibration-mode.md`](docs/calibration-mode.md).

`SIM-1` usa trazas deterministas y goldens. Los goldens **no deben regenerarse automáticamente**: una modificación exige revisar y aprobar el cambio de comportamiento.

## Documentación

- [Guía de uso](docs/user-guide.md)
- [API IROH y lenguaje](docs/api-iroh.md)
- [Estado S01–S08](docs/sesiones-s01-s08.md)
- [Arquitectura](docs/architecture.md)
- [Modelo de pistas y escenarios](docs/track-model.md)
- [Geometría física del IROH](docs/physical-geometry.md)
- [Integración del modelo IROH 3D](docs/iroh-3d-integration.md)
- [Modo calibración](docs/calibration-mode.md)
- [Baseline actual](docs/current-baseline.md)
- [Limitaciones conocidas](docs/known-limitations.md)
- [Baseline v4 histórica](docs/sim-v4-baseline.md)
- [Historia de decisiones de UI](docs/pilot-ui-reference.md)

## Limitaciones conocidas del sonar

Existe un desacople visual conocido y pendiente de corrección entre el modelo 3D y la función del sonar:

- TX/RX visual ≈ +6.64 cm (provisional, restringido por fotos);
- origen funcional del sonar = +7.40 cm (derivado de medidas físicas);
- desacople visual pendiente: 7.40 − 6.64 = 0.76 cm (el modelo 3D se corregirá aparte, con las medidas del módulo).

Será resuelto en `SONAR-PHYSICAL-ORIGIN-1`. Los umbrales del sonar usados en materiales y ejemplos no se han recalculado todavía.

## Versiones

| Versión | Contenido |
|---|---|
| v0.1.0 | baseline v4 |
| v0.2.0 | PILOT-1 / rediseño UI |
| v0.3.0 | pistas y sesiones oficiales |
| v0.4.0 | scenario props |
| v0.5.0 | funciones propias en runtime |
| v0.6.0 | calibración manual |
| v0.7.0 | dinámica simétrica de motores |
| v0.8.0 | geometría física medida |
| v0.9.0-rc.1 | integración IROH 3D medida |

`v0.9.0-rc.1` es un Release Candidate. Por ahora son tags Git, no Releases de GitHub.

## Roadmap inmediato

1. `SONAR-PHYSICAL-ORIGIN-1`
2. `DISPLAY-MODES-1`: 2D Ligero, 3D Clásico, 3D Realista
3. regresión / UX / rendimiento final
4. `v0.9.0`
5. cierre y `v1.0.0`

El desarrollo actual se centra en terminar BITIRO Simulador. BITIRO Lab se menciona solo como proyecto futuro.

## Reportar problemas

Al abrir un Issue incluye, si es posible:

- pista;
- código ejecutado;
- escenario;
- estado de Pulsador/IR;
- pasos para reproducir;
- resultado observado y esperado;
- navegador;
- captura o video;
- comparación con el robot físico, si existe.

Las diferencias reproducibles entre simulador y hardware son especialmente valiosas.

## Créditos y referencias educativas

**BITIRO Simulador** es un desarrollo independiente del ecosistema BITIRO.

Para representar experiencias ROB-002, pistas y parte del contexto pedagógico, el proyecto utiliza como referencia materiales del **Programa de Robótica Educativa de la Fundación Gabriel & Mary Mustakis**. Los materiales consultados indican elaboración colaborativa entre equipos de Universidades Socias del programa.

BITIRO Simulador no pretende reemplazar esos materiales ni atribuirse su autoría. Los contenidos educativos, plotters, marcas, logotipos y otros recursos de terceros conservan sus respectivas autorías, licencias y condiciones de uso. Cuando un material original indique una licencia específica, prevalecen sus términos.

## Licencia y materiales

El repositorio es público para facilitar revisión, prueba y colaboración, pero **actualmente no declara una licencia de software propia**. Código visible públicamente no significa por sí solo permiso general de copia, redistribución o reutilización.

Los materiales educativos y recursos de terceros mantienen sus propios derechos y condiciones.

---

BITIRO busca que el aprendizaje ocurra mediante **programar, observar, ajustar y volver a probar**.
