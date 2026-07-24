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

        public async Task<IReadOnlyDictionary<int, int>> ResolverIdsJefePorUsuariosAsync(
            IEnumerable<int> idsUsuariosCreador,
            CancellationToken cancellationToken = default)
        {
            var creadorList = idsUsuariosCreador.Distinct().ToList();
            if (creadorList.Count == 0)
                return new Dictionary<int, int>();

            var nominaPorCreador = await _empleadoRepository.ResolverNominasPorUsuariosAsync(creadorList, cancellationToken);
            if (nominaPorCreador.Count == 0)
                return new Dictionary<int, int>();

            var nominas = nominaPorCreador.Values.Distinct().ToList();

            var jefes = await _asistenciasContext.VwEmpleadosYJefes
                .AsNoTracking()
                .Where(ej => ej.Nomina.HasValue && nominas.Contains(ej.Nomina.Value) && ej.NominaJefe.HasValue)
                .Select(ej => new { ej.Nomina, ej.NominaJefe })
                .ToListAsync(cancellationToken);

            var nominaJefePorNomina = jefes
                .GroupBy(ej => ej.Nomina!.Value)
                .ToDictionary(g => g.Key, g => g.First().NominaJefe!.Value);

            if (nominaJefePorNomina.Count == 0)
                return new Dictionary<int, int>();

            var idUsuarioPorNominaJefe = await _empleadoRepository.ResolverIdsUsuarioPorNominasAsync(
                nominaJefePorNomina.Values.Distinct().ToList(),
                cancellationToken);

            var resultado = new Dictionary<int, int>();
            foreach (var creador in nominaPorCreador)
            {
                if (nominaJefePorNomina.TryGetValue(creador.Value, out var nominaJefe)
                    && idUsuarioPorNominaJefe.TryGetValue(nominaJefe, out var idJefe))
                {
                    resultado[creador.Key] = idJefe;
                }
            }

            return resultado;
        }
    }
}
