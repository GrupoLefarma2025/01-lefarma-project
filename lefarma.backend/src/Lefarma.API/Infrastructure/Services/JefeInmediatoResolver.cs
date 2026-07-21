using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Services
{
    public class JefeInmediatoResolver : IJefeInmediatoResolver
    {
        private readonly AsistenciasDbContext _asistenciasContext;
        private readonly IEmpleadoRepository _empleadoRepository;

        public JefeInmediatoResolver(
            AsistenciasDbContext asistenciaContext,
            IEmpleadoRepository empleadoRepository)
        {
            _asistenciasContext = asistenciaContext;
            _empleadoRepository = empleadoRepository;
        }

        public async Task<int?> ResolverIdUsuarioJefeAsync(int idUsuarioCreador)
        {
            var nominaCreador = await _empleadoRepository.ResolverNominaPorUsuarioAsync(idUsuarioCreador);
            if (!nominaCreador.HasValue)
                return null;

            var nominaJefe = await _asistenciasContext.VwEmpleadosYJefes
                .Where(ej => ej.Nomina == nominaCreador.Value)
                .Select(ej => (long?)ej.NominaJefe)
                .FirstOrDefaultAsync();

            if (!nominaJefe.HasValue)
                return null;

            return await _empleadoRepository.ResolverIdUsuarioPorNominaAsync(nominaJefe.Value);
        }
    }
}
