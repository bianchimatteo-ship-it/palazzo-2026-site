// La risposta del segretario alla richiesta di consenso alle consultazioni, sul gioco vero: coalizione, sostegno esterno, rifiuto, rinvio («segui la direzione» non è un consenso); la decisione è registrata
// nella formazione del governo e nella storia nazionale, la scheda Nazionali la mostra, e tutto sopravvive al salvataggio e al ricaricamento.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { addSituationEvent } = await module('src/core/career-engine.js');
const { renderElectionsHub } = await module('src/ui/elections-hub.js');
const results = [];
for (const [choice, expect] of [['coalizione', { status: 'coalizione', included: true, external: false, excluded: false }], ['esterno', { status: 'esterno', included: true, external: true, excluded: false }], ['opposizione', { status: 'rifiutato', included: false, external: false, excluded: true }], ['valuta', { status: 'rinviato', included: false, external: false, excluded: false }]]) {
  const { store } = await startCareer({ seed: `consenso-${choice}`, level: 'deputato', fast: true });
  const save = JSON.parse(store.exportSave());
  const own = save.world?.playerPartyId;
  assert.ok(own, 'La carriera ha un partito nel mondo politico.');
  save.national = { ...(save.national ?? {}), formation: { phase: 'consultazioni', number: 20, resultId: 'x', votedAt: save.clock.currentDate, firstSitting: save.clock.currentDate, consultationsEnd: '2099-01-01', steps: [], consentRequests: [{ partyId: own, majority: 'Maggioranza di prova', leaderId: null, askedAt: save.clock.currentDate, status: 'pending' }] }, history: save.national?.history ?? [] };
  save.game = addSituationEvent(save.game, 'sostegno-nuovo-governo', { majority: 'Maggioranza di prova', leader: 'Un capo', holdUntil: '2099-01-01' });
  store.loadGame(JSON.stringify(save));
  const item = store.getState().game.inbox.find(entry => entry.templateId === 'sostegno-nuovo-governo');
  assert.ok(item, 'La richiesta è nell’agenda.');
  assert.deepEqual(item.choices.map(entry => entry.id), ['coalizione', 'esterno', 'opposizione', 'valuta'], 'Quattro risposte: coalizione, sostegno esterno, opposizione, rinvio.');
  assert.equal(item.defaultChoice, 'valuta', 'La risposta di default non è un consenso.');
  store.resolveAgendaItem(item.id, choice);
  let formation = store.getState().national.formation;
  assert.equal(formation.consentRequests[0].status, expect.status, `${choice}: stato della richiesta`);
  assert.equal(formation.consent[own].choice, { coalizione: 'coalizione', esterno: 'esterno', opposizione: 'rifiuto', valuta: 'rinviato' }[choice]);
  assert.equal((formation.included ?? []).includes(own), expect.included); assert.equal((formation.externalSupport ?? []).includes(own), expect.external); assert.equal((formation.excluded ?? []).includes(own), expect.excluded);
  assert.ok(!store.getState().game.inbox.some(entry => entry.templateId === 'sostegno-nuovo-governo'), 'La richiesta si chiude con la risposta.');
  const history = JSON.stringify(store.getState().national.history ?? []);
  assert.ok(/consultazioni|Alle consultazioni/.test(history), 'La decisione è nella storia nazionale.');
  // persistence
  const again = JSON.parse(store.exportSave()).national.formation;
  assert.deepEqual(again.consent, formation.consent); assert.deepEqual(again.externalSupport ?? [], formation.externalSupport ?? []);
  store.loadGame(store.exportSave());
  formation = store.getState().national.formation;
  assert.equal(formation.consentRequests[0].status, expect.status, `${choice}: dopo il ricaricamento`);
  results.push(choice);
}
console.log(`Consenso alle consultazioni sul gioco: ${results.join(', ')} registrati nella formazione e nella storia, risposta di default senza consenso, persistenti nei salvataggi.`);
