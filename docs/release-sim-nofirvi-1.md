# SIM-NOFIRVI-1

Registro de la integración que convierte a `main` en la única fuente oficial del simulador publicado. **Estado: integrado en `main` (PR #6) y publicado por Cloudflare Pages desde `main` el 2026-11-16**; el detalle está en «Cierre de la integración y migración de Pages». **Esta página es un registro nuevo; no modifica los registros históricos** (SIM-UI-RELEASE-4, SIM-NNJ, HEAD-CANVAS, SIM-UX-V1).

## Identidad

| Campo | Valor |
|---|---|
| Candidato aprobado | `9c0b4922ffab228d5bf9af75abc51cf94c194264` (rama `deploy/cloudflare-pages`, PR #5) |
| Árbol Git del candidato | `d68a79962b2313a70da5b31713c37c62598b957c` |
| Origen del runtime | los 32 archivos se copiaron **completos** (byte a byte) de ese árbol; no se mezclaron fragmentos |
| `main` anterior | `6f4d6a742f9322cdd40d988f4c51be1ad0a73e49`, preservado en `experiment/measured-geometry-iroh3d` |
| Geometría funcional | ruedas 12 cm, origen del sonar 9,83 cm, HEAD-CANVAS activo |
| Excluido | módulos FIRVI, `iroh-visual.js`, `assets/iroh/`, geometría medida de 10 cm / 7,40 cm |

El candidato no contiene módulos FIRVI. Conserva comentarios y soporte genérico (obstáculos de base poligonal, referencias planas) en `line-geometry.js`, `renderer3d.js`, `scenario-props.js` y `strike-physics.js`; se mantienen sin cambios para que los hashes coincidan con lo validado.

## Artefacto público (35 archivos)

Se genera con `node scripts/build-pages.mjs` en `dist/` (ignorado por Git). La allowlist y los hashes están en `scripts/pages-manifest.json`; el build falla si falta un archivo, si sobra alguno o si un hash no coincide. `404.html` y `_headers` viven en `pages/`.

| Archivo publicado | SHA-256 |
|---|---|
| `404.html` | `36b0462e43e407600f56f4aa5beeb0e2750ebbff25e202992f2306724d74428b` |
| `_headers` | `1d1b1ecc474264b7b9388134c7dedee9029a533af8a72475749a36c9c03f03b5` |
| `assets/bitiro-symbol.png` | `a9dedf6715524e6deb385fd0fe774c6e08f75f035f08ba57022ec867b2811ad4` |
| `assets/fonts/OFL-IBM-Plex.txt` | `d0283623ef57e722fd0eb688a8041589670c608ab780cd3612d06ba6f153d3fd` |
| `assets/fonts/ibm-plex-mono-latin-400-normal.woff2` | `08949f728dc52d528e69b1667d15c89a5686a4ee9a296ff90983985f99c380f7` |
| `assets/fonts/ibm-plex-mono-latin-500-normal.woff2` | `01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22` |
| `assets/fonts/ibm-plex-sans-latin-400-normal.woff2` | `3b646991d30055a93a4ecc499713d4347953a74a947ecab435ab72070cbdab0e` |
| `assets/fonts/ibm-plex-sans-latin-500-normal.woff2` | `0717336fb31fcdcde4b8deb3675bb4a0f7f6d484864afcd6751ac29975962203` |
| `assets/fonts/ibm-plex-sans-latin-600-normal.woff2` | `8960851d691c054ed38e259bdcf1a6190d157b4203ed5bb32c632a863fb8ec2f` |
| `assets/plotters/s01.png` | `7e20eca11207b8e2bbf9696a74b250ee4d6887534f5630bf04de49e969e8b18d` |
| `assets/plotters/s02.png` | `6c7720f1165a2ee4e6d2e49c2dd4e587bf247fbbd36abf33d7ea7ccff2a4ae99` |
| `assets/plotters/s03.png` | `e49cdbea8d73426c1a4be6ff78025394901dffebf4e9e16e070f79cd01cc07c5` |
| `assets/plotters/s04.png` | `12d869f6004678f3bb9099e4cf2e7f6978315274316340b8d1aa5943e16a165f` |
| `assets/plotters/s05.png` | `3e735073efe7ff6653e3ee5daabb96643e0e454aeba88aae5929d2accbb975d1` |
| `assets/plotters/s06.png` | `b6134b0493c92c1fa783f898b874f393223e2e53ab3bdc37e355da312729175b` |
| `assets/plotters/s08.png` | `2d887c21b6147cad57dc3e8945bcb43fa8081e5003c5a23948e0978a0c1600eb` |
| `calibration-mode.js` | `b4516b2fe3d20aea2d13f69e9437f87b5d250642f5ce2d83aa132e2a2a76b4fc` |
| `calibration.js` | `6662fbdfca6549f364cecd6867cb25a6d5b26fad55bf008bea7eb4249b0c496c` |
| `extra-tracks.js` | `3e530b770c223feadc69ce5a9b4cd1ae92c34811c9cbea2c525971916c6d83e7` |
| `head-config.js` | `37053579590ce8f9d61573a4c0f8296f4c8bfed8e8149f75583a405c8e30f702` |
| `head-sonar.js` | `ae4577d63a082eaaaf7888cd0707d9cb6d3ccdc911c4ec6baf9d773c9df0c1b5` |
| `index.html` | `719a435512229206b3c7dd18507296019e9811504cb5c6d34a6a68197468048a` |
| `iroh-runtime.js` | `03a61341cc6f75e0b520d40b96b5b8e3390cc128a81137a76dc5082879719da3` |
| `line-geometry.js` | `dec09c63fea36d176523f1670457eed68fc4e8b450070ba7e8d8e49e45d6ff79` |
| `renderer3d.js` | `2c7934a209311cf8b4b45d32635eb93976da0513eaca98a0e447ec6675007f76` |
| `scenario-editor.js` | `28e3c91671ea389d78f1acad6db1cd7d6bd65b1fb6c301d22a1bbffc1c44c210` |
| `scenario-props.js` | `6803df0f42fafe1ce15186f040c0e607e3f675a3b080bc9fe00b434f84aee231` |
| `simulator.js` | `f0a68a59b47e8a3836445aced66754183df420dbd8202b4b390153638a1d28af` |
| `starters.js` | `c50ea71bf92d5e00868cd26d97bff08addcadfe451dc0b555cb51c6a237100c4` |
| `strike-physics.js` | `f17522c353ed1fa37f57a5fd7a03800e91b596ecc7f11920d314dcbf34df9687` |
| `styles.css` | `d80ddd1f64019c07c60d55572433647a499cd932e1df4a84e1c08556ad1784e6` |
| `syntax-highlight.js` | `111c82af42f4a4683cb9bf3986713f1fad55292f77ecc8f40ac940489e5ec825` |
| `tokens.css` | `da6a5a10c0e9d0966f3e7b8a60c54a7b1608549a72983ccadea9b67771303eea` |
| `tracks.js` | `fbdae9bda13e4081f2f244aa82999c1078c8fc00f3ea4d30b7caea082e03de6b` |
| `ui-shell.js` | `0e434c0643a558336f4805161b822e565c6540ba4ecad420d691b73b30ea5900` |

## Qué no se publica

`docs/`, `tests/`, `tools/`, `examples/`, `scripts/`, `pages/`, `README.md`, `LEEME.md`, `INICIO-RAPIDO.txt`, `.gitignore` ni activos experimentales.

## Pruebas: conservadas y retiradas

Las suites del runtime oficial se tomaron de `e34712d` (la línea HEAD-CANVAS anterior al retiro de FIRVI); los goldens son los de `e34712d`, sin regenerar. El inventario distingue qué se retiró respecto del `main` anterior (`6f4d6a7`) y qué solo existía en ramas históricas.

**A. Retiradas respecto de `main` (`6f4d6a7`)** — pertenecían al experimento y siguen en `experiment/measured-geometry-iroh3d`:

`tests/physical-geometry.cjs`, `tests/iroh-visual.cjs`, `tests/iroh-visual-ui.mjs`, `tests/perf/iroh-ab-node.cjs`, `tests/perf/iroh-ab.mjs`, `tests/perf/iroh-render-svg.cjs`, `tests/perf/iroh-world.cjs` (y `tools/build-iroh-render-asset.mjs`). Además, 8 goldens y varias suites de `main` se sustituyeron por las versiones de `e34712d`, calculadas con el runtime oficial.

**B. Nunca estuvieron en `main`** — solo existían en la línea histórica (`e34712d`, `feature/head-canvas`, `release/sim-ux-v1`) y no se incorporaron:

- FIRVI: `firvi-2025{,-ui}`, `firvi-competition{,-ui}`, `firvi-integral{,-ui}`, `firvi-scoring{,-ui}`, `firvi-ui-final`, `firvi-2025/`, `head-firvi-compat`, `integration/`, `pending/`.
- No FIRVI, pero dependientes de bases históricas o de entorno: `ux-engine-unchanged.cjs` (compara contra `b06052b`, que incluye FIRVI), `compare-head-canvas.cjs` (requiere un árbol externo) y `contact-messages-ui.mjs` (capturas contra `b06052b`; requiere un Chromium de Playwright).

**C. Añadidas respecto de `main`** (cubren HEAD-CANVAS y avisos de contacto): `head-sonar.cjs`, `head-ui.mjs`, `head-compat-ui.mjs`, `contact-messages.cjs`, `head/` (matriz y arranque real de S08) y `examples/`.

Resultados de la verificación en el informe de la Pull Request.

## Cierre de la integración y migración de Pages

Registro posterior a la fusión. Los datos de esta sección proceden de GitHub (PR, run de CI, ruleset) y de las comprobaciones HTTPS y locales descritas más abajo; los valores del panel de Cloudflare (ajustes del proyecto, log de build) fueron confirmados en el panel por el responsable del proyecto y no pueden comprobarse desde este repositorio.

| Campo | Valor |
|---|---|
| Fecha | 2026-11-16 |
| Pull Request | #6 (`integration/main-sim-nofirvi` → `main`), fusionado con **Merge Commit**; conserva los 8 commits de la rama (`1384e75` … `6ba57f3`) |
| Merge commit en `main` | `3c80a3370d2dfda23ed23f90a464ccaaeaacb120` (padres `6f4d6a7` y `6ba57f3`) |
| CI del merge | run `43794749100` (`ci`, evento `push`): success; checks `pages-build`, `node-tests` y `browser-tests` en success |
| Protección de `main` | ruleset `protect-main` (27346085), `active`: `deletion`, `non_fast_forward`, `pull_request` y `required_status_checks` (`pages-build` y `node-tests`, política estricta); sin bypass actors. Es una protección de GitHub independiente de los ajustes de Cloudflare |
| Deployment activo | `449a5877-ad96-4598-a493-22cfd205eb57` (rama `main`, commit `3c80a33`, estado success) |
| Deployment de respaldo (rollback) | `47b60699-bb45-4ea1-b1f6-852d87e8f3da` (commit `9c0b4922ffab228d5bf9af75abc51cf94c194264`, rama `deploy/cloudflare-pages`) |
| Rama de respaldo | `deploy/cloudflare-pages` permanece en `9c0b4922ffab228d5bf9af75abc51cf94c194264`, sin tocar |
| Manifiesto | `scripts/pages-manifest.json` sin cambios: SHA-256 `cd995db8d9c4ec5fb44941fe10ecab03e9d08a9ae9f0e41db34450c7a27cbe24` (igual que `MANIFEST_SHA256` de `ci.yml`); `approvedCommit` y `approvedTree` históricos intactos |

### Configuración de Cloudflare Pages tras la migración

Producción desde `main`; build command `node scripts/build-pages.mjs`; build output `dist`; root directory vacío; build system v3; `Enable automatic production branch deployments`: Enabled; `Preview branch`: None; Deploy Hooks: ninguno. Detalle en [`deployment-and-rollback.md`](deployment-and-rollback.md).

### Resultados de las pruebas

| Prueba | Resultado |
|---|---|
| Log de build de Cloudflare | confirma la ejecución de `node scripts/build-pages.mjs` y la verificación de 35 archivos (confirmado por el responsable en el panel) |
| Reproducibilidad con Node 22.23.4 y Node 24.22.1 | ambos producen los mismos 35 archivos |
| HTTPS en `https://simulador.nulljinx.com` (script de `deployment-and-rollback.md`) | **33/33** archivos con el SHA-256 del manifiesto; ruta inexistente → **404** con el SHA-256 de `404.html`; presentes `Content-Security-Policy`, `X-Content-Type-Options` y `Strict-Transport-Security` |
| Redirecciones y dominio | `/` responde 200; `http://` → 308 a `https://`; `/index.html` → 308 a `/`; `bitiro-simulador.pages.dev` → 302 a `simulador.nulljinx.com`; `/_headers` → 404 |
| Regresión funcional | sin regresión evidente en una inspección por HTTPS (la página se sirve con los hashes aprobados). **No** se repitió una evaluación curricular ni una prueba interactiva en navegador sobre este despliegue |

Limitaciones: el rollback al deployment `47b60699` queda registrado como **disponible pero no ejecutado**; solo se registra que ese deployment está identificado como destino. No se ha probado la validez actual de ese deployment desde fuera del panel (su URL de deployment está protegida por Access).

## Excepción heredada de producción: `renderer3d.js` línea 280

`renderer3d.js` termina con un retorno de carro (`\r`) en una línea vacía final, idéntico en el commit de producción `9c0b492`. `git diff --check` lo reporta como «trailing whitespace» únicamente en `renderer3d.js:280`. No es un cambio funcional y **no se corrige**: hacerlo cambiaría el SHA-256 y el blob Git del candidato aprobado. La comprobación complementaria `git -c core.whitespace=cr-at-eol,-blank-at-eof diff --check` no reporta nada, y mantiene activa la detección de espacios finales reales.
