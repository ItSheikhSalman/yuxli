# YUXLI AI architecture baseline

Audited October 18, 2026, before implementation. This checkout already contains
uncommitted subscription, integration, multi-connection and dashboard work.
Those changes are inputs to this implementation, not changes to revert.

## Existing execution path

- `src/handlers/message.handler.js`: access allowlists, private-message and group
  mention/all/off auto-replies. Quotes alone do not currently trigger replies.
- `src/commands/gemini.cjs`: existing aliases, media preparation, per-speaker
  group history, per-session serialization, status delivery and history recovery.
- `src/services/aiAgent.cjs`: immutable product identity, editable file persona,
  mood/filter directives, bounded history, Gemini tool loop and provider failover.
- `aiRouter.cjs` / `aiProviders.cjs`: reusable provider registry and adapters,
  capability detection, OpenAI-compatible and Anthropic tool loops. No new
  provider SDK or model-weight training infrastructure is necessary.
- `aiTools.cjs` / `aiToolAuth.cjs`: tools authorized against a frozen, WeakSet-
  registered caller from the incoming message, using existing command permissions.
  This is a valuable security boundary and must remain authoritative.
- `src/utils/memory.cjs`: editable Markdown global/chat memory, explicit memory
  commands and summarization tools. Not workspace-partitioned; global memory is
  included in prompts. There is no per-person consent/expiration model.
- `aiMood.cjs`, `aiFilter.cjs`, `aiAutoReply.cjs`: persistent legacy chat settings,
  mood cues and roast targeting. Legacy prompts encourage overly aggressive,
  assumed-consent banter and human identity imitation. These must not control
  the new safety policy.

## Persistence, tenancy and billing

`src/db/db.cjs` owns transactional, numbered SQLite migrations. `store.cjs`
owns legacy queries. Workspaces/members/subscriptions and monthly atomic AI
reservations exist. Several legacy tables merely have a workspace column;
call sites still use globally keyed chat IDs. Socket creation receives a
connection ID but does not bind an authoritative workspace to AI context.
SaaS session snapshots omit workspace membership; training routes must resolve
membership from the database rather than accept a body-supplied workspace.

Four existing commercial tiers are Free, Starter Developer, Business Pro and
Enterprise SLA. Their prices and existing limits must not change. New training
limits need an independently configurable matrix and transactional enforcement.

## Dashboard and tests

React/TypeScript dashboard, English/Arabic translations, shared UI primitives,
Express session authentication and same-origin mutation protection already exist.
AI settings expose a single persona, legacy memory/history and provider settings.
There is no persistent training studio, approval lifecycle, knowledge index,
safe playground, feedback review, evaluation history or configuration releases.

`tests/run.mjs` discovers all `*.test.mjs`, each in a separate process with a
disposable data directory. Relevant existing suites include AI prompts/features,
provider failover, tool authorization, mood/memory, reply language, migrations,
atomic quotas, multi-connection, browser and dashboard workflows.

## Implementation boundaries

Reuse provider execution, WhatsApp delivery, existing commands, SQLite, UI
components and subscriptions. Add a workspace-scoped training repository,
deterministic policy/retrieval/memory modules and a provider-independent wrapper.
Never read legacy global/private memory into new group contexts. Keep draft
configuration separate from explicitly activated local runtime versions.
Playground execution must have no socket and no tool side effects.

## Pre-existing risks requiring staging review

- Legacy non-training dashboard APIs and tools are not comprehensively tenant-
  isolated. New training APIs cannot be treated as a full SaaS security retrofit.
- Existing billing/UI marketing includes zero-ban and presence-emulation claims.
  No such guarantee is defensible; training must not implement evasion.
- External integration claims, credentials, production delivery and subjective
  religious/educational quality cannot be validated by unit tests alone.
- An official WhatsApp Business Platform adapter would require verified business
  credentials, consent records, template management and webhook verification.
  It must not be fabricated or silently replace the current integration.
