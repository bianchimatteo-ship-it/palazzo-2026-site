// The television debate in the browser (Chrome): from the campaign page «Entra in studio», the studio with the three characters drawn from the avatar system (the player's face is the one chosen at
// the start of the career), the speaker animated (mouth), the camera changing shot, the choices that move the scene on, the career frozen (no time, no menu pages), the save in the middle, the end
// that gives the verdict back to the campaign; phones 320/390, tablet, computer; animations on/reduced/off; English with no Italian left.  SCENE_OUT=file writes the English leftovers.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';

if (!chromeAvailable) { console.log('Dibattito nel browser saltato: Chrome non trovato.'); process.exit(0); }
const detector = createIndependentDetector();
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'comunale', onboarding: true, extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.parties ?? []); { const saved = JSON.parse(store.exportSave()); saved.campaign.nomination = { ...saved.campaign.nomination, status: 'approved' }; store.loadGame(saved); }` });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(300); };
  await evaluate(`location.hash = '#elezioni'; true`); await pause(700);
  await click('[data-section-tab="elezioni"][data-section-tab-value="campagna"]');
  await wait(() => evaluate('Boolean(document.querySelector("[data-scene-start]"))'), 15000);
  const avatar = await S('const c = await import("/src/core/avatar.js?v=' + version + '"); const s = store.getState(); return Object.values(c.avatarOf(s.dataset.politicians.find(p => p.id === s.career.playerId))).join(".");');
  const dayBefore = await S('return store.getState().campaign.day;');
  await click('[data-scene-start]');
  await wait(() => evaluate('Boolean(document.querySelector(".scene .st-svg"))'), 15000);
  assert.equal(await evaluate('document.querySelectorAll(".st-actor").length'), 3, 'In studio ci sono tre personaggi.');
  assert.equal(await evaluate('document.querySelector(".st-actor.role-giocatore").dataset.avatar'), avatar, 'Il giocatore ha l’avatar scelto a inizio carriera.');
  assert.equal(await evaluate('Boolean(document.querySelector(".page-wrap, .sidebar, .mobile-tabbar"))'), false, 'La carriera non è disegnata dietro la scena.');
  assert.equal(await evaluate('document.querySelectorAll(".st-actor .av-mouth-open").length'), 3, 'Ogni personaggio ha la bocca che si apre (parti del volto separate).');
  const seenCameras = new Set(), speakers = new Set();
  const snapshot = () => evaluate(`(() => { const sp = document.querySelector('.st-actor.is-speaking'); return { node: document.querySelector('.scene').dataset.sceneNode, cam: document.querySelector('.st-cam').dataset.camera, speaker: sp?.dataset.actor ?? null, speakers: document.querySelectorAll('.st-actor.is-speaking').length, choices: [...document.querySelectorAll('[data-scene-choice]:not([disabled])')].map(b => b.dataset.sceneChoice), text: document.querySelector('.scene-dialogue p')?.textContent ?? '' }; })()`);
  const pick = (choices, prefer) => prefer.find(item => choices.includes(item)) ?? choices[0];
  const plan = { invito: ['accetta'], preparazione: ['dati'], ingresso: ['continua'], q1: ['dati'], r1: ['continua'], domanda: ['conti'], 'risposta-rivale': ['continua'], q2: ['programma', 'dati'], r2: ['continua'], attacco: ['fatti'], r3: ['continua'], chiusura: ['appello'], esito: ['fine'] };
  let steps = 0, midChecked = false;
  for (; steps < 20; steps++) {
    const now = await snapshot();
    seenCameras.add(now.cam); if (now.speaker) speakers.add(now.speaker);
    assert.equal(now.speakers, 1, `${now.node}: parla un solo personaggio alla volta.`);
    assert.ok(now.text.length > 10, `${now.node}: c’è una battuta.`);
    if (now.node === 'esito') break;
    if (now.node === 'q1' && !midChecked) {
      // reload in the middle: the same scene
      midChecked = true; const before = await S('return JSON.stringify(store.sceneView());');
      await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await click('[data-menu=continua]');
      await wait(() => evaluate('Boolean(document.querySelector(".scene .st-svg"))'), 20000);
      assert.equal(await S('return JSON.stringify(store.sceneView());'), before, 'Dopo il ricaricamento la scena è la stessa.');
      assert.equal(await S('try { store.advance(7); return "mosso"; } catch (error) { return /studio/.test(error.message) ? "fermo" : error.message; }'), 'fermo', 'Il tempo della carriera è fermo in studio.');
    }
    await click(`[data-scene-choice="${pick(now.choices, plan[now.node] ?? ['continua'])}"]`);
  }
  assert.ok(seenCameras.size >= 3, `L’inquadratura cambia (${[...seenCameras].join(', ')}).`);
  assert.ok(speakers.size >= 3, 'Parlano tutti e tre i personaggi.');
  assert.match(await evaluate('document.querySelector(".scene-result")?.innerText ?? ""'), /Prestazione/, 'La scena finale mostra la prestazione.');
  assert.equal(await evaluate('document.querySelector(".st-actor.role-giocatore").dataset.avatar'), avatar, 'A fine scena l’avatar del giocatore è sempre lo stesso.');
  await click('[data-scene-choice="fine"]');
  await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))'), 15000);
  assert.equal(await S('return store.sceneView();'), null, 'Finita la scena si torna alla carriera.');
  assert.equal(await S('return store.getState().campaign.day;'), dayBefore + 1, 'Il dibattito costa un giorno di campagna.');
  // second scene for the layout/motion/language checks
  await evaluate(`location.hash = '#elezioni'; true`); await pause(600);
  await click('[data-section-tab="elezioni"][data-section-tab-value="campagna"]');
  await wait(() => evaluate('Boolean(document.querySelector("[data-scene-start]"))'), 15000);
  await click('[data-scene-start]'); await wait(() => evaluate('Boolean(document.querySelector(".scene .st-svg"))'), 15000);
  await click('[data-scene-choice="accetta"]'); await click('[data-scene-choice="dati"]'); await click('[data-scene-choice="continua"]');
  for (const [name, w, h, mobile] of [['smartphone stretto', 320, 700, true], ['smartphone', 390, 800, true], ['tablet', 768, 1000, true], ['computer', 1440, 900, false]]) {
    await viewport(w, h, mobile); await pause(500);
    const m = await evaluate(`(() => { const d = document.documentElement; const stage = document.querySelector('.scene-stage').getBoundingClientRect(); const buttons = [...document.querySelectorAll('[data-scene-choice]:not([disabled])')].map(b => b.getBoundingClientRect()); return { over: d.scrollWidth - innerWidth, stageW: stage.width, vw: innerWidth, minH: Math.min(...buttons.map(r => r.height)), n: buttons.length }; })()`);
    assert.ok(m.over <= 1, `${name}: nessuno scorrimento orizzontale (${m.over}px).`);
    assert.ok(m.stageW <= m.vw + 1 && m.stageW > Math.min(280, m.vw * 0.8), `${name}: lo studio sta nello schermo (${Math.round(m.stageW)} su ${m.vw}).`);
    assert.ok(m.minH >= 44, `${name}: scelte toccabili (${Math.round(m.minH)}px).`);
  }
  await viewport(1280, 900, false);
  for (const [mode, moving] of [['full', true], ['reduced', false], ['off', false]]) {
    await evaluate(`document.documentElement.dataset.sceneMotion = ${JSON.stringify(mode)}; true`); await pause(150);
    const anim = await evaluate(`(() => { const o = document.querySelector('.st-actor.is-speaking .av-mouth-open'); return o ? getComputedStyle(o).animationName : 'nessuno'; })()`);
    if (moving) assert.equal(anim, 'st-talk', 'Con le animazioni complete la bocca si muove.'); else assert.ok(anim === 'none' || anim === 'nessuno', `Animazioni ${mode}: la bocca non si anima (${anim}).`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.st-actor.is-speaking .av-mouth-open')).opacity !== undefined`), true);
  }
  // English: the rest of the scene is walked in English and every screen is read
  await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(800);
  const allTexts = new Set();
  const collect = async () => { for (const text of await evaluate('[...document.querySelectorAll(".scene *")].filter(el => !el.children.length).map(el => (el.textContent || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim()).filter(Boolean)')) allTexts.add(text); };
  for (let i = 0; i < 16; i++) {
    await collect();
    const now = await snapshot();
    if (now.node === 'esito') break;
    await click(`[data-scene-choice="${pick(now.choices, plan[now.node] ?? ['continua'])}"]`);
  }
  const left = [...allTexts].filter(text => detector.reasonOf(text));
  if (process.env.SCENE_OUT) writeFileSync(process.env.SCENE_OUT, JSON.stringify(left, null, 1));
  assert.deepEqual(left, [], `Nessun italiano rimasto nella scena in inglese: ${left.join(' | ').slice(0, 600)}`);
  await S('store.sceneAbandon(); return true;');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
}, {});
console.log('Dibattito televisivo verificato in Chrome (320, 390, 768 e 1440 px): studio con tre personaggi (avatar del giocatore invariato), parola e inquadratura che cambiano, carriera ferma, ricaricamento a metà identico, verdetto nella campagna, animazioni complete/ridotte/spente, inglese completo.');
