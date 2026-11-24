// Gender and look of the characters, across the game. Before the fix the wizard kept the avatar apart from the gender («the face does not depend on the gender»): a woman could keep a masculine face and a
// beard; saved careers kept such looks; an avatar given to a scene character was drawn as it was, whatever the gender. Checked:
//   1. the rule (core/avatar.js avatarForGender): the face follows the gender, a woman has no beard, no moustache, no receding hairline; skin, hair, eyes, glasses, jacket, expression and proportions stay;
//      with no gender known nothing is changed (no feature attributed to a person whose gender the data do not give);
//   2. the random look of the wizard follows the gender (300 draws each);
//   3. a career created as a woman with a masculine avatar and a beard: the player's look takes the feminine base, the other choices stay;
//   4. an old save (gender «donna», masculine face, beard, moustache): set right when loaded, without losing the other choices; a man's look is untouched;
//   5. the characters of the scenes: the guests of every kind of encounter (face = gender of the name and of the role), the rival and the host of a debate even when an avatar is given;
//   6. the real politicians: their verified data give no gender, their avatar is not changed by this rule.
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const A = await import(new URL(`../src/core/avatar.js?v=${build}`, import.meta.url).href);
const S = await import(new URL(`../src/core/activity-scenes.js?v=${build}`, import.meta.url).href);
const E = await import(new URL(`../src/core/scene-engine.js?v=${build}`, import.meta.url).href);
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
const KEEP = ['skin', 'hair', 'eyes', 'glasses', 'jacket', 'expression'];
const male = { ...A.DEFAULT_AVATAR, face: 'maschile', beard: 'completa', moustache: 'folti', hairstyle: 'stempiato', skin: 'oliva', hair: 'rosso', glasses: 'tondi', jacket: 'verde', shape: { w: 2, j: -1 } };
// 1. the rule
{
  const woman = A.avatarForGender(male, 'donna');
  check(woman.face === 'femminile' && woman.beard === 'nessuna' && woman.moustache === 'nessuno' && woman.hairstyle !== 'stempiato', `Donna: volto femminile, senza barba, baffi e stempiatura (${JSON.stringify(woman)}).`);
  check(KEEP.every(field => woman[field] === A.normalizeAvatar(male)[field]) && woman.shape?.w === 2, 'Donna: le altre scelte restano.');
  const man = A.avatarForGender({ ...male, face: 'femminile' }, 'uomo');
  check(man.face === 'maschile' && man.beard === 'completa' && man.moustache === 'folti', 'Uomo: volto maschile, barba e baffi scelti restano.');
  const unknown = A.avatarForGender(male, null);
  check(JSON.stringify(unknown) === JSON.stringify(A.normalizeAvatar(male)), 'Genere non noto: l’avatar resta com’è.');
}
// 2. random looks
for (const gender of ['uomo', 'donna']) {
  let rng = 7; const rand = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
  for (let n = 0; n < 300; n++) { const look = A.randomAvatar(rand, { gender }); const ok = gender === 'donna' ? look.face === 'femminile' && look.beard === 'nessuna' && look.moustache === 'nessuno' && look.hairstyle !== 'stempiato' : look.face === 'maschile'; if (!ok) { problems.push(`Avatar casuale per ${gender} incoerente (${JSON.stringify(look)}).`); break; } }
}
// 3. a career created as a woman with a masculine avatar
{
  const { store } = await startCareer({ seed: 'avatar-donna', level: 'comunale', fast: true, draft: { gender: 'donna', avatar: male } });
  const s = store.getState();
  const player = s.dataset.politicians.find(item => item.id === s.career.playerId);
  const look = A.avatarOf(player);
  check(look.face === 'femminile' && look.beard === 'nessuna' && look.moustache === 'nessuno', `La carriera di una donna ha un avatar femminile (${JSON.stringify(look)}).`);
  check(look.skin === 'oliva' && look.hair === 'rosso' && look.glasses === 'tondi' && look.jacket === 'verde', 'Le personalizzazioni scelte restano (pelle, capelli, occhiali, giacca).');
  // 4. an old save: the stored avatar of a woman with the masculine face and a beard
  const saved = JSON.parse(store.exportSave());
  const record = saved.dataset.politicians.find(item => item.id === saved.career.playerId);
  record.avatar = { ...male }; record.gender = 'donna';
  store.loadGame(saved);
  const reloaded = store.getState().dataset.politicians.find(item => item.id === saved.career.playerId);
  check(reloaded.avatar.face === 'femminile' && reloaded.avatar.beard === 'nessuna' && reloaded.avatar.moustache === 'nessuno', `Vecchio salvataggio: l’avatar della giocatrice prende la base femminile (${JSON.stringify(reloaded.avatar)}).`);
  check(reloaded.avatar.skin === 'oliva' && reloaded.avatar.hair === 'rosso' && reloaded.avatar.shape?.w === 2, 'Vecchio salvataggio: le altre personalizzazioni restano.');
  // a man's look is untouched
  const savedMan = JSON.parse(store.exportSave());
  const manRecord = savedMan.dataset.politicians.find(item => item.id === savedMan.career.playerId);
  manRecord.gender = 'uomo'; manRecord.avatar = { ...male };
  store.loadGame(savedMan);
  const man = store.getState().dataset.politicians.find(item => item.id === savedMan.career.playerId).avatar;
  check(man.face === 'maschile' && man.beard === 'completa' && man.moustache === 'folti', 'Vecchio salvataggio di un uomo: barba e baffi restano.');
  // 6. the real politicians: no gender in the verified data, no change
  const real = store.getState().dataset.politicians.filter(item => item.source === 'real' || item.verified).slice(0, 80);
  check(real.every(item => item.gender == null ? JSON.stringify(A.avatarOf(item)) === JSON.stringify(A.avatarForGender(A.avatarOf(item), null)) : true), 'Politici reali senza genere nei dati: nessun tratto attribuito.');
}
// 5. the characters of the scenes
{
  let guests = 0;
  for (const sceneKey of Object.keys(S.ACTIVITY_SCENES ?? {})) {
    const activityId = S.ACTIVITY_SCENES[sceneKey].activityIds?.[0] ?? sceneKey;
    for (let n = 0; n < 40; n++) {
      const scene = S.createActivityScene({ id: `g-${sceneKey}-${n}`, seed: `genere|${sceneKey}|${n}`, sceneKey, activityId, player: { name: 'Prova' }, playerAvatar: null });
      for (const guest of [...scene.cast.filter(item => item.role !== 'giocatore'), ...(scene.extras ?? [])]) {
        guests++;
        const named = A.genderOf({ name: guest.name });
        if (guest.avatar.face !== guest.gender) { problems.push(`${sceneKey}: ${guest.name} (${guest.roleLabel}) ha genere ${guest.gender} e volto ${guest.avatar.face}.`); continue; }
        if (named && named !== guest.gender) problems.push(`${sceneKey}: il nome ${guest.name} non è del genere ${guest.gender}.`);
        if (guest.gender === 'femminile' && (guest.avatar.beard !== 'nessuna' || guest.avatar.moustache !== 'nessuno')) problems.push(`${sceneKey}: ${guest.name} ha barba o baffi.`);
      }
    }
  }
  check(guests > 500, `Personaggi delle scene verificati (${guests}).`);
  // a debate: a rival with a woman's name and a masculine avatar given
  const debate = E.createDebateScene({ id: 'g', seed: 'g', player: { name: 'Anna Rossi' }, playerAvatar: null, rival: { id: 'r', name: 'Giulia Bianchi', avatar: male, partyId: 'p' }, host: { id: 'h', name: 'Marco Valenti' }, topic: { id: 'lavoro', label: 'Lavoro' } });
  const rival = debate.cast.find(item => item.role === 'rivale'), host = debate.cast.find(item => item.role === 'conduttore');
  check(rival.avatar.face === 'femminile' && rival.avatar.beard === 'nessuna', `Dibattito: la rivale Giulia Bianchi ha un avatar femminile (${rival.avatar.face}, barba ${rival.avatar.beard}).`);
  check(host.avatar.face === 'maschile', 'Dibattito: il conduttore Marco Valenti ha un avatar maschile.');
}
if (problems.length) { console.error(`Genere e aspetto — problemi:\n- ${[...new Set(problems)].slice(0, 20).join('\n- ')}`); process.exit(1); }
console.log('Genere e aspetto verificati: regola unica (volto del genere, niente barba/baffi/stempiatura per le donne, le altre scelte restano, nessun tratto attribuito senza genere), avatar casuali coerenti, carriera e vecchi salvataggi normalizzati senza perdere le personalizzazioni, personaggi di tutte le scene, rivali e conduttori coerenti, politici reali senza genere nei dati invariati.');
