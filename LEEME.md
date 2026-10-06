# BITIRO Lab v4 · Calibrar, programar y observar

Mejora del simulador 3D v3 aportado. Aplicación local, sin instalaciones, cuentas ni recursos de internet.

## Abrir

1. Extrae **todo** el ZIP.
2. Abre `index.html` con Chrome o Edge. Conserva los JS, CSS y la carpeta `assets` junto al HTML.
3. Pulsa **Calibrar sensores**, mide blanco y negro y guarda.
4. Elige un ejemplo y pulsa **Ejecutar código**. **Pausar → Paso +0,1 s** permite observar la evolución sin modificar el programa.

Node solo es necesario para ejecutar las pruebas, no para usar el simulador.

## Calibración de línea

La calibración es **solo de los sensores de línea**, sin ajustes de motores. Ofrece referencias independientes de blanco y negro para los tres canales, un umbral normalizado de 100 a 900 y validación de contraste mínimo (100 puntos brutos).

Los botones de medición leen dos superficies de un **banco virtual** usando el mismo modelo óptico de la pista: blanco 155 y negro 865. Son valores deterministas e ilustrativos. Puedes introducir referencias manuales para experimentar con una calibración incorrecta o invertida. El banco no conecta con el robot físico ni obtiene medidas reales.

La normalización por canal es:

`normalizado = limitar(1000 × (lectura − blanco) / (negro − blanco), 0, 1000)`

La detección se activa cuando el valor normalizado es **mayor o igual** al umbral guardado, inicialmente 500. Invertir las referencias invierte la polaridad. La lectura bruta no cambia al calibrar.

| Función | Resultado |
|---|---|
| `leerSensorLineaIzquierdo()` | Lectura bruta 0–1023 |
| `leerSensorLineaCentral()` | Lectura bruta 0–1023 |
| `leerSensorLineaDerecho()` | Lectura bruta 0–1023 |
| `leerLineaNormalizada(0)` | Izquierdo, 0–1000 |
| `leerLineaNormalizada(1)` | Central, 0–1000 |
| `leerLineaNormalizada(2)` | Derecho, 0–1000 |
| `lineaIzquierda()` / `lineaCentral()` / `lineaDerecha()` | 1 = negro detectado; 0 = blanco |
| `leerUmbralLinea()` | Umbral normalizado guardado |

Las lecturas necesitan `inicializarSensores()` en programas con `setup()/loop()`. El ejemplo de tres sensores aplica la calibración vigente. Un programa anterior que compare la lectura bruta contra `500` conserva esa comparación: para aprovechar la calibración debes usar las nuevas funciones.

Abrir el formulario pausa la ejecución. Guardar o cerrar conserva esa pausa; pulsa **Continuar**. Las modificaciones no guardadas se descartan. Si el navegador bloquea el almacenamiento, el simulador sigue funcionando y avisa al guardar la calibración.

## Movimiento y coherencia del código

- Física con paso fijo de 1/120 s y representación interpolada; reproducción a 0,5×, 1×, 2× y 4×.
- Aceleración gradual de las ruedas; `detenerse()` detiene inmediatamente el movimiento. No se añade calibración de motores.
- Al ocultar la pestaña, el tiempo simulado no avanza. Se limita la recuperación tras bloqueos largos para evitar saltos.
- Rutas de demostración remuestreadas por distancia para evitar giros debidos a puntos demasiado separados.
- Geometría fija de la pista en caché y rastro acotado para contener el coste de renderizado.
- Posición visual de los sensores compartida con su lectura. La vista superior superpone las huellas bajo el chasis: verde = negro detectado; ámbar = blanco.
- Sonar de tres rayos (central y ±6°) desde el transductor hasta las caras de cajas a su altura. Devuelve 200 si no detecta nada en alcance. No es un modelo acústico.
- Pausas encadenadas sin añadir sistemáticamente un fotograma a cada espera.
- `finPrograma()` interrumpe la ejecución incluso dentro de bucles; no ejecuta instrucciones posteriores.
- Operadores lógicos con cortocircuito y resultado 0/1. Conversiones de `int`, `long`, `float`, `bool` y `byte`; división según el tipo. Validación de pausas negativas, divisores cero y valores no finitos.
- El golpe requiere `inicializarGolpe()`. En modo código se desactiva el botón manual para que la acción dependa del programa.
- Los IR manuales se conservan al iniciar código o demostración; Reiniciar los devuelve a cero.

`avanzar(izquierda, derecha)` establece las consignas. Una rueda izquierda más rápida gira hacia la derecha; una derecha más rápida gira hacia la izquierda. La telemetría muestra las **consignas**, mientras el movimiento aplica aceleración gradual.

El editor es un **intérprete de un subconjunto de Arduino/C++**, no un compilador de firmware. Admite funciones propias (`void`, `int`, `float`, `long`, `bool`, `byte`, con parámetros por valor, `return` y hasta 64 llamadas anidadas), pero no `for`, arrays, clases, `break` ni toda la biblioteca Arduino. `int` y `long` se truncan, pero no emulan los desbordamientos de cada placa; `float` usa la precisión de JavaScript. `botonInicio()` representa el inicio al pulsar Ejecutar código. Las funciones de cabeza, botón físico y encendido/apagado de pantalla sin modelo emiten un aviso.

## Uso pedagógico

Cada pista presenta un objetivo de práctica y una pregunta para anticipar el resultado. Son propuestas de trabajo, **no una rúbrica institucional validada**.

1. Calibra y explica la diferencia entre valor bruto y normalizado.
2. Predice la acción para los patrones `[0,1,0]`, `[1,0,0]` y `[1,1,1]`.
3. Ejecuta, pausa y avanza de 0,1 en 0,1 segundos.
4. Compara sensores, consignas y trayectoria. Cambia una sola condición y repite.

**Demostración** sigue una ruta predefinida: no usa el programa ni los sensores de línea para conducir. **Ejecutar código** aplica el algoritmo escrito. Completar una demostración no significa resolver la misión.

El panel de evidencia muestra distancia recorrida, porcentaje del tiempo en movimiento con algún sensor detectando línea y episodios de contacto. Ayuda a comparar ensayos; no califica ni comprueba clasificación, conteo, selección de base o final de misión.

Los IR son **entradas manuales**, no detección automática de las cajas. El ejemplo básico se detiene al perder la línea; atravesar un hueco como el de S04 requiere programar búsqueda y memoria. El ejemplo de sonar avanza en línea recta y permite practicar el golpe en S01; no resuelve todas las pistas.

En S01 la demostración se detiene ante la caja; **Golpe** la desplaza y el recorrido continúa desde esa posición. En S06 puede existir contacto lateral: el chasis se detiene y el golpe frontal no alcanza la caja desde ese ángulo. Debes modificar la trayectoria del programa, sin fuerzas a distancia ni atravesar objetos.

## Geometría y límites

Se conservan las diez pistas y las referencias aportadas. S01–S06 y S08 son los plotters oficiales reconstruidos desde los PDF vectoriales (ver `docs/track-model.md`); S07 · Repaso no tiene pista propia y es una superficie neutra. Óvalo y ocho son circuitos libres. Las zonas pintadas no realizan una evaluación automática.

El IROH y sus dimensiones siguen siendo ilustrativos. Se usa geometría 3D proyectada en Canvas, sin CAD medido ni WebGL. Se conserva la física de contacto del golpe de v3. La interfaz se adapta a móvil y escritorio; **Estándar** reduce el coste de dibujo respecto de **Alta**.

## Verificación

Con Node, desde esta carpeta:

```text
node tests/regression.cjs
```

Ejecuta la suite mecánica original adaptada y **21 grupos de regresión**: calibración, persistencia, pausa del formulario, API de sensores, fin de programa, lógica, errores, tipos, esperas, paso, consistencia a 30/60/144 fps, aceleración, sonar, giro, IR, rutas, ejemplos, orientación inicial de circuitos cerrados y ciclo completo de S01.

También se revisaron en navegador calibración, persistencia tras recarga, ejecución/pausa/paso y presentación a 1440 y 390 píxeles de ancho. La revisión visual se realizó mediante un servidor local: la política del navegador de pruebas bloquea la navegación directa a archivos file://. No se verificó contra hardware ni contra un currículo oficial.

## Archivos

- `calibration.js`: referencias, normalización y almacenamiento tolerante a fallos.
- `iroh-runtime.js`: parser, intérprete y ejemplos.
- `simulator.js`: física, reloj, cámaras, interfaz y guías.
- `strike-physics.js`: contactos del brazo y cajas, conservados de v3.
- `renderer3d.js`: escena procedural y huellas de sensores.
- `tracks.js` / `extra-tracks.js`: geometrías aportadas.
- `tests/`: pruebas reproducibles sin dependencias externas.

