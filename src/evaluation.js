/**
 * @typedef {{id:string, title:string, status:'signal'|'review', field:string,
 * evidence:string|null, explanation:string, action:string}} Finding
 * @typedef {{evaluate: (problem:object, solution:object, context:{signal:AbortSignal}) => Promise<object>}} Evaluator
 * Evaluator is a structural interface. Neither the worker nor the aggregate knows its implementation.
 */

function evidence(text, regex) {
  // Return an exact bounded excerpt; never fabricate a quote or label absence as a proven defect.
  for (const line of text.split('\n')) {
    const match = line.match(regex);
    if (match) {
      const start = Math.max(0, match.index - 70);
      return line.slice(start, start + 260);
    }
  }
  return null;
}
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reproducible review prompts, not a semantic judge or an AI imitation. */
export class HeuristicEvaluator {
  async evaluate(problem, solution) {
    const specs = [
      {
        id: 'ownership', title: 'Responsibility ownership', field: 'responsibilities',
        pattern: /\b(owns?|responsible|manages?|validates?|calculates?|tracks?|allocates?|protects?|issues?|handles?)\b/i,
        why: 'An explicit owner makes it possible to reason about where a rule belongs. A verb alone cannot establish cohesion.',
        action: 'Name the object that protects each business rule. Split responsibilities only where there is a separate reason to change.'
      },
      {
        id: 'collaboration', title: 'Object collaboration', field: 'relationships',
        pattern: /\b(calls?|uses?|contains?|delegates?|depends|implements?|has|compos\w*|references?)\b|->|→/i,
        why: 'A relationship should explain who calls whom and who owns the data. This check only locates relationship language.',
        action: 'Write one interaction as Caller → method(arguments) → result. State whether the referenced object is owned or shared.'
      },
      {
        id: 'lifecycle', title: 'State & lifecycle', field: 'walkthrough',
        pattern: new RegExp(`\\b(${problem.lifecycleTerms.map(escapeRegex).join('|')})\\b`, 'i'),
        why: 'State changes are where invariants can break. Mentioning a state is a starting point; transition correctness still needs a review.',
        action: 'Walk through the state before and after each operation. Specify which object may change it and when changes become final.'
      },
      {
        id: 'edge-cases', title: 'Failure behaviour', field: 'walkthrough',
        pattern: new RegExp(`\\b(${problem.edgeTerms.map(escapeRegex).join('|')})\\b`, 'i'),
        why: 'A failure path should leave the system in a valid state. A matching term may be a denial or an incomplete explanation.',
        action: problem.scenario
      },
      {
        id: 'tradeoffs', title: 'Reasoned trade-offs', field: 'tradeoffs',
        pattern: /\b(because|instead|trade-?off|simpler|however|cost|although|but|versus)\b/i,
        why: 'A useful design explains why a choice fits its constraints. There is no required pattern or canonical class hierarchy.',
        action: `${problem.change} Explain one alternative you considered and the cost of your choice.`
      },
      {
        id: 'testability', title: 'Observable tests', field: 'tests',
        pattern: /\b(given|when|then|expect|assert|should|verify)\b/i,
        why: 'Test descriptions should pair an input with an observable outcome. This check does not execute or verify the submitted code.',
        action: 'Write a happy-path and a failure-path test as Given / When / Then. Assert both the returned result and unchanged state on failure.'
      }
    ];
    const findings = specs.map(s => {
      const quote = evidence(solution[s.field], s.pattern);
      return { id: s.id, title: s.title, field: s.field, status: quote ? 'signal' : 'review', evidence: quote,
        explanation: quote ? `A relevant phrase was found. ${s.why}` : `No matching phrase was found in this section. This may be a wording difference. ${s.why}`,
        action: s.action };
    });
    const priorities = [...findings.filter(f => f.status === 'review'), ...findings.filter(f => f.status === 'signal')].slice(0, 3).map(f => f.id);
    return {
      evaluator: 'heuristic-v1', rubricVersion: '2026-09-25',
      summary: 'Use these six review prompts to inspect your design. Signals reflect wording in your notes, not a correctness score.',
      limitation: 'Deterministic text checks can miss synonyms, accept contradictory statements, and cannot assess SOLID, correctness, or code quality. No LLM was used.',
      findings, priorities, reviewedAt: new Date().toISOString()
    };
  }
}

/** Validate every provider response before it becomes durable learner feedback. */
export function validateFeedback(feedback, solution) {
  const fail = () => { throw new Error('Evaluator returned invalid feedback.'); };
  if (!feedback || typeof feedback !== 'object') fail();
  for (const key of ['evaluator', 'rubricVersion', 'summary', 'limitation', 'reviewedAt']) {
    if (typeof feedback[key] !== 'string' || !feedback[key] || feedback[key].length > 4000) fail();
  }
  if (!Array.isArray(feedback.findings) || feedback.findings.length < 1 || feedback.findings.length > 12) fail();
  const ids = new Set();
  for (const f of feedback.findings) {
    if (!f || typeof f !== 'object') fail();
    for (const key of ['id', 'title', 'field', 'explanation', 'action']) if (typeof f[key] !== 'string' || !f[key] || f[key].length > 4000) fail();
    if (ids.has(f.id) || !Object.hasOwn(solution, f.field) || !['signal', 'review'].includes(f.status)) fail();
    ids.add(f.id);
    if (f.evidence !== null && (typeof f.evidence !== 'string' || !f.evidence || f.evidence.length > 1000 || !solution[f.field].includes(f.evidence))) fail();
    if (f.status === 'signal' && !f.evidence) fail();
  }
  if (!Array.isArray(feedback.priorities) || feedback.priorities.length > 3 || feedback.priorities.some(id => !ids.has(id))) fail();
  return feedback;
}

export function compareFeedback(current, previous) {
  if (!previous || current.evaluator !== previous.evaluator || current.rubricVersion !== previous.rubricVersion) return null;
  return current.findings.map(f => {
    const before = previous.findings.find(p => p.id === f.id);
    return { id: f.id, title: f.title, before: before?.status ?? 'unavailable', after: f.status, changed: before?.status !== f.status };
  });
}
