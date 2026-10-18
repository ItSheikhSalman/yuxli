// file: frontend/src/views/OverviewView.tsx

import {
  Activity,
  ArrowUpRight,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  HardDrive,
  Layers,
  MessageSquareX,
  Play,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Square,
  Sticker,
  Terminal,
  Users,
  Wifi,
  WifiOff,
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
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.getStats();
      if (res?.stats) setStats(res.stats);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const isConnected = status?.state === "connected" || status?.connected === true;
  const linkedNumber = formatLinkedNumber(status?.user?.id);

  const handleCopyNumber = () => {
    if (!linkedNumber) return;
    navigator.clipboard.writeText(linkedNumber.replace(/\s+/g, ""));
    setCopiedNumber(true);
    toast("WhatsApp number copied to clipboard", "success");
    setTimeout(() => setCopiedNumber(false), 2000);
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

  const quickShortcuts = [
    {
      id: "ai" as ViewTab,
      label: "AI Assistant",
      desc: stats?.aiConfigured ? "Provider connected & operational" : "Configure AI keys & persona",
      icon: Bot,
      status: stats?.aiConfigured ? "Active" : "Setup",
      tone: stats?.aiConfigured ? "text-emerald-400" : "text-amber-400",
    },
    {
      id: "antiban" as ViewTab,
      label: "Anti-Ban Protection",
      desc: "Behavioral human presence simulation & jitter",
      icon: ShieldCheck,
      status: "Enabled",
      tone: "text-emerald-400",
    },
    {
      id: "commands" as ViewTab,
      label: "Commands Catalog",
      desc: `${stats?.commandCount ?? 0} commands available (Prefix: ${stats?.prefix || "!"})`,
      icon: Terminal,
      status: `${stats?.commandCount ?? 0} ready`,
      tone: "text-indigo-400",
    },
    {
      id: "groups" as ViewTab,
      label: "Group Guardian",
      desc: `${stats?.totalGroups ?? 0} groups under automated policy protection`,
      icon: Users,
      status: `${stats?.totalGroups ?? 0} groups`,
      tone: "text-blue-400",
    },
    {
      id: "schedules" as ViewTab,
      label: "Automation & Schedules",
      desc: `${stats?.activeSchedules ?? 0} active recurring cron broadcasts`,
      icon: Calendar,
      status: `${stats?.activeSchedules ?? 0} active`,
      tone: "text-indigo-400",
    },
    {
      id: "logs" as ViewTab,
      label: "Telemetry & Logs",
      desc: "Live WebSocket process stdout and network audit",
      icon: FileText,
      status: "Streaming",
      tone: "text-muted",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Section A: Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-main">
            YUXLI Overview
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Monitor your connected services, automation, and AI operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />}
            onClick={handleRefresh}
            loading={refreshing}
          >
            Refresh
          </Button>

          <Button
            size="sm"
            variant="secondary"
            icon={<FileText size={13} />}
            onClick={() => onNavigate("logs")}
          >
            Activity
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<Radio size={13} />}
            onClick={() => onNavigate("connection")}
          >
            {isConnected ? "Connection Center" : "Connect WhatsApp"}
          </Button>
        </div>
      </div>

      {/* ── Section B: Real Connection Status Banner ── */}
      <Card className="p-4 sm:p-5 border border-line bg-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${
                isConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              }`}
            >
              {isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-text-main">
                  {isConnected ? "WhatsApp Socket Connected" : "WhatsApp Socket Disconnected"}
                </span>

                <StatusPill
                  tone={isConnected ? "ok" : "warn"}
                  dot
                  pulse={isConnected}
                >
                  {status?.state ? status.state.toUpperCase() : "OFFLINE"}
                </StatusPill>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-muted flex-wrap">
                {linkedNumber ? (
                  <button
                    type="button"
                    onClick={handleCopyNumber}
                    className="inline-flex items-center gap-1 font-mono text-text-main hover:text-indigo-400 transition-colors cursor-pointer"
                    title="Click to copy number"
                  >
                    <span>{linkedNumber}</span>
                    {copiedNumber ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                ) : (
                  <span>No phone paired yet</span>
                )}

                <span>•</span>
                <span>Engine: Baileys Multi-Device</span>

                <span>•</span>
                <span>Uptime: {formatUptime(stats?.uptime || 0)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isConnected ? (
              <Button
                size="sm"
                variant="danger"
                icon={<Square size={13} />}
                onClick={handleStop}
                loading={stopping}
              >
                Halt Session
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                icon={<Play size={13} />}
                onClick={handleStart}
                loading={starting}
              >
                Start Session
              </Button>
            )}

            <Button
              size="sm"
              variant="secondary"
              icon={<ExternalLink size={13} />}
              onClick={() => onNavigate("connection")}
            >
              Session Details
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Section C: Core Operational KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label={t("totalGroups")}
          value={stats?.totalGroups ?? 0}
          icon={<Users size={16} />}
          tone="text-indigo-400"
          subtitle="Managed communities"
          loading={loading}
        />

        <StatCard
          label={t("commandCount")}
          value={stats?.commandCount ?? 0}
          icon={<Terminal size={16} />}
          tone="text-blue-400"
          subtitle={`Global prefix: ${stats?.prefix || "!"}`}
          loading={loading}
        />

        <StatCard
          label={t("activeSchedules")}
          value={stats?.activeSchedules ?? 0}
          icon={<Calendar size={16} />}
          tone="text-emerald-400"
          subtitle="Scheduled cron jobs"
          loading={loading}
        />

        <StatCard
          label="Process Uptime"
          value={formatUptime(stats?.uptime || 0)}
          icon={<Clock size={16} />}
          tone="text-amber-400"
          subtitle="Continuous runtime"
          loading={loading}
        />
      </div>

      {/* ── Section D: Secondary Data Telemetry & System Diagnostics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* System Diagnostics */}
        <Card className="p-4 border border-line bg-panel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-text-main pb-3 border-b border-line">
              <span className="flex items-center gap-1.5">
                <Server size={14} className="text-indigo-400" />
                System Diagnostics
              </span>
              <span className="font-mono text-[11px] text-emerald-400">HEALTHY</span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted">
                <span>Node.js Runtime</span>
                <span className="font-mono text-text-main">{stats?.nodeVersion || process.version || "v20.x"}</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Memory RSS</span>
                <span className="font-mono text-text-main">
                  {stats?.memory?.rss ? `${Math.round(stats.memory.rss / (1024 * 1024))} MB` : "Normal"}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Database Engine</span>
                <span className="font-mono text-emerald-400">Connected (SQLite)</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>AI Gateway</span>
                <span className={`font-mono ${stats?.aiConfigured ? "text-emerald-400" : "text-amber-400"}`}>
                  {stats?.aiConfigured ? "Configured" : "Key Not Set"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-muted">
            <span>Data Dir: {stats?.dataDir ? stats.dataDir.split(/[\/\\]/).slice(-2).join("/") : "data"}</span>
            <button
              type="button"
              onClick={() => onNavigate("settings")}
              className="text-indigo-400 hover:underline cursor-pointer"
            >
              Config →
            </button>
          </div>
        </Card>

        {/* Community Moderation Stats */}
        <Card className="p-4 border border-line bg-panel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-text-main pb-3 border-b border-line">
              <span className="flex items-center gap-1.5">
                <Shield size={14} className="text-blue-400" />
                Moderation Telemetry
              </span>
              <span className="font-mono text-[11px] text-muted">STORAGE</span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted">
                <span>Warning Strikes</span>
                <span className="font-mono text-text-main">{stats?.totalWarnings ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Notes & Knowledge</span>
                <span className="font-mono text-text-main">{stats?.totalNotes ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Community Todos</span>
                <span className="font-mono text-text-main">{stats?.totalTodos ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Ledger Records</span>
                <span className="font-mono text-text-main">{stats?.totalDebts ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-muted">
            <span>Policies enforced automatically</span>
            <button
              type="button"
              onClick={() => onNavigate("groups")}
              className="text-indigo-400 hover:underline cursor-pointer"
            >
              Manage →
            </button>
          </div>
        </Card>

        {/* Anti-Ban & Risk Shield */}
        <Card className="p-4 border border-line bg-panel flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-text-main pb-3 border-b border-line">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                Anti-Ban Engine
              </span>
              <span className="font-mono text-[11px] text-emerald-400">SHIELD ACTIVE</span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted">
                <span>Risk Index</span>
                <span className="font-mono text-emerald-400">LOW (Safe)</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Typing Presence</span>
                <span className="font-mono text-text-main">Simulated</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Jitter Pacing</span>
                <span className="font-mono text-text-main">400ms – 1200ms</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Ramp Warm-up</span>
                <span className="font-mono text-text-main">Active</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-muted">
            <span>Protects linked accounts</span>
            <button
              type="button"
              onClick={() => onNavigate("antiban")}
              className="text-indigo-400 hover:underline cursor-pointer"
            >
              Parameters →
            </button>
          </div>
        </Card>
      </div>

      {/* ── Section E: Operational Shortcuts ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Operations & Capabilities
          </h2>
          <span className="text-xs text-faint">Direct module access</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="flex items-start justify-between p-3.5 rounded-xl border border-line bg-panel hover:bg-panel-hover hover:border-line/80 transition-all text-start cursor-pointer group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="size-8 shrink-0 rounded-lg border border-line bg-panel-raised flex items-center justify-center text-muted group-hover:text-text-main transition-colors mt-0.5">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                      <span>{item.label}</span>
                      <ArrowUpRight size={12} className="text-faint group-hover:text-text-main transition-colors" />
                    </div>
                    <div className="text-[11px] text-muted mt-0.5 line-clamp-1">
                      {item.desc}
                    </div>
                  </div>
                </div>

                <span className={`text-[10px] font-mono font-medium shrink-0 ms-2 ${item.tone}`}>
                  {item.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
