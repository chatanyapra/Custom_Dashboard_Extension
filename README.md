# New Tab Dashboard (Chrome Extension)

A Manifest V3 Chrome extension that replaces Chrome's New Tab page with a customizable dashboard and a lightweight real-time team presence system.

## Dashboard Features

- Editable username
- Live clock and date
- Dark and light themes
- Google search with URL detection and voice search
- Coding Questions with 3, 7, and 15-day review tracking
- Two independent To-Do lists
- Two Notes sections with autosave and word counts
- Custom bookmarks and shortcuts
- AI Tools
- Google Apps
- Bottom-dock popovers
- Real-time team presence

Existing dashboard data remains in `chrome.storage.local`; presence configuration and identity are stored separately in the same storage area.

## Presence Architecture

```text
New Tab page -> popup.js -> chrome.runtime messaging
                         -> background.js
                         -> one WebSocket per browser profile
                         -> Node.js Express + ws server
                         -> in-memory PresenceManager
                         -> broadcast to all extensions
```

- New Tab pages do not create WebSockets.
- `background.js` owns the only WebSocket connection per browser profile.
- Multiple New Tab pages receive presence updates through runtime messaging.
- Closing one tab does not disconnect presence.
- Browser focus, mouse activity, keyboard activity, and `chrome.idle` are not used.
- Minimized Chrome and Chrome running in another application remains Active.
- Closing all normal Chrome windows eventually makes the browser connection disappear.
- A stale heartbeat or unexpected network crash is detected by server-side timeouts.
- If the same `presenceUserId` is configured on multiple installations or connections, the server keeps one user entry and marks it Active while at least one connection is alive.

## Project Structure

```text
Custom_Extension/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── background.js
├── README.md
├── images/
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   └── src/
│       ├── config.js
│       ├── server.js
│       ├── websocket.js
│       └── presence-manager.js
└── new_design/
    ├── popup.css
    └── popup.js
```

`new_design/` is an older alternate implementation and is not loaded by the extension.

## Local Backend Setup

Requirements:

- Node.js 18 or newer
- Chrome or Chromium

Install and start the server:

```powershell
cd "C:\Web Development\Custom_Extension\server"
npm install
npm start
```

The server listens on `0.0.0.0:3001` by default.

Health check:

```text
http://localhost:3001/health
```

WebSocket endpoint:

```text
ws://localhost:3001/ws
```

Optional environment values can be copied from `.env.example`:

```text
PORT=3001
HEARTBEAT_TIMEOUT_MS=75000
PING_INTERVAL_MS=25000
```

Do not commit `.env`.

## Load the Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select `C:\Web Development\Custom_Extension`.
5. Open a new tab.

The presence panel initially shows `Loading presence…` or `Connecting`.

## Configure the WebSocket URL

The default local URL is `ws://localhost:3001/ws`.

Open the gear button in the Team Presence panel to configure:

- **Shared user ID:** optional. Use the same value on installations that represent the same person.
- **WebSocket URL:** use `ws://` locally or `wss://` for HTTPS/Render deployment.

Values are stored in `chrome.storage.local`:

- `clientId`: unique installation identity
- `presenceUserId`: shared/merged user identity
- `presenceWsUrl`: WebSocket endpoint
- `userName`: display name reused from the dashboard

The presence panel can also be reached through the existing top-bar username. Clicking the username opens the name editor, and name changes are re-registered with the server.

## WebSocket Protocol

Client registration:

```json
{
  "type": "REGISTER",
  "payload": {
    "userId": "chatanya",
    "clientId": "unique-installation-id",
    "name": "Chatanya"
  }
}
```

Client heartbeat:

```json
{
  "type": "HEARTBEAT",
  "payload": {
    "clientId": "unique-installation-id"
  }
}
```

Server user list:

```json
{
  "type": "USERS_LIST",
  "payload": {
    "users": [
      {
        "userId": "chatanya",
        "name": "Chatanya",
        "status": "active"
      }
    ],
    "activeCount": 1,
    "totalCount": 1
  }
}
```

The server also sends `REGISTERED` and `ERROR` messages.

## Deploy to Render

Create a Render Web Service from this repository.

Use:

```text
Root Directory: server
Build Command: npm install
Start Command: npm start
```

Set `PORT` automatically through Render. Optional variables:

```text
HEARTBEAT_TIMEOUT_MS=75000
PING_INTERVAL_MS=25000
```

After deployment, obtain the Render URL and configure the extension with:

```text
wss://YOUR-RENDER-DOMAIN.onrender.com/ws
```

Render free instances may spin down when idle. Regular client heartbeats keep a connected browser active, but a cold-starting server may briefly show the extension as disconnected. After restart, connected clients reconnect and register automatically.

## Testing Two or More Users

1. Start the backend.
2. Load the extension in a Chrome profile.
3. Set the username and open a New Tab page.
4. Confirm the user appears Active.
5. Open another New Tab page and confirm no duplicate entry appears.
6. Minimize Chrome and switch applications; it should remain Active.
7. Load the extension in a second Chrome profile or configure another installation with a different shared/user ID.
8. Confirm Active users are sorted first and counts match.
9. Close all normal windows in a profile and wait for heartbeat timeout; that user should become Inactive.
10. Restart or stop the backend and verify reconnect state, then restart and confirm the user registers again.

## Troubleshooting

- **Always Disconnected:** confirm the server is running and the configured URL includes `/ws`.
- **Local URL fails:** use `ws://localhost:3001/ws`. The browser profile must be on the same machine as the server.
- **Render URL fails:** use `wss://`, not `ws://`, and confirm the Render service is running.
- **Duplicate people:** configure the same `Shared user ID` for the intended person.
- **Duplicate client connections:** this is handled by server aggregation; New Tab pages must not add another connection.
- **User remains Active:** network shutdown is detected by stale timeout, not instantly. The default timeout is 75 seconds.
- **Server restarts:** presence state is reset because it is in memory. Clients reconnect and register again.
- **CSP or console errors:** reload the unpacked extension after changing `manifest.json`.

## Storage and Limitations

The presence server uses only an in-memory JavaScript `Map`. It has no database or persistent user records.

Known limitations:

- Server restart clears the current presence list.
- Presence is not guaranteed to be available during Render spin-down or provider downtime.
- Closing all browser windows is detected best-effort; unexpected crashes rely on heartbeat timeout.
- Client IDs and names are not authentication credentials and are intended for a trusted group.
