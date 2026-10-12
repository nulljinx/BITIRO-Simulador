# Ejemplos de S08 · dos soluciones independientes

Este directorio contiene soluciones **didácticas** para docentes. No forman parte del runtime, no se publican en producción, **no** son el código inicial del estudiante (`starters.js` no se modifica) y ningún mecanismo del simulador las ejecuta ni resuelve el desafío por el estudiante.

Ambas soluciones asumen la **posición inicial publicada de S08** (`track.start`: x 37,853 · y 152,8 · rumbo −π/2, ver [`../docs/track-model.md`](../docs/track-model.md)). Esa pose ya está **después** de la barra inicial y fuera de la zona roja: el programa no debe llamar a `salirDeLaBase()` ni esperar una barra de salida.

| Versión | Archivo | Para qué sirve |
|---|---|---|
| **Referencia docente** | [`../tests/head/fixtures/s08_cabeza_docente.template.ino`](../tests/head/fixtures/s08_cabeza_docente.template.ino) | Solución parametrizada (plantilla `{{V}}`, `{{ACERCAR}}`…) con funciones con nombre propio, comentarios y los números calibrados. Es la que usan las pruebas para fijar «qué debe poder lograr un programa correcto». |
| **Solución pedagógica NNJ** | [`s08_nnj_simplificado.ino`](s08_nnj_simplificado.ino) | Versión más corta y legible, con números ya fijados (`avanzar(30)`, `pausa(1075)`, `pausa(1800)`…), pensada para mostrar a niñas, niños y jóvenes la estructura del problema. Es el archivo entregado por el usuario, **byte a byte**. |

## Cómo usarlas (y cómo no)

- Son para **leer, comparar y comentar** con el grupo. No se cargan solas en el editor.
- No sustituyen el trabajo del estudiante: el simulador sigue sin gobernar al robot (*las sesiones configuran el mundo; nunca gobiernan al robot*).
- Los números fijos (tiempos de `pausa`, velocidad 30) están ajustados a **este simulador**. En el robot real hay que recalibrarlos; no se han medido.

## Qué está comprobado y qué no

Tres niveles que no deben mezclarse:

1. **Pruebas automatizadas históricas** (pose de partida dentro de la zona roja; solo la referencia docente con `salirDeLaBase()`): `tests/head/s08-matrix.cjs`, 68 ejecuciones, 67 con todo lo verificable (la restante es una espera indefinida esperada), 0 colisiones, 0 cajas movidas. Se conservan sin cambios con el fixture `s08_cabeza_docente_historico.template.ino`.
2. **Pruebas automatizadas nuevas** (pose real de `track.start`, ambos programas): `node tests/head/s08-real-start.cjs`. Ver «Resultados» abajo.
3. **Evidencia manual comunicada por el usuario** (12-10-2026, producción): la referencia docente corregida y la solución NNJ funcionaron en el escenario probado (giro de cabeza, conteo de cajas, navegación y llegada a la base correcta). Fue **un escenario**, no una matriz, y no tiene registro en este repositorio.

Nada de lo anterior se ha comprobado con el robot físico: velocidad de la cabeza, esperas, alturas del sonar y de las cajas siguen sin medición definitiva; el pitch no tiene modelo.

## Resultados de las pruebas nuevas (pose real)

`node tests/head/s08-real-start.cjs` → 40 casos por programa: 0 cajas; 1 caja en cada una de las 4 posiciones; todas las combinaciones de 2, 3 y 4 cajas; rutas A (IR izquierdo) y B (IR derecho); más señales IR especiales (ambos IR, IR previo, activación nueva a +0,5 s, liberar y reactivar, pulso en el gap, IR anticipado que se mantiene).

| Programa | Casos conformes | Colisiones | Cajas desplazadas | Cuerpo en movimiento durante la lectura lateral |
|---|---|---|---|---|
| Referencia docente corregida | 40/40 | 0 | 0 | 0 cm |
| Solución NNJ simplificada | 40/40 | 0 | 0 | 0 cm |

Cada caso exige: pose inicial igual a `track.start`; lecturas laterales con el cuerpo detenido (evidencia por geometría del haz para cada posición, con o sin caja); LCD «Cajas: n» correcta (o «SIN CAJAS» con 0); parada sobre la primera intersección y avance solo tras una activación **nueva y exclusiva** de un IR; base correcta con LCD «Base: n»; 0 colisiones; 0 cajas movidas. El criterio «salir de la base» (10 pts) del evaluador histórico **no aplica** (el robot ya parte después de la barra) y se excluye.

**Base 2: 80/80 puntos verificables (90 − 10 de «salir de la base» que no aplica) en estas pruebas, equivalentes a los 90/90 históricos; los diez puntos de selección A/B siguen pendientes** porque el tronco central no distingue A de B.

### Límites que las pruebas dejan a la vista

- **Posición de partida:** ambas soluciones dependen de la pose publicada. Con la pose histórica (dentro de la zona roja) la solución NNJ no cuenta correctamente (control informativo: 3 cajas → «Base: 2»), y con la pose publicada la plantilla histórica con `salirDeLaBase()` termina con «SIN CAJAS». Es la razón de mantener fixtures separados.
- La evidencia es de un simulador determinista, sin ruido ni zona muerta del sonar real.
- La espera de la cabeza (`1200 ms`) y la velocidad de giro (180 °/s) son valores virtuales provisionales.

## Cómo reproducir

```bash
node tests/head/s08-real-start.cjs          # ambos programas (≈ 1 min)
node tests/head/s08-real-start.cjs nnj      # solo la solución NNJ
node tests/head/s08-matrix.cjs              # matriz histórica (pose en zona roja)
```

La salida detallada se escribe en el directorio temporal del sistema (`HEAD_S08_OUT` para cambiarlo), nunca en el repositorio.
