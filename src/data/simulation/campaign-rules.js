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

// Costs are game values, in euro/resources and game-days. No real campaign
// finance totals are asserted or imported here.
export const CAMPAIGN_ACTIVITIES = Object.freeze([
  {source:'simulation',id:'citizen_meeting', label:'Incontro con cittadini', category:'territory', days:1, risk:5, cost:{money:350,volunteers:1,organization:1,politicalCapital:0}, effect:.55, visibility:.6, preparation:0, scope:'focused', detail:'Ascolto diretto, impatto locale e graduale.'},
  {source:'simulation',id:'door_to_door', label:'Porta a porta', category:'territory', days:2, risk:4, cost:{money:650,volunteers:4,organization:3,politicalCapital:0}, effect:1.15, visibility:.2, preparation:0, scope:'focused', detail:'Richiede una rete di volontari sul posto.'},
  {source:'simulation',id:'local_visit', label:'Visita locale', category:'territory', days:1, risk:7, cost:{money:250,volunteers:2,organization:1,politicalCapital:0}, effect:.8, visibility:.4, preparation:0, scope:'focused', detail:'Funziona meglio dove la presenza è debole.'},
  {source:'simulation',id:'territory_campaign', label:'Campagna sul territorio', category:'territory', days:3, risk:9, cost:{money:2100,volunteers:6,organization:5,politicalCapital:1}, effect:1.35, visibility:1.1, preparation:0, scope:'focused', detail:'Presidio coordinato di un’area per più giorni.'},
  {source:'simulation',id:'public_event', label:'Evento pubblico', category:'event', days:2, risk:12, cost:{money:1550,volunteers:5,organization:3,politicalCapital:2}, effect:.9, visibility:2.2, preparation:0, scope:'focused', detail:'Può generare copertura e nuove richieste.'},
  {source:'simulation',id:'rally', label:'Comizio', category:'event', days:3, risk:22, cost:{money:4200,volunteers:8,organization:5,politicalCapital:4}, effect:1.25, visibility:4, preparation:0, scope:'focused', detail:'Alta esposizione e maggiore rischio di contestazioni.'},
  {source:'simulation',id:'party_meeting', label:'Riunione del partito', category:'internal', days:1, risk:6, cost:{money:250,volunteers:1,organization:2,politicalCapital:0}, effect:.12, visibility:0, internalSupport:4, listPosition:1, preparation:0, scope:'internal', detail:'Costruisce sostegno alla candidatura e alla posizione in lista.'},
  {source:'simulation',id:'list_building', label:'Costruzione della lista', category:'internal', days:2, risk:12, cost:{money:950,volunteers:2,organization:5,politicalCapital:2}, effect:.2, visibility:.2, internalSupport:2, listPosition:2, preparation:0, scope:'internal', detail:'Migliora l’organizzazione e la posizione elettorale.'},
  {source:'simulation',id:'ally_meeting', label:'Incontro con alleati', category:'internal', days:2, risk:14, cost:{money:600,volunteers:1,organization:3,politicalCapital:3}, effect:.15, visibility:0, internalSupport:2, preparation:0, scope:'internal', detail:'Apre una trattativa politica; l’accordo non è garantito.'},
  {source:'simulation',id:'fundraising', label:'Raccolta fondi', category:'resources', days:1, risk:10, cost:{money:0,volunteers:1,organization:1,politicalCapital:0}, effect:.1, visibility:.5, moneyGain:1900, preparation:0, scope:'any', detail:'Raccoglie risorse con rendimenti incerti ma tracciati come simulazione.'},
  {source:'simulation',id:'interview', label:'Intervista', category:'media', days:1, risk:21, cost:{money:350,volunteers:0,organization:1,politicalCapital:1}, effect:.45, visibility:5, preparation:0, scope:'media', detail:'Amplifica il messaggio e può aprire una polemica.'},
  {source:'simulation',id:'debate', label:'Dibattito', category:'media', days:1, risk:19, cost:{money:250,volunteers:1,organization:3,politicalCapital:2}, effect:.55, visibility:4, preparation:0, scope:'debate', detail:'Esito legato a preparazione, pressione e avversario simulato.'},
  {source:'simulation',id:'debate_prep', label:'Preparazione al confronto', category:'internal', days:1, risk:2, cost:{money:180,volunteers:0,organization:1,politicalCapital:0}, effect:0, visibility:0, preparation:8, scope:'debate', detail:'Prepara un tema per un confronto; non produce consenso immediato.'},
  {source:'simulation',id:'press_conference', label:'Conferenza stampa', category:'media', days:1, risk:25, cost:{money:700,volunteers:1,organization:2,politicalCapital:2}, effect:.45, visibility:6, preparation:0, scope:'media', detail:'Grande copertura, domande e conseguenze non sempre favorevoli.'},
  {source:'simulation',id:'social', label:'Comunicazione social', category:'media', days:1, risk:15, cost:{money:180,volunteers:0,organization:1,politicalCapital:1}, effect:.35, visibility:7, preparation:0, scope:'media', detail:'Rapida e mirata; i risultati dipendono dalla credibilità.'},
  {source:'simulation',id:'national_media', label:'Comunicazione nazionale', category:'media', days:2, risk:20, cost:{money:2350,volunteers:1,organization:3,politicalCapital:3}, effect:.62, visibility:8, preparation:0, scope:'national', detail:'Aiuta a superare i confini locali, ma costa risorse.'},
  {source:'simulation',id:'territorial_media', label:'Comunicazione territoriale', category:'media', days:1, risk:12, cost:{money:450,volunteers:1,organization:1,politicalCapital:1}, effect:.62, visibility:3, preparation:0, scope:'focused', detail:'Rafforza la presenza in un’area scelta.'}
]);

export const DEBATE_TOPICS = Object.freeze([
  {source:'simulation',id:'lavoro',label:'Lavoro e sviluppo'},
  {source:'simulation',id:'servizi',label:'Servizi e comunità'},
  {source:'simulation',id:'ambiente',label:'Territorio e ambiente'},
  {source:'simulation',id:'istituzioni',label:'Istituzioni e fiducia'}
]);

export const EUROPEAN_THRESHOLD = Object.freeze({
  percent:4, source:'real', verified:true, sourceUrl:'https://dait.interno.gov.it/documenti/dossier-elezioni-europee-2024.pdf',
  sourceName:'Ministero dell’Interno — dossier elezioni europee 2024', verifiedAt:'2026-09-22', validFrom:null, validTo:null
});

export const EUROPEAN_THRESHOLD_SOURCE = EUROPEAN_THRESHOLD;
