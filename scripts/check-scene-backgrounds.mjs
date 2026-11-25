// No black stage: every scene is drawn on a room that exists and paints a whole background, with no invalid paint (a colour `undefined`/`NaN` is drawn black by the browser: that was the cause of
// the black rooms). For every activity with a scene, every beat, several seeds and with and without a party: the stage SVG has its room layer, the first painted element of the room covers the whole
// canvas, no attribute carries `undefined`, `NaN` or an empty colour, and the speaker of each beat is the only figure marked as speaking (the highlight follows who talks).
// The page's own guard (stage-art.js: a setting with no drawing falls back to the room of the scene's kind) is checked too: an unknown setting never gives an empty stage.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const S = await load('src/core/activity-scenes.js');
const { WEEKLY_ACTIVITIES } = await load('src/data/simulation/career-rules.js');
await load('src/ui/room-art.js');
const { renderStageSvg, STAGE_SETTINGS, STAGE_W: W = 640, STAGE_H: H = 360 } = await load('src/ui/stage-art.js');

const BAD = /="(undefined|NaN|null)"|="[^"]*\b(undefined|NaN)\b[^"]*"|fill=""|stroke=""|stop-color=""/;
const player = { name: 'Prova Sfondo', tag: 'Deputato' };
const ids = WEEKLY_ACTIVITIES.map(item => item.id).filter(id => S.activityHasScene(id));
const problems = [];
let rendered = 0;
for (const activityId of ids) {
  const sceneKey = S.sceneKeyOf(activityId);
  for (let n = 0; n < 6; n++) for (const party of [true, false]) {
    const scene = S.createActivityScene({ id: `sfondo-${activityId}-${n}`, seed: `sfondo|${activityId}|${n}|${party}`, sceneKey, activityId, player, playerAvatar: null, stats: { competence: 55, charisma: 55, reputation: 55 }, situation: { party, funds: true, capital: true }, party: party ? { label: 'Partito di Prova' } : null });
    for (const nodeId of ['apertura', 'q1', 'r1', 'q2', 'r2', 'esito']) {
      const node = { ...S.activityNode({ ...scene, nodeId }), id: nodeId };
      let svg = '';
      try { svg = renderStageSvg({ ...scene, nodeId }, S.activityStage({ ...scene, nodeId }, node), node, { label: 'prova', playerPhoto: null }); }
      catch (error) { problems.push(`${activityId}/${nodeId}: il disegno fallisce (${error.message})`); continue; }
      rendered++;
      if (!/class="st-room"/.test(svg)) problems.push(`${activityId}/${nodeId}: nessuna stanza (setting ${scene.setting})`);
      const bad = svg.match(BAD);
      if (bad) problems.push(`${activityId}/${nodeId} (${scene.setting}): colore non valido «${bad[0].slice(0, 60)}»`);
      // the first element of the room must paint the whole canvas (a full rect, or a path/gradient filling it)
      const room = svg.slice(svg.indexOf('class="st-room"'));
      const first = room.match(/<(rect|path|polygon)[^>]*>/)?.[0] ?? '';
      // the full-width rectangles of the room (wall bands, floor) must cover the stage from top to bottom
      const bands = [...room.slice(0, room.indexOf('class="st-actors"') > 0 ? room.indexOf('class="st-actors"') : room.length).matchAll(/<rect\b([^>]*)>/g)].map(match => { const at = name => Number(match[1].match(new RegExp(`\\b${name}="(-?[\\d.]+)"`))?.[1] ?? (name === 'x' || name === 'y' ? 0 : NaN)); return { x: at('x'), y: at('y'), w: at('width'), h: at('height') }; })
        .filter(r => Number.isFinite(r.w) && Number.isFinite(r.h) && r.x <= 0 && r.x + r.w >= W).sort((a, b) => a.y - b.y);
      let reach = 0; for (const r of bands) if (r.y <= reach + 0.5) reach = Math.max(reach, r.y + r.h);
      const full = reach >= H - 0.5;
      if (!full) problems.push(`${activityId}/${nodeId} (${scene.setting}): lo sfondo della stanza non copre la scena (${first.slice(0, 80)})`);
      // the highlight follows who speaks: one speaking figure at most, the one of the beat
      const speaking = [...svg.matchAll(/class="st-actor[^"]*\bis-speaking\b[^"]*" data-actor="([^"]+)"/g)].map(match => match[1]);
      if (speaking.length > 1) problems.push(`${activityId}/${nodeId}: ${speaking.length} figure evidenziate insieme`);
      if (node.speaker && speaking.length === 1 && speaking[0] !== node.speaker) problems.push(`${activityId}/${nodeId}: evidenziato ${speaking[0]}, parla ${node.speaker}`);
    }
  }
}
// an unknown setting: the guard draws the room of its kind, never an empty stage
{
  const scene = S.createActivityScene({ id: 'sfondo-sconosciuto', seed: 'sfondo|x', sceneKey: 'associazioni', activityId: ids[0], player, playerAvatar: null, stats: {}, situation: { party: true, funds: true, capital: true } });
  const odd = { ...scene, setting: 'stanza-che-non-esiste', nodeId: 'q1' };
  const node = { ...S.activityNode(odd), id: 'q1' };
  const svg = renderStageSvg(odd, S.activityStage(odd, node), node, { label: 'prova', playerPhoto: null });
  assert.ok(/class="st-room"/.test(svg) && !BAD.test(svg), 'Un’ambientazione sconosciuta ripiega su una stanza valida, mai su una scena vuota.');
}
// the protest: the protesters' line follows the documented reason and what the player answers for (never «amministrate voi» to someone with no office)
{
  const { protestQuote } = await load('src/core/rally-scene.js');
  const territory = { kind: 'territorio', label: 'la situazione su sanità in Toscana', slogans: ['LISTE D’ATTESA'] };
  assert.match(protestQuote(territory, 'amministrazione'), /Amministrate voi/, 'A chi amministra: la responsabilità è sua.');
  assert.doesNotMatch(protestQuote(territory, 'nessuna'), /Amministrate|Governo di cui/, 'A chi non ha incarichi non si attribuisce un’amministrazione.');
  assert.match(protestQuote(territory, 'nessuna'), /Chi chiede il nostro voto/, 'A un candidato senza incarichi si chiede che cosa farà.');
  assert.match(protestQuote({ kind: 'economia', label: 'il caro vita', slogans: ['PREZZI ASSURDI'] }, 'governo'), /Al Governo ci siete voi/);
  assert.doesNotMatch(protestQuote({ kind: 'economia', label: 'il caro vita', slogans: ['PREZZI ASSURDI'] }, 'eletto'), /Al Governo/, 'All’opposizione non si dice che governa.');
}
assert.ok(rendered > 1500, `scene disegnate: ${rendered}`);
assert.deepEqual(problems.slice(0, 20), [], `Problemi di sfondo o di evidenziazione:\n${problems.slice(0, 20).join('\n')}`);
console.log(`Sfondi delle scene verificati: ${rendered} disegni (${ids.length} attività × 6 momenti × 12 varianti), stanza sempre presente e intera, nessun colore non valido, al massimo una figura evidenziata ed è chi parla; un’ambientazione sconosciuta ripiega su una stanza valida. Stanze registrate: ${STAGE_SETTINGS().length}.`);
