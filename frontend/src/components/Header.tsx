// file: frontend/src/components/Header.tsx

import {
  ChevronDown,
  Globe,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
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
  onOpenCommandPalette?: () => void;
}

interface UserProfile {
  id?: string;
  name: string;
  email: string;
  company: string;
  role: string;
  plan: string;
}

const LANGUAGES = [
  { id: "en", label: "English", code: "EN" },
  { id: "ar", label: "العربية", code: "AR" },
] as const;

export const Header: FC<HeaderProps> = ({
  onToggleMobileMenu,
  title,
  status,
  onNavigate,
  onOpenCommandPalette,
}) => {
  const { language, setLanguage, t } = useI18n();
  const [user, setUser] = useState<UserProfile>(() => {
    return (window as any).__USER__ || {
      name: "Enterprise Admin",
      email: "admin@yuxli.internal",
      company: "Production Org",
      role: "Owner",
      plan: "Enterprise Pro",
    };
  });

  useEffect(() => {
    let mounted = true;
    api
      .getCurrentUser()
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
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    return current;
  });

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("yuxli_theme", nextTheme);
    localStorage.setItem("levix_theme", nextTheme);
  };

  const isConnected = status?.state === "connected" || status?.connected === true;
  const linkedNum = status?.user?.id
    ? `+${status.user.id.split("@")[0].split(":")[0].replace(/\D/g, "")}`
    : null;

  return (
    <header className="sticky top-0 z-30 shrink-0 flex h-13 items-center justify-between border-b border-line bg-panel px-4 sm:px-6">
      {/* Left: Mobile Menu & Contextual Title / Breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          id="mobile-menu-btn"
          className="md:hidden"
          label={t("openNavigation")}
          icon={<MenuIcon size={18} />}
          onClick={onToggleMobileMenu}
          variant="ghost"
          size="sm"
        />

        <div className="flex items-center gap-2 min-w-0 text-xs">
          <span className="hidden sm:inline-block text-muted font-medium">YUXLI</span>
          <span className="hidden sm:inline-block text-faint">/</span>
          <h1 className="truncate font-semibold text-text-main text-xs sm:text-sm">
            {title}
          </h1>

          {onNavigate && user.plan && (
            <button
              type="button"
              onClick={() => onNavigate("plans")}
              className="hidden lg:inline-flex items-center gap-1 ms-1 px-2 py-0.5 rounded text-[10px] font-medium bg-panel-raised border border-line text-muted hover:text-text-main hover:border-line/80 transition-colors cursor-pointer"
            >
              <span>{user.plan}</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions, Telemetry, Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Command Palette Button */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg border border-line bg-panel-raised text-xs text-muted hover:text-text-main hover:border-line/80 transition-colors cursor-pointer"
          >
            <Search size={13} className="text-faint" />
            <span className="text-[11px]">Command Menu</span>
            <kbd className="font-mono text-[9px] text-faint px-1 rounded bg-panel border border-line">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Live Status Telemetry Pill */}
        {status && (
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
              isConnected
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/25 bg-amber-500/10 text-amber-400"
            }`}
          >
            <span className={`size-1.5 rounded-full ${isConnected ? "bg-emerald-400 pulse-dot" : "bg-amber-400"}`} />
            <span className="font-mono text-[11px]">
              {isConnected ? linkedNum || "Online" : status.state || "Offline"}
            </span>
          </div>
        )}

        {/* Theme Switcher Toggle */}
        <IconButton
          variant="ghost"
          size="sm"
          label={theme === "light" ? "Switch to Dark Theme" : "Switch to Light Theme"}
          icon={theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
          onClick={toggleTheme}
          className="text-muted hover:text-text-main"
        />

        {/* Language Switcher */}
        <Menu
          label="Select Language"
          trigger={
            <IconButton
              variant="ghost"
              size="sm"
              label="Language"
              icon={<Globe size={15} />}
              className="text-muted hover:text-text-main"
            />
          }
        >
          <MenuLabel>Language</MenuLabel>
          {LANGUAGES.map((lang) => (
            <MenuItem
              key={lang.id}
              checked={language === lang.id}
              onSelect={() => setLanguage(lang.id as "ar" | "en")}
            >
              {lang.label}
            </MenuItem>
          ))}
        </Menu>

        {/* User Workspace Profile Menu */}
        <Menu
          label="User Account"
          trigger={
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-panel-raised px-2 py-1 text-xs font-medium text-text-main hover:bg-panel-hover transition-colors cursor-pointer"
            >
              <div className="flex size-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline-block max-w-[100px] truncate">{user.name}</span>
              <ChevronDown size={13} className="text-muted" />
            </button>
          }
        >
          <MenuLabel>
            <div className="font-semibold text-text-main">{user.name}</div>
            <div className="text-[10px] text-muted font-normal truncate">{user.email}</div>
          </MenuLabel>

          {onNavigate && (
            <>
              <MenuItem onSelect={() => onNavigate("plans")}>
                Plans & Subscriptions
              </MenuItem>
              <MenuItem onSelect={() => onNavigate("settings")}>
                {t("settings")}
              </MenuItem>
            </>
          )}

          <MenuItem
            danger
            onSelect={() => {
              const form = document.createElement("form");
              form.method = "POST";
              form.action = "/logout";
              document.body.appendChild(form);
              form.submit();
            }}
          >
            {t("logout")}
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
};
