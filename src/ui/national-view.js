// The national cycle in the electoral centre (tab "Nazionali"): the calendar of the legislature and of the European
// elections, coalitions and national campaign, the seats projected on the real map of 2022, the last votes, the new
// Chambers and the formation of the Government. The map, the seats and the results of 2022 are real data (Eligendo);
// polls, coalitions, votes, seats and Governments of the game are simulation, and every block says which is which.
import { districtRows } from '../core/legislature-engine.js?v=20260926-5';
import { formatDate } from '../core/time.js?v=20260926-5';
import { SERIES } from './charts.js?v=20260926-5';
import { glyph } from './visuals.js?v=20260926-5';
import { arrow, badge, bar, card, esc, euro, kpi, num, pct, table } from './sections-kit.js?v=20260926-5';

export const NATIONAL_MAP_VIEWS = Object.freeze([['proiezione', 'Proiezione di oggi'], ['2022', 'Vincitori 2022 (reale)'], ['voto', 'Ultimo voto della partita']]);
const NEUTRAL = '#8d9791';
const CAMP_COLORS = { destra: SERIES[0], sinistra: SERIES[7], centro: SERIES[6] };
const ALLIANCES_2022 = { cdx: ['Centrodestra', SERIES[0]], csx: ['Centrosinistra', SERIES[7]], m5s: ['Movimento 5 Stelle', SERIES[3]], 'azione-iv': ['Azione – Italia Viva', SERIES[6]] };
const FORMATION_ORDER = ['insediamento', 'consultazioni', 'incarico', 'fiducia', 'completata'];
const day = date => date ? formatDate(date) : '—';
const shortDay = date => date ? formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const daysUntil = (from, to) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);

// Colours of the blocs: the camp of a coalition (centre-right blue, centre-left red, centre violet), the forces that
// run alone with the other validated series, the territorial lists neutral. Identity is never colour alone.
function palette(overview, result = null) {
  const colors = new Map();
  const coalitions = [...(result?.coalitions ?? []), ...(overview.coalitions ?? [])];
  for (const coalition of coalitions) if (!colors.has(coalition.id)) colors.set(coalition.id, CAMP_COLORS[coalition.camp] ?? SERIES[2]);
  const spare = [SERIES[3], SERIES[2], SERIES[4], SERIES[5], SERIES[1]];
  let next = 0;
  const forceColor = id => {
    if (colors.has(id)) return colors.get(id);
    if (String(id).startsWith('lista:')) return NEUTRAL;
    const color = spare[next++ % spare.length];
    colors.set(id, color);
    return color;
  };
  return { of: id => id ? forceColor(id) : NEUTRAL };
}
const labelOf = (overview, result = null) => id => {
  if (!id) return '—';
  return result?.coalitions?.find(item => item.id === id)?.label ?? overview.coalitions.find(item => item.id === id)?.label ?? result?.camera?.parties?.find(row => row.id === id)?.label ?? result?.national?.find(row => row.id === id)?.label ?? overview.forces.forces.find(force => force.id === id)?.label ?? String(id).replace(/^lista:/, '');
};
const swatch = color => `<i class="nv-swatch" style="background:${esc(color)}"></i>`;

// ---------- calendar ----------
function calendarCard(overview) {
  const { national, calendar, today, entries } = overview;
  const legislature = national.legislature;
  const politiche = entries.find(item => item.type === 'politiche');
  const europee = entries.find(item => item.type === 'europee');
  const formation = national.formation && !['completata'].includes(national.formation.phase) ? national.formation : null;
  const steps = [
    { date: legislature.firstSitting, label: `Prima seduta della ${legislature.label}`, note: legislature.reference === 'real' ? 'dato reale (13 ottobre 2022)' : 'legislatura simulata', done: legislature.firstSitting <= today },
    politiche ? { date: politiche.windowOpensAt, label: 'Si aprono le candidature per le politiche', note: `liste depositate entro il ${shortDay(politiche.windowClosesAt)}`, done: politiche.windowOpensAt <= today } : null,
    politiche ? { date: politiche.electionDate, label: politiche.early ? 'Elezioni politiche anticipate' : 'Elezioni politiche', note: politiche.early ? 'Camere sciolte prima della fine naturale' : `fine naturale della legislatura il ${shortDay(legislature.naturalEnd)}`, done: false, key: true } : null,
    europee ? { date: europee.electionDate, label: 'Elezioni europee', note: 'data da fissare: simulata la seconda domenica di giugno, poi ogni cinque anni', done: false, key: true } : null
  ].filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  const items = steps.map(item => `<li class="nv-step ${item.done ? 'is-done' : ''} ${item.key ? 'is-key' : ''}"><time>${esc(shortDay(item.date))}</time><span><strong>${esc(item.label)}</strong><small>${esc(item.note)}${!item.done && daysUntil(today, item.date) > 0 ? ` · tra ${num(Math.ceil(daysUntil(today, item.date) / 7), 0)} settimane` : ''}</small></span></li>`).join('');
  const kpis = [
    kpi({ label: 'Legislatura in corso', value: esc(legislature.label), note: legislature.reference === 'real' ? 'XIX legislatura reale, avviata il 13 ottobre 2022' : `nata dal voto del ${esc(shortDay(legislature.since))} (simulazione)` }),
    kpi({ label: 'Prossime politiche', value: politiche ? esc(shortDay(politiche.electionDate)) : '—', note: politiche?.early ? 'anticipate' : `fine naturale ${esc(shortDay(calendar.politiche.naturalEnd))}` }),
    kpi({ label: 'Prossime europee', value: europee ? esc(shortDay(europee.electionDate)) : esc(shortDay(calendar.europee.date)), note: '76 seggi all’Italia · soglia 4%' })
  ].join('');
  return card({ kicker: 'CALENDARIO NAZIONALE', title: 'Legislatura, politiche ed europee', body: `<div class="sx-kpis nv-kpis">${kpis}</div><ol class="nv-timeline">${items}</ol>${formation ? `<p class="sx-note">${glyph('dome', 14)} In corso: ${esc(overview.phases[formation.phase] ?? formation.phase)}.</p>` : ''}<p class="sx-note">Politiche ed europee seguono il calendario reale: la legislatura dura cinque anni dalla prima seduta e si vota poco prima della scadenza, salvo scioglimento anticipato. Comunali e regionali seguono il calendario reale di ogni comune e regione (ultimo voto da Eligendo, mandato di cinque anni): ogni anno si vota da qualche parte.</p>` });
}

// ---------- coalitions and national campaign ----------
function coalitionsCard(overview) {
  const { national, coalitions, options, forces, secretary, playerPartyId } = overview;
  const colors = palette(overview);
  const byId = new Map(forces.forces.map(force => [force.id, force]));
  const campaign = national.campaign;
  const inCoalition = new Set(coalitions.flatMap(item => item.partyIds));
  const rows = coalitions.map(coalition => {
    const members = coalition.partyIds.map(id => byId.get(id)).filter(Boolean);
    const share = members.reduce((sum, force) => sum + force.share, 0);
    return `<li class="nv-coalition"><header>${swatch(colors.of(coalition.id))}<strong>${esc(coalition.label)}</strong><b>${pct(share)}</b></header>${bar(share, '', 60)}<p>${members.map(force => `<span class="${force.id === playerPartyId ? 'is-player' : ''}">${esc(force.abbreviation || force.label)} ${pct(force.share)}${force.id === coalition.leaderId ? ' · guida' : ''}</span>`).join('')}</p></li>`;
  }).join('');
  const alone = forces.forces.filter(force => !inCoalition.has(force.id)).map(force => `<span class="${force.id === playerPartyId ? 'is-player' : ''}">${esc(force.abbreviation || force.label)} ${pct(force.share)}</span>`).join('');
  const choice = campaign?.playerChoice === 'alone' ? 'Il tuo partito corre da solo.' : campaign?.playerChoice ? `Il tuo partito corre in ${esc(coalitions.find(item => item.id === campaign.playerChoice)?.label ?? 'coalizione')}.` : '';
  let controls = '';
  if (campaign && !campaign.fixed && secretary && playerPartyId) {
    const buttons = options.filter(item => item.compatible).map(item => `<button type="button" class="secondary-button" data-national-coalition="${esc(item.id)}">Entra in ${esc(item.label)} · ${pct(item.chance * 100, 0)} · 1 giorno · 3 cap.</button>`).join('');
    controls = `<div class="nv-actions">${buttons}<button type="button" class="secondary-button" data-national-coalition="alone">Corri da solo</button><button type="button" class="text-link" data-national-coalition="auto">Decide la direzione</button></div><p class="sx-note">Le liste si depositano entro il ${esc(shortDay(campaign.filingDate))}: fino ad allora le coalizioni possono cambiare. Il leader della coalizione può dire di no.</p>`;
  } else if (campaign?.fixed) controls = `<p class="sx-note">${glyph('trophy', 14)} Liste depositate: le coalizioni sono fissate fino al voto del ${esc(day(campaign.electionDate))}.</p>`;
  else if (!campaign) controls = `<p class="sx-note">Le coalizioni si decidono quando si aprono le candidature per le politiche${overview.entries.find(item => item.type === 'politiche') ? ` (dal ${esc(shortDay(overview.entries.find(item => item.type === 'politiche').windowOpensAt))})` : ''}: oggi sono una stima, in base a collocazione, rapporti e alleanze tra i partiti.</p>`;
  else if (!secretary) controls = '<p class="sx-note">Con chi correre lo decide il segretario del partito.</p>';
  return card({ kicker: campaign ? `COALIZIONI PER LE POLITICHE · ${campaign.fixed ? 'LISTE DEPOSITATE' : 'IN TRATTATIVA'} · SIMULAZIONE` : 'COALIZIONI · STIMA DI OGGI · SIMULAZIONE', title: 'Chi corre con chi', body: `<ul class="nv-coalitions">${rows || '<li class="sx-empty">Nessuna coalizione: ogni forza corre da sola.</li>'}</ul>${alone ? `<p class="nv-alone"><small>DA SOLI</small>${alone}</p>` : ''}${choice ? `<p class="sx-note">${choice}</p>` : ''}${controls}` });
}
function campaignLineCard(overview, state) {
  const { national, lines, secretary } = overview;
  const campaign = national.campaign;
  if (!campaign) return '';
  const treasury = state.game?.party?.org?.treasury?.balance ?? 0;
  const capital = state.game?.resources?.politicalCapital ?? 0;
  const rows = Object.values(lines).map(line => {
    const active = campaign.line === line.id;
    const affordable = capital >= line.cost.capital && treasury >= line.cost.treasury;
    const button = secretary && !active ? `<button type="button" class="secondary-button" data-national-line="${esc(line.id)}" ${affordable ? '' : `disabled title="Servono ${line.cost.capital} di capitale e ${euro(line.cost.treasury)} in tesoreria"`}>Scegli · ${line.cost.capital} cap. · ${esc(euro(line.cost.treasury))}</button>` : active ? badge('Linea attuale', 'good') : '';
    return `<li class="${active ? 'is-active' : ''}"><span><strong>${esc(line.label)}</strong><small>${esc(line.detail)}</small></span>${button}</li>`;
  }).join('');
  return card({ kicker: 'CAMPAGNA NAZIONALE DEL PARTITO · SIMULAZIONE', title: campaign.line ? `Linea: ${lines[campaign.line]?.label ?? campaign.line}` : 'Scegli la linea della campagna', body: `<ul class="nv-lines">${rows}</ul><p class="sx-note">${secretary ? 'La linea pesa ogni settimana sui sondaggi fino al voto; il voto utile premia le coalizioni e penalizza le piccole liste che corrono da sole.' : 'La linea della campagna nazionale la sceglie il segretario del partito.'}</p>` });
}

// ---------- seats ----------
function seatsBlock(result, chamber, overview, colors) {
  const data = result?.[chamber];
  if (!data) return '';
  const label = labelOf(overview, result);
  const blocs = [...data.coalitions.map(row => ({ id: row.id, seats: row.seats, uni: row.uni, prop: row.prop, estero: row.estero, share: row.share })), ...data.parties.filter(row => !row.coalitionId).map(row => ({ id: row.id, seats: row.seats, uni: row.uni, prop: row.prop, estero: row.estero, share: row.share }))].filter(row => row.seats > 0).sort((a, b) => b.seats - a.seats);
  const total = data.total || 1;
  const strip = `<div class="nv-seatbar" role="img" aria-label="${esc(`${chamber === 'camera' ? 'Camera' : 'Senato'}: ${blocs.map(row => `${label(row.id)} ${row.seats}`).join(', ')}; maggioranza ${data.majority}`)}">${blocs.map(row => `<i style="width:${row.seats / total * 100}%;background:${colors.of(row.id)}" title="${esc(`${label(row.id)}: ${row.seats}`)}"></i>`).join('')}<b style="left:${data.majority / total * 100}%" title="Maggioranza ${data.majority}"></b></div>`;
  const rows = blocs.map(row => `<li class="${row.seats >= data.majority ? 'is-majority' : ''}"><span>${swatch(colors.of(row.id))}<strong>${esc(label(row.id))}</strong><small>${pct(row.share)} · collegi ${num(row.uni, 0)} · proporzionale ${num(row.prop, 0)}${row.estero ? ` · estero ${num(row.estero, 0)}` : ''}${row.seats >= data.majority ? ' · maggioranza' : ''}</small></span><b>${num(row.seats, 0)}</b></li>`).join('');
  return `<div class="nv-chamber"><h4>${chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica'} <small>${num(total, 0)} seggi · maggioranza ${num(data.majority, 0)}</small></h4>${strip}<ul class="nv-seats">${rows}</ul></div>`;
}
function projectionCard(overview) {
  const projection = overview.projection;
  if (!projection) return card({ kicker: 'PROIEZIONE DEI SEGGI', title: 'Nessuna proiezione', body: '<p class="sx-empty">Servono i sondaggi del mondo politico per proiettare i seggi.</p>' });
  const colors = palette(overview, projection);
  const label = labelOf(overview, projection);
  const outcome = projection.winner ? `${label(projection.winner)} avrebbe la maggioranza in entrambe le Camere` : `Nessuna maggioranza: primo ${label(projection.largest)}`;
  const model = projection.model === 'geografia-2022' ? `Proiezione dai sondaggi simulati di oggi sui ${num(overview.geography.camera?.collegi ?? 147, 0)} + ${num(overview.geography.senato?.collegi ?? 74, 0)} collegi uninominali reali del 2022, con le soglie e il riparto proporzionale.` : 'Mappa elettorale del 2022 non ancora caricata: proiezione semplificata (stesse soglie, seggi in proporzione).';
  return card({ kicker: 'SE SI VOTASSE OGGI · PROIEZIONE SIMULATA', title: outcome, body: `${seatsBlock(projection, 'camera', overview, colors)}${seatsBlock(projection, 'senato', overview, colors)}<p class="sx-note">${esc(model)} Il giorno del voto indecisi, affluenza e sorprese locali spostano il risultato.</p>` });
}
function homeCard(overview) {
  const projection = overview.projection;
  const home = projection?.homeDistricts;
  if (!home?.camera && !home?.senato) return '';
  const label = labelOf(overview, projection);
  const colors = palette(overview, projection);
  const row = (chamber, district) => {
    if (!district) return '';
    const race = districtRows(projection, chamber).find(item => item.id === district.id);
    const alliance = ALLIANCES_2022[district.winner?.alliance]?.[0] ?? district.winner?.alliance ?? '—';
    return `<li><span class="nv-home-kind">${chamber === 'camera' ? 'Camera' : 'Senato'}</span><div><strong>${esc(district.name)}</strong><small>${esc(district.code)} · ${esc(district.region)} · ${num(district.electors, 0)} elettori (2022)</small><small>${district.winner ? `Nel 2022: ${esc(district.winner.name)} (${esc(alliance)}), ${pct(district.winner.share)}` : esc(district.baselineNote ?? 'Risultato 2022 non disponibile')}</small>${race ? `<small>Oggi: ${swatch(colors.of(race.w))} ${esc(label(race.w))} avanti di ${num(race.m)} punti${race.t?.[1] ? ` su ${esc(label(race.t[1][0]))}` : ''}</small>` : ''}</div></li>`;
  };
  return card({ kicker: 'I TUOI COLLEGI · MAPPA REALE 2022', title: 'Dove voti tu', body: `<ul class="nv-home">${row('camera', home.camera)}${row('senato', home.senato)}</ul><p class="sx-note">${home.approximate ? 'Il tuo comune non è stato ricondotto con certezza a un collegio: è indicato un collegio della tua provincia o regione.' : 'Collegi del comune scelto nella creazione del politico (codice ISTAT 2026).'} Candidandoti nell’uninominale corri qui come candidato della tua coalizione.</p>` });
}

// ---------- the map ----------
function mapCard(overview, geography, view) {
  if (!geography) return card({ kicker: 'MAPPA ELETTORALE 2022 · DATO REALE', title: 'Mappa in caricamento', body: '<p class="sx-empty">La mappa dei collegi (Eligendo) si carica in background: torna tra poco.</p>' });
  const last = overview.national.lastPolitiche;
  const mode = view === 'voto' && last ? 'voto' : view === '2022' ? '2022' : overview.projection ? 'proiezione' : '2022';
  const result = mode === 'voto' ? last : mode === 'proiezione' ? overview.projection : null;
  const colors = palette(overview, result);
  const label = labelOf(overview, result);
  const legend = new Map();
  const chambers = ['camera', 'senato'].map(chamber => {
    const rows = result ? districtRows(result, chamber, geography) : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    const regions = new Map();
    for (const district of geography[chamber].collegi) {
      const list = regions.get(district.region) ?? [];
      list.push(district);
      regions.set(district.region, list);
    }
    const lines = [...regions.entries()].map(([region, districts]) => {
      const cells = districts.map(district => {
        const race = byId.get(district.id);
        let id, color, text;
        if (mode === '2022') {
          const [name, tone] = ALLIANCES_2022[district.winner?.alliance] ?? [district.winner?.alliance ?? 'Non disponibile', NEUTRAL];
          id = district.winner?.alliance ?? 'nd'; color = district.winner ? tone : '#d7dcd9'; text = `${district.name} (${district.code}) · 2022: ${district.winner ? `${district.winner.name}, ${name}, ${num(district.winner.share)}%` : 'risultato non disponibile'}`;
          legend.set(id, [name, color]);
        } else {
          id = race?.w ?? 'nd'; color = race ? colors.of(race.w) : '#d7dcd9'; text = `${district.name} (${district.code}) · ${race ? `${label(race.w)}, margine ${num(race.m)} punti` : 'nessun dato'}`;
          if (race) legend.set(id, [label(race.w), color]);
        }
        return `<i class="nv-cell ${race && race.m < 4 && mode !== '2022' ? 'is-close' : ''}" style="background:${esc(color)}" title="${esc(text)}"></i>`;
      }).join('');
      return `<li><span>${esc(region)}</span><div class="nv-cells">${cells}</div><b>${districts.length}</b></li>`;
    }).join('');
    return `<div class="nv-map-chamber"><h4>${chamber === 'camera' ? 'Camera · 147 collegi uninominali' : 'Senato · 74 collegi uninominali'}</h4><ul class="nv-map">${lines}</ul></div>`;
  }).join('');
  const switcher = `<div class="nv-map-switch" role="group" aria-label="Cosa mostra la mappa">${NATIONAL_MAP_VIEWS.filter(([id]) => id !== 'voto' || last).filter(([id]) => id !== 'proiezione' || overview.projection).map(([id, text]) => `<button type="button" class="${mode === id ? 'active' : ''}" data-view-filter="nazionali" data-view-filter-value="${id}" aria-pressed="${mode === id}">${esc(text)}</button>`).join('')}</div>`;
  const legendHtml = `<ul class="nv-legend">${[...legend.values()].map(([name, color]) => `<li>${swatch(color)}<span>${esc(name)}</span></li>`).join('')}${mode !== '2022' ? '<li><i class="nv-swatch is-close"></i><span>Margine sotto 4 punti</span></li>' : ''}</ul>`;
  const kicker = mode === '2022' ? 'MAPPA DEI COLLEGI · VINCITORI 2022 · DATO REALE' : mode === 'voto' ? `MAPPA DEI COLLEGI · VOTO DEL ${shortDay(last.date).toUpperCase()} · SIMULAZIONE` : 'MAPPA DEI COLLEGI · PROIEZIONE · SIMULAZIONE';
  return card({ kicker, title: 'I collegi uninominali regione per regione', body: `${switcher}${legendHtml}<div class="nv-map-grid">${chambers}</div><p class="sx-note">Ogni quadrato è un collegio uninominale reale del 2022, nell’ordine ufficiale per regione (non è una carta geografica). Passa il puntatore per il nome del collegio. ${mode === '2022' ? 'Vincitori e alleanze: dati ufficiali Eligendo; in Trentino-Alto Adige il Senato 2022 non è nella copia dei dati.' : 'Vincitori simulati dal gioco.'}</p>` });
}
function contestedCard(overview, geography) {
  const projection = overview.projection;
  if (!projection || !geography) return '';
  const label = labelOf(overview, projection);
  const colors = palette(overview, projection);
  const names = new Map(['camera', 'senato'].flatMap(chamber => geography[chamber].collegi.map(item => [item.id, item])));
  const rows = [...(projection.contested?.camera ?? []).map(row => ({ ...row, chamber: 'Camera' })), ...(projection.contested?.senato ?? []).map(row => ({ ...row, chamber: 'Senato' }))].sort((a, b) => a.m - b.m).slice(0, 12).map(row => {
    const district = names.get(row.id);
    const second = row.t?.[1] ? `${swatch(colors.of(row.t[1][0]))}${esc(label(row.t[1][0]))}` : '—';
    return `<li><span><strong>${esc(district?.name ?? row.id)}</strong><small>${esc(row.chamber)} · ${esc(district?.code ?? '')} · nel 2022 ${esc(ALLIANCES_2022[row.f]?.[0] ?? row.f ?? 'risultato non disponibile')}</small><small class="nv-race">${swatch(colors.of(row.w))}${esc(label(row.w))} davanti a ${second}</small></span><b>${num(row.m)}<small>punti</small></b></li>`;
  }).join('');
  const count = (projection.contested?.camera?.length ?? 0) + (projection.contested?.senato?.length ?? 0);
  return card({ kicker: 'COLLEGI IN BILICO · PROIEZIONE SIMULATA', title: `${num(count, 0)} collegi sotto i 4 punti`, body: rows ? `<ul class="nv-contested">${rows}</ul>${count > 12 ? `<p class="sx-note">I 12 più incerti; tutti i collegi sono nella mappa qui sotto (bordo chiaro).</p>` : ''}` : '<p class="sx-empty">Nessun collegio in bilico: i margini sono tutti sopra i 4 punti.</p>' });
}

// ---------- after the vote ----------
function lastVoteCard(overview, state) {
  const last = overview.national.lastPolitiche;
  if (!last) return '';
  const colors = palette(overview, last);
  const label = labelOf(overview, last);
  const lists = last.national.filter(row => row.share >= 1 || row.isPlayer).map(row => ({ _class: row.isPlayer ? 'is-player' : '', name: `${swatch(colors.of(row.coalitionId ?? row.id))} <strong>${esc(row.label)}</strong>${row.coalitionId ? `<small>${esc(label(row.coalitionId))}</small>` : '<small>da sola</small>'}`, share: pct(row.share), camera: num(last.camera.parties.find(item => item.id === row.id)?.seats ?? 0, 0), senato: num(last.senato.parties.find(item => item.id === row.id)?.seats ?? 0, 0) }));
  const player = last.player;
  const own = player ? `<p class="sx-note">${glyph(player.mandate ? 'trophy' : 'alert', 14)} La tua candidatura (${player.chamber === 'senato' ? 'Senato' : 'Camera'}): ${esc(player.mandate ? 'eletto' : 'non eletto')}${player.district ? ` · collegio ${esc(player.district.name)}, ${num(player.district.share)}%` : ''}${player.constituency?.name ? ` · lista in ${esc(player.constituency.name)}: ${num(player.constituency.seats, 0)} seggi` : ''}.</p>` : '';
  const outcome = last.winner ? `Vince ${label(last.winner)}` : `Nessuna maggioranza · primo ${label(last.largest)}`;
  return card({ kicker: `ELEZIONI POLITICHE DEL ${shortDay(last.date).toUpperCase()} · RISULTATO SIMULATO`, title: `${outcome} · affluenza ${pct(last.turnout)}`, body: `${seatsBlock(last, 'camera', overview, colors)}${seatsBlock(last, 'senato', overview, colors)}${table([['name', 'Lista'], ['share', '%', 'num'], ['camera', 'Camera', 'num'], ['senato', 'Senato', 'num']], lists)}${own}<p class="sx-note">Voto ${last.model === 'geografia-2022' ? 'contato sulla mappa reale del 2022 (collegi, circoscrizioni e seggi)' : 'contato con il modello semplificato'}: percentuali, seggi e coalizioni sono della partita.</p>` });
}
function formationCard(overview, state) {
  const formation = overview.national.formation;
  if (!formation) return '';
  const current = FORMATION_ORDER.indexOf(formation.phase);
  const stepper = FORMATION_ORDER.map((phase, index) => `<li class="${formation.phase === 'fallita' ? (index <= Math.max(0, current) ? 'is-done' : '') : index < current ? 'is-done' : index === current ? 'is-current' : ''}"><span>${esc(overview.phases[phase] ?? phase)}</span></li>`).join('');
  const steps = [...(formation.steps ?? [])].reverse().slice(0, 8).map(item => `<li><time>${esc(shortDay(item.date))}</time><span>${esc(item.text)}</span></li>`).join('');
  const government = state.parliament?.government;
  const status = formation.phase === 'fallita' ? badge('Camere sciolte', 'bad') : formation.phase === 'completata' ? badge('Governo in carica', 'good') : badge(overview.phases[formation.phase] ?? formation.phase, 'warn');
  const chambers = state.parliament?.legislature?.reference === 'simulation' ? ['camera', 'senato'].map(chamber => `<div><h4>${chamber === 'camera' ? 'Camera' : 'Senato'} · gruppi</h4><p class="nv-groups">${(state.parliament.chambers?.[chamber]?.groups ?? []).map(group => `<span class="${group.groupId === state.parliament.player?.groupId ? 'is-player' : ''}">${esc(group.officialName)} <b>${num(group.simulatedSeats, 0)}</b></span>`).join('')}</p></div>`).join('') : '';
  return card({ kicker: `${formation.crisis ? 'CRISI DI GOVERNO' : 'DOPO IL VOTO'} · FORMAZIONE DEL GOVERNO · SIMULAZIONE`, title: government && formation.phase === 'completata' ? government.name : 'Verso il nuovo governo', action: status, body: `<ol class="nv-stepper">${stepper}</ol>${formation.majority ? `<p class="sx-note">Maggioranza: <b>${esc(formation.majority.label ?? 'nuova maggioranza')}</b> (${esc(formation.majority.partyIds.map(labelOf(overview, overview.national.lastPolitiche)).join(', '))}).</p>` : ''}<ol class="nv-log">${steps}</ol>${chambers ? `<div class="nv-chambers">${chambers}</div>` : ''}<div class="sx-actions"><button class="text-link" data-nav="governo">Palazzo Chigi ${arrow}</button><button class="text-link" data-nav="parlamento">Le nuove Camere ${arrow}</button></div>` });
}
function europeanCard(overview) {
  const last = overview.national.lastEuropee;
  if (!last) return '';
  const rows = last.national.filter(row => row.share >= 1 || row.isPlayer).map(row => `<li class="${row.isPlayer ? 'is-majority' : ''}"><span><strong>${esc(row.label)}</strong><small>${pct(row.share)} · ${row.share >= last.threshold ? 'sopra la soglia' : 'sotto la soglia: nessun seggio'}${row.isPlayer ? ' · il tuo partito' : ''}</small></span><b>${num(row.seats, 0)}</b></li>`).join('');
  return card({ kicker: `ELEZIONI EUROPEE DEL ${shortDay(last.date).toUpperCase()} · RISULTATO SIMULATO`, title: `${num(last.seats, 0)} seggi · affluenza ${pct(last.turnout)}`, body: `<ul class="nv-seats">${rows}</ul><p class="sx-note">Soglia nazionale del 4% (dato reale); riparto nazionale e circoscrizioni simulati.</p>` });
}
function historyCard(overview) {
  const votes = overview.national.votes ?? [];
  const log = (overview.national.history ?? []).slice(0, 12);
  if (!votes.length && !log.length) return '';
  const rows = votes.map(vote => `<li><time>${esc(shortDay(vote.date))}</time><span><b>${vote.type === 'europee' ? 'Europee' : 'Politiche'}</b> · ${esc(vote.type === 'europee' ? vote.lists.slice(0, 3).map(item => `${item.label} ${num(item.seats, 0)}`).join(' · ') : vote.winnerLabel ? `vince ${vote.winnerLabel}` : 'nessuna maggioranza')} · affluenza ${pct(vote.turnout)}</span></li>`).join('');
  return card({ kicker: 'STORIA NAZIONALE DELLA PARTITA · SIMULAZIONE', title: votes.length ? `${num(votes.length, 0)} ${votes.length === 1 ? 'voto nazionale' : 'voti nazionali'}` : 'Ancora nessun voto nazionale', body: `${rows ? `<ol class="nv-log">${rows}</ol>` : ''}${log.length ? `<details class="nv-more"><summary>Cronaca del ciclo nazionale</summary><ol class="nv-log">${log.map(item => `<li><time>${esc(shortDay(item.date))}</time><span>${esc(item.text)}</span></li>`).join('')}</ol></details>` : ''}` });
}
function sourcesCard(overview) {
  const geography = overview.geography;
  const notes = overview.rules.notes.map(note => `<li>${esc(note)}</li>`).join('');
  const real = geography.loaded ? `<p>${badge('DATO REALE', 'good')} Mappa elettorale delle politiche del ${esc(day(geography.electionDate))}: ${num(geography.camera.collegi, 0)} collegi uninominali della Camera e ${num(geography.senato.collegi, 0)} del Senato, circoscrizioni, seggi e voti di lista. Fonte: <a href="${esc(geography.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(geography.sourceName)} ↗</a>${geography.mirror?.url ? ` · copia dei file ufficiali: <a href="${esc(geography.mirror.url)}" target="_blank" rel="noopener noreferrer">${esc(geography.mirror.name ?? 'mirror')} ↗</a>` : ''} · verificata il ${esc(day(geography.verifiedAt))}.</p>` : '<p class="sx-note">Mappa elettorale 2022 non ancora caricata.</p>';
  return card({ kicker: 'FONTI E REGOLE', title: 'Cosa è reale e cosa è simulato', body: `${real}<ul class="nv-notes">${notes}</ul>` });
}

export function renderNationalView(state, overview, { geography = null, view = null } = {}) {
  if (!overview) return '<p class="sx-empty">Ciclo nazionale non disponibile.</p>';
  const formationActive = overview.national.formation && !['completata'].includes(overview.national.formation.phase);
  return `<div class="national-view">
    <div class="sx-grid two">${calendarCard(overview)}${coalitionsCard(overview)}</div>
    ${formationActive ? formationCard(overview, state) : ''}
    ${campaignLineCard(overview, state)}
    <div class="sx-grid two">${projectionCard(overview)}<div class="nv-stack">${homeCard(overview)}${contestedCard(overview, geography)}</div></div>
    ${mapCard(overview, geography, view)}
    ${lastVoteCard(overview, state)}
    ${!formationActive ? formationCard(overview, state) : ''}
    <div class="sx-grid two">${europeanCard(overview)}${historyCard(overview)}</div>
    ${sourcesCard(overview)}
  </div>`;
}
