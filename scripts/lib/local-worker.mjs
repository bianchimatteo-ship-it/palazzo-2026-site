// The Cloudflare setup, in process, for the tests that need the real thing without touching it: worker.js answers /api/*, everything else is a static asset from the project
// folder (as with Workers static assets), the KV namespace and the D1 database are stand-ins with the same interface (a Map and an in-memory SQLite). Nothing here reaches the
// network, the production archive or a real account. Port 8791 is the one the game reads as "the local Worker preview" (src/data/repositories/admin-sync.js).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

export function createStandIns() {
  const kvData = new Map();
  const kv = {
    async get(key, type) { const entry = kvData.get(key); if (!entry || (entry.expires && entry.expires < Date.now())) return null; return type === 'json' ? JSON.parse(entry.value) : entry.value; },
    async put(key, value, options = {}) { kvData.set(key, { value: String(value), expires: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null }); },
    async delete(key) { kvData.delete(key); },
    async list({ prefix = '' } = {}) { return { keys: [...kvData.keys()].filter(name => name.startsWith(prefix)).map(name => ({ name })) }; }
  };
  const sqlite = new DatabaseSync(':memory:');
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...params) })
  });
  const d1 = { prepare: sql => statement(sql), batch: async list => Promise.all(list.map(item => item.run())), exec: async sql => sqlite.exec(sql) };
  return { kv, kvData, sqlite, d1 };
}

// Serves the project folder (with the headers of `_headers`, as Cloudflare would) and the Worker on `port` (127.0.0.1). Returns { origin, env, kvData, sqlite, close }.
export async function startLocalWorker({ port = 8791, root = fileURLToPath(new URL('../..', import.meta.url)), setupCode = 'attivazione-di-prova' } = {}) {
  const { kv, kvData, sqlite, d1 } = createStandIns();
  const worker = (await import(`../../worker.js?local=${port}-${Date.now()}`)).default;
  // What Workers static assets would not publish: the patterns of .assetsignore (gitignore style: a name without a slash matches at any depth, `**/name`, `*.ext`, `dir/file`).
  const ignoreRules = (await readFile(join(root, '.assetsignore'), 'utf8').catch(() => '')).split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const ignored = pathname => {
    const parts = pathname.replace(/^\//, '').split('/');
    return ignoreRules.some(rule => {
      const name = rule.replace(/^\*\*\//, '');
      if (name.startsWith('*.')) return parts.at(-1).endsWith(name.slice(1));
      if (!name.includes('/')) return parts.includes(name);
      return pathname.replace(/^\//, '') === name || pathname.replace(/^\//, '').startsWith(`${name}/`);
    });
  };
  // The headers Workers static assets add from `_headers` (Cloudflare format: a path pattern, then indented `Name: value` lines; `/*` is every path; the values of rules that match merge in order).
  const headerRules = [];
  for (const line of (await readFile(join(root, '_headers'), 'utf8').catch(() => '')).split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) headerRules.push({ pattern: line.trim(), headers: [] });
    else { const index = line.indexOf(':'); if (headerRules.length && index > 0) headerRules.at(-1).headers.push([line.slice(0, index).trim(), line.slice(index + 1).trim()]); }
  }
  const publishedHeaders = pathname => {
    const out = {};
    for (const rule of headerRules) {
      const matches = rule.pattern === '/*' || rule.pattern === pathname || (rule.pattern.endsWith('/*') && pathname.startsWith(rule.pattern.slice(0, -1)));
      if (matches) for (const [name, value] of rule.headers) out[name.toLowerCase()] = out[name.toLowerCase()] ? `${out[name.toLowerCase()]}, ${value}` : value;
    }
    return out;
  };
  const readAsset = async pathname => {
    if (ignored(pathname)) return null;
    const path = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
    if (!path.startsWith(root)) return null;
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) return null;
    return new Response(await readFile(path), { headers: { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store', ...publishedHeaders(pathname === '/' ? '/index.html' : pathname) } });
  };
  const env = {
    ADMIN_ARCHIVE: kv, ACCOUNTS: d1, ADMIN_SETUP_CODE: setupCode,
    ASSETS: { fetch: async request => (await readAsset(decodeURIComponent(new URL(request.url).pathname))) ?? new Response('Not found', { status: 404 }) }
  };
  const origin = `http://127.0.0.1:${port}`;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const headers = new Headers(req.headers);
      headers.set('cf-connecting-ip', req.socket.remoteAddress ?? '127.0.0.1');
      const request = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const response = url.pathname.startsWith('/api/') ? await worker.fetch(request, env) : (await readAsset(decodeURIComponent(url.pathname))) ?? new Response('Not found', { status: 404 });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.writeHead(500, { 'content-type': 'text/plain' }); res.end(String(error?.message ?? error)); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { origin, port, env, kvData, sqlite, worker, close: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }) };
}
