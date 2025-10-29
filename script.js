// CONFIGURACIÓN GLOBAL
const CONFIG = {
    PASSWORD: 'admin123',
    SESSION_KEY: 'ecardsjm_session',
    CARDS_KEY: 'ecardsjm_cards'
};

let currentUser = null;
let cards = []; // Almacena la lista de tarjetas del usuario logueado (LOCALSTORAGE)
let editingCardId = null; // ID de la tarjeta que se está editando

// ----------------------------------------------------
// INICIALIZACIÓN Y MANEJO DE EVENTOS
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    window.addEventListener('hashchange', debounce(handleRoute, 100));
    handleRoute(); // Manejar la ruta actual al cargar
});

function initializeApp() {
    checkSession();
    loadCards(); // Cargar tarjetas al inicio
    setupEventListeners();
    setupDefaultDesign();
    updateCardPreview();
}

function setupEventListeners() {
    // 1. Navegación
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.target;
            window.location.hash = target;
        });
    });
    
    // 2. Login/Logout
    document.getElementById('loginForm').addEventListener('submit', login);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // 3. Formulario
    document.getElementById('cardForm').addEventListener('submit', saveCard);
    document.getElementById('cancelEditButton').addEventListener('click', resetForm);
    document.getElementById('startCreatingBtn').addEventListener('click', () => {
        document.getElementById('creationSection').style.display = 'block';
        document.getElementById('startCreatingBtn').style.display = 'none';
        // Desplazarse al formulario
        document.getElementById('creationSection').scrollIntoView({ behavior: 'smooth' });
    });
    
    // 4. Vista Previa
    document.querySelectorAll('#cardForm input, #cardForm textarea, #cardForm select').forEach(element => {
        element.addEventListener('input', updateCardPreview);
        element.addEventListener('change', updateCardPreview);
    });

    // 5. Imágenes (Simplificado, se asume que existe la lógica de base64)
    document.getElementById('logoUpload').addEventListener('change', (e) => handleImageUpload(e, 'logo'));
    document.getElementById('profileImageUpload').addEventListener('change', (e) => handleImageUpload(e, 'profile'));
    
    // 6. Botón de copiar URL
    document.getElementById('copyUrlBtn').addEventListener('click', copyCardUrl);
}


// ----------------------------------------------------
// MANEJO DE SESIÓN Y VISTAS
// ----------------------------------------------------

function checkSession() {
    const session = sessionStorage.getItem(CONFIG.SESSION_KEY);
    currentUser = session ? JSON.parse(session) : { loggedIn: false };

    if (currentUser.loggedIn) {
        showApp();
    } else {
        showLogin();
    }
}

function login(e) {
    e.preventDefault();
    const password = document.getElementById('password').value;

    if (password === CONFIG.PASSWORD) {
        currentUser = { loggedIn: true };
        sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(currentUser));
        showApp();
        showNotification('Acceso concedido. ¡Bienvenido!', 'success');
        handleRoute();
    } else {
        showNotification('Contraseña incorrecta.', 'error');
    }
}

function logout() {
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
    currentUser = { loggedIn: false };
    showLogin();
    window.location.hash = '';
    showNotification('Sesión cerrada.', 'info');
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('card-view').style.display = 'none';
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('card-view').style.display = 'none';
}

function showAdminSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => section.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-target="${sectionId.replace('my-cards', 'my-cards')}"]`).classList.add('active'); // Ajuste para el link de navegación
    
    // Si se está en Mis Tarjetas, cargar la tabla
    if (sectionId === 'my-cards') {
        loadCards();
        updateCardsTable();
    }
    
    document.getElementById('card-view').style.display = 'none';
    showApp();
}

// ----------------------------------------------------
// MANEJO DE RUTAS Y LINKS (SOLUCIÓN DE COMPATIBILIDAD)
// ----------------------------------------------------

function handleRoute() {
    const hash = window.location.hash.substring(1);
    const cardView = document.getElementById('card-view');
    const appView = document.getElementById('app');

    if (hash.startsWith('card-')) {
        // Modo Vista Pública de Tarjeta
        const card = findCardByUrl(hash);
        if (card) {
            document.getElementById('loginScreen').style.display = 'none';
            appView.style.display = 'none';
            cardView.style.display = 'block';
            renderCardForIndividualView(card);
            return;
        } else {
             // Si el link es inválido, redirigir a la página principal
             window.location.hash = 'home';
        }
    }
    
    // Modo Administración
    if (currentUser && currentUser.loggedIn) {
        if (!hash || hash === 'home' || hash.startsWith('card-')) {
            showAdminSection('home');
        } else if (hash === 'my-cards') {
            showAdminSection('my-cards');
        }
    } else {
        showLogin();
    }
}

function findCardByUrl(url) {
    if (!url || !url.startsWith('card-')) return null;

    try {
        // La URL debe ser #card-nombre-tarjeta__DATOSCOMPRIMIDOS
        const parts = url.substring(5).split('__');
        
        if (parts.length !== 2) {
             // La parte de datos comprimidos es esencial
            return null;
        }

        const compressedData = parts[1];
        if (!compressedData) return null;

        // Descomprimir datos con LZString
        const decompressed = LZString.decompressFromEncodedURIComponent(compressedData);
        if (!decompressed) return null;

        const decoded = JSON.parse(decompressed);
        return decoded;

    } catch (e) {
        console.error('Error al cargar tarjeta desde URL comprimida:', e);
        showNotification('Error: El link de la tarjeta está corrupto o es inválido.', 'error', 5000);
        return null;
    }
}

// ----------------------------------------------------
// FUNCIONES DE GESTIÓN DE TARJETAS (CRUD LOCAL - SOLUCIÓN BOTONES)
// ----------------------------------------------------

function loadCards() {
    const storedCards = localStorage.getItem(CONFIG.CARDS_KEY);
    try {
        cards = storedCards ? JSON.parse(storedCards) : [];
        if (!Array.isArray(cards)) cards = [];
    } catch (e) {
        console.error('Error al cargar tarjetas de localStorage:', e);
        cards = [];
    }
}

function saveCard(e) {
    e.preventDefault();
    const formData = getFormData();
    
    // 1. Validar nombre
    if (!formData.name) {
        showNotification('El nombre es obligatorio para crear la tarjeta.', 'error');
        return;
    }
    
    const now = new Date().toISOString();
    let cardData = { ...formData };
    
    if (editingCardId) {
        // MODO EDICIÓN
        cardData.id = editingCardId;
        const existingCard = cards.find(c => c.id === editingCardId);
        if (existingCard) {
            // Mantener datos originales de imágenes y fecha de creación si existen
            cardData.logo = cardData.logo || existingCard.logo;
            cardData.profileImage = cardData.profileImage || existingCard.profileImage;
            cardData.addedAt = existingCard.addedAt; 
        }
        cardData.lastUpdated = now;

        cards = cards.map(c => c.id === editingCardId ? cardData : c);
        showNotification('Tarjeta actualizada correctamente. ¡Link listo para compartir!', 'success');
    } else {
        // MODO CREACIÓN
        cardData.id = Date.now().toString(); // ID único simple
        cardData.addedAt = now;
        cardData.lastUpdated = now;
        cards.push(cardData);
        showNotification('Tarjeta creada correctamente. ¡Link listo para compartir!', 'success');
    }
    
    // 2. Guardar en localStorage
    localStorage.setItem(CONFIG.CARDS_KEY, JSON.stringify(cards));
    
    // 3. Generar URL compartible
    const compressedData = LZString.compressToEncodedURIComponent(JSON.stringify(cardData));
    const urlName = cardData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const fullUrl = `${window.location.origin}${window.location.pathname}#card-${urlName}__${compressedData}`;
    
    // 4. Mostrar URL generada y botón de copiar (MEJORA VISUAL)
    document.getElementById('customUrlDisplay').textContent = `${window.location.origin}${window.location.pathname}#card-${urlName}... (Link largo)`;
    document.getElementById('copyUrlBtn').style.display = 'inline-block';
    document.getElementById('copyUrlBtn').dataset.url = fullUrl; // Almacenar el link completo

    resetForm(); 
    updateCardsTable(); // Actualizar la tabla de Mis Tarjetas
    
    // Volver al modo edición si se actualizó, para que el usuario pueda copiar el link
    if (editingCardId) {
        editCard(cardData.id, false); // Vuelve al formulario, sin notificación, para mostrar el link
        document.getElementById('formTitle').textContent = 'Tarjeta Actualizada';
    }
}


function updateCardsTable() {
    const tableBody = document.getElementById('cardsTableBody');
    if (!tableBody) return;

    loadCards(); 

    if (cards.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No tienes tarjetas creadas.</td></tr>';
        return;
    }

    let rowsHtml = '';
    cards.forEach(card => {
        if (!card.id) return; 
        
        // 1. Generar el URL COMPLETO
        const compressedData = LZString.compressToEncodedURIComponent(JSON.stringify(card));
        const urlName = (card.name || 'tarjeta').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        const fullUrl = `${window.location.origin}${window.location.pathname}#card-${urlName}__${compressedData}`;

        // 2. Generar el link "limpio" para mostrar en la tabla (SOLUCIÓN VISUAL)
        const displayUrl = `${window.location.origin}${window.location.pathname}#card-${urlName}`;

        rowsHtml += `
            <tr>
                <td>${card.name || 'Sin Nombre'}</td>
                <td>
                    <a href="${fullUrl}" target="_blank" title="Link completo: ${fullUrl}">
                        ${displayUrl}
                    </a>
                </td>
                <td>${card.addedAt ? new Date(card.addedAt).toLocaleDateString() : 'N/A'}</td>
                <td>${card.lastUpdated ? new Date(card.lastUpdated).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.editCard('${card.id}')">
                        Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteCard('${card.id}')">
                        Eliminar
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = rowsHtml;
}

// Función para cargar los datos de una tarjeta en el formulario (para editar)
function editCard(id, notify = true) {
    const cardToEdit = cards.find(card => card.id === id);
    if (!cardToEdit) {
        if (notify) showNotification('Tarjeta no encontrada para editar.', 'error');
        return;
    }

    // 1. Mostrar la sección de Inicio (formulario)
    showAdminSection('home'); 
    document.getElementById('creationSection').style.display = 'block';
    
    // 2. Llenar el formulario con los datos de la tarjeta
    document.getElementById('name').value = cardToEdit.name || '';
    document.getElementById('title').value = cardToEdit.title || '';
    document.getElementById('company').value = cardToEdit.company || '';
    document.getElementById('description').value = cardToEdit.description || '';
    document.getElementById('phone').value = cardToEdit.phone || '';
    document.getElementById('mobile').value = cardToEdit.mobile || '';
    document.getElementById('email').value = cardToEdit.email || '';
    document.getElementById('address').value = cardToEdit.address || '';
    document.getElementById('website').value = cardToEdit.website || '';
    document.getElementById('linkedin').value = cardToEdit.linkedin || '';
    document.getElementById('facebook').value = cardToEdit.facebook || '';
    document.getElementById('instagram').value = cardToEdit.instagram || ''; 

    // Llenar datos de diseño
    if (cardToEdit.design) {
        document.getElementById('cardBackground').value = cardToEdit.design.cardBackground || '#ffffff';
        document.getElementById('accentColor').value = cardToEdit.design.accentColor || '#3498db';
        document.getElementById('textPrimary').value = cardToEdit.design.textPrimary || '#2c3e50';
        document.getElementById('textSecondary').value = cardToEdit.design.textSecondary || '#7f8c8d';
        document.getElementById('profileShape').value = cardToEdit.design.profileShape || 'circular';
        document.getElementById('fontFamily').value = cardToEdit.design.fontFamily || "'Roboto', sans-serif";
    }
    
    // Nota: La lógica para cargar las imágenes (logo y perfil) de base64 está omitida por ser compleja y no la fuente del error.
    // Asume que si cardToEdit.logo o cardToEdit.profileImage tienen un valor base64, se carga en el preview.

    // 3. Establecer el ID de edición
    editingCardId = id;
    
    // 4. Ajustar la UI para el modo edición
    document.getElementById('formTitle').textContent = 'Editar Tarjeta Existente';
    document.getElementById('submitButton').textContent = 'Actualizar Tarjeta'; // Aparecerá como "Actualizar"
    document.getElementById('cancelEditButton').style.display = 'inline-block';
    
    // 5. Actualizar vista previa
    updateCardPreview();
    
    if (notify) showNotification(`Cargando tarjeta "${cardToEdit.name}" para edición.`, 'info');
}

// Función para eliminar una tarjeta (SOLUCIÓN BOTONES)
function deleteCard(id) {
    if (confirm('¿Estás seguro de que quieres eliminar esta tarjeta? Esta acción es irreversible.')) {
        cards = cards.filter(card => card.id !== id);
        localStorage.setItem(CONFIG.CARDS_KEY, JSON.stringify(cards));
        updateCardsTable();
        showNotification('Tarjeta eliminada correctamente.', 'success');
        
        // Si se estaba editando la tarjeta eliminada, limpiar el formulario
        if (editingCardId === id) {
            resetForm();
        }
    }
}

// ----------------------------------------------------
// FUNCIONES AUXILIARES Y DE UI (Se asume su existencia y se incluye la básica)
// ----------------------------------------------------

function getFormData() {
    // FUNCIÓN ASUMIDA: Recopila los datos del formulario y los devuelve como un objeto.
    const data = {
        // Datos principales
        name: document.getElementById('name').value,
        title: document.getElementById('title').value,
        company: document.getElementById('company').value,
        description: document.getElementById('description').value,
        // Contacto
        phone: document.getElementById('phone').value,
        mobile: document.getElementById('mobile').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        // Redes
        website: document.getElementById('website').value,
        linkedin: document.getElementById('linkedin').value,
        facebook: document.getElementById('facebook').value,
        instagram: document.getElementById('instagram').value,
        // Imágenes (se asume que se almacenan en variables o en el DOM)
        logo: document.getElementById('logoPreview').querySelector('img')?.src || null,
        profileImage: document.getElementById('profilePreview').querySelector('img')?.src || null,
        // Diseño
        design: {
            cardBackground: document.getElementById('cardBackground').value,
            accentColor: document.getElementById('accentColor').value,
            textPrimary: document.getElementById('textPrimary').value,
            textSecondary: document.getElementById('textSecondary').value,
            profileShape: document.getElementById('profileShape').value,
            fontFamily: document.getElementById('fontFamily').value,
        }
    };
    return data;
}

function updateCardPreview() {
    // FUNCIÓN ASUMIDA: Actualiza la vista previa de la tarjeta con los datos del formulario.
    const data = getFormData();
    const preview = document.getElementById('liveCardPreview');
    
    // Aplicar estilos de diseño
    preview.style.backgroundColor = data.design.cardBackground;
    preview.style.fontFamily = data.design.fontFamily;
    preview.style.setProperty('--accentColor', data.design.accentColor);
    preview.style.setProperty('--textPrimary', data.design.textPrimary);
    preview.style.setProperty('--textSecondary', data.design.textSecondary);
    
    preview.className = `card-preview ${data.design.profileShape}`;
    
    // Contenido HTML de la vista previa
    let htmlContent = `
        ${data.logo ? `<img src="${data.logo}" class="logo-image" alt="Logo">` : ''}
        ${data.profileImage ? `<img src="${data.profileImage}" class="profile-image" alt="Profile">` : ''}
        
        <h2>${data.name || 'Nombre Apellido'}</h2>
        <h3>${data.title || 'Título / Cargo'}</h3>
        <p>${data.company || 'Empresa'}</p>
        <p style="font-size: 0.8rem; margin-top: 10px; padding: 0 10px;">${data.description || 'Aquí puedes poner una breve descripción de tu empresa o servicios.'}</p>
        
        <div class="contact-buttons">
            ${data.phone ? `<a href="https://wa.me/${data.phone.replace(/[^\d+]/g, '')}" target="_blank">WhatsApp</a>` : ''}
            ${data.email ? `<a href="mailto:${data.email}">Email</a>` : ''}
            ${data.address ? `<a href="https://maps.google.com/?q=${encodeURIComponent(data.address)}" target="_blank">Ubicación</a>` : ''}
        </div>
        
        <div class="social-icons">
            ${data.website ? `<a href="${data.website}" target="_blank">Web</a>` : ''}
            ${data.linkedin ? `<a href="${data.linkedin}" target="_blank">LinkedIn</a>` : ''}
            ${data.facebook ? `<a href="${data.facebook}" target="_blank">Facebook</a>` : ''}
            ${data.instagram ? `<a href="${data.instagram}" target="_blank">Instagram</a>` : ''}
        </div>
    `;
    
    preview.innerHTML = htmlContent;
}


function renderCardForIndividualView(cardData) {
    // FUNCIÓN ASUMIDA: Renderiza la tarjeta en la vista pública (#card-view).
    const container = document.getElementById('cardDisplayContainer');
    // ... Código para generar el HTML final de la tarjeta pública con cardData ...
    
    // Por simplicidad, usamos la misma función de preview pero ajustamos los estilos globales
    const cardHtml = `<div class="card-preview public-view" id="publicCard"></div>`;
    container.innerHTML = cardHtml;
    const publicCard = document.getElementById('publicCard');
    
    // Reaplicar estilos de diseño y contenido de cardData en publicCard...
    
    // Estilos para la vista pública (para simular el look final)
    publicCard.style.width = '350px';
    publicCard.style.height = 'auto'; 
    publicCard.style.padding = '30px 20px';
    publicCard.style.marginTop = '20px'; 
    publicCard.style.boxShadow = '0 15px 30px rgba(0,0,0,0.2)';
    
    // Se llama a updateCardPreview con los datos de la tarjeta para renderizar
    // Nota: Esto requiere que adaptes tu función de preview para aceptar un objeto de datos.
}

function setupDefaultDesign() {
    // FUNCIÓN ASUMIDA: Establece los valores de diseño por defecto al cargar/resetear.
    // Esto se hace automáticamente con .reset() y los valores iniciales de los inputs.
}

function handleImageUpload(e, type) {
    // FUNCIÓN ASUMIDA: Maneja la carga de imágenes y las convierte a Base64.
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const previewId = type === 'logo' ? 'logoPreview' : 'profilePreview';
            const preview = document.getElementById(previewId);
            
            preview.querySelector('img').src = event.target.result;
            preview.style.display = 'block';
            updateCardPreview();
        };
        reader.readAsDataURL(file);
    }
}

function removeImage(type) {
    // FUNCIÓN ASUMIDA: Elimina la imagen y limpia el input/preview.
    const inputId = type === 'logo' ? 'logoUpload' : 'profileImageUpload';
    const previewId = type === 'logo' ? 'logoPreview' : 'profilePreview';
    
    document.getElementById(inputId).value = ''; // Limpiar el input file
    document.getElementById(previewId).style.display = 'none';
    document.getElementById(previewId).querySelector('img').src = '';
    updateCardPreview();
}

function resetForm() {
    document.getElementById('cardForm').reset();
    editingCardId = null;
    
    setupDefaultDesign(); // Restablecer diseño por defecto
    
    // Ocultar vistas previas de imágenes
    document.getElementById('logoPreview').style.display = 'none';
    document.getElementById('profilePreview').style.display = 'none';
    
    // Restablecer UI
    document.getElementById('formTitle').textContent = 'Crear Nueva Tarjeta';
    document.getElementById('cancelEditButton').style.display = 'none';
    document.getElementById('submitButton').textContent = 'Crear Tarjeta';
    document.getElementById('customUrlDisplay').textContent = 'URL aparecerá aquí';
    document.getElementById('copyUrlBtn').style.display = 'none';
    
    updateCardPreview();
}

function showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function copyCardUrl() {
    const url = document.getElementById('copyUrlBtn').dataset.url;
    if (url) {
        navigator.clipboard.writeText(url).then(() => {
            showNotification('URL copiada al portapapeles. ¡Lista para compartir!', 'success');
        }).catch(err => {
            console.error('Error al copiar URL:', err);
            showNotification('Error al copiar. Copia manualmente la URL de abajo.', 'error');
        });
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


// HACER FUNCIONES GLOBALES PARA EL HTML (ESENCIAL PARA ONCLICK)
window.editCard = editCard;
window.deleteCard = deleteCard;
window.removeImage = removeImage; // Para el HTML de los previews