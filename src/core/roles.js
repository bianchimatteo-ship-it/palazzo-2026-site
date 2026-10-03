// Roles and powers: what the player may do depends on the offices actually held.
// Every power listed here is checked again by the store before the action runs.
import { activeMinisters } from './parliament-engine.js?v=20261003-1';
import { isSecretary } from './career-engine.js?v=20261003-1';
import { EP_ROLES, committeeById } from './local-engine.js?v=20261003-1';
import { PRESIDENCY_RULES } from '../data/simulation/presidency-rules.js?v=20261003-1';
import { presidentialEligibility, whiteSemester } from './presidency-engine.js?v=20261003-1';
import { END_KINDS } from './legacy-engine.js?v=20261003-1';

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
  // The President of the Republic is an office above the parties: no party, no seat, the powers of the Quirinale.
  const president = Boolean(game?.flags?.president) && state.presidency?.incumbent?.kind === 'giocatore';
  const exPresident = Boolean(game?.flags?.exPresident);
  const electionRole = state.presidency?.election?.player?.role ?? null;
  const elector = ['leader', 'elettore', 'delegato'].includes(electionRole) && state.presidency?.election?.phase !== 'conclusa';
  const birthDate = state.dataset?.politicians?.find(item => item.id === state.career?.playerId)?.birthDate ?? null;
  const eligibility = presidentialEligibility({ birthDate, date: state.clock?.currentDate ?? null });
  const semester = president ? whiteSemester(state.presidency.incumbent, state.clock.currentDate, state.national?.legislature?.naturalEnd ?? null) : null;
  const roles = [];
  if (president) roles.push(['presidente', 'Presidente della Repubblica']);
  else if (exPresident) roles.push(['ex-presidente', 'Ex Presidente della Repubblica · senatore a vita di diritto']);
  if (party?.affiliation === 'founder') roles.push(['fondatore', 'Fondatore e segretario']);
  else if (secretary) roles.push(['segretario', 'Segretario nazionale']);
  else if (party?.affiliation === 'member') roles.push([party.rank >= 3 ? 'direzione' : party.rank >= 1 ? 'dirigente' : 'iscritto', party.rankTitle]);
  // The councils where the player sits (local-engine): Comune, Regione, Parlamento europeo.
  const institutions = (state.local?.institutions ?? []).filter(item => item.status === 'active');
  const leads = institutions.some(item => item.executive?.leader === 'player');
  for (const inst of institutions) roles.push(inst.executive?.leader === 'player' ? ['esecutivo-locale', inst.kind === 'regione' ? `Presidente della ${inst.name}` : `Sindaco${String(inst.name).replace(/^Comune/, '')}`] : ['consigliere', { comune: 'Consigliere comunale', regione: 'Consigliere regionale', europa: 'Deputato al Parlamento europeo' }[inst.kind] ?? 'Consigliere']);
  // An office in a committee of the European Parliament (coordinator, vice-chair, chair).
  const committee = institutions.find(inst => inst.ep?.role);
  if (committee) roles.push(['commissione-ue', EP_ROLES.find(role => role.id === committee.ep.role).title(committeeById(committee.ep.member)?.code ?? '')]);
  if (areaLead) roles.push(['corrente', 'Riferimento della tua area interna']);
  if (seat) roles.push(['parlamentare', parliament.player.chamber === 'senato' ? 'Senatore' : 'Deputato']);
  if (parliament?.careerStanding?.committeeRole) roles.push(['commissione', parliament.careerStanding.committeeRole.title]);
  if (minister) roles.push(['ministro', 'Ministro']);
  if (game?.flags?.scenarioOffice) roles.push(['sottosegretario', game.flags.scenarioOffice.title]);
  if (isPrimeMinister(parliament)) roles.push(['premier', 'Presidente del Consiglio']);
  if (!party && !president && !exPresident) roles.push(['indipendente', 'Indipendente']);
  // A career the player concluded: no office, no power, only the legacy.
  if (game?.status === 'ended' && game.endKind) roles.unshift(['concluso', `${END_KINDS[game.endKind]?.label ?? 'Carriera conclusa'}${game.legacy ? ` · eredità ${game.legacy.score}/100` : ''}`]);
  const powers = [
    ['Attività sul territorio, media e relazioni', true, null],
    ['Riunioni, tesseramento, contributi al partito', Boolean(party), 'Serve un partito'],
    ['Sezioni e formazione dei militanti', secretary || (party?.rank ?? 0) >= 1, 'Serve un incarico nel partito'],
    ['Campagna di comunicazione e mediazione tra le aree', secretary || (party?.rank ?? 0) >= 2, 'Serve un ruolo regionale'],
    ['Priorità di bilancio del partito e disciplina', secretary || (party?.rank ?? 0) >= 3, 'Serve la direzione nazionale'],
    ['Influenza sulle candidature della tua area', areaLead || secretary, 'Serve guidare la tua area interna'],
    ['Linea politica, organi, candidature, alleanze, investimenti del partito', secretary, 'Solo il segretario'],
    ['Programma e stile di comunicazione del partito', secretary, 'Solo il segretario'],
    ['Proposte, voti, interrogazioni e trattative in consiglio o al Parlamento europeo', institutions.length > 0, 'Serve un seggio in un consiglio comunale o regionale, o al Parlamento europeo'],
    ['Giunta, assessori, bilancio e tributi locali', leads, 'Solo il sindaco o il presidente della Regione'],
    ['Relazioni, emendamenti e voti nelle commissioni del Parlamento europeo', institutions.some(inst => inst.kind === 'europa'), 'Serve un seggio al Parlamento europeo'],
    ['Leggi con contenuto, emendamenti, trattative con i gruppi', seat, 'Serve un seggio in Parlamento'],
    ['Formare un governo (quando non ce n’è uno in carica)', seat && secretary && !governing(parliament), governing(parliament) ? 'C’è già un governo in carica: prima deve cadere' : 'Serve essere segretario con un seggio'],
    ['Sostenere il governo in carica, ritirare il sostegno, aprire una crisi', seat && secretary && governing(parliament) && !isPrimeMinister(parliament), isPrimeMinister(parliament) ? 'Guidi tu il governo' : 'Serve essere segretario con un seggio e un governo in carica'],
    ['Chiedere un ministero al Presidente del Consiglio', seat && governing(parliament) && !isPrimeMinister(parliament) && [...(parliament.government.coalitionGroupIds ?? []), ...(parliament.government.supportingGroupIds ?? [])].includes(parliament.player?.groupId), 'Serve un seggio in un gruppo della maggioranza'],
    ['Dossier e crisi di un ministero', minister || Boolean(game?.flags?.scenarioOffice), 'Serve un incarico di governo'],
    ['Indirizzo politico e priorità nazionali del governo', isPrimeMinister(parliament), 'Solo il Presidente del Consiglio'],
    ['Disegni di legge del governo e legge di bilancio (li approva il Parlamento)', isPrimeMinister(parliament), 'Solo il Presidente del Consiglio'],
    ['Decreti-legge, solo con un’emergenza aperta (da convertire in 60 giorni)', isPrimeMinister(parliament), 'Solo il Presidente del Consiglio'],
    ['Ministri, rimpasti, vertici di maggioranza, questione di fiducia', isPrimeMinister(parliament), 'Solo il Presidente del Consiglio'],
    // The Quirinale: a different office from the Prime Minister's (it names, promulgates, dissolves; it does not govern).
    [`Consultazioni, incarico di governo e scioglimento delle Camere${semester?.active ? ' (oggi non: semestre bianco)' : ''}`, president, 'Solo il Presidente della Repubblica'],
    ['Promulgare o rinviare alle Camere le leggi approvate', president, 'Solo il Presidente della Repubblica'],
    ['Messaggi alle Camere, moral suasion, visite e cerimonie di Stato', president, 'Solo il Presidente della Repubblica'],
    ['Nominare senatori a vita (fino a cinque) e presiedere CSM e Consiglio supremo di difesa', president, 'Solo il Presidente della Repubblica'],
    ['Votare per il Presidente della Repubblica in seduta comune (scrutinio segreto)', elector, 'Serve essere grande elettore (deputato, senatore o delegato regionale) quando si apre l’elezione'],
    [`Candidarsi al Quirinale (${PRESIDENCY_RULES.minAge} anni compiuti e il consenso dei grandi elettori)`, eligibility.eligible && !president, president ? 'Sei già il Presidente della Repubblica' : eligibility.problems[0] ?? 'Non eleggibile']
  ].map(([label, enabled, reason]) => ({ label, enabled: Boolean(enabled), reason: enabled ? null : reason }));
  return { roles, powers, secretary, seat, minister, primeMinister: isPrimeMinister(parliament), president, exPresident };
}
