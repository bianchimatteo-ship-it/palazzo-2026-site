import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCampaign, performCampaignActivity, advanceCampaign, decideCampaignEvent, negotiateCampaignAlliance, breakCampaignAlliance } from '../src/core/campaign-engine.js';
import { runFirstRound, runFinalElection } from '../src/core/election-engine.js';
import { makeDemoState } from '../src/data/simulation/demo.js';
import { renderCampaignPage } from '../src/ui/campaign-mode.js';

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
  runoff.territories[0].supportByCandidate={ [own.id]:34,[rivals[0].id]:31,[rivals[1].id]:21,[rivals[2].id]:14 };
  const first=runFirstRound(runoff);
  assert.equal(first.requiresRunoff,true);
  runoff.firstRoundResult=first; runoff.runoffCandidateIds=first.runoffCandidateIds; runoff.stage='ballottaggio';
  for(const candidate of runoff.candidates) if(!first.runoffCandidateIds.includes(candidate.id)) candidate.status='eliminated';
  const final=runFinalElection(runoff,first);
  assert.equal(final.stage,'risultato-finale');
  assert.equal(final.runoffResults.length,2);
  assert.equal(final.groups.length,4,'Il risultato municipale mantiene anche le liste escluse dal ballottaggio per i seggi consiliari.');
  assert.equal(final.groups.reduce((sum,item)=>sum+item.seats,0),16);
}

// Esegue il flusso con salvataggio e ricaricamento a campagna aperta.
let module=await import(`../src/core/store.js?campaign-check=${Date.now()}`);
let store=module.store;
const draft={firstName:'Alessia',lastName:'Test',birthDate:'1988-04-20',gender:'donna',region:'Lombardia',municipality:'Milano',previousProfession:'Ricercatrice',initialLevel:'nazionale',partyMode:'existing',partyId:party.id,currentDate:base.clock.currentDate};
store.createCareer(draft,[party]);
assert.ok(renderCampaignPage(store.getState(),references,()=>null).includes('data-campaign-setup="electionType"'));
store.startCampaign({electionType:'politiche',role:'deputato',objective:'build'},references);
let campaign=store.getState().campaign;
const activeHtml=renderCampaignPage(store.getState(),references,()=>null);
assert.ok(activeHtml.includes('data-campaign-activity="rally"'));
assert.ok(activeHtml.includes('Candidatura interna simulata'));
assert.ok(activeHtml.includes('Sondaggi non collegato')||activeHtml.includes('Aggancio sondaggi: non collegato'));
assert.equal(campaign.pollingHook.connected,false);
assert.equal(campaign.partyId,party.id);
assert.equal(campaign.nomination.status,'pending');
store.performCampaignActivity('party_meeting');
store.performCampaignActivity('list_building');
store.performCampaignActivity('fundraising');
store.save();
module=await import(`../src/core/store.js?campaign-reload=${Date.now()}`);
store=module.store;
assert.equal(store.getState().campaign.status,'active','Campagna attiva ripristinata dal salvataggio.');
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
assert.ok(finalState.dataset.statistics.filter(item=>item.subjectId===finalState.career.playerId).every(item=>item.source==='simulation'));
assert.ok(renderCampaignPage(finalState,references,()=>null).includes('SCRUTINIO CONCLUSO'));
store.save();
const finalModule=await import(`../src/core/store.js?campaign-final-reload=${Date.now()}`);
assert.equal(finalModule.store.getState().campaign.status,'finished','Il risultato deve sopravvivere al ricaricamento.');
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
assert.equal(stored.version,4);
console.log('Campagna verificata: 4 modelli elettorali, ballottaggio, candidatura interna, attività, eventi, alleanze, risultato, impatto carriera e salvataggio/ricaricamento.');
