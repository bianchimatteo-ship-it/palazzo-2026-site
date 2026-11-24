// Programmes DOCUMENTED from the official sources of a party, on the ten themes of the alliance engine (alliance-rules.js, scale −3..+3).
// A documented theme carries the position on the scale and the confidence of the mapping (alta / media / bassa); a theme the sources do not answer is `value: null` (confidence 'nessuna'): the engine then treats it as
// «posizione non rilevata» (neither agreement nor conflict, not in the score), never as a middle position. The words of the sources, the Laboratorio each theme comes from and the reasoning of every value are in
// data/real/party-program-sources.json (documentation: the game does not show them). The positions are the game's reading of the documented text (a simulation), never a declaration of the party.
const P = (it, en) => [it, en];

export const DOCUMENTED_PROGRAMS = Object.freeze({
  'party-progetto-civico-italia': Object.freeze({
    retrievedAt: '2026-11-23',
    sources: ["https://progettocivicoitalia.it/programma/", "https://progettocivicoitalia.it/carta-dei-valori/", "https://progettocivicoitalia.it/documenti/PROGETTOCIVICOITALIA-carta-dei-valori.pdf"],
    themes: {
      immigrazione: { value: -0.5, confidence: 'media' },
      sicurezza: { value: 0, confidence: 'media' },
      economia: { value: 1, confidence: 'media' },
      sanita: { value: -1.5, confidence: 'media' },
      lavoro: { value: -1, confidence: 'bassa' },
      ambiente: { value: -1.5, confidence: 'media' },
      europa: { value: -2.5, confidence: 'alta' },
      diritti: { value: -1.5, confidence: 'media' },
      // the scale asks «centrality of Parliament and guarantees» against «premierato»: the sources do not name the premierato, but they state the guarantees side (the independence of the judiciary, the
      // balance of powers, participation and transparency): a cautious position on that side, with low confidence and the evidence quoted
      istituzioni: { value: -1, confidence: 'bassa', evidence: P('Fonti del partito: «difesa dell’indipendenza della magistratura e dell’equilibrio dei poteri», partecipazione (bilanci partecipativi, consultazioni) e trasparenza: posizione sul lato delle garanzie; il premierato non è nominato.', 'Party sources: “defence of the independence of the judiciary and of the balance of powers”, participation (participatory budgets, consultations) and transparency: a position on the side of guarantees; the premierato is not named.') },
      esteri: { value: 0.5, confidence: 'bassa' }
    },
    // the topics the sources cover beyond the ten themes: shown on the programme, they do not move the compatibility score ([Italian, English])
    areas: [
      { id: 'autonomia-locale', text: P("Autonomia locale (Carta dei valori): Comuni, città metropolitane, Province e Regioni partecipano alla programmazione dello sviluppo con risorse e capacità amministrative adeguate; l'autonomia non deve aumentare le disuguaglianze e i servizi essenziali restano garantiti in tutto il Paese.", "Local autonomy (Charter of values): municipalities, metropolitan cities, provinces and regions help plan development with adequate resources and administrative capacity; autonomy must not widen inequalities and essential services stay guaranteed across the country.") },
      { id: 'partecipazione', text: P("Partecipazione e trasparenza: bilanci partecipativi, assemblee pubbliche, consultazioni, trasparenza di bilanci e appalti, anticorruzione, conflitti di interesse.", "Participation and transparency: participatory budgets, public assemblies, consultations, transparency of budgets and procurement, anti-corruption, conflicts of interest.") },
      { id: 'pubblica-amministrazione', text: P("Pubblica amministrazione: capacità amministrativa, sportelli unici, tempi certi, valutazione dei risultati, PA digitale. Difesa dell'indipendenza della magistratura e dell'equilibrio dei poteri.", "Public administration: administrative capacity, one-stop shops, certain deadlines, results evaluation, digital administration. Defence of judicial independence and the balance of powers.") },
      { id: 'scuola', text: P("Scuola, università e ricerca: scuola aperta, competenze digitali, orientamento, dispersione scolastica, legame università–ricerca–imprese–territori.", "School, university and research: open schools, digital skills, guidance, school dropout, links between universities, research, firms and territories.") },
      { id: 'giovani', text: P("Giovani: lavoro qualificato, casa, formazione, mobilità, cultura, sport, impresa giovanile, partecipazione civica.", "Young people: skilled jobs, housing, training, mobility, culture, sport, youth enterprise, civic participation.") },
      { id: 'welfare', text: P("Welfare e Terzo Settore: nidi, anziani, non autosufficienza, disabilità, minori, famiglie, povertà; collaborazione tra Comuni e Terzo Settore.", "Welfare and the third sector: nurseries, older people, long-term care, disability, minors, families, poverty; cooperation between municipalities and the third sector.") },
      { id: 'agricoltura', text: P("Agricoltura: acqua, energia, innovazione, giovani agricoltori, filiere locali, export, tutela del suolo, marchi territoriali.", "Agriculture: water, energy, innovation, young farmers, local supply chains, exports, soil protection, territorial brands.") },
      { id: 'turismo', text: P("Turismo, borghi e aree interne: turismo diffuso e sostenibile, destagionalizzazione, grandi eventi, promozione dei borghi.", "Tourism, villages and inland areas: widespread sustainable tourism, de-seasonalisation, major events, promotion of villages.") },
      { id: 'cultura', text: P("Cultura: tutela e valorizzazione del patrimonio, industrie creative, accesso alla cultura nelle periferie e nelle aree interne.", "Culture: protecting and promoting heritage, creative industries, access to culture in suburbs and inland areas.") },
      { id: 'sport', text: P("Sport: impiantistica diffusa, palestre scolastiche come presìdi sociali, sport di base, voucher sport.", "Sport: widespread facilities, school gyms as social hubs, grassroots sport, sport vouchers.") },
      { id: 'trasporti', text: P("Trasporti e mobilità: trasporto pubblico locale, intermodalità, connessioni tra Comuni, periferie e aree interne.", "Transport and mobility: local public transport, intermodality, links between municipalities, suburbs and inland areas.") },
      { id: 'innovazione', text: P("Innovazione, digitale e space economy: intelligenza artificiale, dati pubblici, cybersecurity, servizi satellitari, protezione civile.", "Innovation, digital and the space economy: artificial intelligence, open data, cybersecurity, satellite services, civil protection.") },
      { id: 'giustizia', text: P("Giustizia: tempi dei procedimenti, digitalizzazione, tutela delle vittime, mediazione, reinserimento sociale, garanzie.", "Justice: length of proceedings, digitalisation, victims’ protection, mediation, social reintegration, guarantees.") },
      { id: 'mezzogiorno', text: P("Crescita del Mezzogiorno: Sud come piattaforma mediterranea di sviluppo, energia, cultura, turismo, agricoltura, università e impresa.", "Growth of the South: the South as a Mediterranean platform for development, energy, culture, tourism, agriculture, universities and business.") },
      { id: 'difesa-sicurezza-urbana', text: P("Difesa e sicurezza urbana: difesa comune europea, infrastrutture strategiche; sicurezza partecipata, polizia locale, scuole e stazioni, dipendenze.", "Defence and urban security: European common defence, strategic infrastructure; participatory security, local police, schools and stations, addiction.") }
    ]
  })
});

export const documentedProgramOf = party => DOCUMENTED_PROGRAMS[party?.id] ?? DOCUMENTED_PROGRAMS[party?.mergedFrom?.[0]] ?? null;

// every [Italian, English] pair of the file (the phrase-book is written from it: scripts/sync-release-pairs.mjs)
export const ALL_PAIRS = Object.freeze(Object.values(DOCUMENTED_PROGRAMS).flatMap(program => program.areas.map(area => area.text)));
