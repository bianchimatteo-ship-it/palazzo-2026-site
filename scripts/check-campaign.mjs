import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCampaign, performCampaignActivity, advanceCampaign, decideCampaignEvent, negotiateCampaignAlliance, breakCampaignAlliance } from '../src/core/campaign-engine.js';
import { runFirstRound, runFinalElection } from '../src/core/election-engine.js';
import { makeDemoState } from '../src/data/simulation/demo.js';
import { renderCampaignPage } from '../src/ui/campaign-mode.js';
import { DEBATE_TOPICS } from '../src/data/simulation/campaign-rules.js';

const localStore=new Map();
globalThis.localStorage={getItem:key=>localStore.get(key)??null,setItem:(key,value)=>localStore.set(key,String(value)),removeItem:key=>localStore.delete(key)};
const realParties=JSON.parse(await readFile(new URL('../src/data/real/parties.json',import.meta.url),'utf8'));
const party=realParties.find(item=>item.id==='party-futuro-nazionale')??realParties.find(item=>item.verified===true);
assert.ok(party?.verified&&party.source==='real','Test richiede un riferimento di partito reale verificato.');
const references=[...realParties];
const base=makeDemoState();

// Esercita i quattro modelli senza trasformare i risultati di gioco in dati reali.
for(const [type,role] of [['comunale','sindaco'],['regionale','presidente'],['politiche','deputato'],['europee','eurodeputato']]) {
  const player={...base.dataset.politicians[0],partyId:party.id,region:'Lombardia',municipality:'Milano'};
  const career={...base.career,id:`test-${type}`,partyId:party.id,initialLevel:'nazionale'};
  let campaign=createCampaign({career,player,statistics:base.dataset.statistics,offices:base.dataset.offices,territories:base.dataset.territories,partyCatalog:references,currentDate:'2026-09-23',config:{electionType:type,role,objective:'build',municipalityBand:'oltre-15000'}});
  assert.equal(campaign.source,'simulation');
  assert.ok(campaign.territories.length===(type==='comunale'?1:type==='regionale'?4:type==='europee'?5:20));
  assert.ok(campaign.candidates.every(item=>item.source==='simulation'));
  assert.ok(campaign.candidates.filter(item=>!item.isPlayer).every(item=>item.displayName.startsWith('Candidatura simulata')));
  campaign.nomination.status='approved';
  campaign.day=campaign.totalDays-1;
  campaign=advanceCampaign(campaign,1);
  if(campaign.status==='active') campaign=advanceCampaign(campaign,14);
  assert.equal(campaign.status,'finished',`${type}: non è arrivato al risultato`);
  assert.equal(campaign.result.source,'simulation');
  assert.ok(campaign.result.groups.every(item=>item.source==='simulation'));
  assert.ok(campaign.result.groups.every(item=>Number.isFinite(item.percent)&&Number.isFinite(item.seats)));
  if(type==='regionale') assert.equal(campaign.result.groups.reduce((sum,item)=>sum+item.seats,0),31);
  if(type==='politiche') assert.equal(campaign.result.groups.reduce((sum,item)=>sum+item.seats,0),400);
  if(type==='europee') {
    assert.equal(campaign.result.groups.reduce((sum,item)=>sum+item.seats,0),76);
    assert.ok(campaign.result.groups.filter(item=>item.percent<4).every(item=>item.seats===0),'Le liste sotto la soglia europea verificata non ottengono seggi nello scenario.');
    assert.equal(campaign.ruleFacts.threshold.percent,4);
    assert.equal(campaign.ruleFacts.threshold.source,'real');
  }
}

// Verifica trattative, fusione delle liste nello scenario e costo della rottura.
{
  let coalition=null;
  for(let index=0;index<120&&!coalition;index++) {
    let scenario=createCampaign({career:{...base.career,id:`alliance-seed-${index}`,partyId:party.id},player:{...base.dataset.politicians[0],partyId:party.id},statistics:base.dataset.statistics,partyCatalog:references,currentDate:'2026-09-23',config:{electionType:'regionale',role:'presidente'}});
    const target=scenario.candidates.find(item=>!item.isPlayer);
    target.relationship=1;
    scenario=negotiateCampaignAlliance(scenario,target.id);
    if(scenario.alliances.length) coalition={scenario,alliance:scenario.alliances[0],target};
  }
  assert.ok(coalition,'Un accordo simulato può essere negoziato con probabilità contestuale.');
  const broken=breakCampaignAlliance(coalition.scenario,coalition.alliance.id);
  assert.equal(broken.alliances[0].status,'broken');
  assert.equal(broken.candidates.find(item=>item.id===coalition.target.id).status,'active');
  assert.ok(broken.candidateStats.reputation<coalition.scenario.candidateStats.reputation);
}

// La nomina interna può essere persa anche da una figura con esperienza.
{
  const experienced={...base.dataset.politicians[0],partyId:party.id,roleId:'ufficio-deputato'};
  const campaign=createCampaign({career:{...base.career,id:'test-nomination-loss',partyId:party.id},player:experienced,statistics:[...base.dataset.statistics,{subjectId:experienced.id,metric:'influence',value:90}],offices:[{id:'ufficio-deputato',title:'Deputato',politicianId:experienced.id}],partyCatalog:references,currentDate:'2026-09-23',config:{electionType:'politiche',role:'deputato'}});
  campaign.internalCandidates.forEach(item=>item.internalSupport=10);
  const excluded=advanceCampaign(campaign,campaign.nomination.deadlineDay);
  assert.equal(excluded.nomination.status,'excluded');
  assert.equal(excluded.candidates[0].status,'eliminated');
  assert.equal(excluded.nomination.incumbent,true);
}

// In Senato lo scenario assegna 200 seggi, distinti dalla Camera.
{
  const player={...base.dataset.politicians[0],partyId:party.id};
  let senate=createCampaign({career:{...base.career,id:'test-senato',partyId:party.id},player,statistics:base.dataset.statistics,partyCatalog:references,currentDate:'2026-09-23',config:{electionType:'politiche',role:'senatore'}});
  senate.nomination.status='approved';senate.day=senate.totalDays-1;senate=advanceCampaign(senate,1);
  assert.equal(senate.result.groups.reduce((sum,item)=>sum+item.seats,0),200);
}

// Verifica la regola simulata di ballottaggio nei comuni sopra 15.000 abitanti.
{
  const player={...base.dataset.politicians[0],partyId:null,region:'Toscana',municipality:'Valleverde'};
  let runoff=createCampaign({career:{...base.career,id:'test-runoff',partyId:null},player,statistics:base.dataset.statistics,partyCatalog:[],currentDate:'2026-09-23',config:{electionType:'comunale',role:'sindaco',municipalityBand:'oltre-15000'}});
  const [own,...rivals]=runoff.candidates;
  // In a comune above 15,000 inhabitants four rival candidacies run (RIVALS_BY_TYPE).
  assert.equal(rivals.length,4,'Nei comuni sopra i 15.000 abitanti corrono più candidature.');
  runoff.territories[0].supportByCandidate={ [own.id]:34,[rivals[0].id]:31,[rivals[1].id]:21,[rivals[2].id]:9,[rivals[3].id]:5 };
  const first=runFirstRound(runoff);
  assert.equal(first.requiresRunoff,true);
  runoff.firstRoundResult=first; runoff.runoffCandidateIds=first.runoffCandidateIds; runoff.stage='ballottaggio';
  runoff.territories[0].supportByCandidate={ [own.id]:12,[rivals[0].id]:28,[rivals[1].id]:52,[rivals[2].id]:5,[rivals[3].id]:3 };
  const final=runFinalElection(runoff,first);
  assert.equal(final.stage,'risultato-finale');
  assert.equal(final.runoffResults.length,2);
  assert.deepEqual(final.groups.map(item=>item.candidateId).sort(),first.runoffCandidateIds.slice().sort(),'Risultato e classifica finale contengono solo i finalisti.');
  assert.ok(final.territories.every(area=>area.groups.length===2&&first.runoffCandidateIds.includes(area.winnerId)),'Nessun non-finalista può vincere un territorio al ballottaggio.');
  assert.equal(final.personal.position,2,'La posizione personale è calcolata sul risultato finale.');
  assert.equal(final.groups.reduce((sum,item)=>sum+item.seats,0),16);
}

// Sondaggi settimanali e risultato condividono il consenso della campagna; gli esiti restano rumorosi ma plausibili.
{
  const simulate=seed=>{
    let campaign=createCampaign({career:{...base.career,id:`poll-run-${seed}`,partyId:null},player:{...base.dataset.politicians[0],partyId:null,region:'Toscana',municipality:'Valleverde'},statistics:base.dataset.statistics,partyCatalog:[],currentDate:'2026-09-23',config:{electionType:'comunale',role:'sindaco',municipalityBand:'fino-15000'}});
    campaign.nomination.status='approved';
    for(let week=0;week<20&&campaign.status==='active';week++) campaign=advanceCampaign(campaign,7);
    return campaign;
  };
  const simulations=Array.from({length:30},(_,seed)=>simulate(seed));
  let coherent=0,surprises=0,maxDeviation=0;
  for(const [seed,campaign] of simulations.entries()) {
    assert.equal(campaign.status,'finished',`Sondaggio: simulazione ${seed} completata.`);
    const poll=campaign.polls.at(-1);
    assert.equal(poll.source,'simulation');
    assert.ok(poll.sample>=700&&poll.sample<=1600&&poll.margin>2&&poll.margin<4,`Campione e margine plausibili (${seed}).`);
    const pollRows=poll.results;
    const finalRows=campaign.result.groups;
    assert.deepEqual(pollRows.map(row=>row.candidateId).sort(),finalRows.map(row=>row.candidateId).sort(),`Il sondaggio finale usa solo le candidature ammesse al voto (${seed}).`);
    const pollLeader=pollRows.toSorted((a,b)=>b.share-a.share)[0];
    const winnerPoll=pollRows.find(row=>row.candidateId===campaign.result.winnerGroupId);
    if(pollLeader.candidateId===campaign.result.winnerGroupId) coherent++;
    if(pollLeader.candidateId!==campaign.result.winnerGroupId&&pollLeader.share-winnerPoll.share<=poll.margin*1.5) surprises++;
    for(const row of finalRows) {
      const estimate=pollRows.find(item=>item.candidateId===row.candidateId)?.share;
      const deviation=Math.abs(row.percent-estimate);
      maxDeviation=Math.max(maxDeviation,deviation);
      assert.ok(deviation<=Math.min(8,poll.margin*3),`Esito entro una sorpresa plausibile rispetto al sondaggio (${seed}, ${row.label}: ${deviation.toFixed(2)}).`);
    }
    const repeated=simulate(seed);
    assert.deepEqual(repeated.polls,campaign.polls,`Sondaggi deterministici a seed uguale (${seed}).`);
    assert.deepEqual(repeated.result,campaign.result,`Risultato deterministico a seed uguale (${seed}).`);
  }
  assert.ok(coherent>0,'Il risultato conferma anche corse coerenti col sondaggio.');
  assert.ok(surprises>0,'Esistono sorprese ravvicinate e plausibili.');
  assert.ok(maxDeviation<8,'Non si osservano divergenze estreme tra stima e voto.');
}

// Esegue il flusso con salvataggio e ricaricamento a campagna aperta.
let module=await import(`../src/core/store.js?campaign-check=${Date.now()}`);
let store=module.store;
const draft={firstName:'Alessia',lastName:'Test',birthDate:'1988-04-20',gender:'donna',region:'Lombardia',municipality:'Milano',previousProfession:'Ricercatrice',initialLevel:'regionale',partyMode:'existing',partyId:party.id,currentDate:base.clock.currentDate};
store.createCareer(draft,[party]);
assert.ok(renderCampaignPage(store.getState(),references,()=>null).includes('data-campaign-setup="electionType"'));
// I select della campagna si ridisegnano con la scelta del giocatore (la pagina si ridisegna a ogni cambiamento del
// gioco); una scelta che non è più tra le opzioni torna al valore predefinito.
const selectedIn=(html,attr)=>html.match(new RegExp(`<select ${attr}[^>]*>([\\s\\S]*?)</select>`))?.[1].match(/<option value="([^"]+)" selected/)?.[1]??null;
const setupHtml=renderCampaignPage(store.getState(),references,()=>null,{'setup.electionType':'regionale','setup.role':'consigliere','setup.topicId':DEBATE_TOPICS[3].id,'setup.strategy':'temi'});
assert.equal(selectedIn(setupHtml,'data-campaign-setup="electionType"'),'regionale','Il tipo di elezione scelto resta al ridisegno.');
assert.equal(selectedIn(setupHtml,'data-campaign-setup="role"'),'consigliere','Il ruolo scelto resta al ridisegno.');
assert.equal(selectedIn(setupHtml,'data-campaign-setup="topicId"'),DEBATE_TOPICS[3].id,'Il tema scelto nell’impostazione resta al ridisegno.');
assert.ok(/value="temi" checked/.test(setupHtml),'La strategia scelta resta al ridisegno.');
assert.equal(selectedIn(renderCampaignPage(store.getState(),references,()=>null,{'setup.electionType':'europee','setup.role':'sindaco'}),'data-campaign-setup="role"'),'eurodeputato','Il ruolo di un’altra elezione torna al primo ruolo.');
assert.throws(()=>store.startCampaign({electionType:'politiche',role:'deputato',objective:'build'},references),/candidature/,'Le candidature seguono il calendario elettorale.');
store.fastForwardToElection('politiche');
store.startCampaign({electionType:'politiche',role:'deputato',objective:'build'},references);
let campaign=store.getState().campaign;
const activeHtml=renderCampaignPage(store.getState(),references,()=>null);
assert.ok(activeHtml.includes('data-campaign-activity="rally"'));
assert.ok(activeHtml.includes('Candidatura interna simulata'));
assert.ok(activeHtml.includes('SONDAGGIO DI CAMPAGNA')&&activeHtml.includes('interviste'),'Il sondaggio simulato con campione è visibile nel gameplay.');
// Il tema delle attività resta quello scelto dal giocatore, non quello della strategia, anche dopo un cambio di strategia.
const strategyTopic=campaign.strategy?.topicId??campaign.nationalContext.salientTopic;
assert.equal(selectedIn(activeHtml,'data-campaign-topic'),strategyTopic,'Senza una scelta il tema delle attività è quello della strategia.');
const chosenTopic=DEBATE_TOPICS.find(topic=>topic.id!==strategyTopic).id;
assert.equal(selectedIn(renderCampaignPage(store.getState(),references,()=>null,{topic:chosenTopic}),'data-campaign-topic'),chosenTopic,'Il tema scelto resta al ridisegno.');
const newStrategy={...store.getState(),campaign:{...campaign,strategy:{...campaign.strategy,id:'temi',topicId:DEBATE_TOPICS.find(topic=>![strategyTopic,chosenTopic].includes(topic.id)).id}}};
const changedHtml=renderCampaignPage(newStrategy,references,()=>null,{topic:chosenTopic});
assert.equal(selectedIn(changedHtml,'data-campaign-topic'),chosenTopic,'Dopo un cambio di strategia il tema delle attività resta quello scelto.');
// Le scelte dei select sono salvate con la partita (state.ui.campaignPicks) e tornano dopo il ricaricamento.
assert.deepEqual(store.getState().ui.campaignPicks,{key:campaign.id,values:{}},'Una nuova campagna parte senza scelte salvate.');
store.setCampaignPicks({key:campaign.id,values:{topic:chosenTopic,ally:'candidatura-inesistente'}});
assert.equal(selectedIn(changedHtml,'data-campaign-strategy-topic'),newStrategy.campaign.strategy.topicId,'Il select della strategia mostra il tema della strategia.');
assert.equal(selectedIn(renderCampaignPage(store.getState(),references,()=>null,{topic:'tema-inesistente'}),'data-campaign-topic'),strategyTopic,'Una scelta non valida torna al tema della strategia.');
assert.equal(campaign.pollingHook,undefined,'Il vecchio aggancio ai sondaggi «non collegato» non esiste più.');
assert.ok(campaign.pollObservatory?.waves?.length>=1&&campaign.pollObservatory.waves[0].label==='Apertura della campagna','Il sondaggio di apertura della corsa è salvato con la campagna.');
assert.equal(campaign.partyId,party.id);
assert.equal(campaign.nomination.status,'pending');
store.performCampaignActivity('party_meeting');
store.performCampaignActivity('list_building');
store.performCampaignActivity('fundraising');
const activeCampaignPolls=store.getState().campaign.polls;
store.save();
module=await import(`../src/core/store.js?campaign-reload=${Date.now()}`);
store=module.store;
assert.equal(store.getState().campaign.status,'active','Campagna attiva ripristinata dal salvataggio.');
assert.deepEqual(store.getState().campaign.polls,activeCampaignPolls,'Sondaggi e relativa sequenza seed sopravvivono al salvataggio/ricaricamento.');
assert.deepEqual(store.getState().ui.campaignPicks,{key:campaign.id,values:{topic:chosenTopic,ally:'candidatura-inesistente'}},'Le scelte dei select tornano con il salvataggio.');
assert.equal(selectedIn(renderCampaignPage(store.getState(),references,()=>null,store.getState().ui.campaignPicks.values),'data-campaign-topic'),chosenTopic,'Dopo il ricaricamento il select mostra il tema scelto.');
assert.ok(store.getState().campaign.day>0);
assert.equal(store.getState().dataset.parties.find(item=>item.id===party.id),undefined,'Il partito reale non va copiato nel database utente/simulazione.');

// Lascia una reazione mediatica/evento decisionale e registra una scelta.
for(let i=0;i<5&&!store.getState().campaign.pendingEvents.length;i++) {
  const current=store.getState().campaign;
  if(current.day+1>=current.totalDays) break;
  try { store.performCampaignActivity('interview',{territoryId:current.territories[0].id}); }
  catch { store.advance(1); }
}
let currentCampaign=store.getState().campaign;
if(currentCampaign.pendingEvents.length) {
  const event=currentCampaign.pendingEvents[0];
  store.decideCampaignEvent(event.id,event.choices[0].id);
  assert.ok(store.getState().campaign.events.some(item=>item.id===event.id));
}
store.advance(Math.max(0,store.getState().campaign.nomination.deadlineDay-store.getState().campaign.day));
currentCampaign=store.getState().campaign;
assert.notEqual(currentCampaign.nomination.status,'pending','La candidatura interna deve essere risolta entro la scadenza.');
if(currentCampaign.nomination.status==='approved'&&currentCampaign.day+3<currentCampaign.totalDays) {
  store.performCampaignActivity('debate_prep',{topicId:'servizi',territoryId:currentCampaign.territories[0].id});
  store.performCampaignActivity('debate',{topicId:'servizi',territoryId:currentCampaign.territories[0].id});
}
if(currentCampaign.day+2<currentCampaign.totalDays) {
  try { store.performCampaignActivity('ally_meeting',{targetCandidateId:currentCampaign.candidates.find(item=>!item.isPlayer)?.id}); } catch {}
}
for(let i=0;i<10&&store.getState().campaign.status==='active';i++) store.advance(7);
let finalState=store.getState();
assert.equal(finalState.campaign.status,'finished','La campagna deve arrivare allo scrutinio.');
assert.ok(Number.isFinite(finalState.campaign.result.playerShare));
assert.ok(Number.isFinite(finalState.campaign.result.playerVotes));
assert.ok(Number.isFinite(finalState.campaign.result.playerSeats));
assert.ok(Array.isArray(finalState.campaign.result.territories));
assert.equal(finalState.campaign.result.source,'simulation');
assert.equal(finalState.career.lastCampaignId,finalState.campaign.id);
assert.ok(finalState.career.partyImpactHistory?.length);
if(finalState.campaign.result.personalMandate) {
  const office=finalState.dataset.offices.find(item=>item.id===finalState.dataset.politicians[0].roleId);
  assert.equal(office.source,'simulation');
  assert.equal(finalState.career.status,'elected');
}
assert.ok(finalState.career.electionHistory?.length);
assert.ok(finalState.career.lastElectionReport.candidates.some(item=>item.source==='user'&&item.personId===finalState.career.playerId),'La candidatura del giocatore conserva il riferimento persistente USER.');
assert.ok(finalState.career.electionHistory.at(-1).candidates.some(item=>item.source==='user'&&item.personId===finalState.career.playerId),'Lo storico completo conserva l’identità della candidatura.');
assert.equal(finalState.career.lastElectionReport.poll.source,'simulation','Il resoconto conserva il sondaggio simulato prima del voto.');
assert.ok(finalState.dataset.statistics.filter(item=>item.subjectId===finalState.career.playerId).every(item=>item.source==='simulation'));
assert.ok(renderCampaignPage(finalState,references,()=>null).includes('SCRUTINIO CONCLUSO'));
store.save();
const finalModule=await import(`../src/core/store.js?campaign-final-reload=${Date.now()}`);
assert.equal(finalModule.store.getState().campaign.status,'finished','Il risultato deve sopravvivere al ricaricamento.');
assert.deepEqual(finalModule.store.getState().campaign.polls,finalState.campaign.polls,'Lo storico dei sondaggi resta disponibile dopo il voto e il ricaricamento.');
assert.equal(finalModule.store.getState().career.lastCampaignId,finalState.campaign.id);
assert.equal(JSON.stringify(party),JSON.stringify(references.find(item=>item.id===party.id)),'I dati ufficiali del partito non vengono alterati.');

// Un’attività mediatica può generare un evento contestuale, poi la scelta ne conserva lo storico.
let eventWasGenerated=false;
for(let index=0;index<60&&!eventWasGenerated;index++) {
  const testPlayer={...base.dataset.politicians[0],partyId:party.id,region:'Lombardia',municipality:'Milano'};
  let scenario=createCampaign({career:{...base.career,id:`event-seed-${index}`},player:testPlayer,statistics:base.dataset.statistics,partyCatalog:references,currentDate:'2026-09-23',config:{electionType:'regionale',role:'presidente'}});
  scenario=performCampaignActivity(scenario,'interview',{territoryId:scenario.territories[0].id});
  if(scenario.pendingEvents.length) {
    const event=scenario.pendingEvents[0];
    scenario=decideCampaignEvent(scenario,event.id,event.choices[0].id);
    assert.equal(scenario.events[0].source,'simulation');
    eventWasGenerated=true;
  }
}
assert.ok(eventWasGenerated,'È stato generato almeno un evento contestuale durante l’esposizione mediatica.');

const stored=JSON.parse(localStore.get('palazzo-2026.career.v1'));
assert.equal(stored.version,10);
console.log('Campagna verificata: 4 modelli elettorali, ballottaggio, candidatura interna, attività, eventi, alleanze, risultato, impatto carriera e salvataggio/ricaricamento.');
