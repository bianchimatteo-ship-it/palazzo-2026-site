// The provenance of the programme positions in the alliances page (ui/polls-mode.js programPanel): the document, its kind and date, the confidence and what it says, or the label of the game's
// estimate; and the note with the documents of a party. Loaded with the alliances page (observatory-view.js): it registers itself with the texts of the programmes.
import { documentOf, programTexts, registerProgramTexts } from '../data/party-program-values.js?v=20261125-11';
import { STATUS_TEXT } from '../data/party-programs.js?v=20261125-11';
import { esc } from './charts.js?v=20261125-11';
// Where a position of the table comes from: the party's own document (title, kind, date, confidence; the summary in the details), or the estimate of the game, said as such, with what the
// documents say about the theme when they say something.
const DOC_TYPE = { 'tesi-congressuali': ['tesi congressuali', 'congress theses'], 'carta-dei-valori': ['carta dei valori', 'charter of values'], 'programma-in-elaborazione': ['programma in elaborazione', 'programme being drafted'], 'proposte-tematiche': ['proposte tematiche', 'thematic proposals'], 'programma-elettorale': ['programma elettorale', 'election programme'], programma: ['programma', 'programme'], manifesto: ['manifesto', 'manifesto'], consultazione: ['consultazione degli iscritti', 'members’ consultation'], 'sintesi-programmatica': ['sintesi programmatica', 'programme summary'], 'programma-coalizione': ['programma di coalizione', 'coalition programme'], 'comunicazione-ufficiale': ['comunicazione ufficiale', 'official communication'], 'percorso-partecipativo': ['percorso partecipativo', 'participatory process'], 'priorita-europee': ['priorità europee', 'European priorities'], 'base-programmatica': ['base programmatica', 'programme basis'], 'tesi-in-elaborazione': ['tesi in elaborazione', 'theses being drafted'], 'documento-tematico': ['documento tematico', 'thematic document'] };
const CONFIDENCE = { alta: ['alta', 'high'], media: ['media', 'medium'], bassa: ['bassa', 'low'] };
const isEn = () => typeof document !== 'undefined' && document.documentElement.lang === 'en';
const L = pair => (pair ? pair[isEn() ? 1 : 0] : '');
export function provenance(source, value) {
  if (!source) return '';
  const en = isEn();
  if (source.documented && Number.isFinite(value)) {
    const doc = source.document;
    const kind = `${L(DOC_TYPE[doc?.type]) || doc?.type || ''}${doc?.date ? `, ${doc.date}` : ''}`;
    const title = en ? 'party document' : (doc?.title ?? 'documento del partito');
    return ` <small class="quiet-copy" data-program-confidence="${esc(source.confidence)}" data-program-basis="documentato" data-no-translate>· ${en ? 'source' : 'fonte'}: ${esc(title)} (${esc(kind)}), ${en ? 'confidence' : 'confidenza'} ${esc(L(CONFIDENCE[source.confidence]))}</small><details class="program-evidence" data-no-translate><summary>${en ? 'What it says' : 'Che cosa dice'}</summary><p>${esc(L(source.summary))}</p>${doc?.url ? `<p class="quiet-copy">${esc(doc.url.replace(/^https:\/\//, ''))}</p>` : ''}</details>`;
  }
  if (source.simulated) return ` <small class="quiet-copy" data-program-basis="stima" data-no-translate>· ${en ? 'simulated estimate of the game: not a position of the party' : 'stima simulata del gioco: non è una posizione del partito'}${source.gap ? ` — ${esc(L(source.gap.summary))}` : ''}</small>`;
  return '';
}
export function docNote(member, documented) {
  const en = isEn();
  return documented ? `<small class="quiet-copy" data-program-documented="${esc(member.id)}" data-program-status="${esc(documented.status)}" data-no-translate>${esc(L(STATUS_TEXT[documented.status]))}: ${en ? 'the themes the documents do not address have no position of the party.' : 'i temi che i documenti non affrontano non hanno una posizione del partito.'}</small><details class="coalition-program-areas" data-program-areas="${esc(member.id)}" data-no-translate><summary>${en ? 'Documents of the party' : 'Documenti del partito'}</summary><ul>${(documented.documents ?? []).map(id => documentOf(id)).filter(Boolean).map(doc => `<li data-program-document>${en ? `${esc(L(DOC_TYPE[doc.type]) || doc.type)}${doc.date ? ` · ${esc(doc.date)}` : ''} · ${esc(doc.url.replace(/^https:\/\//, ''))}` : `${esc(doc.title)} · ${esc(L(DOC_TYPE[doc.type]) || doc.type)}${doc.date ? ` · ${esc(doc.date)}` : ''} · ${esc(doc.status)}`}</li>`).join('')}${(documented.areas ?? []).map(area => `<li data-program-area="${esc(area.id)}">${esc(L(area.text))}</li>`).join('')}</ul></details>` : `<small class="quiet-copy" data-program-documented="none" data-no-translate>${en ? 'No programme document of the party in the data: every position is a simulated estimate of the game.' : 'Nessun documento programmatico del partito nei dati: tutte le posizioni sono stime simulate del gioco.'}</small>`;
}
export const coverage = count => `<small class="quiet-copy" data-program-coverage="${count}" data-no-translate>${isEn() ? `Themes compared on the parties’ documents: ${count} of 10. Positions without a source are simulated estimates of the game (from the party’s placement and your decisions), not statements of the real parties.` : `Temi confrontati sui documenti dei partiti: ${count} su 10. Le posizioni senza fonte sono stime simulate del gioco (dalla collocazione del partito e dalle tue decisioni), non dichiarazioni dei partiti reali.`}</small>`;
registerProgramTexts({ ...(programTexts() ?? {}), ui: { provenance, docNote, coverage } });
