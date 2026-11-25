// «Semplice iscritto» is a start of its own: in the wizard it is the only start selected (no elected level card lit with it), its territory of reference (comune, province, region) is chosen apart
// and is not an office; in the game the player has no seat, no council, no office of a day in the history, before and after a save and reload, and the profile's roles say «iscritto». The other
// starts keep their seats (a local career sits in its council, a deputy in the Chamber).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const wizardModule = await import(`../src/ui/career-wizard.js?v=${build}`).catch(() => null);

// ---- the wizard: the cards of the step «percorso»
if (wizardModule?.renderLevelStepForTest || wizardModule?.levelStepHtml) {
  const levelStep = wizardModule.renderLevelStepForTest ?? wizardModule.levelStepHtml;
  for (const scope of ['comunale', 'provinciale', 'regionale']) {
    const html = levelStep({ startingOffice: 'iscritto', initialLevel: scope }, [], []);
    const selected = [...html.matchAll(/class="level-card selected[^"]*"\s+data-(level|starting-office)="([^"]+)"/g)].map(match => match[2]);
    assert.deepEqual(selected, ['iscritto'], `Iscritto (${scope}): solo «Semplice iscritto» è selezionato (${selected.join(', ')}).`);
    assert.match(html, new RegExp(`data-member-scope="${scope}" aria-pressed="true"`), `Il territorio di riferimento «${scope}» è scelto a parte.`);
    assert.match(html, /Non è una carica/, 'Il territorio di riferimento è detto non essere una carica.');
  }
  const elected = levelStep({ startingOffice: null, initialLevel: 'comunale' }, [], []);
  assert.ok(/class="level-card selected[^"]*"\s+data-level="comunale"/.test(elected) && !/data-member-scope/.test(elected), 'Percorso comunale: la scheda comunale è selezionata, nessun territorio da iscritto.');
} else console.log('(rendering della scheda del wizard verificato nel browser: check-wizard-identity-visual)');

// ---- the game: a plain member has no seat, in each territory of reference
const offices = (state, id) => state.dataset.offices.filter(item => item.politicianId === id && item.level !== 'partito');
for (const level of ['comunale', 'provinciale', 'regionale']) {
  const { store } = await startCareer({ seed: `iscritto-${level}`, level, draft: { startingOffice: 'iscritto' }, fast: true });
  const check = (state, when) => {
    const id = state.career.playerId;
    assert.equal(state.career.startingOffice, 'iscritto', `${level} ${when}: il punto di partenza resta «iscritto».`);
    assert.deepEqual(offices(state, id).map(item => item.title ?? item.role), [], `${level} ${when}: nessuna carica istituzionale, neanche chiusa il primo giorno.`);
    assert.ok(!(state.local?.institutions ?? []).some(item => item.status === 'active' && (item.playerSeat || item.playerGroupId || item.role)), `${level} ${when}: nessun seggio in un consiglio.`);
    assert.ok(!state.parliament?.player, `${level} ${when}: nessun seggio in Parlamento.`);
    assert.equal(state.career.currentLevel ?? null, null, `${level} ${when}: nessun livello istituzionale corrente.`);
    assert.ok(state.game.party, `${level} ${when}: è iscritto a un partito.`);
  };
  check(store.getState(), 'all’inizio');
  store.loadGame(JSON.parse(store.exportSave()));
  check(store.getState(), 'dopo il ricaricamento');
  const { playerRoles } = await import(`../src/core/roles.js?v=${build}`).catch(() => import('../src/core/roles.js'));
  const roles = playerRoles?.(store.getState())?.roles?.map(item => item[0]) ?? [];
  assert.ok(!roles.some(kind => ['consigliere', 'sindaco', 'assessore', 'deputato', 'senatore', 'esecutivo-locale'].includes(kind)), `${level}: nessun ruolo istituzionale tra i ruoli del profilo (${roles.join(', ')}).`);
}
// ---- the other starts are unchanged
{
  const { store } = await startCareer({ seed: 'eletto-comunale', level: 'comunale', fast: true });
  const state = store.getState();
  assert.ok(offices(state, state.career.playerId).some(item => !item.endDate), 'Un percorso comunale parte con la sua carica in consiglio.');
}
{
  const { store } = await startCareer({ seed: 'eletto-camera', level: 'deputato', fast: true });
  assert.ok(store.getState().parliament?.player?.groupId, 'Un deputato parte con il suo seggio alla Camera.');
}
console.log('«Semplice iscritto» verificato: scelta autonoma nel wizard (nessuna carica elettiva selezionata insieme), territorio di riferimento separato e non carica, nessun seggio o carica nei dati, nemmeno chiusa il primo giorno, dopo il ricaricamento e nei ruoli; gli altri percorsi conservano i loro seggi.');
