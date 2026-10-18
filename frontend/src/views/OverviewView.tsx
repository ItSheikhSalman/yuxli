// file: frontend/src/views/OverviewView.tsx

import {
  Activity,
  Bot,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Folder,
  Layers,
  MessageSquare,
  MessageSquareX,
  Play,
  Radio,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  Sticker,
  Terminal,
  TrendingUp,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ViewTab } from "../components/Sidebar";
import { useToast } from "../components/Toasts";
import { Button, Card, StatusPill } from "../components/ui";
import { StatCard } from "../components/ui/card";
import { useI18n } from "../context/I18nContext";
import type { DashboardStats, SessionStatus } from "../types";

const formatLinkedNumber = (id?: string | null): string | null => {
  if (!id) return null;
  const digits = id.split("@")[0].split(":")[0].replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 12)
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  if (digits.length === 11)
    return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
};

interface OverviewViewProps {
  status: SessionStatus | null;
  onNavigate: (view: ViewTab) => void;
}

export const OverviewView: FC<OverviewViewProps> = ({ status, onNavigate }) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .getStats()
      .then((res) => {
        if (mounted && res?.stats) setStats(res.stats);
      })
      .catch((err) => {
        toast(err.message, "error");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [toast]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const isConnected = status?.state === "connected";
  const linkedNumber = formatLinkedNumber(status?.user?.id);

  const handleCopyNumber = () => {
    if (!linkedNumber) return;
    navigator.clipboard.writeText(linkedNumber.replace(/\s+/g, ""));
    setCopiedNumber(true);
    toast("WhatsApp number copied to clipboard", "success");
    setTimeout(() => setCopiedNumber(false), 2500);
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await api.startSession();
      toast(t("starting"), "info");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await api.stopSession();
      toast(t("stop"), "info");
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setStopping(false);
    }
  };

  const statsCards = [
    {
      label: t("totalGroups"),
      value: stats?.totalGroups ?? 0,
      icon: <Users size={20} />,
      tone: "border-brand-indigo/35 bg-brand-indigo/15 text-brand-indigo",
      badge: "Managed",
    },
    {
      label: t("commandCount"),
      value: stats?.commandCount ?? 0,
      icon: <Terminal size={20} />,
      tone: "border-brand-pink/35 bg-brand-pink/15 text-brand-pink",
      badge: "Enabled",
    },
    {
      label: t("uptime"),
      value: formatUptime(stats?.uptime || 0),
      icon: <Clock size={20} />,
      tone: "border-ok/35 bg-ok/15 text-ok",
      badge: "Live",
    },
    {
      label: t("activeSchedules"),
      value: stats?.activeSchedules ?? 0,
      icon: <Calendar size={20} />,
      tone: "border-brand-purple/35 bg-brand-purple/15 text-brand-purple",
      badge: "Cron Tasks",
    },
  ];

  const featureCards = [
    {
      id: "ai" as ViewTab,
      title: "AI Assistant & Brain",
      tagline: "Gemini, Claude & DeepSeek models",
      desc: "Interactive intelligence with live memory, web search, custom persona, and tool invocation.",
      icon: Bot,
      accent: "from-brand-indigo/25 via-brand-purple/20 to-transparent",
      iconTone: "border-brand-indigo/35 bg-brand-indigo/20 text-brand-indigo",
      pill: "AI Core",
    },
    {
      id: "commands" as ViewTab,
      title: "Command Hub",
      tagline: `${stats?.commandCount ?? 0} commands ready`,
      desc: "Full suite of media converters, productivity tools, dictionary, search, and group admin actions.",
      icon: Terminal,
      accent: "from-brand-pink/25 via-brand-purple/20 to-transparent",
      iconTone: "border-brand-pink/35 bg-brand-pink/20 text-brand-pink",
      pill: "Productivity",
    },
    {
      id: "groups" as ViewTab,
      title: "Group Guardian",
      tagline: "Shield & Moderation",
      desc: "Automated anti-link filter, warning strike systems, welcome banners, and anti-spam protocols.",
      icon: Shield,
      accent: "from-emerald-500/25 via-teal-500/15 to-transparent",
      iconTone: "border-emerald-500/35 bg-emerald-500/20 text-emerald-400",
      pill: "Security",
    },
    {
      id: "antiban" as ViewTab,
      title: "Anti-Ban Shield v4.2",
      tagline: "Behavioral humanization active",
      desc: "Composing presence simulation, jitter delay pacing, and automated warm-up ramp protecting linked numbers.",
      icon: ShieldCheck,
      accent: "from-emerald-500/25 via-teal-500/15 to-transparent",
      iconTone: "border-emerald-500/35 bg-emerald-500/20 text-emerald-400",
      pill: "Protection",
    },
    {
      id: "schedules" as ViewTab,
      title: "Automated Schedules",
      tagline: "Cron Timers & Alerts",
      desc: "Schedule automated messages, daily prayer times, recurring reminders, and community broadcasts.",
      icon: Calendar,
      accent: "from-cyan-500/25 via-blue-500/15 to-transparent",
      iconTone: "border-cyan-500/35 bg-cyan-500/20 text-cyan-400",
      pill: "Automation",
    },
    {
      id: "stickers" as ViewTab,
      title: "Sticker Studio",
      tagline: "Media Lab",
      desc: "Instant image and video conversion into animated WhatsApp stickers with custom creator watermarks.",
      icon: Sticker,
      accent: "from-amber-500/25 via-rose-500/15 to-transparent",
      iconTone: "border-amber-500/35 bg-amber-500/20 text-amber-400",
      pill: "Creative",
    },
    {
      id: "autodelete" as ViewTab,
      title: "Auto-Clean Policy",
      tagline: "Ephemeral Messages",
      desc: "Automated chat cleaners to preserve privacy and free up device storage on your WhatsApp account.",
      icon: MessageSquareX,
      accent: "from-rose-500/25 via-purple-500/15 to-transparent",
      iconTone: "border-rose-500/35 bg-rose-500/20 text-rose-400",
      pill: "Privacy",
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* ── Hero Futuristic Command Terminal ── */}
      <Card className="relative overflow-hidden border-line/80 p-0 shadow-2xl">
        {/* Holographic animated background streak */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background: isConnected
              ? "radial-gradient(circle at 15% 20%, rgba(16,185,129,0.2) 0%, transparent 50%), radial-gradient(circle at 85% 80%, rgba(99,102,241,0.2) 0%, transparent 50%)"
              : "radial-gradient(circle at 15% 20%, rgba(245,158,11,0.2) 0%, transparent 50%), radial-gradient(circle at 85% 80%, rgba(236,72,153,0.15) 0%, transparent 50%)",
          }}
        />

        {/* Ambient Top Light Beam */}
        <div
          className="h-[2px] w-full"
          style={{ background: "var(--grad-primary)" }}
        />

        <div className="p-5 sm:p-7 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Status Information */}
            <div className="flex items-start gap-5">
              {/* Radar pulse avatar */}
              <div
                className={`relative flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 transition-all duration-300 shadow-xl ${
                  isConnected
                    ? "border-ok/40 bg-ok/15 text-ok shadow-ok/20"
                    : "border-warn/40 bg-warn/15 text-warn shadow-warn/20"
                }`}
              >
                <Activity size={30} strokeWidth={2.5} className="animate-pulse" />
                <span
                  className={`absolute -bottom-1.5 -end-1.5 size-4 rounded-full border-2 border-panel-solid ${
                    isConnected ? "bg-ok" : "bg-warn"
                  }`}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-text-main font-display">
                    {isConnected ? "Bot Online & Active" : t(status?.state as any, "Session Standby")}
                  </h2>
                  <StatusPill tone={isConnected ? "ok" : "warn"} dot pulse>
                    {isConnected ? t("online") : t("offline")}
                  </StatusPill>
                </div>

                {/* WhatsApp Phone Number Monospace Display */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  {isConnected && linkedNumber ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-line/90 bg-panel-raised/90 px-3 py-1.5 shadow-sm">
                      <Wifi size={14} className="text-ok" />
                      <span className="font-mono text-sm font-black tracking-wider text-text-main">
                        {linkedNumber}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyNumber}
                        className="ms-1 rounded-md p-1 text-faint hover:bg-panel-hover hover:text-text-main transition-colors"
                        title="Copy number"
                      >
                        {copiedNumber ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-muted">
                      {isConnected ? t("activeListening") : t("pausedOrLinking")}
                    </p>
                  )}

                  {isConnected && stats?.uptime && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-line/70 bg-panel-raised/60 px-3 py-1.5 text-xs font-mono text-faint">
                      <TrendingUp size={13} className="text-brand-pink" />
                      <span>Uptime: {formatUptime(stats.uptime)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Station */}
            <div className="flex flex-wrap items-center gap-3">
              {isConnected ? (
                <Button
                  variant="danger"
                  icon={<Square size={16} />}
                  onClick={handleStop}
                  loading={stopping}
                  className="min-w-[120px] rounded-2xl"
                >
                  {t("stop")}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon={<Play size={16} />}
                  onClick={handleStart}
                  loading={starting}
                  className="min-w-[120px] rounded-2xl"
                >
                  {t("start")}
                </Button>
              )}

              <Button
                variant="secondary"
                icon={<Radio size={16} />}
                onClick={() => onNavigate("connection")}
                className="rounded-2xl"
              >
                {t("connection")}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Dynamic Telemetry Bento Grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {statsCards.map((card) => (
          <Card
            key={card.label}
            className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-brand-indigo/40 hover:shadow-xl"
          >
            {/* Ambient light streak */}
            <div className="pointer-events-none absolute -end-6 -top-6 size-24 rounded-full bg-brand-indigo/5 blur-2xl group-hover:bg-brand-indigo/15 transition-all" />

            <div className="relative flex items-start justify-between gap-2">
              <span className="line-clamp-2 text-xs font-black uppercase tracking-wider text-muted font-display">
                {card.label}
              </span>
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200 group-hover:scale-110 shadow-sm ${card.tone}`}
              >
                {card.icon}
              </div>
            </div>

            <div className="relative mt-4 flex items-baseline justify-between">
              <div className="font-mono text-3xl font-black tracking-tight text-text-main sm:text-4xl">
                {loading ? (
                  <span className="skeleton inline-block h-9 w-20 rounded-lg" />
                ) : (
                  card.value
                )}
              </div>
              <span className="rounded-full bg-panel-raised/80 px-2 py-0.5 text-[10px] font-bold text-faint border border-line/60">
                {card.badge}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Smart Features Launch Deck (6 Cyber Cards) ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight text-text-main font-display">
              Autonomous Core Capabilities
            </h3>
            <p className="text-xs text-muted">Direct control over intelligence, automation, and messaging</p>
          </div>
          <span className="text-xs font-mono text-brand-pink font-bold">
            6 Modules Active
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onNavigate(card.id)}
                className={`group relative flex flex-col justify-between rounded-3xl border border-line/80 bg-gradient-to-br ${card.accent} p-5 text-start transition-all duration-300 hover:border-brand-indigo/40 hover:-translate-y-1.5 hover:shadow-2xl card-shadow outline-none cursor-pointer`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300 group-hover:scale-110 shadow-md ${card.iconTone}`}
                    >
                      <Icon size={22} strokeWidth={2.2} />
                    </div>
                    <span className="rounded-full border border-line/80 bg-panel-raised/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted group-hover:text-text-main transition-colors">
                      {card.pill}
                    </span>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-base font-black text-text-main font-display">
                      {card.title}
                    </h4>
                    <div className="text-[11px] font-bold text-brand-indigo mt-0.5">
                      {card.tagline}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted line-clamp-2">
                      {card.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3 text-xs font-bold text-muted group-hover:text-brand-pink transition-colors">
                  <span>Open Module</span>
                  <ChevronRight
                    size={16}
                    className="transition-transform duration-200 group-hover:translate-x-1 rtl:-scale-x-100"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── System Engine Telemetry & Storage HUD ── */}
      <Card className="relative overflow-hidden border-line/70 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ background: "var(--grad-primary)" }}
            >
              <Zap size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-text-main font-display">
                  Yuxli AI Engine
                </span>
                <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-[10px] font-bold text-ok">
                  Self-Hosted Core
                </span>
              </div>
              <p className="text-xs text-muted">
                Private WhatsApp automation without third-party cloud telemetry
              </p>
            </div>
          </div>

          {stats?.dataDir && (
            <div className="flex items-center gap-3 rounded-2xl border border-line/70 bg-panel-raised/70 px-4 py-2.5">
              <Folder size={17} className="text-brand-indigo shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-faint">
                  Storage Directory
                </div>
                <div className="truncate font-mono text-xs text-text-main" dir="ltr">
                  {stats.dataDir}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
