// file: frontend/src/views/OverviewView.tsx

import {
  Activity,
  Bot,
  Calendar,
  ChevronRight,
  Clock,
  Folder,
  MessageSquare,
  Play,
  Radio,
  Sliders,
  Square,
  Terminal,
  TrendingUp,
  Users,
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

  useEffect(() => {
    let mounted = true;
    api
      .getStats()
      .then((res) => { if (mounted && res?.stats) setStats(res.stats); })
      .catch((err) => { toast(err.message, "error"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [toast]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days)  return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const isConnected = status?.state === "connected";
  const linkedNumber = formatLinkedNumber(status?.user?.id);

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
      icon: <Users size={18} />,
      tone: "border-brand-blue/25 bg-brand-blue/10 text-brand-blue",
    },
    {
      label: t("commandCount"),
      value: stats?.commandCount ?? 0,
      icon: <Terminal size={18} />,
      tone: "border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan",
    },
    {
      label: t("uptime"),
      value: formatUptime(stats?.uptime || 0),
      icon: <Clock size={18} />,
      tone: "border-ok/25 bg-ok/10 text-ok",
    },
    {
      label: t("activeSchedules"),
      value: stats?.activeSchedules ?? 0,
      icon: <MessageSquare size={18} />,
      tone: "border-brand-purple/25 bg-brand-purple/10 text-brand-purple",
    },
  ];

  const quickNavCards: Array<{
    id: ViewTab;
    title: string;
    desc: string;
    icon: typeof Radio;
    gradient: string;
    iconColor: string;
  }> = [
    {
      id: "connection",
      title: t("connection"),
      desc: isConnected ? t("connected") : t(status?.state as any, "Disconnected"),
      icon: Radio,
      gradient: "from-brand-cyan/20 to-brand-blue/10",
      iconColor: "text-brand-cyan border-brand-cyan/25 bg-brand-cyan/10",
    },
    {
      id: "ai",
      title: t("ai"),
      desc: "Smart AI agent with tools & memory",
      icon: Bot,
      gradient: "from-brand-purple/20 to-brand-blue/10",
      iconColor: "text-brand-purple border-brand-purple/25 bg-brand-purple/10",
    },
    {
      id: "commands",
      title: t("commands"),
      desc: `${stats?.commandCount ?? 0} commands available`,
      icon: Terminal,
      gradient: "from-brand-blue/20 to-brand-cyan/10",
      iconColor: "text-brand-blue border-brand-blue/25 bg-brand-blue/10",
    },
    {
      id: "settings",
      title: t("settings"),
      desc: "Prefix, security, AI & storage",
      icon: Sliders,
      gradient: "from-ok/20 to-brand-cyan/10",
      iconColor: "text-ok border-ok/25 bg-ok/10",
    },
  ];

  return (
    <div className="flex flex-col gap-5 animate-fade-up">

      {/* ── Hero Connection Card ── */}
      <Card className="relative overflow-hidden">
        {/* Background gradient decoration */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: isConnected
              ? "radial-gradient(ellipse at 80% 50%, rgba(16,185,129,0.15) 0%, transparent 70%)"
              : "radial-gradient(ellipse at 80% 50%, rgba(245,158,11,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Status info */}
          <div className="flex items-start gap-4">
            <div
              className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 transition-all ${
                isConnected
                  ? "border-ok/40 bg-ok/10 text-ok shadow-lg shadow-ok/15"
                  : "border-warn/40 bg-warn/10 text-warn"
              }`}
            >
              <Activity size={26} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-text-main">
                  {isConnected ? t("connected") : t(status?.state as any, "Disconnected")}
                </h2>
                <StatusPill tone={isConnected ? "ok" : "warn"} dot pulse>
                  {isConnected ? t("online") : t("offline")}
                </StatusPill>
              </div>
              <p className="mt-1 text-sm text-muted">
                {isConnected
                  ? linkedNumber
                    ? <bdi dir="ltr">{linkedNumber}</bdi>
                    : t("activeListening")
                  : t("pausedOrLinking")}
              </p>
              {isConnected && stats?.uptime && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-faint">
                  <TrendingUp size={12} />
                  <span>Uptime: {formatUptime(stats.uptime)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isConnected ? (
              <Button
                variant="danger"
                icon={<Square size={15} />}
                onClick={handleStop}
                loading={stopping}
                className="min-w-[100px]"
              >
                {t("stop")}
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<Play size={15} />}
                onClick={handleStart}
                loading={starting}
                className="min-w-[100px]"
              >
                {t("start")}
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Radio size={15} />}
              onClick={() => onNavigate("connection")}
            >
              {t("connection")}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statsCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            loading={loading}
          />
        ))}
      </div>

      {/* ── Quick Nav Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {quickNavCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.id)}
              className={`group relative flex flex-col gap-3 rounded-2xl border border-line/70 bg-gradient-to-br ${card.gradient} p-4 text-start transition-all duration-200 hover:border-brand-blue/30 hover:-translate-y-0.5 hover:shadow-lg card-shadow sm:p-5 outline-none`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border transition-all group-hover:scale-110 ${card.iconColor}`}>
                  <Icon size={18} />
                </div>
                <ChevronRight
                  size={16}
                  className="text-faint/40 transition-all group-hover:text-faint group-hover:translate-x-0.5 rtl:-scale-x-100"
                  aria-hidden
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">{card.title}</h3>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted sm:text-xs">
                  {card.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Yuxli Brand Banner ── */}
      <Card className="relative overflow-hidden border-line/50">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(37,99,255,0.08) 0%, rgba(6,214,232,0.05) 100%)" }}
        />
        <div className="relative flex items-center gap-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ background: "var(--grad-primary)" }}
          >
            <Zap size={22} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-text-main">Yuxli</span>
              <span className="rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
                Premium Bot
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">Professional WhatsApp AI — powered by free AI models</p>
          </div>
          <Button variant="primary" size="sm" icon={<Calendar size={14} />} onClick={() => onNavigate("schedules")}>
            Schedules
          </Button>
        </div>
      </Card>

      {/* ── Data directory ── */}
      {stats?.dataDir && (
        <Card className="flex items-center gap-3.5 py-3">
          <Folder size={18} className="shrink-0 text-faint" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">{t("dataDir")}</div>
            <div className="truncate font-mono text-xs text-text-main" dir="ltr">
              {stats.dataDir}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
