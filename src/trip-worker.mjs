import { randomUUID } from 'node:crypto';
import { isAddressed } from './switch-client.mjs';
import { TripError, validateProfile, emptyProfile, sharedFreeWindows, describeWindow, validatePlan, checkPlan, describeProfile, describePlan, addDays, weekday, nowLocal } from './trip-calendar.mjs';

export const ROLES = ['lead', 'creator'];
const other = role => role === 'lead' ? 'creator' : 'lead';
export const freshTrip = () => ({ version: 1, status: 'collecting', profiles: { lead: null, creator: null }, request: null, feedback: [], plans: [], finalRev: null, approvals: { lead: null, creator: null } });

const APPROVE = /\b(approve[ds]?|sign(ed)?|lock (it|this)( in)?|confirm(ed)?|i'?m in|looks good|lgtm|deal|agreed?)\b/i;
const RESET = /\b(reset|start over|fresh start|clear everything)\b/i;
const STATUS = /\b(status|where are we|what'?s pending)\b/i;

// One trip, two humans, two delegates and a plain-code clerk, all in one room.
export class TripRoom {
  constructor({ config, principals, names, clients, provider, store, now = () => nowLocal(), horizonDays = 42, log = console.log }) {
    Object.assign(this, { config, principals, names, clients, provider, store, now, horizonDays, log });
    this.trip = store.load() ?? freshTrip();
    this.queue = [];
    this.agentSenders = new Set([...ROLES.map(r => principals.agents[r].sender), principals.clerk.sender]);
  }
  handle(message) {
    if (this.agentSenders.has(message.sender) || message.sender_kind === 'platform' || message.on_behalf_of) return null;
    const role = ROLES.find(r => this.principals.humans[r].sender === message.sender);
    if (!role) return null;
    const name = r => this.config.actors[r].name;
    const body = message.body ?? '';
    const own = isAddressed(body, name(role)), theirs = isAddressed(body, name(other(role))), clerk = isAddressed(body, name('clerk'));
    const text = body.replace(new RegExp(`@(${ROLES.map(name).concat(name('clerk')).map(n => n.replace(/[-.]/g, '\\$&')).join('|')})\\b[:,]?`, 'gi'), '').trim();
    let job = null;
    if (own) job = { kind: 'intake', role, text };
    else if (theirs) job = { kind: 'wrong-delegate', role };
    else if (clerk) {
      if (RESET.test(text)) job = { kind: 'reset', role };
      else if (STATUS.test(text) && text.length < 40) job = { kind: 'status', role };
      else if (APPROVE.test(text) && text.length < 80 && !/\bplan\b/i.test(text)) job = { kind: 'approve', role };
      else job = { kind: 'plan', role, text };
    }
    if (job) { job.sourceId = message.id; this.queue.push(job); }
    return job;
  }
  async drain() { while (this.queue.length) await this.run(this.queue.shift()); }
  async run(job) {
    try { await this[job.kind](job); }
    catch (error) {
      this.log(`Trip job ${job.kind} failed: ${error.message}`);
      await this.say('clerk', `Something went wrong while ${job.kind === 'intake' ? `${this.names[job.role]}'s delegate was reading that` : 'planning'}: ${error.message.slice(0, 300)}\nPlease send it again.`);
    }
    this.store.save(this.trip);
  }
  say(role, text) { return this.clients[role].post(text); }
  mention(role) { return `@${this.config.actors[role].name}`; }

  async intake({ role, text }) {
    const owner = this.names[role], previous = this.trip.profiles[role]?.profile ?? emptyProfile();
    const now = this.now();
    const task = { today: `${weekday(now.slice(0, 10))} ${now}`, timeZone: 'Asia/Kolkata (IST)', owner, existingProfile: previous, newMessageFromOwner: text };
    let result, profile, lastError;
    for (let attempt = 0; attempt < 2 && !profile; attempt++) {
      result = await this.provider({ kind: 'intake', role, owner, other: this.names[other(role)], task: lastError ? { ...task, previousAttemptRejectedBecause: lastError } : task, invocationId: `trip-intake-${role}-${randomUUID()}` });
      try { profile = validateProfile(result.profile); } catch (error) { if (!(error instanceof TripError)) throw error; lastError = error.message; }
    }
    if (!profile) throw new Error(`could not turn that into a schedule (${lastError})`);
    this.trip.profiles[role] = { profile, updatedAt: now, said: [...(this.trip.profiles[role]?.said ?? []), text].slice(-6) };
    const questions = (result.questions ?? []).slice(0, 2).filter(q => typeof q === 'string' && q.trim());
    await this.say(role, `${String(result.reply ?? '').trim() || `Got it, ${owner}.`}\n\n**What I'll protect for ${owner}:**\n${describeProfile(profile)}${questions.length ? `\n\n❓ ${questions.join('\n❓ ')}` : ''}`);
    if (['awaiting_approval', 'locked'].includes(this.trip.status)) {
      this.trip.status = 'collecting'; this.trip.approvals = { lead: null, creator: null }; this.trip.finalRev = null;
      await this.say('clerk', `${owner}'s constraints changed, so the current plan no longer counts and any approvals are cleared. Send \`${this.mention('clerk')} plan it again\` for a fresh plan.`);
    } else if (ROLES.every(r => this.trip.profiles[r]) && this.trip.status === 'collecting' && !this.trip.plans.length) {
      await this.say('clerk', `Both delegates now know their person's limits. Whenever you're ready, tell me what kind of trip you want, e.g.\n\`${this.mention('clerk')} plan a 2-day trip from Delhi in the next few weeks\``);
    }
  }
  async ['wrong-delegate']({ role }) {
    const o = other(role);
    await this.say('clerk', `${this.mention(o)} only takes instructions from **${this.names[o]}**. ${this.names[role]}, tell your own delegate (${this.mention(role)}) instead.`);
  }
  async reset() {
    this.trip = freshTrip();
    await this.say('clerk', `Fresh start. I've cleared both schedules and all plans.\n**${this.names.lead}** → tell ${this.mention('lead')} your constraints.\n**${this.names.creator}** → tell ${this.mention('creator')} yours.`);
  }
  async status() {
    const t = this.trip, missing = ROLES.filter(r => !t.profiles[r]).map(r => this.names[r]);
    const lines = [`**Trip status:** ${({ collecting: 'collecting constraints', planning: 'delegates are planning', awaiting_approval: 'waiting for both of you to approve', locked: 'locked in 🔒' })[t.status]}`];
    for (const r of ROLES) lines.push(`- ${this.names[r]}: ${t.profiles[r] ? 'constraints received' : 'no constraints yet'}${t.finalRev ? ` · ${t.approvals[r] === t.finalRev ? 'approved ✅' : 'not approved yet'}` : ''}`);
    if (missing.length) lines.push(`Waiting on: ${missing.join(' and ')}.`);
    await this.say('clerk', lines.join('\n'));
  }
  async approve({ role }) {
    const t = this.trip, plan = t.plans.find(p => p.rev === t.finalRev);
    if (!plan) return this.say('clerk', 'There is no final plan to approve yet.');
    if (t.approvals[role] === t.finalRev) return this.say('clerk', `${this.names[role]}, you've already approved plan v${plan.rev}.`);
    t.approvals[role] = t.finalRev;
    const done = ROLES.every(r => t.approvals[r] === t.finalRev);
    if (!done) return this.say('clerk', `✅ **${this.names[role]}** approved plan v${plan.rev}. Waiting for **${this.names[other(role)]}** (1 of 2).`);
    t.status = 'locked';
    await this.say('clerk', `🔒 **Trip locked.** Both ${this.names.lead} and ${this.names.creator} approved plan v${plan.rev}.\n\n${describePlan(plan.plan)}\n\nNeither delegate agreed to this on its own: the clerk checked it against both calendars and both humans signed it.`);
  }

  async plan({ role, text }) {
    const t = this.trip, missing = ROLES.filter(r => !t.profiles[r]);
    if (missing.length) return this.say('clerk', `I can't plan yet. ${missing.map(r => `**${this.names[r]}**, tell ${this.mention(r)} your schedule and limits first.`).join(' ')}`);
    const replanning = t.plans.length > 0;
    if (replanning) t.feedback.push(`${this.names[role]}: ${text}`); else t.request = `${this.names[role]}: ${text}`;
    t.status = 'planning'; t.finalRev = null; t.approvals = { lead: null, creator: null };
    const now = this.now(), horizon = addDays(now.slice(0, 10), this.horizonDays);
    const profiles = Object.fromEntries(ROLES.map(r => [r, t.profiles[r].profile]));
    const windows = sharedFreeWindows(profiles, now, horizon);
    if (!windows.length) { t.status = 'collecting'; return this.say('clerk', `I checked the next ${this.horizonDays / 7} weeks and there is no stretch of 20+ hours when you are both free. One of you needs to loosen a limit.`); }
    const hardList = r => [...profiles[r].weekly.filter(x => x.hard).map(x => x.label), ...profiles[r].dated.filter(x => x.hard).map(x => x.label)];
    await this.say('clerk', `${replanning ? `Re-planning with ${this.names[role]}'s note.` : `Planning: "${text}".`} I lined up both calendars for the next ${this.horizonDays / 7} weeks. You're **both free**:\n${windows.slice(0, 6).map(w => `- ${describeWindow(w)}`).join('\n')}\n\n🔒 Hard limits I will enforce: **${this.names.lead}**: ${hardList('lead').join(', ') || 'none'} · **${this.names.creator}**: ${hardList('creator').join(', ') || 'none'}.\n${this.mention('lead')}, you propose first.`);

    const base = { today: `${weekday(now.slice(0, 10))} ${now}`, timeZone: 'Asia/Kolkata (IST)', names: this.names, profiles: { [this.names.lead]: profiles.lead, [this.names.creator]: profiles.creator }, sharedFreeWindows: windows.slice(0, 10), tripRequest: t.request, humanFeedback: t.feedback, previousPlans: t.plans.slice(-2).map(p => ({ rev: p.rev, by: this.names[p.by], plan: p.plan })) };
    const record = (by, plan, message) => { const rev = t.plans.length + 1, check = checkPlan(plan, profiles, this.names, now); const entry = { rev, by, plan, check, message }; t.plans.push(entry); return entry; };
    const checkText = entry => entry.check.passed
      ? `✅ **Clerk check, plan v${entry.rev}:** ${entry.check.passes.join(' ')}${entry.check.warnings.length ? `\n⚠️ ${entry.check.warnings.join(' ')}` : ''}`
      : `❌ **Clerk check, plan v${entry.rev}: rejected.**\n${entry.check.failures.map(f => `- ${f}`).join('\n')}`;

    // 1. Harshil's delegate proposes (one retry if the clerk rejects it).
    let proposal = null, rejection = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await this.provider({ kind: 'propose', role: 'lead', owner: this.names.lead, other: this.names.creator, task: rejection ? { ...base, yourLastPlanWasRejectedByTheClerk: rejection } : base, invocationId: `trip-propose-${randomUUID()}` });
      const plan = validatePlan(out.plan), entry = record('lead', plan, out.message);
      await this.say('lead', `${out.message}\n\n**Plan v${entry.rev}**\n${describePlan(plan)}`);
      await this.say('clerk', checkText(entry) + (entry.check.passed ? `\n${this.mention('creator')}, your review.` : attempt === 0 ? `\n${this.mention('lead')}, try again inside a shared window.` : ''));
      if (entry.check.passed) { proposal = entry; break; }
      rejection = entry.check.failures;
    }
    if (!proposal) { t.status = 'collecting'; return this.say('clerk', `Your delegates couldn't find a plan that fits both calendars. Try a shorter trip or relax a limit, then ask me again.`); }

    // 2. Daksh's delegate reviews: accept, or counter with its own plan.
    let final = proposal;
    const review = await this.review('creator', proposal, base);
    if (review.counter) {
      final = review.counter.check.passed ? review.counter : proposal;
      // 3. Harshil's delegate answers the counter. Bounded: no third round.
      if (review.counter.check.passed) {
        const back = await this.review('lead', review.counter, base, { final: true });
        if (back.counter?.check.passed) final = back.counter;
      }
    }
    t.finalRev = final.rev; t.status = 'awaiting_approval';
    await this.say('clerk', `🤝 **Delegates agree on plan v${final.rev}.** It passes both calendars and budgets, but nothing is booked until you both say yes.\n\n${describePlan(final.plan)}\n\nTo approve, each of you send: \`${this.mention('clerk')} approve\`\nWant changes? Send \`${this.mention('clerk')}\` plus what you'd like different.`);
  }
  async review(role, entry, base, { final = false } = {}) {
    const t = this.trip;
    const out = await this.provider({ kind: 'review', role, owner: this.names[role], other: this.names[other(role)], task: { ...base, proposal: { rev: entry.rev, by: this.names[entry.by], message: entry.message, plan: entry.plan }, clerkCheck: entry.check, ...(final ? { note: 'This is the last round. Only counter if the plan truly fails your owner.' } : {}) }, invocationId: `trip-review-${role}-${randomUUID()}` });
    if (out.decision !== 'counter' || !out.counterPlan) {
      await this.say(role, `✅ ${out.message}`);
      return { accepted: true };
    }
    const plan = validatePlan(out.counterPlan);
    const rev = t.plans.length + 1, check = checkPlan(plan, Object.fromEntries(ROLES.map(r => [r, t.profiles[r].profile])), this.names, this.now());
    const counter = { rev, by: role, plan, check, message: out.message };
    t.plans.push(counter);
    await this.say(role, `↩️ ${out.message}\n\n**Plan v${rev}** (counter-proposal)\n${describePlan(plan)}`);
    await this.say('clerk', check.passed ? `✅ **Clerk check, plan v${rev}:** ${check.passes.join(' ')}${final ? '' : `\n${this.mention(other(role))}, your call.`}` : `❌ **Clerk check, plan v${rev}: rejected.**\n${check.failures.map(f => `- ${f}`).join('\n')}\nKeeping plan v${entry.rev}.`);
    return { counter };
  }
}
