// The newsroom as the player reads it: full articles (with the facts behind them), the stories that last (timeline, reactions, heat) and the
// outlets with their identity. Everything shown here was written by the engine from a fact of the game; nothing is attributed to real people.
import { ARTICLE_CATEGORIES, NEWSROOM_OUTLETS, STORY_KINDS } from '../data/simulation/news-rules.js?v=20261012-3';
import { SEGMENTS } from '../data/simulation/society-rules.js?v=20261012-3';
import { normalizeMedia } from '../core/news-engine.js?v=20261012-3';
import { esc, meter } from './charts.js?v=20261012-3';
import { glyph } from './visuals.js?v=20261012-3';

const TONE = { good: 'tone-good', bad: 'tone-bad', neutral: 'tone-neutral' };
export const leaningLabel = value => value <= -1.5 ? 'sinistra' : value <= -0.5 ? 'centro-sinistra' : value < 0.5 ? 'equidistante' : value < 1.5 ? 'centro-destra' : 'destra';
const EDGE_LABEL = { critical: 'tono critico verso il Governo', friendly: 'tono vicino al Governo', neutral: 'tono neutro' };
const STANCE_LABEL = { attacca: 'attacca', riserve: 'ha riserve', favorevole: 'a favore', contrario: 'contrario', rivendica: 'rivendica' };
const segmentLabel = id => SEGMENTS.find(item => item.id === id)?.label ?? id;

export const newsMedia = state => state.society?.media ? normalizeMedia(state.society.media) : null;

export function articleHtml(article, media) {
  const story = article.storyId ? media.stories.find(item => item.id === article.storyId) : null;
  const facts = (article.facts ?? []).length ? `<ul class="article-facts">${article.facts.map(item => `<li><small>${esc(item.label)}</small><b>${esc(item.value)}</b></li>`).join('')}</ul>` : '';
  const link = story ? `<p class="article-story">${glyph('route', 13)} Fa parte di una vicenda: <b>${esc(story.title)}</b> · ${story.status === 'aperta' ? 'ancora aperta' : 'chiusa'} · ${story.timeline.length} ${story.timeline.length === 1 ? 'sviluppo' : 'sviluppi'}</p>` : '';
  return `<details class="news-article ${TONE[article.tone] ?? TONE.neutral}"><summary>${glyph(ARTICLE_CATEGORIES.find(item => item.id === article.category)?.icon ?? 'news', 16)}<span><span class="news-meta">${esc(article.outlet)} · ${esc(ARTICLE_CATEGORIES.find(item => item.id === article.category)?.label ?? article.category)} · S${article.week}</span><strong>${esc(article.headline)}</strong><small>${esc(article.deck)}</small></span></summary>
    <div class="article-body">${article.body.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}${facts}${link}<p class="article-edge"><small>${esc(EDGE_LABEL[article.edge] ?? '')} · articolo simulato dai fatti della partita</small></p></div></details>`;
}

export function storyHtml(story, media) {
  const kind = STORY_KINDS[story.kind] ?? STORY_KINDS.vicenda;
  const outlet = media.outlets.find(item => item.id === story.outletId);
  const timeline = story.timeline.map(item => `<li class="${TONE[item.tone] ?? TONE.neutral}"><time>S${item.week}</time><span>${esc(item.text)}</span></li>`).join('');
  const reactions = story.reactions.length ? `<div class="story-reactions"><small>REAZIONI</small>${story.reactions.map(item => `<p><b>${esc(item.actor)}</b> <span class="badge">${esc(STANCE_LABEL[item.stance] ?? item.stance)}</span> ${esc(item.text)}</p>`).join('')}</div>` : '';
  return `<article class="news-story ${story.status === 'aperta' ? 'open' : 'closed'}"><header>${glyph(kind.icon, 16)}<div><span class="news-meta">${esc(kind.label)} · ${esc(story.stage)}${outlet ? ` · ${esc(outlet.name)}` : ''} · aperta alla S${story.openedWeek}</span><strong>${esc(story.title)}</strong></div><span class="badge ${story.status === 'aperta' ? 'badge-live' : ''}">${story.status === 'aperta' ? 'In corso' : 'Chiusa'}</span></header>
    ${story.status === 'aperta' ? `<div class="story-heat"><small>ATTENZIONE</small>${meter(story.heat, story.heat >= 60 ? 'danger' : 'gold')}<b>${Math.round(story.heat)}</b></div>` : ''}
    <ol class="story-timeline">${timeline}</ol>${reactions}${story.resolution ? `<p class="story-resolution"><b>Esito</b> · S${story.resolution.week} · ${esc(story.resolution.text)}</p>` : '<p class="story-resolution"><small>Gli sviluppi arrivano dai fatti: la vicenda si spegne da sola se nessuno la alimenta.</small></p>'}</article>`;
}

export function outletHtml(outlet) {
  const identity = NEWSROOM_OUTLETS[outlet.id];
  if (!identity) return '';
  const reached = Object.entries(identity.public).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => segmentLabel(id).toLowerCase());
  const stance = outlet.stance > 5 ? 'favorevole a te' : outlet.stance < -5 ? 'critica con te' : 'neutrale con te';
  return `<div class="outlet-card" tabindex="0" data-tip="${esc(`${outlet.name}: credibilità ${Math.round(outlet.credibility)}, ${leaningLabel(outlet.leaning)}`)}"><div><strong>${esc(outlet.name)}</strong><small>${esc(outlet.tagline)} · ${esc(outlet.label.toLowerCase())}</small></div>
    <dl><div><dt>Credibilità</dt><dd>${meter(outlet.credibility, outlet.credibility < 45 ? 'danger' : '')}<b>${Math.round(outlet.credibility)}</b></dd></div><div><dt>Orientamento</dt><dd>${esc(leaningLabel(outlet.leaning))}</dd></div><div><dt>Pubblico</dt><dd>${esc(reached.join(' e '))} · ${outlet.reach}/100</dd></div><div><dt>Con te</dt><dd>${esc(stance)}</dd></div></dl>${identity.investigative ? '<small class="outlet-note">Racconta per prima le inchieste.</small>' : ''}</div>`;
}

export function renderNewsroomTabs(state, { filter, category = 'tutte', outlet = 'tutte' } = {}) {
  const media = newsMedia(state);
  if (!media) return '';
  if (filter === 'storie') {
    const open = media.stories.filter(item => item.status === 'aperta'), closed = media.stories.filter(item => item.status === 'chiusa');
    return `<div class="newsroom stories">${open.map(item => storyHtml(item, media)).join('') || '<p class="quiet-copy">Nessuna vicenda aperta: le storie nascono da crisi, riforme contestate, inchieste, opere e conti pubblici.</p>'}${closed.length ? `<h4 class="news-subhead">Archivio · ${closed.length} chiuse</h4>${closed.map(item => storyHtml(item, media)).join('')}` : ''}</div>`;
  }
  if (filter === 'testate') return `<div class="newsroom outlets">${media.outlets.filter(item => NEWSROOM_OUTLETS[item.id]).map(outletHtml).join('')}</div><p class="poll-footnote">Le testate sono inventate. La credibilità sale quando una loro indiscrezione è confermata e scende quando è smentita; il tono verso il Governo dipende dall’orientamento.</p>`;
  const chips = (kind, items, current) => `<div class="news-chips" role="group" aria-label="Filtra per ${kind}">${items.map(([id, label]) => `<button class="${current === id ? 'active' : ''}" data-news-${kind === 'categoria' ? 'category' : 'outlet'}="${esc(id)}" aria-pressed="${current === id}">${esc(label)}</button>`).join('')}</div>`;
  const used = new Set(media.articles.map(item => item.category));
  const articles = media.articles.filter(item => (category === 'tutte' || item.category === category) && (outlet === 'tutte' || item.outletId === outlet));
  return `${chips('categoria', [['tutte', 'Tutte'], ...ARTICLE_CATEGORIES.filter(item => used.has(item.id)).map(item => [item.id, item.label])], category)}${chips('testata', [['tutte', 'Tutte le testate'], ...media.outlets.filter(item => NEWSROOM_OUTLETS[item.id]).map(item => [item.id, item.name])], outlet)}
    <div class="newsroom articles">${articles.slice(0, 20).map(item => articleHtml(item, media)).join('') || '<p class="quiet-copy">Nessun articolo per questo filtro: la redazione scrive quando succede qualcosa (leggi, crisi, opere, conti, interviste).</p>'}</div>`;
}
