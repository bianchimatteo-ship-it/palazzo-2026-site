// Requests of citizens and associations: every few weeks a group of the player's region asks for something about an area of public life that is really under pressure (the request quotes the
// indicator of that area in that region). What the player can do depends on the offices he holds (a member without office can only report it and promise; a councillor or a parliamentarian can ask a
// question or file a motion; whoever leads an executive can act directly; anybody can start a signature drive), each action has a cost, a time and a chance, and the answer arrives later with its
// consequences on reputation, popularity and the attention of the region. Pure and deterministic: the same request, week and context give the same answer.
import { seededRandom } from './vote-engine.js?v=20261117-3';

export const REQUESTERS = Object.freeze([
  { id: 'cittadini', label: 'Un gruppo di cittadini', tone: 'preoccupato' },
  { id: 'associazione', label: 'Un’associazione del territorio', tone: 'organizzato' },
  { id: 'comitato', label: 'Un comitato di quartiere', tone: 'insistente' },
  { id: 'sindacato', label: 'Un sindacato', tone: 'rivendicativo' },
  { id: 'categoria', label: 'Una categoria di lavoratori', tone: 'preoccupato' },
  { id: 'genitori', label: 'Un’assemblea di genitori', tone: 'preoccupato' }
]);
export const REQUEST_RULES = Object.freeze({ maxOpen: 3, everyWeeks: 3, lifeWeeks: 10, directFunds: 1500 });
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
    status: 'aperta', text: `${requester.label} in ${ctx.region} chiede interventi su «${area.label}»: l’indicatore nella Regione è ${Math.round(area.value)}/100 e le persone lo sentono.`,
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
  request.action = actionId;
  request.history.unshift({ date: ctx.date, text: `${action.label}.` });
  if (action.closes) { request.status = action.closes; request.closedAt = ctx.date; request.outcome = 'Hai risposto che non è di tua competenza.'; }
  else if (action.program || action.initiative) { request.status = 'risolta'; request.closedAt = ctx.date; request.outcome = action.program ? 'L’impegno è nel tuo programma: ora va mantenuto.' : 'È partita una raccolta di firme su questo tema.'; }
  else { request.status = 'in-corso'; request.answerWeek = ctx.week + action.wait; }
  return { request, cost: action.cost, effects: action.closes || action.program || action.initiative ? (action.win ?? {}) : {} };
}

// ---------- the answer ----------
// ctx: { week, date, influence (0-100), seed }. Returns the request (possibly closed), the effects to apply once, and a headline.
export function advanceRequest(input, ctx) {
  const request = JSON.parse(JSON.stringify(input));
  if (request.status === 'aperta' && ctx.week > request.expiresWeek) {
    request.status = 'scaduta'; request.closedAt = ctx.date; request.outcome = 'Nessuno ha risposto: la richiesta è scaduta e chi l’aveva fatta se lo ricorda.';
    request.history.unshift({ date: ctx.date, text: request.outcome });
    return { request, effects: { reputation: -0.5 }, headline: `Richiesta scaduta: ${request.areaLabel} in ${request.region}`, tone: 'bad' };
  }
  if (request.status !== 'in-corso' || ctx.week < request.answerWeek) return { request, effects: null, headline: null };
  const action = ACTIONS[request.action];
  const rand = seededRandom(`${request.id}|${request.action}|risposta`);
  const chance = clamp(action.chance + ((ctx.influence ?? 50) - 50) / 250, 0.1, 0.97);
  const won = rand() < chance;
  request.status = 'risolta'; request.closedAt = ctx.date; request.won = won;
  request.outcome = won ? `${action.label}: la richiesta è stata accolta.` : `${action.label}: la richiesta non ha avuto seguito.`;
  request.history.unshift({ date: ctx.date, text: request.outcome });
  return { request, effects: won ? action.win : action.lose, headline: won ? `Richiesta accolta: ${request.areaLabel} in ${request.region}` : `Nessun seguito alla richiesta su ${request.areaLabel.toLowerCase()}`, tone: won ? 'good' : 'bad', indicator: won && action.win.indicator ? action.win.indicator : 0 };
}
export const openRequests = requests => (requests ?? []).filter(item => ['aperta', 'in-corso'].includes(item.status));
