import { randomBytes } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig,readSettings,runtime,root,jsonRequest,waitUntil } from '../src/runtime.mjs';
import { CourtEngine } from '../src/court-engine.mjs';
import { loadCatalog } from '../src/storyboard.mjs';
import { courtConfigPath,courtDatabasePath,loadCourtConfig,mattermostAdmin,verifyHumanAccounts,flushCourtOutbox,switchClock } from '../src/court-runtime.mjs';
import { readSwitchIdentityBindings } from '../src/switch-identities.mjs';
import { SwitchClient } from '../src/switch-client.mjs';

try {
  const pid=Number(await readFile(resolve(runtime,'listener.lock'),'utf8'));
  process.kill(pid,0);
  throw new Error('Stop the listener with scripts/stop-workers.ps1 before setting up the engine, then restart it.');
} catch(error) { if (!['ENOENT','ESRCH'].includes(error.code)) throw error; }
const config=await loadConfig(),env=await readSettings();
const previous=await loadCourtConfig();
const accountPath=resolve(runtime,'court-users.env');
let userSettings,createdFile=false;
try {userSettings=await readFile(accountPath,'utf8');}
catch(error) {
  if (error.code!=='ENOENT') throw error;
  userSettings=`MATTERMOST_CREATOR_USER=court-creator\nMATTERMOST_CREATOR_PASSWORD=${randomBytes(24).toString('hex')}\n`;
  await writeFile(accountPath,userSettings,{mode:0o600,flag:'wx'});createdFile=true;
}
const users=Object.fromEntries(userSettings.trim().split(/\r?\n/).map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];}));
if (!/^[a-z][a-z0-9_-]{2,63}$/.test(users.MATTERMOST_CREATOR_USER) || !users.MATTERMOST_CREATOR_PASSWORD) throw new Error('Invalid private creator account configuration.');
const mm=await mattermostAdmin(config);
const findUser=async name=>{
  try {return await mm(`/users/username/${encodeURIComponent(name)}`);}
  catch(error) {if(error.message.includes('HTTP 404')) return null;throw error;}
};
const lead=await findUser(env.MATTERMOST_USER);
if (!lead || lead.is_bot || lead.delete_at) throw new Error('The existing court-owner must be an active native human account.');
let creator=await findUser(users.MATTERMOST_CREATOR_USER);
if (creator && createdFile) throw new Error('The creator username already exists without this project’s saved credentials. No account or password was overwritten.');
if (!creator) {
  creator=await mm('/users',{method:'POST',body:{username:users.MATTERMOST_CREATOR_USER,email:`${users.MATTERMOST_CREATOR_USER}@switch.local`,password:users.MATTERMOST_CREATOR_PASSWORD},secrets:[users.MATTERMOST_CREATOR_PASSWORD]});
  console.log('Created a second local human account; no decisions were sent on its behalf.');
}
if (creator.is_bot || creator.delete_at || lead.id===creator.id) throw new Error('Two different active human accounts are required.');
const channel=await mm(`/channels/${encodeURIComponent(config.room.external_channel_id)}`);
if (!channel.team_id || channel.type!=='P') throw new Error('Expected the existing private team channel.');
for (const user of [lead,creator]) {
  try {await mm(`/teams/${channel.team_id}/members/${user.id}`);}
  catch(error) {if(!error.message.includes('HTTP 404')) throw error;await mm(`/teams/${channel.team_id}/members`,{method:'POST',body:{team_id:channel.team_id,user_id:user.id}});}
}
const {response}=await jsonRequest(config.bridgeUrl,'/gateway/auth/login',{method:'POST',body:{email:env.GATEWAY_ADMIN_EMAIL,password:env.GATEWAY_ADMIN_PASSWORD},secrets:[env.GATEWAY_ADMIN_PASSWORD]});
const cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
if (!cookie.includes('switch_auth=')) throw new Error('No authenticated Gateway session.');
const gateway=async(path,options={})=>(await jsonRequest(config.bridgeUrl,`/gateway${path}`,{...options,cookie})).data;
const room=await gateway(`/rooms/${config.room.id}`);
if (room.external_channel_id!==channel.id || room.bridge_type!=='mattermost') throw new Error('The native channel does not match the configured Switch room.');
await gateway(`/rooms/${config.room.id}/users`,{method:'POST',body:{user_names:[lead.username,creator.username]}});
await gateway(`/rooms/${config.room.id}`,{method:'PATCH',body:{description:'Creative Veto Court: human-owned mandates, amendments, immutable storyboards and two-owner approval.',instructions:'Synthetic SIGNAL promo case. Follow the persisted current briefs. Only exact commands from the bound human owners can adopt or amend their own terms or approve an artifact. Agent and clerk statements are not human consent. Respond only to explicit named requests.'}});
const bindings=await waitUntil(async()=>{
  const result=await readSwitchIdentityBindings(config,env,room.bridge_id,[lead.id,creator.id]);
  if (result.humans.length!==2 || result.agents.length!==3) throw new Error('Waiting for both humans and all three agent mappings in this room.');
  return result;
},'verified room identities',30000);
const principals={humans:{},agents:{},clerk:null};
for (const [role,user] of [['lead',lead],['creator',creator]]) {
  const binding=bindings.humans.find(value=>value.platformUserId===user.id);
  if (binding?.type!=='user') throw new Error('A native owner did not resolve to a Switch human client.');
  principals.humans[role]={platform:'mattermost',platformUserId:user.id,username:user.username,sender:binding.sender};
}
for (const role of ['lead','creator','clerk']) {
  const actor=config.actors[role],binding=bindings.agents.find(value=>value.id===actor.id);
  if (binding?.type!=='agent' || binding.name!==actor.name) throw new Error('An advocate or clerk did not resolve to its actual Switch agent client.');
  const verified={id:actor.id,name:actor.name,sender:binding.sender};
  if (role==='clerk') principals.clerk=verified;else principals.agents[role]=verified;
}
await verifyHumanAccounts(mm,config,principals);
const court={schema:1,caseId:'C01',roomId:config.room.id,bridgeId:room.bridge_id,webPort:18802,webUrl:'http://localhost:18802',principals};
if (previous && JSON.stringify(previous)!==JSON.stringify(court)) throw new Error('Frozen court bindings conflict with the current room. Existing ownership was not replaced.');
const engine=new CourtEngine(courtDatabasePath,{clerkName:config.actors.clerk.name,webUrl:court.webUrl,now:await switchClock(config)});
try {
  const state=engine.createCase({id:court.caseId,roomId:court.roomId,principals,catalog:await loadCatalog(root)});
  await writeFile(courtConfigPath,JSON.stringify(court,null,2)+'\n',{mode:0o600});
  const clerk=new SwitchClient(config,config.actors.clerk);
  await flushCourtOutbox(engine,clerk,await clerk.context());
  console.log(`Case ${state.id}: ${state.stage}; ${state.currentApprovals.length}/2 current human approvals.`);
  console.log(`Lead brief owner: ${lead.username}. Creator brief owner: ${creator.username}. Five distinct opaque source identities verified.`);
  console.log(`Read-only case page: ${court.webUrl}/ (start workers to serve it).`);
  console.log('Creator login credentials are saved only in ignored .runtime/court-users.env.');
} finally {engine.close();}
