// The life of the cabinet: what happens among the ministers and between them and the Prime Minister, week after week. It joins the systems that already exist — the ministers of the
// accord and of the dossiers (loyalty, competence, pressure), the reshuffle, the partners' satisfaction, the stability — and adds what was missing:
//   - ambition and the bond with the Prime Minister, kept on each minister (traits, created once from the minister's id: a save from before simply gets them);
//   - a periodic evaluation of every minister (competence, loyalty, how much of what was asked got done, the pressure);
//   - requests: a minister asks for more (ambition), the partners or the press ask for a replacement of the one who does badly;
//   - conflicts between ministers whose areas pull in opposite directions;
//   - the cabinet meeting (Consiglio dei ministri) that takes a collegial decision, with consequences for the allies;
//   - the minister who contests the line in public and, if nobody listens, resigns with a quarrel.
// The Prime Minister decides: when it is the player, requests, conflicts and meetings wait for him (and turn into their default if he lets them pass); when it is a simulated one, the same
// rules are answered by chance seeded on the date. Everything is pure: the store passes the parliament and gets it back with the lines to tell.
import { DATA_SOURCES } from '../data/schema.js?v=20261109-3';
import { AREA_BY_ID, areasOfPortfolio } from '../data/simulation/policy-rules.js?v=20261109-3';
import { activeMinisters, assignMinister, changePartner, groupProfile, parliamentInternals } from './parliament-engine.js?v=20261109-3';

const { getGroup, record } = parliamentInternals;
const SIM = DATA_SOURCES.SIMULATION;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const weeksBetween = (from, to) => from && to ? Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 604800000) : 999;
const hashOf = text => { let h = 2166136261 >>> 0; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };

export const CABINET_LIFE = Object.freeze({
  evalEvery: 13, meetingEvery: 7, conflictEvery: 9, requestPatience: 8, meetingPatience: 3, conflictPatience: 6,
  ambitionAsk: 70, quarrelLoyalty: 35, quarrelAmbition: 60, quarrelWeeks: 4, resignWeeks: 10,
  grades: Object.freeze([['ottimo', 75], ['buono', 60], ['sufficiente', 45], ['insufficiente', 0]]),
  factor: Object.freeze({ ottimo: 1.12, buono: 1.04, sufficiente: 1, insufficiente: 0.88 }),
  source: SIM
});
export const GRADE_LABELS = Object.freeze({ ottimo: 'Ottimo', buono: 'Buono', sufficiente: 'Sufficiente', insufficiente: 'Insufficiente' });
// Areas that pull against each other when two ministers answer for them (money in two places, protection against production…).
const RIVAL_AREAS = Object.freeze([['fisco', 'welfare'], ['finanze', 'sanita'], ['finanze', 'infrastrutture'], ['ambiente', 'industria'], ['ambiente', 'energia'], ['sicurezza', 'immigrazione'], ['lavoro', 'industria'], ['difesa', 'welfare']]);

// ---------- traits ----------
export function traitsOf(minister, government = null) {
  if (minister.traits) return minister.traits;
  // (from what the appointment is — seat, group, date — and not from its random id: the same game gives the same traits)
  const seed = hashOf(`${minister.portfolio}|${minister.groupId ?? ''}|${minister.appointedAt ?? ''}|${minister.loyalty ?? ''}|${minister.competence ?? ''}|tratti`);
  const loyalty = Number.isFinite(minister.loyalty) ? minister.loyalty : 60;
  return { ambition: 20 + seed % 71, bond: clamp(Math.round(loyalty * 0.7 + (seed >> 8) % 30), 0, 100), grievance: 0, evaluations: [], asked: 0, government: government?.id ?? null };
}
const withMinisters = (parliament, fn) => ({ ...parliament, government: { ...parliament.government, ministers: parliament.government.ministers.map(fn) } });
const patchMinister = (parliament, id, fn) => withMinisters(parliament, item => item.id === id ? fn(item) : item);
const traitsPatch = (item, patch) => ({ ...item, traits: { ...traitsOf(item), ...(item.traits ?? {}), ...patch } });
const gradeOf = score => CABINET_LIFE.grades.find(([, limit]) => score >= limit)[0];
export const lastGrade = minister => minister?.traits?.evaluations?.at(-1)?.grade ?? null;
// The minister who answers for an area (by the portfolio the area belongs to).
export const ministerOfArea = (government, areaId) => activeMinisters(government).find(item => areasOfPortfolio(item.portfolio).includes(areaId)) ?? null;
// How well the minister of an area does the job, as a factor on what a measure of the Government achieves (1 = as written).
export function ministerFactor(parliament, areaId) {
  const minister = ministerOfArea(parliament?.government, areaId);
  if (!minister) return 1;
  const grade = lastGrade(minister);
  if (grade) return CABINET_LIFE.factor[grade];
  return clamp(0.9 + ((minister.competence ?? 60) - 40) / 300, 0.9, 1.1);
}

export const lifeOf = government => ({ requests: [], conflicts: [], meetings: [], lastEval: null, lastMeeting: null, lastConflict: null, ...(government?.life ?? {}) });
const setLife = (parliament, life) => ({ ...parliament, government: { ...parliament.government, life } });
const log = (parliament, date, type, text, details = {}) => record(parliament, date, type, text, { governmentId: parliament.government.id, source: SIM, ...details });
const shiftStability = (parliament, delta) => ({ ...parliament, government: { ...parliament.government, stability: clamp(Math.round((parliament.government.stability ?? 50) + delta), 0, 100) } });
const nameOf = (parliament, minister) => `${minister.playerAppointed ? 'il ministro ' : 'il ministro '}${minister.portfolio}${minister.groupName ? ` (${minister.groupName})` : ''}`;

// Replaces a minister with a new simulated one of the same group (never a real person), the old one leaving with the reason given.
function replace(parliament, minister, date, reason) {
  const ended = withMinisters(parliament, item => item.id === minister.id ? { ...item, endedAt: date, endReason: reason } : item);
  // a ministry is never left empty: if no one of the group can take it (it left the majority, the post is technical) the minister stays
  try { return assignMinister(ended, minister.portfolio, minister.groupId, date); } catch { return parliament; }
}

// ---------- the weekly life ----------
export function advanceCabinetLife(input, { date, week = 0, rand = Math.random, society = null, playerPremier = false } = {}) {
  let next = input;
  const lines = [];
  const government = next?.government;
  if (!government || !['active', 'crisis'].includes(government.status)) return { parliament: input, lines };
  const since = government.formedAt ?? government.inheritedAt ?? date;
  // traits, once
  if (government.ministers.some(item => !item.traits && !item.endedAt)) next = withMinisters(next, item => item.endedAt || item.traits ? item : { ...item, traits: traitsOf(item, government) });
  let life = lifeOf(next.government);

  // 1. Evaluation: every thirteen weeks each minister gets a grade from competence, loyalty and how much pressure he is under.
  if (weeksBetween(life.lastEval ?? since, date) >= CABINET_LIFE.evalEvery) {
    const verdicts = [];
    for (const minister of activeMinisters(next.government)) {
      const delivery = 100 - clamp((minister.pressure ?? 0) * 10, 0, 60);
      const score = Math.round((minister.competence ?? 60) * 0.35 + (minister.loyalty ?? 60) * 0.25 + delivery * 0.4);
      const grade = gradeOf(score);
      next = patchMinister(next, minister.id, item => ({ ...traitsPatch(item, { evaluations: [...(item.traits?.evaluations ?? []), { date, score, grade }].slice(-8) }), loyalty: clamp((item.loyalty ?? 60) + (grade === 'ottimo' ? 3 : grade === 'insufficiente' ? -3 : 0), 0, 100), pressure: Math.max(0, (item.pressure ?? 0) + (grade === 'insufficiente' ? 1 : 0)) }));
      verdicts.push(`${minister.portfolio} ${GRADE_LABELS[grade].toLowerCase()}`);
      const previous = minister.traits?.evaluations?.at(-1)?.grade;
      if (grade === 'insufficiente' && previous === 'insufficiente' && !life.requests.some(item => item.ministerId === minister.id && item.type === 'sostituzione')) {
        life = { ...life, requests: [...life.requests, { id: `richiesta-${date}-${minister.id}-s`, type: 'sostituzione', ministerId: minister.id, by: hashOf(`${date}|${minister.id}`) % 2 ? 'gli alleati' : 'la stampa', openedAt: date }] };
        lines.push(`Si chiede la sostituzione del ministro ${minister.portfolio}: due valutazioni insufficienti di fila.`);
      }
    }
    life = { ...life, lastEval: date };
    next = log(setLife(next, life), date, 'valutazione-ministri', `Valutazione periodica dei ministri: ${verdicts.join(', ')}.`, { auto: !playerPremier });
    lines.push(`Valutazione dei ministri: ${verdicts.slice(0, 4).join(', ')}${verdicts.length > 4 ? '…' : ''}.`);
  }

  // 2. Ambition: a minister doing well asks for more; ignored too long, he loses loyalty.
  for (const minister of activeMinisters(next.government)) {
    const traits = traitsOf(minister);
    const open = life.requests.find(item => item.ministerId === minister.id && item.type === 'ambizione');
    if (open) {
      if (weeksBetween(open.openedAt, date) >= CABINET_LIFE.requestPatience) {
        life = { ...life, requests: life.requests.filter(item => item !== open) };
        next = patchMinister(setLife(next, life), minister.id, item => ({ ...traitsPatch(item, { bond: clamp((traits.bond ?? 60) - 6, 0, 100), grievance: (traits.grievance ?? 0) + 2 }), loyalty: clamp((item.loyalty ?? 60) - 8, 0, 100) }));
        next = shiftStability(next, -2);
        lines.push(`Il ministro ${minister.portfolio} non ottiene risposta alla sua richiesta: la lealtà cala.`);
      }
      continue;
    }
    if (traits.ambition >= CABINET_LIFE.ambitionAsk && ['ottimo', 'buono'].includes(lastGrade(minister)) && (traits.asked ?? 0) < 2 && weeksBetween(minister.traits?.evaluations?.at(-1)?.date, date) < 2) {
      life = { ...life, requests: [...life.requests, { id: `richiesta-${date}-${minister.id}-a`, type: 'ambizione', ministerId: minister.id, by: 'il ministro', openedAt: date }] };
      next = patchMinister(setLife(next, life), minister.id, item => traitsPatch(item, { asked: (traits.asked ?? 0) + 1 }));
      lines.push(`Il ministro ${minister.portfolio} chiede più peso nel governo.`);
    }
  }

  // 3. Conflicts between ministers of rival areas.
  const ministers = activeMinisters(next.government);
  if (ministers.length >= 2 && weeksBetween(life.lastConflict ?? since, date) >= CABINET_LIFE.conflictEvery && !life.conflicts.some(item => !item.resolvedAt)) {
    const pairs = [];
    for (const a of ministers) for (const b of ministers) if (a.id < b.id) {
      const areasA = areasOfPortfolio(a.portfolio), areasB = areasOfPortfolio(b.portfolio);
      const rival = RIVAL_AREAS.find(([x, y]) => (areasA.includes(x) && areasB.includes(y)) || (areasA.includes(y) && areasB.includes(x)));
      if (rival) pairs.push({ a, b, area: rival[0] });
    }
    if (pairs.length) {
      const pick = pairs[hashOf(`${date}|conflitto`) % pairs.length];
      const issue = AREA_BY_ID[pick.area]?.label ?? pick.area;
      life = { ...life, lastConflict: date, conflicts: [...life.conflicts, { id: `conflitto-${date}-${pick.a.id}`, a: pick.a.id, b: pick.b.id, issue, severity: 1 + Math.round(rand() * 2), openedAt: date, resolvedAt: null }] };
      next = setLife(next, life);
      lines.push(`Scontro in Consiglio fra i ministri di ${pick.a.portfolio} e di ${pick.b.portfolio} su ${issue.toLowerCase()}.`);
      next = log(next, date, 'conflitto-ministri', `Scontro fra i ministri di ${pick.a.portfolio} e di ${pick.b.portfolio} su ${issue.toLowerCase()}.`, { auto: !playerPremier });
    } else life = { ...life, lastConflict: date };
  }
  for (const conflict of life.conflicts.filter(item => !item.resolvedAt && weeksBetween(item.openedAt, date) >= CABINET_LIFE.conflictPatience)) {
    // nobody settled it: the quarrel costs the Government (the Prime Minister simulated settles half of them)
    const settledByPm = !playerPremier && rand() < 0.5;
    life = { ...life, conflicts: life.conflicts.map(item => item === conflict ? { ...item, resolvedAt: date, outcome: settledByPm ? 'mediato dal Presidente del Consiglio' : 'lasciato marcire' } : item) };
    next = setLife(next, life);
    if (!settledByPm) { next = shiftStability(next, -conflict.severity * 2); for (const id of [conflict.a, conflict.b]) next = patchMinister(next, id, item => traitsPatch(item, { bond: clamp((traitsOf(item).bond ?? 60) - 4, 0, 100) })); lines.push(`Lo scontro su ${conflict.issue.toLowerCase()} non è stato ricomposto: la stabilità del governo ne risente.`); }
    else lines.push(`Il Presidente del Consiglio ricompone lo scontro su ${conflict.issue.toLowerCase()}.`);
  }

  // 4. The minister who contests in public, and in the end walks out.
  for (const minister of activeMinisters(next.government)) {
    const traits = traitsOf(minister);
    const angry = (minister.loyalty ?? 60) < CABINET_LIFE.quarrelLoyalty && traits.ambition > CABINET_LIFE.quarrelAmbition;
    const grievance = angry ? (traits.grievance ?? 0) + 1 : Math.max(0, (traits.grievance ?? 0) - 1);
    if (grievance !== (traits.grievance ?? 0)) next = patchMinister(next, minister.id, item => traitsPatch(item, { grievance }));
    if (angry && grievance === CABINET_LIFE.quarrelWeeks) {
      next = shiftStability(next, -2);
      if (minister.groupId) next = changePartner(next, minister.groupId, -3);
      lines.push(`Il ministro ${minister.portfolio} contesta pubblicamente la linea del governo.`);
      next = log(next, date, 'ministro-contesta', `Il ministro ${minister.portfolio} contesta pubblicamente la linea del governo.`, { auto: !playerPremier });
    }
    if (angry && grievance >= CABINET_LIFE.resignWeeks && !minister.playerAppointed) {
      next = replace(next, minister, date, 'Dimissioni polemiche');
      next = shiftStability(next, -6);
      if (minister.groupId) next = changePartner(next, minister.groupId, -6);
      next = log(next, date, 'ministro-dimissioni-polemiche', `Il ministro ${minister.portfolio} si dimette sbattendo la porta: nuovo ministro dello stesso gruppo (figura simulata).`, { auto: !playerPremier });
      lines.push(`Dimissioni polemiche del ministro ${minister.portfolio}.`);
      life = lifeOf(next.government);
    }
  }

  // 5. The cabinet meeting.
  const meetings = life.meetings;
  const openMeeting = meetings.find(item => !item.decidedAt);
  if (!openMeeting && weeksBetween(life.lastMeeting ?? since, date) >= CABINET_LIFE.meetingEvery) {
    const issues = (society?.issues ?? []).map(issue => issue.area ?? Object.values(AREA_BY_ID).find(spec => spec.label === issue.topic)?.id).filter(id => AREA_BY_ID[id]);
    const areas = Object.keys(AREA_BY_ID);
    const area = issues[0] ?? areas[hashOf(`${date}|consiglio`) % areas.length];
    const meeting = { id: `consiglio-${date}`, area, topic: AREA_BY_ID[area].label, openedAt: date, decidedAt: null, choice: null };
    life = { ...life, lastMeeting: date, meetings: [...meetings, meeting].slice(-6) };
    next = setLife(next, life);
    lines.push(`Consiglio dei ministri: si discute di ${meeting.topic.toLowerCase()}.`);
    if (!playerPremier) { const out = decideMeeting(next, meeting.id, ['approvare', 'approvare', 'rinviare', 'respingere'][hashOf(`${date}|esito`) % 4], date, { auto: true }); next = out.parliament; lines.push(...out.lines); life = lifeOf(next.government); }
  } else if (openMeeting && playerPremier && weeksBetween(openMeeting.openedAt, date) >= CABINET_LIFE.meetingPatience) {
    const out = decideMeeting(next, openMeeting.id, 'rinviare', date, { auto: true, lapsed: true });
    next = out.parliament; lines.push(...out.lines); life = lifeOf(next.government);
  }

  // 6. The simulated Prime Minister answers the requests by himself (accept about a half; the replacement of who does badly is more likely to be accepted).
  if (!playerPremier) for (const request of lifeOf(next.government).requests) {
    if (weeksBetween(request.openedAt, date) < 2) continue;
    const accept = rand() < (request.type === 'sostituzione' ? 0.6 : 0.4);
    const out = resolveRequest(next, request.id, accept ? 'accogli' : 'rifiuta', date, { auto: true });
    next = out.parliament; lines.push(...out.lines);
  }
  return { parliament: next, lines };
}

// ---------- the Prime Minister's answers ----------
export function resolveRequest(parliament, id, choice, date, { auto = false } = {}) {
  const life = lifeOf(parliament.government);
  const request = life.requests.find(item => item.id === id);
  if (!request) throw new Error('Questa richiesta non è più aperta.');
  const minister = parliament.government.ministers.find(item => item.id === request.ministerId);
  let next = setLife(parliament, { ...life, requests: life.requests.filter(item => item !== request) });
  const lines = [];
  if (!minister || minister.endedAt) return { parliament: next, lines };
  const who = `il ministro ${minister.portfolio}`;
  if (!['accogli', 'rifiuta'].includes(choice)) throw new Error('Scegli se accogliere o respingere la richiesta.');
  if (request.type === 'ambizione') {
    if (choice === 'accogli') {
      next = patchMinister(next, minister.id, item => ({ ...traitsPatch(item, { bond: clamp((traitsOf(item).bond ?? 60) + 8, 0, 100), grievance: 0 }), loyalty: clamp((item.loyalty ?? 60) + 8, 0, 100) }));
      // the others notice: whoever was not asked for is a little more distant
      for (const other of activeMinisters(next.government).filter(item => item.id !== minister.id)) next = patchMinister(next, other.id, item => traitsPatch(item, { bond: clamp((traitsOf(item).bond ?? 60) - 2, 0, 100) }));
      next = shiftStability(next, -1);
      lines.push(`Accolta la richiesta di ${who}: più peso nel governo, qualche invidia nella squadra.`);
    } else {
      next = patchMinister(next, minister.id, item => ({ ...traitsPatch(item, { bond: clamp((traitsOf(item).bond ?? 60) - 5, 0, 100), grievance: (traitsOf(item).grievance ?? 0) + 1 }), loyalty: clamp((item.loyalty ?? 60) - 6, 0, 100) }));
      lines.push(`Respinta la richiesta di ${who}: la lealtà cala.`);
    }
  } else if (choice === 'accogli') {
    next = replace(next, minister, date, 'Sostituito su richiesta');
    if (minister.groupId) next = changePartner(next, minister.groupId, -3);
    next = shiftStability(next, -1);
    lines.push(`Sostituito ${who}: ${request.by} avevano chiesto un cambio.`);
  } else {
    next = patchMinister(next, minister.id, item => traitsPatch(item, { bond: clamp((traitsOf(item).bond ?? 60) + 3, 0, 100) }));
    if (request.by === 'gli alleati' && minister.groupId) { for (const id of Object.keys(next.government.partners ?? {})) if (id !== minister.groupId) next = changePartner(next, id, -4); }
    lines.push(`Confermato ${who}: ${request.by} non sono soddisfatti.`);
  }
  next = log(next, date, 'richiesta-ministro', lines[0], { auto });
  return { parliament: next, lines };
}

export function resolveConflict(parliament, id, choice, date) {
  const life = lifeOf(parliament.government);
  const conflict = life.conflicts.find(item => item.id === id && !item.resolvedAt);
  if (!conflict) throw new Error('Questo scontro non è più aperto.');
  if (!['media', 'sostieni-a', 'sostieni-b'].includes(choice)) throw new Error('Scegli come intervenire.');
  let next = parliament;
  const [a, b] = [conflict.a, conflict.b].map(ministerId => next.government.ministers.find(item => item.id === ministerId));
  const bump = (minister, delta, loyalty = 0) => { if (minister) next = patchMinister(next, minister.id, item => ({ ...traitsPatch(item, { bond: clamp((traitsOf(item).bond ?? 60) + delta, 0, 100) }), loyalty: clamp((item.loyalty ?? 60) + loyalty, 0, 100) })); };
  const outcome = choice === 'media' ? 'mediato dal Presidente del Consiglio' : `deciso a favore del ministro ${(choice === 'sostieni-a' ? a : b)?.portfolio}`;
  if (choice === 'media') { bump(a, 3); bump(b, 3); }
  else { const winner = choice === 'sostieni-a' ? a : b, loser = choice === 'sostieni-a' ? b : a; bump(winner, 5, 4); bump(loser, -6, -6); if (loser?.groupId) next = changePartner(next, loser.groupId, -3); next = shiftStability(next, 1); }
  next = setLife(next, { ...lifeOf(next.government), conflicts: lifeOf(next.government).conflicts.map(item => item === conflict || item.id === id ? { ...item, resolvedAt: date, outcome } : item) });
  const line = `Scontro su ${conflict.issue.toLowerCase()}: ${outcome}.`;
  return { parliament: log(next, date, 'conflitto-risolto', line), lines: [line] };
}

// The collegial decision of the cabinet meeting. The allies who like the area are pleased by an approval, the ones who dislike it are not; a divided cabinet (low bonds) pays for a decision it
// did not share; a postponement costs a little with everyone; a rejection costs the ministers of the area.
export function decideMeeting(parliament, id, choice, date, { auto = false, lapsed = false } = {}) {
  const life = lifeOf(parliament.government);
  const meeting = life.meetings.find(item => item.id === id && !item.decidedAt);
  if (!meeting) throw new Error('Il Consiglio dei ministri ha già deciso.');
  if (!['approvare', 'rinviare', 'respingere'].includes(choice)) throw new Error('Scegli se approvare, rinviare o respingere.');
  let next = parliament;
  const ministers = activeMinisters(next.government);
  const bond = ministers.length ? ministers.reduce((sum, item) => sum + (traitsOf(item).bond ?? 60), 0) / ministers.length : 60;
  const lines = [];
  const bump = delta => { for (const item of ministers) next = patchMinister(next, item.id, mi => traitsPatch(mi, { bond: clamp((traitsOf(mi).bond ?? 60) + delta, 0, 100) })); };
  if (choice === 'approvare') {
    next = shiftStability(next, bond >= 55 ? 2 : -1);
    for (const groupId of Object.keys(next.government.partners ?? {})) {
      const profile = groupProfile(getGroup(next, groupId) ?? groupId);
      const delta = (profile.likes.includes(meeting.area) ? 4 : 0) - (profile.dislikes.includes(meeting.area) ? 5 : 0);
      if (delta) next = changePartner(next, groupId, delta);
    }
    const owner = ministerOfArea(next.government, meeting.area);
    if (owner) next = patchMinister(next, owner.id, item => ({ ...traitsPatch(item, { bond: clamp((traitsOf(item).bond ?? 60) + 3, 0, 100) }), pressure: Math.max(0, (item.pressure ?? 0) - 1) }));
    if (bond < 55) bump(-2);
    lines.push(`Il Consiglio dei ministri approva su ${meeting.topic.toLowerCase()}${bond < 55 ? ' ma il governo è diviso' : ''}.`);
  } else if (choice === 'rinviare') {
    next = shiftStability(next, lapsed ? -2 : -0.5);
    if (lapsed) bump(-2);
    lines.push(`Il Consiglio dei ministri rinvia la decisione su ${meeting.topic.toLowerCase()}${lapsed ? ': nessuno ha deciso' : ''}.`);
  } else {
    const owner = ministerOfArea(next.government, meeting.area);
    if (owner) next = patchMinister(next, owner.id, item => ({ ...traitsPatch(item, { bond: clamp((traitsOf(item).bond ?? 60) - 5, 0, 100) }), loyalty: clamp((item.loyalty ?? 60) - 4, 0, 100), pressure: (item.pressure ?? 0) + 1 }));
    lines.push(`Il Consiglio dei ministri respinge la proposta su ${meeting.topic.toLowerCase()}.`);
  }
  next = setLife(next, { ...lifeOf(next.government), meetings: lifeOf(next.government).meetings.map(item => item.id === id ? { ...item, decidedAt: date, choice } : item) });
  return { parliament: log(next, date, 'consiglio-ministri', lines[0], { auto, area: meeting.area, choice }), lines };
}

// What the page shows: each minister with grade, bond, ambition, and the things waiting for the Prime Minister.
export function cabinetView(parliament, { week = 0 } = {}) {
  const government = parliament?.government;
  if (!government || !['active', 'crisis'].includes(government.status)) return null;
  const life = lifeOf(government);
  const ministers = activeMinisters(government).map(item => { const traits = traitsOf(item, government); return { id: item.id, portfolio: item.portfolio, groupName: item.groupName ?? null, playerAppointed: Boolean(item.playerAppointed), competence: item.competence ?? null, loyalty: item.loyalty ?? null, pressure: item.pressure ?? 0, ambition: traits.ambition, bond: traits.bond, grade: lastGrade(item), score: item.traits?.evaluations?.at(-1)?.score ?? null, evaluations: item.traits?.evaluations ?? [] }; });
  const byId = Object.fromEntries(ministers.map(item => [item.id, item]));
  return {
    ministers, requests: life.requests.map(item => ({ ...item, minister: byId[item.ministerId] ?? null })).filter(item => item.minister),
    conflicts: life.conflicts.filter(item => !item.resolvedAt).map(item => ({ ...item, ministerA: byId[item.a] ?? null, ministerB: byId[item.b] ?? null })),
    meeting: life.meetings.find(item => !item.decidedAt) ?? null, recent: life.meetings.filter(item => item.decidedAt).slice(-3).reverse(), history: life.conflicts.filter(item => item.resolvedAt).slice(-3).reverse(), stability: government.stability ?? null, week
  };
}
