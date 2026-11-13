// The catalogue of the parties of the wizard: what the cards and the filters say about the data. A party that is declared but waits for confirmation (verified: false, «in-attesa-di-conferma»: Progetto Civico
// Italia) is labelled «IN ATTESA DI VERIFICA», never «DATO REALE VERIFICATO», and is not in the filter «Dati reali verificati» (it has its own); the historical ones stay available through their own filter,
// told apart from the active ones. Nothing is invented: what the data does not have (acronym, description, logo) stays empty. Engine only, no browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const v = html.match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}${v ? `?v=${v}` : ''}`, import.meta.url).href);
const { isPendingReal, isSelectableParty } = await load('src/data/schema.js');
const { filterWizardParties, partySourceLabel, activePartyCriteria } = await load('src/ui/career-wizard.js');
const json = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const asList = (data, key) => Array.isArray(data) ? data : data[key] ?? [];
const parties = asList(await json('parties'), 'parties'), movements = asList(await json('political-movements'), 'movements'), coalitions = asList(await json('coalitions'), 'coalitions');
const selectable = [...parties, ...movements, ...coalitions].filter(isSelectableParty);
const real = filterWizardParties(selectable, { partyFilter: 'real' }), pending = filterWizardParties(selectable, { partyFilter: 'pending' });

const waiting = selectable.filter(item => item.verified !== true);
assert.ok(waiting.length >= 1 && waiting.every(isPendingReal), `I soggetti non verificati sono dichiarati in attesa di conferma (${waiting.map(item => item.officialName).join(', ')}).`);
for (const item of waiting) {
  assert.equal(partySourceLabel(item), 'IN ATTESA DI VERIFICA', `${item.officialName}: l’etichetta della scheda`);
  assert.ok(!real.includes(item), `${item.officialName}: non è nel filtro «Dati reali verificati»`);
  assert.ok(pending.includes(item), `${item.officialName}: è nel filtro «In attesa di verifica»`);
}
for (const item of selectable.filter(item => item.verified === true)) { assert.ok(partySourceLabel(item).endsWith('DATO REALE VERIFICATO'), `${item.officialName}: verificato`); assert.ok(real.includes(item)); }
assert.equal(real.length + pending.length, selectable.length, 'Verificati e in attesa sono, insieme, tutto il catalogo reale selezionabile.');
// a record that is real, not verified and not declared pending is told as such
assert.equal(partySourceLabel({ source: 'real', verified: false }), 'DATO REALE NON VERIFICATO');
assert.equal(partySourceLabel({ source: 'user' }), 'CREATO DA TE');
assert.equal(partySourceLabel({ source: 'real', verified: true, entityType: 'coalition' }), 'COALIZIONE / LISTA ELETTORALE · DATO REALE VERIFICATO');
assert.ok(activePartyCriteria({ partyFilter: 'pending' }).some(item => item.label === 'In attesa di verifica'));
// the historical subjects stay reachable through their own filter and are not mixed with the active ones
const historical = filterWizardParties(selectable, { partyStatus: 'historical' }), active = filterWizardParties(selectable, { partyStatus: 'active' });
assert.ok(historical.length >= 1 && historical.every(item => item.status === 'historical') && active.every(item => item.status === 'active'));
assert.ok(historical.every(item => !active.includes(item)));
// search finds a party by name or acronym
const sample = selectable.find(item => item.abbreviation) ?? selectable[0];
assert.ok(filterWizardParties(selectable, { partyQuery: (sample.abbreviation ?? sample.officialName).slice(0, 4) }).includes(sample), 'La ricerca trova il partito.');
// counts (what the database holds today): nothing is dropped from the catalogue
const manifest = await json('manifest');
console.log(`Catalogo partiti verificato (dati del ${manifest.snapshotDate}, versione ${manifest.datasetVersion}): ${parties.length} partiti (${parties.filter(isSelectableParty).length} selezionabili), ${movements.filter(isSelectableParty).length} movimenti, ${coalitions.filter(isSelectableParty).length} coalizione/lista = ${selectable.length} forze; ${real.length} verificate, ${pending.length} in attesa di verifica, ${historical.length} storiche, ${active.length} in attività.`);
