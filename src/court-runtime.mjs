import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runtime, readSettings, jsonRequest } from './runtime.mjs';

export const courtConfigPath = resolve(runtime,'court.json');
export const courtDatabasePath = resolve(runtime,'court.sqlite');
export async function switchClock(config) {
  const started=performance.now();
  const {response}=await jsonRequest(config.bridgeUrl,'/health');
  const serverTime=Date.parse(response.headers.get('date'));
  if (!Number.isFinite(serverTime)) throw new Error('Switch did not supply its server time. Decision ingestion is paused.');
  // Switch messages and target readiness must use one clock domain. Docker's
  // VM can differ materially from the Windows host. Date is second precision;
  // the lower edge avoids rejecting a reply because of rounding. Elapsed time
  // is monotonic, so a host wall-clock adjustment cannot rewrite the reference.
  return () => Math.floor(serverTime+performance.now()-started);
}
export async function loadCourtConfig() {
  try { return JSON.parse(await readFile(courtConfigPath,'utf8')); }
  catch (error) { if (error.code==='ENOENT') return null; throw error; }
}
export async function mattermostAdmin(config) {
  const env=await readSettings();
  const {response}=await jsonRequest(config.mattermostUrl,'/api/v4/users/login',{method:'POST',body:{login_id:env.MATTERMOST_ADMIN_USER,password:env.MATTERMOST_ADMIN_PASSWORD},secrets:[env.MATTERMOST_ADMIN_PASSWORD]});
  const token=response.headers.get('token');
  if (!token) throw new Error('Mattermost did not return an authenticated operator session.');
  return async (path,options={}) => (await jsonRequest(config.mattermostUrl,`/api/v4${path}`,{...options,token})).data;
}
export async function verifyHumanAccounts(mm,config,principals,sender) {
  for (const human of Object.values(principals.humans).filter(actor=>!sender || actor.sender===sender)) {
    const user=await mm(`/users/${encodeURIComponent(human.platformUserId)}`);
    if (user.id!==human.platformUserId || user.is_bot || user.delete_at) throw new Error(`The bound ${human.username} account is no longer an active human account. Decisions paused.`);
    const member=await mm(`/channels/${encodeURIComponent(config.room.external_channel_id)}/members/${encodeURIComponent(human.platformUserId)}`);
    if (member.user_id!==human.platformUserId) throw new Error('The brief owner is no longer a native room member. Decisions paused.');
  }
}

// Never retry a send with an unknown result. Reconcile it against actual Switch
// history first; source-idempotent decisions remain safe across process crashes.
export async function flushCourtOutbox(engine,client,messages) {
  for (const entry of engine.outbox()) {
    const matches=messages.filter(message=>message.body===entry.body);
    if (matches.length) {
      const clerk=engine.load(entry.case_id).principals.clerk;
      const stored=matches.find(message=>message.sender===clerk.sender);
      if (stored) {engine.markSent(entry.event_id,stored.id);continue;}
    }
    if (entry.state!=='pending') continue;
    engine.markSending(entry.event_id);
    try { const id=await client.post(entry.body); engine.markSent(entry.event_id,id); }
    catch (error) { engine.markUncertain(entry.event_id,error.message); console.error(`Court notification ${entry.event_id} has an uncertain send result; it was not retried.`); }
  }
}
