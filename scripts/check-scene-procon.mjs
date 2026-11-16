// Pro and contro on the buttons of the debate: each way of answering (data, empathy, programme, attack) shows what it has going for it and against it, read from the same terms the engine judges with
// (the stats of the player, the preparation, the promises on the topic, how ready the rival is): different stats give different lines, and the engine agrees with them.
import assert from 'node:assert/strict';
import { chooseInScene, createDebateScene, proCon, sceneNode, withStats } from '../src/core/scene-engine.js';
import { normalizeAvatar } from '../src/core/avatar.js';

const avatar = normalizeAvatar({ face: 'femminile', skin: 'oliva', hair: 'rosso', hairstyle: 'ondulato', beard: 'nessuna', glasses: 'tondi', jacket: 'bordeaux', eyes: 'verdi', expression: 'sorridente', moustache: 'nessuno' });
const make = (over = {}, stats = { competence: 70, charisma: 60 }) => withStats(createDebateScene({ id: 'd1', seed: 's1', player: { name: 'Anna Rossi' }, playerAvatar: avatar, rival: { id: 'riv-1', name: 'Luca Bianchi', partyId: 'p1' }, host: { id: 'conduttore-1', name: 'Marco Valenti' }, topic: { id: 'sanita', label: 'Sanità' }, secondTopic: { id: 'lavoro', label: 'Lavoro e sviluppo' }, salientTopic: 'sanita', promises: [{ id: 'pr1', label: 'Sanità', topic: 'sanita', status: 'non-avviata', intervention: 'Investimento in sanità', cost: 3 }], credibility: 70, prep: 10, rivalProgram: ['sanita', 'fisco'], rivalReadiness: 40, rivalAggression: 60, ...over }), stats);
let scene = make();
for (const pick of ['accetta']) scene = chooseInScene(scene, pick);
let node = sceneNode(scene), guard = 0;
while (!node.choices?.some(choice => choice[4]) && guard++ < 6) { scene = chooseInScene(scene, node.choices[0][0]); node = sceneNode(scene); }
const withOdds = node.choices.filter(choice => choice[4]);
assert.ok(withOdds.length >= 4, `I quattro modi di rispondere hanno pro e contro (${withOdds.length}).`);
for (const choice of withOdds) { assert.ok(choice[4].pro.length + choice[4].contro.length >= 2, `«${choice[0]}» ha almeno due righe tra pro e contro.`); assert.ok(choice[4].contro.length >= 1, `«${choice[0]}» ha anche un contro.`); }
// the lines follow the stats
const strong = make({}, { competence: 90, charisma: 30 }), weak = make({}, { competence: 20, charisma: 85 });
assert.match(proCon(strong, 'dati').pro.join(' '), /competenza 90/); assert.match(proCon(weak, 'dati').contro.join(' '), /competenza 20/);
assert.match(proCon(weak, 'empatia').pro.join(' '), /carisma 85/); assert.match(proCon(strong, 'empatia').contro.join(' '), /carisma 30/);
// promises: with a promise on the topic the programme has it as a pro, without it as a con
assert.match(proCon(make(), 'programma').pro.join(' '), /promessa sul tema/);
assert.match(proCon(make({ promises: [] }), 'programma').contro.join(' '), /nessuna promessa concreta/);
assert.match(proCon(make({ credibility: 20 }), 'programma').contro.join(' '), /credibilità 20/);
assert.match(proCon(make({ rivalReadiness: 80 }), 'attacco').contro.join(' '), /preparato/); assert.match(proCon(make({ rivalReadiness: 20 }), 'attacco').pro.join(' '), /impreparato/);
// the engine agrees: with a promise the programme style judges better than without
const score = (over, stats, style) => { let s = make(over, stats); for (let g = 0; g < 14 && !s.scores.length; g++) { const n = sceneNode(s); const pick = n.choices.find(c => c[0] === style && c[4] && !c[2]) ?? n.choices.find(c => !c[2]); s = chooseInScene(s, pick[0]); } const last = s.scores.at(-1); return typeof last === 'number' ? last : last?.score; };
assert.ok(score({}, { competence: 90, charisma: 50 }, 'dati') > score({}, { competence: 15, charisma: 50 }, 'dati'), 'Il pro «competenza alta» è davvero un vantaggio per il motore.');
assert.ok(score({}, { competence: 50, charisma: 90 }, 'empatia') > score({}, { competence: 50, charisma: 15 }, 'empatia'), 'Il pro «carisma alto» è davvero un vantaggio per il motore.');
console.log('Pro e contro sui pulsanti del dibattito verificati: quattro stili con vantaggi e svantaggi letti dagli stessi termini del motore (competenza, carisma, promesse, preparazione dell’avversario), coerenti con i punteggi.');
