import { useCallback, useEffect, useState } from "react";
import { Brain, Copy, Download, Pencil, RefreshCw, Trash2 } from "lucide-react";
import {
  trainingApi,
  type TrainingGroup,
  type TrainingOverview,
  type TrainingResource,
} from "../api/training";
import { useI18n as useAppI18n } from "../context/I18nContext";
import type { translations } from "../i18n/translations";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  FormActions,
  IconButton,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  Toggle,
  UserText,
  useDirtyForm,
} from "../components/ui";

function useI18n() {
  const context = useAppI18n();
  return {
    ...context,
    t: (key: keyof typeof translations.en | `training${string}`) =>
      context.t(key as keyof typeof translations.en),
  };
}

const MODES = [
  "mention-only",
  "smart",
  "assistant",
  "reaction-preferred",
  "silent-observer",
  "custom",
];
const download = (name: string, value: unknown) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

function GroupEditor({
  group,
  overview,
  onClose,
  onSaved,
}: {
  group: Partial<TrainingGroup>;
  overview: TrainingOverview;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState({
    chatId: "",
    enabled: true,
    mode: "mention-only",
    learning: false,
    proactive: false,
    reactionEnabled: true,
    humor: false,
    retentionDays: Math.min(7, overview.limits.retentionDays),
    adminConfirmed: false,
    ...group,
  });
  const [notice, setNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog isOpen onClose={onClose} title={t("trainingGroupSetup")}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await trainingApi.post("/groups", {
              ...draft,
              noticeVersion: overview.noticeVersion,
              adminConfirmed: notice,
            });
            await onSaved();
            onClose();
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={t("trainingSelectChat")} htmlFor="training-chat" description={t("trainingChatSelectorHelp")}>
          <Select
            id="training-chat"
            value={draft.chatId}
            required
            disabled={Boolean(group.chatId)}
            onChange={(event) => setDraft({ ...draft, chatId: event.target.value })}
          >
            <option value="">{t("trainingChooseChat")}</option>
            {group.chatId && !overview.authorizedChats.some((chat) => chat.chatId === group.chatId) && (
              <option value={group.chatId} dir="auto">{group.chatId} ({t("trainingChatUnavailable")})</option>
            )}
            {overview.authorizedChats.map((chat) => (
              <option key={chat.chatId} value={chat.chatId} dir="auto">{chat.name || chat.chatId} · {chat.chatId}</option>
            ))}
          </Select>
        </Field>
        {!overview.authorizedChats.length && <p role="status" className="text-sm text-muted">{t("trainingNoAuthorizedChats")}</p>}
        <Field label={t("trainingResponseMode")} htmlFor="training-response-mode">
          <Select
            id="training-response-mode"
            value={draft.mode}
            onChange={(event) => setDraft({ ...draft, mode: event.target.value })}
          >
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`trainingMode_${mode}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox
          checked={draft.enabled}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          label={t("trainingEnableAi")}
        />
        <Checkbox
          checked={draft.learning}
          onChange={(event) => setDraft({ ...draft, learning: event.target.checked })}
          label={t("trainingEnableLearning")}
        />
        {draft.mode === "smart" && (
          <Checkbox
            checked={draft.proactive}
            onChange={(event) => setDraft({ ...draft, proactive: event.target.checked })}
            label={t("trainingProactive")}
          />
        )}
        <Card>
          <UserText>{overview.notice}</UserText>
          <p className="text-sm text-muted mt-3">{t("trainingParticipantConsent")}</p>
        </Card>
        <Checkbox
          checked={notice}
          onChange={(event) => setNotice(event.target.checked)}
          label={t("trainingNoticeConfirmation")}
        />
        {error && (
          <p role="alert" className="text-danger">
            <UserText>{error}</UserText>
          </p>
        )}
        <Button type="submit" variant="primary" disabled={!notice || !draft.chatId} loading={busy}>
          {group.id ? t("save") : t("trainingStart")}
        </Button>
      </form>
    </Dialog>
  );
}

function AutomaticLearning({
  overview,
  refresh,
}: {
  overview: TrainingOverview;
  refresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<Partial<TrainingGroup> | null>(null);
  const [resetting, setResetting] = useState<TrainingGroup | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t("trainingAdaptiveTitle")}
          description={t("trainingAdaptiveDescription")}
          actions={
            <Button variant="primary" onClick={() => setEditing({})}>
              {t("trainingAddChat")}
            </Button>
          }
        />
        <p className="text-sm text-muted">
          {t("trainingConnectionCount")}: {overview.connections.length} ·{" "}
          {t("trainingManagedChats")}: {overview.groups.length}
        </p>
      </Card>
      {!overview.groups.length && (
        <EmptyState
          icon={<Brain />}
          title={t("trainingNoGroups")}
          description={t("trainingNoGroupsDescription")}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {overview.groups.map((group) => (
          <Card key={group.id}>
            <CardHeader
              title={<UserText>{overview.authorizedChats.find((chat) => chat.chatId === group.chatId)?.name || group.chatId}</UserText>}
              actions={
                <IconButton
                  label={t("edit")}
                  icon={<Pencil size={16} />}
                  onClick={() => setEditing(group)}
                />
              }
            />
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge tone={group.enabled ? "ok" : "neutral"}>
                {t(group.enabled ? "trainingActive" : "trainingPaused")}
              </Badge>
              <Badge>{t(`trainingMode_${group.mode}`)}</Badge>
            </div>
            <Toggle
              checked={group.enabled}
              label={t("trainingEnableAi")}
              onChange={async (enabled) => {
                try {
                  await trainingApi.post("/groups", { ...group, enabled });
                  await refresh();
                } catch (cause) {
                  setError((cause as Error).message);
                }
              }}
            />
            <p className="text-sm text-muted mt-4">
              {group.learning ? t("trainingLearningOptIn") : t("trainingLearningOff")}
            </p>
            <p className="mt-3">
              {group.profile?.enoughData ? (
                <>
                  {t("trainingObservedStyle")} <UserText>{group.profile.language || ""}</UserText> ·{" "}
                  {group.profile.averageWords} {t("trainingWords")}
                </>
              ) : (
                t("trainingInsufficientData")
              )}
            </p>
            <p className="text-sm text-muted mt-2">
              {t("trainingSamples")}: {group.profile?.messages || 0} · {t("trainingRetention")}:{" "}
              {group.retentionDays}
            </p>
            {group.profile?.updatedAt && (
              <p className="text-sm text-muted">
                {t("trainingLastUpdate")}: {new Date(group.profile.updatedAt).toLocaleString()}
              </p>
            )}
            <div className="flex justify-end mt-3">
              <IconButton
                label={t("trainingResetProfile")}
                icon={<Trash2 size={16} />}
                onClick={() => setResetting(group)}
              />
              <IconButton
                label={t("export")}
                icon={<Download size={16} />}
                onClick={() => download("group-profile.json", group)}
              />
            </div>
          </Card>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-danger">
          <UserText>{error}</UserText>
        </p>
      )}
      {editing && (
        <GroupEditor
          group={editing}
          overview={overview}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      <ConfirmDialog
        isOpen={Boolean(resetting)}
        onClose={() => setResetting(null)}
        title={t("trainingResetProfile")}
        description={t("trainingResetDescription")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={async () => {
          if (resetting) await trainingApi.post("/groups/reset", { chatId: resetting.chatId });
          await refresh();
          setResetting(null);
        }}
      />
    </div>
  );
}

const RESOURCE_TYPES = ["persona", "rule", "example", "feedback", "version"];
function ResourceEditor({
  kind,
  resource,
  templates,
  onClose,
  refresh,
}: {
  kind: string;
  resource: TrainingResource | null;
  templates: TrainingResource[];
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const base =
    resource ||
    (kind === "persona"
      ? { ...templates[0], template: templates[0]?.id, id: undefined, revision: undefined }
      : kind === "example"
        ? { name: "", prompt: "", response: "" }
        : kind === "feedback"
          ? { category: "incorrect", correction: "" }
          : { name: "", instructions: "" });
  const [value, setValue] = useState(JSON.stringify(base, null, 2));
  const [personaDraft, setPersonaDraft] = useState<TrainingResource>(base as TrainingResource);
  const [advanced, setAdvanced] = useState(kind !== "persona");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog isOpen onClose={onClose} title={t(`trainingResource_${kind}`)}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await trainingApi.post(`/resources/${kind}`, kind === "persona" && !advanced ? personaDraft : JSON.parse(value));
            await refresh();
            onClose();
          } catch (cause) {
            setError((cause as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {kind === "persona" && !resource && !advanced && (
          <Field label={t("trainingTemplate")} htmlFor="persona-template">
            <Select
              id="persona-template"
              value={personaDraft.template || templates[0]?.id}
              onChange={(event) => {
                const template = templates.find((item) => item.id === event.target.value);
                if (template) setPersonaDraft({ ...template, template: template.id, id: undefined, revision: undefined } as unknown as TrainingResource);
              }}
            >
              {templates.map((template) => (
                <option dir="auto" key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {kind === "persona" && !advanced && (
          <>
            <Field label={t("trainingPersonaName")} htmlFor="persona-name">
              <Input id="persona-name" dir="auto" required maxLength={80} value={personaDraft.name || ""} onChange={(event) => setPersonaDraft({ ...personaDraft, name: event.target.value })} />
            </Field>
            <Field label={t("trainingPersonaInstructions")} htmlFor="persona-instructions">
              <Textarea id="persona-instructions" dir="auto" rows={5} maxLength={3000} value={personaDraft.instructions || ""} onChange={(event) => setPersonaDraft({ ...personaDraft, instructions: event.target.value })} />
            </Field>
          </>
        )}
        {kind === "persona" && <Checkbox label={t("trainingAdvancedJson")} checked={advanced} onChange={(event) => {
          if (event.target.checked) { setValue(JSON.stringify(personaDraft, null, 2)); setAdvanced(true); }
          else { try { setPersonaDraft(JSON.parse(value)); setAdvanced(false); setError(""); } catch (cause) { setError((cause as Error).message); } }
        }} />}
        {advanced && <Field
          label={t("trainingConfigurationJson")}
          htmlFor="training-resource-json"
          description={t("trainingAdvancedOptional")}
          error={error}
        >
          <Textarea
            id="training-resource-json"
            rows={18}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            dir="ltr"
          />
        </Field>}
        {error && <p role="alert" className="text-danger"><UserText>{error}</UserText></p>}
        <Button variant="primary" type="submit" loading={busy}>
          {t("save")}
        </Button>
      </form>
    </Dialog>
  );
}

function Resources({ kind, overview }: { kind: string; overview: TrainingOverview }) {
  const { t } = useI18n();
  const [items, setItems] = useState<TrainingResource[]>([]);
  const [editing, setEditing] = useState<TrainingResource | null | undefined>(undefined);
  const [removing, setRemoving] = useState<TrainingResource | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setItems(await trainingApi.get(`/resources/${kind}`));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [kind]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const act = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      await refresh();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t(`trainingResource_${kind}`)}
          description={t("trainingDraftsDescription")}
          actions={
            <Button
              variant="primary"
              onClick={() =>
                kind === "version"
                  ? void act(() =>
                      trainingApi.post("/versions", { name: new Date().toISOString() }),
                    )
                  : setEditing(null)
              }
            >
              {kind === "version" ? t("trainingSnapshot") : t("trainingCreate")}
            </Button>
          }
        />
        {kind === "persona" && (
          <Field label={t("trainingImportPersona")} htmlFor="persona-import">
            <Input
              id="persona-import"
              type="file"
              accept=".json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file || file.size > 100000) return;
                try {
                  const parsed = JSON.parse(await file.text());
                  setEditing({ ...parsed, id: undefined, revision: undefined });
                } catch (cause) {
                  setError((cause as Error).message);
                }
              }}
            />
          </Field>
        )}
      </Card>
      {error && (
        <p role="alert" className="text-danger">
          <UserText>{error}</UserText>
        </p>
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader
            title={<UserText>{item.name || item.category || item.id}</UserText>}
            actions={
              <div className="flex items-center gap-1">
                {kind !== "version" && (
                  <IconButton
                    label={t("edit")}
                    icon={<Pencil size={16} />}
                    onClick={() => setEditing(item)}
                  />
                )}
                {kind === "persona" && (
                  <IconButton
                    label={t("trainingDuplicate")}
                    icon={<Copy size={16} />}
                    onClick={() =>
                      setEditing({
                        ...item,
                        id: undefined,
                        revision: undefined,
                      } as unknown as TrainingResource)
                    }
                  />
                )}
                <IconButton
                  label={t("export")}
                  icon={<Download size={16} />}
                  onClick={() => download(`${kind}.json`, item)}
                />
                <IconButton
                  label={t("delete")}
                  icon={<Trash2 size={16} />}
                  onClick={() => setRemoving(item)}
                />
              </div>
            }
          />
          <UserText>
            {item.instructions || item.purpose || item.response || item.correction || item.id}
          </UserText>
          {["rule", "example", "feedback"].includes(kind) && (
            <div className="mt-3">
              <Button
                disabled={item.approved}
                onClick={() =>
                  void act(() =>
                    trainingApi.post(`/resources/${kind}/${item.id}/approve`, {
                      revision: item.revision,
                    }),
                  )
                }
              >
                {item.approved ? t("trainingApproved") : t("trainingApprove")}
              </Button>
            </div>
          )}
          {item.category === "handoff" && item.active && (
            <Button
              onClick={() =>
                void act(() =>
                  trainingApi.post(`/handoff/${item.id}/resume`, { revision: item.revision }),
                )
              }
            >
              {t("trainingResume")}
            </Button>
          )}
        </Card>
      ))}
      {editing !== undefined && (
        <ResourceEditor
          kind={kind}
          resource={editing}
          templates={overview.templates}
          onClose={() => setEditing(undefined)}
          refresh={refresh}
        />
      )}
      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={t("delete")}
        description={t("trainingDeleteDescription")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        onConfirm={async () => {
          if (removing) await act(() => trainingApi.remove(`/resources/${kind}/${removing.id}`));
          setRemoving(null);
        }}
      />
    </div>
  );
}

function KnowledgeMemory({
  kind,
  overview,
}: {
  kind: "knowledge" | "memory";
  overview: TrainingOverview;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<TrainingResource[]>([]);
  const [draft, setDraft] = useState({
    name: "",
    content: "",
    filename: "knowledge.txt",
    scope: "workspace",
    chatId: "",
    source: { kind: "general", url: "", reference: "", edition: "" },
  });
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setItems(await trainingApi.get(kind === "knowledge" ? "/resources/document" : "/memory"));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [kind]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <div className="space-y-4">
      <Card>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              await trainingApi.post(`/${kind}`, {
                ...draft,
                confirmed,
                retentionDays: Math.min(7, overview.limits.retentionDays),
              });
              await refresh();
              setDraft({ ...draft, content: "" });
            } catch (cause) {
              setError((cause as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <CardHeader
            title={t(kind === "knowledge" ? "trainingKnowledge" : "trainingMemory")}
            description={t(
              kind === "knowledge" ? "trainingKnowledgeDescription" : "trainingMemoryDescription",
            )}
          />
          {kind === "knowledge" && (
            <>
              <Field label={t("trainingUpload")} htmlFor="knowledge-upload" description={t("trainingSupportedFormats")}>
                <Input
                  id="knowledge-upload"
                  type="file"
                  accept=".txt,.md,.json,.csv"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1000000) {
                      setError(t("trainingFileTooLarge"));
                      return;
                    }
                    setDraft({
                      ...draft,
                      filename: file.name,
                      name: file.name,
                      content: await file.text(),
                    });
                  }}
                />
              </Field>
              <Field label={t("name")} htmlFor="knowledge-name">
                <Input
                  id="knowledge-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
            </>
          )}
          <Field label={t("trainingContent")} htmlFor="knowledge-content">
            <Textarea
              id="knowledge-content"
              value={draft.content}
              rows={6}
              required
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            />
          </Field>
          <Field label={t("trainingScope")} htmlFor="knowledge-scope">
            <Select
              id="knowledge-scope"
              value={draft.scope}
              onChange={(event) => setDraft({ ...draft, scope: event.target.value })}
            >
              <option value="workspace">{t("trainingWorkspace")}</option>
              <option value="group">{t("trainingGroup")}</option>
            </Select>
          </Field>
          {draft.scope === "group" && (
            <Field label={t("trainingSelectChat")} htmlFor="knowledge-chat">
              <Select
                id="knowledge-chat"
                value={draft.chatId}
                required
                onChange={(event) => setDraft({ ...draft, chatId: event.target.value })}
              >
                <option value="">{t("trainingChooseChat")}</option>
                {overview.authorizedChats.filter((chat) => chat.kind === "group").map((chat) => (
                  <option key={chat.chatId} value={chat.chatId} dir="auto">{chat.name || chat.chatId}</option>
                ))}
              </Select>
            </Field>
          )}
          {kind === "knowledge" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("trainingSourceKind")} htmlFor="knowledge-kind">
                <Select
                  id="knowledge-kind"
                  value={draft.source.kind}
                  onChange={(event) =>
                    setDraft({ ...draft, source: { ...draft.source, kind: event.target.value } })
                  }
                >
                  {[
                    "general",
                    "faq",
                    "business",
                    "education",
                    "quran",
                    "hadith",
                    "scholarly",
                    "medical",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {t(`trainingSource_${value}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              {["url", "reference", "edition"].map((field) => (
                <Field key={field} label={t(`trainingSource_${field}`)} htmlFor={`knowledge-${field}`}>
                  <Input
                    id={`knowledge-${field}`}
                    value={draft.source[field as "url"]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        source: { ...draft.source, [field]: event.target.value },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          )}
          {kind === "memory" && (
            <Checkbox
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              label={t("trainingMemoryConfirm")}
            />
          )}
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={kind === "memory" && !confirmed}
          >
            {t("save")}
          </Button>
        </form>
      </Card>
      {error && (
        <p className="text-danger" role="alert">
          <UserText>{error}</UserText>
        </p>
      )}
      <div className="flex justify-end">
        <IconButton
          label={t("export")}
          icon={<Download size={16} />}
          onClick={() => download(`${kind}.json`, items)}
        />
      </div>
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader
            title={<UserText>{item.name || item.content || item.id}</UserText>}
            actions={
              <IconButton
                label={t("delete")}
                icon={<Trash2 size={16} />}
                onClick={async () => {
                  try {
                    await trainingApi.remove(
                      kind === "knowledge"
                        ? `/resources/document/${item.id}`
                        : `/memory/${item.id}`,
                    );
                    await refresh();
                  } catch (cause) {
                    setError((cause as Error).message);
                  }
                }}
              />
            }
          />
          {kind === "knowledge" && (
            <Button
              disabled={item.approved}
              onClick={async () => {
                try {
                  await trainingApi.post(`/resources/document/${item.id}/approve`, {
                    revision: item.revision,
                  });
                  await refresh();
                } catch (cause) {
                  setError((cause as Error).message);
                }
              }}
            >
              {item.approved ? t("trainingApproved") : t("trainingApprove")}
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}

function Playground({ overview }: { overview: TrainingOverview }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState({
    text: "",
    mode: "mention-only",
    personaId: "general",
    mentioned: true,
    replyToBot: false,
    isGroup: true,
    generate: false,
  });
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-4">
      <Card>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              setResult(await trainingApi.post("/playground", draft));
            } catch (cause) {
              setError((cause as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <CardHeader title={t("trainingPlayground")} description={t("trainingPlaygroundSafe")} />
          <Field label={t("trainingMessage")} htmlFor="playground-message">
            <Textarea
              id="playground-message"
              required
              value={draft.text}
              rows={4}
              onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("trainingResponseMode")} htmlFor="playground-mode">
              <Select
                id="playground-mode"
                value={draft.mode}
                onChange={(event) => setDraft({ ...draft, mode: event.target.value })}
              >
                {MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {t(`trainingMode_${mode}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("trainingTemplate")} htmlFor="playground-template">
              <Select
                id="playground-template"
                value={draft.personaId}
                onChange={(event) => setDraft({ ...draft, personaId: event.target.value })}
              >
                {overview.templates.map((persona) => (
                  <option dir="auto" key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Checkbox
            label={t("trainingMockGroup")}
            checked={draft.isGroup}
            onChange={(event) => setDraft({ ...draft, isGroup: event.target.checked })}
          />
          <Checkbox
            label={t("trainingMentioned")}
            checked={draft.mentioned}
            onChange={(event) => setDraft({ ...draft, mentioned: event.target.checked })}
          />
          <Checkbox
            label={t("trainingReplyToBot")}
            checked={draft.replyToBot}
            onChange={(event) => setDraft({ ...draft, replyToBot: event.target.checked })}
          />
          <Checkbox
            label={t("trainingGenerate")}
            checked={draft.generate}
            onChange={(event) => setDraft({ ...draft, generate: event.target.checked })}
          />
          <Button type="submit" variant="primary" loading={busy}>
            {t("trainingTestDecision")}
          </Button>
        </form>
      </Card>
      {error && (
        <p role="alert" className="text-danger">
          <UserText>{error}</UserText>
        </p>
      )}
      {result && (
        <Card>
          <CardHeader title={t("trainingDecision")} />
          <Badge tone={result.decision.action === "NO_ACTION" ? "neutral" : "info"}>
            <UserText>{result.decision.action}</UserText>
          </Badge>
          <p className="text-sm text-muted my-3">
            <UserText>{result.decision.reason}</UserText>
          </p>
          {result.decision.reaction && <UserText>{result.decision.reaction}</UserText>}
          {result.response && (
            <>
              <UserText>{result.response.text}</UserText>
              <p className="text-sm text-muted mt-4">
                {t("trainingLatency")}: {result.response.latencyMs} ms · {t("trainingTokens")}:{" "}
                {result.response.usage?.totalTokens ?? t("trainingUnknown")} · {t("trainingCost")}:{" "}
                {result.response.estimatedCost ?? t("trainingUnknown")}
              </p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function QualityReports() {
  const { t } = useI18n();
  const [reports, setReports] = useState<TrainingResource[]>([]);
  const [error, setError] = useState("");
  const refresh = async () => {
    try {
      setReports(await trainingApi.get("/resources/evaluation"));
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t("trainingQuality")}
          description={t("trainingQualityDescription")}
          actions={
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await trainingApi.post("/evaluations");
                  await refresh();
                } catch (cause) {
                  setError((cause as Error).message);
                }
              }}
            >
              {t("trainingRunEvaluation")}
            </Button>
          }
        />
      </Card>
      {error && (
        <p role="alert" className="text-danger">
          <UserText>{error}</UserText>
        </p>
      )}
      {reports.map((report) => (
        <Card key={report.id}>
          <CardHeader
            title={<UserText>{report.evaluatedAt}</UserText>}
            actions={
              <IconButton
                label={t("export")}
                icon={<Download size={16} />}
                onClick={() => download("quality-report.json", report)}
              />
            }
          />
          <p>
            {t("trainingPassed")}: {report.passed}/{report.total}
          </p>
          <p>
            {t("trainingUnnecessaryReplyRate")}: {Math.round(report.unnecessaryReplyRate * 100)}%
          </p>
          <p className="text-sm text-muted mt-3">{t("trainingHumanReviewRequired")}</p>
        </Card>
      ))}
    </div>
  );
}

function AdvancedSettings({
  overview,
  refresh,
}: {
  overview: TrainingOverview;
  refresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const form = useDirtyForm({ json: JSON.stringify(overview.deployment, null, 2) });
  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.save(async (draft) => {
            await trainingApi.put("/deployment", JSON.parse(draft.json));
            await refresh();
          });
        }}
      >
        <CardHeader title={t("trainingAdvanced")} description={t("trainingAdvancedDescription")} />
        <Field label={t("trainingConfigurationJson")} htmlFor="deployment-json">
          <Textarea
            id="deployment-json"
            rows={18}
            dir="ltr"
            value={form.draft.json}
            onChange={(event) => form.setField("json", event.target.value)}
          />
        </Field>
        <FormActions
          dirty={form.dirty}
          saving={form.status === "saving"}
          justSaved={form.status === "saved"}
          error={form.error}
          onDiscard={form.revert}
          saveLabel={t("save")}
          discardLabel={t("discard")}
          unsavedLabel={t("trainingUnsaved")}
        />
      </form>
    </Card>
  );
}

export function TrainingStudioView() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<TrainingOverview | null>(null);
  const [tab, setTab] = useState("automatic");
  const [custom, setCustom] = useState("persona");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const data = await trainingApi.get<TrainingOverview>("/overview");
    setOverview(data);
    setError("");
  }, []);
  useEffect(() => {
    refresh().catch((cause) => setError(cause.message));
  }, [refresh]);
  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Brain size={22} />}
        title={t("trainingStudio")}
        description={t("trainingTagline")}
        actions={
          <IconButton
            label={t("refresh")}
            icon={<RefreshCw size={16} />}
            onClick={() => refresh().catch((cause) => setError(cause.message))}
          />
        }
      />
      {error && (
        <Card>
          <p role="alert" className="text-danger">
            <UserText>{error}</UserText>
          </p>
        </Card>
      )}
      {!overview && !error && <LoadingState text={t("loading")} />}
      {overview && (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            aria-label={t("trainingStudio")}
            options={["automatic", "custom", "playground", "quality", "privacy"].map((value) => ({
              value,
              label: t(`trainingTab_${value}`),
            }))}
          />
          {tab === "automatic" && <AutomaticLearning overview={overview} refresh={refresh} />}
          {tab === "custom" && (
            <>
              <p className="text-sm text-muted">{t("trainingCustomDescription")}</p>
              <Tabs
                value={custom}
                onChange={setCustom}
                aria-label={t("trainingTab_custom")}
                options={[...RESOURCE_TYPES, "knowledge", "memory", "advanced"].map((value) => ({
                  value,
                  label: t(
                    value === "knowledge"
                      ? "trainingKnowledge"
                      : value === "memory"
                        ? "trainingMemory"
                        : value === "advanced"
                          ? "trainingAdvanced"
                          : `trainingResource_${value}`,
                  ),
                }))}
              />
              {RESOURCE_TYPES.includes(custom) && (
                <Resources key={custom} kind={custom} overview={overview} />
              )}
              {(custom === "knowledge" || custom === "memory") && (
                <KnowledgeMemory key={custom} kind={custom} overview={overview} />
              )}
              {custom === "advanced" && <AdvancedSettings overview={overview} refresh={refresh} />}
            </>
          )}
          {tab === "playground" && <Playground overview={overview} />}
          {tab === "quality" && <QualityReports />}
          {tab === "privacy" && (
            <Card>
              <CardHeader
                title={t("trainingTab_privacy")}
                description={t("trainingPrivacyDescription")}
              />
              <UserText>{overview.notice}</UserText>
              <p className="text-sm text-muted mt-4">{t("trainingPrivacyCommands")}</p>
              <p className="text-sm text-muted mt-4">{t("trainingNoFineTuning")}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
