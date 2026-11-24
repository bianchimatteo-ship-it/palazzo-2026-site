// The decisions internal to a party (the congress, the leadership, the secretary, the currents) once the player is no longer in it. Before the fix the congress left pending in the agenda of a player
// who had left the party ran its default choice when the week closed and stopped «Avanza» with «Cannot read properties of null (reading 'life')» (career-engine handleSpecial, leadership-neutral).
// Checked on the real store with the real data:
//   1. a career in a party with a congress pending; the player leaves the party: the congress is archived with its reason, not run;
//   2. the independent career goes on for eight weeks with no error, no party decision comes back, the save is exported, loaded again and goes on;
//   3. an old save (game.party === null with a congress and a secretary decision still in the agenda, without the party stamp) is loaded: they are archived, the rest of the agenda stays, the weeks go on;
//   4. the engine alone (advanceWeek on a state never normalised, as the old saves reached it): no exception, the decision lapses;
//   5. a player who changes party: the congress of the old party (its currents) does not run in the new one.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const engine = await import(new URL(`../src/core/career-engine.js?v=${build}`, import.meta.url).href);
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
const PARTY_TEMPLATES = ['congresso', 'congresso-segretario'];
const congressItem = (game, { stamp = true } = {}) => {
  const [a, b] = [...game.party.currents].sort((x, y) => y.strength - x.strength);
  return { id: `agenda-${game.week.index}-congresso-prova`, kind: 'evento', templateId: 'congresso', title: `Congresso: ${a.label} contro ${b.label}`, body: 'Prova', week: game.week.index, source: 'simulazione',
    params: { currentA: a.label, currentB: b.label, currentAId: a.id, currentBId: b.id, party: game.party.label },
    choices: [{ id: 'a', label: `Sostieni ${a.label}` }, { id: 'b', label: `Sostieni ${b.label}` }, { id: 'neutrale', label: 'Resta neutrale' }], defaultChoice: 'neutrale', ...(stamp ? { partyId: game.party.partyId } : {}) };
};
const advance = (store, weeks, tag) => {
  for (let n = 0; n < weeks; n++) {
    try { store.advanceTurn(1); } catch (error) { problems.push(`${tag}: Avanza si ferma alla settimana ${n + 1} (${error.message})`); return false; }
    const game = store.getState().game;
    if (!game.party && game.inbox.some(item => PARTY_TEMPLATES.includes(item.templateId) || engine.isPartyInternal(item))) { problems.push(`${tag}: una decisione interna di partito torna in agenda da indipendente (${game.inbox.find(item => engine.isPartyInternal(item))?.title})`); return false; }
  }
  return true;
};

// 1–2. live: congress pending, the player leaves
{
  const { store } = await startCareer({ seed: 'congresso-uscita', level: 'comunale', fast: true });
  const saved = JSON.parse(store.exportSave());
  saved.game.inbox = [congressItem(saved.game), ...saved.game.inbox];
  store.loadGame(saved);
  check(store.getState().game.inbox.some(item => item.templateId === 'congresso'), 'Il congresso caricato con il partito resta in agenda finché si è iscritti.');
  const label = store.getState().game.party.label;
  store.leaveParty();
  const game = store.getState().game;
  check(game.party === null, 'Dopo l’uscita il giocatore è indipendente.');
  check(!game.inbox.some(item => item.templateId === 'congresso'), 'Il congresso del partito lasciato esce dall’agenda.');
  const archived = (game.archivedEvents ?? []).find(item => item.templateId === 'congresso');
  check(Boolean(archived) && /lasciato/i.test(archived.reason) && archived.reason.includes(label), `Il congresso è archiviato con la motivazione (${archived?.reason}).`);
  if (advance(store, 8, 'uscita')) {
    const reloaded = JSON.parse(store.exportSave());
    store.loadGame(reloaded);
    check(store.getState().game.party === null && (store.getState().game.archivedEvents ?? []).some(item => item.templateId === 'congresso'), 'Dopo il ricaricamento resta indipendente e l’archivio è conservato.');
    advance(store, 4, 'uscita, dopo il ricaricamento');
  }
}
// 3. old save: party null, a congress and a secretary decision without stamp, and an ordinary decision that must stay
{
  const { store } = await startCareer({ seed: 'congresso-vecchio', level: 'comunale', fast: true });
  const saved = JSON.parse(store.exportSave());
  const item = congressItem(saved.game, { stamp: false });
  const secretary = { id: 'agenda-vecchio-segretario', kind: 'situazione', templateId: 'congresso-segretario', title: 'Congresso: la segreteria è contestata', body: 'Prova', week: saved.game.week.index, params: { currentA: item.params.currentA, currentAId: item.params.currentAId }, choices: [], defaultChoice: 'lascia', source: 'simulazione' };
  const ordinary = saved.game.inbox.find(entry => !engine.isPartyInternal(entry));
  saved.game.inbox = [item, secretary, ...saved.game.inbox];
  saved.game.pastParties = [...(saved.game.pastParties ?? []), { partyId: saved.game.party.partyId, label: saved.game.party.label, reason: 'Uscita volontaria', leftAtWeek: saved.game.week.index }];
  saved.game.party = null;
  store.loadGame(saved);
  const game = store.getState().game;
  check(!game.inbox.some(entry => PARTY_TEMPLATES.includes(entry.templateId)), 'Vecchio salvataggio: congresso e segreteria escono dall’agenda.');
  check((game.archivedEvents ?? []).filter(entry => PARTY_TEMPLATES.includes(entry.templateId)).length === 2, 'Vecchio salvataggio: le due decisioni sono archiviate con la motivazione.');
  if (ordinary) check(game.inbox.some(entry => entry.id === ordinary.id), 'Vecchio salvataggio: le decisioni ordinarie restano in agenda.');
  advance(store, 6, 'vecchio salvataggio');
}
// 4. the engine alone, on a state that never went through the normalisation (how the error reached the week)
{
  const { store } = await startCareer({ seed: 'congresso-motore', level: 'comunale', fast: true });
  const s = store.getState();
  const game = JSON.parse(JSON.stringify(s.game));
  game.inbox = [congressItem(game, { stamp: false }), ...game.inbox];
  game.party = null;
  try {
    const out = engine.advanceWeek({ game, stats: { ...(s.dataset?.politicians?.find?.(() => false)?.stats ?? {}), influence: 30, notoriety: 20 }, parliament: s.parliament }, { currentDate: s.clock.currentDate, career: s.career });
    check(!out.ctx.game.inbox.some(entry => entry.templateId === 'congresso'), 'Motore: il congresso non resta in agenda.');
    check((out.ctx.game.archivedEvents ?? []).some(entry => entry.templateId === 'congresso'), 'Motore: il congresso è archiviato.');
  } catch (error) { problems.push(`Motore: la chiusura della settimana fallisce ancora (${error.message})`); }
  // resolving it by hand from an agenda that still shows it: archived, no error
  try {
    const out = engine.resolveInboxItem({ game: { ...game, inbox: [congressItem({ ...s.game }, { stamp: false })] }, stats: { influence: 30 }, parliament: s.parliament }, { currentDate: s.clock.currentDate }, `agenda-${s.game.week.index}-congresso-prova`, 'a');
    check(/archiviata/.test(out.report.lines.join(' ')), 'Una scelta su un congresso non più applicabile viene archiviata con un messaggio.');
  } catch (error) { problems.push(`Motore: la scelta su un congresso non più applicabile fallisce (${error.message})`); }
}
// 5. a change of party: the congress of the old party (stamped with its id) does not run in the new one
{
  const { store, db } = await startCareer({ seed: 'congresso-cambio', level: 'comunale', fast: true });
  const saved = JSON.parse(store.exportSave());
  const item = congressItem(saved.game);
  item.partyId = 'party-un-altro-partito';
  saved.game.inbox = [item, ...saved.game.inbox];
  store.loadGame(saved);
  const game = store.getState().game;
  check(!game.inbox.some(entry => entry.id === item.id), 'Cambio di partito: il congresso del partito precedente non resta in agenda.');
  advance(store, 3, 'cambio di partito');
  void db;
}
if (problems.length) { console.error(`Decisioni di partito dopo l’uscita — problemi:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Decisioni di partito dopo l’uscita verificate: il congresso pendente di un partito lasciato è archiviato con la motivazione (non eseguito), la carriera indipendente avanza 12 settimane anche dopo il ricaricamento, i vecchi salvataggi con partito nullo e congresso/segreteria pendenti si aprono e avanzano, il motore non solleva più l’errore «reading \'life\'», un congresso del partito precedente non entra nel nuovo.');
