// The English of the new-career wizard and of the fields of a new party (the same ones as the foundation during the career), rendered for every step and mode: no Italian left that is not a name.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeCareerDraft, renderCareerWizard, renderNewPartyFields } from '../src/ui/career-wizard.js';
import { makeDemoState } from '../src/data/simulation/demo.js';

const mem = new Map();
globalThis.localStorage = { getItem: key => key === 'politicando.settings.v1' ? JSON.stringify({ language: 'en' }) : mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
const I18N = await import('../src/core/i18n.js?wizard-en=' + Date.now());
await I18N.loadBook();
const { createIndependentDetector } = await import('./lib/i18n-independent.mjs');
const detector = createIndependentDetector();
const read = async name => JSON.parse(await readFile(new URL('../src/data/real/' + name + '.json', import.meta.url), 'utf8'));
const groups = await read('parliamentary-groups'), parties = await read('parties');
const demo = makeDemoState();
const texts = html => [...html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').matchAll(/(?:>([^<>]{2,})<|\b(?:placeholder|title|aria-label|alt)="([^"]+)")/g)].map(match => (match[1] ?? match[2]).replace(/&[a-z#0-9]+;/g, ' ').trim()).filter(text => /\p{L}{3}/u.test(text) && !/^[\p{Lu}0-9 ()'’.,\-+&:·]+$/u.test(text)).map(text => I18N.translateText(text));
const found = new Map();
const base = { ...makeCareerDraft(demo.clock.currentDate), gameMode: 'realistica', firstName: 'Anna', lastName: 'Bianchi', birthDate: '1985-04-12', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', previousProfession: 'Insegnante', initialLevel: 'deputato' };
const render = d => renderCareerWizard(demo, { ...base, ...d }, parties, () => null, groups, [], [], [], null);
for (const step of [1, 2, 3, 4, 5, 6]) for (const extra of [{}, { partyMode: 'new', partyName: 'Qxzw', partyAbbreviation: 'RTT', partyDescription: 'x' }, { partyMode: 'new', partyLogoMode: 'upload' }, { partyMode: 'independent' }, { initialLevel: 'comunale' }, { initialLevel: 'europeo' }]) {
  for (const text of texts(render({ step, ...extra }))) { const reason = detector.reasonOf(text); if (reason) found.set(text, reason); }
}
for (const text of texts(renderNewPartyFields({ ...base, partyMode: 'new', partyLogoMode: 'builder', partyColor: '#264d82', policyPositions: {} }))) { const reason = detector.reasonOf(text); if (reason) found.set(text, reason); }
if (found.size) { for (const [text, reason] of [...found].slice(0, 80)) console.log(` - ${text.slice(0, 100)} (${reason})`); }
assert.equal(found.size, 0, `${found.size} testi italiani nel wizard in inglese`);
console.log('Wizard in inglese: tutti i passaggi e le modalità del nuovo partito senza italiano non giustificato.');
