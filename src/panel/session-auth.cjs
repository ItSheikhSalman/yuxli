// Panel session validity. Supports both SaaS multi-user sessions and master password sessions.

const secrets = require("../config/secrets.cjs");
const store = require("../db/store.cjs");

function isPanelSessionValid(session) {
  if (!session?.loggedIn) return false;
  if (session?.saasUserId) {
    const user = store.getSaasUserById(session.saasUserId);
    return Boolean(user);
  }
  if (!secrets.hasDashboardPassword()) return false;
  return session.passwordUpdatedAt === secrets.getPasswordUpdatedAt();
}

function stampPanelSession(session, user = null) {
  session.loggedIn = true;
  if (user) {
    session.saasUserId = user.id;
    session.saasUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      company: user.company,
      role: user.role,
      plan: user.plan || "Enterprise Pro",
    };
  } else {
    session.passwordUpdatedAt = secrets.getPasswordUpdatedAt();
  }
}

module.exports = { isPanelSessionValid, stampPanelSession };
