// The public page for deleting an account (elimina-account.html): signs in with the proof of the password, asks the Worker to delete the account and everything kept online for it,
// and tells the player what happened. It does not touch any game save; if this browser was signed in to the same account, it forgets the session.
import { PASSWORD_MIN, USERNAME_RULE, accountApiBase, forgetAccountIf, normalizeUsername, passwordProof } from '../data/repositories/account-sync.js?v=20261016-6';

const form = document.querySelector('#delete-form');
const result = document.querySelector('#delete-result');
const submit = document.querySelector('#delete-submit');
const show = (kind, text) => { result.hidden = false; result.className = `result ${kind}`; result.textContent = text; };

async function api(base, path, { method = 'GET', token = null, body = null } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(base + path, { method, signal: controller.signal, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === null ? undefined : JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `Il servizio non ha risposto come previsto (${response.status}).`), { status: response.status });
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Il servizio non risponde: l’account non è stato eliminato. Riprova tra poco.');
    if (error instanceof TypeError) throw new Error('Connessione assente: l’account non è stato eliminato. Riprova quando sei online.');
    throw error;
  } finally { clearTimeout(timer); }
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const username = normalizeUsername(data.username);
  if (!USERNAME_RULE.test(username)) return show('error', 'Nome utente non valido: da 3 a 24 caratteri tra lettere minuscole, numeri, punto, trattino e trattino basso.');
  if (String(data.password ?? '').length < PASSWORD_MIN) return show('error', `La password ha almeno ${PASSWORD_MIN} caratteri.`);
  if (String(data.confirm ?? '').trim() !== 'ELIMINA') return show('error', 'Per confermare scrivi ELIMINA.');
  const base = accountApiBase();
  if (!base) return show('error', 'Il servizio account non è raggiungibile da questo indirizzo: apri questa pagina dal sito del gioco.');
  submit.disabled = true;
  show('', 'Eliminazione in corso…');
  try {
    const proof = await passwordProof(username, data.password);
    const session = await api(base, '/api/account/login', { method: 'POST', body: { username, proof } });
    const done = await api(base, '/api/account', { method: 'DELETE', token: session.token, body: { proof, confirm: 'ELIMINA' } });
    forgetAccountIf(username);
    form.reset();
    show('ok', `Account eliminato: ${done.deleted?.saves ?? 0} salvataggi online e ${done.deleted?.sessions ?? 0} sessioni rimossi. Online non resta nulla di questo account.`);
  } catch (error) {
    show('error', error.status === 401 ? 'Nome utente o password non corretti: l’account non è stato eliminato.' : error.message);
  } finally { submit.disabled = false; }
});
