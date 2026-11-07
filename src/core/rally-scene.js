// The rally in the square and the vote at the polling station, as scenes of the shared engine (scene-engine.js): same cast with the player's own avatar, same plain-data state saved with the game,
// same beats/choices/history, same stage (stage-script.js, ui/stage-player.js). What is specific here is the builder of the beats.
//
// RALLY ('comizio'): the player arrives in a square, crosses the crowd, climbs on the stage and speaks in two moments, each with alternatives that come from the game — the promises made and their state,
// the programme of the party, the problems of the territory, the economy, the recent events, what the Government does if the player governs — and from what was said in the last rallies (the public gets
// tired of the same speech: a topic and a line used recently weigh less, and are not proposed again as they were). A protest may arrive, only when the situation gives a reason for it (a territory in
// discontent, a promise broken, a controversial topic, a bad memory); it can be listened to, answered, ignored or cut short, and it can end the rally. Nothing is drawn from the random sequence
// of the game: the variation comes from a hash of the seed of the scene, so a scene resumed or played again from the same choices is the same scene.
//
// VOTE ('voto'): the player votes in his polling station — entrance, desk, booth, ballot folded, urn, exit. It decides nothing: the result of the election is the one of election-engine.js.
import { AREA_BY_ID } from '../data/simulation/policy-rules.js?v=20261106-2';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round1 = value => Math.round(value * 10) / 10;
const hashOf = text => { let h = 2166136261 >>> 0; const s = String(text); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const unit = text => hashOf(text) / 4294967296;
const pick = (list, key) => list[Math.floor(unit(key) * list.length) % list.length];
const areaLabel = id => (AREA_BY_ID[id]?.label ?? String(id ?? '')).toLowerCase();
const closed = ['mantenuta', 'parzialmente-mantenuta', 'non-mantenuta', 'modificata'];

export const RALLY_BEATS = Object.freeze(['arrivo', 'cammino', 'saluto', 'tema1', 'contestazione', 'tema2', 'chiusura', 'esito']);
export const VOTE_BEATS = Object.freeze(['ingresso', 'banco', 'cabina', 'voto', 'piega', 'esce', 'urna', 'uscita']);

// ---------- the builders ----------
function crowdOf(notoriety, trust) { return Math.round(clamp(80 + notoriety * 4.2 + (trust - 50) * 1.6, 60, 700)); }
export function createRallyScene({ id, seed, player, playerAvatar, party = {}, place = {}, mode = 'settimana', campaignId = null, date = null, context = {} }) {
  const stats = context.stats ?? { competence: 50, charisma: 50, reputation: 50, notoriety: 40 };
  const crowd = crowdOf(stats.notoriety, context.territory?.trust ?? 50);
  const planned = unit(`${seed}|contestazione`) < clamp((context.protestLevel ?? 0) * 0.62, 0, 0.55);
  const reason = planned ? protestReason(seed, context) : null;
  const cast = [{ id: 'giocatore', role: 'giocatore', name: player.name, avatar: playerAvatar, position: 'palco' }];
  // a few characters of the crowd stand out in front (they are drawn, not listed in the credits); the protesters are a group that arrives only if the situation says so
  for (let i = 0; i < 3; i++) cast.push({ id: `sostenitore-${i}`, role: 'sostenitore', name: 'Sostenitore', x: 150 + i * 170 + Math.round(unit(`${seed}|s${i}`) * 40), y: 300 + (i % 2) * 22 });
  if (planned) for (let i = 0; i < 4; i++) cast.push({ id: `contestatore-${i}`, role: 'contestatore', name: 'Contestatore', x: 520 + (i % 2) * 36 + Math.round(unit(`${seed}|c${i}`) * 14), y: 292 + Math.floor(i / 2) * 26 });
  return {
    id, kind: 'comizio', setting: 'piazza', seed, campaignId, date, mode, status: 'active', nodeId: 'arrivo', prevNodeId: null, cast,
    place: { municipality: place.municipality ?? null, region: place.region ?? null, label: place.municipality ?? place.region ?? 'la piazza' },
    party: { id: party.id ?? null, name: party.name ?? 'il partito', abbreviation: party.abbreviation ?? null },
    topic: { id: 'comizio', label: 'Comizio in piazza' },
    crowd: { size: crowd }, protest: { planned, arrived: false, reason, state: null }, interrupted: false,
    context: { ...context, stats }, audience: { mood: round1(clamp(46 + (stats.notoriety - 40) * 0.12 + ((context.territory?.trust ?? 50) - 50) * 0.12, 30, 66)), history: [] },
    scores: [], history: [], used: [], outcome: null
  };
}
export function createVoteScene({ id, seed, player, playerAvatar, electionLabel = 'Elezioni', place = {}, date = null }) {
  const names = ['Anna Rinaldi', 'Luca Fiore', 'Marta Gentile', 'Sergio Bellini', 'Elisa Moretti', 'Franco Villa'];
  const a = hashOf(`${seed}|scrutatore`) % names.length;
  const cast = [
    { id: 'giocatore', role: 'giocatore', name: player.name, avatar: playerAvatar, position: 'seggio' },
    { id: 'scrutatore-1', role: 'scrutatore', name: names[a], x: 262, y: 270 },
    { id: 'scrutatore-2', role: 'scrutatore', name: names[(a + 3) % names.length], x: 356, y: 270 }
  ];
  return { id, kind: 'voto', setting: 'seggio', seed, date, status: 'active', nodeId: 'ingresso', prevNodeId: null, cast, place: { label: place.municipality ?? place.region ?? 'il tuo comune' }, electionLabel, topic: { id: 'voto', label: electionLabel }, audience: { mood: 50, history: [] }, scores: [], history: [], outcome: null };
}

// ---------- why a protest comes (only from the situation) ----------
function protestReason(seed, ctx) {
  const reasons = [];
  const broken = (ctx.promises ?? []).filter(item => item.status === 'non-mantenuta');
  if (broken[0]) reasons.push({ kind: 'promessa', area: broken[0].area ?? null, label: `la promessa tradita su ${areaLabel(broken[0].area) || broken[0].label.toLowerCase()}`, weight: 2 });
  const worst = (ctx.territory?.problems ?? [])[0];
  if (worst) reasons.push({ kind: 'territorio', area: worst.area ?? null, label: `${worst.label.toLowerCase()} in ${ctx.territory?.name ?? 'città'}`, weight: 1.4 + (worst.severity ?? 0) / 40 });
  if ((ctx.memoryBad ?? 0) >= 1) reasons.push({ kind: 'memoria', area: null, label: 'le polemiche che ti hanno accompagnato', weight: 1.2 });
  if (ctx.governing && (ctx.government?.approval ?? 50) < 42) reasons.push({ kind: 'governo', area: null, label: 'l’azione del Governo', weight: 1.6 });
  if ((ctx.economy?.inflation ?? 2) >= 4.5) reasons.push({ kind: 'economia', area: null, label: 'il caro vita', weight: 1.1 });
  if (!reasons.length) reasons.push({ kind: 'territorio', area: null, label: 'il malcontento sul territorio', weight: 1 });
  reasons.sort((a, b) => b.weight - a.weight || hashOf(`${seed}${a.label}`) - hashOf(`${seed}${b.label}`));
  return reasons[0];
}
// How loud the protest is, 0..1: from the weight of its reason and the discontent of the territory.
const protestSeverity = scene => clamp(0.28 + (scene.protest.reason?.weight ?? 1) * 0.16 + (50 - (scene.context.territory?.trust ?? 50)) / 160 + (scene.context.stats.notoriety - 40) / 400, 0.2, 0.95);

// ---------- the speech: what can be said, from the situation ----------
function speechOptions(scene, nodeId) {
  const ctx = scene.context, place = scene.place.label, party = scene.party.name;
  const options = [];
  const open = (ctx.promises ?? []).filter(item => !closed.includes(item.status));
  const broken = (ctx.promises ?? []).filter(item => item.status === 'non-mantenuta');
  for (const promise of open.slice(0, 3)) options.push({ id: `promessa-${promise.id}`, kind: 'promessa', area: promise.area ?? null, promise, label: `Ribadisci l’impegno su ${areaLabel(promise.area) || promise.label.toLowerCase()}`, detail: `Parli di ciò che hai promesso: «${promise.intervention ?? promise.label}». Vale quanto sei credibile.` });
  for (const problem of (ctx.territory?.problems ?? []).slice(0, 2)) options.push({ id: `territorio-${problem.id}`, kind: 'territorio', area: problem.area ?? null, problem, label: `Affronta ${problem.label.toLowerCase()} a ${place}`, detail: 'Parli dei problemi della piazza: premia chi li conosce, punisce chi promette senza proposte.' });
  const econ = ctx.economy ?? {};
  if ((econ.inflation ?? 2) >= 3.5) options.push({ id: 'attualita-prezzi', kind: 'attualita', area: 'costo-vita', label: 'Parla del costo della vita', detail: `Prezzi e bollette: l’inflazione è al ${String(econ.inflation).replace('.', ',')}%. Tema sentito, serve concretezza.` });
  else if ((econ.growth ?? 0.5) <= 0.4) options.push({ id: 'attualita-lavoro', kind: 'attualita', area: 'lavoro', label: 'Parla di lavoro e crescita', detail: 'L’economia rallenta: la gente vuole sapere cosa farai per il lavoro.' });
  for (const event of (ctx.events ?? []).slice(0, 1)) options.push({ id: `attualita-${hashOf(event) % 997}`, kind: 'attualita', area: null, label: 'Commenta i fatti di questi giorni', detail: `In piazza si parla di «${event}»: prendi posizione.` });
  if (ctx.governing) options.push({ id: 'governo', kind: 'governo', area: null, label: 'Rendi conto dell’azione del Governo', detail: `Governi tu: racconti cosa hai fatto e cosa resta da fare. ${(ctx.government?.approval ?? 50) >= 50 ? 'Il gradimento ti sostiene.' : 'Il gradimento è basso: sarà dura.'}` });
  const program = (ctx.programAreas ?? []).filter(id => !open.some(item => item.area === id)).slice(0, 1);
  for (const area of program) options.push({ id: `proposta-${area}`, kind: 'proposta', area, label: `Presenta la proposta di ${party} su ${areaLabel(area)}`, detail: 'Una proposta del programma del partito che non hai ancora promesso: coerente, ma senza una tua parola data.' });
  options.push({ id: 'attacco', kind: 'attacco', area: null, label: 'Attacca chi governa il territorio', detail: 'Tono duro: la piazza si scalda, ma il rischio di polemica sale.' });
  // what was said in the last rallies weighs less, and the topic of this scene's first speech is not proposed again
  const recent = new Set((ctx.rallyMemory ?? []).slice(-3).flatMap(item => item.topics ?? []));
  const taken = new Set((scene.used ?? []).map(item => item.id));
  const fresh = options.filter(item => !taken.has(item.id));
  const sorted = fresh.sort((a, b) => (recent.has(a.area ?? a.id) ? 1 : 0) - (recent.has(b.area ?? b.id) ? 1 : 0) || hashOf(`${scene.seed}|${nodeId}|${a.id}`) - hashOf(`${scene.seed}|${nodeId}|${b.id}`));
  const chosen = [];
  for (const kind of ['promessa', 'territorio', 'attualita', 'governo', 'proposta', 'attacco']) { const found = sorted.find(item => item.kind === kind && !chosen.includes(item)); if (found && chosen.length < 4) chosen.push(found); }
  return chosen.slice(0, 4);
}
// The sentence the player says: many variants, filled with the situation, avoiding the ones used in the last rallies.
const LINES = {
  promessa: ['«Vi avevo promesso {intervention}: ve lo ripeto qui, in {place}, davanti a tutti.»', '«Su {area} ho dato la mia parola. Controllatemi: a ogni settimana il conto di cosa è stato fatto.»', '«{party} non cambia idea a seconda del vento: {intervention}, e ne rispondo a voi.»', '«Una promessa non è uno slogan. {intervention}: è scritto, e voi potete verificarlo.»', '«Mi chiedete cosa farò su {area}? Quello che ho già detto: {intervention}.»'],
  territorio: ['«{place} ha un problema vero: {problem}. Non basta indignarsi, serve un piano, e io ne porto uno.»', '«Camminando per {place} ho sentito una cosa sola: {problem}. Da qui parte il mio lavoro.»', '«Chi vive qui lo sa meglio di Roma: {problem}. E non si risolve con un comunicato.»', '«Non vi racconto favole su {problem}: vi dico cosa si può fare, e in quanto tempo.»', '«{problem} non è una statistica, è la vita di chi è in questa piazza.»'],
  attualita: ['«Lo so, vi pesa: {topic}. Prima di tutto vi devo la verità sui numeri.»', '«Parliamo di {topic}: la politica che finge di non vedere è la stessa che poi chiede il voto.»', '«Su {topic} serve serietà, non propaganda: ecco cosa propongo.»', '«{topic}: è la domanda che mi fate di più. Provo a rispondere senza giri di parole.»'],
  governo: ['«Governare costa fatica. In questi mesi abbiamo fatto cose, e ne restano altre: ve le dico una per una.»', '«Non ho paura di rendere conto: ecco cosa ha fatto il Governo, e dove abbiamo sbagliato.»', '«Chi governa deve rispondere ai cittadini, non ai sondaggi. Rispondo qui, a voce.»'],
  proposta: ['«{party} ha una proposta su {area}: la porto in piazza prima che nei palazzi.»', '«Nel nostro programma c’è {area}. Ora vi spiego perché conta per {place}.»', '«Una proposta semplice su {area}: e vi chiedo di giudicarla per ciò che è.»'],
  attacco: ['«Chi ha amministrato fin qui deve spiegare perché {place} è rimasta indietro.»', '«Non faccio sconti a chi ha avuto tutto il tempo e ha fatto poco.»', '«Basta con chi promette e poi sparisce: questa piazza merita di meglio.»']
};
function speechLine(scene, option, nodeId) {
  const ctx = scene.context;
  const bank = LINES[option.kind] ?? LINES.attualita;
  const used = new Set((ctx.rallyMemory ?? []).flatMap(item => item.lines ?? []));
  const order = bank.map((text, index) => ({ text, index })).sort((a, b) => hashOf(`${scene.seed}|${nodeId}|${option.id}|${a.index}`) - hashOf(`${scene.seed}|${nodeId}|${option.id}|${b.index}`));
  const chosen = order.find(item => !used.has(hashOf(item.text) % 100003)) ?? order[0];
  const fill = {
    place: scene.place.label, party: scene.party.name, area: areaLabel(option.area) || 'questo tema', intervention: (option.promise?.intervention ?? option.promise?.label ?? 'un impegno preciso').replace(/\.$/, ''),
    problem: (option.problem?.label ?? 'un problema che conosciamo').toLowerCase(), topic: option.kind === 'attualita' ? (option.label.replace(/^(Parla del |Parla di |Commenta )/i, '').toLowerCase()) : 'i problemi del Paese'
  };
  return { text: chosen.text.replace(/\{(\w+)\}/g, (_, key) => fill[key] ?? ''), variant: hashOf(chosen.text) % 100003 };
}
// How a speech does, 0..100, from the player and the situation: every term can be shown to the player.
function judgeSpeech(scene, option, nodeId) {
  const { competence, charisma, reputation } = scene.context.stats, ctx = scene.context;
  const why = [];
  let score = 40;
  if (option.kind === 'promessa') {
    const status = option.promise?.status;
    score += (ctx.credibility ?? 55) * 0.3 + (status === 'in-corso' ? 8 : status === 'ritardata' ? -6 : 3) + competence * 0.08;
    why.push(`credibilità ${Math.round(ctx.credibility ?? 55)}`, status === 'ritardata' ? 'promessa in ritardo' : 'promessa aperta');
    if ((ctx.promises ?? []).some(item => item.status === 'non-mantenuta' && item.area === option.area)) { score -= 14; why.push('una promessa tradita sullo stesso tema'); }
  } else if (option.kind === 'territorio') {
    const severity = option.problem?.severity ?? 0;
    score += competence * 0.2 + severity * 0.25 + ((ctx.relations?.civic ?? 50) - 50) * 0.12 + 6;
    why.push(`competenza ${Math.round(competence)}`, 'un problema che la piazza sente');
    if ((ctx.promises ?? []).some(item => item.area === option.area && item.status === 'non-mantenuta')) { score -= 10; why.push('hai promesso e non hai mantenuto'); }
  } else if (option.kind === 'attualita') { score += charisma * 0.26 + competence * 0.1 + 6; why.push(`carisma ${Math.round(charisma)}`); }
  else if (option.kind === 'governo') { score += ((ctx.government?.approval ?? 50) - 50) * 0.5 + competence * 0.12 + 6; why.push(`gradimento del Governo ${Math.round(ctx.government?.approval ?? 50)}`); }
  else if (option.kind === 'proposta') { score += (ctx.credibility ?? 55) * 0.18 + competence * 0.16 + 8; why.push('coerente con il programma del partito', 'senza una promessa tua'); }
  else { score += charisma * 0.22 + (scene.audience.mood - 50) * 0.3 - (reputation - 50) * 0.08 - 4; why.push('tono duro: rischio di polemica'); }
  if ((ctx.rallyMemory ?? []).slice(-2).some(item => (item.topics ?? []).includes(option.area ?? option.id))) { score -= 7; why.push('ne hai già parlato di recente'); }
  if (scene.protest.state === 'incerta') score -= 4;
  score += (unit(`${scene.seed}|${nodeId}|${option.id}`) - 0.5) * 12;
  return { score: Math.round(clamp(score, 5, 95)), why };
}
const CROWD_REACTION = {
  good: ['Applausi lunghi e qualcuno grida il tuo nome.', 'La piazza si scalda: bandiere in aria e un coro che parte dal fondo.', 'Applauso convinto, anche da chi era venuto per curiosità.', 'Un «bravo!» dal primo rango e un applauso che si allarga.'],
  mixed: ['Applausi a metà: una parte della piazza annuisce, l’altra aspetta.', 'Qualche applauso, qualche mormorio: la piazza è divisa.', 'Il pubblico ascolta in silenzio, senza esporsi.'],
  bad: ['Fischi isolati e gente che guarda il telefono.', 'Un mormorio percorre la piazza: non li hai convinti.', 'Qualcuno se ne va, altri scuotono la testa.', 'Un coro ironico dal fondo, poi di nuovo silenzio.']
};
const reaction = (scene, score, nodeId) => { const set = score >= 62 ? CROWD_REACTION.good : score >= 46 ? CROWD_REACTION.mixed : CROWD_REACTION.bad; return pick(set, `${scene.seed}|${nodeId}|rx`); };

// ---------- the nodes of the rally ----------
const last = scene => scene.history.at(-1) ?? null;
// What just happened: the line the player said and the reaction of the crowd (kept apart: the screen writes «You said» and the quote as separate texts).
function preface(scene) {
  const entry = last(scene);
  return entry?.crowd ? [entry.crowd] : [];
}
const saidOf = scene => last(scene)?.said ?? null;
export function rallyNode(scene) {
  const me = scene.cast.find(item => item.role === 'giocatore');
  const place = scene.place.label;
  const base = { id: scene.nodeId, setting: scene.setting, preface: preface(scene), said: saidOf(scene) };
  switch (scene.nodeId) {
    case 'arrivo': {
      const size = scene.crowd.size;
      const crowdLine = size > 420 ? 'La piazza è piena, c’è gente anche nelle vie laterali.' : size > 220 ? 'Una bella folla ha riempito la piazza.' : 'La piazza non è affollata, ma chi c’è è venuto per ascoltarti.';
      const dusk = pick(['Il sole sta calando dietro i palazzi.', 'È il tardo pomeriggio e le luci del palco si accendono.', 'Il vento muove le bandiere appese ai lampioni.', 'Dagli altoparlanti parte la musica di apertura.'], `${scene.seed}|arrivo`);
      return { ...base, speaker: null, camera: 'panorama', title: `Piazza di ${place}`, text: `${dusk} ${crowdLine} Bandiere e striscioni di ${scene.party.name} ovunque: ${scene.context.protestLevel > 0.55 ? 'qualcuno, però, guarda con sospetto' : 'l’aria è quella di una bella serata'}.`, choices: [['continua', 'Attraversa la piazza']] };
    }
    case 'cammino': {
      const rel = scene.context.relations?.civic ?? 50;
      return { ...base, speaker: null, camera: 'follow', title: 'Verso il palco', text: pick(rel >= 55 ? ['Mani da stringere, qualcuno ti ferma per un selfie: la gente ti conosce.', 'Un anziano ti prende il braccio: «Siamo qui per voi». Avanzi tra due ali di folla.'] : ['La gente si apre per lasciarti passare, qualche sguardo diffidente, qualche applauso timido.', 'Attraversi la piazza tra volti curiosi: qui devi ancora guadagnarti la fiducia.'], `${scene.seed}|cammino`), choices: [['continua', 'Sali sul palco']] };
    }
    case 'saluto': return { ...base, speaker: me.id, expression: 'sorridente', gesture: 'saluta', camera: 'stage', title: 'Al microfono', text: `Sei sul palco di ${place}, il microfono è acceso. Come apri il comizio?`, choices: [['caloroso', 'Un saluto caloroso', false, 'Battute, sorrisi, mani alzate: carisma prima di tutto.'], ['sobrio', 'Un saluto sobrio', false, 'Poche parole misurate: premia la reputazione, scalda meno.'], ['locale', `Parla di ${place}`, false, 'Nomini luoghi e persone della piazza: funziona se conosci il territorio.'], ['combattivo', 'Apri con un attacco', false, 'Tono combattivo: la piazza si accende, ma rischi la polemica.']] };
    case 'tema1': case 'tema2': {
      const options = speechOptions(scene, scene.nodeId);
      return { ...base, speaker: me.id, expression: 'determinata', gesture: 'sottolinea', camera: 'stage', title: scene.nodeId === 'tema1' ? 'Primo punto del discorso' : 'Secondo punto del discorso', text: scene.nodeId === 'tema1' ? 'La piazza ascolta. Di cosa parli?' : 'Ancora un punto prima di chiudere. Su cosa insisti?', choices: options.map(item => [item.id, item.label, false, item.detail]) };
    }
    case 'contestazione': {
      const reason = scene.protest.reason;
      return { ...base, speaker: me.id, expression: 'sorpresa', gesture: 'ascolta', camera: 'protest', title: 'Una contestazione', text: `Dal fondo arriva un gruppo di contestatori con cartelli e striscioni: protestano per ${reason?.label ?? 'il malcontento sul territorio'}. Cori, fischi, il discorso si ferma. Come reagisci?`, choices: [['ascolta', 'Invita un contestatore a parlare', false, 'Mostri rispetto: funziona se hai reputazione e la protesta è motivata.'], ['rispondi', 'Rispondi nel merito dal palco', false, 'Dati e fatti: serve competenza, e nessuna promessa tradita su quel tema.'], ['prosegui', 'Alza la voce e prosegui', false, 'Carisma e nervi saldi: rischi che la situazione degeneri.'], ['interrompi', 'Interrompi il comizio e lascia il palco', false, 'Eviti lo scontro, ma il comizio finisce qui.']] };
    }
    case 'chiusura': {
      const topicBest = bestTopic(scene);
      return { ...base, speaker: me.id, expression: 'sorridente', gesture: 'apre', camera: 'player', title: 'La chiusura', text: 'Il tempo è quasi finito. Come chiudi il comizio?', choices: [['appello', 'Un appello al voto', false, 'Parli al cuore della piazza: carisma e visione.'], ['impegno', 'Un impegno pubblico', !topicBest?.area, topicBest?.area ? `Prometti qualcosa su ${areaLabel(topicBest.area)} (diventa una promessa nel Programma): più credibile se sei coerente.` : 'Non hai trattato un tema del programma.'], ['ringraziamento', 'Ringrazia e saluta', false, 'Chiusura sobria e cordiale.'], ['coro', 'Lancia lo slogan della piazza', false, 'Coinvolgi la folla: bella da vedere, poca sostanza.']] };
    }
    default: return { ...base, speaker: null, camera: 'wide', title: scene.interrupted ? 'Comizio interrotto' : 'Comizio concluso', text: scene.outcome?.summary ?? 'Il comizio è concluso.', choices: [['fine', 'Lascia la piazza']], final: true };
  }
}
const bestTopic = scene => [...(scene.used ?? [])].filter(item => item.area).sort((a, b) => b.score - a.score)[0] ?? null;

// ---------- moving the rally on ----------
const NEXT = { arrivo: 'cammino', cammino: 'saluto', saluto: 'tema1', tema2: 'chiusura', contestazione: 'tema2' };
export function rallyChoose(scene, choiceId) {
  const node = rallyNode(scene);
  const choice = node.choices.find(item => item[0] === choiceId);
  if (!choice) throw new Error('Scelta non valida per questo momento.');
  if (choice[2]) throw new Error('Questa scelta non è disponibile.');
  const ctx = scene.context, stats = ctx.stats;
  const mood = delta => { scene.audience.mood = clamp(round1(scene.audience.mood + delta), 0, 100); scene.audience.history.push(scene.audience.mood); };
  const log = entry => { scene.history.push({ node: scene.nodeId, choice: choiceId, ...entry }); };
  let next = NEXT[scene.nodeId];
  const id = scene.nodeId;
  if (id === 'arrivo' || id === 'cammino') { log({}); }
  else if (id === 'saluto') {
    const base = choiceId === 'caloroso' ? 40 + stats.charisma * 0.38 : choiceId === 'sobrio' ? 44 + stats.reputation * 0.28 : choiceId === 'locale' ? 38 + stats.competence * 0.14 + ((ctx.relations?.civic ?? 50) - 50) * 0.25 + ((ctx.territory?.problems ?? []).length ? 8 : 0) : 42 + stats.charisma * 0.25 + (scene.audience.mood - 50) * 0.3 - 6;
    const score = Math.round(clamp(base + (unit(`${scene.seed}|saluto|${choiceId}`) - 0.5) * 10, 5, 95));
    scene.scores.push({ node: id, kind: 'saluto', style: choiceId, score });
    mood((score - 50) / 3.2);
    const said = { caloroso: '«Buonasera {place}! Che bello vedervi così, in tanti!»', sobrio: '«Buonasera e grazie di essere qui. Parlerò con calma, come si deve.»', locale: '«Buonasera {place}: conosco queste strade, le vostre scuole, i vostri mercati.»', combattivo: '«Buonasera. Non sono venuto a fare complimenti: sono venuto a dire le cose come stanno.»' }[choiceId].replace('{place}', scene.place.label);
    log({ style: choiceId, score, said, why: [`carisma ${Math.round(stats.charisma)}`, `reputazione ${Math.round(stats.reputation)}`], crowd: reaction(scene, score, id) });
  } else if (id === 'tema1' || id === 'tema2') {
    const option = speechOptions(scene, id).find(item => item.id === choiceId);
    if (!option) throw new Error('Scelta non valida per questo momento.');
    const result = judgeSpeech(scene, option, id);
    const line = speechLine(scene, option, id);
    scene.scores.push({ node: id, kind: 'discorso', style: option.kind, score: result.score });
    scene.used.push({ id: option.id, kind: option.kind, area: option.area, score: result.score, line: line.variant, node: id });
    mood((result.score - 50) / 3);
    log({ style: option.kind, option: option.id, score: result.score, why: result.why, said: line.text, crowd: reaction(scene, result.score, id) });
    // the protest comes after the first point, when the situation gave it a reason and the speech did not defuse it
    if (id === 'tema1' && scene.protest.planned && !(option.kind === 'territorio' && result.score >= 70 && scene.protest.reason?.kind === 'territorio' && option.area && option.area === scene.protest.reason.area)) { scene.protest.arrived = true; next = 'contestazione'; }
    else if (id === 'tema1') next = 'tema2';
  } else if (id === 'contestazione') {
    const severity = protestSeverity(scene);
    const broken = scene.protest.reason?.kind === 'promessa';
    let base;
    if (choiceId === 'ascolta') base = 40 + stats.reputation * 0.3 + stats.charisma * 0.14 - severity * 26 + (broken ? 6 : 0);
    else if (choiceId === 'rispondi') base = 36 + stats.competence * 0.3 + (ctx.credibility ?? 55) * 0.12 - severity * 28 - (broken ? 14 : 0);
    else if (choiceId === 'prosegui') base = 30 + stats.charisma * 0.36 + (scene.audience.mood - 50) * 0.3 - severity * 30;
    else base = 50;
    const score = Math.round(clamp(base + (unit(`${scene.seed}|contestazione|${choiceId}`) - 0.5) * 12, 5, 95));
    const state = choiceId === 'interrompi' ? 'interrotta' : score >= 52 ? 'gestita' : score >= 38 ? 'incerta' : 'degenerata';
    scene.protest.state = state; scene.protest.choice = choiceId; scene.protest.severity = round1(severity);
    scene.scores.push({ node: id, kind: 'contestazione', style: choiceId, score: choiceId === 'interrompi' ? 36 : score });
    mood(state === 'gestita' ? 5 : state === 'incerta' ? -4 : state === 'interrotta' ? -6 : -16);
    const said = { ascolta: '«Venite, parlate: vi ascolto. Poi vi rispondo.»', rispondi: '«Rispondo a quello che dite, con i fatti.»', prosegui: '«Non mi fermate: ho ancora cose da dire a chi è venuto ad ascoltare.»', interrompi: '«Per oggi chiudo qui: non voglio uno scontro in piazza.»' }[choiceId];
    const crowd = { gestita: 'Il pubblico applaude chi ascolta: i contestatori abbassano i cartelli e il comizio riparte.', incerta: 'La tensione resta: parte della piazza applaude, parte rumoreggia. Il comizio riprende a fatica.', degenerata: 'La situazione degenera: spintoni, cori, il servizio d’ordine interviene. Il comizio non può continuare.', interrotta: 'Lasci il palco: la piazza si divide, i contestatori esultano.' }[state];
    log({ style: choiceId, score, why: [`gravità della protesta ${Math.round(severity * 100)}%`, broken ? 'la protesta nasce da una tua promessa tradita' : 'una protesta motivata dalla situazione'], said, crowd, protest: state });
    if (state === 'degenerata' || state === 'interrotta') { scene.interrupted = true; return finishRally(scene); }
    next = 'tema2';
  } else if (id === 'chiusura') {
    const top = bestTopic(scene);
    const base = choiceId === 'appello' ? 42 + stats.charisma * 0.34 + (scene.audience.mood - 50) * 0.2 : choiceId === 'impegno' ? 44 + (ctx.credibility ?? 55) * 0.2 + (top?.score ?? 50) * 0.14 : choiceId === 'coro' ? 44 + (scene.audience.mood - 50) * 0.4 : 50 + (stats.reputation - 50) * 0.15;
    const score = Math.round(clamp(base + (unit(`${scene.seed}|chiusura|${choiceId}`) - 0.5) * 8, 5, 95));
    scene.scores.push({ node: id, kind: 'chiusura', style: choiceId, score });
    mood((score - 50) / 4);
    const said = { appello: '«Il vostro voto conta: andate a votare e portate con voi chi è rimasto a casa.»', impegno: `«Da qui, davanti a voi, mi impegno: ${top?.area ? areaLabel(top.area) : 'la mia parola'} sarà la prima cosa di cui risponderò.»`, ringraziamento: '«Grazie di cuore. Ci vediamo presto, qui, in mezzo a voi.»', coro: '«Allora, tutti insieme: ancora più forti!»' }[choiceId];
    if (choiceId === 'impegno' && top?.area) scene.pledge = { area: top.area };
    log({ style: choiceId, score, said, why: [], crowd: reaction(scene, score, id) });
    return finishRally(scene);
  }
  scene.nodeId = next;
  return scene;
}
// The verdict of the rally: performance, the effects on the numbers of the game (applied by the store with the rules of its engines), a line for the history.
function finishRally(scene) {
  const stats = scene.context.stats;
  const weights = { saluto: 0.6, discorso: 1.3, contestazione: 1, chiusura: 0.7 };
  const total = scene.scores.reduce((sum, item) => sum + item.score * (weights[item.kind] ?? 1), 0), w = scene.scores.reduce((sum, item) => sum + (weights[item.kind] ?? 1), 0) || 1;
  const protest = scene.protest.state;
  let performance = clamp(total / w * 0.8 + scene.audience.mood * 0.2, 0, 100);
  if (scene.interrupted) performance = Math.min(performance, protest === 'degenerata' ? 28 : 40);
  performance = Math.round(performance);
  const edge = round1((performance - 50) / 5);
  const deltas = {
    popularity: round1((performance - 50) / 30 + (protest === 'degenerata' ? -0.8 : 0)),
    reputation: round1((performance - 50) / 70 + (protest === 'gestita' ? 0.5 : protest === 'degenerata' ? -1 : protest === 'interrotta' ? -0.5 : 0) + (scene.scores.some(item => item.style === 'promessa' && item.score >= 60) ? 0.3 : 0)),
    notoriety: round1(0.5 + (scene.crowd.size / 700) * 0.8 + (protest ? 0.8 : 0)),
    consensus: round1((performance - 50) / 80)
  };
  const best = [...scene.scores].sort((a, b) => b.score - a.score)[0], worst = [...scene.scores].sort((a, b) => a.score - b.score)[0];
  const topics = scene.used.map(item => ({ area: item.area, id: item.id, kind: item.kind, score: item.score, line: item.line }));
  scene.outcome = {
    performance, edge, audience: scene.audience.mood, protest: protest ?? 'nessuna', interrupted: scene.interrupted, deltas, topics, pledge: scene.pledge ?? null,
    attention: round1((performance - 50) / 18 + (protest === 'degenerata' ? -1.5 : 0)), coverage: protest ? 1.2 : 0.4,
    best: best ? { kind: best.kind, style: best.style, score: best.score } : null, worst: worst ? { kind: worst.kind, style: worst.style, score: worst.score } : null,
    summary: scene.interrupted
      ? (protest === 'degenerata' ? `Il comizio a ${scene.place.label} è degenerato: contestazione fuori controllo, palco lasciato, le telecamere hanno ripreso tutto.` : `Hai interrotto il comizio a ${scene.place.label} davanti ai contestatori: nessuno scontro, ma la piazza ricorderà che non hai finito.`)
      : performance >= 62 ? `Serata riuscita a ${scene.place.label}: la piazza ha applaudito${protest === 'gestita' ? ' e hai gestito bene la contestazione' : ''}.` : performance >= 48 ? `Comizio nella media a ${scene.place.label}: applausi a tratti, nessun entusiasmo.` : `Comizio difficile a ${scene.place.label}: la piazza non si è lasciata convincere.`
  };
  scene.status = 'done'; scene.nodeId = 'esito';
  return scene;
}

// ---------- the vote ----------
const VOTE_TEXT = {
  ingresso: ['Entri nel seggio: tavoli, scrutatori, il profumo di aula scolastica.', 'Il seggio è tranquillo: c’è solo una fila breve davanti al tavolo.'],
  banco: ['Mostri il documento e la tessera elettorale. Lo scrutatore verifica, ti consegna la scheda e la matita.', 'Dopo il controllo del documento ricevi la scheda e la matita copiativa.'],
  cabina: ['Entri nella cabina: la tenda si chiude dietro di te.', 'Raggiungi la cabina e tiri la tenda: sei solo con la tua scelta.'],
  voto: ['Dentro la cabina segni la tua scelta sulla scheda. (Il gioco non mostra né modifica il voto.)', 'Matita alla mano, voti. Il tuo voto è segreto, come quello di tutti.'],
  piega: ['Pieghi la scheda lungo le linee, come richiesto.', 'Richiudi la scheda con cura: nessuno deve vedere come hai votato.'],
  esce: ['Esci dalla cabina con la scheda piegata in mano.', 'Scosti la tenda e torni verso il seggio con la scheda richiusa.'],
  urna: ['Ti avvicini all’urna e inserisci la scheda nella fessura.', 'Infili la scheda nell’urna: il tuo voto è espresso.'],
  uscita: ['Saluti gli scrutatori e lasci il seggio. Adesso si attende lo scrutinio.', 'Il voto è fatto. Esci dal seggio: la serata elettorale sta per cominciare.']
};
export function voteNode(scene) {
  const id = scene.nodeId;
  const text = pick(VOTE_TEXT[id] ?? VOTE_TEXT.uscita, `${scene.seed}|voto|${id}`);
  const labels = { ingresso: 'Vai al banco', banco: 'Raggiungi la cabina', cabina: 'Vota', voto: 'Piega la scheda', piega: 'Esci dalla cabina', esce: 'Vai all’urna', urna: 'Esci dal seggio', uscita: 'Alla serata elettorale' };
  return { id, setting: scene.setting, speaker: null, camera: id === 'cabina' || id === 'voto' || id === 'piega' ? 'booth' : id === 'urna' ? 'urn' : 'wide', title: `${scene.electionLabel} · il tuo voto`, text, preface: [], choices: [[id === 'uscita' ? 'fine' : 'continua', labels[id]]], final: id === 'uscita' };
}
export function voteChoose(scene, choiceId) {
  const at = VOTE_BEATS.indexOf(scene.nodeId);
  if (scene.nodeId === 'uscita') { if (choiceId !== 'fine') throw new Error('Scelta non valida per questo momento.'); scene.status = 'done'; scene.outcome = { summary: 'Hai votato.', voted: true }; return scene; }
  if (choiceId !== 'continua') throw new Error('Scelta non valida per questo momento.');
  scene.history.push({ node: scene.nodeId, choice: choiceId });
  scene.nodeId = VOTE_BEATS[at + 1];
  return scene;
}
export const rallyProgress = scene => ({ index: Math.max(0, RALLY_BEATS.indexOf(scene.nodeId)), total: RALLY_BEATS.length });
export const voteProgress = scene => ({ index: Math.max(0, VOTE_BEATS.indexOf(scene.nodeId)), total: VOTE_BEATS.length });
// What the rally gives back to the game (applied by the store once).
export function rallyEffects(scene) {
  if (!scene.outcome) return null;
  const o = scene.outcome;
  return { edge: o.edge, performance: o.performance, protest: o.protest, interrupted: o.interrupted, deltas: o.deltas, attention: o.attention, coverage: o.coverage, pledge: o.pledge, topics: o.topics, line: o.summary, place: scene.place, mode: scene.mode, sceneId: scene.id };
}

// The player leaves the stage in the middle: the rally is over with a verdict of its own (the costs are paid, the square remembers).
export function abandonRally(input) {
  const scene = JSON.parse(JSON.stringify(input));
  scene.interrupted = true; scene.status = 'abandoned'; scene.nodeId = 'esito';
  scene.protest = { ...scene.protest, state: scene.protest.state ?? 'abbandono' };
  const performance = 24;
  scene.outcome = { performance, edge: -5.2, audience: scene.audience.mood, protest: 'abbandono', interrupted: true, deltas: { popularity: -1.2, reputation: -1, notoriety: 0.4, consensus: -0.4 }, topics: (scene.used ?? []).map(item => ({ area: item.area, id: item.id, kind: item.kind, score: item.score, line: item.line })), pledge: null, attention: -1.2, coverage: 0.4, best: null, worst: null, summary: `Hai lasciato il comizio a ${scene.place.label} a metà: la piazza se ne è accorta e il racconto non ti aiuta.` };
  return scene;
}
