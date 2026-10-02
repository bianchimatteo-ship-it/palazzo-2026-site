# Politicando 2026 — Blocchi 1–2

## Obiettivo
Integrare il loop azione → effetto → reazione → conseguenza → nuova situazione → nuova scelta, estendendo i sistemi simulati esistenti di eventi, memoria, relazioni, seed/cooldown e mondo politico senza mutare i dataset reali.

## Evidenza iniziale
- `src/core/career-engine.js` gestisce stato carriera, RNG, agenda, eventi, memoria e avanzamento settimanale.
- `src/core/world-engine.js` e `src/data/simulation/polling-rules.js` gestiscono partiti, eventi mondiali, catene e reazioni.
- `src/core/store.js` integra agenda, salvataggi e separazione `simulation`/`user`/`real`.
- Check esistenti: `check-gameplay`, `check-world`, `check-parties`, `check-events`, `check-career` e suite `check:all`.

## Contratto di accettazione
1. Riutilizzare e normalizzare i sistemi esistenti; niente duplicati o mutazioni dei dati reali.
2. Supportare effetti immediati, differiti e permanenti; cause multiple, catene, opportunità/crisi pendenti e memoria che influenza attori/partiti/territori/istituzioni/media/carriera quando pertinente.
3. Personaggi/rivali con obiettivi, interessi, relazioni, lealtà, memoria e iniziative autonome differenziate dal ruolo/situazione.
4. Ridurre la ripetitività tramite contesto, pesi, cooldown, storico recente e seed deterministico; aggiungere eventi sostanzialmente diversi.
5. Aggiungere test mirati per memoria/conseguenze/AI e non-ripetizione, quindi eseguire i check esistenti.

## Scope worker
Codice e test in `src/**` e `scripts/check-*.mjs` pertinenti. Preservare modifiche preesistenti a `package.json`, `ios/`, `www/`, `capacitor.config.json`, `package-lock.json`. Non fare feature fuori dai blocchi; non committare né pushare.
