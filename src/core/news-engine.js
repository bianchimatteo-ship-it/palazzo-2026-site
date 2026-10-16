// Simulated newsroom: headlines tied to what happens in the career, written with different structures
// (fact, question, number, local angle, quote-like, analysis) and never the same template twice in a row.
// Headlines speak of the player's own character and of the simulated world: no statement is put in the mouth of real people.
import { ARTICLE_CATEGORIES, NEWSROOM_OUTLETS, NEWS_RULES as RULES, RADIO_PROGRAMMES, RADIO_RULES, STORY_KINDS } from '../data/simulation/news-rules.js?v=20261016-6';
import { WORLD_EVENTS } from '../data/simulation/polling-rules.js?v=20261016-6';
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

// ---------- the newsroom: articles, outlets with an identity, stories that last ----------
// Every article comes from a fact of the game (a law applied, an entry of the parliamentary record, a world event, a project, the public finance, an
// interview of the player) and is written once: the fact has a key, and a key already seen is never published again. An article only tells: what
// moves the climate (visibility, tone) is still done by mediaEvent, and a story only keeps the thread (timeline, reactions, heat) — citing a fact
// changes nothing by itself. Nothing here uses the random sequence of the game: choices are a hash of the key, so the same game gives the same newsroom.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const copy = value => JSON.parse(JSON.stringify(value));
const unit = (...parts) => { let n = hash(parts.join('|')); n = Math.imul(n ^ (n >>> 16), 0x85ebca6b) >>> 0; n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35) >>> 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const num = (value, digits = 1) => String(Number(Number(value ?? 0).toFixed(digits))).replace('.', ',');
const lower = text => String(text ?? '').charAt(0).toLowerCase() + String(text ?? '').slice(1);
const list = items => items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
export const categoryLabel = id => ARTICLE_CATEGORIES.find(item => item.id === id)?.label ?? id;
export const credibilityWeight = outlet => clamp(RULES.weight.base + RULES.weight.perPoint * (outlet?.credibility ?? 55), RULES.weight.min, RULES.weight.max);

// The media of a save, with the identity of every channel (credibility keeps what it earned), and the containers of the newsroom.
export function normalizeMedia(input) {
  const media = input && typeof input === 'object' ? input : {};
  const outlets = (media.outlets ?? []).map(outlet => {
    const identity = NEWSROOM_OUTLETS[outlet.id];
    return identity ? { ...outlet, name: identity.name, tagline: identity.tagline, leaning: identity.leaning, baseCredibility: identity.credibility, credibility: Number.isFinite(outlet.credibility) ? outlet.credibility : identity.credibility } : outlet;
  });
  return { ...media, outlets, articles: Array.isArray(media.articles) ? media.articles : [], stories: Array.isArray(media.stories) ? media.stories : [], seen: Array.isArray(media.seen) ? media.seen : [], pending: Array.isArray(media.pending) ? media.pending : [], cursor: { historyId: null, lawWeek: 0, ...(media.cursor ?? {}) }, seq: Number.isFinite(media.seq) ? media.seq : 0, radio: { seq: 0, ...(media.radio ?? {}), bulletins: Array.isArray(media.radio?.bulletins) ? media.radio.bulletins : [] } };
}
// How an outlet frames the Government: against it when its leaning is opposite to the premier's side, with it when it is the same.
export function edgeOf(outlet, govAxis = 0) {
  if (!govAxis) return 'neutral';
  const slant = (outlet.leaning ?? 0) * Math.sign(govAxis);
  return slant <= -0.4 ? 'critical' : slant >= 0.4 ? 'friendly' : 'neutral';
}
const pickOutlet = (media, fact) => {
  const wanted = fact.local ? ['tv-locale', 'stampa-locale'] : null;
  const scored = media.outlets.filter(outlet => NEWSROOM_OUTLETS[outlet.id]).map(outlet => {
    const identity = NEWSROOM_OUTLETS[outlet.id];
    const score = (identity.beat.includes(fact.category) ? 2 : 0) + (fact.category === 'inchieste' && identity.investigative ? 2 : 0) + (wanted?.includes(outlet.id) ? 3 : 0) + (fact.outletHint === outlet.id ? 3 : 0) + outlet.reach / 100 + unit(fact.key, outlet.id);
    return { outlet, score };
  });
  return scored.sort((a, b) => b.score - a.score)[0]?.outlet ?? media.outlets[0];
};
const pickVariant = (variants, edge) => variants[edge] ?? variants.neutral;

// ---------- what each kind of fact says ----------
// A builder returns { headline, deck, paragraphs, facts } for the edge of the outlet; `ctx.gov` is a short description of the Government at that moment.
const govFacts = ctx => ctx.gov ? [['Governo', ctx.gov.name], ['Stabilità', `${Math.round(ctx.gov.stability)}/100`], ...(Number.isFinite(ctx.gov.margin) ? [['Margine alla Camera più stretta', `${ctx.gov.margin >= 0 ? '+' : ''}${ctx.gov.margin} seggi`]] : [])] : [];
const govLine = ctx => ctx.gov ? `${ctx.gov.name} ha la fiducia di ${ctx.gov.groups} gruppi${ctx.gov.external ? ` (di cui ${ctx.gov.external} dall’esterno)` : ''}; la stabilità è a ${Math.round(ctx.gov.stability)}/100${Number.isFinite(ctx.gov.margin) ? ` e il margine nella Camera più stretta è di ${ctx.gov.margin >= 0 ? '+' : ''}${ctx.gov.margin} seggi` : ''}.` : '';
const BUILDERS = {
  legge(fact, ctx) {
    const d = fact.data;
    const winners = (d.winners ?? []).map(item => lower(item.label)), losers = (d.losers ?? []).map(item => lower(item.label));
    const edge = { critical: !d.covered ? `“${d.title}” passa, ma i conti non tornano` : d.controversy >= 0.8 ? `“${d.title}” passa tra le polemiche` : `Via libera a “${d.title}”: restano i dubbi sui costi`, friendly: `Approvata “${d.title}”${winners.length ? `: ne beneficiano ${list(winners.slice(0, 2))}` : ''}`, neutral: `Approvata “${d.title}”: ${lower(d.category)}, costo ${num(d.cost)} punti` };
    return {
      headline: edge, deck: `${d.instrumentLabel ?? 'Un provvedimento'} su ${lower(d.category)} (${lower(d.targetLabel ?? 'tutto il Paese')}), finanziato ${lower(d.financingLabel ?? 'dal bilancio')}.`,
      paragraphs: [
        `Il provvedimento “${d.title}” entra in vigore. Costa ${num(d.cost)} punti di bilancio (circa ${num(d.billions)} miliardi di gioco) ed è ${d.covered ? 'coperto dal margine di bilancio disponibile' : 'finanziato oltre il margine di bilancio'}${d.deficit ? `: il deficit sale di ${num(d.deficit, 2)} punti` : ''}.`,
        winners.length || losers.length ? `${winners.length ? `Ne traggono vantaggio ${list(winners)}.` : ''}${losers.length ? ` Restano scontenti ${list(losers)}${d.losers?.[0]?.reason ? ` (${lower(d.losers[0].reason)})` : ''}.` : ''}`.trim() : 'Gli effetti sui cittadini sono distribuiti e senza vincitori o vinti netti.',
        d.topRegions?.length ? `Gli effetti si concentrano in ${list(d.topRegions.slice(0, 3).map(item => item.name ?? item))}${d.bottomRegions?.length ? ` e pesano meno in ${list(d.bottomRegions.slice(0, 2).map(item => item.name ?? item))}` : ''}.` : '',
        d.controversy >= 0.8 ? 'La misura divide: nei prossimi giorni ci si aspettano reazioni dei gruppi e dei territori coinvolti.' : ''
      ].filter(Boolean),
      facts: [['Costo', `${num(d.cost)} punti`], ['Copertura', d.covered ? 'nel margine' : 'oltre il margine'], ['Controversia', num(d.controversy, 2)], ...(d.origin ? [['Origine', d.origin === 'giocatore' ? 'del giocatore' : 'del governo']] : [])]
    };
  },
  respinta(fact, ctx) {
    const d = fact.data;
    return { headline: { critical: `Battuta d’arresto per la maggioranza: respinta “${d.title}”`, friendly: `Respinta “${d.title}”: la maggioranza prende tempo`, neutral: `Respinta “${d.title}” nella votazione finale` }, deck: fact.text, paragraphs: [fact.text, govLine(ctx)].filter(Boolean), facts: govFacts(ctx) };
  },
  governo(fact, ctx) {
    const v = HISTORY[fact.type];
    return { headline: v.h, deck: fact.text, paragraphs: [fact.text, v.p ? v.p(fact, ctx) : '', govLine(ctx)].filter(Boolean), facts: govFacts(ctx) };
  },
  dossier(fact, ctx) {
    const d = fact.data;
    const title = lower(d.title ?? 'un dossier');
    const blame = { ministro: 'La responsabilità è del ministro: il dossier non ha avuto la guida che serviva.', maggioranza: 'La maggioranza era troppo stretta per portare avanti il dossier.', circostanze: 'Le circostanze, più che il ministro, hanno frenato il dossier.' }[d.blame] ?? '';
    const headlines = {
      riuscito: { neutral: `Ministero ${d.portfolio}: dossier riuscito`, critical: `Il ministro ${d.portfolio} ce la fa: ora si vedranno gli effetti`, friendly: `Successo al ministero ${d.portfolio}: ${title}` },
      fallito: { neutral: `Ministero ${d.portfolio}: dossier fallito`, critical: `Fallimento al ministero ${d.portfolio}: ${title}`, friendly: `Ministero ${d.portfolio}, il dossier non decolla: ${d.blame === 'circostanze' ? 'pesano le circostanze' : 'si cerca una soluzione'}` },
      ritirato: { neutral: `Ministero ${d.portfolio}: ritirato il dossier`, critical: `Dossier ritirato al ministero ${d.portfolio}: marcia indietro`, friendly: `Ministero ${d.portfolio}: il Governo ritira il dossier e riparte` },
      rinviato: { neutral: `Ministero ${d.portfolio}: più tempo per il dossier`, critical: `Dossier in ritardo al ministero ${d.portfolio}: slitta la scadenza`, friendly: `Ministero ${d.portfolio}: concessa una proroga al dossier` }
    }[d.outcome] ?? { neutral: fact.text, critical: fact.text, friendly: fact.text };
    return { headline: headlines, deck: fact.text, paragraphs: [fact.text, blame, d.outcome === 'riuscito' ? 'Il risultato si legge sul Paese: la fiducia nel ministro e il sostegno del suo gruppo ne escono rafforzati.' : d.outcome === 'fallito' ? 'Il ministro è sotto pressione: un altro passo falso rende più probabili le sue dimissioni.' : '', govLine(ctx)].filter(Boolean), facts: [['Ministero', d.portfolio ?? '—'], ['Esito', d.outcome], ...govFacts(ctx).slice(0, 2)] };
  },
  sondaggio(fact, ctx) {
    const d = fact.data;
    const best = (d.bySegment ?? []).slice().sort((a, b) => b.approval - a.approval), worst = best.slice().reverse();
    const verdict = d.verdict === 'contrari' ? 'bocciata' : d.verdict === 'favorevoli' ? 'promossa' : 'accolta in modo diviso';
    const headlines = {
      contrari: { neutral: `«${d.title}»: solo il ${num(d.approval, 0)}% è favorevole`, critical: `«${d.title}» bocciata dai cittadini: ${num(d.against, 0)}% contrari`, friendly: `«${d.title}»: i cittadini ancora scettici, ma ${num(d.undecided, 0)}% non ha deciso` },
      favorevoli: { neutral: `«${d.title}»: il ${num(d.approval, 0)}% approva`, critical: `«${d.title}» piace, ma restano i dubbi sui conti`, friendly: `«${d.title}» promossa dai cittadini: ${num(d.approval, 0)}% a favore` },
      divisi: { neutral: `«${d.title}»: opinione pubblica divisa (${num(d.approval, 0)}% a favore, ${num(d.against, 0)}% contro)`, critical: `«${d.title}» non convince: il Paese è spaccato`, friendly: `«${d.title}»: il Paese si divide, ma c’è spazio per spiegarla` }
    }[d.verdict];
    return { headline: headlines, deck: `${d.stageLabel}: ${num(d.approval, 0)}% favorevoli, ${num(d.against, 0)}% contrari, ${num(d.undecided, 0)}% indecisi (±${num(d.margin, 1)}).`, paragraphs: [`Secondo la media di quattro istituti simulati la legge «${d.title}» è ${verdict}: ${num(d.approval, 0)}% a favore, ${num(d.against, 0)}% contro, ${num(d.undecided, 0)}% senza opinione.`, best.length ? `Tra chi ha scelto, la apprezzano di più ${lower(best[0].label)} (${num(best[0].approval, 0)}%) e meno ${lower(worst[0].label)} (${num(worst[0].approval, 0)}%).` : '', `L’incertezza della stima è di ±${num(d.margin, 1)} punti, tra campione e modello: è un giudizio sul provvedimento, non un’intenzione di voto.`].filter(Boolean), facts: [['Favorevoli', `${num(d.approval, 0)}%`], ['Contrari', `${num(d.against, 0)}%`], ['Indecisi', `${num(d.undecided, 0)}%`], ['Margine', `±${num(d.margin, 1)}`]] };
  },
  mondo(fact) {
    const d = fact.data;
    return { headline: { neutral: d.title, critical: d.title, friendly: d.title }, deck: d.body, paragraphs: [d.body, ...(d.lines ?? []), ...(fact.reactions ?? []).map(item => `${item.actor}: ${lower(item.text)}`)].filter(Boolean), facts: (d.lines ?? []).slice(0, 2).map(line => ['Effetto', line]) };
  },
  opera(fact) {
    const d = fact.data;
    const delay = d.delayWeeks ? `${d.delayWeeks} settimane di ritardo` : 'tempi in regola';
    const headlines = {
      avvio: { neutral: `${d.title}: parte l’iter`, critical: `${d.title}: un cantiere da tenere d’occhio`, friendly: `${d.title}: il Governo avvia l’opera` },
      ritardo: { neutral: `${d.title}: ${d.delayWeeks} settimane di ritardo`, critical: `${d.title}, il cantiere si ferma ancora`, friendly: `${d.title}: ritardi, ma i lavori vanno avanti` },
      sforamento: { neutral: `${d.title}: costi oltre il previsto`, critical: `${d.title}, sforamento dei costi: chi paga?`, friendly: `${d.title}: il Governo valuta come coprire i maggiori costi` },
      fine: { neutral: `${d.title}: aperta l’opera`, critical: `${d.title} apre${d.delayWeeks ? ` dopo ${d.delayWeeks} settimane di ritardo` : ''}`, friendly: `Inaugurata l’opera: ${d.title}` },
      sospesa: { neutral: `${d.title}: lavori sospesi`, critical: `${d.title}, stop ai lavori: a rischio il territorio`, friendly: `${d.title}: sospesi i lavori, ricalcolo delle risorse` }
    }[d.stage];
    return { headline: headlines, deck: `${d.region}: ${d.stageLabel.toLowerCase()}, ${delay}.`, paragraphs: [`L’opera “${d.title}” (${d.region}) è in fase di ${d.stageLabel.toLowerCase()} al ${Math.round(d.progress)}%: ${delay}.`, d.stage === 'sforamento' ? `Il costo cresce di ${num(d.amount)} punti: il Governo deve scegliere se integrare, ridimensionare o sospendere.` : d.stage === 'fine' ? `I risultati sul territorio dipendono da qualità e ritardo accumulato${d.quality ? ` (qualità ${num(d.quality, 2)})` : ''}.` : d.stage === 'sospesa' ? 'Parte delle risorse impegnate torna al bilancio, ma i benefici attesi per il territorio svaniscono.' : '', d.callTitle ? `L’opera è cofinanziata dal bando europeo «${d.callTitle}».` : ''].filter(Boolean), facts: [['Avanzamento', `${Math.round(d.progress)}%`], ['Ritardo', `${d.delayWeeks ?? 0} settimane`], ['Costo', `${num(d.cost)} punti`]] };
  },
  conti(fact) {
    const d = fact.data;
    return { headline: { neutral: d.headline, critical: d.critical ?? d.headline, friendly: d.friendly ?? d.headline }, deck: d.deck, paragraphs: d.paragraphs, facts: d.facts };
  },
  elezione(fact) {
    const d = fact.data;
    const pct = Number.isFinite(d.percent) ? `${String(Math.round(d.percent * 10) / 10).replace('.', ',')}%` : null;
    const won = d.personalMandate;
    const what = d.national ? 'Elezioni politiche' : d.label ?? 'Elezioni';
    const head = won ? { neutral: `${what}: il tuo risultato${pct ? ` è del ${pct}` : ''} vale un mandato`, critical: `${what}: ${pct ? `${pct} e ` : ''}un mandato conquistato, ma restano le divisioni`, friendly: `${what}: successo${pct ? ` al ${pct}` : ''}, mandato conquistato` } : { neutral: `${what}: ${pct ? `${pct}, ` : ''}nessun mandato`, critical: `${what}: ${pct ? `${pct}, ` : ''}la candidatura non basta`, friendly: `${what}: ${pct ? `${pct}, ` : ''}il risultato non basta per il mandato` };
    return { headline: head, deck: d.outcomeLabel ?? fact.text, paragraphs: [`${d.label ?? 'Il voto'} si chiude${pct ? ` con il ${pct} per la tua candidatura` : ''}${d.seats ? ` e ${d.seats} ${d.seats === 1 ? 'seggio' : 'seggi'}` : ''}. ${won ? 'Il mandato personale è conquistato.' : 'Il mandato personale non è raggiunto.'}`, d.outcomeLabel ? `Esito: ${lower(d.outcomeLabel)}.` : '', d.objectiveMet === true ? 'L’obiettivo che ti eri dato è stato raggiunto.' : d.objectiveMet === false ? 'L’obiettivo che ti eri dato non è stato raggiunto.' : ''].filter(Boolean), facts: [['Elezione', d.label ?? '—'], ...(pct ? [['Risultato', pct]] : []), ...(d.seats ? [['Seggi', d.seats]] : []), ['Mandato', won ? 'conquistato' : 'non raggiunto']] };
  },
  attivita(fact) {
    const d = fact.data;
    const how = d.tone === 'bad' ? 'una prova difficile' : d.tone === 'good' ? 'una prova convincente' : 'una prova senza scossoni';
    const kind = { intervista: 'L’intervista', conferenza: 'La conferenza stampa', talk: 'L’ospitata televisiva', 'prima-serata': 'La prima serata', interrogazione: 'L’interrogazione' }[d.activity] ?? 'L’uscita pubblica';
    return { headline: { neutral: `${d.name}: ${lower(kind)} su ${d.topic}`, critical: d.tone === 'bad' ? `${d.name} in difficoltà su ${d.topic}` : `${d.name} parla di ${d.topic}: molte domande restano aperte`, friendly: d.tone === 'bad' ? `${d.name} su ${d.topic}: nonostante le critiche, tiene la linea` : `${d.name} su ${d.topic}: il punto di vista di ${d.party ?? 'una forza politica'}` }, deck: `${kind} di ${d.name} è stata ${how}; il tema è ${d.topic}${d.region ? ` e il territorio di riferimento è ${d.region}` : ''}.`, paragraphs: [`${kind} di ${d.name} ha messo al centro ${d.topic}. Secondo i resoconti simulati è stata ${how}.`, d.region ? `Il riferimento al territorio (${d.region}) ha dato concretezza agli argomenti.` : '', d.priority ? `Il tema era tra le priorità dichiarate del Governo.` : ''].filter(Boolean), facts: [['Esito', d.tone === 'good' ? 'positivo' : d.tone === 'bad' ? 'negativo' : 'neutro'], ['Tema', d.topic]] };
  }
};

// Entries of the parliamentary record that make news: how they read, what they weigh (importance 1–5), which story they open or feed.
const HISTORY = {
  'crisi-governo': { cat: 'governo', imp: 5, tone: 'bad', story: { kind: 'crisi', op: 'open', title: 'La crisi di governo' }, h: { neutral: 'Si apre la crisi di governo', critical: 'Crisi di governo: la maggioranza non regge', friendly: 'Crisi di governo: si cerca una via d’uscita' }, p: () => 'Senza un nuovo accordo si va alle consultazioni o al voto: gli alleati ora trattano.' },
  'crisi-spontanea': { cat: 'governo', imp: 5, tone: 'bad', story: { kind: 'crisi', op: 'open', title: 'La crisi di governo' }, h: { neutral: 'Tensioni nella maggioranza: scoppia la crisi', critical: 'La maggioranza si spacca: crisi aperta', friendly: 'Crisi nella maggioranza, il Governo cerca un chiarimento' } },
  'fiducia-negata': { cat: 'governo', imp: 5, tone: 'bad', story: { kind: 'crisi', op: 'open', title: 'La caduta del governo' }, h: { neutral: 'Il Governo perde la fiducia e cade', critical: 'Il Governo cade: fiducia negata', friendly: 'Fiducia negata: il Governo si ferma' } },
  'dimissioni-governo': { cat: 'governo', imp: 5, tone: 'bad', story: { kind: 'crisi', op: 'add', title: 'La crisi di governo' }, h: { neutral: 'Il Presidente del Consiglio si dimette', critical: 'Dimissioni: finisce il governo, si aprono le consultazioni', friendly: 'Il Presidente del Consiglio rimette il mandato' } },
  'verifica-maggioranza': { cat: 'governo', imp: 3, tone: 'neutral', story: { kind: 'crisi', op: 'add', title: 'La crisi di governo' }, h: { neutral: 'Verifica di maggioranza: il Governo rilancia il programma', critical: 'Verifica di maggioranza: rattoppo o rilancio?', friendly: 'Verifica di maggioranza: gli alleati ascoltati' } },
  'sostegno-esterno': { cat: 'governo', imp: 3, tone: 'good', story: { kind: 'crisi', op: 'add', title: 'La crisi di governo' }, h: { neutral: 'Nuovo sostegno esterno al Governo', critical: 'Sostegno esterno: il prezzo da pagare', friendly: 'Il Governo allarga i numeri con un sostegno esterno' } },
  'sostegno-negato': { cat: 'governo', imp: 3, tone: 'bad', story: { kind: 'crisi', op: 'add', title: 'La crisi di governo' }, h: { neutral: 'Il sostegno al Governo viene negato', critical: 'Il Governo cerca numeri e riceve un no', friendly: 'Un no sul sostegno: il Governo cerca altre strade' } },
  'fiducia-ottenuta': { cat: 'governo', imp: 4, tone: 'good', story: { kind: 'crisi', op: 'close', title: 'La crisi di governo', resolution: 'Il governo ottiene la fiducia delle Camere.' }, h: { neutral: 'Il Governo ottiene la fiducia', critical: 'Fiducia ottenuta: i numeri ci sono, ma quanto durano?', friendly: 'Fiducia alle Camere: il Governo può partire' } },
  rimpasto: { cat: 'governo', imp: 3, tone: 'neutral', h: { neutral: 'Rimpasto di governo: cambia un ministero', critical: 'Rimpasto: la poltrona come moneta di scambio', friendly: 'Rimpasto: il Governo si rafforza con un nuovo equilibrio' } },
  'nuovo-ministro': { cat: 'governo', imp: 2, tone: 'neutral', h: { neutral: 'Cambio al vertice di un ministero', critical: 'Si dimette un ministro: il Governo è costretto a rimpiazzarlo', friendly: 'Un nuovo ministro entra in carica' } },
  'accordo-firmato': { cat: 'governo', imp: 4, tone: 'neutral', h: { neutral: 'Firmato l’accordo di governo', critical: 'Accordo di governo: promesse con scadenza', friendly: 'Accordo di governo: impegni chiari con gli alleati' }, p: () => 'Ogni impegno ha una scadenza e un criterio verificabile: chi non lo rispetta ne risponde alla prossima trattativa.' },
  'accordo-concessione': { cat: 'governo', imp: 2, tone: 'neutral', h: { neutral: 'Concessione a un alleato di maggioranza', critical: 'Il prezzo della pace nella coalizione', friendly: 'Un gesto verso gli alleati' } },
  'accordo-risposta': { cat: 'governo', imp: 2, tone: 'neutral', h: { neutral: 'Risposta del Governo a un impegno dell’accordo', critical: 'Accordo di governo: il Governo prende tempo', friendly: 'Accordo di governo: il Governo risponde agli alleati' } },
  'decreto-adottato': { cat: 'parlamento', imp: 3, tone: 'neutral', h: { neutral: 'Il Consiglio dei ministri vara un decreto', critical: 'Un nuovo decreto: scorciatoia o urgenza?', friendly: 'Decreto del Governo: risposta rapida' } },
  'decreto-decaduto': { cat: 'parlamento', imp: 4, tone: 'bad', h: { neutral: 'Decade un decreto: non convertito in tempo', critical: 'Decreto decaduto: figuraccia per il Governo', friendly: 'Decreto decaduto: il Governo ci riprova' } },
  'legge-arenata': { cat: 'parlamento', imp: 2, tone: 'bad', h: { neutral: 'Si arena un disegno di legge', critical: 'Legge ferma: la maggioranza non ha i numeri', friendly: 'Una legge rallenta in commissione' } },
  'fiducia-posta': { cat: 'parlamento', imp: 3, tone: 'neutral', h: { neutral: 'Il Governo pone la questione di fiducia', critical: 'Fiducia sul testo: il Parlamento messo alle strette', friendly: 'Fiducia sul provvedimento: il Governo accelera' } },
  'dissenso-maggioranza': { cat: 'governo', imp: 3, tone: 'bad', h: { neutral: 'Dissenso nella maggioranza su un voto', critical: 'Franchi tiratori: la maggioranza si divide', friendly: 'Un voto difficile nella maggioranza' } },
  'cambio-maggioranza': { cat: 'governo', imp: 3, tone: 'neutral', h: { neutral: 'Cambiano i numeri della maggioranza', critical: 'Maggioranza in bilico dopo i cambi di gruppo', friendly: 'La maggioranza ridisegna i numeri' } },
  'vertice-maggioranza': { cat: 'governo', imp: 2, tone: 'neutral', h: { neutral: 'Vertice di maggioranza', critical: 'Vertice di maggioranza: fumata grigia?', friendly: 'Vertice di maggioranza: gli alleati al tavolo' } },
  'programma-bilancio': { cat: 'governo', imp: 3, tone: 'neutral', h: { neutral: 'Il Governo fa il bilancio del suo programma', critical: 'Programma di governo: quanto è stato fatto davvero?', friendly: 'Programma di governo: il bilancio delle priorità' } },
  'programma-governo': { cat: 'governo', imp: 2, tone: 'neutral', h: { neutral: 'Il Governo fissa il programma', critical: 'Il programma del Governo, tra priorità e promesse', friendly: 'Il Governo presenta le sue priorità' } }
};
const factFromHistory = (entry, ctx) => {
  const type = entry.type;
  if (type === 'iter-approved') return null;
  if (type === 'iter-rejected' || type === 'emendamento-respinto') {
    if (type !== 'iter-rejected') return null;
    const law = (ctx.parliament?.laws ?? []).find(item => item.id === entry.details?.lawId);
    return { key: `legge:${entry.details?.lawId ?? entry.id}:respinta`, kind: 'respinta', category: 'parlamento', importance: 3, tone: 'bad', week: ctx.week, date: entry.date, text: entry.text, data: { title: law?.title ?? 'il provvedimento', lawId: entry.details?.lawId ?? null }, story: law ? { kind: 'riforma', op: 'add', key: `legge:${law.id}`, title: law.title, stage: 'reazioni', text: `Respinta nella votazione finale.` } : null };
  }
  if (type === 'dossier-esito' || type === 'dossier-rinvio') {
    const d = entry.details ?? {};
    const outcome = type === 'dossier-rinvio' ? 'rinviato' : d.outcome;
    return { key: `storia:${entry.id}`, kind: 'dossier', category: 'governo', importance: outcome === 'fallito' ? 4 : outcome === 'riuscito' ? 3 : 2, tone: outcome === 'riuscito' ? 'good' : outcome === 'fallito' ? 'bad' : 'neutral', week: ctx.week, date: entry.date, text: entry.text, data: { ...d, outcome }, story: null };
  }
  const rule = HISTORY[type];
  if (!rule) return null;
  const governmentId = entry.details?.governmentId ?? ctx.parliament?.government?.id ?? 'governo';
  const story = rule.story ? { ...rule.story, key: `crisi:${governmentId}`, text: entry.text, stage: rule.story.op === 'close' ? 'esito' : type === 'crisi-governo' || type === 'crisi-spontanea' || type === 'fiducia-negata' ? 'apertura' : 'trattative' } : null;
  return { key: `storia:${entry.id}`, kind: 'governo', type, category: rule.cat, importance: rule.imp, tone: rule.tone, week: ctx.week, date: entry.date, text: entry.text, data: { type }, story };
};

// ---------- facts, from every system ----------
function collectFacts(media, ctx) {
  const facts = [];
  const history = ctx.parliament?.history ?? [];
  const at = media.cursor.historyId ? history.findIndex(item => item.id === media.cursor.historyId) : -1;
  const fresh = at >= 0 ? history.slice(at + 1) : history.slice(-8);
  // The laws applied are the richest source: the entry of the record only adds the Chamber that voted.
  const applied = new Map((ctx.lawsApplied ?? []).filter(item => item.lawId).map(item => [item.lawId, item]));
  for (const entry of fresh) {
    if (entry.type === 'iter-approved') {
      const summary = applied.get(entry.details?.lawId);
      const law = (ctx.parliament?.laws ?? []).find(item => item.id === entry.details?.lawId);
      if (!summary && law) facts.push(lawFact({ title: law.title, category: law.category, controversy: 0.4, covered: true, cost: law.policy?.cost ?? 0, billions: 0, origin: law.origin, lawId: law.id, week: ctx.week, date: entry.date }, ctx));
      continue;
    }
    const fact = factFromHistory(entry, ctx);
    if (fact) facts.push(fact);
  }
  for (const summary of (ctx.lawsApplied ?? []).filter(item => (item.week ?? 0) >= media.cursor.lawWeek)) facts.push(lawFact(summary, ctx));
  for (const event of (ctx.worldEvents ?? [])) {
    const fact = worldFact(event, ctx);
    if (fact) facts.push(fact);
  }
  for (const project of ctx.projects ?? []) facts.push(...projectFacts(project, ctx));
  facts.push(...financeFacts(ctx));
  for (const survey of ctx.surveys ?? []) facts.push(surveyFact(survey, media));
  for (const fact of ctx.extraFacts ?? []) facts.push(fact);
  // The votes the player took part in: the result of every election is news, a general election is breaking news.
  for (const election of ctx.elections ?? []) {
    if (!election?.key) continue;
    const national = election.type === 'politiche';
    facts.push({ key: `elezione:${election.key}`, kind: 'elezione', category: 'elezioni', importance: national ? RULES.breakingMin : 4, tone: election.personalMandate ? 'good' : 'bad', week: ctx.week, date: election.date ?? ctx.date, text: `Risultato: ${election.label}.`, data: { ...election, national } });
  }
  return facts.filter(Boolean);
}
// A survey on a law in force: the article, and a development of the law's story (opened when the verdict is against and nobody had contested it yet).
function surveyFact({ law, survey }, media) {
  const key = `legge:${law.lawId ?? law.title}`;
  const exists = media.stories.some(item => item.key === key);
  const opens = survey.verdict === 'contrari' && !exists;
  const text = `Sondaggio: ${num(survey.approval, 0)}% favorevoli, ${num(survey.against, 0)}% contrari (±${num(survey.margin, 1)}).`;
  const reactions = survey.verdict === 'contrari' ? [{ key: `sondaggio:${law.key}:${survey.stage}`, actor: 'Opposizione', side: 'opposizione', stance: 'attacca', text: 'Cita il sondaggio per chiedere di rivedere la legge.' }] : survey.verdict === 'favorevoli' ? [{ key: `sondaggio:${law.key}:${survey.stage}`, actor: 'Maggioranza', side: 'maggioranza', stance: 'rivendica', text: 'Rivendica il gradimento dei cittadini.' }] : [];
  return { key: `sondaggio:${law.key}:${survey.stage}`, kind: 'sondaggio', category: 'sondaggi', importance: survey.verdict === 'divisi' ? 2 : 4, tone: survey.verdict === 'contrari' ? 'bad' : survey.verdict === 'favorevoli' ? 'good' : 'neutral', week: survey.week, date: survey.date, text, data: { title: law.title, stageLabel: survey.label, approval: survey.approval, against: survey.against, undecided: survey.undecided, margin: survey.margin, verdict: survey.verdict, bySegment: survey.bySegment },
    story: { kind: 'riforma', op: opens ? 'open' : 'add', existing: !opens, key, title: law.title, stage: survey.stage === 'bilancio' ? 'primi risultati' : 'reazioni', text, heat: 50, reactions } };
}
function lawFact(summary, ctx) {
  const key = `legge:${summary.lawId ?? `${summary.title}|${summary.week}`}`;
  const contested = (summary.controversy ?? 0) >= 0.6 || (summary.losers ?? []).length >= 2 || summary.covered === false;
  return { key, kind: 'legge', category: summary.area === 'economia' || summary.area === 'fisco' || summary.area === 'finanze' ? 'economia' : 'parlamento', importance: contested ? 4 : 2, tone: (summary.covered === false || (summary.controversy ?? 0) >= 0.8) ? 'bad' : 'neutral', week: summary.week ?? ctx.week, date: summary.date ?? ctx.date, text: `Approvata “${summary.title}”.`, data: summary, story: contested ? { kind: 'riforma', op: 'open', key: `legge:${summary.lawId ?? summary.title}`, title: summary.title, stage: 'approvazione', text: `Approvata: costo ${num(summary.cost)} punti, controversia ${num(summary.controversy ?? 0, 2)}.`, heat: 40 + Math.round(clamp(summary.controversy ?? 0, 0, 1.6) * 30), reactions: ctx.reactionsFor?.(summary) ?? [] } : { kind: 'riforma', op: 'add', key: `legge:${summary.lawId ?? summary.title}`, title: summary.title, stage: 'approvazione', text: 'Approvata.', reactions: [] } };
}
const WORLD_CATEGORY = { scandal: 'inchieste', chart: 'economia', energy: 'economia', globe: 'economia', megaphone: 'politica', shield: 'politica', scales: 'politica', users: 'partito', flag: 'partito', link: 'partito', route: 'partito', dome: 'governo', alert: 'partito', storm: 'territorio', cross: 'territorio', factory: 'territorio', star: 'territorio', leaf: 'territorio' };
function worldFact(event, ctx) {
  // The laws have their own article (from the law applied or the record of the Chambers): the chronicle of the world does not tell them twice.
  if (event.week < ctx.week - 1 || event.kind === 'carriera' || event.kind === 'legge') return null;
  const category = WORLD_CATEGORY[event.icon] ?? 'politica';
  const chain = event.chain ?? null;
  const scandal = category === 'inchieste';
  const rule = WORLD_EVENTS.find(item => item.id === event.eventId) ?? null;
  const root = chain?.root ?? event.eventId ?? event.id;
  const rootKey = chain ? `caso:${root}:${event.partyId ?? ''}:${event.week - (chain.step ?? 0) * 2}` : `caso:${root}`;
  // What the parties say follows what the event does to the Government (the same numbers the polls use), never an invented quote.
  const reactions = [];
  if (rule?.executive < 0 && rule?.challengers > 0) reactions.push({ key: event.id, actor: 'Opposizione', side: 'opposizione', stance: 'attacca', text: 'Chiede conto al Governo e porta il tema in Aula.' });
  if (rule?.majority < 0) reactions.push({ key: event.id, actor: 'Maggioranza', side: 'maggioranza', stance: 'riserve', text: 'Si divide: parte degli alleati chiede chiarimenti.' });
  if (rule?.executive > 0 && rule?.challengers < 0) reactions.push({ key: event.id, actor: 'Maggioranza', side: 'maggioranza', stance: 'rivendica', text: 'Rivendica il risultato come frutto dell’azione di governo.' });
  const kind = scandal ? 'scandalo' : category === 'economia' ? 'economia' : category === 'territorio' ? 'territorio' : event.icon === 'scales' ? 'riforma' : 'vicenda';
  const lines = (event.lines ?? []).filter(line => !/^Effetti su chi/.test(line));
  return { key: `mondo:${event.id}`, kind: 'mondo', category, importance: scandal ? 4 : chain ? 3 : 2, tone: event.tone ?? 'neutral', week: event.week, date: event.date, text: event.body, local: event.scope === 'regionale' || event.scope === 'locale', data: { title: event.title, body: event.body, lines },
    reactions, story: scandal || chain ? { kind, op: !chain || (chain.step ?? 0) === 0 ? 'open' : 'add', key: rootKey, title: chain?.rootTitle ?? event.title, stage: scandal && (!chain || !chain.step) ? 'indiscrezione' : 'sviluppi', text: event.title, heat: scandal ? 60 : 45, reactions } : null };
}
const STAGE_LABELS = { progettazione: 'progettazione', gara: 'gara d’appalto', cantiere: 'cantiere', collaudo: 'collaudo', completato: 'completata', sospeso: 'sospesa' };
function projectFacts(project, ctx) {
  const base = { kind: 'opera', category: 'opere', local: true, week: ctx.week, date: ctx.date };
  const data = stage => ({ stage, title: project.title, region: project.region, stageLabel: STAGE_LABELS[project.stage] ?? project.stage, progress: project.progress ?? 0, delayWeeks: project.delayWeeks ?? 0, cost: project.cost ?? 0, amount: project.pending?.amount, quality: project.result?.quality, callTitle: project.callId ? (ctx.euCalls ?? []).find(call => call.id === project.callId)?.title ?? null : null });
  const story = (op, text, extra = {}) => ({ kind: 'opere', op, key: `opera:${project.id}`, title: project.title, stage: 'cantiere', text, heat: 35, ...extra });
  const out = [];
  if ((project.proposedWeek ?? -99) >= ctx.week - 1) out.push({ ...base, key: `opera:${project.id}:avvio`, importance: 2, tone: 'neutral', text: `Avviato l’iter di ${project.title}.`, data: data('avvio'), story: story('open', `Avviato l’iter: costo ${num(project.cost)} punti.`, { stage: 'progetto' }) });
  if ((project.delayWeeks ?? 0) >= 6 && project.stage !== 'completato' && project.stage !== 'sospeso') out.push({ ...base, key: `opera:${project.id}:ritardo:${Math.floor(project.delayWeeks / 6)}`, importance: 3, tone: 'bad', text: `${project.title}: ${project.delayWeeks} settimane di ritardo.`, data: data('ritardo'), story: story('add', `${project.delayWeeks} settimane di ritardo.`, { heat: 45 }) });
  if (project.pending?.kind === 'sforamento') out.push({ ...base, key: `opera:${project.id}:sforamento:${project.overruns ?? 0}`, importance: 4, tone: 'bad', text: `${project.title}: costi oltre il previsto.`, data: data('sforamento'), story: story('add', `Sforamento dei costi di ${num(project.pending.amount)} punti: il Governo deve decidere.`, { heat: 55 }) });
  if (project.stage === 'completato') out.push({ ...base, key: `opera:${project.id}:fine`, importance: 3, tone: (project.delayWeeks ?? 0) > 8 ? 'neutral' : 'good', text: `${project.title}: opera completata.`, data: data('fine'), story: story('close', `Opera completata con ${project.delayWeeks ?? 0} settimane di ritardo.`, { stage: 'esito', resolution: `Opera completata (qualità ${num(project.result?.quality ?? 1, 2)}).` }) });
  if (project.stage === 'sospeso') out.push({ ...base, key: `opera:${project.id}:sospesa`, importance: 3, tone: 'bad', text: `${project.title}: lavori sospesi.`, data: data('sospesa'), story: story('close', 'Lavori sospesi per decisione del Governo.', { stage: 'esito', resolution: 'Opera sospesa: parte delle risorse è tornata al bilancio.' }) });
  return out;
}
function financeFacts(ctx) {
  const finance = ctx.finance;
  if (!finance) return [];
  const out = [];
  const quarter = Math.floor(ctx.week / 13);
  if (finance.euStatus === 'procedura') out.push({ key: `conti:procedura:${quarter}`, kind: 'conti', category: 'economia', importance: 5, tone: 'bad', week: ctx.week, date: ctx.date, text: 'Procedura per deficit eccessivo.', data: { headline: 'Bruxelles apre la procedura per deficit eccessivo', critical: 'Procedura europea sui conti: il Governo ha sforato', friendly: 'Procedura europea: il Governo tratta con Bruxelles', deck: `Lo spread è a ${Math.round(finance.spread)} punti base e il margine di bilancio si riduce.`, paragraphs: [`La Commissione europea contesta il deficit: la procedura limita il margine di manovra e pesa sui mercati (spread ${Math.round(finance.spread)}).`, `Il margine di bilancio disponibile è ${num(finance.headroom, 0)} punti su 100.`], facts: [['Spread', `${Math.round(finance.spread)} punti`], ['Margine', `${num(finance.headroom, 0)}/100`]] }, story: { kind: 'economia', op: 'open', key: `conti:${ctx.year}`, title: 'I conti e la procedura europea', stage: 'allarme', text: 'Procedura per deficit eccessivo.', heat: 65 } });
  else if (finance.spread > 220) out.push({ key: `conti:spread:${quarter}`, kind: 'conti', category: 'economia', importance: 4, tone: 'bad', week: ctx.week, date: ctx.date, text: 'Spread alto.', data: { headline: `Spread a ${Math.round(finance.spread)}: i mercati osservano l’Italia`, critical: `Spread a ${Math.round(finance.spread)}: i mercati presentano il conto`, friendly: `Spread a ${Math.round(finance.spread)}: il Governo rassicura i mercati`, deck: 'Il costo del debito sale: ogni nuova spesa pesa di più.', paragraphs: [`Il differenziale con i titoli tedeschi arriva a ${Math.round(finance.spread)} punti base.`, `Il margine di bilancio è ${num(finance.headroom, 0)}/100: ogni nuova misura va coperta.`], facts: [['Spread', `${Math.round(finance.spread)} punti`], ['Margine', `${num(finance.headroom, 0)}/100`]] }, story: { kind: 'economia', op: 'open', key: `conti:${ctx.year}`, title: 'Conti pubblici e mercati', stage: 'allarme', text: `Spread a ${Math.round(finance.spread)}.`, heat: 50 } });
  const lost = finance.eu?.lost ?? 0;
  if (lost > 0) out.push({ key: `eu:perdita:${Math.round(lost)}`, kind: 'conti', category: 'opere', importance: 4, tone: 'bad', week: ctx.week, date: ctx.date, text: 'Fondi europei persi.', data: { headline: `Fondi europei persi: ${num(lost)} punti non spesi`, critical: 'Fondi europei lasciati a Bruxelles', friendly: 'Fondi europei: il Governo recupera dove può', deck: 'Scadenze mancate o rendicontazioni in ritardo costano risorse al Paese.', paragraphs: [`Finora sono andati persi ${num(lost)} punti di fondi europei per scadenze o rendicontazioni mancate.`], facts: [['Persi', `${num(lost)} punti`]] }, story: null });
  return out;
}

// ---------- publishing ----------
function touchStory(media, spec, week, date, outletId) {
  let story = media.stories.find(item => item.key === spec.key);
  if (!story) {
    if (spec.op === 'close' || spec.existing || spec.op === 'add' && !spec.title) return null;
    const open = media.stories.filter(item => item.status === 'aperta');
    if (open.length >= RULES.storiesOpen) { const coldest = open.sort((a, b) => a.heat - b.heat)[0]; closeStory(coldest, week, 'Archiviata per fare spazio a vicende più calde.'); }
    story = { id: `storia-${spec.key.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}-${media.seq}`, key: spec.key, kind: spec.kind, title: spec.title, status: 'aperta', openedWeek: week, openedDate: date, updatedWeek: week, heat: spec.heat ?? RULES.heatStart, stage: spec.stage ?? STORY_KINDS[spec.kind]?.stages[0] ?? 'apertura', outletId, timeline: [], reactions: [], resolution: null, source: RULES.source };
    media.stories.unshift(story);
  }
  if (story.status !== 'aperta') return null;
  story.updatedWeek = week;
  story.heat = clamp(Math.max(story.heat, spec.heat ?? 0) + (spec.op === 'add' ? 8 : 0), 0, RULES.heatMax);
  if (spec.stage) story.stage = spec.stage;
  return story;
}
function closeStory(story, week, text) {
  story.status = 'chiusa'; story.closedWeek = week; story.heat = Math.min(story.heat, RULES.closeBelow);
  story.resolution = story.resolution ?? { week, text };
}
export function publishFact(mediaIn, fact, ctx) {
  const media = mediaIn;
  if (media.seen.includes(fact.key)) return media;
  const outlet = pickOutlet(media, fact);
  const edge = edgeOf(outlet, ctx.govAxis ?? 0);
  const built = BUILDERS[fact.kind]?.(fact, ctx);
  if (!built) return media;
  media.seq += 1;
  const story = fact.story ? touchStory(media, fact.story, fact.week, fact.date, outlet.id) : null;
  const paragraphs = []; let used = 0;
  for (const paragraph of built.paragraphs) { if (used + paragraph.length > RULES.bodyMax && paragraphs.length) break; paragraphs.push(paragraph); used += paragraph.length; }
  // Breaking news is rare: only a fact that weighs enough, and one a week.
  const breaking = (fact.importance ?? 0) >= RULES.breakingMin && !media.articles.some(item => item.breaking && item.week === fact.week);
  const article = { id: `articolo-${fact.week}-${media.seq}`, key: fact.key, week: fact.week, date: fact.date, outletId: outlet.id, outlet: outlet.name, category: fact.category, headline: pickVariant(built.headline, edge), deck: built.deck, body: paragraphs, facts: built.facts.map(([label, value]) => ({ label, value: String(value) })), tone: fact.tone, importance: fact.importance, edge, storyId: story?.id ?? null, kind: fact.kind, region: fact.data?.region ?? fact.region ?? null, breaking, source: RULES.source };
  media.articles = [article, ...media.articles].slice(0, RULES.articlesKept);
  media.seen = [...media.seen, fact.key].slice(-RULES.seenKept);
  if (story) {
    if (!story.timeline.some(item => item.key === fact.key)) story.timeline = [...story.timeline, { key: fact.key, week: fact.week, date: fact.date, text: fact.story.text ?? article.headline, tone: fact.tone, articleId: article.id, stage: story.stage }].slice(-RULES.timelineKept);
    for (const reaction of fact.story.reactions ?? []) if (!story.reactions.some(item => item.actor === reaction.actor && item.key === reaction.key)) story.reactions = [...story.reactions, { ...reaction, week: fact.week }].slice(-RULES.reactionsKept);
    if (fact.story.op === 'close') closeStory(story, fact.week, fact.story.resolution ?? 'Chiusa.');
    if (fact.story.resolution && fact.story.op === 'close') story.resolution = { week: fact.week, text: fact.story.resolution };
  }
  return media;
}

// ---------- the week of the newsroom ----------
// ctx: { week, date, year, parliament, govAxis, gov: { name, stability, margin, groups, external }, lawsApplied, worldEvents, projects, euCalls, finance, reactionsFor(summary) }.
const compareText = (a, b) => { const x = String(a ?? ''), y = String(b ?? ''); return x < y ? -1 : x > y ? 1 : 0; };
export function newsroomWeek(societyIn, ctx) {
  if (!societyIn?.media) return societyIn;
  const media = normalizeMedia(copy(societyIn.media));
  media.coverage = societyIn.media.coverage;
  // What does not fit in this week's six is not lost (the history cursor moves on): it waits, ranked with the new facts, for a few weeks.
  const fresh = collectFacts(media, ctx).filter(item => !media.seen.includes(item.key)), waiting = media.pending.filter(item => item?.key && (item.week ?? 0) >= ctx.week - RULES.backlogWeeks && !media.seen.includes(item.key) && !fresh.some(other => other.key === item.key));
  // A total order, also for facts with the same key (the same week, the same importance): what is written first never depends on the order they were collected in.
  const order = (a, b) => b.importance - a.importance || (a.week ?? 0) - (b.week ?? 0) || compareText(a.key, b.key) || compareText(a.kind, b.kind) || compareText(a.text, b.text) || compareText(JSON.stringify(a.data ?? null), JSON.stringify(b.data ?? null));
  const ranked = [...fresh, ...waiting].sort(order).filter((item, index, list) => list.findIndex(other => other.key === item.key) === index);
  for (const fact of ranked.slice(0, 6)) publishFact(media, fact, ctx);
  media.pending = ranked.slice(6, 6 + RULES.backlogKept);
  const history = ctx.parliament?.history ?? [];
  if (history.length) media.cursor.historyId = history.at(-1).id;
  media.cursor.lawWeek = Math.max(media.cursor.lawWeek, ctx.week);
  storiesWeek(media, ctx);
  radioWeek(media, ctx);
  return { ...societyIn, media };
}
function storiesWeek(media, ctx) {
  const week = ctx.week;
  for (const story of media.stories.filter(item => item.status === 'aperta')) {
    story.heat = clamp(story.heat - RULES.heatDecay, 0, RULES.heatMax);
    const outlet = media.outlets.find(item => item.id === story.outletId);
    // A rumour is confirmed or denied after a few weeks: the more credible the outlet that broke it, the likelier it was right.
    if (story.kind === 'scandalo' && !story.resolved && week - story.openedWeek >= RULES.rumourWeeks[0] + Math.floor(unit(story.key, 'attesa') * (RULES.rumourWeeks[1] - RULES.rumourWeeks[0] + 1))) {
      const confirmed = unit(story.key, 'esito') < RULES.confirmBase + RULES.confirmPerCredibility * (outlet?.credibility ?? 50) / 100;
      story.resolved = confirmed ? 'confermata' : 'smentita';
      story.stage = 'esito';
      const text = confirmed ? `Gli accertamenti confermano la ricostruzione di ${outlet?.name ?? 'un quotidiano'}.` : `Le verifiche smentiscono l’indiscrezione di ${outlet?.name ?? 'un quotidiano'}: nessun elemento a carico.`;
      story.timeline = [...story.timeline, { key: `esito:${story.key}`, week, date: ctx.date, text, tone: confirmed ? 'bad' : 'good', stage: 'esito' }].slice(-RULES.timelineKept);
      if (outlet) outlet.credibility = clamp(outlet.credibility + (confirmed ? RULES.credibility.confirmed : RULES.credibility.denied), RULES.credibility.min, RULES.credibility.max);
      if (confirmed) story.heat = clamp(story.heat + 20, 0, RULES.heatMax); else closeStory(story, week, text);
    }
    if (story.status === 'aperta' && story.heat < RULES.closeBelow && week - story.updatedWeek >= RULES.quietWeeks) closeStory(story, week, story.resolved === 'confermata' ? 'La vicenda si chiude con le conferme già note.' : 'Nessun nuovo sviluppo: la vicenda esce dalle prime pagine.');
  }
  const closed = media.stories.filter(item => item.status === 'chiusa');
  if (closed.length > RULES.storiesArchived) { const drop = new Set(closed.sort((a, b) => (a.closedWeek ?? 0) - (b.closedWeek ?? 0)).slice(0, closed.length - RULES.storiesArchived).map(item => item.id)); media.stories = media.stories.filter(item => !drop.has(item.id)); }
  for (const outlet of media.outlets) if (Number.isFinite(outlet.baseCredibility)) outlet.credibility = round1(clamp(outlet.credibility + (outlet.baseCredibility - outlet.credibility) * RULES.credibility.revert, RULES.credibility.min, RULES.credibility.max));
}
// An article of the player's own work in public (an interview, a press conference, a talk show). Written when the activity is done, once.
export function activityArticle(societyIn, data, ctx) {
  if (!societyIn?.media) return societyIn;
  const media = normalizeMedia(copy(societyIn.media));
  media.coverage = societyIn.media.coverage;
  publishFact(media, { key: `attivita:${data.activity}:${data.week}:${data.name}:${data.topic}`, kind: 'attivita', category: 'politica', importance: 2, tone: data.tone ?? 'neutral', week: data.week, date: data.date, text: '', outletHint: data.outletId, data }, ctx);
  return { ...societyIn, media };
}

// ---------- the radio of LA POLITICA 24 ----------
// Every week a bulletin and the columns that have something to say, written from the articles of the week (and, for the polls, from the figures the game has): nothing is invented, every
// item points to the article it comes from. A week with nothing to say has no bulletin.
function radioWeek(media, ctx) {
  const week = ctx.week;
  media.radio ??= { seq: 0, bulletins: [] };
  if (media.radio.bulletins.some(item => item.week === week)) return;
  const articles = media.articles.filter(item => item.week === week).sort((a, b) => (b.breaking ? 1 : 0) - (a.breaking ? 1 : 0) || (b.importance ?? 0) - (a.importance ?? 0) || compareText(a.id, b.id));
  const item = article => ({ articleId: article.id, headline: article.headline, outlet: article.outlet, category: article.category, storyId: article.storyId ?? null, breaking: Boolean(article.breaking), tone: article.tone });
  const make = (programme, items, intro, extra = {}) => { media.radio.seq += 1; media.radio.bulletins.unshift({ id: `radio-${week}-${programme}`, seq: media.radio.seq, week, date: ctx.date, programme, label: RADIO_PROGRAMMES[programme].label, slot: RADIO_PROGRAMMES[programme].slot, intro, items, ...extra, source: RULES.source }); };
  if (articles.length) make('notiziario', articles.slice(0, RADIO_RULES.itemsPerBulletin).map(item), articles.some(entry => entry.breaking) ? 'Edizione straordinaria in apertura, poi le altre notizie della settimana.' : `Ecco le notizie della settimana ${week}.`);
  const poll = ctx.pollLine;
  if (poll && Number.isFinite(poll.share)) make('sondaggi', [], `${poll.label}: ${String(Math.round(poll.share * 10) / 10).replace('.', ',')}% nell’ultima rilevazione${Number.isFinite(poll.delta) && poll.delta ? `, ${poll.delta > 0 ? 'in crescita di' : 'in calo di'} ${String(Math.abs(Math.round(poll.delta * 10) / 10)).replace('.', ',')} punti` : ', in linea con la settimana scorsa'}.`, { figures: [{ label: poll.label, share: poll.share, delta: poll.delta ?? 0 }], pollWeek: poll.week ?? week });
  const local = articles.filter(entry => ['territorio', 'opere'].includes(entry.category)).slice(0, RADIO_RULES.itemsPerColumn);
  if (local.length) make('territorio', local.map(item), 'Dai territori e dai cantieri.');
  const palace = articles.filter(entry => ['parlamento', 'governo', 'elezioni'].includes(entry.category)).slice(0, RADIO_RULES.itemsPerColumn);
  if (palace.length) make('palazzo', palace.map(item), 'Dal Parlamento, dal Governo e dalle urne.');
  media.radio.bulletins = media.radio.bulletins.slice(0, RADIO_RULES.bulletinsKept);
}
// The articles the Home may show: recent, not yet read, and about the career (the player's own work, the party, the elections, the territory, the Parliament for those who sit in it).
export function relevantArticles(media, { week, region = null, seat = false, limit = 3 } = {}) {
  if (!media) return [];
  const score = article => {
    let value = article.importance ?? 1;
    if (article.breaking) value += 3;
    if (article.kind === 'attivita') value += 3;
    if (['elezioni', 'partito', 'sondaggi'].includes(article.category)) value += 2;
    if (['territorio', 'opere'].includes(article.category)) value += region && article.region === region ? 2 : 0;
    if (seat && ['parlamento', 'governo'].includes(article.category)) value += 1;
    return value;
  };
  return media.articles.filter(item => !item.homeSeen && item.week >= week - 2).map(item => ({ item, value: score(item) })).filter(entry => entry.value >= 4).sort((a, b) => b.value - a.value || b.item.week - a.item.week || compareText(a.item.id, b.item.id)).slice(0, limit).map(entry => entry.item);
}
// The weekly pop-up of the newsroom: at most one a week (media.popup.week remembers the week already looked at, whether or not there was anything to say), at most three articles, only recent news
// about the career that were never in a pop-up before and that do not repeat each other (one per story, one per headline). Returns { week, articles } and the media to keep, or null when the week was
// already looked at. The articles stay in the archive and on the Home; the pop-up only points at them.
export const POPUP_RULES = Object.freeze({ limit: 3, keep: 80 });
export function weeklyPopup(societyIn, { week, region = null, seat = false } = {}) {
  if (!societyIn?.media || !Number.isFinite(week) || societyIn.media.popup?.week === week) return null;
  const media = normalizeMedia(copy(societyIn.media));
  const shown = new Set(media.popup?.ids ?? []);
  const fresh = relevantArticles({ ...media, articles: media.articles.filter(item => !shown.has(item.id)) }, { week, region, seat, limit: 12 });
  const taken = new Set(), articles = [];
  for (const item of fresh) {
    const keys = [item.storyId ? `storia:${item.storyId}` : null, `titolo:${String(item.headline ?? '').trim().toLowerCase()}`].filter(Boolean);
    if (keys.some(key => taken.has(key))) continue;
    keys.forEach(key => taken.add(key));
    articles.push(item);
    if (articles.length >= POPUP_RULES.limit) break;
  }
  media.popup = { week, ids: [...(media.popup?.ids ?? []), ...articles.map(item => item.id)].slice(-POPUP_RULES.keep) };
  return { week, articles, society: { ...societyIn, media } };
}
// Marks articles as read on the Home (they are not shown there again); the archive keeps them.
export function markHomeSeen(societyIn, ids) {
  if (!societyIn?.media) return societyIn;
  const wanted = new Set(ids);
  const media = normalizeMedia(copy(societyIn.media));
  media.coverage = societyIn.media.coverage;
  media.articles = media.articles.map(item => wanted.has(item.id) ? { ...item, homeSeen: true } : item);
  return { ...societyIn, media };
}
