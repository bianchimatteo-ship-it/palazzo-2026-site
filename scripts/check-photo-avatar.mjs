// The avatar made from a photograph: the photo becomes an ILLUSTRATED character of the game (the structured choices of core/avatar.js drawn by ui/avatar-svg.js), not a filtered picture.
//   1. The reading (ui/photo-traits.js), on synthetic portraits with known traits (scripts/lib/synthetic-face.mjs: NOT real photos): hair colour and length, glasses, beard, moustache, skin within
//      one step, at three lights; the gender is never read (a feminine face never gets a beard); the corrections of the player survive a new reading; the kinds of file (JPEG, PNG, WebP, HEIC, GIF).
//   2. In Chrome, end to end: wizard → «Crea l’avatar da una foto» → a file that is not a photo refused with the reason → the photo (long black hair, glasses) read → the drawing shows them at once →
//      a correction by hand (round glasses, a jacket) kept through a new reading → «Usa questo avatar» → the career created with that avatar → Home and Profile draw it → an animated scene draws the
//      player with it → nothing photographic in the save of the career, the reduced photo only on the device → close and reopen the game → the profile's «Modifica l’avatar» opens on the saved choices
//      and the kept photo → a change saved again → after another reload it is still there.
// The physical camera and the native pickers of Android/iOS are not reachable from here: they are declared as not verified.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';
import { paintFace, pngOf, downscale } from './lib/synthetic-face.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const T = await import(new URL(`../src/ui/photo-traits.js?v=${build}`, import.meta.url).href);
const P = await import(new URL(`../src/ui/photo-avatar.js?v=${build}`, import.meta.url).href);
const OUT = new URL('../docs/qa/screenshots/final/', import.meta.url).pathname; await mkdir(OUT, { recursive: true });

// ---- 1. the reading
const SKIN_ORDER = ['porcellana', 'chiara', 'oliva', 'bruna', 'scura'];
const cases = [
  { name: 'capelli lunghi neri e occhiali', paint: { skin: 'chiara', hair: 'nero', length: 'lungo', glasses: true }, masculine: false, want: { hair: 'nero', hairstyle: ['lungo', 'ondulato'], glasses: 'rettangolari', beard: 'nessuna' } },
  { name: 'corti castani e barba', paint: { skin: 'oliva', hair: 'castano', length: 'corto', beard: 'completa' }, masculine: true, want: { hair: 'castano', hairstyle: ['corto'], glasses: 'nessuno', beard: ['completa', 'corta'] } },
  { name: 'caschetto biondo', paint: { skin: 'porcellana', hair: 'biondo', length: 'caschetto' }, masculine: false, want: { hair: 'biondo', hairstyle: ['caschetto'], glasses: 'nessuno' } },
  { name: 'rasato con baffi', paint: { skin: 'scura', hair: 'nero', length: 'rasato', moustache: true }, masculine: true, want: { hairstyle: ['rasato'], glasses: 'nessuno', moustache: ['classici', 'folti'], beard: 'nessuna' } },
  { name: 'grigi, occhiali e pizzetto', paint: { skin: 'bruna', hair: 'grigio', length: 'corto', glasses: true, beard: 'pizzetto' }, masculine: true, want: { hair: 'grigio', hairstyle: ['corto'], glasses: 'rettangolari', beard: ['pizzetto'] } },
  { name: 'lunghi rossi', paint: { skin: 'chiara', hair: 'rosso', length: 'lungo' }, masculine: false, want: { hair: 'rosso', hairstyle: ['lungo', 'ondulato'], glasses: 'nessuno' } }
];
const table = [];
for (const item of cases) for (const light of [0.92, 1, 1.1]) for (const seed of [3, 7]) {
  const px = downscale(paintFace({ ...item.paint, size: 256, light, seed }), 256, T.ANALYSIS_SIZE);
  const reading = T.analyzeFace(px, T.ANALYSIS_SIZE, { masculine: item.masculine });
  const got = reading.traits;
  for (const [field, expected] of Object.entries(item.want)) assert.ok([expected].flat().includes(got[field]), `${item.name} (luce ${light}, seme ${seed}): ${field} = ${got[field]}, atteso ${[expected].flat().join(' o ')}.`);
  assert.ok(Math.abs(SKIN_ORDER.indexOf(got.skin) - SKIN_ORDER.indexOf(item.paint.skin)) <= 1, `${item.name} (luce ${light}): carnagione ${got.skin} entro un passo da ${item.paint.skin}.`);
  if (!item.masculine) assert.ok(got.beard === 'nessuna' && got.moustache === 'nessuno', `${item.name}: un volto femminile non riceve barba o baffi.`);
  if (light === 1 && seed === 7) table.push(`${item.name}: ${['skin', 'hair', 'hairstyle', 'glasses', 'beard', 'moustache'].map(field => got[field] ?? '—').join(' · ')}`);
}
// the glasses, on many synthetic portraits: a decided reading is NEVER wrong (no glasses invented on a bare face, none missed on a framed one); what cannot be told (eyes under a fringe, a band of shadow) is left to the player
{
  const variants = { chiara: {}, 'sopracciglia folte': { heavyBrows: true }, 'riflesso sulle lenti': { glare: true }, 'montatura tonda': { round: true }, 'montatura sottile': { thinRims: true }, 'frangia sugli occhi': { eyeFringe: true }, 'ombra sugli occhi': { shadow: 0.3 }, 'luce da un lato': { sideLight: 0.25 } };
  const mustDecide = new Set(['chiara', 'sopracciglia folte', 'riflesso sulle lenti', 'montatura tonda', 'montatura sottile']);
  const stats = {}; let wrong = 0, decided = 0, total = 0;
  for (const [variant, extra] of Object.entries(variants)) for (const skin of SKIN_ORDER) for (const hair of ['nero', 'castano', 'biondo', 'grigio']) for (const light of [0.75, 1, 1.15]) for (const glasses of [false, true]) {
    if (glasses === false && (extra.glare || extra.round || extra.thinRims)) continue;
    const reading = T.analyzeFace(downscale(paintFace({ size: 256, skin, hair, length: 'corto', glasses, light, seed: 3, ...extra }), 256, T.ANALYSIS_SIZE), T.ANALYSIS_SIZE, { masculine: true });
    const r = reading.readings.glasses, key = `${variant}/${glasses ? 'con' : 'senza'}`; total++;
    stats[key] ??= { deciso: 0, incerto: 0 };
    if (r.value == null) { stats[key].incerto++; assert.ok(!('glasses' in reading.traits), `${key}: una lettura incerta non assegna gli occhiali.`); assert.ok(!mustDecide.has(variant), `${key} (${skin}, ${hair}, luce ${light}): caso chiaro lasciato incerto.`); continue; }
    stats[key].deciso++; decided++;
    if (glasses !== (r.value !== 'nessuno')) { wrong++; assert.fail(`${key} (${skin}, ${hair}, luce ${light}): occhiali ${r.value} ${glasses ? 'non riconosciuti' : 'assegnati a chi non li porta'}.`); }
  }
  assert.equal(wrong, 0); assert.ok(decided / total > 0.7, `Casi decisi: ${decided}/${total}.`);
  // eyebrows, a fringe and a shadow alone never make glasses: the same portrait without glasses stays «nessuno» or uncertain
  const bare = T.analyzeFace(downscale(paintFace({ size: 256, skin: 'chiara', hair: 'nero', glasses: false, heavyBrows: true, eyeFringe: true, seed: 3 }), 256, T.ANALYSIS_SIZE), T.ANALYSIS_SIZE, { masculine: true });
  assert.notEqual(bare.traits.glasses, 'rettangolari'); assert.notEqual(bare.traits.glasses, 'tondi');
  // the gender chosen in the wizard is not touched by the reading, and the beards of different cut are not confused with shadow
  for (const [beard, light] of [['nessuna', 0.75], ['nessuna', 1.15], ['completa', 0.85], ['pizzetto', 1]]) {
    const reading = T.analyzeFace(downscale(paintFace({ size: 256, skin: 'oliva', hair: 'nero', beard, light, seed: 5 }), 256, T.ANALYSIS_SIZE), T.ANALYSIS_SIZE, { masculine: true });
    const value = reading.traits.beard; assert.ok(value == null || (beard === 'nessuna' ? value === 'nessuna' : value !== 'nessuna'), `Barba ${beard} (luce ${light}) letta come «${value}».`);
  }
  console.log('Occhiali su ritratti sintetici:', JSON.stringify(stats), `${wrong} errori su ${decided} letture decise.`);
}
// a photo with no face in the guide: nothing is invented
{ const px = new Uint8ClampedArray(T.ANALYSIS_SIZE * T.ANALYSIS_SIZE * 4).map((_, i) => i % 4 === 3 ? 255 : 90 + (i % 7) * 20); const r = T.analyzeFace(px, T.ANALYSIS_SIZE); assert.equal(r.readings.skin.confidence, 'non-visibile', 'Senza un volto nella guida la carnagione è «non visibile».'); assert.ok(!r.traits.glasses && !r.traits.beard, 'Senza un volto non si inventano occhiali o barba.'); }
// the corrections of the player survive a new reading; the gender decides the face
{
  const reading = { traits: { hair: 'biondo', glasses: 'rettangolari', beard: 'completa' } };
  const out = P.avatarFromReading({ face: 'femminile', glasses: 'tondi', jacket: 'verde' }, reading, { gender: 'donna', manual: new Set(['glasses']), corrections: { glasses: 'tondi' } });
  assert.equal(out.glasses, 'tondi', 'La correzione a mano resta dopo una nuova lettura.'); assert.equal(out.hair, 'biondo'); assert.equal(out.beard, 'nessuna', 'Donna: nessuna barba anche se la lettura la propone.'); assert.equal(out.face, 'femminile'); assert.equal(out.jacket, 'verde', 'Ciò che la foto non mostra resta com’era.');
}
// the kinds of file
const head = (...bytes) => new Uint8Array([...bytes, ...new Array(16).fill(0)]).slice(0, 16);
assert.equal(P.sniffPhoto(head(0xff, 0xd8, 0xff, 0xe0)), 'jpeg'); assert.equal(P.sniffPhoto(head(0x89, 0x50, 0x4e, 0x47)), 'png');
assert.equal(P.sniffPhoto(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'webp'); assert.equal(P.sniffPhoto(new TextEncoder().encode('\0\0\0\x18ftypheic\0\0\0\0')), 'heic'); assert.equal(P.sniffPhoto(new TextEncoder().encode('\0\0\0\x18ftypmif1\0\0\0\0')), 'heic');
assert.equal(P.sniffPhoto(new TextEncoder().encode('GIF89a..........')), 'gif'); assert.equal(P.sniffPhoto(new TextEncoder().encode('ciao, non sono una foto')), null);
const rect = P.cropRect(800, 600, { zoom: 2, x: 1, y: -1 }); assert.ok(rect.sx >= 0 && rect.sy >= 0 && rect.sx + rect.side <= 800 && rect.sy + rect.side <= 600, 'Il ritaglio resta dentro la foto.');

// ---- 2. in the browser
if (!chromeAvailable) { console.log(`Lettura dei tratti verificata (${cases.length} ritratti sintetici × 3 luci × 2 semi). Prova nel browser saltata: Chrome non trovato.`); process.exit(0); }
const dir = await mkdtemp(join(tmpdir(), 'politicando-foto-'));
const photo = join(dir, 'ritratto.png'), notPhoto = join(dir, 'documento.png');
await writeFile(photo, pngOf(paintFace({ size: 512, skin: 'chiara', hair: 'nero', length: 'lungo', glasses: true, seed: 5 }), 512));
await writeFile(notPhoto, Buffer.from('questo file finge di essere una foto ma contiene solo testo, nessun pixel'));
const SIENA = '052032';
let log = {};
try {
  await withBrowser(async ({ evaluate, send, goto, waitFor, pause, viewport, version, screenshot }) => {
    const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    const click = async (selector, wait = 150) => { const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`); assert.ok(ok, `manca ${selector}`); await pause(wait); };
    const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`);
    const setFile = async path => { const { root } = await send('DOM.getDocument', { depth: 0 }); const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '.photo-avatar [data-pa-file]' }); await send('DOM.setFileInputFiles', { files: [path], nodeId }); };
    const traits = () => evaluate(`Object.fromEntries([...document.querySelectorAll('.photo-avatar [data-pa-trait]')].map(s => [s.dataset.paTrait, s.value]))`);
    const drawn = () => evaluate(`document.querySelector('.photo-avatar [data-pa-avatar] svg')?.getAttribute('data-avatar') ?? ''`);
    const stored = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); const p = s.dataset.politicians.find(item => item.id === s.career.playerId); return p ? { id: p.id, avatar: p.avatar, save: store.exportSave() } : null; })()`);
    const kept = id => evaluate(`(() => { const all = JSON.parse(localStorage.getItem('politicando.photo-avatar.v1') ?? '{}'); const e = all[${JSON.stringify(id)}]; return e ? { photo: e.photo.slice(0, 23), length: e.photo.length, settings: e.settings, manual: e.manual } : null; })()`);
    const sig = avatar => ['face', 'skin', 'hair', 'hairstyle', 'beard', 'glasses', 'jacket', 'eyes', 'expression', 'moustache'].map(field => avatar[field]).join('.');
    await viewport(1280, 900, false);
    await goto(); await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`); await goto();
    await waitFor(() => has('[data-menu="nuova"]'));
    await click('[data-menu="nuova"]:not([disabled])', 200); await waitFor(() => has('.wizard-mode-gate')); await click('[data-wizard-mode="realistica"]', 200); await waitFor(() => has('.career-wizard [name="firstName"]'));
    await setField('.career-wizard [name="firstName"]', 'Marta'); await setField('.career-wizard [name="lastName"]', 'Foto'); await setField('.career-wizard [name="birthDate"]', '1988-03-02', 'change'); await setField('.career-wizard [name="previousProfession"]', 'Architetta');
    await setField('.career-wizard [name="gender"]', 'donna', 'change'); await pause(200);
    // the editor
    assert.ok(await has('[data-avatar-photo] [data-beta-tag]'), 'Accanto al pulsante per creare l’avatar dalla foto c’è l’etichetta BETA.');
    await click('[data-avatar-photo]', 400); await waitFor(() => has('.photo-avatar .pa-panel'));
    assert.equal((await evaluate(`document.querySelector('.photo-avatar .pa-head [data-beta-tag]')?.textContent ?? ''`)), 'BETA', 'Nella funzione di creazione c’è l’etichetta BETA.');
    // a file that is not a photo: refused with the reason, nothing read
    await setFile(notPhoto); await waitFor(() => evaluate(`!document.querySelector('.photo-avatar [data-pa-error]').hidden`), 8000);
    log.refused = await evaluate(`document.querySelector('.photo-avatar [data-pa-error]').textContent`);
    assert.match(log.refused, /non è una foto/, 'Un file che non è una foto è rifiutato con il motivo.');
    // the photo
    await setFile(photo); await waitFor(() => evaluate(`Boolean(document.querySelector('.photo-avatar')?.dataset.paRead)`), 15000);
    await setField('.photo-avatar [data-pa-zoom]', '1'); await pause(600);
    const read = await traits(); log.read = read;
    assert.equal(read.hair, 'nero', 'Capelli neri riconosciuti.'); assert.ok(['lungo', 'ondulato'].includes(read.hairstyle), `Capelli lunghi riconosciuti (${read.hairstyle}).`); assert.equal(read.glasses, 'rettangolari', 'Occhiali riconosciuti.');
    assert.equal(read.beard, 'nessuna'); assert.ok(await evaluate(`document.querySelector('.photo-avatar [data-pa-trait="beard"]').disabled`), 'Barba bloccata per un volto femminile.');
    const first = await drawn();
    assert.ok(first.startsWith('femminile.') && first.includes('.nero.') && first.includes('rettangolari'), `Il disegno mostra subito i tratti letti (${first}).`);
    log.summary = await evaluate(`document.querySelector('.photo-avatar [data-pa-summary]').textContent`);
    assert.match(log.summary, /Occhiali/, 'Il riepilogo dice che cosa la foto ha mostrato.');
    await evaluate(`document.querySelector('.photo-avatar [data-pa-summary]').scrollIntoView({ block: 'center' }); true`); await screenshot(`${OUT}avatar-foto-lettura-1280.png`);
    // corrections by hand, kept through a new reading
    await setField('.photo-avatar [data-pa-trait="glasses"]', 'tondi', 'change'); await setField('.photo-avatar [data-pa-trait="jacket"]', 'bordeaux', 'change'); await pause(200);
    assert.ok((await drawn()).includes('tondi') && (await drawn()).includes('bordeaux'), 'Le correzioni cambiano subito il disegno.');
    await setField('.photo-avatar [data-pa-zoom]', '1.04'); await pause(700);
    assert.equal((await traits()).glasses, 'tondi', 'Dopo una nuova lettura la correzione a mano resta.');
    const chosen = await traits();
    // a phone: the editor fits
    await viewport(375, 812, true); await pause(400);
    const fits = await evaluate(`(() => { const p = document.querySelector('.photo-avatar .pa-panel').getBoundingClientRect(); return p.left >= 0 && p.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; })()`);
    assert.ok(fits, 'A 375 px l’editor sta nello schermo.'); await screenshot(`${OUT}avatar-foto-editor-375.png`);
    await viewport(1280, 900, false); await pause(300);
    await click('.photo-avatar [data-pa-save]', 500);
    assert.ok(!(await has('.photo-avatar')), 'L’editor si chiude.');
    const wizardFace = await evaluate(`document.querySelector('[data-avatar-preview] svg')?.getAttribute('data-avatar') ?? ''`);
    assert.ok(wizardFace.includes('tondi') && wizardFace.includes('bordeaux') && wizardFace.includes('.nero.'), 'Il wizard mostra l’avatar creato dalla foto.');
    assert.ok(await has('[data-avatar-preview] svg') && !(await has('[data-avatar-preview] img')), 'L’anteprima è il disegno, non una foto.');
    // the rest of the wizard
    await click('.wizard-footer [data-wizard-action="next"]', 300);
    await setField('[data-wizard-region]', 'Toscana', 'change'); await waitFor(() => has('[data-wizard-municipality-search]')); await setField('[data-wizard-municipality-search]', 'Siena'); await waitFor(() => has(`[data-municipality-code="${SIENA}"]`)); await click(`[data-municipality-code="${SIENA}"]`, 250);
    await click('.wizard-footer [data-wizard-action="next"]', 300); await click('[data-level="provinciale"]', 200);
    for (let i = 0; i < 3; i++) await click('.wizard-footer [data-wizard-action="next"]', 300);
    await click('.wizard-footer [data-wizard-action="finish"]', 300);
    await waitFor(() => evaluate(`Boolean(document.querySelector('.page-wrap')) && !document.querySelector('.career-wizard')`), 40000);
    const born = await stored();
    for (const [field, value] of Object.entries(chosen)) assert.equal(born.avatar[field], value, `Carriera creata: ${field} = ${value}.`);
    assert.equal(born.avatar.face, 'femminile', 'Il volto segue il genere.');
    assert.ok(!/data:image|base64/.test(born.save), 'Nel salvataggio della carriera nessuna immagine.');
    const keep = await kept(born.id); log.kept = keep;
    assert.ok(keep && keep.photo.startsWith('data:image/jpeg') && keep.length < 240000, 'La foto ridotta resta solo sul dispositivo, per le modifiche.');
    // Home, Profile
    const signature = sig(born.avatar);
    await evaluate(`location.hash = '#panoramica'`); await waitFor(() => has('.hq-identity .hero-avatar svg'));
    assert.ok((await evaluate(`document.querySelector('.hq-identity .hero-avatar svg').getAttribute('data-avatar')`)).startsWith(signature), 'Home: l’avatar illustrato dalla foto.');
    await evaluate(`location.hash = '#profilo'`); await waitFor(() => has('.profile-page-lead .hero-avatar svg'));
    assert.ok((await evaluate(`document.querySelector('.profile-page-lead .hero-avatar svg').getAttribute('data-avatar')`)).startsWith(signature), 'Profilo: lo stesso avatar.');
    assert.ok(!(await has('.hq-identity [data-beta-tag], .profile-page-lead [data-beta-tag], .avatar-svg [data-beta-tag]')), 'L’etichetta BETA non compare su avatar finale, Home o profilo.');
    await screenshot(`${OUT}avatar-foto-profilo-1280.png`);
    // an animated scene draws the player with it
    const scene = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const { WEEKLY_ACTIVITIES } = await import('/src/data/simulation/career-rules.js?v=${version}'); const S = await import('/src/core/activity-scenes.js?v=${version}'); for (const a of WEEKLY_ACTIVITIES.filter(x => S.activityHasScene(x.id))) { try { await store.startActivityScene(a.id, { quick: false }); return a.id; } catch { /* not open to this role */ } } return null; })()`);
    assert.ok(scene, 'Una scena animata si apre.');
    await waitFor(() => has('.scene .st-svg'), 15000);
    const actor = await evaluate(`(() => { const node = document.querySelector('.scene .st-actor.role-giocatore'); return node ? { code: node.getAttribute('data-avatar'), speaking: node.classList.contains('is-speaking') } : null; })()`);
    // a figure who is speaking takes the expression of the line (stage-art actorSvg): every trait read from the photo stays, the expression may change only while the player speaks
    const traitsOf = code => code.split('.').slice(0, 10).filter((_, index) => index !== 8).join('.'), mine = signature.split('.');
    assert.ok(actor && traitsOf(actor.code) === traitsOf(signature), `Nella scena il giocatore ha l’avatar dalla foto (${actor?.code} / ${signature}).`);
    assert.ok(actor.code.split('.')[8] === mine[8] || actor.speaking, `Nella scena l’espressione cambia solo quando il giocatore parla (${actor.code.split('.')[8]} / ${mine[8]}).`);
    assert.ok(!(await has('.scene [data-photo-face]')), 'Nella scena nessuna testa fotografica.'); assert.ok(!(await has('.scene [data-beta-tag]')), 'Nelle scene nessuna etichetta BETA.');
    await screenshot(`${OUT}avatar-foto-scena-1280.png`);
    await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.sceneAbandon(); return true; })()`).catch(() => {});
    // close and reopen the game
    await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); await store.preserveCurrent?.(); return true; })()`); await pause(400);
    await goto(); await waitFor(() => has('[data-menu="continua"]')); await click('[data-menu="continua"]', 400); await waitFor(() => has('.page-wrap'));
    assert.ok(sig((await stored()).avatar) === signature, 'Dopo il ricaricamento l’avatar è lo stesso.');
    // edit it again from the profile: opens on the saved choices and the kept photo
    await evaluate(`location.hash = '#profilo'`); await waitFor(() => has('[data-action="photo-avatar"]'));
    assert.match(await evaluate(`document.querySelector('[data-action="photo-avatar"]').textContent`), /Modifica l’avatar/);
    await click('[data-action="photo-avatar"]', 500); await waitFor(() => has('.photo-avatar .pa-panel'));
    await waitFor(() => evaluate(`Boolean(document.querySelector('.photo-avatar')?.dataset.paRead)`), 15000);
    const reopened = await traits();
    for (const [field, value] of Object.entries(chosen)) assert.equal(reopened[field], value, `Riaperto: ${field} = ${value} (impostazioni precedenti).`);
    assert.ok(await has('.photo-avatar [data-pa-drop]'), 'La foto conservata è di nuovo nell’editor.');
    await setField('.photo-avatar [data-pa-trait="hairstyle"]', 'raccolto', 'change'); await setField('.photo-avatar [data-pa-trait="expression"]', 'sorridente', 'change'); await pause(200);
    await click('.photo-avatar [data-pa-save]', 500);
    const edited = await stored();
    assert.equal(edited.avatar.hairstyle, 'raccolto'); assert.equal(edited.avatar.expression, 'sorridente'); assert.equal(edited.avatar.glasses, 'tondi', 'Le altre scelte restano.');
    assert.ok((await evaluate(`document.querySelector('.profile-page-lead .hero-avatar svg').getAttribute('data-avatar')`)).includes('raccolto'), 'Il profilo mostra subito la modifica.');
    await goto(); await waitFor(() => has('[data-menu="continua"]')); await click('[data-menu="continua"]', 400); await waitFor(() => has('.page-wrap'));
    assert.equal((await stored()).avatar.hairstyle, 'raccolto', 'Dopo un altro ricaricamento la modifica resta.');
    assert.deepEqual((await kept(edited.id)).manual.sort(), ['expression', 'glasses', 'hairstyle', 'jacket'], 'Le correzioni a mano sono ricordate sul dispositivo.');
    // removing the photo keeps the avatar
    await evaluate(`location.hash = '#profilo'`); await waitFor(() => has('[data-action="photo-avatar"]')); await click('[data-action="photo-avatar"]', 500); await waitFor(() => has('.photo-avatar [data-pa-drop]'));
    await click('.photo-avatar [data-pa-drop]', 200); await click('.photo-avatar [data-pa-save]', 400);
    assert.equal(await kept(edited.id), null, '«Elimina la foto» la toglie dal dispositivo.'); assert.equal((await stored()).avatar.hairstyle, 'raccolto', 'L’avatar resta.');
  });
} finally { await rm(dir, { recursive: true, force: true }); }
console.log(`Avatar da foto verificato. Lettura su ritratti sintetici (${cases.length} casi × 3 luci × 2 semi):\n  ${table.join('\n  ')}\nNel browser: file non valido rifiutato («${log.refused}»), lettura ${JSON.stringify(log.read)}, correzioni a mano conservate, wizard → carriera → Home → Profilo → scena → ricaricamento → modifica dal profilo → ricaricamento, foto ridotta solo sul dispositivo (${log.kept?.length} caratteri), nessuna immagine nel salvataggio. Non verificati: fotocamera fisica, selettori nativi Android/iOS, foto reali.`);
