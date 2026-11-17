// Referendum, second round: (1) the stance of every group comes from the PROGRAMME of its party on the theme of the law (not only majority/opposition); (2) an abrogation stops the ONGOING effects of the law and keeps
// what already happened; (3) a constitutional revision goes through the Chambers and reaches the confirmatory referendum; (4) a law with a different title but equivalent content cannot come back.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, playWeek } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const P = await import(new URL(`../src/core/parliament-engine.js?v=${build}`, import.meta.url).href);
const S = await import(new URL(`../src/core/society-engine.js?v=${build}`, import.meta.url).href);
const St = await import(new URL(`../src/core/store.js?v=${build}`, import.meta.url).href);

// ---------- (4) equivalent content ----------
{
  const law = { id: 's1', title: 'Fondo per le scuole di montagna', summary: 'Un fondo nazionale per sostenere le scuole delle aree interne e di montagna con insegnanti stabili.', area: 'scuola', instrument: 'investimento', status: 'vigente', approvedAt: '2027-03-01', legislature: 19, blockable: true };
  const p = { legislature: { number: 19 }, statutes: [law] };
  assert.ok(P.statuteBlock(p, { area: 'scuola', instrument: 'regole', title: 'Sostegno agli istituti delle zone montane', summary: 'Un fondo nazionale per sostenere le scuole delle aree interne e di montagna con insegnanti stabili.' }, '2027-06-01'), 'Titolo diverso, stesso contenuto: bloccata.');
  assert.equal(P.statuteBlock(p, { area: 'scuola', instrument: 'regole', title: 'Obbligo di mense nelle scuole elementari', summary: 'Ogni scuola elementare deve offrire un servizio di mensa gratuito per i bambini delle famiglie a basso reddito.' }, '2027-06-01'), null, 'Contenuto diverso: libera.');
  assert.equal(P.statuteBlock(p, { area: 'sanita', instrument: 'regole', title: 'Sostegno agli istituti delle zone montane', summary: law.summary }, '2027-06-01'), null, 'Altra area: libera.');
  assert.ok(P.contentOverlap('Fondo scuole montagna insegnanti stabili aree interne', 'Aree interne: insegnanti stabili nelle scuole di montagna') >= P.EQUIVALENT_OVERLAP);
}
// ---------- (2) the repeal keeps history ----------
{
  const { store } = await startCareer({ seed: 'abrogazione-effetti', level: 'deputato', fast: true });
  const base = store.getState().society;
  const society = JSON.parse(JSON.stringify(base));
  society.lawsApplied = [{ title: 'Legge prova', area: 'scuola' }, ...(society.lawsApplied ?? [])];
  society.effects = [...society.effects, { cause: 'Legge prova', indicator: 'scuola', area: 'scuola', perWeek: 0.2, weeks: 20, remaining: 12 }, { cause: 'Legge prova', indicator: 'scuola', area: 'scuola', perWeek: 0.1, weeks: 20, remaining: 12 }, { cause: 'Altra legge', indicator: 'scuola', area: 'scuola', perWeek: 0.1, weeks: 20, remaining: 5 }];
  const regionsBefore = JSON.stringify(society.regions);
  const total = S.repealMeasure(society, 'Legge prova', 1);
  assert.equal(total.effects.filter(e => e.cause === 'Legge prova').length, 0, 'Abrogazione totale: gli effetti in corso finiscono.');
  assert.equal(total.effects.filter(e => e.cause === 'Altra legge').length, 1, 'Le altre leggi non sono toccate.');
  assert.equal(JSON.stringify(total.regions), regionsBefore, 'Ciò che è già maturato resta (nessun annullamento retroattivo).');
  assert.ok(total.lawsApplied.find(e => e.title === 'Legge prova').repealed, 'La legge applicata è segnata abrogata, non cancellata dalla storia.');
  assert.equal(S.repealMeasure(society, 'Legge prova', 0.5).effects.filter(e => e.cause === 'Legge prova').length, 1, 'Parziale: finisce solo una parte.');
  // in the game: a referendum won with the quorum
  const s = store.getState();
  s.society = society;
  s.parliament = { ...s.parliament, statutes: [{ id: 'st-ref', lawId: 'l', number: 1, title: 'Legge prova', summary: 'Prova', area: 'scuola', instrument: 'investimento', kind: 'ddl', origin: 'La maggioranza', approvedAt: s.clock.currentDate, legislature: 1, status: 'vigente', blockable: true, amendments: [] }] };
  s.game.resources = { ...s.game.resources, funds: 50000, politicalCapital: 20 };
  const ref = store.startReferendum({ statuteId: 'st-ref', scope: 'totale', route: 'consigli' });
  const live = store.getState().game.referendums.find(r => r.id === ref.id);
  Object.assign(live, { phase: 'campagna', voteDate: store.getState().clock.currentDate, side: 'si', quality: { clarity: 1, homogeneity: 1, score: 1 }, campaign: { support: 85, turnout: 80, stances: { si: [], no: [], free: [] }, actions: {}, events: [], polls: [], effortWeek: -1, used: 0 } });
  for (let i = 0; i < 2 && store.getState().game.referendums.find(r => r.id === ref.id).status === 'in-corso'; i++) store.advance(7);
  const done = store.getState().game.referendums.find(r => r.id === ref.id);
  assert.equal(done.status, 'concluso'); assert.ok(done.carried, 'Il referendum è vinto con il quorum.');
  assert.equal(store.statutes().find(item => item.id === 'st-ref').status, 'abrogata', 'La legge è abrogata nel registro.');
  assert.equal(store.getState().society.effects.filter(e => e.cause === 'Legge prova').length, 0, 'E i suoi effetti continuativi sono finiti nel gioco.');
  assert.equal(store.getState().society.effects.filter(e => e.cause === 'Altra legge').length, 1, 'Quelli delle altre leggi no.');
}
// ---------- (1) the stance from the programme ----------
const { store, db, decide } = await startCareer({ seed: 'posizioni-partiti', level: 'deputato', fast: true });
for (let i = 0; i < 3; i++) playWeek({ store, db, decide });
{
  const s = store.getState();
  const ref = { id: 'ref-pos', kind: 'abrogativo', target: { statuteId: 'st-x', area: 'immigrazione', title: 'Legge sull’immigrazione' }, side: null };
  const { stances } = St.referendumStancesOf(s, ref);
  const byProgramme = Object.values(stances.basis).filter(item => item === 'programma').length;
  assert.ok(byProgramme >= 3, `Almeno tre gruppi decidono dal programma del partito (${byProgramme}).`);
  assert.equal(St.referendumTheme(ref, s), 'immigrazione', 'Il tema della legge è quello del programma.');
  // the two extremes of the axis do not take the same side on immigration
  const groups = s.parliament.chambers.camera.groups.filter(g => stances.basis[g.groupId] === 'programma');
  const axisOf = g => s.world.parties.find(p => p.id === g.partyId)?.axis;
  const left = groups.filter(g => axisOf(g) <= -1), right = groups.filter(g => axisOf(g) >= 2);
  if (left.length && right.length) {
    const side = g => stances.si.includes(g.groupId) ? 'si' : stances.no.includes(g.groupId) ? 'no' : 'free';
    assert.notDeepEqual(new Set(left.map(side)), new Set(right.map(side)), 'Sinistra e destra non fanno la stessa scelta sulla stessa legge.');
  }
  assert.equal(St.referendumTheme({ kind: 'costituzionale', title: 'Riforma dell’ordinamento giudiziario' }, s), 'sicurezza');
  assert.equal(St.referendumTheme({ kind: 'costituzionale', title: 'Riforma del bicameralismo' }, s), 'istituzioni');
}
// ---------- (3) the revision reaches the confirmatory referendum, in the game ----------
{
  const s = store.getState();
  const date = s.clock.currentDate;
  s.game.referendums = [{ id: 'riforma-cat', kind: 'costituzionale', title: 'Riforma del bicameralismo', status: 'in-corso', phase: 'prima', createdAt: date, side: null, deliberations: [], councils: { required: 5, approved: [], refused: [] }, request: null, firstAt: date, source: 'simulazione', steps: [] }];
  let reached = null;
  for (let i = 0; i < 90; i++) {
    store.advance(7);
    const r = store.getState().game.referendums.find(item => item.id === 'riforma-cat');
    if (r.phase === 'richiesta' && !r.request) { try { store.requestConstitutionalReferendum('riforma-cat', 'quinto'); } catch { /* the opposition is too small: it enters into force or the opposition asks */ } }
    if (r.status !== 'in-corso') { reached = r; break; }
  }
  assert.ok(reached, 'La revisione arriva a una conclusione.');
  const phases = reached.steps.map(item => item.phase);
  assert.ok(phases.includes('pausa') || reached.status === 'respinta', 'Passa per la prima deliberazione e l’intervallo di tre mesi (o decade).');
  if (reached.status === 'concluso') { assert.ok(reached.result && reached.result.quorumReached, 'Votata a referendum: nessun quorum richiesto.'); assert.ok(store.constitutionalReforms().some(item => item.id === 'riforma-cat'), 'Registrata tra le riforme costituzionali.'); }
  else assert.ok(['in-vigore', 'respinta'].includes(reached.status), `Esito senza referendum: ${reached.status}`);
}
console.log('check-referendum-effects: ok');
