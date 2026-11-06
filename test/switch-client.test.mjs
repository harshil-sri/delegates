import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenContext, isAddressed } from '../src/switch-client.mjs';
import { scrub } from '../src/runtime.mjs';

test('context keeps opaque sender/message identities, deduplicates thread roots, and skips elided roots', () => {
  const first = {id:'m1',sender:'opaque-A',kind:'message',body:'proposal',timestamp:1};
  const second = {id:'m2',sender:'opaque-B',kind:'message',body:'objection',timestamp:2};
  const result = flattenContext({truncated:false,threads:[{root:first,replies:[second]},{root:first,replies:[]},{root:{id:'old',elided:true},replies:[]}]});
  assert.deepEqual(result,[first,second]);
});
test('partial history and missing source identities fail explicitly', () => {
  assert.throws(()=>flattenContext({threads:[],truncated:true}),/truncated/);
  assert.throws(()=>flattenContext({threads:[{root:{kind:'message',body:'looks valid'},replies:[]}]}),/source ID/);
});
test('addressing requires the complete mention rather than a similar agent name', () => {
  assert.equal(isAddressed('@cvc-lead-advocate: respond','cvc-lead-advocate'),true);
  assert.equal(isAddressed('Ask @cvc-lead-advocate now','cvc-lead-advocate'),true);
  assert.equal(isAddressed('@cvc-lead-advocate-copy respond','cvc-lead-advocate'),false);
  assert.equal(isAddressed('cvc-lead-advocate respond','cvc-lead-advocate'),false);
});
test('known credentials are removed from diagnostic errors', () => {
  assert.equal(scrub('failed secret-value-123 again secret-value-123',['secret-value-123']),'failed [REDACTED] again [REDACTED]');
});
