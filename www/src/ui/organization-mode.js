// The party as an organisation, and the real parliamentarians the career deals with.
import { ORGANS, feeEffects, isPartyLeader, membershipOf, organOf, projectMembers, treasuryOutlook } from '../core/organization-engine.js?v=20261021-11';
import { affiliationOf, markForPerson } from './person-marks.js?v=20261021-11';
import { contactStance } from '../core/contacts-engine.js?v=20261021-11';
import { MEMBERSHIP, SELECTION_METHODS } from '../data/simulation/organization-rules.js?v=20261021-11';
import { artTile, glyph } from './visuals.js?v=20261021-11';
import { illustration } from './illustrations.js?v=20261021-11';
const weeks = count => `${count} ${count === 1 ? 'settimana' : 'settimane'}`;
import { esc, euro, levelState, lineChart, meter, num, SERIES, signed, sparkline, stateBadge, trendState } from './charts.js?v=20261021-11';

const TREND_LABELS = { crescita: 'In crescita', calo: 'In calo', stabile: 'Stabile' };

// The membership fee: what it is now, what it does week after week, and what each fee would do (members and money), so that the choice is made with the consequences in front.
const FEE_STEPS = Object.freeze([[0, 'Gratuita', 'leaf'], [10, 'Simbolica', 'heart'], [30, 'Ordinaria', 'users'], [60, 'Alta', 'trendUp'], [90, 'Molto alta', 'alert']]);
const pctChange = value => `${value >= 1 ? '+' : '−'}${Math.round(Math.abs(value - 1) * 100)}%`;
const eurosYear = value => `${num(Math.round(value / 10) * 10, 0)} €`;
function membershipCard(state, org, party) {
  const week = state.game.week.index;
  const membership = membershipOf(org), leader = isPartyLeader(party);
  const weekly = membership.weekly;
  const vitality = org.sections.reduce((sum, item) => sum + item.vitality * item.members, 0) / Math.max(1, org.members);
  const context = { members: org.members, cohesion: org.cohesion, vitality, climate: weekly?.drivers?.climate ?? 0 };
  const now = feeEffects(membership.fee, context);
  const wait = membership.changedWeek !== null ? Math.max(0, MEMBERSHIP.cooldownWeeks - (week - membership.changedWeek)) : 0;
  const locked = !leader ? 'La quota la decide la direzione nazionale: tu non ne fai parte.' : wait ? `Hai cambiato la quota di recente: si può cambiare di nuovo tra ${weeks(wait)}.` : '';
  const options = FEE_STEPS.map(([fee, label, icon]) => {
    const effect = feeEffects(fee, context), current = fee === membership.fee;
    const good = effect.joinMultiplier >= now.joinMultiplier && effect.leaveMultiplier <= now.leaveMultiplier;
    const moneyGain = effect.yearly - now.yearly, members = projectMembers(org, fee, context), memberDelta = members - org.members;
    return `<button type="button" class="fee-option ${current ? 'is-current' : ''}" data-membership-fee="${fee}" ${current || locked ? 'disabled' : ''} aria-pressed="${current}" aria-label="${esc(`Quota ${label}: ${fee} euro l’anno`)}"><span class="fee-top">${glyph(icon, 16)}<strong>${esc(label)}</strong><b>${fee} €</b></span>
      <span class="fee-chips"><span class="fee-chip ${effect.joinMultiplier >= 1 ? 'up' : 'down'}">Adesioni ${esc(pctChange(effect.joinMultiplier / now.joinMultiplier))}</span><span class="fee-chip ${effect.leaveMultiplier <= 1 ? 'up' : 'down'}">Abbandoni ${esc(pctChange(effect.leaveMultiplier / now.leaveMultiplier))}</span></span>
      <span class="fee-members ${memberDelta >= 0 ? 'up' : 'down'}">Iscritti tra un anno ≈ ${num(members, 0)} (${memberDelta >= 0 ? '+' : '−'}${num(Math.abs(memberDelta), 0)})</span>
      <span class="fee-money ${moneyGain >= 0 ? 'up' : 'down'}">Entrate ≈ ${eurosYear(effect.yearly)}/anno${current ? ' · in vigore' : ` (${moneyGain >= 0 ? '+' : '−'}${eurosYear(Math.abs(moneyGain))})`}</span></button>`;
  }).join('');
  const drivers = weekly?.drivers;
  const chip = (label, value, positive, negative) => `<li class="driver ${value > 0.15 ? 'up' : value < -0.15 ? 'down' : ''}"><span>${esc(label)}</span><b>${value > 0.15 ? esc(positive) : value < -0.15 ? esc(negative) : 'neutro'}</b></li>`;
  const driverList = drivers ? `<ul class="fee-drivers" aria-label="Che cosa muove gli iscritti">${chip('Consenso e clima', drivers.climate, 'favorevole', 'sfavorevole')}${chip('Vitalità delle sezioni', drivers.sections, 'alta', 'bassa')}${chip('Coesione del partito', drivers.unity, 'alta', 'bassa')}<li class="driver ${drivers.treasuryRed ? 'down' : ''}"><span>Tesoreria</span><b>${drivers.treasuryRed ? 'in rosso' : 'in ordine'}</b></li><li class="driver ${drivers.conflict ? 'down' : ''}"><span>Scontri interni</span><b>${drivers.conflict ? 'accesi' : 'sotto controllo'}</b></li></ul>` : '<p class="parliament-note">Le cause si leggono dopo la prima settimana di gioco.</p>';
  const weekText = weekly ? `<strong class="${weekly.net > 0 ? 'good' : weekly.net < 0 ? 'bad' : ''}">${weekly.net > 0 ? '+' : weekly.net < 0 ? '−' : ''}${num(Math.abs(weekly.net), 0)}</strong><span>${num(weekly.joins, 0)} adesioni · ${num(weekly.leaves, 0)} abbandoni</span>` : '<strong>—</strong><span>prima settimana in corso</span>';
  const custom = leader ? `<div class="fee-custom"><label>Un’altra cifra<input type="number" inputmode="numeric" min="${MEMBERSHIP.min}" max="${MEMBERSHIP.max}" step="1" value="${membership.fee}" data-membership-custom ${wait ? 'disabled' : ''} /></label><button type="button" class="secondary-button" data-membership-apply ${wait ? 'disabled' : ''}>Applica quota</button></div>` : '';
  const last = membership.history.at(-1);
  return `<section class="membership-card" data-membership aria-label="Quota di tesseramento">
    <div class="home-section-heading"><div><span class="section-kicker">TESSERAMENTO · QUOTA ANNUALE · SIMULAZIONE</span><h3>Quota di ${membership.fee} € l’anno</h3><p class="section-subtitle">${esc(now.index > 1.15 ? 'Più alta di quanto gli iscritti accettano oggi: scoraggia le adesioni e spinge qualcuno ad andarsene.' : now.index < 0.7 ? 'Più bassa di quanto gli iscritti accettano: aiuta la crescita ma lascia soldi sul tavolo.' : 'In linea con quanto gli iscritti sono disposti a pagare oggi.')}</p></div>${stateBadge(now.index > 1.4 ? 'crisi' : now.index > 1.1 ? 'rischio' : 'solida', now.index > 1.4 ? 'Quota pesante' : now.index > 1.1 ? 'Quota alta' : now.index < 0.5 ? 'Quota leggera' : 'Quota equilibrata')}</div>
    <div class="fee-kpis"><div class="k-members"><small>ISCRITTI</small><strong>${num(org.members, 0)}</strong><span>${esc(TREND_LABELS[trendState(org.growth, { threshold: 0.05 })])}</span></div><div class="k-week"><small>ULTIMA SETTIMANA</small>${weekText}</div><div class="k-income"><small>QUOTE INCASSATE</small><strong>${euro(weekly?.income ?? 0)}</strong><span>${weekly ? `${num(weekly.payers, 0)} paganti su ${num(org.members, 0)} (${num((weekly.collected ?? 1) * 100, 0)}%)` : 'a settimana'}</span></div><div class="k-year"><small>STIMA ANNUA</small><strong>${euro(now.yearly)}</strong><span>quota accettata ≈ ${num(now.accepted, 0)} €</span></div></div>
    ${driverList}
    <h4 class="fee-heading">Che cosa farebbe ogni quota</h4><p class="parliament-note">Le percentuali dicono quanto cambiano ogni settimana adesioni e abbandoni rispetto a oggi; la stima a un anno tiene fermi clima, coesione e sezioni (è una guida, non una promessa). Il costo del partito non dipende dalla quota: più entrate non significano più spese.</p>
    <div class="fee-options" role="group" aria-label="Scegli la quota annuale">${options}</div>${custom}
    ${locked ? `<p class="fee-note" role="status">${esc(locked)}</p>` : ''}${last ? `<p class="parliament-note">Ultimo cambio: settimana ${last.week}, da ${last.from} a ${last.to} €. ${membership.shock > 0.0005 ? 'Il rialzo si sente ancora tra gli iscritti.' : membership.boost > 0.0005 ? 'Il taglio sta ancora attirando nuovi iscritti.' : ''}</p>` : ''}
  </section>`;
}

export function renderOrganizationPanel(state) {
  const game = state.game;
  const party = game?.party;
  const org = party?.org;
  if (!org) return '';
  const organ = organOf(party);
  const weeksToCongress = org.congress.nextWeek - game.week.index;
  const growthState = trendState(org.growth, { threshold: 0.05 });
  const [cohesionState, cohesionLabel] = levelState(org.cohesion, { crisis: 30, risk: 45, good: 65 });
  const sections = [...org.sections].sort((a, b) => b.members - a.members);
  const history = (org.membersHistory ?? []).slice(-26);
  const selections = Object.values(org.selections ?? {}).slice(-4).reverse();
  const organs = ORGANS.map(item => `<li class="${item.level === organ.level ? 'current' : item.level < organ.level ? 'done' : ''}"><span>${esc(item.label)}</span><small>${esc(item.scope)}</small></li>`).join('');
  return `<section class="party-org">
    ${illustration('piazza', 'org-art')}<div class="home-section-heading"><div><span class="section-kicker">IL PARTITO COME ORGANIZZAZIONE · SIMULAZIONE</span><h2>Siedi in: ${esc(organ.label)}</h2><p class="section-subtitle">${esc(organ.detail)}</p></div>${stateBadge(cohesionState, `Coesione ${num(org.cohesion, 0)} · ${cohesionLabel}`)}</div>
    <div class="org-kpis">
      <div class="k-members"><small>ISCRITTI</small><strong>${num(org.members, 0)}</strong>${stateBadge(growthState, `${TREND_LABELS[growthState]} ${org.growth ? `${signed(org.growth)}%` : ''}`.trim())}</div>
      <div class="k-militants"><small>MILITANTI ATTIVI</small><strong>${num(org.militants, 0)}</strong><span>${num(org.members ? org.militants / org.members * 100 : 0, 0)}% degli iscritti</span></div>
      <div class="k-cadres"><small>DIRIGENTI</small><strong>${num(org.cadres, 0)}</strong><span>negli organi</span></div>
      <div class="k-sections"><small>SEZIONI</small><strong>${org.sections.length}</strong><span>${org.founder ? 'sezioni territoriali' : 'federazioni regionali'}</span></div>
      <div class="k-discipline"><small>DISCIPLINA PERSONALE</small><strong>${num(org.discipline, 0)}</strong>${meter(org.discipline, org.discipline < 35 ? 'danger' : '')}</div>
      <div class="k-treasury"><small>TESORERIA</small><strong>${euro(org.treasury.balance)}</strong><span>${esc(treasuryOutlook(org).statusLabel)}</span></div>
    </div>
    ${membershipCard(state, org, party)}
    <div class="org-grid">
      <div><div class="home-section-heading"><div><span class="section-kicker">ORGANI INTERNI</span></div></div><ol class="organ-ladder">${organs}</ol>
        <div class="org-agenda"><div>${glyph('crown', 18)}<span><strong>${org.founder ? 'Guidi il partito da fondatore' : weeksToCongress > 0 ? `Congresso ordinario tra ${weeks(weeksToCongress)}` : 'Congresso in corso'}</strong><small>${org.congress.history?.[0] ? `Ultimo congresso: vince ${esc(org.congress.history[0].winner)}${org.congress.history[0].backed ? ' (la tua area)' : ''}` : 'Il congresso elegge la guida e ridisegna gli organi.'}</small></span></div>
        ${selections.length ? selections.map(item => `<div>${glyph('ballot', 18)}<span><strong>${esc(item.election)}</strong><small>${esc(SELECTION_METHODS[item.method] ?? item.method)} · peso sulla candidatura ${signed(item.bonus, 0)}</small></span></div>`).join('') : `<div>${glyph('ballot', 18)}<span><strong>Selezione dei candidati</strong><small>Si apre tre settimane prima di ogni finestra di candidatura.</small></span></div>`}</div>
      </div>
      <div><div class="home-section-heading"><div><span class="section-kicker">ISCRITTI NEL TEMPO</span></div></div>${lineChart({ series: [{ label: 'Iscritti', color: SERIES[0], values: history.map(item => item.members), emphasis: true }], labels: history.map(item => `S${item.week}`), tips: history.map(item => `Settimana ${item.week}`), digits: 0, height: 180, ariaLabel: 'Iscritti al partito per settimana' })}</div>
    </div>
    ${org.conflicts.length ? `<div class="home-section-heading"><div><span class="section-kicker">CONFLITTI APERTI</span></div></div><div class="conflict-list">${org.conflicts.map(conflict => `<div class="conflict-row">${stateBadge(conflict.intensity >= 70 ? 'crisi' : 'rischio', conflict.intensity >= 70 ? 'Scontro aperto' : 'Tensione')}<span>${esc(conflict.title)}</span>${meter(conflict.intensity, conflict.intensity >= 70 ? 'danger' : 'gold')}</div>`).join('')}</div>` : ''}
    <div class="home-section-heading"><div><span class="section-kicker">${org.founder ? 'SEZIONI TERRITORIALI' : 'FEDERAZIONI REGIONALI'}</span></div></div>
    <div class="section-grid">${sections.slice(0, 12).map(section => `<div class="section-tile ${section.region === game.place.region ? 'is-home' : ''}" data-tip="${esc(`${section.label}: ${num(section.members, 0)} iscritti · vitalità ${section.vitality}`)}" tabindex="0"><strong>${esc(section.region)}</strong><small>${num(section.members, 0)} iscritti</small>${meter(section.vitality, section.vitality < 25 ? 'danger' : section.vitality >= 60 ? 'good' : '')}</div>`).join('')}</div>
    ${sections.length > 12 ? `<p class="parliament-note">e altre ${sections.length - 12} federazioni.</p>` : ''}
    <p class="parliament-note">Iscritti, sezioni, organi, conflitti e tesoreria sono una simulazione di gioco anche quando il partito è reale: non descrivono l’organizzazione effettiva del partito.</p>
  </section>`;
}

export function renderPartyCard(state) {
  const party = state.game?.party;
  const org = party?.org;
  if (!org) return '<p class="dash-quiet">Sei indipendente: nessuna struttura alle spalle, nessuna leadership da convincere.</p>';
  const organ = organOf(party);
  const growthState = trendState(org.growth, { threshold: 0.05 });
  const tension = org.conflicts.some(item => item.intensity >= 70) ? ['crisi', 'Scontro interno'] : org.conflicts.length ? ['rischio', 'Tensioni'] : levelState(org.cohesion, { crisis: 30, risk: 45, good: 65 });
  return `<div class="dash-body"><div class="dash-number"><strong>${num(party.support, 0)}</strong><small>/100 sostegno interno</small>${stateBadge(tension[0], tension[1])}</div><p class="dash-role">${glyph('flag', 14)} ${esc(party.rankTitle)} · ${esc(organ.label)}</p><dl class="dash-facts"><div><dt>Iscritti</dt><dd>${num(org.members, 0)} ${org.growth ? `<em class="${growthState}">${signed(org.growth)}%</em>` : ''}</dd></div><div><dt>Sezioni</dt><dd>${org.sections.length}</dd></div><div><dt>Coesione</dt><dd>${num(org.cohesion, 0)}</dd></div><div><dt>Tesoreria</dt><dd>${euro(org.treasury.balance)}</dd></div></dl>${sparkline((org.membersHistory ?? []).slice(-12).map(item => item.members))}</div>`;
}

const REASONS = { territorio: 'Eletto nel tuo territorio', gruppo: 'Collega di gruppo', capogruppo: 'Presidente di gruppo' };
export function renderContactsPanel(state, { compact = false } = {}) {
  const contacts = state.game?.contacts ?? [];
  if (!contacts.length) return `<p class="quiet-copy">I parlamentari reali legati al tuo territorio e al tuo gruppo compariranno qui appena caricato l’archivio del Parlamento.</p>`;
  const busy = !state.game || state.game.status === 'ended' || state.game.week.ap < 1 || state.game.resources.politicalCapital < 1 || state.campaign?.status === 'active';
  const rows = [...contacts].sort((a, b) => b.relation - a.relation).slice(0, compact ? 4 : contacts.length).map(contact => {
    const [stance, label] = contactStance(contact.relation);
    const person = contact.person;
    const chamber = person.chamber === 'senato' ? 'Senato' : 'Camera';
    return `<article class="contact-card stance-${stance}"><header>${affiliationOf(person.id) ? markForPerson(person.id, 'md') : artTile(person.chamber === 'senato' ? 'dome' : 'users', stance === 'ostile' ? '#C4574A' : stance === 'alleato' ? '#4C8F6B' : '#3C7C95', 'sm')}<div><strong>${esc(person.fullName)}</strong><small>${esc(chamber)} · ${esc(person.groupName ?? 'Gruppo non indicato')}${person.circoscription ? ` · ${esc(person.circoscription)}` : ''}</small>${person.verifiedRole ? `<small class="verified-role">${glyph('shield', 12)} ${esc(person.verifiedRole)}</small>` : ''}</div></header>
      <div class="contact-relation"><span>${esc(label)}</span>${meter(contact.relation, stance === 'ostile' ? 'danger' : stance === 'alleato' ? 'good' : '')}<b>${num(contact.relation, 0)}</b></div>
      <footer><span class="badge">${esc(REASONS[contact.reason] ?? 'Contatto')}</span>${contact.cosigned?.length ? `<span class="badge">${contact.cosigned.length} firme su tue proposte</span>` : ''}${compact ? '' : `${person.sourceUrl ? `<a class="catalog-source" href="${esc(person.sourceUrl)}" target="_blank" rel="noopener noreferrer">Scheda ufficiale ↗</a>` : ''}<button class="secondary-button" data-game-activity="incontro-parlamentare" data-activity-target-value="${esc(person.id)}" ${busy ? 'disabled' : ''}>Incontra · 1 giorno · 1 cap.</button>`}</footer></article>`;
  }).join('');
  return `<div class="contact-grid ${compact ? 'is-compact' : ''}">${rows}</div><p class="parliament-note">Persone reali: nome, Camera, gruppo, circoscrizione e incarichi vengono dal dataset verificato e non sono modificati. Rapporto, firme e iniziative nei loro confronti sono simulati dal gioco.</p>`;
}
