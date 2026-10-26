const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./database');
const { PopularityService } = require('./services/popularityService');
const { AIChatService } = require('./services/aiChatService');
const { enforceReciprocityRule } = require('./middleware/reciprocity');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Conectar con la base de datos externa (Neon.tech / Supabase / TiDB)
db.connect();

// ============================================================================
// ALMACÉN DE DATOS EN MEMORIA / PERSISTENTE
// ============================================================================

// Usuarios sincronizados
let users = {
  'uid_admin_01': {
    uid: 'uid_admin_01',
    email: 'bussearchresponses@gmail.com',
    displayName: 'Administrador Bussearch',
    username: 'admin',
    role: 'admin',
    companyId: null
  }
};

// Perfiles de empresas (Aprobadas por defecto las semillas)
let companies = [
  {
    id: 'comp_01',
    ownerUid: 'uid_tech_supply_01',
    name: 'TechSupply Norte',
    category: 'Tecnología e Informática',
    description: 'Distribuidor mayorista de hardware, periféricos y accesorios de alta gama.',
    address: 'Calle 100 # 15-20, Bogotá',
    lat: 4.6865,
    lng: -74.0538,
    phone: '+57 310 987 6543',
    website: 'https://techsupply.example.com',
    ownerEmail: 'contacto@techsupply.com',
    status: 'approved',
    share_stats: true,
    avgRating: 4.8,
    ratingCount: 92,
    tags: ['Tecnología', 'Hardware', 'Gaming'],
    amenities: ['Parqueadero', 'Wi-Fi'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'comp_02',
    ownerUid: 'uid_cafe_gourmet_02',
    name: 'Café & Panadería Gourmet',
    category: 'Alimentos y Bebidas',
    description: 'Café de origen de especialidad, repostería artesanal y desayunos ejecutivos.',
    address: 'Carrera 7 # 72-41, Bogotá',
    lat: 4.6560,
    lng: -74.0580,
    phone: '+57 320 123 4567',
    website: 'https://cafegourmet.example.com',
    ownerEmail: 'gerencia@cafegourmet.com',
    status: 'approved',
    share_stats: false,
    avgRating: 4.2,
    ratingCount: 33,
    tags: ['Café', 'Panadería', 'Desayunos'],
    amenities: ['Terraza', 'Wi-Fi'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'comp_03',
    ownerUid: 'uid_ferreteria_central_03',
    name: 'Ferretería & Construcción Central',
    category: 'Construcción y Ferretería',
    description: 'Herramientas industriales, materiales de construcción y plomería certificada.',
    address: 'Avenida Caracas # 45-12, Bogotá',
    lat: 4.6335,
    lng: -74.0682,
    phone: '+57 315 555 7890',
    website: 'https://ferreteriacentral.example.com',
    ownerEmail: 'ventas@ferreteriacentral.com',
    status: 'approved',
    share_stats: true,
    avgRating: 4.5,
    ratingCount: 64,
    tags: ['Herramientas', 'Construcción'],
    amenities: ['Domicilio', 'Parqueadero'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'comp_04',
    ownerUid: 'uid_salud_integral_04',
    name: 'Salud & Bienestar Óptica',
    category: 'Salud y Cuidado Personal',
    description: 'Exámenes de optometría computarizada y monturas de diseñador.',
    address: 'Calle 53 # 21-30, Bogotá',
    lat: 4.6441,
    lng: -74.0735,
    phone: '+57 301 444 3322',
    website: 'https://saludintegral.example.com',
    ownerEmail: 'optica@saludintegral.com',
    status: 'approved',
    share_stats: true,
    avgRating: 3.7,
    ratingCount: 10,
    tags: ['Salud', 'Óptica'],
    amenities: ['Citas Previas'],
    createdAt: new Date().toISOString()
  }
];

// Catálogo de Productos y Stock en Tiempo Real por Empresa
let products = {
  comp_01: [
    { id: 'p_01', companyId: 'comp_01', companyName: 'TechSupply Norte', name: 'Monitor Gamer 27" 165Hz', description: 'Monitor IPS 144-165Hz con FreeSync', price: 280, quantity: 14, stock: 14, unit: 'un', avgRating: 4.9, ratingCount: 28 },
    { id: 'p_02', companyId: 'comp_01', companyName: 'TechSupply Norte', name: 'Teclado Mecánico RGB Switch Red', description: 'Teclado mecánico con switches lineales', price: 75, quantity: 32, stock: 32, unit: 'un', avgRating: 4.8, ratingCount: 45 },
    { id: 'p_03', companyId: 'comp_01', companyName: 'TechSupply Norte', name: 'Mouse Inalámbrico Ergonómico Pro', description: 'Mouse con sensor óptico 16000 DPI', price: 45, quantity: 3, stock: 3, unit: 'un', avgRating: 4.7, ratingCount: 19 }
  ],
  comp_02: [
    { id: 'p_04', companyId: 'comp_02', companyName: 'Café & Panadería Gourmet', name: 'Café Grano Especialidad Huila 500g', description: 'Tostión media con notas achocolatadas', price: 12, quantity: 65, stock: 65, unit: 'un', avgRating: 4.2, ratingCount: 15 },
    { id: 'p_05', companyId: 'comp_02', companyName: 'Café & Panadería Gourmet', name: 'Croissant Almendras Artesanal', description: 'Elaborado con mantequilla francesa', price: 3.5, quantity: 2, stock: 2, unit: 'un', avgRating: 3.9, ratingCount: 10 },
    { id: 'p_06', companyId: 'comp_02', companyName: 'Café & Panadería Gourmet', name: 'Combo Desayuno Ejecutivo', description: 'Café + Croissant + Omelette', price: 8, quantity: 25, stock: 25, unit: 'un', avgRating: 4.0, ratingCount: 8 }
  ],
  comp_03: [
    { id: 'p_07', companyId: 'comp_03', companyName: 'Ferretería & Construcción Central', name: 'Taladro Percutor Inalámbrico 20V', description: 'Incluye 2 baterías y maletín de transporte', price: 110, quantity: 9, stock: 9, unit: 'un', avgRating: 4.6, ratingCount: 30 },
    { id: 'p_08', companyId: 'comp_03', companyName: 'Ferretería & Construcción Central', name: 'Set de Herramientas 120 Piezas', description: 'Juego de copas, llaves y destornilladores', price: 85, quantity: 18, stock: 18, unit: 'un', avgRating: 4.5, ratingCount: 22 },
    { id: 'p_09', companyId: 'comp_03', companyName: 'Ferretería & Construcción Central', name: 'Cinta Métrica Láser 40m', description: 'Medición rápida con cálculo de área y volumen', price: 38, quantity: 1, stock: 1, unit: 'un', avgRating: 4.4, ratingCount: 12 }
  ],
  comp_04: [
    { id: 'p_10', companyId: 'comp_04', companyName: 'Salud & Bienestar Óptica', name: 'Gafas de Sol con Filtro Polarizado UV400', description: 'Montura ligera en acetato italiano', price: 55, quantity: 20, stock: 20, unit: 'un', avgRating: 3.8, ratingCount: 6 },
    { id: 'p_11', companyId: 'comp_04', companyName: 'Salud & Bienestar Óptica', name: 'Lentes Antirreflejo BlueBlock para Pantallas', description: 'Protección para jornadas frente al computador', price: 65, quantity: 15, stock: 15, unit: 'un', avgRating: 3.5, ratingCount: 4 }
  ]
};

// Calificaciones de empresas
let companyRatings = [];

// Feed estilo LinkedIn
let posts = [
  {
    id: 'post_01',
    authorUid: 'uid_tech_supply_01',
    authorName: 'TechSupply Norte',
    authorIsCompany: true,
    authorRole: 'Empresa',
    authorCompanyId: 'comp_01',
    authorAvatar: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=120&auto=format&fit=crop&q=80',
    content: '🚀 ¡Nuevo cargamento de monitores de 165Hz y teclados mecánicos para profesionales ya disponible en nuestro almacén! Pueden verificar nuestro stock en tiempo real directamente en el mapa interactivo.',
    text: '🚀 ¡Nuevo cargamento de monitores de 165Hz y teclados mecánicos para profesionales ya disponible en nuestro almacén! Pueden verificar nuestro stock en tiempo real directamente en el mapa interactivo.',
    tags: ['#Tecnología', '#Hardware', '#Innovación', '#StockDisponible'],
    likeCount: 18,
    commentCount: 4,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'post_02',
    authorUid: 'uid_cafe_gourmet_02',
    authorName: 'Café & Panadería Gourmet',
    authorIsCompany: true,
    authorRole: 'Empresa',
    authorCompanyId: 'comp_02',
    authorAvatar: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=120&auto=format&fit=crop&q=80',
    content: '☕ El aroma del buen café despierta las mejores ideas de negocio. Abrimos nuestra terraza para reuniones de networking empresarial de 8:00 AM a 6:00 PM.',
    text: '☕ El aroma del buen café despierta las mejores ideas de negocio. Abrimos nuestra terraza para reuniones de networking empresarial de 8:00 AM a 6:00 PM.',
    tags: ['#Networking', '#CaféDeOrigen', '#EspacioEjecutivo'],
    likeCount: 24,
    commentCount: 6,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'post_03',
    authorUid: 'uid_ana_gomez',
    authorName: 'Ana Gómez',
    authorIsCompany: false,
    authorRole: 'Usuario Común',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    content: 'Acabo de calificar los periféricos de TechSupply desde el chatbot interactivo. ¡Increíble la precisión del mapa al mostrar la calidad basada en el stock!',
    text: 'Acabo de calificar los periféricos de TechSupply desde el chatbot interactivo. ¡Increíble la precisión del mapa al mostrar la calidad basada en el stock!',
    tags: ['#ExperienciaDeUsuario', '#Geolocalización', '#Reseñas'],
    likeCount: 9,
    commentCount: 1,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
  }
];

const getCompanyProducts = (companyId) => products[companyId] || [];
const getCompanyById = async (id) => companies.find(c => c.id === id);

// Servicio de Chatbot IA
const aiChatService = new AIChatService({
  companiesStore: () => PopularityService.enrichCompaniesWithPopularity(companies, getCompanyProducts),
  productsStore: (companyId) => getCompanyProducts(companyId),
  rateProductCallback: async ({ companyId, productId, stars, comment, authorName }) => {
    const companyProducts = products[companyId] || [];
    const product = companyProducts.find(p => p.id === productId);
    if (!product) throw new Error('Producto no encontrado');

    const oldCount = product.ratingCount || 0;
    const oldAvg = product.avgRating || 0;
    const newCount = oldCount + 1;
    const newAvg = Math.round(((oldAvg * oldCount) + stars) / newCount * 10) / 10;

    product.avgRating = newAvg;
    product.ratingCount = newCount;

    const popularity = PopularityService.calculateCompanyPopularity(companyProducts);

    return {
      productAvgRating: newAvg,
      productRatingCount: newCount,
      companyAvgRating: popularity.avgRating,
      newMarkerRadius: popularity.markerRadius
    };
  }
});

// ============================================================================
// RUTAS DE LA API
// ============================================================================

// ---------------- USUARIOS (Sincronización Perfil sin Firestore)
app.get('/api/users/:uid', (req, res) => {
  const { uid } = req.params;
  const user = users[uid];
  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }
  res.json({ success: true, data: user });
});

app.post('/api/users', (req, res) => {
  const { uid, email, displayName, username, role, companyId, companyStatus } = req.body;
  if (!uid) return res.status(400).json({ success: false, message: 'UID requerido' });

  const isBussearchAdmin = (email || '').toLowerCase().trim() === 'bussearchresponses@gmail.com';
  const effectiveRole = isBussearchAdmin ? 'admin' : (role || 'user');

  users[uid] = {
    uid,
    email: email || users[uid]?.email || '',
    displayName: displayName || users[uid]?.displayName || '',
    username: username || users[uid]?.username || '',
    role: effectiveRole,
    companyId: companyId !== undefined ? companyId : (users[uid]?.companyId || null),
    companyStatus: companyStatus || users[uid]?.companyStatus || null,
    updatedAt: new Date().toISOString()
  };

  res.json({ success: true, data: users[uid] });
});

app.get('/api/users', (req, res) => {
  res.json({ success: true, data: Object.values(users) });
});

// ---------------- EMPRESAS (Para Mapa y Aprobaciones del Administrador)
app.get('/api/companies', (req, res) => {
  const { status, ownerUid } = req.query;
  let filtered = [...companies];

  if (status) {
    filtered = filtered.filter(c => (c.status || 'approved').toLowerCase() === status.toLowerCase());
  }
  if (ownerUid) {
    filtered = filtered.filter(c => c.ownerUid === ownerUid);
  }

  const enriched = PopularityService.enrichCompaniesWithPopularity(filtered, getCompanyProducts);
  res.json({ success: true, data: enriched });
});

app.get('/api/companies/:id', (req, res) => {
  const company = companies.find(c => c.id === req.params.id);
  if (!company) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });

  const companyProducts = getCompanyProducts(company.id);
  const popularity = PopularityService.calculateCompanyPopularity(companyProducts);

  res.json({
    success: true,
    data: {
      ...company,
      popularity,
      products: companyProducts
    }
  });
});

// Registrar nueva empresa (Auto-aprobada o pendiente según configuración)
app.post('/api/companies', (req, res) => {
  const {
    id, ownerUid, name, category, description, lat, lng,
    address, phone, website, tags, amenities, openingHours,
    acceptsReservations, maxReservation, share_stats, status
  } = req.body;

  if (!name || lat === undefined || lng === undefined) {
    return res.status(400).json({ success: false, message: 'Nombre y coordenadas lat/lng requeridos.' });
  }

  const companyId = id || `comp_${Date.now()}`;
  const companyStatus = status || 'approved';

  const newCompany = {
    id: companyId,
    ownerUid: ownerUid || '',
    name: name.trim(),
    category: category || 'Comercio General',
    description: description || '',
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    address: address || '',
    phone: phone || '',
    website: website || '',
    tags: Array.isArray(tags) ? tags : [],
    amenities: Array.isArray(amenities) ? amenities : [],
    openingHours: openingHours || '',
    acceptsReservations: Boolean(acceptsReservations),
    maxReservation: parseInt(maxReservation, 10) || 0,
    share_stats: Boolean(share_stats),
    status: companyStatus,
    avgRating: 0.0,
    ratingCount: 0,
    createdAt: new Date().toISOString()
  };

  // Reemplazar si ya existe para este owner o agregar
  const existingIdx = companies.findIndex(c => c.id === companyId || (ownerUid && c.ownerUid === ownerUid));
  if (existingIdx !== -1) {
    companies[existingIdx] = { ...companies[existingIdx], ...newCompany };
  } else {
    companies.push(newCompany);
  }

  // Si no tiene catálogo de productos asignado, inicializar array vacío
  if (!products[companyId]) {
    products[companyId] = [];
  }

  // Actualizar el perfil del usuario dueño
  if (ownerUid && users[ownerUid]) {
    users[ownerUid].companyId = companyId;
    users[ownerUid].role = 'company';
    users[ownerUid].companyStatus = companyStatus;
  }

  res.status(201).json({
    success: true,
    message: 'Empresa registrada correctamente en el host externo.',
    id: companyId,
    data: newCompany
  });
});

app.put('/api/companies/:id', (req, res) => {
  const { id } = req.params;
  const idx = companies.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });

  companies[idx] = { ...companies[idx], ...req.body, id };
  res.json({ success: true, data: companies[idx] });
});

// APROBACIÓN / RECHAZO POR PARTE DEL ADMINISTRADOR (bussearchresponses@gmail.com)
app.patch('/api/companies/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const company = companies.find(c => c.id === id);
  if (!company) return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });

  company.status = status;
  if (reason) company.rejectionReason = reason;
  company.reviewedAt = new Date().toISOString();

  // Actualizar usuario dueño correspondiente
  if (company.ownerUid && users[company.ownerUid]) {
    if (status === 'approved') {
      users[company.ownerUid].role = 'company';
      users[company.ownerUid].companyId = company.id;
      users[company.ownerUid].companyStatus = 'approved';
    } else if (status === 'rejected') {
      users[company.ownerUid].role = 'user';
      users[company.ownerUid].companyStatus = 'rejected';
      users[company.ownerUid].companyRejectionReason = reason;
    }
  }

  console.log(`[Admin] Empresa ${company.name} (${company.id}) actualizada a estado: ${status}`);
  res.json({ success: true, message: `Estado actualizado a ${status}`, data: company });
});

// ---------------- STOCK E INVENTARIO
app.get('/api/companies/:id/stock', (req, res) => {
  const { id } = req.params;
  res.json({ success: true, data: products[id] || [] });
});

app.post('/api/companies/:id/stock', (req, res) => {
  const { id } = req.params;
  const item = req.body;
  if (!item.name) return res.status(400).json({ success: false, message: 'Nombre del producto requerido' });

  if (!products[id]) products[id] = [];
  const itemId = item.id || `p_${Date.now()}`;
  const newItem = {
    ...item,
    id: itemId,
    companyId: id,
    price: parseFloat(item.price) || 0,
    quantity: parseInt(item.quantity !== undefined ? item.quantity : item.stock, 10) || 0,
    stock: parseInt(item.quantity !== undefined ? item.quantity : item.stock, 10) || 0,
    avgRating: parseFloat(item.avgRating) || 0,
    ratingCount: parseInt(item.ratingCount, 10) || 0,
    updatedAt: new Date().toISOString()
  };

  const existingIdx = products[id].findIndex(p => p.id === itemId);
  if (existingIdx !== -1) {
    products[id][existingIdx] = newItem;
  } else {
    products[id].push(newItem);
  }

  res.status(201).json({ success: true, data: newItem });
});

app.delete('/api/companies/:id/stock/:itemId', (req, res) => {
  const { id, itemId } = req.params;
  if (products[id]) {
    products[id] = products[id].filter(p => p.id !== itemId);
  }
  res.json({ success: true, message: 'Producto eliminado' });
});

app.get('/api/stock', (req, res) => {
  const allStock = Object.values(products).flat();
  res.json({ success: true, data: allStock });
});

// ---------------- CALIFICACIONES Y POPULARIDAD
app.post('/api/companies/:companyId/products/:productId/rate', (req, res) => {
  const { companyId, productId } = req.params;
  const { stars, comment, authorName } = req.body;

  const numericStars = parseInt(stars, 10);
  if (isNaN(numericStars) || numericStars < 1 || numericStars > 5) {
    return res.status(400).json({ success: false, message: 'La calificación debe estar entre 1 y 5 estrellas.' });
  }

  const companyProducts = products[companyId];
  if (!companyProducts) return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });

  const product = companyProducts.find(p => p.id === productId);
  if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });

  const oldCount = product.ratingCount || 0;
  const oldAvg = product.avgRating || 0;
  const newCount = oldCount + 1;
  const newAvg = Math.round(((oldAvg * oldCount) + numericStars) / newCount * 10) / 10;

  product.avgRating = newAvg;
  product.ratingCount = newCount;

  const popularity = PopularityService.calculateCompanyPopularity(companyProducts);

  res.json({
    success: true,
    message: 'Calificación registrada exitosamente.',
    data: {
      productId: product.id,
      productName: product.name,
      avgRating: newAvg,
      ratingCount: newCount,
      companyPopularity: popularity
    }
  });
});

app.get('/api/companies/:id/ratings', (req, res) => {
  const { id } = req.params;
  const list = companyRatings.filter(r => r.companyId === id);
  res.json({ success: true, data: list });
});

app.post('/api/companies/:id/ratings', (req, res) => {
  const { id } = req.params;
  const { uid, authorName, stars, comment } = req.body;

  const newRating = {
    id: `r_${Date.now()}`,
    companyId: id,
    uid: uid || 'anonymous',
    authorName: authorName || 'Usuario',
    stars: parseInt(stars, 10) || 5,
    comment: comment || '',
    createdAt: new Date().toISOString()
  };

  companyRatings.push(newRating);

  // Recalcular promedio de la empresa
  const comp = companies.find(c => c.id === id);
  if (comp) {
    const compRatings = companyRatings.filter(r => r.companyId === id);
    const sum = compRatings.reduce((acc, r) => acc + r.stars, 0);
    comp.ratingCount = compRatings.length;
    comp.avgRating = Math.round((sum / compRatings.length) * 10) / 10;
  }

  res.status(201).json({ success: true, data: newRating });
});

// ---------------- RECIPROCIDAD Y ANALÍTICA DE COMPETENCIA
app.patch('/api/companies/:id/share-stats', (req, res) => {
  const { id } = req.params;
  const { share_stats } = req.body;

  const company = companies.find(c => c.id === id);
  if (!company) return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });

  company.share_stats = Boolean(share_stats);

  res.json({
    success: true,
    message: `Opción "Compartir mis estadísticas" actualizada a: ${company.share_stats ? 'ACTIVADO' : 'DESACTIVADO'}`,
    data: {
      companyId: company.id,
      companyName: company.name,
      share_stats: company.share_stats
    }
  });
});

app.get('/api/competitors/stats', enforceReciprocityRule(getCompanyById), (req, res) => {
  const requestingCompany = req.authenticatedCompany;
  const allEnriched = PopularityService.enrichCompaniesWithPopularity(companies, getCompanyProducts);
  const competitors = allEnriched.filter(c => c.id !== requestingCompany.id);

  const totalMarketRatings = allEnriched.reduce((acc, c) => acc + c.popularity.totalRatings, 0);
  const avgMarketRating = allEnriched.length > 0
    ? (allEnriched.reduce((acc, c) => acc + c.popularity.avgRating, 0) / allEnriched.length).toFixed(1)
    : 0;

  const industryAnalysis = competitors.map(comp => {
    const prods = getCompanyProducts(comp.id);
    const topProd = [...prods].sort((a, b) => b.avgRating - a.avgRating)[0];
    const totalInventory = prods.reduce((acc, p) => acc + (p.stock || p.quantity || 0), 0);

    return {
      companyId: comp.id,
      name: comp.name,
      category: comp.category,
      popularityTier: comp.popularity.tier,
      avgProductRating: comp.popularity.avgRating,
      totalRatings: comp.popularity.totalRatings,
      catalogSize: prods.length,
      totalStockEstimated: totalInventory,
      topRatedProduct: topProd ? { name: topProd.name, rating: topProd.avgRating } : null
    };
  });

  res.json({
    success: true,
    accessGranted: true,
    reciprocityStatus: 'COMPLIANT',
    requestingCompany: {
      id: requestingCompany.id,
      name: requestingCompany.name,
      share_stats: requestingCompany.share_stats
    },
    marketOverview: {
      averageMarketRating: parseFloat(avgMarketRating),
      totalMarketReviews: totalMarketRatings,
      competitorsAnalyzed: competitors.length
    },
    competitors: industryAnalysis
  });
});

// ---------------- FEED ESTILO LINKEDIN
app.get('/api/posts', (req, res) => {
  res.json({ success: true, data: posts });
});

app.post('/api/posts', (req, res) => {
  const { authorUid, authorName, authorRole, authorCompanyId, authorAvatar, content, text, mediaUrl, tags } = req.body;
  const postText = content || text;

  if (!postText || !postText.trim()) {
    return res.status(400).json({ success: false, message: 'El contenido de la publicación no puede estar vacío.' });
  }

  const newPost = {
    id: `post_${Date.now()}`,
    authorUid: authorUid || 'anon',
    authorName: authorName || 'Usuario Bussearch',
    authorRole: authorRole || 'Usuario',
    authorIsCompany: Boolean(authorCompanyId),
    companyId: authorCompanyId || null,
    authorCompanyId: authorCompanyId || null,
    authorAvatar: authorAvatar || null,
    mediaUrl: mediaUrl || authorAvatar || null,
    text: postText.trim(),
    content: postText.trim(),
    tags: tags || ['#RedCorporativa'],
    likeCount: 0,
    likes: 0,
    commentCount: 0,
    commentsCount: 0,
    createdAt: new Date().toISOString()
  };

  posts.unshift(newPost);
  res.status(201).json({ success: true, data: newPost });
});

app.delete('/api/posts/:id', (req, res) => {
  posts = posts.filter(p => p.id !== req.params.id);
  res.json({ success: true, message: 'Publicación eliminada' });
});

app.post('/api/posts/:id/like', (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ success: false, message: 'Publicación no encontrada.' });
  post.likeCount = (post.likeCount || 0) + 1;
  post.likes = post.likeCount;
  res.json({ success: true, data: { likes: post.likeCount } });
});

// ---------------- ASISTENTE DE IA GEMINI
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userLocation, currentUser } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Mensaje requerido.' });

    const reply = await aiChatService.processMessage({
      message,
      userLocation: userLocation || { lat: 4.6560, lng: -74.0580 },
      currentUser: currentUser || { role: 'user', displayName: 'Invitado' }
    });

    res.json({ success: true, ...reply });
  } catch (error) {
    console.error('Error procesando mensaje en chat:', error);
    res.status(500).json({ success: false, reply: 'Ocurrió un error al procesar tu solicitud en el asistente.' });
  }
});

// ---------------- ALMACENAMIENTO MULTIMEDIA (Cero Buckets de Pago)
app.post('/api/upload', (req, res) => {
  try {
    const { fileName, fileBase64 } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ success: false, message: 'Se requiere el contenido del archivo en base64.' });
    }

    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const ext = path.extname(fileName || '') || '.jpg';
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadsDir, safeName);

    fs.writeFileSync(filePath, Buffer.from(cleanBase64, 'base64'));

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const publicUrl = `${protocol}://${host}/uploads/${safeName}`;

    res.json({
      success: true,
      url: publicUrl,
      fileName: safeName,
      message: 'Archivo guardado correctamente y visible para todos los usuarios que instalen el APK.'
    });
  } catch (err) {
    console.error('Error al guardar archivo en servidor:', err);
    res.status(500).json({ success: false, message: 'Error interno al procesar el archivo multimedia.' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Bussearch Hybrid Social Backend',
    database: db.provider,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Servidor Bussearch corriendo en puerto ${PORT}`);
  console.log(`🌐 Local:        http://localhost:${PORT}`);
  console.log(`📱 Red Wi-Fi:    http://192.168.101.34:${PORT}`);
  console.log(`📁 Subida Media: http://192.168.101.34:${PORT}/uploads`);
  console.log(`📍 Leaflet Map:  OpenStreetMap (100% libre sin tarjeta)`);
  console.log(`🛡️ Admin Email:  bussearchresponses@gmail.com`);
  console.log(`=======================================================`);
});
