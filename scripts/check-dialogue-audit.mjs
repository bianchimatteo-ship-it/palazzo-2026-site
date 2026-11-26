// Audit of ALL the dialogues of the activity scenes (every activity with a scene, every kind of room and every profile: citizens, rallies, committees, building sites, party meetings, interviews,
// press conferences, Council of Ministers, talks with other forces, Brussels, territories, social media, courses, fundraising, calls for funds), played to the end with every choice in turn:
//   1. pertinence: a question on a policy subject speaks of that subject, and the answers offered never speak of another one (the case of the rescue services, generalised);
//   2. people: the grammar of a role and the name and face of whoever holds it agree; a line said in the first person fits the gender of who says it («mio marito», «mia moglie»); no line of the room
//      names a person by a gendered role that may not be in the room («La direttrice sorride» with no editor present, «Il presidente annota» when the chair is a woman);
//   3. register: one line never mixes «tu» and «lei»;
//   4. what the player holds: a player with no party is never asked about «your party»; a talk with another force shows no badge of the player's party on its guests and offers no move of the
//      player's own branch (currents, statute, branches); a Council of Ministers never gives a minister a group the cabinet does not record;
//   5. sequences in ONE career (the real store, the memory of the scenes already played): the same question is not asked again in the next scenes of the same kind, the people met are not met again a few
//      weeks later, and the first guest does not stand the same way three scenes in a row.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const S = await load('src/core/activity-scenes.js');
const { genderOf, roleGender, M, F } = await load('src/core/avatar.js');
const { WEEKLY_ACTIVITIES } = await load('src/data/simulation/career-rules.js');
const problems = [];
const check = (ok, text) => { if (!ok && problems.length < 60) problems.push(text); };

// the words that belong to one subject only: a question or an answer of a family may speak of another subject only together with its own (a council flat with its waiting list is still housing)
const MARKERS = {
  sanita: /\b(visit[ae]|medic[oi]|ospedal|pronto soccorso|ambulanz|infermier|pediatr|guardia medica|ricover|ticket|consultorio|sanitari)/i,
  trasporti: /\b(autobus|treno|treni|corsa|corse|fermata|pendolar|abbonament|corriera|binari|mezzi pubblici)/i,
  scuola: /\b(scuol|alunn|insegnant|docent|classe|mensa|nido|palestra|maestr|liceo|studenti)/i,
  casa: /\b(affitt|sfratt|case popolari|alloggi|caparra|mutuo|bilocale|inquilin)/i,
  sicurezza: /\b(spacci|furt[oi]|rapin|svaligi|allarme|vigili|carabinier|polizia|ronda|telecamer|lampion|illuminazion|auto corrono|incident)/i,
  ambiente: /\b(rifiut|discaric|inquin|alberi|torrent|argin|esond|siccit|climatic|compostaggio|plastica|comunità energetica|ciclabil|differenziat)/i,
  lavoro: /\b(contratt|stipend|salari|turni|esuber|apprendist|artigian|botteg|fabbric|precari|part-time|disoccup|banco|mercato|negoz|supermercat|stagional)/i,
  fisco: /\b(tass[ae]|impost|fiscal|evasion|iva\b|catasto|detrazion|forfettari|commercialist|partite iva)/i,
  giustizia: /\b(process[oi]|tribunal|carcer|magistrat|sentenz|cancellier|giudic|mediazione civile)/i,
  digitale: /\b(digital|banda ultralarga|software|programmi diversi|informatic|intelligenza artificiale|internet)/i
};
const offTopic = (familyId, text) => MARKERS[familyId] && !MARKERS[familyId].test(text) ? Object.keys(MARKERS).find(other => other !== familyId && MARKERS[other].test(text)) ?? null : null;
const POLICY_KINDS = ['associazioni', 'commissione'];
// a gendered role named with its article: these must not be said by the room (the person may not be there, or may be of the other gender)
const ROLE_REF = /\b(il|la)\s+(presidente|direttore|direttrice|cronista|capocantiere|segretari[oa]|ministr[oa]|tesorier[ea]|caporedattor[ei]|giornalista|docente|relatore|relatrice)\b(?!\s+del\s+Consiglio dei ministri)/i;
const TU = /\b(ti|tuo|tua|tuoi|tue|hai|sei|convincici|ascoltali)\b/i, LEI = /\b(lei|le chiedo|risponde\?|la accusa|la ascolta|la legge|la vedono|parlarle)\b/i;
const firstPersonGender = text => /\bmio marito\b/i.test(text) ? F : /\bmia moglie\b/i.test(text) ? M : null;
const INTERNAL = /\b(correnti|corrente|statuto|sezion[ei]|tesseramento|segretari di sezione)\b/i;

const player = { name: 'Prova Verifica', tag: 'Deputato' };
const cabinet = [{ portfolio: 'Economia', groupId: 'g1', groupName: 'Gruppo Uno' }, { portfolio: 'Interno', groupId: null, groupName: null, technical: true }];
const ids = WEEKLY_ACTIVITIES.map(item => item.id).filter(id => S.activityHasScene(id));
assert.ok(ids.length >= 60, `tutte le attività con scena (${ids.length})`);
let scenes = 0, lines = 0;
const roomLines = new Set();
for (const activityId of ids) {
  const sceneKey = S.sceneKeyOf(activityId);
  for (let n = 0; n < 24; n++) {
    for (const hasParty of [true, false]) {
      const scene = S.createActivityScene({ id: `audit-${activityId}-${n}`, seed: `audit|${activityId}|${n}|${hasParty}`, sceneKey, activityId, player, playerAvatar: null, stats: { competence: 55, charisma: 55, reputation: 55 }, situation: { party: hasParty, funds: true, capital: true }, cabinet, party: hasParty ? { label: 'Partito di prova' } : null });
      scenes++;
      const guests = scene.cast.filter(item => item.role === 'ospite');
      // 2. the role, the name and the face of every person agree
      for (const person of [...guests, ...(scene.extras ?? [])]) {
        const grammar = roleGender(person.roleLabel), named = genderOf({ name: person.name });
        check(!grammar || !named || grammar === named, `${activityId}: «${person.roleLabel}» è ${grammar}, ma si chiama ${person.name}.`);
        check(!grammar || person.avatar?.face === grammar, `${activityId}: «${person.roleLabel}» ha il volto dell’altro genere.`);
        // a role the table does not know must be a word that serves both genders («Capogruppo», «Responsabile», «Giornalista»): a gendered word left out of the table would take a random gender
        if (!grammar) check(/^(Capogruppo|Capo|Esponente|Responsabile|Portavoce|Presidente|Dirigente|Referente|Collega|Docente|Rappresentante|Giornalista|Cronista|Corrispondente|Analista|Consulente|Progettista|Parlamentare|Direttore|Commercialista|Segretario|Medico|Titolare|Retroscenista|Editorialista|Caporedattore|Caposervizio|Ministro|Sottosegretario|Delegato|Tesoriere|Militante|Comandante|Ingegnere|Funzionario|Geologo|Ragioniere|Capocantiere)\b/.test(person.roleLabel) || person.role === 'comparsa', `${activityId}: «${person.roleLabel}» ha un genere grammaticale ma non è nella tabella dei ruoli.`);
      }
      // 4. the badges of the guests
      if (scene.profile === 'trattativa' || scene.profile === 'europa') check(guests.every(item => !item.partyLabel), `${activityId}: gli ospiti di un’altra forza non portano il simbolo del tuo partito.`);
      if (sceneKey === 'consiglio') for (const item of guests) check(!item.partyLabel || cabinet.some(m => m.groupName === item.partyLabel) || item.partyLabel === 'Tecnico indipendente', `${activityId}: ${item.roleLabel} con un gruppo non registrato (${item.partyLabel}).`);
      // walk the whole scene, every choice in turn
      let node = S.activityNode(scene);
      for (const line of node.lines ?? []) roomLines.add(line);
      for (let step = 0; step < 16 && node.id !== 'esito'; step++) {
        const said = [node.text, ...(node.preface ?? [])].filter(Boolean);
        const speaker = scene.cast.find(item => item.id === node.speaker);
        for (const text of said) {
          lines++;
          // the register of one voice: what is said between «» and the narration around it are checked apart (the narration speaks to the player with «tu», a citizen may say «lei»)
          for (const part of [text.replace(/«[^»]*»/g, ' '), ...(text.match(/«[^»]*»/g) ?? [])]) check(!(TU.test(part) && LEI.test(part)), `${activityId} · ${node.id}: «tu» e «lei» nella stessa voce: ${text}`);
          const own = firstPersonGender(text);
          if (own && speaker && node.text === text) check(speaker.gender === own, `${activityId} · ${node.id}: «${text}» detto da ${speaker.roleLabel} (${speaker.gender}).`);
          if (!hasParty) check(!/\b(tuo|suo) partito\b/i.test(text), `${activityId}: a chi non ha partito si chiede del «suo partito»: ${text}`);
        }
        if (['q1', 'q2', 'q3'].includes(node.id) && POLICY_KINDS.includes(sceneKey) && !scene.profile?.match?.(/trattativa|europa|social|corso|giunta|raccolta|bando/) && MARKERS[scene.familyId]) {
          if (node.id !== 'q3') { const other = offTopic(scene.familyId, node.text); check(!other, `${activityId} · ${scene.familyId}: la domanda parla di ${other}: ${node.text}`); }
          for (const choice of node.choices ?? []) { const other = offTopic(scene.familyId, choice[1]); check(!other, `${activityId} · ${scene.familyId}: la risposta «${choice[1]}» parla di ${other}.`); }
        }
        if (/^r\d$/.test(node.id) || node.id === 'q1' || node.id === 'q2') for (const text of node.preface ?? []) roomLines.add(text);
        if ((scene.profile === 'trattativa' || scene.profile === 'europa') && ['q2', 'q3'].includes(node.id)) for (const choice of node.choices ?? []) check(!INTERNAL.test(choice[1]), `${activityId}: mossa della sezione in una trattativa: ${choice[1]}`);
        const open = (node.choices ?? []).filter(choice => !choice[2]);
        if (!open.length) break;
        S.activityChoose(scene, open[(n + step) % open.length][0]); node = S.activityNode(scene);
      }
      if (node.preface) for (const text of node.preface) roomLines.add(text);
    }
  }
}
// 2. the room never names a gendered role of someone who may not be there
for (const text of roomLines) check(!ROLE_REF.test(text), `Frase della scena con un ruolo di genere fisso: ${text}`);

// 5. one career, the real store: scenes in a row
const run = await startCareer({ seed: 'audit-dialoghi', level: 'deputato', fast: true });
const { store } = run;
const memory = [];
const tryScene = async activityId => {
  try { await store.startActivityScene(activityId); } catch { return null; }
  const scene = store.getState().scene;
  if (!scene) return null;
  const q1 = S.activityNode({ ...structuredClone(scene), nodeId: 'q1' });
  const entry = { activityId, key: scene.sceneKey, q1: q1.text, names: scene.cast.filter(item => item.role !== 'giocatore').map(item => item.name), stance: scene.cast.find(item => item.role === 'ospite')?.stance };
  store.sceneSkip?.() ?? store.sceneAbandon();
  if (store.getState().scene) store.sceneAbandon();
  return entry;
};
const plan = ['intervista', 'riunione', 'audizione-commissione', 'associazioni', 'intervista', 'riunione', 'associazioni', 'intervista', 'audizione-commissione', 'riunione', 'associazioni', 'intervista', 'riunione', 'associazioni', 'intervista', 'audizione-commissione'];
for (const activityId of plan) {
  const entry = await tryScene(activityId);
  if (entry) memory.push(entry);
  store.advance(7);
}
assert.ok(memory.length >= 10, `una carriera vera gioca le scene in fila (${memory.length})`);
for (let i = 0; i < memory.length; i++) {
  const sameKind = memory.slice(0, i).filter(item => item.key === memory[i].key).slice(-2);
  check(!sameKind.some(item => item.q1 === memory[i].q1), `Carriera: la stessa domanda torna subito (${memory[i].activityId}): ${memory[i].q1}`);
  const before = memory.slice(Math.max(0, i - 6), i).flatMap(item => item.names);
  for (const name of memory[i].names) check(!before.includes(name), `Carriera: ${name} ritorna dopo poche settimane (${memory[i].activityId}).`);
  if (i >= 2) check(!(memory[i].stance === memory[i - 1].stance && memory[i].stance === memory[i - 2].stance), `Carriera: tre volte di fila «${memory[i].stance}».`);
}
if (problems.length) { console.error(`Audit dei dialoghi — problemi (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`Audit dei dialoghi verificato: ${ids.length} attività, ${scenes} scene giocate fino in fondo (con e senza partito), ${lines} battute, ${roomLines.size} frasi della stanza: domande e risposte sullo stesso argomento, ruoli, nomi e volti coerenti, nessun ruolo di genere fisso detto dalla stanza, nessuna frase tra «tu» e «lei», nessuna domanda sul partito a chi non ne ha, trattative senza simboli né mosse della propria sezione; in una carriera vera ${memory.length} scene in fila senza la stessa domanda, senza le stesse persone e senza tre atteggiamenti uguali di fila.`);
