# Conversation decision engine

`decision.cjs` selects an action before paid generation. Example contract:

```json
{"action":"NO_ACTION","reason":"not-invited","language":"roman-ur","tone":"friendly","confidence":"deterministic"}
```

The confidence label describes the method, not an accuracy probability. Emotion
and language remain fallible inferences.

| Action | Runtime behavior |
| --- | --- |
| `NO_ACTION` | No generation or delivery |
| `REACT_ONLY` | Native reaction, no model or emoji-text fallback |
| `SHORT_REPLY` | Brief generation or deterministic safety reply |
| `NORMAL_REPLY` | Ordinary/specialized answer |
| `DETAILED_REPLY` | Requested explanation can override usual group brevity |
| `ASK_CLARIFICATION` | Request missing context instead of inventing it |
| `TOOL_ACTION` | Contract supports it; production adapter never grants tools |
| `HUMAN_HANDOFF` | Emergency guidance or human-request acknowledgment/pause |

## Ordered policy

1. Disabled, unauthorized, self-authored, opted-out, observer, quiet-hour,
   duplicate, rate-limited and active-human-handoff cases stay silent.
2. Mentions, explicit commands, DMs or verified replies to recorded bot messages
   establish invitation. A quote's author does not become the caller.
3. Uninvited sensitive/conflict/roast messages remain silent. Group discussion
   alone does not invite the assistant.
4. Proactive replies need Smart mode, proactive opt-in, a question, participant
   learning consent, suitable approved evidence and no recent proactive reply.
   Resolved/answered tracked threads suppress redundant participation.
5. Secret indicators produce local redirection without submitting the text to
   a provider. Emergencies and human requests also use local responses.
6. Humor requires group permission and target consent; individual opt-out wins.
   A self-roast request is turn-specific consent unless previously opted out.
   Banter excludes private memory.
7. Lightweight acknowledgments can receive a permitted native reaction; otherwise
   remain silent. Sensitive/conflict signals suppress inappropriate joking.
8. Detailed, ambiguous, specialized and brief casual requests select their
   respective response sizes.

Smart evidence currently needs a lexical score of at least 0.75 and approved,
editor-verified education/business/FAQ material. This is not proof that a source
answers the exact question. The proactive cooldown is two minutes.

## Modes and state

Mention Only is the recommended group default. Smart adds restricted proactive
answers. Assistant and Custom preserve conservative invitation handling; Custom
does not grant arbitrary autonomy. Reaction Preferred favors lightweight invited
acknowledgments. Silent Observer never posts and still requires learning consent.

Per-chat quiet hours use an IANA timezone. Stored persona trigger/quiet-hour and
keyword metadata do not independently authorize delivery; chat policy and this
engine are authoritative.

State is workspace/chat scoped, expires after fifteen minutes and holds at most
twelve question threads and twelve bot threads. It tracks IDs, coarse domains,
answer/resolution flags and participation times. Only consented, non-sensitive
same-participant replied-to excerpts enter later prompts. Unrelated histories
are not concatenated. This is not a full semantic reconstruction of group chat.

A human request pauses that participant's AI conversation and creates a record
an administrator can resume. It does not create a ticket or complete a transfer.

The 800-case evaluation contains 80 authored seeds with parameter variations.
An answer-everything bot fails silence assertions. Its measured unnecessary
reply rate describes only these synthetic cases; human review remains required.
