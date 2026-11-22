const http = require("http");
const express = require("express");
const config = require("./config");
const PresenceManager = require("./presence-manager");
const { attachWebSocketServer } = require("./websocket");

const app = express();
app.disable("x-powered-by");

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "presence-server" });
});

const server = http.createServer(app);
const presenceManager = new PresenceManager();
const socketServer = attachWebSocketServer(server, presenceManager, {
  heartbeatTimeoutMs: config.heartbeatTimeoutMs,
  pingIntervalMs: config.pingIntervalMs
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Presence server listening on port ${config.port}`);
});

function shutdown() {
  socketServer.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
