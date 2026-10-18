// file: frontend/src/views/PlansPricingView.tsx

import {
  ArrowRight,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  CreditCard,
  FileText,
  HelpCircle,
  Lock,
  MessageSquare,
  Radio,
  RefreshCw,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../components/Toasts";
import { Button, Card, StatusPill } from "../components/ui";
import { cn } from "../utils/cn";

export interface PlanData {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceAnnual: number;
  currency: string;
  badge: string | null;
  recommended?: boolean;
  limits: {
    numbers: string | number;
    messagesPerDay: string | number;
    aiTokens: string;
    antiBanLevel: string;
  };
  features: string[];
}

const FALLBACK_PLANS: PlanData[] = [
  {
    id: "starter",
    name: "Starter Developer",
    tagline: "For individual builders, hobbyists, and test WhatsApp accounts",
    priceMonthly: 19,
    priceAnnual: 15,
    currency: "USD",
    badge: null,
    limits: {
      numbers: 1,
      messagesPerDay: "2,500",
      aiTokens: "500k",
      antiBanLevel: "Standard Delay",
    },
    features: [
      "1 Linked WhatsApp Device",
      "2,500 Outbound Messages / Day",
      "Basic Auto-Reply & 80+ Commands Catalog",
      "Standard Rate-Limiting Engine",
      "Sticker Studio Lab & Media Tools",
      "Community Support & Auto-Updates",
    ],
  },
  {
    id: "pro",
    name: "Business Pro",
    tagline: "For high-growth brands, active community groups, and customer channels",
    priceMonthly: 49,
    priceAnnual: 39,
    currency: "USD",
    badge: "POPULAR",
    recommended: true,
    limits: {
      numbers: 5,
      messagesPerDay: "50,000",
      aiTokens: "Unlimited",
      antiBanLevel: "Presence + Jitter",
    },
    features: [
      "5 Linked WhatsApp Numbers",
      "50,000 Messages / Day High-Volume",
      "Anti-Ban Shield v4.2 (Typing Presence & Latency Jitter)",
      "Multi-Model AI (Gemini 2.5, DeepSeek R1, Claude, OpenAI)",
      "Group Guardian (Anti-Link, Strike System & Auto-Clean)",
      "Automated Schedules, Sticky Reminders & Broadcasts",
      "Priority WebSocket Telemetry & Queue Dispatch",
      "Auto-Delete Ephemeral Message Policies",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise SLA",
    tagline: "Corporate scale with dedicated proxy tunnels and custom SLAs",
    priceMonthly: 149,
    priceAnnual: 119,
    currency: "USD",
    badge: "ENTERPRISE",
    limits: {
      numbers: "Unlimited",
      messagesPerDay: "Unlimited",
      aiTokens: "Custom Endpoints",
      antiBanLevel: "Maximum + Proxy",
    },
    features: [
      "Unlimited WhatsApp Multi-Device Instances",
      "Unlimited Messages & High-Bandwidth Pipelines",
      "Maximum Behavioral Pacing Shield with Dedicated Proxy Support",
      "Multi-Tenant Workspaces with Role-Based Access Control",
      "Custom AI System Prompts & Dedicated Memory Datastore",
      "99.99% Guaranteed Cloud Uptime SLA",
      "Dedicated 1-on-1 Implementation Engineering",
      "Priority Escalation Support Channel",
    ],
  },
];

interface FeatureRow {
  name: string;
  category: string;
  starter: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}

const COMPARISON_FEATURES: FeatureRow[] = [
  // Infrastructure
  { name: "Linked WhatsApp Devices", category: "Infrastructure", starter: "1 Account", pro: "5 Accounts", enterprise: "Unlimited" },
  { name: "Daily Message Throughput", category: "Infrastructure", starter: "2,500 / day", pro: "50,000 / day", enterprise: "Unlimited" },
  { name: "Cloud Uptime Target", category: "Infrastructure", starter: "99.5%", pro: "99.9%", enterprise: "99.99% SLA" },
  { name: "WebSocket Realtime Telemetry", category: "Infrastructure", starter: true, pro: true, enterprise: true },
  
  // Anti-Ban & Safety
  { name: "Anti-Ban Protection Engine", category: "Protection", starter: "Standard", pro: "Advanced Shield v4.2", enterprise: "Maximum + Dedicated Proxy" },
  { name: "Typing Presence Simulation", category: "Protection", starter: false, pro: true, enterprise: true },
  { name: "Randomized Jitter Delay Pacing", category: "Protection", starter: false, pro: true, enterprise: true },
  { name: "Automated Warmup Ramp (14-Day)", category: "Protection", starter: false, pro: true, enterprise: true },
  { name: "Residential Proxy Tunneling", category: "Protection", starter: false, pro: false, enterprise: true },
  
  // AI & Automation
  { name: "Multi-Model AI Providers", category: "AI & Automation", starter: "Gemini Only", pro: "Gemini, Claude, DeepSeek, OpenAI", enterprise: "Custom Endpoints & Fine-Tuning" },
  { name: "Conversational Vector Memory", category: "AI & Automation", starter: "Ephemeral (10 turns)", pro: "Long-Term Datastore", enterprise: "Unlimited Dedicated Memory" },
  { name: "Automated Cron Schedules", category: "AI & Automation", starter: "Up to 5", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "80+ Command Catalog", category: "AI & Automation", starter: true, pro: true, enterprise: true },
  { name: "Sticker Studio & Media Lab", category: "AI & Automation", starter: true, pro: true, enterprise: true },
  
  // Group & Moderation
  { name: "Group Guardian Anti-Link Defense", category: "Moderation", starter: false, pro: true, enterprise: true },
  { name: "Automated Warning Strike System", category: "Moderation", starter: false, pro: true, enterprise: true },
  { name: "Auto-Delete Ephemeral Sweeper", category: "Moderation", starter: true, pro: true, enterprise: true },
  { name: "Whitelisted Group/DM Scopes", category: "Moderation", starter: true, pro: true, enterprise: true },
  
  // Enterprise & Security
  { name: "Role-Based Access Control", category: "Enterprise", starter: false, pro: false, enterprise: true },
  { name: "Audit Logs & Security Export", category: "Enterprise", starter: false, pro: true, enterprise: true },
  { name: "Support Response SLA", category: "Enterprise", starter: "Community", pro: "Priority Email (4h)", enterprise: "Dedicated SLA Engineer" },
];

const FAQS = [
  {
    q: "How does YUXLI safeguard my WhatsApp number?",
    a: "Anti-Ban Shield v4.2 uses proprietary human presence emulation (simulating 'composing' and 'paused' states), millisecond jitter latency, and an automated 14-day warm-up ramp to match normal human communication patterns.",
  },
  {
    q: "Can I upgrade, downgrade, or cancel at any time?",
    a: "Yes. Tier changes take effect immediately with pro-rated billing. You can adjust plans or cancel recurring subscriptions at any time from this dashboard without contractual lock-in.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual billing gives you an immediate 20% discount across all tiers—equivalent to 2.5 months free per billing cycle.",
  },
  {
    q: "Does my computer need to remain powered on?",
    a: "No. YUXLI runs autonomously 24/7 on your server. Once paired via QR or pairing code, the Baileys multi-device socket handles message processing independently.",
  },
];

export const PlansPricingView: React.FC<{ onUserPlanUpdated?: () => void }> = ({ onUserPlanUpdated }) => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanData[]>(FALLBACK_PLANS);
  const [currentPlanId, setCurrentPlanId] = useState<string>("pro");
  const [isAnnual, setIsAnnual] = useState(true);
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .getCurrentUser()
      .then((res) => {
        if (mounted && res?.user?.plan) {
          const raw = res.user.plan.toLowerCase();
          if (raw.includes("enterprise")) setCurrentPlanId("enterprise");
          else if (raw.includes("starter") || raw.includes("basic")) setCurrentPlanId("starter");
          else setCurrentPlanId("pro");
        }
      })
      .catch(() => {});

    api
      .getPlans()
      .then((res) => {
        if (mounted && res?.plans && res.plans.length > 0) {
          setPlans(res.plans);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectPlan = async (planId: string) => {
    if (planId === currentPlanId) {
      toast("You are currently subscribed to this tier.", "info");
      return;
    }

    setUpgradingId(planId);
    try {
      const res = await api.updatePlan(planId);
      setCurrentPlanId(planId);
      toast(res?.message || `Plan updated to ${planId.toUpperCase()}`, "success");
      if (onUserPlanUpdated) onUserPlanUpdated();
    } catch (err: any) {
      toast(err.message || "Failed to update subscription", "error");
    } finally {
      setUpgradingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-main">
            Plans & Subscriptions
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Transparent, predictable tiers for enterprise WhatsApp AI operations.
          </p>
        </div>

        {/* Monthly / Annual Toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-line bg-panel-raised self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
              !isAnnual ? "bg-panel text-text-main font-semibold shadow-xs" : "text-muted hover:text-text-main",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
              isAnnual ? "bg-panel text-text-main font-semibold shadow-xs" : "text-muted hover:text-text-main",
            )}
          >
            <span>Annual</span>
            <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-1 rounded">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* ── Active Plan Summary Banner ── */}
      <div className="flex items-center justify-between p-3.5 rounded-lg border border-line bg-panel text-xs">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400" />
          <span className="text-muted">Active Workspace Plan:</span>
          <span className="font-semibold text-text-main uppercase font-mono">
            {currentPlanId === "enterprise"
              ? "Enterprise SLA"
              : currentPlanId === "starter"
              ? "Starter Developer"
              : "Business Pro"}
          </span>
        </div>
        <span className="text-[11px] font-medium text-emerald-400">
          Operational & Renewing
        </span>
      </div>

      {/* ── 3 Tier Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isPro = plan.recommended || plan.id === "pro";
          const isUpgrading = upgradingId === plan.id;
          const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col p-5 sm:p-6 border bg-panel transition-all duration-150",
                isPro
                  ? "border-indigo-500/40 shadow-sm"
                  : "border-line",
              )}
            >
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-bold text-text-main">
                    {plan.name}
                  </h2>
                  {plan.badge && (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted leading-relaxed min-h-[32px]">
                  {plan.tagline}
                </p>
              </div>

              {/* Price */}
              <div className="mb-4 pb-4 border-b border-line">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-text-main font-mono">
                    ${price}
                  </span>
                  <span className="text-xs text-muted">/ month</span>
                </div>
                <div className="text-[11px] text-faint mt-0.5">
                  {isAnnual ? `Billed annually ($${price * 12}/yr)` : "Billed monthly"}
                </div>
              </div>

              {/* Limits */}
              <div className="mb-5 rounded-lg border border-line bg-panel-raised p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Devices</span>
                  <span className="font-semibold text-text-main font-mono">{plan.limits.numbers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Messages</span>
                  <span className="font-semibold text-text-main font-mono">{plan.limits.messagesPerDay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Anti-Ban</span>
                  <span className="font-medium text-emerald-400">{plan.limits.antiBanLevel}</span>
                </div>
              </div>

              {/* Features List */}
              <div className="flex-1 space-y-2 mb-6">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                  Included:
                </div>
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-text-main">
                    <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Upgrade Button */}
              <Button
                variant={isCurrent ? "secondary" : isPro ? "primary" : "secondary"}
                size="md"
                disabled={isUpgrading}
                onClick={() => handleSelectPlan(plan.id)}
                className="w-full"
              >
                {isUpgrading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={13} className="animate-spin" />
                    Activating...
                  </span>
                ) : isCurrent ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Current Plan
                  </span>
                ) : (
                  <span>Select {plan.name.split(" ")[0]}</span>
                )}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* ── Feature Comparison Table ── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-text-main">
            Feature Comparison
          </h2>
          <p className="text-xs text-muted">
            Technical capabilities across all subscription tiers.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-panel-raised text-text-main font-semibold">
                <th className="p-3 w-2/5">Feature</th>
                <th className="p-3 w-1/5 text-center">Starter</th>
                <th className="p-3 w-1/5 text-center text-indigo-400 font-bold">Business Pro</th>
                <th className="p-3 w-1/5 text-center text-emerald-400 font-bold">Enterprise SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COMPARISON_FEATURES.map((feat, index) => (
                <tr key={index} className="hover:bg-panel-hover/50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium text-text-main">{feat.name}</div>
                    <div className="text-[10px] text-faint font-mono">{feat.category}</div>
                  </td>
                  <td className="p-3 text-center">
                    {typeof feat.starter === "boolean" ? (
                      feat.starter ? (
                        <Check size={14} className="mx-auto text-emerald-400" />
                      ) : (
                        <span className="text-faint font-mono">—</span>
                      )
                    ) : (
                      <span className="text-muted font-medium">{feat.starter}</span>
                    )}
                  </td>
                  <td className="p-3 text-center bg-indigo-500/[0.02]">
                    {typeof feat.pro === "boolean" ? (
                      feat.pro ? (
                        <Check size={14} className="mx-auto text-emerald-400" />
                      ) : (
                        <span className="text-faint font-mono">—</span>
                      )
                    ) : (
                      <span className="font-semibold text-text-main">{feat.pro}</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {typeof feat.enterprise === "boolean" ? (
                      feat.enterprise ? (
                        <Check size={14} className="mx-auto text-emerald-400" />
                      ) : (
                        <span className="text-faint font-mono">—</span>
                      )
                    ) : (
                      <span className="font-bold text-emerald-400 font-mono">{feat.enterprise}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FAQ Section ── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-text-main">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-muted">
            Operational details on safeguards, multi-device, and billing.
          </p>
        </div>

        <div className="space-y-2">
          {FAQS.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-lg border border-line bg-panel overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-3.5 text-start font-medium text-xs text-text-main hover:bg-panel-hover transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle size={14} className="text-indigo-400 shrink-0" />
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn("text-muted transition-transform duration-150 shrink-0", isOpen && "rotate-180")}
                  />
                </button>
                {isOpen && (
                  <div className="p-3.5 pt-0 text-xs text-muted leading-relaxed border-t border-line/60">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlansPricingView;
