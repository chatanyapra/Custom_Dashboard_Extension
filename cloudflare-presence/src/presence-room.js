import { DurableObject } from "cloudflare:workers";

const USERS_KEY = "known-users";
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 75_000;
const MAX_MESSAGE_BYTES = 4_096;
const VALID_CLOSE_CODES = new Set([1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011]);

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function parseMessage(message) {
  if (typeof message !== "string" || byteLength(message) > MAX_MESSAGE_BYTES) {
    return null;
  }

  try {
    const parsed = JSON.parse(message);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizedString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isValidIdentity(value) {
  return value.length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}

function closeSocket(socket, code, reason) {
  const closeCode = VALID_CLOSE_CODES.has(code) || (code >= 3000 && code <= 4999) ? code : 1000;
  if (socket.readyState === WebSocket.CLOSED) return;
  socket.close(closeCode, reason.slice(0, 120));
}

export class PresenceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    const configuredTimeout = Number(env.HEARTBEAT_TIMEOUT_MS);
    this.heartbeatTimeoutMs = Number.isSafeInteger(configuredTimeout) && configuredTimeout >= 1_000
      ? configuredTimeout
      : DEFAULT_HEARTBEAT_TIMEOUT_MS;
    this.lastBroadcast = "";
  }

  async fetch(request) {
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", {
        status: 426,
        headers: { upgrade: "websocket" }
      });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const connectedAt = Date.now();

    server.serializeAttachment({
      registered: false,
      connectedAt,
      lastHeartbeatAt: connectedAt
    });
    this.ctx.acceptWebSocket(server);
    await this.scheduleNextAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, rawMessage) {
    const message = parseMessage(rawMessage);
    if (!message || typeof message.type !== "string") {
      this.sendError(socket, "Malformed or oversized message");
      return;
    }

    if (message.type === "REGISTER") {
      await this.register(socket, message.payload);
      return;
    }

    if (message.type === "HEARTBEAT") {
      this.handleHeartbeat(socket, message.payload);
      return;
    }

    this.sendError(socket, "Unknown message type");
  }

  async webSocketClose(socket, code, reason) {
    const metadata = socket.deserializeAttachment() || {};
    metadata.closed = true;
    socket.serializeAttachment(metadata);
    if (metadata.registered) {
      await this.broadcastUsers();
    }
    await this.scheduleNextAlarm();

    if (code !== 1006) {
      closeSocket(socket, code, reason || "");
    } else {
      closeSocket(socket, 1000, "");
    }
  }

  async webSocketError(socket) {
    const metadata = socket.deserializeAttachment() || {};
    if (!metadata.closed) {
      metadata.closed = true;
      socket.serializeAttachment(metadata);
      if (metadata.registered) await this.broadcastUsers();
    }
    closeSocket(socket, 1011, "WebSocket error");
    await this.scheduleNextAlarm();
  }

  async alarm() {
    const now = Date.now();
    let presenceChanged = false;

    for (const socket of this.ctx.getWebSockets()) {
      const metadata = socket.deserializeAttachment() || {};
      if (metadata.closed) continue;

      const lastSeenAt = metadata.registered
        ? metadata.lastHeartbeatAt
        : metadata.connectedAt;
      if (now - lastSeenAt < this.heartbeatTimeoutMs) continue;

      metadata.closed = true;
      socket.serializeAttachment(metadata);
      presenceChanged ||= Boolean(metadata.registered);
      closeSocket(socket, 4000, "Presence heartbeat timed out");
    }

    if (presenceChanged) await this.broadcastUsers();
    await this.scheduleNextAlarm();
  }

  async register(socket, payload) {
    const userId = normalizedString(payload?.userId, 128);
    const clientId = normalizedString(payload?.clientId, 128);
    const name = normalizedString(payload?.name, 30) || "Unknown";

    if (!userId || !clientId || !isValidIdentity(userId) || !isValidIdentity(clientId)) {
      this.sendError(socket, "REGISTER requires valid userId and clientId");
      return;
    }

    const metadata = socket.deserializeAttachment() || {};
    metadata.registered = true;
    metadata.userId = userId;
    metadata.clientId = clientId;
    metadata.name = name;
    metadata.lastHeartbeatAt = Date.now();
    metadata.closed = false;
    socket.serializeAttachment(metadata);

    const knownUsers = await this.loadKnownUsers();
    const previous = knownUsers.find((user) => user.userId === userId);
    if (!previous || previous.name !== name) {
      const updatedUsers = [
        ...knownUsers.filter((user) => user.userId !== userId),
        { userId, name }
      ];
      await this.ctx.storage.put(USERS_KEY, updatedUsers);
    }

    for (const existingSocket of this.ctx.getWebSockets()) {
      const existing = existingSocket.deserializeAttachment() || {};
      if (existing.userId === userId && !existing.closed && existing.name !== name) {
        existing.name = name;
        existingSocket.serializeAttachment(existing);
      }
    }

    this.send(socket, { type: "REGISTERED", payload: { userId, clientId } });
    await this.broadcastUsers(socket);
    await this.scheduleNextAlarm();
  }

  handleHeartbeat(socket, payload) {
    const metadata = socket.deserializeAttachment() || {};
    const clientId = normalizedString(payload?.clientId, 128);
    if (!metadata.registered || metadata.closed || clientId !== metadata.clientId) {
      this.sendError(socket, "Register this client before sending heartbeats");
      return;
    }

    metadata.lastHeartbeatAt = Date.now();
    socket.serializeAttachment(metadata);
  }

  async broadcastUsers(forceSocket = null) {
    const users = await this.buildUserList(Date.now());
    const serialized = JSON.stringify({
      type: "USERS_LIST",
      payload: {
        users,
        activeCount: users.filter((user) => user.status === "active").length,
        totalCount: users.length
      }
    });

    if (serialized === this.lastBroadcast) {
      if (forceSocket) this.sendRaw(forceSocket, serialized);
      return;
    }
    this.lastBroadcast = serialized;

    for (const socket of this.ctx.getWebSockets()) {
      const metadata = socket.deserializeAttachment() || {};
      if (!metadata.closed) this.sendRaw(socket, serialized);
    }
  }

  async buildUserList(now) {
    const knownUsers = await this.loadKnownUsers();
    const activeUsers = new Map();

    for (const socket of this.ctx.getWebSockets()) {
      const metadata = socket.deserializeAttachment() || {};
      if (
        !metadata.registered ||
        metadata.closed ||
        now - metadata.lastHeartbeatAt >= this.heartbeatTimeoutMs
      ) {
        continue;
      }

      activeUsers.set(metadata.userId, metadata.name);
    }

    return knownUsers
      .map((user) => ({
        userId: user.userId,
        name: activeUsers.get(user.userId) || user.name,
        status: activeUsers.has(user.userId) ? "active" : "inactive"
      }))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  async loadKnownUsers() {
    const storedUsers = await this.ctx.storage.get(USERS_KEY);
    if (Array.isArray(storedUsers)) return storedUsers;
    if (!storedUsers || typeof storedUsers !== "object") return [];

    const migratedUsers = Object.values(storedUsers)
      .filter((user) => user && typeof user.userId === "string" && typeof user.name === "string");
    await this.ctx.storage.put(USERS_KEY, migratedUsers);
    return migratedUsers;
  }

  async scheduleNextAlarm() {
    let nextExpiry = Infinity;

    for (const socket of this.ctx.getWebSockets()) {
      const metadata = socket.deserializeAttachment() || {};
      if (metadata.closed) continue;
      const lastSeenAt = metadata.registered
        ? metadata.lastHeartbeatAt
        : metadata.connectedAt;
      if (typeof lastSeenAt === "number") {
        nextExpiry = Math.min(lastSeenAt + this.heartbeatTimeoutMs, nextExpiry);
      }
    }

    const currentAlarm = await this.ctx.storage.getAlarm();
    if (nextExpiry === Infinity) {
      if (currentAlarm !== null) await this.ctx.storage.deleteAlarm();
      return;
    }

    if (currentAlarm === null || currentAlarm > nextExpiry) {
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 1_000, nextExpiry));
    }
  }

  sendError(socket, message) {
    this.send(socket, { type: "ERROR", payload: { message } });
  }

  send(socket, message) {
    this.sendRaw(socket, JSON.stringify(message));
  }

  sendRaw(socket, serialized) {
    if (socket.readyState === WebSocket.OPEN) socket.send(serialized);
  }
}
