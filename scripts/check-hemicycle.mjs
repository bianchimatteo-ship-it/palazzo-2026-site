// The interactive Parliament: real permanent committees (official open data), a hemicycle per chamber with one seat
// per real parliamentarian in office (plus the player's seat), groups from left to right with the same colour in both
// chambers, and simulated votes seat by seat — in favour, against, abstaining — whose totals always match the group
// totals decided by the engine; dissenters are drawn among members (never among group presidents or party leaders),
// snipers of a secret ballot are counted and never named.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const db = Object.fromEntries(await Promise.all([['parties', 'parties'], ['politicalMovements', 'political-movements'], ['coalitions', 'coalitions'], ['electoralLists', 'electoral-lists'], ['partyMemberships', 'party-memberships'], ['parliamentaryGroups', 'parliamentary-groups'], ['politicians', 'politicians'], ['offices', 'offices'], ['committees', 'committees'], ['committeeMemberships', 'committee-memberships'], ['partyLeaderships', 'party-leaderships'], ['politicalFigures', 'political-figures']].map(async ([key, file]) => [key, await read(file)])));
const snapshot = JSON.stringify(db.politicians) + JSON.stringify(db.committees) + JSON.stringify(db.committeeMemberships);
const { CHART_SLOTS } = await import(`../src/data/simulation/polling-rules.js${v}`);
const hemi = await import(`../src/core/hemicycle.js${v}`);
const votes = await import(`../src/core/vote-engine.js${v}`);
const engine = await import(`../src/core/parliament-engine.js${v}`);
const { renderHemicycle } = await import(`../src/ui/hemicycle-view.js${v}`);
// Invalid values in the HTML are reported with their context, to find them at once.
const clean = html => {
  const text = html.replace(/data-[a-z-]+="[^"]*"/g, '');
  const match = text.match(/undefined|NaN|\[object Object\]|Infinity/);
  if (match) console.error(`Valore non valido: …${text.slice(Math.max(0, match.index - 140), match.index + 30)}…`);
  return !match;
};

// ---------- 1. real committees ----------
const inOffice = new Map(db.politicians.filter(person => !person.termEnd).map(person => [person.id, person]));
assert.equal(db.committees.filter(item => item.chamber === 'camera').length, 14, '14 commissioni permanenti alla Camera.');
assert.equal(db.committees.filter(item => item.chamber === 'senato').length, 10, '10 commissioni permanenti al Senato.');
for (const committee of db.committees) {
  const rows = db.committeeMemberships.filter(row => row.committeeId === committee.id);
  assert.ok(committee.source === 'real' && committee.verified === true && /^http:\/\/dati\.(camera|senato)\.it\//.test(committee.sourceUrl), `${committee.id}: fonte ufficiale.`);
  assert.ok(rows.length >= 15 && rows.length === committee.memberCount, `${committee.id}: componenti coerenti (${rows.length}).`);
  assert.ok(rows.filter(row => row.role === 'Presidente').length <= 1, `${committee.id}: al massimo un presidente.`);
  assert.ok(rows.every(row => inOffice.get(row.politicianId)?.chamber === committee.chamber), `${committee.id}: solo parlamentari in carica della stessa Camera.`);
}
const withCommittee = new Set(db.committeeMemberships.map(row => row.politicianId));
const without = [...inOffice.values()].filter(person => !withCommittee.has(person.id));
assert.ok(without.length <= 4, `Quasi tutti i parlamentari sono in una commissione permanente (senza: ${without.map(person => person.fullName).join(', ')}).`);

// ---------- 2. layout ----------
for (const count of [1, 12, 206, 399, 400]) {
  const layout = hemi.hemicycleLayout(count);
  assert.equal(layout.seats.length, count, `Layout con ${count} seggi.`);
  assert.ok(layout.seats.every(seat => seat.x >= 0 && seat.x <= layout.width && seat.y >= 0 && seat.y <= layout.height), 'Tutti i seggi dentro il disegno.');
  if (count > 50) {
    let min = Infinity;
    for (let i = 0; i < layout.seats.length; i++) for (let j = i + 1; j < layout.seats.length; j++) min = Math.min(min, Math.hypot(layout.seats[i].x - layout.seats[j].x, layout.seats[i].y - layout.seats[j].y));
    assert.ok(min >= layout.radius * 2, `Nessun seggio sovrapposto (${count}: distanza ${min.toFixed(1)}, raggio ${layout.radius.toFixed(1)}).`);
  }
  for (let i = 1; i < layout.seats.length; i++) assert.ok(layout.seats[i - 1].angle >= layout.seats[i].angle, 'Seggi ordinati da sinistra a destra.');
}

// ---------- 3. roster: the real composition with the player's seat ----------
const parliament = engine.createParliamentState({ career: { parliamentContext: { chamber: 'camera', groupId: 'cam-xix-04' } }, player: { id: 'giocatore' }, groups: db.parliamentaryGroups, currentDate: '2026-09-25', politicalCapital: 60 });
const rosters = Object.fromEntries(['camera', 'senato'].map(chamber => [chamber, hemi.chamberRoster(parliament, chamber, { politicians: db.politicians, db })]));
for (const [chamber, roster] of Object.entries(rosters)) {
  const seats = parliament.chambers[chamber].groups.reduce((sum, group) => sum + group.simulatedSeats, 0);
  assert.equal(roster.total, seats, `${chamber}: un marker per seggio dello scenario (${seats}).`);
  const ids = roster.seats.filter(seat => seat.person).map(seat => seat.person.id);
  assert.equal(new Set(ids).size, ids.length, `${chamber}: nessun parlamentare due volte.`);
  const expected = [...inOffice.values()].filter(person => person.chamber === chamber).length;
  assert.ok(ids.length >= expected - 2, `${chamber}: tutti i parlamentari in carica hanno un seggio (${ids.length}/${expected}).`);
  assert.ok(roster.groups.every((group, index) => index === 0 || roster.groups[index - 1].axis <= group.axis), `${chamber}: gruppi da sinistra a destra.`);
  assert.ok(new Set(roster.groups.filter(group => CHART_SLOTS.includes(group.color)).map(group => group.color)).size === roster.groups.filter(group => CHART_SLOTS.includes(group.color)).length, `${chamber}: nessun colore della tavolozza ripetuto.`);
  // Seats of the same group are contiguous: a wedge, not scattered dots.
  const order = roster.seats.map(seat => seat.groupId);
  for (const group of roster.groups) { const first = order.indexOf(group.groupId); const last = order.lastIndexOf(group.groupId); assert.ok(last - first + 1 === group.seats, `${chamber}: il gruppo ${group.shortName} occupa seggi contigui.`); }
}
assert.equal(rosters.camera.seats.filter(seat => seat.player).length, 1, 'Il seggio del giocatore c’è alla Camera.');
assert.equal(rosters.senato.seats.filter(seat => seat.player).length, 0, '…e non al Senato.');
assert.equal(rosters.camera.seats.find(seat => seat.player).groupId, 'cam-xix-04', 'Nel suo gruppo.');
const colorOf = (chamber, pattern) => rosters[chamber].groups.find(group => pattern.test(group.name))?.color;
for (const pattern of [/^Fratelli d'Italia/, /^Partito Democratico/, /^MoVimento 5 Stelle/, /^Forza Italia/, /^Lega/]) assert.equal(colorOf('camera', pattern), colorOf('senato', pattern), `Stesso colore alla Camera e al Senato per ${pattern}.`);
const committees = hemi.committeesOf(db.committeeMemberships[0].politicianId, db);
assert.ok(committees.length >= 1 && committees[0].committee?.name, 'Le commissioni di un parlamentare hanno nome e ruolo.');

// ---------- 4. votes: engine totals, seat by seat ----------
let date = '2026-09-25';
const later = days => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); date = value.toISOString().slice(0, 10); return date; };
// A Government first (its confidence is a roll-call vote with a breakdown by group), then a bill of the majority.
let state = engine.formGovernment(parliament, ['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'cam-xix-09', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56', 'senato-xix-gruppo-92'], later(7));
state = engine.voteGovernmentConfidence(state, later(1));
let result = engine.proposeLaw(state, { title: 'Riforma di prova delle commissioni', category: 'Pubblica amministrazione', summary: 'Proposta simulata per il test delle commissioni.', currentDate: date });
state = result.parliament;
const lawId = result.law.id;
state = engine.advanceLaw(state, lawId, 'present', later(70)).parliament;
state = engine.advanceLaw(state, lawId, 'complete-commission', later(70)).parliament;
state = { ...state, laws: state.laws.map(law => law.id === lawId ? { ...law, snipers: true } : law) };
const voted = engine.advanceLaw(state, lawId, 'vote', later(70));
state = voted.parliament;
const vote = voted.vote;
assert.ok(vote.id && vote.date === date && vote.kind === 'legge' && vote.secret === true, 'Il voto ha identificativo, data, tipo e voto segreto.');
assert.equal(vote.no, vote.total - vote.yes, '“no” resta “non favorevoli” per la regola del gioco.');
assert.equal(vote.against + vote.abstain, vote.total - vote.yes, 'Contrari e astenuti sommano i non favorevoli.');
for (const row of vote.byGroup) assert.equal(row.yesVotes + row.noVotes + row.abstainVotes, row.simulatedSeats, `Gruppo ${row.groupId}: sì + no + astenuti = seggi.`);
const secret = votes.voteSummary(vote);
const secretSeats = votes.individualVotes(secret, rosters[vote.chamber].seats);
assert.ok(secretSeats.choices.every(choice => choice === 'segreto') && secretSeats.dissenters.length === 0, 'Nel voto segreto i singoli non sono noti e nessuno è indicato come franco tiratore.');
assert.ok(secret.groups.every(row => row.snipers === 0 || row.governing), 'Franchi tiratori solo nei gruppi di maggioranza.');
assert.ok(secret.snipers > 0, `Nel voto segreto la maggioranza perde qualche voto (${secret.snipers} franchi tiratori stimati).`);
// An open vote on the same seats (the vote is replayed without the secret ballot).
const open = votes.voteSummary({ ...vote, id: `${vote.id}-palese`, secret: false });
const roster = hemi.chamberRoster(state, vote.chamber, { politicians: db.politicians, db });
const seatsVotes = votes.individualVotes(open, roster.seats);
for (const row of open.groups) {
  const choices = roster.seats.map((seat, index) => [seat, seatsVotes.choices[index]]).filter(([seat]) => seat.groupId === row.groupId).map(([, choice]) => choice);
  assert.equal(choices.filter(choice => choice === 'favorevole').length, row.yes, `Gruppo ${row.groupId}: favorevoli dei singoli = totale del gruppo.`);
  assert.equal(choices.filter(choice => choice === 'contrario').length, row.no, `Gruppo ${row.groupId}: contrari coerenti.`);
  assert.equal(choices.filter(choice => choice === 'astenuto').length, row.abstain, `Gruppo ${row.groupId}: astenuti coerenti.`);
}
assert.equal(seatsVotes.dissenters.length, open.dissent, 'I discordanti nominati sono tutti e soli i voti diversi dalla linea.');
// Groups vote as blocs (the vote id is random, so the check allows the natural variation of the simulation).
assert.ok(open.dissent < open.total * 0.18, `I gruppi votano compatti: pochi discordanti (${open.dissent} su ${open.total}).`);
const governingRows = open.groups.filter(row => row.governing);
assert.ok(governingRows.length && governingRows.every(row => row.line === 'favorevole' && row.dissent <= Math.ceil(row.seats * 0.12)), 'La maggioranza sostiene compatta la propria legge.');
assert.ok(seatsVotes.dissenters.every(item => !roster.seats[item.index].keepsLine), 'Capigruppo e leader di partito non votano mai contro la linea.');
assert.deepEqual(votes.individualVotes(open, roster.seats).choices, seatsVotes.choices, 'Lo stesso voto dà sempre gli stessi voti individuali.');
const keepers = hemi.lineKeepers(db);
assert.ok(keepers.size >= 10, `Capigruppo e leader documentati (${keepers.size}).`);
// Confidence: a roll-call vote with a breakdown by group.
const confidence = state.government.confidenceVotes.at(-1).votes;
for (const item of confidence) {
  assert.ok(item.byGroup?.length && item.id && item.kind === 'fiducia', 'La fiducia ha il dettaglio per gruppo.');
  assert.equal(item.byGroup.reduce((sum, row) => sum + row.yesVotes, 0), item.yes, 'Somma dei sì per gruppo = sì della fiducia.');
}
const catalog = votes.voteCatalog(state);
assert.ok(catalog.some(item => item.kind === 'fiducia') && catalog.some(item => item.lawId === lawId), 'Il catalogo contiene leggi e fiducia.');
// Old saves: votes without abstentions are read with a deterministic split.
const legacy = votes.voteSummary({ chamber: 'camera', yes: 210, no: 189, total: 399, needed: 200, passed: true, byGroup: vote.byGroup.map(row => ({ groupId: row.groupId, yesVotes: row.yesVotes, simulatedSeats: row.simulatedSeats })) });
assert.ok(legacy.groups.every(row => row.yes + row.no + row.abstain === row.seats) && legacy.abstain >= 0, 'I voti dei vecchi salvataggi si leggono senza errori.');

// ---------- 5. the view ----------
const game = { contacts: [], status: 'active', week: { ap: 6 }, resources: { politicalCapital: 20 } };
const baseState = { parliament: state, game, career: { playerId: 'giocatore', partyId: null }, dataset: { politicians: [{ id: 'giocatore', displayName: 'Giocatore di prova' }] }, clock: { currentDate: date } };
let html = renderHemicycle(baseState, { politicians: db.politicians, db, view: {} });
assert.ok(html.includes('class="hemi-svg"') && (html.match(/<circle class="hemi-seat[ "]/g) ?? []).length === rosters.camera.total && clean(html), 'Emiciclo della Camera senza valori non validi.');
assert.ok(html.includes('RAPPRESENTAZIONE GRAFICA') && html.includes('data-hemi-filter="committee"') && html.includes('data-hemi-filter="party"') && html.includes('data-hemi-filter="group"') && html.includes('data-hemi-chamber="senato"'), 'Filtri per partito, gruppo, commissione e Camera.');
const someone = rosters.camera.seats.find(seat => seat.person && hemi.committeesOf(seat.person.id, db).length);
html = renderHemicycle(baseState, { politicians: db.politicians, db, view: { selected: someone.person.id } });
assert.ok(html.includes(someone.person.fullName) && html.includes('Commissioni') && html.includes(hemi.committeesOf(someone.person.id, db)[0].committee.name.replace(/'/g, '&#39;')), 'La scheda mostra nome, gruppo, commissioni.');
html = renderHemicycle(baseState, { politicians: db.politicians, db, view: { vote: vote.id, chamber: vote.chamber } });
assert.ok(html.includes('VOTAZIONE SIMULATA') && html.includes('Franchi tiratori') && html.includes('Voto segreto') && clean(html), 'Votazione segreta: totali, franchi tiratori stimati, nessun nome.');
const confidenceVote = catalog.find(item => item.kind === 'fiducia' && item.chamber === 'camera');
html = renderHemicycle(baseState, { politicians: db.politicians, db, view: { vote: confidenceVote.id, chamber: 'camera', selected: 'giocatore' } });
assert.ok(html.includes('Fiducia') && html.includes('Il tuo seggio') && html.includes(votes.VOTE_CHOICES.favorevole.color) && clean(html), 'Fiducia: voti per seggio e scheda del giocatore.');
html = renderHemicycle(baseState, { politicians: db.politicians, db, view: { committee: 'commissione-camera-xix-05' } });
assert.ok(html.includes('V Commissione') && html.includes('hemi-members') && html.includes('is-dim'), 'Filtro per commissione: scheda della commissione, elenco componenti, altri seggi attenuati.');
html = renderHemicycle(baseState, { politicians: db.politicians, db, view: { chamber: 'senato', colorBy: 'partito' } });
assert.ok(html.includes('Senato della Repubblica') && html.includes('Partito non documentato') && clean(html), 'Senato colorato per partito, con i non documentati dichiarati.');
assert.equal(JSON.stringify(db.politicians) + JSON.stringify(db.committees) + JSON.stringify(db.committeeMemberships), snapshot, 'I dati reali non cambiano.');

console.log(`Parlamento interattivo verificato: ${db.committees.length} commissioni permanenti reali (${db.committeeMemberships.length} componenti), emiciclo Camera ${rosters.camera.total} e Senato ${rosters.senato.total} seggi senza sovrapposizioni, gruppi contigui da sinistra a destra con colori coerenti tra le Camere, voto segreto (${secret.snipers} franchi tiratori stimati, nessun nome), voto palese con ${seatsVotes.dissenters.length} discordanti su ${open.total} coerenti coi totali di gruppo, fiducia con dettaglio per gruppo, vecchi salvataggi leggibili.`);
