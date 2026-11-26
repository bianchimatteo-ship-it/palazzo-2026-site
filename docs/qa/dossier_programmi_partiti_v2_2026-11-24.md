# Politicando 2026 — dossier operativo sui programmi politici

**Data di ricognizione: 24 novembre 2026.** Questo documento è una base verificabile per completare i programmi nel gioco. **Non è un programma elettorale unico né afferma che tutti i 76 record siano partiti nazionali attivi.** Distingue documenti ufficiali, materiali tematici, piattaforme di coalizione, programmi storici e contenuti in elaborazione.

## 1. Regola di attendibilità

- Non inventare posizioni ufficiali. Una fonte ufficiale prova soltanto ciò che dice e nell’ambito per cui è stata pubblicata.
- Distinguere sempre: programma nazionale approvato; programma elettorale storico; manifesto/valori; pagina di proposte tematiche; documento di coalizione; consultazione interna; programma in elaborazione; programma simulato del gioco.
- Se una fonte non copre un tema, usare `null` / “non documentato”, non 0, non neutrale e non una posizione dedotta dall’asse destra-sinistra.
- Non trasferire automaticamente posizioni tra coalizione e singoli partiti, livello nazionale e regionale, partito e movimento, oppure tra anni diversi.
- Il campo `status: active` nel JSON del gioco non prova da solo che il soggetto sia oggi politicamente attivo o presenti un programma corrente. Verificare la situazione e distinguere storico, regionale, alias e soggetto non verificato.

## 2. Fonti primarie verificate e cosa consentono di dire

| Soggetto | Fonte ufficiale | Evidenza utilizzabile | Limite da rispettare |
|---|---|---|---|
| Partito Democratico | [Temi](https://partitodemocratico.it/temi/) e [Cinque punti per l’Italia](https://partitodemocratico.it/cinque-punti-per-litalia/) | La pagina dei temi elenca aree e responsabili; i cinque punti indicano sanità pubblica, istruzione/ricerca, lavoro/salari, politica industriale/conversione ecologica e diritti. | Non è, da sola, un programma approvato e completo su tutti i dieci temi del gioco. Integra solo proposte specifiche reperibili nelle pagine ufficiali. |
| Fratelli d’Italia / centrodestra | [Accordo quadro di programma 2022](https://www.fratelli-italia.it/programmacentrodestra/) | Documento dettagliato di coalizione del 2022, con sezioni su Europa/esteri, riforme istituzionali, fisco, sicurezza e altri temi. | È storico e di coalizione, non un programma autonomo FdI 2026. Etichettarlo con anno e ambito. |
| Movimento 5 Stelle | [NOVA 2026 — risultati della votazione](https://www.movimento5stelle.eu/nova-votazione-delle-proposte-conclusive-del-percorso-partecipato-risultati/) | Consultazione degli iscritti conclusa il 20 settembre 2026; risultati ufficiali per i blocchi tematici. | È una sintesi delle proposte partecipate/votate. Non aggiungere dettagli non presenti nei 20 punti o negli allegati ufficiali. |
| Lega per Salvini Premier | [La Settimana Leghista n. 37](https://legaonline.it/la-settimana-leghista-37/) | Nell’autunno 2026 il partito ha comunicato l’avvio del lavoro per definire un manifesto programmatico per le prossime sfide. | La fonte dice che il manifesto è in preparazione: non presentarlo come già approvato. Il programma 2022 resta storico. |
| Forza Italia | [Forza Italia, Forza di Governo](https://forzaitalia.it/forza-italia-forza-di-governo/) | Raccolta di documenti tematici (fisco, sicurezza, giustizia, energia/ambiente, università/ricerca, PA). | Non trattare tutti i PDF come un unico programma 2026. Per ogni estratto registrare titolo, data, ambito e autore. |
| Noi Moderati | [Programma e battaglie](https://www.noimoderati.it/programma) | Pagina attuale con proposte tematiche su scuola, giovani, famiglia, casa, lavoro/imprese, cybersecurity, ricerca, Europa/esteri, sostenibilità e altri temi. | La stessa pagina collega anche un PDF “Programma Noi Moderati 2022”: non confondere il PDF storico con le battaglie correnti; non inferire temi assenti. |
| Azione | [Proposte](https://www.azione.it/proposte/) | Portale tematico che organizza proposte su economia/lavoro, energia/ambiente, sanità/welfare, diritti/immigrazione, istituzioni, Europa/difesa, innovazione, infrastrutture e istruzione. | Usare le sottopagine specifiche come fonte della singola posizione; il solo indice delle aree non basta a fissare un punteggio. |
| +Europa | [Manifesto](https://www.piueuropa.eu/manifesto) e [tavolo programmatico del centrosinistra, 7 novembre 2026](https://www.piueuropa.eu/centrosinistra_avviato_il_tavolo_per_il_programma_comune_obiettivo_concludere_entro_novembre) | Il manifesto espone principi europeisti e liberaldemocratici. Il 7 novembre 2026 è stato avviato un processo con dieci tavoli tematici. | La fonte del 7 novembre descrive lavori in corso, non un programma comune finale approvato. Non attribuire il programma di coalizione a ciascun partito partecipante. |
| Italia Viva | [Cantieri di Futuro](https://www.italiaviva.it/i_cantieri_di_futuro) | Aree di confronto e contributo tematico (sanità, impresa, fisco, Mezzogiorno, giustizia, famiglia, giovani, ambiente, istruzione, istituzioni, sicurezza, esteri e altro). | È uno spazio di partecipazione e proposta, non automaticamente un programma nazionale unitario approvato. |
| Volt Italia | [Programma](https://www.voltitalia.it/Programma/) | Programma articolato in sei aree: Stato intelligente, rinascita economica, riforma UE, equità sociale, partecipazione e equilibrio globale. | Collegare ai dieci temi solo contenuti effettivamente descritti nelle pagine di dettaglio. |
| Progetto Civico Italia | [Programma — Laboratori Civici Nazionali](https://progettocivicoitalia.it/programma/) e [Carta dei Valori](https://progettocivicoitalia.it/carta-dei-valori/) | Esiste un sito ufficiale con una Carta dei Valori e una pagina Programma. La pagina dichiara che i Laboratori Civici trasformano la Carta in proposte, analisi e indirizzi programmatici e che il lavoro nazionale è in costruzione. Copre lavoro/produttività, fisco, Sud, energia/ambiente, trasporti, giustizia, sanità, scuola/ricerca, giovani, diritti/immigrazione, welfare, PA, digitale, agricoltura, cultura, turismo, sport, difesa, sicurezza urbana, Europa/esteri. | **Non etichettarlo come partito fittizio senza ulteriori verifiche.** È una formazione/entità politica con fonti web proprie; il suo programma è descritto come lavoro dei Laboratori in elaborazione, non come piattaforma finale approvata su tutti i temi. Per le istituzioni, distinguere PA, autonomia locale, trasparenza e partecipazione da forma di governo/premierato: la fonte non basta a dedurre una posizione su quest’ultimo. |

## 3. Dieci temi di Politicando e sottodimensioni

1. Immigrazione: ingressi, asilo, integrazione, cittadinanza, contrasto allo sfruttamento.
2. Sicurezza: ordine pubblico, prevenzione, forze dell’ordine, giustizia penale e sicurezza urbana (separare sottotemi).
3. Economia e fisco: tassazione, spesa, debito, imprese, industria, produttività.
4. Sanità: SSN, finanziamento, personale, territorio, privato accreditato, prevenzione.
5. Lavoro: salari, contrattazione, precarietà, sicurezza, politiche attive, pensioni.
6. Ambiente ed energia: decarbonizzazione, rinnovabili, nucleare, reti, adattamento e tutela ambientale.
7. Europa: integrazione, governance UE, euro, difesa comune, politiche europee.
8. Diritti civili: libertà, parità, famiglia, bioetica, diritti LGBTQ+, privacy e non discriminazione.
9. Istituzioni: **non ridurre a un solo asse**. Registrare separatamente forma di governo/premierato, Parlamento, separazione dei poteri e garanzie, magistratura, autonomia locale/federalismo, pubblica amministrazione e partecipazione.
10. Politica estera: alleanze, NATO, UE, difesa, Ucraina, Mediterraneo, relazioni internazionali.

Per ogni tema conservare sia una sintesi descrittiva sia, solo quando giustificato, una posizione sulla scala interna del gioco −3…+3. La scala è una convenzione di gameplay, non una classificazione usata dai partiti. Non forzare un unico punteggio quando le sottodimensioni sono distinte o la fonte è ambigua.

## 4. Catalogo effettivo nel codice: entità da non confondere

Lo snapshot analizzato contiene **76 record in `src/data/real/parties.json` e 6 record in `src/data/real/political-movements.json`**. Non sono 82 partiti nazionali attuali: nel catalogo ci sono record storici, regionali, alias/MEF e soggetti da verificare. Usare gli ID esistenti e correggere la classificazione senza cancellare lo storico.

### 76 record in `parties.json`

01. **Partito della Rifondazione Comunista - Sinistra Europea** — `party-registro-p1-2014-01-ir` — stato dataset: active; livello: non specificato.
02. **Solidarietà - Libertà, Giustizia e Pace** — `party-registro-p1-2014-02-ir` — stato dataset: active; livello: non specificato.
03. **Alternativa Popolare** — `party-registro-p1-2014-03-ir` — stato dataset: active; livello: non specificato.
04. **Fratelli d'Italia - Alleanza Nazionale** — `party-registro-p1-2014-04-ir` — stato dataset: active; livello: non specificato.
05. **Partito Socialista Italiano** — `party-registro-p1-2014-05-ir` — stato dataset: active; livello: non specificato.
06. **Verdi del Sudtirolo/Alto Adige - Grüne Südtirols - Verdi-Grüne-Vërc** — `party-registro-p1-2014-07-ir` — stato dataset: active; livello: non specificato.
07. **Süd-Tiroler Freiheit -Freies Bündnis für Tirol** — `party-registro-p1-2014-08-ir` — stato dataset: active; livello: non specificato.
08. **Partito Autonomista Trentino Tirolese** — `party-registro-p1-2014-09-ir` — stato dataset: active; livello: regional.
09. **Unione per il Trentino** — `party-registro-p1-2014-10-ir` — stato dataset: historical; livello: non specificato.
10. **Lega Nord per l'Indipendenza della Padania** — `party-registro-p1-2014-11-ir` — stato dataset: active; livello: non specificato.
11. **Europa Verde-Verdi** — `party-registro-p1-2014-13-ir` — stato dataset: active; livello: non specificato.
12. **Movimento Associativo Italiani all'Estero - MAIE** — `party-registro-p1-2015-14-ir` — stato dataset: active; livello: non specificato.
13. **Centro Democratico** — `party-registro-p1-2015-17-ir` — stato dataset: active; livello: non specificato.
14. **Italia dei Valori** — `party-registro-p1-2015-18-ir` — stato dataset: active; livello: non specificato.
15. **Südtiroler Volkspartei** — `party-registro-p1-2015-19-ir` — stato dataset: active; livello: regional.
16. **Progetto Trentino** — `party-registro-p1-2015-21-ir` — stato dataset: historical; livello: non specificato.
17. **Unione Sudamericana Emigrati Italiani** — `party-registro-p1-2015-22-ir` — stato dataset: active; livello: non specificato.
18. **Popolari per l'Italia** — `party-registro-p1-2015-24-ir` — stato dataset: historical; livello: non specificato.
19. **UDC-Unione di Centro** — `party-registro-p1-2015-25-ir` — stato dataset: active; livello: non specificato.
20. **Union Valdôtaine** — `party-registro-p1-2015-26-ir` — stato dataset: active; livello: regional.
21. **Movimento La Puglia in Più** — `party-registro-p1-2015-27-ir` — stato dataset: active; livello: non specificato.
22. **Partito Liberale Italiano** — `party-registro-p1-2015-28-ir` — stato dataset: active; livello: non specificato.
23. **Partito Democratico** — `party-registro-p1-2015-29-ir` — stato dataset: active; livello: non specificato.
24. **Die Freiheitlichen** — `party-registro-p1-2016-31-ir` — stato dataset: active; livello: non specificato.
25. **Possibile** — `party-registro-p1-2016-32-ir` — stato dataset: active; livello: non specificato.
26. **La Puglia prima di tutto** — `party-registro-p1-2016-33-ir` — stato dataset: historical; livello: non specificato.
27. **Stella Alpina** — `party-registro-p1-2016-34-ir` — stato dataset: active; livello: regional.
28. **Fare!** — `party-registro-p1-2016-35-ir` — stato dataset: active; livello: non specificato.
29. **Union Valdôtaine Progressiste** — `party-registro-p1-2016-36-ir` — stato dataset: historical; livello: non specificato.
30. **IDEA - Identità e Azione - popolo e libertà** — `party-registro-p1-2016-37-ir` — stato dataset: active; livello: non specificato.
31. **Conservatori e Riformisti** — `party-registro-p1-2016-38-ir` — stato dataset: historical; livello: non specificato.
32. **ALPE Autonomie - Liberté - Participation - Écologie** — `party-registro-p1-2016-39-ir` — stato dataset: active; livello: non specificato.
33. **Articolo 1 - Movimento Democratico e Progressista** — `party-registro-p1-2017-40-ir` — stato dataset: historical; livello: non specificato.
34. **Lega per Salvini Premier** — `party-registro-p1-2017-41-ir` — stato dataset: active; livello: non specificato.
35. **Democrazia Solidale - Demo.S** — `party-registro-p1-2017-43-ir` — stato dataset: active; livello: non specificato.
36. **Sinistra Italiana** — `party-registro-p1-2017-44-ir` — stato dataset: active; livello: non specificato.
37. **+ Europa** — `party-registro-p1-2018-47-ir` — stato dataset: active; livello: non specificato.
38. **MOUV'** — `party-registro-p1-2018-48-ir` — stato dataset: historical; livello: non specificato.
39. **Patto per il Nord** — `party-registro-p1-2019-49-ir` — stato dataset: active; livello: non specificato.
40. **Dieci volte meglio** — `party-registro-p1-2019-50-ir` — stato dataset: active; livello: non specificato.
41. **AZIONE** — `party-registro-p1-2019-51-ir` — stato dataset: active; livello: non specificato.
42. **Italia Viva** — `party-registro-p1-2019-52-ir` — stato dataset: active; livello: non specificato.
43. **Radicali Italiani** — `party-registro-p1-2019-53-ir` — stato dataset: active; livello: non specificato.
44. **TEAM K** — `party-registro-p1-2020-54-ir` — stato dataset: active; livello: non specificato.
45. **Cambiamo!** — `party-registro-p1-2020-55-ir` — stato dataset: active; livello: non specificato.
46. **Noi Moderati** — `party-registro-p1-2020-56-ir` — stato dataset: active; livello: non specificato.
47. **Siciliani Liberi** — `party-registro-p1-2021-57-ir` — stato dataset: active; livello: non specificato.
48. **Pour l'Autonomie - Per l'Autonomia** — `party-registro-p1-2021-58-ir` — stato dataset: active; livello: non specificato.
49. **Italexit per l'Italia** — `party-registro-p1-2021-59-ir` — stato dataset: active; livello: non specificato.
50. **Coraggio Italia** — `party-registro-p1-2022-60-ir` — stato dataset: active; livello: non specificato.
51. **EUROPEISTI** — `party-registro-p1-2022-61-ir` — stato dataset: active; livello: non specificato.
52. **Alternativa** — `party-registro-p1-2022-62-ir` — stato dataset: active; livello: non specificato.
53. **MoVimento 5 Stelle** — `party-registro-p1-2022-63-ir` — stato dataset: active; livello: non specificato.
54. **Sicilia Vera** — `party-registro-p1-2022-64-ir` — stato dataset: active; livello: non specificato.
55. **Moderati** — `party-registro-p1-2022-65-ir` — stato dataset: active; livello: non specificato.
56. **Italia al Centro** — `party-registro-p1-2022-66-ir` — stato dataset: active; livello: non specificato.
57. **Sud chiama Nord** — `party-registro-p1-2022-67-ir` — stato dataset: active; livello: regional.
58. **L'Italia C'è** — `party-registro-p1-2023-68-ir` — stato dataset: active; livello: non specificato.
59. **Campobase** — `party-registro-p1-2023-69-ir` — stato dataset: active; livello: regional.
60. **Rassemblement Valdôtain** — `party-registro-p1-2024-70-ir` — stato dataset: active; livello: non specificato.
61. **Volt Italia** — `party-registro-p1-2024-71-ir` — stato dataset: active; livello: non specificato.
62. **Patto per l'Autonomia** — `party-registro-p1-2024-72-ir` — stato dataset: active; livello: non specificato.
63. **Democrazia Cristiana con Rotondi** — `party-registro-p1-2024-73-ir` — stato dataset: active; livello: non specificato.
64. **Partito Liberaldemocratico** — `party-registro-p1-2024-74-ir` — stato dataset: active; livello: non specificato.
65. **Forza del Popolo** — `party-registro-p1-2025-75-ir` — stato dataset: active; livello: non specificato.
66. **Sinistra Futura - Costituente per la Nuova Sinistra** — `party-registro-p1-2026-77-ir` — stato dataset: active; livello: non specificato.
67. **Movimento Cinque Stelle** — `party-mef-2025-15` — stato dataset: None; livello: non specificato.
68. **Più Europa** — `party-mef-2025-21` — stato dataset: None; livello: non specificato.
69. **Futuro Nazionale** — `party-futuro-nazionale` — stato dataset: active; livello: non specificato.
70. **Democrazia Sovrana Popolare** — `party-democrazia-sovrana-popolare` — stato dataset: active; livello: non specificato.
71. **Partito Popolare del Nord - Autonomia e Libertà** — `party-partito-popolare-del-nord` — stato dataset: active; livello: non specificato.
72. **Partito Comunista Italiano** — `party-partito-comunista-italiano` — stato dataset: active; livello: non specificato.
73. **Partito Comunista dei Lavoratori** — `party-partito-comunista-dei-lavoratori` — stato dataset: active; livello: non specificato.
74. **Partito Sardo d’Azione** — `party-partito-sardo-d-azione` — stato dataset: active; livello: regional.
75. **ORA!** — `party-ora` — stato dataset: active; livello: non specificato.
76. **Progetto Civico Italia** — `party-progetto-civico-italia` — stato dataset: active; livello: non specificato; non verificato.

### 6 record in `political-movements.json`

01. **Movimento politico Forza Italia** — `party-registro-p1-2015-20-ir` — tipo: movimento/record; stato dataset: active.
02. **Movimento politico Pensiero e Azione** — `party-registro-p1-2017-45-ir` — tipo: movimento/record; stato dataset: active.
03. **Forza Nuova** — `movement-forza-nuova` — tipo: movimento/partito; stato dataset: active.
04. **CasaPound Italia** — `movement-casapound-italia` — tipo: movimento; stato dataset: active.
05. **Potere al Popolo!** — `movement-potere-al-popolo` — tipo: movimento/partito; stato dataset: active.
06. **Rete dei Patrioti** — `movement-rete-dei-patrioti` — tipo: movimento politico; stato dataset: active.

### Normalizzazione obbligatoria

- Distinguere denominazioni legali del registro, nomi usati nel gioco, alias e soggetti effettivamente distinti.
- Verificare almeno: “Movimento Cinque Stelle” / “MoVimento 5 Stelle”; “Più Europa” / “+ Europa”; “Fratelli d’Italia - Alleanza Nazionale” come denominazione storica/alias; “Movimento politico Forza Italia” rispetto a Forza Italia corrente.
- Non fondere partiti regionali, movimenti e partiti nazionali solo perché hanno affinità ideologica.
- Il Registro del Parlamento serve a verificare iscrizioni/statuti e denominazioni, non prova da solo attività corrente, presenza elettorale, ideologia o programma.
- Le fonti MEF relative al 2 per mille provano la presenza in un elenco amministrativo per quello specifico anno, non un programma politico.

## 5. Schema dati consigliato per ogni partito/tema

Per ogni soggetto e per ciascuno dei dieci temi registrare:
- `summaryIt` e `summaryEn` (sintesi fedele e breve);
- `position` numerica oppure `null`;
- `subpositions` quando il tema include posizioni diverse;
- `evidence` (passaggio/concetto concreto che giustifica la sintesi);
- `sourceUrl`, `sourceTitle`, `sourceDate`, `retrievedAt`;
- `scope`: nazionale, regionale, europeo, coalizione, movimento;
- `documentType`: programma approvato, programma elettorale, manifesto, carta valori, proposte, consultazione, documento storico;
- `status`: approvato, in elaborazione, storico, non verificato, simulato;
- `confidence` e motivazione.

Le compatibilità tra partiti devono considerare solo temi documentati e mostrare la copertura effettiva. I valori `null` non vanno trattati come neutralità o compatibilità. Se non esiste evidenza, non assegnare posizione.

## 6. Lavoro da fare nel repository

1. Confrontare ogni ID dei due JSON con fonti e stato reale; non limitarsi ai 10 soggetti maggiori.
2. Produrre una matrice 76 + 6 con: attuale/storico/regionale/movimento/alias/non verificato; disponibilità di fonti programmatiche; temi coperti; data e stato dei documenti.
3. Compilare con fonti verificabili i programmi effettivamente documentati. Per soggetti regionali usare documenti regionali, non nazionali.
4. Per soggetti storici mantenere il programma storico separato dal profilo corrente e non presentarli come partiti attuali se non confermato.
5. Per Progetto Civico Italia usare la Carta dei Valori e i Laboratori come fonte primaria. Segnalare il programma come “in elaborazione” dove appropriato. Non chiamarlo fittizio e non affermare che il tema Istituzioni esprima una posizione sul premierato senza fonte.
6. Per soggetti senza fonti accessibili, non inventare: lasciare non documentato e preparare una lista delle sole lacune da completare manualmente.
7. Aggiornare `party-programs.js`, `party-program-sources.json`, interfaccia e traduzioni senza cambiare gli ID e senza introdurre duplicati.
8. Aggiungere test di provenienza, data/scopo delle fonti, copertura per tema, alias e assenza di posizioni inventate. Il solo test che verifica la presenza di dieci campi non è sufficiente.

## 7. Nota conclusiva

Questo dossier non finge di contenere 76 programmi completi. Le fonti pubbliche verificate sopra sono una base per i soggetti elencati; i record rimanenti devono essere classificati uno per uno. Il criterio corretto è: **programma documentato dove esiste, programma in elaborazione dove la fonte dice che è in elaborazione, storico dove è storico, `null` dove manca evidenza**. Non sacrificare accuratezza per riempire tutti i dieci punteggi.
