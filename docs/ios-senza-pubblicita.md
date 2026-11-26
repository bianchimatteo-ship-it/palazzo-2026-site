# iOS: nessuna pubblicità (aggiornamento generale)

Questa versione di Politicando 2026 per iOS **non mostra pubblicità di nessun tipo**.

| Controllo | Come è garantito |
|---|---|
| Nessun SDK | `capacitor.config.json` → `ios.includePlugins = []`; `ios/App/CapApp-SPM/Package.swift` contiene solo Capacitor/Cordova (niente Appodeal, InMobi, UMP) |
| Nessuna richiesta | `src/data/ads-config.js`: `IOS_ADS_ENABLED = false`; `providerFor('ios') === 'none'`; `resolveAds('ios', …)` è sempre tutto spento, qualunque cosa risponda il server; l'app iOS non legge nemmeno la configurazione pubblicitaria (`src/ui/app.js`, `loadAdsConfig` solo Android) |
| Nessun lato server | il Worker rifiuta i crediti pubblicitari `platform: 'ios'` (formato spento → 403) |
| Nessun pulsante promesso | la scheda «Video premiati» della pagina Ricompense **non viene disegnata** dove non c'è un provider (iOS, sito) |
| Privacy | `Info.plist` senza SKAdNetwork, ATT o App ID pubblicitari; `PrivacyInfo.xcprivacy` senza dati pubblicitari di terzi; tracking falso |

La vecchia configurazione InMobi resta in `ads-config.js` solo come documentazione di ciò che era stato costruito e messo in pausa (`docs/inmobi.md`): non si riattiva da sola. Riattivarla richiede una modifica deliberata di `IOS_ADS_ENABLED` **e** del plugin nel build iOS.

Test: `check-appodeal` (`providerFor('ios') === 'none'`), `check-inmobi` (iOS sempre spento), `check-inmobi-native` (progetto iOS senza SDK), `check-ads-states` e `check-rewards-page` (nessun pulsante video senza provider).
