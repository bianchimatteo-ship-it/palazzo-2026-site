// Brand colours of parties that the database does not carry: parties.json has no `color` for any of its 75 parties. For Futuro Nazionale the colours are a declared choice of the project
// (the official logo is not part of the game: no permission to use it is documented), so no file backs them. Nothing is invented: a party without a colour of its own, a logo or a choice
// of its owner or player takes the colour the game gave its line in the charts, and an independent takes none.
export const LOGO_BRAND = Object.freeze({
  'party-futuro-nazionale': Object.freeze({
    primary: '#122c69',
    secondary: '#f9e802',
    source: 'Colori di rappresentazione scelti dal progetto (blu e giallo, quelli con cui il partito si presenta): il logo ufficiale non è incluso perché non risulta un’autorizzazione al suo uso; il gioco disegna un proprio segno con sigla e colori'
  })
});
