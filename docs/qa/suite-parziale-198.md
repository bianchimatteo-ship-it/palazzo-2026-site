# Suite parziale — 198 comandi su 278 (branch feature/miglioramento-completo, commit 407046c)

Log reale della corsa (3 processi in parallelo, timeout 900 s a comando), interrotta dal passaggio al lavoro InMobi: i 80 comandi restanti NON sono stati eseguiti. Esito del singolo comando; «SKIPPED» = uscita 0 ma output che dichiara il controllo non eseguito. 177 PASS · 19 FAIL · 2 SKIPPED.

| # | Comando | Esito | Codice | Ultima riga utile / nota |
|---|---|---|---|---|
| 1 | check-ui | PASS | 0 |  |
| 2 | check-first-run | PASS | 0 |  |
| 3 | check-boot | SKIPPED | 0 | Avvio robusto verificato: con una collezione reale non disponibile (coalizioni), una danneggiata (parlamentari |
| 4 | check-service-worker | PASS | 0 |  |
| 5 | check-gameplay | PASS | 0 |  |
| 6 | check-parliament | PASS | 0 |  |
| 7 | check-polls | PASS | 0 |  |
| 8 | check-simulation | PASS | 0 |  |
| 9 | check-campaign | PASS | 0 |  |
| 10 | check-elections | PASS | 0 |  |
| 11 | check-sections | PASS | 0 |  |
| 12 | check-hemicycle | PASS | 0 |  |
| 13 | check-territory | PASS | 0 |  |
| 14 | check-responsive | PASS | 0 |  |
| 15 | check-mobile-start | PASS | 0 |  |
| 16 | check-campaign-ui | FAIL | 2 | Chrome si è chiuso durante il controllo (crash del browser): controllo NON eseguito. |
| 17 | check-government | PASS | 0 |  |
| 18 | check-premier | PASS | 0 |  |
| 19 | check-news | PASS | 0 |  |
| 20 | check-dossiers | PASS | 0 |  |
| 21 | check-accords | PASS | 0 |  |
| 22 | check-reference-government | PASS | 0 |  |
| 23 | check-events | PASS | 0 |  |
| 24 | check-daily-events | PASS | 0 |  |
| 25 | check-party-life | PASS | 0 |  |
| 26 | check-finance | PASS | 0 |  |
| 27 | check-party-currents | PASS | 0 |  |
| 28 | check-memory-consequences | PASS | 0 |  |
| 29 | check-campaign-rivals | PASS | 0 |  |
| 30 | check-campaign-depth | PASS | 0 |  |
| 31 | check-races | PASS | 0 |  |
| 32 | check-regional-chain | PASS | 0 |  |
| 33 | check-career | PASS | 0 |  |
| 34 | check-legislature | PASS | 0 |  |
| 35 | check-presidency | FAIL | 1 | e un seggio in Parlamento o un incarico di delegato regionale. |
| 36 | check-president-rules | PASS | 0 |  |
| 37 | check-start | PASS | 0 |  |
| 38 | check-scenarios | PASS | 0 |  |
| 39 | check-standing | PASS | 0 |  |
| 40 | check-offices | PASS | 0 |  |
| 41 | check-province | PASS | 0 |  |
| 42 | check-legacy | PASS | 0 |  |
| 43 | check-invariants | PASS | 0 |  |
| 44 | check-long-run | FAIL | null | TIMEOUT |
| 45 | check-laws | PASS | 0 |  |
| 46 | check-cabinet | PASS | 0 |  |
| 47 | check-parties | PASS | 0 |  |
| 48 | check-calendar | PASS | 0 |  |
| 49 | check-calendar-years | FAIL | null | TIMEOUT |
| 50 | check-annual-elections | PASS | 0 |  |
| 51 | check-round-race | PASS | 0 |  |
| 52 | check-leaders | PASS | 0 |  |
| 53 | check-local | PASS | 0 |  |
| 54 | check-local-works | PASS | 0 |  |
| 55 | check-mandates | PASS | 0 |  |
| 56 | check-admin-sync | PASS | 0 |  |
| 57 | check-admin | PASS | 0 |  |
| 58 | check-document | PASS | 0 |  |
| 59 | check-world | PASS | 0 |  |
| 60 | check-poll-presence | PASS | 0 |  |
| 61 | check-onboarding | PASS | 0 |  |
| 62 | check-affiliations | PASS | 0 |  |
| 63 | check-poll-realism | PASS | 0 |  |
| 64 | check-observatory | PASS | 0 |  |
| 65 | check-observatory-ext | PASS | 0 |  |
| 66 | check-observatory-page | PASS | 0 |  |
| 67 | check-territory-legibility | FAIL | 1 | nessuna larghezza ha mostrato l’impaginazione lc-wide |
| 68 | check-party-identity | PASS | 0 |  |
| 69 | check-start-screen | PASS | 0 |  |
| 70 | check-new-game-flow | PASS | 0 |  |
| 71 | check-admin-storage | PASS | 0 |  |
| 72 | check-tiered-storage | PASS | 0 |  |
| 73 | check-save-resilience | PASS | 0 |  |
| 74 | check-load-game | PASS | 0 |  |
| 75 | check-election-counts | PASS | 0 |  |
| 76 | check-istat-import | PASS | 0 |  |
| 77 | check-more-menu | PASS | 0 |  |
| 78 | check-tutorial | PASS | 0 |  |
| 79 | check-tutorial-tasks | PASS | 0 |  |
| 80 | check-party-colors | PASS | 0 |  |
| 81 | check-calendar-gap | PASS | 0 |  |
| 82 | check-istat-population | PASS | 0 |  |
| 83 | check-poll-consistency | PASS | 0 |  |
| 84 | check-agenda-activities | PASS | 0 |  |
| 85 | check-e2e-futuro-nazionale | FAIL | 1 | Territori: venti regioni, «Voto reale 2022» non offerto a un partito nato dopo, stima dichiarata simulata ({"t |
| 86 | check-assets | PASS | 0 |  |
| 87 | check-scenario-date | PASS | 0 |  |
| 88 | check-admin-e2e | PASS | 0 |  |
| 89 | check-regional-ranking | FAIL | 1 | Futuro Nazionale: la misura «scarto» non è disponibile. |
| 90 | check-territory-ui | PASS | 0 |  |
| 91 | check-territory-browser | PASS | 0 |  |
| 92 | check-resignations | PASS | 0 |  |
| 93 | check-resignations-ui | PASS | 0 |  |
| 94 | check-guide | FAIL | 1 |   diff: 'simple' — PASS dopo correzione (classe dei Percorsi), rieseguito da solo |
| 95 | check-statutes | PASS | 0 |  |
| 96 | check-referendum | PASS | 0 |  |
| 97 | check-referendum-effects | PASS | 0 |  |
| 98 | check-activity-audit | PASS | 0 |  |
| 99 | check-referendum-ui | PASS | 0 |  |
| 100 | check-party-programs | PASS | 0 |  |
| 101 | check-scene-effects | PASS | 0 |  |
| 102 | check-button-palette | PASS | 0 |  |
| 103 | check-majority-shift | PASS | 0 |  |
| 104 | check-admin-stats | PASS | 0 |  |
| 105 | check-staff | PASS | 0 |  |
| 106 | check-plan-treasury | PASS | 0 |  |
| 107 | check-plan-staff-ui | PASS | 0 |  |
| 108 | check-news-radio | PASS | 0 |  |
| 109 | check-parliament-page | PASS | 0 |  |
| 110 | check-role-activities | PASS | 0 |  |
| 111 | check-cadres | PASS | 0 |  |
| 112 | check-supermedia | PASS | 0 |  |
| 113 | check-poll-scenario | PASS | 0 |  |
| 114 | check-news-voice | FAIL | 1 |   diff: 'simple' |
| 115 | check-government-layout | PASS | 0 |  |
| 116 | check-chart-contrast | PASS | 0 |  |
| 117 | check-security | FAIL | 1 |   diff: 'simple' — PASS dopo correzione (onsubmit inline), rieseguito |
| 118 | check-load | FAIL | 1 |   diff: 'simple' |
| 119 | check-button-contrast | FAIL | 1 |   diff: 'simple' |
| 120 | check-funds | PASS | 0 |  |
| 121 | check-national-colors | PASS | 0 |  |
| 122 | check-quirinale-page | PASS | 0 |  |
| 123 | check-congress | PASS | 0 |  |
| 124 | check-congress-ui | PASS | 0 |  |
| 125 | check-parliament-roster | PASS | 0 |  |
| 126 | check-admin-parties | PASS | 0 |  |
| 127 | check-account-deletion | FAIL | 1 |   port: 8791 — PASS rieseguito da solo |
| 128 | check-account-isolation | FAIL | 1 |   port: 8791 |
| 129 | check-capacitor | PASS | 0 |  |
| 130 | check-published-local | FAIL | 1 |   port: 8791 |
| 131 | check-commitment-ids | PASS | 0 |  |
| 132 | check-accounts | PASS | 0 |  |
| 133 | check-saves | PASS | 0 |  |
| 134 | check-sync-queue | PASS | 0 |  |
| 135 | check-advance | PASS | 0 |  |
| 136 | check-members | PASS | 0 |  |
| 137 | validate-real-data | PASS | 0 |  |
| 138 | check-runoff-polls | PASS | 0 |  |
| 139 | check-local-implementation | PASS | 0 |  |
| 140 | check-committee-founding | PASS | 0 |  |
| 141 | check-wizard-party-layout | PASS | 0 |  |
| 142 | check-panels-stay-put | SKIPPED | 0 |  - percorso: dopo tre ridisegni i 1 pannelli sono come li hai lasciati (prima 1, dopo 1) |
| 143 | check-candidacy-access | PASS | 0 |  |
| 144 | check-municipality-descriptions | PASS | 0 |  |
| 145 | check-reload-advance | PASS | 0 |  |
| 146 | check-calendar-scheduling | FAIL | null | TIMEOUT |
| 147 | check-poll-metrics | PASS | 0 |  |
| 148 | check-poll-election-consistency | FAIL | null | TIMEOUT |
| 149 | check-race-player-campaign | PASS | 0 |  |
| 150 | check-logo-archive | PASS | 0 |  |
| 151 | check-logo-archive-ui | PASS | 0 |  |
| 152 | check-logo-sync-triggers | PASS | 0 |  |
| 153 | check-avatar-sync | PASS | 0 |  |
| 154 | check-government-formation | PASS | 0 |  |
| 155 | check-stale-slot | PASS | 0 |  |
| 156 | check-campaign-opening | PASS | 0 |  |
| 157 | check-election-consensus | PASS | 0 |  |
| 158 | check-campaign-countdown | PASS | 0 |  |
| 159 | check-runoff-majority | PASS | 0 |  |
| 160 | check-seat-allocation | PASS | 0 |  |
| 161 | check-party-conflicts | PASS | 0 |  |
| 162 | check-outcome-popup | PASS | 0 |  |
| 163 | check-agenda-races | PASS | 0 |  |
| 164 | check-pacts-table | PASS | 0 |  |
| 165 | check-wizard-party-filter | PASS | 0 |  |
| 166 | check-italy-map | PASS | 0 |  |
| 167 | check-membership | PASS | 0 |  |
| 168 | check-priorities-ui | PASS | 0 |  |
| 169 | check-election-ui | PASS | 0 |  |
| 170 | check-next-challenge | PASS | 0 |  |
| 171 | check-transfers | PASS | 0 |  |
| 172 | check-transfers-store | PASS | 0 |  |
| 173 | check-campaign-layout | PASS | 0 |  |
| 174 | check-campaign-order | PASS | 0 |  |
| 175 | check-senato-taa | PASS | 0 |  |
| 176 | check-settings-icon | PASS | 0 |  |
| 177 | check-news-popup-setting | FAIL | 1 | 3) |
| 178 | check-ui-sections | PASS | 0 |  |
| 179 | check-retention | PASS | 0 |  |
| 181 | check-finance-order | PASS | 0 |  |
| 182 | check-campaign-result-action | PASS | 0 |  |
| 183 | check-i18n | FAIL | 1 |   diff: 'simple' — 0 testi italiani in una corsa singola prima delle ultime frasi; non rieseguito dopo |
| 184 | check-language-flow | PASS | 0 |  |
| 185 | check-avatar | PASS | 0 |  |
| 186 | check-party-logo | PASS | 0 |  |
| 187 | check-logo-catalog | PASS | 0 |  |
| 188 | check-logout-careers | PASS | 0 |  |
| 189 | check-hall-of-fame | PASS | 0 |  |
| 190 | check-legal | PASS | 0 |  |
| 191 | check-admin-credential | PASS | 0 |  |
| 192 | check-home-mobile | PASS | 0 |  |
| 193 | check-email-gateway | PASS | 0 |  |
| 194 | check-bidimedia-poll | PASS | 0 |  |
| 195 | check-logo-sync | PASS | 0 |  |
| 196 | check-news-quality | PASS | 0 |  |
| 197 | check-i18n-newsroom | PASS | 0 |  |
| 198 | check-android | PASS | 0 |  |
| 199 | check-local-territories | PASS | 0 |  |
