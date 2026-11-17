// QA screenshots of the features of the session, taken in Chrome on the real pages (390×844 phone and 820×1180 tablet, device scale 2 where it is for people to read). One topic at a time, each in a
// browser of its own, so one that fails does not stop the others. Output: artifacts/qa/screenshots/after (or QA_SHOT_DIR). Usage: node scripts/qa-screenshots.mjs [topic ...]   (no topic: all).
import { mkdirSync } from 'node:fs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Schermate saltate: Chrome non trovato.'); process.exit(0); }
const dir = process.env.QA_SHOT_DIR ?? 'artifacts/qa/screenshots/after';
mkdirSync(dir, { recursive: true });
const SIZES = [[390, 844, 'it-390x844'], [820, 1180, 'it-820x1180']];
const wanted = process.argv.slice(2);
const results = [];

const kit = browser => {
  const { evaluate, waitFor: wait, pause, send, version } = browser;
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(350); };
  const size = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true }); await pause(500); };
  // `prep` runs after the size is set (the folds of a phone start closed and are opened by the player, so they are opened here, at the size of the picture)
  const shot = async (name, w, h, tag, prep = null) => { await size(w, h); await closePopups(); if (prep) { await prep(); await pause(300); } await browser.screenshot(`${dir}/${name}-${tag}.png`); };
  // The pop-ups of the game (weekly news, congress result, reports) are closed before a picture is taken: they are not what the picture is about.
  const closePopups = async () => {
    for (let n = 0; n < 5; n++) {
      const closed = await evaluate(`(() => { const targets = [...document.querySelectorAll('[data-report-close],[data-news-popup-close],[data-confirm="cancel"],[data-review-later],[data-review-close],.modal-close')]; const named = [...document.querySelectorAll('.modal button, .report button, [role="dialog"] button, .news-popup button, .review-card button')].filter(el => /^\\s*(Chiudi|Non ora|Più tardi)\\s*$/.test(el.textContent)); const all = [...new Set([...targets, ...named])]; all.forEach(el => el.click()); return all.length; })()`);
      await pause(250);
      if (!closed) break;
    }
  };
  const hash = async value => { await evaluate(`location.hash = ${JSON.stringify(value)}; true`); await pause(800); await closePopups(); };
  const tab = async (section, value) => { await click(`[data-section-tab="${section}"][data-section-tab-value="${value}"]`); await pause(500); };
  const scroll = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'start' }); true`); await pause(300); };
  return { S, has, click, size, shot, closePopups, hash, tab, scroll, wait, pause, evaluate };
};

const TOPICS = {
  // 20.5 the personal vote in the Chamber, by name
  voto: { level: 'deputato', voter: false, async run(k, b) {
    await k.S(`let i = 0; for (; i < 80 && !store.openVotes().some(v => v.scope === 'nazionale'); i++) store.advance(7); return i;`);
    await k.hash('#panoramica'); await k.wait(() => k.has('[data-floor-offer]'), 20000);
    await k.click('[data-floor-open][data-floor-mode="diretta"]'); await k.wait(() => k.has('[data-floor-ballot]'), 15000); await k.pause(1200);
    for (const [w, h, tag] of SIZES) await k.shot('votazione-nominativa', w, h, tag);
  } },
  // 20.6 and 20.7 the debate scene with the pros and cons and the appreciation bar
  scena: { level: 'comunale', extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.parties ?? []); { const saved = JSON.parse(store.exportSave()); saved.campaign.nomination = { ...saved.campaign.nomination, status: 'approved' }; store.loadGame(saved); }`, async run(k) {
    await k.hash('#elezioni'); await k.tab('elezioni', 'campagna'); await k.wait(() => k.has('[data-scene-start]'), 15000);
    await k.click('[data-scene-start]'); await k.wait(() => k.has('.scene .st-svg'), 15000);
    for (let step = 0; step < 8 && !(await k.has('[data-procon]')); step++) { await k.click('.scene-choice'); await k.pause(400); }
    await k.pause(900);
    await k.scroll('[data-procon]');
    for (const [w, h, tag] of SIZES) await k.shot('scena-pro-contro-barra', w, h, tag);
  } },

  // 20.1 and 20.2 the candidacy for the general election, and what a candidate who does not meet the requirements is told
  candidatura: { level: 'deputato', async run(k) {
    await k.S(`store.fastForwardToElection('politiche'); return true;`);
    await k.hash('#elezioni'); await k.tab('elezioni', 'candidatura'); await k.pause(900);
    for (const [w, h, tag] of SIZES) await k.shot('candidatura-politiche', w, h, tag);
  } },
  requisiti: { level: 'regionale', async run(k) {
    await k.S(`store.fastForwardToElection('politiche'); return true;`);
    await k.hash('#elezioni'); await k.pause(600);
    await k.evaluate(`[...document.querySelectorAll('button')].find(b => /Candidati ora/.test(b.textContent))?.click(); true`); await k.pause(1200);
    const found = await k.evaluate(`(() => { const nodes = [...document.querySelectorAll('.candidacy-reason, [data-candidacy-reason], .role-blocked, .campaign-block, .decision-block, em, small, p')].filter(el => /non puoi|Non puoi|incompatib|requisit|Serve |serve |lasceresti|dovresti lasciare/.test(el.textContent) && el.textContent.length < 300); nodes[0]?.scrollIntoView({ block: 'center' }); return nodes.map(el => el.textContent.trim().slice(0, 120)).slice(0, 3); })()`);
    console.log('requisiti: messaggi trovati =', JSON.stringify(found));
    if (!found.length) { console.log('requisiti: nessun messaggio di requisiti non soddisfatti con questa carriera: nessuna schermata scattata'); return; }
    for (const [w, h, tag] of SIZES) await k.shot('requisiti-non-soddisfatti', w, h, tag);
  } },
  // 20.12 a government crisis opened by the Prime Minister (the player)
  crisi: { level: 'deputato', async run(k) {
    await k.S(`store.getState().parliament.government.primeMinister = 'player'; try { store.resign('premier'); } catch (e) { return e.message; } return true;`);
    await k.hash('#governo'); await k.pause(900);
    const aim = () => k.evaluate(`(() => { const nodes = [...document.querySelectorAll('.page-wrap *')].filter(el => el.children.length < 6 && /Crisi di governo|Governo dimissionario|crisi aperta|Dimissionario/i.test(el.textContent) && el.textContent.length < 260 && el.offsetParent !== null); const target = nodes.find(el => /^(H\\d|SECTION|ARTICLE|DIV|P)$/.test(el.tagName)) ?? nodes[0]; target?.scrollIntoView({ block: 'center' }); return Boolean(target); })()`);
    const seen = await aim(); console.log('crisi: elemento della crisi trovato =', seen);
    for (const [w, h, tag] of SIZES) await k.shot('crisi-di-governo', w, h, tag, aim);
  } },
  // 20.x the «Vai» / «Apri la pagina» buttons of the guide and of the tutorial (before/after of the redesign)
  vai: { level: 'deputato', async run(k) {
    await k.click('[data-action=menu]'); await k.click('[data-menu=guida]');
    await k.wait(() => k.has('[data-guide-search]'), 10000);
    const open = () => k.evaluate(`(() => { const card = document.querySelector('[data-guide-topic="iniziative"]'); card?.querySelectorAll('details').forEach(d => { d.open = true; }); card?.scrollIntoView({ block: 'start' }); return true; })()`);
    for (const [w, h, tag] of SIZES) await k.shot('guida-pulsanti-vai', w, h, tag, open);
    await k.click('.tutorial-invite [data-tutorial=start]'); await k.pause(600);
    await k.evaluate(`location.hash = '#finanze'; true`); await k.pause(900);
    const expand = async () => { if (!await k.evaluate(`Boolean(document.querySelector('.tutorial-details') && document.querySelector('.tutorial-details').getBoundingClientRect().height > 0)`)) await k.click('[data-tutorial=toggle]'); await k.pause(500); };
    for (const [w, h, tag] of SIZES) await k.shot('tutorial-pulsante-vai', w, h, tag, expand);
  } },
  // 20.22 the main pages of the game with their buttons and the state of loading (phone and tablet)
  pagine: { level: 'deputato', async run(k) {
    for (const [hash, name] of [['#panoramica', 'home'], ['#elezioni', 'elezioni'], ['#sondaggi', 'sondaggi'], ['#istituzioni', 'istituzioni'], ['#territori', 'territori'], ['#informazione', 'informazione'], ['#profilo', 'profilo'], ['#impostazioni', 'impostazioni']]) {
      await k.hash(hash); await k.wait(() => k.evaluate(`!/^\\s*Carico la pagina/.test(document.querySelector('.page-wrap')?.innerText ?? 'Carico la pagina')`), 20000); await k.pause(500);
      for (const [w, h, tag] of SIZES) await k.shot(`pagina-${name}`, w, h, tag);
    }
  } },
  // 20.15 the formation of the Government and the consultations at the Quirinale after a vote
  formazione: { level: 'deputato', async run(k, b) {
    await k.evaluate(`(async () => {
      const { store } = await import('/src/core/store.js?v=${b.version}'); const L = await import('/src/core/legislature-engine.js?v=${b.version}');
      const geography = await (await fetch('/src/data/real/electoral-geography.json')).json(); store.setElectoralGeography(geography);
      const s = store.getState(); const date = s.clock.currentDate;
      const vote = L.runNationalVote({ geography, world: s.world, coalitions: [], date, noise: false });
      const compact = { ...L.compactResult(vote), id: 'politiche-' + date, date };
      s.national.lastPolitiche = compact; s.national.formation = L.startFormation(compact, { date, number: 20 });
      return true; })()`);
    for (let n = 0; n < 7; n++) await k.S(`store.advance(7); return store.getState().national.formation?.phase ?? null;`);
    await k.hash('#elezioni'); await k.tab('elezioni', 'nazionali'); await k.pause(900);
    const open = () => k.evaluate(`(() => { const d = [...document.querySelectorAll('details')].find(el => /FORMAZIONE DEL GOVERNO/.test(el.textContent.slice(0, 200))); if (d && !d.open) d.querySelector('summary').click(); (document.querySelector('[data-formation-consultations]') ?? d)?.scrollIntoView({ block: 'start' }); return true; })()`);
    for (const [w, h, tag] of SIZES) await k.shot('formazione-governo-consultazioni', w, h, tag, open);
  } }
};

for (const [id, topic] of Object.entries(TOPICS)) {
  if (wanted.length && !wanted.includes(id)) continue;
  try {
    await withBrowser(async browser => {
      await createCareerInPage(browser, { level: topic.level, onboarding: true, extra: topic.extra ?? '' });
      await openCareer(browser);
      await browser.evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', weeklyReport: 'off', language: 'it' })); true`);
      await topic.run(kit(browser), browser);
    }, topic.voter === false ? { voter: false } : {});
    results.push(`${id}: ok`);
  } catch (error) { results.push(`${id}: FALLITO (${String(error.message).slice(0, 120)})`); }
}
console.log(results.join('\n'));
