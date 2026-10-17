// The guided tutorial: eleven short steps, optional, that follow the player through the real pages of the game. It is a card, not a mode: it costs no action points,
// no money and no time, never touches the career, and remembers only where the player stopped (this browser's preference, not part of the saved game).
// Skip it, close it and resume it later from “Come giocare”, or start it again from the first step.
import { glyph } from './visuals.js?v=20261017-3';

export const TUTORIAL_KEY = 'politicando.tutorial.v1';
// Each step: id, icon, page it is about, title, what it is, what it costs, what happens next, and an example drawn from the player's own game.
export const TUTORIAL_STEPS = Object.freeze([
  { id: 'ruolo', icon: 'flag', page: 'panoramica', title: 'Il tuo ruolo e l’obiettivo', what: 'Sei un politico italiano: la Home dice chi sei, che incarico hai e che cosa conviene fare adesso. L’obiettivo non è uno solo: salire di incarico, vincere elezioni, guidare un partito o il Governo.', cost: 'Leggere non costa nulla.', next: 'Ogni scelta cambia consenso, rapporti e opportunità nelle settimane dopo.', example: s => `${s.role ? `Adesso sei «${s.role}»` : 'Il tuo ruolo è scritto in alto'}${s.party ? ` per ${s.party}` : ''}.` },
  { id: 'agenda', icon: 'book', page: 'calendario', title: 'Home e agenda', what: 'La Home riassume le scadenze e le urgenze; l’Agenda elenca gli appuntamenti della settimana e quelli in arrivo. Ciò che tocca puoi aprirlo, rimandarlo o affidarlo allo staff.', cost: 'Ogni attività dell’agenda dice quanti giorni richiede.', next: 'Le cose non fatte non spariscono: a volte scadono e hanno conseguenze.', example: s => `Questa settimana ha ${s.maxDays} giorni da spendere.` },
  { id: 'settimana', icon: 'clock', page: 'panoramica', title: 'Settimana, giorni e punti azione', what: 'Il tempo va avanti una settimana alla volta. I giorni sono i tuoi punti azione: ogni attività ne consuma alcuni. Quando hai finito premi «Chiudi settimana»: il mondo va avanti anche senza di te.', cost: 'I giorni finiti non tornano fino alla settimana successiva.', next: 'Dopo la chiusura trovi il resoconto: eventi, sondaggi e notizie.', example: s => `Ora sei alla settimana ${s.week} e hai ${s.days} giorni su ${s.maxDays}.` },
  { id: 'fondi', icon: 'wallet', page: 'finanze', title: 'Costi e fondi', what: 'Esistono fondi diversi, mai mescolati: i tuoi fondi personali, la tesoreria del partito, il fondo elettorale della campagna e il bilancio dell’istituzione che governi.', cost: 'Ogni operazione dice da quale fondo esce.', next: 'Senza fondi non si fanno campagne né eventi: si può raccogliere, tagliare o chiedere al partito.', example: s => `Fondi personali: ${s.funds}.` },
  { id: 'partito', icon: 'users', page: 'partito', title: 'Partito e staff', what: 'Nel partito hai sostegno interno, correnti, dirigenti locali e uno staff. Il partito decide liste e candidature; lo staff ti toglie lavoro ma costa.', cost: 'Staff e sedi hanno un costo periodico.', next: 'Il sostegno cresce con i risultati e scende con strappi e sconfitte.', example: s => s.party ? `Il tuo partito è ${s.party}.` : 'Se sei indipendente puoi iscriverti o fondare un partito.' },
  { id: 'campagna', icon: 'megaphone', page: 'elezioni', title: 'Candidatura e campagna', what: 'Nella Centrale elettorale vedi le elezioni a cui puoi correre, ti candidi se hai i requisiti e conduci la campagna con attività, alleanze e squadre.', cost: 'La candidatura e le attività hanno costi in giorni e denaro.', next: 'La campagna dura fino al voto; il ballottaggio è una fase della stessa elezione.', example: s => s.nextElection ? `Prossima occasione: ${s.nextElection}.` : 'Le prossime elezioni appaiono nella Centrale elettorale.' },
  { id: 'sondaggi', icon: 'chart', page: 'sondaggi', title: 'Sondaggi', what: 'I sondaggi misurano un campione, non gli elettori: hanno margine d’errore e istituti diversi danno numeri diversi. Si parte dall’ultima rilevazione reale, poi la simulazione si muove con gli eventi.', cost: 'Consultarli è gratuito.', next: 'Un sondaggio non è un risultato: il voto può discostarsene.', example: () => 'Guarda quante forze compaiono nel Quadro: ci sono tutte, anche le minori.' },
  { id: 'voto', icon: 'ballot', page: 'elezioni', title: 'Voto e risultati', what: 'Il giorno del voto le percentuali diventano seggi o cariche secondo la legge elettorale di quell’elezione. Il risultato dice se hai vinto, che incarico ottieni e per quanto tempo.', cost: 'Perdere può costare incarico, sostegno e fondi.', next: 'Dopo il voto si forma la nuova assemblea e, se serve, il governo.', example: () => 'I risultati passati restano nello storico della Centrale elettorale.' },
  { id: 'istituzioni', icon: 'dome', page: 'parlamento', title: 'Cariche, poteri e istituzioni', what: 'Ogni incarico dà poteri diversi: un consigliere vota in aula, un sindaco guida la giunta, un parlamentare presenta leggi, il Presidente del Consiglio guida il Governo. Camere, Governo, Quirinale e Leggi stanno in Istituzioni.', cost: 'Le azioni istituzionali costano giorni e capitale politico.', next: 'Puoi fare solo ciò che il tuo ruolo permette: la schermata lo dice.', example: s => s.role ? `Con «${s.role}» vedi le azioni che ti spettano.` : 'Le azioni disponibili dipendono dal tuo incarico.' },
  { id: 'notizie', icon: 'news', page: 'notizie', title: 'Notizie e radio', what: 'La redazione simulata racconta ciò che accade; la radio legge il notiziario della settimana. Sono cronache del gioco, mai fatti reali.', cost: 'Gratis. La voce usa quelle del tuo dispositivo, se ci sono.', next: 'Le storie evolvono: un caso aperto torna nelle settimane dopo.', example: () => 'Un’icona «simulato» distingue ciò che è inventato dal gioco.' },
  { id: 'salvataggio', icon: 'shield', page: 'impostazioni', title: 'Salvataggio e menu', what: 'La partita si salva da sola nel browser. Dal tasto Home torni alla schermata iniziale; da «Altro» raggiungi ogni pagina; dalle Impostazioni gestisci salvataggi, account e preferenze.', cost: 'Nessun costo: salvare non consuma tempo di gioco.', next: 'Con un account ritrovi la carriera su un altro dispositivo.', example: () => 'Puoi riaprire questo tutorial da «Come giocare» quando vuoi.' }
]);

const read = () => { try { const value = JSON.parse(localStorage.getItem(TUTORIAL_KEY) ?? '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } };
const write = patch => { const next = { ...read(), ...patch }; try { localStorage.setItem(TUTORIAL_KEY, JSON.stringify(next)); } catch { /* a preference, not the game */ } return next; };

// The state of the tutorial: { status: 'idle' | 'active' | 'closed' | 'done' | 'skipped', step }.
export function tutorialState() {
  const saved = read();
  const step = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, Number(saved.step) || 0));
  const status = ['active', 'closed', 'done', 'skipped'].includes(saved.status) ? saved.status : 'idle';
  return { status, step };
}
export function tutorialAction(action) {
  const { status, step } = tutorialState();
  if (action === 'start' || action === 'restart') return write({ status: 'active', step: 0 });
  if (action === 'resume') return write({ status: 'active', step });
  if (action === 'next') return step >= TUTORIAL_STEPS.length - 1 ? write({ status: 'done', step: 0 }) : write({ status: 'active', step: step + 1 });
  if (action === 'prev') return write({ status: 'active', step: Math.max(0, step - 1) });
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
  const { status, step } = tutorialState();
  if (status !== 'active') return '';
  const item = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;
  const here = activePage === item.page;
  const percent = Math.round(((step + 1) / TUTORIAL_STEPS.length) * 100);
  return `<aside class="tutorial-card" data-tutorial-card role="dialog" aria-modal="false" aria-labelledby="tutorial-title" aria-live="polite"><header><span class="tutorial-kicker">${glyph(item.icon, 16)} TUTORIAL · PASSO ${step + 1} DI ${TUTORIAL_STEPS.length}</span><button type="button" class="icon-button" data-tutorial="close" aria-label="Chiudi il tutorial (potrai riprenderlo da «Come giocare»)">×</button></header><div class="tutorial-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${TUTORIAL_STEPS.length}" aria-valuenow="${step + 1}"><i style="width:${percent}%"></i></div><h3 id="tutorial-title">${esc(item.title)}</h3><p>${esc(item.what)}</p><dl class="tutorial-facts"><div><dt>Costa</dt><dd>${esc(item.cost)}</dd></div><div><dt>Poi</dt><dd>${esc(item.next)}</dd></div></dl><p class="tutorial-example">${esc(item.example(context))}</p><div class="tutorial-actions">${here ? '' : `<button type="button" class="secondary-button" data-nav="${item.page}" data-tutorial-go>Vai alla schermata</button>`}<button type="button" class="secondary-button" data-tutorial="prev" ${step ? '' : 'disabled'}>Indietro</button><button type="button" class="primary-button" data-tutorial="next">${last ? 'Fine' : 'Avanti'}</button><button type="button" class="text-link" data-tutorial="skip">Salta il tutorial</button></div></aside>`;
}

// For “Come giocare”: where the player stopped, with the right button.
export function renderTutorialInvite() {
  const { status, step } = tutorialState();
  const label = status === 'closed' ? `Riprendi dal passo ${step + 1} di ${TUTORIAL_STEPS.length}` : status === 'active' ? 'Il tutorial è in corso' : status === 'idle' ? 'Avvia il tutorial guidato' : 'Rifai il tutorial dall’inizio';
  const action = status === 'closed' ? 'resume' : status === 'idle' ? 'start' : 'restart';
  return `<section class="tutorial-invite"><div><strong>Tutorial guidato</strong><p>${TUTORIAL_STEPS.length} passi brevi sulle pagine vere del gioco. Non costa giorni, denaro o tempo, non cambia la tua carriera e si può saltare o riprendere quando vuoi.</p></div><button type="button" class="primary-button" data-tutorial="${action}" ${status === 'active' ? 'disabled' : ''}>${label}</button></section>`;
}
