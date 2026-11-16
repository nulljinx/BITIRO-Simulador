# Deployment y rollback (Cloudflare Pages)

> **Estado (2026-11-16):** la migración a `main` **se ejecutó**. Cloudflare Pages publica desde `main` y el deployment activo es `449a5877-ad96-4598-a493-22cfd205eb57` (commit `3c80a33`). Cada cambio posterior que toque Cloudflare, DNS, WAF o Access requiere autorización explícita. El registro del cierre está en [`release-sim-nofirvi-1.md`](release-sim-nofirvi-1.md).

## Modelo

| Capa | Qué es |
|---|---|
| Fuente | rama `main` |
| Artefacto | `dist/` (35 archivos) producido por `node scripts/build-pages.mjs` |
| Deployment | Cloudflare Pages sirviendo exactamente ese `dist/` |
| Identidad del deployment | los SHA-256 de `scripts/pages-manifest.json`, no un nombre de rama |

Pages **nunca** debe publicar la raíz del repositorio: contiene `docs/`, `tests/`, `examples/` y material no público.

## Configuración actual en Pages

Confirmada en el panel de Cloudflare por el responsable del proyecto tras la migración; este repositorio no puede comprobarla por sí mismo.

| Ajuste | Valor actual |
|---|---|
| Production branch | `main` |
| Build command | `node scripts/build-pages.mjs` |
| Build output directory | `dist` |
| Root directory | vacío |
| Build system | v3 |
| Enable automatic production branch deployments | Enabled |
| Preview branch | None |
| Deploy Hooks | ninguno (el Deploy Hook temporal usado durante la migración fue eliminado) |
| Deployment activo | `449a5877-ad96-4598-a493-22cfd205eb57` (`main`, `3c80a33`) |
| Deployment de respaldo | `47b60699-bb45-4ea1-b1f6-852d87e8f3da` (`deploy/cloudflare-pages`, `9c0b492`) |

- Variables de entorno: ninguna. Sin dependencias (`npm install` no es necesario).
- Se mantienen WAF, Access y la redirección de `pages.dev`; la migración no los modificó. Comprobado desde fuera: `bitiro-simulador.pages.dev` redirige con 302 a `simulador.nulljinx.com` y las URL de deployment (`<id>.bitiro-simulador.pages.dev`) redirigen al login de Cloudflare Access.

### Controles de ramas en Cloudflare Pages

Dos ajustes del proyecto de Pages controlan qué ramas generan deployments:

1. **`Enable automatic production branch deployments`: Enabled.** Cada push a la rama de producción (`main`) genera un deployment de producción.
2. **`Preview branch`: None.** Ninguna otra rama genera deployments de vista previa.

Ambos valores fueron confirmados en el panel por el responsable del proyecto. `deploy/cloudflare-pages` ya no alimenta producción y se conserva intacta en `9c0b492` como respaldo.

### Protección de `main` en GitHub (independiente de Cloudflare)

El ruleset `protect-main` (27346085, `active`, sobre la rama por defecto) es una protección distinta e independiente de los ajustes de Cloudflare. Según la API de GitHub:

- `deletion` y `non_fast_forward`: impiden borrar `main` y reescribir su historial.
- `pull_request`: los cambios entran por Pull Request (método de integración permitido: `merge`; 0 aprobaciones requeridas).
- `required_status_checks`: exige `pages-build` y `node-tests`, con política estricta. `browser-tests` se ejecuta en el CI pero no es un check requerido.
- Sin bypass actors.

## Verificación previa a cada deployment

1. `git status` limpio y el commit a publicar identificado.
2. `node scripts/build-pages.mjs` termina con código 0 (35 archivos verificados).
3. Suites Node y de navegador en verde (`node scripts/run-suites.mjs` y `--browser`; ver [`ci-and-validation.md`](ci-and-validation.md)).
4. Tras publicar: comprobar por HTTPS los hashes y el comportamiento de `404.html` y `_headers` (ver «Comprobación por HTTPS»).

## Rollback

Destino actual de rollback: el deployment `47b60699-bb45-4ea1-b1f6-852d87e8f3da` (commit `9c0b492`). **Este rollback no se ha ejecutado** y no se ha probado su restauración; el procedimiento es el del panel de Pages.

1. En Cloudflare Pages → Deployments, elegir el deployment anterior verificado y `Rollback to this deployment` (no reconstruye; es inmediato).
2. Verificar por HTTPS el deployment restaurado (hashes y comportamiento de `404.html` y `_headers`, ver «Comprobación por HTTPS»).
3. Si el problema es de código, corregir en `main` mediante Pull Request; no editar `dist/` a mano.

Advertencia: el rollback de un deployment no cambia la rama de producción. Con `Enable automatic production branch deployments` activado, un futuro push a `main` puede volver a publicar esa rama y reemplazar el deployment restaurado. Si el rollback debe mantenerse, pausar los despliegues automáticos antes de restaurar la configuración (acción de panel que requiere autorización explícita). Es una consecuencia del modelo de Pages descrita en este documento, no algo comprobado en una prueba real.

Respaldo permanente: el commit `9c0b492` de `deploy/cloudflare-pages` se conserva sin tocar hasta que el ciclo de migración termine y se autorice su archivado.

## Migración desde `deploy/cloudflare-pages` a `main` (histórico: ejecutada el 2026-11-16)

> **Estado:** **ejecutada**. Se conserva el procedimiento tal como se planificó, como referencia histórica y para repetirlo si hiciera falta; los pasos en tiempo futuro describen el plan, no un trabajo pendiente. Se hizo manualmente en el panel; ningún script de este repositorio toca Cloudflare. Resultado y verificación: [`release-sim-nofirvi-1.md`](release-sim-nofirvi-1.md). Nota: durante la migración se usó un Deploy Hook temporal que ya fue eliminado; el procedimiento de abajo no lo contempla.

### Configuración previa a la migración (histórica; comprobada en el panel entonces)

| Ajuste | Valor previo | Valor objetivo |
|---|---|---|
| Production branch | `deploy/cloudflare-pages` | `main` |
| Automatic deployments | Enabled | Enabled (se pausa solo durante la migración) |
| Build command | vacío | `node scripts/build-pages.mjs` |
| Build output directory | vacío | `dist` |
| Root directory | vacío | vacío |

Antes de la migración, Pages servía los archivos de `deploy/cloudflare-pages` tal cual, sin build. La rama contiene el candidato `9c0b492` (el mismo que fija `scripts/pages-manifest.json`).

**Riesgo principal:** el panel de Cloudflare **no ofrece un cambio atómico**: la rama de producción, el comando de build y el directorio de salida se modifican uno tras otro, y entre un cambio y el siguiente la configuración es incoherente (p. ej. comando de build `node scripts/build-pages.mjs` con la rama `deploy/cloudflare-pages`, que no contiene `scripts/`, o rama `main` sin directorio de salida `dist`, que publicaría la raíz del repositorio). Con *Automatic deployments* activo, cualquier push en esa ventana dispara un deployment con una configuración a medias. Por eso los despliegues automáticos **se deshabilitan antes de tocar cualquier otro ajuste** y solo se reactivan cuando los tres ajustes están aplicados y verificados.

### Precondiciones (todas verificables, antes de tocar Cloudflare)

1. La Pull Request de integración está fusionada en `main` y el CI de `main` está en verde (`pages-build` y `node-tests`).
2. En un checkout limpio de `main`: `node scripts/build-pages.mjs` termina con código 0 y `node scripts/verify-dist.mjs` (con el `MANIFEST_SHA256` de `ci.yml`) también.
3. Equivalencia con producción: `sha256sum scripts/pages-manifest.json` coincide con `MANIFEST_SHA256` y la comprobación por HTTPS de producción (ver «Comprobación por HTTPS») pasa. Si no coinciden, **no migrar**.
4. `deploy/cloudflare-pages` está en `9c0b492` y se conserva intacta (no se borra, no se hace push).
5. Se anota el identificador del deployment de producción actual en Cloudflare Pages → Deployments; es el destino del rollback.

### Pasos

1. **Pausar** *Automatic deployments* (Settings → Builds & deployments). Mientras esté pausado no se publica nada.
2. Con la pausa activa y comprobada en el panel, cambiar **de uno en uno** (no hay operación atómica): Build output directory → `dist`; Build command → `node scripts/build-pages.mjs`; Production branch → `main`; Root directory sin cambios (vacío). Releer el panel al terminar para confirmar los tres valores.
3. Lanzar manualmente un deployment de producción desde `main` y esperar a que termine con éxito.
4. **Comprobar** el resultado (sección siguiente). Hasta que no pase, el deployment anterior sigue disponible para rollback.
5. Si la comprobación pasa, **reactivar** *Automatic deployments* y verificar que WAF, Access y la redirección de `pages.dev` siguen activos (no se han modificado).
6. Registrar la fecha, el commit de `main` desplegado y el resultado en `docs/release-sim-nofirvi-1.md` mediante un commit/PR aparte.

### Comprobación por HTTPS

`404.html` y `_headers` son archivos especiales de Pages y **no se exige que se puedan descargar directamente**: `_headers` lo consume Pages para aplicar cabeceras y normalmente no se sirve como contenido, y `404.html` se entrega como respuesta a rutas inexistentes (una petición directa a `/404.html` puede devolver 404 o redirigir). Su integridad queda garantizada por los hashes del artefacto (`build-pages.mjs` y `verify-dist.mjs`) y su efecto se comprueba por comportamiento:

- Los **33 archivos restantes** se descargan y su SHA-256 debe coincidir con el manifiesto.
- `404.html`: una ruta inexistente debe responder **404** con un cuerpo cuyo SHA-256 sea el de `404.html`.
- `_headers`: la respuesta de `/` (o de cualquier archivo servido) debe incluir las cabeceras que declara `pages/_headers` (como mínimo `Content-Security-Policy`, `X-Content-Type-Options` y `Strict-Transport-Security`).

Sustituye `$PAGES_URL` por la URL pública de producción (según el README, `https://simulador.nulljinx.com`) y ejecuta desde la raíz del repositorio en el commit desplegado (si Access protege la URL, el acceso requiere las credenciales que corresponda; no las guardes en el repositorio):

```bash
node -e '
const m=require("./scripts/pages-manifest.json").files;
const c=require("node:crypto");
const sha=(b)=>c.createHash("sha256").update(Buffer.from(b)).digest("hex");
const base=process.env.PAGES_URL.replace(/\/$/,"");
const SPECIAL=["404.html","_headers"];
(async()=>{let bad=0;const no=(m)=>{bad++;console.log("FALLO",m)};
for(const [p,{sha256}] of Object.entries(m)){
  if(SPECIAL.includes(p))continue;
  const r=await fetch(base+"/"+p);
  if(!r.ok||sha(await r.arrayBuffer())!==sha256)no(p+" ("+r.status+")");
}
const nf=await fetch(base+"/__ruta-inexistente__");
if(nf.status!==404||sha(await nf.arrayBuffer())!==m["404.html"].sha256)no("404.html por comportamiento ("+nf.status+")");
const home=await fetch(base+"/");
for(const h of ["content-security-policy","x-content-type-options","strict-transport-security"])
  if(!home.headers.get(h))no("_headers: falta la cabecera "+h);
console.log(bad?bad+" fallos":"33/33 archivos coinciden; 404.html y _headers verificados por comportamiento");process.exit(bad?1:0)})()'
```

Criterio de éxito: sin ningún `FALLO`. Pages puede aplicar transformaciones transparentes al cliente (p. ej. compresión) y, en algunas configuraciones, redirigir `/index.html`; si algo difiere solo por eso, se investiga antes de dar la migración por buena.

#### Resultado de la ejecución real (2026-11-16)

El script se ejecutó contra `https://simulador.nulljinx.com` con el manifiesto de `main` (`3c80a33`), solo con peticiones GET:

- `33/33 archivos coinciden; 404.html y _headers verificados por comportamiento` (código de salida 0).
- `/` respondió 200 con `Content-Security-Policy`, `X-Content-Type-Options: nosniff` y `Strict-Transport-Security: max-age=31536000` (más `Permissions-Policy` y `Referrer-Policy`).
- Comportamiento observado de Pages: `/_headers` devuelve 404 (no se sirve); `/index.html` redirige con 308 a `/`; `http://` redirige con 308 a `https://`. Coincide con lo descrito arriba y no se requirió investigar ninguna diferencia.
- El log de build de Cloudflare confirmó la ejecución de `node scripts/build-pages.mjs` y la verificación de 35 archivos (confirmado por el responsable en el panel; no se puede leer desde el repositorio).

### Rollback de la migración (histórico; vigente mientras no se archive `deploy/cloudflare-pages`)

Se habría disparado si la comprobación falla, el build falla o aparece cualquier regresión visible.

1. **Pausar** *Automatic deployments* si estaban activos.
2. En Deployments, restaurar el deployment de producción anotado en la precondición 5 (`Rollback to this deployment`); no reconstruye y es inmediato.
3. **Restaurar los ajustes** a su valor previo a la migración, de uno en uno y con los despliegues automáticos aún deshabilitados (tampoco aquí hay operación atómica): Production branch → `deploy/cloudflare-pages`; Build command y Build output directory vacíos. Hacer el rollback del deployment *sin* restaurar los ajustes deja el proyecto listo para romperse en el siguiente push.
4. Reactivar *Automatic deployments*.
5. Ejecutar la comprobación por HTTPS (mismo script: 33 hashes y comportamiento de `404.html` y `_headers`).
6. Investigar la causa en una rama aparte y corregir en `main` mediante Pull Request; no editar `dist/` a mano.

El rollback no requiere tocar `deploy/cloudflare-pages` ni `main`, y es posible mientras no se archive esa rama.

### Después de la migración

`deploy/cloudflare-pages` sigue sin tocarse hasta que se autorice expresamente su archivado (tag o eliminación), una vez comprobado que la producción desde `main` es estable.
