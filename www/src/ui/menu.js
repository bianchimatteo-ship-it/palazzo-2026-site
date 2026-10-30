// Main menu, how-to-play, settings, save slots and the end-of-week report.
import { renderTutorialInvite } from './tutorial.js?v=20261030-1';
import { SETTINGS_SCHEMA } from '../core/settings.js?v=20261030-1';
import { STAT_LABELS } from '../data/simulation/career-rules.js?v=20261030-1';
import { formatDate } from '../core/time.js?v=20261030-1';
import { illustration } from './illustrations.js?v=20261030-1';
import { glyph } from './visuals.js?v=20261030-1';
import { identityMark, identityVars } from './party-identity.js?v=20261030-1';
import { CAREER_LEVELS } from '../data/regions.js?v=20261030-1';
import { hallView } from './hall-view.js?v=20261030-1';
import { renderLogoCatalog } from './logo-catalog.js?v=20261030-1';
import { esc, signed } from './charts.js?v=20261030-1';
import { publicSiteBase } from '../data/repositories/account-sync.js?v=20261030-1';

const when = iso => { try { return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return ''; } };
// The actions of the opening screen, in order of importance: starting a career and resuming one are the two main ones (drawn apart, below); then what concerns the
// careers already made, then the help. Every entry is a real function of the game.
const MENU_GROUPS = [
  ['Le tue carriere', [
    ['carica', 'book', 'Carica partita', 'Slot, file esportati e importati'],
    ['hall', 'crown', 'Hall of Fame', 'Le carriere concluse e la loro eredità'],
    ['loghi', 'flag', 'Loghi dei partiti', 'Il tuo catalogo personale, sul dispositivo'],
    ['account', 'users', 'Account e salvataggi online', 'Ritrova le carriere su ogni dispositivo']
  ]],
  ['Aiuto e opzioni', [
    ['guida', 'target', 'Come giocare', 'Obiettivo, tempo, decisioni, elezioni'],
    ['impostazioni', 'shield', 'Impostazioni', 'Audio, animazioni, salvataggi, accessibilità']
  ]]
];

// How to play: short sections, each with a concrete example.
const HOW_TO = [
  ['L’obiettivo', 'route', 'Costruisci una carriera nella politica italiana, dal consiglio comunale fino alla guida di un partito o del governo. Non c’è un finale unico: conta dove arrivi, quanto resisti e cosa lasci al Paese. Quando vuoi puoi lasciare la politica o andare in pensione: la carriera entra nella Hall of Fame con la sua eredità politica, che una nuova carriera può raccogliere.', 'Parti consigliere a Siena, diventi segretario regionale, poi candidato alle politiche.'],
  ['Iniziare una partita', 'flag', 'Dal menu: Nuova partita. Scegli dove iniziare (Regione e Comune dall’elenco ISTAT), il percorso (comunale, provinciale, regionale, deputato, senatore o eurodeputato), il partito (indipendente, un partito reale o uno fondato da te), la difficoltà, il sondaggio iniziale (Realistico: la Supermedia reale; Casuale: un quadro dei partiti inventato da un seme, sempre lo stesso con lo stesso seme; Personalizzato: le percentuali le scrivi tu e quel che resta è «Altri») e come cominci (un inizio ordinario, da outsider, con debiti politici, in un partito già diviso, con una carriera già consolidata o con uno scenario tutto tuo, ed eventualmente con l’eredità di una carriera conclusa); per ultimo crei il tuo politico. Le condizioni di partenza non sono etichette: cambiano rapporti, risorse e promozioni e producono decisioni per tutta la partita.', 'Comune di Bari, percorso comunale, iscritto a un partito reale, difficoltà Normale, partenza da outsider.'],
  ['Il tempo', 'clock', 'Ogni turno è una settimana con 6 giorni da spendere. Quando hai finito premi «Chiudi la settimana»: il mondo va avanti anche senza di te. Nelle impostazioni puoi avanzare di 2 o 4 settimane per volta (ti viene chiesta conferma); la simulazione si ferma prima se arriva una decisione urgente.', 'Due giorni per un’assemblea di partito e uno per un’intervista: ne restano tre.'],
  ['Attività e decisioni', 'alert', 'Appuntamenti, eventi e situazioni arrivano in agenda: gli appuntamenti e gli eventi ordinari sono pochi (la settimana ha sei giorni), crisi e urgenze si aggiungono. Ogni scelta mostra costi (giorni, fondi, capitale politico), effetti e rischi; alcune conseguenze tornano settimane dopo. Se non decidi, a fine settimana si applica la scelta più passiva.', 'Rispondere subito a una polemica ti dà visibilità ma può costarti reputazione.'],
  ['Ruoli e poteri', 'crown', 'Puoi fare solo ciò che il tuo ruolo permette: un iscritto partecipa, un dirigente organizza, un parlamentare lavora in Aula, il segretario decide linea, alleanze e candidature, il Presidente del Consiglio nomina i ministri e fissa l’agenda, il Presidente della Repubblica sta sopra le parti e ha i poteri del Quirinale.', 'Da semplice deputato non puoi ritirare il sostegno al governo: lo decide il segretario.'],
  ['Il Quirinale', 'crown', 'Il Presidente della Repubblica non è eletto dai cittadini: lo elegge il Parlamento in seduta comune con tre delegati per ogni Regione (uno per la Valle d’Aosta), a scrutinio segreto. Servono due terzi dei grandi elettori nei primi tre scrutini, poi la maggioranza assoluta. Servono 50 anni; candidature e negoziazioni sono simulate. Chi è eletto non ha partito né altre cariche, dura sette anni e usa i poteri del Quirinale: consultazioni, scioglimento delle Camere (non nel semestre bianco), rinvio delle leggi, grazie e messaggi.', 'Al quarto scrutinio basta la maggioranza assoluta: il candidato di garanzia raccoglie i voti che i capi dei gruppi non riescono a controllare.'],
  ['Obiettivi, Hall of Fame ed eredità', 'target', 'Gli obiettivi non si spuntano: si misurano su ciò che fai e decidi, pagano un premio e sbloccano qualcosa che resta (rapporti che si assestano più in alto, più peso nelle promozioni, nuove decisioni). Puoi dichiararne uno in pubblico: mantenuto vale il doppio, mancato costa credibilità. Una carriera si conclude con il ritiro o il pensionamento e va nella Hall of Fame, con un’eredità da 0 a 100 che una nuova carriera può raccogliere (un nome noto, una rete, a volte una zavorra) senza cambiare il mondo di gioco.', 'Dichiari di voler entrare nella direzione nazionale entro un anno: se ci riesci il premio raddoppia, se no resta un impegno non mantenuto.'],
  ['Partito', 'users', 'Il tuo partito ha iscritti, sezioni, comitati sul territorio (con sedi, volontari, raccolta fondi e leader locali che a volte decidono da soli), correnti, congressi e tesoreria. Il sostegno interno cresce se porti risultati e rispetti la linea; scende con sconfitte e strappi. Le aree e i dirigenti locali hanno obiettivi propri: chiedono quote nelle liste, incarichi, fondi o una linea, e puoi accettare, trattare o rifiutare; gli accordi hanno una scadenza e, se li rompi, la memoria resta. Nella scheda «Vita interna» trovi richieste, accordi, congresso e dirigenti; un’area delusa può arrivare alla scissione, e tu puoi fondare un nuovo partito, fonderti con un altro o cambiare nome.', 'Vincere un congresso ti rende segretario; perderlo ti mette in minoranza.'],
  ['Parlamento, governo e leggi', 'dome', 'All’inizio trovi in carica un governo simulato costruito sulla maggioranza reale: puoi sostenerlo, chiedere un ministero se hai i requisiti, aprire una crisi o formarne uno nuovo. Una legge passa per commissione, emendamenti, voto e altra Camera: servono i numeri.', 'Una proposta sulla sanità senza coperture rischia di fermarsi in commissione.'],
  ['Eventi', 'megaphone', 'Crisi, scandali, emergenze e buone notizie arrivano in base alla situazione, con tempi di attesa e catene di conseguenze. Durante la settimana si alternano eventi leggeri e importanti, ognuno con il suo giorno in agenda. Nessun evento reale viene attribuito a persone reali: tutto è simulazione dichiarata.', 'Un’ondata di calore porta l’ambiente al centro: le forze ecologiste guadagnano attenzione.'],
  ['Consenso, sondaggi e media', 'chart', 'Il primo sondaggio della carriera realistica è reale (Supermedia YouTrend/Agi del 1° ottobre 2026, con le variazioni pubblicate dalla fonte); con uno scenario Casuale o Personalizzato è invece un quadro simulato, segnato come tale e senza toccare i dati reali; da quella dopo i sondaggi sono simulati e si muovono in modo graduale con eventi, governo e opposizione, alleanze, crisi ed elezioni. Le forze minori entrano o escono dai sondaggi solo quando è plausibile. Media e opinione pubblica reagiscono a ciò che fai. In Informazione trovi il giornale e la radio di LA POLITICA 24 (simulata): il notiziario si legge e, se il dispositivo ha una voce di sintesi italiana, si può ascoltare; una volta a settimana può comparire un riquadro con al massimo tre notizie (si chiude o si spegne dalle impostazioni).', 'Una legge approvata e ben comunicata vale qualche decimale in poche settimane, non 5 punti in una notte.'],
  ['Cittadini e territori', 'map', 'Venti regioni e i loro cittadini hanno umore, problemi e priorità diverse. Le misure arrivano sui territori in modo diverso e contano soprattutto alle elezioni locali.', 'Un investimento sui trasporti piace al Nord industriale più che alle aree interne.'],
  ['Finanze', 'money', 'Hai fondi personali e, se guidi il partito, la tesoreria; puoi accantonare un fondo per le elezioni e una riserva per gli imprevisti. Sedi, programmi e investimenti costano anche dopo l’acquisto, rendono con il tempo e possono andare male: i soldi vanno scelti. Da Presidente del Consiglio gestisci anche il bilancio pubblico: deficit, spread e manovra hanno conseguenze.', 'Spendere tutto in comunicazione può lasciarti senza fondi per la campagna.'],
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

// Resuming the career: the logo (or mark) and the colour of the party the player is in, who the player is, where, and when it was saved.
function continueCard(meta, lastSaved, unsaved, identity, gate = null) {
  if (gate) {
    const mark = identity ? identityMark(identity, 'lg') : '';
    const style = identity ? ` style="${esc(identityVars(identity))}"` : '';
    return `<div class="menu-continue is-locked" data-career-gate="${esc(gate.owner)}"${style}>${mark}<span class="menu-continue-body"><span class="menu-continue-kicker">${glyph('shield', 16)} CARRIERA COLLEGATA A UN ACCOUNT</span><strong>${esc(meta.player)}</strong><span class="menu-continue-role">${esc(meta.role ?? 'Senza incarico')} · <b>${esc(meta.party)}</b></span><small>Appartiene all’account «${esc(gate.owner)}»${gate.signedIn ? `, tu sei collegato come «${esc(gate.signedIn)}»` : ': non hai effettuato l’accesso'}. Settimana ${meta.week} · ${esc(formatDate(meta.gameDate))}.</small><span class="slot-actions"><button class="primary-button" data-menu-action="gate-login">${gate.signedIn ? 'Cambia account' : `Accedi come «${esc(gate.owner)}»`}</button><button class="secondary-button" data-menu-action="gate-local">Usa localmente</button></span></span></div>`;
  }
  const ended = meta.status === 'ended';
  const mark = identity ? identityMark(identity, 'lg') : '';
  const style = identity ? ` style="${esc(identityVars(identity))}"` : '';
  return `<button class="menu-continue ${ended ? 'is-ended' : ''}" data-menu="continua"${style}>${mark}<span class="menu-continue-body"><span class="menu-continue-kicker">${glyph('route', 16)} ${ended ? 'CARRIERA CONCLUSA' : 'CONTINUA LA PARTITA'}</span><strong>${esc(meta.player)}</strong><span class="menu-continue-role">${esc(meta.role ?? 'Senza incarico')} · <b>${esc(meta.party)}</b></span><small>Settimana ${meta.week} · ${esc(formatDate(meta.gameDate))} · ${esc(unsaved ? 'modifiche non salvate' : lastSaved)}</small></span><span class="menu-continue-go" aria-hidden="true">${glyph('steady', 22)}</span></button>`;
}
// The language of the interface, visible before any career is started: Italian is the default; the choice is kept in this browser, apart from every save.
function languageSwitch(settings) {
  const current = settings?.language ?? 'it';
  const options = [['it', '🇮🇹', 'Italiano'], ['en', '🇬🇧', 'English']];
  return `<div class="menu-lang" role="group" aria-label="Lingua / Language" data-no-translate>${options.map(([id, flag, label]) => `<button type="button" class="${current === id ? 'active' : ''}" data-setting-key="language" data-setting-value="${id}" aria-pressed="${current === id}" lang="${id}"><span class="menu-lang-flag" aria-hidden="true">${flag}</span><span class="menu-lang-label">${label}</span>${current === id ? '<span class="menu-lang-check" aria-hidden="true">✓</span>' : ''}</button>`).join('')}</div>`;
}
// Starting a career: the main action of the screen, with what it leads to (all of it chosen in the new-game steps).
// While the index of the real data and the starting collections are still arriving (`loading`), the card is there but waits: it is not an action yet, and says why.
function newCareerCard(loading = false) {
  return `<button class="menu-new" data-menu="nuova"${loading ? ' disabled aria-disabled="true" aria-busy="true"' : ''}><span class="menu-new-icon">${glyph('flag', 24)}</span><span class="menu-new-body"><strong>Nuova partita</strong><small>${loading ? 'Carico i dati reali…' : 'Scegli dove partire e crea il tuo politico in cinque passaggi.'}</small></span><span class="menu-new-go" aria-hidden="true">${glyph('steady', 22)}</span></button>`;
}

// Why the game kept a copy aside, in words.
const VERSION_REASONS = { 'versione-precedente': 'Versione prima dell’ultimo salvataggio', 'backup-precedente': 'Copia di sicurezza precedente', 'slot-precedente': 'Slot sostituito da un salvataggio più recente', 'conflitto-versione-obsoleta': 'Salvataggio obsoleto messo da parte', 'conflitto-carriera-diversa': 'Salvataggio di un’altra carriera messo da parte', 'conflitto-scrittura-concorrente': 'Scrittura concorrente messa da parte', 'recovery-copia-avanzata': 'Copia più avanzata recuperata', 'recovery-main-precedente': 'Partita principale prima del recupero', 'salvataggio-main-non-recuperabile': 'Salvataggio non leggibile messo da parte' };
const versionReason = reason => VERSION_REASONS[reason] ?? (String(reason).startsWith('aggiornamento-v') ? 'Prima dell’aggiornamento del gioco' : 'Copia di sicurezza');
const savedOn = iso => { try { return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return ''; } };
// The state of the save of the running game, as it really is: saved here, being written, not saved, not confirmed.
function currentStatus(saving, lastSaved, unsaved) {
  if (saving && saving.ok === false) return `<small class="save-state is-failed" data-save-state="failed">Salvataggio non riuscito: ${esc(saving.error)}</small>`;
  if (saving?.pending) return '<small class="save-state is-pending" data-save-state="pending">Il browser sta ancora scrivendo la copia: non chiudere la pagina.</small>';
  if (unsaved) return `<small class="save-state is-dirty" data-save-state="dirty">Modifiche non salvate in questo browser (${esc(lastSaved ?? '')})</small>`;
  return `<small class="save-state is-saved" data-save-state="saved">${esc(lastSaved || 'Salvata in questo browser')}</small>`;
}
function slotWhere(info) {
  if (!info) return '';
  if (!info.durable) return '<small class="save-state is-pending">Scrittura non ancora confermata dal browser</small>';
  return info.where === 'database' ? '<small class="save-state">Nel database del browser (la memoria rapida era piena)</small>' : '<small class="save-state">In questo browser</small>';
}
function loadView({ hasCareer, meta, account = null, gate = null, protectedCount = 0, slots, versions = [], saving, lastSaved, unsaved, error, identity, identityOf }) {
  const rowOf = slot => `<article class="slot-row" data-slot-row="${esc(slot.id)}">${identityOf ? identityMark(identityOf(slot), 'sm') : ''}<div><strong>${esc(slot.name)}</strong>${slot.autoPreserve ? '<span class="slot-tag">Copia automatica prima di cambiare partita</span>' : ''}<span>${esc(slot.player ? `${slot.player} · ` : '')}${esc(slot.role ?? 'Senza incarico')} · ${esc(slot.party ?? '')}</span><small>Settimana ${slot.week} · ${esc(formatDate(slot.gameDate))} · salvato il ${esc(savedOn(slot.savedAt))}</small>${slotWhere(slot.info)}</div><div class="slot-actions"><button class="primary-button" data-slot-load="${esc(slot.id)}">Carica</button><button class="secondary-button" data-slot-export="${esc(slot.id)}" aria-label="Esporta ${esc(slot.name)} su file">Esporta su file</button><button class="icon-text-button" data-slot-delete="${esc(slot.id)}" aria-label="Elimina ${esc(slot.name)}">${glyph('alert', 15)} Elimina</button></div></article>`;
  const copies = versions.map(item => `<li data-version-row="${esc(item.id)}"><span><b>${esc(versionReason(item.reason))}</b> · ${esc(item.player)} · settimana ${esc(item.week)} · ${esc(formatDate(item.gameDate))}<small>salvata il ${esc(savedOn(item.savedAt))} · revisione ${esc(item.revision)}</small></span><span class="slot-actions"><button class="secondary-button" data-version-restore="${esc(item.id)}">${item.older ? 'Ripristina come nuova carriera' : 'Ripristina'}</button><button class="secondary-button" data-version-export="${esc(item.id)}">Esporta</button></span></li>`).join('');
  const ended = slot => slot.status && slot.status !== 'active';
  const active = slots.filter(slot => !ended(slot)), concluded = slots.filter(ended);
  const group = (title, list, empty, tag) => `<div class="load-group" data-load-group="${tag}"><h4>${title} <span class="load-count">${list.length}</span></h4><div class="slot-list">${list.map(rowOf).join('') || `<p class="quiet-copy">${empty}</p>`}</div></div>`;
  return `<h2>Carica partita</h2><p class="section-subtitle">La partita in corso si salva da sola; qui conservi fino a 5 salvataggi e li porti su altri dispositivi con un file. Il gioco non elimina mai da solo un salvataggio.</p>
    <p class="load-legend" data-load-legend><span><b>Carica</b> apre uno slot (la partita in corso viene prima messa da parte)</span><span><b>Ripristina</b> riporta una copia di sicurezza</span><span><b>Esporta / Importa</b> passa da un file</span><span class="is-danger"><b>Elimina</b> è definitivo</span></p>
    <section class="load-section" data-load-section="current"><h3>${glyph('clock', 16)} Partita in corso</h3>
    ${hasCareer && !gate ? `<article class="slot-row is-current">${identity ? identityMark(identity, 'sm') : ''}<div><strong>Partita in corso</strong><span>${esc(meta.player)} · ${esc(meta.role ?? 'Senza incarico')}</span><small>Settimana ${meta.week} · ${esc(formatDate(meta.gameDate))}</small>${currentStatus(saving, lastSaved, unsaved)}</div><div class="slot-actions"><button class="secondary-button" data-menu-action="save-slot">Salva in uno slot</button><button class="secondary-button" data-menu-action="export">Esporta su file</button></div></article>` : ''}
    ${hasCareer && !gate ? '' : '<p class="quiet-copy">Nessuna partita in corso.</p>'}</section>
    <section class="load-section" data-load-section="slots"><h3>${glyph('book', 16)} Carriere su questo dispositivo</h3>
      ${group('Attive', active, 'Nessuna carriera attiva negli slot.', 'active')}${group('Concluse', concluded, 'Nessuna carriera conclusa negli slot.', 'ended')}
    ${(gate || protectedCount) && !account?.user ? '<p class="quiet-copy" data-protected-saves>Le carriere di questo dispositivo compaiono dopo l’accesso con il loro account. Nulla è stato eliminato.</p>' : gate || protectedCount ? `<p class="quiet-copy" data-protected-saves>${protectedCount + (gate ? 1 : 0) === 1 ? 'Una partita è collegata' : `${protectedCount + (gate ? 1 : 0)} partite sono collegate`} a un account e non ${protectedCount + (gate ? 1 : 0) === 1 ? 'è mostrata' : 'sono mostrate'}: accedi con l’account a cui appartengono. Nulla è stato eliminato.</p>` : ''}
    </section>
    <section class="load-section" data-load-section="backups"><h3>${glyph('shield', 16)} Backup di sicurezza</h3>
    ${copies ? `<details class="slot-versions"><summary>Copie di sicurezza di questo browser (${versions.length})</summary><p class="quiet-copy">Il gioco le tiene da parte quando un salvataggio viene sostituito, recuperato o rifiutato perché obsoleto. Ripristinandone una, la partita in corso viene prima messa in uno slot.</p><ul class="history-list" aria-label="Copie di sicurezza">${copies}</ul></details>` : ''}
    ${copies ? '' : '<p class="quiet-copy">Nessuna copia di sicurezza: compaiono quando un salvataggio viene sostituito o recuperato.</p>'}</section>
    <section class="load-section" data-load-section="files"><h3>${glyph('route', 16)} Importa da file</h3><label class="menu-import"><input type="file" accept="application/json,.json" data-menu-import />${glyph('book', 16)} Importa una partita da file</label><p class="quiet-copy">Per esportare usa «Esporta su file» accanto a una carriera. I salvataggi online si gestiscono in <button type="button" class="text-link" data-menu="account">Account e salvataggi online</button>.</p></section>
    ${error ? `<p class="menu-error" role="alert">${esc(error)}</p>` : ''}`;
}

// Account: sign up or sign in, then every career is also kept online and can be resumed on another device.
// The public pages (also reachable without the game): privacy notice, terms and the page to ask for the deletion of the account.
export const legalLinks = () => { const base = publicSiteBase(); return `<nav class="legal-links" aria-label="Informazioni legali"><a href="${base}privacy.html" target="_blank" rel="noopener">Informativa sulla privacy</a><a href="${base}termini.html" target="_blank" rel="noopener">Termini di utilizzo</a><a href="${base}elimina-account.html" target="_blank" rel="noopener">Elimina l’account</a></nav>`; };
const SYNC_KIND_LABEL = { local: 'Salvata in questo browser', unsaved: 'Modifiche non salvate', pending: 'Sincronizzazione in attesa', synced: 'Sincronizzata', conflict: 'Conflitto', error: 'Errore', foreign: 'Di un altro account', unlinked: 'Solo su questo dispositivo' };
// The state of the online copy of the career being played, in words: saved here, waiting, synced, conflict, error.
export function syncStatusLine(sync) {
  if (!sync) return '';
  return `<p class="sync-status sync-${esc(sync.kind)}" role="status" data-sync-status="${esc(sync.kind)}"><b>${esc(sync.label ?? SYNC_KIND_LABEL[sync.kind])}</b>${sync.detail ? ` <small>${esc(sync.detail)}</small>` : ''}</p>`;
}
const CONFLICT_TEXT = {
  'remote-changed': ['Su un altro dispositivo c’è una versione più recente di questa carriera', 'Nulla è stato sovrascritto. Scegli quale tenere.'],
  'unlinked-remote': ['Nel tuo account c’è già una carriera con questo identificativo', 'Questa copia non è collegata a quella online e non si può sapere quale sia la più avanzata: scegli tu.'],
  'remote-missing': ['La copia online di questa carriera non c’è più', 'È stata eliminata dal tuo account. Puoi rimettere online questa copia o tenerla soltanto qui.'],
  'stale-copy': ['Questa copia è più indietro di quella online', 'Non è stata caricata. Puoi usare la versione online, oppure sostituirla (resta tra le versioni precedenti).'],
  'behind-online': ['Questa copia è più indietro della carriera online', 'Il server l’ha rifiutata per non cancellare i progressi. Scegli quale tenere.'],
  'base-ahead': ['Non si può verificare da quale versione online deriva questa copia', 'Per sicurezza non è stata caricata. Scegli quale tenere.'],
  'slot-mismatch': ['Online c’è un’altra carriera in questo spazio', 'Non è stato toccato nulla.']
};
function conflictCard(item) {
  const [title, hint] = CONFLICT_TEXT[item.kind] ?? CONFLICT_TEXT['remote-changed'];
  const remote = item.remote ? `Online: revisione ${esc(item.remote.revision)}${item.remote.updatedAt ? ` del ${esc(when(item.remote.updatedAt))}` : ''}. ` : '';
  const ref = `data-conflict-career="${esc(item.careerId)}"`;
  return `<div class="account-conflict" role="alert" data-conflict-kind="${esc(item.kind)}"><strong>${esc(title)}</strong><small>${remote}${esc(hint)}</small><div class="setting-actions">${item.remote ? `<button class="primary-button" data-conflict="download" ${ref}>Usa la versione online</button>` : ''}<button class="secondary-button" data-conflict="keep" ${ref}>${item.remote ? 'Sostituisci online con questa' : 'Rimetti online questa copia'}</button><button class="secondary-button" data-conflict="apart" ${ref}>Tieni solo qui</button></div></div>`;
}
function isolationCard(sync) {
  if (!sync || !['foreign', 'unlinked'].includes(sync.kind)) return '';
  const foreign = sync.kind === 'foreign';
  return `<div class="account-conflict account-isolation" role="status" data-isolation="${esc(sync.kind)}"><strong>${foreign ? `La carriera in corso è collegata all’account «${esc(sync.owner)}»` : 'La carriera in corso è solo su questo dispositivo'}</strong><small>${foreign ? 'Non viene caricata in questo account senza una tua scelta. La copia dell’altro account non viene toccata.' : 'Non viene portata online da sola: decidi tu se collegarla a questo account.'}</small><div class="setting-actions"><button class="primary-button" data-account-action="link">${foreign ? 'Collega a questo account' : 'Porta online su questo account'}</button><button class="secondary-button" data-account-action="keep-local">Tieni solo qui</button></div></div>`;
}
function historyList(account, slot) {
  if (account.history?.slot !== slot) return '';
  if (account.history.error) return `<p class="menu-error" role="alert">${esc(account.history.error)}</p>`;
  if (!account.history.items) return '<p class="parliament-note" role="status">Caricamento delle versioni precedenti…</p>';
  if (!account.history.items.length) return '<p class="quiet-copy">Nessuna versione precedente: compaiono quando una versione online viene sostituita.</p>';
  return `<ul class="history-list" aria-label="Versioni precedenti">${account.history.items.map(item => `<li><span><b>Revisione ${esc(item.revision)}</b> · settimana ${esc(item.meta?.week ?? item.progress?.[1] ?? '—')} · ${esc(item.meta?.gameDate ? formatDate(item.meta.gameDate) : item.progress?.[0] ? formatDate(item.progress[0]) : '')}<small> · sostituita il ${esc(when(item.archivedAt))}${item.reason === 'ripristino' ? ' · conservata da un ripristino' : ''}</small></span><button class="secondary-button" data-history-restore="${esc(item.id)}" data-history-slot="${esc(slot)}">Ripristina</button></li>`).join('')}</ul>`;
}
function emailSection(account) {
  const info = account.info?.email ?? null;
  const service = account.service ?? {};
  const note = service.email ? '' : '<small>Al momento il servizio non riesce a spedire e-mail: l’indirizzo viene salvato, ma il messaggio di verifica non parte. Puoi chiedere un nuovo invio più tardi, da questa stessa sezione.</small>';
  if (info?.verified) return `<div class="account-email" data-account-email="verified"><strong>Email verificata</strong><small>${esc(info.masked)} · serve a recuperare la password se la dimentichi.</small></div>`;
  const form = `<form class="account-form" data-account-form="email"><label>Indirizzo email<input name="email" type="email" autocomplete="email" required maxlength="254" ${info ? `placeholder="${esc(info.masked)}"` : ''} /></label><label>Password dell’account<input name="password" type="password" autocomplete="current-password" required minlength="8" /></label><button class="secondary-button" type="submit" ${account.busy ? 'disabled' : ''}>${info ? 'Cambia indirizzo e invia la verifica' : 'Collega l’email'}</button></form>`;
  const resend = info ? `<form class="account-form" data-account-form="resend"><label>Password dell’account<input name="password" type="password" autocomplete="current-password" required minlength="8" /></label><button class="secondary-button" type="submit" ${account.busy ? 'disabled' : ''}>Invia di nuovo il messaggio di verifica</button></form>` : '';
  return `<details class="account-email" data-remember="account-email" data-account-email="${info ? 'unverified' : 'none'}" ${info ? 'open' : ''}><summary>${info ? `Email da verificare · ${esc(info.masked)}` : 'Email per recuperare la password (facoltativa)'}</summary><p class="parliament-note">Senza un’email verificata la password non si può recuperare. L’indirizzo serve soltanto a questo e non è mostrato ad altri.</p>${note}${form}${resend}</details>`;
}
function accountView(account = {}) {
  const note = account.error ? `<p class="menu-error" role="alert">${esc(account.error)}</p>` : account.message ? `<p class="account-message" role="status">${esc(account.message)}</p>` : '';
  if (account.status === 'none' || (!account.status && !account.available)) return `<h2>Account e salvataggi online</h2><p class="section-subtitle">Gli account funzionano sul sito pubblicato. Da qui la partita resta salvata in questo browser: puoi esportarla su file dal menu Carica partita.</p>${note}`;
  // The service did not answer: said at once, with a new attempt and the local start (never a dead end).
  const down = !account.user && account.status === 'unreachable' ? `<div class="account-unreachable" role="status"><strong>Il servizio account non risponde in questo momento</strong><small>Puoi iniziare subito senza account: la partita resta salvata in questo browser e potrai collegarla al tuo account quando il servizio torna raggiungibile.</small><div class="setting-actions"><button class="primary-button" data-menu-action="start-local">Inizia senza account</button><button class="secondary-button" data-account-action="probe">Riprova</button></div></div>` : '';
  const checking = !account.user && account.status === 'checking' ? '<p class="parliament-note" role="status">Verifica del servizio account in corso…</p>' : '';
  const service = account.service ?? {};
  if (!account.user && account.mode === 'reset') return `<h2>Scegli una nuova password</h2>${account.reset ? `<p class="section-subtitle">Per l’account <strong>${esc(account.reset.username)}</strong>. La password non lascia il tuo browser in chiaro.</p><form class="account-form" data-account-form="reset"><label>Nuova password<input name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="Almeno 8 caratteri" /></label><label>Ripeti la nuova password<input name="confirm" type="password" autocomplete="new-password" required minlength="8" /></label><button class="primary-button" type="submit" ${account.busy ? 'disabled' : ''}>${account.busy === 'reset' ? 'Salvataggio…' : 'Cambia la password'}</button></form>` : '<p class="section-subtitle">Il collegamento non è valido o è scaduto.</p>'}${note}<div class="setting-actions"><button class="secondary-button" data-menu="account" data-account-mode="recover">Chiedi un nuovo collegamento</button><button class="secondary-button" data-menu="account" data-account-mode="login">Torna all’accesso</button></div>${legalLinks()}`;
  if (!account.user && account.mode === 'recover') return `<h2>Recupero della password</h2><p class="section-subtitle">Scrivi l’indirizzo email collegato all’account: se è verificato ti arriva un messaggio con il collegamento per scegliere una nuova password.</p>${service.email ? '' : '<p class="parliament-note" role="status">Al momento il servizio non riesce a spedire e-mail: il collegamento di recupero non può partire. Riprova più tardi; le partite salvate su questo dispositivo restano disponibili.</p>'}<form class="account-form" data-account-form="recover"><label>Indirizzo email<input name="email" type="email" autocomplete="email" required maxlength="254" /></label><button class="primary-button" type="submit" ${account.busy || !service.email ? 'disabled' : ''}>${account.busy === 'recover' ? 'Invio…' : 'Invia il collegamento'}</button></form>${note}<p class="parliament-note">Gli account creati senza email non possono usare il recupero: la password non può essere ricostruita da nessuno.</p><div class="setting-actions"><button class="secondary-button" data-menu="account" data-account-mode="login">Torna all’accesso</button></div>${legalLinks()}`;
  if (!account.user) return `<h2>Account e salvataggi online</h2><p class="section-subtitle">Con un account le tue carriere si salvano online e le ritrovi su qualsiasi dispositivo. Il browser ne conserva comunque una copia per giocare anche senza connessione.</p>${note}${down}${checking}
    <div class="acct-tabs" role="group" aria-label="Che cosa vuoi fare">${[['login', 'Accedi'], ['register', 'Crea un account'], ['recover', 'Password dimenticata']].map(([id, label]) => `<button type="button" class="${(account.mode ?? 'login') === id ? 'active' : ''}" data-menu="account" data-account-mode="${id}" aria-pressed="${(account.mode ?? 'login') === id}">${label}</button>`).join('')}</div>
    <div class="account-forms focus-${esc(account.mode ?? 'login')}">
      <form class="account-form" data-account-form="login"><h3>Accedi</h3><label>Nome utente<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="24" /></label><label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8" /></label><button class="${account.mode === 'register' ? 'secondary-button' : 'primary-button'}" type="submit" ${account.busy ? 'disabled' : ''}>${account.busy === 'login' ? 'Accesso in corso…' : 'Accedi'}</button><button type="button" class="text-link" data-menu="account" data-account-mode="recover">Password dimenticata?</button></form>
      <form class="account-form" data-account-form="register"><h3>Crea un account</h3><label>Nome utente<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="24" placeholder="3–24 caratteri: a-z, 0-9, . _ -" /></label><label>Email ${service.emailRequired ? '' : '(facoltativa)'}<input name="email" type="email" autocomplete="email" maxlength="254" ${service.emailRequired ? 'required' : ''} placeholder="Per recuperare la password" /></label><label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="Almeno 8 caratteri" /></label><label>La tua età (non viene salvata né inviata)<select name="ageBand" required><option value="">Scegli…</option><option value="under14">Ho meno di 14 anni</option><option value="adult14">Ho 14 anni o più</option></select></label><label>Ripeti la password<input name="confirm" type="password" autocomplete="new-password" required minlength="8" /></label><button class="${account.mode === 'register' ? 'primary-button' : 'secondary-button'}" type="submit" ${account.busy ? 'disabled' : ''}>${account.busy === 'register' ? 'Creazione in corso…' : 'Crea l’account'}</button><small>L’email serve soltanto a recuperare la password e va confermata con un collegamento. Senza email la password non può essere recuperata. La password non lascia mai il tuo browser in chiaro: conservala con cura.</small></form>
    </div>${legalLinks()}`;
  const rows = (account.saves ?? []).map(save => `<article class="slot-row ${save.slot === account.currentSlot ? 'is-current' : ''}"><div><strong>${esc(save.name || save.meta?.player || 'Carriera')}</strong><span>${esc(save.meta?.role ?? 'Senza incarico')} · ${esc(save.meta?.party ?? '')}${save.meta?.difficulty ? ` · ${esc(save.meta.difficulty)}` : ''}</span><small>Settimana ${esc(save.meta?.week ?? '—')} · ${esc(save.meta?.gameDate ? formatDate(save.meta.gameDate) : '')} · online dal ${esc(when(save.updatedAt))} · revisione ${esc(save.revision)}</small></div><button class="primary-button" data-cloud-load="${esc(save.slot)}">Carica</button><button class="secondary-button" data-history-open="${esc(save.slot)}" aria-expanded="${account.history?.slot === save.slot}">Versioni precedenti</button><button class="icon-text-button" data-cloud-delete="${esc(save.slot)}" aria-label="Elimina online ${esc(save.name || 'carriera')}">${glyph('alert', 15)} Elimina</button></article>${historyList(account, save.slot)}`).join('');
  const conflicts = (account.conflicts ?? (account.conflict ? [account.conflict] : [])).map(conflictCard).join('');
  return `<h2>Account e salvataggi online</h2><p class="section-subtitle">Connesso come <strong>${esc(account.user.username)}</strong>. Ogni salvataggio nel browser viene messo in coda e sincronizzato quando è possibile${account.lastSync ? ` · ultima sincronizzazione ${esc(when(account.lastSync))}` : ''}.</p>
    ${note}<section class="acct-section" data-acct="sync"><h3 class="acct-h">${glyph('globe', 16)} Sincronizzazione</h3>${syncStatusLine(account.sync)}${conflicts}${conflicts ? '' : isolationCard(account.sync)}
    <div class="setting-actions"><button class="primary-button" data-account-action="sync" ${account.busy ? 'disabled' : ''}>${account.busy === 'sync' ? 'Sincronizzazione…' : 'Salva ora online'}</button><button class="secondary-button" data-account-action="refresh">Aggiorna elenco</button><button class="secondary-button" data-account-action="logout">Esci</button></div>
    </section>
    <section class="acct-section" data-acct="saves"><h3 class="acct-h">${glyph('book', 16)} Salvataggi online</h3><div class="slot-list">${rows || '<p class="quiet-copy">Nessuna carriera salvata online: la carriera in corso comparirà qui quando la colleghi a questo account.</p>'}</div></section>
    <section class="acct-section" data-acct="email"><h3 class="acct-h">${glyph('users', 16)} Email e recupero della password</h3>${emailSection(account)}</section>
    <section class="acct-section acct-danger" data-acct="danger"><h3 class="acct-h">${glyph('alert', 16)} Zona pericolosa</h3><details class="account-delete" data-remember="account-delete"><summary>Elimina il mio account</summary>
      <p class="parliament-note">Vengono eliminati subito l’account, le carriere salvate online con le loro versioni precedenti, l’email e le sessioni aperte. Non si può annullare. Le partite salvate in questo browser restano sul dispositivo: si eliminano dal menu Carica partita.</p>
      <form class="account-form" data-account-form="delete"><label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8" /></label><label>Scrivi ELIMINA per confermare<input name="confirm" autocomplete="off" autocapitalize="characters" spellcheck="false" required pattern="ELIMINA" /></label><button class="secondary-button danger" type="submit" ${account.busy ? 'disabled' : ''}>${account.busy === 'delete' ? 'Eliminazione in corso…' : 'Elimina definitivamente l’account'}</button></form>
    </details></section>${legalLinks()}`;
}

function guideView() {
  return `<h2>Come giocare</h2><p class="section-subtitle">Le regole essenziali, sezione per sezione, con un esempio per ciascuna.</p>${renderTutorialInvite()}<label class="guide-search"><span class="visually-hidden">Cerca nella guida</span><input type="search" data-guide-search placeholder="Cerca un argomento (es. sondaggi, fondi, ballottaggio)…" autocomplete="off" /></label><p class="sheet-empty" data-guide-empty hidden>Nessun argomento corrisponde.</p><nav class="guide-index" aria-label="Sezioni della guida">${HOW_TO.map(([title], index) => `<a href="#guida-${index}" data-guide-jump="guida-${index}" data-guide-index="${index}">${esc(title)}</a>`).join('')}</nav><div class="guide-grid">${HOW_TO.map(([title, icon, text, example], index) => `<article class="guide-card" id="guida-${index}" data-guide-card="${index}">${glyph(icon, 20)}<div><strong>${esc(title)}</strong><p>${esc(text)}</p>${example ? `<p class="guide-example"><b>Esempio</b> ${esc(example)}</p>` : ''}</div></article>`).join('')}</div>`;
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
  return `<span class="section-kicker">COME FUNZIONA · ${index + 1} DI ${TOUR_STEPS.length}</span><div class="tour-card"><span class="tour-icon">${glyph(icon, 34)}</span><h2>${esc(title)}</h2><p>${esc(text)}</p></div><div class="tour-dots" aria-hidden="true">${TOUR_STEPS.map((_, dot) => `<i class="${dot === index ? 'active' : ''}"></i>`).join('')}</div><div class="setting-actions tour-actions">${index ? '<button class="secondary-button" data-tour="prev">Indietro</button>' : ''}${last ? '<button class="primary-button" data-tour="finish">Inizia nuova carriera</button><button class="secondary-button" data-tour="finish" data-tutorial-also="start">Inizia con il tutorial guidato</button>' : '<button class="primary-button" data-tour="next">Avanti</button>'}<button class="text-link" data-tour="skip">Salta</button></div>`;
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

export function settingsView(settings, { error = '', account = null } = {}) {
  const groups = [['Audio', ['sound', 'volume'], 'megaphone'], ['Interfaccia', ['language', 'motion', 'density', 'textSize', 'contrast'], 'globe'], ['Notifiche', ['toasts', 'toastLength', 'weeklyReport', 'newsPopup'], 'alert'], ['Partita', ['autosave', 'weeksPerTurn'], 'clock']];
  return `<h2>Impostazioni</h2><p class="section-subtitle">Valgono per tutte le partite in questo browser e si applicano subito; il popup delle notizie settimanali segue l’account con cui hai effettuato l’accesso.</p>
    ${groups.map(([title, keys, icon]) => `<section class="settings-group" data-settings-group="${esc(title)}"><h3>${glyph(icon, 16)} ${esc(title)}</h3>${keys.map(key => { const spec = SETTINGS_SCHEMA[key]; const hint = spec.hint ? `<small class="setting-hint" role="status" data-setting-state="${key}"><b>${esc(spec.options.find(([v]) => v === settings[key])?.[1] ?? '')}.</b> ${esc(spec.hint[settings[key]] ?? '')}${spec.scoped ? ` ${account?.user ? `Vale per l’account «${esc(account.user.username)}».` : 'Vale per questo browser.'}` : ''}</small>` : ''; return `<div class="setting-row ${spec.hint ? 'has-hint' : ''}" data-setting-row="${key}"><span>${esc(spec.label)}</span><div class="segmented" role="group" aria-label="${esc(spec.label)}">${spec.options.map(([value, label]) => `<button data-setting-key="${key}" data-setting-value="${esc(value)}" class="${settings[key] === value ? 'active' : ''}" aria-pressed="${settings[key] === value}"${key === 'language' ? ` lang="${esc(value)}" data-no-translate` : ''}>${esc(label)}</button>`).join('')}</div>${hint}</div>`; }).join('')}</section>`).join('')}
    <section class="settings-group" data-settings-group="Dati"><h3>${glyph('book', 16)} Dati di gioco</h3><div class="setting-actions"><button class="secondary-button" data-menu-action="export">Esporta la partita in corso</button><label class="secondary-button menu-import-inline"><input type="file" accept="application/json,.json" data-menu-import />Importa una partita</label><button class="secondary-button" data-menu-action="reset-settings">Ripristina le impostazioni</button></div><p class="parliament-note">L’archivio dell’amministratore e i loghi personali restano separati e non vengono toccati.</p></section>
    <section class="settings-group settings-danger" data-settings-group="Pericolo"><h3>${glyph('alert', 16)} Zona pericolosa</h3><p class="parliament-note">Queste azioni sono definitive e chiedono una conferma.</p><div class="setting-actions"><button class="secondary-button danger" data-menu-action="clear-saves">Elimina tutti i salvataggi</button></div></section>
    ${error ? `<p class="menu-error" role="alert">${esc(error)}</p>` : ''}`;
}

// Everything the main menu opens (saves, Hall of Fame, account, guide, settings, the first-run steps) is a dialog over the homepage, never a panel added under it. It closes with the
// close button, «Annulla», Escape or a click on the backdrop (app.js); nothing behind it can be reached while it is open.
const POPUP_TITLES = { carica: 'Carica partita', hall: 'Hall of Fame', loghi: 'Loghi dei partiti', account: 'Account e salvataggi online', guida: 'Come giocare', impostazioni: 'Impostazioni', benvenuto: 'Benvenuto', tour: 'Primo avvio' };
function menuPopup(view, content) {
  const title = POPUP_TITLES[view] ?? 'POLITICANDO 2026';
  return `<div class="modal-backdrop report-backdrop menu-popup-backdrop" data-menu-close data-menu-popup="${esc(view)}"><section class="report-modal menu-popup" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="menu-popup-head"><span class="section-kicker">${esc(title.toUpperCase())}</span><button type="button" class="icon-button menu-popup-x" data-menu-close aria-label="Chiudi: ${esc(title)}">×</button></header>
    <div class="menu-popup-body" tabindex="-1">${content}</div>
    <footer class="menu-popup-foot"><button type="button" class="secondary-button" data-menu-close>Annulla</button></footer>
  </section></div>`;
}

// The very first screen of a first installation: the language, in both languages so that everybody understands it, before any account screen. Italian and English are the two buttons; nothing is
// translated here (data-no-translate) because both texts are always shown. The choice is kept in the settings of the browser (politicando.settings.v1) and the selector stays on the home.
export function languageGate() {
  return `<div class="language-gate" role="dialog" aria-modal="true" aria-labelledby="language-gate-title" data-no-translate>
    <div class="language-gate-card">
      <img class="language-gate-logo" src="icons/logo-politicando-640.webp" srcset="icons/logo-politicando-240.webp 240w, icons/logo-politicando-640.webp 640w" sizes="(max-width:700px) 150px, 200px" width="200" height="200" alt="POLITICANDO 2026" decoding="async" />
      <span class="language-gate-rule" aria-hidden="true"></span>
      <h1 id="language-gate-title">Scegli la lingua<span> / </span><em>Choose your language</em></h1>
      <div class="language-gate-buttons">
        <button type="button" class="language-gate-button" data-language-choice="it" lang="it"><span class="language-gate-flag" aria-hidden="true">🇮🇹</span><span class="language-gate-name">Italiano</span></button>
        <button type="button" class="language-gate-button" data-language-choice="en" lang="en"><span class="language-gate-flag" aria-hidden="true">🇬🇧</span><span class="language-gate-name">English</span></button>
      </div>
      <p class="language-gate-hint">Seleziona una lingua per continuare<span> / </span><em>Select a language to continue</em></p>
    </div>
  </div>`;
}
export function renderMainMenu(menu, context) {
  if (menu.view === 'lingua') return languageGate();
  const { hasCareer, meta, lastSaved, unsaved, stats, settings, identity } = context;
  const facts = (stats ?? []).filter(([value]) => Number(value) > 0);
  const home = `<span class="section-kicker">POLITICANDO 2026</span><h2>La politica italiana, settimana dopo settimana</h2><p class="section-subtitle">Un gestionale di carriera in un mondo politico vivo: partiti, parlamentari, governo e leggi reali; tutto ciò che accade in partita è simulazione dichiarata.</p>
    ${facts.length ? `<div class="menu-facts">${facts.map(([value, label]) => `<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('')}</div>` : ''}
    <ul class="menu-points"><li>${glyph('clock', 18)}<span><strong>Una settimana alla volta</strong> sei giorni da spendere, poi il mondo va avanti.</span></li><li>${glyph('route', 18)}<span><strong>Sei percorsi</strong> ${esc(Object.values(CAREER_LEVELS).map(level => level.shortLabel).join(', '))}.</span></li><li>${glyph('flag', 18)}<span><strong>Il tuo partito</strong> uno reale, uno fondato da te o nessuno: il gioco ne prende logo e colori.</span></li><li>${glyph('shield', 18)}<span><strong>Reale e simulato, sempre distinti</strong> i dati istituzionali sono verificati, il resto è dichiarato simulazione.</span></li></ul>`;
  const side = menu.view === 'benvenuto' ? welcomeView(context.account, menu) : menu.view === 'tour' ? tourView(menu.tourStep) : menu.view === 'carica' ? loadView(context) : menu.view === 'account' ? accountView(context.account) : menu.view === 'guida' ? guideView() : menu.view === 'hall' ? hallView(context.hall, { identityOf: context.hallIdentity }) : menu.view === 'loghi' ? renderLogoCatalog(context.logos ?? {}) : menu.view === 'impostazioni' ? settingsView(settings, context) : home;
  const popup = menu.view !== 'home' ? menuPopup(menu.view, side) : '';
  const group = ([title, items]) => `<nav class="menu-group" aria-label="${esc(title)}"><h2 class="menu-group-title">${esc(title)}</h2><div class="menu-list">${items.map(([id, icon, label, detail]) => `<button class="menu-item ${menu.view === id ? 'active' : ''}" data-menu="${id}">${glyph(icon, 18)}<span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span></button>`).join('')}</div></nav>`;
  return `<div class="main-menu ${hasCareer ? 'has-career' : ''}">
    ${illustration('palazzo', 'menu-art')}
    <div class="menu-column"${popup ? ' inert' : ''}>
      ${languageSwitch(settings)}
      <h1 class="menu-brand"><img class="brand-logo menu-logo" src="icons/logo-politicando-640.webp" srcset="icons/logo-politicando-240.webp 240w, icons/logo-politicando-640.webp 640w" sizes="(max-width:700px) 120px, 200px" width="200" height="200" alt="POLITICANDO 2026" decoding="async" /></h1>
      <p class="menu-tagline">Una carriera nella politica italiana</p>
      ${newCareerCard(context.loading)}
      ${hasCareer ? continueCard(meta, lastSaved, unsaved, identity, context.gate) : ''}${hasCareer && !context.gate && context.account?.sync ? syncStatusLine(context.account.sync) : ''}
      ${MENU_GROUPS.map(group).join('')}
      <p class="menu-footnote">Dati reali verificati · simulazione dichiarata · ${context.account?.user ? `salvataggi online come ${esc(context.account.user.username)}` : 'salvataggi nel browser, online con un account'}</p>
    </div>
    <section class="menu-panel" aria-live="polite"${popup ? ' inert' : ''}>${home}</section>
    ${popup}
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
