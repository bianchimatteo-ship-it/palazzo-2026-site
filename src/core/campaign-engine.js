import { advanceDays } from './time.js?v=20260924-10';
import { CAMPAIGN_ACTIVITIES, DEBATE_TOPICS, ELECTION_MODELS, EUROPEAN_THRESHOLD } from '../data/simulation/campaign-rules.js?v=20260924-10';
import { runFinalElection, runFirstRound } from './election-engine.js?v=20260924-10';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20260924-10';

const SOURCE = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = value => Math.round(value * 100) / 100;
const copy = value => JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
function randomFrom(seed) {
  let value = seed >>> 0 || 1;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}
function draw(campaign) {
  campaign.rngState = (Math.imul(campaign.rngState, 1664525) + 1013904223) >>> 0;
  return campaign.rngState / 4294967296;
}
function withinDays(date, count) { return advanceDays(date, count); }
function gameStat(records, playerId, metric, fallback) {
  return records.find(record => record.subjectId === playerId && record.metric === metric)?.value ?? fallback;
}
function normalized(values) {
  const total = values.reduce((sum, value) => sum + Math.max(.01, value), 0) || 1;
  return values.map(value => round(Math.max(.01, value) * 100 / total));
}
function ids(prefix, seed, index = 0) { return `${prefix}-${seed.toString(36)}-${index}`; }

function campaignTerritories(type, player, userTerritories) {
  const playerMunicipality = userTerritories.find(item => item.id === player.territoryId)?.name ?? player.municipality ?? 'Territorio locale';
  if (type === 'comunale') return [{ id:`sim-territory-comune-${hash(playerMunicipality).toString(36)}`, name:playerMunicipality, kind:'comune', weight:100, source:SOURCE, scope:'territorio comunale', organization:30 }];
  if (type === 'regionale') return [
    ['area-capoluogo', 'Capoluogo e area urbana', 27], ['area-nord', 'Area regionale settentrionale', 25],
    ['area-centro', 'Area regionale centrale', 25], ['area-sud', 'Area regionale meridionale', 23]
  ].map(([id,name,weight], index) => ({ id:`sim-${player.region.toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g,'-')}-${id}`, name, kind:'area-regionale-simulata', region:player.region, weight, source:SOURCE, organization:Math.max(8, 28 - index * 3) }));
  if (type === 'europee') return [
    ['nord-occidentale','Italia nord-occidentale',26], ['nord-orientale','Italia nord-orientale',20],
    ['centrale','Italia centrale',20], ['meridionale','Italia meridionale',24], ['insulare','Italia insulare',10]
  ].map(([id,name,weight], index) => ({ id:`sim-circoscrizione-${id}`, name, kind:'circoscrizione-di-simulazione', weight, source:SOURCE, organization:Math.max(9,27-index*2) }));
  return ITALIAN_REGIONS.map((name,index) => ({ id:`sim-regione-${index+1}`, name, region:name, kind:'regione', weight:100/ITALIAN_REGIONS.length, source:SOURCE, organization:20 }));
}

function createCandidate({ id, player = false, partyId = null, displayName, seed, stats = {} }) {
  const rand = randomFrom(seed);
  return {
    id, partyId, displayName, displayLabel:displayName, source:SOURCE, isPlayer:player, status:'active', strategy:'territoriale',
    resources:{ money:Math.round(500+rand()*900), volunteers:Math.round(8+rand()*10), organization:Math.round(30+rand()*35), politicalCapital:Math.round(5+rand()*5) },
    campaignStats:player ? { ...stats, momentum:round((rand()-.5)*4), source:SOURCE } : {
      reputation:Math.round(42+rand()*24), notoriety:Math.round(25+rand()*45), experience:Math.round(15+rand()*70),
      influence:Math.round(15+rand()*65), debateReadiness:Math.round(28+rand()*55), momentum:round((rand()-.5)*5), source:SOURCE
    },
    relationship:player ? null : round(rand()), coalitionLeaderId:null, lastAction:'Sta definendo le priorità della campagna.'
  };
}

function buildOpponents(partyId, catalog, seed, count = 3, realCandidates = []) {
  const rand = randomFrom(seed ^ 0x5bd1e995);
  const parties = catalog.filter(item => item?.id && item.id !== partyId && (item.source === 'real' || item.source === 'simulation' || item.source === 'user'))
    .sort((a,b) => String(a.id).localeCompare(String(b.id)));
  for (let i=parties.length-1;i>0;i--) { const j=Math.floor(rand()*(i+1)); [parties[i],parties[j]]=[parties[j],parties[i]]; }
  const candidates = [];
  for (let index=0;index<count;index++) {
    const party = parties[index % Math.max(1, parties.length)] ?? null;
    const candidateId = ids('candidatura-simulata',seed,index+1);
    const person = realCandidates[index];
    // A documented parliamentarian keeps only verified identity data; campaign numbers stay simulated.
    if (person) candidates.push({ ...createCandidate({ id:candidateId, partyId:null, displayName:person.fullName, seed:seed + index*97 }), realReference:{ politicianId:person.id, fullName:person.fullName, chamber:person.chamber, groupId:person.groupId ?? null, groupName:person.groupName ?? null, electedOnList:person.electedOnList ?? null, circoscription:person.circoscription ?? null, sourceUrl:person.sourceUrl, sourceName:person.sourceName, source:'real', verified:true } });
    else candidates.push(createCandidate({ id:candidateId, partyId:party?.id ?? null, displayName:`Candidatura simulata ${index+1}`, seed:seed + index*97 }));
  }
  return candidates;
}

function initSupport(areas, candidates, player, seed) {
  const rand = randomFrom(seed ^ 0x7f4a7c15);
  for (const area of areas) {
    const strengths = candidates.map((candidate,index) => {
      const stats = candidate.campaignStats;
      const foundation = candidate.isPlayer
        ? 12 + Number(stats.popularity ?? 42)*.14 + Number(stats.notoriety ?? 20)*.07 + Number(stats.influence ?? 14)*.055 + Number(stats.experience ?? 18)*.04
        : 15 + Number(stats.notoriety ?? 35)*.08 + Number(stats.influence ?? 30)*.05 + Number(stats.experience ?? 35)*.035;
      const territoryBoost = candidate.isPlayer && (area.name === player.municipality || area.region === player.region) ? 3.2 : 0;
      return Math.max(4, foundation + territoryBoost + (candidate.campaignStats.momentum??0)*.55 + (area.localTrend??0)*.8 + rand()*7 + area.organization*.015);
    });
    const shares = normalized(strengths);
    area.supportByCandidate = Object.fromEntries(candidates.map((candidate,index) => [candidate.id,shares[index]]));
  }
}

function addHistory(campaign, type, text, extra = {}) {
  campaign.history.unshift({ id:ids('azione',campaign.seed,campaign.history.length+campaign.day), day:campaign.day, date:campaign.currentDate, type, text, source:SOURCE, ...extra });
  campaign.history = campaign.history.slice(0,60);
}
function moveSupport(campaign, candidateId, delta, areaId = null) {
  const areas = areaId ? campaign.territories.filter(item => item.id === areaId) : campaign.territories;
  if (!areas.length || !delta) return;
  for (const area of areas) {
    const shares = area.supportByCandidate;
    const own = Number(shares[candidateId] ?? 0);
    const actual = Math.min(Math.max(-own + .01, delta), Object.keys(shares).length > 1 ? 4 : 0);
    const others = Object.keys(shares).filter(id => id !== candidateId && campaign.candidates.find(item => item.id === id)?.status === 'active');
    const othersTotal = others.reduce((sum,id) => sum + Number(shares[id] ?? 0),0);
    if (!others.length || !othersTotal) continue;
    shares[candidateId] = round(clamp(own + actual,0,100));
    for (const id of others) shares[id] = round(clamp(Number(shares[id]) - actual*Number(shares[id])/othersTotal,0,100));
    const sum = Object.values(shares).reduce((total,value)=>total+value,0);
    const diff = round(100-sum);
    if (diff) shares[others[0]] = round(clamp(shares[others[0]]+diff,0,100));
  }
}
function resourceAffordable(resources,cost) {
  return Object.entries(cost ?? {}).every(([name,value]) => Number(resources[name] ?? 0) >= Number(value ?? 0));
}
function charge(resources,cost) {
  for (const [name,value] of Object.entries(cost ?? {})) resources[name] = Math.max(0,Number(resources[name] ?? 0)-Number(value ?? 0));
}
function supportAt(campaign, territoryId, candidateId = campaign.playerCandidateId) {
  return Number(campaign.territories.find(area=>area.id===territoryId)?.supportByCandidate?.[candidateId] ?? 0);
}
function targetArea(campaign, requestedId) { return campaign.territories.find(item=>item.id===requestedId) ?? campaign.territories[0]; }
function activeOpponents(campaign) { return campaign.candidates.filter(item=>!item.isPlayer&&item.status==='active'); }
function pendingEvent(campaign, kind, title, body, choices) {
  if (campaign.pendingEvents.length) return;
  campaign.pendingEvents.push({ id:ids('evento-campagna',campaign.seed,campaign.day), kind, title, body, choices, day:campaign.day, date:campaign.currentDate, source:SOURCE });
}
function contextualEvent(campaign, context) {
  if (campaign.pendingEvents.length || campaign.status !== 'active') return;
  const player = campaign.candidates.find(item=>item.isPlayer);
  const rand = draw(campaign);
  const events = [];
  if (context === 'public-event' && rand < .48) events.push({
    kind:'protest', title:'Protesta durante un evento pubblico', body:'Un gruppo di cittadini contesta l’iniziativa. Ascoltare le richieste richiede tempo e organizzazione; interrompere l’evento protegge le risorse ma lascia spazio alle critiche.',
    choices:[{id:'listen',label:'Apri un confronto pubblico',effects:{organization:-1,volunteers:-1,reputation:.7,visibility:1}},{id:'close',label:'Concludi l’evento',effects:{reputation:-.7,politicalCapital:1}}]
  });
  if (context === 'internal' && campaign.nomination.status === 'pending' && rand < .52) events.push({
    kind:'party-crisis', title:'Tensione nel coordinamento del partito', body:'Una parte del coordinamento chiede garanzie sulla lista. Un compromesso può rafforzare la candidatura interna, ma usa capitale politico.',
    choices:[{id:'compromise',label:'Negozia un compromesso',effects:{politicalCapital:-1,organization:-1,internalSupport:1}},{id:'stand',label:'Mantieni la posizione',effects:{internalSupport:-.5,reputation:.2}}]
  });
  if (context === 'media' && campaign.candidateStats.notoriety > 36 && rand < .38) events.push({
    kind:'media', title:'Una finestra mediatica', body:'Una redazione locale propone un approfondimento. La maggiore esposizione può allargare il pubblico e aumentare le critiche.',
    choices:[{id:'accept',label:'Accetta l’intervista',effects:{visibility:5,notoriety:1.2,politicalCapital:-1}},{id:'decline',label:'Rifiuta e concentra il lavoro sul territorio',effects:{organization:2}}]
  });
  if (campaign.candidateStats.reputation < 42 && rand < .72) events.push({
    kind:'controversy', title:'Una dichiarazione fa discutere', body:'Un passaggio della comunicazione è stato contestato. Puoi chiarire il contesto o lasciare che la discussione si esaurisca.',
    choices:[{id:'clarify',label:'Pubblica una rettifica',effects:{money:-350,reputation:1.1,visibility:1}},{id:'ignore',label:'Non alimentare la polemica',effects:{reputation:-1.3,politicalCapital:1}}]
  });
  const weakest = campaign.territories.reduce((a,b)=>supportAt(campaign,a.id)<supportAt(campaign,b.id)?a:b,campaign.territories[0]);
  if (weakest && supportAt(campaign,weakest.id)<13 && rand < .68) events.push({
    kind:'territory', title:`Richiesta da ${weakest.name}`, body:'Una rete civica chiede un confronto pubblico nell’area. La risposta può rafforzare il legame locale o sottrarre risorse ad altre priorità.',
    choices:[{id:'visit',label:'Accetta la visita',effects:{volunteers:-1,organization:-1,territory:weakest.id,support:.45}},{id:'defer',label:'Rimanda dopo le elezioni',effects:{politicalCapital:-1}}]
  });
  if (player && player.resources.organization < 8 && rand < .75) events.push({
    kind:'organization', title:'La macchina organizzativa è sotto pressione', body:'I coordinamenti chiedono tempo e persone. Se non intervieni, alcuni appuntamenti potrebbero perdere efficacia.',
    choices:[{id:'repair',label:'Riorganizza la squadra',effects:{money:-600,organization:4,volunteers:-1}},{id:'continue',label:'Mantieni il programma',effects:{organization:-2,reputation:-.5}}]
  });
  if (rand < .27) events.push({
    kind:'endorsement', title:'Un sostegno inatteso', body:'Un comitato civico locale propone un endorsement simulato. Il sostegno porta risorse, ma richiede un impegno pubblico.',
    choices:[{id:'accept',label:'Accetta il sostegno',effects:{volunteers:2,politicalCapital:1,visibility:2}},{id:'decline',label:'Mantieni autonomia',effects:{reputation:.3}}]
  });
  if (rand < .19) events.push({
    kind:'rival', title:'Un avversario cambia priorità', body:'Una candidatura rivale annuncia un evento nell’area dove la tua presenza è più debole. Puoi spostare parte del programma.',
    choices:[{id:'respond',label:'Rispondi con una visita locale',effects:{money:-250,volunteers:-1,territory:weakest?.id,support:.35}},{id:'hold',label:'Proteggi le risorse',effects:{organization:1}}]
  });
  if (events.length) campaign.pendingEvents.push({ id:ids('evento-campagna',campaign.seed,campaign.day), ...events[Math.floor(rand*events.length)], day:campaign.day, date:campaign.currentDate, source:SOURCE });
}
function evaluateNomination(campaign) {
  if (campaign.nomination.status !== 'pending' || campaign.day < campaign.nomination.deadlineDay) return;
  const strongestRival=Math.max(0,...campaign.internalCandidates.map(item=>item.internalSupport));
  if (campaign.nomination.internalSupport >= campaign.nomination.requiredSupport && campaign.nomination.internalSupport > strongestRival) {
    campaign.nomination.status = 'approved';
    campaign.candidacy.listPosition = campaign.nomination.listPosition;
    addHistory(campaign,'candidatura','Il partito ha approvato la candidatura e la posizione in lista.',{source:SOURCE});
  } else {
    campaign.nomination.status = 'excluded';
    campaign.candidates.find(item=>item.isPlayer).status='eliminated';
    campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-1.5));
    addHistory(campaign,'candidatura','La candidatura non ha ottenuto sostegno interno sufficiente entro la scadenza.',{source:SOURCE});
  }
}
function opponentTurn(campaign) {
  if (campaign.status !== 'active') return;
  campaign.aiTurns=(campaign.aiTurns??0)+1;
  if(campaign.nomination.status==='pending') for(const rival of campaign.internalCandidates) {
    rival.internalSupport=round(clamp(rival.internalSupport+.25+draw(campaign)*.42,0,10));
    rival.lastAction='Sta cercando sostegno nel partito.';
  }
  const rivals = activeOpponents(campaign);
  if (!rivals.length) return;
  const player = campaign.candidates.find(item=>item.isPlayer);
  for (const rival of rivals) {
    if (rival.resources.money <= 0 || rival.resources.volunteers <= 0) {
      rival.strategy='conservazione';
      rival.lastAction='Ha ridotto il ritmo per proteggere le risorse.';
      continue;
    }
    const ranked = campaign.territories.map(area=>({area,own:Number(area.supportByCandidate[rival.id]??0),player:Number(area.supportByCandidate[player.id]??0)}));
    ranked.sort((a,b)=>(b.player-b.own)-(a.player-a.own));
    const target = ranked[0]?.area;
    const top = ranked.reduce((a,b)=>a.own>b.own?a:b,ranked[0]);
    rival.strategy = top.own > 34 ? 'difesa del vantaggio' : rival.resources.volunteers > 6 ? 'presidio dei territori deboli' : 'visibilità mirata';
    if (target) moveSupport(campaign,rival.id,.28+draw(campaign)*.37,target.id);
    rival.resources.money=Math.max(0,rival.resources.money-Math.round(80+draw(campaign)*200));
    rival.resources.volunteers=Math.max(0,rival.resources.volunteers-(draw(campaign)<.2?1:0));
    rival.resources.organization=Math.max(0,rival.resources.organization-(draw(campaign)<.3?1:0));
    rival.lastAction = rival.strategy==='difesa del vantaggio'?'Sta difendendo le aree in cui è avanti.':rival.strategy==='visibilità mirata'?'Ha ridotto gli appuntamenti per cercare copertura.':'Sta cercando sostegno nelle aree contendibili.';
    if (!campaign.alliances.some(item=>item.status==='active') && rival.relationship > .82 && rivals.length>1 && draw(campaign)<.12) {
      const leader = rivals.filter(item=>item.id!==rival.id).sort((a,b)=>a.relationship-b.relationship)[0];
      if (leader) {
        rival.status='allied'; rival.coalitionLeaderId=leader.id;
        campaign.alliances.push({id:ids('alleanza',campaign.seed,campaign.day+rivals.indexOf(rival)),leaderCandidateId:leader.id,partnerCandidateId:rival.id,status:'active',terms:'Sostegno e campagna condivisi; seggi calcolati insieme nello scenario.',formedOn:campaign.currentDate,source:SOURCE});
        addHistory(campaign,'alleanza','Due candidature simulate hanno annunciato un accordo.',{source:SOURCE});
      }
    }
  }
  const currentLeader = activeOpponents(campaign).sort((a,b)=>supportAt(campaign,campaign.territories[0].id,b.id)-supportAt(campaign,campaign.territories[0].id,a.id))[0];
  if (currentLeader && player && supportAt(campaign,campaign.territories[0].id,currentLeader.id)-supportAt(campaign,campaign.territories[0].id,player.id)>14 && draw(campaign)<.24) {
    pendingEvent(campaign,'rival','Un avversario attacca la tua proposta','Una candidatura rivale contesta pubblicamente una tua scelta. Rispondere può attirare attenzione e comporta un rischio reputazionale.',[
      {id:'answer',label:'Rispondi nel merito',effects:{visibility:2,reputation:.4,politicalCapital:-1,support:.25}},
      {id:'ignore',label:'Non spostare il programma',effects:{organization:1}}
    ]);
  }
}
function tick(campaign) {
  campaign.day++;
  campaign.currentDate=withinDays(campaign.startedAt,campaign.day);
  evaluateNomination(campaign);
  if (campaign.day>0 && campaign.day%7===0) {
    opponentTurn(campaign);
    if (!campaign.pendingEvents.length) contextualEvent(campaign,'week');
  }
  if (campaign.stage==='ballottaggio' && campaign.day>=campaign.totalDays) finish(campaign);
  else if (campaign.stage==='campagna' && campaign.day>=campaign.totalDays) {
    const first=runFirstRound(campaign);
    if (first.requiresRunoff) {
      campaign.firstRoundResult=first;
      campaign.stage='ballottaggio';
      campaign.runoffCandidateIds=first.runoffCandidateIds;
      campaign.totalDays+=14;
      campaign.electionDate=withinDays(campaign.electionDate,14);
      campaign.candidates.forEach(candidate=>{if(!campaign.runoffCandidateIds.includes(candidate.id))candidate.status='eliminated';});
      addHistory(campaign,'elezione','Primo turno concluso. Inizia il periodo di ballottaggio.',{source:SOURCE});
    } else finish(campaign,first);
  }
}
function finish(campaign,firstRound=null) {
  campaign.result=runFinalElection(campaign,firstRound);
  const opening=campaign.consensusHistory[0]?.value??campaign.result.playerShare;
  campaign.partyImpact={...campaign.partyImpact,openingConsensus:opening,electionResult:campaign.result.playerShare,consensusChange:round(campaign.result.playerShare-opening),reputationChange:round(campaign.candidateStats.reputation-campaign.startingStats.reputation),outcome:campaign.result.objectiveMet?'obiettivo-raggiunto':'obiettivo-non-raggiunto',asOf:campaign.currentDate,source:SOURCE};
  campaign.status='finished'; campaign.stage='risultato'; campaign.closedAt=campaign.currentDate;
  campaign.result.description = campaign.result.objectiveMet ? 'Obiettivo raggiunto.' : 'Obiettivo non raggiunto.';
  addHistory(campaign,'risultato',campaign.result.description,{source:SOURCE});
}

export function createCampaign({career,player,statistics=[],offices=[],territories:userTerritories=[],partyCatalog=[],currentDate,config={}}) {
  if (!career?.id || !player?.id) throw new Error('Crea prima un politico per iniziare la campagna.');
  const type=config.electionType;
  const model=ELECTION_MODELS[type];
  if (!model) throw new Error('Tipo di elezione non valido.');
  const seed=hash(`${career.id}|${currentDate}|${type}|${config.objective ?? 'build'}`);
  const partyId=player.partyId ?? career.partyId ?? null;
  const consensus=Number(gameStat(statistics,player.id,'consensus',4));
  const playerStats={
    popularity:Number(gameStat(statistics,player.id,'popularity',42)), reputation:Number(gameStat(statistics,player.id,'reputation',50)),
    consensus, experience:Number(gameStat(statistics,player.id,'experience',18)), influence:Number(gameStat(statistics,player.id,'influence',14)),
    notoriety:Number(gameStat(statistics,player.id,'notoriety',20)), source:SOURCE
  };
  const partyRecord=partyCatalog.find(item=>item.id===partyId);
  const userOrIndependent= !partyId || partyRecord?.source==='user' || partyRecord?.id?.startsWith('partito-utente-');
  const validRoles={comunale:['sindaco','consigliere'],regionale:['presidente','consigliere'],politiche:['deputato','senatore','uninominale'],europee:['eurodeputato']};
  const role=config.role ?? (type==='comunale'?'sindaco':type==='regionale'?'presidente':type==='politiche'?'deputato':'eurodeputato');
  if(!validRoles[type].includes(role)) throw new Error('Il ruolo selezionato non è compatibile con il tipo di elezione.');
  const campaignAreas=campaignTerritories(type,player,userTerritories);
  const localTrendRandom=randomFrom(seed ^ 0x27d4eb2f);
  campaignAreas.forEach(area=>{area.localTrend=round((localTrendRandom()-.5)*3);});
  if (type==='comunale') campaignAreas[0].region=player.region;
  const campaignId=ids('campagna',seed);
  const playerCandidateId=ids('candidatura-giocatore',seed);
  const officeTitle=String(offices.find(item=>item.id===player.roleId)?.title??'');
  const incumbency=type==='politiche' && /deputat|senat/i.test(officeTitle) && !/inizial/i.test(officeTitle);
  const candidate=createCandidate({id:playerCandidateId,player:true,partyId,displayName:player.displayName,seed,stats:playerStats});
  const opponents=buildOpponents(partyId,partyCatalog,seed,3,config.realCandidates??[]);
  const candidates=[candidate,...opponents];
  initSupport(campaignAreas,candidates,player,seed);
  const focus=campaignAreas.find(area=>area.name===player.municipality)?.id ?? campaignAreas.find(area=>area.region===player.region)?.id ?? campaignAreas[0].id;
  const deadlineDay=model.nominationDays;
  const internalSupport=partyId && !userOrIndependent ? round(1.5+playerStats.influence*.035+(incumbency?1.5:0)) : 10;
  const nomination={status:userOrIndependent?'approved':'pending',internalSupport,requiredSupport:7,deadlineDay,listPosition:6,source:SOURCE,
    incumbent:incumbency,incumbencyNote:incumbency?'La ricandidatura è da negoziare e non è garantita.':null};
  const baseMoney=type==='comunale'?9500:type==='regionale'?18000:28000;
  const initialResources={money:baseMoney+Math.round(playerStats.influence*55),volunteers:Math.max(8,Math.round(12+playerStats.influence*.25)),organization:Math.max(12,Math.round(24+playerStats.experience*.22)),visibility:Math.round(playerStats.notoriety*.22),politicalCapital:Math.max(5,Math.round(8+playerStats.influence*.13)),source:SOURCE};
  candidate.resources={...initialResources};
  const allPartyRefs=partyCatalog.filter(item=>candidates.some(candidate=>candidate.partyId===item.id)).map(item=>({id:item.id,source:item.source,verified:item.verified===true}));
  const internalRandom=randomFrom(seed ^ 0xc2b2ae35);
  const internalCandidates=userOrIndependent?[]:[0,1].map(index=>({id:ids('candidatura-interna',seed,index),displayName:`Candidatura interna simulata ${index+1}`,partyId,internalSupport:round(2.8+internalRandom()*3.5),lastAction:'Sta cercando sostegno nel partito.',source:SOURCE}));
  const campaign={
    id:campaignId,careerId:career.id,playerId:player.id,electionType:type,electionLabel:model.label,model:model.model,
    modelSource:model.source,modelReference:{source:'real',verified:true,sourceUrl:model.referenceUrl,sourceName:model.referenceName,verifiedAt:'2026-09-22',validFrom:null,validTo:null},
    ruleFacts:type==='europee'?{threshold:EUROPEAN_THRESHOLD}:null,
    municipalityBand:type==='comunale'?(config.municipalityBand==='oltre-15000'?'oltre-15000':'fino-15000'):null,
    objective:config.objective??'build',playerCandidateId,partyId,partyReferences:allPartyRefs,
    initialLevel:career.initialLevel,territoryId:career.territoryId,territories:campaignAreas,candidates,resources:initialResources,
    candidateStats:playerStats,startingStats:{...playerStats},nomination,internalCandidates,candidacy:{role,listPosition:6,territoryId:focus,incumbent:incumbency},
    status:'active',stage:'campagna',startedAt:currentDate,currentDate,electionDate:withinDays(currentDate,model.campaignDays),
    day:0,totalDays:model.campaignDays,daysToNomination:deadlineDay,firstRoundResult:null,result:null,runoffCandidateIds:null,
    alliances:[],events:[],pendingEvents:[],history:[],consensusHistory:[],aiTurns:0,preparationByTopic:Object.fromEntries(DEBATE_TOPICS.map(topic=>[topic.id,0])),
    nationalContext:{moodIndex:Math.round(42+randomFrom(seed ^ 0x165667b1)()*18),macroTrend:round((randomFrom(seed ^ 0x9e3779b9)()-.5)*4),salientTopic:DEBATE_TOPICS[Math.floor(randomFrom(seed ^ 0x85ebca6b)()*DEBATE_TOPICS.length)].id,source:SOURCE},
    media:{coverage:0,reactions:0,criticalEvents:0,source:SOURCE},partyImpact:{internalSupport:internalSupport,source:SOURCE},
    pollingHook:{provider:null,connected:false,signal:null,source:SOURCE,description:'Nessun sondaggio collegato: l’indicatore in schermata è una proiezione interna simulata.'},
    seed,rngState:seed,source:SOURCE
  };
  addHistory(campaign,'inizio',`${model.label}: inizia una campagna di ${model.campaignDays} giorni nello scenario simulato.`,{source:SOURCE});
  const openingWeight=campaignAreas.reduce((sum,item)=>sum+item.weight,0)||1;
  const openingConsensus=campaignAreas.reduce((sum,item)=>sum+Number(item.supportByCandidate[playerCandidateId]??0)*item.weight,0)/openingWeight;
  campaign.consensusHistory.push({day:0,date:currentDate,value:round(openingConsensus),source:SOURCE});
  return campaign;
}

export function performCampaignActivity(input,activityId,options={}) {
  const campaign=copy(input);
  if(campaign.status!=='active') throw new Error('Questa campagna è già conclusa.');
  const activity=CAMPAIGN_ACTIVITIES.find(item=>item.id===activityId);
  if(!activity) throw new Error('Attività di campagna non riconosciuta.');
  if(campaign.day+activity.days>campaign.totalDays) throw new Error('Non ci sono abbastanza giorni prima del voto per questa attività.');
  const player=campaign.candidates.find(item=>item.isPlayer);
  if(!resourceAffordable(player.resources,activity.cost)) throw new Error('Risorse insufficienti per questa attività.');
  if(activity.id==='debate' && campaign.nomination.status==='pending') throw new Error('Prima devi ottenere la candidatura del partito.');
  charge(player.resources,activity.cost);
  const area=targetArea(campaign,options.territoryId);
  const topic=DEBATE_TOPICS.find(item=>item.id===options.topicId)??DEBATE_TOPICS[0];
  let report='';
  if(activity.internalSupport) {
    if(campaign.nomination.status==='pending') {
      campaign.nomination.internalSupport=round(clamp(campaign.nomination.internalSupport+activity.internalSupport+Math.min(1,campaign.candidateStats.influence*.025),0,10));
      campaign.nomination.listPosition=Math.max(1,campaign.nomination.listPosition-(activity.listPosition??0));
      campaign.partyImpact.internalSupport=campaign.nomination.internalSupport;
      report=`Sostegno interno ${campaign.nomination.internalSupport}/10; posizione provvisoria ${campaign.nomination.listPosition}.`;
    } else if(campaign.nomination.status==='approved'&&activity.listPosition) {
      campaign.candidacy.listPosition=Math.max(1,campaign.candidacy.listPosition-activity.listPosition);
      campaign.nomination.listPosition=campaign.candidacy.listPosition;
      report=`La trattativa ha migliorato la tua posizione in lista: numero ${campaign.candidacy.listPosition}.`;
    }
  }
  if(activity.id==='debate_prep') {
    campaign.preparationByTopic[topic.id]=round(Math.min(24,(campaign.preparationByTopic[topic.id]??0)+activity.preparation+campaign.candidateStats.experience*.025));
    report=`Preparazione simulata su “${topic.label}”: ${campaign.preparationByTopic[topic.id]}/24.`;
  } else if(activity.id==='debate') {
    const opponent=campaign.candidates.find(item=>item.id===options.opponentId&&item.status==='active'&&!item.isPlayer)??activeOpponents(campaign).sort((a,b)=>supportAt(campaign,area.id,b.id)-supportAt(campaign,area.id,a.id))[0];
    const pressure=clamp((campaign.totalDays-campaign.day)/campaign.totalDays*100,0,100);
    const preparedness=campaign.preparationByTopic[topic.id]??0;
    const reputation=campaign.candidateStats.reputation*.17;
    const visibility=campaign.resources.visibility*.07;
    const pressurePenalty=Math.max(0,45-pressure)*.1;
    const playerScore=preparedness+reputation+visibility-pressurePenalty+draw(campaign)*5;
    const rivalScore=(opponent?.campaignStats.debateReadiness??40)*.48+(opponent?.campaignStats.reputation??50)*.15+draw(campaign)*5;
    const edge=playerScore-rivalScore;
    if(edge>1.5){moveSupport(campaign,player.id,.62,area.id);campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation+.45));report=`Il confronto su “${topic.label}” ha favorito la tua candidatura nello scenario simulato.`;}
    else if(edge< -1.5){moveSupport(campaign,player.id,-.55,area.id);campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.55));report=`Il confronto su “${topic.label}” ha lasciato un’impressione incerta nello scenario simulato.`;}
    else {report=`Il confronto su “${topic.label}” è terminato senza un vantaggio netto nello scenario simulato.`;}
    campaign.media.coverage=round(clamp(campaign.media.coverage+activity.visibility));
    campaign.media.reactions++;
  } else if(activity.id==='ally_meeting') {
    report=negotiateAllianceInPlace(campaign,options.targetCandidateId,true);
  } else if(activity.id==='fundraising') {
    const raised=Math.max(200,Math.round(activity.moneyGain*(.55+draw(campaign)*.9)*(campaign.candidateStats.reputation/60)));
    player.resources.money+=raised;
    campaign.resources.money=player.resources.money;
    report=`Raccolta simulata: +€${raised.toLocaleString('it-IT')}.`;
  } else {
    const support=activity.effect*(.55+player.resources.organization/120+player.resources.volunteers/100)*(0.78+campaign.candidateStats.reputation/180+campaign.nationalContext.macroTrend*.006)*(1.14+Number(area.localTrend??0)*.025-supportAt(campaign,area.id)/125);
    if(activity.scope==='national') moveSupport(campaign,player.id,Math.min(.85,support*.55));
    else if(activity.scope!=='internal'&&activity.effect) moveSupport(campaign,player.id,Math.min(1.5,support),area.id);
    if(activity.effect && activity.scope!=='internal') {
      campaign.candidateStats.consensus=round(clamp(campaign.candidateStats.consensus+Math.min(.5,support*.24)));
      player.campaignStats.consensus=campaign.candidateStats.consensus;
      report=`Variazione territoriale contenuta; presenza attuale ${supportAt(campaign,area.id).toFixed(1)}%.`;
    }
  }
  if(activity.preparation && activity.id!=='debate_prep') campaign.candidateStats.experience=round(clamp(campaign.candidateStats.experience+.1));
  player.resources.organization=clamp(player.resources.organization+(activity.id==='list_building'?2:activity.id==='party_meeting'&&campaign.nomination.status==='approved'?1:0),0,100);
  if(campaign.nomination.status==='approved'&&['party_meeting','list_building'].includes(activity.id)) campaign.candidateStats.influence=round(clamp(campaign.candidateStats.influence+.25));
  campaign.candidateStats.notoriety=round(clamp(campaign.candidateStats.notoriety+activity.visibility*.075));
  campaign.resources.visibility=round(clamp(campaign.resources.visibility+activity.visibility));
  campaign.media.coverage=round(clamp(campaign.media.coverage+activity.visibility*.45));
  const risk=clamp(activity.risk+campaign.candidateStats.notoriety*.18-campaign.candidateStats.reputation*.05,0,75);
  if(draw(campaign)<risk/100) {
    if(activity.category==='media') {
      campaign.media.criticalEvents++;
      campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.65));
      report += ' L’esposizione ha generato una reazione critica.';
      contextualEvent(campaign,'media');
    } else if(activity.category==='event') {
      player.resources.organization=Math.max(0,player.resources.organization-1);
      campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.45));
      moveSupport(campaign,player.id,-.3,area.id);
      report += ' Un imprevisto organizzativo ha ridotto l’impatto dell’evento.';
      campaign.media.reactions++;
    } else if(activity.category==='territory') {
      player.resources.volunteers=Math.max(0,player.resources.volunteers-1);
      player.resources.organization=Math.max(0,player.resources.organization-1);
      moveSupport(campaign,player.id,-.22,area.id);
      report += ' Un problema logistico ha ridotto la resa dell’iniziativa.';
    } else if(activity.category==='internal') {
      player.resources.organization=Math.max(0,player.resources.organization-1);
      campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.3));
      if(campaign.nomination.status==='pending') campaign.nomination.internalSupport=round(clamp(campaign.nomination.internalSupport-.45));
      report += ' La riunione ha lasciato una frizione nel coordinamento.';
    } else if(activity.category==='resources') {
      const loss=Math.min(650,player.resources.money);
      player.resources.money-=loss;
      report += ` La raccolta ha avuto un costo organizzativo di €${loss.toLocaleString('it-IT')}.`;
    }
  }
  if(activity.category==='media'&&!campaign.pendingEvents.length) contextualEvent(campaign,'media');
  addHistory(campaign,activity.category,`${activity.label}${area&&activity.scope!=='internal'?' — '+area.name:''}${report?' · '+report:''}`,{activityId,territoryId:area?.id,source:SOURCE});
  if(activity.category==='event'&&!campaign.pendingEvents.length) contextualEvent(campaign,'public-event');
  if(activity.category==='internal'&&!campaign.pendingEvents.length) contextualEvent(campaign,'internal');
  for(let day=0;day<activity.days;day++) tick(campaign);
  if(activity.category!=='media'&&campaign.day>0&&campaign.day%7===0&&!campaign.pendingEvents.length) contextualEvent(campaign,activity.category);
  const own=campaign.territories.reduce((sum,item)=>sum+Number(item.supportByCandidate[player.id]??0)*item.weight,0)/campaign.territories.reduce((sum,item)=>sum+item.weight,0);
  campaign.consensusHistory.push({day:campaign.day,date:campaign.currentDate,value:round(own),source:SOURCE});
  campaign.consensusHistory=campaign.consensusHistory.slice(-16);
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

function negotiateAllianceInPlace(campaign,targetId,costAlreadyPaid=false) {
  const player=campaign.candidates.find(item=>item.isPlayer);
  const choices=activeOpponents(campaign).filter(item=>!campaign.alliances.some(alliance=>alliance.status==='active'&&alliance.partnerCandidateId===item.id));
  const target=choices.find(item=>item.id===targetId)??choices.sort((a,b)=>a.relationship-b.relationship)[0];
  if(!target) return 'Non ci sono candidature disponibili per un nuovo accordo.';
  if(!costAlreadyPaid&&player.resources.politicalCapital<3) return 'Il capitale politico non basta per aprire questa trattativa.';
  const chance=clamp(18+target.relationship*57+campaign.candidateStats.influence*.22-(supportAt(campaign,campaign.territories[0].id,target.id)-supportAt(campaign,campaign.territories[0].id,player.id))*.6,8,82);
  if(!costAlreadyPaid) player.resources.politicalCapital-=3;
  if(draw(campaign)*100<chance) {
    target.status='allied'; target.coalitionLeaderId=player.id;
    campaign.alliances.push({id:ids('alleanza',campaign.seed,campaign.day),leaderCandidateId:player.id,partnerCandidateId:target.id,status:'active',terms:'Sostegno condiviso e lista comune nello scenario simulato.',formedOn:campaign.currentDate,source:SOURCE});
    player.resources.volunteers+=2; player.resources.organization+=1;
    return `Accordo raggiunto con una candidatura simulata; risorse condivise e sostegno aggregato.`;
  }
  campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.35));
  return `La trattativa con una candidatura simulata è fallita; il costo politico resta.`;
}

export function negotiateCampaignAlliance(input,targetId=null) {
  const campaign=copy(input);
  if(campaign.status!=='active') throw new Error('La campagna è conclusa.');
  const player=campaign.candidates.find(item=>item.isPlayer);
  if(player.resources.politicalCapital<3) throw new Error('Servono almeno 3 punti di capitale politico.');
  const report=negotiateAllianceInPlace(campaign,targetId,false);
  addHistory(campaign,'alleanza',report,{source:SOURCE});
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

export function breakCampaignAlliance(input,allianceId) {
  const campaign=copy(input);
  const alliance=campaign.alliances.find(item=>item.id===allianceId&&item.status==='active');
  if(!alliance) throw new Error('Accordo attivo non trovato.');
  if(alliance.leaderCandidateId!==campaign.playerCandidateId) throw new Error('L’accordo tra le altre candidature non è sotto il tuo controllo.');
  alliance.status='broken'; alliance.endedOn=campaign.currentDate;
  const partner=campaign.candidates.find(item=>item.id===alliance.partnerCandidateId);
  if(partner){partner.status='active';partner.coalitionLeaderId=null;}
  campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-1.2));
  campaign.candidates.find(item=>item.isPlayer).resources.politicalCapital=Math.max(0,campaign.candidates.find(item=>item.isPlayer).resources.politicalCapital-1);
  addHistory(campaign,'alleanza','Hai interrotto un accordo; il rapporto politico ne risente.',{source:SOURCE});
  return campaign;
}

export function decideCampaignEvent(input,eventId,choiceId) {
  const campaign=copy(input);
  const index=campaign.pendingEvents.findIndex(item=>item.id===eventId);
  if(index<0) throw new Error('Evento non più disponibile.');
  const event=campaign.pendingEvents[index];
  const choice=event.choices.find(item=>item.id===choiceId);
  if(!choice) throw new Error('Scelta non valida per questo evento.');
  const player=campaign.candidates.find(item=>item.isPlayer);
  const effect=choice.effects??{};
  for(const key of ['money','volunteers','organization','politicalCapital']) if(effect[key]) player.resources[key]=Math.max(0,Number(player.resources[key]??0)+effect[key]);
  if(effect.visibility){campaign.resources.visibility=clamp(campaign.resources.visibility+effect.visibility);campaign.media.coverage=clamp(campaign.media.coverage+effect.visibility);}
  if(effect.notoriety) campaign.candidateStats.notoriety=round(clamp(campaign.candidateStats.notoriety+effect.notoriety));
  if(effect.reputation) campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation+effect.reputation));
  if(effect.territory&&effect.support) moveSupport(campaign,player.id,effect.support,effect.territory);
  if(effect.internalSupport) campaign.nomination.internalSupport=round(clamp(campaign.nomination.internalSupport+effect.internalSupport,0,10));
  campaign.pendingEvents.splice(index,1);
  campaign.events.unshift({...event,choiceId,choiceLabel:choice.label,resolvedOn:campaign.currentDate,status:'resolved',source:SOURCE});
  campaign.events=campaign.events.slice(0,30);
  addHistory(campaign,'evento',`${event.title}: ${choice.label}.`,{source:SOURCE});
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

export function advanceCampaign(input,days=7) {
  const campaign=copy(input);
  if(campaign.status!=='active') return campaign;
  for(let day=0;day<Math.max(0,Math.min(120,Math.floor(days)));day++) {
    if(campaign.status!=='active')break;
    tick(campaign);
  }
  const player=campaign.candidates.find(item=>item.isPlayer);
  const average=campaign.territories.reduce((sum,area)=>sum+Number(area.supportByCandidate[player.id]??0)*area.weight,0)/campaign.territories.reduce((sum,area)=>sum+area.weight,0);
  if(campaign.consensusHistory.at(-1)?.day!==campaign.day) campaign.consensusHistory.push({day:campaign.day,date:campaign.currentDate,value:round(average),source:SOURCE});
  campaign.consensusHistory=campaign.consensusHistory.slice(-16);
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

export function campaignSummary(campaign) {
  const player=campaign.candidates.find(item=>item.isPlayer);
  const denominator=campaign.territories.reduce((sum,area)=>sum+area.weight,0)||1;
  const consensus=campaign.territories.reduce((sum,area)=>sum+Number(area.supportByCandidate[player?.id]??0)*area.weight,0)/denominator;
  const groups=campaign.territories.map(area=>({id:area.id,name:area.name,weight:area.weight,localTrend:area.localTrend??0,consensus:round(area.supportByCandidate[player?.id]??0),leaders:Object.entries(area.supportByCandidate).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([candidateId,value])=>({candidateId,value:round(value)}))}));
  return {consensus:round(consensus),territories:groups,daysRemaining:Math.max(0,campaign.totalDays-campaign.day),candidateStatus:player?.status,nationalContext:campaign.nationalContext,source:SOURCE};
}
