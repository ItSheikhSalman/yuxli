// file: frontend/src/views/ConnectionView.tsx

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Key,
  Layers,
  Phone,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  Shield,
  Smartphone,
  Square,
  Trash2,
  Unlink,
  Wifi,
  WifiOff,
} from "lucide-react";
import * as QRCode from "qrcode";
import type React from "react";
import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../components/Toasts";
import {
  Button,
  Card,
  Dialog,
  IconButton,
  Input,
  MenuItem,
  OverflowMenu,
  SegmentedControl,
  Spinner,
  StatusPill,
} from "../components/ui";
import { useI18n } from "../context/I18nContext";
import type { ConnectionQuota, SessionStatus, WhatsappConnectionItem } from "../types";

function isAndroidCompanionApp() {
  return typeof window !== "undefined" && Boolean((window as { LevixHost?: unknown }).LevixHost);
}

interface SecondaryAction {
  key: string;
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

interface ConnectionViewProps {
  status: SessionStatus | null;
  onRefresh?: () => Promise<void>;
  onStatusUpdate?: (status: Partial<SessionStatus>) => void;
}

export const ConnectionView: FC<ConnectionViewProps> = ({ status, onRefresh, onStatusUpdate }) => {
  const { t, language } = useI18n();
  const { toast } = useToast();

  // Multi-connection management state
  const [connections, setConnections] = useState<WhatsappConnectionItem[]>([]);
  const [quota, setQuota] = useState<ConnectionQuota | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<string>("conn_default");
  const [selectedStatus, setSelectedStatus] = useState<SessionStatus | null>(status);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newConnName, setNewConnName] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Active session controls
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [acting, setActing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingMethod, setPairingMethod] = useState<"pairing" | "qr">("pairing");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Fetch all connections belonging to current workspace
  const fetchConnections = useCallback(async () => {
    try {
      const res = await api.getConnections();
      if (res && res.connections) {
        setConnections(res.connections);
        if (res.quota) setQuota(res.quota);
        // Ensure selected connection exists or default to first
        const exists = res.connections.find((c) => c.id === selectedConnId);
        if (!exists && res.connections.length > 0) {
          setSelectedConnId(res.connections[0].id);
        }
      }
    } catch {
      // Fallback silently if offline or endpoint unavailable
    }
  }, [selectedConnId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Keep selected status updated from active connection or props
  useEffect(() => {
    if (selectedConnId === "conn_default" && status) {
      setSelectedStatus(status);
    } else {
      const active = connections.find((c) => c.id === selectedConnId);
      if (active) {
        setSelectedStatus({
          state: active.status as any,
          connected: active.connected,
          linked: Boolean(active.phoneNumber || active.connected),
          qr: active.qr,
          pairingCode: active.pairingCode,
          user: active.user || (active.phoneNumber ? { id: active.phoneNumber } : null),
          canUnlink: Boolean(active.connected || active.phoneNumber),
          canStart: !active.connected,
          canStop: active.connected,
        });
      }
    }
  }, [selectedConnId, connections, status]);

  const activeConn = connections.find((c) => c.id === selectedConnId);
  const currentStatus = selectedStatus || status;
  const state = currentStatus?.state || "idle";
  const isConnected = state === "connected";
  const isWaitingQr = state === "waiting_for_qr";
  const isStarting = state === "starting" || state === "linking";
  const isReconnecting = state === "reconnecting";
  const isPaused = state === "paused";
  const isLoggedOut = state === "logged_out";
  const linked = Boolean(currentStatus?.linked) && !isLoggedOut;
  const needsPairing = !linked;
  const canUnlink = Boolean(currentStatus?.canUnlink);
  const isOnline = currentStatus?.isOnline !== false;
  const resumeLabel =
    isPaused || state === "disconnected" || state === "retry_exhausted"
      ? language === "ar"
        ? "استئناف الجلسة"
        : "Resume Session"
      : language === "ar"
        ? "الاتصال"
        : "Connect Now";

  // Generate QR code locally
  useEffect(() => {
    if (currentStatus?.qr) {
      const toDataURL =
        QRCode.toDataURL ||
        (QRCode as { default?: { toDataURL?: typeof QRCode.toDataURL } }).default?.toDataURL;
      if (typeof toDataURL === "function") {
        const styles = getComputedStyle(document.documentElement);
        const lightTheme = document.documentElement.getAttribute("data-theme") === "light";
        const dark = (
          lightTheme ? styles.getPropertyValue("--text") : "#090B10"
        ).trim() || "#000000";
        const light = (
          lightTheme ? "#FFFFFF" : "#F8FAFC"
        ).trim() || "#ffffff";
        toDataURL(currentStatus.qr, {
          width: 250,
          margin: 2,
          color: {
            dark,
            light,
          },
        })
          .then((url: string) => setQrDataUrl(url))
          .catch(() => setQrDataUrl(null));
      }
    } else {
      setQrDataUrl(null);
    }
  }, [currentStatus?.qr]);

  // Polling for QR / Pairing code while waiting
  useEffect(() => {
    if (isWaitingQr && !currentStatus?.qr && !currentStatus?.pairingCode) {
      const timer = setInterval(() => {
        fetchConnections();
        onRefresh?.();
      }, 1500);
      return () => clearInterval(timer);
    }
  }, [isWaitingQr, currentStatus?.qr, currentStatus?.pairingCode, onRefresh, fetchConnections]);

  const handleAction = async (actionFn: () => Promise<unknown>, successMsg: string) => {
    setActing(true);
    try {
      const res = await actionFn();
      if (res && typeof res === "object" && "session" in res) {
        const sess = (res as { session: Partial<SessionStatus> }).session;
        setSelectedStatus((prev) => ({ ...(prev || {}), ...sess } as SessionStatus));
        if (selectedConnId === "conn_default") {
          onStatusUpdate?.(sess);
        }
      }
      toast(successMsg, "success");
      await fetchConnections();
      await onRefresh?.();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setActing(false);
    }
  };

  const handleStartPairing = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (!cleanPhone) {
      toast(
        language === "ar"
          ? "يرجى إدخال رقم الهاتف مع كود الدولة أولاً."
          : "Please enter your phone number with country code.",
        "error",
      );
      return;
    }
    if (cleanPhone.startsWith("0")) {
      toast(
        language === "ar"
          ? "يرجى حذف الصفر في البداية وكتابة كود الدولة (مثلاً: 2010... وليس 010...)"
          : "Drop the leading 0 and include the country code (e.g. 92300... not 0300...).",
        "error",
      );
      return;
    }
    await handleAction(
      () =>
        selectedConnId === "conn_default"
          ? api.startSession({ method: "pairing", phone: cleanPhone })
          : api.startConnection(selectedConnId, { method: "pairing", phone: cleanPhone }),
      language === "ar" ? "جارٍ طلب رمز الربط من واتساب..." : "Requesting 8-digit pairing code...",
    );
  };

  const handleStartQr = async () => {
    await handleAction(
      () =>
        selectedConnId === "conn_default"
          ? api.startSession({ method: "qr" })
          : api.startConnection(selectedConnId, { method: "qr" }),
      language === "ar" ? "جارٍ بدء الاتصال برمز QR..." : "Generating QR code...",
    );
  };

  const handleResume = async () => {
    await handleAction(
      () =>
        selectedConnId === "conn_default"
          ? api.startSession()
          : api.startConnection(selectedConnId),
      resumeLabel,
    );
  };

  const handleStop = async () => {
    await handleAction(
      () =>
        selectedConnId === "conn_default"
          ? api.stopSession()
          : api.stopConnection(selectedConnId),
      t("stop"),
    );
  };

  const handleReconnect = async () => {
    await handleAction(
      () =>
        selectedConnId === "conn_default"
          ? api.reconnectSession()
          : api.reconnectConnection(selectedConnId),
      t("reconnecting"),
    );
  };

  const handleSwitchToPhone = async () => {
    await handleAction(
      () =>
        selectedConnId === "conn_default"
          ? api.stopSession()
          : api.stopConnection(selectedConnId),
      language === "ar" ? "تم الإلغاء، أدخل رقم هاتفك" : "Cancelled, enter your phone number",
    );
    setPairingMethod("pairing");
  };

  const copyPairingCode = () => {
    if (currentStatus?.pairingCode) {
      navigator.clipboard.writeText(currentStatus.pairingCode.replace(/\s+/g, ""));
      setCopiedCode(true);
      toast(language === "ar" ? "تم نسخ كود الربط!" : "Pairing code copied to clipboard", "success");
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const confirmUnlink = async () => {
    setShowUnlinkModal(false);
    await handleAction(
      () =>
        selectedConnId === "conn_default"
          ? api.unlinkSession()
          : api.unlinkConnection(selectedConnId),
      language === "ar" ? "تم إلغاء ربط الجلسة بنجاح" : "Session unlinked successfully.",
    );
  };

  const handleCreateConnection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newConnName.trim()) {
      toast("Please enter a connection name", "error");
      return;
    }
    setActing(true);
    try {
      const res = await api.createConnection(newConnName.trim());
      toast(
        language === "ar" ? "تمت إضافة رقم واتساب بنجاح" : "WhatsApp number slot created successfully",
        "success",
      );
      setShowAddModal(false);
      setNewConnName("");
      await fetchConnections();
      if (res?.connectionId) {
        setSelectedConnId(res.connectionId);
      }
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setActing(false);
    }
  };

  const confirmDeleteConnection = async () => {
    setShowDeleteModal(false);
    setActing(true);
    try {
      await api.deleteConnection(selectedConnId);
      toast(
        language === "ar" ? "تم حذف الاتصال بنجاح" : "WhatsApp connection deleted successfully",
        "success",
      );
      await fetchConnections();
      setSelectedConnId("conn_default");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setActing(false);
    }
  };

  const rawPhone = currentStatus?.user?.id
    ? currentStatus.user.id.split("@")[0].split(":")[0]
    : activeConn?.phoneNumber
      ? activeConn.phoneNumber.split("@")[0].split(":")[0]
      : null;
  const hideRestart = isAndroidCompanionApp();

  const unlinkAction: SecondaryAction = {
    key: "unlink",
    label: t("unlink"),
    icon: <Unlink size={14} />,
    danger: true,
    onSelect: () => setShowUnlinkModal(true),
  };
  const restartAction: SecondaryAction = {
    key: "restart",
    label: t("restart"),
    icon: <RotateCcw size={14} />,
    onSelect: () => handleAction(api.restartBot, t("restart")),
  };
  const reconnectAction: SecondaryAction = {
    key: "reconnect",
    label: t("reconnect"),
    icon: <RefreshCw size={14} />,
    onSelect: handleReconnect,
  };
  const deleteAction: SecondaryAction = {
    key: "delete",
    label: language === "ar" ? "حذف الرقم" : "Delete Number",
    icon: <Trash2 size={14} />,
    danger: true,
    onSelect: () => setShowDeleteModal(true),
  };

  const withRestart = (actions: SecondaryAction[]) =>
    hideRestart ? actions : [...actions, restartAction];

  const buildSecondaryActions = () => {
    const list: SecondaryAction[] = [];
    if (canUnlink) list.push(unlinkAction);
    if (!hideRestart && selectedConnId === "conn_default") list.push(restartAction);
    if (selectedConnId !== "conn_default") list.push(deleteAction);
    return list;
  };

  const renderSecondary = (actions: SecondaryAction[]): ReactNode => {
    if (actions.length === 0) return null;
    if (actions.length === 1) {
      const only = actions[0];
      return (
        <Button
          variant="secondary"
          size="sm"
          icon={only.icon}
          onClick={only.onSelect}
          disabled={acting}
        >
          {only.label}
        </Button>
      );
    }
    return (
      <OverflowMenu label={t("moreActions")}>
        {actions.map((action) => (
          <MenuItem
            key={action.key}
            danger={action.danger}
            icon={action.icon}
            disabled={acting}
            onSelect={action.onSelect}
          >
            {action.label}
          </MenuItem>
        ))}
      </OverflowMenu>
    );
  };

  const canAddMore = !quota || quota.allowed === -1 || quota.used < quota.allowed;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-main flex items-center gap-2">
            <span>Connection Center</span>
            {quota && (
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-panel-raised border border-line text-muted">
                {quota.used} / {quota.allowed === -1 ? "∞" : quota.allowed} Slots (
                {quota.plan.toUpperCase()})
              </span>
            )}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Manage multi-number WhatsApp Baileys sockets, isolated credentials, pairing, and session lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            icon={<Plus size={13} />}
            onClick={() => setShowAddModal(true)}
            disabled={!canAddMore || acting}
          >
            {language === "ar" ? "إضافة رقم واتساب" : "Add WhatsApp Number"}
          </Button>

          {onRefresh && (
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw size={13} className={acting ? "animate-spin" : ""} />}
              onClick={() => {
                fetchConnections();
                onRefresh();
              }}
              loading={acting}
            >
              Sync Status
            </Button>
          )}
        </div>
      </div>

      {/* ── Multi-Connection Tabs / Switcher ── */}
      {connections.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} />
              <span>Workspace Numbers ({connections.length})</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {connections.map((conn) => {
              const isSelected = conn.id === selectedConnId;
              const phoneDisplay = conn.phoneNumber
                ? `+${conn.phoneNumber.split("@")[0].split(":")[0]}`
                : "Unpaired";
              return (
                <button
                  type="button"
                  key={conn.id}
                  onClick={() => setSelectedConnId(conn.id)}
                  className={`text-start p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                      : "border-line bg-panel hover:bg-panel-raised hover:border-line-hover"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-text-main truncate flex items-center gap-1.5">
                        <span className="truncate">{conn.name}</span>
                        {conn.isDefault && (
                          <span className="shrink-0 text-[9px] px-1 py-0.2 rounded bg-indigo-500/15 text-indigo-400 font-mono">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-muted mt-0.5 truncate">
                        {phoneDisplay}
                      </div>
                    </div>

                    <StatusPill
                      tone={
                        conn.connected
                          ? "ok"
                          : conn.status === "waiting_for_qr" || conn.status === "starting"
                            ? "warn"
                            : "neutral"
                      }
                      dot
                      className="text-[10px] shrink-0"
                    >
                      {conn.connected ? "ACTIVE" : String(conn.status).toUpperCase()}
                    </StatusPill>
                  </div>

                  <div className="text-[10px] text-muted flex items-center justify-between border-t border-line/50 pt-2 w-full">
                    <span className="font-mono text-[9px] opacity-70 truncate">{conn.id}</span>
                    {isSelected && (
                      <span className="text-primary font-medium text-[10px]">Selected</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Status Card for Selected Connection ── */}
      <Card className="p-4 sm:p-5 border border-line bg-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${
                isConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : isWaitingQr
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : isStarting || isReconnecting
                      ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                      : "border-line bg-panel-raised text-muted"
              }`}
            >
              <Radio size={18} className={isConnected ? "animate-pulse" : ""} />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-text-main">
                  {activeConn?.name || "WhatsApp Engine Link"}
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-line bg-panel-raised text-muted">
                  {selectedConnId}
                </span>
                {activeConn?.isDefault && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium">
                    Default Bot Number
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {isConnected
                  ? "WhatsApp session active & synchronizing in real time."
                  : isPaused
                    ? t("paused")
                    : linked
                      ? "Saved credentials ready — resume to connect."
                      : "Pair this WhatsApp account to enable automated messaging."}
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto flex items-center gap-2">
            <StatusPill
              tone={isConnected ? "ok" : isWaitingQr || isStarting ? "warn" : "neutral"}
              dot
              pulse={isConnected || isStarting}
            >
              {t(state as any, state).toUpperCase()}
            </StatusPill>
          </div>
        </div>

        {/* Retry Alert */}
        {currentStatus?.retryInSeconds ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-2.5 text-amber-400 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>
              Reconnecting soon &bull; Next attempt in {currentStatus.retryInSeconds}s
            </span>
          </div>
        ) : null}

        {/* Connected Phone Number Banner */}
        {isConnected && rawPhone && (
          <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 sm:p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-medium text-muted uppercase tracking-wider">
                  {t("connectedNumber")}
                </div>
                <div className="text-sm font-mono font-bold text-text-main" dir="ltr">
                  +{rawPhone}
                </div>
              </div>
            </div>
            <StatusPill tone="ok" dot className="shrink-0 text-xs">
              Live Isolated Sync
            </StatusPill>
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-4 pt-3 border-t border-line">
          {isConnected && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="danger"
                size="sm"
                icon={<Square size={13} />}
                onClick={handleStop}
                disabled={acting}
              >
                {t("stop")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={13} />}
                onClick={handleReconnect}
                disabled={acting}
              >
                {t("reconnect")}
              </Button>
              {renderSecondary(buildSecondaryActions())}
            </div>
          )}

          {(isStarting || isWaitingQr || isReconnecting) && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="danger"
                size="sm"
                icon={<Square size={13} />}
                onClick={handleStop}
                disabled={acting}
              >
                Cancel Attempt
              </Button>
              {renderSecondary(buildSecondaryActions())}
            </div>
          )}

          {!isConnected && !isStarting && !isWaitingQr && !isReconnecting && linked && (
            <div className="flex flex-col gap-3 max-w-xl">
              {isPaused && (
                <p className="text-xs text-muted leading-relaxed">
                  {isOnline
                    ? "This WhatsApp session is saved. Resume to reconnect with the same account."
                    : "Paused while the device is offline. It will resume when the network returns."}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Radio size={13} />}
                  onClick={handleResume}
                  disabled={acting}
                >
                  {resumeLabel}
                </Button>
                {renderSecondary(buildSecondaryActions())}
              </div>
            </div>
          )}

          {/* Pairing Choices: Pairing Code vs QR */}
          {!isConnected && !isStarting && !isWaitingQr && !isReconnecting && needsPairing && (
            <div className="flex flex-col gap-4">
              <SegmentedControl
                aria-label={t("connection")}
                value={pairingMethod}
                onChange={setPairingMethod}
                className="w-full sm:w-fit"
                options={[
                  {
                    value: "pairing",
                    label: "8-Digit Pairing Code",
                    icon: <Smartphone size={14} />,
                  },
                  {
                    value: "qr",
                    label: "QR Code Scanner",
                    icon: <QrCode size={14} />,
                  },
                ]}
              />

              {pairingMethod === "pairing" && (
                <form onSubmit={handleStartPairing} className="flex flex-col gap-3 max-w-md">
                  <div className="relative">
                    <Phone
                      size={14}
                      className="absolute top-1/2 -translate-y-1/2 start-3 text-muted pointer-events-none"
                    />
                    <Input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 923001234567 (with country code)"
                      dir="ltr"
                      className="ps-9 font-mono text-xs sm:text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      icon={<Key size={13} />}
                      disabled={acting}
                    >
                      Request Pairing Code
                    </Button>
                    {renderSecondary(buildSecondaryActions())}
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Enter your phone number with country code. You will receive an 8-character pairing code to type directly into WhatsApp.
                  </p>
                </form>
              )}

              {pairingMethod === "qr" && (
                <div className="flex flex-col gap-3 max-w-md">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<QrCode size={14} />}
                      onClick={handleStartQr}
                      disabled={acting}
                    >
                      Generate QR Code
                    </Button>
                    {renderSecondary(buildSecondaryActions())}
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Generates a high-contrast QR code to scan with your phone camera under WhatsApp Linked Devices.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Starting Progress ── */}
      {isStarting && (
        <Card className="flex flex-col items-center text-center p-6 border border-line bg-panel">
          <Spinner className="size-6 mb-3 text-indigo-400" />
          <h3 className="text-sm font-semibold text-text-main mb-1">
            {state === "linking" ? "Finishing handshake..." : "Initializing WhatsApp session..."}
          </h3>
          <p className="text-xs text-muted max-w-sm">
            Establishing multi-device cryptographic socket for {activeConn?.name || selectedConnId}.
          </p>
        </Card>
      )}

      {/* ── Pairing Code Display Deck ── */}
      {isWaitingQr && (
        <Card className="mx-auto flex w-full max-w-xl flex-col items-center text-center p-5 sm:p-7 border border-line bg-panel">
          {currentStatus?.pairingCode ? (
            <div className="flex flex-col items-center w-full">
              <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/20">
                <Smartphone size={18} />
              </div>
              <h3 className="text-base font-bold text-text-main mb-1">
                WhatsApp Pairing Code
              </h3>
              <p className="text-xs text-muted max-w-sm mb-5">
                Enter this 8-digit code into WhatsApp on your mobile device.
              </p>

              {/* 8-Digit Code Display */}
              <div className="rounded-xl border border-line bg-panel-raised p-5 w-full max-w-sm flex flex-col items-center gap-4">
                <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-muted">
                  Active Pairing Code ({activeConn?.name || selectedConnId})
                </span>
                <div
                  className="text-2xl sm:text-3xl font-mono font-bold tracking-widest text-text-main select-all"
                  dir="ltr"
                >
                  {currentStatus.pairingCode.length === 8
                    ? `${currentStatus.pairingCode.slice(0, 4)} - ${currentStatus.pairingCode.slice(4)}`
                    : currentStatus.pairingCode}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={copiedCode ? <Check size={14} /> : <Copy size={14} />}
                  onClick={copyPairingCode}
                >
                  {copiedCode ? "Code Copied" : "Copy Code"}
                </Button>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="mt-5 p-3.5 rounded-lg border border-line bg-panel-raised text-start w-full max-w-sm text-xs">
                <div className="font-semibold text-text-main mb-2">
                  Instructions:
                </div>
                <ol className="text-muted space-y-1.5 list-decimal list-inside leading-relaxed text-[11px]">
                  <li>Open <strong>WhatsApp</strong> on your phone.</li>
                  <li>Go to <strong>Settings → Linked Devices → Link a Device</strong>.</li>
                  <li>Select <strong>«Link with phone number instead»</strong>.</li>
                  <li>Type the 8-digit code shown above.</li>
                </ol>
              </div>
            </div>
          ) : qrDataUrl ? (
            /* Clean QR Frame */
            <div className="flex flex-col items-center w-full">
              <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/20">
                <QrCode size={18} />
              </div>
              <h3 className="text-base font-bold text-text-main mb-1">
                Scan WhatsApp QR Code
              </h3>
              <p className="text-xs text-muted max-w-sm mb-5">
                Open WhatsApp → Linked Devices → Scan this QR code.
              </p>

              <div className="p-3 bg-white rounded-xl border border-line shadow-xs">
                <img
                  src={qrDataUrl}
                  alt="WhatsApp QR Code"
                  className="w-52 h-52 block rounded"
                />
              </div>

              <div className="mt-5 pt-4 border-t border-line w-full max-w-sm flex flex-col items-center gap-2">
                <p className="text-[11px] text-muted text-center">
                  Cannot scan screen? Use phone pairing instead.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Smartphone size={13} />}
                  onClick={handleSwitchToPhone}
                  disabled={acting}
                  className="w-full"
                >
                  Switch to Phone Pairing Code
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8">
              <Spinner className="size-6 text-indigo-400" />
              <span className="text-xs text-muted">
                Generating secure handshake...
              </span>
            </div>
          )}
        </Card>
      )}

      {/* ── Add WhatsApp Number Modal ── */}
      <Dialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={language === "ar" ? "إضافة رقم واتساب جديد" : "Add WhatsApp Number Slot"}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleCreateConnection()}
              disabled={acting || !newConnName.trim()}
            >
              Create Slot
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateConnection} className="space-y-4">
          <p className="text-xs text-muted leading-relaxed">
            Provision a new isolated WhatsApp connection socket. Each connection operates with its own session credentials, message event stream, and rate limits.
          </p>

          <div>
            <label className="text-xs font-semibold text-text-main block mb-1.5">
              Connection Label / Department
            </label>
            <Input
              value={newConnName}
              onChange={(e) => setNewConnName(e.target.value)}
              placeholder="e.g. Sales Team, Support Bot #2, VIP Hotline"
              autoFocus
            />
          </div>

          {quota && (
            <div className="p-3 rounded-lg bg-panel-raised border border-line text-xs text-muted flex items-center justify-between">
              <span>Plan Allowance:</span>
              <span className="font-semibold text-text-main">
                {quota.used} / {quota.allowed === -1 ? "Unlimited" : quota.allowed} Slots (
                {quota.plan.toUpperCase()})
              </span>
            </div>
          )}
        </form>
      </Dialog>

      {/* ── Unlink Confirmation Dialog ── */}
      <Dialog
        isOpen={showUnlinkModal}
        onClose={() => setShowUnlinkModal(false)}
        title={t("unlink")}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowUnlinkModal(false)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={confirmUnlink}>
              {t("unlink")}
            </Button>
          </>
        }
      >
        <p className="text-xs sm:text-sm text-text-main leading-relaxed">
          Are you sure you want to unlink this WhatsApp session ({activeConn?.name || selectedConnId})? You will need to pair again to reconnect.
        </p>
        <p className="text-xs text-muted leading-relaxed mt-2">
          {t("unlinkStickersWarning")}
        </p>
      </Dialog>

      {/* ── Delete Connection Dialog ── */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={language === "ar" ? "حذف رقم واتساب" : "Delete WhatsApp Connection"}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDeleteConnection} disabled={acting}>
              {language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}
            </Button>
          </>
        }
      >
        <p className="text-xs sm:text-sm text-text-main leading-relaxed">
          Are you sure you want to permanently delete <strong>{activeConn?.name || selectedConnId}</strong>?
          All session keys, credentials, and socket buffers for this number will be deleted from the database.
        </p>
      </Dialog>
    </div>
  );
};
