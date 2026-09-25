// Update of 25/09/2026, from verified sources only. The owner's corrections (admin archive in the browser and in
// Workers KV) are a separate layer applied on top of these files at runtime: nothing here reads or replaces them.
// 1. Opening real poll: Supermedia AGI/YouTrend of 24/09/2026 replaces the one of 17/09/2026.
// 2. Documented party memberships for parliamentarians whose current party is not the one of their 2022 list.
// 3. End of mandate of Alberto Bagnai (15/09/2026): he stays in the archive, no longer among the deputies in office.
// Idempotent: running it again gives the same files.
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../src/data/real/', import.meta.url);
const VERIFIED_AT = '2026-09-25';
const read = async name => JSON.parse(await readFile(new URL(name, ROOT), 'utf8'));
const save = (name, value) => writeFile(new URL(name, ROOT), `${JSON.stringify(value, null, 2)}\n`);
const real = (sourceUrl, sourceName, validFrom = null, validTo = null) => ({ source: 'real', verified: true, sourceUrl, sourceName, verifiedAt: VERIFIED_AT, validFrom, validTo });
const upsert = (list, record) => { const index = list.findIndex(item => item.id === record.id); if (index < 0) list.push(record); else list[index] = { ...list[index], ...record }; };

// ---------- 1. the opening real poll ----------
const AGI = 'https://www.agi.it/politica/news/2026-09-24/supermedia-agi-youtrend-fdi-39219483/';
const ROWS = [
  ['Fratelli d’Italia', 'party-registro-p1-2014-04-ir', 27.0], ['Partito Democratico', 'party-registro-p1-2015-29-ir', 20.8],
  ['Movimento 5 Stelle', 'party-registro-p1-2022-63-ir', 12.6], ['Futuro Nazionale', 'party-futuro-nazionale', 7.8],
  ['Forza Italia', 'party-registro-p1-2015-20-ir', 7.4], ['Alleanza Verdi e Sinistra', 'coalition-alleanza-verdi-sinistra', 6.5],
  ['Lega', 'party-registro-p1-2017-41-ir', 5.6], ['Azione', 'party-registro-p1-2019-51-ir', 3.4], ['Italia Viva', 'party-registro-p1-2019-52-ir', 2.2],
  ['+Europa', 'party-registro-p1-2018-47-ir', 1.5], ['Noi Moderati', 'party-registro-p1-2020-56-ir', 1.1], ['Sud chiama Nord', 'party-registro-p1-2022-67-ir', 1.1]
];
const previous = (await read('polls.json')).find(item => item.id === 'poll-supermedia-youtrend-agi-2026-09-17') ?? null;
const round1 = value => Math.round(value * 10) / 10;
const total = ROWS.reduce((sum, [, , share]) => sum + share, 0);
const POLL = {
  id: 'poll-supermedia-youtrend-agi-2026-09-24', kind: 'supermedia', label: 'Supermedia YouTrend/Agi',
  publishedAt: '2026-09-24', fieldworkFrom: '2026-09-10', fieldworkTo: '2026-09-23',
  method: 'Media ponderata dei sondaggi nazionali sulle intenzioni di voto (per numerosità del campione, data di realizzazione e metodo di raccolta)',
  includedPolls: ['Eumetra (17/09)', 'Ixè (10/09)', 'Noto (22/09)', 'Only Numbers (11, 15 e 18/09)', 'Piepoli (11 e 21/09)', 'SWG (14 e 21/09)', 'Tecnè (09 e 16/09)', 'YouTrend (24/09)'],
  // Only the forces the source lists. The change is against the previous Supermedia (17/09) when both list the force.
  results: ROWS.map(([label, entityId, share]) => {
    const before = previous?.results.find(row => row.entityId === entityId)?.share;
    return { label, entityId, share, delta: Number.isFinite(before) ? round1(share - before) : null };
  }),
  others: round1(100 - total), othersNote: 'Altri: 100 meno la somma delle forze indicate dalla fonte',
  coalitions: [{ label: 'Centrodestra', share: 41.1 }, { label: 'Centrosinistra', share: 28.8 }, { label: 'M5S', share: 12.6 }, { label: 'Terzo Polo', share: 6.7 }, { label: 'Altri', share: 10.8 }],
  coalitionsNote: 'Aggregazioni come riportate dalla fonte; le variazioni della fonte sono rispetto alle Politiche 2022',
  ...real(AGI, 'Agi — Supermedia AGI/YouTrend del 24 settembre 2026', '2026-09-24'),
  secondarySources: [real('https://urbanpost.it/sondaggi-youtrend-supermedia-24-settembre/', 'UrbanPost — le cifre della Supermedia YouTrend del 24/09/2026', '2026-09-24')]
};
if (Math.abs(total - 97) > 0.001) throw new Error(`Somma delle forze inattesa: ${total}`);
await save('polls.json', [POLL]);

// ---------- 2. documented memberships (current party ≠ list of the 2022 election) ----------
const FI_CONGRESS = ['https://forzaitalia.it/risultati-congresso-nazionale-forza-italia/', 'Forza Italia — risultati del Congresso nazionale del 23-24 febbraio 2024 (sito ufficiale)', '2024-02-24'];
const MEMBERSHIPS = [
  { politicianId: 'camera-xix-deputato-308838', partyId: 'party-registro-p1-2015-20-ir', basis: 'incarico di partito documentato', role: 'Segretario nazionale', ...real(...FI_CONGRESS) },
  { politicianId: 'camera-xix-deputato-302867', partyId: 'party-registro-p1-2015-20-ir', basis: 'incarico di partito documentato', role: 'Vicesegretaria nazionale', ...real(...FI_CONGRESS) },
  { politicianId: 'camera-xix-deputato-307604', partyId: 'party-registro-p1-2015-20-ir', basis: 'incarico di partito documentato', role: 'Vicesegretario nazionale', ...real(...FI_CONGRESS) },
  { politicianId: 'camera-xix-deputato-308244', partyId: 'party-registro-p1-2019-51-ir', basis: 'incarico di partito documentato', role: 'Presidente (eletta dal congresso del 29 marzo 2025)', ...real('https://www.ildenaro.it/elena-bonetti-eletta-presidente-di-azione-tesoriere-sottanelli/', 'Il Denaro — «Il Congresso di Azione ha eletto per acclamazione Elena Bonetti presidente del partito» (29/03/2025)', '2025-03-29') },
  { politicianId: 'senato-xix-senatore-31725', partyId: 'party-registro-p1-2019-52-ir', basis: 'adesione documentata', role: 'Aderente (dal 7 marzo 2025; eletta con il Partito Democratico)', ...real('https://www.ilfattoquotidiano.it/2025/03/07/annamaria-furlan-lex-segretaria-cisl-lascia-il-pd-e-passa-a-iv-disaccordi-sui-temi-del-lavoro-guerini-interrogarsi-sulle-ragioni/7903780/', 'Il Fatto Quotidiano — Annamaria Furlan lascia il Pd e passa a Italia Viva (07/03/2025)', '2025-03-07'), secondarySources: [real('https://www.ilfoglio.it/politica/2025/03/07/news/annamaria-furlan-lascia-il-pd-e-passa-a-iv-decisiva-l-astensione-sul-ddl-partecipazione--7495684/', 'Il Foglio — Annamaria Furlan lascia il Pd e passa a Iv (07/03/2025)', '2025-03-07')] },
  { politicianId: 'senato-xix-senatore-32634', partyId: 'party-registro-p1-2022-63-ir', basis: 'appartenenza documentata', role: 'Senatrice del Movimento 5 Stelle', ...real('https://www.cremonaoggi.it/2026/07/02/rai-floridia-mi-dimetto-da-presidente-della-commissione-di-vigilanza-lasciano-tutti-i-membri-dopposizione/', 'CremonaOggi — «la senatrice del Movimento 5 Stelle» (02/07/2026)') },
  { politicianId: 'senato-xix-senatore-36399', partyId: 'party-registro-p1-2014-07-ir', basis: 'adesione documentata', role: 'Senatrice dei Verdi-Grüne-Vërc (aderente da marzo 2025; eletta con Alleanza Verdi e Sinistra)', ...real('https://www.verdi.bz.it/it/senatrice-aurora-floridia/', 'Verdi Grüne Vërc — pagina ufficiale della senatrice Aurora Floridia', '2025-03-01'), secondarySources: [real('https://www.ansa.it/trentino/notizie/2025/02/22/senatrice-aurora-floridia-aderisce-ai-verdi-altoatesini_893e7253-58e4-461e-961e-6f6f3c9f2081.html', 'Ansa — Senatrice Aurora Floridia aderisce ai Verdi altoatesini (22/02/2025)', '2025-02-22')] },
  { politicianId: 'senato-xix-senatore-36436', partyId: 'party-registro-p1-2019-51-ir', basis: 'appartenenza documentata', role: 'Senatore di Azione (nel gruppo Misto dal 9 novembre 2023)', ...real('https://www.ilrestodelcarlino.it/bologna/politica/lombardo-azione-dem-elezioni-dde75f21', 'Il Resto del Carlino — «senatore di Azione ed ex esponente del Pd» (01/08/2026)') }
];
const memberships = await read('party-memberships.json');
for (const item of MEMBERSHIPS) upsert(memberships, { id: `party-membership-${item.politicianId}-${item.partyId}`, validTo: null, ...item });

// ---------- 3. Alberto Bagnai: end of mandate on 15/09/2026 ----------
const BAGNAI = 'camera-xix-deputato-307749';
const END = '2026-09-15';
const ending = { reason: 'Nomina a componente dell’Autorità garante della concorrenza e del mercato; seggio uninominale Abruzzo U01 in attesa di elezione suppletiva', sourceUrl: 'https://www.camera.it/deputati/elenco/19-307749', sourceName: 'Camera dei deputati — scheda di Alberto Bagnai (fine mandato 15/09/2026)', secondarySourceUrl: 'https://www.ilfattoquotidiano.it/2026/08/05/bagnai-antitrust-nomina-lega-notizie/8471054/', verifiedAt: VERIFIED_AT };
const politicians = await read('politicians.json');
const bagnai = politicians.find(item => item.id === BAGNAI);
if (!bagnai) throw new Error('Record di Alberto Bagnai non trovato');
Object.assign(bagnai, { termEnd: END, validTo: END, mandateEnd: { date: END, ...ending } });
const groupMemberships = await read('group-memberships.json');
for (const item of groupMemberships.filter(entry => entry.politicianId === BAGNAI && !entry.validTo)) Object.assign(item, { validTo: END });
const offices = await read('offices.json');
const officeHistory = await read('office-history.json');
for (const list of [offices, officeHistory]) for (const item of list.filter(entry => entry.politicianId === BAGNAI && entry.id.endsWith('-mandate'))) Object.assign(item, { endDate: END, validTo: END });
const groups = await read('parliamentary-groups.json');
const lega = groups.find(item => item.id === 'cam-xix-03');
const current = groupMemberships.filter(item => item.groupId === 'cam-xix-03' && !item.validTo).length;
Object.assign(lega, { memberCount: current, countAsOf: '2026-09-24', countNote: 'Senza Alberto Bagnai, cessato dal mandato il 15/09/2026' });

// ---------- write back, aggregate and manifest ----------
const files = { politicians, partyMemberships: memberships, groupMemberships, offices, officeHistory, parliamentaryGroups: groups };
const names = { politicians: 'politicians.json', partyMemberships: 'party-memberships.json', groupMemberships: 'group-memberships.json', offices: 'offices.json', officeHistory: 'office-history.json', parliamentaryGroups: 'parliamentary-groups.json' };
for (const [key, name] of Object.entries(names)) await save(name, files[key]);
const aggregate = await read('database.json');
for (const key of Object.keys(names)) if (key in aggregate) aggregate[key] = files[key];
aggregate.manifest.collections = { ...aggregate.manifest.collections, ...Object.fromEntries(Object.keys(names).filter(key => key in aggregate.manifest.collections).map(key => [key, files[key].length])) };
await save('database.json', aggregate);
const manifest = await read('manifest.json');
manifest.politiciansInOffice = politicians.filter(item => !item.termEnd).length;
manifest.collections = { ...manifest.collections, realPolls: 1, ...Object.fromEntries(Object.keys(names).filter(key => key in manifest.collections).map(key => [key, files[key].length])) };
const { supermedia20260917, ...sourceUrls } = manifest.sourceUrls ?? {};
manifest.sourceUrls = { ...sourceUrls, supermedia20260924: AGI };
manifest.updates = [...(manifest.updates ?? []).filter(item => item.date !== VERIFIED_AT), { date: VERIFIED_AT, notes: ['Sondaggio reale iniziale: Supermedia AGI/YouTrend del 24/09/2026', 'Iscrizioni documentate: Tajani, Deborah Bergamini, Benigni, Bonetti, Furlan, Barbara Floridia, Aurora Floridia, Lombardo', 'Fine mandato di Alberto Bagnai (15/09/2026)', 'Il partito attuale di un parlamentare non si deduce dalla lista d’elezione né dal gruppo'] }];
manifest.warnings = [...new Set([...(manifest.warnings ?? []), 'Il partito attuale di un parlamentare viene solo da un collegamento dell’amministratore o da un’iscrizione documentata: la lista d’elezione 2022 è una relazione elettorale e il gruppo parlamentare non è un partito.'])];
await save('manifest.json', manifest);
console.log(`Aggiornamento del 25/09/2026: sondaggio ${POLL.label} del ${POLL.publishedAt} (${POLL.results.length} forze, Altri ${POLL.others}%), ${MEMBERSHIPS.length} iscrizioni documentate (${memberships.length} in totale), Bagnai cessato il ${END} (Lega Camera: ${lega.memberCount} componenti).`);
