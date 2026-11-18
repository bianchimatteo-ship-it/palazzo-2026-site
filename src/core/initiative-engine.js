// Popular initiatives: a bill written by citizens (art. 71 of the Constitution: at least 50,000 voters sign a text drawn up in articles) and the collection of signatures for an abrogative
// referendum (art. 75: 500,000 voters). They are THREE different things in the game and this module keeps them apart:
//   · popolare       — an initiative of citizens: the party collects signatures, deposits the text, Parliament examines it (the phase after the deposit is simulated);
//   · referendum     — the collection of signatures for a referendum: the same machinery with the threshold of 500,000; what comes after the deposit (Corte di cassazione, Corte costituzionale,
//                      the vote with its quorum) is NOT simulated by this module and the page says so;
//   · parlamentare   — a bill of a member of Parliament: that is the page «Leggi» (parliament-engine.js), never this module.
// Everything is pure and deterministic: the same initiative, the same week and the same context give the same signatures. The state lives in game.initiatives (a plain array of records).
import { seededRandom } from './vote-engine.js?v=20261118-10';

export const INITIATIVE_KINDS = Object.freeze({
  popolare: { id: 'popolare', label: 'Iniziativa legislativa popolare', basis: 'art. 71 Cost.', required: 50000, weeks: 26, depositMargin: 1.15, articles: { min: 1, max: 8 }, short: 'Un testo scritto dai cittadini, firmato da almeno 50.000 elettori e depositato in una Camera.' },
  referendum: { id: 'referendum', label: 'Raccolta firme referendaria', basis: 'art. 75 Cost.', required: 500000, weeks: 13, depositMargin: 1.12, articles: { min: 0, max: 0 }, short: 'La raccolta di 500.000 firme per un referendum abrogativo. La fase dopo il deposito non è simulata.' }
});
export const PARLIAMENTARY_NOTE = 'Una proposta parlamentare la presenta un membro del Parlamento: si fa dalla pagina «Leggi», non da qui.';
// How the collection is organised: what each lever costs and how many signatures a week it brings (an order of magnitude, simulated).
export const CHANNELS = Object.freeze({
  banchetti: { id: 'banchetti', label: 'Banchetti di raccolta', unit: 'banchetto', setup: 150, weekly: 25, perWeek: 90, max: 40, hint: 'Un banchetto in piazza o al mercato: tavolino, modulo e volontari.' },
  online: { id: 'online', label: 'Piattaforma online', unit: 'piattaforma', setup: 500, weekly: 40, perWeek: 520, max: 1, hint: 'Firma con identità digitale: raggiunge tutti, ma costa e fa discutere.' },
  volontari: { id: 'volontari', label: 'Volontari del partito', unit: 'volontario', setup: 0, weekly: 2, perWeek: 9, max: 400, hint: 'Iscritti che raccolgono firme tra amici e vicini: dipendono dalla forza del partito. Costano 2 € a settimana ciascuno (rimborsi, materiali, trasporti).' },
  comuni: { id: 'comuni', label: 'Comuni amici (autenticazione)', unit: 'comune', setup: 100, weekly: 10, perWeek: 70, max: 60, hint: 'Un ufficio comunale che autentica le firme: serve un rapporto con l’amministrazione.' }
});
export const ESTIMATED_VALID_SHARE = 0.92; // the share of signatures that survives the check (the real figure is drawn between 0.88 and 0.97): with the recommended margin (+15 % / +12 %) even the worst draw passes
export const SETUP_COST = Object.freeze({ popolare: 400, referendum: 4000 });
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const hash = value => [...String(value)].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const addDays = (date, days) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const record = (initiative, date, text) => ({ ...initiative, history: [{ date, text }, ...(initiative.history ?? [])].slice(0, 40) });

export const kindOf = initiative => INITIATIVE_KINDS[initiative?.kind] ?? INITIATIVE_KINDS.popolare;
export const isOpen = initiative => initiative?.status === 'raccolta';
export const isActive = initiative => ['raccolta', 'verifica', 'in-parlamento'].includes(initiative?.status);

// ---------- writing the text and opening the collection ----------
export function createInitiative({ title, area, articles = [], kind = 'popolare' }, { date, id = null, funds = 0, home = null }) {
  const rules = INITIATIVE_KINDS[kind];
  if (!rules) throw new Error('Tipo di iniziativa non valido: scegli iniziativa popolare o raccolta firme referendaria.');
  const cleanTitle = String(title ?? '').trim();
  if (cleanTitle.length < 5) throw new Error('Il titolo deve contenere almeno 5 caratteri.');
  if (!area) throw new Error('Scegli il tema dell’iniziativa.');
  const clean = (articles ?? []).map(item => String(typeof item === 'string' ? item : item?.text ?? '').trim()).filter(Boolean);
  if (rules.articles.max > 0) {
    if (clean.length < rules.articles.min) throw new Error('Una proposta di legge popolare è scritta in articoli: scrivine almeno uno.');
    if (clean.length > rules.articles.max) throw new Error(`Al massimo ${rules.articles.max} articoli.`);
    if (clean.some(text => text.length < 12)) throw new Error('Ogni articolo deve avere almeno 12 caratteri.');
  }
  const cost = SETUP_COST[kind];
  if (funds < cost) throw new Error(`Per aprire la raccolta servono ${cost} € (moduli, autentica, materiali): ne hai ${Math.max(0, Math.round(funds))}.`);
  return {
    id: id ?? `iniziativa-${hash(`${cleanTitle}|${date}`) % 99991}`, kind, title: cleanTitle, area, articles: clean.map((text, index) => ({ n: index + 1, text })),
    createdAt: date, deadline: addDays(date, rules.weeks * 7), status: 'raccolta', required: rules.required, weeks: 0, home,
    signatures: { total: 0, byRegion: {}, byChannel: {} }, organization: { banchetti: 0, online: 0, volontari: 0, comuni: 0 }, push: { until: null, count: 0 },
    spent: cost, opposition: 0, boosts: [], history: [{ date, text: `Aperta la raccolta firme: «${cleanTitle}» (${rules.label}, ${rules.basis}). Servono ${rules.required.toLocaleString('it-IT')} firme entro il ${new Date(`${addDays(date, rules.weeks * 7)}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.` }],
    source: 'simulazione'
  };
}

// What a lever costs to add now (the first time, and the weekly upkeep from the following week).
export function organizeCost(action, amount = 1) {
  const channel = CHANNELS[action];
  if (!channel) throw new Error('Azione di raccolta sconosciuta.');
  return { setup: channel.setup * amount, weekly: channel.weekly * amount };
}
export function organize(input, action, amount, { date, funds = 0 }) {
  const initiative = JSON.parse(JSON.stringify(input));
  if (!isOpen(initiative)) throw new Error('La raccolta non è più aperta.');
  if (action === 'spinta') {
    const cost = 400;
    if (funds < cost) throw new Error(`La campagna di sensibilizzazione costa ${cost} €: ne hai ${Math.max(0, Math.round(funds))}.`);
    if (initiative.push?.until && initiative.push.until > date) throw new Error('Una campagna di sensibilizzazione è già in corso.');
    initiative.push = { until: addDays(date, 28), count: (initiative.push?.count ?? 0) + 1 };
    initiative.spent += cost;
    return { initiative: record(initiative, date, 'Campagna di sensibilizzazione: per quattro settimane la raccolta ha più visibilità.'), cost };
  }
  const channel = CHANNELS[action];
  if (!channel) throw new Error('Azione di raccolta sconosciuta.');
  const count = Math.max(1, Math.round(Number(amount) || 1));
  const room = channel.max - (initiative.organization[action] ?? 0);
  if (room <= 0) throw new Error(`Hai già il massimo per «${channel.label}» (${channel.max}).`);
  const take = Math.min(count, room);
  const cost = channel.setup * take;
  if (funds < cost) throw new Error(`Per aggiungere ${take} a «${channel.label}» servono ${cost} €: ne hai ${Math.max(0, Math.round(funds))}.`);
  initiative.organization[action] = (initiative.organization[action] ?? 0) + take;
  initiative.spent += cost;
  return { initiative: record(initiative, date, `${channel.label}: +${take} (costo iniziale ${cost} €, poi ${channel.weekly * (initiative.organization[action])} € a settimana).`), cost };
}
// What the collection costs every week while it stays open.
export const weeklyCost = initiative => isOpen(initiative) ? Object.values(CHANNELS).reduce((sum, channel) => sum + channel.weekly * (initiative.organization?.[channel.id] ?? 0), 0) : 0;

// ---------- one week of collection ----------
// ctx: { week, date, support (share of the vote of the party, %), notoriety (0-100), salience (0-1: how much the theme is felt), regions: [{ name, share }] (the share of the electorate of each region,
// summing to ~1), committees: { [region]: strength 0-100 }, home (the region of the player), rivals (0-1: how hostile the other forces are to the theme), partyStrength (0-100) }
// The signatures of a week, by channel (before the multipliers of the week): the organic ones (party, notoriety) and each lever of the collection.
export function ratePartsOf(initiative, ctx) {
  const org = initiative.organization ?? {};
  return {
    organica: 60 + Math.max(0, ctx.support ?? 0) * 55 + Math.max(0, ctx.notoriety ?? 0) * 7,
    banchetti: (org.banchetti ?? 0) * CHANNELS.banchetti.perWeek,
    online: (org.online ?? 0) * CHANNELS.online.perWeek * (0.5 + (ctx.notoriety ?? 0) / 100),
    volontari: Math.min(org.volontari ?? 0, 4 + (ctx.partyStrength ?? 30) * 3) * CHANNELS.volontari.perWeek,
    comuni: (org.comuni ?? 0) * CHANNELS.comuni.perWeek
  };
}
export function weeklyRate(initiative, ctx) {
  const parts = ratePartsOf(initiative, ctx);
  const scale = initiative.kind === 'referendum' ? 6 : 1; // a referendum needs ten times the signatures; the bigger levers reach farther
  let rate = Object.values(parts).reduce((sum, value) => sum + value, 0) * (0.55 + 0.9 * (ctx.salience ?? 0.5)) * scale;
  const push = initiative.push?.until && initiative.push.until >= ctx.date ? 1.25 : 1;
  const boost = (initiative.boosts ?? []).filter(item => item.until >= ctx.date).reduce((product, item) => product * item.factor, 1);
  const opposition = 1 - clamp(initiative.opposition ?? 0, 0, 60) / 100;
  return Math.max(0, rate * push * boost * opposition);
}
export function advanceCollection(input, ctx) {
  let initiative = JSON.parse(JSON.stringify(input));
  const events = [];
  if (!isOpen(initiative)) return { initiative, events, gained: 0 };
  const rand = seededRandom(`${initiative.id}|${ctx.week}|raccolta`);
  initiative.weeks += 1;
  // counter-campaigns and unexpected support, drawn from the week
  initiative.boosts = (initiative.boosts ?? []).filter(item => item.until >= ctx.date);
  const roll = rand();
  const hostile = clamp(ctx.rivals ?? 0.3, 0, 1);
  if (initiative.opposition < 5 && roll < 0.05 + hostile * 0.08) {
    initiative.opposition = Math.round(18 + hostile * 22);
    initiative.oppositionUntil = addDays(ctx.date, 21);
    events.push({ tone: 'bad', text: `Campagna contraria alla raccolta «${initiative.title}»: gli avversari invitano a non firmare (−${initiative.opposition}% di firme per tre settimane).` });
    initiative = record(initiative, ctx.date, `Campagna contraria: la raccolta rallenta (−${initiative.opposition}%).`);
  } else if (initiative.opposition > 0 && (!initiative.oppositionUntil || initiative.oppositionUntil <= ctx.date)) {
    initiative.opposition = 0; initiative.oppositionUntil = null;
  } else if (roll > 0.88 && roll <= 0.92 && (ctx.notoriety ?? 0) >= 20) {
    initiative.boosts.push({ factor: 1.25, until: addDays(ctx.date, 14), why: 'copertura mediatica' });
    events.push({ tone: 'good', text: `La stampa parla della raccolta «${initiative.title}»: per due settimane le firme crescono del 25%.` });
    initiative = record(initiative, ctx.date, 'Copertura mediatica: +25% di firme per due settimane.');
  } else if (roll > 0.94) {
    initiative.boosts.push({ factor: 1.2, until: addDays(ctx.date, 21), why: 'sostegno di un’associazione' });
    events.push({ tone: 'good', text: `Un’associazione rilancia la raccolta «${initiative.title}»: per tre settimane le firme crescono del 20%.` });
    initiative = record(initiative, ctx.date, 'Sostegno di un’associazione: +20% di firme per tre settimane.');
  }
  // the ordinary variation of a week is small (±5 %): the bigger moves come from recognisable events, told in the history (a campaign against, an association, the press, the party mobilised)
  const noise = 0.95 + rand() * 0.1;
  const gained = Math.round(weeklyRate(initiative, ctx) * noise);
  // the territory: each region gives in proportion to its electorate, the home region and the regions with a strong committee give more
  const regions = (ctx.regions ?? []).filter(item => item.share > 0);
  const weights = regions.map(region => region.share * (region.name === (ctx.home ?? initiative.home) ? 1.8 : 1) * (1 + (ctx.committees?.[region.name] ?? 0) / 100));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let given = 0;
  regions.forEach((region, index) => {
    const part = index === regions.length - 1 ? gained - given : Math.round(gained * weights[index] / (total || 1));
    given += part;
    initiative.signatures.byRegion[region.name] = (initiative.signatures.byRegion[region.name] ?? 0) + Math.max(0, part);
  });
  initiative.signatures.total += gained;
  const parts = ratePartsOf(initiative, ctx), sum = Object.values(parts).reduce((a, b) => a + b, 0) || 1;
  for (const [channel, value] of Object.entries(parts)) initiative.signatures.byChannel[channel] = (initiative.signatures.byChannel[channel] ?? 0) + Math.round(gained * value / sum);
  if (initiative.signatures.total >= initiative.required && !initiative.reachedAt) {
    initiative.reachedAt = ctx.date;
    events.push({ tone: 'good', text: `«${initiative.title}»: raggiunta quota ${initiative.required.toLocaleString('it-IT')} firme (${initiative.signatures.total.toLocaleString('it-IT')}). Conviene aspettare un margine per le firme non valide, poi depositare.` });
    initiative = record(initiative, ctx.date, `Raggiunte ${initiative.signatures.total.toLocaleString('it-IT')} firme: si può depositare (margine consigliato +${Math.round((kindOf(initiative).depositMargin - 1) * 100)}%).`);
  }
  if (ctx.date > initiative.deadline && initiative.signatures.total < initiative.required) {
    initiative.status = 'fallita';
    initiative.closedAt = ctx.date;
    initiative.outcome = `Scaduto il termine con ${initiative.signatures.total.toLocaleString('it-IT')} firme su ${initiative.required.toLocaleString('it-IT')}: la raccolta non ha raggiunto la soglia.`;
    events.push({ tone: 'bad', text: `Raccolta fallita: «${initiative.title}» chiude con ${initiative.signatures.total.toLocaleString('it-IT')} firme su ${initiative.required.toLocaleString('it-IT')}.`, ended: 'fallita' });
    initiative = record(initiative, ctx.date, initiative.outcome);
  } else if (ctx.date > initiative.deadline) {
    // the deadline came with enough signatures but without a deposit: the promoters file the text on the last day (what they have is checked as it is, with no margin chosen)
    initiative = depositInitiative(initiative, { date: ctx.date });
    events.push({ tone: 'neutral', text: `«${initiative.title}»: scaduto il termine, il testo è depositato con le ${initiative.signatures.total.toLocaleString('it-IT')} firme raccolte.` });
  }
  return { initiative, events, gained };
}

// ---------- deposit and check of the signatures ----------
export const depositReady = initiative => isOpen(initiative) && initiative.signatures.total >= initiative.required;
export function estimatedValid(initiative) { return Math.floor(initiative.signatures.total * ESTIMATED_VALID_SHARE); }
export function depositInitiative(input, { date }) {
  const initiative = JSON.parse(JSON.stringify(input));
  if (!isOpen(initiative)) throw new Error('La raccolta non è aperta.');
  if (initiative.signatures.total < initiative.required) throw new Error(`Mancano ${(initiative.required - initiative.signatures.total).toLocaleString('it-IT')} firme: sotto la soglia non si deposita.`);
  const rand = seededRandom(`${initiative.id}|verifica`);
  const share = 0.88 + rand() * 0.09;
  const valid = Math.floor(initiative.signatures.total * share);
  const next = { ...initiative, status: 'verifica', depositedAt: date, verification: { share: Math.round(share * 1000) / 1000, valid, until: addDays(date, 14) } };
  return record(next, date, `Depositate ${initiative.signatures.total.toLocaleString('it-IT')} firme: la verifica durerà due settimane.`);
}
// The check closes: enough valid signatures → the text goes to Parliament; too few → refused (the lesson: keep a margin).
export function settleVerification(input, { date }) {
  let initiative = JSON.parse(JSON.stringify(input));
  const events = [];
  if (initiative.status !== 'verifica' || date < initiative.verification.until) return { initiative, events };
  const { valid, share } = initiative.verification;
  if (valid < initiative.required) {
    initiative.status = 'respinta';
    initiative.closedAt = date;
    initiative.outcome = `Verifica: ${valid.toLocaleString('it-IT')} firme valide su ${initiative.required.toLocaleString('it-IT')} (il ${Math.round(share * 100)}% di quelle depositate). Non basta: il deposito è respinto.`;
    events.push({ tone: 'bad', text: `Deposito respinto per «${initiative.title}»: ${valid.toLocaleString('it-IT')} firme valide, ne servivano ${initiative.required.toLocaleString('it-IT')}.`, ended: 'respinta' });
    return { initiative: record(initiative, date, initiative.outcome), events };
  }
  if (initiative.kind === 'referendum') {
    initiative.status = 'depositata';
    initiative.closedAt = date;
    initiative.outcome = `Firme valide: ${valid.toLocaleString('it-IT')}. La richiesta di referendum è depositata: ora la verifica dell’Ufficio centrale presso la Cassazione, il giudizio della Corte costituzionale e il voto (pagina «Referendum»).`;
    events.push({ tone: 'good', text: `Referendum «${initiative.title}»: ${valid.toLocaleString('it-IT')} firme valide, richiesta depositata.`, ended: 'depositata' });
    return { initiative: record(initiative, date, initiative.outcome), events };
  }
  initiative.status = 'in-parlamento';
  initiative.parliament = { chamber: hash(initiative.id) % 2 ? 'camera' : 'senato', enteredAt: date, stage: 'assegnata', weeks: 0 };
  events.push({ tone: 'good', text: `Verifica superata per «${initiative.title}»: ${valid.toLocaleString('it-IT')} firme valide. Il testo è presentato ${initiative.parliament.chamber === 'camera' ? 'alla Camera' : 'al Senato'}.` });
  return { initiative: record(initiative, date, `Firme valide (${valid.toLocaleString('it-IT')}): il testo è assegnato ${initiative.parliament.chamber === 'camera' ? 'alla Camera' : 'al Senato'}.`), events };
}

// ---------- the parliamentary phase (simulated) ----------
export const PARLIAMENT_STAGES = Object.freeze([
  { id: 'assegnata', label: 'Assegnata a una commissione', weeks: 6 },
  { id: 'commissione', label: 'Esame in commissione', weeks: 20 },
  { id: 'aula', label: 'In Aula', weeks: 6 }
]);
// ctx.support: 0..1, how much the groups of the Chamber are inclined to take the text (computed from the Parliament of the game); ctx.margin: how much more than the minimum the signatures are.
export function advanceParliamentPhase(input, ctx) {
  let initiative = JSON.parse(JSON.stringify(input));
  const events = [];
  if (initiative.status !== 'in-parlamento') return { initiative, events };
  const phase = initiative.parliament;
  phase.weeks += 1;
  const rand = seededRandom(`${initiative.id}|${phase.weeks}|parlamento`);
  const total = PARLIAMENT_STAGES.reduce((sum, stage) => sum + stage.weeks, 0);
  let at = 0, stage = PARLIAMENT_STAGES.at(-1);
  for (const item of PARLIAMENT_STAGES) { at += item.weeks; if (phase.weeks <= at) { stage = item; break; } }
  if (stage.id !== phase.stage) { phase.stage = stage.id; events.push({ tone: 'neutral', text: `«${initiative.title}»: ${stage.label.toLowerCase()}.` }); initiative = record(initiative, ctx.date, stage.label); }
  if (phase.weeks >= total) {
    // the end: most popular initiatives are never calendared; with strong support in the Chamber and a wide margin the text may become law
    const margin = clamp((initiative.signatures.total / initiative.required - 1) * 0.5, 0, 0.15);
    const chance = clamp(0.06 + (ctx.support ?? 0.3) * 0.5 + margin, 0.03, 0.7);
    const passed = rand() < chance;
    initiative.status = passed ? 'approvata' : 'archiviata';
    initiative.closedAt = ctx.date;
    initiative.outcome = passed ? 'Il Parlamento ha approvato il testo (anche con modifiche): è una vittoria della raccolta.' : 'Il Parlamento non ha calendarizzato il testo: l’iniziativa è archiviata. Si può ripresentare.';
    events.push({ tone: passed ? 'good' : 'bad', text: passed ? `Il Parlamento ha approvato il testo di «${initiative.title}» (anche con modifiche): è una vittoria della raccolta.` : `Il Parlamento non ha calendarizzato il testo di «${initiative.title}»: l’iniziativa è archiviata. Si può ripresentare.`, ended: initiative.status });
    initiative = record(initiative, ctx.date, initiative.outcome);
  }
  return { initiative, events };
}

// ---------- the effects of an ending on the career (told once) ----------
export function endingEffects(initiative) {
  const gained = initiative.signatures?.total ?? 0;
  const ratio = clamp(gained / (initiative.required || 1), 0, 2);
  const table = {
    approvata: { reputation: 3, popularity: 2, support: 2.5, notoriety: 3 },
    archiviata: { reputation: 0.8, popularity: 0.5, support: 0.8, notoriety: 1.2 },
    depositata: { reputation: 2.5, popularity: 1.5, support: 2, notoriety: 3 },
    respinta: { reputation: -1.5, popularity: -0.8, support: -0.8, notoriety: 0.3 },
    fallita: { reputation: -1 - (1 - Math.min(1, ratio)) * 1.5, popularity: -0.6, support: -0.6, notoriety: 0.5 },
    ritirata: { reputation: -0.4, popularity: -0.2, support: -0.2, notoriety: 0 }
  };
  return table[initiative.status] ?? null;
}
export function withdraw(input, { date }) {
  const initiative = JSON.parse(JSON.stringify(input));
  if (!isOpen(initiative)) throw new Error('Si ritira solo una raccolta ancora aperta.');
  initiative.status = 'ritirata'; initiative.closedAt = date; initiative.outcome = 'Raccolta ritirata dal promotore.';
  return record(initiative, date, initiative.outcome);
}

// What a page shows for one initiative (the progress, the pace, the forecast of the deadline).
export function overview(initiative, ctx = null) {
  const rules = kindOf(initiative);
  const total = initiative.signatures?.total ?? 0;
  const left = Math.max(0, initiative.required - total);
  const rate = ctx ? Math.round(weeklyRate(initiative, ctx)) : null;
  const weeksLeft = isOpen(initiative) && ctx ? Math.max(0, Math.ceil((new Date(`${initiative.deadline}T12:00:00Z`) - new Date(`${ctx.date}T12:00:00Z`)) / (7 * 24 * 3600 * 1000))) : null;
  const forecast = rate && weeksLeft !== null ? total + rate * weeksLeft : null;
  return { rules, total, left, percent: Math.min(100, Math.round(total * 1000 / initiative.required) / 10), rate, weeksLeft, forecast, onTrack: forecast === null ? null : forecast >= initiative.required, valid: estimatedValid(initiative), weeklyCost: weeklyCost(initiative), ready: depositReady(initiative), margin: Math.ceil(initiative.required * rules.depositMargin) };
}
