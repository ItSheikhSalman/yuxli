// file: frontend/src/views/AntiBanShieldView.tsx

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cpu,
  Flame,
  Info,
  Lock,
  RefreshCw,
  Save,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../components/Toasts";
import { Button, Card, CardHeader, StatCard } from "../components/ui";

interface AntiBanData {
  healthScore: number;
  riskLevel: string;
  protectionLevel: string;
  minDelay: number;
  maxDelay: number;
  typingPresence: boolean;
  warmupMode: boolean;
  jitterEnabled: boolean;
  rateLimitPerMin: number;
  messagesToday: number;
  totalProtected: number;
  warmupDay: number;
  features: Array<{ id: string; name: string; enabled: boolean; status: string }>;
  logs: Array<{
    id: number;
    jid: string;
    action: string;
    delay_ms: number;
    details: string;
    created_at: number;
  }>;
}

export const AntiBanShieldView: React.FC = () => {
  const { toast } = useToast();
  const [data, setData] = useState<AntiBanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [level, setLevel] = useState<string>("balanced");
  const [typing, setTyping] = useState<boolean>(true);
  const [jitter, setJitter] = useState<boolean>(true);
  const [warmup, setWarmup] = useState<boolean>(true);
  const [minDelay, setMinDelay] = useState<number>(400);
  const [maxDelay, setMaxDelay] = useState<number>(1200);

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await api.getAntiBan();
      if (res?.data) {
        setData(res.data);
        setLevel(res.data.protectionLevel || "balanced");
        setTyping(res.data.typingPresence);
        setJitter(res.data.jitterEnabled);
        setWarmup(res.data.warmupMode);
        setMinDelay(res.data.minDelay || 400);
        setMaxDelay(res.data.maxDelay || 1200);
      }
    } catch {
      toast("Failed to load Anti-Ban telemetry", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const handleSave = async (overrides?: Partial<{
    protectionLevel: string;
    typingPresence: boolean;
    jitterEnabled: boolean;
    warmupMode: boolean;
    minDelay: number;
    maxDelay: number;
  }>) => {
    setSaving(true);
    try {
      const payload = {
        protectionLevel: overrides?.protectionLevel ?? level,
        typingPresence: overrides?.typingPresence ?? typing,
        jitterEnabled: overrides?.jitterEnabled ?? jitter,
        warmupMode: overrides?.warmupMode ?? warmup,
        minDelay: overrides?.minDelay ?? minDelay,
        maxDelay: overrides?.maxDelay ?? maxDelay,
      };
      await api.updateAntiBan(payload);
      toast("Anti-Ban Shield protection parameters saved", "success");
      fetchTelemetry();
    } catch {
      toast("Failed to update Anti-Ban settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPreset = (preset: "maximum" | "balanced" | "throughput") => {
    setLevel(preset);
    let newMin = 400;
    let newMax = 1200;
    if (preset === "maximum") {
      newMin = 1500;
      newMax = 4500;
    } else if (preset === "throughput") {
      newMin = 250;
      newMax = 600;
    }
    setMinDelay(newMin);
    setMaxDelay(newMax);
    handleSave({
      protectionLevel: preset,
      minDelay: newMin,
      maxDelay: newMax,
      typingPresence: true,
      jitterEnabled: true,
      warmupMode: preset !== "throughput",
    });
  };

  const healthScore = data?.healthScore ?? 98;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Top Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-line/80 bg-panel-solid/90 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-emerald-500/10 blur-[100px]" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 size-80 rounded-full bg-brand-indigo/10 blur-[100px]" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              <ShieldCheck size={14} className="animate-pulse" />
              <span>ENTERPRISE ANTI-BAN ENGINE V4.2</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-main font-display">
              Autonomous Anti-Ban Shield & Telemetry
            </h1>
            <p className="text-sm text-text-muted leading-relaxed">
              Algorithmic behavioral humanization, composing presence injection, and randomized latency jitter to safeguard your linked WhatsApp numbers against Meta automated ban triggers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchTelemetry}
              loading={loading}
              icon={<RefreshCw size={14} />}
            >
              Sync Telemetry
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSave()}
              loading={saving}
              icon={<Save size={14} />}
            >
              Apply Shield Policy
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stat Bento Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Protection Health Score"
          value={`${healthScore}%`}
          icon={<ShieldCheck size={20} className="text-emerald-400" />}
          tone="border-emerald-500/30 bg-emerald-500/15"
        />
        <StatCard
          label="Outbound Velocity"
          value={`${data?.rateLimitPerMin ?? 25} msg/m`}
          icon={<Activity size={20} className="text-brand-indigo" />}
          tone="border-brand-indigo/30 bg-brand-indigo/15"
        />
        <StatCard
          label="Pacing Jitter Window"
          value={`${minDelay}ms–${maxDelay}ms`}
          icon={<Clock size={20} className="text-cyan-400" />}
          tone="border-cyan-500/30 bg-cyan-500/15"
        />
        <StatCard
          label="Adaptive Warmup Ramp"
          value={`Day ${data?.warmupDay ?? 4} / 14`}
          icon={<Flame size={20} className="text-amber-400" />}
          tone="border-amber-500/30 bg-amber-500/15"
        />
      </div>

      {/* ── Preset Policy Selector ── */}
      <Card>
        <CardHeader
          title="Protection Profile Presets"
          description="Choose a tailored operational posture according to the age and reputation of your WhatsApp number."
          icon={<Sliders size={18} className="text-brand-indigo" />}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          {/* Maximum Shield */}
          <div
            onClick={() => handleSelectPreset("maximum")}
            className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 relative ${
              level === "maximum"
                ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                : "border-line/70 bg-panel hover:border-line hover:bg-panel-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <ShieldAlert size={18} />
                </div>
                <span className="font-bold text-text-main text-sm">Maximum Shield</span>
              </div>
              {level === "maximum" && (
                <span className="text-xs font-bold bg-emerald-500 text-black px-2 py-0.5 rounded-full">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mb-3">
              For newly linked or fresh phone numbers (&lt; 14 days). Enforces extended composing presence and generous 1.5s–4.5s delays.
            </p>
            <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Safe Max: 150 msgs / day
            </div>
          </div>

          {/* Balanced Enterprise */}
          <div
            onClick={() => handleSelectPreset("balanced")}
            className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 relative ${
              level === "balanced"
                ? "border-brand-indigo bg-brand-indigo/10 shadow-[0_0_25px_rgba(99,102,241,0.2)]"
                : "border-line/70 bg-panel hover:border-line hover:bg-panel-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-indigo/20 text-brand-indigo">
                  <ShieldCheck size={18} />
                </div>
                <span className="font-bold text-text-main text-sm">Balanced Enterprise</span>
              </div>
              {level === "balanced" && (
                <span className="text-xs font-bold bg-brand-indigo text-white px-2 py-0.5 rounded-full">
                  RECOMMENDED
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mb-3">
              Optimal standard for production bots. Balanced 400ms–1,200ms natural typing emulation and dynamic anti-spam jitter.
            </p>
            <div className="text-[11px] font-medium text-brand-indigo flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Safe Max: 600 msgs / day
            </div>
          </div>

          {/* High Throughput */}
          <div
            onClick={() => handleSelectPreset("throughput")}
            className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 relative ${
              level === "throughput"
                ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_25px_rgba(6,182,212,0.2)]"
                : "border-line/70 bg-panel hover:border-line hover:bg-panel-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Zap size={18} />
                </div>
                <span className="font-bold text-text-main text-sm">High Throughput</span>
              </div>
              {level === "throughput" && (
                <span className="text-xs font-bold bg-cyan-500 text-black px-2 py-0.5 rounded-full">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mb-3">
              For aged, verified WhatsApp numbers. Minimal 250ms–600ms latency for rapid multi-group broadcasts.
            </p>
            <div className="text-[11px] font-medium text-cyan-400 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Safe Max: 1,500+ msgs / day
            </div>
          </div>
        </div>
      </Card>

      {/* ── Protection Parameters Configuration ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Behavioral Emulation Modules"
            description="Toggle specific anti-detection heuristics active across all outbound handlers."
            icon={<Cpu size={18} className="text-emerald-400" />}
          />
          <div className="space-y-4 mt-2">
            {/* Typing presence */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-line/60 bg-surface/50">
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <span>Humanized Typing Presence</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Emulates WhatsApp &quot;composing&quot; and &quot;paused&quot; events scaled to message character length.
                </p>
              </div>
              <input
                type="checkbox"
                checked={typing}
                onChange={(e) => {
                  setTyping(e.target.checked);
                  handleSave({ typingPresence: e.target.checked });
                }}
                className="h-5 w-5 rounded border-line text-brand-indigo focus:ring-brand-indigo/50 cursor-pointer"
              />
            </div>

            {/* Jitter */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-line/60 bg-surface/50">
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <span>Randomized Jitter Delays</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Adds variable millisecond micro-delays to disrupt static automation timing footprints.
                </p>
              </div>
              <input
                type="checkbox"
                checked={jitter}
                onChange={(e) => {
                  setJitter(e.target.checked);
                  handleSave({ jitterEnabled: e.target.checked });
                }}
                className="h-5 w-5 rounded border-line text-brand-indigo focus:ring-brand-indigo/50 cursor-pointer"
              />
            </div>

            {/* Warmup */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-line/60 bg-surface/50">
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-text-main flex items-center gap-2">
                  <span>Adaptive Number Warm-Up Ramp</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    14-Day Cycle
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Gradually increments daily dispatch ceilings to build organic network trust with WhatsApp servers.
                </p>
              </div>
              <input
                type="checkbox"
                checked={warmup}
                onChange={(e) => {
                  setWarmup(e.target.checked);
                  handleSave({ warmupMode: e.target.checked });
                }}
                className="h-5 w-5 rounded border-line text-brand-indigo focus:ring-brand-indigo/50 cursor-pointer"
              />
            </div>
          </div>
        </Card>

        {/* Pacing Bounds Slider / Control */}
        <Card>
          <CardHeader
            title="Micro-Delay Thresholds"
            description="Fine-tune the lower and upper bounds of randomized inter-message dispatch intervals."
            icon={<Clock size={18} className="text-cyan-400" />}
          />
          <div className="space-y-5 mt-2">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-text-main">Minimum Dispatch Gap (ms)</span>
                <span className="text-brand-indigo font-mono font-bold">{minDelay} ms</span>
              </div>
              <input
                type="range"
                min={200}
                max={3000}
                step={50}
                value={minDelay}
                onChange={(e) => setMinDelay(Number(e.target.value))}
                className="w-full accent-brand-indigo cursor-pointer"
              />
              <span className="text-[11px] text-text-muted">Minimum rest before dispatching another response.</span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-text-main">Maximum Dispatch Gap (ms)</span>
                <span className="text-brand-indigo font-mono font-bold">{maxDelay} ms</span>
              </div>
              <input
                type="range"
                min={500}
                max={8000}
                step={100}
                value={maxDelay}
                onChange={(e) => setMaxDelay(Math.max(minDelay + 100, Number(e.target.value)))}
                className="w-full accent-brand-indigo cursor-pointer"
              />
              <span className="text-[11px] text-text-muted">Upper limit of randomized typing + transmission latency.</span>
            </div>

            <div className="rounded-xl border border-line/60 bg-surface/50 p-3.5 text-xs text-text-muted flex items-start gap-2.5">
              <Info size={16} className="text-brand-indigo shrink-0 mt-0.5" />
              <span>
                Configured values are stored directly in the enterprise SQLite database and applied instantaneously to all outbound message queues.
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Real-Time Telemetry & Protection Log Table ── */}
      <Card>
        <CardHeader
          title="Live Anti-Ban Protection Audit Stream"
          description="Real-time record of outbound messages paced, presence-emulated, and shielded by the anti-ban engine."
          icon={<Activity size={18} className="text-emerald-400" />}
          actions={
            <span className="text-xs font-semibold text-text-muted font-mono">
              Total Protected: {data?.totalProtected ?? 0}
            </span>
          }
        />
        <div className="mt-3">
          {data?.logs && data.logs.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-line/70">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface/80 text-text-muted font-semibold uppercase tracking-wider text-[10px] border-b border-line/70">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Destination JID</th>
                    <th className="px-4 py-3">Protection Action</th>
                    <th className="px-4 py-3">Jitter Latency</th>
                    <th className="px-4 py-3">Heuristic Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40 font-mono">
                  {data.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface/40 transition-colors">
                      <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2.5 text-text-main font-semibold whitespace-nowrap">
                        {log.jid}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={10} />
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-cyan-400 font-bold whitespace-nowrap">
                        +{log.delay_ms} ms
                      </td>
                      <td className="px-4 py-2.5 text-text-muted max-w-xs truncate font-sans">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line/80 p-8 text-center">
              <ShieldCheck size={36} className="mx-auto text-emerald-400/50 mb-2" />
              <div className="text-sm font-semibold text-text-main">Anti-Ban Engine Guarding Live</div>
              <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
                No outbound traffic intercepted yet during this monitoring period. The shield is fully primed and will log jitter details as messages are sent.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
export default AntiBanShieldView;
