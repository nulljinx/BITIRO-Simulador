#!/usr/bin/env node
// node scripts/verify-dist.mjs — comprobación independiente de dist/ (no reutiliza el código de build-pages.mjs).
// Exige: el SHA-256 de scripts/pages-manifest.json fijado en MANIFEST_SHA256 (variable de entorno), exactamente 43 archivos,
// el conjunto exacto de rutas, el SHA-256 de cada archivo y ninguna ruta de docs/, tests/, examples/ ni con «firvi».
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const errors = [];

const manifestBytes = readFileSync(join(ROOT, 'scripts', 'pages-manifest.json'));
const pinned = process.env.MANIFEST_SHA256;
if (!pinned) errors.push('MANIFEST_SHA256 no está definido');
else if (sha(manifestBytes) !== pinned) errors.push(`el manifiesto cambió: esperado ${pinned}, obtenido ${sha(manifestBytes)}`);
const files = JSON.parse(manifestBytes).files;

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [relative(DIST, p).split('\\').join('/')]; });
const present = walk(DIST).sort();
if (present.length !== 43) errors.push(`dist/ debe tener 43 archivos y tiene ${present.length}`);
const want = Object.keys(files).sort();
for (const f of present) if (!(f in files)) errors.push(`archivo extra: ${f}`);
for (const f of want) if (!present.includes(f)) errors.push(`falta: ${f}`);
for (const f of present) {
  if (f in files && sha(readFileSync(join(DIST, f))) !== files[f].sha256) errors.push(`hash distinto: ${f}`);
  if (/^(docs|tests|examples)\//.test(f) || /firvi/i.test(f)) errors.push(`ruta no autorizada: ${f}`);
}
if (errors.length) { console.error('VERIFICACIÓN DE dist/ FALLIDA:\n  - ' + errors.join('\n  - ')); process.exit(1); }
console.log(`dist/ verificado: ${present.length} archivos, rutas y SHA-256 exactos, sin rutas no autorizadas.`);
