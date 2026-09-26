# Design Lab

A small, local Low-Level Design practice platform: choose a problem, capture a design, submit it, inspect evidence-based review prompts, and make a linked revision.

Built for a two-day engineering assignment. The emphasis is domain behaviour and the learner's revision loop. **Feedback is deterministic and heuristic, not LLM-generated and not a correctness grade.**

## Run

Requires **Node.js 22.16+** with `node:sqlite` available (verified with 22.16.0). No packages, API keys, accounts, or build step are needed.

```sh
node src/server.js
```

Open [http://localhost:3000](http://localhost:3000). Stop with Ctrl+C. `npm start` is equivalent; use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`.

```sh
node --test
npm run check
```

Node 22 prints an experimental SQLite warning; this is expected. The prototype binds to `127.0.0.1` and accepts localhost hosts only. Run **one server process per database**. Saved data lives in `data/design-lab.sqlite`, which is created automatically and excluded from version control. Do not place a live SQLite database on a network share; if this checkout is cloud-synced, point `DB_PATH` to an existing, non-synced directory for regular use.

Optional environment variables: `PORT` (default `3000`), `DB_PATH` (default `data/design-lab.sqlite`; its parent directory must already exist). For example in PowerShell:

```powershell
$env:PORT = '3001'
$env:DB_PATH = "$env:LOCALAPPDATA/design-lab.sqlite"
node src/server.js
```

## Five-minute demo

1. Open the problem library. Choose Parking Lot, Vending Machine, or Library Lending.
2. For a quick walkthrough, use **Explore a sample attempt**. This creates a real Parking Lot draft with deliberate gaps, not a fake review.
3. Submit the sample. The page briefly shows queued / reviewing, then a rule-based review with three suggested next steps and six review areas.
4. Inspect a quoted phrase and its explanation. Observe the explicit distinction between a text signal and design quality.
5. Choose **Revise this design**. Add failure handling, a reasoned trade-off, and a Given / When / Then test. Save and submit.
6. Open **What changed** to compare against the parent, then **My attempts** to revisit both immutable submissions. Refresh to demonstrate persistence.

Use **Save draft** or Ctrl/Cmd+S. In-app navigation also tries to save a dirty draft; closing or reloading an unsaved draft triggers the browser's warning. This is explicit saving, not continuous autosave. A stale save from another tab is rejected rather than silently overwriting newer work.

To demonstrate failure and retry interactively, run `node scripts/demo-failure.js` and open [http://localhost:3001](http://localhost:3001). This separate in-memory demo fails its first review; **Retry evaluation** then succeeds. Its attempts disappear when that demo stops.

## Deliverables

| Requirement | Where to look |
| --- | --- |
| Research note (about 2 pages) | [docs/RESEARCH.md](docs/RESEARCH.md) |
| MVP, domain model, evaluation, trade-offs | [docs/DESIGN.md](docs/DESIGN.md) |
| Working prototype | `src/` + `public/` |
| Behaviour and failure tests | `tests/` — run `node --test` |
| Meaningful AI-assisted decisions | [AI_USAGE.md](AI_USAGE.md) |
| Demo and submission checklist | [docs/SUBMISSION.md](docs/SUBMISSION.md) |
| Verification record | [docs/TESTING.md](docs/TESTING.md) |

## Implementation map

```text
src/
  domain.js       Attempt aggregate, domain errors, submission format adapter
  problems.js     Three authored, versioned problem briefs
  repository.js   SQLite repository, optimistic concurrency
  evaluation.js   Evaluator contract, heuristic implementation, output validation, comparison
  service.js      Practice use cases and asynchronous evaluation worker
  server.js       HTTP composition root and static assets
public/
  app.js          Browser UI, draft saving, polling, review and history
  styles.css      Responsive layout, focus states, reduced-motion support
tests/            Domain, evaluator, persistence, worker and HTTP tests
scripts/
  demo-failure.js  Isolated, deliberately failing evaluator for demonstration
```

## Key decisions and limits

- A structured text notebook elicits assumptions, responsibilities, relationships, a walkthrough, trade-offs, and tests. Optional code is displayed as text and never executed.
- The evaluator uses field-specific English word/phrase checks. It returns exact excerpts, qualified explanations, and problem-specific prompts. It can produce false positives and false negatives; it does **not** understand semantics, prove invariants, grade SOLID, or replace a knowledgeable reviewer.
- No overall score, pattern-count reward, leaderboard, canonical answer, or simulated AI response. The UI explicitly calls it a rule-based review.
- An `Evaluator` structural interface and format adapter isolate extension points. A real LLM integration is intentionally not included; the design note explains its boundaries and validation requirements.
- SQLite stores drafts, submitted snapshots, statuses, run tokens and reviews. One in-process worker picks durable queued attempts; timeouts/failures preserve the solution and offer retry. In-flight work interrupted by restart becomes a retryable failure.
- This is a **single-learner local prototype**, without authentication or user isolation. Do not expose it publicly as a multi-user service. An authenticated deployment and semantic evaluation would be the next product increments, not hidden capabilities of this MVP.
- Submission format is structured text only; diagrams are textual notes. No code execution, diagram parsing, LMS features, real payments, or distributed infrastructure.
- Storage uses JSON records with a version column for compactness. History currently loads all attempts; SQL columns/indexes and pagination are straightforward follow-ups if usage warrants them.

## API at a glance

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/problems` | Catalog with briefs and scenarios |
| GET / POST | `/api/attempts` | List summaries / create a draft (`problemId`, optional `parentId`) |
| GET | `/api/attempts/:id` | Snapshot, feedback, parent comparison |
| PUT | `/api/attempts/:id` | Save `solution` with expected `version` |
| POST | `/api/attempts/:id/submit` | Validate and enqueue with expected `version` |
| POST | `/api/attempts/:id/retry` | Retry a failed evaluation, preserving the submission |

All write requests use JSON. Missing resources return 404, invalid format 400, missing meaningful submission content 422, stale/illegal transitions 409. Duplicate submits return the existing attempt without launching a second evaluation.
