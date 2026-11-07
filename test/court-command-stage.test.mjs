import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleBoard, objectBrief } from '../src/court-engine.mjs';
import { courtView } from '../src/court-view.mjs';
import { fixture } from './court-fixture.mjs';

function using(t, path) {
  const f = fixture(path);
  t.after(() => f.engine.close());
  return f;
}

test('ready creates approvals stage and courtView reflects approval command', t => {
  const f = using(t);
  f.ready();
  const snap = f.snapshot();
  assert.equal(snap.stage, 'AWAITING_APPROVALS');
  assert.ok(snap.commands.approve);
  assert.match(snap.commands.approve, /^@cvc-clerk APPROVE C01 BOARD1 /);
  assert.equal(snap.currentApprovals.length, 0);
  const view = courtView(snap, f.engine.timeline('C01'));
  assert.equal(view.stage, 'AWAITING_APPROVALS');
  assert.equal(view.approvals.command, snap.commands.approve);
  assert.equal(view.approvals.count, 0);
  assert.equal(view.approvals.lead, false);
  assert.equal(view.approvals.creator, false);
});

test('pending amendment request with old prepared board suppresses approve command', t => {
  const f = using(t);
  f.ready();
  const approveCmd = f.snapshot().commands.approve;
  assert.ok(approveCmd);
  const requestBrief = { ...objectBrief, goal: 'Requested goal change by creator advocate.' };
  const request = f.agent('creator', `REQUEST C01 H2 ${JSON.stringify(requestBrief)}`);
  assert.equal(request.kind, 'amendment_requested');
  const snap = f.snapshot();
  assert.equal(snap.stage, 'NEEDS_HUMAN');
  assert.equal(snap.commands.approve, null);
  assert.ok(snap.currentBundle);
  assert.equal(snap.boards.length, 1);
  const view = courtView(snap, f.engine.timeline('C01'));
  assert.equal(view.approvals.command, null);
  assert.equal(f.human('lead', approveCmd).code, 'HUMAN_DECISION_PENDING');
  assert.equal(snap.currentApprovals.length, 0);
  const decline = f.human('lead', snap.commands.amendments[0].decline);
  assert.equal(decline.kind, 'amendment_declined');
  const restored = f.snapshot();
  assert.equal(restored.stage, 'AWAITING_APPROVALS');
  assert.equal(restored.commands.approve, approveCmd);
  const restoredView = courtView(restored, f.engine.timeline('C01'));
  assert.equal(restoredView.approvals.command, approveCmd);
});

test('terminal both approved suppresses command while preserving authorization checks and grants', t => {
  const f = using(t);
  f.ready();
  const cmd = f.snapshot().commands.approve;
  assert.ok(cmd);
  assert.equal(f.human('lead', cmd).kind, 'approval_recorded');
  const half = f.snapshot();
  assert.equal(half.stage, 'AWAITING_APPROVALS');
  assert.equal(half.commands.approve, cmd);
  assert.equal(half.currentApprovals.length, 1);
  assert.equal(f.human('creator', cmd).kind, 'artifact_approved');
  const approved = f.snapshot();
  assert.equal(approved.stage, 'APPROVED');
  assert.equal(approved.commands.approve, null);
  assert.equal(approved.currentApprovals.length, 2);
  assert.equal(new Set(approved.currentApprovals.map(a => a.role)).size, 2);
  const view = courtView(approved, f.engine.timeline('C01'));
  assert.equal(view.approvals.command, null);
  assert.equal(view.approvals.count, 2);
  assert.equal(view.approvals.lead, true);
  assert.equal(view.approvals.creator, true);
  assert.equal(f.human('lead', cmd).kind, 'already_approved');
  assert.equal(f.agent('lead', cmd).code, 'HUMAN_REQUIRED');
});

test('revocation restores command iff stage allows', t => {
  const f = using(t);
  f.ready();
  const cmd = f.snapshot().commands.approve;
  f.human('lead', cmd);
  f.human('creator', cmd);
  assert.equal(f.snapshot().stage, 'APPROVED');
  assert.equal(f.snapshot().commands.approve, null);
  assert.equal(courtView(f.snapshot(), f.engine.timeline('C01')).approvals.command, null);

  assert.equal(f.human('lead', cmd.replace('APPROVE', 'REVOKE')).kind, 'approval_revoked');
  const revokedSnap = f.snapshot();
  assert.equal(revokedSnap.stage, 'AWAITING_APPROVALS');
  assert.equal(revokedSnap.commands.approve, cmd);
  assert.equal(revokedSnap.currentApprovals.length, 1);
  assert.equal(courtView(revokedSnap, f.engine.timeline('C01')).approvals.command, cmd);

  const changeRequestBrief = { ...objectBrief, goal: 'Second requested goal change.' };
  f.agent('creator', `REQUEST C01 H2 ${JSON.stringify(changeRequestBrief)}`);
  const pausedSnap = f.snapshot();
  assert.equal(pausedSnap.stage, 'NEEDS_HUMAN');
  assert.equal(pausedSnap.commands.approve, null);
  assert.equal(courtView(pausedSnap, f.engine.timeline('C01')).approvals.command, null);

  assert.equal(f.human('creator', cmd.replace('APPROVE', 'REVOKE')).kind, 'approval_revoked');
  const creatorRevokedSnap = f.snapshot();
  assert.equal(creatorRevokedSnap.stage, 'NEEDS_HUMAN');
  assert.equal(creatorRevokedSnap.commands.approve, null);
  assert.equal(creatorRevokedSnap.currentApprovals.length, 0);
  assert.equal(courtView(creatorRevokedSnap, f.engine.timeline('C01')).approvals.command, null);

  f.human('lead', creatorRevokedSnap.commands.amendments[0].decline);
  const restoredSnap = f.snapshot();
  assert.equal(restoredSnap.stage, 'AWAITING_APPROVALS');
  assert.equal(restoredSnap.commands.approve, cmd);
  assert.equal(courtView(restoredSnap, f.engine.timeline('C01')).approvals.command, cmd);
});

test('amendment and new board invalidate approvals and command gated until preview ready', t => {
  const f = using(t);
  f.ready();
  const cmd1 = f.snapshot().commands.approve;
  f.human('lead', cmd1);
  f.human('creator', cmd1);
  assert.equal(f.snapshot().stage, 'APPROVED');
  assert.equal(f.snapshot().commands.approve, null);

  const brief = { ...f.snapshot().briefs.creator.at(-1).content, goal: 'A new creator-owned goal.' };
  assert.equal(f.human('creator', `AMEND C01 D1 ${JSON.stringify(brief)}`).ref, 'D2');
  const amendedSnap = f.snapshot();
  assert.equal(amendedSnap.stage, 'NEEDS_NEW_BOARD');
  assert.equal(amendedSnap.currentApprovals.length, 0);
  assert.equal(amendedSnap.commands.approve, null);
  assert.equal(courtView(amendedSnap, f.engine.timeline('C01')).approvals.command, null);

  const failing = sampleBoard('H2', 'D2');
  failing.panels[0].seconds = 7;
  assert.equal(f.propose(failing).kind, 'check_failed');
  const failedSnap = f.snapshot();
  assert.equal(failedSnap.stage, 'CHECK_FAILED');
  assert.equal(failedSnap.commands.approve, null);
  assert.equal(courtView(failedSnap, f.engine.timeline('C01')).approvals.command, null);

  const valid = sampleBoard('H2', 'D2');
  assert.equal(f.propose(valid).kind, 'preview_ready');
  const readySnap = f.snapshot();
  assert.equal(readySnap.stage, 'AWAITING_APPROVALS');
  assert.ok(readySnap.commands.approve);
  assert.notEqual(readySnap.commands.approve, cmd1);
  assert.match(readySnap.commands.approve, /^@cvc-clerk APPROVE C01 BOARD3 /);
  assert.equal(readySnap.currentApprovals.length, 0);
  const view = courtView(readySnap, f.engine.timeline('C01'));
  assert.equal(view.approvals.command, readySnap.commands.approve);
  assert.equal(view.approvals.count, 0);
});