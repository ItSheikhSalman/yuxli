// file: frontend/src/views/PlansPricingView.tsx

import {
  AlertCircle,
  ArrowRight,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
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
  ShieldAlert,
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
    badge: "MOST POPULAR",
    recommended: true,
    limits: {
      numbers: 5,
      messagesPerDay: "50,000",
      aiTokens: "Unlimited",
      antiBanLevel: "Human Jitter + Presence",
    },
    features: [
      "5 Linked WhatsApp Numbers",
      "50,000 Messages / Day High-Volume",
      "Anti-Ban Shield v4.2 (Human Presence Simulation & Jitter)",
      "Multi-Key AI Providers (Gemini 2.5, DeepSeek R1, Claude, OpenAI)",
      "Group Guardian (Anti-Link, Strike System & Auto-Clean)",
      "Automated Schedules, Sticky Reminders & Broadcasts",
      "Priority WebSocket Telemetry & 24/7 Queue Dispatch",
      "Auto-Delete Ephemeral Message Policies",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise SLA",
    tagline: "Corporate scale with dedicated proxy tunnels and zero-ban SLA",
    priceMonthly: 149,
    priceAnnual: 119,
    currency: "USD",
    badge: "ZERO-BAN SLA",
    limits: {
      numbers: "Unlimited",
      messagesPerDay: "Unlimited",
      aiTokens: "Custom Endpoints",
      antiBanLevel: "Maximum Shield + Dedicated Proxy",
    },
    features: [
      "Unlimited WhatsApp Multi-Device Instances",
      "Unlimited Messages & Zero Bandwidth Caps",
      "Maximum Shield Engine with Zero-Ban SLA Guarantee",
      "Dedicated IP Proxy Tunneling & Device Signature Rotation",
      "Multi-Tenant SaaS Workspaces with Role-Based Access Control",
      "Custom AI System Prompts & Dedicated Memory Datastore",
      "99.99% Guaranteed Uptime SLA & 1-on-1 Dedicated Engineer",
      "Direct Priority Phone & Telegram Executive Escalation",
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
  { name: "Cloud Uptime SLA", category: "Infrastructure", starter: "99.5%", pro: "99.9%", enterprise: "99.99% Guaranteed" },
  { name: "WebSocket Realtime Telemetry", category: "Infrastructure", starter: true, pro: true, enterprise: true },
  
  // Anti-Ban & Safety Suite
  { name: "Anti-Ban Protection Suite", category: "Protection", starter: "Standard", pro: "Advanced Shield v4.2", enterprise: "Maximum + Zero-Ban SLA" },
  { name: "Typing Presence Simulation", category: "Protection", starter: false, pro: true, enterprise: true },
  { name: "Gaussian Jitter Delay Pacing", category: "Protection", starter: false, pro: true, enterprise: true },
  { name: "Automated Warmup Ramp (14-Day)", category: "Protection", starter: false, pro: true, enterprise: true },
  { name: "Dedicated Residential Proxy Tunneling", category: "Protection", starter: false, pro: false, enterprise: true },
  
  // AI & Automation
  { name: "Multi-Model AI Providers", category: "AI & Automation", starter: "Gemini Only", pro: "Gemini, Claude, DeepSeek, OpenAI", enterprise: "Custom Endpoints & Fine-Tuning" },
  { name: "Conversational Vector Memory", category: "AI & Automation", starter: "Ephemeral (10 turns)", pro: "Long-Term Datastore", enterprise: "Unlimited Dedicated Memory" },
  { name: "Automated Cron Schedules", category: "AI & Automation", starter: "Up to 5", pro: "Unlimited", enterprise: "Unlimited" },
  { name: "80+ Command Execution Engine", category: "AI & Automation", starter: true, pro: true, enterprise: true },
  { name: "Sticker Studio & Media Lab", category: "AI & Automation", starter: true, pro: true, enterprise: true },
  
  // Group & Moderation
  { name: "Group Guardian Anti-Link Defense", category: "Moderation", starter: false, pro: true, enterprise: true },
  { name: "Automated Warning Strike System", category: "Moderation", starter: false, pro: true, enterprise: true },
  { name: "Auto-Delete Ephemeral Message Sweeper", category: "Moderation", starter: true, pro: true, enterprise: true },
  { name: "Whitelisted Group/DM Access Scopes", category: "Moderation", starter: true, pro: true, enterprise: true },
  
  // Enterprise & Security
  { name: "Multi-User Role-Based Access Control", category: "Enterprise", starter: false, pro: false, enterprise: true },
  { name: "Audit Logs & Security Export", category: "Enterprise", starter: false, pro: true, enterprise: true },
  { name: "Support Response Time", category: "Enterprise", starter: "Community / 48h", pro: "Priority Email / 4h", enterprise: "15-Min Dedicated WhatsApp / SLA" },
];

const FAQS = [
  {
    q: "Will my WhatsApp number ever get banned with Yuxli?",
    a: "Our Anti-Ban Shield v4.2 uses proprietary humanization algorithms (typing presence simulation, Gaussian jitter delay, and a 14-day warmup ramp) that mimic authentic mobile usage patterns. For Enterprise SLA customers, we provide a Zero-Ban guarantee backed by dedicated residential proxy tunnels.",
  },
  {
    q: "Can I switch between plans or cancel at any time?",
    a: "Yes. Upgrades take effect immediately with pro-rated billing. You can change plans or cancel recurring subscriptions at any time directly from this dashboard without lock-in contracts.",
  },
  {
    q: "How does the annual billing discount work?",
    a: "When you select annual billing, you receive an immediate 20% discount on all tiers—equivalent to getting 2.5 months completely free every year.",
  },
  {
    q: "Do I need to keep my laptop or computer open?",
    a: "No! Yuxli runs as an autonomous 24/7 cloud server. Once you link your WhatsApp number via QR code or pairing code, your bot runs autonomously in the cloud even when your devices are turned off.",
  },
];

export const PlansPricingView: React.FC<{ onUserPlanUpdated?: () => void }> = ({ onUserPlanUpdated }) => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanData[]>(FALLBACK_PLANS);
  const [currentPlanId, setCurrentPlanId] = useState<string>("pro");
  const [isAnnual, setIsAnnual] = useState(true);
  const [loading, setLoading] = useState(false);
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
      .catch(() => {
        // Fallback to rich preconfigured catalog
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectPlan = async (planId: string) => {
    if (planId === currentPlanId) {
      toast("You are currently subscribed to this plan tier.", "info");
      return;
    }

    setUpgradingId(planId);
    try {
      const res = await api.updatePlan(planId);
      setCurrentPlanId(planId);
      toast(res?.message || `Successfully activated ${planId.toUpperCase()} subscription!`, "success");
      if (onUserPlanUpdated) onUserPlanUpdated();
    } catch (err: any) {
      toast(err.message || "Failed to update subscription", "error");
    } finally {
      setUpgradingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-10 animate-fade-up pb-16">
      {/* ── Executive Header Banner ── */}
      <div className="text-center max-w-3xl mx-auto space-y-4 pt-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-indigo/30 bg-brand-indigo/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-brand-pink shadow-sm">
          <Sparkles size={13} className="text-brand-pink animate-pulse" />
          Enterprise Subscription Architecture
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-text-main font-display">
          Predictable Pricing for <br className="hidden sm:inline" />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
            }}
          >
            Autonomous WhatsApp AI
          </span>
        </h1>

        <p className="text-sm sm:text-base text-muted max-w-2xl mx-auto leading-relaxed">
          Select the optimal plan to scale your messaging throughput, secure your phone numbers
          with Anti-Ban Shield, and power 24/7 intelligent workflows.
        </p>

        {/* ── Monthly / Annual Billing Toggle ── */}
        <div className="pt-4 flex items-center justify-center">
          <div className="inline-flex items-center rounded-2xl border border-line/80 bg-panel-solid/80 p-1.5 shadow-lg backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={cn(
                "rounded-xl px-5 py-2 text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer",
                !isAnnual
                  ? "bg-brand-indigo text-white shadow-md shadow-brand-indigo/30"
                  : "text-muted hover:text-text-main",
              )}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={cn(
                "relative flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer",
                isAnnual
                  ? "bg-brand-indigo text-white shadow-md shadow-brand-indigo/30"
                  : "text-muted hover:text-text-main",
              )}
            >
              <span>Annual Billing</span>
              <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black tracking-tight uppercase">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Active Subscription Status Pill ── */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-line bg-panel-raised/80 px-4 py-2 text-xs backdrop-blur-md">
          <span className="flex size-2 rounded-full bg-ok animate-pulse" />
          <span className="text-muted">Current Organization Plan:</span>
          <span className="font-extrabold text-text-main uppercase tracking-wider font-mono">
            {currentPlanId === "enterprise"
              ? "Enterprise SLA"
              : currentPlanId === "starter"
              ? "Starter Developer"
              : "Business Pro"}
          </span>
          <span className="text-line">|</span>
          <span className="text-ok font-semibold">Active & Renewing</span>
        </div>
      </div>

      {/* ── 3 Executive Tier Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch max-w-7xl mx-auto w-full">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isPro = plan.recommended || plan.id === "pro";
          const isUpgrading = upgradingId === plan.id;
          const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-3xl p-6 sm:p-8 transition-all duration-300",
                "border bg-panel-solid/90 backdrop-blur-xl shadow-xl",
                isPro
                  ? "border-brand-indigo/60 shadow-brand-indigo/10 shadow-2xl md:-translate-y-2 ring-1 ring-brand-indigo/40"
                  : "border-line/80 hover:border-line hover:shadow-2xl",
              )}
            >
              {/* Featured Badge */}
              {plan.badge && (
                <div className="absolute -top-3.5 start-1/2 -translate-x-1/2">
                  <span
                    className={cn(
                      "rounded-full px-3.5 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-md border",
                      isPro
                        ? "bg-gradient-to-r from-brand-indigo to-brand-pink border-brand-indigo/40"
                        : "bg-slate-900 border-slate-700 text-emerald-400",
                    )}
                  >
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-text-main font-display tracking-tight">
                    {plan.name}
                  </h2>
                  {isCurrent && (
                    <span className="rounded-full bg-ok/15 text-ok border border-ok/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                      Current Plan
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted leading-relaxed min-h-[36px]">
                  {plan.tagline}
                </p>
              </div>

              {/* Pricing Display */}
              <div className="mb-6 pb-6 border-b border-line/70">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-black text-text-main font-display tracking-tight">
                    ${price}
                  </span>
                  <span className="text-xs font-bold text-muted uppercase">
                    / month
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-faint">
                  {isAnnual ? "Billed annually ($" + price * 12 + "/yr)" : "Billed monthly, cancel anytime"}
                </div>
              </div>

              {/* Key Limits Bar */}
              <div className="mb-6 rounded-2xl bg-panel-raised/70 border border-line/60 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-faint font-medium">WhatsApp Devices</span>
                  <span className="font-extrabold text-text-main font-mono">{plan.limits.numbers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-faint font-medium">Daily Messages</span>
                  <span className="font-extrabold text-text-main font-mono">{plan.limits.messagesPerDay}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-faint font-medium">Anti-Ban Protection</span>
                  <span className="font-bold text-emerald-400">{plan.limits.antiBanLevel}</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="flex-1 space-y-3 mb-8">
                <div className="text-[11px] font-black uppercase tracking-wider text-faint">
                  Included Features:
                </div>
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-text-main">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-indigo/15 text-brand-pink mt-0.5">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span className="leading-snug">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <Button
                variant={isPro ? "primary" : isCurrent ? "secondary" : "secondary"}
                className={cn(
                  "w-full py-3 text-sm font-extrabold rounded-2xl transition-all cursor-pointer",
                  isCurrent && "border-ok/40 text-ok bg-ok/5 hover:bg-ok/10",
                )}
                disabled={isUpgrading}
                onClick={() => handleSelectPlan(plan.id)}
              >
                {isUpgrading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    Updating Subscription...
                  </span>
                ) : isCurrent ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Active Plan
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Upgrade to {plan.name.split(" ")[0]}
                    <ArrowRight size={15} />
                  </span>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* ── Enterprise Trust & Guarantee Badges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3.5 rounded-2xl border border-line/70 bg-panel-solid/70 p-4 backdrop-blur-md">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-xs font-black text-text-main">Anti-Ban Guarantee</div>
            <div className="text-[11px] text-faint">Humanized telemetry protocols</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-line/70 bg-panel-solid/70 p-4 backdrop-blur-md">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-indigo/15 text-brand-indigo border border-brand-indigo/30">
            <Lock size={20} />
          </div>
          <div>
            <div className="text-xs font-black text-text-main">256-Bit TLS Security</div>
            <div className="text-[11px] text-faint">Encrypted end-to-end sessions</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-line/70 bg-panel-solid/70 p-4 backdrop-blur-md">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-pink/15 text-brand-pink border border-brand-pink/30">
            <Zap size={20} />
          </div>
          <div>
            <div className="text-xs font-black text-text-main">Instant Activation</div>
            <div className="text-[11px] text-faint">Instant device provisioning</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-line/70 bg-panel-solid/70 p-4 backdrop-blur-md">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-xs font-black text-text-main">99.99% Cloud SLA</div>
            <div className="text-[11px] text-faint">High-availability cluster node</div>
          </div>
        </div>
      </div>

      {/* ── Complete Feature Comparison Matrix ── */}
      <div className="max-w-7xl mx-auto w-full space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-text-main font-display tracking-tight">
            Detailed Capability Comparison
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            Deep dive into the architectural features powering each tier.
          </p>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-line bg-panel-solid/90 backdrop-blur-xl shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-panel-raised/90 text-text-main font-bold">
                <th className="p-4 sm:p-5 w-2/5">Platform Feature</th>
                <th className="p-4 sm:p-5 w-1/5 text-center">Starter</th>
                <th className="p-4 sm:p-5 w-1/5 text-center text-brand-indigo font-black">
                  Business Pro
                </th>
                <th className="p-4 sm:p-5 w-1/5 text-center text-emerald-400 font-black">
                  Enterprise SLA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {COMPARISON_FEATURES.map((feat, index) => (
                <tr
                  key={index}
                  className="hover:bg-panel-hover/50 transition-colors"
                >
                  <td className="p-4 sm:p-5">
                    <div className="font-bold text-text-main">{feat.name}</div>
                    <div className="text-[10px] text-faint uppercase tracking-wider font-mono">
                      {feat.category}
                    </div>
                  </td>
                  <td className="p-4 sm:p-5 text-center">
                    {typeof feat.starter === "boolean" ? (
                      feat.starter ? (
                        <Check size={16} className="mx-auto text-emerald-400" />
                      ) : (
                        <span className="text-faint/50 font-mono">—</span>
                      )
                    ) : (
                      <span className="font-semibold text-text-muted">{feat.starter}</span>
                    )}
                  </td>
                  <td className="p-4 sm:p-5 text-center bg-brand-indigo/[0.03]">
                    {typeof feat.pro === "boolean" ? (
                      feat.pro ? (
                        <Check size={16} className="mx-auto text-emerald-400" />
                      ) : (
                        <span className="text-faint/50 font-mono">—</span>
                      )
                    ) : (
                      <span className="font-bold text-text-main">{feat.pro}</span>
                    )}
                  </td>
                  <td className="p-4 sm:p-5 text-center">
                    {typeof feat.enterprise === "boolean" ? (
                      feat.enterprise ? (
                        <Check size={16} className="mx-auto text-emerald-400" />
                      ) : (
                        <span className="text-faint/50 font-mono">—</span>
                      )
                    ) : (
                      <span className="font-black text-emerald-400 font-mono">{feat.enterprise}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Enterprise FAQ Accordion ── */}
      <div className="max-w-4xl mx-auto w-full space-y-4">
        <div className="text-center space-y-1 mb-6">
          <h2 className="text-2xl font-black text-text-main font-display tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-muted">
            Have questions about deployments, anti-ban protections, or billing?
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-line/80 bg-panel-solid/70 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-start font-bold text-text-main hover:bg-panel-hover/50 transition-colors"
                >
                  <span className="flex items-center gap-3 text-xs sm:text-sm">
                    <HelpCircle size={16} className="text-brand-indigo shrink-0" />
                    {faq.q}
                  </span>
                  <span className={cn("text-xs transition-transform duration-200", isOpen && "rotate-180")}>
                    ▼
                  </span>
                </button>
                {isOpen && (
                  <div className="p-4 sm:p-5 pt-0 text-xs text-muted leading-relaxed border-t border-line/50">
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
