# New Tab Dashboard (Chrome Extension)

A Manifest V3 Chrome extension that replaces the New Tab page with a modern 3-column dashboard:

- Clock + date header
- Theme toggle (dark/light)
- AI tools shortcuts
- To-do list (add/complete/delete)
- Google search with URL detection + optional voice input
- Google apps grid
- Bookmarks manager (add/open/delete via right-click or long-press)
- Notes with autosave + word count
- Weather widget (static by default, optional OpenWeatherMap integration)

All user data persists via `chrome.storage.local`.

## Install / Load Unpacked

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select this folder:

`c:\Web Development\Custom_Extension`

Open a new tab to see the dashboard.

## Optional: Live Weather

The weather widget is static by default.

To enable live weather, set these values in Chrome storage (advanced users):

- `weather.apiKey`: your OpenWeatherMap API key
- `weather.city`: e.g. `Mumbai` or `New York`

Notes:
- The API key is **not** included in this project.
- If the API is unreachable or misconfigured, the widget falls back to static weather.

## Project Files

- `manifest.json` – MV3 manifest (new tab override, storage permission)
- `popup.html` – dashboard markup (used as the new tab page)
- `popup.css` – all styling (glassmorphism, responsive)
- `popup.js` – functionality + persistence via Chrome Storage API
- `images/` – reserved for icons/assets
