# Submission handoff

## Suggested description

Design Lab is a local LLD practice platform with three focused problems, a structured design notebook, immutable submissions, explainable rule-based review prompts, and linked revision history. The domain model separates attempt state, persistence, input format, evaluation and orchestration. A small SQLite-backed worker handles queued reviews, timeouts, failure and retry without external infrastructure. Feedback is explicitly heuristic rather than an AI-generated correctness grade.

## Before submitting

- Run `node --test` and `node src/server.js` on the machine used for your demonstration.
- Read the research note, design note and `AI_USAGE.md`; adjust anything that does not reflect your own understanding or decisions.
- Walk through the sample, revision, comparison, draft persistence and failure demo.
- Source repository: [mayankks01/lld-practice-platform](https://github.com/mayankks01/lld-practice-platform). It is private; grant the evaluator access before sharing it for review. No hosted deployment has been created.
- Record a short screen demo if requested. Suggested order: problem brief → notebook → review evidence → revision → comparison → domain classes and tests.
- Add your own name, contact details and repository/demo URLs where the form requests them.
- Submit through the [assignment Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfoHirkkjOeAYvzWksEVXSEQN5rEeD2Dyn5lPbSOkPhW65WHg/viewform?usp=publish-editor).

The form has **not** been submitted. Its fields could not be retrieved by the research browser, so this document does not claim a required field list. The local URL is not reachable by a remote evaluator; provide the runnable source and run instructions, or a recording/hosted version if the form requires one.

## Demo revision text

Starting with the sample Parking Lot attempt, extend the walkthrough:

> Entry reserves a compatible spot and creates its ticket in one operation owned by ParkingLot. A full lot returns NoSpotAvailable without issuing a ticket. An invalid ticket or already closed ticket cannot release a spot. Exit computes the fee before closing the ticket and releasing the spot. For two requests for the last spot, a lock around selection and reservation allows exactly one success; the other observes no available spot.

Add a trade-off:

> I use a FeePolicy interface because pricing varies independently of occupancy. A plain function would be simpler for a single rule, but the interface makes alternative pricing policies easy to inject in tests. The policy accepts duration and vehicle type; it does not mutate a ticket or spot. An hourly cap belongs in that policy.

Add tests:

> Given one compatible free spot, when two entry requests run concurrently, then exactly one receives a ticket and one receives NoSpotAvailable. Given an already closed ticket, when exit is requested again, then the operation is rejected and occupancy is unchanged. Given a capped fee policy, when duration exceeds the cap, then the returned fee equals the cap.

These are illustrative ideas, not a canonical solution or proof of correctness. The evaluator will recognize additional phrases; explain the actual design improvement yourself rather than using that signal count as evidence.
