// Progetto Civico Italia in the alliances page: allied with it, the programme table shows the positions its documents state (source, kind, confidence), the themes they do not state as estimates of the game,
// and the topics documented beyond the ten themes, in Italian and English; on a phone without horizontal scroll. QA_SHOT_DIR: screenshots.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Programma Progetto Civico Italia (pagina) saltato: Chrome non trovato.'); process.exit(0); }
const ID = 'party-progetto-civico-italia';
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, screenshot, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const setup = lang => evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: '${lang}', weeklyReport: 'off' })); true`);
  await setup('it');
  const allied = await S(`const s = store.getState(); s.game.party.affiliation = 'founder'; s.game.party.rank = 5;
    // the player's party takes positions fixed by the player's decisions (compromises) that are compatible with the documented programme: the alliance is then possible
    const me = store.getState().world.playerPartyId; store.getState().world.programPositions = { ...(store.getState().world.programPositions ?? {}), [me]: { immigrazione: -1, sicurezza: 0.5, economia: 0.5, sanita: -1.5, lavoro: -1, ambiente: -1.5, europa: -2.5, diritti: -1.5, istituzioni: 0, esteri: 0.5 } };
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) { store.getState().game.resources.politicalCapital = 80; store.getState().world.refusals = {}; store.getState().game.week.ap = 6; try { ok = Boolean(store.proposeAlliance(${JSON.stringify(ID)}).success); } catch { } }
    return { ok, party: Boolean(store.getState().world.parties.find(p => p.id === ${JSON.stringify(ID)})) };`);
  assert.ok(allied.party, 'Progetto Civico Italia è nel mondo di gioco.'); assert.ok(allied.ok, 'Il giocatore stringe l’alleanza con Progetto Civico Italia.');
  const open = async () => { await evaluate(`location.hash = '#sondaggi'; true`); await pause(1200); await evaluate(`(() => { const tab = [...document.querySelectorAll('[data-section-tab]')].find(el => /alleanze/i.test(el.textContent)); tab?.click(); return true; })()`); await pause(1500); };
  const expandAll = () => evaluate(`(() => { document.querySelectorAll('[data-news-popup-close],[data-report-close]').forEach(b => b.click()); document.querySelectorAll('.news-popup,[data-news-popup]').forEach(n => n.remove()); document.querySelectorAll('[data-my-coalition] details').forEach(d => { d.open = true; }); const t = document.querySelector('[data-coalition-program="${ID}"]'); t?.scrollIntoView({ block: 'start' }); return true; })()`);
  await open(); await expandAll(); await pause(400);
  const read = () => evaluate(`(() => { const box = document.querySelector('[data-coalition-program="${ID}"]'); return { rows: box ? box.querySelectorAll('tr[data-program-theme]').length : 0, text: box?.innerText ?? '', conf: [...(box?.querySelectorAll('[data-program-confidence]') ?? [])].length, areas: [...(box?.querySelectorAll('[data-program-area]') ?? [])].length, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
  let data = await read();
  assert.equal(data.rows, 10, 'dieci temi nel confronto');
  // since 24/11/2026: only the themes the party's own documents state have a position with the source; the others are told as estimates of the game
  assert.ok(data.conf >= 7, `fonte e confidenza sui temi documentati (${data.conf})`);
  assert.match(data.text, /programma in elaborazione/i, 'stato del programma: in elaborazione (Laboratori Civici)');
  assert.match(data.text, /Documenti del partito/);
  assert.equal(data.areas, 15, 'i temi trasversali sono elencati');
  assert.match(data.text, /Scuola, università e ricerca/); assert.match(data.text, /Turismo, borghi e aree interne/);
  const istituzioni = await evaluate(`document.querySelector('[data-coalition-program="${ID}"] tr[data-program-theme="istituzioni"]').innerText`);
  assert.ok(!/fonte:/.test(istituzioni) && /premierato|forma di governo|posizione non rilevata|stima simulata/i.test(istituzioni), `istituzioni: nessuna posizione attribuita sulla forma di governo (${istituzioni.replace(/\s+/g, ' ').slice(0, 160)})`);
  if (process.env.QA_SHOT_DIR) { await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }); await pause(500); await expandAll(); await pause(400); await screenshot(`${process.env.QA_SHOT_DIR}/progetto-civico-italia-programma-1280.png`); }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await pause(500); await expandAll(); await pause(300);
  data = await read(); assert.ok(!data.hscroll, 'nessuno scorrimento orizzontale su smartphone');
  if (process.env.QA_SHOT_DIR) await screenshot(`${process.env.QA_SHOT_DIR}/progetto-civico-italia-programma-it-390.png`);
  // English
  await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1000); await open(); await expandAll(); await pause(500);
  data = await read();
  assert.match(data.text, /programme being drafted/i, 'frase inglese');
  assert.match(data.text, /Documents of the party/);
  assert.match(data.text, /School, university and research/); assert.match(data.text, /Tourism, villages and inland areas/);
  assert.match(data.text, /source: party document \([^)]*\), confidence (high|medium|low)/);
  assert.ok(!/Documenti del partito|stima simulata|fonte:|confidenza/.test(data.text), 'nessuna frase italiana rimasta');
  if (process.env.QA_SHOT_DIR) await screenshot(`${process.env.QA_SHOT_DIR}/progetto-civico-italia-programma-en-390.png`);
  assert.deepEqual(errors.filter(e => !/favicon|net::ERR|Failed to load resource/.test(String(e))), [], 'nessun errore di pagina');
});
console.log('check-pci-program-ui: ok');
