// Territorial committees and the logo editor. Committees: Region → Province → Comune on the ISTAT map, states from
// foundation to dissolution, player actions with costs, a crisis decision, and real effects on campaigns (volunteers,
// organisation, candidacy, local support), results and promotions. Logo editor: crop frame (free/square ratio, zoom
// and pan, transparent margins), background knock-out, dominant colour, metadata kept with the logo.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const units = await read('territorial-units');
const groups = await read('parliamentary-groups');
const parties = await read('parties');
const unitsSnapshot = JSON.stringify(units);
const committeesEngine = await import(`../src/core/committee-engine.js${v}`);
const logo = await import(`../src/core/logo-editor.js${v}`);
const { panFromDrag } = await import(`../src/ui/logo-editor-view.js${v}`);
const { store } = await import(`../src/core/store.js${v}`);
const { renderPartyPage } = await import(`../src/ui/party-page.js${v}`);
const { progressionFactors } = await import(`../src/core/progression-engine.js${v}`);
const { saveLocalLogo, getLocalLogo } = await import(`../src/data/repositories/logo-store.js${v}`);
const clean = html => { const text = html.replace(/data-[a-z-]+="[^"]*"/g, ''); const match = text.match(/undefined|NaN|\[object Object\]|Infinity/); if (match) console.error(`…${text.slice(Math.max(0, match.index - 120), match.index + 30)}…`); return !match; };
const seeded = seed => { let state = seed >>> 0 || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const { COMMITTEE_STATES, committeeStrength, createCommittees, advanceCommittees, applyCommitteeAction, foundCommittee, committeeSupport, committeesAfterVote, committeeSummary } = committeesEngine;

// ---------- 1. committees on the ISTAT map ----------
const org = { sections: [{ region: 'Toscana', members: 2400, vitality: 58 }, { region: 'Lazio', members: 3100, vitality: 44 }], priorities: { territorio: 1 }, cohesion: 58, treasury: { balance: 5000 }, growth: 0.2 };
const currents = [{ id: 'riformisti', label: 'Area riformista', value: 55, strength: 40 }, { id: 'territori', label: 'Area dei territori', value: 48, strength: 34 }];
const home = { region: 'Toscana', municipality: 'Siena', provinceCode: null, provinceName: null };
org.committees = createCommittees(org, { region: 'Toscana', units, home, currents, rank: 1, founder: false, week: 1, rand: seeded(7) });
const toscana = units.filter(unit => unit.gameRegion === 'Toscana');
assert.equal(org.committees.filter(item => item.level === 'regione').length, 2, 'Un comitato regionale per ogni federazione.');
assert.equal(org.committees.filter(item => item.level === 'provincia').length, toscana.length, `Un comitato per ogni provincia toscana (${toscana.length}).`);
const siena = org.committees.find(item => item.level === 'comune');
assert.ok(siena && siena.name === 'Siena' && siena.unitCode === toscana.find(unit => unit.name === 'Siena').code, 'Il comune del giocatore è collegato alla sua provincia ISTAT (anche per carriere senza codice).');
assert.ok(siena.leader.player, 'Da coordinatore locale guidi il comitato del tuo comune.');
assert.ok(org.committees.every(item => item.source === 'simulation' && COMMITTEE_STATES[item.status] && committeeStrength(item) >= 0 && committeeStrength(item) <= 100), 'Comitati simulati con stato e forza validi.');
assert.ok(org.committees.filter(item => item.level !== 'comune' && !item.leader.player).every(item => /figura simulata/.test(item.leader.label)), 'I responsabili sono figure simulate, mai persone reali.');
assert.equal(JSON.stringify(units), unitsSnapshot, 'I dati ISTAT non cambiano.');

// ---------- 2. a year of territorial life, and every state reachable ----------
const seen = new Set(org.committees.map(item => item.status));
const random = seeded(11);
for (let week = 2; week <= 60; week++) advanceCommittees(org, { rand: random, week, regionalShares: { Toscana: 14, Lazio: 9 }, nationalShare: 11, currents });
for (const item of org.committees) seen.add(item.status);
assert.ok(org.committees.every(item => item.organization >= 0 && item.organization <= 100 && item.loyalty >= 0 && item.loyalty <= 100 && item.members >= 0), 'Valori sempre nei limiti.');
assert.ok(org.committees.find(item => item.level === 'regione' && item.region === 'Toscana').consensus > 50, 'Dove il partito va meglio della media il consenso locale è sopra 50.');
// A neglected committee in the hands of a hostile area: crisis, then loss of control, then dissolution.
const pisa = org.committees.find(item => item.level === 'provincia' && item.name === 'Pisa');
Object.assign(pisa, { organization: 28, loyalty: 30, status: 'crescita', statusSince: 0, leader: { label: 'Coordinamento provinciale (figura simulata)', currentId: 'territori', player: false } });
currents[1].value = 10;
const path = [];
for (let week = 61; week <= 200 && pisa.status !== 'dissoluzione'; week++) {
  pisa.organization = Math.max(0, pisa.organization - 2);
  advanceCommittees(org, { rand: random, week, currents });
  if (path.at(-1) !== pisa.status) path.push(pisa.status);
}
for (const status of path) seen.add(status);
assert.ok(path.includes('crisi') && path.includes('perdita-controllo') && path.at(-1) === 'dissoluzione', `Un comitato abbandonato passa da crisi e perdita del controllo alla dissoluzione (${path.join(' → ')}).`);
assert.equal(pisa.members, 0, 'Un comitato sciolto non ha più iscritti.');
// Foundation and growth: a new committee starts in foundation and grows with work.
const lucca = org.committees.find(item => item.name === 'Lucca');
if (lucca) lucca.status = 'dissoluzione';
const refounded = foundCommittee(org, { level: 'provincia', name: 'Lucca', region: 'Toscana', week: 201, currents, rand: random, extra: { unitCode: toscana.find(unit => unit.name === 'Lucca').code } });
assert.equal(refounded.status, 'fondazione', 'Un comitato rifondato riparte dalla fondazione.');
seen.add(refounded.status);
for (let week = 202; week <= 240; week++) { if (week % 3 === 0) applyCommitteeAction(org, refounded, 'rilancia', { week, rand: random, currents }); advanceCommittees(org, { rand: random, week, currents }); }
seen.add(refounded.status);
assert.ok(['crescita', 'consolidamento'].includes(refounded.status), `Con visite regolari il comitato cresce (${refounded.status}).`);
for (const status of Object.keys(COMMITTEE_STATES)) assert.ok(seen.has(status), `Stato raggiunto: ${status}.`);
assert.throws(() => applyCommitteeAction(org, pisa, 'rilancia', { week: 241 }), /sciolto/, 'Un comitato sciolto non si rilancia: si rifonda.');
assert.throws(() => applyCommitteeAction(org, refounded, 'commissaria', { week: 241, leader: false }), /guida il partito/, 'Solo chi guida il partito commissaria.');

// ---------- 3. effects: campaign support, the vote, promotions ----------
const strong = committeeSupport(org, { electionType: 'comunale', region: 'Toscana', municipality: 'Siena' });
assert.ok(strong.committees.length >= 2 && strong.volunteers >= 0 && Math.abs(strong.localSupport) <= 1.5 && Math.abs(strong.nomination) <= 0.6, 'Alle comunali contano il comitato comunale e quello provinciale.');
const regional = committeeSupport(org, { electionType: 'regionale', region: 'Toscana' });
assert.ok(regional.committees.some(item => item.level === 'regione') && regional.committees.some(item => item.level === 'provincia'), 'Alle regionali contano la regione e le province.');
const siena0 = siena.organization;
const lines = committeesAfterVote(org, { mandate: true, electionType: 'comunale', region: 'Toscana', municipality: 'Siena', week: 250 });
assert.ok(lines.length && siena.organization >= siena0, 'Una vittoria rafforza i comitati del territorio.');
const lost = { ...org, committees: org.committees.map(item => item.level === 'comune' ? { ...item, status: 'perdita-controllo', loyalty: 10 } : item) };
assert.ok(committeeSupport(lost, { electionType: 'comunale', region: 'Toscana', municipality: 'Siena' }).nomination < 0, 'Un comitato fuori controllo pesa contro la candidatura.');
assert.ok(committeeSummary(org).total === org.committees.length, 'Riepilogo della rete.');

// ---------- 4. the career: actions with costs, a crisis decision, campaign and weekly life ----------
const volt = parties.find(item => item.id === 'party-registro-p1-2024-71-ir');
store.createCareer({ firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia', previousProfession: 'Architetta', initialLevel: 'comunale', partyMode: 'existing', partyId: volt.id, parliamentStartMode: 'real-context', parliamentaryGroupId: '', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, [volt], groups);
assert.ok(store.initializeCommittees(units), 'I comitati nascono quando i territori ISTAT sono disponibili.');
assert.equal(store.initializeCommittees(units), false, '…una volta sola.');
let state = store.getState();
const mine = state.game.party.org.committees.find(item => item.level === 'comune');
assert.ok(mine && mine.unitCode === '052', 'Comitato del comune del giocatore nella sua provincia.');
const before = { ap: state.game.week.ap, funds: state.game.resources.funds };
store.committeeAction('rilancia', { committeeId: mine.id });
store.committeeAction('finanzia', { committeeId: mine.id });
state = store.getState();
assert.equal(state.game.week.ap, before.ap - 1, 'La visita costa un giorno.');
assert.equal(state.game.resources.funds, before.funds - 800, 'Finanziare costa 800 €.');
assert.ok(state.game.party.org.committees.find(item => item.id === mine.id).fundedUntil > state.game.week.index, 'Il finanziamento dura alcune settimane.');
assert.ok(state.game.log.some(item => /Visita e rilancia/.test(item.title)), 'L’azione entra nel diario.');
assert.throws(() => store.committeeAction('commissaria', { committeeId: mine.id }), /guida il partito/, 'Un iscritto non commissaria.');
const unit = units.find(item => item.gameRegion === 'Umbria');
store.getState().game.week.ap = 0;
assert.throws(() => store.committeeAction('fonda', { level: 'provincia', name: unit.name, region: 'Umbria', unitCode: unit.code }), /giorni/, 'Senza giorni non si fonda nulla.');
store.getState().game.week.ap = 6; store.getState().game.resources.funds = 5000;
store.committeeAction('fonda', { level: 'provincia', name: unit.name, region: 'Umbria', unitCode: unit.code, unitType: unit.type });
assert.ok(store.getState().game.party.org.committees.some(item => item.name === unit.name && item.status === 'fondazione'), 'Un nuovo comitato provinciale nasce in fondazione.');
// A crisis in the player's own territory becomes a decision in the agenda.
const game = store.getState().game;
const homeProvince = game.party.org.committees.find(item => item.level === 'provincia' && item.unitCode === '052');
Object.assign(homeProvince, { organization: 20, status: 'crescita', statusSince: -10, lastVisitWeek: null, fundedUntil: null });
for (let index = 0; index < 4 && !store.getState().game.inbox.some(item => item.templateId === 'comitato-in-crisi'); index++) { const current = store.getState().game.party.org.committees.find(item => item.id === homeProvince.id); if (current.status === 'crescita') Object.assign(current, { organization: 12, statusSince: -10 }); store.advance(7); }
const crisis = store.getState().game.inbox.find(item => item.templateId === 'comitato-in-crisi');
assert.ok(crisis && crisis.choices.some(choice => choice.id === 'intervieni') && crisis.choices.some(choice => choice.id === 'commissaria'), 'Un comitato di casa in crisi apre una decisione in agenda.');
store.getState().game.week.ap = 6; store.getState().game.resources.politicalCapital = 20;
store.resolveAgendaItem(crisis.id, 'intervieni');
assert.ok(store.getState().game.party.org.committees.find(item => item.id === homeProvince.id).organization > 12, 'Intervenire rimette in piedi il comitato.');
// Promotions: the territory factor reads the committees of the player's territory.
const factors = progressionFactors({ game: store.getState().game, stats: { popularity: 50 } });
assert.ok(Number.isFinite(factors.territory) && factors.territory > 0, 'Le promozioni leggono il radicamento dei comitati.');
// The Partito section, Territorio tab.
state = store.getState();
const html = renderPartyPage(state, { tab: 'territorio', record: volt, logoFor: () => null, territory: { units, home: store.homePlace(), filter: 'tutti' } });
assert.ok(html.includes('cm-panel') && html.includes('IL TUO TERRITORIO') && html.includes('Siena') && html.includes('data-committee-action="rilancia"') && clean(html), 'Scheda Territorio del Partito.');
for (const filter of ['attivi', 'problemi', 'sciolti']) assert.ok(clean(renderPartyPage(state, { tab: 'territorio', record: volt, territory: { units, home: store.homePlace(), filter } })), `Filtro ${filter}.`);
// The campaign starts with the committees of the territory: volunteers, organisation, candidacy, local support.
store.getState().game.party.support = 70;
if (!store.getState().game.elections.some(item => item.type === 'comunale' && item.status === 'open')) store.fastForwardToElection('comunale');
store.startCampaign({ electionType: 'comunale', role: 'consigliere', objective: 'win' }, [volt]);
const campaign = store.getState().campaign;
assert.ok(campaign.preparation.committees && campaign.preparation.committees.committees.length >= 2, 'La campagna registra il contributo dei comitati del comune e della provincia.');
assert.ok(campaign.history.some(item => /Comitati del territorio/.test(item.text)), 'Il contributo dei comitati è nella cronaca della campagna.');
assert.ok(Number.isFinite(campaign.preparation.committees.localSupport) && Number.isFinite(campaign.preparation.committees.nomination), 'Consenso locale e peso sulla candidatura calcolati.');

// ---------- 5. logo editor ----------
const editor = logo.createEditorState({ width: 600, height: 300, name: 'logo.png', type: 'image/png' });
assert.equal(editor.aspect, 2, 'Proporzione iniziale = quella dell’immagine.');
assert.ok(logo.untouched(editor), 'Senza modifiche il file originale resta com’è (un SVG resta vettoriale).');
let rect = logo.cropRect({ width: 600, height: 300, aspect: 2, zoom: 1 });
assert.deepEqual(rect, { sx: 0, sy: 0, sw: 600, sh: 300 }, 'Zoom 1 e proporzione naturale: tutta l’immagine.');
rect = logo.cropRect({ width: 600, height: 300, aspect: 1, zoom: 1 });
assert.ok(rect.sw === 300 && rect.sh === 300 && rect.sx === 150, 'Quadrata: il quadrato più grande al centro.');
rect = logo.cropRect({ width: 600, height: 300, aspect: 1, zoom: 0.5 });
assert.ok(rect.sw === 600 && rect.sy < 0, 'Zoom sotto 1: la cornice supera l’immagine e lascia margini trasparenti (il logo non si taglia).');
rect = logo.cropRect({ width: 600, height: 300, aspect: 1, zoom: 2, panX: 1 });
assert.ok(rect.sx + rect.sw <= 600.01 && rect.sx > 300, 'Spostamento fino al bordo destro.');
assert.deepEqual(logo.outputSize({ sw: 1200, sh: 600 }), { width: 512, height: 256 }, 'Uscita al massimo 512 px.');
assert.deepEqual(logo.outputSize({ sw: 30, sh: 30 }), { width: 64, height: 64 }, 'E mai sotto 64 px.');
const drag = panFromDrag({ ...editor, ratio: 'quadrata', zoom: 2 }, 40, 0, 0.5);
assert.ok(drag.panX < 0 && drag.panX >= -1 && drag.panY === 0, 'Trascinare a destra sposta la cornice verso sinistra.');
// Pixels: white background knocked out, the red kept, the dominant colour found.
const pixels = new Uint8ClampedArray(20 * 10 * 4);
for (let index = 0; index < 200; index++) { const x = index % 20; const red = x >= 5 && x < 15; pixels.set(red ? [200, 16, 46, 255] : [255, 255, 255, 255], index * 4); }
const background = logo.backgroundColor(pixels, 20, 10);
assert.deepEqual(background, [255, 255, 255], 'Lo sfondo si misura agli angoli.');
assert.equal(logo.dominantColor(pixels), '#c8102e', 'Colore dominante: il rosso, non il bianco dello sfondo.');
const cleared = logo.knockOut(pixels, background, 18);
assert.ok(cleared === 100 && pixels[3] === 0 && pixels[5 * 4 + 3] === 255, 'Lo sfondo uniforme diventa trasparente, il logo resta.');
assert.equal(logo.dominantColor(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0])), null, 'Nessun colore in un’immagine bianca o trasparente.');
const meta = logo.editorMetadata({ ...editor, ratio: 'quadrata', zoom: 0.8, transparent: true }, { dominant: '#c8102e', cleared: 100 });
assert.ok(meta.crop && meta.ratio === 'quadrata' && meta.transparent && meta.original.name === 'logo.png' && meta.dominantColor === '#c8102e', 'I metadati conservano ritaglio, proporzione, trasparenza, colore e file originale.');
// The logo store keeps the editor's metadata next to source and verification.
const saved = await saveLocalLogo('party-prova', { blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), fileName: 'logo.png', source: 'https://example.org', verified: true, alt: 'Logo di prova', editor: meta });
assert.ok(saved.editor?.crop && saved.verified === true && saved.source === 'https://example.org', 'Il logo salvato conserva metadati, fonte e verifica.');
assert.equal((await getLocalLogo('party-prova')).editor.ratio, 'quadrata', 'I metadati si rileggono.');
// No forced circle: logos keep their shape.
const css = await readFile(new URL('../src/sections.css', import.meta.url), 'utf8');
assert.ok(/\.emblem\.has-logo \{[^}]*border-radius: 8px/.test(css), 'I loghi non sono forzati in un cerchio.');

console.log(`Territorio e loghi verificati: ${org.committees.length} comitati sulla mappa ISTAT (regione → ${toscana.length} province → comune), tutti gli stati (${[...seen].join(', ')}), azioni con costi, decisione per un comitato in crisi, effetti su campagna, voto e promozioni; editor dei loghi con ritaglio libero/quadrato, zoom e spostamento con margini trasparenti, sfondo trasparente, colore dominante e metadati conservati.`);
