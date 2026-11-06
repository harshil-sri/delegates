import { open, readFile, writeFile, unlink, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig, runtime } from '../src/runtime.mjs';
import { SwitchClient } from '../src/switch-client.mjs';
import { runRoomWorker,createIngestionStatus } from '../src/room-worker.mjs';
import { CourtEngine } from '../src/court-engine.mjs';
import { canonical } from '../src/court-schema.mjs';
import { createCourtServer,parseOrigins } from '../src/court-http.mjs';
import { loadCourtConfig, courtDatabasePath, mattermostAdmin, verifyHumanAccounts, switchClock } from '../src/court-runtime.mjs';

const config = await loadConfig();
const court = await loadCourtConfig();
const evidence = court ? null : JSON.parse(await readFile(resolve(runtime, 'last-spike.json'), 'utf8'));
const lockPath = resolve(runtime, 'listener.lock');
try {
  const lock = await open(lockPath, 'wx');
  await lock.writeFile(String(process.pid)); await lock.close();
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const pid = Number(await readFile(lockPath, 'utf8'));
  let alive = false;
  try { process.kill(pid, 0); alive = true; } catch (check) { if (check.code !== 'ESRCH') throw check; }
  if (alive) throw new Error(`A listener already owns this room (PID ${pid}).`);
  await unlink(lockPath);
  const lock = await open(lockPath, 'wx'); await lock.writeFile(String(process.pid)); await lock.close();
}
await writeFile(resolve(runtime, 'listener.pid'), String(process.pid));
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
const statePath = resolve(runtime, 'listener-state.json');
let state;
try { state = JSON.parse(await readFile(statePath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const clerk = new SwitchClient(config, config.actors.clerk);
const agentSenders = new Set(court ? Object.values(court.principals.agents).map(actor=>actor.sender) : [evidence.lead.sourceSender, evidence.creator.sourceSender]);
state ??= { seen: court ? [] : (await clerk.context()).map(message => message.id), failures: [] };
const seen = new Set(state.seen);
let saving=Promise.resolve();
const save = () => saving=saving.then(async () => {
  const temporary=statePath+'.tmp';
  await writeFile(temporary,JSON.stringify({...state,seen:[...seen]},null,2)+'\n',{mode:0o600});
  await rename(temporary,statePath);
});
await save();
console.log(`Listening in ${config.room.name}. Mention @${config.actors.lead.name} or @${config.actors.creator.name}.`);
let engine,server,mm;
const ingestion=createIngestionStatus();
try {
  if (court) {
    if (court.roomId!==config.room.id) throw new Error('Court bindings belong to another room.');
    engine=new CourtEngine(courtDatabasePath,{clerkName:config.actors.clerk.name,webUrl:court.webUrl,now:await switchClock(config)});
    const stored=engine.load(court.caseId);
    if(canonical(stored.principals)!==canonical(court.principals)) throw new Error('Stored ownership differs from the trusted room bindings.');
    mm=await mattermostAdmin(config);
    await verifyHumanAccounts(mm,config,court.principals);
    engine.enableNegotiation(court.caseId);
    server=createCourtServer(engine,{roomUrl:config.room.url,port:court.webPort,allowedOrigins:parseOrigins(process.env.CVC_FRONTEND_ORIGINS),status:()=>({...ingestion})});
    await new Promise((done,failed)=>{server.once('error',failed);server.listen(court.webPort,'127.0.0.1',done);});
    console.log(`Mandate engine: ${court.caseId}; read-only case page ${court.webUrl}/`);
  }
  await runRoomWorker({config,engine,court,clerk,mm,agentSenders,seen,state,save,isStopping:()=>stopping,status:ingestion});
} finally {
  await save();
  if(server) await new Promise(done=>server.close(done));
  engine?.close();
  await unlink(lockPath).catch(() => {});
  console.log('Listener stopped.');
}
