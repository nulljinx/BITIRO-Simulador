// SIM-LOAD-1 — harness k6 (solo entrega HTTP; no ejecuta JS del navegador).
// Un escalón por ejecución: rampa de warm-up + ventana útil a VUs constantes.
// Sin secretos: la autenticación Cloud va por K6_CLOUD_TOKEN / `k6 cloud login`.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

const BASE_URL = (__ENV.BASE_URL || 'https://simulador.nulljinx.com').replace(/\/$/, '');
const SCENARIO = __ENV.SCENARIO || 'page-bundle'; // single-asset | page-bundle
const VUS = parseInt(__ENV.VUS || '1', 10);
const WARMUP = parseInt(__ENV.WARMUP_S || '30', 10);
const MEASURE = parseInt(__ENV.MEASURE_S || '60', 10);
const ASSET = __ENV.ASSET || '/assets/fonts/ibm-plex-sans-latin-400-normal.woff2';
const THINK = parseFloat(__ENV.THINK_S || '0'); // pausa entre iteraciones
const PATH_LABEL = __ENV.PATH_LABEL || 'public-cdn';

// DIRECT-ORIGIN: PUBLIC_HOST + ORIGIN_IP conservan Host/SNI y resuelven al origen (k6 `hosts`).
// Por defecto no se define: el DNS público apunta a Cloudflare.
const hosts = {};
if (__ENV.PUBLIC_HOST && __ENV.ORIGIN_IP) hosts[__ENV.PUBLIC_HOST] = __ENV.ORIGIN_IP;

// Arranque real de index.html (tokens.css/styles.css, 12 scripts, símbolo, fuentes de @font-face).
const CSS = ['/tokens.css', '/styles.css'];
const JS = ['/tracks.js', '/extra-tracks.js', '/calibration.js', '/iroh-runtime.js', '/strike-physics.js',
  '/scenario-props.js', '/renderer3d.js', '/starters.js', '/simulator.js', '/syntax-highlight.js',
  '/ui-shell.js', '/scenario-editor.js'];
const IMG = ['/assets/bitiro-symbol.png'];
const FONTS = ['sans-latin-400-normal', 'sans-latin-500-normal', 'sans-latin-600-normal',
  'mono-latin-400-normal', 'mono-latin-500-normal'].map((f) => `/assets/fonts/ibm-plex-${f}.woff2`);

const LOAD_ZONE = __ENV.LOAD_ZONE || 'amazon:us:ashburn';
const TEST_NAME = __ENV.TEST_NAME || `sim-load-${PATH_LABEL}-${SCENARIO}-${VUS}vu`;

export const options = {
  hosts,
  cloud: { name: TEST_NAME, distribution: { z1: { loadZone: LOAD_ZONE, percent: 100 } } },
  scenarios: {
    step: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [{ duration: `${WARMUP}s`, target: VUS }, { duration: `${MEASURE}s`, target: VUS }],
      gracefulRampDown: '5s',
    },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // Críticos: errores, 5xx y checks. Latencias: solo señal comparativa (sin baseline previo).
    'http_req_failed{phase:measure}': ['rate<0.01'],
    'checks{phase:measure}': ['rate>0.99'],
    'status_5xx': ['count==0'],
    'http_req_duration{phase:measure}': ['p(50)>=0', 'p(95)>=0', 'p(99)>=0'],
    'http_req_waiting{phase:measure}': ['p(50)>=0', 'p(95)>=0', 'p(99)>=0'],
  },
  tags: { path: PATH_LABEL, scenario_name: SCENARIO, vus: String(VUS) },
};

const status5xx = new Counter('status_5xx');
const statusCount = new Counter('status_codes');
const cfCache = new Counter('cf_cache_status');
const iterPhase = new Counter('iters_by_phase');

// Fase global del test (no por VU): measure empieza WARMUP_S después del inicio del escenario.
function phase() {
  return Date.now() - exec.scenario.startTime < WARMUP * 1000 ? 'warmup' : 'measure';
}

function record(res, ph) {
  const st = res.status;
  statusCount.add(1, { status: String(st), phase: ph });
  if (st >= 500) status5xx.add(1);
  const cf = res.headers['Cf-Cache-Status'] || res.headers['cf-cache-status'] || 'none';
  cfCache.add(1, { cf_cache_status: cf, phase: ph, url_path: res.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] });
  check(res, { 'status 2xx/3xx': (r) => r.status >= 200 && r.status < 400 }, { phase: ph });
}

export default function () {
  const ph = phase();
  const tags = { phase: ph };
  if (SCENARIO === 'single-asset') {
    record(http.get(BASE_URL + ASSET, { tags }), ph);
  } else {
    // Como un navegador: HTML primero; luego CSS/JS/imagen/fuentes en paralelo.
    record(http.get(BASE_URL + '/', { tags }), ph);
    const reqs = [...CSS, ...JS, ...IMG, ...FONTS].map((p) => ['GET', BASE_URL + p, null, { tags }]);
    http.batch(reqs).forEach((r) => record(r, ph));
  }
  iterPhase.add(1, { phase: ph });
  if (THINK > 0) sleep(THINK);
}

export function handleSummary(data) {
  const out = __ENV.SUMMARY_OUT;
  const res = { stdout: textSummary(data, { indent: ' ', enableColors: false }) };
  if (out) res[out] = JSON.stringify(data, null, 2);
  return res;
}
