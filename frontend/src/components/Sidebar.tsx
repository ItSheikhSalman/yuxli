// file: frontend/src/components/Sidebar.tsx

import {
  Bot,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Cpu,
  CreditCard,
  FileText,
  LayoutGrid,
  LogOut,
  MessageSquareX,
  PanelLeftClose,
  Radio,
  Search,
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
  | "productivity"
  | "ai"
  | "training"
  | "integrations"
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
  onOpenCommandPalette?: () => void;
}

type NavItem =
  | { labelCategory: string }
  | { id: ViewTab; label: string; icon: React.ElementType; badge?: string | number };

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
  onOpenCommandPalette,
}) => {
  const { t } = useI18n();

  const isInApp = typeof (window as any).LevixHost?.closePanel === "function";

  const brand = (window as any).__BRAND__ || {
    name: "YUXLI",
    tagline: "Enterprise WhatsApp AI Platform",
    version: "4.6",
    developer: "Sheikh Salman",
  };

  const navItems: NavItem[] = [
    { labelCategory: "Operations" },
    { id: "overview", label: t("overview"), icon: LayoutGrid },
    { id: "connection", label: t("connection"), icon: Radio },
    { id: "logs", label: t("logs"), icon: FileText },

    { labelCategory: "Intelligence" },
    { id: "ai", label: t("ai"), icon: Bot },
    { id: "training", label: t("trainingStudio"), icon: Sparkles },
    { id: "integrations", label: "Integrations Hub", icon: Zap, badge: "AHM7" },
    { id: "antiban", label: "Anti-Ban Shield", icon: Shield, badge: "PRO" },
    { id: "plans", label: "Plans & Pricing", icon: CreditCard },

    { labelCategory: "Automation" },
    { id: "commands", label: t("commands"), icon: Terminal },
    { id: "productivity", label: "Productivity & Tasks", icon: CheckSquare },
    { id: "schedules", label: t("schedules"), icon: Calendar },
    { id: "autodelete", label: t("autoDelete"), icon: MessageSquareX },

    { labelCategory: "Community & Media" },
    { id: "groups", label: t("groups"), icon: Users },
    { id: "stickers", label: t("stickers"), icon: Sticker },

    { labelCategory: "Platform" },
    { id: "settings", label: t("settings"), icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default border-0 bg-black/60 backdrop-blur-xs md:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-label={t("closeNavigation")}
        />
      )}

      <aside
        className={cn(
          "fixed start-0 top-0 bottom-0 z-50 flex w-64 flex-col border-e border-line bg-panel transition-transform duration-200 ease-out md:static md:h-full md:shrink-0 md:z-auto",
          isOpenMobile ? "translate-x-0" : "max-md:-translate-x-full rtl:max-md:translate-x-full",
        )}
        aria-label="Main Navigation"
      >
        {/* Workspace & Brand Header */}
        <div className="shrink-0 border-b border-line px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-xs">
                Y
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold tracking-tight text-text-main">
                    {brand.name}
                  </span>
                  <span className="rounded px-1.5 py-0.2 text-[10px] font-mono font-medium bg-panel-raised border border-line text-muted">
                    v{brand.version}
                  </span>
                </div>
                <div className="truncate text-[11px] text-muted">
                  Production Workspace
                </div>
              </div>
            </div>

            <IconButton
              className="md:hidden"
              label={t("closeNavigation")}
              icon={<X size={16} />}
              onClick={onCloseMobile}
              variant="ghost"
              size="sm"
            />
          </div>

          {/* Quick Command Search Trigger */}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="mt-3 w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-line bg-panel-raised text-xs text-muted hover:text-text-main hover:border-line/80 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search size={14} className="text-faint" />
                <span className="truncate">Search or jump to...</span>
              </span>
              <kbd className="hidden sm:inline-block font-mono text-[10px] text-faint px-1 rounded bg-panel border border-line">
                ⌘K
              </kbd>
            </button>
          )}
        </div>

        {/* Navigation Item Tree */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-2 py-3 space-y-0.5">
          {navItems.map((item, idx) => {
            if ("labelCategory" in item) {
              return (
                <div
                  key={`cat-${item.labelCategory}-${idx}`}
                  className="px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint select-none"
                >
                  {item.labelCategory}
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
                  "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors outline-none cursor-pointer",
                  isActive
                    ? "bg-indigo-600/10 text-indigo-400 font-semibold"
                    : "text-muted hover:bg-panel-hover hover:text-text-main",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active vertical bar */}
                {isActive && (
                  <span
                    className="absolute start-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-indigo-500"
                    aria-hidden
                  />
                )}

                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center transition-colors",
                    isActive ? "text-indigo-400" : "text-faint group-hover:text-muted",
                  )}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                </span>

                <span className="flex-1 truncate text-start">{item.label}</span>

                {"badge" in item && item.badge !== undefined && (
                  <span className="rounded px-1.5 py-0.2 text-[9px] font-mono font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* System Core Mini-Badge */}
        <div className="shrink-0 mx-2 mb-2 rounded-lg border border-line bg-panel-raised p-2.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <Cpu size={13} className="text-indigo-400" />
              Engine Core
            </span>
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" />
              Active
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-faint font-mono">
            <span>Baileys WA</span>
            <span>Node v{brand.version}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 border-t border-line p-2 space-y-1">
          {isInApp && (
            <button
              type="button"
              onClick={() => (window as any).LevixHost.closePanel()}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-muted transition-colors hover:bg-panel-hover hover:text-text-main cursor-pointer"
            >
              <PanelLeftClose size={15} />
              <span className="truncate">{t("backToApp")}</span>
            </button>
          )}

          <form action="/logout" method="POST" className="m-0">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer"
            >
              <LogOut size={15} className="rtl:-scale-x-100" />
              <span className="truncate">{t("logout")}</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
};
