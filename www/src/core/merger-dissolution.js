// Dissolving a merger of the player's party: the partner that confluì in it is a party of its own again, ON TODAY'S DATE of the game (the calendar never goes back and nothing that happened after
// the merger is deleted: elections, results, laws, polls stay as they are). Loaded on demand (the page of the party and store.dissolveMerger), never with the first screen.
//
// What comes back, and from where (docs/qa/scioglimento-fusioni.md):
//   · a merger made from this version on keeps a SNAPSHOT (game.party.mergers, one id per merger): members before and added, sections opened or enlarged region by region, militants, cadres, the
//     cash brought, the internal area and the conflict it opened, the identity and the consensus of both forces in the political world, the parliamentary groups of the partner;
//   · a merger of an older save has no snapshot: what the save still holds is used (the partner's record in the political world, which the merger only switched off; the history of the party, which
//     says how many members came; the rule of the merger for the cash, 7 € per member; the sections opened that week; the area named after the partner; the identity kept by the merger history of a
//     founded party). What is not there is listed as NOT recoverable and nothing is invented in its place.
// The split of what was built after the merger is deterministic and never duplicates anything: the members that leave are taken from the sections in proportion to what the partner brought there
// (rounding by largest remainder, never below five members for a section that existed before), the cash returned is at most what the treasury holds, the consensus is divided in the proportion the two
// forces had when they merged (the sum stays the same), the parliamentary groups go back to their party, nobody is counted twice.
import { isSecretary, remember } from './career-engine.js?v=20261125-12';
import { treasuryBook } from './organization-engine.js?v=20261125-12';
import { allocateSeats, normalizeLife } from './party-life-engine.js?v=20261125-12';

export const DISSOLVE_COST = Object.freeze({ capital: 5 });
const SIM = 'simulation';
const CASH_PER_MEMBER = 7;   // the rule of core/party-ops-engine.js mergeParties: the partner's cash is booked as 7 € for each member it brings
const MIN_SECTION = 5;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round2 = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const short = value => String(value ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
const slug = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmt = value => Math.round(value).toLocaleString('it-IT');
const tieKey = (a, b) => [a, b].sort().join('|');
const ownForceOf = world => world?.parties?.find(item => item.isPlayer) ?? null;
// the id the merger gave to the area of the partner (same rule as mergeParties)
const areaIdOf = (label, forceId) => { const name = short(label).split(/\s+/).slice(0, 3).join(' '); return `area-${slug(name) || forceId}`.slice(0, 40); };

// The members the partner brought, for a merger with no snapshot: the history of the party («Fusione con X: +N iscritti») or the diary of the career; null when neither keeps it.
function legacyArrival(game, label) {
  const name = short(label);
  const sources = [...(game.party?.life?.history ?? []).filter(item => item.kind === 'fusione').map(item => [item.text, item.week]), ...(game.log ?? []).filter(item => item.kind === 'partito' && item.title === `Fusione con ${name}`).map(item => [(item.lines ?? []).join(' '), item.week])];
  for (const [text, week] of sources) {
    if (!String(text ?? '').includes(name)) continue;
    const found = String(text).match(/\+([\d.]+) iscritti/);
    if (found) return { added: Number(found[1].replace(/\./g, '')), week };
  }
  return null;
}

// The mergers of the player's party that can be dissolved now: every force of the political world that confluì in it and is still switched off.
export function mergerCases(state) {
  const game = state?.game, own = ownForceOf(state?.world);
  if (!game?.party || !own) return [];
  const snaps = game.party.mergers ?? [];
  return state.world.parties.filter(item => item.mergedInto === own.id && item.active === false).map(partner => {
    const snap = [...snaps].reverse().find(item => item.forceId === partner.id && item.status === 'attiva') ?? null;
    return { id: snap?.id ?? `fusione-storica-${partner.id}`, forceId: partner.id, label: short(partner.label), date: snap?.date ?? partner.mergedEvidence?.date ?? null, week: snap?.week ?? null, snap, legacy: !snap };
  });
}

// Shares a total over items { weight, cap } deterministically: floors, then the largest remainders, then whatever room is left (never above a cap). Returns the amounts, whose sum is ≤ total.
function allocate(total, items) {
  const weight = items.reduce((sum, item) => sum + item.weight, 0);
  if (!(total > 0) || !(weight > 0)) return items.map(() => 0);
  const raw = items.map(item => total * item.weight / weight);
  const out = raw.map((value, index) => Math.min(items[index].cap, Math.floor(value)));
  let left = total - out.reduce((sum, value) => sum + value, 0);
  const order = items.map((_, index) => index).sort((a, b) => (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a])) || items[b].weight - items[a].weight || String(items[a].key).localeCompare(String(items[b].key)));
  for (const index of order) { if (left <= 0) break; if (out[index] < items[index].cap) { out[index]++; left--; } }
  for (const index of order) { if (left <= 0) break; const room = items[index].cap - out[index]; if (room > 0) { const give = Math.min(room, left); out[index] += give; left -= give; } }
  return out;
}

// What the dissolution would do now, without doing it: the requirements, the numbers, what comes back and what cannot be rebuilt.
export function dissolutionPlan(state, id) {
  const item = mergerCases(state).find(entry => entry.id === id);
  if (!item) return { ok: false, reason: 'Questa fusione non è più attiva.' };
  const game = state.game, party = game.party, org = party.org, world = state.world;
  const own = ownForceOf(world), partner = world.parties.find(entry => entry.id === item.forceId);
  const snap = item.snap, recovered = [], missing = [];
  const reason = game.status === 'ended' ? 'La carriera è conclusa.'
    : !isSecretary(party) ? 'Solo il segretario del partito può sciogliere una fusione.'
    : (game.resources.politicalCapital ?? 0) < DISSOLVE_COST.capital ? `Servono ${DISSOLVE_COST.capital} punti di capitale politico.`
    : party.life?.congress ? 'Non durante il congresso del partito: potrai farlo quando si sarà concluso.'
    : state.campaign?.status === 'active' ? 'Non durante una campagna elettorale: liste e candidature sono già depositate. Potrai farlo a campagna chiusa.'
    : null;
  // identity of the partner: its record in the political world was only switched off by the merger
  recovered.push(`Nome, sigla, colori e collocazione di ${item.label}${partner.position ? ` (${partner.position})` : ''}: conservati nel salvataggio.`);
  // members and sections
  const legacy = snap ? null : legacyArrival(game, item.label);
  const added = snap?.added ?? legacy?.added ?? null;
  const sections = [];
  let members = 0;
  if (added === null) missing.push('Iscritti e sezioni portati dal partner: il salvataggio non li registra, restano al tuo partito.');
  else {
    const growth = snap ? org.members / Math.max(1, (snap.before ?? 0) + snap.added) : 1;
    const target = Math.round(added * Math.min(1, growth));
    const created = new Set(snap ? (snap.regions ?? []).filter(row => row[2]).map(row => row[0]) : org.sections.filter(section => section.openedWeek === legacy.week && section.source === SIM).map(section => section.region));
    const weightOf = section => snap ? ((snap.regions ?? []).find(row => row[0] === section.region)?.[1] ?? 0) : section.members;
    const pool = org.sections.map(section => ({ key: section.id, weight: weightOf(section), cap: created.has(section.region) ? section.members : Math.max(0, section.members - MIN_SECTION), section }));
    const amounts = allocate(target, pool);
    pool.forEach((entry, index) => { if (amounts[index] > 0) sections.push({ id: entry.section.id, region: entry.section.region, members: amounts[index], closes: created.has(entry.section.region) && amounts[index] >= entry.section.members }); });
    members = sections.reduce((sum, entry) => sum + entry.members, 0);
    recovered.push(snap ? `Iscritti: ${fmt(members)} tornano a ${item.label} (alla fusione ne aveva portati ${fmt(snap.added)}; la quota segue l’andamento degli iscritti da allora).` : `Iscritti: ${fmt(members)} tornano a ${item.label} (ricavati dallo storico del partito: alla fusione ne aveva portati ${fmt(added)}).`);
    if (!snap) missing.push('Andamento degli iscritti dopo la fusione: non registrato, tornano gli iscritti portati allora (al massimo quelli che le sezioni hanno ancora).');
    const closing = sections.filter(entry => entry.closes).length;
    recovered.push(`Sezioni: ${sections.length} interessate${closing ? `, ${closing} aperte con la fusione passano interamente al partner` : ''}; nessuna sezione che esisteva prima scende sotto i ${MIN_SECTION} iscritti.`);
  }
  const share = org.members > 0 ? members / org.members : 0;
  const militants = Math.min(org.militants ?? 0, Math.round((org.militants ?? 0) * share));
  const cadres = Math.min(org.cadres ?? 0, Math.round((org.cadres ?? 0) * share));
  // cash: the snapshot keeps it; for an older save the rule of the merger gives it from the members (7 € each)
  const brought = snap?.cash ?? (added === null ? null : Math.round(added * CASH_PER_MEMBER));
  const cash = brought === null ? 0 : Math.max(0, Math.min(brought, Math.floor(org.treasury?.balance ?? 0)));
  if (brought === null) missing.push('Cassa portata dal partner: non ricostruibile, la tesoreria non cambia.');
  else recovered.push(`Tesoreria: ${fmt(cash)} € tornano al partner${cash < brought ? ` (ne aveva portati ${fmt(brought)}: la tesoreria ne ha solo ${fmt(Math.max(0, org.treasury?.balance ?? 0))})` : ''}${snap ? '' : ' (ricostruiti dalla regola della fusione: 7 € per iscritto)'}.`);
  // the internal area of the partner and its conflict
  const areaId = snap?.area ?? areaIdOf(item.label, item.forceId);
  const area = party.currents.find(entry => entry.id === areaId) ?? null;
  if (area) recovered.push(`Corrente: l’${area.label} esce con il partner; le altre aree riprendono il loro peso.`);
  else missing.push('Corrente nata dalla fusione: non più presente nel partito.');
  const conflicts = (org.conflicts ?? []).filter(entry => entry.id === snap?.conflict || (area && (entry.currents ?? []).includes(area.id) && /-fusione$/.test(entry.id))).map(entry => entry.id);
  // consensus: divided in the proportion the two forces had when they merged
  const evidence = partner.mergedEvidence ?? null;
  const shares = snap?.world ? [snap.world.own.baseline, snap.world.partner.baseline] : evidence ? [evidence.intoShare, evidence.share] : null;
  const ratio = shares && shares[0] + shares[1] * 0.8 > 0 ? clamp(shares[1] * 0.8 / (shares[0] + shares[1] * 0.8), 0, 0.9) : null;
  const baseline = ratio === null ? 0 : round2(Math.max(0, own.baseline * ratio));
  const anchor = ratio === null ? 0 : round2(Math.max(0, (own.anchor ?? own.baseline) * ratio));
  if (ratio === null) missing.push('Consenso al momento della fusione: non registrato, il partner riparte senza consenso proprio.');
  else recovered.push(`Consenso: ${String(baseline).replace('.', ',')} punti passano a ${item.label} (la proporzione tra i due partiti al momento della fusione; il totale non cambia).`);
  // identity of the player's party: what the merger changed, if it changed it
  const record = state.dataset?.parties?.find(entry => entry.id === state.career?.partyId) ?? null;
  const entry = [...(record?.mergers ?? [])].reverse().find(row => row.partnerId === item.forceId && !row.dissolvedAt) ?? null;
  // the identity comes back only while the party still carries the one the merger gave it (a later change of name is the player's and stays)
  const current = entry?.previous?.label && party.label === entry.identity?.label;
  const identity = current ? entry.previous : null;
  const worldIdentity = !identity ? null : snap?.world?.own ? { label: snap.world.own.label, abbreviation: snap.world.own.abbreviation ?? null, brandColor: snap.world.own.brandColor ?? null, color: snap.world.own.color } : { label: identity.label, abbreviation: identity.abbreviation ?? own.abbreviation ?? null, brandColor: identity.color ?? own.brandColor ?? null };
  const previousLabel = identity?.label ?? null;
  if (identity) recovered.push(`Il tuo partito torna «${identity.label}»${identity.abbreviation ? ` (${identity.abbreviation})` : ''} con i colori e il logo di prima della fusione.`);
  else if (entry?.previous?.label) missing.push(`Nome di prima della fusione («${entry.previous.label}»): il partito ha cambiato nome dopo, resta «${party.label}».`);
  else if (!snap && party.affiliation === 'founder') missing.push('Nome e simbolo di prima della fusione: non registrati in questo salvataggio, il partito tiene l’identità attuale.');
  // the parliamentary groups of the partner (only the groups the game itself created carry a party)
  const own0 = own.id;
  const groups = Object.values(state.parliament?.chambers ?? {}).flatMap(chamber => (chamber.groups ?? []).filter(group => group.partyId === own0 && (snap ? (snap.groups ?? []).includes(group.groupId) : String(group.groupId).endsWith(`-${item.forceId}`))).map(group => group.groupId));
  if (groups.length) recovered.push(`Gruppi parlamentari: ${groups.length} tornano a ${item.label}.`);
  else if (!snap) missing.push('Gruppi parlamentari: la fusione non ha conservato quali fossero del partner; restano come sono.');
  recovered.push('Elezioni, risultati, sondaggi e leggi successivi alla fusione restano come sono: i voti presi insieme restano al tuo partito.');
  missing.push(`Alleanze di ${item.label} prima della fusione: non si ripristinano (gli accordi sono andati avanti senza di lui); riparte fuori da ogni accordo e puoi invitarlo di nuovo.`);
  return { ok: !reason, reason, id: item.id, forceId: item.forceId, label: item.label, legacy: item.legacy, date: item.date, members, sections, militants, cadres, cash, brought, area: area?.id ?? null, conflicts, baseline, anchor, groups, identity, worldIdentity, previousLabel, recovered, missing, cost: DISSOLVE_COST };
}

// The confirmation the page shows before anything happens.
export function dissolutionPreview(state, id) {
  const plan = dissolutionPlan(state, id);
  if (!plan.ok) return { ...plan, confirm: null };
  return { ...plan, confirm: { kicker: 'PARTITO', title: `Sciogliere la fusione con ${plan.label}?`, body: `${plan.label} torna un partito autonomo da oggi, ${plan.legacy ? 'con quanto il salvataggio permette di ricostruire' : 'con quanto aveva portato'}. Il calendario non torna indietro: la storia successiva resta. Costo: ${DISSOLVE_COST.capital} punti di capitale politico; la coesione cala di 3 e i rapporti con ${plan.label} si raffreddano.`, details: [...plan.recovered.map(text => `✓ ${text}`), ...plan.missing.map(text => `✗ ${text}`)], confirmLabel: 'Sciogli la fusione', tone: 'danger' } };
}

// Applies the dissolution to a copy of the state and returns the new one. `api` gives the store's own steps: the Parliament update and the political timeline.
export function dissolveMergerState(state, id, api) {
  const plan = dissolutionPlan(state, id);
  if (!plan.ok) throw new Error(plan.reason);
  const date = state.clock.currentDate;
  const game = copy(state.game), world = copy(state.world), dataset = { ...state.dataset };
  const party = game.party, org = party.org, week = game.week.index;
  game.resources.politicalCapital -= DISSOLVE_COST.capital;
  // members, sections, militants, cadres, cash
  for (const move of plan.sections) { const section = org.sections.find(entry => entry.id === move.id); if (section) section.members -= move.members; }
  const closed = new Set(plan.sections.filter(move => move.closes).map(move => move.id));
  org.sections = org.sections.filter(section => !(closed.has(section.id) && section.members <= 0));
  org.members = org.sections.reduce((sum, section) => sum + section.members, 0);
  org.militants = Math.max(0, Math.min(org.members, (org.militants ?? 0) - plan.militants));
  org.cadres = Math.max(0, (org.cadres ?? 0) - plan.cadres);
  if (plan.cash > 0) treasuryBook(org, -plan.cash, 'fusione', `Separazione da ${plan.label}: cassa restituita`);
  // the area of the partner leaves; the other areas get back the weight the merger took from them
  if (plan.area) {
    const total = party.currents.reduce((sum, entry) => sum + entry.strength, 0);
    const leaving = party.currents.find(entry => entry.id === plan.area)?.strength ?? 0;
    party.currents = party.currents.filter(entry => entry.id !== plan.area);
    const rest = total - leaving;
    if (rest > 0) for (const current of party.currents) current.strength = Math.max(6, Math.round(current.strength * total / rest));
    if (party.alignedCurrentId === plan.area) party.alignedCurrentId = null;
    if (party.leaderCurrentId === plan.area) party.leaderCurrentId = [...party.currents].sort((a, b) => b.strength - a.strength)[0]?.id ?? null;
    if (party.organsCurrentId === plan.area) party.organsCurrentId = null;
    // the internal life of the area goes with it, as in a split (core/party-ops-engine.js splitOff): its pacts end, its requests close, its leader leaves the bodies
    const life = party.life;
    if (life) {
      for (const pact of (life.pacts ?? []).filter(item => item.status === 'attivo' && item.actorId === plan.area)) { pact.status = 'rotto'; pact.endedWeek = week; pact.settled = 'separazione'; }
      life.requests = (life.requests ?? []).filter(item => !(item.from === 'actor' && item.refId === plan.area));
      if (life.splitWatch) delete life.splitWatch[plan.area];
    }
    normalizeLife(party, { seed: game.seed ?? 1, week });
    if (party.life) allocateSeats(party, party.life);
  }
  org.conflicts = (org.conflicts ?? []).filter(entry => !plan.conflicts.includes(entry.id));
  org.cohesion = Math.round(clamp((org.cohesion ?? 60) - 3, 0, 100));
  if (plan.previousLabel && plan.previousLabel !== party.label) party.label = plan.previousLabel;
  party.decisions = { ...(party.decisions ?? {}), dissolve: week };
  const summary = `${plan.label} torna autonomo: −${fmt(plan.members)} iscritti, −${fmt(plan.cash)} € di cassa, ${plan.sections.filter(move => move.closes).length} sezioni chiuse`;
  party.history = [...(party.history ?? []), { week, date, text: `Fusione con ${plan.label} sciolta`, source: SIM }];
  if (party.life) party.life.history = [{ week, kind: 'separazione', text: summary, source: SIM }, ...(party.life.history ?? [])].slice(0, 40);
  const returned = { members: plan.members, sections: plan.sections.length, closed: closed.size, militants: plan.militants, cadres: plan.cadres, cash: plan.cash, baseline: plan.baseline, groups: plan.groups.length };
  const record = { status: 'sciolta', dissolvedAt: date, dissolvedWeek: week, returned, missing: plan.missing };
  party.mergers = plan.legacy ? [...(party.mergers ?? []), { id: plan.id, forceId: plan.forceId, label: plan.label, date: plan.date, legacy: true, ...record }] : (party.mergers ?? []).map(entry => entry.id === plan.id ? { ...entry, ...record } : entry);
  remember(game, { date, kind: 'fusione', text: `Fusione con ${plan.label} sciolta`, weight: 1 });
  game.log = [{ id: `diario-${week}-separazione-${plan.forceId}`.slice(0, 80), week, date, kind: 'partito', title: `Fusione con ${plan.label} sciolta`, lines: [summary, ...plan.recovered.slice(0, 3)], tone: 'neutral', source: SIM }, ...(game.log ?? [])].slice(0, 40);
  // the political world: the partner is a force again, with its share of the consensus; the relations cool down
  const own = ownForceOf(world), partner = world.parties.find(entry => entry.id === plan.forceId);
  own.baseline = round2(Math.max(0.1, own.baseline - plan.baseline)); partner.baseline = plan.baseline;
  own.anchor = round2(Math.max(0.1, (own.anchor ?? own.baseline) - plan.anchor)); partner.anchor = plan.anchor;
  if (plan.worldIdentity) for (const [key, value] of Object.entries(plan.worldIdentity)) if (value !== undefined && value !== null) own[key] = value;
  partner.active = true;
  partner.pastMergers = [...(partner.pastMergers ?? []), { into: own.id, mergedAt: partner.mergedEvidence?.date ?? plan.date, dissolvedAt: date }].slice(-4);
  delete partner.mergedInto; delete partner.mergedEvidence;
  if (partner.presence) partner.presence = { ...partner.presence, since: world.week };
  const key = tieKey(own.id, partner.id);
  world.ties[key] = clamp((world.ties[key] ?? 0) - 20, -100, 100);
  world.effects = (world.effects ?? []).filter(effect => !(effect.cause === 'fusione' && effect.partyId === own.id));
  world.events = [{ id: `cronaca-${world.week}-separazione-${partner.id}`, week: world.week, date, kind: 'scissione', icon: 'unlink', scope: 'nazionale', title: `${partner.label} torna autonomo`, body: `Sciolta la fusione con ${own.label}: ${partner.label} riparte come partito a sé, con una parte di iscritti, consenso e struttura (simulazione).`, tone: 'neutral', lines: [], source: SIM, partyId: own.id }, ...(world.events ?? [])].slice(0, 40);
  // the record of the player's party: the identity of before, and the merger marked as dissolved in its history
  if (dataset.parties) dataset.parties = dataset.parties.map(entry => {
    if (entry.id !== state.career?.partyId) return entry;
    const mergers = (entry.mergers ?? []).map(row => row.partnerId === plan.forceId && !row.dissolvedAt ? { ...row, dissolvedAt: date } : row);
    const back = plan.identity && entry.source === 'user' ? { name: plan.identity.label, officialName: plan.identity.label, abbreviation: plan.identity.abbreviation ?? entry.abbreviation, color: plan.identity.color ?? entry.color, color2: plan.identity.color2 ?? entry.color2, logo: plan.identity.logo ?? entry.logo, logoAlt: `Logo di ${plan.identity.label}` } : {};
    return { ...entry, ...back, mergers };
  });
  let next = { ...state, game, world, dataset };
  // the Parliament keeps its own copy of the political capital (the store syncs it the same way, withCapital): the cost of the dissolution must reach it too
  if (state.parliament) {
    const groups = new Set(plan.groups);
    const parliament = { ...state.parliament, resources: { ...(state.parliament.resources ?? {}), politicalCapital: game.resources.politicalCapital }, chambers: Object.fromEntries(Object.entries(state.parliament.chambers).map(([chamber, value]) => [chamber, { ...value, groups: (value.groups ?? []).map(group => groups.has(group.groupId) ? { ...group, partyId: plan.forceId } : group) }])) };
    next = api.computeParliamentUpdate(next, parliament, next.ui?.toast);
  }
  next = api.addTimeline(next, [{ kind: 'partito', title: `Fusione con ${plan.label} sciolta`, detail: summary, tone: 'neutral' }]);
  return { ...next, ui: { ...next.ui, toast: `${plan.label} torna un partito autonomo` } };
}
