# YUXLI Feature Inventory & API Mapping

This document provides a comprehensive mapping of all frontend features, business logic, endpoints, and data contracts across the YUXLI application.

---

## 1. Overview & System Telemetry
- **View**: `src/views/OverviewView.tsx`
- **Endpoints**:
  - `GET /dashboard/api/stats`: Returns `connection` state, `totalGroups`, `totalWarnings`, `totalTodos`, `totalNotes`, `totalDebts`, `totalSchedules`, `commandCount`, `uptime`, `memory`, `nodeVersion`, `prefix`.
  - `GET /dashboard/api/bot/session`: Live session state (`state`, `connected`, `user`, `qr`, `pairingCode`).
  - `POST /dashboard/api/bot/session/start`: Starts WhatsApp socket initialization.
  - `POST /dashboard/api/bot/session/stop`: Pauses / halts session gracefully.
- **Key State & Contracts**:
  - `SessionStatus`: `{ state: SessionState, connected?: boolean, user?: { id?: string, name?: string }, qr?: string | null, pairingCode?: string | null, isOnline?: boolean }`
  - Realtime Socket.IO: Listens on `status` and updates active status.

---

## 2. Connection Center
- **View**: `src/views/ConnectionView.tsx`
- **Endpoints**:
  - `POST /dashboard/api/bot/session/start`: Method `pairing` (with `phone`) or `qr`.
  - `POST /dashboard/api/bot/session/reconnect`: Forces connection cycle.
  - `POST /dashboard/api/bot/session/stop`: Stops connection.
  - `POST /dashboard/api/bot/logout`: Unlinks session and clears credentials.
  - `POST /dashboard/api/bot/restart`: Restarts underlying worker process.
- **Workflows**:
  - Phone pairing 8-character code with one-click copy.
  - QR Code dynamic rendering via local `qrcode` module.
  - Transitional status polling (intervals of 1.5s - 2s).
  - Unlink confirmation modal with destructive action gate.

---

## 3. Anti-Ban Shield v4.2
- **View**: `src/views/AntiBanShieldView.tsx`
- **Endpoints**:
  - `GET /dashboard/api/antiban`: Returns `healthScore` (0-100), `riskLevel` (low/medium/high), `protectionLevel` (maximum/balanced/throughput), `minDelay`, `maxDelay`, `typingPresence`, `warmupMode`, `jitterEnabled`, `rateLimitPerMin`, `messagesToday`, `totalProtected`, `warmupDay`, `features`, and recent `logs`.
  - `POST /dashboard/api/antiban`: Updates anti-ban parameters.
- **Workflows**:
  - One-click protection level presets: Maximum Protection, Balanced, High Throughput.
  - Fine-grained timing sliders for min/max delay (ms).
  - Live activity feed showing protection actions and synthetic delay durations per JID.

---

## 4. Plans & Pricing
- **View**: `src/views/PlansPricingView.tsx`
- **Endpoints**:
  - `GET /dashboard/api/billing/plans`: Tier plans list (`starter`, `pro`, `enterprise`).
  - `GET /dashboard/api/user/me`: Current user info (`plan`, `role`, `company`, `email`, `name`).
  - `POST /dashboard/api/user/plan`: Upgrades or switches plan.
- **Workflows**:
  - Monthly vs Annual billing toggle with 20% discount calculation.
  - Feature limits comparison matrix (numbers, message volume, AI tokens, SLA).
  - Current tier badge and instant plan upgrade confirmation.

---

## 5. Command Hub
- **View**: `src/views/CommandsView.tsx`
- **Endpoints**:
  - `GET /dashboard/api/commands`: Returns command catalog with names, descriptions (EN/AR), usages, permission levels, categories, aliases, and enabled states.
  - `PATCH /dashboard/api/commands/:name`: Updates `enabled`, `permission`, or `aliases`.
  - `PATCH /dashboard/api/settings`: Updates global bot command prefix (`key: "prefix", value: string`).
- **Workflows**:
  - Search and filter by category or permission.
  - In-place prefix editor with validation (1-3 chars).
  - Command aliases editor modal supporting Latin and Arabic script keywords.

---

## 6. AI Assistant & Workspace
- **View**: `src/views/AIAssistantView.tsx`
- **Endpoints**:
  - `POST /dashboard/api/ai/models`: Discovers available models for provider (`flipia`, `pollinations`, `groq`, `gemini`, `openai`, `deepseek`, `anthropic`).
  - `GET /dashboard/api/ai/persona`: Gets bot identity persona.
  - `PUT /dashboard/api/ai/persona`: Saves custom instructions / persona prompt.
  - `GET /dashboard/api/ai/memory`: Lists active memory files and scopes.
  - `GET /dashboard/api/ai/memory/:name`: Reads memory scope content.
  - `PUT /dashboard/api/ai/memory/:name`: Updates memory scope.
  - `DELETE /dashboard/api/ai/memory/:name`: Clears memory scope.
  - `GET /dashboard/api/ai/conversations`: Chat thread directory.
  - `GET /dashboard/api/ai/conversations/:chatId`: Chat transcript inspector.
  - `PATCH /dashboard/api/settings`: Configures provider keys, models, base URLs, temperature.

---

## 7. Groups Management & Guardian
- **View**: `src/views/GroupsView.tsx`
- **Endpoints**:
  - `GET /dashboard/api/groups`: List of joined WhatsApp groups (`jid`, `subject`, `memberCount`, `antilink`, `welcomeEnabled`, `mediaRestriction`, `contentFilter`, `autoReply`).
  - `PATCH /dashboard/api/groups/:jid`: Updates group policies.
  - `GET /dashboard/api/bot-access`: Gets bot scope mode (`public`, `admin_only`, `whitelisted_only`, etc.), allowed groups, and allowed DMs.
  - `POST /dashboard/api/bot-access/mode`: Sets scope mode.
  - `POST /dashboard/api/bot-access/groups`: Adds group to whitelist.
  - `DELETE /dashboard/api/bot-access/groups/:id`: Removes group from whitelist.
  - `POST /dashboard/api/bot-access/dms`: Adds DM to whitelist.
  - `DELETE /dashboard/api/bot-access/dms/:id`: Removes DM from whitelist.
  - `GET /dashboard/api/permissions`: List bot owners and admins.
  - `POST /dashboard/api/permissions/owners`: Adds owner identifier.
  - `DELETE /dashboard/api/permissions/owners/:id`: Revokes owner.

---

## 8. Automation & Scheduled Messages
- **View**: `src/views/SchedulesView.tsx`
- **Endpoints**:
  - `GET /dashboard/api/schedules`: List scheduled messages with status, cron, recipient, next run, media path.
  - `POST /dashboard/api/schedules`: Creates one-time or recurring schedule. Supports multipart file attachment upload.
  - `DELETE /dashboard/api/schedules/:id`: Cancels schedule.
  - `POST /dashboard/api/schedules/:id/retry`: Retries failed execution.
  - `GET /dashboard/api/recipients`: Contacts and groups list.

---

## 9. Auto-Delete Policies
- **View**: `src/views/autoDelete/AutoDeleteView.tsx`
- **Endpoints**:
  - `GET /dashboard/api/auto-delete/rules`: Rule catalog.
  - `POST /dashboard/api/auto-delete/rules`: Creates rule with match pattern, delay, and target scope.
  - `PATCH /dashboard/api/auto-delete/rules/:id`: Updates rule.
  - `DELETE /dashboard/api/auto-delete/rules/:id`: Deletes rule.
  - `GET /dashboard/api/auto-delete/log`: Message cleanup audit log.
  - `DELETE /dashboard/api/auto-delete/log`: Clears log entries.

---

## 10. Sticker Studio Lab
- **View**: `src/views/StickerStudioView.tsx`
- **Endpoints**:
  - `GET /dashboard/api/stickers/capabilities`: Server sticker engine capabilities (WebP, GIF, animated).
  - `GET /dashboard/api/stickers`: Filtered stickers library.
  - `POST /dashboard/api/stickers/uploads`: Uploads sticker source image/video.
  - `POST /dashboard/api/stickers/jobs`: Starts sticker conversion/crop job.
  - `GET /dashboard/api/stickers/jobs/:id`: Polls job progress.
  - `POST /dashboard/api/stickers/send`: Sends sticker directly to a WhatsApp recipient.
  - `GET/POST/PATCH/DELETE /dashboard/api/sticker-packs`: Pack management.

---

## 11. Settings & Platform Config
- **View**: `src/views/SettingsView.tsx`
- **Endpoints**:
  - `GET /dashboard/api/settings`: Complete settings dictionary.
  - `PATCH /dashboard/api/settings`: Updates arbitrary key-value setting.
  - `POST /dashboard/api/security/password`: Changes dashboard operator password.
  - `GET /dashboard/api/settings/export`: Downloads atomic configuration JSON.
  - `POST /dashboard/api/settings/import`: Previews and applies settings import.
  - `GET /dashboard/api/feedback/meta` & `POST /dashboard/api/feedback`: Submits developer feedback with optional attachment.

---

## 12. Logs & Realtime Diagnostics
- **View**: `src/views/LogsView.tsx`
- **Endpoints & Events**:
  - `GET /dashboard/api/logs`: Returns recent server log buffer.
  - Socket.IO `log` event: Streams realtime logs directly into UI buffer.
  - Android companion bridge: `window.LevixHost.hostLog(500)`.
