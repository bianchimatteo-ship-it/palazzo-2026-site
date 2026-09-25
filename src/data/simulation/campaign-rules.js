// Every generated scenario and tuning value is simulation data. Official links
// below explain the broad electoral structure; they are not a legal simulator.
export const ELECTION_MODELS = Object.freeze({
  comunale: Object.freeze({
    source:'simulation',
    label:'Comunali', campaignDays:35, nominationDays:8, model:'mayor-two-round', seatCount:16,
    territorialMode:'municipality', strategy:'Il territorio comunale pesa direttamente sul risultato.',
    referenceUrl:'https://dait.interno.gov.it/elezioni/faq/faq-elezioni-amministrative-2026',
    referenceName:'Ministero dell’Interno — FAQ elezioni amministrative 2026'
  }),
  regionale: Object.freeze({
    source:'simulation',
    label:'Regionali', campaignDays:42, nominationDays:11, model:'regional-president-and-council', seatCount:31,
    territorialMode:'regional-areas', strategy:'Il consenso e le attività sono distribuiti fra aree simulate della regione.',
    referenceUrl:'https://documenti.camera.it/leg19/dossier/testi/re0016.htm',
    referenceName:'Camera dei deputati — legislazione elettorale regionale'
  }),
  politiche: Object.freeze({
    source:'simulation',
    label:'Politiche', campaignDays:49, nominationDays:14, model:'national-mixed-simulation', seatCount:400,
    territorialMode:'regions', strategy:'Contano la tenuta nazionale, le regioni e i collegi simulati.',
    referenceUrl:'https://documenti.camera.it/leg18/dossier/pdf/AC0125.pdf',
    referenceName:'Camera dei deputati — dossier sul sistema elettorale'
  }),
  europee: Object.freeze({
    source:'simulation',
    label:'Europee', campaignDays:42, nominationDays:12, model:'european-proportional', seatCount:76,
    territorialMode:'european-constituencies', strategy:'La lista compete su base proporzionale e nelle circoscrizioni europee italiane.',
    referenceUrl:'https://dait.interno.gov.it/documenti/dossier-elezioni-europee-2024.pdf',
    referenceName:'Ministero dell’Interno — dossier elezioni europee 2024'
  })
});

export const CAMPAIGN_OBJECTIVES = Object.freeze({
  win:{source:'simulation',label:'Vincere', description:'Conquistare l’incarico o un seggio utile.'},
  threshold:{source:'simulation',label:'Superare la soglia', description:'Ottenere una rappresentanza elettorale significativa.'},
  build:{source:'simulation',label:'Costruire una base', description:'Consolidare consenso e rete sul territorio.'}
});

// The phases of a campaign: what works best changes as the vote gets closer.
export const CAMPAIGN_PHASES = Object.freeze({
  apertura:{label:'Apertura', detail:'Si costruiscono rete, fondi e riconoscibilità: il voto è lontano, l’attenzione bassa.'},
  centrale:{label:'Fase centrale', detail:'Il confronto entra nel vivo: media, dibattiti e aree contese.'},
  finale:{label:'Rush finale', detail:'Ultimi giorni: mobilitazione, porta a porta e appelli al voto contano di più.'},
  ballottaggio:{label:'Ballottaggio', detail:'Due candidati, due settimane: mobilitazione e apparentamenti decidono.'}
});
export const phaseOf = (day, totalDays, stage = 'campagna') => stage === 'ballottaggio' ? 'ballottaggio' : day / Math.max(1, totalDays) < .3 ? 'apertura' : day / Math.max(1, totalDays) < .76 ? 'centrale' : 'finale';

// Campaign strategies: each changes what works, how much the result can swing and what it costs. None is always the
// best: `fit` says in which situations it pays (see strategyFit in the campaign engine).
export const CAMPAIGN_STRATEGIES = Object.freeze({
  consolidare:{source:'simulation',label:'Consolidare il consenso',short:'Consolidare',icon:'shield',detail:'Difendi chi già ti vota: meno rischi e oscillazioni, ma poca crescita verso nuovi elettori.',
    mods:{territory:1.05,internal:1.12,event:1,media:.85,ads:.85,resources:1},risk:.75,volatility:.65,
    pros:'Riduce rischi, polemiche e oscillazioni del giorno del voto; protegge un vantaggio.',cons:'Se sei indietro rimonti poco: i nuovi elettori restano lontani.'},
  nuovi:{source:'simulation',label:'Cercare nuovi elettori',short:'Nuovi elettori',icon:'users',detail:'Parli a chi non ti ha mai votato: più crescita possibile, più incertezza e qualche malumore nella base.',
    mods:{territory:.95,internal:.9,event:1.15,media:1.3,ads:1.35,resources:1},risk:1.2,volatility:1.45,erosion:.1,
    pros:'Il potenziale di crescita più alto quando parti indietro.',cons:'Risultato più incerto; la base si sente trascurata e si erode un po’ ogni settimana.'},
  territorio:{source:'simulation',label:'Puntare sul territorio',short:'Territorio',icon:'pin',detail:'Presidio capillare: porta a porta, incontri, comitati e reti locali.',
    mods:{territory:1.3,internal:1.05,event:1.05,media:.82,ads:.85,resources:1},risk:.9,volatility:.9,
    pros:'Rende di più alle comunali e alle regionali e dove l’organizzazione è forte.',cons:'In un’elezione nazionale il presidio locale non basta; media meno efficaci.'},
  media:{source:'simulation',label:'Social e media',short:'Media',icon:'media',detail:'Tutto sulla visibilità: interviste, social, pubblicità, dibattiti.',
    mods:{territory:.85,internal:.95,event:1.08,media:1.3,ads:1.15,resources:1},risk:1.3,volatility:1.15,
    pros:'Porta lontano chi ha già notorietà, soprattutto nelle elezioni nazionali.',cons:'Più polemiche e passi falsi amplificati; il territorio resta sguarnito.'},
  temi:{source:'simulation',label:'Puntare su un tema',short:'Un tema',icon:'target',needsTopic:true,detail:'Una campagna costruita intorno a una priorità: riconoscibile, ma dipendente dall’agenda.',
    mods:{territory:1,internal:1,event:1.05,media:1.05,ads:1,resources:1},risk:1,volatility:1.05,
    pros:'Se il tema è al centro del dibattito, ogni uscita rende molto di più.',cons:'Se l’agenda cambia, il messaggio perde presa.'},
  contrasto:{source:'simulation',label:'Contrastare un avversario',short:'Contrasto',icon:'split',needsTarget:true,detail:'Metti nel mirino il rivale diretto: gli togli voti, ma i toni duri possono ritorcersi contro.',
    mods:{territory:.95,internal:1,event:1.05,media:1.12,ads:1.05,resources:1},risk:1.25,volatility:1.1,
    pros:'Efficace quando il rivale è vicino: ogni punto che perde è un punto di distacco in meno.',cons:'Contro un rivale lontano rende poco; con una reputazione fragile genera contraccolpi.'},
  coalizione:{source:'simulation',label:'Rafforzare la coalizione',short:'Coalizione',icon:'link',detail:'Accordi, eventi comuni e liste collegate: si vince insieme, a costo di un po’ di identità.',
    mods:{territory:1,internal:1.15,event:1.05,media:.95,ads:.95,resources:1},risk:.95,volatility:.95,allianceBonus:18,
    pros:'Trattative più facili e voti degli alleati che si sommano ai tuoi.',cons:'La tua lista pesa meno dentro la coalizione e una parte del partito lo digerisce male.'}
});

// Costs are game values, in euro/resources and game-days. No real campaign finance totals are asserted or imported
// here. Every activity can also carry: electionTypes (where it exists), requires (condition), phaseBonus and
// typeBonus (how well it works in a phase or kind of election), saturation (repeating it yields less).
export const CAMPAIGN_ACTIVITIES = Object.freeze([
  {source:'simulation',id:'citizen_meeting', label:'Incontro con cittadini', category:'territory', days:1, risk:5, cost:{money:350,volunteers:1,organization:1,politicalCapital:0}, effect:.55, visibility:.6, preparation:0, scope:'focused', detail:'Ascolto diretto, impatto locale e graduale.', typeBonus:{comunale:1.2,europee:.8}, saturation:.04},
  {source:'simulation',id:'door_to_door', label:'Porta a porta', category:'territory', days:2, risk:4, cost:{money:650,volunteers:4,organization:3,politicalCapital:0}, effect:1.15, visibility:.2, preparation:0, scope:'focused', detail:'Richiede una rete di volontari sul posto: rende di più nel rush finale e nei comuni.', phaseBonus:{apertura:.85,finale:1.3,ballottaggio:1.35}, typeBonus:{comunale:1.25,regionale:1.05,politiche:.85,europee:.75}, saturation:.03},
  {source:'simulation',id:'local_visit', label:'Visita locale', category:'territory', days:1, risk:7, cost:{money:250,volunteers:2,organization:1,politicalCapital:0}, effect:.8, visibility:.4, preparation:0, scope:'focused', detail:'Funziona meglio dove la presenza è debole.', saturation:.03},
  {source:'simulation',id:'territory_campaign', label:'Campagna sul territorio', category:'territory', days:3, risk:9, cost:{money:2100,volunteers:6,organization:5,politicalCapital:1}, effect:1.35, visibility:1.1, preparation:0, scope:'focused', detail:'Presidio coordinato di un’area per più giorni.', typeBonus:{regionale:1.15,politiche:1.05}, saturation:.04},
  {source:'simulation',id:'local_life', label:'Mercati, feste e volontariato', category:'territory', days:1, risk:3, cost:{money:150,volunteers:2,organization:1,politicalCapital:0}, effect:.5, visibility:.5, preparation:0, scope:'focused', detail:'Presenza nella vita quotidiana: poco clamore, molta fiducia. Rende soprattutto nei comuni e nelle aree meno urbane.', typeBonus:{comunale:1.3,regionale:1.05,politiche:.8,europee:.7}, reputation:.25, saturation:.05},
  {source:'simulation',id:'associations', label:'Associazioni e categorie', category:'territory', days:1, risk:10, cost:{money:300,volunteers:0,organization:1,politicalCapital:1}, effect:.7, visibility:.4, preparation:0, scope:'focused', detail:'Commercianti, agricoltori, sindacati, terzo settore: portano voti organizzati, ma chiedono impegni.', commitment:true, saturation:.06},
  {source:'simulation',id:'public_event', label:'Evento pubblico', category:'event', days:2, risk:12, cost:{money:1550,volunteers:5,organization:3,politicalCapital:2}, effect:.9, visibility:2.2, preparation:0, scope:'focused', detail:'Può generare copertura e nuove richieste.', saturation:.04},
  {source:'simulation',id:'rally', label:'Comizio', category:'event', days:3, risk:22, cost:{money:4200,volunteers:8,organization:5,politicalCapital:4}, effect:1.25, visibility:4, preparation:0, scope:'focused', detail:'Alta esposizione e maggiore rischio di contestazioni: rende di più a fine campagna.', phaseBonus:{apertura:.85,finale:1.2,ballottaggio:1.15}, typeBonus:{politiche:1.1,europee:1.1,comunale:.95}, saturation:.05},
  {source:'simulation',id:'leader_visit', label:'Iniziativa con il leader del partito', category:'event', days:2, risk:16, cost:{money:1500,volunteers:3,organization:2,politicalCapital:4}, effect:1.1, visibility:5, preparation:0, scope:'focused', requires:'party', detail:'Il volto nazionale porta folla e telecamere; se il partito è in calo nei sondaggi l’effetto si ribalta.', usesPartyTrend:true, typeBonus:{politiche:1.15,europee:1.15,regionale:1.05,comunale:.9}, saturation:.12},
  {source:'simulation',id:'coalition_event', label:'Evento di coalizione', category:'event', days:2, risk:10, cost:{money:900,volunteers:3,organization:2,politicalCapital:2}, effect:.8, visibility:2.5, preparation:0, scope:'focused', requires:'alliance', detail:'Palco condiviso con gli alleati: consolida l’accordo e somma gli elettorati.', coalition:true, saturation:.08},
  {source:'simulation',id:'party_meeting', label:'Riunione del partito', category:'internal', days:1, risk:6, cost:{money:250,volunteers:1,organization:2,politicalCapital:0}, effect:.12, visibility:0, internalSupport:4, listPosition:1, preparation:0, scope:'internal', detail:'Costruisce sostegno alla candidatura e alla posizione in lista.'},
  {source:'simulation',id:'list_building', label:'Costruzione della lista', category:'internal', days:2, risk:12, cost:{money:950,volunteers:2,organization:5,politicalCapital:2}, effect:.2, visibility:.2, internalSupport:2, listPosition:2, preparation:0, scope:'internal', detail:'Migliora l’organizzazione e la posizione elettorale.'},
  {source:'simulation',id:'ally_meeting', label:'Incontro con alleati', category:'internal', days:2, risk:14, cost:{money:600,volunteers:1,organization:3,politicalCapital:3}, effect:.15, visibility:0, internalSupport:2, preparation:0, scope:'internal', detail:'Apre una trattativa politica; l’accordo non è garantito.'},
  {source:'simulation',id:'territorial_pact', label:'Accordo territoriale', category:'internal', days:2, risk:12, cost:{money:400,volunteers:0,organization:2,politicalCapital:3}, effect:.9, visibility:.6, preparation:0, scope:'focused', detail:'Intesa con amministratori, liste civiche e reti locali di un’area: può fallire o costare concessioni.', pact:true, electionTypes:['comunale','regionale','politiche'], saturation:.1},
  {source:'simulation',id:'volunteer_training', label:'Formazione dei volontari', category:'internal', days:1, risk:3, cost:{money:400,volunteers:0,organization:1,politicalCapital:0}, effect:0, visibility:0, preparation:0, scope:'internal', detail:'Non sposta voti oggi: più volontari e organizzazione per le settimane decisive.', training:true, phaseBonus:{apertura:1.3,finale:.6,ballottaggio:.5}, saturation:.15},
  {source:'simulation',id:'fundraising', label:'Raccolta fondi', category:'resources', days:1, risk:10, cost:{money:0,volunteers:1,organization:1,politicalCapital:0}, effect:.1, visibility:.5, moneyGain:1900, preparation:0, scope:'any', detail:'Raccoglie risorse con rendimenti incerti ma tracciati come simulazione: rende di più all’inizio.', phaseBonus:{apertura:1.25,finale:.8}},
  {source:'simulation',id:'fundraising_dinner', label:'Cena di raccolta fondi', category:'resources', days:1, risk:18, cost:{money:300,volunteers:1,organization:2,politicalCapital:1}, effect:0, visibility:1, moneyGain:4200, preparation:0, scope:'any', detail:'Grandi donatori e imprenditori: molti fondi, ma se la stampa guarda chi c’era la reputazione ne risente.', phaseBonus:{apertura:1.2,finale:.85}, saturation:.2},
  {source:'simulation',id:'interview', label:'Intervista', category:'media', days:1, risk:21, cost:{money:350,volunteers:0,organization:1,politicalCapital:1}, effect:.45, visibility:5, preparation:0, scope:'media', detail:'Amplifica il messaggio e può aprire una polemica.', saturation:.04},
  {source:'simulation',id:'debate', label:'Dibattito', category:'media', days:1, risk:19, cost:{money:250,volunteers:1,organization:3,politicalCapital:2}, effect:.55, visibility:4, preparation:0, scope:'debate', detail:'Esito legato a preparazione, pressione e avversario simulato: più decisivo nelle ultime settimane.', phaseBonus:{apertura:.8,finale:1.25,ballottaggio:1.3}},
  {source:'simulation',id:'debate_prep', label:'Preparazione al confronto', category:'internal', days:1, risk:2, cost:{money:180,volunteers:0,organization:1,politicalCapital:0}, effect:0, visibility:0, preparation:8, scope:'debate', detail:'Prepara un tema per un confronto; non produce consenso immediato.'},
  {source:'simulation',id:'press_conference', label:'Conferenza stampa', category:'media', days:1, risk:25, cost:{money:700,volunteers:1,organization:2,politicalCapital:2}, effect:.45, visibility:6, preparation:0, scope:'media', detail:'Grande copertura, domande e conseguenze non sempre favorevoli.', saturation:.05},
  {source:'simulation',id:'social', label:'Comunicazione social', category:'media', days:1, risk:15, cost:{money:180,volunteers:0,organization:1,politicalCapital:1}, effect:.35, visibility:7, preparation:0, scope:'media', detail:'Rapida e mirata; i risultati dipendono dalla credibilità.', saturation:.06},
  {source:'simulation',id:'national_media', label:'Comunicazione nazionale', category:'media', days:2, risk:20, cost:{money:2350,volunteers:1,organization:3,politicalCapital:3}, effect:.62, visibility:8, preparation:0, scope:'national', detail:'Aiuta a superare i confini locali, ma costa risorse.', typeBonus:{politiche:1.15,europee:1.2,comunale:.7}, saturation:.05},
  {source:'simulation',id:'territorial_media', label:'Comunicazione territoriale', category:'media', days:1, risk:12, cost:{money:450,volunteers:1,organization:1,politicalCapital:1}, effect:.62, visibility:3, preparation:0, scope:'focused', detail:'Rafforza la presenza in un’area scelta.', saturation:.05},
  {source:'simulation',id:'issue_focus', label:'Focus su un tema', category:'media', days:2, risk:11, cost:{money:900,volunteers:1,organization:2,politicalCapital:1}, effect:.7, visibility:3, preparation:4, scope:'national', detail:'Proposte, dati e testimonianze su una priorità: rende molto se il tema è al centro dell’agenda, poco se non lo è.', topic:true, saturation:.08},
  {source:'simulation',id:'endorsement', label:'Chiedere un sostegno pubblico', category:'media', days:1, risk:14, cost:{money:0,volunteers:0,organization:1,politicalCapital:2}, effect:.9, visibility:3, preparation:0, scope:'focused', detail:'Sindaci, figure civiche, associazioni: un sì porta credibilità, un no fa notizia. Serve una reputazione solida.', endorsement:true, requires:'reputation', saturation:.12},
  {source:'simulation',id:'comparison', label:'Confronto con un avversario', category:'media', days:1, risk:24, cost:{money:600,volunteers:0,organization:1,politicalCapital:2}, effect:.8, visibility:4, preparation:0, scope:'rival', detail:'Metti a confronto programmi e risultati con un rivale: i voti arrivano soprattutto da lui, ma i toni duri possono ritorcersi contro.', rival:true, saturation:.07},
  {source:'simulation',id:'claim_record', label:'Rivendicare i risultati', category:'media', days:1, risk:14, cost:{money:500,volunteers:0,organization:1,politicalCapital:1}, effect:.8, visibility:3, preparation:0, scope:'national', requires:'incumbent', detail:'Da chi governa: i risultati ottenuti come argomento. Funziona se i cittadini sono soddisfatti, altrimenti si ritorce contro.', mood:'incumbent', saturation:.1},
  {source:'simulation',id:'protest_campaign', label:'Campagna sul malcontento', category:'media', days:1, risk:16, cost:{money:400,volunteers:2,organization:1,politicalCapital:1}, effect:.8, visibility:3, preparation:0, scope:'national', requires:'challenger', detail:'Da chi sfida: raccolta firme e iniziative sui problemi irrisolti. Rende quando il clima è teso, poco quando il Paese è sereno.', mood:'challenger', saturation:.1},
  {source:'simulation',id:'posters', label:'Manifesti e affissioni', category:'ads', days:1, risk:6, cost:{money:1800,volunteers:2,organization:1,politicalCapital:0}, effect:.4, visibility:2.5, preparation:0, scope:'broad', detail:'Presenza visiva ovunque: poco per volta, ma su tutto il territorio. Si esaurisce se ripetuta.', typeBonus:{comunale:1.1,europee:.85}, saturation:.12},
  {source:'simulation',id:'local_ads', label:'Pubblicità su giornali e radio locali', category:'ads', days:1, risk:8, cost:{money:3500,volunteers:0,organization:1,politicalCapital:0}, effect:.6, visibility:4, preparation:0, scope:'broad', detail:'Spazi a pagamento: costano, ma raggiungono chi non segue la politica.', typeBonus:{regionale:1.1,politiche:1.05}, saturation:.1},
  {source:'simulation',id:'social_ads', label:'Campagna social sponsorizzata', category:'ads', days:1, risk:13, cost:{money:1200,volunteers:0,organization:1,politicalCapital:0}, effect:.55, visibility:5, preparation:0, scope:'broad', detail:'Messaggi mirati per età e interessi: rende nelle aree urbane e tra i giovani; un contenuto sbagliato diventa virale nel modo sbagliato.', urban:true, saturation:.1},
  {source:'simulation',id:'crisis_response', label:'Gestione della crisi', category:'media', days:1, risk:9, cost:{money:500,volunteers:0,organization:1,politicalCapital:2}, effect:0, visibility:2, preparation:0, scope:'media', requires:'crisis', detail:'Spiega, chiarisci, prendi le distanze: attenua la polemica in corso prima che pesi sul voto.', crisis:true},
  {source:'simulation',id:'get_out_vote', label:'Mobilitazione al voto', category:'territory', days:2, risk:5, cost:{money:900,volunteers:6,organization:3,politicalCapital:1}, effect:1, visibility:.5, preparation:0, scope:'broad', phases:['finale','ballottaggio'], detail:'Telefonate, passaggi ai seggi, reti di volontari: porta alle urne chi ti sostiene già. Solo negli ultimi giorni.', gotv:true, saturation:.1}
]);

export const DEBATE_TOPICS = Object.freeze([
  {source:'simulation',id:'lavoro',label:'Lavoro e sviluppo'},
  {source:'simulation',id:'servizi',label:'Servizi e comunità'},
  {source:'simulation',id:'ambiente',label:'Territorio e ambiente'},
  {source:'simulation',id:'istituzioni',label:'Istituzioni e fiducia'},
  {source:'simulation',id:'sanita',label:'Sanità'},
  {source:'simulation',id:'sicurezza',label:'Sicurezza'},
  {source:'simulation',id:'costo-vita',label:'Costo della vita'},
  {source:'simulation',id:'giovani',label:'Giovani e istruzione'}
]);

// Campaign events: drawn by weight among those whose condition holds, never the same one twice in a short time.
// Effects keys: money, volunteers, organization, politicalCapital (resources), visibility, notoriety, reputation,
// internalSupport, support (with territory: 'weakest' | 'strongest' | 'focus'), rivalSupport (moves votes from the
// strongest rival), crisis (opens or closes a controversy), topic (changes the salient topic), commitment.
export const CAMPAIGN_EVENTS = Object.freeze([
  {id:'maltempo', weight:1, cooldown:14, title:'Maltempo sul programma', body:'Pioggia e allerta meteo: l’appuntamento all’aperto rischia di andare deserto.', choices:[
    {id:'indoor',label:'Sposta tutto al chiuso',effects:{money:-500,organization:-1}},
    {id:'cancel',label:'Annulla e rimanda',effects:{volunteers:-1,visibility:-1}}]},
  {id:'fake-news', weight:.9, cooldown:21, when:'notoriety', title:'Una notizia falsa ti riguarda', body:'Circola una notizia inventata su un tuo presunto conflitto di interessi. Smentire la amplifica, ignorarla la lascia correre.', choices:[
    {id:'deny',label:'Smentisci con i documenti',effects:{politicalCapital:-1,visibility:2,reputation:.4}},
    {id:'legal',label:'Annuncia una querela',effects:{money:-800,reputation:.6,visibility:1}},
    {id:'ignore',label:'Non rispondere',effects:{reputation:-1,crisis:'open'}}]},
  {id:'gaffe-rivale', weight:1, cooldown:21, title:'Un passo falso dell’avversario', body:'Il candidato più forte è in difficoltà per una frase infelice. Puoi approfittarne o restare sui contenuti.', choices:[
    {id:'exploit',label:'Attacca subito',effects:{rivalSupport:.8,visibility:2,reputation:-.4}},
    {id:'above',label:'Resta sui contenuti',effects:{reputation:.7}}]},
  {id:'sondaggio-locale', weight:1.1, cooldown:14, title:'Un sondaggio locale: corsa aperta', body:'Una rilevazione commissionata dalla stampa locale indica una partita aperta nell’area dove sei più debole.', choices:[
    {id:'push',label:'Concentra lì la prossima settimana',effects:{money:-400,support:.5,territory:'weakest'}},
    {id:'hold',label:'Mantieni il piano',effects:{organization:1}}]},
  {id:'richiesta-categoria', weight:1, cooldown:21, title:'Le categorie chiedono impegni', body:'Un’associazione di categoria chiede un impegno scritto su tasse locali e burocrazia in cambio del sostegno.', choices:[
    {id:'sign',label:'Firma l’impegno',effects:{support:.6,territory:'focus',commitment:1,reputation:-.2}},
    {id:'refuse',label:'Nessuna promessa su misura',effects:{reputation:.5,support:-.2,territory:'focus'}}]},
  {id:'volontari', weight:.9, cooldown:21, when:'momentum', title:'Nuovi volontari si fanno avanti', body:'Dopo una buona settimana, decine di persone chiedono di dare una mano.', choices:[
    {id:'organize',label:'Organizza una squadra',effects:{volunteers:4,organization:1,money:-200}},
    {id:'free',label:'Lasciali partecipare liberamente',effects:{volunteers:2}}]},
  {id:'scandalo-lista', weight:.7, cooldown:35, unique:true, when:'party', title:'Un candidato della lista finisce sotto inchiesta', body:'Un nome della tua lista è indagato. La stampa chiede se resterà in lista.', choices:[
    {id:'distance',label:'Chiedi il ritiro della candidatura',effects:{internalSupport:-1,reputation:.4}},
    {id:'defend',label:'Garantismo: resta in lista',effects:{internalSupport:.8,reputation:-1.2,crisis:'open'}}]},
  {id:'leader-nazionale', weight:.8, cooldown:28, when:'party', title:'Il partito propone una visita del leader', body:'La segreteria nazionale offre una tappa del leader nel tuo territorio.', choices:[
    {id:'accept',label:'Accetta la tappa',effects:{visibility:4,support:.4,territory:'focus',partyTrend:true}},
    {id:'decline',label:'Preferisci una campagna tua',effects:{internalSupport:-.6,reputation:.2}}]},
  {id:'invito-tv', weight:.9, cooldown:21, when:'nominated', title:'Invito a un confronto televisivo', body:'Una rete regionale organizza un confronto tra i candidati. Chi non va, lascia la scena agli altri.', choices:[
    {id:'go',label:'Accetta il confronto',effects:{visibility:4,debateRoll:true}},
    {id:'skip',label:'Declina l’invito',effects:{reputation:-.5,rivalGain:.3}}]},
  {id:'dati-campagna', weight:.5, cooldown:42, unique:true, title:'Un problema con i dati della campagna', body:'Un fornitore segnala un accesso non autorizzato alle liste dei contatti dei volontari.', choices:[
    {id:'secure',label:'Metti in sicurezza e informa tutti',effects:{money:-1200,reputation:.4}},
    {id:'minimize',label:'Minimizza',effects:{reputation:-.8,crisis:'open'}}]},
  {id:'tema-emergente', weight:.9, cooldown:28, title:'Un nuovo tema domina l’agenda', body:'Un fatto di cronaca porta un tema diverso al centro della campagna. Inseguire l’agenda costa, ignorarla anche.', choices:[
    {id:'align',label:'Adegua il messaggio',effects:{topic:'new',organization:-1,visibility:1}},
    {id:'stay',label:'Resta sulle tue priorità',effects:{topic:'new',reputation:.2}}]},
  {id:'video-virale', weight:.8, cooldown:21, when:'media', title:'Un tuo video diventa virale', body:'Un passaggio di un tuo intervento sta girando molto. Puoi cavalcarlo o lasciarlo correre.', choices:[
    {id:'ride',label:'Rilancialo sui social',effects:{visibility:5,notoriety:1.5,riskRoll:.3}},
    {id:'leave',label:'Lascialo correre da solo',effects:{visibility:2}}]},
  {id:'sindaci-patto', weight:.7, cooldown:28, when:'notComunale', title:'Alcuni amministratori propongono un patto', body:'Un gruppo di sindaci e consiglieri dell’area più contesa offre sostegno in cambio di attenzione ai loro territori.', choices:[
    {id:'accept',label:'Stringi il patto',effects:{politicalCapital:-2,support:.8,territory:'weakest',commitment:1}},
    {id:'decline',label:'Nessun accordo',effects:{reputation:.2}}]},
  {id:'sciopero', weight:.6, cooldown:35, title:'Sciopero dei trasporti nel giorno del tuo evento', body:'I mezzi pubblici si fermano proprio quando avevi convocato i sostenitori.', choices:[
    {id:'shuttle',label:'Organizza navette',effects:{money:-700,volunteers:-1,visibility:1}},
    {id:'online',label:'Sposta l’evento online',effects:{visibility:-1,organization:1}}]},
  {id:'donatore', weight:.6, cooldown:35, title:'Un grande donatore offre un contributo', body:'Un imprenditore della zona offre un contributo importante. Qualcuno ti avverte: vorrà qualcosa in cambio.', choices:[
    {id:'take',label:'Accetta il contributo',effects:{money:3000,reputation:-.5,commitment:1}},
    {id:'refuse',label:'Rifiuta con garbo',effects:{reputation:.4}}]},
  {id:'crisi-organizzativa', weight:.8, cooldown:21, when:'lowOrganization', title:'La macchina organizzativa è sotto pressione', body:'I coordinamenti chiedono tempo e persone. Se non intervieni, alcuni appuntamenti perderanno efficacia.', choices:[
    {id:'repair',label:'Riorganizza la squadra',effects:{money:-600,organization:4,volunteers:-1}},
    {id:'continue',label:'Mantieni il programma',effects:{organization:-2,reputation:-.5}}]}
]);

// How an election ends for the player, beyond winning and losing.
export const OUTCOME_LABELS = Object.freeze({
  vittoria:{label:'Vittoria',tone:'good'}, 'ballottaggio-vinto':{label:'Vittoria al ballottaggio',tone:'good'},
  eletto:{label:'Eletto',tone:'good'}, 'eletto-lista':{label:'Eletto grazie alla lista',tone:'good'}, 'eletto-coalizione':{label:'Eletto grazie alla coalizione',tone:'good'},
  'eletto-proporzionale':{label:'Collegio perso, eletto nel proporzionale',tone:'good'}, 'eletto-opposizione':{label:'Sconfitto, ma entri in consiglio all’opposizione',tone:'neutral'},
  'ballottaggio-perso':{label:'Sconfitto al ballottaggio',tone:'bad'}, 'non-eletto':{label:'Non eletto: preferenze insufficienti',tone:'bad'}, 'primo-non-eletto':{label:'Primo dei non eletti',tone:'bad'},
  'posizione-lista':{label:'Non eletto: posizione in lista non utile',tone:'bad'}, 'sotto-soglia':{label:'Lista sotto la soglia di sbarramento',tone:'bad'},
  sconfitta:{label:'Sconfitta',tone:'bad'}, escluso:{label:'Escluso dalla candidatura',tone:'bad'}
});

// Simplified seat rules of the game, inspired by the real systems (declared as simplifications in the results).
export const SEAT_RULES = Object.freeze({
  comunale:{threshold:3, majorityBonus:{'fino-15000':2/3,'oltre-15000':.6}, note:'Regola semplificata: soglia del 3% per le liste, premio di maggioranza alla lista del sindaco eletto (2/3 dei seggi fino a 15.000 abitanti, 60% oltre), i candidati sindaci sconfitti con seggi alla propria lista entrano in consiglio.'},
  regionale:{threshold:3, majorityBonus:.55, note:'Regola semplificata: soglia del 3%, premio di maggioranza al 55% dei seggi per chi vince la presidenza, il secondo candidato presidente entra in consiglio.'},
  politiche:{threshold:3, note:'Regola semplificata: collegi uninominali (37% dei seggi) e riparto proporzionale con soglia del 3%; nel proporzionale le liste sono bloccate e conta la posizione in lista.'},
  europee:{threshold:4, note:'Soglia del 4% (dato reale verificato); nelle circoscrizioni contano le preferenze.'}
});

export const EUROPEAN_THRESHOLD = Object.freeze({
  percent:4, source:'real', verified:true, sourceUrl:'https://dait.interno.gov.it/documenti/dossier-elezioni-europee-2024.pdf',
  sourceName:'Ministero dell’Interno — dossier elezioni europee 2024', verifiedAt:'2026-09-22', validFrom:null, validTo:null
});

export const EUROPEAN_THRESHOLD_SOURCE = EUROPEAN_THRESHOLD;

// The Italian regions of each European constituency (real grouping, law 18/1979, table A).
export const EUROPEAN_CONSTITUENCIES = Object.freeze({
  'nord-occidentale':['Piemonte','Valle d’Aosta','Liguria','Lombardia'],
  'nord-orientale':['Veneto','Trentino-Alto Adige','Friuli-Venezia Giulia','Emilia-Romagna'],
  'centrale':['Toscana','Umbria','Marche','Lazio'],
  'meridionale':['Abruzzo','Molise','Campania','Puglia','Basilicata','Calabria'],
  'insulare':['Sicilia','Sardegna']
});
