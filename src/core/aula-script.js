// The script of a vote in the Aula: a vote the engines ALREADY decided (parliament-engine / local-engine: the totals of each group, the line, the dissenters) replayed seat by seat. Nothing is recomputed
// and nothing is written to the game: the order in which the seats light up comes from a hash of the vote's own id, the colours are the choices the engine assigned, the counters at every moment are the
// sums of the seats shown so far, and at the end they are exactly the totals of the vote. Adapters bring a vote of the Camera, the Senate, a city council, a regional council or the European Parliament
// to the same shape (`aulaFromTallies` for the assemblies that keep only the totals of each group). A secret ballot shows who voted, never how. Skipped or with the motion off: the final picture.
import { AULA } from '../data/studio-lines.js?v=20261107-1';
import { seededRandom } from './vote-engine.js?v=20261107-1';

export const ASSEMBLIES = Object.freeze({
  camera: { noun: 'La Camera', president: 'Il Presidente della Camera', label: 'Camera dei deputati' },
  senato: { noun: 'Il Senato', president: 'Il Presidente del Senato', label: 'Senato della Repubblica' },
  comune: { noun: 'Il Consiglio comunale', president: 'Il Presidente del Consiglio comunale', label: 'Consiglio comunale' },
  regione: { noun: 'Il Consiglio regionale', president: 'Il Presidente del Consiglio regionale', label: 'Consiglio regionale' },
  europeo: { noun: 'Il Parlamento europeo', president: 'Il Presidente del Parlamento', label: 'Parlamento europeo' }
});
const fill = (template, args = []) => { let i = 0; return template.replace(/\{\}|#/g, match => String(args[i++] ?? (match === '#' ? 0 : ''))); };
const pickOf = (bank, seed) => bank[Math.floor(seededRandom(seed)() * bank.length) % bank.length][0];

// The choices of the seats as the vote assigned them: 'favorevole' | 'contrario' | 'astenuto' | 'assente' | 'segreto' (secret: voted, how unknown).
export function tally(choices, upTo = choices.length, order = null) {
  const out = { yes: 0, against: 0, abstain: 0, absent: 0, voted: 0 };
  for (let k = 0; k < upTo; k++) {
    const choice = choices[order ? order[k] : k];
    if (choice === 'favorevole') out.yes++; else if (choice === 'contrario') out.against++; else if (choice === 'astenuto') out.abstain++; else if (choice === 'assente') out.absent++;
    if (choice !== 'assente') out.voted++;
  }
  return out;
}

// The script: `seats` [{ index, groupId, player }], `choices` per seat. Returns the order in which the seats vote and the announcements with the moment (number of seats shown) at which they come.
export function aulaScript({ assembly = 'camera', id = '', label = '', kind = 'legge', secret = false, confidence = false, passed = false, seats = [], choices = [], totals = null }) {
  const spec = ASSEMBLIES[assembly] ?? ASSEMBLIES.camera;
  const random = seededRandom(`aula|${id}|${assembly}`);
  // the order: absent seats are not shown voting (they stay as they are), the others in a deterministic sequence
  const present = seats.map(seat => seat.index).filter(index => choices[index] !== 'assente');
  const order = [...present].map(index => ({ index, key: random() })).sort((a, b) => a.key - b.key).map(item => item.index);
  const full = tally(choices, order.length, order);
  const final = totals ?? { yes: full.yes, against: full.against, abstain: full.abstain };
  const total = seats.length, president = spec.president, noun = spec.noun;
  const steps = [];
  steps.push({ at: 0, text: fill(pickOf(confidence ? AULA.confidence : AULA.open, `${id}|a`), [president, label || 'votazione']) });
  if (secret) steps.push({ at: 0, text: fill(pickOf(AULA.secret, `${id}|s`), [president]) });
  steps.push({ at: 0, text: fill(pickOf(AULA.opened, `${id}|o`), [president]) });
  steps.push({ at: Math.floor(order.length / 2), text: fill(pickOf(AULA.progress, `${id}|p`), [Math.floor(order.length / 2), total]) });
  steps.push({ at: order.length, text: fill(pickOf(AULA.closed, `${id}|c`), [president]) });
  const bank = confidence ? (passed ? AULA.confidencePassed : AULA.confidenceRejected) : (passed ? AULA.passed : AULA.rejected);
  steps.push({ at: order.length, text: fill(pickOf(bank, `${id}|r`), [president, noun, final.yes, final.against, final.abstain]), result: true });
  if (secret) steps.push({ at: order.length, text: pickOf(AULA.secretResult, `${id}|sr`) });
  const player = seats.find(seat => seat.player);
  if (player) steps.push({ at: order.length, text: choices[player.index] === 'assente' ? pickOf(AULA.youAbsent, `${id}|ya`) : secret ? '' : fill(pickOf(AULA.you, `${id}|y`), [{ favorevole: 'Favorevole', contrario: 'Contrario', astenuto: 'Astenuto' }[choices[player.index]] ?? '']) });
  return { assembly, kind, secret, confidence, passed, order, steps: steps.filter(step => step.text), final, total, kindLabel: spec.label, president, noun, label };
}
// What is on the board when `shown` seats have voted: the sums of the seats shown (never invented), the seats not yet shown, who has voted.
export const boardAt = (script, choices, shown) => { const counts = tally(choices, Math.min(shown, script.order.length), script.order); return { ...counts, shown: Math.min(shown, script.order.length), left: script.order.length - Math.min(shown, script.order.length) }; };
// The announcements said up to `shown` seats.
export const saidAt = (script, shown) => script.steps.filter(step => step.at <= shown);

// ---------- the adapters ----------
// A vote of the Chambers of the game (vote-engine.js `voteSummary` + `individualVotes` + the roster of hemicycle.js): the choices are exactly those the engine gave each seat.
export function aulaFromParliamentVote({ summary, roster, individual, chamber }) {
  const seats = roster.seats.map((seat, index) => ({ index, groupId: seat.groupId, player: Boolean(seat.player) }));
  const choices = individual.choices.map(choice => choice === 'segreto' ? (summary.secret ? 'segreto' : 'assente') : choice);
  return { script: aulaScript({ assembly: chamber, id: summary.id ?? `${chamber}|${summary.date}`, label: summary.label ?? '', kind: summary.kind, secret: summary.secret, confidence: summary.confidence || summary.kind === 'fiducia', passed: summary.passed, seats, choices, totals: { yes: summary.yes, against: summary.against, abstain: summary.abstain } }), seats, choices };
}
// An assembly that keeps only the totals of each group (a city council, a regional council, the European Parliament): the seats are laid out by group and each takes a choice from the counts of its
// group, in a fixed order (the same vote always gives the same picture). `groups`: [{ id, label, color, seats, yes, against, abstain, absent, player }].
export function aulaFromTallies({ assembly = 'comune', id = '', label = '', secret = false, passed = false, groups = [], playerGroupId = null, playerChoice = null }) {
  const seats = [], choices = [];
  const wanted = { favorevole: 'favorevole', contrario: 'contrario', astenuto: 'astenuto', assente: 'assente' }[playerChoice] ?? null;
  for (const group of groups) {
    const list = [...Array(group.yes ?? 0).fill('favorevole'), ...Array(group.against ?? 0).fill('contrario'), ...Array(group.abstain ?? 0).fill('astenuto'), ...Array(group.absent ?? 0).fill('assente')];
    const target = group.seats ?? list.length;
    while (list.length < target) list.push('assente');
    // the seat of the player is one of its group whose choice is the one the player made (the counts of the group already include it): the sums stay exactly the totals of the vote
    const own = playerGroupId === group.id && wanted ? list.slice(0, target).indexOf(wanted) : -1;
    list.slice(0, target).forEach((choice, position) => { seats.push({ index: seats.length, groupId: group.id, player: position === own }); choices.push(secret && choice !== 'assente' ? 'segreto' : choice); });
  }
  const totals = { yes: groups.reduce((n, group) => n + (group.yes ?? 0), 0), against: groups.reduce((n, group) => n + (group.against ?? 0), 0), abstain: groups.reduce((n, group) => n + (group.abstain ?? 0), 0) };
  return { script: aulaScript({ assembly, id, label, secret, passed, seats, choices, totals }), seats, choices };
}
