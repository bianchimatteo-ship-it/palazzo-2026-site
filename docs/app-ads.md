# app-ads.txt (Appodeal)

Il file `app-ads.txt` nella radice del repository è la copia del file scaricato da Appodeal (`app_ads_txt.txt`, aggiornamento 31/03/2026) senza **soltanto** i segnaposto di esempio per AdMob (`Publisher_ID`) e Meta (`Business_ID`) e i loro commenti. Tutte le altre righe (Appodeal `442694`, BidMachine e i rivenditori) sono invariate: non si tolgono reti o venditori anche se l'app non include il loro adapter. Non si aggiungono righe AdMob o Meta: non ci sono account personali su quelle reti.

Pubblicazione: `scripts/build-portal.mjs` lo copia in `portal/` (la cartella di asset del Worker di produzione `palazzo-2026-site`, `wrangler.jsonc` → `assets.directory`), e `worker-constants.js` (`PORTAL_PATHS`) lo ammette: il Worker di produzione risponde 404 a tutto ciò che non è nel portale. URL: `https://palazzo-2026-site.bianchimatteo657.workers.dev/app-ads.txt`.

Attenzione: i crawler leggono `app-ads.txt` dal dominio del sito dello sviluppatore indicato nella scheda Google Play. Se quel dominio è `…workers.dev`, le regole del protocollo possono richiedere il file sulla radice del dominio registrabile e non su un sottodominio: va controllato in Play Console (Presenza nello store → Dettagli di contatto → Sito web) e nella Dashboard Appodeal.
