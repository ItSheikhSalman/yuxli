# AI memory architecture

`PRIVACY_AND_MEMORY_POLICY.md` contains the controls and retention policy.

| Store | Keys | Trust |
| --- | --- | --- |
| `ai_participant_consent` | workspace, chat, user | Explicit notice-versioned consent |
| `ai_style_buckets` | workspace, chat, day | Inferred aggregates, not personal facts |
| `ai_conversation_state` | workspace, session | Temporary IDs/domains and limited consented excerpts |
| `ai_approved_memories` | workspace, ID, scoped subject/owner | Proposed/approved; only approved retrieved |
| `ai_training_resources` | workspace, kind, ID | Admin resources with revision/approval lifecycle |
| `ai_knowledge_chunks`, `ai_knowledge_index` | workspace, document, ordinal | Untrusted evidence from approved authorized documents |

Personal memory needs opt-in. Shared memory needs administrator approval and
explicit confirmation. SHA-256 fingerprints deduplicate normalized facts inside
the same scope, never merge different users. Ownership and expiry are checked
before retrieval/deletion. Lexical relevance selects at most five approved
memories. Groups never retrieve user-scoped memories; banter excludes all memory.

`!aimemory correct` replaces an explicit owned fact. Automatic conversation-to-
trusted-fact extraction is not implemented. Style inference remains distinct
from user-confirmed knowledge. Legacy global Markdown memory is excluded rather
than copied into a new tenant table.

Context is not indefinite history: thread state has a fifteen-minute TTL and
bounded entries. Excerpts require consent and non-sensitive turns, are at most
500 characters and are used only for that participant replying to that thread.
A busy discussion does not extend an old excerpt's individual lifetime. Long-form
semantic summarization and full imported-history search are not implemented.

Retention runs on use and the existing database maintenance timer. Workspace
cleanup includes search-index and auxiliary rows. Unlink pauses managed chats
in that workspace and removes account-derived learning, consent and personal/
group memory; authored workspace material remains.

Logical deletion is not encrypted-at-rest storage or forensic backup erasure.
Secret screening and language-sensitive minimization need independent security
review before sensitive or regulated deployments.
