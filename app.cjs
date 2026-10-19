// file: app.cjs
//
// The control panel's HTTP surface. It is not optional: the panel is the only
// place the bot is configured, so there is always a server and always a login.
//
// Nothing here reads a configuration file or an environment variable. The
// session key is generated on first start (src/config/secrets.cjs), the
// password is chosen once from the browser, and the handful of HTTP knobs
// (port, proxy hops, extra origin) are settings in the database that the panel
// itself can change.

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const express = require("express");
const { Server } = require("socket.io");
const session = require("express-session");

const logger = require("./src/utils/logger.cjs");
const { assetPath } = require("./src/config/paths.cjs");
const brand = require("./src/config/brand.cjs");
const settings = require("./src/config/settings.cjs");
const secrets = require("./src/config/secrets.cjs");
const store = require("./src/db/store.cjs");
const { PanelSessionStore } = require("./src/panel/session-store.cjs");
const { getQrCode } = require("./src/utils/storage.cjs");
const { clientAddress, isDirectLocalRequest } = require("./src/utils/requestOrigin.cjs");
const { blockedFor, recordFailure, clearAttempts } = require("./src/panel/login-throttle.cjs");
const { isPanelSessionValid, stampPanelSession } = require("./src/panel/session-auth.cjs");
const { requestResetCode, completeReset } = require("./src/panel/password-reset.cjs");

const SESSION_COOKIE_NAME = "wa.sid";
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const app = express();
const server = http.createServer(app);

// Origin check for the socket: socket.io's `cors` option only covers polling,
// and the browser doesn't apply CORS to a websocket at all.
function isAllowedOrigin(origin, host) {
  if (!origin) return true; // curl / a mobile app: no browser to protect
  const extra = settings.get("dashboard_origin");
  if (extra && origin === extra) return true;
  return origin === `http://${host}` || origin === `https://${host}`;
}

// Browsers may legitimately serialize the Origin header as the literal string
// "null" for a same-origin navigation in an opaque-origin context. Prefer
// Fetch Metadata when the browser sends it. Some Chromium form navigations omit
// Sec-Fetch-Site entirely, so password-gated login gets a narrow fallback for
// Origin:null. First-run setup is deliberately excluded: a loopback request
// otherwise skips the setup code and could claim an unconfigured panel.
// The reset endpoints are auth doors of the same shape — code-gated and
// throttled — so they ride along with login.
const OPAQUE_ORIGIN_AUTH_PATHS = new Set(["/login", "/reset/request", "/reset/confirm", "/signup"]);
function isAllowedMutationRequest(req) {
  const origin = req.get("origin");
  const host = req.get("host");

  // Preserve the explicit dashboard_origin escape hatch before consulting
  // fetch metadata: a deliberately separate dashboard can be cross-site.
  if (origin && origin !== "null" && isAllowedOrigin(origin, host)) return true;

  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite === "same-origin") return true;
  if (fetchSite === "cross-site") return false;

  // Real Chromium can submit a top-level auth form with Origin:null and no
  // Sec-Fetch-Site header. Login is still protected by the password and
  // TCP-peer throttling. Do not generalize this exception to setup, dashboard
  // APIs, or logout.
  if (origin === "null" && !fetchSite && OPAQUE_ORIGIN_AUTH_PATHS.has(req.path)) {
    return true;
  }

  return isAllowedOrigin(origin, host);
}

// serveClient reads the browser bundle out of node_modules on every request,
// which a packaged build has no way to do. We vendor it in public/ instead —
// same reason qrcode.min.js is there rather than on a CDN.
const io = new Server(server, {
  serveClient: false,
  maxHttpBufferSize: 1e6,
  allowRequest: (req, callback) => {
    callback(null, isAllowedOrigin(req.headers.origin, req.headers.host));
  },
});

app.disable("x-powered-by");

// Behind a proxy (nginx / Cloudflare) this has to match the real number of
// hops, or req.ip is the proxy's address — or worse, one the client forged.
// Default: off, which is right when the panel is exposed directly.
const trustProxy = settings.get("trust_proxy");
// Remembered rather than re-read: whether a proxy is in front decides whether
// the first-run page can ever skip the setup code, and that must not change
// under us mid-process. See src/utils/requestOrigin.cjs.
const PROXY_CONFIGURED = Boolean(trustProxy);
if (PROXY_CONFIGURED) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Frame-Options", "DENY");
  res.set("Content-Security-Policy", "frame-ancestors 'none'");
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

// 100 KB is plenty for the small dashboard mutations. The dashboard API is the
// exception: it carries whole Markdown files (the AI persona, a memory file),
// so src/index.js mounts `dashboardJson` in front of it and this parser skips
// those paths.
const jsonBody = express.json({ limit: "100kb" });
const urlencodedBody = express.urlencoded({ extended: false, limit: "100kb" });
const dashboardJson = express.json({ limit: "2mb" });

app.use((req, res, next) => {
  if (req.path.startsWith("/dashboard/api/") || req.path === "/api/billing/webhook") return next();
  jsonBody(req, res, (err) => {
    if (err) return next(err);
    urlencodedBody(req, res, next);
  });
});

// SameSite=lax closes the classic CSRF; this is a cheap check on top of it for
// anything that changes state.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
app.use((req, res, next) => {
  if (req.path === "/api/billing/webhook") return next();
  if (SAFE_METHODS.has(req.method)) return next();
  if (isAllowedMutationRequest(req)) return next();
  return res.status(403).json({ error: "Cross-origin request rejected" });
});

function requireLoginApi(req, res, next) {
  if (isPanelSessionValid(req.session)) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// The QR and the dashboard are sensitive: no-store so a proxy or the browser's
// back button can't hand a signed-in page to someone else.
function noStore(req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}

function requireLoginPage(req, res, next) {
  if (isPanelSessionValid(req.session)) return next();
  return res.redirect("/");
}

// Bind the engine by value rather than letting express require("ejs") lazily
// by name: a packaged build has no module resolver to answer that call.
app.engine("ejs", require("ejs").__express);
app.set("view engine", "ejs");
app.set("views", assetPath("views"));
// Name, tagline and credit for every template. Frozen — see brand.cjs.
// The one addition is the version from package.json, so the panel shows the
// shipped version instead of a string frozen in the frontend bundle.
const pkg = require("./package.json");
app.locals.brand = { ...brand, version: pkg.version };
app.use(express.static(assetPath("public")));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Dynamic keep-alive public URL detector from real incoming traffic
app.use((req, res, next) => {
  const host = req.get("host");
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1") && !host.includes("0.0.0.0")) {
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    try {
      const keepAlive = require("./src/utils/keepAlive.cjs");
      keepAlive.updateUrl(`${proto}://${host}/healthz`);
    } catch (_) {}
  }
  next();
});

// --- Health check (unauthenticated) ---------------------------------------
// Render, UptimeRobot, and the built-in self-ping all hit this. It must live
// before the session middleware so it never creates a cookie or touches the
// store, and it must not require a login.
app.get(["/healthz", "/health", "/ping"], (req, res) => {
  res.status(200).json({ status: "ok", bot: "Yuxli", uptime: Math.floor(process.uptime()), timestamp: Date.now() });
});

// --- Stripe Webhook (Unauthenticated, HMAC-verified) ----------------------
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    try {
      const signature = req.headers["stripe-signature"];
      const billing = require("./src/services/billing/index.cjs");
      const outcome = await billing.handleIncomingWebhook(req.body, signature);
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      logger.error({ err }, "[Billing] Webhook handler error");
      res.status(500).json({ error: "Internal webhook processing error" });
    }
  }
);

// Levix is intentionally one process and one operator, so a small expiring
// in-memory store is enough. Unlike express-session's development MemoryStore,
// it is explicitly bounded and prunes expired entries instead of growing for
// the lifetime of the process. Sessions still disappear on restart by design.
const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  secret: secrets.getSessionSecret(),
  store: new PanelSessionStore({ ttlMs: SESSION_MAX_AGE_MS }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    // "auto" = Secure only on an HTTPS request, so the same install works on
    // http://localhost and behind a TLS proxy without a setting to get wrong.
    secure: "auto",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  },
});

app.use(sessionMiddleware);

// Every socket receives the pairing QR, so it goes through the same session.
io.engine.use(sessionMiddleware);
io.use((socket, next) => {
  if (isPanelSessionValid(socket.request.session)) return next();
  next(new Error("unauthorized"));
});

function disconnectInvalidPanelSockets() {
  for (const socket of io.of("/").sockets.values()) {
    if (!isPanelSessionValid(socket.request.session)) socket.disconnect(true);
  }
}

function disconnectSessionSockets(sid) {
  for (const socket of io.of("/").sockets.values()) {
    if (socket.request.sessionID === sid) socket.disconnect(true);
  }
}

// --- First run ------------------------------------------------------------
//
// Until a password exists there is nothing to log into. The panel shows a
// "choose your password" page instead.
//
// From a direct loopback connection that is all it asks: whoever is sitting at
// the machine is the operator. Every other request — remote, proxied, or merely
// carrying a forwarding header — also needs the setup code printed on the
// server's console, so claiming the bot requires access to the machine rather
// than to the port. See src/utils/requestOrigin.cjs for why this can't be
// `req.ip`.

function isLocalRequest(req) {
  return isDirectLocalRequest(req, { proxyConfigured: PROXY_CONFIGURED });
}

function renderSetup(req, res, error, status = 200) {
  const disableCode = process.env.DISABLE_SETUP_CODE === "true";
  const needsCode = !disableCode && !isLocalRequest(req);
  res.status(status).render("setup", {
    error,
    needsCode,
    setupCode: secrets.getSetupCode(),
    minLength: secrets.MIN_PASSWORD_LENGTH,
  });
}

app.get("/setup", noStore, (req, res) => {
  if (secrets.hasDashboardPassword() && store.countSaasUsers() > 0) {
    if (isPanelSessionValid(req.session)) return res.redirect("/");
    return res.redirect("/login");
  }
  renderSetup(req, res, null);
});

app.post("/setup", (req, res, next) => {
  if (secrets.hasDashboardPassword() && store.countSaasUsers() > 0) {
    if (isPanelSessionValid(req.session)) return res.redirect("/");
    return res.redirect("/login");
  }

  const peer = clientAddress(req);
  const retryAfter = blockedFor(peer);
  if (retryAfter) {
    res.set("Retry-After", String(retryAfter));
    return renderSetup(req, res, "Too many attempts. Try again later.", 429);
  }

  const { name, email, password, confirm, company, code } = req.body || {};

  const disableCode = process.env.DISABLE_SETUP_CODE === "true";
  const needsCode = !disableCode && !isLocalRequest(req);

  if (needsCode && !secrets.setupCodeMatches(code)) {
    recordFailure(peer);
    logger.warn({ ip: peer }, "[dashboard] Setup attempted with a wrong code");
    return renderSetup(req, res, "Wrong setup code.", 401);
  }

  if (!password) {
    return renderSetup(req, res, "Password is required.", 400);
  }

  if (password !== confirm) {
    return renderSetup(req, res, "The two passwords don't match.", 400);
  }

  try {
    secrets.setDashboardPassword(password);
    const saasName = (name && String(name).trim()) || "Administrator";
    const saasEmail = (email && String(email).trim().toLowerCase()) || "admin@yuxli.local";
    const saasCompany = (company && String(company).trim()) || "Default Workspace";
    let user;
    if (store.countSaasUsers() === 0) {
      user = store.createSaasUser({
        name: saasName,
        email: saasEmail,
        password,
        company: saasCompany,
        role: "owner",
        plan: "free",
        workspaceId: "ws_default",
      });
    } else {
      user = store.getSaasUserByEmail(saasEmail) || store.listSaasUsers()[0];
    }
    clearAttempts(peer);
    logger.info({ ip: peer }, "[dashboard] Setup complete — workspace claimed");
    req.session.regenerate((err) => {
      if (err) return next(err);
      stampPanelSession(req.session, user, { operator: true });
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.redirect(303, "/");
      });
    });
  } catch (error) {
    return renderSetup(req, res, error.message, 400);
  }
});

// --- Routes ---------------------------------------------------------------

app.get(["/health", "/ping", "/healthz"], (req, res) => {
  res.status(200).json({ status: "ok", bot: "Yuxli", timestamp: Date.now() });
});

app.get("/", noStore, (req, res) => {
  if (!secrets.hasDashboardPassword() && store.countSaasUsers() === 0) return res.redirect("/setup");
  if (isPanelSessionValid(req.session)) {
    const dashboardHtmlPath = path.join(assetPath("public"), "dashboard", "index.html");
    if (fs.existsSync(dashboardHtmlPath)) {
      let html = fs.readFileSync(dashboardHtmlPath, "utf8");
      const credits = `<div class="brand-credits" style="display:none"><a href="${app.locals.brand.developerSite}">${app.locals.brand.developer}</a><a href="${app.locals.brand.studioSite}">${app.locals.brand.studio}</a></div>`;
      const saasUser = req.session.saasUser || {
        id: "usr_owner",
        name: "Enterprise Admin",
        email: "admin@enterprise.local",
        company: "Acme Corp / Production",
        role: "Owner",
        plan: "Enterprise SLA",
      };
      html = html
        .replace(
          "</head>",
          `<script>window.__BRAND__ = ${JSON.stringify(app.locals.brand)}; window.__USER__ = ${JSON.stringify(saasUser)};</script></head>`,
        )
        .replace("</body>", `${credits}</body>`);
      return res.type("html").send(html);
    }
    return res.render("dashboard");
  }
  return res.redirect("/login");
});

app.get("/login", noStore, (req, res) => {
  if (isPanelSessionValid(req.session)) return res.redirect("/");
  if (!secrets.hasDashboardPassword() && store.countSaasUsers() === 0) return res.redirect("/setup");
  return res.render("login", { error: null, minLength: secrets.MIN_PASSWORD_LENGTH });
});

app.post("/login", (req, res, next) => {
  const peer = clientAddress(req);
  const retryAfter = blockedFor(peer);
  if (retryAfter) {
    res.set("Retry-After", String(retryAfter));
    return res.status(429).render("login", {
      error: "Too many attempts. Try again later.",
      minLength: secrets.MIN_PASSWORD_LENGTH,
    });
  }

  const { email, password } = req.body || {};
  let verifiedUser = null;

  if (email) {
    verifiedUser = store.verifySaasUserPassword(email, password);
  }

  const masterValid = secrets.hasDashboardPassword() && secrets.verifyDashboardPassword(password);

  if (!verifiedUser && !masterValid) {
    recordFailure(peer);
    logger.warn({ ip: peer }, "[dashboard] Failed login attempt");
    return res.status(401).render("login", {
      error: "Invalid email or password",
      minLength: secrets.MIN_PASSWORD_LENGTH,
    });
  }

  clearAttempts(peer);

  // A fresh id after login, or the id an attacker planted beforehand still works.
  req.session.regenerate((err) => {
    if (err) return next(err);
    stampPanelSession(req.session, verifiedUser);
    req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      res.redirect(303, "/");
    });
  });
});

app.get("/signup", noStore, (req, res) => {
  if (isPanelSessionValid(req.session)) return res.redirect("/");
  return res.render("signup", { error: null, minLength: secrets.MIN_PASSWORD_LENGTH });
});

app.post("/signup", (req, res, next) => {
  if (!secrets.hasDashboardPassword()) return res.redirect(303, "/setup");
  const peer = clientAddress(req);
  const { name, email, password, confirm, company } = req.body || {};

  if (confirm && password !== confirm) {
    return res.status(400).render("signup", {
      error: "The two passwords don't match.",
      minLength: secrets.MIN_PASSWORD_LENGTH,
    });
  }

  try {
    const user = store.createSaasUser({ name, email, password, company });
    clearAttempts(peer);
    req.session.regenerate((err) => {
      if (err) return next(err);
      stampPanelSession(req.session, user);
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.redirect(303, "/");
      });
    });
  } catch (err) {
    return res.status(400).render("signup", {
      error: err.message,
      minLength: secrets.MIN_PASSWORD_LENGTH,
    });
  }
});

// --- Password reset over WhatsApp -----------------------------------------
//
// For the operator who forgot the panel password. The code goes to the linked
// account's own WhatsApp chat; see src/panel/password-reset.cjs for why this
// is the recovery path that fits Levix. The offline fallback is still
// `levix reset-password` on the server.

app.post("/reset/request", async (req, res) => {
  if (!secrets.hasDashboardPassword()) {
    return res.status(400).json({ ok: false, reason: "no_password" });
  }
  const result = await requestResetCode(clientAddress(req));
  const status = { throttled: 429, no_session: 409, send_failed: 502 }[result.reason] ?? 200;
  if (result.ok) res.set("Cache-Control", "no-store");
  return res.status(status).json(result);
});

app.post("/reset/confirm", (req, res) => {
  if (!secrets.hasDashboardPassword()) {
    return res.status(400).json({ ok: false, reason: "no_password" });
  }
  const { code, password, confirm } = req.body || {};
  const result = completeReset(code, password, confirm);
  if (!result.ok) {
    // A wrong code counts toward the login lockout, so spraying guesses at
    // this door locks the same peer out of /login too.
    if (result.reason === "wrong_code" || result.reason === "too_many_attempts") {
      recordFailure(clientAddress(req));
    }
    return res.status(result.reason === "invalid_password" ? 400 : 401).json(result);
  }

  // The epoch moved: push every live panel session out before the browser
  // that reset the password signs back in.
  disconnectInvalidPanelSockets();
  res.set("Cache-Control", "no-store");
  return res.json({ ok: true });
});

const handleLogout = (req, res, next) => {
  const sid = req.sessionID;
  req.session.destroy((err) => {
    if (err) return next(err);
    disconnectSessionSockets(sid);
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    res.redirect(303, "/login");
  });
};

app.post("/logout", handleLogout);
app.get("/logout", handleLogout);

app.get("/qr", requireLoginPage, noStore, (req, res) => {
  const qr = getQrCode();
  res.render("qr", { qr: qr || "" });
});

// Unlink / restart / everything else live on the dashboard API
// (/dashboard/api/*), registered in src/index.js once the socket exists.

// The 404 and the error handler have to be registered after every route — put
// them here and they would swallow the routes index.js adds later.
function installFinalHandlers() {
  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error({ err, method: req.method, path: req.path }, "[http] Unhandled error");
    if (res.headersSent) return;
    res.status(err.statusCode || 500).json({ error: "Internal server error" });
  });
}

module.exports = {
  app,
  server,
  io,
  dashboardJson,
  requireLoginApi,
  requireLoginPage,
  noStore,
  installFinalHandlers,
  disconnectInvalidPanelSockets,
  disconnectSessionSockets,
};
