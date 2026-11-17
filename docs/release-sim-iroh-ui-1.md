# SIM-IROH-UI-1

> **Estado: PREPARADA. NO está integrada en `main` y NO está desplegada.** Este registro describe lo que contiene la rama de trabajo y lo que falta; los datos de despliegue se añadirán cuando ocurra, en un registro nuevo (política de `versioning-and-releases.md`: los registros anteriores no se editan).
> **No afirma alianza, patrocinio ni aprobación oficial de Fundación Mustakis.** El responsable del proyecto **confirmó expresamente** contar con su autorización para usar su identidad, con el alcance público descrito en [`identidad-iroh-simulator.md`](identidad-iroh-simulator.md) (sitio `simulador.nulljinx.com`, repositorio público de GitHub, derivados, y la exposición y descarga propias de ese alojamiento, incluidos clones y forks); este repositorio no incluye el documento de autorización. **La confirmación no equivale a una licencia general de reutilización.**

## Identidad

| Campo | Valor |
|---|---|
| Release | `SIM-IROH-UI-1` — identidad visual «IROH Simulator» (cabecera, «Acerca de», bienvenida de primera visita, renombrado de textos visibles) |
| Base | `main` = `5ffcc1568d3d9a16f831d49fa8d328b142b83d22` (contiene SIM-NOFIRVI-1; la diferencia con `3c80a33` son 5 documentos) |
| Release base | SIM-NOFIRVI-1 — su registro `release-sim-nofirvi-1.md` y su manifiesto **no se modifican** |
| Manifiesto de la base (archivado) | [`releases/sim-nofirvi-1.pages-manifest.json`](releases/sim-nofirvi-1.pages-manifest.json) · SHA-256 `cd995db8d9c4ec5fb44941fe10ecab03e9d08a9ae9f0e41db34450c7a27cbe24` (igual que `MANIFEST_SHA256` de la base) |
| Rama de trabajo | `feature/sim-iroh-ui-1` (local, sin upstream; nada publicado) |
| Commit de las fuentes (`approvedCommit`) | `acb2679497ce6ed2851fcc814270edfd41764146` — último commit que tocó alguna de las 43 fuentes; `approvedTree` = `e453fd53cc13e79677dcfdd9c35241a3cefb6f11` |
| SHA-256 del manifiesto (`MANIFEST_SHA256` en `ci.yml`) | `25a4d96e4950feb2695f92b488393326be4e0203bc94bda59540035599326f82` |

### Commits de la rama (sobre la base)
| Commit | SHA | Contenido |
|---|---|---|
| C1 | `1521ed557fea61ade515b918fc72b2ba6eb6f0a7` | manifiesto archivado de SIM-NOFIRVI-1 + siembra de la bienvenida en las pruebas de navegador |
| C2 | `53a82eabb3a4645663741893d6041ee941e29dd3` | encabezado «IROH Simulator» del código inicial con compatibilidad del anterior |
| C3 | `1421335f921b6bf04f571dee6cc5d0ceef5a121f` | 7 recursos gráficos (mascota ×3, isotipo, favicons ×3) |
| C4 | `4faad9e641389e97313b5a17a0203dd71004e1b8` | interfaz: cabecera, «Acerca de», bienvenida, pruebas |
| C4a | `acb2679497ce6ed2851fcc814270edfd41764146` | retira el texto de prototipo de «Acerca de» (**último commit que tocó una fuente pública**) |
| C5 | *(este documento)* | manifiesto de 43 archivos, verificaciones de build, pin de CI y documentación; su SHA no puede figurar aquí |

## Artefacto público (43 archivos)

**31 heredados idénticos** de SIM-NOFIRVI-1 (mismo SHA-256 que el manifiesto archivado), **3 modificados**, **9 nuevos** y **1 retirado** del inventario.

### Modificados
| Archivo | SHA-256 | Bytes | Cambio |
|---|---|---:|---|
| `404.html` | `8ea59ac15e8d2c545137865cb765607d8564dd476ac5d0397ef6d6fa5384b8b5` | 323 | título |
| `index.html` | `afa7c920a41c16b663ca2cac042bc6da3bd4fd92149a5512e547697ab0c5dd9d` | 64,136 | título, favicon, cabecera (marca + «Bienvenida» + «Acerca de»), rótulos de escena, diálogos «Acerca de» y de bienvenida, enlaces a `iroh-brand.css`/`.js` |
| `starters.js` | `67f39142fbf8b13d2bf32f349f24ffe0ac996f779edee6aa6877c508e72431f0` | 6,193 | encabezado del código inicial nuevo + `legacyStarter`/`isLegacyStarter`; `isModified` reconoce el starter anterior |

### Nuevos
| Archivo | SHA-256 | Bytes | Nota |
|---|---|---:|---|
| `assets/iroh-favicon-180.png` | `b4f97f8fe2be73146ea0556ee1b904caf622470b91d69789b01253f95165fb9b` | 13,420 | recorte de la cabeza de la mascota; sin inscripción |
| `assets/iroh-favicon-192.png` | `1e4f04e2dad997bd370f9c15c2d3ebd5a7cd73c3a6d22265554a7bb99ab122be` | 14,903 | recorte de la cabeza de la mascota; sin inscripción |
| `assets/iroh-favicon-32.png` | `264e7f4a545f3d5a8c38c41409edb16b90a4c8583577c6f3eba63c8779917659` | 1,901 | recorte de la cabeza de la mascota; sin inscripción |
| `assets/iroh-isotipo-68.webp` | `3973d106b2e6c06c3fd1a7c6698c3719f79e04a37694a205a586475d36faa084` | 2,688 | recorte de la cabeza de la mascota; sin inscripción |
| `assets/iroh-mascot-420.webp` | `2cf56c9e99023c579e9b8e4d336a1da1a3934cce62eb7b50d944dd0ea9081f76` | 34,630 | contiene la inscripción de Fundación Mustakis; uso público confirmado por el responsable (alcance en `identidad-iroh-simulator.md`) |
| `assets/iroh-mascot-640.webp` | `c3898058e6a215811538b215bb5ec3dd47e0889b32a9b3f99236c4dc572b78ac` | 58,452 | contiene la inscripción de Fundación Mustakis; uso público confirmado por el responsable (alcance en `identidad-iroh-simulator.md`) |
| `assets/iroh-mascot-960.webp` | `77c4e781bf1db555f7564cff2171fff17fe3bc2f67f3ed8e1992bcb9067ee838` | 96,560 | contiene la inscripción de Fundación Mustakis; uso público confirmado por el responsable (alcance en `identidad-iroh-simulator.md`) |
| `iroh-brand.css` | `a16cbbef05d53275f276de087dd45ab4f4897929672cd6314f50aeb8ce948232` | 13,392 | |
| `iroh-brand.js` | `50f661a26b0188ad3a1de77458146cf8ede2dc5b6b050cea809a7a1801440e33` | 4,266 | |

### Retirado del artefacto
`assets/bitiro-symbol.png` (hash `a9dedf6715524e6deb385fd0fe774c6e08f75f035f08ba57022ec867b2811ad4`). El archivo **permanece en el repositorio**; los registros históricos lo siguen citando.

### Heredados idénticos (31)
Runtime completo (`simulator.js`, `ui-shell.js`, `iroh-runtime.js`, `renderer3d.js`, `calibration*.js`, `scenario-*.js`, `tracks.js`, `extra-tracks.js`, `line-geometry.js`, `strike-physics.js`, `head-*.js`, `syntax-highlight.js`), `styles.css`, `tokens.css`, `_headers`, fuentes IBM Plex y plotters: **byte a byte iguales** a SIM-NOFIRVI-1 (lo comprueba `tests/iroh-brand.cjs`).

## Qué no cambia
Física, sensores, calibración, programación, editor, pistas y persistencia del código, del escenario y de la calibración. La interfaz del simulador conserva su disposición, sus colores y sus paneles claros/oscuros.

## Compatibilidad de datos guardados
- Solo se añade la clave `bitiro:standalone:welcome:v1`. Las claves `bitiro:standalone:code:*`, `bitiro:standalone:scenario:v1:*` y `bitiro:line-calibration:v1` no cambian.
- Código guardado: se conserva carácter por carácter (incluido un starter con el encabezado «// BITIRO Simulador · …», que sigue reconociéndose como no modificado). Ver [`identidad-iroh-simulator.md`](identidad-iroh-simulator.md).
- Ir y volver entre SIM-NOFIRVI-1 y esta release no pierde ni altera datos; la versión anterior ignora la clave nueva.

## Pruebas (ejecutadas sobre el estado exacto del commit, exportado del índice)
| Comprobación | Resultado |
|---|---|
| Suites Node (`node scripts/run-suites.mjs`) | **22/22** (la base daba 21/21; se suma `tests/iroh-brand.cjs`) |
| Pruebas de navegador (`--browser`, Chromium 1248, `CHROME_BIN`) | **6/6** sin SKIP (la base daba 5/5). `tests/iroh-brand-ui.mjs`: **47/47** comprobaciones |
| `node scripts/build-pages.mjs` | **43 archivos** verificados contra SIM-IROH-UI-1 (`acb2679`) |
| `node scripts/verify-dist.mjs` (con `MANIFEST_SHA256` de `ci.yml`) | **43 archivos**, rutas y SHA-256 exactos, sin rutas no autorizadas; `dist/`: 0 extra, 0 faltan |
| Controles negativos (la verificación no se debilitó) | pin erróneo → falla; un byte alterado en una fuente → falla; mascota ausente → falla; archivo extra en `dist/` → falla |
| Manifiesto | 31 heredados idénticos + 3 modificados + 9 nuevos; 35 − 1 + 9 = 43. Hashes iguales al contenido commiteado en `acb2679`; `approvedCommit` = último commit que tocó una fuente; `approvedTree` = árbol de ese commit; sin referencias circulares ni valores ficticios; `MANIFEST_SHA256` de `ci.yml` = SHA-256 del manifiesto |
| Datos del estudiante | 91 comprobaciones deterministas y 24 000 aleatorias del código inicial (nuevo, antiguo y propio, con diferencias de un carácter), sin diferencias; código propio idéntico tras recargar; claves `bitiro:*` originales intactas; 10 pistas (S01–S08, Óvalo y Ocho) operativas |
| Runtime | `simulator.js`, `ui-shell.js`, `styles.css`, `tokens.css` y el resto del runtime: iguales a SIM-NOFIRVI-1 |
| CSP, consola y accesibilidad | cabeceras reales de `pages/_headers`; 0 violaciones de CSP y 0 errores de consola; foco, Escape, Tab, `prefers-reduced-motion` y contraste cubiertos por `iroh-brand-ui` |
| Responsive | 11 tamaños de la bienvenida (320×568 a 1440×900, con móvil horizontal), 9 anchos de cabecera y 5 de «Acerca de»; sin desborde |
| Peso (sin comprimir) | visita recurrente: neto **+10,1 KB**; primera visita añade además la mascota (34, 57 o 94 KB según pantalla) |
| Límites | Solo Chromium headless con emulación táctil; contraste calculado sobre estilos; sin lector de pantalla, Safari, Firefox, dispositivos reales, axe, Lighthouse, vista previa ni producción de Cloudflare, ni comprobación HTTPS |

## Bloqueos y pendientes
1. **Alcance de la publicación pública (confirmado por el responsable):** el permiso contempla el sitio `simulador.nulljinx.com`, el repositorio público de GitHub, los derivados (isotipo, favicons y versiones optimizadas) y la exposición y descarga propias de ese alojamiento, incluidos clones y forks; **no** implica una licencia general de reutilización a terceros. Es una declaración del responsable, sin documento en el repositorio. La titularidad de los derechos de la **ilustración generada con ChatGPT** no la resuelve este repositorio y debe documentarla el responsable. Los assets no se publican bajo licencia abierta.
2. Cualquier cambio posterior en una de las 43 fuentes obliga a regenerar el manifiesto, `MANIFEST_SHA256` y este registro (el CI y `scripts/build-pages.mjs` lo exigen).
3. Verificaciones **no** realizadas: lector de pantalla real, Safari/iOS, Firefox, dispositivos físicos, axe, Lighthouse, vista previa o producción de Cloudflare, comprobación HTTPS.
4. Medir con `tests/perf/sim-low-end.mjs` antes y después en la máquina de referencia si se quiere declarar «sin regresión de rendimiento».

## Despliegue y rollback
Procedimiento en [`deployment-and-rollback.md`](deployment-and-rollback.md) («Rollback de SIM-IROH-UI-1»). El destino de rollback es el deployment de producción **activo justo antes del merge**, comprobado en el panel de Pages; no se asume ninguno de los IDs registrados en documentos anteriores. **Nada de esto se ha ejecutado**; publicar (push, PR, CI, merge y despliegue) requiere autorización explícita en cada paso.
