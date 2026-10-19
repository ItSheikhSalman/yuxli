# Native reactions and delivery

`decision.cjs` selects `REACT_ONLY` before generation. `delivery.cjs` sends
Baileys' native `{ react: { text, key: incomingMessage.key } }` payload, not a
generated reaction directive or an emoji text message.

Implemented choices cover acknowledgment/agreement, appreciation and humor.
Serious/conflict signals suppress the humor path. Congratulations/support do not
yet have independent classifiers. An adapter reporting no reaction support
falls back to silence.

## Protections

- Workspace/chat/message receipts are claimed before generation or sending;
  repeated notifications cannot repeat model calls or reactions.
- Recent reaction state enforces a one-minute cooldown, alongside ordinary
  sender/chat limits, quiet hours and subscription checks.
- A connection queue serializes sends and rejects more than 16 queued jobs.
  Daily message quota is reserved atomically, including reactions/control replies.
- Before sending, socket authorization, chat enablement, observer mode, sender
  opt-out/aliases, quiet hours and subscription capacity are rechecked.
- Selected terminal statuses stop that socket. A 429 pauses adaptive delivery
  for 60 seconds. There is no adaptive typing simulation, fingerprint spoofing,
  evasion, ban re-registration or unbounded retry.

A local send result is not recipient delivery/read confirmation. Diagnostics
report the last local outcome. Durable cross-process queues and persistent
recipient-status integration are not supplied. Failed sends conservatively
consume reservations; claimed failed messages are not automatically retried.
This prefers a missed reply over duplicate unsolicited responses.

Existing session recovery remains in charge of reconnecting sockets; adaptive
terminal stop is per socket, not account-wide compliance certification. Legacy
outbound helpers are not retroactively routed through this queue.

Adaptive delivery tests use fake sockets. The legacy headless suite may attempt
an unpaired WhatsApp connection, but no real account is paired or messaged.
