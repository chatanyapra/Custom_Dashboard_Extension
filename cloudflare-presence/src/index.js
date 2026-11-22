const ROOM_NAME = "team-presence";

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405, { allow: "GET" });
      }
      return jsonResponse({ status: "ok", service: "presence-server" });
    }

    if (url.pathname !== "/ws") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, { allow: "GET" });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return jsonResponse({ error: "WebSocket upgrade required" }, 426, {
        upgrade: "websocket"
      });
    }

    const roomId = env.PRESENCE_ROOM.idFromName(ROOM_NAME);
    return env.PRESENCE_ROOM.get(roomId).fetch(request);
  }
};

export { PresenceRoom } from "./presence-room.js";
