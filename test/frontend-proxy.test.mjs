import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { fixture } from './court-fixture.mjs';
import { createCourtServer } from '../src/court-http.mjs';
import { createFrontendServer } from '../frontend/server.mjs';

function openStream(url, headers = {}) {
  return new Promise((done, failed) => {
    const call = request(url, { headers }, response => {
      let buffer = '';
      const events = [];
      const waiters = [];
      response.setEncoding('utf8');
      response.on('data', chunk => {
        buffer += chunk;
        let index;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const event = Object.fromEntries(
            block
              .split('\n')
              .filter(line => line && !line.startsWith(':'))
              .map(line => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 2)])
          );
          if (event.event) {
            events.push({ ...event, data: JSON.parse(event.data) });
            waiters.splice(0).forEach(fn => fn());
          }
        }
      });
      const next = async predicate => {
        while (true) {
          const found = events.find(predicate);
          if (found) return found;
          await new Promise(fn => waiters.push(fn));
        }
      };
      done({ response, events, next, close: () => call.destroy() });
    });
    call.on('error', failed);
    call.end();
  });
}

async function startServers(t, { courtOptions = {}, frontendOptions = {}, ready = false } = {}) {
  const f = fixture();
  if (ready) f.ready();
  const courtServer = createCourtServer(f.engine, {
    roomUrl: 'http://localhost:18865/test-room',
    port: 0,
    streamPollMs: 20,
    ...courtOptions,
  });
  courtServer.listen(0, '127.0.0.1');
  await once(courtServer, 'listening');
  const courtPort = courtServer.address().port;

  const frontendServer = createFrontendServer({
    courtPort,
    courtHost: '127.0.0.1',
    ...frontendOptions,
  });
  frontendServer.listen(0, '127.0.0.1');
  await once(frontendServer, 'listening');
  const frontendPort = frontendServer.address().port;

  t.after(async () => {
    if (frontendServer.closeAllConnections) frontendServer.closeAllConnections();
    if (courtServer.closeAllConnections) courtServer.closeAllConnections();
    await new Promise(done => frontendServer.close(done));
    await new Promise(done => courtServer.close(done));
    f.engine.close();
  });

  const base = `http://127.0.0.1:${frontendPort}`;
  return { f, courtServer, courtPort, frontendServer, frontendPort, base };
}

test('upstream host option validates strictly and rejects non-loopback hosts', () => {
  assert.throws(() => createFrontendServer({ courtHost: 'attacker.example' }), /Upstream host/);
  assert.throws(() => createFrontendServer({ courtHost: 'http://127.0.0.1' }), /Upstream host/);
  assert.throws(() => createFrontendServer({ courtHost: '10.0.0.1' }), /Upstream host/);
  assert.throws(() => createFrontendServer({ courtPort: -1 }), /courtPort/);
  assert.throws(() => createFrontendServer({ courtPort: 70000 }), /courtPort/);
  assert.doesNotThrow(() => createFrontendServer({ courtHost: '127.0.0.1' }));
  assert.doesNotThrow(() => createFrontendServer({ courtHost: 'localhost' }));
});

test('proxied routes enforce loopback host and reject forged host and origin', async t => {
  const { base, frontendPort } = await startServers(t, { ready: true });

  const forgedHost = await new Promise((done, failed) => {
    const call = request(`${base}/api/health`, { headers: { host: 'attacker.example' } }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => done({ status: res.statusCode, body: JSON.parse(data) }));
    });
    call.on('error', failed);
    call.end();
  });
  assert.equal(forgedHost.status, 403);
  assert.equal(forgedHost.body.error, 'Loopback host required.');

  const forgedOrigin = await fetch(`${base}/api/health`, {
    headers: { origin: 'http://evil.example' },
  });
  assert.equal(forgedOrigin.status, 403);
  const forgedOriginBody = await forgedOrigin.json();
  assert.equal(forgedOriginBody.error, 'Disallowed origin.');

  const foreignPortOrigin = await fetch(`${base}/api/health`, {
    headers: { origin: 'http://localhost:9999' },
  });
  assert.equal(foreignPortOrigin.status, 403);

  const validIpOrigin = await fetch(`${base}/api/health`, {
    headers: { origin: `http://127.0.0.1:${frontendPort}` },
  });
  assert.equal(validIpOrigin.status, 200);

  const validLocalhostOrigin = await fetch(`${base}/api/health`, {
    headers: { origin: `http://localhost:${frontendPort}` },
  });
  assert.equal(validLocalhostOrigin.status, 200);

  const noOrigin = await fetch(`${base}/api/health`);
  assert.equal(noOrigin.status, 200);

  const staticWithForgedHost = await new Promise((done, failed) => {
    const call = request(`${base}/index.html`, { headers: { host: 'attacker.example' } }, res => {
      res.resume();
      res.on('end', () => done(res.statusCode));
    });
    call.on('error', failed);
    call.end();
  });
  assert.equal(staticWithForgedHost, 200);
});

test('health and case list endpoints proxy with GET and HEAD preserving security headers', async t => {
  const { base } = await startServers(t, { ready: true });

  const healthRes = await fetch(`${base}/api/health`);
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(healthRes.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(healthRes.headers.get('content-security-policy'));
  const healthBody = await healthRes.json();
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.mode, 'read-only-court');
  assert.ok(Array.isArray(healthBody.cases));

  const headHealth = await fetch(`${base}/api/health`, { method: 'HEAD' });
  assert.equal(headHealth.status, 200);
  assert.equal(headHealth.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(await headHealth.text(), '');

  const casesRes = await fetch(`${base}/api/cases`);
  assert.equal(casesRes.status, 200);
  const cases = await casesRes.json();
  assert.ok(Array.isArray(cases));
  assert.ok(cases.some(item => item.id === 'C01'));

  const headCases = await fetch(`${base}/api/cases`, { method: 'HEAD' });
  assert.equal(headCases.status, 200);
  assert.equal(await headCases.text(), '');
});

test('case snapshot and court view routes proxy raw data correctly', async t => {
  const { base, f } = await startServers(t, { ready: true });

  const snapshotRes = await fetch(`${base}/api/cases/C01`);
  assert.equal(snapshotRes.status, 200);
  const snapshot = await snapshotRes.json();
  assert.equal(snapshot.id, 'C01');
  assert.equal(snapshot.currentBundle, f.snapshot().currentBundle);

  const courtRes = await fetch(`${base}/api/cases/C01/court`);
  assert.equal(courtRes.status, 200);
  const court = await courtRes.json();
  assert.equal(court.caseId, 'C01');
  assert.ok(court.cast);
  assert.ok(Array.isArray(court.beats));
});

test('all writes are refused with 405 and never forwarded', async t => {
  const { base } = await startServers(t, { ready: true });

  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const resApprove = await fetch(`${base}/api/cases/C01/approve`, {
      method,
      body: JSON.stringify({ role: 'lead', approved: true }),
    });
    assert.equal(resApprove.status, 405);
    assert.equal(resApprove.headers.get('allow'), 'GET, HEAD');
    assert.equal(await resApprove.text(), 'Read-only demo');

    const resHealth = await fetch(`${base}/api/health`, { method });
    assert.equal(resHealth.status, 405);

    const resCases = await fetch(`${base}/api/cases`, { method });
    assert.equal(resCases.status, 405);
  }
});

test('export is blocked before approvals and returns exact HTML, script and receipt after approvals', async t => {
  const { base, f } = await startServers(t, { ready: true });

  const previewRes = await fetch(`${base}/api/cases/C01/boards/1/preview`);
  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.headers.get('content-type'), 'text/html; charset=utf-8');
  const previewHtml = await previewRes.text();
  assert.ok(previewHtml.length > 0);

  const scriptPreviewRes = await fetch(`${base}/api/cases/C01/boards/1/script-preview`);
  assert.equal(scriptPreviewRes.status, 200);
  assert.equal(scriptPreviewRes.headers.get('content-type'), 'text/plain; charset=utf-8');
  const previewScript = await scriptPreviewRes.text();
  assert.ok(previewScript.length > 0);

  const manifestRes = await fetch(`${base}/api/cases/C01/boards/1/manifest`);
  assert.equal(manifestRes.status, 200);
  const manifest = await manifestRes.json();
  assert.equal(manifest.digest, f.snapshot().currentBundle);

  const blockedExport = await fetch(`${base}/api/cases/C01/boards/1/export`);
  assert.equal(blockedExport.status, 409);

  const approveCmd = f.snapshot().commands.approve;
  f.human('lead', approveCmd);
  f.human('creator', approveCmd);

  const exportedRes = await fetch(`${base}/api/cases/C01/boards/1/export`);
  assert.equal(exportedRes.status, 200);
  assert.equal(exportedRes.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.ok(exportedRes.headers.get('content-disposition')?.includes('C01-BOARD1-storyboard.html'));
  assert.equal(await exportedRes.text(), previewHtml);

  const scriptExportRes = await fetch(`${base}/api/cases/C01/boards/1/script`);
  assert.equal(scriptExportRes.status, 200);
  assert.equal(scriptExportRes.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.ok(scriptExportRes.headers.get('content-disposition')?.includes('C01-BOARD1-script.txt'));
  assert.equal(await scriptExportRes.text(), previewScript);

  const receiptRes = await fetch(`${base}/api/cases/C01/boards/1/receipt`);
  assert.equal(receiptRes.status, 200);
  const receipt = await receiptRes.json();
  assert.equal(receipt.approvals.length, 2);
  assert.equal(exportedRes.headers.get('etag'), `"${receipt.digest}"`);
});

test('SSE stream delivers initial snapshot, propagates new beats, and supports resume with Last-Event-ID', async t => {
  const { base, f } = await startServers(t, { ready: false });

  const live = await openStream(`${base}/api/cases/C01/stream`);
  t.after(() => live.close());
  assert.equal(live.response.headers['content-type'], 'text/event-stream; charset=utf-8');

  const initialCourt = await live.next(event => event.event === 'court');
  assert.equal(initialCourt.data.caseId, 'C01');

  f.human('lead', f.snapshot().commands.adopt.lead);

  const mandateBeat = await live.next(event => event.event === 'beat' && event.data.type === 'mandate');
  assert.equal(mandateBeat.data.speaker, 'owner:lead');
  assert.equal(Number(mandateBeat.id), mandateBeat.data.id);

  f.human('creator', f.snapshot().commands.adopt.creator);

  const resumed = await openStream(`${base}/api/cases/C01/stream`, {
    'last-event-id': String(mandateBeat.data.id),
  });
  t.after(() => resumed.close());

  const resumedBeat = await resumed.next(event => event.event === 'beat');
  assert.ok(Number(resumedBeat.id) > mandateBeat.data.id);
  assert.equal(resumedBeat.data.type, 'mandate');
  assert.equal(resumedBeat.data.speaker, 'owner:creator');

  const resumedQuery = await openStream(`${base}/api/cases/C01/stream?after=${mandateBeat.data.id}`);
  t.after(() => resumedQuery.close());
  const queryBeat = await resumedQuery.next(event => event.event === 'beat');
  assert.equal(Number(queryBeat.id), Number(resumedBeat.id));
});

test('disconnection cleanup frees upstream stream resources without leaks', async t => {
  const { base } = await startServers(t, { courtOptions: { maxStreams: 1 }, ready: true });

  const stream1 = await openStream(`${base}/api/cases/C01/stream`);
  await stream1.next(event => event.event === 'court');

  const blocked = await fetch(`${base}/api/cases/C01/stream`);
  assert.equal(blocked.status, 503);

  stream1.close();
  await new Promise(resolve => setTimeout(resolve, 80));

  const stream2 = await openStream(`${base}/api/cases/C01/stream`);
  const initial = await stream2.next(event => event.event === 'court');
  assert.ok(initial);
  stream2.close();
});

test('unreachable upstream returns 502 JSON', async t => {
  const frontendServer = createFrontendServer({
    courtPort: 19999,
    courtHost: '127.0.0.1',
    upstreamTimeoutMs: 200,
  });
  frontendServer.listen(0, '127.0.0.1');
  await once(frontendServer, 'listening');
  const port = frontendServer.address().port;
  t.after(async () => {
    if (frontendServer.closeAllConnections) frontendServer.closeAllConnections();
    await new Promise(done => frontendServer.close(done));
  });

  const res = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(res.status, 502);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  const body = await res.json();
  assert.equal(body.offline, true);
});

test('upstream timeout before headers returns 502 JSON', async t => {
  const sockets = new Set();
  const hangingUpstream = createServer(() => {});
  hangingUpstream.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  hangingUpstream.listen(0, '127.0.0.1');
  await once(hangingUpstream, 'listening');
  const upstreamPort = hangingUpstream.address().port;

  const frontendServer = createFrontendServer({
    courtPort: upstreamPort,
    courtHost: '127.0.0.1',
    upstreamTimeoutMs: 50,
  });
  frontendServer.listen(0, '127.0.0.1');
  await once(frontendServer, 'listening');
  const frontendPort = frontendServer.address().port;

  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    if (frontendServer.closeAllConnections) frontendServer.closeAllConnections();
    if (hangingUpstream.closeAllConnections) hangingUpstream.closeAllConnections();
    await new Promise(done => frontendServer.close(done));
    await new Promise(done => hangingUpstream.close(done));
  });

  const res = await fetch(`http://127.0.0.1:${frontendPort}/api/health`);
  assert.equal(res.status, 502);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  const body = await res.json();
  assert.equal(body.offline, true);
});

test('SSE connect timeout does not abort idle stream once headers are sent', async t => {
  const sockets = new Set();
  let sseSocket = null;
  const sseUpstream = createServer((req, res) => {
    sseSocket = res;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'connection': 'keep-alive',
    });
    res.write('event: ready\ndata: {}\n\n');
  });
  sseUpstream.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  sseUpstream.listen(0, '127.0.0.1');
  await once(sseUpstream, 'listening');
  const upstreamPort = sseUpstream.address().port;

  const frontendServer = createFrontendServer({
    courtPort: upstreamPort,
    courtHost: '127.0.0.1',
    upstreamTimeoutMs: 50,
  });
  frontendServer.listen(0, '127.0.0.1');
  await once(frontendServer, 'listening');
  const frontendPort = frontendServer.address().port;

  t.after(async () => {
    if (sseSocket) sseSocket.end();
    for (const socket of sockets) socket.destroy();
    if (frontendServer.closeAllConnections) frontendServer.closeAllConnections();
    if (sseUpstream.closeAllConnections) sseUpstream.closeAllConnections();
    await new Promise(done => frontendServer.close(done));
    await new Promise(done => sseUpstream.close(done));
  });

  const stream = await openStream(`http://127.0.0.1:${frontendPort}/api/cases/C01/stream`);
  const initial = await stream.next(event => event.event === 'ready');
  assert.ok(initial);

  await new Promise(resolve => setTimeout(resolve, 80));

  assert.equal(stream.response.destroyed, false);
  stream.close();
});

test('malformed paths and invalid parameters are rejected appropriately', async t => {
  const { base } = await startServers(t, { ready: true });

  const malformedUri = await fetch(`${base}/%`);
  assert.equal(malformedUri.status, 400);

  const badEventParam = await fetch(`${base}/api/cases/C01/events?after=oops`);
  assert.equal(badEventParam.status, 400);

  const badStreamParam = await fetch(`${base}/api/cases/C01/stream?after=oops`);
  assert.equal(badStreamParam.status, 400);

  const nonexistentCase = await fetch(`${base}/api/cases/C99/court`);
  assert.equal(nonexistentCase.status, 404);

  const unknownApi = await fetch(`${base}/api/unknown`);
  assert.equal(unknownApi.status, 404);

  const unknownSubroute = await fetch(`${base}/api/cases/C01/unknown`);
  assert.equal(unknownSubroute.status, 404);
});
