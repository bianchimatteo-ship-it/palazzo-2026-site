// Real bills and laws of the XIX legislature, as published by the Senate open data.
// Titles, status, numbers and dates are shown exactly as in the source; the game area
// next to each act is only the game's reading of its official topics.
import { realLawArea } from '../core/society-engine.js?v=20260925-5';
import { LAW_ICONS, glyph } from './visuals.js?v=20260925-5';
import { esc } from './charts.js?v=20260925-5';

export const REAL_LAW_PAGE = 12;
const formatDay = value => value ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—';
const normal = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT');

export function filterRealLaws(laws = [], ui = {}) {
  const query = normal(ui.query).trim();
  return laws.filter(law => law.source === 'real' && law.verified === true)
    .filter(law => ui.outcome && ui.outcome !== 'all' ? law.outcome === ui.outcome : true)
    .filter(law => ui.area && ui.area !== 'all' ? realLawArea(law) === ui.area : true)
    .filter(law => !query || normal(`${law.officialTitle} ${law.lawNumber ?? ''} ${(law.topics ?? []).join(' ')}`).includes(query));
}

export function renderRealLaws(laws = [], ui = {}, { canPropose = false, loading = false, error = '' } = {}) {
  if (loading) return '<p class="quiet-copy">Caricamento degli atti reali dal dataset del Senato…</p>';
  if (error) return `<p class="quiet-copy">${esc(error)} <button class="text-link" data-action="retry-database">Riprova</button></p>`;
  const all = laws.filter(law => law.source === 'real' && law.verified === true);
  if (!all.length) return '<p class="quiet-copy">Nessun atto reale disponibile nel dataset.</p>';
  const list = filterRealLaws(all, ui);
  const shown = list.slice(0, (ui.page ?? 1) * REAL_LAW_PAGE);
  const areas = [...new Set(all.map(realLawArea).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
  const approved = all.filter(law => law.outcome === 'legge').length;
  const rows = shown.map(law => {
    const area = realLawArea(law);
    return `<article class="real-law">
      <header>${glyph(LAW_ICONS[area] ?? 'law', 18)}<div><span class="real-law-status ${law.outcome === 'legge' ? 'is-law' : ''}">${esc(law.status)}</span>${law.lawNumber ? `<strong class="real-law-number">Legge n. ${esc(law.lawNumber)} del ${esc(formatDay(law.lawDate))}</strong>` : ''}</div></header>
      <p class="real-law-title">${esc(law.officialTitle)}</p>
      <dl><div><dt>Presentato</dt><dd>${esc(formatDay(law.presentedAt))}</dd></div><div><dt>Ultimo stato</dt><dd>${esc(formatDay(law.statusDate))}${law.branch ? ` · ${law.branch === 'senato' ? 'Senato' : 'Camera'}` : ''}</dd></div>${law.initiative ? `<div><dt>Iniziativa</dt><dd>${esc(law.initiative)}</dd></div>` : ''}</dl>
      ${law.topics?.length ? `<div class="real-law-topics">${law.topics.slice(0, 4).map(topic => `<span>${esc(topic)}</span>`).join('')}</div>` : ''}
      <footer><span class="badge badge-real">${glyph('shield', 12)} Dato reale verificato · ${esc(law.verifiedAt ?? '')}</span>${area ? `<span class="badge">Area di gioco: ${esc(area)} (interpretazione)</span>` : ''}<a class="catalog-source" href="${esc(law.sourceUrl)}" target="_blank" rel="noopener noreferrer">Scheda del Senato ↗</a>${canPropose && area ? `<button class="secondary-button" data-real-law-amend="${esc(law.id)}">Proponi una modifica simulata</button>` : ''}</footer>
    </article>`;
  }).join('');
  return `<div class="real-law-tools">
      <label class="catalog-search">${glyph('scandal', 16)}<input data-real-law-filter="query" value="${esc(ui.query ?? '')}" placeholder="Cerca per titolo, numero o tema" aria-label="Cerca tra gli atti reali" /></label>
      <select data-real-law-filter="outcome" aria-label="Esito"><option value="all">Tutti gli atti</option><option value="legge" ${ui.outcome === 'legge' ? 'selected' : ''}>Leggi approvate</option><option value="in-corso" ${ui.outcome === 'in-corso' ? 'selected' : ''}>In corso</option></select>
      <select data-real-law-filter="area" aria-label="Area"><option value="all">Tutte le aree</option>${areas.map(area => `<option value="${esc(area)}" ${ui.area === area ? 'selected' : ''}>${esc(area)}</option>`).join('')}</select>
    </div>
    <p class="parliament-note">${all.length} atti della XIX legislatura dal Senato (${approved} leggi approvate definitivamente, ${all.length - approved} in corso). ${list.length !== all.length ? `${list.length} corrispondono ai filtri.` : ''} Una modifica proposta da te resta una simulazione: l’atto reale non cambia.</p>
    <div class="real-law-list">${rows || '<p class="quiet-copy">Nessun atto corrisponde ai filtri.</p>'}</div>
    ${shown.length < list.length ? `<button class="secondary-button real-law-more" data-real-law-more>Mostra altri ${Math.min(REAL_LAW_PAGE, list.length - shown.length)} atti</button>` : ''}`;
}
