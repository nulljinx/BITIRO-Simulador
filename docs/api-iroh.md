# API IROH y lenguaje soportado

Este documento describe la API que reconoce el intérprete de BITIRO Simulador en la baseline `b5683f0` (`RUNTIME-FUNCTIONS-1`).

## Modelo de lenguaje

El editor interpreta un subconjunto didáctico de Arduino/C++. No genera firmware y no ejecuta JavaScript arbitrario.

### Soportado

- tipos: `int`, `float`, `long`, `bool`, `byte`;
- variables globales y locales;
- declaraciones múltiples del mismo tipo;
- asignación, `+=`, `-=`, `++`, `--`;
- `if`, `else`, `while`;
- `+ - * / %`;
- `== != < > <= >=`;
- `&& || !` con cortocircuito;
- funciones propias con retorno `void/int/float/long/bool/byte`;
- parámetros tipados por valor;
- `return;` y `return expresión;`;
- funciones declaradas antes o después de `setup()`/`loop()`;
- llamadas anidadas y recursión limitada a 64 niveles;
- `pausa()` y `botonInicio()` dentro de funciones propias.

### No soportado actualmente

`const`, `for`, `switch`, arrays, `do-while`, `break`, operador ternario, prototipos separados, referencias, parámetros por defecto, `millis()`, `delay()`, `analogRead()` y el conjunto completo de Arduino/C++.

`loop()` es obligatoria. `setup()` es opcional.

## Funciones propias

```cpp
int doble(int n) {
    return n * 2;
}

void mostrar(int valor) {
    escribirPantalla(0, 0, valor);
}

void setup() {
    inicializarMovimiento();
}

void loop() {
    avanzar(doble(15));
}
```

Los parámetros se pasan por valor. Las funciones pueden leer y modificar variables globales, pero los locales del llamador no son visibles dentro de la función llamada.

Una función no-`void` que llega al final sin `return` produce error. Una función `void` no puede utilizarse como valor.

## Scheduler cooperativo

`pausa(ms)` y `botonInicio()` suspenden el intérprete sin bloquear el navegador. El `yield` se propaga a través de llamadas anidadas:

```cpp
int medirDespues() {
    pausa(500);
    return leerDistanciaSonar();
}
```

También es válido:

```cpp
void esperar() {
    botonInicio();
}
```

`finPrograma()` es distinto de `return`: detiene el programa completo.

## API del robot: funciones `void` (21)

Estas funciones no devuelven valor y solo pueden usarse como sentencias:

| Función | Semántica |
|---|---|
| `avanzar(v)` / `avanzar(izq, der)` | Consigna ruedas hacia delante. |
| `retroceder(v)` / `retroceder(izq, der)` | Consigna ruedas hacia atrás. |
| `girarDerecha(v)` | Giro diferencial a la derecha. |
| `girarIzquierda(v)` | Giro diferencial a la izquierda. |
| `detenerse()` | Consignas a cero. |
| `pausa(ms)` | Suspensión cooperativa por tiempo simulado. |
| `finPrograma()` | Finaliza todo el programa. |
| `botonInicio()` | Espera cooperativa hasta Pulsador=1. |
| `escribirPantalla(col,fila,valor)` | Escribe en LCD 16×2. |
| `borrarPantalla()` | Limpia LCD. |
| `apagarPantalla()` | Reconocida; sin efecto físico modelado. |
| `prenderPantalla()` | Reconocida; sin efecto físico modelado. |
| `inicializarMovimiento()` | Habilita movimiento en modo estricto. |
| `inicializarSensores()` | Habilita lecturas en modo estricto. |
| `inicializarCabeza()` | Habilita la cabeza móvil (en modo estricto debe llamarse antes de `moverServoYaw`). Si el módulo `head-sonar.js` no está cargado, avisa y no tiene efecto. |
| `inicializarGolpe()` | Inicializa garra y la lleva al centro. |
| `inicializarPantalla()` | Inicialización lógica de LCD. |
| `apagarCabeza()` | Reconocida; sin efecto físico modelado. |
| `moverServoYaw(v)` | Gira la cabeza (sonar) a `v` grados: 0 = derecha, 90 = frente, 180 = izquierda. Acepta **ángulos intermedios** (se cuantiza a 1°; fuera de 0–180 se limita con aviso) y el movimiento es **progresivo** (180 °/s, parámetro virtual provisional, no medido): la orden no bloquea y la cabeza tarda hasta 1 s en recorrer 0°–180°, así que el programa debe esperar (`pausa()`) antes de leer el sonar. Requiere un número finito. Sin `head-sonar.js` cargado, avisa y no tiene efecto. |
| `moverServoPitch(v)` | Reconocida; sin efecto físico modelado. |
| `moverServoGolpe(v)` | `-1` izquierda, `0` centro, `1` derecha. |

Un uso como `int x = pausa(10);` se rechaza antes de ejecutar.

## API del robot: funciones con retorno numérico (12)

| Función | Retorno actual |
|---|---|
| `leerSensorLineaIzquierdo()` | lectura bruta 0–1023 |
| `leerSensorLineaCentral()` | lectura bruta 0–1023 |
| `leerSensorLineaDerecho()` | lectura bruta 0–1023 |
| `leerBoton()` | 0 libre / 1 presionado |
| `leerDistanciaSonar()` | distancia geométrica; 200 = sin objeto/en alcance máximo. Mide en la dirección **real** de la cabeza en ese instante (no en la del último `moverServoYaw`); con la cabeza al frente (90°) es idéntica a la lectura anterior |
| `leerLineaNormalizada(k)` | 0–1000 para k=0/1/2 |
| `leerUmbralLinea()` | umbral normalizado guardado |
| `lineaIzquierda()` | 0/1 |
| `lineaCentral()` | 0/1 |
| `lineaDerecha()` | 0/1 |
| `leerSensorObstaculoIzquierdo()` | IR manual izquierdo 0/1 |
| `leerSensorObstaculoDerecho()` | IR manual derecho 0/1 |

## Inicialización y modo estricto

Cuando el programa usa `setup()/loop()`, el runtime opera en modo estricto. Se espera que el estudiante inicialice los subsistemas correspondientes. Un uso sin inicializar genera advertencias y puede devolver valores neutros o impedir movimiento según la API.

Ejemplo:

```cpp
void setup() {
    inicializarMovimiento();
    inicializarSensores();
    inicializarGolpe();
}
```

## Pulsador

`leerBoton()` consulta el estado actual. `botonInicio()` espera por **nivel**, no por flanco:

- si el Pulsador está libre, espera;
- si ya está presionado al llegar a la llamada, continúa inmediatamente;
- no consume ni libera el Pulsador;
- dos `botonInicio()` consecutivos pasan si el botón sigue presionado.

## Garra

```cpp
moverServoGolpe(-1); // izquierda del robot
moverServoGolpe(0);  // centro
moverServoGolpe(1);  // derecha del robot
```

Valores distintos de `-1/0/1` producen aviso y no mueven la garra.

## Errores y límites

El runtime valida aridad, nombres, funciones duplicadas, parámetros duplicados, uso incorrecto de `return`, variables no declaradas y funciones inexistentes. La profundidad máxima de llamadas es 64 para evitar que una recursión infinita congele el navegador.

Algunas construcciones no soportadas tienen mensajes específicos; otras siguen siendo parte del trabajo de compatibilidad futura.

## Cabeza móvil (yaw) — referencia de desarrollo

- Módulos: `head-sonar.js` (estado, movimiento y geometría del haz) y `head-config.js` (parámetros de esta versión). Orden de carga fijo en `index.html`: `head-sonar.js` → `head-config.js` → `simulator.js`. `iroh-runtime.js` no depende del orden: consulta `HEAD_SONAR` al ejecutar cada comando.
- Si la página se carga sin esos módulos (por ejemplo, `index.html` en caché de una versión anterior), los programas antiguos funcionan igual y `inicializarCabeza()` / `moverServoYaw()` muestran un aviso comprensible en lugar de un error.
- `moverServoPitch()` y `apagarCabeza()` siguen sin efecto.
- La cabeza vuelve a 90° al reiniciar y al cambiar de pista.

### Ejemplos de uso en S08

Dos programas docentes independientes usan estas funciones para contar cajas con la cabeza y el cuerpo detenido: la referencia parametrizada y la versión NNJ simplificada ([`../examples/README.md`](../examples/README.md)). Ambas esperan con `pausa(1200)` tras `moverServoYaw(...)` y leen `leerDistanciaSonar()` con la cabeza de lado; los 1200 ms son un valor virtual provisional, no una medición. Son material didáctico: no forman parte de la API ni del código inicial.

### Valores virtuales provisionales (NO medidos en el robot real)

| Valor | Uso | Estado |
|---|---|---|
| 180 °/s | velocidad del giro | provisional |
| `esperaCabeza = 1200` ms | referencia virtual para esperar el recorrido máximo (1000 ms + margen) en el programa docente experimental | provisional |
| altura del sonar 15,1 cm | las cajas más bajas no se detectan | **incierta**: el modelo 3D sugiere 18,1–19,7 cm |
| altura de las cajas 15,6 cm | valor por omisión del escenario | **supuesto** |

Con una altura de sonar de 18,9 cm una caja de 15,6 cm no se detecta: la combinación real de ambas alturas puede producir «SIN CAJAS» y debe medirse antes de usar valores como definitivos.
