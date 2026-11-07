import { createServer } from 'node:http';
import { CourtError } from './court-schema.mjs';
import { renderCasePage } from './court-page.mjs';
import { courtView, toBeat, hiddenBeat } from './court-view.mjs';

// Frontend dev servers that may read this loopback-only, read-only API.
export const defaultFrontendOrigins = ['http://localhost:5173','http://127.0.0.1:5173','http://localhost:3000','http://127.0.0.1:3000'];
export function parseOrigins(value) {
  if (value === undefined || value === null || value === '') return defaultFrontendOrigins;
  const origins = String(value).split(',').map(item => item.trim()).filter(Boolean);
  for (const origin of origins) if (!/^https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(origin)) throw new Error(`Invalid CVC_FRONTEND_ORIGINS entry: ${origin}`);
  return origins;
}

export function createCourtServer(engine, {roomUrl, port = 18802, allowedOrigins = defaultFrontendOrigins, status = () => null, maxStreams = 16, streamPollMs = 1000, heartbeatMs = 15000} = {}) {
  const streams = new Set();
  const origins = new Set(allowedOrigins);
  const view = caseId => ({...courtView(engine.snapshot(caseId), engine.timeline(caseId, Math.max(0, engine.lastEventId(caseId)-500))), ingestion:status()});
  const server = createServer((request,response) => {
    response.setHeader('x-content-type-options','nosniff');
    response.setHeader('referrer-policy','no-referrer');
    response.setHeader('content-security-policy',"default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader('cache-control','no-store');
    const origin = request.headers.origin;
    if (origin && origins.has(origin)) { response.setHeader('access-control-allow-origin',origin); response.setHeader('vary','origin'); }
    const send = (code,content,type='application/json; charset=utf-8') => {
      response.writeHead(code,{'content-type':type});
      response.end(request.method==='HEAD' ? undefined : Buffer.isBuffer(content) || typeof content==='string' ? content : JSON.stringify(content));
    };
    const listenPort=server.address()?.port || port;
    if (![`localhost:${listenPort}`,`127.0.0.1:${listenPort}`].includes(request.headers.host)) return send(403,{error:'Loopback host required.'});
    if (request.method==='OPTIONS' && origin && origins.has(origin)) {
      response.setHeader('access-control-allow-methods','GET, HEAD');
      response.setHeader('access-control-allow-headers','last-event-id');
      response.setHeader('access-control-max-age','600');
      response.writeHead(204);return response.end();
    }
    if (!['GET','HEAD'].includes(request.method)) { response.setHeader('allow','GET, HEAD'); return send(405,{error:'This server is read-only. Human decisions must come from the bound account in the Switch room.'}); }
    try {
      const url = new URL(request.url,`http://localhost:${listenPort}`);
      if (url.pathname === '/health') return send(200,{ok:true,mode:'read-only-court',ingestion:status(),cases:engine.listCases().map(item=>({id:item.id,stage:item.stage})),unsentNotifications:engine.outbox().length});
      if (url.pathname === '/') return send(200,renderCasePage(engine.listCases(),roomUrl,status()),'text/html; charset=utf-8');
      if (url.pathname === '/api/cases') return send(200,engine.listCases());
      let match = url.pathname.match(/^\/api\/cases\/(C[A-Z0-9_-]{1,31})$/);
      if (match) return send(200,engine.snapshot(match[1]));
      match = url.pathname.match(/^\/api\/cases\/(C[A-Z0-9_-]{1,31})\/court$/);
      if (match) return send(200,view(match[1]));
      match = url.pathname.match(/^\/api\/cases\/(C[A-Z0-9_-]{1,31})\/stream$/);
      if (match) return stream(match[1],request,response,url,send);
      match = url.pathname.match(/^\/api\/cases\/(C[A-Z0-9_-]{1,31})\/events$/);
      if (match) {
        const after=Number(url.searchParams.get('after') ?? 0);
        if (!Number.isSafeInteger(after) || after<0) return send(400,{error:'after must be a nonnegative event ID.'});
        return send(200,engine.events(match[1],after));
      }
      match = url.pathname.match(/^\/api\/cases\/(C[A-Z0-9_-]{1,31})\/boards\/([1-9]\d*)\/(preview|script-preview|manifest|export|script|receipt)$/);
      if (match) {
        const [,caseId,revisionText,kind] = match, revision=Number(revisionText);
        if (kind==='receipt') return send(200,engine.receipt(caseId,revision));
        const bundle = engine.bundle(caseId,revision,{official:!['preview','script-preview','manifest'].includes(kind)});
        response.setHeader('etag',`"${bundle.digest}"`);
        if (kind==='manifest') return send(200,{digest:bundle.digest,...bundle.manifest});
        if (kind==='export') response.setHeader('content-disposition',`attachment; filename="${caseId}-BOARD${revision}-storyboard.html"`);
        if (kind==='script') response.setHeader('content-disposition',`attachment; filename="${caseId}-BOARD${revision}-script.txt"`);
        return send(200,['script','script-preview'].includes(kind)?bundle.script:bundle.html,['script','script-preview'].includes(kind)?'text/plain; charset=utf-8':'text/html; charset=utf-8');
      }
      send(404,{error:'Route not found.'});
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      if (error instanceof CourtError) return send(['CASE_NOT_FOUND','PREVIEW_NOT_READY'].includes(error.code)?404:409,{code:error.code,error:error.message});
      console.error('Court read request failed:',error.message);
      send(500,{error:'Court read failed; inspect the local service log.'});
    }
  });
  // Server-sent events: `beat` per persisted court event (id = event ID, so a
  // reconnect resumes with Last-Event-ID), `court` with the full view after
  // changes, and `ingestion` when room polling pauses or resumes.
  function stream(caseId,request,response,url,send) {
    engine.load(caseId);
    const resume = request.headers['last-event-id'] ?? url.searchParams.get('after');
    let last = resume === undefined || resume === null ? null : Number(resume);
    if (last !== null && (!Number.isSafeInteger(last) || last < 0)) return send(400,{error:'Last-Event-ID must be a nonnegative event ID.'});
    if (request.method === 'HEAD') return send(200,'','text/event-stream; charset=utf-8');
    if (streams.size >= maxStreams) return send(503,{error:'Too many open court streams.'});
    response.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','connection':'keep-alive','x-accel-buffering':'no'});
    const open = () => !response.writableEnded && !response.destroyed;
    const write = (event,data,id) => open() && response.write(`${id === undefined ? '' : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    let ingestion = JSON.stringify(status());
    const flush = () => {
      const rows = engine.timeline(caseId,last ?? 0);
      if (!rows.length) return false;
      const snapshot = engine.snapshot(caseId);
      for (const row of rows) { if (!hiddenBeat(row)) write('beat',toBeat(snapshot,row),row.id); last = row.id; }
      write('court',view(caseId),last);
      return true;
    };
    response.write('retry: 3000\n\n');
    if (last === null || !flush()) { last = engine.lastEventId(caseId); write('court',view(caseId),last); }
    const entry = {response, timer:null, heartbeat:null, end:null};
    entry.timer = setInterval(() => {
      try {
        flush();
        const next = JSON.stringify(status());
        if (next !== ingestion) { ingestion = next; write('ingestion',status()); }
      } catch (error) {
        console.error('Court stream failed:',error.message);
        write('error',{error:'The court stream failed; reconnect to resume.'});
        entry.end();
      }
    }, streamPollMs);
    entry.heartbeat = setInterval(() => { if (open()) response.write(': heartbeat\n\n'); }, heartbeatMs);
    // Timers must stop before the response ends, or a later tick writes after end.
    const cleanup = () => { clearInterval(entry.timer); clearInterval(entry.heartbeat); streams.delete(entry); };
    entry.end = () => { cleanup(); if (open()) response.end(); };
    response.on('close',cleanup);
    streams.add(entry);
  }
  const close = server.close.bind(server);
  server.close = callback => { for (const entry of [...streams]) entry.end(); return close(callback); };
  return server;
}
