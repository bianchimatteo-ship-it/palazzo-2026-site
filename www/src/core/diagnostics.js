// A small diagnostic record kept on the device (never sent anywhere): the last errors the page raised, with the page and the last button pressed. It exists so that a button that «does nothing» or an app that
// «freezes» leaves a trace the player can copy and send with a report (Impostazioni → Dati di gioco → Copia il registro diagnostico), and so that an error in an action is never silent: the game says the action did not
// complete instead of leaving a dead button. Only the technical message, the page and the name of the control are kept: no save, no account, no personal text.
const KEY = 'politicando.diag.v1', MAX = 30;
const read = () => { try { const list = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]'); return Array.isArray(list) ? list : []; } catch { return []; } };
let last = { control: null, at: 0 };
export function noteControl(element) {
  const dataset = element?.dataset ? Object.entries(element.dataset).slice(0, 3).map(([k, v]) => `${k}=${String(v).slice(0, 30)}`).join(' ') : '';
  last = { control: `${element?.tagName?.toLowerCase() ?? '?'}${dataset ? ` ${dataset}` : ''}`, at: Date.now() };
}
export function recordError(kind, error, context = {}) {
  const entry = { at: new Date().toISOString(), kind, message: String(error?.message ?? error ?? '').slice(0, 300), stack: String(error?.stack ?? '').split('\n').slice(0, 4).join(' | ').slice(0, 400), page: String(globalThis.location?.hash ?? '').slice(0, 40), control: Date.now() - last.at < 5000 ? last.control : null, ...context };
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify([...read(), entry].slice(-MAX))); } catch { /* no storage: the toast still says it */ }
  return entry;
}
export const diagnosticLog = () => read();
export const clearDiagnostics = () => { try { globalThis.localStorage?.removeItem(KEY); } catch { /* ignored */ } };
export const diagnosticText = () => `Politicando 2026 · registro diagnostico\n${read().map(item => `${item.at} [${item.kind}] ${item.page} ${item.control ?? ''}\n  ${item.message}\n  ${item.stack}`).join('\n') || '(nessun errore registrato)'}`;
// Listens to the errors nobody caught (a rejected promise of a click handler, an exception of a handler): records them and calls `onError(entry)` so the page can tell the player.
export function watchErrors(onError, { target = globalThis } = {}) {
  let lastToast = 0;
  const handle = (kind, error) => { const entry = recordError(kind, error); if (Date.now() - lastToast > 4000) { lastToast = Date.now(); onError?.(entry); } };
  target.addEventListener?.('error', event => handle('errore', event.error ?? event.message));
  target.addEventListener?.('unhandledrejection', event => handle('promessa', event.reason));
  target.document?.addEventListener?.('pointerdown', event => noteControl(event.target.closest?.('button,a,[data-action],[data-nav],summary') ?? event.target), true);
}
