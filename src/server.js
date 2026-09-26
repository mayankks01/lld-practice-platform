import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteAttemptRepository } from './repository.js';
import { PracticeService, EvaluationWorker } from './service.js';
import { HeuristicEvaluator } from './evaluation.js';
import { DomainError } from './domain.js';
import { problems } from './problems.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };

async function jsonBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new DomainError('Use application/json.', 415);
  let bytes = 0; const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 110000) throw new DomainError('Request is too large.', 413);
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new DomainError('Provide a valid JSON object.'); }
}

export function createApplication({ dbPath = ':memory:', evaluator = new HeuristicEvaluator(), workerOptions = {} } = {}) {
  const repo = new SqliteAttemptRepository(dbPath);
  const worker = new EvaluationWorker(repo, evaluator, workerOptions);
  const service = new PracticeService(repo, worker);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    try {
      // Local single-learner app: reject cross-site mutation and DNS-rebinding hostnames.
      const host = req.headers.host ?? '';
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) throw new DomainError('This prototype is available on localhost only.', 403);
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin && req.headers.origin !== `http://${host}`) throw new DomainError('Cross-site requests are not allowed.', 403);
      const url = new URL(req.url, `http://${host}`);
      const route = url.pathname;
      if (req.method === 'GET' && assets[route]) {
        const [file, type] = assets[route];
        const content = await readFile(path.join(root, 'public', file));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' }); return res.end(content);
      }
      if (req.method === 'GET' && route === '/api/problems') return send(200, problems);
      if (req.method === 'GET' && route === '/api/attempts') return send(200, repo.list().map(a => ({ id: a.id, problemId: a.problemId, parentId: a.parentId, status: a.status, createdAt: a.createdAt, updatedAt: a.updatedAt, submittedAt: a.submittedAt, evaluationCount: a.evaluationCount })));
      if (req.method === 'POST' && route === '/api/attempts') {
        const body = await jsonBody(req); return send(201, service.create(body.problemId, body.parentId));
      }
      const match = route.match(/^\/api\/attempts\/([\w-]+)(?:\/(submit|retry))?$/);
      if (match) {
        const [, id, action] = match;
        if (req.method === 'GET' && !action) return send(200, service.detail(id));
        if (req.method === 'PUT' && !action) { const body = await jsonBody(req); return send(200, service.save(id, body.solution, body.version)); }
        if (req.method === 'POST' && action === 'submit') { const body = await jsonBody(req); return send(202, service.submit(id, body.version)); }
        if (req.method === 'POST' && action === 'retry') { await jsonBody(req); return send(202, service.retry(id)); }
      }
      throw new DomainError('Page or endpoint not found.', 404);
    } catch (error) {
      if (!(error instanceof DomainError)) console.error(error);
      if (!res.headersSent) send(error.status ?? 500, { error: error instanceof DomainError ? error.message : 'Something went wrong. Please try again.' });
      else res.end();
    }
  });
  worker.recover();
  return { server, repo, worker, service, async close() { worker.stop(); await new Promise(resolve => server.close(resolve)); repo.close(); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(path.join(root, 'data'), { recursive: true });
  const app = createApplication({ dbPath: process.env.DB_PATH || path.join(root, 'data', 'design-lab.sqlite') });
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, '127.0.0.1', () => console.log(`Design Lab is ready at http://localhost:${port}`));
  app.server.on('error', error => { console.error(error.message); process.exit(1); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
