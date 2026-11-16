# Deployment y rollback (Cloudflare Pages)

> **Estado:** procedimiento propuesto. No se ha cambiado ninguna configuración de Cloudflare. Cada paso que toque Cloudflare, DNS, WAF o Access requiere autorización explícita.

## Modelo

| Capa | Qué es |
|---|---|
| Fuente | rama `main` |
| Artefacto | `dist/` (35 archivos) producido por `node scripts/build-pages.mjs` |
| Deployment | Cloudflare Pages sirviendo exactamente ese `dist/` |
| Identidad del deployment | los SHA-256 de `scripts/pages-manifest.json`, no un nombre de rama |

Pages **nunca** debe publicar la raíz del repositorio: contiene `docs/`, `tests/`, `examples/` y material no público.

## Configuración requerida en Pages (objetivo tras la migración)

> **Pendiente:** hoy la rama de producción de Pages es `deploy/cloudflare-pages`, con build command, build output y root directory vacíos y *Automatic deployments* activo (comprobado en el panel). Nada de lo siguiente se ha aplicado todavía; el procedimiento está en «Migración» más abajo.

- Producción: rama `main`.
- Comando de build: `node scripts/build-pages.mjs`.
- Directorio de salida: `dist`.
- Variables de entorno: ninguna. Sin dependencias (`npm install` no es necesario).
- Se mantienen WAF, Access y la redirección de `pages.dev`.

## Verificación previa a cada deployment

1. `git status` limpio y el commit a publicar identificado.
2. `node scripts/build-pages.mjs` termina con código 0 (35 archivos verificados).
3. Suites Node y de navegador en verde (`node scripts/run-suites.mjs` y `--browser`; ver [`ci-and-validation.md`](ci-and-validation.md)).
4. Tras publicar: comprobar por HTTPS los hashes y el comportamiento de `404.html` y `_headers` (ver «Comprobación por HTTPS»).

## Rollback

1. En Cloudflare Pages → Deployments, elegir el deployment anterior verificado y `Rollback to this deployment` (no reconstruye; es inmediato).
2. Verificar por HTTPS el deployment restaurado (hashes y comportamiento de `404.html` y `_headers`, ver «Comprobación por HTTPS»).
3. Si el problema es de código, corregir en `main` mediante Pull Request; no editar `dist/` a mano.

Respaldo permanente: el commit `9c0b492` de `deploy/cloudflare-pages` se conserva sin tocar hasta que el ciclo de migración termine y se autorice su archivado.

## Migración desde `deploy/cloudflare-pages` a `main`

> **Estado:** plan no ejecutado. Cada paso que modifique Cloudflare requiere autorización explícita y se hace manualmente en el panel; ningún script de este repositorio toca Cloudflare.

### Configuración actual (comprobada en el panel)

| Ajuste | Valor actual | Valor objetivo |
|---|---|---|
| Production branch | `deploy/cloudflare-pages` | `main` |
| Automatic deployments | Enabled | Enabled (se pausa solo durante la migración) |
| Build command | vacío | `node scripts/build-pages.mjs` |
| Build output directory | vacío | `dist` |
| Root directory | vacío | vacío |

Hoy Pages sirve los archivos de `deploy/cloudflare-pages` tal cual, sin build. La rama contiene el candidato `9c0b492` (el mismo que fija `scripts/pages-manifest.json`).

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

Criterio de éxito: sin ningún `FALLO`. Pages puede aplicar transformaciones transparentes al cliente (p. ej. compresión) y, en algunas configuraciones, redirigir `/index.html`; si algo difiere solo por eso, se investiga antes de dar la migración por buena. Esta comprobación no se ha ejecutado todavía contra producción; el comportamiento exacto de `404.html` y `_headers` en Pages debe confirmarse en la primera ejecución real.

### Rollback de la migración

Dispara si la comprobación falla, el build falla o aparece cualquier regresión visible.

1. **Pausar** *Automatic deployments* si estaban activos.
2. En Deployments, restaurar el deployment de producción anotado en la precondición 5 (`Rollback to this deployment`); no reconstruye y es inmediato.
3. **Restaurar los ajustes** a su valor actual, de uno en uno y con los despliegues automáticos aún deshabilitados (tampoco aquí hay operación atómica): Production branch → `deploy/cloudflare-pages`; Build command y Build output directory vacíos. Hacer el rollback del deployment *sin* restaurar los ajustes deja el proyecto listo para romperse en el siguiente push.
4. Reactivar *Automatic deployments*.
5. Ejecutar la comprobación por HTTPS (mismo script: 33 hashes y comportamiento de `404.html` y `_headers`).
6. Investigar la causa en una rama aparte y corregir en `main` mediante Pull Request; no editar `dist/` a mano.

El rollback no requiere tocar `deploy/cloudflare-pages` ni `main`, y es posible mientras no se archive esa rama.

### Después de la migración

`deploy/cloudflare-pages` sigue sin tocarse hasta que se autorice expresamente su archivado (tag o eliminación), una vez comprobado que la producción desde `main` es estable.
