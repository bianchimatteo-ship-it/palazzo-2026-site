// A new career starts from “Dove vuoi iniziare?”: Regione → Comune (from the ISTAT list of 21 February 2026, 7,894
// comuni, Sardinia's 2026 units) → path → party → difficulty → who you are. No preset person or territory: the comune
// chosen becomes the starting territory of the simulation. ISTAT data stay real and separate from the simulation.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const realFile = name => new URL(`../src/data/real/${name}`, import.meta.url);
const fingerprint = async () => { const hash = createHash('sha256'); for (const name of ['municipalities.json', 'territorial-units.json', 'manifest.json']) hash.update(await readFile(realFile(name))); return hash.digest('hex'); };
const before = await fingerprint();
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['territorialUnits', 'municipalities', 'parties', 'politicalMovements', 'parliamentaryGroups', 'politicians']);
const db = realData.realDatabase;
const { ITALIAN_REGIONS } = await import(`../src/data/regions.js${v}`);
const { makeCareerDraft, renderCareerWizard, chosenPlace, WIZARD_STEPS } = await import(`../src/ui/career-wizard.js${v}`);
const { validateCareerStep, validateNewCareerDraft, validateWizardStep, WIZARD_CHECKS, CAREER_STEPS, WIZARD_VIEWS } = await import(`../src/core/career-rules.js${v}`);
const { store } = await import(`../src/core/store.js${v}`);

// ---------- 1. the ISTAT list, imported, complete and separate ----------
const territory = { units: db.territorialUnits, municipalities: db.municipalities, sourceUrl: db.manifest.territorialSource.url, sourceName: db.manifest.territorialSource.name };
assert.equal(db.municipalities.length, 7894, 'Tutti i 7.894 comuni ISTAT al 21 febbraio 2026.');
assert.equal(new Set(db.municipalities.map(item => item.code)).size, 7894, 'Codici statistici unici.');
assert.ok(db.municipalities.every(item => /^\d{6}$/.test(item.code) && item.source === 'real' && item.verified === true), 'Ogni comune ha il codice ISTAT a sei cifre ed è un dato reale.');
const units = new Map(db.territorialUnits.map(unit => [unit.code, unit]));
assert.ok(db.municipalities.every(item => units.has(item.unit)), 'Ogni comune appartiene a una provincia, città metropolitana o unità equivalente.');
assert.ok(db.territorialUnits.every(unit => unit.source === 'real' && /istat\.it/.test(unit.sourceUrl) && unit.validFrom === '2026-02-21' && ITALIAN_REGIONS.includes(unit.gameRegion)), 'Unità territoriali con fonte ISTAT e regione del gioco.');
assert.deepEqual([...new Set(db.territorialUnits.map(unit => unit.gameRegion))].sort(), [...ITALIAN_REGIONS].sort(), 'Le 20 regioni.');
const sardinia = db.territorialUnits.filter(unit => unit.regionCode === '20').map(unit => `${unit.name}|${unit.type}`);
for (const expected of ['Sassari|Città metropolitana', 'Cagliari|Città metropolitana', 'Gallura Nord-Est Sardegna|Provincia', 'Ogliastra|Provincia', 'Medio Campidano|Provincia', 'Sulcis Iglesiente|Provincia', 'Nuoro|Provincia', 'Oristano|Provincia']) assert.ok(sardinia.includes(expected), `Sardegna 2026: ${expected}.`);
assert.ok(!sardinia.some(item => item.startsWith('Sud Sardegna')), 'La provincia del Sud Sardegna soppressa non c’è più.');
assert.equal(db.manifest.territorialSource.validFrom, '2026-02-21');
assert.ok(/Elenco-comuni-italiani\.xlsx$/.test(db.manifest.territorialSource.file), 'Il manifest indica il file permanente ISTAT importato.');
const bolzano = db.municipalities.find(item => item.code === '021008');
assert.ok(bolzano?.alt === 'Bozen', 'Le denominazioni bilingui restano (Bolzano/Bozen).');

// ---------- 2. no preset person or territory ----------
const draft = makeCareerDraft('2026-09-24');
assert.ok(!draft.region && !draft.municipality && !draft.municipalityCode && !draft.firstName && !draft.lastName, 'Nuova carriera senza persona né territorio preimpostati.');
const sources = [];
for (const dir of ['../src/ui/', '../src/core/', '../src/data/simulation/']) for (const name of await readdir(new URL(dir, import.meta.url))) if (name.endsWith('.js')) sources.push(await readFile(new URL(dir + name, import.meta.url), 'utf8'));
assert.ok(sources.every(text => !/\bBosio\b|\bMatteo\b/.test(text)), 'Nessun riferimento personale (Matteo, Bosio) nel codice di gioco.');

// ---------- 3. the screens: who you are (with the avatar) → territory → career path → party → advanced settings → summary ----------
assert.equal(CAREER_STEPS, 5, 'I controlli numerati restano cinque (la loro numerazione non cambia).');
assert.equal(WIZARD_VIEWS, 6);
assert.deepEqual(WIZARD_STEPS.map(step => step[0]), ['Identità', 'Territorio', 'Carriera', 'Partito', 'Avanzate', 'Riepilogo']);
const state = store.getState();
const render = (d, t = territory) => renderCareerWizard(state, { ...makeCareerDraft('2026-09-24'), ...d }, [], () => null, db.parliamentaryGroups, [], [], db.politicians, t);
let html = render({ step: 1 });
assert.ok(html.includes('Identità e avatar') && html.includes('data-avatar-editor') && html.includes('PASSAGGIO 01 <i>/</i> 06') && ['firstName', 'lastName', 'birthDate', 'gender', 'previousProfession'].every(name => html.includes(`name="${name}"`)) && !html.includes('data-wizard-region'), 'Si comincia da chi sei: nome, cognome, nascita, genere e professione.');
html = render({ step: 2 });
assert.ok(html.includes('Territorio e partenza') && html.includes('data-wizard-region') && html.includes('PASSAGGIO 02 <i>/</i> 06') && html.includes('istat.it') && !html.includes('data-level='), 'Il secondo passaggio è il punto di partenza: territorio (con la fonte ISTAT) e percorso insieme.');
assert.ok(!html.includes('data-municipality-code'), 'Prima la regione, poi il comune.');
assert.ok(render({ step: 2 }, null).includes('Caricamento dell’elenco ISTAT'), 'Finché l’elenco non è caricato lo si dice.');
html = render({ step: 2, region: 'Piemonte' });
const piemonte = db.municipalities.filter(item => units.get(item.unit).gameRegion === 'Piemonte').length;
assert.ok(html.includes('data-wizard-unit') && html.includes('Alessandria (AL)') && html.includes(`di ${piemonte.toLocaleString('it-IT')} comuni`), 'Regione → province e comuni della regione.');
assert.ok(!html.includes('>Roma<'), 'Solo i comuni della regione scelta.');
html = render({ step: 2, region: 'Piemonte', municipalityQuery: 'cune' });
assert.ok(html.includes('data-municipality-code="004078"'), 'Ricerca del comune per nome.');
html = render({ step: 2, region: 'Lazio', territorialUnit: '258', municipalityQuery: 'rom' });
assert.ok(html.includes('data-municipality-code="058091"') && html.includes('capoluogo'), 'Filtro per città metropolitana e capoluoghi indicati.');
const roma = { step: 2, region: 'Lazio', municipalityCode: '058091', municipality: 'Roma' };
assert.equal(chosenPlace(roma, territory)?.unit.name, 'Roma');
html = render(roma);
assert.ok(html.includes('<strong>Comune di Roma</strong>') && html.includes('Cambia comune') && !html.includes('data-level='), 'Il comune resta in vista (l’elenco si chiude) e il percorso non è più in questo passaggio.');
const careerHtml = render({ ...roma, step: 3 });
assert.ok(careerHtml.includes('Scegli la tua carriera') && careerHtml.includes('PASSAGGIO 03 <i>/</i> 06') && ['comunale', 'provinciale', 'regionale', 'deputato', 'senatore', 'europeo'].every(level => careerHtml.includes(`data-level="${level}"`)) && careerHtml.includes('data-starting-office="presidenteConsiglio"') && careerHtml.includes('data-starting-office="presidenteRepubblica"') && careerHtml.includes('Comune di Roma') && !careerHtml.includes('data-wizard-region'), 'Il percorso ha la sua pagina: tutte le carte (CAREER_LEVELS e i due scenari), il comune scelto in vista e nessun campo del territorio.');
assert.ok(!careerHtml.includes('data-group-id=') && !careerHtml.includes('data-pdc-context'), 'Con un percorso locale non compaiono né il gruppo né il contesto del Presidente del Consiglio.');
assert.ok(render({ ...roma, step: 3, initialLevel: 'senatore' }).includes('data-wizard-group-search') && render({ ...roma, step: 3, startingOffice: 'presidenteConsiglio', initialLevel: 'deputato' }).includes('data-pdc-context="external"'), 'Le opzioni dipendenti compaiono solo per il percorso scelto (gruppo parlamentare, contesto del PdC).');
assert.ok(/<details class="wizard-more" data-wizard-more="comuni" >/.test(html), 'Scelto il comune, l’elenco dei comuni è un accordion chiuso.');
assert.ok(/<details class="wizard-more" data-wizard-more="comuni" open/.test(render({ step: 2, region: 'Lazio' })), 'Senza comune l’elenco è aperto.');
assert.ok(/<details class="wizard-more" data-wizard-more="comuni" open/.test(render({ ...roma, open: { comuni: true } })), 'Un accordion lasciato aperto dal giocatore resta aperto.');
assert.ok(render({ ...roma, step: 5 }).includes('difficulty-grid'), 'La difficoltà ha un suo passaggio.');
assert.ok(/<details class="wizard-more" data-wizard-more="start" >/.test(render({ ...roma, step: 5 })), 'Le condizioni di partenza sono un accordion chiuso sotto la difficoltà.');
html = render({ ...roma, step: 6, firstName: 'Ada', lastName: 'Prova' });
assert.ok(!html.includes('name="firstName"') && html.includes('01 · IDENTITÀ') && html.includes('Ada Prova') && html.includes('02 · DOVE INIZI') && html.includes('codice ISTAT 058091') && html.includes('data-wizard-action="finish"'), 'In fondo il riepilogo: identità, comune ISTAT e avvio.');

// Validation follows the same order; the comune must come from the ISTAT list of the chosen region.
const check = (d, step) => validateCareerStep({ ...makeCareerDraft('2026-09-24'), ...d }, step, db.parties, db.parliamentaryGroups, territory);
assert.ok(check({}, 1).some(error => /regione/.test(error)));
assert.ok(check({ region: 'Lazio', municipality: 'Paese inventato' }, 1).some(error => /elenco ISTAT/.test(error)), 'Un comune scritto a mano non basta.');
assert.ok(check({ region: 'Piemonte', municipalityCode: '058091', municipality: 'Roma' }, 1).some(error => /regione/.test(error)), 'Il comune deve essere nella regione scelta.');
assert.deepEqual(check({ region: 'Lazio', municipalityCode: '058091', municipality: 'Roma' }, 1), []);
// The steps of the wizard run the checks of the parts they gather (the numbered checks above keep their meaning).
const view = (d, step) => validateWizardStep({ ...makeCareerDraft('2026-09-24'), ...d }, step, db.parties, db.parliamentaryGroups, territory);
assert.deepEqual(Object.keys(WIZARD_CHECKS).map(Number), [1, 2, 3, 4, 5, 6]);
// the explicit map: screen → numbered checks (1 territory, 2 path, 3 party, 4 difficulty and starting conditions, 5 identity)
assert.deepEqual(WIZARD_CHECKS, { 1: [5], 2: [1], 3: [2], 4: [3], 5: [4, 5], 6: [] });
assert.ok(view({}, 1).some(error => /nome/.test(error)) && view({}, 1).some(error => /professione/.test(error)), 'Identità: nome e professione obbligatori.');
assert.deepEqual(view({ firstName: 'Ada', lastName: 'Prova', birthDate: '1985-04-12', previousProfession: 'Insegnante' }, 1), [], 'Identità completa.');
assert.ok(view({}, 2).some(error => /regione/.test(error)), 'Territorio: la regione serve.');
assert.ok(!view({ region: 'Lazio', municipalityCode: '058091', municipality: 'Roma', initialLevel: 'deputato' }, 2).some(error => /gruppo/.test(error)), 'Territorio: il percorso non si controlla più qui.');
assert.deepEqual(view({ region: 'Lazio', municipalityCode: '058091', municipality: 'Roma' }, 2), [], 'Territorio completo.');
assert.ok(view({ initialLevel: 'deputato' }, 3).some(error => /gruppo/.test(error)), 'Carriera: il percorso è controllato (un deputato ha bisogno del gruppo).');
assert.deepEqual(view({}, 3), [], 'Carriera: il percorso predefinito è valido.');
assert.deepEqual(view({}, 6), [], 'Il riepilogo non ha controlli propri: l’avvio li esegue tutti.');
assert.ok(view({ start: { profile: 'consolidata', levels: {} }, birthDate: '1995-01-01' }, 5).some(error => /almeno 40 anni/.test(error)), 'Avanzate: la carriera consolidata richiede l’età (il controllo dipende dalla data di nascita).');
// The ISTAT list not loaded (still loading or failed): the wizard accepts no comune at all, not even one typed freely.
const wizardCheck = (d, list) => validateCareerStep({ ...makeCareerDraft('2026-09-24'), ...d }, 1, db.parties, db.parliamentaryGroups, list, { requireTerritory: true });
assert.ok(wizardCheck({ region: 'Lazio', municipality: 'Paese inventato' }, null).some(error => /elenco ISTAT dei comuni non è ancora disponibile/.test(error)), 'Senza elenco ISTAT il wizard non accetta comuni inventati.');
assert.ok(wizardCheck({ region: 'Lazio', municipality: 'Roma' }, { status: 'error' }).length === 1, 'Elenco ISTAT fallito: nessun comune accettato.');
assert.deepEqual(wizardCheck({ region: 'Lazio', municipalityCode: '058091', municipality: 'Roma' }, territory), [], 'Con l’elenco caricato il comune ISTAT è accettato.');
// The wizard while the list is loading or failed: a clear state, and “Riprova” after a failure.
const loadingHtml = renderCareerWizard(state, { ...makeCareerDraft('2026-09-24'), step: 2, region: 'Lazio' }, db.parties, () => null, db.parliamentaryGroups, [], [], [], { status: 'loading' });
assert.ok(loadingHtml.includes('Caricamento dell’elenco ISTAT dei comuni') && !loadingHtml.includes('data-wizard-retry-data'), 'Elenco ISTAT in caricamento: il wizard lo dice.');
const failedHtml = renderCareerWizard(state, { ...makeCareerDraft('2026-09-24'), step: 2, region: 'Lazio' }, db.parties, () => null, db.parliamentaryGroups, [], [], [], { status: 'error', error: 'Dati reali non disponibili (503: municipalities.json).' }, { loading: false, failed: ['parlamentari'] });
assert.ok(failedHtml.includes('L’elenco ISTAT dei comuni non è stato caricato') && failedHtml.includes('503: municipalities.json') && failedHtml.includes('data-wizard-retry-data') && !failedHtml.includes('data-municipality-code'), 'Elenco ISTAT fallito: motivo e “Riprova”, nessun elenco inventato.');
assert.ok(failedHtml.includes('Non è stato possibile caricare: parlamentari'), 'Gli altri dati mancanti sono indicati nel wizard.');
assert.ok(check({ difficulty: 'impossibile' }, 4).length === 1 && check({ difficulty: 'difficile' }, 4).length === 0);
assert.ok(check({}, 5).length >= 3 && check({ firstName: 'Ada', lastName: 'Prova', birthDate: '1990-05-05', previousProfession: 'Insegnante' }, 5).length === 0, 'Il profilo si compila alla fine.');

// ---------- 4. the comune chosen becomes the starting territory of the simulation ----------
const place = chosenPlace({ municipalityCode: '020064' }, territory);
const full = { ...makeCareerDraft('2026-09-24'), region: place.region, municipalityCode: '020064', municipality: place.municipality.name, provinceCode: place.unit.code, provinceName: place.unit.name, provinceType: place.unit.type, initialLevel: 'comunale', partyMode: 'independent', difficulty: 'normale', firstName: 'Ada', lastName: 'Prova', birthDate: '1990-05-05', gender: 'donna', previousProfession: 'Insegnante' };
assert.deepEqual(validateNewCareerDraft(full, db.parties, db.parliamentaryGroups, territory), []);
store.createCareer(full, db.parties, db.parliamentaryGroups);
const started = store.getState();
const player = started.dataset.politicians.find(item => item.id === started.career.playerId);
const comune = started.dataset.territories.find(item => item.kind === 'comune');
assert.equal(player.municipality, place.municipality.name);
assert.equal(player.municipalityCode, '020064');
assert.equal(player.region, place.region);
assert.ok(comune.istatCode === '020064' && comune.reference?.source === 'real' && comune.source === 'user', 'Il territorio iniziale porta il codice ISTAT; la scelta resta del giocatore.');
assert.equal(started.world.place.municipality, place.municipality.name, 'Il mondo politico parte dal comune scelto.');
assert.equal(started.world.place.region, place.region);
assert.ok(started.game.timeline[0].detail.includes(place.municipality.name), 'La cronologia comincia dal comune scelto.');

assert.equal(await fingerprint(), before, 'I dati ISTAT non vengono modificati dal gioco.');
console.log(`Onboarding verificato: identità e avatar → territorio → carriera → partito → impostazioni avanzate → riepilogo; ${db.municipalities.length} comuni e ${db.territorialUnits.length} unità territoriali ISTAT (21/02/2026, Sardegna 2026), ricerca e filtro per provincia, comune obbligatorio dall’elenco della regione, nessuna persona o territorio preimpostati, il comune scelto (${place.municipality.name}, ${place.region}) diventa il territorio iniziale con il suo codice ISTAT; dati ISTAT intatti.`);
