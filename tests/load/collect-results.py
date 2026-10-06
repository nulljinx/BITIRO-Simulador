#!/usr/bin/env python3
"""Cliente mínimo de la API de Grafana Cloud k6 + recolector de métricas de la ventana phase:measure.

Credencial (se resuelve una sola vez por proceso y nunca se imprime):
  1. K6_CLOUD_TOKEN + K6_CLOUD_STACK_ID (deben venir las dos o ninguna), o
  2. el login de `k6 cloud login` en ~/.config/k6/config.json (solo se conservan token y stackID).
Toda salida de la API pasa por redact().
"""
import json, os, sys, urllib.error, urllib.parse as up, urllib.request

SENSITIVE = ('token', 'access_token', 'api_token', 'authorization', 'password', 'secret')
DROP_FROM_RUN = ('options', 'started_by')  # options lleva un token de ejecución; started_by es PII
_QUOTE_SAFE = "(),='*{}\""  # permite selectores metric{phase="measure"}
_creds = None


class CredentialsError(RuntimeError):
    pass


class ApiError(RuntimeError):
    """Error de red/respuesta ya sanitizado (sin request, cabeceras ni valores locales)."""


def redact(obj):
    """Copia recursiva con los campos sensibles reemplazados por [REDACTED]."""
    if isinstance(obj, dict):
        return {k: '[REDACTED]' if any(s in str(k).lower() for s in SENSITIVE) else redact(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(v) for v in obj]
    return obj


def _credentials():
    global _creds
    if _creds:
        return _creds
    tok, stack = os.environ.get('K6_CLOUD_TOKEN'), os.environ.get('K6_CLOUD_STACK_ID')
    if bool(tok) != bool(stack):
        raise CredentialsError('K6_CLOUD_TOKEN y K6_CLOUD_STACK_ID deben definirse las dos o ninguna.')
    if not tok:
        try:
            with open(os.path.expanduser('~/.config/k6/config.json')) as f:
                c = json.load(f)['collectors']['cloud']
            tok, stack = c['token'], str(c['stackID'])
        except (OSError, ValueError, KeyError, TypeError):
            raise CredentialsError('Sin credenciales: define K6_CLOUD_TOKEN + K6_CLOUD_STACK_ID o ejecuta `k6 cloud login`.') from None
    _creds = (tok, stack)
    return _creds


def get(url):
    tok, stack = _credentials()
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + tok, 'X-Stack-Id': stack})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        return {'_http': e.code}
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise ApiError(f'error al consultar la API de Grafana ({type(e).__name__})') from None


def run_info(rid):
    """Estado del run, redactado y sin options ni started_by."""
    r = redact(get(f'https://api.k6.io/cloud/v6/test_runs/{rid}'))
    for k in DROP_FROM_RUN:
        r.pop(k, None)
    return r


def _q(rid, metric, query):
    expr = f"query_aggregate_k6(metric='{metric}',query='{query}')"
    r = get(f'https://api.k6.io/cloud/v5/test_runs/{rid}/' + up.quote(expr, safe=_QUOTE_SAFE))
    return r.get('data', {}).get('result', [])


def _by(rid, metric, query, label):
    return {x['metric'].get(label): x['values'][0][1] for x in _q(rid, metric, query)}


def _scalar(rid, metric, query):
    res = _q(rid, metric, query)
    return res[0]['values'][0][1] if res else None


def collect(rid, measure_s=60):
    """Métricas de la ventana measure de un run. Latencias en ms."""
    d = {}
    for key, metric in (('dur', 'http_req_duration'), ('wait', 'http_req_waiting'),
                        ('conn', 'http_req_connecting'), ('tls', 'http_req_tls_handshaking')):
        for p in (0.5, 0.95, 0.99):
            d[f'{key}_p{int(p * 100)}'] = _by(rid, metric, f'histogram_quantile({p}) by (phase)', 'phase').get('measure')
    codes, cf = {}, {}
    for x in _q(rid, 'status_codes', 'increase by (status, phase)'):
        if x['metric'].get('phase') == 'measure':
            codes[x['metric']['status']] = x['values'][0][1]
    for x in _q(rid, 'cf_cache_status', 'increase by (cf_cache_status, phase)'):
        if x['metric'].get('phase') == 'measure':
            k = x['metric']['cf_cache_status']; cf[k] = cf.get(k, 0) + x['values'][0][1]
    reqs = sum(codes.values())
    allreqs = sum(_by(rid, 'status_codes', 'increase by (phase)', 'phase').values()) or 1
    d['data_total'] = _scalar(rid, 'data_received', 'increase')
    # data_received no lleva tag de fase (el filtro por fase devuelve vacío): se prorratea por peticiones. ES UNA ESTIMACIÓN.
    d['data_measure_est'] = d['data_total'] * reqs / allreqs if d['data_total'] else None
    d['data_measure_est_per_s'] = d['data_measure_est'] / measure_s if d['data_measure_est'] is not None else None
    d.update(codes=codes, cf=cf, http_reqs=reqs, failed=sum(v for k, v in codes.items() if not 200 <= int(k) < 400),
             iters=_by(rid, 'iters_by_phase', 'increase by (phase)', 'phase').get('measure'))
    d['5xx'] = sum(v for k, v in codes.items() if int(k) >= 500)
    d['rps'] = reqs / measure_s
    d['ips'] = (d['iters'] or 0) / measure_s
    d['err_pct'] = 100 * d['failed'] / reqs if reqs else None  # derivado de códigos HTTP; distinto de http_req_failed_rate
    # Métricas Rate de k6 (selector de fase; `by (phase)` no está soportado para este tipo de métrica).
    failed_sel, checks_sel = 'http_req_failed{phase="measure"}', 'checks{phase="measure"}'
    # Para http_req_failed la consulta `rate` de la API devuelve 0.0 aunque `passes` > 0 (visto en runs con errores de transporte),
    # así que la tasa se calcula como passes/count (fracción [0,1], incluye errores de transporte) y el valor crudo se conserva aparte.
    failed_n, failed_total = _scalar(rid, failed_sel, 'passes'), _scalar(rid, failed_sel, 'count')
    d['http_req_failed_count'] = failed_n                              # nº de peticiones marcadas como fallidas por k6
    d['http_req_failed_rate'] = failed_n / failed_total if failed_n is not None and failed_total else None
    d['http_req_failed_rate_api'] = _scalar(rid, failed_sel, 'rate')   # valor crudo de la API; no fiable para esta métrica
    d['checks_rate'] = _scalar(rid, checks_sel, 'rate')
    d['checks_total'] = _scalar(rid, checks_sel, 'count')
    d['checks_passed'] = _scalar(rid, checks_sel, 'passes')
    d['checks_failed'] = (d['checks_total'] - d['checks_passed']) if None not in (d['checks_total'], d['checks_passed']) else None
    return d


if __name__ == '__main__':  # python3 collect-results.py <run_id>  -> JSON redactado
    try:
        rid = sys.argv[1]
        print(json.dumps(redact({'run': run_info(rid), 'measure': collect(rid)}), indent=1))
    except (CredentialsError, ApiError) as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    except IndexError:
        print('uso: collect-results.py <run_id>', file=sys.stderr)
        sys.exit(2)
