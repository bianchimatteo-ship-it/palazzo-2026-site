import { mkdir, writeFile } from 'node:fs/promises';

// Rebuilds the bundled real-data snapshot from primary Italian institutional sources.
// No simulation or user records are touched. Unknown fields deliberately remain null.
const AS_OF = '2026-09-22';
const ROOT = new URL('../src/data/real/', import.meta.url);
const urls = {
  cameraRoster: 'https://www.camera.it/deputati/ws/elenco_deputati?_format=json&leg=19',
  cameraDirectory: 'https://www.camera.it/deputati/elenco',
  cameraGroups: 'https://www.camera.it/leg19/217',
  senateOpenData: 'https://dati.senato.it/sito/composizione?legislatura=19&testo_generico=11',
  senateMembers: 'https://dati.senato.it/sito/composizione?legislatura=19&testo_generico=11',
  senateGroups: 'https://dati.senato.it/sito/composizione?legislatura=19&testo_generico=11&active_tab_78=80',
  mefTwoPerThousand: 'https://www1.finanze.gov.it/finanze/2xmille/public/index.php?aggiornato=1522252800&export=1&page=1&tree=2025AADUEXM0101',
  partyRegister: 'https://www.parlamento.it/Parlamento/1063',
  interiorEuropeanTransparency: 'https://dait.interno.gov.it/elezioni/trasparenza/elezioni-europee-2024',
  interiorElectionArchive: 'https://www.interno.gov.it/it/temi/elezioni-e-referendum/dato-storico-elezioni'
};
const SOURCE = 'real';
const mefPartyNames = [
  ['azione','Azione'],['campobase','Campobase'],['centro-democratico','Centro Democratico'],['coraggio-italia','Coraggio Italia'],['dc-rotondi','Democrazia Cristiana con Rotondi'],['demos','Democrazia Solidale - DemoS'],['europa-verde','Europa Verde-Verdi'],['fdi-an','Fratelli d\'Italia - Alleanza Nazionale'],['idv','Italia dei Valori'],['italia-viva','Italia Viva'],['lega-nord-padania','Lega Nord per l\'Indipendenza della Padania'],['lega-salvini','Lega per Salvini Premier'],['italia-ce','L\'Italia c\'è!'],['maie','Movimento Associativo Italiani all\'Estero - MAIE'],['m5s','Movimento Cinque Stelle'],['forza-italia','Movimento politico Forza Italia'],['noi-moderati','Noi Moderati'],['patt','Partito Autonomista Trentino Tirolese'],['pd','Partito Democratico'],['psi','Partito Socialista Italiano'],['piu-europa','Più Europa'],['possibile','Possibile'],['radicali-italiani','Radicali Italiani'],['sinistra-italiana','Sinistra Italiana'],['stella-alpina','Stella Alpina'],['sud-chiama-nord','Sud chiama Nord'],['svp','Sudtiroler Volkspartei'],['union-valdotaine','Union Valdotaine'],['usei','Unione Sudamericana Emigrati Italiani'],['volt-italia','Volt Italia']
].map(([, name], index, rows) => [String(index + 1).padStart(2, '0'), name]);
const labels = Object.fromEntries(mefPartyNames);
const cameraGroupIds = new Map([
  ["MoVimento 5 Stelle",'cam-xix-07'],["Fratelli d'Italia",'cam-xix-01'],['Partito Democratico - Italia Democratica e Progressista','cam-xix-02'],['Lega - Salvini Premier','cam-xix-03'],['Forza Italia - Berlusconi Presidente - PPE','cam-xix-04'],['Azione-Popolari europeisti riformatori-Renew Europe','cam-xix-05'],['MISTO-Futuro Nazionale Vannacci - Free','cam-xix-12'],['Alleanza Verdi e Sinistra','cam-xix-06'],['Italia Viva-Casa Riformista','cam-xix-08'],["NOI MODERATI (NOI CON L'ITALIA, CORAGGIO ITALIA, UDC E ITALIA AL CENTRO)-MAIE-CENTRO POPOLARE",'cam-xix-09'],['MISTO','cam-xix-10'],["MISTO-+Europa - Stati Uniti d'Europa",'cam-xix-13'],['MISTO-Minoranze Linguistiche','cam-xix-11']
]);
const meta = (sourceUrl, sourceName, validFrom = null, validTo = null) => ({ source: SOURCE, verified: true, sourceUrl, sourceName, verifiedAt: AS_OF, validFrom, validTo });
const save = (name, value) => writeFile(new URL(name, ROOT), `${JSON.stringify(value, null, 2)}\n`);
const fetchText = async url => { const r = await fetch(url, { headers: { 'user-agent': 'Politicando2026 open-data importer (contact: project README)' } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); };
const fetchJson = async url => JSON.parse(await fetchText(url));
const literal = value => value?.value ?? null;

async function senateQuery(pageUrl, tab, formId, searchDate = AS_OF) {
  const url = `${pageUrl}${tab ? `&active_tab_78=${tab}` : ''}`;
  const response = await fetch(url); if (!response.ok) throw new Error(`Senato ${response.status}`);
  const html = await response.text();
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  const escapedId = String(formId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const form = html.match(new RegExp(`<form[^>]*id="${escapedId}"[^>]*>[\\s\\S]*?<\\/form>`, 'i'))?.[0];
  if (!form || !cookie) throw new Error(`Modulo Senato ${formId} non trovato`);
  const payload = {};
  for (const [, key, value] of form.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/gi)) payload[key] = value;
  if (payload['search[data]']) payload['search[data]'] = searchDate;
  payload.query_format = 'json'; payload.commit = 'Download';
  const action = form.match(/action="([^"]+)"/)?.[1];
  const result = await fetch(new URL(action, 'https://dati.senato.it'), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, referer: url }, body: new URLSearchParams(payload) });
  if (!result.ok) throw new Error(`Download Senato ${result.status}`);
  return result.json();
}

await mkdir(ROOT, { recursive: true });
const registerHtml = await fetchText(urls.partyRegister);
const cleanHtml = value => value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g,'&').replace(/&#039;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]/g,'');
const registered = [];
for (const match of registerHtml.matchAll(/<tr[^>]*id="lista_delibere_partiti_li_(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const tableRow = match[2];
  const name = cleanHtml(tableRow.match(/<span class="partito">([\s\S]*?)<\/span>/i)?.[1] ?? '');
  if (!name) continue;
  const firstCell = tableRow.match(/<td[^>]*class="delibera_linkata_kb"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? '';
  const href = firstCell.match(/href="([^"]+)"/)?.[1];
  const decisionText = cleanHtml(firstCell);
  const decision = decisionText.match(/Deliberazione\s+(\d{1,2})\s+([a-z]+)\s+(\d{4}),?\s*n\.?\s*(\d+)\/([A-Z]+)/i);
  if (!href || !decision) continue;
  const [, day, monthName, year, serial, kind] = decision;
  const months = {gennaio:'01',febbraio:'02',marzo:'03',aprile:'04',maggio:'05',giugno:'06',luglio:'07',agosto:'08',settembre:'09',ottobre:'10',novembre:'11',dicembre:'12'};
  const registeredAt = `${year}-${months[monthName.toLowerCase()] ?? '01'}-${day.padStart(2,'0')}`;
  const canonicalId = `party-registro-p1-${year}-${serial.padStart(2,'0')}-${kind.toLowerCase()}`;
  const rowText=cleanHtml(tableRow);
  const cancellationText=rowText.slice(rowText.toLowerCase().indexOf('cancellazione dal registro'));
  const cancellation=cancellationText.match(/Deliberazione\s+(\d{1,2})\s+([a-z]+)\s+(\d{4}),?\s*n\.?\s*(\d+)\/([A-Z]+)/i);
  const cancellationDate=cancellation ? `${cancellation[3]}-${months[cancellation[2].toLowerCase()]??'01'}-${cancellation[1].padStart(2,'0')}` : null;
  const deregistered = /Cancellazione dal registro/i.test(rowText);
  const explicitMovement = /^Movimento politico\b/i.test(name);
  const record = { id: canonicalId, entityType:explicitMovement?'politicalMovement':'party', officialName:name, abbreviation:null, factualDescription:null, color:null, website:null, level:null, geographicArea:null, regionId:null, status:deregistered?'historical':'active', parliamentaryPresence:null, regionalPresence:null, localPresence:null, foundedAt:null, registeredAt, leadership:[], registrationDecision:decisionText, ...meta(new URL(href,'https://www.parlamento.it').href,'Parlamento italiano — Commissione di garanzia, Registro nazionale dei partiti politici',registeredAt,deregistered?cancellationDate:null) };
  registered.push({ record, explicitMovement });
}
const parties = registered.filter(item => !item.explicitMovement).map(item => item.record);
const politicalMovements = registered.filter(item => item.explicitMovement).map(item => item.record);
// Add MEF annual evidence to an existing legal entity where the names match; otherwise
// retain a separate source-keyed entity. No similarity-based or fuzzy entity merges.
for (const [id,name] of mefPartyNames) {
  const same = [...parties, ...politicalMovements].find(item => normalize(item.officialName) === normalize(name));
  if (same) {
    same.twoPerThousandYear = 2025;
    same.secondarySources = [{ sourceUrl:urls.mefTwoPerThousand, sourceName:'Ministero dell’Economia e delle Finanze — 2 per mille, dichiarazioni 2025/redditi 2024', verifiedAt:AS_OF }];
  } else parties.push({ id:`party-mef-2025-${id}`, entityType:'party', officialName:name, abbreviation:null, factualDescription:null, color:null, website:null, level:null, geographicArea:null, regionId:null, status:null, parliamentaryPresence:null, regionalPresence:null, localPresence:null, foundedAt:null, registeredAt:null, leadership:[], twoPerThousandYear:2025, ...meta(urls.mefTwoPerThousand,'Ministero dell’Economia e delle Finanze — 2 per mille, dichiarazioni 2025/redditi 2024') });
}
const empty = [];

// Current Chamber list gives roster and parliamentary group. The official directory
// supplies a stable institutional deputy identifier; names are not used as IDs.
const [cameraRows, cameraHtml] = await Promise.all([fetchJson(urls.cameraRoster), fetchText(urls.cameraDirectory)]);
const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const personLinks = new Map();
const decode = s => s.replaceAll('&amp;','&').replaceAll('&#039;',"'").replaceAll('&apos;',"'").replaceAll('&quot;','"').replaceAll('&egrave;','è').replaceAll('&agrave;','à');
const readLinks = html => {
  for (const match of html.matchAll(/<a[^>]*href="\/deputati\/elenco\/19-(\d+)"[^>]*title="Vai alla scheda di ([^"]+)"/gi)) {
    const full = decode(match[2]).trim().toLocaleUpperCase('it-IT').replace(/\s+/g,' ');
    personLinks.set(full, match[1]);
  }
};
readLinks(cameraHtml);
await Promise.all(letters.map(async letter => {
  const html = await fetchText(`https://www.camera.it/deputati/elenco?leg=19&lettera=${letter}`); readLinks(html);
}));
const activeCameraRows = cameraRows.filter(row => !row.data_cessazione);
const cameraMonth = { gennaio:'01',febbraio:'02',marzo:'03',aprile:'04',maggio:'05',giugno:'06',luglio:'07',agosto:'08',settembre:'09',ottobre:'10',novembre:'11',dicembre:'12' };
const dateFromItalian = value => { const m=String(value??'').match(/(\d{1,2})\s+([a-zà]+)\s+(\d{4})/i); return m ? `${m[3]}-${cameraMonth[m[2].toLowerCase()]??'01'}-${m[1].padStart(2,'0')}` : null; };
const cameraDetailById = new Map();
const fetchCameraDetail = async officialId => {
  const profileUrl = `https://www.camera.it/deputati/elenco/19-${officialId}`;
  const html = await fetchText(profileUrl);
  const value = label => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const raw = html.match(new RegExp(`<span>\\s*${escaped}\\s*<\\/span>\\s*<strong>([\\s\\S]*?)<\\/strong>`, 'i'))?.[1];
    return raw ? cleanHtml(raw) : null;
  };
  cameraDetailById.set(officialId, {
    birthDate:dateFromItalian(value('DATA DI NASCITA')),
    birthPlace:value('COMUNE DI NASCITA'),
    circoscription:value('CIRCOSCRIZIONE DI ELEZIONE'),
    constituency:value('COLLEGIO DI ELEZIONE'),
    electedOnList:value('LISTA DI ELEZIONE'),
    termStart:dateFromItalian(value('PROCLAMAZIONE')),
    partyInfoSourceUrl:profileUrl
  });
};
const idsToFetch = activeCameraRows.map(row => { const key=`${row.cognome} ${row.nome}`.toLocaleUpperCase('it-IT').replace(/\s+/g,' ').trim(); const id=personLinks.get(key); if(!id) throw new Error(`ID istituzionale Camera non trovato per ${key}; import interrotto senza creare un ID derivato dal nome.`); return id; });
for (let i=0;i<idsToFetch.length;i+=12) await Promise.all(idsToFetch.slice(i,i+12).map(fetchCameraDetail));
const cameraPoliticians = activeCameraRows.map(row => {
  const key = `${row.cognome} ${row.nome}`.toLocaleUpperCase('it-IT').replace(/\s+/g,' ').trim();
  const officialId = personLinks.get(key); const details=cameraDetailById.get(officialId) ?? {};
  return {
    id: `camera-xix-deputato-${officialId}`, firstName: row.nome, lastName: row.cognome,
    fullName: `${row.nome} ${row.cognome}`, birthDate: details.birthDate ?? null, birthPlace: details.birthPlace ?? null, gender: null,
    chamber: 'camera', constituency: details.constituency ?? null, circoscription: details.circoscription ?? null, electedOnList: details.electedOnList ?? null, partyId: null,
    groupId: cameraGroupIds.get(row.gruppo) ?? null, roleIds: [],
    termStart: details.termStart ?? null, termEnd: null,
    ...meta(`https://www.camera.it/deputati/elenco/19-${officialId}`, 'Camera dei deputati — scheda anagrafica e mandato parlamentare', details.termStart ?? null)
  };
});
if (cameraPoliticians.length < 350) throw new Error(`Import Camera incompleto: ${cameraPoliticians.length} deputati in carica.`);

// Senato open-data queries are official CSV/JSON SPARQL exports. The source URI
// contains the stable person/group key; the group export supplies dated membership.
const [senateMembersData, senateGroupsData, senateGroupHistoryData] = await Promise.all([
  senateQuery(urls.senateMembers, '', 16), senateQuery(urls.senateGroups, '80', 3), senateQuery(urls.senateGroups, '80', 4)
]);
const senateBindings = senateMembersData.results.bindings;
const activeSenators = senateBindings.filter(row => !literal(row.dataFine));
const activeIds = new Set(activeSenators.map(row => literal(row.senatore)));
const senateGroupBindings = senateGroupsData.results.bindings.filter(row => activeIds.has(literal(row.senatore)));
const senateGroupHistoryBindings = senateGroupHistoryData.results.bindings.filter(row => activeIds.has(literal(row.senatore)));
const senPoliticiansById = new Map(activeSenators.map(row => {
  const uri = literal(row.senatore); const numeric = uri.match(/senatore\/(\d+)$/)?.[1];
  if (!numeric) throw new Error(`URI Senato non riconosciuto: ${uri}`);
  return [`senato-xix-senatore-${numeric}`, {
    id: `senato-xix-senatore-${numeric}`, firstName: literal(row.nome), lastName: literal(row.cognome),
    fullName: `${literal(row.nome)} ${literal(row.cognome)}`, birthDate: null, birthPlace: null, gender: null,
    chamber: 'senato', constituency: null, circoscription: null, partyId: null,
    groupId: null, roleIds: [], termStart: literal(row.dataInizio), termEnd: null,
    ...meta(uri, 'Senato della Repubblica — Open data composizione, senatori in carica alla data')
  }];
}));
if (activeSenators.length < 180) throw new Error(`Import Senato incompleto: ${activeSenators.length} senatori in carica.`);

const parliamentaryGroups = [];
const groupMemberships = [];
const currentCounts = new Map();
for (const [label, id] of cameraGroupIds) currentCounts.set(id, { label, chamber: 'camera', count: 0, url: urls.cameraGroups, sourceName: 'Camera dei deputati — XIX legislatura, composizione dei gruppi parlamentari' });
for (const person of cameraPoliticians) {
  if (!person.groupId) throw new Error(`Gruppo Camera non mappato per ${person.fullName}`);
  currentCounts.get(person.groupId).count++;
  groupMemberships.push({ id: `gm-${person.id}`, politicianId: person.id, groupId: person.groupId, chamber: 'camera', validFrom: null, validTo: null, office: null, ...meta(urls.cameraGroups, 'Camera dei deputati — XIX legislatura, composizione dei gruppi parlamentari') });
}
for (const [id, record] of currentCounts) parliamentaryGroups.push({ id, officialName: record.label, abbreviation: null, chamber: record.chamber, memberCount: record.count, countAsOf: AS_OF, leaderPoliticianId: null, constitutedAt: null, history: [], ...meta(record.url, record.sourceName) });
const senateGroups = new Map();
for (const row of senateGroupBindings) {
  const groupUri = literal(row.gruppo); const num = groupUri?.match(/gruppo\/(\d+)$/)?.[1];
  const senatorUri = literal(row.senatore); const politicianId = `senato-xix-senatore-${senatorUri?.match(/senatore\/(\d+)$/)?.[1]}`;
  if (!num || !senPoliticiansById.has(politicianId)) continue;
  const id = `senato-xix-gruppo-${num}`;
  const name = literal(row.nomeGruppo);
  const metaSource = meta(urls.senateGroups, 'Senato della Repubblica — Open data composizione dei gruppi alla data');
  const group = senateGroups.get(id) ?? { id, officialName: name, abbreviation: null, chamber: 'senato', memberCount: 0, countAsOf: AS_OF, leaderPoliticianId: null, constitutedAt: null, history: [], sourceUrl: groupUri, sourceName: metaSource.sourceName, source: SOURCE, verified: true, verifiedAt: AS_OF, validFrom: null, validTo: null };
  const membershipId = `gm-${politicianId}-${id}-${literal(row.inizioAdesione) ?? 'unknown-start'}`;
  if (!groupMemberships.some(item => item.id === membershipId)) {
    group.memberCount++;
    groupMemberships.push({ id: membershipId, politicianId, groupId: id, chamber: 'senato', validFrom: literal(row.inizioAdesione), validTo: null, office: literal(row.carica), ...meta(urls.senateGroups, metaSource.sourceName, literal(row.inizioAdesione)) });
  }
  senateGroups.set(id, group);
  if (literal(row.carica) === 'Presidente') group.leaderPoliticianId = politicianId;
  const politician = senPoliticiansById.get(politicianId);
  if (politician) politician.groupId = id;
}
const parliamentaryGroupHistory = [];
for (const row of senateGroupHistoryBindings) {
  const groupUri=literal(row.gruppo); const num=groupUri?.match(/gruppo\/(\d+)$/)?.[1];
  const senatorUri=literal(row.senatore); const numeric=senatorUri?.match(/senatore\/(\d+)$/)?.[1];
  const politicianId=`senato-xix-senatore-${numeric}`; if(!num || !senPoliticiansById.has(politicianId)) continue;
  const id=`senato-xix-gruppo-${num}`; const name=literal(row.nomeGruppo); const validFrom=literal(row.inizio); const validTo=literal(row.fine);
  const group=senateGroups.get(id) ?? { id,officialName:name,abbreviation:null,chamber:'senato',memberCount:0,countAsOf:AS_OF,leaderPoliticianId:null,constitutedAt:null,history:[],sourceUrl:groupUri,sourceName:'Senato della Repubblica — Open data variazioni composizione dei gruppi',source:SOURCE,verified:true,verifiedAt:AS_OF,validFrom:null,validTo:null };
  if(!group.history.some(item=>item.officialName===name&&item.validFrom===validFrom&&item.validTo===validTo)) group.history.push({officialName:name,validFrom,validTo});
  const historyId=`gm-${politicianId}-${id}-${validFrom??'unknown-start'}`;
  if(!groupMemberships.some(item=>item.id===historyId)) {
    const record={id:historyId,politicianId,groupId:id,chamber:'senato',validFrom,validTo,office:literal(row.carica),...meta(urls.senateGroups,'Senato della Repubblica — Open data variazioni dei gruppi parlamentari',validFrom,validTo)};
    groupMemberships.push(record); parliamentaryGroupHistory.push(record);
  } else {
    const existing=groupMemberships.find(item=>item.id===historyId); existing.validTo=validTo;
    if(existing.validFrom) existing.validFrom=validFrom;
    parliamentaryGroupHistory.push({...existing});
  }
  senateGroups.set(id,group);
}
for(const group of senateGroups.values()) group.status=group.memberCount>0?'active':'historical';
parliamentaryGroups.push(...senateGroups.values());

// The MEF source proves the party's official participation in the 2025 2‰ list,
// but does not prove current activity, representation, colour, website or leaders.
const politicians = [...cameraPoliticians, ...senPoliticiansById.values()];
const offices = [];
for(const person of politicians) {
  const office={id:`office-${person.id}-mandate`,title:person.chamber==='camera'?'Deputato della Repubblica':'Senatore della Repubblica',institution:person.chamber==='camera'?'Camera dei deputati':'Senato della Repubblica',level:'nazionale',politicianId:person.id,territoryId:person.chamber==='camera'?'it-camera':'it-senato',startDate:person.termStart,endDate:null,validFrom:person.termStart,validTo:null,...meta(person.sourceUrl,person.sourceName,person.termStart)};
  person.roleIds=[office.id]; offices.push(office);
}
for(const group of parliamentaryGroups.filter(g=>g.chamber==='senato'&&g.leaderPoliticianId)) {
  const membership=groupMemberships.find(m=>m.politicianId===group.leaderPoliticianId&&m.groupId===group.id&&!m.validTo);
  const person=senPoliticiansById.get(group.leaderPoliticianId);
  if(!membership||!person) continue;
  const office={id:`office-${person.id}-group-${group.id}`,title:`Presidente del gruppo ${group.officialName}`,institution:'Senato della Repubblica',level:'nazionale',politicianId:person.id,territoryId:'it-senato',startDate:membership.validFrom,endDate:null,validFrom:membership.validFrom,validTo:null,...meta(urls.senateGroups,'Senato della Repubblica — composizione e incarichi dei gruppi parlamentari',membership.validFrom)};
  person.roleIds.push(office.id); offices.push(office);
}
const officeHistory=offices.map(item=>({...item}));
const istatTerritoriesUrl = 'https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/';
const territories = [
  { id:'it-camera',kind:'camera',officialName:'Camera dei deputati',parentId:null,...meta(urls.cameraDirectory,'Camera dei deputati') },
  { id:'it-senato',kind:'senato',officialName:'Senato della Repubblica',parentId:null,...meta(urls.senateOpenData,'Senato della Repubblica') },
  { id:'it-stato',kind:'stato',officialName:'Italia',parentId:null,...meta(istatTerritoriesUrl,'ISTAT — Codici delle unità amministrative territoriali') },
  ...[
    ['01','Piemonte'],['02','Valle d’Aosta'],['03','Lombardia'],['04','Trentino-Alto Adige'],['05','Veneto'],
    ['06','Friuli-Venezia Giulia'],['07','Liguria'],['08','Emilia-Romagna'],['09','Toscana'],['10','Umbria'],
    ['11','Marche'],['12','Lazio'],['13','Abruzzo'],['14','Molise'],['15','Campania'],['16','Puglia'],
    ['17','Basilicata'],['18','Calabria'],['19','Sicilia'],['20','Sardegna']
  ].map(([code,officialName]) => ({ id:`it-region-${code}`,kind:'regione',code,officialName,parentId:'it-stato',...meta(istatTerritoriesUrl,'ISTAT — Codici delle unità amministrative territoriali','2026-02-21') }))
];
const chambers = [
  { id:'chamber-camera',kind:'camera',officialName:'Camera dei deputati',sourceUrl:urls.cameraDirectory,sourceName:'Camera dei deputati',source:SOURCE,verified:true,verifiedAt:AS_OF,validFrom:'2022-10-13',validTo:null },
  { id:'chamber-senato',kind:'senato',officialName:'Senato della Repubblica',sourceUrl:urls.senateOpenData,sourceName:'Senato della Repubblica — dati.senato.it',source:SOURCE,verified:true,verifiedAt:AS_OF,validFrom:'2022-10-13',validTo:null }
];
const cameraElectionListIds = new Map([
  ['ALLEANZA VERDI E SINISTRA','electoral-list-camera-2022-001'],['AZIONE - ITALIA VIVA - CALENDA','electoral-list-camera-2022-002'],['FORZA ITALIA','electoral-list-camera-2022-003'],["FRATELLI D'ITALIA - LEGA - NM - UDC - FI-PPE",'electoral-list-camera-2022-004'],["FRATELLI D'ITALIA CON GIORGIA MELONI",'electoral-list-camera-2022-005'],['LEGA PER SALVINI PREMIER','electoral-list-camera-2022-006'],["LEGA PER SALVINI PREMIER - FORZA ITALIA - FRATELLI D'ITALIA",'electoral-list-camera-2022-007'],['MOVIMENTO 5 STELLE','electoral-list-camera-2022-008'],["MOVIMENTO ASSOCIATIVO ITALIANI ALL'ESTERO - MAIE",'electoral-list-camera-2022-009'],['PARTITO DEMOCRATICO - ITALIA DEMOCRATICA E PROGRESSISTA','electoral-list-camera-2022-010'],['SUD CHIAMA NORD','electoral-list-camera-2022-011'],['SÜDTIROLER VOLKSPARTEI (SVP) - PATT','electoral-list-camera-2022-012'],["VALLÉE D'AOSTE - AUTONOMIE PROGRÈS FÉDÉRALISME",'electoral-list-camera-2022-013']
]);
const listLabels = [...new Set(cameraPoliticians.map(p=>p.electedOnList).filter(Boolean))];
for(const label of listLabels) if(!cameraElectionListIds.has(label)) throw new Error(`Nuova lista Camera da validare manualmente prima di assegnare un ID stabile: ${label}`);
const electionLists = listLabels.map(officialLabel => ({
  id:cameraElectionListIds.get(officialLabel), officialName:officialLabel,
  electionId:'election-it-politiche-2022', chamber:'camera', constituency:null, coalitionId:null,
  partyId:null, ballotSymbol:null, ...meta(cameraPoliticians.find(p=>p.electedOnList===officialLabel).sourceUrl,'Camera dei deputati — scheda del deputato, lista di elezione','2022-09-25','2022-09-25')
}));
const listIdByLabel = new Map(electionLists.map(x=>[x.officialName,x.id]));
const electionParticipations = cameraPoliticians.filter(p=>p.electedOnList && listIdByLabel.has(p.electedOnList)).map(p=>({
  id:`election-participation-${p.id}-2022`, politicianId:p.id, electionId:'election-it-politiche-2022',
  electoralListId:listIdByLabel.get(p.electedOnList), partyId:null, coalitionId:null, level:'nazionale',
  electionDate:'2022-09-25', electionRole:'elected-from-list', territoryId:null,
  ...meta(p.sourceUrl,'Camera dei deputati — scheda del deputato, lista di elezione',p.termStart,'2022-09-25')
}));
const elections = [
  { id:'election-it-politiche-2022', officialName:'Elezioni politiche 2022 — Camera e Senato', level:'nazionale', electionDate:'2022-09-25', electionType:'politiche', sourceUrl:urls.interiorElectionArchive, sourceName:'Ministero dell’Interno — Archivio storico delle elezioni', source:SOURCE, verified:true, verifiedAt:AS_OF, validFrom:'2022-09-25', validTo:'2022-09-25' },
  { id:'election-it-europee-2024', officialName:'Elezioni europee 2024 — Italia', level:'nazionale', electionDate:'2024-06-08', electionType:'europee', sourceUrl:urls.interiorEuropeanTransparency, sourceName:'Ministero dell’Interno — Trasparenza, elezioni europee 2024', source:SOURCE, verified:true, verifiedAt:AS_OF, validFrom:'2024-06-08', validTo:'2024-06-09' }
];
const manifest = {
  datasetVersion:'2026-09-22.1', snapshotDate:AS_OF, publisher:'POLITICANDO 2026 — importatore open data', sourcePolicy:'Primary institutional sources only; unknown values are null. Registry entries are sourced to registration deliberations; only explicit deregistration notices set historical status. MEF 2‰ evidence is dated to its reporting year.',
  sourceUrls:urls,
  collections:{parties:parties.length,politicalMovements:politicalMovements.length,parliamentaryGroups:parliamentaryGroups.length,coalitions:0,electoralLists:electionLists.length,politicians:politicians.length,offices:offices.length,partyMemberships:0,groupMemberships:groupMemberships.length,electionParticipations:electionParticipations.length,partyMembershipHistory:0,officeHistory:officeHistory.length,territories:territories.length,elections:elections.length},
  warnings:['Il Registro nazionale Parlamento include le iscrizioni storiche ancora visibili; lo stato historical è valorizzato solo quando il registro documenta cancellazione. La registrazione non certifica automaticamente attività politica sul territorio.','La Camera espone anagrafica, collegio e lista di elezione nelle schede individuali; tali campi sono importati separatamente dai gruppi.','Dati Senato corrente via open data per il 22/09/2026; i gruppi e le appartenenze sono esportati separatamente e non diventano partiti.','Sono importati i mandati di deputato/senatore e i presidenti di gruppo restituiti dal dataset ufficiale del Senato; altre cariche sono lasciate non assegnate finché non vengono importate da fonti specifiche.']
};
await Promise.all([
  save('parties.json', parties), save('political-movements.json', politicalMovements), save('parliamentary-groups.json', parliamentaryGroups),
  save('politicians.json', politicians), save('group-memberships.json', groupMemberships), save('party-memberships.json', empty),
  save('party-membership-history.json', empty), save('parliamentary-group-history.json', parliamentaryGroupHistory), save('office-history.json', officeHistory),
  save('offices.json', offices), save('coalitions.json', empty), save('electoral-lists.json', electionLists),
  save('election-participations.json', electionParticipations), save('territories.json', territories), save('elections.json', elections), save('chambers.json', chambers),
  save('manifest.json', manifest),
  save('database.json', { parties, politicalMovements, parliamentaryGroups, coalitions:empty, electoralLists:electionLists, politicians, offices, partyMemberships:empty, groupMemberships, electionParticipations, partyMembershipHistory:empty, parliamentaryGroupHistory, officeHistory, territories, elections, chambers, manifest })
]);
console.log(JSON.stringify(manifest.collections,null,2));
