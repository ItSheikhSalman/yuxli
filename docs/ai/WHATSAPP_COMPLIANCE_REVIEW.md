# WhatsApp compliance-oriented review

Reviewed October 18, 2026. No ban immunity or universal eligibility is claimed.
Conservative messaging cannot eliminate platform restrictions.

## Official policy verified

The readable WhatsApp Business Messaging Policy was downloaded from:

```text
https://business.whatsapp.com/policy
```

It requires recipient permission for subsequent messages/calls and honoring
stop/opt-out requests. Business Platform replies outside the 24-hour customer
service window require approved templates. Automation needs clear human-support
escalation paths. Appropriate notices, permissions and legal processing remain
the business's responsibility. Evidence: `artifacts/ai/whatsapp-policy.html`.
Reading the policy does not certify this product.

## General-purpose AI eligibility blocker

An earlier audit flagged AI-provider restrictions associated with the January
15, 2026 terms change and possible market exceptions. A broad companion product
must not assume eligibility merely because an official API exists. Obtain a
current use-case/market review from Meta and qualified counsel before rollout.

Final retrieval attempts did not return readable operative terms from the
following official locations: the terms route returned a generic Facebook shell,
the update route returned 404, and the AI-provider route returned a generic
developer shell. This report therefore does not certify current wording or
exceptions from those final fetches.

```text
https://www.whatsapp.com/legal/business-solution-terms
https://www.whatsapp.com/legal/business-solution-terms-update?lang=en
https://developers.facebook.com/documentation/business-messaging/whatsapp/ai-providers/
```

The attempted Baileys messaging documentation route also returned 404. Native
reaction payload behavior is tested locally; that is not a claim that the
documentation route was successfully reviewed.

## Implemented safeguards

- Clear AI identity, explicit chat activation, group Mention Only default.
- Notice, optional learning consent, stop controls, roast boundaries and silent
  observation that never posts.
- Deduplication, cooldowns, quiet hours, bounded queues and workspace quotas.
- Native reactions instead of unnecessary text; unsupported reactions stay silent.
- Terminal socket stop/backoff and revocation of queued work on unlink.
- No new adaptive typing simulation, proxy evasion, unauthorized bulk messaging,
  device spoofing or automatic account re-registration.
- Misleading zero-ban/presence-emulation pricing wording was removed without
  changing existing prices or commercial limits.

These safeguards apply to the new adaptive path. Legacy AntiBanShield UI,
outbound helpers and old behavior remain separate review items; this is not
a declaration that every existing integration complies with platform terms.

## Adapter decision

| Concern | Current Baileys integration | Official Business Platform |
| --- | --- | --- |
| Authentication | Linked device and existing isolated credentials | Business asset authorization/token lifecycle needed |
| Groups/replies/reactions | Existing message keys and native reactions | Verify current capabilities; do not assume feature parity |
| Delivery feedback | Local send result and socket diagnostics | Verified webhooks/status integration needed |
| Proactive business messages | No new bulk-send feature | Permission, templates and window enforcement required |
| AI eligibility | Not an exemption from WhatsApp terms | Current AI-provider/use-case review required |

No Cloud API adapter is implemented or advertised as connected. A future adapter
needs signature-verified webhooks, consent records, template/window enforcement,
token lifecycle, idempotent status updates, rate limiting and legitimate human
support. Company-specific support is not automatic permission to distribute a
general-purpose AI companion. Current handoff pauses AI and gives instructions;
it does not connect to a staffed agent.
