// file: frontend/src/components/Header.tsx

import { Globe, Menu as MenuIcon, Palette } from "lucide-react";
import { type FC, useState } from "react";
import { useI18n } from "../context/I18nContext";
import type { SessionStatus } from "../types";
import { IconButton, Menu, MenuItem, MenuLabel } from "./ui";

interface HeaderProps {
  onToggleMobileMenu: () => void;
  title: string;
  status: SessionStatus | null;
}

export const Header: FC<HeaderProps> = ({ onToggleMobileMenu, title, status: _status }) => {
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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-panel/85 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          id="mobile-menu-btn"
          className="md:hidden"
          label={t("openNavigation")}
          icon={<MenuIcon size={20} />}
          onClick={onToggleMobileMenu}
        />
        <h1
          className="truncate text-lg font-bold tracking-tight text-text-main md:text-xl"
          title={title}
        >
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Menu
          label={t("chooseLanguage")}
          trigger={
            <IconButton
              id="btn-header-lang"
              label={t("chooseLanguage")}
              icon={<Globe size={18} className="text-brand-cyan" />}
            />
          }
        >
          <MenuLabel>{t("chooseLanguage")}</MenuLabel>
          <MenuItem checked={language === "ar"} onSelect={() => setLanguage("ar")}>
            العربية
          </MenuItem>
          <MenuItem checked={language === "en"} onSelect={() => setLanguage("en")}>
            English
          </MenuItem>
        </Menu>

        <Menu
          label="Theme"
          trigger={
            <IconButton
              id="btn-header-theme"
              label="Theme Palette"
              icon={<Palette size={18} className="text-brand-cyan" />}
            />
          }
        >
          <MenuLabel>Theme Palette</MenuLabel>
          <MenuItem checked={theme === "navy" || theme === "dark"} onSelect={() => applyTheme("navy")}>
            🌌 Deep Navy
          </MenuItem>
          <MenuItem checked={theme === "emerald"} onSelect={() => applyTheme("emerald")}>
            💎 Emerald Matrix
          </MenuItem>
          <MenuItem checked={theme === "violet"} onSelect={() => applyTheme("violet")}>
            🔮 Royal Violet
          </MenuItem>
          <MenuItem checked={theme === "midnight"} onSelect={() => applyTheme("midnight")}>
            ⚡ OLED Midnight
          </MenuItem>
          <MenuItem checked={theme === "light"} onSelect={() => applyTheme("light")}>
            ☀️ Modern Light
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
};
