const STORAGE_DEFAULTS = {
  clientId: null,
  presenceUserId: null,
  presenceWsUrl: "ws://localhost:3001/ws",
  userName: "Devansh"
};

const HEARTBEAT_ALARM = "presence-heartbeat";
let socket = null;
let socketUrl = STORAGE_DEFAULTS.presenceWsUrl;
let reconnectTimer = null;
let reconnectAttempt = 0;
let connectionState = "disconnected";
let lastUsers = [];
let identity = null;

function randomId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

async function storageGet(values) {
  return chrome.storage.local.get(values);
}

async function storageSet(values) {
  await chrome.storage.local.set(values);
}

async function ensureIdentity() {
  if (identity) return identity;

  const saved = await storageGet(STORAGE_DEFAULTS);
  const clientId = typeof saved.clientId === "string" && saved.clientId
    ? saved.clientId
    : randomId();
  const presenceUserId = typeof saved.presenceUserId === "string" && saved.presenceUserId
    ? saved.presenceUserId
    : clientId;
  const userName = typeof saved.userName === "string" && saved.userName.trim()
    ? saved.userName.trim().slice(0, 30)
    : STORAGE_DEFAULTS.userName;
  socketUrl = typeof saved.presenceWsUrl === "string" && saved.presenceWsUrl.trim()
    ? saved.presenceWsUrl.trim()
    : STORAGE_DEFAULTS.presenceWsUrl;

  await storageSet({ clientId, presenceUserId, userName, presenceWsUrl: socketUrl });
  identity = { clientId, presenceUserId, userName };
  return identity;
}

function broadcastPresenceState(extra = {}) {
  const message = {
    type: "PRESENCE_STATE_CHANGED",
    payload: {
      connectionState,
      users: lastUsers,
      activeCount: lastUsers.filter((user) => user.status === "active").length,
      totalCount: lastUsers.length,
      ...extra
    }
  };
  chrome.runtime.sendMessage(message).catch(() => {});
}

function setConnectionState(state) {
  connectionState = state;
  broadcastPresenceState();
}

function sendJson(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

async function register() {
  const current = await ensureIdentity();
  sendJson({
    type: "REGISTER",
    payload: {
      userId: current.presenceUserId,
      clientId: current.clientId,
      name: current.userName
    }
  });
}

function heartbeat() {
  ensureIdentity().then((current) => {
    sendJson({
      type: "HEARTBEAT",
      payload: { clientId: current.clientId }
    });
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  setConnectionState("reconnecting");

  const base = 1000 * Math.pow(2, Math.min(reconnectAttempt, 5));
  const jitter = Math.floor(Math.random() * 500);
  reconnectAttempt += 1;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, base + jitter);
}

async function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  await ensureIdentity();
  setConnectionState(reconnectAttempt > 0 ? "reconnecting" : "connecting");

  let nextSocket;
  try {
    nextSocket = new WebSocket(socketUrl);
  } catch {
    scheduleReconnect();
    return;
  }

  socket = nextSocket;

  nextSocket.addEventListener("open", () => {
    reconnectAttempt = 0;
    setConnectionState("connected");
    register();
  });

  nextSocket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === "USERS_LIST" && message.payload) {
      const users = Array.isArray(message.payload.users) ? message.payload.users : [];
      lastUsers = users.slice().sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      broadcastPresenceState({
        activeCount: Number(message.payload.activeCount) || lastUsers.filter((u) => u.status === "active").length,
        totalCount: Number(message.payload.totalCount) || lastUsers.length
      });
    }
  });

  nextSocket.addEventListener("close", () => {
    if (socket === nextSocket) socket = null;
    setConnectionState("disconnected");
    scheduleReconnect();
  });

  nextSocket.addEventListener("error", () => {
    // close will schedule the reconnect; this handler prevents unhandled errors.
  });
}

async function updateName(name) {
  const safeName = typeof name === "string" && name.trim()
    ? name.trim().slice(0, 30)
    : "Devansh";
  await ensureIdentity();
  identity.userName = safeName;
  await storageSet({ userName: safeName });
  await register();
  broadcastPresenceState();
}

async function updateIdentity(payload = {}) {
  await ensureIdentity();
  const nextUrl = typeof payload.wsUrl === "string" ? payload.wsUrl.trim() : socketUrl;
  const nextUserId = typeof payload.userId === "string" ? payload.userId.trim().slice(0, 128) : identity?.presenceUserId;

  if (nextUrl) socketUrl = nextUrl;
  if (nextUserId) identity = { ...(identity || {}), presenceUserId: nextUserId };

  await storageSet({
    presenceWsUrl: socketUrl,
    ...(nextUserId ? { presenceUserId: nextUserId } : {})
  });

  reconnectAttempt = 0;
  if (socket) {
    const oldSocket = socket;
    socket = null;
    oldSocket.close();
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connect();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  if (message.type === "PRESENCE_GET_STATE") {
    ensureIdentity().then(() => {
      sendResponse({
        type: "PRESENCE_STATE",
        payload: {
          connectionState,
          users: lastUsers,
          activeCount: lastUsers.filter((user) => user.status === "active").length,
          totalCount: lastUsers.length
        }
      });
    });
    return true;
  }

  if (message.type === "PRESENCE_UPDATE_NAME") {
    updateName(message.payload?.name).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "PRESENCE_UPDATE_CONFIG") {
    updateIdentity(message.payload).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.34 });
  ensureIdentity().then(connect);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.34 });
  ensureIdentity().then(connect);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return;
  if (!socket || socket.readyState !== WebSocket.OPEN) connect();
  else heartbeat();
});

ensureIdentity().then(() => {
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.34 });
  connect();
});
