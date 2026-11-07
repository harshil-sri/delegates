// Trip mode: Harshil and Daksh tell their own delegates their constraints in
// plain English, the clerk finds when both are free, the delegates negotiate a
// plan, and both humans approve it. Same Switch room and identities as the
// court; run this INSTEAD of the court listener (stop-workers first).
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { open, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig, runtime, sleep } from '../src/runtime.mjs';
import { loadCourtConfig } from '../src/court-runtime.mjs';
import { SwitchClient } from '../src/switch-client.mjs';
import { TripRoom, freshTrip } from '../src/trip-worker.mjs';
import { runTripCodex } from '../src/trip-provider.mjs';

const config = await loadConfig();
const court = await loadCourtConfig();
if (!court) throw new Error('Run npm run setup:engine first: trip mode reuses the verified human and agent identities in .runtime/court.json.');

for (const lockName of ['listener.lock']) {
  try {
    const pid = Number(await readFile(resolve(runtime, lockName), 'utf8'));
    process.kill(pid, 0);
    throw new Error(`The court listener is still running (PID ${pid}). Stop it first (scripts/stop-workers.ps1), then start trip mode.`);
  } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
}
const lockPath = resolve(runtime, 'trip.lock');
try { const lock = await open(lockPath, 'wx'); await lock.writeFile(String(process.pid)); await lock.close(); }
catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const pid = Number(await readFile(lockPath, 'utf8'));
  let alive = false; try { process.kill(pid, 0); alive = true; } catch {}
  if (alive) throw new Error(`Trip mode is already running (PID ${pid}).`);
  await writeFile(lockPath, String(process.pid));
}
await writeFile(resolve(runtime, 'trip.pid'), String(process.pid));

const names = { lead: process.env.TRIP_LEAD_NAME || 'Harshil', creator: process.env.TRIP_CREATOR_NAME || 'Daksh' };
const tripPath = resolve(runtime, 'trip.json'), seenPath = resolve(runtime, 'trip-seen.json');
const store = {
  load: () => existsSync(tripPath) ? JSON.parse(readFileSync(tripPath, 'utf8')) : null,
  save: trip => { writeFileSync(tripPath + '.tmp', JSON.stringify(trip, null, 2), { mode: 0o600 }); renameSync(tripPath + '.tmp', tripPath); }
};
if (process.argv.includes('--reset')) store.save(freshTrip());
const clients = Object.fromEntries(['lead', 'creator', 'clerk'].map(role => [role, new SwitchClient(config, config.actors[role])]));
const room = new TripRoom({ config, principals: court.principals, names, clients, store, provider: runTripCodex });

const clerk = clients.clerk;
let seen = new Set(existsSync(seenPath) ? JSON.parse(readFileSync(seenPath, 'utf8')) : (await clerk.context()).map(m => m.id));
// Also mark trip-mode messages as handled for the court listener, so starting
// the court again later does not answer old trip chatter.
const listenerState = resolve(runtime, 'listener-state.json');
const saveSeen = () => {
  writeFileSync(seenPath + '.tmp', JSON.stringify([...seen])); renameSync(seenPath + '.tmp', seenPath);
  if (!existsSync(listenerState)) return;
  const state = JSON.parse(readFileSync(listenerState, 'utf8'));
  const merged = new Set([...(state.seen ?? []), ...seen]);
  if (merged.size === (state.seen ?? []).length) return;
  state.seen = [...merged];
  writeFileSync(listenerState + '.tmp', JSON.stringify(state, null, 2) + '\n', { mode: 0o600 }); renameSync(listenerState + '.tmp', listenerState);
};
saveSeen();

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
console.log(`Trip mode live in ${config.room.name}. ${names.lead} → @${config.actors.lead.name}, ${names.creator} → @${config.actors.creator.name}, plan/approve → @${config.actors.clerk.name}.`);
if (!room.trip.plans.length && !room.trip.profiles.lead && !room.trip.profiles.creator && process.argv.includes('--announce')) await room.reset();

try {
  while (!stopping) {
    try {
      const messages = await clerk.context();
      for (const message of messages) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        const job = room.handle(message);
        if (job) console.log(`${new Date().toISOString()} ${names[job.role]} → ${job.kind}`);
      }
      saveSeen();
      await room.drain();
    } catch (error) { console.error(`Poll failed: ${error.message}`); await sleep(3000); }
    await sleep(1500);
  }
} finally {
  saveSeen();
  await unlink(lockPath).catch(() => {});
  console.log('Trip mode stopped.');
}
