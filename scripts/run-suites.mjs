#!/usr/bin/env node
// node scripts/run-suites.mjs            — las 22 suites Node oficiales (lista explícita, sin dependencias).
// node scripts/run-suites.mjs --browser  — las 6 pruebas de navegador; exige CHROME_BIN y trata un SKIP como fallo.
// Falla ante cualquier código de salida distinto de 0, señal, tiempo agotado, SKIP/OMITIDA, archivo de pruebas sin clasificar
// o cambio del árbol de trabajo (git status / git diff) causado por la ejecución.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = process.argv.includes('--browser');

const NODE_SUITES = [
  ['tests/calibration.cjs'],
  ['tests/contact-messages.cjs'],
  ['tests/guide-content.cjs'],
  ['tests/head-sonar.cjs'],
  ['tests/head/s08-matrix.cjs'],
  ['tests/head/s08-real-start.cjs'],
  ['tests/iroh-brand.cjs'],
  ['tests/motor-dynamics.cjs'],
  ['tests/pilot5.cjs'],
  ['tests/regression.cjs'],
  ['tests/runtime-functions.cjs'],
  ['tests/runtime-servo.cjs'],
  ['tests/runtime-start.cjs'],
  ['tests/scenario-props.cjs'],
  ['tests/sim1.cjs'],
  ['tests/smoke.cjs'],
  ['tests/strike-audit.cjs'],
  ['tests/syntax.cjs'],
  ['tests/track-digitize.cjs'],
  ['tests/track-reference/import-tracks.cjs', '--check'],   // sin --check reescribe tracks.js y extra-tracks.js
  ['tests/ui-contract.cjs'],
  ['tests/ui-shell.cjs'],
];
const BROWSER_SUITES = [
  ['tests/brand-logo-ui.mjs'],
  ['tests/calibration-ui.mjs'],
  ['tests/guide-ui.mjs'],
  ['tests/head-compat-ui.mjs'],
  ['tests/head-ui.mjs'],
  ['tests/iroh-brand-ui.mjs'],
];
// Bibliotecas, sondas y herramientas: se importan o se usan a mano, no son suites.
const AUX = new Set([
  'tests/head/eval2.cjs', 'tests/head/lib.cjs', 'tests/head/runner.cjs', 'tests/head/s08-geometry.cjs',
  'tests/sim1/characterization.cjs', 'tests/sim1/harness.cjs', 'tests/sim1/motor-probe.cjs',
  'tests/sim1/scenarios.cjs', 'tests/sim1/trace-cli.cjs', 'tests/sim1/wheelbase-probe.cjs',
  'tests/perf/cdp.mjs', 'tests/perf/sim-low-end.mjs',
]);

const fail = (m) => { console.error(`FALLO: ${m}`); process.exit(1); };
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [relative(ROOT, p).split('\\').join('/')]; });

const known = new Set([...NODE_SUITES, ...BROWSER_SUITES].map(([f]) => f).concat([...AUX]));
const unclassified = walk(join(ROOT, 'tests')).filter((f) => /\.(cjs|mjs)$/.test(f) && !known.has(f));
if (unclassified.length) fail(`archivos de pruebas sin clasificar (añádelos a NODE_SUITES, BROWSER_SUITES o AUX):\n  ${unclassified.join('\n  ')}`);
for (const [f] of [...NODE_SUITES, ...BROWSER_SUITES]) { try { statSync(join(ROOT, f)); } catch { fail(`falta la suite ${f}`); } }

const git = (...a) => spawnSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
const snapshot = () => {
  const st = git('status', '--porcelain', '-uall'), df = git('diff', '--binary');
  if (st.status !== 0) return null;
  return `${st.stdout}\n#${createHash('sha256').update(df.stdout).digest('hex')}`;
};
const before = snapshot();

const env = { ...process.env, HEAD_S08_OUT: mkdtempSync(join(tmpdir(), 'bitiro-suites-')) };
delete env.SIM1_UPDATE;   // nunca regenerar goldens desde el runner
let nodeArgs = [];
let list = NODE_SUITES;
if (browser) {
  list = BROWSER_SUITES; nodeArgs = ['--experimental-websocket'];
  if (!env.CHROME_BIN) fail('CHROME_BIN no está definido: sin Chrome las pruebas de navegador no se ejecutan (un SKIP no cuenta como éxito).');
  try { accessSync(env.CHROME_BIN, constants.X_OK); } catch { fail(`CHROME_BIN no es ejecutable: ${env.CHROME_BIN}`); }
}

const failures = [];
for (const [file, ...args] of list) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [...nodeArgs, join(ROOT, file), ...args], { cwd: ROOT, env, encoding: 'utf8', timeout: 300_000, maxBuffer: 1 << 28 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  let why = null;
  if (r.error) why = `no se pudo ejecutar o excedió el tiempo: ${r.error.message}`;
  else if (r.signal) why = `terminada por la señal ${r.signal}`;
  else if (r.status !== 0) why = `código de salida ${r.status}`;
  else if (/^(SKIP|OMITIDA)\b/m.test(out)) why = 'la suite se omitió (SKIP/OMITIDA), lo que no cuenta como éxito';
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (why) { failures.push(file); console.log(`FAIL ${file} (${s} s) · ${why}\n${out.split('\n').slice(-25).join('\n')}`); }
  else console.log(`OK   ${file} (${s} s)`);
}

const after = snapshot();
if (before !== null && before !== after) { failures.push('(árbol de trabajo)'); console.log('FAIL la ejecución modificó el árbol de trabajo (git status/diff distinto antes y después).'); }
console.log(`\n${list.length - failures.filter((f) => f !== '(árbol de trabajo)').length}/${list.length} suites correctas${failures.includes('(árbol de trabajo)') ? '; el árbol de trabajo cambió: FALLO' : ''}${before === null ? ' (sin repositorio Git: no se comprobó el árbol de trabajo)' : ''}.`);
process.exit(failures.length ? 1 : 0);
