// TV debates and talk shows played whole on REAL careers (a deputy, a municipal councillor, a plain member; outside and inside a campaign), several seeds, every way of answering. Checked at every beat:
//   · the figure highlighted is the one who says the first line (a reaction where the rival answers starts with the rival's line, the host's comment after it; «X risponde» is X speaking);
//   · the reaction to the second question speaks of what was asked (the money question → «Conti e coperture», not the subject of the first question);
//   · a «fact of the days» quoted by the rival or the host is a public matter with a subject, never an entry of the player's own diary (an invitation, a request of the party);
//   · the player's tag is what the public knows: the office without the notes of the data («(scenario di simulazione)»), «Candidata»/«Candidato» by gender, the list really run with;
//   · a name never follows a bare «a» in the host's lines (Italian wants «ad» before a vowel: the lines are written so that the case cannot happen).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, approveNomination } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const E = await import(new URL(`../src/core/scene-engine.js?v=${build}`, import.meta.url).href);
const { topicOfText } = await import(new URL(`../src/core/topic-of-text.js?v=${build}`, import.meta.url).href);
const { publicFact } = E;
const { genderOf, F } = await import(new URL(`../src/core/avatar.js?v=${build}`, import.meta.url).href);
const problems = [];
const want = (ok, text) => { if (!ok) problems.push(text); };
let scenes = 0, beats = 0;
function play(store, label, pick) {
  for (let step = 0; step < 30; step++) {
    const scene = store.getState().scene; if (!scene) break;
    const node = E.sceneNode(scene); beats++;
    const where = `${label}/${node.id}`;
    const who = scene.cast.find(item => item.id === node.speaker);
    // the first line is said by the highlighted figure (lines written «Nome: «…»»)
    const quoted = String(node.text ?? '').match(/^([^:«,]+): «/)?.[1]?.trim();
    if (quoted && who) want(quoted === who.name, `${where}: evidenziato ${who.name}, ma la prima battuta è di ${quoted}.`);
    if (/^risposta-rivale$/.test(node.id) && (node.lines?.length || /^.+: «/.test(node.text ?? ''))) want(!quoted || who?.role !== 'conduttore' || !node.lines?.some(line => line.startsWith(`${scene.cast.find(item => item.role === 'rivale')?.name}: «`)), `${where}: la risposta del rivale è detta dal rivale.`);
    for (const text of [node.text, ...(node.lines ?? []), ...(node.preface ?? [])].filter(Boolean)) want(!/(^|[\s(])a [AEIOU][a-zà-ù]+ [A-Z]/.test(text), `${where}: «a» davanti a un nome che comincia per vocale («${text.slice(0, 80)}»).`);
    if (node.id === 'r2' && scene.q2?.source === 'q2.money' && !scene.q2?.topicId) want(![node.text, ...(node.lines ?? [])].some(line => line?.includes(scene.topic.label)), `${where}: la reazione alla domanda sui conti non parla di «${scene.topic.label}».`);
    for (const fact of [scene.attackLine?.source === 'attacco.event' ? scene.attackLine : null, scene.q2?.source === 'q2.event' ? scene.q2 : null].filter(Boolean)) want(!/\b(TV|dibattito|intervista|ospitata|chiede mezzi|comitato)\b/i.test(fact.text.replace(/^[^:]+: «/, '')) || /Govern|ministr/.test(fact.text), `${where}: un fatto citato nel dibattito è una questione pubblica, non una voce del diario del giocatore («${fact.text}»).`);
    if (node.final || !node.choices?.length) { try { store.sceneChoose(node.choices?.[0]?.[0] ?? 'fine'); } catch { /* closed */ } break; }
    const open = node.choices.filter(choice => !choice[2]);
    try { store.sceneChoose(pick(open, step)[0]); } catch (error) { problems.push(`${where}: ${error.message}`); break; }
  }
  if (store.getState().scene) { try { store.sceneAbandon(); } catch { /* none */ } }
  scenes++;
}
const tagOk = (store, label) => {
  const scene = store.getState().scene; if (!scene) return;
  const me = scene.cast.find(item => item.role === 'giocatore'), rival = scene.cast.find(item => item.role === 'rivale');
  want(!/\(/.test(me?.tag ?? ''), `${label}: l’etichetta del giocatore è senza note dei dati («${me?.tag}»).`);
  if (rival && /^Candidat/.test(rival.tag ?? '')) want((genderOf({ name: rival.name }) === F) === rival.tag.startsWith('Candidata'), `${label}: «${rival.tag}» concorda con ${rival.name}.`);
  const state = store.getState(), player = state.dataset.politicians.find(item => item.id === state.career.playerId);
  if (state.campaign?.status === 'active' && /^Candidat/.test(me?.tag ?? '')) want(me.tag.startsWith(player?.gender === 'donna' ? 'Candidata' : 'Candidato'), `${label}: «${me.tag}» concorda con il genere del personaggio.`);
};
const pickers = [o => o[0], o => o.at(-1), (o, i) => o[(i * 2) % o.length]];
for (const [level, draft] of [['deputato', {}], ['comunale', {}], ['comunale', { startingOffice: 'iscritto' }]]) for (const seed of ['a', 'b']) {
  const run = await startCareer({ seed: `studio-${level}-${draft.startingOffice ?? 'eletto'}-${seed}`, level, draft, fast: true });
  const { store } = run; store.setHeadlessVoter(() => 'astenuto');
  const tag = `${level}${draft.startingOffice ? '/iscritto' : ''}/${seed}`;
  for (const [p, pick] of pickers.entries()) { try { store.startTalkShowScene({ source: 'attivita' }); tagOk(store, `${tag} talk show`); play(store, `${tag} talk show ${p}`, pick); } catch (error) { if (!/notoriet|invit|già|settimana/i.test(error.message)) problems.push(`${tag} talk show: ${error.message}`); } }
  try {
    const type = level === 'deputato' ? 'politiche' : 'comunale';
    for (let t = 0; t < 30 && !store.fastForwardToElection(type); t++);
    store.startCampaign({ electionType: type, objective: 'seat', ...(type === 'politiche' ? { role: 'deputato' } : {}) }, run.db.parties, { politicians: run.db.politicians, groups: run.db.parliamentaryGroups });
    approveNomination?.(store);
    for (const [p, pick] of pickers.entries()) { try { store.startDebateScene({}); tagOk(store, `${tag} dibattito`); play(store, `${tag} dibattito ${p}`, pick); } catch (error) { if (!/già|una scena|dibattit/i.test(error.message)) problems.push(`${tag} dibattito: ${error.message}`); } }
  } catch (error) { problems.push(`${tag} campagna: ${error.message}`); }
}
// the event filter itself: a diary entry is not a public fact, a public matter is
assert.equal(publicFact('Dibattito su una TV locale'), false); assert.equal(publicFact('Lodi: Sara Ferri chiede mezzi'), false); assert.ok(publicFact('Il pronto soccorso chiude di notte')); assert.ok(publicFact('Si dimette un ministro: il Governo è costretto a rimpiazzarlo')); assert.ok(topicOfText('Il pronto soccorso chiude di notte'));
assert.ok(scenes >= 18, `scene giocate: ${scenes}`);
assert.deepEqual(problems.slice(0, 15), [], `Dibattiti e talk show:\n${problems.slice(0, 15).join('\n')}`);
console.log(`Dibattiti e talk show verificati su carriere reali (deputato, consigliere comunale, iscritto; dentro e fuori campagna): ${scenes} scene, ${beats} momenti. Chi è evidenziato dice la prima battuta, la reazione alla seconda domanda parla di ciò che è stato chiesto, i fatti citati sono questioni pubbliche, etichette senza note e concordate per genere, nessun «a» davanti a un nome che comincia per vocale.`);
