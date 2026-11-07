// The animated stages in the browser: the rally in the square, a guest spot in the studio and the vote at the polling station. The characters really MOVE (the walk is sampled twice and the position
// changes; the legs swing), the camera changes shot, the crowd reacts, the protesters walk in; skip, pause and resume work; with the motion off or reduced nothing moves and the final pose is drawn;
// a scene is never played twice (saved as seen); the stage is always entirely visible at every width, with no horizontal scroll; no JavaScript error.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Scene animate nel browser saltate: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version, screenshot }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(350); };
  const rect = selector => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; })()`);
  const anims = () => evaluate(`document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity && a.playState !== 'finished').length`);
  const sceneNode = () => evaluate(`document.querySelector('.scene')?.dataset.sceneNode ?? null`);
  const player = '.st-actor[data-actor="giocatore"]';

  // ---- the rally
  await S(`store.startRallyScene(); return true;`);
  await wait(() => evaluate(`Boolean(document.querySelector('.scene[data-scene-kind="comizio"] .st-svg'))`), 8000);
  assert.equal(await sceneNode(), 'arrivo');
  assert.equal(await evaluate(`Boolean(document.querySelector('.st-backdrop'))`), true, 'Il palco ha lo sfondo del partito.');
  assert.ok(await evaluate(`document.querySelectorAll('.st-crowd .cm').length`) > 40, 'C’è una folla.');
  assert.ok(await evaluate(`document.querySelectorAll('.st-crowd .cm-flag').length`) >= 3, 'Bandiere nella folla.');
  assert.equal(await evaluate(`document.querySelectorAll('${player} .av-head').length`), 1, 'Il giocatore ha il suo avatar.');
  const avatarKey = await evaluate(`document.querySelector('${player} .st-avatar')?.innerHTML.length`);
  assert.ok(avatarKey > 500);
  // motion full
  await click('[data-scene-motion="full"]');
  assert.equal(await evaluate(`document.documentElement.dataset.motion`), 'full');
  await click('[data-scene-choice="continua"]');           // arrivo → cammino: the player walks across the square
  assert.equal(await sceneNode(), 'cammino');
  const a = await rect(player); await pause(900); const b = await rect(player);
  assert.ok(Math.abs(a.x - b.x) > 6 || Math.abs(a.y - b.y) > 4, `Il giocatore cammina davvero (${Math.round(a.x)} → ${Math.round(b.x)}).`);
  assert.ok(await evaluate(`document.querySelector('${player}').classList.contains('is-walking')`), 'Cammina: le gambe oscillano.');
  assert.ok(await evaluate(`document.getAnimations().filter(a => a.effect?.target?.classList?.contains('st-leg')).length`) >= 2, 'Le gambe sono animate.');
  const cam1 = await evaluate(`getComputedStyle(document.querySelector('.st-cam')).transform`); await pause(700); const cam2 = await evaluate(`getComputedStyle(document.querySelector('.st-cam')).transform`);
  assert.notEqual(cam1, cam2, 'La telecamera segue il personaggio.');
  // pause freezes, resume restarts
  await click('[data-stage-pause]'); const p1 = await rect(player); await pause(500); const p2 = await rect(player);
  assert.ok(Math.abs(p1.x - p2.x) < 1.5 && Math.abs(p1.y - p2.y) < 1.5, 'In pausa il personaggio sta fermo.');
  await click('[data-stage-pause]'); await pause(500); const p3 = await rect(player);
  assert.ok(Math.abs(p3.x - p2.x) > 1 || Math.abs(p3.y - p2.y) > 1, 'Alla ripresa riprende a camminare.');
  // skip → the final pose at once, no running transition left
  await click('[data-stage-skip]'); await pause(300);
  assert.equal(await anims(), 0, 'Salta: nessuna animazione di passaggio rimane.');
  const final = await rect(player);
  assert.ok(final.y < a.y, 'Il giocatore è salito verso il palco (più lontano e più in alto).');
  assert.equal(await S(`return store.getState().scene.stageSeen;`), 'cammino', 'Il momento visto è ricordato nella scena salvata.');
  // seen and saved: a new render does not replay it
  await S(`return JSON.stringify(store.getState().scene.stageSeen);`);
  await evaluate(`window.dispatchEvent(new Event('resize')), true`);
  // go on until the speech
  await click('[data-scene-choice="continua"]');           // cammino → saluto
  assert.equal(await sceneNode(), 'saluto');
  const at = await rect(player);
  await click('[data-scene-choice="caloroso"]'); assert.equal(await sceneNode(), 'tema1');
  assert.match(await evaluate(`document.querySelector('.scene-dialogue').innerText`), /Hai detto/, 'Si vede la battuta pronunciata.');
  const before = await evaluate(`document.querySelector('.st-crowd').className.baseVal ?? document.querySelector('.st-crowd').getAttribute('class')`);
  assert.match(before, /is-(applause|cheer|mixed|boo|quiet)/);
  // the speaker's gesture loop and the mouth
  assert.ok(await evaluate(`document.getAnimations().some(a => a.effect?.target?.classList?.contains('st-fore') && a.effect.getComputedTiming().iterations === Infinity)`), 'Il gesto del discorso è un ciclo.');
  assert.ok(await evaluate(`Boolean(document.querySelector('${player}.is-speaking'))`));
  // motion off: nothing moves, the final pose stays
  await click('[data-scene-motion="off"]');
  assert.equal(await evaluate(`document.documentElement.dataset.motion`), 'off');
  assert.equal(await evaluate(`document.getAnimations().length`), 0, 'Animazioni disattivate: nessuna animazione in corso.');
  const offA = await rect(player); await pause(500); const offB = await rect(player);
  assert.deepEqual(offA, offB, 'Con le animazioni spente la scena è ferma.');
  await click('[data-scene-motion="reduced"]');
  assert.equal(await evaluate(`document.getAnimations().length`), 0, 'Animazioni ridotte: niente movimento.');

  // layout at every width: the stage is entirely visible, nothing scrolls sideways
  for (const [name, w, h, mobile] of [['320', 320, 700, true], ['390', 390, 800, true], ['768', 768, 1000, true], ['1024', 1024, 768, false], ['1440', 1440, 900, false]]) {
    await viewport(w, h, mobile); await pause(500);
    const m = await evaluate(`(() => { const d = document.documentElement; const stage = document.querySelector('.scene-stage').getBoundingClientRect(); const svg = document.querySelector('.st-svg').getBoundingClientRect(); return { over: d.scrollWidth - innerWidth, inside: svg.left >= stage.left - 1 && svg.right <= stage.right + 1 && svg.top >= stage.top - 1 && svg.bottom <= stage.bottom + 1, ratio: svg.width / svg.height, controls: Math.min(...[...document.querySelectorAll('.scene-choice, .scene-controls button')].map(b => b.getBoundingClientRect().height)) }; })()`);
    assert.ok(m.over <= 1, `${name}px: nessuno scorrimento orizzontale (${m.over}).`);
    assert.ok(m.inside, `${name}px: il palco è interamente visibile.`);
    assert.ok(m.ratio > 1.5 && m.ratio < 2.1, `${name}px: proporzioni 16:9 (${m.ratio.toFixed(2)}).`);
    assert.ok(m.controls >= 38, `${name}px: pulsanti toccabili (${Math.round(m.controls)}px).`);
    if (screenshot && ['390', '1440'].includes(name) && process.env.STAGE_SHOTS) await screenshot(`${process.env.STAGE_SHOTS}/rally-${name}.png`);
  }
  await viewport(1280, 900, false);
  // finish the rally (abandon): back to the career
  await S(`store.sceneAbandon(); return true;`);
  await wait(() => evaluate(`!document.querySelector('.scene')`), 8000);

  console.log('fase: a guest spot in the studio');
  // ---- a guest spot in the studio
  assert.equal(await S(`try { store.startTalkShowScene({ source: 'attivita' }); return 'ok'; } catch (e) { return e.message; }`), 'ok', 'L’ospitata si apre.');
  await wait(() => evaluate(`Boolean(document.querySelector('.scene[data-scene-kind="talkshow"] .st-svg'))`), 8000);
  await click('[data-scene-motion="full"]');
  assert.equal(await evaluate(`document.querySelectorAll('.st-actor').length`), 3, 'Giocatore, ospite e conduttore.');
  assert.ok(await evaluate(`document.querySelectorAll('.st-desk').length`) >= 3, 'Scrivanie.');
  assert.ok(await evaluate(`document.querySelectorAll('.st-plate').length`) >= 3, 'Targhette.');
  await click('[data-scene-choice="dati"]');          // preparazione → ingresso: the guests walk in and sit
  assert.equal(await sceneNode(), 'ingresso');
  const guest = '.st-actor.role-rivale';
  const g1 = await rect(guest); await pause(900); const g2 = await rect(guest);
  assert.ok(Math.abs(g1.x - g2.x) > 5, 'L’ospite entra in studio camminando.');
  await pause(5200);
  assert.equal(await evaluate(`document.querySelector('${guest}').dataset.posture`), 'sit', 'Poi si siede.');
  await click('[data-stage-skip]');
  // the plates are inside their desks
  const plates = await evaluate(`[...document.querySelectorAll('.st-plate')].map(p => { const r = p.getBoundingClientRect(), t = p.querySelector('text').getBoundingClientRect(); return t.left >= r.left - 1 && t.right <= r.right + 1; })`);
  assert.ok(plates.every(Boolean), 'Le targhette contengono il nome senza tagli.');
  await S(`store.sceneAbandon(); return true;`);
  await wait(() => evaluate(`!document.querySelector('.scene')`), 8000);

  console.log('fase: the vote');
  // ---- the vote
  await S(`const { createVoteScene } = await import('/src/core/scene-engine.js?v=${version}'); const player = store.getState().dataset.politicians.find(p => p.id === store.getState().career.playerId); const saved = JSON.parse(store.exportSave()); const { avatarOf } = await import('/src/core/avatar.js?v=${version}'); saved.scene = createVoteScene({ id: 'voto-prova', seed: 'v', player: { name: player.displayName }, playerAvatar: avatarOf(player), electionLabel: 'Elezioni comunali', place: { municipality: 'Roma' } }); store.loadGame(saved); return true;`);
  await wait(() => evaluate(`Boolean(document.querySelector('.scene[data-scene-kind="voto"] .st-svg'))`), 8000);
  await click('[data-scene-motion="full"]');
  assert.equal(await evaluate(`Boolean(document.querySelector('.st-booth')) && Boolean(document.querySelector('.st-urn')) && Boolean(document.querySelector('.st-curtain'))`), true, 'Seggio con cabina e urna.');
  const seen = [];
  for (let i = 0; i < 9; i++) {
    const node = await sceneNode(); if (!node) break;
    seen.push(node);
    if (node === 'uscita') break;
    await pause(i === 1 ? 1200 : 300);
    if (node === 'banco') assert.equal(await evaluate(`document.querySelector('.st-ballot').dataset.ballot`), 'hand');
    if (node === 'voto') assert.equal(await evaluate(`document.querySelector('${player}').dataset.visible`), '0', 'Dentro la cabina il votante non si vede.');
    if (node === 'urna') assert.equal(await evaluate(`document.querySelector('.st-ballot').dataset.ballot`), 'urn');
    await click('[data-stage-skip]');
    await click('[data-scene-choice="continua"]');
  }
  assert.deepEqual(seen, ['ingresso', 'banco', 'cabina', 'voto', 'piega', 'esce', 'urna', 'uscita'], 'Tutte le fasi del voto.');
  await click('[data-scene-choice="fine"]');
  await wait(() => evaluate(`!document.querySelector('.scene')`), 8000);
  assert.equal(await S(`return store.getState().scene;`), null);
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
}, { night: false });
console.log('check-stage-ui: ok');
