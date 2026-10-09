// Founding, splitting, merging and renaming the player's party, in the career state (game.party): what an area takes
// with it when it leaves — sections, committees, members, volunteers, money — what a merger adds, what a new name costs.
// The functions work on a copy of the game owned by the caller and return a description of what the store still has to
// apply to the political world, the Parliament and the records of the user's party. Simulated: no real party changes.
import { ITALIAN_REGIONS } from '../data/regions.js?v=20261009-3';
import { RENAME_STYLES } from '../data/simulation/party-life-rules.js?v=20261009-3';
import { normalizeLife, strengthShare } from './party-life-engine.js?v=20261009-3';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const slug = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const committeesOf = org => (org?.committees ?? []).filter(item => item.status !== 'dissoluzione');
const recount = org => { org.members = org.sections.reduce((sum, item) => sum + item.members, 0); };

export const OP_COSTS = Object.freeze({
  found: { capital: 6, funds: 1500 },
  rename: { capital: 3 },
  merge: { capital: 5 }
});
export const OP_COOLDOWNS = Object.freeze({ found: 26, rename: 52, merge: 78 });

// What the player can do with the party right now, and why not.
export function partyOpsAvailability(game, { neighbours = [] } = {}) {
  const party = game?.party;
  const week = game?.week?.index ?? 0;
  const secretary = party?.affiliation === 'founder' || (party?.affiliation === 'member' && party.rank >= 5);
  const since = key => party?.decisions?.[key] !== undefined ? week - party.decisions[key] : null;
  const wait = (key, weeks) => { const elapsed = since(key); return elapsed !== null && elapsed < weeks ? `Di nuovo dalla settimana ${party.decisions[key] + weeks}.` : null; };
  const funds = game?.resources?.funds ?? 0;
  const capital = game?.resources?.politicalCapital ?? 0;
  const afford = cost => (cost.capital && capital < cost.capital) ? `Servono ${cost.capital} punti di capitale politico.` : (cost.funds && funds < cost.funds) ? `Servono ${cost.funds} € di fondi.` : null;
  return {
    found: { ok: !wait('found', OP_COOLDOWNS.found) && !afford(OP_COSTS.found), reason: wait('found', OP_COOLDOWNS.found) ?? afford(OP_COSTS.found), cost: OP_COSTS.found },
    rename: { ok: Boolean(party?.life) && secretary && party?.affiliation === 'founder' && !wait('rename', OP_COOLDOWNS.rename) && !afford(OP_COSTS.rename), reason: !party ? 'Serve un partito.' : party.affiliation !== 'founder' ? 'Il nome di un partito esistente non si cambia: solo chi ha fondato il proprio partito può farlo.' : wait('rename', OP_COOLDOWNS.rename) ?? afford(OP_COSTS.rename), cost: OP_COSTS.rename },
    merge: { ok: secretary && neighbours.length > 0 && !wait('merge', OP_COOLDOWNS.merge) && !afford(OP_COSTS.merge), reason: !party ? 'Serve un partito.' : !secretary ? 'Solo il segretario tratta una fusione.' : !neighbours.length ? 'Nessuna forza abbastanza vicina per una fusione.' : wait('merge', OP_COOLDOWNS.merge) ?? afford(OP_COSTS.merge), cost: OP_COSTS.merge }
  };
}

// ---------- splitting off ----------
// What the areas that leave take away. `followed`: the player goes with them and leads the new party.
export function splitOff(game, api, { currentIds, newPartyId, label, abbreviation = null, followed = false, personal = false, week, date, rand }) {
  const party = game.party;
  const org = party.org;
  const life = normalizeLife(party, { seed: game.seed ?? 1, week });
  const leaving = new Set(currentIds);
  const leavingShare = [...leaving].reduce((sum, id) => sum + strengthShare(party, id), 0);
  const lines = [];
  // The territory goes with whoever leads it: a federation led by a leaving area leaves almost whole.
  const regional = committeesOf(org).filter(item => item.level === 'regione');
  const moves = id => leaving.has(id) || (personal && id === 'player');
  const ledByLeaver = committee => moves(committee.leader?.currentId) || (personal && committee.leader?.player);
  const sections = [];
  let membersLeft = 0;
  for (const section of org.sections) {
    const committee = regional.find(item => item.region === section.region);
    const share = committee && ledByLeaver(committee) ? 0.85 : clamp(leavingShare * 0.9 + rand() * 0.05, 0.03, 0.6);
    const taken = Math.min(section.members - 5, Math.round(section.members * share));
    if (taken < 4) continue;
    section.members -= taken;
    membersLeft += taken;
    sections.push({ region: section.region, members: taken, vitality: Math.round(clamp(section.vitality + (committee && ledByLeaver(committee) ? 6 : -8))) });
  }
  recount(org);
  const militants = Math.min(org.militants, Math.round(membersLeft * (org.militants / Math.max(1, org.members + membersLeft)) * 1.25));
  org.militants = Math.max(0, org.militants - militants);
  const cadres = Math.min(org.cadres ?? 0, Math.round((org.cadres ?? 0) * leavingShare * 1.1));
  org.cadres = Math.max(0, (org.cadres ?? 0) - cadres);
  // The committees led by the leaving areas (and by the player, when the player leaves) go with them.
  const movedCommittees = committeesOf(org).filter(ledByLeaver);
  org.committees = (org.committees ?? []).filter(item => !movedCommittees.includes(item));
  for (const committee of org.committees ?? []) committee.loyalty = Math.round(clamp(committee.loyalty - 4));
  const treasury = Math.round(org.treasury.balance * (org.treasury.balance > 0 ? leavingShare * 0.6 : leavingShare));
  api.book(game, org, -treasury, 'prestiti', 'Divisione della cassa dopo la scissione');
  // The party left behind: purified or weakened, shaken in any case.
  org.conflicts = (org.conflicts ?? []).filter(item => !(item.currents ?? []).some(id => leaving.has(id)));
  org.cohesion = Math.round(clamp(org.cohesion + (followed ? -2 : 6) - Math.round(leavingShare * 10)));
  party.currents = party.currents.filter(item => !leaving.has(item.id));
  if (!party.currents.some(item => item.id === party.leaderCurrentId)) party.leaderCurrentId = [...party.currents].sort((a, b) => b.strength - a.strength)[0]?.id ?? null;
  if (leaving.has(party.alignedCurrentId)) party.alignedCurrentId = null;
  if (leaving.has(party.organsCurrentId)) party.organsCurrentId = null;
  for (const pact of life.pacts.filter(item => item.status === 'attivo' && leaving.has(item.actorId))) { pact.status = 'rotto'; pact.endedWeek = week; pact.settled = 'scissione'; }
  life.requests = life.requests.filter(item => !(item.from === 'actor' && leaving.has(item.refId)));
  for (const cadre of life.cadres) if (movedCommittees.some(item => item.id === cadre.committeeId)) { cadre.status = 'uscito'; cadre.leftWeek = week; }
  for (const id of leaving) delete life.splitWatch[id];
  life.lastSplitWeek = week;
  normalizeLife(party, { seed: game.seed ?? 1, week });
  const seatShare = clamp(leavingShare * (0.8 + rand() * 0.35), 0.04, 0.7);
  const descriptor = { id: newPartyId, label, abbreviation, currentIds: [...leaving], leavingShare: round1(leavingShare * 100), seatShare: round1(seatShare * 100), members: membersLeft, militants, cadres, treasury, sections, committees: movedCommittees, followed, source: SIM };
  api.remember(game, { date, kind: 'scissione', text: `Scissione: ${label} lascia il partito (${descriptor.leavingShare}% delle aree)`, weight: 1.4 });
  party.history.push({ week, date, text: `Scissione: ${label} lascia il partito`, source: SIM });
  lines.push(`${label} lascia il partito con ${membersLeft.toLocaleString('it-IT')} iscritti, ${movedCommittees.length} comitati e ${treasury.toLocaleString('it-IT')} € di cassa`);
  if (!followed) { org.cohesion = Math.round(clamp(org.cohesion)); lines.push(`Coesione del partito: ${org.cohesion}`); }
  return { descriptor, lines };
}

// The player leads the party that comes out of a split, or founds one: the career moves into it.
export function enterNewParty(game, api, { descriptor = null, newPartyId, label, abbreviation = null, week, date, rand, reason }) {
  const old = game.party;
  const lines = [];
  if (old) {
    game.pastParties.push({ partyId: old.partyId, label: old.label, rankTitle: old.rankTitle, reason, leftAtWeek: week, source: SIM });
    game.relations = game.relations.filter(item => item.id !== 'leadership');
  }
  const created = api.createParty({ id: newPartyId, label, founder: true, joinedAt: date, share: descriptor ? descriptor.leavingShare : null }, week * 97 + (game.seed ?? 1), { region: game.place?.region ?? null, week, date });
  if (descriptor) {
    const org = created.org;
    const sections = ITALIAN_REGIONS.length ? descriptor.sections : [];
    if (sections.length) {
      org.sections = sections.map(item => ({ id: `sezione-${item.region}`, region: item.region, label: `Sezione ${item.region}`, members: item.members, vitality: item.vitality, openedWeek: week, source: SIM }));
      recount(org);
    }
    org.militants = Math.max(4, descriptor.militants);
    org.cadres = Math.max(3, descriptor.cadres);
    org.treasury.balance = Math.max(0, descriptor.treasury) + 1200;
    org.committees = descriptor.committees.map(item => ({ ...item, leader: item.leader?.player ? item.leader : { ...item.leader, currentId: null, label: `${item.leader?.label?.replace(/ \(figura simulata.*\)/, '') ?? 'Coordinamento'} (figura simulata, passato con te)` }, loyalty: Math.round(clamp(Math.max(item.loyalty, 68))), history: [{ week, text: 'Passato al nuovo partito', source: SIM }, ...(item.history ?? [])].slice(0, 8) }));
    org.cohesion = 68;
  }
  game.party = created;
  game.party.support = 70;
  // The programme goes with whoever leads the new party: the founder takes his own priorities along (a party that had none leaves the new one without).
  if (old?.program?.areas?.length) game.party.program = { areas: [...old.program.areas], since: week, source: SIM, inheritedFrom: old.partyId };
  game.relations = game.relations.filter(item => item.id !== 'leadership');
  game.party.history.push({ week, date, text: `${label}: nasce il partito`, source: SIM });
  api.remember(game, { date, kind: 'fondazione', text: `Fondato ${label}`, weight: 1.3 });
  lines.push(`Nasce ${label}: sei segretario e fondatore`);
  return { lines };
}

// A new party founded by the player: only the player's own people and the areas that follow leave the old one.
export function foundParty(game, api, { newPartyId, label, abbreviation = null, followerIds = [], week, date, rand }) {
  const lines = [];
  let split = null;
  if (game.party?.life && game.party.org) {
    split = splitOff(game, api, { currentIds: followerIds, newPartyId, label, abbreviation, followed: true, personal: true, week, date, rand });
    lines.push(...split.lines);
  }
  const entered = enterNewParty(game, api, { descriptor: split?.descriptor ?? null, newPartyId, label, abbreviation, week, date, rand, reason: `Fonda ${label}` });
  lines.push(...entered.lines);
  return { descriptor: split?.descriptor ?? { id: newPartyId, label, abbreviation, currentIds: followerIds, leavingShare: 0, seatShare: 0, members: 0, militants: 0, cadres: 0, treasury: 0, sections: [], committees: [], followed: true, source: SIM }, lines };
}

// ---------- merging ----------
// Another force joins the party: members, sections and money add up, a new area is born with its own people, the
// balances shift and the first months are tense.
export function mergeParties(game, api, { forceId, label, share, ownShare, newLabel = null, week, date, rand }) {
  const party = game.party;
  const org = party.org;
  const life = normalizeLife(party, { seed: game.seed ?? 1, week });
  const ratio = clamp((share ?? 1) / Math.max(0.6, ownShare ?? 3), 0.1, 1.5);
  const added = Math.round(org.members * ratio * 0.8);
  const short = String(label).replace(/\s*\(.*\)\s*$/, '').split(/\s+/).slice(0, 3).join(' ');
  const areaId = `area-${slug(short) || forceId}`.slice(0, 40);
  const strength = Math.round(clamp(ratio / (1 + ratio) * 100, 8, 45));
  for (const current of party.currents) current.strength = Math.max(6, Math.round(current.strength * (100 - strength) / 100));
  const area = { id: areaId, label: `Area ${short}`, strength, value: 55, relation: 55, line: 'autonoma', areas: [], source: SIM };
  if (!party.currents.some(item => item.id === areaId)) party.currents.push(area);
  // The members arrive where the other party was strong: its sections add to ours, with new regions opened.
  const weights = ITALIAN_REGIONS.map((region, index) => ({ region, w: 0.4 + ((index * 37 + share * 11 + (forceId.length * 7)) % 10) / 10 }));
  const total = weights.reduce((sum, item) => sum + item.w, 0);
  for (const { region, w } of weights.filter((item, index) => index % 3 !== 0 || org.sections.some(section => section.region === item.region))) {
    const members = Math.max(5, Math.round(added * w / total * 1.4));
    const section = org.sections.find(item => item.region === region);
    if (section) { section.members += members; section.vitality = Math.round(clamp(section.vitality + 3)); }
    else org.sections.push({ id: `sezione-${region}`, region, label: org.founder ? `Sezione ${region}` : `Federazione ${region}`, members, vitality: 45, openedWeek: week, source: SIM });
  }
  recount(org);
  org.militants = Math.min(org.members, Math.round(org.militants + added * 0.12));
  org.cadres = (org.cadres ?? 0) + Math.round(added / 700) + 2;
  api.book(game, org, Math.round(added * 7), 'donazioni', `Cassa di ${short}`);
  org.cohesion = Math.round(clamp(org.cohesion - 6));
  const ruling = party.currents.find(item => item.id === party.leaderCurrentId) ?? party.currents[0];
  org.conflicts.push({ id: `conflitto-${week}-fusione`, title: `L’integrazione di ${short}: posti, simboli e liste`, currents: [ruling.id, areaId], intensity: 42, since: week, source: SIM });
  const previousLabel = party.label;
  if (newLabel) party.label = newLabel;
  party.decisions = { ...(party.decisions ?? {}), merge: week };
  normalizeLife(party, { seed: game.seed ?? 1, week });
  api.remember(game, { date, kind: 'fusione', text: `Fusione con ${label}`, weight: 1.2 });
  party.history.push({ week, date, text: `Fusione con ${label}`, source: SIM });
  life.history = [{ week, kind: 'fusione', text: `Fusione con ${label}: +${added.toLocaleString('it-IT')} iscritti`, source: SIM }, ...life.history].slice(0, 40);
  return { descriptor: { forceId, label, previousLabel, newLabel: party.label, ratio: round1(ratio * 100), members: added, areaId, source: SIM }, lines: [`${label} confluisce nel partito: +${added.toLocaleString('it-IT')} iscritti, nasce l’${area.label.toLowerCase()} (${strength}% delle aree)`, 'Coesione −6: le prime settimane sono tese'] };
}

// ---------- renaming ----------
export function renameParty(game, api, { label, abbreviation = null, style = 'rilancio', week, date }) {
  const party = game.party;
  const org = party.org;
  const spec = RENAME_STYLES[style];
  if (!spec) throw new Error('Tipo di cambio di nome non riconosciuto.');
  const clean = String(label ?? '').trim();
  if (clean.length < 3 || clean.length > 60) throw new Error('Il nome deve avere da 3 a 60 caratteri.');
  if (clean === party.label) throw new Error('È già il nome del partito.');
  const cost = Math.round(500 + org.members * 0.3 * spec.shock);
  if ((org.treasury?.balance ?? 0) < cost) throw new Error(`La tesoreria non ha ${cost.toLocaleString('it-IT')} € per il cambio d’immagine.`);
  api.book(game, org, -cost, 'comunicazione', `Cambio di nome: ${clean}`);
  const previous = party.label;
  party.label = clean;
  party.decisions = { ...(party.decisions ?? {}), rename: week };
  party.names = [...(party.names ?? []), { label: previous, until: week, source: SIM }].slice(-6);
  const lost = Math.round(org.members * 0.012 * spec.shock);
  for (const section of org.sections) section.members = Math.max(5, Math.round(section.members * (1 - 0.012 * spec.shock)));
  recount(org);
  org.cohesion = Math.round(clamp(org.cohesion + (style === 'restyling' ? 1 : style === 'rilancio' ? -2 : -5)));
  org.militants = Math.min(org.members, Math.round(org.militants * (1 - 0.01 * spec.shock)));
  for (const current of party.currents) current.relation = current.value = Math.round(clamp((current.value ?? current.relation ?? 50) + (style === 'rifondazione' ? -3 : 0)));
  api.remember(game, { date, kind: 'cambio-nome', text: `Il partito cambia nome: da ${previous} a ${clean}`, weight: 0.8 });
  const life = normalizeLife(party, { seed: game.seed ?? 1, week });
  life.history = [{ week, kind: 'identita', text: `Nuovo nome: ${clean} (era ${previous})`, source: SIM }, ...life.history].slice(0, 40);
  return { descriptor: { label: clean, abbreviation, previous, style, shock: spec.shock, renewal: spec.renewal, source: SIM }, lines: [`Nuovo nome: ${clean}`, `Cambio d’immagine: ${cost.toLocaleString('it-IT')} € dalla tesoreria, ${lost.toLocaleString('it-IT')} iscritti in meno`, spec.detail] };
}
