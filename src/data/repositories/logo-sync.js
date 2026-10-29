// Synchronisation of the personal logos with the cloud copy of the signed-in account (Worker routes /api/logos, images in R2, metadata in D1; see docs/logo-sync.md).
// The browser's copy (personal-logos.js) stays the cache that works offline; this file only moves images between the two and never decides alone when they differ:
//   - the owner is the session's account (the token), nothing of this module names a user;
//   - an image is uploaded on top of the exact version the device last saw (x-base-version): a different cloud copy is a CONFLICT, both copies are kept and the player chooses;
//   - an upload counts only when the answer carries the checksum and size of what was sent; until then the logo stays `dirty` here, so an error, an outage or a closed page lose nothing and the
//     next run simply tries again (the same image again is never a second version);
//   - a copy that came from an earlier version (legacy) or from the guest scope is removed from its old place only after its upload has been verified;
//   - the guest scope is never synchronised and nothing is uploaded unless an account is signed in.
import { accountApiBase, currentAccount } from './account-sync.js?v=20261029-1';
import { CONFLICT_SUFFIX, LEGACY_SCOPE, logoStore, scopeNow, sha256OfBlob, sniffImage } from './personal-logos.js?v=20261029-1';

const GUEST = '_ospite';
const MAX_BYTES = 300 * 1024;
const state = { running: null, last: null };
export const lastLogoSync = () => state.last;

async function call(path, { method = 'GET', body = null, base = null, query = '', timeout = 20000, token } = {}) {
  const root = accountApiBase();
  if (!root) return { unavailable: true, status: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = { authorization: `Bearer ${token}` };
    if (base !== null) headers['x-base-version'] = String(base);
    if (body) headers['content-type'] = body.type || 'application/octet-stream';
    const response = await fetch(`${root}${path}${query}`, { method, headers, body, signal: controller.signal });
    return { status: response.status, response };
  } catch { return { offline: true, status: 0 }; }
  finally { clearTimeout(timer); }
}
const jsonOf = async response => response.json().catch(() => ({}));

async function download(partyId, meta, token) {
  const result = await call(`/api/logos/${encodeURIComponent(partyId)}`, { token });
  if (result.offline || result.unavailable) return { offline: true };
  if (result.status !== 200) return { error: (await jsonOf(result.response)).error ?? `Download non riuscito (${result.status}).` };
  const blob = await result.response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime || bytes.length > MAX_BYTES) return { error: 'L’immagine ricevuta non è valida.' };
  const typed = new Blob([bytes], { type: mime });
  const sha = await sha256OfBlob(typed);
  if (sha !== (result.response.headers.get('x-logo-sha256') || meta.sha256)) return { error: 'L’immagine ricevuta non corrisponde al suo checksum: scartata.' };
  return { blob: typed, sha, mime, version: Number(result.response.headers.get('x-logo-version')) || meta.version };
}

const recordFromRemote = (scope, partyId, meta, got, previous = null) => ({
  key: logoStore.keyOf(scope, partyId), scope, partyId, blob: got.blob, mimeType: got.mime, width: meta.width || previous?.width || 0, height: meta.height || previous?.height || 0, bytes: got.blob.size,
  fileName: meta.name || previous?.fileName || 'logo', origin: meta.origin || 'file', alt: previous?.alt ?? '', addedAt: previous?.addedAt ?? meta.updatedAt, updatedAt: meta.updatedAt, sha: got.sha, sync: { version: got.version, sha: got.sha }, dirty: false
});

// The two copies differ and neither is known to be the newer: the cloud one is kept beside the local one (nothing is overwritten) until the player chooses.
async function keepConflict(scope, partyId, meta, token, report) {
  const known = (await logoStore.all(`${scope}${CONFLICT_SUFFIX}`).catch(() => [])).find(item => item.partyId === partyId);
  if (known && known.remoteMeta?.version === meta.version && known.sha === meta.sha256) { report.conflicts.push(partyId); return; }
  const got = await download(partyId, meta, token);
  if (got.offline) { report.offline = true; return; }
  if (got.error) { report.errors.push({ partyId, message: got.error }); return; }
  await logoStore.put({ ...recordFromRemote(`${scope}${CONFLICT_SUFFIX}`, partyId, meta, got), key: `${scope}${CONFLICT_SUFFIX}|${partyId}`, scope: `${scope}${CONFLICT_SUFFIX}`, remoteMeta: meta });
  report.conflicts.push(partyId);
}

async function upload(scope, local, remoteVersion, token, report) {
  const query = `?w=${local.width | 0}&h=${local.height | 0}&name=${encodeURIComponent(String(local.fileName ?? '').slice(0, 120))}&origin=${local.fromLegacy || local.fromGuest ? 'import' : local.origin === 'url' ? 'url' : 'file'}`;
  const result = await call(`/api/logos/${encodeURIComponent(local.partyId)}`, { method: 'PUT', body: local.blob, base: remoteVersion, query, token });
  if (result.offline || result.unavailable) { report.offline = true; return 'offline'; }
  const answer = await jsonOf(result.response);
  if (result.status === 409 && answer.code === 'conflict') return 'conflict';
  if (![200, 201].includes(result.status)) { report.errors.push({ partyId: local.partyId, message: answer.error ?? `Caricamento non riuscito (${result.status}).`, retry: result.status >= 500 }); return 'error'; }
  // Verified: the cloud answers with the checksum and size of what it stored; they must be those of the image sent.
  if (answer.sha256 !== local.sha || Number(answer.bytes) !== local.blob.size) { report.errors.push({ partyId: local.partyId, message: 'Il caricamento non è stato verificato (checksum diverso): il logo resta su questo dispositivo.', retry: true }); return 'error'; }
  await logoStore.put({ ...local, sync: { version: answer.version, sha: local.sha }, dirty: false, fromLegacy: undefined, fromGuest: undefined });
  // The earlier copy of a logo that came from the old version goes only now that its upload is verified.
  if (local.fromLegacy) await logoStore.remove(logoStore.keyOf(LEGACY_SCOPE, local.partyId)).catch(() => null);
  report.uploaded.push(local.partyId);
  return 'ok';
}

async function run(scope, token) {
  const report = { scope, uploaded: [], downloaded: [], removed: [], conflicts: [], errors: [], pending: 0, offline: false, unavailable: false, at: new Date().toISOString() };
  const listed = await call('/api/logos', { token });
  if (listed.unavailable || listed.status === 503) { report.unavailable = true; }
  else if (listed.offline) report.offline = true;
  else if (listed.status === 401) { report.signedOut = true; }
  else if (listed.status !== 200) report.errors.push({ message: (await jsonOf(listed.response)).error ?? `Elenco non riuscito (${listed.status}).` });
  const stillSignedIn = () => scopeNow() === scope && currentAccount()?.token === token;
  if (listed.status === 200) {
    const remote = new Map(((await jsonOf(listed.response)).logos ?? []).map(item => [item.partyId, item]));
    const locals = new Map((await logoStore.all(scope)).map(item => [item.partyId, item]));
    for (const partyId of new Set([...remote.keys(), ...locals.keys()])) {
      if (!stillSignedIn()) { report.interrupted = true; break; }
      const R = remote.get(partyId), L = locals.get(partyId);
      try {
        if (L?.deleted) {
          // The player deleted it here. If the cloud copy is still the version that was known, it is deleted too; if it changed meanwhile it is NOT deleted and comes back.
          if (!R || R.deleted) { await logoStore.remove(L.key); continue; }
          if (R.version === L.sync?.version) {
            const gone = await call(`/api/logos/${encodeURIComponent(partyId)}`, { method: 'DELETE', base: R.version, token });
            if (gone.offline) { report.offline = true; report.pending++; continue; }
            if (gone.status === 200) { await logoStore.remove(L.key); report.removed.push(partyId); continue; }
            report.errors.push({ partyId, message: (await jsonOf(gone.response)).error ?? 'Cancellazione online non riuscita.', retry: gone.status >= 500 }); report.pending++; continue;
          }
          const got = await download(partyId, R, token);
          if (got.blob) { await logoStore.put(recordFromRemote(scope, partyId, R, got)); report.downloaded.push(partyId); report.conflicts.push(partyId); } else report.pending++;
          continue;
        }
        if (!L && R && !R.deleted) {
          const got = await download(partyId, R, token);
          if (got.offline) { report.offline = true; continue; }
          if (got.error) { report.errors.push({ partyId, message: got.error }); continue; }
          await logoStore.put(recordFromRemote(scope, partyId, R, got)); report.downloaded.push(partyId); continue;
        }
        if (!L || !L.blob) continue;
        const sha = L.sha ?? await sha256OfBlob(L.blob);
        const local = { ...L, sha };
        if (!R || R.deleted) {
          if (L.sync?.version && R?.deleted && !L.dirty) { await logoStore.remove(L.key); report.removed.push(partyId); continue; }
          const outcome = await upload(scope, local, R?.version ?? 0, token, report);
          if (outcome === 'offline' || outcome === 'error') report.pending++;
          if (outcome === 'conflict') { const fresh = await call(`/api/logos`, { token }); const meta = ((await jsonOf(fresh.response ?? new Response('{}'))).logos ?? []).find(item => item.partyId === partyId); if (meta && !meta.deleted) await keepConflict(scope, partyId, meta, token, report); }
          continue;
        }
        if (R.sha256 === sha) { if (L.dirty || L.sync?.version !== R.version) await logoStore.put({ ...local, sync: { version: R.version, sha }, dirty: false }); if (L.fromLegacy) { await logoStore.put({ ...local, sync: { version: R.version, sha }, dirty: false, fromLegacy: undefined }); await logoStore.remove(logoStore.keyOf(LEGACY_SCOPE, partyId)).catch(() => null); } continue; }
        if (!L.dirty && L.sync && L.sync.sha === sha) {
          const got = await download(partyId, R, token);
          if (got.blob) { await logoStore.put(recordFromRemote(scope, partyId, R, got, L)); report.downloaded.push(partyId); } else { if (got.offline) report.offline = true; if (got.error) report.errors.push({ partyId, message: got.error }); }
          continue;
        }
        if (L.sync?.version === R.version) {
          const outcome = await upload(scope, local, R.version, token, report);
          if (outcome === 'offline' || outcome === 'error') report.pending++;
          if (outcome === 'conflict') await keepConflict(scope, partyId, R, token, report);
          continue;
        }
        await keepConflict(scope, partyId, R, token, report);
      } catch (error) { report.errors.push({ partyId, message: error?.message ?? 'Errore imprevisto.', retry: true }); report.pending++; }
    }
  }
  // What is still waiting: logos changed here and not yet uploaded, markers of deletions not yet sent.
  const after = await logoStore.all(scope).catch(() => []);
  report.pending = after.filter(item => item.deleted || (item.blob && item.dirty)).length;
  report.conflictsOpen = (await logoStore.all(`${scope}${CONFLICT_SUFFIX}`).catch(() => [])).map(item => item.partyId);
  return report;
}

// One synchronisation at a time. Returns what happened (also kept as `lastLogoSync()`): uploaded, downloaded, removed, conflicts, errors, pending, offline, unavailable.
export function syncLogos() {
  const account = currentAccount();
  const scope = scopeNow();
  if (!account || scope === GUEST || scope !== account.username) return Promise.resolve({ skipped: true, reason: 'not-signed-in', uploaded: [], downloaded: [], removed: [], conflicts: [], errors: [], pending: 0 });
  if (state.running) return state.running;
  state.running = run(scope, account.token).then(async report => { if ((report.downloaded.length || report.removed.length || report.uploaded.length || report.conflicts.length) && scopeNow() === scope) await logoStore.reload(scope).catch(() => null); state.last = report; return report; }).catch(error => { state.last = { scope, errors: [{ message: error?.message ?? 'Errore imprevisto.' }], uploaded: [], downloaded: [], removed: [], conflicts: [], pending: 0, at: new Date().toISOString() }; return state.last; }).finally(() => { state.running = null; });
  return state.running;
}

// The player's choice on a conflict. 'local': the image of this device replaces the cloud one (on top of the version that was seen); 'remote': the cloud image replaces this one.
// Either way the choice is explicit; the other copy is dropped only here.
export async function resolveLogoConflict(partyId, choice) {
  const account = currentAccount();
  const scope = scopeNow();
  if (!account || scope !== account.username) throw logoStore.fail('Per scegliere devi aver effettuato l’accesso.');
  const conflictKey = `${scope}${CONFLICT_SUFFIX}|${partyId}`;
  const conflict = (await logoStore.all(`${scope}${CONFLICT_SUFFIX}`)).find(item => item.partyId === partyId);
  const local = (await logoStore.all(scope)).find(item => item.partyId === partyId && item.blob);
  if (!conflict || !local) throw logoStore.fail('Questo conflitto non c’è più.');
  if (choice === 'remote') {
    await logoStore.put({ ...recordFromRemote(scope, partyId, conflict.remoteMeta, { blob: conflict.blob, sha: conflict.sha, mime: conflict.mimeType, version: conflict.remoteMeta.version }, local), alt: local.alt });
    await logoStore.remove(conflictKey);
    await logoStore.reload(scope);
    return { kept: 'remote' };
  }
  if (choice !== 'local') throw logoStore.fail('Scelta non valida.');
  const report = { uploaded: [], errors: [], offline: false };
  const sha = local.sha ?? await sha256OfBlob(local.blob);
  const outcome = await upload(scope, { ...local, sha }, conflict.remoteMeta.version, account.token, report);
  if (outcome === 'ok') { await logoStore.remove(conflictKey); await logoStore.reload(scope); return { kept: 'local' }; }
  throw logoStore.fail(outcome === 'offline' ? 'Sei offline: la scelta non è stata applicata, riprova quando sei online (nessuna copia è stata persa).' : (report.errors[0]?.message ?? 'Il cloud è cambiato di nuovo: aggiorna e riprova (nessuna copia è stata persa).'));
}
export async function listLogoConflicts() {
  const scope = scopeNow();
  if (scope === GUEST) return [];
  const records = await logoStore.all(`${scope}${CONFLICT_SUFFIX}`).catch(() => []);
  return records.filter(item => item.blob).map(item => ({ partyId: item.partyId, src: URL.createObjectURL(item.blob), remoteUpdatedAt: item.remoteMeta?.updatedAt ?? null }));
}
