// Territorial committees of the player's party: Region → Province or metropolitan city → Comune. The geography is
// ISTAT's (names and codes of the real territorial units and comuni); members, leaders, activists, strength and states
// are a simulation of the game and never describe the real organisation of a real party.
import { treasuryBook } from './organization-engine.js?v=20261003-1';
import { COMMITTEE_RULES, LOCAL_ACTIONS, LOCAL_EVENT_RULES, PARTY_SCALES, SEAT_LEVEL_FACTOR, SEAT_TIERS, scaleOf } from '../data/simulation/committee-rules.js?v=20261003-1';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const slug = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const COMMITTEE_STATES = Object.freeze({
  fondazione: { label: 'Fondazione', tone: 'neutral', detail: 'Appena nato: pochi iscritti, una sede provvisoria, tutto da costruire.' },
  crescita: { label: 'Crescita', tone: 'good', detail: 'Nuovi iscritti e iniziative: il comitato si fa conoscere.' },
  consolidamento: { label: 'Consolidamento', tone: 'good', detail: 'Struttura stabile, volontari affidabili, peso nelle scelte locali.' },
  crisi: { label: 'Crisi', tone: 'warn', detail: 'Iscritti in calo, divisioni o poca attività: rischia di sgretolarsi.' },
  'perdita-controllo': { label: 'Perdita del controllo', tone: 'bad', detail: 'Il comitato risponde a un’altra area del partito: non lavora per te.' },
  dissoluzione: { label: 'Dissoluzione', tone: 'bad', detail: 'Il comitato si è sciolto: si può rifondare.' }
});
export const COMMITTEE_LEVELS = Object.freeze({
  regione: { label: 'Comitato regionale', short: 'Regione', leader: 'Coordinamento regionale' },
  provincia: { label: 'Comitato provinciale', short: 'Provincia', leader: 'Coordinamento provinciale' },
  comune: { label: 'Comitato comunale', short: 'Comune', leader: 'Coordinamento comunale' }
});
// What the player can do: every action costs time, capital or money and is checked again by the engine.
export const COMMITTEE_ACTIONS = Object.freeze({
  fonda: { label: 'Fonda il comitato', cost: { ap: 1, funds: 400 }, detail: 'Una sede, i primi iscritti: parte dalla fondazione.' },
  rilancia: { label: 'Visita e rilancia', cost: { ap: 1 }, detail: 'Assemblea con gli iscritti: organizzazione e volontari salgono, la fedeltà a te cresce.' },
  responsabile: { label: 'Cambia il responsabile', cost: { ap: 1, capital: 2 }, detail: 'Un nome vicino a te: fedeltà alta, ma l’area del responsabile uscente protesta.' },
  finanzia: { label: 'Finanzia le attività', cost: { funds: 800 }, detail: 'Otto settimane di iniziative pagate da te: l’organizzazione cresce.' },
  mobilita: { label: 'Mobilita i volontari', cost: { ap: 1, capital: 1 }, detail: 'Volontari in strada per quattro settimane: più presenza ora, un po’ di stanchezza dopo.' },
  commissaria: { label: 'Commissaria il comitato', cost: { capital: 3 }, detail: 'Solo chi guida il partito: riprendi il controllo, ma la coesione cala.' },
  ...LOCAL_ACTIONS
});
export { SEAT_TIERS, PARTY_SCALES, scaleOf };
// The price of an action on a given committee: the seat costs more the higher the level and the better the seat.
export function committeeActionCost(committee, actionId) {
  const spec = COMMITTEE_ACTIONS[actionId];
  if (actionId !== 'sede' || !committee) return spec.cost;
  const next = SEAT_TIERS[Math.min(SEAT_TIERS.length - 1, (committee.seat ?? 0) + 1)];
  return { ...spec.cost, funds: Math.round(next.price * (SEAT_LEVEL_FACTOR[committee.level] ?? 1)) };
}

// Everything a committee has beyond the first version of the engine, given to older ones when they are met again:
// the quality of the volunteers, fatigue, the rhythm of local activity, autonomy, a seat and what it has raised.
function initialSeat(committee) {
  const base = committee.organization >= 60 ? 2 : committee.organization >= 30 ? 1 : 0;
  return committee.level === 'regione' ? Math.max(2, base) : base;
}
export function ensureStructure(committee) {
  if (!Number.isFinite(committee.quality)) committee.quality = 50;
  if (!Number.isFinite(committee.fatigue)) committee.fatigue = 0;
  if (!Number.isFinite(committee.activity)) committee.activity = Math.round(clamp(committee.organization * 0.6));
  if (!Number.isFinite(committee.autonomy)) committee.autonomy = committee.leader?.player ? 15 : Math.round(clamp(100 - committee.loyalty * 0.6));
  if (!Number.isFinite(committee.seat)) committee.seat = initialSeat(committee);
  if (!Number.isFinite(committee.raised)) committee.raised = 0;
  if (!Array.isArray(committee.membersLog)) committee.membersLog = [];
  if (!Number.isFinite(committee.trend)) committee.trend = 0;
  if (!Number.isFinite(committee.autonomyBias)) committee.autonomyBias = 0;
  return committee;
}
// How the committee stands: strong, solid, weak or fragile, and where it is heading.
export function committeeProfile(committee) {
  const strength = committeeStrength(committee);
  const tier = COMMITTEE_RULES.tiers.find(([, from]) => strength >= from)?.[0] ?? 'fragile';
  const trend = committee.trend ?? 0;
  return { tier, strength, trend: trend >= 1.5 ? 'crescita' : trend <= -1.5 ? 'declino' : 'stabile', change: trend };
}

export function committeeStrength(committee) {
  if (!committee || committee.status === 'dissoluzione') return 0;
  const activeShare = committee.members ? Math.min(100, committee.activists / committee.members * 400 * (0.75 + (committee.quality ?? 50) / 200)) : 0;
  return Math.round(clamp(committee.organization * 0.45 + activeShare * 0.15 + committee.consensus * 0.2 + committee.loyalty * 0.2));
}
const initialStatus = organization => organization >= 62 ? 'consolidamento' : organization >= 35 ? 'crescita' : organization >= 22 ? 'crisi' : 'fondazione';
const leaderFor = (level, currents, rand, player = false) => {
  if (player) return { label: 'Tu', currentId: null, player: true };
  const current = currents.length ? currents[Math.floor(rand() * currents.length)] : null;
  return { label: `${COMMITTEE_LEVELS[level].leader} (figura simulata)`, currentId: current?.id ?? null, player: false };
};
function makeCommittee({ level, name, region, parentId = null, members, organization, loyalty, rand, week, currents, leadByPlayer = false, extra = {} }) {
  const committee = {
    id: `comitato-${level}-${slug(extra.unitCode ?? extra.municipalityCode ?? name)}-${slug(region)}`, level, name, region, parentId, ...extra,
    status: initialStatus(organization), statusSince: week, foundedWeek: week,
    members: Math.max(5, Math.round(members)), activists: Math.max(1, Math.round(members * (0.05 + organization / 1200))),
    organization: Math.round(clamp(organization)), consensus: 50, loyalty: Math.round(clamp(leadByPlayer ? 85 : loyalty)),
    leader: leaderFor(level, currents, rand, leadByPlayer), fundedUntil: null, mobilizedUntil: null, lastVisitWeek: null, history: [], source: SIM
  };
  return ensureStructure(committee);
}
const log = (committee, week, text) => { committee.history = [{ week, text, source: SIM }, ...(committee.history ?? [])].slice(0, 8); };

// The committees of a party: the regional ones mirror the federations (sections) of the organisation; the provincial
// ones cover the units of the player's region; the comunale one is the player's comune. Built once, then kept.
export function createCommittees(org, { region, units = [], home = {}, currents = [], rank = 0, founder = false, week = 1, rand = Math.random } = {}) {
  if (!org) return [];
  // The ISTAT unit of the player's comune; older careers without it use the unit named after the comune (its capital).
  home = { ...home, provinceCode: home.provinceCode ?? units.find(unit => unit.gameRegion === region && unit.name === home.municipality)?.code ?? null };
  home.provinceName = home.provinceName ?? units.find(unit => unit.code === home.provinceCode)?.name ?? null;
  const committees = [];
  const regionalOf = new Map();
  for (const section of org.sections ?? []) {
    const regional = makeCommittee({ level: 'regione', name: section.region, region: section.region, members: section.members, organization: section.vitality, loyalty: 45 + rand() * 20, rand, week, currents, leadByPlayer: section.region === region && (founder || rank >= 2) });
    committees.push(regional);
    regionalOf.set(section.region, regional);
  }
  const parent = regionalOf.get(region);
  const provinces = units.filter(unit => unit.gameRegion === region);
  const weight = provinces.reduce((sum, unit) => sum + (unit.municipalities ?? 1), 0) || 1;
  for (const unit of provinces) {
    const homeUnit = unit.code === home.provinceCode;
    // A young party has committees only where it started; an established one has them in every province of the region.
    if (founder && !homeUnit) continue;
    const share = (unit.municipalities ?? 1) / weight;
    const organization = (parent?.organization ?? 45) + (rand() - 0.5) * 24 + (homeUnit ? 6 : 0);
    committees.push(makeCommittee({ level: 'provincia', name: unit.name, region, parentId: parent?.id ?? null, members: (parent?.members ?? 60) * share * 0.9, organization, loyalty: 42 + rand() * 22, rand, week, currents, leadByPlayer: homeUnit && founder, extra: { unitCode: unit.code, unitType: unit.type, sigla: unit.sigla ?? null } }));
  }
  if (home.municipality) {
    const province = committees.find(item => item.level === 'provincia' && item.unitCode === home.provinceCode) ?? parent;
    const organization = (province?.organization ?? 45) + (rand() - 0.4) * 16;
    committees.push(makeCommittee({ level: 'comune', name: home.municipality, region, parentId: province?.id ?? null, members: Math.max(12, (province?.members ?? 40) * 0.12), organization, loyalty: 55 + rand() * 15, rand, week, currents, leadByPlayer: founder || rank >= 1, extra: { municipalityCode: home.municipalityCode ?? null, unitCode: home.provinceCode ?? null } }));
  }
  return committees;
}

// Founding a committee where there is none (or refounding a dissolved one).
export function foundCommittee(org, { level, name, region, parentId = null, week, currents = [], rand = Math.random, extra = {} }) {
  org.committees = org.committees ?? [];
  const existing = org.committees.find(item => item.level === level && item.name === name && item.region === region);
  if (existing && existing.status !== 'dissoluzione') throw new Error(`Esiste già il comitato di ${name}.`);
  const committee = makeCommittee({ level, name, region, parentId, members: level === 'comune' ? 10 : 18, organization: 24, loyalty: 72, rand, week, currents, leadByPlayer: false, extra });
  committee.status = 'fondazione';
  committee.leader = { label: `${COMMITTEE_LEVELS[level].leader} (figura simulata, vicina a te)`, currentId: null, player: false };
  log(committee, week, existing ? 'Rifondato dopo lo scioglimento' : 'Fondato');
  if (existing) Object.assign(existing, committee, { id: existing.id, history: [...committee.history, ...(existing.history ?? [])].slice(0, 8) });
  else org.committees.push(committee);
  return existing ?? committee;
}

// What a committee raises in a week before sharing it: the members and the volunteers (by their quality) in the measure of
// local consensus and activity, scaled by the kind of party.
function fundraising(committee, scale) {
  const gross = (committee.members * 0.05 + committee.activists * 1.2 * (committee.quality ?? 50) / 60) * (0.55 + committee.consensus / 110) * (0.5 + (committee.activity ?? 40) / 100);
  return gross * COMMITTEE_RULES.fundraisingRate * (scale?.fundraising ?? 1);
}
// The player's actions on a committee (costs are paid by the career engine).
export function applyCommitteeAction(org, committee, actionId, { week, rand = Math.random, currents = [], leader = false, scale: scaleId = 'regionale' } = {}) {
  const lines = [];
  const scale = PARTY_SCALES[scaleId] ?? PARTY_SCALES.regionale;
  if (committee.status === 'dissoluzione' && actionId !== 'fonda') throw new Error('Il comitato si è sciolto: va rifondato.');
  if (actionId === 'rilancia') {
    if (committee.lastVisitWeek !== null && week - committee.lastVisitWeek < 2) throw new Error('Ci sei stato da poco: torna tra qualche settimana.');
    committee.organization = Math.round(clamp(committee.organization + 7 + rand() * 4));
    committee.activists = Math.round(committee.activists * 1.12 + 2);
    committee.loyalty = Math.round(clamp(committee.loyalty + 5));
    committee.lastVisitWeek = week;
    lines.push(`${committee.name}: organizzazione ${committee.organization}, volontari ${committee.activists}`);
  } else if (actionId === 'responsabile') {
    if (committee.leader?.player) throw new Error('Guidi tu questo comitato.');
    const outgoing = currents.find(item => item.id === committee.leader?.currentId) ?? null;
    committee.leader = { label: `${COMMITTEE_LEVELS[committee.level].leader} (figura simulata, vicina a te)`, currentId: null, player: false };
    committee.loyalty = Math.round(clamp(Math.max(committee.loyalty, 70) + 6));
    committee.organization = Math.round(clamp(committee.organization - 3));
    lines.push(`${committee.name}: nuovo responsabile, fedeltà ${committee.loyalty}`);
    if (outgoing) { outgoing.value = Math.round(clamp((outgoing.value ?? outgoing.relation ?? 50) - 4)); lines.push(`${outgoing.label} non gradisce il cambio (rapporto −4)`); }
  } else if (actionId === 'finanzia') {
    committee.fundedUntil = week + 8;
    committee.organization = Math.round(clamp(committee.organization + 3));
    lines.push(`${committee.name}: attività finanziate fino alla settimana ${week + 8}`);
  } else if (actionId === 'mobilita') {
    committee.mobilizedUntil = week + 4;
    committee.activists = Math.round(committee.activists * 1.35 + 3);
    lines.push(`${committee.name}: ${committee.activists} volontari mobilitati`);
  } else if (actionId === 'recluta') {
    ensureStructure(committee);
    if (committee.recruitUntil && committee.recruitUntil >= week) throw new Error('La campagna di tesseramento è già in corso.');
    committee.recruitUntil = week + 6;
    const added = Math.max(4, Math.round(committee.members * 0.03 * scale.recruit));
    committee.members += added;
    committee.quality = Math.round(clamp(committee.quality - 2));
    committee.fatigue = Math.round(clamp(committee.fatigue + 4));
    committee.activity = Math.round(clamp(committee.activity + 6));
    lines.push(`${committee.name}: +${added} iscritti, tesseramento aperto fino alla settimana ${committee.recruitUntil}`);
  } else if (actionId === 'iniziativa') {
    ensureStructure(committee);
    if (week - (committee.lastInitiativeWeek ?? -99) < 3) throw new Error('Un’iniziativa c’è già stata da poco: aspetta qualche settimana.');
    committee.lastInitiativeWeek = week;
    const chance = clamp(0.45 + committee.quality / 200 + committee.organization / 300 + (committee.seat >= 1 ? 0.05 : 0) - committee.fatigue / 300, 0.2, 0.9);
    if (rand() < chance) {
      committee.activity = Math.round(clamp(committee.activity + 22)); committee.consensus = Math.round(clamp(committee.consensus + 3)); committee.organization = Math.round(clamp(committee.organization + 2));
      lines.push(`${committee.name}: iniziativa riuscita, attività ${committee.activity}, consenso locale ${committee.consensus}`);
    } else {
      committee.activity = Math.round(clamp(committee.activity + 8)); committee.consensus = Math.round(clamp(committee.consensus - 1)); committee.fatigue = Math.round(clamp(committee.fatigue + 6));
      lines.push(`${committee.name}: iniziativa tiepida, volontari stanchi (${committee.fatigue})`);
    }
  } else if (actionId === 'forma') {
    ensureStructure(committee);
    if (week - (committee.trainedWeek ?? -99) < 6) throw new Error('I volontari sono stati formati da poco.');
    committee.trainedWeek = week;
    committee.quality = Math.round(clamp(committee.quality + 10));
    committee.fatigue = Math.round(clamp(committee.fatigue - 10));
    committee.activity = Math.round(clamp(committee.activity + 3));
    lines.push(`${committee.name}: qualità dei volontari ${committee.quality}, stanchezza ${committee.fatigue}`);
  } else if (actionId === 'raccolta') {
    ensureStructure(committee);
    if (week - (committee.lastFundraiserWeek ?? -99) < 4) throw new Error('Una raccolta fondi c’è già stata da poco.');
    committee.lastFundraiserWeek = week;
    const gross = fundraising(committee, scale) * 6;
    const amount = Math.round(gross * (committee.seat >= 1 ? 1 : 0.7));
    committee.raised = (committee.raised ?? 0) + amount;
    if (org.treasury) treasuryBook(org, amount, 'donazioni', `Cena di raccolta fondi: ${committee.name}`);
    committee.fatigue = Math.round(clamp(committee.fatigue + 8)); committee.activity = Math.round(clamp(committee.activity + 5));
    lines.push(`${committee.name}: raccolti ${amount.toLocaleString('it-IT')} € per la tesoreria del partito`);
  } else if (actionId === 'sede') {
    ensureStructure(committee);
    if (committee.seat >= SEAT_TIERS.length - 1) throw new Error('La sede è già di proprietà.');
    committee.seat += 1; committee.seatSince = week;
    committee.organization = Math.round(clamp(committee.organization + 2));
    lines.push(`${committee.name}: ${SEAT_TIERS[committee.seat].label.toLowerCase()}`);
  } else if (actionId === 'delega') {
    ensureStructure(committee);
    if (!leader) throw new Error('Solo chi guida il partito può concedere autonomia.');
    if (committee.leader?.player) throw new Error('Guidi tu questo comitato.');
    committee.autonomyBias = Math.min(40, (committee.autonomyBias ?? 0) + 18);
    committee.autonomy = Math.round(clamp(committee.autonomy + 18));
    committee.loyalty = Math.round(clamp(committee.loyalty + 5)); committee.organization = Math.round(clamp(committee.organization + 2));
    lines.push(`${committee.name}: più autonomia (${committee.autonomy}), fedeltà ${committee.loyalty}`);
  } else if (actionId === 'commissaria') {
    if (!leader) throw new Error('Solo chi guida il partito può commissariare un comitato.');
    if (!['crisi', 'perdita-controllo'].includes(committee.status)) throw new Error('Si commissaria solo un comitato in crisi o fuori controllo.');
    committee.leader = { label: 'Commissario (figura simulata nominata da te)', currentId: null, player: false };
    committee.loyalty = 78;
    committee.organization = Math.round(clamp(committee.organization + 4));
    ensureStructure(committee);
    committee.autonomyBias = Math.max(-40, (committee.autonomyBias ?? 0) - 25);
    committee.autonomy = Math.round(clamp(committee.autonomy - 25));
    setStatus(committee, 'crisi', week, 'Commissariato: il controllo torna alla segreteria');
    org.cohesion = Math.round(clamp((org.cohesion ?? 55) - 3));
    lines.push(`${committee.name} commissariato: coesione del partito −3`);
  } else throw new Error('Azione non disponibile.');
  log(committee, week, COMMITTEE_ACTIONS[actionId].label);
  return lines;
}
function setStatus(committee, status, week, reason) {
  if (committee.status === status) return false;
  committee.status = status;
  committee.statusSince = week;
  log(committee, week, `${COMMITTEE_STATES[status].label}: ${reason}`);
  return true;
}

// One week of territorial life: organisation, members, volunteers (and their quality), activity, seats and their cost,
// local fundraising, autonomy, local consensus, loyalty and state. Nothing grows by itself: recruiting follows activity,
// organisation and consensus, and a committee that is not worked on loses people, volunteers and its seat.
export function advanceCommittees(org, { rand = Math.random, week, regionalShares = {}, nationalShare = null, currents = [], campaignActive = false, founder = false, line = null, preferredLines = {}, homeRegion = null, ownPerks = {} } = {}) {
  const lines = [];
  const events = [];
  const byId = new Map((org.committees ?? []).map(item => [item.id, item]));
  const sections = new Map((org.sections ?? []).map(item => [item.region, item]));
  const growth = (org.growth ?? 0) / 100;
  const scaleId = scaleOf({ nationalShare, founder });
  const scale = PARTY_SCALES[scaleId];
  const partyPerks = org.perks ?? {};
  const broke = (org.treasury?.balance ?? 0) < 0;
  let upkeep = 0, raised = 0, closed = 0;
  for (const committee of org.committees ?? []) {
    if (committee.status === 'dissoluzione') continue;
    ensureStructure(committee);
    const parent = committee.parentId ? byId.get(committee.parentId) : null;
    const section = committee.level === 'regione' ? sections.get(committee.region) : null;
    if (committee.level === 'regione' && !section) { setStatus(committee, 'dissoluzione', week, 'la federazione regionale ha chiuso'); committee.members = 0; committee.activists = 0; lines.push(`Si scioglie il comitato regionale ${committee.name}`); continue; }
    const current = currents.find(item => item.id === committee.leader?.currentId);
    const funded = committee.fundedUntil && committee.fundedUntil >= week;
    const mobilized = committee.mobilizedUntil && committee.mobilizedUntil >= week;
    const recruiting = committee.recruitUntil && committee.recruitUntil >= week;
    const visited = committee.lastVisitWeek !== null && week - committee.lastVisitWeek <= 4;
    const trouble = ['crisi', 'perdita-controllo'].includes(committee.status);
    const capacity = SEAT_TIERS[clamp(committee.seat, 0, SEAT_TIERS.length - 1)].capacity;
    // The party's programmes work everywhere; the player's own programmes (training, digital) in the committees the player leads.
    const perks = committee.leader?.player ? { ...partyPerks, quality: (partyPerks.quality ?? 0) + (ownPerks.quality ?? 0), recruit: (partyPerks.recruit ?? 0) + (ownPerks.recruit ?? 0) } : partyPerks;
    // Organisation: the federation (for the regions), the upper committee, money, visits, the seat, cohesion and the treasury.
    const base = section ? section.vitality : 48 + (parent ? (parent.organization - 50) * 0.35 : 0);
    const target = base + ((org.priorities?.territorio ?? 1) - 1) * 6 + (funded ? 12 : 0) + (visited ? 6 : 0) + capacity * 0.4 + (perks.organization ?? 0) + (committee.activity - 40) * 0.06 - (org.treasury?.balance < 0 ? 8 : 0) - ((org.cohesion ?? 55) < 40 ? 6 : 0) - (committee.loyalty < 30 ? 5 : 0) - (committee.status === 'perdita-controllo' ? 8 : committee.status === 'crisi' ? 3 : 0) - (committee.mobilizedUntil && !mobilized && week - committee.mobilizedUntil <= 3 ? 4 : 0);
    committee.organization = Math.round(clamp(committee.organization + (target - committee.organization) * 0.07 + (rand() - 0.5) * 4));
    // Activity fades unless it is fed: money, the seat, the volunteers on the streets, a visit, a campaign.
    committee.activity = round1(clamp(committee.activity * 0.9 + committee.organization * 0.04 + (funded ? 3 : 0) + (mobilized ? 4 : 0) + (visited ? 1.5 : 0) + (campaignActive ? 3 : 0) + (capacity ? 1 + capacity * 0.15 : 0) + (perks.activity ?? 0) * 0.1 + (rand() - 0.5) * 2 - (broke ? 3 : 0)));
    committee.fatigue = round1(clamp(committee.fatigue + (mobilized ? 4 : 0) + (recruiting ? 1.5 : 0) + (campaignActive ? 1 : 0) + (committee.activity > 70 ? 1.5 : 0) - (mobilized || recruiting ? 0.5 : 2.5)));
    const qualityTarget = 40 + ((org.priorities?.formazione ?? 1) - 1) * 6 + (perks.quality ?? 0) + (visited ? 2 : 0) - (committee.fatigue > 60 ? 6 : 0) - (trouble ? 6 : 0);
    committee.quality = round1(clamp(committee.quality + (qualityTarget - committee.quality) * 0.04 - (committee.fatigue > COMMITTEE_RULES.fatigueLimit ? 0.8 : 0)));
    // Members: the federation's for the regions; for the others recruiting against what is lost.
    const drain = (committee.status === 'crisi' ? 0.004 : 0) + (committee.status === 'perdita-controllo' ? 0.008 : 0) + (committee.loyalty < 30 ? 0.002 : 0) + (committee.fatigue > 70 ? 0.0015 : 0) + (committee.seat === 0 ? 0.001 : 0);
    const pull = (committee.activity - 40) / 12000 + (recruiting ? 0.004 * scale.recruit : 0) + (campaignActive ? 0.0008 : 0) + (perks.recruit ?? 0);
    committee.members = section ? section.members : Math.max(3, Math.round(committee.members * (1 + growth + (committee.organization - 50) / 6000 + pull - drain)));
    const activistsTarget = committee.members * (0.05 + committee.organization / 1200 + (mobilized ? 0.08 : 0) + (campaignActive ? 0.02 : 0) + capacity * 0.002 - committee.fatigue / 3000) * (0.85 + committee.quality / 330);
    committee.activists = Math.max(0, Math.round(committee.activists + (activistsTarget - committee.activists) * 0.15));
    // Local consensus (index 0–100, 50 = in line with the party's national average): where the party polls better and
    // where the committee works well.
    const offset = regionalShares[committee.region] !== undefined && nationalShare !== null ? regionalShares[committee.region] - nationalShare : 0;
    committee.consensus = Math.round(clamp(committee.consensus + (50 + offset * 8 + (committee.organization - 50) * 0.3 + (committee.activity - 40) * 0.08 - committee.consensus) * 0.1));
    // Loyalty follows the leader: the player's people stay loyal, others follow their area's relation with the player.
    const loyaltyTarget = committee.leader?.player ? 85 : current ? (current.value ?? current.relation ?? 50) : 55;
    committee.loyalty = Math.round(clamp(committee.loyalty + (loyaltyTarget - committee.loyalty) * 0.05 + (rand() - 0.5) * 2));
    // Autonomy from the national line: higher in a local party, where the committee is far from the centre, rich and
    // well housed; a commissioner or the player's own leadership pulls it back.
    committee.autonomyBias = Math.abs(committee.autonomyBias) < 0.5 ? 0 : committee.autonomyBias * 0.97;
    const autonomyTarget = scale.autonomy + (100 - committee.loyalty) * 0.3 + (committee.organization - 50) * 0.12 + (committee.seat >= 2 ? 5 : 0) + (committee.leader?.player ? -30 : 0) + committee.autonomyBias;
    committee.autonomy = round1(clamp(committee.autonomy + (autonomyTarget - committee.autonomy) * 0.05));
    // A committee with a mind of its own against the party's line: a local clash that the whole party feels.
    const preferred = current ? preferredLines[current.id] : null;
    if (line && preferred && preferred !== line && committee.autonomy >= 65 && !committee.leader?.player && (org.conflicts?.length ?? 0) < 3 && rand() < 0.04) {
      org.conflicts = [...(org.conflicts ?? []), { id: `conflitto-${week}-${committee.id}`, title: `Il comitato di ${committee.name} non segue la linea del partito`, currents: [current.id], committee: committee.id, intensity: Math.round(36 + rand() * 14), since: week, source: SIM }];
      committee.loyalty = Math.round(clamp(committee.loyalty - 2));
      log(committee, week, 'Scontro con la linea nazionale');
      lines.push(`${committee.name}: il comitato si distanzia dalla linea del partito`);
    }
    // The seat costs every week; without money it closes. The regional seats are the federations' (in the sections' cost).
    if (committee.level !== 'regione' && committee.seat > 0) {
      upkeep += Math.round(SEAT_TIERS[committee.seat].upkeep * SEAT_LEVEL_FACTOR[committee.level] * scale.upkeep * (1 + (perks.upkeep ?? 0)));
      if (broke && rand() < 0.06 + (trouble ? 0.04 : 0)) { committee.seat -= 1; committee.seatSince = week; closed += 1; log(committee, week, 'Chiude la sede: mancano i fondi'); lines.push(`${committee.name}: senza fondi il comitato perde la sede`); }
    }
    // Local fundraising reaches the party's treasury, less what an autonomous committee keeps.
    const gross = fundraising(committee, scale) * (1 + (perks.fundraising ?? 0));
    const kept = COMMITTEE_RULES.autonomyKeep * committee.autonomy / 100;
    raised += gross * (1 - kept) * (committee.leader?.player ? 1 : 0.5 + committee.loyalty / 200);
    committee.raised = Math.round((committee.raised ?? 0) + gross);
    // State, with a minimum permanence so that committees do not flicker.
    const settled = week - (committee.statusSince ?? 0) >= 3;
    const before = committee.status;
    if (settled) {
      if (committee.status === 'fondazione' && committee.organization >= 35) setStatus(committee, 'crescita', week, 'i primi risultati arrivano');
      else if (committee.status === 'fondazione' && committee.organization < 14 && week - committee.foundedWeek >= 8) setStatus(committee, 'dissoluzione', week, 'non è mai decollato');
      else if (committee.status === 'crescita' && committee.organization >= 62) setStatus(committee, 'consolidamento', week, 'struttura stabile e volontari affidabili');
      else if (['crescita', 'consolidamento'].includes(committee.status) && committee.organization < (committee.status === 'crescita' ? 32 : 45)) setStatus(committee, 'crisi', week, 'iscritti e attività in calo');
      else if (committee.status === 'crisi' && committee.loyalty < 25 && !committee.leader?.player) setStatus(committee, 'perdita-controllo', week, `${current?.label ?? 'un’altra area'} prende il comitato`);
      else if (committee.status === 'crisi' && committee.organization < 16 && rand() < 0.35) setStatus(committee, 'dissoluzione', week, 'gli ultimi iscritti se ne vanno');
      else if (committee.status === 'crisi' && committee.organization >= 48) setStatus(committee, 'crescita', week, 'il comitato si riprende');
      else if (committee.status === 'perdita-controllo' && committee.loyalty >= 45) setStatus(committee, 'crisi', week, 'torna a lavorare con te');
      else if (committee.status === 'perdita-controllo' && committee.organization < 14) setStatus(committee, 'dissoluzione', week, 'scontro finale, il comitato si scioglie');
    }
    if (committee.status === 'dissoluzione') { committee.members = 0; committee.activists = 0; committee.activity = 0; committee.fatigue = 0; }
    if (before !== committee.status) {
      lines.push(`${COMMITTEE_LEVELS[committee.level].label} di ${committee.name}: ${COMMITTEE_STATES[committee.status].label.toLowerCase()}`);
      // A crisis costs people: members, volunteers and local consensus leave with the best ones.
      if (committee.status === 'crisi' || committee.status === 'perdita-controllo') {
        const lost = committee.status === 'crisi' ? 0.03 : 0.06;
        if (!section) committee.members = Math.max(3, Math.round(committee.members * (1 - lost)));
        committee.activists = Math.round(committee.activists * (1 - lost * 4));
        committee.consensus = Math.round(clamp(committee.consensus - (committee.status === 'crisi' ? 3 : 5)));
        log(committee, week, 'Se ne vanno iscritti e volontari');
      }
      if (['crisi', 'perdita-controllo', 'dissoluzione'].includes(committee.status)) events.push({ type: 'committee', committee: committee.id, status: committee.status, name: committee.name, level: committee.level });
    }
    // Trend over the last weeks.
    committee.membersLog = [...(committee.membersLog ?? []), committee.members].slice(-(COMMITTEE_RULES.trendWindow + 1));
    const first = committee.membersLog[0];
    committee.trend = first ? round1((committee.members - first) / first * 100) : 0;
  }
  // The money of the week: the seats of the committees out, the local fundraising in.
  upkeep = Math.round(upkeep); raised = Math.round(raised);
  if (org.treasury && upkeep) treasuryBook(org, -upkeep, 'sedi', 'Sedi dei comitati');
  if (org.treasury && raised) treasuryBook(org, raised, 'donazioni', 'Raccolta fondi dei comitati');
  org.territory = { week, upkeep, raised, closed, scale: scaleId, source: SIM };
  // A local event in the player's own territory: an opportunity, a scandal or a competitor, a few times a year.
  if (homeRegion && rand() < LOCAL_EVENT_RULES.weeklyChance) {
    const pool = (org.committees ?? []).filter(item => item.region === homeRegion && item.status !== 'dissoluzione' && item.level !== 'regione' && week - (item.lastLocalEventWeek ?? -99) >= LOCAL_EVENT_RULES.cooldownWeeks);
    if (pool.length) {
      const committee = pool[Math.floor(rand() * pool.length)];
      const weights = { opportunita: 1 + Math.max(0, committee.activity - 40) / 40 + Math.max(0, committee.consensus - 50) / 50, scandalo: committee.leader?.player ? 0 : 0.6 + Math.max(0, committee.autonomy - 50) / 50 + Math.max(0, 50 - committee.loyalty) / 50, concorrenza: 0.7 + (committeeStrength(committee) >= 55 ? 0.5 : 0) };
      const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
      let pick = rand() * total;
      const kind = Object.keys(weights).find(key => (pick -= weights[key]) < 0) ?? 'opportunita';
      committee.lastLocalEventWeek = week;
      events.push({ type: 'local', kind, committee: committee.id, name: committee.name, level: committee.level });
    }
  }
  return { lines, events };
}

// The committees that count for a vote, and what they bring to the candidacy and the campaign.
export function committeeSupport(org, { electionType, region, provinceCode = null, municipality = null, week = 0 } = {}) {
  const active = (org?.committees ?? []).filter(item => item.status !== 'dissoluzione');
  const regional = active.find(item => item.level === 'regione' && item.region === region) ?? null;
  const comune = active.find(item => item.level === 'comune' && item.region === region && item.name === municipality) ?? null;
  const unit = provinceCode ?? comune?.unitCode ?? null;
  const province = active.find(item => item.level === 'provincia' && item.region === region && item.unitCode === unit) ?? null;
  const provinces = active.filter(item => item.level === 'provincia' && item.region === region);
  const weighted = electionType === 'comunale' ? [[comune, 0.6], [province, 0.4]]
    : electionType === 'regionale' ? [[regional, 0.5], ...provinces.map(item => [item, 0.5 / Math.max(1, provinces.length)])]
    : [[regional, 0.6], [province, 0.4]];
  const used = weighted.filter(([item]) => item);
  const weight = used.reduce((sum, [, value]) => sum + value, 0);
  const strength = weight ? Math.round(used.reduce((sum, [item, value]) => sum + committeeStrength(item) * value, 0) / weight) : 0;
  const committees = [...new Set(used.map(([item]) => item))];
  const activists = committees.reduce((sum, item) => sum + (item.activists ?? 0), 0);
  const lost = committees.some(item => item.status === 'perdita-controllo');
  const loyal = committees.length && committees.every(item => item.loyalty >= 60);
  // Turnout work: the volunteers by their quality, more when they are mobilised and the committee is active.
  const gotv = round1(Math.min(12, committees.reduce((sum, item) => sum + item.activists * (item.quality ?? 50) / 100 * (item.mobilizedUntil && item.mobilizedUntil >= (week ?? 0) ? 1.5 : 1) * Math.max(0.3, (item.activity ?? 40) / 60) / 30, 0)));
  // Local money: what the committees have raised and what the volunteers give, a share of it for the candidate.
  const funds = Math.round(committees.reduce((sum, item) => sum + Math.min(1200, (item.raised ?? 0) * 0.12 + item.activists * 10 * (item.quality ?? 50) / 100), 0));
  // Committees that decide for themselves do not hand the list to the party: a candidate from outside has a harder time.
  const autonomous = committees.length && committees.every(item => (item.autonomy ?? 50) >= 70 && !item.leader?.player);
  return {
    committees: committees.map(item => ({ id: item.id, name: item.name, level: item.level, status: item.status, strength: committeeStrength(item) })),
    strength, activists, gotv, funds,
    volunteers: committees.length ? Math.min(25, Math.round(activists / 25 + gotv / 3)) : 0,
    organization: committees.length ? Math.round(clamp((strength - 40) / 5 + gotv / 6, -4, 9)) : -3,
    nomination: round1(lost ? -0.6 : autonomous ? -0.3 : loyal && strength >= 55 ? 0.6 : strength >= 45 ? 0.2 : committees.length ? -0.2 : -0.4),
    localSupport: round1(clamp((strength - 50) / 25, -1.2, 1.5)),
    source: SIM
  };
}

// After a vote: a victory in the committee's territory brings members and energy, a defeat tests it.
export function committeesAfterVote(org, { mandate, electionType, region, provinceCode = null, municipality = null, week }) {
  const lines = [];
  const support = committeeSupport(org, { electionType, region, provinceCode, municipality });
  for (const ref of support.committees) {
    const committee = org.committees.find(item => item.id === ref.id);
    if (!committee) continue;
    committee.organization = Math.round(clamp(committee.organization + (mandate ? 6 : -5)));
    committee.members = Math.round(committee.members * (mandate ? 1.04 : 0.98));
    committee.loyalty = Math.round(clamp(committee.loyalty + (mandate ? 4 : -3)));
    ensureStructure(committee);
    committee.activity = round1(clamp(committee.activity + (mandate ? 6 : -4)));
    committee.fatigue = round1(clamp(committee.fatigue + 8));
    log(committee, week, mandate ? 'Vittoria elettorale nel territorio' : 'Sconfitta elettorale nel territorio');
    lines.push(`${COMMITTEE_LEVELS[committee.level].label} di ${committee.name}: ${mandate ? 'più iscritti ed energia dopo il voto' : 'il comitato accusa la sconfitta'}`);
  }
  return lines;
}

// Figures of the whole territorial network, for the interface.
export function committeeSummary(org) {
  const list = org?.committees ?? [];
  const byStatus = Object.fromEntries(Object.keys(COMMITTEE_STATES).map(status => [status, list.filter(item => item.status === status).length]));
  const active = list.filter(item => item.status !== 'dissoluzione');
  const profiles = active.map(item => committeeProfile(ensureStructure(item)));
  return {
    total: list.length, active: active.length, byStatus, members: active.filter(item => item.level !== 'regione').reduce((sum, item) => sum + item.members, 0), activists: active.reduce((sum, item) => sum + item.activists, 0),
    strength: active.length ? Math.round(active.reduce((sum, item) => sum + committeeStrength(item), 0) / active.length) : 0,
    strong: profiles.filter(item => item.tier === 'forte').length, fragile: profiles.filter(item => item.tier === 'fragile').length,
    growing: profiles.filter(item => item.trend === 'crescita').length, declining: profiles.filter(item => item.trend === 'declino').length,
    seats: active.filter(item => item.seat > 0).length, autonomous: active.filter(item => (item.autonomy ?? 0) >= 70).length,
    quality: active.length ? Math.round(active.reduce((sum, item) => sum + (item.quality ?? 50), 0) / active.length) : 0,
    upkeep: org?.territory?.upkeep ?? 0, raised: org?.territory?.raised ?? 0, scale: org?.territory?.scale ?? null
  };
}

// The consequences of a local event in the player's territory (the decision is taken in the agenda).
export function applyLocalEvent(org, committee, kind, choice, { week, rand = Math.random } = {}) {
  ensureStructure(committee);
  const lines = [];
  const people = fraction => { committee.members = Math.max(3, Math.round(committee.members * (1 - fraction))); committee.activists = Math.max(0, Math.round(committee.activists * (1 - fraction * 3))); };
  if (kind === 'opportunita') {
    if (choice === 'investi') {
      const chance = clamp(0.4 + committee.quality / 200 + committee.organization / 250 + committee.activity / 400 - committee.fatigue / 300, 0.2, 0.9);
      if (rand() < chance) { committee.members += Math.max(3, Math.round(committee.members * 0.04)); committee.activity = round1(clamp(committee.activity + 18)); committee.consensus = Math.round(clamp(committee.consensus + 5)); committee.fatigue = round1(clamp(committee.fatigue + 6)); lines.push(`${committee.name}: l’occasione è sfruttata, nuovi iscritti e più consenso locale`); }
      else { committee.activity = round1(clamp(committee.activity + 6)); committee.fatigue = round1(clamp(committee.fatigue + 10)); lines.push(`${committee.name}: l’occasione non rende quanto sperato e i volontari sono stanchi`); }
    } else if (choice === 'delega') {
      committee.autonomy = Math.round(clamp(committee.autonomy + 8)); committee.loyalty = Math.round(clamp(committee.loyalty + 3)); committee.activity = round1(clamp(committee.activity + 8)); committee.consensus = Math.round(clamp(committee.consensus + 2));
      lines.push(`${committee.name}: ci pensa il responsabile locale, più autonomia e un po’ di consenso`);
    } else { committee.activity = round1(clamp(committee.activity - 4)); lines.push(`${committee.name}: l’occasione passa senza di te`); }
  } else if (kind === 'scandalo') {
    if (choice === 'difendi') {
      committee.loyalty = Math.round(clamp(committee.loyalty + 5)); committee.consensus = Math.round(clamp(committee.consensus - 2));
      if (rand() < 0.4) { committee.consensus = Math.round(clamp(committee.consensus - 4)); people(0.02); lines.push(`${committee.name}: la difesa non convince, il caso si allarga`); } else lines.push(`${committee.name}: il caso si sgonfia, il responsabile ti è grato`);
    } else if (choice === 'sostituisci') {
      committee.leader = { label: `${COMMITTEE_LEVELS[committee.level].leader} (figura simulata, scelta da te)`, currentId: null, player: false };
      committee.loyalty = Math.round(clamp(Math.max(committee.loyalty, 68))); committee.autonomy = Math.round(clamp(committee.autonomy - 8)); people(0.015);
      lines.push(`${committee.name}: nuovo responsabile, qualche iscritto se ne va`);
    } else { committee.consensus = Math.round(clamp(committee.consensus - 5)); people(0.04); committee.activity = round1(clamp(committee.activity - 8)); lines.push(`${committee.name}: il caso pesa su iscritti e consenso`); }
  } else if (kind === 'concorrenza') {
    if (choice === 'rilancia') {
      committee.recruitUntil = week + 6; committee.activity = round1(clamp(committee.activity + 10)); committee.fatigue = round1(clamp(committee.fatigue + 5));
      lines.push(`${committee.name}: tesseramento rilanciato per contendere i volontari`);
    } else if (choice === 'accordo') {
      committee.autonomy = Math.round(clamp(committee.autonomy + 8)); committee.consensus = Math.round(clamp(committee.consensus + 2)); committee.activists = Math.round(committee.activists * 1.04);
      lines.push(`${committee.name}: intesa con le realtà del territorio, più autonomia e radicamento`);
    } else { committee.activists = Math.round(committee.activists * 0.85); committee.quality = round1(clamp(committee.quality - 3)); lines.push(`${committee.name}: i volontari migliori passano alla concorrenza`); }
  }
  log(committee, week, `Evento locale: ${kind}`);
  return lines;
}
