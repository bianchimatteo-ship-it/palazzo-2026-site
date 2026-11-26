# Verifica normativa di iniziative e referendum (aggiornata il 24/11/2026)

**Esito: verifica completata sui testi ufficiali.** Il 24/11/2026 sono stati letti su **Normattiva** (portale ufficiale, esportazione dell'atto completo, nel browser integrato) il testo vigente della **Costituzione** (artt. 71, 75, 132, 138) e della **L. 25 maggio 1970, n. 352** («Norme sui referendum previsti dalla Costituzione e sulla iniziativa legislativa del popolo», ultimo aggiornamento all'atto del 30/09/2021). Il 23/11 erano bloccati senza browser.

## Confronto punto per punto

| Regola (fonte) | Testo ufficiale, in sintesi | Motore prima | Ora |
|---|---|---|---|
| Iniziativa popolare (art. 71 Cost.; artt. 48-49 L. 352) | Almeno 50.000 elettori; progetto redatto in articoli con relazione; fogli vidimati non oltre sei mesi prima della presentazione; firme presentate al Presidente di una Camera | 50.000 firme, testo in articoli, 26 settimane | ✅ conforme (26 settimane = sei mesi) |
| Referendum abrogativo: chi lo chiede (art. 75 Cost.) | 500.000 elettori o cinque Consigli regionali | Uguale | ✅ |
| Materie escluse (art. 75, c. 2) | Leggi tributarie e di bilancio, amnistia e indulto, autorizzazione a ratificare trattati | Uguale | ✅ |
| Quorum e maggioranza (art. 75, c. 4) | Partecipa la maggioranza degli aventi diritto e prevale la maggioranza dei voti validi | Uguale | ✅ |
| Termine per depositare le firme (art. 28) | Entro tre mesi dal timbro sui fogli | Raccolta di 13 settimane | ✅ conforme; ora applicato anche al deposito differito |
| Finestra di deposito (art. 32) | Dal 1° gennaio al 30 settembre di ogni anno | Deposito in qualunque momento | ❗ **corretto**: fuori finestra il deposito attende il 1° gennaio se le firme sono ancora valide, altrimenti la richiesta decade |
| Cassazione (art. 32) | Esamina dopo il 30 settembre; ordinanza definitiva entro il 15 dicembre | Cinque settimane dopo il deposito | ❗ **corretto**: decisione al 15 dicembre dell'anno del deposito |
| Corte costituzionale (art. 33) | Camera di consiglio entro il 20 gennaio; sentenza pubblicata entro il 10 febbraio | Otto settimane dopo la Cassazione | ❗ **corretto**: sentenza al 10 febbraio dell'anno successivo |
| Data del voto (art. 34) | Una domenica tra il 15 aprile e il 15 giugno | Uguale | ✅ |
| Blocchi elettorali (art. 31) | Nessun deposito nell'anno prima della scadenza delle Camere e nei sei mesi dalla convocazione dei comizi | Non applicati | ❗ **corretto**: applicati con la scadenza naturale della legislatura del gioco e l'apertura della finestra delle politiche (approssimazione della convocazione dei comizi) |
| Sospensione per scioglimento anticipato (art. 34, cc. 2-3) | Il referendum già indetto è sospeso; i termini riprendono 365 giorni dopo l'elezione | Non applicata | 🟡 **non ancora simulata**: documentata qui |
| Effetti (art. 37) | Decreto del Presidente della Repubblica; abrogazione dal giorno dopo la pubblicazione, differibile fino a 60 giorni | Abrogazione al voto | 🟡 semplificazione dichiarata: il gioco applica l'abrogazione all'esito del voto |
| Esito contrario (art. 38) | Nessuna nuova richiesta sulla stessa legge per cinque anni | Non applicato | ❗ **corretto**: divieto di cinque anni quando, con il quorum, prevale il NO |
| Legge abrogata prima del voto (art. 39) | Le operazioni non hanno più corso | Non applicato | 🟡 non simulato: nel gioco una legge oggetto di richiesta non viene abrogata da altri durante la procedura |
| Referendum costituzionale (art. 138 Cost.; artt. 3-5 L. 352) | Due deliberazioni a distanza di almeno tre mesi; richiesta entro tre mesi dalla pubblicazione da un quinto dei membri di una Camera, 500.000 elettori o cinque Consigli regionali; nessun quorum, maggioranza dei voti validi; nessun referendum se si raggiungono i due terzi in seconda votazione; promulgazione se nessuno lo chiede | Uguale | ✅ |
| Data del referendum costituzionale (art. 15) | Indetto entro 60 giorni dall'ordinanza; si vota una domenica tra il 50° e il 70° giorno dopo il decreto | Campagna di 10 settimane dopo la richiesta | ✅ compatibile (70 giorni) |
| Referendum territoriale (art. 132 Cost.; artt. 41-47 L. 352) | Fusione o creazione di Regioni (almeno un milione di abitanti) e passaggio di Province o Comuni tra Regioni | Non implementato | ⚫ **non simulato di proposito**: il gioco non gestisce il cambio di Regione di Province e Comuni; non viene inventata una procedura |
| Petizione (art. 50 Cost.) | Non è un referendum né un'iniziativa legislativa | Non presentata come tale | ✅ |

## Codice e test
- `src/core/referendum-engine.js`: `ABROGATIVE_CALENDAR`, `inDepositWindow`, `cassationDateFor`, `courtDateFor`, `electionBlock` e `fileRequest` con la finestra di deposito; il divieto dell'art. 38 (`banUntil`) è applicato in `store.startReferendum` e in `store.linkReferendumCollection`.
- Test: `check-referendum` (calendario dell'art. 32-34, blocchi dell'art. 31, firme scadute dell'art. 28 e procedura completa sul calendario reale), `check-referendum-link`, `check-referendum-ui`.
- Corte costituzionale: per l'ammissibilità il gioco usa i criteri di chiarezza, omogeneità e materie escluse dell'art. 75. Le sentenze non sono state lette una per una: è una simulazione dichiarata, non una riproduzione della giurisprudenza.
