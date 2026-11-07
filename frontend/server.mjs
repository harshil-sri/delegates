import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

const root = resolve(fileURLToPath(new URL('./public/', import.meta.url)));
// Read-only court routes forwarded to the clerk's loopback API (scripts/listen.mjs).
const courtApi = { host: '127.0.0.1', port: Number(process.env.CVC_COURT_PORT || 18802) };
const courtRoute = /^\/api\/(health|cases\/C[A-Z0-9_-]{1,31}(\/(court|stream|events)|\/boards\/[1-9]\d*\/(preview|script-preview|manifest|export|script|receipt))?)$/;

function proxyCourt(req, res, pathname, search) {
  const target = pathname === '/api/health' ? '/health' : pathname;
  const upstream = httpRequest({ ...courtApi, method: req.method, path: target + search, headers: { host: `${courtApi.host}:${courtApi.port}`, accept: req.headers.accept || '*/*', ...(req.headers['last-event-id'] ? { 'last-event-id': req.headers['last-event-id'] } : {}) } }, reply => {
    const headers = { 'Cache-Control': 'no-store' };
    for (const name of ['content-type', 'content-disposition', 'etag', 'content-security-policy']) if (reply.headers[name]) headers[name] = reply.headers[name];
    res.writeHead(reply.statusCode, headers);
    reply.pipe(res);
  });
  upstream.setTimeout(8000, () => { if (!res.headersSent) upstream.destroy(new Error('timeout')); });
  upstream.on('error', () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ offline: true, error: 'The court service is not running. Start it with scripts/start-workers.ps1.' }));
  });
  req.on('close', () => upstream.destroy());
  upstream.end();
}

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

export function createFrontendServer() {
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
      if (courtRoute.test(pathname)) return proxyCourt(req, res, pathname, url.search);
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
