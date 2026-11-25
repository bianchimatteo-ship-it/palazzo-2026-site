// The programmes of the parties on the ten themes (data/party-programs.js, core/alliance-rules.js), checked for PROVENANCE, not only for the presence of ten numbers:
//   1. every documented position has a document of the party (title, address of the party or of its official file host, kind, scope, status, how it was read) and a summary in Italian and English;
//      a theme without a stated direction is `null` with the reason, never 0; a historical, coalition or in-progress document is labelled so (never «programme 2026»);
//   2. no position is deduced from the left–right axis: a documented theme differs from the axis estimate where the source says so, and a party with no document has no documented theme;
//   3. the play: a documented theme is used as documented; a theme without documents is a SIMULATED estimate, labelled as such (programSource.simulated), and the comparison says how many themes rest on
//      documents; the player's compromises still win; a party with neither documents nor collocazione has no position;
//   4. the catalogue: all 82 records (76 parties + 6 movements) classified (national, regional, historical, movement, alias, to verify); aliases point to an existing canonical record and never carry a
//      programme of their own; the historical records of the dataset are historical; Progetto Civico Italia is a real formation with its programme in progress (not «fictitious»);
//   5. coalition programmes are separate entities, the centre-left table is «in elaborazione», no member's themes are taken from it;
//   6. the matrix and the list of the gaps (docs/qa/programmi-partiti-da-completare.md) are up to date.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const D = await load('src/data/party-programs.js');
const R = await load('src/core/alliance-rules.js');
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const movements = JSON.parse(await readFile(new URL('../src/data/real/political-movements.json', import.meta.url), 'utf8'));
const records = [...parties, ...movements];
const THEME_IDS = R.THEMES.map(theme => theme.id);
const OFFICIAL_HOSTS = /^https:\/\/(www\.)?(ilpartitocomunistaitaliano\.it|progettocivicoitalia\.it|noimoderati\.it|voltitalia\.it|piueuropa\.eu|movimento5stelle\.eu|partitodemocratico\.it|fratelli-italia\.it|legaonline\.it|static\.legaonline\.it|forzaitalia\.it|azione\.it|italiaviva\.it|europaverde\.it|sinistraitaliana\.si|partitoliberaldemocratico\.com|futuronazionale\.it|ora-italia\.it|democraziasolidale\.it|sud-chiamanord\.it)\//;
const TYPES = new Set(['tesi-congressuali', 'carta-dei-valori', 'programma-in-elaborazione', 'proposte-tematiche', 'programma-elettorale', 'programma', 'manifesto', 'consultazione', 'sintesi-programmatica', 'programma-coalizione', 'comunicazione-ufficiale', 'percorso-partecipativo', 'priorita-europee', 'base-programmatica', 'tesi-in-elaborazione', 'documento-tematico']);
const lines = [];

// 1. documents and themes
for (const [id, doc] of Object.entries(D.DOCUMENTS)) {
  assert.ok(doc.title && OFFICIAL_HOSTS.test(doc.url), `${id}: titolo e indirizzo ufficiale del partito (${doc.url})`);
  assert.ok(TYPES.has(doc.type) && doc.scope && doc.status && doc.read, `${id}: tipo, ambito, stato e modalità di lettura`);
  if (doc.type === 'programma-elettorale' || doc.type === 'programma-coalizione') assert.ok(/storico/.test(doc.status) && /20\d\d/.test(doc.date ?? doc.title), `${id}: un programma elettorale o di coalizione passato è storico e porta l’anno`);
  if (doc.type === 'programma-coalizione') assert.ok(/coalizione/.test(doc.scope), `${id}: ambito di coalizione dichiarato`);
}
let documentedThemes = 0;
for (const [id, program] of Object.entries(D.DOCUMENTED_PROGRAMS)) {
  assert.ok(records.some(record => record.id === id), `${id}: il programma appartiene a un record del catalogo`);
  assert.ok(['documentato', 'parziale', 'senza-posizioni', 'in-elaborazione'].includes(program.status), `${id}: stato del programma`);
  assert.deepEqual(Object.keys(program.themes).sort(), [...THEME_IDS].sort(), `${id}: i dieci temi sono tutti dichiarati (posizione o motivo dell’assenza)`);
  for (const [themeId, theme] of Object.entries(program.themes)) {
    assert.ok(program.documents.includes(theme.doc) && D.DOCUMENTS[theme.doc], `${id} · ${themeId}: il tema cita un documento del partito`);
    assert.ok(theme.summary?.[0]?.length > 20 && theme.summary?.[1]?.length > 20 && theme.summary[0] !== theme.summary[1], `${id} · ${themeId}: sintesi in italiano e in inglese`);
    if (theme.value === null) assert.equal(theme.confidence, 'nessuna', `${id} · ${themeId}: tema non documentato dichiarato`);
    else {
      documentedThemes++;
      assert.ok(Number.isFinite(theme.value) && theme.value >= -3 && theme.value <= 3 && ['alta', 'media', 'bassa'].includes(theme.confidence), `${id} · ${themeId}: valore sulla scala e confidenza`);
      assert.ok(theme.value !== 0, `${id} · ${themeId}: una posizione documentata ha una direzione (0 non è «documentato»)`);
      const doc = D.DOCUMENTS[theme.doc];
      assert.ok(!/non-letto/.test(doc.read), `${id} · ${themeId}: una posizione viene da un documento letto (direttamente o nel dossier)`);
      if (/storico/.test(doc.status)) assert.match(theme.summary[0], /20\d\d|storico/, `${id} · ${themeId}: una posizione da un documento storico lo dice nella sintesi`);
      if (doc.type === 'programma-coalizione') assert.match(theme.summary[0], /coalizione/, `${id} · ${themeId}: una posizione da un programma di coalizione lo dice`);
    }
  }
  // the institutions: a position on the scale (parliament and guarantees ↔ premierato) needs a source on the form of government
  const inst = program.themes.istituzioni;
  if (Number.isFinite(inst.value)) assert.match(inst.summary[0], /premier|elezione diretta|forma di governo/i, `${id}: istituzioni con un valore solo se la fonte parla della forma di governo`);
}
assert.ok(documentedThemes >= 50, `posizioni documentate (${documentedThemes})`);
lines.push(`${Object.keys(D.DOCUMENTS).length} documenti, ${Object.keys(D.DOCUMENTED_PROGRAMS).length} programmi, ${documentedThemes} posizioni documentate`);

// 2. & 3. no position deduced from the axis; the play labels the estimates
const pcivico = { id: 'party-progetto-civico-italia', axis: -1 };
assert.equal(R.programSource(pcivico, 'istituzioni').documented, false, 'Progetto Civico Italia: istituzioni non documentate (premierato non trattato)');
assert.equal(R.programSource(pcivico, 'istituzioni').simulated, true, '…e la partita usa una stima etichettata come simulata');
assert.match(R.programSource(pcivico, 'istituzioni').gap.summary[0], /premierato/, '…con il motivo');
assert.equal(R.programSource(pcivico, 'europa').documented, true);
assert.equal(R.positionOf({}, pcivico, 'europa'), D.DOCUMENTED_PROGRAMS['party-progetto-civico-italia'].themes.europa.value, 'un tema documentato è usato come documentato');
const pciCom = { id: 'party-partito-comunista-italiano', axis: -3 };
assert.notEqual(R.positionOf({}, pciCom, 'europa'), R.simulatedPosition(pciCom, 'europa'), 'PCI: l’Europa viene dalle Tesi (confederazione di Stati sovrani), non dall’asse sinistra-destra');
assert.equal(R.documentedCoverage(pciCom), 10, 'PCI: dieci temi documentati dalle Tesi');
const alias = { id: 'party-mef-2025-15', axis: -0.5 };
assert.equal(D.documentedProgramOf(alias), D.DOCUMENTED_PROGRAMS['party-registro-p1-2022-63-ir'], 'l’alias MEF del M5S porta al programma del record canonico');
assert.equal(R.documentedCoverage(alias), 0, 'M5S: nessuna posizione verificata (NOVA non leggibile)');
assert.equal(R.programSource(alias, 'lavoro').simulated, true, 'M5S: la partita usa stime etichettate');
const nobody = { id: 'party-registro-p1-2014-02-ir', axis: 0.5 };
assert.equal(D.documentedProgramOf(nobody), null); assert.equal(R.documentedCoverage(nobody), 0, 'un partito senza documenti non ha temi documentati');
assert.equal(R.positionOf({}, { id: 'senza-dati' }, 'economia'), null, 'senza documenti né collocazione: nessuna posizione');
assert.equal(R.positionOf({ programPositions: { [pcivico.id]: { europa: 1 } } }, pcivico, 'europa'), 1, 'il compromesso del giocatore vince');
const compared = R.compare({}, pciCom, { id: 'party-registro-p1-2014-04-ir', axis: 2.5 });
assert.ok(compared.documented >= 6 && compared.rows.every(row => ['documentato', 'misto', 'stima', 'compromesso'].includes(row.basis)), `il confronto dice su quanti temi poggia sui documenti (${compared.documented})`);
assert.ok(compared.hard.some(row => row.id === 'esteri' && row.basis === 'documentato'), 'PCI–FdI: incompatibilità documentata sulla politica estera (NATO)');
lines.push(`PCI–FdI: ${compared.documented}/10 temi documentati, incompatibilità su ${compared.hard.map(row => row.id).join(', ')}`);

// 4. the catalogue
assert.equal(parties.length, 76); assert.equal(movements.length, 6);
for (const record of records) {
  const entry = D.PARTY_CATALOG[record.id];
  assert.ok(entry && ['nazionale', 'regionale', 'italiani-estero', 'movimento', 'storico', 'alias', 'da-verificare'].includes(entry.kind), `${record.officialName}: classificato (${entry?.kind})`);
  if (record.status === 'historical') assert.equal(entry.kind, 'storico', `${record.officialName}: storico nel dataset, storico nel catalogo`);
  if (entry.kind === 'alias') { assert.ok(records.some(item => item.id === entry.aliasOf), `${record.officialName}: alias di un record esistente`); assert.ok(!D.DOCUMENTED_PROGRAMS[record.id], `${record.officialName}: un alias non ha un programma proprio`); }
  if (entry.kind === 'storico') assert.ok(!D.DOCUMENTED_PROGRAMS[record.id] || D.DOCUMENTED_PROGRAMS[record.id].documents.every(id => /storico/.test(D.DOCUMENTS[id].status)), `${record.officialName}: un partito storico non ha programmi correnti`);
}
assert.equal(D.PARTY_CATALOG['party-mef-2025-15'].aliasOf, 'party-registro-p1-2022-63-ir'); assert.equal(D.PARTY_CATALOG['party-mef-2025-21'].aliasOf, 'party-registro-p1-2018-47-ir');
assert.match(D.PARTY_CATALOG['party-registro-p1-2014-04-ir'].note, /Fratelli d’Italia/); assert.match(D.PARTY_CATALOG['party-registro-p1-2015-20-ir'].note, /Forza Italia/);
assert.doesNotMatch(D.PARTY_CATALOG['party-progetto-civico-italia'].note, /^(?!.*non un soggetto fittizio).*fittizi/i); assert.equal(D.DOCUMENTED_PROGRAMS['party-progetto-civico-italia'].status, 'in-elaborazione');
lines.push(`${records.length} record classificati`);

// 5. coalitions
const table = D.COALITION_PROGRAMS.find(item => item.id === 'tavolo-centrosinistra-2026');
assert.equal(table.status, 'in-elaborazione'); assert.match(table.statusText[0], /nessun testo finale approvato/);
for (const id of table.members) assert.ok(records.some(record => record.id === id), `tavolo: ${id} esiste`);

// 6. the matrix of the gaps is up to date
execFileSync(process.execPath, [new URL('./report-party-programs.mjs', import.meta.url).pathname, '--check'], { stdio: 'pipe' });
const gaps = await readFile(new URL('../docs/qa/programmi-partiti-da-completare.md', import.meta.url), 'utf8');
assert.match(gaps, /## Lacune da completare/); assert.match(gaps, /Forza Italia/); assert.match(gaps, /MoVimento 5 Stelle/);
console.log(`Programmi dei partiti verificati sulla provenienza: ${lines.join(' · ')}; alias e storici coerenti, coalizioni distinte, matrice delle lacune aggiornata.`);
