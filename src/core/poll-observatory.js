import { OBSERVATORY_RULES as RULES, POLL_EXTENSIONS as EXT, POLL_INSTITUTES } from '../data/simulation/polling-rules.js?v=20261012-3';
import { AREA_BY_ID } from '../data/simulation/policy-rules.js?v=20261012-3';

// The poll observatory: what each simulated institute measures week after week, the average of the institutes, the segments
// of the electorate, the flows between the forces and the insights drawn from them.
// Everything here measures the simulation and moves nothing: no bonus, no vote. Readings are pure functions of the seed, the
// week, the institute and the force (a hash, never the random sequence of the game), so opening a page, reloading a save or
// computing a reading twice gives the same numbers; the only memory is the error each institute carries from one week to the
// next, which is saved with the world. The sample is what an institute interviews; the population is the simulated
// electorate (the true shares of the world): the sample only estimates it, with an error that shrinks with its size.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const round4 = value => Math.round(value * 10000) / 10000;
// A share in the words of the insights: Italian decimal comma, and the second decimal for what is below 1%.
const say = value => String(Math.abs(value) < 1 && value !== 0 ? round2(value) : round1(value)).replace('.', ',');
export const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
// A number in [0, 1) from any key: the same key gives the same number, in any order and at any time.
export function unit(...parts) {
  let n = hash(parts.join('|')) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const gauss = (...parts) => unit(...parts, 'g1') + unit(...parts, 'g2') + unit(...parts, 'g3') - 1.5;

export const instituteOf = id => POLL_INSTITUTES.find(item => item.id === id) ?? null;
export const instituteByName = name => POLL_INSTITUTES.find(item => item.name === name) ?? null;

// ---------- institutes: house effect, sample, margin ----------
// Each institute leans a little on each force, but no force is favoured on average: the leans of the institutes on a force sum to zero.
const houseLean = (instituteId, partyId) => (hash(`${instituteId}|${partyId}`) % 1000) / 1000 - 0.5;
export function houseEffect(instituteId, partyId, share) {
  const mean = POLL_INSTITUTES.reduce((sum, item) => sum + houseLean(item.id, partyId), 0) / POLL_INSTITUTES.length;
  return (houseLean(instituteId, partyId) - mean) * 0.3 * clamp(Math.sqrt(Math.max(share, 0.1) / 10), 0.3, 1.2);
}
// No force moves by more than a credible amount between two consecutive polls of the same institute.
export const weeklyCap = share => 0.25 + 0.035 * share;
export const marginOf = sample => round1(1.96 * Math.sqrt(0.25 / Math.max(1, sample)) * 100);
export function instituteSample(profile, seed, week) {
  const [low, high] = profile.sample;
  return Math.round((low + unit(seed, 'campione', profile.id, week) * (high - low)) / 10) * 10;
}
function normalize(rows, others) {
  const total = rows.reduce((sum, row) => sum + row.raw, 0) + others;
  return rows.map(row => ({ partyId: row.partyId, share: round2(row.raw / total * 100) }));
}
// Rows capped one by one against the previous reading (a force that just entered has no previous figure and starts from the
// next one), the new ones taking only the room the others leave, and the total brought back to 100 a tenth at a time from the
// largest forces that still have room within their weekly change. `damp` shrinks the cap (the first simulated week after a real poll).
export function settleReading(rows, previousRows, { damp = 1 } = {}) {
  const before = new Map((previousRows ?? []).map(row => [row.partyId, row.share]));
  const floors = new Map();
  const results = rows.map(row => {
    const was = before.get(row.partyId);
    const cap = Number.isFinite(was) ? weeklyCap(was) * damp : 0;
    const share = Number.isFinite(was) ? round1(clamp(row.share, was - cap, was + cap)) : round1(row.share);
    floors.set(row.partyId, Number.isFinite(was) ? was - cap : 0);
    return { ...row, share, delta: Number.isFinite(was) ? round1(share - was) : 0 };
  });
  const entrants = results.filter(row => !Number.isFinite(before.get(row.partyId)));
  if (entrants.length && entrants.length < results.length) {
    const held = results.filter(row => !entrants.includes(row)).reduce((sum, row) => sum + row.share, 0);
    const wanted = entrants.reduce((sum, row) => sum + row.share, 0);
    const room = Math.max(0, 100 - held);
    if (wanted > room) for (const row of entrants) row.share = round1(row.share * room / wanted);
  }
  for (let excess = round1(results.reduce((sum, row) => sum + row.share, 0) - 100), guard = 0; excess > 0.05 && guard < 20; guard++) {
    const row = results.filter(item => item.share - 0.1 >= floors.get(item.partyId) - 1e-9).sort((a, b) => b.share - a.share)[0];
    if (!row) break;
    row.share = round1(row.share - 0.1);
    const was = before.get(row.partyId);
    row.delta = Number.isFinite(was) ? round1(row.share - was) : 0;
    excess = round1(excess - 0.1);
  }
  return results;
}

// One reading of one institute: the true shares of the population seen through a sample. The error of the institute on every force
// is kept from one week to the next (the panel does not change), and it is a fraction of the nominal sampling error.
// trueRows: [{ partyId, share }]; previousRows: the institute's previous reading (or the last published poll);
// errors: { partyId: error } the institute carries; returns the reading and the new errors.
export function readInstitute({ profile, seed, week, date, trueRows, previousRows = null, errors = {}, noise = 1, damp = 1 }) {
  const sample = instituteSample(profile, seed, week);
  const fresh = {};
  const noisy = trueRows.map(row => {
    const p = row.share / 100;
    const sigma = Math.sqrt(Math.max(0.0004, p * (1 - p)) / sample) * 100;
    const error = round4((errors[row.partyId] ?? 0) * RULES.errorMemory + gauss(seed, week, profile.id, row.partyId) * 2 * RULES.errorScale * sigma * noise);
    fresh[row.partyId] = error;
    return { partyId: row.partyId, raw: Math.max(Math.min(0.2, row.share), row.share + error + houseEffect(profile.id, row.partyId, row.share)) };
  });
  const rows = settleReading(normalize(noisy, 100 - trueRows.reduce((sum, row) => sum + row.share, 0)), previousRows, { damp });
  return { reading: { id: profile.id, week, date, sample, margin: marginOf(sample), rows, others: round1(Math.max(0, 100 - rows.reduce((sum, row) => sum + row.share, 0))) }, errors: fresh };
}

// ---------- the average of the institutes ----------
// Weighted by the sample: a larger panel counts more. A force an institute does not (yet) measure is averaged over the others.
export function averageOf(readings, previousRows = null) {
  const live = readings.filter(item => item?.rows?.length);
  if (!live.length) return null;
  const ids = [...new Set(live.flatMap(item => item.rows.map(row => row.partyId)))];
  const before = new Map((previousRows ?? []).map(row => [row.partyId, row.share]));
  const rows = ids.map(partyId => {
    const parts = live.map(item => [item.sample ?? 1, item.rows.find(row => row.partyId === partyId)?.share]).filter(([, share]) => Number.isFinite(share));
    const weight = parts.reduce((sum, [w]) => sum + w, 0) || 1;
    const share = round1(parts.reduce((sum, [w, value]) => sum + w * value, 0) / weight);
    return { partyId, share, delta: before.has(partyId) ? round1(share - before.get(partyId)) : 0, spread: round1(Math.max(...parts.map(([, value]) => value)) - Math.min(...parts.map(([, value]) => value))) };
  });
  const sample = live.reduce((sum, item) => sum + (item.sample ?? 0), 0);
  return { rows, others: round1(Math.max(0, 100 - rows.reduce((sum, row) => sum + row.share, 0))), sample, institutes: live.length };
}

// ---------- the segments of the electorate ----------
// The segments are the ones of the simulated society (age and condition: giovani, famiglie e lavoratori, pensionati, autonomi, redditi
// bassi). A force is stronger where its agenda speaks to what that segment lives (the areas that please it, weighted by how bad
// that area is now) and, if it governs or opposes, where the mood towards the executive agrees with it. Averaged over the
// population the support of a force is its national share: the segments only say where it comes from.
export const stanceOf = force => force.governing || force.strategy === 'governista' ? 1 : force.strategy === 'opposizione' ? -1 : force.strategy === 'coalizione' ? 0.25 : 0;
// society: { segments: [{ id, label, share, satisfaction, participation, trust }], areas: { areaId: value 0–100 } }
export function segmentSupport(entries, society, { undecided = 27, boosts = {} } = {}) {
  const segments = society?.segments ?? [];
  if (!segments.length || !entries.length) return null;
  const pop = segments.map(segment => segment.share / (segments.reduce((sum, item) => sum + item.share, 0) || 100));
  const mean = values => values.reduce((sum, value, index) => sum + value * pop[index], 0);
  const moods = segments.map(segment => (Number(segment.satisfaction ?? 50) - 50) / 50);
  const moodMean = mean(moods);
  const salience = areaId => clamp((100 - Number(society.areas?.[areaId] ?? 50)) / 100, 0.1, 1);
  const rows = {};
  for (const entry of entries) {
    const fit = segments.map(segment => (entry.agenda ?? []).reduce((sum, areaId) => {
      const area = AREA_BY_ID[areaId];
      if (!area) return sum;
      return sum + salience(areaId) * (area.pleased?.includes(segment.id) ? 1 : area.displeased?.includes(segment.id) ? -0.6 : 0);
    }, 0));
    const fitMean = mean(fit);
    const stance = entry.stance ?? 0;
    const factor = segments.map((segment, index) => clamp(1 + RULES.segment.spread * (RULES.segment.agenda * (fit[index] - fitMean) + RULES.segment.mood * stance * (moods[index] - moodMean)) + Number(boosts[entry.id]?.[segment.id] ?? 0), RULES.segment.min, RULES.segment.max));
    const norm = mean(factor) || 1;
    rows[entry.id] = factor.map((value, index) => ({ id: segments[index].id, factor: round2(value / norm), support: round2(entry.share * value / norm) }));
  }
  const trustTerm = segments.map(segment => (50 - Number(segment.trust ?? 50)) / 100);
  const trustMean = mean(trustTerm);
  return {
    segments: segments.map((segment, index) => ({
      id: segment.id, label: segment.label, share: round1(pop[index] * 100), satisfaction: round1(segment.satisfaction ?? 50), participation: round1(segment.participation ?? 60), trust: round1(segment.trust ?? 50),
      undecided: round1(clamp(undecided * (1 + RULES.segment.undecided * (trustTerm[index] - trustMean)), 3, 70))
    })), rows
  };
}
// Which areas matter to a segment now: the ones that please it, weighted by how bad they are (an area in good shape asks for less).
export function themesOf(society, segmentId = null, limit = 3) {
  const areas = society?.areas ?? {};
  return Object.entries(areas).map(([areaId, value]) => {
    const area = AREA_BY_ID[areaId];
    if (!area) return null;
    const fit = segmentId ? (area.pleased?.includes(segmentId) ? 1 : area.displeased?.includes(segmentId) ? 0.3 : 0.15) : 1 + (area.pleased?.length ?? 0) * 0.15;
    return { id: areaId, label: area.label, value: round1(Number(value)), weight: round2((100 - Number(value)) * fit) };
  }).filter(Boolean).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id)).slice(0, limit);
}

// ---------- second choice, loyalty and flows ----------
// Where the voters of a force would go as a second choice: close forces first (collocazione, good relations), larger ones more, and a part of
// them would stay home. Returns [{ id, share }] (shares of the force's voters, including 'astensione').
export function secondChoice(force, others, { ties = {}, abstain = true } = {}) {
  const rule = RULES.secondChoice;
  const weights = others.filter(item => item.id !== force.id).map(item => {
    const gap = Number.isFinite(force.axis) && Number.isFinite(item.axis) ? Math.abs(force.axis - item.axis) : 2;
    const tie = Number(ties[[force.id, item.id].sort().join('|')] ?? 0);
    return { id: item.id, weight: Math.exp(-rule.distance * gap) * (1 + rule.ties * tie / 100) * Math.pow(Math.max(0.2, item.share), rule.size) };
  });
  const total = weights.reduce((sum, item) => sum + item.weight, 0) || 1;
  const stay = abstain ? rule.abstain : 0;
  const rows = weights.map(item => ({ id: item.id, share: round1(item.weight / total * (1 - stay) * 100) }));
  if (abstain) rows.push({ id: 'astensione', share: round1(stay * 100) });
  return rows.filter(item => item.share >= 0.1).sort((a, b) => b.share - a.share);
}
// How firmly the voters of a force would confirm their choice: fewer certainties for a force that is losing ground, in crisis or divided.
export function loyaltyOf(force, { trend = 0 } = {}) {
  return round1(clamp(93 - Math.max(0, -trend) * 5 - Math.abs(trend) * 1.5 - (force.crisis ? 8 : 0) - ((force.cohesion ?? 62) < 45 ? 4 : 0) - (force.share < 2 ? 6 : 0), 55, 97));
}
// Who gains from whom this week: the points lost by the forces that go down reach the ones that go up, in proportion to what they gain and
// to how close they are. Returns [{ from, to, points }], the largest first.
export function flowsOf(rows, forces, { minimum = 0.15, limit = 6 } = {}) {
  const byId = new Map(forces.map(item => [item.id, item]));
  const losers = rows.filter(row => row.delta <= -minimum).map(row => ({ id: row.partyId, points: -row.delta }));
  const gainers = rows.filter(row => row.delta >= minimum).map(row => ({ id: row.partyId, points: row.delta }));
  const flows = [];
  for (const loser of losers) {
    const weights = gainers.map(gainer => {
      const a = byId.get(loser.id), b = byId.get(gainer.id);
      const gap = Number.isFinite(a?.axis) && Number.isFinite(b?.axis) ? Math.abs(a.axis - b.axis) : 2;
      return gainer.points * Math.exp(-0.6 * gap);
    });
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (!total) continue;
    // The gainers take at most what they gained: a flow is never larger than the change that explains it.
    gainers.forEach((gainer, index) => flows.push({ from: loser.id, to: gainer.id, points: round2(Math.min(gainer.points, loser.points * weights[index] / total)) }));
  }
  return flows.filter(item => item.points >= 0.05).sort((a, b) => b.points - a.points).slice(0, limit);
}

// ---------- the observatory kept in the world ----------
export const freshObservatory = () => ({ version: 1, source: 'simulation', institutes: Object.fromEntries(POLL_INSTITUTES.map(item => [item.id, { errors: {}, history: [] }])), average: [], segments: [], approval: [], regional: [], laws: [] });
export function normalizeObservatory(input) {
  const base = freshObservatory();
  if (!input || typeof input !== 'object') return base;
  return { ...base, ...input, institutes: Object.fromEntries(POLL_INSTITUTES.map(item => [item.id, { errors: {}, history: [], ...(input.institutes?.[item.id] ?? {}) }])), average: Array.isArray(input.average) ? input.average : [], segments: Array.isArray(input.segments) ? input.segments : [], approval: Array.isArray(input.approval) ? input.approval : [], regional: Array.isArray(input.regional) ? input.regional : [], laws: Array.isArray(input.laws) ? input.laws : [] };
}
const pack = rows => rows.map(row => [row.partyId, row.share, row.delta ?? 0]);
const unpack = rows => (rows ?? []).map(([partyId, share, delta]) => ({ partyId, share, delta }));
export const readingRows = reading => unpack(reading?.rows);
// Starts the series from a real poll: the average is the real average, the institutes have nothing yet.
export function seedObservatory(observatory, { week, date, rows, others, label = null }) {
  const next = normalizeObservatory(observatory);
  next.average = [{ week, date, sample: null, institutes: 0, label, rows: pack(rows), others }];
  return next;
}
// The week of the observatory: every institute publishes (the one of the headline poll with the very figures of that poll, the others
// drawn from the same true shares with their own error), the average is made, the segments of the week are kept.
// headline: { instituteId, results, sample, margin } — the published poll; trueRows: the shares of the population;
// previous: the poll before (its rows are the starting point of an institute with no history).
export function advanceObservatory(input, { week, date, seed, trueRows, headline, previous = null, noise = 1, society = null, entries = [], undecided = 27 }) {
  const obs = normalizeObservatory(input);
  const damp = previous?.source === 'real' ? 0.6 : 1;
  const readings = [];
  for (const profile of POLL_INSTITUTES) {
    const slot = obs.institutes[profile.id];
    const last = slot.history.at(-1);
    const previousRows = last ? unpack(last.rows) : previous?.results ?? null;
    let reading;
    if (profile.id === headline.instituteId) {
      // The headline poll is this institute's reading of the week: the error it carries is brought back in line with it.
      const rows = headline.results.map(row => ({ partyId: row.partyId, share: row.share, delta: last ? round1(row.share - (unpack(last.rows).find(item => item.partyId === row.partyId)?.share ?? row.share)) : row.delta }));
      reading = { id: profile.id, week, date, sample: headline.sample, margin: headline.margin, rows, others: round1(Math.max(0, 100 - rows.reduce((sum, row) => sum + row.share, 0))) };
      const trueOf = new Map(trueRows.map(row => [row.partyId, row.share]));
      slot.errors = Object.fromEntries(rows.map(row => [row.partyId, round4(row.share - (trueOf.get(row.partyId) ?? row.share) - houseEffect(profile.id, row.partyId, row.share))]));
    } else {
      const out = readInstitute({ profile, seed, week, date, trueRows, previousRows, errors: slot.errors, noise, damp });
      reading = out.reading;
      slot.errors = out.errors;
    }
    slot.history = [...slot.history, { week, date, sample: reading.sample, margin: reading.margin, rows: pack(reading.rows), others: reading.others }].slice(-RULES.history);
    readings.push(reading);
  }
  const lastAverage = obs.average.at(-1);
  const average = averageOf(readings, lastAverage ? unpack(lastAverage.rows) : previous?.results ?? null);
  if (average) obs.average = [...obs.average, { week, date, sample: average.sample, institutes: average.institutes, rows: pack(average.rows), others: average.others, spread: Object.fromEntries(average.rows.map(row => [row.partyId, row.spread])) }].slice(-RULES.averageHistory);
  const support = society && entries.length ? segmentSupport(entries, society, { undecided }) : null;
  if (support) obs.segments = [...obs.segments, { week, date, rows: Object.fromEntries(Object.entries(support.rows).map(([id, list]) => [id, list.map(item => item.support)])) }].slice(-RULES.segmentHistory);
  return obs;
}

// ---------- the view: what the page needs, read from the saved observatory and the current state ----------
// forces: [{ id, label, abbreviation, color, share (true), axis, agenda, strategy, governing, isPlayer, crisis, cohesion }];
// society: the compact society (see segmentSupport); regional: { region: [{ partyId, share }] } for the forces in the polls;
// ties: the relations among the forces of the world.
export function observatoryView(world, { forces = [], society = null, regional = null, ties = world?.ties ?? {} } = {}) {
  const obs = normalizeObservatory(world?.observatory);
  const labelOf = new Map(forces.map(item => [item.id, item]));
  const institutes = POLL_INSTITUTES.map(profile => {
    const history = obs.institutes[profile.id].history;
    const last = history.at(-1) ?? null;
    return { id: profile.id, name: profile.name, mode: profile.mode, weighting: profile.weighting, note: profile.note, fieldworkDays: profile.fieldworkDays, lag: profile.lag, sampleRange: profile.sample, latest: last ? { week: last.week, date: last.date, sample: last.sample, margin: last.margin, rows: unpack(last.rows), others: last.others } : null, history: history.map(item => ({ week: item.week, date: item.date, sample: item.sample, margin: item.margin, rows: unpack(item.rows) })) };
  });
  const average = obs.average.map(item => ({ week: item.week, date: item.date, sample: item.sample, institutes: item.institutes, label: item.label ?? null, rows: unpack(item.rows), others: item.others, spread: item.spread ?? {} }));
  const latestAverage = average.at(-1) ?? null;
  const shares = forces.map(force => ({ ...force, share: latestAverage?.rows.find(row => row.partyId === force.id)?.share ?? force.share ?? 0 }));
  const trend = id => {
    const series = average.map(item => item.rows.find(row => row.partyId === id)?.share).filter(Number.isFinite);
    return series.length >= 2 ? round1(series.at(-1) - series[Math.max(0, series.length - 1 - RULES.insight.weeks)]) : 0;
  };
  const support = society ? segmentSupport(shares.map(force => ({ id: force.id, share: force.share, agenda: force.agenda, stance: stanceOf(force) })), society, { undecided: world?.undecided ?? 27 }) : null;
  const past = obs.segments.length > 1 ? obs.segments[Math.max(0, obs.segments.length - 1 - RULES.insight.weeks)] : null;
  const insights = {};
  const nationalOf = id => shares.find(item => item.id === id)?.share ?? 0;
  for (const force of shares) {
    const list = [];
    const rows = support?.rows[force.id] ?? [];
    const named = id => support.segments.find(item => item.id === id);
    const ranked = [...rows].sort((a, b) => b.factor - a.factor);
    const strong = ranked.filter(item => item.factor >= RULES.insight.strong).slice(0, 2);
    const weak = [...ranked].reverse().filter(item => item.factor <= RULES.insight.weak).slice(0, 2);
    for (const item of strong) list.push({ kind: 'forte-tra', text: `forte tra ${named(item.id).label.toLowerCase()}`, detail: `${say(item.support)}% contro ${say(nationalOf(force.id))}% in media`, segment: item.id, value: item.support });
    for (const item of weak) list.push({ kind: 'debole-tra', text: `debole tra ${named(item.id).label.toLowerCase()}`, detail: `${say(item.support)}% contro ${say(nationalOf(force.id))}% in media`, segment: item.id, value: item.support });
    if (past?.rows?.[force.id] && rows.length) {
      const grown = rows.map((item, index) => ({ item, delta: item.support - (past.rows[force.id][index] ?? item.support) })).sort((a, b) => b.delta - a.delta)[0];
      if (grown && grown.delta >= RULES.insight.growth) list.push({ kind: 'in-crescita', text: `in crescita tra ${named(grown.item.id).label.toLowerCase()}`, detail: `${grown.delta >= 0 ? '+' : '−'}${say(Math.abs(grown.delta))} punti in ${RULES.insight.weeks} settimane`, segment: grown.item.id, value: round1(grown.delta) });
    } else if (trend(force.id) >= RULES.insight.growth) list.push({ kind: 'in-crescita', text: 'in crescita nelle ultime settimane', detail: `+${say(trend(force.id))} punti in ${RULES.insight.weeks} settimane`, value: trend(force.id) });
    // A pool that can be contested: a segment with many undecided where the force is below its average, not far from what it says.
    const pool = [...rows].filter(item => item.factor < 1.02 && named(item.id).undecided >= RULES.insight.pool).sort((a, b) => named(b.id).undecided - named(a.id).undecided)[0];
    if (pool) list.push({ kind: 'bacino', text: `bacino contendibile: ${named(pool.id).label.toLowerCase()}`, detail: `${say(named(pool.id).undecided)}% di indecisi, la forza è al ${say(pool.support)}%`, segment: pool.id, value: named(pool.id).undecided });
    // An area to win back: where the force stands clearly below its national average.
    const places = regional ? Object.entries(regional).map(([region, rowsOf]) => [region, rowsOf.find(row => row.partyId === force.id)?.share]).filter(([, value]) => Number.isFinite(value)) : [];
    const low = places.map(([region, value]) => ({ region, value, gap: value - nationalOf(force.id) })).sort((a, b) => a.gap - b.gap)[0];
    if (low && low.gap <= -RULES.insight.territory) list.push({ kind: 'da-recuperare', text: `area da recuperare: ${low.region}`, detail: `${say(low.value)}% contro ${say(nationalOf(force.id))}% in media`, region: low.region, value: low.value });
    const high = places.map(([region, value]) => ({ region, value, gap: value - nationalOf(force.id) })).sort((a, b) => b.gap - a.gap)[0];
    if (high && high.gap >= RULES.insight.territory) list.push({ kind: 'forte-in', text: `forte in ${high.region}`, detail: `${say(high.value)}% contro ${say(nationalOf(force.id))}% in media`, region: high.region, value: high.value });
    insights[force.id] = list;
  }
  const flowRows = latestAverage ? flowsOf(latestAverage.rows, shares) : [];
  const second = Object.fromEntries(shares.map(force => [force.id, secondChoice(force, shares, { ties })]));
  const loyalty = Object.fromEntries(shares.map(force => [force.id, loyaltyOf(force, { trend: trend(force.id) })]));
  const themes = society ? { national: themesOf(society, null, 5), bySegment: Object.fromEntries((society.segments ?? []).map(segment => [segment.id, themesOf(society, segment.id, 3)])) } : null;
  const scenarioForces = shares.map(force => ({ id: force.id, label: force.label, abbreviation: force.abbreviation ?? null, share: force.share, axis: force.axis, isPlayer: force.isPlayer, color: force.color, spread: latestAverage?.spread?.[force.id] ?? 0.4 })).filter(force => force.share > 0);
  const extras = { approval: obs.approval, regionalHistory: obs.regional, laws: obs.laws, scenarioForces, scenarios: defaultScenarios(world, scenarioForces, ties) };
  return { ...extras, institutes, average, latestAverage, previousAverage: average.at(-2) ?? null, segments: support, insights, flows: flowRows, secondChoice: second, loyalty, themes, trend: Object.fromEntries(shares.map(force => [force.id, trend(force.id)])), labelOf, weeks: average.length };
}

// ---------- approval, regions, laws, coalitions ----------
// Approval is not a vote: a citizen can approve the Government and vote for another force. The series keeps the three readings of the headline poll week after week.
export function recordApproval(input, { week, date, government = null, executive = null, leader = null, margin = null }) {
  const obs = normalizeObservatory(input);
  if (government === null && executive === null && leader === null) return obs;
  obs.approval = [...obs.approval.filter(item => item.week !== week), { week, date, government, executive, leader, margin }].slice(-EXT.approvalKept);
  return obs;
}
// The regional picture, one snapshot every few weeks for the largest forces: regional: { region: [{ partyId, share }] }.
export function recordRegional(input, { week, date, regional, partyIds }) {
  const obs = normalizeObservatory(input);
  if (!regional || week % EXT.regional.every !== 0) return obs;
  const keep = new Set(partyIds);
  const rows = Object.fromEntries(Object.entries(regional).map(([region, list]) => [region, list.filter(row => keep.has(row.partyId)).map(row => [row.partyId, round1(row.share)])]));
  obs.regional = [...obs.regional.filter(item => item.week !== week), { week, date, rows }].slice(-EXT.regional.kept);
  return obs;
}
export const regionalSeries = (obs, partyId, region) => normalizeObservatory(obs).regional.map(item => ({ week: item.week, date: item.date, share: item.rows?.[region]?.find(([id]) => id === partyId)?.[1] ?? null })).filter(item => Number.isFinite(item.share));

// What the citizens think of a law that is in force. Read from what the measure does to each segment (its winners and losers) and from who governs, never from the vote:
// the institutes interview the same population with their own sample and error, the average is declared with its uncertainty (sampling and model), and the reading moves nothing by itself.
export const lawKey = law => `legge:${law.lawId ?? `${law.title}|${law.week}`}`;
function governingShareBySegment(entries, society, undecided) {
  const support = segmentSupport(entries, society, { undecided });
  if (!support) return {};
  const stance = new Map(entries.map(item => [item.id, item.stance ?? 0]));
  return Object.fromEntries(support.segments.map((segment, index) => {
    let gov = 0, all = 0;
    for (const [id, list] of Object.entries(support.rows)) { const value = list[index]?.support ?? 0; all += value; if ((stance.get(id) ?? 0) > 0) gov += value; }
    return [segment.id, all ? gov / all : 0.45];
  }));
}
function surveyOf(law, stage, { week, date, seed, society, entries, undecided }) {
  const L = EXT.laws;
  const deltas = new Map([...(law.winners ?? []), ...(law.losers ?? [])].map(item => [item.id, item.delta ?? 0]));
  const governing = governingShareBySegment(entries, society, undecided);
  const sign = ['giocatore', 'governo', 'maggioranza'].includes(law.origin) ? 1 : law.origin === 'opposizione' ? -1 : 0.4;
  const segments = (society?.segments ?? []).map(segment => {
    const base = 50 + L.scale * (deltas.get(segment.id) ?? 0) + L.partisan * ((governing[segment.id] ?? 0.45) - 0.5) * sign
      - (law.covered === false ? L.uncovered : 0) - Math.min(L.deficitCap, (law.deficit ?? 0) * L.perDeficit) - (stage.id === 'bilancio' ? L.fatigue * (law.controversy ?? 0) : 0);
    return { id: segment.id, label: segment.label, share: segment.share, approval: round1(clamp(base, L.floor, L.ceiling)) };
  });
  if (!segments.length) return null;
  const total = segments.reduce((sum, item) => sum + item.share, 0) || 1;
  const truth = segments.reduce((sum, item) => sum + item.approval * item.share, 0) / total;
  const key = lawKey(law);
  const institutes = POLL_INSTITUTES.map(profile => {
    const sample = instituteSample(profile, seed, week);
    const sigma = Math.sqrt(Math.max(0.04, truth / 100 * (1 - truth / 100)) / sample) * 100;
    return { id: profile.id, sample, approval: round1(clamp(truth + gauss(seed, 'legge', key, stage.id, profile.id) * sigma * 0.5, 1, 99)) };
  });
  const decided = institutes.reduce((sum, item) => sum + item.approval, 0) / institutes.length;
  const pooled = institutes.reduce((sum, item) => sum + item.sample, 0);
  const margin = round1(Math.sqrt(marginOf(pooled) ** 2 + L.model ** 2));
  const undecidedShare = round1(clamp(L.undecided.base + L.undecided.perControversy * (law.controversy ?? 0) * 2 - Math.abs(decided - 50) / 8, 8, 35));
  const verdict = decided <= EXT.clear.against ? 'contrari' : decided >= EXT.clear.for ? 'favorevoli' : 'divisi';
  return { stage: stage.id, label: stage.label, week, date, approval: round1(decided * (100 - undecidedShare) / 100), against: round1((100 - decided) * (100 - undecidedShare) / 100), undecided: undecidedShare, decided: round1(decided), margin, institutes, bySegment: segments.map(item => ({ id: item.id, label: item.label, approval: item.approval })), verdict, applied: false };
}
// The laws in force that are due a survey (one per stage, once). entries: the forces as segmentSupport reads them.
export function lawSurveys(input, { week, date, seed, lawsApplied = [], society = null, entries = [], undecided = 27 }) {
  const obs = normalizeObservatory(input);
  if (!society?.segments?.length) return obs;
  let laws = obs.laws;
  for (const law of lawsApplied) {
    const key = lawKey(law);
    let record = laws.find(item => item.key === key);
    for (const stage of EXT.laws.stages) {
      if (week < (law.week ?? 0) + stage.after || record?.surveys.some(item => item.stage === stage.id)) continue;
      const survey = surveyOf(law, stage, { week, date, seed, society, entries, undecided });
      if (!survey) continue;
      if (!record) { record = { key, lawId: law.lawId ?? null, title: law.title, area: law.area, category: law.category, week: law.week ?? week, date: law.date ?? date, origin: law.origin ?? null, surveys: [] }; laws = [record, ...laws]; }
      record.surveys = [...record.surveys, survey];
    }
  }
  obs.laws = laws.slice(0, EXT.laws.kept);
  return obs;
}

// A coalition against running alone: the share of each member that the list of another force keeps (it grows with the distance on the axis and with bad relations),
// declared with its uncertainty (the spread of the institutes and the leak itself). A projection of the voting intentions, not a result, and nothing in the game moves with it.
export function coalitionScenario({ memberIds, leaderId = null, forces, ties = {}, label = null }) {
  const C = EXT.coalition;
  const byId = new Map(forces.map(item => [item.id, item]));
  const members = [...new Set(memberIds)].map(id => byId.get(id)).filter(Boolean);
  const lead = byId.get(leaderId) ?? members.slice().sort((a, b) => b.share - a.share)[0];
  if (!lead || !members.length) return null;
  const rows = members.map(member => {
    const tie = member.id === lead.id ? 0 : ties[[member.id, lead.id].sort().join('|')] ?? 0;
    const leak = member.id === lead.id ? 0 : clamp(C.leak + C.perAxis * Math.abs((member.axis ?? 0) - (lead.axis ?? 0)) + (tie < 0 ? C.badTies : tie > 30 ? -C.goodTies : 0), C.min, C.max);
    return { id: member.id, label: member.label, abbreviation: member.abbreviation ?? null, share: member.share, leak: round2(leak), kept: round2(member.share * (1 - leak)) };
  });
  const total = rows.reduce((sum, row) => sum + row.kept, 0);
  const uncertainty = Math.sqrt(members.reduce((sum, member) => sum + (member.spread ?? 0.4) ** 2, 0) + rows.reduce((sum, row) => sum + (C.spread * row.leak * row.share) ** 2, 0));
  return { memberIds: members.map(item => item.id), leaderId: lead.id, label: label ?? members.map(item => item.abbreviation || item.label).join(' + '), total: round1(total), low: round1(Math.max(0, total - uncertainty)), high: round1(total + uncertainty), solo: round1(lead.share), gain: round1(total - lead.share), lost: round1(rows.reduce((sum, row) => sum + row.share, 0) - total), rows, uncertainty: round1(uncertainty) };
}
// The scenarios the page offers by itself: running alone, each alliance of the world, and a wide field of forces near the leader (the player's force, or the largest).
export function defaultScenarios(world, forces, ties = world?.ties ?? {}) {
  const shares = forces.filter(item => item.share > 0);
  const lead = shares.find(item => item.isPlayer) ?? shares.slice().sort((a, b) => b.share - a.share)[0];
  if (!lead) return [];
  const out = [{ id: 'solo', ...coalitionScenario({ memberIds: [lead.id], leaderId: lead.id, forces: shares, ties, label: `${lead.abbreviation || lead.label} da sola` }) }];
  for (const alliance of (world?.alliances ?? []).filter(item => item.status === 'active' && item.partyIds?.length >= 2)) {
    const scenario = coalitionScenario({ memberIds: alliance.partyIds, leaderId: alliance.partyIds.includes(lead.id) ? lead.id : null, forces: shares, ties, label: alliance.label });
    if (scenario) out.push({ id: `alleanza:${alliance.id}`, ...scenario });
  }
  const near = shares.filter(item => item.id !== lead.id && Math.abs((item.axis ?? 0) - (lead.axis ?? 0)) <= 1.5 && (ties[[item.id, lead.id].sort().join('|')] ?? 0) >= 0).sort((a, b) => b.share - a.share).slice(0, EXT.coalition.widest - 1);
  if (near.length) out.push({ id: 'campo-largo', ...coalitionScenario({ memberIds: [lead.id, ...near.map(item => item.id)], leaderId: lead.id, forces: shares, ties, label: 'Campo largo' }) });
  return out;
}
