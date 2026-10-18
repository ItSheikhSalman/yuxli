// file: frontend/src/views/CommandsView.tsx

import { Edit3, Plus, Search, Tag, Terminal, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../components/Toasts";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  SaveField,
  Select,
  Spinner,
  Toggle,
  useSavedValue,
} from "../components/ui";
import { useI18n } from "../context/I18nContext";
import type { CommandItem, PermissionLevel } from "../types";

const FALLBACK_LEVELS = ["MEMBERS", "ADMINS_ONLY", "ADMINS_OWNER", "OWNER_ONLY"];
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export const CommandsView: React.FC = () => {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [levels, setLevels] = useState<string[]>(FALLBACK_LEVELS);
  const [prefix, setPrefix] = useState<string>("!");
  const [isEditingPrefix, setIsEditingPrefix] = useState(false);
  const [newPrefixInput, setNewPrefixInput] = useState("!");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Alias modal state
  const [editingAliasesCmd, setEditingAliasesCmd] = useState<CommandItem | null>(null);
  const [tempAliases, setTempAliases] = useState<string[]>([]);
  const [newAliasText, setNewAliasText] = useState("");
  const [savingAliases, setSavingAliases] = useState(false);

  const loadCommands = async () => {
    try {
      const res = await api.getCommands();
      if (res?.commands) setCommands(res.commands);
      if (res?.prefix) {
        setPrefix(res.prefix);
        setNewPrefixInput(res.prefix);
      }
      if (Array.isArray(res?.levels) && res.levels.length) setLevels(res.levels);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommands();
  }, []);

  const handleUpdatePrefix = async () => {
    const clean = newPrefixInput.trim();
    if (!clean || clean.length > 3) {
      toast(t("prefixValidation"), "error");
      return;
    }
    try {
      await api.updatePrefix(clean);
      setPrefix(clean);
      setIsEditingPrefix(false);
      toast(`${t("prefixUpdated")} (${clean})`, "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const handleToggleEnabled = async (cmd: CommandItem, enabled: boolean) => {
    setCommands((prev) =>
      prev.map((c) => (c.name === cmd.name ? { ...c, enabled, overridden: true } : c)),
    );
    try {
      await api.updateCommand(cmd.name, { enabled });
      toast(
        t(enabled ? "commandEnabled" : "commandDisabled").replace("{name}", cmd.name),
        "success",
      );
    } catch (err: any) {
      toast(err.message, "error");
      loadCommands();
    }
  };

  const persistPermission = async (cmd: CommandItem, permission: PermissionLevel) => {
    await api.updateCommand(cmd.name, { permission });
    setCommands((prev) =>
      prev.map((c) => (c.name === cmd.name ? { ...c, permission, overridden: true } : c)),
    );
  };

  const openAliasModal = (cmd: CommandItem) => {
    setEditingAliasesCmd(cmd);
    setTempAliases(Array.isArray(cmd.aliases) ? [...cmd.aliases] : []);
    setNewAliasText("");
  };

  const handleAddAlias = () => {
    const clean = newAliasText
      .trim()
      .replace(/^[!/#.?$]+/, "")
      .toLowerCase();
    if (!clean) return;
    if (tempAliases.includes(clean)) {
      toast(t("aliasAlreadyAdded"), "warning");
      return;
    }
    setTempAliases([...tempAliases, clean]);
    setNewAliasText("");
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setTempAliases(tempAliases.filter((a) => a !== aliasToRemove));
  };

  const handleSaveAliases = async () => {
    if (!editingAliasesCmd) return;
    setSavingAliases(true);
    try {
      await api.updateCommand(editingAliasesCmd.name, { aliases: tempAliases });
      setCommands((prev) =>
        prev.map((c) => (c.name === editingAliasesCmd.name ? { ...c, aliases: tempAliases } : c)),
      );
      toast(t("savedSuccessfully"), "success");
      setEditingAliasesCmd(null);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingAliases(false);
    }
  };

  const describe = (c: CommandItem) => c.descriptions?.[language] || c.description || "";
  const usageOf = (c: CommandItem) => c.usages?.[language] || c.usage || "";

  const usageLines = (c: CommandItem) =>
    usageOf(c)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `${prefix}${line}`);

  const permissionLabel = (level: string) =>
    ({
      MEMBERS: t("permMembers"),
      ALL: t("permMembers"),
      ADMINS_ONLY: t("permAdminsOnly"),
      ADMINS_OWNER: t("permAdminsOwner"),
      OWNER_ONLY: t("permOwnerOnly"),
    })[level] || level;

  const scopeLabel = (chat: string) =>
    ({ all: t("scopeAll"), group: t("scopeGroup"), private: t("scopePrivate") })[chat] || chat;

  const query = search.trim().toLowerCase();
  const filtered = query
    ? commands.filter((c) =>
        [
          c.name,
          ...(c.aliases || []),
          describe(c),
          c.description,
          usageOf(c),
          c.usages?.en,
          c.usages?.ar,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : commands;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Page Header & Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-main">
            Command Center
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Configure bot commands, trigger aliases, scope boundaries, and role permissions.
          </p>
        </div>

        {/* Prefix Editor Badge */}
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-line bg-panel self-start sm:self-auto text-xs">
          <span className="text-muted font-medium">{t("activePrefix")}:</span>
          {isEditingPrefix ? (
            <div className="inline-flex items-center gap-1.5">
              <Input
                type="text"
                maxLength={3}
                value={newPrefixInput}
                onChange={(e) => setNewPrefixInput(e.target.value)}
                className="w-12 h-7 py-0 text-center font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdatePrefix();
                  if (e.key === "Escape") setIsEditingPrefix(false);
                }}
              />
              <Button variant="primary" size="sm" onClick={handleUpdatePrefix}>
                {t("save")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsEditingPrefix(false)}>
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              title={t("editPrefixHint")}
              onClick={() => {
                setNewPrefixInput(prefix);
                setIsEditingPrefix(true);
              }}
              className="font-mono font-bold text-indigo-400 hover:underline px-1 cursor-pointer"
            >
              {prefix}
            </button>
          )}
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <Card className="p-3.5 border border-line bg-panel">
        <div className="relative w-full max-w-md">
          <Search size={15} className="pointer-events-none absolute start-3 top-2.5 text-muted" />
          <Input
            type="text"
            className="ps-9 text-xs"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {/* ── Commands Data Table ── */}
      <Card padded={false} className="overflow-x-auto border border-line bg-panel">
        <table className="w-full min-w-[760px] text-start border-collapse text-xs">
          <thead>
            <tr className="bg-panel-raised border-b border-line text-[11px] font-semibold text-muted uppercase tracking-wider">
              <th className="px-4 py-3 text-start">{t("thCommand")}</th>
              <th className="px-4 py-3 text-start">{t("thAliases")}</th>
              <th className="px-4 py-3 text-start">{t("thDescription")}</th>
              <th className="px-4 py-3 text-start">{t("thScope")}</th>
              <th className="px-4 py-3 text-start">{t("thRequiredRole")}</th>
              <th className="px-4 py-3 text-center">{t("thStatus")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Spinner className="size-5 text-indigo-400" label={t("loading")} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState text={t("noMatchingCommands")} />
                </td>
              </tr>
            ) : (
              filtered.map((cmd) => (
                <tr key={cmd.name} className="hover:bg-panel-hover/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-indigo-400">
                    <bdi>
                      {prefix}
                      {cmd.name}
                    </bdi>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {cmd.aliases?.length ? (
                        cmd.aliases.map((a) => {
                          const isArabic = ARABIC_SCRIPT.test(a);
                          const otherScript = isArabic !== (language === "ar");
                          return (
                            <span
                              key={a}
                              className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-panel-raised border border-line text-muted"
                              title={
                                otherScript
                                  ? t(isArabic ? "aliasScriptArabic" : "aliasScriptLatin")
                                  : undefined
                              }
                            >
                              <bdi>
                                {prefix}
                                {a}
                              </bdi>
                              {otherScript && (
                                <span className="font-sans font-bold text-[8px] uppercase text-indigo-400">
                                  {isArabic ? "AR" : "EN"}
                                </span>
                              )}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                      <IconButton
                        label={t("editAliases")}
                        icon={<Edit3 size={13} />}
                        size="sm"
                        onClick={() => openAliasModal(cmd)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs text-text-main text-xs">
                    <div>{describe(cmd)}</div>
                    {usageLines(cmd).length > 0 && (
                      <ul
                        className="mt-1 flex flex-col gap-0.5 list-none"
                        aria-label={t("usage")}
                        title={t("usageHint")}
                      >
                        {usageLines(cmd).map((line) => (
                          <li key={line}>
                            <code className="font-mono text-[10px] text-muted bg-panel-raised border border-line rounded px-1 py-0.5 w-fit max-w-full overflow-x-auto inline-block">
                              <bdi>{line}</bdi>
                            </code>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="info">{scopeLabel(cmd.chat)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <CommandPermissionField
                      command={cmd}
                      levels={levels}
                      permissionLabel={permissionLabel}
                      ariaLabel={t("thRequiredRole")}
                      saveLabel={t("save")}
                      savedLabel={t("saved")}
                      onSave={persistPermission}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      checked={cmd.enabled}
                      onChange={(val) => handleToggleEnabled(cmd, val)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Alias Editor Modal */}
      <Dialog
        isOpen={Boolean(editingAliasesCmd)}
        onClose={() => setEditingAliasesCmd(null)}
        title={`${t("aliasesFor")} ${prefix}${editingAliasesCmd?.name || ""}`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditingAliasesCmd(null)}>
              {t("cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveAliases} loading={savingAliases}>
              {savingAliases ? t("saving") : t("save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <p className="text-xs text-muted leading-relaxed">{t("aliasesHelp")}</p>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted block">{t("thAliases")}</span>
            <div className="flex items-center gap-1.5 flex-wrap min-h-[38px] p-2 rounded-lg border border-line bg-panel-raised">
              {tempAliases.length > 0 ? (
                tempAliases.map((a) => {
                  const isArabic = ARABIC_SCRIPT.test(a);
                  const otherScript = isArabic !== (language === "ar");
                  return (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-panel border border-line text-xs font-mono font-medium text-text-main"
                      title={
                        otherScript
                          ? t(isArabic ? "aliasScriptArabic" : "aliasScriptLatin")
                          : undefined
                      }
                    >
                      <bdi>
                        {prefix}
                        {a}
                      </bdi>
                      {otherScript && (
                        <span className="font-sans font-bold text-[8px] uppercase text-indigo-400">
                          {isArabic ? "AR" : "EN"}
                        </span>
                      )}
                      <IconButton
                        variant="ghost"
                        size="sm"
                        label={t("delete")}
                        icon={<X size={12} />}
                        onClick={() => handleRemoveAlias(a)}
                      />
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-faint px-1">{t("noAliases")}</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="new-alias-input" className="text-xs font-medium text-muted block">
              {t("addAlias")}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Tag size={14} className="pointer-events-none absolute start-3 top-2.5 text-muted" />
                <Input
                  id="new-alias-input"
                  type="text"
                  value={newAliasText}
                  onChange={(e) => setNewAliasText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddAlias();
                    }
                  }}
                  placeholder={t("newAliasPlaceholder")}
                  className="ps-9 text-xs"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={handleAddAlias}
                className="shrink-0"
              >
                {t("add")}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

function CommandPermissionField({
  command,
  levels,
  permissionLabel,
  ariaLabel,
  saveLabel,
  savedLabel,
  onSave,
}: {
  command: CommandItem;
  levels: string[];
  permissionLabel: (level: string) => string;
  ariaLabel: string;
  saveLabel: string;
  savedLabel: string;
  onSave: (cmd: CommandItem, permission: PermissionLevel) => Promise<void>;
}) {
  const field = useSavedValue(command.permission);
  return (
    <SaveField
      dirty={field.dirty}
      saving={field.status === "saving"}
      justSaved={field.status === "saved"}
      error={field.error}
      onSave={() => field.save((next) => onSave(command, next))}
      onRevert={field.revert}
      saveLabel={saveLabel}
      savedLabel={savedLabel}
    >
      <Select
        aria-label={ariaLabel}
        value={field.value}
        onChange={(event) => field.setValue(event.target.value as PermissionLevel)}
        className="h-8 py-1 text-xs"
      >
        {levels.map((level) => (
          <option key={level} value={level}>
            {permissionLabel(level)}
          </option>
        ))}
      </Select>
    </SaveField>
  );
}

export default CommandsView;
