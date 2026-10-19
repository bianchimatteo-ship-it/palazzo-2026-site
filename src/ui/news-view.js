// The newsroom as the player reads it: full articles (with the facts behind them), the stories that last (timeline, reactions, heat) and the
// outlets with their identity. Everything shown here was written by the engine from a fact of the game; nothing is attributed to real people.
import { ARTICLE_CATEGORIES, LP24, NEWSROOM_OUTLETS, RADIO_PROGRAMMES, STORY_KINDS } from '../data/simulation/news-rules.js?v=20261019-2';
import { formatDate } from '../core/time.js?v=20261019-2';
import { illustration, lp24Logo } from './illustrations.js?v=20261019-2';
import { SEGMENTS } from '../data/simulation/society-rules.js?v=20261019-2';
import { normalizeMedia } from '../core/news-engine.js?v=20261019-2';
import { esc, meter } from './charts.js?v=20261019-2';
import { glyph } from './visuals.js?v=20261019-2';
import { bulletinScript, voiceAvailable, voiceLine, voiceStatus, voiceTarget } from './radio-voice.js?v=20261019-2';

const TONE = { good: 'tone-good', bad: 'tone-bad', neutral: 'tone-neutral' };
export const leaningLabel = value => value <= -1.5 ? 'sinistra' : value <= -0.5 ? 'centro-sinistra' : value < 0.5 ? 'equidistante' : value < 1.5 ? 'centro-destra' : 'destra';
const EDGE_LABEL = { critical: 'tono critico verso il Governo', friendly: 'tono vicino al Governo', neutral: 'tono neutro' };
const STANCE_LABEL = { attacca: 'attacca', riserve: 'ha riserve', favorevole: 'a favore', contrario: 'contrario', rivendica: 'rivendica' };
const segmentLabel = id => SEGMENTS.find(item => item.id === id)?.label ?? id;

export const newsMedia = state => state.society?.media ? normalizeMedia(state.society.media) : null;

// The scene and the tone of an article: by category, and the crisis scene for the heaviest bad news.
const CATEGORY_SCENE = { politica: 'piazza', governo: 'palazzo', parlamento: 'emiciclo', economia: 'tesoro', territorio: 'borgo', opere: 'borgo', partito: 'piazza', sondaggi: 'podio', inchieste: 'crisi', elezioni: 'urna' };
const CATEGORY_TONE = { politica: '#6aa9c4', governo: '#c4a66a', parlamento: '#8f95d8', economia: '#d6a54c', territorio: '#6fa982', opere: '#6fa982', partito: '#b98cc4', sondaggi: '#5fa5c2', inchieste: '#c4574a', elezioni: '#7fbf99' };
export const newsScene = article => article.tone === 'bad' && (article.importance ?? 0) >= 5 && ['governo', 'economia', 'politica'].includes(article.category) ? 'crisi' : CATEGORY_SCENE[article.category] ?? 'giornale';
const categoryOf = id => ARTICLE_CATEGORIES.find(item => item.id === id);
const shortDate = date => { try { return formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return String(date ?? ''); } };
const summaryOf = article => String(article.deck || article.body?.[0] || '').slice(0, 220);

// A card of the paper: the scene of its category, category, date, outlet, headline, summary and the way to the whole story. BREAKING NEWS only for the articles that carry the flag.
export function articleHtml(article, media, { lead = false } = {}) {
  const story = article.storyId ? media.stories.find(item => item.id === article.storyId) : null;
  const facts = (article.facts ?? []).length ? `<ul class="article-facts">${article.facts.map(item => `<li><small>${esc(item.label)}</small><b>${esc(item.value)}</b></li>`).join('')}</ul>` : '';
  const link = story ? `<p class="article-story">${glyph('route', 13)} Fa parte di una vicenda: <b>${esc(story.title)}</b> · ${story.status === 'aperta' ? 'ancora aperta' : 'chiusa'} · ${story.timeline.length} ${story.timeline.length === 1 ? 'sviluppo' : 'sviluppi'}</p>` : '';
  const category = categoryOf(article.category);
  // The article can be read aloud by the device's own voice (only where it has one): the text stays on the page either way.
  const reading = voiceTarget() === `article:${article.id}`;
  const listen = voiceAvailable() ? `<p class="article-listen"><button type="button" class="secondary-button ${reading ? 'is-on-air' : ''}" data-article-speak="${esc(article.id)}" data-voice-target="article:${esc(article.id)}" data-voice-idle="Ascolta l’articolo" data-voice-active="Ferma la lettura" aria-pressed="${reading}">${glyph('mic', 14)} <span data-voice-label>${reading ? 'Ferma la lettura' : 'Ascolta l’articolo'}</span></button></p>` : '';
  return `<article class="news-card ${lead ? 'is-lead' : ''} ${article.breaking ? 'is-breaking' : ''} ${TONE[article.tone] ?? TONE.neutral}" style="--cat:${esc(CATEGORY_TONE[article.category] ?? '#6aa9c4')}" data-article="${esc(article.id)}">
    <figure class="news-art" aria-hidden="true">${illustration(newsScene(article))}</figure>
    <div class="news-card-body">
      <p class="news-card-meta">${article.breaking ? '<span class="breaking-badge">BREAKING NEWS</span>' : ''}<span class="news-cat">${glyph(category?.icon ?? 'news', 13)} ${esc(category?.label ?? article.category)}</span><time datetime="${esc(article.date ?? '')}">${esc(shortDate(article.date))}</time><span class="news-outlet">${esc(article.outlet)}</span></p>
      <h3 class="news-headline">${esc(article.headline)}</h3>
      <p class="news-summary">${esc(summaryOf(article))}</p>
      <details class="news-article ${TONE[article.tone] ?? TONE.neutral}"><summary>Leggi la storia completa</summary>
        <div class="article-body">${listen}${article.body.map(paragraph => `<p>${esc(paragraph)}</p>`).join('')}${facts}${link}<p class="article-edge"><small>${esc(EDGE_LABEL[article.edge] ?? '')} · articolo simulato dai fatti della partita</small></p></div></details>
    </div></article>`;
}

// The masthead of LA POLITICA 24 (newspaper and radio).
export function mastheadHtml(kind = 'paper') {
  const part = kind === 'radio' ? LP24.radio : LP24.paper;
  return `<header class="lp24-masthead" style="--lp24-plate:#0f2f3a;--lp24-ink:#f4efe2;--lp24-gold:#e0b04a">${lp24Logo(kind)}<div><span class="section-kicker">${esc(LP24.name)} · SIMULATA</span><h2>${esc(part.name)}</h2><p>${esc(part.note)}</p></div></header>`;
}
// The front page: the heaviest article of the recent weeks as the lead, then the others, and the stories that are still open.
export function paperHtml(state) {
  const media = newsMedia(state);
  if (!media) return '';
  const week = state.game?.week.index ?? 0;
  const recent = media.articles.filter(item => item.week >= week - 3);
  const ranked = [...(recent.length ? recent : media.articles)].sort((a, b) => (b.breaking ? 1 : 0) - (a.breaking ? 1 : 0) || (b.importance ?? 0) - (a.importance ?? 0) || b.week - a.week);
  const [lead, ...rest] = ranked;
  const open = media.stories.filter(item => item.status === 'aperta').slice(0, 3);
  if (!lead) return `${mastheadHtml('paper')}<p class="quiet-copy">La prima pagina si scrive quando succede qualcosa: leggi, crisi, opere, conti, elezioni.</p>`;
  const threads = open.length ? `<p class="news-threads">${glyph('route', 14)} Vicende aperte: ${open.map(item => `<b>${esc(item.title)}</b>`).join(' · ')}</p>` : '';
  return `${mastheadHtml('paper')}${threads}<div class="paper-front">${articleHtml(lead, media, { lead: true })}<div class="paper-grid">${rest.slice(0, 6).map(item => articleHtml(item, media)).join('')}</div></div><p class="poll-footnote">${esc(LP24.disclaimer)}</p>`;
}
// The radio: the latest bulletin and columns, each item pointing to the article it comes from; «Ascolta» plays the jingle of the radio (the existing sound system) and marks the bulletin as on air.
export function radioHtml(state) {
  const media = newsMedia(state);
  const bulletins = media?.radio?.bulletins ?? [];
  // The bulletin can be read aloud by the speech synthesis of the device (nothing is downloaded or sent): the control exists only where the device can do it, the text is always on the page.
  const script = bulletinScript(bulletins), canSpeak = script.length > 0 && voiceAvailable(), speaking = voiceTarget() === 'bulletin';
  const speak = canSpeak ? `<button type="button" class="primary-button ${speaking ? 'is-on-air' : ''}" data-radio-speak data-voice-target="bulletin" data-voice-idle="Ascolta il notiziario" data-voice-active="Ferma il notiziario" aria-pressed="${speaking}">${glyph('mic', 15)} <span data-voice-label>${speaking ? 'Ferma il notiziario' : 'Ascolta il notiziario'}</span></button>` : '';
  const head = `${mastheadHtml('radio')}<div class="radio-deck">${illustration('radio', 'radio-art')}<p>${esc(LP24.radio.name)}: ogni settimana un notiziario e le rubriche che hanno qualcosa da dire, scritti dai fatti della partita. Nessuna voce registrata e nessun servizio esterno: ${canSpeak ? 'il notiziario si legge qui sotto e si può ascoltare con la voce di sintesi italiana del tuo dispositivo (nulla viene scaricato o inviato); la sigla è un suono generato dal gioco.' : 'il notiziario si legge qui sotto e la sigla è un suono generato dal gioco.'}</p><div class="radio-actions">${speak}<button type="button" class="secondary-button" data-radio-play>${glyph('mic', 15)} Ascolta la sigla</button></div></div>`;
  if (!bulletins.length) return `${head}<p class="quiet-copy">Il primo notiziario va in onda alla prossima chiusura di settimana, se ci sono notizie da leggere.</p>`;
  const transcript = `<details class="radio-transcript" ${canSpeak ? '' : 'open'}><summary>Testo del notiziario${canSpeak ? '' : ' (la lettura ad alta voce non è disponibile su questo dispositivo)'}</summary><ol class="radio-script" aria-label="Testo del notiziario">${script.map((entry, index) => `<li class="${speaking && voiceLine() === index ? 'is-reading' : ''}" data-radio-line="${index}">${esc(entry.text)}</li>`).join('')}</ol></details>`;
  const weeks = [...new Set(bulletins.map(item => item.week))].slice(0, 3);
  const card = item => `<article class="radio-bulletin ${item.programme}" data-programme="${esc(item.programme)}"><header><span class="radio-slot">${glyph('mic', 14)} ${esc(RADIO_PROGRAMMES[item.programme]?.slot ?? 'Rubrica')}</span><h3>${esc(item.label)}</h3><time datetime="${esc(item.date)}">Settimana ${item.week} · ${esc(shortDate(item.date))}</time></header><p class="radio-intro">${esc(item.intro)}</p>${item.items?.length ? `<ol class="radio-items">${item.items.map(entry => `<li class="${TONE[entry.tone] ?? TONE.neutral}">${entry.breaking ? '<span class="breaking-badge">BREAKING NEWS</span> ' : ''}<b>${esc(entry.headline)}</b><small>${esc(entry.outlet)} · ${esc(categoryOf(entry.category)?.label ?? entry.category)}</small><button type="button" class="text-link" data-news-goto="${esc(entry.articleId)}">Leggi la storia</button></li>`).join('')}</ol>` : ''}${item.figures?.length ? `<ul class="radio-figures">${item.figures.map(figure => `<li><b>${esc(figure.label)}</b> ${String(Math.round(figure.share * 10) / 10).replace('.', ',')}% <small>${figure.delta ? `${figure.delta > 0 ? '+' : '−'}${String(Math.abs(Math.round(figure.delta * 10) / 10)).replace('.', ',')}` : '±0'} punti</small></li>`).join('')}</ul>` : ''}</article>`;
  return `${head}${transcript}${weeks.map(week => `<section class="radio-week"><h4 class="news-subhead">Settimana ${week}</h4><div class="radio-grid">${bulletins.filter(item => item.week === week).map(card).join('')}</div></section>`).join('')}<p class="poll-footnote">${esc(LP24.disclaimer)}</p>`;
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
  if (filter === 'giornale') return paperHtml(state);
  if (filter === 'radio') return radioHtml(state);
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

// The weekly pop-up: at most three news of the week, each with its category and outlet, a way to the newsroom and a way to close it. It does not take the focus and it never covers the controls of a phone.
export function newsPopupHtml(popup) {
  if (!popup?.items?.length) return '';
  const items = popup.items.slice(0, 3).map(item => `<li class="${item.breaking ? 'is-breaking' : ''}">${item.breaking ? '<span class="breaking-badge">BREAKING NEWS</span> ' : ''}<b>${esc(item.headline)}</b><small>${esc(item.outlet)} · ${esc(categoryOf(item.category)?.label ?? item.category)}</small><button type="button" class="text-link" data-news-popup-open="${esc(item.id)}">Leggi la storia</button></li>`).join('');
  return `<aside class="news-popup" role="dialog" aria-modal="false" aria-labelledby="news-popup-title" data-news-popup><header><div><span class="section-kicker">LA POLITICA 24 · SIMULATA</span><h2 id="news-popup-title">Le notizie della settimana</h2></div><button type="button" class="icon-button" data-news-popup-close aria-label="Chiudi le notizie della settimana"><span aria-hidden="true">×</span></button></header><ul class="news-popup-list">${items}</ul><footer><button type="button" class="secondary-button" data-news-popup-close>Chiudi</button><button type="button" class="primary-button" data-nav="notizie" data-news-popup-close>Apri Informazione</button></footer></aside>`;
}
// What the pop-up keeps of an article (the pop-up is not saved: the archive keeps the article).
export const popupItem = article => ({ id: article.id, headline: article.headline, outlet: article.outlet, category: article.category, breaking: Boolean(article.breaking) });
