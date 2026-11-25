# Ricompense, annunci premiati e operazioni sul partito: note di architettura

Testo spostato dalle intestazioni dei moduli (24/11/2026) per restare nel budget di caricamento iniziale (`check-load`: 167 moduli, 1.264 KiB compressi): i moduli conservano un rimando a questo file. Nessuna regola è cambiata.

## `src/ui/rewards-service.js`

```text
Wires the rewards to the page: the play clock (visibility, foreground, one tab at a time, the career that is open), the journal of the device, the time of an account (kept by the Worker, merged across devices),
the daily reward and the one-off community reward (the Worker decides for an account, the device for a guest), the notices the player is shown and the rewarded videos. The rules are in core/rewards-engine.js and the store;
this file only decides WHEN time is counted, what is sent to the Worker and who may claim what.
```

## `src/data/repositories/appodeal-adapter.js`

```text
The adapter of the Appodeal bridge (the Capacitor plugin `AppodealAds`, plugins/appodeal-ads: Kotlin, Android only). It is the advertising provider of the ANDROID app (iOS keeps inmobi-adapter.js). It knows nothing about
polls, saves or accounts: it asks for the consent (Appodeal's consent manager, GDPR) BEFORE anything else, initialises the SDK only with the Android app key of data/ads-config.js (Appodeal's automatic connection of the
networks is kept: no network id is ever given), and offers a banner, an interstitial and the rewarded video of data/repositories/ads-rewarded.js ({ kind: 'appodeal', isReady(), show() }). Placement: `default`.
The reward is counted ONLY when the native side reports the SDK's own completion (`onRewardedVideoFinished`, turned into `rewarded: true` by the plugin); a video closed early, a failed show, a missing plugin or any
error gives nothing, and one completion id is made natively for each video (so it can never be credited twice).
No data of the player (position, birth date, gender, career, simulated political choices) is ever passed to the SDK: the only things sent to the plugin are the app key, the format and the test flag.
```

## `src/core/rewards-engine.js`

```text
Rewards of the game for time played and for rewarded videos (the rules are in data/simulation/reward-rules.js). Pure functions on the game state: the store gives them the game and the journal of the device
and keeps what they return. Nothing here has rules of its own about politics: the funds go through book() of the finance engine (the personal funds of the career, never the treasury of the party), the political
capital and the preparation are the resources the game already has (game.resources.politicalCapital, game.prep) with the limits it already has.
```
## `src/core/party-ops-engine.js`

```text
Founding, splitting, merging and renaming the player's party, in the career state (game.party): what an area takes
with it when it leaves — sections, committees, members, volunteers, money — what a merger adds, what a new name costs.
The functions work on a copy of the game owned by the caller and return a description of what the store still has to
apply to the political world, the Parliament and the records of the user's party. Simulated: no real party changes.
```
