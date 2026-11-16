# BITIRO Simulador

Simulador web gratuito para programar y experimentar con el robot educativo **IROH** desde el navegador.

**Probar en línea:** https://simulador.nulljinx.com  
**Repositorio:** https://github.com/nulljinx/BITIRO-Simulador  


## Estado de versiones (léelo primero)

Con la integración **SIM-NOFIRVI-1** (en revisión mediante Pull Request), `main` pasa a ser la **única fuente oficial** del simulador publicado. **La migración de Cloudflare Pages aún no ocurrió:** hasta que se ejecute, Pages sigue publicando la rama `deploy/cloudflare-pages` (candidato `9c0b492`, cuyo contenido coincide byte a byte con el artefacto que genera este `main`). Conviene distinguir cinco cosas:

| Concepto | Qué es | Referencia |
|---|---|---|
| **Código fuente oficial** | La rama `main`: runtime de 32 archivos, pruebas, documentación y `scripts/build-pages.mjs` | [`docs/current-baseline.md`](docs/current-baseline.md) |
| **Build estático público** | `dist/`, generado con `node scripts/build-pages.mjs`: exactamente 35 archivos verificados por SHA-256 | [`scripts/pages-manifest.json`](scripts/pages-manifest.json), [`docs/release-sim-nofirvi-1.md`](docs/release-sim-nofirvi-1.md) |
| **Deployment real** | Lo que sirve Cloudflare Pages en `simulador.nulljinx.com`; se verifica por hashes, no por una rama. Rama de producción actual: `deploy/cloudflare-pages`; el cambio a `main` está **pendiente** | [`docs/deployment-and-rollback.md`](docs/deployment-and-rollback.md) |
| **Experimentos** | Geometría IROH medida (rueda 10 cm, sonar 7,40 cm) y modelo visual IROH 3D: **no activos en producción** | rama `experiment/measured-geometry-iroh3d` ([`docs/experiment-measured-geometry-iroh3d.md`](docs/experiment-measured-geometry-iroh3d.md)) |
| **Historial de versiones** | Etiquetas `v0.x`, releases `release/*` y registros `docs/release-*.md`; no se reescriben | [`docs/versioning-and-releases.md`](docs/versioning-and-releases.md) |

> Estado general: **Release Candidate / beta avanzada**, no una versión v1.0 estable.
>
> **Geometría funcional oficial:** separación de ruedas 12 cm, origen del sonar a 9,83 cm del centro del eje, cabeza virtual HEAD-CANVAS (`moverServoYaw`). FIRVI 2025 no forma parte del runtime oficial.

## Qué es

BITIRO Simulador ejecuta el programa del estudiante sobre un robot virtual con física, sensores, actuadores y un entorno configurable. No resuelve la actividad ni decide qué ruta, base o movimiento es correcto.

La regla de producto es:

> **Las sesiones configuran el mundo; nunca gobiernan al robot.**

El comportamiento depende únicamente de:

```text
programa + física + sensores + actuadores + escenario + entradas manuales
```

Si el código está mal, el robot puede salirse de la línea, elegir otra base, chocar o quedarse detenido. Eso es intencional: el objetivo es **probar, observar, equivocarse, modificar y volver a intentar**.

## Capacidades del runtime oficial (`main`)

- movimiento diferencial con paso fijo determinista;
- dinámica de motores con aceleración y frenado simétricos;
- geometría funcional oficial: ruedas a 12 cm y sonar a 9,83 cm (la geometría medida es un experimento, ver [Geometría física](#geometría-física-del-iroh));
- modo de calibración manual;
- renderer procedural sobre Canvas2D (el modelo IROH 3D es un experimento);
- tres sensores de línea;
- sonar frontal geométrico (orientable con la cabeza virtual HEAD-CANVAS, `moverServoYaw`);
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

## Estado de las sesiones S01–S08

**Referencia curricular:** `SESSION-VALIDATION-2` es la última evaluación integral de las ocho sesiones con programas, sensores y recorridos en el simulador. Es anterior a HEAD-CANVAS y a la geometría medida y el modelo IROH 3D del experimento. Los estados de esa evaluación se conservan **como resultado histórico**, no como una revalidación posterior.

**Avances posteriores (12-10-2026):** HEAD-CANVAS incorporó el yaw virtual y el sonar orientable, hoy parte del runtime oficial de `main` (SIM-NOFIRVI-1); S08 recibió dos soluciones independientes probadas. Estas pruebas son adicionales y no equivalen a una evaluación curricular integral ni a pruebas del robot físico.

| Sesión | Resultado de `SESSION-VALIDATION-2` | Avance posterior o limitación vigente |
|---|---|---|
| S01 | ✅ Completa | Programa y actividades comprobados en la evaluación integral histórica. |
| S02 | ✅ Completa | Tres bases alcanzadas según IR en la evaluación integral histórica. |
| S03 | 🟡 Parcial | Faltan intersecciones configurables y resolver diferencias del material. |
| S04 | ✅ Completa | Seguimiento, gaps, intersecciones y meta con funciones propias. |
| S05 | 🟡 Parcial | Rutas comprobadas; el IR manual no reproduce el rebote físico. |
| S06 | 🟡 Parcial | Funciones y secuencia principal comprobadas; falta una intersección ausente del plotter. |
| S07 | 🔴 No completa | **Nuevo:** yaw virtual y sonar lateral operativos en HEAD-CANVAS. Falta validación integral de S07 y pitch. |
| S08 | 🟡 Parcial | **Nuevo:** dos soluciones con cabeza móvil verificadas en el simulador; persisten criterios curriculares pendientes. |

### Evidencia posterior: S07 y S08

- **S07:** `inicializarCabeza()` y `moverServoYaw(angulo)` funcionan en el runtime oficial (HEAD-CANVAS), y `leerDistanciaSonar()` mide en la dirección de la cabeza. La sesión S07 **no fue revalidada completa**; `moverServoPitch()` sigue sin modelo. Estas capacidades **están integradas en `main`** desde SIM-NOFIRVI-1; la evidencia de S07/S08 es histórica (simulador publicado el 12-10-2026) y no se ha repetido de forma integral sobre este `main`.
- **S08, posición inicial publicada:** la referencia docente corregida y la solución pedagógica NNJ superaron **40/40 casos automatizados cada una**: 38 llegadas a base, un caso de cero cajas (sin base) y una espera indefinida esperada ante IR anticipado. En esas pruebas no hubo colisiones ni cajas desplazadas y las lecturas laterales se realizaron con el cuerpo detenido.
- **Prueba manual:** ambas soluciones funcionaron en el escenario comunicado desde producción el 12-10-2026; esa observación es histórica y cubre un escenario por solución, no todos los casos.
- **Base 2:** la matriz histórica conserva **90/90 puntos verificables**; con la posición inicial publicada son **80/80** porque los 10 puntos de salida de la zona roja no aplican. En ambas evaluaciones permanecen **10 puntos de selección A/B sin verificación independiente**. La identificación de A/B en el plotter y el significado curricular de cero cajas también siguen pendientes.

**Nota sobre versiones:** los resultados de HEAD-CANVAS corresponden al simulador publicado el 12-10-2026; no se han repetido sobre SIM-NOFIRVI-1 y **no** constituyen una revalidación de S08 con la geometría medida del experimento ni una comprobación con hardware real.

Informes: [evaluación integral histórica](docs/sesiones-s01-s08.md) · [actualización y pruebas HEAD-CANVAS](https://github.com/nulljinx/BITIRO-Simulador/blob/563aa923fb9622214eaec9775f6e27f4a514a617/docs/sesiones-s01-s08.md) · [dos soluciones docentes S08](https://github.com/nulljinx/BITIRO-Simulador/blob/563aa923fb9622214eaec9775f6e27f4a514a617/examples/README.md).

### Línea oficial y experimento

| | `main` (oficial, SIM-NOFIRVI-1) | `experiment/measured-geometry-iroh3d` |
|---|---|---|
| Separación de ruedas / origen del sonar | 12 cm / 9,83 cm | 10 cm / 7,40 cm (medidos) |
| Modelo visual IROH 3D (`?robot=iroh`) | no | sí |
| Cabeza virtual HEAD-CANVAS | sí | no |
| FIRVI 2025 | no | no |
| Avisos de contacto SIM-UX-V1 y Guía por temas | sí | Guía sí; avisos no |

- La rama experimental conserva `main` tal como estaba en `6f4d6a7`; no se ha fusionado y reconciliarla con el runtime oficial es una decisión pendiente.
- El historial de producción anterior (SIM-UI-RELEASE-4, SIM-NNJ, HEAD-CANVAS, FIRVI, SIM-UX-V1) se conserva en `docs/versioning-and-releases.md` y `docs/release-*.md`.

## Geometría física del IROH

> **Experimental, no activa en el runtime oficial.** Lo descrito en esta sección vive en la rama `experiment/measured-geometry-iroh3d`. El runtime oficial usa rueda a 12 cm y sonar a 9,83 cm.

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

> **Experimental.** El modelo IROH 3D (`?robot=iroh`, `iroh-visual.js`, `assets/iroh/iroh-render-v1.js`) solo existe en la rama `experiment/measured-geometry-iroh3d`; el runtime oficial usa el renderer procedural de `renderer3d.js`.

| Selección | Renderer |
|---|---|
| por defecto | 3D clásico/legacy |
| `?robot=iroh` | modelo IROH 3D medido, experimental |

Ambos comparten la misma física, el mismo R, los mismos sensores, el mismo runtime, las mismas pistas y las mismas colisiones funcionales. **Cambiar el modelo visual no debe cambiar la trayectoria ni el programa.**

El modelo IROH 3D (rama experimental) usa `assets/iroh/iroh-render-v1.js`, `iroh-visual.js` y `renderer3d.js`.

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
head-config.js        configuración de la cabeza virtual
head-sonar.js         sonar orientable (yaw)
line-geometry.js      geometría de segmentos para el sensor de línea
scripts/build-pages.mjs   genera dist/ (35 archivos públicos)
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

La validación integral ejecuta las suites Node `tests/*.cjs`, además de pruebas específicas en Chrome. No se enumeran todas; algunas relevantes:

```bash
node tests/syntax.cjs             # sintaxis de todos los scripts
node tests/motor-dynamics.cjs      # aceleración/frenado simétricos
node tests/head-sonar.cjs         # cabeza virtual y sonar orientable
node tests/calibration-ui.mjs      # navegador real (Chrome por CDP); solo, sin Chrome imprime SKIP y sale con 0
node tests/head-ui.mjs            # navegador real (Chrome por CDP)
node scripts/build-pages.mjs      # build público y verificación de los 35 hashes
```

Las pruebas de navegador ejecutadas una a una se omiten con código 0 si no hay Chrome; `node scripts/run-suites.mjs --browser`, en cambio, exige `CHROME_BIN` y trata cualquier SKIP como fallo. Para ejecutar todas las suites oficiales (21 Node y 5 de navegador) y entender el CI: [`docs/ci-and-validation.md`](docs/ci-and-validation.md).

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
- [CI y validación](docs/ci-and-validation.md)
- [Baseline actual](docs/current-baseline.md)
- [Versionado y releases](docs/versioning-and-releases.md)
- [Release SIM-UI-RELEASE-4 (histórica)](docs/release-sim-ui-release-4.md)
- Release SIM-NOFIRVI-1 (candidato a producción oficial; migración de Pages pendiente): [`release-sim-nofirvi-1.md`](docs/release-sim-nofirvi-1.md); procedimiento en [`deployment-and-rollback.md`](docs/deployment-and-rollback.md)
- Release SIM-UX-V1 (histórica; incluía FIRVI): [`release-sim-ux-v1.md`](https://github.com/nulljinx/BITIRO-Simulador/blob/release/sim-ux-v1/docs/release-sim-ux-v1.md) (en `release/sim-ux-v1`)
- Release HEAD-CANVAS (histórica; su cabeza virtual forma parte de SIM-NOFIRVI-1): [`release-sim-head-canvas.md`](https://github.com/nulljinx/BITIRO-Simulador/blob/563aa923fb9622214eaec9775f6e27f4a514a617/docs/release-sim-head-canvas.md) y SIM-NNJ-101d19f: [`release-sim-nnj-101d19f.md`](https://github.com/nulljinx/BITIRO-Simulador/blob/563aa923fb9622214eaec9775f6e27f4a514a617/docs/release-sim-nnj-101d19f.md) (en `feature/head-canvas`)
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

Además existen tags de **despliegue** (no son versiones de producto): `sim-ui-release-4-deployed` y `sim-nnj-101d19f-deployed`. HEAD-CANVAS, publicado el 2026-10-12, no tenía tag propio al momento de esta auditoría. Posteriormente se registraron FIRVI (2026-10-25, `sim-prod-20261025-firvi` → `b06052b`) y SIM-UX-V1 (2026-11-08, `sim-ux-v1-deployed`, en la rama `release/sim-ux-v1`); esas etiquetas y la rama de release ya están publicadas en GitHub (`sim-ux-v1-deployed` → `149a1aa`; `sim-ux-v1-candidate` → `5f427d6`). Ver [`docs/versioning-and-releases.md`](docs/versioning-and-releases.md).

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
