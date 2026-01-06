// Initialize data
let todos = [];
let bookmarks = [];
let notes = '';
let collapsedSections = {};

// Default AI Tools
const defaultAITools = [
    { name: "DeepSeek", url: "https://chat.deepseek.com", icon: "fas fa-brain" },
    { name: "ChatGPT", url: "https://chat.openai.com", icon: "fas fa-comment" },
    { name: "Gemini", url: "https://gemini.google.com", icon: "fab fa-google" },
    { name: "Claude", url: "https://claude.ai", icon: "fas fa-robot" },
    { name: "Copilot", url: "https://copilot.microsoft.com", icon: "fas fa-code" },
    { name: "Perplexity", url: "https://perplexity.ai", icon: "fas fa-search" }
];

// Default Google Apps
const defaultApps = [
    { name: "Gmail", url: "https://mail.google.com", icon: "fas fa-envelope" },
    { name: "Drive", url: "https://drive.google.com", icon: "fas fa-hdd" },
    { name: "Calendar", url: "https://calendar.google.com", icon: "fas fa-calendar" },
    { name: "Photos", url: "https://photos.google.com", icon: "fas fa-images" },
    { name: "Maps", url: "https://maps.google.com", icon: "fas fa-map" },
    { name: "Translate", url: "https://translate.google.com", icon: "fas fa-language" },
    { name: "Keep", url: "https://keep.google.com", icon: "fas fa-sticky-note" },
    { name: "Meet", url: "https://meet.google.com", icon: "fas fa-video" }
];

// Load data from storage
async function loadData() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['todos', 'bookmarks', 'notes', 'collapsedSections'], (result) => {
            todos = result.todos || [];
            bookmarks = result.bookmarks || defaultApps.map(app => ({
                name: app.name,
                url: app.url,
                icon: app.icon
            }));
            notes = result.notes || '';
            collapsedSections = result.collapsedSections || {};
            resolve();
        });
    });
}

// Save data to storage
async function saveData() {
    return new Promise((resolve) => {
        chrome.storage.sync.set({
            todos,
            bookmarks,
            notes,
            collapsedSections
        }, resolve);
    });
}

// Initialize clock
function initializeClock() {
    function updateTime() {
        const now = new Date();
        const timeElement = document.getElementById('currentTime');
        const dateElement = document.getElementById('currentDate');

        const timeOptions = { hour12: false };
        const timeStr = now.toLocaleTimeString('en-US', timeOptions);
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', dateOptions);

        timeElement.textContent = timeStr;
        dateElement.textContent = dateStr;
    }

    updateTime();
    setInterval(updateTime, 1000);
}

// Initialize AI Tools
function initializeAITools() {
    const aiGrid = document.querySelector('.ai-grid');
    aiGrid.innerHTML = '';

    defaultAITools.forEach(tool => {
        const toolElement = document.createElement('div');
        toolElement.className = 'ai-tool';
        toolElement.innerHTML = `
            <i class="${tool.icon}"></i>
            <span>${tool.name}</span>
        `;
        toolElement.addEventListener('click', () => {
            window.open(tool.url, '_blank');
        });
        aiGrid.appendChild(toolElement);
    });
}

// Initialize Apps
function initializeApps() {
    const appsGrid = document.querySelector('.apps-grid');
    appsGrid.innerHTML = '';

    defaultApps.forEach(app => {
        const appElement = document.createElement('div');
        appElement.className = 'app';
        appElement.innerHTML = `
            <i class="${app.icon}"></i>
            <span>${app.name}</span>
        `;
        appElement.addEventListener('click', () => {
            window.open(app.url, '_blank');
        });
        appsGrid.appendChild(appElement);
    });
}

// Initialize Todo List
function initializeTodoList() {
    const todoInput = document.getElementById('todoInput');
    const addTodoBtn = document.getElementById('addTodo');
    const todoList = document.getElementById('todoList');

    function renderTodos() {
        todoList.innerHTML = '';
        todos.forEach((todo, index) => {
            const todoItem = document.createElement('li');
            todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            todoItem.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                    <span>${todo.text}</span>
                </div>
                <div class="todo-actions">
                    <button class="delete-todo" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            const checkbox = todoItem.querySelector('.todo-checkbox');
            const deleteBtn = todoItem.querySelector('.delete-todo');

            checkbox.addEventListener('change', () => {
                todos[index].completed = checkbox.checked;
                saveData().then(renderTodos);
            });

            deleteBtn.addEventListener('click', () => {
                todos.splice(index, 1);
                saveData().then(renderTodos);
            });

            todoList.appendChild(todoItem);
        });
    }

    addTodoBtn.addEventListener('click', () => {
        const text = todoInput.value.trim();
        if (text) {
            todos.push({ text, completed: false });
            todoInput.value = '';
            saveData().then(renderTodos);
        }
    });

    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodoBtn.click();
        }
    });

    renderTodos();
}

// Initialize Bookmarks
function initializeBookmarks() {
    const bookmarksGrid = document.querySelector('.bookmarks-grid');
    const addBookmarkBtn = document.getElementById('addBookmark');
    const bookmarkUrlInput = document.getElementById('bookmarkUrl');
    const bookmarkNameInput = document.getElementById('bookmarkName');

    function renderBookmarks() {
        bookmarksGrid.innerHTML = '';
        bookmarks.forEach((bookmark, index) => {
            const bookmarkElement = document.createElement('div');
            bookmarkElement.className = 'bookmark';
            bookmarkElement.innerHTML = `
                <i class="${bookmark.icon || 'fas fa-link'}"></i>
                <span>${bookmark.name}</span>
            `;
            bookmarkElement.addEventListener('click', () => {
                window.open(bookmark.url, '_blank');
            });

            // Add long press to delete
            let pressTimer;
            bookmarkElement.addEventListener('mousedown', () => {
                pressTimer = setTimeout(() => {
                    if (confirm(`Delete bookmark "${bookmark.name}"?`)) {
                        bookmarks.splice(index, 1);
                        saveData().then(renderBookmarks);
                    }
                }, 1000);
            });

            bookmarkElement.addEventListener('mouseup', () => {
                clearTimeout(pressTimer);
            });

            bookmarkElement.addEventListener('mouseleave', () => {
                clearTimeout(pressTimer);
            });

            bookmarksGrid.appendChild(bookmarkElement);
        });
    }

    addBookmarkBtn.addEventListener('click', () => {
        const url = bookmarkUrlInput.value.trim();
        const name = bookmarkNameInput.value.trim();

        if (url && name) {
            bookmarks.push({
                name,
                url: url.startsWith('http') ? url : `https://${url}`,
                icon: 'fas fa-link'
            });

            bookmarkUrlInput.value = '';
            bookmarkNameInput.value = '';
            saveData().then(renderBookmarks);
        }
    });

    bookmarkUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addBookmarkBtn.click();
        }
    });

    bookmarkNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addBookmarkBtn.click();
        }
    });

    renderBookmarks();
}

// Initialize Notes
function initializeNotes() {
    const notesArea = document.getElementById('notesArea');
    const saveNoteBtn = document.getElementById('saveNote');
    const clearNoteBtn = document.getElementById('clearNote');

    notesArea.value = notes;

    // Auto-save on change
    notesArea.addEventListener('input', () => {
        notes = notesArea.value;
        saveData();
    });

    saveNoteBtn.addEventListener('click', () => {
        notes = notesArea.value;
        saveData().then(() => {
            const originalText = saveNoteBtn.innerHTML;
            saveNoteBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            setTimeout(() => {
                saveNoteBtn.innerHTML = originalText;
            }, 2000);
        });
    });

    clearNoteBtn.addEventListener('click', () => {
        if (confirm('Clear all notes?')) {
            notes = '';
            notesArea.value = '';
            saveData();
        }
    });
}

// Initialize Toggle Sections
function initializeToggleSections() {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        const section = btn.dataset.section;
        const content = document.getElementById(`${section}Section`);

        // Set initial state
        if (collapsedSections[section]) {
            content.style.display = 'none';
            btn.querySelector('i').className = 'fas fa-chevron-up';
        }

        btn.addEventListener('click', () => {
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? 'block' : 'none';
            btn.querySelector('i').className = isCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
            collapsedSections[section] = !isCollapsed;
            saveData();
        });
    });
}

// Initialize Search
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                if (query.includes('.') && !query.includes(' ')) {
                    // If it looks like a URL
                    const url = query.startsWith('http') ? query : `https://${query}`;
                    window.open(url, '_blank');
                } else {
                    // Google search
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                }
            }
        }
    });
}

// Initialize Voice Search (Simulated)
function initializeVoiceSearch() {
    const voiceSearchBtn = document.getElementById('voiceSearch');

    voiceSearchBtn.addEventListener('click', () => {
        // This is a simulation - in a real extension, you'd use Web Speech API
        alert('Voice search would require additional permissions and Web Speech API implementation.');
    });
}

// Initialize Theme Toggle
function initializeThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');

    themeToggle.addEventListener('click', () => {
        // Toggle between dark and light theme
        const root = document.documentElement;
        const isDark = getComputedStyle(root).getPropertyValue('--bg-primary') === '#0f172a';

        if (isDark) {
            // Switch to light theme
            root.style.setProperty('--bg-primary', '#f8fafc');
            root.style.setProperty('--bg-secondary', '#f1f5f9');
            root.style.setProperty('--bg-tertiary', '#e2e8f0');
            root.style.setProperty('--text-primary', '#1e293b');
            root.style.setProperty('--text-secondary', '#64748b');
            root.style.setProperty('--border', '#cbd5e1');
            root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.8)');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            // Switch to dark theme
            root.style.setProperty('--bg-primary', '#0f172a');
            root.style.setProperty('--bg-secondary', '#1e293b');
            root.style.setProperty('--bg-tertiary', '#334155');
            root.style.setProperty('--text-primary', '#f1f5f9');
            root.style.setProperty('--text-secondary', '#94a3b8');
            root.style.setProperty('--border', '#475569');
            root.style.setProperty('--card-bg', 'rgba(30, 41, 59, 0.7)');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    });
}

// Main initialization
async function initialize() {
    await loadData();

    initializeClock();
    initializeAITools();
    initializeApps();
    initializeTodoList();
    initializeBookmarks();
    initializeNotes();
    initializeToggleSections();
    initializeSearch();
    initializeVoiceSearch();
    initializeThemeToggle();
}

// Start everything when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);