// How the player stands: besides the capital (what can be spent), the notoriety (how many know the name) and the influence
// (how much the name weighs), the game keeps four kinds of reputation, which are not the same thing — what the party thinks of
// you is not what the voters or the newsrooms or the institutions think — and the influence the player has in each sector of
// public policy (health, schools, economy…). Everything here is a mechanic of the game (source: simulation).
import { AREA_BY_ID, AREA_GROUPS } from './policy-rules.js?v=20261009-4';

export const REPUTATIONS = Object.freeze({
  internal: {
    label: 'Reputazione interna', short: 'Interna', icon: 'flag',
    detail: 'Come ti vedono nel partito: iscritti, dirigenti, correnti, leadership. Pesa nelle candidature, negli organi e nei congressi. Chi non ha un partito non ce l’ha.',
    drivers: 'Sostegno nel partito, rapporto con la leadership, incarichi interni, lealtà e strappi.'
  },
  territorial: {
    label: 'Reputazione sul territorio', short: 'Territorio', icon: 'pin',
    detail: 'Come ti vedono gli elettori e le comunità che rappresenti. Pesa nelle elezioni locali, nei collegi e nel radicamento del partito.',
    drivers: 'Popolarità, radicamento, servizi del territorio, risposte a emergenze e problemi locali.'
  },
  media: {
    label: 'Reputazione mediatica', short: 'Media', icon: 'mic',
    detail: 'La tua immagine su stampa, tv e social: quanto sei noto e con quale tono. Pesa in campagna, nei sondaggi e quando si fa un governo.',
    drivers: 'Notorietà, polemiche, scandali, interviste e il ricordo di quello che hai detto o fatto.'
  },
  institutional: {
    label: 'Reputazione istituzionale', short: 'Istituzioni', icon: 'ministry',
    detail: 'L’affidabilità che ti riconoscono colleghi, uffici, maggioranze e governo. Pesa negli incarichi di commissione, nelle trattative e nei ministeri.',
    drivers: 'Carica che ricopri, incarichi di commissione, sostegno nel gruppo, stabilità dell’esecutivo che guidi e atti approvati.'
  }
});
export const REPUTATION_IDS = Object.freeze(Object.keys(REPUTATIONS));

// The reputation an event moves most, from its category (the game keeps the single reputation too: the others follow it).
export const CATEGORY_REPUTATION = Object.freeze({
  partito: 'internal', relazioni: 'internal', carriera: 'internal',
  territorio: 'territorial', sociale: 'territorial', economia: 'territorial', sicurezza: 'territorial', emergenza: 'territorial', elezioni: 'territorial',
  media: 'media', scandalo: 'media', memoria: 'media', crisi: 'media', opportunita: 'media',
  parlamento: 'institutional', governo: 'institutional', europa: 'institutional'
});

// The sectors of influence are the groups of the policy areas (the same eight as the national indicators).
export const SECTORS = Object.freeze(Object.entries(AREA_GROUPS).map(([id, label]) => ({ id, label })));
export const SECTOR_IDS = Object.freeze(SECTORS.map(item => item.id));
export const sectorOfArea = area => AREA_BY_ID[area]?.group ?? (SECTOR_IDS.includes(area) ? area : null);
// The areas of a sector (for the interface).
export const areasOfSector = sector => Object.values(AREA_BY_ID).filter(item => item.group === sector).map(item => item.id);

export const STANDING_RULES = Object.freeze({
  offsetMax: 28,            // how far a reputation can move away from the general one through the player's own actions
  eventShare: 0.6,          // of a reputation change coming from an event, the part that goes (besides the general one) to its own kind
  sectorMax: 100,
  sectorDecay: 0.08,        // points lost per week by the influence earned (it must be kept alive)
  floors: {                 // what an office gives for as long as it is held, in a sector (the delega, the ministry, the committee)
    delega: 22, assessore: 26, ministro: 38, sottosegretario: 26, commissione: 20, 'commissione-ue': 22, presidente: 20, premier: 30
  },
  officeBase: 40            // the weight (tier) above which an office raises the institutional reputation
});

// The events about a theme of public policy: whoever takes them on (a choice that costs days, capital or money) earns influence in the sector.
export const EVENT_SECTORS = Object.freeze({
  'liste-attesa': 'sanita', 'pronto-soccorso': 'sanita', 'emergenza-sanitaria': 'sanita', 'liste-attesa-assessorato': 'sanita', 'nomine-asl': 'sanita',
  pendolari: 'trasporti', 'sciopero-trasporti': 'trasporti', 'strada-chiusa': 'infrastrutture', 'strade-dissestate': 'infrastrutture', 'frana-provinciale': 'infrastrutture',
  'sindaci-fondi-strade': 'infrastrutture', 'aree-interne': 'infrastrutture', terremoto: 'infrastrutture', 'patto-territoriale': 'infrastrutture',
  'scuola-superiore-lavori': 'scuola', 'riapertura-scuole': 'scuola', 'affitti-studenti': 'casa',
  'sindacati-vertenza': 'lavoro', 'chiusura-stabilimento': 'lavoro', 'esuberi-fabbrica': 'lavoro', 'tavolo-esito': 'lavoro', 'assemblea-sindacale': 'lavoro', 'sciopero-generale': 'lavoro',
  'rincari-carburanti': 'energia', 'crisi-energetica': 'energia', 'bollette-rabbia': 'energia', 'boom-turismo': 'turismo', 'grande-evento': 'turismo',
  'trattori-in-piazza': 'agricoltura', siccita: 'ambiente', maltempo: 'ambiente', alluvione: 'ambiente', 'allerta-meteo': 'ambiente', 'comitato-parco': 'ambiente', 'accordo-imprese-verdi': 'ambiente',
  'cronaca-nera': 'sicurezza', 'operazione-antimafia': 'sicurezza', 'premio-legalita': 'sicurezza', 'ondata-sbarchi': 'immigrazione', 'attacco-informatico': 'digitale', 'startup-premio': 'digitale',
  'tensione-spread': 'finanze', 'richiamo-europeo': 'finanze', 'lettera-europa': 'finanze', 'bilancio-comunale': 'finanze', 'bilancio-partecipato': 'finanze', contromanovra: 'finanze',
  'banca-territorio': 'economia', 'fondi-europei': 'economia', 'costo-vita': 'famiglia', 'emendamento-sociale': 'welfare', 'ambulanti-protesta': 'commercio'
});
// What an approved act, a law, a report brings in its sector.
export const SECTOR_GAINS = Object.freeze({
  engage: 0.7, localAct: 1.1, delegaAct: 1.6, localActRejected: 0.2, lawApproved: 2.2, lawProposed: 0.6, amendment: 0.5, report: 1.8, ministryWeek: 0.15, delegaWeek: 0.06
});
