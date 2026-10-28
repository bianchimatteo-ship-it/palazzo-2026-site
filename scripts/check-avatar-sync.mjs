// The avatar of the character travels with the career. It is part of the player's record (`avatar`, next to `gender`) inside the save, so every way a career moves keeps it: the save in the
// browser and its reload, the file export/import, and the career online (upload from one device, download on another, history). A career made before avatars gets the same stable default on
// every device. There is no separate avatar tied to the account profile (the account service stores credentials, saves and logos only): the test says so by checking the account record and
// the service routes. Local Worker stand-ins, nothing real is touched.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const realFetch = globalThis.fetch;
const { startCareer } = await import('./lib/long-run.mjs');
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const avatarModule = await import(`../src/core/avatar.js${v}`);
const { startLocalWorker } = await import('./lib/local-worker.mjs');
globalThis.location = new URL('http://127.0.0.1:8791/');
const client = await import(`../src/data/repositories/account-sync.js${v}`);

const CUSTOM = { face: 'femminile', skin: 'oliva', hair: 'rosso', hairstyle: 'ondulato', beard: 'nessuna', glasses: 'tondi', jacket: 'prugna', eyes: 'verdi', expression: 'determinata', moustache: 'nessuno' };
const run = await startCareer({ seed: 'avatar-sync', level: 'comunale', fast: true, draft: { avatar: CUSTOM } });
const { store } = run;
const playerOf = state => state.dataset.politicians.find(item => item.id === state.career.playerId);
assert.deepEqual(playerOf(store.getState()).avatar, CUSTOM, 'L’avatar scelto è nel record del personaggio.');
assert.ok(avatarModule.isValidAvatar(playerOf(store.getState()).avatar));

// ---- the file export and import of the career ----
store.advance(7);
const exported = JSON.parse(store.exportSave());
assert.deepEqual(playerOf(exported).avatar, CUSTOM, 'L’avatar è nel file di esportazione.');
store.loadGame(JSON.parse(JSON.stringify(exported)));
assert.deepEqual(playerOf(store.getState()).avatar, CUSTOM, 'E si ritrova dopo l’importazione.');

// ---- the save in the browser and the reload ----
store.save();
const reloaded = (await import(`../src/core/store.js${v}&avatar=${Date.now()}`)).store.getState();
assert.deepEqual(playerOf(reloaded).avatar, CUSTOM, 'Dopo il ricaricamento della pagina l’avatar è lo stesso.');

// ---- the career online: one device uploads, another downloads ----
const local = await startLocalWorker({ port: 8791 });
globalThis.fetch = realFetch;
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true, writable: true });   // (the long-run harness seeds the ids; the account proof needs the real one)
try {
  const proof = await client.passwordProof('profilo.a', 'password-di-prova');
  const register = await realFetch(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.200' }, body: JSON.stringify({ username: 'profilo.a', proof }) });
  assert.equal(register.status, 201);
  const session = await register.json();
  globalThis.localStorage.setItem('politicando.account.v1', JSON.stringify({ username: 'profilo.a', token: session.token }));
  const state = JSON.parse(store.exportSave());
  const slot = client.slotForCareer(state.career.id);
  await client.uploadSave(slot, state, { name: 'Avatar', meta: { player: 'Avatar' }, create: true });
  // the second device: a copy of nothing but what the service sends
  const down = await client.downloadSave(slot, { commit: false });
  assert.deepEqual(playerOf(down.state).avatar, CUSTOM, 'L’avatar arriva intatto sul secondo dispositivo.');
  assert.equal(JSON.stringify(playerOf(down.state)), JSON.stringify(playerOf(state)), 'E con lui tutto il record del personaggio.');
  // a later change on the first device (another look) travels too, and the history keeps the earlier one
  const changed = JSON.parse(JSON.stringify(state));
  playerOf(changed).avatar = { ...CUSTOM, hairstyle: 'rasato', glasses: 'nessuno', jacket: 'cammello' };
  changed.clock = { ...changed.clock }; changed.game.week = { ...changed.game.week, index: changed.game.week.index + 1 };
  await client.uploadSave(slot, changed, { meta: { week: changed.game.week.index } });
  const second = await client.downloadSave(slot, { commit: false });
  assert.equal(playerOf(second.state).avatar.hairstyle, 'rasato', 'Il nuovo aspetto è quello online.');
  const history = await client.listSaveHistory(slot);
  assert.ok(history.length >= 1);
  const earlier = await client.downloadHistoryVersion(slot, history.at(-1).id);
  assert.deepEqual(playerOf(earlier.state).avatar, CUSTOM, 'La cronologia online conserva l’aspetto di prima.');
  // loading it on the second device gives the same character
  globalThis.fetch = run.fetchShim ?? globalThis.fetch;
  store.loadGame(second.state);
  assert.equal(playerOf(store.getState()).avatar.hairstyle, 'rasato');
  // the account service holds no avatar of its own
  const me = await (await realFetch(`${local.origin}/api/account/me`, { headers: { authorization: `Bearer ${session.token}` } })).json();
  assert.ok(!JSON.stringify(me).toLowerCase().includes('avatar'), 'Il profilo dell’account non ha un avatar a parte da sincronizzare.');
  const route = await realFetch(`${local.origin}/api/avatar`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.ok([404, 405].includes(route.status), 'E il servizio non ha una rotta per gli avatar.');
} finally { await local.close(); }

// ---- a career made before avatars: the same default on every device, and a stale trait is completed ----
const legacy = JSON.parse(store.exportSave());
delete playerOf(legacy).avatar;
store.loadGame(JSON.parse(JSON.stringify(legacy)));
const first = playerOf(store.getState()).avatar ?? avatarModule.avatarOf(playerOf(store.getState()));
store.loadGame(JSON.parse(JSON.stringify(legacy)));
assert.deepEqual(avatarModule.avatarOf(playerOf(store.getState())), avatarModule.avatarOf(playerOf(store.getState())));
assert.deepEqual(avatarModule.avatarOf(playerOf(store.getState())), avatarModule.defaultAvatarFor(playerOf(store.getState()).id), 'Una carriera senza avatar riceve sempre lo stesso aspetto stabile, ovunque la si carichi.');
void first;
const partial = JSON.parse(store.exportSave());
playerOf(partial).avatar = { face: 'femminile', skin: 'scura', hair: 'nero', hairstyle: 'corto', beard: 'nessuna', glasses: 'nessuno', jacket: 'blu' };
store.loadGame(partial);
const completed = playerOf(store.getState()).avatar;
assert.ok(avatarModule.isValidAvatar(completed) && completed.skin === 'scura' && completed.eyes, 'Un avatar salvato con meno tratti si completa senza perdere le scelte fatte.');
console.log('Avatar insieme alla carriera: salvataggio e ricaricamento, esportazione e importazione del file, carriera online da un dispositivo all’altro (anche nella cronologia), aspetto stabile per le carriere senza avatar, tratti mancanti completati; nessun avatar a parte legato al profilo dell’account.');
process.exit(0);
