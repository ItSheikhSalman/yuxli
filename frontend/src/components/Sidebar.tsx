// file: frontend/src/components/Sidebar.tsx

import {
  Activity,
  Bot,
  Calendar,
  ChevronRight,
  Cpu,
  CreditCard,
  FileText,
  LayoutGrid,
  LogOut,
  MessageSquareX,
  PanelLeftClose,
  Radio,
  Settings,
  Shield,
  Sparkles,
  Sticker,
  Terminal,
  Users,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useI18n } from "../context/I18nContext";
import { cn } from "../utils/cn";
import { IconButton } from "./ui";

export type ViewTab =
  | "overview"
  | "connection"
  | "antiban"
  | "plans"
  | "commands"
  | "ai"
  | "groups"
  | "autodelete"
  | "schedules"
  | "settings"
  | "logs"
  | "stickers";

interface SidebarProps {
  currentView: ViewTab;
  onSelectView: (view: ViewTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

type NavItem =
  | { labelCategory: string }
  | { id: ViewTab; label: string; icon: React.ElementType; badge?: string | number };

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { t } = useI18n();

  const isInApp = typeof (window as any).LevixHost?.closePanel === "function";

  const brand = (window as any).__BRAND__ || {
    name: "Yuxli",
    tagline: "Autonomous WhatsApp AI",
    version: "4.6",
    developer: "Sheikh Salman",
    studio: "Yuxli Technologies",
    developerSite: "https://github.com/ItSheikhSalman",
    studioSite: "https://github.com/ItSheikhSalman/yuxli",
  };

  const navItems: NavItem[] = [
    { id: "overview", label: t("overview"), icon: LayoutGrid },
    { id: "connection", label: t("connection"), icon: Radio },
    {
      id: "antiban",
      label: "Anti-Ban Shield",
      icon: Shield,
      badge: "PRO",
    },
    {
      id: "plans",
      label: "Plans & Pricing",
      icon: CreditCard,
      badge: "UPGRADE",
    },
    { labelCategory: t("control") },
    { id: "commands", label: t("commands"), icon: Terminal },
    { id: "ai", label: t("ai"), icon: Bot },
    { id: "groups", label: t("groups"), icon: Users },
    { id: "autodelete", label: t("autoDelete"), icon: MessageSquareX },
    { id: "schedules", label: t("schedules"), icon: Calendar },
    { id: "stickers", label: t("stickers"), icon: Sticker },
    { labelCategory: t("settings") },
    { id: "settings", label: t("settings"), icon: Settings },
    { id: "logs", label: t("logs"), icon: FileText },
  ];

  return (
    <>
      {isOpenMobile && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default border-0 bg-black/80 p-0 backdrop-blur-md md:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-label={t("closeNavigation")}
        />
      )}

      <aside
        className={cn(
          "fixed start-0 top-0 bottom-0 z-50 flex w-72 flex-col border-e border-line/70 transition-transform duration-300 ease-out md:static md:h-full md:shrink-0 md:z-auto",
          "shadow-[8px_0_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl overflow-hidden",
          isOpenMobile ? "translate-x-0" : "max-md:-translate-x-full rtl:max-md:translate-x-full",
        )}
        style={{ background: "var(--grad-sidebar)" }}
        aria-label="Main Navigation"
      >
        {/* ── Brand Lockup Deck ── */}
        <div className="relative shrink-0 border-b border-line/70 px-5 py-5 overflow-hidden">
          {/* Ambient light streak */}
          <div className="pointer-events-none absolute -start-10 -top-10 size-32 rounded-full bg-brand-indigo/15 blur-2xl" />

          <div className="relative flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <div
                className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg animate-brand-pulse"
                style={{ background: "var(--grad-primary)" }}
              >
                <Zap size={22} strokeWidth={2.5} className="drop-shadow-sm" />
                <span className="absolute -bottom-1 -end-1 size-3 rounded-full bg-ok border-2 border-panel-solid" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-base font-extrabold tracking-tight text-text-main font-display">
                    {brand.name}
                  </span>
                  <span className="rounded-full bg-brand-indigo/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-pink border border-brand-indigo/30">
                    AI PRO
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] font-medium text-faint">
                  {brand.tagline}
                </div>
              </div>
            </div>

            <IconButton
              className="md:hidden"
              label={t("closeNavigation")}
              icon={<X size={17} />}
              onClick={onCloseMobile}
              variant="ghost"
              size="sm"
            />
          </div>
        </div>

        {/* ── Navigation Tree ── */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-3.5 py-4 space-y-1">
          {navItems.map((item, idx) => {
            if ("labelCategory" in item) {
              return (
                <div
                  key={`cat-${item.labelCategory}-${idx}`}
                  className="flex items-center gap-2 px-3 pt-5 pb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-faint/80 select-none"
                >
                  <span>{item.labelCategory}</span>
                  <span className="h-[1px] flex-1 bg-line/40" />
                </div>
              );
            }

            if (!("icon" in item) || !item.icon || !item.id) return null;
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id as ViewTab);
                  onCloseMobile();
                }}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition-all duration-200 outline-none cursor-pointer",
                  isActive
                    ? "nav-active-pill text-white font-extrabold shadow-md"
                    : "text-muted hover:bg-panel-hover/80 hover:text-text-main hover:translate-x-1",
                )}
                style={
                  isActive
                    ? {
                        background:
                          "linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(168,85,247,0.2) 50%, rgba(236,72,153,0.14) 100%)",
                        border: "1px solid rgba(168,85,247,0.35)",
                      }
                    : undefined
                }
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active Neon Bar */}
                {isActive && (
                  <span
                    className="absolute start-0 top-1/2 -translate-y-1/2 w-[3.5px] h-[60%] rounded-e-full"
                    style={{ background: "var(--grad-primary)", boxShadow: "0 0 12px #a855f7" }}
                    aria-hidden
                  />
                )}

                {/* Icon Container */}
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-brand-indigo/25 text-white shadow-sm shadow-brand-indigo/40"
                      : "bg-panel-raised/60 text-faint group-hover:text-text-main group-hover:bg-panel-raised",
                  )}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </span>

                <span className="flex-1 truncate text-start font-medium">{item.label}</span>

                {/* Badge if present */}
                {"badge" in item && item.badge !== undefined && (
                  <span className="rounded-full bg-brand-indigo/25 px-2 py-0.5 text-[10px] font-mono font-bold text-brand-pink border border-brand-indigo/30">
                    {item.badge}
                  </span>
                )}

                {/* Hover indicator */}
                {!isActive && (
                  <ChevronRight
                    size={15}
                    className="text-faint/0 transition-all duration-200 group-hover:text-faint/70 group-hover:translate-x-0.5 rtl:-scale-x-100 shrink-0"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── System Telemetry Mini-Gauge ── */}
        <div className="shrink-0 mx-3.5 mb-3 rounded-2xl border border-line/60 bg-panel-raised/50 p-3.5 backdrop-blur-xl">
          <div className="flex items-center justify-between text-[11px] font-bold text-faint">
            <span className="flex items-center gap-1.5">
              <Cpu size={13} className="text-brand-indigo" />
              Engine Core
            </span>
            <span className="flex items-center gap-1 text-ok font-mono text-[10px]">
              <span className="size-1.5 rounded-full bg-ok animate-ping" />
              Active
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
            <span>Node v{brand.version || "4.6"}</span>
            <span className="font-mono">Baileys WA</span>
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div className="shrink-0 border-t border-line/70 px-3.5 py-3 space-y-1">
          {isInApp && (
            <button
              type="button"
              onClick={() => (window as any).LevixHost.closePanel()}
              className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-muted transition-all hover:bg-panel-hover/80 hover:text-text-main"
            >
              <PanelLeftClose size={17} strokeWidth={2} />
              <span className="truncate">{t("backToApp")}</span>
            </button>
          )}

          <form action="/logout" method="POST" className="m-0">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-muted transition-all hover:bg-danger/15 hover:text-danger hover:border-danger/20 border border-transparent"
            >
              <LogOut size={17} strokeWidth={2} className="rtl:-scale-x-100" />
              <span className="truncate">{t("logout")}</span>
            </button>
          </form>
        </div>

        {/* ── Creator Signature ── */}
        <div className="shrink-0 border-t border-line/50 px-5 py-3">
          <div className="flex items-center justify-between text-[10px] text-faint/70 font-mono">
            <span>Yuxli Bot</span>
            <a
              href={brand.developerSite || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-pink transition-colors truncate max-w-[140px]"
            >
              {brand.developer}
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};
