// Roles and powers: what the player may do depends on the offices actually held.
// Every power listed here is checked again by the store before the action runs.
import { activeMinisters } from './parliament-engine.js?v=20260925-6';
import { isSecretary } from './career-engine.js?v=20260925-6';

const governing = parliament => ['active', 'crisis'].includes(parliament?.government?.status);
export const isPrimeMinister = parliament => governing(parliament) && parliament.government.primeMinister === 'player';

export function playerRoles(state) {
  const game = state.game;
  const party = game?.party;
  const parliament = state.parliament;
  const seat = Boolean(parliament?.player?.groupId);
  const minister = governing(parliament) && activeMinisters(parliament.government).some(item => item.playerAppointed);
  const secretary = isSecretary(party);
  const areaLead = party?.affiliation === 'member' && party.rank >= 2 && party.currents?.some(current => current.id === party.alignedCurrentId && (current.value ?? current.relation ?? 0) >= 75);
  const roles = [];
  if (party?.affiliation === 'founder') roles.push(['fondatore', 'Fondatore e segretario']);
  else if (secretary) roles.push(['segretario', 'Segretario nazionale']);
  else if (party?.affiliation === 'member') roles.push([party.rank >= 3 ? 'direzione' : party.rank >= 1 ? 'dirigente' : 'iscritto', party.rankTitle]);
  if (areaLead) roles.push(['corrente', 'Riferimento della tua area interna']);
  if (seat) roles.push(['parlamentare', parliament.player.chamber === 'senato' ? 'Senatore' : 'Deputato']);
  if (parliament?.careerStanding?.committeeRole) roles.push(['commissione', parliament.careerStanding.committeeRole.title]);
  if (minister) roles.push(['ministro', 'Ministro']);
  if (game?.flags?.scenarioOffice) roles.push(['sottosegretario', game.flags.scenarioOffice.title]);
  if (isPrimeMinister(parliament)) roles.push(['premier', 'Presidente del Consiglio']);
  if (!party) roles.push(['indipendente', 'Indipendente']);
  const powers = [
    ['Attività sul territorio, media e relazioni', true, null],
    ['Riunioni, tesseramento, contributi al partito', Boolean(party), 'Serve un partito'],
    ['Sezioni e formazione dei militanti', secretary || (party?.rank ?? 0) >= 1, 'Serve un incarico nel partito'],
    ['Campagna di comunicazione e mediazione tra le aree', secretary || (party?.rank ?? 0) >= 2, 'Serve un ruolo regionale'],
    ['Priorità di bilancio del partito e disciplina', secretary || (party?.rank ?? 0) >= 3, 'Serve la direzione nazionale'],
    ['Influenza sulle candidature della tua area', areaLead || secretary, 'Serve guidare la tua area interna'],
    ['Linea politica, organi, candidature, alleanze, investimenti del partito', secretary, 'Solo il segretario'],
    ['Programma e stile di comunicazione del partito', secretary, 'Solo il segretario'],
    ['Leggi con contenuto, emendamenti, trattative con i gruppi', seat, 'Serve un seggio in Parlamento'],
    ['Formare un governo (quando non ce n’è uno in carica)', seat && secretary && !governing(parliament), governing(parliament) ? 'C’è già un governo in carica: prima deve cadere' : 'Serve essere segretario con un seggio'],
    ['Sostenere il governo in carica, ritirare il sostegno, aprire una crisi', seat && secretary && governing(parliament) && !isPrimeMinister(parliament), isPrimeMinister(parliament) ? 'Guidi tu il governo' : 'Serve essere segretario con un seggio e un governo in carica'],
    ['Chiedere un ministero al Presidente del Consiglio', seat && governing(parliament) && !isPrimeMinister(parliament) && [...(parliament.government.coalitionGroupIds ?? []), ...(parliament.government.supportingGroupIds ?? [])].includes(parliament.player?.groupId), 'Serve un seggio in un gruppo della maggioranza'],
    ['Dossier e crisi di un ministero', minister || Boolean(game?.flags?.scenarioOffice), 'Serve un incarico di governo'],
    ['Indirizzo politico e priorità nazionali del governo', isPrimeMinister(parliament), 'Solo il Presidente del Consiglio'],
    ['Disegni di legge del governo e legge di bilancio (li approva il Parlamento)', isPrimeMinister(parliament), 'Solo il Presidente del Consiglio'],
    ['Decreti-legge, solo con un’emergenza aperta (da convertire in 60 giorni)', isPrimeMinister(parliament), 'Solo il Presidente del Consiglio'],
    ['Ministri, rimpasti, vertici di maggioranza, questione di fiducia', isPrimeMinister(parliament), 'Solo il Presidente del Consiglio']
  ].map(([label, enabled, reason]) => ({ label, enabled: Boolean(enabled), reason: enabled ? null : reason }));
  return { roles, powers, secretary, seat, minister, primeMinister: isPrimeMinister(parliament) };
}
