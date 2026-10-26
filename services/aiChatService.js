/**
 * Servicio de Chatbot de IA Integrado con Perfiles, Stock y Coordenadas del Mapa
 * Soporta API de Gemini / Groq y motor conversacional determinista de respaldo
 */

class AIChatService {
  constructor({ companiesStore, productsStore, rateProductCallback }) {
    this.companiesStore = companiesStore;
    this.productsStore = productsStore;
    this.rateProductCallback = rateProductCallback;
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
    this.groqApiKey = process.env.GROQ_API_KEY || '';
  }

  /**
   * Fórmula del Semiverseno (Haversine) para cálculo de distancias sobre la Tierra en km.
   */
  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio medio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 10) / 10;
  }

  /**
   * Procesa un mensaje conversacional del usuario con contexto espacial y de rol.
   * 
   * @param {Object} params
   * @param {string} params.message Mensaje del usuario
   * @param {Object} params.userLocation { lat, lng } ubicación actual del usuario
   * @param {Object} params.currentUser Usuario en sesión (UID, rol, companyId)
   */
  async processMessage({ message, userLocation, currentUser }) {
    const text = message.trim();
    const lower = text.toLowerCase();

    // 1. INTENCIÓN: Calificar un producto o empresa mediante lenguaje natural
    // Ejemplos: "calificar Cafe Espresso de Cafe Gourmet con 5 estrellas: Excelente aroma"
    // "ponerle 5 estrellas a Teclado Mecánico"
    const ratingMatch = text.match(/(?:calificar|califica|darle|ponerle|puntuar)\s+(?:a\s+)?([^\d]+?)(?:\s+(?:de|en)\s+([^\d]+?))?\s+(?:con\s+)?([1-5])\s*(?:estrellas?|pts?|\*)\s*(?::|-|,)?\s*(.*)?/i);

    if (ratingMatch) {
      return this.handleConversationalRating({
        productQuery: ratingMatch[1]?.trim(),
        companyQuery: ratingMatch[2]?.trim(),
        stars: parseInt(ratingMatch[3], 10),
        comment: (ratingMatch[4] || 'Calificación realizada mediante el Asistente IA').trim(),
        currentUser
      });
    }

    // 2. INTENCIÓN: Resumen de rendimiento empresarial (Para administradores de empresas)
    // Ejemplos: "resumen de rendimiento", "como va mi negocio", "estadisticas de mi empresa", "rendimiento de TechSupply"
    if (lower.includes('resumen') || lower.includes('rendimiento') || lower.includes('métricas de mi empresa') || lower.includes('estadísticas de mi empresa')) {
      const targetCompanyId = currentUser?.companyId || this.findCompanyInText(lower);
      if (targetCompanyId) {
        return this.generateBusinessSummary(targetCompanyId);
      } else if (currentUser?.role !== 'company') {
        return {
          reply: 'ℹ️ No tienes una empresa vinculada a tu cuenta de usuario común. Si eres administrador de una empresa, selecciona el perfil corporativo o especifica el nombre de la empresa (Ejemplo: "Resumen de rendimiento de TechSupply Norte").',
          action: 'NONE'
        };
      }
    }

    // 3. INTENCIÓN: Búsqueda geoespacial de empresas y productos cercanos
    // Ejemplos: "empresas cerca", "que hay cerca", "cafeterias a menos de 5 km", "productos cercanos"
    if (lower.includes('cerca') || lower.includes('distancia') || lower.includes('alrededor') || lower.includes('proxim')) {
      const radiusMatch = lower.match(/(\d+)\s*(?:km|kilometros)/);
      const radiusKm = radiusMatch ? parseFloat(radiusMatch[1]) : 5.0;
      return this.findNearbyBusinesses({
        userLocation: userLocation || { lat: 4.6097, lng: -74.0817 }, // Bogotá default
        radiusKm,
        keyword: this.extractCategoryOrKeyword(lower)
      });
    }

    // 4. Procesamiento mediante LLM en la nube (Gemini Free Tier o Groq) si hay clave configurada
    if (this.geminiApiKey) {
      try {
        const aiResponse = await this.callGeminiAPI(text, userLocation, currentUser);
        if (aiResponse) return aiResponse;
      } catch (err) {
        console.warn('Fallo llamada a Gemini API, usando motor contextual:', err.message);
      }
    }

    // 5. Respuesta contextual por defecto con sugerencias inteligentes
    return this.generateDefaultContextualReply(text, userLocation);
  }

  /**
   * Ejecuta la calificación directa de un producto desde el chat
   */
  async handleConversationalRating({ productQuery, companyQuery, stars, comment, currentUser }) {
    if (!productQuery) {
      return {
        reply: '⚠️ No identifiqué el nombre del producto. Puedes escribir: "Calificar [Nombre del Producto] con 5 estrellas: Mi comentario".',
        action: 'NONE'
      };
    }

    // Buscar el producto en la base de datos
    let foundProduct = null;
    let foundCompany = null;

    const allCompanies = this.companiesStore();
    for (const company of allCompanies) {
      if (companyQuery && !company.name.toLowerCase().includes(companyQuery.toLowerCase())) {
        continue;
      }
      const products = this.productsStore(company.id) || [];
      const prod = products.find(p => p.name.toLowerCase().includes(productQuery.toLowerCase()));
      if (prod) {
        foundProduct = prod;
        foundCompany = company;
        break;
      }
    }

    if (!foundProduct || !foundCompany) {
      return {
        reply: `🔍 No encontré un producto que coincida con "${productQuery}"${companyQuery ? ` en ${companyQuery}` : ''}. Verifica el nombre en el catálogo o en el mapa interactivo.`,
        action: 'NONE'
      };
    }

    // Ejecutar el registro de la calificación
    const updatedStats = await this.rateProductCallback({
      companyId: foundCompany.id,
      productId: foundProduct.id,
      stars,
      comment,
      authorName: currentUser?.displayName || 'Usuario Común'
    });

    return {
      reply: `⭐ **¡Calificación registrada con éxito!**\n\n- **Producto:** ${foundProduct.name}\n- **Empresa:** ${foundCompany.name}\n- **Puntaje otorgado:** ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} (${stars}/5)\n- **Comentario:** "${comment}"\n- **Nuevo promedio del producto:** ${updatedStats.productAvgRating}★ (${updatedStats.productRatingCount} votos)\n- **Impacto en el mapa:** El marcador de **${foundCompany.name}** ahora tiene un radio adaptativo de **${updatedStats.newMarkerRadius}px** por el algoritmo de popularidad basado en calificaciones de catálogo.`,
      action: 'PRODUCT_RATED',
      data: {
        companyId: foundCompany.id,
        productId: foundProduct.id,
        newAvgRating: updatedStats.productAvgRating,
        markerRadius: updatedStats.newMarkerRadius
      }
    };
  }

  /**
   * Genera el resumen ejecutivo para una empresa
   */
  generateBusinessSummary(companyId) {
    const companies = this.companiesStore();
    const company = companies.find(c => c.id === companyId);
    if (!company) {
      return { reply: '❌ No se encontró la empresa solicitada.', action: 'NONE' };
    }

    const products = this.productsStore(company.id) || [];
    const totalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
    const lowStock = products.filter(p => (p.stock || 0) <= 5);
    const ratedProducts = products.filter(p => (p.ratingCount || 0) > 0);

    const totalVotes = ratedProducts.reduce((acc, p) => acc + p.ratingCount, 0);
    const weightedSum = ratedProducts.reduce((acc, p) => acc + (p.avgRating * p.ratingCount), 0);
    const avgRating = totalVotes > 0 ? (weightedSum / totalVotes).toFixed(1) : '0.0';

    const bestProduct = [...ratedProducts].sort((a, b) => b.avgRating - a.avgRating)[0];

    return {
      reply: `📊 **Resumen Ejecutivo de Rendimiento: ${company.name}**\n\n` +
        `• **Calificación General del Catálogo:** ${avgRating} / 5.0 ⭐ (${totalVotes} reseñas en total)\n` +
        `• **Nivel de Popularidad en el Mapa:** Tier **${company.popularity?.tier || 'ESTÁNDAR'}** (Radio de marcador: ${company.popularity?.markerRadius || 24}px)\n` +
        `• **Estado del Inventario:** ${products.length} productos registrados, ${totalStock} unidades en stock total.\n` +
        (lowStock.length > 0
          ? `⚠️ **Alerta de Stock Crítico:** ${lowStock.map(p => `"${p.name}" (${p.stock} unid)`).join(', ')}\n`
          : `✅ **Stock Saludable:** Ningún producto con nivel crítico.\n`) +
        (bestProduct
          ? `🏆 **Producto Estrella:** "${bestProduct.name}" con ${bestProduct.avgRating}★ (${bestProduct.ratingCount} votos)\n`
          : `ℹ️ **Sin productos evaluados aún.**\n`) +
        `• **Reciprocidad de Datos:** ${company.share_stats ? '🟢 Activada (Acceso total a inteligencia de competencia)' : '🔴 Desactivada (Acceso a competencia bloqueado)'}`,
      action: 'BUSINESS_SUMMARY',
      data: { companyId, avgRating, totalStock, lowStockCount: lowStock.length }
    };
  }

  /**
   * Búsqueda geoespacial por coordenadas
   */
  findNearbyBusinesses({ userLocation, radiusKm, keyword }) {
    const companies = this.companiesStore();
    const results = [];

    for (const company of companies) {
      if (!company.lat || !company.lng) continue;
      const distance = this.calculateDistanceKm(userLocation.lat, userLocation.lng, company.lat, company.lng);

      if (distance <= radiusKm) {
        const products = this.productsStore(company.id) || [];
        // Filtro por keyword si aplica
        if (keyword) {
          const matchCompany = company.name.toLowerCase().includes(keyword) || (company.category || '').toLowerCase().includes(keyword);
          const matchProduct = products.some(p => p.name.toLowerCase().includes(keyword));
          if (!matchCompany && !matchProduct) continue;
        }

        results.push({
          company,
          distance,
          productsCount: products.length,
          topProducts: products.slice(0, 3)
        });
      }
    }

    results.sort((a, b) => a.distance - b.distance);

    if (results.length === 0) {
      return {
        reply: `📍 No encontré empresas a menos de **${radiusKm} km** de tu posición actual (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})${keyword ? ` con el filtro "${keyword}"` : ''}.\n\nIntenta ampliar el radio de búsqueda diciendo: *"Buscar a 15 km"* o explora el mapa interactivo directamente.`,
        action: 'NONE'
      };
    }

    let reply = `📍 **Empresas encontradas a menos de ${radiusKm} km de ti:**\n\n`;
    results.forEach(({ company, distance, topProducts }, idx) => {
      reply += `**${idx + 1}. ${company.name}** (${distance} km)\n`;
      reply += `   • Categoría: *${company.category || 'General'}*\n`;
      reply += `   • Popularidad: ${company.popularity?.avgRating || 0}★ (Marcador: ${company.popularity?.tier || 'Estándar'})\n`;
      if (topProducts.length > 0) {
        reply += `   • Productos destacados: ${topProducts.map(p => `${p.name} [${p.stock} disp.] (${p.avgRating}★)`).join(', ')}\n`;
      }
      reply += `\n`;
    });

    reply += `💡 *Puedes pedirme que califique cualquiera de estos productos diciendo: "Calificar [Nombre] con 5 estrellas".*`;

    return {
      reply,
      action: 'NEARBY_FOUND',
      data: { count: results.length, companies: results.map(r => ({ id: r.company.id, name: r.company.name, distance: r.distance })) }
    };
  }

  findCompanyInText(text) {
    const companies = this.companiesStore();
    for (const c of companies) {
      if (text.includes(c.name.toLowerCase())) return c.id;
    }
    return null;
  }

  extractCategoryOrKeyword(text) {
    const cleanText = text.replace(/[¿?¡!.,;:()]/g, '').toLowerCase();
    const ignore = [
      'empresas', 'lugares', 'cerca', 'distancia', 'kilometros', 'km',
      'que', 'hay', 'donde', 'comprar', 'menos', 'radio', 'alrededor',
      'para', 'como', 'todo', 'todos', 'todas', 'por', 'favor', 'buen', 'buena'
    ];
    const words = cleanText.split(/\s+/).filter(w => w.length > 3 && !ignore.includes(w));
    return words[0] || '';
  }

  /**
   * Llamada a Gemini 1.5 Flash / 2.0 Flash
   */
  async callGeminiAPI(userPrompt, userLocation, currentUser) {
    const companies = this.companiesStore();
    const systemPrompt = `Eres el asistente inteligente de Bussearch, una red social corporativa con mapa geoespacial y stock en tiempo real.
Ubicación actual del usuario: latitud ${userLocation?.lat || 4.6097}, longitud ${userLocation?.lng || -74.0817}.
Empresas registradas en el sistema: ${JSON.stringify(companies.map(c => ({ id: c.id, name: c.name, category: c.category, lat: c.lat, lng: c.lng, avgRating: c.popularity?.avgRating })))}
Usuario en sesión: ${currentUser?.displayName || 'Usuario Común'} (Rol: ${currentUser?.role || 'user'}).
Responde de forma concisa, profesional y útil en español con formato Markdown.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nPetición del usuario: ${userPrompt}` }] }
        ]
      })
    });

    if (!res.ok) throw new Error(`Gemini status ${res.status}`);
    const data = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) {
      return { reply: replyText, action: 'GEMINI_RESPONSE' };
    }
    return null;
  }

  generateDefaultContextualReply(text) {
    return {
      reply: `👋 ¡Hola! Soy tu **Asistente de IA de Bussearch**. Estoy conectado a los perfiles de empresas, catálogo de stock y coordenadas geoespaciales.\n\n` +
        `Puedes interactuar conmigo usando comandos como:\n` +
        `1. 📍 **Búsqueda cercana:** *"¿Qué cafeterías o ferreterías hay a menos de 5 km?"*\n` +
        `2. ⭐ **Calificación conversacional:** *"Calificar Café Espresso de Café Gourmet con 5 estrellas: Excelente sabor"*\n` +
        `3. 📊 **Resumen ejecutivo:** *"Dame el resumen de rendimiento de mi empresa"*\n` +
        `4. 🗺️ **Explorar el mapa:** Haz clic sobre los marcadores para ver cómo su tamaño crece proporcionalmente con la calidad de sus productos.`,
      action: 'HELP'
    };
  }
}

module.exports = { AIChatService };
