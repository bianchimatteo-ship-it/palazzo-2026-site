// The words of the television studios (core/studio-lines.js picks among them, deterministically): every line is a pair [Italian, English]; `{}` is a free part (a name, a topic) filled in order, and in the
// English the parts are `{1}`, `{2}`… The same pairs feed the phrase-book (data/i18n/en-ui-9.js), so what the studio says is translated exactly as it is written here. Nothing here decides a result.
// Keys: invito / ingresso / q1 / q2 / domanda / attacco / reaction (host, rival, audience) / chiusura; each in the three formats of the studios (`faccia`, `talk`, `intervista`) or `any`.

export const LINES = Object.freeze({
  invito: {
    faccia: [
      ['Sei invitato a «{}», il dibattito televisivo sul tema «{}»: parteciperà {}. Accetti l’invito?', 'You are invited to “{1}”, the television debate on “{2}”: {3} will take part. Do you accept?'],
      ['«{}» organizza un confronto diretto sul tema «{}» e ha invitato anche {}. Vieni in studio?', '“{1}” is organising a head-to-head on “{2}” and has also invited {3}. Will you come to the studio?'],
      ['In prima serata va in onda «{}»: due candidati, un moderatore, il tema «{}». L’altro ospite è {}. Accetti?', 'Tonight in prime time: “{1}”, two candidates, a moderator, the topic “{2}”. The other guest is {3}. Do you accept?']
    ],
    talk: [
      ['«{}» ti vuole ospite in studio per parlare di «{}»: con te ci sarà {}. Accetti l’invito?', '“{1}” wants you as a guest in the studio to talk about “{2}”: {3} will be there too. Do you accept?'],
      ['La redazione di «{}» ti propone una serata sul tema «{}», con {} come altro ospite. Ci vai?', 'The “{1}” team offers you an evening on “{2}”, with {3} as the other guest. Will you go?'],
      ['Squilla il telefono: è «{}». Vorrebbero un tuo intervento sul tema «{}» davanti al pubblico in studio, insieme a {}. Accetti?', 'The phone rings: it is “{1}”. They would like you on “{2}” in front of the studio audience, together with {3}. Do you accept?']
    ],
    intervista: [
      ['«{}» ti propone un’intervista in diretta sul tema «{}»; nello stesso servizio sarà ascoltato anche {}. Accetti?', '“{1}” offers you a live interview on “{2}”; {3} will also be heard in the same report. Do you accept?'],
      ['Dalla redazione di «{}» chiedono un tuo commento in diretta su «{}», insieme a {}. Vai in studio?', 'The “{1}” newsroom asks for your live comment on “{2}”, together with {3}. Will you go to the studio?'],
      ['«{}» apre l’edizione con il tema «{}» e vorrebbe te e {} in studio per un’intervista. Accetti?', '“{1}” opens its edition with the topic “{2}” and would like you and {3} in the studio for an interview. Do you accept?']
    ]
  },
  ingresso: {
    faccia: [
      ['Buonasera. Stasera a confronto {} e {}. Si comincia.', 'Good evening. Tonight {1} and {2} face each other. Let us begin.'],
      ['Benvenuti. Al leggio {} e {}, ospiti di «{}»: trenta secondi a risposta, il tempo lo tengo io.', 'Welcome. At the lecterns {1} and {2}, guests of “{3}”: thirty seconds per answer, I keep the time.'],
      ['Siamo in diretta. Due candidati, un solo tema, regole uguali per tutti: {} e {}, prego.', 'We are live. Two candidates, one topic, equal rules for everyone: {1} and {2}, please.']
    ],
    talk: [
      ['Buonasera. Stasera con noi {} e {}, ospiti di «{}»: si accomodino, si parte.', 'Good evening. Tonight with us {1} and {2}, guests of “{3}”: please sit down, here we go.'],
      ['Applauso per i nostri ospiti: {} e {}. In studio il pubblico è già caldo, cominciamo.', 'A round of applause for our guests: {1} and {2}. The audience in the studio is already warm, let us begin.'],
      ['Ospiti della serata {} e {}: siamo in onda su «{}», e prima di tutto grazie di essere qui.', 'Tonight’s guests are {1} and {2}: we are on air on “{3}”, and first of all thank you for being here.']
    ],
    intervista: [
      ['Buonasera. Con noi {} e {}, qui nello studio di «{}»: cominciamo con le domande.', 'Good evening. With us {1} and {2}, here in the “{3}” studio: let us start with the questions.'],
      ['Torniamo in diretta. In studio {} e, accanto a lei, {}: tre domande, poi il collegamento con il pubblico a casa.', 'Back live. In the studio {1} and, next to them, {2}: three questions, then the link with the public at home.'],
      ['Questa sera ospitiamo {} e {} a «{}». Domande brevi e risposte altrettanto brevi, grazie.', 'This evening we host {1} and {2} on “{3}”. Short questions and equally short answers, please.']
    ]
  },
  q1: {
    faccia: [
      ['Prima domanda, a {}: {} è la priorità del momento. Che cosa propone concretamente?', 'First question, to {1}: {2} is the priority of the moment. What do you concretely propose?'],
      ['{}, cominciamo da {}: in una frase, che cosa cambierebbe subito?', '{1}, let us start with {2}: in one sentence, what would you change immediately?'],
      ['{}, il Paese chiede risposte su {}. Che cosa direbbe a chi ci guarda da casa?', '{1}, the country wants answers on {2}. What would you say to those watching from home?']
    ],
    talk: [
      ['{}, partiamo dal tema della serata: {}. Lei che cosa ne pensa, parlando chiaro?', '{1}, let us start from tonight’s topic: {2}. What do you think, speaking plainly?'],
      ['{}, si parla tanto di {}: ci racconti, che cosa farebbe lei?', '{1}, there is a lot of talk about {2}: tell us, what would you do?'],
      ['{}, per rompere il ghiaccio: su {} la gente che cosa dovrebbe aspettarsi da lei?', '{1}, to break the ice: on {2}, what should people expect from you?']
    ],
    intervista: [
      ['{}, la prima domanda è sul tema del giorno: {}. Che cosa propone?', '{1}, the first question is on the topic of the day: {2}. What do you propose?'],
      ['{}, ci sono novità su {}: qual è la posizione del suo partito, in trenta secondi?', '{1}, there is news on {2}: what is your party’s position, in thirty seconds?'],
      ['{}, sul tavolo c’è {}: che cosa direbbe agli elettori che la ascoltano?', '{1}, on the table there is {2}: what would you tell the voters who are listening?']
    ]
  },
  q2: {
    topic: [
      ['Seconda domanda, a {}: parliamo di {}. Come risponde?', 'Second question, to {1}: let us talk about {2}. How do you answer?'],
      ['{}, cambiamo argomento: {}. Qui c’è chi l’aspetta al varco.', '{1}, let us change topic: {2}. There are people waiting for you here.'],
      ['{}, un’altra questione molto sentita: {}. Che cosa risponde?', '{1}, another very felt issue: {2}. What is your reply?']
    ],
    money: [
      ['Seconda domanda, a {}: le persone vogliono sapere come pagherà tutto questo. Come risponde?', 'Second question, to {1}: people want to know how you will pay for all this. How do you answer?'],
      ['{}, i conti: dove si trovano i soldi per quello che promette?', '{1}, the accounts: where does the money for what you promise come from?'],
      ['{}, ogni promessa ha un costo. Qual è il suo, e chi lo paga?', '{1}, every promise has a cost. What is yours, and who pays for it?']
    ],
    promise: [
      ['{}, lei ha promesso «{}»: a che punto siamo? Come risponde?', '{1}, you promised “{2}”: where do we stand? How do you answer?'],
      ['Una domanda sulle sue promesse, {}: «{}». La gente chiede se la manterrà.', 'A question about your promises, {1}: “{2}”. People ask whether you will keep it.']
    ],
    broken: [
      ['{}, tra le sue promesse c’era «{}» e non è stata mantenuta. Che cosa dice a chi ci aveva creduto?', '{1}, one of your promises was “{2}” and it was not kept. What do you say to those who believed it?'],
      ['{}, «{}» era scritto nel suo programma e non è arrivato. Perché?', '{1}, “{2}” was written in your programme and it did not arrive. Why?']
    ],
    rival: [
      ['{}, {} propone {}. In che cosa la sua proposta è migliore?', '{1}, {2} proposes {3}. In what way is your proposal better?'],
      ['{}, {} la pensa in modo diverso su {}. Dove sbaglia, secondo lei?', '{1}, {2} thinks differently on {3}. Where is the mistake, in your view?']
    ],
    event: [
      ['{}, in questi giorni si parla di «{}». Lei che cosa risponde ai cittadini?', '{1}, in these days people talk about “{2}”. What do you answer to citizens?'],
      ['{}, c’è un fatto che pesa nel dibattito: «{}». Come lo affronterebbe?', '{1}, there is a fact that weighs on the debate: “{2}”. How would you face it?']
    ]
  },
  domanda: {
    any: [
      ['Hai la possibilità di rivolgere una domanda a {}.', 'You have the chance to put a question to {1}.'],
      ['Il conduttore ti passa la parola: puoi interpellare direttamente {}.', 'The host gives you the floor: you can address {1} directly.'],
      ['Tocca a te: una domanda diretta a {}, davanti a tutti.', 'Your turn: one direct question to {1}, in front of everyone.']
    ]
  },
  attacco: {
    broken: [
      ['{}: «Lei prometteva {} e non ha mantenuto la parola. Perché dovremmo crederle?»', '{1}: «You promised {2} and did not keep your word. Why should we believe you?»'],
      ['{}: «{}: lo aveva promesso agli elettori. Dov’è finito?»', '{1}: “{2}: you had promised it to the voters. Where did it end up?”']
    ],
    credibility: [
      ['{}: «Promette troppo e in troppe direzioni: dove sono i soldi?»', '{1}: «You promise too much in too many directions: where is the money?»'],
      ['{}: «Il suo programma è un elenco di desideri. Dove sono le coperture?»', '{1}: “Your programme is a wish list. Where is the funding?”']
    ],
    crisis: [
      ['{}: «Una polemica dopo l’altra: è questa la serietà che offre?»', '{1}: «One controversy after another: is this the seriousness you offer?»'],
      ['{}: «Nelle ultime settimane ha avuto più scuse che risultati.»', '{1}: “In recent weeks you have had more excuses than results.”']
    ],
    provoked: [
      ['{}: «Ha attaccato per non rispondere. Lo ha notato anche il pubblico.»', '{1}: «You attacked in order not to answer. The audience noticed too.»'],
      ['{}: «Alzare la voce non è un argomento. Torniamo ai fatti.»', '{1}: “Raising your voice is not an argument. Let us go back to the facts.”']
    ],
    coverage: [
      ['{}: «{}: bella idea, ma dove sono le coperture?»', '{1}: “{2}: a nice idea, but where is the funding?”'],
      ['{}: «Nel suo programma c’è «{}»: chi lo paga, e con quali soldi?»', '{1}: “Your programme includes “{2}”: who pays for it, and with what money?”']
    ],
    event: [
      ['{}: «Mentre si discute di {}, lei dov’era?»', '{1}: “While people discuss {2}, where were you?”'],
      ['{}: «Su {} i cittadini aspettano risposte, non slogan.»', '{1}: “On {2} citizens wait for answers, not slogans.”']
    ],
    any: [
      ['{}: «Parole ben scelte, ma i fatti dove sono?»', '{1}: «Well-chosen words, but where are the facts?»'],
      ['{}: «Lei promette molto, ma gli italiani vogliono i fatti.»', '{1}: «You promise a lot, but Italians want facts.»'],
      ['{}: «Belle parole: adesso ci dica quando e con quali soldi.»', '{1}: “Nice words: now tell us when and with what money.”']
    ]
  },
  reaction: {
    hostGood: [
      ['{}: «Una risposta chiara su {}.»', '{1}: «A clear answer on {2}.»'],
      ['{}: «Netto, grazie. Su {} non era scontato.»', '{1}: “Clear, thank you. On {2} it was not a given.”'],
      ['{}: «Risposta concreta su {}: il pubblico ha seguito.»', '{1}: “A concrete answer on {2}: the audience followed.”']
    ],
    hostMid: [
      ['{}: «Una risposta che divide.»', '{1}: «An answer that divides.»'],
      ['{}: «Su {} c’è da approfondire, ma andiamo avanti.»', '{1}: “On {2} there is more to dig into, but let us move on.”']
    ],
    hostBad: [
      ['{}: «Non ha risposto del tutto alla domanda: la riformulo.»', '{1}: «You did not quite answer the question: let me rephrase it.»'],
      ['{}: «Su {} aspettavamo qualcosa di più preciso.»', '{1}: “On {2} we expected something more precise.”']
    ],
    rivalGoodAttack: [['{} incassa il colpo e prende appunti.', '{1} takes the blow and makes notes.'], ['{} sorride, ma la penna si ferma.', '{1} smiles, but the pen stops.']],
    rivalBadAttack: [['{}: «Parlare male degli altri non è un programma.»', '{1}: «Speaking ill of others is not a programme.»'], ['{}: «Attacca perché non ha altro da dire.»', '{1}: “You attack because you have nothing else to say.”']],
    rivalGood: [['{} annuisce, poi cerca un punto debole.', '{1} nods, then looks for a weak point.'], ['{} prende la parola solo per ribadire la sua posizione.', '{1} takes the floor only to restate their position.']],
    rivalBad: [['{}: «Parole, ma dove sono i fatti?»', '{1}: «Words, but where are the facts?»'], ['{}: «Questo lo avevamo già sentito.»', '{1}: “We had already heard that.”']],
    audienceGood: [['Il pubblico applaude.', 'The audience applauds.'], ['Dalla platea si alza un applauso.', 'An applause rises from the audience.']],
    audienceMid: [['Il pubblico è diviso.', 'The audience is divided.'], ['In platea qualcuno applaude, qualcuno no.', 'In the audience some applaud, some do not.']],
    audienceBad: [['Il pubblico rumoreggia.', 'The audience murmurs.'], ['In platea si sente qualche fischio.', 'A few whistles are heard in the audience.']],
    audienceNone: [['In studio cala un silenzio attento.', 'An attentive silence falls over the studio.'], ['Le telecamere stringono sul tuo volto.', 'The cameras tighten on your face.']]
  },
  chiusura: {
    faccia: [
      ['Siamo alle battute finali: a ciascuno trenta secondi per le dichiarazioni conclusive.', 'We are in the final lines: thirty seconds each for the closing statements.'],
      ['Il tempo sta per scadere: l’ultima parola ai candidati, trenta secondi a testa.', 'Time is almost up: the last word to the candidates, thirty seconds each.']
    ],
    talk: [
      ['Prima di salutarci, un’ultima battuta a testa per chi ci guarda da casa.', 'Before we say goodbye, one last line each for those watching at home.'],
      ['Il programma sta per finire: una frase di chiusura, poi i saluti.', 'The programme is about to end: one closing sentence, then the goodbyes.']
    ],
    intervista: [
      ['Abbiamo quasi finito: un’ultima dichiarazione prima della pubblicità.', 'We are almost done: one last statement before the break.'],
      ['Ultimi secondi in diretta: il messaggio che vuole lasciare agli spettatori?', 'Last seconds live: the message you want to leave to the viewers?']
    ]
  },
  chiusuraHost: [
    ['{}: «Grazie a entrambi. La parola agli elettori.»', '{1}: «Thank you both. The word now goes to the voters.»'],
    ['{}: «Vi ringrazio. Il giudizio ora spetta a chi guarda da casa.»', '{1}: “Thank you. The verdict now belongs to those watching at home.”']
  ]
});

// The headlines of the strip of the studio: built from the situation of the game; the templates are here so that they are translated (the free parts are names and topics).
export const TICKER = Object.freeze({
  topic: [['IN DIRETTA · Tema della serata: {}', 'LIVE · Topic of the evening: {1}']],
  poll: [['SONDAGGI · {} al {} per cento, {} al {}', 'POLLS · {1} at {2} per cent, {3} at {4}']],
  promise: [['PROMESSE · «{}»: {}', 'PROMISES · “{1}”: {2}']],
  event: [['ULTIM’ORA · {}', 'LATEST · {1}']],
  rival: [['AVVERSARIO · {} nel programma mette {}', 'OPPONENT · {1} puts {2} in the programme']]
});


// More words for the rallies (core/rally-scene.js adds them to its own banks): `{token}` is filled by the engine; each token appears once per line, so that the phrase-book pair is well formed.
export const RALLY_EXTRA = Object.freeze({
  promessa: [
    ['«Ho firmato un impegno: {intervention}. Qui, in {place}, ve lo ripeto e vi chiedo di ricordarlo.»', '“I signed a commitment: {intervention}. Here, in {place}, I repeat it and ask you to remember it.”'],
    ['«Su {area} non ho girato intorno alle parole: ho promesso e ora vi dico a che punto siamo.»', '“On {area} I did not beat around the bush: I promised and now I tell you where we stand.”'],
    ['«{party} mette la firma sotto le promesse. Su {area} ogni passo sarà verificabile da voi.»', '“{party} puts its signature under its promises. On {area} every step will be checkable by you.”']
  ],
  territorio: [
    ['«A {place} lo sanno tutti: {problem}. Non è una colpa di oggi, ma è una responsabilità di chi decide.»', '“Everyone in {place} knows it: {problem}. It is not the fault of today, but it is the responsibility of those who decide.”'],
    ['«Ho ascoltato i comitati di {place}: il tema è {problem}. Ora si passa dall’ascolto ai fatti.»', '“I have listened to the committees of {place}: the issue is {problem}. Now we move from listening to action.”'],
    ['«Se c’è un posto dove {problem} pesa, è {place}. Per questo comincio da qui.»', '“If there is a place where {problem} weighs heavily, it is {place}. That is why I start here.”']
  ],
  attualita: [
    ['«Non vi dico che è facile: {topic}. Vi dico che non lo nasconderò.»', '“I will not tell you it is easy: {topic}. I will tell you that I will not hide it.”'],
    ['«Si parla di {topic} da settimane: è ora che qualcuno dica che cosa si fa, non solo che cosa si pensa.»', '“People have talked about {topic} for weeks: it is time someone says what will be done, not only what is thought.”'],
    ['«Su {topic} ascolto tutti, ma decido io davanti a voi.»', '“On {topic} I listen to everyone, but I decide in front of you.”']
  ],
  governo: [
    ['«Guidare il Governo significa rispondere ogni giorno: ecco cosa abbiamo portato a casa e cosa no.»', '“Leading the Government means answering every day: here is what we brought home and what we did not.”'],
    ['«Non vi racconto un Paese perfetto: vi racconto i risultati veri e i ritardi veri.»', '“I will not tell you about a perfect country: I will tell you the real results and the real delays.”'],
    ['«Chi governa non può dare la colpa agli altri: ve lo dico io per primo.»', '“Those who govern cannot blame others: I tell you so myself, first.”']
  ],
  proposta: [
    ['«Ecco una proposta di {party} su {area}: concreta, finanziata, spiegata punto per punto.»', '“Here is a proposal from {party} on {area}: concrete, funded, explained point by point.”'],
    ['«Per {place} {area} non è uno slogan: è un capitolo del programma con numeri e tempi.»', '“For {place}, {area} is not a slogan: it is a chapter of the programme with numbers and timelines.”'],
    ['«Vi porto una idea su {area} senza fare promesse che non posso mantenere: giudicatela voi.»', '“I bring you an idea on {area} without making promises I cannot keep: you be the judge.”']
  ],
  attacco: [
    ['«Chi ha guidato {place} negli ultimi anni ci dica che cosa ha lasciato, non che cosa ha promesso.»', '“Whoever has led {place} in recent years should tell us what they have left behind, not what they have promised.”'],
    ['«Non è un attacco, è una domanda: dove sono finiti i soldi e i cantieri promessi a {place}?»', '“It is not an attack, it is a question: where have the money and the building sites promised to {place} gone?”'],
    ['«I cittadini non sono ospiti della politica: chi ha mancato di rispetto a {place} ne risponderà.»', '“Citizens are not guests of politics: whoever has failed to respect {place} will answer for it.”']
  ]
});
export const RALLY_CROWD_EXTRA = Object.freeze({
  good: [['Un coro parte dal centro della piazza e si allarga fino alle vie laterali.', 'A chant starts in the middle of the square and spreads to the side streets.'], ['Un applauso lungo, poi qualcuno alza un bambino sulle spalle per vederti meglio.', 'A long applause, then someone lifts a child on their shoulders to see you better.']],
  mixed: [['La piazza ascolta con attenzione, applaude solo a tratti.', 'The square listens attentively and applauds only now and then.'], ['Qualcuno annuisce, qualcuno incrocia le braccia: serve ancora un argomento.', 'Some nod, some fold their arms: another argument is still needed.']],
  bad: [['Un gruppo in fondo gira le spalle e se ne va.', 'A group at the back turns and walks away.'], ['Silenzio freddo, interrotto da un fischio isolato.', 'A cold silence, broken by a lone whistle.']]
});
const rallyPairs = () => {
  const pairs = [];
  for (const list of Object.values(RALLY_EXTRA)) for (const [it, en] of list) {
    const order = []; const itOut = it.replace(/\{(\w+)\}/g, (_, token) => { order.push(token); return '{}'; });
    pairs.push([itOut, en.replace(/\{(\w+)\}/g, (_, token) => `{${order.indexOf(token) + 1}}`)]);
  }
  for (const list of Object.values(RALLY_CROWD_EXTRA)) for (const pair of list) pairs.push(pair);
  return pairs;
};


// The words of the Aula (ui/aula-view.js): the President of the assembly opens, announces and closes the vote; `{}` are the title of the President, the assembly, the label of the vote. The names are
// roles, never persons: no real President is named. EN pairs as above.
export const AULA = Object.freeze({
  open: [
    ['{}: «Indìco la votazione: {}.»', '{1}: “I call the vote: {2}.”'],
    ['{}: «Si passa alla votazione: {}.»', '{1}: “We move to the vote: {2}.”']
  ],
  confidence: [['{}: «Si vota sulla questione di fiducia posta dal Governo: {}.»', '{1}: “We vote on the question of confidence raised by the Government: {2}.”']],
  opened: [['{}: «La votazione è aperta. I colleghi votino.»', '{1}: “The vote is open. Members, please vote.”'], ['{}: «Dichiaro aperta la votazione.»', '{1}: “I declare the vote open.”']],
  secret: [['{}: «La votazione è a scrutinio segreto: nessuno saprà chi ha votato cosa.»', '{1}: “The vote is by secret ballot: no one will know who voted what.”']],
  progress: [['Sono stati espressi # voti su # seggi.', '# votes have been cast out of # seats.'], ['Il tabellone si riempie: # voti su #.', 'The board fills up: # votes out of #.']],
  closed: [['{}: «Dichiaro chiusa la votazione.»', '{1}: “I declare the vote closed.”']],
  passed: [['{}: «{} approva: favorevoli #, contrari #, astenuti #.»', '{1}: “{2} approves: in favour {3}, against {4}, abstentions {5}.”']],
  rejected: [['{}: «{} respinge: favorevoli #, contrari #, astenuti #.»', '{1}: “{2} rejects: in favour {3}, against {4}, abstentions {5}.”']],
  confidencePassed: [['{}: «{} accorda la fiducia: favorevoli #, contrari #, astenuti #.»', '{1}: “{2} grants confidence: in favour {3}, against {4}, abstentions {5}.”']],
  confidenceRejected: [['{}: «{} nega la fiducia: favorevoli #, contrari #, astenuti #.»', '{1}: “{2} denies confidence: in favour {3}, against {4}, abstentions {5}.”']],
  secretResult: [['Voto segreto: i voti dei singoli non sono noti, solo i totali.', 'Secret ballot: individual votes are not known, only the totals.']],
  you: [['Il tuo voto: {}.', 'Your vote: {1}.']],
  youAbsent: [['Il tuo seggio non partecipa al voto.', 'Your seat does not take part in the vote.']],
  note: [['Votazione simulata: il gioco ha già deciso i voti di ogni gruppo; qui si rivedono, seggio per seggio, senza cambiarli.', 'Simulated vote: the game has already decided each group’s votes; here they are replayed seat by seat, without changing them.']]
});
export const AULA_NAMES = Object.freeze([
  ['La Camera', 'The Chamber of Deputies'], ['Il Senato', 'The Senate'], ['Il Consiglio comunale', 'The city council'], ['Il Consiglio regionale', 'The regional council'], ['Il Parlamento europeo', 'The European Parliament'],
  ['Il Presidente della Camera', 'The Speaker of the Chamber'], ['Il Presidente del Senato', 'The President of the Senate'], ['Il Presidente del Consiglio comunale', 'The President of the city council'], ['Il Presidente del Consiglio regionale', 'The President of the regional council'], ['Il Presidente del Parlamento', 'The President of the Parliament']
]);

export const ALL_PAIRS = (() => {
  const out = [];
  const walk = node => { if (Array.isArray(node) && node.length === 2 && typeof node[0] === 'string') out.push(node); else if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object') Object.values(node).forEach(walk); };
  walk(LINES); walk(TICKER); walk(AULA); walk(AULA_NAMES);
  return [...out, ...rallyPairs()];
})();
