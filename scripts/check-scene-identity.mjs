// Who is in the scenes and what they can say. (1) Gender: every invented character has an explicit gender in the data, the avatar follows it, the name and the role are coherent with it, the same character is the
// same every time; the real politicians of the database carry no gender, so the first name is the evidence (and the scene says so). (2) The choices follow the subject: each topic of the television debate and
// each family of the activity scenes has its own wording (ids and effects unchanged), and the debate of two topics does not offer the same words. (3) Citizens and associations are two different experiences: the
// market square against the civic hall (setting, backdrop, people, banner, dialogues). (4) The name of each candidate is written on the lectern of the TV debate.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const lines = await import(`../src/data/activity-scene-lines.js${v}`);
const guests = await import(`../src/data/activity-scene-guests.js${v}`);
const approaches = await import(`../src/data/activity-scene-approaches.js${v}`);
const scenes = await import(`../src/core/activity-scenes.js${v}`);
const engine = await import(`../src/core/scene-engine.js${v}`);
const avatar = await import(`../src/core/avatar.js${v}`);
const studio = await import(`../src/data/debate-choices.js${v}`);   // (it registers its choices in the scene engine, as the scene page does)
const room = await import(`../src/ui/room-art.js${v}`);
const art = await import(`../src/ui/stage-art.js${v}`);
const { M, F, genderOf, roleGender, ROLE_GENDER } = avatar;

// ---------- 1. gender ----------
const player = { name: 'Anna Verdi', tag: 'Deputata' };
let checked = 0, women = 0, men = 0;
for (const kind of Object.keys(lines.ACTIVITY_SCENES)) {
  const spec = lines.ACTIVITY_SCENES[kind];
  for (const activityId of spec.activityIds) for (const family of spec.families) for (let n = 0; n < 6; n++) {
    const scene = scenes.createActivityScene({ id: `g-${kind}-${family.id}-${n}`, seed: `genere|${kind}|${family.id}|${n}`, sceneKey: kind, activityId, player, playerAvatar: null, prefer: family.id, party: { label: 'Rotta Civica' }, pool: ['Rotta Civica', 'Alleanza Futura'] });
    for (const person of scene.cast.filter(item => item.role === 'ospite')) {
      checked++;
      assert.ok([M, F].includes(person.gender), `${kind}/${family.id}: il personaggio ha un genere esplicito (${person.gender}).`);
      assert.equal(person.avatar.face, person.gender, `${kind}/${family.id}: l’avatar di ${person.name} segue il genere (${person.gender}).`);
      assert.equal(genderOf({ name: person.name }), person.gender, `${person.name}: il nome è coerente con il genere (${person.gender}).`);
      const asked = roleGender(person.roleLabel);
      assert.ok(!asked || asked === person.gender, `«${person.roleLabel}» (${asked}) non è affidato a ${person.name} (${person.gender}).`);
      if (person.gender === F) women++; else men++;
    }
    const again = scenes.createActivityScene({ id: `g-${kind}-${family.id}-${n}`, seed: `genere|${kind}|${family.id}|${n}`, sceneKey: kind, activityId, player, playerAvatar: null, prefer: family.id, party: { label: 'Rotta Civica' }, pool: ['Rotta Civica', 'Alleanza Futura'] });
    assert.deepEqual(again.cast, scene.cast, 'Lo stesso personaggio è sempre lo stesso: nome, genere e aspetto.');
  }
}
assert.ok(women > checked * 0.25 && men > checked * 0.25, `Uomini e donne ci sono tutti e due (${men} e ${women} su ${checked}).`);
// every role of the guests is known to the table (a role in the feminine or the masculine form has its gender written), or it is meant for anyone
const allRoles = new Set([...Object.values(guests.GUESTS).flatMap(kind => Object.values(kind).flat()), ...Object.values(guests.CITIZEN_GUESTS).flat(), ...Object.values(lines.ACTIVITY_SCENES).flatMap(spec => spec.cast.map(item => item.tag))].map(pair => pair[0]));
for (const label of allRoles) {
  const first = label.split(' ')[0];
  const feminine = /^(Una |Un’operaia|Direttrice|Dirigente scolastica|Delegata|Ministra)/.test(label) && !/coppia/.test(label);   // (a couple is anyone's)
  const masculine = /^(Un |Uno |Ministro|Sottosegretario|Segretario|Delegato|Direttore|Comandante|Capocantiere|Ragioniere|Ingegnere|Geologo|Commercialista|Medico|Funzionario|Tesoriere|Militante|Caporedattore|Caposervizio)/.test(label);
  if (feminine) assert.equal(roleGender(label), F, `«${label}»: ruolo al femminile con genere scritto.`);
  else if (masculine) assert.equal(roleGender(label), M, `«${label}»: ruolo al maschile con genere scritto.`);
  void first;
}
// the debate: rival and host have an explicit gender and the avatar follows it; the real politicians (gender empty in the data) are read from the first name
const mk = (rivalName, hostName) => engine.withStats(engine.createDebateScene({ id: 'd', seed: 'd', player, playerAvatar: null, rival: { id: 'r', name: rivalName, partyId: 'p' }, host: { id: 'h', name: hostName, tag: 'Moderatore' }, topic: { id: 'sanita', label: 'Sanità' } }), { competence: 60, charisma: 60 });
for (const [rivalName, hostName, rivalGender, hostGender] of [['Giulia Rossi', 'Marco Valenti', F, M], ['Luca Bianchi', 'Elena Mariani', M, F], ['Elly Schlein', 'Paolo Conti', F, M], ['Giorgia Meloni', 'Giulia Ferri', F, F], ['Matteo Salvini', 'Marco Valenti', M, M]]) {
  const scene = mk(rivalName, hostName);
  const rival = scene.cast.find(item => item.role === 'rivale'), host = scene.cast.find(item => item.role === 'conduttore');
  assert.deepEqual([rival.gender, rival.avatar.face, host.gender, host.avatar.face], [rivalGender, rivalGender, hostGender, hostGender], `${rivalName} e ${hostName}: genere e avatar coerenti.`);
}
// a character without a saved avatar (a scene saved earlier) keeps the face of its gender
const rally = await import(`../src/core/rally-scene.js${v}`);
const vote = rally.createVoteScene({ id: 'v', seed: 'v', player, playerAvatar: null, place: { municipality: 'Siena' } });
for (const person of vote.cast.filter(item => item.role === 'scrutatore')) assert.ok([M, F].includes(person.gender) && person.avatar.face === person.gender && genderOf({ name: person.name }) === person.gender, `Lo scrutatore ${person.name} ha genere e avatar coerenti.`);
// the player keeps the gender and the look chosen at the start
const mine = avatar.normalizeAvatar({ ...avatar.defaultAvatarFor('io'), face: 'maschile' });
assert.deepEqual(mk('Giulia Rossi', 'Elena Mariani').cast[0].avatar, avatar.normalizeAvatar(null), 'Il giocatore senza avatar salvato resta quello predefinito…');
const scene = engine.withStats(engine.createDebateScene({ id: 'd', seed: 'd', player, playerAvatar: mine, rival: { id: 'r', name: 'Giulia Rossi', partyId: 'p' }, host: { id: 'h', name: 'Marco Valenti', tag: 'Moderatore' }, topic: { id: 'sanita', label: 'Sanità' } }), { competence: 60, charisma: 60 });
assert.deepEqual(scene.cast[0].avatar, mine, '…e quello scelto a inizio carriera non si tocca.');
// the candidates the game makes up carry the gender in the data
const campaign = await import(`../src/core/campaign-engine.js${v}`);
const taken = new Set();
for (let i = 0; i < 40; i++) { const name = campaign.simulatedName('prova', i, taken); assert.ok(genderOf({ name }), `Il nome inventato «${name}» ha un genere nei dati.`); }
console.log(`  Genere: ${checked} personaggi di scena (${men} uomini, ${women} donne) con genere esplicito, avatar, nome e ruolo coerenti e stabili; rivali, conduttori e scrutatori; il giocatore intatto.`);

// ---------- 2. the choices follow the subject ----------
const topics = Object.keys(studio.DEBATE_CHOICES);
assert.equal(topics.length, 8, 'Otto temi del dibattito.');
const labelsOf = topic => ['styles', 'asks', 'replies', 'closings'].flatMap(group => Object.values(studio.DEBATE_CHOICES[topic][group]).map(item => item[0][0]));
const seen = new Set();
for (const topic of topics) {
  const labels = labelsOf(topic);
  assert.equal(labels.length, 15, `${topic}: quindici scelte (4 stili, 4 domande, 4 repliche, 3 chiusure).`);
  assert.equal(new Set(labels).size, 15, `${topic}: scelte tutte diverse tra loro.`);
  for (const label of labels) assert.ok(!seen.has(label), `«${label}» è di un solo tema.`), seen.add(label);
}
const choicesAt = (topicId, nodeId) => { const s = engine.withStats(engine.createDebateScene({ id: 'd', seed: 'd', player, playerAvatar: null, rival: { id: 'r', name: 'Luca Bianchi', partyId: 'p' }, host: { id: 'h', name: 'Marco Valenti', tag: 'Moderatore' }, topic: { id: topicId, label: topicId }, secondTopic: { id: 'lavoro', label: 'Lavoro' } }), { competence: 60, charisma: 60 }); s.nodeId = nodeId; return engine.sceneNode(s).choices; };
for (const node of ['q1', 'domanda', 'attacco', 'chiusura']) {
  const health = choicesAt('sanita', node), economy = choicesAt('costo-vita', node);
  assert.deepEqual(health.map(item => item[0]), economy.map(item => item[0]), `${node}: stessi id e stessi effetti`);
  assert.ok(health.every((item, i) => item[1] !== economy[i][1]), `${node}: parole diverse tra sanità e costo della vita.`);
}
assert.ok(choicesAt('sanita', 'q1').some(item => /liste d’attesa/.test(item[1])), 'Nel dibattito sulla sanità ci sono le liste d’attesa.');
assert.ok(choicesAt('costo-vita', 'q1').some(item => /inflazione|bollette/.test(item[1])), 'In quello sul costo della vita inflazione e bollette.');
assert.ok(choicesAt('sanita', 'q2').some(item => /occupazione|salari/.test(item[1])), 'La seconda domanda segue il secondo tema (lavoro).');
for (const topic of topics) for (const group of ['styles', 'asks', 'replies', 'closings']) for (const [id, [label, detail]] of Object.entries(studio.DEBATE_CHOICES[topic][group])) assert.ok(label[0] && label[1] && detail[0] && detail[1], `${topic}/${group}/${id}: bilingue.`);
// the activity scenes: each family has its own words for the three approaches
let familyCount = 0;
for (const [kind, spec] of Object.entries(lines.ACTIVITY_SCENES)) {
  const sets = new Set();
  for (const family of spec.families) {
    const labels = approaches.APPROACH_LABELS[kind]?.[family.id];
    assert.ok(labels && labels.length === 3 && labels.every(pair => pair[0] && pair[1]), `${kind}/${family.id}: tre parole proprie, bilingui.`);
    sets.add(labels.map(pair => pair[0]).join('|'));
    familyCount++;
    const scene = scenes.createActivityScene({ id: `a-${kind}-${family.id}`, seed: `scelte|${kind}`, sceneKey: kind, activityId: spec.activityIds[0], player, playerAvatar: null, prefer: family.id });
    scene.nodeId = 'q1';
    const node = scenes.activityNode(scene);
    assert.deepEqual(node.choices.slice(0, 3).map(item => item[0]), spec.approaches.map(item => item.id), `${kind}/${family.id}: stessi id e stessi effetti.`);
    assert.deepEqual(node.choices.slice(0, 3).map(item => item[1]), labels.map(pair => pair[0]), `${kind}/${family.id}: le parole della famiglia.`);
    assert.ok(node.choices.length >= 4 && node.choices.length <= 5, `${kind}/${family.id}: oltre ai tre approcci, una mossa della situazione.`);
  }
  assert.equal(sets.size, spec.families.length, `${kind}: ogni famiglia ha le sue scelte (non le stesse per tutte).`);
}
console.log(`  Scelte: ${topics.length} temi del dibattito × 15 scelte, ${familyCount} famiglie delle scene con tre approcci propri (stessi id ed effetti).`);

// ---------- 3. citizens and associations ----------
const mkAct = (activityId) => scenes.createActivityScene({ id: `x-${activityId}`, seed: 'x1', sceneKey: 'associazioni', activityId, player, playerAvatar: null, prefer: 'casa' });
const assoc = mkAct('associazioni'), citizens = mkAct('cittadini');
assert.equal(assoc.setting, 'sala'); assert.equal(citizens.setting, 'mercato', 'I cittadini si incontrano in piazza, non in sala civica.');
assert.notEqual(assoc.place.label, citizens.place.label);
assert.ok(room.ROOMS.includes('mercato') && room.ROOMS.includes('sala'), 'Due sfondi diversi.');
const nodeOf = (scene, id) => { scene.nodeId = id; return scenes.activityNode(scene); };
for (const id of ['apertura', 'q1', 'q2']) assert.notEqual(nodeOf(assoc, id).text, nodeOf(citizens, id).text, `${id}: parole diverse.`);
const svg = scene => { const node = nodeOf(scene, 'q1'); return art.renderStageSvg(scene, scenes.activityStage(scene, node), node, {}); };
const squareSvg = svg(citizens), hallSvg = svg(assoc);
assert.ok(squareSvg.includes('data-room="mercato"') && hallSvg.includes('data-room="sala"'), 'Il disegno è della sede giusta.');
assert.ok(squareSvg.includes('INCONTRO CON I CITTADINI') && !squareSvg.includes('COMITATI E ASSOCIAZIONI') && hallSvg.includes('COMITATI E ASSOCIAZIONI'), 'Striscioni diversi.');
assert.ok(!/<g transform="translate\(\d+,2(26|44)\)"><rect[^>]*width="30"/.test(squareSvg), 'In piazza non ci sono file di sedie.');
assert.notEqual(squareSvg.length, hallSvg.length);
const roles = scene => scene.cast.filter(item => item.role === 'ospite').map(item => item.roleLabel);
let different = 0;
for (let n = 0; n < 12; n++) { const a = scenes.createActivityScene({ id: `y${n}`, seed: `y${n}`, sceneKey: 'associazioni', activityId: 'associazioni', player, playerAvatar: null }), c = scenes.createActivityScene({ id: `y${n}`, seed: `y${n}`, sceneKey: 'associazioni', activityId: 'cittadini', player, playerAvatar: null }); if (roles(a).join() !== roles(c).join()) different++; }
assert.ok(different >= 10, 'Con i cittadini parlano persone comuni, con le associazioni presidenti e delegati.');
const ended = scene => { for (let guard = 0; guard < 30 && scene.status === 'active'; guard++) { const node = scenes.activityNode(scene); const pick = node.choices.find(item => item[0] === 'continua') ?? node.choices.find(item => !item[2]); scenes.activityChoose(scene, pick[0]); } return scene; };
assert.notEqual(ended(mkAct('associazioni')).outcome.flavor, ended(mkAct('cittadini')).outcome.flavor, 'Le chiusure sono diverse.');
console.log('  Cittadini e associazioni: piazza e mercato contro sala civica (sfondo, striscione, persone, dialoghi e chiusure).');

// ---------- 4. names on the lecterns ----------
const debate = mk('Giovanna Rossi-Ferrante De Angelis', 'Marco Valenti');
debate.setting = 'studio-televisivo';
const node = { speaker: 'conduttore', expression: 'serena' };
const studioSvg = art.renderStageSvg(debate, { poses: Object.fromEntries(debate.cast.map(item => [item.id, { x: 320, y: 300, facing: 1, posture: 'stand', scale: 1 }])), camera: 'wide', crowd: 'quiet' }, node, {});
assert.ok(/class="st-lectern-name"[^>]*>Anna Verdi</.test(studioSvg) || (studioSvg.match(/st-lectern-name/g) ?? []).length >= 2, 'Il nome del candidato è scritto sul leggio.');
for (const name of ['Anna Verdi', 'Giovanna Rossi-Ferrante', 'De Angelis']) assert.ok(studioSvg.includes(name), `«${name}» compare sui leggii (nome lungo su due righe, mai tagliato).`);
console.log('  Leggii: il nome di ogni candidato è sul pannello, anche se lungo.');
console.log('Identità e scelte delle scene verificate: genere esplicito e coerente, scelte per tema, cittadini diversi dalle associazioni, nomi sui leggii.');
