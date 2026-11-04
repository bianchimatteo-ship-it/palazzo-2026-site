// La direttiva del capogruppo nel browser (Chrome), per intero: chi non è capogruppo non la vede; chi lo è la vede sulla scheda della proposta, la emette (stato aggiornato e pulsante attivo), la direttiva è applicata
// quando la proposta arriva in Aula (adesioni e dissensi registrati e mostrati) e il voto del giocatore resta il suo.
import assert from 'node:assert/strict';
import { withBrowser, createCareerInPage, openCareer, chromeAvailable } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Direttiva del capogruppo nel browser saltata: Chrome non trovato (imposta CHROME_PATH).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, version }) => {
  await viewport(1280, 900, false);
  await createCareerInPage({ evaluate, version }, { level: 'deputato', weeks: 3, name: ['Anna', 'Bianchi'], region: 'Lombardia' });
  // a bill of another group is in committee or about to be voted (the weeks pass until one is)
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); for (let i = 0; i < 30; i++) { const s = store.getState(); if (s.parliament.laws.some(l => ['commission', 'amendments', 'final-vote'].includes(l.stage) && l.sponsor?.groupId !== s.parliament.player.groupId && l.currentChamber === s.parliament.player.chamber)) break; store.advance(7); } return true; })()`);
  await openCareer({ evaluate, goto, waitFor: wait }); await pause(1200);
  const showLaws = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(500); await evaluate(`location.hash = '#leggi'; true`); await pause(900); await evaluate(`document.querySelectorAll('details').forEach(d => d.setAttribute('open', '')); true`); await pause(400); };
  let id = null;
  const controls = () => evaluate(`({ count: document.querySelectorAll('[data-group-directive]').length, active: [...document.querySelectorAll('[data-group-directive].active')].filter(b => b.dataset.directiveTarget === ${JSON.stringify(id)}).map(b => b.dataset.groupDirective), result: document.querySelector('[data-directive-result]')?.textContent ?? '' })`);
  // 1. not the leader: no control
  await showLaws();
  assert.equal((await controls()).count, 0, 'Chi non è capogruppo non vede la direttiva.');
  // 2. the player becomes the leader of the group (the fact of the career the game already knows)
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const save = JSON.parse(store.exportSave()); save.game.flags = { ...save.game.flags, groupLeader: { groupId: save.parliament.player.groupId, since: save.clock.currentDate } }; store.loadGame(JSON.stringify(save)); return true; })()`);
  await pause(800);
  let state = null;
  for (let round = 0; round < 4 && !(state?.count >= 4); round++) {
    if (round) await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advance(7); return true; })()`);   // (no open bill of another group is listed yet: a week later there is)
    for (let attempt = 0; attempt < 4; attempt++) { await showLaws(); state = await controls(); if (state.count >= 4) break; }
  }
  assert.ok(state.count >= 4, `Il capogruppo vede le quattro scelte (${state.count}).`);
  id = await evaluate(`document.querySelector('[data-group-directive][data-directive-kind="law"]').dataset.directiveTarget`);
  state = await controls();
  assert.deepEqual(state.active, ['nessuna'], 'All’inizio: nessuna indicazione.');
  // 3. issue the directive from the interface
  await evaluate(`document.querySelector('[data-group-directive="contrario"][data-directive-kind="law"][data-directive-target="${id}"]').click(); true`); await pause(700);
  const stored = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return store.getState().parliament.directives ?? {}; })()`);
  assert.equal(stored[`law:${id}`]?.choice, 'contrario', 'La direttiva è registrata nello stato.');
  await showLaws(); state = await controls();
  assert.deepEqual([...new Set(state.active)], ['contrario'], 'L’interfaccia mostra la direttiva emessa.');
  // 4. the bill goes to the floor: the directive is applied, the player keeps the own vote
  const outcome = await evaluate(`(async () => {
    const { store } = await import('/src/core/store.js?v=${version}');
    store.castLawVote(${JSON.stringify(id)}, 'favorevole');
    for (let week = 0; week < 120 && !(store.getState().parliament.laws.find(l => l.id === ${JSON.stringify(id)})?.votes ?? []).some(v => v.byGroup?.some(r => r.groupId === store.getState().parliament.player.groupId)); week++) { const stage = store.getState().parliament.laws.find(l => l.id === ${JSON.stringify(id)})?.stage; if (stage === 'final-vote') { try { store.advanceLaw(${JSON.stringify(id)}, 'vote'); continue; } catch { /* waits for the week */ } } try { store.advance(7); } catch (error) { break; } }
    const law = store.getState().parliament.laws.find(l => l.id === ${JSON.stringify(id)});
    const gid = store.getState().parliament.player.groupId;
    const vote = (law?.votes ?? []).find(v => v.byGroup?.some(r => r.groupId === gid));
    const row = vote?.byGroup?.find(r => r.groupId === gid);
    const dbg = [JSON.stringify(Object.keys(store.getState().parliament.directives ?? {})), JSON.stringify((law?.votes ?? []).map(v => [v.chamber, (v.byGroup ?? []).length, v.byGroup?.find(r => r.groupId === gid)?.directive ?? null])), gid].join(" ");
    return { dbg, stage: law?.stage ?? null, voted: Boolean(vote), directive: row?.directive ?? null, playerChoice: vote?.playerChoice ?? null };
  })()`);
  assert.ok(outcome.voted, `La proposta arriva al voto (stato ${outcome.stage}).`);
  assert.ok(outcome.directive && outcome.directive.choice === 'contrario', `La direttiva è applicata nella votazione. ${outcome.dbg}`);
  assert.ok(outcome.directive.follow > 0 && outcome.directive.dissent > 0, `Adesioni (${outcome.directive.follow}) e dissensi (${outcome.directive.dissent}): il capogruppo non ha controllo assoluto.`);
  assert.equal(outcome.playerChoice, 'favorevole', 'Il giocatore conserva il proprio voto autonomo.');
  // 5. the screen of the bill says how many followed and how many did not
  await showLaws();
  const shown = await controls();
  // the bill may have left the open list (rejected, approved): the result is on its card wherever the laws are listed
  let detail = await evaluate(`({ text: document.body.innerText.includes('seguono la direttiva'), cards: document.querySelectorAll('.bill-actions').length, stage: null })`);
  for (const tab of await evaluate(`[...document.querySelectorAll('[data-section-tab]')].map(b => [b.dataset.sectionTab, b.dataset.sectionTabValue])`)) {
    if (detail.text) break;
    await evaluate(`(() => { const b = [...document.querySelectorAll('[data-section-tab]')].find(x => x.dataset.sectionTab === ${JSON.stringify(tab[0])} && x.dataset.sectionTabValue === ${JSON.stringify(tab[1])}); b?.click(); return true; })()`); await pause(500);
    await evaluate(`document.querySelectorAll('details').forEach(d => d.setAttribute('open', '')); true`);
    detail = await evaluate(`({ text: document.body.innerText.includes('seguono la direttiva'), cards: document.querySelectorAll('.bill-actions').length, stage: null })`);
  }
  assert.ok(/seguono la direttiva/.test(shown.result) || detail.text, `La scheda mostra quanti seguono la direttiva e quanti dissentono (${JSON.stringify(detail)}, stato ${outcome.stage}).`);
});
console.log('Direttiva del capogruppo nel browser: assente per chi non guida il gruppo, quattro scelte per il capogruppo, emissione e stato, applicazione in Aula con adesioni e dissensi, voto personale intatto.');
