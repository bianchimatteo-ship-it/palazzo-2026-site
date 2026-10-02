// Simulated newsroom: headlines tied to what happens in the career, written with different structures
// (fact, question, number, local angle, quote-like, analysis) and never the same template twice in a row.
// Headlines speak of the player's own character and of the simulated world: no statement is put in the mouth of real people.
const RECENT = 18;
// A template not used recently; when every template of the kind has been used, the least recently used one.
const pick = (list, seed, recent) => {
  const items = list.map((text, index) => ({ text, index }));
  const fresh = items.filter(item => !recent.includes(item.text));
  if (fresh.length) return fresh[seed % fresh.length];
  return items.sort((a, b) => recent.lastIndexOf(a.text) - recent.lastIndexOf(b.text))[0];
};
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261);

export const NEWS_TEMPLATES = Object.freeze({
  // What the player does in public.
  social: { good: ['Il post di {name} fa il giro della rete', '{name} detta l’agenda sui social: migliaia di condivisioni', 'Boom di interazioni per {name}: «Parliamo di problemi veri»', 'Social, la settimana di {name}: numeri in crescita'], bad: ['Polemica per un post di {name}', 'Bufera social su {name}: il messaggio cancellato dopo poche ore', '{name} e quel post che divide anche i suoi', 'Scivolone digitale: {name} costretto a correggersi'] },
  intervista: { good: ['Intervista a {name}: «{region} merita più attenzione»', '{name} si racconta: carriera, progetti e il nodo {topic}', 'A tu per tu con {name}, tra ambizioni e cautele', '«Ecco cosa farei domani»: il piano di {name}'], bad: ['Parole di {name} travisate: bufera', '{name}, l’intervista che imbarazza il partito', 'Quella frase di {name} che nessuno aveva previsto', 'Dopo l’intervista, {name} in difficoltà'] },
  talk: { good: ['{name} ospite in prima serata: confronto vinto ai punti', 'In tv {name} tiene testa agli avversari', 'Il faccia a faccia televisivo premia {name}', 'Prima serata, {name} convince anche gli scettici'], bad: ['Scontro in diretta per {name}', 'Talk show, {name} messo all’angolo', 'Serata difficile in tv per {name}', 'Il confronto in studio si trasforma in un boomerang per {name}'] },
  progetto: { good: ['{name} presenta un progetto per {municipality}', 'Un piano per {region}: la proposta di {name} convince i sindaci', 'Cantieri, tempi, costi: il progetto di {name} nel dettaglio', '{name} porta a {municipality} un’idea che piace alle imprese'], bad: ['Il progetto di {name} si arena', '{municipality}, il progetto di {name} finisce su un binario morto', 'Troppi dubbi sui costi: frenata sul piano di {name}', 'Il progetto annunciato da {name} resta sulla carta'] },
  ascolto: { good: ['{name} tra mercati e quartieri di {municipality}', 'Porta a porta a {municipality}: {name} ascolta e prende appunti', 'Una giornata nei quartieri con {name}', '{name} tra la gente: «Qui si capisce cosa serve»'], bad: ['Contestazione durante l’incontro di {name}', 'Fischi e cartelli: incontro teso per {name} a {municipality}', 'L’assemblea pubblica sfugge di mano a {name}', 'A {municipality} i residenti accolgono {name} con le proteste'] },
  associazioni: { good: ['{name} costruisce una rete con le associazioni', 'Volontariato e terzo settore: sponda per {name}', '{name} firma un patto con le associazioni di {region}', 'Le associazioni di {municipality} scelgono il dialogo con {name}'], bad: ['Un comitato accusa {name} di passerella', 'Associazioni deluse: «Da {name} solo promesse»', 'Il terzo settore volta le spalle a {name}', 'Freddezza delle associazioni verso {name}'] },
  dissenso: { good: ['{name} rompe con la linea del partito', 'Il coraggio di dire no: {name} si smarca', '{name} guida il dissenso interno', 'Voce fuori dal coro: {name} sfida i vertici'], bad: ['{name} isolato nel partito', 'Strappo senza seguito: {name} resta solo', 'Il partito chiude la porta a {name}', 'Il dissenso di {name} non trova sponde'] },
  'campagna-partito': { good: ['Parte la campagna nazionale di {party}', 'Nuovi manifesti e tour: {party} accelera', '{party} riempie le piazze: la campagna decolla', 'Campagna di {party}, primo bilancio positivo'], bad: ['Spot di {party} criticati', 'Campagna di {party} al centro delle ironie', 'Il messaggio di {party} non arriva: analisti perplessi', 'Soldi e poca resa: i dubbi sulla campagna di {party}'] },
  conferenza: { good: ['Conferenza stampa di {name}: risposte convincenti', '{name} risponde a tutto: conferenza senza sbavature', 'Numeri e tempi certi: la conferenza di {name}', 'I giornalisti incalzano, {name} non arretra'], bad: ['Conferenza stampa di {name}: domande senza risposta', 'Conferenza lampo e tanti silenzi: il caso {name}', '{name} lascia la sala tra le proteste dei cronisti', 'Troppe contraddizioni nella conferenza di {name}'] },
  interrogazione: { good: ['{name} porta in Aula i problemi di {region}', 'Interrogazione di {name}: il governo promette risposte', 'Dal territorio al Parlamento: l’iniziativa di {name}', '{name} incalza il governo su {topic}'], bad: ['Interrogazione di {name}: il governo non risponde', 'Aula semivuota per l’interrogazione di {name}', 'Il governo liquida in due righe la domanda di {name}', 'Interrogazione caduta nel vuoto per {name}'] },
  // What happens around the player, week after week.
  pollUp: ['{party} sale al {share}% ({delta} punti in una settimana)', 'Sondaggi, vento in poppa per {party}', 'Perché {party} cresce? Tre ipotesi dopo l’ultimo sondaggio', '{party} al {share}%: il massimo da settimane?', 'Il sondaggio della settimana sorride a {party}', 'Nell’area {macro} la spinta di {party}'],
  pollDown: ['{party} scende al {share}% ({delta} punti)', 'Frenata di {party} nei sondaggi: cosa non funziona', 'Sondaggi amari per {party}, la base chiede risposte', '{party} perde terreno: gli avversari esultano', 'Il calo di {party} spiegato in tre numeri', '{party} sotto pressione dopo l’ultima rilevazione'],
  government: ['Maggioranza in fibrillazione: stabilità ai minimi', 'Il governo traballa: vertici notturni e veti incrociati', 'Crisi all’orizzonte? Gli alleati alzano il prezzo', 'Tensione nella coalizione: si tratta a oltranza', 'Palazzo Chigi alla prova dei numeri in Aula'],
  economy: ['Spread a quota {spread}: i mercati osservano l’Italia', 'Conti pubblici sotto la lente: deficit al {deficit}%', 'Mercati nervosi, il costo del debito sale', 'Borsa e titoli di Stato: settimana di tensione', 'Bruxelles guarda ai conti italiani'],
  region: ['{region}, allarme {indicator}: il dato peggiore d’Italia', 'Il caso {region}: {indicator} ai minimi, sindaci in allarme', 'Viaggio in {region}, dove {indicator} è l’emergenza', '{region} chiede aiuto su {indicator}', 'Cosa non funziona in {region}: il nodo {indicator}'],
  election: ['{countdown} al voto: il quadro', 'Verso le elezioni: liste, alleanze e sondaggi', 'Conto alla rovescia per il voto, partiti in fermento', 'Elezioni tra {weeksText}: chi rischia di più', 'Candidature e trattative: la corsa è iniziata'],
  alliance: ['Nasce un’intesa: {detail}', 'Accordo politico: {detail}', 'Nuovi equilibri: {detail}', 'Alleanze in movimento: {detail}'],
  rupture: ['Rottura: {detail}', 'Divorzio politico: {detail}', 'Finisce l’intesa: {detail}', 'Strappo tra alleati: {detail}'],
  evolution: ['Partiti in movimento: {detail}', 'Il quadro cambia: {detail}', 'Terremoto nei partiti: {detail}', 'Nuovi assetti: {detail}']
});

const fill = (text, context) => String(text).replace(/\{(\w+)\}/g, (match, key) => context[key] ?? match);

// A headline of the given kind, not repeated within the recent window. Returns the text and the updated window.
export function composeHeadline(recent = [], kind, context = {}, tone = 'good') {
  const bucket = NEWS_TEMPLATES[kind];
  const list = Array.isArray(bucket) ? bucket : bucket?.[tone === 'bad' ? 'bad' : 'good'] ?? NEWS_TEMPLATES.social.good;
  const seed = hash(`${kind}|${context.week ?? 0}|${context.name ?? ''}|${context.party ?? ''}|${recent.length}`);
  const chosen = pick(list, seed, recent);
  return { text: fill(chosen.text, context), recent: [...recent, chosen.text].slice(-RECENT) };
}

// The news of the week, linked to the career: polls of the player's party, government, economy, territory, elections,
// alliances and party evolution. Each item: { kind, headline, tone, outletId }.
export function weeklyNews({ recent = [], week, party = null, pollRow = null, government = null, finance = null, region = null, worstIndicator = null, electionWeeks = null, worldEvents = [], macro = null }) {
  const items = [];
  let window = recent;
  const add = (kind, context, tone, outletId) => {
    const result = composeHeadline(window, kind, { week, ...context }, tone);
    window = result.recent;
    items.push({ kind, headline: result.text, tone, outletId });
  };
  if (party && pollRow && Math.abs(pollRow.delta ?? 0) >= 0.5) add(pollRow.delta > 0 ? 'pollUp' : 'pollDown', { party, share: String(pollRow.share).replace('.', ','), delta: `${pollRow.delta > 0 ? '+' : '−'}${String(Math.abs(pollRow.delta)).replace('.', ',')}`, macro: macro ?? 'Paese' }, pollRow.delta > 0 ? 'good' : 'bad', 'quotidiani');
  if (government && ['active', 'crisis'].includes(government.status) && (government.stability ?? 60) < 35) add('government', {}, 'bad', 'tv-nazionale');
  if (finance && (finance.spread > 220 || finance.euStatus === 'procedura')) add('economy', { spread: Math.round(finance.spread), deficit: String(Math.round((finance.deficit ?? 3) * 10) / 10).replace('.', ',') }, 'bad', 'quotidiani');
  if (region && worstIndicator && items.length < 2) add('region', { region, indicator: worstIndicator.toLowerCase() }, 'bad', 'tv-locale');
  if (Number.isFinite(electionWeeks) && electionWeeks > 0 && electionWeeks <= 8 && items.length < 3) add('election', { countdown: electionWeeks === 1 ? 'Manca una settimana' : `Mancano ${electionWeeks} settimane`, weeksText: electionWeeks === 1 ? 'una settimana' : `${electionWeeks} settimane` }, 'neutral', 'tv-nazionale');
  for (const event of worldEvents.slice(0, 2)) {
    const kind = event.kind === 'alleanza' ? 'alliance' : event.kind === 'rottura' ? 'rupture' : ['congresso', 'scissione', 'fusione', 'nuova-forza'].includes(event.kind) ? 'evolution' : null;
    if (kind && items.length < 3) add(kind, { detail: event.title.charAt(0).toLowerCase() + event.title.slice(1) }, kind === 'rupture' ? 'bad' : 'neutral', 'quotidiani');
  }
  return { items, recent: window };
}
