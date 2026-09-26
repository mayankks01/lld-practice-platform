import test from 'node:test';
import assert from 'node:assert/strict';
import { Attempt, StructuredTextFormat } from '../src/domain.js';
import { problems } from '../src/problems.js';
import { completeSolution } from './helpers.js';

const format = new StructuredTextFormat();
function draft() { const a = Attempt.create(problems[0]); a.edit(format.normalize(completeSolution)); return a; }

test('a complete attempt follows draft → queued → evaluating → completed', () => {
  const a = draft();
  a.submit(format); assert.equal(a.status, 'queued'); assert.equal(a.evaluationCount, 1);
  assert.ok(a.submittedAt); assert.ok(a.runId);
  a.start(); a.complete({ summary: 'review' }); assert.equal(a.status, 'completed');
});
test('submitted solutions cannot be edited or directly completed', () => {
  const a = draft(); a.submit(format);
  assert.throws(() => a.edit(completeSolution), /expected draft/);
  assert.throws(() => a.complete({}), /expected evaluating/);
});
test('empty, whitespace and short submissions are rejected without changing status', () => {
  for (const value of ['', ' '.repeat(100), 'short']) {
    const a = draft(); a.solution.walkthrough = value;
    assert.throws(() => a.submit(format), /walkthrough/); assert.equal(a.status, 'draft');
  }
});
test('optional sections can be empty; draft does not require submission completeness', () => {
  const a = Attempt.create(problems[0]); a.edit(format.normalize({ assumptions: 'unfinished' }));
  assert.equal(a.solution.code, ''); assert.equal(a.status, 'draft');
  const b = draft(); b.solution.tests = ''; b.solution.tradeoffs = ''; b.submit(format);
  assert.equal(b.status, 'queued');
});
test('format rejects arrays, non-text fields and excessive field length', () => {
  for (const input of [null, [], { tests: 3 }, { code: 'x'.repeat(12001) }]) assert.throws(() => format.normalize(input));
  assert.equal(format.normalize({ tests: 'a\r\nb' }).tests, 'a\nb');
});
test('failed evaluations retry with a fresh token and preserved solution', () => {
  const a = draft(); a.submit(format); const token = a.runId; const snapshot = structuredClone(a.solution);
  a.start(); a.fail('Temporary failure'); a.retry();
  assert.notEqual(a.runId, token); assert.equal(a.error, null); assert.equal(a.evaluationCount, 2);
  assert.deepEqual(a.solution, snapshot); assert.throws(() => a.retry(), /expected failed/);
});
test('revision deep-copies solution and problem snapshot without changing parent', () => {
  const parent = draft(); parent.submit(format); parent.start(); parent.complete({});
  const child = Attempt.create(problems[0], parent); child.solution.tests = 'new test'; child.problemSnapshot.title = 'changed';
  assert.equal(child.parentId, parent.id); assert.notEqual(child.id, parent.id); assert.equal(child.status, 'draft');
  assert.equal(parent.solution.tests, completeSolution.tests); assert.equal(parent.problemSnapshot.title, 'Parking Lot');
});
