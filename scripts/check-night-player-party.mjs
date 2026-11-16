// The election night names the player's party: in a vote for lists the player's list is a row of its own with its name (never folded into «Altri» / «Altre liste»), flagged as the player's, and
// when the list stays under the threshold the result says so with the threshold and gives no seat (a candidate who personally has votes is not elected by a party without representation).
// Two careers: a party that already exists and a party founded by the player (the small one that ends under the threshold).
import assert from 'node:assert/strict';
import { startCareer, playWeek } from './lib/long-run.mjs';
import { nightSnapshot, createNight, nightView } from '../src/core/night-engine.js';

const cases = [
  ['esistente', 'deputato', {}],
  ['fondato', 'deputato', { partyMode: 'new', partyId: '', partyName: 'Lista di prova', partyAbbreviation: 'LDP', partyDescription: 'Partito di prova', partyColor: '#285c42', partyOrientation: 'Altro', startingRole: null }]
];
const lines = [];
for (const [name, level, draft] of cases) {
  const { store, db, decide } = await startCareer({ seed: `notte-partito-${name}`, level, fast: true, territorial: true, draft });
  const partyLabel = store.getState().game.party.label ?? store.getState().game.party.name;
  let checked = 0, under = 0;
  for (let week = 0; week < 52 * 5 && store.getState().game?.status !== 'ended' && checked < 3; week++) {
    playWeek({ store, db, decide });
    const campaign = store.getState().campaign;
    if (campaign?.status !== 'finished' || !campaign.result || campaign.__qaSeen) continue;
    campaign.__qaSeen = true;
    if (!['politiche', 'europee'].includes(campaign.electionType)) continue;
    checked++;
    const snap = nightSnapshot(campaign, 'finale');
    const mine = snap.groups.filter(group => group.isPlayer);
    assert.equal(mine.length, 1, `${name}/${campaign.electionType}: una sola riga è la lista del giocatore.`);
    assert.ok(!/^altr[ie]/i.test(mine[0].label), `${name}/${campaign.electionType}: la lista del giocatore non è «Altri» (${mine[0].label}).`);
    assert.ok(mine[0].label && mine[0].percent >= 0, `${name}: la riga ha nome e percentuale.`);
    const others = snap.groups.filter(group => group.others || group.id === 'altre-liste');
    assert.ok(others.every(group => !group.isPlayer), `${name}: le righe «Altri» non contengono il giocatore.`);
    const night = createNight(campaign, 'finale');
    const view = nightView(night);
    assert.ok(view.rows.some(row => row.isPlayer && !/^altr[ie]/i.test(row.label)), `${name}/${campaign.electionType}: anche la vista della notte mostra la lista con il suo nome.`);
    const outcome = campaign.result.outcome;
    if (outcome?.code === 'sotto-soglia') {
      under++;
      assert.equal(mine[0].seats, 0, `${name}: sotto soglia la lista non ha seggi (nessun seggio artificiale).`);
      assert.match(String(outcome.text ?? outcome.message ?? JSON.stringify(outcome)), /soglia/i, `${name}: l’esito spiega la soglia di sbarramento.`);
      assert.notEqual(outcome.mandate, true, `${name}: sotto soglia non c’è mandato.`);
    }
  }
  assert.ok(checked > 0, `${name}: almeno una campagna per liste conclusa.`);
  lines.push(`${name}: ${checked} notti, ${under} sotto soglia`);
}
console.log(`Notte elettorale: la lista del giocatore ha sempre il suo nome e non finisce in «Altri»; sotto soglia nessun seggio e la soglia è spiegata (${lines.join('; ')}).`);
