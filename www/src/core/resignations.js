// Resignations: the player can leave any single office he holds, one at a time, and sees what it costs BEFORE confirming. This module is pure: it lists the posts the player holds (party, councils,
// executive of a body, Parliament, groups, committees, Government, Quirinale), the consequences each one has (the lines of the confirmation and the effects the store applies) and why a post cannot be
// left right now. The store does the leaving (it knows the state); this module is the single place where the consequences are written, so the confirmation and the effect never disagree.
import { isSecretary } from './career-engine.js?v=20261118-36';
import { activeMinisters } from './parliament-engine.js?v=20261118-36';
import { institutionOffice, officeLabel } from './office-engine.js?v=20261118-36';

const governing = parliament => ['active', 'crisis'].includes(parliament?.government?.status);
const KIND_LABEL = { comune: 'Comune', provincia: 'Provincia', regione: 'Regione', europa: 'Parlamento europeo' };
// What every kind of post costs: stats (applied once), what is said before the confirmation, and what the player keeps.
export const RESIGN_EFFECTS = Object.freeze({
  'partito-segretario': { stats: { reputation: -2, influence: -3 }, party: { support: -4, cohesion: -6 }, lines: ['Lasci la guida del partito: i poteri del segretario (linea, liste, alleanze, programma) passano a chi viene eletto dopo di te.', 'Resti iscritto, senza incarichi nel partito: torni al grado di semplice iscritto.', 'Reputazione −2, influenza −3; il consenso interno al partito cala di 4 punti e la coesione di 6.', 'Non è una decisione che si cancella: per tornare in alto dovrai riconquistare i gradi.'] },
  'partito-ruolo': { stats: { influence: -1 }, party: { cohesion: -1 }, lines: ['Lasci il tuo incarico nel partito e resti iscritto.', 'Perdi i poteri e il reddito legato al grado; i gradi si riconquistano con l’attività di partito.', 'Influenza −1.'] },
  'locale-esecutivo': { stats: { reputation: -2, popularity: -2, influence: -2 }, lines: ['Lasci la guida dell’ente: non guidi più la giunta e perdi i poteri di governo (bilancio, giunta, atti).', 'Il tuo seggio nell’assemblea finisce con la carica.', 'Reputazione −2, popolarità −2, influenza −2: chi lascia a metà mandato deve spiegarlo agli elettori.'] },
  'locale-assessore': { stats: { reputation: -1, influence: -1 }, lines: ['Lasci la giunta e la delega: i suoi atti non sono più tuoi.', 'Il tuo seggio nell’assemblea finisce con la carica.', 'Reputazione −1, influenza −1.'] },
  'locale-consigliere': { stats: { reputation: -1 }, lines: ['Lasci il seggio: l’assemblea prosegue senza di te.', 'Non voti più, non presenti più mozioni né interrogazioni in quell’assemblea.', 'Reputazione −1.'] },
  'locale-capogruppo': { stats: { influence: -1 }, lines: ['Lasci la guida del gruppo: resti consigliere.', 'Perdi il peso di coordinare la linea del gruppo.', 'Influenza −1.'] },
  'europa-commissione': { stats: { influence: -1 }, lines: ['Lasci l’incarico nella commissione: resti eurodeputato.', 'Influenza −1.'] },
  parlamentare: { stats: { reputation: -2, influence: -2, popularity: -1 }, lines: ['Lasci il seggio: resta vacante finché non subentra il primo dei non eletti.', 'Non voti più in Aula né in commissione e perdi i poteri di parlamentare; lasci anche le cariche del gruppo.', 'Reputazione −2, influenza −2, popolarità −1.', 'Se sei ministro puoi restarlo (non è obbligatorio essere parlamentare), ma perdi il seggio.'] },
  capogruppo: { stats: { influence: -1 }, lines: ['Lasci la guida del gruppo parlamentare: resti parlamentare.', 'Perdi la voce nelle consultazioni e nei vertici di maggioranza.', 'Influenza −1.'] },
  commissione: { stats: { influence: -1 }, lines: ['Lasci l’incarico nella commissione: resti parlamentare.', 'Perdi il vantaggio che l’incarico dava ai tuoi emendamenti.', 'Influenza −1.'] },
  ministro: { stats: { reputation: -1, influence: -2 }, lines: ['Lasci il Governo: il ministero e i suoi dossier non sono più tuoi.', 'Perdi il budget e le attività del ministero.', 'Reputazione −1, influenza −2.'] },
  sottosegretario: { stats: { influence: -1 }, lines: ['Lasci l’incarico di governo.', 'Influenza −1.'] },
  premier: { stats: { reputation: -2, influence: -3, popularity: -2 }, lines: ['Il Governo si dimette: si apre la crisi di governo e il Quirinale avvia le consultazioni.', 'Come si chiude la crisi (nuovo incarico, nuovo governo o elezioni) lo decidono le consultazioni, non tu.', 'Reputazione −2, influenza −3, popolarità −2.'] },
  presidente: { stats: {}, lines: ['Lasci il Colle: il Presidente del Senato ti sostituisce e il Parlamento elegge il successore.', 'Diventi senatore a vita di diritto.'] }
});

// The posts the player holds now. Each: { id, kind, label, where, effects, lines, blocked } — `blocked` is a reason (or null) the post cannot be left now.
export function resignationPosts(state) {
  const game = state?.game;
  if (!game || game.status === 'ended') return [];
  const out = [];
  const party = game.party;
  const parliament = state.parliament;
  const quiet = state.night ? 'È in corso la Notte Elettorale: concludila prima di decidere.' : null;
  const push = (id, kind, label, where) => out.push({ id, kind, label, where, ...(RESIGN_EFFECTS[kind] ?? { stats: {}, lines: [] }), blocked: quiet });
  if (game.flags?.president && state.presidency?.incumbent?.kind === 'giocatore') push('presidente', 'presidente', 'Presidente della Repubblica', 'Quirinale');
  if (party && (isSecretary(party) || party.rank >= 1)) push('partito', isSecretary(party) ? 'partito-segretario' : 'partito-ruolo', party.rankTitle, party.label ?? 'Partito');
  for (const inst of (state.local?.institutions ?? []).filter(item => item.status === 'active')) {
    const office = institutionOffice(inst);
    const leads = inst.executive?.leader === 'player';
    const kind = inst.kind === 'europa' ? 'locale-consigliere' : leads ? 'locale-esecutivo' : office?.startsWith('assessore') ? 'locale-assessore' : 'locale-consigliere';
    push(`locale:${inst.id}`, kind, inst.kind === 'europa' ? 'Deputato al Parlamento europeo' : `${officeLabel(office)}${inst.playerDelega ? ` · delega ${inst.playerDelega.portfolio}` : ''}`, inst.name ?? KIND_LABEL[inst.kind]);
    if (inst.playerGroupLead && inst.kind !== 'europa') push(`capogruppo-locale:${inst.id}`, 'locale-capogruppo', 'Capogruppo', inst.name);
    if (inst.ep?.role) push(`commissione-ue:${inst.id}`, 'europa-commissione', 'Incarico in una commissione del Parlamento europeo', inst.name);
  }
  const seat = Boolean(parliament?.player?.groupId);
  if (seat) {
    const chamber = parliament.player.chamber === 'senato' ? 'Senato' : 'Camera';
    push('parlamento', 'parlamentare', parliament.player.chamber === 'senato' ? 'Senatore' : 'Deputato', chamber);
    if (game.flags?.groupLeader?.groupId === parliament.player.groupId) push('capogruppo', 'capogruppo', 'Capogruppo del gruppo parlamentare', chamber);
    if (parliament.careerStanding?.committeeRole) push('commissione', 'commissione', parliament.careerStanding.committeeRole.title, chamber);
  }
  const government = governing(parliament) ? parliament.government : null;
  if (government?.primeMinister === 'player') { push('premier', 'premier', 'Presidente del Consiglio', 'Governo'); if (government.status === 'crisis') out[out.length - 1].blocked = out[out.length - 1].blocked ?? 'Il Governo è già dimissionario: le consultazioni sono in corso.'; }
  else if (government && activeMinisters(government).some(item => item.playerAppointed)) push('ministro', 'ministro', 'Ministro', 'Governo');
  if (game.flags?.scenarioOffice) push('sottosegretario', 'sottosegretario', game.flags.scenarioOffice.title ?? 'Incarico di governo', 'Governo');
  return out;
}
export const resignationPost = (state, id) => resignationPosts(state).find(item => item.id === id) ?? null;
// A career with no office at all: only a card in a party (or none), no seat, no executive, no Government: the «plain member» state.
export const holdsNoOffice = state => Boolean(state?.game) && resignationPosts(state).length === 0;
