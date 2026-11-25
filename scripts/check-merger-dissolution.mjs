// Dissolving a merger of the player's party (core/merger-dissolution.js): a recent merger (with its snapshot) and one of an older save (no snapshot), on today's date, without duplicating members,
// cash, consensus or seats, without touching the history that came after, with the identity of before, the internal life of the party consistent, and a game that goes on after a save and a reload.
import assert from 'node:assert/strict';
const { startCareer, playWeek, seeded } = await import('./lib/long-run.mjs');
const { checkInvariants } = await import('../src/core/invariants.js');
const { DATA_SOURCES } = await import('../src/data/schema.js');
const { mergerCases, dissolutionPlan } = await import('../src/core/merger-dissolution.js');
const { mergeCandidates, electionRoster } = await import('../src/core/world-engine.js');

const tie = (s, a, b) => [a, b].sort().join('|');
const sum = list => list.reduce((total, value) => total + value, 0);
// a career whose party can merge with a close force; `founder` gives the party an identity of its own
async function prepared(seed, { founder = true, level = 'comunale' } = {}) {
  const run = await startCareer({ seed, level });
  const s = run.store.getState();
  s.game.party.affiliation = founder ? 'founder' : 'member'; s.game.party.rank = 5; s.game.resources.politicalCapital = 90; s.game.party.org.treasury.balance = 60000;
  const own = s.world.parties.find(item => item.isPlayer);
  let record = s.dataset.parties.find(item => item.id === s.career.partyId);
  if (founder) {
    if (!record) { record = { id: s.career.partyId, name: s.game.party.label, officialName: s.game.party.label, foundedAt: '2020-01-01', status: 'attivo' }; s.dataset.parties.push(record); }
    Object.assign(record, { source: DATA_SOURCES.USER, abbreviation: 'RC', color: '#264d82', color2: '#f2c14e', logo: { kind: 'builder', shape: 'cerchio', symbol: 'freccia', secondary: '#f2c14e' } });
  }
  const listed = new Set((s.world.polls.at(-1)?.results ?? []).map(row => row.partyId));
  const first = s.world.parties.find(item => !item.isPlayer && item.active && listed.has(item.id) && item.baseline >= Math.max(0.5, own.baseline * 0.3) && item.baseline <= own.baseline * 1.8 + 1);
  assert.ok(first, 'C’è una forza vicina per la fusione.');
  s.world.ties[tie(own.id, first.id)] = 70; first.axis = own.axis;
  const offered = mergeCandidates(s.world);
  const near = s.world.parties.find(item => item.id === (offered.find(entry => entry.id === first.id) ?? offered[0])?.id);
  assert.ok(near, 'La forza vicina è tra quelle che possono fondersi.');
  return { run, own: own.id, near: near.id, nearLabel: near.label };
}
const snapshotOf = state => ({ members: state.game.party.org.members, cash: state.game.party.org.treasury.balance, sections: state.game.party.org.sections.map(item => [item.id, item.members]), baseline: state.world.parties.find(item => item.isPlayer).baseline });

// ---------- 1. a recent merger, with a new identity: the snapshot, the preview, the dissolution ----------
{
  const { run, near, nearLabel } = await prepared('scioglimento-recente');
  const before = run.store.getState();
  const label0 = before.game.party.label;
  const worldLabel0 = before.world.parties.find(item => item.isPlayer).label;
  const beforeMerger = snapshotOf(before);
  const partnerBefore = structuredClone(before.world.parties.find(item => item.id === near));
  run.store.mergeParty(near, { identity: { nameMode: 'custom', label: 'Alleanza Nuova Civica', abbreviation: 'anc', color: '#aa3322', color2: '#eecc44', logoMode: 'new', logoShape: 'scudo', logoSymbol: 'stella' } });
  const merged = run.store.getState();
  const snap = merged.game.party.mergers?.at(-1);
  assert.ok(snap && snap.id.startsWith('fusione-') && snap.forceId === near && snap.status === 'attiva', 'La fusione registra uno snapshot con un identificativo univoco.');
  assert.equal(snap.before, beforeMerger.members, 'Lo snapshot conserva gli iscritti di prima.');
  assert.equal(snap.before + snap.added, merged.game.party.org.members, 'Iscritti prima + arrivati = iscritti dopo la fusione.');
  assert.equal(sum(snap.regions.map(row => row[1])), snap.added, 'Le sezioni dello snapshot sommano gli iscritti arrivati.');
  assert.ok(snap.world?.own && snap.world.partner && snap.cash > 0 && snap.cash === merged.game.party.org.treasury.balance - beforeMerger.cash, 'Lo snapshot conserva consenso, identità e cassa.');
  assert.equal(merged.game.party.label, 'Alleanza Nuova Civica');
  // a few weeks after the merger: the history that follows must stay as it is
  const decide = seeded('scioglimento-recente|d');
  for (let week = 0; week < 4; week++) playWeek({ ...run, decide });
  const later = run.store.getState();
  const polls = structuredClone(later.world.polls), elections = structuredClone(later.game.elections), timeline = later.game.timeline.length;
  const cases = mergerCases(later);
  assert.equal(cases.length, 1); assert.equal(cases[0].legacy, false);
  const preview = await run.store.dissolveMerger(cases[0].id, true);
  assert.ok(preview.ok, `Lo scioglimento è possibile (${preview.reason})`);
  assert.ok(preview.confirm?.details?.length >= 5 && preview.recovered.length && preview.missing.length, 'L’anteprima dice cosa torna e cosa no.');
  assert.ok(preview.details === undefined && preview.confirm.title.includes(nearLabel.replace(/\s*\(.*\)\s*$/, '')));
  const at = snapshotOf(later);
  const toast = await run.store.dissolveMerger(cases[0].id);
  assert.match(toast, /torna un partito autonomo/);
  const after = run.store.getState();
  const partner = after.world.parties.find(item => item.id === near);
  // the partner exists again, with its identity
  assert.equal(partner.active, true, 'Il partner è di nuovo un partito attivo.');
  assert.equal(partner.mergedInto, undefined); assert.equal(partner.mergedEvidence, undefined, 'Nessun riferimento attivo alla fusione resta sul partner.');
  for (const key of ['label', 'abbreviation', 'officialName', 'color', 'position', 'axis', 'refSource']) assert.deepEqual(partner[key], partnerBefore[key], `Identità del partner ripristinata: ${key}.`);
  // the identity of the player's party comes back
  const own = after.world.parties.find(item => item.isPlayer);
  assert.equal(after.game.party.label, label0, 'Il partito torna al nome di prima.');
  assert.equal(own.label, worldLabel0, 'Nei sondaggi il partito torna al nome di prima.');
  const record = after.dataset.parties.find(item => item.id === after.career.partyId);
  assert.equal(record.name, label0); assert.equal(record.abbreviation, 'RC'); assert.equal(record.color, '#264d82'); assert.equal(record.logo.shape, 'cerchio', 'Logo e colori di prima.');
  assert.ok(record.mergers.at(-1).dissolvedAt, 'Lo storico delle fusioni del partito segna la data dello scioglimento.');
  // nothing is duplicated: what leaves the player's party is exactly what the partner takes
  const plan = after.game.party.mergers.at(-1).returned;
  assert.equal(after.game.party.org.members + plan.members, at.members, 'Iscritti: nessuna duplicazione.');
  assert.equal(after.game.party.org.members, sum(after.game.party.org.sections.map(item => item.members)), 'Iscritti = somma delle sezioni.');
  assert.ok(plan.members > 0 && plan.members <= snap.added, 'Tornano al massimo gli iscritti portati.');
  assert.equal(after.game.party.org.treasury.balance + plan.cash, at.cash, 'Tesoreria: nessuna duplicazione.');
  assert.ok(plan.cash <= snap.cash, 'Torna al massimo la cassa portata.');
  assert.ok(Math.abs(own.baseline + partner.baseline - at.baseline) < 0.011, `Consenso: la somma resta la stessa (${own.baseline} + ${partner.baseline} vs ${at.baseline}).`);
  for (const section of after.game.party.org.sections) { const was = at.sections.find(([id]) => id === section.id); assert.ok(was && section.members <= was[1] && section.members >= Math.min(5, was[1]), `Sezione ${section.id} coerente.`); }
  assert.ok(!after.game.party.currents.some(item => item.id === snap.area), 'La corrente nata dalla fusione esce con il partner.');
  assert.ok(!after.game.party.org.conflicts.some(item => item.id === snap.conflict), 'Il conflitto dell’integrazione si chiude.');
  assert.ok(!after.world.effects.some(item => item.cause === 'fusione' && item.partyId === own.id), 'L’effetto della fusione sui sondaggi non continua.');
  // history: the past stays, the dissolution is recorded
  assert.deepEqual(after.world.polls.slice(0, polls.length), polls, 'I sondaggi già pubblicati restano identici.');
  assert.deepEqual(after.game.elections, elections, 'Le elezioni restano identiche.');
  assert.equal(after.game.timeline.length, timeline + 1, 'Lo storico politico registra lo scioglimento.');
  assert.ok(after.game.log[0].title.startsWith('Fusione con') && after.game.log[0].title.endsWith('sciolta'), 'Il diario registra lo scioglimento.');
  assert.ok(after.game.party.history.at(-1).text.endsWith('sciolta'));
  assert.equal(after.clock.currentDate, later.clock.currentDate, 'Il calendario non torna indietro.');
  assert.ok(!after.world.alliances.some(item => item.status === 'active' && item.partyIds.includes(near)), 'Il partner riparte fuori dagli accordi.');
  const report = checkInvariants(after, run.context);
  assert.ok(report.ok, `Stato coerente dopo lo scioglimento: ${JSON.stringify(report.issues?.slice?.(0, 3) ?? report).slice(0, 400)}`);
  assert.equal(mergerCases(after).length, 0, 'La fusione sciolta non è più nella lista delle fusioni attive.');
  await assert.rejects(() => run.store.dissolveMerger(cases[0].id), /non è più attiva/, 'Una seconda richiesta non fa nulla.');
  // save, reload, weeks: the dissolution is in the file, the partner takes part in the polls and in the elections, nothing comes back by itself
  const file = run.store.exportSave();
  run.store.loadGame(JSON.parse(file));
  const reloaded = run.store.getState();
  assert.equal(reloaded.game.party.mergers.at(-1).status, 'sciolta', 'Dopo il ricaricamento lo scioglimento è nel salvataggio.');
  assert.ok(reloaded.world.parties.find(item => item.id === near).active && !reloaded.world.parties.find(item => item.id === near).mergedInto, 'Dopo il ricaricamento il partner è autonomo.');
  assert.equal(reloaded.game.party.org.members, after.game.party.org.members, 'Dopo il ricaricamento gli iscritti sono gli stessi.');
  assert.equal(reloaded.game.party.org.treasury.balance, after.game.party.org.treasury.balance, 'Dopo il ricaricamento la tesoreria è la stessa.');
  assert.equal(reloaded.game.party.label, label0);
  const polls0 = reloaded.world.polls.length;
  for (let week = 0; week < 6; week++) playWeek({ ...run, decide });
  const go = run.store.getState();
  assert.ok(go.world.parties.find(item => item.id === near).active, 'Dopo sei settimane il partner è ancora autonomo.');
  assert.ok(go.world.polls.length > polls0 && go.world.polls.slice(polls0).some(poll => poll.results.some(row => row.partyId === near)), 'Il partner torna nei sondaggi pubblicati.');
  { const roster = electionRoster(go.world, { type: 'politiche' }); assert.ok(roster.participants.some(row => row.id === near), 'Il partner è tra le forze delle prossime elezioni politiche.'); }
  assert.equal(go.game.party.mergers.at(-1).status, 'sciolta');
  assert.ok(checkInvariants(go, run.context).ok, 'Stato coerente sei settimane dopo.');
  // a new merger with the same force is possible again later (its cooldown aside): the record is ready, nothing points to the old merger
  assert.equal(mergerCases(go).length, 0);
}

// ---------- 2. an older save: a merger with no snapshot ----------
{
  const { run, near } = await prepared('scioglimento-vecchio', { founder: false });
  run.store.mergeParty(near, {});
  const s = run.store.getState();
  const arrived = s.game.party.mergers.at(-1).added, cashBrought = s.game.party.mergers.at(-1).cash;
  // what an older save had: no snapshot at all (the merger of before this version)
  delete s.game.party.mergers;
  const [item] = mergerCases(s);
  assert.ok(item && item.legacy, 'Una fusione senza snapshot è riconosciuta come storica.');
  const plan = dissolutionPlan(s, item.id);
  assert.ok(plan.ok, plan.reason);
  assert.ok(plan.members > 0 && plan.members <= arrived, 'Gli iscritti arrivati sono ricavati dallo storico del partito.');
  assert.equal(plan.brought, cashBrought, 'La cassa è ricostruita con la regola della fusione (7 € per iscritto).');
  assert.ok(plan.missing.some(text => /Andamento degli iscritti/.test(text)) && plan.missing.some(text => /Alleanze/.test(text)), 'L’anteprima dice che cosa non è ricostruibile.');
  const preview = await run.store.dissolveMerger(item.id, true);
  assert.ok(preview.confirm.details.some(text => text.startsWith('✗')), 'La conferma mostra ciò che non torna.');
  const at = snapshotOf(s);
  await run.store.dissolveMerger(item.id);
  const after = run.store.getState();
  const partner = after.world.parties.find(entry => entry.id === near);
  assert.ok(partner.active && !partner.mergedInto, 'Il partner di un vecchio salvataggio torna autonomo.');
  const returned = after.game.party.mergers.at(-1);
  assert.ok(returned.legacy && returned.status === 'sciolta' && returned.missing.length, 'Lo scioglimento di una fusione storica resta registrato con le sue lacune.');
  assert.equal(after.game.party.org.members + returned.returned.members, at.members, 'Iscritti: nessuna duplicazione (vecchio salvataggio).');
  assert.equal(after.game.party.org.treasury.balance + returned.returned.cash, at.cash, 'Tesoreria: nessuna duplicazione (vecchio salvataggio).');
  const own = after.world.parties.find(entry => entry.isPlayer);
  assert.ok(Math.abs(own.baseline + partner.baseline - at.baseline) < 0.011, 'Consenso: la somma resta la stessa (vecchio salvataggio).');
  assert.ok(checkInvariants(after, run.context).ok, 'Stato coerente dopo lo scioglimento di una fusione storica.');
}

// ---------- 3. requirements and parliamentary groups ----------
{
  const { run, own, near } = await prepared('scioglimento-gruppi', { level: 'deputato' });
  const s = run.store.getState();
  // a group the game created for the partner (a split of the past): it carries its party
  const camera = s.parliament.chambers.camera;
  const donor = camera.groups.find(group => (group.simulatedSeats ?? 0) > 20); donor.simulatedSeats -= 6;   // the seats of the new group come from another one: the Camera stays at its size
  camera.groups.push({ groupId: `leg19-camera-${near}`, officialName: 'Gruppo del partner (simulato)', chamber: 'camera', simulatedSeats: 6, source: 'simulation', partyId: near });
  assert.ok(checkInvariants(s, run.context).ok, 'Fixture coerente prima della fusione.');
  run.store.mergeParty(near, {});
  const merged = run.store.getState();
  assert.equal(merged.parliament.chambers.camera.groups.find(group => group.groupId === `leg19-camera-${near}`).partyId, own, 'La fusione porta il gruppo al partito del giocatore.');
  const partnerGroups = merged.game.party.mergers.at(-1).groups;
  assert.ok(partnerGroups.includes(`leg19-camera-${near}`), 'Lo snapshot ricorda i gruppi del partner.');
  const [item] = mergerCases(merged);
  // only the secretary, with the capital, outside a campaign
  merged.game.party.rank = 2; merged.game.party.affiliation = 'member';
  assert.match(dissolutionPlan(merged, item.id).reason, /segretario/);
  merged.game.party.rank = 5; merged.game.resources.politicalCapital = 2;
  assert.match(dissolutionPlan(merged, item.id).reason, /capitale politico/);
  merged.game.resources.politicalCapital = 90;
  merged.campaign = { ...(merged.campaign ?? {}), status: 'active' };
  assert.match(dissolutionPlan(merged, item.id).reason, /campagna elettorale/, 'Non durante una campagna: liste e candidature sono depositate.');
  merged.campaign = null;
  const seats = sum(Object.values(merged.parliament.chambers).flatMap(chamber => chamber.groups.map(group => group.simulatedSeats ?? 0)));
  await run.store.dissolveMerger(item.id);
  const after = run.store.getState();
  const allGroups = Object.values(after.parliament.chambers).flatMap(chamber => chamber.groups);
  for (const id of partnerGroups) assert.equal(allGroups.find(group => group.groupId === id).partyId, near, `Il gruppo parlamentare ${id} torna al partner.`);
  assert.equal(sum(Object.values(after.parliament.chambers).flatMap(chamber => chamber.groups.map(group => group.simulatedSeats ?? 0))), seats, 'Seggi: nessuna duplicazione.');
  assert.equal(after.game.resources.politicalCapital, 85, 'Costo: 5 punti di capitale politico.');
  { const report = checkInvariants(after, run.context); assert.ok(report.ok, `Stato coerente (deputato, gruppi): ${JSON.stringify(report).slice(0, 600)}`); }
}
console.log('Scioglimento delle fusioni verificato: fusione recente con snapshot e fusione di un vecchio salvataggio, anteprima di ciò che torna e di ciò che non è ricostruibile, identità del partner e del partito, iscritti, sezioni, cassa, consenso e gruppi senza duplicazioni, storico intatto, requisiti, quattro settimane dopo.');
