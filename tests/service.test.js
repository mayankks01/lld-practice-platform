import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SqliteAttemptRepository } from '../src/repository.js';
import { PracticeService, EvaluationWorker } from '../src/service.js';
import { HeuristicEvaluator } from '../src/evaluation.js';
import { completeSolution, waitFor } from './helpers.js';

function setup(t, evaluator = new HeuristicEvaluator(), options = {}) {
  const repo = new SqliteAttemptRepository();
  const worker = new EvaluationWorker(repo, evaluator, { delayMs: 1, ...options });
  const service = new PracticeService(repo, worker);
  t.after(() => { worker.stop(); repo.close(); });
  return { repo, worker, service };
}
function submit(service) {
  let a = service.create('parking-lot'); a = service.save(a.id, completeSolution, a.version); return service.submit(a.id, a.version);
}
test('double-submit evaluates once; result and immutable snapshot are stored', async t => {
  let calls = 0;
  const { repo, service } = setup(t, { async evaluate(...args) { calls++; return new HeuristicEvaluator().evaluate(...args); } });
  const a = submit(service); service.submit(a.id, 0); service.submit(a.id, 0);
  await waitFor(() => repo.get(a.id).status === 'completed');
  assert.equal(calls, 1); assert.equal(repo.get(a.id).evaluationCount, 1);
  assert.deepEqual(repo.get(a.id).solution, completeSolution);
  assert.throws(() => service.save(a.id, completeSolution, 0), /expected draft/);
});
test('optimistic locking rejects stale saves without overwriting a newer draft', t => {
  const { repo, service } = setup(t);
  const a = service.create('parking-lot'); service.save(a.id, completeSolution, a.version);
  assert.throws(() => service.save(a.id, { ...completeSolution, tests: 'stale overwrite' }, a.version), /another tab/);
  assert.equal(repo.get(a.id).solution.tests, completeSolution.tests);
  assert.throws(() => service.submit(a.id, a.version), /latest draft/);
});
test('evaluation exception becomes a retryable failure without leaking provider errors', async t => {
  let fail = true;
  const { repo, service } = setup(t, { async evaluate(...args) { if (fail) throw new Error('SECRET_PROVIDER_DETAIL'); return new HeuristicEvaluator().evaluate(...args); } });
  const a = submit(service);
  await waitFor(() => repo.get(a.id).status === 'failed');
  assert.doesNotMatch(repo.get(a.id).error, /SECRET/); fail = false;
  service.retry(a.id); service.retry(a.id);
  await waitFor(() => repo.get(a.id).status === 'completed');
  assert.equal(repo.get(a.id).evaluationCount, 2);
});
test('timeout aborts provider and a late result cannot overwrite failure', async t => {
  let release; let signal;
  const { repo, service } = setup(t, { evaluate(p, s, context) { signal = context.signal; return new Promise(resolve => { release = () => resolve(new HeuristicEvaluator().evaluate(p, s)); }); } }, { timeoutMs: 20 });
  const a = submit(service);
  await waitFor(() => repo.get(a.id).status === 'failed');
  assert.equal(signal.aborted, true); assert.match(repo.get(a.id).error, /too long/);
  release(); await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(repo.get(a.id).status, 'failed'); assert.equal(repo.get(a.id).feedback, null);
});
test('invalid provider output fails safely', async t => {
  const { repo, service } = setup(t, { async evaluate() { return { summary: 'trust me' }; } });
  const a = submit(service); await waitFor(() => repo.get(a.id).status === 'failed');
  assert.equal(repo.get(a.id).feedback, null);
});
test('worker drains several queued attempts', async t => {
  const { repo, service } = setup(t);
  const ids = Array.from({ length: 4 }, () => submit(service).id);
  await waitFor(() => ids.every(id => repo.get(id).status === 'completed'));
  assert.equal(repo.list().length, 4);
});
test('revision links parent and compares meaningful review-area changes', async t => {
  const { repo, service } = setup(t);
  let a = service.create('parking-lot'); a = service.save(a.id, { ...completeSolution, tests: '' }, a.version); service.submit(a.id, a.version);
  await waitFor(() => repo.get(a.id).status === 'completed');
  let child = service.create('parking-lot', a.id); child = service.save(child.id, completeSolution, child.version); service.submit(child.id, child.version);
  await waitFor(() => repo.get(child.id).status === 'completed');
  assert.equal(service.detail(child.id).comparison.find(x => x.id === 'testability').changed, true);
  assert.equal(repo.get(a.id).solution.tests, '');
  assert.throws(() => service.create('library', a.id), /this problem/);
});
test('missing IDs and invalid revision parents fail clearly', t => {
  const { service } = setup(t);
  assert.throws(() => service.create('missing'), /Problem not found/);
  assert.throws(() => service.create({}), /must be text/);
  assert.throws(() => service.detail('missing'), /Attempt not found/);
  const a = service.create('parking-lot');
  assert.throws(() => service.create('parking-lot', a.id), /completed or failed/);
});
test('SQLite survives reopen; restart marks in-flight work failed and resumes queued work', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'design-lab-test-'));
  const dbPath = path.join(directory, 'test.sqlite');
  let repo = new SqliteAttemptRepository(dbPath);
  let worker = new EvaluationWorker(repo, new HeuristicEvaluator(), { delayMs: 60000 });
  const service = new PracticeService(repo, worker);
  const first = submit(service), second = submit(service);
  const inflight = repo.get(first.id); const version = inflight.version; inflight.start(); repo.save(inflight, version);
  worker.stop(); repo.close();
  repo = new SqliteAttemptRepository(dbPath); worker = new EvaluationWorker(repo, new HeuristicEvaluator(), { delayMs: 1 });
  t.after(() => {
    worker.stop(); repo.close();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('design-lab-test-'));
    rmSync(directory, { recursive: true, force: true });
  });
  worker.recover();
  assert.equal(repo.get(first.id).status, 'failed'); assert.match(repo.get(first.id).error, /restarted/);
  assert.deepEqual(repo.get(first.id).solution, completeSolution);
  await waitFor(() => repo.get(second.id).status === 'completed');
});
