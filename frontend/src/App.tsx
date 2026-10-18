// file: frontend/src/App.tsx
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { Header } from "./components/Header";
import { Sidebar, type ViewTab } from "./components/Sidebar";
import { ToastProvider, useToast } from "./components/Toasts";
import { I18nProvider, useI18n } from "./context/I18nContext";
import { useSocket } from "./hooks/useSocket";
import type { SessionState, SessionStatus } from "./types";
import { AIAssistantView } from "./views/AIAssistantView";
import { AutoDeleteView } from "./views/autoDelete/AutoDeleteView";
import { CommandsView } from "./views/CommandsView";
import { ConnectionView } from "./views/ConnectionView";
import { GroupsView } from "./views/GroupsView";
import { LogsView } from "./views/LogsView";
import { OverviewView } from "./views/OverviewView";
import { SchedulesView } from "./views/SchedulesView";
import { SettingsView } from "./views/SettingsView";
import { StickerStudioView } from "./views/StickerStudioView";
import { AntiBanShieldView } from "./views/AntiBanShieldView";
import { PlansPricingView } from "./views/PlansPricingView";

const VALID_VIEWS: ViewTab[] = [
  "overview",
  "connection",
  "antiban",
  "plans",
  "commands",
  "ai",
  "groups",
  "autodelete",
  "schedules",
  "settings",
  "logs",
  "stickers",
];

function viewFromHash(): ViewTab {
  const head = window.location.hash.replace(/^#/, "").split("/")[0] as ViewTab;
  return VALID_VIEWS.includes(head) ? head : "overview";
}

const MainLayout: React.FC = () => {
  const { t } = useI18n();
  const { toast } = useToast();

  const [currentView, setCurrentView] = useState<ViewTab>(viewFromHash);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Realtime Socket listener
  const {
    isConnected: _socketConnected,
    sessionStatus: socketStatus,
    socket,
  } = useSocket((event, data) => {
    if (event === "status") {
      const state = (data as { state?: string })?.state;
      toast(`Connection state: ${state}`, "info");
    }
  });

  const [initialStatus, setInitialStatus] = useState<Partial<SessionStatus> | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await api.getSession();
      if (res?.session) {
        setInitialStatus({
          ...res.session,
          qr: res.qr ?? null,
          pairingCode: res.pairingCode ?? null,
        });
      } else if (res?.status) {
        setInitialStatus(res.status);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const activeStatus: SessionStatus | null =
    initialStatus || socketStatus
      ? {
          state: (socketStatus?.state || initialStatus?.state || "idle") as SessionState,
          ...(initialStatus || {}),
          ...(socketStatus || {}),
        }
      : null;

  const isConnected = activeStatus?.connected === true || activeStatus?.state === "connected";

  // Auto-poll in transitional states (starting, linking, waiting_for_qr without QR, reconnecting)
  useEffect(() => {
    const state = activeStatus?.state;
    const isTransitional =
      state === "starting" ||
      state === "linking" ||
      state === "reconnecting" ||
      (state === "waiting_for_qr" && !activeStatus?.qr && !activeStatus?.pairingCode);

    const intervalMs = isTransitional ? 2000 : 15000;
    const timer = setInterval(() => {
      refreshStatus();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [activeStatus?.state, activeStatus?.qr, activeStatus?.pairingCode, refreshStatus]);

  // Sync hash with view
  const handleSelectView = (view: ViewTab) => {
    setCurrentView(view);
    window.location.hash = view;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const head = window.location.hash.replace(/^#/, "").split("/")[0] as ViewTab;
      if (VALID_VIEWS.includes(head)) setCurrentView(head);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const viewTitles: Record<ViewTab, string> = {
    overview: t("overview"),
    connection: t("connection"),
    antiban: "Anti-Ban Shield",
    plans: "Plans & Pricing",
    commands: t("commands"),
    ai: t("ai"),
    groups: t("groups"),
    autodelete: t("autoDelete"),
    schedules: t("schedules"),
    settings: t("settings"),
    logs: t("logs"),
    stickers: t("stickers"),
  };

  return (
    <div className="h-screen max-h-screen flex bg-bg text-text-main bg-ambient-glow overflow-hidden relative">
      {/* Ambient background light orbs */}
      <div className="pointer-events-none fixed -top-40 -left-40 size-96 rounded-full bg-brand-indigo/15 blur-[120px]" />
      <div className="pointer-events-none fixed top-1/3 -right-40 size-96 rounded-full bg-brand-pink/10 blur-[140px]" />
      <div className="pointer-events-none fixed -bottom-40 left-1/3 size-96 rounded-full bg-brand-purple/10 blur-[130px]" />

      <Sidebar
        currentView={currentView}
        onSelectView={handleSelectView}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative z-10">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          title={viewTitles[currentView] || "Dashboard"}
          status={activeStatus}
          onNavigate={handleSelectView}
        />

        <main className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {currentView === "overview" && (
              <OverviewView status={activeStatus} onNavigate={handleSelectView} />
            )}
            {currentView === "connection" && (
              <ConnectionView
                status={activeStatus}
                onRefresh={refreshStatus}
                onStatusUpdate={(s) => setInitialStatus((prev) => ({ ...(prev || {}), ...s }))}
              />
            )}
            {currentView === "antiban" && <AntiBanShieldView />}
            {currentView === "plans" && (
              <PlansPricingView onUserPlanUpdated={() => refreshStatus()} />
            )}
            {currentView === "ai" && <AIAssistantView />}
            {currentView === "commands" && <CommandsView />}
            {currentView === "schedules" && (
              <SchedulesView isConnected={isConnected} onNavigate={handleSelectView} />
            )}
            {currentView === "groups" && <GroupsView />}
            {currentView === "autodelete" && <AutoDeleteView />}
            {currentView === "settings" && <SettingsView />}
            {currentView === "stickers" && <StickerStudioView isConnected={isConnected} />}
            {currentView === "logs" && <LogsView socket={socket} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <ToastProvider>
        <MainLayout />
      </ToastProvider>
    </I18nProvider>
  );
};

export default App;
