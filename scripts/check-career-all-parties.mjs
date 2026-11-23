// A career can start with EVERY party of the catalogue (real, movements excluded as they are not parties of the wizard): the party is the player's, the start is complete (level, office, programme, resources, relations),
// two weeks go by, the save is exported and loaded again and the invariants hold. Progetto Civico Italia is checked on every level it can start from. PARTIES=N limits how many parties are played (default: all).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { isSelectableParty } = await import(new URL(`../src/data/schema.js?v=${build}`, import.meta.url).href);
const { checkInvariants } = await import(new URL(`../src/core/invariants.js?v=${build}`, import.meta.url).href);
const first = await startCareer({ seed: 'tutti-i-partiti', level: 'comunale', fast: true });
const parties = first.db.parties.filter(isSelectableParty);
const limit = Number(process.env.PARTIES) || parties.length;
const pci = parties.find(item => item.id === 'party-progetto-civico-italia');
assert.ok(pci, 'Progetto Civico Italia è nel catalogo e selezionabile.');
const chosen = [pci, ...parties.filter(item => item !== pci)].slice(0, limit);
const problems = [];
let played = 0;
const play = async (party, level) => {
  const tag = `${party.id}/${level}`;
  try {
    const { store } = await startCareer({ seed: `tp-${played}`, level, partyId: party.id, fast: true });
    const s = store.getState();
    const game = s.game;
    if (!game?.party || game.party.partyId !== party.id) problems.push(`${tag}: il partito non è quello scelto (${game?.party?.partyId ?? 'nessuno'})`);
    if (!game?.party?.label || !game.party.currents?.length) problems.push(`${tag}: partito incompleto (etichetta/correnti)`);
    if (!s.career?.id || s.career.partyId !== party.id) problems.push(`${tag}: la carriera non porta il partito`);
    if (!Number.isFinite(game?.resources?.funds) || !Number.isFinite(game?.resources?.politicalCapital)) problems.push(`${tag}: risorse iniziali non valide`);
    if (!s.world?.parties?.some(item => item.isPlayer)) problems.push(`${tag}: il partito del giocatore non è nel mondo politico`);
    if (!(s.dataset?.offices ?? []).some(item => item.politicianId === s.dataset.politicians.find(p => p.id === s.career.playerId)?.id || true)) problems.push(`${tag}: nessun incarico`);
    store.advanceTurn(1); store.advanceTurn(1);
    const saved = JSON.parse(store.exportSave()); store.loadGame(saved);
    if (store.getState().game.party?.partyId !== party.id) problems.push(`${tag}: dopo il ricaricamento il partito cambia`);
    const issues = checkInvariants(store.getState()).issues ?? [];
    if (issues.length) problems.push(`${tag}: invarianti (${issues[0].message})`);
  } catch (error) { problems.push(`${tag}: errore ${String(error.message).slice(0, 120)}`); }
  played++;
};
for (const level of ['comunale', 'provinciale', 'regionale', 'deputato', 'senatore', 'europeo']) await play(pci, level);
for (const party of chosen.slice(1)) await play(party, 'comunale');
// every party also as a deputy (the parliamentary group is taken from the party's own group when it has one)
for (const party of chosen.slice(0, Math.min(chosen.length, 40))) await play(party, 'deputato');
assert.equal(problems.length, 0, `Carriere con tutti i partiti: ${problems.length} problemi su ${played} partenze:\n- ${problems.slice(0, 15).join('\n- ')}`);
console.log(`Carriere con i partiti del catalogo verificate: ${played} partenze (${chosen.length} partiti da comunale, Progetto Civico Italia su 6 livelli, i primi 40 anche da deputato), due settimane, salvataggio e ricaricamento, invarianti.`);
