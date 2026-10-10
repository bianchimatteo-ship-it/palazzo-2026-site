// The end of a career and what it leaves. A career concludes when the player leaves politics (retirement) or goes
// into retirement at the end of a long life of service; its political legacy is weighed on what really happened (the
// offices held, the mandates won, the laws, the goals reached, the party led, the reputation and the memory it leaves)
// and recorded in the Hall of Fame, which belongs to the player and outlives every career. A new career may start from
// the legacy of a concluded one: a bounded set of starting conditions (a known name, a network, a shadow), never a
// change to the world of the game. Pure functions over plain data. Everything is simulated.
import { memoryBalance } from './career-engine.js?v=20261010-2';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;

export const HALL_LIMIT = 40;
export const RETIREMENT = Object.freeze({ minAge: 65, minYears: 25 });
export const END_KINDS = Object.freeze({
  ritiro: { label: 'Ha lasciato la politica', reason: 'Hai lasciato la politica', bonus: 0 },
  pensionamento: { label: 'È andato in pensione', reason: 'Sei andato in pensione', bonus: 4 }
});
export const LEGACY_TIERS = Object.freeze([
  { id: 'comparsa', min: 0, label: 'Una comparsa', text: 'Una breve apparizione sulla scena politica.' },
  { id: 'mestiere', min: 20, label: 'Politico di mestiere', text: 'Anni di lavoro e un posto nelle istituzioni.' },
  { id: 'rilievo', min: 40, label: 'Figura di rilievo', text: 'Un nome che conta nel suo partito e nel suo territorio.' },
  { id: 'protagonista', min: 60, label: 'Protagonista di una stagione', text: 'Ha segnato un periodo della vita politica.' },
  { id: 'statista', min: 80, label: 'Statista', text: 'Una carriera che la storia politica ricorda.' }
]);
export const tierOf = score => [...LEGACY_TIERS].reverse().find(item => score >= item.min) ?? LEGACY_TIERS[0];

// The offices of Italian politics, ranked by weight (a title is matched by its words).
const OFFICE_RANKS = Object.freeze([
  { test: /presidente della repubblica/i, value: 100, label: 'Presidente della Repubblica' },
  { test: /presidente del consiglio/i, value: 90, label: 'Presidente del Consiglio' },
  { test: /ministro/i, value: 75, label: 'Ministro' },
  { test: /^(deputato|senatore)(?! al parlamento europeo)/i, value: 70, label: 'Deputato o senatore' },
  { test: /parlamento europeo/i, value: 68, label: 'Eurodeputato' },
  { test: /presidente (di|della) regione/i, value: 62, label: 'Presidente di Regione' },
  { test: /^sindaco/i, value: 55, label: 'Sindaco' },
  { test: /assessore regionale/i, value: 50, label: 'Assessore regionale' },
  { test: /consigliere regionale/i, value: 48, label: 'Consigliere regionale' },
  { test: /assessore comunale/i, value: 40, label: 'Assessore comunale' },
  { test: /consigliere comunale/i, value: 38, label: 'Consigliere comunale' }
]);
const rankOfOffice = title => OFFICE_RANKS.find(item => item.test.test(title ?? '')) ?? null;
const weeksBetween = (from, to) => Math.max(0, Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 604800000));
const ageOn = (birthDate, date) => /^\d{4}-\d{2}-\d{2}$/.test(birthDate ?? '') ? Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (date.slice(5) < birthDate.slice(5) ? 1 : 0) : null;

// ---------- the facts of a career ----------
export function careerFacts(state) {
  const game = state.game;
  const career = state.career;
  const player = state.dataset.politicians.find(item => item.id === career.playerId) ?? null;
  const date = game?.endedAt ?? state.clock.currentDate;
  const stats = Object.fromEntries(state.dataset.statistics.filter(item => item.subjectId === career.playerId).map(item => [item.metric, item.value]));
  const offices = state.dataset.offices.filter(item => item.politicianId === career.playerId && item.level !== 'partito');
  const ranked = offices.map(office => ({ office, rank: rankOfOffice(office.title) })).filter(item => item.rank);
  const peak = ranked.sort((a, b) => b.rank.value - a.rank.value)[0] ?? null;
  const levels = new Set(ranked.map(item => item.rank.label));
  const memory = memoryBalance(game);
  const party = game?.party ?? null;
  const rank = party ? (party.affiliation === 'founder' ? 5 : party.rank ?? 0) : 0;
  const incumbent = state.presidency?.incumbent;
  const president = Boolean(game?.flags?.president || game?.flags?.exPresident || ranked.some(item => /presidente della repubblica/i.test(item.office.title)));
  const objectives = Object.values(game?.objectives ?? {}).filter(item => !item.silent).length;
  const record = game?.record ?? {};
  return {
    name: player?.displayName ?? 'Il politico', birthDate: player?.birthDate ?? null,
    weeks: game?.week?.index ?? 0, years: round1((game?.week?.index ?? 0) / 52), startedAt: career.startedAt, endedAt: date,
    level: career.initialLevel, difficulty: career.difficulty ?? 'normale', startProfile: career.startProfile ?? 'ordinaria', custom: career.startProfile === 'personalizzato', heir: Boolean(career.legacyFrom),
    peak: peak ? { label: peak.rank.label, value: peak.rank.value, title: peak.office.title } : null, distinctOffices: levels.size,
    offices: ranked.map(item => ({ title: item.office.title, from: item.office.startDate ?? null, to: item.office.endDate ?? null })).slice(-10),
    mandates: (career.electionHistory ?? []).filter(item => item.personalMandate).length, campaigns: (career.electionHistory ?? []).length,
    laws: (state.parliament?.laws ?? []).filter(law => law.stage === 'approved' && !law.sponsor).length,
    objectives, party: party ? { label: party.label ?? null, rank, rankTitle: party.rankTitle ?? null, founded: party.affiliation === 'founder' } : null,
    pastParties: (game?.pastParties ?? []).length,
    stats: { reputation: stats.reputation ?? 50, popularity: stats.popularity ?? 45, influence: stats.influence ?? 30, notoriety: stats.notoriety ?? 20, experience: stats.experience ?? 30 },
    memory: { good: round1(memory.good), bad: round1(memory.bad), net: round1(memory.net) },
    scandals: (game?.memory ?? []).filter(item => item.kind === 'scandalo').length, setbacks: (game?.setbacks ?? []).length,
    president: president ? { sitting: Boolean(game?.flags?.president), credit: Math.round(incumbent?.kind === 'giocatore' ? incumbent.credit ?? 0 : 0) } : null,
    ambitions: { kept: record.ambitions?.kept ?? 0, broken: record.ambitions?.broken ?? 0 }, decisions: record.decisions?.made ?? 0,
    age: ageOn(player?.birthDate, date), source: SIM
  };
}

// ---------- the legacy: a score from 0 to 100, with its reasons ----------
export function legacyScore(facts, kind = null) {
  const parts = [];
  const add = (label, points) => { if (Math.abs(points) >= 0.05) parts.push({ label, points: round1(points) }); };
  add('Anni di carriera', Math.min(14, facts.years * 0.7));
  // A high office counts for what it lasted: a few weeks in a seat do not make a career.
  if (facts.peak) add(`Carica più alta: ${facts.peak.label}`, facts.peak.value * 0.26 * clamp(0.35 + facts.years / 10, 0.35, 1));
  add('Cariche diverse ricoperte', Math.min(6, Math.max(0, facts.distinctOffices - 1) * 2));
  add('Mandati conquistati', Math.min(10, facts.mandates * 2.5));
  add('Leggi approvate', Math.min(8, facts.laws * 2));
  add('Obiettivi raggiunti', Math.min(10, facts.objectives * 0.6));
  if (facts.party) { if (facts.party.founded) add('Ha fondato e guidato un partito', 8); else if (facts.party.rank >= 5) add('Ha guidato il partito', 6); else if (facts.party.rank >= 3) add('Dirigente nazionale', 3); }
  add('Reputazione', clamp((facts.stats.reputation - 50) * 0.12, -5, 6));
  add('Memoria politica', clamp(facts.memory.net, -5, 5));
  add('Parola data', clamp(Math.min(4, facts.ambitions.kept) - facts.ambitions.broken * 1.5, -4, 4));
  if (facts.president) add('Anni al Quirinale', clamp((facts.president.credit ?? 0) * 0.06, 0, 6));
  add('Cadute e ritorni', -Math.min(9, facts.setbacks * 3));
  add('Scandali', -Math.min(6, facts.scandals * 1.5));
  if (kind && END_KINDS[kind]?.bonus) add('Un congedo dignitoso', END_KINDS[kind].bonus);
  const raw = parts.reduce((sum, item) => sum + item.points, 0);
  const factor = (facts.custom ? 0.85 : 1) * ({ facile: 0.9, normale: 1, difficile: 1.12 }[facts.difficulty] ?? 1);
  if (factor !== 1) add(`${facts.custom ? 'Scenario personalizzato' : 'Difficoltà'} (${Math.round(factor * 100)}%)`, raw * factor - raw);
  const score = Math.round(clamp(parts.reduce((sum, item) => sum + item.points, 0)));
  return { score, tier: tierOf(score), parts };
}

// What the career is remembered for.
export function legacyTags(facts) {
  const tags = [];
  if (facts.president) tags.push(facts.president.sitting ? 'Presidente della Repubblica in carica' : 'Ha servito al Quirinale');
  if (facts.peak?.label === 'Presidente del Consiglio') tags.push('Ha guidato il governo');
  else if (facts.peak?.label === 'Ministro') tags.push('Ha governato come ministro');
  if (facts.party?.founded) tags.push('Ha fondato un partito'); else if (facts.party?.rank >= 5) tags.push('Ha guidato un partito');
  if (facts.mandates >= 3) tags.push('Rieletto più volte');
  if (facts.laws >= 1) tags.push('Autore di leggi');
  if (facts.ambitions.kept >= 1 && facts.ambitions.broken === 0) tags.push('Ha mantenuto la parola data');
  if (facts.setbacks) tags.push('Caduto e risalito');
  if (facts.scandals >= 2) tags.push('Segnato dagli scandali');
  if (facts.startProfile === 'outsider') tags.push('Partito da outsider');
  if (facts.custom) tags.push('Scenario personalizzato');
  if (facts.heir) tags.push('Erede di una carriera conclusa');
  if (facts.pastParties >= 2) tags.push('Ha cambiato più partiti');
  return tags;
}

// ---------- the Hall of Fame ----------
export function hallEntry(state, kind) {
  const facts = careerFacts(state);
  const legacy = legacyScore(facts, kind);
  const tags = legacyTags(facts);
  return {
    id: `hall-${state.career.id}`, careerId: state.career.id, name: facts.name, kind, endLabel: END_KINDS[kind]?.label ?? 'Ha concluso la carriera',
    startedAt: facts.startedAt, endedAt: facts.endedAt, weeks: facts.weeks, years: facts.years, age: facts.age,
    level: facts.level, difficulty: facts.difficulty, startProfile: facts.startProfile, custom: facts.custom,
    peak: facts.peak, offices: facts.offices, party: facts.party, pastParties: facts.pastParties,
    counts: { mandates: facts.mandates, campaigns: facts.campaigns, laws: facts.laws, objectives: facts.objectives, scandals: facts.scandals, setbacks: facts.setbacks, decisions: facts.decisions, ambitionsKept: facts.ambitions.kept, ambitionsBroken: facts.ambitions.broken },
    stats: facts.stats, memory: facts.memory, president: facts.president,
    score: legacy.score, tier: { id: legacy.tier.id, label: legacy.tier.label }, parts: legacy.parts, tags,
    summary: `${facts.name}: ${facts.peak?.label ?? 'nessuna carica'} · ${facts.years} ${facts.years === 1 ? 'anno' : 'anni'} di carriera · ${legacy.tier.label} (${legacy.score}/100)`,
    source: SIM
  };
}
// The list as the page shows it: the best careers first.
export const sortedHall = entries => [...(entries ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || String(b.endedAt).localeCompare(String(a.endedAt)));
export function addToHall(entries, entry) {
  const others = (entries ?? []).filter(item => item.id !== entry.id);
  return sortedHall([...others, entry]).slice(0, HALL_LIMIT);
}

// ---------- what a legacy gives a new career (bounded: a name, a network, a shadow) ----------
export const LEGACY_MAX_FREE = 3;
export function legacyBoon(entry) {
  if (!entry) return null;
  const score = entry.score ?? 0;
  const levels = {};
  if (score >= 20) levels.rete = 1;
  if (score >= 40) levels.notorieta = 1;
  if (score >= 60) { levels.capitale = 1; levels.risorse = 1; }
  if (score >= 80) { levels.rete = 2; levels.notorieta = 2; }
  const burden = {};
  if ((entry.counts?.scandals ?? 0) >= 2 || ((entry.counts?.setbacks ?? 0) >= 1 && score < 40)) burden.precedenti = 1;
  if ((entry.counts?.ambitionsBroken ?? 0) >= 2) burden.aspettative = 1;
  const free = { ...levels, ...burden };
  return { id: entry.id, name: entry.name, score, tier: entry.tier?.label ?? tierOf(score).label, levels, burden, free };
}
export function boonLines(boon, leverLabel) {
  if (!boon) return [];
  const lines = Object.entries(boon.levels).map(([id, level]) => `${leverLabel(id)} +${level}`);
  const shadows = Object.entries(boon.burden).map(([id, level]) => `${leverLabel(id)} +${level}`);
  return [...(lines.length ? [`Dal nome che porti: ${lines.join(', ')}`] : ['Un nome che non pesa né aiuta']), ...(shadows.length ? [`Ma anche: ${shadows.join(', ')}`] : [])];
}

// ---------- retirement ----------
export function retirementProblem(state, kind) {
  if (!END_KINDS[kind]) return 'Scelta non valida.';
  const game = state.game;
  if (!game || game.status === 'ended') return 'La carriera è già conclusa.';
  if (state.campaign?.status === 'active') return 'Concludi la campagna in corso prima di lasciare.';
  if (game.flags?.president) return 'Il Presidente della Repubblica si dimette dal Quirinale (sezione Elezioni → Quirinale) prima di lasciare.';
  const election = state.presidency?.election;
  if (election && election.phase !== 'conclusa' && ['candidato', 'leader'].includes(election.player?.role)) return 'Sei coinvolto nell’elezione del Presidente della Repubblica: attendi che si concluda.';
  if (kind === 'pensionamento') {
    const facts = careerFacts(state);
    const eligible = (facts.age !== null && facts.age >= RETIREMENT.minAge) || facts.years >= RETIREMENT.minYears || Boolean(game.flags?.exPresident);
    if (!eligible) return `Il pensionamento si sceglie a ${RETIREMENT.minAge} anni, dopo ${RETIREMENT.minYears} anni di carriera o da ex Presidente della Repubblica: prima puoi solo lasciare la politica.`;
  }
  return null;
}
