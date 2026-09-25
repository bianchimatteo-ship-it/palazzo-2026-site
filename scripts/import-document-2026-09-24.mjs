// Integrates the specification “POLITICANDO 2026 — Database politici e partiti — 24/09/2026” into the real dataset.
// Idempotent: every record is upserted by id, nothing verified is removed, nothing is duplicated.
// §2 collocazione of every entity · §3 verified leadership · §4 new entities · §6 lists → parties.
// Values the document leaves open stay null unless an official page of the organisation documents them.
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../src/data/real/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, ROOT), 'utf8'));
const save = (name, value) => writeFile(new URL(name, ROOT), `${JSON.stringify(value, null, 2)}\n`);
const AS_OF = '2026-09-24';
const DOCUMENT = 'POLITICANDO 2026 — Database politici e partiti — 24/09/2026';
const POSITIONS = ['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra'];
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").toLocaleLowerCase('it-IT').replace(/\s+/g, ' ').trim();
const slug = value => norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const meta = (sourceUrl, sourceName, validFrom = null) => ({ source: 'real', verified: true, sourceUrl, sourceName, verifiedAt: AS_OF, validFrom, validTo: null });
const logoModel = { logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: null };
const positionNote = section => ({ positionSource: `${DOCUMENT}, ${section}`, positionAsOf: AS_OF });

// ---------- §2: classification of every entity (name as in the document → collocazione) ----------
const COLLOCAZIONE = [
  ['Partito della Rifondazione Comunista - Sinistra Europea', 'estrema sinistra'], ['Solidarietà - Libertà, Giustizia e Pace', 'sinistra'], ['Alternativa Popolare', 'centro-destra'],
  ["Fratelli d'Italia - Alleanza Nazionale", 'destra'], ['Partito Socialista Italiano', 'centro-sinistra'], ['Verdi del Sudtirolo/Alto Adige - Grüne Südtirols - Verdi-Grüne-Vërc', 'centro-sinistra'],
  ['Süd-Tiroler Freiheit -Freies Bündnis für Tirol', 'destra'], ['Partito Autonomista Trentino Tirolese', 'centro'], ['Unione per il Trentino', 'centro'],
  ["Lega Nord per l'Indipendenza della Padania", 'destra'], ['Europa Verde-Verdi', 'sinistra'], ["Movimento Associativo Italiani all'Estero - MAIE", 'centro'],
  ['Centro Democratico', 'centro-sinistra'], ['Italia dei Valori', 'centro-sinistra'], ['Südtiroler Volkspartei', 'centro'], ['Progetto Trentino', 'centro'],
  ['Unione Sudamericana Emigrati Italiani', 'centro'], ["Popolari per l'Italia", 'centro'], ['UDC-Unione di Centro', 'centro-destra'], ['Union Valdôtaine', 'centro'],
  ['Movimento La Puglia in Più', 'centro'], ['Partito Liberale Italiano', 'centro'], ['Partito Democratico', 'centro-sinistra'], ['Die Freiheitlichen', 'destra'],
  ['Possibile', 'sinistra'], ['La Puglia prima di tutto', 'centro-destra'], ['Stella Alpina', 'centro'], ['Fare!', 'centro-destra'], ['Union Valdôtaine Progressiste', 'centro-sinistra'],
  ['IDEA - Identità e Azione - popolo e libertà', 'destra'], ['Conservatori e Riformisti', 'centro-destra'], ['ALPE Autonomie - Liberté - Participation - Écologie', 'centro-sinistra'],
  ['Articolo 1 - Movimento Democratico e Progressista', 'sinistra'], ['Lega per Salvini Premier', 'destra'], ['Democrazia Solidale - Demo.S', 'centro-sinistra'],
  ['Sinistra Italiana', 'sinistra'], ['+ Europa', 'centro'], ["MOUV'", 'centro-sinistra'], ['Patto per il Nord', 'centro-destra'], ['Dieci volte meglio', 'centro'],
  ['AZIONE', 'centro'], ['Italia Viva', 'centro'], ['Radicali Italiani', 'centro'], ['TEAM K', 'centro'], ['Cambiamo!', 'centro-destra'], ['Noi Moderati', 'centro-destra'],
  ['Siciliani Liberi', 'centro'], ["Pour l'Autonomie - Per l'Autonomia", 'centro'], ["Italexit per l'Italia", 'destra'], ['Coraggio Italia', 'centro-destra'], ['EUROPEISTI', 'centro'],
  ['Alternativa', 'destra'], ['MoVimento 5 Stelle', 'centro-sinistra'], ['Sicilia Vera', 'centro'], ['Moderati', 'centro'], ['Italia al Centro', 'centro'], ['Sud chiama Nord', 'centro'],
  ["L'Italia C'è", 'centro'], ['Campobase', 'centro'], ['Rassemblement Valdôtain', 'centro-destra'], ['Volt Italia', 'centro'], ["Patto per l'Autonomia", 'centro'],
  ['Democrazia Cristiana con Rotondi', 'centro'], ['Partito Liberaldemocratico', 'centro'], ['Forza del Popolo', 'destra'], ['Sinistra Futura - Costituente per la Nuova Sinistra', 'sinistra'],
  ['Movimento Cinque Stelle', 'centro-sinistra'], ['Più Europa', 'centro'], ['Futuro Nazionale', 'destra'],
  ['Movimento politico Forza Italia', 'centro-destra'], ['Movimento politico Pensiero e Azione', 'centro']
];
// The MEF 2‰ list names two registered forces differently: same organisation, kept for the 2‰ figures, never shown twice.
const SAME_ENTITY = { 'party-mef-2025-15': 'party-registro-p1-2022-63-ir', 'party-mef-2025-21': 'party-registro-p1-2018-47-ir' };

// ---------- §4: new entities, each sourced to the organisation's official site ----------
const NEW_ORGANIZATIONS = [
  { file: 'political-movements.json', id: 'movement-forza-nuova', entityType: 'politicalMovement', organizationType: 'movimento/partito', officialName: 'Forza Nuova', website: 'https://www.forzanuova1997.it/', position: 'estrema destra', ...meta('https://www.forzanuova1997.it/', 'Forza Nuova — sito ufficiale') },
  { file: 'political-movements.json', id: 'movement-casapound-italia', entityType: 'politicalMovement', organizationType: 'movimento', officialName: 'CasaPound Italia', website: 'https://casapounditalia.org/', position: 'estrema destra', ...meta('https://casapounditalia.org/', 'CasaPound Italia — sito ufficiale') },
  { file: 'parties.json', id: 'party-democrazia-sovrana-popolare', entityType: 'party', organizationType: 'partito', officialName: 'Democrazia Sovrana Popolare', website: 'https://democraziasovranapopolare.it/', position: 'sinistra', ...meta('https://democraziasovranapopolare.it/democrazia-sovrana-popolare/', 'Democrazia Sovrana Popolare — sito ufficiale') },
  { file: 'parties.json', id: 'party-partito-popolare-del-nord', entityType: 'party', organizationType: 'partito', officialName: 'Partito Popolare del Nord - Autonomia e Libertà', website: 'https://partitopopolarenord.org/', position: 'centro-destra', ...meta('https://partitopopolarenord.org/lo-statuto/', 'Partito Popolare del Nord — statuto sul sito ufficiale') },
  { file: 'political-movements.json', id: 'movement-potere-al-popolo', entityType: 'politicalMovement', organizationType: 'movimento/partito', officialName: 'Potere al Popolo!', website: 'https://poterealpopolo.org/', position: 'estrema sinistra', ...meta('https://poterealpopolo.org/organizzazione/', 'Potere al Popolo! — organizzazione, sito ufficiale') },
  { file: 'parties.json', id: 'party-partito-comunista-italiano', entityType: 'party', organizationType: 'partito', officialName: 'Partito Comunista Italiano', abbreviation: 'PCI', website: 'https://www.ilpartitocomunistaitaliano.it/', position: 'sinistra', ...meta('https://www.ilpartitocomunistaitaliano.it/', 'Partito Comunista Italiano — sito ufficiale') },
  { file: 'parties.json', id: 'party-partito-comunista-dei-lavoratori', entityType: 'party', organizationType: 'partito', officialName: 'Partito Comunista dei Lavoratori', abbreviation: 'PCL', website: 'https://pclavoratori.it/', position: 'estrema sinistra', ...meta('https://pclavoratori.it/', 'Partito Comunista dei Lavoratori — sito ufficiale') },
  { file: 'parties.json', id: 'party-partito-sardo-d-azione', entityType: 'party', organizationType: 'partito regionale', officialName: 'Partito Sardo d’Azione', abbreviation: 'PSd’Az', website: 'http://www.psdaz.net/', level: 'regional', regionId: 'it-region-20', geographicArea: 'Sardegna', position: 'centro-destra', ...meta('http://www.psdaz.net/index.php/organizatzione/segreteria-nazionale/2-partito', 'Partito Sardo d’Azione — segreteria nazionale, sito ufficiale') },
  { file: 'political-movements.json', id: 'movement-rete-dei-patrioti', entityType: 'politicalMovement', organizationType: 'movimento politico', officialName: 'Rete dei Patrioti', website: 'https://retedeipatrioti.it/', position: 'estrema destra', ...meta('https://retedeipatrioti.it/chi-siamo/', 'Rete dei Patrioti — chi siamo, sito ufficiale') },
  { file: 'parties.json', id: 'party-ora', entityType: 'party', organizationType: 'partito', officialName: 'ORA!', website: 'https://ora-italia.it/', position: 'centro', ...meta('https://ora-italia.it/la-struttura-del-partito/', 'ORA! — struttura del partito, sito ufficiale'), secondarySources: [meta('https://ora-italia.it/', 'ORA! — sito ufficiale')] }
];
const COALITIONS = [
  { id: 'coalition-alleanza-verdi-sinistra', entityType: 'coalition', coalitionType: 'coalizione/lista elettorale', officialName: 'Alleanza Verdi e Sinistra', abbreviation: 'AVS', website: 'https://verdisinistra.it/', componentPartyIds: ['party-registro-p1-2014-13-ir', 'party-registro-p1-2017-44-ir'], leadership: null, position: 'sinistra', ...meta('https://verdisinistra.it/', 'Alleanza Verdi e Sinistra — sito ufficiale'), secondarySources: [meta('https://www.sinistraitaliana.si/chi-siamo/alleanza-verdi-sinistra/', 'Sinistra Italiana — Alleanza Verdi e Sinistra')] }
];
const EUROPEAN_LISTS = [
  ['Libertà', 'centro'], ['Stati Uniti d’Europa', 'centro'], ['Pace Terra Dignità', 'sinistra'], ['Partito Animalista - Italexit per l’Italia', 'destra']
];
// “Liberali Democratici Europei” is reconciled with the Partito Liberaldemocratico record: a name, not a second record.
const ALIASES = { 'party-registro-p1-2024-74-ir': [{ name: 'Liberali Democratici Europei', note: `Riconciliato con il Partito Liberaldemocratico come indicato nel documento (${DOCUMENT}, §4): nessun record separato.` }] };
// Official sites confirmed while verifying the leadership (filled only where the dataset has none).
const WEBSITES = {
  'party-registro-p1-2014-01-ir': 'http://www.rifondazione.it/', 'party-registro-p1-2015-28-ir': 'https://www.partitoliberaleitaliano.org/', 'party-registro-p1-2014-05-ir': 'https://www.partitosocialista.it/',
  'party-registro-p1-2015-29-ir': 'https://partitodemocratico.it/', 'party-registro-p1-2014-04-ir': 'https://www.fratelli-italia.it/', 'party-registro-p1-2017-41-ir': 'https://legaonline.it/',
  'party-registro-p1-2022-63-ir': 'https://www.movimento5stelle.eu/', 'party-registro-p1-2019-51-ir': 'https://www.azione.it/', 'party-registro-p1-2019-52-ir': 'https://www.italiaviva.it/',
  'party-registro-p1-2018-47-ir': 'https://www.piueuropa.eu/', 'party-registro-p1-2017-44-ir': 'https://www.sinistraitaliana.si/', 'party-registro-p1-2014-13-ir': 'https://europaverde.it/',
  'party-registro-p1-2015-17-ir': 'https://www.ilcentrodemocratico.it/', 'party-registro-p1-2015-18-ir': 'https://www.italiadeivalori.it/', 'party-registro-p1-2015-25-ir': 'https://www.udc-italia.it/',
  'party-registro-p1-2017-43-ir': 'https://www.democraziasolidale.it/', 'party-registro-p1-2020-56-ir': 'https://www.noimoderati.it/', 'party-registro-p1-2024-74-ir': 'https://partitoliberaldemocratico.com/',
  'party-registro-p1-2015-14-ir': 'https://www.maiemondiale.com/'
};

// ---------- §3: leadership, each role sourced to the organisation's official page ----------
const L = (partyId, role, fullName, sourceUrl, sourceName) => ({ partyId, role, fullName, sourceUrl, sourceName });
const LEADERSHIP = [
  L('party-registro-p1-2014-01-ir', 'Segretario nazionale', 'Maurizio Acerbo', 'http://web.rifondazione.it/home/index.php/segretario', 'Rifondazione Comunista — il segretario, sito ufficiale'),
  L('party-registro-p1-2015-28-ir', 'Presidente', 'Stefano de Luca', 'https://www.partitoliberaleitaliano.org/squadra/', 'Partito Liberale Italiano — squadra, sito ufficiale'),
  L('party-registro-p1-2015-28-ir', 'Segretario', 'Grazio Trufolo', 'https://www.partitoliberaleitaliano.org/squadra/', 'Partito Liberale Italiano — squadra, sito ufficiale'),
  L('party-registro-p1-2014-05-ir', 'Segretario nazionale', 'Vincenzo Maraio', 'https://www.partitosocialista.it/noi/il-segretario/', 'Partito Socialista Italiano — il segretario, sito ufficiale'),
  L('party-registro-p1-2015-29-ir', 'Segretaria nazionale', 'Elly Schlein', 'https://partitodemocratico.it/dem/elly-schlein/', 'Partito Democratico — Elly Schlein, sito ufficiale'),
  L('party-registro-p1-2014-04-ir', 'Presidente', 'Giorgia Meloni', 'https://www.fratelli-italia.it/esecutivo-nazionale-2/', 'Fratelli d’Italia — esecutivo nazionale, sito ufficiale'),
  L('party-registro-p1-2017-41-ir', 'Segretario federale', 'Matteo Salvini', 'https://legaonline.it/organigramma/', 'Lega per Salvini Premier — organigramma, sito ufficiale'),
  L('party-registro-p1-2022-63-ir', 'Presidente', 'Giuseppe Conte', 'https://www.movimento5stelle.eu/giuseppe-conte-eletto-presidente-del-movimento-5-stelle/', 'MoVimento 5 Stelle — elezione del Presidente, sito ufficiale'),
  L('party-registro-p1-2019-51-ir', 'Segretario', 'Carlo Calenda', 'https://www.azione.it/organi-nazionali/segreteria-nazionale/', 'Azione — segreteria nazionale, sito ufficiale'),
  L('party-registro-p1-2019-52-ir', 'Presidente dell’Associazione', 'Matteo Renzi', 'https://www.italiaviva.it/', 'Italia Viva — sito ufficiale'),
  L('party-registro-p1-2018-47-ir', 'Segretario', 'Riccardo Magi', 'https://www.piueuropa.eu/cariche', '+Europa — cariche, sito ufficiale'),
  L('party-registro-p1-2017-44-ir', 'Segretario nazionale', 'Nicola Fratoianni', 'https://www.sinistraitaliana.si/chi-siamo/segreteria-nazionale/', 'Sinistra Italiana — segreteria nazionale, sito ufficiale'),
  L('party-registro-p1-2014-13-ir', 'Co-portavoce nazionale', 'Angelo Bonelli', 'https://europaverde.it/i-due-portavoce/', 'Europa Verde — i due portavoce, sito ufficiale'),
  L('party-registro-p1-2015-17-ir', 'Presidente nazionale', 'Bruno Tabacci', 'https://www.ilcentrodemocratico.it/ufficio-di-presidenza/', 'Centro Democratico — ufficio di presidenza e segreteria, sito ufficiale'),
  L('party-registro-p1-2015-17-ir', 'Segretario nazionale', 'Margherita Rebuffoni', 'https://www.ilcentrodemocratico.it/ufficio-di-presidenza/', 'Centro Democratico — ufficio di presidenza e segreteria, sito ufficiale'),
  L('party-registro-p1-2015-18-ir', 'Segretario nazionale', 'Ignazio Messina', 'https://www.italiadeivalori.it/esecutivonazionale', 'Italia dei Valori — esecutivo nazionale, sito ufficiale'),
  L('party-registro-p1-2015-25-ir', 'Segretario nazionale', 'Antonio De Poli', 'https://www.udc-italia.it/view/segretario/', 'UDC — segretario, sito ufficiale'),
  L('party-registro-p1-2015-25-ir', 'Presidente nazionale', 'Lorenzo Cesa', 'https://www.udc-italia.it/', 'UDC — sito ufficiale'),
  L('party-registro-p1-2017-43-ir', 'Segretario nazionale', 'Paolo Ciani', 'https://www.democraziasolidale.it/organi-nazionali/', 'Democrazia Solidale — organi nazionali, sito ufficiale'),
  L('party-registro-p1-2020-56-ir', 'Presidente', 'Maurizio Lupi', 'https://www.noimoderati.it/il-partito', 'Noi Moderati — il partito, sito ufficiale'),
  L('party-registro-p1-2024-74-ir', 'Segretario nazionale', 'Luigi Marattin', 'https://partitoliberaldemocratico.com/', 'Partito Liberaldemocratico — sito ufficiale'),
  L('party-registro-p1-2014-09-ir', 'Segretario politico', 'Simone Marchiori', 'https://patt.tn.it/partito/organizzazione/organi-e-cariche/', 'PATT — organi e cariche, sito ufficiale'),
  L('party-registro-p1-2014-09-ir', 'Presidente', 'Mauro Verones', 'https://patt.tn.it/partito/organizzazione/organi-e-cariche/', 'PATT — organi e cariche, sito ufficiale'),
  L('party-registro-p1-2015-14-ir', 'Presidente', 'Ricardo Merlo', 'https://www.maiemondiale.com/index.php/chisiamo/', 'MAIE — chi siamo, sito ufficiale'),
  L('movement-forza-nuova', 'Segretario nazionale', 'Roberto Fiore', 'https://www.forzanuova1997.it/', 'Forza Nuova — sito ufficiale'),
  L('movement-casapound-italia', 'Figura di riferimento / fondatore', 'Gianluca Iannone', 'https://casapounditalia.org/', 'CasaPound Italia — sito ufficiale'),
  L('party-democrazia-sovrana-popolare', 'Presidente', 'Francesco Toscano', 'https://democraziasovranapopolare.it/democrazia-sovrana-popolare/', 'Democrazia Sovrana Popolare — sito ufficiale'),
  L('party-partito-popolare-del-nord', 'Segretario', 'Roberto Castelli', 'https://partitopopolarenord.org/', 'Partito Popolare del Nord — sito ufficiale'),
  L('movement-potere-al-popolo', 'Portavoce', 'Marta Collot', 'https://poterealpopolo.org/collot-granato-portavoce-nuovo-coordinamento-nazionale-commissione-garanzia/', 'Potere al Popolo! — portavoce nazionali, sito ufficiale'),
  L('movement-potere-al-popolo', 'Portavoce', 'Giuliano Granato', 'https://poterealpopolo.org/collot-granato-portavoce-nuovo-coordinamento-nazionale-commissione-garanzia/', 'Potere al Popolo! — portavoce nazionali, sito ufficiale'),
  L('party-partito-comunista-italiano', 'Segretario generale', 'Mauro Alboresi', 'https://www.ilpartitocomunistaitaliano.it/organizzazione/alboresi-mauro/', 'Partito Comunista Italiano — organizzazione, sito ufficiale'),
  L('party-partito-sardo-d-azione', 'Segretario nazionale', 'Christian Solinas', 'http://www.psdaz.net/index.php/organizatzione/segreteria-nazionale/2-partito', 'Partito Sardo d’Azione — segreteria nazionale, sito ufficiale'),
  L('party-ora', 'Segretario', 'Michele Boldrin', 'https://ora-italia.it/la-struttura-del-partito/', 'ORA! — struttura del partito, sito ufficiale'),
  L('party-ora', 'Presidente', 'Alberto Forchielli', 'https://ora-italia.it/la-struttura-del-partito/', 'ORA! — struttura del partito, sito ufficiale')
];

// ---------- §6: election lists → parties (single-party lists only; multi-party lists keep their components) ----------
const LIST_LINKS = {
  "FRATELLI D'ITALIA CON GIORGIA MELONI": { partyId: 'party-registro-p1-2014-04-ir', listType: 'lista di partito' },
  'PARTITO DEMOCRATICO - ITALIA DEMOCRATICA E PROGRESSISTA': { partyId: 'party-registro-p1-2015-29-ir', listType: 'lista di partito' },
  'MOVIMENTO 5 STELLE': { partyId: 'party-registro-p1-2022-63-ir', listType: 'lista di partito' },
  'LEGA PER SALVINI PREMIER': { partyId: 'party-registro-p1-2017-41-ir', listType: 'lista di partito' },
  'FORZA ITALIA': { partyId: 'party-registro-p1-2015-20-ir', listType: 'lista di partito' },
  'AZIONE - ITALIA VIVA - CALENDA': { componentPartyIds: ['party-registro-p1-2019-51-ir', 'party-registro-p1-2019-52-ir'], listType: 'lista di più partiti' },
  'ALLEANZA VERDI E SINISTRA': { coalitionId: 'coalition-alleanza-verdi-sinistra', componentPartyIds: ['party-registro-p1-2014-13-ir', 'party-registro-p1-2017-44-ir'], listType: 'lista di coalizione' },
  'SÜDTIROLER VOLKSPARTEI (SVP) - PATT': { componentPartyIds: ['party-registro-p1-2015-19-ir', 'party-registro-p1-2014-09-ir'], listType: 'lista di più partiti' },
  'LEGA PER SALVINI PREMIER - FORZA ITALIA - FRATELLI D\'ITALIA': { listType: 'coalizione/lista 2022 — non partito singolo' },
  'FRATELLI D\'ITALIA - LEGA - NM - UDC - FI-PPE': { listType: 'coalizione/lista 2022 — non partito singolo' },
  'SUD CHIAMA NORD': { partyId: 'party-registro-p1-2022-67-ir', listType: 'lista di partito' },
  "VALLÉE D'AOSTE - AUTONOMIE PROGRÈS FÉDÉRALISME": { listType: 'lista autonoma — nessun partito singolo dedotto' },
  "MOVIMENTO ASSOCIATIVO ITALIANI ALL'ESTERO - MAIE": { partyId: 'party-registro-p1-2015-14-ir', listType: 'lista di partito' }
};

// ---------- the first real poll the game opens with (then the simulation takes over) ----------
const POLLS = [{
  id: 'poll-supermedia-youtrend-agi-2026-09-17', kind: 'supermedia', label: 'Supermedia YouTrend/Agi', publishedAt: '2026-09-17', fieldworkFrom: '2026-09-02', fieldworkTo: '2026-09-16',
  method: 'Media ponderata dei sondaggi nazionali sulle intenzioni di voto',
  includedPolls: ['EMG (10/09)', 'Ixè (10/09)', 'Noto (08/09)', 'Only Numbers (04, 11 e 15/09)', 'Piepoli (11/09)', 'SWG (07 e 14/09)', 'Tecnè (07 e 09/09)', 'YouTrend (04/09)'],
  results: [
    { label: 'Fratelli d’Italia', entityId: 'party-registro-p1-2014-04-ir', share: 26.6, delta: -0.3 },
    { label: 'Partito Democratico', entityId: 'party-registro-p1-2015-29-ir', share: 21.1, delta: 0.1 },
    { label: 'Movimento 5 Stelle', entityId: 'party-registro-p1-2022-63-ir', share: 12.5, delta: 0.4 },
    { label: 'Futuro Nazionale', entityId: 'party-futuro-nazionale', share: 7.7, delta: 0.1 },
    { label: 'Forza Italia', entityId: 'party-registro-p1-2015-20-ir', share: 7.4, delta: -0.2 },
    { label: 'Alleanza Verdi e Sinistra', entityId: 'coalition-alleanza-verdi-sinistra', share: 6.4, delta: 0.1 },
    { label: 'Lega', entityId: 'party-registro-p1-2017-41-ir', share: 5.6, delta: 0 },
    { label: 'Azione', entityId: 'party-registro-p1-2019-51-ir', share: 3.3, delta: -0.4 },
    { label: 'Italia Viva', entityId: 'party-registro-p1-2019-52-ir', share: 2.3, delta: -0.1 },
    { label: '+Europa', entityId: 'party-registro-p1-2018-47-ir', share: 1.5, delta: 0.1 },
    { label: 'Partito Liberaldemocratico', entityId: 'party-registro-p1-2024-74-ir', share: 1.4, delta: null },
    { label: 'Noi Moderati', entityId: 'party-registro-p1-2020-56-ir', share: 1.1, delta: 0.1 }
  ],
  coalitions: [{ label: 'Centrodestra (coalizione di governo)', share: 40.7 }, { label: 'Campo largo', share: 42.3 }],
  ...meta('https://www.agi.it/politica/news/2026-09-17/supermedia-agi-youtrend-39116714/', 'Agi — Supermedia AGI/YouTrend del 17 settembre 2026', '2026-09-17'),
  secondarySources: [meta('https://www.liberoquotidiano.it/news/politica/49162501/supermedia-finita-cavalcata-futuro-nazionale-chi-sale-chi-scende-tutte-le-cifre/', 'Libero Quotidiano — tutte le cifre della Supermedia del 17/09/2026', '2026-09-17')]
}];

// ---------- apply ----------
const files = {};
for (const name of ['parties.json', 'political-movements.json', 'coalitions.json', 'electoral-lists.json', 'political-figures.json', 'party-leaderships.json', 'party-memberships.json', 'politicians.json', 'manifest.json', 'database.json']) files[name] = await read(name);
const organizations = () => [...files['parties.json'], ...files['political-movements.json']];
const upsert = (list, record) => { const index = list.findIndex(item => item.id === record.id); if (index >= 0) list[index] = { ...list[index], ...record }; else list.push(record); };

// §4 new organisations (fields of the shared model, unknown values null).
for (const { file, position, ...spec } of NEW_ORGANIZATIONS) {
  const base = { entityType: spec.entityType, officialName: spec.officialName, abbreviation: null, factualDescription: null, color: null, website: null, level: null, geographicArea: null, regionId: null, status: 'active', parliamentaryPresence: null, regionalPresence: null, localPresence: null, foundedAt: null, registeredAt: null, leadership: [], ...logoModel };
  upsert(files[file], { ...base, ...spec, politicalPosition: position, ...positionNote('§2 e §4'), documentRef: `${DOCUMENT}, §4` });
}
for (const { position, ...spec } of COALITIONS) upsert(files['coalitions.json'], { ...spec, status: null, color: null, ...logoModel, politicalPosition: position, ...positionNote('§2 e §4'), documentRef: `${DOCUMENT}, §4` });
for (const [name, position] of EUROPEAN_LISTS) upsert(files['electoral-lists.json'], {
  id: `electoral-list-europee-2024-${slug(name)}`, officialName: name, electionId: 'election-it-europee-2024', chamber: null, constituency: null, coalitionId: null, partyId: null, componentPartyIds: [], ballotSymbol: null,
  listType: 'lista elettorale', leadership: null, politicalPosition: position, ...positionNote('§2 e §4'), documentRef: `${DOCUMENT}, §4`,
  ...meta('https://dait.interno.gov.it/elezioni/trasparenza/elezioni-europee-2024', 'Ministero dell’Interno — Trasparenza, elezioni europee 2024', '2024-06-08'), validTo: '2024-06-09'
});

// §2 collocazione for every existing entity, matched by exact name; nothing else is overwritten.
const byName = new Map(organizations().map(item => [norm(item.officialName), item]));
const missing = [];
for (const [name, position] of COLLOCAZIONE) {
  const record = byName.get(norm(name));
  if (!record) { missing.push(name); continue; }
  if (!POSITIONS.includes(position)) throw new Error(`Collocazione non valida: ${position}`);
  Object.assign(record, { politicalPosition: position, ...positionNote('§2') });
}
if (missing.length) throw new Error(`Entità del documento non trovate: ${missing.join(', ')}`);
for (const [id, canonical] of Object.entries(SAME_ENTITY)) Object.assign(organizations().find(item => item.id === id), { sameEntityAs: canonical, sameEntityNote: 'Denominazione usata dal MEF per il 2‰ della stessa forza iscritta al Registro: non è un secondo partito.' });
for (const [id, aliases] of Object.entries(ALIASES)) organizations().find(item => item.id === id).aliases = aliases;
for (const [id, website] of Object.entries(WEBSITES)) { const record = organizations().find(item => item.id === id); if (!record.website) record.website = website; }

// §3 figures and roles; a figure is the same person as a parliamentarian only when the full name matches exactly.
const people = files['politicians.json'];
const personByName = new Map();
for (const person of people) { const key = norm(person.fullName); personByName.set(key, personByName.has(key) ? null : person); }
for (const item of LEADERSHIP) {
  if (!organizations().some(entry => entry.id === item.partyId)) throw new Error(`Leadership senza entità: ${item.partyId}`);
  const figureId = `figure-${slug(item.fullName)}`;
  const [firstName, ...rest] = item.fullName.split(' ');
  const person = personByName.get(norm(item.fullName)) ?? null;
  const existing = files['political-figures.json'].find(entry => entry.id === figureId);
  upsert(files['political-figures.json'], existing ? { id: figureId, politicianId: existing.politicianId ?? person?.id ?? null } : { id: figureId, firstName, lastName: rest.join(' '), fullName: item.fullName, birthDate: null, birthPlace: null, politicianId: person?.id ?? null, ...meta(item.sourceUrl, item.sourceName) });
  const known = files['party-leaderships.json'].find(entry => entry.partyId === item.partyId && entry.politicalFigureId === figureId && entry.role === item.role);
  if (!known) files['party-leaderships.json'].push({ id: `party-leadership-${slug(item.partyId.replace(/^party-registro-p1-|^party-|^movement-/, ''))}-${slug(item.role)}-${slug(item.fullName)}`, partyId: item.partyId, politicalFigureId: figureId, role: item.role, documentRef: `${DOCUMENT}, §3`, ...meta(item.sourceUrl, item.sourceName) });
}
// The Futuro Nazionale figures already in the dataset are linked the same way.
for (const figure of files['political-figures.json']) if (!figure.politicianId) figure.politicianId = personByName.get(norm(figure.fullName))?.id ?? null;
// A documented party office is a documented membership of that party.
for (const leadership of files['party-leaderships.json']) {
  const figure = files['political-figures.json'].find(entry => entry.id === leadership.politicalFigureId);
  if (!figure?.politicianId) continue;
  upsert(files['party-memberships.json'], { id: `party-membership-${figure.politicianId}-${leadership.partyId}`, politicianId: figure.politicianId, partyId: leadership.partyId, basis: 'incarico di partito documentato', role: leadership.role, ...meta(leadership.sourceUrl, leadership.sourceName) });
}

// §6 list links.
for (const list of files['electoral-lists.json']) {
  const link = LIST_LINKS[list.officialName];
  if (!link) continue;
  Object.assign(list, { partyId: link.partyId ?? null, coalitionId: link.coalitionId ?? null, componentPartyIds: link.componentPartyIds ?? [], listType: link.listType, listLinkSource: `${DOCUMENT}, §6` });
}
const unlinked = files['electoral-lists.json'].filter(list => list.electionId === 'election-it-politiche-2022' && !list.listType);
if (unlinked.length) throw new Error(`Liste senza collegamento: ${unlinked.map(item => item.officialName).join(', ')}`);

// ---------- write back, aggregate and manifest ----------
const collections = { parties: 'parties.json', politicalMovements: 'political-movements.json', coalitions: 'coalitions.json', electoralLists: 'electoral-lists.json', politicalFigures: 'political-figures.json', partyLeaderships: 'party-leaderships.json', partyMemberships: 'party-memberships.json' };
for (const [name, file] of Object.entries(collections)) { await save(file, files[file]); files['database.json'][name] = files[file]; }
// The opening poll is kept up to date by later imports (scripts/import-update-2026-09-25.mjs): an older one never overwrites it.
const currentPolls = JSON.parse(await readFile(new URL('polls.json', ROOT), 'utf8').catch(() => '[]'));
const latestPoll = currentPolls.map(item => item.publishedAt).sort().at(-1) ?? '';
if (!latestPoll || latestPoll <= POLLS[0].publishedAt) await save('polls.json', POLLS);
const manifest = files['manifest.json'];
manifest.datasetVersion = '2026-09-24.1';
manifest.snapshotDate = AS_OF;
manifest.specification = { title: DOCUMENT, asOf: AS_OF, sections: ['§2 collocazione', '§3 leadership', '§4 nuove entità', '§6 collegamento liste → partiti'] };
for (const [name, file] of Object.entries(collections)) manifest.collections[name] = files[file].length;
manifest.collections.realPolls = latestPoll > POLLS[0].publishedAt ? currentPolls.length : POLLS.length;
manifest.sourceUrls = { ...manifest.sourceUrls, ...(latestPoll > POLLS[0].publishedAt ? {} : { supermedia20260917: POLLS[0].sourceUrl }), oraStructure: 'https://ora-italia.it/la-struttura-del-partito/', cameraGroupsList: 'https://www.camera.it/leg19/217', senateGroupsList: 'https://www.senato.it/composizione/gruppi-parlamentari/', partyRegisterList: 'https://www.parlamento.it/1063' };
manifest.warnings = [...new Set([...(manifest.warnings ?? []), 'La collocazione politica (estrema sinistra … estrema destra) è la classificazione sintetica del documento di specifica del 24/09/2026; per liste e coalizioni indica l’aggregazione e non sostituisce le singole componenti.', 'Le liste con più partiti o coalizioni restano relazioni elettorali: non diventano iscrizione a un singolo partito. Le iscrizioni individuali documentate derivano solo da incarichi di partito verificati.', 'Il sondaggio iniziale è la Supermedia YouTrend/Agi del 17/09/2026 (dato reale); dalla prima settimana di gioco i sondaggi sono simulati.'])];
// The aggregate keeps its own manifest: only the collections it contains are counted there.
const aggregate = files['database.json'].manifest;
files['database.json'].manifest = { ...aggregate, datasetVersion: manifest.datasetVersion, snapshotDate: AS_OF, specification: manifest.specification, sourceUrls: manifest.sourceUrls, warnings: manifest.warnings, collections: { ...aggregate.collections, ...Object.fromEntries(Object.keys(collections).map(name => [name, files['database.json'][name].length])) } };
await save('manifest.json', manifest);
await save('database.json', files['database.json']);
console.log(`Documento integrato: ${files['parties.json'].length} partiti, ${files['political-movements.json'].length} movimenti, ${files['coalitions.json'].length} coalizioni, ${files['electoral-lists.json'].length} liste, ${files['political-figures.json'].length} figure (${files['political-figures.json'].filter(item => item.politicianId).length} collegate a parlamentari), ${files['party-leaderships.json'].length} incarichi, ${files['party-memberships.json'].length} iscrizioni documentate, ${POLLS[0].results.length} forze nel sondaggio reale iniziale.`);
