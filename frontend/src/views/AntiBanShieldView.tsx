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
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../components/Toasts";
import { Button, Card, CardHeader } from "../components/ui";
import { StatCard } from "../components/ui/card";

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
      toast("Anti-Ban Shield parameters updated successfully", "success");
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
    <div className="flex flex-col gap-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-main">
            Anti-Ban Shield v4.2
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Behavioral human presence simulation, micro-latency jitter, and volume pacing to safeguard connected accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchTelemetry}
            loading={loading}
            icon={<RefreshCw size={13} />}
          >
            Sync Telemetry
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSave()}
            loading={saving}
            icon={<Save size={13} />}
          >
            Apply Policy
          </Button>
        </div>
      </div>

      {/* ── Honest Safeguard Disclaimer Notice ── */}
      <div className="rounded-lg border border-line bg-panel p-3.5 flex items-start gap-3 text-xs text-muted">
        <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-text-main font-semibold">Configurable Protection Safeguards:</strong>{" "}
          These heuristics emulate organic user behaviors to reduce automated spam pattern triggers. Note that platform policies are determined by Meta; software safeguards minimize risk profiles but cannot guarantee absolute immunity from platform enforcement.
        </div>
      </div>

      {/* ── Core KPI Bento ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Health Index"
          value={`${healthScore}%`}
          icon={<ShieldCheck size={16} />}
          tone="text-emerald-400"
          subtitle="Connection integrity"
          loading={loading}
        />
        <StatCard
          label="Outbound Rate"
          value={`${data?.rateLimitPerMin ?? 25} msg/m`}
          icon={<Activity size={16} />}
          tone="text-indigo-400"
          subtitle="Throughput ceiling"
          loading={loading}
        />
        <StatCard
          label="Pacing Jitter"
          value={`${minDelay}ms–${maxDelay}ms`}
          icon={<Clock size={16} />}
          tone="text-blue-400"
          subtitle="Latency window"
          loading={loading}
        />
        <StatCard
          label="Warmup Ramp"
          value={`Day ${data?.warmupDay ?? 4} / 14`}
          icon={<Flame size={16} />}
          tone="text-amber-400"
          subtitle="Graduated volume"
          loading={loading}
        />
      </div>

      {/* ── Protection Profile Presets ── */}
      <Card className="p-4 sm:p-5 border border-line bg-panel">
        <CardHeader
          title="Protection Profile Presets"
          description="Select an operational posture matching your WhatsApp number's age and activity volume."
          icon={<Sliders size={16} />}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          {/* Maximum Shield */}
          <div
            onClick={() => handleSelectPreset("maximum")}
            className={`cursor-pointer rounded-lg border p-4 transition-all text-start ${
              level === "maximum"
                ? "border-emerald-500/50 bg-emerald-500/10"
                : "border-line bg-panel-raised hover:border-line/80"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-emerald-400" />
                <span className="font-semibold text-text-main text-xs sm:text-sm">Maximum Shield</span>
              </div>
              {level === "maximum" && (
                <span className="text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-muted mb-3 leading-relaxed">
              Recommended for new or unverified numbers (&lt; 14 days). Enforces extended typing presence and generous 1.5s–4.5s delays.
            </p>
            <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Safe Target: ~150 msgs / day
            </div>
          </div>

          {/* Balanced Enterprise */}
          <div
            onClick={() => handleSelectPreset("balanced")}
            className={`cursor-pointer rounded-lg border p-4 transition-all text-start ${
              level === "balanced"
                ? "border-indigo-500/50 bg-indigo-500/10"
                : "border-line bg-panel-raised hover:border-line/80"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-400" />
                <span className="font-semibold text-text-main text-xs sm:text-sm">Balanced Enterprise</span>
              </div>
              {level === "balanced" && (
                <span className="text-[10px] font-mono font-semibold bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">
                  RECOMMENDED
                </span>
              )}
            </div>
            <p className="text-xs text-muted mb-3 leading-relaxed">
              Standard production profile. Balanced 400ms–1,200ms natural typing emulation and dynamic anti-spam jitter.
            </p>
            <div className="text-[11px] font-medium text-indigo-400 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Safe Target: ~600 msgs / day
            </div>
          </div>

          {/* High Throughput */}
          <div
            onClick={() => handleSelectPreset("throughput")}
            className={`cursor-pointer rounded-lg border p-4 transition-all text-start ${
              level === "throughput"
                ? "border-blue-500/50 bg-blue-500/10"
                : "border-line bg-panel-raised hover:border-line/80"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-blue-400" />
                <span className="font-semibold text-text-main text-xs sm:text-sm">High Throughput</span>
              </div>
              {level === "throughput" && (
                <span className="text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-muted mb-3 leading-relaxed">
              For aged numbers with high reputation. Low 250ms–600ms latency for rapid multi-recipient dispatch.
            </p>
            <div className="text-[11px] font-medium text-blue-400 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Safe Target: 1,500+ msgs / day
            </div>
          </div>
        </div>
      </Card>

      {/* ── Protection Parameters Configuration ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <Card className="p-4 sm:p-5 border border-line bg-panel">
          <CardHeader
            title="Behavioral Heuristics"
            description="Toggle behavioral modules applied across outbound message handlers."
            icon={<Cpu size={16} />}
          />
          <div className="space-y-3 mt-4">
            {/* Typing presence */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-line bg-panel-raised">
              <div className="pr-3">
                <div className="text-xs font-semibold text-text-main flex items-center gap-2">
                  <span>Humanized Typing Presence</span>
                  <span className="text-[10px] font-mono font-medium text-emerald-400">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                  Emulates WhatsApp &quot;composing&quot; and &quot;paused&quot; events scaled to message character count.
                </p>
              </div>
              <input
                type="checkbox"
                checked={typing}
                onChange={(e) => {
                  setTyping(e.target.checked);
                  handleSave({ typingPresence: e.target.checked });
                }}
                className="h-4 w-4 rounded border-line text-indigo-600 focus:ring-indigo-500/40 cursor-pointer"
              />
            </div>

            {/* Jitter */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-line bg-panel-raised">
              <div className="pr-3">
                <div className="text-xs font-semibold text-text-main flex items-center gap-2">
                  <span>Randomized Jitter Delays</span>
                  <span className="text-[10px] font-mono font-medium text-emerald-400">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                  Adds variable millisecond micro-delays to disrupt predictable automation timing footprints.
                </p>
              </div>
              <input
                type="checkbox"
                checked={jitter}
                onChange={(e) => {
                  setJitter(e.target.checked);
                  handleSave({ jitterEnabled: e.target.checked });
                }}
                className="h-4 w-4 rounded border-line text-indigo-600 focus:ring-indigo-500/40 cursor-pointer"
              />
            </div>

            {/* Warmup */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-line bg-panel-raised">
              <div className="pr-3">
                <div className="text-xs font-semibold text-text-main flex items-center gap-2">
                  <span>Adaptive Warm-Up Ramp</span>
                  <span className="text-[10px] font-mono font-medium text-amber-400">
                    14-Day Cycle
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                  Gradually increments daily dispatch limits to build organic network trust with WhatsApp servers.
                </p>
              </div>
              <input
                type="checkbox"
                checked={warmup}
                onChange={(e) => {
                  setWarmup(e.target.checked);
                  handleSave({ warmupMode: e.target.checked });
                }}
                className="h-4 w-4 rounded border-line text-indigo-600 focus:ring-indigo-500/40 cursor-pointer"
              />
            </div>
          </div>
        </Card>

        {/* Pacing Bounds Slider / Control */}
        <Card className="p-4 sm:p-5 border border-line bg-panel">
          <CardHeader
            title="Micro-Delay Thresholds"
            description="Fine-tune lower and upper bounds of randomized inter-message dispatch intervals."
            icon={<Clock size={16} />}
          />
          <div className="space-y-4 mt-4">
            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="text-text-main">Minimum Dispatch Gap</span>
                <span className="text-indigo-400 font-mono font-semibold">{minDelay} ms</span>
              </div>
              <input
                type="range"
                min={200}
                max={3000}
                step={50}
                value={minDelay}
                onChange={(e) => setMinDelay(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <span className="text-[10px] text-muted">Minimum rest duration before next response dispatch.</span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="text-text-main">Maximum Dispatch Gap</span>
                <span className="text-indigo-400 font-mono font-semibold">{maxDelay} ms</span>
              </div>
              <input
                type="range"
                min={500}
                max={8000}
                step={100}
                value={maxDelay}
                onChange={(e) => setMaxDelay(Math.max(minDelay + 100, Number(e.target.value)))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <span className="text-[10px] text-muted">Upper ceiling of randomized typing and transmission latency.</span>
            </div>

            <div className="rounded-lg border border-line bg-panel-raised p-3 text-xs text-muted flex items-start gap-2">
              <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-relaxed">
                Changes persist directly in the backend datastore and apply immediately across all outbound dispatch queues.
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Protection Log Audit Table ── */}
      <Card className="p-4 sm:p-5 border border-line bg-panel">
        <CardHeader
          title="Protection Telemetry Audit Log"
          description="Real-time log of outbound messages paced, presence-emulated, and safeguarded by the engine."
          icon={<Activity size={16} />}
          actions={
            <span className="text-xs font-medium text-muted font-mono">
              Total Protected: {data?.totalProtected ?? 0}
            </span>
          }
        />

        <div className="mt-4">
          {data?.logs && data.logs.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-panel-raised text-muted font-medium uppercase tracking-wider text-[10px] border-b border-line">
                  <tr>
                    <th className="px-3.5 py-2.5">Timestamp</th>
                    <th className="px-3.5 py-2.5">Destination JID</th>
                    <th className="px-3.5 py-2.5">Action</th>
                    <th className="px-3.5 py-2.5">Jitter Latency</th>
                    <th className="px-3.5 py-2.5">Heuristic Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono text-[11px]">
                  {data.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-panel-hover/50 transition-colors">
                      <td className="px-3.5 py-2 text-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-3.5 py-2 text-text-main font-medium whitespace-nowrap">
                        {log.jid}
                      </td>
                      <td className="px-3.5 py-2">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={10} />
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-blue-400 font-semibold whitespace-nowrap">
                        +{log.delay_ms} ms
                      </td>
                      <td className="px-3.5 py-2 text-muted max-w-xs truncate font-sans text-xs">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line p-8 text-center">
              <ShieldCheck size={32} className="mx-auto text-emerald-400/50 mb-2" />
              <div className="text-xs font-semibold text-text-main">Anti-Ban Engine Guarding Live</div>
              <p className="text-[11px] text-muted mt-1 max-w-sm mx-auto">
                No outbound traffic intercepted yet during this monitoring period. The shield is active and will log telemetry details as messages are sent.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AntiBanShieldView;
