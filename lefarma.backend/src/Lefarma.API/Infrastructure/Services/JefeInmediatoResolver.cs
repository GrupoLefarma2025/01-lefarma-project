using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Services
{
    public class JefeInmediatoResolver : IJefeInmediatoResolver
    {
        private readonly AsokamDbContext _asokamContext;
        private readonly AsistenciasDbContext _asistenciasContext;

        public JefeInmediatoResolver(
            AsokamDbContext asokamContext,
            AsistenciasDbContext asistenciaContext)
        {
            _asokamContext = asokamContext;
            _asistenciasContext = asistenciaContext;
        }

        public async Task<int?> ResolverIdUsuarioJefeAsync(int idUsuarioCreador)
        {
            // Obtener el correo del que crea
            var correoCreador = await _asokamContext.Usuarios
                .Where(u => u.IdUsuario == idUsuarioCreador)
                .Select(u => u.Correo)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(correoCreador))
                return null;

            // Obtener el número de nómina del creador desde Asistencias
            var nominaCreador = await _asistenciasContext.VwEmpleados
                .Where(e => e.Correo == correoCreador)
                .Select(e => (long?)e.Nomina)
                .FirstOrDefaultAsync();

            if (!nominaCreador.HasValue)
                return null;

            // Obtener la nomina del jefe inmediato en vwEmpleadosYJefes, la columna es Nominajefe
            var nominaJefe = await _asistenciasContext.VwEmpleadosYJefes
                .Where(ej => ej.Nomina == nominaCreador.Value)
                .Select(ej => (long?)ej.NominaJefe)
                .FirstOrDefaultAsync();

            if (!nominaJefe.HasValue)
                return null;

            // Con la nómina del jefe, buscamos su correo en VwEmpleados.
            var correoJefe = await _asistenciasContext.VwEmpleados
                .Where(e => e.Nomina == nominaJefe.Value)
                .Select(e => e.Correo)
                .FirstOrDefaultAsync();

            if (string.IsNullOrWhiteSpace(correoJefe))
                return null;

            // con el correo del jefe obtenemos su IdUsuario
            return await _asokamContext.Usuarios
                .Where(u => u.Correo == correoJefe)
                .Select(u => (int?)u.IdUsuario)
                .FirstOrDefaultAsync();
        }
    }
}
