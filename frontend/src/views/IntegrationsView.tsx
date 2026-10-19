// file: frontend/src/views/IntegrationsView.tsx
//
// AHM7 x MAKKI Integration Management Hub
// Empirically verified service catalog, health metrics, and per-service controls.

import type React from "react";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  Globe,
  Layers,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toasts";
import { Button, Card, StatusPill } from "../components/ui";

interface Ahm7Service {
  id: string;
  name: string;
  category: string;
  description: string;
  command: string;
  endpoint: string;
  method: string;
  status: string;
  expectedFormat?: string;
  tierRequired: string;
  enabled: boolean;
  health: {
    status: string;
    consecutiveFailures: number;
    totalSuccesses: number;
    totalFailures: number;
    lastSuccessAt: number | null;
    lastFailureAt: number | null;
    lastError: string | null;
  };
}

export const IntegrationsView: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [providerInfo, setProviderInfo] = useState<any>(null);
  const [services, setServices] = useState<Ahm7Service[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await api.getAhm7Integrations();
      if (res.success) {
        setProviderInfo(res.provider);
        setServices(res.services);
      }
    } catch (err: any) {
      toast(err.message || "Failed to load integrations", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleToggle = async (service: Ahm7Service) => {
    const nextState = !service.enabled;
    setTogglingId(service.id);
    try {
      const res = await api.toggleAhm7Service(service.id, nextState);
      if (res.success) {
        setServices((prev) =>
          prev.map((s) => (s.id === service.id ? { ...s, enabled: res.enabled } : s)),
        );
        toast(`${service.name} ${res.enabled ? "enabled" : "disabled"}`, "success");
      }
    } catch (err: any) {
      toast(err.message || "Failed to toggle service", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleRunTest = async (service: Ahm7Service) => {
    setTestingId(service.id);
    try {
      const res = await api.testAhm7Service(service.id);
      if (res.success) {
        toast(`✅ ${service.name} verified: responded in ${res.durationMs}ms`, "success");
        // Update local health state
        setServices((prev) =>
          prev.map((s) =>
            s.id === service.id ? { ...s, health: res.health } : s,
          ),
        );
      }
    } catch (err: any) {
      toast(`❌ Test failed for ${service.name}: ${err.message || "Timeout"}`, "error");
      fetchIntegrations();
    } finally {
      setTestingId(null);
    }
  };

  const categories = ["All", "Media", "Documents", "Productivity", "Discovery", "AI"];

  const filteredServices = services.filter((s) => {
    const matchesCategory = selectedCategory === "All" || s.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.command.toLowerCase().includes(q) ||
      s.endpoint.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const enabledCount = services.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6">
      {/* Provider Hero Card */}
      <Card className="relative overflow-hidden border border-border/80 bg-gradient-to-br from-card/90 via-card/60 to-primary/5 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-3.5 h-3.5" />
              Official API Hub Integration
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-main flex items-center gap-2">
              AHM7 x MAKKI Integration Layer
            </h1>
            <p className="text-sm text-text-muted max-w-2xl">
              Empirically verified, high-performance external microservices powering YUXLI's multimedia downloads, neural text-to-speech, academic PDF compilation, and workflow discovery.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://ahm7xmakki.com/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-border/80 bg-card hover:bg-card-hover text-text-main transition-colors shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              API Documentation
            </a>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchIntegrations}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
          <div>
            <div className="text-xs text-text-muted font-medium">Catalog Services</div>
            <div className="text-xl font-bold text-text-main mt-0.5">{services.length}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted font-medium">Active & Enabled</div>
            <div className="text-xl font-bold text-emerald-500 mt-0.5">{enabledCount}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted font-medium">Isolation Level</div>
            <div className="text-xl font-bold text-primary mt-0.5">SSRF Guarded</div>
          </div>
          <div>
            <div className="text-xs text-text-muted font-medium">Circuit Breaker</div>
            <div className="text-xl font-bold text-emerald-500 mt-0.5">Enforced</div>
          </div>
        </div>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "bg-card border border-border text-text-muted hover:text-text-main hover:bg-card-hover"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search API or command..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card text-text-main placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto opacity-70" />
          <p className="text-sm text-text-muted">Loading integration registry...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <Card className="py-16 text-center border-dashed">
          <Compass className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold text-text-main">No integrations found</p>
          <p className="text-xs text-text-muted mt-1">Try selecting another category or clearing your search query.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((service) => {
            const isUnhealthy = service.health?.status === "unhealthy";
            const isDegraded = service.health?.status === "degraded";

            return (
              <Card
                key={service.id}
                className={`flex flex-col justify-between border transition-all hover:border-primary/40 hover:shadow-lg ${
                  !service.enabled
                    ? "opacity-60 bg-card/40 border-border/50"
                    : "border-border/80 bg-card"
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Top Bar: Category & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                      {service.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                        {service.method}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          service.status === "VERIFIED_WORKING"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        }`}
                      >
                        {service.status === "VERIFIED_WORKING" ? "VERIFIED" : "PARTIAL"}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-text-main flex items-center justify-between">
                      {service.name}
                      <span className="text-[11px] font-normal text-text-muted">
                        Tier: <span className="font-semibold text-primary uppercase">{service.tierRequired}</span>
                      </span>
                    </h3>
                    <p className="text-xs text-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                      {service.description}
                    </p>
                  </div>

                  {/* Metadata Chips */}
                  <div className="space-y-1.5 pt-2 border-t border-border/50 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-text-muted">
                      <span>Endpoint:</span>
                      <span className="text-text-main font-semibold">{service.endpoint}</span>
                    </div>
                    <div className="flex items-center justify-between text-text-muted">
                      <span>WhatsApp Command:</span>
                      <span className="text-primary font-bold">!{service.command}</span>
                    </div>
                  </div>

                  {/* Health Telemetry */}
                  <div className="bg-bg/60 rounded-lg p-2.5 border border-border/40 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted flex items-center gap-1.5">
                        <Activity className="w-3 h-3 text-primary" /> Availability:
                      </span>
                      <span
                        className={`font-semibold ${
                          isUnhealthy ? "text-rose-500" : isDegraded ? "text-amber-500" : "text-emerald-500"
                        }`}
                      >
                        {isUnhealthy ? "Cooling Down" : isDegraded ? "Degraded" : "Operational"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-text-muted">
                      <span>Lifetime Invocations:</span>
                      <span className="text-text-main font-semibold">
                        {(service.health?.totalSuccesses || 0) + (service.health?.totalFailures || 0)}
                      </span>
                    </div>
                    {service.health?.lastError && (
                      <div className="text-[10px] text-rose-400 truncate pt-1 border-t border-border/30">
                        Last err: {service.health.lastError}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="px-5 py-3.5 bg-muted/20 border-t border-border/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={togglingId === service.id}
                      onClick={() => handleToggle(service)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        service.enabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          service.enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-xs font-medium text-text-muted">
                      {service.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={testingId === service.id}
                    onClick={() => handleRunTest(service)}
                    className="h-7 text-xs px-2.5 flex items-center gap-1.5"
                  >
                    {testingId === service.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                    ) : (
                      <Play className="w-3 h-3 text-primary" />
                    )}
                    Run Test
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
