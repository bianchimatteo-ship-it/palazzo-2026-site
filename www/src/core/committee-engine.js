// Territorial committees of the player's party: Region → Province or metropolitan city → Comune. The geography is
// ISTAT's (names and codes of the real territorial units and comuni); members, leaders, activists, strength and states
// are a simulation of the game and never describe the real organisation of a real party.
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
  commissaria: { label: 'Commissaria il comitato', cost: { capital: 3 }, detail: 'Solo chi guida il partito: riprendi il controllo, ma la coesione cala.' }
});

export function committeeStrength(committee) {
  if (!committee || committee.status === 'dissoluzione') return 0;
  const activeShare = committee.members ? Math.min(100, committee.activists / committee.members * 400) : 0;
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
  return committee;
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

// The player's actions on a committee (costs are paid by the career engine).
export function applyCommitteeAction(org, committee, actionId, { week, rand = Math.random, currents = [], leader = false } = {}) {
  const lines = [];
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
  } else if (actionId === 'commissaria') {
    if (!leader) throw new Error('Solo chi guida il partito può commissariare un comitato.');
    if (!['crisi', 'perdita-controllo'].includes(committee.status)) throw new Error('Si commissaria solo un comitato in crisi o fuori controllo.');
    committee.leader = { label: 'Commissario (figura simulata nominata da te)', currentId: null, player: false };
    committee.loyalty = 78;
    committee.organization = Math.round(clamp(committee.organization + 4));
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

// One week of territorial life: organisation, members, volunteers, local consensus, loyalty and state.
export function advanceCommittees(org, { rand = Math.random, week, regionalShares = {}, nationalShare = null, currents = [], campaignActive = false } = {}) {
  const lines = [];
  const events = [];
  const byId = new Map((org.committees ?? []).map(item => [item.id, item]));
  const sections = new Map((org.sections ?? []).map(item => [item.region, item]));
  const growth = (org.growth ?? 0) / 100;
  for (const committee of org.committees ?? []) {
    if (committee.status === 'dissoluzione') continue;
    const parent = committee.parentId ? byId.get(committee.parentId) : null;
    const section = committee.level === 'regione' ? sections.get(committee.region) : null;
    if (committee.level === 'regione' && !section) { setStatus(committee, 'dissoluzione', week, 'la federazione regionale ha chiuso'); committee.members = 0; committee.activists = 0; lines.push(`Si scioglie il comitato regionale ${committee.name}`); continue; }
    const current = currents.find(item => item.id === committee.leader?.currentId);
    const funded = committee.fundedUntil && committee.fundedUntil >= week;
    const mobilized = committee.mobilizedUntil && committee.mobilizedUntil >= week;
    const visited = committee.lastVisitWeek !== null && week - committee.lastVisitWeek <= 4;
    // Organisation: the federation (for the regions), the upper committee, money, visits, cohesion and the treasury.
    const base = section ? section.vitality : 48 + (parent ? (parent.organization - 50) * 0.35 : 0);
    const target = base + ((org.priorities?.territorio ?? 1) - 1) * 6 + (funded ? 12 : 0) + (visited ? 6 : 0) - (org.treasury?.balance < 0 ? 8 : 0) - ((org.cohesion ?? 55) < 40 ? 6 : 0) - (committee.loyalty < 30 ? 5 : 0) - (committee.mobilizedUntil && !mobilized && week - committee.mobilizedUntil <= 3 ? 4 : 0);
    committee.organization = Math.round(clamp(committee.organization + (target - committee.organization) * 0.07 + (rand() - 0.5) * 4));
    committee.members = section ? section.members : Math.max(3, Math.round(committee.members * (1 + growth + (committee.organization - 50) / 6000)));
    const activistsTarget = committee.members * (0.05 + committee.organization / 1200 + (mobilized ? 0.08 : 0) + (campaignActive ? 0.02 : 0));
    committee.activists = Math.max(0, Math.round(committee.activists + (activistsTarget - committee.activists) * 0.15));
    // Local consensus (index 0–100, 50 = in line with the party's national average): where the party polls better and
    // where the committee works well.
    const offset = regionalShares[committee.region] !== undefined && nationalShare !== null ? regionalShares[committee.region] - nationalShare : 0;
    committee.consensus = Math.round(clamp(committee.consensus + (50 + offset * 8 + (committee.organization - 50) * 0.3 - committee.consensus) * 0.1));
    // Loyalty follows the leader: the player's people stay loyal, others follow their area's relation with the player.
    const loyaltyTarget = committee.leader?.player ? 85 : current ? (current.value ?? current.relation ?? 50) : 55;
    committee.loyalty = Math.round(clamp(committee.loyalty + (loyaltyTarget - committee.loyalty) * 0.05 + (rand() - 0.5) * 2));
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
    if (committee.status === 'dissoluzione') { committee.members = 0; committee.activists = 0; }
    if (before !== committee.status) {
      lines.push(`${COMMITTEE_LEVELS[committee.level].label} di ${committee.name}: ${COMMITTEE_STATES[committee.status].label.toLowerCase()}`);
      if (['crisi', 'perdita-controllo', 'dissoluzione'].includes(committee.status)) events.push({ type: 'committee', committee: committee.id, status: committee.status, name: committee.name, level: committee.level });
    }
  }
  return { lines, events };
}

// The committees that count for a vote, and what they bring to the candidacy and the campaign.
export function committeeSupport(org, { electionType, region, provinceCode = null, municipality = null } = {}) {
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
  return {
    committees: committees.map(item => ({ id: item.id, name: item.name, level: item.level, status: item.status, strength: committeeStrength(item) })),
    strength, activists,
    volunteers: committees.length ? Math.min(25, Math.round(activists / 25)) : 0,
    organization: committees.length ? Math.round(clamp((strength - 40) / 5, -4, 8)) : -3,
    nomination: round1(lost ? -0.6 : loyal && strength >= 55 ? 0.6 : strength >= 45 ? 0.2 : committees.length ? -0.2 : -0.4),
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
  return { total: list.length, active: active.length, byStatus, members: active.filter(item => item.level !== 'regione').reduce((sum, item) => sum + item.members, 0), activists: active.reduce((sum, item) => sum + item.activists, 0), strength: active.length ? Math.round(active.reduce((sum, item) => sum + committeeStrength(item), 0) / active.length) : 0 };
}
