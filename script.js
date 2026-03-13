/**
 * EliteCards Pro - Executive Intelligence Kernel
 * Frontend-only Implementation
 */

"use strict";

const state = {
    user: { id: 'local_user', username: 'guest' }, // Usuario local predeterminado
    cardId: null,
    isPublicView: false,
    logoPath: null,
    profilePath: null,
    bgImagePath: null,
    fontFilePath: null,
    archives: [],
    API_BASE: '' // No necesitamos backend
};

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
            if (pub) pub.classList.remove('hidden');
            if (root) root.classList.add('hidden');
            if (header) header.classList.add('hidden');
            const id = path.split('/').pop();
            UI.loadPublicCard(id);
            return;
        }

        state.isPublicView = false;
        if (root) root.classList.remove('hidden');
        if (pub) pub.classList.add('hidden');
        if (header) header.classList.remove('hidden');
        document.body.style.backgroundColor = ''; // Restore default

        if (path === '/admin') {
            document.getElementById('view-admin')?.classList.remove('hidden');
            const delBtn = document.getElementById('btn-delete-card');
            if (state.cardId) delBtn?.classList.remove('hidden');
            else delBtn?.classList.add('hidden');
        } else if (path === '/dashboard') {
            document.getElementById('view-dashboard')?.classList.remove('hidden');
            UI.loadDashboard();
        } else {
            document.getElementById('view-home')?.classList.remove('hidden');
        }
    }
};

// Initial routing setup
window.addEventListener('hashchange', () => Router.render(window.location.hash));
window.addEventListener('load', () => {
    // Check if there's a stored hash from a 404 redirect
    const stored = sessionStorage.getItem('storedHash');
    if (stored) {
        sessionStorage.removeItem('storedHash');
        Router.go(stored);
    } else {
        Router.render(window.location.hash || '#/');
    }
});

const Auth = {
    async check() {
        // Verificar si hay un usuario guardado en localStorage
        const savedUser = localStorage.getItem('ecards_user');
        if (savedUser) {
            this.onLogin(JSON.parse(savedUser));
        } else {
            // Por defecto, creamos un usuario local
            this.onLogin(state.user);
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        
        // Validar credenciales (contraseña por defecto admin123)
        if (pass === 'admin123') {
            const userData = { id: 'local_user_' + Date.now(), username: user || 'Usuario' };
            localStorage.setItem('ecards_user', JSON.stringify(userData));
            this.onLogin(userData);
            UI.hideAuth();
            Router.go('/dashboard');
        } else {
            alert("CREDENCIALES INVÁLIDAS.");
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const user = document.getElementById('reg-user').value;
        const pass = document.getElementById('reg-pass').value;
        
        if (pass === 'admin123') {
            const userData = { id: 'local_user_' + Date.now(), username: user || 'Usuario' };
            localStorage.setItem('ecards_user', JSON.stringify(userData));
            alert("REGISTRO EXITOSO. INICIA SESIÓN.");
            UI.showAuth('login');
        } else {
            alert("ERROR: Contraseña inválida. Use 'admin123'");
        }
    },

    async logout() {
        localStorage.removeItem('ecards_user');
        state.user = { id: 'local_user', username: 'guest' };
        document.getElementById('auth-nav-guest').classList.remove('hidden');
        document.getElementById('auth-nav-user').classList.add('hidden');
        Router.go('/');
    },

    onLogin(user) {
        state.user = user;
        document.getElementById('auth-nav-guest').classList.add('hidden');
        document.getElementById('auth-nav-user').classList.remove('hidden');
        const navUsername = document.getElementById('nav-username');
        if (navUsername) navUsername.textContent = user.username.toUpperCase();
        const navAvatar = document.getElementById('nav-avatar');
        if (navAvatar) navAvatar.textContent = user.username.charAt(0).toUpperCase();
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
        this.qrContainer = document.getElementById('preview-qr');
        this.contactsBox = document.getElementById('preview-contacts');
        this.socialBox = document.getElementById('preview-social');
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
        this.dashboardGrid.innerHTML = '';
        
        // Obtener tarjetas de localStorage
        const cards = this.getLocalCards();
        
        if (cards.length === 0) {
            this.dashboardGrid.innerHTML = `
                <div class="add-card-btn" onclick="UI.clearStudio(); Router.go('/admin')" style="grid-column: 1/-1;">
                    <i class="fas fa-plus-circle"></i>
                    <span>Crea tu primera tarjeta digital</span>
                </div>`;
            return;
        }
        
        cards.forEach(card => {
            const item = document.createElement('div');
            item.className = 'card-item animate-in';
            // Generar URL para compartir la tarjeta
            const pubLink = window.location.origin + window.location.pathname + `#card/${card.id}`;
            const templateClass = card.template_id || 'corporate';
            const avatarIcons = { corporate: 'fa-user-tie', minimal: 'fa-pencil-ruler', creative: 'fa-code' };
            const icon = avatarIcons[templateClass] || 'fa-user-tie';
            
            // Preparar la ruta de la imagen de perfil
            let profilePath = null;
            if (card.profile_path) {
                // Si la imagen está en base64 o ya es una URL válida
                profilePath = card.profile_path;
            }
            
            item.innerHTML = `
                <div class="card-item-thumb">
                    <div class="mini-card ${templateClass}" style="width:100%; height:100%;">
                        <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.4rem;">
                            <div class="mini-card-avatar ${templateClass}-av">
                                ${profilePath
                    ? `<img src="${profilePath}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                    : `<i class="fas ${icon}"></i>`}
                            </div>
                            <div class="mini-card-name" style="${templateClass === 'minimal' ? 'color:#0F172A;' : ''}">${(card['first-name'] && card['last-name'] ? card['first-name'] + ' ' + card['last-name'] : card.name || 'Sin Nombre')}</div>
                            <div class="mini-card-title" style="${templateClass === 'minimal' ? 'color:#64748B;' : ''}">${card.title || ''}</div>
                        </div>
                        ${templateClass !== 'minimal' ? '<div class="bottom-wave"></div>' : ''}
                    </div>
                </div>
                <div class="card-item-actions">
                    <span class="card-name">${(card['first-name'] && card['last-name'] ? (card['first-name'] + ' ' + card['last-name']).toUpperCase() : (card.name || 'Sin Nombre').toUpperCase())}</span>
                    <button class="btn btn-primary" style="font-size:0.7rem; padding:0.4rem 0.9rem; border-radius:6px;" onclick="UI.editCard('${card.id}')"><i class="fas fa-pen"></i> Editar</button>
                    <button class="btn-icon" title="Copiar Link" onclick="UI.copyLink('${pubLink}')"><i class="fas fa-copy"></i></button>
                    <button class="btn-icon" title="Ver Tarjeta" onclick="window.open('${pubLink}', '_blank')"><i class="fas fa-external-link-alt"></i></button>
                </div>
            `;
            this.dashboardGrid.appendChild(item);
        });

        // Add new card button at the end
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
        }
        
        this.updatePreview();
        Router.go('/admin');
        
        // Generar QR con la URL local
        const cardUrl = window.location.origin + window.location.pathname + `#card/${state.cardId}`;
        this.generateQR(cardUrl);
    },

    async handleSubmit(e) {
        e.preventDefault();
        if (this.loader) this.loader.classList.remove('hidden');
        
        try {
            // Recoger los datos del formulario
            const formData = new FormData(this.form);
            const cardData = {};
            
            // Convertir FormData a objeto
            for (let [key, value] of formData.entries()) {
                cardData[key] = value;
            }
            
            // Agregar IDs y paths de imágenes
            if (state.cardId) cardData.id = state.cardId;
            if (state.logoPath) cardData.logo_path = state.logoPath;
            if (state.profilePath) cardData.profile_path = state.profilePath;
            if (state.bgImagePath) cardData.bg_image_path = state.bgImagePath;
            if (state.fontFilePath) cardData.font_file_path = state.fontFilePath;
            
            // Generar ID basado en nombre y apellido si no existe
            if (!cardData.id) {
                const firstName = document.getElementById('first-name')?.value || cardData['first-name'] || '';
                const firstSurname = document.getElementById('last-name')?.value || cardData['last-name'] || '';
                
                if (firstName && firstSurname) {
                    // Generar ID a partir del nombre y primer apellido
                    let baseId = `${firstName.toLowerCase()}_${firstSurname.toLowerCase()}`;
                    baseId = baseId.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                    
                    // Asegurar que el ID sea único
                    let uniqueId = baseId;
                    let counter = 1;
                    const cards = this.getLocalCards();
                    
                    while (cards.some(c => c.id === uniqueId)) {
                        uniqueId = `${baseId}_${counter}`;
                        counter++;
                    }
                    
                    cardData.id = uniqueId;
                } else if (firstName) {
                    // Si solo tenemos el nombre, usamos solo el nombre
                    cardData.id = firstName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                } else {
                    // Si no tenemos ni nombre ni apellido, generar un ID por defecto
                    cardData.id = 'card_' + Date.now();
                }
            }
            
            // Guardar la tarjeta
            const savedCard = this.saveLocalCard(cardData);
            state.cardId = savedCard.id;
            
            // Guardar en el servidor
            try {
                await fetch(`${state.API_BASE}/api/cards`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cardData)
                });
            } catch (apiErr) {
                console.warn("Could not save to server, using local only:", apiErr);
            }

            if (this.successBanner) {
                this.successBanner.classList.remove('hidden');
                setTimeout(() => this.successBanner.classList.add('hidden'), 3500);
            }
            
            // Generar QR con la URL local
            const cardUrl = window.location.origin + window.location.pathname + `#card/${state.cardId}`;
            this.generateQR(cardUrl, this.qrContainer);
            
            // Actualizar vista pública QR si existe
            const publicQrContainer = document.getElementById('public-qr-container');
            if (publicQrContainer) {
                this.generateQR(cardUrl, publicQrContainer);
            }
            
            setTimeout(() => Router.go('/dashboard'), 2000);
        } catch (err) {
            alert("ERROR AL GUARDAR.");
            console.error(err);
        } finally {
            if (this.loader) this.loader.classList.add('hidden');
        }
    },

    generateQR(url, targetElement = null) {
        const container = targetElement || this.qrContainer;
        if (!container) return;
        container.innerHTML = '';
        container.style.opacity = '1';
        const render = () => {
            if (typeof QRCode !== 'undefined') {
                new QRCode(container, { text: url, width: 90, height: 90, colorDark: "#003366", colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.H });
            } else { setTimeout(render, 500); }
        };
        setTimeout(render, 300);
    },

    handleFileUpload(e, targetPath) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Convertir archivo a URL de objeto o base64
        const reader = new FileReader();
        reader.onload = (event) => {
            state[targetPath] = event.target.result;
            this.updatePreview();
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

        // Eliminar tarjeta de localStorage
        let cards = this.getLocalCards();
        cards = cards.filter(card => card.id !== state.cardId);
        localStorage.setItem('ecards_cards', JSON.stringify(cards));
        
        alert("IDENTIDAD ELIMINADA.");
        state.cardId = null;
        Router.go('/dashboard');
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
        const t = document.getElementById('preview-title');
        const c = document.getElementById('preview-company');
        const d = document.getElementById('preview-description');
        const preview = document.getElementById('card-preview');

        // Combinar nombre y apellido para mostrar el nombre completo
        const firstName = document.getElementById('first-name')?.value || data['first-name'] || '';
        const lastName = document.getElementById('last-name')?.value || data['last-name'] || '';
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'NOMBRE COMPLETO';

        if (n) n.textContent = fullName.toUpperCase();
        if (t) t.textContent = (data.title || 'CARGO O TÍTULO').toUpperCase();
        if (c) c.textContent = (data.company || 'EMPRESA').toUpperCase();
        if (d) d.textContent = data.description || 'Esta es tu descripción empresarial profesional.';

        // Apply Custom Branding
        if (preview) {
            // Apply Template Class (Preserving layout classes)
            preview.className = `card-preview animate-in template-${data.template_id || 'corporate'}`;

            if (state.bgImagePath) {
                preview.style.backgroundImage = `url(${state.bgImagePath})`;
            } else {
                // If NO user image, use system template gradient/color
                preview.style.backgroundImage = '';
                preview.style.backgroundColor = data.bg_color || '#0B0F19';

                // Only apply default gradient if it's corporate/creative
                if (!data.template_id || data.template_id === 'corporate') {
                    preview.style.backgroundImage = `linear-gradient(135deg, ${data.bg_color || '#0B0F19'} 0%, #001A33 100%)`;
                } else if (data.template_id === 'creative') {
                    preview.style.backgroundImage = `radial-gradient(circle at top right, ${data.primary_color || '#1A1C2C'} 0%, ${data.bg_color || '#000000'} 100%)`;
                }
            }
            preview.style.color = data.text_color || '#FFFFFF';
            preview.style.fontFamily = data.font_family || "'Plus Jakarta Sans', sans-serif";

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

        // Functional Contact Links
        if (this.contactsBox) {
            this.contactsBox.innerHTML = '';
            const items = [
                { key: 'email', icon: 'envelope', prefix: 'mailto:' },
                { key: 'phone', icon: 'phone', prefix: 'tel:' },
                { key: 'website', icon: 'globe', prefix: '' },
                { key: 'address', icon: 'location-dot', prefix: 'https://www.google.com/maps/search/?api=1&query=' }
            ];
            items.forEach(item => {
                const val = data[item.key];
                if (val) {
                    const el = document.createElement('a');
                    el.className = 'contact-item';
                    el.href = item.key === 'address' ? item.prefix + encodeURIComponent(val) : item.prefix + val;
                    el.target = '_blank';
                    el.style.color = 'inherit';
                    el.style.textDecoration = 'none';

                    let iconColor = data.primary_color || '#2D5BFF';
                    if (data.template_id === 'minimal' && this.isLightColor(iconColor)) iconColor = '#0B0F19';

                    el.innerHTML = `<i class="fas fa-${item.icon}" style="color:${iconColor}; font-size: 1.1rem; width:25px;"></i> <span>${val}</span>`;
                    this.contactsBox.appendChild(el);
                }
            });
        }

        // Social Strip Rendering
        if (this.socialBox) {
            this.socialBox.innerHTML = '';
            const list = ['linkedin', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'github'];
            list.forEach(key => {
                const val = data[key];
                if (val) {
                    const link = document.createElement('a');
                    link.href = this.getSocialLink(key, val);
                    link.target = '_blank';
                    const icon = document.createElement('i');
                    icon.className = (key === 'twitter') ? 'fab fa-x-twitter' : `fab fa-${key}`;

                    let iconColor = data.primary_color || '#2D5BFF';
                    if (data.template_id === 'minimal' && this.isLightColor(iconColor)) iconColor = '#0B0F19';
                    icon.style.color = iconColor;

                    link.appendChild(icon);
                    this.socialBox.appendChild(link);
                }
            });
        }

        // Dual Visual Identity (Logo vs Profile)
        const logoBox = document.getElementById('preview-logo-box'); // Center-right circle
        const brandBox = document.querySelector('.company-brand-box'); // Top-left logo area

        if (state.profilePath) {
            if (logoBox) logoBox.innerHTML = `<img src="${state.profilePath}" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            if (logoBox) logoBox.innerHTML = `<i class="fas fa-user" style="opacity: 0.1; font-size: 4rem; color:white;"></i>`;
        }

        if (state.logoPath) {
            const brandImg = document.getElementById('preview-logo-brand');
            const brandIcon = document.getElementById('preview-logo-icon');
            if (brandImg) {
                brandImg.src = state.logoPath;
                brandImg.style.display = 'block';
            }
            if (brandIcon) brandIcon.style.display = 'none';
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
        // Buscar la tarjeta en localStorage
        const localCards = this.getLocalCards();
        let card = localCards.find(c => c.id === id);
        
        if (!card) {
            // Intentar buscar en el servidor si no está local
            try {
                const response = await fetch(`${state.API_BASE}/api/cards/${id}`);
                if (response.ok) {
                    card = await response.json();
                }
            } catch (err) {
                console.error("Error fetching card from server:", err);
            }
        }
        
        if (card) {
            this.renderPublicCard(card);
        } else {
            if (this.publicView) this.publicView.innerHTML = '<div style="height:100vh; display:flex; align-items:center; justify-content:center; font-weight:800; opacity:0.3;">404 | IDENTITY NOT FOUND</div>';
        }
    },

    renderPublicCard(card) {
        if (!this.publicView) return;
        document.body.style.backgroundColor = card.bg_color || '#E0E5EC';
        state.logoPath = card.logo_path || null;
        state.profilePath = card.profile_path || null;
        state.bgImagePath = card.bg_image_path || null;
        state.fontFilePath = card.font_file_path || null;

        const wrap = document.createElement('div');
        wrap.id = 'public-card-container';
        wrap.className = 'animate-in';
        wrap.style.cssText = 'width:100%; max-width:450px; margin:0 auto; padding:2rem 1rem; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;';

        const cardEl = document.getElementById('card-preview').cloneNode(true);
        cardEl.id = 'public-final-card';
        cardEl.classList.remove('hidden');

        // Apply dynamic styles and Template to clone
        cardEl.className = `card-preview animate-in template-${card.template_id || 'corporate'}`;

        if (state.bgImagePath) {
            cardEl.style.backgroundImage = `url(${state.bgImagePath})`;
        } else {
            cardEl.style.backgroundImage = '';
            cardEl.style.backgroundColor = card.bg_color || '#0B0F19';
            if (!card.template_id || card.template_id === 'corporate') {
                cardEl.style.backgroundImage = `linear-gradient(135deg, ${card.bg_color || '#0B0F19'} 0%, #001A33 100%)`;
            } else if (card.template_id === 'creative') {
                cardEl.style.backgroundImage = `radial-gradient(circle at top right, ${card.primary_color || '#1A1C2C'} 0%, ${card.bg_color || '#000000'} 100%)`;
            }
        }
        cardEl.style.color = card.text_color || '#FFFFFF';
        cardEl.style.fontFamily = card.font_family || "'Plus Jakarta Sans', sans-serif";

        // Fix icons in Public View
        const isMin = card.template_id === 'minimal';
        cardEl.querySelectorAll('.contact-item i, #preview-social i').forEach(ico => {
            let icoCol = card.primary_color || '#2D5BFF';
            if (isMin && UI.isLightColor(icoCol)) icoCol = '#0B0F19';
            ico.style.color = icoCol;
        });

        // Apply Imported Styles in Public View
        if (card.custom_css) {
            const style = document.createElement('style');
            style.innerHTML = card.custom_css;
            document.head.appendChild(style);
        }

        if (card.custom_fonts && card.custom_fonts.startsWith('http')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = card.custom_fonts;
            document.head.appendChild(link);
        }

        if (state.fontFilePath) {
            const style = document.createElement('style');
            style.innerHTML = `
                @font-face {
                    font-family: 'UploadedCustomFont';
                    src: url('${state.fontFilePath}');
                }
            `;
            document.head.appendChild(style);
            cardEl.style.fontFamily = "'UploadedCustomFont', sans-serif";
        }

        // Update Text
        // Combinar nombre y apellido para mostrar el nombre completo en la vista pública
        const firstName = card['first-name'] || card.name || '';
        const lastName = card['last-name'] || '';
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || '';
        const n = cardEl.querySelector('#preview-name'); if (n) n.textContent = fullName.toUpperCase();
        const t = cardEl.querySelector('#preview-title'); if (t) t.textContent = (card.title || '').toUpperCase();
        const c = cardEl.querySelector('#preview-company'); if (c) c.textContent = (card.company || '').toUpperCase();
        const d = cardEl.querySelector('#preview-description'); if (d) d.textContent = card.description || '';

        // Contacts in Clone
        const contactBox = cardEl.querySelector('.contact-container');
        if (contactBox) {
            contactBox.innerHTML = '';
            const items = [
                { key: 'email', icon: 'envelope', prefix: 'mailto:' },
                { key: 'phone', icon: 'phone', prefix: 'tel:' },
                { key: 'website', icon: 'globe', prefix: '' },
                { key: 'address', icon: 'location-dot', prefix: 'https://www.google.com/maps/search/?api=1&query=' }
            ];
            items.forEach(item => {
                if (card[item.key]) {
                    const el = document.createElement('a');
                    el.className = 'contact-item';
                    el.href = item.key === 'address' ? item.prefix + encodeURIComponent(card[item.key]) : item.prefix + card[item.key];
                    el.target = '_blank';
                    el.style.color = 'inherit';
                    el.style.textDecoration = 'none';
                    el.innerHTML = `<i class="fas fa-${item.icon}" style="color:${card.primary_color || 'white'}; font-size: 1.1rem; width:25px;"></i> <span>${card[item.key]}</span>`;
                    contactBox.appendChild(el);
                }
            });
        }

        // Social Strip in Clone
        const socialBox = cardEl.querySelector('.social-strip');
        if (socialBox) {
            socialBox.innerHTML = '';
            const list = ['linkedin', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'github'];
            list.forEach(key => {
                if (card[key]) {
                    const link = this.getSocialLink(key, card[key]);
                    const iconClass = (key === 'twitter') ? 'fab fa-x-twitter' : `fab fa-${key}`;
                    socialBox.innerHTML += `<a href="${link}" target="_blank" style="text-decoration:none;"><i class="${iconClass}" style="color:${card.primary_color || '#00ff88'}; font-size:1.8rem;"></i></a>`;
                }
            });
        }

        // Visual Identity in Clone
        const logoBox = cardEl.querySelector('#preview-logo-box');
        if (state.profilePath && logoBox) logoBox.innerHTML = `<img src="${state.profilePath}" style="width:100%; height:100%; object-fit:cover;">`;

        const brandImg = cardEl.querySelector('#preview-logo-brand');
        const brandIcon = cardEl.querySelector('#preview-logo-icon');
        if (state.logoPath && brandImg) {
            brandImg.src = state.logoPath;
            brandImg.style.display = 'block';
            if (brandIcon) brandIcon.style.display = 'none';
        }

        wrap.appendChild(cardEl);

        // Interactive Footer Buttons
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap:1rem; width:100%; max-width:380px; margin-top:2rem;';

        const vBtn = document.createElement('button');
        vBtn.className = 'btn btn-primary btn-lg';
        vBtn.style.cssText = `background:${card.primary_color || '#7C3AED'}; color:white; border:none; padding:1rem; font-weight:800; cursor:pointer; font-size: 0.8rem; border-radius:50px; box-shadow: 0 10px 20px rgba(0,0,0,0.3);`;
        vBtn.innerHTML = 'GUARDAR CONTACTO';
        vBtn.onclick = () => this.downloadVCard(card);
        grid.appendChild(vBtn);

        const mBtn = document.createElement('button');
        mBtn.className = 'btn btn-outline btn-lg';
        mBtn.style.cssText = 'background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.3); padding:1rem; font-weight:800; cursor:pointer; font-size: 0.8rem; border-radius:50px;';
        mBtn.innerHTML = 'COMPARTIR LINK';
        mBtn.onclick = () => this.copyLink(window.location.href);
        grid.appendChild(mBtn);

        wrap.appendChild(grid);

        // Add share buttons for mobile
        const shareDiv = document.createElement('div');
        shareDiv.style.cssText = 'display:flex; gap:1rem; margin-top:1rem;';
        const shareLabel = document.createElement('span');
        shareLabel.textContent = 'Compartir en:';
        shareLabel.style.marginRight = '10px';
        
        const platforms = [
            { name: 'WhatsApp', icon: 'fab fa-whatsapp', color: '#25D366', url: `https://wa.me/?text=${encodeURIComponent(window.location.href)}` },
            { name: 'LinkedIn', icon: 'fab fa-linkedin', color: '#0A66C2', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}` },
            { name: 'Twitter', icon: 'fab fa-x-twitter', color: '#1DA1F2', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent('Mira esta tarjeta de presentación digital:&url=')}${encodeURIComponent(window.location.href)}` }
        ];
        
        platforms.forEach(platform => {
            const btn = document.createElement('a');
            btn.href = platform.url;
            btn.target = '_blank';
            btn.innerHTML = `<i class="${platform.icon}"></i> ${platform.name}`;
            btn.style.cssText = `padding: 0.5rem; border-radius: 0.5rem; color: white; background-color: ${platform.color}; text-decoration: none; flex: 1; text-align: center;`;
            shareDiv.appendChild(btn);
        });
        
        wrap.appendChild(shareDiv);

        this.publicView.innerHTML = '';
        this.publicView.appendChild(wrap);

        // Generate QR in public view footer
        const qrF = document.createElement('div');
        qrF.style.cssText = 'background:white; padding:1rem; border-radius:12px; margin-top:2rem; max-width: 200px; margin-left: auto; margin-right: auto;';
        wrap.appendChild(qrF);
        this.generateQR(window.location.href, qrF);
    },

    downloadVCard(card) {
        // Combinar nombre y apellido para el vCard
        const firstName = card['first-name'] || card.name || '';
        const lastName = card['last-name'] || '';
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Contacto';
        
        const v = `BEGIN:VCARD\nVERSION:3.0\nFN:${fullName}\nORG:${card.company}\nTITLE:${card.title}\nTEL;TYPE=WORK,VOICE:${card.phone}\nEMAIL;TYPE=PREF,INTERNET:${card.email}\nURL:${card.website}\nADR;TYPE=WORK:;;${card.address || ''}\nEND:VCARD`;
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