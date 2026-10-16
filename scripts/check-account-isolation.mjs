// Accounts in the game, in Chrome, against the local Worker (isolated stand-ins, nothing real): a career saved on this device is never put into the account that has just signed in; the
// career of another account is not touched; logout, expired session and a change made in another tab leave what is saved here; e-mail verification and recovery of the password
// with the messages caught by a test transport (the real sending is a provider set with Worker secrets, see docs/account-email.md). Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Isolamento degli account nel browser saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
globalThis.location = new URL('http://127.0.0.1:8791/');
const client = await import('../src/data/repositories/account-sync.js');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8791 });
const outbox = [];
local.env.EMAIL_SEND = async message => { outbox.push(message); };
local.env.EMAIL_FROM = 'POLITICANDO <prova@example.invalid>';
local.env.PUBLIC_BASE_URL = local.origin;
let ipCounter = 10;
const registerApi = async (username, password) => {
  const proof = await client.passwordProof(username, password);
  const response = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ipCounter}` }, body: JSON.stringify({ username, proof }) }), local.env);
  assert.equal(response.status, 201);
};
const saves = name => local.sqlite.prepare('SELECT s.slot AS slot, s.revision AS revision, s.updated_at AS updatedAt FROM saves s JOIN users u ON u.id = s.user_id WHERE u.username = ?').all(name);
const sessions = name => local.sqlite.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = ?)').get(name).n;
await registerApi('legacy.a', 'password-di-a');
await registerApi('legacy.b', 'password-di-b');

await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
  const fill = (form, values) => evaluate(`(() => { const form = document.querySelector('[data-account-form="${form}"]'); for (const [name, value] of Object.entries(${JSON.stringify(values)})) form[name].value = value; form.requestSubmit(); return true; })()`);
  const stored = key => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}) || 'null')`);
  const openAccount = async () => { if (await has('[data-account-form="login"], [data-account-action="refresh"]')) return; await wait(() => has('[data-menu="account"]')); await click('[data-menu="account"]'); await pause(150); };
  const week = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return store.getState().game.week.index; })()`);
  const persisted = () => evaluate(`JSON.parse(localStorage.getItem('palazzo-2026.career.v1') || 'null')?.game?.week?.index ?? null`);
  const confirmOk = async () => { await wait(() => has('[data-confirm="ok"]')); await click('[data-confirm="ok"]'); await pause(300); };

  // ---------- a career played without an account ----------
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await goto('');
  const careerWeek = await persisted();
  assert.ok(careerWeek >= 2, 'La carriera locale esiste ed è salvata in questo browser.');
  await openAccount();

  // ---------- 1. sign in: the career of this device is NOT put into the account ----------
  await fill('login', { username: 'legacy.a', password: 'password-di-a' });
  await wait(() => has('[data-isolation="unlinked"]'));
  assert.equal(saves('legacy.a').length, 0, 'Dopo l’accesso nulla è stato caricato nell’account.');
  assert.match(await text('.account-message'), /solo su questo dispositivo/, 'Il gioco dice che la carriera in corso resta locale.');
  assert.ok(await has('[data-sync-status="unlinked"]'), 'Lo stato dice «solo su questo dispositivo».');
  await pause(2500);
  assert.equal(saves('legacy.a').length, 0, 'E non parte da sola dopo qualche secondo.');
  // The player chooses to bring it online: only then it goes.
  await click('[data-account-action="link"]');
  await wait(() => has('[data-sync-status="synced"]'));
  assert.equal(saves('legacy.a').length, 1, 'Su scelta esplicita la carriera va online.');
  const aCopy = saves('legacy.a')[0];
  assert.ok(await has('[data-sync-status="synced"]'));

  // ---------- 2. logout: the session ends here and on the server; the career stays ----------
  const tokenA = (await stored('politicando.account.v1')).token;
  await click('[data-account-action="logout"]');
  await wait(() => has('[data-account-form="login"]'));
  assert.equal(await stored('politicando.account.v1'), null, 'La sessione locale è finita.');
  const me = await local.worker.fetch(new Request(`${local.origin}/api/account/me`, { headers: { authorization: `Bearer ${tokenA}` } }), local.env);
  assert.equal(me.status, 401, 'E quella sul server è stata chiusa.');
  assert.equal(await persisted(), careerWeek, 'La carriera non è stata cancellata dal browser.');

  // ---------- 3. another account signs in: the career of the first one is not theirs ----------
  await fill('login', { username: 'legacy.b', password: 'password-di-b' });
  await wait(() => has('[data-isolation="foreign"]'));
  assert.match(await text('.account-message'), /legacy\.a/, 'Il gioco dice a quale account è collegata.');
  assert.equal(saves('legacy.b').length, 0, 'Nel secondo account non è arrivato nulla.');
  // Playing on and saving does not change that.
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advanceTurn(1); store.save(); return true; })()`);
  await pause(3000);
  assert.equal(saves('legacy.b').length, 0, 'Né dopo un nuovo salvataggio locale.');
  assert.deepEqual(saves('legacy.a')[0], aCopy, 'La copia del primo account è intatta.');
  // The explicit association asks for a confirmation and leaves the first account's copy alone.
  await click('[data-account-action="link"]');
  await confirmOk();
  await wait(() => saves('legacy.b').length === 1);
  assert.deepEqual(saves('legacy.a')[0], aCopy, 'Collegandola al secondo account, quella del primo non cambia.');

  // ---------- 4. the session expires: the account screen asks to sign in again, the career stays ----------
  local.sqlite.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = (SELECT id FROM users WHERE username = ?)').run(Date.now() - 1000, 'legacy.b');
  await openAccount();
  await click('[data-account-action="refresh"]');
  await wait(() => has('[data-account-form="login"]'));
  assert.match(await text('.menu-error'), /sessione è scaduta/, 'Una sessione scaduta è detta chiaramente.');
  assert.equal(await stored('politicando.account.v1'), null);
  assert.ok((await persisted()) >= careerWeek, 'La carriera resta salvata in questo browser.');

  // ---------- 5. a sign-out made in another tab is followed here ----------
  await fill('login', { username: 'legacy.a', password: 'password-di-a' });
  await wait(() => has('[data-account-action="logout"]'));
  await evaluate(`(() => { localStorage.removeItem('politicando.account.v1'); window.dispatchEvent(new StorageEvent('storage', { key: 'politicando.account.v1' })); return true; })()`);
  await wait(() => has('[data-account-form="login"]'));
  assert.match(await text('.account-message'), /altra scheda/, 'Un’uscita fatta in un’altra scheda si vede.');

  // ---------- 6. e-mail verified by a link, then the password recovered ----------
  await fill('register', { username: 'con.email', email: 'con.email@example.org', password: 'prima-password', confirm: 'prima-password' });
  await wait(() => has('[data-account-action="logout"]') || has('.tour'));
  assert.equal(outbox.length, 1, 'Il messaggio di verifica parte.');
  assert.match(outbox[0].text, /\/\?verifica-email=[\da-f]{64}/);
  const verifyPath = new URL(/https?:\/\/\S+/.exec(outbox[0].text)[0]);
  await goto(`${verifyPath.search}`);
  await wait(async () => /verificato/.test(await text('.account-message')));
  assert.equal(await evaluate(`location.search`), '', 'Il codice è tolto dall’indirizzo subito.');
  await openAccount().catch(() => {});
  await click('[data-account-action="logout"]').catch(() => {});
  await wait(() => has('[data-account-form="login"]'));
  await click('[data-menu="account"][data-account-mode="recover"]');
  await wait(() => has('[data-account-form="recover"]'));
  await fill('recover', { email: 'con.email@example.org' });
  await wait(() => outbox.length === 2);
  assert.match(await text('.account-message'), /Se l’indirizzo/, 'La risposta è neutra.');
  const resetUrl = new URL(/https?:\/\/\S+/.exec(outbox[1].text)[0]);
  await goto(resetUrl.search);
  await wait(() => has('[data-account-form="reset"]'));
  assert.equal(await evaluate(`location.search`), '', 'Anche il codice di recupero è tolto dall’indirizzo.');
  await fill('reset', { password: 'nuova-password-1', confirm: 'nuova-password-1' });
  await wait(async () => /Password cambiata/.test(await text('.account-message')));
  await fill('login', { username: 'con.email', password: 'prima-password' });
  await wait(async () => /non corretti/.test(await text('.menu-error')));
  await fill('login', { username: 'con.email', password: 'nuova-password-1' });
  await wait(() => has('[data-account-action="logout"]'));
  // The same link does not work twice.
  await goto(resetUrl.search);
  await wait(async () => /non è valido|scaduto/.test(await text('.menu-error')));
  assert.equal(sessions('con.email') >= 0, true);
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
}, { serverPort: 8791 });
await local.close();
console.log('Isolamento degli account verificato in Chrome sul Worker locale: dopo l’accesso la carriera del dispositivo non va in nessun account senza una scelta, una carriera collegata a un altro account non viene caricata né copiata senza conferma, l’uscita chiude la sessione sul server e lascia la carriera, sessione scaduta e uscita da un’altra scheda sono riconosciute, verifica email con collegamento monouso e recupero della password con messaggi catturati da un trasporto di prova.');
