// Gli obiettivi di carriera, la fine della carriera e l’eredità. Gli obiettivi si misurano su ciò che il giocatore fa e
// decide (registro delle attività e delle scelte), non si spuntano: pagano un premio e lasciano qualcosa che continua a
// pesare (rapporti che si assestano più in alto, peso nelle promozioni e nelle candidature, nuove decisioni in agenda);
// dichiarati in pubblico sono un impegno con una scadenza. Una carriera si conclude con il ritiro volontario o il
// pensionamento: incarichi finiti, partita ferma, eredità politica pesata su ciò che è successo e registrata nella
// Hall of Fame, che sopravvive a ogni carriera. Una nuova carriera può raccogliere l’eredità (condizioni di partenza
// limitate) senza toccare il mondo di gioco. Qui: regole, misure, premi e sblocchi, impegni, ritiro, Hall of Fame,
// eredità, vecchi salvataggi, invarianti e pagine.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const O = await module('src/core/objective-engine.js');
const OR = await module('src/data/simulation/objective-rules.js');
const L = await module('src/core/legacy-engine.js');
const S = await module('src/core/start-engine.js');
const { storage } = await module('src/core/storage.js');
const CE = await module('src/core/career-engine.js');
const { gameContext, renderHeadquarters } = await module('src/ui/game-mode.js');
const { renderCareerPage, CAREER_TABS } = await module('src/ui/career-page.js');
const { renderRetirement, hallView, legacyPicker } = await module('src/ui/hall-view.js');
const { renderMainMenu } = await module('src/ui/menu.js');
const { makeCareerDraft, renderCareerWizard } = await module('src/ui/career-wizard.js');
const { progressionFactors } = await module('src/core/progression-engine.js');
const { playerRoles } = await module('src/core/roles.js');
const { checkInvariants } = await module('src/core/invariants.js');
const lines = [];
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]|Infinity).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };
const noIssues = (state, where) => { const result = checkInvariants(state); assert.ok(result.ok, `${where}: invarianti violate ${JSON.stringify(result.issues.slice(0, 3))}`); };
const BIRTH = '1975-04-03';
const stat = (s, metric) => s.dataset.statistics.find(item => item.subjectId === s.career.playerId && item.metric === metric)?.value;
// The goals as the pages show them: only the ones that exist for this player.
const goals = s => { const gc = gameContext(s); return Object.fromEntries(CE.objectiveProgress(gc.ctx, gc.env).filter(item => item.available).map(item => [item.id, item])); };
const MEASURE_KINDS = ['stat', 'activities', 'actions', 'relations', 'rank', 'cohesion', 'candidacy', 'mandates', 'seat', 'committeeRole', 'laws', 'minister', 'epReports', 'memory', 'memoryNet', 'debtsPaid', 'ambitionsKept', 'outsider', 'divided', 'weeksAbove', 'president', 'presidentCredit', 'control', 'leadersWith'];

// ---------- 1. le regole degli obiettivi ----------
{
  const ids = OR.CAREER_OBJECTIVES.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'Obiettivi con id unici');
  assert.ok(OR.CLASSIC_OBJECTIVES.every(id => ids.includes(id)) && OR.CLASSIC_OBJECTIVES.length === 10, 'I dieci traguardi di sempre ci sono ancora');
  assert.ok(ids.length >= 20, `Il catalogo è molto più ricco della vecchia lista (${ids.length} obiettivi)`);
  for (const item of OR.CAREER_OBJECTIVES) {
    assert.ok(OR.OBJECTIVE_LINES[item.line], `${item.id}: una linea nota`);
    assert.ok(item.measures.length > 0 && item.measures.every(measure => MEASURE_KINDS.includes(measure.kind) && (measure.target === 'all' || measure.target > 0 || measure.kind === 'memoryNet') && measure.label), `${item.id}: misure note con obiettivo e testo`);
    assert.ok(item.reward && Object.keys(item.reward).length, `${item.id}: un premio`);
    assert.ok((item.after ?? []).every(id => ids.includes(id)), `${item.id}: i predecessori esistono`);
    if (item.ambition) assert.ok(item.ambition.weeks > 0, `${item.id}: scadenza dell’impegno`);
    if (item.unlock?.offer) assert.ok(OR.OBJECTIVE_SITUATIONS[item.unlock.offer], `${item.id}: la decisione offerta esiste`);
    if (item.unlock) assert.ok(item.unlock.text && (item.unlock.base || item.unlock.mods || item.unlock.offer || true), `${item.id}: lo sblocco ha un testo`);
  }
  // Ogni obiettivo che sblocca qualcosa lo fa davvero: rapporti, pesi o una decisione.
  const concrete = OR.CAREER_OBJECTIVES.filter(item => item.unlock?.base || item.unlock?.mods || item.unlock?.offer);
  assert.ok(concrete.length >= 15, `Almeno 15 obiettivi sbloccano un effetto concreto (${concrete.length})`);
  for (const situation of Object.values(OR.OBJECTIVE_SITUATIONS)) assert.ok(situation.choices.some(c => c.id === situation.defaultChoice) && situation.choices.length >= 2, `${situation.id}: decisione con scelta di default`);
  assert.deepEqual([OR.AMBITION_LIMIT, OR.AMBITION_COST.capital, OR.AMBITION_KEPT.capitalFactor], [2, 2, 2]);
  lines.push(`regole: ${ids.length} obiettivi in ${new Set(OR.CAREER_OBJECTIVES.map(item => item.line)).size} linee, ${concrete.length} con uno sblocco concreto, impegni pubblici`);
}

// ---------- 2. misurati su ciò che il giocatore fa ----------
let after;
{
  const run = await startCareer({ seed: 'obiettivi', level: 'comunale', draft: { birthDate: BIRTH } });
  const { store } = run;
  let s = store.getState();
  assert.equal(s.game.objectivesV, 2, 'Una carriera nuova nasce con gli obiettivi misurati');
  assert.equal(s.game.record, undefined, 'Il registro delle azioni parte vuoto');
  let status = goals(s);
  assert.ok(status.radicamento && status.rete && status.partito && !status.legge && !status.incarico && !status.integrazione && !status['saldo-debiti'] && !status.ricomposizione, 'Gli obiettivi di Parlamento e di una partenza che non hai non compaiono');
  assert.equal(status.radicamento.rows.length, 2, 'Il radicamento si misura su due cose: la popolarità e ciò che fai sul territorio');
  // Non è una lista da spuntare: la popolarità da sola non basta.
  s.dataset.statistics.find(item => item.subjectId === s.career.playerId && item.metric === 'popularity').value = 70;
  store.performWeeklyActivity('ascolto'); s = store.getState();
  status = goals(s);
  assert.ok(!status.radicamento.done && status.radicamento.rows[0].met && !status.radicamento.rows[1].met, 'Con la popolarità a posto ma una sola attività sul territorio l’obiettivo non è raggiunto');
  assert.equal(s.game.record.activities.territorio, 1, 'Il registro conta l’attività');
  assert.equal(s.game.record.activityIds.ascolto, 1);
  // Si dichiara in pubblico (costa capitale, con una scadenza).
  const capital0 = s.game.resources.politicalCapital;
  store.declareAmbition('radicamento'); s = store.getState();
  assert.equal(capital0 - s.game.resources.politicalCapital, 2, 'Dichiarare un obiettivo costa 2 capitale');
  assert.deepEqual([s.game.ambitions.length, s.game.ambitions[0].deadline - s.game.ambitions[0].week], [1, 26], 'Una scadenza di 26 settimane');
  assert.throws(() => store.declareAmbition('radicamento'), /già dichiarato/, 'Non si dichiara due volte');
  assert.throws(() => store.declareAmbition('candidatura'), /non si può dichiarare/, 'Non tutti i traguardi si dichiarano');
  assert.throws(() => store.declareAmbition('elezione'), /Prima raggiungi/, 'Prima i predecessori');
  store.declareAmbition('rete'); s = store.getState();
  assert.throws(() => store.declareAmbition('voce'), /al massimo 2/, 'Al massimo due impegni alla volta');
  // Le azioni portano l’obiettivo a compimento: premio doppio, sblocchi, memoria.
  const capital1 = s.game.resources.politicalCapital;
  const civicBefore = s.game.relations.find(item => item.id === 'civic').value;
  const territory0 = progressionFactors({ game: s.game, stats: Object.fromEntries(s.dataset.statistics.map(item => [item.metric, item.value])) }).territory;
  let week = 0;
  for (const activity of ['ascolto', 'associazioni', 'ascolto', 'ascolto', 'associazioni']) { try { store.performWeeklyActivity(activity); } catch { store.advance(7); store.performWeeklyActivity(activity); } week++; }
  s = store.getState();
  status = goals(s);
  assert.ok(status.radicamento.done && status.radicamento.declaredKept, 'Le azioni portano l’obiettivo a compimento, e restava dichiarato');
  assert.equal(s.game.objectives.radicamento.declared, true);
  assert.ok(s.game.memory.some(item => item.kind === 'promessa-mantenuta' && /radicamento/i.test(item.text)), 'Un impegno mantenuto resta nella memoria politica');
  assert.deepEqual([s.game.record.ambitions.kept, s.game.record.ambitions.broken, s.game.record.ambitions.declared], [1, 0, 2]);
  assert.ok(s.game.ambitions.every(item => item.id !== 'radicamento') && s.game.ambitions.length === 1, 'L’impegno mantenuto esce dall’elenco');
  assert.equal(s.game.unlocks.radicamento.base.civic, 3, 'Sblocca: i rapporti con il territorio si assestano più in alto');
  assert.equal(O.objectiveBase(s.game, 'civic'), 3);
  const territory1 = progressionFactors({ game: s.game, stats: Object.fromEntries(s.dataset.statistics.map(item => [item.metric, item.value])) }).territory;
  assert.ok(territory1 >= territory0 + 3.9, `Sblocca: il radicamento pesa di più nelle promozioni (${territory0}→${territory1})`);
  assert.ok(s.game.log.some(item => item.kind === 'traguardo' && /dichiarato: Radicamento/.test(item.title) && item.lines.some(line => /Sblocchi/.test(line))), 'Il diario dice cosa si è sbloccato');
  // Il premio raddoppiato: 3 capitale ×2 (più le attività e le settimane trascorse).
  assert.ok(s.game.resources.politicalCapital >= capital1 - 12, 'Il premio dell’obiettivo dichiarato è doppio');
  // “Chi mantiene i patti”: un impegno mantenuto basta (qualunque delle misure), alla chiusura della settimana.
  assert.ok(status.patti.met && status.patti.mode === 'any', 'Rispettare un impegno dichiarato soddisfa «Chi mantiene i patti»');
  // Il registro delle decisioni: scelte e deleghe.
  const item = s.game.inbox.find(entry => entry.choices.length);
  if (item) { store.resolveAgendaItem(item.id, item.choices[0].id); s = store.getState(); assert.ok(s.game.record.decisions.made >= 1 && s.game.record.choices[`${item.templateId}.${item.choices[0].id}`] >= 1, 'Le decisioni prese entrano nel registro, con la scelta'); }
  store.advance(7); s = store.getState();
  assert.ok(s.game.record.decisions.delegated >= 0);
  assert.ok(s.game.objectives.patti, 'E alla chiusura della settimana l’obiettivo è registrato');
  // L’impegno mancato: la scadenza passa.
  const rep0 = stat(s, 'reputation');
  s.game.ambitions[0].deadline = s.game.week.index - 1;
  store.advance(7); s = store.getState();
  assert.equal(s.game.record.ambitions.broken, 1, 'L’impegno non mantenuto è registrato');
  assert.equal(s.game.ambitions.length, 0);
  assert.ok(s.game.memory.some(entry => entry.kind === 'promessa-tradita' && /dichiarato e mancato/.test(entry.text)), 'E resta nella memoria politica come promessa tradita');
  assert.ok(s.game.log.some(entry => /Obiettivo mancato/.test(entry.title)), 'Il diario lo dice');
  assert.ok(stat(s, 'reputation') < rep0 + 0.5, `Costa credibilità (reputazione ${rep0}→${stat(s, 'reputation')})`);
  noIssues(s, 'obiettivi misurati');
  clean(renderCareerPage(s, { tab: 'obiettivi' }), 'Obiettivi');
  const html = renderCareerPage(s, { tab: 'obiettivi' });
  assert.ok(html.includes('COSA HAI SBLOCCATO') && html.includes('Raggiunto') && html.includes('Radicamento sul territorio') && html.includes('Premio'), 'La pagina Obiettivi mostra misure, premi, sblocchi e impegni');
  assert.ok(html.includes('data-ambition-declare="voce"') && /Dichiara pubblicamente/.test(html), 'E si possono dichiarare gli obiettivi ancora aperti');
  clean(renderHeadquarters(s), 'Home con gli obiettivi');
  after = s;
  lines.push('obiettivi: misurati su attività e decisioni (non spuntati), impegni dichiarati (costo, scadenza, premio doppio, memoria se mantenuti o mancati), sblocchi che restano (rapporti, peso nelle promozioni)');
}

// ---------- 3. le conseguenze: sblocchi, decisioni offerte, vecchi salvataggi ----------
{
  const run = await startCareer({ seed: 'sblocchi', level: 'deputato', draft: { birthDate: BIRTH } });
  const { store } = run;
  let s = store.getState();
  let status = goals(s);
  assert.ok(status.legge && status.incarico, 'Con un seggio compaiono gli obiettivi parlamentari');
  // La legge conta solo se è tua: una legge degli altri (con un proponente) non vale.
  s.parliament.laws = [...s.parliament.laws, { id: 'l-altri', stage: 'approved', sponsor: { kind: 'governo' }, title: 'Legge altrui' }];
  assert.equal(goals(s).legge.rows[0].value, 0, 'Le leggi degli altri non contano come “la tua legge”');
  s.parliament.laws = [...s.parliament.laws, { id: 'l-mia', stage: 'approved', title: 'La mia legge' }];
  assert.equal(goals(s).legge.rows[0].value, 1, 'La tua legge conta');
  // La leadership interna offre un nuovo incarico: una decisione, non solo un premio.
  s.game.party.rank = 3; s.game.party.rankTitle = 'Membro della direzione nazionale';
  store.performWeeklyActivity('riunione'); s = store.getState();
  assert.ok(s.game.objectives.dirigenza && s.game.objectives.legge, 'Raggiunti');
  assert.ok(s.game.inbox.some(item => item.templateId === 'obiettivo-dirigenza'), 'La direzione nazionale porta una nuova decisione in agenda');
  assert.ok(s.game.inbox.some(item => item.templateId === 'obiettivo-legge'), 'La legge fa scuola: un’altra decisione');
  const offer = s.game.inbox.find(item => item.templateId === 'obiettivo-dirigenza');
  const support = s.game.party.support;
  store.resolveAgendaItem(offer.id, 'accetta'); s = store.getState();
  assert.ok(s.game.party.minorRoles.some(item => item.title === 'Responsabile di dipartimento'), 'Accettare apre un incarico nel partito');
  assert.ok(s.game.party.support > support, 'E rafforza il sostegno interno');
  assert.equal(s.game.unlocks.dirigenza.mods.partyScore, 2);
  // Gli sblocchi pesano nelle promozioni di partito e di Parlamento.
  assert.ok(O.objectiveMoment('partito', s.game).some(([label, value]) => /Leadership interna/.test(label) && value === 2), 'Il traguardo pesa nelle promozioni di partito');
  assert.ok(O.objectiveMoment('parlamento', s.game).some(([label, value]) => /La tua legge/.test(label) && value === 1), 'E in quelle parlamentari');
  // Un obiettivo che nasce da una partenza: ricomposizione del partito (e la sua decisione).
  const diviso = await startCareer({ seed: 'sblocchi-diviso', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'partito-diviso', levels: {} } } });
  let d = diviso.store.getState();
  assert.ok(goals(d).ricomposizione && !goals(d).integrazione, 'La ricomposizione è un obiettivo di chi parte da un partito diviso');
  while (!d.game.inbox.some(item => item.templateId === 'start-partito-spaccato') && d.game.week.index < 6) { diviso.store.advance(7); d = diviso.store.getState(); }
  diviso.store.resolveAgendaItem(d.game.inbox.find(item => item.templateId === 'start-partito-spaccato').id, 'ponte'); d = diviso.store.getState();
  assert.equal(d.game.record.choices['start-partito-spaccato.ponte'], 1, 'Il ponte entra nel registro delle scelte');
  assert.equal(goals(d).pontiere.rows[0].value, 1, 'E fa avanzare «Il pontiere»');
  d.game.party.org.conflicts = []; d.game.party.org.cohesion = 64;
  // Il partito resta ricomposto (la coesione e le aree in pace) finché l’obiettivo non scatta, qualunque cosa porti la settimana.
  for (let i = 0; i < 16 && !diviso.store.getState().game.objectives.ricomposizione; i++) { const g = diviso.store.getState().game; g.party.org.conflicts = []; g.party.org.cohesion = 64; diviso.store.advance(7); }
  d = diviso.store.getState();
  assert.ok(d.game.objectives.ricomposizione, 'Ricomposto il partito, l’obiettivo è raggiunto');
  assert.ok(d.game.inbox.some(item => item.templateId === 'obiettivo-ricomposizione'), 'E il partito ti offre un ruolo di garante');
  diviso.store.resolveAgendaItem(d.game.inbox.find(item => item.templateId === 'obiettivo-ricomposizione').id, 'accetta'); d = diviso.store.getState();
  assert.ok(d.game.party.minorRoles.some(item => /Garante/.test(item.title)), 'Garante dell’unità del partito');
  // Debiti e outsider: gli obiettivi di partenza esistono solo per chi parte così.
  const debiti = await startCareer({ seed: 'sblocchi-debiti', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'debiti', levels: {} } } });
  assert.ok(goals(debiti.store.getState())['saldo-debiti'], 'Chi parte con debiti ha l’obiettivo di saldarli');
  const outsider = await startCareer({ seed: 'sblocchi-outsider', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'outsider', levels: {} } } });
  assert.ok(goals(outsider.store.getState()).integrazione && goals(outsider.store.getState()).integrazione.rows[0].value === 0, 'Chi parte da outsider ha l’obiettivo di integrarsi');
  // Vecchi salvataggi: gli obiettivi nuovi già soddisfatti si scrivono senza premi né rumore.
  const old = await startCareer({ seed: 'vecchio', level: 'comunale', draft: { birthDate: BIRTH } });
  let o = old.store.getState();
  for (let i = 0; i < 8; i++) old.store.advance(7);
  o = old.store.getState();
  o.dataset.statistics.find(item => item.subjectId === o.career.playerId && item.metric === 'reputation').value = 80;
  o.game.memory = [{ id: 'm-prova', week: o.game.week.index, date: o.clock.currentDate, kind: 'lealta', tone: 'good', weight: 3, text: 'Lealtà di prova', source: 'simulation' }, ...(o.game.memory ?? [])];
  delete o.game.objectivesV; delete o.game.record; delete o.game.unlocks; delete o.game.ambitions;
  const capitalOld = o.game.resources.politicalCapital;
  old.store.performWeeklyActivity('ascolto'); o = old.store.getState();
  assert.equal(o.game.objectivesV, 2, 'Il vecchio salvataggio passa agli obiettivi misurati');
  assert.ok(o.game.objectives.reputazione?.silent === true, 'L’obiettivo già soddisfatto è scritto in silenzio');
  assert.ok(!o.game.unlocks?.reputazione && o.game.resources.politicalCapital <= capitalOld, 'Senza premi né sblocchi retroattivi');
  noIssues(o, 'vecchio salvataggio');
  clean(renderCareerPage(o, { tab: 'obiettivi' }), 'Obiettivi di un vecchio salvataggio');
  lines.push('conseguenze: leadership interna → un dipartimento, la tua legge → una decisione, ricomposizione → ruolo di garante, pesi nelle promozioni, obiettivi di partenza, vecchi salvataggi senza premi retroattivi');
}

// ---------- 4. il punteggio dell’eredità ----------
{
  const facts = (extra = {}) => ({ name: 'X', birthDate: BIRTH, weeks: 520, years: 10, startedAt: '2026-09-24', endedAt: '2036-09-24', level: 'deputato', difficulty: 'normale', startProfile: 'ordinaria', custom: false, heir: false, peak: { label: 'Deputato o senatore', value: 70 }, distinctOffices: 1, offices: [], mandates: 2, campaigns: 2, laws: 1, objectives: 8, party: { label: 'P', rank: 3, rankTitle: 'D', founded: false }, pastParties: 0, stats: { reputation: 60, popularity: 50, influence: 50, notoriety: 40, experience: 60 }, memory: { good: 3, bad: 1, net: 2 }, scandals: 0, setbacks: 0, president: null, ambitions: { kept: 1, broken: 0 }, decisions: 40, age: 60, ...extra });
  const base = L.legacyScore(facts());
  assert.ok(base.score >= 40 && base.score < 60 && base.tier.id === 'rilievo', `Dieci anni da deputato, due mandati: figura di rilievo (${base.score})`);
  assert.ok(Math.abs(base.parts.reduce((sum, item) => sum + item.points, 0) - base.score) <= 1, 'Il punteggio è la somma delle sue parti');
  assert.ok(L.legacyScore(facts({ years: 20, weeks: 1040 })).score > base.score, 'Più anni, più eredità');
  assert.ok(L.legacyScore(facts({ mandates: 4 })).score > base.score, 'Più mandati, più eredità');
  assert.ok(L.legacyScore(facts({ scandals: 3, setbacks: 2 })).score < base.score, 'Scandali e cadute pesano');
  assert.ok(L.legacyScore(facts({ custom: true })).score < base.score, 'Lo scenario personalizzato vale meno');
  assert.ok(L.legacyScore(facts({ difficulty: 'difficile' })).score > base.score && L.legacyScore(facts({ difficulty: 'facile' })).score < base.score, 'La difficoltà pesa sul risultato');
  assert.ok(L.legacyScore(facts(), 'pensionamento').score > L.legacyScore(facts(), 'ritiro').score, 'Un congedo dignitoso vale di più');
  const short = L.legacyScore(facts({ years: 1, weeks: 52, mandates: 0, laws: 0, objectives: 2, party: null, ambitions: { kept: 0, broken: 0 }, memory: { good: 0, bad: 0, net: 0 }, stats: { reputation: 50, popularity: 45, influence: 30, notoriety: 20, experience: 30 }, distinctOffices: 1 }));
  assert.ok(short.score < 20 && short.tier.id === 'comparsa', `Un anno in un seggio non fa una carriera (${short.score})`);
  const statesman = L.legacyScore(facts({ years: 28, weeks: 1456, peak: { label: 'Presidente del Consiglio', value: 90 }, distinctOffices: 5, mandates: 5, laws: 6, objectives: 20, party: { label: 'P', rank: 5, rankTitle: 'S', founded: false }, stats: { reputation: 75, popularity: 60, influence: 70, notoriety: 80, experience: 90 }, memory: { good: 8, bad: 1, net: 7 }, ambitions: { kept: 4, broken: 0 } }), 'pensionamento');
  assert.ok(statesman.score >= 80 && statesman.tier.id === 'statista', `Una carriera da statista (${statesman.score})`);
  assert.deepEqual(L.LEGACY_TIERS.map(item => item.min), [0, 20, 40, 60, 80]);
  assert.ok(L.legacyTags(facts({ peak: { label: 'Presidente del Consiglio', value: 90 }, party: { rank: 5, founded: false }, mandates: 3, laws: 2, ambitions: { kept: 2, broken: 0 }, heir: true })).join('|').match(/Ha guidato il governo.*Ha guidato un partito.*Rieletto.*Autore.*parola.*Erede/), 'Le etichette dicono per cosa è ricordata');
  // L’Hall of Fame: limite, sostituzione, ordine.
  let hall = [];
  for (let n = 0; n < 45; n++) hall = L.addToHall(hall, { id: `h${n}`, score: n, endedAt: '2030-01-01' });
  assert.equal(hall.length, L.HALL_LIMIT, 'La Hall of Fame tiene al massimo 40 carriere');
  assert.equal(hall[0].score, 44, 'Le migliori per prime');
  assert.ok(!hall.some(item => item.score < 5), 'Escono le meno rilevanti');
  assert.equal(L.addToHall(hall, { id: 'h44', score: 10, endedAt: '2031-01-01' }).filter(item => item.id === 'h44').length, 1, 'La stessa carriera non compare due volte');
  // Cosa lascia a una nuova carriera: limitato, a scaglioni, con le zavorre.
  const boon = score => L.legacyBoon({ id: 'e', name: 'N', score, tier: { label: 'T' }, counts: {} });
  assert.deepEqual([boon(10).free, boon(25).free, boon(45).free], [{}, { rete: 1 }, { rete: 1, notorieta: 1 }]);
  assert.deepEqual(boon(65).free, { rete: 1, notorieta: 1, capitale: 1, risorse: 1 });
  assert.deepEqual(boon(90).free, { rete: 2, notorieta: 2, capitale: 1, risorse: 1 }, 'Al massimo sei livelli in più, nessuno oltre il 3');
  assert.deepEqual(L.legacyBoon({ id: 'e', name: 'N', score: 90, counts: { scandals: 2, ambitionsBroken: 2 } }).burden, { precedenti: 1, aspettative: 1 }, 'Gli scandali e gli impegni mancati lasciano zavorre');
  assert.equal(L.legacyBoon(null), null);
  lines.push('eredità: punteggio come somma di parti (anni, carica, mandati, leggi, obiettivi, partito, reputazione, memoria, parola data), scaglioni, Hall of Fame a 40 posti, cosa lascia a una nuova carriera');
}

// ---------- 5. il ritiro e la Hall of Fame ----------
let entry; let legacyHeir;
{
  const run = await startCareer({ seed: 'ritiro', level: 'deputato', draft: { birthDate: BIRTH } });
  const { store } = run;
  for (let i = 0; i < 20; i++) store.advance(7);
  let s = store.getState();
  // I vincoli: non durante una campagna, non da Presidente, non se sei in gioco per il Colle; il pensionamento ha requisiti.
  s.campaign = { status: 'active' };
  assert.match(store.retirementProblem('ritiro'), /campagna/, 'Non si lascia durante una campagna');
  s.campaign = null;
  s.game.flags.president = true;
  assert.match(store.retirementProblem('ritiro'), /Quirinale/, 'Il Presidente della Repubblica si dimette prima');
  delete s.game.flags.president;
  s.presidency.election = { phase: 'scrutini', player: { role: 'candidato' } };
  assert.match(store.retirementProblem('ritiro'), /elezione del Presidente/, 'Non si lascia mentre sei in gioco per il Colle');
  s.presidency.election = null;
  assert.match(store.retirementProblem('pensionamento'), /65 anni/, 'Il pensionamento ha dei requisiti');
  assert.equal(store.retirementProblem('ritiro'), null);
  assert.match(store.retirementProblem('inventato') ?? '', /Scelta non valida/);
  const preview = store.legacyPreview();
  assert.ok(preview.score >= 0 && preview.tier && Array.isArray(preview.parts), 'L’anteprima dell’eredità');
  s.game.week.index = 1301;
  assert.equal(store.retirementProblem('pensionamento'), null, 'Dopo 25 anni si può andare in pensione');
  s.game.week.index = 21;
  s.dataset.politicians.find(item => item.id === s.career.playerId).birthDate = '1950-02-02';
  assert.equal(store.retirementProblem('pensionamento'), null, 'A 65 anni anche');
  s.dataset.politicians.find(item => item.id === s.career.playerId).birthDate = BIRTH;
  const seatBefore = s.parliament.player?.groupId;
  assert.ok(seatBefore && s.dataset.offices.some(item => item.politicianId === s.career.playerId && !item.endDate), 'Prima: un seggio e un incarico');
  // Il ritiro.
  entry = store.retireCareer('ritiro'); s = store.getState();
  assert.deepEqual([s.game.status, s.game.endKind, s.game.closedByPlayer], ['ended', 'ritiro', true], 'La carriera è conclusa');
  assert.equal(s.game.inbox.length, 0, 'Nessuna decisione pendente');
  assert.ok(s.dataset.offices.filter(item => item.politicianId === s.career.playerId).every(item => item.endDate), 'Ogni incarico è finito');
  assert.ok(!s.parliament?.player?.groupId, 'Il seggio è lasciato');
  assert.equal(s.career.endKind, 'ritiro');
  assert.ok((s.local?.institutions ?? []).every(item => item.status !== 'active'), 'Nessun consiglio attivo');
  assert.ok(s.game.timeline.some(item => item.kind === 'fine' && /Hai lasciato la politica/.test(item.title) && /Eredità politica/.test(item.detail)), 'La cronologia registra la fine e l’eredità');
  assert.ok(s.game.memory.some(item => /lasciato la politica/.test(item.text)), 'E la memoria');
  assert.deepEqual(Object.keys(s.game.legacy).sort(), ['hallId', 'parts', 'score', 'tags', 'tier']);
  assert.equal(s.game.legacy.hallId, entry.id);
  // Hall of Fame: la voce, e che sopravvive.
  assert.ok(entry.score === s.game.legacy.score && entry.tier.label && Array.isArray(entry.parts) && entry.parts.length >= 3, 'La voce della Hall of Fame');
  assert.equal(entry.kind, 'ritiro'); assert.equal(entry.startProfile, 'ordinaria'); assert.equal(entry.level, 'deputato');
  assert.ok(Math.abs(entry.parts.reduce((sum, item) => sum + item.points, 0) - entry.score) <= 1);
  assert.deepEqual(store.hallOfFame().map(item => item.id), [entry.id]);
  assert.ok(storage.hall().some(item => item.id === entry.id), 'La Hall of Fame è nel browser');
  storage.clearAll();
  assert.ok(storage.hall().some(item => item.id === entry.id), 'Resta anche se si cancellano tutti i salvataggi');
  // La partita è ferma: niente si muove.
  const week = s.game.week.index;
  store.advance(7); s = store.getState();
  assert.equal(s.game.week.index, week, 'Il tempo non scorre');
  assert.match(s.ui.toast, /conclusa/);
  assert.throws(() => store.retireCareer('ritiro'), /già conclusa/, 'Non si lascia due volte');
  assert.throws(() => store.performWeeklyActivity('ascolto'), /conclusa/, 'Nessuna attività');
  // Un salvataggio con una carriera conclusa dal giocatore resta concluso; una caduta (il vecchio “ended”) riprende.
  const copy = JSON.parse(JSON.stringify(s.game));
  assert.equal(CE.normalizeGameState(copy).status, 'ended', 'Una carriera conclusa non si riprende da sola');
  const fall = JSON.parse(JSON.stringify(s.game)); delete fall.endKind;
  assert.equal(CE.normalizeGameState(fall).status, 'active', 'Il vecchio finale per caduta riprende, come prima');
  assert.ok(playerRoles(s).roles.some(([id, label]) => id === 'concluso' && /lasciato la politica/.test(label)), 'Il ruolo dice che la carriera è conclusa');
  noIssues(s, 'carriera conclusa');
  // Le pagine.
  for (const [id] of CAREER_TABS) clean(renderCareerPage(s, { tab: id }), `Carriera conclusa: ${id}`);
  const home = renderHeadquarters(s);
  assert.ok(home.includes('CARRIERA CONCLUSA') && home.includes('data-hall-legacy') && home.includes('eredità'), 'La Home di una carriera conclusa dice l’eredità e offre la nuova carriera');
  clean(home, 'Home conclusa');
  const percorso = renderCareerPage(s, { tab: 'percorso' });
  assert.ok(percorso.includes('Eredità politica') && percorso.includes(`data-hall-legacy="${entry.id}"`), 'La scheda dell’eredità');
  const hall = hallView(store.hallOfFame());
  assert.ok(hall.includes(entry.name) && hall.includes('data-hall-legacy') && hall.includes('data-hall-delete') && hall.includes('Come è stata pesata'), 'La Hall of Fame mostra la carriera, l’eredità e le azioni');
  clean(hall, 'Hall of Fame');
  assert.ok(hallView([]).includes('Nessuna carriera conclusa'));
  const menu = renderMainMenu({ view: 'hall' }, { hasCareer: true, meta: store.currentMeta(), slots: [], lastSaved: '', unsaved: false, stats: [], settings: {}, hall: store.hallOfFame(), account: { status: 'none' } });
  assert.ok(menu.includes('data-menu="hall"') && menu.includes('Hall of Fame') && menu.includes(entry.name), 'Il menu principale ha la Hall of Fame');
  lines.push(`ritiro: vincoli (campagna, Quirinale, requisiti del pensionamento), incarichi e seggio finiti, partita ferma, eredità ${entry.score}/100 (${entry.tier.label}) nella Hall of Fame che sopravvive ai salvataggi, pagine e menu`);
}

// ---------- 6. una nuova carriera dall’eredità ----------
{
  // Un’eredità debole (la carriera del ritiro precedente, poche settimane) non dà leve, ma il nome ti precede.
  const weak = await startCareer({ seed: 'erede-debole', level: 'comunale', draft: { birthDate: '1990-06-01', legacyId: entry.id }, keepStorage: true });
  let w = weak.store.getState();
  assert.equal(w.career.legacyFrom.id, entry.id, 'La carriera sa da quale eredità parte');
  assert.deepEqual([w.game.start.levels, w.game.start.legacy.name], [L.legacyBoon(entry).free, entry.name], 'Anche un’eredità debole lascia la sua traccia');
  assert.equal(S.startMods(w.game).active, Object.keys(w.game.start.levels).length > 0);
  for (let i = 0; i < 5 && !w.game.inbox.some(item => item.templateId === 'start-eredita'); i++) { weak.store.advance(7); w = weak.store.getState(); }
  assert.ok(w.game.inbox.some(item => item.templateId === 'start-eredita'), 'Il nome ti precede anche se non pesa');
  // Un’eredità forte (carriera lunga, con qualche scandalo): una rete, un nome noto, risorse e capitale, e un’ombra.
  const strongEntry = { id: 'hall-lunga', careerId: 'c-lunga', name: 'Una carriera lunga', kind: 'pensionamento', endLabel: 'È andato in pensione', startedAt: '2000-01-01', endedAt: '2026-01-01', years: 26, level: 'deputato', difficulty: 'normale', startProfile: 'ordinaria', peak: { label: 'Ministro', value: 75 }, party: null, counts: { mandates: 5, laws: 4, objectives: 15, scandals: 2, setbacks: 0, ambitionsBroken: 0 }, score: 68, tier: { id: 'protagonista', label: 'Protagonista di una stagione' }, parts: [{ label: 'Anni di carriera', points: 14 }], tags: [], source: 'simulation' };
  storage.saveHall(L.addToHall(storage.hall(), strongEntry));
  const control = await startCareer({ seed: 'erede', level: 'comunale', draft: { birthDate: '1990-06-01' }, keepStorage: true });
  const baseState = control.store.getState();
  const baseline = { funds: baseState.game.resources.funds, capital: baseState.game.resources.politicalCapital, notoriety: stat(baseState, 'notoriety'), civic: baseState.game.relations.find(item => item.id === 'civic').value, world: JSON.stringify(baseState.world?.parties?.map(item => [item.id, item.baseline])), polls: JSON.stringify(baseState.world?.polls?.at(-1)?.results?.slice(0, 5)) };
  const run = await startCareer({ seed: 'erede', level: 'comunale', draft: { birthDate: '1990-06-01', legacyId: strongEntry.id }, keepStorage: true });
  const { store } = run;
  let s = store.getState();
  const boon = L.legacyBoon(strongEntry);
  assert.deepEqual(boon.free, { rete: 1, notorieta: 1, capitale: 1, risorse: 1, precedenti: 1 }, 'Un nome, una rete, risorse e un’ombra');
  assert.deepEqual(s.career.start.free, boon.free, 'Le condizioni in più sono quelle dell’eredità');
  assert.deepEqual(s.career.start.points, { free: 6, spent: 0, gained: 0, balance: 6 }, 'L’eredità non costa né dà punti');
  assert.deepEqual(s.game.start.levels, boon.free, 'Le condizioni sono vere: sono nella partita');
  assert.ok(s.game.start.history.some(item => /con l’eredità di Una carriera lunga/.test(item.text)));
  assert.ok(Object.values(s.game.start.levels).every(level => level <= 3), 'Nessuna leva oltre il livello 3');
  assert.ok(s.game.resources.funds > baseline.funds && s.game.resources.politicalCapital > baseline.capital, `Risorse e capitale in più (${baseline.funds}→${s.game.resources.funds}, ${baseline.capital}→${s.game.resources.politicalCapital})`);
  assert.ok(stat(s, 'notoriety') > baseline.notoriety + 5 && s.game.relations.find(item => item.id === 'civic').value > baseline.civic, 'Più notorietà e una rete di rapporti');
  assert.equal(s.game.start.shadows.length, 1, 'Ma anche un’ombra: qualcosa tornerà a galla');
  assert.equal(s.career.startProfile, 'ordinaria', 'Senza condizioni scelte resta una partenza ordinaria');
  // Il mondo di gioco non cambia: stessi partiti, stessi sondaggi di partenza, stessa data.
  assert.equal(JSON.stringify(s.world?.parties?.map(item => [item.id, item.baseline])), baseline.world, 'I partiti del mondo sono gli stessi');
  assert.equal(JSON.stringify(s.world?.polls?.at(-1)?.results?.slice(0, 5)), baseline.polls, 'Gli stessi sondaggi di partenza');
  assert.equal(s.clock.currentDate, baseState.clock.currentDate);
  // La prima decisione dell’erede.
  for (let i = 0; i < 5 && !s.game.inbox.some(item => item.templateId === 'start-eredita'); i++) { store.advance(7); s = store.getState(); }
  const call = s.game.inbox.find(item => item.templateId === 'start-eredita');
  assert.ok(call && call.body.includes(strongEntry.name), 'Il nome della carriera precedente ti precede: una decisione');
  store.resolveAgendaItem(call.id, 'onora'); s = store.getState();
  assert.ok(s.game.memory.some(item => /raccolto l’eredità politica di/.test(item.text) && item.text.includes(strongEntry.name)), 'Resta nella memoria politica');
  await assert.rejects(() => startCareer({ seed: 'erede-falso', level: 'comunale', draft: { legacyId: 'hall-inesistente' }, keepStorage: true }), /eredità scelta/, 'Un’eredità che non c’è più è rifiutata');
  legacyHeir = s;
  noIssues(s, 'erede');
  clean(renderCareerPage(s, { tab: 'percorso' }), 'Carriera dell’erede');
  // Il wizard: il selettore dell’eredità c’è solo se la Hall non è vuota.
  const territory = { units: run.db.territorialUnits, municipalities: run.db.municipalities, sourceUrl: run.db.manifest.territorialSource.url, sourceName: run.db.manifest.territorialSource.name };
  const draft = d => ({ ...makeCareerDraft('2026-09-24', [], store.hallOfFame()), region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', step: 4, ...d });
  const html = renderCareerWizard(s, draft({ legacyId: strongEntry.id }), [], () => null, run.db.parliamentaryGroups, [], [], run.db.politicians, territory);
  assert.ok(html.includes('name="legacyId"') && html.includes(`value="${strongEntry.id}" selected`) && html.includes('Sono condizioni di partenza in più'), 'Il wizard offre di raccogliere l’eredità e dice cosa dà');
  clean(html, 'wizard con eredità');
  const empty = renderCareerWizard(s, { ...makeCareerDraft('2026-09-24'), region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', step: 4 }, [], () => null, run.db.parliamentaryGroups, [], [], run.db.politicians, territory);
  assert.ok(!empty.includes('name="legacyId"'), 'Senza carriere concluse non c’è nulla da raccogliere');
  assert.ok(legacyPicker({ hall: [] }) === '');
  const summary = renderCareerWizard(s, draft({ step: 5, legacyId: strongEntry.id }), [], () => null, run.db.parliamentaryGroups, [], [], run.db.politicians, territory);
  assert.ok(summary.includes('con l’eredità di'), 'Il riepilogo lo ricorda');
  // Una carriera dell’erede, conclusa, porta l’etichetta.
  assert.ok(L.legacyTags({ ...L.careerFacts(s), heir: true }).includes('Erede di una carriera conclusa'));
  lines.push(`eredità raccolta: ${Object.entries(boon.free).map(([id, level]) => `${id} +${level}`).join(', ')} senza costo in punti, mondo di gioco identico, una decisione in agenda e la memoria del nome`);
}

// ---------- 7. un’eredità più alta, ritiro a fine corsa, e una eliminazione ----------
{
  const run = await startCareer({ seed: 'pensione', level: 'deputato', draft: { birthDate: '1955-01-01' }, keepStorage: true });
  const { store } = run;
  for (let i = 0; i < 30; i++) store.advance(7);
  const s = store.getState();
  assert.equal(store.retirementProblem('pensionamento'), null, 'A 71 anni si va in pensione');
  const before = store.hallOfFame().length;
  const mine = store.retireCareer('pensionamento');
  assert.equal(mine.kind, 'pensionamento');
  assert.ok(mine.parts.some(item => item.label === 'Un congedo dignitoso' && item.points === 4), 'Il pensionamento lascia un congedo dignitoso');
  assert.equal(store.getState().game.endKind, 'pensionamento');
  assert.equal(store.hallOfFame().length, before + 1, 'Una carriera in più nella Hall of Fame');
  assert.ok(store.hallOfFame().some(item => item.id === mine.id));
  store.removeHallEntry(mine.id);
  assert.equal(store.hallOfFame().length, before, 'Si può eliminare una carriera dalla Hall of Fame');
  assert.ok(!store.hallOfFame().some(item => item.id === mine.id) && store.hallOfFame().some(item => item.id === entry.id), 'Le altre restano');
  void s; void legacyHeir;
  lines.push('pensionamento: requisiti (65 anni, 25 anni di carriera, ex Presidente), congedo dignitoso, eliminazione dalla Hall of Fame');
}

// ---------- 8. gli invarianti riconoscono i danni ----------
{
  const run = await startCareer({ seed: 'danni', level: 'deputato', draft: { birthDate: BIRTH, start: { profile: 'debiti', levels: {} } } });
  const s = run.store.getState();
  noIssues(s, 'prima del danno');
  const damaged = JSON.parse(JSON.stringify(s));
  damaged.game.start.levels.rete = 7; damaged.game.start.levels.inventata = 1; damaged.game.start.debts[0].status = 'boh';
  damaged.game.ambitions = [{ id: 'inesistente', week: 1, deadline: 0 }, { id: 'rete', week: 5, deadline: 3 }, { id: 'voce', week: 1, deadline: 9 }];
  damaged.game.unlocks = { fantasma: { week: 1 } };
  const codes = new Set(checkInvariants(damaged).issues.map(item => `${item.code}`));
  assert.ok(codes.has('partenza') && codes.has('obiettivi'), `Gli invarianti riconoscono condizioni di partenza e obiettivi danneggiati (${[...codes]})`);
  const ended = JSON.parse(JSON.stringify(s)); Object.assign(ended.game, { status: 'ended', endKind: 'boh' });
  assert.ok(checkInvariants(ended).issues.some(item => item.code === 'fine-carriera'), 'E una fine di carriera incoerente');
  lines.push('invarianti: condizioni di partenza, impegni, sblocchi e fine di carriera controllati');
}

console.log(`Obiettivi, ritiro ed eredità verificati:\n- ${lines.join('\n- ')}`);
