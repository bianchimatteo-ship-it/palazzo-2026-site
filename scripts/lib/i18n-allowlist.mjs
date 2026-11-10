// The Italian that is allowed to stay in the English interface, each with the reason (nothing else is: check-i18n fails on any other Italian text of the English screens). A pattern is matched against the whole text.
export const ALLOWED_ITALIAN = [
  { pattern: /\bschool bus\b/i, reason: '«bus» è una parola inglese: il testo è già in inglese.' },
  { pattern: /^Azione-Popolari europeisti$/, reason: 'Denominazione ufficiale di un gruppo parlamentare: dato reale, resta intera.' },
  { pattern: /^(in cooldown|In deficit)$/i, reason: 'Parole che in inglese si scrivono allo stesso modo.' },
  { pattern: /^(Il Meridiano|La Gazzetta del Territorio|La Politica [#\d]*|Radio La Politica [#\d]*|Vallée d’Aoste – Autonomie Progrès Fédéralisme)$/, reason: 'Nome proprio: testate inventate del gioco e lista della Valle d’Aosta come compare nei risultati.' },
  { pattern: /^(Conversione in legge|Ratifica ed esecuzione|Modifiche al|Disposizioni|Istituzione)\b/, reason: 'Titolo ufficiale di un atto del Parlamento: resta intero, come pubblicato.' },
  { pattern: /^«[^»]+»(?::|$)/, reason: 'Un titolo tra virgolette (nome di una legge o di una storia) è un nome proprio.' },
  { pattern: /^Mar$/, reason: '«Mar» (marzo abbreviato) è la stessa parola in inglese.' },
  { pattern: /^(Gov\.|Pres\. Consiglio|Sen\.|Dep\.|Ministro|Min\.)\s.*(\bed altri\b|\(Meloni-I\)|\bMeloni-I\b)/, reason: 'Proponente di un atto parlamentare come lo pubblicano Camera e Senato (dato reale, non tradotto).' },
  { pattern: /^(AGRICOLTURA|ALTE|AMBIENTE|AMMINISTRAZIONE STRAORDINARIA|ASILO POLITICO|ASSISTENZA E INCENTIVAZIONE ECONOMICA|CENTRI E STRUTTURE DI UTILITA' SOCIALE|COLLEGI E ORDINI PROFESSIONALI|CONTABILI|DIFESA E SICUREZZA INTERNAZIONALE|ENERGIA ELETTRICA|ENERGIA NUCLEARE|FONDI DI BILANCIO|IMPIANTI NUCLEARI|IMPRESE AGRICOLE|INCIDENTI FERROVIARI|LIBERI PROFESSIONISTI|PETROLIO|PREZZI|RATIFICA DEI TRATTATI)$/, reason: 'Descrittore ufficiale degli atti parlamentari (thesaurus della Camera): dato reale, resta come pubblicato.' },
  { pattern: /\b(Centrodestra|Centrosinistra|Sud chiama Nord|Vallée d'Aoste|Südtiroler)\b/, reason: 'Nome di coalizione o lista così come compare nei risultati elettorali (nome proprio).' },
  { pattern: /\bCommissione\b/, reason: 'Denominazione ufficiale di una commissione parlamentare (nome proprio).' },
  { pattern: /\b(I Governo Meloni|Governo Meloni)\b/, reason: 'Nome di un governo (nome proprio).' },
  { pattern: /\b(Potere al Popolo|Rifondazione Comunista|Progetto Civico)\b/i, reason: 'Nome di un partito o movimento (nome proprio).' },
  { pattern: /\bmovimento 5 Stelle\b/i, reason: 'Nome di un partito (nome proprio), anche in minuscolo a metà frase.' },
  { pattern: /· Misto ·/, reason: 'Gruppo Misto: denominazione ufficiale del gruppo parlamentare.' },
  { pattern: /: «[^»]+»$/, reason: 'Un titolo tra virgolette alla fine della frase (nome di una legge o di una votazione) è un nome proprio.' },
  { pattern: /(NOI CON L'ITALIA|Noi con l'Italia), .*(UDC E |\))-MAIE-CENTRO POPOLARE|^Civici d'Italia-UDC-/i, reason: 'Denominazione ufficiale di un gruppo parlamentare (nome proprio, come pubblicata da Camera e Senato).' },
  { pattern: /^(Popolare|Massimo)$/, reason: 'Frammento di una denominazione ufficiale (gruppo parlamentare) o nome di persona.' }
];
// English words of Italian origin or spelling the phrase book never needs to translate (they are English too): not counted as untranslated Italian.
export const ENGLISH_LOANWORDS = new Set(['bus', 'dossier', 'welfare', 'budget', 'leader', 'leadership', 'governo', 'summit', 'premier']);
