# Adaptive AI test results

Executed October 18, 2026 on Node 24.16.0 and Windows/PowerShell. Databases were
disposable. No real account was paired, real conversation imported or real
recipient messaged. No deployment occurred.

## Observed results

| Verification | Outcome | Evidence |
| --- | --- | --- |
| Initial complete baseline | 3,777 passed, zero counted failures, one crashed file | `artifacts/ai/baseline.log`, `baseline-errors.log` |
| Adaptive intelligence | 862 passed, zero failed | `artifacts/ai/adaptive-tests.log`, final suite |
| Adaptive reliability | 44 passed, zero failed | `artifacts/ai/reliability-tests.log`, final suite |
| Authenticated training API | 32 passed, zero failed | Final suite log |
| Final complete regression | 4,712 passed checks, 3 failures, 1 crashed file; exit 1 | `artifacts/ai/final-regression.log`, `final-regression-errors.log` |
| Headless diagnostic rerun | 36 passed, same 3 failures; exit 1 | `artifacts/ai/headless-rerun.log` |
| TypeScript | `tsc --noEmit` exit 0 | Repeated after final code changes |
| Frontend build | `tsc -b && vite build` exit 0 | `artifacts/ai/frontend-build-final.log` |
| Whitespace | `git diff --check` exit 0 | Final validation command |
| Browser interaction QA | Blocked: no available browser surface | In-app browser unavailable; inventory empty |
| Staging/production | Not performed | Explicit authorization required |

The harness prints `CHECKS <passed> <failed>`; its displayed "checks" number
counts passed checks rather than every attempted assertion. Plain-assertion test
files may complete without a tally. Do not infer their assertion count from a
displayed zero. The new suites total **938 passed checks**.

## Remaining failures

`tests/mood-and-memory.test.mjs:365` crashes on the legacy expectation
`Sound 100% like a REAL HUMAN`. This already failed in the initial baseline.
Deceptive identity text was not restored to satisfy it. Later assertions in that
file remain unproven by the aborted run.

Three final failures in `tests/headless.test.mjs` concern the default panel
process's module probe: it reports one module and cannot find Express or
`app.cjs`. HTTP setup checks pass. These assertions passed in an earlier full
run but fail again in the final isolated rerun. The probe writes periodically
and is read after termination; a probe/shutdown timing issue is suspected, not
confirmed. It is not fixed or silently waived. **The full suite is not green.**

## Evaluation evidence

`artifacts/ai/evaluation-results.json`, produced by the real evaluation module,
records 800/800 passing decisions and zero unnecessary replies on its synthetic
silence subset. There are 100 cases each for direct mentions, normal discussion,
reactions, topic transitions, education, business, sensitive and adversarial
messages.

These are **800 parameterized cases from 80 authored seeds**, not 800 independent
human-reviewed conversations. `humanReviewed` is false. They test decisions,
not arbitrary generated medical/religious/business facts, real-world participation
accuracy or human-level intelligence.

## Coverage and environment

New checks exercise persona/tenant isolation, source approval/retrieval, memory
expiry/delete, opt-in, language/tone, silence/reactions, roast consent, aliases,
citations, no-tool contexts, playground, revisions, quotas, concurrency, terminal
stop, retention, workspace cleanup and copied v10-to-v14 migration. Regression
paths exercise providers, AHM7 mocks, multi-connection, billing, media, storage,
the scheduler and 95-command loading. This is not live external-service coverage.

Every runner child now gets a disposable data directory. Initial sandbox runs
hit `spawn EPERM`; approved outside-sandbox runs were used for child-process
tests and Vite. A 120-second attempt timed out; complete runs used a 600-second
allowance and finished in about four minutes.

The compiled JS bundle is about 809.28 kB / 237.00 kB gzip, with Vite's existing
large-chunk warning. Types/build and HTTP tests do not prove visual layout,
mobile, keyboard accessibility, Arabic/RTL or browser CRUD. A localhost fixture
boots without WhatsApp, but browser surfaces were unavailable for visual QA.
