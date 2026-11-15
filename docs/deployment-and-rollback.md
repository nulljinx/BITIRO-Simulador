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

## Configuración requerida en Pages

- Producción: rama `main`.
- Comando de build: `node scripts/build-pages.mjs`.
- Directorio de salida: `dist`.
- Variables de entorno: ninguna. Sin dependencias (`npm install` no es necesario).
- Se mantienen WAF, Access y la redirección de `pages.dev`.

## Verificación previa a cada deployment

1. `git status` limpio y el commit a publicar identificado.
2. `node scripts/build-pages.mjs` termina con código 0 (35 archivos verificados).
3. Suites Node y de navegador en verde.
4. Tras publicar: descargar los 35 archivos por HTTPS y comparar SHA-256 con el manifiesto.

## Rollback

1. En Cloudflare Pages → Deployments, elegir el deployment anterior verificado y `Rollback to this deployment` (no reconstruye; es inmediato).
2. Verificar por HTTPS los 35 hashes del deployment restaurado.
3. Si el problema es de código, corregir en `main` mediante Pull Request; no editar `dist/` a mano.

Respaldo permanente: el commit `9c0b492` de `deploy/cloudflare-pages` se conserva sin tocar hasta que el ciclo de migración termine y se autorice su archivado.

## Migración desde `deploy/cloudflare-pages`

Ver el plan por fases en el informe de REPO-REORGANIZATION-1 (pausar despliegues automáticos, demostrar el artefacto idéntico, cambiar la rama de producción y comprobar).
