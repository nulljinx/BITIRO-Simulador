# SIM-IROH-WELCOME-1

> **Estado: preparada en la rama `fix/iroh-welcome-session-responsive`. NO está integrada en `main`, NO tiene Pull Request y NO está desplegada.** Corrige tres problemas de la bienvenida de SIM-IROH-UI-1 detectados en producción. Los registros anteriores (`release-sim-iroh-ui-1.md`, `release-sim-nofirvi-1.md`, …) **no se editan**; los datos de integración y despliegue (PR, merge, despliegue, rollback) se añadirán en un registro nuevo cuando ocurran.

## Identidad

| Campo | Valor |
|---|---|
| Release | `SIM-IROH-WELCOME-1` — bienvenida por sesión de pestaña, sin «Bienvenida» en la cabecera, composición responsive |
| Base (producción vigente) | `5f21d2fcb6fab3bc379190fa040904db2ed52d47` (merge del PR #8, contiene SIM-IROH-UI-1) |
| Rama de trabajo | `fix/iroh-welcome-session-responsive` |
| Commit funcional (`approvedCommit`) | `6b86a96eff17a513dd0d7bda55313dc882dd890f` — `fix(ui): make IROH welcome responsive and session-scoped` (último commit que toca una fuente pública) |
| `approvedTree` | `3e58a54acf7da83ec21d6cd6216d9b0c6712e43e` (árbol Git del commit funcional) |
| Manifiesto de la base | `docs/releases/sim-iroh-ui-1.pages-manifest.json` · 43 archivos · `approvedCommit` `acb2679497ce6ed2851fcc814270edfd41764146` · `approvedTree` `e453fd53cc13e79677dcfdd9c35241a3cefb6f11` · SHA-256 `25a4d96e4950feb2695f92b488393326be4e0203bc94bda59540035599326f82` |
| Manifiesto de esta release | `scripts/pages-manifest.json` · 43 archivos · SHA-256 `81ea7df53abbdfa54cdbb6ea464bb82e0662b6bcc2db07258f996a8c0c2e8ebd` (es el valor de `MANIFEST_SHA256` en `.github/workflows/ci.yml`) |

El manifiesto no contiene su propio hash: el pin vive solo en `ci.yml`, y `baseManifestSha256` apunta al archivo histórico, que no referencia a este. No hay referencias circulares.

## Qué cambia

1. **Cabecera:** se elimina el botón `#welcomeReopen` («Bienvenida») del HTML (no solo se oculta), con sus estilos y su listener. Queda «Acerca de». La bienvenida se reabre desde **«Acerca de» → «Ver la bienvenida»**.
2. **Persistencia:** la bienvenida se recuerda en `sessionStorage` (clave `bitiro:standalone:welcome:session:v1`), es decir, **por pestaña**: pestaña nueva independiente → aparece; «Entrar al simulador» → se cierra; recargar la misma pestaña → no vuelve; cerrar la pestaña y abrir otra → aparece de nuevo.
3. **Responsive** (`iroh-brand.css`): tipografía y mascota escalan con el menor de ancho y alto útiles (`dvh`), la mascota no pasa de ~58 % del alto en dos columnas, el cambio a una columna depende de la proporción del viewport (relación ≤ 1,1 o < 720 px de ancho) y no de un ancho fijo, hay una regla de una columna para ventanas estrechas y bajas a la vez, y «IROH Simulator!» se envuelve en lugar de cortarse si no cabe (letra o zoom al 200 %).

No se modifican runtime, física, sensores, renderizado, starters ni estilos base (`styles.css`, `tokens.css`).

## Datos del navegador

- Las claves de **código, escenario y calibración** (`localStorage`) no se tocan, migran, borran ni renombran.
- El indicador antiguo `bitiro:standalone:welcome:v1` (`localStorage`) **ya no se lee** y **no se borra**: queda como residuo inofensivo en los navegadores que lo tengan. Quien ya había entrado verá la bienvenida **una vez** en su próxima pestaña nueva (cambio de comportamiento intencional).
- Si el almacenamiento está bloqueado, la bienvenida no se abre sola y sigue disponible desde «Acerca de».
- Limitación del navegador: **duplicar una pestaña o restaurar una sesión puede copiar `sessionStorage`** (depende del navegador). En esos casos la bienvenida no reaparece; no se considera una pestaña nueva independiente.

## Archivos del artefacto público que cambian (3 de 43)

| Archivo | SHA-256 | Bytes |
|---|---|---:|
| `index.html` | `e670cb33d1033d8a30435dd32a68beef8326430138695bc94e0d48275ed478b8` | 63,606 |
| `iroh-brand.css` | `f32c7d27da7ede2468c546c2221fe22db836d83d9f088bdcc902397d6d312f31` | 15,019 |
| `iroh-brand.js` | `221053757096409740df3ee29c50ee40f31135c3a48056a0b380ee292fede6fd` | 4,652 |

Los otros 40 archivos conservan el hash de SIM-IROH-UI-1; no se añade ni se retira ninguna ruta pública. Los hashes de runtime y de los assets gráficos protegidos los comprueba `tests/iroh-brand.cjs`.

## Verificación

**Pruebas automatizadas** (Chromium 1248 de Playwright, solo Linux/WSL2):

- 22 suites Node y 6 suites de navegador, sin SKIP.
- `tests/iroh-brand-ui.mjs`: 94 comprobaciones. Incluyen pestaña nueva vs. recarga, indicador antiguo ignorado y conservado, ausencia de «Bienvenida» en la cabecera, conservación del código del alumno, CSP y consola limpias, contraste, foco y teclado.
- De ellas, **54 recorren la geometría de la bienvenida**: 15 viewports (1920×1080 a 320×568, incluidos tres apaisados de móvil), 24 de zoom 125/150/200 % y 15 de tamaño de letra 125/150/200 %. Ninguna prueba cuenta «44 combinaciones»; esa cifra no corresponde a evidencia reproducible.
- `build-pages` y `verify-dist` con el manifiesto nuevo, más controles negativos (pin incorrecto, archivo alterado, ausente y adicional).

**Comparaciones visuales exploratorias** (no son pruebas automatizadas): capturas antes/después (base `5f21d2f` frente a `6b86a96`) en 1920×1080, 1366×768, 1280×720, 1024×768, 820×1180, 390×844, 320×568, 667×375, 812×375, 568×320 y las variantes de zoom y de letra. Se revisaron a ojo; las capturas **no forman parte del repositorio**. Resultados:

- 1920×1080 (y 1920×1080 al 125 %), 320×568 y 320×568 con letra al 125 %: capturas idénticas byte a byte.
- Portátil (1366×768, 1280×720): misma composición; la mascota queda algo más pequeña (~15 % en 1280×720) y el botón sube unos píxeles.
- 320×568 con letra al 200 %: antes el título se cortaba por los lados; ahora se envuelve.
- 1024×768 al 125 %: antes el botón quedaba fuera del viewport; ahora es visible.

## Limitaciones conocidas

- **Zoom emulado:** el zoom 125/150/200 % se simula con un viewport CSS más pequeño; no es el zoom real de un navegador de escritorio. La escala de letra se simula fijando `font-size` en la raíz; no es el ajuste de texto del sistema operativo.
- **Letra grande en móvil:** con letra al 150 % o más en 390×844 y 320×568, el botón «Entrar al simulador» queda **fuera del primer pantallazo** y se alcanza desplazando el diálogo (la prueba exige alcanzabilidad, no visibilidad inmediata). A 320×568 con letra al 200 % queda más abajo que en SIM-IROH-UI-1, porque ya no se recorta el título.
- **Navegadores y dispositivos:** solo se validó Chromium. **No se validó en Safari, Firefox ni en dispositivos físicos.**
- **Pestañas duplicadas o restauradas:** pueden conservar `sessionStorage` según el navegador (ver «Datos del navegador»).
- Quien ya había entrado en SIM-IROH-UI-1 verá la bienvenida una vez más en su próxima pestaña nueva.
