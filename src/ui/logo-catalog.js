// «Loghi dei partiti»: the player's personal catalog. One row per party, movement or list the game can use (the parties made by the player included), with search, preview, state and the actions
// to add, replace or delete the image. The images stay on this device (src/data/repositories/personal-logos.js); this file only draws the page.
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const LOGO_PAGE_SIZE = 12;
const initialsOf = item => String(item.abbreviation || item.name || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 4).toUpperCase() || '?';
const colourOf = item => /^#[\da-f]{6}$/i.test(item.color ?? '') ? item.color : '#264d82';
// The mark drawn when a party has no logo of its own: its initials on its colour. Original, never a lookalike of a real emblem.
export const fallbackMark = (item, size = 'm') => `<span class="logo-fallback is-${size}" style="--logo-fallback:${esc(colourOf(item))}" aria-hidden="true">${esc(initialsOf(item))}</span>`;
const sizeLabel = bytes => bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// The state of the copy in the account: what it is doing, what waits (offline, errors) and when it last ran. Nothing here hides a failure: the logos stay on the device either way.
function syncBlock(sync, syncing) {
  let text, tone = '';
  if (syncing) text = 'Sincronizzazione con il tuo account in corso…';
  else if (!sync) text = 'Sincronizzazione con il tuo account non ancora eseguita.';
  else if (sync.unavailable) text = 'La copia online dei loghi non è attiva su questo sito: i tuoi loghi restano su questo dispositivo.';
  else if (sync.offline) { text = `Sei offline o il servizio non risponde: ${sync.pending ? `${sync.pending} ${sync.pending === 1 ? 'logo attende' : 'loghi attendono'} di essere caricati` : 'i tuoi loghi restano su questo dispositivo'} e si riproverà da soli.`; tone = 'is-warn'; }
  else if (sync.errors?.length) { text = `Sincronizzazione incompleta: ${esc(sync.errors[0].message)}${sync.pending ? ` (${sync.pending} in attesa: nessun logo è stato perso)` : ''}`; tone = 'is-warn'; }
  else text = `I tuoi loghi sono sincronizzati con il tuo account${sync.uploaded?.length || sync.downloaded?.length ? ` (${sync.uploaded.length} caricati, ${sync.downloaded.length} scaricati)` : ''}${sync.pending ? `; ${sync.pending} in attesa` : ''}.`;
  return `<p class="logo-sync ${tone}" data-logo-sync="${syncing ? 'running' : sync?.unavailable ? 'unavailable' : sync?.offline ? 'offline' : sync?.errors?.length ? 'error' : sync ? 'ok' : 'idle'}" role="status">${text} <button type="button" class="text-link" data-action="logo-sync-now" ${syncing ? 'disabled' : ''}>Sincronizza ora</button></p>`;
}


// «Esporta tutti i loghi» / «Importa loghi»: the whole catalog in one zip, and the review of an archive before anything is written (duplicates and conflicts, with the player's choice).
const STATUS_WORD = { new: 'nuovo', same: 'già presente', conflict: 'conflitto', invalid: 'non valido' };
// What the last import did, in numbers, where the logos went and what the account copy is doing (never «done» while it is not).
function outcomeBlock(archive, { sync, syncing, signedIn, persistent }) {
  const o = archive.outcome; if (!o) return '';
  const r = o.report, failed = r.failed.length, written = r.imported.length + r.replaced.length, conflicts = r.replaced.length + r.kept.length + r.skipped.length;
  const numbers = conflicts
    ? `${written} importati · ${r.same.length} già presenti · ${conflicts} in conflitto (${r.replaced.length} sostituiti, ${r.kept.length} mantenuti, ${r.skipped.length} saltati) · ${r.invalid.length} non validi · ${failed} non riusciti.`
    : `${written} importati · ${r.same.length} già presenti · ${conflicts} in conflitto · ${r.invalid.length} non validi · ${failed} non riusciti.`;
  let where, cloud = '', retry = false, tone = failed ? 'wizard-errors' : 'account-message';
  if (!written) where = failed ? 'Nessun logo è stato salvato.' : 'Nessun logo nuovo da salvare.';
  else if (!persistent) { where = 'Questo browser non permette di conservarli: i loghi importati restano solo finché la pagina è aperta.'; tone = 'wizard-errors'; }
  else if (!o.account) where = 'Senza account i loghi importati restano su questo dispositivo: accedi per caricarli sul tuo account e ritrovarli sugli altri dispositivi.';
  else where = `Salvati nel catalogo dell’account «${esc(o.account)}» su questo dispositivo.`;
  if (written && persistent && o.account && signedIn === o.account) {
    if (syncing) cloud = 'Caricamento sull’account in corso…';
    else if (!sync) cloud = 'Il caricamento sull’account non è ancora stato eseguito.';
    else if (sync.unavailable) cloud = 'La copia online dei loghi non è attiva su questo sito: restano su questo dispositivo.';
    else if (sync.offline) { cloud = `Account non raggiungibile: ${sync.pending || written} loghi attendono di essere caricati (non sono persi, si riproverà da solo).`; retry = true; tone = 'wizard-errors'; }
    else if (sync.errors?.length) { cloud = `Caricamento incompleto: ${esc(sync.errors[0].message)}`; retry = true; tone = 'wizard-errors'; }
    else if (sync.pending) { cloud = `${sync.pending} loghi attendono ancora di essere caricati.`; retry = true; }
    else cloud = 'Tutti i loghi importati sono stati caricati sul tuo account.';
  }
  const pendingNote = sync?.errors?.length && sync.pending && cloud ? `<span>${sync.pending} loghi in attesa: non sono persi.</span> ` : '';
  return `<div class="${tone}" role="${tone === 'wizard-errors' ? 'alert' : 'status'}" data-logo-import-outcome><strong>Esito:</strong> <span>${numbers}</span> <span>${where}</span>${cloud ? ` <span>${cloud}</span> ${pendingNote}` : ''}${retry ? ' <button type="button" class="text-link" data-action="logo-sync-now">Riprova il caricamento</button>' : ''}</div>`;
}
function archiveBlock(archive, entities, count, context = {}) {
  if (!archive) return '';
  const nameOf = id => entities.find(item => item.id === id)?.name ?? id;
  const plan = archive.plan;
  const busy = Boolean(archive.busy);
  const toolbar = `<div class="logo-archive-bar" data-logo-archive-bar>
    <button type="button" class="secondary-button" data-action="logo-export" ${busy || !count ? 'disabled' : ''}>Esporta tutti i loghi</button>
    <label class="logo-file"><span class="secondary-button ${busy ? 'is-disabled' : ''}">Importa loghi</span><input type="file" accept=".zip,application/zip" data-logo-import-file ${busy ? 'disabled' : ''} /></label>
    ${archive.replacedCount ? `<button type="button" class="text-link" data-action="logo-restore-replaced" ${busy ? 'disabled' : ''}>Ripristina i ${archive.replacedCount} loghi sostituiti dall’ultima importazione</button>` : ''}
  </div>
  <p class="quiet-copy">L’esportazione crea un solo file ZIP con tutte le immagini, gli identificativi originali dei partiti e un manifest: puoi conservarlo come copia di sicurezza o importarlo in un altro account. Prima di importare vedrai cosa c’è di nuovo e cosa è in conflitto; nulla viene cambiato senza la tua scelta.</p>`;
  const message = archive.error ? `<div class="wizard-errors" role="alert" data-logo-archive-error>${esc(archive.error)}</div>` : archive.notice ? `<p class="account-message" role="status" data-logo-archive-notice>${esc(archive.notice)}</p>` : '';
  const outcome = outcomeBlock(archive, context);
  if (!plan) return `<section class="logo-archive" data-logo-archive>${toolbar}${outcome}${message}</section>`;
  const a = plan.analysis, c = a.counts;
  const shown = a.items.filter(item => item.status === 'conflict' || item.status === 'invalid').slice(0, 40);
  const rows = shown.map(item => item.status === 'conflict'
    ? `<li data-logo-import-row="${esc(item.partyId)}"><strong>${esc(nameOf(item.partyId))}</strong> <small>${esc(STATUS_WORD.conflict)}: hai già un logo diverso</small>
        <select data-logo-import-decision="${esc(item.partyId)}" aria-label="Scelta per ${esc(nameOf(item.partyId))}"><option value="" ${plan.decisions[item.partyId] ? '' : 'selected'}>Come la scelta generale</option><option value="keep" ${plan.decisions[item.partyId] === 'keep' ? 'selected' : ''}>Mantieni quello che hai</option><option value="replace" ${plan.decisions[item.partyId] === 'replace' ? 'selected' : ''}>Sostituisci con quello importato</option><option value="skip" ${plan.decisions[item.partyId] === 'skip' ? 'selected' : ''}>Salta</option></select></li>`
    : `<li data-logo-import-row="${esc(item.partyId)}" class="is-invalid"><strong>${esc(nameOf(item.partyId) || item.partyId || '(senza identificativo)')}</strong> <small>${esc(STATUS_WORD.invalid)}: ${esc(item.reason)}</small></li>`).join('');
  const more = c.conflict + c.invalid - shown.length;
  const report = plan.report;
  const failed = report?.failed?.length ?? 0;
  const summary = `<p data-logo-import-summary><strong>${esc(plan.fileName)}</strong>: ${c.total} loghi · ${c.new} nuovi · ${c.same} già presenti identici · ${c.conflict} in conflitto · ${c.invalid} non validi.${a.overLimit ? ` Attenzione: dopo l’importazione sarebbero ${a.overLimit} loghi e online ne restano al massimo ${150}: gli ultimi non verrebbero caricati sull’account.` : ''}</p>`;
  const policy = c.conflict ? `<fieldset class="logo-import-policy" data-logo-import-policy><legend>Per i loghi in conflitto</legend>${[['keep', 'Mantieni quelli che hai'], ['replace', 'Sostituiscili con quelli importati (i tuoi restano recuperabili)'], ['skip', 'Salta i conflitti']].map(([value, label]) => `<label><input type="radio" name="logo-import-policy" value="${value}" ${plan.policy === value ? 'checked' : ''} ${busy ? 'disabled' : ''} /> ${label}</label>`).join('')}</fieldset>` : '';
  const progress = archive.progress ? `<p class="quiet-copy" role="status" data-logo-import-progress>Importazione in corso: ${archive.progress.done} di ${archive.progress.total}…</p>` : '';
  const result = report ? `<p class="${failed ? 'wizard-errors' : 'account-message'}" role="${failed ? 'alert' : 'status'}" data-logo-import-result>Importati ${report.imported.length}, sostituiti ${report.replaced.length}, mantenuti ${report.kept.length}, saltati ${report.skipped.length}, già presenti ${report.same.length}, non validi ${report.invalid.length}, non riusciti ${failed}.</p>${failed ? `<p class="quiet-copy" data-logo-import-failed>${esc(report.failed[0].message)}</p>` : ''}` : '';
  const actions = `<div class="sx-actions"><button type="button" class="primary-button" data-action="logo-import-apply" ${busy || (!c.new && !c.conflict) ? 'disabled' : ''}>${report ? 'Importa di nuovo' : 'Importa'}</button>${failed ? `<button type="button" class="secondary-button" data-action="logo-import-retry" ${busy ? 'disabled' : ''}>Riprova i ${failed} non riusciti</button>` : ''}<button type="button" class="secondary-button" data-action="logo-import-cancel" ${busy ? 'disabled' : ''}>Chiudi</button></div>`;
  return `<section class="logo-archive" data-logo-archive>${toolbar}<div class="logo-import-plan" data-logo-import-plan>${summary}${policy}${rows ? `<ul class="logo-import-rows">${rows}</ul>` : ''}${more > 0 ? `<p class="quiet-copy">… e altri ${more}.</p>` : ''}${progress}${result}${actions}</div>${outcome}${message}</section>`;
}

export function renderLogoCatalog({ entities = [], infos = [], logoSrc = () => null, query = '', page = 1, selectedId = null, pending = null, error = '', notice = '', busy = '', urlDraft = '', loading = false, signedIn = null, editorHtml = '', legacy = [], persistent = true, guest = [], conflicts = [], sync = null, syncing = false, archive = null } = {}) {
  const byId = new Map(infos.map(info => [info.partyId, info]));
  const q = query.trim().toLocaleLowerCase('it-IT');
  const matches = entities.filter(item => !q || `${item.name ?? ''} ${item.abbreviation ?? ''}`.toLocaleLowerCase('it-IT').includes(q));
  const visible = matches.slice(0, Math.max(1, Number(page) || 1) * LOGO_PAGE_SIZE);
  const selected = entities.find(item => item.id === selectedId) ?? matches[0] ?? entities[0] ?? null;
  const rows = visible.map(item => {
    const info = byId.get(item.id), src = logoSrc(item.id);
    return `<button type="button" class="logo-row ${selected?.id === item.id ? 'is-selected' : ''}" data-logo-party-id="${esc(item.id)}" aria-pressed="${selected?.id === item.id}">
      <span class="logo-row-mark">${src ? `<img src="${esc(src)}" alt="" loading="lazy" />` : fallbackMark(item, 's')}</span>
      <span class="logo-row-text"><strong>${esc(item.name)}</strong><small>${esc(item.kind ?? 'Partito')}${item.abbreviation ? ` · ${esc(item.abbreviation)}` : ''}</small></span>
      <span class="logo-row-state ${info ? 'has-logo' : ''}" data-logo-state="${info ? 'custom' : 'none'}">${info ? '✓ Logo tuo' : 'Grafica originale'}</span>
    </button>`;
  }).join('');
  const info = selected ? byId.get(selected.id) : null;
  const shown = pending?.src ?? (selected ? logoSrc(selected.id) : null);
  const detail = selected ? `<section class="logo-detail" aria-label="Logo di ${esc(selected.name)}">
    <div class="logo-detail-head">
      <div class="logo-preview" data-logo-preview>${shown ? `<img src="${esc(shown)}" alt="${esc(pending ? 'Anteprima del nuovo logo' : `Logo di ${selected.name}`)}" />` : fallbackMark(selected, 'l')}</div>
      <div><h3>${esc(selected.name)}</h3><p class="quiet-copy">${esc(selected.kind ?? 'Partito')}${selected.abbreviation ? ` · ${esc(selected.abbreviation)}` : ''}</p>
        <p class="logo-status" data-logo-status="${pending ? 'pending' : info ? 'custom' : 'none'}">${pending ? 'Modifica in corso: non ancora salvata.' : info ? `Logo tuo, salvato su questo dispositivo (${sizeLabel(info.bytes ?? 0)}, ${info.width}×${info.height} px${info.origin === 'url' ? ', copiato da un indirizzo' : ''}).` : 'Nessun logo: il gioco disegna un segno originale con la sigla e i colori del partito.'}</p></div>
    </div>
    <div class="logo-add" data-logo-drop>
      <label class="logo-file"><span class="secondary-button">Scegli un file</span><input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" data-logo-file ${busy ? 'disabled' : ''} /></label>
      <p class="quiet-copy">PNG, JPEG o WebP, al massimo 5 MB e ${4096} pixel per lato. Puoi anche trascinare qui un’immagine o incollarla dagli appunti.</p>
      <form class="logo-url-form" data-logo-url-form><label>Oppure l’indirizzo di un’immagine<input type="url" name="url" data-logo-url inputmode="url" placeholder="https://…/logo.png" value="${esc(urlDraft)}" autocomplete="off" ${busy ? 'disabled' : ''} /></label><button type="submit" class="secondary-button" ${busy ? 'disabled' : ''}>${busy === 'url' ? 'Importo…' : 'Importa l’immagine'}</button></form>
      <p class="quiet-copy">L’immagine viene copiata sul dispositivo e l’indirizzo non viene conservato: poi non serve più alcun collegamento. Se il sito non permette la copia, scarica il file e caricalo qui.</p>
    </div>
    ${editorHtml}
    <div class="logo-actions"><button type="button" class="primary-button" data-action="logo-save" ${pending && !busy ? '' : 'disabled'}>${info ? 'Conferma e sostituisci' : 'Conferma e salva'}</button>${pending ? '<button type="button" class="secondary-button" data-action="logo-cancel">Annulla</button>' : ''}<button type="button" class="secondary-button" data-action="logo-delete" ${info && !busy ? '' : 'disabled'}>Elimina il mio logo</button></div>
    ${error ? `<div class="wizard-errors" role="alert" data-logo-error>${esc(error)}</div>` : ''}${notice ? `<p class="account-message" role="status" data-logo-notice>${esc(notice)}</p>` : ''}
  </section>` : '<p class="quiet-copy">Nessun partito disponibile.</p>';
  return `<div class="logo-catalog" data-logo-catalog>
    <p class="quiet-copy logo-intro">Qui scegli i loghi che vuoi vedere accanto ai partiti. Sono tuoi e li ritrovi in tutte le tue partite. ${signedIn ? `Sono associati all’account «${esc(signedIn)}»: restano su questo dispositivo (anche senza connessione) e vengono copiati online nel tuo account, così li ritrovi su ogni dispositivo con cui accedi. Nessun altro giocatore li vede e non fanno parte dei salvataggi.` : 'Senza un account restano soltanto su questo dispositivo: non vengono caricati online né condivisi. Con un account puoi averli anche su altri dispositivi.'}</p>
    ${signedIn ? syncBlock(sync, syncing) : ''}
    ${archiveBlock(archive, entities, infos.length, { sync, syncing, signedIn, persistent })}
    <p class="logo-rights" data-logo-rights><strong>Diritti.</strong> Usa soltanto immagini che hai il diritto di utilizzare: il gioco non include loghi di terzi e non verifica da dove provengano quelli che aggiungi.</p>
    ${conflicts.length ? `<section class="logo-legacy logo-conflicts" data-logo-conflict-block><h3>Due versioni diverse dello stesso logo</h3><p class="quiet-copy">Per questi partiti il logo di questo dispositivo e quello del tuo account sono diversi. Nessuno è stato sovrascritto: scegli quale tenere.</p><div class="logo-legacy-list">${conflicts.map(item => `<div class="logo-legacy-item" data-logo-conflict="${esc(item.partyId)}"><strong>${esc(item.name)}</strong><span class="logo-conflict-pair"><span><small>Questo dispositivo</small>${item.localSrc ? `<img src="${esc(item.localSrc)}" alt="Logo di questo dispositivo" />` : ''}</span><span><small>Account online</small><img src="${esc(item.src)}" alt="Logo del tuo account" /></span></span><button type="button" class="secondary-button" data-action="logo-conflict-local">Tieni quello di questo dispositivo</button><button type="button" class="secondary-button" data-action="logo-conflict-remote">Tieni quello dell’account</button></div>`).join('')}</div></section>` : ''}
    ${guest.length ? `<section class="logo-legacy logo-guest" data-logo-guest-block><h3>Loghi aggiunti senza account</h3><p class="quiet-copy">Questi loghi li hai aggiunti su questo dispositivo prima di accedere: non sono stati messi nel tuo account. Importa solo quelli che hai il diritto di usare e vuoi avere su tutti i tuoi dispositivi; l’originale su questo dispositivo resta dov’è.</p><div class="logo-legacy-list">${guest.map(item => `<div class="logo-legacy-item"><span class="logo-row-mark"><img src="${esc(item.src)}" alt="" /></span><span class="logo-row-text"><strong>${esc(item.name)}</strong></span><button type="button" class="secondary-button" data-action="logo-guest-import" data-logo-guest="${esc(item.partyId)}">Importa nel mio account</button></div>`).join('')}</div></section>` : ''}
    ${legacy.length ? `<section class="logo-legacy" data-logo-legacy-block><h3>Loghi trovati dalla versione precedente</h3><p class="quiet-copy">Erano salvati in questo browser, senza sapere di chi fossero né da dove venissero: non sono stati assegnati a nessun account. Tieni solo quelli che hai il diritto di usare; gli altri puoi scartarli.</p><div class="logo-legacy-list">${legacy.map(item => `<div class="logo-legacy-item"><span class="logo-row-mark"><img src="${esc(item.src)}" alt="" /></span><span class="logo-row-text"><strong>${esc(item.name)}</strong></span><button type="button" class="secondary-button" data-action="logo-legacy-claim" data-logo-legacy="${esc(item.partyId)}">Usa per il mio account</button><button type="button" class="secondary-button" data-action="logo-legacy-discard" data-logo-legacy="${esc(item.partyId)}">Scarta</button></div>`).join('')}</div></section>` : ''}
    ${persistent ? '' : '<p class="wizard-errors" role="alert" data-logo-volatile>Questo browser non permette di conservare i loghi: quelli che aggiungi restano solo finché la pagina è aperta.</p>'}
    ${loading ? '<p class="quiet-copy">Carico l’elenco dei partiti…</p>' : `<div class="logo-layout">
      <div class="logo-list"><label class="logo-search">Cerca un partito<input type="search" data-logo-query value="${esc(query)}" placeholder="Nome o sigla" autocomplete="off" /></label>
        <p class="quiet-copy" data-logo-count>${matches.length} su ${entities.length} · ${infos.length} con un logo tuo</p>
        <div class="logo-rows">${rows || '<p class="quiet-copy">Nessun risultato.</p>'}</div>
        ${visible.length < matches.length ? '<button type="button" class="secondary-button" data-action="logo-more">Mostra altri</button>' : ''}</div>
      ${detail}</div>`}
  </div>`;
}
