# SIM-UX-V1: identidad de la release y manifiesto del runtime

| Campo | Valor |
|---|---|
| Nombre | **SIM-UX-V1** |
| Producción | https://simulador.nulljinx.com |
| Despliegue real | **2026-11-08 00:01:01 (-03)**, manual, resultado `DESPLEGADO_Y_VERIFICADO` |
| Commit fuente del runtime | `5f427d6ee46113b4af1bda69f2cb3d1780ce32f0` (`fix(ui): clarify obstacle contact and movement feedback`) |
| Release anterior | FIRVI 2025 + HEAD-CANVAS, commit `b06052bcbc4d478d4465f900c7bc10972deea4a8`, publicada el 2026-10-25 |
| Archivos actualizados | solo `index.html` y `simulator.js` |
| Archivos heredados | los otros 28 de los 30 verificados, idénticos a `b06052b` |
| Rama de trazabilidad | `release/sim-ux-v1` |
| Etiqueta de despliegue | `sim-ux-v1-deployed` (anotada) |
| Servidor | Debian 13, hostname `nulljinx`; webroot `/var/www/bitiro-simulador`; nginx en `127.0.0.1:8086` detrás de `cloudflared`/Cloudflare, `Cache-Control: no-cache` |
| Respaldo (versión anterior de los dos archivos) | `/home/nulljinx/deploy-backups/SIM-UX-V1-20261108-000101-78703/` |
| Staging conservado | `/home/nulljinx/deploy-staging/SIM-UX-V1-20261108-000051/` |

**El despliegue fue manual** (copia selectiva por SSH con un script de despliegue guardado fuera del repositorio). **No implicó un push ni una sincronización con GitHub**: esta rama y su documentación se registraron después. Esta rama conserva la historia exacta de producción; **no equivale a `main`**, cuya geometría de desarrollo difiere (ver `docs/versioning-and-releases.md`).

## Archivos actualizados

```text
50599c2d26afde3e553ec6ce034437d0552ef49bbd1b04172faa948ba590b716  index.html
8a5824d38c14e63811a3ceb043b884d9350dfa790acc72ef491e907ae077f5bc  simulator.js
```

Hashes anteriores (`b06052b`):

```text
e4c1e415b402f917b961a4cb7515bce10a9e6ebe08dffd079f07aa3bcefda2a8  index.html
54c591ef98a6f829213f0dba9a884948182fe1bbc5111965102b20a4cf86739c  simulator.js
```

## Contenido del cambio

- Los avisos de contacto de la interfaz se retiran cuando dejan de ser ciertos (un bloqueo o contacto vigente nunca se oculta). El resumen de un desplazamiento indica a cuántos cm de su posición inicial quedó la caja tocada y recuerda comprobar el camino: *mover no es despejar*.
- Tarjeta «Apartar un obstáculo con la garra» en la Guía (tema «Moviendo sus mecanismos»).
- **El motor físico no cambió** (física, geometría, puntuación, contadores y registros). Se comprobó con `tests/ux-engine-unchanged.cjs` contra `b06052b`: 9 escenarios, FIRVI A y B completos con 3500 muestras cada uno, idénticos salvo el texto de `feedback`.
- Informe técnico y evidencia: [`ux-mensajes-colision.md`](ux-mensajes-colision.md).

## Inventario del runtime verificado (30 archivos)

Son los archivos que carga la página al arrancar (referenciados por `index.html`, el CSS y los JS). Los SHA-256 son los servidos por HTTPS el 2026-11-08 y coinciden con `git cat-file blob 5f427d6:<archivo>`. «Procedencia» es el último commit de la línea de producción que modificó el archivo.

| Archivo | SHA-256 | Estado | Procedencia |
|---|---|---|---|
| `assets/bitiro-symbol.png` | `a9dedf6715524e6deb385fd0fe774c6e08f75f035f08ba57022ec867b2811ad4` | heredado | e2e555e chore: import BITIRO simulator v4 baseline |
| `assets/fonts/ibm-plex-mono-latin-400-normal.woff2` | `08949f728dc52d528e69b1667d15c89a5686a4ee9a296ff90983985f99c380f7` | heredado | c80235b feat(ui): PILOT-1 rediseño de interfaz alineado con BITIRO Lab |
| `assets/fonts/ibm-plex-mono-latin-500-normal.woff2` | `01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22` | heredado | c80235b feat(ui): PILOT-1 rediseño de interfaz alineado con BITIRO Lab |
| `assets/fonts/ibm-plex-sans-latin-400-normal.woff2` | `3b646991d30055a93a4ecc499713d4347953a74a947ecab435ab72070cbdab0e` | heredado | c80235b feat(ui): PILOT-1 rediseño de interfaz alineado con BITIRO Lab |
| `assets/fonts/ibm-plex-sans-latin-500-normal.woff2` | `0717336fb31fcdcde4b8deb3675bb4a0f7f6d484864afcd6751ac29975962203` | heredado | c80235b feat(ui): PILOT-1 rediseño de interfaz alineado con BITIRO Lab |
| `assets/fonts/ibm-plex-sans-latin-600-normal.woff2` | `8960851d691c054ed38e259bdcf1a6190d157b4203ed5bb32c632a863fb8ec2f` | heredado | c80235b feat(ui): PILOT-1 rediseño de interfaz alineado con BITIRO Lab |
| `calibration-mode.js` | `b4516b2fe3d20aea2d13f69e9437f87b5d250642f5ce2d83aa132e2a2a76b4fc` | heredado | 84051ce feat: add manual IROH calibration mode |
| `calibration.js` | `6662fbdfca6549f364cecd6867cb25a6d5b26fad55bf008bea7eb4249b0c496c` | heredado | 84051ce feat: add manual IROH calibration mode |
| `extra-tracks.js` | `3e530b770c223feadc69ce5a9b4cd1ae92c34811c9cbea2c525971916c6d83e7` | heredado | 5b6baee feat(sim): align pilot and tracks with official sessions |
| `firvi-2025.js` | `4488dc03a0d26df72fb20e130aedac6ec71d650a1db766a49c742c45227e6e02` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `firvi-competition-ui.js` | `348293b0c50cd4118e2486553de2ee24187a32e475e999f1c7f8e59c5b87a825` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `firvi-competition.js` | `14414e25b67f353b5bda3985fc1ab7f37a20724b87a681ff00ca5388b0cab7f7` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `firvi-scoring-ui.js` | `05bb6955f94707fa0d7964f4c9ba8a73120e3cfbb847a051c34ea1afb3d4945c` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `firvi-scoring.js` | `a7e91c4ce5f4ccd47076f75ecd1670ab59e1f249d5e43f40e814584825f1163f` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `head-config.js` | `37053579590ce8f9d61573a4c0f8296f4c8bfed8e8149f75583a405c8e30f702` | heredado | f0a28ad feat(head): add HEAD_SONAR module (state, motion, beam geometry) and published-geometry config |
| `head-sonar.js` | `ae4577d63a082eaaaf7888cd0707d9cb6d3ccdc911c4ec6baf9d773c9df0c1b5` | heredado | f0a28ad feat(head): add HEAD_SONAR module (state, motion, beam geometry) and published-geometry config |
| `index.html` | `50599c2d26afde3e553ec6ce034437d0552ef49bbd1b04172faa948ba590b716` | **actualizado** | 5f427d6 fix(ui): clarify obstacle contact and movement feedback |
| `iroh-runtime.js` | `3105a2a0eea6cc01fa07e7ee86ccdf691cd6572fa1374129ed734705915358bc` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `line-geometry.js` | `dec09c63fea36d176523f1670457eed68fc4e8b450070ba7e8d8e49e45d6ff79` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `renderer3d.js` | `2c7934a209311cf8b4b45d32635eb93976da0513eaca98a0e447ec6675007f76` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `scenario-editor.js` | `28e3c91671ea389d78f1acad6db1cd7d6bd65b1fb6c301d22a1bbffc1c44c210` | heredado | 43a95f5 feat(sim): add configurable scenario props |
| `scenario-props.js` | `6803df0f42fafe1ce15186f040c0e607e3f675a3b080bc9fe00b434f84aee231` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `simulator.js` | `8a5824d38c14e63811a3ceb043b884d9350dfa790acc72ef491e907ae077f5bc` | **actualizado** | 5f427d6 fix(ui): clarify obstacle contact and movement feedback |
| `starters.js` | `c50ea71bf92d5e00868cd26d97bff08addcadfe451dc0b555cb51c6a237100c4` | heredado | 5b6baee feat(sim): align pilot and tracks with official sessions |
| `strike-physics.js` | `f17522c353ed1fa37f57a5fd7a03800e91b596ecc7f11920d314dcbf34df9687` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `styles.css` | `9a937b858857ef1fac05c875389c30ae71580f1b15074e4c145a2e3b23d7417c` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |
| `syntax-highlight.js` | `111c82af42f4a4683cb9bf3986713f1fad55292f77ecc8f40ac940489e5ec825` | heredado | c419372 feat(ui): align simulator with BITIRO Lab |
| `tokens.css` | `da6a5a10c0e9d0966f3e7b8a60c54a7b1608549a72983ccadea9b67771303eea` | heredado | c419372 feat(ui): align simulator with BITIRO Lab |
| `tracks.js` | `fbdae9bda13e4081f2f244aa82999c1078c8fc00f3ea4d30b7caea082e03de6b` | heredado | 43a95f5 feat(sim): add configurable scenario props |
| `ui-shell.js` | `571a36693b739ac5a5091d195779ce64e432fec2b82ee470f05b4490bafa1fa9` | heredado | b06052b feat(simulator): integrate FIRVI 2025 with HEAD-CANVAS |

Orden de carga: los 21 `<script src>` de `index.html` son idénticos y están en el mismo orden que en `b06052b`.

### Archivos adicionales comprobados después del despliegue

Los siete plotters oficiales no se cargan al arrancar y no formaban parte de la verificación de los 30. El 2026-11-08, después del despliegue, se comprobó por HTTPS (HTTP 200) que coinciden con `5f427d6`:

| Archivo | SHA-256 | Procedencia |
|---|---|---|
| `assets/plotters/s01.png` | `7e20eca11207b8e2bbf9696a74b250ee4d6887534f5630bf04de49e969e8b18d` | e2e555e chore: import BITIRO simulator v4 baseline |
| `assets/plotters/s02.png` | `6c7720f1165a2ee4e6d2e49c2dd4e587bf247fbbd36abf33d7ea7ccff2a4ae99` | e2e555e chore: import BITIRO simulator v4 baseline |
| `assets/plotters/s03.png` | `e49cdbea8d73426c1a4be6ff78025394901dffebf4e9e16e070f79cd01cc07c5` | e2e555e chore: import BITIRO simulator v4 baseline |
| `assets/plotters/s04.png` | `12d869f6004678f3bb9099e4cf2e7f6978315274316340b8d1aa5943e16a165f` | e2e555e chore: import BITIRO simulator v4 baseline |
| `assets/plotters/s05.png` | `3e735073efe7ff6653e3ee5daabb96643e0e454aeba88aae5929d2accbb975d1` | e2e555e chore: import BITIRO simulator v4 baseline |
| `assets/plotters/s06.png` | `b6134b0493c92c1fa783f898b874f393223e2e53ab3bdc37e355da312729175b` | e2e555e chore: import BITIRO simulator v4 baseline |
| `assets/plotters/s08.png` | `2d887c21b6147cad57dc3e8945bcb43fa8081e5003c5a23948e0978a0c1600eb` | e2e555e chore: import BITIRO simulator v4 baseline |

## Pruebas (sobre una copia limpia de `5f427d6`, hechas antes del despliegue)

- **Suites del repositorio:** 35 suites de `tests/*.cjs` y `tests/*.mjs`; 34 pasan en la primera ejecución y `head-ui.mjs` falló una vez (U3, 19/20: 1,5° de diferencia a 2×) mientras corrían otras tres suites en paralelo. Repetida sola, dio 20/20 en el candidato y dos veces 20/20 en la base `b06052b`; se trata como fallo intermitente por carga (tiempo real) y no se investigó más.
- **Motor sin cambios:** `tests/ux-engine-unchanged.cjs` (9 escenarios).
- **Mensajes de contacto:** `tests/contact-messages.cjs` 11/11 y `tests/contact-messages-ui.mjs` (Playwright, S01: 4 casos).
- **FIRVI A y B:** `firvi-2025`, `firvi-competition`, `firvi-scoring`, `firvi-integral` (8 comprobaciones autónomas) y sus pruebas de navegador (`firvi-2025-ui` 15, `firvi-competition-ui` 11, `firvi-scoring-ui`, `firvi-ui-final`, `firvi-integral-ui` 3 rondas).
- **Carga:** a 1440 y 390 px con la CSP de producción: 21 scripts cargados, 0 errores o avisos de consola, 0 respuestas ≥ 400, 0 violaciones de CSP, sin desbordamiento horizontal; pistas S01, FIRVI A y FIRVI B.
- **Navegador:** Chrome for Testing 156.0.8078.4 (Playwright).

## Verificación posterior al despliegue

- Script de despliegue: `DESPLEGADO_Y_VERIFICADO` (disco, modos 644, propietario `nulljinx:nulljinx`, los 28 archivos restantes sin cambios, nginx local).
- **HTTPS público: 30/30 archivos coinciden con `5f427d6`**; solo `index.html` y `simulator.js` difieren de `b06052b`.
- Sobre el sitio real: los cuatro casos de mensajes de contacto de S01 dan los mismos mensajes que antes del despliegue; la tarjeta de la Guía está presente; S01, FIRVI A y FIRVI B cargan y ejecutan un programa de línea sin errores de JS, de consola ni de CSP (1440 y 390 px).

## Respaldo y rollback

Respaldo: `/home/nulljinx/deploy-backups/SIM-UX-V1-20261108-000101-78703/` (`files/` con los dos archivos anteriores, `modes/`, `SHA256SUMS.before`, `STATE`, `deploy.log`). Rollback = restaurar los dos archivos de `files/` con `install -m 644` a un temporal y `mv` atómico, y verificar con `SHA256SUMS.before` (`e4c1e415…` y `54c591ef…`) y por HTTPS contra la release anterior. El script de despliegue incluye `rollback <respaldo>`, que lo hace y comprueba que nginx sirve los hashes restaurados. El rollback automático y manual se probaron en un entorno desechable local, no contra el nginx real.

## Limitaciones conocidas

- Despliegue manual; el script de despliegue vive fuera del repositorio (`~/audits/SIM-UX-V1-DEPLOY/` de la estación de trabajo).
- La sustitución de los dos archivos no es atómica para el conjunto: entre ambos `mv` (≈ 1 s) un navegador puede ver una mezcla; ambas combinaciones son compatibles.
- No se probó en hardware real de aula ni en dispositivos móviles físicos; las comprobaciones de 390 px son de emulación.
- `head-ui.mjs` es sensible a la carga (ver Pruebas).
- La verificación HTTPS no demuestra el estado de la caché de Cloudflare más allá de las respuestas observadas (`no-cache`).
- Los experimentos del programa de referencia FIRVI siguen locales y **no** forman parte de esta release.
- `main` no contiene este runtime: conserva una geometría de desarrollo distinta (base de ruedas 10 cm, sonar 7,40 cm, modelo IROH 3D). La reconciliación de ambas líneas está pendiente y requiere un plan aprobado.
