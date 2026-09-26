import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApplication } from '../src/server.js';
import { completeSolution, waitFor } from './helpers.js';

async function setup(t) {
  const app = createApplication({ workerOptions: { delayMs: 1 } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  return { ...app, base, request };
}
test('HTTP journey: catalog → draft → save → submit → feedback → revision → history', async t => {
  const { request } = await setup(t);
  assert.equal((await request('/api/problems')).body.length, 3);
  let result = await request('/api/attempts', 'POST', { problemId: 'parking-lot' }); assert.equal(result.status, 201);
  let a = result.body;
  result = await request(`/api/attempts/${a.id}`, 'PUT', { solution: completeSolution, version: a.version }); assert.equal(result.status, 200); a = result.body;
  result = await request(`/api/attempts/${a.id}/submit`, 'POST', { version: a.version }); assert.equal(result.status, 202);
  const reviewed = await waitFor(async () => { const r = await request(`/api/attempts/${a.id}`); return r.body.status === 'completed' ? r.body : null; });
  assert.equal(reviewed.feedback.findings.length, 6);
  result = await request('/api/attempts', 'POST', { problemId: 'parking-lot', parentId: a.id }); assert.equal(result.status, 201);
  assert.deepEqual(result.body.solution, completeSolution);
  assert.equal((await request('/api/attempts')).body.length, 2);
});
test('API returns useful statuses for empty submission, stale save and unknown resource', async t => {
  const { request } = await setup(t);
  const { body: a } = await request('/api/attempts', 'POST', { problemId: 'parking-lot' });
  assert.equal((await request(`/api/attempts/${a.id}/submit`, 'POST', { version: 0 })).status, 422);
  assert.equal((await request(`/api/attempts/${a.id}`, 'PUT', { version: 999, solution: {} })).status, 409);
  assert.equal((await request('/api/attempts/missing')).status, 404);
  assert.equal((await request('/api/attempts', 'POST', { problemId: null })).status, 400);
});
test('malformed JSON, wrong media type and large payloads are rejected', async t => {
  const { base } = await setup(t);
  for (const [body, type, status] of [['{', 'application/json', 400], ['{}', 'text/plain', 415], ['x'.repeat(110001), 'application/json', 413], ['null', 'application/json', 400]]) {
    const response = await fetch(`${base}/api/attempts`, { method: 'POST', headers: { 'Content-Type': type }, body });
    assert.equal(response.status, status);
  }
});
test('static allowlist prevents source/database exposure; page applies CSP', async t => {
  const { base, request } = await setup(t);
  const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /Design Lab/);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  for (const route of ['/src/server.js', '/data/design-lab.sqlite', '/package.json', '/.env']) assert.equal((await request(route)).status, 404);
  assert.equal((await fetch(`${base}/styles.css`)).status, 200);
});
test('cross-site writes and untrusted Host headers are denied', async t => {
  const { base } = await setup(t);
  const response = await fetch(`${base}/api/attempts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' }, body: '{"problemId":"parking-lot"}' });
  assert.equal(response.status, 403);
  // fetch rewrites Host; use the HTTP transport to exercise the actual header boundary.
  const reboundStatus = await new Promise((resolve, reject) => {
    http.get(`${base}/api/problems`, { headers: { Host: 'untrusted.example' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(reboundStatus, 403);
});
