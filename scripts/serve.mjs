import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Set(['index.html', 'cloud.js', 'firebase-config.js', 'firebase-client.js', 'sync-model.mjs', 'admin.html', 'admin.js', 'member-model.mjs']);
const root = new URL('../', import.meta.url);
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname.replace(/^\/vocab-card\//, '/');
  const name = path === '/' ? 'index.html' : path.slice(1);
  if (!files.has(name)) { response.writeHead(404); response.end(); return; }
  try {
    const contents = await readFile(new URL(name, root));
    response.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' });
    response.end(contents);
  } catch { response.writeHead(500); response.end(); }
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173/vocab-card/'));
