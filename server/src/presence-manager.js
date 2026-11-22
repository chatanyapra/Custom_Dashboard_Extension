class PresenceManager {
  constructor() {
    this.users = new Map();
  }

  register(connectionId, ws, userId, clientId, name) {
    const safeUserId = this.normalizeIdentity(userId);
    const safeName = this.normalizeName(name);
    let user = this.users.get(safeUserId);

    if (!user) {
      user = {
        userId: safeUserId,
        name: safeName,
        connections: new Map(),
        status: "active",
        lastHeartbeat: Date.now()
      };
      this.users.set(safeUserId, user);
    } else {
      user.name = safeName;
      user.status = "active";
      user.lastHeartbeat = Date.now();
    }

    user.connections.set(connectionId, {
      clientId,
      ws,
      lastHeartbeat: Date.now()
    });

    return user;
  }

  heartbeat(connectionId, clientId) {
    for (const user of this.users.values()) {
      const connection = user.connections.get(connectionId);
      if (connection) {
        connection.lastHeartbeat = Date.now();
        user.lastHeartbeat = Date.now();
        user.status = "active";
        if (clientId) connection.clientId = clientId;
        return user;
      }
    }
    return null;
  }

  removeConnection(connectionId) {
    for (const [userId, user] of this.users.entries()) {
      if (!user.connections.delete(connectionId)) continue;

      if (user.connections.size === 0) {
        user.status = "inactive";
        user.lastHeartbeat = Date.now();
      }
      return userId;
    }
    return null;
  }

  expireStaleConnections(timeoutMs, now = Date.now()) {
    const expired = [];
    for (const [userId, user] of this.users.entries()) {
      for (const [connectionId, connection] of user.connections.entries()) {
        if (now - connection.lastHeartbeat > timeoutMs) {
          user.connections.delete(connectionId);
          expired.push({ userId, connectionId });
        }
      }

      if (user.connections.size === 0) {
        user.status = "inactive";
        user.lastHeartbeat = now;
      }
    }
    return expired;
  }

  getUsers() {
    return Array.from(this.users.values())
      .map((user) => ({
        userId: user.userId,
        name: user.name,
        status: user.status
      }))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  normalizeIdentity(value) {
    const normalized = String(value || "").trim().slice(0, 128);
    return normalized || "anonymous";
  }

  normalizeName(value) {
    const normalized = String(value || "").trim().slice(0, 30);
    return normalized || "Unknown";
  }
}

module.exports = PresenceManager;
