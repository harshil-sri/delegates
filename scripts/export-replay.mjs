// Export a real recorded negotiation (real Codex advocate turns through Switch,
// labelled synthetic owner inputs) into the courtroom's offline replay file.
// Usage: node scripts/export-replay.mjs <negotiation-verify-*.sqlite> [out.json]
import { copyFile, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { CourtEngine } from '../src/court-engine.mjs';
import { courtView } from '../src/court-view.mjs';
import { root } from '../src/runtime.mjs';

const [source, out = resolve(root, 'frontend/public/data/replay-signal.json')] = process.argv.slice(2);
if (!source) { console.error('Usage: node scripts/export-replay.mjs <recorded.sqlite> [out.json]'); process.exit(2); }
// Work on a copy: opening the engine sets WAL pragmas and must never touch the evidence.
const dir = await mkdtemp(join(tmpdir(), 'cvc-replay-'));
const copy = join(dir, 'recorded.sqlite');
await copyFile(source, copy);
const engine = new CourtEngine(copy);
try {
  const [{ id }] = engine.listCases();
  const snapshot = engine.snapshot(id);
  const view = courtView(snapshot, engine.timeline(id));
  const replay = {
    kind: 'cvc-replay-v1',
    label: 'Recorded rehearsal: real Codex advocates through Switch; owner decisions are labelled synthetic test inputs; no human approvals.',
    exportedAt: new Date().toISOString(),
    caseId: id,
    view,
    briefs: Object.fromEntries(['lead', 'creator'].map(role => [role, snapshot.briefs[role].map(({ ref, hash, content, adoption }) => ({ ref, hash, content, adopted: !!adoption }))])),
    amendments: snapshot.amendments.map(({ id: requestId, role, baseRef, content, status }) => ({ id: requestId, role, baseRef, content, status })),
    boards: snapshot.boards.map(({ revision, body, checks, stale, bundleDigest, review }) => ({ revision, title: body.title, briefs: body.briefs, panels: body.panels, checks, stale, bundleDigest, review: review ? { decision: review.decision, summary: review.summary } : null }))
  };
  await mkdir(resolve(out, '..'), { recursive: true });
  await writeFile(out, JSON.stringify(replay, null, 1) + '\n');
  console.log(`Replay ${id}: ${view.beats.length} beats, ${replay.boards.length} boards -> ${out}`);
} finally {
  engine.close();
  await rm(dir, { recursive: true, force: true });
}
