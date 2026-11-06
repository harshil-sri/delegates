import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = resolve(root, '.runtime');
const path = resolve(runtime, 'stack.env');
await mkdir(runtime, { recursive: true });
let exists = false;
try { await readFile(path); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!exists) {
  const secret = () => randomBytes(24).toString('hex');
  const settings = {
    SWITCH_VERSION: '0.31.0',
    SWITCH_BIND_ADDR: '127.0.0.1',
    API_HOST_PORT: '18800',
    GATEWAY_HOST_PORT: '18801',
    MATTERMOST_HOST_PORT: '18865',
    POSTGRES_HOST_PORT: '15432',
    DB_USER: 'switch_app',
    DB_PASSWORD: secret(),
    DB_OWNER_USER: 'postgres',
    DB_OWNER_PASSWORD: secret(),
    DB_NAME: 'switch',
    AGENT_REGISTRATION_TOKEN: secret(),
    SECRET_KEYS: `court:${secret()}`,
    JWT_SECRET_KEY: secret(),
    GATEWAY_ADMIN_EMAIL: 'court-admin@switch.local',
    GATEWAY_ADMIN_PASSWORD: secret(),
    FRONTEND_BASE_URL: 'http://localhost:18801',
    MATTERMOST_ADMIN_USER: 'court-admin',
    MATTERMOST_ADMIN_PASSWORD: secret(),
    MATTERMOST_TEAM_NAME: 'creative-veto',
    MATTERMOST_USER: 'court-owner',
    MATTERMOST_USER_PASSWORD: secret(),
    GATEWAY_COOKIE_SECURE: 'false',
    TELEMETRY_ENABLED: 'false',
    THIRD_PARTY_AVATARS_ENABLED: 'false'
  };
  await writeFile(path, Object.entries(settings).map(([k,v]) => `${k}=${v}`).join('\n')+'\n', { mode: 0o600, flag: 'wx' });
  console.log('Created private .runtime/stack.env; credentials are not printed.');
} else {
  console.log('Reusing .runtime/stack.env; existing secrets are unchanged.');
}
console.log('Switch bridge: http://localhost:18800');
console.log('Switch dashboard: http://localhost:18801');
console.log('Mattermost: http://localhost:18865');
