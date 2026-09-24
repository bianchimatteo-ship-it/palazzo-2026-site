import { ELECTION_MODELS, EUROPEAN_THRESHOLD } from '../data/simulation/campaign-rules.js?v=20260924-19';

const clamp = (value,min=0,max=100) => Math.min(max,Math.max(min,value));
const rounded = value => Math.round(value*100)/100;
const territories = campaign => campaign.territories ?? [];
const playerId = campaign => campaign.playerCandidateId;

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

function resultRow(group,share,totalBallots,seats=0) {
  return {
    id:group.id,candidateId:group.leaderCandidateId,partyIds:group.partyIds,memberCandidateIds:group.members,
    label:group.label,percent:rounded(share),votes:Math.round(totalBallots*share/100),seats,
    source:'simulation'
  };
}

function areaResults(campaign,totalBallots=100000) {
  return territories(campaign).map(area=>{
    let groups=sharesByGroup(campaign,area.id);
    if(campaign.stage==='ballottaggio') {
      const retained=groups.reduce((sum,group)=>sum+group.share,0)||1;
      groups=groups.map(group=>({...group,share:rounded(group.share*100/retained)}));
    }
    return {territoryId:area.id,name:area.name,weight:area.weight,groups:groups.map(group=>resultRow(group,group.share,Math.round(totalBallots*area.weight/territories(campaign).reduce((sum,item)=>sum+item.weight,0))))};
  });
}

function municipalSeats(campaign,groups) {
  const count=campaign.municipalityBand==='oltre-15000'?16:12;
  // Council size and seat distribution are deliberately simplified game rules.
  return allocateDHondt(groups,count,0);
}

function allocateRegional(campaign,groups) {
  const rule=ELECTION_MODELS[campaign.electionType];
  return allocateDHondt(groups,rule.seatCount,0);
}

function nationalSeats(campaign,groups) {
  const seatCount=campaign.candidacy.role==='senatore'?200:400;
  const uninominalCount=Math.round(seatCount*.37);
  const proportionalCount=seatCount-uninominalCount;
  const districts=new Map(groups.map(group=>[group.id,{...group,districtSeats:0}]));
  const areas=territories(campaign);
  const exact=areas.map(area=>({area,seats:uninominalCount*area.weight/areas.reduce((sum,item)=>sum+item.weight,0)}));
  const assigned=exact.map(item=>({...item,count:Math.floor(item.seats)}));
  let remaining=uninominalCount-assigned.reduce((sum,item)=>sum+item.count,0);
  [...assigned].sort((a,b)=>(b.seats-Math.floor(b.seats))-(a.seats-Math.floor(a.seats))||a.area.id.localeCompare(b.area.id)).slice(0,remaining).forEach(item=>item.count++);
  for(const item of assigned) {
    const top=sharesByGroup(campaign,item.area.id)[0];
    const winner=top&&districts.get(top.id);
    if(winner)winner.districtSeats+=item.count;
  }
  const proportional=allocateDHondt(groups,proportionalCount,3);
  const prById=new Map(proportional.map(item=>[item.id,item.seats]));
  return [...districts.values()].map(group=>({...group,seats:group.districtSeats+(prById.get(group.id)||0)})).sort((a,b)=>b.seats-a.seats||b.share-a.share);
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
  if(campaign.stage==='ballottaggio'&&firstRound?.runoffCandidateIds) {
    const finalShares=normalizedTwoRound(campaign,firstRound.runoffCandidateIds);
    runoffRows=finalShares.map(group=>resultRow(group,group.share,totalBallots));
    runoffWinnerId=runoffRows[0]?.candidateId??null;
    const firstGroups=firstRound.groups.map(row=>({id:row.candidateId,share:row.percent,label:row.label,partyIds:row.partyIds,members:row.memberCandidateIds,leaderCandidateId:row.candidateId}));
    const municipalAllocation=municipalSeats(campaign,firstGroups);
    rows=firstRound.groups.map(row=>{const group=firstGroups.find(item=>item.id===row.candidateId);const scored=resultRow(group,row.percent,totalBallots,municipalAllocation.find(item=>item.id===group.id)?.seats??0);const final=runoffRows.find(item=>item.candidateId===row.candidateId);return {...scored,runoffPercent:final?.percent??null,runoffVotes:final?.votes??null};});
  } else if(campaign.electionType==='comunale') {
    const seats=municipalSeats(campaign,aggregate);
    rows=aggregate.map(group=>resultRow(group,group.share,totalBallots,seats.find(row=>row.id===group.id)?.seats??0));
  } else if(campaign.electionType==='regionale') {
    const seats=allocateRegional(campaign,aggregate);
    rows=aggregate.map(group=>resultRow(group,group.share,totalBallots,seats.find(row=>row.id===group.id)?.seats??0));
  } else if(campaign.electionType==='politiche') {
    const seats=nationalSeats(campaign,aggregate);
    rows=aggregate.map(group=>resultRow(group,group.share,totalBallots,seats.find(row=>row.id===group.id)?.seats??0));
  } else {
    const seats=europeanSeats(campaign,aggregate);
    rows=aggregate.map(group=>resultRow(group,group.share,totalBallots,seats.find(row=>row.id===group.id)?.seats??0));
  }
  rows.sort((a,b)=>b.percent-a.percent||b.seats-a.seats);
  const winnerId=runoffWinnerId??rows[0]?.id??null;
  const winner=rows.find(row=>row.id===winnerId)??rows[0]??null;
  const playerRow=rows.find(row=>row.id===campaign.playerCandidateId)??null;
  const personalMandate=personalResult(campaign,playerRow,winner,rows);
  const previous=campaign.firstRoundResult;
  return {
    stage:'risultato-finale',model:rules.model,electionType:campaign.electionType,totalBallots,
    ballotLabel:'Schede normalizzate su 100.000 elettori simulati',groups:rows,
    territories:areaResults(campaign,totalBallots),firstRound:previous??firstRound??null,
    winnerGroupId:winnerId,playerShare:runoffRows?.find(row=>row.candidateId===campaign.playerCandidateId)?.percent??playerRow?.percent??0,playerVotes:runoffRows?.find(row=>row.candidateId===campaign.playerCandidateId)?.votes??playerRow?.votes??0,runoffResults:runoffRows,
    playerSeats:playerRow?.seats??0,personalMandate,source:'simulation',simulated:true,
    objectiveMet:objectiveMet(campaign,playerRow,personalMandate),
    turnout:Math.round(clamp(61+(campaign.candidateStats.reputation-50)*.16+(campaign.candidateStats.notoriety-40)*.08+((campaign.context?.participation??60)-60)*.5,38,78)*100)/100
  };
}

function personalResult(campaign,playerRow,winner,rows) {
  if(!playerRow)return false;
  const role=campaign.candidacy.role;
  if(role==='sindaco'||role==='presidente')return winner?.id===campaign.playerCandidateId;
  if(campaign.electionType==='comunale'&&campaign.stage==='ballottaggio')return winner?.id===campaign.playerCandidateId;
  if(role==='consigliere'||role==='deputato'||role==='senatore'||role==='eurodeputato') return playerRow.seats>=campaign.candidacy.listPosition;
  if(role==='uninominale') {
    const topTerritory=territories(campaign).find(item=>item.id===campaign.candidacy.territoryId)??territories(campaign)[0];
    return sharesByGroup(campaign,topTerritory?.id)[0]?.id===campaign.playerCandidateId;
  }
  return rows.some(row=>row.id===playerRow.id)&&playerRow.percent>0;
}

function objectiveMet(campaign,playerRow,personalMandate) {
  if(campaign.objective==='win')return Boolean(personalMandate);
  if(campaign.objective==='threshold')return campaign.electionType==='europee'?playerRow?.percent>=EUROPEAN_THRESHOLD.percent:playerRow?.seats>0||playerRow?.percent>=10;
  return (playerRow?.percent??0)>=12||personalMandate;
}

export function campaignConsensus(campaign) {
  const own=aggregateShares(campaign).find(group=>group.id===campaign.playerCandidateId);
  return rounded(own?.share??0);
}

export function resultDescription(campaign,result) {
  const row=result.groups.find(item=>item.id===campaign.playerCandidateId);
  if(!row)return 'La candidatura non ha prodotto un risultato personale.';
  if(campaign.electionType==='comunale'&&result.winnerGroupId===campaign.playerCandidateId)return 'Hai vinto la competizione per l’incarico comunale nello scenario simulato.';
  if(campaign.electionType==='regionale'&&campaign.candidacy.role==='presidente'&&result.winnerGroupId===campaign.playerCandidateId)return 'La tua candidatura alla presidenza è arrivata prima.';
  if(result.personalMandate)return `Hai conquistato un mandato. La lista collegata ha ottenuto ${row.seats} seggi.`;
  if(result.winnerGroupId!==campaign.playerCandidateId)return `La vittoria è andata a ${result.groups.find(item=>item.id===result.winnerGroupId)?.label??'un’altra lista'}.`;
  return 'La lista è arrivata prima, ma la tua posizione non è risultata utile per un seggio.';
}
