// Main menu, how-to-play, settings, save slots and the end-of-week report.
import { SETTINGS_SCHEMA } from '../core/settings.js?v=20260926-7';
import { STAT_LABELS } from '../data/simulation/career-rules.js?v=20260926-7';
import { formatDate } from '../core/time.js?v=20260926-7';
import { illustration } from './illustrations.js?v=20260926-7';
import { glyph } from './visuals.js?v=20260926-7';
import { esc, signed } from './charts.js?v=20260926-7';

const when = iso => { try { return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return ''; } };
const MENU = [
  ['nuova', 'flag', 'Nuova partita', 'Crea il tuo politico e scegli da dove partire'],
  ['carica', 'book', 'Carica partita', 'Salvataggi, file esportati e importati'],
  ['account', 'users', 'Account e salvataggi online', 'Ritrova le tue carriere su ogni dispositivo'],
  ['guida', 'target', 'Come giocare', 'Obiettivo, tempo, decisioni, elezioni'],
  ['impostazioni', 'shield', 'Impostazioni', 'Audio, animazioni, salvataggi, accessibilità']
];

// How to play: short sections, each with a concrete example.
const HOW_TO = [
  ['L’obiettivo', 'route', 'Costruisci una carriera nella politica italiana, dal consiglio comunale fino alla guida di un partito o del governo. Non c’è un finale unico né una fine: conta dove arrivi, quanto resisti e cosa lasci al Paese.', 'Parti consigliere a Siena, diventi segretario regionale, poi candidato alle politiche.'],
  ['Iniziare una partita', 'flag', 'Dal menu: Nuova partita. Scegli dove iniziare (Regione e Comune dall’elenco ISTAT), il percorso (comunale, regionale, deputato o senatore), il partito (indipendente, un partito reale o uno fondato da te) e la difficoltà; per ultimo crei il tuo politico.', 'Comune di Bari, percorso comunale, iscritto a un partito reale, difficoltà Normale.'],
  ['Il tempo', 'clock', 'Ogni turno è una settimana con 6 giorni da spendere. Quando hai finito premi «Chiudi la settimana»: il mondo va avanti anche senza di te. Nelle impostazioni puoi avanzare di 2 o 4 settimane per volta (ti viene chiesta conferma); la simulazione si ferma prima se arriva una decisione urgente.', 'Due giorni per un’assemblea di partito e uno per un’intervista: ne restano tre.'],
  ['Attività e decisioni', 'alert', 'Appuntamenti, eventi e situazioni arrivano in agenda. Ogni scelta mostra costi (giorni, fondi, capitale politico), effetti e rischi; alcune conseguenze tornano settimane dopo. Se non decidi, a fine settimana si applica la scelta più passiva.', 'Rispondere subito a una polemica ti dà visibilità ma può costarti reputazione.'],
  ['Ruoli e poteri', 'crown', 'Puoi fare solo ciò che il tuo ruolo permette: un iscritto partecipa, un dirigente organizza, un parlamentare lavora in Aula, il segretario decide linea, alleanze e candidature, il Presidente del Consiglio nomina i ministri e fissa l’agenda.', 'Da semplice deputato non puoi ritirare il sostegno al governo: lo decide il segretario.'],
  ['Partito', 'users', 'Il tuo partito ha iscritti, sezioni, correnti, congressi e tesoreria. Il sostegno interno cresce se porti risultati e rispetti la linea; scende con sconfitte e strappi.', 'Vincere un congresso ti rende segretario; perderlo ti mette in minoranza.'],
  ['Parlamento, governo e leggi', 'dome', 'All’inizio trovi in carica un governo simulato costruito sulla maggioranza reale: puoi sostenerlo, chiedere un ministero se hai i requisiti, aprire una crisi o formarne uno nuovo. Una legge passa per commissione, emendamenti, voto e altra Camera: servono i numeri.', 'Una proposta sulla sanità senza coperture rischia di fermarsi in commissione.'],
  ['Eventi', 'megaphone', 'Crisi, scandali, emergenze e buone notizie arrivano in base alla situazione, con tempi di attesa e catene di conseguenze. Nessun evento reale viene attribuito a persone reali: tutto è simulazione dichiarata.', 'Un’ondata di calore porta l’ambiente al centro: le forze ecologiste guadagnano attenzione.'],
  ['Consenso, sondaggi e media', 'chart', 'Il primo sondaggio della carriera è reale (Supermedia AGI/YouTrend del 24/09/2026); poi i sondaggi sono simulati e si muovono in modo graduale con eventi, governo e opposizione, alleanze, crisi ed elezioni. Le forze minori entrano o escono dai sondaggi solo quando è plausibile. Media e opinione pubblica reagiscono a ciò che fai.', 'Una legge approvata e ben comunicata vale qualche decimale in poche settimane, non 5 punti in una notte.'],
  ['Cittadini e territori', 'map', 'Venti regioni e i loro cittadini hanno umore, problemi e priorità diverse. Le misure arrivano sui territori in modo diverso e contano soprattutto alle elezioni locali.', 'Un investimento sui trasporti piace al Nord industriale più che alle aree interne.'],
  ['Finanze', 'money', 'Hai fondi personali e, se guidi il partito, la tesoreria; puoi accantonare un fondo per le elezioni. Da Presidente del Consiglio gestisci anche il bilancio pubblico: deficit, spread e manovra hanno conseguenze.', 'Spendere tutto in comunicazione può lasciarti senza fondi per la campagna.'],
  ['Elezioni', 'ballot', 'Il calendario apre le finestre di candidatura. Preparazione, fondi, sostegno del partito, alleanze, sondaggi e umore dei cittadini decidono come parte la campagna; il risultato cambia la tua carriera.', 'Alle comunali conta il radicamento; alle politiche pesano coalizione e sondaggi nazionali.'],
  ['Dati reali e simulazione', 'shield', 'Partiti, parlamentari, gruppi, governo in carica, leggi, 2×1000, comuni ISTAT e il primo sondaggio sono dati reali verificati, con la loro fonte, e non vengono modificati. Tutto ciò che nasce in partita è simulazione ed è indicato come tale.', 'Un parlamentare reale può essere tuo contatto, ma le sue reazioni in partita sono simulate.'],
  ['Salvataggi, account e sincronizzazione', 'book', 'La partita si salva da sola nel browser; puoi tenere fino a 5 salvataggi ed esportarli su file. Con l’account ogni carriera ha anche una copia online: accedi da un altro dispositivo e riprendi da dove eri; se due dispositivi hanno versioni diverse, scegli tu quale tenere.', 'Giochi sul computer, poi continui dal telefono con lo stesso account.'],
  ['Cosa cambia nel tempo', 'route', 'I partiti cambiano strategia, stringono o rompono intese, fanno congressi e possono dividersi; nuove forze possono emergere. Le tue scelte restano nella memoria politica per anni.', 'Rompere un’alleanza oggi rende più difficile ricucirla alle elezioni di dopodomani.'],
  ['Difficoltà', 'target', 'Facile, Normale o Difficile si scelgono all’inizio e restano per tutta la carriera: cambiano risorse, frequenza delle crisi, pazienza di partito e alleati, candidature e disciplina delle maggioranze.', 'In Difficile un alleato insoddisfatto lascia la maggioranza più in fretta.']
];

// First opening without an account: why the account, what it does with the careers.
const WELCOME_POINTS = [
  ['shield', 'Perché serve', 'Le carriere durano anni di gioco: l’account le tiene al sicuro anche se il browser viene svuotato o cambi dispositivo.'],
  ['book', 'Salvataggi e sincronizzazione', 'Ogni volta che la partita si salva, ne va una copia anche online: su un altro dispositivo accedi e riprendi da dove eri.'],
  ['globe', 'I salvataggi online', 'Online resta una copia di ogni carriera, con il numero di revisione. Se due dispositivi salvano versioni diverse, scegli tu quale tenere; puoi eliminare una copia online quando vuoi.'],
  ['route', 'Nessuna perdita', 'Il browser conserva comunque la sua copia per giocare anche senza connessione: passando da un dispositivo all’altro i dati della partita non si perdono.']
];
// After the registration: how POLITICANDO works, in five steps.
export const TOUR_STEPS = Object.freeze([
  ['map', 'Scegli da dove partire', 'Regione, Comune (elenco ISTAT), percorso, partito e difficoltà: il comune diventa il tuo territorio iniziale.'],
  ['clock', 'Una settimana alla volta', 'Hai 6 giorni a settimana per attività, riunioni, campagne e lavoro in Aula. Poi chiudi la settimana e il mondo reagisce.'],
  ['alert', 'Decisioni con conseguenze', 'Ogni scelta ha costi, effetti e rischi, anche a distanza di settimane: partito, alleati, media e cittadini se ne ricordano.'],
  ['chart', 'Consenso e sondaggi', 'Si parte dall’ultimo sondaggio reale; poi i sondaggi simulati si muovono in modo graduale con quello che succede, e con quello che fai tu.'],
  ['shield', 'Reale e simulato, sempre distinti', 'Partiti, parlamentari, governo e leggi sono reali e verificati; tutto ciò che accade in partita è simulazione dichiarata. Le tue carriere si salvano anche online.']
]);

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
  if (account.status === 'none' || (!account.status && !account.available)) return `<h2>Account e salvataggi online</h2><p class="section-subtitle">Gli account funzionano sul sito pubblicato. Da qui la partita resta salvata in questo browser: puoi esportarla su file dal menu Carica partita.</p>${note}`;
  // The service did not answer: said at once, with a new attempt and the local start (never a dead end).
  const down = !account.user && account.status === 'unreachable' ? `<div class="account-unreachable" role="status"><strong>Il servizio account non risponde in questo momento</strong><small>Puoi iniziare subito senza account: la partita resta salvata in questo browser e potrai collegarla al tuo account quando il servizio torna raggiungibile.</small><div class="setting-actions"><button class="primary-button" data-menu-action="start-local">Inizia senza account</button><button class="secondary-button" data-account-action="probe">Riprova</button></div></div>` : '';
  const checking = !account.user && account.status === 'checking' ? '<p class="parliament-note" role="status">Verifica del servizio account in corso…</p>' : '';
  if (!account.user) return `<h2>Account e salvataggi online</h2><p class="section-subtitle">Con un account le tue carriere si salvano online e le ritrovi su qualsiasi dispositivo. Il browser ne conserva comunque una copia per giocare anche senza connessione.</p>${down}${checking}
    <div class="account-forms ${account.mode ? `focus-${esc(account.mode)}` : ''}">
      <form class="account-form" data-account-form="login"><h3>Accedi</h3><label>Nome utente<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="24" /></label><label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8" /></label><button class="${account.mode === 'register' ? 'secondary-button' : 'primary-button'}" type="submit" ${account.busy ? 'disabled' : ''}>${account.busy === 'login' ? 'Accesso in corso…' : 'Accedi'}</button></form>
      <form class="account-form" data-account-form="register"><h3>Crea un account</h3><label>Nome utente<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="24" placeholder="3–24 caratteri: a-z, 0-9, . _ -" /></label><label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="Almeno 8 caratteri" /></label><label>Ripeti la password<input name="confirm" type="password" autocomplete="new-password" required minlength="8" /></label><button class="${account.mode === 'register' ? 'primary-button' : 'secondary-button'}" type="submit" ${account.busy ? 'disabled' : ''}>${account.busy === 'register' ? 'Creazione in corso…' : 'Crea l’account'}</button><small>Non serve un indirizzo email. La password non lascia mai il tuo browser in chiaro: conservala con cura, non può essere recuperata.</small></form>
    </div>${note}`;
  const rows = (account.saves ?? []).map(save => `<article class="slot-row ${save.slot === account.currentSlot ? 'is-current' : ''}"><div><strong>${esc(save.name || save.meta?.player || 'Carriera')}</strong><span>${esc(save.meta?.role ?? 'Senza incarico')} · ${esc(save.meta?.party ?? '')}${save.meta?.difficulty ? ` · ${esc(save.meta.difficulty)}` : ''}</span><small>Settimana ${esc(save.meta?.week ?? '—')} · ${esc(save.meta?.gameDate ? formatDate(save.meta.gameDate) : '')} · online dal ${esc(when(save.updatedAt))} · revisione ${esc(save.revision)}</small></div><button class="primary-button" data-cloud-load="${esc(save.slot)}">Carica</button><button class="icon-text-button" data-cloud-delete="${esc(save.slot)}" aria-label="Elimina online ${esc(save.name || 'carriera')}">${glyph('alert', 15)} Elimina</button></article>`).join('');
  const conflict = account.conflict ? `<div class="account-conflict" role="alert"><strong>Su un altro dispositivo c’è una versione più recente di questa carriera</strong><small>Online: revisione ${esc(account.conflict.remote?.revision)} del ${esc(when(account.conflict.remote?.updatedAt))}. Scegli quale tenere.</small><div class="setting-actions"><button class="primary-button" data-conflict="download">Usa la versione online</button><button class="secondary-button" data-conflict="overwrite">Sovrascrivi con questa</button></div></div>` : '';
  return `<h2>Account e salvataggi online</h2><p class="section-subtitle">Connesso come <strong>${esc(account.user.username)}</strong>. La carriera in corso si sincronizza da sola dopo ogni salvataggio${account.lastSync ? ` · ultima sincronizzazione ${esc(when(account.lastSync))}` : ''}.</p>
    ${conflict}
    <div class="setting-actions"><button class="primary-button" data-account-action="sync" ${account.busy ? 'disabled' : ''}>${account.busy === 'sync' ? 'Sincronizzazione…' : 'Salva ora online'}</button><button class="secondary-button" data-account-action="refresh">Aggiorna elenco</button><button class="secondary-button" data-account-action="logout">Esci</button></div>
    <div class="slot-list">${rows || '<p class="quiet-copy">Nessuna carriera salvata online: la prossima volta che salvi, la carriera in corso comparirà qui.</p>'}</div>${note}`;
}

function guideView() {
  return `<h2>Come giocare</h2><p class="section-subtitle">Le regole essenziali, sezione per sezione, con un esempio per ciascuna.</p><nav class="guide-index" aria-label="Sezioni della guida">${HOW_TO.map(([title], index) => `<a href="#guida-${index}" data-guide-jump="guida-${index}">${esc(title)}</a>`).join('')}</nav><div class="guide-grid">${HOW_TO.map(([title, icon, text, example], index) => `<article class="guide-card" id="guida-${index}">${glyph(icon, 20)}<div><strong>${esc(title)}</strong><p>${esc(text)}</p>${example ? `<p class="guide-example"><b>Esempio</b> ${esc(example)}</p>` : ''}</div></article>`).join('')}</div>`;
}
// First opening without an account: the account first, then the first career.
function welcomeView(account = {}, menu = {}) {
  const points = WELCOME_POINTS.map(([icon, title, text]) => `<article class="welcome-point">${glyph(icon, 20)}<div><strong>${esc(title)}</strong><p>${esc(text)}</p></div></article>`).join('');
  const status = account.status ?? (account.available ? 'available' : 'none');
  const blocked = menu.needAccount && status !== 'unreachable' ? '<p class="account-message" role="status">Per iniziare una nuova carriera crea il tuo account o accedi: bastano un nome utente e una password.</p>' : '';
  const offline = status === 'unreachable'
    ? '<p class="parliament-note" role="status">Il servizio account non risponde in questo momento: puoi iniziare subito, la partita resta salvata in questo browser e potrai collegarla a un account quando il servizio torna raggiungibile.</p><div class="setting-actions"><button class="primary-button" data-menu-action="start-local">Inizia senza account</button><button class="secondary-button" data-account-action="probe">Riprova</button></div>'
    : '<p class="parliament-note">Il servizio account non è raggiungibile da questa copia del gioco: puoi iniziare comunque, la partita resta salvata in questo browser e potrai collegarla a un account più avanti.</p><div class="setting-actions"><button class="primary-button" data-menu-action="start-local">Inizia senza account</button></div>';
  // While the service is being asked, the account comes first but the local start is already there.
  const checking = status === 'checking' ? '<p class="parliament-note" role="status">Verifica del servizio account in corso…</p><div class="setting-actions"><button type="button" class="secondary-button" data-menu-action="start-local">Inizia senza account</button></div>' : '';
  return `<span class="section-kicker">PRIMO AVVIO</span><h2>Prima di iniziare: il tuo account</h2><p class="section-subtitle">Un account personale conserva le tue carriere e le rende disponibili su ogni dispositivo.</p>${blocked}<div class="welcome-points">${points}</div>${['available', 'checking'].includes(status) ? `<div class="setting-actions welcome-actions"><button class="primary-button" data-menu="account" data-account-mode="register">Crea un account</button><button class="secondary-button" data-menu="account" data-account-mode="login">Ho già un account: accedi</button></div>${checking}<small class="welcome-note">Non serve un indirizzo email. La password non lascia mai il tuo browser in chiaro e non può essere recuperata: conservala con cura.</small>` : offline}`;
}
// After the registration: a short visual tour, skippable and shown once.
function tourView(step = 0) {
  const index = Math.max(0, Math.min(TOUR_STEPS.length - 1, Number(step) || 0));
  const [icon, title, text] = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;
  return `<span class="section-kicker">COME FUNZIONA · ${index + 1} DI ${TOUR_STEPS.length}</span><div class="tour-card"><span class="tour-icon">${glyph(icon, 34)}</span><h2>${esc(title)}</h2><p>${esc(text)}</p></div><div class="tour-dots" aria-hidden="true">${TOUR_STEPS.map((_, dot) => `<i class="${dot === index ? 'active' : ''}"></i>`).join('')}</div><div class="setting-actions tour-actions">${index ? '<button class="secondary-button" data-tour="prev">Indietro</button>' : ''}${last ? '<button class="primary-button" data-tour="finish">Inizia nuova carriera</button>' : '<button class="primary-button" data-tour="next">Avanti</button>'}<button class="text-link" data-tour="skip">Salta</button></div>`;
}
// Confirmation of an irreversible or far-reaching action, in the game's own style.
export function renderConfirmDialog(pending) {
  if (!pending) return '';
  const tone = pending.tone === 'danger' ? 'danger' : 'primary';
  const details = (pending.details ?? []).filter(Boolean);
  return `<div class="modal-backdrop report-backdrop confirm-backdrop" data-confirm-backdrop><section class="report-modal confirm-dialog tone-${tone}" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
    <span class="section-kicker">${glyph(tone === 'danger' ? 'alert' : 'shield', 14)} ${esc(pending.kicker ?? 'CONFERMA')}</span><h2 id="confirm-title">${esc(pending.title)}</h2><p id="confirm-body">${esc(pending.body ?? '')}</p>
    ${details.length ? `<ul class="report-lines">${details.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
    ${pending.option ? `<label class="confirm-option"><input type="checkbox" data-confirm-option ${pending.optionChecked ? 'checked' : ''} /> ${esc(pending.option)}</label>` : ''}
    <footer><button class="secondary-button" data-confirm="cancel" autofocus>${esc(pending.cancelLabel ?? 'Annulla')}</button><button class="primary-button ${tone === 'danger' ? 'danger' : ''}" data-confirm="ok">${esc(pending.confirmLabel ?? 'Conferma')}</button></footer>
  </section></div>`;
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
  const side = menu.view === 'benvenuto' ? welcomeView(context.account, menu) : menu.view === 'tour' ? tourView(menu.tourStep) : menu.view === 'carica' ? loadView(context) : menu.view === 'account' ? accountView(context.account) : menu.view === 'guida' ? guideView() : menu.view === 'impostazioni' ? settingsView(settings, context) : `<h2>La politica italiana, settimana dopo settimana</h2><p class="section-subtitle">Un gestionale di carriera in un mondo politico vivo: partiti, parlamentari, governo e leggi reali; tutto ciò che accade in partita è simulazione dichiarata.</p>
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
