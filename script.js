/**
 * EliteCards Pro - Executive Intelligence Kernel
 * Multi-User Platform Engine 2026
 */

"use strict";

const state = {
    user: null,
    cardId: null,
    isPublicView: false,
    logoPath: null,
    profilePath: null,
    bgImagePath: null,
    fontFilePath: null,
    archives: [],
    API_BASE: ''
};

const Router = {
    go(path) {
        console.log(`Router: Navigating to [${path}]`);
        window.history.pushState({}, '', path);
        this.render(path);
    },

    render(path) {
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

const Auth = {
    async check() {
        try {
            const res = await fetch(`${state.API_BASE}/api/auth/me`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                this.onLogin(data.user);
            }
        } catch (e) { console.log("Auth: Runtime Guest Mode."); }
    },

    async handleLogin(e) {
        e.preventDefault();
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        try {
            const res = await fetch(`${state.API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username: user, password: pass })
            });
            if (res.ok) {
                const data = await res.json();
                this.onLogin(data.user);
                UI.hideAuth();
                Router.go('/dashboard');
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error === "DENIED" ? "CREDENCIALES INVÁLIDAS." : "ERROR: No se pudo conectar con el servidor backend.");
            }
        } catch (err) { alert("SISTEMA AUTH OFFLINE."); }
    },

    async handleRegister(e) {
        e.preventDefault();
        const user = document.getElementById('reg-user').value;
        const pass = document.getElementById('reg-pass').value;
        try {
            const res = await fetch(`${state.API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username: user, password: pass })
            });
            if (res.ok) {
                alert("REGISTRO EXITOSO. INICIA SESIÓN.");
                UI.showAuth('login');
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.error === "EXECUTIVE_EXISTS" ? "USUARIO EXISTENTE." : "ERROR: El servidor backend no está configurado en GitHub Pages.");
            }
        } catch (err) { alert("ERROR DE REGISTRO."); }
    },

    async logout() {
        await fetch(`${state.API_BASE}/api/auth/logout`, { credentials: 'include' });
        state.user = null;
        document.getElementById('auth-nav-guest').classList.remove('hidden');
        document.getElementById('auth-nav-user').classList.add('hidden');
        Router.go('/');
    },

    onLogin(user) {
        state.user = user;
        document.getElementById('auth-nav-guest').classList.add('hidden');
        document.getElementById('auth-nav-user').classList.remove('hidden');
        document.getElementById('nav-username').textContent = user.username.toUpperCase();
    }
};

const UI = {
    init() {
        this.cacheDOM();
        this.setupEventListeners();
        Auth.check().finally(() => {
            Router.render(window.location.pathname);
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
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tabId)?.classList.remove('hidden');
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
            <div style="text-align:center; opacity:0.3;">
                <i class="fas fa-qrcode" style="font-size: 1.5rem; display:block; margin-bottom: 5px;"></i>
                <span style="font-size: 8px; font-weight:800;">GUARDAR PARA QR</span>
            </div>`;
    },

    async loadDashboard() {
        if (!this.dashboardGrid) return;
        this.dashboardGrid.innerHTML = '<p style="opacity:0.5; padding: 2rem; text-align: center;">Sincronizando...</p>';
        try {
            const res = await fetch(`${state.API_BASE}/api/cards`, { credentials: 'include' });
            const cards = await res.json();
            this.dashboardGrid.innerHTML = '';
            if (cards.length === 0) {
                this.dashboardGrid.innerHTML = '<div class="studio-module" style="grid-column: 1/-1; padding: 4rem; text-align: center; opacity: 0.5;">Aún no has creado identidades.</div>';
                return;
            }
            cards.forEach(card => {
                const item = document.createElement('div');
                item.className = 'studio-module animate-in';
                item.style.padding = '1.5rem';
                const pubLink = `${state.API_BASE}/card/${card.id}`;
                item.innerHTML = `
                    <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem;">
                        <div style="width: 45px; height: 45px; border-radius: 12px; background: ${card.primary_color}; display: flex; align-items: center; justify-content: center; color: white; overflow: hidden; border: 1px solid rgba(0,0,0,0.05);">
                            ${card.logo_path ? `<img src="${state.API_BASE}/uploads/${card.logo_path}" style="width:100%; height:100%; object-fit:contain;">` : '<i class="fas fa-user-tie"></i>'}
                        </div>
                        <div style="flex:1">
                            <h4 style="margin:0; font-size: 0.8rem; font-weight: 800;">${(card.name || 'SIN NOMBRE').toUpperCase()}</h4>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.75rem;">
                        <button class="tab-btn active" style="font-size: 0.6rem; flex: 1; padding: 0.75rem;" onclick="UI.editCard('${card.id}')">EDITAR</button>
                        <button class="tab-btn" style="font-size: 0.6rem; padding: 0.75rem 1rem;" onclick="UI.copyLink('${pubLink}')"><i class="fas fa-copy"></i></button>
                        <button class="tab-btn" style="font-size: 0.6rem; padding: 0.75rem 1rem;" onclick="window.open('${pubLink}', '_blank')"><i class="fas fa-external-link-alt"></i></button>
                    </div>
                `;
                this.dashboardGrid.appendChild(item);
            });
        } catch (e) { this.dashboardGrid.innerHTML = '<p>SISTEMA OFFLINE</p>'; }
    },

    async editCard(id) {
        try {
            const res = await fetch(`${state.API_BASE}/api/cards/${id}`, { credentials: 'include' });
            const card = await res.json();
            state.cardId = card.id;
            state.logoPath = card.logo_path ? `/uploads/${card.logo_path}` : null;
            state.profilePath = card.profile_path ? `/uploads/${card.profile_path}` : null;
            state.bgImagePath = card.bg_image_path ? `/uploads/${card.bg_image_path}` : null;
            state.fontFilePath = card.font_file_path ? `/uploads/${card.font_file_path}` : null;
            if (this.form) {
                Object.entries(card).forEach(([key, val]) => {
                    const input = this.form.elements[key];
                    if (input && input.type !== 'file') input.value = val || '';
                });
            }
            this.updatePreview();
            Router.go('/admin');
            this.generateQR(`${window.location.origin}/card/${state.cardId}`);
        } catch (e) { alert("ERROR AL CARGAR."); }
    },

    async handleSubmit(e) {
        e.preventDefault();
        if (this.loader) this.loader.classList.remove('hidden');
        try {
            const formData = new FormData(this.form);
            if (state.cardId) formData.append('id', state.cardId);
            const res = await fetch(`${state.API_BASE}/api/cards`, { method: 'POST', credentials: 'include', body: formData });
            const result = await res.json();
            if (result.status === 'success') {
                state.cardId = result.card.id;
                if (this.successBanner) {
                    this.successBanner.classList.remove('hidden');
                    setTimeout(() => this.successBanner.classList.add('hidden'), 3500);
                }
                this.generateQR(`${window.location.origin}/card/${state.cardId}`);
                setTimeout(() => Router.go('/dashboard'), 2000);
            }
        } catch (err) { alert("ERROR DE DESPLIEGUE."); }
        finally { if (this.loader) this.loader.classList.add('hidden'); }
    },

    handleFileUpload(e, targetPath) {
        const file = e.target.files[0];
        if (!file) return;
        state[targetPath] = URL.createObjectURL(file);
        this.updatePreview();
    },

    handleFontFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        state.fontFilePath = URL.createObjectURL(file);
        this.updatePreview();
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

        try {
            const res = await fetch(`${state.API_BASE}/api/cards/${state.cardId}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
                alert("IDENTIDAD ELIMINADA.");
                Router.go('/dashboard');
            }
        } catch (e) { alert("ERROR AL ELIMINAR."); }
    },

    copyLink(url) {
        navigator.clipboard.writeText(url).then(() => {
            alert("LINK COPIADO AL PORTAPAPELES");
        });
    },

    // --- Core Engine: Multi-Template Hybrid Rendering ---
    updatePreview(customData = null) {
        const data = customData || (this.form ? Object.fromEntries(new FormData(this.form).entries()) : {});
        const n = document.getElementById('preview-name');
        const t = document.getElementById('preview-title');
        const c = document.getElementById('preview-company');
        const d = document.getElementById('preview-description');
        const preview = document.getElementById('card-preview');

        if (n) n.textContent = (data.name || 'NOMBRE COMPLETO').toUpperCase();
        if (t) t.textContent = (data.title || 'CARGO O TÍTULO').toUpperCase();
        if (c) c.textContent = (data.company || 'EMPRESA').toUpperCase();
        if (d) d.textContent = data.description || 'Esta es tu descripción empresarial profesional.';

        // Apply Custom Branding
        if (preview) {
            // Apply Template Class (Preserving layout classes)
            preview.className = `card-preview animate-in tmpl-${data.template_id || 'corporate'}`;

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

    async loadPublicCard(id) {
        try {
            const res = await fetch(`${state.API_BASE}/api/cards/${id}`, { credentials: 'include' });
            const card = await res.json();
            this.renderPublicCard(card);
        } catch (e) {
            if (this.publicView) this.publicView.innerHTML = '<div style="height:100vh; display:flex; align-items:center; justify-content:center; font-weight:800; opacity:0.3;">404 | IDENTITY NOT FOUND</div>';
        }
    },

    renderPublicCard(card) {
        if (!this.publicView) return;
        document.body.style.backgroundColor = card.bg_color || '#E0E5EC';
        state.logoPath = card.logo_path ? `/uploads/${card.logo_path}` : null;
        state.profilePath = card.profile_path ? `/uploads/${card.profile_path}` : null;
        state.bgImagePath = card.bg_image_path ? `/uploads/${card.bg_image_path}` : null;
        state.fontFilePath = card.font_file_path ? `/uploads/${card.font_file_path}` : null;

        const wrap = document.createElement('div');
        wrap.id = 'public-card-container';
        wrap.className = 'animate-in';
        wrap.style.cssText = 'width:100%; max-width:450px; margin:0 auto; padding:2rem 1rem; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;';

        const cardEl = document.getElementById('card-preview').cloneNode(true);
        cardEl.id = 'public-final-card';
        cardEl.classList.remove('hidden');

        // Apply dynamic styles and Template to clone
        cardEl.className = `card-preview animate-in tmpl-${card.template_id || 'corporate'}`;

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
        const n = cardEl.querySelector('#preview-name'); if (n) n.textContent = (card.name || '').toUpperCase();
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
        vBtn.className = 'studio-module';
        vBtn.style.cssText = `background:${card.primary_color || '#003366'}; color:white; border:none; padding:1rem; font-weight:800; cursor:pointer; font-size: 0.8rem; border-radius:50px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);`;
        vBtn.innerHTML = 'GUARDAR CONTACTO';
        vBtn.onclick = () => this.downloadVCard(card);
        grid.appendChild(vBtn);

        const mBtn = document.createElement('button');
        mBtn.className = 'studio-module';
        mBtn.style.cssText = 'background:#FFFFFF; color:#003366; border:none; padding:1rem; font-weight:800; cursor:pointer; font-size: 0.8rem; border-radius:50px; box-shadow: 0 10px 20px rgba(0,0,0,0.05);';
        mBtn.innerHTML = 'COMPARTIR LINK';
        mBtn.onclick = () => this.copyLink(window.location.href);
        grid.appendChild(mBtn);

        wrap.appendChild(grid);
        this.publicView.innerHTML = '';
        this.publicView.appendChild(wrap);

        // Generate QR in public view footer
        const qrF = document.createElement('div');
        qrF.style.cssText = 'background:white; padding:1rem; border-radius:12px; margin-top:2rem;';
        wrap.appendChild(qrF);
        this.generateQR(window.location.href, qrF);
    },

    downloadVCard(card) {
        const v = `BEGIN:VCARD\nVERSION:3.0\nFN:${card.name}\nORG:${card.company}\nTITLE:${card.title}\nTEL;TYPE=WORK,VOICE:${card.phone}\nEMAIL;TYPE=PREF,INTERNET:${card.email}\nURL:${card.website}\nADR;TYPE=WORK:;;${card.address || ''}\nEND:VCARD`;
        const b = new Blob([v], { type: 'text/vcard' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${card.name}.vcf`; a.click();
    }
};

window.UI = UI; window.Auth = Auth; window.Router = Router;
document.addEventListener('DOMContentLoaded', () => UI.init());