# Guía de uso

## 1. Abrir el simulador

Abre https://simulador.nulljinx.com y selecciona una pista.

Las pistas S01–S08 corresponden a sesiones de trabajo; Óvalo y Ocho son circuitos libres. Elegir una sesión **no obliga** al robot a resolverla.

## 2. Escribir código

El editor acepta un subconjunto de Arduino/C++.

Ejemplo de seguidor sencillo:

```cpp
void setup() {
    inicializarMovimiento();
    inicializarSensores();
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

El código queda guardado localmente por pista.

## 3. Ejecutar

- **Ejecutar**: valida e inicia el programa.
- **Pausar/Continuar**: detiene o reanuda el tiempo simulado.
- **Paso +0,1 s**: avanza de forma controlada mientras permanece en pausa.
- **Reiniciar**: cancela la ejecución, restablece robot/cajas y libera entradas manuales.
- **Restaurar código inicial**: vuelve al starter de la sesión con confirmación si hay cambios.

## 4. Pulsador

El Pulsador es un toggle `Libre / Presionado`.

```cpp
botonInicio();
```

espera hasta que el Pulsador esté presionado.

```cpp
if (leerBoton() == 1) {
    avanzar(30);
}
```

solo consulta el estado actual.

Si el Pulsador ya estaba presionado al llegar a `botonInicio()`, la llamada continúa inmediatamente.

## 5. IR

IR izquierdo y derecho son entradas manuales:

```cpp
leerSensorObstaculoIzquierdo();
leerSensorObstaculoDerecho();
```

No detectan automáticamente cajas. Actívalos para probar ramas distintas de tu programa.

## 6. Línea

Lectura bruta:

```cpp
leerSensorLineaIzquierdo();
leerSensorLineaCentral();
leerSensorLineaDerecho();
```

Lectura normalizada / binaria:

```cpp
leerLineaNormalizada(0);
lineaIzquierda();
lineaCentral();
lineaDerecha();
```

Los gaps son huecos reales en la geometría: si tu algoritmo no incluye una estrategia de recuperación, el robot puede detenerse o perder la pista.

## 7. Sonar

```cpp
inicializarSensores();
int d = leerDistanciaSonar();
```

El sonar actual mira hacia delante con un cono geométrico estrecho. Una caja fuera del cono no se detecta aunque esté cerca lateralmente.

## 8. Garra

```cpp
inicializarGolpe();
moverServoGolpe(-1); // izquierda
moverServoGolpe(0);  // centro
moverServoGolpe(1);  // derecha
```

En `Más → Garra manual` puedes moverla fuera de ejecución de código. Durante un programa, los controles manuales se deshabilitan para que la acción dependa del código.

## 9. Editar escenario

`Más → Editar escenario` abre un editor top-down.

Puedes:

- añadir cajas;
- arrastrarlas;
- editar X/Y en centímetros;
- eliminar;
- vaciar;
- restaurar el predeterminado;
- cancelar o aplicar.

Las cajas son 8×8 cm y deben quedar dentro de la pista, sin solaparse con el robot, otra caja o la garra inicial.

El escenario se guarda por pista. Reiniciar devuelve las cajas a sus posiciones configuradas.

## 10. LCD

```cpp
inicializarPantalla();
escribirPantalla(0, 0, 123);
escribirPantalla(0, 1, 45);
borrarPantalla();
```

La LCD virtual tiene 16 columnas × 2 filas.

## 11. Funciones propias

```cpp
int velocidad(int d) {
    if (d < 8) return 0;
    if (d <= 12) return 20;
    return 40;
}

void seguir(int v) {
    if (lineaCentral()) avanzar(v);
    else if (lineaIzquierda()) avanzar(10, v);
    else if (lineaDerecha()) avanzar(v, 10);
    else detenerse();
}
```

`pausa()` y `botonInicio()` funcionan dentro de funciones propias.

## 12. Explorar errores

El simulador no corrige automáticamente:

- ruta equivocada;
- velocidad demasiado alta;
- giro incorrecto;
- pérdida de línea;
- conteo incorrecto;
- golpe hacia el lado equivocado.

Ese comportamiento forma parte del aprendizaje.

## 13. Limitaciones actuales

La cabeza yaw/pitch aún no está modelada; `millis()` y varias construcciones Arduino/C++ tampoco. Consulta `known-limitations.md` antes de portar código del robot físico o del Lab literalmente.
