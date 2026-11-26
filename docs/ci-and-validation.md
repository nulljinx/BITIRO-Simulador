# CI y validación

Describe cómo se valida el repositorio: los dos scripts de `scripts/` que lo sostienen y los tres jobs de `.github/workflows/ci.yml`. No hay dependencias que instalar (`npm install` no es necesario); solo hace falta Node 24 y, para las pruebas de navegador, Chrome.

## Cuándo se ejecuta

`ci.yml` se dispara con:

- `pull_request` hacia `main`.
- `push` a `main`.

Los eventos de una misma rama se serializan con `concurrency` (`cancel-in-progress: true`): un push nuevo cancela la ejecución anterior de esa referencia. Los permisos son solo lectura (`contents: read`) y el checkout no persiste credenciales.

## Jobs de GitHub Actions

| Job | Qué ejecuta | Bloquea | Tiempo máximo |
|---|---|---|---|
| `pages-build` | `node scripts/build-pages.mjs` y luego `node scripts/verify-dist.mjs` | Sí | 10 min |
| `node-tests` | `node scripts/run-suites.mjs` (22 suites Node) | Sí | 20 min |
| `browser-tests` | `node scripts/run-suites.mjs --browser` (6 pruebas de navegador) | **No** (`continue-on-error: true`) | 30 min |

«Bloquea» describe el comportamiento del job, no la protección de rama: que un check sea obligatorio para fusionar se configura en GitHub, no en este archivo (y esta guía no puede comprobar esa configuración).

- `pages-build` y `node-tests` **son los checks obligatorios**: deben pasar, y deben estar marcados como requeridos en la protección de rama de `main`.
- `browser-tests` es **informativo** (`continue-on-error: true`) y no debe exigirse como check obligatorio hasta que se haya validado en GitHub. Por eso mismo **debe revisarse expresamente antes de fusionar**: un fallo no bloquea el merge por sí solo. Si falla, un paso final emite una anotación `::error` y un resumen en `GITHUB_STEP_SUMMARY` para que no pase inadvertido.

Estado de SIM-IROH-WELCOME-2 (candidato, **no publicado**): validado en local; el CI remoto **aún no se ha ejecutado** sobre esta release (no hay push ni Pull Request). Ver [`release-sim-iroh-welcome-2.md`](release-sim-iroh-welcome-2.md).

El job `browser-tests` localiza Chrome del runner y crea un envoltorio (`$RUNNER_TEMP/chrome-nosandbox`) que lo lanza con `--no-sandbox`, porque el runner restringe los user namespaces; lo exporta como `CHROME_BIN`.

### Variable `MANIFEST_SHA256`

Definida a nivel de workflow en `ci.yml`. Es el **pin aprobado**: el SHA-256 de `scripts/pages-manifest.json` del candidato vigente, **SIM-IROH-WELCOME-2** (`approvedCommit` `403e243c8374e5effce0636adfae752644c3a007`, `approvedTree` `7a9b7033660e227e6b44879fbb31ad2a24c2dcd4`):

```
c8ed94a54a2b926672dee7afde025258f4e335ec999e242d924086aa9e56dda3
```

`verify-dist.mjs` la exige. Cambiar el manifiesto obliga a cambiar este valor **en el mismo commit**, de modo que la modificación quede visible en la revisión.

Referencias históricas (ya no vigentes): SIM-IROH-WELCOME-1, manifiesto `81ea7df5…8ebd`, archivado en `docs/releases/sim-iroh-welcome-1.pages-manifest.json`; SIM-IROH-UI-1, manifiesto `25a4d96e…26f82`, archivado en `docs/releases/sim-iroh-ui-1.pages-manifest.json`; SIM-NOFIRVI-1 (35 archivos), manifiesto `cd995db8…cbe24`, archivado en `docs/releases/sim-nofirvi-1.pages-manifest.json`. Los manifiestos archivados no se editan.

## `scripts/build-pages.mjs`

Genera `dist/` (ignorado por Git) a partir de la allowlist de `scripts/pages-manifest.json`. Antes de copiar nada comprueba que hay 43 entradas y que cada origen existe y coincide con su SHA-256; después borra `dist/`, copia los 43 archivos y vuelve a comprobar que no sobra ni falta ninguno y que cada hash es el aprobado. Falla con código 1 y la lista completa de errores.

## `scripts/verify-dist.mjs`

Comprobación **independiente** de `dist/`: no reutiliza código de `build-pages.mjs`, de modo que un error en el build no puede ocultarse a sí mismo. Exige:

1. Que `MANIFEST_SHA256` esté definida y coincida con el SHA-256 real de `scripts/pages-manifest.json`; el valor es el pin aprobado, no se calcula a partir del manifiesto.
2. Exactamente 43 archivos en `dist/`.
3. El conjunto exacto de rutas del manifiesto (sin extras ni faltantes).
4. El SHA-256 de cada archivo.
5. Ninguna ruta bajo `docs/`, `tests/` o `examples/`, ni cuyo nombre contenga «firvi».

Verificación local **contra el pin aprobado** (esta es la comprobación de integridad):

```bash
node scripts/build-pages.mjs
MANIFEST_SHA256=c8ed94a54a2b926672dee7afde025258f4e335ec999e242d924086aa9e56dda3 node scripts/verify-dist.mjs
```

Para que sea una comprobación real, el valor debe ser el pin escrito en `ci.yml` (puedes extraerlo de ahí), nunca un hash recalculado a partir del manifiesto que se está verificando.

Para **diagnosticar** (por ejemplo, saber qué hash tiene ahora un manifiesto que acabas de cambiar y debes poner en el pin) sí puedes calcularlo:

```bash
sha256sum scripts/pages-manifest.json
```

Ese hash recalculado solo describe el archivo tal como está: **no** demuestra que sea el aprobado. Si lo pasas como `MANIFEST_SHA256`, `verify-dist.mjs` siempre pasará la comprobación del manifiesto, aunque haya sido alterado, por lo que no sirve como verificación de integridad. La comprobación real es la de CI, que usa el valor fijado en `ci.yml`.

## `scripts/run-suites.mjs`

Ejecutor de suites con lista explícita y sin dependencias.

```bash
node scripts/run-suites.mjs             # 22 suites Node (NODE_SUITES)
node scripts/run-suites.mjs --browser   # 6 pruebas de navegador (BROWSER_SUITES); requiere CHROME_BIN
```

Cada suite se ejecuta en un proceso aparte, con `cwd` en la raíz y un límite de tiempo por suite:

- **300 s** para 27 de las 28 suites (las 22 de Node y 5 de navegador);
- **600 s** solo para `tests/iroh-brand-ui.mjs`, que recorre la matriz responsive, zoom, letra ampliada e interacción de la bienvenida (alrededor de 5 minutos en local; se han medido entre 249 y 313 s, según la ejecución).

Una suite **falla** si:

- no se puede ejecutar o excede el tiempo;
- termina por señal;
- devuelve un código de salida distinto de 0;
- imprime una línea que empieza por `SKIP` u `OMITIDA` (una omisión no cuenta como éxito).

Además el ejecutor falla globalmente si:

- **Hay un archivo `.cjs`/`.mjs` en `tests/` sin clasificar.** Todo archivo debe figurar en `NODE_SUITES`, `BROWSER_SUITES` o `AUX` (bibliotecas, sondas y herramientas que se importan o se usan a mano). Así una prueba nueva no queda sin ejecutar por olvido.
- **Falta una suite de la lista.**
- **La ejecución modifica el árbol de trabajo.** Se compara `git status --porcelain -uall` y el hash de `git diff --binary` antes y después. Fuera de un repositorio Git esta comprobación se omite y se avisa en el resumen.
- **Con `--browser` no hay `CHROME_BIN` ejecutable.**

Salvaguardas sobre datos de referencia:

- `SIM1_UPDATE` se elimina del entorno, de modo que el ejecutor nunca regenera los goldens de `tests/sim1/`.
- `tests/track-reference/import-tracks.cjs` se invoca con `--check`; sin esa opción reescribiría `tracks.js` y `extra-tracks.js`.
- `HEAD_S08_OUT` apunta a un directorio temporal del sistema, para que las salidas de S08 no ensucien el árbol.

Las pruebas de navegador se lanzan con `--experimental-websocket`.

El código de salida es 0 solo si todas las suites pasan y el árbol no cambió. Al final imprime `N/M suites correctas`.

## Ejecutar todo en local

```bash
node scripts/build-pages.mjs
MANIFEST_SHA256=c8ed94a54a2b926672dee7afde025258f4e335ec999e242d924086aa9e56dda3 node scripts/verify-dist.mjs
node scripts/run-suites.mjs                                              # 22 suites Node
CHROME_BIN=/ruta/a/chrome-o-envoltorio node scripts/run-suites.mjs --browser   # 6 suites de navegador
```

Si cambias el manifiesto, el pin de esta página y el de `ci.yml` deben actualizarse juntos.

Si Chrome local necesita `--no-sandbox`, usa un envoltorio como el del workflow.

## Mantener la lista de suites

- Prueba nueva: añádela a `NODE_SUITES` o `BROWSER_SUITES` (o a `AUX` si no es una suite) en `scripts/run-suites.mjs`; si cambia el recuento, actualiza también los textos «22» y «6» de esta página, de `ci.yml` y del README.
- Cambio del manifiesto de Pages: actualiza `MANIFEST_SHA256` en `ci.yml` (y el pin citado en esta página) en el mismo commit, archiva el manifiesto anterior en `docs/releases/` y justifica el cambio en la revisión.
