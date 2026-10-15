// file: frontend/src/views/GroupsView.tsx

import {
  Globe,
  Lock,
  MessageSquare,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../components/Toasts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  SaveField,
  Select,
  Spinner,
  Toggle,
  useSavedValue,
} from "../components/ui";
import { useI18n } from "../context/I18nContext";
import type { GroupItem } from "../types";
import { fill } from "../utils/fill";

interface BotAccessState {
  mode: string;
  modes: Record<string, { id: string; label: string; emoji: string; desc: string }>;
  allowedGroups: Array<{ id: string; subject?: string | null; addedAt?: number }>;
  allowedDms: Array<{ id: string; name?: string | null; addedAt?: number }>;
}

interface PermissionsState {
  owners: Array<{ jid: string; lid?: string | null; displayName?: string | null; phone?: string | null }>;
  admins: Array<{ jid: string; lid?: string | null; displayName?: string | null; phone?: string | null }>;
}

export const GroupsView: React.FC = () => {
  const { t } = useI18n();
  const { toast } = useToast();

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [botAccess, setBotAccess] = useState<BotAccessState>({
    mode: "public",
    modes: {},
    allowedGroups: [],
    allowedDms: [],
  });

  const [permissions, setPermissions] = useState<PermissionsState>({
    owners: [],
    admins: [],
  });

  // Inputs for adding allowed DM & Owner
  const [newDmPhone, setNewDmPhone] = useState("");
  const [newDmName, setNewDmName] = useState("");
  const [addingDm, setAddingDm] = useState(false);

  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  const [addingOwner, setAddingOwner] = useState(false);

  const normalizeGroup = (g: any): GroupItem => {
    const jid = g.jid || g.id || "";
    const antilinkEnabled =
      typeof g.antilink === "boolean"
        ? g.antilink
        : Boolean(g.antilinkEnabled ?? g.antilink?.enabled);
    return {
      ...g,
      jid,
      subject: g.subject || "",
      memberCount: g.memberCount ?? g.participants ?? 0,
      antilink: antilinkEnabled,
      antilinkEnabled,
      welcomeEnabled: Boolean(g.welcomeEnabled ?? g.welcome_system?.enabled),
      mediaRestriction: g.mediaRestriction || "none",
      isWhitelisted: Boolean(g.isWhitelisted),
      contentFilter: g.contentFilter || "off",
      autoReply: g.autoReply || "mention",
    };
  };

  const loadData = async () => {
    try {
      const [groupsRes, accessRes, permsRes] = await Promise.all([
        api.getGroups().catch(() => ({ groups: [] })),
        api.getBotAccess().catch(() => null),
        api.getPermissions().catch(() => null),
      ]);

      if (groupsRes?.groups) {
        setGroups(groupsRes.groups.map(normalizeGroup));
      }
      if (accessRes?.success) {
        setBotAccess({
          mode: accessRes.mode || "public",
          modes: accessRes.modes || {},
          allowedGroups: accessRes.allowedGroups || [],
          allowedDms: accessRes.allowedDms || [],
        });
      }
      if (permsRes?.success) {
        setPermissions({
          owners: permsRes.owners || [],
          admins: permsRes.admins || [],
        });
      }
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdate = async (jid: string, updates: Partial<GroupItem>) => {
    setGroups((prev) => prev.map((g) => (g.jid === jid ? { ...g, ...updates } : g)));
    try {
      await api.updateGroup(jid, updates);
      toast(t("savedSuccessfully"), "success");
    } catch (err: any) {
      toast(err.message, "error");
      loadData();
    }
  };

  const persistMedia = async (jid: string, mediaRestriction: string) => {
    await api.updateGroup(jid, { mediaRestriction });
    setGroups((prev) => prev.map((g) => (g.jid === jid ? { ...g, mediaRestriction } : g)));
  };

  const handleModeChange = async (mode: string) => {
    setBotAccess((prev) => ({ ...prev, mode }));
    try {
      const res = await api.setBotAccessMode(mode);
      if (res?.success) {
        toast(`Bot Scope set to: ${mode.toUpperCase()}`, "success");
      }
    } catch (err: any) {
      toast(err.message, "error");
      loadData();
    }
  };

  const handleToggleWhitelist = async (g: GroupItem) => {
    const nextVal = !g.isWhitelisted;
    await handleUpdate(g.jid, { isWhitelisted: nextVal });
    // Also update botAccess allowedGroups and mode in local state
    setBotAccess((prev) => {
      const exists = prev.allowedGroups.some((item) => item.id === g.jid);
      let updated = prev.allowedGroups;
      let nextMode = prev.mode;
      if (nextVal && !exists) {
        updated = [...prev.allowedGroups, { id: g.jid, subject: g.subject, addedAt: Date.now() }];
        if (prev.mode === "public") {
          nextMode = "groups";
          toast("Bot Scope set to 'Specific Groups Only' so unauthorized groups & personal DMs are blocked!", "info");
        }
      } else if (!nextVal && exists) {
        updated = prev.allowedGroups.filter((item) => item.id !== g.jid);
        if (updated.length === 0 && prev.mode === "groups") {
          nextMode = "public";
        }
      }
      return { ...prev, allowedGroups: updated, mode: nextMode };
    });
  };

  const handleAddDm = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newDmPhone.replace(/\D/g, "");
    if (!clean) {
      toast("Please enter a valid phone number", "error");
      return;
    }
    setAddingDm(true);
    try {
      const res = await api.addAllowedDm(clean, newDmName.trim() || null);
      if (res?.success) {
        setBotAccess((prev) => ({ ...prev, allowedDms: res.allowedDms }));
        setNewDmPhone("");
        setNewDmName("");
        toast("Contact authorized successfully!", "success");
      }
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setAddingDm(false);
    }
  };

  const handleRemoveDm = async (id: string) => {
    try {
      const res = await api.removeAllowedDm(id);
      if (res?.success) {
        setBotAccess((prev) => ({ ...prev, allowedDms: res.allowedDms }));
        toast("Contact removed from whitelist", "info");
      }
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newOwnerPhone.replace(/\D/g, "");
    if (!clean) {
      toast("Please enter a valid phone number", "error");
      return;
    }
    setAddingOwner(true);
    try {
      const res = await api.addOwner(clean);
      if (res?.success) {
        setPermissions((prev) => ({ ...prev, owners: res.owners }));
        setNewOwnerPhone("");
        toast("Bot Owner added successfully!", "success");
      }
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setAddingOwner(false);
    }
  };

  const handleRemoveOwner = async (jid: string) => {
    try {
      const res = await api.removeOwner(jid);
      if (res?.success) {
        setPermissions((prev) => ({ ...prev, owners: res.owners }));
        toast("Owner removed", "info");
      }
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const ACCESS_MODE_OPTIONS = [
    {
      id: "public",
      emoji: "🌍",
      title: "Public (All Chats)",
      desc: "Bot works in all groups and private chats.",
      badgeTone: "ok" as const,
    },
    {
      id: "groups",
      emoji: "👥",
      title: "Specific Groups Only",
      desc: "Bot ONLY responds in authorized whitelisted groups.",
      badgeTone: "info" as const,
    },
    {
      id: "self",
      emoji: "🔒",
      title: "Only Me (Owner Only)",
      desc: "Bot ONLY responds to you (the owner), completely ignoring everyone else.",
      badgeTone: "warn" as const,
    },
    {
      id: "whitelist",
      emoji: "🎯",
      title: "Strict Whitelist",
      desc: "Bot ONLY responds in approved groups AND approved private contacts.",
      badgeTone: "brand" as const,
    },
    {
      id: "dm_only",
      emoji: "💬",
      title: "DM Only (No Groups)",
      desc: "Bot responds in 1-on-1 private DMs, completely ignoring all groups.",
      badgeTone: "neutral" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<ShieldCheck size={24} />}
        title={
          <span className="inline-flex items-center gap-2">
            Groups & Bot Scope Control
            <Badge tone="info">{fill(t("groupsCount"), { n: groups.length })}</Badge>
          </span>
        }
        description="Choose which groups and chats the bot is allowed to work in, switch bot scope, and manage Bot Owners & Permissions."
      />

      {/* 1. Bot Scope & Access Mode Selector */}
      <Card className="flex flex-col gap-4">
        <CardHeader
          icon={<Shield size={20} className="text-brand-cyan" />}
          title="Bot Work Scope & Permissions (Daira-e-Kaar)"
        />
        <p className="text-xs text-muted">
          Select where the bot is allowed to reply. Switch to <b>"Specific Groups Only"</b> or <b>"Strict Whitelist"</b> so the bot NEVER talks in unauthorized groups or contacts!
        </p>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {ACCESS_MODE_OPTIONS.map((opt) => {
            const isActive = botAccess.mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleModeChange(opt.id)}
                className={`flex flex-col text-start p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? "border-brand-cyan bg-brand-blue/15 shadow-md shadow-brand-blue/10 ring-1 ring-brand-cyan"
                    : "border-line bg-panel-raised hover:border-line-hover hover:bg-panel-hover"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span className="text-lg">{opt.emoji}</span>
                  {isActive ? (
                    <Badge tone="ok">Active</Badge>
                  ) : (
                    <span className="text-[11px] text-muted uppercase font-bold font-mono">
                      {opt.id}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-text-main line-clamp-1">{opt.title}</span>
                <span className="text-[11px] text-muted line-clamp-2 mt-1 leading-snug">
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Scope Status Explanation Banner */}
        {botAccess.mode === "groups" && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-brand-cyan/40 bg-brand-blue/10 text-xs text-text-main">
            <ShieldCheck size={18} className="text-brand-cyan shrink-0" />
            <div>
              <span className="font-bold text-brand-cyan">Active Scope: Specific Groups Only. </span>
              The bot will <b>ONLY</b> respond in the <b>{botAccess.allowedGroups.length}</b> whitelisted group(s) below. All other groups and personal DMs from contacts/strangers are <b>strictly ignored & blocked</b>!
            </div>
          </div>
        )}
        {botAccess.mode === "whitelist" && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-brand-cyan/40 bg-brand-blue/10 text-xs text-text-main">
            <ShieldCheck size={18} className="text-brand-cyan shrink-0" />
            <div>
              <span className="font-bold text-brand-cyan">Active Scope: Strict Whitelist. </span>
              The bot will <b>ONLY</b> respond in the <b>{botAccess.allowedGroups.length}</b> whitelisted group(s) and <b>{botAccess.allowedDms.length}</b> authorized private contacts below.
            </div>
          </div>
        )}
        {botAccess.mode === "self" && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-text-main">
            <ShieldAlert size={18} className="text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-400">Active Scope: Only Me (Owner). </span>
              The bot will <b>ONLY</b> respond to you. All other users and groups are completely ignored.
            </div>
          </div>
        )}
        {botAccess.mode === "public" && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-line bg-panel-raised text-xs text-muted">
            <Globe size={18} className="text-brand-cyan shrink-0" />
            <div>
              <span className="font-bold text-text-main">Active Scope: Public (All Chats). </span>
              {botAccess.allowedGroups.length > 0 ? (
                <span className="text-amber-400 font-semibold">
                  You have {botAccess.allowedGroups.length} group(s) whitelisted. The bot is strictly restricted to those groups and owner DMs.
                </span>
              ) : (
                "The bot works in all groups and private chats. Select 'Specific Groups Only' above to restrict it."
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 2. Groups Table with Whitelist & Controls */}
      <Card padded={false} className="overflow-x-auto">
        <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-brand-cyan" />
            <span className="text-sm font-bold text-text-main">WhatsApp Groups</span>
            <Badge tone="info">{groups.length} groups found</Badge>
          </div>
          <span className="text-xs text-muted">
            Toggle <b>"Bot Allowed"</b> to whitelist or disable the bot in any group!
          </span>
        </div>

        <table className="w-full min-w-[760px] border-collapse text-start text-sm">
          <thead>
            <tr className="border-b border-line bg-panel-raised text-xs font-bold uppercase tracking-wider text-muted">
              <th className="px-5 py-4 text-start">Group</th>
              <th className="px-5 py-4 text-center">Bot Allowed</th>
              <th className="px-5 py-4 text-start">Auto-Reply</th>
              <th className="px-5 py-4 text-start">AI Filter</th>
              <th className="px-5 py-4 text-center">{t("thAntiLink")}</th>
              <th className="px-5 py-4 text-start">{t("thMedia")}</th>
              <th className="px-5 py-4 text-center">{t("thWelcome")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <Spinner className="size-6" label={t("loading")} />
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={<ShieldAlert size={28} />}
                    title={t("noGroupsTitle")}
                    description={t("noGroupsBody")}
                  />
                </td>
              </tr>
            ) : (
              groups.map((g) => {
                const isWhitelisted = Boolean(
                  g.isWhitelisted ||
                    botAccess.allowedGroups.some((item) => item.id === g.jid),
                );

                return (
                  <tr key={g.jid} className="transition-colors hover:bg-panel-hover/50">
                    <td className="px-5 py-4 font-bold text-text-main">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-sm font-bold text-brand-cyan">
                          {(g.subject || "G").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="line-clamp-1">{g.subject || t("unnamedGroup")}</span>
                          <span className="font-mono text-[11px] text-muted truncate max-w-[200px]">
                            {g.jid}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Bot Allowed Whitelist Toggle */}
                    <td className="px-5 py-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Toggle
                          checked={isWhitelisted}
                          onChange={() => handleToggleWhitelist(g)}
                          aria-label="Toggle Bot Allowed"
                        />
                        <span className={`text-[10px] font-bold ${isWhitelisted ? "text-ok" : "text-muted"}`}>
                          {isWhitelisted ? "Allowed ✅" : "Disabled"}
                        </span>
                      </div>
                    </td>

                    {/* Auto-Reply Mode */}
                    <td className="px-5 py-4">
                      <Select
                        className="text-xs font-medium"
                        value={g.autoReply || "mention"}
                        onChange={(e) => handleUpdate(g.jid, { autoReply: e.target.value })}
                      >
                        <option value="mention">Mention Only (@bot)</option>
                        <option value="all">All Messages (Human)</option>
                        <option value="off">Off (Commands Only)</option>
                      </Select>
                    </td>

                    {/* Content Filter Mode */}
                    <td className="px-5 py-4">
                      <Select
                        className="text-xs font-medium"
                        value={g.contentFilter || "off"}
                        onChange={(e) => handleUpdate(g.jid, { contentFilter: e.target.value })}
                      >
                        <option value="off">Unfiltered (Roast / Slang)</option>
                        <option value="on">Filter ON (Safe)</option>
                      </Select>
                    </td>

                    {/* Anti-link */}
                    <td className="px-5 py-4 text-center">
                      <Toggle
                        checked={Boolean(g.antilink)}
                        onChange={(val) => handleUpdate(g.jid, { antilink: val })}
                      />
                    </td>

                    {/* Media Restriction */}
                    <td className="px-5 py-4">
                      <GroupMediaField
                        jid={g.jid}
                        value={g.mediaRestriction || "none"}
                        noneLabel={t("mediaNone")}
                        blockLabel={t("mediaBlockAll")}
                        ariaLabel={t("thMedia")}
                        saveLabel={t("save")}
                        savedLabel={t("saved")}
                        onSave={persistMedia}
                      />
                    </td>

                    {/* Welcome System */}
                    <td className="px-5 py-4 text-center">
                      <Toggle
                        checked={Boolean(g.welcomeEnabled)}
                        onChange={(val) => handleUpdate(g.jid, { welcomeEnabled: val })}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* 3. Authorized Private Contacts & Bot Owners (2-column layout) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Whitelisted Personal DMs */}
        <Card className="flex flex-col gap-4">
          <CardHeader
            icon={<MessageSquare size={18} className="text-brand-cyan" />}
            title="Authorized Private Contacts (DMs)"
          />
          <p className="text-xs text-muted">
            In <b>Strict Whitelist</b> mode, the bot will ONLY reply to the phone numbers listed below. Protects against accidental replies to family, work contacts, or strangers!
          </p>

          <form onSubmit={handleAddDm} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="text"
              placeholder="e.g. 923001234567"
              value={newDmPhone}
              onChange={(e) => setNewDmPhone(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
            <Input
              type="text"
              placeholder="Name (optional)"
              value={newDmName}
              onChange={(e) => setNewDmName(e.target.value)}
              className="sm:w-36 text-xs"
            />
            <Button type="submit" variant="primary" size="sm" loading={addingDm} icon={<Plus size={14} />}>
              Add Contact
            </Button>
          </form>

          <div className="flex flex-col divide-y divide-line/30 rounded-lg border border-line bg-panel-raised max-h-60 overflow-y-auto">
            {botAccess.allowedDms.length === 0 ? (
              <span className="p-4 text-center text-xs text-muted">
                No individual contacts whitelisted yet.
              </span>
            ) : (
              botAccess.allowedDms.map((dm) => (
                <div key={dm.id} className="flex items-center justify-between p-2.5 px-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-text-main">
                      {dm.name || dm.id.split("@")[0]}
                    </span>
                    <span className="font-mono text-[11px] text-muted truncate">
                      {dm.id}
                    </span>
                  </div>
                  <IconButton
                    variant="ghost"
                    label="Remove Contact"
                    icon={<Trash2 size={14} className="text-danger" />}
                    onClick={() => handleRemoveDm(dm.id)}
                  />
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Bot Owners & Permissions */}
        <Card className="flex flex-col gap-4">
          <CardHeader
            icon={<UserCheck size={18} className="text-brand-cyan" />}
            title="Bot Owners & Permissions"
          />
          <p className="text-xs text-muted">
            Bot Owners have full superuser access. They can never be locked out and can run all owner-only commands from WhatsApp.
          </p>

          <form onSubmit={handleAddOwner} className="flex gap-2">
            <Input
              type="text"
              placeholder="Owner phone: 923001234567"
              value={newOwnerPhone}
              onChange={(e) => setNewOwnerPhone(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
            <Button type="submit" variant="primary" size="sm" loading={addingOwner} icon={<UserPlus size={14} />}>
              Add Owner
            </Button>
          </form>

          <div className="flex flex-col divide-y divide-line/30 rounded-lg border border-line bg-panel-raised max-h-60 overflow-y-auto">
            {permissions.owners.length === 0 ? (
              <span className="p-4 text-center text-xs text-muted">
                No custom owners registered yet. (Add your phone number above!)
              </span>
            ) : (
              permissions.owners.map((owner) => (
                <div key={owner.jid} className="flex items-center justify-between p-2.5 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge tone="ok">Owner</Badge>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-text-main">
                        {owner.displayName || owner.phone || owner.jid.split("@")[0]}
                      </span>
                      <span className="font-mono text-[11px] text-muted truncate">
                        {owner.jid}
                      </span>
                    </div>
                  </div>
                  <IconButton
                    variant="ghost"
                    label="Remove Owner"
                    icon={<Trash2 size={14} className="text-danger" />}
                    onClick={() => handleRemoveOwner(owner.jid)}
                  />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

function GroupMediaField({
  jid,
  value,
  noneLabel,
  blockLabel,
  ariaLabel,
  saveLabel,
  savedLabel,
  onSave,
}: {
  jid: string;
  value: string;
  noneLabel: string;
  blockLabel: string;
  ariaLabel: string;
  saveLabel: string;
  savedLabel: string;
  onSave: (jid: string, mediaRestriction: string) => Promise<void>;
}) {
  const field = useSavedValue(value);
  return (
    <SaveField
      dirty={field.dirty}
      saving={field.status === "saving"}
      justSaved={field.status === "saved"}
      error={field.error}
      onSave={() => field.save((next) => onSave(jid, next))}
      onRevert={field.revert}
      saveLabel={saveLabel}
      savedLabel={savedLabel}
    >
      <Select
        aria-label={ariaLabel}
        value={field.value}
        onChange={(event) => field.setValue(event.target.value)}
      >
        <option value="none">{noneLabel}</option>
        <option value="block_all">{blockLabel}</option>
      </Select>
    </SaveField>
  );
}
