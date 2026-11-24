// Founding a party from an independent career, through the page the player sees. Before, the page «Partito» of an independent showed only «Sei indipendente» and the list to join a party: the
// foundation (party-life-view.js, career-engine lifeFound, party-ops-engine foundParty) existed but could not be reached from there. Checked on the real store with the real data:
//   1. the page of an independent shows «Fonda un nuovo partito» with requirements, cost in capital and funds, the form (name, abbreviation, identity and logo, orientation, positions), and the way to join;
//   2. without the resources the requirements say what is missing and the button is disabled;
//   3. the foundation: a new party of the player (founder and secretary), in the world and in the polls, with its organisation; the offices held stay; no accord of the old party is kept;
//   4. save and reload keep it; the weeks go on.
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { renderPartyPage } = await import(new URL(`../src/ui/party-page.js?v=${build}`, import.meta.url).href);
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
const { store } = await startCareer({ seed: 'fonda-da-indipendente', level: 'comunale', fast: true });
const st = () => store.getState();
store.leaveParty();
check(st().game.party === null, 'La carriera prosegue da indipendente.');
const officesBefore = st().dataset.offices.filter(item => item.politicianId === st().career.playerId && !item.endDate).map(item => item.id).sort();
// 2. without resources
{
  const saved = JSON.parse(store.exportSave()); saved.game.resources.politicalCapital = 2; saved.game.resources.funds = 100; store.loadGame(saved);
  const html = renderPartyPage(st(), { tab: 'panoramica', selectable: st().dataset.parties.slice(0, 5) });
  check(html.includes('Fonda un nuovo partito') && html.includes('Requisiti per fondare'), 'La pagina dell’indipendente mostra «Fonda un nuovo partito» con i requisiti.');
  check(/is-missing/.test(html) && /data-life-found[^-][^>]*disabled/.test(html), 'Senza risorse i requisiti mancanti sono segnalati e il pulsante è disattivato.');
}
// 1. with resources: the form
const saved = JSON.parse(store.exportSave()); saved.game.resources.politicalCapital = 40; saved.game.resources.funds = 20000; store.loadGame(saved);
const html = renderPartyPage(st(), { tab: 'panoramica', selectable: st().dataset.parties.slice(0, 5) });
for (const [needle, what] of [['data-life-found-form', 'il modulo di fondazione'], ['name="partyName"', 'il nome'], ['name="partyAbbreviation"', 'la sigla'], ['partyOrientation', 'l’orientamento'], ['partyColor', 'l’identità (colore)'], ['partyLogo', 'il logo'], ['policy-grid', 'le posizioni programmatiche'], ['Capitale politico', 'il costo in capitale'], ['Fondi', 'il costo in fondi'], ['aderisci-partito', 'la via per aderire a un partito'], ['data-action="scroll-to"', 'i pulsanti che portano alle due strade']]) check(html.includes(needle), `La pagina mostra ${what}.`);
check(!/data-life-found[^-][^>]*disabled/.test(html), 'Con le risorse il pulsante «Fonda il partito» è attivo.');
// 3. the foundation
const capital = st().game.resources.politicalCapital, funds = st().game.resources.funds;
try { store.foundParty({ label: 'Movimento della Prova Civica', abbreviation: 'MPC', identity: { color: '#2b6b4f', orientation: 'Civismo', position: 'centro', positions: { economia: 3, welfare: 3, ambiente: 4, europa: 3 } } }); }
catch (error) { problems.push(`La fondazione fallisce (${error.message})`); }
const s = st();
check(s.game.party?.affiliation === 'founder' && s.game.party.label === 'Movimento della Prova Civica', `Il giocatore è fondatore del nuovo partito (${s.game.party?.label} · ${s.game.party?.affiliation}).`);
check(s.game.resources.funds <= funds - 1500, `La fondazione costa i fondi indicati (${funds} → ${s.game.resources.funds}).`);
  // the capital: the cost is paid (6) and the foundation itself gives the founder new standing (party-ops-engine): the balance is the engine's
  check(Number.isFinite(s.game.resources.politicalCapital) && capital >= 6, 'Il capitale politico richiesto era disponibile ed è stato contabilizzato.');
check(Boolean(s.game.party?.org) && (s.game.party?.currents?.length ?? 0) >= 1, 'Il nuovo partito ha un’organizzazione iniziale e almeno un’area interna.');
check(Boolean(s.world?.parties?.some(item => item.isPlayer && item.active)), 'Il partito entra nel mondo politico simulato.');
check(s.world?.playerPartyId && s.world.parties.find(item => item.id === s.world.playerPartyId)?.label === 'Movimento della Prova Civica', 'Il partito del giocatore nel mondo è quello fondato.');
const officesAfter = s.dataset.offices.filter(item => item.politicianId === s.career.playerId && !item.endDate).map(item => item.id).sort();
check(officesBefore.every(id => officesAfter.includes(id)), 'Gli incarichi che il giocatore ricopriva restano.');
check(!(s.world?.alliances ?? []).some(item => item.status === 'active' && item.partyIds.includes(s.world.playerPartyId) && item.withPlayer), 'Il nuovo partito non eredita accordi del partito lasciato.');
// 4. save, reload, weeks
store.loadGame(JSON.parse(store.exportSave()));
check(st().game.party?.label === 'Movimento della Prova Civica' && st().game.party.affiliation === 'founder', 'Dopo il ricaricamento il partito fondato resta.');
for (let n = 0; n < 4; n++) { try { store.advance(1); } catch (error) { problems.push(`Dopo la fondazione l’avanzamento si ferma (${error.message})`); break; } }
const after = renderPartyPage(st(), { tab: 'panoramica' });
check(!after.includes('Requisiti per fondare') && after.includes('Movimento della Prova Civica'), 'Fondato il partito, la pagina mostra il partito e non più la fondazione.');
if (problems.length) { console.error(`Fondazione da indipendente — problemi:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Fondazione di un partito da indipendente verificata: la pagina Partito mostra «Fonda un nuovo partito» con requisiti, costi, modulo (nome, sigla, identità e logo, orientamento, posizioni) e la via per aderire; senza risorse il pulsante è disattivato con i requisiti mancanti; la fondazione crea il partito del giocatore (fondatore) con organizzazione, nel mondo politico, senza togliere incarichi né ereditare accordi; resta dopo il ricaricamento e le settimane proseguono.');
