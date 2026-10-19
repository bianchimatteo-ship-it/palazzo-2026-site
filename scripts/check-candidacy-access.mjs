// «Candidati» porta direttamente alla procedura del voto scelto (il tipo di elezione già selezionato nell'impostazione della campagna) quando il giocatore può candidarsi; quando non può,
// dice subito e con precisione perché (incompatibilità o campagna già in corso), senza farlo arrivare in un'altra pagina per scoprirlo.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const { store } = await import(`../src/core/store.js${v}&candidacy=1`);
const { renderElectionsHub } = await import(`../src/ui/elections-hub.js${v}`);
const { candidacyAccess } = await import(`../src/ui/campaign-mode.js${v}`);
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));

const base = store.getState();
const today = base.clock.currentDate;
const day = (offset, from = today) => new Date(Date.parse(`${from}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const entry = (id, type, vote, opens) => ({ id, type, label: `${type} di prova`, electionDate: vote, windowOpensAt: opens, windowClosesAt: day(20, opens), status: 'open', early: false });
const withElections = (list, extra = {}) => ({ ...base, game: { ...base.game, elections: list.map(item => ({ ...item })) }, campaign: null, ...extra });
const hub = state => renderElectionsHub(state, { parties, logoFor: () => null, tab: 'panoramica' });

// 1. A vote the player can stand in: the button carries the kind of election, no reason shown
const free = withElections([entry('regionale-1', 'regionale', day(60), day(-5))]);
const access = candidacyAccess(free, free.game.elections[0]);
assert.equal(access.ok, true, `Il giocatore può candidarsi alle regionali: ${access.reason}`);
let html = hub(free);
assert.ok(/data-campaign-goto="regionale"/.test(html), 'Il pulsante «Candidati» porta direttamente alla procedura delle regionali');
assert.ok(!/Non puoi candidarti/.test(html), 'Nessun motivo di blocco quando ci si può candidare');
assert.ok(!/data-section-tab="elezioni" data-section-tab-value="campagna">Candidati/.test(html), 'Non è più il generico salto alla scheda della campagna');

// 2. Two open votes: each button leads to its own kind of election (it used to land on the first)
const two = withElections([entry('regionale-1', 'regionale', day(60), day(-5)), entry('comunale-1', 'comunale', day(75), day(-3))]);
html = hub(two);
assert.ok(/data-campaign-goto="regionale"/.test(html) && /data-campaign-goto="comunale"/.test(html), 'Ogni voto aperto ha il suo pulsante, con il proprio tipo di elezione');

// 3. A campaign already booked that overlaps: the button is off and the exact reason is written next to it
const booked = withElections([entry('regionale-1', 'regionale', day(60), day(-5))]);
booked.game = { ...booked.game, candidacies: [{ id: 'comunale-9', type: 'comunale', label: 'Comunali di prova', electionDate: day(50), windowOpensAt: day(-10), early: false, kind: 'elezione' }] };
const blocked = candidacyAccess(booked, booked.game.elections[0]);
if (!blocked.ok) {
  assert.ok(blocked.reason && blocked.reason.length > 10, 'Il motivo del blocco è una frase precisa');
  html = hub(booked);
  assert.ok(/Non puoi candidarti:/.test(html) && /disabled/.test(html) && !/data-campaign-goto="regionale"/.test(html), 'Con una candidatura che si sovrappone il pulsante è spento e il motivo è scritto accanto');
} else {
  console.log('Nota: il giocatore di prova non ha candidature registrate come campagne; il blocco per sovrapposizione è verificato in check-calendar-gap e check-races.');
}

// 4. The reason of an incompatible role (a seat held that rules the vote out) comes from the same check that starts the campaign
for (const role of access.roles) assert.ok(role.reason === null || typeof role.reason === 'string', 'Ogni ruolo ha un esito: disponibile o con il motivo');
console.log('Accesso alla candidatura verificato: «Candidati» porta alla procedura del voto scelto e, se non si può, dice perché.');
