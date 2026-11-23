// Lasciare il partito e aderire a un altro, come lo fa il giocatore: il pulsante è nella Panoramica del Partito (non solo nella scheda «Ruoli e correnti»), la conferma elenca le conseguenze lette dal motore,
// dopo l’uscita il giocatore è indipendente e può scegliere un altro partito e aderire; tutto resta dopo il salvataggio e il ricaricamento.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Cambio di partito nel browser saltato: Chrome non trovato.'); process.exit(0); }
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
await withBrowser(async browser => {
  const { evaluate, waitFor, pause, version, goto, errors } = browser;
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12', level: 'deputato', weeks: 1 });
  await openCareer(browser);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const partyPage = async () => { await evaluate(`document.querySelector('[data-nav="partito"]')?.click(), true`); await pause(900); };
  await partyPage();
  const visible = await evaluate(`(() => { const b = document.querySelector('[data-party-action="leave"]'); const tab = document.querySelector('[data-section-tab-value].active, [data-section-tab-value][aria-selected="true"]')?.dataset.sectionTabValue; return b ? { visible: b.offsetParent !== null, tab: tab ?? 'panoramica', top: Math.round(b.getBoundingClientRect().top), h: Math.round(b.getBoundingClientRect().height) } : null; })()`);
  check(visible && visible.visible && visible.tab === 'panoramica', `«Lascia il partito» è visibile nella Panoramica (${JSON.stringify(visible)}).`);
  check(await evaluate(`Boolean(document.querySelector('[data-party-action="change"]'))`), 'C’è anche «Cambia partito».');
  const was = await S(`return store.getState().game.party.label;`);
  await evaluate(`document.querySelector('[data-party-action="leave"]').click(), true`); await pause(500);
  const dialog = await evaluate(`(() => { const d = document.querySelector('.confirm-dialog'); return d ? { title: d.querySelector('h2')?.textContent, text: d.textContent.replace(/\\s+/g, ' ') } : null; })()`);
  check(dialog && /Lasciare/.test(dialog.title) && /indipendente/.test(dialog.text) && /sostegno interno/i.test(dialog.text), `La conferma elenca le conseguenze (${dialog?.text.slice(0, 160)}).`);
  // annulla non cambia nulla
  await evaluate(`(document.querySelector('.confirm-dialog [data-confirm="cancel"]') ?? document.querySelector('.confirm-dialog [data-confirm]:not([data-confirm="ok"])'))?.click(), true`); await pause(400);
  check(await S(`return Boolean(store.getState().game.party);`), 'Annullando si resta nel partito.');
  await partyPage();
  await evaluate(`document.querySelector('[data-party-action="leave"]').click(), true`); await pause(500);
  await evaluate(`document.querySelector('.confirm-dialog [data-confirm="ok"]').click(), true`); await pause(900);
  const after = await S(`const s = store.getState(); return { party: s.game.party, past: s.game.pastParties.map(p => p.label), world: s.world?.playerPartyId ?? null, careerParty: s.career.partyId ?? null };`);
  check(after.party === null && after.past.includes(was) && !after.world && !after.careerParty, `Dopo l’uscita il giocatore è indipendente (${JSON.stringify(after)}).`);
  const indep = await evaluate(`({ join: Boolean(document.querySelector('[data-party-join]')), text: document.querySelector('.party-position')?.textContent.replace(/\\s+/g, ' ').slice(0, 120) })`);
  check(indep.join && /indipendente/i.test(indep.text ?? ''), `La pagina Partito dice che sei indipendente e propone un altro partito (${indep.text}).`);
  // aderire a un altro partito
  const target = await evaluate(`(() => { const select = document.querySelector('[data-party-join]'); const option = [...select.options].find(o => !o.textContent.includes(${JSON.stringify(was)})); select.value = option.value; return { id: option.value, label: option.textContent }; })()`);
  await evaluate(`document.querySelector('[data-party-action="join"]').click(), true`); await pause(900);
  const joined = await S(`const s = store.getState(); return { label: s.game.party?.label ?? null, id: s.game.party?.partyId ?? null, support: s.game.party?.support ?? null, rank: s.game.party?.rank ?? null };`);
  check(joined.id === target.id && joined.support <= 35, `Adesione al nuovo partito (${joined.label}), con la fiducia ridotta di chi ha già cambiato (sostegno ${joined.support}).`);
  // salva, ricarica
  await S(`store.save(); return true;`);
  await goto(); await openCareer(browser);
  const reloaded = await S(`return store.getState().game.party?.partyId ?? null;`);
  check(reloaded === target.id, `Dopo il ricaricamento il nuovo partito resta (${reloaded}).`);
  check(errors.length === 0, `Nessun errore di pagina (${errors.slice(0, 2).join(' | ').slice(0, 200)}).`);
}, { voter: true });
if (problems.length) { console.error('Cambio di partito (browser) — problemi:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('Cambio di partito verificato nel browser: pulsante in Panoramica, conferma con conseguenze, indipendenza, nuova adesione, salvataggio e ricaricamento.');
