// The choices of the television debate, per TOPIC (core/scene-engine.js): loaded with the scene page (ui/scene-view.js), never at start — it registers itself in the scene engine, which uses the generic wording
// where a topic is not here.
import { setDebateChoices } from '../core/scene-engine.js?v=20261112-8';
// The choices of the television debate, per TOPIC (core/scene-engine.js): what the player can say depends on what is being talked about — a health debate offers waiting lists, hospitals and funding, an economy
// debate offers taxes, firms, jobs and debt — instead of the same four approaches every time. The IDs are those of the engine (the style of the answer: dati / empatia / programma / attacco; the question to the
// rival: conti / coerenza / passato / salta; the reply to an attack: fatti / calma / contrattacco / ignora; the closing: sobrio / appello / sfida), so the effects, the evaluation and the explanation of
// the result do not change: the words do. Each entry is [label, detail] as [Italian, English] pairs. Topics: lavoro, servizi, ambiente, istituzioni, sanita, sicurezza, costo-vita, giovani.
const P = (it, en) => [it, en];
const C = (label, detail) => [label, detail];
export const DEBATE_CHOICES = Object.freeze({
  lavoro: {
    styles: {
      dati: C(P('Con i numeri su occupazione e salari', 'With the figures on jobs and wages'), P('Tassi di occupazione, contratti, salari reali: conta la competenza.', 'Employment rates, contracts, real wages: competence counts.')),
      empatia: C(P('Racconta chi ha perso il posto', 'Tell the story of someone who lost a job'), P('Il volto di un operaio, di una precaria: conta il carisma.', 'The face of a worker, of a precarious employee: charisma counts.')),
      programma: C(P('Cita il tuo piano per il lavoro', 'Cite your jobs plan'), P('Le tue promesse su lavoro e imprese: vale quanto sei credibile.', 'Your promises on jobs and firms: it counts as much as you are credible.')),
      attacco: C(P('Attacca i contratti precari dell’avversario', 'Attack the rival’s precarious contracts'), P('Colpisci la sua politica del lavoro: premia se è impreparato.', 'Hit his labour policy: it pays if he is unprepared.'))
    },
    asks: {
      conti: C(P('Chiedi come paga gli sgravi alle imprese', 'Ask how he pays for tax breaks to firms'), P('Mette alla prova i conti del suo piano per il lavoro.', 'Tests the accounts of his jobs plan.')),
      coerenza: C(P('Chiedi perché ha votato contro il salario minimo', 'Ask why he voted against the minimum wage'), P('Colpisce se ha cambiato idea sul lavoro.', 'Hits if he has changed his mind on jobs.')),
      passato: C(P('Ricordagli i licenziamenti nella sua amministrazione', 'Remind him of the layoffs under his administration'), P('Rischioso: se ricordi male, si ritorce.', 'Risky: if you remember wrongly, it backfires.')),
      salta: C(P('Lascia la parola al conduttore', 'Leave the floor to the host'), P('Non fai domande sul lavoro.', 'You ask nothing on jobs.'))
    },
    replies: {
      fatti: C(P('Rispondi con i dati dell’occupazione', 'Answer with the employment data'), P('Smonti l’accusa con i numeri: serve preparazione.', 'You dismantle the charge with numbers: it takes preparation.')),
      calma: C(P('Resta calmo e spiega le tue scelte sul lavoro', 'Stay calm and explain your jobs choices'), P('Sobrio, ma sembri sulla difensiva.', 'Sober, but you seem defensive.')),
      contrattacco: C(P('Contrattacca sui cantieri fermi e le fabbriche chiuse', 'Counter-attack on stalled sites and closed factories'), P('Colpo su colpo: il pubblico si accende, con rischi.', 'Blow for blow: the audience warms up, with risks.')),
      ignora: C(P('Ignora e torna ai salari', 'Ignore it and go back to wages'), P('Cambi argomento: lascia il segno all’avversario.', 'You change the subject: it leaves the mark on the opponent.'))
    },
    closings: {
      sobrio: C(P('Riassumi: lavoro stabile e imprese che assumono', 'Sum up: stable jobs and firms that hire'), P('Ringrazi e riassumi con misura.', 'You thank and sum up with restraint.')),
      appello: C(P('Appello ai giovani senza contratto', 'Appeal to the young without a contract'), P('Parli al Paese: carisma e visione.', 'You speak to the country: charisma and vision.')),
      sfida: C(P('Sfida: «Dimmi quanti posti crei, con quali soldi»', 'Challenge: “Tell me how many jobs you create, with what money”'), P('Forte, ma divisivo.', 'Strong, but divisive.'))
    }
  },
  servizi: {
    styles: {
      dati: C(P('Con i dati sui servizi del territorio', 'With the data on local services'), P('Sportelli, trasporti, assistenza: conta la competenza.', 'Counters, transport, care: competence counts.')),
      empatia: C(P('Racconta il paese dove chiude l’ufficio postale', 'Tell of the village where the post office closes'), P('Le persone che restano senza servizi: conta il carisma.', 'The people left without services: charisma counts.')),
      programma: C(P('Cita le tue promesse sui servizi di prossimità', 'Cite your promises on local services'), P('Vale quanto sei credibile e coerente.', 'It counts as much as you are credible and consistent.')),
      attacco: C(P('Attacca i tagli ai servizi dell’avversario', 'Attack the rival’s cuts to services'), P('Premia se è debole, punisce se non sei preparato.', 'It pays if he is weak, punishes if you are unprepared.'))
    },
    asks: {
      conti: C(P('Chiedi con quali fondi riapre gli sportelli', 'Ask with what funds he reopens the counters'), P('Mette alla prova il suo programma.', 'It tests his programme.')),
      coerenza: C(P('Chiedi perché ha chiuso i presìdi che ora promette', 'Ask why he closed the outposts he now promises'), P('Colpisce se ha cambiato idea.', 'It hits if he has changed his mind.')),
      passato: C(P('Ricordagli le liste d’attesa del suo mandato', 'Remind him of the waiting lists of his term'), P('Rischioso: se ricordi male, si ritorce.', 'Risky: if you remember wrongly, it backfires.')),
      salta: C(P('Lascia che sia il conduttore a chiedere sugli sportelli', 'Let the host ask about the counters'), P('Lasci il tempo al conduttore.', 'You leave the time to the host.'))
    },
    replies: {
      fatti: C(P('Rispondi con i numeri dei servizi attivati', 'Answer with the numbers of services started'), P('Serve preparazione.', 'Preparation is needed.')),
      calma: C(P('Resta calmo: spiega cosa è stato fatto davvero', 'Stay calm: explain what was really done'), P('Sobrio, ma sembri sulla difensiva.', 'Sober, but you seem defensive.')),
      contrattacco: C(P('Contrattacca sui tagli fatti da lui', 'Counter-attack on the cuts he made'), P('Il pubblico si accende, con rischi.', 'The audience warms up, with risks.')),
      ignora: C(P('Ignora e parla di comunità', 'Ignore it and talk about community'), P('Cambi argomento.', 'You change the subject.'))
    },
    closings: {
      sobrio: C(P('Riassumi: servizi vicini a chi ne ha bisogno', 'Sum up: services close to those who need them'), P('Misura e chiarezza.', 'Measure and clarity.')),
      appello: C(P('Appello alle comunità che si sentono lasciate sole', 'Appeal to communities that feel left alone'), P('Carisma e visione.', 'Charisma and vision.')),
      sfida: C(P('Sfida: «Venga con me a vedere quel presidio chiuso»', 'Challenge: “Come with me to see that closed outpost”'), P('Forte, ma divisivo.', 'Strong, but divisive.'))
    }
  },
  ambiente: {
    styles: {
      dati: C(P('Con i dati su emissioni, rischio idrogeologico e acqua', 'With the data on emissions, flood risk and water'), P('Misure e scadenze: conta la competenza.', 'Measures and deadlines: competence counts.')),
      empatia: C(P('Racconta la valle dopo l’alluvione', 'Tell of the valley after the flood'), P('Famiglie, campi, fango: conta il carisma.', 'Families, fields, mud: charisma counts.')),
      programma: C(P('Cita il tuo piano per il territorio', 'Cite your plan for the territory'), P('Le tue promesse su ambiente e opere: vale quanto sei credibile.', 'Your promises on environment and works: it counts as much as you are credible.')),
      attacco: C(P('Attacca i cantieri sbagliati dell’avversario', 'Attack the rival’s wrong sites'), P('Premia se è impreparato.', 'It pays if he is unprepared.'))
    },
    asks: {
      conti: C(P('Chiedi chi paga la transizione energetica', 'Ask who pays for the energy transition'), P('Mette alla prova il suo programma.', 'It tests his programme.')),
      coerenza: C(P('Chiedi perché ha approvato quell’inceneritore', 'Ask why he approved that incinerator'), P('Colpisce se ha cambiato idea.', 'It hits if he has changed his mind.')),
      passato: C(P('Ricordagli la frana che non ha prevenuto', 'Remind him of the landslide he did not prevent'), P('Rischioso: se ricordi male, si ritorce.', 'Risky: if you remember wrongly, it backfires.')),
      salta: C(P('Lascia al conduttore le domande sul clima', 'Leave the questions on climate to the host'), P('Lasci il tempo al conduttore.', 'You leave the time to the host.'))
    },
    replies: {
      fatti: C(P('Rispondi con i dati sulle opere concluse', 'Answer with the data on completed works'), P('Serve preparazione.', 'Preparation is needed.')),
      calma: C(P('Resta calmo: i tempi di un cantiere non sono catchphrase', 'Stay calm: the times of a site are not catchphrases'), P('Sobrio, ma sembri sulla difensiva.', 'Sober, but you seem defensive.')),
      contrattacco: C(P('Contrattacca sul consumo di suolo', 'Counter-attack on land consumption'), P('Il pubblico si accende, con rischi.', 'The audience warms up, with risks.')),
      ignora: C(P('Ignora e torna al clima e all’energia', 'Ignore it and go back to climate and energy'), P('Cambi argomento.', 'You change the subject.'))
    },
    closings: {
      sobrio: C(P('Riassumi: prevenzione prima delle emergenze', 'Sum up: prevention before emergencies'), P('Misura e chiarezza.', 'Measure and clarity.')),
      appello: C(P('Appello a chi vive nelle aree a rischio', 'Appeal to those who live in risk areas'), P('Carisma e visione.', 'Charisma and vision.')),
      sfida: C(P('Sfida: «Dica dove apre i cantieri, e quando»', 'Challenge: “Say where you open the sites, and when”'), P('Forte, ma divisivo.', 'Strong, but divisive.'))
    }
  },
  istituzioni: {
    styles: {
      dati: C(P('Con i dati su tempi della giustizia e fiducia', 'With the data on court times and trust'), P('Cifre sulle istituzioni: conta la competenza.', 'Figures on the institutions: competence counts.')),
      empatia: C(P('Racconta chi non vota più perché non si fida', 'Tell of those who no longer vote because they do not trust'), P('Il distacco dei cittadini: conta il carisma.', 'The detachment of citizens: charisma counts.')),
      programma: C(P('Cita le tue regole per la trasparenza', 'Cite your transparency rules'), P('Vale quanto sei credibile e coerente.', 'It counts as much as you are credible and consistent.')),
      attacco: C(P('Attacca i privilegi e le promesse mancate dell’avversario', 'Attack the rival’s privileges and broken promises'), P('Premia se è debole.', 'It pays if he is weak.'))
    },
    asks: {
      conti: C(P('Chiedi quanto costa la sua riforma', 'Ask how much his reform costs'), P('Mette alla prova il suo programma.', 'It tests his programme.')),
      coerenza: C(P('Chiedi perché oggi chiede ciò che ha bloccato ieri', 'Ask why he now asks for what he blocked yesterday'), P('Colpisce se ha cambiato idea.', 'It hits if he has changed his mind.')),
      passato: C(P('Ricordagli le inchieste sul suo partito', 'Remind him of the inquiries into his party'), P('Rischioso: se ricordi male, si ritorce.', 'Risky: if you remember wrongly, it backfires.')),
      salta: C(P('Rinuncia alla domanda: parlino gli atti', 'Give up the question: let the acts speak'), P('Lasci il tempo al conduttore.', 'You leave the time to the host.'))
    },
    replies: {
      fatti: C(P('Rispondi con gli atti e le votazioni', 'Answer with the acts and the votes'), P('Serve preparazione.', 'Preparation is needed.')),
      calma: C(P('Resta calmo e rivendica la tua correttezza', 'Stay calm and claim your integrity'), P('Sobrio, ma sembri sulla difensiva.', 'Sober, but you seem defensive.')),
      contrattacco: C(P('Contrattacca sui conflitti d’interesse', 'Counter-attack on conflicts of interest'), P('Il pubblico si accende, con rischi.', 'The audience warms up, with risks.')),
      ignora: C(P('Ignora e riporta il discorso sulle riforme', 'Ignore it and bring the talk back to reforms'), P('Cambi argomento.', 'You change the subject.'))
    },
    closings: {
      sobrio: C(P('Riassumi: istituzioni che funzionano e rendono conto', 'Sum up: institutions that work and are accountable'), P('Misura e chiarezza.', 'Measure and clarity.')),
      appello: C(P('Appello a chi ha smesso di votare', 'Appeal to those who stopped voting'), P('Carisma e visione.', 'Charisma and vision.')),
      sfida: C(P('Sfida: «Pubblichi i suoi atti come pubblico i miei»', 'Challenge: “Publish your acts as I publish mine”'), P('Forte, ma divisivo.', 'Strong, but divisive.'))
    }
  },
  sanita: {
    styles: {
      dati: C(P('Con i numeri delle liste d’attesa', 'With the waiting-list figures'), P('Tempi di visita, posti letto, personale: conta la competenza.', 'Visit times, beds, staff: competence counts.')),
      empatia: C(P('Racconta il paziente che rinuncia alle cure', 'Tell of the patient who gives up treatment'), P('Un anziano in pronto soccorso, una famiglia che paga di tasca: conta il carisma.', 'An elderly man in the emergency room, a family paying out of pocket: charisma counts.')),
      programma: C(P('Cita la tua promessa su medici e ospedali', 'Cite your promise on doctors and hospitals'), P('Vale quanto sei credibile e coerente.', 'It counts as much as you are credible and consistent.')),
      attacco: C(P('Attacca i tagli ai reparti dell’avversario', 'Attack the rival’s cuts to wards'), P('Premia se è debole, punisce se non sei preparato.', 'It pays if he is weak, punishes if you are unprepared.'))
    },
    asks: {
      conti: C(P('Chiedi con quali fondi assume medici e infermieri', 'Ask with what funds he hires doctors and nurses'), P('Mette alla prova il suo programma.', 'It tests his programme.')),
      coerenza: C(P('Chiedi perché ha chiuso quell’ospedale', 'Ask why he closed that hospital'), P('Colpisce se ha cambiato idea.', 'It hits if he has changed his mind.')),
      passato: C(P('Ricordagli i commissariamenti della sanità', 'Remind him of the health-service receiverships'), P('Rischioso: se ricordi male, si ritorce.', 'Risky: if you remember wrongly, it backfires.')),
      salta: C(P('Non incalzare: lascia spazio sulla sanità', 'Do not press: leave room on healthcare'), P('Lasci il tempo al conduttore.', 'You leave the time to the host.'))
    },
    replies: {
      fatti: C(P('Rispondi con i dati su posti letto e personale', 'Answer with the data on beds and staff'), P('Serve preparazione.', 'Preparation is needed.')),
      calma: C(P('Resta calmo: la sanità non si governa a catchphrase', 'Stay calm: healthcare is not run on catchphrases'), P('Sobrio, ma sembri sulla difensiva.', 'Sober, but you seem defensive.')),
      contrattacco: C(P('Contrattacca sulle convenzioni coi privati', 'Counter-attack on the agreements with private providers'), P('Il pubblico si accende, con rischi.', 'The audience warms up, with risks.')),
      ignora: C(P('Ignora e torna alla prevenzione', 'Ignore it and go back to prevention'), P('Cambi argomento.', 'You change the subject.'))
    },
    closings: {
      sobrio: C(P('Riassumi: cure in tempi certi, per tutti', 'Sum up: care in certain times, for everyone'), P('Misura e chiarezza.', 'Measure and clarity.')),
      appello: C(P('Appello a chi aspetta una visita da mesi', 'Appeal to those waiting months for a visit'), P('Carisma e visione.', 'Charisma and vision.')),
      sfida: C(P('Sfida: «Si faccia curare dove manda i cittadini»', 'Challenge: “Get treated where you send the citizens”'), P('Forte, ma divisivo.', 'Strong, but divisive.'))
    }
  },
  sicurezza: {
    styles: {
      dati: C(P('Con i dati su reati, presìdi e interventi', 'With the data on crime, outposts and interventions'), P('Statistiche e organici: conta la competenza.', 'Statistics and staffing: competence counts.')),
      empatia: C(P('Racconta il quartiere che non esce più la sera', 'Tell of the neighbourhood that no longer goes out at night'), P('Anziani e commercianti: conta il carisma.', 'Elderly people and shopkeepers: charisma counts.')),
      programma: C(P('Cita il tuo piano per presìdi e illuminazione', 'Cite your plan for patrols and lighting'), P('Vale quanto sei credibile e coerente.', 'It counts as much as you are credible and consistent.')),
      attacco: C(P('Attacca le promesse mancate dell’avversario sulla sicurezza', 'Attack the rival’s broken promises on safety'), P('Premia se è debole.', 'It pays if he is weak.'))
    },
    asks: {
      conti: C(P('Chiedi con quali fondi assume agenti e vigili', 'Ask with what funds he hires officers and wardens'), P('Mette alla prova il suo programma.', 'It tests his programme.')),
      coerenza: C(P('Chiedi perché ha tagliato i presìdi di quartiere', 'Ask why he cut the neighbourhood patrols'), P('Colpisce se ha cambiato idea.', 'It hits if he has changed his mind.')),
      passato: C(P('Ricordagli i fatti avvenuti sotto la sua guida', 'Remind him of what happened under his leadership'), P('Rischioso: se ricordi male, si ritorce.', 'Risky: if you remember wrongly, it backfires.')),
      salta: C(P('Non fare domande: lascia al conduttore la sicurezza', 'Ask nothing: leave safety to the host'), P('Lasci il tempo al conduttore.', 'You leave the time to the host.'))
    },
    replies: {
      fatti: C(P('Rispondi con i numeri sui reati', 'Answer with the crime figures'), P('Serve preparazione.', 'Preparation is needed.')),
      calma: C(P('Resta calmo: la sicurezza non è una gara di catchphrase', 'Stay calm: safety is not a catchphrase contest'), P('Sobrio, ma sembri sulla difensiva.', 'Sober, but you seem defensive.')),
      contrattacco: C(P('Contrattacca sui rischi che ha minimizzato', 'Counter-attack on the risks he played down'), P('Il pubblico si accende, con rischi.', 'The audience warms up, with risks.')),
      ignora: C(P('Ignora e torna alla prevenzione sociale', 'Ignore it and go back to social prevention'), P('Cambi argomento.', 'You change the subject.'))
    },
    closings: {
      sobrio: C(P('Riassumi: presenza, prevenzione e regole chiare', 'Sum up: presence, prevention and clear rules'), P('Misura e chiarezza.', 'Measure and clarity.')),
      appello: C(P('Appello a chi ha paura di tornare a casa', 'Appeal to those afraid to go home'), P('Carisma e visione.', 'Charisma and vision.')),
      sfida: C(P('Sfida: «Passi una sera con me in quella piazza»', 'Challenge: “Spend an evening with me in that square”'), P('Forte, ma divisivo.', 'Strong, but divisive.'))
    }
  },
  'costo-vita': {
    styles: {
      dati: C(P('Con i dati su inflazione, bollette e salari', 'With the data on inflation, bills and wages'), P('Prezzi e potere d’acquisto: conta la competenza.', 'Prices and purchasing power: competence counts.')),
      empatia: C(P('Racconta chi salta i pasti a fine mese', 'Tell of those who skip meals at month-end'), P('La spesa, l’affitto, le rate: conta il carisma.', 'Shopping, rent, instalments: charisma counts.')),
      programma: C(P('Cita le tue misure su tasse e bollette', 'Cite your measures on taxes and bills'), P('Vale quanto sei credibile e coerente.', 'It counts as much as you are credible and consistent.')),
      attacco: C(P('Attacca le tasse nascoste dell’avversario', 'Attack the rival’s hidden taxes'), P('Premia se è debole.', 'It pays if he is weak.'))
    },
    asks: {
      conti: C(P('Chiedi dove trova i soldi per tagliare le tasse', 'Ask where he finds the money to cut taxes'), P('Mette alla prova il suo programma.', 'It tests his programme.')),
      coerenza: C(P('Chiedi perché ha alzato le aliquote che ora vuole ridurre', 'Ask why he raised the rates he now wants to cut'), P('Colpisce se ha cambiato idea.', 'It hits if he has changed his mind.')),
      passato: C(P('Ricordagli l’aumento delle tariffe nel suo mandato', 'Remind him of the ticket price rises in his term'), P('Rischioso: se ricordi male, si ritorce.', 'Risky: if you remember wrongly, it backfires.')),
      salta: C(P('Lascia al conduttore le domande sui prezzi', 'Leave the questions on prices to the host'), P('Lasci il tempo al conduttore.', 'You leave the time to the host.'))
    },
    replies: {
      fatti: C(P('Rispondi con i dati su prezzi e stipendi', 'Answer with the data on prices and salaries'), P('Serve preparazione.', 'Preparation is needed.')),
      calma: C(P('Resta calmo: il carovita non si risolve in uno catchphrase', 'Stay calm: the cost of living is not solved by a catchphrase'), P('Sobrio, ma sembri sulla difensiva.', 'Sober, but you seem defensive.')),
      contrattacco: C(P('Contrattacca sul debito che lascerebbe', 'Counter-attack on the debt he would leave'), P('Il pubblico si accende, con rischi.', 'The audience warms up, with risks.')),
      ignora: C(P('Ignora e parla del carrello della spesa', 'Ignore it and talk about the shopping basket'), P('Cambi argomento.', 'You change the subject.'))
    },
    closings: {
      sobrio: C(P('Riassumi: più potere d’acquisto, conti in ordine', 'Sum up: more purchasing power, accounts in order'), P('Misura e chiarezza.', 'Measure and clarity.')),
      appello: C(P('Appello alle famiglie che arrivano a fatica a fine mese', 'Appeal to families who barely make it to month-end'), P('Carisma e visione.', 'Charisma and vision.')),
      sfida: C(P('Sfida: «Mi dica quanto costa il suo programma»', 'Challenge: “Tell me how much your programme costs”'), P('Forte, ma divisivo.', 'Strong, but divisive.'))
    }
  },
  giovani: {
    styles: {
      dati: C(P('Con i dati su abbandono scolastico e disoccupazione giovanile', 'With the data on dropout and youth unemployment'), P('Numeri su scuola e primo lavoro: conta la competenza.', 'Figures on school and first jobs: competence counts.')),
      empatia: C(P('Racconta i ragazzi che se ne vanno all’estero', 'Tell of the young people leaving abroad'), P('Una generazione che parte: conta il carisma.', 'A generation that leaves: charisma counts.')),
      programma: C(P('Cita le tue misure su scuola e università', 'Cite your measures on school and university'), P('Vale quanto sei credibile e coerente.', 'It counts as much as you are credible and consistent.')),
      attacco: C(P('Attacca i tagli alla scuola dell’avversario', 'Attack the rival’s cuts to schools'), P('Premia se è debole.', 'It pays if he is weak.'))
    },
    asks: {
      conti: C(P('Chiedi come finanzia borse di studio e alloggi', 'Ask how he funds scholarships and housing'), P('Mette alla prova il suo programma.', 'It tests his programme.')),
      coerenza: C(P('Chiedi perché ha bocciato quel fondo per i giovani', 'Ask why he rejected that youth fund'), P('Colpisce se ha cambiato idea.', 'It hits if he has changed his mind.')),
      passato: C(P('Ricordagli le scuole chiuse nel suo mandato', 'Remind him of the schools closed in his term'), P('Rischioso: se ricordi male, si ritorce.', 'Risky: if you remember wrongly, it backfires.')),
      salta: C(P('Cedi la domanda al conduttore sulla scuola', 'Hand the question on school to the host'), P('Lasci il tempo al conduttore.', 'You leave the time to the host.'))
    },
    replies: {
      fatti: C(P('Rispondi con i dati su diplomi e primo impiego', 'Answer with the data on diplomas and first jobs'), P('Serve preparazione.', 'Preparation is needed.')),
      calma: C(P('Resta calmo: la scuola chiede tempo, non catchphrase', 'Stay calm: school needs time, not catchphrases'), P('Sobrio, ma sembri sulla difensiva.', 'Sober, but you seem defensive.')),
      contrattacco: C(P('Contrattacca sulle classi pollaio', 'Counter-attack on overcrowded classes'), P('Il pubblico si accende, con rischi.', 'The audience warms up, with risks.')),
      ignora: C(P('Ignora e parla di università e tirocini', 'Ignore it and talk about university and internships'), P('Cambi argomento.', 'You change the subject.'))
    },
    closings: {
      sobrio: C(P('Riassumi: istruzione, primo lavoro, un motivo per restare', 'Sum up: education, a first job, a reason to stay'), P('Misura e chiarezza.', 'Measure and clarity.')),
      appello: C(P('Appello ai ragazzi che pensano di partire', 'Appeal to the young who think of leaving'), P('Carisma e visione.', 'Charisma and vision.')),
      sfida: C(P('Sfida: «Venga a parlare con loro, non di loro»', 'Challenge: “Come and talk with them, not about them”'), P('Forte, ma divisivo.', 'Strong, but divisive.'))
    }
  }
});
// The wording of one choice for a topic: [label, detail] in Italian and English; null when the topic has none (the generic wording of the engine is used).
export const debateChoice = (topicId, group, id) => DEBATE_CHOICES[topicId]?.[group]?.[id] ?? null;
export const DEBATE_PAIRS = Object.values(DEBATE_CHOICES).flatMap(topic => Object.values(topic).flatMap(group => Object.values(group).flatMap(([label, detail]) => [label, detail])));
setDebateChoices(DEBATE_CHOICES);
