// A walk through the screens of the game in a real browser, collecting the texts the interface shows (text nodes and the attributes a reader sees). Used by the capture of the
// phrases to translate (scripts/i18n-capture.mjs) and by the coverage check (scripts/check-i18n.mjs).
export const COLLECT = `(() => {
  const out = [];
  const skip = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT']);
  const walk = node => {
    if (node.nodeType === 3) { const text = node.nodeValue.replace(/\\s+/g, ' ').trim(); if (text && !node.parentElement?.closest('[data-no-translate]')) out.push(text); return; }
    if (node.nodeType !== 1 || skip.has(node.tagName) || node.hasAttribute('data-no-translate')) return;
    for (const name of ['title', 'aria-label', 'placeholder', 'alt']) { const value = node.getAttribute(name); if (value && value.trim()) out.push(value.replace(/\\s+/g, ' ').trim()); }
    for (const child of node.childNodes) walk(child);
  };
  walk(document.body);
  return out;
})()`;

export const PAGES = ['panoramica', 'profilo', 'carriera', 'partito', 'calendario', 'elezioni', 'sondaggi', 'territori', 'finanze', 'parlamento', 'governo', 'quirinale', 'leggi', 'eventi', 'notizie', 'politici', 'partiti-lista', 'archivio', 'impostazioni'];

// Visits every page and its internal tabs (two levels), opens every folded block and returns the screens { name, texts[] }.
export async function tourCareer({ evaluate, pause }, { pages = PAGES, onScreen }) {
  const closePopups = () => evaluate(`(() => { [...document.querySelectorAll('button')].filter(b => /^(Chiudi|Close)$/.test(b.textContent.trim()) && b.closest('aside,[role=dialog]')).forEach(b => b.click()); return true; })()`);
  const openAll = () => evaluate(`(() => { document.querySelectorAll('details:not([open])').forEach(d => { d.dataset.tourOpened = '1'; d.setAttribute('open', ''); }); return true; })()`);
  const record = async name => { await openAll(); await pause(120); await onScreen(name, await evaluate(COLLECT)); };
  const tabs = () => evaluate(`[...document.querySelectorAll('[data-section-tab]')].map(b => [b.dataset.sectionTab, b.dataset.sectionTabValue])`);
  const click = (name, value) => evaluate(`(() => { const b = [...document.querySelectorAll('[data-section-tab]')].find(x => x.dataset.sectionTab === ${JSON.stringify(name)} && x.dataset.sectionTabValue === ${JSON.stringify(value)}); if (!b) return false; b.click(); return true; })()`);
  for (const page of pages) {
    await closePopups();
    await evaluate(`location.hash = '#${page}'; true`); await pause(900);
    await closePopups();
    await record(page);
    const first = await tabs();
    for (const [name, value] of first) {
      if (!(await click(name, value))) continue;
      await pause(500); await closePopups();
      await record(`${page}/${value}`);
      const nested = (await tabs()).filter(([n, v]) => !first.some(([n0, v0]) => n0 === n && v0 === v));
      for (const [n2, v2] of nested.slice(0, 12)) {
        if (!(await click(n2, v2))) continue;
        await pause(400);
        await record(`${page}/${value}/${v2}`);
      }
    }
  }
}
