// The election night: the screen of the twelve hours (night-engine.js decides what is known at each hour; this file only draws it).
// A television special in the colours, type and components of the rest of the game (cards, tabs, badges, tables): the clock and the hours, the ticker, the live feed, the count, the results with
// their bars, the territories, the map, the polls and projections (always apart from the official partial result), the seats, the statements and, at the twelfth hour, the summary.
import { NIGHT_HOURS, exitPoll, nightClock, nightView, pendingPrompts, projection, statementPromptFor } from '../core/night-engine.js?v=20261106-1';
import { forceColor, stableColor } from './political-colors.js?v=20261106-1';
import { MAP_SCOPES, italyMapSvg } from './italy-map.js?v=20261106-1';
import { badge, card, esc, kpi, num, pct, sectionTabs } from './sections-kit.js?v=20261106-1';
import { glyph } from './visuals.js?v=20261106-1';

export const NIGHT_TABS = Object.freeze([['diretta', 'Diretta'], ['scrutinio', 'Scrutinio'], ['risultati', 'Risultati'], ['territorio', 'Territorio'], ['mappa', 'Mappa'], ['previsioni', 'Sondaggi e previsioni'], ['parlamento', 'Parlamento'], ['dichiarazioni', 'Dichiarazioni']]);
const TAG_TONE = Object.freeze({ 'EXIT POLL': 'info', PROIEZIONE: 'info', SONDAGGI: 'info', SCRUTINIO: 'good', RISULTATO: 'good', SORPASSO: 'warning', SORPRESA: 'warning', SOGLIA: 'warning', RIMONTA: 'warning', RIBALTAMENTO: 'warning', BALLOTTAGGIO: 'warning', MAGGIORANZA: 'good', DICHIARAZIONE: 'neutral', TU: 'good' });
const STAGE_LABEL = Object.freeze({ finale: 'Esito della consultazione', 'primo-turno': 'Primo turno: verso il ballottaggio' });
const colorOfGroup = (group, snapshot) => {
  if (!group) return '#8d9791';
  if (group.id === 'altri') return '#8d9791';
  const source = snapshot.groups.find(item => item.id === group.id);
  return forceColor(source?.partyIds?.[0] ?? group.id) ?? stableColor(group.id);
};
const swatch = color => `<i class="night-swatch" style="background:${esc(color)}" aria-hidden="true"></i>`;
const pcFmt = value => `${num(value, 1)}%`;
const deltaTag = (row, prev) => {
  const before = prev?.ballots ? prev.rows.find(item => item.id === row.id) : null;
  if (!before) return '';
  const d = Math.round((row.percent - before.percent) * 100) / 100;
  return Math.abs(d) < 0.05 ? '' : `<span class="night-delta ${d > 0 ? 'up' : 'down'}" aria-label="${esc(d > 0 ? 'in crescita' : 'in calo')}">${d > 0 ? '▲' : '▼'} ${num(Math.abs(d), 1)}</span>`;
};
const gapOf = view => { const [a, b] = view.rows.filter(row => row.id !== 'altri'); return a && b ? Math.round((a.percent - b.percent) * 100) / 100 : null; };
const hourLabel = (night, hour) => { const clock = nightClock(night, hour); return `${clock.label}${clock.dayOffset ? ' (+1)' : ''}`; };

// ---------- the frame ----------
function header(night, view) {
  const clock = nightClock(night, night.hour);
  const dots = Array.from({ length: NIGHT_HOURS }, (_, index) => { const h = index + 1; return `<li class="${h < night.hour ? 'done' : h === night.hour ? 'current' : ''}" aria-label="${esc(`Ora ${h}: ${hourLabel(night, h)}`)}"><b>${h}</b></li>`; }).join('');
  return `<header class="night-head">
    <div class="night-brand"><span class="night-live" aria-hidden="true"></span><div><span class="night-onair">IN DIRETTA</span> <span class="section-kicker">NOTTE ELETTORALE · ${esc(STAGE_LABEL[night.stage] ?? '')}</span><h2>${esc(night.electionLabel)}</h2><small>${esc(night.closeLabel.charAt(0).toUpperCase() + night.closeLabel.slice(1))} · unità di scrutinio simulate</small></div></div>
    <div class="night-clock" role="timer" aria-live="off"><strong>${esc(clock.label)}</strong><small>${esc(`Ora ${night.hour} di ${NIGHT_HOURS}${clock.dayOffset ? ' · giorno dopo' : ''}`)}</small></div>
  </header>
  <ol class="night-hours" aria-label="Le dodici ore dello speciale">${dots}</ol>
  <div class="night-progress" role="img" aria-label="${esc(`Scrutinio: ${view.counted} unità su ${view.units}`)}"><span style="width:${Math.round(view.shareCounted * 100)}%"></span><em>${view.counted}/${view.units} unità scrutinate</em></div>`;
}
function ticker(night) {
  const last = [...night.feed].reverse().find(item => item.kind !== 'dichiarazione' && item.kind !== 'giocatore') ?? night.feed.at(-1);
  return last ? `<div class="night-ticker" aria-live="polite"><span class="night-tag tone-${TAG_TONE[last.tag] ?? 'neutral'}">${esc(last.tag)}</span><span class="night-ticker-text">${esc(last.text)}</span></div>` : '';
}
function footer(night, summaryShown) {
  const done = night.hour >= NIGHT_HOURS;
  const next = night.hour + 1;
  const label = night.stage === 'primo-turno' ? 'Prosegui con il ballottaggio' : 'Concludi la Notte Elettorale';
  return `<footer class="night-foot">
    ${done ? `<button type="button" class="primary-button night-next" data-night-conclude>${glyph('check', 16)} ${esc(label)}</button>`
      : `<button type="button" class="primary-button night-next" data-night-next>${glyph('clock', 16)} Avanti: ora ${next} · ${esc(hourLabel(night, next))}</button>`}
    <small class="night-foot-note">${done ? 'Il risultato è definitivo. Non passa il tempo della carriera finché non concludi.' : 'Il tempo della carriera è sospeso: ogni pulsante fa avanzare solo lo speciale di un’ora.'}</small>
  </footer>`;
}

// ---------- the tabs ----------
function feedItem(item, fresh) {
  const tone = TAG_TONE[item.tag] ?? 'neutral';
  return `<article class="night-item kind-${esc(item.kind)}${fresh ? ' is-new' : ''}"><header><span class="night-tag tone-${tone}">${esc(item.tag)}</span><time>${esc(item.time)}</time></header><p>${esc(item.text)}</p></article>`;
}
function promptCards(night) {
  return pendingPrompts(night).map(prompt => `<section class="night-prompt" aria-label="Dichiarazione"><span class="section-kicker">LA TUA DICHIARAZIONE · ORA ${prompt.hour}</span><p>${esc(prompt.text)}</p>
    <div class="night-choices">${prompt.choices.map(([id, text]) => `<button type="button" class="ghost-button night-choice" data-night-say="${esc(prompt.id)}" data-night-say-choice="${esc(id)}">${esc(text)}</button>`).join('')}</div></section>`).join('');
}
function tabDiretta(night) {
  const lastHour = night.hour;
  const groups = [];
  for (let hour = lastHour; hour >= 1; hour--) {
    const items = night.feed.filter(item => item.hour === hour);
    if (items.length) groups.push(`<section class="night-hour-block"><h3><span>${esc(hourLabel(night, hour))}</span><small>Ora ${hour}</small></h3>${items.map(item => feedItem(item, hour === lastHour)).join('')}</section>`);
  }
  return `${promptCards(night)}<div class="night-feed">${groups.join('')}</div>`;
}
function tabScrutinio(night, view) {
  const { snapshot } = night;
  const unitsGrid = (() => {
    const done = view.counted;
    return `<div class="night-units" role="img" aria-label="${esc(`${done} unità contate su ${view.units}`)}">${nightUnitTiles(night, view)}</div>`;
  })();
  const hoursBars = Array.from({ length: NIGHT_HOURS }, (_, index) => { const h = index + 1; const v = nightView(night, h); return `<li class="${h <= night.hour ? 'on' : ''}" title="${esc(`Ora ${h}: ${v.counted} unità`)}"><i style="height:${Math.round(v.shareCounted * 100)}%"></i><b>${h}</b></li>`; }).join('');
  return `<div class="night-grid">
    ${card({ kicker: 'DATO UFFICIALE SIMULATO', title: 'Lo scrutinio', body: `<div class="sx-kpis night-kpis">
      ${kpi({ label: 'Unità scrutinate', value: `${view.counted}/${view.units}`, note: pct(view.shareCounted * 100, 0), bar: view.shareCounted * 100 })}
      ${kpi({ label: 'Voti scrutinati', value: num(view.ballots, 0), note: `su ${num(snapshot.totalVotes, 0)} voti validi` })}
      ${kpi({ label: 'Voti da scrutinare', value: num(Math.max(0, snapshot.totalVotes - view.ballots), 0), note: view.complete ? 'scrutinio chiuso' : 'ancora in arrivo' })}
      ${kpi({ label: 'Affluenza', value: snapshot.turnout !== null ? pcFmt(snapshot.turnout) : '—', note: 'dato finale' })}
    </div>${unitsGrid}<p class="night-note">Le unità di scrutinio sono <strong>simulate</strong>: il gioco non dispone delle sezioni elettorali reali e non inventa dati ufficiali. Ogni quadratino è un’unità; il colore è quello della lista in testa quando viene scrutinata.</p>` })}
    ${card({ kicker: 'ANDAMENTO', title: 'Unità scrutinate ora per ora', body: `<ol class="night-curve">${hoursBars}</ol>` })}
  </div>`;
}
function nightUnitTiles(night, view) {
  const tally = night.__tally;
  if (!tally) return '';
  return tally.units.map(unit => {
    if (unit.order >= view.counted) return '<i class="night-unit"></i>';
    let best = 0;
    unit.votes.forEach((value, index) => { if (value > unit.votes[best]) best = index; });
    return `<i class="night-unit on" style="background:${esc(colorOfGroup(tally.groups[best], night.snapshot))}"></i>`;
  }).join('');
}
function resultRows(night, view, proj, { showSeats, prev = null }) {
  const max = Math.max(1, ...view.rows.map(row => row.percent));
  return `<ol class="night-rows">${view.rows.filter(row => row.votes > 0 || view.complete).map(row => {
    const color = colorOfGroup(row, night.snapshot);
    const seats = proj.rows.find(item => item.id === row.id)?.seats ?? 0;
    return `<li class="${row.isPlayer ? 'is-player' : ''}"><span class="night-pos">${row.position}</span><div class="night-row-main"><div class="night-row-top"><strong>${swatch(color)}${esc(row.label)}${row.isPlayer ? ' ' + badge('Tu', 'good') : ''}</strong><span class="night-num">${pcFmt(row.percent)}${deltaTag(row, prev)}</span></div>
      <b class="night-bar"><i style="width:${Math.round(row.percent / max * 100)}%;background:${esc(color)}"></i></b>
      <small>${num(row.votes, 0)} voti${showSeats && seats ? ` · ${view.complete ? '' : '~'}${seats} seggi` : ''}</small></div></li>`;
  }).join('')}</ol>`;
}
function gapLine(night, view) {
  const gap = gapOf(view);
  if (gap === null) return '';
  const before = night.hour > 1 ? nightView(night, night.hour - 1) : null;
  const was = before?.ballots ? gapOf(before) : null;
  return `<p class="night-gap">${esc(was !== null && Math.abs(was - gap) >= 0.05 ? `Distacco tra primo e secondo: ${num(gap, 1)} punti (era ${num(was, 1)} un’ora fa)` : `Distacco tra primo e secondo: ${num(gap, 1)} punti`)}</p>`;
}
function tabRisultati(night, view, proj) {
  const { snapshot } = night;
  const officialLabel = view.complete ? 'RISULTATO DEFINITIVO' : 'RISULTATO PARZIALE UFFICIALE (SIMULATO)';
  return `${card({ kicker: officialLabel, title: view.complete ? 'Classifica finale' : `Classifica sui voti scrutinati (${pct(view.shareCounted * 100, 0)} delle unità)`, body: `${view.ballots ? resultRows(night, view, proj, { showSeats: night.hour >= 5 && snapshot.seatTotal > 0, prev: night.hour > 1 ? nightView(night, night.hour - 1) : null }) + gapLine(night, view) : '<p class="sx-empty">Lo scrutinio non è ancora iniziato: per ora ci sono solo l’affluenza e l’exit poll.</p>'}<p class="night-note">Le percentuali sono calcolate sui voti già scrutinati e cambiano a ogni ora. ${snapshot.seatTotal && !view.complete ? 'I seggi con «~» sono stime.' : ''}</p>` })}`;
}
function tabTerritorio(night, view, selected) {
  const rows = [...view.areas].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
  const chosen = rows.find(area => area.id === selected) ?? null;
  const stateChip = area => area.state === 'completo' ? badge('Completo', 'good') : area.state === 'in-corso' ? badge(`${area.counted}/${area.units} unità`, 'warning') : badge('In attesa', 'neutral');
  const list = rows.map(area => {
    const lead = area.top[0];
    return `<li><button type="button" class="night-area${area.id === selected ? ' active' : ''}" data-night-area="${esc(area.id)}"><span class="night-area-name"><strong>${esc(area.name)}</strong>${stateChip(area)}</span>${lead ? `<span class="night-area-lead">${swatch(colorOfGroup(lead, night.snapshot))}${esc(lead.label)} ${pcFmt(lead.percent)}</span>` : '<span class="night-area-lead muted">Nessun dato</span>'}</button></li>`;
  }).join('');
  const detail = chosen ? card({ kicker: chosen.state === 'completo' ? 'TERRITORIO COMPLETATO' : 'TERRITORIO IN SCRUTINIO', title: chosen.name, body: chosen.ballots ? `<ol class="night-rows compact">${chosen.top.map((row, index) => `<li><span class="night-pos">${index + 1}</span><div class="night-row-main"><div class="night-row-top"><strong>${swatch(colorOfGroup(row, night.snapshot))}${esc(row.label)}</strong><span class="night-num">${pcFmt(row.percent)}</span></div><b class="night-bar"><i style="width:${Math.round(row.percent)}%;background:${esc(colorOfGroup(row, night.snapshot))}"></i></b><small>${num(row.votes, 0)} voti</small></div></li>`).join('')}</ol><p class="night-note">${chosen.counted} unità su ${chosen.units} scrutinate.</p>` : '<p class="sx-empty">Per questo territorio lo scrutinio non è ancora iniziato.</p>' }) : '<p class="night-note">Tocca un territorio per vedere i risultati parziali.</p>';
  return `<div class="night-grid"><div><ul class="night-areas">${list}</ul></div><div>${detail}</div></div>`;
}
function mapTiles(night, view, selected) {
  return `<div class="night-tiles">${view.areas.map(area => `<button type="button" class="night-tile state-${area.state}${area.id === selected ? ' active' : ''}" data-night-area="${esc(area.id)}" style="--tile:${esc(area.leaderId ? colorOfGroup(area.top[0], night.snapshot) : 'transparent')}" aria-label="${esc(`${area.name}: ${area.leaderLabel ?? 'in attesa'}`)}"><strong>${esc(area.name.slice(0, 3).toUpperCase())}</strong><small>${esc((area.leaderLabel ?? '—').slice(0, 14))}</small></button>`).join('')}</div>`;
}
function tabMappa(night, view, selected, boundaries) {
  const regions = boundaries?.regions ?? [];
  const matched = regions.length ? view.areas.filter(area => regions.some(region => region.name === area.name)) : [];
  const useMap = matched.length >= 15;
  let body;
  if (useMap) {
    const byName = new Map(view.areas.map(area => [area.name, area]));
    const regionsTally = new Map(regions.map(region => { const area = byName.get(region.name); return [region.code, { leader: area?.leaderId ?? null, tie: false, total: area?.ballots ?? 0, ranked: (area?.top ?? []).map(item => [item.id, item.votes]), close: 0, missing: 0 }]; }));
    const groupOf = id => night.snapshot.groups.find(group => group.id === id);
    const svg = italyMapSvg({ boundaries, tallies: { regions: regionsTally, provinces: new Map() }, scope: MAP_SCOPES[0][0], selected: '', colorOf: id => colorOfGroup(groupOf(id) ?? { id }, night.snapshot), labelOf: id => groupOf(id)?.label ?? id });
    // the map was made for the districts of the national page: the labels that speak of «collegi» are cut to the name and the leader (the territory tab has the figures)
    const plain = svg.replace(/aria-label="([^"]*)"/g, (whole, label) => /collegi uninominali/.test(label) ? 'aria-label="Mappa dell’Italia per regioni: la lista in testa nelle unità scrutinate"' : `aria-label="${label.split('. ')[0]}"`);
    body = `<div class="night-map">${plain}</div>`;
  } else body = mapTiles(night, view, selected);
  const used = new Map();
  for (const area of view.areas) if (area.leaderId) used.set(area.leaderId, [area.leaderLabel, colorOfGroup(area.top[0], night.snapshot)]);
  const legend = `<ul class="nv-legend night-legend">${[...used.values()].map(([name, color]) => `<li>${swatch(color)}<span>${esc(name)}</span></li>`).join('')}<li>${swatch('#d7dcd9')}<span>In attesa di dati</span></li></ul>`;
  return card({ kicker: view.complete ? 'MAPPA DEFINITIVA' : 'MAPPA IN AGGIORNAMENTO', title: 'Chi vince in ogni territorio', body: `${body}${legend}<p class="night-note">${useMap ? 'Mappa delle regioni (confini ISTAT): il colore è la lista in testa nelle unità già scrutinate.' : 'Un riquadro per territorio: il colore è la lista in testa nelle unità già scrutinate; i riquadri vuoti attendono i primi dati.'}</p>` });
}
function tabPrevisioni(night, view, proj) {
  const { snapshot } = night;
  const exit = exitPoll(night);
  const pollRows = Object.entries(snapshot.poll).map(([id, share]) => ({ id, label: snapshot.groups.find(group => group.id === id)?.label ?? id, share })).sort((a, b) => b.share - a.share).slice(0, 8);
  const rows = (list, key = 'percent') => `<ol class="night-rows compact">${list.slice(0, 8).map((row, index) => `<li><span class="night-pos">${index + 1}</span><div class="night-row-main"><div class="night-row-top"><strong>${swatch(colorOfGroup(row, snapshot))}${esc(row.label)}</strong><span class="night-num">${pcFmt(row[key])}${row.margin ? ` <small>±${num(row.margin, 1)}</small>` : ''}</span></div></div></li>`).join('')}</ol>`;
  return `<div class="night-grid">
    ${card({ kicker: 'EXIT POLL · STIMA, NON UN RISULTATO', title: 'Exit poll all’uscita dei seggi', body: `${rows(exit.map(row => ({ ...row, margin: row.margin })))}<p class="night-note">Un exit poll è un sondaggio fatto all’uscita dal voto: ha un margine d’errore e non è il risultato.</p>` })}
    ${pollRows.length ? card({ kicker: 'ULTIMI SONDAGGI · VIGILIA', title: 'Cosa dicevano i sondaggi prima del voto', body: rows(pollRows.map(row => ({ ...row, percent: row.share }))) }) : ''}
    ${card({ kicker: view.complete ? 'PROIEZIONE · ORA COINCIDE CON IL RISULTATO' : 'PROIEZIONE · STIMA, NON UN RISULTATO', title: view.complete ? 'Il risultato definitivo' : `Proiezione sul voto completo (±${num(proj.margin, 1)} punti)`, body: `${rows(proj.rows)}<p class="night-note">${view.complete ? 'Lo scrutinio è chiuso: la proiezione non serve più.' : 'La proiezione completa le unità non ancora scrutinate con l’exit poll: il margine si restringe con il procedere dello scrutinio.'}</p>` })}
  </div>`;
}
function tabParlamento(night, view, proj) {
  const { snapshot } = night;
  if (!snapshot.seatTotal) return card({ kicker: 'SEGGI', title: 'Nessuna assemblea da ripartire', body: '<p class="sx-empty">Questa consultazione assegna una carica e non un’assemblea.</p>' });
  if (night.hour < 5 && !view.complete) return card({ kicker: 'SEGGI · STIME', title: 'Le prime stime sui seggi arrivano alla quinta ora', body: '<p class="sx-empty">Servono abbastanza unità scrutinate per stimare i seggi.</p>' });
  const rows = proj.rows.filter(row => row.seats > 0);
  const total = snapshot.seatTotal;
  const bar = `<div class="night-seatbar" role="img" aria-label="Ripartizione dei seggi">${rows.map(row => `<i style="flex:${row.seats};background:${esc(colorOfGroup(row, snapshot))}" title="${esc(`${row.label}: ${row.seats}`)}"></i>`).join('')}<u style="left:${(snapshot.majority / total * 100).toFixed(2)}%" title="Maggioranza"></u></div>`;
  const blocs = new Map();
  for (const row of rows) { const key = row.coalitionId ?? row.id; const slot = blocs.get(key) ?? { label: row.label, seats: 0 }; slot.seats += row.seats; blocs.set(key, slot); }
  const ranked = [...blocs.values()].sort((a, b) => b.seats - a.seats);
  return card({ kicker: view.complete ? 'SEGGI DEFINITIVI' : 'SEGGI · STIMA', title: `Distribuzione dei seggi (${total}, maggioranza a ${snapshot.majority})`, body: `${bar}
    <ol class="night-rows compact">${rows.map(row => `<li><span class="night-pos"></span><div class="night-row-main"><div class="night-row-top"><strong>${swatch(colorOfGroup(row, snapshot))}${esc(row.label)}</strong><span class="night-num">${view.complete ? '' : '~'}${row.seats}</span></div></div></li>`).join('')}</ol>
    ${ranked.length > 1 ? `<p class="night-note">Schieramenti: ${ranked.slice(0, 3).map(item => `${esc(item.label)} ${view.complete ? '' : '~'}${item.seats}`).join(' · ')}. ${ranked[0].seats >= snapshot.majority ? `${esc(ranked[0].label)} ${view.complete ? 'ha' : 'avrebbe'} la maggioranza.` : 'Nessuno raggiunge da solo la maggioranza.'}</p>` : ''}
    ${snapshot.seatNote ? `<p class="night-note">${esc(snapshot.seatNote)}</p>` : ''}` });
}
function tabDichiarazioni(night) {
  const items = night.feed.filter(item => item.kind === 'dichiarazione' || item.kind === 'giocatore').reverse();
  return `${promptCards(night)}${items.length ? `<div class="night-feed">${items.map(item => feedItem(item, false)).join('')}</div>` : '<p class="sx-empty">Nessuna dichiarazione ancora. Le prime arrivano con i primi dati.</p>'}`;
}
function summary(night, view, proj) {
  const { snapshot } = night;
  const final = view.rows.filter(row => row.id !== 'altri');
  const winner = final[0];
  const lines = [];
  if (night.stage === 'primo-turno') {
    const names = snapshot.runoffIds.map(id => snapshot.groups.find(group => group.id === id)?.label).filter(Boolean);
    lines.push(`Nessun candidato ha superato la soglia: al ballottaggio vanno ${names.join(' e ')}.`);
  } else if (winner) lines.push(`${winner.label} è davanti con ${pcFmt(winner.percent)}.`);
  const player = view.rows.find(row => row.isPlayer);
  if (player) lines.push(`Il tuo risultato: ${pcFmt(player.percent)}, ${player.position}º posto.`);
  if (player && night.stage === 'finale' && snapshot.outcome?.label) lines.push(snapshot.outcome.label);
  if (night.stage === 'finale' && snapshot.personalMandate !== null) lines.push(snapshot.personalMandate ? 'Hai conquistato il mandato.' : 'Non hai ottenuto il mandato.');
  return card({ kicker: 'RIEPILOGO FINALE', title: night.stage === 'primo-turno' ? 'Primo turno concluso' : 'Scrutinio concluso', tone: snapshot.personalMandate ? 'good' : '', body: `<ul class="night-summary">${lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>${resultRows(night, view, proj, { showSeats: snapshot.seatTotal > 0 })}` });
}

// ---------- entry point ----------
export function renderElectionNight(state, { tab = 'diretta', area = null, boundaries = null } = {}) {
  const night = state.night;
  if (!night) return '';
  const view = nightView(night);
  const proj = projection(night, view);
  const shown = { ...night, __tally: nightTallyOf(night) };
  const tabs = night.hour >= NIGHT_HOURS ? [['riepilogo', 'Riepilogo'], ...NIGHT_TABS] : NIGHT_TABS;
  const active = tabs.some(([id]) => id === tab) ? tab : (night.hour >= NIGHT_HOURS ? 'riepilogo' : 'diretta');
  const body = active === 'riepilogo' ? summary(shown, view, proj) : active === 'diretta' ? tabDiretta(shown) : active === 'scrutinio' ? tabScrutinio(shown, view)
    : active === 'risultati' ? tabRisultati(shown, view, proj) : active === 'territorio' ? tabTerritorio(shown, view, area) : active === 'mappa' ? tabMappa(shown, view, area, boundaries)
    : active === 'previsioni' ? tabPrevisioni(shown, view, proj) : active === 'parlamento' ? tabParlamento(shown, view, proj) : tabDichiarazioni(shown);
  return `<section class="night" data-night-stage="${esc(night.stage)}" data-night-hour="${night.hour}" data-night-type="${esc(night.electionType)}" aria-label="Notte Elettorale">
    ${header(night, view)}
    ${ticker(night)}
    ${sectionTabs('night', tabs, active).replace(/data-section-tab="night"/g, 'data-night-tab').replace(/data-section-tab-value=/g, 'data-night-tab-value=')}
    <div class="night-body" data-night-panel="${esc(active)}">${body}</div>
    ${footer(night)}
  </section>`;
}
import { nightTally } from '../core/night-engine.js?v=20261106-1';
const nightTallyOf = night => nightTally(night);
export { statementPromptFor };
