import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { fixture } from './court-fixture.mjs';
import { createCourtServer } from '../src/court-http.mjs';

function openStream(url, headers = {}) {
  return new Promise((done, failed) => {
    const call = request(url, { headers }, response => {
      let buffer = '';
      const events = [];
      const comments = [];
      const waiters = [];
      response.setEncoding('utf8');
      response.on('data', chunk => {
        buffer += chunk;
        let index;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const lines = block.split('\n');
          for (const line of lines) {
            if (line.startsWith(':')) {
              comments.push(line.slice(1).trim());
            }
          }
          const fields = Object.fromEntries(
            lines
              .filter(line => line && !line.startsWith(':'))
              .map(line => {
                const colon = line.indexOf(':');
                return [line.slice(0, colon), line.slice(colon + 1).trimStart()];
              })
          );
          if (fields.event) {
            events.push({
              ...fields,
              data: fields.data ? JSON.parse(fields.data) : undefined,
            });
          }
          waiters.splice(0).forEach(fn => fn());
        }
      });
      const next = async (predicate, timeoutMs = 3000) => {
        const start = Date.now();
        while (true) {
          const found = events.find(predicate);
          if (found) return found;
          if (Date.now() - start > timeoutMs) throw new Error('Timeout waiting for event');
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timeout waiting for event')), timeoutMs);
            waiters.push(() => { clearTimeout(timer); resolve(); });
          });
        }
      };
      const nextComment = async (predicate, timeoutMs = 3000) => {
        const start = Date.now();
        while (true) {
          const found = comments.find(predicate);
          if (found) return found;
          if (Date.now() - start > timeoutMs) throw new Error('Timeout waiting for comment');
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timeout waiting for comment')), timeoutMs);
            waiters.push(() => { clearTimeout(timer); resolve(); });
          });
        }
      };
      done({ response, events, comments, next, nextComment, close: () => call.destroy() });
    });
    call.on('error', failed);
    call.end();
  });
}

async function serve(t, engine, options = {}) {
  const server = createCourtServer(engine, {
    roomUrl: 'http://localhost:18865/test-room',
    port: 0,
    streamPollMs: 15,
    heartbeatMs: 30,
    ...options,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    if (server.closeAllConnections) server.closeAllConnections();
    await new Promise(done => server.close(done));
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('fresh initial court snapshot includes cursor id', async t => {
  const f = fixture();
  t.after(() => f.engine.close());
  const { base } = await serve(t, f.engine);
  const stream = await openStream(`${base}/api/cases/C01/stream`);
  t.after(() => stream.close());
  const court = await stream.next(e => e.event === 'court');
  assert.equal(court.event, 'court');
  assert.equal(court.data.caseId, 'C01');
  assert.equal(court.id, String(f.engine.lastEventId('C01')));
  assert.equal(stream.events.length, 1);
});

test('initial court includes cursor id and reconnect with that ID returns intervening beats', async t => {
  const f = fixture();
  t.after(() => f.engine.close());
  const { base } = await serve(t, f.engine);
  const initialStream = await openStream(`${base}/api/cases/C01/stream`);
  const initialCourt = await initialStream.next(e => e.event === 'court');
  const cursorId = initialCourt.id;
  assert.equal(cursorId, String(f.engine.lastEventId('C01')));
  initialStream.close();

  f.human('lead', f.snapshot().commands.adopt.lead);
  const newLastId = f.engine.lastEventId('C01');
  assert.ok(newLastId > Number(cursorId));

  const resumed = await openStream(`${base}/api/cases/C01/stream`, { 'last-event-id': cursorId });
  t.after(() => resumed.close());

  const beat = await resumed.next(e => e.event === 'beat');
  assert.equal(beat.data.type, 'mandate');
  assert.equal(beat.data.speaker, 'owner:lead');
  assert.equal(beat.id, String(newLastId));

  const court = await resumed.next(e => e.event === 'court');
  assert.equal(court.id, String(newLastId));
  assert.equal(court.data.cast.owners.lead.adopted, true);
});

test('resumed-no-new-events initial court arrives with changed ingestion status', async t => {
  let ingestionState = { state: 'live', pollCount: 1 };
  const f = fixture();
  t.after(() => f.engine.close());
  const { base } = await serve(t, f.engine, { status: () => ingestionState });

  const initialStream = await openStream(`${base}/api/cases/C01/stream`);
  const initialCourt = await initialStream.next(e => e.event === 'court');
  assert.equal(initialCourt.data.ingestion.state, 'live');
  const cursorId = initialCourt.id;
  initialStream.close();

  ingestionState = { state: 'paused', reason: 'reconnect test' };

  const resumed = await openStream(`${base}/api/cases/C01/stream`, { 'last-event-id': cursorId });
  t.after(() => resumed.close());

  const court = await resumed.next(e => e.event === 'court');
  assert.equal(court.id, cursorId);
  assert.equal(court.data.ingestion.state, 'paused');
  assert.equal(court.data.ingestion.reason, 'reconnect test');

  await new Promise(resolve => setTimeout(resolve, 50));
  const courtEvents = resumed.events.filter(e => e.event === 'court');
  assert.equal(courtEvents.length, 1);
  const beatEvents = resumed.events.filter(e => e.event === 'beat');
  assert.equal(beatEvents.length, 0);
});

test('missed beats followed by a single court without duplicate court emission', async t => {
  const f = fixture();
  t.after(() => f.engine.close());
  const { base } = await serve(t, f.engine);

  const initialStream = await openStream(`${base}/api/cases/C01/stream`);
  const initialCourt = await initialStream.next(e => e.event === 'court');
  const cursorId = initialCourt.id;
  initialStream.close();

  f.human('lead', f.snapshot().commands.adopt.lead);
  f.human('creator', f.snapshot().commands.adopt.creator);
  const finalLastId = f.engine.lastEventId('C01');

  const resumed = await openStream(`${base}/api/cases/C01/stream`, { 'last-event-id': cursorId });
  t.after(() => resumed.close());

  const court = await resumed.next(e => e.event === 'court');
  assert.equal(court.id, String(finalLastId));

  const courtIndex = resumed.events.findIndex(e => e.event === 'court');
  const beats = resumed.events.filter(e => e.event === 'beat');
  assert.equal(beats.length, 2);
  assert.equal(courtIndex, 2);
  assert.equal(beats[0].data.speaker, 'owner:lead');
  assert.equal(beats[1].data.speaker, 'owner:creator');

  await new Promise(resolve => setTimeout(resolve, 50));
  const courts = resumed.events.filter(e => e.event === 'court');
  assert.equal(courts.length, 1);
});

test('malformed cursor returns 400', async t => {
  const f = fixture();
  t.after(() => f.engine.close());
  const { base } = await serve(t, f.engine);

  const badHeader = await fetch(`${base}/api/cases/C01/stream`, {
    headers: { 'last-event-id': 'invalid-id' },
  });
  assert.equal(badHeader.status, 400);
  const badHeaderBody = await badHeader.json();
  assert.equal(badHeaderBody.error, 'Last-Event-ID must be a nonnegative event ID.');

  const badParam = await fetch(`${base}/api/cases/C01/stream?after=invalid-id`);
  assert.equal(badParam.status, 400);

  const negative = await fetch(`${base}/api/cases/C01/stream`, {
    headers: { 'last-event-id': '-1' },
  });
  assert.equal(negative.status, 400);

  const nonInteger = await fetch(`${base}/api/cases/C01/stream`, {
    headers: { 'last-event-id': '2.5' },
  });
  assert.equal(nonInteger.status, 400);
});

test('maxStreams 503 and frees after disconnect', async t => {
  const f = fixture();
  t.after(() => f.engine.close());
  const { base } = await serve(t, f.engine, { maxStreams: 1 });

  const stream1 = await openStream(`${base}/api/cases/C01/stream`);
  await stream1.next(e => e.event === 'court');

  const blocked = await fetch(`${base}/api/cases/C01/stream`);
  assert.equal(blocked.status, 503);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.error, 'Too many open court streams.');

  stream1.close();
  await new Promise(resolve => setTimeout(resolve, 50));

  const stream2 = await openStream(`${base}/api/cases/C01/stream`);
  t.after(() => stream2.close());
  assert.equal(stream2.response.statusCode, 200);
  const court = await stream2.next(e => e.event === 'court');
  assert.ok(court);
});

test('stream heartbeat emits periodically', async t => {
  const f = fixture();
  t.after(() => f.engine.close());
  const { base } = await serve(t, f.engine, { heartbeatMs: 20 });

  const stream = await openStream(`${base}/api/cases/C01/stream`);
  t.after(() => stream.close());

  const heartbeat = await stream.nextComment(c => c === 'heartbeat');
  assert.equal(heartbeat, 'heartbeat');
});

test('dynamic port without explicit port option allows loopback requests', async t => {
  const f = fixture();
  t.after(() => f.engine.close());
  const server = createCourtServer(f.engine, {
    roomUrl: 'http://localhost:18865/test-room',
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  t.after(async () => {
    if (server.closeAllConnections) server.closeAllConnections();
    await new Promise(done => server.close(done));
  });

  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'read-only-court');

  const streamRes = await openStream(`http://127.0.0.1:${port}/api/cases/C01/stream`);
  t.after(() => streamRes.close());
  assert.equal(streamRes.response.statusCode, 200);
  const court = await streamRes.next(e => e.event === 'court');
  assert.ok(court);
});
