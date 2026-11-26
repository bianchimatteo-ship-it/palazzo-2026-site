# Bilanciamento degli incontri (scene delle attività)

Misurato con `node scripts/scene-balance-report.mjs 60` (60 scene per cella, seed diversi, tre livelli del giocatore e tre modi di giocare: scelte casuali, sempre la prima, la migliore di ogni momento).

Modifiche: soglia «favorevole» da 62 a 60 e, per le mosse di ascolto/verifica/chiarimento con esito intermedio, circa 4 incontri su 10 finiscono in un’approvazione (qualificata) invece che in perplessità (`reactionType` con seme).

| livello / modo | mosse favorevoli prima → dopo | negative prima → dopo | esito finale «buono» prima → dopo |
|---|---|---|---|
| basso / casuale | 7 % → 10 % | 41 % → 41 % | 0 % → 0 % |
| medio / casuale | 21 % → 27 % | 0 % → 0 % | 12 % → 25 % |
| medio / sempre la prima | 23 % → 33 % | 0 % → 0 % | 18 % → 23 % |
| medio / migliore | 94 % → 99 % | 0 % | 100 % |
| alto / casuale | 72 % → 80 % | 0 % | 85 % → 95 % |

Lettura: chi è impreparato e sceglie a caso resta penalizzato; chi ha competenza o sceglie bene ottiene risultati positivi. Non c’è una percentuale fissa: dipende da statistiche, scelta e tema.
Aperto: varietà di atteggiamento degli interlocutori (favorevoli, indecisi, critici) nei testi e nei personaggi — non implementata.
