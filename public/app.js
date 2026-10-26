/**
 * Controlador Principal de la Aplicación Web (Frontend SPA)
 * Red Social Corporativa + Mapa Geoespacial con Leaflet.js y Popularidad por Rating
 */

// Estado Global de la Aplicación
const state = {
  currentRole: 'comp_01', // Rol activo en sesión simulada
  currentUser: {
    uid: 'uid_tech_supply_01',
    companyId: 'comp_01',
    displayName: 'TechSupply Norte',
    role: 'company',
    email: 'contacto@techsupply.com',
    avatar: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=120'
  },
  userLocation: { lat: 4.6560, lng: -74.0580 }, // Ubicación simulada del usuario (Bogotá)
  companies: [],
  activeCompanyInDrawer: null,
  map: null,
  mapMarkers: {},
  posts: []
};

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initSessionSwitcher();
  initLeafletMap();
  initFeed();
  initReciprocityControls();
  initAIChat();
  
  // Cargar datos iniciales
  loadCompanies();
  loadPosts();
});

// ============================================================================
// 1. NAVEGACIÓN ENTRE VISTAS (Feed / Mapa / Estadísticas)
// ============================================================================
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-view');
      
      // Actualizar tabs activas
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Actualizar secciones de vista
      document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active');
      });
      const activeSection = document.getElementById(`view-${targetView}`);
      if (activeSection) activeSection.classList.add('active');

      // Si se abre el mapa, refrescar el tamaño del contenedor de Leaflet
      if (targetView === 'map' && state.map) {
        setTimeout(() => state.map.invalidateSize(), 150);
      }

      // Si se abre estadísticas, cargar el módulo con la regla de reciprocidad
      if (targetView === 'stats') {
        loadCompetitorStats();
      }
    });
  });

  const goToMapBtn = document.getElementById('goToMapBtn');
  if (goToMapBtn) {
    goToMapBtn.addEventListener('click', () => {
      const mapTab = document.querySelector('.nav-tab[data-view="map"]');
      if (mapTab) mapTab.click();
    });
  }
}

// ============================================================================
// 2. GESTIÓN DE ROLES Y SESIONES (Firebase Auth Mock/Real)
// ============================================================================
function initSessionSwitcher() {
  const switcher = document.getElementById('userSwitcher');
  switcher.addEventListener('change', (e) => {
    const val = e.target.value;
    state.currentRole = val;

    if (val === 'user_01') {
      state.currentUser = {
        uid: 'usr_ana_gomez_99',
        companyId: null,
        displayName: 'Ana Gómez',
        role: 'user',
        email: 'ana.gomez@example.com',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120'
      };
    } else {
      const comp = state.companies.find(c => c.id === val);
      state.currentUser = {
        uid: comp ? comp.firebaseUid : 'uid_' + val,
        companyId: val,
        displayName: comp ? comp.name : 'Empresa',
        role: 'company',
        email: comp ? comp.ownerEmail : 'empresa@example.com',
        avatar: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=120'
      };
    }

    updateSessionUI();
    // Si la vista actual es estadísticas, recargar según el nuevo rol
    const statsTab = document.querySelector('.nav-tab[data-view="stats"]');
    if (statsTab && statsTab.classList.contains('active')) {
      loadCompetitorStats();
    }
  });

  updateSessionUI();
}

function updateSessionUI() {
  const isCompany = state.currentUser.role === 'company';
  document.getElementById('sessionName').textContent = state.currentUser.displayName;
  document.getElementById('sessionRole').textContent = isCompany ? 'Empresa' : 'Usuario Común';
  document.getElementById('sessionRole').className = isCompany ? 'session-role badge-company' : 'session-role';
  document.getElementById('sessionAvatar').src = state.currentUser.avatar;

  // Sidebar izquierda
  document.getElementById('sideProfileName').textContent = state.currentUser.displayName;
  document.getElementById('sideProfileAvatar').src = state.currentUser.avatar;
  document.getElementById('createPostAvatar').src = state.currentUser.avatar;

  const currentComp = state.companies.find(c => c.id === state.currentUser.companyId);
  const sideRatingVal = document.getElementById('sideRatingVal');
  const sideTierVal = document.getElementById('sideTierVal');
  const sideReciprocityBox = document.getElementById('sideReciprocityBox');

  if (isCompany && currentComp) {
    sideRatingVal.textContent = `${currentComp.popularity?.avgRating || 0} ★`;
    sideTierVal.textContent = `${currentComp.popularity?.badge || ''} ${currentComp.popularity?.tier || 'ESTÁNDAR'}`;
    
    const isShared = Boolean(currentComp.share_stats);
    sideReciprocityBox.innerHTML = `
      <span class="badge-status-dot ${isShared ? 'green' : 'red'}"></span>
      <span>Reciprocidad: <strong>${isShared ? 'Activa' : 'Desactivada'}</strong></span>
    `;

    // Sincronizar switch de reciprocidad
    const toggle = document.getElementById('reciprocityToggle');
    if (toggle) toggle.checked = isShared;
    updateReciprocityStatusLabel(isShared);
  } else {
    sideRatingVal.textContent = 'N/A';
    sideTierVal.textContent = '👤 Usuario';
    sideReciprocityBox.innerHTML = `<span>Perfil personal</span>`;
  }
}

// ============================================================================
// 3. ENTREGABLE 2 & 3: MAPA LEAFLET.JS Y ALGORITMO DE POPULARIDAD
// ============================================================================
function initLeafletMap() {
  // Inicialización de Leaflet con OpenStreetMap (Sin tarjeta de crédito)
  state.map = L.map('leafletMap', {
    center: [state.userLocation.lat, state.userLocation.lng],
    zoom: 13,
    zoomControl: true
  });

  // Capa base de OpenStreetMap estándar
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(state.map);

  // Marcador de ubicación del usuario
  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: `<div style="background:#2563eb; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(37,99,235,0.8);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
  L.marker([state.userLocation.lat, state.userLocation.lng], { icon: userIcon })
    .addTo(state.map)
    .bindTooltip("📍 Tu Ubicación Actual");

  // Filtros del mapa
  const categoryFilter = document.getElementById('mapCategoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => renderMapMarkers());
  }

  const searchInput = document.getElementById('mapSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderMapMarkers());
  }

  // Cerrar Drawer lateral de empresa
  document.getElementById('closeDrawerBtn').addEventListener('click', () => {
    document.getElementById('companyDrawer').classList.remove('open');
  });
}

/**
 * Carga las empresas desde el backend secundario con su popularidad calculada
 */
async function loadCompanies() {
  try {
    const res = await fetch('/api/companies');
    const data = await res.json();
    if (data.success) {
      state.companies = data.data;
      renderMapMarkers();
      renderTopRanking();
      updateSessionUI();
    }
  } catch (err) {
    console.error('Error cargando empresas:', err);
  }
}

/**
 * Renderiza los marcadores en Leaflet.js
 * EL TAMAÑO Y COLOR DEPENDEN ESTRICTAMENTE DEL PROMEDIO DE CALIFICACIONES DE PRODUCTOS
 */
function renderMapMarkers() {
  if (!state.map) return;

  // Limpiar marcadores existentes
  Object.values(state.mapMarkers).forEach(marker => state.map.removeLayer(marker));
  state.mapMarkers = {};

  const category = document.getElementById('mapCategoryFilter')?.value || 'all';
  const query = (document.getElementById('mapSearchInput')?.value || '').toLowerCase().trim();

  const filtered = state.companies.filter(c => {
    const matchCat = category === 'all' || c.category === category;
    const matchQuery = !query || c.name.toLowerCase().includes(query) || (c.category || '').toLowerCase().includes(query);
    return matchCat && matchQuery;
  });

  filtered.forEach(company => {
    const pop = company.popularity || {
      avgRating: 0,
      markerRadius: 24,
      color: '#64748b',
      badge: '⭐',
      tier: 'BRONZE'
    };

    // ALGORITMO DE POPULARIDAD:
    // El radio del marcador se calculó en backend: 24px a 50px según el promedio ponderado de productos
    const diameter = pop.markerRadius;
    const half = diameter / 2;

    const customMarkerHtml = `
      <div class="popularity-marker-wrap" style="width: ${diameter + 20}px;">
        <div class="popularity-marker-circle" style="
          width: ${diameter}px; 
          height: ${diameter}px; 
          background-color: ${pop.color};
          font-size: ${Math.max(12, Math.round(diameter / 2.6))}px;
          border: 2px solid white;
          box-shadow: 0 4px 12px ${pop.color}66;
        ">
          ${pop.badge}
        </div>
        <div class="popularity-marker-rating">
          ${pop.avgRating > 0 ? `${pop.avgRating}★` : 'Sin Calificar'}
        </div>
      </div>
    `;

    const markerIcon = L.divIcon({
      className: 'custom-company-div-icon',
      html: customMarkerHtml,
      iconSize: [diameter + 20, diameter + 20],
      iconAnchor: [(diameter + 20) / 2, half]
    });

    const marker = L.marker([company.lat, company.lng], {
      icon: markerIcon,
      zIndexOffset: pop.zIndex || 100
    }).addTo(state.map);

    // Click en el marcador: abre el Drawer lateral con el perfil y catálogo en tiempo real
    marker.on('click', () => {
      openCompanyDrawer(company.id);
    });

    state.mapMarkers[company.id] = marker;
  });
}

/**
 * Despliega el catálogo de productos y stock en tiempo real en el Drawer
 */
async function openCompanyDrawer(companyId) {
  try {
    const res = await fetch(`/api/companies/${companyId}`);
    const data = await res.json();
    if (!data.success) return;

    const company = data.data;
    state.activeCompanyInDrawer = company;

    const drawer = document.getElementById('companyDrawer');
    document.getElementById('drawerTitle').textContent = company.name;
    document.getElementById('drawerCategory').textContent = company.category;
    document.getElementById('drawerDesc').textContent = company.description;
    document.getElementById('drawerAddress').textContent = company.address;
    document.getElementById('drawerCoords').textContent = `Lat: ${company.lat.toFixed(4)}, Lng: ${company.lng.toFixed(4)}`;

    const pop = company.popularity;
    document.getElementById('drawerAvgRating').textContent = pop.avgRating > 0 ? `${pop.avgRating}★` : 'N/A';
    document.getElementById('drawerVotes').textContent = `Basado en ${pop.totalRatings} reseñas de ${pop.ratedProductsCount} productos`;
    document.getElementById('drawerTier').textContent = `${pop.badge} ${pop.tier}`;

    // Estrellas doradas visuales
    const fullStars = Math.round(pop.avgRating);
    document.getElementById('drawerStars').textContent = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);

    // Listado de productos con stock en tiempo real
    const productsContainer = document.getElementById('drawerProductsList');
    productsContainer.innerHTML = '';

    if (!company.products || company.products.length === 0) {
      productsContainer.innerHTML = `<p class="text-muted">Esta empresa aún no ha publicado productos en su catálogo.</p>`;
    } else {
      company.products.forEach(prod => {
        const isLowStock = prod.stock <= 5;
        const prodCard = document.createElement('div');
        prodCard.className = 'product-item-card';
        prodCard.innerHTML = `
          <div class="product-name-row">
            <span>${prod.name}</span>
            <span class="badge-stock ${isLowStock ? 'low-stock' : 'in-stock'}">
              ${prod.stock > 0 ? `${prod.stock} en stock` : 'Agotado'}
            </span>
          </div>
          <div class="product-rating-row">
            <div>
              <strong>$${prod.price}</strong> • 
              <span class="text-muted">${prod.avgRating}★ (${prod.ratingCount} votos)</span>
            </div>
            <div class="rating-stars-input">
              <span style="font-size:11px; margin-right:4px;">Calificar:</span>
              ${[1, 2, 3, 4, 5].map(star => `
                <button class="star-btn" data-star="${star}" title="Calificar con ${star} estrellas">★</button>
              `).join('')}
            </div>
          </div>
        `;

        // Event listener para calificar producto directamente
        const starButtons = prodCard.querySelectorAll('.star-btn');
        starButtons.forEach(btn => {
          btn.addEventListener('click', async () => {
            const starCount = parseInt(btn.getAttribute('data-star'), 10);
            await rateProduct(company.id, prod.id, starCount);
          });
        });

        productsContainer.appendChild(prodCard);
      });
    }

    drawer.classList.add('open');
  } catch (err) {
    console.error('Error abriendo drawer de empresa:', err);
  }
}

/**
 * Calificar un producto individual (Afecta el algoritmo de popularidad en vivo)
 */
async function rateProduct(companyId, productId, stars) {
  try {
    const res = await fetch(`/api/companies/${companyId}/products/${productId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stars,
        comment: 'Calificación directa desde el mapa',
        authorName: state.currentUser.displayName
      })
    });

    const data = await res.json();
    if (data.success) {
      // Recargar empresas para recalcular mapa
      await loadCompanies();
      // Refrescar el drawer
      await openCompanyDrawer(companyId);
    }
  } catch (err) {
    console.error('Error calificando producto:', err);
  }
}

function renderTopRanking() {
  const container = document.getElementById('topCompaniesList');
  if (!container) return;

  const sorted = [...state.companies].sort((a, b) => (b.popularity?.avgRating || 0) - (a.popularity?.avgRating || 0));
  container.innerHTML = sorted.slice(0, 4).map((c, i) => `
    <div class="ranking-item" onclick="focusCompanyOnMap('${c.id}')">
      <div class="ranking-info">
        <span class="ranking-name">${i + 1}. ${c.name}</span>
        <span class="ranking-cat">${c.category}</span>
      </div>
      <span class="ranking-badge">${c.popularity?.avgRating || 0}★</span>
    </div>
  `).join('');
}

window.focusCompanyOnMap = function(companyId) {
  const tab = document.querySelector('.nav-tab[data-view="map"]');
  if (tab) tab.click();
  const c = state.companies.find(comp => comp.id === companyId);
  if (c && state.map) {
    state.map.flyTo([c.lat, c.lng], 15, { duration: 1 });
    setTimeout(() => openCompanyDrawer(c.id), 800);
  }
};

// ============================================================================
// 4. ENTREGABLE 4: ESTADÍSTICAS Y REGLA DE RECIPROCIDAD
// ============================================================================
function initReciprocityControls() {
  const toggle = document.getElementById('reciprocityToggle');
  if (toggle) {
    toggle.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      await updateReciprocitySetting(isChecked);
    });
  }

  const unblockBtn = document.getElementById('enableReciprocityFromBlockedBtn');
  if (unblockBtn) {
    unblockBtn.addEventListener('click', async () => {
      const toggle = document.getElementById('reciprocityToggle');
      if (toggle) toggle.checked = true;
      await updateReciprocitySetting(true);
    });
  }
}

async function updateReciprocitySetting(enable) {
  if (state.currentUser.role !== 'company' || !state.currentUser.companyId) {
    alert('Esta opción solo aplica a perfiles con rol de Empresa.');
    return;
  }

  try {
    const res = await fetch(`/api/companies/${state.currentUser.companyId}/share-stats`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_stats: enable })
    });
    const data = await res.json();
    if (data.success) {
      updateReciprocityStatusLabel(enable);
      await loadCompanies();
      await loadCompetitorStats();
    }
  } catch (err) {
    console.error('Error actualizando reciprocidad:', err);
  }
}

function updateReciprocityStatusLabel(isEnabled) {
  const label = document.getElementById('reciprocityStatusLabel');
  if (label) {
    label.textContent = isEnabled 
      ? 'Estado: ACTIVADO (Acceso Habilitado)' 
      : 'Estado: DESACTIVADO (Acceso Bloqueado)';
    label.style.color = isEnabled ? '#15803d' : '#dc2626';
  }
}

/**
 * Consulta la API de estadísticas de competidores protegida por el middleware de reciprocidad
 */
async function loadCompetitorStats() {
  const blockedBox = document.getElementById('reciprocityBlockedBox');
  const contentBox = document.getElementById('statsDashboardContent');

  if (state.currentUser.role !== 'company' || !state.currentUser.companyId) {
    // Si es usuario común, se le informa que el dashboard de competencia es corporativo
    if (blockedBox) {
      blockedBox.classList.remove('hidden');
      blockedBox.querySelector('h3').textContent = 'Módulo Corporativo Exclusivo';
      blockedBox.querySelector('.blocked-message').textContent = 
        'El módulo de benchmarking y estadísticas cruzadas de competidores está reservado exclusivamente para perfiles con rol de Empresa. Cambia tu rol en el selector superior.';
      blockedBox.querySelector('.blocked-action-box').style.display = 'none';
    }
    if (contentBox) contentBox.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(`/api/competitors/stats`, {
      headers: {
        'x-company-id': state.currentUser.companyId
      }
    });

    // EVALUACIÓN DE LA REGLA DE RECIPROCIDAD:
    // Si el servidor devuelve 403 Forbidden por la regla de reciprocidad
    if (res.status === 403) {
      const errData = await res.json();
      console.warn('Acceso bloqueado por regla de reciprocidad:', errData);
      
      blockedBox.classList.remove('hidden');
      blockedBox.querySelector('h3').textContent = 'Acceso Bloqueado por Política de Reciprocidad';
      blockedBox.querySelector('.blocked-message').textContent = errData.message;
      blockedBox.querySelector('.blocked-action-box').style.display = 'block';
      contentBox.classList.add('hidden');
      return;
    }

    if (!res.ok) {
      throw new Error(`Error en el servidor: ${res.status}`);
    }

    // ACCESO CONCEDIDO: Se desbloquean los datos
    const data = await res.json();
    blockedBox.classList.add('hidden');
    contentBox.classList.remove('hidden');

    // Renderizar KPIs
    document.getElementById('kpiAvgMarketRating').textContent = `${data.marketOverview.averageMarketRating} ★`;
    document.getElementById('kpiTotalReviews').textContent = data.marketOverview.totalMarketReviews;
    document.getElementById('kpiCompetitorsCount').textContent = data.marketOverview.competitorsAnalyzed;

    const myComp = state.companies.find(c => c.id === state.currentUser.companyId);
    if (myComp) {
      document.getElementById('kpiMyTier').textContent = `${myComp.popularity.badge} ${myComp.popularity.tier}`;
    }

    // Renderizar Tabla de Competidores
    const tbody = document.getElementById('competitorTableBody');
    tbody.innerHTML = data.competitors.map(comp => `
      <tr>
        <td><strong>${comp.name}</strong></td>
        <td>${comp.category}</td>
        <td><span class="badge-tier">${comp.popularityTier}</span></td>
        <td><strong>${comp.avgProductRating} ★</strong></td>
        <td>${comp.totalRatings} reseñas</td>
        <td>${comp.catalogSize} productos (${comp.totalStockEstimated} unid. stock)</td>
        <td>${comp.topRatedProduct ? `${comp.topRatedProduct.name} (${comp.topRatedProduct.rating}★)` : 'N/A'}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Error cargando estadísticas:', err);
  }
}

// ============================================================================
// 5. MÓDULO C: FEED ESTILO LINKEDIN (Servidor Secundario)
// ============================================================================
function initFeed() {
  const publishBtn = document.getElementById('publishPostBtn');
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      const input = document.getElementById('postContentInput');
      const content = input.value.trim();
      if (!content) return;

      try {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            authorName: state.currentUser.displayName,
            authorRole: state.currentUser.role === 'company' ? 'Empresa' : 'Usuario Común',
            authorCompanyId: state.currentUser.companyId,
            authorAvatar: state.currentUser.avatar,
            tags: ['#RedCorporativa', '#StockDisponible']
          })
        });

        const data = await res.json();
        if (data.success) {
          input.value = '';
          await loadPosts();
        }
      } catch (err) {
        console.error('Error publicando post:', err);
      }
    });
  }

  // Tags rápidos
  document.querySelectorAll('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const input = document.getElementById('postContentInput');
      input.value += ` ${pill.textContent}`;
    });
  });
}

async function loadPosts() {
  try {
    const res = await fetch('/api/posts');
    const data = await res.json();
    if (data.success) {
      state.posts = data.data;
      renderPosts();
    }
  } catch (err) {
    console.error('Error cargando posts:', err);
  }
}

function renderPosts() {
  const container = document.getElementById('postsContainer');
  if (!container) return;

  container.innerHTML = state.posts.map(post => `
    <article class="card post-card">
      <div class="post-header">
        <img src="${post.authorAvatar}" alt="Avatar">
        <div>
          <div class="post-author-name">${post.authorName}</div>
          <div class="post-author-meta">${post.authorRole} • ${formatDate(post.createdAt)}</div>
        </div>
      </div>
      <div class="post-content">${escapeHtml(post.content)}</div>
      <div class="post-tags">
        ${(post.tags || []).map(t => `<span class="post-tag">${t}</span>`).join(' ')}
      </div>
      <div class="post-actions">
        <button class="post-action-btn" onclick="likePost('${post.id}')">
          👍 Me gusta (${post.likes || 0})
        </button>
        <button class="post-action-btn">
          💬 Comentar (${post.commentsCount || 0})
        </button>
        <button class="post-action-btn">
          🔗 Compartir
        </button>
      </div>
    </article>
  `).join('');
}

window.likePost = async function(postId) {
  try {
    const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      const p = state.posts.find(item => item.id === postId);
      if (p) p.likes = data.data.likes;
      renderPosts();
    }
  } catch (err) {
    console.error('Error dando like:', err);
  }
};

// ============================================================================
// 6. ENTREGABLE 5: CHATBOT DE IA INTEGRADO A MAPAS Y PERFILES
// ============================================================================
function initAIChat() {
  const triggerBtn = document.getElementById('toggleAiChatBtn');
  const closeBtn = document.getElementById('closeAiChatBtn');
  const drawer = document.getElementById('aiChatDrawer');
  const form = document.getElementById('aiChatForm');

  triggerBtn.addEventListener('click', () => {
    drawer.classList.toggle('minimized');
  });

  closeBtn.addEventListener('click', () => {
    drawer.classList.add('minimized');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('aiMessageInput');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    await sendChatMessage(msg);
  });

  // Chips de sugerencia rápida
  document.querySelectorAll('.ai-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const prompt = chip.getAttribute('data-prompt');
      await sendChatMessage(prompt);
    });
  });
}

async function sendChatMessage(prompt) {
  const container = document.getElementById('aiMessagesContainer');

  // Agregar mensaje del usuario a la interfaz
  const userMsgEl = document.createElement('div');
  userMsgEl.className = 'ai-msg user';
  userMsgEl.innerHTML = `<div class="msg-bubble">${escapeHtml(prompt)}</div>`;
  container.appendChild(userMsgEl);
  container.scrollTop = container.scrollHeight;

  // Indicador de carga
  const botMsgEl = document.createElement('div');
  botMsgEl.className = 'ai-msg bot';
  botMsgEl.innerHTML = `<div class="msg-bubble"><em>Pensando... consultando perfiles y coordenadas</em> ✨</div>`;
  container.appendChild(botMsgEl);
  container.scrollTop = container.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        userLocation: state.userLocation,
        currentUser: state.currentUser
      })
    });

    const data = await res.json();
    
    // Convertir Markdown simple a HTML para la respuesta del bot
    const formattedReply = markdownToHtml(data.reply || 'No pude procesar tu mensaje.');
    botMsgEl.innerHTML = `<div class="msg-bubble">${formattedReply}</div>`;
    container.scrollTop = container.scrollHeight;

    // Si la acción fue calificar un producto o encontrar lugares, actualizar datos en vivo
    if (data.action === 'PRODUCT_RATED') {
      await loadCompanies();
    }
  } catch (err) {
    botMsgEl.innerHTML = `<div class="msg-bubble text-danger">⚠️ Error conectando con el servicio de IA.</div>`;
  }
}

// ============================================================================
// HELPERS
// ============================================================================
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function markdownToHtml(md) {
  return md
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}
