const STORAGE_KEYS = {
    theme: "theme",
    userName: "userName",
    presenceUserId: "presenceUserId",
    presenceWsUrl: "presenceWsUrl",
    collapsed: "collapsed",
    todos: "todos",
    todos2: "todos2",
    bookmarks: "bookmarks",
    notes: "notes",
    notes2: "notes2",
    codingQuestions: "codingQuestions",
    shortcuts: "shortcuts"
};

const DEFAULTS = {
    theme: "dark",
    userName: "Devansh",
    presenceUserId: "",
    presenceWsUrl: "ws://localhost:3001/ws",
    collapsed: {
        aiTools: false,
        todos: false,
        todos2: false,
        search: false,
        apps: false,
        bookmarks: false,
        notes: false,
        notes2: false,
        codingQuestions: false,
        shortcuts: false
    },
    todos: [],
    todos2: [],
    bookmarks: null,
    notes: "",
    notes2: "",
    codingQuestions: [],
    shortcuts: []
};

const AI_TOOLS = [
    { name: "DeepSeek", icon: "fa-solid fa-brain", url: "https://chat.deepseek.com/" },
    { name: "ChatGPT", icon: "fa-solid fa-comment-dots", url: "https://chat.openai.com/" },
    { name: "Gemini", icon: "fa-solid fa-gem", url: "https://gemini.google.com/" },
    { name: "Claude", icon: "fa-solid fa-feather", url: "https://claude.ai/" },
    { name: "Copilot", icon: "fa-brands fa-microsoft", url: "https://copilot.microsoft.com/" },
    { name: "Perplexity", icon: "fa-solid fa-magnifying-glass-plus", url: "https://www.perplexity.ai/" },
    { name: "Google AI Studio", icon: "fa-solid fa-flask", url: "https://aistudio.google.com/" },
    { name: "Meta AI", icon: "fa-brands fa-meta", url: "https://www.meta.ai/" },
    { name: "Grok", icon: "fa-solid fa-bolt", url: "https://grok.com/" },
    { name: "Cursor", icon: "fa-solid fa-i-cursor", url: "https://www.cursor.com/" },
    { name: "Codeium", icon: "fa-solid fa-code", url: "https://codeium.com/" },
    { name: "Replit", icon: "fa-solid fa-terminal", url: "https://replit.com/" },
    { name: "Phind", icon: "fa-solid fa-magnifying-glass", url: "https://www.phind.com/" },
    { name: "Sourcegraph Cody", icon: "fa-solid fa-diagram-project", url: "https://sourcegraph.com/cody" },
    { name: "Amazon Q", icon: "fa-brands fa-aws", url: "https://aws.amazon.com/q/developer/" },
    { name: "Tabnine", icon: "fa-solid fa-robot", url: "https://www.tabnine.com/" }
];

const GOOGLE_APPS = [
    { name: "Gmail", icon: "fa-solid fa-envelope", url: "https://mail.google.com/" },
    { name: "Drive", icon: "fa-brands fa-google-drive", url: "https://drive.google.com/" },
    { name: "Calendar", icon: "fa-solid fa-calendar-days", url: "https://calendar.google.com/" },
    { name: "Photos", icon: "fa-solid fa-image", url: "https://photos.google.com/" },
    { name: "Maps", icon: "fa-solid fa-map-location-dot", url: "https://maps.google.com/" },
    { name: "Translate", icon: "fa-solid fa-language", url: "https://translate.google.com/" },
    { name: "Keep", icon: "fa-solid fa-note-sticky", url: "https://keep.google.com/" },
    { name: "Meet", icon: "fa-solid fa-video", url: "https://meet.google.com/" }
];

function $(id) {
    return document.getElementById(id);
}

function safeNowIso() {
    try {
        return new Date().toISOString();
    } catch {
        return "";
    }
}

function createId(prefix) {
    if (globalThis.crypto?.randomUUID) {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function isNonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0;
}

function debounce(fn, waitMs) {
    let t = null;
    return (...args) => {
        if (t) window.clearTimeout(t);
        t = window.setTimeout(() => fn(...args), waitMs);
    };
}

function toast(message, type = "success") {
    const area = $("toastArea");
    if (!area) return;

    const el = document.createElement("div");
    el.className = `toast toast--${type}`;

    const icon = document.createElement("div");
    icon.className = "toast__icon";
    icon.innerHTML =
        type === "error"
            ? '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>'
            : type === "warn"
                ? '<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>'
                : '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>';

    const msg = document.createElement("div");
    msg.className = "toast__msg";
    msg.textContent = message;

    const close = document.createElement("button");
    close.className = "icon-btn toast__close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

    close.addEventListener("click", () => {
        el.remove();
    });

    el.append(icon, msg, close);
    area.appendChild(el);

    window.setTimeout(() => {
        el.remove();
    }, 3200);
}

function showLoading(show) {
    const el = $("loading");
    if (!el) return;
    if (show) {
        el.hidden = false;
        el.classList.remove("is-hidden");
    } else {
        el.classList.add("is-hidden");
        window.setTimeout(() => {
            el.hidden = true;
        }, 260);
    }
}

async function storageGet(keysObjWithDefaults) {
    try {
        const result = await chrome.storage.local.get(keysObjWithDefaults);
        return result;
    } catch (e) {
        console.error("storageGet failed", e);
        toast("Storage read failed", "error");
        return { ...keysObjWithDefaults };
    }
}

async function storageSet(obj) {
    try {
        await chrome.storage.local.set(obj);
        return true;
    } catch (e) {
        console.error("storageSet failed", e);
        toast("Storage write failed", "error");
        return false;
    }
}

function openInNewTab(url) {
    try {
        const safe = normalizeUrlForNavigation(url);
        if (!safe) {
            toast("Blocked unsafe URL", "error");
            return;
        }
        window.open(safe, "_blank", "noopener,noreferrer");
    } catch (e) {
        console.error("openInNewTab failed", e);
        toast("Could not open link", "error");
    }
}

function formatClockParts(now) {
    const timeFmt = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });

    const dateFmt = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "2-digit",
        year: "numeric"
    });

    return {
        time: timeFmt.format(now),
        date: dateFmt.format(now)
    };
}

function startClock() {
    const timeEl = $("clockTime");
    const dateEl = $("clockDate");

    const tick = () => {
        const now = new Date();
        const parts = formatClockParts(now);
        if (timeEl) timeEl.textContent = parts.time;
        if (dateEl) dateEl.textContent = parts.date;
    };

    tick();
    window.setInterval(tick, 1000);
}

function setTheme(theme) {
    const root = document.documentElement;
    const icon = $("themeToggleIcon");

    root.setAttribute("data-theme", theme);

    if (icon) {
        icon.className = theme === "light" ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }
}

function normalizeUserName(name) {
    const n = String(name ?? "").trim();
    if (!n) return DEFAULTS.userName;
    return n.slice(0, 30);
}

function setUserName(name) {
    const el = $("userName");
    const safe = normalizeUserName(name);
    if (el) el.textContent = safe;
    return safe;
}

function getPresenceCountText(activeCount, totalCount) {
    return `${Number(activeCount) || 0} / ${Number(totalCount) || 0}`;
}

function setPresenceConnectionState(connectionState) {
    const indicator = $("presenceConnection");
    const text = $("presenceConnectionText");
    if (!indicator || !text) return;

    indicator.className = "presence-connection";
    if (connectionState === "connected") {
        indicator.classList.add("is-connected");
        text.textContent = "Connected";
    } else if (connectionState === "reconnecting") {
        indicator.classList.add("is-reconnecting");
        text.textContent = "Reconnecting";
    } else if (connectionState === "connecting") {
        indicator.classList.add("is-loading");
        text.textContent = "Connecting";
    } else {
        indicator.classList.add("is-disconnected");
        text.textContent = "Disconnected";
    }
}

function renderPresence(payload = {}) {
    const list = $("presenceList");
    const count = $("presenceCount");
    if (!list) return;

    const users = Array.isArray(payload.users) ? payload.users : [];
    users.sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
    });

    const activeCount = typeof payload.activeCount === "number"
        ? payload.activeCount
        : users.filter((user) => user.status === "active").length;
    const totalCount = typeof payload.totalCount === "number" ? payload.totalCount : users.length;

    if (count) count.textContent = getPresenceCountText(activeCount, totalCount);
    setPresenceConnectionState(payload.connectionState || "disconnected");

    list.innerHTML = "";
    if (users.length === 0) {
        const empty = document.createElement("div");
        empty.className = "presence-state";
        empty.textContent = payload.connectionState === "connected"
            ? "No users are registered."
            : "Presence is unavailable.";
        list.appendChild(empty);
        return;
    }

    for (const user of users) {
        const row = document.createElement("div");
        const active = user.status === "active";
        row.className = `presence-user${active ? " is-active" : " is-inactive"}`;

        const indicator = document.createElement("span");
        indicator.className = "presence-user__indicator";
        indicator.setAttribute("aria-hidden", "true");

        const name = document.createElement("span");
        name.className = "presence-user__name";
        name.textContent = String(user.name || "Unknown").slice(0, 30);

        const status = document.createElement("span");
        status.className = "presence-user__status";
        status.textContent = active ? "Active" : "Inactive";

        row.append(indicator, name, status);
        list.appendChild(row);
    }
}

async function notifyPresenceNameChanged(name) {
    try {
        await chrome.runtime.sendMessage({
            type: "PRESENCE_UPDATE_NAME",
            payload: { name }
        });
    } catch (e) {
        console.warn("Presence name update failed", e);
    }
}

function bindPresence(state) {
    const toggle = $("presenceConfigToggle");
    const form = $("presenceConfigForm");
    const userIdInput = $("presenceUserIdInput");
    const wsUrlInput = $("presenceWsUrlInput");

    if (toggle && form) {
        toggle.addEventListener("click", () => {
            form.hidden = !form.hidden;
            if (!form.hidden) wsUrlInput?.focus();
        });
    }

    chrome.storage.local.get({
        [STORAGE_KEYS.presenceUserId]: DEFAULTS.presenceUserId,
        [STORAGE_KEYS.presenceWsUrl]: DEFAULTS.presenceWsUrl
    }).then((saved) => {
        if (userIdInput) userIdInput.value = saved[STORAGE_KEYS.presenceUserId] || "";
        if (wsUrlInput) wsUrlInput.value = saved[STORAGE_KEYS.presenceWsUrl] || DEFAULTS.presenceWsUrl;
    }).catch((e) => console.warn("Could not load presence configuration", e));

    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const wsUrl = wsUrlInput?.value.trim() || "";
            const userId = userIdInput?.value.trim() || "";

            if (!/^wss?:\/\/.+/i.test(wsUrl)) {
                toast("Use a ws:// or wss:// WebSocket URL", "warn");
                return;
            }

            try {
                await chrome.runtime.sendMessage({
                    type: "PRESENCE_UPDATE_CONFIG",
                    payload: { wsUrl, userId }
                });
                state.presenceUserId = userId;
                state.presenceWsUrl = wsUrl;
                toast("Presence connection updated", "success");
            } catch (e) {
                console.error("Presence configuration update failed", e);
                toast("Could not update presence connection", "error");
            }
        });
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message?.type === "PRESENCE_STATE_CHANGED") {
            renderPresence(message.payload || {});
        }
    });

    chrome.runtime.sendMessage({ type: "PRESENCE_GET_STATE" }).then((response) => {
        if (response?.type === "PRESENCE_STATE") {
            renderPresence(response.payload || {});
        }
    }).catch(() => {
        renderPresence({ connectionState: "disconnected", users: [] });
    });
}

function bindUserNameEditor(state) {
    const el = $("userName");
    if (!el) return;

    el.style.cursor = "pointer";
    el.title = "Click to change name";

    el.addEventListener("click", async () => {
        const current = normalizeUserName(state.userName);
        const nextRaw = window.prompt("Your name:", current);
        if (nextRaw === null) return;
        const next = normalizeUserName(nextRaw);
        state.userName = next;
        setUserName(next);
        await storageSet({ [STORAGE_KEYS.userName]: next });
        await notifyPresenceNameChanged(next);
        toast("Name updated", "success");
    });
}

function applyCollapsedState(collapsed) {
    for (const [panelKey, isCollapsed] of Object.entries(collapsed || {})) {
        const panel = document.querySelector(`.panel[data-panel="${panelKey}"]`);
        if (!panel) continue;
        panel.classList.toggle("is-collapsed", Boolean(isCollapsed));
    }
}

function renderToolGrid() {
    const grid = $("aiToolsGrid");
    if (!grid) return;

    grid.innerHTML = "";
    for (const tool of AI_TOOLS) {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        card.innerHTML = `
      <div class="card__icon"><i class="${tool.icon}" aria-hidden="true"></i></div>
      <div class="card__label">${escapeHtml(tool.name)}</div>
    `;

        const open = () => openInNewTab(tool.url);
        card.addEventListener("click", open);
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") open();
        });

        grid.appendChild(card);
    }
}

function renderAppsGrid() {
    const grid = $("appsGrid");
    if (!grid) return;

    grid.innerHTML = "";
    for (const app of GOOGLE_APPS) {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        card.innerHTML = `
      <div class="card__icon"><i class="${app.icon}" aria-hidden="true"></i></div>
      <div class="card__label">${escapeHtml(app.name)}</div>
    `;

        const open = () => openInNewTab(app.url);
        card.addEventListener("click", open);
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") open();
        });

        grid.appendChild(card);
    }
}

function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function deriveFaviconUrl(url) {
    try {
        const u = new URL(url);
        const pageUrl = u.toString();
        return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(pageUrl)}`;
    } catch {
        return "";
    }
}

function isSafeProtocol(urlString, allowedProtocols) {
    try {
        const u = new URL(urlString);
        return allowedProtocols.has(u.protocol);
    } catch {
        return false;
    }
}

function looksLikeHost(raw) {
    if (!raw) return false;
    const s = raw.trim();
    if (!s) return false;
    if (/\s/.test(s)) return false;

    if (s.startsWith("www.")) return true;
    if (s.includes(".")) return true;
    if (/^(localhost)(:\d+)?(\/.*)?$/i.test(s)) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}(?::\d+)?(\/.*)?$/i.test(s)) return true;
    if (/^[a-z0-9-]+(?::\d+)(\/.*)?$/i.test(s)) return true;

    return false;
}

function normalizeUrlForNavigation(input) {
    const raw = String(input || "").trim();
    if (!raw) return null;
    if (/\s/.test(raw)) return null;

    const allowed = new Set(["http:", "https:", "chrome:", "chrome-extension:"]);

    if (/^(https?:\/\/|chrome:\/\/|chrome-extension:\/\/)/i.test(raw)) {
        return isSafeProtocol(raw, allowed) ? raw : null;
    }

    if (!looksLikeHost(raw)) return null;

    const httpPreferred =
        /^(localhost)(:|\/|$)/i.test(raw) || /^\d{1,3}(\.\d{1,3}){3}(:|\/|$)/.test(raw) || /:\d+/.test(raw);

    const candidate = `${httpPreferred ? "http" : "https"}://${raw}`;
    return isSafeProtocol(candidate, allowed) ? candidate : null;
}

function bindTopbarSearch() {
    const form = $("topbarSearchForm");
    const input = $("topbarSearchInput");
    const voiceBtn = $("topbarVoiceBtn");

    if (form && input) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const q = input.value.trim();
            if (!q) {
                toast("Type something to search", "warn");
                return;
            }

            const url = normalizeUrlForNavigation(q);
            if (url) {
                window.location.href = url;
                return;
            }

            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
            window.location.href = searchUrl;
        });
    }

    if (voiceBtn && input) {
        voiceBtn.addEventListener("click", () => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                toast("Voice search not supported in this browser", "warn");
                return;
            }

            try {
                voiceBtn.disabled = true;
                const rec = new SpeechRecognition();
                rec.lang = navigator.language || "en-US";
                rec.interimResults = false;
                rec.maxAlternatives = 1;

                rec.onresult = (event) => {
                    const text = event.results?.[0]?.[0]?.transcript;
                    if (text) {
                        input.value = text;
                        toast("Voice input captured", "success");
                    }
                };

                rec.onerror = (err) => {
                    console.error("speech error", err);
                    toast("Voice search failed", "error");
                };

                rec.onend = () => {
                    voiceBtn.disabled = false;
                };

                rec.start();
            } catch (e) {
                console.error("SpeechRecognition start failed", e);
                voiceBtn.disabled = false;
                toast("Voice search failed", "error");
            }
        });
    }
}

function bindSearch() {
    const form = $("searchForm");
    const input = $("searchInput");
    const voiceBtn = $("voiceBtn");

    if (form && input) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const q = input.value.trim();
            if (!q) {
                toast("Type something to search", "warn");
                return;
            }

            const url = normalizeUrlForNavigation(q);
            if (url) {
                window.location.href = url;
                return;
            }

            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
            window.location.href = searchUrl;
        });
    }

    if (voiceBtn && input) {
        voiceBtn.addEventListener("click", () => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                toast("Voice search not supported in this browser", "warn");
                return;
            }

            try {
                voiceBtn.disabled = true;
                const rec = new SpeechRecognition();
                rec.lang = navigator.language || "en-US";
                rec.interimResults = false;
                rec.maxAlternatives = 1;

                rec.onresult = (event) => {
                    const text = event.results?.[0]?.[0]?.transcript;
                    if (text) {
                        input.value = text;
                        toast("Voice input captured", "success");
                    }
                };

                rec.onerror = (err) => {
                    console.error("speech error", err);
                    toast("Voice search failed", "error");
                };

                rec.onend = () => {
                    voiceBtn.disabled = false;
                };

                rec.start();
            } catch (e) {
                console.error("SpeechRecognition start failed", e);
                voiceBtn.disabled = false;
                toast("Voice search failed", "error");
            }
        });
    }
}

function bindDockPopovers() {
    const dock = document.querySelector(".dock");
    if (!dock) return;

    const dockPanels = Array.from(dock.querySelectorAll('.panel[data-panel]'));
    const closeAll = () => {
        for (const p of dockPanels) p.classList.remove("is-open");
    };

    const togglePanel = (panel) => {
        if (!panel || panel.classList.contains("is-collapsed")) return;
        const willOpen = !panel.classList.contains("is-open");
        closeAll();
        panel.classList.toggle("is-open", willOpen);
    };

    dock.addEventListener("click", (e) => {
        const target = e.target;
        const panel = target?.closest?.('.panel[data-panel]');
        if (!panel) return;

        if (target?.closest?.(".panel__toggle")) return;
        if (target?.closest?.(".panel__body")) return;
        if (!target?.closest?.(".panel__header")) return;

        e.preventDefault();
        e.stopPropagation();
        togglePanel(panel);
    });

    document.addEventListener("click", (e) => {
        const target = e.target;
        if (target?.closest?.(".dock")) return;
        closeAll();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAll();
    });
}

function updateTodoCount(todos, countElId = "todoCount") {
    const countEl = $(countElId);
    if (!countEl) return;
    const pending = (todos || []).filter((t) => !t.done).length;
    countEl.textContent = String(pending);
}

function renderTodos(todos, listElId = "todoList") {
    const list = $(listElId);
    if (!list) return;

    list.innerHTML = "";
    const items = Array.isArray(todos) ? todos : [];

    if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No tasks yet. Add one to get started.";
        list.appendChild(empty);
        updateTodoCount(items, listElId === "todoList" ? "todoCount" : "todoCount2");
        return;
    }

    for (const t of items) {
        const row = document.createElement("div");
        row.className = `todo-item${t.done ? " is-done" : ""}`;
        row.dataset.todoId = t.id;

        const checkbox = document.createElement("input");
        checkbox.className = "todo-check";
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(t.done);
        checkbox.setAttribute("aria-label", "Mark complete");

        const text = document.createElement("div");
        text.className = "todo-text";
        text.textContent = t.text;

        const del = document.createElement("button");
        del.className = "todo-del";
        del.type = "button";
        del.setAttribute("aria-label", "Delete task");
        del.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';

        row.append(checkbox, text, del);
        list.appendChild(row);
    }

    updateTodoCount(items, listElId === "todoList" ? "todoCount" : "todoCount2");
}

async function addTodo(state, inputElId = "todoInput", listKey = "todos", renderListId = "todoList") {
    const input = $(inputElId);
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
        toast("Task cannot be empty", "warn");
        return;
    }

    const next = [
        {
            id: createId("todo"),
            text,
            done: false,
            createdAt: safeNowIso()
        },
        ...(state[listKey] || [])
    ];

    state[listKey] = next;
    const ok = await storageSet({ [STORAGE_KEYS[listKey]]: next });
    if (ok) {
        input.value = "";
        renderTodos(next, renderListId);
        toast("Task added", "success");
    }
}

async function toggleTodo(state, todoId, done, listKey = "todos", renderListId = "todoList") {
    const todos = Array.isArray(state[listKey]) ? state[listKey] : [];
    const next = todos.map((t) => (t.id === todoId ? { ...t, done: Boolean(done) } : t));
    state[listKey] = next;
    const ok = await storageSet({ [STORAGE_KEYS[listKey]]: next });
    if (ok) {
        renderTodos(next, renderListId);
    }
}

async function deleteTodo(state, todoId, listKey = "todos", renderListId = "todoList") {
    const okConfirm = window.confirm("Delete this task?");
    if (!okConfirm) return;

    const todos = Array.isArray(state[listKey]) ? state[listKey] : [];
    const next = todos.filter((t) => t.id !== todoId);
    state[listKey] = next;

    const ok = await storageSet({ [STORAGE_KEYS[listKey]]: next });
    if (ok) {
        renderTodos(next, renderListId);
        toast("Task deleted", "success");
    }
}

function bindTodos(state, formId = "todoForm", listId = "todoList", inputId = "todoInput", listKey = "todos") {
    const form = $(formId);
    const list = $(listId);

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            await addTodo(state, inputId, listKey, listId);
        });
    }

    if (list) {
        list.addEventListener("click", async (e) => {
            const target = e.target;
            const item = target?.closest?.(".todo-item");
            if (!item) return;
            const todoId = item.dataset.todoId;
            if (!todoId) return;

            if (target?.classList?.contains("todo-del") || target?.closest?.(".todo-del")) {
                await deleteTodo(state, todoId, listKey, listId);
                return;
            }
        });

        list.addEventListener("change", async (e) => {
            const target = e.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (!target.classList.contains("todo-check")) return;

            const item = target.closest(".todo-item");
            if (!item) return;
            const todoId = item.dataset.todoId;
            if (!todoId) return;

            await toggleTodo(state, todoId, target.checked, listKey, listId);
        });
    }
}

function sanitizeBookmarkName(name) {
    const n = String(name || "").trim();
    if (!n) return "";
    return n.slice(0, 40);
}

function normalizeBookmarkUrl(url) {
    const normalized = normalizeUrlForNavigation(url);
    if (!normalized) return null;
    return isSafeProtocol(normalized, new Set(["http:", "https:"])) ? normalized : null;
}

function renderBookmarks(bookmarks) {
    const grid = $("bookmarkGrid");
    if (!grid) return;

    const items = Array.isArray(bookmarks) ? bookmarks : [];
    grid.innerHTML = "";

    if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No bookmarks yet. Add your favorites.";
        grid.appendChild(empty);
        return;
    }

    for (const b of items) {
        const el = document.createElement("div");
        el.className = "bookmark";
        el.tabIndex = 0;
        el.dataset.bookmarkId = b.id;

        const favUrl = deriveFaviconUrl(b.url);

        el.innerHTML = `
      <div class="bookmark__top">
        <div class="bookmark__favicon">
          ${favUrl ? `<img alt="" src="${favUrl}" />` : '<i class="fa-solid fa-globe" aria-hidden="true"></i>'}
        </div>
        <div class="bookmark__name">${escapeHtml(b.name)}</div>
      </div>
      <div class="bookmark__url">${escapeHtml(b.url)}</div>
    `;

        const open = () => openInNewTab(b.url);
        el.addEventListener("click", open);
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") open();
        });

        grid.appendChild(el);
    }
}

async function deleteBookmark(state, bookmarkId) {
    const okConfirm = window.confirm("Delete this bookmark?");
    if (!okConfirm) return;

    const items = Array.isArray(state.bookmarks) ? state.bookmarks : [];
    const next = items.filter((b) => b.id !== bookmarkId);
    state.bookmarks = next;

    const ok = await storageSet({ [STORAGE_KEYS.bookmarks]: next });
    if (ok) {
        renderBookmarks(next);
        toast("Bookmark deleted", "success");
    }
}

async function addBookmark(state) {
    const nameEl = $("bookmarkName");
    const urlEl = $("bookmarkUrl");
    if (!nameEl || !urlEl) return;

    const name = sanitizeBookmarkName(nameEl.value);
    const url = normalizeBookmarkUrl(urlEl.value);

    if (!isNonEmptyString(name)) {
        toast("Bookmark name is required", "warn");
        return;
    }

    if (!url) {
        toast("Enter a valid URL", "warn");
        return;
    }

    const items = Array.isArray(state.bookmarks) ? state.bookmarks : [];
    const next = [
        {
            id: createId("bm"),
            name,
            url,
            createdAt: safeNowIso()
        },
        ...items
    ];

    state.bookmarks = next;
    const ok = await storageSet({ [STORAGE_KEYS.bookmarks]: next });
    if (ok) {
        nameEl.value = "";
        urlEl.value = "";
        renderBookmarks(next);
        toast("Bookmark added", "success");
    }
}

function bindBookmarks(state) {
    const form = $("bookmarkForm");
    const grid = $("bookmarkGrid");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            await addBookmark(state);
        });
    }

    if (!grid) return;

    grid.addEventListener("contextmenu", async (e) => {
        const target = e.target;
        const item = target?.closest?.(".bookmark");
        if (!item) return;

        e.preventDefault();
        const id = item.dataset.bookmarkId;
        if (id) await deleteBookmark(state, id);
    });

    let longPressTimer = null;
    grid.addEventListener("pointerdown", (e) => {
        const target = e.target;
        const item = target?.closest?.(".bookmark");
        if (!item) return;

        const id = item.dataset.bookmarkId;
        if (!id) return;

        longPressTimer = window.setTimeout(async () => {
            longPressTimer = null;
            await deleteBookmark(state, id);
        }, 650);
    });

    const cancelLongPress = () => {
        if (longPressTimer) {
            window.clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    grid.addEventListener("pointerup", cancelLongPress);
    grid.addEventListener("pointerleave", cancelLongPress);
    grid.addEventListener("pointercancel", cancelLongPress);
    grid.addEventListener("pointermove", cancelLongPress);
}

function countWords(text) {
    const t = String(text || "").trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
}

function updateWordCount(text, wordCountElId = "notesWordCount") {
    const el = $(wordCountElId);
    if (!el) return;
    el.textContent = `${countWords(text)} words`;
}

async function saveNotes(state, text, showToast = true, stateKey = "notes", storageKey = "notes") {
    state[stateKey] = text;
    const ok = await storageSet({ [STORAGE_KEYS[storageKey]]: text });
    if (ok && showToast) toast("Notes saved", "success");
}

function updateQuestionCount(questions) {
    const countEl = $("questionCount");
    if (!countEl) return;
    countEl.textContent = `${questions.length} questions`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function isCheckboxDue(dateAdded, daysOffset) {
    const added = new Date(dateAdded);
    const now = new Date();
    const dueDate = new Date(added);
    dueDate.setDate(dueDate.getDate() + daysOffset);
    return now >= dueDate;
}

function getCheckboxStatus(dateAdded, daysOffset, completedDates) {
    const dueDate = new Date(dateAdded);
    dueDate.setDate(dueDate.getDate() + daysOffset);
    const dueDateString = dueDate.toISOString().split('T')[0];
    
    return {
        isDue: isCheckboxDue(dateAdded, daysOffset),
        isCompleted: completedDates.includes(dueDateString),
        dueDate: dueDateString
    };
}

function renderQuestions(questions) {
    const table = $("questionsTable");
    if (!table) return;

    table.innerHTML = "";
    const items = Array.isArray(questions) ? questions : [];

    if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No questions yet. Add one to get started.";
        table.appendChild(empty);
        updateQuestionCount(items);
        return;
    }

    // Create table
    const tableEl = document.createElement("table");
    tableEl.className = "question-table";
    
    // Create header
    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>Question</th>
            <th>Date Added</th>
            <th>Day 3</th>
            <th>Day 7</th>
            <th>Day 15</th>
            <th>Actions</th>
        </tr>
    `;
    tableEl.appendChild(thead);

    // Create body
    const tbody = document.createElement("tbody");
    
    for (const question of items) {
        const row = document.createElement("tr");
        row.className = "question-row";
        row.dataset.questionId = question.id;

        const completedDates = question.completedDates || [];
        
        // Get checkbox statuses
        const day3Status = getCheckboxStatus(question.dateAdded, 3, completedDates);
        const day7Status = getCheckboxStatus(question.dateAdded, 7, completedDates);
        const day15Status = getCheckboxStatus(question.dateAdded, 15, completedDates);

        row.innerHTML = `
            <td class="question-name">${escapeHtml(question.name)}</td>
            <td class="question-date">${formatDate(question.dateAdded)}</td>
            <td class="checkbox-cell">
                <input type="checkbox" class="rep-checkbox" data-days="3" 
                    ${day3Status.isCompleted ? 'checked' : ''} 
                    ${!day3Status.isDue ? 'data-not-due="true"' : ''}>
                <span class="due-date ${!day3Status.isDue ? 'not-due' : ''}">${formatDate(day3Status.dueDate)}</span>
            </td>
            <td class="checkbox-cell">
                <input type="checkbox" class="rep-checkbox" data-days="7" 
                    ${day7Status.isCompleted ? 'checked' : ''} 
                    ${!day7Status.isDue ? 'data-not-due="true"' : ''}>
                <span class="due-date ${!day7Status.isDue ? 'not-due' : ''}">${formatDate(day7Status.dueDate)}</span>
            </td>
            <td class="checkbox-cell">
                <input type="checkbox" class="rep-checkbox" data-days="15" 
                    ${day15Status.isCompleted ? 'checked' : ''} 
                    ${!day15Status.isDue ? 'data-not-due="true"' : ''}>
                <span class="due-date ${!day15Status.isDue ? 'not-due' : ''}">${formatDate(day15Status.dueDate)}</span>
            </td>
            <td class="actions-cell">
                <button class="btn btn--small btn--ghost delete-question" type="button">
                    <i class="fa-solid fa-trash" aria-hidden="true"></i>
                </button>
            </td>
        `;

        tbody.appendChild(row);
    }

    tableEl.appendChild(tbody);
    table.appendChild(tableEl);
    updateQuestionCount(items);
}

async function addQuestion(state) {
    const input = $("questionInput");
    if (!input) return;

    const name = input.value.trim();
    if (!name) {
        toast("Question name cannot be empty", "warn");
        return;
    }

    const next = [
        {
            id: createId("question"),
            name,
            dateAdded: safeNowIso(),
            completedDates: []
        },
        ...(state.codingQuestions || [])
    ];

    state.codingQuestions = next;
    const ok = await storageSet({ [STORAGE_KEYS.codingQuestions]: next });
    if (ok) {
        input.value = "";
        renderQuestions(next);
        toast("Question added", "success");
    }
}

async function toggleQuestionCheckbox(state, questionId, days, checked) {
    const questions = Array.isArray(state.codingQuestions) ? state.codingQuestions : [];
    const question = questions.find(q => q.id === questionId);
    
    if (!question) return;

    const dueDate = new Date(question.dateAdded);
    dueDate.setDate(dueDate.getDate() + days);
    const dueDateString = dueDate.toISOString().split('T')[0];

    let completedDates = question.completedDates || [];
    
    if (checked) {
        if (!completedDates.includes(dueDateString)) {
            completedDates.push(dueDateString);
        }
    } else {
        completedDates = completedDates.filter(date => date !== dueDateString);
    }

    const next = questions.map(q => 
        q.id === questionId ? { ...q, completedDates } : q
    );

    state.codingQuestions = next;
    const ok = await storageSet({ [STORAGE_KEYS.codingQuestions]: next });
    if (ok) {
        renderQuestions(next);
    }
}

async function deleteQuestion(state, questionId) {
    const okConfirm = window.confirm("Delete this question?");
    if (!okConfirm) return;

    const questions = Array.isArray(state.codingQuestions) ? state.codingQuestions : [];
    const next = questions.filter(q => q.id !== questionId);
    state.codingQuestions = next;

    const ok = await storageSet({ [STORAGE_KEYS.codingQuestions]: next });
    if (ok) {
        renderQuestions(next);
        toast("Question deleted", "success");
    }
}

function bindQuestions(state) {
    const form = $("questionForm");
    const table = $("questionsTable");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            await addQuestion(state);
        });
    }

    if (table) {
        table.addEventListener("click", async (e) => {
            const target = e.target;
            
            // Handle delete button
            if (target.classList.contains("delete-question") || target.closest(".delete-question")) {
                const row = target.closest(".question-row");
                if (!row) return;
                const questionId = row.dataset.questionId;
                if (questionId) {
                    await deleteQuestion(state, questionId);
                }
                return;
            }
        });

        table.addEventListener("change", async (e) => {
            const target = e.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (!target.classList.contains("rep-checkbox")) return;

            const row = target.closest(".question-row");
            if (!row) return;
            const questionId = row.dataset.questionId;
            const days = parseInt(target.dataset.days);
            
            if (questionId && days) {
                await toggleQuestionCheckbox(state, questionId, days, target.checked);
            }
        });
    }
}

function sanitizeShortcutName(name) {
    const n = String(name || "").trim();
    if (!n) return "";
    return n.slice(0, 30);
}

function normalizeShortcutUrl(url) {
    const normalized = normalizeUrlForNavigation(url);
    if (!normalized) return null;
    return isSafeProtocol(normalized, new Set(["http:", "https:"])) ? normalized : null;
}

function renderShortcuts(shortcuts) {
    const grid = $("shortcutGrid");
    if (!grid) return;

    const items = Array.isArray(shortcuts) ? shortcuts : [];
    grid.innerHTML = "";

    if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No shortcuts yet. Add your favorites.";
        grid.appendChild(empty);
        return;
    }

    for (const s of items) {
        const el = document.createElement("div");
        el.className = "shortcut";
        el.tabIndex = 0;
        el.dataset.shortcutId = s.id;

        const favUrl = deriveFaviconUrl(s.url);

        el.innerHTML = `
      <div class="shortcut__top">
        <div class="shortcut__favicon">
          ${favUrl ? `<img alt="" src="${favUrl}" />` : '<i class="fa-solid fa-globe" aria-hidden="true"></i>'}
        </div>
        <div class="shortcut__name">${escapeHtml(s.name)}</div>
      </div>
      <div class="shortcut__url">${escapeHtml(s.url)}</div>
    `;

        const open = () => openInNewTab(s.url);
        el.addEventListener("click", open);
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") open();
        });

        grid.appendChild(el);
    }
}

async function deleteShortcut(state, shortcutId) {
    const okConfirm = window.confirm("Delete this shortcut?");
    if (!okConfirm) return;

    const items = Array.isArray(state.shortcuts) ? state.shortcuts : [];
    const next = items.filter((s) => s.id !== shortcutId);
    state.shortcuts = next;

    const ok = await storageSet({ [STORAGE_KEYS.shortcuts]: next });
    if (ok) {
        renderShortcuts(next);
        toast("Shortcut deleted", "success");
    }
}

async function addShortcut(state) {
    const nameEl = $("shortcutName");
    const urlEl = $("shortcutUrl");
    if (!nameEl || !urlEl) return;

    const name = sanitizeShortcutName(nameEl.value);
    const url = normalizeShortcutUrl(urlEl.value);

    if (!isNonEmptyString(name)) {
        toast("Shortcut name is required", "warn");
        return;
    }

    if (!url) {
        toast("Enter a valid URL", "warn");
        return;
    }

    const items = Array.isArray(state.shortcuts) ? state.shortcuts : [];
    const next = [
        {
            id: createId("sc"),
            name,
            url,
            createdAt: safeNowIso()
        },
        ...items
    ];

    state.shortcuts = next;
    const ok = await storageSet({ [STORAGE_KEYS.shortcuts]: next });
    if (ok) {
        nameEl.value = "";
        urlEl.value = "";
        renderShortcuts(next);
        toast("Shortcut added", "success");
    }
}

function bindShortcuts(state) {
    const form = $("shortcutForm");
    const grid = $("shortcutGrid");

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            await addShortcut(state);
        });
    }

    if (!grid) return;

    grid.addEventListener("contextmenu", async (e) => {
        const target = e.target;
        const item = target?.closest?.(".shortcut");
        if (!item) return;

        e.preventDefault();
        const id = item.dataset.shortcutId;
        if (id) await deleteShortcut(state, id);
    });

    let longPressTimer = null;
    grid.addEventListener("pointerdown", (e) => {
        const target = e.target;
        const item = target?.closest?.(".shortcut");
        if (!item) return;

        const id = item.dataset.shortcutId;
        if (!id) return;

        longPressTimer = window.setTimeout(async () => {
            longPressTimer = null;
            await deleteShortcut(state, id);
        }, 650);
    });

    const cancelLongPress = () => {
        if (longPressTimer) {
            window.clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    grid.addEventListener("pointerup", cancelLongPress);
    grid.addEventListener("pointerleave", cancelLongPress);
    grid.addEventListener("pointercancel", cancelLongPress);
    grid.addEventListener("pointermove", cancelLongPress);
}

function bindNotes(state, areaId = "notesArea", saveBtnId = "notesSaveBtn", clearBtnId = "notesClearBtn", wordCountElId = "notesWordCount", stateKey = "notes", storageKey = "notes") {
    const area = $(areaId);
    const saveBtn = $(saveBtnId);
    const clearBtn = $(clearBtnId);

    if (!area) return;

    area.value = state[stateKey] || "";
    updateWordCount(area.value, wordCountElId);

    const debouncedAutosave = debounce(async () => {
        await saveNotes(state, area.value, false, stateKey, storageKey);
    }, 450);

    area.addEventListener("input", () => {
        updateWordCount(area.value, wordCountElId);
        debouncedAutosave();
    });

    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            await saveNotes(state, area.value, true, stateKey, storageKey);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", async () => {
            const okConfirm = window.confirm("Clear notes? This cannot be undone.");
            if (!okConfirm) return;
            area.value = "";
            updateWordCount("", wordCountElId);
            await saveNotes(state, "", true, stateKey, storageKey);
        });
    }
}

function bindCollapsibles(state) {
    const buttons = document.querySelectorAll("[data-toggle]");
    for (const btn of buttons) {
        btn.addEventListener("click", async () => {
            const key = btn.getAttribute("data-toggle");
            if (!key) return;

            const panel = document.querySelector(`.panel[data-panel="${key}"]`);
            if (!panel) return;

            const nextCollapsed = !panel.classList.contains("is-collapsed");
            panel.classList.toggle("is-collapsed", nextCollapsed);
            panel.classList.remove("is-open");

            state.collapsed = {
                ...(state.collapsed || DEFAULTS.collapsed),
                [key]: nextCollapsed
            };

            await storageSet({ [STORAGE_KEYS.collapsed]: state.collapsed });
        });
    }
}

function bindThemeToggle(state) {
    const btn = $("themeToggleBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        const next = state.theme === "light" ? "dark" : "light";
        state.theme = next;
        setTheme(next);
        await storageSet({ [STORAGE_KEYS.theme]: next });
    });
}

function ensureDefaultBookmarks(existing) {
    if (Array.isArray(existing) && existing.length > 0) return existing;
    return GOOGLE_APPS.map((a) => ({
        id: createId("bm"),
        name: a.name,
        url: a.url,
        createdAt: safeNowIso()
    }));
}

async function init() {
    const loadStart = performance.now();
    const MIN_LOADING_MS = 650;
    showLoading(true);

    const state = {
        theme: DEFAULTS.theme,
        userName: DEFAULTS.userName,
        presenceUserId: DEFAULTS.presenceUserId,
        presenceWsUrl: DEFAULTS.presenceWsUrl,
        collapsed: { ...DEFAULTS.collapsed },
        todos: [...DEFAULTS.todos],
        todos2: [...DEFAULTS.todos2],
        bookmarks: null,
        notes: DEFAULTS.notes,
        notes2: DEFAULTS.notes2,
        codingQuestions: [...DEFAULTS.codingQuestions],
        shortcuts: [...DEFAULTS.shortcuts]
    };

    const saved = await storageGet({
        [STORAGE_KEYS.theme]: DEFAULTS.theme,
        [STORAGE_KEYS.userName]: DEFAULTS.userName,
        [STORAGE_KEYS.collapsed]: DEFAULTS.collapsed,
        [STORAGE_KEYS.todos]: DEFAULTS.todos,
        [STORAGE_KEYS.todos2]: DEFAULTS.todos2,
        [STORAGE_KEYS.bookmarks]: DEFAULTS.bookmarks,
        [STORAGE_KEYS.notes]: DEFAULTS.notes,
        [STORAGE_KEYS.notes2]: DEFAULTS.notes2,
        [STORAGE_KEYS.codingQuestions]: DEFAULTS.codingQuestions,
        [STORAGE_KEYS.shortcuts]: DEFAULTS.shortcuts
    });

    state.theme = saved[STORAGE_KEYS.theme] || DEFAULTS.theme;
    state.userName = typeof saved[STORAGE_KEYS.userName] === "string" ? saved[STORAGE_KEYS.userName] : DEFAULTS.userName;
    state.collapsed = { ...DEFAULTS.collapsed, ...(saved[STORAGE_KEYS.collapsed] || {}) };
    state.todos = Array.isArray(saved[STORAGE_KEYS.todos]) ? saved[STORAGE_KEYS.todos] : [];
    state.todos2 = Array.isArray(saved[STORAGE_KEYS.todos2]) ? saved[STORAGE_KEYS.todos2] : [];
    state.bookmarks = ensureDefaultBookmarks(saved[STORAGE_KEYS.bookmarks]);
    state.notes = typeof saved[STORAGE_KEYS.notes] === "string" ? saved[STORAGE_KEYS.notes] : "";
    state.notes2 = typeof saved[STORAGE_KEYS.notes2] === "string" ? saved[STORAGE_KEYS.notes2] : "";
    state.codingQuestions = Array.isArray(saved[STORAGE_KEYS.codingQuestions]) ? saved[STORAGE_KEYS.codingQuestions] : [];
    state.shortcuts = Array.isArray(saved[STORAGE_KEYS.shortcuts]) ? saved[STORAGE_KEYS.shortcuts] : [];

    setTheme(state.theme);
    state.userName = setUserName(state.userName);
    applyCollapsedState(state.collapsed);

    renderToolGrid();
    renderAppsGrid();
    renderTodos(state.todos);
    renderTodos(state.todos2, "todoList2");
    renderBookmarks(state.bookmarks);
    renderQuestions(state.codingQuestions);
    renderShortcuts(state.shortcuts);

    bindThemeToggle(state);
    bindUserNameEditor(state);
    bindPresence(state);
    bindCollapsibles(state);
    bindDockPopovers();
    bindTopbarSearch();
    bindSearch();
    bindTodos(state);
    bindTodos(state, "todoForm2", "todoList2", "todoInput2", "todos2");
    bindBookmarks(state);
    bindQuestions(state);
    bindShortcuts(state);
    bindNotes(state);
    bindNotes(state, "notesArea2", "notesSaveBtn2", "notesClearBtn2", "notesWordCount2", "notes2", "notes2");

    startClock();

    await storageSet({
        [STORAGE_KEYS.userName]: state.userName,
        [STORAGE_KEYS.bookmarks]: state.bookmarks
    });

    const elapsed = performance.now() - loadStart;
    const waitMs = Math.max(0, MIN_LOADING_MS - elapsed);
    if (waitMs) {
        await new Promise((r) => window.setTimeout(r, waitMs));
    }

    showLoading(false);
}

document.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => {
        console.error("init failed", e);
        toast("Dashboard failed to initialize", "error");
        showLoading(false);
    });
});
