/**
 * Servicio del Algoritmo de Popularidad Geoespacial
 * 
 * REGLA ESTRICTA DE NEGOCIO:
 * El tamaño, jerarquía y visibilidad del marcador de la empresa en el mapa
 * NO depende de los seguidores o likes, sino ESTRICTAMENTE del PROMEDIO
 * DE CALIFICACIONES de sus productos individuales en catálogo.
 */

class PopularityService {
  /**
   * Calcula el puntaje de popularidad y atributos visuales para una empresa
   * a partir de su catálogo de productos calificados.
   * 
   * @param {Array} products Lista de productos de la empresa con { id, name, avgRating, ratingCount }
   * @returns {Object} { avgRating, totalRatings, ratedProductsCount, markerRadius, tier, color, zIndex }
   */
  static calculateCompanyPopularity(products = []) {
    if (!products || products.length === 0) {
      return {
        avgRating: 0,
        totalRatings: 0,
        ratedProductsCount: 0,
        markerRadius: 22, // Tamaño base mínimo
        tier: 'UNRATED',
        tierLabel: 'Sin calificaciones aún',
        color: '#64748b', // Slate gris neutro
        badge: '🆕',
        zIndex: 100
      };
    }

    const ratedProducts = products.filter(p => (p.ratingCount || 0) > 0 && (p.avgRating || 0) > 0);

    if (ratedProducts.length === 0) {
      return {
        avgRating: 0,
        totalRatings: 0,
        ratedProductsCount: 0,
        markerRadius: 22,
        tier: 'NEW',
        tierLabel: 'Catálogo sin reseñas',
        color: '#64748b',
        badge: '📦',
        zIndex: 100
      };
    }

    // 1. Cálculo del Promedio Ponderado de Calificaciones de Productos
    // Fórmula: Suma(avgRating_i * ratingCount_i) / Suma(ratingCount_i)
    const totalReviewCount = ratedProducts.reduce((acc, p) => acc + (p.ratingCount || 0), 0);
    const weightedSum = ratedProducts.reduce((acc, p) => acc + (p.avgRating * p.ratingCount), 0);

    // Promedio ponderado estricto de productos
    const rawAverage = totalReviewCount > 0 ? weightedSum / totalReviewCount : 0;
    const finalRating = Math.round(rawAverage * 10) / 10; // 1 decimal (ej: 4.8)

    // 2. Función de escalado de marcador para Leaflet.js
    // Rango de radio: Mínimo 24px (calificación 1.0) -> Máximo 50px (calificación 5.0)
    // Fórmula lineal adaptativa: R = 20 + (Rating * 6)
    let markerRadius = Math.round(20 + (finalRating * 6));
    if (markerRadius < 24) markerRadius = 24;
    if (markerRadius > 50) markerRadius = 50;

    // 3. Segmentación por Tier de Excelencia
    let tier = 'BRONZE';
    let tierLabel = 'Estándar';
    let color = '#d97706'; // Ámbar/Bronce
    let badge = '⭐';
    let zIndex = 200;

    if (finalRating >= 4.6) {
      tier = 'PLATINUM';
      tierLabel = 'Calidad Suprema (Top Productos)';
      color = '#7c3aed'; // Violeta brillante / Corona
      badge = '👑';
      zIndex = 500;
    } else if (finalRating >= 4.0) {
      tier = 'GOLD';
      tierLabel = 'Alta Calidad de Catálogo';
      color = '#2563eb'; // Azul LinkedIn Premium
      badge = '💎';
      zIndex = 400;
    } else if (finalRating >= 3.0) {
      tier = 'SILVER';
      tierLabel = 'Calidad Buena';
      color = '#059669'; // Esmeralda
      badge = '✨';
      zIndex = 300;
    }

    return {
      avgRating: finalRating,
      totalRatings: totalReviewCount,
      ratedProductsCount: ratedProducts.length,
      markerRadius,
      tier,
      tierLabel,
      color,
      badge,
      zIndex
    };
  }

  /**
   * Procesa una lista de empresas y les inyecta su métrica de popularidad
   */
  static enrichCompaniesWithPopularity(companies = [], getProductsForCompany) {
    return companies.map(company => {
      const products = getProductsForCompany(company.id) || [];
      const popularity = this.calculateCompanyPopularity(products);
      return {
        ...company,
        popularity,
        productsCount: products.length
      };
    });
  }
}

module.exports = { PopularityService };
