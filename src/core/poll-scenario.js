// The opening poll of a new career. Three modes:
//   realistico      the latest real Supermedia on the day the career starts (the default: nothing here touches it);
//   casuale         a poll drawn from a seed: the real forces keep their order of magnitude, a random swing moves each one, "Altri" is drawn too; the same seed always gives the same poll;
//   personalizzato  the player writes the share of each force; what is left is "Altri".
// Whatever the mode, the poll is a list of shares in tenths of a point that adds up to exactly 100.0 with "Altri", never a NaN or a negative number, and the real data files are never changed:
// the scenario only exists in the game that chose it (and is saved with it, so the same game reloaded has the same poll).
export const POLL_SCENARIOS = Object.freeze({
  realistico: { label: 'Realistico', detail: 'Parti dalla Supermedia reale più recente: partiti, percentuali e variazioni sono quelli della fonte.' },
  casuale: { label: 'Casuale', detail: 'Un quadro politico inventato ma verosimile, estratto da un seme: i partiti reali cambiano peso, l’ordine può cambiare, «Altri» si ridimensiona. Lo stesso seme dà sempre lo stesso quadro.' },
  personalizzato: { label: 'Personalizzato', detail: 'Scrivi tu la percentuale di ogni partito: quello che resta è «Altri». Il totale deve fare 100.' }
});
export const SCENARIO_LIMITS = Object.freeze({ minShare: 0.5, maxShare: 60, othersMin: 1, othersMax: 12, randomSigma: 0.38 });
export const SCENARIO_MODES = Object.freeze(Object.keys(POLL_SCENARIOS));
const hash = text => [...String(text)].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const seeded = seed => { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const gauss = random => Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random());
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const tenths = value => Math.round(finite(value) * 10);

export function normalizePollScenario(raw) {
  const mode = SCENARIO_MODES.includes(raw?.mode) ? raw.mode : 'realistico';
  const custom = {};
  if (raw?.custom && typeof raw.custom === 'object') for (const [id, value] of Object.entries(raw.custom).slice(0, 80)) { const number = Number(value); if (/^[\w.:-]{1,120}$/.test(id) && Number.isFinite(number)) custom[id] = number; }
  return { mode, seed: String(raw?.seed ?? '1').slice(0, 40) || '1', custom };
}

// `weights` (non-negative) → integers (tenths) that add up to `total`, each at least `floor`: largest remainder, then what is under the floor is lifted by taking from the biggest.
export function allocate(weights, total, floor = 0) {
  const n = weights.length;
  if (!n) return [];
  const safe = weights.map(weight => Number.isFinite(weight) && weight > 0 ? weight : 0);
  const sum = safe.reduce((a, b) => a + b, 0);
  const exact = sum > 0 ? safe.map(weight => weight / sum * total) : safe.map(() => total / n);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  exact.map((value, index) => ({ index, frac: value - Math.floor(value) })).sort((a, b) => b.frac - a.frac || a.index - b.index).forEach(({ index }) => { if (left-- > 0) out[index] += 1; });
  for (let guard = 0; guard < 5000; guard++) {
    const low = out.findIndex(value => value < floor);
    if (low < 0) break;
    const high = out.reduce((best, value, index) => value > out[best] ? index : best, 0);
    if (out[high] <= floor) break;
    out[low] += 1; out[high] -= 1;
  }
  return out;
}
// A poll in tenths → { rows: [{ partyId, share, delta: 0 }], others } in points, adding up to exactly 100.0.
function pack(ids, shareTenths, othersTenths) {
  const rows = ids.map((partyId, index) => ({ partyId, share: shareTenths[index] / 10, delta: 0 }));
  const others = othersTenths / 10;
  return { rows, others, total: Math.round((rows.reduce((sum, row) => sum + row.share * 10, 0) + othersTenths)) / 10 };
}

// The real rows ([{ partyId, share }]) are the forces the poll measures and the starting point of the random draw.
export function randomPoll({ rows, seedText = '', seed = '1' }) {
  const random = seeded(`${seedText}|scenario|${seed}`);
  const ids = rows.map(row => row.partyId);
  const { minShare, maxShare, othersMin, othersMax, randomSigma } = SCENARIO_LIMITS;
  const othersTenths = tenths(2 + random() * (Math.min(othersMax, 8) - 3));
  const weights = rows.map(row => Math.max(minShare, finite(row.share, minShare)) * Math.exp(randomSigma * gauss(random)));
  let shares = allocate(weights, 1000 - othersTenths, tenths(minShare));
  // no force above the cap: what exceeds it goes to the others, in proportion, a few passes at most
  const maxTenths = tenths(maxShare);
  for (let pass = 0; pass < 6 && shares.some(value => value > maxTenths); pass++) {
    const over = shares.reduce((sum, value) => sum + Math.max(0, value - maxTenths), 0);
    const base = shares.map(value => Math.min(value, maxTenths));
    const share = allocate(base.map(value => value < maxTenths ? value : 0), over, 0);
    shares = base.map((value, index) => value + share[index]);
  }
  return pack(ids, shares, othersTenths);
}

// What the player wrote: a number per force (the real one where nothing was written); what is left is "Altri". `problems` says what stops the career from starting.
export function customPoll({ rows, custom = {} }) {
  const ids = rows.map(row => row.partyId);
  const { minShare, maxShare, othersMin } = SCENARIO_LIMITS;
  const problems = [];
  const values = rows.map(row => { const value = custom[row.partyId]; return value === undefined || value === '' || value === null ? finite(row.share) : Number(value); });
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) problems.push(`${ids[index]}: non è un numero.`);
    else if (value < minShare) problems.push(`Ogni partito deve avere almeno ${String(minShare).replace('.', ',')}%.`);
    else if (value > maxShare) problems.push(`Nessun partito può superare il ${maxShare}%.`);
  });
  const clean = values.map(value => Number.isFinite(value) ? Math.min(maxShare, Math.max(0, value)) : 0);
  const sum = clean.reduce((a, b) => a + b, 0);
  const othersTenths = 1000 - clean.reduce((a, b) => a + tenths(b), 0);
  if (othersTenths < tenths(othersMin)) problems.push(`I partiti sommano ${sum.toFixed(1).replace('.', ',')}%: lascia almeno l’${String(othersMin).replace('.', ',')}% a «Altri» (togli ${((tenths(othersMin) - othersTenths) / 10).toFixed(1).replace('.', ',')} punti o usa «Porta a 100»).`);
  return { ...pack(ids, clean.map(tenths), Math.max(0, othersTenths)), problems: [...new Set(problems)] };
}
// «Porta a 100»: the written values are scaled so that the forces leave a sensible share to "Altri" (never over the cap, never under the minimum).
export function fitCustom({ rows, custom = {}, others = 4 }) {
  const { minShare, maxShare } = SCENARIO_LIMITS;
  const values = rows.map(row => { const value = Number(custom[row.partyId]); return Number.isFinite(value) ? value : finite(row.share); });
  const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const target = 100 - others;
  const scaled = allocate(values.map(value => Math.min(maxShare, Math.max(minShare, value * target / total))), tenths(target), tenths(minShare));
  return Object.fromEntries(rows.map((row, index) => [row.partyId, scaled[index] / 10]));
}

// The poll for a scenario: { mode, seed, rows, others, total, problems }. Realistic: the real rows as they are.
export function scenarioPoll(scenario, { rows, seedText = '' }) {
  const wanted = normalizePollScenario(scenario);
  if (!rows?.length) return { mode: wanted.mode, seed: wanted.seed, rows: [], others: 100, total: 100, problems: [] };
  if (wanted.mode === 'casuale') return { mode: 'casuale', seed: wanted.seed, ...randomPoll({ rows, seedText, seed: wanted.seed }), problems: [] };
  if (wanted.mode === 'personalizzato') return { mode: 'personalizzato', seed: wanted.seed, ...customPoll({ rows, custom: wanted.custom }) };
  const sum = rows.reduce((total, row) => total + tenths(row.share), 0);
  return { mode: 'realistico', seed: wanted.seed, rows: rows.map(row => ({ partyId: row.partyId, share: row.share, delta: finite(row.delta) })), others: Math.round(1000 - sum) / 10, total: 100, problems: [] };
}
