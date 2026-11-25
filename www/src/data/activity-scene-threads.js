// The THREAD of a conversation in the activity scenes: what keeps a question, the answer and the reply on the same subject. Without it the reaction to an answer was a comment on the KIND of move
// (data/activity-scene-moves.js REACTION_LINES) and the later questions were the same for every topic. Here, for the subject of the encounter (the topic of the scene, `{}` = its label, a pair of the
// phrase-book), the guest who listened:
//   · FOLLOW: answers what the player just said, by the kind of answer (an inquiry, a commitment, a mediation, a clash) and how it went (good, mid, bad) — the reply is about THAT answer on THAT topic;
//   · BRIDGE: the second guest takes the floor on the same subject, saying how the first answer landed, before the next question;
//   · DECIDE (q3) and GUARANTEE (q4): the decision and the guarantees asked on the subject, not in general;
//   · ROLE: one line before the first question that addresses the player for what they are (who governs, who opposes, who holds no office): what is asked fits the office of the player.
// Every list has the same length (THREAD_SIZE): the engine picks the variant met least recently in the career (activity-scenes.js freshIndex), so close scenes do not repeat the same words.
// Texts are pairs [Italian, English]; `{}` in Italian is `{1}` in English. Nothing here decides a result.
const P = (it, en) => [it, en];
export const THREAD_SIZE = 5;
// the kinds of answer, by the function of the move
export const FN_GROUP = Object.freeze({ listen: 'ascolto', probe: 'ascolto', data: 'ascolto', verify: 'ascolto', story: 'ascolto', propose: 'impegno', announce: 'impegno', fund: 'impegno', assign: 'impegno', appoint: 'impegno', involve: 'impegno', table: 'impegno', priority: 'impegno', mediate: 'mediazione', compromise: 'mediazione', vote: 'mediazione', contest: 'scontro', clarify: 'scontro', own: 'scontro' });

export const FOLLOW = Object.freeze({
  ascolto: {
    good: [P('Su «{}» è la prima volta che qualcuno ci chiede i numeri prima delle promesse: glieli mando entro domani.', 'On “{1}” it is the first time anyone has asked us for the figures before the promises: I will send them to you by tomorrow.'),
      P('Ascoltare serve, ma su «{}» adesso sa quanto è grave: la prossima volta mi aspetto una proposta.', 'Listening helps, but on “{1}” you now know how serious it is: next time I expect a proposal.'),
      P('Ha fatto le domande giuste su «{}»: le segnalo anche chi se ne occupa negli uffici, parli con loro.', 'You asked the right questions on “{1}”: I will also tell you who handles it in the offices, talk to them.'),
      P("Su «{}» ha capito il punto: adesso le chiedo di non perderlo di vista.", "On “{1}” you got the point: now I ask you not to lose sight of it."),
      P("Su «{}» queste domande le facevano in pochi: ci risentiamo con i dati aggiornati.", "On “{1}” few people asked these questions: let us talk again with the updated figures.")],
    mid: [P('Su «{}» ci ha ascoltato, d’accordo, ma ascoltare è la parte facile.', 'On “{1}” you listened to us, fine, but listening is the easy part.'),
      P('Le domande vanno bene, ma su «{}» noi i dati li abbiamo già consegnati due volte.', 'The questions are fine, but on “{1}” we have already handed over the data twice.'),
      P('Prende appunti su «{}»: vedremo se diventano qualcosa.', 'You are taking notes on “{1}”: we will see whether they turn into something.'),
      P("Su «{}» la conosce meglio di prima, ma noi aspettiamo ancora una risposta.", "On “{1}” you know it better than before, but we are still waiting for an answer."),
      P("Approfondire su «{}» va bene, purché non diventi l’ennesima relazione in un cassetto.", "Looking deeper into “{1}” is fine, as long as it does not become yet another report in a drawer.")],
    bad: [P('Ancora domande su «{}», quando sono anni che rispondiamo: adesso tocca a voi.', 'More questions on “{1}”, when we have been answering for years: now it is your turn.'),
      P('Su «{}» chiedere altri dati sembra un modo per prendere tempo.', 'On “{1}” asking for more data looks like a way to buy time.'),
      P('Con tutto il rispetto, su «{}» non serviva un’altra indagine: serviva una decisione.', 'With all due respect, on “{1}” we did not need another inquiry: we needed a decision.'),
      P("Su «{}» la situazione la conoscono tutti, tranne a quanto pare chi deve decidere.", "On “{1}” everyone knows the situation, except apparently those who must decide."),
      P("Su «{}» un’altra raccolta di dati la paghiamo noi, in tempo perso.", "On “{1}” we pay for another round of data, in lost time.")]
  },
  impegno: {
    good: [P('Allora su «{}» ci conto: mi segno la data e torno a chiederglielo.', 'Then on “{1}” I am counting on you: I am writing down the date and I will come back to ask.'),
      P('È la risposta che aspettavamo su «{}»: chi segue la cosa, da domani?', 'That is the answer we were waiting for on “{1}”: who follows it up, from tomorrow?'),
      P('Su «{}» un impegno così lo possiamo raccontare a chi ci ha mandato qui.', 'On “{1}” a commitment like that is something we can report to the people who sent us here.'),
      P("Su «{}» finalmente una cosa precisa: la racconterò alla prossima riunione.", "On “{1}” finally something precise: I will report it at the next meeting."),
      P("Se su «{}» va come dice, la ringrazieremo pubblicamente, e se no lo diremo lo stesso.", "If on “{1}” it goes as you say, we will thank you publicly, and if not we will say so anyway.")],
    mid: [P('Su «{}» l’impegno c’è, ma senza una data è un’intenzione.', 'On “{1}” the commitment is there, but without a date it is an intention.'),
      P('La proposta su «{}» va bene, ma con quali soldi?', 'The proposal on “{1}” is fine, but with what money?'),
      P('Su «{}» ci ha dato una direzione; i passaggi concreti li vogliamo vedere per iscritto.', 'On “{1}” you gave us a direction; we want to see the concrete steps in writing.'),
      P("Su «{}» l’idea è buona, ma chi la porta avanti negli uffici?", "On “{1}” the idea is good, but who carries it forward in the offices?"),
      P("Su «{}» ci ha detto che cosa, adesso ci dica quando e con chi.", "On “{1}” you told us what, now tell us when and with whom.")],
    bad: [P('Su «{}» questa promessa l’abbiamo già sentita: l’ultima volta non è successo niente.', 'On “{1}” we have heard this promise before: last time nothing happened.'),
      P('Un annuncio su «{}» non basta: chi lo paga e chi lo firma?', 'An announcement on “{1}” is not enough: who pays for it and who signs it?'),
      P('Su «{}» promettere è facile: ci dica che cosa succede lunedì mattina.', 'On “{1}” promising is easy: tell us what happens on Monday morning.'),
      P("Su «{}» ogni anno arriva un annuncio e ogni anno resta tutto com’è.", "On “{1}” every year an announcement comes and every year everything stays as it is."),
      P("Su «{}» un impegno senza copertura è solo un titolo di giornale.", "On “{1}” a commitment with no funding is just a headline.")]
  },
  mediazione: {
    good: [P('Su «{}» mettere tutti allo stesso tavolo è già un passo: noi ci saremo.', 'On “{1}” getting everyone round the same table is already a step: we will be there.'),
      P('Il compromesso su «{}» non accontenta nessuno del tutto, ma lo possiamo sostenere.', 'The compromise on “{1}” does not fully satisfy anyone, but we can support it.'),
      P('Su «{}» ha trovato un punto d’incontro: adesso non lo lasci cadere.', 'On “{1}” you found common ground: now do not let it drop.'),
      P("Su «{}» ha tenuto insieme posizioni lontane: non era scontato.", "On “{1}” you held distant positions together: that was not a given."),
      P("Su «{}» il tavolo ci va bene, se si riunisce davvero entro il mese.", "On “{1}” the table suits us, if it really meets within the month.")],
    mid: [P('Su «{}» la mediazione va bene, purché non diventi un modo per rinviare.', 'On “{1}” mediation is fine, as long as it does not become a way to postpone.'),
      P('Un compromesso su «{}» dipende da che cosa ci chiede di cedere.', 'A compromise on “{1}” depends on what you ask us to give up.'),
      P('Su «{}» un voto lo accettiamo, ma prima vogliamo leggere il testo.', 'On “{1}” we accept a vote, but first we want to read the text.'),
      P("Su «{}» la mediazione regge finché qualcuno non chiede chi paga.", "On “{1}” the mediation holds until someone asks who pays."),
      P("Su «{}» accettiamo di discutere, ma non di aspettare all’infinito.", "On “{1}” we agree to discuss, but not to wait for ever.")],
    bad: [P('Su «{}» la via di mezzo scontenta chi aspetta da anni.', 'On “{1}” the middle way disappoints those who have been waiting for years.'),
      P('Mediare su «{}» vuol dire che il problema resta dov’è.', 'Mediating on “{1}” means the problem stays where it is.'),
      P('Su «{}» non c’è niente da mettere ai voti: c’è da intervenire.', 'On “{1}” there is nothing to put to a vote: there is something to fix.'),
      P("Su «{}» si cerca un accordo tra chi decide e intanto chi aspetta resta fuori.", "On “{1}” those who decide look for a deal while those who wait stay outside."),
      P("Su «{}» il compromesso che propone toglie proprio la parte che ci serviva.", "On “{1}” the compromise you propose removes exactly the part we needed.")]
  },
  scontro: {
    good: [P('Almeno su «{}» ha detto chiaramente da che parte sta, e lo apprezzo anche se non sono d’accordo.', 'At least on “{1}” you said clearly where you stand, and I appreciate it even if I disagree.'),
      P('Si è preso la responsabilità su «{}»: non capita spesso.', 'You took responsibility on “{1}”: that does not happen often.'),
      P('Su «{}» la sua posizione adesso è netta: la giudicheremo sui fatti.', 'On “{1}” your position is now clear: we will judge it on the facts.'),
      P("Su «{}» ha avuto il coraggio di dire una cosa scomoda: vedremo se la difende anche fuori di qui.", "On “{1}” you had the courage to say something uncomfortable: we will see if you defend it outside here too."),
      P("Su «{}» la sua franchezza ci aiuta a capire con chi abbiamo a che fare.", "On “{1}” your frankness helps us understand who we are dealing with.")],
    mid: [P('Su «{}» ha alzato la voce, ma la soluzione non l’ho sentita.', 'On “{1}” you raised your voice, but I did not hear the solution.'),
      P('Va bene contestare, ma su «{}» qualcuno deve pur fare il primo passo.', 'Contesting is fine, but on “{1}” someone has to take the first step.'),
      P('Ha chiarito la sua posizione su «{}»: adesso spieghi come la mette in pratica.', 'You clarified your position on “{1}”: now explain how you put it into practice.'),
      P("Su «{}» le sue critiche le condivido in parte, ma la proposta dov’è?", "On “{1}” I partly share your criticism, but where is the proposal?"),
      P("Su «{}» ha preso posizione, adesso serve qualcuno che faccia il passo dopo.", "On “{1}” you took a stand, now someone has to take the next step.")],
    bad: [P('Su «{}» attaccare gli altri non ripara niente.', 'On “{1}” attacking the others fixes nothing.'),
      P('Su «{}» non siamo venuti per una polemica: siamo venuti per una risposta.', 'On “{1}” we did not come for a row: we came for an answer.'),
      P('Questa su «{}» è una battuta da talk show, non una risposta.', 'That line on “{1}” is a talk-show quip, not an answer.'),
      P("Su «{}» dare la colpa agli altri non cambia la vita di nessuno.", "On “{1}” blaming the others changes nobody’s life."),
      P("Su «{}» alzare i toni ci allontana dalla soluzione.", "On “{1}” raising the tone takes us further from the solution.")]
  }
});
// the second guest takes the floor on the same subject, saying how the first answer landed
export const BRIDGE = Object.freeze({
  good: [P('Resto su «{}»: la risposta di prima mi ha convinto a metà, quindi le chiedo di più.', 'I will stay on “{1}”: the answer before half-convinced me, so I am asking you for more.'),
    P('Visto che su «{}» si è preso un impegno, le faccio la domanda che viene subito dopo.', 'Since you made a commitment on “{1}”, let me ask the question that comes right after.'),
    P('Sempre su «{}», dal punto di vista di chi rappresento:', 'Still on “{1}”, from the point of view of the people I represent:'),
    P("Su «{}» la direzione mi piace, quindi entro nel merito.", "On “{1}” I like the direction, so let me get into the details."),
    P("Prendo per buona la risposta su «{}» e aggiungo un problema che riguarda noi.", "I take the answer on “{1}” at face value and add a problem that concerns us.")],
  mid: [P('Su «{}» la risposta di prima lascia aperte delle domande, e una è questa:', 'On “{1}” the answer before leaves questions open, and one is this:'),
    P('Non cambio argomento: su «{}» manca ancora un pezzo.', 'I am not changing the subject: on “{1}” a piece is still missing.'),
    P('Torno su «{}», perché la cosa che più conta non è stata detta:', 'I am going back to “{1}”, because the thing that matters most has not been said:'),
    P("Su «{}» non sono convinto del tutto, e le spiego perché con una domanda:", "On “{1}” I am not entirely convinced, and I will explain why with a question:"),
    P("Su «{}» la mia collega ha ragione a insistere, e io aggiungo questo:", "On “{1}” my colleague is right to insist, and I add this:")],
  bad: [P('Su «{}» al mio collega non ha risposto davvero, quindi provo io, in modo più diretto:', 'On “{1}” you did not really answer my colleague, so let me try, more directly:'),
    P('Su «{}» la risposta di prima non basta: le chiedo una cosa precisa.', 'On “{1}” the answer before is not enough: I am asking you something precise.'),
    P('Restiamo su «{}», perché finora abbiamo sentito solo parole:', 'Let us stay on “{1}”, because so far we have only heard words:'),
    P("Su «{}» la risposta di prima ha deluso molti qui dentro, quindi glielo chiedo di nuovo:", "On “{1}” the answer before disappointed many in here, so I am asking you again:"),
    P("Su «{}» girare intorno al problema non serve: vengo al punto.", "On “{1}” going round the problem is no use: I will come to the point.")]
});
export const DECIDE = Object.freeze({
  good: [P('Su «{}» le cose ora sono più chiare: che cosa si decide, in concreto, e chi lo fa?', 'On “{1}” things are clearer now: what is decided, in concrete terms, and who does it?'),
    P('Su «{}» siamo vicini: ci dica la decisione, adesso, davanti a tutti.', 'On “{1}” we are close: tell us the decision, now, in front of everyone.'),
    P('Per «{}» abbiamo capito la direzione: qual è il primo atto?', 'For “{1}” we understand the direction: what is the first act?'),
    P("Su «{}» abbiamo gli elementi: qual è il primo passo e chi lo firma?", "On “{1}” we have the elements: what is the first step and who signs it?"),
    P("Su «{}» la strada si vede: ce la indichi con una scadenza.", "On “{1}” the road is visible: show it to us with a deadline.")],
  mid: [P('Su «{}» siamo a metà strada: che cosa si fa adesso, davvero?', 'On “{1}” we are halfway there: what do we actually do now?'),
    P('Su «{}» abbiamo sentito idee diverse: quale sceglie?', 'On “{1}” we have heard different ideas: which one do you choose?'),
    P('Per «{}» serve una scelta: quale si prende la responsabilità di fare?', 'For “{1}” a choice is needed: which one will you take responsibility for?'),
    P("Su «{}» le opzioni sono sul tavolo: quale porta avanti lei?", "On “{1}” the options are on the table: which one do you take forward?"),
    P("Su «{}» non possiamo uscire di qui senza una scelta: la faccia lei.", "On “{1}” we cannot leave here without a choice: you make it.")],
  bad: [P('Su «{}» così non ci siamo: qual è la sua proposta, a questo punto?', 'On “{1}” this is not working: what is your proposal at this point?'),
    P('Su «{}» non abbiamo ancora sentito una decisione: la prenda adesso.', 'On “{1}” we still have not heard a decision: take it now.'),
    P('Per «{}» basta giri di parole: che cosa farà?', 'For “{1}” enough beating about the bush: what will you do?'),
    P("Su «{}» le parole sono finite: ci dica che cosa decide.", "On “{1}” the words have run out: tell us what you decide."),
    P("Su «{}» abbiamo perso abbastanza tempo: qual è la decisione?", "On “{1}” we have lost enough time: what is the decision?")],
  tense: [P('Su «{}» i toni si stanno alzando: come se ne esce, adesso?', 'On “{1}” voices are rising: how do we get out of this?'),
    P('Su «{}» rischiamo di lasciarci peggio di come siamo arrivati: che cosa propone?', 'On “{1}” we risk leaving worse off than we arrived: what do you propose?'),
    P('Per «{}» serve abbassare la tensione: qual è la sua mossa?', 'For “{1}” the tension must come down: what is your move?'),
    P("Su «{}» la sala si sta dividendo: che cosa dice per tenerla insieme?", "On “{1}” the room is splitting: what do you say to hold it together?"),
    P("Su «{}» ci stiamo parlando addosso: come ripartiamo?", "On “{1}” we are talking over each other: how do we start again?")]
});
export const GUARANTEE = Object.freeze({
  guarantee: [P('Su «{}» va bene, ma vogliamo garanzie: come ci assicura che sarà fatto?', 'On “{1}” fine, but we want guarantees: how do you assure us it will be done?'),
    P('Per «{}» chi controlla che l’impegno sia rispettato, e quando ci rivediamo?', 'For “{1}” who checks that the commitment is kept, and when do we meet again?'),
    P('Su «{}» mettiamo per iscritto tempi e responsabili: è d’accordo?', 'On “{1}” let us put the timing and the people responsible in writing: do you agree?'),
    P("Su «{}» ci fissa una data di verifica, qui, adesso?", "On “{1}” will you set us a date to check, here, now?"),
    P("Su «{}» chi risponde se l’impegno salta?", "On “{1}” who answers for it if the commitment falls through?")],
  tense: [P('Su «{}», prima di chiudere, dobbiamo ricucire lo strappo: come procediamo?', 'On “{1}”, before we close, we must mend the rift: how do we proceed?'),
    P('Su «{}» non possiamo andarcene così: che cosa offre per ripartire?', 'On “{1}” we cannot leave like this: what do you offer to start again?'),
    P('Per «{}» serve un gesto prima di chiudere: quale?', 'For “{1}” a gesture is needed before we close: which one?'),
    P("Su «{}» prima di salutarci serve un segnale di buona volontà.", "On “{1}” before we say goodbye a sign of good will is needed."),
    P("Su «{}» non chiudiamo con una frattura: che cosa mette sul tavolo?", "On “{1}” let us not close with a rift: what do you put on the table?")]
});
// who the player is, said before the first question (the flags the store gives the scene: governo, opposizione, nessun incarico)
export const ROLE = Object.freeze({
  governo: [P('Lei sta in maggioranza: su questo le decisioni passano anche dalle sue mani.', 'You are in the majority: on this the decisions also go through your hands.'),
    P('Chi governa non può dire che non dipende da lui: per questo lo chiedo a lei.', 'Those who govern cannot say it does not depend on them: that is why I am asking you.'),
    P('Lei ha voce in capitolo nella maggioranza, quindi la domanda è per lei.', 'You have a say in the majority, so the question is for you.'),
    P("Lei fa parte di chi governa: le risposte di oggi le chiederemo poi in aula.", "You are among those who govern: we will ask for today’s answers again in the chamber."),
    P("Con il suo incarico questa decisione non la può delegare ad altri.", "With your office you cannot delegate this decision to others.")],
  opposizione: [P('Lei è all’opposizione: ci dica che cosa farebbe al posto di chi governa.', 'You are in opposition: tell us what you would do in the place of those who govern.'),
    P('Dall’opposizione si può incalzare chi decide: lo farà su questo?', 'From the opposition you can press those who decide: will you do it on this?'),
    P('Non governa, ma ha un seggio: che cosa può ottenere da lì?', 'You do not govern, but you have a seat: what can you obtain from there?'),
    P("Dall’opposizione lei può presentare atti e interrogazioni: lo farà su questo?", "From the opposition you can table motions and questions: will you do it on this?"),
    P("Lei non governa, ma può costringere chi governa a rispondere.", "You do not govern, but you can force those who govern to answer.")],
  nessuno: [P('Lei oggi non ha un incarico: che cosa farebbe se lo avesse?', 'You hold no office today: what would you do if you had one?'),
    P('Senza un incarico non decide lei, lo so: ma chi chiede fiducia deve dire che cosa farà.', 'Without an office you do not decide, I know: but whoever asks for trust must say what they will do.'),
    P('Lei non siede in un’assemblea: come pensa di portare questo problema dove si decide?', 'You do not sit in an assembly: how do you plan to bring this problem where decisions are made?'),
    P("Lei oggi parla da iscritto al partito, non da amministratore: che cosa può promettere?", "Today you speak as a party member, not as an administrator: what can you promise?"),
    P("Senza un seggio, che cosa può fare concretamente per noi?", "Without a seat, what can you concretely do for us?")]
});
export const ALL_PAIRS = Object.freeze([...Object.values(FOLLOW).flatMap(group => Object.values(group).flat()), ...Object.values(BRIDGE).flat(), ...Object.values(DECIDE).flat(), ...Object.values(GUARANTEE).flat(), ...Object.values(ROLE).flat()]);
