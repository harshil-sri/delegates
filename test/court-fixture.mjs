import { CourtEngine,objectBrief,sampleBoard } from '../src/court-engine.mjs';
import { loadCatalog } from '../src/storyboard.mjs';
import { root } from '../src/runtime.mjs';

// Deliberately synthetic identities. These fixtures never contact Switch,
// impersonate a real account, or create decisions in the live demo case.
export const principals={
  humans:{lead:{platform:'mattermost',platformUserId:'test-native-human-1',username:'fixture-lead',sender:'opaque-human-A'},creator:{platform:'mattermost',platformUserId:'test-native-human-2',username:'fixture-creator',sender:'opaque-human-B'}},
  agents:{lead:{id:'test-agent-1',name:'fixture-advocate-1',sender:'opaque-agent-A'},creator:{id:'test-agent-2',name:'fixture-advocate-2',sender:'opaque-agent-B'}},clerk:{id:'test-clerk',name:'cvc-clerk',sender:'opaque-clerk'}
};
export const catalog=await loadCatalog(root);
export function fixture(path=':memory:') {
  let time=1_800_000_000_000,serial=0;
  const engine=new CourtEngine(path,{now:()=>time});
  engine.createCase({id:'C01',roomId:'test-room',principals,catalog});
  const source=(sender,body,extra={})=>({id:`test-source-${++serial}`,roomId:'test-room',sender,body:body.startsWith('@')?body:`@cvc-clerk ${body}`,timestamp:++time,...extra});
  const send=(sender,body,extra)=>engine.handleMessage(source(sender,body,extra));
  const human=(role,body,extra)=>send(principals.humans[role].sender,body,extra);
  const agent=(role,body,extra)=>send(principals.agents[role].sender,body,extra);
  const snapshot=()=>engine.snapshot('C01');
  const adopt=()=>{for(const role of ['lead','creator']) human(role,snapshot().commands.adopt[role]);};
  const amend=()=>human('lead',`AMEND C01 ${snapshot().briefs.lead.at(-1).ref} ${JSON.stringify(objectBrief)}`);
  const propose=(board=sampleBoard())=>human('lead',`PROPOSE C01 ${JSON.stringify(board)}`);
  const ready=()=>{adopt();amend();propose();};
  return {engine,source,send,human,agent,snapshot,adopt,amend,propose,ready,now:()=>time,tick:()=>++time};
}
