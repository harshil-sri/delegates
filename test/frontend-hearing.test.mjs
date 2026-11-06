import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import {
  createState,
  applyEvent,
  advance,
  resolveAppeal,
  exportPlan,
  script,
  initialItems,
  appealOptions,
  characters,
  speakers,
} from '../frontend/public/hearing.mjs';

// Test suite for hearing.mjs using node:test

describe('hearing.mjs', () => {
  // 1. Initial state verification
  test('initial state verification', () => {
    const state = createState();
    assert.equal(state.cursor, -1, 'Initial cursor should be -1');
    assert.deepEqual(state.events, [], 'Initial events should be empty');
    assert.equal(state.seen.size, 0, 'Initial seen set should be empty');
    assert.deepEqual(state.items, initialItems, 'Initial items should match initialItems');
    assert.equal(state.current, null, 'Initial current should be null');
    assert.equal(state.choice, null, 'Initial choice should be null');
    assert.equal(state.complete, false, 'Initial complete should be false');
  });

  // 2. Full sample script cursor verification
  test('full sample script cursor verification', () => {
    const state = createState();
    let count = 0;
    while (advance(state)) {
      count++;
    }
    assert.equal(count, 15, `Should advance through 15 events (stopped at appeal)`);
    assert.equal(state.cursor, 14, 'Cursor should be at index 14 (event 15)');
    assert.equal(state.current?.type, 'appeal', 'Current event should be appeal');
    assert.equal(state.complete, false, 'Should not be complete before verdict');

    const resolveResult = resolveAppeal(state, 'local');
    assert.equal(resolveResult, true, 'Should resolve appeal successfully');

    const finalAdvance = advance(state);
    assert.equal(finalAdvance, true, 'Should be able to advance to verdict after appeal');
    assert.equal(state.cursor, 15, 'Cursor should be at index 15 (event 16)');
    assert.equal(state.current?.type, 'verdict', 'Current event should be verdict');
    assert.equal(state.complete, true, 'Should be complete after verdict');
  });

  // 3. Proposal/ruling item histories
  test('proposal/ruling item histories', () => {
    const state = createState();
    advance(state); // 01
    advance(state); // 02
    advance(state); // 03
    advance(state); // 04 - proposal for scope
    advance(state); // 05 - objection for scope
    advance(state); // 06 - ruling for scope

    const scopeItem = state.items.find(item => item.id === 'scope');
    assert.ok(scopeItem, 'Scope item should exist');
    assert.equal(scopeItem.status, 'Agreed', 'Scope should be Agreed');
    assert.equal(scopeItem.history.length, 3, 'Scope should have 3 history entries');
    assert.equal(scopeItem.history[0].type, 'proposal', 'First history entry should be proposal');
    assert.equal(scopeItem.history[1].type, 'objection', 'Second history entry should be objection');
    assert.equal(scopeItem.history[2].type, 'ruling', 'Third history entry should be ruling');
  });

  // 4. Event ID duplicate rejection
  test('event ID duplicate rejection', () => {
    const state = createState();
    advance(state); // Add event 01
    const firstSeenSize = state.seen.size;

    const result = applyEvent(state, script[0]);
    assert.equal(result, false, 'Duplicate event should be rejected');
    assert.equal(state.seen.size, firstSeenSize, 'Seen set should not grow for duplicate');
    assert.equal(state.events.length, 1, 'Events array should not grow for duplicate');

    const duplicateEvent = { ...script[0], id: '01' };
    const duplicateResult = applyEvent(state, duplicateEvent);
    assert.equal(duplicateResult, false, 'Duplicate with same ID should return false');
  });

  // 5. Max 4 rounds verification
  test('max 4 rounds verification', () => {
    const state = createState();
    const rounds = new Set();
    while (advance(state)) {
      if (state.current?.round) {
        rounds.add(state.current.round);
      }
    }
    assert.ok(rounds.size <= 4, `Should have max 4 rounds, got ${rounds.size}`);
    assert.ok([...rounds].every(r => r >= 1 && r <= 4), 'All rounds should be between 1 and 4');
  });

  // 6. All supported types verification
  test('all supported types verification', () => {
    const supportedTypes = ['statement', 'proposal', 'objection', 'ruling', 'plan_update', 'deadlock', 'appeal', 'verdict'];
    const state = createState();
    const encounteredTypes = new Set();

    while (advance(state)) {
      if (state.current?.type) {
        encounteredTypes.add(state.current.type);
      }
    }

    resolveAppeal(state, 'local');
    advance(state);
    if (state.current?.type) {
      encounteredTypes.add(state.current.type);
    }

    for (const type of supportedTypes) {
      assert.ok(encounteredTypes.has(type), `Type ${type} should be encountered in script`);
    }
  });

  // 7. No verdict before items agreed
  test('no verdict before items agreed', () => {
    const state = createState();
    for (let i = 0; i < 10; i++) {
      advance(state);
    }

    const allAgreed = state.items.every(item => item.status === 'Agreed');
    assert.equal(allAgreed, false, 'Not all items should be agreed yet');

    const verdictEvent = script.find(e => e.type === 'verdict');
    const result = applyEvent(state, verdictEvent);
    assert.equal(result, false, 'Verdict should be rejected when items are not all agreed');
  });

  // 8. Pause at appeal blocks advance
  test('pause at appeal blocks advance', () => {
    const state = createState();
    for (let i = 0; i < 15; i++) {
      advance(state);
    }

    assert.equal(state.current?.type, 'appeal', 'Current event should be appeal');
    assert.equal(state.choice, null, 'Choice should be null at appeal');

    const result = advance(state);
    assert.equal(result, false, 'Advance should be blocked at appeal without choice');
  });

  // 9. Both resolveAppeal choices exactly once
  test('both resolveAppeal choices exactly once', () => {
    const state = createState();
    for (let i = 0; i < 15; i++) {
      advance(state);
    }

    const localResult = resolveAppeal(state, 'local');
    assert.equal(localResult, true, 'Local choice should be accepted');
    assert.equal(state.choice, 'local', 'Choice should be set to local');

    const duplicateLocalResult = resolveAppeal(state, 'local');
    assert.equal(duplicateLocalResult, false, 'Duplicate local choice should be rejected');

    const state2 = createState();
    for (let i = 0; i < 15; i++) {
      advance(state2);
    }

    const recordingResult = resolveAppeal(state2, 'recording');
    assert.equal(recordingResult, true, 'Recording choice should be accepted');
    assert.equal(state2.choice, 'recording', 'Choice should be set to recording');

    const duplicateRecordingResult = resolveAppeal(state2, 'recording');
    assert.equal(duplicateRecordingResult, false, 'Duplicate recording choice should be rejected');
  });

  // 10. Invalid choice rejected
  test('invalid choice rejected', () => {
    const state = createState();
    for (let i = 0; i < 15; i++) {
      advance(state);
    }

    const invalidResult = resolveAppeal(state, 'invalid');
    assert.equal(invalidResult, false, 'Invalid choice should be rejected');
    assert.equal(state.choice, null, 'Choice should remain null for invalid choice');

    const nullResult = resolveAppeal(state, null);
    assert.equal(nullResult, false, 'Null choice should be rejected');

    const undefinedResult = resolveAppeal(state, undefined);
    assert.equal(undefinedResult, false, 'Undefined choice should be rejected');
  });

  // 11. Restart createState independent
  test('restart createState independent', () => {
    const state1 = createState();
    advance(state1);
    advance(state1);

    const state2 = createState();
    assert.equal(state2.cursor, -1, 'New state should have initial cursor');
    assert.equal(state2.events.length, 0, 'New state should have empty events');
    assert.equal(state2.seen.size, 0, 'New state should have empty seen set');

    advance(state1);
    assert.equal(state2.cursor, -1, 'State2 cursor should remain unchanged');
  });

  // 12. No history mutation by incoming event
  test('no history mutation by incoming event', () => {
    const state = createState();
    advance(state); // 01
    advance(state); // 02
    advance(state); // 03
    advance(state); // 04 - proposal

    const scopeItem = state.items.find(item => item.id === 'scope');
    const historyBefore = JSON.stringify(scopeItem.history);

    advance(state); // 05 - objection

    const historyAfter = JSON.stringify(scopeItem.history);
    assert.notEqual(historyBefore, historyAfter, 'History should be updated');

    const modifiedEvent = { ...script[4], id: '04', text: 'Modified text' };
    const originalHistoryLength = scopeItem.history.length;
    const result = applyEvent(state, modifiedEvent);
    assert.equal(result, false, 'Modified event with duplicate ID should be rejected');
    assert.equal(scopeItem.history.length, originalHistoryLength, 'History should not change for duplicate ID');

    const newEvent = { id: 'new-event', type: 'proposal', speaker: 'harshil', round: 1, text: 'New proposal', item: 'scope', status: 'Under Review' };
    const result2 = applyEvent(state, newEvent);
    assert.equal(result2, true, 'New event should be accepted');
    assert.equal(scopeItem.history.length, originalHistoryLength + 1, 'History should have new entry for new event');
  });

  // 13. Export contains all messages and honest sample disclaimer
  test('export contains all messages and honest sample disclaimer', () => {
    const state = createState();
    while (advance(state)) {}

    resolveAppeal(state, 'local');
    advance(state);

    const exported = exportPlan(state);

    assert.ok(exported.includes('SCRIPTED DEMO'), 'Export should contain SCRIPTED DEMO disclaimer');
    assert.ok(exported.includes('No real agent messages'), 'Export should contain no real messages disclaimer');

    for (const item of initialItems) {
      assert.ok(exported.includes(item.title), `Export should contain item title: ${item.title}`);
    }

    for (const event of state.events) {
      assert.ok(exported.includes(`[${event.id}]`), `Export should contain event ID: ${event.id}`);
    }

    assert.ok(exported.includes(appealOptions.local.text), 'Export should contain appeal decision text');
  });

  // 14. Edge cases for applyEvent
  test('applyEvent edge cases', () => {
    const state = createState();

    const nullResult = applyEvent(state, null);
    assert.equal(nullResult, false, 'Null event should be rejected');

    const undefinedResult = applyEvent(state, undefined);
    assert.equal(undefinedResult, false, 'Undefined event should be rejected');

    const noIdResult = applyEvent(state, { type: 'statement', speaker: 'clerk', round: 1, text: 'test' });
    assert.equal(noIdResult, false, 'Event without id should be rejected');

    const nonStringIdResult = applyEvent(state, { id: 123, type: 'statement', speaker: 'clerk', round: 1, text: 'test' });
    assert.equal(nonStringIdResult, false, 'Event with non-string id should be rejected');

    const unsupportedResult = applyEvent(state, { id: 'test', type: 'unsupported', speaker: 'clerk', round: 1, text: 'test' });
    assert.equal(unsupportedResult, false, 'Unsupported type should be rejected');

    const completeState = createState();
    while (advance(completeState)) {}
    resolveAppeal(completeState, 'local');
    advance(completeState);
    assert.equal(completeState.complete, true, 'State should be complete');

    const completeResult = applyEvent(completeState, { id: 'new', type: 'statement', speaker: 'clerk', round: 1, text: 'test' });
    assert.equal(completeResult, false, 'Event should be rejected when state is complete');
  });

  // 15. Characters and speakers exports
  test('characters and speakers exports', () => {
    assert.equal(characters.length, 3, 'Should have 3 characters');
    assert.equal(characters[0].id, 'aki', 'First character should be aki');
    assert.equal(characters[1].id, 'edmund', 'Second character should be edmund');
    assert.equal(characters[2].id, 'mira', 'Third character should be mira');

    assert.ok(speakers.clerk, 'Should have clerk speaker');
    assert.ok(speakers.harshil, 'Should have harshil speaker');
    assert.ok(speakers.daksh, 'Should have daksh speaker');
    assert.ok(speakers.panel, 'Should have panel speaker');
    assert.ok(speakers.humans, 'Should have humans speaker');
  });
});
