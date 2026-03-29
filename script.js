/**
 * E-Cards JM - MAIN APP LOGIC
 * Auth, UI, Editor, Preview, Admin, QR Generator
 */

const state = {
    API_BASE: '/api',
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    cardId: null,
    isPublicView: false,
    cards: [],
    isAdmin: false
};

// --- API HELPER ---
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
        ...options.headers
    };
    
    try {
        const response = await fetch(`${state.API_BASE}${endpoint}`, { ...options, headers });
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.warn('Sesión expirada');
                Auth.logout();
            }
            throw new Error(data.error || 'API_ERROR');
        }
        return data;
    } catch (err) {
        console.error(`API [${endpoint}]:`, err);
        throw err;
    }
}

// --- ROUTER ---
const Router = {
    go(path) {
        window.location.hash = path.startsWith('#') ? path : `#${path}`;
    },

    render(hash) {
        const path = (hash.replace(/^#/, '') || '/').replace(/^\/+|\/+$/g, '');
        
        const root = document.getElementById('app-root');
        const pub = document.getElementById('public-view');
        const header = document.getElementById('main-header');

        // Hide all views
        document.querySelectorAll('.view-content').forEach(el => el.classList.add('hidden'));
        pub?.classList.add('hidden');
        header?.classList.remove('hidden');
        root?.classList.remove('hidden');
        document.body.style.backgroundColor = '';

        if (path.match(/^card\/.+/)) {
            state.isPublicView = true;
            header?.classList.add('hidden');
            root?.classList.add('hidden');
            pub?.classList.remove('hidden');
            const cardId = path.split('/')[1];
            UI.loadPublicCard(cardId);
            return;
        }

        state.isPublicView = false;

        // Auth state
        Auth.updateAuthUI();

        switch (path) {
            case '':
            case 'home':
                document.getElementById('view-home')?.classList.remove('hidden');
                break;
            case 'admin':
            case 'dashboard':
                document.getElementById('view-admin')?.classList.remove('hidden');
                UI.loadDashboard();
                const delBtn = document.getElementById('btn-delete-card');
                delBtn?.classList.toggle('hidden', !state.cardId);
                break;
            case 'users':
                if (state.isAdmin) {
                    document.getElementById('view-users')?.classList.remove('hidden');
                    UI.loadUsers();
                }
                break;
        }
    }
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    Auth.updateAuthUI();
    Router.render(window.location.hash);
    
    // 自动登录：仅当未登录且非公开卡片时执行
    if (!state.token && !window.location.hash.includes('#/card/')) {
        console.log("Intentando auto-login...");
        Auth.login('jomar71.dev@gmail.com', 'admin1971')
            .catch(err => {
                console.error("Auto-login failed:", err);
            });
    }
    
    // Form listeners
    document.getElementById('cardForm')?.addEventListener('input', UI.updatePreview);
    
    // Auth forms
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        Auth.login(user, pass);
    });
    
    document.getElementById('registerForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('reg-user').value;
        const pass = document.getElementById('reg-pass').value;
        Auth.register(user, pass);
    });
});

// Service Worker optional (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}
