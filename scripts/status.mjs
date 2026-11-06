import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig, runtime, jsonRequest } from '../src/runtime.mjs';
import { SwitchClient } from '../src/switch-client.mjs';
import { loadCourtConfig } from '../src/court-runtime.mjs';
const config = await loadConfig();
await jsonRequest(config.bridgeUrl, '/health');
const messages = await new SwitchClient(config,config.actors.clerk).context();
console.log(`Switch ${config.switchVersion} is reachable: ${config.bridgeUrl}`);
console.log(`Room: ${config.room.name} (${config.room.id})`);
console.log(`Clerk read ${messages.length} source messages.`);
for (const [role,actor] of Object.entries(config.actors)) console.log(`${role}: ${actor.name} (${actor.id})`);
try {
  const evidence = JSON.parse(await readFile(resolve(runtime,'last-spike.json'),'utf8'));
  console.log(`Last real spike: ${evidence.runId} at ${evidence.completedAt}`);
  console.log(`Mattermost messages verified: ${evidence.mattermostPosts.length}; human approvals: ${evidence.humanApprovals}`);
} catch (error) { if (error.code !== 'ENOENT') throw error; console.log('No completed spike evidence yet.'); }
try {
  const pid=Number(await readFile(resolve(runtime,'listener.pid'),'utf8'));
  process.kill(pid,0); console.log(`Worker PID ${pid} is active.`);
} catch { console.log('Worker listener is not running.'); }
const court=await loadCourtConfig();
if(court) {
  try {
    const {data}=await jsonRequest(court.webUrl,`/api/cases/${court.caseId}`);
    console.log(`Court ${data.id}: ${data.stage}; ${data.currentApprovals.length}/2 current human approvals.`);
    if(data.negotiation?.enabled)console.log(`Automatic negotiation: ${data.negotiation.status}; ${data.negotiation.proposalCount}/${data.negotiation.maxProposals} lead proposals in run ${data.negotiation.run}.`);
    console.log(`Read-only case page: ${court.webUrl}/`);
  } catch {console.log(`Court configured; case HTTP server is not reachable at ${court.webUrl}.`);}
}
