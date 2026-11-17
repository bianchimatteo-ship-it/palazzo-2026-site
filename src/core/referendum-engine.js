// The two referendums of the Constitution, kept strictly apart (requirements, phases, quorum, effects). Pure and deterministic: the same record, week and context give the same step.
//   · ABROGATIVO (art. 75): the repeal, total or partial, of a law (or of an act with the force of law). Requested by 500,000 voters or by five Regional Councils; checked by the Central Office for the
//     referendum at the Court of Cassation (signatures, form, clarity); judged admissible by the Constitutional Court (no tax or budget laws, no amnesty or pardon, no authorisation to ratify treaties, and the
//     requirements of the Court: a clear, homogeneous question with one purpose); then the campaign for YES and NO and the vote. It repeals ONLY if the majority of those entitled to vote takes part (quorum)
//     and YES prevails among the valid votes; without the quorum, or with NO ahead, the law stays in force.
//   · COSTITUZIONALE confirmativo (art. 138): the constitutional law approved by the Chambers with two deliberations three months apart (absolute majority at the second one). If it was approved by two
//     thirds of the members of both Chambers at the second deliberation the referendum is not possible; otherwise, within three months from the publication, a fifth of the members of a Chamber, 500,000
//     voters or five Regional Councils can ask for it. NO quorum: YES wins if it has the majority of the valid votes; if the reform is rejected it does not come into force.
// Every figure is a simulation of the game (the electorate, the polls, the votes): nothing here is a real result.
import { seededRandom } from './vote-engine.js?v=20261117-5';
import { formatDate } from './time.js?v=20261117-5';

export const ABROGATIVE = Object.freeze({
  id: 'abrogativo', label: 'Referendum abrogativo', basis: 'art. 75 Cost.', signatures: 500000, councils: 5, quorum: 0.5, cassationWeeks: 5, courtWeeks: 8, campaignWeeks: 9,
  note: 'Abroga una legge, in tutto o in parte, solo se vota la maggioranza degli aventi diritto e prevalgono i SÌ.'
});
export const CONSTITUTIONAL = Object.freeze({
  id: 'costituzionale', label: 'Referendum costituzionale', basis: 'art. 138 Cost.', signatures: 500000, councils: 5, fifth: 0.2, twoThirds: 2 / 3, requestWeeks: 13, deliberationGapWeeks: 13, campaignWeeks: 10,
  note: 'Conferma o respinge una riforma costituzionale approvata senza i due terzi: nessun quorum, vince la maggioranza dei voti validi.'
});
export const COUNCIL_ROUTE = Object.freeze({ cost: { days: 2, capital: 3, funds: 600 }, chance: 0.42 });
export const PHASES = Object.freeze({
  raccolta: 'Raccolta delle firme', consigli: 'Richiesta dei Consigli regionali', cassazione: 'Ufficio centrale per il referendum (Cassazione)', corte: 'Giudizio di ammissibilità (Corte costituzionale)',
  campagna: 'Campagna referendaria', voto: 'Voto', concluso: 'Concluso', prima: 'Prima deliberazione', pausa: 'Intervallo di tre mesi', seconda: 'Seconda deliberazione', richiesta: 'Termine per chiedere il referendum'
});
// What the Constitution does not allow to repeal by referendum.
export const EXCLUDED = Object.freeze([
  { id: 'tributaria', label: 'leggi tributarie e di bilancio', test: target => ['fisco', 'finanze'].includes(target.area) || /\b(tribut|imposta|irpef|iva|bilancio|manovra|finanziaria)/i.test(target.title ?? '') },
  { id: 'amnistia', label: 'amnistia e indulto', test: target => /\b(amnisti|indult)/i.test(target.title ?? '') },
  { id: 'trattati', label: 'autorizzazione alla ratifica dei trattati internazionali', test: target => target.kind === 'trattato' || /\b(ratific|trattato)/i.test(target.title ?? '') }
]);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const hash = value => [...String(value)].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const addDays = (date, days) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const record = (item, date, text, phase = null) => ({ ...item, steps: [{ date, text, phase: phase ?? item.phase }, ...(item.steps ?? [])].slice(0, 40) });
const pct = value => `${Math.round(value * 10) / 10}%`.replace('.', ',');

// ---------- the question and its admissibility ----------
// target: { statuteId, title, area, instrument, kind }; draft: { scope: 'totale' | 'parziale', partText, question }. Returns what the Office and the Court look at: the exclusions and the quality of the question.
export function eligibility(target, draft = {}) {
  const excluded = EXCLUDED.filter(item => item.test(target ?? {}));
  const partial = draft.scope === 'parziale';
  const part = String(draft.partText ?? '').trim();
  const custom = String(draft.question ?? '').trim();
  const problems = [];
  if (partial && part.length < 15) problems.push('Un’abrogazione parziale deve dire quali parti si abrogano (almeno 15 caratteri).');
  if (custom && custom.length < 20) problems.push('Il quesito deve essere scritto per intero (almeno 20 caratteri).');
  // the requirements of the Court: the question must be clear, homogeneous (one purpose) and not manipulative
  const text = custom || questionOf(target, draft);
  const clarity = clamp(0.45 + Math.min(0.35, text.length / 400) + (/^Volete voi che sia(no)? abrogat/i.test(text) ? 0.15 : 0) - (/\be\b.*\be\b.*\be\b/.test(text) ? 0.12 : 0), 0.2, 1);
  const parts = part ? part.split(/[;\n]|\be\b/i).filter(item => item.trim().length > 8).length : 1;
  const homogeneity = clamp(1 - Math.max(0, parts - 2) * 0.18, 0.25, 1);
  return { ok: !excluded.length && !problems.length, excluded, problems, text, clarity: Math.round(clarity * 100) / 100, homogeneity: Math.round(homogeneity * 100) / 100, quality: Math.round((clarity * 0.5 + homogeneity * 0.5) * 100) / 100 };
}
export function questionOf(target, draft = {}) {
  const title = target?.title ?? 'la legge';
  return draft.scope === 'parziale' ? `Volete voi che sia abrogata la legge «${title}», limitatamente a: ${String(draft.partText ?? '').trim() || '…'}?` : `Volete voi che sia abrogata la legge «${title}»?`;
}

// ---------- opening an abrogative request ----------
export function createAbrogative(draft, { target, date, id = null }) {
  if (!target) throw new Error('Scegli la legge da abrogare tra quelle in vigore.');
  const check = eligibility(target, draft);
  if (check.excluded.length) throw new Error(`Non si può chiedere il referendum su ${check.excluded.map(item => item.label).join(' e ')} (art. 75, secondo comma, Cost.).`);
  if (check.problems.length) throw new Error(check.problems[0]);
  if (!['firme', 'consigli'].includes(draft.route)) throw new Error('Scegli la via: 500.000 firme oppure cinque Consigli regionali.');
  return {
    id: id ?? `referendum-${hash(`${target.statuteId}|${date}|${draft.scope}`) % 99991}`, kind: 'abrogativo', title: check.text, target: { statuteId: target.statuteId, title: target.title, area: target.area ?? null, instrument: target.instrument ?? null, scope: draft.scope === 'parziale' ? 'parziale' : 'totale', partText: draft.scope === 'parziale' ? String(draft.partText).trim() : null },
    question: check.text, route: draft.route, status: 'in-corso', phase: draft.route === 'firme' ? 'raccolta' : 'consigli', createdAt: date, quality: { clarity: check.clarity, homogeneity: check.homogeneity, score: check.quality },
    councils: { required: ABROGATIVE.councils, approved: [], refused: [] }, initiativeId: null, side: null,
    steps: [{ date, text: `Richiesta di referendum abrogativo: ${check.text}`, phase: draft.route === 'firme' ? 'raccolta' : 'consigli' }], source: 'simulazione'
  };
}
// The route of the Regional Councils: five councils must pass the request. Each of the regions chosen gives its answer by the political weight of the player's side there (0..1); all five are needed.
export function askCouncils(input, { regions, weights = {}, date, week }) {
  const ref = JSON.parse(JSON.stringify(input));
  if (ref.phase !== 'consigli') throw new Error('Questa richiesta non passa dai Consigli regionali.');
  const chosen = [...new Set(regions ?? [])].filter(name => !ref.councils.approved.includes(name));
  if (chosen.length + ref.councils.approved.length < ABROGATIVE.councils) throw new Error(`Servono ${ABROGATIVE.councils} Consigli regionali: scegline altri.`);
  const approved = [...ref.councils.approved], refused = [...ref.councils.refused];
  for (const name of chosen) {
    if (approved.length >= ABROGATIVE.councils) break;
    const rand = seededRandom(`${ref.id}|${name}|consiglio|${week}`);
    const chance = clamp(COUNCIL_ROUTE.chance + ((weights[name] ?? 0.5) - 0.5) * 0.9, 0.08, 0.92);
    if (rand() < chance) approved.push(name); else refused.push(name);
  }
  ref.councils = { required: ABROGATIVE.councils, approved, refused };
  const done = approved.length >= ABROGATIVE.councils;
  let next = record(ref, date, `Consigli regionali: ${approved.length} su ${ABROGATIVE.councils} hanno approvato la richiesta${refused.length ? ` (${refused.length} hanno rifiutato)` : ''}.`);
  if (done) { next.phase = 'cassazione'; next.cassationAt = addDays(date, ABROGATIVE.cassationWeeks * 7); next = record(next, date, 'Richiesta depositata alla Corte di cassazione: cinque Consigli regionali l’hanno deliberata.'); }
  return { referendum: next, approved, refused, done };
}
// The signatures were checked and the request is filed: the Office of the Court of Cassation takes it.
export function fileRequest(input, { date, valid }) {
  const ref = JSON.parse(JSON.stringify(input));
  ref.phase = 'cassazione'; ref.cassationAt = addDays(date, ABROGATIVE.cassationWeeks * 7); ref.signaturesValid = valid;
  return record(ref, date, `Depositata la richiesta con ${Number(valid).toLocaleString('it-IT')} firme valide: la verifica passa all’Ufficio centrale per il referendum presso la Cassazione.`);
}

// ---------- the weeks of the procedure ----------
// ctx: { date, week, salience (0..1, how much the theme is felt), notoriety (0..100), stances: { si: [partyId], no: [partyId], free: [] } }.
// Returns { referendum, lines, effects, changed } where effects (told once at the end) is { reputation, popularity, notoriety, statute: { id, status }, parties: [{ partyId, delta }] }.
export function advanceReferendum(input, ctx) {
  let ref = JSON.parse(JSON.stringify(input));
  const lines = []; let effects = null; let changed = false;
  if (ref.status !== 'in-corso') return { referendum: ref, lines, effects, changed };
  const rand = seededRandom(`${ref.id}|${ctx.week}|referendum`);
  if (ref.kind === 'abrogativo') {
    if (ref.phase === 'cassazione' && ctx.date >= ref.cassationAt) {
      // the Central Office: signatures, form, clarity of the question
      const ok = (ref.route === 'consigli' || (ref.signaturesValid ?? 0) >= ABROGATIVE.signatures) && ref.quality.clarity >= 0.35;
      changed = true;
      if (!ok) { ref = close(ref, ctx.date, 'respinto', 'L’Ufficio centrale per il referendum ha dichiarato la richiesta illegittima (firme insufficienti o quesito non chiaro): il referendum non si fa.'); lines.push(`«${ref.target.title}»: richiesta di referendum respinta dall’Ufficio centrale.`); return { referendum: ref, lines, effects: { reputation: -1, popularity: -0.5 }, changed };
      }
      ref.phase = 'corte'; ref.courtAt = addDays(ctx.date, ABROGATIVE.courtWeeks * 7);
      ref = record(ref, ctx.date, 'L’Ufficio centrale per il referendum ha verificato la richiesta: è legittima. Ora il giudizio di ammissibilità della Corte costituzionale.');
      lines.push(`Referendum su «${ref.target.title}»: la Cassazione ha verificato la richiesta.`);
    } else if (ref.phase === 'corte' && ctx.date >= ref.courtAt) {
      changed = true;
      const excluded = EXCLUDED.filter(item => item.test({ ...ref.target, kind: ref.target.kind }));
      const chance = clamp(0.3 + ref.quality.score * 0.6, 0.1, 0.92);
      const admitted = !excluded.length && rand() < chance;
      if (!admitted) {
        const why = excluded.length ? `il quesito riguarda ${excluded.map(item => item.label).join(' e ')}` : ref.quality.homogeneity < 0.7 ? 'il quesito non è omogeneo: persegue più finalità' : 'il quesito non è abbastanza chiaro e univoco';
        ref = close(ref, ctx.date, 'inammissibile', `La Corte costituzionale ha dichiarato inammissibile il referendum: ${why}. La legge resta in vigore.`);
        lines.push(`La Corte costituzionale dichiara inammissibile il referendum su «${ref.target.title}».`);
        return { referendum: ref, lines, effects: { reputation: -0.8, popularity: -0.3 }, changed };
      }
      ref = startCampaign(ref, ctx, rand);
      lines.push(`La Corte costituzionale ammette il referendum su «${ref.target.title}»: si vota il ${formatDate(ref.voteDate)}.`);
    }
  }
  if (ref.kind === 'costituzionale') {
    const out = advanceRevision(ref, ctx, rand); ref = out.referendum; lines.push(...out.lines); changed = changed || out.changed; effects = out.effects ?? effects;
    if (ref.status !== 'in-corso') return { referendum: ref, lines, effects, changed };
  }
  if (ref.phase === 'campagna') {
    changed = true;
    ref = weekOfCampaign(ref, ctx, rand);
    if (ctx.date >= ref.voteDate) { const out = vote(ref, ctx, rand); ref = out.referendum; effects = out.effects; lines.push(...out.lines); }
  }
  return { referendum: ref, lines, effects, changed };
}
function close(ref, date, status, outcome) { const next = { ...ref, status, phase: 'concluso', closedAt: date, outcome }; return record(next, date, outcome, 'concluso'); }

// ---------- the campaign ----------
// The referendum is held on a Sunday of the spring window (15 April – 15 June) for the abrogative, a few weeks after the request for the constitutional one.
export function voteDateAfter(date, weeks, window = true) {
  let day = new Date(`${addDays(date, weeks * 7)}T12:00:00Z`);
  if (window) { const y = day.getUTCFullYear(); const open = new Date(`${y}-04-15T12:00:00Z`), close = new Date(`${y}-06-15T12:00:00Z`); if (day < open) day = open; else if (day > close) day = new Date(`${y + 1}-04-15T12:00:00Z`); }
  while (day.getUTCDay() !== 0) day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}
function startCampaign(input, ctx, rand) {
  const ref = JSON.parse(JSON.stringify(input));
  const weeks = ref.kind === 'costituzionale' ? CONSTITUTIONAL.campaignWeeks : ABROGATIVE.campaignWeeks;
  ref.phase = 'campagna'; ref.voteDate = voteDateAfter(ctx.date, weeks, ref.kind === 'abrogativo');
  const stances = ctx.stances ?? { si: [], no: [], free: [] };
  // the starting climate: the weight of the parties that back YES and NO, the salience of the theme, a drawn mood
  const yesWeight = (ctx.weights?.si ?? stances.si.length) , noWeight = (ctx.weights?.no ?? stances.no.length);
  const lean = (yesWeight - noWeight) / Math.max(1, yesWeight + noWeight);
  const salience = ctx.salience ?? 0.5;
  ref.campaign = {
    support: clamp(52 + lean * 14 + (rand() - 0.5) * 8, 28, 78),                       // % of YES among the valid votes
    turnout: clamp((ref.kind === 'costituzionale' ? 44 : 33) + salience * 16 + (rand() - 0.5) * 6, 18, 70),   // % of those entitled who vote
    stances, actions: {}, events: [], polls: [], effortWeek: -1, used: 0
  };
  return record(ref, ctx.date, `Si vota il ${formatDate(ref.voteDate)}: parte la campagna per il SÌ e per il NO.`, 'campagna');
}
export const CAMPAIGN_ACTIONS = Object.freeze({
  comizio: { id: 'comizio', label: 'Comizio in piazza', cost: { days: 1, capital: 0, funds: 300 }, support: 0.7, turnout: 0.4, hint: 'Porta la tua posizione davanti ai cittadini: sposta un po’ i voti e un po’ l’affluenza.' },
  dibattito: { id: 'dibattito', label: 'Dibattito in televisione', cost: { days: 1, capital: 0, funds: 0 }, support: 0.9, turnout: 0.3, risk: 0.25, hint: 'Rende molto, ma un confronto andato male si paga.' },
  mobilitazione: { id: 'mobilitazione', label: 'Mobilitazione dei volontari', cost: { days: 2, capital: 1, funds: 1200 }, support: 0.4, turnout: 1.1, hint: 'Porta alle urne: serve soprattutto a chi ha bisogno del quorum.' },
  alleati: { id: 'alleati', label: 'Coinvolgi i partiti alleati', cost: { days: 1, capital: 2, funds: 0 }, support: 1.1, turnout: 0.6, hint: 'Gli alleati scendono in campo per la tua parte.' },
  spot: { id: 'spot', label: 'Campagna di spot e manifesti', cost: { days: 1, capital: 0, funds: 2500 }, support: 1.0, turnout: 0.5, hint: 'Costa, ma arriva dappertutto.' },
  astensione: { id: 'astensione', label: 'Invita a non votare', cost: { days: 1, capital: 1, funds: 200 }, support: 0, turnout: -1.6, only: 'no', risk: 0.2, hint: 'Per il NO: se il quorum non è raggiunto il referendum non conta. Fa discutere.' }
});
export function campaignAction(input, actionId, { week, side }) {
  const ref = JSON.parse(JSON.stringify(input));
  const action = CAMPAIGN_ACTIONS[actionId];
  if (!action) throw new Error('Azione non valida.');
  if (ref.phase !== 'campagna') throw new Error('La campagna non è aperta.');
  if (!side) throw new Error('Scegli da che parte stai: SÌ o NO.');
  if (action.only && action.only !== side) throw new Error('Questa azione è per la parte del NO.');
  if (action.id === 'astensione' && ref.kind === 'costituzionale') throw new Error('Il referendum costituzionale non ha quorum: invitare a non votare non serve.');
  const c = ref.campaign;
  if (c.effortWeek !== week) { c.effortWeek = week; c.used = 0; }
  if (c.used >= 3) throw new Error('Per questa settimana hai già fatto abbastanza: al massimo tre iniziative.');
  c.used += 1;
  const sign = side === 'si' ? 1 : -1;
  const rand = seededRandom(`${ref.id}|${actionId}|${week}|${c.used}`);
  const bad = action.risk && rand() < action.risk;
  const factor = bad ? -0.6 : 1;
  c.support = clamp(c.support + sign * action.support * factor, 20, 85);
  c.turnout = clamp(c.turnout + (action.turnout < 0 ? action.turnout : action.turnout * (side === 'si' || ref.kind === 'costituzionale' ? 1 : 0.6)) * (action.turnout < 0 ? 1 : factor), 10, 80);
  c.actions[actionId] = (c.actions[actionId] ?? 0) + 1;
  const text = `${action.label}${bad ? ': è andata male e il pubblico ne parla in negativo' : ''}.`;
  c.events = [{ week, text, tone: bad ? 'bad' : 'good' }, ...c.events].slice(0, 12);
  return { referendum: record(ref, ref.steps[0]?.date ?? '', text), cost: action.cost, bad, text };
}
function weekOfCampaign(input, ctx, rand) {
  const ref = JSON.parse(JSON.stringify(input));
  const c = ref.campaign;
  // the climate drifts by itself, and recognisable events move it: a mobilisation, the press, the opposition, a political fact (told in the steps)
  c.support = clamp(c.support + (rand() - 0.5) * 0.8, 20, 85);
  c.turnout = clamp(c.turnout + (ref.kind === 'costituzionale' ? 0.25 : 0.18) + (rand() - 0.5) * 0.5, 10, 80);
  const roll = rand();
  if (roll < 0.07) { c.turnout = clamp(c.turnout + 2.2, 10, 80); c.events = [{ week: ctx.week, text: 'Grande mobilitazione di associazioni e sindacati: cresce l’affluenza attesa.', tone: 'good' }, ...c.events].slice(0, 12); ref.steps.unshift({ date: ctx.date, text: 'Mobilitazione di associazioni e sindacati: cresce l’affluenza attesa.', phase: 'campagna' }); }
  else if (roll < 0.13) { const d = rand() < 0.5 ? 1.6 : -1.6; c.support = clamp(c.support + d, 20, 85); c.events = [{ week: ctx.week, text: d > 0 ? 'La stampa dedica molto spazio alle ragioni del SÌ.' : 'La stampa dedica molto spazio alle ragioni del NO.', tone: 'neutral' }, ...c.events].slice(0, 12); ref.steps.unshift({ date: ctx.date, text: d > 0 ? 'Copertura mediatica favorevole al SÌ.' : 'Copertura mediatica favorevole al NO.', phase: 'campagna' }); }
  else if (roll < 0.17) { c.support = clamp(c.support - 1.2, 20, 85); c.events = [{ week: ctx.week, text: 'Un partito di opposizione lancia la campagna contro il quesito.', tone: 'bad' }, ...c.events].slice(0, 12); ref.steps.unshift({ date: ctx.date, text: 'Campagna dell’opposizione contro il quesito.', phase: 'campagna' }); }
  // the weekly poll (with the margin of a poll): the player follows it
  const noise = () => (rand() - 0.5) * 4;
  c.polls = [...c.polls, { week: ctx.week, date: ctx.date, yes: Math.round(clamp(c.support + noise(), 5, 95) * 10) / 10, turnout: Math.round(clamp(c.turnout + noise(), 5, 95) * 10) / 10 }].slice(-12);
  return ref;
}
function vote(input, ctx, rand) {
  const ref = JSON.parse(JSON.stringify(input));
  const c = ref.campaign;
  const turnout = clamp(c.turnout + (rand() - 0.5) * 3, 5, 95) / 100;
  const yes = clamp(c.support + (rand() - 0.5) * 3.5, 5, 95) / 100;
  const electorate = ctx.electorate ?? 51000000;
  const voters = Math.round(electorate * turnout);
  const valid = Math.round(voters * 0.985), blank = voters - valid;
  const yesVotes = Math.round(valid * yes), noVotes = valid - yesVotes;
  const quorumReached = ref.kind === 'costituzionale' ? true : turnout > ABROGATIVE.quorum;
  const carried = quorumReached && yes > 0.5;
  ref.result = { electorate, voters, turnout: Math.round(turnout * 1000) / 10, quorumReached, valid, blank, yesVotes, noVotes, yes: Math.round(yes * 1000) / 10, no: Math.round((1 - yes) * 1000) / 10, carried, simulated: true };
  const lines = [];
  let outcome;
  if (ref.kind === 'abrogativo') outcome = !quorumReached ? `Quorum non raggiunto: ha votato il ${pct(turnout * 100)} degli aventi diritto (serviva più del 50%). Il referendum non è valido e la legge «${ref.target.title}» resta in vigore.` : carried ? `Hanno votato il ${pct(turnout * 100)} degli aventi diritto e il SÌ ha il ${pct(yes * 100)}: la legge «${ref.target.title}» è abrogata${ref.target.scope === 'parziale' ? ' nelle parti indicate' : ''}.` : `Hanno votato il ${pct(turnout * 100)} ma il NO prevale (${pct((1 - yes) * 100)}): la legge «${ref.target.title}» resta in vigore.`;
  else outcome = carried ? `Affluenza ${pct(turnout * 100)}, il SÌ ha il ${pct(yes * 100)}: la riforma costituzionale «${ref.title}» è confermata ed entra in vigore.` : `Affluenza ${pct(turnout * 100)}, il NO prevale (${pct((1 - yes) * 100)}): la riforma costituzionale «${ref.title}» è respinta e non entra in vigore.`;
  const done = close({ ...ref, phase: 'voto' }, ctx.date, 'concluso', outcome);
  done.outcome = outcome; done.carried = carried;
  lines.push(outcome);
  // what it leaves: the side the player took wins or loses face; the parties that backed the winning side gain a little consensus; a repeal is recorded in the register of the laws
  const side = ref.side;
  const won = side ? (carried ? side === 'si' : side === 'no') : null;
  const effects = {
    reputation: won === null ? 0.3 : won ? 2 : -1.2, popularity: won === null ? 0 : won ? 1.4 : -0.9, notoriety: side ? 1.5 : 0,
    parties: [...(c.stances.si ?? []).map(partyId => ({ partyId, delta: carried ? 0.3 : -0.25 })), ...(c.stances.no ?? []).map(partyId => ({ partyId, delta: carried ? -0.25 : 0.3 }))],
    statute: ref.kind === 'abrogativo' && carried ? { id: ref.target.statuteId, status: ref.target.scope === 'parziale' ? 'modificata' : 'abrogata', by: ref.question } : null,
    constitutional: ref.kind === 'costituzionale' ? { carried } : null
  };
  return { referendum: done, lines, effects };
}

// ---------- the constitutional revision (art. 138) ----------
// The topics of the simulated constitutional reforms (generic, never a real text).
export const REVISION_TOPICS = Object.freeze([
  'Riforma del bicameralismo', 'Elezione diretta del Presidente del Consiglio', 'Riordino delle competenze tra Stato e Regioni', 'Riforma dell’ordinamento giudiziario', 'Riduzione del numero dei parlamentari', 'Nuove regole per la sfiducia al Governo'
]);
export const REVISION_RULES = Object.freeze({ cooldownWeeks: 78, weeklyChance: 0.006 });
// ctx: { date, week, id, backing: { camera: 0..1, senato: 0..1 } (share of the members who back the reform: the majority and the groups that follow it), opposition: { camera, senato } (share of the others) }
export function maybeRevision(game, ctx) {
  const list = game.referendums ?? [];
  if (list.some(item => item.kind === 'costituzionale' && item.status === 'in-corso')) return null;
  const last = list.filter(item => item.kind === 'costituzionale').map(item => item.createdWeek ?? -999).reduce((a, b) => Math.max(a, b), -999);
  if (ctx.week - last < REVISION_RULES.cooldownWeeks) return null;
  const rand = seededRandom(`${ctx.id}|${ctx.week}|revisione`);
  if (rand() > REVISION_RULES.weeklyChance) return null;
  const topic = REVISION_TOPICS[Math.floor(rand() * REVISION_TOPICS.length)];
  return {
    id: `revisione-${ctx.week}-${hash(topic) % 997}`, kind: 'costituzionale', title: topic, status: 'in-corso', phase: 'prima', createdAt: ctx.date, createdWeek: ctx.week, side: null,
    deliberations: [], councils: { required: CONSTITUTIONAL.councils, approved: [], refused: [] }, request: null, firstAt: addDays(ctx.date, 21), source: 'simulazione',
    steps: [{ date: ctx.date, text: `Il Parlamento avvia la revisione costituzionale «${topic}» (art. 138 Cost.): servono due deliberazioni per Camera a distanza di tre mesi.`, phase: 'prima' }]
  };
}
function deliberate(ref, ctx, rand, which) {
  const members = ctx.backing ?? { camera: 0.5, senato: 0.5 };
  const result = {};
  for (const chamber of ['camera', 'senato']) { const share = clamp(members[chamber] + (rand() - 0.5) * 0.06, 0.2, 0.95); result[chamber] = { share: Math.round(share * 1000) / 10, absolute: share > 0.5, twoThirds: share >= CONSTITUTIONAL.twoThirds }; }
  ref.deliberations.push({ which, date: ctx.date, ...result });
  return result;
}
function advanceRevision(input, ctx, rand) {
  let ref = JSON.parse(JSON.stringify(input));
  const lines = []; let effects = null; let changed = false;
  if (ref.phase === 'prima' && ctx.date >= ref.firstAt) {
    changed = true;
    const r = deliberate(ref, ctx, rand, 1);
    if (!(r.camera.absolute && r.senato.absolute)) { ref = close(ref, ctx.date, 'respinta', 'La riforma non ottiene la maggioranza alla prima deliberazione: decade.'); lines.push(`Revisione costituzionale «${ref.title}»: decade alla prima deliberazione.`); return { referendum: ref, lines, effects, changed }; }
    ref.phase = 'pausa'; ref.secondAt = addDays(ctx.date, CONSTITUTIONAL.deliberationGapWeeks * 7);
    ref = record(ref, ctx.date, 'Prima deliberazione approvata nelle due Camere. Seguono almeno tre mesi di intervallo.');
    lines.push(`Revisione costituzionale «${ref.title}»: prima deliberazione approvata.`);
  } else if (ref.phase === 'pausa' && ctx.date >= ref.secondAt) {
    changed = true;
    const r = deliberate(ref, ctx, rand, 2);
    if (!(r.camera.absolute && r.senato.absolute)) { ref = close(ref, ctx.date, 'respinta', 'La riforma non ottiene la maggioranza assoluta alla seconda deliberazione: non è approvata.'); lines.push(`Revisione costituzionale «${ref.title}»: respinta alla seconda deliberazione.`); return { referendum: ref, lines, effects, changed }; }
    if (r.camera.twoThirds && r.senato.twoThirds) { ref = close(ref, ctx.date, 'in-vigore', 'La riforma è approvata dai due terzi dei membri di entrambe le Camere alla seconda deliberazione: il referendum non è possibile e la riforma entra in vigore.'); lines.push(`La riforma costituzionale «${ref.title}» è approvata con i due terzi: nessun referendum, entra in vigore.`); effects = { reputation: 0, popularity: 0, constitutional: { carried: true, noReferendum: true } }; return { referendum: ref, lines, effects, changed }; }
    ref.phase = 'richiesta'; ref.requestUntil = addDays(ctx.date, CONSTITUTIONAL.requestWeeks * 7); ref.opposition = { camera: Math.round((1 - ctx.backing.camera) * 1000) / 10, senato: Math.round((1 - ctx.backing.senato) * 1000) / 10 };
    ref = record(ref, ctx.date, `Riforma approvata a maggioranza assoluta (senza i due terzi): entro il ${formatDate(ref.requestUntil)} un quinto dei membri di una Camera, 500.000 elettori o cinque Consigli regionali possono chiedere il referendum.`);
    lines.push(`La riforma costituzionale «${ref.title}» è approvata senza i due terzi: si può chiedere il referendum entro tre mesi.`);
  } else if (ref.phase === 'richiesta') {
    if (ref.request) { changed = true; ref.phase = 'campagna'; ref.side = ref.side ?? null; ref = startCampaign(ref, ctx, rand); lines.push(`Referendum sulla riforma costituzionale «${ref.title}»: si vota il ${formatDate(ref.voteDate)}.`); }
    else if (ctx.date > ref.requestUntil) {
      // nobody of the player asked: the opposition may still do it by itself (a fifth of the members of a Chamber), by the weight it has
      changed = true;
      const op = Math.max(ref.opposition?.camera ?? 0, ref.opposition?.senato ?? 0) / 100;
      const byOpposition = op >= CONSTITUTIONAL.fifth && rand() < 0.55;
      if (byOpposition) { ref.request = { by: 'quinto', date: ctx.date, who: 'le opposizioni' }; ref = record(ref, ctx.date, 'Le opposizioni chiedono il referendum con la firma di un quinto dei membri di una Camera.'); ref = startCampaign(ref, ctx, rand); lines.push(`Le opposizioni chiedono il referendum sulla riforma «${ref.title}»: si vota il ${formatDate(ref.voteDate)}.`); }
      else { ref = close(ref, ctx.date, 'in-vigore', 'Scaduti i tre mesi senza una richiesta di referendum: la riforma costituzionale è promulgata ed entra in vigore.'); lines.push(`Nessuno chiede il referendum: la riforma costituzionale «${ref.title}» entra in vigore.`); effects = { reputation: 0, popularity: 0, constitutional: { carried: true, noReferendum: true } }; }
    }
  }
  return { referendum: ref, lines, effects, changed };
}
// The request of the referendum on a constitutional reform: by a fifth of the members of a Chamber (it needs the support of groups that hold at least 20% of a Chamber), by 500,000 voters (the collection of the initiative page), or by five Regional Councils.
export function requestConstitutional(input, { route, date, week, opposition = {}, weights = {}, regions = [], valid = 0 }) {
  const ref = JSON.parse(JSON.stringify(input));
  if (ref.phase !== 'richiesta' || date > ref.requestUntil) throw new Error('Il termine di tre mesi per chiedere il referendum è scaduto.');
  if (ref.request) throw new Error('Il referendum è già stato chiesto.');
  if (route === 'quinto') {
    const share = Math.max(opposition.camera ?? 0, opposition.senato ?? 0) / 100;
    if (share < CONSTITUTIONAL.fifth) throw new Error('Serve la firma di un quinto dei membri di una Camera: i gruppi che si oppongono non arrivano al 20%.');
    ref.request = { by: 'quinto', date, who: 'un quinto dei membri di una Camera' };
  } else if (route === 'firme') {
    if (valid < CONSTITUTIONAL.signatures) throw new Error('Servono 500.000 firme valide.');
    ref.request = { by: 'firme', date, who: '500.000 elettori' };
  } else if (route === 'consigli') {
    const chosen = [...new Set(regions)]; if (chosen.length < CONSTITUTIONAL.councils) throw new Error(`Servono cinque Consigli regionali.`);
    const approved = chosen.filter(name => seededRandom(`${ref.id}|${name}|consiglio|${week}`)() < clamp(COUNCIL_ROUTE.chance + ((weights[name] ?? 0.5) - 0.5) * 0.9, 0.08, 0.92));
    if (approved.length < CONSTITUTIONAL.councils) { ref.councils = { required: 5, approved, refused: chosen.filter(name => !approved.includes(name)) }; return { referendum: record(ref, date, `Consigli regionali: ${approved.length} su 5 hanno deliberato la richiesta: non basta.`), done: false, approved }; }
    ref.request = { by: 'consigli', date, who: 'cinque Consigli regionali' };
  } else throw new Error('Scegli come chiedere il referendum: un quinto dei membri, 500.000 firme o cinque Consigli regionali.');
  return { referendum: record(ref, date, `Referendum chiesto da ${ref.request.who}.`), done: true };
}

// What a page shows of a record: the path of its phases.
export const pathOf = ref => ref.kind === 'costituzionale'
  ? [['prima', 'Prima deliberazione'], ['pausa', 'Tre mesi'], ['seconda', 'Seconda deliberazione'], ['richiesta', 'Richiesta'], ['campagna', 'Campagna'], ['concluso', 'Esito']]
  : [[ref.route === 'consigli' ? 'consigli' : 'raccolta', ref.route === 'consigli' ? 'Consigli regionali' : 'Firme'], ['cassazione', 'Cassazione'], ['corte', 'Corte costituzionale'], ['campagna', 'Campagna'], ['voto', 'Voto'], ['concluso', 'Esito']];
export const isActive = ref => ref?.status === 'in-corso';
