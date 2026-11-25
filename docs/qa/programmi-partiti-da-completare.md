# Programmi dei partiti — matrice e lacune da completare

Generato da `scripts/report-party-programs.mjs` dai dati del gioco (`src/data/party-programs.js`), 2026-11-24. Fonti: dossier del titolare `docs/qa/dossier_programmi_partiti_v2_2026-11-24.md` e lettura diretta delle pagine ufficiali dove possibile (colonna «lettura» dei documenti).

**Record:** 82 (76 in `parties.json`, 6 in `political-movements.json`) · nazionale 28 · da verificare 19 · regionale 19 · storico 8 · italiani all’estero 2 · alias 2 · movimento 4.

Regole: una posizione numerica c’è solo se un documento del partito indica una direzione sul tema; altrimenti il tema resta **non documentato** (`null`). Il gioco usa per la partita una *stima simulata* dalla collocazione generale, sempre etichettata come tale, mai come posizione del partito. I programmi di coalizione restano entità distinte (il tavolo del centrosinistra del 7/11/2026 è *in elaborazione*).

## Documenti usati

| Documento | Tipo | Data | Ambito | Stato | Lettura |
|---|---|---|---|---|---|
| [Le Tesi del PCI (documento politico, Forlì 2025)](https://www.ilpartitocomunistaitaliano.it/le-tesi-del-pci/) | tesi-congressuali | 2025-02 | nazionale | congressuale | diretta |
| [Carta dei Valori — Progetto Civico Italia](https://progettocivicoitalia.it/carta-dei-valori/) | carta-dei-valori | — | nazionale | approvato | diretta |
| [Programma — I Laboratori Civici Nazionali](https://progettocivicoitalia.it/programma/) | programma-in-elaborazione | — | nazionale | in-elaborazione | diretta |
| [Programma — Le nostre battaglie (Noi Moderati)](https://www.noimoderati.it/programma) | proposte-tematiche | — | nazionale | corrente | diretta |
| [Programma Noi Moderati 2022 (PDF)](https://www.noimoderati.it/programma) | programma-elettorale | 2022 | nazionale | storico | non-letto |
| [Il Programma Volt Italia](https://www.voltitalia.it/Programma/) | programma | — | nazionale ed europeo | corrente (sezioni 2022 e 2024) | diretta |
| [Manifesto di Più Europa](https://www.piueuropa.eu/manifesto) | manifesto | — | nazionale | approvato | diretta |
| [«Una Generazione Avanti», programma elettorale 2022](https://www.piueuropa.eu/una_generazione_avanti_il_programma_elettorale_di_europa) | programma-elettorale | 2022-08-23 | nazionale | storico | dossier |
| [Nova, 20 punti: una alleanza per la Costituzione](https://www.movimento5stelle.eu/nova-20-punti-una-alleanza-per-la-costituzione/) | consultazione | 2026-09-18 | proposte per la coalizione progressista | consultazione degli iscritti | diretta (testo dei 20 punti non leggibile) |
| [Cinque punti per l’Italia; Per il diritto alla salute (30/09/2026); intervista sulla manovra (24/11/2026)](https://partitodemocratico.it/cinque-punti-per-litalia/) | sintesi-programmatica | 2026-11-24 | nazionale | corrente | dossier |
| [Accordo quadro di programma del centrodestra 2022 (sul sito di Fratelli d’Italia)](https://www.fratelli-italia.it/programmacentrodestra/) | programma-coalizione | 2022-08 | coalizione | storico | dossier |
| [La Settimana Leghista n. 37 (13/09/2026): manifesto programmatico in preparazione](https://legaonline.it/la-settimana-leghista-37/) | comunicazione-ufficiale | 2026-09-13 | nazionale | manifesto in elaborazione | dossier |
| [Programma elettorale Lega 2022 (PDF)](https://static.legaonline.it/files/Programma_Lega_2022.pdf) | programma-elettorale | 2022 | nazionale | storico | non-letto |
| [Forza Italia, Forza di Governo — schede tematiche dei Dipartimenti](https://forzaitalia.it/forza-italia-forza-di-governo/) | proposte-tematiche | — | nazionale | corrente | dossier |
| [Proposte — Azione (titoli delle proposte per area)](https://www.azione.it/proposte/) | proposte-tematiche | — | nazionale | corrente | diretta (solo i titoli) |
| [Cantieri di Futuro — Italia Viva](https://www.italiaviva.it/i_cantieri_di_futuro) | percorso-partecipativo | — | nazionale | in-elaborazione | diretta |
| [Europa Verde — 12 priorità per cambiare l’Europa](https://europaverde.it/programma/) | priorita-europee | — | europeo | corrente | dossier |
| [Programma elettorale Alleanza Verdi e Sinistra 2022 (PDF)](https://www.sinistraitaliana.si/wp-content/uploads/2022/09/Programma-Alleanza-Verdi-e-Sinistra.pdf) | programma-coalizione | 2022-09 | coalizione | storico | non-letto |
| [Manifesto del Partito Liberaldemocratico](https://partitoliberaldemocratico.com/manifesto/) | manifesto | — | nazionale | approvato | dossier |
| [B.I.P. — Base Ideologica e Programmatica 2027–2037 (prima e seconda parte di tre)](https://futuronazionale.it/programma/) | base-programmatica | — | nazionale | incompleto (due parti su tre) | dossier (pagina troppo grande per lo strumento) |
| [La nostra proposta — ORA!](https://ora-italia.it/proposta/) | tesi-in-elaborazione | — | nazionale | in-elaborazione | diretta |
| [Documento programmatico Demo.S 2026 (Servizio sanitario nazionale)](https://www.democraziasolidale.it/wp-content/uploads/2026/05/DOCUMENTO-PROGRAMMATICO-DEMOS-2026.pdf) | documento-tematico | 2026-05 | nazionale | approvato | dossier |
| [I dieci principi programmatici — Sud chiama Nord](https://www.sud-chiamanord.it/documentazione/principi-programmatici) | manifesto | — | regionale (Sicilia) | approvato | dossier |

## Matrice dei record

| Record | Tipo | Programma | Temi documentati | Note |
|---|---|---|---|---|
| Partito della Rifondazione Comunista - Sinistra Europea (`party-registro-p1-2014-01-ir`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Solidarietà - Libertà, Giustizia e Pace (`party-registro-p1-2014-02-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Alternativa Popolare (`party-registro-p1-2014-03-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Fratelli d'Italia - Alleanza Nazionale (`party-registro-p1-2014-04-ir`) | nazionale · dataset: active | documentato in parte | 6/10: immigrazione, sicurezza, economia, europa, istituzioni, esteri | Denominazione registrata di Fratelli d’Italia (con la dicitura storica «Alleanza Nazionale»): è il record canonico di FdI. |
| Partito Socialista Italiano (`party-registro-p1-2014-05-ir`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Verdi del Sudtirolo/Alto Adige - Grüne Südtirols - Verdi-Grüne-Vërc (`party-registro-p1-2014-07-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Alto Adige |
| Süd-Tiroler Freiheit -Freies Bündnis für Tirol (`party-registro-p1-2014-08-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Alto Adige |
| Partito Autonomista Trentino Tirolese (`party-registro-p1-2014-09-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Trentino |
| Unione per il Trentino (`party-registro-p1-2014-10-ir`) | storico · dataset: historical | nessuna fonte nel dossier | 0/10 |  |
| Lega Nord per l'Indipendenza della Padania (`party-registro-p1-2014-11-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 | Registrazione ancora attiva; l’attività politica corrente passa per Lega per Salvini Premier. |
| Europa Verde-Verdi (`party-registro-p1-2014-13-ir`) | nazionale · dataset: active | documentato in parte | 6/10: immigrazione, economia, lavoro, ambiente, diritti, esteri |  |
| Movimento Associativo Italiani all'Estero - MAIE (`party-registro-p1-2015-14-ir`) | italiani all’estero · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Centro Democratico (`party-registro-p1-2015-17-ir`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Italia dei Valori (`party-registro-p1-2015-18-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Südtiroler Volkspartei (`party-registro-p1-2015-19-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Alto Adige |
| Progetto Trentino (`party-registro-p1-2015-21-ir`) | storico · dataset: historical | nessuna fonte nel dossier | 0/10 |  |
| Unione Sudamericana Emigrati Italiani (`party-registro-p1-2015-22-ir`) | italiani all’estero · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Popolari per l'Italia (`party-registro-p1-2015-24-ir`) | storico · dataset: historical | nessuna fonte nel dossier | 0/10 |  |
| UDC-Unione di Centro (`party-registro-p1-2015-25-ir`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Union Valdôtaine (`party-registro-p1-2015-26-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Valle d’Aosta |
| Movimento La Puglia in Più (`party-registro-p1-2015-27-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Puglia |
| Partito Liberale Italiano (`party-registro-p1-2015-28-ir`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Partito Democratico (`party-registro-p1-2015-29-ir`) | nazionale · dataset: active | documentato in parte | 4/10: sanita, lavoro, ambiente, diritti |  |
| Die Freiheitlichen (`party-registro-p1-2016-31-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Alto Adige |
| Possibile (`party-registro-p1-2016-32-ir`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| La Puglia prima di tutto (`party-registro-p1-2016-33-ir`) | storico · dataset: historical | nessuna fonte nel dossier | 0/10 |  |
| Stella Alpina (`party-registro-p1-2016-34-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Valle d’Aosta |
| Fare! (`party-registro-p1-2016-35-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Union Valdôtaine Progressiste (`party-registro-p1-2016-36-ir`) | storico · dataset: historical | nessuna fonte nel dossier | 0/10 |  |
| IDEA - Identità e Azione - popolo e libertà (`party-registro-p1-2016-37-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Conservatori e Riformisti (`party-registro-p1-2016-38-ir`) | storico · dataset: historical | nessuna fonte nel dossier | 0/10 |  |
| ALPE Autonomie - Liberté - Participation - Écologie (`party-registro-p1-2016-39-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Valle d’Aosta |
| Articolo 1 - Movimento Democratico e Progressista (`party-registro-p1-2017-40-ir`) | storico · dataset: historical | nessuna fonte nel dossier | 0/10 |  |
| Lega per Salvini Premier (`party-registro-p1-2017-41-ir`) | nazionale · dataset: active | documentato in parte | 2/10: sicurezza, economia |  |
| Democrazia Solidale - Demo.S (`party-registro-p1-2017-43-ir`) | nazionale · dataset: active | documentato in parte | 1/10: sanita |  |
| Sinistra Italiana (`party-registro-p1-2017-44-ir`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| + Europa (`party-registro-p1-2018-47-ir`) | nazionale · dataset: active | documentato in parte | 3/10: europa, diritti, esteri |  |
| MOUV' (`party-registro-p1-2018-48-ir`) | storico · dataset: historical | nessuna fonte nel dossier | 0/10 |  |
| Patto per il Nord (`party-registro-p1-2019-49-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Dieci volte meglio (`party-registro-p1-2019-50-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| AZIONE (`party-registro-p1-2019-51-ir`) | nazionale · dataset: active | documentato in parte | 2/10: immigrazione, lavoro |  |
| Italia Viva (`party-registro-p1-2019-52-ir`) | nazionale · dataset: active | in elaborazione | 0/10 |  |
| Radicali Italiani (`party-registro-p1-2019-53-ir`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| TEAM K (`party-registro-p1-2020-54-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Alto Adige |
| Cambiamo! (`party-registro-p1-2020-55-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Noi Moderati (`party-registro-p1-2020-56-ir`) | nazionale · dataset: active | documentato in parte | 4/10: economia, ambiente, europa, esteri |  |
| Siciliani Liberi (`party-registro-p1-2021-57-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Sicilia |
| Pour l'Autonomie - Per l'Autonomia (`party-registro-p1-2021-58-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Valle d’Aosta |
| Italexit per l'Italia (`party-registro-p1-2021-59-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Coraggio Italia (`party-registro-p1-2022-60-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| EUROPEISTI (`party-registro-p1-2022-61-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Alternativa (`party-registro-p1-2022-62-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| MoVimento 5 Stelle (`party-registro-p1-2022-63-ir`) | nazionale · dataset: active | documenti senza posizioni verificabili | 0/10 |  |
| Sicilia Vera (`party-registro-p1-2022-64-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Sicilia |
| Moderati (`party-registro-p1-2022-65-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Italia al Centro (`party-registro-p1-2022-66-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Sud chiama Nord (`party-registro-p1-2022-67-ir`) | regionale · dataset: active | documentato in parte | 1/10: ambiente | Sicilia |
| L'Italia C'è (`party-registro-p1-2023-68-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Campobase (`party-registro-p1-2023-69-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Trentino |
| Rassemblement Valdôtain (`party-registro-p1-2024-70-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Valle d’Aosta |
| Volt Italia (`party-registro-p1-2024-71-ir`) | nazionale · dataset: active | documentato in parte | 4/10: immigrazione, ambiente, europa, diritti |  |
| Patto per l'Autonomia (`party-registro-p1-2024-72-ir`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Friuli Venezia Giulia |
| Democrazia Cristiana con Rotondi (`party-registro-p1-2024-73-ir`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Partito Liberaldemocratico (`party-registro-p1-2024-74-ir`) | nazionale · dataset: active | documentato in parte | 5/10: economia, ambiente, europa, diritti, esteri |  |
| Forza del Popolo (`party-registro-p1-2025-75-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Sinistra Futura - Costituente per la Nuova Sinistra (`party-registro-p1-2026-77-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Movimento Cinque Stelle (`party-mef-2025-15`) | alias | alias di `party-registro-p1-2022-63-ir` | 0/10 | Denominazione dell’elenco MEF del 2×1000 2025 del MoVimento 5 Stelle. |
| Più Europa (`party-mef-2025-21`) | alias | alias di `party-registro-p1-2018-47-ir` | 3/10: europa, diritti, esteri | Denominazione dell’elenco MEF del 2×1000 2025 di +Europa. |
| Futuro Nazionale (`party-futuro-nazionale`) | nazionale · dataset: active | in elaborazione | 0/10 |  |
| Democrazia Sovrana Popolare (`party-democrazia-sovrana-popolare`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Partito Popolare del Nord - Autonomia e Libertà (`party-partito-popolare-del-nord`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Partito Comunista Italiano (`party-partito-comunista-italiano`) | nazionale · dataset: active | documentato | 10/10: immigrazione, sicurezza, economia, sanita, lavoro, ambiente, europa, diritti, istituzioni, esteri |  |
| Partito Comunista dei Lavoratori (`party-partito-comunista-dei-lavoratori`) | nazionale · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Partito Sardo d’Azione (`party-partito-sardo-d-azione`) | regionale · dataset: active | nessuna fonte nel dossier | 0/10 | Sardegna |
| ORA! (`party-ora`) | nazionale · dataset: active | in elaborazione | 0/10 |  |
| Progetto Civico Italia (`party-progetto-civico-italia`) | nazionale · dataset: active | in elaborazione | 7/10: immigrazione, sicurezza, sanita, ambiente, europa, diritti, esteri | Formazione con sito, Carta dei Valori e Laboratori Civici: programma in elaborazione (non un soggetto fittizio). |
| Movimento politico Forza Italia (`party-registro-p1-2015-20-ir`) | nazionale · dataset: active | documenti senza posizioni verificabili | 0/10 | Movimento politico Forza Italia: è il record canonico di Forza Italia nel gioco (nessun duplicato in parties.json). |
| Movimento politico Pensiero e Azione (`party-registro-p1-2017-45-ir`) | da verificare · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Forza Nuova (`movement-forza-nuova`) | movimento · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| CasaPound Italia (`movement-casapound-italia`) | movimento · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Potere al Popolo! (`movement-potere-al-popolo`) | movimento · dataset: active | nessuna fonte nel dossier | 0/10 |  |
| Rete dei Patrioti (`movement-rete-dei-patrioti`) | movimento · dataset: active | nessuna fonte nel dossier | 0/10 |  |

## Lacune da completare (traccia per la compilazione)

Per ogni tema mancante servono: testo del documento ufficiale (o pagina tematica), titolo, data, URL, tipo (programma approvato, manifesto, proposte, coalizione…), ambito (nazionale/regionale/europeo) e la direzione sulla scala del gioco con una motivazione. I partiti storici o regionali vanno compilati con documenti del loro tempo o territorio.

- **Partito della Rifondazione Comunista - Sinistra Europea** (nazionale) — mancano tutti i dieci temi.
- **Solidarietà - Libertà, Giustizia e Pace** (da verificare) — mancano tutti i dieci temi.
- **Alternativa Popolare** (da verificare) — mancano tutti i dieci temi.
- **Fratelli d'Italia - Alleanza Nazionale** (nazionale) — mancano sanita, lavoro, ambiente, diritti; documenti già noti: Accordo quadro di programma del centrodestra 2022 (sul sito di Fratelli d’Italia).
- **Partito Socialista Italiano** (nazionale) — mancano tutti i dieci temi.
- **Verdi del Sudtirolo/Alto Adige - Grüne Südtirols - Verdi-Grüne-Vërc** (regionale) — mancano tutti i dieci temi.
- **Süd-Tiroler Freiheit -Freies Bündnis für Tirol** (regionale) — mancano tutti i dieci temi.
- **Partito Autonomista Trentino Tirolese** (regionale) — mancano tutti i dieci temi.
- **Unione per il Trentino** (storico) — mancano tutti i dieci temi.
- **Lega Nord per l'Indipendenza della Padania** (da verificare) — mancano tutti i dieci temi.
- **Europa Verde-Verdi** (nazionale) — mancano sicurezza, sanita, europa, istituzioni; documenti già noti: Europa Verde — 12 priorità per cambiare l’Europa; Programma elettorale Alleanza Verdi e Sinistra 2022 (PDF).
- **Movimento Associativo Italiani all'Estero - MAIE** (italiani all’estero) — mancano tutti i dieci temi.
- **Centro Democratico** (nazionale) — mancano tutti i dieci temi.
- **Italia dei Valori** (da verificare) — mancano tutti i dieci temi.
- **Südtiroler Volkspartei** (regionale) — mancano tutti i dieci temi.
- **Progetto Trentino** (storico) — mancano tutti i dieci temi.
- **Unione Sudamericana Emigrati Italiani** (italiani all’estero) — mancano tutti i dieci temi.
- **Popolari per l'Italia** (storico) — mancano tutti i dieci temi.
- **UDC-Unione di Centro** (nazionale) — mancano tutti i dieci temi.
- **Union Valdôtaine** (regionale) — mancano tutti i dieci temi.
- **Movimento La Puglia in Più** (regionale) — mancano tutti i dieci temi.
- **Partito Liberale Italiano** (nazionale) — mancano tutti i dieci temi.
- **Partito Democratico** (nazionale) — mancano immigrazione, sicurezza, economia, europa, istituzioni, esteri; documenti già noti: Cinque punti per l’Italia; Per il diritto alla salute (30/09/2026); intervista sulla manovra (24/11/2026).
- **Die Freiheitlichen** (regionale) — mancano tutti i dieci temi.
- **Possibile** (nazionale) — mancano tutti i dieci temi.
- **La Puglia prima di tutto** (storico) — mancano tutti i dieci temi.
- **Stella Alpina** (regionale) — mancano tutti i dieci temi.
- **Fare!** (da verificare) — mancano tutti i dieci temi.
- **Union Valdôtaine Progressiste** (storico) — mancano tutti i dieci temi.
- **IDEA - Identità e Azione - popolo e libertà** (da verificare) — mancano tutti i dieci temi.
- **Conservatori e Riformisti** (storico) — mancano tutti i dieci temi.
- **ALPE Autonomie - Liberté - Participation - Écologie** (regionale) — mancano tutti i dieci temi.
- **Articolo 1 - Movimento Democratico e Progressista** (storico) — mancano tutti i dieci temi.
- **Lega per Salvini Premier** (nazionale) — mancano immigrazione, sanita, lavoro, ambiente, europa, diritti, istituzioni, esteri; documenti già noti: La Settimana Leghista n. 37 (13/09/2026): manifesto programmatico in preparazione; Programma elettorale Lega 2022 (PDF).
- **Democrazia Solidale - Demo.S** (nazionale) — mancano immigrazione, sicurezza, economia, lavoro, ambiente, europa, diritti, istituzioni, esteri; documenti già noti: Documento programmatico Demo.S 2026 (Servizio sanitario nazionale).
- **Sinistra Italiana** (nazionale) — mancano tutti i dieci temi.
- **+ Europa** (nazionale) — mancano immigrazione, sicurezza, economia, sanita, lavoro, ambiente, istituzioni; documenti già noti: Manifesto di Più Europa; «Una Generazione Avanti», programma elettorale 2022.
- **MOUV'** (storico) — mancano tutti i dieci temi.
- **Patto per il Nord** (da verificare) — mancano tutti i dieci temi.
- **Dieci volte meglio** (da verificare) — mancano tutti i dieci temi.
- **AZIONE** (nazionale) — mancano sicurezza, economia, sanita, ambiente, europa, diritti, istituzioni, esteri; documenti già noti: Proposte — Azione (titoli delle proposte per area).
- **Italia Viva** (nazionale) — mancano tutti i dieci temi; documenti già noti: Cantieri di Futuro — Italia Viva.
- **Radicali Italiani** (nazionale) — mancano tutti i dieci temi.
- **TEAM K** (regionale) — mancano tutti i dieci temi.
- **Cambiamo!** (da verificare) — mancano tutti i dieci temi.
- **Noi Moderati** (nazionale) — mancano immigrazione, sicurezza, sanita, lavoro, diritti, istituzioni; documenti già noti: Programma — Le nostre battaglie (Noi Moderati); Programma Noi Moderati 2022 (PDF).
- **Siciliani Liberi** (regionale) — mancano tutti i dieci temi.
- **Pour l'Autonomie - Per l'Autonomia** (regionale) — mancano tutti i dieci temi.
- **Italexit per l'Italia** (da verificare) — mancano tutti i dieci temi.
- **Coraggio Italia** (da verificare) — mancano tutti i dieci temi.
- **EUROPEISTI** (da verificare) — mancano tutti i dieci temi.
- **Alternativa** (da verificare) — mancano tutti i dieci temi.
- **MoVimento 5 Stelle** (nazionale) — mancano tutti i dieci temi; documenti già noti: Nova, 20 punti: una alleanza per la Costituzione.
- **Sicilia Vera** (regionale) — mancano tutti i dieci temi.
- **Moderati** (da verificare) — mancano tutti i dieci temi.
- **Italia al Centro** (da verificare) — mancano tutti i dieci temi.
- **Sud chiama Nord** (regionale) — mancano immigrazione, sicurezza, economia, sanita, lavoro, europa, diritti, istituzioni, esteri; documenti già noti: I dieci principi programmatici — Sud chiama Nord.
- **L'Italia C'è** (da verificare) — mancano tutti i dieci temi.
- **Campobase** (regionale) — mancano tutti i dieci temi.
- **Rassemblement Valdôtain** (regionale) — mancano tutti i dieci temi.
- **Volt Italia** (nazionale) — mancano sicurezza, economia, sanita, lavoro, istituzioni, esteri; documenti già noti: Il Programma Volt Italia.
- **Patto per l'Autonomia** (regionale) — mancano tutti i dieci temi.
- **Democrazia Cristiana con Rotondi** (nazionale) — mancano tutti i dieci temi.
- **Partito Liberaldemocratico** (nazionale) — mancano immigrazione, sicurezza, sanita, lavoro, istituzioni; documenti già noti: Manifesto del Partito Liberaldemocratico.
- **Forza del Popolo** (da verificare) — mancano tutti i dieci temi.
- **Sinistra Futura - Costituente per la Nuova Sinistra** (da verificare) — mancano tutti i dieci temi.
- **Futuro Nazionale** (nazionale) — mancano tutti i dieci temi; documenti già noti: B.I.P. — Base Ideologica e Programmatica 2027–2037 (prima e seconda parte di tre).
- **Democrazia Sovrana Popolare** (nazionale) — mancano tutti i dieci temi.
- **Partito Popolare del Nord - Autonomia e Libertà** (regionale) — mancano tutti i dieci temi.
- **Partito Comunista dei Lavoratori** (nazionale) — mancano tutti i dieci temi.
- **Partito Sardo d’Azione** (regionale) — mancano tutti i dieci temi.
- **ORA!** (nazionale) — mancano tutti i dieci temi; documenti già noti: La nostra proposta — ORA!.
- **Progetto Civico Italia** (nazionale) — mancano economia, lavoro, istituzioni; documenti già noti: Carta dei Valori — Progetto Civico Italia; Programma — I Laboratori Civici Nazionali.
- **Movimento politico Forza Italia** (nazionale) — mancano tutti i dieci temi; documenti già noti: Forza Italia, Forza di Governo — schede tematiche dei Dipartimenti.
- **Movimento politico Pensiero e Azione** (da verificare) — mancano tutti i dieci temi.
- **Forza Nuova** (movimento) — mancano tutti i dieci temi.
- **CasaPound Italia** (movimento) — mancano tutti i dieci temi.
- **Potere al Popolo!** (movimento) — mancano tutti i dieci temi.
- **Rete dei Patrioti** (movimento) — mancano tutti i dieci temi.
