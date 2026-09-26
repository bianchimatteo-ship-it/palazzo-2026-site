// The Chambers at work without the player. The Government, the groups of the majority and of the opposition and the
// committees present their bills; the calendar of the Chambers moves them through the committee (hearings, amendments,
// obstruction), the floor and the other Chamber; groups take positions from their scenario priorities (parliament-
// engine) and from the relations between their parties (world-engine); the Government accepts the demands of the allies
// it needs or puts the question of confidence; the bills of the opposition often never reach the floor. The player sits
// in one Chamber: speaks, amends and casts a personal vote on every bill there — and the vote has consequences.
// Everything here is simulation (source: simulation); the groups of the real XIX legislature keep their real reference.
import { DATA_SOURCES } from '../data/schema.js?v=20260926-3';
import { AREA_BY_ID, DECREE_RULES, FINANCING, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20260926-3';
import { amendLawPolicy, campOfAxis, cohesiveShare, governingGroupIds, groupProfile, parliamentInternals } from './parliament-engine.js?v=20260926-3';
import { groupLine, splitGroupVote } from './vote-engine.js?v=20260926-3';

const { getGroup, allGroups, record, replaceLaw, demandFor, contentAffinity, setRelation } = parliamentInternals;
const SIM = DATA_SOURCES.SIMULATION;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round2 = value => Math.round(value * 100) / 100;
const CLOSED = ['approved', 'rejected', 'lapsed'];
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const weeksBetween = (from, to) => Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 604800000);
const opposite = chamber => chamber === 'camera' ? 'senato' : 'camera';
const chamberName = chamber => chamber === 'camera' ? 'Camera' : 'Senato';

// ---------- rules of the game ----------
export const LAW_SPONSORS = Object.freeze({
  governo: { label: 'Governo', detail: 'Disegno di legge o decreto del Consiglio dei ministri' },
  maggioranza: { label: 'Maggioranza', detail: 'Proposta di un gruppo della maggioranza' },
  opposizione: { label: 'Opposizione', detail: 'Proposta di un gruppo dell’opposizione' },
  commissione: { label: 'Commissione', detail: 'Testo unificato della commissione, firmato da più gruppi' }
});
export const LEGISLATIVE_RULES = Object.freeze({
  // Weekly chance that an actor presents a bill, and how many bills of each kind of sponsor can be open at once.
  rates: { governo: 0.2, maggioranza: 0.045, opposizione: 0.06, commissione: 0.02 },
  limits: { governo: 4, maggioranza: 4, opposizione: 5, commissione: 2 },
  // Weeks of each passage (at least those of STAGE_WEEKS), set by the calendar of the Chambers.
  assignment: 1, committee: [2, 5], amendments: 1, shuttle: [1, 3],
  // The bills of the groups wait for the calendar, decided by the majority when the committee takes them up: the
  // opposition's reach the floor now and then, the majority's more often, the committees' texts almost always; the
  // others wait (a few are picked up later) and lapse in committee.
  calendarChance: { opposizione: 0.3, maggioranza: 0.7, commissione: 0.85 }, lateCalendarChance: 0.06, calendarRetryWeeks: 3, stallWeeks: 26,
  // The budget law of the Government: presented in October, to be approved by 31 December.
  budgetMonth: 10,
  // Saves stay light: bills closed long ago keep only their outcome.
  keepClosed: 28, archive: 160, autoHistory: 160,
  source: SIM
});
// The permanent committee competent for each area (the real committees of the XIX legislature, committees.json).
const CAMERA_COMMITTEE = { economia: '05', finanze: '05', mezzogiorno: '05', fisco: '06', industria: '10', commercio: '10', turismo: '10', energia: '10', lavoro: '11', pensioni: '11', welfare: '12', sanita: '12', famiglia: '12', demografia: '12', scuola: '07', universita: '07', cultura: '07', sport: '07', giovani: '07', infrastrutture: '08', ambiente: '08', casa: '08', trasporti: '09', digitale: '09', agricoltura: '13', sicurezza: '01', immigrazione: '01', cittadinanza: '01', pa: '01', autonomie: '01', giustizia: '02', esteri: '03', difesa: '04', europa: '14' };
const SENATE_COMMITTEE = { sicurezza: '01', immigrazione: '01', cittadinanza: '01', pa: '01', autonomie: '01', giustizia: '02', esteri: '03', difesa: '03', europa: '04', economia: '05', finanze: '05', mezzogiorno: '05', fisco: '06', scuola: '07', universita: '07', cultura: '07', sport: '07', giovani: '07', ambiente: '08', infrastrutture: '08', trasporti: '08', energia: '08', digitale: '08', casa: '08', industria: '09', commercio: '09', turismo: '09', agricoltura: '09', welfare: '10', sanita: '10', lavoro: '10', pensioni: '10', famiglia: '10', demografia: '10' };
export const committeeFor = (chamber, area) => `commissione-${chamber}-xix-${(chamber === 'camera' ? CAMERA_COMMITTEE : SENATE_COMMITTEE)[area] ?? '01'}`;

// ---------- the groups and their parties ----------
// The force of the world behind each group: a group born from a vote of the game already knows it; a group of the real
// XIX legislature is read from its name — the force it mentions first (a force outside the polls only when the name
// starts with it), or else the force in the polls whose name contains the first part of the group's name ("Lega -
// Salvini Premier" → "Lega per Salvini Premier"); the Misto has none. The axis of the force gives the group its
// collocazione in the game.
const phraseKey = value => ` ${String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[’']/g, ' ').replace(/\+\s+/g, '+').replace(/[^a-z0-9+]+/g, ' ').trim()} `;
export function linkGroupsToParties(parliament, world) {
  if (!parliament?.chambers || !world?.parties) return parliament;
  const forces = [...world.parties.filter(party => party.active).map(party => ({ party, latent: false })), ...(world.latent ?? []).map(party => ({ party, latent: true }))];
  const axisOfParty = id => { const force = forces.find(item => item.party.id === id)?.party; return Number.isFinite(force?.axis) ? force.axis : null; };
  let changed = false;
  const chambers = Object.fromEntries(Object.entries(parliament.chambers).map(([chamber, data]) => [chamber, { ...data, groups: (data.groups ?? []).map(group => {
    // Read once (again for a group left without a force by an earlier, stricter reading).
    if (group.partyChecked === 2 || (group.partyChecked && group.partyId)) return group;
    changed = true;
    if (group.partyId !== undefined && group.partyId !== null) return { ...group, axis: Number.isFinite(group.axis) ? group.axis : axisOfParty(group.partyId) ?? 0, partyChecked: 2 };
    const bare = String(group.officialName ?? '').replace(/^\s*misto\s*[-–]?\s*/i, '');
    if (!bare.trim()) return { ...group, partyId: null, axis: 0, partyChecked: 2 };
    const name = phraseKey(bare);
    const direct = forces.map(({ party, latent }) => {
      const keys = [party.label, party.officialName, party.abbreviation].filter(Boolean).map(phraseKey).filter(key => key.trim().length >= 3);
      const at = Math.min(...keys.map(key => name.indexOf(key)).filter(index => index >= 0));
      return Number.isFinite(at) && (!latent || at === 0) ? { id: party.id, at, length: Math.max(...keys.map(key => key.length)), latent } : null;
    }).filter(Boolean).sort((a, b) => a.at - b.at || b.length - a.length || Number(a.latent) - Number(b.latent));
    // The first part of the group's name inside the name of a force in the polls (the largest one when several).
    const head = phraseKey(bare.split(/\s[-–]\s|-(?=[A-Z])/)[0]);
    const reverse = head.trim().length >= 4 ? forces.filter(({ party, latent }) => !latent && [party.label, party.officialName].filter(Boolean).some(label => phraseKey(label).includes(head))).sort((a, b) => (b.party.baseline ?? 0) - (a.party.baseline ?? 0)) : [];
    const partyId = (direct[0]?.at === 0 ? direct[0].id : null) ?? reverse[0]?.party.id ?? direct[0]?.id ?? null;
    return { ...group, partyId, partyVia: partyId ? 'nome del gruppo' : null, axis: Number.isFinite(group.axis) && group.partyId ? group.axis : axisOfParty(partyId) ?? 0, partyChecked: 2 };
  }) }]));
  return changed ? { ...parliament, chambers } : parliament;
}
// The current agenda of each force reaches its groups: what a group cares about in the Chambers changes with it.
export function syncAgendas(parliament, world) {
  if (!parliament?.chambers || !world?.parties) return parliament;
  const agendaOf = new Map(world.parties.filter(party => party.agenda?.length).map(party => [party.id, party.agenda]));
  let changed = false;
  const chambers = Object.fromEntries(Object.entries(parliament.chambers).map(([chamber, data]) => [chamber, { ...data, groups: (data.groups ?? []).map(group => {
    const agenda = group.partyId ? agendaOf.get(group.partyId) : null;
    if (!agenda || (group.agenda ?? []).join(',') === agenda.join(',')) return group;
    changed = true;
    return { ...group, agenda: [...agenda] };
  }) }]));
  return changed ? { ...parliament, chambers } : parliament;
}
const axisOf = group => Number.isFinite(group?.axis) ? group.axis : 0;
const tieKey = (a, b) => [a, b].sort().join('|');

// ---------- new bills ----------
// How a camp designs a measure: the instruments and the covers it prefers (rules of the game).
function designFor(axis, area, rand, { urgent = false } = {}) {
  const camp = campOfAxis(axis);
  const instruments = urgent ? ['sostegno', 'investimento'] : camp === 'destra' ? ['regole', 'sostegno', 'riforma', 'investimento'] : camp === 'sinistra' ? ['investimento', 'sostegno', 'riforma', 'regole'] : ['riforma', 'regole', 'investimento', 'sostegno'];
  const financings = camp === 'destra' ? ['tagli', 'evasione', 'deficit', 'consumi'] : camp === 'sinistra' ? ['rendite', 'irpef', 'evasione', 'deficit'] : ['evasione', 'tagli', 'ue', 'deficit'];
  const pick = list => list[Math.min(list.length - 1, Math.floor(rand() * rand() * list.length))];
  const financing = pick(financings);
  return { area, instrument: pick(instruments), intensity: urgent ? 2 : rand() < 0.55 ? 1 : 2, financing: financing === 'ue' && !AREA_BY_ID[area].euFunds ? 'deficit' : financing, target: 'nazionale', segment: 'tutti', compromise: 0 };
}
function newLaw(parliament, { sponsor, area, kind = 'ddl', design = null, title, summary, date, chamber, origin, plan = null }) {
  const count = (parliament.laws ?? []).length + (parliament.lawArchive ?? []).length + 1;
  const id = `legge-${kind}-${date}-${count}-${String(sponsor.groupId ?? sponsor.kind).slice(-14)}`.replace(/[^a-z0-9-]/gi, '-');
  return {
    id, title, category: kind === 'manovra' ? 'Finanze pubbliche' : AREA_BY_ID[area].label, summary,
    status: 'proposal', stage: 'proposal', introducedAt: date, updatedAt: date, stageSince: date,
    firstChamber: chamber, currentChamber: chamber, negotiatedGroupIds: [], amendments: [], compromiseLevel: 0, forcedVote: false, demands: {},
    origin, kind, policy: kind === 'manovra' ? { plan } : { ...design, area }, votes: [], source: SIM,
    auto: true, sponsor, committeeId: committeeFor(chamber, kind === 'manovra' ? 'finanze' : area), nextStepAt: addDays(date, LEGISLATIVE_RULES.assignment * 7),
    journal: [{ date, text: `Presentata da ${sponsor.label}.` }]
  };
}
const openAuto = parliament => (parliament.laws ?? []).filter(law => law.auto && !CLOSED.includes(law.stage));
const openOf = (parliament, kind) => openAuto(parliament).filter(law => law.sponsor?.kind === kind && law.kind === 'ddl').length;
// The areas the Government legislates on: the problems of the country first, then its programme and priorities.
function governmentArea(government, premier, society, rand) {
  const issues = (society?.issues ?? []).map(issue => issue.area ?? POLICY_AREAS.find(item => item.label === issue.topic)?.id).filter(id => AREA_BY_ID[id]);
  if (issues.length && rand() < 0.5) return issues[Math.floor(rand() * Math.min(3, issues.length))];
  const own = government.program?.priorities?.length && rand() < 0.6 ? government.program.priorities : groupProfile(premier ?? 'governo').likes;
  return own[Math.floor(rand() * own.length)];
}
function generateBills(parliament, { date, rand, society, world }) {
  const created = [];
  let next = parliament;
  const governing = governingGroupIds(next);
  const government = next.government;
  const partyLabel = id => world?.parties?.find(item => item.id === id)?.label ?? null;
  const add = spec => {
    const law = newLaw(next, spec);
    next = record({ ...next, laws: [...(next.laws ?? []), law] }, date, 'legge-presentata', `${spec.sponsor.label} presenta “${law.title}”.`, { lawId: law.id, sponsor: spec.sponsor.kind, auto: true });
    created.push(law);
    return law;
  };
  // The Government of a simulated Prime Minister: bills on its programme and on the problems of the country, a decree
  // when an emergency calls for it, the budget law every autumn.
  const ledByOthers = government?.status === 'active' && government.primeMinister !== 'player' && government.formedBy !== 'player';
  if (ledByOthers) {
    const premier = getGroup(next, government.premierGroupId) ?? allGroups(next).find(group => governing.has(group.groupId)) ?? null;
    const sponsor = { kind: 'governo', groupId: premier?.groupId ?? null, partyId: premier?.partyId ?? null, label: 'Il governo' };
    const chamber = () => rand() < 0.5 ? 'camera' : 'senato';
    const year = Number(date.slice(0, 4)) + 1;
    const budgetOpen = (next.laws ?? []).some(law => law.kind === 'manovra' && law.budgetYear === year && law.stage !== 'rejected');
    if (Number(date.slice(5, 7)) >= LEGISLATIVE_RULES.budgetMonth && !budgetOpen && (government.budgetYear ?? 0) < year) {
      const groupsOfAreas = [...new Set(groupProfile(premier ?? 'governo').likes.map(id => AREA_BY_ID[id]?.group).filter(Boolean))].slice(0, 2);
      const law = add({ sponsor, area: 'finanze', kind: 'manovra', title: `Legge di bilancio ${year}`, summary: `Priorità di spesa, entrate e saldi del ${year}: va approvata dalle due Camere entro il 31 dicembre, altrimenti scatta l’esercizio provvisorio.`, date, chamber: chamber(), origin: 'governo', plan: { allocations: Object.fromEntries(groupsOfAreas.map(id => [id, 1])), taxes: 0 } });
      next = replaceLaw(next, law.id, current => ({ ...current, budgetYear: year, nextStepAt: addDays(date, 7) }));
    }
    const urgent = (society?.issues ?? []).map(issue => ({ issue, area: issue.area ?? POLICY_AREAS.find(item => item.label === issue.topic)?.id })).find(item => AREA_BY_ID[item.area] && (item.issue.severity ?? 0) >= 6);
    const decrees = (next.laws ?? []).filter(law => law.kind === 'decreto' && !CLOSED.includes(law.stage)).length;
    if (urgent && decrees < DECREE_RULES.maxOpen && (!government.lastDecreeAt || weeksBetween(government.lastDecreeAt, date) >= DECREE_RULES.cooldownWeeks) && rand() < 0.3) {
      const area = urgent.area;
      const law = add({ sponsor, area, kind: 'decreto', design: designFor(axisOf(premier), area, rand, { urgent: true }), title: `Decreto-legge: misure urgenti per ${AREA_BY_ID[area].label.toLowerCase()}`, summary: `Adottato d’urgenza per ${String(urgent.issue.topic ?? AREA_BY_ID[area].label).toLowerCase()}: è in vigore da subito, ma decade se le Camere non lo convertono in legge entro 60 giorni.`, date, chamber: chamber(), origin: 'governo' });
      next = replaceLaw(next, law.id, current => ({ ...current, stage: 'commission', status: 'commission', inForce: true, deadline: addDays(date, DECREE_RULES.conversionWeeks * 7), nextStepAt: addDays(date, 14) }));
      next = { ...next, government: { ...next.government, lastDecreeAt: date, decrees: (next.government.decrees ?? 0) + 1 } };
      next = record(next, date, 'decreto-adottato', `Il Consiglio dei ministri adotta il decreto-legge “${law.title}”: va convertito entro il ${addDays(date, DECREE_RULES.conversionWeeks * 7)}.`, { lawId: law.id, auto: true });
    }
    if (openOf(next, 'governo') < LEGISLATIVE_RULES.limits.governo && rand() < LEGISLATIVE_RULES.rates.governo) {
      const area = governmentArea(government, premier, society, rand);
      const design = designFor(axisOf(premier), area, rand);
      add({ sponsor, area, design, title: AREA_BY_ID[area].instruments[design.instrument], summary: `Disegno di legge del governo (${AREA_BY_ID[area].label.toLowerCase()}); copertura: ${FINANCING[design.financing]?.label.toLowerCase() ?? 'da definire'}.`, date, chamber: chamber(), origin: 'governo' });
    }
  }
  // The groups: bills of the majority and of the opposition (the player's colleagues too), from their priorities.
  if (government?.status !== 'caretaker') for (const group of allGroups(next).filter(item => item.simulatedSeats >= 4 && item.partyId)) {
    const kind = governing.has(group.groupId) ? 'maggioranza' : 'opposizione';
    if (openOf(next, kind) >= LEGISLATIVE_RULES.limits[kind] || rand() >= LEGISLATIVE_RULES.rates[kind]) continue;
    const likes = groupProfile(group).likes;
    const area = likes[Math.floor(rand() * likes.length)];
    const design = designFor(axisOf(group), area, rand);
    const name = partyLabel(group.partyId) ?? group.officialName;
    add({ sponsor: { kind, groupId: group.groupId, partyId: group.partyId, label: name }, area, design, title: AREA_BY_ID[area].instruments[design.instrument], summary: `Proposta di ${name} (${AREA_BY_ID[area].label.toLowerCase()}); copertura: ${FINANCING[design.financing]?.label.toLowerCase() ?? 'da definire'}.`, date, chamber: group.chamber, origin: 'parlamentare' });
  }
  if (government?.status !== 'caretaker' && openOf(next, 'commissione') < LEGISLATIVE_RULES.limits.commissione && rand() < LEGISLATIVE_RULES.rates.commissione) {
    const area = POLICY_AREAS[Math.floor(rand() * POLICY_AREAS.length)].id;
    add({ sponsor: { kind: 'commissione', groupId: null, partyId: null, label: 'La commissione' }, area, design: { ...designFor(0, area, rand), intensity: 1, instrument: 'regole' }, title: `Testo unificato: ${AREA_BY_ID[area].instruments.regole.toLowerCase()}`, summary: `Più proposte di gruppi diversi riunite in un solo testo (${AREA_BY_ID[area].label.toLowerCase()}), firmato da maggioranza e opposizione.`, date, chamber: rand() < 0.5 ? 'camera' : 'senato', origin: 'parlamentare' });
  }
  return { parliament: next, created };
}

// ---------- positions and votes ----------
// How much a group supports a bill (0–1): who presented it, majority and opposition, collocazione, the group's
// priorities against the content, the relations between the parties, the allies' mood, the accepted demands and
// compromises, the question of confidence, and the player's public position for the player's own group.
const sponsorGoverns = (parliament, law, governing = governingGroupIds(parliament)) => law.sponsor?.kind === 'governo' || Boolean(law.sponsor?.groupId && governing.has(law.sponsor.groupId));
export function groupSupport(parliament, law, group, { world = null } = {}) {
  const governing = governingGroupIds(parliament);
  const sponsor = law.sponsor ?? { kind: 'giocatore', groupId: parliament.player?.groupId ?? null };
  if (sponsor.groupId && group.groupId === sponsor.groupId && sponsor.kind !== 'governo') return 0.9;
  const sponsorGroup = sponsor.groupId ? getGroup(parliament, sponsor.groupId) : null;
  const inGov = governing.has(group.groupId);
  const fromGovernment = sponsorGoverns(parliament, law, governing);
  let support = sponsor.kind === 'commissione' ? 0.64 : fromGovernment ? (inGov ? 0.7 : 0.3) : (inGov ? 0.32 : 0.5);
  if (sponsor.kind !== 'commissione') support += (1.5 - Math.abs(axisOf(group) - axisOf(sponsorGroup))) * 0.05;
  support += contentAffinity(group, law) * 0.1;
  if (group.partyId && sponsorGroup?.partyId && group.partyId !== sponsorGroup.partyId && world?.ties) support += clamp((world.ties[tieKey(group.partyId, sponsorGroup.partyId)] ?? 0) / 500, -0.1, 0.1);
  const partner = parliament.government?.partners?.[group.groupId];
  if (fromGovernment && inGov && partner) support += (partner.satisfaction - 55) / 250;
  support += (law.compromiseLevel ?? 0) * 0.035;
  if (law.demands?.[group.groupId]?.accepted) support += 0.12;
  if (law.confidence && inGov) support += 0.2;
  if (law.playerStance && group.groupId === parliament.player?.groupId) support += law.playerStance === 'favorevole' ? 0.04 : -0.04;
  return clamp(support, 0.05, 0.95);
}
export const lineOf = support => support >= 0.55 ? 'favorevole' : support <= 0.42 ? 'contrario' : 'astenuto';
// The vote of a Chamber on a bill of the calendar. The player's seat votes as the player decided (the line of the
// group without a decision); the rest of each group follows its support, with dissenters (vote-engine).
export function autoVote(parliament, law, chamber, { date, world = null, playerChoice = null } = {}) {
  const governing = governingGroupIds(parliament);
  const rows = parliament.chambers[chamber].groups;
  const playerGroupId = parliament.player?.chamber === chamber && parliament.player.groupId ? parliament.player.groupId : null;
  let yes = 0;
  let choice = null;
  let groupLineBefore = null;
  const byGroup = rows.map(group => {
    const support = groupSupport(parliament, law, group, { world });
    const line = lineOf(support);
    const own = group.groupId === playerGroupId;
    const others = own ? Math.max(0, group.simulatedSeats - 1) : group.simulatedSeats;
    let votes = Math.round(others * cohesiveShare(support));
    const split = splitGroupVote({ seats: others, yes: votes, confidence: Boolean(law.confidence), seed: `${law.id}|${chamber}|${(law.votes ?? []).length}|${group.groupId}` });
    let no = split.no, abstain = split.abstain;
    if (own) {
      groupLineBefore = line;
      choice = !playerChoice || playerChoice === 'linea' ? line : playerChoice;
      if (choice === 'favorevole') votes += 1; else if (choice === 'contrario') no += 1; else if (choice === 'astenuto') abstain += 1;
    }
    yes += votes;
    return { groupId: group.groupId, yesVotes: votes, noVotes: no, abstainVotes: abstain, line: groupLine({ yes: votes, no, abstain }), governing: governing.has(group.groupId), simulatedSeats: group.simulatedSeats, ...(own ? { playerChoice: choice } : {}) };
  });
  const total = rows.reduce((sum, group) => sum + group.simulatedSeats, 0);
  const needed = Math.floor(total / 2) + 1;
  const passed = yes >= needed;
  // The player's vote decides when, without it, the outcome would have been the opposite.
  const decisive = Boolean(choice) && (choice === 'favorevole' ? passed && yes === needed : !passed && yes === needed - 1);
  return {
    id: `${law.id}-${chamber}-${(law.votes ?? []).length + 1}`, date, kind: law.kind === 'decreto' ? 'decreto' : law.kind === 'manovra' ? 'manovra' : 'legge', label: law.title, chamber,
    yes, no: total - yes, against: byGroup.reduce((sum, row) => sum + row.noVotes, 0), abstain: byGroup.reduce((sum, row) => sum + row.abstainVotes, 0), total, needed, passed,
    forced: false, confidence: Boolean(law.confidence), secret: false, snipers: 0, byGroup, playerChoice: choice, playerLine: groupLineBefore, decisive, source: SIM
  };
}
// What the Chamber is expected to do (no dissent drawn, no decision of the player): the forecast before the vote.
export function forecastVote(parliament, law, { world = null } = {}) {
  const chamber = law.currentChamber;
  const rows = parliament.chambers?.[chamber]?.groups ?? [];
  const total = rows.reduce((sum, group) => sum + group.simulatedSeats, 0);
  let yes = 0;
  const positions = rows.map(group => { const support = groupSupport(parliament, law, group, { world }); yes += group.simulatedSeats * cohesiveShare(support); return { groupId: group.groupId, support: round2(support), line: lineOf(support), seats: group.simulatedSeats }; });
  const needed = Math.floor(total / 2) + 1;
  return { chamber, yes: Math.round(yes), needed, total, margin: Math.round(yes - needed), passes: yes >= needed, positions };
}

// ---------- the calendar ----------
const note = (law, date, text) => text ? { ...law, journal: [...(law.journal ?? []), { date, text }].slice(-10) } : law;
const HEARINGS = ['Audizione dei sindacati', 'Audizione delle associazioni d’impresa', 'Audizione di esperti e università', 'Audizione della Conferenza delle Regioni', 'Audizione delle associazioni dei cittadini', 'Audizione della Banca d’Italia e dell’Istat'];
const between = (rand, [min, max]) => min + Math.floor(rand() * (max - min + 1));
// One passage of a bill whose date has come; the events are for the career (the player's votes).
function stepLaw(parliament, law, ctx) {
  const { date, rand, world } = ctx;
  let next = parliament;
  const events = [];
  const set = (patch, text = '') => { next = replaceLaw(next, law.id, current => note({ ...current, ...patch, updatedAt: date, ...(patch.stage && patch.stage !== current.stage ? { stageSince: date } : {}) }, date, text)); };
  const governing = governingGroupIds(next);
  const fromGovernment = sponsorGoverns(next, law, governing);
  if (law.stage === 'proposal') {
    const weeks = law.kind === 'ddl' ? between(rand, LEGISLATIVE_RULES.committee) : 2;
    set({ stage: 'commission', status: 'commission', nextStepAt: addDays(date, weeks * 7) }, 'Assegnata alla commissione competente.');
    return { parliament: next, events };
  }
  if (law.stage === 'commission') {
    // A bill of the groups needs the majority to put it in the calendar (the Government's texts come first): decided
    // once, when the committee takes it up; a bill left out is picked up later only now and then.
    const calendared = law.sponsor?.kind === 'governo' || law.kind !== 'ddl' || (law.calendared ?? rand() < LEGISLATIVE_RULES.calendarChance[fromGovernment ? 'maggioranza' : law.sponsor?.kind === 'commissione' ? 'commissione' : 'opposizione']) || rand() < LEGISLATIVE_RULES.lateCalendarChance;
    if (law.calendared === undefined && law.kind === 'ddl') set({ calendared });
    if (!calendared) {
      if (weeksBetween(law.introducedAt, date) >= LEGISLATIVE_RULES.stallWeeks) {
        set({ stage: 'lapsed', status: 'arenata' }, 'Mai messa in calendario: resta ferma in commissione.');
        next = record(next, date, 'legge-arenata', `“${law.title}” (${law.sponsor.label}) resta ferma in commissione: la maggioranza non la mette in calendario.`, { lawId: law.id, sponsor: law.sponsor?.kind ?? null, auto: true });
      } else set({ nextStepAt: addDays(date, LEGISLATIVE_RULES.calendarRetryWeeks * 7) }, 'La maggioranza rinvia l’esame.');
      return { parliament: next, events };
    }
    const hearing = HEARINGS[Math.floor(rand() * HEARINGS.length)];
    set({ stage: 'amendments', status: 'amendments', hearings: [...(law.hearings ?? []), { date, label: hearing }].slice(-3), nextStepAt: addDays(date, LEGISLATIVE_RULES.amendments * 7) }, `${hearing}; si aprono gli emendamenti.`);
    // The opposition obstructs a bill of the majority it dislikes: hundreds of amendments slow it down.
    if (fromGovernment && law.kind === 'ddl' && rand() < 0.2) {
      set({ obstruction: (law.obstruction ?? 0) + 1, nextStepAt: addDays(date, (LEGISLATIVE_RULES.amendments + between(rand, [1, 2])) * 7) }, 'L’opposizione presenta centinaia di emendamenti: ostruzionismo.');
      next = record(next, date, 'ostruzionismo', `Ostruzionismo dell’opposizione su “${law.title}”.`, { lawId: law.id, auto: true });
    }
    return { parliament: next, events };
  }
  if (law.stage === 'amendments' || law.stage === 'final-vote') {
    let working = next.laws.find(item => item.id === law.id);
    // Before the vote the sponsor counts the votes: the Government accepts the demands of the allies it needs, and on
    // a text of its own puts the question of confidence when the majority still wavers.
    let forecast = forecastVote(next, working, { world });
    if (!forecast.passes && fromGovernment) {
      const pivotal = forecast.positions.filter(item => item.line !== 'favorevole' && governing.has(item.groupId) && !working.demands?.[item.groupId]?.accepted).sort((a, b) => b.seats - a.seats).slice(0, 2);
      for (const item of pivotal) {
        const demand = demandFor(next, working, item.groupId);
        try { next = amendLawPolicy(next, working.id, demand.patch, date, { author: item.groupId, label: `Accolta la richiesta di ${getGroup(next, item.groupId)?.officialName ?? 'un alleato'}: ${demand.label}` }); } catch { /* the text can no longer be amended */ }
        next = replaceLaw(next, working.id, current => note({ ...current, demands: { ...(current.demands ?? {}), [item.groupId]: { ...demand, accepted: true, date, source: SIM } } }, date, `Accolta una richiesta di ${getGroup(next, item.groupId)?.officialName ?? 'un alleato'}: ${demand.label}.`));
        working = next.laws.find(entry => entry.id === law.id);
      }
      forecast = forecastVote(next, working, { world });
      if (!forecast.passes && law.sponsor?.kind === 'governo' && !working.confidence && forecast.margin > -25 && next.government?.status === 'active') {
        next = replaceLaw(next, law.id, current => note({ ...current, confidence: true }, date, 'Il governo pone la questione di fiducia.'));
        next = record(next, date, 'fiducia-posta', `Il governo pone la questione di fiducia su “${law.title}”: se la perde, cade.`, { lawId: law.id, auto: true });
        working = next.laws.find(item => item.id === law.id);
      }
    }
    const chamber = working.currentChamber;
    // The player's decision (from the agenda or the bill's card); without one the player's seat follows the line.
    const decided = next.player?.chamber === chamber ? working.pendingPlayerVote ?? null : null;
    const vote = autoVote(next, working, chamber, { date, world, playerChoice: decided });
    const finalVote = working.stage === 'final-vote';
    const stage = vote.passed ? (finalVote ? 'approved' : 'other-chamber') : 'rejected';
    const wait = stage === 'other-chamber' ? between(rand, LEGISLATIVE_RULES.shuttle) * (working.kind === 'ddl' ? 1 : 0.5) : 0;
    next = replaceLaw(next, law.id, current => note({ ...current, stage, status: stage, votes: [...(current.votes ?? []), vote], pendingPlayerVote: null, pausedAt: null, updatedAt: date, stageSince: date, nextStepAt: stage === 'other-chamber' ? addDays(date, Math.max(1, Math.round(wait)) * 7) : null }, date, `${chamberName(chamber)}: ${vote.passed ? 'approvata' : 'respinta'} con ${vote.yes} voti favorevoli (soglia ${vote.needed}).`));
    const outcome = vote.passed ? (finalVote ? 'approvazione definitiva' : 'primo sì') : 'bocciatura';
    next = record(next, date, `iter-${stage}`, `${chamberName(chamber)}: ${outcome} per “${law.title}” (${law.sponsor?.label ?? 'proposta'}: ${vote.yes} favorevoli, soglia ${vote.needed}).`, { lawId: law.id, stage, kind: working.kind, origin: working.origin, sponsor: working.sponsor?.kind ?? null, partyId: working.sponsor?.partyId ?? null, auto: true });
    // A Government that loses a vote of confidence falls; a Government text rejected weakens it; one approved helps.
    const government = next.government;
    if (government && ['active', 'crisis'].includes(government.status)) {
      if (!vote.passed && working.confidence) {
        const ministers = government.ministers.map(item => item.endedAt ? item : { ...item, endedAt: date, endReason: 'Fiducia negata' });
        next = record({ ...next, government: { ...government, status: 'fallen', stability: 0, ministers, fallenAt: date } }, date, 'fiducia-negata', `Il governo perde la fiducia su “${law.title}” e cade.`, { governmentId: government.id, lawId: law.id, auto: true });
      } else if (fromGovernment) next = { ...next, government: { ...government, stability: clamp((government.stability ?? 50) + (vote.passed ? (finalVote ? 2 : 0.5) : -6), 0, 100), ...(finalVote && vote.passed && working.kind === 'manovra' ? { budgetYear: working.budgetYear } : {}) } };
    }
    // Dissent inside the majority on a text of the majority is news: the allies read it as a warning.
    for (const row of vote.byGroup.filter(item => item.governing && fromGovernment && item.line === 'favorevole' && item.noVotes + item.abstainVotes >= Math.max(3, Math.round(item.simulatedSeats * 0.12)))) {
      next = record(next, date, 'dissenso-maggioranza', `${row.noVotes + row.abstainVotes} parlamentari di ${getGroup(next, row.groupId)?.officialName ?? 'un gruppo della maggioranza'} non seguono la linea su “${law.title}”.`, { lawId: law.id, groupId: row.groupId, count: row.noVotes + row.abstainVotes, auto: true });
      if (next.government?.partners?.[row.groupId]) next = { ...next, government: { ...next.government, stability: clamp((next.government.stability ?? 50) - 1, 0, 100) } };
    }
    if (decided && vote.playerChoice) events.push({ type: 'voto-giocatore', lawId: law.id, title: law.title, sponsor: working.sponsor, kind: working.kind, choice: vote.playerChoice, line: vote.playerLine, passed: vote.passed, finalVote, chamber, yes: vote.yes, needed: vote.needed, decisive: vote.decisive, confidence: Boolean(working.confidence), fromGovernment, dealBroken: Boolean(working.playerDeal) && vote.playerChoice !== 'favorevole' });
    return { parliament: next, events };
  }
  if (law.stage === 'other-chamber') {
    set({ stage: 'final-vote', status: 'final-vote', currentChamber: opposite(law.currentChamber), committeeId: committeeFor(opposite(law.currentChamber), law.kind === 'manovra' ? 'finanze' : law.policy?.area ?? 'economia'), negotiatedGroupIds: [], nextStepAt: addDays(date, (law.kind === 'ddl' ? 2 : 1) * 7) }, `Trasmessa ${law.currentChamber === 'camera' ? 'al Senato' : 'alla Camera'}.`);
    return { parliament: next, events };
  }
  return { parliament: next, events };
}

// ---------- the player on the bills of the others ----------
function openLawIn(parliament, lawId) {
  const law = parliament.laws.find(item => item.id === lawId);
  if (!law?.auto || CLOSED.includes(law.stage)) throw new Error('La proposta non è più in discussione.');
  if (!parliament.player?.groupId) throw new Error('Serve un seggio con un gruppo parlamentare.');
  if (law.currentChamber !== parliament.player.chamber) throw new Error(`La proposta ora è all’esame ${law.currentChamber === 'camera' ? 'della Camera' : 'del Senato'}: potrai intervenire quando arriva nella tua Camera.`);
  return law;
}
// A public position in committee or on the floor: the sponsor's group notices it, and so does the player's own group.
export function speakOnLaw(parliament, lawId, stance, date) {
  const law = openLawIn(parliament, lawId);
  if (!['favorevole', 'contrario'].includes(stance)) throw new Error('Scegli se sostenere o contrastare la proposta.');
  if (law.playerStance === stance) throw new Error('Hai già preso questa posizione.');
  let next = replaceLaw(parliament, lawId, current => note({ ...current, playerStance: stance }, date, `Intervieni in Aula ${stance === 'favorevole' ? 'a favore' : 'contro'}.`));
  if (law.sponsor?.groupId && law.sponsor.groupId !== parliament.player.groupId) next = setRelation(next, law.sponsor.groupId, stance === 'favorevole' ? 3 : -3);
  return record(next, date, 'intervento-aula', `Intervieni ${stance === 'favorevole' ? 'a sostegno di' : 'contro'} “${law.title}”.`, { lawId, stance });
}
// The odds that the sponsor accepts an amendment of the player: relations, the same side, the player's weight and a
// role in committee, and the player's vote offered in exchange (a deal: breaking it later costs dearly); nothing passes
// on a text under a question of confidence.
export function amendmentOdds(parliament, law, { influence = 50, committeeRole = false, offerVote = false } = {}) {
  if (law.confidence) return 0;
  const governing = governingGroupIds(parliament);
  const relation = law.sponsor?.groupId ? parliament.relations?.[law.sponsor.groupId]?.value ?? 50 : 55;
  const sameSide = governing.has(parliament.player?.groupId) === sponsorGoverns(parliament, law, governing);
  return round2(clamp(0.22 + (relation - 50) / 110 + (committeeRole ? 0.15 : 0) + (sameSide ? 0.12 : -0.05) + (influence - 50) / 250 + (offerVote ? 0.15 : 0), 0.03, 0.9));
}
export function amendOthersLaw(parliament, lawId, patch, date, { influence = 50, committeeRole = false, roll = 0.5, offerVote = false } = {}) {
  const law = openLawIn(parliament, lawId);
  if (!['commission', 'amendments'].includes(law.stage)) throw new Error('Gli emendamenti si presentano in commissione, prima del voto.');
  if ((law.playerAmendments ?? []).filter(item => item.chamber === law.currentChamber).length >= 2) throw new Error('Hai già presentato due emendamenti a questo testo in questa Camera.');
  const chance = amendmentOdds(parliament, law, { influence, committeeRole, offerVote });
  const entry = { date, patch, chamber: law.currentChamber, chance, offerVote: Boolean(offerVote) };
  if (roll >= chance) {
    const next = replaceLaw(parliament, lawId, current => note({ ...current, playerAmendments: [...(current.playerAmendments ?? []), { ...entry, accepted: false }] }, date, 'Respinto un tuo emendamento.'));
    return { parliament: record(next, date, 'emendamento-respinto', `Il tuo emendamento a “${law.title}” viene respinto.`, { lawId, chance }), accepted: false, chance };
  }
  const sameSide = governingGroupIds(parliament).has(parliament.player.groupId) === sponsorGoverns(parliament, law);
  let next = amendLawPolicy(parliament, lawId, patch, date, { author: 'player', label: 'Approvato un emendamento del giocatore' });
  next = replaceLaw(next, lawId, current => note({ ...current, playerAmendments: [...(current.playerAmendments ?? []), { ...entry, accepted: true }], compromiseLevel: Math.min(3, (current.compromiseLevel ?? 0) + (sameSide ? 0 : 1)), ...(offerVote ? { playerDeal: { date, groupId: law.sponsor?.groupId ?? null }, pendingPlayerVote: 'favorevole' } : {}) }, date, offerVote ? 'Accordo: il tuo emendamento entra nel testo, il tuo voto sarà favorevole.' : 'Approvato un tuo emendamento.'));
  if (law.sponsor?.groupId) next = setRelation(next, law.sponsor.groupId, 2);
  return { parliament: record(next, date, 'emendamento-approvato', `Approvato il tuo emendamento a “${law.title}”.`, { lawId, chance }), accepted: true, chance };
}
// The vote the player will cast when the bill comes to the floor of the player's Chamber.
export const PLAYER_VOTE_CHOICES = Object.freeze({ linea: 'Segui la linea del gruppo', favorevole: 'Favorevole', contrario: 'Contrario', astenuto: 'Astenuto', assente: 'Non partecipi al voto' });
export function setPlayerVote(parliament, lawId, choice) {
  if (!PLAYER_VOTE_CHOICES[choice]) throw new Error('Scelta di voto non valida.');
  const law = openLawIn(parliament, lawId);
  if (!['commission', 'amendments', 'final-vote'].includes(law.stage)) throw new Error('Il voto in Aula arriva dopo l’esame in commissione.');
  return replaceLaw(parliament, lawId, current => ({ ...current, pendingPlayerVote: choice }));
}

// ---------- saves stay light ----------
// Bills closed long ago leave the list and keep only their outcome in the archive; the calendar entries of the other
// actors keep the most recent ones (the player's own history is never pruned).
export function compactLegislature(parliament) {
  const laws = parliament.laws ?? [];
  const closed = laws.filter(law => law.auto && CLOSED.includes(law.stage)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const drop = new Set(closed.slice(LEGISLATIVE_RULES.keepClosed).map(law => law.id));
  const autoEntries = (parliament.history ?? []).filter(entry => entry.details?.auto);
  const staleEntries = new Set(autoEntries.slice(0, Math.max(0, autoEntries.length - LEGISLATIVE_RULES.autoHistory)).map(entry => entry.id));
  if (!drop.size && !staleEntries.size) return parliament;
  const archived = laws.filter(law => drop.has(law.id)).map(law => ({ id: law.id, title: law.title, kind: law.kind, area: law.policy?.area ?? null, sponsor: { kind: law.sponsor?.kind ?? null, label: law.sponsor?.label ?? null }, stage: law.stage, status: law.status, introducedAt: law.introducedAt, closedAt: law.updatedAt, votes: (law.votes ?? []).map(vote => ({ chamber: vote.chamber, date: vote.date ?? null, yes: vote.yes, needed: vote.needed, passed: vote.passed, playerChoice: vote.playerChoice ?? null, playerLine: vote.playerLine ?? null })), source: SIM }));
  return { ...parliament, laws: laws.filter(law => !drop.has(law.id)), lawArchive: [...archived, ...(parliament.lawArchive ?? [])].slice(0, LEGISLATIVE_RULES.archive), history: (parliament.history ?? []).filter(entry => !staleEntries.has(entry.id)) };
}

// ---------- one week of the Chambers ----------
// ctx: { date, rand, world, society }. Returns { parliament, events, lines }: the events are for the career (the
// player's votes, the bills coming to the floor of the player's Chamber).
export function advanceLegislativeWeek(input, ctx) {
  if (!input?.chambers?.camera?.groups?.length || !input?.chambers?.senato?.groups?.length) return { parliament: input, events: [], lines: [] };
  let parliament = syncAgendas(linkGroupsToParties(input, ctx.world), ctx.world);
  const events = [];
  const lines = [];
  const generated = generateBills(parliament, ctx);
  parliament = generated.parliament;
  for (const law of generated.created.slice(0, 2)) lines.push(`${law.sponsor.label} presenta “${law.title}”.`);
  // During a crisis, and until a new Government has the confidence, the Chambers vote only decrees and the budget.
  const paused = Boolean(parliament.government) && !['active'].includes(parliament.government.status);
  for (const law of openAuto(parliament).filter(item => item.nextStepAt && item.nextStepAt <= ctx.date).sort((a, b) => a.nextStepAt.localeCompare(b.nextStepAt))) {
    const current = parliament.laws.find(item => item.id === law.id);
    if (!current || CLOSED.includes(current.stage)) continue;
    if (paused && current.kind === 'ddl' && ['amendments', 'final-vote'].includes(current.stage)) {
      parliament = replaceLaw(parliament, current.id, item => note({ ...item, nextStepAt: addDays(ctx.date, 7) }, ctx.date, item.pausedAt ? '' : 'Voto rinviato: il governo non ha la fiducia delle Camere.'));
      parliament = replaceLaw(parliament, current.id, item => ({ ...item, pausedAt: item.pausedAt ?? ctx.date }));
      continue;
    }
    const out = stepLaw(parliament, current, ctx);
    parliament = out.parliament;
    events.push(...out.events);
  }
  // Bills of the player's Chamber that come to the floor within the week: the player is asked how to vote.
  const seat = parliament.player;
  if (seat?.groupId) {
    for (const law of openAuto(parliament).filter(item => ['amendments', 'final-vote'].includes(item.stage) && item.currentChamber === seat.chamber && item.nextStepAt && item.nextStepAt <= addDays(ctx.date, 7) && item.askedFor !== `${item.stage}|${item.currentChamber}`)) {
      const forecast = forecastVote(parliament, law, { world: ctx.world });
      const line = forecast.positions.find(item => item.groupId === seat.groupId)?.line ?? 'astenuto';
      parliament = replaceLaw(parliament, law.id, current => ({ ...current, askedFor: `${law.stage}|${law.currentChamber}` }));
      events.push({ type: 'voto-in-arrivo', lawId: law.id, title: law.title, sponsor: law.sponsor, kind: law.kind, line, decided: Boolean(law.pendingPlayerVote), margin: forecast.margin, yes: forecast.yes, needed: forecast.needed, confidence: Boolean(law.confidence), date: law.nextStepAt, finalVote: law.stage === 'final-vote', important: law.sponsor?.kind === 'governo' || law.kind !== 'ddl' || law.confidence || Math.abs(forecast.margin) <= 6 || Boolean(law.playerStance || law.playerDeal || law.playerAmendments?.length) || law.sponsor?.groupId === seat.groupId });
    }
  }
  return { parliament: compactLegislature(parliament), events, lines };
}
