import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, runtime } from '../src/runtime.mjs';
const evidence = JSON.parse(await readFile(resolve(runtime,'last-spike.json'),'utf8'));
if (!Object.values(evidence.checks).every(Boolean)) throw new Error('Only a passed real spike can be exported.');
const safe = {
  runId:evidence.runId, completedAt:evidence.completedAt, mode:evidence.mode,
  switchVersion:evidence.switchVersion, room:{id:evidence.room.id,name:evidence.room.name},
  actors:evidence.actors, sourceSenderIds:evidence.sourceSenderIds, checks:evidence.checks, humanApprovals:0,
  turns:['lead','creator'].map(role=>({role,sourceRequestId:evidence[role].requestId,sourceReplyId:evidence[role].replyId,
    sender:evidence[role].sourceSender,elapsedMs:evidence[role].elapsedMs,response:evidence[role].response,
    contextMessageIds:evidence[role].contextMessageIds})),
  mattermostPosts:evidence.mattermostPosts.map(({id,user_id})=>({id,user_id}))
};
await mkdir(resolve(root,'docs'),{recursive:true});
await writeFile(resolve(root,'docs','spike-result.json'),JSON.stringify(safe,null,2)+'\n');
const lines=[
  '# Verified Switch integration spike', '',
  `Completed (UTC): ${safe.completedAt}`, `Run: ${safe.runId}`, '',
  `Switch core: ${safe.switchVersion}; room: ${safe.room.name} (${safe.room.id}).`, '',
  'Two real Codex CLI turns read their input through Switch and posted under separate agent identities. The deterministic clerk read both replies back. Both replies were also observed through the authenticated Mattermost API.', '',
  '## Observed replies', ''
];
for (const turn of safe.turns) lines.push(`### ${safe.actors[turn.role].name}`, '', turn.response.summary, '',
  `Protected: ${turn.response.protected_boundary}`, `Next: ${turn.response.proposed_next_step}`, '',
  `Request: ${turn.sourceRequestId}`, `Reply: ${turn.sourceReplyId}`, `Provider duration: ${(turn.elapsedMs/1000).toFixed(1)} seconds.`, '');
lines.push('## Scope', '',
  'This proves real agent identity, context delivery, reply posting, clerk observation, and Mattermost relay. It uses one local administrator-owned server and two Codex-backed external/passive agents. The local listener polls for new mentions; Switch Console agent sessions were not configured.', '',
  'Human approvals: **0**. No human action, final storyboard, portrait approval, private-room isolation, or multi-machine ownership is claimed.', '',
  'Run `npm run spike` to produce a new independent run, and `node scripts/export-spike-proof.mjs` to update this report. Detailed provider logs and credentials remain under ignored `.runtime/`.', '');
await writeFile(resolve(root,'docs','spike-result.md'),lines.join('\n'));
console.log('Exported credential-free proof to docs/spike-result.json and docs/spike-result.md.');
