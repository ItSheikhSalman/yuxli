# Consent-based style learning

Implemented in `profiler.cjs`, `privacy.cjs` and `signals.cjs`.

## Activation

Operators enable a specific chat, attest administration permission and participant
notice, and explicitly enable learning. Each contributing sender must separately
opt in after notice version `2026-10-18.1` is presented. Group membership is not
consent. The first opt-in command only presents the notice; a distinct subsequent
message confirms. Undelivered/suppressed notices and duplicate replay cannot
silently grant permission. Stop still applies if acknowledgment is throttled.

The shared sender-candidate helper checks alternates supplied in authenticated
WhatsApp message envelopes. Known alternate opt-outs are honored; identities
are not guessed from names or message text.

## Actual profile

One daily bucket per workspace/chat holds numeric counts of messages, words,
characters, emojis, punctuation, abbreviations, replies, questions and reactions;
small histograms contain detected language, tone and coarse domain. Buckets have
no raw message text, participant name, private fact or per-person voice signature.
Heuristic secret/sensitivity indicators exclude observations.

At most 5,000 observations enter a bucket each day. Expiry uses the lesser of
chat retention and plan retention and is not extended indefinitely by activity.
At least 20 eligible messages are required before showing an inferred language.
Typical word count is an average; reaction preference means reaction observations
exceed 30 percent of text observations. Neither is an intelligence score.

Sentence modeling, advanced pacing, identity cloning and learned humor embeddings
are not implemented. Short mixed-language text remains ambiguous. Detailed
technical questions override the usual short response style.

## Imports and reversal

`POST /groups/import` accepts at most 1,000 explicitly authorized messages after
every participant has opted in. Validation precedes observation. Raw import text
is not retained in the profiler. Receipts prevent immediate replay, not permanent
archive duplication: they expire after 24 hours. No complete WhatsApp history is
assumed accessible.

Administrators can view/export aggregates, pause learning, lower retention and
reset profiles. Because aggregates deliberately lack author attribution,
withdrawing one person's learning clears the entire group's profile and temporary
context rather than retaining inseparable contributions. Disabling a group or
lowering retention also resets its profile; only new permitted data can relearn it.

No weights change or shared-model dataset is created. Provider-side retention
and use need a separate operator/provider agreement.
