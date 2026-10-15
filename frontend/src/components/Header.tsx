// file: frontend/src/components/Header.tsx

import { Globe, Menu as MenuIcon, Palette, Wifi, WifiOff } from "lucide-react";
import { type FC, useState } from "react";
import { useI18n } from "../context/I18nContext";
import type { SessionStatus } from "../types";
import { IconButton, Menu, MenuItem, MenuLabel } from "./ui";

interface HeaderProps {
  onToggleMobileMenu: () => void;
  title: string;
  status: SessionStatus | null;
}

const THEMES = [
  { id: "navy",     label: "🌌 Deep Navy" },
  { id: "emerald",  label: "💎 Emerald Matrix" },
  { id: "violet",   label: "🔮 Royal Violet" },
  { id: "midnight", label: "⚡ OLED Midnight" },
  { id: "light",    label: "☀️ Modern Light" },
] as const;

const LANGUAGES = [
  { id: "ar", label: "العربية" },
  { id: "en", label: "English" },
] as const;

export const Header: FC<HeaderProps> = ({ onToggleMobileMenu, title, status }) => {
  const { language, setLanguage, t } = useI18n();
  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem("yuxli_theme") || localStorage.getItem("levix_theme");
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved);
      return saved;
    }
    const current = document.documentElement.getAttribute("data-theme") || "navy";
    return current === "dark" ? "navy" : current;
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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/60 bg-panel/90 px-4 backdrop-blur-md md:px-6"
      style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.2)" }}
    >
      {/* Left side */}
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          id="mobile-menu-btn"
          className="md:hidden"
          label={t("openNavigation")}
          icon={<MenuIcon size={19} />}
          onClick={onToggleMobileMenu}
          variant="ghost"
        />
        <h1
          className="truncate text-base font-bold tracking-tight text-text-main md:text-lg"
          title={title}
        >
          {title}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Connection status chip */}
        {status && (
          <div
            className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              isConnected
                ? "border-ok/30 bg-ok/10 text-ok"
                : "border-warn/30 bg-warn/10 text-warn"
            }`}
          >
            {isConnected ? (
              <>
                <Wifi size={12} />
                <span>{linkedNum ?? t("connected")}</span>
                <span className="pulse-dot size-1.5" />
              </>
            ) : (
              <>
                <WifiOff size={12} />
                <span>{t(status.state as any, "Offline")}</span>
              </>
            )}
          </div>
        )}

        {/* Language picker */}
        <Menu
          label={t("chooseLanguage")}
          trigger={
            <IconButton
              id="btn-header-lang"
              label={t("chooseLanguage")}
              icon={<Globe size={17} className="text-brand-cyan" />}
              variant="ghost"
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
              {lang.label}
            </MenuItem>
          ))}
        </Menu>

        {/* Theme picker */}
        <Menu
          label="Theme"
          trigger={
            <IconButton
              id="btn-header-theme"
              label="Theme Palette"
              icon={<Palette size={17} className="text-brand-cyan" />}
              variant="ghost"
            />
          }
        >
          <MenuLabel>Theme Palette</MenuLabel>
          {THEMES.map((th) => (
            <MenuItem
              key={th.id}
              checked={theme === th.id || (th.id === "navy" && theme === "dark")}
              onSelect={() => applyTheme(th.id)}
            >
              {th.label}
            </MenuItem>
          ))}
        </Menu>
      </div>
    </header>
  );
};
