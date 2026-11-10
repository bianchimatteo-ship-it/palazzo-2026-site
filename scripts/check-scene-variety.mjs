// The variety and the identity of the scenes: every kind of activity scene has at least six families of topics and in each of them the two people in front of the player have the roles of that subject (not
// always the same two); the scenes mention what the career really holds (party, promise, territory, rival, headline) when it holds it and stay as they were when it does not; the party headquarters is the
// one of the party of the player (its name, its logo or its initials, its colour — an independent gets a plain sign and nothing is invented); every name strap has the name, the role and the party (or the
// body he speaks for) in three lines, whole, inside its own box, also for a scene saved before the fields existed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const lines = await import(`../src/data/activity-scene-lines.js${v}`);
const stakes = await import(`../src/data/activity-scene-stakes.js${v}`);
const guests = await import(`../src/data/activity-scene-guests.js${v}`);
const scenes = await import(`../src/core/activity-scenes.js${v}`);
const engine = await import(`../src/core/scene-engine.js${v}`);
const room = await import(`../src/ui/room-art.js${v}`);
const art = await import(`../src/ui/stage-art.js${v}`);

const KINDS = Object.keys(lines.ACTIVITY_SCENES);
assert.equal(KINDS.length, 6);
const player = { name: 'Anna Verdi', tag: 'Deputata · Rotta Civica' };
const refs = { party: 'Rotta Civica', promise: 'Più medici nei comuni scoperti', region: 'Toscana', rival: 'Il Fronte Popolare', news: 'Crisi al ministero' };
for (const kind of KINDS) {
  const spec = lines.ACTIVITY_SCENES[kind];
  assert.ok(spec.families.length >= 6, `${kind}: almeno sei famiglie tematiche (${spec.families.length}).`);
  const roleSets = new Set();
  for (const family of spec.families) {
    const pair = guests.GUESTS[kind]?.[family.id];
    assert.ok(pair && pair[0][0] && pair[1][0] && pair[0][1] && pair[1][1], `${kind}/${family.id}: due interlocutori con ruolo bilingue.`);
    roleSets.add(pair.map(role => role[0]).join('|'));
    const scene = scenes.createActivityScene({ id: `t-${kind}-${family.id}`, seed: `variety|${kind}|${family.id}`, sceneKey: kind, activityId: spec.activityIds[0], player, playerAvatar: null, prefer: family.id, party: { label: 'Rotta Civica' }, refs: {}, pool: ['Gruppo Uno', 'Gruppo Due'] });
    const people = scene.cast.filter(item => item.role === 'ospite');
    assert.deepEqual(people.map(item => item.roleLabel), pair.map(role => role[0]), `${kind}/${family.id}: i ruoli sono quelli del tema.`);
    assert.notEqual(people[0].name, people[1].name, `${kind}/${family.id}: due persone diverse.`);
    assert.ok(people.every(item => item.partyLabel || scene.bodyLabel), `${kind}/${family.id}: ognuno ha un partito o l’ente per cui parla.`);
  }
  assert.ok(roleSets.size >= 6, `${kind}: gli interlocutori cambiano da un tema all’altro (${roleSets.size} coppie diverse).`);
  // the party meeting: all of the party of the player; committee and council: the parties given
  const sample = scenes.createActivityScene({ id: `p-${kind}`, seed: `appartenenza|${kind}`, sceneKey: kind, activityId: spec.activityIds[0], player, playerAvatar: null, party: { label: 'Rotta Civica' }, refs: {}, pool: ['Gruppo Uno', 'Gruppo Due'] });
  const guestsOf = sample.cast.filter(item => item.role === 'ospite');
  if (kind === 'sede') assert.ok(guestsOf.every(item => item.partyLabel === 'Rotta Civica'), 'Alla riunione di partito tutti sono del partito del giocatore.');
  if (['commissione', 'consiglio'].includes(kind)) assert.ok(guestsOf.every(item => ['Gruppo Uno', 'Gruppo Due'].includes(item.partyLabel)), `${kind}: gli ospiti siedono per i partiti dati.`);
  // the references to the career: each kind can mention each datum, and without data it says nothing more
  const seen = new Set();
  for (let n = 0; n < 40; n++) {
    const scene = scenes.createActivityScene({ id: `r-${kind}-${n}`, seed: `riferimenti|${kind}|${n}`, sceneKey: kind, activityId: spec.activityIds[0], player, playerAvatar: null, party: { label: 'Rotta Civica' }, refs, pool: [] });
    const node = scenes.activityNode(scene);
    if (scene.ref) { seen.add(scene.ref.type); const value = refs[scene.ref.type]; assert.ok(node.lines?.[0]?.includes(value), `${kind}: la scena cita il dato vero (${scene.ref.type}).`); }
  }
  assert.ok(seen.size >= 4, `${kind}: la scena può citare almeno quattro dati diversi della carriera (${[...seen].join(', ')}).`);
  const bare = scenes.createActivityScene({ id: `b-${kind}`, seed: `senza|${kind}`, sceneKey: kind, activityId: spec.activityIds[0], player, playerAvatar: null, refs: {} });
  assert.ok(!bare.ref && !scenes.activityNode(bare).lines, `${kind}: senza dati la scena resta com’era.`);
  assert.equal(scenes.activityNode(sample).text, (spec.intro.default)[0], 'Il testo di apertura resta quello del catalogo (il dato vero è una riga a parte, tradotta a parte).');
}
// the texts of the families are not recycled between the kinds
const seenText = new Map();
for (const kind of KINDS) for (const family of lines.ACTIVITY_SCENES[kind].families) for (const text of [family.open[0], family.follow[0]]) { assert.ok(!seenText.has(text), `Frase riciclata tra ${kind} e ${seenText.get(text)}: ${text}`); seenText.set(text, kind); }

// «Incontra un gruppo di cittadini» is not the meeting with committees and associations: its own heading, banner and ordinary people
const mk = activity => scenes.createActivityScene({ id: `h-${activity}`, seed: `intestazione|${activity}`, sceneKey: 'associazioni', activityId: activity, player, playerAvatar: null, prefer: 'casa', refs: {} });
const assoc = mk('associazioni'), citizens = mk('cittadini');
assert.notEqual(assoc.heading.title, citizens.heading.title, 'I due incontri hanno un titolo diverso.');
assert.ok(/cittadini/i.test(citizens.heading.title) && /associazioni/i.test(assoc.heading.title));
assert.notDeepEqual(assoc.cast.filter(item => item.role === 'ospite').map(item => item.roleLabel), citizens.cast.filter(item => item.role === 'ospite').map(item => item.roleLabel), 'Con i cittadini siedono persone comuni, non i soliti comitati.');
const stage = scenes.activityStage(citizens, scenes.activityNode(citizens));
const roomSvg = room.ROOMS.includes('sala') ? await (async () => { const { renderStageSvg } = art; return renderStageSvg(citizens, stage, scenes.activityNode(citizens), {}); })() : '';
assert.ok(roomSvg.includes('INCONTRO CON I CITTADINI') && !roomSvg.includes('COMITATI E ASSOCIAZIONI'), 'Sul fondale c’è la scritta giusta.');
const roomAssoc = art.renderStageSvg(assoc, scenes.activityStage(assoc, scenes.activityNode(assoc)), scenes.activityNode(assoc), {});
assert.ok(roomAssoc.includes('COMITATI E ASSOCIAZIONI'), 'E per le associazioni resta la loro.');

// each subject has its own answer, good and poor, and the scene shows it as a line of its own after the generic reaction
const stakeTexts = new Set();
for (const kind of KINDS) for (const family of lines.ACTIVITY_SCENES[kind].families) {
  const pair = stakes.STAKES[kind]?.[family.id];
  assert.ok(pair && pair[0][0] && pair[1][0] && pair[0][1] && pair[1][1], `${kind}/${family.id}: una risposta buona e una scarsa, bilingui.`);
  for (const text of [pair[0][0], pair[1][0]]) { assert.ok(!stakeTexts.has(text), `Risposta riciclata: ${text}`); stakeTexts.add(text); }
}
const probe = scenes.createActivityScene({ id: 'st', seed: 'stake', sceneKey: 'commissione', activityId: 'audizione-commissione', player, playerAvatar: null, prefer: 'sanita', refs: {} });
let stakeSeen = 0;
for (const approach of lines.ACTIVITY_SCENES.commissione.approaches) {
  const copy = structuredClone(probe); copy.nodeId = 'q1'; scenes.activityChoose(copy, approach.id);
  const node = scenes.activityNode(copy);
  if (copy.history[0].band !== 'mid') { assert.equal(node.lines?.[0], stakes.STAKES.commissione.sanita[copy.history[0].band === 'good' ? 0 : 1][0], 'La reazione porta la risposta del tema.'); stakeSeen++; } else assert.ok(!node.lines, 'Una risposta mediocre non aggiunge nulla.');
}
assert.ok(stakeSeen >= 1, 'Almeno una delle tre risposte è buona o scarsa e porta la riga del tema.');

// ---------- the party headquarters ----------
const named = { kind: 'partito', name: 'Rotta Civica', mark: 'RTC', abbreviation: 'RTC', colors: { primary: '#264d82' }, accent: '#264d82', logo: null };
const svg = room.partyHeadquarters(named, { uid: 'x' });
assert.ok(/ROTTA CIVICA/.test(svg) && />RTC</.test(svg) && svg.includes('#264d82') && !svg.includes('<image'), 'Senza logo: nome, iniziali e colore del partito, nessun simbolo inventato.');
const withLogo = room.partyHeadquarters({ ...named, logo: 'data:image/png;base64,AAAA' }, { uid: 'y' });
assert.ok(withLogo.includes('<image') && withLogo.includes('data:image/png;base64,AAAA') && /ROTTA CIVICA/.test(withLogo), 'Con il logo: il logo vero è ben visibile accanto al nome.');
const independent = room.partyHeadquarters({ kind: 'indipendente', name: 'Indipendente' }, { uid: 'z' });
assert.ok(/SEDE DEL PARTITO/.test(independent) && !independent.includes('<image') && !/ROTTA/.test(independent), 'Un indipendente ha un’insegna neutra.');
const longName = room.partyHeadquarters({ ...named, name: 'Movimento Civico per la Difesa dei Territori e dell’Ambiente', mark: 'MCDTA' }, { uid: 'w' });
assert.ok((longName.match(/rm-party-name/g) ?? []).length <= 3, 'Un nome lungo va a capo su al massimo tre righe, dentro l’insegna.');

// ---------- the name straps ----------
const textsOf = group => [...group.matchAll(/class="st-strap-(name|role|party)"[^>]*>([^<]*)</g)].map(match => [match[1], match[2]]);
const member = { id: 'm1', name: 'Giulia Serra', roleLabel: 'Presidente della commissione Affari sociali', partyLabel: 'Partito Democratico - Italia Democratica e Progressista' };
const strapSvg = art.strap(member, 218, 204, 334, false);
const parts = textsOf(strapSvg);
assert.ok(['name', 'role', 'party'].every(kind => parts.some(item => item[0] === kind)), 'Il cartellino ha nome, ruolo e partito.');
assert.equal(parts.filter(item => item[0] === 'party').map(item => item[1]).join(' '), member.partyLabel, 'Il partito è scritto per intero (va a capo, non si taglia).');
assert.equal(parts.filter(item => item[0] === 'role').map(item => item[1]).join(' '), member.roleLabel);
const box = strapSvg.match(/<rect x="(\d+)" y="([\d.]+)" width="(\d+)" height="([\d.]+)"/);
const [bx, by, bw, bh] = box.slice(1).map(Number);
for (const match of strapSvg.matchAll(/<text class="st-strap-\w+" x="([\d.]+)" y="([\d.]+)"/g)) assert.ok(Number(match[1]) >= bx && Number(match[2]) <= by + bh && Number(match[2]) > by, 'Ogni riga sta dentro il riquadro.');
assert.ok(by >= 200 && by + bh <= 334, 'Il cartellino sta nel riquadro della scena.');
const old = art.strapLines({ name: 'Mario Rossi', tag: 'Deputato · Lega per Salvini Premier' });
assert.deepEqual([old.role, old.party], ['Deputato', 'Lega per Salvini Premier'], 'Una scena salvata prima dei nuovi campi ha lo stesso cartellino (dal vecchio «ruolo · partito»).');
const host = art.strapLines({ name: 'Paolo Conti', tag: 'Conduttore' }, 'Prima Serata Live');
assert.deepEqual([host.role, host.party], ['Conduttore', 'Prima Serata Live'], 'Chi non ha un partito mostra il programma per cui parla.');
console.log(`Varietà e identità delle scene verificate: ${KINDS.length} scene con almeno sei temi ciascuna, interlocutori che cambiano col tema, riferimenti veri alla carriera, sede del partito con nome/logo/colori e cartellini a tre righe.`);
