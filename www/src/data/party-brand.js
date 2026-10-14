// Brand colours of parties that the database does not carry: parties.json has no `color` for any of its 75 parties, only (for one) the official logo. Where a logo is in the
// database, its colours are measured on the file itself and written here, with the file they come from: scripts/check-party-identity.mjs measures the PNG again and fails if a
// colour here is not what the logo shows (scripts/lib/logo-color.mjs prints them for a new logo). Nothing is invented: a party without a colour of its own, a logo or a choice
// of its owner or player takes the colour the game gave its line in the charts, and an independent takes none.
export const LOGO_BRAND = Object.freeze({
  'party-futuro-nazionale': Object.freeze({
    primary: '#122c69',
    secondary: '#f9e802',
    asset: './src/data/real/assets/logos/futuro-nazionale.png',
    source: 'Logo ufficiale di Futuro Nazionale (futuronazionale.it/il-logo): blu del tondo (85% dei pixel colorati) e giallo del nome del leader'
  })
});
