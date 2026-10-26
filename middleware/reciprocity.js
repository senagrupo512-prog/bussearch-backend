/**
 * Middleware de Reciprocidad para Inteligencia de Competencia
 * 
 * REGLA ESTRICTA DE NEGOCIO:
 * Una empresa 'A' SOLO puede consultar las estadísticas agregadas de su competencia
 * SI Y SOLO SI tiene activada la opción de "Compartir mis estadísticas" (share_stats === true).
 * Si está desactivada o si el usuario no es una empresa, el sistema bloquea el acceso.
 */

function enforceReciprocityRule(getCompanyById) {
  return async function(req, res, next) {
    try {
      // 1. Obtener la identificación de la empresa que hace la solicitud
      // En un entorno de producción, esto proviene del token de Firebase Auth verificado (req.user.companyId)
      const companyId = req.headers['x-company-id'] || req.query.companyId || (req.user && req.user.companyId);

      if (!companyId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED_COMPANY',
          message: 'Se requiere una sesión de Empresa válida para acceder a la inteligencia de mercado.'
        });
      }

      // 2. Obtener el perfil y configuración de privacidad de la empresa
      const company = await getCompanyById(companyId);

      if (!company) {
        return res.status(404).json({
          success: false,
          code: 'COMPANY_NOT_FOUND',
          message: 'La empresa solicitante no existe en el registro.'
        });
      }

      // 3. VALIDACIÓN DE LA REGLA DE RECIPROCIDAD
      // Si la empresa NO comparte sus estadísticas, queda expresamente BLOQUEADA
      if (!company.share_stats) {
        return res.status(403).json({
          success: false,
          code: 'RECIPROCITY_VIOLATION',
          message: 'Acceso Bloqueado: Para consultar las métricas agregadas del mercado y de tus competidores, tu empresa debe tener activada la opción "Compartir mis estadísticas".',
          details: {
            companyId: company.id,
            companyName: company.name,
            shareStatsEnabled: false,
            actionRequired: 'Activa la casilla "Compartir mis estadísticas" en tu panel de configuración para desbloquear este módulo.'
          }
        });
      }

      // 4. Inyectar la empresa autorizada en la solicitud y continuar
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
