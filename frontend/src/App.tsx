// file: frontend/src/App.tsx
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { CommandPalette } from "./components/CommandPalette";
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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

  // Auto-poll in transitional states
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

  // Global keyboard shortcut for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [currentTheme, setCurrentTheme] = useState(() => {
    return (
      localStorage.getItem("yuxli_theme") ||
      localStorage.getItem("levix_theme") ||
      document.documentElement.getAttribute("data-theme") ||
      "dark"
    );
  });

  const toggleTheme = () => {
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    setCurrentTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("yuxli_theme", nextTheme);
    localStorage.setItem("levix_theme", nextTheme);
  };

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
    <div className="h-screen max-h-screen flex bg-bg text-text-main overflow-hidden relative">
      <Sidebar
        currentView={currentView}
        onSelectView={handleSelectView}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          title={viewTitles[currentView] || "Dashboard"}
          status={activeStatus}
          onNavigate={handleSelectView}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        <main className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-7">
          <div className="max-w-7xl mx-auto space-y-5">
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

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={handleSelectView}
        onToggleTheme={toggleTheme}
        currentTheme={currentTheme}
      />
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
