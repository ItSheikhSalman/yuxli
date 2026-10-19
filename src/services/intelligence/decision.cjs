const { analyze } = require("./signals.cjs");

const ACTIONS = [
  "NO_ACTION",
  "REACT_ONLY",
  "SHORT_REPLY",
  "NORMAL_REPLY",
  "DETAILED_REPLY",
  "ASK_CLARIFICATION",
  "TOOL_ACTION",
  "HUMAN_HANDOFF",
];

function quietNow(quietHours, now = Date.now()) {
  if (!quietHours) return false;
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: quietHours.timezone,
    }).format(now),
  );
  return quietHours.start < quietHours.end
    ? hour >= quietHours.start && hour < quietHours.end
    : hour >= quietHours.start || hour < quietHours.end;
}

function decide(input) {
  const { settings, consent = {}, state = {}, profile = {}, now = Date.now() } = input;
  const signals = input.signals || analyze(input.text);
  const result = (action, reason, extra = {}) => ({
    action,
    reason,
    language: signals.language,
    tone: signals.tone,
    confidence: "deterministic",
    ...extra,
  });
  if (!settings?.enabled || !input.allowed || input.fromMe)
    return result("NO_ACTION", "not-authorized");
  if (consent.optedOut) return result("NO_ACTION", "participant-opted-out");
  if (settings.mode === "silent-observer") return result("NO_ACTION", "observer-never-posts");
  if (quietNow(settings.quietHours, now)) return result("NO_ACTION", "quiet-hours");
  if (input.duplicate) return result("NO_ACTION", "duplicate");
  if (input.rateLimited) return result("NO_ACTION", "rate-limit");
  if (input.handoffActive) return result("NO_ACTION", "human-handoff-active");
  const invited = Boolean(
    input.mentioned || input.replyToBot || input.explicitCommand || !input.isGroup,
  );
  const thread =
    input.replyToId && state.threads?.find((entry) => entry.messageId === input.replyToId);
  if (!invited) {
    if (signals.sensitive || signals.conflict || signals.roast)
      return result("NO_ACTION", "sensitive-uninvited");
    if (settings.mode !== "smart" || !settings.proactive) return result("NO_ACTION", "not-invited");
    if (!signals.question || thread?.resolved || thread?.answeredByHuman || thread?.botAnswered)
      return result("NO_ACTION", "discussion-needs-no-assistant");
    if (!input.verifiedKnowledge || !consent.learning)
      return result("NO_ACTION", "no-verified-helpful-answer");
    if (state.lastBotAt && now - state.lastBotAt < 120000)
      return result("NO_ACTION", "proactive-cooldown");
    return result("SHORT_REPLY", "verified-proactive-answer", { sourceRequired: true });
  }
  if (signals.secret)
    return result("SHORT_REPLY", "sensitive-data-redirection", { localOnly: true });
  if (signals.emergency) return result("HUMAN_HANDOFF", "emergency", { localOnly: true });
  if (signals.handoff) return result("HUMAN_HANDOFF", "human-request", { localOnly: true });
  if (
    signals.roast &&
    (!settings.humor || (consent.roast === false && !signals.selfRoast) || !input.allTargetsConsent)
  )
    return result("SHORT_REPLY", "roast-consent-required", { localOnly: true });
  if (signals.acknowledgment && !signals.sensitive && !signals.conflict) {
    const recentReaction = state.lastReactionAt && now - state.lastReactionAt < 60000;
    if (
      settings.reactionEnabled &&
      input.supportsReactions &&
      !recentReaction &&
      (settings.mode === "reaction-preferred" || input.replyToBot || profile.preferReactions)
    ) {
      const reaction = signals.humor
        ? "\u{1f604}"
        : /thank|shukriya/i.test(input.text)
          ? "\u{1f64f}"
          : "\u{1f44d}";
      return result("REACT_ONLY", "acknowledgment-sufficient", { reaction });
    }
    return result("NO_ACTION", "conversation-resolved");
  }
  if (signals.toolRequest && input.authorizedTool)
    return result("TOOL_ACTION", "authorized-action-request", { confirmationRequired: true });
  if (signals.detailed) return result("DETAILED_REPLY", "explanation-requested");
  if (signals.question && signals.words < 2)
    return result("ASK_CLARIFICATION", "ambiguous-question");
  if (signals.intent !== "general" || signals.sensitive || signals.conflict)
    return result("NORMAL_REPLY", "specialized-request");
  if (signals.words < 12 || (profile.enoughData && profile.averageWords < 8))
    return result("SHORT_REPLY", "brief-conversation");
  return result("NORMAL_REPLY", "invited-request");
}

module.exports = { ACTIONS, decide, quietNow };
