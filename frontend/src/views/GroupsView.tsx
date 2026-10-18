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
        toast(`Bot Scope updated to: ${mode.toUpperCase()}`, "success");
      }
    } catch (err: any) {
      toast(err.message, "error");
      loadData();
    }
  };

  const handleToggleWhitelist = async (g: GroupItem) => {
    const nextVal = !g.isWhitelisted;
    await handleUpdate(g.jid, { isWhitelisted: nextVal });
    setBotAccess((prev) => {
      const exists = prev.allowedGroups.some((item) => item.id === g.jid);
      let updated = prev.allowedGroups;
      let nextMode = prev.mode;
      if (nextVal && !exists) {
        updated = [...prev.allowedGroups, { id: g.jid, subject: g.subject, addedAt: Date.now() }];
        if (prev.mode === "public") {
          nextMode = "groups";
          toast("Bot Scope set to 'Specific Groups Only'", "info");
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
        toast("Contact authorized successfully", "success");
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
        toast("Bot Owner registered successfully", "success");
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
      icon: Globe,
      title: "Public (All Chats)",
      desc: "Responds in all groups and private chats.",
      badgeTone: "ok" as const,
    },
    {
      id: "groups",
      icon: Users,
      title: "Specific Groups Only",
      desc: "ONLY responds in whitelisted groups.",
      badgeTone: "info" as const,
    },
    {
      id: "self",
      icon: Lock,
      title: "Only Me (Owner Only)",
      desc: "ONLY responds to bot owners, ignoring others.",
      badgeTone: "warn" as const,
    },
    {
      id: "whitelist",
      icon: ShieldCheck,
      title: "Strict Whitelist",
      desc: "Responds ONLY in approved groups & contacts.",
      badgeTone: "neutral" as const,
    },
    {
      id: "dm_only",
      icon: MessageSquare,
      title: "DM Only (No Groups)",
      desc: "Responds in 1-on-1 DMs, ignores groups.",
      badgeTone: "neutral" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-main">
            Group Guardian & Access Scope
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Manage WhatsApp group policies, authorized whitelists, auto-reply modes, and owner credentials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="info">{fill(t("groupsCount"), { n: groups.length })}</Badge>
        </div>
      </div>

      {/* 1. Bot Scope & Access Mode Selector */}
      <Card className="p-4 sm:p-5 border border-line bg-panel flex flex-col gap-3">
        <CardHeader
          icon={<Shield size={16} />}
          title="Bot Operating Scope"
          description="Select where the bot is authorized to process messages and dispatch replies."
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mt-2">
          {ACCESS_MODE_OPTIONS.map((opt) => {
            const isActive = botAccess.mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleModeChange(opt.id)}
                className={`flex flex-col text-start p-3 rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? "border-indigo-500/50 bg-indigo-500/10 shadow-xs"
                    : "border-line bg-panel-raised hover:border-line/80"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="p-1.5 rounded-md bg-panel border border-line text-indigo-400">
                    <opt.icon size={14} />
                  </div>
                  {isActive ? (
                    <Badge tone="ok">Active</Badge>
                  ) : (
                    <span className="text-[10px] text-faint uppercase font-mono font-medium">
                      {opt.id}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-text-main line-clamp-1">{opt.title}</span>
                <span className="text-[11px] text-muted line-clamp-2 mt-0.5 leading-snug">
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Scope Status Explanation Banner */}
        {botAccess.mode === "groups" && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 text-xs text-text-main mt-2">
            <ShieldCheck size={16} className="text-indigo-400 shrink-0" />
            <div>
              <strong className="text-indigo-400 font-semibold">Active Scope: Specific Groups Only. </strong>
              The bot will respond only in the <b>{botAccess.allowedGroups.length}</b> whitelisted group(s). Other chats are ignored.
            </div>
          </div>
        )}
      </Card>

      {/* 2. Groups Table with Whitelist & Controls */}
      <Card padded={false} className="overflow-x-auto border border-line bg-panel">
        <div className="p-3.5 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-400" />
            <span className="text-xs font-semibold text-text-main">Managed Communities</span>
            <span className="font-mono text-[10px] text-muted">({groups.length})</span>
          </div>
          <span className="text-[11px] text-muted">
            Toggle <b>"Allowed"</b> to authorize the bot in any group.
          </span>
        </div>

        <table className="w-full min-w-[760px] border-collapse text-start text-xs">
          <thead>
            <tr className="border-b border-line bg-panel-raised text-[11px] font-semibold uppercase tracking-wider text-muted">
              <th className="px-4 py-3 text-start">Group</th>
              <th className="px-4 py-3 text-center">Bot Allowed</th>
              <th className="px-4 py-3 text-start">Auto-Reply</th>
              <th className="px-4 py-3 text-start">AI Filter</th>
              <th className="px-4 py-3 text-center">{t("thAntiLink")}</th>
              <th className="px-4 py-3 text-start">{t("thMedia")}</th>
              <th className="px-4 py-3 text-center">{t("thWelcome")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <Spinner className="size-5 text-indigo-400" label={t("loading")} />
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={<ShieldAlert size={24} />}
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
                    <td className="px-4 py-3 font-medium text-text-main">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded bg-panel-raised text-xs font-bold text-indigo-400 border border-line">
                          {(g.subject || "G").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="line-clamp-1">{g.subject || t("unnamedGroup")}</span>
                          <span className="font-mono text-[10px] text-muted truncate max-w-[200px]">
                            {g.jid}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Bot Allowed Whitelist Toggle */}
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        checked={isWhitelisted}
                        onChange={() => handleToggleWhitelist(g)}
                        aria-label="Toggle Bot Allowed"
                      />
                    </td>

                    {/* Auto-Reply Mode */}
                    <td className="px-4 py-3">
                      <Select
                        className="text-xs h-8 py-1"
                        value={g.autoReply || "mention"}
                        onChange={(e) => handleUpdate(g.jid, { autoReply: e.target.value })}
                      >
                        <option value="mention">Mention (@bot)</option>
                        <option value="all">All Messages</option>
                        <option value="off">Off (Commands Only)</option>
                      </Select>
                    </td>

                    {/* Content Filter Mode */}
                    <td className="px-4 py-3">
                      <Select
                        className="text-xs h-8 py-1"
                        value={g.contentFilter || "off"}
                        onChange={(e) => handleUpdate(g.jid, { contentFilter: e.target.value })}
                      >
                        <option value="off">Unfiltered</option>
                        <option value="on">Filter Safe</option>
                      </Select>
                    </td>

                    {/* Anti-link */}
                    <td className="px-4 py-3 text-center">
                      <Toggle
                        checked={Boolean(g.antilink)}
                        onChange={(val) => handleUpdate(g.jid, { antilink: val })}
                      />
                    </td>

                    {/* Media Restriction */}
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-center">
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

      {/* 3. Authorized DMs & Bot Owners (2-column layout) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Whitelisted Personal DMs */}
        <Card className="p-4 sm:p-5 border border-line bg-panel flex flex-col gap-3">
          <CardHeader
            icon={<MessageSquare size={16} />}
            title="Authorized Private DMs"
            description="Specific contacts allowed to communicate with the bot in Strict Whitelist mode."
          />

          <form onSubmit={handleAddDm} className="flex flex-col sm:flex-row gap-2 mt-1">
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
              className="sm:w-32 text-xs"
            />
            <Button type="submit" variant="primary" size="sm" loading={addingDm} icon={<Plus size={13} />}>
              Add
            </Button>
          </form>

          <div className="flex flex-col divide-y divide-line rounded-lg border border-line bg-panel-raised max-h-52 overflow-y-auto mt-1">
            {botAccess.allowedDms.length === 0 ? (
              <span className="p-3.5 text-center text-xs text-muted">
                No personal contacts whitelisted yet.
              </span>
            ) : (
              botAccess.allowedDms.map((dm) => (
                <div key={dm.id} className="flex items-center justify-between p-2.5 px-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-text-main">
                      {dm.name || dm.id.split("@")[0]}
                    </span>
                    <span className="font-mono text-[10px] text-muted truncate">
                      {dm.id}
                    </span>
                  </div>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    label="Remove Contact"
                    icon={<Trash2 size={13} className="text-rose-400" />}
                    onClick={() => handleRemoveDm(dm.id)}
                  />
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Bot Owners & Permissions */}
        <Card className="p-4 sm:p-5 border border-line bg-panel flex flex-col gap-3">
          <CardHeader
            icon={<UserCheck size={16} />}
            title="Bot Superusers & Owners"
            description="Registered bot owners who can execute superuser commands directly via WhatsApp."
          />

          <form onSubmit={handleAddOwner} className="flex gap-2 mt-1">
            <Input
              type="text"
              placeholder="Owner phone: 923001234567"
              value={newOwnerPhone}
              onChange={(e) => setNewOwnerPhone(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
            <Button type="submit" variant="primary" size="sm" loading={addingOwner} icon={<UserPlus size={13} />}>
              Add Owner
            </Button>
          </form>

          <div className="flex flex-col divide-y divide-line rounded-lg border border-line bg-panel-raised max-h-52 overflow-y-auto mt-1">
            {permissions.owners.length === 0 ? (
              <span className="p-3.5 text-center text-xs text-muted">
                No custom owners registered yet. Add your phone number above.
              </span>
            ) : (
              permissions.owners.map((owner) => (
                <div key={owner.jid} className="flex items-center justify-between p-2.5 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge tone="ok">Owner</Badge>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-text-main">
                        {owner.displayName || owner.phone || owner.jid.split("@")[0]}
                      </span>
                      <span className="font-mono text-[10px] text-muted truncate">
                        {owner.jid}
                      </span>
                    </div>
                  </div>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    label="Remove Owner"
                    icon={<Trash2 size={13} className="text-rose-400" />}
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
        className="h-8 py-1 text-xs"
      >
        <option value="none">{noneLabel}</option>
        <option value="block_all">{blockLabel}</option>
      </Select>
    </SaveField>
  );
}

export default GroupsView;
