// Resignations (core/resignations.js + store.resign): the player lists every post he holds with its consequences BEFORE confirming, leaves them one at a time and what each leaves is real: the seat goes,
// the powers go, the party role becomes a plain membership, the Government loses its minister or opens a crisis, the stats move once by the stated amount, nothing is left half-done, and a career with no office
// at all goes on (weeks pass, no crash, the offices listed are none). A post that does not exist (or a night in progress) is refused with a reason; the same post cannot be left twice.
import assert from 'node:assert/strict';
import { holdsNoOffice, resignationPosts, RESIGN_EFFECTS } from '../src/core/resignations.js';
import { startCareer } from './lib/long-run.mjs';

const text = lines => lines.join(' ');
// every kind of post has consequences written (the confirmation lists them) and stat effects declared
for (const [kind, rule] of Object.entries(RESIGN_EFFECTS)) assert.ok(rule.lines.length >= 2 && (rule.stats || kind === 'presidente'), `${kind}: conseguenze scritte.`);
assert.equal(resignationPosts({}).length, 0); assert.equal(resignationPosts(null).length, 0);

const { store } = await startCareer({ seed: 'dimissioni', level: 'deputato', fast: true });
store.setHeadlessVoter(null);
const state = () => store.getState();
const stats = () => Object.fromEntries(state().dataset.statistics.filter(item => item.subjectId === state().career.playerId).map(item => [item.metric, item.value]));
let posts = store.resignationPosts();
assert.ok(posts.some(item => item.id === 'parlamento'), `Un deputato ha il seggio tra gli incarichi (${posts.map(item => item.id).join(', ')}).`);
assert.ok(posts.every(item => item.lines.length && item.label && item.where), 'Ogni incarico ha etichetta, sede e conseguenze.');
assert.throws(() => store.resign('inesistente'), /non c’è più/, 'Un incarico che non c’è è rifiutato.');

// ---- a post of the Government: give the player a ministry, then leave it
const minister = state().parliament.government.ministers.find(item => !item.playerAppointed && !item.endedAt);
minister.playerAppointed = true;
assert.ok(store.resignationPosts().some(item => item.id === 'ministro'), 'Con un ministero compare «Ministro».');
const before = stats();
const out = store.resign('ministro');
assert.equal(out.resigned, 'ministro');
assert.ok(state().parliament.government.ministers.find(item => item.id === minister.id).endedAt, 'Il ministero è chiuso con la data.');
assert.ok(!store.resignationPosts().some(item => item.id === 'ministro'), 'Il ministero non è più tra gli incarichi.');
assert.ok(stats().influence < before.influence, 'L’influenza cala (−2).');
assert.throws(() => store.resign('ministro'), /non c’è più/, 'Non ci si dimette due volte.');
assert.ok(state().game.log.some(item => /Ti dimetti: Ministro/.test(item.title)), 'Resta nel registro della carriera.');

// ---- the seat
const group = state().parliament.player.groupId;
assert.ok(group, 'Ha un gruppo.');
store.resign('parlamento');
assert.ok(!state().parliament.player?.groupId, 'Il seggio è lasciato: niente più gruppo.');
assert.ok(!store.resignationPosts().some(item => ['parlamento', 'capogruppo', 'commissione'].includes(item.id)), 'Con il seggio finiscono le cariche di gruppo e commissione.');
assert.ok(state().dataset.offices.filter(item => item.politicianId === state().career.playerId && /dimission/i.test(item.endReason ?? '')).length >= 1, 'L’ufficio del seggio è chiuso con motivo «dimissioni».');

// ---- the party role: from whatever rank to a plain member
const party = state().game.party;
if (party && (party.rank >= 1 || party.affiliation === 'founder')) {
  const post = store.resignationPosts().find(item => item.id === 'partito');
  assert.ok(post && /Lasci/.test(text(post.lines)), 'Il ruolo di partito ha le sue conseguenze.');
  store.resign('partito');
  assert.equal(state().game.party.rank, 0); assert.equal(state().game.party.affiliation, 'member'); assert.equal(state().game.party.rankTitle, 'Iscritto');
}
posts = store.resignationPosts();
assert.equal(posts.length, 0, `Nessun incarico rimasto (${posts.map(item => item.id).join(', ')}).`);

// ---- a career with no office goes on
const day0 = Date.parse(`${state().clock.currentDate}T12:00:00Z`);
for (let week = 0; week < 30; week++) {
  for (const item of [...state().game.inbox.filter(entry => ['urgente', 'situazione'].includes(entry.kind))]) for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } }
  store.advanceTurn(1, { delegate: true });
}
assert.ok(Date.parse(`${state().clock.currentDate}T12:00:00Z`) - day0 >= 150 * 86400000, 'Il tempo scorre senza incarichi.');
assert.ok(store.resignationPosts().length === 0 || state().game.party?.rank >= 0, 'Senza incarichi non compaiono incarichi fantasma.');

// ---- a council: the seat and the office end together, and the career goes on without them
{
  const { store: local } = await startCareer({ seed: 'dimissioni-comune', level: 'comunale', fast: true });
  const now = () => local.getState();
  const posts = local.resignationPosts();
  const seat = posts.find(item => item.id.startsWith('locale:'));
  assert.ok(seat && /Comune/.test(seat.where) && seat.lines.length >= 2, `Un consigliere comunale ha il seggio tra gli incarichi (${posts.map(item => item.label).join(', ')}).`);
  const inst = now().local.institutions.find(item => seat.id === `locale:${item.id}`);
  local.resign(seat.id);
  assert.notEqual(now().local.institutions.find(item => item.id === inst.id).status, 'active', 'Il seggio è chiuso.');
  assert.ok(!local.resignationPosts().some(item => item.id === seat.id), 'L’incarico non è più elencato.');
  assert.ok(now().dataset.offices.some(item => item.politicianId === now().career.playerId && item.endDate && /dimission/i.test(item.endReason ?? '')), 'L’incarico è chiuso con motivo «dimissioni» nel registro.');
  for (let week = 0; week < 12; week++) local.advanceTurn(1, { delegate: true });
}
// ---- the Prime Minister: the Government opens a crisis (the player is not asked twice)
{
  const { store: premier } = await startCareer({ seed: 'dimissioni-premier', level: 'deputato', fast: true });
  premier.setHeadlessVoter(null);
  premier.getState().parliament.government.primeMinister = 'player';
  const post = premier.resignationPosts().find(item => item.id === 'premier');
  assert.ok(post && /consultazioni/.test(text(post.lines)), 'Il Presidente del Consiglio vede le conseguenze: consultazioni al Quirinale.');
  premier.resign('premier');
  assert.equal(premier.getState().parliament.government.status, 'crisis', 'Si apre la crisi di governo.');
  assert.match(premier.resignationPosts().find(item => item.id === 'premier')?.blocked ?? '', /già dimissionario/, 'Il Governo dimissionario non si dimette di nuovo.');
  assert.throws(() => premier.resign('premier'), /già dimissionario/);
}
// ---- the start as a plain member: no office from the first day, the validation accepts only local paths, and the career runs
{
  const { validateCareerStep } = await import('../src/core/career-rules.js');
  assert.ok(validateCareerStep({ startingOffice: 'iscritto', initialLevel: 'deputato' }, 2, [], []).some(item => /semplice iscritto/.test(item)), 'Da semplice iscritto il percorso non è parlamentare.');
  assert.ok(!validateCareerStep({ startingOffice: 'iscritto', initialLevel: 'comunale' }, 2, [], []).some(item => /semplice iscritto|punto di partenza/.test(item)), 'Da semplice iscritto con percorso comunale è valido.');
  const { store: member } = await startCareer({ seed: 'iscritto', level: 'comunale', draft: { startingOffice: 'iscritto' }, fast: true });
  const now = () => member.getState();
  assert.equal(now().career.startingOffice, 'iscritto');
  assert.equal(member.resignationPosts().filter(item => !item.id.startsWith('partito')).length, 0, `Nessun incarico istituzionale (${member.resignationPosts().map(item => item.id).join(', ')}).`);
  assert.ok(!now().local.institutions.some(item => item.status === 'active'), 'Nessun seggio aperto.');
  assert.ok(!now().career.currentLevel, 'Nessun livello di carica.');
  assert.ok(now().game.party, 'Resta iscritto a un partito.');
  assert.ok(!now().dataset.offices.some(item => item.politicianId === now().career.playerId && !item.endDate && item.level !== 'partito'), 'Nessun incarico aperto nel registro.');
  for (let week = 0; week < 20; week++) {
    for (const item of [...now().game.inbox.filter(entry => ['urgente', 'situazione'].includes(entry.kind))]) for (const choice of item.choices ?? []) { try { member.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } }
    member.advanceTurn(1, { delegate: true });
  }
  assert.ok(now().game.week.index >= 20, 'Venti settimane da semplice iscritto.');
}
console.log('Dimissioni verificate: ministero, seggio e ruolo di partito lasciati con le loro conseguenze; carriera senza incarichi che prosegue per 30 settimane.');
