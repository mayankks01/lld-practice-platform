import { randomUUID } from 'node:crypto';

export class DomainError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const fields = ['assumptions', 'responsibilities', 'relationships', 'walkthrough', 'tradeoffs', 'tests', 'code'];

/** A format adapter validates and normalizes input; evaluators consume its canonical output. */
export class StructuredTextFormat {
  id = 'structured-text-v1';
  normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new DomainError('A solution object is required.');
    const result = {};
    for (const key of fields) {
      const value = input[key] ?? '';
      if (typeof value !== 'string') throw new DomainError(`${key} must be text.`);
      if (value.length > 12000) throw new DomainError(`${key} must be at most 12,000 characters.`);
      result[key] = value.replace(/\r\n/g, '\n');
    }
    return result;
  }
  validateSubmission(solution) {
    for (const key of ['assumptions', 'responsibilities', 'walkthrough']) {
      if (solution[key].trim().length < 30) throw new DomainError(`Add at least 30 characters to ${key} so the review has context.`, 422);
    }
  }
}

/** Aggregate root: owns legal transitions and freezes the submitted solution. */
export class Attempt {
  constructor(record) { Object.assign(this, structuredClone(record)); }
  static create(problem, parent = null) {
    const now = new Date().toISOString();
    return new Attempt({
      id: randomUUID(), problemId: problem.id, problemSnapshot: problem, parentId: parent?.id ?? null,
      format: 'structured-text-v1', status: 'draft', version: 0, createdAt: now, updatedAt: now,
      submittedAt: null, solution: parent ? parent.solution : Object.fromEntries(fields.map(f => [f, ''])),
      feedback: null, error: null, runId: null, evaluationCount: 0
    });
  }
  edit(solution) {
    this.require('draft');
    this.solution = solution;
    this.touch();
  }
  submit(format) {
    this.require('draft');
    format.validateSubmission(this.solution);
    this.submittedAt = new Date().toISOString();
    this.queue();
  }
  retry() { this.require('failed'); this.queue(); }
  queue() {
    this.status = 'queued'; this.error = null; this.runId = randomUUID(); this.evaluationCount++;
    this.touch();
  }
  start() { this.require('queued'); this.status = 'evaluating'; this.touch(); }
  complete(feedback) { this.require('evaluating'); this.status = 'completed'; this.feedback = feedback; this.touch(); }
  fail(message) { this.require('queued', 'evaluating'); this.status = 'failed'; this.error = message; this.touch(); }
  require(...states) {
    if (!states.includes(this.status)) throw new DomainError(`This attempt is ${this.status}; expected ${states.join(' or ')}.`, 409);
  }
  touch() { this.version++; this.updatedAt = new Date().toISOString(); }
  toJSON() { return { ...this }; }
}
