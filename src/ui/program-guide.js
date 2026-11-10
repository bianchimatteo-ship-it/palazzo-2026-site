// The guided fields of the programme editor. Every field of a proposal has a list of choices that suits the policy area chosen (data/program-catalog.js: titles, problems, objectives and measures written for the
// sector) and, next to it, the text itself, which stays editable: a choice only fills it, the player can always write his own. What is sent to the store is the same named fields as before (title, problem, objective,
// measure0..3 with instrument0..3, cost, financing, deadlineWeeks, territory, region, municipality): the choices are not a separate layer, they are the data of the proposal.
import { AREA_BY_ID, INSTRUMENT_KINDS, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20261110-21';
import { measuresOf, themesOf } from '../data/program-catalog.js?v=20261110-21';
import { promiseQuote } from '../core/program-engine.js?v=20261110-21';
import { COST_BANDS, DEADLINES, FINANCING, TERRITORIES } from '../core/program-proposals.js?v=20261110-21';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20261110-21';
import { esc } from './sections-kit.js?v=20261110-21';

const CUSTOM = '__custom';
const MEASURE_SLOTS = 4;
const option = (value, label, selected = false, extra = '') => `<option value="${esc(value)}"${selected ? ' selected' : ''}${extra}>${esc(label)}</option>`;
const optionsOf = (entries, selected = '') => entries.map(([id, label]) => option(id, label, String(id) === String(selected))).join('');
const choices = (items, placeholder) => `${option('', placeholder)}${items.map(item => option(item, item)).join('')}${option(CUSTOM, 'Scrivo il mio testo')}`;
const fmt = value => String(Math.round(value * 10) / 10).replace('.', ',');

// the lists of an area (re-read every time the area changes)
export function guideOf(area) {
  const themes = themesOf(area);
  const spec = AREA_BY_ID[area];
  return {
    themes: themes.map(theme => theme.title),
    titles: themes.map(theme => theme.title),
    problems: [...themes.map(theme => theme.problem), ...(spec?.problem && !themes.some(theme => theme.problem === spec.problem) ? [spec.problem] : [])],
    objectives: [...themes.map(theme => theme.objective), ...(spec?.national && !themes.some(theme => theme.objective === spec.national) ? [spec.national] : [])],
    measures: measuresOf(area, spec?.instruments)
  };
}
// the automatic estimate of the cost: the area and the first measure, medium ambition (the same quote a promise gets)
export function estimateOf(area, instrument) {
  const quote = promiseQuote({ area, instrument: INSTRUMENT_KINDS[instrument] ? instrument : 'investimento', ambition: 'media' });
  return quote ? quote.cost : null;
}
const measureOptions = (list, current = '') => `${option('', 'Scegli una misura')}${list.map(item => option(item.text, `${INSTRUMENT_KINDS[item.instrument]?.label ?? item.instrument}: ${item.text}`, item.text === current, ` data-instrument="${esc(item.instrument)}"`)).join('')}${option(CUSTOM, 'Scrivo la mia misura')}`;

let counter = 0;
export function guidedFields(view, values = {}) {
  const uid = `pg${++counter}`;
  const area = AREA_BY_ID[values.area] ? values.area : 'sanita';
  const guide = guideOf(area);
  const info = view.proposals ?? {};
  const measures = [...(values.measures ?? [])];
  const starts = ['investimento', 'riforma', 'servizi'];
  while (measures.length < MEASURE_SLOTS) measures.push({ instrument: starts[measures.length % starts.length], text: '' });
  const territory = TERRITORIES[values.territory] ? values.territory : 'nazionale';
  const region = values.region ?? (territory === 'nazionale' ? '' : info.region ?? '');
  const estimate = estimateOf(area, measures[0]?.instrument);
  const bandNow = COST_BANDS.find(([value]) => Number(values.cost) === value)?.[0] ?? '';
  const field = (name, label, control, input, hint = '') => `<div class="guide-field" data-guide-field="${name}"><span class="guide-label">${label}</span><div class="guide-pair">${control}${input}</div>${hint}</div>`;
  const areaGroups = POLICY_AREAS.map(item => [item.id, item.label]);
  return `<div class="guided-form" data-guided-form="${uid}" data-room="${esc(info.room ?? '')}">
    <div class="guide-field" data-guide-field="area"><span class="guide-label">Area politica</span><div class="guide-pair"><select name="area" data-guide="area" aria-label="Area politica">${optionsOf(areaGroups, area)}</select>
      <select data-guide="theme" aria-label="Tema: compila titolo, problema, obiettivo e misure insieme">${choices(guide.themes, 'Parti da un tema consigliato (facoltativo)').replace(option(CUSTOM, 'Scrivo il mio testo'), '')}</select></div>
      <small class="guide-hint">Le proposte, i problemi e le misure che vedi cambiano con l’area scelta. Un tema compila tutti i campi insieme; puoi cambiarli uno per uno o scrivere i tuoi.</small></div>
    ${field('title', 'Titolo della proposta', `<select data-guide="title" aria-label="Titolo: scegli una proposta">${choices(guide.titles, 'Scegli un titolo')}</select>`, `<input name="title" type="text" maxlength="80" value="${esc(values.title ?? '')}" placeholder="…oppure scrivi il tuo titolo" autocomplete="off">`)}
    ${field('problem', 'Il problema', `<select data-guide="problem" aria-label="Problema: scegli una situazione concreta">${choices(guide.problems, 'Scegli un problema concreto')}</select>`, `<textarea name="problem" rows="2" maxlength="240" placeholder="…oppure descrivi il problema con parole tue">${esc(values.problem ?? '')}</textarea>`)}
    ${field('objective', 'L’obiettivo', `<select data-guide="objective" aria-label="Obiettivo: scegli un risultato">${choices(guide.objectives, 'Scegli un obiettivo')}</select>`, `<input name="objective" type="text" maxlength="200" value="${esc(values.objective ?? '')}" placeholder="…oppure scrivi il risultato che vuoi ottenere" autocomplete="off">`)}
    <fieldset class="program-measures guide-measures"><legend>Le misure (almeno una)</legend>${measures.slice(0, MEASURE_SLOTS).map((item, index) => `<div class="program-measure guide-measure"><select data-guide="measure" data-slot="${index}" aria-label="Misura ${index + 1}: scegli">${measureOptions(guide.measures, item.text)}</select><select name="instrument${index}" aria-label="Strumento della misura ${index + 1}">${optionsOf(Object.entries(INSTRUMENT_KINDS).map(([id, kind]) => [id, kind.label]), item.instrument)}</select><input name="measure${index}" type="text" maxlength="160" value="${esc(item.text ?? '')}" placeholder="${index ? 'Un’altra misura (facoltativa)' : 'Una misura concreta, a tua scelta o scritta da te'}" autocomplete="off"></div>`).join('')}</fieldset>
    <div class="guide-row"><div class="guide-field" data-guide-field="cost"><span class="guide-label">Costo stimato</span><div class="guide-pair"><select data-guide="costband" aria-label="Fascia di costo"><option value="">Stima automatica (consigliata)</option>${COST_BANDS.map(([value, label]) => option(String(value), label, value === bandNow)).join('')}${option(CUSTOM, 'Scrivo un importo mio')}</select><input name="cost" type="number" min="0" max="60" step="0.1" value="${values.cost ?? ''}" placeholder="${estimate === null ? 'stima automatica' : `stima: ${fmt(estimate)}`} (miliardi)" aria-label="Costo in miliardi di euro"></div>
      <small class="guide-hint" data-guide-estimate>${estimate === null ? '' : `Stima automatica per la prima misura: circa ${fmt(estimate)} miliardi${info.room ? ` · margine di bilancio libero circa ${fmt(Number(info.room))} miliardi` : ''}.`}</small></div>
    <label class="guide-field">Come si paga<select name="financing" aria-label="Finanziamento">${optionsOf(Object.entries(FINANCING).map(([id, spec]) => [id, spec.label]), values.financing ?? 'bilancio')}</select><small class="guide-hint" data-guide-financing>${esc(FINANCING[values.financing ?? 'bilancio']?.detail ?? '')}</small></label>
    <label class="guide-field">Scadenza<select name="deadlineWeeks" aria-label="Scadenza">${optionsOf(Object.entries(DEADLINES), String(values.deadlineWeeks ?? 104))}</select></label></div>
    <div class="guide-row"><label class="guide-field">Territorio<select name="territory" data-guide="territory" aria-label="Territorio">${optionsOf(Object.entries(TERRITORIES), territory)}</select></label>
      <label class="guide-field" data-guide-place="region"${territory === 'nazionale' ? ' hidden' : ''}>Regione<select data-guide="region" aria-label="Regione"><option value="">Scegli la regione</option>${ITALIAN_REGIONS.map(name => option(name, name, name === region)).join('')}</select></label>
      <label class="guide-field" data-guide-place="municipality"${territory === 'locale' ? '' : ' hidden'}>Comune<input data-guide="municipality" type="text" list="${uid}-places" maxlength="60" value="${esc(values.municipality ?? '')}" placeholder="Scegli un comune o scrivilo" autocomplete="off" aria-label="Comune"><datalist id="${uid}-places"></datalist></label></div>
    <input type="hidden" name="region" value="${esc(region)}"><input type="hidden" name="municipality" value="${esc(values.municipality ?? '')}">
  </div>`;
}

// ---------- behaviour (called by app.js on the input and change events of a proposal form) ----------
const setValue = (form, name, value) => { const el = form.querySelector(`[name="${name}"]`); if (el) { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); } };
const fill = (select, items, placeholder, custom = true) => { select.innerHTML = choices(items, placeholder); if (!custom) select.querySelector(`option[value="${CUSTOM}"]`)?.remove(); };

function refreshLists(form) {
  const area = form.querySelector('[name="area"]').value;
  const guide = guideOf(area);
  const set = (name, items, placeholder, custom = true) => { const select = form.querySelector(`[data-guide="${name}"]`); if (select) fill(select, items, placeholder, custom); };
  set('theme', guide.themes, 'Parti da un tema consigliato (facoltativo)', false);
  set('title', guide.titles, 'Scegli un titolo');
  set('problem', guide.problems, 'Scegli un problema concreto');
  set('objective', guide.objectives, 'Scegli un obiettivo');
  form.querySelectorAll('[data-guide="measure"]').forEach(select => { const current = form.querySelector(`[name="measure${select.dataset.slot}"]`)?.value ?? ''; select.innerHTML = measureOptions(guide.measures, current); });
  refreshEstimate(form);
}
function refreshEstimate(form) {
  const area = form.querySelector('[name="area"]').value;
  const instrument = form.querySelector('[name="instrument0"]')?.value;
  const value = estimateOf(area, instrument);
  const cost = form.querySelector('[name="cost"]'), hint = form.querySelector('[data-guide-estimate]');
  const room = Number(form.closest('[data-guided-form]')?.dataset.room ?? form.querySelector('[data-guided-form]')?.dataset.room ?? '');
  if (cost) cost.placeholder = value === null ? 'stima automatica (miliardi)' : `stima: ${fmt(value)} (miliardi)`;
  if (hint) hint.textContent = value === null ? '' : `Stima automatica per la prima misura: circa ${fmt(value)} miliardi${room ? ` · margine di bilancio libero circa ${fmt(room)} miliardi` : ''}.`;
}
function syncPlace(form) {
  const territory = form.querySelector('[name="territory"]').value;
  const regionPick = form.querySelector('[data-guide="region"]'), comune = form.querySelector('[data-guide="municipality"]');
  const hiddenRegion = form.querySelector('input[name="region"]'), hiddenComune = form.querySelector('input[name="municipality"]');
  form.querySelector('[data-guide-place="region"]').hidden = territory === 'nazionale';
  form.querySelector('[data-guide-place="municipality"]').hidden = territory !== 'locale';
  if (territory === 'nazionale') { hiddenRegion.value = ''; hiddenComune.value = ''; return; }
  if (regionPick.value) hiddenRegion.value = regionPick.value;
  hiddenComune.value = territory === 'locale' ? comune.value.trim() : '';
}
export function onGuideEvent(event, store = null) {
  const target = event.target;
  const form = target.closest?.('[data-proposal-form],[data-proposal-edit-form]');
  if (!form || !target.matches?.('[data-guide],[name]')) return false;
  const kind = target.dataset.guide;
  if (event.type === 'change' || (event.type === 'input' && ['municipality'].includes(kind))) {
    if (kind === 'area') { refreshLists(form); return true; }
    if (kind === 'theme') {
      const area = form.querySelector('[name="area"]').value;
      const theme = themesOf(area).find(item => item.title === target.value);
      if (theme) {
        setValue(form, 'title', theme.title); setValue(form, 'problem', theme.problem); setValue(form, 'objective', theme.objective);
        for (let index = 0; index < MEASURE_SLOTS; index++) {
          const item = theme.measures[index];
          if (item) { setValue(form, `measure${index}`, item.text); setValue(form, `instrument${index}`, item.instrument); const pick = form.querySelector(`[data-guide="measure"][data-slot="${index}"]`); if (pick) pick.value = item.text; }
        }
        refreshEstimate(form);
      }
      target.value = '';
      return true;
    }
    if (['title', 'problem', 'objective'].includes(kind)) {
      if (target.value === CUSTOM) { const input = form.querySelector(`[name="${kind}"]`); input.value = ''; input.focus(); }
      else if (target.value) setValue(form, kind, target.value);
      target.value = '';
      return true;
    }
    if (kind === 'measure') {
      const slot = target.dataset.slot;
      if (target.value === CUSTOM) { const input = form.querySelector(`[name="measure${slot}"]`); input.value = ''; input.focus(); }
      else if (target.value) { setValue(form, `measure${slot}`, target.value); const instrument = target.selectedOptions[0]?.dataset.instrument; if (instrument) setValue(form, `instrument${slot}`, instrument); }
      if (slot === '0') refreshEstimate(form);
      return true;
    }
    if (kind === 'costband') {
      const cost = form.querySelector('[name="cost"]');
      if (target.value === CUSTOM) { cost.value = ''; cost.focus(); } else cost.value = target.value;
      return true;
    }
    if (target.name === 'instrument0') { refreshEstimate(form); return true; }
    if (target.name === 'financing') { const hint = form.querySelector('[data-guide-financing]'); if (hint) hint.textContent = FINANCING[target.value]?.detail ?? ''; return true; }
    if (kind === 'territory') {
      syncPlace(form);
      if (target.value !== 'nazionale' && store) fillPlaces(form, store);
      return true;
    }
    if (kind === 'region') { syncPlace(form); if (store) fillPlaces(form, store); return true; }
    if (kind === 'municipality') { syncPlace(form); return true; }
  }
  return false;
}
// the real comuni of the region chosen (the data of ISTAT of the game): the list is filled when it is needed, not for every form at every redraw
export function fillPlaces(form, store) {
  const list = form.querySelector('datalist'), region = form.querySelector('input[name="region"]')?.value || null;
  if (!list || !store?.municipalitiesView) return;
  list.innerHTML = store.municipalitiesView(region).slice(0, 2000).map(name => `<option value="${esc(name)}"></option>`).join('');
}
export function onGuideFocus(event, store) {
  const target = event.target;
  if (target.matches?.('[data-guide="municipality"]')) { const form = target.closest('[data-proposal-form],[data-proposal-edit-form]'); if (form && !form.querySelector('datalist')?.children.length) fillPlaces(form, store); }
}
