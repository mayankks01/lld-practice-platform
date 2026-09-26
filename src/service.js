import { Attempt, DomainError, StructuredTextFormat } from './domain.js';
import { getProblem } from './problems.js';
import { compareFeedback, validateFeedback } from './evaluation.js';

export class PracticeService {
  constructor(repository, worker, format = new StructuredTextFormat()) { this.repo = repository; this.worker = worker; this.format = format; }
  create(problemId, parentId) {
    if (typeof problemId !== 'string' || (parentId != null && typeof parentId !== 'string')) throw new DomainError('Problem and parent IDs must be text.');
    const problem = getProblem(problemId);
    if (!problem) throw new DomainError('Problem not found.', 404);
    const parent = parentId ? this.repo.get(parentId) : null;
    if (parent && (parent.problemId !== problem.id || !['completed', 'failed'].includes(parent.status))) throw new DomainError('Revise a completed or failed attempt of this problem.', 409);
    return this.repo.insert(Attempt.create(problem, parent));
  }
  save(id, solution, expectedVersion) {
    const a = this.repo.get(id);
    if (!Number.isInteger(expectedVersion)) throw new DomainError('A draft version is required.');
    a.edit(this.format.normalize(solution));
    return this.repo.save(a, expectedVersion);
  }
  submit(id, expectedVersion) {
    const a = this.repo.get(id);
    // Repeated submits return the same immutable submission and never enqueue a second evaluation.
    if (a.status !== 'draft') return a;
    if (a.version !== expectedVersion) throw new DomainError('Save the latest draft before submitting.', 409);
    const version = a.version;
    a.submit(this.format); this.repo.save(a, version); this.worker.wake(); return a;
  }
  retry(id) {
    const a = this.repo.get(id);
    if (['queued', 'evaluating'].includes(a.status)) return a;
    const version = a.version; a.retry(); this.repo.save(a, version); this.worker.wake(); return a;
  }
  detail(id) {
    const a = this.repo.get(id);
    const parent = a.parentId ? this.repo.get(a.parentId) : null;
    return { ...a.toJSON(), comparison: a.feedback && parent?.feedback ? compareFeedback(a.feedback, parent.feedback) : null };
  }
}

/** One durable queue in SQLite + one worker in this process. No external broker. */
export class EvaluationWorker {
  constructor(repo, evaluator, { timeoutMs = 10000, delayMs = 150, onError = console.error } = {}) {
    this.repo = repo; this.evaluator = evaluator; this.timeoutMs = timeoutMs; this.delayMs = delayMs;
    this.onError = onError; this.running = false; this.stopped = false; this.timer = null;
  }
  recover() {
    for (const a of this.repo.list().filter(a => a.status === 'evaluating')) {
      const version = a.version;
      a.fail('The app restarted during evaluation. Your submission is safe; retry the review.');
      this.repo.save(a, version);
    }
    this.wake();
  }
  wake() {
    if (this.stopped || this.running || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.drain().catch(this.onError);
    }, this.delayMs);
  }
  async drain() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      while (!this.stopped) {
        const a = this.repo.list().reverse().find(a => a.status === 'queued');
        if (!a) break;
        const version = a.version; a.start(); this.repo.save(a, version);
        const runId = a.runId;
        const controller = new AbortController();
        this.controller = controller;
        let timeout;
        try {
          const feedback = await Promise.race([
            Promise.resolve().then(() => this.evaluator.evaluate(a.problemSnapshot, a.solution, { signal: controller.signal })),
            new Promise((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, this.timeoutMs); })
          ]);
          if (this.stopped) break;
          validateFeedback(feedback, a.solution);
          const latest = this.repo.get(a.id);
          if (latest.runId === runId && latest.status === 'evaluating') {
            const v = latest.version; latest.complete(feedback); this.repo.save(latest, v);
          }
        } catch (error) {
          if (this.stopped) break;
          const latest = this.repo.get(a.id);
          if (latest.runId === runId && latest.status === 'evaluating') {
            const v = latest.version;
            latest.fail(error.message === 'timeout' ? 'Evaluation took too long. Your submission is safe; try again.' : 'Evaluation could not finish. Your submission is safe; try again.');
            this.repo.save(latest, v);
          }
        } finally { clearTimeout(timeout); }
      }
    } finally { this.running = false; }
  }
  stop() { this.stopped = true; clearTimeout(this.timer); this.controller?.abort(); }
}
