# AdMob (Android) — stato, uso e passi mancanti (15/11/2026)

**Stato: integrato ma SPENTO.** `ADS_MODE = 'off'` in `src/data/ads-config.js`: nessuna chiamata all'SDK, nessuna richiesta di annunci, il pulsante del video dice il motivo. Solo Android; iOS non ha identificativi né plugin (`ios.includePlugins: []` in `capacitor.config.json`). **Un AAB costruito da questo ramo contiene l'SDK anche con gli annunci spenti**: non è la versione 1.0.1 senza annunci (vedi `admob-futuro` in `docs/legale-requisiti.json`).

## Componenti
| File | Ruolo |
|---|---|
| `src/data/ads-config.js` | `ADS_MODE` (`off`/`test`/`live`), identificativi per piattaforma (`ADS_PLATFORMS`), identificativi di prova di Google, `resolveAds()`, pagine del banner, limiti degli interstitial |
| `src/data/repositories/admob-adapter.js` | plugin `@capacitor-community/admob` 8.3.0: UMP prima di ogni richiesta, banner, interstitial, video con premio |
| `src/data/repositories/ads-manager.js` | quando mostrare banner e interstitial (politica) |
| `src/data/repositories/ads-rewarded.js` | premio solo a completamento autentico, una volta per id, clic doppi = un video |
| `src/ui/rewards-service.js` | accredito: per un account prima il Worker, poi la carriera (`+0,15` nei sondaggi per 3 rilevazioni, `AD_REWARD`) |
| `worker.js`, `migrations/0008_reward_ads.sql` | `POST /api/account/rewards/ad`: una riga per account e completamento, massimo 30 al giorno, eliminata con l'account, righe vecchie ripulite dopo 62 giorni |
| `android/app/src/main/AndroidManifest.xml` | `com.google.android.gms.ads.APPLICATION_ID` (senza, l'SDK ferma l'app all'avvio) |

## Identificativi (account AdMob del titolare)
Android: App ID `ca-app-pub-6404822903303014~1677702221`; banner `…/4792704744`; interstitial `…/5092627610`; rewarded `…/6230148140`. In modalità `test` si usano **solo** gli identificativi di prova di Google. **iOS: servono un'app iOS in AdMob con App ID e unità proprie (nuovi): quelli Android non vanno mai usati su iOS** (il test lo impone: `resolveAds('ios', …)` è sempre spento finché `ADS_PLATFORMS.ios` è vuoto).

## Politica
- **Banner**: in basso, adattivo, solo in `ricompense`, `notizie`, `archivio`, `impostazioni`, `storico`; nascosto in home, scene, voto, notte, resoconto, menu, procedura guidata.
- **Interstitial**: solo alla chiusura del resoconto settimanale, uno ogni 3 settimane chiuse, mai entro 4 minuti da un altro interstitial o da un video, al massimo 4 al giorno, mai con notte elettorale, scena, voto, campagna o esito aperti (le settimane vissute in quei momenti non contano).
- **Video con premio**: sempre volontario; il premio solo alla richiamata `onUserEarnedReward` dell'SDK; id unico per completamento; non conta se chiuso, fallito o saltato.
- **Consenso (UMP)**: `requestConsentInfo` → se richiesto, modulo → solo se `canRequestAds` si inizializza l'SDK. Pubblico 14+: nessuna etichetta «sotto l'età del consenso».

## Limiti noti (da dire chiaramente)
- **Non c'è verifica lato server della rete pubblicitaria (SSV)**: il Worker evita doppi accrediti e limita i video al giorno, ma un client manomesso può inventare completamenti entro il limite (30/giorno). Per una verifica vera: configurare l'SSV nella console AdMob per l'unità rewarded, passare `ssv: { userId, customData }` a `prepareRewardVideoAd` e far accreditare solo i completamenti con callback firmata dal Worker (chiavi pubbliche Google). Richiede configurazione del titolare e prove con una rete reale.
- Senza account (ospite) il registro è solo locale (come tutto il gioco senza account).
- Se il Worker non è raggiungibile il premio **non** viene dato (il video va rivisto): scelta voluta, mai un credito non registrato.
- Nessuna prova su dispositivo: il plugin non è stato compilato qui (nessun Android SDK), e nessun annuncio è stato richiesto. I test usano un plugin finto.
- Il manifest unito aggiunge permessi dell'SDK (ID pubblicitario `AD_ID`, stato della rete): influisce su Data safety e sulla dichiarazione dell'ID pubblicitario.

## Per attivarlo (in ordine)
1. Chiudere i requisiti legali (`admob-futuro`, titolare, offerente) e aggiornare informativa, termini, schede e Data safety.
2. Account AdMob in regola (intestatario adulto, pagamenti, `app-ads.txt`, app collegata allo store) — non verificato qui.
3. Costruire una build di **prova** con `ADS_MODE = 'test'` (non committarla), provarla su dispositivo: consenso UMP (anche con `debugGeography`), banner, interstitial, video, nessun annuncio durante elezioni/scene, offline.
4. Valutare l'SSV (sopra).
5. Solo dopo: `ADS_MODE = 'live'`, nuova build, controlli (`npm run check:admob`), `versionCode` maggiore.

Test: `npm run check:admob` (configurazione, separazione delle piattaforme, consenso, politica, premio); il lato Worker è in `check-rewards-sync`.

## InMobi (separato da AdMob e da iOS)
Stato verificato nel repository (snapshot di questo ciclo):
- **InMobi non è integrato.** Nel portale InMobi del titolare risultano un account e tre placement, ma nel repository non c'è alcun SDK InMobi, alcun adapter, alcun identificativo InMobi: nessun file o dipendenza Gradle/Pod lo cita.
- Le due reti non si fondono: l'adapter attuale (`data/repositories/admob-adapter.js`) parla solo con il plugin AdMob; un provider InMobi richiede un adapter proprio che implementi lo stesso contratto di `ads-rewarded.js`.

Lavoro ancora necessario per InMobi su **Android** (non iniziato; nessuna decisione presa qui):
1. Decidere se InMobi sostituisce AdMob, lo affianca (mediazione) o resta fuori: scelta del titolare, con effetti su informativa, Data safety e dichiarazione «Annunci».
2. Individuare un plugin Capacitor o scrivere un bridge nativo per l'SDK InMobi (nessuna dipendenza npm è stata aggiunta in questo ciclo), con ID dei tre placement presi dal portale del titolare, mai inventati.
3. Consenso: InMobi usa il proprio meccanismo oltre a UMP/TCF; vanno verificati col fornitore. Pubblico 14+: nessuna personalizzazione per minori.
4. Un adapter `inmobi-adapter.js` con gli stessi tre stati (non configurato / nessun annuncio / ricompensa) e premio **solo** a completamento valido; test con provider finto come per AdMob; nuovo controllo `check:inmobi`.
5. Costruire e provare un AAB di prova su dispositivo (richiede l'Android SDK), poi aggiornare `ADS_MODE` e i documenti.
Non vanno usati gli ID AdMob per InMobi né viceversa.

## iOS: nessuna pubblicità nella prima versione
- `capacitor.config.json` ha `includePlugins: []`: nessun plugin, quindi nessun SDK pubblicitario nell'app iOS; `ADS_PLATFORMS.ios` ha tutti gli ID a `null` e `resolveAds('ios')` non abilita nulla.
- L'SDK InMobi **non** va aggiunto a iOS in questa versione; gli ID AdMob Android non valgono su iOS.
- `ios/App/App/PrivacyInfo.xcprivacy`: nessun tracciamento, nessun dominio di tracciamento, nessun SDK pubblicitario.
- Identificativi nel repository (coerenti tra loro): `appId` e `PRODUCT_BUNDLE_IDENTIFIER` = `it.matteobianchi.politicando2026`, `MARKETING_VERSION` 1.0, `CURRENT_PROJECT_VERSION` 1; nel `project.pbxproj` non c'è alcun `DEVELOPMENT_TEAM` (il team si imposta in Xcode, non modificato qui).
- **Da verificare dal titolare:** il Bundle ID della build 1.0 (1) già caricata su App Store Connect non è leggibile da qui (nessun accesso ad App Store Connect). Se lo screenshot del titolare mostra un Bundle ID diverso da `it.matteobianchi.politicando2026`, **si ferma su quel punto**: nessun identificativo viene cambiato automaticamente.
