import test from 'node:test';
import assert from 'node:assert/strict';
import { HeuristicEvaluator, validateFeedback, compareFeedback } from '../src/evaluation.js';
import { problems } from '../src/problems.js';
import { completeSolution } from './helpers.js';

const evaluator = new HeuristicEvaluator();
test('review contains exact source excerpts and explicitly disclaims semantic correctness', async () => {
  const f = await evaluator.evaluate(problems[0], completeSolution);
  assert.equal(f.findings.length, 6); assert.equal(f.findings.filter(x => x.status === 'signal').length, 6);
  assert.equal(validateFeedback(f, completeSolution), f);
  for (const finding of f.findings) assert.ok(completeSolution[finding.field].includes(finding.evidence));
  assert.match(f.limitation, /cannot assess SOLID/); assert.match(f.limitation, /No LLM/);
});
test('missing sections produce prioritized, problem-specific next steps without a grade', async () => {
  const s = { ...completeSolution, tests: '', tradeoffs: '', walkthrough: 'The main operation succeeds without any detailed explanation.' };
  const f = await evaluator.evaluate(problems[0], s);
  assert.equal(f.findings.find(x => x.id === 'edge-cases').status, 'review');
  assert.equal(f.findings.find(x => x.id === 'edge-cases').action, problems[0].scenario);
  assert.equal(f.priorities.length, 3); assert.ok(!Object.hasOwn(f, 'score'));
  for (const finding of f.findings.filter(x => x.status === 'review')) assert.equal(finding.evidence, null);
});
test('word boundaries do not count unrelated substrings as evidence', async () => {
  const f = await evaluator.evaluate(problems[0], { ...completeSolution, walkthrough: 'A fully featured interface operates freely.', tests: 'The theatre has a theme.' });
  assert.equal(f.findings.find(x => x.id === 'edge-cases').status, 'review');
  assert.equal(f.findings.find(x => x.id === 'testability').status, 'review');
});
test('pattern names are not rewarded', async () => {
  const f = await evaluator.evaluate(problems[0], { ...completeSolution, tradeoffs: 'Strategy Factory Singleton Observer Decorator' });
  assert.equal(f.findings.find(x => x.id === 'tradeoffs').status, 'review');
});
test('negated phrases remain lexical signals and are explicitly qualified', async () => {
  const f = await evaluator.evaluate(problems[0], { ...completeSolution, walkthrough: 'I do not handle a full lot or an invalid ticket.' });
  const finding = f.findings.find(x => x.id === 'edge-cases');
  assert.equal(finding.status, 'signal'); assert.match(finding.explanation, /denial/);
});
test('all catalog problems provide distinct scenario feedback', async () => {
  const actions = [];
  for (const problem of problems) {
    const f = await evaluator.evaluate(problem, completeSolution);
    validateFeedback(f, completeSolution); actions.push(f.findings.find(x => x.id === 'edge-cases').action);
  }
  assert.equal(new Set(actions).size, 3);
});
test('provider validation rejects fabricated evidence, malformed findings, duplicate IDs and bad priorities', async () => {
  const base = await evaluator.evaluate(problems[0], completeSolution);
  for (const mutate of [
    f => { f.findings[0].evidence = 'A fabricated quote'; },
    f => { f.findings[0].status = 'perfect'; },
    f => { f.findings[0].field = '__proto__'; },
    f => { f.findings[0].evidence = null; },
    f => { f.findings.push(f.findings[0]); },
    f => { f.findings[0] = null; },
    f => { f.priorities = ['missing']; },
    f => { f.summary = 123; }
  ]) { const changed = structuredClone(base); mutate(changed); assert.throws(() => validateFeedback(changed, completeSolution), /invalid feedback/); }
});
test('comparison shows signal changes only for the same evaluator and rubric', async () => {
  const before = await evaluator.evaluate(problems[0], { ...completeSolution, tests: '' });
  const after = await evaluator.evaluate(problems[0], completeSolution);
  const diff = compareFeedback(after, before);
  assert.equal(diff.filter(x => x.changed).length, 1); assert.equal(diff.find(x => x.changed).id, 'testability');
  assert.equal(compareFeedback(after, { ...before, rubricVersion: 'different' }), null);
  assert.equal(compareFeedback(after, null), null);
});
