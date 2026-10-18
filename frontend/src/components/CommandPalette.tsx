// file: frontend/src/components/CommandPalette.tsx
import {
  Bot,
  Calendar,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Moon,
  Radio,
  Search,
  Settings,
  Shield,
  Sticker,
  Sun,
  Terminal,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ViewTab } from "./Sidebar";
import { useI18n } from "../context/I18nContext";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewTab) => void;
  onToggleTheme: () => void;
  currentTheme: string;
}

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Actions" | "Preferences";
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onToggleTheme,
  currentTheme,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "nav-overview",
        title: `${t("overview")} — Dashboard`,
        category: "Navigation",
        icon: LayoutGrid,
        shortcut: "G O",
        action: () => onNavigate("overview"),
      },
      {
        id: "nav-connection",
        title: `${t("connection")} — WhatsApp Session & QR`,
        category: "Navigation",
        icon: Radio,
        shortcut: "G C",
        action: () => onNavigate("connection"),
      },
      {
        id: "nav-antiban",
        title: "Anti-Ban Shield v4.2 — Protection & Jitter",
        category: "Navigation",
        icon: Shield,
        shortcut: "G B",
        action: () => onNavigate("antiban"),
      },
      {
        id: "nav-plans",
        title: "Plans & Pricing — Enterprise Tiers",
        category: "Navigation",
        icon: CreditCard,
        action: () => onNavigate("plans"),
      },
      {
        id: "nav-commands",
        title: `${t("commands")} — Catalog & Permissions`,
        category: "Navigation",
        icon: Terminal,
        shortcut: "G X",
        action: () => onNavigate("commands"),
      },
      {
        id: "nav-ai",
        title: `${t("ai")} — Assistant, Models & Persona`,
        category: "Navigation",
        icon: Bot,
        shortcut: "G A",
        action: () => onNavigate("ai"),
      },
      {
        id: "nav-groups",
        title: `${t("groups")} — Policies, Whitelist & Admins`,
        category: "Navigation",
        icon: Users,
        shortcut: "G G",
        action: () => onNavigate("groups"),
      },
      {
        id: "nav-autodelete",
        title: `${t("autoDelete")} — Cleanup Policies`,
        category: "Navigation",
        icon: Trash2,
        action: () => onNavigate("autodelete"),
      },
      {
        id: "nav-schedules",
        title: `${t("schedules")} — Automated Cron Broadcasts`,
        category: "Navigation",
        icon: Calendar,
        shortcut: "G S",
        action: () => onNavigate("schedules"),
      },
      {
        id: "nav-stickers",
        title: `${t("stickers")} — Sticker Studio Lab`,
        category: "Navigation",
        icon: Sticker,
        action: () => onNavigate("stickers"),
      },
      {
        id: "nav-settings",
        title: `${t("settings")} — Platform Configuration`,
        category: "Navigation",
        icon: Settings,
        shortcut: "G ,",
        action: () => onNavigate("settings"),
      },
      {
        id: "nav-logs",
        title: `${t("logs")} — Live Streaming Diagnostics`,
        category: "Navigation",
        icon: FileText,
        shortcut: "G L",
        action: () => onNavigate("logs"),
      },
      {
        id: "act-theme",
        title: `Switch Theme (Current: ${currentTheme === "light" ? "Light" : "Dark"})`,
        category: "Preferences",
        icon: currentTheme === "light" ? Moon : Sun,
        shortcut: "T",
        action: onToggleTheme,
      },
    ],
    [t, onNavigate, onToggleTheme, currentTheme],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.shortcut?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="relative z-10 w-full max-w-xl rounded-xl border border-line bg-panel-raised shadow-2xl overflow-hidden animate-modal-enter"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to view..."
            className="w-full bg-transparent text-sm text-text-main placeholder:text-faint focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-faint border border-line bg-panel-raised">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No matching commands found for "{query}".
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-start cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "text-muted hover:text-text-main hover:bg-panel-hover"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={16} className={isSelected ? "text-white" : "text-faint"} />
                    <span className="truncate">{item.title}</span>
                  </div>
                  {item.shortcut && (
                    <kbd
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        isSelected
                          ? "border-white/30 text-white/90 bg-white/10"
                          : "border-line text-faint bg-panel"
                      }`}
                    >
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-line bg-panel text-[11px] text-faint">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="px-1 rounded bg-panel-raised border border-line font-mono text-[10px]">↑</kbd>
            <kbd className="px-1 rounded bg-panel-raised border border-line font-mono text-[10px]">↓</kbd>
            <span>Select:</span>
            <kbd className="px-1 rounded bg-panel-raised border border-line font-mono text-[10px]">↵</kbd>
          </div>
          <span>YUXLI Operations</span>
        </div>
      </div>
    </div>
  );
};
