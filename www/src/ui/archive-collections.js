// The collections each tab of the archive needs, loaded on demand (kept apart from the archive page so that the page state can be built without loading it: see ui/lazy-views.js).
import { PARTY_LINK_COLLECTIONS } from '../data/repositories/party-links.js?v=20261110-24';
export const ARCHIVE_COLLECTIONS = Object.freeze({
  partiti: ['parties', 'politicalMovements', 'coalitions', 'electoralLists', 'territories', 'electionParticipations', 'twoPerThousand', 'partyLeaderships', 'politicalFigures', 'partyMemberships', 'politicians'],
  deputati: ['politicians', 'parliamentaryGroups', ...PARTY_LINK_COLLECTIONS],
  senatori: ['politicians', 'parliamentaryGroups', ...PARTY_LINK_COLLECTIONS],
  gruppi: ['parliamentaryGroups', 'groupMemberships', 'politicians', ...PARTY_LINK_COLLECTIONS],
  governo: ['government', 'politicians', ...PARTY_LINK_COLLECTIONS],
  leggi: ['laws'],
  territori: ['territories', 'politicians']
});
