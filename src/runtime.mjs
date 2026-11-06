import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const runtime = resolve(root, '.runtime');
export const configPath = resolve(runtime, 'room.json');
export const sleep = ms => new Promise(done => setTimeout(done, ms));

export async function readSettings() {
  const text = await readFile(resolve(runtime, 'stack.env'), 'utf8');
  return Object.fromEntries(text.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const pos = line.indexOf('=');
    return [line.slice(0, pos), line.slice(pos + 1)];
  }));
}

export async function loadConfig() {
  try { return JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') throw new Error('Run npm run setup to create the room first.'); throw error; }
}

export async function saveConfig(config) {
  await mkdir(runtime, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2)+'\n', { mode: 0o600 });
}

export function scrub(text, secrets = []) {
  let safe = String(text);
  for (const secret of secrets.filter(s => typeof s === 'string' && s.length > 8)) safe = safe.split(secret).join('[REDACTED]');
  return safe;
}

export async function jsonRequest(base, path, { token, cookie, method = 'GET', body, timeout = 15000, secrets = [] } = {}) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeout),
    redirect: 'error'
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}: ${scrub(text, [...secrets, token, cookie]).slice(0, 600)}`);
  return { data: text ? JSON.parse(text) : null, response };
}

export async function waitUntil(action, label, timeout = 180000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    try { return await action(); } catch (error) { last = error; await sleep(2000); }
  }
  throw new Error(`${label} was not ready: ${last?.message}`);
}
