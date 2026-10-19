// file: src/services/integrations/ahm7/index.cjs
//
// AHM7 x MAKKI Integration Layer Entry Point

const config = require("./config.cjs");
const errors = require("./errors.cjs");
const health = require("./health.cjs");
const media = require("./media.cjs");
const registry = require("./registry.cjs");
const client = require("./client.cjs");

// Adapters
const speechster = require("./adapters/speechsterAdapter.cjs");
const pixelster = require("./adapters/pixelsterAdapter.cjs");
const visionChat = require("./adapters/visionChatAdapter.cjs");
const transcribe = require("./adapters/transcribeAdapter.cjs");

module.exports = {
  config,
  errors,
  health,
  media,
  registry,
  client,
  adapters: {
    speechster,
    pixelster,
    visionChat,
    transcribe,
  },
};
