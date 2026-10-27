/**
 * Middleware de Reciprocidad para Inteligencia de Competencia
 * 
 * REGLA DE NEGOCIO:
 * Una empresa 'A' puede consultar las estadísticas agregadas de su competencia
 * SI Y SOLO SI:
 * 1. Tiene activada la opción "Compartir mis estadísticas" (share_stats === true), O
 * 2. Ya ha publicado productos en su catálogo de stock (reciprocidad activa).
 */

function enforceReciprocityRule(getCompanyById, getCompanyProducts) {
  return async function(req, res, next) {
    try {
      const companyId = req.headers['x-company-id'] || req.query.companyId || (req.user && req.user.companyId);

      if (!companyId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED_COMPANY',
          message: 'Se requiere una sesión de Empresa válida para acceder a la inteligencia de mercado.'
        });
      }

      const company = await getCompanyById(companyId);

      if (!company) {
        return res.status(404).json({
          success: false,
          code: 'COMPANY_NOT_FOUND',
          message: 'La empresa solicitante no existe en el registro.'
        });
      }

      // VALIDACIÓN DE LA REGLA DE RECIPROCIDAD:
      // Si la empresa subió stock o tiene share_stats activo, se cumple la reciprocidad.
      const companyStock = typeof getCompanyProducts === 'function' ? getCompanyProducts(company.id) : [];
      const hasStock = Array.isArray(companyStock) && companyStock.length > 0;

      if (!company.share_stats && !hasStock) {
        return res.status(403).json({
          success: false,
          code: 'RECIPROCITY_VIOLATION',
          message: 'Acceso Bloqueado: Para consultar las métricas agregadas del mercado y de tus competidores, tu empresa debe publicar al menos un producto en su stock o activar "Compartir mis estadísticas".',
          details: {
            companyId: company.id,
            companyName: company.name,
            shareStatsEnabled: false,
            hasStock: false,
            actionRequired: 'Publica productos en tu stock o activa la opción "Compartir mis estadísticas" en tu panel para desbloquear este módulo.'
          }
        });
      }

      // Si tiene stock pero no tenía el flag encendido, encenderlo automáticamente
      company.share_stats = true;

      req.authenticatedCompany = company;
      next();
    } catch (error) {
      console.error('Error en middleware de reciprocidad:', error);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_SECURITY_ERROR',
        message: 'Error al evaluar las políticas de reciprocidad.'
      });
    }
  };
}

module.exports = { enforceReciprocityRule };
