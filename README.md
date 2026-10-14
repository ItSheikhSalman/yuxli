<p align="center">
  <img src="public/brand/banner.webp" alt="Yuxli - Personal WhatsApp Bot" width="100%">
</p>

<p align="center">
  <a href="https://github.com/ItSheikhSalman/yuxli/actions/workflows/ci.yml"><img src="https://github.com/ItSheikhSalman/yuxli/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/yuxli-bot"><img src="https://img.shields.io/npm/v/yuxli-bot?color=2563eb" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-10b981" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Node.js-24%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 24+">
</p>

<p align="center">
  <strong>Free, open-source, self-hosted WhatsApp automation that stays under your control.</strong>
</p>

<p align="center">
  <a href="https://github.com/ItSheikhSalman/yuxli">Repository</a> ·
  <a href="SETUP.md">Setup guide</a> ·
  <a href="https://github.com/ItSheikhSalman/yuxli/releases/latest">Downloads</a> ·
  <a href="https://github.com/ItSheikhSalman/yuxli/issues">Issues</a>
</p>

Yuxli is a personal WhatsApp bot with 55+ commands, group moderation, scheduled
messages, an AI agent, media tools, Urdu/English smart PDF generation, and a modern web control panel. You run it on your
own computer or server, keep its database and session files yourself, and can
change almost everything while it is running.

There is no paid tier, hosted account, external database, or configuration file
to maintain. Yuxli is released under the MIT License.

> [!WARNING]
> Yuxli uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial
> WhatsApp Web client, and is not affiliated with or endorsed by WhatsApp or
> Meta. Unofficial automation can lead to temporary restrictions or an account
> ban. Do not use Yuxli for spam or unsolicited bulk messaging. If an outage or
> account restriction is unacceptable, use the official WhatsApp Business
> Platform instead.

## Quick start

### Linux server

```bash
git clone https://github.com/ItSheikhSalman/yuxli.git
cd yuxli
npm install
npm run build:frontend
npm start
```

### npm

Requires Node.js 24 or newer:

```bash
npm install -g yuxli-bot
yuxli
```

### Docker

```bash
git clone https://github.com/ItSheikhSalman/yuxli
cd yuxli
docker compose up -d
docker compose logs yuxli
```

### Android phone (No server required)

Run Yuxli directly on an Android device (Android 10+, ARM64 or ARMv7) as a self-contained background companion:

1. Download **`yuxli-android-arm64.apk`** (64-bit phones) or **`yuxli-android-armv7.apk`** (32-bit phones) from [Releases](https://github.com/ItSheikhSalman/yuxli/releases).
2. Install the APK and tap **Start Host**.
3. Tap **Open Panel** to set your master password and link WhatsApp via 8-digit Pairing Code.

See [ANDROID.md](ANDROID.md) for full instructions, OEM battery optimizations (Xiaomi, Samsung, OnePlus), and offline handling.

---

Standalone Linux, macOS ARM64, and Windows binaries are available from the
[latest GitHub release](https://github.com/ItSheikhSalman/yuxli/releases/latest).

When Yuxli starts:

1. Open the panel URL printed in the terminal.
2. Choose a panel password. A remote first-time setup also asks for the printed
   setup code.
3. Open **Connection**, press **Start session**, and scan the QR from WhatsApp.
4. Send `!ping` in a chat.

A successfully linked WhatsApp session resumes automatically after a process,
Docker, or systemd restart. See [SETUP.md](SETUP.md) for domains, reverse
proxies, headless mode, backups, and troubleshooting.

## What you get

| Area | What Yuxli provides |
| --- | --- |
| Commands | 55+ commands for utilities, notes, reminders, polls, media, speech, weather, prayer times, and more |
| Smart PDF Suite | High-resolution academic notes and documents with Urdu Nastaliq / RTL shaping, auto AI summary, 6 color themes, and direct WhatsApp delivery |
| Group moderation | Welcome messages, anti-link, anti-spam, media rules, warnings, auto-kick, roles, rules, and notes |
| AI agent | Google Gemini, OpenAI / compatible, or Anthropic; web search, page reading, voice transcription, memory, and role management |
| Scheduling | One-off, daily, and weekly messages with durable jobs, delivery status, and manual retry |
| Control panel | Live connection state, multi-palette theme engine, command settings, roles, permissions, keys, memory, schedules, and logs |
| Media | Text, images, video, audio, QR codes, text-to-speech, and speech-to-text |
| Stickers | Turn a photo, GIF, or short video into a sticker, and keep a personal library and packs from chat or the panel |
| Deployment | Android APK, npm, Docker, systemd installer, standalone binaries, headless mode, and safe domain setup |
| Storage | One SQLite database and one data directory for settings, sessions, memory, and logs |

Every command can be enabled, disabled, renamed, and assigned permissions from
the panel without restarting the bot.

### AI that can act

The `!gemini` command is an agent rather than a plain chat box. It can run
several tool rounds, search the web, read a page, save long-term memories, and
manage bot roles. It narrates progress by editing one WhatsApp message and lists
sources when it uses web search.

AI is optional. The rest of Yuxli works without an AI key.

### Persistent schedules and memory

One-off and recurring schedules survive restarts and record their latest
delivery outcome. Long-term memory is stored as plain Markdown in
`memory/global.md` or per-chat files, so it remains readable and editable
outside the panel.

### A connection you control

The panel can start, stop, reconnect, and unlink WhatsApp while showing the
actual state: idle, waiting for a scan, connected, reconnecting, or stopped.
Reconnect attempts continue inside the bot even when no browser is open.

An optional HTTP, HTTPS, or SOCKS5 proxy can route WhatsApp traffic, including
media, without changing how the panel or AI connects.

## CLI

```text
yuxli                    start Yuxli with the web panel
yuxli headless           start Yuxli with no web UI or open port
yuxli where              print the data directory
yuxli reset-password     reset the panel password
yuxli domain [name]      configure a domain safely (may need sudo)
```

A fresh panel install waits for you to start the first WhatsApp pairing.
`yuxli headless` has no button to press, so it starts the session itself and
prints the QR in the terminal when needed.

## Data and configuration

Everything mutable lives in one data directory:

- npm installation: `~/.yuxli`
- source checkout: `./data`
- Docker: the `yuxli-data` volume

Copying this directory is a full backup, including the SQLite database, WhatsApp
session, memory, and logs.

The database is the source of truth. The prefix, permissions, API keys, server
settings, and feature options are stored in `bot_settings` and read at use
time. There is no `.env` or application configuration file to keep in sync.

Secrets are generated rather than shipped with defaults. The panel password is
stored as an scrypt hash, and the session-signing key is generated on first
start.

## Architecture

- **Node.js 24+** with ES modules and CommonJS where needed.
- **Baileys v7** for the WhatsApp protocol engine, LID support, and phone pairing codes.
- **`node:sqlite`** for a zero-dependency, single-file datastore.
- **React + Vite Control Panel** (`frontend/`) with TypeScript, multi-theme system (Navy, Emerald, Violet, Midnight, Light), native RTL Arabic / English internationalization, Lucide icons, responsive drawer, modal dialogs, and real-time Socket.IO synchronization.
- **Express + EJS Gateways** for lightweight setup, login, and pairing QR gateway screens.
- **Pluggable AI providers** — Google Gemini, OpenAI / any OpenAI-compatible endpoint, or
  Anthropic — each with its own endpoint, API key, and model in the control panel, no env file.
- **HarfBuzz / Sharp / SVG Rendering** for crisp typography and complex script shaping (Urdu Nastaliq, Arabic, Hindi, English).
- **Biome** for fast formatting and linting across the codebase.
- **GitHub Actions** validation for tests, npm packaging, Docker persistence,
  Android APK packaging, and standalone executables on Linux, macOS, and Windows.

[AGENTS.md](AGENTS.md) documents the module layout, message flow, storage API,
and architectural constraints. [PACKAGING.md](PACKAGING.md) covers npm, Docker,
systemd, installers, and single-executable releases.

## Development

```bash
git clone https://github.com/ItSheikhSalman/yuxli
cd yuxli
npm ci
cd frontend && npm ci && cd ..
npm run build:frontend  # compiles the React frontend to public/dashboard
npm test                # runs the test suite
npm start               # starts Yuxli
```

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a substantial
change. Bug reports and focused pull requests are welcome.

For security issues, follow [SECURITY.md](SECURITY.md) and report them
privately rather than opening a public issue.

## Support & Issues

For bugs, feature suggestions, or questions, please open an
[issue on GitHub](https://github.com/ItSheikhSalman/yuxli/issues).

## License

Yuxli is free and open source under the [MIT License](LICENSE).

Developed and maintained by **[Sheikh Salman](https://github.com/ItSheikhSalman)**.
