import assert from "node:assert/strict";

const baseUrl = process.env.PRESENCE_URL || "http://127.0.0.1:8788";
const socketUrl = baseUrl.replace(/^http/, "ws") + "/ws";
const runId = Date.now().toString(36);

function waitForStatus(socket, userId, status) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error(`Timed out waiting for ${userId} to become ${status}`));
    }, 10_000);

    function onMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      const user = message.type === "USERS_LIST"
        ? message.payload?.users?.find((candidate) => candidate.userId === userId)
        : null;
      if (user?.status !== status) return;

      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      resolve(message.payload);
    }

    socket.addEventListener("message", onMessage);
  });
}

if (typeof WebSocket !== "function") {
  throw new Error("The timeout test requires Node.js 22 or newer (global WebSocket support)");
}

const observerSocket = new WebSocket(socketUrl);
let targetSocket = null;
let heartbeatTimer = null;
try {
  await new Promise((resolve, reject) => {
    observerSocket.addEventListener("open", resolve, { once: true });
    observerSocket.addEventListener("error", () => reject(new Error("Could not open observer WebSocket")), { once: true });
  });

  const observerId = `timeout-observer-${runId}`;
  const observerActive = waitForStatus(observerSocket, observerId, "active");
  observerSocket.send(JSON.stringify({
    type: "REGISTER",
    payload: { userId: observerId, clientId: `timeout-observer-client-${runId}`, name: "Observer" }
  }));
  await observerActive;
  heartbeatTimer = setInterval(() => {
    observerSocket.send(JSON.stringify({
      type: "HEARTBEAT",
      payload: { clientId: `timeout-observer-client-${runId}` }
    }));
  }, 750);

  targetSocket = new WebSocket(socketUrl);
  await new Promise((resolve, reject) => {
    targetSocket.addEventListener("open", resolve, { once: true });
    targetSocket.addEventListener("error", () => reject(new Error("Could not open timeout-test WebSocket")), { once: true });
  });

  const userId = `timeout-${runId}`;
  const inactive = waitForStatus(observerSocket, userId, "inactive");
  targetSocket.send(JSON.stringify({
    type: "REGISTER",
    payload: { userId, clientId: `timeout-client-${runId}`, name: "Timeout Test" }
  }));
  const result = await inactive;
  assert.equal(result.users.find((user) => user.userId === userId)?.status, "inactive");
  assert.equal(result.users.find((user) => user.userId === observerId)?.status, "active");
  console.log("PASS stale heartbeat expires through a Durable Object alarm");
} finally {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  for (const socket of [targetSocket, observerSocket]) {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close();
    }
  }
}
