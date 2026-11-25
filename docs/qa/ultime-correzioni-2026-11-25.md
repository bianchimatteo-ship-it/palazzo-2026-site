# Ultime correzioni e audit pre-release (25/11/2026, sera)

Stato: commit successivo a `ca206248`. Nessun AAB, nessuna build iOS, nessun caricamento sugli store, nessun deploy in produzione.

## 1. Avatar da fotografia

**Causa dei falsi occhiali.** La lettura contava i bordi orizzontali nella fascia degli occhi: sopracciglia, frangia, ombre e capelli li producevano tutti.

**Correzione** (`src/ui/photo-traits.js`). Gli occhiali sono riconosciuti solo se esiste una *montatura*: un contorno scuro chiuso attorno a ciascun occhio (lato alto, basso, sinistro e destro), sottile, con pelle subito fuori e occhio dentro, su entrambi gli occhi alla stessa altezza.
- Sopracciglia: danno solo il lato alto. Frangia o ombra: l'interno del contorno è scuro. Riflessi: non cancellano il contorno.
- Se gli occhi sono coperti da capelli o ombra, o la fascia degli occhi è più scura delle guance, la lettura è **incerta**: il tratto non viene assegnato e l'editor scrive «incerto: scegli tu».
- Ogni lettura incerta (`bassa`), per qualunque tratto, non viene più applicata all'avatar. Prima si applicava anche con fiducia bassa.
- Montatura tonda o rettangolare riconosciuta dagli angoli. Genere, correzione manuale e elaborazione sul dispositivo non cambiano.

**Prove** (`check-photo-avatar`, ritratti sintetici, 780 casi tra cinque carnagioni, quattro colori di capelli, tre luci): zero occhiali inventati, zero montature non riconosciute tra le letture decise.

| Variante | Decisi | Incerti |
|---|---|---|
| Neutra, sopracciglia folte, riflesso sulle lenti, montatura tonda, montatura sottile (con e senza occhiali) | 100% | 0 |
| Frangia sugli occhi | ~55% | ~45% |
| Ombra sugli occhi | 0% | 100% |
| Luce da un lato | ~73% | ~27% |

Gli incerti non sono errori: il tratto resta a chi sceglie.

**Etichetta BETA.** Piccola etichetta in oro (`.beta-tag`) accanto a «Crea l’avatar da una foto» e nell’intestazione dell’editor. Il test verifica che non compaia su avatar finale, Home, Profilo e scene.

**Limite dichiarato.** I ritratti sono sintetici. La lettura su foto vere (luce, risoluzione, montature chiare o colorate, occhiali da sole) non è provata: vedi la checklist dei dispositivi.

## 2. Manuale «Come giocare»

Tutti i 29 capitoli hanno ora tre parti nuove (**Dove si trova**, **Vantaggi e rischi**, **Errori comuni**) e testi più concreti in «Come si usa» (passi numerati) e «Costi» per i temi richiesti: partito, organizzazione, iscritti, tesoreria, attività, calendario, delega dello staff, finanze personali, sondaggi, campagne, elezioni e seggi, Parlamento, Governo, Presidenza, leggi, referendum, fusioni, ricompense. I capitoli restano schede apribili con indice e ricerca; i numeri sono nel testo.

**I numeri vengono dal codice.** `check-guide` legge i motori e verifica nel manuale: 6 giorni a settimana; costi di giro di ascolto, comizio, tour, talk show, sezione, preparazione, squadra; finestra di candidatura di 14 giorni; quota 30 € (0–120, passi di 5, ogni 8 settimane); sezione 55 € a settimana; 10% dell’indennità degli eletti; interessi 1% a settimana; soglia di crisi 2.500 €; depositi e tetto della riserva; richieste di fondi al partito (300, 2.500, 5.000, una ogni 4 settimane, minimo 300 € in cassa); staff da 380 e 850 €; fondazione 6 di capitale + 1.500 € (26 settimane), cambio nome 3 (52), fusione 5 (78), scioglimento 5; ricompense (500 € dopo 5 minuti, +4 di capitale ogni 30, +4 di preparazione ogni 60, +0,15 punti); mandati dello staff (fino a 3, da 1 a 26 settimane); emendamento 2 di capitale.
Gli esercizi guidati (gli scenari) vanno solo alle pagine: non consumano giorni né risorse. Smartphone (390 px) e tablet verificati senza scroll orizzontale. Inglese: 124 testi nuovi, forma con `#` per i numeri; 0 testi incompleti, 0 mancanti.

## 3. Dialoghi

Metodo: carriere vere (comunale, iscritto, provinciale, regionale, deputato, senatore; tre semi), tutte le attività con scena, talk show, dibattiti, comizi; 774 momenti letti con controlli su segnaposto, grammatica, titoli attribuiti, governo/opposizione e «tuo partito» senza partito.

Cause trovate e corrette **nei generatori**:
1. **Regione senza articolo** («Vengono da Lombardia», «La cronaca locale di Lombardia», «un dossier che riguarda Lombardia»). I modelli ora usano le forme corrette per tutte le 20 regioni: dalla Lombardia, dal Veneto, dall’Abruzzo, **nelle Marche**.
2. **«Bandiere e striscioni di la mia lista»**: un nome che porta già l’articolo non può seguire «di». La frase ora dice «con il nome «…»» e la proposta è «del programma».
3. **«ve lo ripeto qui, in Siena»**: un comune è «a Siena» (due modelli).

Il test `check-dialogue-threads` controlla ora tutte le regioni e i nomi con articolo. `check-studio-scenes` (evidenziato = chi parla, tag, fatti pubblici) e `check-dialogue-coherence` restano verdi.
**Non cambiato:** per un parlamentare nazionale all’opposizione il gioco non mostra la riga «Dall’opposizione…». Dipende dalla regola `opp` (solo opposizione locale), usata anche dalle meccaniche: cambiarla sposterebbe le regole di gioco. Resta aperto, non è un errore di testo.

## 4. Privacy e Appodeal

Discordanza confermata: `privacy.html` descriveva un’app senza pubblicità e rimandava a InMobi. Aggiornati (IT/EN): `privacy.html`, `privacy-en.html`, `termini.html`, `terms-en.html`, `docs/google-play.md` (annunci: sì, AD_ID, dipendenze, permessi, versionCode, riga Data safety di Appodeal), `docs/minori-e-privacy.md` (§4), `docs/legale-requisiti.json` (la voce `admob-futuro` ora riguarda Appodeal). `docs/appodeal.md` era già corretto.

Contenuto: Appodeal solo su Android; iOS e sito senza SDK pubblicitari; consenso dal modulo di Appodeal dove richiesto, nessun annuncio prima; dati che l’SDK può raccogliere, secondo l’informativa pubblica di Appodeal; reti collegate AppLovin e Unity Ads; nessun dato del giocatore all’SDK; posizione rimossa; dati del Worker per le ricompense video.
`check-legal` verifica ora che le pagine dicano Appodeal, non presentino InMobi come presente e non affermino «senza pubblicità».

**Fonti.** Letti: informativa di Appodeal (appodeal.com/privacy-policy) e l’elenco dei partner. **Non raggiungibili** (404): le pagine di docs.appodeal.com su Data safety e consenso. Quindi la scheda Sicurezza dei dati **non è stata compilata**, né il quadro di consenso (IAB TCF o altro) è dichiarato.

### Le 9 informazioni indispensabili (`check-legal --release`)
Il controllo resta bloccante: non è stato indebolito.

| Voce | Si può correggere nel codice? | Che cosa manca, e chi lo fornisce |
|---|---|---|
| `indirizzo-titolare` | No | Indirizzo (domicilio o residenza) del titolare per informativa e termini: titolare |
| `cloudflare-dpa` | No | Accordo sul trattamento dei dati con Cloudflare (esistenza e condizioni): titolare |
| `minori` | Parziale (testi già scritti) | Scelta sul pubblico 14+ e sulle norme dei Paesi di distribuzione, con consulente: titolare |
| `diritti-asset` | No | Titolarità e licenze di marchio, illustrazioni e testata; diritti sui loghi degli utenti: titolare |
| `email-fornitore` | No | Condizioni di Google per l’account Gmail del gateway (età dell’intestatario, ruolo di Google) o spostamento su un account adulto: titolare |
| `trader-dsa` | No | Dichiarazione «trader» (DSA) in Play Console e App Store Connect: titolare |
| `eta-pubblico-store` | No | Pubblico di destinazione, IARC, Data safety (compresa Appodeal), privacy label Apple: titolare |
| `rappresentanza-capacita` | No | Rappresentanza dei genitori e capacità contrattuale per fornitori e store: titolare e genitori |
| `admob-futuro` (ora Appodeal) | Fatto: pagine e documenti | «L’app contiene annunci: sì», ID pubblicitario, scheda Data safety dalla guida Appodeal «App Privacy Details», account/contratto Appodeal intestato a un adulto, eventuale app-ads.txt, conferma del quadro di consenso, lettura del manifest unito dell’AAB: titolare |

## 5. Android e Capacitor

- **versionCode 8: non verificabile.** La Play Console non è accessibile (nessun accesso nel browser integrato). Per la regola «verificare prima di aggiornare» **la configurazione nativa resta 1.0.6 (7)**. Per procedere: in Play Console › Rilascio › tracce, controllare che 8 non sia stato usato (nemmeno in una bozza o in un’altra traccia). Poi: `versionCode 8` e `versionName "1.0.7"` in `android/app/build.gradle`, aggiornare i controlli che fissano il valore e costruire l’AAB.
- **Risorse:** `android/app/src/main/assets/public` esiste ed è ora la build `20261125-10` (la cartella è ignorata da git e per questo mancava nello ZIP; non è un errore del progetto). `check-capacitor`, `check:www` e `check:android` verdi.
- **Contenuto del bundle:** nessun `politicando-test`, nessuna porta 8787, nessuna credenziale; unico Worker nominato: quello di produzione. Restava nella Content-Security-Policy l’origine locale di prova (`127.0.0.1:8791`, `localhost:8791`): `build-www.mjs` la toglie ora **nelle build di rilascio** (`POLITICANDO_RELEASE`). Il sito la conserva perché i test la richiedono.
- **Firma:** `keystore.properties` letto senza stampare i segreti. Impronta SHA-256 del certificato di caricamento: `BC:E5:36:B3:6B:0E:CA:4D:13:73:74:34:8F:87:1D:5F:B5:F9:EC:77:5F:5D:1C:33:A3:5C:23:3A:05:A9:91:02`. Il prefisso coincide con quello dell’audit precedente. **Il confronto con il certificato registrato in Play Console (Integrità dell’app) spetta al titolare**: non ho accesso alla console.

## 6. Premio da 2.500 €

Stessa promozione (`grazie-aggiornamento-2026-11`, 2.500 €, chiave `benvenuto`, fondi personali). Idonee: Android 1.0.6 (7) e 1.0.7 (8); iOS 1.0.2 (3) e 1.0.3 (4). `check-welcome-reward` legge i progetti nativi. Una riscossione per account tra aggiornamenti, reinstallazioni e piattaforme; l’ospite può rivederlo dopo una reinstallazione (limite documentato in `premio-benvenuto-deduplicazione.md`). Nessun credito azzerato.

## 7. Backend e ricompense pubblicitarie (sola lettura, produzione)

- Eseguite solo `SELECT` su `sqlite_master`; nessuna modifica.
- Presenti `reward_ads`, `reward_blocks`, `reward_claims`, `reward_community`, `reward_devices`, `reward_time`, tra le altre. **Assente `reward_ad_funds`** (migrazione 0010 non applicata). L’elenco `d1_migrations` della produzione non registra 0006–0010 anche se le tabelle 0006–0009 ci sono: le tabelle sono create dal Worker (`CREATE TABLE IF NOT EXISTS` in `ensureSchema`).
- **Compatibilità:** al primo `ensureSchema` il nuovo Worker crea `reward_ad_funds`; la produzione attuale (versione 26361330) non la usa. Il deploy in produzione non è stato fatto: resta decisione del titolare. Consiglio: applicare la 0010 prima di pubblicare il Worker nuovo.
- Deduplicazione globale delle completion ID (un ID vale una volta, per tipo `sondaggi` o `fondi`), un solo placement `default`, tipo deciso dal pulsante: `check-funds-ad` e `check-appodeal` verdi.

## 8. Verifiche

| Esito | Test |
|---|---|
| **Superati** | `check-photo-avatar`, `check-guide`, `check-dialogue-threads`, `check-studio-scenes`, `check-dialogue-coherence`, `check-legal`, `check-publication`, `check-security`, `check-test-access`, `check-capacitor`, `check-android`, `check-welcome-reward`, `check-funds-ad`, `check-appodeal`, `check-i18n-offline`, `check-i18n-audit`, `check-load`, `check-long-run` |
| **Regressione completa** (338 comandi, quattro esecutori) | 330 PASS, 8 FAIL alla prima esecuzione; tutti rieseguiti da soli, vedi sotto |
| **Instabili sotto carico** | `check-campaign-ui` (2 PASS su 2 da solo; fallisce in parallelo su un campo di selezione), `check-account-isolation`, `check-published-local`, `check-logo-import-visible` (porta 8791 occupata da due test in parallelo; passano da soli), `check-long-run` (supera i 1.500 s con quattro esecutori; da solo termina senza errori) |
| **Difetti reali corretti** | `check-account-deletion` (un collegamento a un host esterno nell’informativa: ora testo semplice), `check-i18n-audit` (due varianti della riga «Prima deliberazione» senza inglese), `check:publication` (portale da ricostruire dopo le modifiche) |
| **Non eseguibili** | Qualunque prova su telefono (fotocamera, selettori nativi, video Appodeal reali, Data safety), PUT su Play Console, `verify:test-deploy` (serve la password del sito di prova) |

Dimensione: avvio 1265 KiB circa, entro il budget (`check-load` verde).

## 9. Build

- **Android AAB 1.0.7 (8): non prodotto.** Motivo: versionCode 8 non verificabile (punto 5).
- **iOS 1.0.3 (4): non prodotto.** La versione nativa è 1.0.2 (3). Alzarla a 1.0.3 (4) rompe un’assunzione di `check-welcome-reward`: il test dà per «idonea» la build successiva a quella del progetto (1.0.4 build 5), che la promozione non include. Il test andrebbe cambiato (il premio finisce all’ultima build dichiarata) e un controllo automatico ha respinto la modifica: serve la tua decisione. Firma già pronta: Apple Distribution (team `29HKABRSNK`) e profilo «Politicando 2026 App Store» valido fino al 16/11/2027.
- Se mancano: nulla di inventato; per l’AAB serve solo la verifica di Play Console; per iOS la decisione sul test e il tuo via libera.
