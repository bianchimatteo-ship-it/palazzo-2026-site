// The guided tutorial: eleven short steps, optional, that follow the player through the real pages of the game. It is a card, not a mode: it costs no action points,
// no money and no time, never touches the career, and remembers only where the player stopped (this browser's preference, not part of the saved game).
// Skip it, close it and resume it later from “Come giocare”, or start it again from the first step.
import { glyph } from './visuals.js?v=20261119-7';

export const TUTORIAL_KEY = 'politicando.tutorial.v1';
// Each step: id, icon, page it is about, title, what it is, what it costs, what happens next, and an example drawn from the player's own game.
export const TUTORIAL_STEPS = Object.freeze([
  { id: 'ruolo', icon: 'flag', page: 'panoramica', title: 'Il tuo ruolo e l’obiettivo', what: 'Sei un politico italiano: la Home dice chi sei, che incarico hai e che cosa conviene fare adesso. L’obiettivo non è uno solo: salire di incarico, vincere elezioni, guidare un partito o il Governo.', cost: 'Leggere non costa nulla.', next: 'Ogni scelta cambia consenso, rapporti e opportunità nelle settimane dopo.', example: s => `${s.role ? `Adesso sei «${s.role}»` : 'Il tuo ruolo è scritto in alto'}${s.party ? ` per ${s.party}` : ''}.` },
  { id: 'agenda', icon: 'book', page: 'calendario', title: 'Home e agenda', what: 'La Home riassume le scadenze e le urgenze; l’Agenda elenca gli appuntamenti della settimana e quelli in arrivo. Ciò che tocca puoi aprirlo, rimandarlo o affidarlo allo staff.', cost: 'Ogni attività dell’agenda dice quanti giorni richiede.', next: 'Le cose non fatte non spariscono: a volte scadono e hanno conseguenze.', example: s => `Questa settimana ha ${s.maxDays} giorni da spendere.` },
  { id: 'settimana', icon: 'clock', page: 'panoramica', title: 'Settimana, giorni e punti azione', what: 'Il tempo va avanti una settimana alla volta. I giorni sono i tuoi punti azione: ogni attività ne consuma alcuni. Quando hai finito premi «Chiudi settimana»: il mondo va avanti anche senza di te.', cost: 'I giorni finiti non tornano fino alla settimana successiva.', next: 'Dopo la chiusura trovi il resoconto: eventi, sondaggi e notizie.', example: s => `Ora sei alla settimana ${s.week} e hai ${s.days} giorni su ${s.maxDays}.` },
  { id: 'fondi', icon: 'wallet', page: 'finanze', title: 'Costi e fondi', what: 'Esistono fondi diversi, mai mescolati: i tuoi fondi personali, la tesoreria del partito, il fondo elettorale della campagna e il bilancio dell’istituzione che governi.', cost: 'Ogni operazione dice da quale fondo esce.', next: 'Senza fondi non si fanno campagne né eventi: si può raccogliere, tagliare o chiedere al partito.', example: s => `Fondi personali: ${s.funds}.` },
  { id: 'partito', icon: 'users', page: 'partito', title: 'Partito e staff', what: 'Nel partito hai sostegno interno, correnti, dirigenti locali e uno staff. Il partito decide liste e candidature; lo staff ti toglie lavoro ma costa.', cost: 'Staff e sedi hanno un costo periodico.', next: 'Il sostegno cresce con i risultati e scende con strappi e sconfitte.', example: s => s.party ? `Il tuo partito è ${s.party}.` : 'Se sei indipendente puoi iscriverti o fondare un partito.' },
  { id: 'attivita', icon: 'megaphone', page: 'panoramica', title: 'Attività della settimana: Partecipa o Simula', what: 'Le attività con una scena hanno due pulsanti: PARTECIPA apre la scena, con persone, domande e scelte tue; SIMULA risolve la stessa attività senza animazione, con lo stesso motore. Per ignorare un’attività basta non scegliere nessuno dei due.', cost: 'Il costo si paga una sola volta, a scena finita; aprire la scena non costa nulla.', next: 'Le persone e i temi cambiano da una volta all’altra e citano ciò che la tua carriera ha davvero: il partito, una promessa, il territorio.', example: () => 'Prova «Riunione di partito»: si svolge nella sede del tuo partito.' },
  { id: 'aula', icon: 'dome', page: 'panoramica', title: 'Votazioni in Aula', what: 'Quando c’è una votazione nella tua assemblea la Home mostra «SEGUI LA VOTAZIONE IN AULA»: il voto è già deciso dal gioco e l’Aula lo mostra seggio per seggio, senza cambiare nulla e senza anticipare l’esito.', cost: 'Seguirla non costa nulla; puoi metterla in pausa, saltarla o uscire e riprendere dal punto esatto.', next: 'Le votazioni concluse si rivedono dallo storico, con l’esito ufficiale, distinte da quelle in corso.', example: () => 'Vale per Camera, Senato e consigli comunali, provinciali e regionali.' },
  { id: 'campagna', icon: 'megaphone', page: 'elezioni', title: 'Candidatura e campagna', what: 'Nella Centrale elettorale vedi le elezioni a cui puoi correre, ti candidi se hai i requisiti e conduci la campagna con attività, alleanze e squadre.', cost: 'La candidatura e le attività hanno costi in giorni e denaro.', next: 'La campagna dura fino al voto; il ballottaggio è una fase della stessa elezione.', example: s => s.nextElection ? `Prossima occasione: ${s.nextElection}.` : 'Le prossime elezioni appaiono nella Centrale elettorale.' },
  { id: 'sondaggi', icon: 'chart', page: 'sondaggi', title: 'Sondaggi', what: 'I sondaggi misurano un campione, non gli elettori: hanno margine d’errore e istituti diversi danno numeri diversi. Si parte dall’ultima rilevazione reale, poi la simulazione si muove con gli eventi.', cost: 'Consultarli è gratuito.', next: 'Un sondaggio non è un risultato: il voto può discostarsene.', example: () => 'Guarda quante forze compaiono nel Quadro: ci sono tutte, anche le minori.' },
  { id: 'voto', icon: 'ballot', page: 'elezioni', title: 'Voto e risultati', what: 'Il giorno del voto le percentuali diventano seggi o cariche secondo la legge elettorale di quell’elezione. Il risultato dice se hai vinto, che incarico ottieni e per quanto tempo.', cost: 'Perdere può costare incarico, sostegno e fondi.', next: 'Dopo il voto si forma la nuova assemblea e, se serve, il governo.', example: () => 'I risultati passati restano nello storico della Centrale elettorale.' },
  { id: 'istituzioni', icon: 'dome', page: 'parlamento', title: 'Cariche, poteri e istituzioni', what: 'Ogni incarico dà poteri diversi: un consigliere vota in aula, un sindaco guida la giunta, un parlamentare presenta leggi, il Presidente del Consiglio guida il Governo. Camere, Governo, Quirinale e Leggi stanno in Istituzioni.', cost: 'Le azioni istituzionali costano giorni e capitale politico.', next: 'Puoi fare solo ciò che il tuo ruolo permette: la schermata lo dice.', example: s => s.role ? `Con «${s.role}» vedi le azioni che ti spettano.` : 'Le azioni disponibili dipendono dal tuo incarico.' },
  { id: 'notizie', icon: 'news', page: 'notizie', title: 'Notizie e radio', what: 'La redazione simulata racconta ciò che accade; la radio legge il notiziario della settimana. Sono cronache del gioco, mai fatti reali.', cost: 'Gratis. La voce usa quelle del tuo dispositivo, se ci sono.', next: 'Le storie evolvono: un caso aperto torna nelle settimane dopo.', example: () => 'Un’icona «simulato» distingue ciò che è inventato dal gioco.' },
  { id: 'salvataggio', icon: 'shield', page: 'impostazioni', title: 'Salvataggio e menu', what: 'La partita si salva da sola nel browser. Dal tasto Home torni alla schermata iniziale; da «Altro» raggiungi ogni pagina; dalle Impostazioni gestisci salvataggi, account e preferenze.', cost: 'Nessun costo: salvare non consuma tempo di gioco.', next: 'Con un account ritrovi la carriera su un altro dispositivo.', example: () => 'Puoi riaprire questo tutorial da «Come giocare» quando vuoi.' }
]);


// The practice of each step: a small operation the player does on the REAL page (open a page, a tab, a filter): it consumes no day, no money and no political capital and changes nothing in the career.
// `done(ui)` reads only what the interface already knows (the page, the tab, the filters), so that completing it is checked, never assumed; `result` tells what the player has just seen and why it matters.
// `target`: the control to point at. A step without a practice (the explanation is the whole step) simply has none.
export const TUTORIAL_TASKS = Object.freeze({
  ruolo: { page: 'carriera', prompt: 'Apri la pagina Carriera e la scheda «Obiettivi».', where: 'Menu «Altro» › Carriera, poi la scheda «Obiettivi».', target: '[data-section-tab-value="obiettivi"]', done: ui => ui.page === 'carriera' && ui.tabs?.carriera?.value === 'obiettivi', result: 'Gli obiettivi non si spuntano: si misurano su ciò che fai e decidi. Guardarli non costa nulla e non cambia la carriera.' },
  attivita: { page: 'calendario', prompt: 'Nell’Agenda apri la scheda «Attività».', where: 'In alto, tra le schede dell’Agenda.', target: '[data-section-tab-value="attivita"]', done: ui => ui.page === 'calendario' && ui.tabs?.agenda?.value === 'attivita', result: 'Ecco le attività: ogni voce dice quanti giorni costa e che cosa può cambiare. Per ora le hai solo lette, nessun giorno è stato speso.' },
  voto: { prompt: 'Nella Centrale elettorale apri la scheda «Risultati».', where: 'In alto, tra le schede della Centrale elettorale.', target: '[data-section-tab-value="risultati"]', done: ui => ui.page === 'elezioni' && ui.tabs?.elezioni?.value === 'risultati', result: 'Qui trovi gli esiti delle elezioni, con la distinzione tra dati reali e risultati simulati dal gioco.' },
  notizie: { prompt: 'Nelle Notizie scegli un filtro diverso da «Tutto».', where: 'I filtri sono in alto nella pagina Notizie.', target: '[data-news-filter]:not([data-news-filter="tutto"])', done: ui => ui.page === 'notizie' && Boolean(ui.newsFilter) && ui.newsFilter !== 'tutto', result: 'Hai filtrato le notizie: la redazione è simulata e ogni articolo dice di che si tratta. Il filtro non cambia nulla nella partita.' },
  agenda: { prompt: 'Nell’Agenda apri la scheda «Calendario».', where: 'In alto, tra le schede dell’Agenda.', target: '[data-section-tab-value="calendario"]', done: ui => ui.page === 'calendario' && ui.tabs?.agenda?.value === 'calendario', result: 'Ecco il Calendario: ogni appuntamento ha una data e un costo in giorni. Guardarlo non ti è costato nulla.' },
  partito: { prompt: 'Apri la pagina Partito e passa alla scheda «Vita interna».', where: 'Menu «Altro» › Partito, poi la scheda «Vita interna».', target: '[data-section-tab-value="vita"]', done: ui => ui.page === 'partito' && ui.tabs?.partito?.value === 'vita', result: 'Nella vita interna vedi correnti, dirigenti e le operazioni sul partito. Lo staff, invece, si guida dal pannello dedicato: nulla parte senza la tua approvazione.' },
  sondaggi: { prompt: 'Apri i Sondaggi e scegli la scheda «Alleanze e coalizioni».', where: 'Menu «Altro» › Sondaggi, poi la scheda in alto.', target: '[data-section-tab-value="alleanze"], [data-obs-area="alleanze"]', done: ui => ui.page === 'sondaggi' && ['alleanze', 'forze', 'scenari'].includes(ui.tabs?.osservatorio?.value), result: 'I sondaggi dei partiti e le alleanze sono due sezioni diverse: nella seconda il peso di un’alleanza è la somma dei suoi partiti, e se manca una rilevazione il gioco lo dice.' },
  campagna: { prompt: 'Nella Centrale elettorale apri la scheda «Programma».', where: 'In alto, tra le schede della Centrale elettorale.', target: '[data-section-tab-value="programma"]', done: ui => ui.page === 'elezioni' && ui.tabs?.elezioni?.value === 'programma', result: 'Ecco il Programma: le promesse che fai in campagna restano registrate e gli elettori le verificano dopo il voto.' },
  istituzioni: { prompt: 'Apri la pagina Referendum e passa alla scheda «Costituzionale».', where: 'Istituzioni › Referendum, poi la scheda in alto.', target: '[data-section-tab-value="costituzionale"]', done: ui => ui.page === 'referendum' && ui.tabs?.referendum?.value === 'costituzionale', result: 'Il referendum abrogativo e la revisione costituzionale sono due percorsi con regole diverse (quorum, firme, maggioranze). Ogni scheda ti dice che cosa tocca a te e che cosa avviene da solo.' }
});
export const tutorialTaskOf = stepId => TUTORIAL_TASKS[stepId] ?? null;
export const tutorialTaskDone = (stepId, ui = {}) => { const task = TUTORIAL_TASKS[stepId]; try { return Boolean(task?.done(ui)); } catch { return false; } };

const read = () => { try { const value = JSON.parse(localStorage.getItem(TUTORIAL_KEY) ?? '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } };
const write = patch => { const next = { ...read(), ...patch }; try { localStorage.setItem(TUTORIAL_KEY, JSON.stringify(next)); } catch { /* a preference, not the game */ } return next; };

// The state of the tutorial: { status: 'idle' | 'active' | 'closed' | 'done' | 'skipped', step, expanded }. `expanded` only says whether a phone shows the details of the step (a preference of this
// browser, like the step); a computer always shows them.
export function tutorialState() {
  const saved = read();
  const step = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, Number(saved.step) || 0));
  const status = ['active', 'closed', 'done', 'skipped'].includes(saved.status) ? saved.status : 'idle';
  return { status, step, expanded: saved.expanded === true };
}
export function tutorialAction(action) {
  const { status, step } = tutorialState();
  if (action === 'start' || action === 'restart') return write({ status: 'active', step: 0 });
  if (action === 'resume') return write({ status: 'active', step });
  if (action === 'next') return step >= TUTORIAL_STEPS.length - 1 ? write({ status: 'done', step: 0 }) : write({ status: 'active', step: step + 1 });
  if (action === 'prev') return write({ status: 'active', step: Math.max(0, step - 1) });
  if (action === 'toggle') return write({ expanded: !tutorialState().expanded });
  if (action === 'close') return write({ status: status === 'active' ? 'closed' : status });
  if (action === 'skip') return write({ status: 'skipped' });
  return read();
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// What the examples say, taken from the game being played: nothing here is saved or changed.
export function tutorialContext(state = {}, extra = {}) {
  const week = state.game?.week ?? {};
  return { role: extra.role ?? '', party: extra.party ?? '', week: week.index ?? '—', days: week.ap ?? '—', maxDays: week.maxAp ?? 6, funds: extra.funds ?? '—', nextElection: extra.nextElection ?? '' };
}

// The card: progress, the step with its three facts and an example, and the controls. Shown only while the tutorial is active, over the pages of the game.
export function renderTutorialCard(state, activePage, context = {}) {
  const { status, step, expanded } = tutorialState();
  if (status !== 'active') return '';
  const item = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;
  const here = activePage === item.page;
  const percent = Math.round(((step + 1) / TUTORIAL_STEPS.length) * 100);
  const task = tutorialTaskOf(item.id);
  const done = Boolean(task) && tutorialTaskDone(item.id, { page: activePage, ...(context.ui ?? {}) });
  const taskBlock = task ? `<div class="tutorial-task ${done ? 'is-done' : ''}" data-tutorial-task="${esc(item.id)}" data-task-done="${done ? '1' : '0'}" data-task-target="${esc(task.target)}" role="status"><span class="tutorial-task-mark" aria-hidden="true">${done ? '✓' : '→'}</span><div><strong>${done ? 'Fatto!' : 'Prova tu'}</strong><span>${esc(done ? task.result : task.prompt)}</span>${done ? '' : `<small>${esc(task.where)} Non costa giorni né denaro.</small>`}</div></div>` : '';
  // On a phone the card is a slim, non-blocking panel above the bottom bar: the step, the progress and the essential buttons; the details open on request. On a computer everything shows.
  return `<aside class="tutorial-card ${expanded ? 'is-expanded' : 'is-compact'}" data-tutorial-card data-expanded="${expanded ? '1' : '0'}" role="dialog" aria-modal="false" aria-labelledby="tutorial-title" aria-live="polite"><header><span class="tutorial-kicker">${glyph(item.icon, 16)} TUTORIAL · PASSO ${step + 1} DI ${TUTORIAL_STEPS.length}</span><button type="button" class="icon-button tutorial-toggle" data-tutorial="toggle" aria-expanded="${expanded}" aria-controls="tutorial-details" aria-label="${expanded ? 'Nascondi i dettagli del passo' : 'Mostra i dettagli del passo'}"><span class="tutorial-chevron" aria-hidden="true"></span></button><button type="button" class="icon-button" data-tutorial="close" aria-label="Chiudi il tutorial (potrai riprenderlo da «Come giocare»)">×</button></header><div class="tutorial-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${TUTORIAL_STEPS.length}" aria-valuenow="${step + 1}"><i style="width:${percent}%"></i></div><h3 id="tutorial-title">${esc(item.title)}</h3>${taskBlock}<div class="tutorial-details" id="tutorial-details"><p>${esc(item.what)}</p><dl class="tutorial-facts"><div><dt>Costa</dt><dd>${esc(item.cost)}</dd></div><div><dt>Poi</dt><dd>${esc(item.next)}</dd></div></dl><p class="tutorial-example">${esc(item.example(context))}</p></div><div class="tutorial-actions"><button type="button" class="secondary-button" data-tutorial="prev" ${step ? '' : 'disabled'}>Indietro</button><button type="button" class="primary-button" data-tutorial="next">${last ? 'Fine' : 'Avanti'}</button>${here ? '' : `<button type="button" class="go-button" data-nav="${item.page}" data-tutorial-go><span>Vai alla schermata</span><i class="go-arrow" aria-hidden="true"></i></button>`}<button type="button" class="text-link" data-tutorial="skip">Salta il tutorial</button></div></aside>`;
}

// For “Come giocare”: where the player stopped, with the right button.
export function renderTutorialInvite() {
  const { status, step } = tutorialState();
  const label = status === 'closed' ? `Riprendi dal passo ${step + 1} di ${TUTORIAL_STEPS.length}` : status === 'active' ? 'Il tutorial è in corso' : status === 'idle' ? 'Avvia il tutorial guidato' : 'Rifai il tutorial dall’inizio';
  const action = status === 'closed' ? 'resume' : status === 'idle' ? 'start' : 'restart';
  return `<section class="tutorial-invite"><div><strong>Tutorial guidato</strong><p>${TUTORIAL_STEPS.length} passi brevi sulle pagine vere del gioco. Non costa giorni, denaro o tempo, non cambia la tua carriera e si può saltare o riprendere quando vuoi.</p></div><button type="button" class="primary-button" data-tutorial="${action}" ${status === 'active' ? 'disabled' : ''}>${label}</button></section>`;
}
