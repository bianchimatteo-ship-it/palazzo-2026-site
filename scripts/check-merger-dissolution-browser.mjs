// In Chrome, with real clicks: the «Sciogli fusione» action of the party page, its confirmation (what comes back ✓, what cannot be rebuilt ✗), cancelling (nothing changes), confirming (the partner is a
// party again, the dissolved merger in the history of the page); the offer of the video of 1.000 € (rewards page, funds of the activities, notice of the finance page) drawn by the same function in its
// states. Phone / tablet / desktop without horizontal scroll. Screenshots in docs/qa/screenshots/final.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.error('SKIPPED: Chrome non trovato.'); process.exit(process.env.REQUIRE_CHROME ? 1 : 0); }
const OUT = new URL('../docs/qa/screenshots/final/', import.meta.url).pathname; await mkdir(OUT, { recursive: true });
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, screenshot, errors, version }) => {
  await viewport(1280, 900, false);
  await createCareerInPage({ evaluate, version }, { level: 'deputato', weeks: 3, name: ['Anna', 'Bianchi'], region: 'Lombardia' });
  await openCareer({ evaluate, goto, waitFor: wait }); await pause(1200);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); true`);
  // the player leads the party and merges with a close force (the store's own action)
  // (a congress under way blocks the dissolution, with its reason on the page: the fixture starts outside one)
  const partner = await S(`const s = store.getState(); s.game.party.rank = 5; if (s.game.party.life) delete s.game.party.life.congress; Object.assign(s.game.resources, { funds: 500000, politicalCapital: 99 }); s.game.party.org.treasury.balance = 80000; const own = s.world.parties.find(p => p.isPlayer);
    const { mergeCandidates } = await import('/src/core/world-engine.js?v=${version}');
    for (const p of s.world.parties.filter(p => !p.isPlayer && p.active)) { if (Math.abs((p.axis ?? 0) - (own.axis ?? 0)) <= 1.6) s.world.ties[[own.id, p.id].sort().join('|')] = 70; }
    const near = mergeCandidates(s.world)[0]; if (!near) return null;
    store.mergeParty(near.id, {}); return { id: near.id, label: near.label.replace(/\\s*\\(.*\\)\\s*$/, '') };`);
  assert.ok(partner, 'C’è stata una fusione.');
  const open = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(400); await evaluate(`location.hash = '#partito'; true`); await pause(900); await evaluate(`(() => { const tab = [...document.querySelectorAll('[data-section-tab]')].find(b => b.dataset.sectionTabValue === 'vita'); tab?.click(); return true; })()`); await pause(700); await evaluate(`document.querySelectorAll('details').forEach(d => d.setAttribute('open', '')); true`); await pause(500); };
  await open();
  const button = `[data-pl-dissolve] [data-life-dissolve]`;
  assert.ok(await evaluate(`Boolean(document.querySelector('${button}'))`), 'Il pulsante «Sciogli fusione» è nella pagina del partito.');
  assert.match(await evaluate(`document.querySelector('[data-pl-dissolve]').innerText`), new RegExp(partner.label.split(' ')[0]), 'La fusione attiva è elencata con il partner.');
  for (const [w, h, mobile] of [[390, 844, true], [820, 1100, true], [1280, 900, false]]) {
    await viewport(w, h, mobile); await open();
    const m = await evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, over: [...document.querySelectorAll('[data-pl-dissolve] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).map(e => e.tagName + '.' + e.className).slice(0, 4) })`);
    assert.ok(m.doc <= m.vw + 1 && !m.over.length, `${w}px: nessuno scorrimento orizzontale (${m.doc}/${m.vw}) ${m.over.join(' | ')}.`);
    await evaluate(`document.querySelector('[data-pl-dissolve]').scrollIntoView(); true`); await pause(300); await screenshot(`${OUT}scioglimento-fusione-${w}.png`);
  }
  // the confirmation: what comes back and what does not; cancelling changes nothing
  await viewport(1280, 900, false); await open();
  await evaluate(`document.querySelector('${button}').click(); true`); await pause(900);
  const dialog = await evaluate(`document.querySelector('.confirm-dialog')?.innerText ?? ''`);
  assert.match(dialog, /Sciogliere la fusione con/); assert.match(dialog, /✓ .*Iscritti/s, 'La conferma dice quanti iscritti tornano.'); assert.match(dialog, /✗ .*Alleanze/s, 'E che cosa non torna.');
  await screenshot(`${OUT}scioglimento-fusione-conferma-1280.png`);
  await evaluate(`document.querySelector('[data-confirm="cancel"]').click(); true`); await pause(500);
  assert.equal(await S(`return store.getState().world.parties.find(p => p.id === ${JSON.stringify(partner.id)}).active;`), false, 'Annullando nulla cambia.');
  await viewport(390, 844, true); await open();
  await evaluate(`document.querySelector('${button}').click(); true`); await pause(900);
  const fits = await evaluate(`(() => { const d = document.querySelector('.confirm-dialog'); const r = d.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; })()`);
  assert.ok(fits, '390px: la conferma sta nello schermo.');
  await screenshot(`${OUT}scioglimento-fusione-conferma-390.png`);
  await evaluate(`document.querySelector('[data-confirm="ok"]').click(); true`); await pause(1500);
  const done = await S(`const s = store.getState(); const p = s.world.parties.find(x => x.id === ${JSON.stringify(partner.id)}); return { active: p.active, mergedInto: p.mergedInto ?? null, status: s.game.party.mergers?.at(-1)?.status, toast: s.ui.toast };`);
  assert.deepEqual([done.active, done.mergedInto, done.status], [true, null, 'sciolta'], 'Confermando, il partner torna autonomo e lo scioglimento è registrato.');
  await viewport(1280, 900, false); await open();
  assert.match(await evaluate(`document.querySelector('[data-dissolved-history]')?.textContent ?? ''`), /Fusioni sciolte \(1\)/, 'Lo storico delle fusioni sciolte è nella pagina.');
  assert.ok(!(await evaluate(`Boolean(document.querySelector('${button}'))`)), 'Nessun pulsante per una fusione già sciolta.');

  // ---- the offer of the video of 1.000 €: the same markup in its three places (a scripted placement, as on Android)
  await S(`Object.assign(store.getState().game.resources, { funds: 300 }); store.getState().game.finance.debt = 2000; return true;`);
  const offer = state => evaluate(`(async () => { const m = await import('/src/ui/funds-ad.js?v=${version}'); const plugin = { rewardedPlacement: async () => ({ canShow: true, amount: ${state === 'placement' ? 0.15 : 1000}, currency: ${state === 'placement' ? "'punti'" : "'Fondi personali'"} }), showAd: async () => ({ shown: false }) };
    const service = m.createFundsAds({ store: { getState: () => ({}) }, ads: { config: () => ({ rewarded: { enabled: true } }), native: { plugin, load: async () => true, used: () => {} } }, journal: { deviceId: () => 'x' } });
    await service.refresh(); return service.status().code; })()`);
  for (const state of ['ready', 'placement']) {
    assert.equal(await offer(state), state, `Stato «${state}» del video.`);
    for (const [w, h, mobile] of [[390, 844, true], [1280, 900, false]]) {
      await viewport(w, h, mobile);
      await evaluate(`location.hash = '#panoramica'; true`); await pause(300); await evaluate(`location.hash = '#ricompense'; true`); await pause(900);
      const card = await evaluate(`document.querySelector('[data-funds-offer="ricompense"]')?.closest('.reward-card')?.innerText ?? ''`);
      assert.match(card, /1\.000 € di fondi personali/); assert.match(card, /GUARDA IL VIDEO/i); assert.equal((card.match(/1\.000 € di fondi personali/g) ?? []).length, 1, "Il titolo della scheda non si ripete.");
      assert.match(card, state === 'ready' ? /Video disponibile/ : /Non ancora disponibile/, 'La scheda dice se il video è disponibile.');
      const wide = await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`); assert.ok(wide, `${w}px: nessuno scorrimento orizzontale (Ricompense).`);
      await evaluate(`document.querySelector('[data-funds-offer]').scrollIntoView({ block: 'center' }); true`); await pause(300); await screenshot(`${OUT}video-fondi-ricompense-${state}-${w}.png`);
    }
  }
  await offer('ready');
  await viewport(1280, 900, false);
  await evaluate(`location.hash = '#ricompense'; true`); await pause(300); await evaluate(`location.hash = '#finanze'; true`); await pause(900);
  assert.ok(await evaluate(`Boolean(document.querySelector('.finance-hero [data-funds-ad="avviso"]'))`), 'Finanze a rischio o in debito: l’offerta facoltativa è nell’avviso.');
  await evaluate(`document.querySelector('.finance-hero').scrollIntoView(); true`); await pause(300); await screenshot(`${OUT}video-fondi-avviso-finanze-1280.png`);
  await evaluate(`location.hash = '#panoramica'; true`); await pause(900);
  await evaluate(`document.querySelectorAll('details.hq-category').forEach(d => d.setAttribute('open', '')); true`); await pause(400);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-funds-offer="attivita"]'))`), 'Home → attività → Risorse: la sezione del video c’è.');
  await evaluate(`document.querySelector('[data-funds-offer="attivita"]').scrollIntoView({ block: 'center' }); true`); await pause(300); await screenshot(`${OUT}video-fondi-attivita-1280.png`);
  assert.deepEqual(errors.filter(e => !/api\//.test(String(e))), [], 'Nessun errore in pagina.');
});
console.log('Scioglimento della fusione verificato in Chrome (pulsante, conferma con ciò che torna e ciò che no, annulla, conferma, storico) e offerta del video da 1.000 € nei suoi stati e nei tre punti; tre larghezze; schermate in docs/qa/screenshots/final.');
