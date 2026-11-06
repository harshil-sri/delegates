import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fixture,principals } from './court-fixture.mjs';
import { switchClock,flushCourtOutbox,verifyHumanAccounts } from '../src/court-runtime.mjs';

test('decision time follows Switch instead of a materially different host clock',async t=>{
  const remote=Date.parse('2040-01-01T00:00:00Z');
  const server=createServer((request,response)=>{response.setHeader('date',new Date(remote).toUTCString());response.end('{"ok":true}');});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(done=>server.close(done)));
  const now=await switchClock({bridgeUrl:`http://127.0.0.1:${server.address().port}`});
  assert.ok(now()>=remote && now()<remote+5000);
  assert.ok(Math.abs(now()-Date.now())>60_000);
});

test('an uncertain room send is reconciled from the actual clerk source rather than blindly repeated',async t=>{
  const f=fixture();t.after(()=>f.engine.close());
  let calls=0;
  const client={post:async()=>{calls++;throw new Error('response lost after send');}};
  const body=f.engine.outbox()[0].body;
  await flushCourtOutbox(f.engine,client,[]);
  assert.equal(f.engine.outbox()[0].state,'uncertain');
  await flushCourtOutbox(f.engine,client,[{id:'attacker-copy',body,sender:'untrusted-sender'}]);
  assert.equal(calls,1);
  assert.equal(f.engine.outbox().length,1);
  await flushCourtOutbox(f.engine,client,[{id:'real-clerk-source',body,sender:principals.clerk.sender}]);
  assert.equal(f.engine.outbox().length,0);
  assert.equal(calls,1);
});

test('account verification fails if an owner becomes a bot, is deactivated, or loses room membership',async()=>{
  const config={room:{external_channel_id:'native-room'}};
  for(const changed of [{is_bot:true},{delete_at:123}]) {
    await assert.rejects(()=>verifyHumanAccounts(async()=>({id:principals.humans.lead.platformUserId,...changed}),config,principals,principals.humans.lead.sender),/active human/);
  }
  await assert.rejects(()=>verifyHumanAccounts(async path=>path.startsWith('/users/')?{id:principals.humans.lead.platformUserId}:{user_id:'different-human'},config,principals,principals.humans.lead.sender),/room member/);
});
