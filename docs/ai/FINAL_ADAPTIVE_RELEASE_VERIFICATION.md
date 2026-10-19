# Final Adaptive Release Verification

Verification date: **October 19, 2026** (Asia/Karachi).

## Decision

**NO-GO for production deployment or unrestricted multi-tenant release.**

The local regression gate is now green. The Training Studio works in the tested
browser, and the identified legacy AI tenancy defects have been hardened with
negative tests. The checkout is suitable for the next **explicitly authorized,
controlled staging review**, not an assertion of real-world readiness.

Production remains blocked by authorized WhatsApp staging, independent human and
specialist review, provider/platform eligibility checks, and the unsupported
legacy multi-connection features described below. No production deployment,
real account connection, or real recipient messaging was performed in this
verification work. Activating a version in the browser test changes only its
disposable local database; it is not a production deployment.

This report supersedes the current-status claims in the October 18 reports.
Those reports and their original failure evidence remain historical records.

## Environment and evidence

- Checkout: `D:\Whatsapp bot\levix`; Node `v24.16.0`; Windows; SQLite via `node:sqlite`.
- Git base: `8bad9a7a89838da05ccbdca0839464f288814a76`, with substantial pre-existing
  uncommitted work. No branch, commit, reset, or cleanup of unrelated work was made.
- Tests use synthetic fixtures and disposable data directories. The main runner
  also supplies an isolated `LEVIX_DATA_DIR` to every test process.
- Browser: real headless Microsoft Edge `155.0.4283.62`, driven by test-only
  Playwright Core. The browser calls real local Express routes and SQLite, not
  mocked CRUD responses. Non-local browser requests are blocked.
- Playwright Core was installed only under `artifacts/browser-tools`; no product
  dependency or commercial plan price was changed for browser testing.
- This sandbox required approval for child-process tests and Vite/esbuild.
  A sandbox `EPERM` build attempt failed before the approved build succeeded.

### Executed verification commands

Commands run from the checkout root. Exit codes below are observed results,
not predicted results. Detailed logs are under `artifacts/ai/`.

| Command | Exit | Observed result / evidence |
| --- | --- | --- |
| `node tests/run.mjs` (final) | **0** | **4,901 counted checks; 0 failures; 0 crashed files; 64 test files.** `release-regression-final.log` |
| `node tests/run.mjs adaptive-` | **0** | 994 checks, including the new multi-turn and staging suites. `release-adaptive-expanded.log` |
| `node tests/run.mjs ai-` (focused checkpoint) | **0** | 375 checks before the last installation-only guards; those additions are covered by the final full run. `release-ai-security.log` |
| `node tests/run.mjs legacy-` (HTTP checkpoint) | **0** | 88 checks at that checkpoint. Final full run includes 71 isolation + 21 HTTP authorization checks. `release-legacy-http.log` |
| `node tests/run.mjs mood-and-memory` | **0** | All 27 assertion sections pass. This legacy script does not emit a `CHECKS` tally and therefore appears as zero counted checks in the runner. `release-mood-third.log` |
| `npm.cmd run build:frontend` | **0** | TypeScript project build and Vite production build succeed. `release-frontend-build.log` |
| `node tests/browser-training.mjs` (final) | **0** | **53 browser assertions**, no page exceptions, no external requests. `release-browser.log`, `browser/results.json` |
| `git diff --check` | **0** | No whitespace errors in tracked diffs; Git reports LF/CRLF warnings. `release-diff-check.log` |

Reproducing the separate browser test requires the built frontend, installed Edge,
and `npm.cmd install --prefix artifacts/browser-tools --no-save --package-lock=false --ignore-scripts playwright-core`.
`tests/browser-training.mjs` is deliberately separate from the ordinary suite,
so a normal test run does not silently install or launch a browser.

### Failure history retained

- Mid-implementation full run: exit **1**, 3,904 counted checks, 20 failed checks,
  11 crashed files (`release-regression-mid.log`).
- Next full run: exit **1**, 4,770 checks, 2 failed checks, 1 crash
  (`release-regression-second.log`).
- The 4,897-check green checkpoint remains in `release-regression-4897.log`;
  final guards add four checks, producing the final 4,901-check result.
- Initial browser iteration exposed missing tab keyboard navigation and external
  Google Fonts requests. Both were fixed. Two later browser-script waits used
  the wrong Save label; correcting the selectors did not weaken assertions or
  change the application to satisfy them. The final complete browser run passes.

## Regression root causes fixed

### Headless module probes

`tests/fixtures/probe.cjs` now writes its result to a temporary file and renames
it atomically. On Windows, the parent could otherwise see a partially written
result and terminate the probe before valid JSON was complete. The three
module-probe failures are resolved without removing module probes. The final
`tests/headless.test.mjs` result is **39 checks, exit 0**.

### Mood and memory assertion

`tests/mood-and-memory.test.mjs` initializes disposable storage before application
imports. Assertions now require an honest AI identity, calm conflict handling,
and consensual banter rather than the removed human-impersonation instructions.
The provider-dependent currency assertion uses an explicit fixture and restores
its fetch stub. Later sections execute instead of being hidden by the previous
crash. Existing command aliases and six legacy mood choices remain available.

### Authorization fixtures versus security regressions

Synthetic sockets are explicitly bound to fixture connections. Positive memory
tests now make explicit save requests, and positive global-memory tests originate
in an authorized private chat. Complementary negative cases reject unsolicited
saving and even an owner's attempt to expose global memory in a group. These
changes exercise the intended security boundary instead of bypassing it.

## Security findings and changes

| Finding | Resolution and verification |
| --- | --- |
| Legacy chat IDs, roles, moods and histories aliased different workspaces | Trusted async workspace scope, composite database ownership, workspace-keyed settings, scoped caches and filesystem locations. Same-ID tenant-negative tests pass. |
| Several legacy tables had a workspace column but globally keyed primary keys | Appended schema **v15** rebuilds relevant keys and preserves previous data. Disposable upgrade, repeated migration and original-copy preservation tests pass. No shipped migration was edited. |
| Dashboard routes trusted stale session/workspace fields | Routes resolve live membership; non-admin and revoked membership requests fail. Body/query workspace spoofing cannot select another tenant. New signups transactionally provision their own workspace/membership/connection. |
| Setup user lacked real workspace membership | Setup explicitly provisions the installation owner; operator authorization is server-minted and password-epoch bound. An arbitrary SaaS `owner` field does not grant installation access. |
| Private/global memory could influence group replies | Legacy prompt retrieval uses current-chat memory only. Global notes are never automatically injected. Group/global access and cross-chat operations fail closed. |
| Passive outgoing owner messages were recorded as assistant speech | Removed that message-handler ingestion. Owner statements no longer silently become AI conversation turns. A negative handler test verifies it. |
| Legacy histories had no retention boundary | Seven-day inactivity retention by default, configurable internal limit 0-30 days, 60 turns and 256 KiB per write. Zero disables persistence. Expired rows are removed on history read/write/list, scoped to the workspace. |
| Tool callers or sockets could be spoofed/stale | Bound-socket caller minting, current DB role checks, declared-argument filtering, output-connection ownership and revocable socket proxies. Role revocation and foreign/revoked delivery negatives pass. |
| Provider execution could read installation settings in a tenant playground | Generation enters the trusted workspace scope before invoking the existing provider stack. Adaptive/playground legacy side effects remain disabled. |
| Retry and group metadata caches were installation-global | Retry keys include workspace and connection; retry requests also check chat identity. Socket callbacks and group sync enter bound scope. Full group sync freshness is tracked per connection. |
| Legacy global scheduler, auto-delete and sticker ownership could be reached from tenants | Unsafe legacy command families fail closed outside the installation default connection; auto-delete does not run there and sticker ownership cannot resolve the installation library. Corresponding dashboard surfaces remain installation-only. |
| Human impersonation and aggressive mood/filter instructions | Safe code-owned identity remains authoritative. Anger no longer selects abuse; filter-off means casual style, not security-off. Target consent and individual opt-out govern roasting. |
| Chat training accepted manually supplied IDs | Workspace-scoped metadata directory and server-side ownership check back the selector. Unbound connections and foreign/arbitrary JIDs cannot grant chat authorization. |

Relevant negative suites: `tests/legacy-ai-isolation.test.mjs`,
`tests/legacy-dashboard-security.test.mjs`, `tests/ai-tool-authz.test.mjs`,
`tests/security-remediations.test.mjs`, `tests/ai-training-api.test.mjs`.

### Boundaries not overclaimed

- Installation-only legacy scheduling, auto-delete and sticker-library commands
  remain usable on the default connection, not falsely advertised as fully
  multi-tenant. Building connection-aware replacements remains product work.
- Group-admin authorization uses received scoped metadata and the available
  cache; unit tests do not prove immediate detection of an unseen remote role
  change during network failure.
- The legacy filesystem store is isolated by application ownership and paths;
  this is not a defense against a hostile process already able to modify the
  installation's files or replace directories with links.
- Legacy history expiry is inactivity-based and lazily enforced, not per-turn
  cryptographic erasure. SQLite backups, WAL files and provider retention need
  their own operational retention/deletion procedures.
- No external penetration test or complete certification of every historical
  integration was performed. Passing the suite is not proof of universal safety.

## Training Studio browser verification

`tests/browser-training.mjs` exercises the built React app against a disposable
panel with synthetic chat metadata; no account is paired and no provider key is
needed. Final result: **53 assertions, exit 0**.

- Authorized chat selector, immutable existing chat identity, notice-required
  setup, Mention Only default and learning disabled by default.
- Immediate AI enable/disable and explicitly saved learning on/off controls.
  Admin setup does not manufacture participant learning consent or a style score.
- Persona creation and revision-aware editing through the simplified form.
- Markdown upload, unapproved draft state and explicit knowledge approval.
- Confirmed shared memory creation and deletion; no private participant memory
  appears in the administrator list.
- Playground silence and native reaction decisions; playground delivery is disabled.
- Evaluation persistence, local version snapshot and explicit local activation.
- Server-side Free-plan custom-persona limit, with error displayed in the editor.
- Dialog focus trap and return, Escape close, roving tab focus, RTL-aware arrows,
  and 40px tab targets. Fields now have associated accessible labels.
- English mobile at **390x844**, Arabic mobile at **390x844**, Arabic desktop at
  **1440x844**, and English desktop at **1440x1000**. No document-level horizontal
  overflow in the tested viewports. Mobile tab strips intentionally scroll.
- Removed dashboard Google Fonts imports/preconnects; the final browser run
  requests no external runtime resources and reports no JavaScript exceptions.

Screenshots are in `artifacts/ai/browser/`: `desktop-automatic.png`,
`en-390-custom.png`, `ar-390-custom.png`, `ar-1440-custom.png`.
Arabic mobile/desktop screenshots were visually inspected. Mixed-script user
content remains intact and RTL layout is coherent.

Limits: headless viewport testing is not physical-device testing. Safari/WebKit,
Firefox, an actual Android WebView, screen-reader output, every navigation view
and a full localization/accessibility audit were not tested. Native file-picker
text and some existing shell labels remain English. The advanced deployment
editor is still JSON-based; complete no-code assignment/version comparison UX
is not claimed. Frontend build emits an existing large-chunk warning and a Node
shell-spawning deprecation warning. Full-repository lint was not claimed.

## Multi-turn conversation quality

New fixtures in `tests/fixtures/adaptive-multiturn.mjs` contain **12 separately
authored agent-written scenarios, 46 turns**, not numeric substitutions of one
seed. `tests/adaptive-multiturn.test.mjs` records **65 checks, exit 0** and writes
`artifacts/ai/multiturn-results.json`.

Coverage includes cricket banter, uncertain assignment timing, resolved classroom
questions, unrelated topic transitions, Roman Urdu technical tutoring, angry
customers, handoff, religious references, repeated acknowledgments, withdrawn
roast consent, grief/emergencies, private identifiers, adversarial instructions,
and rate limits. The scenarios found and fixed a state bug: **"Pata nahi" / "not
sure" no longer marks a question as answered by a human.**

Observed deterministic decision results: **24/24 expected-silent turns remain
silent; 0 unnecessary replies on those turns**. The remaining 22 turns match
their authored decisions, including reactions and clarification. Structural
output checks reject invented sources, invalid scripture numbers, unsupported
order status and human-identity claims. A short, basic pointer explanation passes
the structural guard.

These are **not independently human-reviewed conversations**. Human-reviewed
sample count is **zero**; live model calls in this new suite are **zero**. The
existing 800-case evaluation remains parameterized coverage, not 800 independent
human reviews. No human-level intelligence, statistical real-world silence rate,
religious accuracy certification, or subjective response-quality score is claimed.

Limitations include heuristic keyword language/emotion detection, short-thread
metadata rather than general discourse understanding, no measured live generation
quality, no verified broad religious corpus, and best-effort output grounding
rather than a semantic truth guarantee. Real token cost, recipient latency and
provider reliability remain unmeasured here.

## Controlled staging readiness

`tests/adaptive-staging.test.mjs`: **23 checks, exit 0**, using a bound mock socket
only. Verifies disabled initial state, Mention Only and learning-off defaults,
zero generation/sends for ordinary group discussion, explicit mention response,
duplicate prevention, unsupported-reaction silence, native reaction idempotency,
absence of learned summaries when learning is off, provider outage, participant
stop, terminal-error stop and connection revocation.

Existing reliability, session, quota and connection suites additionally exercise
queues/backpressure, concurrent generation, failure recovery, rate limits,
subscription reservation and lifecycle behavior. Mock send success is **not** a
WhatsApp delivery receipt or evidence that another device received a message.

### Run only after explicit authorization

1. Confirm the operator has reviewed the local-data incident below. Take a secured
   backup; migrate a disposable copy first. Keep the pre-upgrade original intact.
2. Approve a specific staging account, connection, workspace, named test chats,
   participants, operator and time window. Obtain administration permission and
   provide the AI/provider/privacy notice. Verify current platform eligibility.
3. Start with one allowed chat, **Mention Only**, **learning disabled**, proactive
   participation off. Do not import live conversation histories for convenience.
4. Verify account identity, allowed chat metadata, connect/stop/reconnect/unlink,
   and PN/LID identity changes. Confirm old queued work cannot use a revoked socket.
5. Send only the pre-approved synthetic fixtures. Observe both sender API outcome
   and recipient device/receipt where supported. Do not equate them.
6. Exercise notice, opt-out, duplicate replay, cooldowns, unsupported reactions,
   provider failure, subscription exhaustion and controlled terminal failures.
   Stop immediately on unexpected routing, privacy exposure or account warnings.
7. Enable learning only in a separate consented test, with explicit participant
   opt-ins. Verify view/export/reset/deletion and individual roast opt-out.
8. Obtain independent multilingual and specialist review, real latency/usage
   measurements, staffed handoff, and backup/restore/deletion sign-off before a
   separate production approval. No ban-immunity guarantee is possible.

## Local-data incident requiring operator review

During an earlier pre-fix invocation, `tests/mood-and-memory.test.mjs` did not
initialize a disposable data directory. It touched the local `levix/data`
runtime before this isolation defect was discovered. Sends were mocked and no
WhatsApp account/socket was connected by that invocation, but local settings and
synthetic whitelist, mood and history entries were modified.

Known affected final test settings included bot access **public**, synthetic-chat
filter **off**, and auto-reply **mention**. Their previous values are unknown.
The user was notified in the preceding work. Evidence:
`artifacts/ai/release-mood-before.log`. No original settings were invented and no
speculative restore was performed. **The operator must inspect/restore the actual
desired settings before using that local runtime.** The test now isolates storage
before imports; subsequent runs use disposable data.

## Remaining release gates

1. Explicitly authorized end-to-end staging and recipient delivery verification.
2. Independent human conversation review, including Roman Urdu/Arabic, privacy,
   consent, appropriate silence and specialist Islamic/medical/business grounding.
3. Current WhatsApp/Meta use-case eligibility, provider agreements and retention,
   account controls, operational monitoring and staffed human escalation.
4. Connection-aware implementation or explicit product exclusion of the gated
   legacy installation-only features for tenant/secondary connections.
5. Operator sign-off on the local-data incident, secured backups, restore testing
   and retention across SQLite/WAL/backups and external providers.

**Local automated verification: PASS. Production release: NO-GO. Nothing deployed.**
