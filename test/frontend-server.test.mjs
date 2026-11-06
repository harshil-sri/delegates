import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { createFrontendServer } from '../frontend/server.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('./frontend/public/', import.meta.url)));

// Helper to make requests
async function makeRequest(server, method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url: path,
      headers,
    };
    const res = {
      statusCode: null,
      headers: {},
      body: Buffer.from([]),
      writeHead: (code, headers) => {
        res.statusCode = code;
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            res.headers[key] = value;
          }
        }
      },
      setHeader: (name, value) => {
        res.headers[name] = value;
      },
      end: (data) => {
        if (data) {
          res.body = Buffer.concat([res.body, Buffer.from(data)]);
        }
        resolve(res);
      },
    };
    server.emit('request', req, res);
  });
}

// Test suite for server.mjs using node:test

describe('server.mjs', () => {
  // 1. HTTP server local random port verify /200 html
  test('HTTP server /200 html', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'GET', '/');
    assert.equal(res.statusCode, 200, 'Root should return 200');
    assert.ok(res.headers['Content-Type'], 'Should have Content-Type header');
    assert.ok(res.headers['Content-Type'].includes('text/html'), 'Content-Type should be text/html');
  });

  // 2. MJS content type
  test('MJS content type', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'GET', '/hearing.mjs');
    assert.equal(res.statusCode, 200, 'hearing.mjs should return 200');
    assert.ok(res.headers['Content-Type'], 'Should have Content-Type header');
    assert.ok(res.headers['Content-Type'].includes('text/javascript'), 'Content-Type should be text/javascript');
  });

  // 3. SVG content type with actual file
  test('SVG content type with actual /art/seal.svg', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'GET', '/art/seal.svg');
    assert.equal(res.statusCode, 200, 'SVG should return 200');
    assert.ok(res.headers['Content-Type'], 'Should have Content-Type header');
    assert.ok(res.headers['Content-Type'].includes('image/svg+xml'), 'Content-Type should be image/svg+xml');
  });

  // 4. HEAD method
  test('HEAD method', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'HEAD', '/index.html');
    assert.equal(res.statusCode, 200, 'HEAD should return 200');
    assert.ok(res.headers['Content-Type'], 'Should have Content-Type header');
    assert.equal(res.body.length, 0, 'HEAD response should have no body');
  });

  // 5. Unsupported methods 405
  test('unsupported methods 405', async () => {
    const server = createFrontendServer();
    const methods = ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

    for (const method of methods) {
      const res = await makeRequest(server, method, '/index.html');
      assert.equal(res.statusCode, 405, `${method} should return 405`);
      assert.ok(res.headers['Allow'], 'Should have Allow header');
      assert.equal(res.headers['Allow'], 'GET, HEAD', 'Allow header should be GET, HEAD');
    }
  });

  // 6. No .env access 404
  test('no .env access 404', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'GET', '/.env');
    assert.equal(res.statusCode, 404, '.env should return 404');
  });

  // 7. No package.json access 404
  test('no package.json access 404', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'GET', '/package.json');
    assert.equal(res.statusCode, 404, 'package.json should return 404');
  });

  // 8. No backend access 404
  test('no backend access 404', async () => {
    const server = createFrontendServer();
    const backendPaths = ['/backend', '/api', '/server.mjs', '/../server.mjs', '/../../package.json'];

    for (const path of backendPaths) {
      const res = await makeRequest(server, 'GET', path);
      assert.equal(res.statusCode, 404, `${path} should return 404`);
    }
  });

  // 9. Encoded traversal denied
  test('encoded traversal denied', async () => {
    const server = createFrontendServer();
    const encodedPaths = [
      '/%2e%2e%2fserver.mjs',
      '/%2e%2e/%2e%2e/server.mjs',
      '/.hidden',
      '/%2ehidden',
      '/%2fetc%2fpasswd',
    ];

    for (const path of encodedPaths) {
      const res = await makeRequest(server, 'GET', path);
      assert.equal(res.statusCode, 404, `Encoded path ${path} should return 404`);
    }
  });

  // 10. Malformed URI 400
  test('malformed URI 400', async () => {
    const server = createFrontendServer();
    const malformedPaths = ['/%', '/%ZZ', '/%2'];

    for (const path of malformedPaths) {
      const res = await makeRequest(server, 'GET', path);
      assert.equal(res.statusCode, 400, `Malformed path ${path} should return 400`);
    }
  });

  // 11. Nonexistent file 404
  test('nonexistent file 404', async () => {
    const server = createFrontendServer();
    const nonexistentPaths = [
      '/nonexistent.html',
      '/nonexistent.mjs',
      '/nonexistent.svg',
      '/nonexistent.css',
      '/path/to/nonexistent',
    ];

    for (const path of nonexistentPaths) {
      const res = await makeRequest(server, 'GET', path);
      assert.equal(res.statusCode, 404, `Nonexistent path ${path} should return 404`);
    }
  });

  // 12. CSP header self-only
  test('CSP header self-only', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'GET', '/index.html');
    assert.ok(res.headers['Content-Security-Policy'], 'Should have CSP header');
    const csp = res.headers['Content-Security-Policy'];
    assert.ok(csp.includes("'self'"), 'CSP should include self');
    assert.ok(csp.includes("default-src 'self'"), 'CSP should have default-src self');
    assert.ok(csp.includes("script-src 'self'"), 'CSP should have script-src self');
    assert.ok(csp.includes("style-src 'self'"), 'CSP should have style-src self');
    assert.ok(csp.includes("img-src 'self' data:"), 'CSP should have img-src self data:');
    assert.ok(csp.includes("font-src 'self'"), 'CSP should have font-src self');
    assert.ok(csp.includes("connect-src 'self'"), 'CSP should have connect-src self');
    assert.ok(csp.includes("object-src 'none'"), 'CSP should have object-src none');
    assert.ok(csp.includes("base-uri 'none'"), 'CSP should have base-uri none');
    assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP should have frame-ancestors none');
    assert.ok(!csp.includes('http:') && !csp.includes('https:'), 'CSP should not allow external sources');
    assert.ok(!csp.includes('*'), 'CSP should not have wildcard');
  });

  // 13. Security headers
  test('security headers', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'GET', '/index.html');
    assert.ok(res.headers['X-Content-Type-Options'], 'Should have X-Content-Type-Options header');
    assert.equal(res.headers['X-Content-Type-Options'], 'nosniff', 'X-Content-Type-Options should be nosniff');

    assert.ok(res.headers['Referrer-Policy'], 'Should have Referrer-Policy header');
    assert.equal(res.headers['Referrer-Policy'], 'no-referrer', 'Referrer-Policy should be no-referrer');
  });

  // 14. Cache-Control header
  test('Cache-Control header', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'GET', '/index.html');
    assert.ok(res.headers['Cache-Control'], 'Should have Cache-Control header');
    assert.equal(res.headers['Cache-Control'], 'no-cache', 'Cache-Control should be no-cache');
  });

  // 15. Content-Type for various extensions
  test('Content-Type for various extensions', async () => {
    const server = createFrontendServer();
    const res = await makeRequest(server, 'GET', '/index.html');
    assert.equal(res.headers['Content-Type'], 'text/html; charset=utf-8', 'Content-Type for .html should be text/html; charset=utf-8');
  });
});
