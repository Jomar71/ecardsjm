        const CONFIG = {
            PASSWORD: 'admin123',
            SESSION_KEY: 'evaunt_session',
            CARDS_KEY: 'evaunt_cards'
        };

        let currentUser = null;
        let cards = [];
        let editingCardId = null;

        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM cargado - Inicializando aplicación...');
            initializeApp();
            
            // Manejar el enrutamiento basado en el hash
            window.addEventListener('hashchange', handleRoute);
            handleRoute(); // Manejar la ruta actual al cargar
        });

        function initializeApp() {
            console.log('Inicializando aplicación...');
            if (!document.getElementById('loginScreen') || !document.getElementById('app')) {
                console.error('Elementos del DOM no encontrados');
                setTimeout(initializeApp, 100);
                return;
            }
            
            checkSession();
            loadCards();
            setupEventListeners();
            setupDefaultDesign();
            updateCardsTable();
            updateCardPreview();
        }

        // CORREGIDO: Manejar rutas basadas en hash
        function handleRoute() {
            const hash = window.location.hash.substring(1); // Eliminar el #
            console.log('Hash detectado:', hash);
            
            // Si hay un hash y es una tarjeta existente, mostrar solo la tarjeta
            if (hash && hash !== 'home' && hash !== 'my-cards') {
                const card = findCardByUrl(hash);
                if (card) {
                    console.log('Tarjeta encontrada, mostrando vista individual');
                    displayCard(card);
                    return;
                } else {
                    console.log('Tarjeta no encontrada, hash:', hash);
                }
            }

            // Si el usuario está logueado, mostrar la aplicación normal
            if (currentUser && currentUser.loggedIn) {
                if (!hash || hash === 'home') {
                    showHomeSection();
                } else if (hash === 'my-cards') {
                    showMyCardsSection();
                } else {
                    // Si no es una ruta conocida pero está logueado, mostrar home
                    showHomeSection();
                }
            } else {
                // Usuario no logueado
                if (hash && hash !== 'home' && hash !== 'my-cards') {
                    const card = findCardByUrl(hash);
                    if (card) {
                        // Guardar la tarjeta para mostrar después del login
                        sessionStorage.setItem('pendingCardView', JSON.stringify(card));
                    }
                }
                showLogin();
            }
        }

        // CORREGIDO: Mostrar tarjeta cuando se accede por URL
        function displayCard(card) {
            console.log('Mostrando tarjeta individual:', card.name);
            
            // Ocultar completamente la aplicación principal
            const app = document.getElementById('app');
            if (app) {
                app.style.display = 'none';
            }
            
            // Ocultar login si está visible
            const loginScreen = document.getElementById('loginScreen');
            if (loginScreen) {
                loginScreen.style.display = 'none';
            }
            
            // Crear contenedor para la vista individual si no existe
            let individualView = document.getElementById('individualCardView');
            if (!individualView) {
                individualView = document.createElement('div');
                individualView.id = 'individualCardView';
                individualView.style.minHeight = '100vh';
                individualView.style.backgroundColor = '#f8f9fa';
                individualView.style.padding = '20px';
                document.body.appendChild(individualView);
            }
            
            // Mostrar solo el contenedor individual
            individualView.style.display = 'block';
            
            // Renderizar la tarjeta en vista individual
            renderCardForIndividualView(card, individualView);
        }

        // NUEVA FUNCIÓN: Renderizar tarjeta para vista individual
        function renderCardForIndividualView(card, container) {
            // Cargar fuente personalizada si existe
            if (card.design?.customFont) {
                loadCustomFontFromUrl(card.design.customFont, card.design.fontFamily);
            }

            // Cargar fuente subida si existe
            if (card.design?.customFontData) {
                loadCustomFontFromData(card.design.customFontData, card.design.fontFamily);
            }

            container.innerHTML = `
                <div style="max-width: 400px; margin: 0 auto; padding: 20px 0;">

                    
                    <!-- Tarjeta -->
                    <div class="card-preview" style="background: ${card.design?.cardBackground || '#ffffff'}; color: ${card.design?.textPrimary || '#2c3e50'}; font-family: ${card.design?.fontFamily || 'Arial, sans-serif'}; margin: 0 auto;">
                        <div class="card-header">
                            <div class="card-profile-section">
                                ${card.profileImage ? 
                                    `<img src="${card.profileImage}" class="avatar img-rounded media-size-avatar" 
                                          style="width: 150px; height: 150px; border-radius: ${card.design?.profileShape === 'circular' ? '50%' : '10px'}; 
                                                 border: 3px solid ${card.design?.accentColor || '#3498db'}; object-fit: cover;">` : 
                                    '<div style="width: 150px; height: 150px; background: #ecf0f1; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #7f8c8d;">Sin foto</div>'
                                }
                            </div>
                            <div class="card-logo-section">
                                ${card.logo ? 
                                    `<img src="${card.logo}" class="card-logo" 
                                          style="max-width: 80px; max-height: 80px; object-fit: contain;">` : 
                                    ''
                                }
                            </div>
                        </div>
                        
                        <div class="card-content">
                            <h2 class="card-name" style="font-size: ${card.design?.nameSize || '24'}px; color: ${card.design?.textPrimary || '#2c3e50'};">${card.name || 'Nombre Completo'}</h2>
                            <p class="card-title" style="font-size: ${card.design?.titleSize || '16'}px; color: ${card.design?.textSecondary || '#7f8c8d'};">${card.title || 'Título/Cargo'}</p>
                            <p class="card-company" style="color: ${card.design?.accentColor || '#3498db'};">${card.company || 'Empresa'}</p>
                            <div class="card-description">
                                <p style="font-size: ${card.design?.descriptionSize || '14'}px; color: ${card.design?.textPrimary || '#2c3e50'};">${card.description || 'Descripción de la empresa o usuario aparecerá aquí.'}</p>
                            </div>
                        </div>
                        
                        <div class="contact-buttons-block">
                            ${generateContactButtons(card)}
                        </div>

                        <div class="social-media-block">
                            ${generateSocialMediaIcons(card)}
                        </div>
                        
                        <div class="card-url">
                            <p>Comparte esta tarjeta: 
                                <span style="font-weight: bold; color: ${card.design?.accentColor || '#3498db'};">
                                    ${window.location.href}
                                </span>
                            </p>
                        </div>
                    </div>
                    

                </div>
            `;
        }

        // NUEVA FUNCIÓN: Mostrar aplicación completa
        function showFullApp() {
            // Ocultar vista individual
            const individualView = document.getElementById('individualCardView');
            if (individualView) {
                individualView.style.display = 'none';
            }
            
            // Cambiar hash a home
            window.location.hash = 'home';
            
            // Mostrar aplicación principal si el usuario está logueado
            if (currentUser && currentUser.loggedIn) {
                showApp();
                showHomeSection();
            } else {
                showLogin();
            }
        }

        function findCardByUrl(url) {
            return cards.find(card => {
                const cardUrl = card.url;
                return cardUrl === url;
            });
        }

        function generateContactButtons(card) {
            const contacts = [];
            const accentColor = card.design?.accentColor || '#3498db';

            // Iconos SVG modernos para contacto
            const phoneIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            const mobileIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" stroke="${accentColor}" stroke-width="2"/><line x1="11" y1="18" x2="13" y2="18" stroke="${accentColor}" stroke-width="2"/></svg>`;
            const emailIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="${accentColor}" stroke-width="2"/><polyline points="22,6 12,13 2,6" stroke="${accentColor}" stroke-width="2"/></svg>`;
            const addressIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="${accentColor}" stroke-width="2"/><circle cx="12" cy="10" r="3" stroke="${accentColor}" stroke-width="2"/></svg>`;

            if (card.phone) {
                contacts.push(`<a href="tel:${card.phone.replace(/\s/g, '')}" class="contact-button" style="border-color: ${accentColor};">
                    <span style="display: flex; align-items: center;">
                        <span style="margin-right: 0.75rem;">${phoneIcon}</span>
                        <span>Teléfono: ${card.phone}</span>
                    </span>
                    <span class="icon-chevron-right"></span>
                </a>`);
            }

            if (card.mobile) {
                contacts.push(`<a href="tel:${card.mobile.replace(/\s/g, '')}" class="contact-button" style="border-color: ${accentColor};">
                    <span style="display: flex; align-items: center;">
                        <span style="margin-right: 0.75rem;">${mobileIcon}</span>
                        <span>Móvil: ${card.mobile}</span>
                    </span>
                    <span class="icon-chevron-right"></span>
                </a>`);
            }

            if (card.email) {
                contacts.push(`<a href="mailto:${card.email}" class="contact-button" style="border-color: ${accentColor};">
                    <span style="display: flex; align-items: center;">
                        <span style="margin-right: 0.75rem;">${emailIcon}</span>
                        <span>Email: ${card.email}</span>
                    </span>
                    <span class="icon-chevron-right"></span>
                </a>`);
            }

            if (card.address) {
                contacts.push(`<a href="https://maps.google.com/?q=${encodeURIComponent(card.address)}" target="_blank" class="contact-button" style="border-color: ${accentColor};">
                    <span style="display: flex; align-items: center;">
                        <span style="margin-right: 0.75rem;">${addressIcon}</span>
                        <span>Dirección: ${card.address}</span>
                    </span>
                    <span class="icon-chevron-right"></span>
                </a>`);
            }

            return contacts.length > 0 ? contacts.join('') : '<p style="text-align: center; color: #7f8c8d;">No hay información de contacto</p>';
        }

        function generateSocialMediaIcons(card) {
            const socialIcons = [];
            const accentColor = card.design?.accentColor || '#3498db';
            
            const websiteIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="${accentColor}" stroke-width="2"/><path d="M2 12H22" stroke="${accentColor}" stroke-width="2"/><path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2V2Z" stroke="${accentColor}" stroke-width="2"/></svg>`;

            const linkedinIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 8C17.5913 8 19.1174 8.63214 20.2426 9.75736C21.3679 10.8826 22 12.4087 22 14V21H18V14C18 13.4696 17.7893 12.9609 17.4142 12.5858C17.0391 12.2107 16.5304 12 16 12C15.4696 12 14.9609 12.2107 14.5858 12.5858C14.2107 12.9609 14 13.4696 14 14V21H10V14C10 12.4087 10.6321 10.8826 11.7574 9.75736C12.8826 8.63214 14.4087 8 16 8Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9H2V21H6V9Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 6C5.10457 6 6 5.10457 6 4C6 2.89543 5.10457 2 4 2C2.89543 2 2 2.89543 2 4C2 5.10457 2.89543 6 4 6Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

            const facebookIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 2H15C13.6739 2 12.4021 2.52678 11.4645 3.46447C10.5268 4.40215 10 5.67392 10 7V10H7V14H10V22H14V14H17L18 10H14V7C14 6.73478 14.1054 6.48043 14.2929 6.29289C14.4804 6.10536 14.7348 6 15 6H18V2Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

            const instagramIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 2H7C4.23858 2 2 4.23858 2 7V17C2 19.7614 4.23858 21 7 21H17C19.7614 21 21 19.7614 21 17V7C21 4.23858 19.7614 2 17 2Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 11.37C16.1234 12.2022 15.9813 13.0522 15.5938 13.799C15.2063 14.5458 14.5932 15.1514 13.8416 15.5297C13.0901 15.9079 12.2385 16.0396 11.4078 15.9059C10.5771 15.7723 9.80977 15.3801 9.21485 14.7852C8.61993 14.1902 8.22774 13.4229 8.09408 12.5922C7.96042 11.7615 8.09208 10.9099 8.47034 10.1584C8.8486 9.40685 9.4542 8.79374 10.201 8.40624C10.9478 8.01874 11.7978 7.87659 12.63 8C13.4789 8.12588 14.2649 8.52146 14.8717 9.1283C15.4785 9.73515 15.8741 10.5211 16 11.37Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 6.5H17.51" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

            const twitterIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 3C22.0424 3.67548 20.9821 4.19211 19.86 4.53C19.2577 3.83751 18.4573 3.34669 17.567 3.12393C16.6767 2.90116 15.7395 2.9572 14.8821 3.28445C14.0247 3.61171 13.2884 4.1944 12.773 4.95372C12.2575 5.71303 11.9877 6.61234 12 7.53V8.53C10.2426 8.57557 8.50127 8.18581 6.93101 7.39545C5.36074 6.60508 4.01032 5.43864 3 4C3 4 -1 13 8 17C5.94053 18.398 3.48716 19.0989 1 19C10 24 21 19 21 7.5C20.9991 7.22145 20.9723 6.94359 20.92 6.67C21.9406 5.66349 22.6608 4.39271 23 3V3Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

            const youtubeIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.54 6.42C22.4212 5.94541 22.1793 5.51057 21.8387 5.15941C21.4981 4.80824 21.0708 4.55318 20.6 4.42C18.88 4 12 4 12 4C12 4 5.12 4 3.4 4.46C2.92925 4.59318 2.50193 4.84824 2.1613 5.19941C1.82068 5.55057 1.57875 5.98541 1.46 6.46C1.14521 8.20556 0.991236 9.97631 1 11.75C0.991236 13.5237 1.14521 15.2944 1.46 17.04C1.59096 17.4848 1.8383 17.8836 2.17814 18.1995C2.51799 18.5154 2.93882 18.7375 3.4 18.84C5.12 19.3 12 19.3 12 19.3C12 19.3 18.88 19.3 20.6 18.84C21.0708 18.7068 21.4981 18.4518 21.8387 18.1006C22.1793 17.7494 22.4212 17.3146 22.54 16.84C22.8524 15.0944 23.0063 13.3237 22.9987 11.55C23.0223 9.77197 22.8683 7.99611 22.54 6.42V6.42Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.75 15.02L15.5 11.75L9.75 8.48V15.02Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

            const whatsappIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

            if (card.website) {
                socialIcons.push(`<a href="${card.website}" target="_blank" class="social-media-icon" title="Sitio Web">${websiteIcon}</a>`);
            }
            
            if (card.linkedin) {
                socialIcons.push(`<a href="${card.linkedin}" target="_blank" class="social-media-icon" title="LinkedIn">${linkedinIcon}</a>`);
            }
            
            if (card.facebook) {
                socialIcons.push(`<a href="${card.facebook}" target="_blank" class="social-media-icon" title="Facebook">${facebookIcon}</a>`);
            }
            
            if (card.instagram) {
                socialIcons.push(`<a href="${card.instagram}" target="_blank" class="social-media-icon" title="Instagram">${instagramIcon}</a>`);
            }
            
            if (card.twitter) {
                socialIcons.push(`<a href="${card.twitter}" target="_blank" class="social-media-icon" title="Twitter/X">${twitterIcon}</a>`);
            }
            
            if (card.youtube) {
                socialIcons.push(`<a href="${card.youtube}" target="_blank" class="social-media-icon" title="YouTube">${youtubeIcon}</a>`);
            }
            
            if (card.whatsapp) {
                socialIcons.push(`<a href="https://wa.me/${card.whatsapp}" target="_blank" class="social-media-icon" title="WhatsApp">${whatsappIcon}</a>`);
            }

            return socialIcons.length > 0 ? socialIcons.join('') : '<p style="text-align: center; color: #7f8c8d; width: 100%;">No hay redes sociales</p>';
        }

        function showHomeSection() {
            window.location.hash = 'home';
            switchSection('home');
        }

        function showMyCardsSection() {
            window.location.hash = 'my-cards';
            switchSection('my-cards');
        }

        function showNotFound() {
            if (currentUser && currentUser.loggedIn) {
                showHomeSection();
            } else {
                showLogin();
            }
            alert('Tarjeta no encontrada');
        }

        function setupDefaultDesign() {
            const elements = [
                'cardBackground', 'textPrimary', 'textSecondary', 'accentColor',
                'fontFamily', 'nameSize', 'titleSize', 'descriptionSize',
                'profileShape', 'profileSize'
            ];
            
            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    switch(id) {
                        case 'cardBackground': element.value = '#ffffff'; break;
                        case 'textPrimary': element.value = '#2c3e50'; break;
                        case 'textSecondary': element.value = '#7f8c8d'; break;
                        case 'accentColor': element.value = '#3498db'; break;
                        case 'fontFamily': element.value = 'Arial, sans-serif'; break;
                        case 'nameSize': element.value = '24'; break;
                        case 'titleSize': element.value = '16'; break;
                        case 'descriptionSize': element.value = '14'; break;
                        case 'profileShape': element.value = 'circular'; break;
                        case 'profileSize': element.value = '150'; break;
                    }
                }
            });
        }

        function checkSession() {
            const session = localStorage.getItem(CONFIG.SESSION_KEY);
            if (session) {
                try {
                    currentUser = JSON.parse(session);
                    if (currentUser && currentUser.loggedIn) {
                        // Verificar si hay una tarjeta pendiente por mostrar después del login
                        const pendingCard = sessionStorage.getItem('pendingCardView');
                        if (pendingCard) {
                            const card = JSON.parse(pendingCard);
                            sessionStorage.removeItem('pendingCardView');
                            displayCard(card);
                        } else {
                            showApp();
                        }
                        return;
                    }
                } catch (e) {
                    console.error('Error parsing session:', e);
                    localStorage.removeItem(CONFIG.SESSION_KEY);
                }
            }
            showLogin();
        }

        function showLogin() {
            const loginScreen = document.getElementById('loginScreen');
            const app = document.getElementById('app');
            
            if (loginScreen) loginScreen.style.display = 'flex';
            if (app) app.style.display = 'none';
            
            // Ocultar vista individual si existe
            const individualView = document.getElementById('individualCardView');
            if (individualView) {
                individualView.style.display = 'none';
            }
        }

        function showApp() {
            const loginScreen = document.getElementById('loginScreen');
            const app = document.getElementById('app');
            
            if (loginScreen) loginScreen.style.display = 'none';
            if (app) app.style.display = 'block';
            
            // Ocultar vista individual si existe
            const individualView = document.getElementById('individualCardView');
            if (individualView) {
                individualView.style.display = 'none';
            }
        }

        function setupEventListeners() {
            // Login
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', handleLogin);
            }

            // Logout
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', handleLogout);
            }

            // Navegación
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const target = this.getAttribute('data-target');
                    switchSection(target);
                });
            });

            // Botón para comenzar a crear
            const startCreatingBtn = document.getElementById('startCreatingBtn');
            if (startCreatingBtn) {
                startCreatingBtn.addEventListener('click', function() {
                    document.getElementById('creationSection').style.display = 'block';
                    this.style.display = 'none';
                    document.querySelector('.hero-section').style.display = 'none';
                    resetForm();
                });
            }

            // Formulario de tarjeta
            const cardForm = document.getElementById('cardForm');
            if (cardForm) {
                cardForm.addEventListener('submit', handleCardSubmit);
            }

            // Cancelar edición
            const cancelEditBtn = document.getElementById('cancelEditButton');
            if (cancelEditBtn) {
                cancelEditBtn.addEventListener('click', function() {
                    resetForm();
                });
            }

            // Inputs de archivo
            const logoInput = document.getElementById('logo');
            if (logoInput) {
                logoInput.addEventListener('change', function() {
                    previewImage(this, 'logoPreview');
                });
            }

            const profileInput = document.getElementById('profileImage');
            if (profileInput) {
                profileInput.addEventListener('change', function() {
                    previewImage(this, 'profilePreview');
                });
            }

            // Event listeners para actualizar la vista previa
            const previewInputs = [
                'name', 'title', 'company', 'description',
                'phone', 'mobile', 'email', 'address',
                'website', 'linkedin', 'facebook', 'instagram', 'twitter', 'youtube', 'whatsapp',
                'cardBackground', 'textPrimary', 'textSecondary', 'accentColor',
                'fontFamily', 'nameSize', 'titleSize', 'descriptionSize',
                'profileShape', 'profileSize', 'customFont'
            ];

            previewInputs.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('input', updateCardPreview);
                    element.addEventListener('change', updateCardPreview);
                }
            });

            // Event listener para subir archivos de fuentes
            const customFontInput = document.getElementById('customFontFile');
            if (customFontInput) {
                customFontInput.addEventListener('change', handleFontUpload);
            }
        }

        function handleLogin(e) {
            e.preventDefault();
            const password = document.getElementById('password').value;
            
            if (password === CONFIG.PASSWORD) {
                currentUser = {
                    loggedIn: true,
                    loginTime: new Date().toISOString()
                };
                localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(currentUser));
                showApp();
            } else {
                alert('Contraseña incorrecta. Intente nuevamente.');
            }
        }

        function handleLogout() {
            if (confirm('¿Está seguro de que desea cerrar sesión?')) {
                localStorage.removeItem(CONFIG.SESSION_KEY);
                currentUser = null;
                showLogin();
            }
        }

        function switchSection(sectionId) {
            // Actualizar navegación
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            document.querySelector(`[data-target="${sectionId}"]`).classList.add('active');
            
            // Mostrar sección
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(sectionId).classList.add('active');
        }

        function previewImage(input, previewId) {
            const preview = document.getElementById(previewId);
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                    updateCardPreview();
                };
                reader.readAsDataURL(input.files[0]);
            }
        }

        // Manejar subida de archivos de fuentes
        function handleFontUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Verificar que sea un archivo de fuente
            const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            
            if (!validExtensions.includes(fileExtension)) {
                alert('Por favor, sube un archivo de fuente válido (.ttf, .otf, .woff, .woff2)');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                const fontData = event.target.result;
                const fontName = file.name.split('.')[0];
                
                // Crear una fuente personalizada
                const fontFace = new FontFace(fontName, `url(${fontData})`);
                
                fontFace.load().then(function(loadedFace) {
                    document.fonts.add(loadedFace);
                    
                    // Actualizar el select de fuentes
                    const fontSelect = document.getElementById('fontFamily');
                    const existingOption = Array.from(fontSelect.options).find(opt => opt.value.includes(fontName));
                    
                    if (!existingOption) {
                        const newOption = new Option(fontName, `'${fontName}', sans-serif`);
                        fontSelect.add(newOption);
                    }
                    
                    // Seleccionar la nueva fuente
                    fontSelect.value = `'${fontName}', sans-serif`;
                    
                    // Actualizar vista previa
                    updateCardPreview();
                    
                    alert(`Fuente "${fontName}" cargada correctamente`);
                }).catch(function(error) {
                    console.error('Error loading font:', error);
                    alert('Error al cargar la fuente. Intenta con otro archivo.');
                });
            };
            
            reader.readAsDataURL(file);
        }

        // Cargar fuentes personalizadas desde URL
        function loadCustomFontFromUrl(fontUrl, fontFamily) {
            if (!fontUrl) return;

            // Verificar si ya existe un enlace para esta fuente
            let existingLink = document.querySelector(`link[href="${fontUrl}"]`);
            if (!existingLink) {
                // Crear nuevo enlace para la fuente
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = fontUrl;
                document.head.appendChild(link);

                // Esperar a que cargue la fuente
                link.onload = function() {
                    console.log('Fuente personalizada cargada:', fontUrl);
                };
            }
        }

        // Cargar fuente personalizada desde datos base64
        function loadCustomFontFromData(fontData, fontFamily) {
            if (!fontData) return;

            const fontName = 'CustomFont_' + Date.now();

            // Crear una fuente personalizada
            const fontFace = new FontFace(fontName, `url(${fontData})`);

            fontFace.load().then(function(loadedFace) {
                document.fonts.add(loadedFace);
                console.log('Fuente personalizada cargada desde datos:', fontName);
            }).catch(function(error) {
                console.error('Error loading custom font from data:', error);
            });
        }

        function updateCardPreview() {
            // Actualizar información básica
            updateTextPreview('name', 'previewName');
            updateTextPreview('title', 'previewTitle');
            updateTextPreview('company', 'previewCompany');
            updateTextPreview('description', 'previewDescription');
            
            // Actualizar imágenes
            updateImagePreview('logoPreview', 'previewLogo');
            updateImagePreview('profilePreview', 'previewProfile');
            
            // Actualizar estilos
            updateStyles();
            
            // Actualizar botones de contacto
            updateContactButtons();
            
            // Actualizar redes sociales
            updateSocialMedia();
            
            // Actualizar URL personalizada
            updateCustomURL();
        }

        function updateTextPreview(inputId, previewId) {
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);
            
            if (input && preview) {
                const value = input.value.trim();
                if (value) {
                    preview.textContent = value;
                } else {
                    // Texto por defecto
                    switch(previewId) {
                        case 'previewName': preview.textContent = 'Nombre Completo'; break;
                        case 'previewTitle': preview.textContent = 'Título/Cargo'; break;
                        case 'previewCompany': preview.textContent = 'Empresa'; break;
                        case 'previewDescription': preview.textContent = 'Descripción de la empresa o usuario aparecerá aquí.'; break;
                    }
                }
            }
        }

        function updateImagePreview(sourceId, targetId) {
            const source = document.getElementById(sourceId);
            const target = document.getElementById(targetId);
            
            if (source && target && source.src) {
                target.src = source.src;
                target.style.display = 'block';
            } else {
                target.style.display = 'none';
            }
        }

        function updateStyles() {
            const cardPreview = document.getElementById('cardPreview');
            if (!cardPreview) return;
            
            // Colores
            cardPreview.style.backgroundColor = document.getElementById('cardBackground').value;
            cardPreview.style.color = document.getElementById('textPrimary').value;
            
            // Tipografía
            const fontFamily = document.getElementById('fontFamily').value;
            const customFont = document.getElementById('customFont').value;
            
            if (customFont) {
                // Cargar fuente personalizada
                loadCustomFontFromUrl(customFont, fontFamily);
            }
            cardPreview.style.fontFamily = fontFamily;
            
            // Tamaños de texto
            const nameSize = document.getElementById('nameSize').value + 'px';
            const titleSize = document.getElementById('titleSize').value + 'px';
            const descriptionSize = document.getElementById('descriptionSize').value + 'px';
            
            document.getElementById('previewName').style.fontSize = nameSize;
            document.getElementById('previewTitle').style.fontSize = titleSize;
            document.getElementById('previewDescription').style.fontSize = descriptionSize;
            
            // Colores de texto
            const textPrimary = document.getElementById('textPrimary').value;
            const textSecondary = document.getElementById('textSecondary').value;
            const accentColor = document.getElementById('accentColor').value;
            
            document.getElementById('previewName').style.color = textPrimary;
            document.getElementById('previewTitle').style.color = textSecondary;
            document.getElementById('previewCompany').style.color = accentColor;
            
            // Estilo de la foto de perfil
            const profileShape = document.getElementById('profileShape').value;
            const profileSize = document.getElementById('profileSize').value + 'px';
            const profileImg = document.getElementById('previewProfile');
            
            if (profileImg) {
                if (profileShape === 'circular') {
                    profileImg.classList.remove('square');
                    profileImg.classList.add('circular');
                    profileImg.style.borderRadius = '50%';
                } else {
                    profileImg.classList.remove('circular');
                    profileImg.classList.add('square');
                    profileImg.style.borderRadius = '10px';
                }
                
                // Aplicar el tamaño personalizado
                profileImg.style.width = profileSize;
                profileImg.style.height = profileSize;
                profileImg.style.objectFit = 'cover';
                
                // Aplicar borde con color de acento
                profileImg.style.border = `3px solid ${accentColor}`;
            }
        }

        function updateContactButtons() {
            const contactButtonsBlock = document.getElementById('previewContactButtons');
            if (!contactButtonsBlock) return;
            
            contactButtonsBlock.innerHTML = '';
            
            const contactData = [
                { id: 'phone', label: 'Teléfono Fijo', icon: '📞' },
                { id: 'mobile', label: 'Teléfono Móvil', icon: '📱' },
                { id: 'email', label: 'Correo Electrónico', icon: '✉️' },
                { id: 'address', label: 'Dirección', icon: '📍' }
            ];
            
            contactData.forEach(item => {
                const input = document.getElementById(item.id);
                if (input && input.value.trim()) {
                    const button = document.createElement('a');
                    button.className = 'contact-button';
                    button.href = getContactLink(item.id, input.value);
                    button.innerHTML = `
                        <span style="display: flex; align-items: center;">
                            <span class="contact-icon">${item.icon}</span>
                            <span>${item.label}: ${input.value}</span>
                        </span>
                        <span class="icon-chevron-right"></span>
                    `;
                    contactButtonsBlock.appendChild(button);
                }
            });
            
            // Si no hay botones, mostrar mensaje
            if (contactButtonsBlock.children.length === 0) {
                const message = document.createElement('p');
                message.textContent = 'Agrega información de contacto en el formulario';
                message.style.textAlign = 'center';
                message.style.color = '#7f8c8d';
                contactButtonsBlock.appendChild(message);
            }
        }

        function getContactLink(type, value) {
            switch(type) {
                case 'phone':
                case 'mobile':
                    return `tel:${value.replace(/\s/g, '')}`;
                case 'email':
                    return `mailto:${value}`;
                case 'address':
                    return `https://maps.google.com/?q=${encodeURIComponent(value)}`;
                default:
                    return '#';
            }
        }

        function updateSocialMedia() {
            const socialMediaBlock = document.getElementById('previewSocialMedia');
            if (!socialMediaBlock) return;
            
            socialMediaBlock.innerHTML = '';
            
            // Función para crear iconos de redes sociales
            const createSocialIcon = (iconSvg, href, platform) => {
                const link = document.createElement('a');
                link.href = href;
                link.target = '_blank';
                link.className = 'social-media-icon';
                link.title = platform;
                link.innerHTML = iconSvg;
                
                return link;
            };
            
            // Iconos SVG modernos para redes sociales
            const websiteIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#3498db" stroke-width="2"/>
                <path d="M2 12H22" stroke="#3498db" stroke-width="2"/>
                <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2V2Z" stroke="#3498db" stroke-width="2"/>
            </svg>`;

            const linkedinIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 8C17.5913 8 19.1174 8.63214 20.2426 9.75736C21.3679 10.8826 22 12.4087 22 14V21H18V14C18 13.4696 17.7893 12.9609 17.4142 12.5858C17.0391 12.2107 16.5304 12 16 12C15.4696 12 14.9609 12.2107 14.5858 12.5858C14.2107 12.9609 14 13.4696 14 14V21H10V14C10 12.4087 10.6321 10.8826 11.7574 9.75736C12.8826 8.63214 14.4087 8 16 8Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6 9H2V21H6V9Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M4 6C5.10457 6 6 5.10457 6 4C6 2.89543 5.10457 2 4 2C2.89543 2 2 2.89543 2 4C2 5.10457 2.89543 6 4 6Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;

            const facebookIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 2H15C13.6739 2 12.4021 2.52678 11.4645 3.46447C10.5268 4.40215 10 5.67392 10 7V10H7V14H10V22H14V14H17L18 10H14V7C14 6.73478 14.1054 6.48043 14.2929 6.29289C14.4804 6.10536 14.7348 6 15 6H18V2Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;

            const instagramIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 2H7C4.23858 2 2 4.23858 2 7V17C2 19.7614 4.23858 21 7 21H17C19.7614 21 21 19.7614 21 17V7C21 4.23858 19.7614 2 17 2Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 11.37C16.1234 12.2022 15.9813 13.0522 15.5938 13.799C15.2063 14.5458 14.5932 15.1514 13.8416 15.5297C13.0901 15.9079 12.2385 16.0396 11.4078 15.9059C10.5771 15.7723 9.80977 15.3801 9.21485 14.7852C8.61993 14.1902 8.22774 13.4229 8.09408 12.5922C7.96042 11.7615 8.09208 10.9099 8.47034 10.1584C8.8486 9.40685 9.4542 8.79374 10.201 8.40624C10.9478 8.01874 11.7978 7.87659 12.63 8C13.4789 8.12588 14.2649 8.52146 14.8717 9.1283C15.4785 9.73515 15.8741 10.5211 16 11.37Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M17.5 6.5H17.51" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;

            const twitterIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23 3C22.0424 3.67548 20.9821 4.19211 19.86 4.53C19.2577 3.83751 18.4573 3.34669 17.567 3.12393C16.6767 2.90116 15.7395 2.9572 14.8821 3.28445C14.0247 3.61171 13.2884 4.1944 12.773 4.95372C12.2575 5.71303 11.9877 6.61234 12 7.53V8.53C10.2426 8.57557 8.50127 8.18581 6.93101 7.39545C5.36074 6.60508 4.01032 5.43864 3 4C3 4 -1 13 8 17C5.94053 18.398 3.48716 19.0989 1 19C10 24 21 19 21 7.5C20.9991 7.22145 20.9723 6.94359 20.92 6.67C21.9406 5.66349 22.6608 4.39271 23 3V3Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;

            const youtubeIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.54 6.42C22.4212 5.94541 22.1793 5.51057 21.8387 5.15941C21.4981 4.80824 21.0708 4.55318 20.6 4.42C18.88 4 12 4 12 4C12 4 5.12 4 3.4 4.46C2.92925 4.59318 2.50193 4.84824 2.1613 5.19941C1.82068 5.55057 1.57875 5.98541 1.46 6.46C1.14521 8.20556 0.991236 9.97631 1 11.75C0.991236 13.5237 1.14521 15.2944 1.46 17.04C1.59096 17.4848 1.8383 17.8836 2.17814 18.1995C2.51799 18.5154 2.93882 18.7375 3.4 18.84C5.12 19.3 12 19.3 12 19.3C12 19.3 18.88 19.3 20.6 18.84C21.0708 18.7068 21.4981 18.4518 21.8387 18.1006C22.1793 17.7494 22.4212 17.3146 22.54 16.84C22.8524 15.0944 23.0063 13.3237 22.9987 11.55C23.0223 9.77197 22.8683 7.99611 22.54 6.42V6.42Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9.75 15.02L15.5 11.75L9.75 8.48V15.02Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;

            const whatsappIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
            
            // Agregar iconos según los datos disponibles
            const website = document.getElementById('website').value;
            const linkedin = document.getElementById('linkedin').value;
            const facebook = document.getElementById('facebook').value;
            const instagram = document.getElementById('instagram').value;
            const twitter = document.getElementById('twitter').value;
            const youtube = document.getElementById('youtube').value;
            const whatsapp = document.getElementById('whatsapp').value;
            
            if (website) {
                socialMediaBlock.appendChild(
                    createSocialIcon(websiteIcon, website, 'Sitio Web')
                );
            }
            
            if (linkedin) {
                socialMediaBlock.appendChild(
                    createSocialIcon(linkedinIcon, linkedin, 'LinkedIn')
                );
            }
            
            if (facebook) {
                socialMediaBlock.appendChild(
                    createSocialIcon(facebookIcon, facebook, 'Facebook')
                );
            }
            
            if (instagram) {
                socialMediaBlock.appendChild(
                    createSocialIcon(instagramIcon, instagram, 'Instagram')
                );
            }
            
            if (twitter) {
                socialMediaBlock.appendChild(
                    createSocialIcon(twitterIcon, twitter, 'Twitter/X')
                );
            }
            
            if (youtube) {
                socialMediaBlock.appendChild(
                    createSocialIcon(youtubeIcon, youtube, 'YouTube')
                );
            }
            
            if (whatsapp) {
                socialMediaBlock.appendChild(
                    createSocialIcon(whatsappIcon, `https://wa.me/${whatsapp}`, 'WhatsApp')
                );
            }
            
            // Si no hay redes sociales, mostrar mensaje
            if (socialMediaBlock.children.length === 0) {
                const noSocial = document.createElement('p');
                noSocial.textContent = 'No hay redes sociales';
                noSocial.style.textAlign = 'center';
                noSocial.style.color = '#7f8c8d';
                noSocial.style.width = '100%';
                socialMediaBlock.appendChild(noSocial);
            }
        }

        // Función para actualizar URL en vista previa
        function updateCustomURL() {
            const nameInput = document.getElementById('name');
            const previewUrl = document.getElementById('previewUrl');
            
            if (nameInput && previewUrl) {
                const name = nameInput.value.trim();
                
                if (name) {
                    const urlName = generateUrlName(name);
                    // Mostrar URL completa que funcionará
                    previewUrl.textContent = `${window.location.origin}${window.location.pathname}#${urlName}`;
                } else {
                    previewUrl.textContent = `${window.location.origin}${window.location.pathname}#tu-nombre`;
                }
            }
        }

        // Función auxiliar para generar nombres de URL amigables
        function generateUrlName(name) {
            return name.toLowerCase()
                .replace(/[áàäâ]/g, 'a')
                .replace(/[éèëê]/g, 'e')
                .replace(/[íìïî]/g, 'i')
                .replace(/[óòöô]/g, 'o')
                .replace(/[úùüû]/g, 'u')
                .replace(/ñ/g, 'n')
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        }

        function handleCardSubmit(e) {
            e.preventDefault();
            
            // Generar URL personalizada basada en el nombre
            const name = document.getElementById('name').value.trim();
            const urlName = name ? generateUrlName(name) : 'tarjeta-' + Date.now();
            
            // Obtener datos del formulario
            const cardData = {
                id: editingCardId || Date.now().toString(),
                name: name,
                title: document.getElementById('title').value,
                company: document.getElementById('company').value,
                description: document.getElementById('description').value,
                phone: document.getElementById('phone').value,
                mobile: document.getElementById('mobile').value,
                email: document.getElementById('email').value,
                address: document.getElementById('address').value,
                website: document.getElementById('website').value,
                linkedin: document.getElementById('linkedin').value,
                facebook: document.getElementById('facebook').value,
                instagram: document.getElementById('instagram').value,
                twitter: document.getElementById('twitter').value,
                youtube: document.getElementById('youtube').value,
                whatsapp: document.getElementById('whatsapp').value,
                design: {
                    cardBackground: document.getElementById('cardBackground').value,
                    textPrimary: document.getElementById('textPrimary').value,
                    textSecondary: document.getElementById('textSecondary').value,
                    accentColor: document.getElementById('accentColor').value,
                    fontFamily: document.getElementById('fontFamily').value,
                    nameSize: document.getElementById('nameSize').value,
                    titleSize: document.getElementById('titleSize').value,
                    descriptionSize: document.getElementById('descriptionSize').value,
                    profileShape: document.getElementById('profileShape').value,
                    profileSize: document.getElementById('profileSize').value,
                    customFont: document.getElementById('customFont').value,
                    customFontData: null // Para almacenar la fuente subida como base64
                },
                // La URL ahora es solo el nombre para el hash
                url: urlName,
                createdAt: editingCardId ? getCardById(editingCardId).createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Procesar fuente personalizada subida
            const customFontInput = document.getElementById('customFontFile');
            let hasCustomFont = false;

            if (customFontInput.files[0]) {
                hasCustomFont = true;
                const fontReader = new FileReader();
                fontReader.onload = function(e) {
                    cardData.design.customFontData = e.target.result;
                    processImages(cardData);
                };
                fontReader.readAsDataURL(customFontInput.files[0]);
            } else if (editingCardId) {
                const existingCard = getCardById(editingCardId);
                cardData.design.customFontData = existingCard.design?.customFontData;
                processImages(cardData);
            } else {
                processImages(cardData);
            }

            function processImages(cardData) {
                // Procesar imágenes
                const logoInput = document.getElementById('logo');
                const profileInput = document.getElementById('profileImage');

                let imagesProcessed = 0;
                const totalImages = (logoInput.files[0] ? 1 : 0) + (profileInput.files[0] ? 1 : 0);

                function checkSave() {
                    imagesProcessed++;
                    if (imagesProcessed >= totalImages) {
                        saveCard(cardData);
                    }
                }

                if (logoInput.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        cardData.logo = e.target.result;
                        checkSave();
                    };
                    reader.readAsDataURL(logoInput.files[0]);
                } else if (editingCardId) {
                    const existingCard = getCardById(editingCardId);
                    cardData.logo = existingCard.logo;
                }

                if (profileInput.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        cardData.profileImage = e.target.result;
                        checkSave();
                    };
                    reader.readAsDataURL(profileInput.files[0]);
                } else if (editingCardId) {
                    const existingCard = getCardById(editingCardId);
                    cardData.profileImage = existingCard.profileImage;
                }

                // Si no hay imágenes nuevas, guardar directamente
                if (totalImages === 0) {
                    saveCard(cardData);
                }
            }
        }

        function saveCard(cardData) {
            if (editingCardId) {
                // Actualizar tarjeta existente
                const index = cards.findIndex(card => card.id === editingCardId);
                if (index !== -1) {
                    cards[index] = cardData;
                }
            } else {
                // Agregar nueva tarjeta
                cards.push(cardData);
            }
            
            localStorage.setItem(CONFIG.CARDS_KEY, JSON.stringify(cards));
            updateCardsTable();
            resetForm();
            alert(editingCardId ? 'Tarjeta actualizada correctamente' : 'Tarjeta creada correctamente');
            
            // Cambiar a la sección de Mis Tarjetas
            switchSection('my-cards');
        }

        function loadCards() {
            const storedCards = localStorage.getItem(CONFIG.CARDS_KEY);
            if (storedCards) {
                try {
                    cards = JSON.parse(storedCards);
                } catch (e) {
                    console.error('Error parsing stored cards:', e);
                    cards = [];
                }
            } else {
                cards = [];
            }
        }

        function getCardById(id) {
            return cards.find(card => card.id === id);
        }

        function updateCardsTable() {
            const tableBody = document.getElementById('cardsTableBody');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            if (cards.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 2rem;">
                            No hay tarjetas creadas aún. <a href="#" class="nav-link" data-target="home">Crea tu primera tarjeta</a>
                        </td>
                    </tr>
                `;
                return;
            }
            
            cards.forEach(card => {
                const row = document.createElement('tr');
                
                // URL completa que funcionará
                const fullUrl = `${window.location.origin}${window.location.pathname}#${card.url}`;
                
                row.innerHTML = `
                    <td>${card.name || 'Sin nombre'}</td>
                    <td><a href="${fullUrl}" target="_blank">${fullUrl}</a></td>
                    <td>${formatDate(card.createdAt)}</td>
                    <td>${formatDate(card.updatedAt)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary" onclick="editCard('${card.id}')">Editar</button>
                            <button class="btn btn-danger" onclick="deleteCard('${card.id}')">Eliminar</button>
                        </div>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-ES');
        }

        function editCard(id) {
            const card = getCardById(id);
            if (!card) return;
            
            editingCardId = id;
            
            // Cambiar a la sección de inicio
            switchSection('home');
            
            // Mostrar sección de creación
            document.getElementById('creationSection').style.display = 'block';
            document.getElementById('startCreatingBtn').style.display = 'none';
            document.querySelector('.hero-section').style.display = 'none';
            
            // Actualizar título del formulario
            document.getElementById('formTitle').textContent = 'Editar Tarjeta';
            
            // Mostrar botón de cancelar
            document.getElementById('cancelEditButton').style.display = 'block';
            
            // Llenar formulario con datos de la tarjeta
            document.getElementById('name').value = card.name || '';
            document.getElementById('title').value = card.title || '';
            document.getElementById('company').value = card.company || '';
            document.getElementById('description').value = card.description || '';
            document.getElementById('phone').value = card.phone || '';
            document.getElementById('mobile').value = card.mobile || '';
            document.getElementById('email').value = card.email || '';
            document.getElementById('address').value = card.address || '';
            document.getElementById('website').value = card.website || '';
            document.getElementById('linkedin').value = card.linkedin || '';
            document.getElementById('facebook').value = card.facebook || '';
            document.getElementById('instagram').value = card.instagram || '';
            document.getElementById('twitter').value = card.twitter || '';
            document.getElementById('youtube').value = card.youtube || '';
            document.getElementById('whatsapp').value = card.whatsapp || '';
            
            // Llenar datos de diseño
            if (card.design) {
                document.getElementById('cardBackground').value = card.design.cardBackground || '#ffffff';
                document.getElementById('textPrimary').value = card.design.textPrimary || '#2c3e50';
                document.getElementById('textSecondary').value = card.design.textSecondary || '#7f8c8d';
                document.getElementById('accentColor').value = card.design.accentColor || '#3498db';
                document.getElementById('fontFamily').value = card.design.fontFamily || 'Arial, sans-serif';
                document.getElementById('nameSize').value = card.design.nameSize || '24';
                document.getElementById('titleSize').value = card.design.titleSize || '16';
                document.getElementById('descriptionSize').value = card.design.descriptionSize || '14';
                document.getElementById('profileShape').value = card.design.profileShape || 'circular';
                document.getElementById('profileSize').value = card.design.profileSize || '150';
                document.getElementById('customFont').value = card.design.customFont || '';

                // Cargar fuente personalizada si existe
                if (card.design.customFontData) {
                    loadCustomFontFromData(card.design.customFontData, card.design.fontFamily);
                }
            }
            
            // Mostrar imágenes
            if (card.logo) {
                document.getElementById('logoPreview').src = card.logo;
                document.getElementById('logoPreview').style.display = 'block';
            }
            
            if (card.profileImage) {
                document.getElementById('profilePreview').src = card.profileImage;
                document.getElementById('profilePreview').style.display = 'block';
            }
            
            // Actualizar vista previa
            updateCardPreview();
            
            // Cambiar texto del botón de envío
            document.getElementById('submitButton').textContent = 'Actualizar Tarjeta';
        }

        function deleteCard(id) {
            if (confirm('¿Está seguro de que desea eliminar esta tarjeta?')) {
                cards = cards.filter(card => card.id !== id);
                localStorage.setItem(CONFIG.CARDS_KEY, JSON.stringify(cards));
                updateCardsTable();
            }
        }

        function resetForm() {
            document.getElementById('cardForm').reset();
            editingCardId = null;
            
            // Restablecer diseño por defecto
            setupDefaultDesign();
            
            // Ocultar vistas previas de imágenes
            document.getElementById('logoPreview').style.display = 'none';
            document.getElementById('profilePreview').style.display = 'none';
            
            // Restablecer título del formulario
            document.getElementById('formTitle').textContent = 'Crear Nueva Tarjeta';
            
            // Ocultar botón de cancelar
            document.getElementById('cancelEditButton').style.display = 'none';
            
            // Restablecer texto del botón de envío
            document.getElementById('submitButton').textContent = 'Crear Tarjeta';
            
            // Actualizar vista previa
            updateCardPreview();
        }

        // Hacer funciones globales para los onclick
        window.editCard = editCard;
        window.deleteCard = deleteCard;
        window.showFullApp = showFullApp;
        window.showHomeSection = showHomeSection;
