# AI persona catalog

Templates: `catalog.cjs`; validation/selection: `personas.cjs`. These are behavior
profiles, not credentials or tool grants. Immutable identity/safety always wins.

| ID | Template | Intended behavior |
| --- | --- | --- |
| `general` | General Assistant | Friendly, accurate everyday help and adaptive brevity |
| `student` | Student Companion | Concepts, revision, quizzes/study planning; guide assessed work |
| `programming` | Programming Tutor | C++, Python, web, algorithms/systems with small examples |
| `cybersecurity` | Cybersecurity Learning Assistant | Defensive concepts and authorized practice |
| `islamic` | Islamic Knowledge Assistant | Respectful attributable sources, interpretation and disagreement |
| `support` | Business Customer Support | Approved policies, professional clarification and honest escalation |
| `sales` | Sales Assistant | Consented lead qualification and reviewed catalog information |
| `productivity` | Personal Productivity Assistant | Task/goal planning without invented account access/actions |
| `companion` | Friendly Companion | Warm AI support without impersonation or human-experience claims |
| `desi` | Desi Friendship & Banter | Roman Urdu, familiar slang and consensual teasing |
| `moderator` | Group Moderator | De-escalation and rules explanation, not invented authority |
| `teacher` | Teacher Assistant | Lessons, rubrics/practice with approved classroom material |
| `community` | Community Manager | Respectful community answers and approved information |
| `technical` | Technical Support | Stepwise troubleshooting with minimal non-sensitive diagnostics |
| `research` | Research Assistant | Attributable evidence, comparisons and uncertainty |

All default to honest/helpful/respectful traits, explicit memory, no tools,
no profanity and roast mode off. Desi defaults to Roman Urdu, a small slang list
and humor level 2; others use automatic language and humor off. Medical tasks
use a domain policy, not a fictional doctor identity. Code examples are not
automatically compiled or executed because a template asks for them.

Stored preferences include name/description/role/purpose, traits, style, formality,
humor/sarcasm/slang/profanity, empathy, length, emojis, language/culture, sources,
memory policy, restrictions, escalation, triggers, quiet hours, jurisprudential
school and learning mode. Humor never overrides individual opt-out. Profanity
settings cannot authorize slurs, threats or bullying.

Selection prefers an explicit playground persona/chat assignment, then Islamic,
business or student routing, then the general default. Disabled/missing personas
fall back. Source filtering and memory policy are enforced in code; many style
preferences are bounded prompt data. Persona trigger/quiet-hour metadata does
not replace the chat's actual participation policy. Tool fields never activate
tools in read-only adaptive/playground contexts.

Islamic catalog entries are editorial review pointers, not seeded verified verse
or Hadith text. Editors must provide exact text/reference/edition and approval.
Without verified references, the assistant states the limitation. Number/quote
checks are heuristic, not scholarly certification. A preferred school affects
presentation, not a claim of universal consensus.
