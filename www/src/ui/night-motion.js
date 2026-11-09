// The motion of the election night (ui/election-night.js): what changes from one hour to the next is SHOWN changing — the bars grow from their old length to the new one, the numbers count up,
// the rows of the ranking glide to their new place (a overtake is highlighted), the squares of the counted units pop one after the other, the new news slides in. It is done with the Web
// Animations API after each draw, from what the previous draw left in memory, so the page itself stays a plain, complete picture: with the motion off or reduced (or the system preference) the
// numbers and bars are simply the new ones. Nothing here computes anything: the values are the ones the night engine gave.
import { motionAllows } from './stage-player.js?v=20261109-5';

const memory = { key: null, rows: new Map(), order: [], units: 0, feed: new Set(), counts: new Map(), bars: new Map() };
const locale = () => (document.documentElement.lang === 'en' ? 'en-GB' : 'it-IT');
const format = (value, kind) => kind === 'pct' ? `${value.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : Math.round(value).toLocaleString(locale());
const animate = (node, keyframes, options) => { try { return node?.animate?.(keyframes, { fill: 'both', ...options }) ?? null; } catch { return null; } };

function countUp(node, from, to, kind) {
  const start = performance.now(), duration = 850;
  const step = now => {
    const t = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - t, 3);
    node.textContent = format(from + (to - from) * eased, kind) + (node.dataset.suffix ?? '');
    if (t < 1 && node.isConnected) requestAnimationFrame(step); else if (node.isConnected) node.textContent = node.dataset.final ?? node.textContent;
  };
  requestAnimationFrame(step);
}

export function playNightMotion(root, { motion = 'off', key = '' } = {}) {
  const view = root.querySelector('.night');
  if (!view) return;
  const same = memory.key === key;
  const play = same && motionAllows(motion);
  // the rows of the ranking (FLIP: first the old places, then the new, the difference is animated)
  const rows = [...root.querySelectorAll('.night-rows > li[data-row]')];
  const order = rows.map(item => item.dataset.row);
  rows.forEach((item, index) => {
    const id = item.dataset.row, bar = item.querySelector('.night-bar i'), width = bar ? parseFloat(bar.style.width) : 0, top = item.getBoundingClientRect().top;
    const before = memory.rows.get(id);
    if (play && before) {
      if (Math.abs(before.width - width) > 0.4 && bar) animate(bar, [{ width: `${before.width}%` }, { width: `${width}%` }], { duration: 900, easing: 'ease-out' });
      if (Math.abs(before.top - top) > 2) animate(item, [{ transform: `translateY(${before.top - top}px)` }, { transform: 'translateY(0)' }], { duration: 750, easing: 'ease-in-out' });
      const was = memory.order.indexOf(id);
      if (was >= 0 && was > index) { item.classList.add('is-overtake'); animate(item, [{ backgroundColor: 'rgba(240,214,138,.34)' }, { backgroundColor: 'rgba(240,214,138,0)' }], { duration: 1800, easing: 'ease-out', composite: 'add' }); setTimeout(() => item.classList.remove('is-overtake'), 1900); }
    }
    memory.rows.set(id, { width, top });
  });
  memory.order = order;
  // the numbers
  for (const node of root.querySelectorAll('[data-count]')) {
    const id = node.dataset.countId ?? node.dataset.count, to = Number(node.dataset.count), kind = node.dataset.fmt ?? 'int';
    node.dataset.final = node.textContent;
    const from = memory.counts.get(id);
    if (play && Number.isFinite(from) && Math.abs(from - to) > 0.001) countUp(node, from, to, kind);
    memory.counts.set(id, to);
  }
  // the progress bars of the count
  for (const bar of root.querySelectorAll('.sx-bar i, .night-curve i')) {
    const id = bar.closest('[data-bar-id]')?.dataset.barId ?? `${bar.parentElement?.className}-${[...(bar.parentElement?.parentElement?.children ?? [])].indexOf(bar.parentElement)}`;
    const width = parseFloat(bar.style.width ?? bar.style.height) || 0, prop = bar.style.height && !bar.style.width ? 'height' : 'width';
    const before = memory.bars.get(id);
    if (play && Number.isFinite(before) && Math.abs(before - width) > 0.4) animate(bar, [{ [prop]: `${before}%` }, { [prop]: `${width}%` }], { duration: 900, easing: 'ease-out' });
    memory.bars.set(id, width);
  }
  // the squares of the units that were counted since the last draw pop one after the other
  const tiles = [...root.querySelectorAll('.night-unit.on')];
  if (play && tiles.length > memory.units) tiles.slice(memory.units).slice(0, 30).forEach((tile, i) => animate(tile, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.35)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 520, delay: i * 35, easing: 'ease-out' }));
  memory.units = tiles.length;
  // the news that arrived slide in
  const feed = [...root.querySelectorAll('[data-feed]')];
  feed.forEach((item, i) => {
    if (play && !memory.feed.has(item.dataset.feed)) animate(item, [{ transform: 'translateX(-18px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 520, delay: Math.min(i, 5) * 80, easing: 'ease-out' });
    memory.feed.add(item.dataset.feed);
  });
  memory.key = key;
}
// A different night (or a different career) starts from nothing: the first draw of it never animates.
export const resetNightMotion = () => { memory.key = null; memory.rows.clear(); memory.order = []; memory.units = 0; memory.feed.clear(); memory.counts.clear(); memory.bars.clear(); };
