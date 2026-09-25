// Imports the real electoral map of the general election of 25 September 2022 into src/data/real/electoral-geography.json:
// the 147 single-member districts of the Camera and the 74 of the Senato, the multi-member districts and circoscrizioni
// with the seats assigned in 2022, the circoscrizione Estero, the list results of every district and the comuni of each
// district (by ISTAT code, aligned to the ISTAT list of 21 February 2026 the career starts from).
// Source: the official results of the Ministry of the Interior (Eligendo), as published in the onData copy of the
// Eligendo files (CC BY, pinned commit). Nothing is typed by hand: counts, votes and seats come from the files, and the
// script stops if a total does not add up. Run again to regenerate the same file.
//   node scripts/import-electoral-geography.mjs [path/to/elezioni-politiche-2022]   (a local clone of the onData repository)
//   NODE_USE_ENV_PROXY=1 node scripts/import-electoral-geography.mjs               (downloads the files of the pinned commit)
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const VERIFIED_AT = process.env.AS_OF || new Date().toISOString().slice(0, 10);
const REPOSITORY = 'ondata/elezioni-politiche-2022';
const COMMIT = '43844d70ac8347fa33045a76a9a2cd32e75c11a4';
const LOCAL = process.argv[2] || process.env.ONDATA_DIR || null;
const SOURCE_URL = 'https://elezioni.interno.gov.it/report/20220925';
const SOURCE_NAME = 'Ministero dell’Interno — Eligendo, scrutini delle elezioni politiche del 25 settembre 2022';
const MIRROR = { url: `https://github.com/${REPOSITORY}`, commit: COMMIT, name: 'onData — copia dei dati ufficiali Eligendo (licenza CC BY)', note: 'da un progetto di onData' };
const real = name => new URL(`../src/data/real/${name}`, import.meta.url);

async function sourceText(path) {
  if (LOCAL) return readFile(join(LOCAL, path), 'utf8');
  const response = await fetch(`https://raw.githubusercontent.com/${REPOSITORY}/${COMMIT}/${path}`, { signal: AbortSignal.timeout(300000) });
  if (!response.ok) throw new Error(`Download non riuscito (${response.status}): ${path}`);
  return response.text();
}
// Minimal CSV reader: quoted fields, doubled quotes, a chosen separator and an optional BOM.
function parseCsv(text, separator = ',') {
  const rows = [];
  let row = [], field = '', quoted = false;
  const input = text.replace(/^﻿/, '');
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map(values => Object.fromEntries(header.map((key, index) => [key.trim(), (values[index] ?? '').trim()])));
}
const int = value => Number.parseInt(String(value ?? '').replace(/\./g, ''), 10) || 0;
const clean = name => String(name ?? '').replace(/[’`]/g, '\'').replace(/\s+/g, ' ').trim().replace(/^\+\s*/, '+');
const norm = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z]/g, '');
const slug = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const round2 = value => Math.round(value * 100) / 100;

// ---------- lists ----------
// Short stable codes for the lists of 2022 (the name stays verbatim as in the source).
const KNOWN_LISTS = {
  "FRATELLI D'ITALIA CON GIORGIA MELONI": 'FDI', 'PARTITO DEMOCRATICO - ITALIA DEMOCRATICA E PROGRESSISTA': 'PD', 'MOVIMENTO 5 STELLE': 'M5S',
  'LEGA PER SALVINI PREMIER': 'LEGA', 'FORZA ITALIA': 'FI', 'AZIONE - ITALIA VIVA - CALENDA': 'AZIV', 'ALLEANZA VERDI E SINISTRA': 'AVS', '+EUROPA': 'PE',
  "ITALEXIT PER L'ITALIA": 'ITALEXIT', 'UNIONE POPOLARE CON DE MAGISTRIS': 'UP', 'ITALIA SOVRANA E POPOLARE': 'ISP', 'NOI MODERATI/LUPI - TOTI - BRUGNARO - UDC': 'NM',
  'SUD CHIAMA NORD': 'SCN', VITA: 'VITA', 'IMPEGNO CIVICO LUIGI DI MAIO - CENTRO DEMOCRATICO': 'IC', 'SÜDTIROLER VOLKSPARTEI (SVP) - PATT': 'SVP',
  'MASTELLA NOI DI CENTRO EUROPEISTI': 'NDC', 'PARTITO COMUNISTA ITALIANO': 'PCI', 'PARTITO ANIMALISTA - UCDL - 10 VOLTE MEGLIO': 'PAN',
  "ALTERNATIVA PER L'ITALIA - NO GREEN PASS": 'APLI', 'PARTITO DELLA FOLLIA CREATIVA': 'PFC', FREE: 'FREE', 'FORZA DEL POPOLO': 'FDP',
  'PARTITO COMUNISTA DEI LAVORATORI': 'PCL', 'DESTRE UNITE': 'DU',
  "LEGA PER SALVINI PREMIER - FORZA ITALIA - FRATELLI D'ITALIA": 'CDXE', "LEGA PER SALVINI PREMIER - FORZA ITALIA - NOI MODERATI - FRATELLI D'ITALIA": 'CDXVDA',
  "MOVIMENTO ASSOCIATIVO ITALIANI ALL'ESTERO - MAIE": 'MAIE', 'UNIONE SUDAMERICANA EMIGRATI ITALIANI - USEI': 'USEI', "MOVIMENTO DELLE LIBERTA'": 'MDL',
  "L'ITALIA DEL MERIDIONE": 'IDM', "VALLEE D'AOSTE - AUTONOMIE PROGRES FEDERALISME": 'VDAAPF', "VALLE D'AOSTA APERTA": 'VDAA', 'LA RENAISSANCE VALDOTAINE': 'RV',
  "POUR L'AUTONOMIE - PER L'AUTONOMIA": 'PLA'
};
// The 2022 alliances, as the lists linked to the same candidates in the single-member districts.
const ALLIANCE_OF = { FDI: 'cdx', LEGA: 'cdx', FI: 'cdx', NM: 'cdx', CDXE: 'cdx', CDXVDA: 'cdx', PD: 'csx', AVS: 'csx', PE: 'csx', IC: 'csx', M5S: 'm5s', AZIV: 'azione-iv' };
const ALLIANCES = [
  { id: 'cdx', label: 'Centrodestra (FdI, Lega, FI, Noi Moderati)' }, { id: 'csx', label: 'Centrosinistra (PD, AVS, +Europa, Impegno Civico)' },
  { id: 'm5s', label: 'Movimento 5 Stelle' }, { id: 'azione-iv', label: 'Azione - Italia Viva' }
];
const lists = new Map();
// One spelling for every list: accents, typographic quotes and dashes, spaces and the "+ " of +Europa do not count.
const listKey = name => clean(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').toLocaleUpperCase('it-IT').trim();
const KNOWN = new Map(Object.entries(KNOWN_LISTS).map(([name, code]) => [listKey(name), code]));
function listCode(name) {
  const key = listKey(name);
  if (!key) return null;
  const code = KNOWN.get(key) ?? `L${slug(key).split('-').filter(Boolean).map(word => word[0]).join('').toUpperCase().slice(0, 8)}`;
  if (!lists.has(code)) lists.set(code, { code, name: clean(name), alliance2022: ALLIANCE_OF[code] ?? null });
  return code;
}

// ---------- ISTAT list of 2026 (the comuni the career starts from) ----------
const municipalities = JSON.parse(await readFile(real('municipalities.json'), 'utf8'));
const units = new Map(JSON.parse(await readFile(real('territorial-units.json'), 'utf8')).map(unit => [unit.code, unit]));
const regionOf2026 = comune => units.get(comune.unit)?.gameRegion ?? null;
const REGIONS = { PIEMONTE: 'Piemonte', "VALLE D'AOSTA": 'Valle d’Aosta', LOMBARDIA: 'Lombardia', 'TRENTINO-ALTO ADIGE/SÜDTIROL': 'Trentino-Alto Adige', VENETO: 'Veneto', 'FRIULI-VENEZIA GIULIA': 'Friuli-Venezia Giulia', LIGURIA: 'Liguria', 'EMILIA-ROMAGNA': 'Emilia-Romagna', TOSCANA: 'Toscana', UMBRIA: 'Umbria', MARCHE: 'Marche', LAZIO: 'Lazio', ABRUZZO: 'Abruzzo', MOLISE: 'Molise', CAMPANIA: 'Campania', PUGLIA: 'Puglia', BASILICATA: 'Basilicata', CALABRIA: 'Calabria', SICILIA: 'Sicilia', SARDEGNA: 'Sardegna' };
const regionOfCirc = name => REGIONS[clean(name).toLocaleUpperCase('it-IT').replace(/\s+\d+$/, '')] ?? null;

// ---------- a chamber: comuni, districts, multi-member districts, circoscrizioni ----------
const DISTRICT = /^(.*?) - (U\d{2}) \((.*)\)$/;
function buildDistricts(chamber, rows) {
  const districts = new Map();
  for (const row of rows) {
    const [, circ, number, name] = row['COLLEGIO UNINOMINALE'].match(DISTRICT) ?? [];
    if (!number) throw new Error(`${chamber}: collegio non riconosciuto: ${row['COLLEGIO UNINOMINALE']}`);
    const code = `${circ} - ${number}`;
    let district = districts.get(code);
    if (!district) {
      district = { code, name, circoscrizione: clean(row.CIRCOSCRIZIONE), plurinominale: clean(row['COLLEGIO PLURINOMINALE']), comuni: new Map(), candidates: new Map(), listVotes: {} };
      districts.set(code, district);
    }
    const place = `${row.COMUNE}|${row['CODICE ISTAT']}`;
    if (!district.comuni.has(place)) district.comuni.set(place, { name: row.COMUNE, istat: row['CODICE ISTAT'], electors: int(row['ELETTORI TOTALI']), voters: int(row['VOTANTI TOTALI']), candidates: new Map() });
    const comune = district.comuni.get(place);
    // Name as in the source, given name first (the "detto" of the ballot kept once).
    const person = [row.NOME, row.COGNOME, row['ALTRO NOME'] && !row.NOME.includes(row['ALTRO NOME']) ? row['ALTRO NOME'] : null].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    const code2 = listCode(row.LISTA);
    const candidate = comune.candidates.get(person) ?? { votes: int(row['VOTI CANDIDATO']), only: int(row['VOTI SOLO CANDIDATO']), lists: {} };
    candidate.lists[code2] = (candidate.lists[code2] ?? 0) + int(row['VOTI LISTE']);
    comune.candidates.set(person, candidate);
  }
  return districts;
}
// Votes of the lists in a district: list votes, plus the votes for the candidate only, shared among the candidate's lists
// in proportion to their votes in the district (the rule of the law for the proportional count).
function finishDistrict(district) {
  const byCandidate = new Map();
  let electors = 0, voters = 0;
  for (const comune of district.comuni.values()) {
    electors += comune.electors; voters += comune.voters;
    for (const [person, entry] of comune.candidates) {
      const total = byCandidate.get(person) ?? { votes: 0, only: 0, lists: {} };
      total.votes += entry.votes; total.only += entry.only;
      for (const [code, votes] of Object.entries(entry.lists)) total.lists[code] = (total.lists[code] ?? 0) + votes;
      byCandidate.set(person, total);
    }
  }
  const votes = {};
  const candidates = [];
  for (const [person, total] of byCandidate) {
    const listTotal = Object.values(total.lists).reduce((sum, value) => sum + value, 0);
    const codes = Object.keys(total.lists);
    let spread = 0;
    codes.forEach((code, index) => {
      const share = index === codes.length - 1 ? total.only - spread : Math.round(total.only * (listTotal ? total.lists[code] / listTotal : 1 / codes.length));
      spread += share;
      votes[code] = (votes[code] ?? 0) + total.lists[code] + share;
    });
    const main = [...codes].sort((a, b) => total.lists[b] - total.lists[a])[0];
    // The alliance of a candidate is the one of the list that brought most votes in the district (SVP-PATT stays itself).
    candidates.push({ name: person, lists: codes.sort((a, b) => total.lists[b] - total.lists[a]), alliance: ALLIANCE_OF[main] ?? main, votes: total.votes || listTotal + total.only });
  }
  candidates.sort((a, b) => b.votes - a.votes);
  const valid = Object.values(votes).reduce((sum, value) => sum + value, 0);
  return { electors, voters, valid, votes, candidates };
}

const base = 'affluenza-risultati/dati';
async function chamberData(chamber) {
  const Chamber = chamber === 'camera' ? 'Camera' : 'Senato';
  const rows = parseCsv(await sourceText(`${base}/Eligendo/processing/Politiche2022_Scrutini_${Chamber}_Italia.csv`));
  const districts = buildDistricts(chamber, rows);
  // Seats of 2022 by multi-member district and circoscrizione (Eligendo), national totals by list.
  const registry = parseCsv(await sourceText(`${base}/risultati/${chamber}-italia-comune_anagrafica.csv`));
  const pluriName = new Map(registry.map(row => [`${row.cod_circ.padStart(2, '0')}-${row.cod_plu.padStart(3, '0')}`, clean(row.desc_cl_plu)]));
  const circName = new Map(registry.map(row => [row.cod_circ.padStart(2, '0'), clean(row.desc_circ)]));
  const pluriSeats = new Map();
  for (const row of parseCsv(await sourceText(`${base}/risultati/${chamber}-italia-plurinominale.csv`))) { const name = pluriName.get(row.CR_CP); pluriSeats.set(name, (pluriSeats.get(name) ?? 0) + int(row.seggi)); }
  const circSeats = new Map();
  for (const row of parseCsv(await sourceText(`${base}/risultati/${chamber}-italia-circoscrizione.csv`))) { const name = circName.get(row.CR); circSeats.set(name, (circSeats.get(name) ?? 0) + int(row.seggi)); }
  // The national file has a second table (lists with no seats) under its own header: every block is read with its header.
  const nationalText = await sourceText(`${base}/risultati/${chamber}-italia.csv`);
  const blocks = nationalText.split(/\r?\n(?=voti,perc,)/);
  const nationalRows = blocks.flatMap(block => parseCsv(block)).filter(row => row.desc_lis && /^\d+$/.test(row.voti ?? ''));
  const info = parseCsv(await sourceText(`${base}/risultati/${chamber}-italia_info.csv`))[0];
  // Which comuni vote in which district: the Eligendo registry (for the electors of each part of a large city).
  return { districts, pluriSeats, circSeats, nationalRows, info };
}

function districtRecord(chamber, district, region) {
  const result = finishDistrict(district);
  const [winner, second] = result.candidates;
  const circ = district.circoscrizione;
  return {
    id: `${chamber}-u-${slug(district.code)}`, code: district.code, name: district.name, region,
    circoscrizione: `${chamber}-c-${slug(circ)}`, plurinominale: district.plurinominale ? `${chamber}-p-${slug(district.plurinominale)}` : null,
    electors: result.electors, voters: result.voters, valid: result.valid, votes: result.votes,
    winner: winner ? { name: winner.name, alliance: winner.alliance, lists: winner.lists, votes: winner.votes, share: round2(winner.votes * 100 / (result.candidates.reduce((sum, item) => sum + item.votes, 0) || 1)) } : null,
    runnerUp: second ? { name: second.name, alliance: second.alliance, lists: second.lists, votes: second.votes, share: round2(second.votes * 100 / (result.candidates.reduce((sum, item) => sum + item.votes, 0) || 1)) } : null,
    comuniCount: district.comuni.size, _comuni: [...district.comuni.values()]
  };
}

// Valle d'Aosta: one single-member district per chamber, its own results file (comune, candidate, list, votes).
async function aostaDistrict(chamber) {
  const rows = parseCsv(await sourceText(`${base}/risultati/vda-${chamber}.csv`));
  const district = { code: "VALLE D'AOSTA - U01", name: "VALLE D'AOSTA", circoscrizione: "VALLE D'AOSTA", plurinominale: null, comuni: new Map(), candidates: new Map(), listVotes: {} };
  for (const row of rows) {
    const place = `${row.comune}|`;
    if (!district.comuni.has(place)) district.comuni.set(place, { name: row.comune, istat: null, electors: 0, voters: 0, candidates: new Map() });
    const comune = district.comuni.get(place);
    const code = listCode(row.lista);
    const person = row.candidato.replace(/\s+/g, ' ').trim();
    const candidate = comune.candidates.get(person) ?? { votes: 0, only: 0, lists: {} };
    candidate.votes += int(row.voti);
    candidate.lists[code] = (candidate.lists[code] ?? 0) + int(row.voti);
    comune.candidates.set(person, candidate);
  }
  const record = districtRecord(chamber, district, 'Valle d’Aosta');
  // The file gives the votes of each candidate (no separate turnout): electors and voters stay unknown.
  return { ...record, electors: null, voters: null, circoscrizione: `${chamber}-c-valle-d-aosta`, plurinominale: null };
}

// ---------- Estero ----------
const ESTERO_SEATS = { camera: { EUROPA: 3, 'AMERICA MERIDIONALE': 2, 'AMERICA SETTENTRIONALE E CENTRALE': 2, 'AFRICA ASIA OCEANIA ANTARTIDE': 1 }, senato: { EUROPA: 1, 'AMERICA MERIDIONALE': 1, 'AMERICA SETTENTRIONALE E CENTRALE': 1, 'AFRICA ASIA OCEANIA ANTARTIDE': 1 } };
async function estero(chamber) {
  const Chamber = chamber === 'camera' ? 'Camera' : 'Senato';
  const rows = parseCsv(await sourceText(`${base}/Eligendo/rawdata/Politiche2022_Scrutini_${Chamber}_Estero.csv`), ';');
  const areas = new Map();
  for (const row of rows) {
    const name = clean(row.Ripartizione);
    const area = areas.get(name) ?? { votes: {}, voters: 0, electors: 0, nations: new Set() };
    const code = listCode(row.Lista);
    area.votes[code] = (area.votes[code] ?? 0) + int(row['Voti Liste']);
    if (!area.nations.has(row.Nazione)) { area.nations.add(row.Nazione); area.voters += int(row.Votanti); area.electors += int(row.Elettori); }
    areas.set(name, area);
  }
  return [...areas.entries()].map(([name, area]) => ({ id: `${chamber}-e-${slug(name)}`, name, seats: ESTERO_SEATS[chamber][name], electors: area.electors, voters: area.voters, valid: Object.values(area.votes).reduce((sum, value) => sum + value, 0), votes: area.votes }))
    .sort((a, b) => Object.keys(ESTERO_SEATS[chamber]).indexOf(a.name) - Object.keys(ESTERO_SEATS[chamber]).indexOf(b.name));
}

// ---------- build ----------
const output = { camera: null, senato: null };
const comuniOf = { camera: [], senato: [] };
for (const chamber of ['camera', 'senato']) {
  const data = await chamberData(chamber);
  const collegi = [...data.districts.values()].map(district => districtRecord(chamber, district, regionOfCirc(district.circoscrizione)));
  // Trentino-Alto Adige/Südtirol at the Senate: six single-member districts with their own count, not in the Eligendo
  // files of the copy: their comuni come from the official structure; their 2022 result is not available here, so the
  // district keeps no winner and the game estimates its baseline from the Camera vote in the same comuni (declared).
  if (chamber === 'senato') {
    const structure = parseCsv(await sourceText('affluenza-risultati/risorse/senato_geopolitico_italia.csv'));
    const taaDistricts = structure.filter(row => row.tipo === 'CU' && row.cod.startsWith('0421'));
    const cameraTaa = [...output.camera.collegi.filter(item => item.region === 'Trentino-Alto Adige')].flatMap(item => item._comuni.map(comune => ({ ...comune, district: item })));
    for (const row of taaDistricts) {
      const [, number, name] = row.desc.trim().match(/^(U\d{2}) \((.*)\)$/) ?? [];
      const members = structure.filter(item => item.tipo === 'CM' && item.cod.startsWith(row.cod.slice(0, 11)));
      const comuni = members.map(member => {
        const camera = cameraTaa.filter(item => norm(item.name) === norm(member.desc));
        return { name: member.desc, istat: camera[0]?.istat ?? null, camera };
      });
      const votes = {};
      let electors = 0, voters = 0;
      for (const comune of comuni) for (const part of comune.camera) {
        electors += part.electors; voters += part.voters;
        const share = part.electors / Math.max(1, comune.camera.reduce((sum, item) => sum + item.electors, 0));
        for (const candidate of part.candidates.values()) {
          const listTotal = Object.values(candidate.lists).reduce((sum, value) => sum + value, 0);
          for (const [code, value] of Object.entries(candidate.lists)) votes[code] = (votes[code] ?? 0) + Math.round((value + candidate.only * (listTotal ? value / listTotal : 0)) * (comune.camera.length > 1 ? share : 1));
        }
      }
      const code = `TRENTINO-ALTO ADIGE/SÜDTIROL - ${number}`;
      collegi.push({
        id: `senato-u-${slug(code)}`, code, name, region: 'Trentino-Alto Adige', circoscrizione: 'senato-c-trentino-alto-adige-sudtirol', plurinominale: null,
        electors, voters, valid: Object.values(votes).reduce((sum, value) => sum + value, 0), votes, winner: null, runnerUp: null, comuniCount: comuni.length,
        baseline: 'camera-2022', baselineNote: 'Risultato del Senato 2022 non presente nella copia dei dati: la base del collegio è il voto della Camera 2022 negli stessi comuni.',
        _comuni: comuni.map(comune => ({ name: comune.name, istat: comune.istat, electors: comune.camera.reduce((sum, item) => sum + item.electors, 0) }))
      });
      if (comuni.some(comune => !comune.istat)) throw new Error(`Senato TAA ${code}: comuni senza corrispondenza nella Camera (${comuni.filter(comune => !comune.istat).map(comune => comune.name).join(', ')}).`);
    }
  }
  collegi.push(await aostaDistrict(chamber));
  const order = circ => Object.keys(REGIONS).indexOf(clean(circ).toLocaleUpperCase('it-IT').replace(/\s+\d+$/, ''));
  collegi.sort((a, b) => order(a.code.split(' - ')[0]) - order(b.code.split(' - ')[0]) || a.code.localeCompare(b.code, 'it', { numeric: true }));
  // Circoscrizioni (Camera) or regions (Senato), with the seats of 2022.
  const circoscrizioni = [];
  for (const collegio of collegi) {
    let circ = circoscrizioni.find(item => item.id === collegio.circoscrizione);
    if (!circ) {
      const name = collegio.region === 'Valle d’Aosta' ? "VALLE D'AOSTA" : collegio.region === 'Trentino-Alto Adige' ? 'TRENTINO-ALTO ADIGE/SÜDTIROL' : [...data.districts.values()].find(item => `${chamber}-c-${slug(item.circoscrizione)}` === collegio.circoscrizione)?.circoscrizione;
      circ = { id: collegio.circoscrizione, name, region: collegio.region, uninominali: 0, proporzionali: data.circSeats.get(name) ?? 0, seats: 0 };
      circoscrizioni.push(circ);
    }
    circ.uninominali++;
  }
  for (const circ of circoscrizioni) circ.seats = circ.uninominali + circ.proporzionali;
  const plurinominali = [...data.pluriSeats.entries()].map(([name, seats]) => {
    const collegio = collegi.find(item => item.plurinominale === `${chamber}-p-${slug(name)}`);
    return { id: `${chamber}-p-${slug(name)}`, name, circoscrizione: collegio?.circoscrizione ?? null, region: collegio?.region ?? null, seats, collegi: collegi.filter(item => item.plurinominale === `${chamber}-p-${slug(name)}`).length };
  }).sort((a, b) => circoscrizioni.findIndex(item => item.id === a.circoscrizione) - circoscrizioni.findIndex(item => item.id === b.circoscrizione) || a.name.localeCompare(b.name, 'it', { numeric: true }));
  const national = {
    electors: int(data.info.ele_t), valid: int(data.info.tot_vot_prop), districts: int(data.info.coll_uni_tot), uninominali: int(data.info.sg_ass_uni), proporzionali: int(data.info.sg_ass_prop),
    lists: data.nationalRows.map(row => ({ code: listCode(row.desc_lis), votes: int(row.voti), share: Number(row.perc) || 0, seats: int(row.seggi) })).filter(row => row.votes > 0).sort((a, b) => b.votes - a.votes),
    note: 'Italia senza Valle d’Aosta' + (chamber === 'senato' ? ' e senza i collegi uninominali del Trentino-Alto Adige/Südtirol' : '') + ': totali ufficiali per lista, voti ai soli candidati compresi.'
  };
  const winners = {};
  for (const collegio of collegi) if (collegio.winner) winners[collegio.winner.alliance] = (winners[collegio.winner.alliance] ?? 0) + 1;
  output[chamber] = {
    seats: chamber === 'camera' ? { total: 400, italia: 392, uninominali: collegi.length, proporzionali: plurinominali.reduce((sum, item) => sum + item.seats, 0), estero: 8 } : { total: 200, italia: 196, uninominali: collegi.length, proporzionali: plurinominali.reduce((sum, item) => sum + item.seats, 0), estero: 4 },
    national, winners2022: winners, circoscrizioni, plurinominali, collegi, estero: await estero(chamber)
  };
  comuniOf[chamber] = collegi;
}

// ---------- comuni of 2026 → districts ----------
const index2022 = { camera: new Map(), senato: new Map() };
for (const chamber of ['camera', 'senato']) output[chamber].collegi.forEach((collegio, position) => {
  for (const comune of collegio._comuni) {
    const keys = [comune.istat ? `code:${comune.istat}` : null, `name:${collegio.region}|${norm(comune.name)}`].filter(Boolean);
    for (const key of keys) { const list = index2022[chamber].get(key) ?? []; list.push({ position, electors: comune.electors ?? 0 }); index2022[chamber].set(key, list); }
  }
});
const comuni = {};
const approximate = [];
for (const comune of municipalities) {
  const region = regionOf2026(comune);
  const lookup = chamber => {
    const found = index2022[chamber].get(`code:${comune.code}`) ?? index2022[chamber].get(`name:${region}|${norm(comune.name)}`) ?? index2022[chamber].get(`name:${region}|${norm(comune.name.split('/')[0])}`)
      ?? comune.name.split(/[-/]/).map(part => index2022[chamber].get(`name:${region}|${norm(part)}`)).find(Boolean);
    return found ? [...new Map(found.map(item => [item.position, item])).values()].sort((a, b) => b.electors - a.electors).map(item => item.position) : null;
  };
  let camera = lookup('camera');
  let senato = lookup('senato');
  if (!camera || !senato) approximate.push(comune);
  comuni[comune.code] = [camera, senato];
}
// A comune born after 2022 from comuni not recognisable by name takes the districts of its province (the most voters).
for (const comune of approximate) {
  const [camera, senato] = comuni[comune.code];
  const fill = (chamber, position) => {
    if (position) return position;
    const neighbours = municipalities.filter(item => item.unit === comune.unit && comuni[item.code]?.[chamber === 'camera' ? 0 : 1]);
    const counts = new Map();
    for (const item of neighbours) { const first = comuni[item.code][chamber === 'camera' ? 0 : 1][0]; counts.set(first, (counts.get(first) ?? 0) + 1); }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (best === undefined) throw new Error(`Comune ${comune.code} ${comune.name}: nessun collegio individuabile.`);
    return [best];
  };
  comuni[comune.code] = [fill('camera', camera), fill('senato', senato), 1];
}

// ---------- checks: the file stops the import when something does not add up ----------
const fail = message => { throw new Error(`Mappa elettorale 2022: ${message}`); };
const camera = output.camera, senato = output.senato;
if (camera.collegi.length !== 147) fail(`Camera: attesi 147 collegi uninominali, trovati ${camera.collegi.length}`);
if (senato.collegi.length !== 74) fail(`Senato: attesi 74 collegi uninominali, trovati ${senato.collegi.length}`);
if (camera.seats.proporzionali !== 245 || senato.seats.proporzionali !== 122) fail(`seggi proporzionali ${camera.seats.proporzionali}/${senato.seats.proporzionali} invece di 245/122`);
if (camera.plurinominali.length !== 49 || senato.plurinominali.length !== 26) fail(`collegi plurinominali ${camera.plurinominali.length}/${senato.plurinominali.length} invece di 49/26`);
if (camera.seats.uninominali + camera.seats.proporzionali + camera.seats.estero !== 400 || senato.seats.uninominali + senato.seats.proporzionali + senato.seats.estero !== 200) fail('i seggi non tornano a 400 e 200');
if (camera.estero.reduce((sum, item) => sum + item.seats, 0) !== 8 || senato.estero.reduce((sum, item) => sum + item.seats, 0) !== 4) fail('seggi dell’Estero non coerenti');
for (const chamber of ['camera', 'senato']) {
  const data = output[chamber];
  if (data.circoscrizioni.reduce((sum, item) => sum + item.seats, 0) !== data.seats.italia) fail(`${chamber}: i seggi delle circoscrizioni non danno ${data.seats.italia}`);
  // The Eligendo count assigns the Italian single-member districts (Valle d'Aosta and, at the Senate, TAA excluded) as the winners computed here.
  const wins = data.collegi.filter(item => item.winner && item.region !== 'Valle d’Aosta').length;
  if (wins !== data.national.uninominali) fail(`${chamber}: ${wins} vincitori calcolati contro ${data.national.uninominali} collegi assegnati dalla fonte`);
  const districtVotes = data.collegi.filter(item => item.region !== 'Valle d’Aosta' && !item.baseline).reduce((sum, item) => sum + item.valid, 0);
  if (Math.abs(districtVotes - data.national.valid) / data.national.valid > 0.002) fail(`${chamber}: voti validi dei collegi ${districtVotes} contro ${data.national.valid} della fonte`);
  for (const circ of data.circoscrizioni) if (!circ.name || !circ.region) fail(`${chamber}: circoscrizione senza nome o regione (${circ.id})`);
  if (new Set(data.collegi.map(item => item.id)).size !== data.collegi.length) fail(`${chamber}: ID dei collegi duplicati`);
}
const winnersCamera = output.camera.winners2022;
if (winnersCamera.cdx !== 121 || winnersCamera.csx !== 12 || winnersCamera.m5s !== 10) fail(`Camera: vincitori per coalizione non coerenti con la fonte (${JSON.stringify(winnersCamera)})`);
const unmapped = municipalities.filter(item => !comuni[item.code]?.[0]?.length || !comuni[item.code]?.[1]?.length);
if (unmapped.length) fail(`${unmapped.length} comuni senza collegio`);

// ---------- write ----------
for (const chamber of ['camera', 'senato']) for (const collegio of output[chamber].collegi) delete collegio._comuni;
const geography = {
  id: 'electoral-geography-politiche-2022', officialName: 'Elezioni politiche del 25 settembre 2022: collegi, circoscrizioni, seggi e risultati per lista',
  electionId: 'election-it-politiche-2022', electionDate: '2022-09-25',
  legislature: { number: 19, label: 'XIX legislatura', firstSitting: '2022-10-13', note: 'Prima seduta delle Camere (data di inizio della Camera dei deputati nel dataset, chambers.json).' },
  source: 'real', verified: true, sourceUrl: SOURCE_URL, sourceName: SOURCE_NAME, mirror: MIRROR, verifiedAt: VERIFIED_AT, validFrom: '2022-09-25', validTo: null,
  notes: [
    'Collegi, circoscrizioni, comuni, voti di lista e seggi come nei file ufficiali di Eligendo; i voti al solo candidato sono ripartiti tra le liste collegate in proporzione ai loro voti nel collegio, come prevede la legge per il riparto proporzionale.',
    'Seggi proporzionali per collegio plurinominale e circoscrizione: quelli assegnati nel 2022.',
    'Seggi dell’Estero per ripartizione: Camera 3, 2, 2 e 1 (i deputati eletti nel 2022 per ripartizione), Senato uno per ripartizione.',
    'Senato, Trentino-Alto Adige/Südtirol: i sei collegi uninominali e i loro comuni sono ufficiali; il risultato del Senato 2022 non è nella copia dei dati, e la base del collegio è il voto della Camera negli stessi comuni (baseline: camera-2022).',
    'Comuni: codici ISTAT dell’elenco del 21 febbraio 2026; i comuni con codice cambiato (Sardegna, fusioni) sono ricondotti per nome, i pochi non riconoscibili prendono il collegio della propria provincia (terzo valore 1).'
  ],
  lists: [...lists.values()].sort((a, b) => a.code.localeCompare(b.code)), alliances2022: ALLIANCES,
  camera: output.camera, senato: output.senato,
  comuni
};
// Readable file: structure indented, one line per district and per comune.
const compact = value => JSON.stringify(value);
const lines = [];
const indent = (level) => '  '.repeat(level);
function write(value, level, key = null) {
  const prefix = `${indent(level)}${key !== null ? `${JSON.stringify(key)}: ` : ''}`;
  if (Array.isArray(value) && value.length && typeof value[0] === 'object' && !Array.isArray(value[0])) {
    lines.push(`${prefix}[`);
    value.forEach((item, index) => lines.push(`${indent(level + 1)}${compact(item)}${index < value.length - 1 ? ',' : ''}`));
    lines.push(`${indent(level)}]`);
  } else if (value && typeof value === 'object' && !Array.isArray(value) && key !== 'votes' && key !== 'national' && key !== 'winners2022' && key !== 'seats' && key !== 'mirror' && key !== 'legislature') {
    const entries = Object.entries(value);
    lines.push(`${prefix}{`);
    entries.forEach(([name, item], index) => {
      if (key === 'comuni') lines.push(`${indent(level + 1)}${JSON.stringify(name)}: ${compact(item)}${index < entries.length - 1 ? ',' : ''}`);
      else { write(item, level + 1, name); if (index < entries.length - 1) lines[lines.length - 1] += ','; }
    });
    lines.push(`${indent(level)}}`);
  } else lines.push(`${prefix}${compact(value)}`);
}
write(geography, 0);
await writeFile(real('electoral-geography.json'), lines.join('\n') + '\n');
const manifestUrl = real('manifest.json');
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
manifest.documents = { ...(manifest.documents ?? {}), electoralGeography: { file: 'electoral-geography.json', electionDate: '2022-09-25', collegi: { camera: camera.collegi.length, senato: senato.collegi.length }, plurinominali: { camera: camera.plurinominali.length, senato: senato.plurinominali.length }, comuni: Object.keys(comuni).length, verifiedAt: VERIFIED_AT } };
manifest.sourceUrls = { ...(manifest.sourceUrls ?? {}), electoralGeography: SOURCE_URL, electoralGeographyMirror: MIRROR.url };
await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Mappa elettorale 2022: Camera ${camera.collegi.length} collegi uninominali, ${camera.plurinominali.length} plurinominali, ${camera.circoscrizioni.length} circoscrizioni, ${camera.estero.length} ripartizioni estere; Senato ${senato.collegi.length} collegi uninominali, ${senato.plurinominali.length} plurinominali, ${senato.circoscrizioni.length} regioni, ${senato.estero.length} ripartizioni estere.`);
console.log(`Vincitori 2022 (Camera, Italia): ${Object.entries(camera.winners2022).map(([id, count]) => `${id} ${count}`).join(', ')}; Senato: ${Object.entries(senato.winners2022).map(([id, count]) => `${id} ${count}`).join(', ')}.`);
console.log(`${Object.keys(comuni).length} comuni ISTAT 2026 collegati ai collegi (${approximate.length} per provincia). Liste: ${lists.size}. Verificato il ${VERIFIED_AT}.`);
