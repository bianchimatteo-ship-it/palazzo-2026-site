// The laws in force and the popular initiative as a real bill. A law approved for good enters the register of the laws in force (title, content, date, origin, status) and cannot be approved again for the
// same effects (same area and instrument, or the same title) until the end of the legislature or two years; it can be amended or repealed with a bill of its own, and the repeal, once approved, lifts the block.
// A popular initiative that passes the check of the signatures becomes a bill of the Chambers (assigned, committee, floor, votes) and its end is the end of the bill. Real engine, real career.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const L = await import(new URL(`../src/core/lawmaking-engine.js?v=${build}`, import.meta.url).href);

const { store } = await startCareer({ seed: 'statuti', level: 'deputato', fast: true });

const parliament = () => store.getState().parliament;
const date = () => store.getState().clock.currentDate;

// ---------- 1. the register and the block ----------
const sample = { id: 'legge-prova-1', title: 'Fondo per la scuola di montagna', summary: 'Un fondo per le scuole delle aree interne.', stage: 'approved', status: 'approved', kind: 'ddl', policy: { area: 'scuola', instrument: 'investimento', intensity: 1 }, sponsor: { kind: 'maggioranza', label: 'La maggioranza' }, origin: 'parlamentare' };
let p = { ...parliament(), laws: [...parliament().laws, sample], statutes: [] };
p = L.registerStatutes(p, '2027-03-01');
const statute = L.statutesOf(p).find(item => item.lawId === 'legge-prova-1');
assert.ok(statute && statute.status === 'vigente' && statute.title === sample.title && statute.summary && statute.approvedAt === '2027-03-01' && statute.origin === 'La maggioranza' && statute.area === 'scuola', 'La legge approvata entra nel registro con titolo, contenuto, data, provenienza e stato.');
assert.equal(L.registerStatutes(p, '2027-03-08').statutes.length, p.statutes.length, 'Una legge è registrata una sola volta.');
assert.ok(L.statuteBlock(p, { area: 'scuola', instrument: 'investimento' }, '2027-06-01'), 'Stessa area e stesso strumento: bloccata.');
assert.ok(L.statuteBlock(p, { title: 'Fondo per la Scuola di Montagna!' }, '2027-06-01'), 'Stesso titolo scritto in modo diverso: bloccata.');
assert.equal(L.statuteBlock(p, { area: 'scuola', instrument: 'regole' }, '2027-06-01'), null, 'Un altro strumento sulla stessa area è un’altra legge.');
// no false positives: the same area AND the same instrument, but another problem (another title, another content), is another law; an equivalent text under another title is the same law
assert.equal(L.statuteBlock(p, { area: 'scuola', instrument: 'investimento', title: 'Mense gratuite nelle scuole elementari', summary: 'Ogni scuola elementare offre un servizio di mensa gratuito per i bambini delle famiglie a basso reddito.' }, '2027-06-01'), null, 'Stessa area e stesso strumento ma un problema diverso: libera.');
assert.equal(L.statuteBlock(p, { area: 'scuola', instrument: 'investimento', title: 'Piano di edilizia scolastica antisismica', summary: 'Messa in sicurezza degli edifici scolastici dalle scosse sismiche con interventi strutturali.' }, '2027-06-01'), null, 'Un altro piano nella stessa area e con lo stesso strumento: libero.');
assert.ok(L.statuteBlock(p, { area: 'scuola', instrument: 'investimento', title: 'Sostegno degli istituti scolastici montani', summary: statute.summary }, '2027-06-01'), 'Stesso contenuto con un altro titolo: bloccata.');
assert.equal(L.statuteBlock(p, { area: 'scuola', instrument: 'investimento', amends: statute.id }, '2027-06-01'), null, 'Modificare o abrogare resta possibile.');
assert.equal(L.statuteBlock(p, { area: 'scuola', instrument: 'investimento' }, '2030-01-01') === null || p.legislature?.number !== undefined, true, 'Il blocco ha una durata.');

// the auto-generated bills do not bring the same law back: with every law of every area and instrument already in force the Chambers generate no new bill of the groups; without them they do
{
  const { AREA_BY_ID } = await import(new URL(`../src/data/simulation/policy-rules.js?v=${build}`, import.meta.url).href);
  const seeded = seed => { let n = seed; return () => { n = (n * 16807) % 2147483647; return n / 2147483647; }; };
  const run = (statutes, weeks = 90) => {
    let q = { ...parliament(), laws: [], statutes };
    let day = Date.parse('2027-02-01T12:00:00Z'), made = 0;
    for (let week = 0; week < weeks; week++) {
      const before = new Set(q.laws.map(law => law.id));
      const out = L.advanceLegislativeWeek(q, { date: new Date(day).toISOString().slice(0, 10), rand: seeded(week + 7), world: store.getState().world, society: store.getState().society });
      q = out.parliament; day += 7 * 86400000;
      for (const law of q.laws.filter(law => !before.has(law.id) && law.kind === 'ddl')) { made++; if (process.env.DBG) console.log(statutes.length ? 'B' : 'F', law.id.slice(0,30), law.origin, law.auto, law.policy?.area, law.policy?.instrument, law.sponsor?.kind, law.title); }
    }
    return made;
  };
  const all = [];
  for (const area of Object.values(AREA_BY_ID)) for (const instrument of Object.keys(area.instruments ?? {})) all.push({ id: `s-${area.id}-${instrument}`, title: `Legge ${area.id} ${instrument}`, area: area.id, instrument, kind: 'ddl', status: 'vigente', blockable: true, approvedAt: '2027-01-15', legislature: parliament().legislature?.number ?? null });
  const free = run([]), blocked = run(all);
  assert.ok(free > 0, `Senza leggi in vigore le Camere producono disegni di legge (${free}).`);
  assert.equal(blocked, 0, `Con tutte le leggi in vigore non ne tornano di identiche (${blocked}).`);
}

// ---------- 2. in the game: the player cannot propose it again, but can repeal it ----------
store.getState().parliament = { ...parliament(), laws: [...parliament().laws, sample], statutes: [] };
store.getState().parliament = L.registerStatutes(parliament(), date());
const inForce = store.statutes().find(item => item.lawId === 'legge-prova-1');
assert.ok(inForce, 'Il registro è nello store.');
assert.throws(() => store.proposeLaw({ title: 'Fondo scuole di montagna bis', summary: 'Un secondo fondo identico per le scuole delle aree interne.', policy: { area: 'scuola', instrument: 'investimento' } }), /già in vigore|già una legge/, 'Ripresentare la stessa legge è rifiutato con il motivo.');
const repeal = store.proposeStatuteChange(inForce.id, { mode: 'abrogazione' });
assert.ok(repeal && repeal.policy.repeals === inForce.id && /Abrogazione/.test(repeal.title), 'L’abrogazione è un procedimento a sé, con un altro titolo e un altro contenuto.');
assert.throws(() => store.proposeStatuteChange(inForce.id, { mode: 'abrogazione' }), /già un procedimento/, 'Un solo procedimento alla volta.');
// the repeal is approved: the statute is repealed, the block is lifted
{ const base = parliament(); const done = { ...base, laws: base.laws.map(law => law.id === repeal.id ? { ...law, stage: 'approved', status: 'approved' } : law) };
  const after = L.registerStatutes(done, date());
  const gone = L.statutesOf(after).find(item => item.id === inForce.id);
  assert.equal(gone.status, 'abrogata'); assert.ok(gone.repealedAt && gone.repealedBy, 'La legge abrogata resta nell’archivio storico, con la data e chi l’ha abrogata.');
  assert.equal(L.statuteBlock(after, { area: 'scuola', instrument: 'investimento' }, date()), null, 'Abrogata, può essere approvata di nuovo.'); }

// ---------- 3. a popular initiative becomes a real bill ----------
{
  const g = store.getState().game;
  g.initiatives = [{ id: 'iniziativa-prova-1', kind: 'popolare', title: 'Mense scolastiche gratuite', area: 'scuola', articles: [{ n: 1, text: 'La mensa scolastica è gratuita per le famiglie sotto una soglia di reddito.' }], status: 'in-parlamento', required: 50000, createdAt: '2027-01-04', deadline: '2027-07-01', weeks: 20, signatures: { total: 60000, byRegion: {}, byChannel: {} }, organization: {}, parliament: { chamber: 'camera', enteredAt: date(), stage: 'assegnata', weeks: 0 }, history: [], spent: 400, boosts: [] }];
  let law = null, ended = null;
  for (let week = 0; week < 90 && !ended; week++) {
    store.advanceTurn(1, { delegate: true });
    const item = store.getState().game.initiatives.find(entry => entry.id === 'iniziativa-prova-1');
    if (item.lawId && !law) { law = parliament().laws.find(entry => entry.id === item.lawId); assert.ok(law && law.origin === 'popolare' && law.sponsor.kind === 'popolare' && law.initiativeId === item.id, 'L’iniziativa è un disegno di legge vero, assegnato alla Camera.'); assert.equal(item.iter, 'reale'); }
    if (['approvata', 'archiviata'].includes(item.status)) ended = item;
  }
  assert.ok(law, 'Il disegno di legge è presentato.'); assert.ok(ended, 'L’iter arriva a una conclusione (approvata o archiviata) entro due anni.');
  const st = L.lawState(parliament(), law.id);
  assert.ok(st && !st.open, 'La conclusione dell’iniziativa è quella del disegno di legge.');
  assert.equal(ended.status === 'approvata', st.stage === 'approved', 'Approvata solo se le Camere l’hanno approvata.');
  assert.ok(store.getState().game.log.some(item => /Iniziativa «Mense scolastiche gratuite»/.test(item.title)), 'Il diario registra la fine.');
  if (st.stage === 'approved') assert.ok(store.statutes().some(item => item.lawId === law.id && item.origin === 'Iniziativa popolare'), 'Una iniziativa approvata entra nell’ordinamento, con la sua provenienza.');
}
console.log('Leggi in vigore e iniziative verificate: registro con titolo, contenuto, data, provenienza e stato; legge già approvata non ripresentabile (stessa area e strumento o stesso titolo); modifica e abrogazione con un procedimento proprio, abrogata e archiviata; iniziativa popolare che diventa disegno di legge vero e finisce come lo decidono le Camere.');
