// The English of the game WITHOUT DeepL, WITHOUT a connection and AFTER a restart, and with the meaning checked (not only the absence of Italian words).
//   1. The phrase book is local: i18n.js does not reach the network at all.
//   2. Golden sentences: the exact English of the frames of every area of the game (laws, councils, government, Parliament, polls, newsbulletins, events, congress…), numbers and names kept, translated with the network
//      forbidden. A wrong word order or a lost number fails here even if no Italian word is left.
//   3. DeepL disabled (503 «not configured»), quota exhausted (429), network down: the same English, nothing asked that holds a name or a number, no failure.
//   4. After a restart (new process state, empty storage): the same English.
//   5. The census of the generated texts (two careers played on the real engine) with the network poisoned: zero incomplete, zero missing, zero attempts of reaching the network.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let attempts = 0;
globalThis.fetch = async () => { attempts++; throw new Error('rete non disponibile'); };
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) };
memory.set('politicando.settings.v1', JSON.stringify({ language: 'en' }));

// ---- 1. the book is local ----
const source = readFileSync(`${root}src/core/i18n.js`, 'utf8');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(source.replace(/\/\/.*$/gm, '')), 'i18n.js non deve raggiungere la rete: il dizionario è locale');

// ---- 2. golden English ----
const GOLDEN = [
  // laws and newsbulletins
  ['Un provvedimento su finanze pubbliche (tutto il Paese), finanziato dal bilancio. Ne traggono vantaggio famiglie e lavoratori 25–54, redditi bassi e precari e pensionati e over 65.', 'A measure on public finances (the whole country), funded from the budget. Households and workers 25–54, low earners and precarious workers and pensioners and over 65 benefit.'],
  ['Ne traggono vantaggio giovani 18–34. Restano scontenti pensionati e over 65 (costo).', 'Young people 18–34 benefit. Pensioners and over 65 remain unhappy (cost).'],
  ['Accordo di governo — Rossi: impegno mantenuto (Un provvedimento della maggioranza su…', 'Government agreement — Rossi: commitment kept…'],
  // polls and elections
  ['Elezioni europee del 9 giugno 2024: Fratelli d’Italia 28% (24), Partito Democratico 24% (21), Lega 9% (8), Forza Italia 9% (8), Movimento 5 Stelle 10% (9), Azione 4% (3), Sinistra 7% (6).', 'European elections of 9 June 2024: Fratelli d’Italia 28% (24), Partito Democratico 24% (21), Lega 9% (8), Forza Italia 9% (8), Movimento 5 Stelle 10% (9), Azione 4% (3), Sinistra 7% (6).'],
  ['Siena 7% (7), Lega 7% (7). Affluenza 61% (risultato simulato).', 'Siena 7% (7), Lega 7% (7). Turnout 61% (simulated result).'],
  ['Nuovo minimo nei sondaggi: 17,5%', 'New low in the polls: 17.5%'],
  ['Mario Rossi -3 nei sondaggi', 'Mario Rossi -3 in the polls'],
  // government and Parliament
  ['Governo Meloni · XIX legislatura ottiene la fiducia', 'Meloni Government · XIX legislature wins confidence'],
  ['Governo del Presidente · XXI legislatura ottiene la fiducia', 'Government of the President · XXI legislature wins confidence'],
  ['Crisi di governo: Governo del Presidente · XX legislatura', 'Government crisis: Government of the President · XX legislature'],
  ['Il decreto-legge del governo va convertito in legge. Voto finale alla Camera: 14 luglio 2024. Il tuo gruppo è orientato a votare a favore; previsione: passa con circa 123 voti (soglia 123). Votare in dissenso ti rende visibile, ma il gruppo e il partito se ne ricordano.', 'The government’s decree-law must be converted into law. Final vote in the Chamber: 14 July 2024. Your group is inclined to vote in favour; forecast: passes with about 123 votes (threshold 123). Voting in dissent makes you visible, but the group and the party remember it.'],
  // local councils and works
  ['Consiglio regionale: Piano regionale per il lavoro — Vota con il tuo gruppo (per l’astensione) (senza decisione)', 'Regional council: Regional employment plan — Vote with your group (abstain) (no decision)'],
  ['Consiglio provinciale: Convenzione con i comuni per lo sportello unico delle imprese — Vota con il tuo gruppo (a favore) (senza decisione)', 'Provincial council: Agreement with the municipalities on the business one-stop shop — Vote with your group (in favour) (no decision)'],
  ['Comune di Siena: aperta l’opera Piste ciclabili', 'Municipality of Siena: the project Cycle paths has opened'],
  ['Consiglio comunale: “Piste ciclabili”, protesta: la maggioranza si incrina (Lega, Azione).', 'City council: “Cycle paths”, protest: the majority cracks (Lega, Azione).'],
  ['Mobilità alternativa e meno traffico. Costo 4,5 punti contro 3 previsti, 12 settimane di ritardo (simulazione).', 'Alternative mobility and less traffic. Cost 4.5 points against 3 planned, 12 weeks late (simulation).'],
  ['Tariffe: riduzione per mense scolastiche e asili nido', 'Fees: reduction for school canteens and nurseries'],
  ['Interrogazione su assistenza agli anziani non autosufficienti', 'Question on care for dependent elderly people'],
  // world, parties, coalitions
  ['Scissione da Movimento Civico (forza simulata n.2) entra nei sondaggi', 'Split from Civic Movement (simulated force no. 2) enters the polls'],
  ['Trattativa fallita tra Lega e l’intesa simulata Azione – Forza Italia', 'Talks failed between Lega and the simulated agreement Azione – Forza Italia'],
  ['Nello scenario Azione cresce (elettori delusi da Lega guardano altrove)', 'In the scenario Azione is growing (voters disappointed by Lega look elsewhere)'],
  ['Programma di governo: crescita e investimenti · priorità europa, infrastrutture, natalità e demografia, famiglia.', 'Government programme: growth and investment · priorities Europe, infrastructure, birth rate and demography and family.'],
  ['Il governo rilancia il suo programma: equità sociale.', 'The government relaunches its programme: social fairness.'],
  // ministers and dossiers
  ['Dossier fallito — ministero Salute: emergenza: sanità. Le circostanze, più che il ministro, hanno frenato il dossier.', 'Dossier failed — ministry of Health: emergency: healthcare. Circumstances, more than the minister, held the dossier back.'],
  // presidency
  ['Figura di garanzia istituzionale (figura simulata) è eletto Presidente della Repubblica al 4º scrutinio con 520 voti su 1.009 (maggioranza assoluta, soglia 505). (simulazione).', 'Figure of institutional guarantee (simulated figure) is elected President of the Republic at ballot 4 with 520 votes out of 1,009 (absolute majority, threshold 505). (simulation).']
];
// (every expected English was read and approved: the clipped preview of the first law keeps only the whole clause, the titles of the works and the names of the ministries are translated)
const load = async version => {
  const I = await import(`../src/core/i18n.js?offline=${version}`);
  await I.loadBook();
  return I;
};
const bad = [];
const run = I => { for (const [it, en] of GOLDEN) { const out = I.translateText(it); if (out.replace(/’/g, "'") !== en.replace(/’/g, "'")) bad.push([it.slice(0, 90), out, en]); } };
const I = await load(1);
run(I);
if (bad.length) { for (const [it, out, en] of bad) console.error(`\n  IT: ${it}\n  OUT: ${out}\n  EXPECTED: ${en}`); }
assert.equal(bad.length, 0, `${bad.length} frasi non danno l’inglese atteso`);
assert.equal(attempts, 0, 'il dizionario non deve toccare la rete');

// ---- 3. DeepL disabled, quota exhausted, network down ----
const { createAutoTranslator } = await import(`../src/core/i18n-auto.js?offline=1`);
const answers = [
  ['non configurato', async () => ({ status: 503, ok: false, json: async () => ({ configured: false, needs: ['TRANSLATE_API_KEY'] }) })],
  ['quota esaurita', async () => ({ status: 429, ok: false, json: async () => ({ limit: 'month' }) })],
  ['rete assente', async () => { throw new Error('offline'); }]
];
for (const [label, fetchImpl] of answers) {
  const sent = [];
  const auto = createAutoTranslator({ fetchImpl: async (url, init) => { sent.push(JSON.parse(init.body)); return fetchImpl(); }, storage: null, setTimer: () => 0 });
  I.setAutoTranslator(auto);
  bad.length = 0;
  run(I);
  assert.equal(bad.length, 0, `${label}: l’inglese del dizionario deve restare completo (${bad.length} frasi diverse)`);
  // an unknown Italian sentence stays readable (never replaced by a generic message) and asks for nothing that holds a name or a number
  const unknown = I.translateText('Il consiglio approva la mozione sulle zucche di Mario Rossi per 1234 voti');
  assert.ok(/zucche/.test(unknown), `${label}: un testo sconosciuto non si altera`);
  await auto.flush();
  for (const payload of sent) for (const text of payload.texts) assert.ok(!/Rossi|1234|\d/.test(text.replace(/⟦\d+⟧/g, '')), `${label}: ai server va solo il modello anonimo («${text}»)`);
}
I.setAutoTranslator(null);

// ---- 4. after a restart ----
const again = await load(2);
bad.length = 0;
run(again);
assert.equal(bad.length, 0, 'dopo il riavvio l’inglese deve essere lo stesso');

// ---- 5. census of the generated texts, network poisoned ----
const child = spawnSync(process.execPath, ['--import', `${root}scripts/lib/no-network.mjs`, `${root}scripts/census-i18n.mjs`], { cwd: root, encoding: 'utf8', env: { ...process.env, CENSUS_QUICK: '1', CENSUS_EXTENDED: '0', CENSUS_STRICT: '1' }, timeout: 280000 });
assert.equal(child.status, 0, `censimento offline fallito:\n${child.stdout.slice(-1500)}\n${child.stderr.slice(-500)}`);
assert.match(child.stdout, /Testi generati: 0 incompleti e 0 mancanti/, 'censimento: zero lacune nei testi generati');
assert.ok(!/\[no-network\]/.test(child.stderr), 'il censimento non deve tentare di raggiungere la rete');
console.log(`Inglese senza DeepL, senza connessione e dopo il riavvio verificato: ${GOLDEN.length} frasi esatte (numeri e nomi conservati), DeepL non configurato / quota esaurita / rete assente (dizionario completo, nessun nome o numero inviato), riavvio, censimento dei testi generati a zero lacune con la rete bloccata (0 tentativi).`);
