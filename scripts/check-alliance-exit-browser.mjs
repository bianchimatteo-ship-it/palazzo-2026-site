// The page of the alliances in Chrome, with real clicks: «La mia coalizione» in Partiti, alleanze e flussi (one panel, read from world.alliances), the confirmation before leaving with its consequences,
// the outcome, the cancel that changes nothing, the control disabled with the reason for who is not the secretary, and the panel that stays when the party is missing from the last survey.
// (The engine and the store are in check-alliance-exit.mjs; this one is the interface the player uses.) Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Uscita dalle coalizioni nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }

await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const count = selector => evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);
  const inPage = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const W = await import('/src/core/world-engine.js?v=${version}'); ${body} })()`);
  const must = async (check, label) => { try { return await wait(check); } catch { throw new Error(`Tempo scaduto in attesa di: ${label}\n${await evaluate(`document.body.innerText.slice(0, 500)`).catch(() => '')}`); } };

  await goto('');
  await createCareerInPage({ evaluate, version }, { weeks: 3, name: ['Segretaria', 'Coalizione'] });
  // the player founds nothing here: the party of the career is given the role of secretary, and an accord of three (a coalition) with the nearest forces
  const setup = await inPage(`
    const s = store.getState();
    if (!s.world?.parties?.length) return { error: 'nessun mondo' };
    s.game.party.affiliation = 'founder'; s.game.party.rank = 5;
    const player = s.world.parties.find(item => item.isPlayer);
    const near = s.world.parties.filter(item => item.active && !item.isPlayer && W.isSurveyed(item)).sort((a, b) => Math.abs((a.axis ?? 0) - (player.axis ?? 0)) - Math.abs((b.axis ?? 0) - (player.axis ?? 0))).slice(0, 2);
    for (const alliance of s.world.alliances.filter(item => item.status === 'active')) { alliance.partyIds = alliance.partyIds.filter(id => id !== player.id && !near.some(party => party.id === id)); if (alliance.partyIds.length < 2 && alliance.partyIds.length !== 1) alliance.status = 'broken'; }
    s.world.alliances.push({ id: 'coalizione-prova', label: 'Coalizione guidata da ' + near[0].label, partyIds: [player.id, ...near.map(item => item.id)], leaderId: near[0].id, kind: 'coalizione', cohesion: 64, since: s.clock.currentDate, status: 'active', withPlayer: true, motive: 'prova', source: 'simulation' });
    store.loadGame(JSON.parse(store.exportSave()));
    return { player: player.id, names: near.map(item => item.label), id: 'coalizione-prova' };`);
  assert.ok(!setup.error, 'Il mondo politico c’è.');
  const openForces = async () => {
    if (!(await has('[data-nav="sondaggi"]'))) { await goto(''); await must(() => has('[data-menu="continua"]'), 'il menu con «Continua»'); await click('[data-menu="continua"]'); await must(() => has('.page-wrap'), 'la partita'); }
    await click('[data-nav="sondaggi"]'); await pause(400);
    await must(() => has('[data-obs-area="forze"]'), 'la pagina dei sondaggi');
    await click('[data-obs-area="forze"]'); await pause(300);
    await must(() => has('[data-my-coalition]'), 'il pannello «La mia coalizione»');
  };
  await openForces();

  // ---------- one panel, read from world.alliances ----------
  assert.equal(await count('[data-my-coalition]'), 1, 'Un solo pannello «La mia coalizione».');
  assert.match(await text('[data-my-coalition]'), /La mia coalizione/); assert.equal(await count('[data-coalition-kind="coalizione"]'), 1, 'È una «Coalizione politica».');
  assert.equal(await count('[data-my-coalition] [data-coalition-member]'), 3, 'Ci sono i tre membri.');
  assert.equal(await count('.force-card [data-coalition-member], .force-card [data-world-break]'), 0, 'Nessuna ripetizione sulle schede dei membri.');
  assert.equal(await count('[data-world-break]'), 1, 'Un solo comando di uscita.');
  assert.ok(await has('[data-my-coalition] [data-world-invite-selected]') && await has('[data-my-coalition] [data-invite-select]'), 'Nel pannello c’è anche l’invito.');
  assert.match(await text('[data-my-coalition]'), /Capofila/); assert.match(await text('[data-my-coalition]'), /Coesione/);

  // ---------- the confirmation, with the consequences; «Annulla» changes nothing ----------
  await click('[data-world-break]');
  await must(() => has('[data-confirm="ok"]'), 'la conferma dell’uscita');
  const dialog = await evaluate(`document.body.innerText`);
  assert.match(dialog, /Uscire dalla coalizione\?/); assert.match(dialog, /Rapporti con/); assert.match(dialog, /restano insieme/); assert.match(dialog, /Sondaggi/);
  await click('[data-confirm="cancel"]'); await pause(300);
  assert.equal(await has('[data-confirm="ok"]'), false, 'La conferma si chiude.');
  assert.equal((await inPage(`return W.allianceOf(store.getState().world, store.getState().world.playerPartyId)?.id ?? null;`)), 'coalizione-prova', 'Annullando, l’accordo è com’era.');

  // ---------- leaving: confirm, outcome, the others stay together ----------
  await click('[data-world-break]');
  await must(() => has('[data-confirm="ok"]'), 'la conferma dell’uscita');
  await click('[data-confirm="ok"]');
  await must(() => has('[data-alliance-report="uscita"]'), 'l’esito dell’uscita');
  const after = await inPage(`const w = store.getState().world; const a = w.alliances.find(item => item.id === 'coalizione-prova'); return { mine: W.allianceOf(w, w.playerPartyId)?.id ?? null, status: a.status, members: a.partyIds, kind: a.kind, label: a.label, report: store.getState().ui.allianceReport?.kind };`);
  assert.equal(after.mine, null, 'Il partito del giocatore è uscito.'); assert.equal(after.status, 'active', 'Gli altri restano insieme.'); assert.equal(after.members.length, 2);
  assert.equal(after.report, 'uscita');
  assert.match(await text('[data-alliance-report="uscita"]'), /Sei uscito da/); assert.match(await text('[data-alliance-report="uscita"]'), /restano insieme/);
  assert.ok(await has('[data-my-coalition="none"]'), 'Il pannello diventa «Autonomo».'); assert.match(await text('[data-my-coalition]'), /Autonomo/);
  await click('[data-alliance-report-dismiss]'); await pause(200);
  assert.equal(await has('[data-alliance-report]'), false, 'L’esito si chiude.');

  // ---------- not the secretary: the control is there, disabled, with the reason ----------
  await inPage(`
    const s = store.getState(); const player = s.world.parties.find(item => item.isPlayer);
    const other = s.world.parties.filter(item => item.active && !item.isPlayer && W.isSurveyed(item) && !W.allianceOf(s.world, item.id))[0];
    s.world.alliances.push({ id: 'intesa-prova', label: 'Intesa ' + player.label + ' – ' + other.label, partyIds: [player.id, other.id], cohesion: 66, since: s.clock.currentDate, status: 'active', withPlayer: true, source: 'simulation' });
    s.game.party.affiliation = 'member'; s.game.party.rank = 1;
    store.loadGame(JSON.parse(store.exportSave())); return true;`);
  await openForces();
  assert.equal(await has('[data-world-break-disabled]'), true, 'Da non segretario il controllo c’è.');
  assert.equal(await evaluate(`document.querySelector('[data-world-break-disabled]').disabled`), true, 'Ed è disabilitato.');
  assert.match(await text('[data-leave-reason]'), /Solo il segretario del partito decide intese e coalizioni/, 'Con il motivo preciso.');
  assert.equal(await has('[data-world-break]'), false); assert.equal(await has('[data-world-invite-selected]'), false, 'E nemmeno gli inviti.');
  assert.match(await text('[data-my-coalition]'), /Intesa politica/, 'Un’intesa di due è «Intesa politica».');
  await evaluate(`document.querySelector('[data-world-break-disabled]').click(); true`); await pause(200);
  assert.equal(await has('[data-confirm="ok"]'), false, 'Il click sul controllo disabilitato non fa nulla.');

  // ---------- the party is missing from the last survey: the panel and the commands stay ----------
  await inPage(`
    const s = store.getState(); s.game.party.affiliation = 'founder'; s.game.party.rank = 5;
    const poll = s.world.polls.at(-1); poll.results = poll.results.filter(row => row.partyId !== s.world.playerPartyId);
    store.loadGame(JSON.parse(store.exportSave())); return true;`);
  await openForces();
  assert.equal(await count('[data-my-coalition]'), 1); assert.ok(await has('[data-world-break]'), 'Il pannello e l’uscita restano anche senza il partito nell’ultima rilevazione.');
  assert.match(await text('[data-my-coalition]'), /non nell’ultima rilevazione/);
  // …and the exit from the intesa of two ends it
  await click('[data-world-break]'); await must(() => has('[data-confirm="ok"]'), 'la conferma'); assert.match(await evaluate(`document.body.innerText`), /Rompere l’intesa\?/);
  await click('[data-confirm="ok"]'); await must(() => has('[data-alliance-report="uscita"]'), 'l’esito');
  assert.equal(await inPage(`const w = store.getState().world; return W.allianceOf(w, w.playerPartyId)?.id ?? null;`), null, 'L’intesa di due si è interrotta.');
  assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource/i.test(String(item))), [], 'Nessun errore nella pagina.');
}, { language: 'it' });
console.log('Uscita dalle coalizioni nel browser verificata con clic reali: un solo pannello «La mia coalizione» (membri, capofila, coesione, inviti, uscita), conferma con le conseguenze, annulla che non cambia nulla, uscita con esito e gli altri che restano insieme, controllo disabilitato con il motivo per chi non è segretario, pannello che resta senza il partito nei sondaggi, rottura dell’intesa di due.');
process.exit(0);
