// The owner's corrections, from the Admin to the first day of a new career, on an isolated copy of the Cloudflare setup (scripts/lib/local-worker.mjs: the real worker.js, a KV and a D1
// stand-in, the game served on port 8791 as the local preview). Nothing of the production archive, of the real accounts or of the saves of a player is read or written.
//   1. Browser A (the owner, a clean profile): opens the owner session, corrects Futuro Nazionale (name, abbreviation, logo, colour; the old record still carries a legacy second colour that must
//      never show), a second party (name, colour), a politician's name, adds a party, and publishes the archive to the server.
//   2. Browser B (another clean profile: no cache, no storage): starts, reads the published archive, creates a career in Futuro Nazionale; every screen of the career, the reload and the first
//      week carry the corrected name and the colour; the canonical hex value is the one the owner wrote (only the presentation is adapted for contrast).
//   3. The owner changes the colour: a third clean browser has the new one everywhere, with a second tone derived from it, never the legacy second colour nor the logo's own yellow.
//   4. When the server cannot be reached, the copy kept in the browser is used and it is not called updated.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';
import { startLocalWorker } from './lib/local-worker.mjs';
import { LOGO_BRAND } from '../src/data/party-brand.js';
import { accentAsGraphic, deriveSecondary } from '../src/ui/party-identity.js';

if (!chromeAvailable) { console.log('Prova Admin → nuova carriera saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
const FN = 'party-futuro-nazionale', LEGA = 'party-registro-p1-2017-41-ir';
const NEW_NAME = 'Nuova Italia Futura', NEW_ABBR = 'NIF', LEGA_NAME = 'Lega Archivio Prova', PERSON_NAME = 'Giovanna Prova Rossi';
const PRIMARY = '#aa2255', SECONDARY = '#33aa88', LEGA_PRIMARY = '#116699';
// The only colour of a party is the primary one; `SECONDARY` is a legacy value left in an old record and must never show: the second tone is always derived from the primary.
const NEW_PRIMARY = '#2255aa';
const EXPECTED_ACCENT = accentAsGraphic(PRIMARY), EXPECTED_ACCENT2 = accentAsGraphic(deriveSecondary(PRIMARY));
const local = await startLocalWorker({ port: 8791 });
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
const mod = (version, path) => `await import('/src/${path}?v=${version}')`;
let personId = null, personOriginal = null, logoDataUrl = null, publishedAt = null;

try {
  // ---------- 1. the owner ----------
  await withBrowser(async browser => {
    const { evaluate, version, waitFor, goto, pause, errors } = browser;
    const result = await evaluate(`(async () => {
      const store = ${mod(version, 'data/repositories/admin-store.js')}; const sync = ${mod(version, 'data/repositories/admin-sync.js')}; const real = ${mod(version, 'data/repositories/real-data.js')};
      await real.loadRealDatabase(); await real.loadRealCollections(['parties', 'politicalMovements', 'politicians', 'parliamentaryGroups']);
      await sync.openSharedSession('pin-del-proprietario-1', 'attivazione-di-prova');
      if (!sync.isAdminVerified()) return { error: 'sessione non verificata' };
      const pristine = (collection, id) => real.pristineRecord(collection, id) ?? {};
      store.saveRecordOverride('parties', ${JSON.stringify(FN)}, { officialName: ${JSON.stringify(NEW_NAME)}, abbreviation: ${JSON.stringify(NEW_ABBR)}, color: ${JSON.stringify(PRIMARY)} }, pristine('parties', ${JSON.stringify(FN)}));
      store.saveRecordOverride('parties', ${JSON.stringify(LEGA)}, { officialName: ${JSON.stringify(LEGA_NAME)}, color: ${JSON.stringify(LEGA_PRIMARY)} }, pristine('parties', ${JSON.stringify(LEGA)}));
      const person = real.realDatabase.politicians.find(item => item.groupId === 'cam-xix-12' && !item.termEnd) ?? real.realDatabase.politicians[0];
      store.saveRecordOverride('politicians', person.id, { fullName: ${JSON.stringify(PERSON_NAME)} }, real.pristineRecord('politicians', person.id) ?? {});
      const addedId = store.addAdminParty({ officialName: 'Lista Civica di Prova', color: '#2a9d8f' }, real.realDatabase.parties);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96; const g = canvas.getContext('2d'); g.fillStyle = ${JSON.stringify(PRIMARY)}; g.fillRect(0, 0, 96, 96); g.fillStyle = ${JSON.stringify(SECONDARY)}; g.fillRect(0, 48, 96, 48);
      const dataUrl = canvas.toDataURL('image/png');
      const published = await sync.publishSharedArchive({ [${JSON.stringify(FN)}]: { kind: 'data', dataUrl, alt: 'Logo di prova' } });
      return { personId: person.id, personOriginal: person.fullName, dataUrl, updatedAt: published.updatedAt, addedId, status: sync.sharedSyncStatus() };
    })()`);
    assert.ok(!result.error, result.error);
    personId = result.personId; personOriginal = result.personOriginal; logoDataUrl = result.dataUrl; publishedAt = result.updatedAt;
    // the editing form offers one colour (with «nessun colore» for a party that has none) and no second colour
    await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
    // the owner's page, as the owner uses it: the session is already open in this browser tab (sessionStorage), so the reload keeps it
    await createCareerInPage(browser, { party: LEGA, group: 'cam-xix-03', name: ['Proprietario', 'Prova'] });
    await goto();
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
    await evaluate('document.querySelector("[data-menu=continua]").click(), true');
    await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
    await evaluate(`location.hash = '#amministrazione', true`);
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-admin-tab]"))'), 30000).catch(() => null);
    await evaluate(`document.querySelector('[data-admin-tab=partiti]')?.click(), true`);
    await pause(500);
    await evaluate(`document.querySelector('[data-admin-select-party]')?.click(), true`);
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-admin-form]"))'), 20000).catch(() => null);
    const form = await evaluate(`(() => { const form = document.querySelector('[data-admin-form]'); return form ? { color: Boolean(form.querySelector('input[name=color]')), color2: Boolean(form.querySelector('input[name=color2]')), color2Off: Boolean(form.querySelector('input[name=color2__off]')), colorOff: Boolean(form.querySelector('input[name=color__off]')) } : null; })()`);
    check(form?.color && form.colorOff && !form.color2 && !form.color2Off, `Il modulo dell’Admin ha un solo colore, con «nessun colore», e nessun secondo colore (${JSON.stringify(form)}).`);
    check(errors.length === 0, `Errori JavaScript dell’Admin: ${errors.slice(0, 2).join(' | ')}`);
  }, { serverPort: 8791 });
  const stored = JSON.parse(local.kvData.get('archivio-condiviso')?.value ?? 'null');
  check(stored?.parties?.[FN]?.fields?.color === PRIMARY && !stored.parties[FN].fields.color2, 'Il server ha l’archivio con il colore scritto dal proprietario, tale e quale e nessun secondo colore.');
  check(stored?.logos?.[FN]?.dataUrl === logoDataUrl, 'Il server ha il logo.');
  check(Object.keys(stored?.addedParties ?? {}).length === 1 && stored.addedParties[Object.keys(stored.addedParties)[0]].color2 === null, 'Il partito aggiunto è sul server, senza secondo colore.');

  // ---------- 2. a new browser, a new career ----------
  const SCREENS = ['panoramica', 'carriera', 'calendario', 'eventi', 'partito', 'finanze', 'partiti-lista', 'elezioni', 'sondaggi', 'parlamento', 'governo', 'leggi', 'territori', 'notizie', 'politici'];
  await withBrowser(async browser => {
    const { evaluate, version, waitFor, goto, pause, errors } = browser;
    await evaluate(`(async () => { const sync = ${mod(version, 'data/repositories/admin-sync.js')}; return sync.sharedSyncStatus().ok; })()`).then(ok => check(ok === true, 'Il nuovo browser ha letto l’archivio dal server all’avvio.'));
    const seen = await evaluate(`(async () => {
      const real = ${mod(version, 'data/repositories/real-data.js')}; const identity = ${mod(version, 'ui/party-identity.js')}; const brand = ${mod(version, 'data/party-brand.js')};
      await real.loadRealDatabase(); await real.loadRealCollections(['parties', 'politicalMovements', 'politicians', 'parliamentaryGroups']);
      const fn = real.realDatabase.parties.find(item => item.id === ${JSON.stringify(FN)}), lega = real.realDatabase.parties.find(item => item.id === ${JSON.stringify(LEGA)});
      const person = real.realDatabase.politicians.find(item => item.id === ${JSON.stringify(personId)});
      const idFn = identity.partyIdentity({ party: fn }), idLega = identity.partyIdentity({ party: lega });
      return { fn: { name: fn.officialName, abbr: fn.abbreviation, color: fn.color, color2: fn.color2, edited: fn.adminEdited?.fields }, lega: { name: lega.officialName, color: lega.color, color2: lega.color2 }, person: person?.fullName, idFn: { primary: idFn.colors.primary, secondary: idFn.colors.secondary, secondSource: idFn.secondSource, source: idFn.source }, idLega: { primary: idLega.colors.primary, secondary: idLega.colors.secondary, secondSource: idLega.secondSource }, added: real.realDatabase.parties.filter(item => item.adminCreated).map(item => ({ name: item.officialName, color: item.color, color2: item.color2 })) };
    })()`);
    check(seen.fn.name === NEW_NAME && seen.fn.abbr === NEW_ABBR, `Nome e sigla corretti dall’Admin sono quelli della nuova carriera (${seen.fn.name} / ${seen.fn.abbr}).`);
    check(seen.fn.color === PRIMARY, 'Il colore è quello del proprietario.');
    check(seen.idFn.primary === PRIMARY && seen.idFn.secondary !== SECONDARY && seen.idFn.secondSource === 'derivato' && seen.idFn.source === 'scelto', `L’identità conserva l’esadecimale originale e ignora il vecchio secondo colore (${JSON.stringify(seen.idFn)}).`);
    check(seen.lega.name === LEGA_NAME && seen.lega.color === LEGA_PRIMARY && !seen.lega.color2, 'Il secondo record è corretto.');
    check(seen.idLega.primary === LEGA_PRIMARY && seen.idLega.secondSource === 'derivato' && /^#[\da-f]{6}$/.test(seen.idLega.secondary) && seen.idLega.secondary !== LEGA_PRIMARY, `Il secondo tono si ricava sempre dal primo (${JSON.stringify(seen.idLega)}).`);
    check(seen.person === PERSON_NAME, `Il nome del politico corretto è quello dell’archivio di gioco (${seen.person}, prima ${personOriginal}).`);
    check(seen.added.length === 1 && seen.added[0].name === 'Lista Civica di Prova' && seen.added[0].color === '#2a9d8f', 'Il partito aggiunto dal proprietario c’è.');

    await createCareerInPage(browser, { party: FN, group: 'cam-xix-12', onboarding: true });
    const career = await evaluate(`(async () => { const { store } = ${mod(version, 'core/store.js')}; const s = store.getState(); const player = s.world.parties.find(item => item.isPlayer); return { party: s.game.party, force: { label: player?.label, abbreviation: player?.abbreviation, color: player?.color, brandColor: player?.brandColor }, week: s.game.week.index, date: s.clock.currentDate }; })()`);
    const partyLabel = career.party?.label;
    check(partyLabel === NEW_NAME, `Il partito della partita porta il nome corretto (${partyLabel}).`);
    check(career.force.label === NEW_NAME || career.force.abbreviation === NEW_ABBR, `Anche la forza nei sondaggi (${career.force.label} / ${career.force.abbreviation}).`);
    const pass = async label => {
      await goto();
      await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
      const menu = await evaluate(`(() => { const card = document.querySelector('.menu-continue'); return { text: card.textContent.replace(/\\s+/g, ' '), accent: getComputedStyle(card).getPropertyValue('--party-accent').trim(), img: card.querySelector('img')?.getAttribute('src') ?? null }; })()`);
      check(menu.text.includes(NEW_NAME) && !menu.text.includes('Futuro Nazionale'), `${label}: «Continua» mostra il nome corretto (${menu.text.slice(0, 120)}).`);
      check(menu.img === logoDataUrl, `${label}: «Continua» mostra il logo pubblicato dal proprietario.`);
      await evaluate('document.querySelector("[data-menu=continua]").click(), true');
      await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
      for (const page of SCREENS) {
        await evaluate(`location.hash = '#${page}', true`);
        await pause(450);
        const view = await evaluate(`(() => { const shell = document.querySelector('.app-shell'); const text = document.body.innerText; const area = document.querySelector('.page-wrap')?.innerText ?? ''; return { accent: getComputedStyle(shell).getPropertyValue('--party-accent').trim(), accent2: getComputedStyle(shell).getPropertyValue('--party-accent-2').trim(), identity: shell.dataset.identity, hasNew: text.includes(${JSON.stringify(NEW_NAME)}) || text.includes(${JSON.stringify(NEW_ABBR)}), hasOld: /Futuro Nazionale(?! Vannacci)/.test(area), oldAt: [...area.matchAll(/.{0,50}Futuro Nazionale(?! Vannacci).{0,40}/gs)].slice(0, 3).map(match => match[0].replace(/\s+/g, ' ')), overflow: document.documentElement.scrollWidth > innerWidth + 1, page: location.hash }; })()`);
        check(view.identity === 'partito', `${label} · ${page}: l’identità è quella del partito.`);
        check(view.accent === EXPECTED_ACCENT && view.accent2 === EXPECTED_ACCENT2, `${label} · ${page}: accento ${view.accent} / ${view.accent2} invece di ${EXPECTED_ACCENT} / ${EXPECTED_ACCENT2}.`);
        if (page !== 'archivio' && page !== 'politici') check(!view.hasOld, `${label} · ${page}: il vecchio nome «Futuro Nazionale» compare ancora: ${JSON.stringify(view.oldAt)}`);
        check(!view.overflow, `${label} · ${page}: scroll orizzontale.`);
      }
    };
    await pass('prima visita');
    await pass('dopo il ricaricamento');
    // first week: the career plays on and keeps the identity
    await evaluate(`(async () => { const { store } = ${mod(version, 'core/store.js')}; store.advanceTurn(1); return true; })()`);
    const week = await evaluate(`(async () => { const { store } = ${mod(version, 'core/store.js')}; const s = store.getState(); return { index: s.game.week.index, label: s.game.party?.label }; })()`);
    check(week.index === 2 && week.label === NEW_NAME, `Dopo la prima settimana il partito ha ancora il nome corretto (${JSON.stringify(week)}).`);
    check(errors.length === 0, `Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
  }, { serverPort: 8791 });

  // ---------- 3. the owner changes the colour ----------
  await withBrowser(async browser => {
    const { evaluate, version } = browser;
    await evaluate(`(async () => {
      const store = ${mod(version, 'data/repositories/admin-store.js')}; const sync = ${mod(version, 'data/repositories/admin-sync.js')}; const real = ${mod(version, 'data/repositories/real-data.js')};
      await real.loadRealDatabase(); await real.loadRealCollections(['parties']);
      await sync.openSharedSession('pin-del-proprietario-1', '');
      store.setRecordField('parties', ${JSON.stringify(FN)}, 'color', ${JSON.stringify(NEW_PRIMARY)}, real.pristineRecord('parties', ${JSON.stringify(FN)}) ?? {});
      await sync.publishSharedArchive({});
      return true;
    })()`);
  }, { serverPort: 8791 });
  await withBrowser(async browser => {
    const { evaluate, version } = browser;
    const seen = await evaluate(`(async () => {
      const real = ${mod(version, 'data/repositories/real-data.js')}; const identity = ${mod(version, 'ui/party-identity.js')};
      await real.loadRealDatabase(); await real.loadRealCollections(['parties']);
      const fn = real.realDatabase.parties.find(item => item.id === ${JSON.stringify(FN)});
      const id = identity.partyIdentity({ party: fn });
      return { color: fn.color, color2: fn.color2 ?? null, primary: id.colors.primary, secondary: id.colors.secondary, secondSource: id.secondSource };
    })()`);
    check(seen.color === NEW_PRIMARY && seen.primary === NEW_PRIMARY && seen.secondSource === 'derivato' && seen.secondary !== SECONDARY, `Cambiato il colore, il nuovo è ovunque e il secondo tono si deriva da esso (${JSON.stringify(seen)}).`);
    check(seen.secondary !== LOGO_BRAND[FN]?.secondary && seen.secondary !== PRIMARY, `Il giallo del logo non rientra come secondo colore (${seen.secondary}).`);
    // ---------- 4. the server cannot be reached ----------
    const sync = await evaluate(`(async () => {
      const sync = ${mod(version, 'data/repositories/admin-sync.js')};
      const ok = await sync.refreshSharedArchive(); const before = sync.sharedSyncStatus();
      const realFetch = globalThis.fetch; globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
      await sync.refreshSharedArchive(); const after = sync.sharedSyncStatus(); globalThis.fetch = realFetch;
      return { before, after };
    })()`);
    check(sync.before.ok === true && sync.after.ok === false && sync.after.hasCopy && /fetch/i.test(sync.after.error ?? ''), `Con il server irraggiungibile si usa la copia salvata e non si dichiara aggiornata (${JSON.stringify(sync.after)}).`);
  }, { serverPort: 8791 });
} finally { await local.close(); }
if (problems.length) { console.error(`Admin → nuova carriera: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 40).join('\n')}`); process.exit(1); }
console.log('Admin → nuova carriera verificato in Chrome su una copia isolata di Cloudflare: nome, sigla, logo, colore del partito (uno solo, il secondo tono si deriva) e nome di un politico, corretti dal proprietario e pubblicati sul server, sono quelli di una nuova carriera in un browser pulito, in ogni schermata, dopo il ricaricamento e alla prima settimana; gli esadecimali del proprietario restano originali (solo la presentazione si adatta al contrasto); senza secondo colore se ne deriva uno coerente, mai il giallo del logo; senza server si usa la copia salvata e non la si dichiara aggiornata.');
