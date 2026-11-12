// An encounter keeps its SUBJECT from the first word to the last (core/activity-scenes.js, data/activity-scene-topics.js), on the real engine:
//   1. every family of topics of every kind of encounter has its own moves for the second and the third moment (at least three, of different functions, with an English side);
//   2. what a moment offers is about the subject: the topic's own moves come first, the moves of the kind of encounter that fit any subject follow, a move bound to another subject is never offered,
//      and no move of another topic of the same kind leaks in (a school gym never meets the scaffolding, a waiting list never meets a late site);
//   3. what the career holds is quoted only when it is about the subject: a promise of the programme whose policy area is the family's, a headline that speaks of it, a commitment of the same topic left open;
//   4. each family keeps three to five different moves per moment, whatever the situation of the player.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { TOPIC_MOVES, TOPIC_KIND, ONLY, ALL_PAIRS, areasOf, newsFits } = await load('src/data/activity-scene-topics.js');
const { FUNCTIONS, MOVES } = await load('src/data/activity-scene-moves.js');
const { ACTIVITY_SCENES, createActivityScene, activityNode } = await load('src/core/activity-scenes.js');

const KEYS = [['cittadini', 'associazioni'], ['associazioni', 'associazioni'], ['cantiere', 'cantiere'], ['sede', 'sede'], ['commissione', 'commissione'], ['redazione', 'redazione'], ['consiglio', 'consiglio']];
const isPair = pair => Array.isArray(pair) && pair.length === 2 && pair[0] && pair[1];

// ---------- 1. every family has its moves ----------
let topics = 0, moves = 0;
for (const [kind, sceneKey] of KEYS) {
  const catalogue = TOPIC_MOVES[TOPIC_KIND[kind]];
  for (const family of ACTIVITY_SCENES[sceneKey].families) {
    const own = catalogue[family.id];
    assert.ok(own, `${kind}/${family.id}: ha le sue mosse`);
    for (const stage of ['q2', 'q3']) {
      assert.ok(own[stage]?.length >= 3, `${kind}/${family.id}/${stage}: almeno tre mosse del tema`);
      assert.equal(new Set(own[stage].map(move => move.fn)).size, own[stage].length, `${kind}/${family.id}/${stage}: funzioni diverse`);
      assert.equal(new Set(own[stage].map(move => move.label[0])).size, own[stage].length);
      for (const move of own[stage]) { assert.ok(FUNCTIONS[move.fn] && ['competence', 'charisma', 'reputation'].includes(move.stat) && isPair(move.label), `${kind}/${family.id}: mossa valida (${move.label?.[0]})`); moves++; }
    }
    topics++;
  }
}
for (const id of Object.keys(ONLY)) assert.ok(Object.values(MOVES).some(list => Object.values(list).flat().some(move => move.id === id)), `${id}: la restrizione riguarda una mossa reale`);
for (const [id, list] of Object.entries(ONLY)) for (const family of list) assert.ok(KEYS.some(([, sceneKey]) => ACTIVITY_SCENES[sceneKey].families.some(item => item.id === family)), `${id}: ${family} è un tema reale`);
for (const pair of ALL_PAIRS) assert.ok(isPair(pair));
assert.ok(topics >= 49, `49 temi (${topics})`);

// ---------- 2. what is offered is about the subject ----------
// the words that belong to ONE topic of a kind: another topic of the same kind never offers a move that holds them
const STEMS = {
  societa: { sanita: /sanit|poliambul|prenotaz|specialist|visite/i, trasporti: /corse|passegger|viaggia/i, scuola: /scuol|palestra|mensa|insegnant|genitor/i, casa: /alloggi|affitt|graduatoria|ente per la casa/i, sicurezza: /polizia|illumin|furti|prefettura/i, ambiente: /\brio\b|rifiut|differenziata|odore/i, lavoro: /sindacat|assunzion|cassa integrazione|occupaz/i },
  cantiere: { ritardi: /fornitore|sospension|diario dei lavori|cronoprogramma/i, sicurezza: /imbrac|ponteggi|quasi-incidenti|coordinatore della sicurezza/i, costi: /contabilit|computo|revisione prezzi|variante/i, viabilita: /negozianti|deviazion|incassi|traffico/i, materiali: /lotto|certificat|laborator/i, residenti: /rumor|polver|residenti/i, collaudo: /collaud/i },
  commissione: { sanita: /sanit|medici|salute/i, lavoro: /sindacat|salario|occupazione/i, ambiente: /idrogeologic|bonifica|ambientale/i, scuola: /scuol|istruzione|organici|insegnanti/i, giustizia: /magistrat|tribunal|processi|giudiziar|superiore/i, fisco: /aliquot|gettito|commercialisti/i, digitale: /informatic|digital/i },
  consiglio: { decreto: /decreto/i, manovra: /manovra|ragioneria|saldi|tetti di spesa/i, nomine: /nomin|curricula|incompatibilit/i, emergenza: /protezione civile|emergenza|commissario|zone colpite/i, europa: /europe|vertice/i, riforma: /riforma|impatto/i, opere: /cantieri e dei fondi|infrastrutture|opere|opera/i }
};
const flagSets = [{ funds: true, capital: true }, { funds: true, capital: true, govern: true, party: true, promise: true, prior: true }, { funds: false, capital: false, opp: true }, { funds: true, capital: true, govern: true }];
let checked = 0;
for (const [kind, sceneKey] of KEYS) {
  const catalogue = TOPIC_KIND[kind];
  for (const family of ACTIVITY_SCENES[sceneKey].families) {
    for (let seed = 0; seed < 6; seed++) {
      const situation = flagSets[seed % flagSets.length];
      const scene = createActivityScene({ id: `tp-${kind}-${family.id}-${seed}`, seed: `tp-${seed}`, sceneKey, activityId: kind === 'cittadini' ? 'cittadini' : ACTIVITY_SCENES[sceneKey].activityIds[0], prefer: family.id, player: { name: 'Anna Verdi', tag: 'D' }, playerAvatar: null, situation, refs: situation.promise ? { promise: 'Una promessa' } : {} });
      assert.equal(scene.familyId, family.id, 'la famiglia voluta è quella scelta');
      for (const stage of ['q2', 'q3']) {
        const choices = activityNode({ ...scene, nodeId: stage }).choices;
        assert.ok(choices.length >= 3 && choices.length <= 5, `${kind}/${family.id}/${stage}: da tre a cinque alternative (${choices.length})`);
        assert.equal(new Set(choices.map(choice => choice[1])).size, choices.length, `${kind}/${family.id}/${stage}: nessuna alternativa doppia`);
        assert.equal(new Set(choices.map(choice => choice[3])).size, choices.length, `${kind}/${family.id}/${stage}: funzioni tutte diverse`);
        const own = choices.filter(choice => choice[0].startsWith(`t-${kind}-${family.id}-${stage}-`));
        assert.ok(own.length >= (situation.govern && situation.funds ? 3 : 2) && own.length <= 4, `${kind}/${family.id}/${stage}: le mosse del tema sono la parte principale (${own.length} su ${choices.length})`);
        assert.ok(choices.slice(0, own.length).every(choice => own.includes(choice)), `${kind}/${family.id}/${stage}: le mosse del tema vengono prima`);
        for (const [id, label] of choices.map(choice => [choice[0], choice[1]])) {
          if (!id.startsWith('t-')) { assert.ok(!ONLY[id] || ONLY[id].includes(family.id), `${kind}/${family.id}: «${label}» è legata a un altro tema`); }
          else assert.ok(id.startsWith(`t-${kind}-${family.id}-`), `${id}: non è di un altro tema`);
          for (const [other, pattern] of Object.entries(STEMS[catalogue] ?? {})) if (other !== family.id) assert.ok(!pattern.test(label), `${kind}/${family.id}: «${label}» parla di ${other}`);
          checked++;
        }
      }
    }
  }
}
assert.ok(checked > 2000, `${checked} alternative controllate`);

// ---------- 3. what the career holds is quoted only when it is about the subject ----------
{
  const promises = [{ label: 'Più medici di base', area: 'sanita' }, { label: 'Nuove scuole e palestre', area: 'scuola' }];
  const make = (kind, family, extra = {}) => createActivityScene({ id: `pr-${kind}-${family}`, seed: `pr-${family}`, sceneKey: kind === 'cittadini' ? 'associazioni' : kind, activityId: kind === 'cittadini' ? 'cittadini' : ACTIVITY_SCENES[kind].activityIds[0], prefer: family, player: { name: 'Anna', tag: '' }, playerAvatar: null, promises, news: [], situation: { funds: true, capital: true }, ...extra });
  assert.equal(make('cittadini', 'sanita').flags.promise, true, 'sanità: la promessa sui medici è pertinente');
  assert.equal(make('cittadini', 'scuola').flags.promise, true, 'scuole: la promessa sulle palestre è pertinente');
  for (const family of ['trasporti', 'casa', 'sicurezza', 'ambiente', 'lavoro']) assert.equal(make('cittadini', family).flags.promise, false, `${family}: nessuna promessa estranea`);
  assert.ok(activityNode({ ...make('cittadini', 'trasporti'), nodeId: 'q1' }).choices.every(choice => choice[0] !== 'x-programma'), 'senza una promessa sul tema non si richiama il programma');
  assert.ok(activityNode({ ...make('cittadini', 'scuola'), nodeId: 'q1' }).choices.some(choice => choice[0] === 'x-programma'), 'con una promessa sul tema si può richiamare');
  assert.equal(make('commissione', 'sanita').flags.promise, true); assert.equal(make('commissione', 'fisco').flags.promise, false);
  assert.equal(make('redazione', 'promesse').flags.promise, true, 'in un’intervista sulle promesse vale qualunque promessa aperta');
  assert.equal(make('redazione', 'sondaggi').flags.promise, false);
  assert.equal(make('cantiere', 'ritardi').flags.promise, false, 'un cantiere non cita una promessa su sanità o scuola');
  // the promise quoted in the opening is the one of the subject
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) { const scene = make('cittadini', 'sanita', { seed: `q-${seed}` }); const ref = scene.ref?.type === 'promise' ? scene.ref.text : null; assert.ok(ref === null || ref.includes('Più medici di base'), `la promessa citata è quella del tema (${ref})`); }
  // headlines
  assert.ok(newsFits('scuola', 'Chiusa la palestra della scuola media') && !newsFits('scuola', 'Sciopero dei trasporti') && newsFits('trasporti', 'Sciopero dei trasporti'));
  const withNews = createActivityScene({ id: 'n1', seed: 'n', sceneKey: 'associazioni', activityId: 'cittadini', prefer: 'scuola', player: { name: 'A', tag: '' }, playerAvatar: null, news: ['Sciopero dei trasporti', 'Chiusa la palestra della scuola media'], promises: [], situation: {} });
  const noNews = createActivityScene({ id: 'n1', seed: 'n', sceneKey: 'associazioni', activityId: 'cittadini', prefer: 'casa', player: { name: 'A', tag: '' }, playerAvatar: null, news: ['Sciopero dei trasporti'], promises: [], situation: {} });
  assert.ok(!withNews.ref || withNews.ref.type !== 'news' || /palestra/.test(withNews.ref.text), 'la notizia citata riguarda il tema'); assert.ok(!noNews.ref || noNews.ref.type !== 'news', 'nessuna notizia estranea');
  // a commitment of the same topic left open comes back; one of another topic does not
  const prior = make('cittadini', 'scuola', { priorFamilies: ['scuola'] }), other = make('cittadini', 'casa', { priorFamilies: ['scuola'] });
  assert.equal(prior.flags.prior, true); assert.equal(other.flags.prior, false);
  assert.ok(activityNode({ ...prior, nodeId: 'q1' }).choices.some(choice => choice[0] === 'x-impegno') && !activityNode({ ...other, nodeId: 'q1' }).choices.some(choice => choice[0] === 'x-impegno'), 'rendere conto dell’ultimo impegno vale solo sullo stesso tema');
  // the areas of the topics
  assert.ok(areasOf('cittadini', 'sanita').includes('sanita') && areasOf('cantiere', 'ritardi').includes('infrastrutture') && areasOf('commissione', 'fisco').includes('fisco') && areasOf('sede', 'linea').length === 0);
}

// ---------- 4. the example of the brief: a school gym closed for two years ----------
{
  const scene = createActivityScene({ id: 'sc', seed: 'palestra', sceneKey: 'associazioni', activityId: 'cittadini', prefer: 'scuola', player: { name: 'Anna', tag: '' }, playerAvatar: null, situation: { funds: true, capital: true, govern: true } });
  const text = [...['q1', 'q2', 'q3'].flatMap(stage => activityNode({ ...scene, nodeId: stage }).choices.map(choice => choice[1])), activityNode({ ...scene, nodeId: 'q2' }).text].join(' | ');
  for (const word of [/edific/i, /palestra/i, /riapertura/i, /mensa/i, /(sopralluogo|perizia|lavori)/i, /(costi|fondo)/i, /responsabilit/i]) assert.match(text, word, `scuola: parla di ${word}`);
  assert.ok(!/(ponteggi|cantiere|liste d|corse|alloggi)/i.test(text), 'e non di argomenti estranei');
}
console.log(`Le scene tengono il tema dall’inizio alla fine: ${topics} temi di sette incontri con mosse proprie (${moves}), ${checked} alternative controllate (tre-cinque per momento, mai di un altro tema), promesse, notizie e impegni citati solo se pertinenti.`);
