// Export a real recorded negotiation (real Codex advocate turns through Switch,
// labelled synthetic owner inputs) into the courtroom's offline replay file.
// Usage: node scripts/export-replay.mjs <negotiation-verify-*.sqlite> [out.json]
import { copyFile, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { CourtEngine } from '../src/court-engine.mjs';
import { courtView } from '../src/court-view.mjs';
import { root } from '../src/runtime.mjs';

const [source, out = resolve(root, 'frontend/public/data/replay-signal.json')] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
if (!source) { console.error('Usage: node scripts/export-replay.mjs <recorded.sqlite> [out.json]'); process.exit(2); }
// Work on a copy: opening the engine sets WAL pragmas and must never touch the evidence.
const dir = await mkdtemp(join(tmpdir(), 'cvc-replay-'));
const copy = join(dir, 'recorded.sqlite');
await copyFile(source, copy);
const engine = new CourtEngine(copy);
try {
  const [{ id }] = engine.listCases();
  // --sign completes the rehearsal the same way its adoptions and amendment were
  // made: explicitly synthetic owner fixtures written into this isolated copy,
  // through the real engine, so digests, approvals and the receipt are genuine.
  let signed = false;
  if (process.argv.includes('--sign')) {
    const before = engine.snapshot(id);
    if (before.stage === 'AWAITING_APPROVALS') {
      let serial = 0;
      for (const role of ['lead', 'creator']) {
        const outcome = engine.handleMessage({id: `fixture-only-approval-${++serial}`, roomId: before.roomId, sender: before.principals.humans[role].sender, body: before.commands.approve, timestamp: engine.now()});
        if (!outcome.accepted) throw new Error(`Synthetic ${role} approval was rejected: ${outcome.code}`);
      }
      signed = engine.snapshot(id).stage === 'APPROVED';
    }
  }
  const snapshot = engine.snapshot(id);
  const view = courtView(snapshot, engine.timeline(id));
  if (signed) {
    const board = snapshot.boards.at(-1), bundle = engine.bundle(id, board.revision, {official: true}), dir = resolve(out, '..');
    await writeFile(resolve(dir, 'replay-storyboard.html'), bundle.html);
    await writeFile(resolve(dir, 'replay-script.txt'), bundle.script);
    await writeFile(resolve(dir, 'replay-receipt.json'), JSON.stringify(engine.receipt(id, board.revision), null, 1) + '\n');
    view.exports = {html: '/data/replay-storyboard.html', script: '/data/replay-script.txt', receipt: '/data/replay-receipt.json'};
  }
  const replay = {
    kind: 'cvc-replay-v1',
    label: signed
      ? 'Recorded rehearsal: real Codex advocate turns through Switch and a real clerk. Both owners are labelled synthetic test fixtures, including their final signatures; no real human signed.'
      : 'Recorded rehearsal: real Codex advocates through Switch; owner decisions are labelled synthetic test inputs; no human approvals.',
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
