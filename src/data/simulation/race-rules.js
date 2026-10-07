// The territorial races (regional, provincial, municipal votes) that the leader of a party fields candidates in, besides his own
// campaign. Everything here is a rule of the game (source: simulation): the calendars come from the real data of the votes.
export const RACE_RULES = Object.freeze({
  source: 'simulation',
  // The slate: how far ahead the leader decides, how many races of each level are put in front of him (the nearest in time, then the
  // ones where the party weighs more) and how many days the candidacies stay open (as for the player's own votes).
  horizonDays: 380,
  windowDays: 14,
  maxPerLevel: Object.freeze({ regionale: 5, provinciale: 5, comunale: 6 }),
  // Distances between two votes: a person stands in one race at a time (a campaign is a full-time job); the leader who plays two of
  // his own campaigns needs the time to close the first and open the second, and to prepare the candidacy.
  personGapDays: 35,
  playableGapDays: 49,
  // What each kind of candidate brings to a campaign (the campaign stats), before the territory. The staff and the cadres are known
  // where they work, the politicians of the Parliament everywhere a little, a new figure is nobody yet.
  profiles: Object.freeze({
    cadre: Object.freeze({ popularity: 40, reputation: 52, notoriety: 24, experience: 28, influence: 22 }),
    politician: Object.freeze({ popularity: 46, reputation: 54, notoriety: 52, experience: 55, influence: 50 }),
    simulation: Object.freeze({ popularity: 36, reputation: 50, notoriety: 14, experience: 12, influence: 10 })
  }),
  // Rooting: points of local strength of a candidate where the race is held: born or working there, in the region, a stranger; and what
  // the committees of the party in the territory add (or take away when they are missing). It moves the result, it never blocks a candidacy.
  rooting: Object.freeze({ local: 1.4, region: 0.5, outside: -1.0, committee: 1.6, committeePivot: 40, floor: -2.2, cap: 3 }),
  // What a result left to the party's own candidate does to the force in the polls (scaled by the size of the force): a win at a regional vote
  // counts more than one in a province or a comune; a defeat costs a third of it.
  effects: Object.freeze({ regionale: 0.06, provinciale: 0.03, comunale: 0.03, defeat: 0.33 }),
  // The campaign the party runs by itself, week by week, for a candidate nobody plays: the same activities a player has, in rotation.
  rotation: Object.freeze(['citizen_meeting', 'door_to_door', 'party_meeting', 'social', 'rally'])
});
export const RACE_LEVELS = Object.freeze(['regionale', 'provinciale', 'comunale']);
// The office the party's candidate runs for, by level (the role of the campaign model).
export const RACE_ROLES = Object.freeze({ regionale: 'presidente', provinciale: 'presidente', comunale: 'sindaco' });
