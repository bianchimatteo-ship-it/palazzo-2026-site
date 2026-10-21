// The annual membership fee of the party: set by the leader, saved in the career, and it really moves the money and the members. Engine checks (seeded, no browser), the store (leader only, validation, cooldown,
// reload of the save) and, in Chrome, the page of the party organisation (fee shown, changed, kept after a reload and after time passes). Browser part skipped without Chrome.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { playWeek, startCareer } from './lib/long-run.mjs';

const nativeFetch = globalThis.fetch;
const build = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/main\.js\?v=([^"']+)/)?.[1];
const mod = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const { createOrganization, advanceOrganization, setMembershipFee, membershipOf, feeEffects, acceptedFee, normalizeOrganization } = await mod('src/core/organization-engine.js');
const { MEMBERSHIP, MEMBERSHIP_FEE } = await mod('src/data/simulation/organization-rules.js');

const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function run({ fee = MEMBERSHIP_FEE, weeks = 52, share = 5, pollDelta = 0, mood = 50, seed = 7, cohesion = null, change = null }) {
  const rand = seeded(seed);
  const org = createOrganization({ rand, founder: false, region: 'Toscana', share, week: 1, date: '2026-10-12' });
  if (cohesion !== null) org.cohesion = cohesion;
  if (fee !== MEMBERSHIP_FEE) org.membership = setMembershipFee(org, fee, { week: 1 }).membership;
  const start = org.members; let income = 0, expense = 0, quote = 0, ok = true, firstExpense = null;
  for (let week = 1; week <= weeks; week++) {
    if (change && week === change.week) org.membership = setMembershipFee(org, change.fee, { week }).membership;
    const before = org.members;
    advanceOrganization(org, { rand, week, date: '2026-10-12', pollShare: share, pollDelta, mood, founder: false, currents: [], seed });
    const weekly = org.membership.weekly, last = org.treasury.history.at(-1);
    income += last.income; expense += last.expense; quote += weekly.income;
    if (firstExpense === null) firstExpense = last.expense;
    ok &&= weekly.joins - weekly.leaves === weekly.net && weekly.net === org.members - before;
  }
  return { org, start, end: org.members, change: org.members / start - 1, income, expense, quote, firstExpense, reconciled: ok };
}

// ---------- 1. state, defaults and old saves ----------
const fresh = createOrganization({ rand: seeded(1), founder: false, region: 'Toscana', share: 5, week: 1, date: '2026-10-12' });
assert.equal(membershipOf(fresh).fee, MEMBERSHIP_FEE, 'Una nuova organizzazione parte dalla quota ordinaria.');
const legacy = { ...fresh }; delete legacy.membership;
assert.equal(normalizeOrganization(legacy, { rand: seeded(1), region: 'Toscana', share: 5, week: 1 }).membership.fee, MEMBERSHIP_FEE, 'Un vecchio salvataggio senza quota prende quella ordinaria.');
const saved = JSON.parse(JSON.stringify({ ...fresh, membership: setMembershipFee(fresh, 55, { week: 3 }).membership }));
assert.equal(normalizeOrganization(saved, { rand: seeded(1), region: 'Toscana', share: 5, week: 1 }).membership.fee, 55, 'La quota scelta sopravvive a salvataggio e ripristino.');

// ---------- 2. validation ----------
assert.throws(() => setMembershipFee(fresh, -5, { week: 1 }), /va da/, 'Non negativa.');
// an empty or non-numeric input is not a fee (Number('') is 0): refused, with a message, and the fee in force stays as it was
for (const bad of ['', '   ', 'abc', '12abc', null, undefined, NaN, true, {}, []]) assert.throws(() => setMembershipFee(fresh, bad, { week: 1 }), /cifra valida|va da/, `Quota non valida rifiutata: ${JSON.stringify(bad)}.`);
assert.equal(membershipOf(fresh).fee, MEMBERSHIP_FEE, 'Dopo gli input non validi la quota in vigore è invariata.');
assert.throws(() => setMembershipFee(fresh, MEMBERSHIP.max + 1, { week: 1 }), /va da/, 'Non oltre il massimo.');
assert.throws(() => setMembershipFee(fresh, 'abc', { week: 1 }), /cifra valida|va da/, 'Un numero.');
assert.throws(() => setMembershipFee(fresh, MEMBERSHIP_FEE, { week: 1 }), /già la quota/, 'Nessun cambio a vuoto.');
const first = setMembershipFee(fresh, 50, { week: 10 });
assert.throws(() => setMembershipFee({ ...fresh, membership: first.membership }, 20, { week: 10 + MEMBERSHIP.cooldownWeeks - 1 }), /una volta ogni/, 'Una quota alla volta: c’è un intervallo tra due cambi.');
assert.equal(setMembershipFee({ ...fresh, membership: first.membership }, 20, { week: 10 + MEMBERSHIP.cooldownWeeks }).membership.fee, 20, 'Passato l’intervallo si può cambiare.');
assert.ok(first.membership.shock > 0 && first.membership.boost === 0, 'Un rialzo si fa sentire per qualche settimana.');

// ---------- 3. what the fee does: members and money, one year, same seed ----------
const results = Object.fromEntries([0, 30, 60, 90, 120].map(fee => [fee, run({ fee })]));
for (const result of Object.values(results)) assert.ok(result.reconciled, 'Adesioni − abbandoni = variazione degli iscritti, ogni settimana.');
const m = fee => results[fee].end;
assert.ok(m(0) > m(30) && m(30) > m(60) && m(60) > m(90) && m(90) > m(120), `Più la quota è alta, meno iscritti: ${[0, 30, 60, 90, 120].map(fee => m(fee)).join(' > ')}.`);
assert.ok(results[30].change > -0.03 && results[30].change < 0.08, `Con la quota ordinaria la crescita non è automatica né esplosiva (${(results[30].change * 100).toFixed(1)}% in un anno).`);
assert.ok(results[120].change < -0.08 && results[120].change > -0.4, `Una quota altissima fa uscire iscritti, senza crolli irreali (${(results[120].change * 100).toFixed(1)}%).`);
assert.ok(results[0].change > results[30].change + 0.02, 'Una quota azzerata aiuta la crescita.');
assert.equal(results[0].quote, 0, 'Senza quota non entrano quote.');
assert.ok(results[60].quote > results[30].quote, 'Raddoppiare la quota porta più entrate, nonostante gli iscritti persi.');
assert.ok(results[120].quote < results[60].quote, 'Ma non all’infinito: oltre un certo punto pagano in pochi e le entrate calano.');
// costs follow the activity, not the fee
assert.ok(Math.abs(results[30].firstExpense - results[120].firstExpense) / results[30].firstExpense < 0.02, 'Le spese della prima settimana non dipendono dalla quota.');
// money is counted once: the "quote" of the treasury are exactly the fee income of the weeks
for (const fee of [30, 90]) {
  const org = results[fee].org;
  const booked = org.treasury.yearTotals.byCategory.quote;
  assert.ok(Math.abs(booked - results[fee].quote) <= 52, `Le quote in tesoreria sono le entrate settimanali dell’iscrizione, contate una volta (${Math.round(booked)} ≈ ${results[fee].quote}).`);
  assert.equal(Math.round(org.treasury.balance - (createOrganization({ rand: seeded(7), founder: false, region: 'Toscana', share: 5, week: 1, date: '2026-10-12' }).treasury.balance)), Math.round(results[fee].income - results[fee].expense) + 0, 'La cassa è esattamente entrate meno uscite.') ;
}

// ---------- 4. consensus, vitality, cohesion and the state of the party count ----------
const good = run({ pollDelta: 0.5, mood: 68 }), bad = run({ pollDelta: -0.5, mood: 32 });
assert.ok(good.end > results[30].end && results[30].end > bad.end, 'Sondaggi e clima del Paese muovono gli iscritti.');
assert.ok(run({ cohesion: 85 }).end > run({ cohesion: 35 }).end, 'Un partito coeso trattiene e attira più iscritti.');
const lively = createOrganization({ rand: seeded(3), founder: false, region: 'Toscana', share: 5, week: 1, date: '2026-10-12' }), dead = structuredClone(lively);
for (const section of lively.sections) section.vitality = 85; for (const section of dead.sections) section.vitality = 20;
const stepYear = org => { const rand = seeded(5); for (let week = 1; week <= 26; week++) advanceOrganization(org, { rand, week, date: '2026-10-12', pollShare: 5, pollDelta: 0, mood: 50, founder: false, currents: [], seed: 5 }); return org.members; };
assert.ok(stepYear(lively) > stepYear(dead), 'Sezioni vive attirano iscritti, sezioni spente li perdono.');
assert.ok(acceptedFee({ cohesion: 90, vitality: 80, climate: 0.5 }) > acceptedFee({ cohesion: 30, vitality: 30, climate: -0.5 }), 'Un partito che va bene può chiedere una quota più alta senza perdere iscritti.');
const poorHigh = feeEffects(90, { members: 1000, cohesion: 30, vitality: 30, climate: -0.5 }), richHigh = feeEffects(90, { members: 1000, cohesion: 90, vitality: 80, climate: 0.5 });
assert.ok(poorHigh.leaveMultiplier > richHigh.leaveMultiplier && poorHigh.collected < richHigh.collected, 'La stessa quota pesa di più in un partito in difficoltà.');

// ---------- 5. time: a rise is felt and fades; no whiplash ----------
const risen = run({ change: { week: 5, fee: 90 }, weeks: 30 });
const steady = run({ weeks: 30 });
assert.ok(risen.end < steady.end, 'Un rialzo a metà anno fa perdere iscritti rispetto a non farlo.');
assert.ok(risen.org.membership.shock === 0 && risen.org.membership.weekly, 'Dopo qualche settimana lo shock si è spento.');
const worst = (() => { let max = 0; const rand = seeded(9); const org = createOrganization({ rand, founder: false, region: 'Toscana', share: 5, week: 1, date: '2026-10-12' }); org.membership = setMembershipFee(org, 120, { week: 1 }).membership; for (let week = 1; week <= 20; week++) { const before = org.members; advanceOrganization(org, { rand, week, date: '2026-10-12', pollShare: 5, pollDelta: -1, mood: 20, founder: false, currents: [], seed: 9 }); max = Math.max(max, (before - org.members) / before); } return max; })();
assert.ok(worst < 0.03, `Nemmeno nel caso peggiore si perde più del 3% degli iscritti in una settimana (${(worst * 100).toFixed(2)}%).`);
console.log('Quota di tesseramento: motore verificato (validazione, un anno di iscritti ed entrate, clima, coesione, vitalità, rialzi nel tempo, contabilità senza doppi conteggi).');

// ---------- 6. the store: leader only, saved in the career ----------
const { store } = await startCareer({ seed: 'quota', level: 'comunale', draft: { partyMode: 'new', partyName: 'Lista Quota', partyAbbreviation: 'LQ', partyDescription: 'Test', partyColor: '#336699', partyOrientation: 'Centrismo civico', partyPosition: 'centro' } });
const party = store.getState().game.party;
assert.ok(party?.org, 'Il personaggio ha un partito con la sua organizzazione.');
assert.equal(party.org.membership.fee, MEMBERSHIP_FEE);
const leader = party.affiliation === 'founder' || party.rank >= 3;
if (leader) {
  const week0 = store.getState().game.week.index;
  assert.equal(store.setMembershipFee(45).fee, 45, 'Il fondatore cambia la quota.');
  assert.equal(store.getState().game.party.org.membership.fee, 45);
  assert.equal(store.getState().game.party.org.membership.changedWeek, week0, 'Registra quando è stata cambiata.');
  assert.throws(() => store.setMembershipFee(60), /una volta ogni/, 'Subito dopo non si cambia di nuovo.');
  const before = store.getState().game.party.org.members;
  for (let i = 0; i < 6; i++) store.advance(7);
  const org = store.getState().game.party.org;
  assert.equal(org.membership.fee, 45, 'Dopo sei settimane di gioco la quota è ancora quella scelta.');
  assert.ok(org.membership.weekly && org.membership.weekly.fee === 45 && org.membership.weekly.income > 0, 'Le entrate settimanali da quote ci sono e usano la quota scelta.');
  assert.ok(org.members !== before || org.sections.some(section => section.carry), 'Gli iscritti si muovono con le settimane (in un partito piccolo le frazioni si accumulano).');
  for (let i = 0; i < 40; i++) store.advance(7);
  assert.ok(store.getState().game.party.org.members !== before, 'In un anno gli iscritti sono cambiati, in su o in giù.');
  store.save?.();
}
console.log('Quota di tesseramento: store verificato.');

// ---------- 7. the page, in Chrome ----------
if (!chromeAvailable) { console.log('Quota di tesseramento nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
globalThis.fetch = nativeFetch;   // (the long-run environment stood in for it)
await withBrowser(async browser => {
  const { evaluate, waitFor: wait, pause, viewport, errors, version } = browser;
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ' + ${JSON.stringify(selector)}); el.click(); return true; })()`).then(() => pause(500));
  const fee = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return store.getState().game.party.org.membership.fee; })()`);
  // the player leads the party (national direction): the rank is raised in the save before the page opens
  await createCareerInPage(browser, { weeks: 3, extra: `store.getState().game.party.rank = 4; store.save();` });
  await openCareer(browser);
  const leads = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const p = store.getState().game.party; return p?.affiliation === 'founder' || p?.rank >= 3; })()`);
  console.log(leads ? 'Pagina: il giocatore guida il partito.' : 'Pagina: il giocatore non guida il partito (si verifica la sola lettura).');
  const openOrganization = () => evaluate(`(async () => { document.querySelector('[data-nav="partito"]')?.click(); await new Promise(r => setTimeout(r, 500)); document.querySelector('[data-section-tab="partito"][data-section-tab-value="organizzazione"]')?.click(); await new Promise(r => setTimeout(r, 500)); return true; })()`);
  await openOrganization();
  await wait(() => has('[data-membership]'), 15000);
  assert.ok(await evaluate(`/30\\s*€/.test(document.querySelector('[data-membership]').textContent)`), 'La pagina mostra la quota in vigore.');
  if (leads) {
    await click('[data-membership-fee="60"]');
    await wait(async () => (await fee()) === 60, 8000);
    assert.ok(await evaluate(`/60\\s*€/.test(document.querySelector('[data-membership]').textContent)`), 'La pagina mostra la nuova quota.');
    // a custom value, and the refusal of a second change inside the interval
    await evaluate(`(() => { const input = document.querySelector('[data-membership-custom]'); input.value = '70'; return true; })()`);
    await click('[data-membership-apply]');
    await pause(400);
    assert.equal(await fee(), 60, 'Il secondo cambio ravvicinato è rifiutato.');
    assert.ok(await evaluate(`/una volta ogni|ancora/i.test(document.body.textContent)`), 'E dice perché.');
    // reload: the fee is still there
    await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.save(); return true; })()`);
    await openCareer(browser);
    assert.equal(await fee(), 60, 'Dopo il ricaricamento la quota è quella scelta.');
    await openOrganization(); await wait(() => has('[data-membership]'), 15000);
    assert.ok(await evaluate(`/60\\s*€/.test(document.querySelector('[data-membership] h3').textContent)`), 'E la pagina la mostra ancora.');
    // time passes
    await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); for (let i = 0; i < 4; i++) store.advance(7); return true; })()`);
    assert.equal(await fee(), 60, 'E dopo quattro settimane di gioco.');
  }
  for (const [w, h, mobile] of [[1280, 900, false], [390, 800, true]]) {
    await viewport(w, h, mobile); await pause(400);
    const over = await evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    assert.ok(over <= 1, `${w}px: nessun overflow orizzontale (${over}px).`);
  }
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Quota di tesseramento nel browser: quota mostrata, cambiata, protetta dall’intervallo e conservata dopo ricaricamento e tempo.');
