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

«Bloquea» describe el comportamiento del job, no la protección de rama: que un check sea obligatorio para fusionar se configura en GitHub, no en este archivo. `browser-tests` es informativo y **no debe exigirse como check obligatorio** hasta que se haya validado en GitHub. Si falla, un paso final emite una anotación `::error` y un resumen en `GITHUB_STEP_SUMMARY` para que el fallo no pase inadvertido.

El job `browser-tests` localiza Chrome del runner y crea un envoltorio (`$RUNNER_TEMP/chrome-nosandbox`) que lo lanza con `--no-sandbox`, porque el runner restringe los user namespaces; lo exporta como `CHROME_BIN`.

### Variable `MANIFEST_SHA256`

Definida a nivel de workflow en `ci.yml`. Es el SHA-256 de `scripts/pages-manifest.json` (candidato aprobado `9c0b492`). `verify-dist.mjs` la exige. Cambiar el manifiesto obliga a cambiar este valor **en el mismo commit**, de modo que la modificación quede visible en la revisión.

## `scripts/build-pages.mjs`

Genera `dist/` (ignorado por Git) a partir de la allowlist de `scripts/pages-manifest.json`. Antes de copiar nada comprueba que hay 43 entradas y que cada origen existe y coincide con su SHA-256; después borra `dist/`, copia los 35 archivos y vuelve a comprobar que no sobra ni falta ninguno y que cada hash es el aprobado. Falla con código 1 y la lista completa de errores.

## `scripts/verify-dist.mjs`

Comprobación **independiente** de `dist/`: no reutiliza código de `build-pages.mjs`, de modo que un error en el build no puede ocultarse a sí mismo. Exige:

1. Que `MANIFEST_SHA256` esté definida y coincida con el SHA-256 real de `scripts/pages-manifest.json`.
2. Exactamente 43 archivos en `dist/`.
3. El conjunto exacto de rutas del manifiesto (sin extras ni faltantes).
4. El SHA-256 de cada archivo.
5. Ninguna ruta bajo `docs/`, `tests/` o `examples/`, ni cuyo nombre contenga «firvi».

Ejecución local (ejemplo):

```bash
node scripts/build-pages.mjs
MANIFEST_SHA256=$(sha256sum scripts/pages-manifest.json | cut -d' ' -f1) node scripts/verify-dist.mjs
```

Esa forma local toma el hash del propio archivo y por tanto **no** detecta un manifiesto modificado; la comprobación real es la de CI, que usa el valor fijado en `ci.yml`.

## `scripts/run-suites.mjs`

Ejecutor de suites con lista explícita y sin dependencias.

```bash
node scripts/run-suites.mjs             # 22 suites Node (NODE_SUITES)
node scripts/run-suites.mjs --browser   # 6 pruebas de navegador (BROWSER_SUITES); requiere CHROME_BIN
```

Cada suite se ejecuta en un proceso aparte, con `cwd` en la raíz y un máximo de 300 s. Una suite **falla** si:

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
MANIFEST_SHA256=cd995db8d9c4ec5fb44941fe10ecab03e9d08a9ae9f0e41db34450c7a27cbe24 node scripts/verify-dist.mjs
node scripts/run-suites.mjs
CHROME_BIN=/ruta/a/chrome-o-envoltorio node scripts/run-suites.mjs --browser
```

Si Chrome local necesita `--no-sandbox`, usa un envoltorio como el del workflow.

## Mantener la lista de suites

- Prueba nueva: añádela a `NODE_SUITES` o `BROWSER_SUITES` (o a `AUX` si no es una suite) en `scripts/run-suites.mjs`; si cambia el recuento, actualiza también los textos «21» y «5» de esta página, de `ci.yml` y del README.
- Cambio del manifiesto de Pages: actualiza `MANIFEST_SHA256` en `ci.yml` en el mismo commit y justifica el cambio en la revisión.
