// The ways to stand for an election without the party's own list (simulation rules of the game, on a reduced scale: the numbers are game units, not the legal thresholds):
//   partito       the list of the player's party (the default of a member)
//   indipendente  a person alone, with no list: possible only where the vote is for a person (a comune, a single-member constituency)
//   lista-civica  a civic list built around the player: local votes (comune, province, region)
//   movimento     a political movement of his own: every kind of vote that has lists, the hardest road
//   alleanza      the support of an alliance: an agreement with a party of the world, negotiated, that lends its quota
// Each way has its own requirements (committee, volunteers, signatures, funds, negotiation) and its own effect on the support the candidate starts the campaign with. The preparation is a
// state of the career (game.candidacyPrep): it is built by actions that cost days, funds and capital, and it is saved with the career. Nothing here touches the vote engine: the effect is a
// factor on the support of the player in the territories of the campaign (applied once, by the store, when the campaign opens).
export const ROUTES = Object.freeze({
  partito: { label: 'Lista del partito', short: 'La lista del tuo partito: nessuna preparazione, ma serve l’iscrizione.' },
  indipendente: { label: 'Candidato indipendente', short: 'Ti candidi da solo: conta la tua persona, non ci sono liste né partito che ti sostengono.' },
  'lista-civica': { label: 'Lista civica', short: 'Costruisci una lista attorno a te con comitato, volontari e firme: forte dove sei radicato.' },
  movimento: { label: 'Movimento politico', short: 'Fondi un movimento: parti da zero, serve una base molto più ampia, ma resta tuo.' },
  alleanza: { label: 'Con il sostegno di un’alleanza', short: 'Un accordo con un partito del mondo politico che ti presta il suo consenso: va trattato e ha un prezzo.' }
});
// What each kind of vote allows for someone with no party (never invented: where it is not allowed the reason is told).
const ALLOWED = Object.freeze({
  comunale: { indipendente: true, 'lista-civica': true, movimento: true, alleanza: true },
  provinciale: { indipendente: 'Il consiglio provinciale è eletto dai consiglieri e dai sindaci dei comuni: non ci sono candidature di persone sole.', 'lista-civica': true, movimento: 'Il voto provinciale è di secondo livello: non si presentano movimenti, solo liste di consiglieri.', alleanza: true },
  regionale: { indipendente: 'Alle Regionali si concorre in una lista: una persona sola non può presentarsi.', 'lista-civica': true, movimento: true, alleanza: true },
  politiche: { indipendente: true, 'lista-civica': 'Per il Parlamento le liste civiche locali non bastano: serve un movimento o un accordo.', movimento: true, alleanza: true },
  europee: { indipendente: 'Alle Europee si concorre con una lista nazionale: una persona sola non può presentarsi.', 'lista-civica': 'Per il Parlamento europeo le liste civiche locali non bastano: serve un movimento o un accordo.', movimento: true, alleanza: true }
});
// Requirements (game units): signatures, volunteers, funds; `committee` the committee of the candidate; `deal` the agreement with a party.
const BASE = Object.freeze({
  comunale: { small: { signatures: 40, volunteers: 5, funds: 400 }, large: { signatures: 150, volunteers: 15, funds: 1500 } },
  provinciale: { any: { signatures: 0, volunteers: 3, funds: 600 } },
  regionale: { any: { signatures: 400, volunteers: 40, funds: 6000 } },
  politiche: { any: { signatures: 250, volunteers: 30, funds: 4000 } },
  europee: { any: { signatures: 900, volunteers: 80, funds: 12000 } }
});
const ROUTE_SCALE = Object.freeze({ indipendente: { signatures: 1, volunteers: 1, funds: 1 }, 'lista-civica': { signatures: 1.4, volunteers: 1.5, funds: 1.3 }, movimento: { signatures: 2, volunteers: 2.5, funds: 2 }, alleanza: { signatures: 0, volunteers: 0.5, funds: 0.5 } });
export function requirementsOf(route, electionType, band = 'any') {
  const table = BASE[electionType];
  if (!table || !ROUTE_SCALE[route]) return null;
  const base = table[electionType === 'comunale' ? (band === 'oltre-15000' ? 'large' : 'small') : 'any'];
  const scale = ROUTE_SCALE[route];
  return { signatures: Math.round(base.signatures * scale.signatures), volunteers: Math.round(base.volunteers * scale.volunteers), funds: Math.round(base.funds * scale.funds), committee: route !== 'alleanza', deal: route === 'alleanza' };
}
// The ways open to the player for one kind of vote, each with its requirements or the reason why it is closed.
export function routesFor({ electionType, band = 'any', member = false }) {
  const allowed = ALLOWED[electionType] ?? {};
  if (member) return [{ id: 'partito', ...ROUTES.partito, available: true, reason: null, requirements: null }];
  return ['indipendente', 'lista-civica', 'movimento', 'alleanza'].map(id => {
    const rule = allowed[id];
    return { id, ...ROUTES[id], available: rule === true, reason: rule === true || rule === undefined ? (rule === undefined ? 'Questo tipo di voto non è previsto dalle regole del gioco.' : null) : rule, requirements: rule === true ? requirementsOf(id, electionType, band) : null };
  });
}
export const newPrep = ({ route, electionType, electionId = null, band = 'any', week = 0 }) => ({ route, electionType, electionId, band, startedWeek: week, committee: false, volunteers: 0, supporters: 0, signatures: 0, raised: 0, deal: null, filed: false, log: [] });
// What is still missing for the route (empty when the lists can be filed).
export function missingOf(prep) {
  if (!prep) return ['Scegli prima come ti candidi.'];
  const need = requirementsOf(prep.route, prep.electionType, prep.band);
  if (!need) return ['Modalità non valida.'];
  const out = [];
  if (need.committee && !prep.committee) out.push('Costituisci il comitato elettorale.');
  if (prep.volunteers < need.volunteers) out.push(`Servono ${need.volunteers} volontari (ne hai ${prep.volunteers}).`);
  if (prep.signatures < need.signatures) out.push(`Servono ${need.signatures} firme (ne hai ${prep.signatures}).`);
  if (prep.raised < need.funds) out.push(`Servono ${need.funds} € raccolti per la campagna (ne hai ${prep.raised}).`);
  if (need.deal && prep.deal?.status !== 'accettato') out.push(prep.deal?.status === 'rifiutato' ? 'L’accordo è stato rifiutato: tratta con un altro partito.' : 'Chiudi l’accordo con un partito.');
  return out;
}
// The actions of the preparation: what they cost and what they give. `power`: the player's notoriety (0–100) and relation with the party for the deal; `roll`: a number in [0,1) from the game's own generator.
export const PREP_ACTIONS = Object.freeze({
  comitato: { label: 'Costituisci il comitato', cost: { ap: 1, funds: 300 }, once: true },
  volontari: { label: 'Recluta volontari', cost: { ap: 1, funds: 100 } },
  firme: { label: 'Raccogli firme', cost: { ap: 1, funds: 50 }, needs: 'committee' },
  sostenitori: { label: 'Cerca sostenitori sul territorio', cost: { ap: 1, funds: 0 } },
  fondi: { label: 'Raccogli fondi per la campagna', cost: { ap: 1, funds: 0 } },
  accordo: { label: 'Tratta con un partito', cost: { ap: 1, capital: 4 }, needs: 'deal' },
  liste: { label: 'Presenta le liste', cost: { ap: 1, funds: 200 } }
});
export function applyPrepAction(prep, action, { notoriety = 20, relation = 0, partner = null, roll = 0.5 } = {}) {
  const spec = PREP_ACTIONS[action];
  if (!spec) throw new Error('Azione non valida.');
  const next = JSON.parse(JSON.stringify(prep));
  const need = requirementsOf(next.route, next.electionType, next.band);
  const strength = 0.6 + roll * 0.8 + Math.min(1, notoriety / 100) * 0.6;   // 0.6 … 2.0
  let line;
  if (action === 'comitato') { if (next.committee) throw new Error('Il comitato c’è già.'); if (!need.committee) throw new Error('Questa modalità non richiede un comitato.'); next.committee = true; line = 'Costituito il comitato elettorale.'; }
  else if (action === 'volontari') { const n = Math.max(1, Math.round(4 * strength)); next.volunteers += n; line = `Reclutati ${n} volontari (totale ${next.volunteers}).`; }
  else if (action === 'sostenitori') { const n = Math.max(2, Math.round(10 * strength)); next.supporters += n; line = `Trovati ${n} sostenitori sul territorio (totale ${next.supporters}).`; }
  else if (action === 'firme') {
    if (!need.signatures) throw new Error('Questa modalità non richiede firme.');
    if (!next.committee) throw new Error('Per raccogliere le firme serve il comitato.');
    if (next.volunteers < 1) throw new Error('Senza volontari non si raccolgono firme: reclutane prima.');
    const n = Math.max(3, Math.round(next.volunteers * 2.2 * strength)); next.signatures += n; line = `Raccolte ${n} firme (totale ${next.signatures}).`;
  } else if (action === 'fondi') { const n = Math.round((150 + next.supporters * 20) * strength); next.raised += n; line = `Raccolti ${n} € (totale ${next.raised} €).`; }
  else if (action === 'accordo') {
    if (!need.deal) throw new Error('Questa modalità non prevede un accordo con un partito.');
    if (!partner) throw new Error('Scegli con quale partito trattare.');
    const chance = Math.max(0.1, Math.min(0.85, 0.25 + notoriety / 250 + relation / 250));
    const ok = roll < chance;
    next.deal = { partnerId: partner.id, partnerLabel: partner.label, share: partner.share ?? 0, status: ok ? 'accettato' : 'rifiutato', chance: Math.round(chance * 100) };
    line = ok ? `${partner.label} accetta di sostenere la tua candidatura.` : `${partner.label} rifiuta (probabilità stimata ${Math.round(chance * 100)}%).`;
  } else if (action === 'liste') {
    const missing = missingOf(next);
    if (missing.length) throw new Error(`Le liste non si possono presentare: ${missing[0]}`);
    next.filed = true; line = 'Liste presentate: la candidatura è pronta.';
  }
  next.log = [...(next.log ?? []).slice(-11), line];
  return { prep: next, cost: spec.cost, line };
}
// The factor on the support of the player in the territories when the campaign opens: base of the route and kind of vote, scaled by how much of the requirement was built (volunteers) and by the
// weight of the partner of an alliance. Where the player is rooted (his own comune or region) the factor is higher; elsewhere lower for a civic list or a movement.
export function routeFactor(prep, { home = false, partnerShare = 0 } = {}) {
  if (!prep || prep.route === 'partito') return 1;
  const need = requirementsOf(prep.route, prep.electionType, prep.band);
  const built = need?.volunteers ? Math.min(1.4, Math.max(0.5, prep.volunteers / need.volunteers)) : 1;
  const type = prep.electionType;
  const base = { indipendente: type === 'comunale' ? (prep.band === 'oltre-15000' ? 0.92 : 1.1) : 0.6, 'lista-civica': type === 'regionale' ? 0.9 : 1.05, movimento: 0.72, alleanza: 1 + Math.min(0.14, (prep.deal?.share ?? partnerShare) / 150) }[prep.route] ?? 1;
  const reach = ['lista-civica', 'movimento'].includes(prep.route) ? (0.85 + 0.3 * Math.min(1, built)) * (home ? 1.12 : 0.94) : (home ? 1.05 : 0.97);
  return Math.round(base * reach * 1000) / 1000;
}
// What the route does to the campaign, said before it starts.
export function routeEffects(route, electionType, band = 'any') {
  const f = routeFactor({ route, electionType, band, volunteers: requirementsOf(route, electionType, band)?.volunteers ?? 0, deal: { share: 10 } }, { home: true });
  return `Effetto atteso sul sostegno di partenza: ${f >= 1 ? '+' : ''}${Math.round((f - 1) * 100)}% dove sei radicato, meno altrove.`;
}
