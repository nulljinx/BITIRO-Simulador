# SIM-HEAD-CANVAS — cabeza virtual publicada (2026-10-12)

**Producción actual** (`https://simulador.nulljinx.com`): HEAD-CANVAS publicado el 2026-10-12 sobre la release anterior [`SIM-NNJ-101d19f`](release-sim-nnj-101d19f.md), que se conserva como historia.

| Dato | Valor |
|---|---|
| Fecha | 2026-10-12 |
| Alcance | seis archivos actualizados (comunicado por el usuario) |
| Verificación HTTPS pública | 8/8 correcta (comunicada por la persona que desplegó) |
| Respaldo previo al despliegue | `/home/nulljinx/deploy-backups/SIM-HEAD-20261012-123256-356406` |
| Rama de trabajo | `feature/head-canvas` (HEAD de referencia `c56799b`) |
| Rama `main` | **no** representa los bytes desplegados |

## Identidad por contenido (SHA-256 de los seis archivos publicados)

Manifiesto de publicación comunicado por el usuario el 2026-10-12 (lista `sha256  archivo`, sin cabecera ni hash del paquete):

```text
37053579590ce8f9d61573a4c0f8296f4c8bfed8e8149f75583a405c8e30f702  head-config.js
ae4577d63a082eaaaf7888cd0707d9cb6d3ccdc911c4ec6baf9d773c9df0c1b5  head-sonar.js
7b9ec10d75cfc438770c1afea269f253615a33ae82f96579b4cb1df98425db76  simulator.js
bdceaa329bf085332da876ff1ba8513e7cf9be99c78cfec499617f6d587ccebf  iroh-runtime.js
b120522d4adf8da543804fbd2e85d78e28e54512bdc2af790829eba9aaf98ce7  renderer3d.js
5747894d8b021cb2a896067df1593d79c06739bb2c9ba3a5829fc03039ef0775  index.html
```

Qué se ha comprobado y qué no:

- **Comprobado localmente:** los seis hashes coinciden exactamente con los archivos de `feature/head-canvas` en `c56799b` (`git show c56799b:<archivo> | sha256sum`) y con el árbol de trabajo (`sha256sum`), 6/6.
- **No comprobado aquí:** que los bytes servidos en `https://simulador.nulljinx.com` o el `SHA256SUMS` del servidor sean estos; los hashes provienen del manifiesto comunicado, no de una lectura del servidor.
- La identidad de lo publicado **no** debe deducirse de HEAD de `main` (no contiene estos archivos) sino de estos SHA-256.

## Qué incluye

Los únicos archivos de runtime que `feature/head-canvas` cambia respecto de su base (`93396ba`, que ya registra SIM-NNJ-101d19f) son seis: `head-sonar.js` (nuevo), `head-config.js` (nuevo), `index.html`, `iroh-runtime.js`, `renderer3d.js` y `simulator.js`. Coinciden en nombre y en SHA-256 con el manifiesto de publicación de la sección anterior (comprobado localmente contra `c56799b`; no contra el servidor).

- Módulos nuevos `head-sonar.js` (estado, movimiento progresivo y geometría del haz) y `head-config.js` (parámetros de esta versión), cargados antes de `simulator.js`.
- `inicializarCabeza()` y `moverServoYaw(angulo)` operativos: ángulos intermedios, giro progresivo, sonar orientado según el ángulo real de la cabeza (0° derecha · 90° frente · 180° izquierda).
- Giro visual de las piezas procedurales de la cabeza (apariencia; no afecta a la física).
- Guía actualizada: `moverServoYaw` mueve la cabeza con ángulos intermedios; el pitch sigue sin modelo.

No cambian pistas, geometría, calibración ni goldens de movimiento. Los programas anteriores se comportan igual (la cabeza al frente produce las mismas lecturas).

## Capacidades virtuales frente a hardware real

El yaw virtual está implementado; el pitch y la validación física siguen pendientes. Todo lo anterior es **modelo virtual**. No está medido en el robot real: velocidad de giro (180 °/s, provisional), espera de la cabeza (`1200 ms`, referencia provisional), alcance mecánico, altura del sonar (15,1 cm en el simulador; 18,1–19,7 cm según el modelo 3D), altura de las cajas (15,6 cm, supuesto), zona muerta y tiempo de asentamiento. El **pitch no tiene modelo**. Ver [`known-limitations.md`](known-limitations.md).

## Corrección posterior: inicio del programa docente de S08

Tras el despliegue se detectó que el programa docente de S08 comenzaba llamando `salirDeLaBase()`, pensada para un robot **dentro de la zona roja**. La posición inicial publicada de S08 (`track.start`, y = 152,8) ya está **después** de la barra inicial, y esa llamada hacía avanzar al robot hasta la barra siguiente sin contar las cajas (con la plantilla histórica y la pose real: «SIN CAJAS»).

- La versión corregida elimina la llamada y la función.
- Es una corrección del **programa de ejemplo**, no del simulador: ningún archivo desplegado cambia.
- **Evidencia manual (comunicada por el usuario, producción, 2026-10-12):** el programa corregido mostró el giro de la cabeza, el conteo de cajas, la navegación y la llegada a la base correcta. Una solución más sencilla para NNJ también se ejecutó y funcionó en el escenario probado. Es un escenario, sin registro en el repositorio; no demuestra que S08 esté completa en general.
- **Evidencia automatizada nueva:** `tests/head/s08-real-start.cjs`, ambos programas, pose real, 40/40 casos cada uno (detalle en [`../examples/README.md`](../examples/README.md)). Por programa: 38 casos que llegan a una base (con «Base: n» igual al total real), 1 caso «SIN CAJAS» (0 cajas, sin base) y 1 espera indefinida esperada (IR anticipado que se mantiene). La prueba verifica el historial del LCD («Cajas: n» antes de «Base: n») y, en la espera, que el robot llegó a la primera intersección y permaneció allí (≥ 30 s detenido en el nodo).
- **Evidencia histórica:** `tests/head/s08-matrix.cjs`, sin cambios, con el fixture `s08_cabeza_docente_historico.template.ino`.

## Límites de esta release

- S07 **no** se declara completa: su actividad no fue re-validada formalmente.
- S08 **no** se declara universalmente completa: sigue 🟡 (líneas A/B no identificadas inequívocamente en el plotter; 0 cajas sin significado curricular confirmado).
- **Base 2: 90/90 puntos verificables; los diez puntos de selección A/B siguen pendientes de evidencia** (el tronco no distingue A de B; solo hay evidencia declarativa en la LCD).
- Nada de esto se ha comprobado en el robot físico.
