// The invitation of a force that already belongs to another accord, in Chrome: the choice between «Invita soltanto questo partito» and «Proponi la fusione delle intere alleanze», the preview of the
// engine (inviteImpact: who is involved, what stays, which agreements and registrations), the individual invitation that is NOT blocked by an incompatible partner left behind, the merge that is blocked with its
// reason, and the original accord that stays for whoever does not join. Italian and English; phone without horizontal scroll.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Invito individuale/fusione (pagina) saltato: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, screenshot, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-news-popup-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  // the player is the secretary with an alliance; two other forces form an accord of their own, one of them far from the player's coalition
  const setup = await S(`const s = store.getState(); s.game.party.affiliation = 'founder'; s.game.party.rank = 5; s.game.resources.politicalCapital = 80; s.game.week.ap = 6;
    const w = s.world; const others = w.parties.filter(p => !p.isPlayer && p.active && Number.isFinite(p.axis)).sort((a, b) => a.axis - b.axis);
    const me = w.parties.find(p => p.isPlayer); const near = others.filter(p => Math.abs(p.axis - me.axis) <= 1.5);
    const ally = near[0], invited = near[1], far = others.at(-1) === near[0] || others.at(-1) === near[1] ? others.at(-2) : others.at(-1);
    const extra = others.find(p => ![me.id, ally.id, invited.id, far.id].includes(p.id) && Math.abs(p.axis - far.axis) <= 1);
    w.alliances.push({ id: 'mio', label: 'La mia alleanza', partyIds: [me.id, ally.id], cohesion: 70, since: '2026-10-01', status: 'active', withPlayer: true, motive: 'prova', source: 'simulation', coalitions: [] });
    w.alliances.push({ id: 'altro', label: 'Accordo di prova', partyIds: [invited.id, far.id, extra.id], cohesion: 60, since: '2026-10-01', status: 'active', motive: 'prova', source: 'simulation', terms: [{ id: 'altro|collegi|1', kind: 'collegi', partyId: invited.id, text: 'Collegi', status: 'aperto' }], coalitions: [{ electionId: 'politiche-2022', type: 'politiche', label: 'politiche 2022', status: 'approvata', members: [invited.id, far.id, extra.id] }] });
    const impact = store.inviteImpact(invited.id);
    return { invited: invited.id, far: far.id, label: invited.label, impact: Boolean(impact), mergeBlock: impact?.mergeBlock ?? null, individualBlock: store.inviteBlock(invited.id), mergeBlockStore: store.inviteBlock(invited.id, 'merge') };`);
  assert.ok(setup.impact, 'L’anteprima esiste per una forza che fa parte di un altro accordo.');
  assert.equal(setup.individualBlock, null, 'L’invito individuale non è bloccato dal partner incompatibile.');
  assert.ok(setup.mergeBlockStore && setup.mergeBlock, 'La fusione è bloccata con un motivo.');
  const open = async () => { await evaluate(`location.hash = '#sondaggi'; true`); await pause(1200); await evaluate(`(() => { const tab = [...document.querySelectorAll('[data-section-tab]')].find(el => /alleanze/i.test(el.textContent)); tab?.click(); document.querySelectorAll('details').forEach(d => { d.open = true; }); return true; })()`); await pause(1500); };
  await open();
  // the list selects the invited force: the panel of its choices is the one shown
  await evaluate(`(() => { const select = document.querySelector('[data-invite-select]'); if (select) { select.value = ${JSON.stringify(setup.invited)}; select.dispatchEvent(new Event('change', { bubbles: true })); } return true; })()`); await pause(400);
  const read = () => evaluate(`(() => { const box = document.querySelector('[data-invite-for]:not([hidden]) [data-invite-choice]'); return { present: Boolean(box), text: box?.innerText ?? '', buttons: [...(box?.querySelectorAll('[data-world-invite]') ?? [])].map(b => ({ mode: b.dataset.inviteMode, disabled: b.disabled, text: b.textContent.trim() })), block: Boolean(box?.querySelector('[data-invite-merge-block]')), hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
  const waitPanel = async () => { for (let i = 0; i < 25; i++) { const r = await read(); if (r.present) return r; await pause(300); } return read(); };
  let panel = await waitPanel();
  assert.ok(panel.present, 'Compare la scelta di come invitare.');
  assert.deepEqual(panel.buttons.map(b => b.mode), ['individual', 'merge'], 'Due scelte esplicite.');
  assert.match(panel.buttons[0].text, /Invita soltanto questo partito/); assert.match(panel.buttons[1].text, /Proponi la fusione delle intere alleanze/);
  assert.ok(panel.buttons[1].disabled && panel.block, 'La fusione è disabilitata e il motivo è scritto.');
  assert.match(panel.text, /Accordo di prova/); assert.match(panel.text, /non compatibile|compatibile con la tua coalizione/); assert.match(panel.text, /rest(a|ano) nell’accordo/); assert.match(panel.text, /1 condizione concordata/); assert.match(panel.text, /1 registrazione elettorale/);
  assert.ok(!/fusione completa/i.test(panel.text), 'Non descrive più l’operazione come fusione completa.');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await pause(500);
  panel = await read(); assert.ok(!panel.hscroll, 'Nessuno scorrimento orizzontale su smartphone.');
  if (process.env.QA_SHOT_DIR) { await evaluate(`document.querySelector('[data-invite-choice]')?.scrollIntoView({ block: 'center' }); true`); await pause(400); await screenshot(`${process.env.QA_SHOT_DIR}/alleanze-invito-scelta-it-390.png`); }
  // the individual button works through the interface: the invited force moves (or is refused), the accord of origin is never taken apart
  await evaluate(`document.querySelectorAll('[data-world-invite][data-invite-mode="individual"]').forEach((b, i) => { if (i === 0) b.click(); }); true`); await pause(800);
  const after = await S(`const w = store.getState().world; const alt = w.alliances.find(a => a.id === 'altro'); return { alt: alt.partyIds, status: alt.status, mine: w.alliances.find(a => a.id === 'mio').partyIds, report: store.getState().ui.allianceReport?.success ?? null, toast: store.getState().ui.toast };`);
  assert.ok(after.status === 'active' && after.alt.includes(setup.far), 'Il partner incompatibile resta nell’accordo di origine.');
  assert.ok(after.report === true ? !after.mine.includes(setup.far) : !after.mine.includes(setup.far) && after.alt.includes(setup.invited), 'Nessun partner non invitato passa all’altra coalizione.');
  // English
  await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1000);
  await S(`const w = store.getState().world; if (!w.alliances.find(a => a.id === 'altro2')) { const ids = w.parties.filter(p => !p.isPlayer && p.active && !w.alliances.some(a => a.status === 'active' && a.partyIds.includes(p.id))).slice(0, 2); if (ids.length === 2) w.alliances.push({ id: 'altro2', label: 'Second test accord', partyIds: ids.map(p => p.id), cohesion: 60, since: '2026-10-01', status: 'active', motive: 'prova', source: 'simulation', coalitions: [] }); } return true;`);
  await open(); const en = await waitPanel();
  if (en.present) { assert.match(en.text, /Invite only this party/); assert.match(en.text, /Propose merging the whole alliances/); assert.ok(!/Invita soltanto|Proponi la fusione|Restano|fa già parte|Come vuoi|acconsent|compatibil[ei]\b(?! with)/.test(en.text), `Nessuna frase italiana nel pannello inglese: ${en.text}`);
    const mineEn = await evaluate(`document.querySelector('[data-my-coalition]')?.innerText ?? ''`); assert.ok(!/nei sondaggi|insieme/.test(mineEn), 'Nessuna frase italiana nel riepilogo dell’alleanza in inglese.'); if (process.env.QA_SHOT_DIR) await screenshot(`${process.env.QA_SHOT_DIR}/alleanze-invito-scelta-en-390.png`); }
});
console.log('check-alliance-invite-ui: ok');
