// app.js — GeneVault Node.js HTTP Server
// Serves:
//   - "/" -> index.html (Overview Landing Page)
//   - "/genevault" -> genevault.html (Precision Prescribing Studio)
//   - Static assets (.js, .css, .pdb, .txt, .json, etc.)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

// Content type mappings
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdb':  'chemical/x-pdb; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
};

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    }
  });
}

const server = http.createServer((req, res) => {
  // Parse clean pathname
  const cleanUrl = req.url.split('?')[0];

  // Route 1: Home -> index.html
  if (cleanUrl === '/' || cleanUrl === '/home' || cleanUrl === '/index' || cleanUrl === '/index.html') {
    return serveFile(res, path.join(__dirname, 'index.html'), 'text/html; charset=utf-8');
  }

  // Route 2: /genevault -> genevault.html
  if (cleanUrl === '/genevault' || cleanUrl === '/genevault.html' || cleanUrl === '/studio') {
    return serveFile(res, path.join(__dirname, 'genevault.html'), 'text/html; charset=utf-8');
  }

  // Backwards-compatible client script route: /app.js -> genevault_client.js
  if (cleanUrl === '/app.js') {
    return serveFile(res, path.join(__dirname, 'genevault_client.js'), 'text/javascript; charset=utf-8');
  }

  // Static File Serving
  const safePath = path.normalize(cleanUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  serveFile(res, filePath, contentType);
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🧬 GeneVault Precision Pharmacogenomics Bio-OS`);
  console.log(`======================================================`);
  console.log(`🚀 Server listening on port ${PORT}:`);
  console.log(`   - Home (Landing Page) : http://localhost:${PORT}/`);
  console.log(`   - Studio (Prescribing): http://localhost:${PORT}/genevault`);
  console.log(`======================================================\n`);
});
