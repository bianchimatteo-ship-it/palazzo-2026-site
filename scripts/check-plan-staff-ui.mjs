// The plan of the week, the staff and the treasury operations, as the player meets them, in Chrome. Home: the staff band (skills, the tasks with the skill each needs and the reason one
// cannot be given, what is never delegated); a «+ Piano» on the activities builds a plan in a tray that shows the cost of every step and what is left, names the step that cannot be done
// and blocks the plan, asks for the confirmation and does all of it once; a mandate is given through a confirmation, suspended, resumed and cancelled; Finanze: the treasury operations
// with cost, time, range of the result and risk, started from the card or from the plan, with the register of the outcomes. No horizontal scroll from 320 to 1280 px, and the tray never
// covers the bottom bar of a phone.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Piano, staff e tesoreria nel browser saltati: Chrome non trovato (imposta CHROME_PATH per eseguirli).'); process.exit(0); }
const problems = [];
const check = (condition, message) => { if (!condition) problems.push(message); };
const WIDTHS = [[320, 640, true], [360, 800, true], [375, 812, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1024, 768, false], [1280, 800, false]];

await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause, version, errors } = browser;
  try {
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12', level: 'deputato', weeks: 1, extra: `const s = store.getState(); s.game.resources.funds = 20000; s.game.resources.politicalCapital = 80; store.setBudget('comunicazione', 1); store.setBudget('personale', 1);` });
  await openCareer(browser);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(450); };
  const game = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const g = store.getState().game; return { ap: g.week.ap, funds: g.resources.funds, capital: g.resources.politicalCapital, week: g.week.index, mandates: (g.staff?.mandates ?? []).map(m => ({ id: m.id, status: m.status, task: m.task, spent: m.spent })), ops: (g.finance.operations ?? []).map(o => [o.opId, o.status]), log: g.log.map(l => l.title) }; })()`);

  // ---------- Home: the staff band ----------
  const band = await evaluate(`(() => { const el = document.querySelector('#hq-staff'); const planner = document.querySelector('#hq-planner'); return el ? { text: el.textContent.replace(/\\s+/g, ' '), after: Boolean(planner && (planner.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)), skills: el.querySelectorAll('.staff-skills li').length, tasks: el.querySelectorAll('.staff-task').length, forms: el.querySelectorAll('form[data-staff-form]').length, blocked: [...el.querySelectorAll('.staff-task.is-blocked .staff-problem')].map(p => p.textContent.trim()), limits: el.querySelector('.staff-limits')?.textContent ?? '' } : null; })()`);
  check(band && band.after && band.skills === 5 && band.tasks === 6, `La Home ha il blocco dello staff con 5 competenze e 6 incarichi (${JSON.stringify(band && { skills: band.skills, tasks: band.tasks })}).`);
  check(band && band.forms >= 1 && band.blocked.length >= 1 && band.blocked.every(text => /Compet|Serve|incarichi/.test(text)), `Gli incarichi che non si possono dare dicono perché (${band?.blocked.join(' | ').slice(0, 200)}).`);
  check(band && ['Voti', 'Candidature', 'Accordi', 'irreversibili'].every(word => band.limits.includes(word)), 'Si legge che cosa non si delega mai.');

  // ---------- the plan ----------
  const g0 = await game();
  await click('#hq-planner .hq-category[open] [data-plan-add]');
  let tray = await evaluate(`(() => { const t = document.querySelector('[data-plan-tray]'); return t ? { text: t.textContent.replace(/\\s+/g, ' '), run: !t.querySelector('[data-plan-run]').disabled, buttons: document.querySelectorAll('.plan-add.is-planned').length } : null; })()`);
  check(tray && /1 operazione/.test(tray.text) && tray.run && tray.buttons === 1, `Un’attività nel piano: vassoio con una operazione (${tray?.text.slice(0, 100)}).`);
  await evaluate(`(() => { const adds = [...document.querySelectorAll('#hq-planner .hq-category[open] [data-plan-add]')].filter(b => !b.classList.contains('is-planned')); adds[0]?.click(); return true; })()`);
  await pause(450);
  await evaluate(`document.querySelector('[data-plan-tray] summary')?.click(), true`); await pause(200);
  tray = await evaluate(`(() => { const t = document.querySelector('[data-plan-tray]'); return { items: [...t.querySelectorAll('.plan-list li')].map(li => li.textContent.replace(/\\s+/g, ' ').trim()), after: t.querySelector('.plan-after')?.textContent ?? '', run: !t.querySelector('[data-plan-run]').disabled }; })()`);
  check(tray.items.length === 2 && tray.items.every(item => /giorn|€|cap\.|nessun costo/.test(item)) && /Dopo il piano/.test(tray.after), `Il piano mostra ogni passo con il suo costo e quanto resta (${tray.items.join(' | ')}).`);
  await click('[data-plan-remove="1"]');
  tray = await evaluate(`document.querySelector('[data-plan-tray]')?.textContent.replace(/\\s+/g, ' ')`);
  check(/1 operazione/.test(tray ?? ''), 'Togliere un passo lo toglie dal piano.');
  await click('[data-plan-run]');
  const dialog = await evaluate(`(() => { const d = document.querySelector('.confirm-dialog'); return d ? { title: d.querySelector('h2')?.textContent, lines: [...d.querySelectorAll('.report-lines li')].map(li => li.textContent) } : null; })()`);
  check(dialog && /Eseguire 1 operazione/.test(dialog.title) && dialog.lines.some(line => /Totale/.test(line)) && dialog.lines.some(line => /Dopo il piano/.test(line)), `Prima di eseguire c’è la conferma con i totali (${dialog?.title}).`);
  await click('[data-confirm=ok]');
  await pause(600);
  const g1 = await game();
  check(g1.ap < g0.ap || g1.funds < g0.funds, `Il piano ha usato giorni o fondi (${g0.ap}→${g1.ap}, ${g0.funds}→${g1.funds}).`);
  check(!(await evaluate(`Boolean(document.querySelector('[data-plan-tray]'))`)), 'Eseguito, il piano è vuoto e il vassoio sparisce.');
  // a plan that cannot be done
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.getState().game.week.ap = 1; return true; })()`);
  await evaluate(`document.querySelector('[data-nav="calendario"]')?.click(), true`); await pause(500);
  await evaluate(`document.querySelector('[data-section-tab-value="attivita"]')?.click(), true`); await pause(500);
  await evaluate(`(() => { for (const details of document.querySelectorAll('.hq-category')) details.open = true; return true; })()`);
  for (let i = 0; i < 3; i++) { await evaluate(`(() => { const adds = [...document.querySelectorAll('.hq-activity:not(.is-blocked) [data-plan-add]')].filter(b => !b.classList.contains('is-planned')); adds[0]?.click(); return adds.length; })()`); await pause(450); await evaluate(`(() => { for (const details of document.querySelectorAll('.hq-category')) details.open = true; return true; })()`); }
  const blocked = await evaluate(`(() => { const t = document.querySelector('[data-plan-tray]'); return t ? { is: t.classList.contains('is-blocked'), run: t.querySelector('[data-plan-run]').disabled, text: t.textContent.replace(/\\s+/g, ' ') } : null; })()`);
  check(blocked && blocked.is && blocked.run && /giorni/.test(blocked.text), `Un piano oltre i giorni è bloccato e dice perché (${blocked?.text.slice(0, 160)}).`);
  await click('[data-plan-clear]');

  // ---------- the staff: give, suspend, resume, cancel ----------
  await evaluate(`document.querySelector('[data-nav="panoramica"]')?.click(), true`); await pause(500);
  const before = await game();
  await evaluate(`(() => { const form = document.querySelector('form[data-staff-form]'); form.closest('details').open = true; form.requestSubmit(); return true; })()`);
  await pause(500);
  const staffDialog = await evaluate(`(() => { const d = document.querySelector('.confirm-dialog'); return d ? { title: d.querySelector('h2')?.textContent, text: d.textContent.replace(/\\s+/g, ' ') } : null; })()`);
  check(staffDialog && /Affidare/.test(staffDialog.title) && /voti, candidature, accordi/.test(staffDialog.text) && /non è garantito/.test(staffDialog.text), 'Un incarico allo staff chiede la conferma e dice che cosa non include.');
  check((await game()).mandates.length === before.mandates.length, 'Prima della conferma non è cambiato nulla.');
  await click('[data-confirm=ok]'); await pause(500);
  let after = await game();
  check(after.mandates.length === before.mandates.length + 1 && after.mandates.at(-1).status === 'attivo', 'Confermato, l’incarico è aperto.');
  const card = await evaluate(`(() => { const c = document.querySelector('.staff-mandate.is-attivo'); return c ? { text: c.textContent.replace(/\\s+/g, ' '), pause: Boolean(c.querySelector('[data-staff-status=sospeso]')), cancel: Boolean(c.querySelector('[data-staff-status=annullato]')), edit: Boolean(c.querySelector('[data-staff-edit-form]')) } : null; })()`);
  check(card && card.pause && card.cancel && card.edit && /Obiettivo/.test(card.text) && /speso/.test(card.text), 'La carta dell’incarico mostra obiettivo, spesa e i comandi: sospendi, annulla, modifica.');
  await click('[data-staff-status=sospeso]');
  check((await game()).mandates.at(-1).status === 'sospeso', 'Sospeso.');
  await click('[data-staff-status=attivo]');
  check((await game()).mandates.at(-1).status === 'attivo', 'Ripreso.');
  await evaluate(`(() => { const form = document.querySelector('[data-staff-edit-form]'); form.closest('details').open = true; form.querySelector('[name=weeklyBudget]').value = '260'; form.requestSubmit(); return true; })()`); await pause(500);
  check((await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return store.getState().game.staff.mandates.at(-1).weeklyBudget; })()`)) === 260, 'Il budget si modifica.');
  await click('[data-staff-status=annullato]');
  check(Boolean(await evaluate(`document.querySelector('.confirm-dialog')`)), 'Annullare chiede la conferma.');
  await click('[data-confirm=ok]'); await pause(500);
  check((await game()).mandates.at(-1).status === 'annullato', 'Annullato.');
  // the staff works at the close of the week
  await click('[data-staff-form] ~ *'); // no-op
  await evaluate(`(() => { const form = document.querySelector('form[data-staff-form]'); form.closest('details').open = true; form.requestSubmit(); return true; })()`); await pause(400);
  await click('[data-confirm=ok]'); await pause(400);
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.advance(7); return true; })()`); await pause(600);
  const worked = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const g = store.getState().game; const m = g.staff.mandates.at(-1); return { weeksDone: m.weeksDone, report: m.lastReport?.text ?? '', line: g.lastReport.lines.some(l => /^Staff ·/.test(l)) }; })()`);
  check(worked.weeksDone === 1 && worked.report && worked.line, `Alla chiusura lo staff lavora e riferisce (${worked.report.slice(0, 80)}).`);
  await evaluate(`document.querySelector('[data-nav="panoramica"]')?.click(), true`); await pause(500);
  check(await evaluate(`Boolean(document.querySelector('.staff-mandate .staff-report') && document.querySelector('.staff-mandate').textContent.includes('Settimana'))`), 'Il resoconto è visibile in Home.');

  // ---------- Finanze: the treasury operations ----------
  await evaluate(`document.querySelector('[data-nav="finanze"]')?.click(), true`); await pause(600);
  const ops = await evaluate(`(() => { const cards = [...document.querySelectorAll('.invest-card')].filter(card => card.querySelector('[data-treasury-start]')); return { n: cards.length, texts: cards.map(card => card.textContent.replace(/\\s+/g, ' ')), ready: cards.filter(card => !card.querySelector('[data-treasury-start]').disabled).length, plans: document.querySelectorAll('[data-treasury-start] ~ .plan-add').length }; })()`);
  check(ops.n === 9 && ops.texts.every(text => /Costo/.test(text) && /Tempi/.test(text) && /non è garantito/.test(text) && /Rischio/.test(text)), 'Nove operazioni (quattro raccolte del partito, cinque entrate dichiarate della persona), ognuna con costo, tempi, risultato possibile non garantito e rischio.');
  const f0 = (await game()).funds;
  await click('[data-treasury-start="cena-raccolta"]');
  const f1 = await game();
  check(f0 - f1.funds === 300 && f1.ops.some(([id, status]) => id === 'cena-raccolta' && status === 'in-corso'), `Avviata: 300 € subito, in corso (${f0}→${f1.funds}).`);
  check(await evaluate(`document.querySelector('[data-treasury-start="cena-raccolta"]').disabled && /già in corso/.test(document.querySelector('[data-treasury-start="cena-raccolta"]').title)`), 'Una alla volta, e il pulsante dice perché è spento.');
  check(await evaluate(`/in corso: esito alla settimana/.test(document.querySelector('.operations-register')?.textContent ?? '')`), 'Il registro mostra l’operazione in corso.');
  check(await evaluate(`Boolean(document.querySelector('.panel-allocation, [data-allocation]')) || /RIPARTIZIONE DEL BUDGET/.test(document.body.textContent)`), 'La ripartizione del budget c’è.');

  // ---------- widths ----------
  await evaluate(`document.querySelector('[data-nav="panoramica"]')?.click(), true`); await pause(400);
  await evaluate(`document.querySelector('#hq-planner .hq-category[open] [data-plan-add]')?.click(), true`); await pause(400);
  for (const [width, height, mobile] of WIDTHS) {
    await viewport(width, height, mobile); await pause(300);
    for (const [label, nav] of [['Home', 'panoramica'], ['Finanze', 'finanze'], ['Partito', 'partito']]) {
      await evaluate(`(async () => { document.querySelector('[data-nav="${nav}"]')?.click(); await new Promise(r => setTimeout(r, 450)); for (const d of document.querySelectorAll('#hq-staff details, .hqc-drawer')) d.open = true; await new Promise(r => setTimeout(r, 200)); return true; })()`);
      const view = await evaluate(`(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll('.page-wrap *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.hm-wrap, .table-wrap, [data-scroll-x]')).slice(0, 3).map(el => el.className || el.tagName), tray: (() => { const t = document.querySelector('[data-plan-tray]'); const bar = document.querySelector('.mobile-tabbar'); if (!t) return null; const r = t.getBoundingClientRect(); const b = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect() : null; return { inside: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0, coversBar: Boolean(b && r.bottom > b.top + 1) }; })() }))()`);
      check(!view.overflow, `${width}px · ${label}: scroll orizzontale (${view.wide.join(', ')}).`);
      if (view.tray) { check(view.tray.inside, `${width}px · ${label}: il vassoio esce dallo schermo.`); check(!view.tray.coversBar, `${width}px · ${label}: il vassoio copre la barra in basso.`); }
    }
  }
  check(errors.length === 0, `Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
  } catch (error) { console.error(`Interrotto: ${error.message}\nProblemi finora:\n${problems.join('\n')}`); throw error; }
});
if (problems.length) { console.error(`Piano, staff e tesoreria: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 40).join('\n')}`); process.exit(1); }
console.log('Piano, staff e tesoreria verificati in Chrome: il blocco dello staff in Home (competenze, incarichi con il perché di quelli bloccati, ciò che non si delega); «+ Piano» sulle attività, vassoio con il costo di ogni passo e quanto resta, piano impossibile bloccato con il motivo, conferma e un’unica esecuzione; incarico affidato con conferma, sospeso, ripreso, modificato, annullato, resoconto alla chiusura della settimana; in Finanze nove operazioni con costo, tempi, risultato non garantito e rischio, avviate una alla volta e registrate; nessuno scroll orizzontale da 320 a 1280 px e il vassoio non copre la barra in basso.');
