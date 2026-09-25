// Shared building blocks of the main sections (Elezioni, Carriera, Partito, Agenda): hero, internal tabs,
// indicators, cards and tables with the same visual language as the rest of POLITICANDO 2026.
import { glyph } from './visuals.js?v=20260925-4';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const num = (value, digits = 1) => value === null || value === undefined || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString('it-IT', { maximumFractionDigits: digits });
export const pct = (value, digits = 1) => value === null || value === undefined ? '—' : `${num(value, digits)}%`;
export const euro = value => `${Math.round(Number(value) || 0).toLocaleString('it-IT')} €`;
export const signed = (value, digits = 1) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Number(value) || 0).toLocaleString('it-IT', { maximumFractionDigits: digits })}`;
export const arrow = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

// Section hero: kicker, title, a short sentence, key figures and the main action.
export function sectionHero({ kicker, title, lead = '', icon = 'star', tone = 'default', kpis = [], actions = '', aside = '' }) {
  return `<section class="sx-hero tone-${esc(tone)}">
    <div class="sx-hero-main"><span class="sx-hero-icon">${glyph(icon, 22)}</span><div><span class="section-kicker">${esc(kicker)}</span><h2>${esc(title)}</h2>${lead ? `<p>${esc(lead)}</p>` : ''}${actions ? `<div class="sx-hero-actions">${actions}</div>` : ''}</div>${aside ? `<div class="sx-hero-aside">${aside}</div>` : ''}</div>
    ${kpis.length ? `<div class="sx-kpis">${kpis.map(kpi).join('')}</div>` : ''}
  </section>`;
}
// A key figure: label, value, an optional note and bar.
export function kpi({ label, value, note = '', tone = '', bar = null, title = '' }) {
  return `<div class="sx-kpi ${tone ? `tone-${esc(tone)}` : ''}" ${title ? `title="${esc(title)}"` : ''}><small>${esc(label)}</small><strong>${value}</strong>${bar !== null ? `<b class="sx-bar ${tone ? `tone-${esc(tone)}` : ''}"><i style="width:${Math.max(0, Math.min(100, Number(bar) || 0))}%"></i></b>` : ''}${note ? `<em>${note}</em>` : ''}</div>`;
}
// Internal navigation of a section: the choice is kept by the caller (views state) and survives redraws.
export function sectionTabs(name, tabs, active) {
  return `<nav class="sx-tabs" role="tablist" aria-label="Sezioni interne">${tabs.map(([id, label, count]) => `<button type="button" role="tab" class="sx-tab ${active === id ? 'active' : ''}" data-section-tab="${esc(name)}" data-section-tab-value="${esc(id)}" aria-selected="${active === id}">${esc(label)}${count ? `<span class="sx-tab-count">${esc(count)}</span>` : ''}</button>`).join('')}</nav>`;
}
export function card({ kicker = '', title = '', body = '', action = '', tone = '', className = '', id = '' }) {
  return `<section class="sx-card ${tone ? `tone-${esc(tone)}` : ''} ${esc(className)}" ${id ? `id="${esc(id)}"` : ''}>${kicker || title || action ? `<header class="sx-card-head"><div>${kicker ? `<span class="section-kicker">${esc(kicker)}</span>` : ''}${title ? `<h3>${esc(title)}</h3>` : ''}</div>${action}</header>` : ''}${body}</section>`;
}
export function badge(label, tone = 'neutral') {
  return `<span class="sx-badge tone-${esc(tone)}">${esc(label)}</span>`;
}
export function bar(value, tone = '', max = 100) {
  return `<b class="sx-bar ${tone ? `tone-${esc(tone)}` : ''}"><i style="width:${Math.max(0, Math.min(100, (Number(value) || 0) / (max || 1) * 100))}%"></i></b>`;
}
// A table that becomes a list of cards on small screens (every cell carries its column label).
export function table(columns, rows, { empty = 'Nessun dato.', className = '' } = {}) {
  if (!rows.length) return `<p class="sx-empty">${esc(empty)}</p>`;
  return `<div class="sx-table-wrap ${esc(className)}"><table class="sx-table"><thead><tr>${columns.map(([, label, align]) => `<th ${align ? `class="${align}"` : ''} scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr class="${row._class ?? ''}">${columns.map(([key, label, align]) => `<td ${align ? `class="${align}"` : ''} data-label="${esc(label)}">${row[key] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export function empty(text, action = '') {
  return `<div class="sx-empty-block"><p>${esc(text)}</p>${action}</div>`;
}
export function weeksLabel(count) {
  return `${count} ${count === 1 ? 'settimana' : 'settimane'}`;
}
