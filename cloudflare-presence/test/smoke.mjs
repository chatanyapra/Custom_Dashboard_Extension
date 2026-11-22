import assert from "node:assert/strict";

const baseUrl = process.env.PRESENCE_URL || "http://127.0.0.1:8787";
const socketUrl = baseUrl.replace(/^http/, "ws") + "/ws";
const runId = Date.now().toString(36);
const sockets = [];

if (typeof WebSocket !== "function") {
  throw new Error("The smoke test requires Node.js 22 or newer (global WebSocket support)");
}

function waitForUsers(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for a matching USERS_LIST message"));
    }, 8_000);

    function onMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type !== "USERS_LIST" || !predicate(message.payload)) return;
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      resolve(message.payload);
    }

    socket.addEventListener("message", onMessage);
  });
}

async function connect() {
  const socket = new WebSocket(socketUrl);
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out opening WebSocket")), 8_000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Could not open WebSocket"));
    }, { once: true });
  });
  return socket;
}

async function register(socket, userId, clientId, name) {
  const update = waitForUsers(socket, (payload) =>
    payload.users.some((user) => user.userId === userId && user.name === name)
  );
  socket.send(JSON.stringify({
    type: "REGISTER",
    payload: { userId, clientId, name }
  }));
  return update;
}

try {
  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    status: "ok",
    service: "presence-server"
  });
  assert.equal((await fetch(`${baseUrl}/health`, { method: "POST" })).status, 405);
  assert.equal((await fetch(`${baseUrl}/unknown`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/ws`)).status, 426);

  const adaId = `ada-${runId}`;
  const bobId = `bob-${runId}`;
  const ada1 = await connect();
  const firstList = await register(ada1, adaId, `install-ada-1-${runId}`, "Ada");
  assert.equal(firstList.users.find((user) => user.userId === adaId)?.status, "active");

  const bob = await connect();
  const bothUsers = waitForUsers(ada1, (payload) =>
    payload.users.some((user) => user.userId === bobId)
  );
  bob.send(JSON.stringify({
    type: "REGISTER",
    payload: { userId: bobId, clientId: `install-bob-${runId}`, name: "Bob" }
  }));
  await bothUsers;

  const ada2 = await connect();
  const aggregated = await register(ada2, adaId, `install-ada-2-${runId}`, "Ada");
  assert.equal(aggregated.users.filter((user) => user.userId === adaId).length, 1);
  assert.equal(aggregated.totalCount, aggregated.users.length);
  assert.equal(
    aggregated.activeCount,
    aggregated.users.filter((user) => user.status === "active").length
  );
  const firstInactive = aggregated.users.findIndex((user) => user.status === "inactive");
  const lastActive = aggregated.users.map((user) => user.status).lastIndexOf("active");
  assert.ok(firstInactive === -1 || lastActive < firstInactive, "active users must be listed first");

  const namePropagated = waitForUsers(ada1, (payload) =>
    payload.users.some((user) => user.userId === adaId && user.name === "Ada Updated")
  );
  await register(ada2, adaId, `install-ada-2-${runId}`, "Ada Updated");
  await namePropagated;

  ada1.close();
  const observer = await connect();
  const afterOneDisconnect = await register(
    observer,
    `observer-${runId}`,
    `install-observer-${runId}`,
    "Observer"
  );
  assert.equal(afterOneDisconnect.users.find((user) => user.userId === adaId)?.status, "active");

  const becomesInactive = waitForUsers(bob, (payload) =>
    payload.users.some((user) => user.userId === adaId && user.status === "inactive")
  );
  ada2.close();
  const inactiveList = await becomesInactive;
  assert.equal(inactiveList.users.find((user) => user.userId === adaId)?.status, "inactive");
  assert.equal(
    inactiveList.activeCount,
    inactiveList.users.filter((user) => user.status === "active").length
  );
  observer.close();

  console.log("PASS health, registration, broadcasts, aggregation, disconnect status, and counts");
} finally {
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }
}
