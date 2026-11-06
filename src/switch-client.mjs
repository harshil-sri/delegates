import { jsonRequest } from './runtime.mjs';

// Switch 0.31.0 caps one read at 500 entries (HISTORY_MAX_LIMIT) and pages
// backwards with an ISO-8601 `before` bound that is strictly exclusive.
export const historyPageLimit = 500;
export const historyMaxPages = 20;

function entries(context) {
  if (!context || !Array.isArray(context.threads)) throw new Error('Switch did not return the supported threaded context shape.');
  const found = [];
  for (const group of context.threads) {
    for (const entry of [group.root, ...(group.replies ?? [])]) {
      if (entry?.kind !== 'message' || entry.elided || !entry.body) continue;
      if (!entry.id || !entry.sender) throw new Error('Room message lacks a stable source ID or sender.');
      found.push(entry);
    }
  }
  return found;
}

// Pages overlap at their boundary millisecond and older thread roots repeat;
// message IDs make the merge exact. Only a final untruncated page is complete.
export function flattenPages(pages) {
  if (!pages.length || pages.at(-1)?.truncated) throw new Error('Room history is truncated. Refusing to silently process an incomplete room.');
  const unique = new Map();
  for (const page of pages) for (const entry of entries(page)) unique.set(entry.id, entry);
  return [...unique.values()].sort((a,b) => (a.timestamp ?? 0)-(b.timestamp ?? 0) || a.id.localeCompare(b.id));
}
export const flattenContext = context => flattenPages([context]);

export function isAddressed(body, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)@${escaped}(?=$|[\\s:,.!?])`, 'i').test(body);
}

export class SwitchClient {
  constructor(config, actor, {request = jsonRequest} = {}) {
    this.base = config.bridgeUrl;
    this.roomId = config.room.id;
    this.actor = actor;
    this.request = request;
  }
  async page(before) {
    const { data } = await this.request(this.base, `/agents/${this.actor.id}/ops/read_context`, {
      method: 'POST', token: this.actor.apiKey, body: { room_id: this.roomId, limit: historyPageLimit, ...(before ? {before} : {}) }
    });
    return data?.result;
  }
  async context() {
    const pages = [];
    let before = null, previousOldest = null;
    for (let index = 0; index < historyMaxPages; index++) {
      const page = await this.page(before);
      pages.push(page);
      if (!page?.truncated) return flattenPages(pages);
      const oldest = page.oldest_timestamp;
      if (!Number.isSafeInteger(oldest) || (previousOldest !== null && oldest >= previousOldest)) throw new Error('Room history paging did not advance; refusing to process an incomplete room.');
      previousOldest = oldest;
      // `before` is exclusive, so include the boundary millisecond again.
      before = new Date(oldest + 1).toISOString();
    }
    throw new Error(`Room history exceeds ${historyPageLimit * historyMaxPages} entries; refusing to process an incomplete room.`);
  }
  async post(content) {
    const { data } = await this.request(this.base, `/agents/${this.actor.id}/message`, {
      method: 'POST', token: this.actor.apiKey, body: { room_id: this.roomId, content }
    });
    if (!data.event_id) throw new Error('Switch did not confirm a source message ID for the post.');
    return data.event_id;
  }
}
