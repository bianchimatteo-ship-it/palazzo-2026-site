// The engine of the interactive scenes: a scene is a short sequence of beats (a character speaks, with a face, a gesture and a shot of the camera) and of choices of the player, in a setting, with a
// cast. It is built to be reused (press conferences, cabinet meetings, Parliament, rallies, the Quirinale, diplomatic meetings): what is specific to a kind of scene is the builder of its beats; what
// is common is here — the cast with its avatars, the history of the choices, the saving (the whole scene is plain data in the state: it resumes exactly where it was), the audience, the scoring.
//
// The first scene is the television debate (kind 'dibattito-tv'). Its beats follow the situation of the game: the questions come from the topics of the campaign and from the promises the player has
// made, the answers are judged on competence, charisma, preparation and political coherence (the credibility of the programme), the rivals attack where the player is weak and answer as their
// personality and their programme say. Nothing is drawn from the random sequence of the campaign: the little variation of a beat comes from a hash of the scene's seed, so a scene resumed or
// replayed from the same choices is the same scene. The player's avatar is always the one chosen at the start of the career: the scene may change the face for a moment (expression), never the person.
import { defaultAvatarFor, genderOf, normalizeAvatar } from './avatar.js?v=20261113-1';
import { AREA_BY_ID } from '../data/simulation/policy-rules.js?v=20261113-1';
import { line, formatOf } from './studio-lines.js?v=20261113-1';
import { createRallyScene, createVoteScene, rallyChoose, rallyEffects, rallyNode, rallyProgress, voteChoose, voteNode, voteProgress } from './rally-scene.js?v=20261113-1';
export { createRallyScene, createVoteScene, formatOf };

// Scenes of other kinds (the optional scenes of the weekly activities, core/activity-scenes.js) are loaded on demand and register here: { node, choose, effects, progress }. Nothing of them is in the first screen.
const KINDS = {};
export const registerSceneKind = (kind, impl) => { KINDS[kind] = impl; };
export const sceneKindRegistered = kind => Boolean(KINDS[kind]);
// A scene of a registered kind left halfway: the closing it has (a verdict of its own).
export const abandonKindScene = scene => KINDS[scene.kind]?.abandon?.(scene) ?? null;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const hashOf = text => { let h = 2166136261 >>> 0; for (let i = 0; i < String(text).length; i++) { h ^= String(text).charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const unit = text => hashOf(text) / 4294967296;
const round1 = value => Math.round(value * 10) / 10;

export const SCENE_STATUS = Object.freeze({ active: 'in corso', done: 'conclusa', declined: 'rifiutata', abandoned: 'abbandonata' });
export const STYLES = Object.freeze({
  dati: { label: 'Con i dati', detail: 'Cifre, fatti, competenza: convince chi ragiona, annoia chi ascolta con il cuore.' },
  empatia: { label: 'Con empatia', detail: 'Parli alle persone e ai loro problemi: carisma, meno concretezza.' },
  programma: { label: 'Dal programma', detail: 'Citi le tue promesse: vale quanto sei credibile e quanto sei coerente.' },
  attacco: { label: 'All’attacco', detail: 'Colpisci l’avversario: premia se è debole, punisce se non sei preparato.' }
});
export const REPLIES = Object.freeze({ fatti: { label: 'Rispondi con i fatti', detail: 'Smonti l’accusa con i numeri: serve preparazione.' }, calma: { label: 'Resta calmo', detail: 'Non raccogli la provocazione: sobrio, ma sembri sulla difensiva.' }, contrattacco: { label: 'Contrattacca', detail: 'Rispondi colpo su colpo: il pubblico si accende, con rischi.' }, ignora: { label: 'Ignora l’attacco', detail: 'Cambi argomento: lascia il segno all’avversario.' } });
export const ASKS = Object.freeze({ conti: { label: 'Chiedi come finanzia le promesse', detail: 'Mette alla prova il suo programma.' }, coerenza: { label: 'Chiedi conto delle contraddizioni', detail: 'Colpisce se ha cambiato idea.' }, passato: { label: 'Ricordagli il suo passato', detail: 'Rischioso: se ricordi male, si ritorce.' }, salta: { label: 'Non fare domande', detail: 'Lasci il tempo al conduttore.' } });
export const CLOSINGS = Object.freeze({ sobrio: { label: 'Chiusura sobria', detail: 'Ringrazi e riassumi con misura.' }, appello: { label: 'Appello agli elettori', detail: 'Parli al Paese: carisma e visione.' }, sfida: { label: 'Sfida finale', detail: 'Ti rivolgi all’avversario: forte, ma divisivo.' } });
// The choices of a beat, in the words of the topic being discussed (data/studio-lines.js DEBATE_CHOICES): a health debate offers waiting lists, hospitals and funding, an economy debate taxes, firms and jobs.
// The id and the evaluation are those of the engine (the generic wording below is the fallback for a topic the catalogue does not know).
let DEBATE_CHOICES = {};
// (registered by data/debate-choices.js, which is loaded with the scene page and not at start)
export const setDebateChoices = table => { DEBATE_CHOICES = table; };
const choicesFor = (group, base, topicId) => Object.entries(base).map(([id, spec]) => { const own = DEBATE_CHOICES[topicId]?.[group]?.[id]; return [id, own ? own[0][0] : spec.label, false, own ? own[1][0] : spec.detail]; });
// The television formats: three different studios (the stage draws each one with its own scenery, lights, cameras and audience) and the shows of the schedule that use them. The names are invented.
export const SHOWS = Object.freeze({
  'tg-sera': { id: 'tg-sera', format: 'intervista', name: 'Il Telegiornale della Sera', slot: 'Edizione della sera', host: 'giornalista' },
  'buongiorno': { id: 'buongiorno', format: 'intervista', name: 'Buongiorno Italia', slot: 'Mattina', host: 'giornalista' },
  salotto: { id: 'salotto', format: 'talk', name: 'Il Salotto', slot: 'Pomeriggio', host: 'conduttore' },
  'prima-serata': { id: 'prima-serata', format: 'talk', name: 'Prima Serata Live', slot: 'Prima serata', host: 'conduttore' },
  'notte-politica': { id: 'notte-politica', format: 'talk', name: 'Notte Politica', slot: 'Seconda serata', host: 'conduttore' },
  'faccia-a-faccia': { id: 'faccia-a-faccia', format: 'faccia', name: 'Faccia a faccia', slot: 'Prima serata', host: 'moderatore' },
  tribuna: { id: 'tribuna', format: 'faccia', name: 'Tribuna Elettorale', slot: 'Prima serata', host: 'moderatore' }
});
export const FORMAT_LABELS = Object.freeze({ intervista: 'Notiziario e intervista', talk: 'Talk show', faccia: 'Dibattito faccia a faccia' });
export const showFor = (id, fallback = 'prima-serata') => SHOWS[id] ?? SHOWS[fallback];
// The shows that invite the player in a week: three, from the seed (the same week always the same invitations); the prime-time ones want a name the public knows.
export function invitedShows(seedText, notoriety = 0) {
  const pool = Object.values(SHOWS).filter(show => show.format !== 'faccia').filter(show => show.id !== 'prima-serata' || notoriety >= 30).filter(show => show.id !== 'notte-politica' || notoriety >= 20);
  return [...pool].sort((a, b) => unit(`${seedText}|${a.id}`) - unit(`${seedText}|${b.id}`)).slice(0, 3);
}
const BEATS = Object.freeze(['invito', 'preparazione', 'ingresso', 'q1', 'r1', 'domanda', 'risposta-rivale', 'q2', 'r2', 'attacco', 'r3', 'chiusura', 'esito']);

// ---------- the cast ----------
// The avatar of a character that is not the player: always the same for the same character (from its id), with the traits that make the rival recognisable. The role may dress it (the host in
// anthracite). The player's one is never made here: it is the one saved in the career.
// The text of a button or an action («Partecipa», «Simula», «Non partecipare»…) is never the name of a person: a name that is missing, or that is the text of a control, becomes the description of the post.
const CONTROL_WORDS = /^\s*(partecipa|partecipare|non partecipare|simula|salta|salta attivit[àa]|entra|entra in studio|accetta|rifiuta|continua|inizia|fine|ok|annulla)\b/i;
export const personName = (name, fallback) => { const text = String(name ?? '').trim(); return !text || CONTROL_WORDS.test(text) || /^(undefined|null|\[object)/i.test(text) ? fallback : text; };
export function characterAvatar(character) {
  if (character.avatar) return normalizeAvatar(character.avatar);
  // the face follows the gender written in the data (explicit, or from the first name when the person is a real politician whose gender the verified data does not give)
  const gender = genderOf(character);
  const base = { ...defaultAvatarFor(character.id), ...(gender ? { face: gender } : {}) };
  const h = hashOf(`${character.id}|aspetto`);
  const out = { ...base, beard: base.face === 'maschile' && h % 5 === 0 ? 'corta' : base.beard, glasses: h % 4 === 0 ? 'tondi' : h % 7 === 0 ? 'rettangolari' : base.glasses, expression: character.role === 'rivale' && h % 3 === 0 ? 'determinata' : base.expression };
  if (character.role === 'conduttore') out.jacket = 'antracite';
  return normalizeAvatar(out);
}

export function createDebateScene({ id, seed, player, playerAvatar, rival, host, topic, promises = [], credibility = 60, prep = 0, rivalProgram = [], rivalReadiness = 50, rivalAggression = 50, crisis = false, campaignId = null, date = null, salientTopic = null, secondTopic = null, show = 'faccia-a-faccia', ticker = [], events = [], rivalProgramLabels = [], weakProposal = null }) {
  const cast = [
    { id: 'giocatore', role: 'giocatore', name: personName(player.name, 'Il candidato'), avatar: normalizeAvatar(playerAvatar), position: 'sinistra', tag: player.tag ?? '' },
    { id: rival.id, role: 'rivale', name: personName(rival.name, rival.tag?.startsWith('Ospite') ? 'L’ospite' : 'Lo sfidante'), gender: genderOf({ gender: rival.gender, name: rival.name }), avatar: characterAvatar({ id: rival.id, role: 'rivale', gender: rival.gender, name: rival.name }), position: 'destra', partyId: rival.partyId ?? null, tag: rival.tag ?? '' },
    { id: host.id, role: 'conduttore', name: personName(host.name, host.tag === 'Giornalista' ? 'Il giornalista' : host.tag === 'Moderatore' ? 'Il moderatore' : 'Il conduttore'), gender: genderOf({ gender: host.gender, name: host.name }), avatar: characterAvatar({ id: host.id, role: 'conduttore', gender: host.gender, name: host.name }), position: 'centro', tag: host.tag ?? '' }
  ];
  const showSpec = showFor(show, 'faccia-a-faccia');
  const topicPromises = promises.filter(item => item.topic === topic.id);
  return {
    id, kind: 'dibattito-tv', setting: 'studio-televisivo', format: showSpec.format, show: { id: showSpec.id, name: showSpec.name, slot: showSpec.slot }, ticker: ticker.slice(0, 8), seed, campaignId, date, status: 'active', nodeId: 'invito', cast,
    topic: { id: topic.id, label: topic.label }, secondTopic: secondTopic ? { id: secondTopic.id, label: secondTopic.label } : null, salientTopic,
    context: { credibility, prep, rivalProgram, rivalProgramLabels: rivalProgramLabels.slice(0, 3), events: events.slice(0, 3), weakProposal: weakProposal ? String(weakProposal).slice(0, 80) : null, rivalReadiness, rivalAggression, crisis, promises: promises.map(item => ({ id: item.id, label: item.label, topic: item.topic, status: item.status, intervention: item.intervention, cost: item.cost })), topicPromises: topicPromises.map(item => item.id) },
    audience: { mood: 50, history: [] }, scores: [], history: [], prepFocus: null, outcome: null
  };
}

const cast = (scene, role) => scene.cast.find(item => item.role === role);
const stats = scene => scene.context.stats ?? { competence: 50, charisma: 50 };
export const withStats = (scene, { competence, charisma }) => ({ ...scene, context: { ...scene.context, stats: { competence, charisma } } });

// ---------- scoring ----------
// How an answer of a style does, 0..100, from what the player is and has done. Every term can be explained to the player in the reaction of the beat.
function judge(scene, style, { topicId, nodeId }) {
  const { competence, charisma } = stats(scene);
  const ctx = scene.context;
  const hasPromise = ctx.promises.some(item => item.topic === topicId && !['non-mantenuta'].includes(item.status));
  const brokenOnTopic = ctx.promises.some(item => item.topic === topicId && item.status === 'non-mantenuta');
  const prepared = scene.prepFocus === style || (scene.prepFocus === 'programma' && style === 'programma') ? 1 : 0;
  const prep = clamp(ctx.prep / 24, 0, 1);
  const noise = (unit(`${scene.seed}|${nodeId}|${style}`) - 0.5) * 10;
  let score = 50, why = [];
  if (style === 'dati') { score = 38 + competence * 0.4 + prep * 14 + prepared * 8; why.push(`competenza ${Math.round(competence)}`, prep ? 'preparazione' : 'poca preparazione'); }
  else if (style === 'empatia') { score = 36 + charisma * 0.45 + prepared * 6 + (scene.audience.mood - 50) * 0.15; why.push(`carisma ${Math.round(charisma)}`); }
  else if (style === 'programma') {
    score = 30 + ctx.credibility * 0.38 + (hasPromise ? 14 : -14) + prepared * 8 - (brokenOnTopic ? 14 : 0);
    why.push(`credibilità ${Math.round(ctx.credibility)}`, hasPromise ? 'una promessa sul tema' : 'nessuna promessa concreta sul tema'); if (brokenOnTopic) why.push('una promessa tradita sullo stesso tema');
  } else { score = 34 + (100 - ctx.rivalReadiness) * 0.28 + competence * 0.16 + prepared * 6 - (ctx.crisis ? 10 : 0); why.push(ctx.rivalReadiness < 50 ? 'un avversario impreparato' : 'un avversario preparato'); }
  if (topicId === scene.salientTopic) score += 3;
  return { score: Math.round(clamp(score + noise, 5, 95)), why };
}
const reactionLines = (scene, style, result, topic) => {
  const rival = cast(scene, 'rivale').name, host = cast(scene, 'conduttore').name;
  const good = result.score >= 62, bad = result.score < 45;
  return {
    host: line(scene, good ? 'reaction.hostGood' : bad ? 'reaction.hostBad' : 'reaction.hostMid', [host, topic]),
    rival: line(scene, style === 'attacco' ? (good ? 'reaction.rivalGoodAttack' : 'reaction.rivalBadAttack') : good ? 'reaction.rivalGood' : 'reaction.rivalBad', [rival]),
    audience: line(scene, good ? 'reaction.audienceGood' : bad ? 'reaction.audienceBad' : 'reaction.audienceMid')
  };
};

// ---------- the current beat ----------
// The node to show now: who speaks, what, with which face/gesture/shot, and the choices. A pure function of the scene.
export function sceneNode(scene) {
  if (KINDS[scene.kind]) return KINDS[scene.kind].node(scene);
  if (scene.kind === 'comizio') return rallyNode(scene);
  if (scene.kind === 'voto') return voteNode(scene);
  const rival = cast(scene, 'rivale'), host = cast(scene, 'conduttore'), me = cast(scene, 'giocatore');
  const topic = scene.topic, ctx = scene.context;
  const last = scene.history.at(-1) ?? null;
  const base = { id: scene.nodeId, setting: scene.setting };
  switch (scene.nodeId) {
    case 'invito': return { ...base, speaker: host.id, expression: 'sorridente', gesture: 'accoglie', camera: 'host', text: line(scene, 'invito', [scene.show?.name ?? 'Faccia a faccia', topic.label, rival.name]), choices: [['accetta', 'Accetta l’invito'], ['rifiuta', 'Rifiuta (la sedia vuota farà rumore)']] };
    case 'preparazione': return { ...base, speaker: me.id, expression: 'determinata', gesture: 'pensa', camera: 'player', text: `Hai un’ora prima di andare in onda. Su cosa ti prepari? ${ctx.topicPromises.length ? 'Hai promesse sul tema: puoi difenderle.' : 'Non hai promesse su questo tema: sarà difficile citare qualcosa di concreto.'}`, choices: [['programma', 'Ripassa il tuo programma', !ctx.topicPromises.length], ['dati', 'Studia dati e cifre'], ['empatia', 'Prepara storie e volti'], ['attacco', 'Studia i punti deboli dell’avversario']] };
    case 'ingresso': return { ...base, speaker: host.id, expression: 'serena', gesture: 'presenta', camera: 'wide', text: line(scene, 'ingresso', [me.name, rival.name, scene.show?.name ?? 'Faccia a faccia']), choices: [['continua', 'Inizia il dibattito']] };
    case 'q1': return { ...base, speaker: host.id, expression: 'serena', gesture: 'domanda', camera: 'host', text: line(scene, 'q1', [me.name, topic.label]), choices: choicesFor('styles', STYLES, topic.id) };
    case 'r1': return reactionNode(scene, base, 'Reazioni alla prima risposta');
    case 'domanda': return { ...base, speaker: me.id, expression: 'determinata', gesture: 'indica', camera: 'player', text: line(scene, 'domanda', [rival.name]), choices: choicesFor('asks', ASKS, topic.id) };
    case 'risposta-rivale': return reactionNode(scene, base, `${rival.name} risponde`);
    case 'q2': return { ...base, speaker: host.id, expression: 'serena', gesture: 'domanda', camera: 'host', text: secondQuestion(scene, me.name), choices: choicesFor('styles', STYLES, (scene.secondTopic ?? topic).id) };
    case 'r2': return reactionNode(scene, base, 'Reazioni alla seconda risposta');
    case 'attacco': return { ...base, speaker: rival.id, expression: 'determinata', gesture: 'attacca', camera: 'rival', text: scene.attackLine ?? line(scene, 'attacco.any', [rival.name]), choices: choicesFor('replies', REPLIES, topic.id) };
    case 'r3': return reactionNode(scene, base, 'Reazioni alla replica');
    case 'chiusura': return { ...base, speaker: host.id, expression: 'sorridente', gesture: 'accoglie', camera: 'host', text: line(scene, 'chiusura'), choices: choicesFor('closings', CLOSINGS, topic.id) };
    default: return { ...base, speaker: host.id, expression: 'serena', gesture: 'saluta', camera: 'wide', text: scene.outcome?.summary ?? 'Il dibattito è concluso.', choices: [['fine', 'Esci dallo studio']], final: true };
  }
}
function reactionNode(scene, base, title) {
  const last = scene.history.at(-1);
  const lines = last?.reactions ?? {};
  const speaker = lines.rival && /^.+: «/.test(lines.rival) ? cast(scene, 'rivale').id : cast(scene, 'conduttore').id;
  return { ...base, title, speaker, expression: last && last.score >= 62 ? 'serena' : 'determinata', gesture: 'ascolta', camera: speaker === cast(scene, 'rivale').id ? 'rival' : 'host', text: lines.host ?? '', lines: [lines.rival].filter(Boolean), audience: lines.audience, why: last?.why ?? [], score: last?.score ?? null, choices: [['continua', 'Continua']] };
}

// ---------- moving the scene on ----------
const NEXT = { invito: 'preparazione', preparazione: 'ingresso', ingresso: 'q1', q1: 'r1', r1: 'domanda', domanda: 'risposta-rivale', 'risposta-rivale': 'q2', q2: 'r2', r2: 'attacco', attacco: 'r3', r3: 'chiusura', chiusura: 'esito' };
// One door for every kind of scene: the beat before is remembered (the stage animates the passage from it), the rest is the builder of the kind.
export function chooseInScene(input, choiceId) {
  const before = input.nodeId;
  let scene;
  if (KINDS[input.kind]) {
    scene = JSON.parse(JSON.stringify(input));
    if (scene.status !== 'active') throw new Error('La scena è già conclusa.');
    scene = KINDS[input.kind].choose(scene, choiceId);
  } else if (input.kind === 'comizio' || input.kind === 'voto') {
    scene = JSON.parse(JSON.stringify(input));
    if (scene.status !== 'active') throw new Error('La scena è già conclusa.');
    scene = scene.kind === 'comizio' ? rallyChoose(scene, choiceId) : voteChoose(scene, choiceId);
  } else scene = chooseDebate(input, choiceId);
  if (scene.nodeId !== before) scene.prevNodeId = before;
  return scene;
}
function chooseDebate(input, choiceId) {
  const scene = JSON.parse(JSON.stringify(input));
  if (scene.status !== 'active') throw new Error('La scena è già conclusa.');
  const node = sceneNode(scene);
  const choice = node.choices.find(item => item[0] === choiceId);
  if (!choice) throw new Error('Scelta non valida per questo momento.');
  if (choice[2]) throw new Error('Questa scelta non è disponibile: ti manca qualcosa di concreto.');
  const me = cast(scene, 'giocatore'), rival = cast(scene, 'rivale');
  let next = scene.nodeId;
  const log = entry => { scene.history.push({ node: scene.nodeId, choice: choiceId, ...entry }); };
  const mood = delta => { scene.audience.mood = clamp(round1(scene.audience.mood + delta), 0, 100); scene.audience.history.push(scene.audience.mood); };
  if (scene.nodeId === 'invito') {
    if (choiceId === 'rifiuta') { scene.status = 'declined'; scene.outcome = { performance: 38, summary: 'Hai rifiutato l’invito: in studio resta la tua sedia vuota e l’avversario ha tutto il tempo per parlare.', edge: -3, declined: true }; log({ declined: true }); return scene; }
    log({}); next = NEXT.invito;
  } else if (scene.nodeId === 'preparazione') { scene.prepFocus = choiceId; log({ focus: choiceId }); next = NEXT.preparazione; }
  else if (['q1', 'q2'].includes(scene.nodeId)) {
    const topic = scene.nodeId === 'q1' ? scene.topic : (scene.secondTopic ?? scene.topic);
    const result = judge(scene, choiceId, { topicId: topic.id, nodeId: scene.nodeId });
    scene.scores.push({ node: scene.nodeId, kind: 'risposta', style: choiceId, score: result.score });
    mood((result.score - 50) / 3);
    // the rival picks the answer up: the attack that comes later is built where the player is weak
    if (scene.nodeId === 'q1' && choiceId === 'attacco' && result.score < 50) scene.provoked = true;
    log({ style: choiceId, score: result.score, why: result.why, reactions: reactionLines(scene, choiceId, result, topic.label) });
    next = NEXT[scene.nodeId];
  } else if (scene.nodeId === 'domanda') {
    if (choiceId === 'salta') { log({ skipped: true, reactions: { host: `${cast(scene, 'conduttore').name}: «Passiamo avanti.»` }, score: 50, why: [] }); scene.skippedAsk = true; }
    else {
      const rivalWeak = scene.context.rivalReadiness < 50;
      const base = choiceId === 'conti' ? (scene.context.rivalProgram.length >= 3 ? 56 : 44) + (rivalWeak ? 8 : -6) : choiceId === 'coerenza' ? 48 + (rivalWeak ? 10 : -4) : 40 + (scene.context.rivalAggression - 50) * -0.1 + (rivalWeak ? 6 : -8);
      const noise = (unit(`${scene.seed}|domanda|${choiceId}`) - 0.5) * 10;
      const score = Math.round(clamp(base + stats(scene).competence * 0.12 + noise, 5, 95));
      scene.scores.push({ node: 'domanda', kind: 'domanda', style: choiceId, score });
      mood((score - 50) / 3.5);
      log({ ask: choiceId, score, why: [rivalWeak ? 'un avversario in difficoltà' : 'un avversario che regge'], reactions: { host: `${cast(scene, 'conduttore').name}: «Domanda diretta: risponda.»`, rival: score >= 55 ? `${rival.name} esita e cerca le parole.` : `${rival.name}: «Una domanda a effetto, ma la risposta è semplice.»`, audience: score >= 55 ? 'Il pubblico è colpito.' : 'Il pubblico non si lascia convincere.' } });
    }
    next = NEXT.domanda;
  } else if (scene.nodeId === 'attacco') {
    const hasFacts = scene.context.prep >= 8 || scene.prepFocus === 'dati';
    const base = choiceId === 'fatti' ? (hasFacts ? 66 : 42) : choiceId === 'calma' ? 52 + (scene.context.credibility - 50) * 0.1 : choiceId === 'contrattacco' ? 50 + (100 - scene.context.rivalReadiness - 50) * 0.3 : 38;
    const noise = (unit(`${scene.seed}|attacco|${choiceId}`) - 0.5) * 10;
    const score = Math.round(clamp(base + noise, 5, 95));
    scene.scores.push({ node: 'attacco', kind: 'replica', style: choiceId, score });
    mood((score - 50) / 3);
    log({ reply: choiceId, score, why: [hasFacts ? 'preparato sui fatti' : 'poca preparazione sui fatti'], reactions: { host: score >= 60 ? `${cast(scene, 'conduttore').name}: «Una replica efficace.»` : `${cast(scene, 'conduttore').name}: «Una replica debole.»`, rival: score >= 60 ? `${rival.name} perde il filo.` : `${rival.name}: «Vedete? Non risponde.»`, audience: score >= 60 ? 'Il pubblico applaude la replica.' : 'Il pubblico mormora.' } });
    next = NEXT.attacco;
  } else if (scene.nodeId === 'chiusura') {
    const base = choiceId === 'appello' ? 42 + stats(scene).charisma * 0.32 : choiceId === 'sfida' ? 46 + (scene.audience.mood - 50) * 0.3 + (100 - scene.context.rivalReadiness) * 0.1 : 50 + (scene.context.credibility - 50) * 0.15;
    const score = Math.round(clamp(base + (unit(`${scene.seed}|chiusura|${choiceId}`) - 0.5) * 8, 5, 95));
    scene.scores.push({ node: 'chiusura', kind: 'chiusura', style: choiceId, score });
    mood((score - 50) / 4);
    log({ closing: choiceId, score, why: [], reactions: { host: line(scene, 'chiusuraHost', [cast(scene, 'conduttore').name]), rival: `${rival.name} chiude con un appello al voto.`, audience: score >= 60 ? 'Applauso lungo dalla platea.' : 'Applauso cortese.' } });
    // the end: the performance is the weighted mean of the beats, and the audience's mood adds its share
    const weights = { risposta: 1.3, domanda: 0.7, replica: 1, chiusura: 0.7 };
    const total = scene.scores.reduce((sum, item) => sum + item.score * weights[item.kind], 0), w = scene.scores.reduce((sum, item) => sum + weights[item.kind], 0);
    const performance = Math.round(clamp(total / w * 0.8 + scene.audience.mood * 0.2, 0, 100));
    const edge = round1((performance - 50) / 5.5);
    const best = [...scene.scores].sort((a, b) => b.score - a.score)[0], worst = [...scene.scores].sort((a, b) => a.score - b.score)[0];
    scene.outcome = { performance, edge, audience: scene.audience.mood, best: best ? { kind: best.kind, style: best.style, score: best.score } : null, worst: worst ? { kind: worst.kind, style: worst.style, score: worst.score } : null,
      summary: performance >= 62 ? `Serata positiva per ${me.name}: ${rival.name} non è riuscito a metterti in difficoltà.` : performance >= 48 ? `Serata in equilibrio fra ${me.name} e ${rival.name}: nessuno ha vinto davvero.` : `Serata difficile per ${me.name}: ${rival.name} ha avuto la meglio.` };
    scene.status = 'done'; scene.nodeId = 'esito';
    return scene;
  } else { next = NEXT[scene.nodeId] ?? 'esito'; log({}); }
  // the rival's attack is built just before it comes, where the player is weakest
  if (next === 'attacco') scene.attackLine = attackLine(scene);
  scene.nodeId = next;
  // (the attack is skipped when nothing gives the rival a reason: a prepared, credible player who did not provoke)
  return scene;
}
// The second question: where it comes from is the situation (a broken promise, the opponent's programme, a fact of the days, the money, the other topic); the choice among the ones that apply is by the seed.
function secondQuestion(scene, name) {
  const ctx = scene.context, rival = cast(scene, 'rivale').name;
  const broken = ctx.promises.find(item => item.status === 'non-mantenuta'), open = ctx.promises.find(item => item.status !== 'non-mantenuta');
  const options = [['q2.money', [name]]];
  if (scene.secondTopic) options.push(['q2.topic', [name, scene.secondTopic.label]]);
  if (broken) options.push(['q2.broken', [name, broken.label]]);
  if (open) options.push(['q2.promise', [name, open.label]]);
  if (ctx.rivalProgramLabels?.length) options.push(['q2.rival', [name, rival, ctx.rivalProgramLabels[0]]]);
  if (ctx.events?.length) options.push(['q2.event', [name, ctx.events[0]]]);
  const [key, args] = options[Math.floor(unit(`${scene.seed}|q2`) * options.length)];
  return line(scene, key, args);
}
function attackLine(scene) {
  const rival = cast(scene, 'rivale').name, ctx = scene.context;
  const broken = ctx.promises.find(item => item.status === 'non-mantenuta');
  const options = [];
  if (broken) options.push(['attacco.broken', [rival, broken.label]]);
  if (ctx.credibility < 50) options.push(['attacco.credibility', [rival]]);
  if (ctx.crisis) options.push(['attacco.crisis', [rival]]);
  if (scene.provoked) options.push(['attacco.provoked', [rival]]);
  if (ctx.weakProposal) options.push(['attacco.coverage', [rival, ctx.weakProposal]]);
  if (ctx.events?.length) options.push(['attacco.event', [rival, ctx.events[0]]]);
  if (!options.length) options.push(['attacco.any', [rival]]);
  const [key, args] = options[Math.floor(unit(`${scene.seed}|attacco-line`) * options.length)];
  return line(scene, key, args);
}

// What the finished scene gives back to the game: the edge for the debate (campaign-engine uses it in place of the random comparison), a line for the history, a memory for the rival.
export function sceneEffects(scene) {
  if (!scene.outcome) return null;
  if (KINDS[scene.kind]) return KINDS[scene.kind].effects(scene);
  if (scene.kind === 'comizio') return rallyEffects(scene);
  if (scene.kind === 'voto') return { voted: true, line: 'Hai votato.' };
  const performance = scene.outcome.performance;
  const base = { edge: scene.outcome.edge, performance, declined: Boolean(scene.outcome.declined), topicId: scene.topic.id, rivalId: cast(scene, 'rivale').id, line: scene.outcome.summary };
  // an ordinary guest spot (not an electoral debate): the verdict moves the media numbers of the player, scaled by the performance
  if (scene.kind === 'talkshow') return { ...base, deltas: { notoriety: round1(clamp(1.2 + performance / 28, 0, 5)), popularity: round1((performance - 50) / 28), reputation: round1((performance - 50) / 50) }, mediaTone: performance >= 62 ? 1 : performance < 45 ? -1 : 0.3 };
  return base;
}
export const sceneProgress = scene => {
  if (KINDS[scene.kind]) return KINDS[scene.kind].progress(scene);
  if (scene.kind === 'comizio') return rallyProgress(scene);
  if (scene.kind === 'voto') return voteProgress(scene);
  const index = BEATS.indexOf(scene.nodeId); return { index: Math.max(0, index), total: BEATS.length };
};
// An ordinary television guest spot: the same studio, the same beats and the same scoring as the debate, with a guest of the show in the place of the rival.
export function createTalkShowScene(args) { const scene = createDebateScene(args); return { ...scene, kind: 'talkshow', topic: { ...scene.topic } }; }
// The scene played in one go by the best choices the situation allows (the quick way of a guest spot or of a rally): the same beats, the same scoring, the same outcome as the animated way, with no
// stage. The choice at each beat is the one that scores best in that beat (ties: the first), so the quick result is the result of a careful player, not a lottery.
export function autoPlay(input) {
  let scene = input;
  for (let guard = 0; guard < 40 && scene.status === 'active'; guard++) {
    const node = sceneNode(scene);
    let best = null;
    for (const choice of node.choices) {
      if (choice[2]) continue;
      let trial; try { trial = chooseInScene(scene, choice[0]); } catch { continue; }
      const entry = trial.history.at(-1);
      const value = Number.isFinite(entry?.score) ? entry.score : (trial.status === 'done' ? trial.outcome?.performance ?? 0 : (choice[0] === 'accetta' || choice[0] === 'continua' || choice[0] === 'fine' ? 100 : 0));
      if (!best || value > best.value) best = { id: choice[0], value };
    }
    if (!best) break;
    scene = chooseInScene(scene, best.id);
  }
  return scene;
}
