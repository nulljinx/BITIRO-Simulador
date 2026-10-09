# Registro de despliegue — SIM-UI-RELEASE-4

| Campo | Valor |
|---|---|
| Fecha | 2026-10-08 (22:28:44 -03) |
| Resultado | `DEPLOY_OK`; el usuario confirmó después que el sitio funciona |
| Webroot | `/var/www/bitiro-simulador` (`https://simulador.nulljinx.com`) |
| Paquete | `release-SIM-UI-RELEASE-4.tar.gz` |
| SHA-256 del paquete | `792cdb0c7bc3caca3c2b4114e23746ed4bf79a3f19905004b86645b1015fedfe` |
| Baseline anterior | `954c37c` (no `84051ce`) |
| Respaldo | `/home/nulljinx/deploy-backups/SIM-UI-DEPLOY-1-20261008-222844` (los 4 archivos previos, `IDENTITY.txt`, `deploy.log`, hashes) |
| Registro en Git | Rama `release/sim-ui-release-4` (base `954c37c`), tag anotado `sim-ui-release-4-deployed`. El commit de runtime de esa rama contiene exactamente los 4 archivos publicados |

## Archivos publicados (solo estos cuatro)

```text
50e44de13ed85f12fc0f0ac3c149962a2f5cf1c101802a5693e348f287431cf0  index.html
394123c49387f251eb0b5da242be572978fcc05adcb89ed6e53280e6d39153fd  simulator.js
023c9cd622b8e212a562c8d75b945cb07404a2d10dd7fd274cfddb4c1394eaf2  styles.css
4d8d6e0e9d8a2bd323b5d3427fa33bcd70cbc7dc3cabdbf18701e149dd7839ae  ui-shell.js
```

El 2026-10-08 se comprobó con `curl` (solo lectura) que los cuatro archivos servidos en `https://simulador.nulljinx.com` tienen exactamente estos hashes.

## Contenido

- Guía de programación (botón «Guía», diálogo modal, 9 tarjetas).
- Marca sin navegación (no es enlace, no recibe foco, sin cursor de puntero).
- Panel «Más datos» eliminado.
- Física conservada de `954c37c`: rampa simétrica 240 %/s y parada dura en `idle`. Sin cambios de sonar, geometría IROH, pistas ni goldens.

## Validación previa (SIM-UI-RELEASE-6, Chrome/Chromium 153.0.8010.12)

22/22 comprobaciones de navegador en 1440 y 390 px (arranque, Guía y foco, logo, ausencia de «Más datos», calibración, ejecutar/pausar/reiniciar, pendientes medidas de aceleración y frenado de 240,0 %/s, 0 errores de consola). `tests/brand-logo-ui.mjs` 9/9 y `tests/calibration-ui.mjs` 13/13. Los logs no forman parte del repositorio.

## Rollback

Restaurar los cuatro archivos desde `files/` del respaldo y verificar con su `*.sha256`. No usar el rollback de `SIM-UI-RELEASE-2` (revertiría el frenado).

## Relación con `main` e integración

`main` es desarrollo más avanzado y **no está desplegado íntegramente** (geometría IROH medida, modelo 3D, nuevo origen del sonar). La rama `release/sim-ui-release-4` (commit `1a555ea`, tag `sim-ui-release-4-deployed`) conserva la versión exacta publicada. En `main` se integró de forma selectiva solo lo que faltaba: la marca sin navegación (`index.html`), su contrato NAV-1 en `tests/ui-contract.cjs`, `tests/brand-logo-ui.mjs` y esta documentación. La Guía y el retiro de «Más datos» ya estaban en `main` (`UI-GUIDE-1`). Ningún commit de `main` es la versión publicada.
