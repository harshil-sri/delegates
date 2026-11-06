import { createHash } from 'node:crypto';

export class CourtError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export const demand = (condition, code, message) => { if (!condition) throw new CourtError(code, message); };
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
export const roles = ['lead', 'creator'];
export const briefPrefix = role => role === 'lead' ? 'H' : 'D';
export const roleOfRef = ref => ref.startsWith('H') ? 'lead' : 'creator';

export function fields(value, names, label) {
  demand(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_SCHEMA', `${label} must be an object.`);
  demand(Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key)), 'INVALID_SCHEMA', `${label} requires exactly: ${names.join(', ')}.`);
}
export function text(value, label, max = 1000) {
  demand(typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b-\u001f]/.test(value), 'INVALID_SCHEMA', `${label} must be nonempty text of at most ${max} characters.`);
}
export function strings(values, label) {
  demand(Array.isArray(values) && values.length <= 16, 'INVALID_SCHEMA', `${label} must be an array of at most 16 strings.`);
  values.forEach(value => text(value, label, 500));
  demand(new Set(values).size === values.length, 'INVALID_SCHEMA', `${label} contains duplicates.`);
}
export function validateBrief(value, catalog) {
  fields(value, ['goal', 'requiredAssets', 'forbiddenAssets', 'requiredCopy', 'finalCopy', 'negotiable'], 'Brief');
  text(value.goal, 'goal');
  for (const key of ['requiredAssets', 'forbiddenAssets', 'requiredCopy', 'finalCopy', 'negotiable']) strings(value[key], key);
  for (const id of [...value.requiredAssets, ...value.forbiddenAssets]) demand(catalog.assets.some(asset => asset.id === id), 'UNKNOWN_ASSET', `Unknown asset ${id}.`);
  demand(!value.requiredAssets.some(id => value.forbiddenAssets.includes(id)), 'INVALID_SCHEMA', 'A brief cannot both require and forbid the same asset.');
  for (const copy of [...value.requiredCopy, ...value.finalCopy]) demand(!copy.includes('\n'), 'INVALID_SCHEMA', 'Each required copy item must be one complete line.');
  return structuredClone(value);
}
export function validateBoard(value) {
  fields(value, ['briefs', 'title', 'panels'], 'Storyboard');
  fields(value.briefs, ['lead', 'creator'], 'Storyboard briefs');
  demand(/^H[1-9]\d*$/.test(value.briefs.lead) && /^D[1-9]\d*$/.test(value.briefs.creator), 'INVALID_SCHEMA', 'Storyboard must name its exact H and D brief revisions.');
  text(value.title, 'title', 160);
  demand(Array.isArray(value.panels) && value.panels.length > 0 && value.panels.length <= 8, 'INVALID_SCHEMA', 'Storyboard needs 1–8 panels; the four-panel rule is checked separately.');
  for (const panel of value.panels) {
    fields(panel, ['seconds', 'assetId', 'scene', 'onScreen', 'voiceover'], 'Panel');
    demand(Number.isSafeInteger(panel.seconds) && panel.seconds > 0 && panel.seconds <= 300, 'INVALID_SCHEMA', 'Panel seconds must be a positive whole number.');
    text(panel.assetId, 'assetId', 100); text(panel.scene, 'scene'); text(panel.onScreen, 'onScreen'); text(panel.voiceover, 'voiceover');
  }
  return structuredClone(value);
}

// No substring parsing: quotes, code blocks, extra commentary and multiple commands
// cannot accidentally become a human decision. JSON actions consume one whole object.
export function parseCommand(body, clerkName = 'cvc-clerk') {
  if (typeof body !== 'string' || body.length > 24000) return null;
  // Structured replies are room records, not direct messages to a passive
  // clerk session. Avoid triggering Switch's manual-poll autoresponder.
  if(body.startsWith('CVC_TURN ')) {
    const envelope=body.match(/^CVC_TURN (C[A-Z0-9_-]{1,31}) (T[a-f0-9]{32}) (\{[\s\S]*\})$/);
    if(!envelope)throw new CourtError('INVALID_COMMAND','Malformed structured turn envelope.');
    return {type:'TURN',caseId:envelope[1],turnId:envelope[2],value:parseJson(envelope[3])};
  }
  const prefix = `@${clerkName} `;
  if (!body.startsWith(prefix)) return null;
  const command = body.slice(prefix.length);
  if (/^(status|help)(?: C[A-Z0-9_-]{1,31})?$/i.test(command)) return { type: command.split(' ')[0].toUpperCase(), caseId: command.split(' ')[1] };
  const id = '(C[A-Z0-9_-]{1,31})';
  let turn = command.match(new RegExp(`^TURN ${id} (T[a-f0-9]{32}) (\\{[\\s\\S]*\\})$`));
  if (turn) return {type:'TURN',caseId:turn[1],turnId:turn[2],value:parseJson(turn[3])};
  turn = command.match(new RegExp(`^NEGOTIATE ${id}$`));
  if (turn) return {type:'NEGOTIATE',caseId:turn[1]};
  let match = command.match(new RegExp(`^ADOPT ${id} ([HD][1-9]\\d*) ([a-f0-9]{64})$`));
  if (match) return {type:'ADOPT',caseId:match[1],ref:match[2],hash:match[3]};
  match = command.match(new RegExp(`^(ACCEPT|DECLINE) ${id} (A[1-9]\\d*) ([a-f0-9]{64})$`));
  if (match) return {type:match[1],caseId:match[2],requestId:match[3],hash:match[4]};
  match = command.match(new RegExp(`^(APPROVE|REVOKE) ${id} BOARD([1-9]\\d*) ([a-f0-9]{64})$`));
  if (match) return {type:match[1],caseId:match[2],revision:Number(match[3]),hash:match[4]};
  match = command.match(new RegExp(`^(AMEND|REQUEST) ${id} ([HD][1-9]\\d*) (\\{[\\s\\S]*\\})$`));
  if (match) return {type:match[1],caseId:match[2],ref:match[3],value:parseJson(match[4])};
  match = command.match(new RegExp(`^PROPOSE ${id} (\\{[\\s\\S]*\\})$`));
  if (match) return {type:'PROPOSE',caseId:match[1],value:parseJson(match[2])};
  throw new CourtError('INVALID_COMMAND', 'Use one exact command from the case page. Decisions require the complete revision and digest.');
}
function parseJson(text) {
  try { return JSON.parse(text); }
  catch { throw new CourtError('INVALID_JSON', 'The command must end with one valid JSON object.'); }
}
