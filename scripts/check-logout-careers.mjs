// ESCI nasconde tutte le carriere e il nuovo accesso le ritrova, in Chrome contro il Worker locale (stand-in isolati, nulla di reale): con una carriera attiva e modifiche non salvate
// il logout le protegge e nulla viene eliminato; da disconnessi non compare nessuna carriera (né nelle schermate né dopo il ricaricamento); un altro account non vede né sincronizza
// quelle del precedente; con lo stesso account tornano tutte, comprese quelle online; una sessione scaduta e un'uscita fatta in un'altra scheda si comportano allo stesso modo.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Uscita e carriere nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
globalThis.location = new URL('http://127.0.0.1:8791/');
const client = await import('../src/data/repositories/account-sync.js');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8791 });
let ipCounter = 40;
const registerApi = async (username, password) => {
  const proof = await client.passwordProof(username, password);
  const response = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ipCounter}` }, body: JSON.stringify({ username, proof }) }), local.env);
  assert.equal(response.status, 201);
};
const saves = name => local.sqlite.prepare('SELECT s.slot AS slot, s.revision AS revision FROM saves s JOIN users u ON u.id = s.user_id WHERE u.username = ?').all(name);
await registerApi('uscita.a', 'password-di-a');
await registerApi('uscita.b', 'password-di-b');

await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
  const fill = (form, values) => evaluate(`(() => { const form = document.querySelector('[data-account-form="${form}"]'); for (const [name, value] of Object.entries(${JSON.stringify(values)})) form[name].value = value; form.requestSubmit(); return true; })()`);
  const stored = key => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}) || 'null')`);
  const inStore = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const openAccount = async () => { if (await has('[data-account-form="login"], [data-account-action="refresh"]')) return; await wait(() => has('[data-menu="account"]')); await click('[data-menu="account"]'); await pause(150); };
  const slotRows = () => evaluate(`document.querySelectorAll('[data-slot-row]').length`);
  const careers = () => inStore(`return store.careerIdsOnDevice().sort();`);
  const running = () => inStore(`return store.hasCareer() ? { id: store.getState().career.id, week: store.getState().game.week.index } : null;`);
  const showsCareer = () => evaluate(`Boolean(document.querySelector('.menu-continue, .page-wrap, [data-slot-row]'))`);
  const openLoad = async () => { if (!(await has('.slot-list, [data-protected-saves], [data-slot-row]'))) { await click('[data-menu="carica"]'); await pause(250); } };

  // ---------- two careers on the device: the first in a slot, the second running ----------
  await createCareerInPage({ evaluate, version }, { weeks: 1, name: ['Primo', 'Uno'] });
  await inStore(`store.saveToSlot('Prima carriera', null, { manual: true }); return true;`);
  await createCareerInPage({ evaluate, version }, { weeks: 2, name: ['Secondo', 'Due'] });
  await goto('');
  await wait(() => has('[data-menu="nuova"]:not([disabled])'));
  const both = await careers();
  assert.ok(both.length >= 2, 'Sul dispositivo ci sono due carriere.');
  await openAccount();
  await fill('login', { username: 'uscita.a', password: 'password-di-a' });
  await wait(() => has('[data-isolation="unlinked"]'));
  await click('[data-account-action="link"]');
  await wait(() => has('[data-sync-status="synced"]'));
  assert.equal(saves('uscita.a').length, 1, 'La carriera in corso è online sull’account A.');
  // unsaved changes at the moment of leaving
  await inStore(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ ...(JSON.parse(localStorage.getItem('politicando.settings.v1') || '{}')), autosave: 'manual' })); return true;`);
  await goto('');
  await wait(() => has('[data-menu="continua"]'));
  await inStore(`store.advanceTurn(2); return true;`);
  const dirty = await inStore(`return store.hasUnsavedChanges();`);
  const before = await running();
  const hallId = before.id;
  await inStore(`localStorage.setItem('politicando.hall.v1', JSON.stringify([{ id: 'hall-prova', careerId: ${JSON.stringify(hallId)}, name: 'Voce di prova', score: 50, tier: { id: 'x', label: 'x' }, endedAt: '2030-01-01' }])); return true;`);
  assert.equal(await inStore(`return store.hallOfFame().length;`), 1, 'La Hall of Fame ha una voce della carriera.');
  const tokenA = (await stored('politicando.account.v1')).token;

  // ---------- 1. ESCI with an active career (and changes not saved): protected, session ended, everything hidden, nothing deleted ----------
  await openAccount();
  await click('[data-account-action="logout"]');
  await wait(() => has('[data-account-form="login"]'));
  assert.equal(await stored('politicando.account.v1'), null, 'La sessione locale è finita.');
  const me = await local.worker.fetch(new Request(`${local.origin}/api/account/me`, { headers: { authorization: `Bearer ${tokenA}` } }), local.env);
  assert.equal(me.status, 401, 'E quella sul server è stata chiusa.');
  assert.equal(await running(), null, 'Lo stato della carriera attiva è azzerato.');
  assert.deepEqual(await careers(), both, 'Nessuna carriera è stata eliminata: ci sono tutte e due.');
  assert.equal(saves('uscita.a').length, 1, 'La copia online resta.');
  assert.equal(await showsCareer(), false, 'Da disconnesso non compare nessuna carriera nella schermata.');
  assert.equal(await inStore(`return store.hallOfFame(() => false).length;`), 0, 'La Hall of Fame filtrata per visibilità è vuota.');
  await goto('');
  await wait(() => has('[data-menu="nuova"]:not([disabled])'));
  assert.equal(await has('[data-menu="continua"], .menu-continue'), false, 'Dopo il ricaricamento la Home non offre nessuna carriera.');
  assert.equal(await running(), null, 'E la carriera non si riapre da sola.');
  await click('[data-menu="carica"]'); await pause(300);
  assert.equal(await slotRows(), 0, 'In «Carica partita» non c’è nessuna carriera.');
  assert.doesNotMatch(await text('[data-protected-saves]'), /\d/, 'Né il loro numero.');
  const hiddenSlot = await inStore(`return store.listSlots()[0]?.id ?? null;`);
  assert.ok(hiddenSlot, 'Gli slot ci sono ancora nel browser.');
  const force = attr => evaluate(`(() => { const host = document.querySelector('.menu-popup-body') ?? document.body; const button = document.createElement('button'); button.setAttribute(${JSON.stringify(attr)}, ${JSON.stringify(hiddenSlot)}); host.append(button); button.click(); button.remove(); return true; })()`);
  await force('data-slot-load'); await pause(300);
  assert.equal(await running(), null, 'Nemmeno forzando il pulsante uno slot si carica.');
  await click('[data-menu="carica"]'); await pause(150);

  // ---------- 2. another account: no career of the first one, nothing synced to it ----------
  await openAccount();
  await fill('login', { username: 'uscita.b', password: 'password-di-b' });
  await wait(() => has('[data-account-action="logout"]'));
  assert.equal(await running(), null, 'L’altro account non trova nessuna carriera in corso.');
  await click('[data-menu="carica"]').catch(() => {}); await pause(300);
  assert.equal(await slotRows(), 0, 'Né negli slot.');
  await force('data-slot-load'); await pause(300);
  assert.equal(await running(), null, 'Forzando il caricamento non cambia nulla.');
  await pause(2500);
  assert.deepEqual(saves('uscita.b'), [], 'Nulla è passato all’account B.');
  assert.equal(saves('uscita.a').length, 1);
  await openAccount();
  await click('[data-account-action="logout"]');
  await wait(() => has('[data-account-form="login"]'));
  assert.deepEqual(await careers(), both, 'Dopo B tutte le carriere sono ancora sul dispositivo.');

  // ---------- 3. the first account signs in again: all its careers are back, the changes too ----------
  await fill('login', { username: 'uscita.a', password: 'password-di-a' });
  await wait(() => has('[data-account-action="logout"]'));
  await wait(async () => (await running()) !== null);
  const back = await running();
  assert.equal(back.id, before.id, 'La carriera che era in corso torna in corso.');
  assert.equal(back.week, before.week, `Con le modifiche non salvate al momento dell’uscita (${dirty ? 'c’erano' : 'autosalvate'}).`);
  assert.equal(await inStore(`return store.hallOfFame(id => id === ${JSON.stringify(hallId)}).length;`), 1, 'La Hall of Fame torna visibile al proprietario.');
  await click('[data-menu="carica"]').catch(() => {}); await pause(300);
  assert.ok((await slotRows()) >= 1, 'Gli slot tornano negli elenchi.');
  await click('[data-menu="carica"]'); await pause(150);
  await openAccount();
  await click('[data-account-action="refresh"]'); await pause(400);
  assert.ok(await evaluate(`document.querySelectorAll('.slot-row').length >= 1`), 'Le carriere online dell’account sono state riletta dal server e mostrate.');

  // ---------- 4. a session that expires hides the careers the same way ----------
  local.sqlite.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = (SELECT id FROM users WHERE username = ?)').run(Date.now() - 1000, 'uscita.a');
  await click('[data-account-action="refresh"]');
  await wait(() => has('[data-account-form="login"]'));
  await wait(async () => (await running()) === null);
  assert.match(await text('.menu-error'), /sessione è scaduta/, 'La sessione scaduta è detta chiaramente.');
  assert.deepEqual(await careers(), both, 'Con la sessione scaduta nulla è stato eliminato.');
  assert.equal(await showsCareer(), false, 'E nessuna carriera compare.');
  await fill('login', { username: 'uscita.a', password: 'password-di-a' });
  await wait(async () => (await running()) !== null);
  assert.equal((await running()).id, before.id, 'Rientrando, la carriera torna.');

  // ---------- 5. a sign-out made in another tab: this tab puts the career away, saved first ----------
  await inStore(`store.advanceTurn(1); return true;`);
  const weekBeforeTab = (await running()).week;
  await evaluate(`(async () => { const { hideCareers } = await import('/src/data/repositories/career-visibility.js?v=${version}'); const { store } = await import('/src/core/store.js?v=${version}'); hideCareers(store.careerIdsOnDevice(), 'uscita.a'); localStorage.removeItem('politicando.account.v1'); window.dispatchEvent(new StorageEvent('storage', { key: 'politicando.account.v1' })); return true; })()`);
  await wait(async () => (await running()) === null);
  assert.equal(await showsCareer(), false, 'Un’uscita fatta in un’altra scheda toglie la carriera anche qui.');
  await fill('login', { username: 'uscita.a', password: 'password-di-a' });
  await wait(async () => (await running()) !== null);
  assert.equal((await running()).week, weekBeforeTab, 'Senza perdere le modifiche fatte in questa scheda.');

  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
}, { serverPort: 8791 });
await local.close();
console.log('Uscita e carriere verificate in Chrome sul Worker locale: ESCI protegge le modifiche non salvate, azzera la carriera attiva e nasconde tutte le carriere senza eliminarne nessuna; da disconnessi nulla è visibile (nemmeno dopo il ricaricamento, né forzando i pulsanti); un altro account non vede né sincronizza quelle del primo; il nuovo accesso ritrova tutte le carriere, le modifiche e quelle online; sessione scaduta e uscita da un’altra scheda si comportano allo stesso modo.');
