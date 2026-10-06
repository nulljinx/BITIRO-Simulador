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
| `inicializarCabeza()` | Reconocida; cabeza aún no modelada. |
| `inicializarGolpe()` | Inicializa garra y la lleva al centro. |
| `inicializarPantalla()` | Inicialización lógica de LCD. |
| `apagarCabeza()` | Reconocida; sin efecto físico modelado. |
| `moverServoYaw(v)` | Reconocida; sin efecto físico modelado. |
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
| `leerDistanciaSonar()` | distancia geométrica; 200 = sin objeto/en alcance máximo |
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
