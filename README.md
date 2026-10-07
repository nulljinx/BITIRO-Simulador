# BITIRO Simulador

Simulador web gratuito para programar y experimentar con el robot educativo **IROH** desde el navegador.

**Probar en línea:** https://simulador.nulljinx.com  
**Repositorio:** https://github.com/nulljinx/BITIRO-Simulador  
**BITIRO Lab:** https://bitiro-piloto.nulljinx.com/

> Estado: **piloto público / beta funcional**. El proyecto está en desarrollo activo y algunas capacidades del robot físico todavía están pendientes de modelado o validación.

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

- movimiento diferencial con aceleración y paso fijo determinista;
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
int velocidad(int distancia) {
    if (distancia < 8) return 0;
    if (distancia <= 12) return 20;
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

Última validación funcional integral: `SESSION-VALIDATION-2` (programas reales con funciones propias, recorridos físicos y escenarios), sobre un runtime que ya está desplegado en producción.

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

- **S04** quedó validada completa tras `RUNTIME-FUNCTIONS-1`: gaps, intersecciones y meta con funciones propias reales.
- **S06** ya ejecuta `int velocidad(int)`, `void seguidor(...)`, `return` y su flujo físico principal (velocidad normal/reducida, detención, golpe y continuación). Sigue parcial porque la intersección que exige el material no está impresa en el plotter oficial. `millis()` afecta solo a un bonus opcional; no es el bloqueo principal.
- **S07** sigue bloqueada por HEAD-SERVO (cabeza yaw/pitch y sonar orientable).
- **S03, S05 y S08** mantienen limitaciones de pista, entradas o modelo del sensor.

Producción pública (`simulador.nulljinx.com`) está desplegada con `RUNTIME-FUNCTIONS-1` y verificada en escritorio, tablet y móvil. Consulta [`docs/sesiones-s01-s08.md`](docs/sesiones-s01-s08.md) para la evidencia y las limitaciones por sesión.

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
calibration.js        modelo simulado de sensores de línea + light field
tracks.js             pistas base
extra-tracks.js       pistas adicionales
scenario-props.js     modelo y persistencia de cajas
scenario-editor.js    editor accesible de escenario
starters.js           código inicial por sesión
tests/                pruebas deterministas y regresiones
```

El renderer actual es una proyección procedural sobre Canvas, no un CAD ni un motor WebGL completo.

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

La baseline actual tiene 14 suites principales (más la de interfaz en navegador):

```bash
node tests/track-digitize.cjs
node tests/smoke.cjs
node tests/regression.cjs
node tests/sim1.cjs
node tests/ui-contract.cjs
node tests/ui-shell.cjs
node tests/syntax.cjs
node tests/pilot5.cjs
node tests/strike-audit.cjs
node tests/scenario-props.cjs
node tests/runtime-start.cjs
node tests/runtime-servo.cjs
node tests/runtime-functions.cjs
node tests/calibration.cjs
node tests/calibration-ui.mjs   # navegador real (Chrome por CDP); se omite sin Chrome
```

Modo calibración y modelo de sensor simulado: [`docs/calibration-mode.md`](docs/calibration-mode.md).

`SIM-1` usa trazas deterministas y goldens. Los goldens **no deben regenerarse automáticamente**: una modificación exige revisar y aprobar el cambio de comportamiento.

## Documentación

- [Guía de uso](docs/user-guide.md)
- [API IROH y lenguaje](docs/api-iroh.md)
- [Estado S01–S08](docs/sesiones-s01-s08.md)
- [Arquitectura](docs/architecture.md)
- [Modelo de pistas y escenarios](docs/track-model.md)
- [Baseline actual](docs/current-baseline.md)
- [Limitaciones conocidas](docs/known-limitations.md)
- [Baseline v4 histórica](docs/sim-v4-baseline.md)
- [Historia de decisiones de UI](docs/pilot-ui-reference.md)

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
