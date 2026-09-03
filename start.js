#!/usr/bin/env node
/**
 * GeneVault — zero-dependency server with clean URLs
 * ---------------------------------------------------
 *   /              → index.html      (landing page)
 *   /genevault     → genevault.html  (Bio-OS app — no .html needed)
 *   /app           → genevault.html  (short URL, same as Vercel)
 *   /genevault.html                  (also still works)
 *
 * Usage:  node start.js            (port 3000)
 *         node start.js 8080       (custom port)
 *         PORT=8080 node start.js  (env var)
 *
 * No npm install needed — pure Node.js, matches Vercel behavior exactly.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || process.argv[2] || 3000);
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
  '.zkey': 'application/octet-stream',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.sol':  'text/plain; charset=utf-8',
};

/* Clean-URL route table (same as vercel.json rewrites + cleanUrls) */
const ROUTES = {
  '/':            '/index.html',
  '/index':       '/index.html',
  '/app':         '/genevault.html',
  '/genevault':   '/genevault.html',
  '/genevault/':  '/genevault.html',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('400 Bad Request');
  }

  /* security: block path traversal */
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const abs = path.join(ROOT, safe);
  if (!abs.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(abs, (err, st) => {
    if (!err && st.isDirectory()) {
      return serveFile(path.join(ROOT, safe, 'index.html'));
    }
    serveFile(ROUTES[pathname] ? path.join(ROOT, ROUTES[pathname]) : abs);
  });

  function serveFile(absPath) {
    fs.readFile(absPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(
`<!doctype html><html><head><meta charset="utf-8"><title>404 — GeneVault</title></head>
<body style="font-family:system-ui;background:#0a0e1a;color:#e6e9f2;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center">
<h1 style="font-size:80px;margin:0;background:linear-gradient(90deg,#4ade80,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent">404</h1>
<p style="opacity:.7;font-size:18px">This page left no trace — just like your DNA.</p>
<p><a href="/" style="color:#4ade80;font-size:16px">&larr; Back to the vault</a></p>
</div></body></html>`);
      }
      const ext = path.extname(absPath).toLowerCase();
      const immutable = ext === '.wasm' || ext === '.zkey';
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    });
  }
});

server.listen(PORT, () => {
  const row = (r, d) => console.log(`   ${r.padEnd(16)} →  ${d}`);
  console.log(`\n   🧬 GeneVault live →  http://localhost:${PORT}\n`);
  row('/', 'landing page');
  row('/genevault', 'Bio-OS app (clean URL)');
  row('/app', 'Bio-OS app (short URL)');
  console.log(`\n   Stop: Ctrl+C\n`);
});
