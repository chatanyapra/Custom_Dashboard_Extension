require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 3001,
  heartbeatTimeoutMs: Number(process.env.HEARTBEAT_TIMEOUT_MS) || 75000,
  pingIntervalMs: Number(process.env.PING_INTERVAL_MS) || 25000
};
