import { ELECTION_MODELS, EUROPEAN_CONSTITUENCIES, EUROPEAN_THRESHOLD, OUTCOME_LABELS, SEAT_RULES } from '../data/simulation/campaign-rules.js?v=20260926-1';

const clamp = (value,min=0,max=100) => Math.min(max,Math.max(min,value));
const rounded = value => Math.round(value*100)/100;
const territories = campaign => campaign.territories ?? [];
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
// A throwaway sequence for the count: it never disturbs the campaign's own random sequence.
function seeded(seed) {
  let state = seed >>> 0 || 1;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

function allianceLeader(candidate,candidates) {
  if (candidate.coalitionLeaderId) return candidates.find(item => item.id === candidate.coalitionLeaderId) ?? candidate;
  return candidate;
}

export function electoralGroups(campaign) {
  const candidates = campaign.candidates.filter(item => item.status !== 'eliminated' && item.status !== 'withdrawn');
  const grouped = new Map();
  for (const candidate of candidates) {
    const leader = allianceLeader(candidate,campaign.candidates);
    if (candidate.status === 'allied' && candidate.id !== leader.id) continue;
    const id = leader.id;
    const group = grouped.get(id) ?? {id,leaderCandidateId:leader.id,partyIds:[],members:[],label:leader.displayLabel};
    group.members.push(candidate.id);
    if (candidate.partyId && !group.partyIds.includes(candidate.partyId)) group.partyIds.push(candidate.partyId);
    grouped.set(id,group);
  }
  for (const candidate of candidates) {
    if (candidate.status !== 'allied') continue;
    const leader = allianceLeader(candidate, campaign.candidates);
    const group = grouped.get(leader.id);
    if (group && !group.members.includes(candidate.id)) { group.members.push(candidate.id); if (candidate.partyId && !group.partyIds.includes(candidate.partyId)) group.partyIds.push(candidate.partyId); }
  }
  return [...grouped.values()];
}

export function sharesByGroup(campaign, territoryId) {
  const candidates = new Map(campaign.candidates.map(item => [item.id,item]));
  const area = campaign.territories.find(item => item.id === territoryId);
  if (!area) return [];
  const raw = area.supportByCandidate ?? {};
  const totals = new Map(electoralGroups(campaign).map(group => [group.id,{...group,share:0}]));
  for (const [candidateId,value] of Object.entries(raw)) {
    const candidate = candidates.get(candidateId);
    if (!candidate || candidate.status === 'eliminated' || candidate.status === 'withdrawn') continue;
    const leader = allianceLeader(candidate,campaign.candidates);
    const group = totals.get(leader.id);
    if (group) group.share += Number(value)||0;
  }
  return [...totals.values()].map(group => ({...group,share:rounded(group.share)})).sort((a,b)=>b.share-a.share);
}

export function aggregateShares(campaign) {
  const totalWeight = territories(campaign).reduce((sum,item)=>sum+item.weight,0)||1;
  const groups = new Map(electoralGroups(campaign).map(group => [group.id,{...group,share:0} ]));
  for (const area of territories(campaign)) {
    for (const group of sharesByGroup(campaign,area.id)) {
      const row=groups.get(group.id);
      if (row) row.share += group.share*(area.weight/totalWeight);
    }
  }
  return [...groups.values()].map(group=>({...group,share:rounded(group.share)})).sort((a,b)=>b.share-a.share);
}

function allocateDHondt(groups,seatCount,threshold=0) {
  const eligible=groups.filter(group=>group.share>=threshold);
  const allocation=eligible.map(group=>({...group,seats:0}));
  for (let seat=0;seat<seatCount&&allocation.length;seat++) {
    allocation.sort((a,b)=>(b.share/(b.seats+1))-(a.share/(a.seats+1)) || a.id.localeCompare(b.id));
    allocation[0].seats++;
  }
  return allocation.sort((a,b)=>b.seats-a.seats||b.share-a.share);
}
// Seats with a majority bonus: the winner gets at least `bonus` of the seats, the others share the rest (simplified).
function allocateWithBonus(groups, seatCount, winnerId, bonus, threshold = 0) {
  const plain = allocateDHondt(groups, seatCount, threshold);
  const winner = plain.find(item => item.id === winnerId);
  const floor = Math.ceil(seatCount * bonus);
  if (!winner || winner.seats >= floor) return plain;
  const others = allocateDHondt(groups.filter(item => item.id !== winnerId), seatCount - floor, threshold);
  return [{ ...winner, seats:floor, bonus:true }, ...others].sort((a,b)=>b.seats-a.seats||b.share-a.share);
}

function resultRow(group,share,totalBallots,seats=0,extra={}) {
  return {
    id:group.id,candidateId:group.leaderCandidateId,partyIds:group.partyIds,memberCandidateIds:group.members,
    label:group.label,percent:rounded(share),votes:Math.round(totalBallots*share/100),seats,
    source:'simulation',...extra
  };
}

function areaResults(campaign,totalBallots=100000) {
  const weight = territories(campaign).reduce((sum,item)=>sum+item.weight,0) || 1;
  return territories(campaign).map(area=>{
    let groups=sharesByGroup(campaign,area.id);
    if(campaign.stage==='ballottaggio') {
      const retained=groups.reduce((sum,group)=>sum+group.share,0)||1;
      groups=groups.map(group=>({...group,share:rounded(group.share*100/retained)}));
    }
    const rows = groups.map(group=>resultRow(group,group.share,Math.round(totalBallots*area.weight/weight)));
    const player = rows.find(row => row.candidateId === campaign.playerCandidateId);
    return {territoryId:area.id,name:area.name,weight:area.weight,groups:rows,winnerId:rows[0]?.candidateId ?? null,playerPosition:player ? rows.indexOf(player) + 1 : null};
  });
}

function municipalSeats(campaign,groups,winnerId) {
  const count=campaign.municipalityBand==='oltre-15000'?16:12;
  const rule = SEAT_RULES.comunale;
  // Council size and seat distribution are deliberately simplified game rules.
  return allocateWithBonus(groups,count,winnerId ?? groups[0]?.id,rule.majorityBonus[campaign.municipalityBand ?? 'fino-15000'],campaign.municipalityBand==='oltre-15000'?rule.threshold:0);
}

function allocateRegional(campaign,groups) {
  const rule=ELECTION_MODELS[campaign.electionType];
  return allocateWithBonus(groups,rule.seatCount,groups[0]?.id,SEAT_RULES.regionale.majorityBonus,SEAT_RULES.regionale.threshold);
}

function nationalSeats(campaign,groups) {
  const seatCount=campaign.candidacy.role==='senatore'?200:400;
  const uninominalCount=Math.round(seatCount*.37);
  const proportionalCount=seatCount-uninominalCount;
  const districts=new Map(groups.map(group=>[group.id,{...group,districtSeats:0,districtsWon:[]}]));
  const areas=territories(campaign);
  const exact=areas.map(area=>({area,seats:uninominalCount*area.weight/areas.reduce((sum,item)=>sum+item.weight,0)}));
  const assigned=exact.map(item=>({...item,count:Math.floor(item.seats)}));
  let remaining=uninominalCount-assigned.reduce((sum,item)=>sum+item.count,0);
  [...assigned].sort((a,b)=>(b.seats-Math.floor(b.seats))-(a.seats-Math.floor(a.seats))||a.area.id.localeCompare(b.area.id)).slice(0,remaining).forEach(item=>item.count++);
  for(const item of assigned) {
    const top=sharesByGroup(campaign,item.area.id)[0];
    const winner=top&&districts.get(top.id);
    if(winner){winner.districtSeats+=item.count;winner.districtsWon.push(item.area.id);}
  }
  const proportional=allocateDHondt(groups,proportionalCount,SEAT_RULES.politiche.threshold);
  const prById=new Map(proportional.map(item=>[item.id,item.seats]));
  return [...districts.values()].map(group=>({...group,proportionalSeats:prById.get(group.id)||0,seats:group.districtSeats+(prById.get(group.id)||0)})).sort((a,b)=>b.seats-a.seats||b.share-a.share);
}

function europeanSeats(campaign,groups) {
  const circumscriptions=territories(campaign);
  const eligible=new Set(groups.filter(group=>group.share>=EUROPEAN_THRESHOLD.percent).map(group=>group.id));
  const seatWeights=circumscriptions.map(area=>({...area,exact:ELECTION_MODELS.europee.seatCount*area.weight/100}));
  const assigned=seatWeights.map(area=>({...area,seats:Math.floor(area.exact)}));
  let remaining=ELECTION_MODELS.europee.seatCount-assigned.reduce((sum,item)=>sum+item.seats,0);
  assigned.sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact))||a.id.localeCompare(b.id));
  for(let i=0;i<remaining;i++)assigned[i%assigned.length].seats++;
  const seatTotals=new Map(groups.map(group=>[group.id,{...group,seats:0,circumscriptions:[]} ]));
  for(const area of assigned) {
    const rows=sharesByGroup(campaign,area.id).filter(group=>eligible.has(group.id));
    const allocated=allocateDHondt(rows,area.seats,0);
    for(const row of allocated) {
      const total=seatTotals.get(row.id); if(!total)continue;
      total.seats+=row.seats; total.circumscriptions.push({territoryId:area.id,name:area.name,seats:row.seats});
    }
  }
  return [...seatTotals.values()].sort((a,b)=>b.seats-a.seats||b.share-a.share);
}

function normalizedTwoRound(campaign,qualifiers) {
  const shares=aggregateShares(campaign);
  const accepted=new Set(qualifiers);
  const retained=shares.filter(group=>accepted.has(group.id));
  const total=retained.reduce((sum,item)=>sum+item.share,0)||1;
  return retained.map(group=>({...group,share:rounded(group.share*100/total)})).sort((a,b)=>b.share-a.share);
}

export function runFirstRound(campaign) {
  const groups=aggregateShares(campaign);
  const leader=groups[0];
  const playerGroup=groups.find(item=>item.id===campaign.playerCandidateId);
  const result={
    stage:'primo-turno',model:ELECTION_MODELS[campaign.electionType].model,electionType:campaign.electionType,
    totalBallots:100000,groups:groups.map(group=>resultRow(group,group.share,100000)),
    territories:areaResults(campaign),playerShare:playerGroup?.share??0,source:'simulation',simulated:true
  };
  if(campaign.electionType==='comunale'&&campaign.municipalityBand==='oltre-15000'&&leader?.share<50&&groups.length>1) {
    result.requiresRunoff=true;
    result.runoffCandidateIds=groups.slice(0,2).map(item=>item.id);
    result.runoffShares=normalizedTwoRound(campaign,result.runoffCandidateIds).map(group=>resultRow(group,group.share,100000));
  } else {
    result.requiresRunoff=false;
    result.winnerGroupId=leader?.id??null;
  }
  return result;
}

export function runFinalElection(campaign,firstRound=null) {
  const rules=ELECTION_MODELS[campaign.electionType];
  const aggregate=aggregateShares(campaign);
  const totalBallots=100000;
  let rows;
  let runoffRows=null;
  let runoffWinnerId=null;
  let seatRows=[];
  if(campaign.stage==='ballottaggio'&&firstRound?.runoffCandidateIds) {
    const finalShares=normalizedTwoRound(campaign,firstRound.runoffCandidateIds);
    runoffRows=finalShares.map(group=>resultRow(group,group.share,totalBallots));
    runoffWinnerId=runoffRows[0]?.candidateId??null;
    const firstGroups=firstRound.groups.map(row=>({id:row.candidateId,share:row.percent,label:row.label,partyIds:row.partyIds,members:row.memberCandidateIds,leaderCandidateId:row.candidateId}));
    seatRows=municipalSeats(campaign,firstGroups,runoffWinnerId);
    rows=firstRound.groups.map(row=>{const group=firstGroups.find(item=>item.id===row.candidateId);const scored=resultRow(group,row.percent,totalBallots,seatRows.find(item=>item.id===group.id)?.seats??0);const final=runoffRows.find(item=>item.candidateId===row.candidateId);return {...scored,runoffPercent:final?.percent??null,runoffVotes:final?.votes??null};});
  } else if(campaign.electionType==='comunale') {
    seatRows=municipalSeats(campaign,aggregate,aggregate[0]?.id);
    rows=aggregate.map(group=>resultRow(group,group.share,totalBallots,seatRows.find(row=>row.id===group.id)?.seats??0));
  } else if(campaign.electionType==='regionale') {
    seatRows=allocateRegional(campaign,aggregate);
    rows=aggregate.map(group=>resultRow(group,group.share,totalBallots,seatRows.find(row=>row.id===group.id)?.seats??0));
  } else if(campaign.electionType==='politiche') {
    seatRows=nationalSeats(campaign,aggregate);
    rows=aggregate.map(group=>{const seat=seatRows.find(row=>row.id===group.id);return resultRow(group,group.share,totalBallots,seat?.seats??0,{districtSeats:seat?.districtSeats??0,proportionalSeats:seat?.proportionalSeats??0,districtsWon:seat?.districtsWon??[]});});
  } else {
    seatRows=europeanSeats(campaign,aggregate);
    rows=aggregate.map(group=>{const seat=seatRows.find(row=>row.id===group.id);return resultRow(group,group.share,totalBallots,seat?.seats??0,{circumscriptions:seat?.circumscriptions??[]});});
  }
  rows.sort((a,b)=>b.percent-a.percent||b.seats-a.seats);
  const winnerId=runoffWinnerId??rows[0]?.id??null;
  const winner=rows.find(row=>row.id===winnerId)??rows[0]??null;
  const playerRow=rows.find(row=>row.id===campaign.playerCandidateId)??null;
  const personal=personalResult(campaign,playerRow,winner,rows);
  const previous=campaign.firstRoundResult;
  const result = {
    stage:'risultato-finale',model:rules.model,electionType:campaign.electionType,totalBallots,
    ballotLabel:'Schede normalizzate su 100.000 elettori simulati',groups:rows,
    territories:areaResults(campaign,totalBallots),firstRound:previous??firstRound??null,
    winnerGroupId:winnerId,playerShare:runoffRows?.find(row=>row.candidateId===campaign.playerCandidateId)?.percent??playerRow?.percent??0,playerVotes:runoffRows?.find(row=>row.candidateId===campaign.playerCandidateId)?.votes??playerRow?.votes??0,runoffResults:runoffRows,
    playerSeats:playerRow?.seats??0,personalMandate:personal.mandate,personal,source:'simulation',simulated:true,
    objectiveMet:objectiveMet(campaign,playerRow,personal.mandate),
    turnout:campaign.electionDays?.at(-1)?.turnout ?? Math.round(clamp(61+(campaign.candidateStats.reputation-50)*.16+(campaign.candidateStats.notoriety-40)*.08+((campaign.context?.participation??60)-60)*.5,38,78)*100)/100,
    seatRule:SEAT_RULES[campaign.electionType]?.note ?? null
  };
  result.outcome = classifyOutcome(campaign, result);
  return result;
}

// Preference votes: inside a list the seats go to the candidates with the most preferences. The player's pull
// (notoriety, reputation, local roots, campaign on the ground) competes with the list mates'.
export function preferenceStanding(campaign, listSeats) {
  const rand = seeded(hash(`${campaign.id}|preferenze`));
  const stats = campaign.candidateStats ?? {};
  const player = campaign.candidates.find(item => item.isPlayer);
  const ground = ['door_to_door', 'citizen_meeting', 'local_visit', 'local_life', 'territory_campaign', 'associations'].reduce((sum, id) => sum + (campaign.activityUses?.[id] ?? 0), 0);
  const own = 30 + (stats.notoriety ?? 20) * .5 + (stats.reputation ?? 50) * .2 + (stats.popularity ?? 40) * .2 + Math.min(14, ground * 1.5) + (player?.resources?.organization ?? 30) * .06 + Math.min(10, campaign.nomination?.internalSupport ?? 5) * 1.2 + (rand() - .5) * 16;
  const mates = Math.max(listSeats + 3, 6);
  // List mates: a few well-known names at the top, then candidates with less pull.
  const others = Array.from({ length: mates }, (_, index) => 66 + (rand() - .5) * 30 - index * 1.6);
  const rank = 1 + others.filter(value => value > own).length;
  const votes = Math.max(40, Math.round(own * 42 * (campaign.electionType === 'europee' ? 30 : campaign.electionType === 'regionale' ? 4 : 1)));
  return { rank, votes, listCandidates: mates + 1, seats: listSeats };
}
// Inside a coalition every list keeps its own seats: the player's list counts for its own share of the total.
function ownListRatio(campaign, playerRow) {
  if (!playerRow || (playerRow.memberCandidateIds?.length ?? 1) <= 1) return 1;
  const weight = territories(campaign).reduce((sum, area) => sum + area.weight, 0) || 1;
  const own = territories(campaign).reduce((sum, area) => sum + Number(area.supportByCandidate?.[campaign.playerCandidateId] ?? 0) * area.weight, 0) / weight;
  return clamp(own / Math.max(.5, playerRow.percent), .05, 1);
}
// Seats of the player's list in the player's own constituency (closed lists: the place on the list decides).
function constituencySeats(campaign, playerRow) {
  const areas = territories(campaign);
  const home = areas.find(area => area.region === campaign.homeRegion) ?? areas.find(area => area.id === campaign.candidacy?.territoryId) ?? areas[0];
  if (!home || !playerRow) return { seats: 0, area: home ?? null };
  const national = Math.max(.5, playerRow.percent);
  const local = sharesByGroup(campaign, home.id).find(group => group.id === playerRow.id)?.share ?? national;
  const weightShare = home.weight / (areas.reduce((sum, area) => sum + area.weight, 0) || 1);
  const exact = (playerRow.proportionalSeats ?? playerRow.seats) * weightShare * (local / national) * ownListRatio(campaign, playerRow);
  const rand = seeded(hash(`${campaign.id}|resti`));
  // Remainders go one way or the other: the last seat of a constituency is never certain.
  const seats = Math.floor(exact) + (rand() < exact - Math.floor(exact) ? 1 : 0);
  return { seats, exact: rounded(exact), area: home, localShare: rounded(local) };
}
function europeanHomeSeats(campaign, playerRow) {
  const constituency = Object.entries(EUROPEAN_CONSTITUENCIES).find(([, regions]) => regions.includes(campaign.homeRegion))?.[0];
  const area = territories(campaign).find(item => item.constituency === constituency) ?? territories(campaign)[0];
  const seats = playerRow?.circumscriptions?.find(item => item.territoryId === area?.id)?.seats ?? 0;
  return { seats, area };
}
function personalResult(campaign,playerRow,winner,rows) {
  const role=campaign.candidacy.role;
  const threshold = campaign.electionType === 'europee' ? EUROPEAN_THRESHOLD.percent : campaign.electionType === 'comunale' ? (campaign.municipalityBand === 'oltre-15000' ? SEAT_RULES.comunale.threshold : 0) : SEAT_RULES[campaign.electionType]?.threshold ?? 0;
  const base = { mandate:false, via:null, side:null, position:playerRow ? rows.indexOf(playerRow) + 1 : null, threshold, belowThreshold:Boolean(playerRow && threshold && playerRow.percent < threshold) };
  if(!playerRow) return { ...base, code:'escluso' };
  const won = winner?.id===campaign.playerCandidateId;
  if(role==='sindaco'||role==='presidente') {
    if (won) return { ...base, mandate:true, via:campaign.stage==='ballottaggio'?'ballottaggio':'diretto', side:'maggioranza', code:campaign.stage==='ballottaggio'?'ballottaggio-vinto':'vittoria' };
    // A defeated candidate for mayor with seats for the list, or the runner-up for President, sits in the council.
    const seat = role==='sindaco' ? playerRow.seats > 0 : base.position === 2;
    if (seat) return { ...base, mandate:true, via:'opposizione', side:'opposizione', code:'eletto-opposizione', lostTo:winner?.id ?? null, runoffLost:campaign.stage==='ballottaggio' };
    return { ...base, code:campaign.stage==='ballottaggio'?'ballottaggio-perso':'sconfitta', lostTo:winner?.id ?? null };
  }
  // A list below the threshold gets no seats (a single-member district can still be won: see below).
  if (base.belowThreshold && role !== 'uninominale') return { ...base, code:'sotto-soglia' };
  if(role==='consigliere'||role==='eurodeputato') {
    const groupSeats = role==='eurodeputato' ? europeanHomeSeats(campaign, playerRow).seats : playerRow.seats;
    const listSeats = Math.round(groupSeats * ownListRatio(campaign, playerRow));
    const preference = preferenceStanding(campaign, listSeats);
    const coalition = (playerRow.memberCandidateIds?.length ?? 1) > 1;
    if (listSeats > 0 && preference.rank <= listSeats) return { ...base, mandate:true, via:coalition?'coalizione':'lista', side:campaign.electionType==='europee'?null:won?'maggioranza':'opposizione', code:coalition?'eletto-coalizione':'eletto-lista', preference };
    return { ...base, code:listSeats > 0 && preference.rank === listSeats + 1 ? 'primo-non-eletto' : listSeats > 0 ? 'non-eletto' : 'sconfitta', preference };
  }
  if(role==='deputato'||role==='senatore') {
    const constituency = constituencySeats(campaign, playerRow);
    const coalition = (playerRow.memberCandidateIds?.length ?? 1) > 1;
    if (constituency.seats >= campaign.candidacy.listPosition) return { ...base, mandate:true, via:coalition?'coalizione':'lista', code:coalition?'eletto-coalizione':'eletto-lista', constituency:{ seats:constituency.seats, name:constituency.area?.name ?? null, localShare:constituency.localShare ?? null } };
    return { ...base, code:constituency.seats > 0 ? 'posizione-lista' : 'sconfitta', constituency:{ seats:constituency.seats, name:constituency.area?.name ?? null, localShare:constituency.localShare ?? null } };
  }
  if(role==='uninominale') {
    const areas = territories(campaign);
    const district = areas.find(area => area.id === campaign.candidacy.territoryId) ?? areas.find(area => area.region === campaign.homeRegion) ?? areas[0];
    const ranking = sharesByGroup(campaign, district?.id);
    const districtPosition = ranking.findIndex(group => group.id === campaign.playerCandidateId) + 1;
    const districtInfo = { name:district?.name ?? null, position:districtPosition || null, share:ranking.find(group => group.id === campaign.playerCandidateId)?.share ?? 0, winnerId:ranking[0]?.id ?? null, margin:rounded((ranking[0]?.share ?? 0) - (ranking[1]?.share ?? 0)) };
    if (districtPosition === 1) return { ...base, mandate:true, via:'collegio', code:'vittoria', district:districtInfo };
    // Candidates in a single-member district also head a proportional list: losing the district is not the end.
    const constituency = base.belowThreshold ? { seats:0 } : constituencySeats(campaign, playerRow);
    if (constituency.seats >= Math.max(1, campaign.candidacy.listPosition)) return { ...base, mandate:true, via:'proporzionale', code:'eletto-proporzionale', district:districtInfo, constituency:{ seats:constituency.seats, name:constituency.area?.name ?? null } };
    return { ...base, code:base.belowThreshold ? 'sotto-soglia' : 'sconfitta', district:districtInfo };
  }
  return { ...base, mandate:playerRow.percent>0, code:'eletto' };
}

function objectiveMet(campaign,playerRow,personalMandate) {
  if(campaign.objective==='win')return Boolean(personalMandate);
  if(campaign.objective==='threshold')return campaign.electionType==='europee'?playerRow?.percent>=EUROPEAN_THRESHOLD.percent:playerRow?.seats>0||playerRow?.percent>=10;
  return (playerRow?.percent??0)>=12||personalMandate;
}

// The result as the player lives it: how it ended, the position, the gap, and whether it beat expectations.
export function classifyOutcome(campaign, result) {
  const personal = result.personal ?? {};
  const code = personal.code ?? (result.personalMandate ? 'eletto' : 'sconfitta');
  const meta = OUTCOME_LABELS[code] ?? OUTCOME_LABELS.sconfitta;
  const rows = result.groups ?? [];
  const playerRow = rows.find(row => row.id === campaign.playerCandidateId) ?? null;
  const winner = rows.find(row => row.id === result.winnerGroupId) ?? rows[0] ?? null;
  const next = rows.find(row => row.id !== campaign.playerCandidateId && row !== winner) ?? null;
  // After a runoff the comparison with expectations uses the first round (the runoff share is between two only).
  const share = result.runoffResults?.length ? (playerRow?.percent ?? result.playerShare ?? 0) : (result.playerShare ?? 0);
  const expected = campaign.expectation?.share ?? campaign.consensusHistory?.[0]?.value ?? share;
  const band = Math.max(1.5, expected * .12);
  const diff = rounded(share - expected);
  const expectation = diff >= band ? 'sopra' : diff <= -band ? 'sotto' : 'in-linea';
  const poll = campaign.preparation?.pollShare ?? campaign.expectation?.pollShare ?? null;
  const position = personal.position ?? (playerRow ? rows.indexOf(playerRow) + 1 : null);
  const positionLabel = position === 1 ? 'primo posto' : position === 2 ? 'secondo posto' : position === 3 ? 'terzo posto' : position ? `${position}º posto` : 'fuori corsa';
  const margin = playerRow && winner ? rounded(winner.id === playerRow.id ? playerRow.percent - (next?.percent ?? 0) : playerRow.percent - winner.percent) : null;
  return {
    code, label:meta.label, tone:meta.tone, mandate:Boolean(result.personalMandate), via:personal.via ?? null, side:personal.side ?? null,
    position, positionLabel, margin, expected:rounded(expected), diff, expectation,
    expectationLabel:expectation === 'sopra' ? 'Sopra le attese' : expectation === 'sotto' ? 'Sotto le attese' : 'In linea con le attese',
    pollShare:poll, belowThreshold:Boolean(personal.belowThreshold), threshold:personal.threshold ?? null,
    preference:personal.preference ?? null, constituency:personal.constituency ?? null, district:personal.district ?? null,
    runoff:Boolean(result.runoffResults?.length), source:'simulation'
  };
}

export function campaignConsensus(campaign) {
  const own=aggregateShares(campaign).find(group=>group.id===campaign.playerCandidateId);
  return rounded(own?.share??0);
}

export function resultDescription(campaign,result) {
  const row=result.groups.find(item=>item.id===campaign.playerCandidateId);
  if(!row)return 'La candidatura non ha prodotto un risultato personale.';
  const outcome = result.outcome ?? classifyOutcome(campaign, result);
  const winnerLabel = result.groups.find(item=>item.id===result.winnerGroupId)?.label??'un’altra lista';
  const texts = {
    vittoria: campaign.electionType==='comunale' ? 'Hai vinto la competizione per l’incarico comunale nello scenario simulato.' : campaign.electionType==='regionale'&&campaign.candidacy.role==='presidente' ? 'La tua candidatura alla presidenza è arrivata prima.' : campaign.candidacy.role==='uninominale' ? 'Hai vinto il collegio uninominale.' : `Hai conquistato un mandato. La lista collegata ha ottenuto ${row.seats} seggi.`,
    'ballottaggio-vinto':'Hai vinto al ballottaggio: il secondo turno ha ribaltato o confermato il primo.',
    'eletto-lista':`Eletto grazie alla lista: ${row.seats} seggi e una posizione utile${outcome.preference ? ` (${outcome.preference.rank}º per preferenze)` : ''}.`,
    'eletto-coalizione':`Eletto grazie alla coalizione: i voti degli alleati hanno portato ${row.seats} seggi.`,
    'eletto-proporzionale':'Il collegio è andato a un avversario, ma la posizione nella lista proporzionale ti porta comunque in Parlamento.',
    'eletto-opposizione':`La vittoria è andata a ${winnerLabel}: entri in consiglio all’opposizione.`,
    'ballottaggio-perso':`Al ballottaggio vince ${winnerLabel}.`,
    'primo-non-eletto':`La lista ha ottenuto ${row.seats} seggi, ma le preferenze ti lasciano primo dei non eletti.`,
    'non-eletto':`La lista ha ottenuto ${row.seats} seggi, ma le preferenze non bastano per entrare.`,
    'posizione-lista':`La lista ha ottenuto seggi, ma non abbastanza nella tua circoscrizione per la tua posizione in lista (${campaign.candidacy.listPosition}).`,
    'sotto-soglia':`La lista resta sotto la soglia di sbarramento (${outcome.threshold}%): nessun seggio.`,
    sconfitta: result.winnerGroupId!==campaign.playerCandidateId ? `La vittoria è andata a ${winnerLabel}.` : 'La lista è arrivata prima, ma la tua posizione non è risultata utile per un seggio.',
    escluso:'Non eri in corsa: il partito non ti ha candidato.'
  };
  return texts[outcome.code] ?? (result.personalMandate ? `Hai conquistato un mandato. La lista collegata ha ottenuto ${row.seats} seggi.` : `La vittoria è andata a ${winnerLabel}.`);
}
