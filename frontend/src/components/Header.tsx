import {
  Building2,
  ChevronDown,
  CreditCard,
  Globe,
  LogOut,
  Menu as MenuIcon,
  Palette,
  ShieldCheck,
  Sparkles,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { api } from "../api/client";
import type { ViewTab } from "./Sidebar";
import { useI18n } from "../context/I18nContext";
import type { SessionStatus } from "../types";
import { IconButton, Menu, MenuItem, MenuLabel } from "./ui";

interface HeaderProps {
  onToggleMobileMenu: () => void;
  title: string;
  status: SessionStatus | null;
  onNavigate?: (view: ViewTab) => void;
}

interface UserProfile {
  id?: string;
  name: string;
  email: string;
  company: string;
  role: string;
  plan: string;
}

const THEMES = [
  { id: "aurora",    label: "Aurora Hologram", color: "from-indigo-500 via-purple-500 to-pink-500" },
  { id: "cyberpunk", label: "Neo Tokyo",       color: "from-cyan-400 via-fuchsia-500 to-pink-500" },
  { id: "emerald",   label: "Quantum Matrix",  color: "from-emerald-500 to-teal-400" },
  { id: "solar",     label: "Solar Flare",     color: "from-amber-500 via-orange-500 to-red-500" },
  { id: "obsidian",  label: "Pure Obsidian",   color: "from-zinc-900 to-zinc-400" },
  { id: "light",     label: "Luxe Light",      color: "from-sky-400 to-indigo-500" },
] as const;

const LANGUAGES = [
  { id: "ar", label: "العربية", code: "AR" },
  { id: "en", label: "English", code: "EN" },
] as const;

export const Header: FC<HeaderProps> = ({ onToggleMobileMenu, title, status, onNavigate }) => {
  const { language, setLanguage, t } = useI18n();
  const [user, setUser] = useState<UserProfile>(() => {
    return (window as any).__USER__ || {
      name: "Enterprise Admin",
      email: "admin@workspace.local",
      company: "Production Org",
      role: "Owner",
      plan: "Enterprise Pro",
    };
  });

  useEffect(() => {
    let mounted = true;
    api.getCurrentUser()
      .then((res) => {
        if (mounted && res?.user) {
          setUser(res.user);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem("yuxli_theme") || localStorage.getItem("levix_theme");
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
      return saved;
    }
    const current = document.documentElement.getAttribute("data-theme") || "aurora";
    return current === "dark" || current === "navy" ? "aurora" : current;
  });

  const applyTheme = (nextTheme: string) => {
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("yuxli_theme", nextTheme);
    localStorage.setItem("levix_theme", nextTheme);
  };

  const isConnected = status?.state === "connected" || status?.connected === true;
  const linkedNum = status?.user?.id
    ? `+${status.user.id.split("@")[0].split(":")[0].replace(/\D/g, "")}`
    : null;

  const initials = (user.name || "EA")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 shrink-0 flex h-16 items-center justify-between border-b border-line/70 bg-panel/85 px-4 sm:px-6 backdrop-blur-2xl transition-all"
      style={{
        boxShadow: "0 4px 24px -2px rgba(0, 0, 0, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Left side: Navigation Toggle & Breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          id="mobile-menu-btn"
          className="md:hidden"
          label={t("openNavigation")}
          icon={<MenuIcon size={19} />}
          onClick={onToggleMobileMenu}
          variant="ghost"
        />
        <div className="flex items-center gap-2.5 min-w-0">
          <h1
            className="truncate text-base sm:text-lg font-black tracking-tight text-text-main font-display"
            title={title}
          >
            {title}
          </h1>
          {onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate("plans")}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-indigo/15 hover:bg-brand-indigo/25 text-brand-pink border border-brand-indigo/30 transition-all cursor-pointer"
              title="Click to view subscription tiers"
            >
              <Sparkles size={11} className="animate-pulse" />
              <span>{user.plan || "Enterprise Node"}</span>
            </button>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-indigo/15 text-brand-pink border border-brand-indigo/30">
              <Sparkles size={11} className="animate-pulse" />
              Enterprise Node
            </span>
          )}
        </div>
      </div>

      {/* Right side: Connection Telemetry, Language, Theme, & SaaS User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Status pill with live radar ping */}
        {status && (
          <div
            className={`flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-bold transition-all shadow-sm ${
              isConnected
                ? "border-ok/35 bg-ok/10 text-ok shadow-ok/10"
                : "border-warn/35 bg-warn/10 text-warn shadow-warn/10"
            }`}
          >
            {isConnected ? (
              <>
                <Wifi size={14} className="shrink-0" />
                <span className="font-mono tracking-tight font-black">{linkedNum ?? t("connected")}</span>
                <span className="pulse-dot size-2" />
              </>
            ) : (
              <>
                <WifiOff size={14} className="shrink-0" />
                <span className="font-medium">{t(status.state as any, "Offline")}</span>
                <span className="size-2 rounded-full bg-warn/80 animate-ping" />
              </>
            )}
          </div>
        )}

        {/* Language selector */}
        <Menu
          label={t("chooseLanguage")}
          trigger={
            <IconButton
              id="btn-header-lang"
              label={t("chooseLanguage")}
              icon={<Globe size={18} className="text-brand-pink" />}
              variant="ghost"
              className="rounded-xl border border-line/50 hover:bg-panel-hover"
            />
          }
        >
          <MenuLabel>{t("chooseLanguage")}</MenuLabel>
          {LANGUAGES.map((lang) => (
            <MenuItem
              key={lang.id}
              checked={language === lang.id}
              onSelect={() => setLanguage(lang.id as any)}
            >
              <span className="me-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface border border-line">
                {lang.code}
              </span>
              {lang.label}
            </MenuItem>
          ))}
        </Menu>

        {/* Theme palette picker */}
        <Menu
          label="Theme Suite"
          trigger={
            <IconButton
              id="btn-header-theme"
              label="Theme Suite"
              icon={<Palette size={18} className="text-brand-indigo" />}
              variant="ghost"
              className="rounded-xl border border-line/50 hover:bg-panel-hover"
            />
          }
        >
          <MenuLabel>Theme Suite</MenuLabel>
          {THEMES.map((th) => (
            <MenuItem
              key={th.id}
              checked={theme === th.id || (th.id === "aurora" && (theme === "navy" || theme === "dark"))}
              onSelect={() => applyTheme(th.id)}
            >
              <span
                className={`me-2.5 inline-block size-3.5 rounded-full bg-gradient-to-tr ${th.color} shadow-sm border border-white/20`}
                aria-hidden
              />
              {th.label}
            </MenuItem>
          ))}
        </Menu>

        {/* ── Enterprise SaaS User Profile & Workspace Dropdown ── */}
        <Menu
          label="Account & Workspace"
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-line/60 bg-surface/60 px-2.5 py-1.5 hover:bg-panel-hover hover:border-line transition-all cursor-pointer text-left focus:outline-none"
              aria-label="User Workspace Menu"
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-indigo to-brand-pink text-[11px] font-bold text-white shadow-sm font-mono">
                {initials}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="text-xs font-bold text-text-main truncate max-w-[110px]">
                  {user.company || "Enterprise"}
                </div>
                <div className="text-[10px] text-text-muted truncate max-w-[110px]">
                  {user.name}
                </div>
              </div>
              <ChevronDown size={14} className="text-text-muted hidden sm:block" />
            </button>
          }
        >
          <div className="px-3 py-2 border-b border-line/70">
            <div className="text-xs font-bold text-text-main">{user.name}</div>
            <div className="text-[11px] text-text-muted truncate">{user.email}</div>
            <div className="mt-1.5 flex items-center justify-between gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                <ShieldCheck size={11} />
                {user.plan || "PRO TIER"}
              </span>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("plans")}
                  className="text-[10px] font-black text-brand-indigo hover:text-brand-pink transition-colors cursor-pointer"
                >
                  Manage &rarr;
                </button>
              )}
            </div>
          </div>

          <MenuLabel>Active Workspace</MenuLabel>
          <MenuItem disabled>
            <Building2 size={14} className="me-2 text-brand-indigo" />
            <span className="truncate">{user.company || "Main Workspace"}</span>
          </MenuItem>

          {onNavigate && (
            <MenuItem onSelect={() => onNavigate("plans")}>
              <CreditCard size={14} className="me-2 text-brand-pink" />
              <span className="font-semibold text-text-main">Subscription & Billing</span>
            </MenuItem>
          )}

          <div className="border-t border-line/60 my-1" />

          <MenuItem onSelect={() => { window.location.href = "/logout"; }}>
            <LogOut size={14} className="me-2 text-warn" />
            <span className="text-warn font-semibold">Sign Out</span>
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
};

export default Header;
