// Isolated manual demo: intentionally fail exactly one evaluation, then recover on retry.
import { createApplication } from '../src/server.js';
import { HeuristicEvaluator } from '../src/evaluation.js';

let failNext = true;
const delegate = new HeuristicEvaluator();
const app = createApplication({
  evaluator: {
    async evaluate(...args) {
      if (failNext) { failNext = false; throw new Error('Deliberate demonstration failure'); }
      return delegate.evaluate(...args);
    }
  },
  workerOptions: { delayMs: 1500 }
});
app.server.listen(3001, '127.0.0.1', () => console.log('Failure demo: http://localhost:3001 — first review fails; retry succeeds. In-memory storage only.'));
app.server.on('error', error => { console.error(error.message); process.exit(1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
