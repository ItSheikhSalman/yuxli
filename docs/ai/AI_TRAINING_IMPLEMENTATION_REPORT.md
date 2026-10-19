# AI Training Studio implementation

See `FINAL_IMPLEMENTATION_REPORT.md` for overall status. This product changes
configuration, retrieval and aggregate profiles, not model weights.

## Working workflow

1. Open Training Studio. Automatic Learning is the initial tab. Add an allowed
   chat JID, choose a mode, review the notice and explicitly confirm permission.
   No existing chat is silently enrolled by a migration.
2. Keep learning optional. Participant opt-in governs aggregate contributions;
   complete historical access is never assumed.
3. In Custom Training, duplicate a template or create a persona. Saved data has
   revisions; import/export uses JSON. Advanced editors are optional.
4. Add rules, examples or feedback and explicitly approve trusted resources.
   User messages never automatically become authoritative instructions.
5. Ingest supported UTF-8 documents and review attribution before approval.
   Retrieval respects scope and expiry. Source URLs are not fetched automatically,
   avoiding an arbitrary URL-ingestion/SSRF path.
6. Use the playground for decisions; generation is an explicit checkbox. It can
   consume AI quota but never sends a real WhatsApp message.
7. Run deterministic evaluations plus separate human reviews. Save a snapshot
   and explicitly activate custom runtime settings. This is not software deployment.

Shared UI primitives provide forms, cards, buttons, dialogs, tabs, user text and
dirty-state handling. Authorization/limits remain server-side. Browser/visual
validation is blocked despite successful API tests and the TypeScript/Vite build.

## New training defaults

These separately configurable allowances do not alter existing prices, member
limits or commercial AI/message quotas. Review them before selling the feature.

| Allowance | Free | Starter Developer | Business Pro | Enterprise SLA |
| --- | ---: | ---: | ---: | ---: |
| Custom personas | 2 | 10 | 50 | 200 |
| Knowledge bytes | 262,144 | 5,242,880 | 52,428,800 | 268,435,456 |
| Documents | 10 | 100 | 1,000 | 5,000 |
| Example resources | 25 | 250 | 2,500 | 10,000 |
| Playground uses/month | 20 | 200 | 2,000 | 10,000 |
| Evaluation runs/month | 5 | 30 | 300 | 1,000 |
| Maximum retention days | 7 | 30 | 90 | 365 |

Existing subscription state, provider access, atomic AI reservations, daily
outbound quotas and workspace member entitlements are reused. `GET /plans`
exposes the training matrix; `PUT /plans` requires the installation operator,
not an ordinary tenant administrator. No dedicated matrix UI is implemented.

## Main API

Relative to `/dashboard/api/ai/training`, with authenticated server scope and
existing same-origin mutation protection:

| Endpoint | Purpose |
| --- | --- |
| `GET /overview` | Saved profiles, templates, permissions, limits, notice |
| `POST /groups`, `POST /groups/reset` | Explicit chat configuration and profile reset |
| `POST /groups/import` | Bounded, authorized, consented observations |
| `/resources/:kind` | Revision-aware custom resource CRUD |
| `POST /resources/:kind/:id/approve` | Explicit approval |
| `POST /knowledge` | Supported document ingestion |
| `/memory` | Owned/shared controls, not arbitrary private-memory access |
| `POST /playground` | Non-delivering simulation and optional generation |
| `POST /evaluations` | Save actual deterministic report |
| `POST /versions`, `PUT /deployment` | Snapshot and runtime activation |
| `POST /handoff/:id/resume` | Resume a paused participant conversation |
| `/plans` | Read/configure new allowances |

PDF/DOCX return explicit unsupported responses. Fine-tuning, vector databases and
cloud training jobs are not silently substituted with prompt editing.
