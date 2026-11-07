import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

const root = resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const courtRoute = /^\/api\/(health|cases|cases\/C[A-Z0-9_-]{1,31}(\/(court|stream|events)|\/boards\/[1-9]\d*\/(preview|script-preview|manifest|export|script|receipt))?)$/;

export function createFrontendServer({
  courtPort,
  courtHost = '127.0.0.1',
  upstreamTimeoutMs = 8000,
} = {}) {
  if (typeof courtHost !== 'string' || !['127.0.0.1', 'localhost'].includes(courtHost)) {
    throw new Error('Upstream host must be 127.0.0.1 or localhost');
  }
  const port = courtPort !== undefined ? Number(courtPort) : Number(process.env.CVC_COURT_PORT || 18802);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error('Invalid courtPort');
  }
  const timeout = Number(upstreamTimeoutMs) || 8000;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error('Invalid upstreamTimeoutMs');
  }

  function proxyCourt(req, res, pathname, search) {
    const target = pathname === '/api/health' ? '/health' : pathname;
    const path = target + (search || '');
    const headers = {
      host: `${courtHost}:${port}`,
      accept: req.headers.accept || '*/*',
    };
    if (req.headers['last-event-id']) {
      headers['last-event-id'] = req.headers['last-event-id'];
    }

    let upstreamDone = false;
    let timer = null;

    const upstream = httpRequest({
      host: courtHost,
      port,
      method: req.method,
      path,
      headers,
    }, reply => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      upstream.setTimeout(0);
      const responseHeaders = { 'Cache-Control': reply.headers['cache-control'] || 'no-store' };
      for (const name of ['content-type', 'content-disposition', 'etag', 'content-security-policy', 'x-content-type-options', 'referrer-policy']) {
        if (reply.headers[name] !== undefined) responseHeaders[name] = reply.headers[name];
      }
      res.writeHead(reply.statusCode, responseHeaders);
      reply.pipe(res);
      reply.on('end', () => {
        upstreamDone = true;
      });
      reply.on('error', () => {
        if (!res.destroyed) res.destroy();
      });
    });

    timer = setTimeout(() => {
      timer = null;
      if (!res.headersSent) {
        upstream.destroy(new Error('timeout'));
      }
    }, timeout);
    if (timer.unref) timer.unref();

    upstream.on('error', () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (res.headersSent || res.destroyed) {
        if (!res.destroyed) res.destroy();
        return;
      }
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ offline: true, error: 'The court service is not running. Start it with scripts/start-workers.ps1.' }));
    });

    res.on('close', () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!res.writableEnded || !upstreamDone) {
        upstream.destroy();
      }
    });

    upstream.end();
  }

  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Read-only demo');
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (courtRoute.test(pathname)) {
        const listenPort = req.socket?.localPort;
        if (listenPort) {
          const allowedHosts = [`localhost:${listenPort}`, `127.0.0.1:${listenPort}`];
          if (!req.headers.host || !allowedHosts.includes(req.headers.host)) {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ error: 'Loopback host required.' }));
          }
          if (req.headers.origin) {
            const allowedOrigins = [`http://localhost:${listenPort}`, `http://127.0.0.1:${listenPort}`];
            if (!allowedOrigins.includes(req.headers.origin)) {
              res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
              return res.end(JSON.stringify({ error: 'Disallowed origin.' }));
            }
          }
        }
        return proxyCourt(req, res, pathname, url.search);
      }
      const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(root + sep) || pathname.split('/').some(part => part.startsWith('.'))) {
        res.writeHead(404);
        return res.end('Not found');
      }
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      res.writeHead(error instanceof URIError ? 400 : 404);
      res.end(error instanceof URIError ? 'Invalid path' : 'Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createFrontendServer().listen(port, '127.0.0.1', () => console.log(`Delegates courtroom: http://127.0.0.1:${port}`));
}
