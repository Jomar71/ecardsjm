// --- API HELPER CORE ---
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
                console.warn("Sesión expirada o inválida.");
                Auth.logout();
            }
            throw new Error(data.error || 'SERVER_ERROR');
        }
        return data;
    } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
    }
}

// Despertar el servidor si estuviera en hibernación (útil para hosting gratuito)
(async function wakeServer() {
    try {
        console.log("Detectando servidor activo...");
        fetch(`${state.API_BASE}/api/test-db`).catch(() => {});
    } catch(e) {}
})();

const Router = {
    go(path) {
        console.log(`Router: Navigating to [${path}]`);
        // Force hash-based routing for static hosts like GitHub Pages
        const hashPath = path.startsWith('#') ? path : `#${path}`;
        window.location.hash = hashPath;
    },

    render(hash) {
        const rawPath = hash.replace(/^#/, '') || '/';
        const path = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
        
        const root = document.getElementById('app-root');
        const pub = document.getElementById('public-view');
        const header = document.getElementById('main-header');

        document.querySelectorAll('.view-content').forEach(el => el.classList.add('hidden'));

        if (path.startsWith('/card/')) {
            state.isPublicView = true;
            if (header) header.classList.add('hidden');
            if (root) root.classList.add('hidden');
            if (pub) pub.classList.remove('hidden');
            
            const id = path.split('/').pop();
            UI.loadPublicCard(id);
            return;
        }

        state.isPublicView = false;
        if (header) header.classList.remove('hidden');
        if (root) root.classList.remove('hidden');
        if (pub) pub.classList.add('hidden');
        document.body.style.backgroundColor = ''; // Restaurar color original

        // Restaurar estado de autenticación
        Auth.updateAuthUI();
        if (path === '/admin' || path === '/dashboard') {
            document.getElementById('view-admin')?.classList.remove('hidden');
            const delBtn = document.getElementById('btn-delete-card');
            if (state.cardId) delBtn?.classList.remove('hidden');
            else delBtn?.classList.add('hidden');
            
            // Cargar lista de tarjetas en el admin
            UI.loadDashboard();
            
            if (path === '/dashboard') {
                Router.go('/admin');
            }
        } else {
            document.getElementById('view-home')?.classList.remove('hidden');
        }
    }
};

// Initial routing setup
window.addEventListener('hashchange', () => Router.render(window.location.hash));
window.addEventListener('load', () => {
    // Handle initial routing
    const initialHash = window.location.hash || '#/';
    Router.render(initialHash);
            
    // Listen for hash changes
    window.addEventListener('hashchange', () => {
        Router.render(window.location.hash);
    });
});

// script.js
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.querySelector('.login-btn');
    const registerBtn = document.querySelector('.register-btn');

    loginBtn.addEventListener('click', () => {
        alert('Redirecting to login...');
        // Implement login logic here
    });

    registerBtn.addEventListener('click', () => {
        alert('Redirecting to registration...');
        // Implement registration logic here
    });
});
