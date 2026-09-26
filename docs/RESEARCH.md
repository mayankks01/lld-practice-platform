# Research note: designing for the second attempt

**Scope:** brief desk research, 25 September 2026. Approximately two pages. Sources are public product pages and documentation, not paid-product testing. No learner interviews or usability study were conducted; learner needs and product gaps below are hypotheses to validate.

## Learner problem

A learner preparing for an object-oriented design interview can name classes and patterns yet struggle to justify responsibility boundaries or explain how a failed operation leaves the system consistent. Comparing their work with a polished model answer may expose differences without explaining which differences matter. The useful outcome is an informed revision: “I moved this rule to this owner, and here is a scenario showing why.”

The target learner already understands basic classes, objects and interfaces. They have roughly 30–40 minutes to attempt a bounded problem and a few more minutes to revise. This MVP is a practice notebook, not a course or an interview-readiness certification.

## Existing approaches

| Approach and observed capability | What it contributes | Implication for this MVP |
| --- | --- | --- |
| [Educative: Grokking the Low Level Design Interview Using OOD Principles](https://www.educative.io/courses/grokking-the-low-level-design-interview-using-ood-principles). Its public page describes OOP/SOLID instruction, case studies, diagrams, implementations and mock interviews. | Guided examples provide vocabulary and a repeatable way to decompose a problem. | Supply a clear brief and a little scaffolding. Focus the prototype on a learner's own attempt rather than reproducing a curriculum. |
| [Exercism: getting feedback](https://exercism.org/docs/using/feedback) and [mentoring guidance](https://exercism.org/docs/mentoring/how-to-give-great-feedback). The guidance frames feedback as helping learners discover ideas, discourages simply giving away the solution, and recommends a small number of important suggestions per iteration. | Feedback connects to the submitted work and invites another iteration. | Show at most three immediate next steps, retain the original attempt, and make revision an explicit action. |
| [Refactoring.Guru: criticism of patterns](https://refactoring.guru/design-patterns/criticism). The article discusses rigid application and unnecessary use of patterns. | Design patterns are tools whose value depends on context. | Do not count pattern names or require a particular hierarchy. Ask what change a boundary enables and what complexity it costs. |

These observations do not establish that any product lacks other capabilities behind login or in paid features. The opportunity is our selected combination: a short, LLD-specific attempt, transparent review evidence, and visible revision history.

## Gaps and product direction

**An artifact needs behaviour, not just nouns.** A class list alone cannot reveal who reserves the last parking spot or what happens to stock after a dispenser fails. Ask for scope, responsibility ownership and a behaviour walkthrough as the minimum submission. Offer relationships, trade-offs and tests as recommended sections. Accept short incomplete drafts so the learner can pause.

**Feedback needs a reason and an action.** “Improve SOLID” is not actionable. “Walk through who reserves the last compatible spot and what the second caller observes” gives the learner something to investigate. Every review area should identify its source section, quote evidence when present, explain the check's limits, and propose a next step.

**Multiple valid designs require calibrated claims.** Vocabulary matching is reproducible but shallow. An LLM can discuss cohesion, conflicting assumptions and alternative boundaries, but can also sound authoritative without evidence. The default prototype uses honest lexical checks to identify discussion topics; it never treats them as semantic correctness. Its architecture leaves room for a validated reasoning evaluator, while the initial demo remains reproducible without credentials or cost.

**Improvement needs an unchanged baseline.** Overwriting the old answer loses the reason for a change. A submitted attempt is immutable, a revision points to its parent, and the learner can inspect changed review signals. The comparison explicitly avoids equating a new keyword with a resolved design problem.

## Focused MVP and learning experiment

Build three authored problems: Parking Lot (responsibility ownership), Vending Machine (transaction state and failure), and Library Lending (identity and business rules). Each has requirements, scope boundaries, a concrete scenario, and a change request. Use a structured notebook, a local durable history, asynchronous status, and retry on evaluation failure. Exclude accounts, curriculum management, code execution, drawing tools, and infrastructure work.

The main hypothesis is that evidence plus a small revision task helps a learner explain one better decision. Validate it with five learners: observe one attempt and revision, then ask them to explain their change without reading the feedback aloud. Record whether they finish a revision, whether advice is actionable, and whether any finding is misleading. These are proposed measures, not collected results. The first follow-up would be a small set of expert-reviewed paired attempts, including unconventional valid designs and keyword-stuffed weak designs, to calibrate a future semantic evaluator.
