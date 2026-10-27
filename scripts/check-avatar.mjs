// The avatar of the player and the six screens of the new career.
// Part 1 (Node): the options (face 3, skin 5, hair 5, hairstyle 7, beard 3, glasses 3, jacket 4), the SVG built only from the chosen traits (local, nothing remote, every choice changes the drawing),
// the stable default of the careers made before avatars, `avatar` kept apart from `gender` in the canonical record, the checks of the wizard (the numbered checks keep their meaning, the screens map
// to them explicitly), the draft, the file export and the round trip through the online account (stand-in Worker), old saves without avatar, a damaged avatar.
// Part 2 (Chrome, a clean profile): the whole wizard in Italian with real clicks — six screens in the agreed order, the editor with live preview, the blurred picture of the Palace only behind it,
// back and forth, cancel, validations of the territory and of the path, the dependent options of the path, the career created with its avatar and the same face in Home, Profile and Parliament, kept
// after a reload, an old career with the stable default — then English and a phone (375 px). Skipped without Chrome (part 1 still runs).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

const realFetch = globalThis.fetch;
const { startCareer } = await import('./lib/long-run.mjs');
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const A = await import(`../src/core/avatar.js${v}`);
const { avatarSvg } = await import(`../src/ui/avatar-svg.js${v}`);
const { WIZARD_CHECKS, WIZARD_VIEWS, CAREER_STEPS, GENDERS, normalizeGender, validateCareerStep, validateWizardStep } = await import(`../src/core/career-rules.js${v}`);
const { makeCareerDraft, renderCareerWizard, WIZARD_STEPS } = await import(`../src/ui/career-wizard.js${v}`);
const { validateEntity } = await import(`../src/data/schema.js${v}`);
const lines = [];

// ---------- 1. the options and the drawing ----------
assert.deepEqual(A.AVATAR_FIELDS, ['face', 'skin', 'hair', 'hairstyle', 'beard', 'glasses', 'jacket', 'eyes', 'expression', 'moustache'], 'I sette campi di prima restano in testa: un avatar salvato prima è un prefisso del nuovo.');
assert.deepEqual([...A.AVATAR_GROUPS].sort(), [...A.AVATAR_FIELDS].sort(), 'L’editor mostra ogni campo.');
const count = field => A.AVATAR_OPTIONS[field].length;
assert.deepEqual([count('face'), count('skin'), count('hair'), count('hairstyle'), count('beard'), count('glasses'), count('jacket'), count('eyes'), count('expression'), count('moustache')], [2, 5, 5, 12, 3, 3, 8, 5, 3, 5], 'Le opzioni richieste ci sono: 5 occhi, 3 espressioni, 12 acconciature, 8 giacche, 5 baffi.');
assert.deepEqual(A.AVATAR_OPTIONS.face.map(item => item.id), ['maschile', 'femminile'], 'Volto: solo maschile e femminile (nessuna variante neutra).');
assert.deepEqual(A.AVATAR_OPTIONS.moustache.map(item => item.id), ['nessuno', 'sottili', 'classici', 'folti', 'manubrio']);
assert.deepEqual(A.AVATAR_OPTIONS.expression.map(item => item.id), ['serena', 'sorridente', 'determinata']);
assert.ok(!JSON.stringify(A.AVATAR_OPTIONS).match(/neutr|binari|altro/i), 'Nessuna opzione neutra, non binaria o «altro».');
assert.deepEqual(A.AVATAR_OPTIONS.hair.map(item => item.id), ['nero', 'castano', 'biondo', 'rosso', 'grigio']);
assert.deepEqual(A.AVATAR_OPTIONS.beard.map(item => item.id), ['nessuna', 'corta', 'completa']);
assert.deepEqual(A.AVATAR_OPTIONS.glasses.map(item => item.id), ['nessuno', 'tondi', 'rettangolari']);
for (const field of ['skin', 'hair', 'jacket', 'eyes']) assert.ok(A.AVATAR_OPTIONS[field].every(item => /^#[\da-f]{6}$/i.test(item.color)), `${field}: ogni voce ha il suo colore.`);
const base = A.DEFAULT_AVATAR;
const draw = (change = {}, options = {}) => avatarSvg({ ...base, ...change }, options);
const reference = draw();
for (const field of A.AVATAR_FIELDS) {
  const seen = new Set();
  for (const item of A.AVATAR_OPTIONS[field]) {
    const svg = draw({ [field]: item.id });
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.includes(`data-avatar="`), `${field}/${item.id}: un SVG completo.`);
    seen.add(svg);
  }
  assert.equal(seen.size, count(field), `${field}: ogni scelta cambia il disegno (nessuna voce è uguale a un’altra).`);
}
for (const beard of A.AVATAR_OPTIONS.beard) {
  const drawn = A.AVATAR_OPTIONS.moustache.map(item => draw({ beard: beard.id, moustache: item.id, hair: 'nero' }));
  assert.equal(new Set(drawn).size, 5, `Baffi con barba «${beard.id}»: ogni stile cambia il disegno.`);
  assert.ok(drawn.slice(1).every(svg => svg.includes('stroke-linejoin="round"/><g fill') || svg.includes('fill="#')), 'I baffi sono disegnati.');
}
for (const moustache of A.AVATAR_OPTIONS.moustache.slice(1)) assert.equal(new Set(A.AVATAR_OPTIONS.beard.map(item => draw({ moustache: moustache.id, beard: item.id }))).size, 3, `Baffi «${moustache.id}»: si combinano con ogni barba (tre disegni diversi).`);
assert.notEqual(draw({ moustache: 'folti' }), draw({ moustache: 'folti', beard: 'completa' }), 'Barba e baffi sono indipendenti.');
assert.notEqual(draw({}, { focus: true }), draw(), 'Il ritaglio sul volto (anteprime dell’editor) è un altro disegno.');
assert.ok(!/https?:\/\/(?!www\.w3\.org)|data:|<image|<script|<foreignObject|href=|xlink|@import|url\((?!#)/.test(reference), 'L’avatar è disegnato solo con forme locali: nessuna immagine, indirizzo o script.');
assert.equal(draw(), draw(), 'Lo stesso avatar dà sempre lo stesso disegno.');
assert.ok(/role="img" aria-label="Avatar del tuo politico"/.test(draw()) && /aria-hidden="true"/.test(draw({}, { label: '' })), 'Nome accessibile, oppure decorativo.');
assert.ok(!draw({}, { label: '"><script>x</script>' }).includes('<script>'), 'L’etichetta è sempre protetta.');
assert.equal(avatarSvg({ face: 'sconosciuto', skin: 7, hairstyle: '<x>' }), reference, 'Valori sconosciuti: ricade sull’aspetto predefinito, mai un errore.');
assert.equal(avatarSvg(null), reference);
assert.ok(draw({}, { size: 40 }).includes('width="40"'), 'La dimensione è un parametro (l’anteprima è più grande delle iniziali di prima).');
lines.push('opzioni e disegno SVG locale (ogni scelta cambia l’immagine)');

// ---------- 2. default, normalisation and check ----------
assert.deepEqual(A.normalizeAvatar({ face: 'femminile', beard: 'corta', hair: 'x' }), { ...base, face: 'femminile', beard: 'corta' }, 'Un avatar parziale o rovinato si completa con i valori predefiniti.');
assert.ok(A.isValidAvatar(base) && !A.isValidAvatar({ ...base, skin: 'verde' }) && !A.isValidAvatar(null) && !A.isValidAvatar([]));
assert.deepEqual(A.avatarProblems(undefined), []) ; assert.equal(A.avatarProblems({ ...base, face: 'x' }).length, 1);
const ids = ['politico-1', 'giocatore-abc', 'p-2026-xyz', 'x'];
for (const id of ids) {
  const first = A.defaultAvatarFor(id);
  assert.deepEqual(first, A.defaultAvatarFor(id), `${id}: l’aspetto predefinito è sempre lo stesso.`);
  assert.ok(A.isValidAvatar(first) && first.beard === 'nessuna' && first.moustache === 'nessuno' && first.glasses === 'nessuno' && ['maschile', 'femminile'].includes(first.face), `${id}: valido, senza barba, baffi né occhiali.`);
}
assert.ok(new Set(ids.map(id => JSON.stringify(A.defaultAvatarFor(id)))).size > 1, 'Gli aspetti predefiniti non sono tutti uguali.');
const oldPlayer = { id: 'politico-vecchio', firstName: 'Ada', lastName: 'Prova', gender: 'donna' };
assert.deepEqual(A.avatarOf(oldPlayer), A.defaultAvatarFor('politico-vecchio'), 'Una carriera senza avatar riceve il suo aspetto predefinito stabile.');
assert.equal('avatar' in oldPlayer, false, 'Mostrarlo non modifica il record.');
assert.equal(A.avatarOf({ ...oldPlayer, gender: 'uomo' }).face, A.avatarOf(oldPlayer).face, 'Il genere non decide l’avatar.');
// an avatar saved before the new traits (seven fields, and the old neutral face) keeps what it had
const legacy = { id: 'politico-legacy', avatar: { face: 'neutro', skin: 'bruna', hair: 'rosso', hairstyle: 'riccio', beard: 'corta', glasses: 'tondi', jacket: 'bordeaux' } };
const kept = A.avatarOf(legacy);
assert.deepEqual({ skin: kept.skin, hair: kept.hair, hairstyle: kept.hairstyle, beard: kept.beard, glasses: kept.glasses, jacket: kept.jacket }, { skin: 'bruna', hair: 'rosso', hairstyle: 'riccio', beard: 'corta', glasses: 'tondi', jacket: 'bordeaux' }, 'Un avatar di prima conserva le sue scelte.');
assert.deepEqual([kept.eyes, kept.expression, kept.moustache], ['marroni', 'serena', 'nessuno'], 'I tratti nuovi prendono i valori predefiniti.');
assert.ok(['maschile', 'femminile'].includes(kept.face) && kept.face === A.defaultAvatarFor('politico-legacy').face, 'Il vecchio volto neutro passa a uno dei due, sempre lo stesso per lo stesso personaggio.');
assert.deepEqual(A.avatarOf({ ...legacy, avatar: { face: 'maschile', skin: 'chiara', hair: 'nero', hairstyle: 'corto', beard: 'nessuna', glasses: 'nessuno', jacket: 'blu' } }).face, 'maschile', 'Un volto valido resta.');
lines.push('aspetto predefinito stabile per le vecchie carriere, avatar di prima conservato');

// ---------- 3. the checks of the wizard: explicit map between screens and numbered checks ----------
assert.equal(CAREER_STEPS, 5);
assert.equal(WIZARD_VIEWS, 6);
assert.deepEqual(WIZARD_STEPS.map(step => step[0]), ['Identità', 'Territorio', 'Carriera', 'Partito', 'Avanzate', 'Riepilogo'], 'L’ordine: identità e avatar, territorio, carriera, partito, impostazioni avanzate, riepilogo.');
assert.deepEqual(WIZARD_STEPS.map(step => step[1]), ['Identità e avatar', 'Territorio e partenza', 'Scegli la tua carriera', 'Scegli l’appartenenza', 'Impostazioni avanzate', 'Riepilogo e avvio']);
assert.deepEqual(WIZARD_CHECKS, { 1: [5], 2: [1], 3: [2], 4: [3], 5: [4, 5], 6: [] }, 'Mappa esplicita: schermata → controlli numerati (1 territorio, 2 percorso, 3 partito, 4 difficoltà e condizioni, 5 identità).');
const run = await startCareer({ seed: 'avatar', level: 'comunale', draft: { avatar: { face: 'femminile', skin: 'bruna', hair: 'rosso', hairstyle: 'riccio', beard: 'nessuna', glasses: 'tondi', jacket: 'bordeaux' }, gender: 'uomo' } });
const { store, db } = run;
const { storage } = await import(`../src/core/storage.js${v}`);
// each new career or loaded game keeps the previous one in an automatic slot (at most five): the test empties them so that it can go on as long as it needs
const free = () => { for (const slot of storage.listSlots()) { try { storage.deleteSlot(slot.id); } catch { /* a slot that cannot be removed stays */ } } };
const load = payload => { free(); return store.loadGame(payload); };
const create = (...args) => { free(); return store.createCareer(...args); };
const territory = { units: db.territorialUnits, municipalities: db.municipalities };
const draftOf = extra => ({ ...makeCareerDraft('2026-09-24'), region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', firstName: 'Ada', lastName: 'Prova', birthDate: '1985-04-12', previousProfession: 'Insegnante', ...extra });
const screen = (extra, view) => validateWizardStep(draftOf(extra), view, db.parties, db.parliamentaryGroups, territory);
assert.deepEqual(makeCareerDraft('2026-09-24').avatar, base, 'Il nuovo personaggio parte dall’avatar predefinito.');
assert.deepEqual(screen({}, 1), [], 'Identità e avatar: completa.');
assert.equal(screen({ avatar: { ...base, jacket: 'rosa' } }, 1).length, 1, 'Un avatar non valido è rifiutato nella schermata dell’identità.');
assert.deepEqual(screen({ avatar: undefined }, 1), [], 'Un avatar assente non blocca (parte quello predefinito).');
assert.deepEqual(screen({ region: '' }, 2).length > 0, true, 'Territorio: serve la regione e il comune.');
assert.deepEqual(screen({}, 2), [], 'Territorio completo.');
assert.deepEqual(screen({ initialLevel: 'senatore', parliamentaryGroupId: '' }, 2), [], 'Il percorso non si controlla più nella schermata del territorio.');
assert.ok(screen({ initialLevel: 'senatore', parliamentaryGroupId: '' }, 3).some(error => /gruppo/.test(error)), 'Carriera: il percorso parlamentare chiede il gruppo.');
assert.deepEqual(screen({}, 3), [], 'Carriera: il percorso predefinito è valido.');
assert.ok(validateCareerStep(draftOf({ avatar: { ...base, face: 'x' } }), 5).length === 1, 'Il controllo numerato 5 (identità) comprende l’avatar.');
assert.ok(screen({ partyMode: 'existing', startingRole: null }, 4).length > 0 && screen({}, 4).length === 0, 'Partito: i suoi controlli restano nella sua schermata.');
lines.push('schermate e controlli: mappa esplicita');

// ---------- 4. the canonical record, saves and the online account ----------
const stateOf = () => store.getState();
const playerOf = state => state.dataset.politicians.find(person => person.id === state.career.playerId);
const player = playerOf(stateOf());
assert.deepEqual(player.avatar, { face: 'femminile', skin: 'bruna', hair: 'rosso', hairstyle: 'riccio', beard: 'nessuna', glasses: 'tondi', jacket: 'bordeaux', eyes: 'marroni', expression: 'serena', moustache: 'nessuno' }, 'L’avatar sta nel record canonico del personaggio.');
assert.equal(player.gender, 'uomo', 'E resta distinto dal genere (volto femminile, genere «uomo»).');
assert.deepEqual([player.avatar.eyes, player.avatar.expression, player.avatar.moustache], ['marroni', 'serena', 'nessuno'], 'Un avatar parziale si completa con i tratti nuovi.');
const minimal = { id: 'p1', firstName: 'Ada', lastName: 'Prova', source: 'user', gender: 'donna', avatar: player.avatar };
assert.doesNotThrow(() => validateEntity('politicians', minimal), 'Lo schema canonico dei politici conosce il campo avatar, accanto al genere.');
assert.throws(() => validateEntity('politicians', { ...minimal, avatarX: 1 }), /campi non riconosciuti/, 'Lo schema resta rigoroso sugli altri campi.');
const created = create({ ...draftOf({ gender: 'donna' }), avatar: { face: 'maschile', hairstyle: 'lungo' } }, db.parties, db.parliamentaryGroups);
const fresh = playerOf(store.getState());
assert.deepEqual(fresh.avatar, { ...base, face: 'maschile', hairstyle: 'lungo' }, 'Un avatar parziale nel draft si completa con i valori predefiniti.');
assert.equal(fresh.gender, 'donna');
create(draftOf({ avatar: undefined }), db.parties, db.parliamentaryGroups);
assert.deepEqual(playerOf(store.getState()).avatar, base, 'Senza avatar nel draft la carriera parte con quello predefinito.');
// a file saved and loaded again, an online copy and a download
const file = JSON.parse(store.exportSave());
assert.deepEqual(file.dataset.politicians.find(person => person.id === file.career.playerId).avatar, base, 'L’esportazione porta l’avatar.');
create({ ...draftOf({}), avatar: { face: 'femminile', skin: 'scura', hair: 'grigio', hairstyle: 'raccolto', beard: 'corta', glasses: 'rettangolari', jacket: 'verde' } }, db.parties, db.parliamentaryGroups);
const chosen = playerOf(store.getState()).avatar;
const exported = store.exportSave();
load(exported);
assert.deepEqual(playerOf(store.getState()).avatar, chosen, 'Importato di nuovo, l’avatar è lo stesso.');

const { webcrypto } = await import('node:crypto');
const harnessCrypto = globalThis.crypto;
Object.defineProperty(globalThis, 'crypto', { value: { subtle: webcrypto.subtle, getRandomValues: array => webcrypto.getRandomValues(array), randomUUID: () => harnessCrypto.randomUUID() }, configurable: true, writable: true });
const account = await import(`../src/data/repositories/account-sync.js${v}`);
const { createStandIns } = await import('./lib/local-worker.mjs');
const stand = createStandIns();
const cloudWorker = (await import(`../worker.js?avatar=${Date.now()}`)).default;
const cloudEnv = { ACCOUNTS: stand.d1, ADMIN_ARCHIVE: stand.kv, ASSETS: { fetch: async () => new Response('asset') } };
globalThis.location = new URL('http://127.0.0.1:8791/');
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => new URL(String(url)).pathname.startsWith('/api/') ? cloudWorker.fetch(new Request(String(url), init), cloudEnv) : nativeFetch(url, init);
await account.register('prova.avatar', 'password-di-prova');
const slot = account.slotForCareer(store.getState().career.id);
await account.uploadSave(slot, store.cloudSnapshot(), { create: true });
const remote = await account.downloadSave(slot, { commit: false });
assert.deepEqual(playerOf(remote.state).avatar, chosen, 'La copia online riporta l’avatar così com’è.');
create(draftOf({ firstName: 'Altra' }), db.parties, db.parliamentaryGroups);
assert.notDeepEqual(playerOf(store.getState()).avatar, chosen);
const restored = load(remote.state);
assert.deepEqual(playerOf(restored).avatar, chosen, 'Ripristinando la copia scaricata l’avatar torna quello salvato.');
assert.deepEqual(playerOf(store.getState()).avatar, chosen);
lines.push('record canonico, esportazione, copia online e ripristino con lo stesso avatar');

// an old save (no avatar) and a damaged one: nothing is lost, the look is the stable default
const old = JSON.parse(store.exportSave());
const oldPlayerRecord = old.dataset.politicians.find(person => person.id === old.career.playerId);
const before = { ...oldPlayerRecord }; delete before.avatar;
delete oldPlayerRecord.avatar;
const loadedOld = load(JSON.stringify(old));
const loadedRecord = playerOf(loadedOld);
for (const [key, value] of Object.entries(before)) assert.deepEqual(loadedRecord[key], value, `Vecchia carriera: ${key} intatto.`);
assert.deepEqual(A.avatarOf(loadedRecord), A.defaultAvatarFor(loadedRecord.id), 'Vecchia carriera: aspetto predefinito, sempre lo stesso.');
assert.equal(loadedOld.career.id, old.career.id, 'La carriera è la stessa.');
const damaged = JSON.parse(store.exportSave());
playerOf(damaged).avatar = { face: 'neutro', skin: 'verde', hair: 5, extra: 'x' };
const loadedDamaged = load(JSON.stringify(damaged));
assert.ok(A.isValidAvatar(playerOf(loadedDamaged).avatar) && !('extra' in playerOf(loadedDamaged).avatar), 'Un avatar rovinato nel salvataggio viene ripulito, senza errori.');
lines.push('vecchie carriere senza perdita di dati, avatar rovinato ripulito');

// the gender of the character: man or woman, nothing else; older values are brought to one of them without losing the original
assert.deepEqual([...GENDERS], ['uomo', 'donna']);
assert.deepEqual(['uomo', 'donna', 'non-binario', 'preferisco-non-specificare', 'altro', null, undefined].map(normalizeGender), ['uomo', 'donna', 'uomo', 'uomo', 'uomo', 'uomo', 'uomo']);
assert.equal(makeCareerDraft('2026-09-24').gender, 'uomo', 'Il genere predefinito è uno dei due.');
for (const gender of ['non-binario', 'preferisco-non-specificare', 'altro', '', null]) assert.ok(validateCareerStep(draftOf({ gender }), 5).some(error => /genere/i.test(error)), `Il genere «${gender}» non è più accettato.`);
for (const gender of ['uomo', 'donna']) assert.deepEqual(validateCareerStep(draftOf({ gender }), 5), [], `Il genere «${gender}» è valido.`);
create({ ...draftOf({ gender: 'donna' }) }, db.parties, db.parliamentaryGroups);
assert.equal(playerOf(store.getState()).gender, 'donna');
for (const legacyValue of ['non-binario', 'preferisco-non-specificare', 'altro']) {
  const file = JSON.parse(store.exportSave());
  const record = file.dataset.politicians.find(person => person.id === file.career.playerId);
  const before = { ...record }; record.gender = legacyValue;
  const loaded = playerOf(load(JSON.stringify(file)));
  assert.equal(loaded.gender, 'uomo', `Vecchio genere «${legacyValue}»: normalizzato.`);
  assert.equal(loaded.legacyGender, legacyValue, `Vecchio genere «${legacyValue}»: l’originale è conservato.`);
  for (const [key, value] of Object.entries(before)) if (!['gender', 'legacyGender'].includes(key)) assert.deepEqual(loaded[key], value, `Vecchio genere «${legacyValue}»: ${key} intatto.`);
}
const okFile = JSON.parse(store.exportSave()), okRecord = okFile.dataset.politicians.find(person => person.id === okFile.career.playerId);
okRecord.gender = 'donna'; delete okRecord.legacyGender;
assert.ok(!('legacyGender' in playerOf(load(JSON.stringify(okFile)))), 'Un valore valido non lascia tracce.');
assert.doesNotThrow(() => validateEntity('politicians', { id: 'p1', firstName: 'A', lastName: 'B', source: 'user', gender: 'uomo', legacyGender: 'non-binario' }), 'Lo schema conosce legacyGender.');
lines.push('genere: solo uomo e donna, vecchi valori normalizzati senza perdita');

// ---------- 5. the rendering of the wizard ----------
const view = d => renderCareerWizard(store.getState(), { ...makeCareerDraft('2026-09-24'), region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', ...d }, db.parties, () => null, db.parliamentaryGroups, [], [], db.politicians, territory);
const first = view({ step: 1 });
assert.ok(first.includes('Identità e avatar') && first.includes('data-avatar-editor') && first.includes('data-avatar-preview') && first.includes('PASSAGGIO 01 <i>/</i> 06'), 'La prima schermata ha l’editor e l’anteprima.');
for (const field of A.AVATAR_FIELDS) for (const item of A.AVATAR_OPTIONS[field]) assert.ok(first.includes(`data-avatar-field="${field}" data-avatar-value="${item.id}"`), `Scelta disponibile: ${field}/${item.id}.`);
assert.equal((first.match(/data-avatar-value="[a-z]+" aria-pressed="true"/g) ?? []).length, 10, 'Per ogni tratto una scelta è attiva.');
// every choice has its sample: a colour for the colours, a small preview of the avatar for the shapes; the active one is marked
const minis = (first.match(/class="avatar-choice is-mini/g) ?? []).length, swatches = (first.match(/class="avatar-choice is-swatch/g) ?? []).length;
assert.deepEqual([minis, swatches], [2 + 3 + 12 + 3 + 5 + 3, 5 + 5 + 5 + 8], 'Anteprime per le forme (28) e campioni per i colori (23): nessuna scelta è solo testo.');
assert.ok(A.AVATAR_GROUPS.every(field => first.includes(`data-avatar-group="${field}"`)), 'Un gruppo per ogni campo, nell’ordine dell’editor.');
const miniOf = (html, field, value) => html.match(new RegExp(`<button type="button" class="avatar-choice is-mini[^"]*" data-avatar-field="${field}" data-avatar-value="${value}"[^>]*>(<svg.*?</svg>)`))?.[1];
for (const field of ['face', 'expression', 'hairstyle', 'beard', 'moustache', 'glasses']) {
  const previews = A.AVATAR_OPTIONS[field].map(item => miniOf(first, field, item.id));
  assert.ok(previews.every(Boolean) && new Set(previews).size === previews.length, `${field}: ogni scelta ha la sua mini-anteprima, diversa dalle altre.`);
  assert.ok(previews.every(svg => svg.includes('viewBox="18 8 84 84"')), `${field}: le anteprime sono ritagliate sul volto.`);
}
const changed = view({ step: 1, avatar: { ...base, face: 'femminile', hairstyle: 'lungo' } });
assert.ok(changed.includes('data-avatar="femminile.chiara.castano.lungo.nessuna.nessuno.blu.marroni.serena.nessuno"') && !changed.includes(`data-avatar="${Object.values(base).join('.')}"`), 'L’anteprima segue il draft.');
const second = view({ step: 2 }), third = view({ step: 3 });
assert.ok(second.includes('data-wizard-region') && !second.includes('data-level=') && !second.includes('data-starting-office='), 'Territorio e partenza: solo il territorio.');
assert.ok(['comunale', 'provinciale', 'regionale', 'deputato', 'senatore', 'europeo'].every(level => third.includes(`data-level="${level}"`)) && third.includes('presidenteConsiglio') && third.includes('presidenteRepubblica') && !third.includes('data-wizard-region') && third.includes('Comune di Siena'), 'Scegli la tua carriera: tutti i percorsi, più i due scenari, in una pagina propria.');
assert.ok(!third.includes('data-group-id') && !third.includes('data-pdc-context') && !third.includes('data-wizard-group-search'), 'Un percorso locale non mostra le opzioni parlamentari.');
assert.ok(view({ step: 3, initialLevel: 'deputato' }).includes('data-wizard-group-search') && view({ step: 3, startingOffice: 'presidenteConsiglio', initialLevel: 'deputato' }).includes('data-pdc-context="external"'), 'Le opzioni dipendenti compaiono solo per il percorso scelto.');
assert.ok(view({ step: 4 }).includes('data-party-mode') && view({ step: 5 }).includes('difficulty-grid') && view({ step: 6 }).includes('data-wizard-action="finish"'), 'Partito, impostazioni avanzate e riepilogo seguono nell’ordine.');
assert.ok(view({ step: 6, avatar: { ...base, face: 'femminile' } }).includes('summary-avatar') && view({ step: 6 }).includes('data-wizard-goto="3"'), 'Il riepilogo mostra l’avatar e rimanda alla schermata giusta di ogni parte.');
const goto = { identity: 1, where: 2, path: 3, party: 4 };
const summary = view({ step: 6 });
for (const [label, target] of [['01 · IDENTITÀ', goto.identity], ['02 · DOVE INIZI', goto.where], ['03 · PERCORSO ISTITUZIONALE', goto.path], ['04 · APPARTENENZA', goto.party], ['05 · DIFFICOLTÀ', 5]]) {
  const at = summary.indexOf(label); assert.ok(at > 0, `Riepilogo: ${label}.`);
  assert.ok(new RegExp(`data-wizard-goto="${target}"`).test(summary.slice(at, at + 600)), `«${label}» torna alla schermata ${target}.`);
}
lines.push('rendering delle sei schermate e dei rimandi del riepilogo');

// the PNG of the picture of the Palace is in the project (the build copies it to www/icons)
const png = await readFile(new URL('../icons/avatar-palazzo-bg.png', import.meta.url));
assert.equal(png.subarray(1, 4).toString(), 'PNG', 'icons/avatar-palazzo-bg.png è un PNG.');
assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1448, 1086], 'È l’immagine del Palazzo (1448 × 1086).');
lines.push('icons/avatar-palazzo-bg.png presente');

// ---------- 6. Chrome ----------
globalThis.fetch = realFetch; // the harness of the engine and the stand-in of the account answered in place of the network: Chrome and its server need the real one
if (!chromeAvailable) { console.log(`Avatar verificato (senza Chrome): ${lines.join('; ')}.`); process.exit(0); }
const ITALIAN = new Set('il lo la le gli un una uno di del della dei delle al alla dal nel nella sul sulla per con che non sono come più tra fra sei hai puoi questa questo quando dove cosa senza ogni è già può così'.split(' '));
const italianWords = text => (text.toLowerCase().match(/[a-zà-ù']+/g) ?? []).filter(word => ITALIAN.has(word));
const SIENA = '052032';
const FEMALE = { face: 'femminile', skin: 'oliva', hair: 'biondo', hairstyle: 'caschetto', beard: 'nessuna', glasses: 'rettangolari', jacket: 'verde', eyes: 'azzurri', expression: 'sorridente', moustache: 'nessuno' };

const tools = browser => {
  const { evaluate, waitFor, pause } = browser;
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);
  const click = async (selector, wait = 120) => { const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`); assert.ok(ok, `manca ${selector}`); await pause(wait); };
  const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`);
  const kicker = () => evaluate(`document.querySelector('.wizard-kicker')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''`);
  const title = () => text('#wizard-title');
  const next = async () => { await click('.wizard-footer [data-wizard-action="next"]', 300); };
  const back = async () => { await click('.wizard-footer [data-wizard-action="back"]', 300); };
  const preview = () => evaluate(`document.querySelector('[data-avatar-preview] svg')?.getAttribute('data-avatar') ?? ''`);
  const pressed = field => evaluate(`[...document.querySelectorAll('[data-avatar-field="${field}"][aria-pressed="true"]')].map(el => el.dataset.avatarValue)`);
  const openWizard = async () => { await click('[data-menu="nuova"]:not([disabled])', 200); await waitFor(() => has('.career-wizard')); };
  const fillIdentity = async (name = 'Ada') => {
    await setField('.career-wizard [name="firstName"]', name); await setField('.career-wizard [name="lastName"]', 'Avatar');
    await setField('.career-wizard [name="birthDate"]', '1985-04-12', 'change'); await setField('.career-wizard [name="previousProfession"]', 'Insegnante');
  };
  const pickSiena = async () => {
    await setField('[data-wizard-region]', 'Toscana', 'change');
    await waitFor(() => has('[data-wizard-municipality-search]'));
    await setField('[data-wizard-municipality-search]', 'Siena');
    await waitFor(() => has(`[data-municipality-code="${SIENA}"]`));
    await click(`[data-municipality-code="${SIENA}"]`, 250);
  };
  const stored = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${browser.version}'); const s = store.getState(); const p = s.dataset.politicians.find(item => item.id === s.career.playerId); return p ? JSON.stringify({ id: p.id, avatar: p.avatar ?? null, gender: p.gender, name: p.displayName, job: p.previousProfession, birth: p.birthDate }) : null; })()`).then(value => value && JSON.parse(value));
  const overflow = () => evaluate(`(() => { const body = document.querySelector('.wizard-body'); return body ? body.scrollWidth - body.clientWidth : 0; })()`);
  const setOnboarded = () => evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
  return { ...browser, has, text, click, setField, kicker, title, next, back, preview, pressed, openWizard, fillIdentity, pickSiena, stored, overflow, setOnboarded };
};

// ---- Italian, desktop ----
await withBrowser(async browser => {
  const t = tools(browser);
  const { evaluate, waitFor, pause, goto, errors, viewport } = t;
  await t.setOnboarded(); await goto(); await waitFor(() => t.has('[data-menu="nuova"]:not([disabled])'));
  await t.openWizard();

  // screen 1: identity and avatar
  assert.equal(await t.kicker(), 'PASSAGGIO 01 / 06', 'Sei passaggi: si comincia dal primo.');
  assert.equal(await t.title(), 'Identità e avatar');
  assert.ok(await t.has('[data-avatar-editor] [data-avatar-preview] svg'), 'L’editor ha l’anteprima.');
  assert.equal(await t.preview(), Object.values(base).join('.'), 'L’anteprima parte dall’avatar predefinito.');
  // the gender: man or woman, nothing else, a default chosen
  const genderOptions = await evaluate(`[...document.querySelectorAll('select[name="gender"] option')].map(option => [option.value, option.textContent.trim()])`);
  assert.deepEqual(genderOptions, [['uomo', 'Uomo'], ['donna', 'Donna']], 'Genere: solo Uomo e Donna.');
  assert.equal(await evaluate(`document.querySelector('select[name="gender"]').value`), 'uomo');
  assert.ok(!/non.?binari|preferisco non|neutro|altro/i.test(await (await t.text('[data-avatar-editor]')) + (await evaluate(`document.querySelector('select[name="gender"]').innerText`))), 'Nessuna opzione non binaria, neutra o «altro» nella schermata.');
  // the samples: a small preview for each shape (cropped on the head), a colour for each colour; the active one is framed
  const samples = await evaluate(`(() => { const minis = [...document.querySelectorAll('.avatar-choice.is-mini')]; const swatches = [...document.querySelectorAll('.avatar-choice.is-swatch')]; const box = el => el.getBoundingClientRect(); return { minis: minis.length, swatches: swatches.length, miniSvg: minis.every(el => el.querySelector('svg') && box(el.querySelector('svg')).width >= 48), miniLabels: minis.every(el => el.querySelector('span')?.textContent.trim()), colours: swatches.every(el => /^#/.test(el.style.getPropertyValue('--sw').trim()) || el.getAttribute('style')?.includes('--sw')), touch: [...minis, ...swatches].every(el => box(el).width >= 40 && box(el).height >= 40), tick: getComputedStyle(document.querySelector('.avatar-choice.is-mini.selected'), '::after').content, selected: document.querySelectorAll('.avatar-choice.selected').length }; })()`);
  assert.deepEqual([samples.minis, samples.swatches], [28, 23], 'Anteprime e campioni per ogni scelta.');
  assert.ok(samples.miniSvg && samples.miniLabels && samples.colours && samples.touch, 'Ogni scelta è riconoscibile (anteprima o colore, con nome) e si tocca bene.');
  assert.ok(/✓/.test(samples.tick) && samples.selected === 10, 'La scelta attiva di ogni gruppo è evidenziata.');
  // the picture of the Palace is behind the editor only: blurred, covering, with a dark veil; the avatar and the controls are not blurred
  const look = await evaluate(`(() => {
    const editor = document.querySelector('[data-avatar-editor]');
    const before = getComputedStyle(editor, '::before'), after = getComputedStyle(editor, '::after');
    const filterOf = selector => getComputedStyle(document.querySelector(selector)).filter;
    return { bg: before.backgroundImage, size: before.backgroundSize, blur: before.filter, veil: after.backgroundImage, svg: filterOf('[data-avatar-preview] svg'), controls: filterOf('.avatar-controls'), choice: filterOf('.avatar-choice'), editor: getComputedStyle(editor).filter, outside: getComputedStyle(document.querySelector('.wizard-profile')).backgroundImage };
  })()`);
  assert.ok(/avatar-palazzo-bg\.png/.test(look.bg) && look.size === 'cover', 'Sfondo: l’immagine locale del Palazzo, con cover.');
  assert.ok(/blur\(/.test(look.blur), 'Lo sfondo è sfocato.');
  assert.ok(/gradient/.test(look.veil), 'Sopra lo sfondo c’è l’overlay scuro.');
  assert.ok(!/blur/.test(look.svg + look.controls + look.choice + look.editor), 'L’avatar e i controlli non sono sfocati.');
  assert.ok(!/avatar-palazzo-bg/.test(look.outside), 'L’immagine sta solo dietro l’editor.');
  const picture = await evaluate(`fetch('/icons/avatar-palazzo-bg.png').then(response => response.blob().then(blob => ({ ok: response.ok, type: response.headers.get('content-type'), size: blob.size })))`);
  assert.ok(picture.ok && /image\/png/.test(picture.type) && picture.size > 100000, 'L’immagine locale si carica dal sito.');
  // every choice changes the preview at once and marks the choice
  for (const field of A.AVATAR_FIELDS) {
    for (const item of A.AVATAR_OPTIONS[field]) {
      await t.click(`[data-avatar-field="${field}"][data-avatar-value="${item.id}"]`, 60);
      const parts = (await t.preview()).split('.');
      assert.equal(parts[A.AVATAR_FIELDS.indexOf(field)], item.id, `${field}/${item.id}: l’anteprima si aggiorna subito.`);
      assert.deepEqual(await t.pressed(field), [item.id], `${field}/${item.id}: una sola scelta attiva.`);
    }
  }
  assert.equal(await evaluate(`document.querySelector('.wizard-body').scrollTop`), 0);
  for (const [field, value] of Object.entries(FEMALE)) await t.click(`[data-avatar-field="${field}"][data-avatar-value="${value}"]`, 60);
  assert.equal(await t.preview(), Object.values(FEMALE).join('.'));
  assert.equal(await evaluate(`document.activeElement?.dataset?.avatarValue`), 'nessuno', 'Il focus resta sulla scelta fatta.');
  // two columns on a desktop: preview on the left of the controls
  const columns = await evaluate(`(() => { const p = document.querySelector('[data-avatar-preview]').getBoundingClientRect(), c = document.querySelector('.avatar-controls').getBoundingClientRect(); return { left: p.right <= c.left + 1, tall: p.height > 150 }; })()`);
  assert.ok(columns.left && columns.tall, 'Su desktop l’anteprima sta accanto ai controlli.');
  assert.ok((await t.overflow()) <= 1, 'Nessuno scroll orizzontale.');
  // validations: no name, no step forward
  await t.next();
  assert.equal(await t.kicker(), 'PASSAGGIO 01 / 06', 'Senza i dati dell’identità non si va avanti.');
  assert.match(await t.text('.wizard-errors'), /nome/i);
  await t.fillIdentity();
  await t.next();
  assert.equal(await t.kicker(), 'PASSAGGIO 02 / 06'); assert.equal(await t.title(), 'Territorio e partenza');

  // screen 2: the territory only
  assert.ok(await t.has('[data-wizard-region]') && !(await t.has('[data-level]')) && !(await t.has('[data-starting-office]')), 'Territorio: regione, provincia e comune; niente carte del percorso.');
  await t.next();
  assert.equal(await t.kicker(), 'PASSAGGIO 02 / 06', 'Senza regione e comune non si va avanti.');
  assert.match(await t.text('.wizard-errors'), /regione/i);
  await t.pickSiena();
  assert.match(await t.text('.wizard-place-selected'), /Siena/);
  assert.ok(await t.has('[data-wizard-unit]') || await t.has('[data-wizard-more="province"]'), 'Provincia o unità territoriale: il filtro c’è.');
  await t.next();

  // screen 3: the career path, on its own page
  assert.equal(await t.kicker(), 'PASSAGGIO 03 / 06'); assert.equal(await t.title(), 'Scegli la tua carriera');
  assert.equal(await evaluate(`document.querySelectorAll('.level-cards .level-card').length`), 8, 'Otto carte: sei percorsi e i due scenari.');
  assert.ok(!(await t.has('.menu-popup')) && (await t.has('.career-wizard')), 'È una pagina del wizard, non un popup.');
  assert.ok(!(await t.has('[data-wizard-region]')) && /Siena/.test(await t.text('.career-where')), 'Il territorio scelto resta in vista, senza ripeterne i campi.');
  assert.ok(!(await t.has('[data-wizard-group-search]')) && !(await t.has('[data-pdc-context]')), 'Per un percorso locale non ci sono opzioni parlamentari.');
  await t.click('[data-level="senatore"]', 200);
  assert.ok(await t.has('[data-wizard-group-search]'), 'Il Senato mostra il gruppo parlamentare.');
  await t.next();
  assert.equal(await t.kicker(), 'PASSAGGIO 03 / 06', 'Senza gruppo il percorso parlamentare non va avanti.');
  assert.match(await t.text('.wizard-errors'), /gruppo/i);
  await t.click('[data-starting-office="presidenteConsiglio"]', 200);
  assert.ok(await t.has('[data-pdc-context="external"]'), 'Il Presidente del Consiglio mostra il suo contesto.');
  await t.click('[data-level="comunale"]', 200);
  assert.ok(!(await t.has('[data-wizard-group-search]')) && !(await t.has('[data-pdc-context]')), 'Tornati al percorso comunale spariscono le opzioni dipendenti.');
  await t.next();
  assert.equal(await t.kicker(), 'PASSAGGIO 04 / 06'); assert.ok(await t.has('[data-party-mode]'), 'Quarto: il partito.');
  await t.next();
  assert.equal(await t.kicker(), 'PASSAGGIO 05 / 06'); assert.equal(await t.title(), 'Impostazioni avanzate'); assert.ok(await t.has('.difficulty-grid'));
  await t.next();
  assert.equal(await t.kicker(), 'PASSAGGIO 06 / 06'); assert.equal(await t.title(), 'Riepilogo e avvio');
  assert.equal(await evaluate(`document.querySelector('.summary-avatar svg')?.getAttribute('data-avatar')`), Object.values(FEMALE).join('.'), 'Il riepilogo mostra l’avatar scelto.');
  // «Modifica» of each part goes to the right screen
  for (const [label, target] of [['01 · IDENTITÀ', 1], ['02 · DOVE INIZI', 2], ['03 · PERCORSO ISTITUZIONALE', 3], ['04 · APPARTENENZA', 4], ['05 · DIFFICOLTÀ', 5]]) {
    const ok = await evaluate(`(() => { const span = [...document.querySelectorAll('.summary-section-heading span')].find(el => el.textContent.trim() === ${JSON.stringify(label)}); const button = span?.closest('.summary-section-heading')?.querySelector('[data-wizard-goto]'); if (!button) return false; button.click(); return true; })()`);
    assert.ok(ok, `Riepilogo: «${label}» ha il suo «Modifica».`);
    await pause(300);
    assert.equal(await t.kicker(), `PASSAGGIO 0${target} / 06`, `«${label}» porta alla schermata ${target}.`);
    for (let i = target; i < 6; i++) await t.next();
    assert.equal(await t.kicker(), 'PASSAGGIO 06 / 06', 'E si torna al riepilogo.');
  }
  // back and forth keeps everything
  for (let expected = 5; expected >= 1; expected--) { await t.back(); assert.equal(await t.kicker(), `PASSAGGIO 0${expected} / 06`, `Indietro: schermata ${expected}.`); }
  assert.equal(await t.preview(), Object.values(FEMALE).join('.'), 'Tornando indietro l’avatar è rimasto.');
  assert.equal(await evaluate(`document.querySelector('[name="firstName"]').value`), 'Ada', 'E così i dati dell’identità.');
  assert.ok(!(await t.has('.wizard-footer [data-wizard-action="back"]')), 'Al primo passaggio non c’è «Indietro».');
  for (let i = 0; i < 5; i++) await t.next();
  assert.equal(await t.kicker(), 'PASSAGGIO 06 / 06');
  assert.equal(await evaluate(`Number(document.querySelector('.career-wizard').dataset.step)`), 6, 'Il wizard dichiara la sua schermata.');

  // cancel from the path screen: nothing is created, the avatar of the next draft starts over
  await t.click('.wizard-cancel', 300);
  assert.ok(!(await t.has('.career-wizard')) && (await t.has('[data-menu="nuova"]')), '«Annulla» torna al menu iniziale.');
  assert.equal(await evaluate(`import('/src/core/store.js?v=${t.version}').then(({ store }) => store.hasCareer())`), false, 'Nessuna carriera creata.');
  await t.openWizard();
  assert.equal(await t.preview(), Object.values(base).join('.'), 'Una nuova creazione riparte dall’avatar predefinito.');
  await t.click('[data-avatar-field="hairstyle"][data-avatar-value="stempiato"]', 60);
  await t.click('.wizard-x', 300);
  assert.ok(!(await t.has('.career-wizard')), '× annulla da qualunque passaggio.');

  // the whole flow, then the career with its avatar
  await t.openWizard();
  for (const [field, value] of Object.entries(FEMALE)) await t.click(`[data-avatar-field="${field}"][data-avatar-value="${value}"]`, 40);
  await t.fillIdentity('Beatrice');
  await t.setField('.career-wizard [name="gender"]', 'donna', 'change');
  await t.next(); await t.pickSiena(); await t.next();
  await t.click('[data-level="provinciale"]', 200);
  await t.next(); await t.next(); await t.next();
  assert.equal(await t.kicker(), 'PASSAGGIO 06 / 06');
  await t.click('.wizard-footer [data-wizard-action="finish"]', 200);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.page-wrap')) && !document.querySelector('.career-wizard')`), 40000);
  const born = await t.stored();
  assert.deepEqual(born.avatar, FEMALE, 'La carriera creata porta l’avatar scelto.');
  assert.equal(born.gender, 'donna', 'Il genere scelto è salvato, in un campo suo.');
  const signature = Object.values(FEMALE).join('.');

  // the same face wherever the player is shown
  const faces = async () => evaluate(`({ home: document.querySelector('.hq-identity .hero-avatar svg')?.getAttribute('data-avatar') ?? null, homeText: document.querySelector('.hq-identity .hero-avatar')?.textContent.trim() ?? '' })`);
  await evaluate(`location.hash = '#panoramica'`); await waitFor(() => t.has('.hq-identity .hero-avatar'));
  const home = await faces();
  assert.equal(home.home, signature, 'Home: l’avatar al posto delle iniziali.');
  assert.equal(home.homeText, '', 'Home: nessuna iniziale.');
  await evaluate(`location.hash = '#profilo'`); await waitFor(() => t.has('.profile-page-lead'));
  assert.equal(await evaluate(`document.querySelector('.profile-page-lead .hero-avatar svg')?.getAttribute('data-avatar')`), signature, 'Profilo: lo stesso avatar.');
  assert.equal(await evaluate(`document.querySelector('.profile-page-lead .hero-avatar')?.textContent.trim()`), '', 'Profilo: nessuna iniziale.');
  assert.ok(/Beatrice/.test(await t.text('.profile-page-lead')), 'Il profilo dice il nome.');
  // the party logos and the initials of other people are untouched (the rivals, the parties keep their marks)
  assert.ok(!(await evaluate(`[...document.querySelectorAll('.profile-page .party-logo, .profile-page img')].some(el => el.closest('.hero-avatar'))`)), 'I loghi dei partiti non sono toccati.');
  // persisted: after a reload
  await goto(); await waitFor(() => t.has('[data-menu="continua"]'));
  await t.click('[data-menu="continua"]', 300); await waitFor(() => t.has('.page-wrap'));
  assert.deepEqual((await t.stored()).avatar, FEMALE, 'Dopo il riavvio l’avatar è lo stesso.');
  await evaluate(`location.hash = '#profilo'`); await waitFor(() => t.has('.profile-page-lead'));
  assert.equal(await evaluate(`document.querySelector('.profile-page-lead .hero-avatar svg')?.getAttribute('data-avatar')`), signature, 'E il Profilo lo mostra ancora.');

  // an old career: no avatar in the save → the stable default, nothing else touched
  const oldLook = await evaluate(`(async () => {
    const { store } = await import('/src/core/store.js?v=${browser.version}');
    const { defaultAvatarFor } = await import('/src/core/avatar.js?v=${browser.version}');
    const file = JSON.parse(store.exportSave());
    const p = file.dataset.politicians.find(item => item.id === file.career.playerId);
    const before = JSON.stringify({ ...p, avatar: undefined });
    delete p.avatar;
    store.loadGame(JSON.stringify(file));
    const s = store.getState();
    const q = s.dataset.politicians.find(item => item.id === s.career.playerId);
    return { same: before === JSON.stringify({ ...q, avatar: undefined }), expected: Object.values(defaultAvatarFor(q.id)).join('.'), has: 'avatar' in q };
  })()`);
  assert.ok(oldLook.same, 'Vecchia carriera: nessun altro dato cambia.');
  await evaluate(`location.hash = '#panoramica'`); await pause(300); await evaluate(`location.hash = '#profilo'`); await waitFor(() => t.has('.profile-page-lead'));
  assert.equal(await evaluate(`document.querySelector('.profile-page-lead .hero-avatar svg')?.getAttribute('data-avatar')`), oldLook.expected, 'Vecchia carriera: aspetto predefinito stabile nel Profilo.');
  await goto(); await waitFor(() => t.has('[data-menu="continua"]')); await t.click('[data-menu="continua"]', 300); await waitFor(() => t.has('.page-wrap'));
  await evaluate(`location.hash = '#profilo'`); await waitFor(() => t.has('.profile-page-lead'));
  assert.equal(await evaluate(`document.querySelector('.profile-page-lead .hero-avatar svg')?.getAttribute('data-avatar')`), oldLook.expected, 'Vecchia carriera: dopo il riavvio è lo stesso aspetto.');
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
}, { language: 'it' });

// ---- the Parliament shows the same avatar ----
await withBrowser(async browser => {
  const t = tools(browser);
  await createCareerInPage(browser, { weeks: 1 });
  // the career is saved again with the avatar (as a save made after the editor would be)
  await browser.evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${browser.version}'); const file = JSON.parse(store.exportSave()); file.dataset.politicians.find(item => item.id === file.career.playerId).avatar = ${JSON.stringify(FEMALE)}; store.loadGame(JSON.stringify(file)); return true; })()`);
  await browser.goto(); await browser.waitFor(() => t.has('[data-menu="continua"]')); await t.click('[data-menu="continua"]', 300); await browser.waitFor(() => t.has('.page-wrap'));
  await browser.evaluate(`location.hash = '#parlamento'`);
  await browser.waitFor(() => t.has('.parliament-player'), 40000);
  assert.equal(await browser.evaluate(`document.querySelector('.parliament-player .player-avatar svg')?.getAttribute('data-avatar')`), Object.values(FEMALE).join('.'), 'Parlamento: lo stesso avatar.');
  assert.equal(await browser.evaluate(`document.querySelector('.parliament-player .player-avatar')?.textContent.trim()`), '', 'Parlamento: nessuna iniziale.');
  assert.deepEqual(browser.errors, []);
}, { language: 'it' });

// ---- English and a phone ----
await withBrowser(async browser => {
  const t = tools(browser);
  const { evaluate, waitFor, goto, viewport, errors } = t;
  await t.setOnboarded(); await goto(); await waitFor(() => t.has('[data-menu="nuova"]:not([disabled])'));
  await viewport(375, 740, true);
  await t.openWizard();
  assert.equal(await t.title(), 'Identity and avatar');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('select[name="gender"] option')].map(option => option.textContent.trim())`), ['Man', 'Woman'], 'Inglese: Man e Woman, nient’altro.');
  const editor = await t.text('[data-avatar-editor]');
  for (const word of ['Face', 'Skin tone', 'Hair', 'Hairstyle', 'Beard', 'Glasses', 'Jacket', 'Masculine', 'Feminine', 'Curly', 'Bob', 'Updo', 'Receding', 'Round', 'Rectangular', 'No beard', 'No glasses', 'Calm', 'Smiling', 'Determined', 'Buzz cut', 'Ponytail', 'Wavy', 'No moustache', 'Handlebar moustache', 'Eye colour', 'Moustache']) assert.ok(editor.toLowerCase().includes(word.toLowerCase()), `Inglese: «${word}».`);
  assert.deepEqual(italianWords(editor), [], 'Inglese: nessuna parola italiana nell’editor.');
  assert.match(await evaluate(`document.querySelector('[data-avatar-field="skin"][data-avatar-value="oliva"]').getAttribute('aria-label')`), /Olive skin/, 'Anche i nomi accessibili dei colori sono in inglese.');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-avatar-field="eyes"]')].map(el => el.getAttribute('aria-label'))`), ['Brown eyes', 'Hazel eyes', 'Green eyes', 'Blue eyes', 'Grey eyes'], 'Inglese: i colori degli occhi.');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-avatar-field="jacket"]')].map(el => el.getAttribute('aria-label'))`), ['Midnight blue jacket', 'Burgundy jacket', 'Forest green jacket', 'Charcoal jacket', 'Black jacket', 'Camel jacket', 'Plum jacket', 'Teal jacket'], 'Inglese: le otto giacche.');
  assert.match(await evaluate(`document.querySelector('[data-avatar-preview] svg').getAttribute('aria-label')`), /avatar/i);
  assert.deepEqual(italianWords((await evaluate(`document.querySelector('.wizard-header').innerText`))), [], 'Inglese: intestazione del wizard.');
  // phone: one column, nothing sideways, touch targets of at least 40 px, the preview in full view
  const phone = await evaluate(`(() => { const body = document.querySelector('.wizard-body'); const p = document.querySelector('[data-avatar-preview]').getBoundingClientRect(), c = document.querySelector('.avatar-controls').getBoundingClientRect(); const small = [...document.querySelectorAll('.avatar-choice')].filter(el => { const r = el.getBoundingClientRect(); return r.height < 40 || r.width < 40; }).length; return { over: body.scrollWidth - body.clientWidth, stacked: p.bottom <= c.top + 1, small, previewW: Math.round(p.width), vw: innerWidth, pageOver: document.documentElement.scrollWidth - innerWidth }; })()`);
  assert.ok(phone.over <= 1 && phone.pageOver <= 1, `Telefono: nessuno scroll orizzontale (${JSON.stringify(phone)}).`);
  assert.ok(phone.stacked && phone.previewW > 150 && phone.previewW <= phone.vw, 'Telefono: l’anteprima sta sopra i controlli, per intero.');
  assert.equal(phone.small, 0, 'Telefono: ogni scelta si tocca bene (almeno 40 px).');
  await t.click('[data-avatar-field="face"][data-avatar-value="maschile"]', 60);
  assert.ok((await t.preview()).startsWith('maschile.'), 'Telefono: l’anteprima si aggiorna.');
  await t.fillIdentity('Ada'); await t.next(); await t.pickSiena(); await t.next();
  assert.equal(await t.title(), 'Choose your career');
  assert.deepEqual(italianWords(await t.text('.wizard-body')), [], 'Inglese: la pagina della carriera non ha parole italiane.');
  assert.ok((await t.overflow()) <= 1, 'Telefono: la pagina della carriera non scorre di lato.');
  assert.equal(await evaluate(`document.querySelectorAll('.level-cards .level-card').length`), 8);
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
}, { language: 'en' });
console.log(`Avatar e nuovo wizard verificati: ${lines.join('; ')}; in Chrome, in italiano e in inglese e su telefono (375 px), le sei schermate nell’ordine, l’editor con anteprima immediata e sfondo sfocato solo dietro, avanti e indietro, annulla, validazioni, la carriera creata con il suo avatar (distinto dal genere) in Home, Profilo e Parlamento, dopo il riavvio e per una vecchia carriera.`);
process.exit(0);
