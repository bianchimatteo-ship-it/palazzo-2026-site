# Statistiche amministrative private

Stato: **realizzate e spente di default**. La raccolta dell'attività si attiva solo dopo che il titolare ha aggiornato l'informativa (vedi «Prima di attivare»).

## Cosa fanno
- Una scheda «Statistiche» nell'area amministrativa (`#amministrazione`, già riservata al proprietario con PIN verificato dal server). Nessun collegamento dal gioco, dal menu, dal sito pubblico o dalle pagine legali.
- `GET /api/admin/stats?days=90` e `PUT /api/admin/stats` rispondono **solo** con una sessione del proprietario valida (altrimenti 401). Restituiscono soltanto numeri aggregati.
- Mostrano: account registrati (totale e nuovi al giorno), account attivi al giorno (DAU), nella settimana mobile di 7 giorni (WAU) e nel mese mobile di 30 giorni (MAU), con andamento e tabella; installazioni degli store inserite a mano con la loro fonte.

## Carriere, modalità e cosa non si sa (aggiunto)
- «Carriere salvate online»: quante, in corso e concluse (stato `ended` nei metadati del salvataggio), per difficoltà e per modalità di gioco (`gameMode`, scritta nei salvataggi nuovi: i vecchi risultano «non indicato»), salvate negli ultimi 7 e 30 giorni. Si leggono solo i metadati (nessun nome, partito o luogo esce dal server).
- La tabella «Cosa si sa e cosa no» elenca ogni dato richiesto con la fonte o il motivo per cui manca: **sessioni** (il server conosce solo i giorni di attività), **carriere create** anche senza account, **elezioni simulate** e **uso delle funzioni** non sono raccolti e non si inventano; le installazioni restano a inserimento manuale.
- Resta tutto dietro la sessione del proprietario; `ADMIN_STATS` resta spenta finché non sono definiti base giuridica e informativa.

## Cosa non fanno (minimizzazione)
- Non contano i giocatori **senza account** (non c'è nulla che li identifichi e non si aggiunge nulla per identificarli).
- Non salvano indirizzo IP, dispositivo, user agent, posizione, contenuto delle partite o clic. Nessun fingerprinting, nessuna analitica di terzi, nessun cookie aggiunto, nessuna chiamata a servizi esterni.
- La tabella `activity_days` ha due colonne: `user_id` (l'identificativo interno dell'account) e `day` (giorno Europe/Rome). Una riga per account e giorno di attività (accesso o uso dei salvataggi online).
- Le installazioni **non si deducono dal gioco**: sono le cifre di Google Play Console e App Store Connect, inserite dal titolare con la fonte (non si inventano).

## Conservazione
- `activity_days`: 400 giorni (le righe più vecchie si cancellano a ogni primo accesso del giorno); le righe di un account si cancellano con l'account (cancellazione richiesta dal giocatore o conservazione per inattività).
- `store_installs`: cifre aggregate del titolare, senza dati personali.

## Prima di attivare (a cura del titolare)
1. Far valutare a un professionista la **base giuridica** (di norma il legittimo interesse, art. 6.1.f GDPR, per statistiche aggregate sul funzionamento del servizio) e la finalità. Questo documento non è una consulenza legale e non sostituisce la valutazione.
2. Aggiornare l'informativa (`privacy.html`, `privacy-en.html`) con il testo proposto qui sotto, adattato.
3. Applicare la migrazione `migrations/0009_activity_stats.sql` (lo schema si crea comunque da solo al primo uso).
4. Impostare sul Worker la variabile **non segreta** `ADMIN_STATS=on` (Cloudflare → Worker → Settings → Variables). Senza la variabile nessuna attività viene scritta.
5. Segnare come «fornito» il requisito `statistiche-aggregate` in `docs/legale-requisiti.json`.

## Testo proposto per l'informativa (da approvare)
> **Statistiche aggregate sull'uso del servizio.** Se hai un account, registriamo per ogni giorno in cui accedi o usi i salvataggi online una riga con l'identificativo interno del tuo account e la data. Non registriamo indirizzo IP, dispositivo, posizione né contenuto delle partite. Usiamo questi dati solo per contare, in forma aggregata, quanti account sono attivi (giornalieri, settimanali, mensili) e per migliorare il gioco. Base giuridica: legittimo interesse del titolare a conoscere l'uso del servizio, con dati ridotti al minimo. Conservazione: 400 giorni, poi cancellazione; con la cancellazione dell'account le righe si cancellano subito. Chi gioca senza account non è incluso. Puoi opporti scrivendo all'indirizzo di contatto: l'opposizione comporta la cancellazione delle tue righe.
>
> *Aggregate usage statistics.* If you have an account, for each day you sign in or use the online saves we record one row with your account's internal identifier and the date. We do not record IP address, device, location or game content. We use it only to count, in aggregate, how many accounts are active (daily, weekly, monthly) and to improve the game. Legal basis: the controller's legitimate interest in knowing how the service is used, with minimised data. Retention: 400 days, then deletion; when the account is deleted its rows are deleted at once. Players without an account are not included. You can object by writing to the contact address: an objection leads to deletion of your rows.

## Verifiche
`npm run check:admin-stats` (Worker in processo con stand-in di D1): sessione richiesta; spenta di default; accesa, solo account e giorno; DAU/WAU/MAU esatti sui bordi (7 e 30 giorni); ritenzione 400 giorni; cancellazione con l'account; installazioni validate e con fonte; nessun collegamento pubblico, credenziale lato client o analitica esterna; disegno della scheda.
