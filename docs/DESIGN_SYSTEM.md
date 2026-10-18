# YUXLI Enterprise Design System Specification

## 1. Design Philosophy
The YUXLI design system is engineered for professional WhatsApp operations, AI orchestration, and enterprise community governance. The design is inspired by the craftsmanship of Linear, Vercel, Stripe, and Raycast:
- **Precision & High Density**: Maximum useful information per viewport height without clutter.
- **Subdued Luxury**: High quality dark/light surfaces with microscopic borders, disciplined shadows, and zero flashy gimmicks.
- **Keyboard-Driven Workflows**: Fast keyboard access via global command palette (`Cmd/Ctrl+K`), tab indexing, and focus indicators.
- **Honest Real-Time Telemetry**: Only render genuine backend metrics with clear loading, empty, and offline states.

---

## 2. Color Palette & Semantic Tokens

### 2.1 Dark Theme (Default Enterprise Dark)
```css
--bg: #090B10;             /* Root canvas */
--bg-soft: #0E121A;        /* Secondary canvas / inset panels */
--panel: #11141B;          /* Standard card and sidebar surface */
--panel-raised: #181C26;   /* Elevated cards, dropdowns, dialogs */
--panel-hover: #1F2432;    /* Interactive hover states */
--panel-solid: #11141B;    /* Non-transparent solid backing */
--line: #222735;           /* Primary structural borders */
--line-soft: #181C26;      /* Subdued internal dividers */
--text: #F8FAFC;           /* High contrast primary text */
--muted: #94A3B8;          /* Secondary descriptive text */
--faint: #64748B;          /* Tertiary text, placeholders, shortcuts */
```

### 2.2 Light Theme (Enterprise Slate)
```css
--bg: #F8FAFC;             /* Root slate canvas */
--bg-soft: #F1F5F9;        /* Soft grouped backing */
--panel: #FFFFFF;          /* Pure white card surfaces */
--panel-raised: #FFFFFF;   /* Modals and popovers */
--panel-hover: #F8FAFC;    /* Interactive hover */
--panel-solid: #FFFFFF;    /* Solid white backing */
--line: #E2E8F0;           /* Clean dividing borders */
--line-soft: #F1F5F9;      /* Faint lines */
--text: #0F172A;           /* High contrast dark slate text */
--muted: #475569;          /* Readable secondary text */
--faint: #94A3B8;          /* Light tertiary metadata */
```

### 2.3 Semantic Status & Accent Tokens
- **Brand Accent**: `#4F46E5` (Light mode) / `#6366F1` (Dark mode) / Hover: `#818CF8`
- **Success (Connected/Active)**: `#10B981` (Emerald-500)
- **Warning (Transitional/Attention)**: `#F59E0B` (Amber-500)
- **Danger (Disconnected/Destructive)**: `#EF4444` (Rose-500)
- **Information / Telemetry**: `#3B82F6` (Blue-500)

---

## 3. Typography Scale
- **Font Sans**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Font Mono**: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace
- **Font Arabic**: "Tajawal", "Inter", system-ui, sans-serif
- **Numerical Formatting**: All analytical metrics, timestamps, and counters must use `tabular-nums` for rock-solid tabular alignment.

| Style | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Display | 24px (1.5rem) | 700 / Bold | 1.2 | Main page titles |
| Heading | 18px (1.125rem) | 600 / SemiBold | 1.3 | Card titles, modal headers |
| Subheading | 14px (0.875rem) | 600 / SemiBold | 1.4 | Section dividers, table headers |
| Body | 13px (0.8125rem) | 400 / Normal | 1.5 | General UI copy, descriptions |
| Small / Label | 12px (0.75rem) | 500 / Medium | 1.4 | Badges, form labels, secondary meta |
| Caption / Mono | 11px (0.6875rem) | 600 / SemiBold | 1.3 | Timestamps, counters, keyboard hints |

---

## 4. Spacing & Elevation System
- Base grid: **4px scale** (`gap-1` = 4px, `gap-2` = 8px, `gap-3` = 12px, `gap-4` = 16px, `gap-6` = 24px, `gap-8` = 32px).
- Border Radii:
  - Input & Buttons: `rounded-lg` (8px)
  - Cards & Panels: `rounded-xl` (12px)
  - Dialogs & Drawers: `rounded-2xl` (16px)
  - Pills & Avatars: `rounded-full` (9999px)
- Shadows:
  - Card Shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px -1px rgba(0, 0, 0, 0.1)`
  - Elevated Shadow: `0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)`

---

## 5. Component Standards
1. **AppShell**: Root container with desktop sidebar, responsive mobile drawer, topbar, and scroll-isolated main stage.
2. **MetricCard**: Single metric card with label, tabular metric value, optional badge, and status tone.
3. **StatusIndicator**: Pulsing radar beacon with distinct states: `connected`, `connecting`, `offline`, `error`.
4. **CommandPalette**: Fast spotlight search modal (`Cmd/Ctrl+K`) for switching views, searching commands, or triggering actions.
5. **DataTable**: Crisp bordered tables with sticky headers, subtle row hover, and pagination/filter toolbar.
6. **ToastSystem**: Non-obtrusive notifications stacked in bottom-right with auto-dismiss and progress bar.
