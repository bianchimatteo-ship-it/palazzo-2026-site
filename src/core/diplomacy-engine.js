// Diplomacy and the European Union, as part of the national simulation. It is simulation (the countries are real names, every number is the game's own): relations are not a number to change at will
// but a history — trust built and broken, tension that builds up and fades, treaties that bind for years and have to be ratified, crises that open, last and close, summits that ask for a line.
// What it touches in the rest of the game, week after week: the economy (growth, inflation, deficit), the mood of the citizens, the stability of the Government, the standing in the Union (which
// the European funds and the spread read).
//
// Who can do what: the Prime Minister (the player when he leads the Government, otherwise the simulated one) negotiates, goes to the summits and answers the crises; the President of the Republic
// receives, ratifies (or delays, or refuses) the treaties and holds state visits; anyone else follows. Everything here is pure: the store passes the state and gets it back with the effects.
import { DATA_SOURCES } from '../data/schema.js?v=20261110-20';

const SIM = DATA_SOURCES.SIMULATION;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const r1 = value => Math.round(value * 10) / 10;
const hashOf = text => { let h = 2166136261 >>> 0; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const unit = text => hashOf(text) / 4294967296;

export const COUNTRIES = Object.freeze([
  { id: 'francia', label: 'Francia', bloc: 'ue', base: 62, interests: ['commercio', 'difesa', 'energia'] },
  { id: 'germania', label: 'Germania', bloc: 'ue', base: 64, interests: ['commercio', 'finanze', 'industria'] },
  { id: 'spagna', label: 'Spagna', bloc: 'ue', base: 60, interests: ['migrazioni', 'commercio'] },
  { id: 'polonia', label: 'Polonia', bloc: 'ue', base: 48, interests: ['difesa', 'energia'] },
  { id: 'stati-uniti', label: 'Stati Uniti', bloc: 'alleato', base: 66, interests: ['difesa', 'commercio'] },
  { id: 'regno-unito', label: 'Regno Unito', bloc: 'alleato', base: 58, interests: ['commercio', 'finanze'] },
  { id: 'turchia', label: 'Turchia', bloc: 'partner', base: 44, interests: ['migrazioni', 'energia', 'difesa'] },
  { id: 'cina', label: 'Cina', bloc: 'partner', base: 42, interests: ['commercio', 'industria'] },
  { id: 'libia', label: 'Libia', bloc: 'vicino', base: 40, interests: ['energia', 'migrazioni'] },
  { id: 'egitto', label: 'Egitto', bloc: 'vicino', base: 46, interests: ['energia', 'sicurezza'] }
]);
export const BLOC_LABELS = Object.freeze({ ue: 'Unione europea', alleato: 'Alleato', partner: 'Partner', vicino: 'Vicinato del Mediterraneo' });
const COUNTRY_BY_ID = Object.freeze(Object.fromEntries(COUNTRIES.map(item => [item.id, item])));

// What a treaty is worth, per week, while it lasts (deltas on the economy and the mood; the scale of a «media» treaty), and what it asks.
export const TREATY_TYPES = Object.freeze({
  commerciale: { label: 'Accordo commerciale', interest: 'commercio', weeks: 156, effect: { growth: 0.012, satisfaction: 0.04 }, detail: 'Più export e investimenti: la crescita ne guadagna, i settori protetti protestano.' },
  energia: { label: 'Accordo sull’energia', interest: 'energia', weeks: 130, effect: { inflation: -0.012, growth: 0.006 }, detail: 'Forniture più sicure: il costo dell’energia cala, ma si dipende da un partner.' },
  migrazioni: { label: 'Intesa sulle migrazioni', interest: 'migrazioni', weeks: 104, effect: { satisfaction: 0.07, stability: 0.03 }, detail: 'Meno pressione sui confini: l’opinione approva, i diritti umani no.' },
  difesa: { label: 'Cooperazione nella difesa', interest: 'difesa', weeks: 156, effect: { satisfaction: 0.03, deficit: 0.004 }, detail: 'Più sicurezza condivisa e commesse, con un costo per il bilancio.' },
  finanza: { label: 'Intesa finanziaria', interest: 'finanze', weeks: 104, effect: { spread: -0.35, deficit: -0.004 }, detail: 'Fiducia dei mercati e conti più leggeri.' }
});
// Crises: what they cost per week while open and which answers exist. Severity 1..3.
export const CRISIS_KINDS = Object.freeze({
  energia: { label: 'Crisi energetica', interest: 'energia', cost: { inflation: 0.03, growth: -0.02, satisfaction: -0.06 }, detail: 'Forniture a rischio e prezzi in salita.' },
  migrazioni: { label: 'Pressione migratoria', interest: 'migrazioni', cost: { satisfaction: -0.09, stability: -0.05 }, detail: 'Sbarchi in aumento e tensione nei territori.' },
  commercio: { label: 'Disputa commerciale', interest: 'commercio', cost: { growth: -0.03, satisfaction: -0.03 }, detail: 'Dazi e ritorsioni sulle esportazioni.' },
  sicurezza: { label: 'Tensione di sicurezza', interest: 'difesa', cost: { satisfaction: -0.05, deficit: 0.006 }, detail: 'Un’escalation nel Mediterraneo allarga le spese e la paura.' },
  bilancio: { label: 'Scontro sul bilancio europeo', interest: 'finanze', cost: { spread: 0.5, satisfaction: -0.03 }, detail: 'Bruxelles contesta i conti: i mercati guardano lo spread.' }
});
export const CRISIS_ANSWERS = Object.freeze({ mediare: { label: 'Mediare', detail: 'Si lavora con tutti: lento, ma lascia buoni rapporti.' }, schierarsi: { label: 'Schierarsi', detail: 'Scegli un campo: risolve prima, ma lascia una ferita.' }, attendere: { label: 'Attendere', detail: 'Non esporsi: il problema resta e pesa.' } });
export const SUMMIT_STANCES = Object.freeze({ allineamento: { label: 'Allinearsi alla linea comune', detail: 'Peso nell’Unione e fondi più tranquilli; i sovranisti protestano.' }, negoziato: { label: 'Negoziare le condizioni', detail: 'Si ottiene qualcosa in cambio di qualcosa: esito incerto.' }, veto: { label: 'Mettere il veto', detail: 'Applausi in patria, freddezza a Bruxelles e rischi per i fondi.' } });
export const STANCES = Object.freeze({ concedi: { label: 'Concedi', detail: 'Sposti la posizione verso l’accordo, ma l’accordo vale meno.' }, tieni: { label: 'Tieni la linea', detail: 'Avanzi piano senza costi.' }, minaccia: { label: 'Alza la pressione', detail: 'Può forzare l’accordo se il rapporto è buono; altrimenti inasprisce.' } });
export const DIPLOMACY_RULES = Object.freeze({ rounds: 3, needed: 60, capital: 2, crisisChance: 0.03, summitEvery: 13, ratifyWeeks: 4, drift: 0.15, source: SIM });

// ---------- state ----------
export function createDiplomacy({ date, week = 0, seed = '' } = {}) {
  const countries = Object.fromEntries(COUNTRIES.map(item => [item.id, { relation: clamp(item.base + Math.round((unit(`${seed}|${item.id}|rel`) - 0.5) * 8), 10, 90), trust: 50 + Math.round((unit(`${seed}|${item.id}|trust`) - 0.5) * 10), tension: 0, history: [], lastContact: null }]));
  return { version: 1, source: SIM, createdAt: date, week, countries, eu: { standing: 55, conditionality: 0 }, treaties: [], negotiations: [], summits: [], crises: [], log: [] };
}
const normalize = diplomacy => diplomacy && diplomacy.version === 1 ? diplomacy : null;
// (the log keeps its last 40 lines: its length stops growing, so the id carries a counter that never repeats within the log)
const note = (diplomacy, date, text, kind = 'diplomazia') => {
  const used = new Set(diplomacy.log.map(item => item.id));
  let n = diplomacy.log.length;
  while (used.has(`dipl-${diplomacy.week}-${n}`)) n++;
  return { ...diplomacy, log: [{ id: `dipl-${diplomacy.week}-${n}`, date, week: diplomacy.week, kind, text }, ...diplomacy.log].slice(0, 40) };
};
const touch = (diplomacy, countryId, patch, text, date) => {
  const country = diplomacy.countries[countryId];
  if (!country) return diplomacy;
  const next = { ...country, relation: clamp(r1(country.relation + (patch.relation ?? 0)), 0, 100), trust: clamp(r1(country.trust + (patch.trust ?? 0)), 0, 100), tension: clamp(r1(country.tension + (patch.tension ?? 0)), 0, 100), lastContact: date, history: [...country.history, ...(text ? [{ date, text }] : [])].slice(-6) };
  return { ...diplomacy, countries: { ...diplomacy.countries, [countryId]: next } };
};
export const countryOf = id => COUNTRY_BY_ID[id] ?? null;
const ZERO = () => ({ growth: 0, inflation: 0, deficit: 0, satisfaction: 0, stability: 0, spread: 0 });
const addEffects = (total, effect, scale = 1) => { for (const [key, value] of Object.entries(effect ?? {})) total[key] = (total[key] ?? 0) + value * scale; return total; };

// ---------- the weekly life ----------
export function advanceDiplomacy(input, { date, week = 0, rand = Math.random, playerPremier = false, playerPresident = false, stability = 50 } = {}) {
  let d = normalize(input);
  const lines = [];
  const effects = ZERO();
  if (!d) return { diplomacy: input, lines, effects };
  d = { ...d, week };
  // 1. the relations drift back to what they were, the tension fades, trust is rebuilt slowly
  d = { ...d, countries: Object.fromEntries(Object.entries(d.countries).map(([id, c]) => { const base = COUNTRY_BY_ID[id]?.base ?? 50; return [id, { ...c, relation: r1(c.relation + (base - c.relation) * 0.01 * DIPLOMACY_RULES.drift * 10 / 10), tension: r1(Math.max(0, c.tension - 0.4)), trust: r1(clamp(c.trust + 0.1, 0, 100)) }]; })) };
  // 2. the treaties in force bind: they pay every week (scaled by how much was conceded), expire, and a broken one stays broken
  d = { ...d, treaties: d.treaties.map(treaty => {
    if (treaty.status === 'firmato' && week - treaty.signedWeek >= DIPLOMACY_RULES.ratifyWeeks) {
      const ok = playerPresident ? false : (stability >= 35 || rand() < 0.5);
      if (ok) { lines.push(`Ratificato: ${treaty.label} con ${COUNTRY_BY_ID[treaty.countryId]?.label}.`); return { ...treaty, status: 'ratificato', ratifiedWeek: week }; }
    }
    if (treaty.status === 'ratificato' && week >= treaty.endsWeek) { lines.push(`Scade: ${treaty.label} con ${COUNTRY_BY_ID[treaty.countryId]?.label}.`); return { ...treaty, status: 'scaduto' }; }
    return treaty;
  }) };
  for (const treaty of d.treaties.filter(item => item.status === 'ratificato')) addEffects(effects, TREATY_TYPES[treaty.type]?.effect, treaty.value ?? 1);
  // 3. the crises open (by chance, more where the tension is), cost every week while they last, and wear out
  for (const crisis of d.crises.filter(item => item.status === 'aperta')) addEffects(effects, CRISIS_KINDS[crisis.kind]?.cost, crisis.severity);
  if (!d.crises.some(item => item.status === 'aperta') && rand() < DIPLOMACY_RULES.crisisChance + Math.max(0, Object.values(d.countries).reduce((sum, c) => sum + c.tension, 0) / 4000)) {
    const kinds = Object.keys(CRISIS_KINDS), kind = kinds[Math.floor(rand() * kinds.length)];
    const interest = CRISIS_KINDS[kind].interest;
    const involved = COUNTRIES.filter(item => item.interests.includes(interest)).sort((a, b) => unit(`${date}|${a.id}`) - unit(`${date}|${b.id}`)).slice(0, 2).map(item => item.id);
    const crisis = { id: `crisi-${week}-${kind}`, kind, countries: involved, severity: 1 + Math.floor(rand() * 3), openedWeek: week, status: 'aperta', answer: null, expiresWeek: week + 10 };
    d = { ...d, crises: [...d.crises, crisis].slice(-8) };
    lines.push(`Crisi internazionale: ${CRISIS_KINDS[kind].label.toLowerCase()} (${involved.map(id => COUNTRY_BY_ID[id].label).join(', ')}).`);
    d = note(d, date, `${CRISIS_KINDS[kind].label}: ${CRISIS_KINDS[kind].detail}`, 'crisi');
    for (const id of involved) d = touch(d, id, { tension: 4 }, `Crisi: ${CRISIS_KINDS[kind].label.toLowerCase()}`, date);
  }
  for (const crisis of d.crises.filter(item => item.status === 'aperta')) {
    const mine = playerPremier;
    // a crisis the Prime Minister does not answer wears out by itself, badly; a simulated Prime Minister answers it with the same rules
    if (!mine && !crisis.answer && week - crisis.openedWeek >= 2) d = answerCrisis(d, crisis.id, ['mediare', 'mediare', 'schierarsi', 'attendere'][Math.floor(rand() * 4)], { date, week, rand, auto: true }).diplomacy;
    else if (week >= crisis.expiresWeek) {
      d = { ...d, crises: d.crises.map(item => item.id === crisis.id ? { ...item, status: 'chiusa', outcome: 'esaurita senza una risposta' } : item) };
      lines.push(`La crisi (${CRISIS_KINDS[crisis.kind].label.toLowerCase()}) si esaurisce senza una risposta del governo.`);
      for (const id of crisis.countries) d = touch(d, id, { trust: -3 }, 'Il governo non ha risposto alla crisi', date);
      d = { ...d, eu: { ...d.eu, standing: clamp(d.eu.standing - 1, 0, 100) } };
    }
  }
  // 4. the summits come on schedule
  if (!d.summits.some(item => item.status === 'in-arrivo') && week > 0 && week % DIPLOMACY_RULES.summitEvery === 0) {
    const topics = ['Bilancio europeo', 'Migrazioni', 'Energia', 'Difesa comune', 'Patto di stabilità', 'Commercio'];
    const topic = topics[Math.floor(rand() * topics.length)];
    d = { ...d, summits: [...d.summits, { id: `vertice-${week}`, kind: 'consiglio-europeo', label: 'Consiglio europeo', topic, week, status: 'in-arrivo', stance: null }].slice(-8) };
    lines.push(`Consiglio europeo: sul tavolo ${topic.toLowerCase()}.`);
    if (!playerPremier) d = decideSummit(d, `vertice-${week}`, ['allineamento', 'allineamento', 'negoziato', 'veto'][Math.floor(rand() * 4)], { date, week, rand, auto: true }).diplomacy;
  } else {
    const open = d.summits.find(item => item.status === 'in-arrivo');
    if (open && playerPremier && week - open.week >= 3) d = decideSummit(d, open.id, 'negoziato', { date, week, rand, auto: true, lapsed: true }).diplomacy;
  }
  // 5. the simulated Prime Minister opens a negotiation now and then
  if (!playerPremier && d.negotiations.every(item => item.status !== 'aperta') && rand() < 0.03) {
    const country = COUNTRIES[Math.floor(rand() * COUNTRIES.length)];
    const type = Object.entries(TREATY_TYPES).find(([, spec]) => country.interests.includes(spec.interest))?.[0];
    if (type) { let opened = null; try { opened = openNegotiation(d, { type, countryId: country.id }, { date, week, auto: true }); } catch { /* a treaty already in force, or relations too cold: the table does not open */ }
      if (opened) { d = opened.diplomacy; let out = d; for (let i = 0; i < DIPLOMACY_RULES.rounds; i++) { const id = out.negotiations.at(-1).id; if (out.negotiations.at(-1).status !== 'aperta') break; out = negotiate(out, id, ['concedi', 'tieni', 'tieni', 'minaccia'][Math.floor(rand() * 4)], { date, week, rand, auto: true }).diplomacy; } d = out; lines.push(`Il governo (simulato) tratta con ${country.label}: ${TREATY_TYPES[type].label.toLowerCase()}.`); } }
  }
  d = { ...d, eu: { ...d.eu, standing: clamp(r1(d.eu.standing + (55 - d.eu.standing) * 0.01), 0, 100) } };
  if (effects.spread !== 0 || d.eu.standing < 40) effects.spread += (50 - d.eu.standing) / 90 * 0.2;
  return { diplomacy: d, lines, effects };
}

// ---------- the actions ----------
export function openNegotiation(input, { type, countryId }, { date, week = 0, auto = false } = {}) {
  const d = normalize(input);
  if (!d) throw new Error('La diplomazia non è ancora attiva.');
  const spec = TREATY_TYPES[type], country = COUNTRY_BY_ID[countryId];
  if (!spec) throw new Error('Scegli che cosa negoziare.');
  if (!country) throw new Error('Scegli il Paese con cui trattare.');
  if (d.negotiations.some(item => item.status === 'aperta')) throw new Error('C’è già un negoziato aperto: concludilo prima.');
  if (d.treaties.some(item => item.countryId === countryId && item.type === type && ['firmato', 'ratificato'].includes(item.status))) throw new Error(`Hai già ${spec.label.toLowerCase()} con ${country.label}.`);
  const c = d.countries[countryId];
  if (c.relation < 25) throw new Error(`I rapporti con ${country.label} sono troppo freddi per sedersi a trattare.`);
  const aligned = country.interests.includes(spec.interest);
  const negotiation = { id: `negoziato-${week}-${countryId}-${type}`, type, countryId, openedWeek: week, round: 0, position: Math.round(clamp(25 + (c.relation - 50) * 0.5 + (aligned ? 12 : -8) + (c.trust - 50) * 0.2, 5, 70)), concessions: 0, status: 'aperta', history: [] };
  return { diplomacy: note({ ...d, negotiations: [...d.negotiations, negotiation].slice(-8) }, date, `Si apre il negoziato con ${country.label}: ${spec.label.toLowerCase()}.`), negotiation };
}
export function negotiate(input, id, stance, { date, week = 0, rand = Math.random, auto = false } = {}) {
  const d = normalize(input);
  const negotiation = d?.negotiations.find(item => item.id === id && item.status === 'aperta');
  if (!negotiation) throw new Error('Questo negoziato non è più aperto.');
  if (!STANCES[stance]) throw new Error('Scegli come condurre il round.');
  const country = COUNTRY_BY_ID[negotiation.countryId], c = d.countries[negotiation.countryId], spec = TREATY_TYPES[negotiation.type];
  const noise = (rand() - 0.5) * 8;
  let gain = stance === 'concedi' ? 16 : stance === 'tieni' ? 6 : (c.relation >= 55 && c.trust >= 45 ? 20 : -12);
  gain += (c.trust - 50) * 0.12 + noise;
  let next = { ...negotiation, round: negotiation.round + 1, position: Math.round(clamp(negotiation.position + gain, 0, 100)), concessions: negotiation.concessions + (stance === 'concedi' ? 1 : 0), history: [...negotiation.history, { round: negotiation.round + 1, stance, position: Math.round(clamp(negotiation.position + gain, 0, 100)) }] };
  let out = d;
  if (stance === 'minaccia' && gain < 0) out = touch(out, negotiation.countryId, { relation: -3, tension: 5 }, 'Pressione respinta al tavolo', date);
  let treaty = null;
  if (next.position >= DIPLOMACY_RULES.needed) {
    next = { ...next, status: 'conclusa' };
    const value = clamp(1 - next.concessions * 0.18, 0.4, 1);
    treaty = { id: `trattato-${week}-${negotiation.countryId}-${negotiation.type}`, type: negotiation.type, label: spec.label, countryId: negotiation.countryId, signedWeek: week, endsWeek: week + spec.weeks, status: 'firmato', value: r1(value) };
    out = touch(out, negotiation.countryId, { relation: 6, trust: 6 }, `Firmato: ${spec.label.toLowerCase()}`, date);
    out = { ...out, treaties: [...out.treaties, treaty].slice(-16) };
    out = note(out, date, `Firmato ${spec.label.toLowerCase()} con ${country.label}${next.concessions ? ` (con ${next.concessions} concessioni: vale ${Math.round(value * 100)}%)` : ''}. Va ratificato.`, 'trattato');
  } else if (next.round >= DIPLOMACY_RULES.rounds) {
    next = { ...next, status: 'fallita' };
    out = touch(out, negotiation.countryId, { relation: -3, trust: -2 }, `Negoziato fallito: ${spec.label.toLowerCase()}`, date);
    out = note(out, date, `Il negoziato con ${country.label} su ${spec.label.toLowerCase()} fallisce.`, 'negoziato');
  }
  out = { ...out, negotiations: out.negotiations.map(item => item.id === id ? next : item) };
  return { diplomacy: out, negotiation: next, treaty, line: treaty ? `Accordo con ${country.label}: ${spec.label.toLowerCase()}.` : next.status === 'fallita' ? `Il negoziato con ${country.label} fallisce.` : `Round ${next.round}: posizione ${next.position}/${DIPLOMACY_RULES.needed}.` };
}
export function answerCrisis(input, id, answer, { date, week = 0, rand = Math.random, auto = false } = {}) {
  const d = normalize(input);
  const crisis = d?.crises.find(item => item.id === id && item.status === 'aperta');
  if (!crisis) throw new Error('Questa crisi non è più aperta.');
  if (!CRISIS_ANSWERS[answer]) throw new Error('Scegli come rispondere.');
  const kind = CRISIS_KINDS[crisis.kind];
  const relation = crisis.countries.reduce((sum, countryId) => sum + (d.countries[countryId]?.relation ?? 50), 0) / Math.max(1, crisis.countries.length);
  let out = d, outcome, severity = crisis.severity;
  if (answer === 'mediare') { const ok = rand() < 0.35 + relation / 200; severity = ok ? 0 : Math.max(1, severity - 1); outcome = ok ? 'risolta con la mediazione' : 'attenuata dalla mediazione'; for (const countryId of crisis.countries) out = touch(out, countryId, { trust: ok ? 4 : 1, tension: ok ? -6 : -2 }, `Mediazione sulla crisi (${kind.label.toLowerCase()})`, date); }
  else if (answer === 'schierarsi') { const side = crisis.countries[0]; severity = 0; outcome = `chiusa schierandosi con ${COUNTRY_BY_ID[side]?.label}`; crisis.countries.forEach((countryId, index) => { out = touch(out, countryId, index === 0 ? { relation: 5, trust: 3, tension: -4 } : { relation: -6, trust: -6, tension: 6 }, `Il governo si schiera nella crisi (${kind.label.toLowerCase()})`, date); }); }
  else { severity = crisis.severity; outcome = null; }
  const closed = severity === 0;
  out = { ...out, crises: out.crises.map(item => item.id === id ? { ...item, answer, answeredWeek: week, severity: closed ? item.severity : Math.max(1, severity), status: closed ? 'chiusa' : 'aperta', outcome: closed ? outcome : null, expiresWeek: closed ? item.expiresWeek : item.expiresWeek + 3 } : item) };
  out = note(out, date, `${kind.label}: ${CRISIS_ANSWERS[answer].label.toLowerCase()}${outcome ? `, ${outcome}` : ', la crisi resta aperta'}.`, 'crisi');
  return { diplomacy: out, closed, outcome, line: `${kind.label}: ${CRISIS_ANSWERS[answer].label.toLowerCase()}${closed ? ' — chiusa' : ''}.` };
}
export function decideSummit(input, id, stance, { date, week = 0, rand = Math.random, auto = false, lapsed = false } = {}) {
  const d = normalize(input);
  const summit = d?.summits.find(item => item.id === id && item.status === 'in-arrivo');
  if (!summit) throw new Error('Il vertice si è già tenuto.');
  if (!SUMMIT_STANCES[stance]) throw new Error('Scegli la linea da portare al vertice.');
  let standing = 0, satisfaction = 0, text;
  const ue = COUNTRIES.filter(item => item.bloc === 'ue');
  let out = d;
  if (stance === 'allineamento') { standing = 4; satisfaction = -0.4; text = `Al Consiglio europeo (${summit.topic.toLowerCase()}) l’Italia si allinea alla linea comune.`; for (const country of ue) out = touch(out, country.id, { relation: 1.5, trust: 1 }, null, date); }
  else if (stance === 'negoziato') { const ok = rand() < 0.5 + (d.eu.standing - 50) / 200; standing = ok ? 2 : -1; satisfaction = ok ? 0.5 : -0.2; text = ok ? `Al Consiglio europeo (${summit.topic.toLowerCase()}) il negoziato dà qualcosa all’Italia.` : `Al Consiglio europeo (${summit.topic.toLowerCase()}) il negoziato non porta risultati.`; }
  else { standing = -6; satisfaction = 0.8; text = `Al Consiglio europeo (${summit.topic.toLowerCase()}) l’Italia mette il veto.`; for (const country of ue) out = touch(out, country.id, { relation: -2.5, trust: -3, tension: 3 }, null, date); out = { ...out, eu: { ...out.eu, conditionality: clamp(out.eu.conditionality + 2, 0, 10) } }; }
  if (lapsed) { text += ' (Nessuno ha deciso: linea negoziale per default.)'; }
  out = { ...out, eu: { ...out.eu, standing: clamp(r1(out.eu.standing + standing), 0, 100) }, summits: out.summits.map(item => item.id === id ? { ...item, status: 'tenuto', stance, heldWeek: week } : item) };
  out = note(out, date, text, 'vertice');
  return { diplomacy: out, effects: { satisfaction, stability: stance === 'veto' ? 0.8 : 0, spread: stance === 'veto' ? 6 : stance === 'allineamento' ? -3 : 0 }, line: text };
}
// The President of the Republic and the treaties: he ratifies (the game's default), delays (the Government loses stability and the country a little trust) or refuses.
export function presidentTreaty(input, id, action, { date, week = 0 } = {}) {
  const d = normalize(input);
  const treaty = d?.treaties.find(item => item.id === id && item.status === 'firmato');
  if (!treaty) throw new Error('Questo trattato non è in attesa di ratifica.');
  const country = COUNTRY_BY_ID[treaty.countryId];
  let out = d, effects = ZERO(), line;
  if (action === 'ratifica') { out = { ...d, treaties: d.treaties.map(item => item.id === id ? { ...item, status: 'ratificato', ratifiedWeek: week } : item) }; line = `Ratificato: ${treaty.label} con ${country.label}.`; }
  else if (action === 'ritarda') { out = { ...d, treaties: d.treaties.map(item => item.id === id ? { ...item, signedWeek: week } : item) }; out = touch(out, treaty.countryId, { trust: -2 }, `Ratifica rinviata: ${treaty.label.toLowerCase()}`, date); effects.stability = -1; line = `Ratifica rinviata: ${treaty.label} con ${country.label}.`; }
  else if (action === 'rifiuta') { out = { ...d, treaties: d.treaties.map(item => item.id === id ? { ...item, status: 'rotto' } : item) }; out = touch(out, treaty.countryId, { relation: -8, trust: -15, tension: 8 }, `Trattato non ratificato: ${treaty.label.toLowerCase()}`, date); effects.stability = -4; line = `Il Presidente rifiuta la ratifica: ${treaty.label} con ${country.label} è carta straccia.`; }
  else throw new Error('Scegli se ratificare, rinviare o rifiutare.');
  return { diplomacy: note(out, date, line, 'trattato'), effects, line };
}

// What the page shows.
export function diplomacyView(input) {
  const d = normalize(input);
  if (!d) return null;
  const countries = COUNTRIES.map(item => ({ ...item, ...d.countries[item.id], treaties: d.treaties.filter(treaty => treaty.countryId === item.id && ['firmato', 'ratificato'].includes(treaty.status)) }));
  return { countries, eu: d.eu, treaties: d.treaties, negotiation: d.negotiations.find(item => item.status === 'aperta') ?? null, recentNegotiations: d.negotiations.filter(item => item.status !== 'aperta').slice(-3).reverse(), summit: d.summits.find(item => item.status === 'in-arrivo') ?? null, pastSummits: d.summits.filter(item => item.status === 'tenuto').slice(-3).reverse(), crises: d.crises.filter(item => item.status === 'aperta'), closedCrises: d.crises.filter(item => item.status !== 'aperta').slice(-3).reverse(), log: d.log.slice(0, 8), week: d.week };
}
