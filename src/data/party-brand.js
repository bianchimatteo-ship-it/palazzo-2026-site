// Brand colours of parties that the database does not carry: parties.json has no `color` for any of its 75 parties. For Futuro Nazionale the colours are a declared choice of the project
// (the official logo is not part of the game: no permission to use it is documented), so no file backs them. Nothing is invented: a party without a colour of its own, a logo or a choice
// of its owner or player takes the colour the game gave its line in the charts, and an independent takes none.
export const LOGO_BRAND = Object.freeze({
  'party-futuro-nazionale': Object.freeze({
    primary: '#122c69',
    secondary: '#f9e802',
    source: 'Colori di rappresentazione scelti dal progetto (blu e giallo, quelli con cui il partito si presenta): il logo ufficiale non è incluso perché non risulta un’autorizzazione al suo uso; il gioco disegna un proprio segno con sigla e colori'
  }),
  // Südtiroler Volkspartei: the identity of the project is black (white lettering). The database has no colour for it; the same colour is read by every map, chart and legend.
  'party-registro-p1-2015-19-ir': Object.freeze({
    primary: '#15191a',
    secondary: '#ffffff',
    source: 'Colore di rappresentazione scelto dal progetto (nero, con scritta chiara): il database dei partiti non riporta un colore'
  })
});
// The colour a force has by identity (a declared brand colour), or null: the single source that maps, charts and legends read before falling back to the colour of the charts.
export const brandPrimary = id => LOGO_BRAND[id]?.primary ?? null;
// A colour that disappears on the dark surface (very dark) or on a light card (very white) gets an edge: 'dark' (the colour is dark: edge light), 'light' (the colour is pale: edge dark), or null.
export function toneEdge(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex ?? '')) return null;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma < 0.2 ? 'dark' : luma > 0.82 ? 'light' : null;
}
