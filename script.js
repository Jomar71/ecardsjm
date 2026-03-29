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

// --- AUTH ---
const Auth = {
    async login(username, password) {
        try {
            const data = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            state.isAdmin = data.user.is_admin;
            UI.hideAuth();
            Router.go('/admin');
        } catch (err) {
            UI.showError(err.message);
        }
    },

    async register(username, password) {
        try {
            const data = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            if (data.status === 'pending') {
                UI.showError('Cuenta creada - espera autorización admin');
            } else {
                state.token = data.token;
                state.user = data.user;
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                state.isAdmin = data.user.is_admin;
                UI.hideAuth();
                Router.go('/admin');
            }
        } catch (err) {
            UI.showError(err.message === 'USER_EXISTS' ? 'Usuario ya existe' : err.message);
        }
    },

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        state.token = null;
        state.user = null;
        state.isAdmin = false;
        Router.go('/');
    },

    updateAuthUI() {
        const guestNav = document.getElementById('auth-nav-guest');
        const userNav = document.getElementById('auth-nav-user');
        const avatar = document.getElementById('nav-avatar');
        const username = document.getElementById('nav-username');
        const adminBtn = document.getElementById('admin-users-btn');
        const divider = document.getElementById('admin-btn-divider');

        if (state.user) {
            guestNav.style.display = 'none';
            userNav.classList.remove('hidden');
            avatar.textContent = state.user.username.charAt(0).toUpperCase();
            username.textContent = state.user.username;
            if (state.isAdmin) {
                adminBtn?.classList.remove('hidden');
                divider?.classList.remove('hidden');
            }
        } else {
            guestNav.style.display = 'flex';
            userNav.classList.add('hidden');
        }
    }
};

// --- UI MANAGER ---
const UI = {
    showAuth(type) {
        const modal = document.getElementById('auth-modal');
        const loginForm = document.getElementById('auth-login');
        const registerForm = document.getElementById('auth-register');
        
        if (type === 'login') {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        } else {
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        }
        modal.classList.remove('hidden');
    },

    hideAuth() {
        document.getElementById('auth-modal').classList.add('hidden');
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
    },

    showError(message) {
        const banner = document.createElement('div');
        banner.className = 'error-banner';
        banner.innerHTML = `❌ ${message}`;
        banner.style.cssText = `
            position: fixed; top: 90px; left: 50%; transform: translateX(-50%);
            background: #ef4444; color: white; padding: 1rem 2rem; border-radius: 8px;
            z-index: 10000; font-weight: 600;
        `;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 5000);
    },

    async loadDashboard() {
        try {
            const data = await apiFetch('/cards');
            state.cards = data;
            const grid = document.getElementById('dashboard-grid');
            grid.innerHTML = data.map(card => `
                <div class="card-item" onclick="UI.loadCard('${card.id}')">
                    <div class="mini-card ${card.template_id || 'corporate'}">
                        <div class="mini-card-content">
                            <div class="mini-card-avatar corporate-av">C</div>
                            <div class="mini-card-name">${card.name || card['first-name'] || 'Tarjeta'}</div>
                            <div class="mini-card-title">${card.title}</div>
                        </div>
                    </div>
                    <div class="card-item-actions">
                        <span class="card-name">${card.name || card['first-name']}</span>
                        <div>
                            <button class="btn-icon" onclick="event.stopPropagation(); UI.loadCard('${card.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon" onclick="event.stopPropagation(); UI.deleteCard('${card.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('') + `
                <div class="add-card-btn" onclick="UI.newCard()">
                    <i class="fas fa-plus"></i>
                    <span>Nueva Tarjeta</span>
                </div>
            `;
        } catch (err) {
            console.error('Dashboard load error:', err);
        }
    },

    loadCard(id) {
        state.cardId = id;
        Router.go('/admin');
    },

    newCard() {
        state.cardId = null;
        document.getElementById('cardForm').reset();
        document.querySelectorAll('.tab-content input, .tab-content textarea, .tab-content select').forEach(el => {
            el.value = '';
        });
        UI.updatePreview();
        Router.go('/admin');
    },

    async saveCard() {
        const formData = new FormData(document.getElementById('cardForm'));
        const data = Object.fromEntries(formData);
        data.id = state.cardId || `card_${Date.now()}`;
        
        try {
            const result = await apiFetch('/cards', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            document.getElementById('save-success')?.classList.remove('hidden');
            setTimeout(() => document.getElementById('save-success')?.classList.add('hidden'), 3000);
            state.cardId = result.card.id;
            UI.loadDashboard();
        } catch (err) {
            UI.showError(err.message);
        }
    },

    async deleteCard(id) {
        if (!confirm('¿Eliminar tarjeta?')) return;
        try {
            await apiFetch(`/cards/${id}`, { method: 'DELETE' });
            UI.loadDashboard();
        } catch (err) {
            UI.showError('Error eliminando');
        }
    },

    async loadPublicCard(id) {
        try {
            const card = await apiFetch(`/cards/${id}`);
            // Render full card preview
            document.getElementById('public-view').innerHTML = `
                <div style="padding: 2rem;">
                    <div class="card-preview" style="background-image: url(${card.bg_image_path || ''});">
                        <!-- Full card render logic aquí -->
                        <h1>${card.name}</h1>
                        <p>${card.title}</p>
                        <!-- ... -->
                    </div>
                </div>
            `;
            // Generate QR
            UI.generateQR(`https://ecardsjm.pxxl.click/#/card/${id}`);
        } catch (err) {
            document.getElementById('public-view').innerHTML = '<div style="color: white; text-align: center; padding: 4rem;">Tarjeta no encontrada</div>';
        }
    },

    updatePreview() {
        // Update live preview from form
        const data = Object.fromEntries(new FormData(document.getElementById('cardForm')));
        document.getElementById('preview-name').textContent = data.name || data['first-name'] || 'Nombre';
        document.getElementById('preview-title').textContent = data.title || '';
        // ... more preview updates
    },

    generateQR(url) {
        const qrContainer = document.getElementById('preview-qr') || document.getElementById('preview-card-qr');
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: url,
            width: 128,
            height: 128,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    },

    async loadUsers() {
        try {
            const users = await apiFetch('/admin/users');
            const tbody = document.getElementById('users-list');
            tbody.innerHTML = users.map(user => `
                <tr>
                    <td>${user.username}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td><span class="status-badge ${user.is_authorized ? 'status-authorized' : 'status-pending'}">${user.is_authorized ? '✓ Autorizado' : '⏳ Pendiente'}</span></td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" ${user.is_authorized ? 'checked' : ''} onchange="UI.toggleUser(${user.id}, this.checked)">
                            <span class="slider"></span>
                        </label>
                        <button onclick="UI.deleteUser(${user.id})" class="btn-icon-mini ml-2">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Load users error:', err);
        }
    },

    async toggleUser(id, authorized) {
        try {
            await apiFetch(`/admin/users/${id}/authorize`, {
                method: 'POST',
                body: JSON.stringify({ is_authorized: authorized })
            });
            UI.loadUsers();
        } catch (err) {
            UI.showError('Error autorización');
        }
    },

    async deleteUser(id) {
        if (!confirm('¿Eliminar usuario?')) return;
        try {
            await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
            UI.loadUsers();
        } catch (err) {
            UI.showError('Error eliminación');
        }
    },

    showTab(event, tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        event.target.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    }
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    Auth.updateAuthUI();
    Router.render(window.location.hash);
    
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
    
    // Global error handler
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error);
    });
});

// Service Worker optional (PWA)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}
