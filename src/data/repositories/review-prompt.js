// The invitation to leave a review on Google Play: ONE time for each installation, never at the first launch, only after enough use and only in a quiet moment (no tutorial, scene, vote, night, campaign
// decision, menu or dialog open). It is recorded as SHOWN before anything opens, so a crash, a restart, a logout or a change of account never brings it back. Nothing is asked in return (no stars, no prize) and the
// game is never blocked: «Non ora» just closes it. The memory is the WebView's local storage of this installation (same as the rest of the game's settings): it survives restarts, logouts and updates, and goes with
// the data of the app when the app is uninstalled or its data cleared. No identifier of the device is used to remember it beyond that (no fingerprinting): a reinstall may show it once more, a limit documented in docs/qa/review-prompt.md.
export const REVIEW_URL = 'https://play.google.com/store/apps/details?id=it.matteobianchi.politicando2026';
export const REVIEW_KEY = 'politicando.review.v1';
// «enough use»: at least this many launches of the app (the first one never counts) AND this many weeks played in the career in the open.
export const REVIEW_RULES = Object.freeze({ minLaunches: 3, minWeeks: 8 });

export function createReviewPrompt({ storage = globalThis.localStorage, isPlayStoreApp = () => false, rules = REVIEW_RULES, url = REVIEW_URL } = {}) {
  const read = () => { try { const data = JSON.parse(storage?.getItem(REVIEW_KEY) ?? 'null'); return data && typeof data === 'object' ? data : {}; } catch { return {}; } };
  const write = patch => { try { storage?.setItem(REVIEW_KEY, JSON.stringify({ ...read(), ...patch })); return true; } catch { return false; } };
  let counted = false;
  return {
    url,
    // One launch of the app is counted once for each page load.
    noteLaunch() { if (counted) return read().launches ?? 0; counted = true; const launches = (read().launches ?? 0) + 1; write({ launches }); return launches; },
    // Whether the invitation may be shown now. `quiet`: nothing else is going on (the caller knows); `weeks`: weeks played in the open career.
    due({ quiet = false, weeks = 0 } = {}) {
      const data = read();
      if (!isPlayStoreApp() || data.shownAt || !quiet) return false;
      return (data.launches ?? 0) >= rules.minLaunches && weeks >= rules.minWeeks;
    },
    // Recorded BEFORE the dialog opens. If the record cannot be written the invitation is not shown (it could come back).
    markShown(now = Date.now()) { return write({ shownAt: new Date(now).toISOString() }); },
    markAnswered(answer) { write({ answer }); },
    state: () => ({ ...read() })
  };
}
