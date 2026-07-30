using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Domain.ValueObjects.Config;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Services
{
    public class JefeInmediatoResolver : IJefeInmediatoResolver
    {
        private const int MaxNivel = 5; // hoy la vista tiene 5 niveles; cambiar aquí si crece

        private readonly AsistenciasDbContext _asistenciasContext;
        private readonly ApplicationDbContext _context;
        private readonly IEmpleadoRepository _empleadoRepository;

        public JefeInmediatoResolver(
            AsistenciasDbContext asistenciaContext,
            ApplicationDbContext context,
            IEmpleadoRepository empleadoRepository)
        {
            _asistenciasContext = asistenciaContext;
            _context = context;
            _empleadoRepository = empleadoRepository;
        }

        public Task<int?> ResolverIdUsuarioJefeAsync(int idUsuarioCreador, CancellationToken ct = default)
            => ResolverIdUsuarioJefePorNivelAsync(idUsuarioCreador, 1, ct);

        public async Task<int?> ResolverIdUsuarioJefePorNivelAsync(
            int idUsuarioCreador, int nivel, CancellationToken ct = default)
        {
            var nominaJefe = await ResolverNominaJefeAsync(idUsuarioCreador, nivel, ct);
            if (!nominaJefe.HasValue)
                return null;

            return await _empleadoRepository.ResolverIdUsuarioPorNominaAsync(nominaJefe.Value, ct);
        }

        public async Task<bool> AplicaNivelJefeAsync(
            int idUsuarioCreador, int nivel, CancellationToken ct = default)
        {
            var config = await _context.EmpleadoJefesConfig
                .AsNoTracking()
                .Where(c => c.IdUsuario == idUsuarioCreador && c.Activo)
                .Select(c => new { c.Nivel, c.Aplica })
                .ToListAsync(ct);

            if (config.Count == 0)
                return nivel == 1; // default legacy

            return config.FirstOrDefault(c => c.Nivel == nivel)?.Aplica ?? false;
        }

        public async Task<JefeEfectivoResult> ResolverJefeEfectivoAsync(
            int idWorkflow, int idUsuarioCreador, int nivel, CancellationToken ct = default)
        {
            if (nivel < 1 || nivel > MaxNivel)
                return new(null, MotivoOmisionJefe.CadenaRota);

            // 1. Check del empleado
            if (!await AplicaNivelJefeAsync(idUsuarioCreador, nivel, ct))
                return new(null, MotivoOmisionJefe.ConfigNoAplica);

            // 2. Cadena (columna aplanada de la vista)
            var nominaJefe = await ResolverNominaJefeAsync(idUsuarioCreador, nivel, ct);
            if (!nominaJefe.HasValue)
                return new(null, MotivoOmisionJefe.CadenaRota);

            // 3. Usuario en el sistema
            var idUsuarioJefe = await _empleadoRepository.ResolverIdUsuarioPorNominaAsync(nominaJefe.Value, ct);
            if (!idUsuarioJefe.HasValue)
                return new(null, MotivoOmisionJefe.SinUsuario);

            // 4. Exclusión por workflow (por usuario, no por nómina)
            var excluido = await _context.WorkflowJefesExcluidos
                .AsNoTracking()
                .AnyAsync(x => x.IdWorkflow == idWorkflow && x.Activo && x.IdUsuarioJefe == idUsuarioJefe.Value, ct);
            if (excluido)
                return new(null, MotivoOmisionJefe.Excluido);

            return new(idUsuarioJefe, null);
        }

        /// <summary>Lee la nómina del jefe del nivel N desde la columna aplanada de la vista.</summary>
        private async Task<long?> ResolverNominaJefeAsync(
            int idUsuarioCreador, int nivel, CancellationToken ct)
        {
            var nominaCreador = await _empleadoRepository.ResolverNominaPorUsuarioAsync(idUsuarioCreador, ct);
            if (!nominaCreador.HasValue)
                return null;

            var fila = await _asistenciasContext.VwEmpleadosYJefes
                .AsNoTracking()
                .Where(ej => ej.Nomina == nominaCreador.Value)
                .Select(ej => new { ej.NominaJefe, ej.NominaJefe2, ej.NominaJefe3, ej.NominaJefe4, ej.NominaJefe5 })
                .FirstOrDefaultAsync(ct);

            return nivel switch
            {
                1 => fila?.NominaJefe,
                2 => fila?.NominaJefe2,
                3 => fila?.NominaJefe3,
                4 => fila?.NominaJefe4,
                5 => fila?.NominaJefe5,
                _ => null
            };
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
