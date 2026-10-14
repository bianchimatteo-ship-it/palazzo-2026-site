# Privacy, richieste esterne e inventario degli asset

Stato al 14 ottobre 2026, ricavato dal codice del progetto. **Non è un parere legale e non dichiara la conformità del gioco a nessuna norma.** Le voci contrassegnate «DA FORNIRE» le deve fornire e verificare il titolare prima di una pubblicazione negli store.

## 1. Dati realmente trattati

| Dove | Dato | Scopo | Conservazione oggi |
|---|---|---|---|
| Browser/app (solo sul dispositivo) | Salvataggi, impostazioni, promemoria di avvio, sessione dell'account | Giocare, anche offline | Finché l'utente non svuota i dati del sito o elimina i salvataggi |
| D1 `users` | Nome utente scelto, impronta della password (PBKDF2 nel browser + secondo hash con sale casuale sul server), data di creazione | Account | Finché l'account esiste |
| D1 `sessions` | Impronta SHA-256 del codice di sessione, data di creazione, scadenza | Tenere l'accesso | 30 giorni, oppure fino a «Esci» / cancellazione dell'account |
| D1 `saves` | Stato completo della partita, nome, riepilogo (personaggio, ruolo, partito, data di gioco, stato, difficoltà, settimana), revisione, dimensione, data | Carriere online (max 12 per account) | Finché l'account esiste o il salvataggio viene eliminato |
| D1 `attempts` | Chiave `scopo:indirizzo IP`, contatore, inizio finestra | Limite ai tentativi ripetuti | Finestra di 15 minuti; le righe più vecchie di 24 ore vengono eliminate alla successiva richiesta di accesso/registrazione/cancellazione |
| KV `archivio-condiviso` | Correzioni e loghi del proprietario (nessun dato dei giocatori) | Area amministrativa | Fino a modifica del proprietario |

Non ci sono cookie, pubblicità, pagamenti, strumenti di analisi o profilazione di terze parti, geolocalizzazione, sensori.

**DA FORNIRE:** titolare e recapito; base giuridica; tempo di conservazione degli account inattivi (oggi non vengono eliminati da soli); ruolo di Cloudflare e accordi di trattamento; eventuali trasferimenti extra-SEE; età minima; procedura per verificare chi chiede la cancellazione senza password.

## 2. Cancellazione dell'account

- Nel gioco: Menu → Account → «Elimina il mio account» (password + parola ELIMINA).
- Pagina pubblica senza installazione: `elimina-account.html` (nome utente, password, ELIMINA).
- API: `DELETE /api/account` con sessione valida, prova della password dell'account e `confirm: "ELIMINA"`. L'account è quello della sessione: non se ne può nominare un altro. Salvataggi, sessioni e account vanno in un unico `batch` D1 (tutto o niente). Tentativi sbagliati: limite di 10 ogni 15 minuti per indirizzo.
- Prova automatica: `npm run check:account-deletion` (account altrui, dati orfani, errore del database, client, pagina pubblica). `node scripts/check-account-deletion.mjs --release` fallisce finché nelle pagine restano punti «DA FORNIRE».
- I salvataggi del browser non vengono toccati: restano sul dispositivo.

## 3. Richieste a host esterni

| Prima | Dopo |
|---|---|
| `fonts.googleapis.com` / `fonts.gstatic.com` (DM Sans, Manrope, Newsreader) a ogni apertura | Caratteri ospitati in `src/fonts/` (woff2, sottoinsieme latino) con licenze SIL OFL 1.1 in `src/fonts/LICENSES.txt` |

Restano soltanto:

- il Worker dello stesso sito (`/api/*`);
- **loghi di partiti creati dal giocatore con un indirizzo di immagine** (`logo.kind === 'url'` in `src/ui/party-logo.js`): il browser scarica l'immagine dall'indirizzo scelto e quel sito vede l'indirizzo IP. È una scelta esplicita dell'utente; l'informativa lo segnala. Alternativa possibile: accettare solo loghi costruiti nel gioco o caricati come file;
- collegamenti alle fonti ufficiali: si aprono solo se l'utente li clicca.

## 4. Inventario degli asset

| Asset | Posizione | Origine | Titolare | Licenza | Verifica | Stato |
|---|---|---|---|---|---|---|
| Marchio e icone «POLITICANDO» | `icons/*`, `favicon.*` | Progetto | DA FORNIRE | DA FORNIRE | — | Da confermare |
| Logo di Futuro Nazionale | `src/data/real/assets/logos/futuro-nazionale.png` (fonte `https://futuronazionale.it/il-logo/`) | Sito ufficiale del partito | Futuro Nazionale | **Non documentata** | `logoVerified: true` = logo ufficiale, **non** licenza d'uso | Diritti commerciali non accertati |
| Marchi degli altri 74 partiti/movimenti | — | Nessun logo incluso: il gioco disegna un segno generato (sigla e colori) | — | — | — | Nessun asset di terzi |
| Loghi/colori modificati dal proprietario (Area amministrativa) | KV `archivio-condiviso` | Il proprietario | DA FORNIRE | DA FORNIRE | Una modifica Admin **non** prova i diritti d'uso | Da verificare uno per uno |
| «LA POLITICA 24» (nome e logo di testata) | `src/ui/illustrations.js` (`lp24Logo`), `src/data/simulation/news-rules.js` | Progetto, originale | DA FORNIRE | DA FORNIRE | Disponibilità commerciale del nome **non verificata** | Da verificare prima del rilascio |
| Illustrazioni delle notizie e dei territori | `src/ui/illustrations.js`, `src/ui/visuals.js` | Disegnate nel codice (SVG) | Progetto | DA FORNIRE | — | Originali, da confermare |
| Caratteri DM Sans, Manrope, Newsreader | `src/fonts/` | Pacchetti `@fontsource/*` 5.3.0 | Autori dei caratteri | SIL OFL 1.1 | Testi in `src/fonts/LICENSES.txt` | OK |
| Fotografie di persone | — | **Nessuna** fotografia di persone reali è inclusa | — | — | — | — |

Nessun asset di produzione è stato rimosso o sostituito in questo ciclo.

## 5. Dati reali (testi e numeri)

Provengono da fonti istituzionali primarie, ciascun record con `sourceName`, `sourceUrl` e `verifiedAt`: Camera dei deputati (dati.camera.it), Senato (dati.senato.it), Parlamento/Commissione di garanzia (registro dei partiti), Ministero dell'Interno (archivio elezioni, trasparenza europee 2024), MEF (2 per mille), ISTAT (comuni e unità territoriali), siti ufficiali dei partiti (organigrammi, trasparenza) e una Supermedia AGI/YouTrend. I dati sono del 22–25 settembre 2026 (`snapshotDate`); la data di inizio di una nuova carriera è il 12 ottobre 2026 (`scenarioDate`).

**DA FORNIRE / DA VERIFICARE:** condizioni di riutilizzo di ciascuna fonte (non verificabili offline da questo ambiente) e, per la Supermedia, l'autorizzazione a riportarla.

## 6. Cosa non è stato dichiarato

Il gioco **non** è dichiarato conforme al GDPR, pronto per gli store o libero da diritti di terzi. Restano aperti i punti «DA FORNIRE» sopra e quelli elencati da `check:account-deletion --release`.
