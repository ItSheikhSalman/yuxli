// file: frontend/src/components/Sidebar.tsx

import {
  Bot,
  Calendar,
  ChevronRight,
  FileText,
  LayoutGrid,
  LogOut,
  MessageSquareX,
  PanelLeftClose,
  Radio,
  Settings,
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
    tagline: "Private control room",
    version: "",
    developer: "Sheikh Salman",
    studio: "Yuxli Technologies",
    developerSite: "https://github.com/ItSheikhSalman",
    studioSite: "https://github.com/ItSheikhSalman/yuxli",
  };

  const navItems: NavItem[] = [
    { id: "overview", label: t("overview"), icon: LayoutGrid },
    { id: "connection", label: t("connection"), icon: Radio },
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
          className="fixed inset-0 z-40 cursor-default border-0 bg-black/70 p-0 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-label={t("closeNavigation")}
        />
      )}
      <aside
        className={cn(
          "fixed start-0 top-0 bottom-0 z-50 flex w-64 flex-col border-e border-line/60 transition-transform duration-250 ease-out md:static md:z-auto",
          "shadow-[4px_0_32px_rgba(0,0,0,0.35)]",
          isOpenMobile ? "translate-x-0" : "max-md:-translate-x-full rtl:max-md:translate-x-full",
        )}
        style={{ background: "var(--grad-sidebar, var(--panel))" }}
        aria-label="Main Navigation"
      >
        {/* ── Brand header ── */}
        <div className="flex items-center justify-between border-b border-line/60 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white animate-brand-pulse"
              style={{ background: "var(--grad-primary)" }}
            >
              <Zap size={20} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold tracking-tight text-text-main">
                {brand.name}
              </div>
              <div className="mt-0.5 truncate text-[11px] leading-none text-faint">
                {brand.tagline}
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

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-0.5">
          {navItems.map((item) => {
            if ("labelCategory" in item) {
              return (
                <div
                  key={`cat-${item.labelCategory}`}
                  className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint/70 select-none"
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
                  "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 outline-none",
                  isActive
                    ? "nav-active-pill text-white"
                    : "text-muted hover:bg-panel-hover/60 hover:text-text-main",
                )}
                style={
                  isActive
                    ? {
                        background:
                          "linear-gradient(135deg, rgba(37,99,255,0.25) 0%, rgba(6,214,232,0.12) 100%)",
                        borderLeft: "1px solid rgba(37,99,255,0.35)",
                      }
                    : undefined
                }
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active bar */}
                {isActive && (
                  <span
                    className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-[55%] rounded-e-full"
                    style={{ background: "var(--grad-primary)" }}
                    aria-hidden
                  />
                )}

                {/* Icon */}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150",
                    isActive
                      ? "text-brand-cyan"
                      : "text-faint group-hover:text-text-main",
                  )}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                </span>

                <span className="flex-1 truncate">{item.label}</span>

                {/* Badge */}
                {"badge" in item && item.badge !== undefined && (
                  <span className="rounded-full bg-brand-blue/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-cyan">
                    {item.badge}
                  </span>
                )}

                {/* Chevron on hover */}
                {!isActive && (
                  <ChevronRight
                    size={14}
                    className="text-faint/0 transition-all duration-150 group-hover:text-faint/60 rtl:-scale-x-100 shrink-0"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Footer actions ── */}
        <div className="border-t border-line/60 px-3 py-3 space-y-1">
          {isInApp && (
            <button
              type="button"
              onClick={() => (window as any).LevixHost.closePanel()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition-all hover:bg-panel-hover/60 hover:text-text-main"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg">
                <PanelLeftClose size={17} strokeWidth={2} />
              </span>
              <span className="truncate rtl:ml-auto rtl:text-right">{t("backToApp")}</span>
            </button>
          )}
          <form action="/logout" method="POST" className="m-0">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition-all hover:bg-danger/10 hover:text-danger"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg">
                <LogOut size={17} strokeWidth={2} className="rtl:-scale-x-100" />
              </span>
              <span className="truncate">{t("logout")}</span>
            </button>
          </form>
        </div>

        {/* ── Branding footer ── */}
        <div className="border-t border-line/40 px-4 py-3">
          <div className="flex items-center justify-between text-[10px] text-faint/60">
            <span className="font-mono">{brand.version ? `v${brand.version}` : "Yuxli"}</span>
            <a
              href={brand.developerSite || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-cyan transition-colors truncate max-w-[120px]"
            >
              {brand.developer}
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};
