# Production readiness

Follow-up verification: see `FINAL_ADAPTIVE_RELEASE_VERIFICATION.md` (October 19,
2026). Regression and browser gates are now green; production remains NO-GO for
the external staging/review and documented feature boundaries. The record below
describes the earlier October 18 state.

October 18, 2026: **not approved for production deployment**. New suites pass,
but full regression is not green and security/compliance/QA gates remain open.
Nothing was deployed.

## Blocking gates

1. Diagnose the three default-panel module-probe failures in the headless suite;
   they reproduce in isolation. Do not mask missing-module/startup regressions.
2. Reconcile the baseline human-persona assertion with explicit AI identity,
   without restoring impersonation directives. Then run its later assertions.
3. Review legacy global memory/mood/history, dashboard authorization, outbound
   helpers and integration scopes before multi-tenant customer use.
4. Verify current WhatsApp business/AI-provider eligibility and lawful notice/
   consent. An official API is not automatically an eligible substitute.
5. Run browser CRUD, keyboard/accessibility, mobile and Arabic/RTL checks.
   TypeScript and HTTP tests cannot replace them.
6. Populate and independently review sources; obtain qualified review for
   Islamic references, medical safety and actual business policy.
7. Provide staffed support escalation and verify provider agreements, credential
   scopes, backups, deletion and export obligations.
8. Complete explicitly authorized staging with fresh test accounts, sender alias
   changes, connection rollover, terminal errors and participant consent flows.

## Local verification

```text
node tests/adaptive-intelligence.test.mjs
node tests/adaptive-reliability.test.mjs
node tests/run.mjs ai-training-api
node tests/run.mjs
npm.cmd run build --prefix frontend
node frontend/node_modules/typescript/bin/tsc -p frontend/tsconfig.json --noEmit
git diff --check
```

This Windows sandbox required approved outside-sandbox child-process tests and
Vite. Use disposable databases. `tests/fixtures/server.mjs` serves a localhost
panel without WhatsApp for browser QA. Existing headless tests can initialize an
unpaired socket; never give them real credentials.

## Staging sequence after authorization

- Secure a restorable backup and test forward migrations on a disposable copy.
  Keep the pre-upgrade original separate; no down migration exists.
- Begin paused, then enable one permitted staging chat in Mention Only mode,
  learning off, without legacy auto-reply fallback.
- Verify notice, distinct-message opt-in, stop/start/erase and individual roast
  opt-out before learning. Test sender PN/LID alternates.
- Use approved non-sensitive fixtures for knowledge, memory and versions; manually
  verify attribution instead of importing real histories to make tests easier.
- Exercise duplicate batches, unsupported reactions, quotas, overload, provider
  errors, inactive subscriptions, unlink, account changes and revoked queues.
- Complete independent human-reviewed multi-turn cases before proactive use.
  Decision counts, local send results and recipient delivery are different metrics.

## Pause and rollback

Disable a managed chat rather than deleting it; its disabled record prevents
legacy fallback. Turning off a custom snapshot alone does not stop built-in
adaptive replies. Earlier snapshots restore custom prompt settings, not knowledge,
consent, usage or database state. Database/software rollback requires stopping
the app and restoring the right secured backup, not editing migrations or resets.

Unlink pauses all managed chats in that workspace because profiles are not yet
connection-specific. Confirm that operational tradeoff in staging. Production
rollout requires separate explicit authorization after all release gates close.
