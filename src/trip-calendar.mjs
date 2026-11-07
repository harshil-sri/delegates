// Trip clerk maths. Plain code, no AI: it validates each person's constraints,
// finds the time both people are free, and checks a proposed trip against the
// hard limits. All times are local wall-clock strings "YYYY-MM-DDTHH:MM" (IST
// by default), so plain string comparison orders them correctly.

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export class TripError extends Error {}
const need = (ok, message) => { if (!ok) throw new TripError(message); };

export function nowLocal(timeZone = 'Asia/Kolkata', at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
const parseDate = date => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = d => d.toISOString().slice(0, 10);
export const addDays = (date, n) => { const d = parseDate(date); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
export const weekday = date => DAYS[parseDate(date).getUTCDay()];
const minutes = stamp => parseDate(stamp.slice(0, 10)).getTime() / 60000 + Number(stamp.slice(11, 13)) * 60 + Number(stamp.slice(14, 16));
export const hoursBetween = (a, b) => (minutes(b) - minutes(a)) / 60;
const validDate = s => DATE.test(s) && fmt(parseDate(s)) === s;
const validStamp = s => STAMP.test(s) && validDate(s.slice(0, 10));
// Models like to write 24:00 for "end of day". Accept it as next-day 00:00.
const normaliseStamp = s => typeof s === 'string' && /T24:00$/.test(s) ? `${addDays(s.slice(0, 10), 1)}T00:00` : s;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function prettyTime(time) {
  const [h, m] = time.split(':').map(Number);
  if (h === 0 && m === 0) return 'midnight';
  if (h === 12 && m === 0) return 'noon';
  return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}`;
}
export const prettyDate = date => `${weekday(date)} ${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
export const prettyStamp = stamp => `${prettyDate(stamp.slice(0, 10))}, ${prettyTime(stamp.slice(11))}`;

function cleanText(value, label, max = 200) {
  need(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} must be short non-empty text.`);
  return value.trim();
}
function cleanList(values, label, max = 12) {
  need(Array.isArray(values) && values.length <= max, `${label} must be a list of at most ${max}.`);
  return [...new Set(values.map(v => cleanText(v, label, 240)))];
}

// The advocate's structured reading of its owner's words. Anything that does
// not validate is rejected rather than guessed at.
export function validateProfile(raw) {
  need(raw && typeof raw === 'object', 'Profile must be an object.');
  const weekly = (raw.weekly ?? []).map((rule, i) => {
    const days = [...new Set(rule.days ?? [])];
    need(days.length > 0 && days.every(d => DAYS.includes(d)), `Weekly rule ${i + 1} needs days like Mon, Tue.`);
    const end = rule.end === '24:00' ? '23:59' : rule.end;
    need(TIME.test(rule.start) && TIME.test(end) && rule.start < end, `Weekly rule ${i + 1} needs start < end in HH:MM.`);
    need(rule.from == null || validDate(rule.from), `Weekly rule ${i + 1} has a bad start date.`);
    need(rule.until == null || validDate(rule.until), `Weekly rule ${i + 1} has a bad end date.`);
    return { label: cleanText(rule.label, 'Rule label', 120), days: DAYS.filter(d => days.includes(d)), start: rule.start, end, hard: rule.hard !== false, from: rule.from ?? null, until: rule.until ?? null };
  });
  const dated = (raw.dated ?? []).map((block, i) => {
    const start = normaliseStamp(block.start), end = normaliseStamp(block.end);
    need(validStamp(start) && validStamp(end) && start < end, `Dated block ${i + 1} needs start < end as YYYY-MM-DDTHH:MM.`);
    return { label: cleanText(block.label, 'Block label', 120), start, end, hard: block.hard !== false };
  });
  need(weekly.length <= 16 && dated.length <= 24, 'Too many constraints in one profile.');
  const budgetMax = raw.budgetMax == null ? null : Number(raw.budgetMax);
  need(budgetMax === null || (Number.isFinite(budgetMax) && budgetMax > 0), 'Budget must be a positive number or null.');
  return {
    homeCity: raw.homeCity ? cleanText(raw.homeCity, 'Home city', 80) : null,
    budgetMax, currency: raw.currency ? cleanText(raw.currency, 'Currency', 8) : (budgetMax ? 'INR' : null),
    weekly, dated,
    preferences: cleanList(raw.preferences ?? [], 'Preferences'),
    dealbreakers: cleanList(raw.dealbreakers ?? [], 'Dealbreakers')
  };
}

export function emptyProfile() { return { homeCity: null, budgetMax: null, currency: null, weekly: [], dated: [], preferences: [], dealbreakers: [] }; }

// Expand one person's rules into concrete intervals that touch [from, to).
export function expand(profile, fromDate, toDate, owner) {
  const blocks = [];
  for (let date = addDays(fromDate, -1); date <= toDate; date = addDays(date, 1)) {
    for (const rule of profile.weekly) {
      if (!rule.days.includes(weekday(date))) continue;
      if (rule.from && date < rule.from) continue;
      if (rule.until && date > rule.until) continue;
      blocks.push({ owner, label: rule.label, start: `${date}T${rule.start}`, end: `${date}T${rule.end}`, hard: rule.hard, recurring: true });
    }
  }
  for (const block of profile.dated) if (block.end > `${fromDate}T00:00` && block.start < `${toDate}T23:59`) blocks.push({ owner, ...block, recurring: false });
  return blocks.sort((a, b) => a.start.localeCompare(b.start));
}

// Gaps in everyone's hard blocks, between `from` and the end of `toDate`.
export function sharedFreeWindows(profiles, from, toDate, minHours = 20) {
  const fromDate = from.slice(0, 10);
  const hard = Object.entries(profiles).flatMap(([owner, p]) => expand(p, fromDate, toDate, owner)).filter(b => b.hard).sort((a, b) => a.start.localeCompare(b.start));
  const windows = [];
  let cursor = from;
  const limit = `${addDays(toDate, 1)}T00:00`;
  for (const block of hard) {
    if (block.end <= cursor) continue;
    if (block.start > cursor) windows.push({ start: cursor, end: block.start < limit ? block.start : limit });
    if (block.end > cursor) cursor = block.end;
    if (cursor >= limit) break;
  }
  if (cursor < limit) windows.push({ start: cursor, end: limit });
  return windows.filter(w => hoursBetween(w.start, w.end) >= minHours).map(w => ({ ...w, hours: Math.round(hoursBetween(w.start, w.end)) }));
}

export function describeWindow(w) {
  const sameDay = w.start.slice(0, 10) === w.end.slice(0, 10);
  const end = w.end.endsWith('T00:00') ? `${prettyDate(addDays(w.end.slice(0, 10), -1))} night` : prettyStamp(w.end);
  return `${prettyStamp(w.start)} → ${sameDay ? prettyTime(w.end.slice(11)) : end} (${w.hours} h)`;
}

export function validatePlan(raw) {
  need(raw && typeof raw === 'object', 'Plan must be an object.');
  const depart = normaliseStamp(raw.depart), ret = normaliseStamp(raw.return);
  need(validStamp(depart) && validStamp(ret) && depart < ret, 'Plan needs depart < return as YYYY-MM-DDTHH:MM.');
  need(Array.isArray(raw.itinerary) && raw.itinerary.length >= 1 && raw.itinerary.length <= 10, 'Plan needs a 1–10 item itinerary.');
  const cost = Number(raw.costPerPerson);
  need(Number.isFinite(cost) && cost >= 0, 'Plan needs a cost per person.');
  return {
    title: cleanText(raw.title, 'Title', 120),
    destination: cleanText(raw.destination, 'Destination', 120),
    depart, return: ret,
    travel: cleanText(raw.travel, 'Travel', 240),
    itinerary: raw.itinerary.map(item => ({ when: cleanText(item.when, 'Itinerary time', 60), what: cleanText(item.what, 'Itinerary item', 240) })),
    costPerPerson: Math.round(cost),
    currency: raw.currency ? cleanText(raw.currency, 'Currency', 8) : 'INR'
  };
}

// Deterministic verdict. Hard blocks and budgets fail the plan; soft blocks
// are reported so the advocates (and humans) can weigh them.
export function checkPlan(plan, profiles, names, now) {
  const failures = [], warnings = [], passes = [];
  if (plan.depart < now) failures.push(`The trip starts in the past (${prettyStamp(plan.depart)}).`);
  if (hoursBetween(plan.depart, plan.return) > 24 * 10) failures.push('The trip is longer than 10 days.');
  for (const [owner, profile] of Object.entries(profiles)) {
    const who = names[owner];
    const clashes = expand(profile, plan.depart.slice(0, 10), plan.return.slice(0, 10), owner).filter(b => b.start < plan.return && b.end > plan.depart);
    const hard = clashes.filter(b => b.hard), soft = clashes.filter(b => !b.hard);
    const seen = new Set();
    for (const b of hard) { const key = `${b.label}|${b.start}`; if (!seen.has(key)) { seen.add(key); failures.push(`Clashes with ${who}'s "${b.label}" (${prettyStamp(b.start)} – ${b.start.slice(0, 10) === b.end.slice(0, 10) ? prettyTime(b.end.slice(11)) : prettyStamp(b.end)}).`); } }
    for (const b of soft) warnings.push(`Touches ${who}'s soft limit "${b.label}" (${prettyStamp(b.start)}).`);
    if (!hard.length) passes.push(`Fits ${who}'s schedule.`);
    if (profile.budgetMax != null) {
      if (plan.costPerPerson > profile.budgetMax) failures.push(`Costs ${money(plan.costPerPerson, plan.currency)} per person, over ${who}'s ${money(profile.budgetMax, profile.currency)} budget.`);
      else passes.push(`Within ${who}'s ${money(profile.budgetMax, profile.currency)} budget.`);
    }
  }
  return { passed: failures.length === 0, failures, warnings, passes };
}

export function money(amount, currency = 'INR') {
  const symbol = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }[currency] ?? `${currency} `;
  return `${symbol}${Number(amount).toLocaleString('en-IN')}`;
}

export function describeProfile(profile) {
  const lines = [];
  for (const r of profile.weekly) lines.push(`${r.hard ? '🔒' : '〰️'} ${r.label}: ${dayRange(r.days)} ${prettyTime(r.start)}–${prettyTime(r.end)}${r.from || r.until ? ` (${r.from ? 'from ' + prettyDate(r.from) : ''}${r.from && r.until ? ' ' : ''}${r.until ? 'until ' + prettyDate(r.until) : ''})` : ''}${r.hard ? '' : ' — flexible'}`);
  for (const b of profile.dated) lines.push(`${b.hard ? '🔒' : '〰️'} ${b.label}: ${prettyStamp(b.start)} → ${b.start.slice(0, 10) === b.end.slice(0, 10) ? prettyTime(b.end.slice(11)) : prettyStamp(b.end)}${b.hard ? '' : ' — flexible'}`);
  if (profile.budgetMax != null) lines.push(`💰 Budget: up to ${money(profile.budgetMax, profile.currency ?? 'INR')} per person`);
  if (profile.homeCity) lines.push(`📍 Starting from ${profile.homeCity}`);
  if (profile.preferences.length) lines.push(`👍 Likes: ${profile.preferences.join('; ')}`);
  if (profile.dealbreakers.length) lines.push(`🚫 Won't do: ${profile.dealbreakers.join('; ')}`);
  return lines.length ? lines.map(l => `- ${l}`).join('\n') : '- Nothing yet.';
}
function dayRange(days) {
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const idx = days.map(d => order.indexOf(d)).sort((a, b) => a - b);
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return contiguous && idx.length > 2 ? `${order[idx[0]]}–${order[idx.at(-1)]}` : idx.map(i => order[i]).join(', ');
}

export function describePlan(plan) {
  return [`**${plan.title}** — ${plan.destination}`,
    `🗓️ Leave ${prettyStamp(plan.depart)} · back ${prettyStamp(plan.return)}`,
    `🚆 ${plan.travel}`,
    ...plan.itinerary.map(i => `- **${i.when}:** ${i.what}`),
    `💸 About ${money(plan.costPerPerson, plan.currency)} per person`].join('\n');
}
