#!/usr/bin/env python3
"""Ejecuta escalones en Grafana Cloud k6 (nunca local), recolecta métricas y aplica condiciones de aborto.

  python3 tests/load/run-matrix.py --plan full --zone "amazon:us:ashburn"
  python3 tests/load/run-matrix.py --plan geo  --zone "amazon:br:sao paulo" [--append]
  python3 tests/load/run-matrix.py --compare tests/load/results/*.jsonl

Resultados: tests/load/results/<zona>.jsonl (ignorado por git). Si el archivo ya existe, falla salvo con --append.
Requiere `k6 cloud login` o K6_CLOUD_TOKEN + K6_CLOUD_STACK_ID.
Códigos de salida: 0 matriz completa; 1 credenciales/API; 2 k6 sin run ID u operador (archivo existente);
3 run sin completar; 4 run no `passed`; 5 condición de aborto; 6 zona distinta de la solicitada.
El comando es siempre `k6 cloud run`; no hay ejecución local de reserva.
"""
import argparse, datetime, importlib.util, json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
spec = importlib.util.spec_from_file_location('collect_results', os.path.join(HERE, 'collect-results.py'))
cr = importlib.util.module_from_spec(spec); spec.loader.exec_module(cr)

K6 = os.environ.get('K6_BIN', os.path.expanduser('~/.local/bin/k6'))
POLL_TRIES, POLL_EVERY_S = 40, 10
FONT = '/assets/fonts/ibm-plex-sans-latin-400-normal.woff2'
PLANS = {
    'full': [('SINGLE-ASSET-CACHED', 'single-asset', FONT, [1, 25, 100]),
             ('SINGLE-ASSET-REVALIDATED', 'single-asset', '/simulator.js', [1, 5, 10, 25, 50, 75, 100]),
             ('PAGE-BUNDLE', 'page-bundle', FONT, [1, 5, 10, 25, 50, 75, 100])],
    'geo': [('SINGLE-ASSET-CACHED', 'single-asset', FONT, [1, 100]),
            ('SINGLE-ASSET-REVALIDATED', 'single-asset', '/simulator.js', [1, 25, 100]),
            ('PAGE-BUNDLE', 'page-bundle', FONT, [1, 25, 100])],
}


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def abort_reasons(d, vus, base_p95):
    """Lista de motivos de aborto (vacía = seguir)."""
    r = []
    if d['5xx'] > 0: r.append('5xx')
    if (d['err_pct'] or 0) > 1: r.append('error>1%')
    if d['http_reqs'] == 0: r.append('sin peticiones')
    if any(int(c) in (403, 429, 503) for c in d['codes']): r.append('403/429/503')
    if vus > 1 and d['dur_p95'] and base_p95 and d['dur_p95'] > max(1000, 6 * base_p95): r.append('p95 disparado')
    return r


def run(plan, zone, out, append=False):
    """Devuelve el código de salida (ver cabecera)."""
    if os.path.exists(out) and not append:
        print(f'{os.path.relpath(out, REPO)} ya existe; usa --append para anexar o mueve/renombra el archivo.')
        return 2
    os.makedirs(os.path.dirname(out), exist_ok=True)
    base = {}
    for label, scen, asset, steps in PLANS[plan]:
        for v in steps:
            start = now()
            name = f'sim-load-{label}-{v}vu-{zone.split(":")[-1].replace(" ", "")}'
            # Siempre `k6 cloud run`. Nunca `k6 run` ni --local-execution.
            cmd = [K6, 'cloud', 'run', '--no-usage-report', '-e', f'SCENARIO={scen}', '-e', f'VUS={v}',
                   '-e', f'ASSET={asset}', '-e', f'LOAD_ZONE={zone}', '-e', 'WARMUP_S=30', '-e', 'MEASURE_S=60',
                   '-e', f'TEST_NAME={name}', 'tests/load/sim-load.js']
            try:
                p = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
            except OSError as e:
                print(f'no se pudo ejecutar k6 ({type(e).__name__}); revisa K6_BIN.')
                return 2
            # Un exit code != 0 de k6 con run creado (p. ej. umbral fallido) se resuelve más abajo con result != passed.
            m = re.search(r'runs/(\d+)', re.sub(r'\x1b\[[0-9;?]*[A-Za-z]', '', p.stdout + p.stderr))
            if not m:
                print(f'{label} {v} VUs: k6 cloud run no devolvió run ID (exit code {p.returncode}); salida omitida.')
                return 2
            rid = m.group(1)
            info = {}
            for _ in range(POLL_TRIES):  # esperar al procesado de métricas
                info = cr.run_info(rid)
                if info.get('status') == 'completed': break
                time.sleep(POLL_EVERY_S)
            if info.get('status') != 'completed':
                print(f'{label} {v} VUs: run {rid} no llegó a completed tras {POLL_TRIES * POLL_EVERY_S}s (estado: {info.get("status")}).')
                return 3
            reported = (info.get('distribution') or [{}])[0].get('load_zone')
            if reported != zone:
                with open(out, 'a') as f:
                    f.write(json.dumps(dict(label=label, vus=v, run_id=rid, start=start, end=now(), result=info.get('result'),
                                            zone=reported, requested_zone=zone, aborted='zone_mismatch')) + '\n')
                print(f'{label} {v} VUs: zona solicitada "{zone}" pero Grafana informa "{reported}" (run {rid}).')
                return 6
            time.sleep(5)
            d = cr.collect(rid)
            d.update(label=label, vus=v, run_id=rid, start=start, end=now(), result=info.get('result'), zone=reported)
            with open(out, 'a') as f:
                f.write(json.dumps(d) + '\n')
            print(label, v, rid, 'rps=%.0f err=%s p95=%s 5xx=%s result=%s' % (d['rps'], d['err_pct'], d['dur_p95'], d['5xx'], d['result']), flush=True)
            if info.get('result') != 'passed':
                print(f'ABORT en {label} {v}: result={info.get("result")}')
                return 4
            reasons = abort_reasons(d, v, base.setdefault(label, d['dur_p95']))
            if reasons:
                print(f'ABORT en {label} {v}: {", ".join(reasons)}')
                return 5
    return 0


def compare(files):
    rows = {}
    for path in files:
        with open(path) as fh:
            for l in fh:
                d = json.loads(l)
                if d.get('aborted'): continue  # registros de discrepancia de zona: sin métricas
                rows.setdefault((d['label'], d['vus']), {})[d['zone']] = d
    z1, z2 = 'amazon:us:ashburn', 'amazon:br:sao paulo'
    f = lambda d, k: '-' if not d or d.get(k) is None else '%.0f' % d[k]
    print('scenario | VUs | Ashburn p50 | SP p50 | Ashburn p95 | SP p95 | Ashburn p99 | SP p99 | error % (Ash/SP)')
    for (label, v), z in sorted(rows.items()):
        if z2 not in z: continue
        a, s = z.get(z1), z[z2]
        e = lambda d: '-' if not d else '%.3f' % d['err_pct']
        print(f"{label} | {v} | {f(a,'dur_p50')} | {f(s,'dur_p50')} | {f(a,'dur_p95')} | {f(s,'dur_p95')} | {f(a,'dur_p99')} | {f(s,'dur_p99')} | {e(a)}/{e(s)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plan', choices=PLANS); ap.add_argument('--zone', default='amazon:us:ashburn')
    ap.add_argument('--append', action='store_true', help='anexar a un archivo de resultados existente')
    ap.add_argument('--compare', nargs='+')
    a = ap.parse_args()
    try:
        if a.compare:
            compare(a.compare); return 0
        if a.plan:
            out = os.path.join(HERE, 'results', a.zone.split(':')[-1].replace(' ', '-') + '.jsonl')
            return run(a.plan, a.zone, out, a.append)
    except (cr.CredentialsError, cr.ApiError) as e:
        print(e, file=sys.stderr)
        return 1
    ap.error('indica --plan o --compare')


if __name__ == '__main__':
    sys.exit(main())
