// file: frontend/src/views/ConnectionView.tsx

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Key,
  Phone,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  Shield,
  Smartphone,
  Sparkles,
  Square,
  Unlink,
  Wifi,
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

  // Generate QR code locally in offline-first mode
  useEffect(() => {
    if (status?.qr) {
      const toDataURL =
        QRCode.toDataURL ||
        (QRCode as { default?: { toDataURL?: typeof QRCode.toDataURL } }).default?.toDataURL;
      if (typeof toDataURL === "function") {
        const styles = getComputedStyle(document.documentElement);
        const lightTheme = document.documentElement.getAttribute("data-theme") === "light";
        const dark = (
          lightTheme ? styles.getPropertyValue("--text") : styles.getPropertyValue("--bg")
        ).trim() || "#000000";
        const light = (
          lightTheme ? styles.getPropertyValue("--panel") : styles.getPropertyValue("--text")
        ).trim() || "#ffffff";
        toDataURL(status.qr, {
          width: 280,
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

  // If waiting for QR but no QR is stored yet, poll rapidly until it arrives
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
      toast(language === "ar" ? "تم نسخ كود الربط!" : "Pairing code copied!", "success");
      setTimeout(() => setCopiedCode(false), 2500);
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
    icon: <Unlink size={16} />,
    danger: true,
    onSelect: () => setShowUnlinkModal(true),
  };
  const restartAction: SecondaryAction = {
    key: "restart",
    label: t("restart"),
    icon: <RotateCcw size={16} />,
    onSelect: () => handleAction(api.restartBot, t("restart")),
  };
  const reconnectAction: SecondaryAction = {
    key: "reconnect",
    label: t("reconnect"),
    icon: <RefreshCw size={16} />,
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
        <IconButton
          label={only.label}
          icon={only.icon}
          onClick={only.onSelect}
          disabled={acting}
          className="rounded-2xl"
        />
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
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* ── Primary Connection Hero Deck ── */}
      <Card className="relative overflow-hidden border-line/80 p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-line/60">
          <div className="flex items-center gap-4">
            <div
              className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 transition-all duration-300 shadow-xl ${
                isConnected
                  ? "bg-ok/15 text-ok border-ok/40 shadow-ok/20"
                  : isWaitingQr
                    ? "bg-warn/15 text-warn border-warn/40 shadow-warn/20"
                    : isStarting || isReconnecting
                      ? "bg-brand-indigo/15 text-brand-indigo border-brand-indigo/40 shadow-brand-indigo/20"
                      : "bg-faint/15 text-muted border-line/80"
              }`}
            >
              <Radio size={26} strokeWidth={2.5} className={isConnected ? "animate-pulse" : ""} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-text-main font-display">
                  WhatsApp Engine Link
                </h2>
                <span className="rounded-full bg-brand-indigo/15 border border-brand-indigo/30 px-2 py-0.5 text-[10px] font-bold text-brand-pink">
                  Baileys Multi-Device
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
                {isConnected
                  ? "WhatsApp session active & synchronizing in real time."
                  : isPaused
                    ? t("paused")
                    : linked
                      ? language === "ar"
                        ? "جلسة محفوظة — اضغط استئناف لإعادة الاتصال"
                        : "Saved credentials ready — resume to connect"
                      : "Pair your WhatsApp account to enable automation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black border transition-all ${
                isConnected
                  ? "bg-ok/15 text-ok border-ok/35 shadow-sm shadow-ok/10"
                  : isWaitingQr
                    ? "bg-warn/15 text-warn border-warn/35 shadow-sm shadow-warn/10"
                    : isStarting || isReconnecting
                      ? "bg-brand-indigo/15 text-brand-indigo border-brand-indigo/35 animate-pulse"
                      : "bg-faint/15 text-muted border-line/70"
              }`}
            >
              <span className="pulse-dot size-2" />
              <span className="uppercase tracking-wider">{t(state as any, state)}</span>
            </span>
          </div>
        </div>

        {/* Retry Alert */}
        {status?.retryInSeconds ? (
          <div className="mt-4 rounded-2xl border border-warn/35 bg-warn/10 p-4 flex items-center gap-3.5 text-warn shadow-sm">
            <AlertCircle size={22} className="shrink-0 animate-pulse" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">
                {language === "ar" ? "إعادة الاتصال قريباً" : "Reconnecting soon"}
              </span>{" "}
              &bull;{" "}
              <span>
                {language === "ar"
                  ? `المحاولة التالية خلال ${status.retryInSeconds} ثانية`
                  : `Next attempt in ${status.retryInSeconds}s`}
              </span>
            </div>
          </div>
        ) : null}

        {/* Connected Phone Number Banner */}
        {isConnected && rawPhone && (
          <div className="mt-5 rounded-2xl border border-ok/30 bg-ok/10 p-4 sm:p-5 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="size-11 rounded-2xl bg-ok/20 text-ok flex items-center justify-center shrink-0 border border-ok/30">
                <CheckCircle2 size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">
                  {t("connectedNumber")}
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-text-main" dir="ltr">
                  +{rawPhone}
                </div>
              </div>
            </div>
            <StatusPill tone="ok" dot className="shrink-0 text-xs font-black px-3 py-1">
              Active Sync
            </StatusPill>
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-6">
          {isConnected && (
            <div className="flex w-full items-center gap-3">
              <Button
                variant="danger"
                icon={<Square size={16} />}
                onClick={() => handleAction(api.stopSession, t("stop"))}
                disabled={acting}
                className="flex-1 sm:flex-none rounded-2xl"
              >
                {t("stop")}
              </Button>
              {renderSecondary(withRestart([reconnectAction, unlinkAction]))}
            </div>
          )}

          {(isStarting || isWaitingQr || isReconnecting) && (
            <div className="flex w-full items-center gap-3">
              <Button
                variant="danger"
                icon={<Square size={16} />}
                onClick={() => handleAction(api.stopSession, t("stop"))}
                disabled={acting}
                className="flex-1 sm:flex-none rounded-2xl"
              >
                {language === "ar" ? "إلغاء المحاولة" : "Cancel Attempt"}
              </Button>
              {renderSecondary(withRestart([]))}
            </div>
          )}

          {!isConnected && !isStarting && !isWaitingQr && !isReconnecting && linked && (
            <div className="flex flex-col gap-3.5 w-full max-w-xl">
              {isPaused && (
                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  {isOnline
                    ? language === "ar"
                      ? "الجلسة محفوظة. اضغط استئناف لإعادة استخدام نفس حساب واتساب."
                      : "This WhatsApp session is saved. Resume to reconnect with the same account."
                    : language === "ar"
                      ? "الاتصال متوقف بسبب انقطاع الإنترنت. سيُستأنف تلقائياً عند عودة الشبكة."
                      : "Paused while the device is offline. It will resume when the network returns."}
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  icon={<Radio size={16} />}
                  onClick={() => handleAction(api.startSession, resumeLabel)}
                  disabled={acting}
                  className="flex-1 sm:flex-none rounded-2xl"
                >
                  {resumeLabel}
                </Button>
                {renderSecondary(pairedSecondary)}
              </div>
            </div>
          )}

          {/* Pairing Choices: Pairing Code vs QR */}
          {!isConnected && !isStarting && !isWaitingQr && !isReconnecting && needsPairing && (
            <div className="flex flex-col gap-5 w-full">
              <SegmentedControl
                aria-label={t("connection")}
                value={pairingMethod}
                onChange={setPairingMethod}
                className="w-full sm:w-fit rounded-2xl"
                options={[
                  {
                    value: "pairing",
                    label: language === "ar" ? "كود الربط الرقمي (الهاتف)" : "8-Digit Pairing Code",
                    icon: <Smartphone size={16} />,
                  },
                  {
                    value: "qr",
                    label: language === "ar" ? "مسح رمز QR" : "QR Code Scanner",
                    icon: <QrCode size={16} />,
                  },
                ]}
              />

              {pairingMethod === "pairing" && (
                <form onSubmit={handleStartPairing} className="flex w-full max-w-xl flex-col gap-3.5">
                  <div className="relative">
                    <Phone
                      size={18}
                      className="absolute top-1/2 -translate-y-1/2 start-3.5 text-brand-indigo pointer-events-none"
                    />
                    <Input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 923001234567 (with country code)"
                      dir="ltr"
                      className="ps-11 rounded-2xl border-line/80 bg-panel-raised/80 font-mono text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      icon={<Key size={16} />}
                      disabled={acting}
                      className="flex-1 whitespace-nowrap sm:flex-none rounded-2xl"
                    >
                      {language === "ar" ? "الحصول على كود الربط" : "Request Pairing Code"}
                    </Button>
                    {renderSecondary(pairedSecondary)}
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Enter your WhatsApp phone number with country code (e.g. 92300... or 1415...). You will receive an 8-digit code to type into WhatsApp.
                  </p>
                </form>
              )}

              {pairingMethod === "qr" && (
                <div className="flex w-full max-w-xl flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      icon={<QrCode size={18} />}
                      onClick={handleStartQr}
                      disabled={acting}
                      className="flex-1 whitespace-nowrap sm:flex-none rounded-2xl"
                    >
                      {language === "ar" ? "بدء الربط عبر رمز QR" : "Generate Pairing QR Code"}
                    </Button>
                    {renderSecondary(pairedSecondary)}
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Generates a high-contrast QR code to scan with WhatsApp camera under Linked Devices.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Starting Progress Card ── */}
      {isStarting && (
        <Card className="flex flex-col items-center text-center p-8">
          <div className="size-14 rounded-2xl bg-brand-indigo/15 text-brand-indigo flex items-center justify-center mb-4 border border-brand-indigo/30 shadow-lg">
            <RefreshCw size={26} className="animate-spin" />
          </div>
          <h3 className="text-lg font-black text-text-main font-display mb-1.5">
            {state === "linking" ? "Finishing handshake..." : "Initializing WhatsApp session..."}
          </h3>
          <p className="text-xs sm:text-sm text-muted max-w-md">
            Creating secure multi-device protocol socket. Pairing details will appear in seconds.
          </p>
        </Card>
      )}

      {/* ── Pairing Code Display Deck ── */}
      {isWaitingQr && (
        <Card className="mx-auto flex w-full max-w-2xl flex-col items-center text-center p-6 sm:p-8">
          {status?.pairingCode ? (
            <div className="flex flex-col items-center w-full animate-fade-up">
              <div className="size-14 rounded-2xl bg-brand-indigo/15 text-brand-pink flex items-center justify-center mb-4 border border-brand-indigo/30 shadow-lg">
                <Smartphone size={28} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-text-main font-display mb-1.5">
                WhatsApp 8-Digit Pairing Code
              </h3>
              <p className="text-xs sm:text-sm text-muted max-w-md mb-6">
                Enter this code into WhatsApp on your phone to complete pairing instantly.
              </p>

              {/* Glowing 8-Digit Box */}
              <div className="rounded-3xl border-2 border-brand-indigo/40 bg-gradient-to-br from-brand-indigo/15 via-brand-purple/10 to-brand-pink/10 p-6 sm:p-8 w-full max-w-md flex flex-col items-center gap-5 shadow-2xl shadow-brand-indigo/20">
                <span className="text-xs font-black uppercase tracking-widest text-brand-pink">
                  Live Pairing Code
                </span>
                <div
                  className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-text-main select-all drop-shadow"
                  dir="ltr"
                >
                  {status.pairingCode.length === 8
                    ? `${status.pairingCode.slice(0, 4)} - ${status.pairingCode.slice(4)}`
                    : status.pairingCode}
                </div>
                <Button
                  variant="primary"
                  icon={copiedCode ? <Check size={18} /> : <Copy size={18} />}
                  onClick={copyPairingCode}
                  className="rounded-2xl px-6"
                >
                  {copiedCode ? "Code Copied!" : "Copy Code"}
                </Button>
              </div>

              {/* Step-by-Step Guide */}
              <div className="mt-6 p-5 rounded-2xl border border-line/70 bg-panel-raised/60 text-start w-full max-w-md">
                <div className="text-xs font-black uppercase tracking-wider text-text-main mb-3 font-display">
                  How to link on your phone:
                </div>
                <ol className="text-xs text-muted space-y-2.5 list-decimal list-inside leading-relaxed font-medium">
                  <li>Open <strong>WhatsApp</strong> on your phone.</li>
                  <li>Tap <strong>Settings → Linked Devices → Link a Device</strong>.</li>
                  <li>Tap <strong className="text-brand-pink">«Link with phone number instead»</strong> at the bottom.</li>
                  <li>Enter the 8-digit code shown above to connect.</li>
                </ol>
              </div>
            </div>
          ) : qrDataUrl ? (
            /* Holographic QR Scanner Frame */
            <div className="flex flex-col items-center w-full animate-fade-up">
              <div className="size-14 rounded-2xl bg-brand-cyan/15 text-brand-cyan flex items-center justify-center mb-4 border border-brand-cyan/30 shadow-lg">
                <QrCode size={28} />
              </div>
              <h3 className="text-xl font-black text-text-main font-display mb-1.5">
                Scan Holographic QR Code
              </h3>
              <p className="text-xs sm:text-sm text-muted max-w-md mb-6">
                Open WhatsApp → Linked Devices → Scan this code with your phone camera.
              </p>

              {/* Holographic scanner frame */}
              <div className="relative p-4 sm:p-5 bg-panel-raised rounded-3xl shadow-2xl border border-line/80">
                {/* Corner Crosshairs */}
                <div className="absolute top-2 left-2 size-4 border-t-2 border-l-2 border-brand-cyan rounded-tl-md" />
                <div className="absolute top-2 right-2 size-4 border-t-2 border-r-2 border-brand-cyan rounded-tr-md" />
                <div className="absolute bottom-2 left-2 size-4 border-b-2 border-l-2 border-brand-cyan rounded-bl-md" />
                <div className="absolute bottom-2 right-2 size-4 border-b-2 border-r-2 border-brand-cyan rounded-br-md" />

                <img
                  src={qrDataUrl}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 sm:w-64 sm:h-64 block rounded-2xl shadow-inner"
                />
              </div>

              <div className="mt-6 pt-5 border-t border-line/60 w-full max-w-md flex flex-col items-center gap-2.5">
                <p className="text-xs text-muted text-center">
                  Using this phone directly and cannot scan your own screen?
                </p>
                <Button
                  variant="secondary"
                  icon={<Smartphone size={16} />}
                  onClick={handleSwitchToPhone}
                  disabled={acting}
                  className="w-full rounded-2xl"
                >
                  Switch to Phone Pairing Code
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10">
              <Spinner className="size-9" />
              <span className="text-xs sm:text-sm font-bold text-muted animate-pulse">
                Generating secure pairing handshake...
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Unlink Modal */}
      <Dialog
        isOpen={showUnlinkModal}
        onClose={() => setShowUnlinkModal(false)}
        title={t("unlink")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUnlinkModal(false)} className="rounded-xl">
              {t("cancel")}
            </Button>
            <Button variant="danger" onClick={confirmUnlink} className="rounded-xl">
              {t("unlink")}
            </Button>
          </>
        }
      >
        <p className="text-xs sm:text-sm text-text-main leading-relaxed">
          Are you sure you want to unlink this WhatsApp session? You will need to pair again to reconnect the bot.
        </p>
        <p className="text-xs sm:text-sm text-muted leading-relaxed mt-2.5">
          {t("unlinkStickersWarning")}
        </p>
      </Dialog>
    </div>
  );
};
