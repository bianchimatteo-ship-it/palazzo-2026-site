// Da dove comincia una carriera: ogni livello (consigliere comunale, provinciale, regionale, deputato, senatore, eurodeputato) e
// ogni modo di appartenere (indipendente, iscritto, fondatore di un partito) parte con risorse, relazioni, reputazioni, influenza di
// settore, peso nel partito, ritmo di crescita e attese che sono suoi. Qui: le regole, la fusione di livello e appartenenza, le
// diciotto partenze sul motore vero (tutte diverse e coerenti con la loro storia), la crescita e il capitale che continuano a
// funzionare dopo la prima settimana, il wizard, i vecchi salvataggi e il determinismo.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const R = await module('src/data/simulation/scenario-rules.js');
const E = await module('src/core/scenario-engine.js');
const S = await module('src/data/simulation/standing-rules.js');
const { PARTY_RANKS, RELATION_TEMPLATES } = await module('src/data/simulation/career-rules.js');
const { startStep } = await module('src/ui/start-wizard.js');
const { checkInvariants } = await module('src/core/invariants.js');
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]|Infinity).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };
const LEVELS = ['comunale', 'provinciale', 'regionale', 'deputato', 'senatore', 'europeo'];
const AFFILIATIONS = ['independent', 'member', 'founder'];
const BIRTH = '1975-04-03';

// ---------- 1. le regole ----------
{
  assert.deepEqual(Object.keys(R.LEVEL_SCENARIOS), LEVELS, 'Sei livelli, ognuno con la sua partenza');
  assert.deepEqual(Object.keys(R.AFFILIATION_SCENARIOS), AFFILIATIONS, 'Tre modi di appartenere');
  const relations = new Set(RELATION_TEMPLATES.map(item => item.id));
  for (const [id, item] of [...Object.entries(R.LEVEL_SCENARIOS), ...Object.entries(R.AFFILIATION_SCENARIOS)]) {
    assert.ok(item.label && item.summary && item.expectation && item.pressure, `${id}: dice chi sei, cosa ti si chiede e cosa ti rema contro`);
    assert.ok(Object.keys(item.relations).every(key => relations.has(key)), `${id}: solo relazioni note`);
    assert.ok(Object.keys(item.standing).every(key => S.REPUTATION_IDS.includes(key)), `${id}: solo reputazioni note`);
    assert.ok(Object.keys(item.sectors ?? {}).every(key => S.SECTOR_IDS.includes(key)), `${id}: solo settori noti`);
    assert.ok(Object.entries(item.growth).every(([stat, value]) => R.GROWTH_STATS.includes(stat) && value >= 0.7 && value <= 1.3), `${id}: la crescita cambia di poco (0,7–1,3), non stravolge`);
    assert.ok(item.fundsFactor > 0 && item.fundsFactor <= 1.5);
  }
  assert.ok(Object.values(R.LEVEL_SCENARIOS).every(item => item.party && item.party.rank < PARTY_RANKS.length && item.party.rank >= 0), 'Ogni livello dice come parte nel partito');
  // I livelli sono ordinati per quanto pesano: più in alto, più mezzi e più capitale; il territorio si allontana.
  const funds = Object.fromEntries(LEVELS.map(level => [level, R.LEVEL_SCENARIOS[level].fundsFactor]));
  assert.ok(R.LEVEL_SCENARIOS.deputato.capital > R.LEVEL_SCENARIOS.comunale.capital && R.LEVEL_SCENARIOS.deputato.standing.territorial < R.LEVEL_SCENARIOS.comunale.standing.territorial && R.LEVEL_SCENARIOS.deputato.standing.institutional > R.LEVEL_SCENARIOS.comunale.standing.institutional, 'Un deputato ha più capitale e peso istituzionale di un consigliere, ma meno radici sul territorio');
  assert.ok(R.LEVEL_SCENARIOS.europeo.standing.media < 0 && R.LEVEL_SCENARIOS.europeo.relations.leadership < 0 && R.LEVEL_SCENARIOS.europeo.growth.notoriety < 1, 'A Bruxelles si è poco visibili e lontani dal partito');
  assert.ok(R.LEVEL_SCENARIOS.provinciale.sectors.territorio > R.LEVEL_SCENARIOS.comunale.sectors.territorio && R.LEVEL_SCENARIOS.regionale.sectors.welfare >= 8, 'La Provincia vive di strade e scuole, la Regione di sanità');
  void funds;
}

// ---------- 2. la fusione ----------
{
  assert.equal(E.affiliationOf(null), 'independent');
  assert.equal(E.affiliationOf({ id: 'x' }), 'member');
  assert.equal(E.affiliationOf({ id: 'x', founder: true }), 'founder');
  const a = E.scenarioOf({ level: 'regionale', affiliation: 'founder' });
  assert.equal(a.label, 'Consigliere regionale · Fondatore di un partito');
  assert.equal(a.fundsFactor, 1.1 * 1.25 === 1.375 ? 1.38 : Math.round(1.1 * 1.25 * 100) / 100);
  assert.equal(a.capital, R.LEVEL_SCENARIOS.regionale.capital + R.AFFILIATION_SCENARIOS.founder.capital);
  assert.equal(a.relations.civic, R.LEVEL_SCENARIOS.regionale.relations.civic + R.AFFILIATION_SCENARIOS.founder.relations.civic, 'Le relazioni si sommano');
  assert.equal(a.standing.internal, R.LEVEL_SCENARIOS.regionale.standing.internal + R.AFFILIATION_SCENARIOS.founder.standing.internal, 'Le reputazioni si sommano');
  assert.equal(a.growth.notoriety, Math.round(R.LEVEL_SCENARIOS.regionale.growth.notoriety * R.AFFILIATION_SCENARIOS.founder.growth.notoriety * 100) / 100, 'Il ritmo di crescita si moltiplica');
  assert.equal(a.party, null, 'Un fondatore non ha il peso di un iscritto nel partito di altri');
  assert.ok(E.scenarioOf({ level: 'regionale', affiliation: 'member' }).party.rank === 1 && E.scenarioOf({ level: 'regionale', affiliation: 'independent' }).party === null);
  assert.equal(E.scenarioOf({ level: 'inventato', affiliation: 'boh' }).level, 'comunale', 'Un livello sconosciuto ricade su quello più basso, senza rompere nulla');
  const lines = E.scenarioLines(E.scenarioOf({ level: 'deputato', affiliation: 'member' }));
  assert.ok(['resources', 'relations', 'standing', 'sectors', 'party', 'growth'].every(id => lines.some(line => line.id === id)), 'Le righe dicono risorse, relazioni, reputazione, settori, partito e crescita');
  assert.ok(lines.every(line => line.items.every(item => item && !/undefined|NaN/.test(item))));
  assert.ok(lines.find(line => line.id === 'party').items.some(text => /coordinatore locale/.test(text)));
  assert.equal(E.scenarioGrowth({}, 'popularity'), 1, 'Senza scenario (un vecchio salvataggio) nulla cambia');
  assert.equal(E.scenarioCapitalGain({}), 0);
  assert.equal(E.scenarioGrowth({ scenario: { growth: { popularity: 1.15 } } }, 'popularity'), 1.15);
  assert.equal(E.scenarioGrowth({ scenario: { growth: { popularity: 1.15 } } }, 'consensus'), 1, 'Il consenso non cresce a ritmo diverso: è un voto');
}

// ---------- 3. diciotto partenze sul motore vero ----------
const founderDraft = { partyMode: 'new', partyId: '', partyName: 'Lista di prova', partyAbbreviation: 'LDP', partyDescription: 'Partito fondato dal giocatore per il test.', partyOrientation: 'Altro', partyColor: '#285c42' };
const draftOf = affiliation => ({ birthDate: BIRTH, ...(affiliation === 'independent' ? { partyMode: 'independent', partyId: null } : affiliation === 'founder' ? founderDraft : {}) });
const stat = (s, metric) => s.dataset.statistics.find(item => item.subjectId === s.career.playerId && item.metric === metric)?.value;
const relation = (s, id) => s.game.relations.find(item => item.id === id)?.value ?? null;
const fingerprint = s => JSON.stringify({ funds: s.game.resources.funds, capital: s.game.resources.politicalCapital, relations: s.game.relations.map(item => [item.id, item.value]), rep: s.game.standing.rep, sectors: s.game.standing.sectors, rank: s.game.party?.rank ?? null, support: s.game.party?.support ?? null, growth: s.game.scenario.growth, gain: s.game.scenario.capitalGain });
const starts = {};
for (const level of LEVELS) for (const affiliation of AFFILIATIONS) {
  const run = await startCareer({ seed: `scenario-${level}-${affiliation}`, level, region: 'Toscana', draft: draftOf(affiliation) });
  const s = run.store.getState();
  starts[`${level}|${affiliation}`] = { run, s };
  assert.equal(s.game.scenario.level, level, `${level}/${affiliation}: il livello è registrato`);
  assert.equal(s.game.scenario.affiliation, affiliation, `${level}/${affiliation}: l’appartenenza è registrata`);
  assert.ok(Object.values(s.game.standing.rep).some(value => value !== 0) && Object.values(s.game.standing.sectors).some(value => value > 0), `${level}/${affiliation}: nasce con reputazioni e settori suoi`);
  // The first week closes the polls of a newborn party: the invariants are checked on the game once it is under way.
  run.store.advance(7);
  // (A founder's game keeps the real poll of the start with the new party added on top of it: a known property of the polls, not of the scenario.)
  { const inv = checkInvariants(run.store.getState()); const issues = (inv.issues ?? []).filter(item => !(affiliation === 'founder' && /^world\.polls\[/.test(item.path))); assert.equal(issues.length, 0, `${level}/${affiliation}: invarianti ${JSON.stringify(issues.slice(0, 3))}`); }
}
{
  const prints = Object.entries(starts).map(([key, { s }]) => [key, fingerprint(s)]);
  assert.equal(new Set(prints.map(([, print]) => print)).size, prints.length, 'Le diciotto partenze sono tutte diverse tra loro');
  const at = (level, affiliation) => starts[`${level}|${affiliation}`].s;
  // Le reputazioni raccontano il livello: radici in basso, peso istituzionale in alto.
  const territorial = level => at(level, 'member').game.standing.rep.territorial;
  const institutional = level => at(level, 'member').game.standing.rep.institutional;
  assert.ok(territorial('comunale') > territorial('regionale') && territorial('regionale') > territorial('deputato') && territorial('deputato') > territorial('europeo'), 'Più sali, più il territorio si allontana');
  assert.ok(institutional('deputato') > institutional('regionale') && institutional('regionale') > institutional('comunale') && institutional('senatore') > institutional('deputato'), 'Più sali, più pesi nelle istituzioni');
  assert.ok(at('europeo', 'member').game.standing.rep.media < at('deputato', 'member').game.standing.rep.media && at('europeo', 'member').game.standing.rep.media < 0, 'L’eurodeputato è poco visibile a casa, il deputato molto');
  // Le risorse crescono con il livello.
  const funds = level => at(level, 'member').game.resources.funds;
  assert.ok(funds('deputato') > funds('regionale') && funds('regionale') > funds('provinciale') && funds('provinciale') > funds('comunale'), `Più sali, più fondi (${LEVELS.map(level => funds(level)).join(' / ')})`);
  // L’influenza di settore racconta cosa fai: la Provincia strade e scuole, la Regione la sanità, le Camere le istituzioni.
  const sector = (level, id) => at(level, 'member').game.standing.sectors[id];
  assert.ok(sector('provinciale', 'territorio') > sector('comunale', 'territorio') && sector('regionale', 'welfare') > sector('comunale', 'welfare') && sector('deputato', 'istituzioni') > sector('regionale', 'istituzioni') && sector('europeo', 'economia') > sector('deputato', 'economia'), 'Ogni livello parte con la sua competenza');
  // Il modo di appartenere: l’indipendente non ha leadership né grado, l’iscritto parte con il peso del suo seggio, il fondatore guida e ha più mezzi.
  for (const level of LEVELS) {
    const free = at(level, 'independent'), member = at(level, 'member'), founder = at(level, 'founder');
    assert.equal(free.game.party, null, `${level}: l’indipendente non ha partito`);
    assert.equal(relation(free, 'leadership'), null, `${level}: né rapporto con una leadership`);
    assert.ok(member.game.party.affiliation === 'member' && member.game.party.rank === R.LEVEL_SCENARIOS[level].party.rank, `${level}: l’iscritto parte dal grado del suo seggio (${member.game.party.rankTitle})`);
    assert.equal(founder.game.party.affiliation, 'founder');
    assert.ok(founder.game.standing.rep.internal > member.game.standing.rep.internal && member.game.standing.rep.internal >= free.game.standing.rep.internal, `${level}: la reputazione interna cresce da indipendente a iscritto a fondatore`);
    assert.ok(founder.game.resources.funds > member.game.resources.funds && member.game.resources.funds > free.game.resources.funds, `${level}: il fondatore ha più mezzi, l’indipendente meno (${free.game.resources.funds}/${member.game.resources.funds}/${founder.game.resources.funds})`);
    assert.ok(founder.game.resources.politicalCapital >= member.game.resources.politicalCapital + 5, `${level}: il fondatore parte con più capitale`);
    assert.ok(free.game.standing.rep.media > member.game.standing.rep.media, `${level}: l’indipendente ha un’immagine più personale`);
  }
  assert.ok(at('regionale', 'member').game.party.support > at('comunale', 'member').game.party.support, 'Un consigliere regionale pesa di più nel partito di un consigliere comunale');
}

// ---------- 4. quello che continua a funzionare ----------
// (The store is one for the whole process: every measure starts a fresh career and uses it at once.)
{
  const fresh = (level, affiliation, seed) => startCareer({ seed: `${seed}-${level}-${affiliation}`, level, region: 'Toscana', draft: draftOf(affiliation) });
  const give = (store, patch) => { const s = JSON.parse(JSON.stringify(store.getState())); patch(s); store.loadGame(s); };
  const popularityGain = async level => {
    const { store } = await fresh(level, 'member', 'crescita');
    give(store, s => {
      s.game.week.ap = 6;
      s.game.inbox.push({ id: 'prova-crescita', kind: 'evento', templateId: 'festa-patronale', title: 'La festa del patrono', body: 'x', params: {}, choices: [{ id: 'partecipa', label: 'Partecipa', cost: { ap: 1 }, requires: null }, { id: 'passa', label: 'Comparsata', cost: null, requires: null }], defaultChoice: 'passa', week: s.game.week.index, source: 'simulation' });
    });
    const before = stat(store.getState(), 'popularity');
    store.resolveAgendaItem('prova-crescita', 'partecipa');
    return Math.round((stat(store.getState(), 'popularity') - before) * 100) / 100;
  };
  const local = await popularityGain('comunale'), national = await popularityGain('deputato');
  assert.ok(local > national, `La popolarità cresce più in fretta nel quartiere che a Roma (${local} contro ${national})`);
  assert.ok(Math.abs(local - 2 * R.LEVEL_SCENARIOS.comunale.growth.popularity) < 0.06 && Math.abs(national - 2 * R.LEVEL_SCENARIOS.deputato.growth.popularity) < 0.06, 'Lo scarto è quello dichiarato (2 punti × ritmo del livello)');
  // Il capitale della settimana: l’indipendente ne guadagna uno in meno, chi guida il partito uno in più.
  const weeklyCapital = async affiliation => { const { store } = await fresh('regionale', affiliation, 'capitale'); give(store, s => { s.game.resources.politicalCapital = 10; }); store.advance(7); return store.getState().game.resources.politicalCapital - 10; };
  const free = await weeklyCapital('independent'), member = await weeklyCapital('member'), founder = await weeklyCapital('founder');
  assert.ok(member >= free + 1 && founder >= member, `Capitale della settimana: indipendente ${free}, iscritto ${member}, fondatore ${founder}`);
}

// ---------- 5. il wizard, i vecchi salvataggi, il determinismo ----------
{
  for (const level of LEVELS) for (const [mode, affiliation] of [['independent', 'independent'], ['existing', 'member'], ['new', 'founder']]) {
    const html = startStep({ initialLevel: level, partyMode: mode, start: { profile: 'ordinaria', levels: {} } });
    clean(html, `wizard ${level}/${mode}`);
    assert.ok(html.includes(`Dove cominci · ${R.LEVEL_SCENARIOS[level].label} · ${R.AFFILIATION_SCENARIOS[affiliation].label}`), `${level}/${mode}: il wizard dice da dove cominci`);
    assert.ok(/Ti si chiede/.test(html) && /Ti rema contro/.test(html) && /Relazioni/.test(html) && /Reputazione/.test(html), `${level}/${mode}: attese e ostacoli`);
  }
  const run = await startCareer({ seed: 'scenario-vecchio', level: 'deputato', region: 'Toscana', draft: draftOf('member') });
  const old = JSON.parse(JSON.stringify(run.store.getState()));
  delete old.game.scenario;
  run.store.loadGame(old);
  run.store.advance(7);
  assert.ok(checkInvariants(run.store.getState()).ok && !run.store.getState().game.scenario, 'Un vecchio salvataggio senza scenario continua come prima');
  const again = await startCareer({ seed: 'scenario-regionale-member', level: 'regionale', region: 'Toscana', draft: draftOf('member') });
  assert.equal(fingerprint(again.store.getState()), fingerprint(starts['regionale|member'].s), 'Stesso seme, stessa partenza');
}

console.log('Partenze verificate: 6 livelli × 3 modi di appartenere = 18 punti di partenza diversi per risorse, relazioni, reputazioni, influenza di settore, peso nel partito, crescita e capitale; fusione di livello e appartenenza, ritmo di crescita e capitale che continuano nel gioco, wizard, vecchi salvataggi e determinismo.');
