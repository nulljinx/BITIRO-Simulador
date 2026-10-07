// Cliente mínimo de Chrome DevTools Protocol (sin dependencias): lanza Chrome, abre una sesión de página y expone send/on.
// Ciclo de vida: cada launch() es dueño SOLO del ChildProcess que creó (nunca busca procesos por nombre). close() es idempotente.
// Limitación conocida: no instala manejadores de SIGINT/SIGTERM del proceso padre; un Ctrl-C sobre Node no emite 'exit' y puede dejar Chrome vivo.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const base = path.join(os.homedir(), '.cache/ms-playwright');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort() : [];
  for (const d of dirs.reverse()) {
    const p = path.join(base, d, 'chrome-linux64/chrome');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No se encontró Chrome/Chromium: define CHROME_BIN.');
}

export async function launch({ headed = false, port = 9340, extraArgs = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-perf-'));
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--disable-extensions', '--disable-sync', '--metrics-recording-only', '--window-size=1366,768',
    ...(headed ? [] : ['--headless=new']), ...extraArgs, 'about:blank'];
  const proc = spawn(findChrome(), args, { stdio: ['ignore', 'ignore', 'ignore'] });
  // Si el script padre termina (p. ej. por una excepción) sin haber llamado a close(), no deja este Chrome huérfano. close() lo quita.
  const onParentExit = () => { try { proc.kill('SIGKILL'); } catch {} };
  process.once('exit', onParentExit);
  const hasExited = () => proc.exitCode !== null || proc.signalCode !== null;
  // true si el proceso termina dentro de `ms`; false si sigue vivo.
  const waitExit = (ms) => new Promise((resolve) => {
    if (hasExited()) return resolve(true);
    let t; const onExit = () => { clearTimeout(t); resolve(true); };
    t = setTimeout(() => { proc.removeListener('exit', onExit); resolve(false); }, ms);
    proc.once('exit', onExit);
  });
  // Terminación escalonada de ESTE ChildProcess: SIGTERM, espera breve y, si sigue vivo, SIGKILL y espera.
  const terminate = async () => {
    if (hasExited()) return true;
    try { proc.kill('SIGTERM'); } catch {}
    if (await waitExit(2000)) return true;
    try { proc.kill('SIGKILL'); } catch {}
    return waitExit(2000);
  };
  // Termina si hace falta, borra el perfil temporal (con reintentos) y, si el proceso ya no existe, quita el listener de salida del padre.
  const finish = async () => {
    if (!hasExited()) await terminate();
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
    if (hasExited()) process.removeListener('exit', onParentExit);
  };
  let version;
  for (let i = 0; i < 50 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!version) { await finish(); throw new Error('Chrome no respondió en el puerto de depuración.'); }
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  try { await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('fallo al abrir el WebSocket CDP')); }); }
  catch (e) { await finish(); throw e; }
  let id = 0; const pending = new Map(); const listeners = new Set();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) for (const l of listeners) l(m);
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  // Registra un listener de eventos CDP (de cualquier sesión) y devuelve la función que lo desregistra.
  const on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  // Cierre ordenado e idempotente: 1) Browser.close, 2) cerrar el WebSocket, 3) esperar la salida (3 s), 4–7) si sigue vivo SIGTERM → espera → SIGKILL → espera,
  // 8) borrar el perfil temporal (si no se espera la salida, Chrome aún escribe y rmSync falla con ENOTEMPTY), 9) quitar el listener de salida del padre.
  let closing = null;
  const close = () => (closing ??= (async () => {
    let t; const timeout = new Promise((r) => { t = setTimeout(r, 2000); });
    await Promise.race([send('Browser.close').catch(() => {}), timeout]); clearTimeout(t);
    try { ws.close(); } catch {}
    await waitExit(3000);
    await finish();
  })());
  return { send, on, close, version, pid: proc.pid };
}

// Sesión de una pestaña nueva (flatten) con helpers.
export async function newPage(browser) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p = {}) => browser.send(m, p, sessionId);
  const handlers = new Map();
  const unsubscribe = browser.on((m) => { if (m.sessionId === sessionId) for (const h of handlers.get(m.method) || []) h(m.params); });
  const on = (method, h) => { if (!handlers.has(method)) handlers.set(method, []); handlers.get(method).push(h); };
  // Idempotente: cierra el target (tolerando que ya no exista) y siempre quita el listener del navegador y los handlers de la página.
  let closed = false;
  const close = async () => {
    if (closed) return; closed = true;
    try { await browser.send('Target.closeTarget', { targetId }); } catch {}
    finally { unsubscribe(); handlers.clear(); }
  };
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evaluate: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  return { send, on, evaluate, close, targetId, sessionId };
}
