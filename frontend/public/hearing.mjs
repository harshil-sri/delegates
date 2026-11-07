export const characters = [
  { id: 'japan-inspired', asset: '/art/panel/japan-reference.svg' },
  { id: 'woman', asset: '/art/panel/woman-reference.svg' },
  { id: 'victorian-inspired', asset: '/art/panel/british-reference.svg' },
];

export const perspectives = ['Fairness', 'Feasibility', 'Cost'];
export const judgeRoleMapping = Object.freeze({ Fairness: null, Feasibility: null, Cost: null });

export const speakers = {
  clerk: { name: 'The Clerk', role: 'Court record', initials: 'C', kind: 'clerk' },
  harshil: { name: 'GPT', role: 'Advocate for Harshil', initials: 'H', kind: 'harshil' },
  daksh: { name: 'Claude', role: 'Advocate for Daksh', initials: 'D', kind: 'daksh' },
  panel: { name: 'The Bench', role: 'Three scripted perspectives', initials: '§', kind: 'panel' },
  humans: { name: 'The owners', role: 'Sample human decision', initials: 'H·D', kind: 'humans' },
};

export const initialItems = [
  { id: 'scope', title: 'A demo worth remembering', text: 'Agree on what we can deliver in one weekend.', owner: 'Harshil + Daksh', status: 'Open', history: [] },
  { id: 'work', title: 'Two people. A fair split.', text: 'Divide the work without dividing the team.', owner: 'Harshil + Daksh', status: 'Open', history: [] },
  { id: 'budget', title: 'Keep ambition within budget', text: 'Set a shared ceiling for model and hosting costs.', owner: 'Harshil + Daksh', status: 'Open', history: [] },
  { id: 'launch', title: 'A sensible opening night', text: 'Decide how to show the finished experience.', owner: 'Harshil + Daksh', status: 'Open', history: [] },
];

const event = (id, type, speaker, round, text, extra = {}) => ({ id, type, speaker, round, text, ...extra });

export const script = [
  event('01', 'statement', 'clerk', 1, 'All rise. The Court of Collaboration is now in session. Before us: two builders, one weekend, and a rather ambitious idea. Let us find a plan both can stand behind.'),
  event('02', 'statement', 'harshil', 1, 'My client wants something the judges will remember. A live courtroom where our agents negotiate, not another wall of chat. We have 48 hours. Let the experience be our argument.'),
  event('03', 'statement', 'daksh', 1, 'And my client wants it to actually work. We should prove the core negotiation before adding accounts, calendar access, or a production deployment. A compelling demo still needs a reliable foundation.'),
  event('04', 'proposal', 'harshil', 1, 'I move that we build one complete hearing: two advocates, three judicial perspectives, an evolving plan, and a human decision when the agents cannot agree.', { item: 'scope', status: 'Under Review' }),
  event('05', 'objection', 'daksh', 1, 'Objection. Three separate judge agents and a full animation pipeline will eat the weekend. Keep the three perspectives, but use one evaluator and a small set of reusable character states.', { item: 'scope', status: 'Contested' }),
  event('06', 'ruling', 'panel', 1, 'The motion is narrowed. One end-to-end hearing, three distinct perspectives from one evaluator, and a focused set of courtroom animations. Accounts and calendars are outside this case.', { item: 'scope', status: 'Agreed', wording: 'One complete hearing. Three perspectives, one evaluator. No accounts or calendars.', assessments: { Feasibility: ['Narrow', 'One bounded hearing fits the weekend. Three separate judge services do not.'], Cost: ['Accept', 'A single evaluator avoids unnecessary model calls.'], Fairness: ['Accept', 'Both owners keep their essential priorities.'] } }),
  event('07', 'plan_update', 'clerk', 2, 'Item one is entered into the agreed plan. The court now turns to responsibility. Who builds the world, and who makes it run?'),
  event('08', 'proposal', 'daksh', 2, 'Daksh will own the negotiation engine and event bridge. Harshil will own the courtroom, motion, and docket. We reserve the final six hours for integration and a shared rehearsal.', { item: 'work', status: 'Under Review' }),
  event('09', 'ruling', 'panel', 2, 'Accepted, with a shared checkpoint after 24 hours. Neither owner should discover an incompatible event format on the morning of the demo.', { item: 'work', status: 'Agreed', wording: 'Harshil: frontend and art. Daksh: engine and event bridge. Shared checkpoint at 24h; final 6h for rehearsal.', assessments: { Feasibility: ['Accept', 'A 24-hour interface checkpoint protects integration time.'], Cost: ['Accept', 'Reserve six hours rather than risk a last-minute rebuild.'], Fairness: ['Accept', 'Each owner has a clear domain and shares integration work.'] } }),
  event('10', 'proposal', 'harshil', 3, 'Cap shared model and hosting spend at $20. Use existing tools first. Neither advocate may approve an upgrade or charge on behalf of its owner.', { item: 'budget', status: 'Under Review' }),
  event('11', 'ruling', 'panel', 3, 'The spending ceiling is accepted. Any additional expense requires both owners to agree. The clerk notes: this is a sample budget, not a charge or a purchase authorization.', { item: 'budget', status: 'Agreed', wording: 'Sample budget: $20 maximum. Existing tools first. Both owners must approve any additional spend.', assessments: { Feasibility: ['Accept', 'The limited hearing does not require new infrastructure.'], Cost: ['Accept', 'A hard shared ceiling makes the tradeoff explicit.'], Fairness: ['Accept', 'Neither owner can create a financial obligation for the other.'] } }),
  event('12', 'proposal', 'harshil', 4, 'For opening night, I propose a public live deployment. Let the judges try the negotiation for themselves.', { item: 'launch', status: 'Under Review' }),
  event('13', 'objection', 'daksh', 4, 'Objection. A public write path introduces authentication, abuse controls, and operating costs we have not tested. A local guided demo is the responsible launch for this weekend.', { item: 'launch', status: 'Contested' }),
  event('14', 'deadlock', 'panel', 4, 'Four rounds are complete. Reach and reliability remain in tension. The court cannot choose the owners’ risk tolerance for them. The launch decision returns to Harshil and Daksh.', { item: 'launch', status: 'Awaiting Appeal', assessments: { Feasibility: ['Narrow', 'A public service needs security work beyond the agreed scope.'], Cost: ['Narrow', 'A local demo has the smallest operating risk.'], Fairness: ['Narrow', 'Only the owners can agree to the remaining launch risk.'] } }),
  event('15', 'appeal', 'clerk', 4, 'Harshil and Daksh, how should this case conclude? Choose a sample joint decision below. This records a demo choice only; it does not send a message, deploy a service, or approve spending.', { item: 'launch', status: 'Awaiting Appeal' }),
  event('16', 'verdict', 'clerk', 4, 'The court has an agreed plan. One memorable hearing. A fair division of work. A bounded budget. And a launch decision made by the people who will carry it out. Case closed.'),
];

export function createState() {
  return { cursor: -1, events: [], seen: new Set(), items: structuredClone(initialItems), current: null, choice: null, complete: false };
}

export function applyEvent(state, incoming) {
  if (!incoming || typeof incoming.id !== 'string' || state.seen.has(incoming.id)) return false;
  if (state.complete || (state.current?.type === 'appeal' && !state.choice)) return false;
  if (!['statement', 'proposal', 'objection', 'ruling', 'plan_update', 'deadlock', 'appeal', 'verdict'].includes(incoming.type)) return false;
  if (incoming.type === 'verdict' && state.items.some(item => item.status !== 'Agreed')) return false;
  state.seen.add(incoming.id);
  state.events.push(structuredClone(incoming));
  state.current = structuredClone(incoming);
  if (incoming.item) {
    const item = state.items.find(item => item.id === incoming.item);
    if (item) {
      if (incoming.status) item.status = incoming.status;
      if (incoming.wording) item.text = incoming.wording;
      item.history.push({ id: incoming.id, type: incoming.type, text: incoming.text, round: incoming.round, status: item.status });
    }
  }
  if (incoming.type === 'verdict') state.complete = true;
  return true;
}

export function advance(state) {
  if (state.complete || (state.current?.type === 'appeal' && !state.choice)) return false;
  const next = script[state.cursor + 1];
  if (!next || !applyEvent(state, next)) return false;
  state.cursor += 1;
  return true;
}

export const appealOptions = {
  local: { label: 'A polished local demo', text: 'Run a guided local hearing. Revisit a public launch after security and abuse controls are verified.' },
  recording: { label: 'A recorded walkthrough', text: 'Record the guided hearing and share the walkthrough. Keep the unverified service offline.' },
};

export function resolveAppeal(state, choice) {
  if (state.current?.type !== 'appeal' || state.choice || !Object.hasOwn(appealOptions, choice)) return false;
  state.choice = choice;
  const decision = event('human-choice', 'plan_update', 'humans', 4, `Sample joint decision for Harshil and Daksh: ${appealOptions[choice].text}`, { item: 'launch', status: 'Agreed', wording: appealOptions[choice].text });
  return applyEvent(state, decision);
}

export function exportPlan(state) {
  const lines = ['# Delegates: Courtroom', '## One weekend. Two visions.', '', 'SCRIPTED DEMO. No real agent messages, purchases, deployments, or authenticated human approvals.', '', ...state.items.flatMap(item => [`## ${item.title}`, `Status: ${item.status}`, item.text, '']), '## Sample human appeal', state.choice ? appealOptions[state.choice].text : 'No decision recorded.', '', '## Full hearing record', ...state.events.map(item => `\n[${item.id}] Round ${item.round} · ${item.type} · ${speakers[item.speaker].name}\n${item.text}`)];
  return lines.join('\n');
}
