// Starting difficulty: chosen once in the Career Wizard, it changes how the whole simulation treats the player,
// not just a number. Every system reads the same table through difficultyOf().
export const DIFFICULTIES = Object.freeze({
  facile: {
    label: 'Facile', short: 'Più margine per imparare',
    detail: 'Più fondi e capitale, eventi negativi meno frequenti, esiti incerti più spesso favorevoli, alleati e partito più tolleranti, maggioranze più disciplinate.',
    funds: 1.4, capital: 10, capitalGain: 1, apBonus: 1, statStart: 5, relationStart: 6,
    badEvents: 0.7, goodEvents: 1.25, luck: 0.12, riskChance: 0.75,
    expulsionBelow: 12, resignationBelow: 8, candidacy: 0.12, allianceChance: 0.08,
    discipline: 0.05, partnerDrift: 0.7, pollNoise: 0.8, shock: 0.8, memoryFade: 0.85
  },
  normale: {
    label: 'Normale', short: 'L’equilibrio previsto',
    detail: 'Risorse, probabilità e reazioni del mondo politico calibrate come nella simulazione di riferimento.',
    funds: 1, capital: 0, capitalGain: 0, apBonus: 0, statStart: 0, relationStart: 0,
    badEvents: 1, goodEvents: 1, luck: 0, riskChance: 1,
    expulsionBelow: 20, resignationBelow: 12, candidacy: 0, allianceChance: 0,
    discipline: 0, partnerDrift: 1, pollNoise: 1, shock: 1, memoryFade: 1
  },
  difficile: {
    label: 'Difficile', short: 'Ogni errore si paga',
    detail: 'Meno fondi e capitale, crisi più frequenti, esiti incerti più spesso sfavorevoli, partito e alleati meno indulgenti, candidature più contese, maggioranze più fragili e memoria più lunga.',
    funds: 0.7, capital: -8, capitalGain: -1, apBonus: 0, statStart: -5, relationStart: -6,
    badEvents: 1.4, goodEvents: 0.8, luck: -0.12, riskChance: 1.3,
    expulsionBelow: 27, resignationBelow: 16, candidacy: -0.14, allianceChance: -0.1,
    discipline: -0.06, partnerDrift: 1.45, pollNoise: 1.25, shock: 1.25, memoryFade: 1.3
  }
});
export const DIFFICULTY_IDS = Object.freeze(Object.keys(DIFFICULTIES));
export const difficultyOf = value => DIFFICULTIES[value?.difficulty ?? value] ?? DIFFICULTIES.normale;
export const difficultyId = value => DIFFICULTIES[value?.difficulty ?? value] ? (value?.difficulty ?? value) : 'normale';
// Categories of events that hurt the player: their frequency follows the difficulty.
export const HARD_CATEGORIES = Object.freeze(['scandalo', 'emergenza', 'sicurezza', 'economia', 'memoria', 'sociale', 'crisi']);
export const SOFT_CATEGORIES = Object.freeze(['media', 'opportunita', 'territorio-positivo']);
