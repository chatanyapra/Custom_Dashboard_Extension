const { WebSocket } = require("ws");

function createConnectionId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function sendJson(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function attachWebSocketServer(httpServer, presenceManager, options = {}) {
  const WebSocketServer = require("ws").Server;
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const heartbeatTimeoutMs = options.heartbeatTimeoutMs || 75000;
  const pingIntervalMs = options.pingIntervalMs || 25000;

  let pingInterval = null;

  function broadcastUsers() {
    const users = presenceManager.getUsers();
    const activeCount = users.filter((user) => user.status === "active").length;
    const payload = {
      type: "USERS_LIST",
      payload: { users, activeCount, totalCount: users.length }
    };
    const serialized = JSON.stringify(payload);

    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(serialized);
    }
  }

  wss.on("connection", (ws) => {
    const connectionId = createConnectionId();
    ws.connectionId = connectionId;
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      const message = safeParse(raw);
      if (!message || typeof message.type !== "string") {
        sendJson(ws, { type: "ERROR", payload: { message: "Malformed message" } });
        return;
      }

      if (message.type === "REGISTER") {
        const payload = message.payload || {};
        const userId = typeof payload.userId === "string" ? payload.userId : "";
        const clientId = typeof payload.clientId === "string" ? payload.clientId : "";
        const name = typeof payload.name === "string" ? payload.name : "";

        if (!userId || !clientId) {
          sendJson(ws, { type: "ERROR", payload: { message: "REGISTER requires userId and clientId" } });
          return;
        }

        presenceManager.register(connectionId, ws, userId, clientId, name);
        ws.registeredUserId = userId;
        sendJson(ws, { type: "REGISTERED", payload: { connectionId } });
        broadcastUsers();
        return;
      }

      if (message.type === "HEARTBEAT") {
        const payload = message.payload || {};
        const clientId = typeof payload.clientId === "string" ? payload.clientId : "";
        if (!ws.registeredUserId) {
          sendJson(ws, { type: "ERROR", payload: { message: "Client must register first" } });
          return;
        }
        presenceManager.heartbeat(connectionId, clientId);
        return;
      }

      sendJson(ws, { type: "ERROR", payload: { message: "Unknown message type" } });
    });

    ws.on("close", () => {
      const removedUserId = presenceManager.removeConnection(connectionId);
      if (removedUserId) broadcastUsers();
    });

    ws.on("error", () => {});
  });

  pingInterval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }

    const expired = presenceManager.expireStaleConnections(heartbeatTimeoutMs);
    if (expired.length > 0) broadcastUsers();
  }, pingIntervalMs);

  return {
    wss,
    broadcastUsers,
    close: () => {
      if (pingInterval) clearInterval(pingInterval);
      for (const client of wss.clients) client.terminate();
      wss.close();
    }
  };
}

module.exports = { attachWebSocketServer };
