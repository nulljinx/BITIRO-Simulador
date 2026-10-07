// Cliente mínimo de Chrome DevTools Protocol (sin dependencias): lanza Chrome, abre una sesión de página y expone send/on.
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
  let version;
  for (let i = 0; i < 50 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!version) { proc.kill(); throw new Error('Chrome no respondió en el puerto de depuración.'); }
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('fallo al abrir el WebSocket CDP')); });
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
  const close = async () => { try { await send('Browser.close'); } catch {} try { ws.close(); } catch {} proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); };
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
