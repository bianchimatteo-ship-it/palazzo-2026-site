// Invariants of a game state: what must always hold, whatever happened in the simulation. One central check, used by
// the tests (single moments, careers of many years): it reports problems, it never changes the state.
// checkInvariants(state, context) → { ok, issues: [{ code, path, message }] }
// context (optional): the real reference the state may point to — realPartyIds, realGroupIds (Sets or arrays).

const SEATS = { camera: 400, senato: 200 };
// The Senate also has the senators for life (and, in the real XIX legislature, a few vacancies may appear in either
// Chamber): real compositions are allowed a small margin, simulated ones must be exact.
const REAL_SEAT_RANGE = { camera: [390, 400], senato: [195, 210] };
const LAW_STAGES = new Set(['proposal', 'commission', 'amendments', 'other-chamber', 'final-vote', 'approved', 'rejected', 'lapsed', 'withdrawn']);
const CLOSED_LAW_STAGES = new Set(['approved', 'rejected', 'lapsed', 'withdrawn']);
const GOVERNMENT_STATUSES = new Set(['proposed', 'awaiting-confidence', 'active', 'crisis', 'fallen', 'caretaker']);
const ELECTION_STATUSES = new Set(['upcoming', 'open', 'running', 'held', 'missed']);
const CAMPAIGN_STATUSES = new Set(['active', 'finished']);
const CHAMBERS = new Set(['camera', 'senato']);
// Numbers that live on a 0–100 scale wherever they appear.
const PERCENT_KEYS = new Set(['share', 'satisfaction', 'trust', 'support', 'stability', 'cohesion', 'loyalty', 'competence', 'participation', 'turnout', 'approval', 'popularity', 'reputation', 'notoriety', 'influence', 'experience', 'consensus', 'visibility', 'undecided']);
// Counts that can never be negative (seats, votes, sizes).
const COUNT_KEYS = new Set(['seats', 'simulatedSeats', 'memberCount', 'yes', 'no', 'against', 'abstain', 'absent', 'total', 'needed', 'yesVotes', 'noVotes', 'abstainVotes', 'absentVotes', 'sample', 'members', 'volunteers']);
// Containers of changes, costs and effects: their numbers are variations (they can be negative or above 100).
const RELATIVE_KEYS = new Set(['deltas', 'delta', 'effects', 'effect', 'outcomes', 'changes', 'change', 'impact', 'impacts', 'why', 'whyLast', 'lastWhy', 'cost', 'costs', 'bonus', 'modifiers', 'swing', 'shift', 'shifts', 'trend', 'weekStartStats', 'demands', 'reward', 'penalty', 'consequences']);
const DATE_KEY = /^(date|since|until|startDate|endDate|electionDate|windowOpensAt|windowClosesAt|introducedAt|updatedAt|stageSince|closedAt|formedAt|fallenAt|firstSitting|naturalEnd|appointedAt|endedAt|startedAt|asOf|votedAt|deadline|nextStepAt)$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
// Lists whose `id` names another record (the force a move is about), not the entry itself.
const REFERENCE_ID_LISTS = new Set(['presenceMoves']);
const ID_KEYS = new Set(['id', 'partyId', 'groupId', 'politicianId', 'officeId', 'lawId', 'electionId', 'playerId', 'roleId']);

// Lists as the checks read them: damaged entries (undefined, not objects) are reported by the scan, not read here.
const records = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const asSet = value => value instanceof Set ? value : new Set(value ?? []);
const validDay = value => typeof value === 'string' && ISO_DAY.test(value) && !Number.isNaN(Date.parse(value.slice(0, 10)));
// null for a date that cannot be read (reported by the scan): comparisons with it are always false.
const addDays = (date, days) => { if (!validDay(date)) return null; const next = new Date(`${String(date).slice(0, 10)}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); };

export function checkInvariants(state, context = {}) {
  const issues = [];
  const report = (code, path, message) => { if (issues.length < 500) issues.push({ code, path, message }); };
  if (!state || typeof state !== 'object') { report('stato', '', 'Stato assente.'); return { ok: false, issues }; }
  scanValues(state, report);
  const today = state.clock?.currentDate;
  if (!validDay(today)) report('data', 'clock.currentDate', `Data corrente non valida: ${today}`);
  const known = knownIds(state, context);
  checkPlayer(state, known, report);
  checkWorld(state, known, report);
  checkChambers(state, known, report);
  checkGovernment(state, known, report);
  checkLaws(state, known, report, today);
  checkElections(state, report, today);
  checkCampaign(state, report);
  checkNational(state, known, report);
  checkLocal(state, report);
  checkAgenda(state, known, report);
  return { ok: issues.length === 0, issues };
}

// Every value of the state: numbers must be finite (no NaN or Infinity) and plausible, no undefined inside lists or
// as an identifier, dates readable, and the ids of each list of records unique.
function scanValues(root, report) {
  const seen = new WeakSet();
  const walk = (value, path, key, relative = false) => {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) report('numero-non-valido', path, `${value} in ${path}`);
      else if (relative) return;
      else if (PERCENT_KEYS.has(key) && (value < -0.001 || value > 100.001)) report('valore-impossibile', path, `${key} = ${value} fuori da 0–100`);
      else if (COUNT_KEYS.has(key) && value < 0) report('valore-impossibile', path, `${key} = ${value} negativo`);
      return;
    }
    if (value === undefined) { if (ID_KEYS.has(key)) report('undefined', path, `${key} è undefined`); return; }
    if (typeof value === 'string') { if (DATE_KEY.test(key) && value && !validDay(value)) report('data', path, `Data non valida: ${value}`); if (value === 'NaN' || value === 'undefined') report('numero-non-valido', path, `Testo «${value}» in ${path}`); return; }
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      const ids = new Map();
      value.forEach((item, index) => {
        if (item === undefined) report('undefined', `${path}[${index}]`, 'Elemento undefined in una lista');
        if (item && typeof item === 'object' && typeof item.id === 'string' && !REFERENCE_ID_LISTS.has(key)) {
          if (ids.has(item.id)) report('id-duplicato', `${path}[${index}]`, `ID duplicato ${item.id} (anche in ${path}[${ids.get(item.id)}])`);
          else ids.set(item.id, index);
        }
        walk(item, `${path}[${index}]`, key, relative);
      });
      return;
    }
    for (const [child, entry] of Object.entries(value)) walk(entry, path ? `${path}.${child}` : child, child, relative || RELATIVE_KEYS.has(child));
  };
  walk(root, '', '');
}

// The identifiers the state may point to: its own records plus the real reference.
function knownIds(state, context) {
  const parties = new Set([...asSet(context.realPartyIds)]);
  for (const list of [state.dataset?.parties, state.world?.parties, state.world?.latent]) for (const item of list ?? []) if (item?.id) parties.add(item.id);
  const groups = new Set([...asSet(context.realGroupIds)]);
  const current = { camera: new Set(), senato: new Set() };
  for (const chamber of CHAMBERS) for (const group of state.parliament?.chambers?.[chamber]?.groups ?? []) { groups.add(group.groupId); current[chamber].add(group.groupId); }
  for (const legislature of state.parliament?.pastLegislatures ?? []) for (const chamber of CHAMBERS) for (const group of legislature.chambers?.[chamber] ?? []) groups.add(group.groupId);
  const politicians = new Set(records(state.dataset?.politicians).map(item => item.id));
  const offices = new Map(records(state.dataset?.offices).map(item => [item.id, item]));
  const territories = new Set(records(state.dataset?.territories).map(item => item.id));
  return { parties, groups, current, politicians, offices, territories, realGroupIds: asSet(context.realGroupIds), hasRealParties: asSet(context.realPartyIds).size > 0 };
}

// The player's career: player, party, offices and statistics point to records that exist; offices are coherent.
function checkPlayer(state, known, report) {
  const career = state.career;
  if (!career || career.status === 'demo') return;
  const player = records(state.dataset?.politicians).find(item => item.id === career.playerId);
  if (!player) { report('riferimento', 'career.playerId', `Giocatore ${career.playerId} assente dal dataset`); return; }
  const party = career.partyId ?? null;
  if (party && known.hasRealParties && !known.parties.has(party)) report('riferimento', 'career.partyId', `Partito ${party} sconosciuto`);
  if ((player.partyId ?? null) !== party) report('coerenza', 'dataset.politicians.partyId', `Partito del giocatore (${player.partyId}) diverso da quello della carriera (${party})`);
  if (state.game?.party && (state.game.party.partyId ?? null) !== party) report('coerenza', 'game.party.partyId', `Partito nel gioco (${state.game.party.partyId}) diverso da quello della carriera (${party})`);
  if (player.roleId) {
    const office = known.offices.get(player.roleId);
    if (!office) report('riferimento', 'player.roleId', `Incarico ${player.roleId} inesistente`);
    else if (office.politicianId !== player.id) report('coerenza', 'player.roleId', `L’incarico ${office.id} appartiene a ${office.politicianId}`);
  }
  records(state.dataset?.offices).forEach((office, index) => {
    if (office.politicianId && !known.politicians.has(office.politicianId)) report('riferimento', `dataset.offices[${index}].politicianId`, `Titolare ${office.politicianId} inesistente`);
    if (office.territoryId && !known.territories.has(office.territoryId)) report('riferimento', `dataset.offices[${index}].territoryId`, `Territorio ${office.territoryId} inesistente`);
    if (office.startDate && office.endDate && office.endDate < office.startDate) report('coerenza', `dataset.offices[${index}]`, `Incarico ${office.title} chiuso (${office.endDate}) prima dell’inizio (${office.startDate})`);
  });
  records(state.dataset?.statistics).forEach((item, index) => { if (!known.politicians.has(item.subjectId)) report('riferimento', `dataset.statistics[${index}].subjectId`, `Statistica di ${item.subjectId} inesistente`); });
  // One seat at a time: never deputy and senator together, and a seat in the game's Parliament has its office.
  const open = records(state.dataset?.offices).filter(item => item.politicianId === player.id && !item.endDate);
  const seats = open.filter(item => item.level === 'deputato' || item.level === 'senatore');
  if (seats.length > 1) report('coerenza', 'dataset.offices', `Il giocatore ha ${seats.length} seggi parlamentari aperti insieme`);
  const seat = state.parliament?.player;
  if (seat?.chamber && !CHAMBERS.has(seat.chamber)) report('valore-impossibile', 'parliament.player.chamber', `Camera sconosciuta: ${seat.chamber}`);
  if (seat?.groupId && !known.groups.has(seat.groupId)) report('riferimento', 'parliament.player.groupId', `Gruppo ${seat.groupId} inesistente`);
}

// The political world: parties, polls (shares that add up) and alliances among forces that exist.
function checkWorld(state, known, report) {
  const world = state.world;
  if (!world) return;
  const forces = new Set([...records(world.parties).map(item => item.id), ...records(world.latent).map(item => item.id)]);
  records(world.polls).forEach((poll, index) => {
    const path = `world.polls[${index}]`;
    const ids = new Set();
    let sum = 0;
    for (const row of poll.results ?? []) {
      if (!forces.has(row.partyId) && !known.parties.has(row.partyId)) report('riferimento', `${path}.results`, `Sondaggio ${poll.id}: forza ${row.partyId} sconosciuta`);
      if (ids.has(row.partyId)) report('id-duplicato', `${path}.results`, `Sondaggio ${poll.id}: ${row.partyId} due volte`);
      ids.add(row.partyId);
      sum += row.share;
    }
    // Normalised to 100 with the other forces (and the undecided counted apart).
    const others = Number.isFinite(poll.others) ? poll.others : 0;
    if (records(poll.results).length && Math.abs(sum + others - 100) > 1.5) report('coerenza', path, `Sondaggio ${poll.id}: quote che sommano a ${Math.round((sum + others) * 10) / 10}`);
  });
  records(world.alliances).forEach((alliance, index) => {
    for (const id of alliance.partyIds ?? []) if (!forces.has(id) && !known.parties.has(id)) report('riferimento', `world.alliances[${index}]`, `Alleanza ${alliance.id}: forza ${id} sconosciuta`);
    if (alliance.leaderId && !(alliance.partyIds ?? []).includes(alliance.leaderId)) report('coerenza', `world.alliances[${index}]`, `Alleanza ${alliance.id}: la guida ${alliance.leaderId} non ne fa parte`);
  });
}

// The Chambers of the game: groups tied to known parties, seats that are whole, positive and add up.
function checkChambers(state, known, report) {
  const parliament = state.parliament;
  if (!parliament?.chambers) return;
  const simulated = parliament.legislature?.reference === 'simulation';
  for (const chamber of CHAMBERS) {
    const groups = parliament.chambers[chamber]?.groups ?? [];
    if (!groups.length) continue;
    const ids = new Set();
    let sum = 0;
    groups.forEach((group, index) => {
      const path = `parliament.chambers.${chamber}.groups[${index}]`;
      if (ids.has(group.groupId)) report('id-duplicato', path, `Gruppo ${group.groupId} due volte`);
      ids.add(group.groupId);
      if (group.chamber && group.chamber !== chamber) report('coerenza', path, `Gruppo ${group.groupId} della Camera sbagliata`);
      if (group.partyId && known.hasRealParties && !known.parties.has(group.partyId)) report('riferimento', path, `Gruppo ${group.groupId}: partito ${group.partyId} sconosciuto`);
      if (!Number.isInteger(group.simulatedSeats) || group.simulatedSeats < 0) report('valore-impossibile', path, `Gruppo ${group.groupId}: seggi ${group.simulatedSeats}`);
      sum += group.simulatedSeats ?? 0;
    });
    const [low, high] = simulated ? [SEATS[chamber], SEATS[chamber] + (chamber === 'senato' ? 10 : 0)] : REAL_SEAT_RANGE[chamber];
    if (sum < low || sum > high) report('seggi', `parliament.chambers.${chamber}`, `${chamber === 'camera' ? 'Camera' : 'Senato'}: ${sum} seggi assegnati (attesi ${low === high ? low : `${low}–${high}`})`);
  }
}

const seatsOf = (parliament, ids) => { const set = new Set(ids); const out = {}; for (const chamber of CHAMBERS) out[chamber] = records(parliament.chambers?.[chamber]?.groups).filter(group => set.has(group.groupId)).reduce((sum, group) => sum + (group.simulatedSeats ?? 0), 0); return out; };
const chamberTotal = (parliament, chamber) => records(parliament.chambers?.[chamber]?.groups).reduce((sum, group) => sum + (group.simulatedSeats ?? 0), 0);

// The Government and its majority: groups of the current Chambers, ministers from the majority (or its support), a
// Government in office backed by a majority in both Chambers, confidence votes that add up.
function checkGovernment(state, known, report) {
  const parliament = state.parliament;
  const government = parliament?.government;
  if (!government) return;
  const current = new Set([...known.current.camera, ...known.current.senato]);
  if (!GOVERNMENT_STATUSES.has(government.status)) report('valore-impossibile', 'parliament.government.status', `Stato del governo sconosciuto: ${government.status}`);
  if (government.status === 'fallen') return;
  const coalition = government.coalitionGroupIds ?? [];
  const support = government.supportingGroupIds ?? [];
  // A Government for current affairs (caretaker) stays in office after the vote with the groups of the Chambers
  // that gave it the confidence, until the new one is formed: its groups may belong to the previous legislature.
  const valid = government.status === 'caretaker' ? known.groups : current;
  for (const id of [...coalition, ...support]) if (current.size && !valid.has(id)) report('riferimento', 'parliament.government', `Gruppo della maggioranza ${id} assente dalle Camere in carica`);
  if (government.premierGroupId && current.size && !valid.has(government.premierGroupId)) report('riferimento', 'parliament.government.premierGroupId', `Gruppo del premier ${government.premierGroupId} assente dalle Camere`);
  const backing = new Set([...coalition, ...support]);
  records(government.ministers).forEach((minister, index) => {
    if (minister.endedAt) return;
    if (minister.groupId && !backing.has(minister.groupId)) report('coerenza', `parliament.government.ministers[${index}]`, `Ministro (${minister.portfolio}) di un gruppo fuori dalla maggioranza: ${minister.groupId}`);
  });
  const portfolios = records(government.ministers).filter(item => !item.endedAt).map(item => item.portfolio);
  if (new Set(portfolios).size !== portfolios.length) report('id-duplicato', 'parliament.government.ministers', 'Due ministri in carica per lo stesso ministero');
  for (const [index, vote] of records(government.confidenceVotes).entries()) for (const [inner, record] of records(vote.votes).entries()) checkVote(record, `parliament.government.confidenceVotes[${index}].votes[${inner}]`, known, report);
  // A Government in office has the confidence: its majority (with external support) holds in both Chambers.
  if (government.status === 'active' && current.size) {
    const seats = seatsOf(parliament, [...backing]);
    for (const chamber of CHAMBERS) {
      const total = chamberTotal(parliament, chamber);
      if (total && seats[chamber] < Math.floor(total / 2) + 1) report('maggioranza', `parliament.government`, `${government.name}: in carica con ${seats[chamber]} seggi su ${total} (${chamber})`);
    }
  }
}

// One vote: sì + contrari + astenuti + assenti = componenti; the result follows the numbers; groups add up.
function checkVote(vote, path, known, report) {
  const yes = vote.yes ?? 0, against = vote.against, abstain = vote.abstain, absent = vote.absent ?? 0, total = vote.total;
  if (Number.isFinite(total) && Number.isFinite(against) && Number.isFinite(abstain) && yes + against + abstain + absent !== total) report('voti', path, `Voto ${vote.id ?? vote.label}: ${yes} sì + ${against} no + ${abstain} astenuti + ${absent} assenti ≠ ${total}`);
  if (Number.isFinite(total) && Number.isFinite(vote.no) && vote.no !== total - yes) report('voti', path, `Voto ${vote.id ?? vote.label}: “non favorevoli” ${vote.no} ≠ ${total} − ${yes}`);
  if (Number.isFinite(vote.needed) && typeof vote.passed === 'boolean' && vote.passed !== (yes >= vote.needed)) report('voti', path, `Voto ${vote.id ?? vote.label}: esito ${vote.passed ? 'approvato' : 'respinto'} con ${yes} sì su ${vote.needed} necessari`);
  if (Array.isArray(vote.byGroup) && vote.byGroup.length) {
    const sum = vote.byGroup.reduce((acc, row) => acc + (row.yesVotes ?? 0), 0);
    if (sum !== yes) report('voti', path, `Voto ${vote.id ?? vote.label}: sì dei gruppi ${sum} ≠ ${yes}`);
    for (const row of vote.byGroup) {
      const cast = (row.yesVotes ?? 0) + (row.noVotes ?? 0) + (row.abstainVotes ?? 0) + (row.absentVotes ?? 0);
      if (Number.isFinite(row.simulatedSeats) && cast !== row.simulatedSeats) report('voti', path, `Voto ${vote.id ?? vote.label}: gruppo ${row.groupId} con ${cast} voti su ${row.simulatedSeats} seggi`);
      if (row.groupId && !known.groups.has(row.groupId)) report('riferimento', path, `Voto ${vote.id ?? vote.label}: gruppo ${row.groupId} sconosciuto`);
    }
  }
}

// Laws and their passage: known stages, coherent dates, votes that add up, no bill stuck without a next step.
function checkLaws(state, known, report, today) {
  const parliament = state.parliament;
  if (!parliament) return;
  const all = new Map();
  for (const [list, laws] of [['laws', parliament.laws ?? []], ['lawArchive', parliament.lawArchive ?? []]]) laws.forEach((law, index) => {
    const path = `parliament.${list}[${index}]`;
    if (all.has(law.id) && list === 'laws') report('id-duplicato', path, `Legge ${law.id} presente due volte`);
    all.set(law.id, law);
    if (!LAW_STAGES.has(law.stage)) report('valore-impossibile', `${path}.stage`, `Fase sconosciuta: ${law.stage}`);
    if (list === 'lawArchive' && !CLOSED_LAW_STAGES.has(law.stage)) report('coerenza', path, `Legge archiviata ancora in corso: ${law.id} (${law.stage})`);
    for (const key of ['firstChamber', 'currentChamber']) if (law[key] && !CHAMBERS.has(law[key])) report('valore-impossibile', `${path}.${key}`, `Camera sconosciuta: ${law[key]}`);
    if (law.introducedAt && today && law.introducedAt > today) report('data', path, `Legge ${law.id} presentata nel futuro (${law.introducedAt})`);
    if (law.closedAt && law.introducedAt && law.closedAt < law.introducedAt) report('data', path, `Legge ${law.id} chiusa prima di essere presentata`);
    if (law.sponsor?.groupId && !known.groups.has(law.sponsor.groupId)) report('riferimento', `${path}.sponsor`, `Legge ${law.id}: gruppo proponente ${law.sponsor.groupId} sconosciuto`);
    records(law.votes).forEach((vote, inner) => checkVote(vote, `${path}.votes[${inner}]`, known, report));
    // A bill in progress always has a way forward: nothing waits more than a year for its next step. The player's
    // own drafts not yet presented wait for the player (and lapse with the legislature).
    const draft = law.stage === 'proposal' && !law.auto && !law.sponsor;
    if (list === 'laws' && !CLOSED_LAW_STAGES.has(law.stage) && !draft && today) {
      const since = law.stageSince ?? law.updatedAt ?? law.introducedAt;
      if (since && addDays(since, 400) < today) report('blocco', path, `Legge ${law.id} ferma in «${law.stage}» dal ${since}`);
    }
  });
}

// Elections: known states, ordered dates, and always a next vote ahead (the calendar never runs dry).
function checkElections(state, report, today) {
  const game = state.game;
  if (!game?.elections || !today) return;
  game.elections.forEach((election, index) => {
    const path = `game.elections[${index}]`;
    if (!ELECTION_STATUSES.has(election.status)) report('valore-impossibile', `${path}.status`, `Stato elezione sconosciuto: ${election.status}`);
    if (election.windowOpensAt > election.windowClosesAt || election.windowClosesAt > election.electionDate) report('data', path, `Elezione ${election.id}: finestra ${election.windowOpensAt}–${election.windowClosesAt} dopo il voto del ${election.electionDate}`);
    // A vote that should have happened long ago but is still waiting: the calendar is stuck.
    if (['upcoming', 'open'].includes(election.status) && addDays(election.electionDate, 21) < today) report('blocco', path, `Elezione ${election.id} del ${election.electionDate} mai svolta`);
  });
  if (game.status === 'ended') return;
  // Right after a vote the next one is scheduled when the new institutions settle (the Chambers meet, the
  // Government is formed): a few months without a date are allowed, never more.
  for (const type of ['politiche', 'europee']) {
    const all = game.elections.filter(item => item.type === type);
    if (!all.length) continue;
    const next = all.some(item => ['upcoming', 'open', 'running'].includes(item.status) && item.electionDate >= today);
    const last = all.filter(item => item.status === 'held' || item.status === 'missed').map(item => item.electionDate).sort().at(-1);
    if (!next && (!last || addDays(last, 150) < today)) report('elezioni', 'game.elections', `Nessuna elezione ${type} futura in calendario${last ? ` (l’ultima il ${last})` : ''}`);
  }
}

// The campaign in progress (or just finished): known state, the player among the candidates, a result when over.
function checkCampaign(state, report) {
  const campaign = state.campaign;
  if (!campaign) return;
  if (!CAMPAIGN_STATUSES.has(campaign.status)) report('valore-impossibile', 'campaign.status', `Stato della campagna sconosciuto: ${campaign.status}`);
  const candidates = campaign.candidates ?? [];
  if (campaign.playerCandidateId && !candidates.some(item => item.id === campaign.playerCandidateId)) report('riferimento', 'campaign.playerCandidateId', 'Il giocatore non è tra i candidati');
  if (campaign.status === 'finished' && !campaign.result) report('coerenza', 'campaign.result', 'Campagna conclusa senza risultato');
  if (campaign.electionId && state.game?.elections && !state.game.elections.some(item => item.id === campaign.electionId)) report('riferimento', 'campaign.electionId', `Elezione ${campaign.electionId} assente dal calendario`);
}

// The national cycle: the seats of the last general election add up, the formation is in a known phase and a
// completed formation has a Government.
function checkNational(state, known, report) {
  const national = state.national;
  if (!national) return;
  const last = national.lastPolitiche;
  for (const chamber of CHAMBERS) {
    const result = last?.[chamber];
    if (!result?.parties) continue;
    const seats = result.parties.reduce((sum, row) => sum + (row.seats ?? 0), 0);
    if (Number.isFinite(result.total) && seats !== result.total) report('seggi', `national.lastPolitiche.${chamber}`, `Voto ${last.id}: ${seats} seggi assegnati su ${result.total}`);
    if (Number.isFinite(result.total) && result.total !== SEATS[chamber]) report('seggi', `national.lastPolitiche.${chamber}`, `Voto ${last.id}: ${result.total} seggi invece di ${SEATS[chamber]}`);
  }
  const phase = national.formation?.phase;
  if (phase && !['insediamento', 'consultazioni', 'incarico', 'fiducia', 'completata', 'fallita'].includes(phase)) report('valore-impossibile', 'national.formation.phase', `Fase sconosciuta: ${phase}`);
  if (phase === 'completata' && !state.parliament?.government) report('coerenza', 'national.formation', 'Formazione completata senza governo');
}

// Local institutions (council, region, European Parliament): each group's votes add up to its seats, the groups to
// the assembly, acts with unique ids.
function checkLocal(state, report) {
  records(state.local?.institutions).forEach((inst, index) => {
    const path = `local.institutions[${index}]`;
    const seats = records(inst.groups).reduce((sum, group) => sum + (group.seats ?? 0), 0);
    if (Number.isFinite(inst.seats) && inst.groups?.length && seats !== inst.seats) report('seggi', path, `${inst.label ?? inst.id}: ${seats} seggi nei gruppi su ${inst.seats}`);
    for (const [inner, act] of [...records(inst.acts)].entries()) for (const vote of act.votes ?? []) for (const row of vote.byGroup ?? []) {
      const cast = (row.yesVotes ?? 0) + (row.noVotes ?? 0) + (row.abstainVotes ?? 0) + (row.absent ?? 0);
      if (Number.isFinite(row.seats) && cast !== row.seats) report('voti', `${path}.acts[${inner}]`, `${act.title}: gruppo ${row.groupId} con ${cast} voti su ${row.seats} seggi`);
    }
  });
}

// The decisions waiting in the agenda point to things that exist: the law of a vote, the party, the group, the
// institution and act of a local vote, the election of a candidacy.
function checkAgenda(state, known, report) {
  const laws = new Set([...records(state.parliament?.laws), ...records(state.parliament?.lawArchive)].map(law => law.id));
  const institutions = new Map(records(state.local?.institutions).map(inst => [inst.id, inst]));
  const elections = new Set(records(state.game?.elections).map(item => item.id));
  records(state.game?.inbox).forEach((item, index) => {
    const path = `game.inbox[${index}].params`;
    const params = item.params ?? {};
    if (params.lawId && !laws.has(params.lawId)) report('riferimento', path, `Decisione «${item.title}»: legge ${params.lawId} inesistente`);
    if (params.partyId && known.hasRealParties && !known.parties.has(params.partyId)) report('riferimento', path, `Decisione «${item.title}»: partito ${params.partyId} sconosciuto`);
    if (params.groupId && !known.groups.has(params.groupId)) report('riferimento', path, `Decisione «${item.title}»: gruppo ${params.groupId} sconosciuto`);
    if (params.electionId && !elections.has(params.electionId)) report('riferimento', path, `Decisione «${item.title}»: elezione ${params.electionId} inesistente`);
    if (params.instId) {
      const inst = institutions.get(params.instId);
      if (!inst) report('riferimento', path, `Decisione «${item.title}»: istituzione ${params.instId} inesistente`);
      else if (params.actId && ![...records(inst.acts), ...records(inst.archive)].some(act => act.id === params.actId)) report('riferimento', path, `Decisione «${item.title}»: atto ${params.actId} inesistente`);
    }
  });
}
