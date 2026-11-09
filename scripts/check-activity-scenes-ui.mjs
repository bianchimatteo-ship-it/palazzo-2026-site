// The six optional scenes in the browser (Chrome): in Home → the weekly activities the activities that have a scene show three buttons — «Partecipa» (gold, the animated scene), «Simula» and «Non partecipare»;
// «Non partecipare» changes nothing; «Partecipa» opens the scene (the career frozen, nothing paid, the week not advanced), the scene survives a reload in the middle, ends and the plain activity is
// applied ONCE; «Simula» applies it with no scene; each room is drawn with three people with a full name and role; at 390 and 1440 px the stage is whole and nothing scrolls sideways.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Scene delle attività nel browser saltate: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(350); };
  const snap = () => S('const g = store.getState().game; return { week: g.week.index, funds: g.resources.funds, capital: g.resources.politicalCapital, scene: store.getState().scene?.kind ?? null, date: store.getState().clock.currentDate };');
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1200);
  await wait(() => evaluate('Boolean(document.querySelector("[data-scene-activity]"))'), 20000);

  // ---- the three buttons
  const buttons = await evaluate(`(() => { const row = document.querySelector('[data-scene-activity="associazioni"]').closest('.hq-activity'); const take = row.querySelector('[data-scene-activity]'), sim = row.querySelector('[data-quick-scene]'), skip = row.querySelector('[data-skip-activity]'); const bg = getComputedStyle(take).backgroundImage + getComputedStyle(take).backgroundColor; return { take: take.textContent.trim(), sim: sim.textContent.trim(), skip: skip?.textContent.trim(), upper: getComputedStyle(take).textTransform, gold: /22[0-9]|227|196|e3c777|rgb\\(2[0-4]\\d, 1\\d\\d/.test(bg) || bg.includes('227, 199, 119') }; })()`);
  assert.equal(buttons.take, 'Partecipa'); assert.equal(buttons.sim, 'Simula'); assert.equal(buttons.skip, 'Non partecipare');
  assert.equal(buttons.upper, 'uppercase', 'I pulsanti si leggono in maiuscolo.'); assert.ok(buttons.gold, 'PARTECIPA è dorato.');
  const ids = await evaluate(`[...document.querySelectorAll('[data-scene-activity]')].map(b => b.dataset.sceneActivity)`);
  for (const id of ['associazioni', 'cittadini', 'riunione', 'audizione-commissione', 'intervista']) assert.ok(ids.includes(id), `${id}: ha il pulsante Partecipa.`);

  // ---- «Non partecipare»: nothing changes
  const before = await snap();
  await click('[data-skip-activity="associazioni"]');
  assert.deepEqual(await snap(), before, 'Non partecipare non cambia nulla (né denaro, né capitale, né settimana, né scena).');

  // ---- «Partecipa»: the scene, nothing paid, a reload in the middle
  await click('[data-scene-activity="associazioni"]');
  await wait(() => evaluate('Boolean(document.querySelector(".scene[data-scene-kind=attivita] .st-svg"))'), 15000);
  assert.deepEqual(await snap(), { ...before, scene: 'attivita' }, 'Aprire la scena non costa nulla e non avanza la settimana.');
  assert.equal(await evaluate('document.querySelectorAll(".st-actor").length'), 3, 'Tre persone nella stanza.');
  assert.equal(await evaluate('Boolean(document.querySelector(".page-wrap, .sidebar, .mobile-tabbar"))'), false, 'La carriera è ferma dietro la scena.');
  const straps = await evaluate(`[...document.querySelectorAll('.st-straps .st-strap text')].map(t => t.textContent)`);
  assert.ok(straps.length >= 6 && straps.every(text => text.trim().length > 2) && !straps.some(text => /^(Partecipa|Simula|Non partecipare)$/i.test(text.trim())), 'Nome e ruolo di ognuno, mai il testo di un pulsante.');
  await click('[data-scene-choice="continua"]'); await click('[data-scene-choice]');
  const node = await evaluate('document.querySelector(".scene").dataset.sceneNode');
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await click('[data-menu=continua]');
  await wait(() => evaluate('Boolean(document.querySelector(".scene[data-scene-kind=attivita] .st-svg"))'), 25000);
  assert.equal(await evaluate('document.querySelector(".scene").dataset.sceneNode'), node, 'Dopo il ricaricamento la scena riprende dallo stesso momento.');
  assert.equal((await snap()).funds, before.funds, 'Ricaricare non costa nulla.');
  for (let i = 0; i < 8; i++) { const now = await evaluate('document.querySelector(".scene")?.dataset.sceneNode'); if (now === 'esito') break; await click('[data-scene-choice]'); }
  await click('[data-scene-choice="fine"]');
  await wait(() => evaluate('!document.querySelector(".scene")'), 15000);
  const done = await snap();
  assert.equal(done.scene, null); assert.equal(done.week, before.week, 'La settimana non è avanzata.'); assert.equal(done.date, before.date);
  assert.equal(before.funds - done.funds, 250, 'Il costo di «Rete con associazioni» è applicato una volta sola (250).');

  // ---- «Simula»: the same activity, no scene
  await evaluate(`location.hash = '#panoramica'; true`); await pause(900);
  await wait(() => evaluate('Boolean(document.querySelector("[data-scene-activity=\\"riunione\\"]"))'), 15000);
  const pre = await snap();
  await click('[data-scene-activity="riunione"] ~ [data-quick-scene]');
  const post = await snap();
  assert.equal(post.scene, null, 'Simula non apre nessuna scena.'); assert.equal(post.week, pre.week, 'Simula non fa avanzare la settimana.');

  // ---- every room on the stage, whole, at the widths of the phone and of the computer
  for (const [width, height, mobile] of [[1440, 900, false], [390, 844, true], [320, 640, true], [812, 375, true]]) {
    await viewport(width, height, mobile);
    for (const key of ['associazioni', 'cantiere', 'sede', 'commissione', 'redazione', 'consiglio']) {
      await S(`const mod = await import('/src/core/activity-scenes.js?v=${version}'); const { avatarOf } = await import('/src/core/avatar.js?v=${version}'); const player = store.getState().dataset.politicians.find(p => p.id === store.getState().career.playerId); const saved = JSON.parse(store.exportSave()); saved.scene = mod.createActivityScene({ id: 'x-${key}', seed: 'ui-${key}', sceneKey: '${key}', activityId: mod.ACTIVITY_SCENES['${key}'].activityIds[0], player: { name: player.displayName, tag: 'Deputato · Prova' }, playerAvatar: avatarOf(player), stats: {} }); store.loadGame(saved); return true;`);
      await wait(() => evaluate(`document.querySelector('.scene[data-scene-kind="attivita"] .st-room[data-room="${key === "associazioni" ? "sala" : key}"]') !== null`), 15000).catch(async () => { throw new Error(`${key} a ${width}px: la stanza non compare: ${await evaluate("JSON.stringify({ scene: document.querySelector('.scene')?.dataset.sceneKind, text: document.body.innerText.slice(0, 160), errors: 0 })")}`); });
      const box = await evaluate(`(() => { const r = document.querySelector('.scene-stage').getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, right: r.right, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`);
      assert.ok(box.left >= -1 && box.right <= width + 1 && box.h > 120, `${key} a ${width}px: il palco è intero (${JSON.stringify(box)}).`);
      assert.ok(box.scroll <= 1, `${key} a ${width}px: nessuno scorrimento laterale.`);
      assert.equal(await evaluate('document.querySelectorAll(".st-actor").length'), 3, `${key}: tre persone.`);
      assert.equal(await evaluate(`document.querySelectorAll('.scene-choice').length >= 1`), true);
      const heights = await evaluate(`[...document.querySelectorAll('.scene-choice, [data-scene-abandon], [data-stage-skip], [data-stage-pause]')].map(b => Math.round(b.getBoundingClientRect().height))`);
      assert.ok(heights.length >= 3 && heights.every(h => h >= (mobile ? 44 : 36)), `${key} a ${width}px: i pulsanti si toccano (altezze ${heights.join(', ')}).`);
      await S('store.sceneAbandon(); return true;'); await pause(200);
    }
  }
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
  console.log('Scene delle attività verificate nel browser: tre pulsanti (Partecipa dorato, Simula, Non partecipare), niente costi né settimana avanzata aprendo la scena, ripresa dopo il ricaricamento, costo applicato una volta, Simula senza scena, sei stanze a 1440 e 390 px.');
});
