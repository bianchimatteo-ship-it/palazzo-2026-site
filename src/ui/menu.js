// Main menu, how-to-play, settings, save slots and the end-of-week report.
import { SETTINGS_SCHEMA } from '../core/settings.js?v=20260925-2';
import { STAT_LABELS } from '../data/simulation/career-rules.js?v=20260925-2';
import { formatDate } from '../core/time.js?v=20260925-2';
import { illustration } from './illustrations.js?v=20260925-2';
import { glyph } from './visuals.js?v=20260925-2';
import { esc, signed } from './charts.js?v=20260925-2';

const when = iso => { try { return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return ''; } };
const MENU = [
  ['nuova', 'flag', 'Nuova partita', 'Crea il tuo politico e scegli da dove partire'],
  ['carica', 'book', 'Carica partita', 'Salvataggi, file esportati e importati'],
  ['account', 'users', 'Account e salvataggi online', 'Ritrova le tue carriere su ogni dispositivo'],
  ['guida', 'target', 'Come giocare', 'Obiettivo, tempo, decisioni, elezioni'],
  ['impostazioni', 'shield', 'Impostazioni', 'Audio, animazioni, salvataggi, accessibilità']
];

const HOW_TO = [
  ['Obiettivo', 'route', 'Costruisci una carriera nella politica italiana: dal consiglio comunale o dal Parlamento fino alla guida di un partito o del governo. Non c’è un solo finale: conta dove arrivi, quanto resisti e cosa lasci al Paese.'],
  ['Il tempo', 'clock', 'Ogni turno è una settimana con 6 giorni da spendere. Attività, decisioni e lavoro in Aula costano giorni, fondi o capitale politico. Quando hai finito, chiudi la settimana: il mondo va avanti anche senza di te.'],
  ['Decisioni', 'alert', 'Appuntamenti, eventi e situazioni arrivano in agenda. Ogni scelta mostra costi, effetti, rischi e conseguenze future: alcune tornano settimane dopo. Se non decidi, a fine settimana si applica la scelta più passiva.'],
  ['Ruoli e poteri', 'crown', 'Puoi fare solo ciò che il tuo ruolo permette: un iscritto partecipa, un dirigente organizza, un parlamentare lavora in Aula, il segretario decide linea, alleanze e candidature, il Presidente del Consiglio nomina i ministri e fissa l’agenda.'],
  ['Partito e avversari', 'flag', 'Il partito ha iscritti, sezioni, correnti, congressi e tesoreria. Gli altri partiti sono reali, ma le loro strategie, alleanze e reazioni sono simulate: possono proporti intese o attaccarti.'],
  ['Elezioni', 'ballot', 'Il calendario apre le finestre di candidatura. Preparazione, fondi, fondo elettorale, sostegno del partito, sondaggi e umore dei cittadini decidono come parte la campagna.'],
  ['Paese, cittadini e conseguenze', 'map', 'Una legge costa margine di bilancio, arriva sui territori, cambia l’umore dei gruppi di cittadini, finisce sui media e sposta i sondaggi. Il Quartier generale spiega il perché di ogni variazione.'],
  ['Dati reali e simulazione', 'shield', 'Partiti, parlamentari, gruppi, governo in carica, leggi e 2×1000 sono dati reali verificati e restano invariati. Tutto ciò che nasce dal gioco è simulazione; le correzioni dell’amministratore sono dati dell’utente.'],
  ['Salvataggi e account', 'book', 'Con un account le carriere si salvano anche online e si ritrovano su qualsiasi dispositivo; il browser ne tiene una copia per giocare offline. Senza account puoi comunque conservare fino a 5 partite nel browser ed esportarle su file.'],
  ['Carriera infinita', 'route', 'Non c’è una fine: né traguardi, né anni, né crolli di reputazione chiudono la partita. Una caduta costa incarichi e sostegni, ma si può sempre risalire.'],
  ['Difficoltà', 'shield', 'Facile, Normale o Difficile si scelgono all’inizio: cambiano risorse, frequenza delle crisi, esiti incerti, pazienza del partito e degli alleati, candidature e disciplina delle maggioranze.']
];

function continueCard(meta, lastSaved, unsaved) {
  return `<button class="menu-continue" data-menu="continua"><span class="menu-continue-kicker">${glyph('route', 16)} CONTINUA LA PARTITA</span><strong>${esc(meta.player)}</strong><span>${esc(meta.role ?? 'Senza incarico')} · ${esc(meta.party)}</span><small>Settimana ${meta.week} · ${esc(formatDate(meta.gameDate))} · ${esc(unsaved ? 'modifiche non salvate' : lastSaved)}</small></button>`;
}

function loadView({ hasCareer, meta, slots, error }) {
  const rows = slots.map(slot => `<article class="slot-row"><div><strong>${esc(slot.name)}</strong><span>${esc(slot.role ?? 'Senza incarico')} · ${esc(slot.party ?? '')}</span><small>Settimana ${slot.week} · ${esc(formatDate(slot.gameDate))} · salvato ${esc(when(slot.savedAt))}</small></div><button class="primary-button" data-slot-load="${esc(slot.id)}">Carica</button><button class="icon-text-button" data-slot-delete="${esc(slot.id)}" aria-label="Elimina ${esc(slot.name)}">${glyph('alert', 15)} Elimina</button></article>`).join('');
  return `<h2>Carica partita</h2><p class="section-subtitle">La partita in corso si salva da sola; qui conservi fino a 5 salvataggi e li porti su altri dispositivi con un file.</p>
    ${hasCareer ? `<article class="slot-row is-current"><div><strong>Partita in corso</strong><span>${esc(meta.player)} · ${esc(meta.role ?? 'Senza incarico')}</span><small>Settimana ${meta.week} · ${esc(formatDate(meta.gameDate))}</small></div><button class="secondary-button" data-menu-action="save-slot">Salva in uno slot</button><button class="secondary-button" data-menu-action="export">Esporta su file</button></article>` : ''}
    <div class="slot-list">${rows || '<p class="quiet-copy">Nessun salvataggio negli slot.</p>'}</div>
    <label class="menu-import"><input type="file" accept="application/json,.json" data-menu-import />${glyph('book', 16)} Importa una partita da file</label>
    ${error ? `<p class="menu-error" role="alert">${esc(error)}</p>` : ''}`;
}

// Account: sign up or sign in, then every career is also kept online and can be resumed on another device.
function accountView(account = {}) {
  const note = account.error ? `<p class="menu-error" role="alert">${esc(account.error)}</p>` : account.message ? `<p class="account-message" role="status">${esc(account.message)}</p>` : '';
  if (!account.available) return `<h2>Account e salvataggi online</h2><p class="section-subtitle">Gli account funzionano sul sito pubblicato. Da qui la partita resta salvata in questo browser: puoi esportarla su file dal menu Carica partita.</p>${note}`;
  if (!account.user) return `<h2>Account e salvataggi online</h2><p class="section-subtitle">Con un account le tue carriere si salvano online e le ritrovi su qualsiasi dispositivo. Il browser ne conserva comunque una copia per giocare anche senza connessione.</p>
    <div class="account-forms">
      <form class="account-form" data-account-form="login"><h3>Accedi</h3><label>Nome utente<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="24" /></label><label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8" /></label><button class="primary-button" type="submit" ${account.busy ? 'disabled' : ''}>${account.busy === 'login' ? 'Accesso in corso…' : 'Accedi'}</button></form>
      <form class="account-form" data-account-form="register"><h3>Crea un account</h3><label>Nome utente<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="24" placeholder="3–24 caratteri: a-z, 0-9, . _ -" /></label><label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="Almeno 8 caratteri" /></label><label>Ripeti la password<input name="confirm" type="password" autocomplete="new-password" required minlength="8" /></label><button class="secondary-button" type="submit" ${account.busy ? 'disabled' : ''}>${account.busy === 'register' ? 'Creazione in corso…' : 'Crea l’account'}</button><small>Non serve un indirizzo email. La password non lascia mai il tuo browser in chiaro: conservala con cura, non può essere recuperata.</small></form>
    </div>${note}`;
  const rows = (account.saves ?? []).map(save => `<article class="slot-row ${save.slot === account.currentSlot ? 'is-current' : ''}"><div><strong>${esc(save.name || save.meta?.player || 'Carriera')}</strong><span>${esc(save.meta?.role ?? 'Senza incarico')} · ${esc(save.meta?.party ?? '')}${save.meta?.difficulty ? ` · ${esc(save.meta.difficulty)}` : ''}</span><small>Settimana ${esc(save.meta?.week ?? '—')} · ${esc(save.meta?.gameDate ? formatDate(save.meta.gameDate) : '')} · online dal ${esc(when(save.updatedAt))} · revisione ${esc(save.revision)}</small></div><button class="primary-button" data-cloud-load="${esc(save.slot)}">Carica</button><button class="icon-text-button" data-cloud-delete="${esc(save.slot)}" aria-label="Elimina online ${esc(save.name || 'carriera')}">${glyph('alert', 15)} Elimina</button></article>`).join('');
  const conflict = account.conflict ? `<div class="account-conflict" role="alert"><strong>Su un altro dispositivo c’è una versione più recente di questa carriera</strong><small>Online: revisione ${esc(account.conflict.remote?.revision)} del ${esc(when(account.conflict.remote?.updatedAt))}. Scegli quale tenere.</small><div class="setting-actions"><button class="primary-button" data-conflict="download">Usa la versione online</button><button class="secondary-button" data-conflict="overwrite">Sovrascrivi con questa</button></div></div>` : '';
  return `<h2>Account e salvataggi online</h2><p class="section-subtitle">Connesso come <strong>${esc(account.user.username)}</strong>. La carriera in corso si sincronizza da sola dopo ogni salvataggio${account.lastSync ? ` · ultima sincronizzazione ${esc(when(account.lastSync))}` : ''}.</p>
    ${conflict}
    <div class="setting-actions"><button class="primary-button" data-account-action="sync" ${account.busy ? 'disabled' : ''}>${account.busy === 'sync' ? 'Sincronizzazione…' : 'Salva ora online'}</button><button class="secondary-button" data-account-action="refresh">Aggiorna elenco</button><button class="secondary-button" data-account-action="logout">Esci</button></div>
    <div class="slot-list">${rows || '<p class="quiet-copy">Nessuna carriera salvata online: la prossima volta che salvi, la carriera in corso comparirà qui.</p>'}</div>${note}`;
}

function guideView() {
  return `<h2>Come giocare</h2><p class="section-subtitle">Tutto quello che serve per iniziare, in due minuti.</p><div class="guide-grid">${HOW_TO.map(([title, icon, text]) => `<article class="guide-card">${glyph(icon, 20)}<div><strong>${esc(title)}</strong><p>${esc(text)}</p></div></article>`).join('')}</div>`;
}

export function settingsView(settings, { error = '' } = {}) {
  const groups = [['Audio', ['sound', 'volume']], ['Interfaccia', ['motion', 'density', 'textSize', 'contrast']], ['Notifiche', ['toasts', 'toastLength', 'weeklyReport']], ['Partita', ['autosave', 'weeksPerTurn']]];
  return `<h2>Impostazioni</h2><p class="section-subtitle">Valgono per tutte le partite in questo browser e si applicano subito.</p>
    ${groups.map(([title, keys]) => `<section class="settings-group"><h3>${esc(title)}</h3>${keys.map(key => { const spec = SETTINGS_SCHEMA[key]; return `<div class="setting-row"><span>${esc(spec.label)}</span><div class="segmented" role="group" aria-label="${esc(spec.label)}">${spec.options.map(([value, label]) => `<button data-setting-key="${key}" data-setting-value="${esc(value)}" class="${settings[key] === value ? 'active' : ''}" aria-pressed="${settings[key] === value}">${esc(label)}</button>`).join('')}</div></div>`; }).join('')}</section>`).join('')}
    <section class="settings-group"><h3>Dati di gioco</h3><div class="setting-actions"><button class="secondary-button" data-menu-action="export">Esporta la partita in corso</button><label class="secondary-button menu-import-inline"><input type="file" accept="application/json,.json" data-menu-import />Importa una partita</label><button class="secondary-button" data-menu-action="reset-settings">Ripristina le impostazioni</button><button class="secondary-button danger" data-menu-action="clear-saves">Elimina tutti i salvataggi</button></div><p class="parliament-note">L’archivio dell’amministratore e i loghi caricati restano separati e non vengono cancellati.</p></section>
    ${error ? `<p class="menu-error" role="alert">${esc(error)}</p>` : ''}`;
}

export function renderMainMenu(menu, context) {
  const { hasCareer, meta, lastSaved, unsaved, stats, settings } = context;
  const side = menu.view === 'carica' ? loadView(context) : menu.view === 'account' ? accountView(context.account) : menu.view === 'guida' ? guideView() : menu.view === 'impostazioni' ? settingsView(settings, context) : `<h2>La politica italiana, settimana dopo settimana</h2><p class="section-subtitle">Un gestionale di carriera in un mondo politico vivo: partiti, parlamentari, governo e leggi reali; tutto ciò che accade in partita è simulazione dichiarata.</p>
    <div class="menu-facts">${stats.map(([value, label]) => `<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('')}</div>`;
  return `<div class="main-menu">
    ${illustration('palazzo', 'menu-art')}
    <div class="menu-column">
      <div class="menu-brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><div><strong>POLITICANDO</strong><small>2026</small></div></div>
      <p class="menu-tagline">Una carriera nella politica italiana</p>
      ${hasCareer ? continueCard(meta, lastSaved, unsaved) : ''}
      <nav class="menu-list" aria-label="Menu principale">${MENU.map(([id, icon, label, detail]) => `<button class="menu-item ${menu.view === id ? 'active' : ''}" data-menu="${id}">${glyph(icon, 18)}<span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span></button>`).join('')}</nav>
      <p class="menu-footnote">Dati reali verificati · simulazione dichiarata · ${context.account?.user ? `salvataggi online come ${esc(context.account.user.username)}` : 'salvataggi nel browser, online con un account'}</p>
    </div>
    <section class="menu-panel" aria-live="polite">${side}</section>
  </div>`;
}

// End-of-week report: what moved, and why.
export function renderWeeklyReport(state) {
  const game = state.game;
  const report = game?.lastReport;
  if (!report) return '';
  const why = game.whyLast?.entries ?? [];
  const metrics = Object.entries(report.deltas ?? {}).filter(([metric]) => STAT_LABELS[metric]);
  const reasons = metric => why.filter(entry => entry.metric === metric).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
  const cards = metrics.map(([metric, delta]) => `<article class="report-metric ${delta > 0 ? 'up' : 'down'}"><header><span>${esc(STAT_LABELS[metric])}</span><strong>${signed(delta)}</strong></header>${reasons(metric).map(entry => `<small>${esc(entry.source)} <b>${signed(entry.delta)}</b></small>`).join('') || '<small>Effetto combinato della settimana</small>'}</article>`).join('');
  const urgent = game.inbox.filter(item => ['urgente', 'situazione'].includes(item.kind)).length;
  const player = state.world?.parties?.find(item => item.isPlayer);
  const poll = state.world?.polls?.at(-1);
  const row = player ? poll?.results?.find(item => item.partyId === player.id) : null;
  const consensus = row && poll.week >= report.week ? `<article class="report-metric ${row.delta >= 0 ? 'up' : 'down'} report-consensus"><header><span>Consenso di ${esc(player.label)}</span><strong>${signed(row.delta)}</strong></header>${(poll.why ?? []).slice(0, 4).map(entry => `<small>${esc(entry.label)} <b>${signed(entry.delta)}</b></small>`).join('') || '<small>Variazione dentro il margine d’errore</small>'}</article>` : '';
  return `<div class="modal-backdrop report-backdrop" data-report-close><section class="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
    <span class="section-kicker">RESOCONTO · SETTIMANA ${report.week}</span><h2 id="report-title">Com’è andata la settimana</h2>
    ${cards || consensus ? `<div class="report-metrics">${consensus}${cards}</div>` : '<p class="quiet-copy">Settimana stabile: nessun indicatore personale si è mosso.</p>'}
    <ul class="report-lines">${report.lines.slice(0, 8).map(line => `<li>${esc(line)}</li>`).join('')}</ul>
    <footer><span>${game.inbox.length} decisioni in agenda${urgent ? ` · ${urgent} urgenti` : ''}</span><button class="primary-button" data-report-close>Continua</button></footer>
  </section></div>`;
}
