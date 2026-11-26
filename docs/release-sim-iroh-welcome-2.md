# SIM-IROH-WELCOME-2

> **Estado: candidata, preparada en la rama `fix/iroh-welcome-entry`. NO está integrada en `main`, NO tiene Pull Request y NO está publicada.** Los registros anteriores no se editan; los datos de integración, despliegue y rollback se añadirán en un registro nuevo cuando ocurran.

## Identidad

| Campo | Valor |
|---|---|
| Release | `SIM-IROH-WELCOME-2` — entrada explícita desde la bienvenida |
| Base | `SIM-IROH-WELCOME-1`, `main` en `b0b6145b8a8578897209a411985d25dfc786be09` (merge del PR #9) |
| Rama de trabajo | `fix/iroh-welcome-entry` |
| Commit de pruebas | `a0e9408e35f5b81861fc8020d4c3fff4d93dfd4c` — `test(ci): extend welcome browser suite timeout` |
| Commit funcional (`approvedCommit`) | `403e243c8374e5effce0636adfae752644c3a007` — `fix(ui): require explicit entry to IROH Simulator` (último commit que toca una fuente pública) |
| `approvedTree` | `7a9b7033660e227e6b44879fbb31ad2a24c2dcd4` |
| Manifiesto de la base | `docs/releases/sim-iroh-welcome-1.pages-manifest.json` · 43 archivos · `approvedCommit` `6b86a96eff17a513dd0d7bda55313dc882dd890f` · `approvedTree` `3e58a54acf7da83ec21d6cd6216d9b0c6712e43e` · SHA-256 `81ea7df53abbdfa54cdbb6ea464bb82e0662b6bcc2db07258f996a8c0c2e8ebd` |
| Manifiesto de esta release | `scripts/pages-manifest.json` · 43 archivos · SHA-256 `c8ed94a54a2b926672dee7afde025258f4e335ec999e242d924086aa9e56dda3` (es el valor de `MANIFEST_SHA256` en `.github/workflows/ci.yml`) |

El manifiesto no contiene su propio hash: el pin vive en `ci.yml`, y `baseManifestSha256` apunta al archivo histórico, que no referencia a este. No hay referencias circulares.

## Qué cambia

1. **Se elimina del HTML el botón de cierre «X»** (`#welcomeClose`) con su SVG, sus estilos y su listener.
2. **Se elimina la línea inferior** («Tu código se guarda en este navegador. Esc para cerrar.»), con sus estilos.
3. **Entrada explícita:** «Entrar al simulador» es el único control de la interfaz que cierra la bienvenida. Un clic en el fondo, la mascota, el título u otra zona no interactiva no la cierra.
4. **Escape no la cierra:**
   - `closedby="none"` en el `<dialog>` de la bienvenida;
   - el evento `cancel` llama solo a `preventDefault()`;
   - un listener `keydown` anula la tecla Escape **solo mientras `welcome.open`**.
   `cancel` por sí solo no bastaba: en las pruebas con Chromium, un Escape sin interacción previa, o repetido, cerraba el diálogo sin permitir cancelarlo.
5. **Separación del crédito:** el margen superior de «Desarrollado por nulljinx» pasa de 30 a 52 px para compensar la línea retirada.

No cambian el título, la descripción, los tres pasos, la mascota, el fondo, la pista decorativa, las animaciones, los breakpoints ni «Acerca de». No se modifican runtime, física, sensores, calibración, renderizado, pistas, starters ni assets gráficos.

## Comportamiento y datos

- **Persistencia sin cambios:** `sessionStorage`, clave `bitiro:standalone:welcome:session:v1`, por pestaña. No se crea ninguna clave. Se escribe solo al entrar; Escape no la escribe.
- **Datos del estudiante:** código, escenarios y calibración (`localStorage`) no se tocan.
- **Reapertura:** «Acerca de» → «Ver la bienvenida». La bienvenida reabierta **también** exige activar el botón principal; al hacerlo, el foco vuelve a «Acerca de».
- **Accesibilidad:** foco inicial en el botón principal con contorno visible; activación con ratón, toque, Enter y Espacio; navegación con Tab; si no cabe, la bienvenida se desplaza y el botón sigue alcanzable. «Acerca de», el editor y los demás diálogos conservan Escape.
- Sin cambios: `prefers-reduced-motion`, almacenamiento bloqueado (no se abre sola) y navegadores sin `<dialog>` (simulador accesible sin bienvenida).

## Archivos del artefacto público que cambian (3 de 43)

| Archivo | SHA-256 | Bytes |
|---|---|---:|
| `index.html` | `95d35d5c0aba8196efa1b28c47ec83519a89d8ed6d28e50b96830137bc5c470d` | 63,191 |
| `iroh-brand.css` | `8660842613bd3d245efc309b01d07bedc77e9b45fffdbbfa2e789ce6cdbf8566` | 14,371 |
| `iroh-brand.js` | `e36ad6a73afce154fe35d129ccf09f0458a19b29a25cb19aba78202d34e357ea` | 4,977 |

Los otros 40 archivos conservan el hash de SIM-IROH-WELCOME-1; no se añade ni se retira ninguna ruta pública.

## Verificación

**Pruebas automatizadas** (Chromium de Playwright, solo Linux/WSL2):

- 22 suites Node y 6 suites de navegador, sin SKIP.
- `tests/iroh-brand-ui.mjs`: **103 comprobaciones de interfaz**. Cubren ausencia de la X y de la línea, Escape repetido (también sin `closedby`), clics en zonas no interactivas, activación con ratón, toque, Enter y Espacio, foco, reapertura desde «Acerca de», código guardado, CSP y consola.
- De ellas, **54 recorren la geometría de la bienvenida**: 15 viewports, 24 de zoom 125/150/200 % y 15 de letra 125/150/200 %.
- `tests/iroh-brand.cjs` fija los contratos estáticos.
- **Límite de tiempo:** `scripts/run-suites.mjs` concede 600 s solo a `tests/iroh-brand-ui.mjs` (las demás conservan 300 s), porque con las comprobaciones nuevas rondaba o superaba los 300 s.

**23 comparaciones visuales** antes/después (base `b0b6145` frente a las fuentes de `403e243`), no automatizadas y **fuera del repositorio**: 8 viewports (1920×1080 a 320×568 y 667×375), 9 casos de zoom y 6 de letra ampliada.

| Medida sobre los 23 casos | Antes | Después |
|---|---:|---:|
| Sin desbordamiento horizontal | 23 | 23 |
| Botón completo visible sin desplazar | 18 | 19 |
| Sin desplazamiento vertical | 16 | 18 |
| Botón alcanzable | 23 | 23 |

La mascota no se reduce en ningún caso.

## Limitaciones conocidas

- **Solo se validó Chromium.** Safari, Firefox y dispositivos reales están pendientes.
- **El gesto «atrás» de Android no se probó.**
- **La compatibilidad sin `closedby` solo se simuló** en Chrome retirando el atributo.
- **Zoom y tamaño de letra emulados:** viewport CSS reducido y `font-size` en la raíz; no son los ajustes reales del navegador o del sistema.
- **Pestañas duplicadas o restauradas** pueden conservar `sessionStorage`; en ese caso la bienvenida no reaparece.
- **En escenarios extremos hace falta desplazarse** para llegar al botón (5 de las 23 comparaciones conservan desplazamiento vertical).
- La bienvenida reabierta desde «Acerca de» también exige activar el botón principal.
- Anular Escape **no garantiza** impedir todos los mecanismos de cierre del sistema operativo o del navegador (cerrar o recargar la pestaña siguen disponibles, y la bienvenida es una pantalla informativa, no un control de acceso).
- En pantallas estrechas y apaisadas se conserva el margen que antes reservaba sitio a la X.
