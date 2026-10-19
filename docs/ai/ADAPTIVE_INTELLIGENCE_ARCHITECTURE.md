# Adaptive intelligence architecture

Reviewed October 18, 2026. This is a working local implementation with release
blockers, not a claim of production certification.

## Entry points

- `src/core/socket.js` binds sockets to the workspace of the stored connection
  through `intelligence/runtime.cjs`; message bodies cannot supply that scope.
- `src/handlers/message.handler.js` processes notification batches, privacy
  commands, consented reaction observations and managed-chat responses.
- `src/commands/gemini.cjs` routes ordinary managed-chat AI requests through the
  adaptive controller. Legacy subcommands and other commands remain available;
  unconfigured chats retain existing behavior.
- `src/routes/aiTraining.api.esm.js`, under `/dashboard/api/ai/training`, reuses
  login and same-origin protection, checks current SQLite workspace membership
  and requires administration rights. The installation operator uses `ws_default`.
- `frontend/src/views/TrainingStudioView.tsx` reuses the React design system,
  API client, English/Arabic catalog and explicit form-save patterns.

No new vector database, AI SDK, external service or deployment was introduced.
The pre-existing dirty worktree was preserved; no commits or resets were made.

## Pipeline

```text
Authenticated socket + incoming message
  -> existing sender and command authorization
  -> enabled chat, participant opt-out and duplicate/rate admission
  -> deterministic language, domain, tone and sensitivity signals
  -> bounded thread state and consented aggregate style
  -> preliminary participation decision
  -> authorized SQLite retrieval when potentially useful
  -> final action, domain policy and persona
  -> optional isolated generation (never for silence or reactions)
  -> output checks and source rendering
  -> bounded connection queue and repeated privacy/quota checks
  -> native reaction or quoted text, then temporary thread metadata
```

| Module | Responsibility |
| --- | --- |
| `repository.cjs` | Tenant-required CRUD, revisions, limits, usage, audit, retention |
| `catalog.cjs`, `personas.cjs` | Templates, validation, selection, immutable safety policy |
| `signals.cjs` | Cheap language, domain, tone, secret/sensitive-topic heuristics |
| `privacy.cjs` | Notice, participant consent, sender aliases, chat setup/reset |
| `profiler.cjs` | Daily aggregate style buckets without raw message text |
| `conversation.cjs` | Fifteen-minute threads and limited consented excerpts |
| `decision.cjs` | Structured action/reason, silence, reactions, escalation |
| `knowledge.cjs` | Text ingestion, approval, FTS5 search, attribution |
| `memory.cjs` | Approved/proposed explicit memories, scope and expiry |
| `engine.cjs` | Compact prompts, domain rules, output checks, playground |
| `runtime.cjs`, `usage.cjs` | Minted contexts, socket binding, measured provider usage |
| `delivery.cjs`, `whatsapp.cjs` | Admission, queues, quotas, handoff, controls |
| `evaluations.cjs` | Deterministic scenarios, rubrics and saved reports |
| `lifecycle.cjs` | Pause learning and clear account-derived state after unlink |

## Persistence and activation

Four appended migrations advance the audited database from v10 to v14; shipped
migrations are unchanged. Tables cover resources, chunks, approved memories,
consent, audit, usage, state, receipts, style, metrics and FTS5. A cleanup trigger
removes unreferenced workspace data. Tests upgrade a disposable v10 copy twice,
preserve its legacy data and verify the original remains at v10.

Rules/examples require approval. Optimistic revisions prevent stale updates.
Snapshots contain personas and approved rules/examples; explicit activation
selects a custom runtime snapshot. Documents have independent approval/expiry
and are not immutable members of a prompt version. This is configuration/RAG,
not model-weight fine-tuning or software deployment.

Deployment `enabled` controls custom snapshot use; per-chat `enabled` controls
adaptive operation. Turning off a snapshot does not pause built-in adaptive
responses. Disable the chat to pause it. Disabled managed-chat rows remain as
tombstones so legacy auto-reply does not silently resume.

## Cost and safety bounds

No classifier model call is needed. Full generation reuses existing providers
with no legacy history, search or executable tools. Silence, reactions and local
safety/handoff replies do not invoke a model. Default bounds: three simultaneous
generations per workspace, 16 queued jobs per connection, six actions per sender
per minute, twelve per chat per minute, ten-second sender cooldown. Optional
context defaults to 14,000 characters after the protected identity/safety prefix.

Existing daily message and atomic AI reservations are reused. Unknown provider
usage remains unknown. Cost requires measured tokens and operator-set prices.
Latency is returned to the playground, not a complete persistent APM history.

## Limits

Adaptive assistance is read-only; use existing explicitly authorized commands for
side effects. Group administration permission is attested, not independently
proved by a live roster. The UI requires a chat JID, without a tenant-safe live
picker or per-connection group assignment. Domain/output checks are heuristics,
not complete moderation or truth verification. Legacy global memory/APIs and
old behavior remain separate security review items. PDF/DOCX extraction, real
fine-tuning, Cloud API delivery and new transactional backends are not provided.

See `FINAL_IMPLEMENTATION_REPORT.md` and `AI_PRODUCTION_READINESS.md`.
