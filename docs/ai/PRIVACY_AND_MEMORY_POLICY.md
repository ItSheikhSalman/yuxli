# Adaptive privacy and memory policy

Implemented policy, October 18, 2026. This does not replace the operator's legal
processing assessment, privacy notice or provider agreement.

## Scope separation

| Layer | Restrictions |
| --- | --- |
| Current request | Permitted incoming text, bounded before provider submission |
| Temporary group state | IDs, coarse topics, flags and limited consented excerpts |
| Group style | Aggregate histograms/counts, not a transcript |
| Workspace knowledge | Administrator-approved documents in that workspace |
| Group knowledge | Approved documents bound to the exact chat |
| Personal memory | Explicit non-sensitive opt-in facts; never retrieved in groups |
| Shared memory | Explicitly approved group/workspace facts; no automatic promotion |
| Imported observations | Authorized, participant-consented aggregate learning |

Adaptive prompts do not read legacy global/chat Markdown memory or histories.
A group's profile is not copied to another group. Bot-thread excerpts are used
only for the same participant replying to that thread; this is not a general
group transcript summary service.

## Retention

| Data | Implemented retention |
| --- | --- |
| Conversation state/excerpts | Fifteen minutes; individual thread age checked on read |
| Style buckets | Seven days by default; chat setting capped by plan |
| Approved/proposed memories | Explicit expiry capped by plan; personal opt-out deletes them |
| Documents/chunks/FTS | Plan-bounded expiry; deletion removes indexed text |
| Dedup/rate receipts | 24 hours |
| Action metrics | 30 days |
| Feedback/evaluation resources | 30 days |
| Training audit events | 90 days |
| Monthly training usage | Approximately one year |
| Authored personas/rules/examples/versions | Until authorized deletion |

Expired data is excluded from retrieval. Physical cleanup happens on use and in
the existing boot/six-hour sweep. Logical deletion does not promise forensic
erasure from SQLite pages, WAL, filesystem snapshots or backups; encryption
and backup retention remain operator responsibilities.

Workspace deletion cascades referenced data and explicitly clears otherwise
unreferenced chunks, FTS, usage, events, state, receipts and metrics. Unlinking
or deleting a connection clears account-derived learning, consent and personal/
group memories, and pauses all managed chats in that workspace. This conservative
workspace-wide pause reflects chat-scoped rather than connection-scoped profiles.
Other workspaces and authored workspace training stay untouched. A newly paired
account needs fresh enablement, notice and consent.

## Participant controls

Examples use the default prefix; dispatch honors the configured prefix.

```text
!aiprivacy notice
!aiprivacy status
!aiprivacy stop
!aiprivacy start
!aiprivacy learn on
!aiprivacy learn off
!aiprivacy memory on
!aiprivacy memory off
!aiprivacy roast on
!aiprivacy roast off
!aiprivacy erase
!aimemory list
!aimemory export
!aimemory add I prefer Python examples
!aimemory correct <id> I prefer C++ examples
!aimemory delete <id>
```

Two-step notice precedes opt-in. `start` removes a stop flag without restoring
old learning/memory permission. Stop does not disable non-AI commands. Personal
memory display/export is DM-only; group requests receive directions, not facts.
Correction explicitly replaces an owned fact. Known authenticated sender aliases
are honored; identities absent from all received envelopes cannot be inferred.

Administrators can see shared memories and their own memories, not arbitrary
participants' personal memory. Secret screening is heuristic, not comprehensive
DLP. Do not intentionally supply secrets, medical records or financial identifiers.

## Remaining work

Legacy global APIs/history, mood modes and memory commands need separate review
or disabling for a multi-tenant release. Verify PN/LID changes, provider deletion,
backup erasure, cross-store export completeness and localized runtime notices.
Per-user rate accounting uses the sender identifier, not a universal identity
graph. Administration permission is attested rather than proved by a live roster.

No real private conversation was imported for these tests. Aggregate learning,
prompt configuration, approved examples and RAG do not authorize customer data
to train shared model weights.
