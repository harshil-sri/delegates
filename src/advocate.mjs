import { SwitchClient } from './switch-client.mjs';
import { runCodex } from './codex-provider.mjs';
import { waitUntil } from './runtime.mjs';

export async function respond(config, role, requestId, runId, { mustSee = [], recentContext = false, courtState,signal } = {}) {
  const actor = config.actors[role];
  const client = new SwitchClient(config, actor);
  const context = await waitUntil(async () => {
    const all = await client.context();
    if (!all.some(message => message.id === requestId)) throw new Error('Waiting for the actual addressed request.');
    for (const id of mustSee) if (!all.some(message => message.id === id)) throw new Error(`Required prior room message ${id} was not visible.`);
    return (recentContext ? all : all.filter(message => message.body.includes(runId))).slice(-25);
  }, `${role} room context`, 20000);
  console.log(`${actor.name}: read ${context.length} real Switch messages; running Codex...`);
  const provider = await runCodex(role, context, requestId, runId, {courtState,signal});
  const text = `[CVC_REPLY ${runId} source=${requestId}]\n${provider.result.summary}\n\nProtected: ${provider.result.protected_boundary}\nNext: ${provider.result.proposed_next_step}\nHuman decision needed: ${provider.result.needs_human_decision ? 'yes' : 'no'}`;
  const replyId = await client.post(text);
  const observed = await waitUntil(async () => {
    const messages = await client.context();
    const entry = messages.find(message => message.id === replyId);
    if (!entry) throw new Error('Waiting to read back the posted advocate reply.');
    if (entry.body !== text) throw new Error('Delivered reply differs from provider output; inspect Switch guardrail behavior.');
    return entry;
  }, `${role} reply read-back`, 20000);
  console.log(`${actor.name}: reply stored in Switch (${replyId}).`);
  return { requestId, replyId, sourceSender: observed.sender, response: provider.result, elapsedMs: provider.elapsedMs, usage: provider.usage, contextMessageIds: context.map(message => message.id) };
}
