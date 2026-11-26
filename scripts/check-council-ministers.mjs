// Who sits in the Council of Ministers of an activity scene, and for whom. Before the fix the guests of the Council took a group drawn from the list of the majority (AFFILIATION 'pool'): a «Ministro
// dell’Economia» could appear for a party that does not hold that ministry, and a technician as a party man. Checked against the Government of the game (parliament.government.ministers) on many seeds:
//   - a guest who is a minister shows exactly the group of the minister who holds that portfolio, or «Tecnico indipendente»; the record of the scene carries portfolio, group and technician;
//   - a guest whose portfolio has no minister on record, or who is not a minister (undersecretary, head of a department), shows no group;
//   - the lower third of the stage (stage-art.js) shows the role and that same group, nothing else;
//   - in a committee no group is given to people the game does not follow;
//   - the gender of the name and of the avatar follows the grammar of the role («Ministra» is a woman).
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const A = await import(new URL(`../src/core/activity-scenes.js?v=${build}`, import.meta.url).href);
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
const { store } = await startCareer({ seed: 'consiglio-ministri', level: 'deputato', fast: true });
const s = store.getState();
const groups = Object.values(s.parliament.chambers ?? {}).flatMap(chamber => chamber.groups ?? []);
const cabinet = (s.parliament.government.ministers ?? []).filter(item => !item.endedAt).map(item => ({ portfolio: item.portfolio, groupId: item.groupId ?? null, groupName: item.groupId ? (groups.find(group => group.groupId === item.groupId)?.officialName ?? item.groupName) : null, technical: !item.groupId }));
check(cabinet.length >= 10, `Il governo del gioco ha i suoi ministri (${cabinet.length}).`);
let ministers = 0, others = 0, technicians = 0;
for (let n = 0; n < 160; n++) {
  const scene = A.createActivityScene({ id: `prova-${n}`, seed: `consiglio|${n}`, sceneKey: 'consiglio', activityId: 'consiglio-ministri', player: { name: 'Prova' }, playerAvatar: null, cabinet, pool: ['Gruppo inventato'] });
  for (const guest of scene.cast.filter(item => item.role === 'ospite')) {
    const minister = A.ministerForRole(guest.roleLabel, cabinet);
    if (minister) {
      ministers++;
      const expected = minister.groupId ? minister.groupName : 'Tecnico indipendente';
      if (!minister.groupId) technicians++;
      check(guest.partyLabel === expected, `${guest.roleLabel}: mostra «${guest.partyLabel}», il ministro del gioco è di «${expected}».`);
      check(guest.member?.portfolio === minister.portfolio && guest.member.technical === !minister.groupId && (guest.member.groupId ?? null) === (minister.groupId ?? null), `${guest.roleLabel}: la scheda del partecipante porta dicastero, gruppo e condizione di tecnico.`);
    } else {
      others++;
      check(guest.partyLabel === '', `${guest.roleLabel}: non è un ministro del gioco, non deve mostrare un gruppo («${guest.partyLabel}»).`);
      check(guest.partyLabel !== 'Gruppo inventato', 'Nessun gruppo preso a caso dall’elenco della maggioranza.');
    }
    if (/^Ministra\b/.test(guest.roleLabel)) check(guest.gender === 'F' || guest.gender === 'donna' || /f/i.test(String(guest.gender)), `${guest.roleLabel}: è una donna (${guest.gender}).`);
    if (/^Ministro\b/.test(guest.roleLabel)) check(!/^(F|donna)$/i.test(String(guest.gender)), `${guest.roleLabel}: è un uomo (${guest.gender}).`);
  }
}
check(ministers > 50 && others > 10, `Le prove coprono ministri e altri partecipanti (${ministers} ministri, ${others} altri, ${technicians} tecnici).`);
// the lower third
const { strapLines } = await import(new URL(`../src/ui/stage-art.js?v=${build}`, import.meta.url).href);
{
  let straps = 0;
  for (let n = 0; n < 40; n++) {
    const scene = A.createActivityScene({ id: `prova-lt-${n}`, seed: `consiglio|lt|${n}`, sceneKey: 'consiglio', activityId: 'consiglio-ministri', player: { name: 'Prova' }, playerAvatar: null, cabinet });
    for (const guest of scene.cast.filter(item => item.role === 'ospite')) {
      const lines = strapLines(guest, scene.bodyLabel);
      straps++;
      check(lines.role === guest.roleLabel, `Il sottopancia mostra il ruolo di ${guest.roleLabel}.`);
      check(guest.partyLabel ? lines.party === guest.partyLabel : lines.party === (scene.bodyLabel ?? ''), `Il sottopancia di ${guest.roleLabel} mostra il gruppo effettivo o l’istituzione, mai un altro gruppo («${lines.party}»).`);
    }
  }
  check(straps >= 80, 'Sottopancia verificati.');
}
// the committee
for (let n = 0; n < 60; n++) {
  const scene = A.createActivityScene({ id: `comm-${n}`, seed: `commissione|${n}`, sceneKey: 'commissione', activityId: 'commissione', player: { name: 'Prova' }, playerAvatar: null, pool: groups.map(group => group.officialName) });
  for (const guest of scene.cast.filter(item => item.role === 'ospite')) check(guest.partyLabel === '', `Commissione: ${guest.roleLabel} non riceve un gruppo a caso («${guest.partyLabel}»).`);
}
if (problems.length) { console.error(`Consiglio dei ministri — problemi:\n- ${[...new Set(problems)].slice(0, 20).join('\n- ')}`); process.exit(1); }
console.log(`Consiglio dei ministri verificato su 160 scene: ${ministers} ministri con il gruppo del ministro che regge quel dicastero (${technicians} tecnici indipendenti), ${others} partecipanti non ministri senza gruppo, scheda del partecipante con dicastero/gruppo/tecnico, sottopancia coerente, genere coerente con il ruolo; in commissione nessun gruppo assegnato a caso.`);
