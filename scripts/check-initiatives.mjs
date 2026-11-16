// Popular initiatives and referendum signatures (core/initiative-engine.js, store, weekly tick): the three things kept apart (popular initiative 50,000 signatures, referendum 500,000 signatures,
// parliamentary bill = the page «Leggi»), the text in articles, the cost and the levers of the collection, national and regional signatures, opposition and support events, the deposit refused
// below the threshold, the check of the signatures (valid share drawn), the passage to Parliament and its simulated phase, failure and withdrawal with their effects, determinism, and a career
// that plays the whole thing week after week (the funds are spent, the signatures grow, the ending is written in the diary once).
import assert from 'node:assert/strict';
import * as E from '../src/core/initiative-engine.js';
import { startCareer } from './lib/long-run.mjs';

const REGIONS = [['Lombardia', 16.5], ['Lazio', 9.8], ['Campania', 9.4], ['Sicilia', 8.2], ['Veneto', 8.1], ['Toscana', 6.2], ['Puglia', 6.4], ['Calabria', 3.1], ['Marche', 2.5], ['Umbria', 1.5]].map(([name, share]) => ({ name, share: share / 100 }));
const D0 = '2027-01-04';
const next = date => new Date(new Date(`${date}T12:00:00Z`).getTime() + 7 * 864e5).toISOString().slice(0, 10);
const base = { support: 2, notoriety: 25, salience: 0.5, rivals: 0.3, partyStrength: 30, home: 'Toscana', committees: { Toscana: 40 }, regions: REGIONS };
const make = (extra = {}) => E.createInitiative({ title: 'Salario minimo legale', area: 'lavoro', articles: ['Art. 1 — Il salario minimo orario è fissato per legge.', 'Art. 2 — Il Ministero del lavoro vigila sull’applicazione.'], ...extra }, { date: D0, funds: 20000, home: 'Toscana' });
const collect = (initiative, ctx, { stopAt = Infinity, weeks = 60 } = {}) => {
  let date = D0, week = 0, ini = initiative; const events = [];
  while (E.isOpen(ini) && week < weeks && ini.signatures.total < stopAt) { date = next(date); week++; const out = E.advanceCollection(ini, { ...ctx, week, date }); ini = out.initiative; events.push(...out.events); }
  return { ini, date, week, events };
};

// ---------- 1. the three things, thresholds and text ----------
assert.equal(E.INITIATIVE_KINDS.popolare.required, 50000, 'Iniziativa popolare: 50.000 firme.');
assert.equal(E.INITIATIVE_KINDS.referendum.required, 500000, 'Referendum abrogativo: 500.000 firme.');
assert.ok(!('parlamentare' in E.INITIATIVE_KINDS) && /pagina «Leggi»/.test(E.PARLIAMENTARY_NOTE), 'La proposta parlamentare è un’altra cosa: la pagina «Leggi».');
assert.throws(() => make({ title: 'No' }), /almeno 5 caratteri/);
assert.throws(() => make({ articles: [] }), /scritta in articoli/);
assert.throws(() => make({ articles: Array.from({ length: 9 }, (_, n) => `Articolo numero ${n + 1} del testo`) }), /Al massimo 8 articoli/);
assert.throws(() => make({ articles: ['corto'] }), /almeno 12 caratteri/);
assert.throws(() => E.createInitiative({ title: 'Titolo valido', area: 'lavoro', articles: ['Un articolo lungo abbastanza'] }, { date: D0, funds: 10 }), /servono 400 €/);
assert.throws(() => make({ kind: 'sconosciuto' }), /Tipo di iniziativa non valido/);
{ const ref = make({ kind: 'referendum', articles: [] }); assert.equal(ref.required, 500000); assert.equal(ref.articles.length, 0, 'La richiesta di referendum non ha articoli.'); }

// ---------- 2. the levers: costs, limits, and the money ----------
{
  let ini = make();
  assert.equal(ini.spent, 400, 'L’apertura costa 400 €.');
  const out = E.organize(ini, 'banchetti', 5, { date: D0, funds: 5000 });
  assert.equal(out.cost, 750); assert.equal(out.initiative.organization.banchetti, 5);
  assert.equal(E.weeklyCost(out.initiative), 125, 'Cinque banchetti costano 25 € a settimana ciascuno.');
  assert.throws(() => E.organize(ini, 'banchetti', 5, { date: D0, funds: 100 }), /Per aggiungere 5 a «Banchetti di raccolta» servono 750 €/);
  assert.throws(() => E.organize(E.organize(ini, 'online', 1, { date: D0, funds: 5000 }).initiative, 'online', 1, { date: D0, funds: 5000 }), /massimo/);
  const push = E.organize(ini, 'spinta', 1, { date: D0, funds: 1000 });
  assert.equal(push.cost, 400); assert.throws(() => E.organize(push.initiative, 'spinta', 1, { date: D0, funds: 1000 }), /già in corso/);
  assert.throws(() => E.organize(ini, 'inesistente', 1, { date: D0, funds: 1000 }), /sconosciuta/);
}

// ---------- 3. the collection: weak fails, organised reaches, the territory adds up, determinism ----------
{
  const weak = collect(make(), base);
  assert.equal(weak.ini.status, 'fallita', 'Senza organizzazione la raccolta non arriva a 50.000 firme.');
  assert.ok(weak.ini.signatures.total < 50000 && /non ha raggiunto la soglia/.test(weak.ini.outcome), 'Il fallimento è spiegato con i numeri.');
  assert.ok(weak.events.some(event => event.ended === 'fallita'), 'Il fallimento è un evento da raccontare.');
  let organised = make();
  for (const [kind, n] of [['banchetti', 20], ['online', 1], ['volontari', 150], ['comuni', 20]]) organised = E.organize(organised, kind, n, { date: D0, funds: 99999 }).initiative;
  const run = collect(organised, base, { stopAt: 50000 * 1.08 });
  assert.ok(run.ini.signatures.total >= 54000 && E.depositReady(run.ini), `Una raccolta organizzata supera la soglia (${run.ini.signatures.total} in ${run.week} settimane).`);
  assert.ok(run.week <= 26, 'E la supera entro il termine di sei mesi.');
  const byRegion = Object.values(run.ini.signatures.byRegion).reduce((a, b) => a + b, 0);
  assert.equal(byRegion, run.ini.signatures.total, 'Le firme per Regione sommano al totale nazionale.');
  const top = Object.entries(run.ini.signatures.byRegion).sort((a, b) => b[1] - a[1]);
  assert.ok(['Lombardia', 'Toscana'].includes(top[0][0]), 'La Regione del promotore e le più popolose danno di più.');
  assert.ok(run.ini.signatures.byChannel.banchetti > 0 && run.ini.signatures.byChannel.online > 0, 'Si vede da quale canale arrivano le firme.');
  const again = collect(organised, base, { stopAt: 50000 * 1.08 });
  assert.equal(JSON.stringify(again.ini), JSON.stringify(run.ini), 'Stessa iniziativa e stesso contesto: stesse firme.');
  assert.ok(run.events.some(event => /raggiunta quota/.test(event.text)), 'Il raggiungimento della quota è raccontato.');
  const view = E.overview(run.ini, { ...base, date: run.date });
  assert.ok(view.ready && view.percent >= 100 && view.valid < run.ini.signatures.total, 'La vista mostra la quota raggiunta e le firme valide stimate (meno delle raccolte).');
  // opposition and support events appear over many drawings
  let negative = 0, positive = 0;
  for (let n = 0; n < 40; n++) { const ini = { ...organised, id: `iniziativa-prova-${n}` }; for (const event of collect(ini, base, { weeks: 20 }).events) { if (/Campagna contraria/.test(event.text)) negative++; if (/associazione rilancia/.test(event.text)) positive++; } }
  assert.ok(negative > 0 && positive > 0, `Campagne contrarie (${negative}) e sostegni (${positive}) accadono davvero.`);
}

// ---------- 4. the deposit and the check ----------
{
  let organised = make();
  for (const [kind, n] of [['banchetti', 20], ['online', 1], ['volontari', 150], ['comuni', 20]]) organised = E.organize(organised, kind, n, { date: D0, funds: 99999 }).initiative;
  assert.throws(() => E.depositInitiative(organised, { date: D0 }), /Mancano 50\.000 firme/, 'Sotto la soglia non si deposita.');
  const verdicts = { ok: 0, refused: 0 };
  for (let n = 0; n < 60; n++) {
    const ready = { ...collect({ ...organised, id: `iniziativa-verifica-${n}` }, base, { stopAt: 50000 }).ini };
    if (ready.signatures.total < 50000) continue;
    const deposited = E.depositInitiative(ready, { date: '2027-06-01' });
    assert.equal(deposited.status, 'verifica'); assert.ok(deposited.verification.share >= 0.88 && deposited.verification.share <= 0.97, 'La quota di firme valide è tra 88% e 97%.');
    assert.equal(E.settleVerification(deposited, { date: '2027-06-08' }).initiative.status, 'verifica', 'La verifica dura due settimane.');
    const out = E.settleVerification(deposited, { date: '2027-06-15' });
    if (out.initiative.status === 'respinta') { verdicts.refused++; assert.match(out.initiative.outcome, /Non basta/); assert.ok(out.events[0].ended === 'respinta'); }
    else { verdicts.ok++; assert.equal(out.initiative.status, 'in-parlamento'); assert.ok(['camera', 'senato'].includes(out.initiative.parliament.chamber)); }
  }
  assert.ok(verdicts.ok > 0 && verdicts.refused > 0, `Depositando appena sopra la soglia la verifica può respingere (${verdicts.refused}) o accettare (${verdicts.ok}): serve un margine.`);
  // with the margin the check always passes
  for (let n = 0; n < 30; n++) {
    const ready = collect({ ...organised, id: `iniziativa-margine-${n}` }, base, { stopAt: 50000 * 1.12 }).ini;
    const out = E.settleVerification(E.depositInitiative(ready, { date: '2027-06-01' }), { date: '2027-06-15' });
    assert.equal(out.initiative.status, 'in-parlamento', 'Con il 12% di margine la verifica passa.');
  }
  // the deadline with enough signatures files the text by itself
  const late = { ...organised, deadline: '2027-01-20', signatures: { ...organised.signatures, total: 52000 } };
  const filed = E.advanceCollection(late, { ...base, week: 3, date: '2027-01-25' });
  assert.equal(filed.initiative.status, 'verifica', 'Scaduto il termine con firme sufficienti il testo è depositato d’ufficio.');
}

// ---------- 5. referendum and parliament ----------
{
  const ref = make({ kind: 'referendum', articles: [] });
  const done = { ...ref, signatures: { ...ref.signatures, total: 560000 } };
  const out = E.settleVerification({ ...E.depositInitiative(done, { date: '2027-03-01' }), verification: { share: 0.93, valid: 520000, until: '2027-03-15' } }, { date: '2027-03-15' });
  assert.equal(out.initiative.status, 'depositata'); assert.match(out.initiative.outcome, /non è simulata/, 'Il referendum dichiara che la fase successiva non è simulata.');
  let phased = null; const ends = { approvata: 0, archiviata: 0 };
  for (let n = 0; n < 50; n++) {
    let ini = { ...make(), id: `iniziativa-aula-${n}`, status: 'in-parlamento', signatures: { total: 58000, byRegion: {}, byChannel: {} }, parliament: { chamber: 'camera', enteredAt: '2027-02-01', stage: 'assegnata', weeks: 0 } };
    const stages = new Set(); let date = '2027-02-01';
    for (let w = 0; w < 40 && ini.status === 'in-parlamento'; w++) { date = next(date); const o = E.advanceParliamentPhase(ini, { date, support: 0.5 }); ini = o.initiative; stages.add(ini.parliament.stage); }
    assert.ok(['approvata', 'archiviata'].includes(ini.status), 'La fase parlamentare finisce con approvazione o archiviazione.'); ends[ini.status]++;
    if (n === 0) phased = stages;
  }
  assert.ok(ends.approvata > 0 && ends.archiviata > 0, `Gli esiti sono entrambi possibili (${JSON.stringify(ends)}).`);
  assert.ok(phased.has('commissione') && phased.has('aula'), 'Passa per assegnazione, commissione e Aula.');
  for (const status of ['approvata', 'archiviata', 'depositata', 'respinta', 'fallita', 'ritirata']) assert.ok(E.endingEffects({ status, signatures: { total: 30000 }, required: 50000 }), `Effetti definiti per «${status}».`);
  assert.ok(E.endingEffects({ status: 'approvata' }).reputation > 0 && E.endingEffects({ status: 'respinta', signatures: { total: 1 }, required: 5 }).reputation < 0, 'Successo e fallimento hanno effetti di segno opposto.');
  assert.equal(E.withdraw(make(), { date: D0 }).status, 'ritirata'); assert.throws(() => E.withdraw(out.initiative, { date: D0 }), /ancora aperta/);
}

// ---------- 6. a career: the whole thing week after week ----------
{
  const { store } = await startCareer({ seed: 'iniziativa-carriera', level: 'comunale', fast: true });
  const state = () => store.getState();
  state().game.resources.funds = 30000;
  const fundsBefore = state().game.resources.funds;
  const item = store.startInitiative({ title: 'Sanità di prossimità', area: 'sanita', articles: ['Art. 1 — Un presidio di medici di base in ogni comune.', 'Art. 2 — Finanziamento con il fondo sanitario nazionale.'] });
  assert.equal(state().game.resources.funds, fundsBefore - 400, 'L’apertura costa 400 € dai fondi.');
  assert.equal(store.initiatives().length, 1);
  store.organizeInitiative(item.id, 'banchetti', 15); store.organizeInitiative(item.id, 'online', 1); store.organizeInitiative(item.id, 'volontari', 120); store.organizeInitiative(item.id, 'comuni', 15);
  const afterSetup = state().game.resources.funds;
  assert.ok(afterSetup < fundsBefore - 400, 'Le leve della raccolta costano.');
  let seen = 0, last = 0;
  for (let w = 0; w < 40 && !['verifica', 'in-parlamento', 'approvata', 'archiviata', 'respinta', 'fallita'].includes(store.initiatives()[0].status); w++) {
    store.advanceTurn(1, { delegate: true });
    const now = store.initiatives()[0].signatures.total; assert.ok(now >= last, 'Le firme non diminuiscono.'); if (now > last) seen++; last = now;
  }
  assert.ok(seen >= 3 && last > 0, `Le firme crescono settimana dopo settimana (${last}).`);
  assert.ok(state().game.resources.funds < afterSetup, 'Le spese settimanali dei banchetti e della piattaforma escono dai fondi.');
  const view = store.initiativeView(item.id); assert.ok(view && view.rules.required === 50000 && typeof view.percent === 'number');
  if (store.initiatives()[0].status === 'raccolta' && E.depositReady(store.initiatives()[0])) store.depositInitiative(item.id);
  // the weekly report tells about it
  assert.ok(state().game.log.some(entry => /iniziativa|raccolta|firme/i.test(`${entry.title} ${entry.lines?.join(' ')}`)) || store.initiatives()[0].history.length > 1, 'La storia della raccolta è scritta.');
  // withdrawing a second one
  const second = store.startInitiative({ title: 'Trasporti locali gratuiti', area: 'trasporti', articles: ['Art. 1 — Abbonamento gratuito per gli studenti.'] });
  const ret = store.withdrawInitiative(second.id); assert.equal(ret.status, 'ritirata');
  assert.throws(() => store.startInitiative({ title: 'Titolo valido ma senza fondi', area: 'sanita', articles: ['Un articolo abbastanza lungo'], kind: 'referendum' }) && (state().game.resources.funds = 0, store.startInitiative({ title: 'Altro referendum valido', area: 'sanita', kind: 'referendum' })), /servono 4000/);
}
console.log('Iniziative popolari verificate: popolare (50.000) e referendum (500.000) distinti dalla proposta parlamentare, testo in articoli, leve e costi, firme nazionali e per Regione, opposizione e sostegni, deposito rifiutato sotto soglia, verifica delle firme con margine, fase parlamentare simulata, fallimento e ritiro con effetti, carriera settimana per settimana.');
