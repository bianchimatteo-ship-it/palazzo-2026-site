// The rivals between one campaign and the next (rival-life-engine.js): they do not vanish when the vote is over. A rival the player has met (game.rivalRegistry) acts on his own, by his
// personality and by what he remembers of the player: an attack, an olive branch, a challenge on a theme of the player's own programme, a rematch. Each move reaches the desk as a situation event
// with real choices; the answer is remembered by the rival and comes back in the next campaign. Everything is simulated; no rival describes a real person (the names are the generated ones of the campaigns).
export const RIVAL_LIFE = Object.freeze({
  minGapWeeks: 6, rivalGapWeeks: 20, baseChance: 0.14,
  // how a memory type reads in a sentence about the rival
  memoryLines: Object.freeze({
    attack: 'non ha dimenticato gli attacchi della campagna', betrayal: 'ricorda ancora il tradimento di un accordo', rejection: 'ricorda di essere stato respinto', aid: 'ricorda l’aiuto ricevuto',
    agreement: 'ricorda con favore l’intesa raggiunta', victory: 'ricorda di aver vinto contro di te', defeat: 'ricorda di aver perso contro di te'
  }),
  personalityLabels: Object.freeze({ aggressivo: 'un tipo aggressivo', prudente: 'un tipo prudente', opportunista: 'un tipo opportunista', diplomatico: 'un tipo diplomatico', ideologico: 'un tipo ideologico', territoriale: 'un uomo del territorio' })
});

export const RIVAL_SITUATIONS = Object.freeze({
  'rivale-attacco': { id: 'rivale-attacco', title: '{rival} torna all’attacco', body: '{rival}, {personality}, {memoryLine}: in un’intervista ti accusa di {charge}. Chi osserva aspetta di vedere come rispondi (comportamento simulato).', defaultChoice: 'ignora', choices: [
    { id: 'rispondi', label: 'Rispondi nel merito, con i fatti', cost: { ap: 1 }, effects: { stats: { reputation: 0.8, popularity: 0.6 } }, special: 'rival-reply' },
    { id: 'contrattacca', label: 'Contrattacca duramente', effects: { stats: { notoriety: 1.2, reputation: -0.5 } }, special: 'rival-counter' },
    { id: 'ignora', label: 'Lascia cadere', effects: { stats: { popularity: -0.4 } }, special: 'rival-ignore' }] },
  'rivale-mano-tesa': { id: 'rivale-mano-tesa', title: '{rival} ti tende la mano', body: '{rival}, {personality}, {memoryLine}, e ti propone di lavorare insieme su {topic}: un tavolo comune, senza etichette (comportamento simulato).', defaultChoice: 'attendi', choices: [
    { id: 'accetta', label: 'Accetta il tavolo comune', cost: { ap: 1 }, effects: { stats: { influence: 0.6, reputation: 0.4 } }, special: 'rival-accept' },
    { id: 'attendi', label: 'Prendi tempo', effects: {}, special: 'rival-wait' },
    { id: 'rifiuta', label: 'Declina con cortesia', effects: { stats: { notoriety: 0.3 } }, special: 'rival-refuse' }] },
  'rivale-sfida-tema': { id: 'rivale-sfida-tema', title: '{rival} ti sfida su {topic}', body: '{rival}, {personality}, {memoryLine}: davanti alle telecamere dice che sul tema «{topic}» le tue promesse sono parole al vento e ti invita a un confronto pubblico (comportamento simulato).', defaultChoice: 'ignora', choices: [
    { id: 'duello', label: 'Accetta il confronto', cost: { ap: 1 }, special: 'rival-duel' },
    { id: 'rinvia', label: 'Rispondi con una nota scritta', effects: { stats: { reputation: 0.3 } }, special: 'rival-reply' },
    { id: 'ignora', label: 'Non raccogliere la provocazione', effects: { stats: { popularity: -0.5 } }, special: 'rival-ignore' }] },
  'rivale-rivincita': { id: 'rivale-rivincita', title: '{rival} medita la rivincita', body: 'Dopo la sconfitta, {rival}, {personality}, {memoryLine}. Gira per il territorio e raccoglie malumori su {topic}: si prepara a ripresentarsi (comportamento simulato).', defaultChoice: 'ignora', choices: [
    { id: 'tendi', label: 'Cerca un chiarimento personale', cost: { ap: 1 }, effects: { stats: { reputation: 0.5 } }, special: 'rival-accept' },
    { id: 'presidia', label: 'Presidia il territorio per prevenirlo', cost: { ap: 1 }, effects: { stats: { popularity: 0.8 } }, special: 'rival-reply' },
    { id: 'ignora', label: 'Non dargli importanza', effects: {}, special: 'rival-ignore' }] }
});
