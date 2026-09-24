import { DATA_SOURCES, emptyDataset } from '../schema.js?v=20260924-20';

// All sample names, events, and numbers are invented for interface demonstration.
export function makeDemoParties() {
  return [
    { id: 'partito-demo', name: 'Partito di esempio (simulato)', abbreviation: 'PES', description: 'Segnaposto della schermata iniziale: non è un partito reale né selezionabile.', color: '#264d82', orientation: 'Centrismo civico', policyPositions: { economia: 3, welfare: 4, ambiente: 4, europa: 4 }, source: DATA_SOURCES.SIMULATION, createdAt: '2026-01-01', logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: null },
    { id: 'partito-territori-demo', name: 'Rete dei Territori', abbreviation: 'RDT', description: 'Partito dimostrativo con attenzione alle autonomie locali.', color: '#347b70', orientation: 'Autonomista', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, source: DATA_SOURCES.SIMULATION, createdAt: '2026-01-01', logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: null },
    { id: 'partito-futuro-demo', name: 'Futuro Comune', abbreviation: 'FC', description: 'Organizzazione dimostrativa orientata a innovazione e servizi.', color: '#895f98', orientation: 'Progressista', policyPositions: { economia: 3, welfare: 5, ambiente: 5, europa: 4 }, source: DATA_SOURCES.SIMULATION, createdAt: '2026-01-01', logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: null }
  ];
}

export function makeDemoState() {
  const dataset = emptyDataset();
  dataset.parties.push(...makeDemoParties());
  dataset.politicians.push({ id: 'politico-demo', firstName: 'Profilo', lastName: 'Demo', displayName: 'Profilo demo (simulato)', birthDate: '1988-04-20', gender: 'donna', region: 'Toscana', municipality: 'Valleverde', previousProfession: 'Insegnante', partyId: 'partito-demo', territoryId: 'territorio-demo', roleId: 'incarico-demo', source: DATA_SOURCES.SIMULATION, createdAt: '2026-01-01', logoUrl: null, logoAsset: null, logoSource: null, logoVerified: null, logoAlt: null });
  dataset.territories.push({ id: 'territorio-demo', kind: 'regione', name: 'Toscana', parentId: null, source: DATA_SOURCES.SIMULATION });
  dataset.offices.push({ id: 'incarico-demo', title: 'Consigliera comunale', institution: 'Comune di Valleverde', level: 'locale', politicianId: 'politico-demo', territoryId: 'territorio-demo', startDate: '2026-01-01', endDate: null, source: DATA_SOURCES.SIMULATION });
  dataset.statistics.push(
    { id: 'stat-popolarita', subjectId: 'politico-demo', metric: 'popularity', value: 64, unit: '100', asOf: '2026-01-12', source: DATA_SOURCES.SIMULATION },
    { id: 'stat-reputazione', subjectId: 'politico-demo', metric: 'reputation', value: 58, unit: '100', asOf: '2026-01-12', source: DATA_SOURCES.SIMULATION },
    { id: 'stat-consenso', subjectId: 'partito-demo', metric: 'consensus', value: 12.4, unit: '%', asOf: '2026-01-12', source: DATA_SOURCES.SIMULATION },
    { id: 'stat-approvazione', subjectId: 'governo-demo', metric: 'approval', value: 41, unit: '%', asOf: '2026-01-12', source: DATA_SOURCES.SIMULATION },
    { id: 'stat-esperienza', subjectId: 'politico-demo', metric: 'experience', value: 34, unit: '100', asOf: '2026-01-12', source: DATA_SOURCES.SIMULATION },
    { id: 'stat-influenza', subjectId: 'politico-demo', metric: 'influence', value: 29, unit: '100', asOf: '2026-01-12', source: DATA_SOURCES.SIMULATION },
    { id: 'stat-notorieta', subjectId: 'politico-demo', metric: 'notoriety', value: 40, unit: '100', asOf: '2026-01-12', source: DATA_SOURCES.SIMULATION }
  );
  dataset.events.push({ id: 'evento-demo', title: 'Prima riunione di gruppo', date: '2026-01-12', category: 'partito', status: 'in programma', source: DATA_SOURCES.SIMULATION });
  return {
    version: 3,
    career: { id: 'carriera-demo', name: 'Una carriera nella politica italiana', createdAt: '2026-01-01', startedAt: '2026-01-01', playerId: 'politico-demo', partyId: 'partito-demo', initialLevel: 'comunale', territoryId: 'territorio-demo', statisticsIds: ['stat-popolarita', 'stat-reputazione', 'stat-esperienza', 'stat-influenza', 'stat-notorieta'], status: 'demo' },
    clock: { currentDate: '2026-01-12', paused: true },
    dataset,
    ui: { activePage: 'panoramica', saveName: 'Salvataggio locale' }
  };
}
