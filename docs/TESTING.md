# Verification record

Verified on 25 September 2026 with Windows, Node.js 22.16.0, SQLite through `node:sqlite`, and the Codex in-app browser. No external evaluator credentials were used.

## Automated checks

`node --test`: **29 tests passed, 0 failed**.

| Suite | Tests | Important behaviour |
| --- | ---: | --- |
| Domain | 7 | Legal transitions, submission immutability, short/empty input, optional fields, format limits, fresh retry tokens, isolated revision copies |
| Evaluation | 8 | Exact evidence, missing sections, word boundaries, no pattern-name reward, explicit negation limitation, all catalog scenarios, invalid provider output, version-aware comparison |
| HTTP | 5 | End-to-end journey, status/error codes, malformed and oversized JSON, static-file allowlist/CSP, cross-origin and Host rejection |
| Service / storage / worker | 9 | Duplicate submit, stale saves, retry after provider error, timeout/late result, invalid response, queue draining, revision comparison, missing IDs, restart persistence/recovery |

`npm run check`: syntax checks passed for the server entry point and browser module. The automated tests import and execute the domain, service, storage and evaluation modules.

The original test run had 27 passing tests and two harness failures. Node fetch rewrote a custom Host header, so that test now uses `node:http`; Windows required closing SQLite before removing the temporary database directory. The rerun passed all tests. Temporary storage paths are checked before recursive test cleanup.

## Browser checks performed

- Opened the library, checked the three problem cards and first-use empty history.
- Created the supplied sample and submitted it; observed queued status.
- Used the isolated failure demo to verify a failed review preserves the read-only submitted text and displays a retry button.
- Retried and inspected the completed review: six areas, exact quotes, three actionable priorities, and a visible heuristic limitation.
- Created a revision, edited failure behaviour/trade-offs/tests, saved, reloaded, and submitted.
- Verified comparison marks exactly those three areas as changed while the parent remains available.
- Verified attempt history contains the parent and child and filters to an empty state for a different problem.
- At a 390 × 844 mobile viewport, inspected the library and checked that both the library and editor have no horizontal document overflow (375 px content width with scrollbar).
- Confirmed an empty mobile form has three invalid required fields and cannot submit.
- Filled just the assumptions, navigated to history, and verified the incomplete draft was saved and listed.
- Inspected browser logs during the core flow; no warnings or errors were recorded at that check.

Browser checks were performed interactively, not through a checked-in Playwright test suite. They are smoke tests, not a claim of a full accessibility audit or coverage of every device/browser. The semantic effectiveness of the heuristic review remains unvalidated; the research note proposes a learner study.

## Reproduce the failure case

```sh
node scripts/demo-failure.js
```

Open `http://localhost:3001`, load the sample, and submit. The first evaluation intentionally fails. Retry to receive a completed review. The demo uses in-memory storage and does not alter the normal app's database.
