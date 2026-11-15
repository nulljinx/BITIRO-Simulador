#!/usr/bin/env node
// node scripts/build-pages.mjs — genera dist/ con EXACTAMENTE los 35 archivos públicos de Cloudflare Pages.
// La allowlist y los SHA-256 aprobados están en scripts/pages-manifest.json. El build falla si falta un archivo,
// si un origen no coincide con su hash, si dist/ contiene algo fuera de la allowlist o si el resultado difiere.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts', 'pages-manifest.json'), 'utf8'));
const entries = Object.entries(manifest.files);
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const errors = [];

if (entries.length !== 35) errors.push(`la allowlist debe tener 35 entradas (tiene ${entries.length})`);

for (const [dest, { source, sha256: want }] of entries) {
  const src = join(ROOT, source);
  if (!existsSync(src)) { errors.push(`falta el origen: ${source}`); continue; }
  const got = sha256(src);
  if (got !== want) errors.push(`hash distinto en origen ${source}\n    esperado ${want}\n    obtenido ${got}`);
}
if (errors.length) fail();

rmSync(DIST, { recursive: true, force: true });
for (const [dest, { source }] of entries) {
  mkdirSync(dirname(join(DIST, dest)), { recursive: true });
  cpSync(join(ROOT, source), join(DIST, dest));
}

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : [relative(DIST, p).split('\\').join('/')];
});
const present = walk(DIST).sort();
const allowed = entries.map(([d]) => d).sort();
for (const f of present) if (!allowed.includes(f)) errors.push(`archivo extra en dist/: ${f}`);
for (const f of allowed) if (!present.includes(f)) errors.push(`falta en dist/: ${f}`);
for (const [dest, { sha256: want }] of entries) {
  if (existsSync(join(DIST, dest)) && sha256(join(DIST, dest)) !== want) errors.push(`hash distinto en dist/${dest}`);
}
if (errors.length) fail();
console.log(`dist/ listo: ${present.length} archivos, todos verificados contra ${manifest.candidate} (${manifest.approvedCommit.slice(0, 7)}).`);

function fail() {
  console.error('BUILD FALLIDO:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
