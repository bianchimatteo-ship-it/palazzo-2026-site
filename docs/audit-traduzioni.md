# Audit delle traduzioni inglesi — censimento con evidenze

Generato da `node scripts/census-i18n.mjs` (nessuna rete, nessun servizio esterno, nessuna quota consumata). Elenco completo delle lacune: `docs/audit-traduzioni-lacune.json`.

## Regola

Un testo è **tradotto** solo se nel risultato non resta nulla di italiano (`scripts/lib/i18n-detect.mjs`: parole solo italiane ricavate dal dizionario, articoli e preposizioni italiani, parole grammaticali, con i nomi propri dei dati reali tolti come nomi interi). Un testo che è solo *cambiato* è **incompleto**. Classi: tradotta · dinamica verificata (con tre valori di prova per ogni variabile) · dinamica **non verificabile** (frammento di una frase composta a run time) · incompleta · mancante · consentita (nomi, sigle, denominazioni ufficiali, con motivo in `scripts/lib/i18n-allowlist.mjs`).

## Fonti

1. **Letterali del codice** (163 file di `src/`, `i18n.js` escluso): 8.110 testi italiani, letti con un lexer (mai un pezzo di codice tra due virgolette; il markup è spezzato nei testi che la pagina mostra).
2. **Dizionario**: 15.416 voci (15.397 distinte).
3. **Testi generati giocando**: 30 carriere sul motore reale (deputato, senatore, comunale, provinciale, regionale ed europeo; altri partiti, regioni e seed; da 2 a 7 anni ciascuna: elezioni, formazione e crisi di governo, Presidenza, coalizioni, scissioni e forze nuove, atti locali e opere, congressi, notiziari e articoli), ridotte a **8.845 modelli** togliendo nomi, titoli tra virgolette e numeri.
4. **Schermate**: `check-i18n` percorre pagine, popup, passaggi, tooltip e ARIA in Chrome con la stessa definizione.

## Risultati (censimento completo, rete bloccata)

| | testi | tradotta | dinamica verificata | dinamica non verificabile | incompleta | mancante | consentita |
|---|---|---|---|---|---|---|---|
| Letterali del codice | 8.110 | 7.524 | 530 | 24 | **0** | **0** | 32 |
| Generati giocando (modelli) | 8.845 | 4.608 | 3.645 | 12 | **0** | **0** | 580 |

Aree dei modelli generati: informazione/società 2.734 · partito/carriera/agenda/posta 2.417 · mondo politico 1.557 · Parlamento e governo 1.487 · governo locale 394 · nazionale 166 · Presidenza 83 · altro 7. **La base di riferimento di 1.210 lacune (951 incomplete + 259 mancanti) è stata eliminata**, non mantenuta: `scripts/lib/census-baseline.json` non esiste più e il controllo fallisce a qualunque lacuna (soglia zero).

- **Dizionario**: 19 voci duplicate identiche, 0 in conflitto; 7.256 voci non raggiunte da nessun testo del codice o dei dati (*candidate* inutilizzate, non eliminate).
- Oltre alle 1.210 lacune iniziali, l'estensione del corpus (altri partiti, regioni, 7 anni) ne ha fatte emergere altre 360 circa (titoli degli atti locali, opere, consigli, governi bis/ter, forze simulate, elenchi di partiti, inviti di coalizione…): tutte tradotte.

## Cosa conserva il significato

Il censimento verifica ora anche che **numeri, nomi e titoli** del testo italiano siano nell'inglese, tante volte quante nell'originale (nulla perso, ripetuto o inventato; per le anteprime troncate con «…» l'inglese può tenere meno, mai di più). Questo ha trovato pezzi sbagliati che il solo rilevatore di parole italiane non vedeva (un numero finito al posto di un nome, un segnaposto raddoppiato). `check-i18n-offline` aggiunge 25 frasi con l'inglese esatto atteso (ogni area: leggi, sondaggi, governo, consigli, opere, forze simulate, Presidenza, dossier…).

## Motore (`src/core/i18n.js`)

- Apostrofo dritto e curvo uguali; segni di chiusura in più o in meno non fanno un'altra frase; limite dei modelli a 900 caratteri.
- `residualItalian(text)` dice quale parola italiana è rimasta; una sequenza di parole maiuscole all'inizio («Roma Capitale …») è un nome, non una frase.
- Un testo tradotto a metà va al traduttore automatico per intero; le anteprime troncate («…») si traducono fino all'ultima proposizione intera.
- I numeri romani delle legislature («XIX legislatura») e gli ordinali dei governi («ter», «quater») riusano le frasi scritte una volta; «Governo del Presidente» non diventa «del Presidente Government».
- Un elenco di nomi con voci del dizionario in mezzo si traduce voce per voce; un parametro libero che apre una frase inglese prende la maiuscola.
- Un modello non inghiotte un trattino lungo («—»): le due parti si traducono separatamente.

## Controlli (nuovi o rinforzati)

- `check-i18n`: pagine in Chrome, test del motore.
- `census-i18n`: **zero** lacune nel codice e nei testi generati (nessuna base di riferimento), più la conservazione di numeri e nomi; `CENSUS_EXTRA=n` aggiunge carriere lunghe, `CENSUS_CORPUS_OUT/IN` salva e riusa il corpus.
- `check-i18n-offline` (nuovo, in `check:all`): senza DeepL, senza rete e dopo il riavvio — frasi esatte, DeepL non configurato (503), quota esaurita (429), rete assente, nessun nome o numero inviato, censimento con la rete bloccata (0 tentativi).
- `check-i18n-auto`: modelli anonimi, limiti, cache, fail closed.

## DeepL

Chiamate effettuate: **0**. Consumo previsto per il normale gioco: 0 caratteri (tutto il contenuto verificato è nel dizionario locale). DeepL resta un ripiego per un modello nuovo non ancora nel dizionario: solo modelli anonimi, tetti 10.000 caratteri al giorno e 100.000 al mese, bloccato se non configurato o a quota esaurita.

## Limiti dichiarati

- Non esiste un traduttore locale generale: un testo il cui modello **non** compare nel dizionario (contenuto nuovo aggiunto in futuro, o un percorso di gioco non raggiunto dalle 30 carriere) resta in italiano finché non viene aggiunto, o tradotto con DeepL se configurato. Il censimento prova la copertura dell'inventario verificato, non di ogni possibile partita.
- 36 modelli (24 letterali + 12 generati) sono frammenti concatenati a run time: si verificano solo nelle schermate raggiunte.
- La correttezza stilistica dell'inglese composto oltre alle 25 frasi esatte non è verificabile in automatico: il censimento prova che non resta italiano e che numeri e nomi sono conservati.
