# Training and adaptive test matrix

October 18, 2026. See `ADAPTIVE_AI_TEST_RESULTS.md` for exact outcomes and logs.
Coverage does not mean every product requirement is complete.

| Requirement | Verification | Status |
| --- | --- | --- |
| Persona validation/selection/isolation | Adaptive intelligence suite | Passing deterministic checks |
| Language, tone and length | Signals and scenario harness | Passing heuristics; quality unreviewed |
| Mention, silence, reactions | Scenarios/controller with fake sockets | Passing |
| Reply threading and deduplication | Reliability suite | Passing |
| Consent notice delivery/replay and aliases | Privacy/reliability cases | Passing tested envelopes |
| Roast consent/private memory | Decision/context checks | Passing samples, not exhaustive moderation |
| Profile privacy/reset | Aggregate storage/consent tests | Passing |
| Memory opt-in/expiry/deletion/group exclusion | Database/controller tests | Passing |
| Knowledge approval/FTS/scopes/retention | Retrieval and scheduled sweep | Passing |
| Islamic citations | Unknown/missing reference gates | Passing heuristics; no corpus review |
| Educational usefulness | Domain/action decisions | Generated teaching requires human review |
| Business grounding | Evidence and transaction gates | No live order/refund backend |
| Injection/tool denial | Immutable policy and no-tool contexts | Passing samples, not universal proof |
| Subscription/storage/playground quota | New API/repository and existing quota tests | Passing |
| Concurrency/provider failure | Fake generators and slot bounds | Passing; no live benchmark |
| Reactions and fallback | Native fake-socket payload | Passing |
| Rate/terminal/revoked queue | Reliability tests | Passing |
| Migration/workspace cleanup | Copied v10-to-v14 database | Passing |
| API auth/workspace roles/mutation origin | Training API suite | 32 passed |
| Frontend typecheck/build | TypeScript and Vite | Passing, large-chunk warning |
| Browser CRUD/mobile/RTL/accessibility | Browser tool attempt | Blocked: no browser surface |
| Full existing regression | `node tests/run.mjs` | 3 failures and 1 crashed file |
| Existing command/integration coverage | Loader and mock regression suites | 95 commands loaded; not live-service proof |
| Consented WhatsApp staging | Not run | Authorization required |
| Clinical/religious truth and naturalness | Human rubric review | Not run |

Eight scenario categories each contain 100 parameterized cases from ten seeds;
there are 80 authored prompts total. Unnecessary reply rate is measured on
expected-silence cases, so an answer-everything policy fails. The report does not
measure deployed latency percentiles, live provider cost or factual quality.

Human reviewers should separately score reply necessity, language, brevity,
continuity, factual support, refusal usefulness, consent and privacy. Record
disagreements/adjudication instead of inventing an intelligence score. Add
independent multilingual, multi-turn cases before expanding Smart mode.
