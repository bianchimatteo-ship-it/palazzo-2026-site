// Requests of citizens and associations: every few weeks a group of the player's region asks for something about an area of public life that is really under pressure (the request quotes the
// indicator of that area in that region). What the player can do depends on the offices he holds (a member without office can only report it and promise; a councillor or a parliamentarian can ask a
// question or file a motion; whoever leads an executive can act directly; anybody can start a signature drive), each action has a cost, a time and a chance, and the answer arrives later with its
// consequences on reputation, popularity and the attention of the region. Pure and deterministic: the same request, week and context give the same answer.
import { seededRandom } from './vote-engine.js?v=20261119-12';

export const REQUESTERS = Object.freeze([
  { id: 'cittadini', label: 'Un gruppo di cittadini', tone: 'preoccupato' },
  { id: 'associazione', label: 'Un’associazione del territorio', tone: 'organizzato' },
  { id: 'comitato', label: 'Un comitato di quartiere', tone: 'insistente' },
  { id: 'sindacato', label: 'Un sindacato', tone: 'rivendicativo' },
  { id: 'categoria', label: 'Una categoria di lavoratori', tone: 'preoccupato' },
  { id: 'genitori', label: 'Un’assemblea di genitori', tone: 'preoccupato' }
]);
export const REQUEST_RULES = Object.freeze({ maxOpen: 3, everyWeeks: 3, lifeWeeks: 10, directFunds: 1500, promiseWeeks: 40, initiativeWeeks: 52 });
// The cycle of a request: received → taken in charge → promise or intervention started → carried out, failed or ignored → satisfied or rejected. A request is satisfied only when the intervention is really carried out
// (a promise kept, an initiative that passed, an intervention that worked): to write it in the programme is a promise, not an answer.
export const PHASES = Object.freeze({
  ricevuta: { label: 'Ricevuta', satisfaction: 30 }, 'presa-in-carico': { label: 'Presa in carico', satisfaction: 45 }, avviata: { label: 'Intervento avviato', satisfaction: 55 },
  realizzata: { label: 'Realizzata: richiesta soddisfatta', satisfaction: 85 }, fallita: { label: 'Intervento fallito', satisfaction: 15 }, ignorata: { label: 'Ignorata', satisfaction: 5 }, respinta: { label: 'Respinta', satisfaction: 10 }
});
export const phaseOf = request => request?.phase ?? ({ aperta: 'ricevuta', 'in-corso': 'avviata', risolta: request?.won === false ? 'fallita' : 'realizzata', scaduta: 'ignorata', respinta: 'respinta' }[request?.status] ?? 'ricevuta');
// The actions: what each asks (power it needs, cost), how long the answer takes, how likely it works, what it brings when it works.
export const ACTIONS = Object.freeze({
  segnala: { id: 'segnala', label: 'Segnala all’ufficio competente', needs: null, cost: { days: 1, capital: 0, funds: 0 }, wait: 3, chance: 0.5, win: { reputation: 0.6, attention: 1 }, lose: { reputation: 0.1 }, hint: 'Una lettera all’ufficio che se ne occupa: lo può fare chiunque, la risposta non è garantita.' },
  interrogazione: { id: 'interrogazione', label: 'Presenta un’interrogazione', needs: 'questions', cost: { days: 1, capital: 0, funds: 0 }, wait: 2, chance: 0.72, win: { reputation: 1, notoriety: 0.3, attention: 2 }, lose: { reputation: 0.2 }, hint: 'Chiede conto all’esecutivo: serve un seggio in un consiglio o in Parlamento.' },
  mozione: { id: 'mozione', label: 'Deposita una mozione', needs: 'motions', cost: { days: 2, capital: 1, funds: 0 }, wait: 4, chance: 0.42, win: { reputation: 1.6, popularity: 0.6, attention: 3 }, lose: { reputation: -0.3 }, hint: 'Impegna l’assemblea a intervenire: serve un seggio e la maggioranza può respingerla.' },
  promessa: { id: 'promessa', label: 'Inserisci l’impegno nel tuo programma', needs: 'party', cost: { days: 1, capital: 0, funds: 0 }, wait: 0, chance: 1, win: { reputation: 0.3 }, lose: {}, hint: 'Diventa una promessa del programma: dovrai mantenerla, e i cittadini lo verificheranno.', program: true },
  iniziativa: { id: 'iniziativa', label: 'Avvia una raccolta di firme', needs: null, cost: { days: 1, capital: 0, funds: 0 }, wait: 0, chance: 1, win: { reputation: 0.4 }, lose: {}, hint: 'Apre una iniziativa popolare con questo tema (il costo di apertura è quello della raccolta): serve un testo in articoli.', initiative: true },
  diretto: { id: 'diretto', label: 'Intervieni direttamente', needs: 'executive', cost: { days: 2, capital: 2, funds: 1500 }, wait: 1, chance: 0.9, win: { reputation: 1.8, popularity: 1.2, attention: 4, indicator: 2.5 }, lose: { reputation: 0.2 }, hint: 'Un intervento del tuo ufficio, pagato con i fondi: migliora davvero il servizio. Serve guidare un esecutivo.' },
  declina: { id: 'declina', label: 'Rispondi che non è di tua competenza', needs: null, cost: { days: 0, capital: 0, funds: 0 }, wait: 0, chance: 1, win: { reputation: -0.4 }, lose: {}, hint: 'Chiude la richiesta con una risposta cortese: i cittadini non la dimenticheranno.', closes: 'respinta' }
});
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const hash = value => [...String(value)].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261) || 1;

// ---------- the arrival of a request ----------
// ctx: { week, date, region, areas: [{ id, label, value (indicator 0-100 in the region) }], seed }
export function generateRequest(requests, ctx) {
  const open = requests.filter(item => ['aperta', 'in-corso'].includes(item.status));
  if (open.length >= REQUEST_RULES.maxOpen) return null;
  const rand = seededRandom(`${ctx.seed}|${ctx.week}|richiesta`);
  if (rand() > 0.34) return null;
  const last = requests.map(item => item.createdWeek ?? -99).reduce((a, b) => Math.max(a, b), -99);
  if (ctx.week - last < REQUEST_RULES.everyWeeks) return null;
  const areas = (ctx.areas ?? []).filter(item => Number.isFinite(item.value) && !open.some(request => request.area === item.id));
  if (!areas.length) return null;
  // the areas that hurt more are asked about more often
  const weights = areas.map(item => Math.pow(Math.max(1, 100 - item.value), 2));
  let draw = rand() * weights.reduce((a, b) => a + b, 0), area = areas[0];
  for (let index = 0; index < areas.length; index++) { draw -= weights[index]; if (draw <= 0) { area = areas[index]; break; } }
  const requester = REQUESTERS[Math.floor(rand() * REQUESTERS.length)];
  const id = `richiesta-${ctx.week}-${area.id}-${hash(`${ctx.seed}|${ctx.week}`) % 997}`;
  return {
    id, requester: requester.id, requesterLabel: requester.label, area: area.id, areaLabel: area.label, region: ctx.region, value: Math.round(area.value), createdWeek: ctx.week, createdAt: ctx.date, expiresWeek: ctx.week + REQUEST_RULES.lifeWeeks,
    status: 'aperta', phase: 'ricevuta', satisfaction: 30, text: `${requester.label} in ${ctx.region} chiede interventi su «${area.label}»: l’indicatore nella Regione è ${Math.round(area.value)}/100 e le persone lo sentono.`,
    history: [{ date: ctx.date, text: `${requester.label} in ${ctx.region} chiede interventi su ${area.label.toLowerCase()}.` }], source: 'simulazione'
  };
}

// ---------- what the player can do with it ----------
// powers: { questions, motions, executive, party, funds, capital }
export function actionsFor(request, powers = {}) {
  if (!['aperta'].includes(request?.status)) return [];
  return Object.values(ACTIONS).map(action => {
    const lacking = action.needs && !powers[action.needs] ? ({ questions: 'Serve un seggio in un’assemblea (interrogazioni).', motions: 'Serve un seggio in un’assemblea (mozioni).', executive: 'Serve guidare un esecutivo (sindaco, presidente, assessore con delega, ministro).', party: 'Serve un partito.' }[action.needs]) : null;
    const poor = !lacking && (action.cost.funds > (powers.funds ?? 0) ? `Servono ${action.cost.funds} € di fondi.` : action.cost.capital > (powers.capital ?? 0) ? `Servono ${action.cost.capital} punti di capitale politico.` : null);
    return { ...action, available: !lacking && !poor, reason: lacking ?? poor ?? null };
  });
}
export function takeAction(input, actionId, ctx) {
  const request = JSON.parse(JSON.stringify(input));
  const action = ACTIONS[actionId];
  if (!action) throw new Error('Azione non valida.');
  if (request.status !== 'aperta') throw new Error('La richiesta non è più aperta.');
  const available = actionsFor(request, ctx.powers).find(item => item.id === actionId);
  if (!available?.available) throw new Error(available?.reason ?? 'Azione non disponibile.');
  request.action = actionId; request.takenWeek = ctx.week; request.takenAt = ctx.date;
  request.history.unshift({ date: ctx.date, text: `${action.label}.` });
  if (action.closes) { request.status = action.closes; request.phase = 'respinta'; request.satisfaction = PHASES.respinta.satisfaction; request.closedAt = ctx.date; request.outcome = 'Hai risposto che non è di tua competenza.'; }
  else if (action.program || action.initiative) {
    // taken in charge: the request stays open until the promise is kept or the initiative has its end
    request.status = 'in-corso'; request.phase = 'presa-in-carico'; request.satisfaction = PHASES['presa-in-carico'].satisfaction;
    request.linked = action.program ? 'promessa' : 'iniziativa';
    request.answerWeek = ctx.week + (action.program ? REQUEST_RULES.promiseWeeks : REQUEST_RULES.initiativeWeeks);
    request.outcome = action.program ? 'L’impegno è nel tuo programma: la richiesta sarà soddisfatta solo quando lo avrai mantenuto.' : 'È partita una raccolta di firme su questo tema: la richiesta sarà soddisfatta solo se l’iniziativa arriva in fondo.';
    request.history.unshift({ date: ctx.date, text: request.outcome });
  }
  else { request.status = 'in-corso'; request.phase = 'presa-in-carico'; request.satisfaction = PHASES['presa-in-carico'].satisfaction; request.answerWeek = ctx.week + action.wait; }
  return { request, cost: action.cost, effects: action.closes ? (action.win ?? {}) : {} };
}

// ---------- the answer ----------
// ctx: { week, date, influence (0-100), seed, link }. `link` is the state of what the request is bound to: { state: 'attiva' | 'riuscita' | 'fallita' | 'assente' } (the promise or the initiative).
// Returns the request (possibly closed), the effects to apply once, a headline (when something worth telling happened) and `step` (a move of the cycle that is not an ending: it goes in the diary).
const IGNORED = { reputation: -0.8, popularity: -0.4, attention: -2 };
export function advanceRequest(input, ctx) {
  const request = JSON.parse(JSON.stringify(input));
  const close = (status, phase, outcome, effects, tone, headline, extra = {}) => {
    request.status = status; request.phase = phase; request.satisfaction = PHASES[phase].satisfaction; request.closedAt = ctx.date; request.outcome = outcome;
    request.history.unshift({ date: ctx.date, text: outcome });
    if (extra.won !== undefined) request.won = extra.won;
    return { request, effects, headline, tone, ...extra };
  };
  if (request.status === 'aperta' && ctx.week > request.expiresWeek) {
    return close('scaduta', 'ignorata', 'Nessuno ha risposto: la richiesta è stata ignorata e chi l’aveva fatta se lo ricorda.', IGNORED, 'bad', `Richiesta ignorata: ${request.areaLabel} in ${request.region}`);
  }
  if (request.status !== 'in-corso') return { request, effects: null, headline: null };
  // a request bound to a promise or to an initiative follows what happens to it
  if (request.linked) {
    const state = ctx.link?.state ?? 'attiva';
    if (state === 'riuscita') return close('risolta', 'realizzata', `Realizzato: ${request.linked === 'promessa' ? 'la promessa è stata mantenuta' : 'l’iniziativa è arrivata in fondo'}, la richiesta è soddisfatta.`, { reputation: 1.6, popularity: 1, attention: 3.5, indicator: 2 }, 'good', `Richiesta soddisfatta: ${request.areaLabel} in ${request.region}`, { indicator: 2, won: true });
    if (state === 'fallita' || state === 'assente') return close('fallita', 'fallita', `${request.linked === 'promessa' ? 'La promessa non è stata mantenuta' : 'L’iniziativa non ha avuto esito'}: la richiesta resta senza risposta.`, { reputation: -0.9, popularity: -0.5, attention: -2.5 }, 'bad', `Impegno fallito: ${request.areaLabel} in ${request.region}`, { won: false });
    if (ctx.week > request.answerWeek) return close('scaduta', 'ignorata', `Il tempo è passato e ${request.linked === 'promessa' ? 'la promessa non è stata mantenuta' : 'l’iniziativa non è arrivata in fondo'}: la richiesta è considerata ignorata.`, IGNORED, 'bad', `Richiesta ignorata: ${request.areaLabel} in ${request.region}`, { won: false });
    if (request.phase === 'presa-in-carico' && ctx.week > (request.takenWeek ?? ctx.week)) { request.phase = 'avviata'; request.satisfaction = PHASES.avviata.satisfaction; request.history.unshift({ date: ctx.date, text: request.linked === 'promessa' ? 'La promessa è avviata: ora va mantenuta.' : 'La raccolta è avviata.' }); return { request, effects: { attention: 0.5 }, headline: null, step: `${request.areaLabel}: ${PHASES.avviata.label.toLowerCase()}.` }; }
    return { request, effects: null, headline: null };
  }
  // a direct action: it is started a week after it is taken in charge, and carried out (or not) when its time comes
  if (request.phase === 'presa-in-carico' && ctx.week > (request.takenWeek ?? ctx.week) && ctx.week < request.answerWeek) { request.phase = 'avviata'; request.satisfaction = PHASES.avviata.satisfaction; request.history.unshift({ date: ctx.date, text: 'L’intervento è avviato.' }); return { request, effects: null, headline: null, step: `${request.areaLabel}: ${PHASES.avviata.label.toLowerCase()}.` }; }
  if (ctx.week < request.answerWeek) return { request, effects: null, headline: null };
  const action = ACTIONS[request.action];
  const rand = seededRandom(`${request.id}|${request.action}|risposta`);
  const chance = clamp(action.chance + ((ctx.influence ?? 50) - 50) / 250, 0.1, 0.97);
  const won = rand() < chance;
  if (won) return close('risolta', 'realizzata', `${action.label}: l’intervento è stato realizzato e la richiesta è soddisfatta.`, action.win, 'good', `Richiesta soddisfatta: ${request.areaLabel} in ${request.region}`, { indicator: action.win.indicator ?? 0, won: true });
  return close('fallita', 'fallita', `${action.label}: l’intervento è fallito e la richiesta non ha avuto seguito.`, { ...action.lose, popularity: (action.lose.popularity ?? 0) - 0.3, attention: -1.5 }, 'bad', `Intervento fallito: ${request.areaLabel} in ${request.region}`, { won: false });
}
export const openRequests = requests => (requests ?? []).filter(item => ['aperta', 'in-corso'].includes(item.status));
// what a request is bound to, read from the game: the promise (by id) or the initiative (the one opened for this area after the request was taken in charge)
export function linkOf(request, { promises = [], initiatives = [] } = {}) {
  if (request.linked === 'promessa') {
    const promise = promises.find(item => item.id === request.promiseId);
    if (!promise) return { state: 'assente' };
    return { state: ['mantenuta', 'parzialmente-mantenuta'].includes(promise.status) ? 'riuscita' : ['non-mantenuta', 'modificata'].includes(promise.status) ? 'fallita' : 'attiva' };
  }
  if (request.linked === 'iniziativa') {
    const item = initiatives.find(entry => entry.id === request.initiativeId) ?? initiatives.find(entry => entry.area === request.area && (entry.createdAt ?? '') >= (request.takenAt ?? ''));
    if (!item) return { state: 'attiva', id: null };
    return { state: ['approvata', 'depositata'].includes(item.status) ? 'riuscita' : ['respinta', 'fallita', 'ritirata', 'archiviata'].includes(item.status) ? 'fallita' : 'attiva', id: item.id };
  }
  return { state: 'attiva' };
}
