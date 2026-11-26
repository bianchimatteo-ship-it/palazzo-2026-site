// QA screenshots of the start of a new game: the territory (region, province, comune) and the role/path steps, with and without a choice, at phone and desktop widths, with the measures that
// matter (horizontal overflow, selected cards, touch size). OUT defaults to docs/qa/screenshots/final. Also used by check-wizard-start-ui.mjs.
import { mkdir } from 'node:fs/promises';
import { withBrowser } from './lib/browser.mjs';
const OUT = process.env.OUT ?? new URL('../docs/qa/screenshots/final/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const WIDTHS = (process.env.WIDTHS ?? '390,1280').split(',').map(Number);
export const results = [];
await withBrowser(async b => {
  const { evaluate, viewport, goto, waitFor, pause, screenshot } = b;
  const set = (sel, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await goto(); await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
  for (const width of WIDTHS) {
    await viewport(width, width < 500 ? 844 : 1000); await goto();
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=nuova]"))')); await pause(900);
    await evaluate('document.querySelector("[data-menu=nuova]").click(), true'); await waitFor(() => evaluate('Boolean(document.querySelector("[data-wizard-mode=realistica]"))'));
    await evaluate(`document.querySelector('[data-wizard-mode="realistica"]').click(), true`); await waitFor(() => evaluate('Boolean(document.querySelector("[name=birthDay]"))')); await pause(300);
    // the identity of the character, then on to the territory step
    for (const [sel, value] of [['[name=firstName]', 'Anna'], ['[name=lastName]', 'Bianchi'], ['[name=birthDay]', '12'], ['[name=birthMonth]', '5'], ['[name=birthYear]', '1985']]) await set(sel, value);
    await evaluate(`(() => { const s = document.querySelector('[name=professionChoice], [name=previousProfession]'); if (s && s.tagName === 'SELECT') { s.selectedIndex = Math.min(1, s.options.length - 1); s.dispatchEvent(new Event('change', { bubbles: true })); } return true; })()`);
    const next = async () => { await evaluate(`(() => { const b = document.querySelector('[data-wizard-action="next"]'); b?.click(); return Boolean(b); })()`); await pause(700); };
    await next();
    const goStep = async n => { await evaluate(`(() => { const b = document.querySelector('[data-wizard-goto="${n}"]') ?? [...document.querySelectorAll('.wizard-step')].find(e => e.textContent.includes('${n}')); b?.click(); return Boolean(b); })()`); await pause(600); };
    await pause(300);
    await set('[data-wizard-region]', 'Toscana'); await pause(700);
    await screenshot(`${OUT}wizard-territorio-regione-${width}.png`);
    await set('[data-wizard-municipality-search]', 'Sie'); await pause(700);
    await evaluate(`(() => { const o = [...document.querySelectorAll('[data-municipality-code]')].find(e => e.textContent.includes('Siena')); o?.click(); return Boolean(o); })()`); await pause(800);
    const territory = await evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, chosen: Boolean(document.querySelector('.wizard-place-selected')), small: [...document.querySelectorAll('.municipality-option, [data-wizard-region]')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 40; }).length })`);
    await screenshot(`${OUT}wizard-territorio-scelto-${width}.png`);
    await next(); await pause(400);
    const career = await evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, cards: document.querySelectorAll('.level-card').length, selected: [...document.querySelectorAll('.level-card.selected')].map(e => e.dataset.level ?? e.dataset.startingOffice), height: document.querySelector('.level-cards')?.getBoundingClientRect().height ?? 0 })`);
    await screenshot(`${OUT}wizard-carriera-${width}.png`);
    await evaluate(`document.querySelector('[data-starting-office="iscritto"]')?.click(), true`); await pause(700);
    const member = await evaluate(`({ selected: [...document.querySelectorAll('.level-card.selected')].map(e => e.dataset.level ?? e.dataset.startingOffice), scope: [...document.querySelectorAll('[data-member-scope][aria-pressed="true"]')].map(e => e.dataset.memberScope) })`);
    await evaluate(`document.querySelector('[data-member-scope-box]')?.scrollIntoView({ block: 'center' }), true`); await pause(300);
    await screenshot(`${OUT}wizard-carriera-iscritto-${width}.png`);
    results.push({ width, territory, career, member });
  }
});
for (const r of results) console.log(JSON.stringify(r));
