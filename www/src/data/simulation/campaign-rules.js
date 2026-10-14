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
  // A second-level vote (law 56/2014): the electorate is made of the mayors and the municipal councillors of the province,
  // weighted by the population of their comune; the lists, the President and the council come out of a few weeks of
  // negotiation among administrators, not of rallies. The reference is the law; the weights and the rest are the game's.
  provinciale: Object.freeze({
    source:'simulation',
    label:'Provinciali', campaignDays:28, nominationDays:7, model:'provincial-second-level', seatCount:12,
    territorialMode:'province-areas', strategy:'Votano sindaci e consiglieri comunali, con un peso che cresce con la popolazione del loro comune: contano la rete tra gli amministratori, le liste civiche e i comitati.',
    referenceUrl:'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2014-04-07;56',
    referenceName:'Legge 7 aprile 2014, n. 56 (legge Delrio)', referenceVerified:false
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
    pros:'Trattative più facili e voti degli alleati che si sommano ai tuoi.',cons:'La tua lista pesa meno dentro la coalizione e una parte del partito lo digerisce male.'},
  // The strategies of the two weeks between the rounds: they exist only there. `runoff` says how they weigh on the voters of the
  // candidates who are out (transfer), on the turnout of the own voters (turnout) and on the vote against the other finalist (against).
  apparentamenti:{source:'simulation',label:'Cercare gli apparentamenti',short:'Apparentamenti',icon:'link',stages:['ballottaggio'],detail:'Tra i due turni cerchi gli esclusi: accordi, impegni e posti in giunta in cambio dei loro elettori.',
    mods:{territory:.95,internal:1.2,event:1,media:1,ads:.95,resources:1},risk:1,volatility:1,allianceBonus:20,runoff:{transfer:1.25,turnout:.92,against:1},
    pros:'Gli elettori degli esclusi ti seguono di più e le loro liste entrano nella tua maggioranza.',cons:'Ogni accordo ha un prezzo: impegni, posti in giunta e un po’ di identità.'},
  mobilitazione:{source:'simulation',label:'Mobilitare i tuoi elettori',short:'Mobilitazione',icon:'users',stages:['ballottaggio'],detail:'Al ballottaggio vota meno gente: vince chi riporta alle urne i suoi. Volontari, telefonate, passaggi ai seggi.',
    mods:{territory:1.2,internal:1,event:.95,media:.9,ads:.9,resources:1},risk:.9,volatility:.95,runoff:{transfer:.88,turnout:1.55,against:1},
    pros:'I tuoi elettori restano e votano; rende molto se l’organizzazione è solida.',cons:'Chiedi poco agli altri: gli elettori degli esclusi si astengono più spesso.'},
  'voto-utile':{source:'simulation',label:'Il voto utile contro l’avversario',short:'Voto utile',icon:'split',stages:['ballottaggio'],detail:'Un appello netto: «o noi o loro». Convince chi voleva fermare l’altro finalista, ma polarizza e rischia di respingere gli altri.',
    mods:{territory:.95,internal:1,event:1.05,media:1.15,ads:1.05,resources:1},risk:1.2,volatility:1.25,runoff:{transfer:1.1,turnout:1,against:1.35},
    pros:'Raccoglie chi non vuole l’altro finalista, anche tra gli esclusi che non ti amano.',cons:'Più incertezza e toni duri: se la reputazione è fragile ti si ritorce contro.'}
});

// Costs are game values, in euro/resources and game-days. No real campaign finance totals are asserted or imported
// here. Every activity can also carry: electionTypes (where it exists), requires (condition), phaseBonus and
// typeBonus (how well it works in a phase or kind of election), saturation (repeating it yields less).
export const CAMPAIGN_ACTIVITIES = Object.freeze([
  {source:'simulation',id:'citizen_meeting', label:'Incontro con cittadini', category:'territory', days:1, risk:5, cost:{money:350,volunteers:1,organization:1,politicalCapital:0}, effect:.55, visibility:.6, preparation:0, scope:'focused', detail:'Ascolto diretto, impatto locale e graduale.', typeBonus:{provinciale:1.5,comunale:1.2,europee:.8}, saturation:.04},
  {source:'simulation',id:'door_to_door', label:'Porta a porta', category:'territory', days:2, risk:4, cost:{money:650,volunteers:4,organization:3,politicalCapital:0}, effect:1.15, visibility:.2, preparation:0, scope:'focused', detail:'Richiede una rete di volontari sul posto: rende di più nel rush finale e nei comuni.', phaseBonus:{apertura:.85,finale:1.3,ballottaggio:1.35}, typeBonus:{provinciale:0.15,comunale:1.25,regionale:1.05,politiche:.85,europee:.75}, saturation:.03},
  {source:'simulation',id:'local_visit', label:'Visita locale', category:'territory', days:1, risk:7, cost:{money:250,volunteers:2,organization:1,politicalCapital:0}, effect:.8, visibility:.4, preparation:0, scope:'focused', detail:'Funziona meglio dove la presenza è debole.', saturation:.03, typeBonus:{provinciale:1.3}},
  {source:'simulation',id:'territory_campaign', label:'Campagna sul territorio', category:'territory', days:3, risk:9, cost:{money:2100,volunteers:6,organization:5,politicalCapital:1}, effect:1.35, visibility:1.1, preparation:0, scope:'focused', detail:'Presidio coordinato di un’area per più giorni.', typeBonus:{provinciale:0.9,regionale:1.15,politiche:1.05}, saturation:.04},
  {source:'simulation',id:'local_life', label:'Mercati, feste e volontariato', category:'territory', days:1, risk:3, cost:{money:150,volunteers:2,organization:1,politicalCapital:0}, effect:.5, visibility:.5, preparation:0, scope:'focused', detail:'Presenza nella vita quotidiana: poco clamore, molta fiducia. Rende soprattutto nei comuni e nelle aree meno urbane.', typeBonus:{provinciale:0.4,comunale:1.3,regionale:1.05,politiche:.8,europee:.7}, reputation:.25, saturation:.05},
  {source:'simulation',id:'associations', label:'Associazioni e categorie', category:'territory', days:1, risk:10, cost:{money:300,volunteers:0,organization:1,politicalCapital:1}, effect:.7, visibility:.4, preparation:0, scope:'focused', detail:'Commercianti, agricoltori, sindacati, terzo settore: portano voti organizzati, ma chiedono impegni.', commitment:true, saturation:.06, typeBonus:{provinciale:1.3}},
  {source:'simulation',id:'public_event', label:'Evento pubblico', category:'event', days:2, risk:12, cost:{money:1550,volunteers:5,organization:3,politicalCapital:2}, effect:.9, visibility:2.2, preparation:0, scope:'focused', detail:'Può generare copertura e nuove richieste.', saturation:.04, typeBonus:{provinciale:0.5}},
  {source:'simulation',id:'rally', label:'Comizio', category:'event', days:3, risk:22, cost:{money:4200,volunteers:8,organization:5,politicalCapital:4}, effect:1.25, visibility:4, preparation:0, scope:'focused', detail:'Alta esposizione e maggiore rischio di contestazioni: rende di più a fine campagna.', phaseBonus:{apertura:.85,finale:1.2,ballottaggio:1.15}, typeBonus:{provinciale:0.2,politiche:1.1,europee:1.1,comunale:.95}, saturation:.05},
  {source:'simulation',id:'leader_visit', label:'Iniziativa con il leader del partito', category:'event', days:2, risk:16, cost:{money:1500,volunteers:3,organization:2,politicalCapital:4}, effect:1.1, visibility:5, preparation:0, scope:'focused', requires:'party', detail:'Il volto nazionale porta folla e telecamere; se il partito è in calo nei sondaggi l’effetto si ribalta.', usesPartyTrend:true, typeBonus:{provinciale:1.1,politiche:1.15,europee:1.15,regionale:1.05,comunale:.9}, saturation:.12},
  {source:'simulation',id:'coalition_event', label:'Evento di coalizione', category:'event', days:2, risk:10, cost:{money:900,volunteers:3,organization:2,politicalCapital:2}, effect:.8, visibility:2.5, preparation:0, scope:'focused', requires:'alliance', detail:'Palco condiviso con gli alleati: consolida l’accordo e somma gli elettorati.', coalition:true, saturation:.08},
  {source:'simulation',id:'party_meeting', label:'Riunione del partito', category:'internal', days:1, risk:6, cost:{money:250,volunteers:1,organization:2,politicalCapital:0}, effect:.12, visibility:0, internalSupport:4, listPosition:1, preparation:0, scope:'internal', detail:'Costruisce sostegno alla candidatura e alla posizione in lista.'},
  {source:'simulation',id:'list_building', label:'Costruzione della lista', category:'internal', days:2, risk:12, cost:{money:950,volunteers:2,organization:5,politicalCapital:2}, effect:.2, visibility:.2, internalSupport:2, listPosition:2, preparation:0, scope:'internal', detail:'Migliora l’organizzazione e la posizione elettorale.'},
  {source:'simulation',id:'ally_meeting', label:'Incontro con alleati', category:'internal', days:2, risk:14, cost:{money:600,volunteers:1,organization:3,politicalCapital:3}, effect:.15, visibility:0, internalSupport:2, preparation:0, scope:'internal', detail:'Apre una trattativa politica; l’accordo non è garantito.'},
  {source:'simulation',id:'territorial_pact', label:'Accordo territoriale', category:'internal', days:2, risk:12, cost:{money:400,volunteers:0,organization:2,politicalCapital:3}, effect:.9, visibility:.6, preparation:0, scope:'focused', detail:'Intesa con amministratori, liste civiche e reti locali di un’area: può fallire o costare concessioni.', pact:true, electionTypes:['comunale','provinciale','regionale','politiche'], typeBonus:{provinciale:1.8}, saturation:.1},
  {source:'simulation',id:'volunteer_training', label:'Formazione dei volontari', category:'internal', days:1, risk:3, cost:{money:400,volunteers:0,organization:1,politicalCapital:0}, effect:0, visibility:0, preparation:0, scope:'internal', detail:'Non sposta voti oggi: più volontari e organizzazione per le settimane decisive.', training:true, phaseBonus:{apertura:1.3,finale:.6,ballottaggio:.5}, saturation:.15},
  {source:'simulation',id:'fundraising', label:'Raccolta fondi', category:'resources', days:1, risk:10, cost:{money:0,volunteers:1,organization:1,politicalCapital:0}, effect:.1, visibility:.5, moneyGain:1900, preparation:0, scope:'any', detail:'Raccoglie risorse con rendimenti incerti ma tracciati come simulazione: rende di più all’inizio.', phaseBonus:{apertura:1.25,finale:.8}},
  {source:'simulation',id:'fundraising_dinner', label:'Cena di raccolta fondi', category:'resources', days:1, risk:18, cost:{money:300,volunteers:1,organization:2,politicalCapital:1}, effect:0, visibility:1, moneyGain:4200, preparation:0, scope:'any', detail:'Grandi donatori e imprenditori: molti fondi, ma se la stampa guarda chi c’era la reputazione ne risente.', phaseBonus:{apertura:1.2,finale:.85}, saturation:.2},
  {source:'simulation',id:'interview', label:'Intervista', category:'media', days:1, risk:21, cost:{money:350,volunteers:0,organization:1,politicalCapital:1}, effect:.45, visibility:5, preparation:0, scope:'media', detail:'Amplifica il messaggio e può aprire una polemica.', saturation:.04, typeBonus:{provinciale:0.5}},
  {source:'simulation',id:'debate', label:'Dibattito', category:'media', days:1, risk:19, cost:{money:250,volunteers:1,organization:3,politicalCapital:2}, effect:.55, visibility:4, preparation:0, scope:'debate', detail:'Esito legato a preparazione, pressione e avversario simulato: più decisivo nelle ultime settimane.', phaseBonus:{apertura:.8,finale:1.25,ballottaggio:1.3}, typeBonus:{provinciale:0.5}},
  {source:'simulation',id:'debate_prep', label:'Preparazione al confronto', category:'internal', days:1, risk:2, cost:{money:180,volunteers:0,organization:1,politicalCapital:0}, effect:0, visibility:0, preparation:8, scope:'debate', detail:'Prepara un tema per un confronto; non produce consenso immediato.'},
  {source:'simulation',id:'press_conference', label:'Conferenza stampa', category:'media', days:1, risk:25, cost:{money:700,volunteers:1,organization:2,politicalCapital:2}, effect:.45, visibility:6, preparation:0, scope:'media', detail:'Grande copertura, domande e conseguenze non sempre favorevoli.', saturation:.05},
  {source:'simulation',id:'social', label:'Comunicazione social', category:'media', days:1, risk:15, cost:{money:180,volunteers:0,organization:1,politicalCapital:1}, effect:.35, visibility:7, preparation:0, scope:'media', detail:'Rapida e mirata; i risultati dipendono dalla credibilità.', saturation:.06, typeBonus:{provinciale:0.3}},
  {source:'simulation',id:'national_media', label:'Comunicazione nazionale', category:'media', days:2, risk:20, cost:{money:2350,volunteers:1,organization:3,politicalCapital:3}, effect:.62, visibility:8, preparation:0, scope:'national', detail:'Aiuta a superare i confini locali, ma costa risorse.', typeBonus:{provinciale:0.1,politiche:1.15,europee:1.2,comunale:.7}, saturation:.05},
  {source:'simulation',id:'territorial_media', label:'Comunicazione territoriale', category:'media', days:1, risk:12, cost:{money:450,volunteers:1,organization:1,politicalCapital:1}, effect:.62, visibility:3, preparation:0, scope:'focused', detail:'Rafforza la presenza in un’area scelta.', saturation:.05, typeBonus:{provinciale:0.6}},
  {source:'simulation',id:'issue_focus', label:'Focus su un tema', category:'media', days:2, risk:11, cost:{money:900,volunteers:1,organization:2,politicalCapital:1}, effect:.7, visibility:3, preparation:4, scope:'national', detail:'Proposte, dati e testimonianze su una priorità: rende molto se il tema è al centro dell’agenda, poco se non lo è.', topic:true, saturation:.08},
  {source:'simulation',id:'endorsement', label:'Chiedere un sostegno pubblico', category:'media', days:1, risk:14, cost:{money:0,volunteers:0,organization:1,politicalCapital:2}, effect:.9, visibility:3, preparation:0, scope:'focused', detail:'Sindaci, figure civiche, associazioni: un sì porta credibilità, un no fa notizia. Serve una reputazione solida.', endorsement:true, requires:'reputation', saturation:.12},
  {source:'simulation',id:'comparison', label:'Confronto con un avversario', category:'media', days:1, risk:24, cost:{money:600,volunteers:0,organization:1,politicalCapital:2}, effect:.8, visibility:4, preparation:0, scope:'rival', detail:'Metti a confronto programmi e risultati con un rivale: i voti arrivano soprattutto da lui, ma i toni duri possono ritorcersi contro.', rival:true, saturation:.07},
  {source:'simulation',id:'claim_record', label:'Rivendicare i risultati', category:'media', days:1, risk:14, cost:{money:500,volunteers:0,organization:1,politicalCapital:1}, effect:.8, visibility:3, preparation:0, scope:'national', requires:'incumbent', detail:'Da chi governa: i risultati ottenuti come argomento. Funziona se i cittadini sono soddisfatti, altrimenti si ritorce contro.', mood:'incumbent', saturation:.1},
  {source:'simulation',id:'protest_campaign', label:'Campagna sul malcontento', category:'media', days:1, risk:16, cost:{money:400,volunteers:2,organization:1,politicalCapital:1}, effect:.8, visibility:3, preparation:0, scope:'national', requires:'challenger', detail:'Da chi sfida: raccolta firme e iniziative sui problemi irrisolti. Rende quando il clima è teso, poco quando il Paese è sereno.', mood:'challenger', saturation:.1},
  {source:'simulation',id:'posters', label:'Manifesti e affissioni', category:'ads', days:1, risk:6, cost:{money:1800,volunteers:2,organization:1,politicalCapital:0}, effect:.4, visibility:2.5, preparation:0, scope:'broad', detail:'Presenza visiva ovunque: poco per volta, ma su tutto il territorio. Si esaurisce se ripetuta.', typeBonus:{provinciale:0.08,comunale:1.1,europee:.85}, saturation:.12},
  {source:'simulation',id:'local_ads', label:'Pubblicità su giornali e radio locali', category:'ads', days:1, risk:8, cost:{money:3500,volunteers:0,organization:1,politicalCapital:0}, effect:.6, visibility:4, preparation:0, scope:'broad', detail:'Spazi a pagamento: costano, ma raggiungono chi non segue la politica.', typeBonus:{provinciale:0.3,regionale:1.1,politiche:1.05}, saturation:.1},
  {source:'simulation',id:'social_ads', label:'Campagna social sponsorizzata', category:'ads', days:1, risk:13, cost:{money:1200,volunteers:0,organization:1,politicalCapital:0}, effect:.55, visibility:5, preparation:0, scope:'broad', detail:'Messaggi mirati per età e interessi: rende nelle aree urbane e tra i giovani; un contenuto sbagliato diventa virale nel modo sbagliato.', urban:true, saturation:.1, typeBonus:{provinciale:0.15}},
  {source:'simulation',id:'crisis_response', label:'Gestione della crisi', category:'media', days:1, risk:9, cost:{money:500,volunteers:0,organization:1,politicalCapital:2}, effect:0, visibility:2, preparation:0, scope:'media', requires:'crisis', detail:'Spiega, chiarisci, prendi le distanze: attenua la polemica in corso prima che pesi sul voto.', crisis:true},
  {source:'simulation',id:'crew_rest', label:'Giornata di riposo', category:'internal', days:1, risk:0, cost:{money:0,volunteers:0,organization:0,politicalCapital:0}, effect:0, visibility:0, preparation:0, scope:'internal', detail:'Le squadre si fermano e recuperano: meno fatica, più resa nei giorni decisivi. Un giorno senza campagna.', rest:true},
  {source:'simulation',id:'scouting', label:'Scouting dei candidati', category:'internal', days:2, risk:8, cost:{money:700,volunteers:1,organization:2,politicalCapital:2}, effect:0, visibility:.2, preparation:0, scope:'internal', detail:'Cerchi nomi forti sul territorio per la lista: una lista competitiva porta voti, ma i nomi forti fanno concorrenza anche a te nelle preferenze.', scouting:true, phases:['apertura'], saturation:.15},
  {source:'simulation',id:'list_negotiation', label:'Trattativa sulla lista', category:'internal', days:2, risk:12, cost:{money:300,volunteers:0,organization:2,politicalCapital:3}, effect:0, visibility:0, preparation:0, scope:'internal', detail:'Chi pesa nel partito e sul territorio chiede posti: puoi migliorare la tua posizione, ma ogni cessione ha un prezzo politico.', listNegotiation:true, requires:'party', phases:['apertura','centrale'], saturation:.2},
  {source:'simulation',id:'runoff_pact', label:'Apparentamento', category:'internal', days:1, risk:15, cost:{money:400,volunteers:0,organization:1,politicalCapital:3}, effect:.5, visibility:1.2, preparation:0, scope:'focused', detail:'Tra i due turni un candidato escluso può apparentarsi con te: porta gran parte dei suoi elettori e le sue liste in maggioranza, e chiede impegni e un posto in giunta.', runoffPact:true, phases:['ballottaggio'], saturation:.25},
  {source:'simulation',id:'appeal_eliminated', label:'Appello agli elettori degli esclusi', category:'media', days:1, risk:14, cost:{money:350,volunteers:1,organization:1,politicalCapital:1}, effect:.7, visibility:3, preparation:0, scope:'broad', detail:'Parli a chi ha votato i candidati usciti al primo turno: una parte può seguirti, se non li hai attaccati.', runoffAppeal:true, phases:['ballottaggio'], saturation:.12},
  {source:'simulation',id:'runoff_stance', label:'Indica per chi votare', category:'internal', days:1, risk:5, cost:{money:0,volunteers:0,organization:0,politicalCapital:1}, effect:0, visibility:1, preparation:0, scope:'internal', detail:'Non sei al ballottaggio: puoi indicare ai tuoi elettori per chi votare e trattare un posto per la tua lista e impegni sul programma.', runoffStance:true, phases:['ballottaggio']},
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
  {id:'squadra-stanca', weight:1.8, cooldown:14, when:'tired', title:'Le squadre sono stanche', body:'Giorni di fila sul campo: i volontari rendono meno, le uscite perdono mordente e qualcuno minaccia di mollare.', choices:[
    {id:'rest',label:'Fermati due giorni e fai riposare le squadre',effects:{rest:2,organization:1}},
    {id:'rotate',label:'Fai ruotare le squadre e paga un rimborso',effects:{money:-600,fatigue:-14,volunteers:-1}},
    {id:'push',label:'Spingi ancora fino al voto',effects:{reputation:-.4,fatigue:6,volunteers:-1}}]},
  {id:'volontari-esperti', weight:.7, cooldown:28, when:'momentum', title:'Arrivano volontari con esperienza', body:'Un gruppo di ex militanti e di operatori della comunicazione offre il proprio tempo: sanno come si fa una campagna.', choices:[
    {id:'train',label:'Inseriscili nelle squadre e fai fare formazione',effects:{money:-300,volunteers:3,quality:5}},
    {id:'free',label:'Lasciali lavorare in autonomia',effects:{volunteers:2,quality:2}}]},
  {id:'bilancio-mandato', weight:1.1, cooldown:35, unique:true, when:'incumbent', title:'Il bilancio del mandato finisce sui giornali', body:'Cronisti e avversari mettono a confronto promesse e risultati degli ultimi anni. Puoi rivendicare quello che è stato fatto o ammettere i ritardi e rilanciare.', choices:[
    {id:'claim',label:'Rivendica i risultati',effects:{record:.9,visibility:2}},
    {id:'admit',label:'Ammetti i ritardi e rilancia',effects:{record:.25,reputation:.5,visibility:1}}]},
  {id:'dossier-uscente', weight:1, cooldown:35, unique:true, when:'challenger-record', title:'Un dossier sulle promesse dell’amministrazione uscente', body:'Un comitato civico ha messo in fila impegni presi e risultati ottenuti da chi governa. Usarlo in campagna dipende da quanto regge.', choices:[
    {id:'use',label:'Usalo contro l’amministrazione uscente',effects:{recordAgainst:.9,visibility:2}},
    {id:'skip',label:'Resta sulle tue proposte',effects:{reputation:.4}}]},
  {id:'avversario-ricorda', weight:1.2, cooldown:42, unique:true, when:'recognized', title:'Un avversario che ti conosce', body:'Uno dei contendenti ha già incrociato la tua strada: ricorda come è andata l’ultima volta e te lo dice in pubblico. Puoi rispondere punto su punto o cercare un tono diverso.', choices:[
    {id:'answer',label:'Rispondi nel merito',effects:{recognizedRival:{relation:-2,transfer:.3},visibility:2}},
    {id:'truce',label:'Proponi una tregua dei toni',effects:{recognizedRival:{relation:8},reputation:.3}}]},
  {id:'crisi-organizzativa', weight:.8, cooldown:21, when:'lowOrganization', title:'La macchina organizzativa è sotto pressione', body:'I coordinamenti chiedono tempo e persone. Se non intervieni, alcuni appuntamenti perderanno efficacia.', choices:[
    {id:'repair',label:'Riorganizza la squadra',effects:{money:-600,organization:4,volunteers:-1}},
    {id:'continue',label:'Mantieni il programma',effects:{organization:-2,reputation:-.5}}]}
]);

// ---------- the crew: volunteers are teams, with a quality and a fatigue ----------
// Each team serves some kinds of activity. A team that is poorly trained or tired yields less (diminishing returns), risks more
// and, past the burnout threshold, loses people; rest and rotation bring the fatigue down, organisation makes it grow more slowly.
export const CREW_TEAMS = Object.freeze({
  field:{label:'Squadra di territorio', short:'Territorio', categories:['territory'], share:.5},
  media:{label:'Squadra comunicazione', short:'Comunicazione', categories:['media','ads'], share:.15},
  events:{label:'Squadra eventi', short:'Eventi', categories:['event'], share:.2},
  office:{label:'Squadra di segreteria', short:'Segreteria', categories:['internal','resources'], share:.15}
});
export const CREW_RULES = Object.freeze({
  quality:{base:50, min:10, max:100, perPoint:.003, floor:.85, learnPerWeek:.25, learnCap:8, trainGain:3, burnoutLoss:2},
  // load of an activity: days × (base + volunteers·volunteer + organisation·organization); spread over the team (size) and eased by organisation
  fatigue:{free:25, slope:.006, floor:.5, load:{base:1.5, volunteer:.9, organization:.4}, size:8, idleRecovery:2.4, workRecovery:.7, restRecovery:15, burnout:72, tired:55, risk:.1, attrition:.1},
  mobilization:{quality:.6, fatigue:.8, gotv:.35, gotvCap:1.2, climateIncumbent:.012, climateChallenger:.008, rivals:.6}
});

// ---------- incumbency: what a term leaves behind ----------
// The record of the administration (see mandateRecord in the local engine) weighs on the next vote for whoever leads or sits in it.
export const INCUMBENCY_RULES = Object.freeze({
  standing:{leader:1, majority:.5, opposition:-.4, former:.5},
  consensus:.05, consensusCap:4,              // points of strength at the start of the campaign per point of standing
  expectation:.04, expectationCap:2.5,
  nomination:.012, nominationCap:1.5,
  claim:{perPoint:.005, min:.6, max:1.25},   // how much "claim the record" is worth (per point of standing)
  dissolved:-25
});

// ---------- the lists: who stands with you, who competes, who decides ----------
export const LIST_RULES = Object.freeze({
  mates:{local:8, national:10, europee:12},
  strength:{vote:.08, voteCap:1.6},
  negotiation:{cost:{loyal:.4}},
  factions:['dirigenti','territorio','giovani','liste-civiche']
});

// ---------- endorsements: who backs you, why, what it costs and what is remembered ----------
export const ENDORSEMENT_KINDS = Object.freeze({
  sindaco:{label:'Un sindaco o un amministratore', weight:1.2, reach:'area', cost:'impegno', trust:'istituzionale'},
  categoria:{label:'Un’associazione di categoria', weight:1, reach:'area', cost:'impegno', trust:'economico'},
  sindacato:{label:'Un sindacato', weight:1, reach:'area', cost:'impegno', trust:'sociale'},
  civico:{label:'Una rete civica', weight:.8, reach:'area', cost:'autonomia', trust:'sociale'},
  media:{label:'Una testata o un opinionista', weight:.9, reach:'ampio', cost:'indipendenza', trust:'mediatico'},
  dirigente:{label:'Un dirigente del partito', weight:1.1, reach:'area', cost:'debito', trust:'interno'},
  escluso:{label:'Un candidato escluso', weight:1.3, reach:'ampio', cost:'accordo', trust:'politico'}
});
export const ENDORSEMENT_RULES = Object.freeze({
  maxOffers:3,
  // How likely each kind of subject is to come forward, by kind of election (a province votes with its mayors, a comune with its civic networks).
  weights:{
    comunale:{sindaco:.7, categoria:1, sindacato:.8, civico:1.4, media:.7, dirigente:.8},
    provinciale:{sindaco:2.2, categoria:.8, sindacato:.5, civico:.5, media:.3, dirigente:1},
    regionale:{sindaco:1.2, categoria:1.1, sindacato:1, civico:.8, media:.9, dirigente:1},
    politiche:{sindaco:.7, categoria:.9, sindacato:.9, civico:.6, media:1.3, dirigente:1.2},
    europee:{sindaco:.5, categoria:.9, sindacato:.9, civico:.6, media:1.3, dirigente:1.2}
  },
  relations:{sindaco:'civic', categoria:'business', sindacato:'unions', civico:'civic', media:'media', dirigente:'leadership'},
  motives:{ideale:'condividono le tue proposte', interesse:'cercano un posto o una garanzia', ostilita:'vogliono fermare un altro candidato', convenienza:'puntano sul vincitore', amicizia:'si fidano di te'}
});

// ---------- the runoff: two rounds, two weeks, a transfer of votes that is never complete ----------
export const RUNOFF_RULES = Object.freeze({
  turnoutDrop:-9, abstentionFloor:.1,
  transfer:{endorsed:.12, neutral:.34, pact:.1, min:.03, max:.9}
});

// ---------- the rivals between campaigns: the registry that outlives one vote ----------
export const RIVAL_PERSISTENCE = Object.freeze({
  limit:40, memoryLimit:10, halfLifeDays:540, dropWeight:.06, forgetYears:6,
  stances:[[25,'ostile'],[42,'freddo'],[60,'neutro'],[78,'cordiale'],[101,'alleato']],
  // What each kind of past episode is worth when the rival decides how to behave (see the campaign engine)
  campaign:{revenge:.35, confidence:.8, allied:.5, offer:.25, relation:70}
});

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
  provinciale:{threshold:0, majorityBonus:.58, note:'Regola semplificata: seggi proporzionali ai voti ponderati di sindaci e consiglieri comunali, senza soglia; la coalizione del Presidente eletto ha almeno il 58% dei seggi, perché nel gioco la presidenza governa con una maggioranza.'},
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

// The polls of a campaign: how many people each institute interviews for a race of this kind (a share of its national sample: a comune is
// polled on a few hundred interviews, a region on more, the whole country on the full panel) and how the waves follow the campaign.
export const CAMPAIGN_POLL_RULES = Object.freeze({
  sampleScale: { comunaleSmall: .3, comunale: .5, provinciale: .4, regionale: .7, politiche: 1, europee: 1 },
  everyDays: 7, waves: 14,
  // The rivals of a local race that stand without a party: a civic or independent candidacy (declared as such, never a made-up party).
  independents: { comunaleSmall: .55, comunale: .75, provinciale: .3, regionale: .25 }
});
// Which segments of the electorate an activity speaks to (segments of the simulated society: giovani, famiglie, anziani, imprese, fragili). The sum of
// the weights is 1: an activity done many times moves the audience of the candidate towards those segments (see the observatory of the campaign).
export const CAMPAIGN_AUDIENCE = Object.freeze({
  category: {
    territory: { famiglie: .35, anziani: .35, fragili: .15, imprese: .15 }, event: { famiglie: .3, giovani: .25, anziani: .25, imprese: .2 },
    media: { giovani: .35, famiglie: .35, imprese: .15, fragili: .15 }, ads: { famiglie: .3, giovani: .3, anziani: .25, fragili: .15 },
    internal: {}, resources: { imprese: 1 }
  },
  activity: {
    door_to_door: { anziani: .4, famiglie: .35, fragili: .25 }, local_life: { anziani: .45, famiglie: .4, fragili: .15 }, associations: { imprese: .45, fragili: .3, famiglie: .25 },
    social: { giovani: .6, famiglie: .25, fragili: .15 }, social_ads: { giovani: .6, famiglie: .25, fragili: .15 }, local_ads: { anziani: .4, famiglie: .4, imprese: .2 },
    posters: { anziani: .35, famiglie: .35, fragili: .3 }, interview: { famiglie: .4, anziani: .3, imprese: .3 }, national_media: { famiglie: .4, anziani: .3, giovani: .3 },
    issue_focus: {}, rally: { famiglie: .3, anziani: .3, imprese: .2, fragili: .2 }, protest_campaign: { fragili: .5, giovani: .3, famiglie: .2 }
  }
});
// The areas of policy a debate topic stands for (the topic a campaign is built on moves the agenda of the candidate in the segments).
export const TOPIC_AREA = Object.freeze({ lavoro: 'lavoro', servizi: 'welfare', ambiente: 'ambiente', istituzioni: 'pa', sanita: 'sanita', sicurezza: 'sicurezza', 'costo-vita': 'economia', giovani: 'giovani' });
