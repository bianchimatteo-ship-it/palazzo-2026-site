// What a minister takes on by himself: the dossiers of the Council of Ministers (an objective, a term, a result that is read from what the game really does),
// and the balance of the Government's programme. Game mechanics (source: simulation): no dossier describes a real decision of a real minister.

export const DOSSIER_KINDS = Object.freeze({
  riforma: { id: 'riforma', label: 'Riforma', icon: 'law', verb: 'Portare in porto un provvedimento', criterion: 'Una legge o un decreto della maggioranza nella materia, approvato entro la scadenza.' },
  emergenza: { id: 'emergenza', label: 'Emergenza', icon: 'alert', verb: 'Rimettere in sesto un settore', criterion: 'Il livello del settore, misurato sul Paese, raggiunge l’obiettivo entro la scadenza.' }
});

export const DOSSIER_RULES = Object.freeze({
  // At most so many dossiers open at once; the closed ones stay in the record.
  maxOpen: 6, kept: 14,
  // A minister opens his first dossier after this many weeks (staggered by hash) and a new one every so many weeks after the last closed.
  firstDelay: [2, 30], cooldown: [14, 30],
  // Terms (weeks), the rise a Government asks of a sector in trouble (points, capped), the severity of a problem that calls for an emergency dossier.
  riformaWeeks: 30, emergenzaWeeks: 26, areaGain: 8, areaCap: 92, severity: 6,
  // A dossier near its term with this much done is postponed once by the minister himself; the extension is this long.
  autoPostponeAt: 60, postponeWeeks: 8,
  // The player's help: money for a sector in trouble (points of fiscal margin, paid once) raises the sector over the weeks; a bill drafted by the minister.
  fund: { cost: 3, perWeek: 0.5, weeks: 10, minHeadroom: 4 },
  // The alarm reaches the desk when, past half of the term, the dossier has done less than this.
  alarm: { elapsed: 0.5, below: 40 },
  // What a result does, once: loyalty of the minister, stability of the Government, satisfaction of his group, competence (success) or pressure (failure).
  success: { loyalty: 6, stability: 2, partner: 4, competence: 1 },
  failure: { loyalty: -8, stability: -2, partner: -5, pressure: 1 },
  postponed: { loyalty: -2 },
  withdrawn: { loyalty: -4, partner: -3 },
  // Pressure on a minister raises the chance he falls; it fades by this share every quarter.
  pressure: { trouble: 0.6, fade: 0.5, every: 13 },
  // The programme: after this many weeks it is balanced against the measures enacted in its priority areas, once.
  program: { weeks: 24, good: 0.66, bad: 0.2, goodStability: 3, goodPartner: 2, badStability: -4, badPartner: -3 },
  source: 'simulation'
});

// How far a bill is: the share of the way to enactment.
export const LAW_PROGRESS = Object.freeze({ proposal: 10, commission: 30, amendments: 50, 'other-chamber': 70, 'final-vote': 85, approved: 100 });
