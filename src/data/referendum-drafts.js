// Guided drafting of the referendum requests: formulations of the question for an abrogative referendum (from the law chosen: its title, area, instrument and date, never an invented content) and drafts
// of constitutional revisions by topic. All of them are SUGGESTIONS the player can edit freely: nothing here is submitted, approved or admitted by itself, and no effect that the engine does not apply is promised.
import { POLICY_AREAS } from './simulation/policy-rules.js?v=20261125-7';

const AREA_LABEL = Object.fromEntries(POLICY_AREAS.map(area => [area.id, area.label]));
// The kinds of act and their grammar (article, participle ending): the question must read right for each, and every form is translated whole (see release-pairs).
export const INSTRUMENT_FORMS = Object.freeze({ legge: ['la', 'a'], 'legge di delega': ['la', 'a'], 'decreto-legge': ['il', 'o'], 'decreto legislativo': ['il', 'o'], 'legge di spesa': ['la', 'a'], 'legge di riforma': ['la', 'a'] });
const INSTRUMENT = { regole: 'legge', 'legge-delega': 'legge di delega', decreto: 'decreto-legge', 'decreto-legislativo': 'decreto legislativo', fondi: 'legge di spesa', riforma: 'legge di riforma' };
const instrumentOf = target => INSTRUMENT[target.instrument] ?? 'legge';

// What the request would do, told by the area of the law: the rule of the game is always the same (abrogating takes the law out of force and stops its continuing effects, the history stays).
export function abrogativeSuggestions(target, scope = 'totale', partText = '') {
  const title = target.title, area = AREA_LABEL[target.area] ?? null, date = target.approvedAt ? new Date(`${target.approvedAt}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
  const kind = instrumentOf(target), [art, end] = INSTRUMENT_FORMS[kind];
  const part = String(partText ?? '').trim();
  const list = [];
  if (scope === 'parziale') {
    list.push({ id: 'parti', label: 'Quesito sulle parti indicate', text: `Volete voi che sia abrogat${end} ${art} ${kind} «${title}»${date ? `, approvat${end} il ${date},` : ''} limitatamente a ${part || '[indica le parti: articoli o commi]'}?` });
    list.push({ id: 'finalita', label: 'Una sola finalità', text: `Volete voi che siano abrogate, nella ${kind} «${title}», le sole disposizioni su ${part || '[indica le parti]'}, lasciando in vigore il resto?` });
  } else {
    list.push({ id: 'standard', label: 'Quesito standard', text: `Volete voi che sia abrogat${end} ${art} ${kind} «${title}»${date ? `, approvat${end} il ${date}` : ''}?` });
    // the subject of the law, only when the simulation knows it (never a placeholder)
    if (area) {
      list.push({ id: 'materia', label: `Con la materia (${area})`, text: `Volete voi che sia abrogat${end} ${art} ${kind} «${title}», che regola la materia «${area}»?` });
      list.push({ id: 'effetti', label: 'Con l’effetto sulla materia', text: `Volete voi che cessi di avere effetto ${art} ${kind} «${title}» e che la materia «${area}» torni alla disciplina precedente?` });
    }
  }
  return list;
}

// Constitutional revisions: for each topic of the simulation, drafts that say what is proposed in general terms. The simulation records the reform and its path (two deliberations, possible referendum),
// it does not write or apply the constitutional text: the draft is a description kept with the proposal.
export const REVISION_DRAFTS = Object.freeze({
  'Riforma del bicameralismo': [
    { title: 'Differenziare le funzioni di Camera e Senato', text: 'Si propone di distinguere le funzioni delle due Camere: alla Camera il rapporto di fiducia con il Governo, al Senato la rappresentanza dei territori. Le leggi su materie condivise restano bicamerali.' },
    { title: 'Superamento del bicameralismo paritario', text: 'Si propone che la fiducia e le leggi ordinarie siano affidate a una sola Camera, mentre l’altra interviene su un elenco ristretto di materie.' }
  ],
  'Elezione diretta del Presidente del Consiglio': [
    { title: 'Elezione diretta del Presidente del Consiglio', text: 'Si propone che il Presidente del Consiglio sia eletto direttamente dai cittadini, con un meccanismo che ne garantisca la stabilità e la possibilità di essere sfiduciato in casi tassativi.' },
    { title: 'Premierato con garanzie per il Presidente della Repubblica', text: 'Si propone l’elezione diretta del Presidente del Consiglio, lasciando al Presidente della Repubblica le funzioni di garanzia e la nomina dei ministri su proposta.' }
  ],
  'Riordino delle competenze tra Stato e Regioni': [
    { title: 'Nuovo elenco di materie dello Stato e delle Regioni', text: 'Si propone di rivedere l’elenco delle materie di competenza esclusiva e concorrente, riportando allo Stato alcune materie a carattere nazionale.' },
    { title: 'Autonomia differenziata con livelli essenziali', text: 'Si propone che le Regioni possano ottenere più competenze solo dopo la definizione dei livelli essenziali delle prestazioni garantiti a tutti i cittadini.' }
  ],
  'Riforma dell’ordinamento giudiziario': [
    { title: 'Separazione delle carriere', text: 'Si propone di separare le carriere di chi giudica e di chi accusa, con organi di governo distinti e regole di accesso proprie.' },
    { title: 'Riforma del governo autonomo della magistratura', text: 'Si propone di cambiare composizione e funzioni dell’organo di governo autonomo della magistratura, con sorteggio o elezione di una parte dei membri.' }
  ],
  'Riduzione del numero dei parlamentari': [
    { title: 'Ulteriore riduzione dei seggi parlamentari', text: 'Si propone di ridurre ancora il numero dei deputati e dei senatori, con una nuova distribuzione dei seggi tra le circoscrizioni.' },
    { title: 'Parlamento più snello con garanzie di rappresentanza', text: 'Si propone di ridurre i seggi prevedendo una soglia minima di rappresentanza per le Regioni più piccole.' }
  ],
  'Nuove regole per la sfiducia al Governo': [
    { title: 'Sfiducia costruttiva', text: 'Si propone che la Camera possa sfiduciare il Governo solo indicando nello stesso voto il nome del successore, con maggioranza assoluta.' },
    { title: 'Maggioranza qualificata per la sfiducia', text: 'Si propone di richiedere la maggioranza assoluta dei componenti per approvare una mozione di sfiducia, per ridurre le crisi di governo.' }
  ]
});
// Free topics: a generic outline, when the player writes the title himself.
export const CUSTOM_DRAFT = Object.freeze({ text: 'Descrivi in poche righe che cosa cambia nella Costituzione, quale articolo riguarda e perché serve. La simulazione registra la proposta e ne segue l’iter; non ne applica il contenuto.' });
export const revisionDrafts = topic => REVISION_DRAFTS[topic] ?? [];

export const ALL_PAIRS = [];
