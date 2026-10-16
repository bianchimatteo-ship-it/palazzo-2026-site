// The colour of a party is one: the primary colour (set by the owner in the Admin, or by the player for a party founded in the game). It is the colour of that party from the first day of a
// career, in the identity of the shell, the polls (bars and lines), the hemicycles, the national view and every other view, after saving and reloading; a party without a chosen colour gets the
// documented fallback (the validated series of the charts, in the order of the forces), never one that overrides the chosen colour. Two parties with the same colour do not break anything.
// Chrome over the DevTools protocol on a clean profile (the Admin archive is the one of that profile; nothing of the production archive is touched). Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { accentAsGraphic } from '../src/ui/party-identity.js';

if (!chromeAvailable) { console.log('Colori dei partiti saltati: Chrome non trovato (imposta CHROME_PATH per eseguirli).'); process.exit(0); }
const LEGA = 'party-registro-p1-2017-41-ir', FDI = 'party-registro-p1-2014-04-ir', PD = 'party-registro-p1-2015-29-ir';
const LEGA_COLOR = '#ff2fb3', FDI_COLOR = '#00b3a4';
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
const mod = (version, path) => `await import('/src/${path}?v=${version}')`;

await withBrowser(async browser => {
  const { evaluate, version, waitFor, goto, pause, errors } = browser;
  // the owner's colours, written the way the Admin writes them (this profile's archive), applied before the career begins
  await evaluate(`(async () => {
    localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true }));
    const admin = ${mod(version, 'data/repositories/admin-store.js')}; const real = ${mod(version, 'data/repositories/real-data.js')};
    await real.loadRealDatabase(); await real.loadRealCollections(['parties', 'politicalMovements', 'parliamentaryGroups']);
    const pristine = id => real.pristineRecord('parties', id) ?? {};
    admin.saveRecordOverride('parties', ${JSON.stringify(LEGA)}, { color: ${JSON.stringify(LEGA_COLOR)} }, pristine(${JSON.stringify(LEGA)}));
    admin.saveRecordOverride('parties', ${JSON.stringify(FDI)}, { color: ${JSON.stringify(FDI_COLOR)} }, pristine(${JSON.stringify(FDI)}));
    real.refreshAdminOverrides();
    // (what the app does after every edit of the owner: its world reference is read again)
    const { store } = ${mod(version, 'core/store.js')};
    store.setRealReference({ twoPerThousand: real.realDatabase.twoPerThousand ?? [], parties: real.realDatabase.parties ?? [], movements: real.realDatabase.politicalMovements ?? [], coalitions: real.realDatabase.coalitions ?? [], polls: real.realDatabase.realPolls ?? [], electoralLists: real.realDatabase.electoralLists ?? [], governingIds: [], startDate: real.realDatabase.manifest?.scenarioDate ?? real.realDatabase.manifest?.snapshotDate ?? null });
    return true;
  })()`);
  await createCareerInPage(browser, { party: LEGA, group: 'cam-xix-03', weeks: 2, onboarding: false });
  const model = () => evaluate(`(async () => {
    const { store } = ${mod(version, 'core/store.js')}; const identity = ${mod(version, 'ui/party-identity.js')}; const hemi = ${mod(version, 'core/hemicycle.js')}; const real = ${mod(version, 'data/repositories/real-data.js')};
    const s = store.getState(); const force = id => s.world.parties.find(item => item.id === id);
    const resolver = hemi.forceColorResolver(s.world);
    const lega = real.realDatabase.parties.find(item => item.id === ${JSON.stringify(LEGA)});
    return { legaColor: lega.color, legaColor2: lega.color2 ?? null, fnForce: force(${JSON.stringify(LEGA)}) && { brand: force(${JSON.stringify(LEGA)}).brandColor, color: force(${JSON.stringify(LEGA)}).color }, fdi: force(${JSON.stringify(FDI)}) && { brand: force(${JSON.stringify(FDI)}).brandColor, color: force(${JSON.stringify(FDI)}).color },
      pd: force(${JSON.stringify(PD)}) && { brand: force(${JSON.stringify(PD)}).brandColor, color: force(${JSON.stringify(PD)}).color }, resolved: { lega: resolver(${JSON.stringify(LEGA)}), fdi: resolver(${JSON.stringify(FDI)}) },
      accent: identity.partyIdentity({ party: lega }).accent, week: s.game.week.index };
  })()`);
  let m = await model();
  check(m.legaColor === LEGA_COLOR && !m.legaColor2, `Il colore dell’Admin è nei dati del partito (${m.legaColor}).`);
  check(m.fnForce?.brand === LEGA_COLOR && /^#[\da-f]{6}$/i.test(m.fnForce.color), `La forza nei sondaggi porta il colore dell’Admin dal primo giorno (${JSON.stringify(m.fnForce)}).`);
  check(m.fdi?.brand === FDI_COLOR, `Anche un altro partito corretto (${JSON.stringify(m.fdi)}).`);
  check(m.pd && !m.pd.brand && /^#[\da-f]{6}$/i.test(m.pd.color), `Un partito senza colore scelto ha il colore di ripiego della serie dei grafici (${JSON.stringify(m.pd)}).`);
  check(m.resolved.lega === m.fnForce.color && m.resolved.fdi === m.fdi.color, 'Gli emicicli leggono il colore dalla forza del mondo, quindi quello dell’Admin.');
  check(m.accent === accentAsGraphic(LEGA_COLOR), `L’identità del partito usa il colore dell’Admin (${m.accent}).`);

  // the views of the career
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
  const has = (html, hex) => html.includes(hex.toLowerCase()) || html.includes(rgb(hex));
  const pageHtml = async page => { await evaluate(`location.hash = '#${page}', true`); await pause(900); return evaluate('document.body.innerHTML.toLowerCase()'); };
  const pass = async label => {
    await openCareer(browser);
    const shell = await evaluate(`getComputedStyle(document.querySelector('.app-shell')).getPropertyValue('--party-accent').trim()`);
    check(shell === accentAsGraphic(LEGA_COLOR), `${label}: l’accento della Home è quello del partito (${shell}).`);
    const fresh = await model();
    for (const page of ['sondaggi', 'parlamento', 'elezioni', 'partiti-lista', 'governo']) {
      const html = await pageHtml(page);
      if (['sondaggi', 'parlamento'].includes(page)) check(has(html, fresh.fnForce.color), `${label} · ${page}: il colore del partito (${fresh.fnForce.color}) è nella pagina.`);
      if (page === 'sondaggi') check(has(html, fresh.fdi.color), `${label} · ${page}: anche l’altro partito corretto.`);
    }
    // the national view takes the colour set on purpose
    const national = await evaluate(`(async () => { const pc = ${mod(version, 'ui/political-colors.js')}; return { lega: pc.forceColor(${JSON.stringify(LEGA)}), fdi: pc.forceColor(${JSON.stringify(FDI)}), pd: pc.forceColor(${JSON.stringify(PD)}) }; })()`);
    check(national.lega === fresh.fnForce.color && national.fdi === fresh.fdi.color, `${label}: la vista nazionale usa il colore scelto (${JSON.stringify(national)}).`);
    check(national.pd !== national.lega && national.pd !== national.fdi, `${label}: gli altri partiti non lo ereditano.`);
  };
  await pass('prima visita');
  // reload: nothing is forgotten
  await goto();
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
  await pass('dopo il ricaricamento');

  // the same colour for two parties: nothing breaks, the page still tells them apart by name
  await evaluate(`(async () => {
    const admin = ${mod(version, 'data/repositories/admin-store.js')}; const real = ${mod(version, 'data/repositories/real-data.js')};
    admin.saveRecordOverride('parties', ${JSON.stringify(FDI)}, { color: ${JSON.stringify(LEGA_COLOR)} }, real.pristineRecord('parties', ${JSON.stringify(FDI)}) ?? {});
    real.refreshAdminOverrides(); return true;
  })()`);
  const html = await pageHtml('sondaggi');
  check(html.length > 1000 && !/undefined|nan%/.test(html.replace(/data-[a-z-]+="[^"]*"/g, '')), 'Due partiti con lo stesso colore: la pagina dei sondaggi è intatta.');

  // a party founded in the game: its colour (the only one) is the party's colour
  const founded = await evaluate(`(async () => {
    const { store } = ${mod(version, 'core/store.js')}; const real = ${mod(version, 'data/repositories/real-data.js')};
    store.createCareer({ firstName: 'Ida', lastName: 'Fondatrice', birthDate: '1982-04-04', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia', previousProfession: 'Insegnante', initialLevel: 'comunale', partyMode: 'new', partyName: 'Lista Verde Prova', partyAbbreviation: 'LVP', partyDescription: 'Prova', partyColor: '#7a2fd0', partyOrientation: 'Ecologista', partyPosition: 'centro', partyProgram: ['scuola'], policyPositions: { economia: 3, welfare: 3, ambiente: 4, europa: 3 }, partyLogoMode: 'builder', partyLogoShape: 'cerchio', partyLogoSymbol: 'freccia' }, real.realDatabase.parties, real.realDatabase.parliamentaryGroups ?? []);
    const s = store.getState(); const party = s.dataset.parties.find(item => item.officialName === 'Lista Verde Prova' || item.name === 'Lista Verde Prova'); const force = s.world.parties.find(item => item.isPlayer);
    return { color: party?.color ?? null, color2: party?.color2 ?? null, force: force && { brand: force.brandColor, color: force.color } };
  })()`);
  check(founded.color === '#7a2fd0' && founded.color2 === null && founded.force?.brand === '#7a2fd0', `Il partito fondato nella partita ha un solo colore, quello scelto (${JSON.stringify(founded)}).`);
  check(errors.length === 0, `Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
});
if (problems.length) { console.error(`Colori dei partiti: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 30).join('\n')}`); process.exit(1); }
console.log('Colori dei partiti verificati in Chrome: il colore (uno solo) scelto dall’Admin è quello del partito dal primo giorno nella forza dei sondaggi, nell’identità, nelle barre dei sondaggi, negli emicicli e nella vista nazionale, anche dopo il ricaricamento; ripiego documentato per chi non ne ha; due partiti con lo stesso colore non rompono nulla; il partito fondato in partita ha il suo colore e nessun secondo.');
