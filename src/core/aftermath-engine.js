// What an election leaves behind: the numbers of the career, the party, the internal balance, the office and the
// next political moves. A defeat never ends the career; a victory never hands out a Government by itself.
const SIM = 'simulation';
const round2 = value => Math.round(value * 100) / 100;

// Base effect of each way an election can end (reputation, influence, notoriety, popularity, party support,
// relation with the leadership, political capital).
const BASE = Object.freeze({
  vittoria: { reputation: 3, influence: 4, notoriety: 3, popularity: 2, support: 6, leadership: 3, capital: 4 },
  'ballottaggio-vinto': { reputation: 3, influence: 4, notoriety: 3.5, popularity: 2, support: 6, leadership: 3, capital: 4 },
  eletto: { reputation: 2, influence: 2.5, notoriety: 2, popularity: 1, support: 4, leadership: 2, capital: 2 },
  'eletto-lista': { reputation: 2, influence: 2.5, notoriety: 2, popularity: 1, support: 4, leadership: 2, capital: 2 },
  'eletto-coalizione': { reputation: 1.5, influence: 2, notoriety: 1.5, popularity: 1, support: 3, leadership: 1, capital: 2 },
  'eletto-proporzionale': { reputation: 1, influence: 1.5, notoriety: 1.5, popularity: 0, support: 2, leadership: 1, capital: 1 },
  'eletto-opposizione': { reputation: 1, influence: 1, notoriety: 1.5, popularity: .5, support: 1, leadership: 0, capital: 1 },
  'primo-non-eletto': { reputation: 0, influence: -.5, notoriety: 1, popularity: 0, support: 0, leadership: 0, capital: 0 },
  'non-eletto': { reputation: -.5, influence: -1, notoriety: .5, popularity: 0, support: -1, leadership: 0, capital: 0 },
  'posizione-lista': { reputation: -.5, influence: -1, notoriety: .5, popularity: 0, support: -1, leadership: -1, capital: 0 },
  'ballottaggio-perso': { reputation: -1, influence: -1.5, notoriety: 1, popularity: 0, support: -2, leadership: -1, capital: -1 },
  sconfitta: { reputation: -2, influence: -2.5, notoriety: .5, popularity: -.5, support: -3, leadership: -2, capital: -2 },
  'sotto-soglia': { reputation: -2.5, influence: -3, notoriety: 0, popularity: -1, support: -4, leadership: -3, capital: -2 },
  escluso: { reputation: -1.5, influence: -2, notoriety: -.5, popularity: 0, support: -3, leadership: -4, capital: -1 }
});
const EXECUTIVES = { comunale: 'il sindaco', regionale: 'il presidente della Regione' };

// electionAftermath({ campaign, result, game, player }) → consequences, applied by the store.
export function electionAftermath({ campaign, result, game = null, player = null }) {
  const outcome = result.outcome ?? { code: result.personalMandate ? 'eletto' : 'sconfitta', expectation: 'in-linea', margin: null };
  const base = { ...(BASE[outcome.code] ?? BASE.sconfitta) };
  const lines = [];
  // Expectations: a result above what everyone expected counts almost as much as the result itself.
  const expectation = outcome.expectation === 'sopra' ? 1 : outcome.expectation === 'sotto' ? -1 : 0;
  if (expectation) {
    base.reputation += expectation; base.influence += 1.5 * expectation; base.support += 2 * expectation; base.leadership += expectation > 0 ? 1 : -1.5;
    lines.push(expectation > 0 ? `Sopra le attese: ${outcome.expected}% atteso, ${result.playerShare}% ottenuto.` : `Sotto le attese: ${outcome.expected}% atteso, ${result.playerShare}% ottenuto.`);
  }
  // A narrow defeat is less damaging; a landslide victory opens more doors.
  const margin = outcome.margin ?? 0;
  const narrowLoss = !outcome.mandate && outcome.position === 2 && margin > -3;
  if (narrowLoss) for (const key of ['reputation', 'influence', 'support', 'leadership']) base[key] = round2(base[key] * .6);
  if (outcome.mandate && outcome.position === 1 && margin > 15) { base.influence += 1; lines.push('Vittoria larga: il tuo peso politico cresce.'); }
  const party = game?.party ?? null;
  const member = party?.affiliation === 'member';
  // Internal balance: winners bring their area forward, losers give ammunition to the others.
  const currents = party ? { aligned: outcome.mandate ? 4 : -2, others: outcome.mandate ? 1 : -3 } : null;
  const hostile = party ? [...(party.currents ?? [])].filter(current => current.id !== party.alignedCurrentId).sort((a, b) => b.strength - a.strength)[0] ?? null : null;
  // The office that comes with the vote, and on which side of the council.
  const role = campaign.candidacy?.role;
  const titles = { sindaco: 'Sindaco', presidente: 'Presidente di Regione', consigliere: campaign.electionType === 'comunale' ? 'Consigliere comunale' : 'Consigliere regionale', deputato: 'Deputato', senatore: 'Senatore', uninominale: 'Deputato', eurodeputato: 'Deputato al Parlamento europeo' };
  let office = null;
  if (outcome.mandate) {
    const title = outcome.code === 'eletto-opposizione' ? (campaign.electionType === 'comunale' ? 'Consigliere comunale' : 'Consigliere regionale') : titles[role] ?? 'Rappresentante eletto';
    office = { title, side: outcome.side ?? null, via: outcome.via ?? null };
  }
  // Next moves: what the vote opens, never granted.
  const events = [];
  const electionLabel = campaign.electionLabel ?? campaign.electionType;
  const place = campaign.electionType === 'comunale' ? `Comune di ${player?.municipality ?? 'il tuo comune'}` : campaign.electionType === 'regionale' ? `Regione ${player?.region ?? ''}`.trim() : 'Repubblica italiana';
  // A seat won from the opposition benches after losing the race is a defeat to digest, not a victory.
  if (outcome.mandate && outcome.code !== 'eletto-opposizione') events.push({ id: 'dopo-voto-vittoria', params: { election: electionLabel, outcome: outcome.label.toLowerCase() } });
  else events.push({ id: 'dopo-voto-sconfitta', params: { election: electionLabel, outcome: outcome.label } });
  if (['comunale', 'regionale'].includes(campaign.electionType) && outcome.mandate && outcome.side === 'maggioranza' && !['sindaco', 'presidente'].includes(role)) {
    events.push({ id: 'giunta-offerta', params: { executive: EXECUTIVES[campaign.electionType], institution: place, level: campaign.electionType, assessorLevel: campaign.electionType === 'comunale' ? 'comunale' : 'regionale' } });
  }
  if (['sindaco', 'presidente'].includes(role) && outcome.mandate && outcome.side === 'maggioranza') events.push({ id: 'giunta-composizione', params: { institution: place } });
  if (outcome.code === 'eletto-opposizione' || (outcome.mandate && outcome.side === 'opposizione')) events.push({ id: 'capogruppo-opposizione', params: { institution: place, level: campaign.electionType } });
  if (narrowLoss) events.push({ id: 'ricorso-elettorale', params: { margin: String(Math.max(1, Math.ceil(Math.abs(margin)))) } });
  if (member && !outcome.mandate && hostile && ['sconfitta', 'sotto-soglia', 'ballottaggio-perso', 'escluso'].includes(outcome.code)) events.push({ id: 'resa-dei-conti', params: { currentA: hostile.label, currentAId: hostile.id } });
  if (campaign.electionType === 'politiche' && outcome.mandate && party) events.push({ id: 'consultazioni-governo', params: { election: electionLabel } });
  if ((campaign.commitments ?? 0) > 0 && outcome.mandate) events.push({ id: 'impegni-elettorali', params: { commitments: String(campaign.commitments) } });
  const government = campaign.electionType === 'politiche'
    ? (outcome.mandate ? 'Un seggio non dà un posto nel governo: la squadra la decidono il Presidente del Consiglio e gli equilibri di coalizione.' : 'Senza seggio segui la formazione del governo dall’esterno.')
    : ['sindaco', 'presidente'].includes(role) && outcome.mandate ? 'Da capo dell’esecutivo locale scegli la giunta: alleati e partito si aspettano posti.' : null;
  return {
    code: outcome.code, label: outcome.label, tone: outcome.tone ?? (outcome.mandate ? 'good' : 'bad'),
    stats: { reputation: round2(base.reputation), influence: round2(base.influence), notoriety: round2(base.notoriety), popularity: round2(base.popularity) },
    consensus: result.playerShare,
    party: party ? { support: round2(base.support), leadership: round2(base.leadership), currents } : null,
    capital: base.capital, office, events, lines, government, narrowLoss,
    memory: { kind: outcome.mandate ? 'vittoria-elettorale' : 'sconfitta-elettorale', weight: outcome.mandate ? (outcome.position === 1 ? 1.3 : 1.1) : outcome.code === 'sotto-soglia' ? 1.2 : .9 },
    source: SIM
  };
}
