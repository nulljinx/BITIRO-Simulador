# Versionado y releases

> **Estado:** política documental para adoptar mediante Pull Request a `main`. Su integración registra la aprobación del procedimiento; no activa automáticamente protecciones, CI, ramas ni etiquetas. Esos controles requieren actuaciones separadas y autorización explícita.

## 1. Principio rector

**Producción no es HEAD de `main`.** El simulador público puede publicarse selectivamente; su identidad requiere los SHA-256 de los archivos cambiados, el commit fuente y la identidad de la release base de la que proceden los archivos no modificados. No basta con el estado de una rama.

Tres conceptos distintos, siempre nombrados por separado:

| Concepto | Qué responde | Dónde se registra |
|---|---|---|
| **Versión de producto** | «¿Qué versión del producto es esta?» | Tag semántico `vX.Y.Z` / `vX.Y.Z-rc.N` |
| **Desarrollo** | «¿Qué hay integrado y en curso?» | Rama `main` (y `feature/*`) |
| **Despliegue** | «¿Qué bytes sirve producción hoy?» | Tag de despliegue + manifiesto SHA-256 + documento `docs/release-*.md` |

## 2. Ramas

| Patrón | Uso | Reglas |
|---|---|---|
| `main` | Integración de desarrollo. Rama predeterminada. | Solo entra por Pull Request. No se reescribe su historia. No equivale a producción. |
| `feature/*` | Una funcionalidad en desarrollo (p. ej. `feature/head-canvas`). | Se parte de `main` por defecto; si procede de una release, como `feature/head-canvas`, se documentan origen y divergencia. Se integra por PR con reconciliación o queda como línea explícita. |
| `release/*` | Rama de trazabilidad de una publicación (p. ej. `release/sim-nnj-101d19f`). | El snapshot inmutable lo fijan el **tag** y los SHA-256; la rama puede avanzar solo por documentación/pruebas relacionadas, sin alterar los archivos publicados. No se reabre para funcionalidades. |
| `docs/*` | Cambios exclusivamente documentales. | Se parte de `main`; PR sin cambios funcionales. |
| `backup/*` | Respaldos manuales puntuales. | Provisionales: se archivan con tag o se eliminan tras aprobación explícita. |

## 3. Etiquetas

### 3.1 Versiones de producto: `vX.Y.Z` y `vX.Y.Z-rc.N`

- Anotadas (`git tag -a`), con asunto `vX.Y.Z - <resumen>`.
- Se aplican sobre un commit de `main` (o de la línea que se declare como fuente del producto).
- Incrementar la versión es una **decisión humana explícita**; el cambio de un número nunca se infiere de un despliegue.
- Estado actual: `v0.1.0` … `v0.8.0`, `v0.9.0-rc.1` (todas anotadas, 2026-10-08). Sin GitHub Releases.

### 3.2 Etiquetas de despliegue: `sim-<nombre>-<id>-deployed`

- Registran **qué se publicó y cuándo**, no una versión de producto.
- Anotadas; el mensaje incluye la fecha y el método de verificación (p. ej. «HTTPS-verified»).
- Apuntan al commit que contiene el documento de identidad de la release (`docs/release-*.md`) y los archivos publicados.
- El documento `docs/release-<nombre>.md` debe incluir: fecha, archivos modificados, sus **SHA-256**, commit fuente, **release base y procedencia de archivos heredados**; respaldo previo, verificaciones locales/HTTPS, comprobaciones pendientes y límites. Si se pretende reconstruir la publicación íntegra, conservar también el inventario y hashes del runtime resultante.
- Ejemplos existentes: `sim-ui-release-4-deployed` → `1a555ea`; `sim-nnj-101d19f-deployed` → `93396ba`.

### 3.3 Reglas

- Un tag publicado no se mueve ni se elimina. Un error se corrige con un tag nuevo y una nota en el documento de release.
- Un tag de despliegue no reutiliza ni sugiere un número semántico.
- Un tag semántico no se infiere de un tag de despliegue ni al revés.

## 4. Regla de no equiparar producción con `main`

1. Ningún README, guía o documento afirma «producción = `main`» ni deduce lo publicado de HEAD de `main`.
2. El estado de producción se documenta en `docs/release-<nombre>.md` y se resume en `README.md` y `docs/current-baseline.md`.
3. Si `main` contiene algo que producción no tiene (o al revés), el README lo declara en una tabla comparativa (ver «Producción vs. main»).
4. Un despliegue **selectivo** se identifica por el manifiesto de archivos modificados **más** la identidad de la release anterior y el inventario de archivos heredados. Los seis hashes de HEAD-CANVAS, por sí solos, no describen cada byte del sitio público.

## 5. Procedimiento de release (despliegue)

1. **Congelar** el commit fuente `S` (que contiene las versiones exactas de todos los archivos a publicar, aunque incluya otros archivos que no se despliegan).
2. **Pruebas** (sección 7) sobre `S`; adjuntar el resultado.
3. **Generar el manifiesto** `sha256  archivo` de los archivos modificados (`git show S:<archivo> | sha256sum`); indicar la release base y, cuando sea posible, conservar el inventario completo del sitio resultante.
4. **Respaldo** del estado actual del servidor; anotar su ruta.
5. **Aprobación** explícita de la persona responsable (sección 8).
6. **Despliegue** (fuera del alcance de este repositorio).
7. **Verificación HTTPS** de los archivos publicados contra el manifiesto, en escritorio y móvil.
8. **Registro:** commit de documentación (`docs/release-<nombre>.md`, `docs/current-baseline.md`, README), rama `release/<nombre>` y tag de despliegue anotado.
9. **Integración documental** hacia `main` mediante PR (solo documentación, nunca el código de la release si no ha sido reconciliado).

## 6. Rollback

- Cada despliegue conserva un respaldo previo con ruta registrada en el documento de release.
- Rollback = restaurar ese respaldo y verificar contra el manifiesto de la release anterior (`docs/release-<anterior>.md`).
- El rollback también se documenta: nuevo registro de despliegue (tag nuevo), sin editar los anteriores.
- Una release anterior solo es restaurable si su manifiesto y respaldo existen; por eso cada release los registra.

## 7. Verificación y pruebas

Antes de aprobar un merge o una release:

- Suites Node `tests/*.cjs` verdes. Los goldens **no** se regeneran automáticamente: un cambio de goldens requiere revisión explícita del cambio de comportamiento.
- Pruebas de navegador (`tests/*.mjs`, Chrome por CDP) relevantes al cambio. Dependen de tiempo real; ante un fallo intermitente se repite y se documenta.
- Para despliegues selectivos: comprobar que el orden de carga y el caché no rompen la combinación `archivos nuevos + archivos anteriores` (p. ej. `tests/head-compat-ui.mjs`).
- Verificación posterior al despliegue contra el manifiesto, con 0 errores de consola.
- Se registra qué **no** se comprobó (hardware real, servidor).

## 8. Aprobación de merges y releases

| Acción | Quién aprueba | Condiciones |
|---|---|---|
| Merge a `main` | Responsable del proyecto | PR con pruebas aprobadas; sin cambios de goldens sin revisión; descripción de qué cambia en producción (nada, por defecto). |
| Merge entre líneas divergentes | Responsable del proyecto | Plan de reconciliación aprobado previamente; **nunca automático**. |
| Despliegue | Responsable del proyecto | Manifiesto, respaldo y pruebas registradas. |
| Tag semántico | Responsable del proyecto | Decisión explícita del número y del commit. |
| Tag de despliegue | Quien despliega | Tras verificación HTTPS. |
| Borrado de ramas/tags | Responsable del proyecto | Lista revisada; las ramas con commits únicos se archivan con tag antes. |

## 9. Política mínima propuesta para `main`

Pendiente de aprobación; **no aplicada**.

- Cambios solo mediante Pull Request.
- Pruebas aprobadas antes de integrar (inicialmente manual, registradas en el PR; automatizables con CI cuando se apruebe).
- Sin force-push ni borrado de `main`.
- Revisión obligatoria: decisión pendiente (el proyecto parece tener un único responsable; exigirla podría bloquearlo).

## 10. Licencia

El repositorio **no declara licencia de software propia**. Se mantiene como decisión pendiente del responsable; este documento no agrega una.

## 11. Estado inicial de versiones

| Referencia | Tipo | Apunta a | Nota |
|---|---|---|---|
| `v0.1.0` … `v0.8.0` | producto | commits de `main` | histórico |
| `v0.9.0-rc.1` | producto (RC) | `8062379` | ancestro de `main`; **no coincide con producción** |
| `sim-ui-release-4-deployed` | despliegue | `1a555ea` | histórico, sustituida |
| `sim-nnj-101d19f-deployed` | despliegue | `93396ba` | base de HEAD-CANVAS; sustituida |
| (sin tag) HEAD-CANVAS | despliegue | `feature/head-canvas` | **producción actual** (2026-10-12) |

## 12. Evaluación futura (no ejecutada)

- **`release/sim-head-canvas`:** crear desde el commit fuente de producción, igual que `release/sim-nnj-101d19f`, para fijar la historia de HEAD-CANVAS independientemente de la vida de `feature/head-canvas`. Candidato: `563aa92` (contiene el documento de identidad y las pruebas; los seis archivos coinciden con el manifiesto, comprobado localmente). Alternativa: `c56799b` (referencia citada en el documento). Decisión pendiente.
- **`sim-head-canvas-20261012-deployed`:** tag de despliegue anotado sobre el commit fuente elegido, con mensaje que cite la verificación HTTPS comunicada y el manifiesto del documento de release. Se crearía solo tras aprobar el commit fuente.
- **Versión semántica:** no se asigna aquí. Producción (HEAD-CANVAS) no contiene el contenido de `v0.9.0-rc.1` (geometría medida, modelo IROH 3D), así que etiquetarla con un número cercano a `v0.9.0-rc.N` sería engañoso; decidirlo requiere resolver primero cómo se reconcilian las dos líneas.
