// The days of the week: small and large events that keep the political world alive between elections and crises.
// They join the procedural events of career-rules.js (same format) with three more fields: `days` (the weekdays they
// fall on, 0 = Monday … 6 = Sunday), `light` (a small matter: a quick choice, small effects) and, for the chains,
// `followUp` on a choice (a consequence that comes due weeks later, if the conditions still hold). All simulated.
const d = (id, category, rest) => ({ id, category, cooldown: 10, weight: 2, days: [0, 1, 2, 3, 4], ...rest });
const c = (id, label, rest = {}) => ({ id, label, ...rest });
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];

export const DAILY_EVENTS = Object.freeze([
  // ---------- party and currents ----------
  d('circolo-serata', 'partito', { light: true, cooldown: 6, when: sit => sit.member || sit.secretary, days: [1, 3, 4], title: 'Serata al circolo di {municipality}', body: 'Gli iscritti si ritrovano per discutere dei prossimi mesi: una presenza fa piacere, un’assenza si nota.', defaultChoice: 'assente', choices: [
    c('partecipa', 'Passa a salutare', { cost: { ap: 1 }, effects: { party: { support: 2 }, org: { militants: 0.01 } } }),
    c('assente', 'Mandi un messaggio', { effects: { party: { support: -0.3 } } })] }),
  d('tessere-record', 'partito', { positive: true, weight: 1.2, cooldown: 14, when: sit => sit.party && sit.pollDelta >= 0.2, title: 'Boom di tessere online', body: 'La campagna di tesseramento funziona: in pochi giorni arrivano centinaia di nuove iscrizioni, e con loro qualche pretesa.', defaultChoice: 'accogli', choices: [
    c('accogli', 'Accogli i nuovi iscritti con un’assemblea', { cost: { ap: 1 }, effects: { org: { members: 0.6, militants: 0.02 }, party: { support: 1 } } }),
    c('accogli-in-silenzio', 'Registrali e basta', { effects: { org: { members: 0.4 } } }),
    c('ignora', 'Non fare nulla', { effects: { org: { members: 0.15, cohesion: -1 } } })] }),
  d('cena-corrente', 'partito', { cooldown: 12, when: sit => sit.member && sit.game.party.currents.length >= 2, title: 'Cena di corrente: {currentA} ti invita', body: 'Un tavolo ristretto per parlare di organi, liste e congresso. Sedersi vuol dire schierarsi, anche solo un po’.', defaultChoice: 'declina', choices: [
    c('partecipa', 'Siediti al tavolo', { cost: { ap: 1 }, effects: { relations: { currentA: 5, otherCurrents: -2 } }, followUp: { id: 'retroscena', weeks: 2, chance: 0.4 } }),
    c('declina', 'Declina con garbo', { effects: { relations: { currentA: -1 } } })] }),
  d('retroscena', 'media', { weight: 0, cooldown: 6, title: 'Il retroscena sui giornali', body: 'Un quotidiano racconta la cena: nomi, accordi, liste. Nel partito qualcuno si sente escluso.', defaultChoice: 'ignora', choices: [
    c('smentisci', 'Smentisci e minimizza', { effects: { relations: { otherCurrents: 2 }, stats: { reputation: -0.5 } } }),
    c('rivendica', 'Rivendica la scelta', { effects: { relations: { currentA: 3, otherCurrents: -3 }, stats: { notoriety: 1 } } }),
    c('ignora', 'Lascia correre', { effects: { relations: { otherCurrents: -1.5 } } })] }),
  d('sezione-chiude', 'partito', { cooldown: 16, when: sit => sit.party && sit.game.party.org?.sections?.some(item => item.vitality < 35), title: 'Una sezione rischia la chiusura', body: 'Un circolo che resiste da anni non riesce più a pagare l’affitto: i militanti chiedono aiuto prima di abbassare la serranda.', defaultChoice: 'lascia', choices: [
    c('finanzia', 'Raccogli i fondi per tenerla aperta', { cost: { funds: 300 }, effects: { org: { militants: 0.01, cohesion: 2 }, party: { support: 1.5 } }, followUp: { id: 'circolo-riapre', weeks: 6, chance: 0.7 } }),
    c('visita', 'Vai a un’assemblea con i militanti', { cost: { ap: 1 }, effects: { org: { cohesion: 2, militants: 0.01 }, relations: { leadership: 1 } } }),
    c('lascia', 'Lasciala al suo destino', { effects: { org: { cohesion: -1.5 }, party: { support: -1 } }, later: { weeks: 6, chance: 0.5, hint: 'Altri circoli potrebbero seguirla', label: 'Altri due circoli abbassano la serranda', effects: { org: { members: -0.5 }, party: { support: -1 } } } })] }),
  d('giovani-iniziativa', 'partito', { light: true, weight: 1.6, cooldown: 12, when: sit => sit.party, days: [3, 4, 5], title: 'I giovani del partito organizzano un’iniziativa', body: 'Un pomeriggio di dibattiti su scuola, lavoro e casa: cercano un adulto che ci metta la faccia.', defaultChoice: 'manda-saluto', choices: [
    c('partecipa', 'Intervieni', { cost: { ap: 1 }, effects: { party: { support: 1.5 }, stats: { popularity: 1 }, org: { militants: 0.02 } } }),
    c('manda-saluto', 'Mandi un saluto', { effects: { party: { support: 0.3 } } })] }),
  d('direzione-convocata', 'partito', { cooldown: 8, when: sit => sit.direzione || sit.secretary, days: [1, 2, 3], title: 'Direzione convocata in fretta', body: 'Si discute di alleanze e liste: i numeri dell’ultima conta pesano sulle parole.', defaultChoice: 'assente', choices: [
    c('partecipa', 'Partecipa e intervieni', { cost: { ap: 1 }, effects: { relations: { leadership: 3 }, party: { support: 2 }, stats: { influence: 0.5 } } }),
    c('delega', 'Mandi una delega', { effects: { relations: { leadership: -0.5 } } }),
    c('assente', 'Salti la riunione', { effects: { relations: { leadership: -2 }, party: { support: -1 } } })] }),
  d('tessere-gonfiate', 'partito', { category: 'scandalo', cooldown: 24, weight: 1.4, when: sit => sit.member && sit.signals.hostileCurrents >= 1, title: 'Polemica sulle tessere gonfiate', body: 'Un’area denuncia iscritti fantasma in una federazione. Il caso non è provato ma finirà sui giornali.', defaultChoice: 'silenzio', choices: [
    c('indaga', 'Chiedi una verifica dei probiviri', { cost: { capital: 1 }, effects: { relations: { leadership: 2 }, org: { cohesion: 1 } }, outcomes: [
      { chance: 0.6, label: 'La verifica chiude il caso in fretta', effects: { stats: { reputation: 1 } } },
      { chance: 0.4, label: 'La verifica trova irregolarità vere: imbarazzo per tutti', effects: { org: { cohesion: -4 }, stats: { reputation: -1 } } }] }),
    c('nega', 'Difendi la federazione', { effects: { relations: { currentA: 2, otherCurrents: -3 }, org: { conflicts: 6 } } }),
    c('silenzio', 'Resta in silenzio', { effects: { org: { cohesion: -2 } } })] }),
  d('donatore-partito', 'partito', { category: 'risorse', cooldown: 20, weight: 1.4, when: sit => sit.secretary || sit.direzione, title: 'Un imprenditore offre un contributo al partito', body: 'Una somma importante, senza condizioni dichiarate. Le condizioni, di solito, arrivano dopo.', defaultChoice: 'rifiuta', choices: [
    c('accetta', 'Accetta e rendiconta tutto', { effects: { org: { treasury: 3500 } }, later: { weeks: 10, chance: 0.3, hint: 'Il donatore potrebbe chiedere qualcosa', label: 'Il donatore chiede un favore sulle liste', effects: { stats: { reputation: -1 }, org: { cohesion: -2 } } } }),
    c('accetta-meta', 'Accetta una parte, il resto va a una fondazione', { effects: { org: { treasury: 1500 }, stats: { reputation: 0.5 } } }),
    c('rifiuta', 'Rifiuta', { effects: { stats: { reputation: 1 } } })] }),
  d('scuola-quadri', 'partito', { light: true, cooldown: 16, when: sit => sit.party, days: [4, 5], title: 'Scuola di formazione per i quadri', body: 'Due giorni di lezioni su bilanci, comunicazione e campagne: il partito cerca docenti e partecipanti.', defaultChoice: 'salta', choices: [
    c('docente', 'Tieni una lezione', { cost: { ap: 1 }, effects: { org: { militants: 0.03, cohesion: 2 }, stats: { experience: 0.5, influence: 0.5 } } }),
    c('salta', 'Non partecipi', {})] }),
  d('assemblee-vuote', 'partito', { cooldown: 18, when: sit => sit.party && sit.game.party.org?.cohesion < 52, title: 'Le assemblee si svuotano', body: 'Poche presenze e molti musi lunghi: gli iscritti chiedono perché dovrebbero venire.', defaultChoice: 'rassegnati', choices: [
    c('rilancia', 'Lancia una consultazione degli iscritti', { cost: { ap: 1 }, effects: { org: { cohesion: 5, militants: 0.015 }, party: { support: 1.5 } } }),
    c('rassegnati', 'Aspetta che passi', { effects: { org: { cohesion: -2 } } })] }),
  d('anniversario-partito', 'partito', { light: true, positive: true, weight: 1.2, cooldown: 40, when: sit => sit.party, days: [5, 6], title: 'Anniversario del partito', body: 'Una festa con vecchi dirigenti e giovani militanti: l’occasione per ricordare da dove si viene.', defaultChoice: 'partecipa', choices: [
    c('partecipa', 'Partecipa alla festa', { cost: { ap: 1 }, effects: { org: { cohesion: 3, militants: 0.02 }, party: { support: 1 } } }),
    c('saluta', 'Mandi un saluto', {})] }),
  d('ex-dirigente-attacca', 'media', { cooldown: 20, when: sit => sit.party && sit.stats.notoriety >= 20, title: 'Un ex dirigente attacca il partito', body: 'In un’intervista un ex dirigente dice che il partito ha smarrito la strada. L’intervista è feroce e circola molto.', defaultChoice: 'ignora', choices: [
    c('rispondi', 'Rispondi punto per punto', { effects: { stats: { notoriety: 1.5 }, org: { cohesion: 1 } }, risk: { chance: 0.2, label: 'La replica si trasforma in rissa verbale', effects: { stats: { reputation: -1.5 } } } }),
    c('apri', 'Offri un confronto riservato', { cost: { capital: 1 }, effects: { relations: { leadership: 1 }, stats: { reputation: 1 } } }),
    c('ignora', 'Lascia correre', { effects: { org: { cohesion: -1 } } })] }),
  d('rivale-sgambetto', 'partito', { cooldown: 14, when: sit => sit.member && sit.game.party.rank >= 1, title: 'Il rivale ti fa lo sgambetto in direzione', body: 'Il tuo rivale interno (figura simulata) propone un ordine del giorno che ti toglie una delega. Passa per un voto.', defaultChoice: 'vota', choices: [
    c('vota', 'Presidia la riunione e vota contro', { cost: { ap: 1 }, effects: { relations: { rival: -3 }, party: { support: 1 } }, outcomes: [
      { chance: 0.55, label: 'La proposta cade: il rivale ne esce indebolito', effects: { relations: { rival: -3 }, stats: { influence: 1 } } },
      { chance: 0.45, label: 'Passa di misura: perdi la delega', effects: { party: { support: -2 }, stats: { influence: -1 } } }] }),
    c('tratta', 'Offri un compromesso al rivale', { cost: { capital: 2 }, effects: { relations: { rival: 6 }, party: { support: 0.5 } } }),
    c('lascia', 'Lasci perdere la delega', { effects: { party: { support: -1.5 }, stats: { influence: -0.5 } } })] }),
  d('candidato-civico', 'elezioni', { cooldown: 14, when: sit => sit.party && sit.signals.electionSoon, title: 'Un civico chiede di candidarsi con voi', body: 'Un professionista conosciuto in città vuole entrare in lista: porta voti, ma toglie un posto a qualcuno del partito.', defaultChoice: 'tempo', choices: [
    c('accogli', 'Accoglilo nelle liste', { cost: { capital: 1 }, effects: { prep: 4, party: { support: -1 }, relations: { civic: 3 } }, followUp: { id: 'civico-in-lista', weeks: 4, chance: 0.6 } }),
    c('tempo', 'Prendi tempo', { effects: {} }),
    c('declina', 'Declina: i posti sono del partito', { effects: { party: { support: 1 }, relations: { civic: -2 } } })] }),

  // ---------- Parliament ----------
  d('emendamento-notturno', 'parlamento', { cooldown: 8, when: sit => sit.seat, days: [1, 2, 3], title: 'Emendamento notturno in commissione', body: 'Un emendamento dell’ultimo minuto cambia il testo: o lo firmi con altri colleghi o lo combatti da solo.', defaultChoice: 'ignora', choices: [
    c('firma', 'Firmalo con i colleghi', { cost: { ap: 1 }, effects: { group: { support: 2 }, stats: { influence: 1 } }, risk: { chance: 0.15, label: 'Il testo si rivela sbilanciato e finisce sui giornali', effects: { stats: { reputation: -1.5 } } } }),
    c('contrasta', 'Contrastalo in commissione', { cost: { ap: 1 }, effects: { stats: { experience: 1, notoriety: 0.5 }, group: { support: -1 } } }),
    c('ignora', 'Lascia fare', { effects: {} })] }),
  d('question-time', 'parlamento', { light: true, cooldown: 8, when: sit => sit.seat, days: [2, 3], title: 'Question time', body: 'Hai due minuti per interrogare un ministro: pochi, ma in diretta.', defaultChoice: 'passa', choices: [
    c('interroga', 'Presenta l’interrogazione', { cost: { ap: 1 }, effects: { stats: { notoriety: 1.5, experience: 0.5 } } }),
    c('passa', 'Passi la mano', {})] }),
  d('pranzo-capogruppo', 'parlamento', { light: true, cooldown: 12, when: sit => sit.seat, days: [2, 3], title: 'Pranzo con il capogruppo', body: 'Il capogruppo vuole sentire come va nel territorio e capire su chi può contare nei prossimi voti.', defaultChoice: 'declina', choices: [
    c('vai', 'Vai al pranzo', { cost: { ap: 1 }, effects: { group: { support: 3 }, stats: { influence: 0.5 } } }),
    c('declina', 'Declina', { effects: { group: { support: -0.5 } } })] }),
  d('missione-commissione', 'opportunita', { positive: true, weight: 1.2, cooldown: 24, when: sit => sit.seat, days: [3, 4], title: 'Missione all’estero della commissione', body: 'Tre giorni tra incontri e visite: un’occasione per fare esperienza e rapporti, a spese del collegio.', defaultChoice: 'parti', choices: [
    c('parti', 'Parti con la delegazione', { cost: { ap: 2 }, effects: { stats: { experience: 2, influence: 0.8 }, group: { support: 1 } } }),
    c('rinuncia', 'Rinunci', { effects: { stats: { popularity: 0.3 } } })] }),
  d('lobby-incontro', 'parlamento', { cooldown: 14, when: sit => sit.seat, title: 'Un lobbista chiede un incontro', body: 'Un’associazione di categoria vuole spiegarti i suoi problemi: utile informazione, ma anche una richiesta in arrivo.', defaultChoice: 'declina', choices: [
    c('incontra', 'Incontralo', { cost: { ap: 1 }, effects: { relations: { business: 4 }, funds: 200 }, risk: { chance: 0.2, label: 'L’incontro finisce in un’agenzia di stampa', effects: { stats: { reputation: -1.5 } } }, followUp: { id: 'lobby-richiesta', weeks: 4, chance: 0.5 } }),
    c('declina', 'Declina cortesemente', { effects: { relations: { business: -1 } } })] }),
  d('lobby-richiesta', 'parlamento', { weight: 0, cooldown: 8, when: sit => sit.seat, title: 'La categoria passa all’incasso', body: 'Quelli che hai incontrato chiedono un emendamento a loro favore, con il garbo di chi sa di avere un credito.', defaultChoice: 'rifiuta', choices: [
    c('accogli', 'Presenta l’emendamento', { cost: { capital: 1 }, effects: { relations: { business: 5 }, stats: { reputation: -1 }, funds: 300 } }),
    c('rifiuta', 'Spiega che non è possibile', { effects: { relations: { business: -4 }, stats: { reputation: 0.5 } } })] }),
  d('petizione-aula', 'parlamento', { light: true, cooldown: 14, when: sit => sit.seat, days: [1, 2, 3], title: 'Una petizione arriva in Aula', body: 'Duemila firme su un problema del tuo territorio: i promotori cercano un parlamentare che la porti avanti.', defaultChoice: 'archivia', choices: [
    c('porta', 'Portala in commissione', { cost: { ap: 1 }, effects: { stats: { popularity: 1.5, experience: 0.5 }, relations: { civic: 3 } } }),
    c('archivia', 'Non hai tempo', { effects: { relations: { civic: -1 } } })] }),
  d('tiratore-sospetto', 'parlamento', { cooldown: 16, when: sit => sit.seat && sit.inMajority && sit.signals.stability < 55, title: 'Voci su franchi tiratori nel gruppo', body: 'In corridoio si dice che qualcuno non voterà con la maggioranza: i capigruppo contano i voti uno a uno.', defaultChoice: 'silenzio', choices: [
    c('rassicura', 'Rassicura il capogruppo sul tuo voto', { cost: { ap: 1 }, effects: { group: { support: 3 }, government: { stability: 1 } } }),
    c('silenzio', 'Non commentare', { effects: { group: { support: -0.5 } } })] }),

  // ---------- government ----------
  d('vertice-maggioranza', 'governo', { cooldown: 10, when: sit => sit.governing && sit.inMajority, days: [0, 1], title: 'Vertice di maggioranza', body: 'I leader fanno il punto sulla settimana: tra i temi, un provvedimento che divide gli alleati.', defaultChoice: 'segui', choices: [
    c('partecipa', 'Porta la voce del tuo gruppo', { cost: { ap: 1 }, effects: { group: { support: 2 }, government: { stability: 2 }, stats: { influence: 0.8 } } }),
    c('segui', 'Segui da lontano', { effects: {} })] }),
  d('governo-cala', 'governo', { cooldown: 14, when: sit => sit.governing && sit.seat && !sit.inMajority && sit.signals.stability < 55, title: 'Il governo cala nei sondaggi', body: 'La maggioranza è sotto pressione: l’opposizione ha una finestra per farsi sentire.', defaultChoice: 'attendi', choices: [
    c('attacca', 'Guida l’attacco in Aula', { cost: { ap: 1 }, effects: { stats: { notoriety: 2, popularity: 0.5 }, groups: { coalition: -1.5 } } }),
    c('proposta', 'Presenta una proposta alternativa', { cost: { ap: 1, capital: 1 }, effects: { stats: { reputation: 1.5, experience: 1 } } }),
    c('attendi', 'Attendi', { effects: {} })] }),
  d('rimpasto-voci', 'governo', { cooldown: 18, when: sit => sit.governing, title: 'Voci di rimpasto', body: 'Si parla di cambiare tre ministri: nomi, correnti e partiti si muovono. C’è chi ti cerca per un’opinione.', defaultChoice: 'ascolta', choices: [
    c('ascolta', 'Ascolta e non prendere impegni', { effects: { stats: { influence: 0.3 } } }),
    c('sponsorizza', 'Sostieni un nome', { cost: { capital: 2 }, effects: { stats: { influence: 1 }, groups: { coalition: 1.5 } }, risk: { chance: 0.35, label: 'Il tuo candidato salta e qualcuno se lo ricorderà', effects: { stats: { reputation: -1 }, groups: { coalition: -2 } } } })] }),
  d('ministro-gaffe', 'governo', { cooldown: 16, when: sit => sit.minister, title: 'Una gaffe in conferenza stampa', body: 'Una frase detta male sul tuo dossier: i giornali la rilanciano da ore.', defaultChoice: 'chiarisci', choices: [
    c('chiarisci', 'Chiarisci subito', { cost: { ap: 1 }, effects: { stats: { reputation: -0.3, notoriety: 1 } } }),
    c('smentisci', 'Smentisci di aver detto così', { effects: { stats: { reputation: -1.5 } }, risk: { chance: 0.4, label: 'Esce il video: la smentita crolla', effects: { stats: { reputation: -2 } } } }),
    c('ignora', 'Ignora', { effects: { stats: { reputation: -0.8 } } })] }),
  d('decreto-contestato', 'governo', { cooldown: 12, when: sit => sit.governing && sit.seat, days: [2, 3], title: 'Un decreto contestato', body: 'Il testo non convince nemmeno la maggioranza: chi vota con il governo ne risponderà al territorio.', defaultChoice: 'attendi', choices: [
    c('sostieni', 'Sostienilo con convinzione', { effects: { group: { support: 1.5 }, government: { stability: 1.5 }, stats: { popularity: -0.5 } } }),
    c('modifica', 'Chiedi modifiche', { cost: { ap: 1 }, effects: { stats: { influence: 1, experience: 0.5 } } }),
    c('attendi', 'Attendi gli sviluppi', {})] }),
  d('lettera-europa', 'europa', { cooldown: 20, when: sit => sit.signals.spread >= 150, days: [1, 2], title: 'Lettera da Bruxelles sui conti', body: 'La Commissione chiede chiarimenti sul deficit: il tema entra nel dibattito, e ognuno ci mette sopra la propria bandiera.', defaultChoice: 'silenzio', choices: [
    c('responsabilita', 'Chiedi responsabilità a tutti', { effects: { stats: { reputation: 1 } } }),
    c('attacca', 'Attacca chi governa', { effects: { stats: { notoriety: 1.5 }, groups: { coalition: -1 } } }),
    c('silenzio', 'Non commentare', {})] }),

  // ---------- territory and administration ----------
  d('consiglio-turbolento', 'territorio', { cooldown: 9, when: sit => sit.role.local, days: [1, 3], title: 'Seduta turbolenta del consiglio comunale', body: 'Un ordine del giorno infuoca l’aula: si rischia la rissa verbale, e il pubblico riprende tutto.', defaultChoice: 'tace', choices: [
    c('mediazione', 'Proponi una mediazione', { cost: { ap: 1 }, effects: { stats: { reputation: 1.5, popularity: 1 } } }),
    c('attacca', 'Alza i toni', { effects: { stats: { notoriety: 2, reputation: -1 } } }),
    c('tace', 'Stai zitto e voti', { effects: {} })] }),
  d('strada-chiusa', 'territorio', { light: true, cooldown: 8, when: sit => sit.role.local || sit.role.regional, title: 'Una strada chiusa per lavori a {municipality}', body: 'Traffico in tilt e commercianti in rivolta: a chi spetta rispondere?', defaultChoice: 'ignora', choices: [
    c('sopralluogo', 'Fai un sopralluogo con i cittadini', { cost: { ap: 1 }, effects: { stats: { popularity: 1.5 }, relations: { civic: 2, business: 2 } } }),
    c('nota', 'Mandi una nota agli uffici', { effects: { relations: { civic: 0.5 } } }),
    c('ignora', 'Ignora', { effects: { relations: { civic: -1 } } })] }),
  d('ambulanti-protesta', 'territorio', { cooldown: 12, when: sit => sit.role.local, days: [1, 2, 3], title: 'Gli ambulanti protestano', body: 'Il nuovo regolamento sui mercati non convince: i banchi restano chiusi e il centro si riempie di cartelli.', defaultChoice: 'ascolta', choices: [
    c('incontra', 'Incontrali in piazza', { cost: { ap: 1 }, effects: { relations: { business: 4 }, stats: { popularity: 1 } } }),
    c('ascolta', 'Mandi un assessore', { effects: { relations: { business: 1 } } }),
    c('tira-dritto', 'Tiri dritto', { effects: { relations: { business: -3 }, stats: { popularity: -1 } } })] }),
  d('bando-scadenza', 'opportunita', { positive: true, weight: 1.4, cooldown: 14, when: sit => sit.role.local || sit.role.regional || sit.seat, title: 'Un bando in scadenza per {region}', body: 'Una misura finanzia progetti locali: basta una proposta credibile prima che si chiudano i termini.', defaultChoice: 'lascia', choices: [
    c('presenta', 'Metti in piedi la candidatura del territorio', { cost: { ap: 1, funds: 200 }, effects: { stats: { reputation: 1, popularity: 1 } }, outcomes: [
      { chance: 0.4, label: 'Il progetto viene finanziato', effects: { funds: 800, stats: { popularity: 2 }, relations: { civic: 4 } } },
      { chance: 0.6, label: 'Resta fuori per pochi punti: ma si impara', effects: { stats: { experience: 1 } } }] }),
    c('lascia', 'Lasci scadere', {})] }),
  d('pronto-soccorso', 'sociale', { cooldown: 14, when: sit => sit.role.local || sit.role.regional || sit.seat, title: 'Il pronto soccorso è in affanno', body: 'Attese di dodici ore e barelle nei corridoi: i cittadini chiedono risposte, il personale chiede rinforzi.', defaultChoice: 'comunicato', choices: [
    c('visita', 'Vai in ospedale a sentire il personale', { cost: { ap: 1 }, effects: { stats: { popularity: 2, reputation: 1 }, relations: { civic: 3 } } }),
    c('comunicato', 'Rilasci un comunicato', { effects: { stats: { notoriety: 0.5 } } }),
    c('ignora', 'Non intervieni', { effects: { stats: { popularity: -1 } } })] }),
  d('allerta-meteo', 'emergenza', { light: true, weight: 1.6, cooldown: 12, boost: sit => sit.signals.autumn || sit.signals.winter ? 2 : 0.4, when: sit => sit.role.local || sit.role.regional, title: 'Allerta meteo a {region}', body: 'Il bollettino è rosso: scuole chiuse, volontari in strada e qualche zona a rischio.', defaultChoice: 'comunicato', choices: [
    c('presidio', 'Vai al centro operativo', { cost: { ap: 1 }, effects: { stats: { reputation: 1.5, popularity: 1 }, relations: { civic: 2 } } }),
    c('comunicato', 'Segui da remoto', { effects: {} })] }),
  d('sagra-estate', 'territorio', { light: true, positive: true, weight: 1.8, cooldown: 6, boost: sit => sit.signals.summer ? 3 : 0, when: sit => sit.signals.summer, days: WEEKEND, title: 'Sagra del paese', body: 'Tavolate, musica e mezza provincia in piazza: un buon posto per farsi vedere senza parlare di politica.', defaultChoice: 'passa', choices: [
    c('partecipa', 'Passa la serata con i cittadini', { cost: { ap: 1 }, effects: { stats: { popularity: 2 }, relations: { civic: 2 } } }),
    c('passa', 'Una comparsata veloce', { effects: { stats: { popularity: 0.5 } } })] }),
  d('riapertura-scuole', 'territorio', { light: true, cooldown: 30, boost: sit => sit.signals.autumn ? 2.5 : 0, when: sit => sit.signals.autumn, days: [0, 1], title: 'Riaprono le scuole', body: 'Il primo giorno di scuola porta con sé trasporti in ritardo, mense da organizzare e classi senza insegnanti.', defaultChoice: 'passa', choices: [
    c('visita', 'Accompagna il primo giorno in una scuola', { cost: { ap: 1 }, effects: { stats: { popularity: 1.5, reputation: 0.5 }, relations: { civic: 2 } } }),
    c('passa', 'Segui dai giornali', {})] }),
  d('sciopero-trasporti', 'territorio', { cooldown: 14, title: 'Sciopero dei trasporti', body: 'Treni e autobus fermi per un giorno: pendolari furiosi e sindacati che chiedono ascolto.', defaultChoice: 'comunicato', choices: [
    c('mediazione', 'Offri un tavolo tra azienda e sindacati', { cost: { ap: 1 }, effects: { relations: { unions: 4, business: 1 }, stats: { reputation: 1 } } }),
    c('comunicato', 'Esprimi solidarietà ai pendolari', { effects: { stats: { popularity: 0.5 } } }),
    c('ignora', 'Nessun commento', {})] }),
  d('comitato-parco', 'territorio', { light: true, cooldown: 14, title: 'Un comitato difende il parco', body: 'Un gruppo di cittadini si oppone a un progetto che toglierebbe verde al quartiere: chiedono almeno di essere ascoltati.', defaultChoice: 'ascolta', choices: [
    c('incontra', 'Incontra il comitato', { cost: { ap: 1 }, effects: { relations: { civic: 4 }, stats: { popularity: 1 } } }),
    c('ascolta', 'Raccogli il dossier e rispondi per iscritto', { effects: { relations: { civic: 1 } } }),
    c('ignora', 'Ignora', { effects: { relations: { civic: -2 } } })] }),
  d('lettera-sindaci', 'territorio', { cooldown: 16, when: sit => sit.party, title: 'Lettera dei sindaci del territorio', body: 'Dieci sindaci, di colori diversi, firmano un appello su trasporti e sanità: chiedono a chi ha un ruolo di farsene portavoce.', defaultChoice: 'tace', choices: [
    c('firma', 'Sostieni l’appello', { cost: { ap: 1 }, effects: { stats: { popularity: 1.5, reputation: 1 }, relations: { civic: 3 }, org: { cohesion: -0.5 } } }),
    c('tace', 'Non firmi', {})] }),

  // ---------- media ----------
  d('intervista-scomoda', 'media', { cooldown: 12, when: sit => sit.stats.notoriety >= 20, title: 'Un giornalista chiede un’intervista scomoda', body: 'Domande dirette su un caso che non vorresti commentare: rifiutare si nota, accettare è un rischio.', defaultChoice: 'declina', choices: [
    c('accetta', 'Accetta e rispondi a tutto', { cost: { ap: 1 }, effects: { stats: { notoriety: 2.5 } }, followUp: { id: 'intervista-eco', weeks: 3, chance: 0.6 }, outcomes: [
      { chance: 0.6, label: 'Ne esci meglio del previsto', effects: { stats: { reputation: 1.5 } } },
      { chance: 0.4, label: 'Un passaggio finisce nei titoli per il verso sbagliato', effects: { stats: { reputation: -2 } } }] }),
    c('scritto', 'Rispondi solo per iscritto', { effects: { stats: { notoriety: 0.5 } } }),
    c('declina', 'Declina', { effects: { stats: { notoriety: -0.3 } } })] }),
  d('post-virale', 'media', { cooldown: 12, weight: 1.6, title: 'Un tuo post diventa virale', body: 'Una frase scritta di getto raccoglie migliaia di condivisioni: metà applaude, metà si arrabbia.', defaultChoice: 'lascia', choices: [
    c('rilancia', 'Rilancia con un video', { cost: { ap: 1 }, effects: { stats: { notoriety: 3 }, relations: { media: 2 } }, risk: { chance: 0.3, label: 'Il video riapre la polemica', effects: { stats: { reputation: -2 } } }, followUp: { id: 'polemica-social', weeks: 2, chance: 0.5 } }),
    c('precisa', 'Precisa il tuo pensiero', { effects: { stats: { reputation: 0.8, notoriety: 1 } } }),
    c('lascia', 'Lascia che si spenga', { effects: { stats: { notoriety: 0.5 } } })] }),
  d('podcast-ospite', 'opportunita', { light: true, positive: true, weight: 1.4, cooldown: 14, days: [2, 3, 4], title: 'Ospite di un podcast', body: 'Un programma seguito dai giovani ti invita per un’ora di conversazione senza slogan.', defaultChoice: 'declina', choices: [
    c('accetta', 'Accetta', { cost: { ap: 1 }, effects: { stats: { notoriety: 2, popularity: 1 }, relations: { media: 2 } } }),
    c('declina', 'Declina', {})] }),
  d('fake-news', 'media', { category: 'scandalo', cooldown: 24, weight: 1.2, when: sit => sit.stats.notoriety >= 25, title: 'Circola una notizia falsa su di te', body: 'Una pagina anonima ti attribuisce una frase che non hai mai detto: in poche ore è ovunque.', defaultChoice: 'ignora', choices: [
    c('smentisci', 'Smentisci con i fatti', { cost: { ap: 1 }, effects: { stats: { reputation: 0.5, notoriety: 1 } }, outcomes: [
      { chance: 0.7, label: 'La smentita ferma la catena', effects: { stats: { reputation: 1 } } },
      { chance: 0.3, label: 'La smentita rilancia la notizia', effects: { stats: { reputation: -1 } } }] }),
    c('querela', 'Annuncia una querela', { cost: { funds: 300 }, effects: { stats: { notoriety: 1 } } }),
    c('ignora', 'Ignora', { effects: { stats: { reputation: -1 } } })] }),
  d('dibattito-tv-locale', 'media', { light: true, cooldown: 10, when: sit => sit.party, days: [1, 3], title: 'Dibattito su una TV locale', body: 'Quaranta minuti di confronto con altri politici della zona: una vetrina breve ma letta.', defaultChoice: 'declina', choices: [
    c('partecipa', 'Partecipa', { cost: { ap: 1 }, effects: { stats: { notoriety: 1.5, popularity: 1 }, relations: { media: 2 } } }),
    c('declina', 'Declina', { effects: { relations: { media: -0.5 } } })] }),
  d('editoriale-favorevole', 'media', { positive: true, rare: true, weight: 1, cooldown: 40, title: 'Un editoriale ti elogia', body: 'Un editorialista autorevole sceglie te come esempio di serietà: non capita spesso.', defaultChoice: 'ringrazia', choices: [
    c('ringrazia', 'Ringrazia pubblicamente', { effects: { stats: { reputation: 2.5, notoriety: 1.5 }, relations: { media: 3 } } }),
    c('modesto', 'Resta in silenzio', { effects: { stats: { reputation: 1.5 } } })] }),

  // ---------- economy and society ----------
  d('esuberi-fabbrica', 'economia', { cooldown: 16, title: 'Una fabbrica annuncia esuberi', body: 'Duecento posti a rischio nella zona: i lavoratori presidiano i cancelli e chiedono un tavolo con le istituzioni.', defaultChoice: 'comunicato', choices: [
    c('presidio', 'Vai al presidio', { cost: { ap: 1 }, effects: { relations: { unions: 5 }, stats: { popularity: 1.5 } } }),
    c('tavolo', 'Chiedi un tavolo istituzionale', { cost: { capital: 1 }, effects: { relations: { unions: 3, business: 2 }, stats: { reputation: 1 } }, followUp: { id: 'tavolo-esito', weeks: 5, chance: 0.7 } }),
    c('comunicato', 'Esprimi vicinanza ai lavoratori', { effects: { stats: { popularity: 0.5 } } })] }),
  d('tavolo-esito', 'economia', { weight: 0, cooldown: 8, title: 'Il tavolo sulla fabbrica: l’esito', body: 'Dopo settimane di incontri l’azienda mette sul tavolo una proposta: meno esuberi, ma con condizioni dure.', defaultChoice: 'accetta', choices: [
    c('accetta', 'Sostieni l’intesa', { effects: { relations: { unions: 1, business: 3 }, stats: { reputation: 1 } } }),
    c('rifiuta', 'Chiedi altre garanzie', { effects: { relations: { unions: 3, business: -2 } } })] }),
  d('bollette-rabbia', 'economia', { cooldown: 16, boost: sit => sit.signals.winter ? 2 : 0.8, title: 'Bollette: la rabbia dei cittadini', body: 'Le nuove tariffe arrivano a casa e il malumore si sente nei bar e nei mercati.', defaultChoice: 'silenzio', choices: [
    c('proposta', 'Proponi un aiuto per le famiglie', { cost: { ap: 1, capital: 1 }, effects: { stats: { popularity: 2, reputation: 1 } } }),
    c('attacca', 'Dai la colpa a chi governa', { effects: { stats: { notoriety: 1.5 } } }),
    c('silenzio', 'Non commentare', { effects: { stats: { popularity: -0.5 } } })] }),
  d('startup-premio', 'opportunita', { light: true, positive: true, weight: 1.4, cooldown: 18, title: 'Un premio a una startup del territorio', body: 'Una giovane azienda della zona vince un premio internazionale e invita le istituzioni alla cerimonia.', defaultChoice: 'saluta', choices: [
    c('partecipa', 'Vai alla cerimonia', { cost: { ap: 1 }, effects: { stats: { popularity: 1, reputation: 1 }, relations: { business: 3 } } }),
    c('saluta', 'Mandi un messaggio di congratulazioni', { effects: { relations: { business: 0.5 } } })] }),
  d('assemblea-sindacale', 'sociale', { light: true, cooldown: 14, days: [2, 3], title: 'Assemblea sindacale aperta', body: 'I sindacati invitano i politici della zona a sentire i lavoratori, senza microfoni e senza slogan.', defaultChoice: 'declina', choices: [
    c('partecipa', 'Ascolta in silenzio', { cost: { ap: 1 }, effects: { relations: { unions: 4 }, stats: { reputation: 1 } } }),
    c('declina', 'Declina', { effects: { relations: { unions: -0.5 } } })] }),
  d('affitti-studenti', 'sociale', { cooldown: 18, title: 'Il caro affitti per gli studenti', body: 'Una rete di universitari occupa un’aula per chiedere alloggi accessibili: un tema che sale nelle chat dei giovani.', defaultChoice: 'tace', choices: [
    c('proposta', 'Presenta una proposta sugli alloggi', { cost: { ap: 1 }, effects: { stats: { popularity: 1.5, experience: 0.5 }, relations: { civic: 2 } } }),
    c('visita', 'Vai a parlare con gli studenti', { cost: { ap: 1 }, effects: { stats: { popularity: 1 } } }),
    c('tace', 'Non intervieni', {})] }),
  d('trattori-in-piazza', 'economia', { cooldown: 18, when: sit => sit.south || sit.role.regional || sit.role.local, title: 'I trattori in piazza', body: 'Gli agricoltori sfilano contro costi e burocrazia: il corteo attraversa il centro e blocca il traffico.', defaultChoice: 'comunicato', choices: [
    c('incontra', 'Incontra una delegazione', { cost: { ap: 1 }, effects: { relations: { business: 3, civic: 1 }, stats: { popularity: 1 } } }),
    c('comunicato', 'Esprimi comprensione', { effects: { stats: { popularity: 0.3 } } }),
    c('ignora', 'Resti fuori dalla polemica', {})] }),

  // ---------- relations ----------
  d('vecchio-compagno', 'relazioni', { light: true, cooldown: 14, title: 'Un vecchio compagno di partito ti cerca', body: 'Qualcuno con cui hai condiviso le prime battaglie vuole raccontarti come si vede il partito dal basso.', defaultChoice: 'rimanda', choices: [
    c('incontra', 'Prendi un caffè', { cost: { ap: 1 }, effects: { party: { support: 1.5 }, relations: { leadership: 1 } } }),
    c('rimanda', 'Rimandi', { effects: { party: { support: -0.3 } } })] }),
  d('caffe-avversario', 'relazioni', { cooldown: 14, when: sit => sit.seat || sit.role.local, title: 'Un caffè con un avversario', body: 'Un collega di un altro schieramento ti propone un caffè, senza telecamere: per parlare di una legge su cui forse ci si può capire.', defaultChoice: 'declina', choices: [
    c('accetta', 'Accetta il caffè', { cost: { ap: 1 }, effects: { groups: { coalition: 2 }, stats: { experience: 0.5 } }, risk: { chance: 0.2, label: 'Qualcuno li vede insieme e commenta', effects: { party: { support: -1.5 } } } }),
    c('declina', 'Declina', { effects: {} })] }),
  d('mentore-consiglio', 'relazioni', { light: true, positive: true, weight: 1.2, cooldown: 24, title: 'Un ex dirigente ti dà un consiglio', body: 'Un politico che ha visto passare quattro segretari ti prende da parte: «Ti dico cosa farei io, poi fai come credi».', defaultChoice: 'ascolta', choices: [
    c('ascolta', 'Ascolta e prendi appunti', { cost: { ap: 1 }, effects: { stats: { experience: 2, reputation: 0.5 } } }),
    c('saluta', 'Ringrazia e vai', {})] }),
  d('tempo-famiglia', 'relazioni', { light: true, positive: true, weight: 1.2, cooldown: 12, days: WEEKEND, title: 'Un fine settimana lontano dai telefoni', body: 'Famiglia, amici e nessuna dichiarazione: la politica può aspettare un giorno.', defaultChoice: 'riposa', choices: [
    c('riposa', 'Spegni tutto', { effects: { stats: { reputation: 0.5 }, capital: 1 } }),
    c('lavora', 'Lavora comunque', { cost: { ap: 1 }, effects: { stats: { experience: 0.5 }, party: { support: 0.3 } } })] }),

  // ---------- candidacies and elections ----------
  d('sondaggio-riservato', 'elezioni', { cooldown: 20, when: sit => sit.signals.electionSoon, title: 'Un sondaggio riservato sul tuo nome', body: 'Un istituto propone una rilevazione su misura per capire dove sei forte e dove no.', defaultChoice: 'rifiuta', choices: [
    c('commissiona', 'Commissionalo', { cost: { funds: 500 }, effects: { prep: 5, stats: { experience: 0.5 } } }),
    c('rifiuta', 'Rifiuti: servono altri soldi', {})] }),
  d('concorrente-interno', 'elezioni', { cooldown: 16, when: sit => sit.member && sit.signals.electionSoon, title: 'Un concorrente interno annuncia la candidatura', body: 'Qualcuno del partito punta allo stesso posto: lo dice a una radio, prima di dirlo a te.', defaultChoice: 'ignora', choices: [
    c('incontra', 'Cerca un’intesa', { cost: { capital: 1 }, effects: { relations: { rival: 4 }, party: { support: 1 } } }),
    c('sfida', 'Rilancia la tua candidatura in pubblico', { effects: { stats: { notoriety: 1.5 }, relations: { rival: -4 }, party: { support: 0.5 } } }),
    c('ignora', 'Ignora', { effects: { party: { support: -0.5 } } })] }),
  d('volontari-bussano', 'elezioni', { light: true, positive: true, weight: 1.6, cooldown: 8, when: sit => sit.campaignActive, days: [4, 5, 6], title: 'Volontari che bussano alle porte', body: 'Un gruppo di ragazzi gira i quartieri con i volantini: chiedono chi li guida.', defaultChoice: 'passa', choices: [
    c('guida', 'Fai il giro con loro', { cost: { ap: 1 }, effects: { stats: { popularity: 2 }, prep: 3 } }),
    c('passa', 'Mandi un saluto', { effects: { prep: 1 } })] }),
  d('endorsement', 'opportunita', { positive: true, rare: true, weight: 1, cooldown: 40, when: sit => sit.stats.notoriety >= 20, title: 'Una personalità ti appoggia', body: 'Un nome molto noto del territorio dichiara che voterà per te: le agenzie la riprendono subito.', defaultChoice: 'ringrazia', choices: [
    c('ringrazia', 'Ringrazia e usalo in campagna', { effects: { stats: { popularity: 3, notoriety: 2 }, prep: 4 } }),
    c('sobrio', 'Ringrazia con sobrietà', { effects: { stats: { popularity: 2, reputation: 1 } } })] }),
  d('appello-al-voto', 'elezioni', { light: true, cooldown: 20, when: sit => sit.signals.electionSoon, days: [4, 5, 6], title: 'Appello al voto', body: 'Le associazioni chiedono ai politici di spiegare in modo semplice perché andare a votare.', defaultChoice: 'firma', choices: [
    c('video', 'Registra un breve video', { cost: { ap: 1 }, effects: { stats: { notoriety: 1, reputation: 1 } } }),
    c('firma', 'Firmi l’appello', { effects: { stats: { reputation: 0.3 } } })] }),

  // ---------- alliances and rivalries ----------
  d('alleato-lealta', 'relazioni', { cooldown: 16, when: sit => sit.seat || sit.secretary, title: 'Un alleato ti chiede lealtà', body: 'Prima di un voto delicato un collega di un gruppo vicino ti chiede un impegno: «Se tu mi aiuti ora, io ricordo».', defaultChoice: 'declina', choices: [
    c('promette', 'Prometti il tuo sostegno', { cost: { capital: 1 }, effects: { groups: { coalition: 3 } }, later: { weeks: 6, chance: 0.4, hint: 'L’alleato potrebbe chiederti di mantenere', label: 'L’alleato presenta il conto', effects: { stats: { influence: -0.5 }, groups: { coalition: 1 } } } }),
    c('declina', 'Non prendi impegni', { effects: { groups: { coalition: -1 } } })] }),
  d('tavolo-coalizione', 'relazioni', { cooldown: 18, when: sit => sit.secretary, days: [1, 2], title: 'Tavolo di coalizione', body: 'I leader delle forze vicine si vedono per un’intesa elettorale: servono pazienza, numeri e un po’ di rinunce.', defaultChoice: 'delega', choices: [
    c('partecipa', 'Partecipa in prima persona', { cost: { ap: 1, capital: 1 }, effects: { stats: { influence: 1 }, groups: { coalition: 2 }, org: { cohesion: -1 } } }),
    c('delega', 'Mandi un delegato', { effects: { groups: { coalition: 0.5 } } })] }),
  d('civiche-intesa-locale', 'territorio', { cooldown: 18, when: sit => sit.role.local || sit.role.regional, title: 'Le civiche cercano un’intesa locale', body: 'Due liste del territorio vogliono correre insieme e chiedono un interlocutore con un po’ di peso.', defaultChoice: 'tempo', choices: [
    c('media', 'Fai da mediatore', { cost: { ap: 1 }, effects: { relations: { civic: 4 }, stats: { reputation: 1 } } }),
    c('tempo', 'Lascia che facciano da soli', {})] }),

  // ---------- opportunities and problems ----------
  d('invito-festival', 'opportunita', { light: true, positive: true, weight: 1.3, cooldown: 14, days: [4, 5], title: 'Invito a un festival politico', body: 'Un festival di idee chiede un tuo intervento: tre quarti d’ora su un tema a tua scelta.', defaultChoice: 'declina', choices: [
    c('partecipa', 'Intervieni', { cost: { ap: 1 }, effects: { stats: { notoriety: 1.8, reputation: 1 } } }),
    c('declina', 'Declina', {})] }),
  d('imprevisto-agenda', 'risorse', { light: true, weight: 1.2, cooldown: 8, title: 'Un imprevisto sconvolge l’agenda', body: 'Salta un impegno e se ne sovrappongono due: bisogna scegliere dove andare.', defaultChoice: 'delega', choices: [
    c('tutti', 'Vai a tutti e due, di corsa', { cost: { ap: 1 }, effects: { stats: { reputation: 0.3 } } }),
    c('delega', 'Delega uno dei due', { effects: { stats: { popularity: -0.3 } } })] }),
  d('caso-boomerang', 'scandalo', { cooldown: 26, weight: 1.2, when: sit => sit.stats.notoriety >= 25, title: 'Una vecchia frase torna a galla', body: 'Un post di anni fa riemerge e ti viene rinfacciato: ti serve una risposta prima della sera.', defaultChoice: 'silenzio', choices: [
    c('scuse', 'Chiedi scusa subito', { effects: { stats: { reputation: -0.5 } }, followUp: { id: 'recupero-reputazione', weeks: 4, chance: 0.8 } }),
    c('contestualizza', 'Spiega il contesto', { effects: { stats: { reputation: -1, notoriety: 1 } }, outcomes: [
      { chance: 0.5, label: 'La spiegazione regge', effects: { stats: { reputation: 1 } } },
      { chance: 0.5, label: 'La toppa è peggio del buco', effects: { stats: { reputation: -2 } } }] }),
    c('silenzio', 'Resta in silenzio', { effects: { stats: { reputation: -2 } } })] }),
  d('recupero-reputazione', 'memoria', { weight: 0, positive: true, cooldown: 12, title: 'La polemica si sgonfia', body: 'Le scuse sono state apprezzate: qualcuno scrive anche che «ammettere un errore è raro, in politica».', defaultChoice: 'ringrazia', choices: [
    c('ringrazia', 'Non rilanciare e lavorare', { effects: { stats: { reputation: 2 } } }),
    c('capitalizza', 'Usa l’occasione per un messaggio', { cost: { ap: 1 }, effects: { stats: { reputation: 1.5, notoriety: 1.5 } } })] }),
  d('premio-civico', 'opportunita', { positive: true, rare: true, weight: 1, cooldown: 50, title: 'Un premio civico', body: 'Un’associazione ti assegna un riconoscimento per l’impegno sul territorio: un gesto semplice che arriva al momento giusto.', defaultChoice: 'ritira', choices: [
    c('ritira', 'Ritiralo con un discorso', { cost: { ap: 1 }, effects: { stats: { reputation: 3, popularity: 2 }, relations: { civic: 4 } } }),
    c('dedica', 'Dedicalo ai volontari', { effects: { stats: { reputation: 2 }, org: { militants: 0.02 } } })] }),

  // ---------- the other end of the chains ----------
  d('polemica-social', 'media', { weight: 0, cooldown: 6, title: 'La polemica sul tuo video cresce', body: 'Il video ha superato il tuo giro: ora lo commentano in televisione e qualcuno chiede un chiarimento ufficiale.', defaultChoice: 'ignora', choices: [
    c('chiarisci', 'Chiarisci con un comunicato', { effects: { stats: { reputation: 0.5, notoriety: 1 } } }),
    c('ironizza', 'Rispondi con ironia', { effects: { stats: { notoriety: 2, reputation: -0.5 } }, risk: { chance: 0.3, label: 'L’ironia non viene capita', effects: { stats: { reputation: -2 } } } }),
    c('ignora', 'Lasci spegnere la polemica', { effects: { stats: { notoriety: -0.5 } } })] }),
  d('circolo-riapre', 'partito', { weight: 0, positive: true, cooldown: 12, title: 'Il circolo salvato riapre in festa', body: 'Con i fondi raccolti il circolo ha ripreso le attività: i militanti ti invitano a tagliare il nastro.', defaultChoice: 'saluta', choices: [
    c('partecipa', 'Taglia il nastro', { cost: { ap: 1 }, effects: { org: { militants: 0.03, cohesion: 3 }, party: { support: 2 } } }),
    c('saluta', 'Mandi un messaggio', { effects: { org: { cohesion: 1 } } })] }),
  d('intervista-eco', 'media', { weight: 0, cooldown: 8, title: 'L’eco dell’intervista', body: 'Un passaggio dell’intervista viene ripreso in rete: lo citano sia i tuoi sostenitori sia i tuoi critici.', defaultChoice: 'lascia', choices: [
    c('rilancia', 'Rilancia il passaggio', { cost: { ap: 1 }, effects: { stats: { notoriety: 2 } }, risk: { chance: 0.25, label: 'Il passaggio viene estrapolato dal contesto', effects: { stats: { reputation: -1.5 } } } }),
    c('lascia', 'Lascia stare', { effects: { stats: { notoriety: 0.5 } } })] }),
  d('civico-in-lista', 'elezioni', { weight: 0, cooldown: 10, title: 'Il civico in lista chiede visibilità', body: 'Il professionista che hai accolto porta voti ma pretende spazio negli eventi e nei manifesti: qualcuno nel partito storce il naso.', defaultChoice: 'accontenta', choices: [
    c('accontenta', 'Dagli spazio nei prossimi eventi', { cost: { ap: 1 }, effects: { prep: 3, relations: { civic: 2 }, party: { support: -0.5 } } }),
    c('limita', 'Chiedi sobrietà', { effects: { relations: { civic: -2 }, party: { support: 0.5 } } })] }),

  // ---------- quiet days and seasons ----------
  d('giornata-tranquilla', 'quiete', { light: true, weight: 2.4, cooldown: 5, boost: sit => sit.signals.stability >= 55 && !sit.campaignActive ? 1.6 : 0.5, days: [0, 1, 2, 3, 4, 5, 6], title: 'Una giornata senza emergenze', body: 'Nessuna crisi, nessuna telecamera: come impiegare il tempo?', defaultChoice: 'studio', choices: [
    c('studio', 'Studia un dossier', { cost: { ap: 1 }, effects: { stats: { experience: 1.2, reputation: 0.3 } } }),
    c('elettori', 'Incontra elettori e associazioni', { cost: { ap: 1 }, effects: { stats: { popularity: 1.3 }, relations: { civic: 1.5 } } }),
    c('rete', 'Cura la rete di contatti', { cost: { ap: 1 }, effects: { stats: { influence: 0.8 }, relations: { leadership: 1 } } }),
    c('riposo', 'Prenditi una pausa', { effects: { stats: { reputation: 0.2 } } })] }),
  d('lettera-elettore', 'quiete', { light: true, weight: 1.8, cooldown: 8, title: 'La lettera di un elettore', body: 'Una persona qualunque ti scrive di un problema del suo quartiere, con un tono più stanco che arrabbiato.', defaultChoice: 'archivia', choices: [
    c('rispondi', 'Rispondi di persona', { cost: { ap: 1 }, effects: { stats: { popularity: 1, reputation: 0.5 }, relations: { civic: 1 } } }),
    c('archivia', 'Fai rispondere dalla segreteria', { effects: { stats: { popularity: 0.2 } } })] }),
  d('pausa-estiva', 'quiete', { light: true, weight: 1.5, cooldown: 40, boost: sit => sit.signals.summer ? 3 : 0, when: sit => sit.signals.summer, days: WEEKEND, title: 'Pausa estiva: scuole e feste di partito', body: 'D’estate la politica si sposta nelle piazze e nelle feste: si parla meno di strategie e più di persone.', defaultChoice: 'festa', choices: [
    c('festa', 'Gira le feste del territorio', { cost: { ap: 1 }, effects: { stats: { popularity: 1.5 }, party: { support: 1 }, org: { militants: 0.01 } } }),
    c('riposo', 'Stacca qualche giorno', {})] }),
  d('rientro-autunno', 'quiete', { light: true, weight: 1.5, cooldown: 40, boost: sit => sit.signals.autumn ? 3 : 0, when: sit => sit.signals.autumn, days: [0, 1], title: 'Il rientro: la politica riparte', body: 'Dopo la pausa tornano i dossier, i conti da fare e le liste di cose lasciate in sospeso.', defaultChoice: 'agenda', choices: [
    c('agenda', 'Metti ordine nell’agenda dei prossimi mesi', { cost: { ap: 1 }, effects: { stats: { experience: 0.8, influence: 0.5 } } }),
    c('slancio', 'Rilancia subito con un’iniziativa', { cost: { ap: 1 }, effects: { stats: { notoriety: 1.2 } } })] }),
  d('feste-fine-anno', 'quiete', { light: true, positive: true, weight: 1.5, cooldown: 40, boost: sit => sit.signals.winter ? 3 : 0, when: sit => sit.signals.winter, days: WEEKEND, title: 'Gli auguri di fine anno', body: 'Biglietti, brindisi e bilanci dell’anno: una tradizione che nel partito pesa più di quanto sembri.', defaultChoice: 'brindisi', choices: [
    c('brindisi', 'Partecipa al brindisi del partito', { cost: { ap: 1 }, effects: { org: { cohesion: 2 }, party: { support: 1 } } }),
    c('biglietti', 'Mandi solo gli auguri', {})] })
]);
export const DAILY_EVENT_IDS = Object.freeze(DAILY_EVENTS.map(item => item.id));
