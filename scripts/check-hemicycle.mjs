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
// The colour of a group is the colour of the force it stands for (the one the polls and the party pages use), the same in both Chambers; the groups no force stands for take the free slots of the palette.
const FDI = 'party-registro-p1-2014-04-ir', PD = 'party-registro-p1-2015-29-ir';
const tones = { [FDI]: '#112233', [PD]: '#445566' };
for (const chamber of ['camera', 'senato']) {
  const toned = hemi.chamberRoster(parliament, chamber, { politicians: db.politicians, db, forceColor: id => tones[id] ?? null });
  const colorIn = pattern => toned.groups.find(group => pattern.test(group.name))?.color;
  assert.equal(colorIn(/^Fratelli d'Italia/), '#112233', `${chamber}: il gruppo di Fratelli d’Italia ha il colore della sua forza.`);
  assert.equal(colorIn(/^Partito Democratico/), '#445566', `${chamber}: il gruppo del Partito Democratico ha il colore della sua forza.`);
  const free = toned.groups.filter(group => !/^Fratelli d'Italia|^Partito Democratico/.test(group.name) && CHART_SLOTS.includes(group.color)).map(group => group.color);
  assert.equal(new Set(free).size, free.length, `${chamber}: gli altri gruppi non ripetono i colori della tavolozza.`);
  assert.ok(toned.groups.every(group => /^#[\da-f]{6}$/i.test(group.color)), `${chamber}: ogni gruppo ha un colore valido.`);
}
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

// ---------- 6. the Chambers born from a vote of the game: every seat has its person, in the colour of its force ----------
const rosterApi = await import(`../src/core/seat-roster.js${v}`);
const { rosterSeats, rosterSize, rosterPeople, syncRoster, rosterInSync, isSeatPerson, SEAT_ROLES, RE_ELECTION_SHARE } = rosterApi;
const TONES = { a: '#3987e5', b: '#d95926', c: '#199e70', user: '#8844cc' };
const world = { parties: [{ id: 'party-a', label: 'Partito A', abbreviation: 'PA', color: TONES.a }, { id: 'party-b', label: 'Partito B', color: TONES.b }, { id: 'party-c', label: 'Partito C', color: TONES.c, mergedFrom: ['party-c-old'] }, { id: 'party-user', label: 'La lista del giocatore', color: TONES.user, isPlayer: true }] };
const forceColor = hemi.forceColorResolver(world);
assert.equal(forceColor('party-a'), TONES.a, 'La forza ha il suo colore.');
assert.equal(forceColor('party-c-old'), TONES.c, 'Un partito confluito in un altro prende il colore della forza che lo ha assorbito.');
assert.equal(forceColor('party-sconosciuto'), null, 'Una forza che il gioco non conosce non ha un colore inventato.');
const chamberRows = [['a', 'Partito A', 8, 'party-a'], ['b', 'Partito B', 6, 'party-b'], ['user', 'La lista del giocatore', 4, 'party-user'], ['misto-c', 'Misto – Partito C', 2, 'party-c', { component: true }], ['misto', 'Misto – liste territoriali', 2, null, { component: true, components: [{ partyId: null, listId: 'lista:VDA', label: 'Valle d’Aosta', seats: 1 }, { partyId: null, listId: 'lista:SVP', label: 'Südtiroler', seats: 1 }] }]];
const simChamber = (chamber, rows) => ({ id: `legislatura-20-${chamber}`, chamber, label: chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica', source: 'simulation', groups: rows.map(([id, label, seats, partyId, extra = {}]) => ({ groupId: `leg20-${chamber}-${id}`, officialName: label, chamber, simulatedSeats: seats, partyId, component: Boolean(extra.component), position: null, axis: id === 'a' ? 2 : id === 'b' ? -1 : 0, color: id === 'a' ? '#111111' : null, legislature: 20, simulated: true, reference: { memberCount: seats, source: 'simulation', verified: false }, source: 'simulation', ...(extra.components ? { components: extra.components } : {}) })) });
const groupSpec = group => ({ id: group.groupId, label: group.officialName, partyId: group.partyId ?? null, seats: group.simulatedSeats, parts: (group.components ?? []).filter(item => item.listId).map(item => ({ partyId: null, listId: item.listId, label: item.label, seats: item.seats })) });
const camera = simChamber('camera', chamberRows);
const specs = camera.groups.map(groupSpec);
const total = camera.groups.reduce((sum, group) => sum + group.simulatedSeats, 0);
const player = { personId: 'giocatore', groupId: 'leg20-camera-user', partyId: 'party-user' };
const known = [{ id: 'persona-gara-xyz', partyId: 'party-a' }, { id: 'persona-gara-altrove', partyId: 'party-b' }];
const built = syncRoster({ assembly: camera.id, kind: 'camera', label: 'Camera · XX legislatura (simulata)', groups: specs, player, pool: known, busy: new Set(['persona-gara-altrove']), date: '2027-09-26', resultId: 'politiche-2027-09-26' });
assert.equal(rosterSize(built.roster), total, `Ogni seggio ha una persona (${total}).`);
assert.equal(new Set(rosterPeople(built.roster)).size, total, 'Una persona sola per seggio: nessuna persona due volte.');
assert.ok(built.created.length === total - 1 - 1 && built.created.every(person => person.source === 'simulation' && isSeatPerson(person) && /^persona-seggio-/.test(person.id) && person.firstName && person.lastName && person.displayName), 'Le persone nuove sono tutte della simulazione (mai reali), con identità e origine dichiarate.');
assert.ok(built.created.every(person => /^Deputato simulato n\. \d+ · /.test(person.displayName)) && SEAT_ROLES.camera === 'Deputato', 'Si chiamano per ciò che sono: eletti simulati, senza nomi reali inventati.');
const seatsNow = rosterSeats(built.roster);
assert.equal(seatsNow.filter(seat => seat.origin === 'player').length, 1, 'Il giocatore eletto occupa un seggio solo.');
assert.equal(seatsNow.find(seat => seat.origin === 'player').groupId, player.groupId, 'Nel suo gruppo.');
assert.equal(seatsNow.find(seat => seat.personId === 'persona-gara-xyz')?.partyId, 'party-a', 'Una persona che il partito ha già occupa un seggio del proprio partito.');
assert.ok(!seatsNow.some(seat => seat.personId === 'persona-gara-altrove'), 'Chi siede già altrove non siede due volte.');
assert.ok(seatsNow.filter(seat => seat.listId).length === 2 && seatsNow.filter(seat => seat.listId).every(seat => seat.partyId === null), 'Le liste territoriali del Misto restano liste: i loro seggi non hanno una forza inventata.');
assert.deepEqual(syncRoster({ assembly: camera.id, kind: 'camera', label: 'Camera · XX legislatura (simulata)', groups: specs, player, pool: known, busy: new Set(['persona-gara-altrove']), date: '2027-09-26', resultId: 'politiche-2027-09-26' }).roster, built.roster, 'Stessi dati, stessi seggi e stesse persone.');
assert.ok(rosterInSync(built.roster, specs, player) && !rosterInSync(built.roster, specs, null), 'Il roster sa se dice ancora ciò che dicono i gruppi.');
// The player leaves: his seat goes to the next elected of the group; nobody else moves; no seat stays empty.
const left = syncRoster({ assembly: camera.id, kind: 'camera', groups: specs, previous: built.roster, player: null, date: '2028-03-01' });
assert.ok(rosterSize(left.roster) === total && !rosterPeople(left.roster).includes('giocatore') && left.created.length === 1 && left.released.includes('giocatore'), 'Se il giocatore lascia, il seggio passa a un nuovo eletto e resta popolato.');
assert.deepEqual(rosterPeople(left.roster).filter(id => id !== left.created[0].id), rosterPeople(built.roster).filter(id => id !== 'giocatore'), 'Gli altri non si spostano.');
// …and enters again: one of the group's seats is his, the roster keeps the size.
const back = syncRoster({ assembly: camera.id, kind: 'camera', groups: specs, previous: left.roster, player, date: '2028-06-01' });
assert.ok(rosterSize(back.roster) === total && rosterPeople(back.roster).includes('giocatore') && back.released.length === 1, 'Se rientra, un seggio del gruppo è il suo e un eletto lascia.');
// A split: the new group takes seats from its source, with their persons (the same ids, the new party).
const splitSpecs = specs.map(spec => spec.id === 'leg20-camera-a' ? { ...spec, seats: spec.seats - 3 } : spec).concat([{ id: 'leg20-camera-scissione', label: 'Scissione', partyId: 'party-new', seats: 3, parts: [] }]);
const split = syncRoster({ assembly: camera.id, kind: 'camera', groups: splitSpecs, previous: built.roster, player, splitFrom: { 'leg20-camera-scissione': 'leg20-camera-a' }, date: '2028-01-10' });
const movedSeats = rosterSeats(split.roster).filter(seat => seat.groupId === 'leg20-camera-scissione');
assert.ok(movedSeats.length === 3 && movedSeats.every(seat => seat.partyId === 'party-new' && rosterPeople(built.roster).includes(seat.personId)) && split.created.length === 0, 'La scissione porta con sé le persone: stessi seggi, nessuna persona nuova.');
assert.ok(split.updated.length === 3 && split.updated.every(item => item.patch.partyId === 'party-new'), 'Le persone che passano alla nuova forza cambiano partito.');
assert.equal(rosterSize(split.roster), total, 'Una scissione sposta i seggi, non ne crea.');
// A new legislature: the voters send back a share of the old members of a party, the rest are new.
const old = rosterSeats(built.roster).filter(seat => seat.partyId === 'party-a' && seat.origin === 'simulation');
const next = syncRoster({ assembly: 'legislatura-21-camera', kind: 'camera', label: 'Camera · XXI legislatura (simulata)', numberFrom: built.roster.counter, groups: specs.map(spec => ({ ...spec, id: spec.id.replace('leg20', 'leg21') })), pool: old.map(seat => ({ id: seat.personId, partyId: 'party-a', previous: { assembly: built.roster.label, since: built.roster.date } })), date: '2032-09-26', resultId: 'politiche-2032-09-26', people: new Map(built.created.map(person => [person.id, person])) });
const back60 = next.updated.filter(item => item.patch.terms);
assert.equal(new Set([...built.created, ...next.created].map(person => person.displayName)).size, built.created.length + next.created.length, 'I nomi delle persone di legislature successive non si ripetono.');
assert.ok(back60.length > 0 && back60.length <= Math.floor(8 * RE_ELECTION_SHARE) && back60.every(item => item.patch.terms.at(-1).until === '2032-09-26' && item.patch.terms.at(-1).assembly), 'Dei vecchi eletti ne tornano solo una parte, con il loro storico.');
// The leader of the executive of a council: the first seat of the leader group is his.
const council = syncRoster({ assembly: 'comune-2027-x', kind: 'comune', label: 'Comune di X', groups: [{ id: 'g1', label: 'Lista A', partyId: 'party-a', seats: 5 }, { id: 'g2', label: 'Lista civica', partyId: null, seats: 3 }], player: { personId: 'giocatore', groupId: 'g2', partyId: null }, leader: { groupId: 'g1', label: 'Sindaco (figura simulata) · Lista A' }, place: { name: 'Comune di X', region: 'Toscana', municipality: 'X' }, date: '2027-06-01' });
assert.ok(rosterSize(council.roster) === 8 && council.roster.leader && council.created.find(person => person.id === council.roster.leader).displayName === 'Sindaco (figura simulata) · Lista A', 'Il sindaco simulato è la prima persona della lista che guida.');
assert.ok(council.created.every(person => person.region === 'Toscana'), 'Le persone di un consiglio sono del suo territorio.');
// Colours: by force (the person's party), never by group; the Misto keeps its forces apart; the groups no force stands for take their own tone.
const parliamentOf = (chambers, extra = {}) => ({ ...extra, legislature: { number: 20, label: 'XX legislatura (simulata)', reference: 'simulation', since: '2027-09-26', resultId: 'politiche-2027-09-26' }, chambers, player: { chamber: 'camera', groupId: player.groupId, politicianId: 'giocatore' }, laws: extra.laws ?? [] });
const people = new Map(built.created.map(person => [person.id, person]));
people.set('giocatore', { id: 'giocatore', displayName: 'Giocatrice di prova', source: 'user' });
people.set('persona-gara-xyz', { id: 'persona-gara-xyz', displayName: 'Candidato simulato n. 1 · Prova', source: 'simulation', partyId: 'party-a' });
const gamePar = parliamentOf({ camera: { ...camera, roster: built.roster }, senato: { ...simChamber('senato', chamberRows.slice(0, 3)), roster: null } });
const seated = hemi.chamberRoster(gamePar, 'camera', { forceColor, people });
assert.ok(seated.sitting && seated.total === total && seated.seats.every(seat => seat.person || seat.player), 'L’emiciclo della legislatura simulata ha un seggio per persona.');
const toneOf = seat => hemi.seatColor(seat, { forceColor, groupColor: seated.groups.find(group => group.groupId === seat.groupId)?.color });
for (const [party, tone] of [['party-a', TONES.a], ['party-b', TONES.b], ['party-c', TONES.c], ['party-user', TONES.user]]) assert.ok(seated.seats.filter(seat => seat.partyId === party).length > 0 && seated.seats.filter(seat => seat.partyId === party).every(seat => toneOf(seat) === tone), `I seggi di ${party} hanno il colore della loro forza.`);
assert.notEqual(toneOf(seated.seats.find(seat => seat.groupId === 'leg20-camera-misto-c')), toneOf(seated.seats.find(seat => seat.groupId === 'leg20-camera-misto')), 'Nel Misto il componente di una forza resta distinto dalle liste territoriali.');
assert.ok(seated.seats.filter(seat => seat.listId).every(seat => /^#[\da-f]{6}$/i.test(toneOf(seat))), 'Le liste senza forza hanno un colore neutro valido, mai casuale.');
const identities = hemi.chamberGroups(gamePar, 'camera', { forceColor });
assert.equal(identities.groups.find(group => group.groupId === 'leg20-camera-a').color, TONES.a, 'Il colore di un gruppo è quello della sua forza oggi, non lo scatto di quando è nato.');
assert.equal(hemi.chamberGroups(gamePar, 'camera', {}).groups.find(group => group.groupId === 'leg20-camera-a').color, '#111111', 'Dove nessuna forza dice il colore, vale quello con cui il gruppo è nato.');
const fallback = hemi.fallbackTones([{ id: 'x', seats: 9 }, { id: 'y', seats: 4 }, { id: 'z', seats: 1, misto: true }], [CHART_SLOTS[0]]);
assert.ok(!Object.values(Object.fromEntries(fallback)).includes(CHART_SLOTS[0]) && fallback.get('x') === CHART_SLOTS[1] && hemi.NEUTRAL_TONES.includes(fallback.get('z')), 'I gruppi senza forza prendono le tinte che le forze non usano, il Misto un tono neutro.');
// The view: one dot per person, the force legend, the card of a person, the colours of the vote only during a vote.
const simState = { parliament: gamePar, world, game, career: { playerId: 'giocatore', partyId: 'party-user' }, dataset: { politicians: [...people.values()] }, clock: { currentDate: '2027-10-01' } };
html = renderHemicycle(simState, { view: {} });
assert.ok((html.match(/<circle class="hemi-seat[ "]/g) ?? []).length === total && clean(html), 'Un punto per ogni seggio della Camera simulata.');
for (const tone of Object.values(TONES)) assert.ok(html.includes(`fill="${tone}"`), `Il colore ${tone} compare tra i punti.`);
assert.ok(html.includes('data-hemi-filter-party="party-a"') && html.includes('data-hemi-filter-party="party-c"') && html.includes('data-hemi-filter-party="nessuno"') && html.includes('ha il colore della sua forza'), 'La legenda elenca le forze, non i gruppi.');
const person = built.created.find(item => item.partyId === 'party-b');
html = renderHemicycle(simState, { view: { selected: person.id } });
assert.ok(html.includes('PERSONA DELLA SIMULAZIONE') && html.includes(person.displayName) && html.includes('Partito B') && html.includes('XX legislatura') && clean(html), 'La scheda di un seggio mostra la persona, la forza, il gruppo e l’elezione.');
html = renderHemicycle(simState, { view: { selected: 'giocatore' } });
assert.ok(html.includes('Il tuo seggio') && clean(html), 'Il giocatore ha il suo seggio.');
html = renderHemicycle(simState, { view: { party: 'party-a' } });
assert.equal((html.match(/<circle class="hemi-seat[ "][^>]*is-dim/g) ?? []).length + (html.match(/<circle class="hemi-seat is-dim/g) ?? []).length > 0, true, 'Filtrando una forza, gli altri seggi si attenuano.');
const cast = { id: 'voto-prova', chamber: 'camera', date: '2027-11-01', kind: 'legge', yes: 12, no: 10, against: 10, abstain: 0, total: 22, needed: 12, passed: true, byGroup: camera.groups.map(group => ({ groupId: group.groupId, yesVotes: group.simulatedSeats >= 6 ? group.simulatedSeats : 0, noVotes: group.simulatedSeats >= 6 ? 0 : group.simulatedSeats, abstainVotes: 0, simulatedSeats: group.simulatedSeats })) };
const voting = { ...simState, parliament: { ...gamePar, laws: [{ id: 'legge-prova', title: 'Legge di prova', votes: [cast] }] } };
html = renderHemicycle(voting, { view: { vote: 'voto-prova', chamber: 'camera' } });
assert.ok(html.includes('VOTAZIONE SIMULATA') && html.includes(votes.VOTE_CHOICES.favorevole.color) && !Object.values(TONES).some(tone => html.includes(`fill="${tone}"`)) && clean(html), 'Durante una votazione i punti hanno i colori del voto, non quelli delle forze.');

assert.equal(JSON.stringify(db.politicians) + JSON.stringify(db.committees) + JSON.stringify(db.committeeMemberships), snapshot, 'I dati reali non cambiano.');

console.log(`Parlamento interattivo verificato: ${db.committees.length} commissioni permanenti reali (${db.committeeMemberships.length} componenti), emiciclo Camera ${rosters.camera.total} e Senato ${rosters.senato.total} seggi senza sovrapposizioni, gruppi contigui da sinistra a destra con colori coerenti tra le Camere, voto segreto (${secret.snipers} franchi tiratori stimati, nessun nome), voto palese con ${seatsVotes.dissenters.length} discordanti su ${open.total} coerenti coi totali di gruppo, fiducia con dettaglio per gruppo, vecchi salvataggi leggibili; Camere nate dal voto della partita con una persona della simulazione per ogni seggio (mai reale, mai due volte, il giocatore al suo posto, scissione e nuova legislatura che portano le persone) e punti nel colore della forza, Misto distinto, colori del voto solo durante le votazioni.`);
