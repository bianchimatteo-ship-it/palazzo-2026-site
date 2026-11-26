// Whether the Aula overlay (a floor vote or a replayed result) is on screen right now. Kept apart from aula-view.js so the page can ask without loading the Aula: app.js never shows the ad banner
// while it is open, and the Aula itself is loaded only when someone enters it.
let open = false;
export const isAulaOpen = () => open;
export const setAulaOpen = value => { open = Boolean(value); };
