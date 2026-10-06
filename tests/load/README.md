# tests/load — SIM-LOAD-1 (Grafana k6)

Mide solo entrega HTTP/CDN/origen. No ejecuta JS de navegador (renderizado/Canvas/física/FPS → SIM-LOW-END-1).
Estos tests NO forman parte de las suites funcionales (`tests/*.cjs`).

**Regla:** nunca generar carga desde el servidor de producción. Usar Grafana Cloud k6 o un generador externo.

## Archivos
- `sim-load.js`: script k6 (un escalón por ejecución).
- `run-matrix.py`: lanza los escalones en Grafana Cloud, espera, recolecta, aplica condiciones de aborto, y compara zonas.
- `collect-results.py`: cliente de la API de Grafana (con redacción de secretos) y recolector de la ventana `phase:measure`.
- `results/` (ignorado por git): salida `.jsonl` por zona.

## Escenarios (`SCENARIO`)
- `single-asset`: un recurso (`ASSET`). CACHED = fuente woff2 (HIT en CF). REVALIDATED = `/simulator.js` (`no-cache`, REVALIDATED).
- `page-bundle`: `/` + 2 CSS + 12 JS + símbolo + 5 fuentes (21 peticiones por iteración, el arranque real de `index.html`). Sin plotters (solo al pulsar «Referencia»).

Los VUs repiten el escenario en bucle: 100 VUs en `page-bundle` NO equivalen a 100 estudiantes con la página abierta, sino a ~80 aperturas completas por segundo sostenidas.

## Variables de `sim-load.js`
`BASE_URL` (def. https://simulador.nulljinx.com), `SCENARIO`, `VUS`, `WARMUP_S` (30), `MEASURE_S` (60), `ASSET`,
`THINK_S`, `PATH_LABEL`, `LOAD_ZONE` (def. `amazon:us:ashburn`), `TEST_NAME`, `SUMMARY_OUT`.
DIRECT-ORIGIN: `PUBLIC_HOST` + `ORIGIN_IP` (conserva Host/SNI vía `hosts`; no versionar la IP).
Las métricas de la ventana útil llevan el tag `phase:measure`.

## Instalar k6 (generador externo, no producción)
Repo oficial: https://grafana.com/docs/k6/latest/set-up/install-k6/ (o binario de https://github.com/grafana/k6/releases, verificando checksum).

## Ejecutar
1. Autenticación (fuera de git): `k6 cloud login` (guarda en `~/.config/k6`), o variables `K6_CLOUD_TOKEN` + `K6_CLOUD_STACK_ID`.
   Las dos variables deben venir juntas: si solo hay una, el recolector falla (no cae al config). Sin ninguna, `collect-results.py`
   usa como fallback `~/.config/k6/config.json` (lee solo token y stackID, una vez por proceso; nunca se imprimen).
2. Zonas disponibles en el stack: `k6 cloud load-zone list`.
3. Un escalón: `k6 cloud run -e SCENARIO=page-bundle -e VUS=25 -e LOAD_ZONE="amazon:br:sao paulo" tests/load/sim-load.js`.
4. Matriz completa o reducida: `python3 tests/load/run-matrix.py --plan full|geo --zone "amazon:us:ashburn"`.
   Aborta ante 5xx, 403/429/503, error >1 %, p95 >6× el del escalón de 1 VU (y >1 s) o run no `passed`.
   Siempre usa `k6 cloud run` (sin ejecución local de reserva). Termina con código distinto de cero si: `k6 cloud run` no devuelve run ID (2),
   el run no llega a `completed` (3), `result != passed` (4), salta una condición de aborto (5), o la zona informada por Grafana
   difiere de la solicitada (6; se registra la discrepancia). Si el archivo de resultados ya existe, falla (2) salvo con `--append`:
   así no se mezclan benchmarks de fechas distintas.
5. Comparar zonas: `python3 tests/load/run-matrix.py --compare tests/load/results/*.jsonl`.

`k6 cloud run` no imprime el resumen de métricas; `collect-results.py <run_id>` lo lee de la API (salida redactada).
Métricas de la ventana `phase:measure` guardadas por run, además de p50/p95/p99 de duración y TTFB, códigos HTTP y `Cf-Cache-Status`:
- `http_req_failed_rate` (+ `http_req_failed_count`): métrica Rate de k6, que incluye errores de transporte. Se calcula como passes/count porque la consulta `rate` de la API devuelve 0.0 aunque haya fallos (valor crudo en `http_req_failed_rate_api`, no fiable). Es distinta de `err_pct`, calculado a partir de los códigos HTTP.
- `checks_rate`, `checks_total`, `checks_passed`, `checks_failed`.
- `data_measure_est` y `data_measure_est_per_s`: ESTIMACIONES. `data_received` no lleva tag de fase; el total del run se prorratea por peticiones de la fase `measure`.

Limitación: `iteration_duration` por fase no quedó disponible en el baseline SIM-LOAD-1; las iteraciones útiles se contabilizan mediante
`iters_by_phase`. Añadir una métrica dinámica de duración requeriría instrumentación adicional del harness.

Alcance: PUBLIC-CDN solamente. DIRECT-ORIGIN no se ejecuta salvo autorización segura. True cold cache not measured.
