// Demonstration ads for the tests of the rewards: a provider that behaves as the contract of data/repositories/ads-rewarded.js asks, with NO claim to be a real advertising network (kind 'demo': the game refuses
// it unless the test says allowDemo). It has no ids, no SDK and no network; the completion ids are made up here and say so.
export function createDemoProvider({ outcome = 'completed', ready = true } = {}) {
  let count = 0;
  const provider = {
    kind: 'demo',
    plays: 0,
    outcome,
    ready,
    isReady() { return provider.ready; },
    async show() {
      provider.plays++;
      count++;
      if (provider.outcome === 'throws') throw new Error('annuncio non riuscito (demo)');
      if (provider.outcome === 'dismissed') return { completed: false };
      if (provider.outcome === 'unverified') return { completed: true, verified: false, completionId: `demo-completion-${count}` };
      if (provider.outcome === 'noid') return { completed: true, verified: true };
      if (provider.outcome === 'repeat') return { completed: true, verified: true, completionId: 'demo-completion-fixed' };
      return { completed: true, verified: true, completionId: `demo-completion-${count}-${Math.random().toString(36).slice(2, 8)}` };
    }
  };
  return provider;
}
