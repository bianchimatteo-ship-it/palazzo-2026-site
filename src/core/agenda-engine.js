// The political agenda: every dated commitment of the career in one calendar — votes and candidacy windows,
// candidate selection, congresses, promises to verify, pending consequences, decrees to convert, allies' demands,
// investments that expire and decisions held until a date. Read-only: it derives everything from the state.
import { advanceDays, formatDate } from './time.js?v=20260926-2';
import { upcomingElections } from './career-engine.js?v=20260926-2';
import { SELECTION_LEAD_DAYS } from '../data/simulation/organization-rules.js?v=20260926-2';

export const AGENDA_KINDS = Object.freeze({
  elezione: { label: 'Elezioni', icon: 'ballot' },
  candidature: { label: 'Candidature', icon: 'ballot' },
  campagna: { label: 'Campagna', icon: 'megaphone' },
  selezione: { label: 'Selezione dei candidati', icon: 'users' },
  congresso: { label: 'Congresso', icon: 'crown' },
  promessa: { label: 'Promessa', icon: 'target' },
  conseguenza: { label: 'Conseguenza', icon: 'route' },
  decreto: { label: 'Decreto-legge', icon: 'law' },
  alleato: { label: 'Richiesta di un alleato', icon: 'link' },
  investimento: { label: 'Investimento', icon: 'money' },
  decisione: { label: 'Decisione', icon: 'alert' },
  legislatura: { label: 'Legislatura e governo', icon: 'dome' }
});
const CLOSED = ['approved', 'rejected', 'lapsed'];
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);
// The date a future week of the career begins (weeks last seven days from the start of the current one).
export function weekDate(game, week) {
  const start = game?.week?.startedAt;
  if (!start || !Number.isFinite(week)) return null;
  return advanceDays(start, (week - (game.week.index ?? 0)) * 7);
}

// agendaCalendar(state) → [{ id, date, kind, title, detail, tone, urgent, days, action }] sorted by date.
export function agendaCalendar(state, { horizonDays = 730 } = {}) {
  const game = state?.game;
  if (!game) return [];
  const today = state.clock?.currentDate ?? game.week?.startedAt;
  const items = [];
  const add = item => {
    if (!item.date) return;
    const days = daysBetween(today, item.date);
    if (days < 0 || days > horizonDays) return;
    items.push({ tone: 'neutral', urgent: false, action: null, ...item, days });
  };
  const campaign = state.campaign;
  const party = game.party;
  // Votes: when the candidacy window opens and closes, and the day of the vote.
  for (const entry of upcomingElections(game)) {
    if (entry.status === 'upcoming') {
      add({ id: `${entry.id}-apertura`, date: entry.windowOpensAt, kind: 'candidature', title: `Si aprono le candidature: ${entry.label}`, detail: `Finestra fino al ${formatDate(entry.windowClosesAt)}${entry.early ? ' · elezioni anticipate' : ''}.`, action: { type: 'fastforward', election: entry } });
      if (party?.affiliation === 'member' && !party.org?.selections?.[entry.id]) add({ id: `${entry.id}-selezione`, date: advanceDays(entry.windowOpensAt, -SELECTION_LEAD_DAYS), kind: 'selezione', title: `Il partito sceglie i candidati: ${entry.label}`, detail: 'Il metodo di selezione pesa sulla tua candidatura: arrivaci con sostegno interno alto.' });
    }
    if (entry.status === 'open') add({ id: `${entry.id}-chiusura`, date: entry.windowClosesAt, kind: 'candidature', title: `Ultimo giorno per candidarti: ${entry.label}`, detail: 'Se non ti candidi, un mandato dello stesso tipo si conclude.', tone: 'warn', urgent: true, action: { type: 'tab', section: 'elezioni', tab: 'campagna' } });
    if (entry.status !== 'missed') add({ id: `${entry.id}-voto`, date: entry.electionDate, kind: 'elezione', title: `Si vota: ${entry.label}`, detail: entry.status === 'running' ? 'Sei in campagna.' : entry.status === 'open' ? 'Candidature aperte.' : 'In calendario.', tone: entry.status === 'running' ? 'warn' : 'neutral', action: { type: 'nav', page: 'elezioni' } });
  }
  // The campaign in progress: the internal nomination deadline and the vote (with the runoff, if any).
  if (campaign?.status === 'active') {
    const start = advanceDays(campaign.currentDate ?? today, -(campaign.day ?? 0));
    if (campaign.nomination?.status === 'pending') add({ id: `${campaign.id}-nomina`, date: advanceDays(start, campaign.nomination.deadlineDay ?? 0), kind: 'campagna', title: 'Il partito decide la tua candidatura', detail: `Sostegno interno ${campaign.nomination.internalSupport}/10 su una soglia di ${campaign.nomination.requiredSupport}: superarla non basta, contano anche i rivali interni.`, tone: 'warn', urgent: true, action: { type: 'tab', section: 'elezioni', tab: 'candidatura' } });
    if (campaign.electionDate && !upcomingElections(game).some(entry => entry.status === 'running' && entry.electionDate === campaign.electionDate)) add({ id: `${campaign.id}-voto`, date: campaign.electionDate, kind: 'elezione', title: `Si vota: ${campaign.electionLabel}`, detail: 'Sei in campagna.', tone: 'warn', action: { type: 'tab', section: 'elezioni', tab: 'campagna' } });
    if (campaign.stage === 'ballottaggio') add({ id: `${campaign.id}-ballottaggio`, date: advanceDays(start, campaign.totalDays ?? 0), kind: 'elezione', title: 'Ballottaggio', detail: 'Due candidati: conta chi convince gli elettori degli esclusi.', tone: 'warn', urgent: true, action: { type: 'tab', section: 'elezioni', tab: 'campagna' } });
  }
  // The party: congresses and the internal selection of candidates.
  if (party?.org && !party.org.founder && Number.isFinite(party.org.congress?.nextWeek)) {
    const date = weekDate(game, party.org.congress.nextWeek);
    add({ id: `congresso-${party.org.congress.nextWeek}`, date, kind: 'congresso', title: 'Congresso del partito', detail: party.alignedCurrentId ? 'La tua area si gioca la guida del partito: sostegno e rapporti contano al voto degli iscritti.' : 'Schierati con un’area prima del voto: chi resta neutrale conta meno.', tone: 'neutral', action: { type: 'tab', section: 'partito', tab: 'ruoli' } });
  }
  // Promises made to citizens, verified on the due week.
  for (const promise of (game.promises ?? []).filter(item => item.status === 'open')) add({ id: promise.id, date: weekDate(game, promise.dueWeek), kind: 'promessa', title: `Verifica della promessa: ${promise.topic} in ${promise.region}`, detail: 'Serve una legge sul tema o un miglioramento reale dell’indicatore promesso.', tone: 'warn', urgent: promise.dueWeek - game.week.index <= 4, action: { type: 'nav', page: 'territori' } });
  // Consequences of past choices, due in the coming weeks.
  for (const item of game.pending ?? []) add({ id: item.id, date: weekDate(game, item.dueWeek), kind: 'conseguenza', title: item.hint, detail: `Da “${item.origin}”${item.chance < 1 ? ` · probabilità ${Math.round(item.chance * 100)}%` : ''}.` });
  // Parliament and government: decrees to convert and allies' demands with a deadline.
  const parliament = state.parliament;
  for (const law of (parliament?.laws ?? []).filter(item => item.kind === 'decreto' && item.deadline && !CLOSED.includes(item.stage))) add({ id: `decreto-${law.id}`, date: law.deadline, kind: 'decreto', title: `Conversione del decreto “${law.title}”`, detail: 'Se il Parlamento non lo converte entro 60 giorni, decade.', tone: 'bad', urgent: daysBetween(today, law.deadline) <= 14, action: { type: 'nav', page: 'leggi' } });
  const partners = parliament?.government?.partners ?? {};
  for (const [groupId, partner] of Object.entries(partners)) {
    if (!partner?.demand?.deadline) continue;
    const group = Object.values(parliament.chambers ?? {}).flatMap(chamber => chamber.groups ?? []).find(item => item.groupId === groupId);
    add({ id: `richiesta-${groupId}-${partner.demand.deadline}`, date: partner.demand.deadline, kind: 'alleato', title: `${group?.officialName ?? 'Un alleato'} chiede ${partner.demand.label}`, detail: 'Se la richiesta resta senza risposta, il sostegno al governo vacilla.', tone: 'warn', action: { type: 'nav', page: 'governo' } });
  }
  // The national cycle: lists filed for the general election, the steps of the formation of the Government, the end
  // of the legislature.
  const national = state.national;
  if (national?.campaign && !national.campaign.fixed) add({ id: `liste-${national.campaign.electionId}`, date: national.campaign.filingDate, kind: 'legislatura', title: 'Deposito delle liste per le politiche', detail: 'Da quel giorno le coalizioni sono fissate fino al voto.', tone: 'warn', action: { type: 'tab', section: 'elezioni', tab: 'nazionali' } });
  const formation = national?.formation;
  if (formation && !['completata', 'fallita'].includes(formation.phase)) {
    const step = formation.phase === 'insediamento' ? [formation.firstSitting, formation.crisis ? 'Consultazioni al Quirinale' : 'Prima seduta delle nuove Camere', 'Poi si aprono le consultazioni.']
      : formation.phase === 'consultazioni' ? [formation.consultationsEnd, 'Si chiudono le consultazioni', 'Il Presidente della Repubblica affida l’incarico.']
      : formation.phase === 'incarico' ? [formation.playerAccepted ? formation.confidenceAt : formation.mandateEnd, formation.playerAccepted ? 'Il tuo governo davanti alle Camere' : 'Scade l’incarico', formation.playerAccepted ? 'Entro questa data chiedi la fiducia (sezione Governo).' : 'Accetta o rinuncia all’incarico.']
      : [formation.confidenceAt, 'Voto di fiducia al nuovo governo', 'Camera e Senato votano la fiducia.'];
    add({ id: `formazione-${formation.resultId}-${formation.phase}`, date: step[0], kind: 'legislatura', title: step[1], detail: step[2], tone: formation.phase === 'incarico' ? 'warn' : 'neutral', action: { type: 'tab', section: 'elezioni', tab: 'nazionali' } });
    if (formation.deadline) add({ id: `formazione-${formation.resultId}-scadenza`, date: formation.deadline, kind: 'legislatura', title: 'Termine per formare il governo', detail: 'Senza una maggioranza le Camere vengono sciolte.' });
  }
  if (national?.legislature?.naturalEnd) add({ id: `fine-legislatura-${national.legislature.number}`, date: national.legislature.naturalEnd, kind: 'legislatura', title: `Scadenza della ${national.legislature.label}`, detail: 'Le Camere scadono cinque anni dopo la prima seduta.' });
  // Money: investments that expire.
  for (const asset of (game.finance?.assets ?? []).filter(item => item.untilWeek)) add({ id: `asset-${asset.id}-${asset.untilWeek}`, date: weekDate(game, asset.untilWeek + 1), kind: 'investimento', title: `Scade: ${asset.label}`, detail: 'Dopo la scadenza l’effetto si esaurisce.', action: { type: 'nav', page: 'finanze' } });
  for (const investment of (party?.org?.investments ?? []).filter(item => item.untilWeek && item.untilWeek >= game.week.index)) add({ id: `partito-${investment.id}-${investment.untilWeek}`, date: weekDate(game, investment.untilWeek + 1), kind: 'investimento', title: `Scade l’investimento del partito: ${investment.label ?? investment.id}`, detail: 'Tesoreria del partito.', action: { type: 'nav', page: 'finanze' } });
  // Decisions on the desk: the ones held until a date (after a vote) and the ones due at the end of the week.
  const weekEnd = advanceDays(game.week.startedAt ?? today, 6);
  for (const item of game.inbox ?? []) add({ id: `decisione-${item.id}`, date: item.holdUntilDate && item.holdUntilDate > weekEnd ? item.holdUntilDate : weekEnd > today ? weekEnd : today, kind: 'decisione', title: item.title, detail: item.holdUntilDate && item.holdUntilDate > weekEnd ? 'In attesa: la decisione si chiude dopo questa data.' : `Entro fine settimana, altrimenti: “${item.choices?.find(choice => choice.id === item.defaultChoice)?.label ?? 'scelta predefinita'}”.`, tone: ['urgente', 'situazione'].includes(item.kind) ? 'bad' : 'neutral', urgent: ['urgente', 'situazione'].includes(item.kind), action: { type: 'tab', section: 'agenda', tab: 'settimana' } });
  return items.sort((a, b) => a.date.localeCompare(b.date) || Number(b.urgent) - Number(a.urgent) || a.title.localeCompare(b.title));
}

// The calendar grouped by month, for the interface.
export function agendaByMonth(items) {
  const months = new Map();
  for (const item of items) { const key = item.date.slice(0, 7); months.set(key, [...(months.get(key) ?? []), item]); }
  return [...months.entries()].map(([month, entries]) => ({ month, entries }));
}
