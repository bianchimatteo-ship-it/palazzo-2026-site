// A question and its answers belong to the same subject. The case found by the player: the debate on «Lavoro e sviluppo», the rival attacks with a headline of the week («Proteste per i ritardi nei
// soccorsi, lei dov’era?») and the answers offered were «Rispondi con i dati dell’occupazione» and «Resta calmo e spiega le tue scelte sul lavoro». The attack and the second question took a fact of the
// days, but the choices were built on the topic of the debate. Checked on the debate engine (core/scene-engine.js) with the real choices (data/debate-choices.js):
//   1. the case of the rescue services: the attack on the delays of the rescue is answered with choices about the rescue, never about jobs;
//   2. every subject the player listed: an attack or a second question built on a fact of that subject offers the choices of that subject; a fact that does not say its subject offers the generic
//      wording, never the choices of the debate's topic when that is another subject;
//   3. the attacks on what is said in the debate (credibility, controversies, tone) offer the choices of the debate's subject;
//   4. a scene saved before the fix (an attack line without its subject) offers the generic wording, not the debate's topic.
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const E = await import(new URL(`../src/core/scene-engine.js?v=${build}`, import.meta.url).href);
const { DEBATE_CHOICES } = await import(new URL(`../src/data/debate-choices.js?v=${build}`, import.meta.url).href);
const { topicOfText } = await import(new URL(`../src/core/topic-of-text.js?v=${build}`, import.meta.url).href);
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
const labelsOf = topicId => Object.values(DEBATE_CHOICES[topicId] ?? {}).flatMap(group => Object.values(group).map(([label]) => label[0]));
const make = ({ topic = { id: 'lavoro', label: 'Lavoro e sviluppo' }, events = [], credibility = 70, promises = [], seed = 's' } = {}) => E.withStats(E.createDebateScene({ id: 'd', seed, player: { name: 'Anna Rossi' }, playerAvatar: null, rival: { id: 'r', name: 'Luca Bianchi', partyId: 'p' }, host: { id: 'h', name: 'Marco Valenti' }, topic, secondTopic: null, salientTopic: topic.id, promises, credibility, prep: 50, events, rivalReadiness: 60, rivalAggression: 60 }), { competence: 60, charisma: 60 });
// walk the scene to a node, answering with the first choice
const walkTo = (scene, nodeId) => { let node = E.sceneNode(scene), guard = 0; while (node.id !== nodeId && !node.final && guard++ < 20) { scene = E.chooseInScene(scene, (node.choices.find(choice => !choice[2]) ?? node.choices[0])[0]); node = E.sceneNode(scene); } return { scene, node }; };
// 1. the case of the rescue services
const CASE = 'Proteste per i ritardi nei soccorsi';
let attacks = 0, seconds = 0;
for (let n = 0; n < 200 && (attacks < 6 || seconds < 6); n++) {
  const base = make({ events: [CASE], seed: `soccorsi-${n}`, credibility: 80 });
  const { node } = walkTo(base, 'attacco');
  if (node.id === 'attacco' && node.text.includes('soccorsi')) {
    attacks++;
    const labels = node.choices.map(choice => choice[1]);
    check(!labels.some(label => /occupazione|lavoro|salari/i.test(label)), `Attacco sui soccorsi: nessuna risposta sul lavoro (${labels.join(' | ')}).`);
    check(labels.some(label => /soccors|emergenz/i.test(label)), `Attacco sui soccorsi: le risposte parlano dei soccorsi (${labels.join(' | ')}).`);
  }
  const { node: q2 } = walkTo(make({ events: [CASE], seed: `soccorsi-${n}`, credibility: 80 }), 'q2');
  if (q2.id === 'q2' && q2.text.includes('soccorsi')) {
    seconds++;
    const labels = q2.choices.map(choice => choice[1]);
    check(!labels.some(label => /occupazione|salari|lavoro/i.test(label)), `Domanda sui soccorsi: nessuna risposta sul lavoro (${labels.join(' | ')}).`);
  }
}
check(attacks >= 3 && seconds >= 3, `Il caso dei soccorsi è stato riprodotto (${attacks} attacchi, ${seconds} seconde domande).`);
// 2. every subject: a headline of that subject, a debate on another subject
const SUBJECTS = [
  ['lavoro', 'Licenziamenti alla fabbrica di componenti'], ['sanita', 'Liste d’attesa di otto mesi in ospedale'], ['soccorsi', 'Alluvione: soccorsi in ritardo nella valle'], ['servizi', 'Chiude l’ufficio postale del paese'],
  ['sicurezza', 'Rapina in centro, cresce la paura'], ['costo-vita', 'Bollette e prezzi alle stelle'], ['ambiente', 'Siccità e inquinamento del fiume'], ['giovani', 'Scuole senza docenti a ottobre'],
  ['immigrazione', 'Nuovi sbarchi, centri di accoglienza pieni'], ['diritti', 'Fine vita, la legge ferma in Parlamento'], ['istituzioni', 'Scandalo corruzione in consiglio regionale']
];
for (const [subject, headline] of SUBJECTS) {
  check(topicOfText(headline) === subject, `«${headline}» è riconosciuto come ${subject} (${topicOfText(headline)}).`);
  const debateTopic = subject === 'lavoro' ? { id: 'sanita', label: 'Sanità' } : { id: 'lavoro', label: 'Lavoro e sviluppo' };
  const foreign = labelsOf(debateTopic.id);
  let seen = 0;
  for (let n = 0; n < 160 && seen < 2; n++) {
    const { node } = walkTo(make({ topic: debateTopic, events: [headline], seed: `${subject}-${n}`, credibility: 80 }), 'attacco');
    if (node.id !== 'attacco' || !node.text.includes(headline)) continue;
    seen++;
    const labels = node.choices.map(choice => choice[1]);
    check(!labels.some(label => foreign.includes(label)), `${subject}: l’attacco sul fatto non offre le risposte del tema ${debateTopic.id} (${labels.join(' | ')}).`);
    if (DEBATE_CHOICES[subject]) check(labels.every(label => labelsOf(subject).includes(label)), `${subject}: l’attacco offre le risposte di quel tema (${labels.join(' | ')}).`);
  }
  check(seen > 0, `${subject}: attacco costruito sul fatto riprodotto.`);
}
// a headline that does not say its subject: generic wording
{
  const generic = Object.values(E.REPLIES).map(item => item.label);
  let seen = 0;
  for (let n = 0; n < 200 && seen < 2; n++) {
    const { node } = walkTo(make({ events: ['Settimana tesa a Palazzo'], seed: `vago-${n}`, credibility: 80 }), 'attacco');
    if (node.id !== 'attacco' || !node.text.includes('Settimana tesa')) continue;
    seen++;
    check(node.choices.every(choice => generic.includes(choice[1])), `Un fatto senza tema chiaro offre le risposte generiche (${node.choices.map(choice => choice[1]).join(' | ')}).`);
  }
  check(seen > 0, 'Il caso del fatto senza tema è stato riprodotto.');
}
// 3. the attacks on what is said in the debate (credibility, controversies, tone): the choices of the debate's own subject
{
  const own = labelsOf('lavoro');
  let seen = 0;
  for (let n = 0; n < 120; n++) {
    const { scene, node } = walkTo(make({ events: [], seed: `cred-${n}`, credibility: 30 }), 'attacco');
    if (node.id !== 'attacco') continue;
    seen++;
    check(scene.attackTopic === 'lavoro' && node.choices.every(choice => own.includes(choice[1])), `Un attacco sulla credibilità nel dibattito sul lavoro offre le risposte sul lavoro (${node.choices.map(choice => choice[1]).join(' | ')}).`);
  }
  check(seen > 10, 'Attacchi sul dibattito verificati.');
}
// 4. an old scene: an attack line saved without its subject
{
  const { scene } = walkTo(make({ events: [CASE], seed: 'vecchio', credibility: 80 }), 'attacco');
  const old = { ...scene, attackTopic: undefined };
  delete old.attackTopic;
  const node = E.sceneNode(old);
  if (node.id === 'attacco') check(!node.choices.some(choice => /occupazione|salari/i.test(choice[1])), 'Una scena salvata prima della correzione non offre risposte di un altro tema.');
}
if (problems.length) { console.error(`Coerenza tra domanda e risposte — problemi:\n- ${[...new Set(problems)].slice(0, 25).join('\n- ')}`); process.exit(1); }
console.log(`Coerenza tra domanda e risposte verificata: il caso dei soccorsi (${attacks} attacchi e ${seconds} seconde domande) offre risposte sui soccorsi, mai sul lavoro; ${SUBJECTS.length} temi (lavoro, sanità, soccorsi, servizi, sicurezza, costo della vita, ambiente, istruzione, immigrazione, diritti civili, istituzioni) riconosciuti dal testo del fatto e risposti sul proprio tema; fatti senza tema chiaro con le risposte generiche, attacchi su credibilità o toni con le risposte del tema del dibattito; scene salvate prima senza risposte di un altro tema.`);
