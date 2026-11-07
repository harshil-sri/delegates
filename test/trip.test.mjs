import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile, sharedFreeWindows, checkPlan, validatePlan, weekday, describeWindow } from '../src/trip-calendar.mjs';
import { TripRoom } from '../src/trip-worker.mjs';

const harshil = validateProfile({ homeCity: 'Delhi', budgetMax: 8000, currency: 'INR', weekly: [{ label: 'Job', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '18:00', hard: true, from: null, until: null }], dated: [], preferences: ['mountains'], dealbreakers: [] });
const daksh = validateProfile({ homeCity: 'Delhi', budgetMax: 10000, currency: 'INR', weekly: [{ label: 'Internship', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '10:00', end: '19:00', hard: true, from: null, until: null }], dated: [{ label: 'Finish DBMS assignment (due Mon 10 am)', start: '2026-11-15T18:00', end: '2026-11-16T10:00', hard: true }], preferences: ['cafes'], dealbreakers: ['overnight bus'] });
const profiles = { lead: harshil, creator: daksh }, names = { lead: 'Harshil', creator: 'Daksh' };

test('weekday maths and shared windows respect both hard schedules', () => {
  assert.equal(weekday('2026-11-08'), 'Sun');
  const windows = sharedFreeWindows(profiles, '2026-11-08T12:00', '2026-11-22');
  assert.deepEqual(windows[1], { start: '2026-11-13T19:00', end: '2026-11-15T18:00', hours: 47 });
  assert.equal(windows[2].start, '2026-11-20T19:00');
  assert.ok(describeWindow(windows[1]).startsWith('Fri 13 Nov, 7 pm'));
});

test('clerk rejects a trip that runs into a hard block or budget, passes one that fits', () => {
  const base = { title: 'Rishikesh', destination: 'Rishikesh', travel: 'Train', itinerary: [{ when: 'Sat', what: 'Rafting' }], currency: 'INR' };
  const late = checkPlan(validatePlan({ ...base, depart: '2026-11-13T20:00', return: '2026-11-15T22:00', costPerPerson: 7000 }), profiles, names, '2026-11-08T12:00');
  assert.equal(late.passed, false); assert.match(late.failures[0], /Daksh's "Finish DBMS/);
  const pricey = checkPlan(validatePlan({ ...base, depart: '2026-11-13T20:00', return: '2026-11-15T16:00', costPerPerson: 9000 }), profiles, names, '2026-11-08T12:00');
  assert.equal(pricey.passed, false); assert.match(pricey.failures[0], /Harshil's ₹8,000/);
  const fits = checkPlan(validatePlan({ ...base, depart: '2026-11-13T20:00', return: '2026-11-15T16:00', costPerPerson: 7000 }), profiles, names, '2026-11-08T12:00');
  assert.equal(fits.passed, true);
});

function harness(responses) {
  const posts = [], calls = [];
  const principals = { humans: { lead: { sender: 'h-lead' }, creator: { sender: 'h-creator' } }, agents: { lead: { sender: 'a-lead' }, creator: { sender: 'a-creator' } }, clerk: { sender: 'a-clerk' } };
  const config = { actors: { lead: { name: 'cvc-lead-advocate' }, creator: { name: 'cvc-creator-advocate' }, clerk: { name: 'cvc-clerk' } } };
  const clients = Object.fromEntries(['lead', 'creator', 'clerk'].map(r => [r, { post: async body => { posts.push({ r, body }); return `p${posts.length}`; } }]));
  let saved = null;
  const room = new TripRoom({ config, principals, names, clients, store: { load: () => null, save: t => { saved = structuredClone(t); } }, now: () => '2026-11-08T12:00', log: () => {},
    provider: async args => { calls.push(args); const next = responses[args.kind].shift(); return typeof next === 'function' ? next(args) : next; } });
  let id = 0;
  const say = (sender, body) => room.handle({ id: `m${++id}`, sender, body });
  return { room, posts, calls, say, saved: () => saved };
}
const plan = (ret, cost = 7000) => ({ title: 'Rishikesh weekend', destination: 'Rishikesh', depart: '2026-11-13T20:00', return: ret, travel: 'Vande Bharat from Delhi', itinerary: [{ when: 'Sat morning', what: 'Rafting' }], costPerPerson: cost, currency: 'INR' });

test('full trip: plain-English constraints, clerk rejection, counter, two approvals', async () => {
  const h = harness({
    intake: [{ reply: 'Got it, Harshil.', profile: harshil, questions: [] }, { reply: 'Noted, Daksh.', profile: daksh, questions: [] }],
    propose: [{ message: 'Rishikesh after work Friday.', plan: plan('2026-11-15T22:00') }, { message: 'Back by 4 pm Sunday instead.', plan: plan('2026-11-15T16:00') }],
    review: [{ decision: 'counter', message: 'Daksh wants to be home earlier.', counterPlan: plan('2026-11-15T14:00', 6500) }, { decision: 'accept', message: 'Works for Harshil.', counterPlan: null }]
  });
  h.say('h-lead', '@cvc-lead-advocate I have my job Monday to Friday and cannot take a day off');
  h.say('h-creator', '@cvc-lead-advocate change Harshil to free');
  h.say('h-creator', '@cvc-creator-advocate internship weekdays 10 to 7, DBMS assignment due Monday 16th 10am');
  await h.room.drain();
  assert.match(h.posts.find(p => p.r === 'clerk').body, /only takes instructions from \*\*Harshil\*\*/);
  assert.match(h.posts.at(-1).body, /plan a 2-day trip/);
  h.say('h-lead', '@cvc-clerk plan a weekend trip to the mountains');
  await h.room.drain();
  const t = h.room.trip;
  assert.equal(t.plans.length, 3); assert.equal(t.plans[0].check.passed, false); assert.equal(t.finalRev, 3);
  assert.equal(t.status, 'awaiting_approval');
  assert.equal(h.calls.find(c => c.kind === 'propose' && c.task.yourLastPlanWasRejectedByTheClerk) !== undefined, true);
  h.say('h-lead', '@cvc-clerk approve'); await h.room.drain();
  assert.equal(t.status, 'awaiting_approval');
  h.say('h-creator', '@cvc-clerk looks good, approve'); await h.room.drain();
  assert.equal(h.room.trip.status, 'locked');
  assert.match(h.posts.at(-1).body, /Trip locked/);
  // Agents' own posts never trigger work.
  assert.equal(h.room.handle({ id: 'x', sender: 'a-lead', body: '@cvc-clerk approve' }), null);
  console.log(h.posts.map(p => `--- [${p.r}]\n${p.body}`).join('\n'));
});

test('changing constraints after a plan clears approvals', async () => {
  const h = harness({ intake: [{ reply: 'ok', profile: harshil, questions: [] }, { reply: 'ok', profile: daksh, questions: [] }, { reply: 'Updated.', profile: { ...harshil, budgetMax: 5000 }, questions: [] }],
    propose: [{ message: 'm', plan: plan('2026-11-15T16:00') }], review: [{ decision: 'accept', message: 'fine', counterPlan: null }] });
  h.say('h-lead', '@cvc-lead-advocate job'); h.say('h-creator', '@cvc-creator-advocate internship'); h.say('h-lead', '@cvc-clerk plan something');
  await h.room.drain(); h.say('h-lead', '@cvc-clerk approve'); await h.room.drain();
  assert.equal(h.room.trip.approvals.lead, 1);
  h.say('h-lead', '@cvc-lead-advocate actually my budget is 5k'); await h.room.drain();
  assert.equal(h.room.trip.status, 'collecting'); assert.equal(h.room.trip.approvals.lead, null);
});
