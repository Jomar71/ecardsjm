/**
 * EliteCards Pro - Executive Intelligence Kernel
 * Frontend-only Implementation
 */

"use strict";

const state = {
    user: JSON.parse(localStorage.getItem('ecards_user')) || { id: 'local_user', username: 'guest' },
    token: localStorage.getItem('ecards_token'),
    cardId: null,
    isPublicView: false,
    logoPath: null,
    profilePath: null,
    bgImagePath: null,
    fontFilePath: null,
    archives: [],
    API_BASE: (() => {
        // Detectar si estamos en un entorno local o en producción
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || 
            hostname.match(/^192\.168\./) || 
            hostname.match(/^10\./) || 
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./) ||
            hostname.match(/\d+\.\d+\.\d+\.\d+/)) {
            // Si es una IP local o privada, usar el puerto 3000
            return `http://${hostname}:3000`;
        } else {
            // De lo contrario, usar el origen actual
            return window.location.origin;
        }
    })()
};

// --- API HELPER CORE ---
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
        ...options.headers
    };
    
    try {
        const response = await fetch(`${state.API_BASE}${endpoint}`, { ...options, headers });
        
        // Manejar respuestas que no sean JSON (como errores del servidor 502/HTML)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const body = await response.text();
            console.error("DEBUG - Response not JSON:", body.substring(0, 500));
            throw new Error(`Error del Servidor (${response.status}): No es JSON. Posible bloqueo de WAF o servidor caído.`);
        }

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

const Auth = {
    async check() {
        if (state.token && state.user && state.user.id !== 'local_user') {
            this.updateAuthUI();
        } else {
            this.logout(false); // Silent logout if no token
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-user').value;
        const password = document.getElementById('login-pass').value;
        
        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            if (data.status === 'success') {
                localStorage.setItem('ecards_user', JSON.stringify(data.user));
                localStorage.setItem('ecards_token', data.token);
                state.user = data.user;
                state.token = data.token;
                
                this.updateAuthUI();
                UI.hideAuth();
                Router.go('/admin');
                location.reload(); // Recargar para sincronizar estado
            }
        } catch (err) {
            alert("ERROR AL INICIAR SESIÓN: " + (err.message === 'INVALID_CREDENTIALS' ? 'Datos incorrectos' : err.message));
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('reg-user').value;
        const password = document.getElementById('reg-pass').value;

        try {
            const data = await apiFetch('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            if (data.status === 'success') {
                alert("REGISTRO EXITOSO. BIENVENIDO.");
                // Login automático después de registro
                localStorage.setItem('ecards_user', JSON.stringify(data.user));
                localStorage.setItem('ecards_token', data.token);
                state.user = data.user;
                state.token = data.token;
                
                this.updateAuthUI();
                UI.hideAuth();
                Router.go('/admin');
                location.reload();
            }
        } catch (err) {
            alert("ERROR AL REGISTRAR: " + (err.message === 'USER_EXISTS' ? 'El usuario ya existe' : err.message));
        }
    },

    async logout(redirect = true) {
        localStorage.removeItem('ecards_user');
        localStorage.removeItem('ecards_token');
        state.user = { id: 'local_user', username: 'guest' };
        state.token = null;
        this.updateAuthUI();
        if (redirect) Router.go('/');
    },

    updateAuthUI() {
        const isGuest = !state.token;
        const navGuest = document.getElementById('auth-nav-guest');
        const navUser = document.getElementById('auth-nav-user');
        
        if (isGuest) {
            navGuest?.classList.remove('hidden');
            navUser?.classList.add('hidden');
        } else {
            navGuest?.classList.add('hidden');
            navUser?.classList.remove('hidden');
            const navUsername = document.getElementById('nav-username');
            if (navUsername) navUsername.textContent = (state.user.username || 'USUARIO').toUpperCase();
            const navAvatar = document.getElementById('nav-avatar');
            if (navAvatar) navAvatar.textContent = (state.user.username?.[0] || 'U').toUpperCase();
        }
    }
};

const UI = {
    init() {
        this.cacheDOM();
        this.setupEventListeners();
        Auth.check().finally(() => {
            Router.render(window.location.hash || '#/');
            if (!state.isPublicView) this.updatePreview();
            if (this.loader) this.loader.classList.add('hidden');
        });
    },

    cacheDOM() {
        this.form = document.getElementById('cardForm');
        this.preview = document.getElementById('card-preview');
        this.loader = document.getElementById('loader');
        this.qrContainer = document.getElementById('preview-card-qr'); // Nuevo contenedor integrado
        this.contactsBox = document.getElementById('preview-contacts');
        this.socialBox = document.getElementById('preview-social');
        this.actionButtons = document.getElementById('preview-action-buttons');
        this.shareStrip = document.getElementById('preview-share-strip');
        this.publicView = document.getElementById('public-view');
        this.dashboardGrid = document.getElementById('dashboard-grid');
        const delBtn = document.getElementById('btn-delete-card');
        if (state.cardId) delBtn?.classList.remove('hidden');
        else delBtn?.classList.add('hidden');

        this.successBanner = document.getElementById('save-success');
    },

    setupEventListeners() {
        window.addEventListener('popstate', () => Router.render(window.location.pathname));
        if (this.form) {
            this.form.addEventListener('input', () => this.updatePreview());
            this.form.onsubmit = (e) => this.handleSubmit(e);
        }
        document.getElementById('logo')?.addEventListener('change', (e) => this.handleFileUpload(e, 'logoPath'));
        document.getElementById('profile')?.addEventListener('change', (e) => this.handleFileUpload(e, 'profilePath'));
        document.getElementById('bg_image')?.addEventListener('change', (e) => this.handleFileUpload(e, 'bgImagePath'));
        document.getElementById('font_file')?.addEventListener('change', (e) => this.handleFontFile(e));
    },

    showTab(event, tabId) {
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.remove('active');
            el.style.display = '';
        });
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const target = document.getElementById(tabId);
        if (target) target.classList.add('active');
        if (event) event.currentTarget.classList.add('active');
    },

    showAuth(mode) {
        document.getElementById('auth-modal').classList.remove('hidden');
        document.getElementById('auth-login').classList.toggle('hidden', mode === 'register');
        document.getElementById('auth-register').classList.toggle('hidden', mode === 'login');
    },

    hideAuth() { document.getElementById('auth-modal').classList.add('hidden'); },

    clearStudio() {
        state.cardId = null;
        state.logoPath = null;
        if (this.form) this.form.reset();
        this.updatePreview();
        if (this.qrContainer) this.qrContainer.innerHTML = `
            <i class="fas fa-qrcode"></i>
            <span>GUARDAR PARA QR</span>`;
    },

    async loadDashboard() {
        if (!this.dashboardGrid) return;
        
        // Limpiar dashboard
        const loaderText = document.getElementById('loader-text');
        if (loaderText) loaderText.textContent = 'Actualizando panel...';
        this.dashboardGrid.innerHTML = '<div class="loader"></div>';
        
        let allCards = [];
        
        // 1. Obtener tarjetas locales
        const localCards = this.getLocalCards();
        allCards = [...localCards];
        
        // 2. Intentar obtener tarjetas del servidor (solo si está logueado)
        if (state.token) {
            try {
                const serverCards = await apiFetch('/api/cards');
                
                if (Array.isArray(serverCards)) {
                    // Combinar sin duplicados
                    serverCards.forEach(sCard => {
                        if (!allCards.find(lCard => lCard.id === sCard.id)) {
                            allCards.push(sCard);
                        }
                    });
                }
            } catch (err) {
                console.warn("Could not fetch dashboard from server, using local only:", err);
            }
        } else {
            console.log("Not logged in - using local cards only for dashboard.");
        }


        this.dashboardGrid.innerHTML = '';
        
        if (allCards.length === 0) {
            this.dashboardGrid.innerHTML = `
                <div class="add-card-btn" onclick="UI.clearStudio(); Router.go('/admin')" style="grid-column: 1/-1;">
                    <i class="fas fa-plus-circle"></i>
                    <span>Crea tu primera tarjeta digital</span>
                </div>`;
            return;
        }
        
        allCards.forEach(card => {
            const item = document.createElement('div');
            item.className = 'card-item animate-in';
            // Generar URL para compartir la tarjeta (usamos window.location.origin para que funcione en red local o producción)
            const pubLink = `${window.location.origin}${window.location.pathname}#/card/${card.id}`;
            const templateClass = card.template_id || 'corporate';
            
            let profilePath = card.profile_path || null;
            
            item.innerHTML = `
                <div class="card-item-thumb">
                    <div class="mini-card ${templateClass}" style="width:100%; height:100%;">
                        <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.4rem;">
                            <div class="mini-card-avatar ${templateClass}-av">
                                ${profilePath ? `<img src="${profilePath}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '<i class="fas fa-user"></i>'}
                            </div>
                            <div class="mini-card-title" style="${(templateClass === 'minimal' || templateClass === 'minimal-modern') ? 'color:#64748B;' : ''}">${card.title || ''}</div>
                            <div id="qr-${card.id}" class="mini-qr" style="width:40px; height:40px; background:#fff; padding:2px; border-radius:4px; margin-top:0.2rem;"></div>
                        </div>
                        ${(templateClass !== 'minimal' && templateClass !== 'minimal-modern') ? '<div class="bottom-wave"></div>' : ''}
                    </div>
                </div>
                <div class="card-item-actions">
                    <span class="card-name">${(card['first-name'] && card['last-name'] ? (card['first-name'] + ' ' + card['last-name']).toUpperCase() : (card.name || 'Sin Nombre').toUpperCase())}</span>
                    <div style="display:flex; gap:0.4rem;">
                        <button class="btn btn-primary" style="font-size:0.7rem; padding:0.4rem 0.6rem; border-radius:6px;" onclick="UI.editCard('${card.id}')"><i class="fas fa-pen"></i> Editar</button>
                        <button class="btn-icon" title="Copiar Link" onclick="UI.copyLink('${pubLink}')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);"><i class="fas fa-copy"></i></button>
                        <button class="btn-icon" title="Ver Tarjeta" onclick="window.open('${pubLink}', '_blank'); event.stopPropagation();" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);"><i class="fas fa-external-link-alt"></i></button>
                    </div>
                </div>
            `;
            this.dashboardGrid.appendChild(item);
            
            // Generate the QR code for each dashboard item
            setTimeout(() => {
                const qrEl = document.getElementById(`qr-${card.id}`);
                if (qrEl) {
                    this.generateQR(pubLink, qrEl);
                    // Adjust QR image size specifically for mini-cards
                    const qrImg = qrEl.querySelector('img');
                    if (qrImg) {
                        qrImg.style.width = '36px';
                        qrImg.style.height = '36px';
                    }
                }
            }, 100);
        });

        // Botón de nueva tarjeta al final
        const addBtn = document.createElement('div');
        addBtn.className = 'add-card-btn';
        addBtn.onclick = () => { UI.clearStudio(); Router.go('/admin'); };
        addBtn.innerHTML = '<i class="fas fa-plus"></i><span>Nueva Tarjeta</span>';
        this.dashboardGrid.appendChild(addBtn);
    },

    getLocalCards() {
        const cardsStr = localStorage.getItem('ecards_cards');
        return cardsStr ? JSON.parse(cardsStr) : [];
    },

    saveLocalCard(card) {
        const cards = this.getLocalCards();
        const existingIndex = cards.findIndex(c => c.id === card.id);
        
        if (existingIndex >= 0) {
            cards[existingIndex] = card;
        } else {
            // Si es nueva tarjeta, asegurarse de que tenga un ID
            if (!card.id) {
                card.id = 'card_' + Date.now();
            }
            cards.push(card);
        }
        
        localStorage.setItem('ecards_cards', JSON.stringify(cards));
        return card;
    },

    async editCard(id) {
        const cards = this.getLocalCards();
        const card = cards.find(c => c.id === id);
        
        if (!card) {
            alert("ERROR AL CARGAR.");
            return;
        }
        
        state.cardId = card.id;
        state.logoPath = card.logo_path || null;
        state.profilePath = card.profile_path || null;
        state.bgImagePath = card.bg_image_path || null;
        state.fontFilePath = card.font_file_path || null;
        
        if (this.form) {
            Object.entries(card).forEach(([key, val]) => {
                const input = this.form.elements[key];
                if (input && input.type !== 'file') input.value = val || '';
            });

            // Ensure theme_selector is set if it exists in the form
            const themeSelector = this.form.elements['theme_selector'];
            if (themeSelector) {
                themeSelector.value = card.theme_selector || 'dark';
                document.documentElement.setAttribute('data-theme', card.theme_selector || 'dark');
            }

            // Ensure profile_position is set if it exists in the form
            const profilePosition = this.form.elements['profile_position'];
            if (profilePosition) {
                profilePosition.value = card.profile_position || 'default';
            }
        }
        
        this.updatePreview();
        Router.go('/admin');
        
        // Generar QR con la URL pública correcta (usando la dirección de GitHub Pages si estamos en producción)
        const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
        const baseUrl = isLocal ? window.location.origin + window.location.pathname : 'https://jomar71.github.io/ecardsjm/';
        const cardUrl = `${baseUrl}#/card/${state.cardId}`;
        this.generateQR(cardUrl);
    },

    async handleSubmit(e) {
        e.preventDefault();
        if (this.loader) this.loader.classList.remove('hidden');
        
        try {
            // Recoger los datos del formulario
            const cardData = {};
            const formElements = this.form.elements;
            for (let i = 0; i < formElements.length; i++) {
                const el = formElements[i];
                if (el.tagName !== 'BUTTON' && el.type !== 'file') {
                    const key = el.name || el.id;
                    if (key) cardData[key] = el.value;
                }
            }
            
            // Agregar IDs y paths
            if (state.cardId) cardData.id = state.cardId;
            if (state.logoPath) cardData.logo_path = state.logoPath;
            if (state.profilePath) cardData.profile_path = state.profilePath;
            if (state.bgImagePath) cardData.bg_image_path = state.bgImagePath;
            if (state.fontFilePath) cardData.font_file_path = state.fontFilePath;
            
            // Generar ID si es nueva
            if (!cardData.id) {
                const firstName = document.getElementById('first-name')?.value || cardData['first-name'] || '';
                const firstSurname = document.getElementById('last-name')?.value || cardData['last-name'] || '';
                if (firstName && firstSurname) {
                    cardData.id = `${firstName.toLowerCase()}_${firstSurname.toLowerCase()}`.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                } else {
                    cardData.id = 'card_' + Date.now();
                }
            }
            
            // 1. GUARDADO LOCAL (Instantáneo)
            this.saveLocalCard(cardData);
            state.cardId = cardData.id;

            // 2. MOSTRAR PREVIEW Y ÉXITO
            if (this.successBanner) {
                this.successBanner.classList.remove('hidden');
                setTimeout(() => this.successBanner.classList.add('hidden'), 3000);
            }
            
            // 3. GENERAR QR DINÁMICAMENTE
            const baseUrl = window.location.origin + (window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/');
            const cardUrl = `${baseUrl}#/card/${state.cardId}`;
            this.generateQR(cardUrl, this.qrContainer);

            // 4. SINCRONIZAR EN LA NUBE (Solo si está logueado)
            if (state.token) {
                try {
                    await apiFetch('/api/cards', {
                        method: 'POST',
                        body: JSON.stringify(cardData)
                    });
                    console.log("Cloud sync successful");
                } catch (e) {
                    console.error("Cloud sync failed:", e);
                    alert("⚠️ Error: La tarjeta se guardó localmente, pero no pudo sincronizarse en la nube. Verifica tu conexión o intenta de nuevo. Detalle: " + e.message);
                }
            } else {
                console.log("Not logged in - saving locally only.");
            }

            // Ocultar Loader
            if (this.loader) this.loader.classList.add('hidden');

            // ACTUALIZAR DASHBOARD INTEGRADO
            this.loadDashboard();
            
            // NO REDIRIGIR A DASHBOARD, QUEDARSE EN ADMIN
            // setTimeout(() => Router.go('/dashboard'), 1000);

        } catch (err) {
            console.error("Save error:", err);
            alert("Hubo un problema al guardar. Revisa los datos e intenta de nuevo.");
        } finally {
            if (this.loader) this.loader.classList.add('hidden');
        }
    },


    generateQR(url, targetElement = null) {
        const container = targetElement || this.qrContainer;
        if (!container) return;
        
        // Limpiar contenedor
        container.innerHTML = '';
        container.style.opacity = '1';
        
        // Verificar si QRCode está disponible
        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(container, { 
                    text: url, 
                    width: 90, 
                    height: 90, 
                    colorDark: "#003366", 
                    colorLight: "#FFFFFF", 
                    correctLevel: QRCode.CorrectLevel.H 
                });
            } catch (error) {
                console.error('Error generando el código QR:', error);
                // Mostrar un mensaje de error en el contenedor
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#94a3b8;font-size:0.7rem;text-align:center;padding:5px;">Error<br>QR</div>';
            }
        } else {
            // Si la librería no está disponible, esperar y reintentar
            let attempts = 0;
            const maxAttempts = 20; // Máximo de 10 segundos
            
            const checkAndRender = () => {
                attempts++;
                if (typeof QRCode !== 'undefined') {
                    try {
                        new QRCode(container, { 
                            text: url, 
                            width: 90, 
                            height: 90, 
                            colorDark: "#003366", 
                            colorLight: "#FFFFFF", 
                            correctLevel: QRCode.CorrectLevel.H 
                        });
                    } catch (error) {
                        console.error('Error generando el código QR:', error);
                        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#94a3b8;font-size:0.7rem;text-align:center;padding:5px;">Error<br>QR</div>';
                    }
                } else if (attempts < maxAttempts) {
                    setTimeout(checkAndRender, 500); // Reintentar cada 500ms
                } else {
                    // Mostrar un mensaje de error si no se carga después de varios intentos
                    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#94a3b8;font-size:0.7rem;text-align:center;padding:5px;">Librería<br>QR</div>';
                    console.warn('La librería QRCode no se ha cargado después de varios intentos');
                }
            };
            
            setTimeout(checkAndRender, 500);
        }
    },

    handleFileUpload(e, targetPath) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Convertir y comprimir archivo a base64 (reduce QuotaExceededError)
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 500; // Máximo ancho o alto
                let width = img.width;
                let height = img.height;
                
                // Redimensionar si excede el máximo
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height *= maxDim / width;
                        width = maxDim;
                    } else {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Mantener PNG para fondo transparente o JPEG para compresión
                const format = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
                const quality = format === 'image/jpeg' ? 0.85 : undefined;
                
                state[targetPath] = canvas.toDataURL(format, quality);
                this.updatePreview();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    },

    handleFontFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            state.fontFilePath = event.target.result;
            this.updatePreview();
        };
        reader.readAsDataURL(file);
    },

    isLightColor(hex) {
        if (!hex || hex === 'transparent') return false;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 155;
    },

    async deleteCurrentCard() {
        if (!state.cardId) return;
        if (!confirm("¿ESTÁS SEGURO DE ELIMINAR ESTA IDENTIDAD? ESTA ACCIÓN ES IRREVERSIBLE.")) return;

        // 1. Eliminar de la nube (si está logueado)
        if (state.token) {
            try {
                await apiFetch(`/api/cards/${state.cardId}`, { method: 'DELETE' });
                console.log("Cloud deletion successful");
            } catch (err) {
                console.error("Could not delete from cloud:", err);
            }
        }

        // 2. Eliminar tarjeta de localStorage
        let cards = this.getLocalCards();
        cards = cards.filter(card => card.id !== state.cardId);
        localStorage.setItem('ecards_cards', JSON.stringify(cards));
        
        alert("IDENTIDAD ELIMINADA.");
        state.cardId = null;
        this.clearStudio();
        this.loadDashboard();
        Router.go('/admin');
    },

    copyLink(url) {
        // En lugar de navigator.clipboard, usar un método compatible más ampliamente
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert("LINK COPIADO AL PORTAPAPELES");
    },

    // --- Core Engine: Multi-Template Hybrid Rendering ---
    updatePreview(customData = null) {
        const data = customData || (this.form ? Object.fromEntries(new FormData(this.form).entries()) : {});
        const n = document.getElementById('preview-name');
        const pt = document.getElementById('preview-prof-title');
        const c = document.getElementById('preview-company');
        const d = document.getElementById('preview-description');
        const addr = document.getElementById('preview-address');
        const web = document.getElementById('preview-website');
        const preview = document.getElementById('card-preview');

        // Combinar nombre y apellido para mostrar el nombre completo
        const firstName = document.getElementById('first-name')?.value || data['first-name'] || '';
        const lastName = document.getElementById('last-name')?.value || data['last-name'] || '';
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'NOMBRE COMPLETO';

        if (n) n.textContent = fullName.toUpperCase();
        if (pt) pt.textContent = (data.professional_title || 'CARGO O TÍTULO').toUpperCase();
        if (c) c.textContent = (data.company || 'EMPRESA').toUpperCase();
        if (d) d.textContent = data.experience_summary || 'Esta es tu descripción empresarial profesional.';
        if (addr) addr.textContent = data.address || '';
        if (web) web.textContent = data.website || '';

        // Apply Custom Branding
        if (preview) {
            // Apply Template Class (Preserving layout classes)
            preview.className = `card-preview animate-in template-${data.template_id || 'corporate'}`;

            // Apply theme if selected
            const theme = data.theme_selector || 'dark';
            document.documentElement.setAttribute('data-theme', theme);

            if (state.bgImagePath) {
                preview.style.backgroundImage = `url(${state.bgImagePath})`;
                preview.style.backgroundSize = 'cover';
                preview.style.backgroundPosition = 'center';
            } else {
                // If NO user image, use system template gradient/color
                preview.style.backgroundImage = '';
                
                if (data.bg_color && data.bg_color !== '#0B0F19' && data.bg_color !== '#000000') {
                    preview.style.backgroundColor = data.bg_color;
                } else {
                    preview.style.backgroundColor = ''; // Use CSS default
                }

                // Apply default gradients for specific templates if no custom background
                if (!data.bg_color || data.bg_color === '#0B0F19' || data.bg_color === '#000000') {
                    if (!data.template_id || data.template_id === 'corporate') {
                        preview.style.backgroundImage = `linear-gradient(135deg, ${data.bg_color || '#0B0F19'} 0%, #001A33 100%)`;
                    } else if (data.template_id === 'creative') {
                        preview.style.backgroundImage = `radial-gradient(circle at top right, ${data.primary_color || '#1A1C2C'} 0%, ${data.bg_color || '#000000'} 100%)`;
                    } else if (data.template_id === 'vertical') {
                        preview.style.backgroundImage = `linear-gradient(180deg, #1E293B 0%, #0F172A 100%)`;
                    } else if (data.template_id === 'executive') {
                        preview.style.backgroundImage = `linear-gradient(135deg, #1e1e1e 0%, #111 100%)`;
                    } else if (data.template_id === 'neotech') {
                        preview.style.backgroundImage = `radial-gradient(circle at 50% 50%, #1a103d 0%, #050505 100%)`;
                    } else if (data.template_id === 'minimal-modern') {
                        preview.style.backgroundImage = `linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%)`;
                    }
                }
            }
            preview.style.color = (data.template_id === 'classic' || data.template_id === 'minimal-modern') ? (data.text_color || '#333') : (data.text_color || '#FFFFFF');
            preview.style.fontFamily = data.font_family || "'Plus Jakarta Sans', sans-serif";

            // Apply profile position
            const profileContainer = document.querySelector('.profile-container');
            if (profileContainer) {
                // Remove any previously applied position classes
                profileContainer.classList.remove('top-center', 'top-left', 'top-right', 'center', 'bottom-center', 'bottom-left', 'bottom-right');
                
                // Add the selected position class if it's not default
                if (data.profile_position && data.profile_position !== 'default') {
                    profileContainer.classList.add(data.profile_position);
                } else {
                    // Ensure the default positioning is maintained
                    profileContainer.classList.remove(...profileContainer.classList);
                    profileContainer.classList.add('profile-container');
                }
            }

            // Import Template (Apply Custom CSS)
            let customStyleTag = document.getElementById('runtime-custom-css');
            if (!customStyleTag) {
                customStyleTag = document.createElement('style');
                customStyleTag.id = 'runtime-custom-css';
                document.head.appendChild(customStyleTag);
            }
            customStyleTag.innerHTML = data.custom_css || '';

            // Import Fonts (Dynamic Google Font loading)
            if (data.custom_fonts && data.custom_fonts.startsWith('http')) {
                let fontLink = document.getElementById('runtime-custom-font');
                if (!fontLink) {
                    fontLink = document.createElement('link');
                    fontLink.id = 'runtime-custom-font';
                    fontLink.rel = 'stylesheet';
                    document.head.appendChild(fontLink);
                }
                fontLink.href = data.custom_fonts;
            }

            // Import Custom Font File (@font-face injection)
            let fontFaceTag = document.getElementById('runtime-font-face');
            if (state.fontFilePath) {
                if (!fontFaceTag) {
                    fontFaceTag = document.createElement('style');
                    fontFaceTag.id = 'runtime-font-face';
                    document.head.appendChild(fontFaceTag);
                }
                fontFaceTag.innerHTML = `
                    @font-face {
                        font-family: 'UploadedCustomFont';
                        src: url('${state.fontFilePath}');
                    }
                `;
                preview.style.fontFamily = "'UploadedCustomFont', sans-serif";
            } else if (!data.custom_fonts) {
                if (fontFaceTag) fontFaceTag.innerHTML = '';
            }
        }

        // Update vertical contacts preview (Left)
        const verticalContacts = document.getElementById('preview-vertical-contacts');
        if (verticalContacts) {
            const phone = document.getElementById('phone')?.value || data.phone;
            const email = document.getElementById('email')?.value || data.email;
            const address = document.getElementById('address')?.value || data.address;
            
            verticalContacts.innerHTML = `
                ${phone ? `<div style="color: var(--primary); font-size: 1.25rem;"><i class="fas fa-phone-circle"></i></div>` : ''}
                ${email ? `<div style="color: var(--text-primary); font-size: 1.25rem;"><i class="fas fa-envelope-open-text"></i></div>` : ''}
                ${address ? `<div style="color: var(--text-secondary); font-size: 1.25rem;"><i class="fas fa-location-dot"></i></div>` : ''}
            `;
        }

        // Update social links preview (Bottom row)
        const socialContainer = document.getElementById('preview-social-footer');
        if (socialContainer && !customData) { // Only update if not receiving custom data
            const socialPlatforms = ['linkedin', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'github'];
            const socialLinks = [];

            socialPlatforms.forEach(platform => {
                const value = document.getElementById(platform)?.value;
                if (value) {
                    let href = value;
                    if (!value.startsWith('http')) {
                        if (platform === 'email') href = `mailto:${value}`;
                        else if (platform === 'phone') href = `tel:${value}`;
                        else if (platform === 'whatsapp') href = `https://wa.me/${value}`;
                        else href = `https://${platform}.com/${value}`;
                    }

                    const iconClass = platform === 'twitter' ? 'fab fa-x-twitter' : `fab fa-${platform}`;
                    socialLinks.push(`<a href="${href}" target="_blank" style="color:var(--text-primary); opacity:0.8; font-size: 1.2rem;"><i class="${iconClass}"></i></a>`);
                }
            });

            socialContainer.innerHTML = socialLinks.length > 0 ? socialLinks.join('') : '';
        }

        // Update action buttons preview
        const actionContainer = document.getElementById('preview-action-buttons');
        if (actionContainer) {
            actionContainer.innerHTML = `
                <button class="btn-card-action primary">Guardar Contacto</button>
            `;
        }

        // --- NEW: Dynamic QR updates in preview ---
        if (state.cardId && this.qrContainer) {
            const baseUrl = window.location.origin + (window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/');
            const cardUrl = `${baseUrl}#/card/${state.cardId}`;
            this.generateQR(cardUrl, this.qrContainer);
        }

        // Update share strip preview
        const shareStrip = document.getElementById('preview-share-strip');
        if (shareStrip) {
            shareStrip.innerHTML = '';
        }
    },

    getSocialLink(key, val) {
        if (!val) return '#';
        if (val.startsWith('http')) return val;
        const base = {
            linkedin: 'https://linkedin.com/in/',
            whatsapp: 'https://wa.me/',
            instagram: 'https://instagram.com/',
            facebook: 'https://facebook.com/',
            tiktok: 'https://tiktok.com/@',
            youtube: 'https://youtube.com/@',
            twitter: 'https://x.com/',
            github: 'https://github.com/'
        };
        let clean = val;
        if (key === 'whatsapp') clean = val.replace(/\D/g, '');
        return (base[key] || '') + clean;
    },

    // Función para el botón de guardar que se llama desde el HTML
    saveCard() {
        if (this.form) {
            // Simular envío del formulario
            this.form.dispatchEvent(new Event('submit'));
        }
    },

    async loadPublicCard(id) {
        const loaderText = document.getElementById('loader-text');
        if (document.getElementById('loader')) {
            document.getElementById('loader').classList.remove('hidden');
            if (loaderText) loaderText.textContent = 'Buscando identidad en la nube integrada...';
        }

        // Buscar la tarjeta en localStorage
        const localCards = this.getLocalCards();
        let card = localCards.find(c => c.id === id);
        
        if (!card) {
            // Intentar buscar en el servidor si no está local
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s para despertar Render

                const response = await fetch(`${state.API_BASE}/api/cards/${id}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (response.ok) {
                    card = await response.json();
                }
            } catch (err) {
                console.error("Error fetching card from server:", err);
            } finally {
                if (document.getElementById('loader')) document.getElementById('loader').classList.add('hidden');
            }
        } else {
            if (document.getElementById('loader')) document.getElementById('loader').classList.add('hidden');
        }

        if (card) {
            this.renderPublicCard(card);
        } else {
            console.warn(`Card with ID ${id} not found locally or on server.`);
            const publicView = document.getElementById('public-view');
            if (publicView) {
                publicView.innerHTML = `
                    <div style="min-height:80vh; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-secondary); text-align:center; padding:2rem;">
                        <i class="fas fa-id-card" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                        <h2 style="font-size:1.8rem; margin-bottom:1rem; opacity:0.8;">Tarjeta no encontrada</h2>
                        <p style="font-size:1rem; margin-bottom:2rem; opacity:0.7; max-width:500px;">La tarjeta que buscas no existe o ha sido eliminada. Es posible que el enlace haya expirado o que la tarjeta haya sido eliminada por el propietario.</p>
                        <button class="btn btn-primary" onclick="Router.go('/')" style="margin:0 auto;">Volver al inicio</button>
                    </div>
                `;
            }
        }
    },

    // --- Core Engine: Multi-Template Hybrid Rendering ---
    renderPublicCard(card) {
        const publicView = document.getElementById('public-view');
        if (!publicView) return;
        
        // Get the template ID or default to 'corporate'
        const templateId = card.template_id || 'corporate';
        
        // Get theme selection or default to dark
        const theme = card.theme_selector || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        
        // Generate full name from first and last name
        const firstName = card['first-name'] || '';
        const lastName = card['last-name'] || '';
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : card.name || 'Nombre Completo';
        
        // Get profile image or fallback to initials
        let profileImageHtml = '';
        if (card.profile_path) {
            profileImageHtml = `<img src="${card.profile_path}" alt="${fullName}">`;
        } else {
            const initials = ((firstName.charAt(0) || '') + (lastName.charAt(0) || '')).toUpperCase();
            profileImageHtml = `<i class="fas fa-user"></i>`;
        }
        
        // Get profile position or default
        const profilePosition = card.profile_position || 'default';
        const positionClass = profilePosition !== 'default' ? profilePosition : '';
        
        // Build contact items HTML
        const contactItems = [];
        if (card.email) contactItems.push(`<a href="mailto:${card.email}" class="contact-item"><i class="fas fa-envelope" style="font-size: 1.1rem; width:25px;"></i> <span>${card.email}</span></a>`);
        if (card.phone) contactItems.push(`<a href="tel:${card.phone}" class="contact-item"><i class="fas fa-phone" style="font-size: 1.1rem; width:25px;"></i> <span>${card.phone}</span></a>`);
        if (card.website) contactItems.push(`<a href="${card.website.startsWith('http') ? card.website : 'http://' + card.website}" target="_blank" class="contact-item"><i class="fas fa-globe" style="font-size: 1.1rem; width:25px;"></i> <span>${card.website}</span></a>`);
        if (card.address) contactItems.push(`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}" target="_blank" class="contact-item"><i class="fas fa-location-dot" style="font-size: 1.1rem; width:25px;"></i> <span>${card.address}</span></a>`);
        
        // Build social links HTML
        const socialLinks = [];
        const socialPlatforms = ['linkedin', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'github'];
        socialPlatforms.forEach(platform => {
            if (card[platform]) {
                let href = card[platform];
                if (!href.startsWith('http')) {
                    if (platform === 'email') href = `mailto:${href}`;
                    else if (platform === 'phone') href = `tel:${href}`;
                    else if (platform === 'whatsapp') {
                        // Limpiar el número de teléfono para el formato internacional
                        const phoneNumber = href.replace(/[^\d+]/g, '');
                        href = `https://wa.me/${phoneNumber}`;
                    }
                    else href = `https://${platform}.com/${href}`;
                }
                
                const iconClass = platform === 'twitter' ? 'fab fa-x-twitter' : `fab fa-${platform}`;
                socialLinks.push(`<a href="${href}" target="_blank" class="social-icon-link"><i class="${iconClass}"></i></a>`);
            }
        });
        
        // Build custom styles for the card
        let customStyles = '';
        if (card.custom_css) {
            customStyles += card.custom_css;
        }
        
        // Render the card HTML
        publicView.innerHTML = `
            <style>${customStyles}</style>
            <div class="card-preview template-${templateId}" style="
                ${card.bg_color && card.bg_color !== '#0B0F19' && card.bg_color !== '#000000' ? `background-color: ${card.bg_color};` : ''}
                ${card.bg_image_path ? `background-image: url('${card.bg_image_path}'); background-size: cover; background-position: center;` : ''}
                color: ${card.text_color || '#FFFFFF'};
                font-family: ${card.font_family || "'Plus Jakarta Sans', sans-serif"};
            ">
                <div class="card-content">
                    <!-- Decorative elements -->
                    ${templateId !== 'minimal' && templateId !== 'minimal-modern' ? '<div class="deco-circle c1"></div>' : ''}
                    ${templateId !== 'minimal' && templateId !== 'minimal-modern' ? '<div class="deco-circle c2"></div>' : ''}
                    ${templateId !== 'minimal' && templateId !== 'minimal-modern' ? '<div class="deco-circle c3"></div>' : ''}
                    ${templateId !== 'minimal' && templateId !== 'minimal-modern' ? '<div class="deco-circle c4"></div>' : ''}
                    
                    ${templateId === 'corporate' ? `
                    <!-- Corporate premium template -->
                    <div class="template-corporate">
                        <div class="corporate-header">
                            <div class="qr-stylized-container">
                                <div class="qr-corners">
                                    <span class="cor-tl"></span><span class="cor-tr"></span>
                                    <span class="cor-bl"></span><span class="cor-br"></span>
                                </div>
                                <div id="preview-qr" style="width: 100%; height: 100%;"></div>
                            </div>
                        </div>

                        <div class="profile-container-modern">
                            <div class="profile-img-wrap">
                                ${profileImageHtml}
                            </div>
                        </div>

                        <div class="content-row-modern">
                            <div class="vertical-contact-strip">
                                ${card.phone ? `<div style="color: var(--accent);"><i class="fas fa-phone"></i></div>` : ''}
                                ${card.email ? `<div style="color: #fff;"><i class="fas fa-envelope"></i></div>` : ''}
                                ${card.address ? `<div style="color: var(--text-secondary);"><i class="fas fa-location-dot"></i></div>` : ''}
                            </div>
                            
                            <div class="corporate-main-content">
                                <h1>${fullName.toUpperCase()}</h1>
                                <div class="title-modern">${(card.professional_title || 'CARGO O TÍTULO').toUpperCase()}</div>
                                <p class="desc-modern">${card.experience_summary || 'Esta es tu descripción empresarial profesional.'}</p>
                            </div>
                        </div>

                        <div class="card-footer-modern">
                            <div class="social-footer-row">
                                <div class="social-icons-footer">
                                    ${socialLinks.join('')}
                                </div>
                                <button class="btn btn-primary btn-save" style="padding: 0.5rem 1.25rem; font-size: 0.75rem;">GUARDAR</button>
                            </div>
                        </div>
                    </div>
                    ` : templateId === 'classic' ? `
                    <!-- Classic template header -->
                    <div class="card-header">
                        <div class="brand-text">${card.company || 'EMPRESA'}</div>
                    </div>
                    
                    <!-- Classic template body -->
                    <div class="card-body-flex">
                        <div class="profile-container ${positionClass}">
                            <div id="preview-logo-box">
                                ${profileImageHtml}
                            </div>
                        </div>
                        
                        <div class="card-text-block">
                            <h2 id="preview-name">${fullName.toUpperCase()}</h2>
                            <h3 id="preview-title">${(card.professional_title || 'CARGO O TÍTULO').toUpperCase()}</h3>
                            <p class="card-desc">${card.experience_summary || 'Esta es tu descripción empresarial profesional.'}</p>
                        </div>
                    </div>
                    
                    <!-- Contact info section -->
                    <div class="contact-container" style="display: flex; flex-direction: column; gap: 0.5rem; margin: 1rem 0;">
                        ${contactItems.join('')}
                    </div>

                    <!-- Standard Footer Elements (QR & Social) -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2rem;">
                         <div class="qr-stylized-container" style="position: relative; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid var(--border);">
                             <div class="qr-corners">
                                 <span class="cor-tl"></span><span class="cor-tr"></span>
                                 <span class="cor-bl"></span><span class="cor-br"></span>
                             </div>
                             <div id="preview-qr" style="width: 100px; height: 100px;"></div>
                         </div>
                    </div>

                    <div class="card-footer-actions" style="margin-top: 1.5rem;">
                        <button class="btn btn-primary btn-full btn-save">Guardar Contacto</button>
                    </div>
                    ` : `
                    <!-- Standard template layout -->
                    <div class="card-top-bar" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                        <div class="company-brand-box">
                            <div class="company-logo-ring" style="width: 45px; height: 45px; border: 2px solid var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 0.5rem;">
                                ${card.logo_path ? `<img src="${card.logo_path}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">` : '<i class="fas fa-building" style="color: var(--primary);"></i>'}
                            </div>
                            <div class="brand-text" style="font-weight: 700; font-size: 0.9rem; letter-spacing: 1px;">${card.company || 'EMPRESA'}</div>
                        </div>
                        
                        <div class="profile-container ${positionClass}">
                            <div id="preview-logo-box" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--primary); overflow: hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
                                ${profileImageHtml}
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-text-block" style="margin-bottom: 1.5rem;">
                        <h2 id="preview-name" style="font-size: 1.8rem; font-weight: 800; margin: 0; line-height: 1.1;">${fullName.toUpperCase()}</h2>
                        <h3 id="preview-title" style="font-size: 1rem; color: var(--primary); margin: 0.3rem 0; font-weight: 600;">${(card.professional_title || 'CARGO O TÍTULO').toUpperCase()}</h3>
                        <p class="card-desc" style="font-size: 0.9rem; opacity: 0.8; margin-top: 1rem; line-height: 1.5; font-style: italic;">${card.experience_summary || 'Esta es tu descripción empresarial profesional.'}</p>
                    </div>
                    
                    <!-- Contact info section -->
                    <div class="contact-container" style="display: flex; flex-direction: column; gap: 0.6rem; margin: 1.5rem 0; border-left: 2px solid var(--primary); padding-left: 1rem;">
                        ${contactItems.join('')}
                    </div>

                    <!-- Footer Elements for Standard -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2rem;">
                         <div id="preview-qr" style="width: 80px; height: 80px;"></div>
                         ${socialLinks.length > 0 ? `<div style="display: flex; gap: 1rem;">${socialLinks.slice(0, 3).join('')}</div>` : ''}
                    </div>

                    <div class="card-footer-actions" style="margin-top: 1.5rem;">
                        <button class="btn btn-primary btn-full btn-save">Guardar Contacto</button>
                    </div>
                    `}
                </div>
            </div>
        `;
        
        // Generate QR code for the current page URL
        const qrContainer = document.getElementById('preview-qr');
        if (qrContainer) {
            // Usar la URL de la tarjeta específica
            const cardUrl = `${window.location.origin}${window.location.pathname}#/card/${card.id}`;
            this.generateQR(cardUrl, qrContainer);
        }
        
        // Add event listeners for action buttons
        const actionButtons = publicView.querySelectorAll('.btn-card-action');
        actionButtons.forEach(button => {
            // Solo hay un botón ahora: "Guardar Contacto"
            button.addEventListener('click', () => {
                // Guardar contacto lógica
                const vCardData = `BEGIN:VCARD\nVERSION:3.0\nFN:${fullName}\nORG:${card.company || ''}\nTITLE:${card.professional_title || card.title || ''}\nTEL;TYPE=WORK,VOICE:${card.phone || ''}\nEMAIL;TYPE=PREF,INTERNET:${card.email || ''}\nURL:${card.website || ''}\nADR;TYPE=WORK:;;${card.address || ''}\nNOTE:${card.experience_summary || ''}\nEND:VCARD`;
                
                const blob = new Blob([vCardData], { type: 'text/vcard' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `${fullName}.vcf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        });
    },

    downloadVCard(card) {
        // Combinar nombre y apellido para el vCard
        const firstName = card['first-name'] || card.name || '';
        const lastName = card['last-name'] || '';
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Contacto';
        
        const v = `BEGIN:VCARD\nVERSION:3.0\nFN:${fullName}\nORG:${card.company || ''}\nTITLE:${card.professional_title || card.title || ''}\nTEL;TYPE=WORK,VOICE:${card.phone || ''}\nEMAIL;TYPE=PREF,INTERNET:${card.email || ''}\nURL:${card.website || ''}\nADR;TYPE=WORK:;;${card.address || ''}\nNOTE:${card.experience_summary || ''}\nEND:VCARD`;
        const b = new Blob([v], { type: 'text/vcard' });
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(b); 
        a.download = `${fullName}.vcf`; 
        a.click();
    }
};

window.UI = UI; window.Auth = Auth; window.Router = Router;

// Verificar si hay una tarjeta específica en el hash al cargar
document.addEventListener('DOMContentLoaded', () => {
    // Primero inicializamos la autenticación
    Auth.check().finally(() => {
        UI.init();
    });
});