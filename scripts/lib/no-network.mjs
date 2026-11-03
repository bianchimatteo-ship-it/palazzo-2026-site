// Preloaded (node --import) by the offline checks: any attempt to reach the network fails loudly, and the number of attempts is written at exit.
let attempts = 0;
globalThis.fetch = async (...args) => { attempts++; throw new Error(`rete non disponibile (tentativo ${attempts}: ${String(args[0]).slice(0, 80)})`); };
process.on('exit', () => { if (attempts) process.stderr.write(`[no-network] ${attempts} tentativi di rete\n`); });
