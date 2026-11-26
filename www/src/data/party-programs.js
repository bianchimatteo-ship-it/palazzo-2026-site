// The programmes of the parties on the ten themes of the alliance engine (core/alliance-rules.js, scale −3..+3), as far as the parties' OWN documents support them.
// Rules (owner's dossier of 24/11/2026, docs/qa/dossier_programmi_partiti_v2_2026-11-24.md):
//   · a theme is documented only when a document of the party states a direction on it; then it carries the summary, the document (title, date, address, kind, scope, status) and how it was read;
//   · a theme the documents do not answer is `value: null` with the reason: never 0, never «neutral», never deduced from the left–right axis;
//   · a programme of 2022 is shown as 2022, a coalition document as a coalition document, a manifesto as a manifesto, a programme still being written as «in elaborazione»;
//   · where nothing is documented the GAME uses an estimate of its own for the play (core/alliance-rules.js), always labelled «stima simulata del gioco», never as the party's position.
// The scale is a convention of the game, not a classification the parties use. `read`: 'diretta' (the page was read on 24/11/2026), 'dossier' (summarised in the owner's dossier, the page was not
// readable by the tool on that day). Party records are referred to by their id; aliases point to the canonical record (PARTY_CATALOG).
import { programTexts, registerProgramTexts } from './party-program-values.js?v=20261126-3';
const P = (it, en) => [it, en];
const T = (value, confidence, doc, it, en, extra = {}) => ({ value, confidence: value === null ? 'nessuna' : confidence, doc, summary: [it, en], ...extra });
const NO = (doc, it = 'Le fonti consultate non affrontano il tema.', en = 'The sources consulted do not address the theme.') => T(null, 'nessuna', doc, it, en);
export const RETRIEVED_AT = '2026-11-24';

// ---------- the documents ----------
export const DOCUMENTS = Object.freeze({
  'pci-tesi-2025': { title: 'Le Tesi del PCI (documento politico, Forlì 2025)', url: 'https://www.ilpartitocomunistaitaliano.it/le-tesi-del-pci/', date: '2025-02', type: 'tesi-congressuali', scope: 'nazionale', status: 'congressuale', read: 'diretta' },
  'pcivico-carta': { title: 'Carta dei Valori — Progetto Civico Italia', url: 'https://progettocivicoitalia.it/carta-dei-valori/', date: null, type: 'carta-dei-valori', scope: 'nazionale', status: 'approvato', read: 'diretta' },
  'pcivico-laboratori': { title: 'Programma — I Laboratori Civici Nazionali', url: 'https://progettocivicoitalia.it/programma/', date: null, type: 'programma-in-elaborazione', scope: 'nazionale', status: 'in-elaborazione', read: 'diretta' },
  'nm-battaglie': { title: 'Programma — Le nostre battaglie (Noi Moderati)', url: 'https://www.noimoderati.it/programma', date: null, type: 'proposte-tematiche', scope: 'nazionale', status: 'corrente', read: 'diretta' },
  'nm-2022': { title: 'Programma Noi Moderati 2022 (PDF)', url: 'https://www.noimoderati.it/programma', date: '2022', type: 'programma-elettorale', scope: 'nazionale', status: 'storico', read: 'non-letto' },
  'volt-programma': { title: 'Il Programma Volt Italia', url: 'https://www.voltitalia.it/Programma/', date: null, type: 'programma', scope: 'nazionale ed europeo', status: 'corrente (sezioni 2022 e 2024)', read: 'diretta' },
  'piueuropa-manifesto': { title: 'Manifesto di Più Europa', url: 'https://www.piueuropa.eu/manifesto', date: null, type: 'manifesto', scope: 'nazionale', status: 'approvato', read: 'diretta' },
  'piueuropa-2022': { title: '«Una Generazione Avanti», programma elettorale 2022', url: 'https://www.piueuropa.eu/una_generazione_avanti_il_programma_elettorale_di_europa', date: '2022-08-23', type: 'programma-elettorale', scope: 'nazionale', status: 'storico', read: 'dossier' },
  'm5s-nova-2026': { title: 'Nova, 20 punti: una alleanza per la Costituzione', url: 'https://www.movimento5stelle.eu/nova-20-punti-una-alleanza-per-la-costituzione/', date: '2026-09-18', type: 'consultazione', scope: 'proposte per la coalizione progressista', status: 'consultazione degli iscritti', read: 'diretta (testo dei 20 punti non leggibile)' },
  'pd-cinque-punti': { title: 'Cinque punti per l’Italia; Per il diritto alla salute (30/09/2026); intervista sulla manovra (24/11/2026)', url: 'https://partitodemocratico.it/cinque-punti-per-litalia/', date: '2026-11-24', type: 'sintesi-programmatica', scope: 'nazionale', status: 'corrente', read: 'dossier' },
  'cdx-2022': { title: 'Accordo quadro di programma del centrodestra 2022 (sul sito di Fratelli d’Italia)', url: 'https://www.fratelli-italia.it/programmacentrodestra/', date: '2022-08', type: 'programma-coalizione', scope: 'coalizione', status: 'storico', read: 'dossier' },
  'lega-sl37': { title: 'La Settimana Leghista n. 37 (13/09/2026): manifesto programmatico in preparazione', url: 'https://legaonline.it/la-settimana-leghista-37/', date: '2026-09-13', type: 'comunicazione-ufficiale', scope: 'nazionale', status: 'manifesto in elaborazione', read: 'dossier' },
  'lega-2022': { title: 'Programma elettorale Lega 2022 (PDF)', url: 'https://static.legaonline.it/files/Programma_Lega_2022.pdf', date: '2022', type: 'programma-elettorale', scope: 'nazionale', status: 'storico', read: 'non-letto' },
  'fi-schede': { title: 'Forza Italia, Forza di Governo — schede tematiche dei Dipartimenti', url: 'https://forzaitalia.it/forza-italia-forza-di-governo/', date: null, type: 'proposte-tematiche', scope: 'nazionale', status: 'corrente', read: 'dossier' },
  'azione-proposte': { title: 'Proposte — Azione (titoli delle proposte per area)', url: 'https://www.azione.it/proposte/', date: null, type: 'proposte-tematiche', scope: 'nazionale', status: 'corrente', read: 'diretta (solo i titoli)' },
  'iv-cantieri': { title: 'Cantieri di Futuro — Italia Viva', url: 'https://www.italiaviva.it/i_cantieri_di_futuro', date: null, type: 'percorso-partecipativo', scope: 'nazionale', status: 'in-elaborazione', read: 'diretta' },
  'ev-12-priorita': { title: 'Europa Verde — 12 priorità per cambiare l’Europa', url: 'https://europaverde.it/programma/', date: null, type: 'priorita-europee', scope: 'europeo', status: 'corrente', read: 'dossier' },
  'avs-2022': { title: 'Programma elettorale Alleanza Verdi e Sinistra 2022 (PDF)', url: 'https://www.sinistraitaliana.si/wp-content/uploads/2022/09/Programma-Alleanza-Verdi-e-Sinistra.pdf', date: '2022-09', type: 'programma-coalizione', scope: 'coalizione', status: 'storico', read: 'non-letto' },
  'pld-manifesto': { title: 'Manifesto del Partito Liberaldemocratico', url: 'https://partitoliberaldemocratico.com/manifesto/', date: null, type: 'manifesto', scope: 'nazionale', status: 'approvato', read: 'dossier' },
  'fn-bip': { title: 'B.I.P. — Base Ideologica e Programmatica 2027–2037 (prima e seconda parte di tre)', url: 'https://futuronazionale.it/programma/', date: null, type: 'base-programmatica', scope: 'nazionale', status: 'incompleto (due parti su tre)', read: 'dossier (pagina troppo grande per lo strumento)' },
  'ora-proposta': { title: 'La nostra proposta — ORA!', url: 'https://ora-italia.it/proposta/', date: null, type: 'tesi-in-elaborazione', scope: 'nazionale', status: 'in-elaborazione', read: 'diretta' },
  'demos-2026': { title: 'Documento programmatico Demo.S 2026 (Servizio sanitario nazionale)', url: 'https://www.democraziasolidale.it/wp-content/uploads/2026/05/DOCUMENTO-PROGRAMMATICO-DEMOS-2026.pdf', date: '2026-05', type: 'documento-tematico', scope: 'nazionale', status: 'approvato', read: 'dossier' },
  'scn-principi': { title: 'I dieci principi programmatici — Sud chiama Nord', url: 'https://www.sud-chiamanord.it/documentazione/principi-programmatici', date: null, type: 'manifesto', scope: 'regionale (Sicilia)', status: 'approvato', read: 'dossier' }
});

// ---------- the programmes ----------
// `status`: documentato (several themes with a direction) · parziale (a few) · senza-posizioni (documents exist but state no direction on the ten themes) · in-elaborazione.
const PCIVICO_AREAS = [
  { id: 'autonomia-locale', text: P("Autonomia locale (Carta dei valori): Comuni, città metropolitane, Province e Regioni partecipano alla programmazione dello sviluppo con risorse e capacità amministrative adeguate; l'autonomia non deve aumentare le disuguaglianze.", "Local autonomy (Charter of values): municipalities, metropolitan cities, provinces and regions take part in planning development with adequate resources and administrative capacity; autonomy must not widen inequalities.") },
  { id: 'partecipazione', text: P("Partecipazione e trasparenza: bilanci partecipativi, assemblee pubbliche, consultazioni, trasparenza di bilanci e appalti, anticorruzione, conflitti di interesse.", "Participation and transparency: participatory budgets, public assemblies, consultations, transparency of budgets and tenders, anti-corruption, conflicts of interest.") },
  { id: 'pubblica-amministrazione', text: P("Pubblica amministrazione: capacità amministrativa, sportelli unici, tempi certi, valutazione dei risultati, PA digitale. Difesa dell'indipendenza della magistratura e dell'equilibrio dei poteri.", "Public administration: administrative capacity, one-stop shops, set deadlines, assessment of results, digital administration. Defence of the independence of the judiciary and of the balance of powers.") },
  { id: 'scuola', text: P("Scuola, università e ricerca: scuola aperta, competenze digitali, orientamento, dispersione scolastica, legame università–ricerca–imprese–territori.", "School, university and research: open schools, digital skills, guidance, early school leaving, links between universities, research, businesses and territories.") },
  { id: 'giovani', text: P("Giovani: lavoro qualificato, casa, formazione, mobilità, cultura, sport, impresa giovanile, partecipazione civica.", "Young people: skilled jobs, housing, training, mobility, culture, sport, youth enterprise, civic participation.") },
  { id: 'welfare', text: P("Welfare e Terzo Settore: nidi, anziani, non autosufficienza, disabilità, minori, famiglie, povertà; collaborazione tra Comuni e Terzo Settore.", "Welfare and the third sector: nurseries, older people, long-term care, disability, children, families, poverty; cooperation between municipalities and the third sector.") },
  { id: 'agricoltura', text: P("Agricoltura: acqua, energia, innovazione, giovani agricoltori, filiere locali, export, tutela del suolo, marchi territoriali.", "Agriculture: water, energy, innovation, young farmers, local supply chains, exports, soil protection, territorial labels.") },
  { id: 'turismo', text: P("Turismo, borghi e aree interne: turismo diffuso e sostenibile, destagionalizzazione, grandi eventi, promozione dei borghi.", "Tourism, villages and inland areas: widespread sustainable tourism, de-seasonalisation, major events, promotion of villages.") },
  { id: 'cultura', text: P("Cultura: tutela e valorizzazione del patrimonio, industrie creative, accesso alla cultura nelle periferie e nelle aree interne.", "Culture: protecting and promoting heritage, creative industries, access to culture in suburbs and inland areas.") },
  { id: 'sport', text: P("Sport: impiantistica diffusa, palestre scolastiche come presìdi sociali, sport di base, voucher sport.", "Sport: widespread facilities, school gyms as social hubs, grassroots sport, sport vouchers.") },
  { id: 'trasporti', text: P("Trasporti e mobilità: trasporto pubblico locale, intermodalità, connessioni tra Comuni, periferie e aree interne.", "Transport and mobility: local public transport, intermodality, links between municipalities, suburbs and inland areas.") },
  { id: 'innovazione', text: P("Innovazione, digitale e space economy: intelligenza artificiale, dati pubblici, cybersecurity, servizi satellitari, protezione civile.", "Innovation, digital and the space economy: artificial intelligence, open data, cybersecurity, satellite services, civil protection.") },
  { id: 'giustizia', text: P("Giustizia: tempi dei procedimenti, digitalizzazione, tutela delle vittime, mediazione, reinserimento sociale, garanzie.", "Justice: length of proceedings, digitalisation, victims’ protection, mediation, social reintegration, guarantees.") },
  { id: 'mezzogiorno', text: P("Crescita del Mezzogiorno: Sud come piattaforma mediterranea di sviluppo, energia, cultura, turismo, agricoltura, università e impresa.", "Growth of the South: the South as a Mediterranean platform for development, energy, culture, tourism, agriculture, universities and business.") },
  { id: 'difesa-sicurezza-urbana', text: P("Difesa e sicurezza urbana: difesa comune europea, infrastrutture strategiche; sicurezza partecipata, polizia locale, scuole e stazioni, dipendenze.", "Defence and urban security: European common defence, strategic infrastructure; participatory security, local police, schools and stations, addictions.") }
];
export const DOCUMENTED_PROGRAMS = Object.freeze({
  'party-partito-comunista-italiano': {
    status: 'documentato', documents: ['pci-tesi-2025'],
    themes: {
      immigrazione: T(-2.5, 'alta', 'pci-tesi-2025', 'Abolizione della legge Bossi-Fini e gestione dei flussi rispettosa della dignità delle persone.', 'Repeal of the Bossi-Fini law and management of migration flows respecting people’s dignity.'),
      sicurezza: T(-2, 'media', 'pci-tesi-2025', 'Contrario al disegno di legge sulla sicurezza, giudicato autoritario e limitativo del dissenso e dello sciopero.', 'Opposes the security bill, judged authoritarian and restrictive of dissent and strikes.'),
      economia: T(-2.5, 'alta', 'pci-tesi-2025', '«Più Stato e meno mercato», un nuovo IRI, tassare profitti, grandi redditi e ricchezze; contro i tagli alla spesa pubblica.', '“More State and less market”, a new IRI, taxing profits, high incomes and wealth; against cuts to public spending.'),
      sanita: T(-3, 'alta', 'pci-tesi-2025', 'No al profitto sulla salute; rilancio del servizio sanitario pubblico.', 'No to profit on health; relaunch of the public health service.'),
      lavoro: T(-3, 'alta', 'pci-tesi-2025', 'Riduzione dell’orario a parità di salario, ripristino dell’articolo 18, abolizione del lavoro precario, minimo orario di 10 euro netti.', 'Shorter hours at equal pay, restoring Article 18, abolishing precarious work, a minimum of 10 euros net an hour.'),
      ambiente: T(-2, 'media', 'pci-tesi-2025', 'Spinta forte alle energie alternative e ciclo dei rifiuti con incenerimento marginale; contro il Ponte sullo Stretto.', 'A strong push for alternative energy and a waste cycle with marginal incineration; against the Strait bridge.'),
      europa: T(2.5, 'alta', 'pci-tesi-2025', 'Una confederazione di Stati sovrani al posto dell’attuale Unione; superamento di UE ed euro, critica dell’austerità.', 'A confederation of sovereign states instead of the present Union; moving beyond the EU and the euro, criticism of austerity.'),
      diritti: T(-2, 'media', 'pci-tesi-2025', 'Difesa dei diritti civili acquisiti e richiesta di nuovi, anche per le persone LGBTQI+.', 'Defence of the civil rights won and demand for new ones, including for LGBTQI+ people.'),
      istituzioni: T(-2.5, 'alta', 'pci-tesi-2025', 'Contro l’elezione diretta del premier e l’autonomia differenziata; sistema proporzionale; indipendenza della magistratura.', 'Against the direct election of the premier and differentiated autonomy; proportional representation; independence of the judiciary.', { subpositions: { formaGoverno: P('contro il premierato', 'against the premierato'), autonomiaLocale: P('contro l’autonomia differenziata, ritorno al Titolo V originario', 'against differentiated autonomy, back to the original Title V'), giustizia: P('contro la separazione delle carriere', 'against separating the careers of judges and prosecutors') } }),
      esteri: T(-3, 'alta', 'pci-tesi-2025', 'Uscita dell’Italia dalla NATO, no all’esercito europeo e all’economia di guerra.', 'Italy out of NATO, no to a European army and to a war economy.')
    }
  },
  'party-progetto-civico-italia': {
    status: 'in-elaborazione', documents: ['pcivico-carta', 'pcivico-laboratori'], areas: PCIVICO_AREAS,
    themes: {
      immigrazione: T(-1, 'bassa', 'pcivico-carta', 'L’integrazione richiede diritti, opportunità e dialogo nel quadro costituzionale; il Laboratorio studia ingressi regolari e contrasto allo sfruttamento.', 'Integration requires rights, opportunities and dialogue within the Constitution; the Laboratory studies regular entry and fighting exploitation.'),
      sicurezza: T(-1, 'media', 'pcivico-carta', 'La sicurezza non si costruisce solo con la repressione ma con prevenzione e politiche sociali; «comunità attive, non ronde».', 'Security is not built by repression alone but by prevention and social policies; “active communities, not patrols”.'),
      economia: NO('pcivico-laboratori', 'Il Laboratorio Fisco studia la riduzione del peso fiscale su lavoro e piccole imprese: area di studio, non una posizione dichiarata sulla scala.', 'The Tax Laboratory studies lowering the tax burden on labour and small firms: an area of study, not a stated position on the scale.'),
      sanita: T(-1.5, 'media', 'pcivico-carta', 'Servizi pubblici accessibili e un servizio sanitario accessibile; cura di prossimità (Case della Comunità, telemedicina).', 'Accessible public services and an accessible health service; local care (community health centres, telemedicine).'),
      lavoro: NO('pcivico-carta', 'La Carta cita un lavoro dignitoso e qualificato senza misure: nessuna posizione sulla scala.', 'The Charter mentions decent, skilled work without measures: no position on the scale.'),
      ambiente: T(-1.5, 'media', 'pcivico-carta', 'Rinnovabili, efficienza energetica, economia circolare, mobilità più pulita e prevenzione del dissesto.', 'Renewables, energy efficiency, circular economy, cleaner mobility and prevention of land instability.'),
      europa: T(-2.5, 'alta', 'pcivico-carta', 'Integrazione europea «più compiuta», istituzioni dell’Unione più forti, strumenti comuni di investimento.', 'A “more complete” European integration, stronger EU institutions, common investment tools.'),
      diritti: T(-1.5, 'media', 'pcivico-carta', 'Contrasto alle discriminazioni; libertà di stampa, di associazione e diritto al dissenso.', 'Fighting discrimination; freedom of the press and of association, the right to dissent.'),
      istituzioni: NO('pcivico-carta', 'Documentate pubblica amministrazione trasparente, autonomia responsabile, indipendenza della magistratura e separazione dei poteri; sulla forma di governo (premierato) le fonti tacciono: nessun valore sulla scala.', 'Documented: transparent administration, responsible autonomy, independence of the judiciary and separation of powers; the sources say nothing on the form of government (premierato): no value on the scale.'),
      esteri: T(0.5, 'bassa', 'pcivico-carta', 'Cooperazione più strutturata su sicurezza e difesa nel rispetto degli impegni internazionali; obiettivo di pace.', 'More structured cooperation on security and defence within international commitments; the goal of peace.')
    }
  },
  'party-registro-p1-2020-56-ir': {
    status: 'parziale', documents: ['nm-battaglie', 'nm-2022'],
    themes: {
      immigrazione: NO('nm-battaglie'), sicurezza: NO('nm-battaglie', 'La pagina tratta solo la sicurezza informatica, non la sicurezza pubblica.', 'The page deals only with cybersecurity, not public security.'), sanita: NO('nm-battaglie'),
      economia: T(1, 'media', 'nm-battaglie', 'Detassazione degli aumenti salariali per i redditi bassi e semplificazione burocratica per le imprese.', 'Tax relief on pay rises for low incomes and red-tape cuts for businesses.'),
      lavoro: NO('nm-battaglie', 'Il lavoro come sostegno alla persona più del reddito: nessuna direzione su tutele o flessibilità.', 'Work rather than income as support for the person: no direction on protection or flexibility.'),
      ambiente: T(0.5, 'media', 'nm-battaglie', 'Decarbonizzazione con un mix che include il nucleare di nuova generazione, senza gravare sul tessuto sociale.', 'Decarbonisation with a mix including new-generation nuclear, without burdening society.'),
      europa: T(-1, 'media', 'nm-battaglie', 'Nel Partito Popolare Europeo; un’Europa più integrata con difesa comune, critica della burocrazia.', 'In the European People’s Party; a more integrated Europe with common defence, criticism of bureaucracy.'),
      diritti: NO('nm-battaglie', 'Parità di genere, disabilità e tutela dei minori online: nessuna posizione sull’asse dei diritti civili.', 'Gender equality, disability and child protection online: no position on the civil-rights axis.'),
      istituzioni: NO('nm-battaglie', 'Documentati garantismo e separazione delle carriere; la forma di governo non è trattata.', 'Documented: due process and separating judges’ and prosecutors’ careers; the form of government is not addressed.', { subpositions: { giustizia: P('separazione delle carriere, garantismo', 'separate careers, due process') } }),
      esteri: T(1.5, 'alta', 'nm-battaglie', 'L’Italia nell’Occidente euroatlantico; difesa comune europea.', 'Italy in the Euro-Atlantic West; European common defence.')
    }
  },
  'party-registro-p1-2024-71-ir': {
    status: 'parziale', documents: ['volt-programma'],
    themes: {
      immigrazione: T(-1, 'media', 'volt-programma', 'Programma europeo 2024: immigrazione gestita con solidarietà ed equità, politiche umane ed efficienti.', 'European programme 2024: migration managed with solidarity and fairness, humane and efficient policies.'),
      sicurezza: NO('volt-programma'), economia: NO('volt-programma', 'Crescita sostenibile e inclusiva; il fisco non è trattato.', 'Sustainable, inclusive growth; tax is not addressed.'), sanita: NO('volt-programma'), lavoro: NO('volt-programma', 'Posti di lavoro verdi e crescita inclusiva, senza misure sulle tutele.', 'Green jobs and inclusive growth, with no measures on protection.'),
      ambiente: T(-2, 'media', 'volt-programma', 'Lotta al cambiamento climatico e transizione ecologica.', 'Fighting climate change and the ecological transition.'),
      europa: T(-1.5, 'media', 'volt-programma', 'Riforma dell’Unione per renderla più democratica, trasparente e vicina ai cittadini.', 'Reforming the Union to make it more democratic, transparent and closer to citizens.'),
      diritti: T(-1.5, 'bassa', 'volt-programma', 'Welfare e diritti civili per l’uguaglianza e la protezione di tutti.', 'Welfare and civil rights for equality and everyone’s protection.'),
      istituzioni: NO('volt-programma', 'Uno «Stato intelligente» con servizi pubblici digitali; forma di governo e giustizia non trattate.', 'A “smart State” with digital public services; form of government and justice not addressed.'),
      esteri: NO('volt-programma')
    }
  },
  'party-registro-p1-2018-47-ir': {
    status: 'parziale', documents: ['piueuropa-manifesto', 'piueuropa-2022'],
    themes: {
      immigrazione: NO('piueuropa-manifesto'), sicurezza: NO('piueuropa-manifesto'), economia: NO('piueuropa-manifesto'), sanita: NO('piueuropa-manifesto'), lavoro: NO('piueuropa-manifesto'),
      ambiente: NO('piueuropa-manifesto', 'La tutela dell’ambiente è citata tra i bisogni comuni, senza una direzione.', 'Environmental protection is listed among common needs, with no direction.'),
      europa: T(-3, 'alta', 'piueuropa-manifesto', 'Verso un’integrazione federale: difendere l’Unione di oggi e costruirne una più forte.', 'Towards federal integration: defend today’s Union and build a stronger one.'),
      diritti: T(-2, 'media', 'piueuropa-manifesto', 'Difesa dei diritti fondamentali e della diversità; l’Unione come garante di diritti e libertà.', 'Defence of fundamental rights and diversity; the Union as guarantor of rights and freedoms.'),
      istituzioni: NO('piueuropa-manifesto', 'Stato di diritto e divisione dei poteri come fondamenti; la forma di governo non è trattata.', 'Rule of law and division of powers as foundations; the form of government is not addressed.'),
      esteri: T(1.5, 'bassa', 'piueuropa-2022', 'Programma 2022 (storico): atlantismo e difesa comune europea.', 'Programme 2022 (historical): Atlanticism and European common defence.')
    }
  },
  'party-registro-p1-2022-63-ir': {
    status: 'senza-posizioni', documents: ['m5s-nova-2026'],
    themes: Object.fromEntries(['immigrazione', 'sicurezza', 'economia', 'sanita', 'lavoro', 'ambiente', 'europa', 'diritti', 'istituzioni', 'esteri'].map(id => [id, NO('m5s-nova-2026', 'I 20 punti di NOVA (consultazione del settembre 2026, proposte da portare alla coalizione progressista) non sono leggibili: nessuna posizione verificata.', 'The 20 NOVA points (September 2026 consultation, proposals for the progressive coalition) were not readable: no position verified.')]))
  },
  'party-registro-p1-2015-29-ir': {
    status: 'parziale', documents: ['pd-cinque-punti'],
    themes: {
      immigrazione: NO('pd-cinque-punti'), sicurezza: NO('pd-cinque-punti'), economia: NO('pd-cinque-punti', 'Politica industriale, crescita e fisco senza una direzione sulla scala.', 'Industrial policy, growth and tax with no direction on the scale.'),
      sanita: T(-2.5, 'alta', 'pd-cinque-punti', 'Difesa e rilancio del servizio sanitario pubblico; obiettivo dichiarato 7–7,5% del PIL (proposta, non spesa stanziata).', 'Defending and relaunching the public health service; stated target 7–7.5% of GDP (a proposal, not money allocated).'),
      lavoro: T(-2, 'alta', 'pd-cinque-punti', 'Salari, contratti rappresentativi e salario minimo.', 'Wages, representative contracts and a minimum wage.'),
      ambiente: T(-1, 'bassa', 'pd-cinque-punti', 'Conversione ecologica dell’industria.', 'Ecological conversion of industry.'),
      europa: NO('pd-cinque-punti'),
      diritti: T(-1.5, 'bassa', 'pd-cinque-punti', 'Diritti sociali e civili tra i cinque punti.', 'Social and civil rights among the five points.'),
      istituzioni: NO('pd-cinque-punti'), esteri: NO('pd-cinque-punti')
    }
  },
  'party-registro-p1-2014-04-ir': {
    status: 'parziale', documents: ['cdx-2022'],
    themes: {
      immigrazione: T(2, 'media', 'cdx-2022', 'Programma di coalizione 2022 (storico): contrasto all’immigrazione irregolare e controllo delle frontiere, flussi legali gestiti.', 'Coalition programme 2022 (historical): fighting irregular immigration and border control, managed legal flows.'),
      sicurezza: T(1.5, 'media', 'cdx-2022', 'Programma di coalizione 2022: rafforzamento delle forze dell’ordine e sicurezza urbana.', 'Coalition programme 2022: stronger police forces and urban security.'),
      economia: T(2, 'media', 'cdx-2022', 'Programma di coalizione 2022: meno pressione fiscale, flat tax per gli autonomi, no a patrimoniali.', 'Coalition programme 2022: lower tax burden, flat tax for the self-employed, no wealth taxes.'),
      sanita: NO('cdx-2022', 'Medicina territoriale, personale e liste d’attesa, senza una direzione pubblico–privato.', 'Local medicine, staff and waiting lists, with no public–private direction.'),
      lavoro: NO('cdx-2022', 'Riduzione del cuneo e incentivi all’occupazione, senza una direzione su tutele o flessibilità.', 'Cutting the tax wedge and hiring incentives, with no direction on protection or flexibility.'),
      ambiente: NO('cdx-2022', 'Il testo parla di transizione e politiche energetiche senza una direzione verificabile.', 'The text speaks of transition and energy policy with no verifiable direction.'),
      europa: T(1, 'bassa', 'cdx-2022', 'Programma di coalizione 2022: un’Europa più politica e meno burocratica.', 'Coalition programme 2022: a more political, less bureaucratic Europe.'),
      diritti: NO('cdx-2022', 'Natalità e famiglia, senza posizioni sui diritti civili.', 'Birth rate and family, with no positions on civil rights.'),
      istituzioni: T(2.5, 'media', 'cdx-2022', 'Programma di coalizione 2022: elezione diretta del Presidente della Repubblica; autonomia differenziata.', 'Coalition programme 2022: direct election of the President of the Republic; differentiated autonomy.'),
      esteri: T(2, 'media', 'cdx-2022', 'Programma di coalizione 2022: NATO, Occidente, sostegno all’Ucraina.', 'Coalition programme 2022: NATO, the West, support for Ukraine.')
    }
  },
  'party-registro-p1-2017-41-ir': {
    status: 'parziale', documents: ['lega-sl37', 'lega-2022'],
    themes: {
      immigrazione: NO('lega-sl37'), economia: T(2, 'media', 'lega-sl37', 'Priorità 2026: flat tax per giovani e autonomi, soglia agevolata più alta per le partite IVA.', 'Priorities 2026: flat tax for the young and the self-employed, a higher reduced-rate threshold for VAT numbers.'),
      sicurezza: T(1.5, 'bassa', 'lega-sl37', 'Priorità 2026: sicurezza nelle città.', 'Priorities 2026: security in the cities.'),
      sanita: NO('lega-sl37'), lavoro: NO('lega-sl37', 'Pensione a 64 anni come proposta: nessuna direzione su tutele o flessibilità.', 'Retirement at 64 as a proposal: no direction on protection or flexibility.'), ambiente: NO('lega-sl37'), europa: NO('lega-sl37'), diritti: NO('lega-sl37'),
      istituzioni: NO('lega-sl37', 'Autonomia dei territori richiamata, senza posizione sulla forma di governo.', 'Autonomy of the territories recalled, with no position on the form of government.'), esteri: NO('lega-sl37')
    }
  },
  'party-registro-p1-2015-20-ir': {
    status: 'senza-posizioni', documents: ['fi-schede'],
    themes: Object.fromEntries(['immigrazione', 'sicurezza', 'economia', 'sanita', 'lavoro', 'ambiente', 'europa', 'diritti', 'istituzioni', 'esteri'].map(id => [id, NO('fi-schede', 'Esistono schede dei Dipartimenti sul tema, ma nel dossier non è riportata una direzione: da compilare dalle singole schede.', 'Department sheets exist on the theme, but the dossier reports no direction: to be filled from the single sheets.')]))
  },
  'party-registro-p1-2019-51-ir': {
    status: 'parziale', documents: ['azione-proposte'],
    themes: {
      immigrazione: T(-1, 'media', 'azione-proposte', 'Proposta «Ius Scholae»: cittadinanza ai minori stranieri che studiano in Italia.', '“Ius Scholae” proposal: citizenship for foreign minors who study in Italy.'),
      lavoro: T(-1.5, 'media', 'azione-proposte', 'Proposta di salario minimo.', 'Minimum wage proposal.'),
      sicurezza: NO('azione-proposte'), economia: NO('azione-proposte', 'Titoli su fisco, concorrenza e Industria 4.0: contenuto non letto.', 'Titles on tax, competition and Industry 4.0: content not read.'), sanita: NO('azione-proposte', 'Piani su liste d’attesa e pronto soccorso: contenuto non letto.', 'Plans on waiting lists and emergency rooms: content not read.'),
      ambiente: NO('azione-proposte', 'Titoli su nucleare e bollette: contenuto non letto.', 'Titles on nuclear power and bills: content not read.'), europa: NO('azione-proposte'), diritti: NO('azione-proposte', 'Titolo «Fine vita»: contenuto non letto.', 'Title “End of life”: content not read.'), istituzioni: NO('azione-proposte', 'Titoli su Assemblea Costituente e autonomia differenziata: contenuto non letto.', 'Titles on a Constituent Assembly and differentiated autonomy: content not read.'), esteri: NO('azione-proposte')
    }
  },
  'party-registro-p1-2019-52-ir': {
    status: 'in-elaborazione', documents: ['iv-cantieri'],
    themes: Object.fromEntries(['immigrazione', 'sicurezza', 'economia', 'sanita', 'lavoro', 'ambiente', 'europa', 'diritti', 'istituzioni', 'esteri'].map(id => [id, NO('iv-cantieri', 'I Cantieri di Futuro sono un percorso di proposta aperto: la pagina nomina i cantieri senza posizioni.', 'The Cantieri di Futuro are an open process: the page names the working groups with no positions.')]))
  },
  'party-registro-p1-2014-13-ir': {
    status: 'parziale', documents: ['ev-12-priorita', 'avs-2022'],
    themes: {
      immigrazione: T(-2, 'media', 'ev-12-priorita', 'Priorità europee: asilo e canali migratori legali e sicuri.', 'European priorities: asylum and safe, legal migration channels.'),
      sicurezza: NO('ev-12-priorita'), economia: T(-1.5, 'bassa', 'ev-12-priorita', 'Priorità europee: giustizia fiscale.', 'European priorities: tax justice.'), sanita: NO('ev-12-priorita', 'Salute, aria e acqua tra le priorità, senza direzione pubblico–privato.', 'Health, air and water among the priorities, with no public–private direction.'),
      lavoro: T(-1.5, 'bassa', 'ev-12-priorita', 'Priorità europee: reddito minimo europeo.', 'European priorities: a European minimum income.'),
      ambiente: T(-3, 'media', 'ev-12-priorita', 'Uscita dai combustibili fossili e obiettivo del 100% di rinnovabili.', 'Phasing out fossil fuels and a 100% renewables target.'),
      europa: NO('ev-12-priorita'), diritti: T(-2, 'bassa', 'ev-12-priorita', 'Parità di genere, contrasto alla violenza, diritti fondamentali.', 'Gender equality, fighting violence, fundamental rights.'),
      istituzioni: NO('ev-12-priorita'), esteri: T(-2, 'media', 'ev-12-priorita', 'Pace e restrizione dell’export di armi verso le aree di guerra.', 'Peace and restricting arms exports to war zones.')
    }
  },
  'party-registro-p1-2024-74-ir': {
    status: 'parziale', documents: ['pld-manifesto'],
    themes: {
      immigrazione: NO('pld-manifesto'), sicurezza: NO('pld-manifesto'), sanita: NO('pld-manifesto'), lavoro: NO('pld-manifesto'), istituzioni: NO('pld-manifesto'),
      economia: T(2, 'media', 'pld-manifesto', 'Manifesto: economia di mercato, concorrenza e liberalizzazioni, azione pubblica efficace e limitata.', 'Manifesto: market economy, competition and liberalisation, effective and limited public action.'),
      ambiente: T(0.5, 'bassa', 'pld-manifesto', 'Manifesto: tutela dell’ambiente con approccio pragmatico; ruolo strategico del nucleare.', 'Manifesto: a pragmatic approach to the environment; a strategic role for nuclear power.'),
      europa: T(-2, 'media', 'pld-manifesto', 'Manifesto: integrazione europea.', 'Manifesto: European integration.'),
      diritti: T(-1.5, 'bassa', 'pld-manifesto', 'Manifesto: libertà individuali e civili.', 'Manifesto: individual and civil liberties.'),
      esteri: T(2, 'media', 'pld-manifesto', 'Manifesto: atlantismo.', 'Manifesto: Atlanticism.')
    }
  },
  'party-futuro-nazionale': {
    status: 'in-elaborazione', documents: ['fn-bip'],
    themes: Object.fromEntries(['immigrazione', 'sicurezza', 'economia', 'sanita', 'lavoro', 'ambiente', 'europa', 'diritti', 'istituzioni', 'esteri'].map(id => [id, NO('fn-bip', 'La B.I.P. 2027–2037 (due parti su tre) tratta il tema, ma la pagina non è stata leggibile: nessuna posizione verificata.', 'The B.I.P. 2027–2037 (two parts of three) addresses the theme, but the page was not readable: no position verified.')]))
  },
  'party-ora': {
    status: 'in-elaborazione', documents: ['ora-proposta'],
    themes: Object.fromEntries(['immigrazione', 'sicurezza', 'economia', 'sanita', 'lavoro', 'ambiente', 'europa', 'diritti', 'istituzioni', 'esteri'].map(id => [id, NO('ora-proposta', 'La pagina indica obiettivi generali e tesi ancora in lavorazione: nessuna posizione sulla scala.', 'The page states general goals and theses still being written: no position on the scale.')]))
  },
  'party-registro-p1-2017-43-ir': {
    status: 'parziale', documents: ['demos-2026'],
    themes: { ...Object.fromEntries(['immigrazione', 'sicurezza', 'economia', 'lavoro', 'ambiente', 'europa', 'diritti', 'istituzioni', 'esteri'].map(id => [id, NO('demos-2026', 'Il documento 2026 riguarda solo il Servizio sanitario nazionale.', 'The 2026 document deals only with the National Health Service.')])), sanita: T(-1.5, 'bassa', 'demos-2026', 'Documento 2026 interamente dedicato al rilancio del Servizio sanitario nazionale.', '2026 document entirely devoted to relaunching the National Health Service.') }
  },
  'party-registro-p1-2022-67-ir': {
    status: 'parziale', documents: ['scn-principi'],
    themes: { ...Object.fromEntries(['immigrazione', 'sicurezza', 'economia', 'sanita', 'lavoro', 'europa', 'diritti', 'esteri'].map(id => [id, NO('scn-principi', 'Piattaforma regionale siciliana: il tema nazionale non è trattato.', 'Sicilian regional platform: the national theme is not addressed.')])), ambiente: T(-1.5, 'bassa', 'scn-principi', 'Piattaforma siciliana: rinnovabili e comunità energetiche, contrasto al dissesto.', 'Sicilian platform: renewables and energy communities, fighting land instability.'), istituzioni: NO('scn-principi', 'Autonomia e insularità della Sicilia; la forma di governo non è trattata.', 'Autonomy and insularity of Sicily; the form of government is not addressed.') }
  }
});

// ---------- programmes of coalitions: a separate entity, never the programme of each member ----------
export const COALITION_PROGRAMS = Object.freeze([
  { id: 'tavolo-centrosinistra-2026', title: P('Tavolo per il programma comune del centrosinistra', 'Table for the common centre-left programme'), date: '2026-11-07', status: 'in-elaborazione', statusText: P('avviato il 7 novembre 2026 con dieci tavoli tematici: nessun testo finale approvato', 'started on 7 November 2026 with ten thematic tables: no final text approved'), members: ['party-registro-p1-2015-29-ir', 'party-registro-p1-2022-63-ir', 'party-registro-p1-2014-13-ir', 'party-registro-p1-2017-44-ir', 'party-registro-p1-2019-52-ir', 'party-registro-p1-2018-47-ir', 'party-progetto-civico-italia', 'party-registro-p1-2014-05-ir'], url: 'https://www.piueuropa.eu/centrosinistra_avviato_il_tavolo_per_il_programma_comune_obiettivo_concludere_entro_novembre' },
  { id: 'accordo-centrodestra-2022', title: P('Accordo quadro di programma del centrodestra', 'Centre-right framework programme agreement'), date: '2022-08', status: 'storico', statusText: P('programma di coalizione delle politiche 2022', 'coalition programme of the 2022 general election'), members: ['party-registro-p1-2014-04-ir', 'party-registro-p1-2017-41-ir', 'party-registro-p1-2015-20-ir', 'party-registro-p1-2020-56-ir'], url: 'https://www.fratelli-italia.it/programmacentrodestra/' }
]);

// ---------- the catalogue: what each record of the data is (76 in parties.json, 6 in political-movements.json) ----------
// kind: nazionale · regionale · italiani-estero · movimento · storico (the dataset marks it historical) · alias (another record of the same party: aliasOf) · da-verificare (activity or level not
// confirmed by a source). The Register of the Parliament proves names and registrations, not positions; the MEF lists of the 2×1000 prove presence in that list for that year only.
const K = (kind, note = null, aliasOf = null) => ({ kind, ...(note ? { note } : {}), ...(aliasOf ? { aliasOf } : {}) });
export const PARTY_CATALOG = Object.freeze({
  'party-registro-p1-2014-01-ir': K('nazionale'), 'party-registro-p1-2014-02-ir': K('da-verificare'), 'party-registro-p1-2014-03-ir': K('da-verificare'),
  'party-registro-p1-2014-04-ir': K('nazionale', 'Denominazione registrata di Fratelli d’Italia (con la dicitura storica «Alleanza Nazionale»): è il record canonico di FdI.'),
  'party-registro-p1-2014-05-ir': K('nazionale'), 'party-registro-p1-2014-07-ir': K('regionale', 'Alto Adige'), 'party-registro-p1-2014-08-ir': K('regionale', 'Alto Adige'), 'party-registro-p1-2014-09-ir': K('regionale', 'Trentino'),
  'party-registro-p1-2014-10-ir': K('storico'), 'party-registro-p1-2014-11-ir': K('da-verificare', 'Registrazione ancora attiva; l’attività politica corrente passa per Lega per Salvini Premier.'), 'party-registro-p1-2014-13-ir': K('nazionale'),
  'party-registro-p1-2015-14-ir': K('italiani-estero'), 'party-registro-p1-2015-17-ir': K('nazionale'), 'party-registro-p1-2015-18-ir': K('da-verificare'), 'party-registro-p1-2015-19-ir': K('regionale', 'Alto Adige'),
  'party-registro-p1-2015-21-ir': K('storico'), 'party-registro-p1-2015-22-ir': K('italiani-estero'), 'party-registro-p1-2015-24-ir': K('storico'), 'party-registro-p1-2015-25-ir': K('nazionale'), 'party-registro-p1-2015-26-ir': K('regionale', 'Valle d’Aosta'),
  'party-registro-p1-2015-27-ir': K('regionale', 'Puglia'), 'party-registro-p1-2015-28-ir': K('nazionale'), 'party-registro-p1-2015-29-ir': K('nazionale'), 'party-registro-p1-2016-31-ir': K('regionale', 'Alto Adige'), 'party-registro-p1-2016-32-ir': K('nazionale'),
  'party-registro-p1-2016-33-ir': K('storico'), 'party-registro-p1-2016-34-ir': K('regionale', 'Valle d’Aosta'), 'party-registro-p1-2016-35-ir': K('da-verificare'), 'party-registro-p1-2016-36-ir': K('storico'), 'party-registro-p1-2016-37-ir': K('da-verificare'),
  'party-registro-p1-2016-38-ir': K('storico'), 'party-registro-p1-2016-39-ir': K('regionale', 'Valle d’Aosta'), 'party-registro-p1-2017-40-ir': K('storico'), 'party-registro-p1-2017-41-ir': K('nazionale'), 'party-registro-p1-2017-43-ir': K('nazionale'),
  'party-registro-p1-2017-44-ir': K('nazionale'), 'party-registro-p1-2018-47-ir': K('nazionale'), 'party-registro-p1-2018-48-ir': K('storico'), 'party-registro-p1-2019-49-ir': K('da-verificare'), 'party-registro-p1-2019-50-ir': K('da-verificare'),
  'party-registro-p1-2019-51-ir': K('nazionale'), 'party-registro-p1-2019-52-ir': K('nazionale'), 'party-registro-p1-2019-53-ir': K('nazionale'), 'party-registro-p1-2020-54-ir': K('regionale', 'Alto Adige'), 'party-registro-p1-2020-55-ir': K('da-verificare'),
  'party-registro-p1-2020-56-ir': K('nazionale'), 'party-registro-p1-2021-57-ir': K('regionale', 'Sicilia'), 'party-registro-p1-2021-58-ir': K('regionale', 'Valle d’Aosta'), 'party-registro-p1-2021-59-ir': K('da-verificare'), 'party-registro-p1-2022-60-ir': K('da-verificare'),
  'party-registro-p1-2022-61-ir': K('da-verificare'), 'party-registro-p1-2022-62-ir': K('da-verificare'), 'party-registro-p1-2022-63-ir': K('nazionale'), 'party-registro-p1-2022-64-ir': K('regionale', 'Sicilia'), 'party-registro-p1-2022-65-ir': K('da-verificare'),
  'party-registro-p1-2022-66-ir': K('da-verificare'), 'party-registro-p1-2022-67-ir': K('regionale', 'Sicilia'), 'party-registro-p1-2023-68-ir': K('da-verificare'), 'party-registro-p1-2023-69-ir': K('regionale', 'Trentino'), 'party-registro-p1-2024-70-ir': K('regionale', 'Valle d’Aosta'),
  'party-registro-p1-2024-71-ir': K('nazionale'), 'party-registro-p1-2024-72-ir': K('regionale', 'Friuli Venezia Giulia'), 'party-registro-p1-2024-73-ir': K('nazionale'), 'party-registro-p1-2024-74-ir': K('nazionale'), 'party-registro-p1-2025-75-ir': K('da-verificare'),
  'party-registro-p1-2026-77-ir': K('da-verificare'),
  'party-mef-2025-15': K('alias', 'Denominazione dell’elenco MEF del 2×1000 2025 del MoVimento 5 Stelle.', 'party-registro-p1-2022-63-ir'),
  'party-mef-2025-21': K('alias', 'Denominazione dell’elenco MEF del 2×1000 2025 di +Europa.', 'party-registro-p1-2018-47-ir'),
  'party-futuro-nazionale': K('nazionale'), 'party-democrazia-sovrana-popolare': K('nazionale'), 'party-partito-popolare-del-nord': K('regionale'), 'party-partito-comunista-italiano': K('nazionale'), 'party-partito-comunista-dei-lavoratori': K('nazionale'),
  'party-partito-sardo-d-azione': K('regionale', 'Sardegna'), 'party-ora': K('nazionale'), 'party-progetto-civico-italia': K('nazionale', 'Formazione con sito, Carta dei Valori e Laboratori Civici: programma in elaborazione (non un soggetto fittizio).'),
  'party-registro-p1-2015-20-ir': K('nazionale', 'Movimento politico Forza Italia: è il record canonico di Forza Italia nel gioco (nessun duplicato in parties.json).'), 'party-registro-p1-2017-45-ir': K('da-verificare'),
  'movement-forza-nuova': K('movimento'), 'movement-casapound-italia': K('movimento'), 'movement-potere-al-popolo': K('movimento'), 'movement-rete-dei-patrioti': K('movimento')
});
export const canonicalPartyId = id => PARTY_CATALOG[id]?.aliasOf ?? id;

// The documented programme of a force (its aliases and merged records lead to the canonical one), or null.
export const documentedProgramOf = party => DOCUMENTED_PROGRAMS[canonicalPartyId(party?.id)] ?? (party?.mergedFrom ?? []).map(id => DOCUMENTED_PROGRAMS[canonicalPartyId(id)]).find(Boolean) ?? null;
export const documentOf = id => DOCUMENTS[id] ?? null;
export const STATUS_TEXT = Object.freeze({ documentato: P('programma documentato', 'documented programme'), parziale: P('programma documentato in parte', 'partly documented programme'), 'senza-posizioni': P('documenti senza posizioni verificabili sui dieci temi', 'documents without verifiable positions on the ten themes'), 'in-elaborazione': P('programma in elaborazione', 'programme being drafted') });
// The first screen loads only the numbers (data/party-program-values.js, written from this file by scripts/report-party-programs.mjs); the texts arrive with the pages that show them (this module).
registerProgramTexts({ ...(programTexts() ?? {}), programs: DOCUMENTED_PROGRAMS, documents: DOCUMENTS });

// every [Italian, English] pair of the file (the phrase-book is written from it: scripts/sync-release-pairs.mjs)
const pairsOf = value => Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(pairsOf) : [];
export const ALL_PAIRS = Object.freeze([...pairsOf(DOCUMENTED_PROGRAMS), ...pairsOf(COALITION_PROGRAMS), ...pairsOf(STATUS_TEXT)]);
