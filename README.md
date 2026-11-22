# New Tab Dashboard (Chrome Extension)

A Manifest V3 extension that replaces Chrome's New Tab page with a customizable dashboard and a real-time team presence panel.

## Dashboard Features

- Editable username; clock and date
- Dark and light themes
- Google search with URL detection and voice search
- Coding Questions with 3, 7, and 15-day review tracking
- Two independent To-Do lists and two Notes sections
- Bookmarks and custom shortcuts
- AI Tools and Google Apps
- Bottom-dock popovers
- Real-time team presence with connection state and active/inactive counts

Existing dashboard data remains in `chrome.storage.local`. The `new_design/` directory is an unused alternate implementation and is not changed.

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
├── cloudflare-presence/
│   ├── package.json
│   ├── wrangler.jsonc
│   ├── .gitignore
│   └── src/
│       ├── index.js
│       └── presence-room.js
├── server/                    # Legacy Node.js backend; retained, not used by Cloudflare setup
└── new_design/                # Unused alternate UI
```

## Presence Architecture

```text
New Tab page -> popup.js -> chrome.runtime messaging
                         -> background.js (one WebSocket per Chrome profile)
                         -> Cloudflare Worker (/ws)
                         -> one named Durable Object room
                         -> broadcasts to connected extension profiles
```

- Only `background.js` opens and manages the WebSocket; New Tab pages communicate with it through runtime messaging.
- Each extension installation has a stable `clientId`. The configurable `presenceUserId` lets multiple installations represent one person.
- Presence means browser availability. Minimized Chrome and switching applications remain Active; no idle, focus, mouse, or keyboard monitoring is used.
- The Durable Object uses the WebSocket Hibernation API and per-socket attachments to restore active connection details after hibernation.
- A Durable Object alarm detects expired application heartbeats without a continuously running interval. Hibernatable sockets remain connected while the Durable Object is idle.
- Known display names are retained in Durable Object storage, while the dashboard lists only active users. No external database, login, or authentication is used.
- The WebSocket heartbeat helps keep the Manifest V3 service worker alive and detects stale connections; it is not a Cloudflare protocol ping.

## Local Cloudflare Development

Requirements: Node.js 22+ for the installed Wrangler version and automated tests, and a Cloudflare account for deployment (local development does not require login).

```powershell
cd "C:\Web Development\Custom_Extension\cloudflare-presence"
npm install
npm run dev
```

Local endpoints:

```text
Health:    http://localhost:8787/health
WebSocket: ws://localhost:8787/ws
```

The first local run initializes Wrangler's local Durable Object state under `.wrangler/`. Local development verifies protocol behavior; production hibernation behavior is provided by Cloudflare's runtime.

The configured heartbeat timeout is `HEARTBEAT_TIMEOUT_MS=75000` (75 seconds). For a fast local alarm-path check, use a second terminal:

```powershell
npm run dev:timeout
npm run test:timeout
```

The regular smoke test covers registration, broadcast, same-user aggregation, name updates, counts, and disconnect status:

```powershell
npm run test:smoke
```

The smoke scripts leave inactive test-user names in Wrangler's local Durable Object state, matching production's inactive-user behavior.

## Deploy to Cloudflare Workers

1. Create/sign in to a Cloudflare account and enable a `workers.dev` subdomain.
2. In a terminal, run:

```powershell
cd "C:\Web Development\Custom_Extension\cloudflare-presence"
npm install
npx wrangler login
npm run deploy
```

Wrangler creates the SQLite-backed `PresenceRoom` Durable Object using the `v1` migration in `wrangler.jsonc`. Deployment must be authorized from the developer's terminal; it is not performed automatically.

The production hostname is based on the configured Worker name and your Cloudflare subdomain, for example:

```text
Health:    https://custom-extension-presence.YOUR-SUBDOMAIN.workers.dev/health
WebSocket: wss://custom-extension-presence.YOUR-SUBDOMAIN.workers.dev/ws
```

Use the exact hostname printed by Wrangler. Confirm `/health` returns:

```json
{"status":"ok","service":"presence-server"}
```

## Configure Chrome

1. Open `chrome://extensions`, enable Developer mode, and select **Load unpacked**.
2. Choose `C:\Web Development\Custom_Extension`.
3. Open a New Tab and use the gear button in **Team Presence**.
4. The WebSocket URL defaults to `wss://custom-extension-presence.cp-custom-extension.workers.dev/ws`. Change it only if using a different deployment or local development server.
5. Optionally enter a **Shared user ID**. Use the same ID on multiple installations for one person's aggregated presence; different people should use different IDs.
6. Click **Connect**. The existing dashboard username is used as the display name.

The extension connects to the production WebSocket by default. For local development, enter `ws://localhost:8787/ws` in the presence settings. The old `ws://localhost:3001/ws` default and the previous mistyped production hostname are automatically updated to the production URL. Other explicitly configured URLs are preserved. The manifest still permits the legacy local Node endpoint and `*.onrender.com` during migration. Reload the unpacked extension after manifest changes.

## Test Multiple Users

1. Start `npm run dev`, then configure the extension with `ws://localhost:8787/ws`.
2. Confirm one user appears Active.
3. Open several New Tab pages in that profile; there should still be one browser-profile connection/user.
4. Load the extension in a second Chrome profile and set a different name/ID. Confirm both users appear and counts update without refresh.
5. Minimize Chrome or switch applications; presence should remain Active.
6. Close all normal Chrome windows in that profile. The extension closes its WebSocket and the user becomes Inactive; if the network is disconnected or the connection is lost without a close notification, the server-side heartbeat timeout is nominally 75 seconds.
7. Reopen Chrome or restore the network and confirm automatic reconnect/registration.
8. For deployment verification, repeat against the deployed `wss://...workers.dev/ws` URL.

## Legacy Node Backend

The prior Express/`ws` backend remains in `server/` so it is not removed before the Cloudflare backend is verified. It is not used by the Cloudflare configuration. The old local URL `ws://localhost:3001/ws` is supported only if a user explicitly configures it; local development should now use Wrangler on port `8787`.

## Troubleshooting and Limits

- **Disconnected locally:** ensure `npm run dev` is running and configure `ws://localhost:8787/ws`.
- **Disconnected in production:** use the exact Wrangler hostname and `wss://`, ending in `/ws`; confirm `/health` responds.
- **Connection blocked by CSP:** this extension permits local port `8787` and `*.workers.dev` WebSocket endpoints. Reload the extension after changing its manifest.
- **Users do not merge:** set the same Shared user ID on those installations.
- **User remains Active briefly after disconnect:** detection is not instantaneous; allow up to the heartbeat timeout plus alarm scheduling delay.
- **After a deployment/restart:** clients reconnect and register again. User display names remain in the Durable Object's internal storage.
- Cloudflare plan limits, execution/billing policies, and `workers.dev` availability may change; verify current Cloudflare limits for your account. This setup does not guarantee uninterrupted availability.
- Client IDs and display names are identifiers, not authentication. Use this prototype only with a trusted group.
