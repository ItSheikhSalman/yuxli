// file: frontend/src/views/ConnectionView.tsx

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Key,
  Phone,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  Shield,
  Smartphone,
  Square,
  Unlink,
  Wifi,
  WifiOff,
} from "lucide-react";
import * as QRCode from "qrcode";
import type React from "react";
import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
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
import type { SessionStatus } from "../types";

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
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [acting, setActing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingMethod, setPairingMethod] = useState<"pairing" | "qr">("pairing");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const state = status?.state || "idle";
  const isConnected = state === "connected";
  const isWaitingQr = state === "waiting_for_qr";
  const isStarting = state === "starting" || state === "linking";
  const isReconnecting = state === "reconnecting";
  const isPaused = state === "paused";
  const isLoggedOut = state === "logged_out";
  const linked = Boolean(status?.linked) && !isLoggedOut;
  const needsPairing = !linked;
  const canUnlink = Boolean(status?.canUnlink);
  const isOnline = status?.isOnline !== false;
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
    if (status?.qr) {
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
        toDataURL(status.qr, {
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
  }, [status?.qr]);

  // Polling for QR / Pairing code while waiting
  useEffect(() => {
    if (isWaitingQr && !status?.qr && !status?.pairingCode) {
      const timer = setInterval(() => {
        onRefresh?.();
      }, 1500);
      return () => clearInterval(timer);
    }
  }, [isWaitingQr, status?.qr, status?.pairingCode, onRefresh]);

  const handleAction = async (actionFn: () => Promise<unknown>, successMsg: string) => {
    setActing(true);
    try {
      const res = await actionFn();
      if (res && typeof res === "object" && "session" in res) {
        onStatusUpdate?.(res.session as Partial<SessionStatus>);
      }
      toast(successMsg, "success");
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
      () => api.startSession({ method: "pairing", phone: cleanPhone }),
      language === "ar" ? "جارٍ طلب رمز الربط من واتساب..." : "Requesting 8-digit pairing code...",
    );
  };

  const handleStartQr = async () => {
    await handleAction(
      () => api.startSession({ method: "qr" }),
      language === "ar" ? "جارٍ بدء الاتصال برمز QR..." : "Generating QR code...",
    );
  };

  const handleSwitchToPhone = async () => {
    await handleAction(
      api.stopSession,
      language === "ar" ? "تم الإلغاء، أدخل رقم هاتفك" : "Cancelled, enter your phone number",
    );
    setPairingMethod("pairing");
  };

  const copyPairingCode = () => {
    if (status?.pairingCode) {
      navigator.clipboard.writeText(status.pairingCode.replace(/\s+/g, ""));
      setCopiedCode(true);
      toast(language === "ar" ? "تم نسخ كود الربط!" : "Pairing code copied to clipboard", "success");
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const confirmUnlink = async () => {
    setShowUnlinkModal(false);
    await handleAction(
      api.unlinkSession,
      language === "ar" ? "تم إلغاء ربط الجلسة بنجاح" : "Session unlinked successfully.",
    );
  };

  const rawPhone = status?.user?.id ? status.user.id.split("@")[0].split(":")[0] : null;
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
    onSelect: () => handleAction(api.reconnectSession, t("reconnecting")),
  };

  const withRestart = (actions: SecondaryAction[]) =>
    hideRestart ? actions : [...actions, restartAction];
  const pairedSecondary = withRestart(canUnlink ? [unlinkAction] : []);

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

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-main">
            Connection Center
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Manage WhatsApp Baileys multi-device socket credentials, pairing, and session lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw size={13} className={acting ? "animate-spin" : ""} />}
              onClick={() => onRefresh()}
              loading={acting}
            >
              Sync Status
            </Button>
          )}
        </div>
      </div>

      {/* ── Status Card ── */}
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
                  WhatsApp Engine Link
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-line bg-panel-raised text-muted">
                  Baileys Multi-Device
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {isConnected
                  ? "WhatsApp session active & synchronizing in real time."
                  : isPaused
                    ? t("paused")
                    : linked
                      ? "Saved credentials ready — resume to connect."
                      : "Pair your WhatsApp account to enable automation."}
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto">
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
        {status?.retryInSeconds ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-2.5 text-amber-400 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>
              Reconnecting soon &bull; Next attempt in {status.retryInSeconds}s
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
              Live Sync
            </StatusPill>
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-4 pt-3 border-t border-line">
          {isConnected && (
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                icon={<Square size={13} />}
                onClick={() => handleAction(api.stopSession, t("stop"))}
                disabled={acting}
              >
                {t("stop")}
              </Button>
              {renderSecondary(withRestart([reconnectAction, unlinkAction]))}
            </div>
          )}

          {(isStarting || isWaitingQr || isReconnecting) && (
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                icon={<Square size={13} />}
                onClick={() => handleAction(api.stopSession, t("stop"))}
                disabled={acting}
              >
                Cancel Attempt
              </Button>
              {renderSecondary(withRestart([]))}
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
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Radio size={13} />}
                  onClick={() => handleAction(api.startSession, resumeLabel)}
                  disabled={acting}
                >
                  {resumeLabel}
                </Button>
                {renderSecondary(pairedSecondary)}
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
                    {renderSecondary(pairedSecondary)}
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
                    {renderSecondary(pairedSecondary)}
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
            Establishing multi-device cryptographic socket. Authentication details will arrive momentarily.
          </p>
        </Card>
      )}

      {/* ── Pairing Code Display Deck ── */}
      {isWaitingQr && (
        <Card className="mx-auto flex w-full max-w-xl flex-col items-center text-center p-5 sm:p-7 border border-line bg-panel">
          {status?.pairingCode ? (
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
                  Active Pairing Code
                </span>
                <div
                  className="text-2xl sm:text-3xl font-mono font-bold tracking-widest text-text-main select-all"
                  dir="ltr"
                >
                  {status.pairingCode.length === 8
                    ? `${status.pairingCode.slice(0, 4)} - ${status.pairingCode.slice(4)}`
                    : status.pairingCode}
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

      {/* Unlink Confirmation Dialog */}
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
          Are you sure you want to unlink this WhatsApp session? You will need to pair again to reconnect the bot.
        </p>
        <p className="text-xs text-muted leading-relaxed mt-2">
          {t("unlinkStickersWarning")}
        </p>
      </Dialog>
    </div>
  );
};
