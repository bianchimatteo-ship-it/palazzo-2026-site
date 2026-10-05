// How the events of the week are chosen from the situation: pure helpers of the career engine. The catalogue says what
// can happen (conditions, weights, cooldowns, families); here is how likely it is, which weekday it lands on and when the
// political world may ask the player for a position. Nothing is drawn here: the engine passes in its own random draws.

// The weekday of an event (0 = Monday … 6 = Sunday). A preference, never a condition: every event can fall on any day;
// the days an event "prefers" weigh more, the weekend weighs less unless the event is a weekend one. `unit` is a number in
// [0,1) taken from a hash of the event and the week, so that the pick never touches the career's random sequence.
export function eventDay(preferred, unit, base = [1, 1, 1, 1, 0.9, 0.5, 0.4], taken = []) {
  const weights = base.map((weight, day) => weight * (preferred?.length ? (preferred.includes(day) ? 3 : 0.35) : 1) * (taken.includes(day) ? 0.6 : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let pick = unit * total;
  for (let day = 0; day < weights.length; day++) { pick -= weights[day]; if (pick < 0) return day; }
  return 0;
}

// A weighted pick among { item, weight } rows with a draw in [0,1).
export function pickWeighted(rows, unit) {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!(total > 0)) return null;
  let pick = unit * total;
  return rows.find(row => (pick -= row.weight) < 0) ?? rows[0];
}

// How much a fact of the political world concerns the player (0–1): what a national scandal means to a secretary is not
// what it means to a municipal councillor, and a flood in the region is the business of whoever governs the region.
export function reactionRelevance(reaction, sit) {
  const scope = reaction?.scope ?? 'nazionale';
  const office = sit.office ?? {};
  const regional = Boolean(office.regione) || Boolean(sit.role?.regional);
  const local = Boolean(office.comune) || Boolean(office.provincia) || Boolean(sit.role?.local);
  const lead = sit.secretary || sit.premier;
  let exposure;
  if (scope === 'locale') exposure = local ? 0.9 : regional ? 0.4 : sit.seat ? 0.3 : lead ? 0.3 : 0.12;
  else if (scope === 'regionale') exposure = regional ? 0.9 : office.provincia ? 0.6 : lead ? 0.6 : local ? 0.45 : sit.seat ? 0.5 : 0.15;
  else exposure = lead ? 1 : sit.minister ? 0.9 : sit.direzione ? 0.7 : sit.seat ? 0.65 : office.europa ? 0.5 : regional ? 0.4 : local ? 0.2 : sit.party ? 0.15 : 0.1;
  // Whoever is known gets asked more often.
  const known = 0.55 + Math.max(0, Math.min(100, sit.stats?.notoriety ?? 30)) / 100;
  return Math.max(0, Math.min(1, exposure * known));
}
