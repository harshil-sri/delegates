import { readSettings, loadConfig, saveConfig, jsonRequest, waitUntil } from '../src/runtime.mjs';

const env = await readSettings();
const bridgeUrl = `http://127.0.0.1:${env.API_HOST_PORT}`;
const secrets = Object.entries(env).filter(([k]) => /PASSWORD|TOKEN|SECRET/.test(k)).map(([,v]) => v);
console.log('Waiting for Switch and its bundled Mattermost bridge...');
await waitUntil(() => jsonRequest(bridgeUrl, '/health'), 'Switch');
const { response: login } = await waitUntil(() => jsonRequest(bridgeUrl, '/gateway/auth/login', {
  method: 'POST', body: { email: env.GATEWAY_ADMIN_EMAIL, password: env.GATEWAY_ADMIN_PASSWORD }, secrets
}), 'Gateway login');
const cookies = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
if (!cookies.includes('switch_auth=')) throw new Error('Gateway did not return an authenticated session cookie.');
const gateway = async (path, options = {}) => (await jsonRequest(bridgeUrl, `/gateway${path}`, { ...options, cookie: cookies, secrets })).data;
let config;
try { config = await loadConfig(); } catch (error) { if (!error.message.startsWith('Run npm run setup')) throw error; }
config ??= { bridgeUrl, dashboardUrl: `http://localhost:${env.GATEWAY_HOST_PORT}`, mattermostUrl: `http://localhost:${env.MATTERMOST_HOST_PORT}`, switchVersion: env.SWITCH_VERSION, actors: {} };
if (config.bridgeUrl !== bridgeUrl) throw new Error('Stored room belongs to another bridge; refusing to replace it.');

const specifications = [
  ['lead', 'cvc-lead-advocate', 'Creative lead advocate', 'Represents the creative lead in the Creative Veto Court integration spike.'],
  ['creator', 'cvc-creator-advocate', 'Creator advocate', 'Represents the collaborating creator and their portrait-use boundary.'],
  ['clerk', 'cvc-clerk', 'Court clerk', 'Deterministic protocol client that records and coordinates the integration spike.']
];
const registered = await gateway('/agents');
for (const [role, name, display_name, description] of specifications) {
  if (config.actors[role]) continue;
  if (registered.some(agent => agent.name === name)) throw new Error(`Agent ${name} already exists without a saved credential. No existing identity was overwritten.`);
  const created = await gateway('/agents/register-other', { method: 'POST', body: { name, display_name, description } });
  config.actors[role] = { id: created.id, name, apiKey: created.api_key };
  await saveConfig(config);
  console.log(`Registered ${name} as a separate passive Switch identity.`);
}

const bridges = await waitUntil(async () => {
  const values = await gateway('/collaborations');
  if (!values.length) throw new Error('Mattermost setup has not registered a bridge yet.');
  return values;
}, 'Mattermost collaboration bridge');
const mattermost = bridges.find(value => String(value.type ?? value.bridge_type ?? value.platform ?? '').includes('mattermost'));
if (!mattermost) throw new Error('No Mattermost bridge found. No room created on an unrelated platform.');
if (!config.room) {
  const existing = await gateway('/rooms');
  if (existing.some(room => room.name === 'creative-veto-spike')) throw new Error('A room of this name already exists without saved configuration; refusing to duplicate it.');
  const room = await gateway('/rooms', { method: 'POST', body: {
    name: 'creative-veto-spike',
    description: 'Two Codex-backed advocates and a deterministic clerk; integration spike only.',
    instructions: 'Respond only to explicit named requests. Do not claim human consent. Do not delegate further agent turns yourself. This is a synthetic SIGNAL promo scenario.',
    agent_ids: Object.values(config.actors).map(actor => actor.id),
    user_names: [env.MATTERMOST_USER, env.MATTERMOST_ADMIN_USER],
    bridge_id: mattermost.id,
    channel_type: 'channel_private',
    read_visibility: 'public',
    write_visibility: 'public'
  }});
  config.room = { id: room.id, name: room.name, external_channel_id: room.external_channel_id, url: room.external_channel_url };
  await saveConfig(config);
  console.log('Created one private Mattermost-backed Switch room.');
}

for (const role of ['lead', 'creator']) {
  await gateway(`/agents/${config.actors[role].id}/addressing-policy`, { method: 'PUT', body: {
    policy: { rules: [{ rooms: [config.room.id], users: '*', agents: [config.actors.clerk.id], owner: true, owner_agents: false, platform: false }] }
  }});
}
const nativeUrl = config.room.nativeUrl ?? config.room.url;
if (nativeUrl) {
  config.room.nativeUrl = nativeUrl;
  config.room.url = new URL(new URL(nativeUrl).pathname, config.mattermostUrl).href;
}
await saveConfig(config);
console.log(`Room: ${config.room.name} (${config.room.id})`);
console.log(`Mattermost: ${config.mattermostUrl}`);
if (config.room.url) console.log(`Channel: ${config.room.url}`);
console.log(`Dashboard: ${config.dashboardUrl}`);
console.log('Agent credentials are saved only in ignored .runtime/room.json.');
