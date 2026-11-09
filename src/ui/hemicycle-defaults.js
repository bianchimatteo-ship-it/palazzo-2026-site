// The default view of the interactive hemicycle (kept apart so that the page state can be built without loading the hemicycle itself: see ui/lazy-views.js).
export const HEMICYCLE_DEFAULTS = Object.freeze({ chamber: null, colorBy: 'gruppo', party: '', group: '', committee: '', vote: '', selected: null, q: '', territory: '', limit: 40 });
