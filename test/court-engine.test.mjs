import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { CourtEngine,objectBrief,sampleBoard } from '../src/court-engine.mjs';
import { digest,parseCommand } from '../src/court-schema.mjs';
import { fixture,principals,catalog } from './court-fixture.mjs';

function using(t,path) {const f=fixture(path);t.after(()=>f.engine.close());return f;}

test('only the exact bound owner can adopt or directly amend their own brief', t=>{
  const f=using(t),command=f.snapshot().commands.adopt.lead;
  assert.equal(f.human('creator',command).code,'NOT_OWNER');
  assert.equal(f.agent('lead',command).code,'HUMAN_REQUIRED');
  assert.equal(f.send('opaque-attacker',command,{sender_name:'fixture-lead'}).code,'HUMAN_REQUIRED');
  assert.equal(f.human('lead',command).kind,'brief_adopted');
  assert.equal(f.human('creator',`AMEND C01 H1 ${JSON.stringify(objectBrief)}`).code,'NOT_OWNER');
  assert.equal(f.agent('creator',`AMEND C01 H1 ${JSON.stringify(objectBrief)}`).code,'HUMAN_REQUIRED');
  assert.equal(f.snapshot().briefs.lead.length,1);
  assert.equal(f.amend().ref,'H2');
  assert.equal(f.snapshot().briefs.creator.length,1);
});

test('a creator can change only their brief; identity and approval fields in JSON are rejected',t=>{
  const f=using(t),original=f.snapshot().briefs.creator[0].content;
  const next={...original,goal:'A revised creative goal owned by the creator.'};
  assert.equal(f.human('lead',`AMEND C01 D1 ${JSON.stringify(next)}`).code,'NOT_OWNER');
  assert.equal(f.human('creator',`AMEND C01 D1 ${JSON.stringify({...next,owner:'lead',approved:true})}`).code,'INVALID_SCHEMA');
  assert.equal(f.human('creator',`AMEND C01 D1 ${JSON.stringify(next)}`).ref,'D2');
  assert.deepEqual(f.snapshot().briefs.lead[0].content.requiredAssets,['portrait-daksh']);
});

test('an advocate amendment request is immutable until the affected human accepts its exact digest',t=>{
  const f=using(t);f.adopt();
  assert.equal(f.agent('creator',`REQUEST C01 H1 ${JSON.stringify(objectBrief)}`).requestId,'A1');
  assert.equal(f.snapshot().stage,'NEEDS_HUMAN');
  assert.equal(f.snapshot().briefs.lead.length,1);
  const action=f.snapshot().commands.amendments[0];
  assert.equal(f.human('creator',action.accept).code,'NOT_OWNER');
  assert.equal(f.agent('lead',action.accept).code,'HUMAN_REQUIRED');
  assert.equal(f.human('lead',action.accept.replace(/[a-f0-9]{64}$/, '0'.repeat(64))).code,'DIGEST_MISMATCH');
  assert.equal(f.propose(sampleBoard('H1')).code,'HUMAN_DECISION_PENDING');
  assert.equal(f.human('lead',action.accept).ref,'H2');
  const state=f.snapshot();
  assert.equal(state.amendments[0].status,'accepted');
  assert.equal(state.briefs.lead[1].adoption.sender,principals.humans.lead.sender);
  assert.deepEqual(state.briefs.creator[0].content.forbiddenAssets,['portrait-daksh']);
  assert.equal(f.human('lead',action.accept).code,'STALE_AMENDMENT');
});

test('owner decline preserves terms and direct owner amendment supersedes pending requests',t=>{
  const f=using(t);f.adopt();
  f.agent('creator',`REQUEST C01 H1 ${JSON.stringify(objectBrief)}`);
  assert.equal(f.human('lead',f.snapshot().commands.amendments[0].decline).kind,'amendment_declined');
  assert.equal(f.snapshot().briefs.lead.length,1);
  f.agent('creator',`REQUEST C01 H1 ${JSON.stringify(objectBrief)}`);
  const old=f.snapshot().commands.amendments[0].accept;
  f.amend();
  assert.equal(f.snapshot().amendments[1].status,'superseded');
  assert.equal(f.human('lead',old).code,'STALE_AMENDMENT');
});

test('a pending owner question pauses the court even before the other mandate is adopted',t=>{
  const f=using(t);
  f.human('lead',f.snapshot().commands.adopt.lead);
  f.agent('creator',`REQUEST C01 H1 ${JSON.stringify(objectBrief)}`);
  assert.equal(f.snapshot().stage,'NEEDS_HUMAN');
  assert.equal(f.human('lead',f.snapshot().commands.amendments[0].decline).kind,'amendment_declined');
  assert.equal(f.snapshot().stage,'AWAITING_MANDATES');
});

test('a renderer failure rolls back the board, inbox consumption and notifications together',t=>{
  const f=using(t);f.adopt();f.amend();
  const state=f.engine.load('C01');state.catalog.assets.find(asset=>asset.id==='notebook').bytes=Buffer.from('corrupt fixture asset').toString('base64');f.engine.save(state);
  const source=f.source(principals.humans.lead.sender,`PROPOSE C01 ${JSON.stringify(sampleBoard())}`);
  const eventCount=f.engine.events('C01').length,outboxCount=f.engine.outbox().length;
  assert.throws(()=>f.engine.handleMessage(source),/Asset bytes failed/);
  assert.equal(f.snapshot().boards.length,0);
  assert.equal(f.engine.events('C01').length,eventCount);
  assert.equal(f.engine.outbox().length,outboxCount);
  assert.equal(f.engine.db.prepare('SELECT count(*) AS n FROM court_inbox WHERE message_id=?').get(source.id).n,0);
});

test('initial portrait conflict fails deterministic checks and cannot prepare an approval target',t=>{
  const f=using(t);f.adopt();
  const board=sampleBoard('H1');board.panels[0].assetId='portrait-daksh';
  assert.equal(f.propose(board).kind,'check_failed');
  const state=f.snapshot();
  assert.equal(state.currentBundle,null);
  assert.equal(state.stage,'CHECK_FAILED');
  assert.ok(state.boards[0].checks.some(check=>check.code==='D1:FORBIDS:portrait-daksh'&&!check.passed));
  assert.throws(()=>f.engine.bundle('C01',1),error=>error.code==='PREVIEW_NOT_READY');
  assert.equal(f.human('lead',`APPROVE C01 BOARD1 ${'a'.repeat(64)}`).code,'STALE_BUNDLE');
});

test('one approval and bot endorsements cannot close a case; two humans must approve the same bundle',t=>{
  const f=using(t);f.ready();
  const state=f.snapshot(),command=state.commands.approve;
  assert.equal(state.stage,'AWAITING_APPROVALS');
  assert.equal(f.agent('lead',command).code,'HUMAN_REQUIRED');
  assert.equal(f.send(principals.clerk.sender,command).code,'HUMAN_REQUIRED');
  assert.equal(f.human('lead',command,{sender_kind:'platform',on_behalf_of:'fixture-lead'}).code,'DIRECT_IDENTITY_REQUIRED');
  assert.equal(f.human('lead',command,{sender_kind:'agent'}).code,'DIRECT_IDENTITY_REQUIRED');
  assert.equal(f.human('lead',command).kind,'approval_recorded');
  assert.equal(f.human('lead',command).kind,'already_approved');
  assert.equal(f.snapshot().currentApprovals.length,1);
  assert.throws(()=>f.engine.bundle('C01',1,{official:true}),error=>error.code==='EXPORT_NOT_APPROVED');
  assert.equal(f.human('creator',command).kind,'artifact_approved');
  const receipt=f.engine.receipt('C01',1);
  assert.equal(new Set(receipt.approvals.map(approval=>approval.platformUserId)).size,2);
  assert.equal(new Set(receipt.approvals.map(approval=>approval.digest)).size,1);
  assert.equal(receipt.digest,state.currentBundle);
  const reviewed=f.engine.bundle('C01',1),exported=f.engine.bundle('C01',1,{official:true});
  assert.deepEqual(reviewed.html,exported.html);
  assert.equal(digest(exported.html),receipt.manifest.files['storyboard.html']);
});

test('a second human cannot approve a different revision and combine it with a previous approval',t=>{
  const f=using(t);f.ready();
  const old=f.snapshot().commands.approve;
  f.human('lead',old);
  f.propose();
  const current=f.snapshot().commands.approve;
  assert.notEqual(old,current);
  assert.equal(f.snapshot().currentApprovals.length,0);
  assert.equal(f.human('creator',old).code,'STALE_BUNDLE');
  assert.equal(f.human('creator',current).kind,'approval_recorded');
  assert.equal(f.snapshot().stage,'AWAITING_APPROVALS');
  assert.equal(f.human('lead',current).kind,'artifact_approved');
  assert.throws(()=>f.engine.bundle('C01',1,{official:true}),error=>error.code==='EXPORT_NOT_APPROVED');
  assert.equal(f.engine.bundle('C01',1).manifest.revision,1);
});

test('brief amendment invalidates all current approvals even when the next board text is identical',t=>{
  const f=using(t);f.ready();
  const command=f.snapshot().commands.approve;
  f.human('lead',command);f.human('creator',command);
  const brief={...f.snapshot().briefs.creator.at(-1).content,goal:'A new creator-owned goal.'};
  assert.equal(f.human('creator',`AMEND C01 D1 ${JSON.stringify(brief)}`).ref,'D2');
  assert.equal(f.snapshot().stage,'NEEDS_NEW_BOARD');
  assert.equal(f.snapshot().currentApprovals.length,0);
  assert.equal(f.snapshot().approvals.length,2);
  assert.equal(f.human('lead',command).code,'STALE_BUNDLE');
  assert.equal(f.propose().code,'STALE_BRIEF');
  f.propose(sampleBoard('H2','D2'));
  assert.equal(f.snapshot().currentApprovals.length,0);
  assert.equal(f.snapshot().stage,'AWAITING_APPROVALS');
});

test('even a new failing storyboard supersedes the earlier approved export',t=>{
  const f=using(t);f.ready();
  const command=f.snapshot().commands.approve;
  f.human('lead',command);f.human('creator',command);
  const failing=sampleBoard();failing.panels[0].seconds=7;
  assert.equal(f.propose(failing).kind,'check_failed');
  assert.equal(f.snapshot().currentBundle,null);
  assert.throws(()=>f.engine.bundle('C01',1,{official:true}),error=>error.code==='EXPORT_NOT_APPROVED');
});

test('each human can revoke only their approval; reapproval needs a new source message',t=>{
  const f=using(t);f.ready();
  const command=f.snapshot().commands.approve;
  f.human('lead',command);
  assert.equal(f.human('creator',command.replace('APPROVE','REVOKE')).code,'NO_APPROVAL');
  f.human('creator',command);
  assert.equal(f.human('lead',command.replace('APPROVE','REVOKE')).kind,'approval_revoked');
  assert.equal(f.snapshot().stage,'AWAITING_APPROVALS');
  assert.equal(f.snapshot().currentApprovals[0].role,'creator');
  assert.equal(f.human('lead',command).kind,'artifact_approved');
  assert.equal(f.snapshot().approvals.length,3);
});

test('source idempotency covers accepted and rejected messages; edits cannot replay an action',t=>{
  const f=using(t),source=f.source(principals.humans.lead.sender,f.snapshot().commands.adopt.lead);
  assert.equal(f.engine.handleMessage(source).kind,'brief_adopted');
  const count=f.engine.events('C01').length;
  assert.equal(f.engine.handleMessage(source).duplicate,true);
  assert.equal(f.engine.events('C01').length,count);
  assert.throws(()=>f.engine.handleMessage({...source,body:f.snapshot().commands.adopt.creator}),error=>error.code==='SOURCE_CHANGED');
  const rejected=f.source(principals.agents.lead.sender,f.snapshot().commands.adopt.creator);
  assert.equal(f.engine.handleMessage(rejected).accepted,false);
  assert.equal(f.engine.handleMessage(rejected).duplicate,true);
});

test('quoted, embellished, attached, stale and cross-room/case approvals do not count',t=>{
  const f=using(t);f.ready();
  const command=f.snapshot().commands.approve;
  assert.equal(parseCommand(`> ${command}`),null);
  assert.equal(parseCommand('```\n'+command+'\n```'),null);
  assert.equal(f.human('lead',`${command}\nI think this is approved.`).code,'INVALID_COMMAND');
  assert.equal(f.human('lead',command,{attachments:[{filename:'other-board.html'}]}).code,'INVALID_COMMAND');
  assert.equal(f.human('lead',command,{timestamp:f.snapshot().boards.at(-1).readyAt-1}).code,'STALE_SOURCE');
  assert.equal(f.human('lead',command,{roomId:'other-room'}).ignored,true);
  assert.equal(f.human('lead',command.replace('C01','C02')).code,'WRONG_CASE');
  assert.equal(f.snapshot().currentApprovals.length,0);
});

test('the checker enforces known assets, exact final copy, four panels and 30 whole seconds',t=>{
  const f=using(t);f.adopt();f.amend();
  const unknown=sampleBoard();unknown.panels[0].assetId='https://attacker.test/image.svg';
  assert.equal(f.propose(unknown).kind,'check_failed');
  const badCopy=sampleBoard();badCopy.panels[3].onScreen='SIGNAL\nMade together. On our terms. (approved)\nVisuals: Daksh';
  assert.equal(f.propose(badCopy).kind,'check_failed');
  const few=sampleBoard();few.panels.pop();
  assert.equal(f.propose(few).kind,'check_failed');
  const fractional=sampleBoard();fractional.panels[0].seconds=6.5;
  assert.equal(f.propose(fractional).code,'INVALID_SCHEMA');
  assert.equal(f.snapshot().currentBundle,null);
});

test('preview escapes untrusted text and a damaged stored artifact cannot be approved or exported',t=>{
  const f=using(t);f.adopt();f.amend();
  const board=sampleBoard();board.title='<script>alert(1)</script>';board.panels[0].scene='<img src="http://attacker.test">';
  f.propose(board);
  const bundle=f.engine.bundle('C01',1);
  assert.ok(bundle.html.toString().includes('&lt;script&gt;'));
  assert.ok(!bundle.html.toString().includes('<script>'));
  assert.ok(!bundle.html.toString().includes('<img src="http://attacker.test">'));
  f.engine.db.prepare('UPDATE court_bundles SET html=?').run(Buffer.from('changed bytes'));
  assert.equal(f.human('lead',f.snapshot().commands.approve).code,'ARTIFACT_CORRUPT');
  assert.equal(f.snapshot().currentApprovals.length,0);
});

test('a stale adoption or amendment cannot race a newer version and overwrite the owner decision',t=>{
  const f=using(t),old=f.snapshot().commands.adopt.lead;
  f.adopt();f.amend();
  assert.equal(f.human('lead',old).code,'STALE_BRIEF');
  assert.equal(f.human('lead',`AMEND C01 H1 ${JSON.stringify({...objectBrief,goal:'Another edit.'})}`).code,'STALE_BRIEF');
  assert.equal(f.snapshot().briefs.lead.length,2);
});

test('durable decisions and duplicate consumption survive reopening the SQLite database',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'cvc-court-test-'));
  const path=join(directory,'court.sqlite');
  const f=fixture(path);f.ready();
  const command=f.snapshot().commands.approve;
  const approval=f.source(principals.humans.lead.sender,command);
  f.engine.handleMessage(approval);f.engine.close();
  const reopened=new CourtEngine(path,{now:()=>f.now()+1});
  try {
    assert.equal(reopened.snapshot('C01').currentApprovals.length,1);
    assert.equal(reopened.handleMessage(approval).duplicate,true);
    assert.equal(reopened.handleMessage(f.source(principals.humans.creator.sender,command)).kind,'artifact_approved');
    assert.equal(reopened.receipt('C01',1).approvals.length,2);
  } finally {reopened.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir(),'cvc-court-test-')));await rm(directory,{recursive:true,force:true});}
});

test('case setup cannot bind both owners to the same account or silently replace ownership/catalog',t=>{
  const f=using(t);
  assert.throws(()=>f.engine.createCase({id:'C01',roomId:'test-room',principals:{...principals,humans:{lead:principals.humans.creator,creator:principals.humans.lead}},catalog}),error=>error.code==='BINDING_CONFLICT');
  assert.throws(()=>f.engine.createCase({id:'C01',roomId:'test-room',principals,catalog:{...catalog,version:'changed'}}),error=>error.code==='CATALOG_CONFLICT');
  const other=new CourtEngine(':memory:');t.after(()=>other.close());
  assert.throws(()=>other.createCase({id:'C02',roomId:'test-room-2',principals:{...principals,humans:{...principals.humans,creator:{...principals.humans.creator,platformUserId:principals.humans.lead.platformUserId}}},catalog}),error=>error.code==='BINDING_CONFLICT');
});
