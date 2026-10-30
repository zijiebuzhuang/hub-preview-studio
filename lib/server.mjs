import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validAppURL } from './protocol.js';
export function createStudioServer({ app = '', port = 4177 } = {}) {
  if (app) validAppURL(app);
  const files = new Map([
    ['/', ['../web/index.html', 'text/html']], ['/style.css', ['../web/style.css', 'text/css']],
    ['/app.js', ['../web/app.js', 'text/javascript']], ['/protocol.js', ['./protocol.js', 'text/javascript']],
    ['/client.js', ['./client.js', 'text/javascript']], ['/example/', ['../examples/index.html', 'text/html']],
    ['/example/app.js', ['../examples/app.js', 'text/javascript']],
  ]);
  const server = http.createServer(async (req, res) => {
    const actualPort = server.address()?.port || port;
    if (![`127.0.0.1:${actualPort}`, `localhost:${actualPort}`].includes(req.headers.host)) { res.writeHead(403); res.end('Invalid Host'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    let url;
    try { url = new URL(req.url, 'http://127.0.0.1'); } catch { res.writeHead(400); res.end(); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src http: https:; connect-src 'self'; object-src 'none'; base-uri 'none'");
    if (url.pathname === '/config.json' || url.pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(req.method === 'HEAD' ? '' : JSON.stringify(url.pathname === '/health' ? { tool: 'hub-preview-studio', version: '0.1.0' } : { app })); return;
    }
    const asset = files.get(url.pathname);
    if (!asset) { res.writeHead(404); res.end('Not found'); return; }
    try {
      const bytes = await readFile(fileURLToPath(new URL(asset[0], import.meta.url)));
      res.setHeader('Content-Type', asset[1] + '; charset=utf-8'); res.end(req.method === 'HEAD' ? '' : bytes);
    } catch { res.writeHead(500); res.end('Could not load tool asset'); }
  });
  return server;
}
