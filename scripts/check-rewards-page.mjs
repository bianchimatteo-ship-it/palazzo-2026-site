// The rewards in Chrome, with the real page: «Ricompense» in the Carriera section, the live clock (only with the page in the foreground, a career open and the lease of this tab), the daily reward that arrives
// by itself after 5 minutes played (the minutes of the day are brought near the end through the journal of the device, the last seconds are real), the rewarded video button that stays off, and the page on a phone.
// (The rules and the persistence are in check-rewards.mjs.) Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Ricompense nel browser saltate: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }

await withBrowser(async ({ evaluate, send, goto, waitFor: wait, pause, errors, version, viewport }) => {
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  // the popup of the weekly news (a game popup) comes first and the rewards one waits for it: the check closes it
  const hasNotice = async selector => { await evaluate(`document.querySelector('[data-news-popup-close]')?.click(); true`); return has(selector); };
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);
  const inPage = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const J = await import('/src/data/repositories/rewards-journal.js?v=${version}'); const R = await import('/src/core/rewards-engine.js?v=${version}'); ${body} })()`);
  const must = async (check, label) => { try { return await wait(check); } catch { throw new Error(`Tempo scaduto in attesa di: ${label}\n${await evaluate(`document.body.innerText.slice(0, 600)`).catch(() => '')}`); } };
  const playMs = () => inPage(`return store.getState().game?.rewards?.playMs ?? 0;`);
  const funds = () => inPage(`return store.getState().game.resources.funds;`);

  // the page is in the foreground (a headless Chrome has no focus of its own)
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await goto('');
  await createCareerInPage({ evaluate, version }, { weeks: 1, name: ['Premi', 'Tempo'] });
  await inPage(`J.rewardsJournal.clear(); return true;`);
  await goto(''); await must(() => has('[data-menu="continua"]'), 'il menu con «Continua»'); await click('[data-menu="continua"]'); await must(() => has('.page-wrap'), 'la partita');

  // ---------- the page, from the Carriera section ----------
  await click('[data-nav="carriera"]'); await pause(300);
  assert.ok(await has('[data-nav="ricompense"]'), 'La sezione Carriera ha la pagina Ricompense.');
  await click('[data-nav="ricompense"]'); await must(() => has('[data-rewards-page]'), 'la pagina Ricompense');
  const page = await text('[data-rewards-page]');
  for (const part of ['Ricompensa giornaliera', '+500 €', 'Tempo di gioco', 'Ricompense pubblicitarie', 'Che cosa hai ricevuto', 'Guarda il video', 'Prossimo capitale politico', 'Prossima preparazione elettorale']) assert.ok(page.includes(part), `La pagina mostra «${part}».`);
  assert.equal(await evaluate(`document.querySelector('[data-reward-video]').disabled`), true, 'Il pulsante del video è disabilitato finché AdMob non è disponibile.');
  assert.match(await text('[data-reward-video-note]'), /AdMob/, 'E dice perché.');
  assert.ok(!/donator|scadenza|scade|durata|settimane/i.test(page.replace(/Il giorno cambia[^\n]*/, '')), 'Nessuna indicazione di durata o donatori.');
  await click('[data-reward-video]'); await pause(200);
  assert.equal(await inPage(`return (store.getState().world?.adTransfers ?? []).length;`), 0, 'Un clic sul pulsante spento non dà nulla.');

  // ---------- the clock counts in the foreground, not otherwise ----------
  const t0 = await playMs(); await pause(4300); const t1 = await playMs();
  assert.ok(t1 - t0 >= 2500 && t1 - t0 <= 6000, `Con la pagina in primo piano il tempo di gioco cresce (${t1 - t0} ms in circa 4 secondi).`);
  assert.match(await text('[data-reward-text="daily"]'), /^\d+:\d\d di 5:00$/, 'L’avanzamento si aggiorna dal vivo.');
  assert.match(await text('[data-reward-text="capital"]'), /di 30 minuti/); assert.match(await text('[data-reward-text="preparation"]'), /di 60 minuti/);
  // hidden (a tab in background): nothing counts
  await evaluate(`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); true`);
  const h0 = await playMs(); await pause(3500); const h1 = await playMs(); assert.ok(h1 - h0 <= 600, `In background il tempo non cresce (${h1 - h0} ms).`);
  await evaluate(`delete document.visibilityState; true`);
  const v0 = await playMs(); await pause(3500); const v1 = await playMs(); assert.ok(v1 - v0 >= 1500, 'Tornata in primo piano il conteggio riparte.');
  // another tab holds the lease: this one does not count (a lease not expired of another tab)
  await evaluate(`localStorage.setItem('politicando.rewards.lease', JSON.stringify({ tab: 'un-altra-scheda', until: Date.now() + 60000 })); true`);
  await pause(1500); const l0 = await playMs(); await pause(3500); const l1 = await playMs(); assert.ok(l1 - l0 <= 600, `Con il lease di un’altra scheda non conta (${l1 - l0} ms).`);
  await evaluate(`localStorage.removeItem('politicando.rewards.lease'); true`);
  // the main menu is open (no session going on): nothing
  await click('[data-nav="panoramica"]'); await pause(200);

  // ---------- the daily reward arrives by itself at 5 minutes ----------
  await pause(2500);
  const before = await funds();
  await inPage(`const day = R.romeDay(); const scope = J.rewardsJournal.scope(null); J.rewardsJournal.setDaily(scope, day, { ms: 299000, state: 'counting', claim: null }); return true;`);
  await click('[data-nav="carriera"]'); await pause(200); await click('[data-nav="ricompense"]'); await must(() => has('[data-rewards-page]'), 'la pagina Ricompense');
  await must(async () => (await funds()) === before + 500, 'i 500 € della ricompensa giornaliera');
  // the popup of the credit: a real dialog (not a toast) with what was received and why
  await must(() => hasNotice('[data-reward-notice][data-reward-kind="giornaliera"]'), 'il popup della ricompensa giornaliera');
  const popup = await text('[data-reward-notice]');
  assert.match(popup, /\+500 €/); assert.match(popup, /Hai giocato almeno 5 minuti oggi/); assert.match(popup, /Fondi personali/);
  assert.equal(await evaluate(`document.querySelector('[data-reward-notice]').getAttribute('role')`), 'dialog');
  // several credits at once queue up and are shown one after the other
  await inPage(`store.addPlayTime(60 * 60000); return true;`);
  await must(() => hasNotice('[data-reward-count]'), 'il contatore degli avvisi in coda');
  assert.match(await text('[data-reward-count]'), /Premio 1 di 4/, 'Quattro avvisi in coda: nessuno sovrascrive un altro.');
  const seen = [];
  for (let i = 0; i < 4; i++) { seen.push(await evaluate(`document.querySelector('[data-reward-notice]')?.dataset.rewardKind ?? null`)); await click('[data-reward-notice-dismiss]'); await pause(150); }
  assert.deepEqual(seen, ['giornaliera', 'capitale', 'capitale', 'preparazione'], 'Uno alla volta, nell’ordine dei crediti.');
  assert.equal(await has('[data-reward-notice]'), false, 'Chiusi tutti, il popup non c’è più.');
  await must(async () => /Riscossa oggi/.test(await text('[data-rewards-page]')), 'lo stato «Riscossa oggi»');
  const done = await text('[data-rewards-page]');
  assert.match(done, /Già riscossa nella giornata/); assert.match(done, /Ricompensa giornaliera/); assert.match(done, /\+500 €/); assert.match(done, /Fondi personali/);
  assert.equal(await inPage(`return store.getState().game.finance.ledger[0].category;`), 'ricompense', 'Il movimento è nel registro, con la categoria dedicata.');
  assert.ok(await evaluate(`document.querySelectorAll('.reward-history-row').length >= 1`), 'Lo storico ha la riga.');
  await pause(2500); assert.equal(await funds(), before + 500, 'Una sola volta.');

  // ---------- the Instagram community card: visible, no logo, the whole path page → service → credit ----------
  await evaluate(`document.addEventListener('click', event => { if (event.target.closest('[data-community-follow]')) event.preventDefault(); }, true); true`);   // (the test does not leave the game)
  await click('[data-nav="panoramica"]'); await pause(150); await click('[data-nav="carriera"]'); await pause(200); await click('[data-nav="ricompense"]'); await must(() => has('[data-reward-community="instagram"]'), 'la carta Community Instagram');
  const card = await text('[data-reward-community="instagram"]');
  for (const part of ['Community Instagram', 'Segui su Instagram', 'Ho seguito, riscuoti', '+1.500 €', '+5', 'capitale politico', 'Da riscuotere']) assert.ok(card.includes(part), `La carta mostra «${part}».`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-reward-community] img, [data-reward-community] svg, [data-reward-community] picture, [data-reward-community] canvas, [data-reward-community] [style*="url("]').length`), 0, 'Nessun logo, icona o immagine nella carta.');
  assert.equal(await evaluate(`document.querySelectorAll('[data-rewards-page] img').length`), 0, 'E nessuna immagine nelle altre carte.');
  const link = await evaluate(`(() => { const a = document.querySelector('[data-community-follow]'); return [a.href, a.target, a.rel]; })()`);
  assert.equal(link[0], 'https://www.instagram.com/politicandoitalia2026/'); assert.equal(link[1], '_blank'); assert.match(link[2], /noopener/);
  assert.equal(await evaluate(`document.querySelector('[data-community-claim]').disabled`), true, 'Prima di aver aperto il profilo non si riscuote.');
  const igFunds = await funds(), igCapital = await inPage(`return store.getState().game.resources.politicalCapital;`);
  await click('[data-community-follow]'); await must(async () => (await evaluate(`document.querySelector('[data-reward-community]')?.dataset.communityState`)) === 'visited', 'lo stato «pronta da riscuotere»');
  assert.equal(await evaluate(`document.querySelector('[data-community-claim]').disabled`), false, 'Dopo il profilo «Ho seguito, riscuoti» è attivo.');
  await click('[data-community-claim]');
  await must(() => hasNotice('[data-reward-notice][data-reward-kind="community"]'), 'il popup della ricompensa Community');
  assert.equal(await funds(), igFunds + 1500, '+1.500 € ai fondi personali.');
  const igAfter = await inPage(`return store.getState().game.resources.politicalCapital;`);
  assert.equal(igAfter, Math.min(100, igCapital + 5), 'Capitale +5 entro il tetto 100.');
  assert.equal(await inPage(`return store.getState().game.finance.ledger[0].label;`), 'Community Instagram', 'Nel registro finanziario.');
  const ig1 = await text('[data-reward-notice]'); assert.match(ig1, /Premio 1 di 2/);
  const seenIg = [];
  for (let i = 0; i < 2; i++) { seenIg.push(await text('[data-reward-title]')); await click('[data-reward-notice-dismiss]'); await pause(150); }
  assert.ok(seenIg.some(item => /\+1\.500 €/.test(item)) && seenIg.some(item => /Capitale politico/.test(item)), `Due avvisi: fondi e capitale (${seenIg.join(' | ')}).`);
  await must(async () => (await evaluate(`document.querySelector('[data-reward-community]')?.dataset.communityState`)) === 'claimed', 'lo stato «Riscossa»');
  assert.equal(await has('[data-community-claim]'), false, 'Riscossa: i pulsanti non ci sono più.');
  assert.match(await text('[data-reward-community]'), /Riscossa/);
  assert.equal(await evaluate(`document.querySelectorAll('.reward-history-row.is-rose').length`), 2, 'Nello storico le due righe.');
  assert.equal(await funds(), igFunds + 1500, 'Una volta sola.');

  // ---------- on a phone ----------
  await viewport(390, 800, true); await pause(400);
  const overflow = await evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
  assert.ok(overflow <= 1, `Sul telefono la pagina non esce dallo schermo (${overflow}px).`);
  assert.ok(await has('[data-rewards-page] .reward-history-row'), 'Lo storico c’è anche sul telefono.');
  assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource/i.test(String(item))), [], 'Nessun errore nella pagina.');
}, { language: 'it' });

// ---------- the same page and the popup in English: nothing is left in Italian ----------
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version }) => {
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('missing ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const hasNotice = async selector => { await evaluate(`document.querySelector('[data-news-popup-close]')?.click(); true`); return has(selector); };
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);
  const inPage = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  await goto('');
  await createCareerInPage({ evaluate, version }, { weeks: 1, name: ['Premi', 'Inglese'] });
  await goto(''); await wait(() => has('[data-menu="continua"]')); await click('[data-menu="continua"]'); await wait(() => has('.page-wrap'));
  await click('[data-nav="carriera"]'); await pause(300); await click('[data-nav="ricompense"]'); await wait(() => has('[data-rewards-page]'));
  await inPage(`store.getState().game.resources.politicalCapital = 98; store.addPlayTime(30 * 60000); store.addPlayTime(30 * 60000); return true;`);
  await wait(() => hasNotice('[data-reward-notice]'));
  const popup = await text('[data-reward-notice]');
  assert.match(popup, /\+2 Political capital/, 'Importo effettivo: 98 + 4 → +2.'); assert.match(popup, /You have reached 30 minutes of play/); assert.match(popup, /REWARD RECEIVED/i); assert.match(popup, /Reward 1 of 3/); assert.match(popup, /Continue/);
  await click('[data-reward-notice-dismiss]'); await pause(200);
  const zero = await text('[data-reward-notice]');
  assert.match(zero, /Political capital already at maximum/); assert.match(zero, /no points added, the limit is 100/); assert.ok(!/\+\d/.test(zero.split('\n').slice(0, 3).join(' ')), 'A zero credit announces no gain.');
  await click('[data-reward-notice-dismiss]'); await pause(200);
  const page = await text('[data-rewards-page]');
  for (const part of ['Daily reward', 'Play time', 'Next political capital', 'Next electoral preparation', 'Rewarded', 'What you have received', 'Instagram community', 'Follow on Instagram', 'I followed, claim', 'To claim', 'Watch the video', 'Rewards earned']) assert.ok(new RegExp(part, 'i').test(page), `In English the page says «${part}».`);
  const italian = page.match(/Ricompens|Tempo di gioco|Prossim|Storico|riscuot|Guarda|Segui|Ho seguito|Da riscuotere|Premi ottenuti|Giocare|Che cosa|Fondi personali|Capitale politico|Hai /gi);
  assert.equal(italian, null, `Nothing of the page is left in Italian (${italian}).`);
}, { language: 'en' });
console.log('Ricompense nel browser verificate: pagina nella sezione Carriera con le quattro parti, video spento con il motivo, tempo che cresce solo in primo piano e con il lease della scheda, ricompensa giornaliera arrivata da sola ai 5 minuti (una sola volta, nel registro e nello storico), popup in coda, carta Community Instagram senza logo con il percorso completo (profilo, «Ho seguito, riscuoti», +1.500 € e capitale, una volta sola), versione inglese senza italiano residuo, pagina leggibile sul telefono.');
process.exit(0);
