# Presence Server

Node.js/Express/`ws` server for the Custom New Tab Dashboard.

## Run Locally

```powershell
cd "C:\Web Development\Custom_Extension\server"
npm install
npm start
```

The server listens on `0.0.0.0` using `process.env.PORT`, with a default of port `3001`.

## Endpoints

- `GET /health` - returns `{ "status": "ok", "service": "presence-server" }`
- `WS /ws` - presence WebSocket endpoint

## Environment

Copy `.env.example` to `.env` for local overrides:

```text
PORT=3001
HEARTBEAT_TIMEOUT_MS=75000
PING_INTERVAL_MS=25000
```

Never commit `.env`.

## Render

```text
Root Directory: server
Build Command: npm install
Start Command: npm start
```

Configure the extension to use `wss://YOUR-RENDER-DOMAIN.onrender.com/ws`.

Presence is held in memory and is cleared whenever the server restarts.
