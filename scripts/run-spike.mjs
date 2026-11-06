import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig, runtime, readSettings, jsonRequest, waitUntil } from '../src/runtime.mjs';
import { SwitchClient } from '../src/switch-client.mjs';
import { respond } from '../src/advocate.mjs';

const config = await loadConfig();
if (!config.room) throw new Error('Room is not configured; finish npm run setup.');
try {
  const listenerPid=Number(await readFile(resolve(runtime,'listener.lock'),'utf8'));
  process.kill(listenerPid,0);
  throw new Error('Stop the background listener before running a scripted spike; otherwise both runners could answer a prompt.');
} catch (error) {
  if (!['ENOENT','ESRCH'].includes(error.code)) throw error;
}
const clerk = new SwitchClient(config, config.actors.clerk);
const runId = `spike-${randomUUID()}`;
console.log(`Starting ${runId}. Both advocate responses must come from real Codex runs.`);
await clerk.context();
const openingId = await clerk.post(`[CVC ${runId}] Integration spike: synthetic SIGNAL promo, two advocates and a deterministic clerk. No human adoption, amendment, or approval is being simulated.`);
const leadRequestId = await clerk.post(`@${config.actors.lead.name} [CVC_TURN ${runId} lead] State your owner's portrait requirement and a useful possible alternative. You must ask the owner before replacing that requirement. Read this request through Switch; do not grant human approval.`);
const lead = await respond(config, 'lead', leadRequestId, runId);
const creatorRequestId = await clerk.post(`@${config.actors.creator.name} [CVC_TURN ${runId} creator] Read the lead's actual proposal, source message ${lead.replyId}, and explain the portrait boundary and an object-based alternative. Both humans still need to decide.`);
const creator = await respond(config, 'creator', creatorRequestId, runId, { mustSee: [lead.replyId] });
if (!lead.response.needs_human_decision || !creator.response.needs_human_decision) throw new Error('An advocate did not preserve the human-decision boundary.');
const summaryId = await clerk.post(`[CVC_COMPLETE ${runId}] Both advocate replies are recorded in this Switch room. The creator read the lead's source message ${lead.replyId}. An object-based treatment is a proposal awaiting the humans; no approvals or final storyboard were created. Lead reply: ${lead.replyId}. Creator reply: ${creator.replyId}.`);
const final = await clerk.context();
const required = [openingId, leadRequestId, lead.replyId, creatorRequestId, creator.replyId, summaryId];
for (const id of required) if (!final.some(message => message.id === id)) throw new Error(`Clerk cannot see source message ${id}.`);
const senders = [final.find(message => message.id === openingId).sender, lead.sourceSender, creator.sourceSender];
if (new Set(senders).size !== 3) throw new Error('Clerk and advocates did not have three distinct source identities.');

const env = await readSettings();
const mmBase = config.mattermostUrl;
const { response: mmLogin } = await jsonRequest(mmBase, '/api/v4/users/login', { method: 'POST', body: { login_id: env.MATTERMOST_ADMIN_USER, password: env.MATTERMOST_ADMIN_PASSWORD }, secrets: [env.MATTERMOST_ADMIN_PASSWORD] });
const mmToken = mmLogin.headers.get('token');
if (!mmToken) throw new Error('Cannot verify the Mattermost bridge without an authenticated session.');
if (!config.room.external_channel_id) throw new Error('Room has no bridged Mattermost channel ID.');
const posts = await waitUntil(async () => {
  const { data } = await jsonRequest(mmBase, `/api/v4/channels/${config.room.external_channel_id}/posts?per_page=100`, { token: mmToken });
  const values = Object.values(data.posts ?? {}).filter(post => post.message.includes(runId));
  if (!values.some(post => post.message.includes('CVC_COMPLETE'))) throw new Error('Waiting for the clerk summary to reach Mattermost.');
  if (values.filter(post => post.message.includes('CVC_REPLY')).length !== 2) throw new Error('Both advocate messages have not reached Mattermost.');
  return values.map(({id,user_id,message,create_at}) => ({id,user_id,message,create_at}));
}, 'Mattermost relay verification', 30000);

const evidence = { runId, completedAt: new Date().toISOString(), mode: 'real-codex-cli', switchVersion: config.switchVersion,
  room: config.room, actors: Object.fromEntries(Object.entries(config.actors).map(([role,{id,name}]) => [role,{id,name}])),
  sourceSenderIds: senders, lead, creator,
  switchMessages: final.filter(message => required.includes(message.id)), mattermostPosts: posts,
  humanApprovals: 0, checks: { distinctSourceIdentities: true, sourceMessagesReadBack: true, creatorSawLead: true, mattermostRelayedBothReplies: true, noSimulatedHumanApproval: true } };
await mkdir(resolve(runtime, 'evidence'), { recursive: true });
await writeFile(resolve(runtime, 'evidence', `${runId}.json`), JSON.stringify(evidence,null,2)+'\n', {mode:0o600});
await writeFile(resolve(runtime, 'last-spike.json'), JSON.stringify(evidence,null,2)+'\n', {mode:0o600});
console.log('PASS: three distinct Switch identities, two real Codex replies, clerk read-back, and both messages relayed to Mattermost.');
console.log(`Evidence: .runtime/evidence/${runId}.json`);
