// The public legal pages (privacy.html, termini.html, elimina-account.html) are final, user-facing texts: no draft, no placeholder, no internal note; they say what the game does and the
// code backs them (check-security audits the numbers). What only the controller can supply is not in the pages and not invented: it is listed in docs/legale-requisiti.json, and the release
// gate fails while a required item is missing. `node scripts/check-legal.mjs --release` is that gate; without the flag the check passes and reports what is still open.
//   - no «Bozza», «Da verificare», TODO, data-controller-todo or highlighted to-do boxes; no «non è un parere legale»-style notes addressed to the controller;
//   - the contact is the project's mailbox, with working mailto links; no other personal address in the public pages;
//   - links between the pages and to the game resolve to files that exist; pages are complete, mobile-ready, with the legal navigation;
//   - robots: noindex while a required item is missing, indexable only when none is;
//   - the manifest is well formed, every missing item says where it goes and why it is needed.
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { loadRequirements, releaseMessage } from './lib/legal-requirements.mjs';

const root = new URL('../', import.meta.url);
const IT_PAGES = ['privacy.html', 'termini.html', 'elimina-account.html'];
const EN_PAGES = ['privacy-en.html', 'terms-en.html', 'delete-account-en.html'];
const PAGES = [...IT_PAGES, ...EN_PAGES];
const CONTACT = 'politicando2026simulazione@gmail.com';
const requirements = await loadRequirements();
assert.deepEqual(requirements.problems, [], 'Il file dei requisiti è ben formato.');
assert.ok(requirements.items.length >= 8, 'Il file dei requisiti elenca ciò che manca.');
const PLACEHOLDERS = [/\bdraft\b/i, /to be (confirmed|completed|defined|verified)\b/i, /legal advice\b.*controller/i, /\bTBD\b/, /bozza/i, /da (confermare|verificare|definire|indicare|completare|compilare)\b/i, /\bTODO\b/, /data-controller-todo/, /class="todo"/, /\bFIXME\b|\bXXX\b|lorem ipsum/i, /a cura del titolare/i, /non è un parere legale/i, /punti in giallo/i, /\[(da|inserire|nome|indirizzo|completare)[^\]]*\]/i, /segnaposto|placeholder/i, /non (è stato|sono stati) (fornit|inserit)/i];
const links = [];
for (const name of PAGES) {
  const html = await readFile(new URL(name, root), 'utf8');
  const text = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '').replace(/<[^>]+>/g, ' ');
  for (const pattern of PLACEHOLDERS) assert.ok(!pattern.test(html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')), `${name}: nessun testo provvisorio (${pattern}).`);
  const english = EN_PAGES.includes(name);
  assert.ok(new RegExp(`<html lang="${english ? 'en' : 'it'}">`).test(html) && /<title>[^<]+<\/title>/.test(html) && /name="viewport"/.test(html) && /name="description"/.test(html) && /<h1>[^<]+<\/h1>/.test(html), `${name}: pagina completa.`);
  assert.ok((english ? /<nav class="legal-nav"[\s\S]*privacy-en\.html[\s\S]*terms-en\.html[\s\S]*delete-account-en\.html/ : /<nav class="legal-nav"[\s\S]*privacy\.html[\s\S]*termini\.html[\s\S]*elimina-account\.html/).test(html), `${name}: navigazione fra le pagine legali.`);
  assert.ok((english ? /href="\.\/">← Back to the game/ : /href="\.\/">← Torna al gioco/).test(html), `${name}: ritorno al gioco.`);
  // every page points to its other-language twin, and the twin points back
  const twin = { 'privacy.html': 'privacy-en.html', 'termini.html': 'terms-en.html', 'elimina-account.html': 'delete-account-en.html' };
  const other = english ? Object.keys(twin).find(key => twin[key] === name) : twin[name];
  assert.ok(html.includes(`href="${other}" hreflang="${english ? 'it' : 'en'}"`), `${name}: collegamento alla versione ${english ? 'italiana' : 'inglese'} (${other}).`);
  assert.ok(!/<table[\s\S]*<\/table>/.test(html) || /class="wide"/.test(html), `${name}: le tabelle scorrono su schermi stretti.`);
  // contacts
  const mails = [...html.matchAll(/href="mailto:([^"]+)"/g)].map(match => match[1]);
  assert.ok(mails.length >= 1 && mails.every(address => address === CONTACT), `${name}: i collegamenti mailto portano a ${CONTACT} (${mails}).`);
  for (const found of text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []) assert.equal(found, CONTACT, `${name}: nessun altro indirizzo e-mail nel testo pubblico (${found}).`);
  assert.ok(!/bianchimatteo657@/.test(html), `${name}: il vecchio recapito non c'è più.`);
  for (const match of html.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) if (!/^(mailto:|https?:|data:)/.test(match[1])) links.push([name, match[1]]);
}
for (const [name, target] of links) await access(new URL(target === './' ? 'index.html' : target.replace(/^\.\//, ''), root)).catch(() => assert.fail(`${name}: il collegamento «${target}» non porta a un file.`));
// the texts say what the code does (the numbers are audited in check-security.mjs)
const privacy = await readFile(new URL('privacy.html', root), 'utf8');
for (const needle of ['Titolare del trattamento', 'Cloudflare', 'Garante', 'Minori', 'localStorage', 'non usa cookie', 'Per quanto tempo conserviamo i dati', 'Elimina il mio account', 'nessun dato di gioco viene inviato ai nostri server', 'Google Apps Script e Gmail', 'Loghi dei partiti']) assert.ok(privacy.includes(needle), `Informativa: «${needle}».`);
const terms = await readFile(new URL('termini.html', root), 'utf8');
for (const needle of ['simulazione politica', 'Account e responsabilità', 'Salvataggi locali e online', 'Proprietà intellettuale', 'Uso consentito', 'Disponibilità, manutenzione', 'inderogabil']) assert.ok(terms.includes(needle), `Termini: «${needle}».`);
// the English pages say the same as the Italian ones: the same sections, the same table rows, the same numbers and the same contact
const enPrivacy = await readFile(new URL('privacy-en.html', root), 'utf8'), enTerms = await readFile(new URL('terms-en.html', root), 'utf8');
const count = (html, pattern) => (html.match(pattern) ?? []).length;
assert.equal(count(enPrivacy, /<h2>/g), count(privacy, /<h2>/g), 'Informativa inglese: stesse sezioni dell’italiana.');
assert.equal(count(enPrivacy, /<tr>/g), count(privacy, /<tr>/g), 'Informativa inglese: stesse righe di tabella dell’italiana.');
assert.equal(count(enTerms, /<h2>/g), count(terms, /<h2>/g), 'Termini inglesi: stesse sezioni degli italiani.');
const digits = html => [...html.replace(/<[^>]+>/g, ' ').matchAll(/\b\d+\b/g)].map(match => match[0]).filter(number => !['2026', '2016', '679', '2'].includes(number)).sort().join(',');
for (const [en, it, label] of [[enPrivacy, privacy, 'Informativa'], [enTerms, terms, 'Termini']]) assert.equal(digits(en), digits(it), `${label} inglese: gli stessi numeri (durate, limiti, articoli) dell’italiana.`);
for (const needle of ['Controller and contacts', 'Cloudflare', 'Garante', 'Children', 'localStorage', 'no cookies', 'How long we keep data', 'Delete my account', 'no game data is sent to our servers', 'Google Apps Script and Gmail', 'Party logos', 'under 14', 'not an age verification']) assert.ok(enPrivacy.includes(needle), `Informativa inglese: «${needle}».`);
for (const needle of ['political-simulation game', 'never real journalism', 'inderogabil'.replace('inderogabil', 'mandatory way'), 'Intellectual property', 'Permitted use']) assert.ok(enTerms.includes(needle), `Termini inglesi: «${needle}».`);
// minors: the texts say what the registration form does (age range, never stored) and do not claim a verification or a parental-consent procedure that does not exist
for (const [html, label] of [[privacy, 'Informativa'], [enPrivacy, 'Informativa inglese']]) assert.ok(!/(parental consent (is|has been) (obtained|verified)|consenso (dei genitori )?(è|viene) (acquisito|verificato))/i.test(html), `${label}: non dichiara un consenso dei genitori che non esiste.`);
assert.ok(privacy.includes('non è una verifica dell’età') && privacy.includes('meno di 14 anni'), 'Informativa: dichiara che la fascia di età non è una verifica.');
// robots: indexable only when nothing required is missing
for (const name of PAGES) {
  const noindex = /<meta name="robots" content="noindex"/.test(await readFile(new URL(name, root), 'utf8'));
  assert.equal(noindex, requirements.missingRequired.length > 0, `${name}: noindex ${requirements.missingRequired.length ? 'finché mancano requisiti indispensabili' : 'tolto solo a requisiti completi'}.`);
}
const state = `Requisiti indispensabili mancanti: ${requirements.missingRequired.length} (${requirements.missingRequired.map(item => item.id).join(', ') || 'nessuno'}); facoltativi o condizionati: ${requirements.missingOptional.length}.`;
if (process.argv.includes('--release') && requirements.missingRequired.length) { console.error(releaseMessage(requirements.missingRequired)); process.exit(1); }
console.log(`Documenti legali verificati: pagine definitive senza bozze né segnaposto, recapito ${CONTACT}, collegamenti e navigazione validi, noindex coerente con i requisiti. ${state}`);
