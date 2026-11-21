// The motion of the scenes in Chrome, three ways: full (setting «Complete», default), reduced/off (settings «Ridotte»/«Disattivate») and the system preference prefers-reduced-motion. The ambience of the room
// (crowd that nods, flash of the cameras) and the entrance of the lines move only in the first case; in the others nothing is animated and the scene is still complete. «Animazioni disattivate» seen in a picture is a setting,
// not a fault: the QA scripts that write it say so. QA_SHOT_DIR: one screenshot per way.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Movimento delle scene saltato: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, screenshot, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const motion = async value => { await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', language: 'it', weeklyReport: 'off', sceneMotion: ${JSON.stringify(value)} })); true`); };
  const start = async (activity) => {
    await S(`try { store.sceneAbandon(); } catch {} store.getState().game.week.ap = 6; try { await store.startActivityScene(${JSON.stringify(activity)}, {}); } catch (e) { return e.message; } return true;`);
    await wait(() => evaluate('Boolean(document.querySelector(".scene[data-scene-kind=attivita] .st-svg"))'), 15000); await pause(1200);
  };
  const probe = () => evaluate(`(() => { const live = [...document.querySelectorAll('.rm-live')]; const said = document.querySelector('.scene-said'); return { setting: document.documentElement.dataset.sceneMotion, live: live.length, running: live.filter(el => getComputedStyle(el).animationName !== 'none').length, entrance: said ? getComputedStyle(said).animationName : null, ambience: document.querySelector('[data-ambience]')?.dataset.ambience ?? null, actors: document.querySelectorAll('.st-actor').length }; })()`);
  const modes = [['full', false, 'movimento-attivo'], ['reduced', false, 'movimento-ridotto'], ['off', false, 'movimento-disattivato'], ['full', true, 'preferenza-sistema']];
  const results = [];
  for (const [value, system, name] of modes) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: system ? 'reduce' : 'no-preference' }] });
    await motion(value); await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu, .language-gate"))')); await openCareer({ evaluate, goto, waitFor: wait }).catch(() => {});
    await evaluate(`document.querySelectorAll('[data-report-close],[data-news-popup-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
    await start('intervista');
    // the ambience is there from the first moment; the entrance of the lines is seen after a first move (the line «Hai detto…»)
    const first = await probe();
    await evaluate(`document.querySelector('[data-scene-choice="continua"]')?.click(); true`); await pause(500);
    await evaluate(`document.querySelector('[data-scene-choice]:not([data-scene-choice="continua"])')?.click(); true`); await pause(900);
    const r = { ...await probe(), live: first.live, running: first.running, actors: first.actors, ambience: first.ambience }; results.push([name, r]);
    assert.ok(r.actors >= 4 && r.ambience === 'stampa', `${name}: la scena è completa (personaggi e ambiente della stampa).`);
    assert.ok(r.live >= 3, `${name}: gli elementi dell’ambiente ci sono (${r.live})`);
    if (value === 'full' && !system) assert.ok(r.running >= 3, `Movimento attivo: l’ambiente si muove davvero (${r.running}/${r.live}).`);
    else assert.equal(r.running, 0, `${name}: nessuna animazione dell’ambiente (${r.running}).`);
    if (process.env.QA_SHOT_DIR) await screenshot(`${process.env.QA_SHOT_DIR}/scena-${name}-intervista-1280.png`);
  }
  assert.equal(results[0][1].setting, 'full'); assert.equal(results[3][1].setting, 'full', 'La preferenza del sistema vince sull’impostazione «Complete» senza cambiarla.');
  // the entrance of the lines: animated with full motion, still otherwise
  assert.notEqual(results[0][1].entrance, 'none', 'Con il movimento attivo le battute entrano con un’animazione.'); assert.equal(results[3][1].entrance, 'none', 'Con la preferenza di sistema le battute non si animano.');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
});
console.log('check-scene-motion: ok');
