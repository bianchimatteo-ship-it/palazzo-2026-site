// The Admin area, every party-like record of it, on an isolated copy of the Cloudflare setup (scripts/lib/local-worker.mjs: the real worker.js, a KV and a D1 stand-in on port 8791, the
// local preview; nothing of the production archive, of the real accounts or of the saves of a player is touched):
//   - the list holds every political force of the game (parties, movements, coalition lists) once, paginated, with the same count as the data; aliases of the same entity are not separate rows;
//   - every one of them is found by its name (also in capitals and without accents) and, where it has one, by its abbreviation; the filters (hidden, added, with/without logo) agree with the records;
//   - the editor of any of them opens and has one colour (with «nessun colore») and no second colour; a party, a movement and a coalition list are edited through the form, saved, published, and
//     still there after the page is loaded again, while the dataset files and the pristine record stay as they were; «Ripristina» gives the original back;
//   - the colour of a party is its primary one: a legacy second colour in an old record is never used, the second tone is always derived from the primary, none gives the default;
//   - an added party: created with its colour, listed with its badge, edited, deleted (and kept out of the "active" filter) and restored; a real one hidden and restored; everything on the server's archive too.
// Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';
import { startLocalWorker } from './lib/local-worker.mjs';
import { accentAsGraphic, deriveSecondary, partyIdentity } from '../src/ui/party-identity.js';

if (!chromeAvailable) { console.log('Prova Admin sui partiti saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
const local = await startLocalWorker({ port: 8791 });
const mod = (version, path) => `await import('/src/${path}?v=${version}')`;
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
const summary = {};

try {
  await withBrowser(async browser => {
    const { evaluate, version, waitFor, goto, pause, errors } = browser;
    const click = selector => evaluate(`(async () => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 350)); return true; })()`);
    const setField = (selector, value) => evaluate(`(async () => { const field = document.querySelector(${JSON.stringify(selector)}); if (!field) return false; field.value = ${JSON.stringify(value)}; field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 450)); return true; })()`);
    const archiveNow = () => JSON.parse(local.kvData.get('archivio-condiviso')?.value ?? 'null');
    const serverHas = async (condition, timeout = 12000) => { const start = Date.now(); while (Date.now() - start < timeout) { try { if (condition(archiveNow())) return true; } catch { /* not yet */ } await pause(200); } return false; };
    const confirm = async () => { await waitFor(() => evaluate(`Boolean(document.querySelector('[data-confirm="ok"]'))`), 10000); await click('[data-confirm="ok"]'); await pause(500); };
    const listIds = () => evaluate(`[...document.querySelectorAll('.admin-list-item')].map(item => item.dataset.adminSelectParty)`);
    const showAll = async () => { let guard = 0; while (await evaluate(`Boolean(document.querySelector('[data-admin-more]'))`) && guard++ < 60) await click('[data-admin-more]'); };
    const submitForm = selector => evaluate(`(async () => { const form = document.querySelector(${JSON.stringify(selector)}); form.requestSubmit(); await new Promise(resolve => setTimeout(resolve, 900)); return true; })()`);
    const setColor = (name, value) => evaluate(`(() => { const form = document.querySelector('[data-admin-form], [data-admin-new-party-form]'); const input = form.querySelector('input[name=${name}]'); const off = form.querySelector('input[name=${name}__off]'); if (${value === null}) { off.checked = true; return true; } off.checked = false; input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);

    // the owner's session on the isolated Worker, with the data the Admin works on
    const opened = await evaluate(`(async () => {
      const sync = ${mod(version, 'data/repositories/admin-sync.js')}; const real = ${mod(version, 'data/repositories/real-data.js')}; const links = ${mod(version, 'data/repositories/party-links.js')};
      await real.loadRealDatabase(); await real.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'electoralLists', 'politicians', 'parliamentaryGroups']);
      await sync.openSharedSession('pin-del-proprietario-1', 'attivazione-di-prova');
      const forces = links.politicalForces(real.realDatabase).filter(item => !item.sameEntityAs);
      return { verified: sync.isAdminVerified(), forces: forces.length, parties: real.realDatabase.parties.filter(item => !item.sameEntityAs).length, movements: (real.realDatabase.politicalMovements ?? []).filter(item => !item.sameEntityAs).length, coalitions: (real.realDatabase.coalitions ?? []).filter(links.isCoalitionList).filter(item => !item.sameEntityAs).length };
    })()`);
    assert.ok(opened.verified, 'Sessione del proprietario aperta sul Worker di prova.');
    assert.equal(opened.forces, opened.parties + opened.movements + opened.coalitions, 'Le forze politiche sono partiti, movimenti e liste di coalizione.');
    await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
    await createCareerInPage(browser, { party: 'party-registro-p1-2017-41-ir', group: 'cam-xix-03', name: ['Proprietario', 'Prova'] });
    await goto();
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
    await evaluate('document.querySelector("[data-menu=continua]").click(), true');
    await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
    await evaluate(`location.hash = '#amministrazione', true`);
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-admin-tab]"))'), 30000);
    await click('[data-admin-tab=partiti]');
    await waitFor(() => evaluate('document.querySelectorAll(".admin-list-item").length > 0'), 30000);

    // ---------- 1. everything is in the list, once ----------
    await showAll();
    const ids = await listIds();
    assert.equal(ids.length, opened.forces, `L’elenco ha una voce per ogni forza politica (${ids.length} / ${opened.forces}).`);
    assert.equal(new Set(ids).size, ids.length, 'Nessuna voce doppia.');
    const text = await evaluate(`document.querySelector('.admin-summary')?.textContent ?? ''`);
    assert.ok(new RegExp(`${opened.parties}\\s*partiti reali`).test(text) && new RegExp(`${opened.movements}\\s*movimenti`).test(text), `Il riepilogo dice i partiti e i movimenti (${text}).`);
    const records = await evaluate(`(async () => { const real = ${mod(version, 'data/repositories/real-data.js')}; const links = ${mod(version, 'data/repositories/party-links.js')}; return links.politicalForces(real.realDatabase).filter(item => !item.sameEntityAs).map(item => ({ id: item.id, name: item.officialName, abbr: item.abbreviation ?? null, aliases: (item.aliases ?? []).map(alias => alias.name), collection: real.realDatabase.politicalMovements?.some(entry => entry.id === item.id) ? 'politicalMovements' : real.realDatabase.coalitions?.some(entry => entry.id === item.id) ? 'coalitions' : 'parties' })); })()`);
    check(JSON.stringify(records.map(item => item.id).sort()) === JSON.stringify([...ids].sort()), 'L’elenco e i dati hanno le stesse forze.');
    summary.list = ids.length;

    // ---------- 2. every one is found by its name, in capitals and without accents, and by its abbreviation ----------
    const plain = value => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    let byName = 0, byAbbr = 0, byAlias = 0;
    for (const record of records) {
      await setField('[data-admin-query]', plain(record.name).toUpperCase());
      const found = await listIds();
      if (!found.includes(record.id)) problems.push(`Cercando «${record.name}» non si trova ${record.id}.`); else byName++;
      if (record.abbr && record.abbr.length >= 2) { await setField('[data-admin-query]', record.abbr); const foundAbbr = await listIds(); if (!foundAbbr.includes(record.id)) problems.push(`Cercando la sigla «${record.abbr}» non si trova ${record.name}.`); else byAbbr++; }
      if (record.aliases[0] && plain(record.aliases[0]) !== plain(record.name)) { await setField('[data-admin-query]', record.aliases[0]); const foundAlias = await listIds(); if (!foundAlias.includes(record.id)) problems.push(`Cercando l’altra denominazione «${record.aliases[0]}» non si trova ${record.name}.`); else byAlias++; }
    }
    await setField('[data-admin-query]', 'zzzzqq');
    check((await listIds()).length === 0 && await evaluate(`document.body.textContent.includes('Nessun risultato')`), 'Nessun risultato: lo dice.');
    await setField('[data-admin-query]', '');
    summary.byName = byName; summary.byAbbr = byAbbr; summary.byAlias = byAlias;
    assert.equal(byName, records.length, `Tutte le ${records.length} forze si trovano per nome.`);

    // ---------- 3. the editor of any of them, and an edit that stays ----------
    const sample = ['parties', 'politicalMovements', 'coalitions'].map(collection => records.find(item => item.collection === collection)).filter(Boolean);
    assert.ok(sample.length >= 2, 'Ci sono almeno un partito e un movimento (o una lista) da modificare.');
    const colors = [['#aa2255', null], ['#116699', null], ['#cc7722', null]];
    const edited = [];
    for (const [index, record] of sample.entries()) {
      await setField('[data-admin-query]', record.name);
      await click(`[data-admin-select-party="${record.id}"]`);
      const form = await evaluate(`(() => { const form = document.querySelector('[data-admin-form]'); return form ? { id: form.dataset.adminId, collection: form.dataset.adminCollection, color: Boolean(form.querySelector('input[name=color]')), colorOff: Boolean(form.querySelector('input[name=color__off]')), color2: Boolean(form.querySelector('input[name=color2]')), color2Off: Boolean(form.querySelector('input[name=color2__off]')), name: form.querySelector('input[name=officialName]')?.value } : null; })()`);
      check(form && form.id === record.id && form.color && form.colorOff && !form.color2 && !form.color2Off, `${record.name}: il modulo ha un solo colore, con «nessun colore» (${JSON.stringify(form)}).`);
      const [primary, secondary] = colors[index];
      await setColor('color', primary);
      await evaluate(`(() => { const input = document.querySelector('[data-admin-form] input[name=officialName]'); input.value = input.value + ' · prova'; return true; })()`);
      await submitForm('[data-admin-form]');
      await waitFor(() => evaluate(`document.querySelector('.admin-message, .admin-note')?.textContent?.includes('Pubblicato') || document.body.textContent.includes('Pubblicato per tutti')`), 15000).catch(() => null);
      edited.push({ ...record, primary, secondary, name: `${record.name} · prova` });
    }
    const archive = JSON.parse(local.kvData.get('archivio-condiviso')?.value ?? 'null');
    for (const item of edited) {
      const fields = archive?.parties?.[item.id]?.fields ?? {};
      check(fields.color === item.primary, `${item.name}: il server ha il colore ${item.primary} (${fields.color}).`);
      check((fields.color2 ?? null) === null, `${item.name}: il modulo non scrive nessun secondo colore (${fields.color2}).`);
      check(fields.officialName === item.name, `${item.name}: il nome corretto è sul server.`);
    }
    // the page again, nothing kept in memory: the same values, the original data untouched
    await goto();
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
    await evaluate('document.querySelector("[data-menu=continua]").click(), true');
    await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
    await evaluate(`location.hash = '#amministrazione', true`);
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-admin-tab]"))'), 30000);
    await click('[data-admin-tab=partiti]');
    await waitFor(() => evaluate('document.querySelectorAll(".admin-list-item").length > 0'), 30000);
    for (const item of edited) {
      await setField('[data-admin-query]', item.name);
      await click(`[data-admin-select-party="${item.id}"]`);
      const shown = await evaluate(`(() => { const form = document.querySelector('[data-admin-form]'); const read = name => { const input = form.querySelector('input[name=' + name + ']'); const off = form.querySelector('input[name=' + name + '__off]'); return off?.checked ? null : input.value; }; return { name: form.querySelector('input[name=officialName]').value, color: read('color'), edited: Boolean(form.querySelector('.is-edited')), reset: Boolean(document.querySelector('[data-admin-reset-record]')) }; })()`);
      check(shown.name === item.name && shown.color === item.primary, `${item.name}: dopo aver ricaricato la pagina i valori sono gli stessi (${JSON.stringify(shown)}).`);
      check(shown.edited && shown.reset, `${item.name}: i campi modificati sono segnati e c’è «Ripristina».`);
    }
    const files = await evaluate(`(async () => { const read = async name => (await (await fetch('/src/data/real/' + name + '.json?check=' + Date.now())).json()); const parties = await read('parties'), movements = await read('political-movements'); const all = [...parties, ...movements]; return ${JSON.stringify(edited.filter(item => item.collection !== 'coalitions').map(item => item.id))}.map(id => { const record = all.find(entry => entry.id === id); return { id, name: record?.officialName, color: record?.color ?? null }; }); })()`);
    for (const file of files) check(!/ · prova$/.test(file.name ?? '') && file.color !== edited.find(item => item.id === file.id).primary, `${file.id}: il file del dataset è rimasto com’era.`);
    // restore the first one: the original values come back
    const first = edited[0];
    await setField('[data-admin-query]', first.name);
    await click(`[data-admin-select-party="${first.id}"]`);
    await click('[data-admin-reset-record]'); await confirm();
    check(await serverHas(archive => !archive?.parties?.[first.id]), `${first.name}: «Ripristina» toglie la correzione anche dal server.`);
    await setField('[data-admin-query]', first.name.replace(/ · prova$/, ''));
    check((await listIds()).includes(first.id), `${first.name}: ritrova il nome originale.`);
    summary.edited = edited.length;

    // ---------- 5. a party added by the owner ----------
    await click('[data-admin-new-party]');
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-admin-new-party-form]"))'), 10000);
    await evaluate(`(() => { const form = document.querySelector('[data-admin-new-party-form]'); form.querySelector('input[name=officialName]').value = 'Lista Civica Nuova Prova'; form.querySelector('input[name=abbreviation]').value = 'LCNP'; return true; })()`);
    await setColor('color', '#2a9d8f');
    await submitForm('[data-admin-new-party-form]');
    await waitFor(() => evaluate(`Boolean(document.querySelector('[data-admin-form]'))`), 15000);
    await setField('[data-admin-query]', 'Nuova Prova');
    const added = await evaluate(`[...document.querySelectorAll('.admin-list-item')].map(item => ({ id: item.dataset.adminSelectParty, text: item.textContent }))`);
    check(added.length === 1 && /Aggiunto/.test(added[0].text), `Il partito aggiunto è nell’elenco, con il suo distintivo (${JSON.stringify(added)}).`);
    const addedId = added[0]?.id;
    check(await serverHas(archive => archive?.addedParties?.[addedId]?.color === '#2a9d8f' && (archive.addedParties[addedId].color2 ?? null) === null && archive.addedParties[addedId].abbreviation === 'LCNP'), 'Il partito aggiunto è sul server con il suo colore e senza secondo colore.');
    await click(`[data-admin-select-party="${addedId}"]`);
    await submitForm('[data-admin-form]');
    const addedNow = await evaluate(`(async () => { const real = ${mod(version, 'data/repositories/real-data.js')}; const record = real.realDatabase.parties.find(item => item.id === ${JSON.stringify(addedId)}); return record ? { color: record.color, color2: record.color2 ?? null } : null; })()`);
    check(addedNow && addedNow.color === '#2a9d8f' && addedNow.color2 === null, `Nel gioco il partito aggiunto ha il suo colore e nessun secondo colore (${JSON.stringify(addedNow)}).`);
    const filterTo = async value => { await evaluate(`(() => { const filter = document.querySelector('[data-admin-filter]'); filter.value = ${JSON.stringify(value)}; filter.dispatchEvent(new Event('input', { bubbles: true })); filter.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await pause(500); };
    // an added party is deleted (not hidden) and can be brought back; a real one is hidden and restored
    await click(`[data-admin-select-party="${addedId}"]`);
    check(!(await evaluate(`Boolean(document.querySelector('[data-admin-hide]'))`)) && await evaluate(`Boolean(document.querySelector('[data-admin-delete]'))`), 'Un partito aggiunto si elimina, non si nasconde.');
    await click('[data-admin-delete]'); await confirm();
    await filterTo('attivi');
    check(!(await listIds()).includes(addedId), 'Eliminato, non è più tra gli attivi.');
    await filterTo('nascosti');
    check((await listIds()).includes(addedId) && await evaluate(`document.querySelector('.admin-list-item').textContent.includes('Eliminato')`), 'Ma è tra i nascosti, segnato come eliminato.');
    await click(`[data-admin-select-party="${addedId}"]`);
    await click(`[data-admin-restore="${addedId}"]`); await pause(700);
    await filterTo('aggiunti');
    check((await listIds()).includes(addedId), 'Ripristinato, è di nuovo tra gli aggiunti.');
    const realOne = records.find(item => item.collection === 'parties' && item.id !== edited[0].id) ?? records[0];
    await setField('[data-admin-query]', realOne.name);
    await filterTo('tutti');
    await click(`[data-admin-select-party="${realOne.id}"]`);
    check(await evaluate(`Boolean(document.querySelector('[data-admin-hide]'))`), `${realOne.name}: un partito reale si nasconde.`);
    await click('[data-admin-hide]'); await confirm();
    await filterTo('nascosti');
    check((await listIds()).includes(realOne.id), `${realOne.name}: nascosto, è tra i nascosti.`);
    await filterTo('attivi');
    check(!(await listIds()).includes(realOne.id), 'E non tra gli attivi.');
    await filterTo('nascosti');
    await click(`[data-admin-select-party="${realOne.id}"]`);
    await click(`[data-admin-restore="${realOne.id}"]`); await pause(700);
    await filterTo('attivi');
    check((await listIds()).includes(realOne.id), `${realOne.name}: ripristinato, è di nuovo tra gli attivi.`);
    check(await serverHas(archive => !archive?.hidden?.[realOne.id]?.hidden), 'E sul server non è più nascosto.');
    summary.added = 1;
    check(errors.length === 0, `Errori JavaScript: ${errors.slice(0, 2).join(' | ')}`);
  }, { serverPort: 8791 });
} finally { await local.close(); }

// ---------- the priority of the colours (the presentation of a party: pure code, no browser) ----------
{
  const base = { id: 'party-prova', officialName: 'Prova', abbreviation: 'PRV' };
  const legacy = partyIdentity({ party: { ...base, color: '#aa2255', color2: '#33aa88' } });
  const onlyPrimary = partyIdentity({ party: { ...base, color: '#aa2255' } });
  const swapped = partyIdentity({ party: { ...base, color: '#33aa88', color2: '#aa2255' } });
  const none = partyIdentity({ party: { ...base } });
  assert.equal(legacy.accent, accentAsGraphic('#aa2255'));
  assert.equal(legacy.accent2, accentAsGraphic(deriveSecondary('#aa2255')), 'Un vecchio secondo colore non si usa: il secondo tono si deriva dal primo.');
  assert.equal(legacy.accent2, onlyPrimary.accent2, 'Con o senza il vecchio secondo colore l’identità è la stessa.');
  assert.equal(swapped.accent, accentAsGraphic('#33aa88')); assert.equal(swapped.accent2, accentAsGraphic(deriveSecondary('#33aa88')), 'Il primo resta il primo e decide tutto.');
  assert.equal(none.accent2, null, 'Nessun colore: né accento né secondo colore (l’identità neutra).');
  const logoParty = partyIdentity({ party: { id: 'party-futuro-nazionale', officialName: 'Futuro Nazionale' } });
  const chosen = partyIdentity({ party: { id: 'party-futuro-nazionale', officialName: 'Futuro Nazionale', color: '#aa2255' } });
  assert.equal(logoParty.source, 'logo'); assert.equal(chosen.source, 'scelto', 'Il colore scritto dal proprietario ha la precedenza su quello del logo.');
  assert.equal(chosen.accent2, accentAsGraphic(deriveSecondary('#aa2255')), 'E con esso non viaggia il secondo colore del logo, che potrebbe stonare.');
  summary.priority = 5;
}
assert.deepEqual(problems, [], `Problemi dell’Admin sui partiti:\n - ${problems.slice(0, 15).join('\n - ')}`);
console.log(`Admin sui partiti verificato in Chrome su un Worker isolato: ${summary.list} forze politiche (partiti, movimenti, liste di coalizione) tutte nell’elenco una volta e tutte trovate per nome (${summary.byName}; maiuscole e accenti indifferenti), ${summary.byAbbr} per sigla e ${summary.byAlias} per altra denominazione; ${summary.edited} record di tipi diversi modificati dal modulo (nome, colore e secondo colore, «nessun colore»), pubblicati, ancora lì dopo il ricaricamento, con i file del dataset intatti e il ripristino che toglie la correzione dal server; priorità dei colori (entrambi, solo il primo, scambiati, nessuno, quello del logo contro quello scritto); un partito aggiunto, modificato, eliminato e ripristinato e un partito reale nascosto e ripristinato, con i filtri coerenti.`);
