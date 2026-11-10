using ErrorOr;
using HandlebarsDotNet;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Config.EmpleadoJefes.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Config.EmpleadoJefes
{
    public class EmpleadoJefesConfigService : IEmpleadoJefesConfigService
    {
        private const int MaxNivel = 5; // hoy la vista tiene 5 niveles; cambiar aquí si crece
        private readonly ApplicationDbContext _context;
        private readonly AsokamDbContext _asokamContext;
        private readonly AsistenciasDbContext _asistenciasContext;
        private readonly IEmpleadoRepository _empleadoRepository;

        public EmpleadoJefesConfigService(
            ApplicationDbContext context,
            AsokamDbContext asokamContext,
            AsistenciasDbContext asistenciasContext,
            IEmpleadoRepository empleadoRepository)
        {
            _context = context;
            _asokamContext = asokamContext;
            _asistenciasContext = asistenciasContext;
            _empleadoRepository = empleadoRepository;
        }

        public async Task<ErrorOr<List<EmpleadoJefesConfigListItem>>> GetListAsync()
        {
            var idsConfigurados = await _context.EmpleadoJefesConfig
                .Where(c => c.Activo)
                .Select(c => c.IdUsuario)
                .Distinct()
                .ToListAsync();

            if (idsConfigurados.Count == 0)
                return new List<EmpleadoJefesConfigListItem>();

            var detalles = await _context.UsuariosDetalle
                .AsNoTracking()
                .Where(d => idsConfigurados.Contains(d.IdUsuario))
                .Select(d => new { d.IdUsuario, d.NumeroEmpleado, d.Puesto })
                .ToListAsync();

            var nombres = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => idsConfigurados.Contains(u.IdUsuario))
                .Select(u => new { u.IdUsuario, u.NombreCompleto })
                .ToListAsync();

            var configs = await _context.EmpleadoJefesConfig
                .AsNoTracking()
                .Where(c => c.Activo && idsConfigurados.Contains(c.IdUsuario))
                .OrderBy(c => c.IdUsuario).ThenBy(c => c.Nivel)
                .Select(c => new { c.IdUsuario, c.Nivel, c.Aplica })
                .ToListAsync();

            var overrides = await _context.EmpleadoJefesOverride
                .AsNoTracking()
                .Where(o => o.Activo && idsConfigurados.Contains(o.IdUsuario))
                .OrderBy(o => o.IdUsuario).ThenBy(o => o.Nivel)
                .Select(o => new { o.IdUsuario, o.Nivel, o.IdUsuarioJefe })
                .ToListAsync();

            var nominaPorUsuario = detalles
                .Select(d => (d.IdUsuario, Nomina: ParseNomina(d.NumeroEmpleado)))
                .Where(x => x.Nomina.HasValue)
                .GroupBy(x => x.IdUsuario)
                .ToDictionary(g => g.Key, g => g.First().Nomina!.Value);

            var cadenas = await ResolverCadenasAsync(nominaPorUsuario);
            var nombresJefes = await ResolverNombresJefesAsync(cadenas);
            var nombresOverride = await ResolverNombresOverrideAsync(overrides);

            var resultado = idsConfigurados
                .Select(id =>
                {
                    var cadena = cadenas.TryGetValue(id, out var c) ? c : CadenaVacia();
                    var niveles = Enumerable.Range(1, MaxNivel)
                        .Select(nivel =>
                        {
                            var cfg = configs.FirstOrDefault(c => c.IdUsuario == id && c.Nivel == nivel);
                            var over = overrides.FirstOrDefault(o => o.IdUsuario == id && o.Nivel == nivel);
                            var cadenaNivel = cadena.FirstOrDefault(c => c.Nivel == nivel);
                            return new EmpleadoJefeNivelCompletoDto
                            {
                                Nivel = nivel,
                                Aplica = cfg?.Aplica ?? false,
                                IdUsuarioJefeOverride = over?.IdUsuarioJefe,
                                NombreJefeOverride = over?.IdUsuarioJefe is null
                                    ? null
                                    : nombresOverride.GetValueOrDefault(over.IdUsuarioJefe),
                                NominaJefeVista = cadenaNivel?.NominaJefe,
                                IdUsuarioJefeVista = cadenaNivel?.IdUsuarioJefe,
                                NombreJefeVista = cadenaNivel?.NombreJefe,
                            };
                        })
                        .ToList();

                    return new EmpleadoJefesConfigListItem
                    {
                        IdUsuario = id,
                        NumeroEmpleado = detalles.FirstOrDefault(d => d.IdUsuario == id)?.NumeroEmpleado,
                        Puesto = detalles.FirstOrDefault(d => d.IdUsuario == id)?.Puesto,
                        NombreCompleto = nombres.FirstOrDefault(n => n.IdUsuario == id)?.NombreCompleto,
                        Niveles = niveles,
                        Cadena = cadena
                    };
                })
                .OrderBy(x => x.NumeroEmpleado)
                .ThenBy(x => x.NombreCompleto)
                .ToList();

            return resultado;
        }

        public async Task<ErrorOr<EmpleadoJefesCadenaResponse>> GetCadenaAsync(int idUsuario)
        {
            var nomina = await _empleadoRepository.ResolverNominaPorUsuarioAsync(idUsuario);
            if (!nomina.HasValue)
            {
                return new EmpleadoJefesCadenaResponse { IdUsuario = idUsuario, Cadena = CadenaVacia() };
            }

            var cadenas = await ResolverCadenasAsync(new Dictionary<int, long> { [idUsuario] = nomina.Value });
            return new EmpleadoJefesCadenaResponse
            {
                IdUsuario = idUsuario,
                Cadena = cadenas.TryGetValue(idUsuario, out var cadena) ? cadena : CadenaVacia()
            };
        }

        /// <summary>
        /// Resuelve la cadena de jefes (vista aplanada) en batch para un conjunto de usuarios.
        /// La cadena es cruda: no aplica checks ni exclusiones (son por workflow).
        /// </summary>
        private async Task<Dictionary<int, List<JefeCadenaNivelDto>>> ResolverCadenasAsync(
            Dictionary<int, long> nominaPorUsuario)
        {
            var resultado = new Dictionary<int, List<JefeCadenaNivelDto>>();
            if (nominaPorUsuario.Count == 0) return resultado;

            var nominas = nominaPorUsuario.Values.Distinct().ToList();
            var filas = await _asistenciasContext.VwEmpleadosYJefes
                .AsNoTracking()
                .Where(ej => ej.Nomina.HasValue && nominas.Contains(ej.Nomina.Value))
                .Select(ej => new { ej.Nomina, ej.NominaJefe, ej.NominaJefe2, ej.NominaJefe3, ej.NominaJefe4, ej.NominaJefe5 })
                .ToListAsync();

            var filaPorNomina = filas
                .Where(f => f.Nomina.HasValue)
                .GroupBy(f => f.Nomina!.Value)
                .ToDictionary(g => g.Key, g => g.First());

            var nominasJefes = filas
                .SelectMany(f => new[] { f.NominaJefe, f.NominaJefe2, f.NominaJefe3, f.NominaJefe4, f.NominaJefe5 })
                .Where(n => n.HasValue)
                .Select(n => n!.Value)
                .Distinct()
                .ToList();

            var idUsuarioPorNomina = await _empleadoRepository.ResolverIdsUsuarioPorNominasAsync(nominasJefes);

            var idsJefes = idUsuarioPorNomina.Values.Distinct().ToList();
            var nombresJefes = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => idsJefes.Contains(u.IdUsuario))
                .Select(u => new { u.IdUsuario, u.NombreCompleto })
                .ToListAsync();
            var nombrePorId = nombresJefes.ToDictionary(x => x.IdUsuario, x => x.NombreCompleto);

            foreach (var (idUsuario, nomina) in nominaPorUsuario)
            {
                filaPorNomina.TryGetValue(nomina, out var fila);
                var cadena = new List<JefeCadenaNivelDto>(MaxNivel);

                for (var nivel = 1; nivel <= MaxNivel; nivel++)
                {
                    var nominaJefe = nivel switch
                    {
                        1 => fila?.NominaJefe,
                        2 => fila?.NominaJefe2,
                        3 => fila?.NominaJefe3,
                        4 => fila?.NominaJefe4,
                        5 => fila?.NominaJefe5,
                        _ => null
                    };

                    int? idJefe = null;
                    string? nombreJefe = null;
                    if (nominaJefe.HasValue && idUsuarioPorNomina.TryGetValue(nominaJefe.Value, out var idResuelto))
                    {
                        idJefe = idResuelto;
                        nombrePorId.TryGetValue(idResuelto, out nombreJefe);
                    }

                    cadena.Add(new JefeCadenaNivelDto
                    {
                        Nivel = nivel,
                        NominaJefe = nominaJefe,
                        IdUsuarioJefe = idJefe,
                        NombreJefe = nombreJefe
                    });
                }

                resultado[idUsuario] = cadena;
            }

            return resultado;
        }

        private static List<JefeCadenaNivelDto> CadenaVacia() =>
            Enumerable.Range(1, MaxNivel)
                .Select(n => new JefeCadenaNivelDto { Nivel = n })
                .ToList();

        private static long? ParseNomina(string? numeroEmpleado) =>
            long.TryParse(numeroEmpleado?.Trim(), out var nomina) ? nomina : null;

        public async Task<ErrorOr<EmpleadoJefesConfigResponse>> GetByUsuarioAsync(int idUsuario)
        {
            var filas = await _context.EmpleadoJefesConfig
                .AsNoTracking()
                .Where(c => c.IdUsuario == idUsuario && c.Activo)
                .OrderBy(c => c.Nivel)
                .ToListAsync();

            var overrides = await _context.EmpleadoJefesOverride
                .AsNoTracking()
                .Where(o => o.IdUsuario == idUsuario && o.Activo)
                .OrderBy(o => o.Nivel)
                .ToListAsync();

            var nomina = await _empleadoRepository.ResolverNominaPorUsuarioAsync(idUsuario);
            var cadena = nomina.HasValue
                ? (await ResolverCadenasAsync(new Dictionary<int, long> { [idUsuario] = nomina.Value }))
                    .TryGetValue(idUsuario, out var c) ? c : CadenaVacia()
                : CadenaVacia();

            var nombresOverride = await ResolverNombresOverrideAsync(
                overrides.Select(o => new { o.IdUsuario, o.Nivel, o.IdUsuarioJefe }).ToList());

            var esConfigPorDefecto = filas.Count == 0;

            var niveles = Enumerable.Range(1, MaxNivel)
                .Select(nivel =>
                {
                    var cfg = filas.FirstOrDefault(f => f.Nivel == nivel);
                    var over = overrides.FirstOrDefault(o => o.Nivel == nivel);
                    var cadenaNivel = cadena.FirstOrDefault(c => c.Nivel == nivel);
                    return new EmpleadoJefeNivelCompletoDto
                    {
                        Nivel = nivel,
                        Aplica = cfg?.Aplica ?? esConfigPorDefecto,
                        IdUsuarioJefeOverride = over?.IdUsuarioJefe,
                        NombreJefeOverride = over?.IdUsuarioJefe is null
                            ? null
                            : nombresOverride.GetValueOrDefault(over.IdUsuarioJefe),
                        NominaJefeVista = cadenaNivel?.NominaJefe,
                        IdUsuarioJefeVista = cadenaNivel?.IdUsuarioJefe,
                        NombreJefeVista = cadenaNivel?.NombreJefe,
                    };
                })
                .ToList();

            return new EmpleadoJefesConfigResponse
            {
                IdUsuario = idUsuario,
                EsConfigPorDefecto = esConfigPorDefecto,
                Niveles = niveles
            };
        }

        public async Task<ErrorOr<EmpleadoJefesConfigResponse>> UpdateAsync(int idUsuario, UpdateEmpleadoJefesConfigRequest request)
        {
            if (request.Niveles.Any(n => n.Nivel < 1 || n.Nivel > MaxNivel))
                return CommonErrors.Validation("Nivel", $"Los niveles deben estar entre 1 y {MaxNivel}.");

            if (request.Niveles.Select(n => n.Nivel).Distinct().Count() != request.Niveles.Count)
                return CommonErrors.Validation("Nivel", "Hay niveles duplicados en la solicitud.");

            var nivelesAplicables = request.Niveles.Count == 0
                ? Enumerable.Range(1, MaxNivel).ToHashSet()
                : request.Niveles.Where(n => n.Aplica).Select(n => n.Nivel).ToHashSet();

            await using var transaction = await _context.Database.BeginTransactionAsync();

            var bloqueadas = await ObtenerSolicitudesSinNivelAsync(idUsuario, nivelesAplicables);
            if (bloqueadas.Count > 0)
            {
                await transaction.RollbackAsync();
                return CrearErrorSolicitudesSinNivel(bloqueadas);
            }

            // Configuración de aplica
            var existentes = await _context.EmpleadoJefesConfig
                .Where(c => c.IdUsuario == idUsuario)
                .ToListAsync();

            var nivelesPayload = request.Niveles.Select(n => n.Nivel).ToHashSet();

            foreach (var item in request.Niveles)
            {
                var existente = existentes.FirstOrDefault(e => e.Nivel == item.Nivel);
                if (existente is null)
                {
                    _context.EmpleadoJefesConfig.Add(new EmpleadoJefeConfig
                    {
                        IdUsuario = idUsuario,
                        Nivel = item.Nivel,
                        Aplica = item.Aplica,
                        Activo = true,
                        FechaCreacion = DateTime.Now
                    });
                }
                else
                {
                    existente.Aplica = item.Aplica;
                    existente.Activo = true;
                    existente.FechaModificacion = DateTime.Now;
                }
            }

            foreach (var e in existentes.Where(e => !nivelesPayload.Contains(e.Nivel) && e.Activo))
            {
                e.Activo = false;
                e.Aplica = false;
                e.FechaModificacion = DateTime.Now;
            }

            // Overrides
            var overridesExistentes = await _context.EmpleadoJefesOverride
                .Where(o => o.IdUsuario == idUsuario)
                .ToListAsync();

            var overridesPayload = request.Niveles
                .Where(n => n.IdUsuarioJefeOverride.HasValue)
                .ToDictionary(n => n.Nivel, n => n.IdUsuarioJefeOverride!.Value);

            foreach (var over in request.Niveles.Where(n => n.IdUsuarioJefeOverride.HasValue))
            {
                var existente = overridesExistentes.FirstOrDefault(o => o.Nivel == over.Nivel);
                if (existente is null)
                {
                    _context.EmpleadoJefesOverride.Add(new EmpleadoJefeOverride
                    {
                    IdUsuario = idUsuario,
                        Nivel = over.Nivel,
                        IdUsuarioJefe = over.IdUsuarioJefeOverride!.Value,
                        Activo = true,
                        FechaCreacion = DateTime.Now
            });
                }
                else
        {
            existente.IdUsuarioJefe = over.IdUsuarioJefeOverride!.Value;
            existente.Activo = true;
            existente.FechaModificacion = DateTime.Now;
        }
            }

            foreach (var e in overridesExistentes.Where(e => !overridesPayload.ContainsKey(e.Nivel) && e.Activo))
        {
            e.Activo = false;
            e.FechaModificacion = DateTime.Now;
        }

            await _context.SaveChangesAsync();

            var filasActivas = await _context.EmpleadoJefesConfig
                .AsNoTracking()
                .Where(c => c.IdUsuario == idUsuario && c.Activo)
                .Select(c => new { c.Nivel, c.Aplica })
                .ToListAsync();

            var nivelesEfectivos = filasActivas.Count == 0
                ? Enumerable.Range(1, MaxNivel).ToHashSet()
                : filasActivas.Where(c => c.Aplica).Select(c => c.Nivel).ToHashSet();

            var bloqueadasPost = await ObtenerSolicitudesSinNivelAsync(idUsuario, nivelesEfectivos);
            if (bloqueadasPost.Count > 0)
            {
                await transaction.RollbackAsync();
                return CrearErrorSolicitudesSinNivel(bloqueadasPost);
            }

            await transaction.CommitAsync();
            await transaction.DisposeAsync();

            return await GetByUsuarioAsync(idUsuario);
        }

        private async Task<List<SolicitudSinNivel>> ObtenerSolicitudesSinNivelAsync(
            int idUsuario,
            IReadOnlySet<int> nivelesAplicables,
            CancellationToken cancellationToken = default)
        {
            var pendientes = await (
                from s in _context.SolicitudesPersonal.AsNoTracking()
                from p in _context.WorkflowParticipantes.AsNoTracking()
                where (s.IdUsuarioSolicitante ?? s.IdUsuarioCreador) == idUsuario
                    && s.IdPasoActual != null
                    && p.IdPaso == s.IdPasoActual
                    && p.Activo
                    && p.RequiereJefeInmediato
                    && s.Estado != null
                    && s.Estado.Codigo != WorkflowEstadoCodigo.CERRADA
                    && s.Estado.Codigo != WorkflowEstadoCodigo.RECHAZADA
                    && s.Estado.Codigo != WorkflowEstadoCodigo.CANCELADA
                    && !_context.WorkflowParticipantes.Any(q =>
                        q.IdPaso == s.IdPasoActual && q.Activo && !q.RequiereJefeInmediato)
                select new
                {
                    s.IdSolicitud,
                    s.Folio,
                    Nivel = p.NivelJefe ?? 1
                })
                .ToListAsync(cancellationToken);

            return pendientes
                .GroupBy(x => new { x.IdSolicitud, x.Folio })
                .Where(g => !g.Any(x => nivelesAplicables.Contains(x.Nivel)))
                .Select(g => new SolicitudSinNivel(
                    g.Key.IdSolicitud,
                    g.Key.Folio,
                    g.Select(x => x.Nivel).Distinct().OrderBy(n => n).ToList()))
                .ToList();
        }

        private static Error CrearErrorSolicitudesSinNivel(IReadOnlyList<SolicitudSinNivel> solicitudes)
        {
            const int maxJefes = 5;
            var detalle = string.Join(", ", solicitudes.Take(maxJefes).Select(s =>
                $"{s.Folio} (nivel {string.Join("/", s.Niveles)})"));
            var restantes = solicitudes.Count > maxJefes
                ? $" y {solicitudes.Count - maxJefes} más"
                : string.Empty;
            var encabezado = solicitudes.Count == 1
                ? "1 solicitud pendiente quedaría sin un nivel de jefe aplicable"
                : $"{solicitudes.Count} solicitudes pendientes quedarían sin un nivel de jefe aplicable";

            return CommonErrors.Validation(
                "NivelesJefe",
                $"No se puede guardar la configuración: {encabezado}: {detalle}{restantes}. Habilita el nivel correspondiente o espera a que se cierren.");
        }

        private sealed record SolicitudSinNivel(int IdSolicitud, string Folio, List<int> Niveles);
        

        public async Task<ErrorOr<WorkflowJefesExcluidosResponse>> GetExcluidosAsync(int idWorkflow)
        {
            var ids = await _context.WorkflowJefesExcluidos
                .AsNoTracking()
                .Where(x => x.IdWorkflow == idWorkflow && x.Activo)
                .Select(x => x.IdUsuarioJefe)
                .ToListAsync();

            return new WorkflowJefesExcluidosResponse { IdWorkflow = idWorkflow, IdUsuariosJefe = ids };
        }

        public async Task<ErrorOr<WorkflowJefesExcluidosResponse>> UpdateExcluidosAsync(int idWorkflow, UpdateWorkflowJefesExcluidosRequest request)
        {
            var workflowExiste = await _context.Workflows.AnyAsync(w => w.IdWorkflow == idWorkflow);
            if (!workflowExiste)
                return CommonErrors.NotFound("Workflow", idWorkflow.ToString());

            if (request.IdUsuariosJefe.Any(n => n <= 0))
                return CommonErrors.Validation("IdUsuarioJefe", "Los IDs de usuario deben ser mayores a 0.");

            if (request.IdUsuariosJefe.Distinct().Count() != request.IdUsuariosJefe.Count)
                return CommonErrors.Validation("IdUsuarioJefe", "Hay IDs de usuario duplicados en la solicitud.");

            var existentes = await _context.WorkflowJefesExcluidos
                .Where(x => x.IdWorkflow == idWorkflow)
                .ToListAsync();

            var idsPayload = request.IdUsuariosJefe.ToHashSet();

            foreach (var idUsuarioJefe in request.IdUsuariosJefe)
            {
                var existente = existentes.FirstOrDefault(e => e.IdUsuarioJefe == idUsuarioJefe);
                if (existente is null)
                {
                    _context.WorkflowJefesExcluidos.Add(new WorkflowJefeExcluido
                    {
                        IdWorkflow = idWorkflow,
                        IdUsuarioJefe = idUsuarioJefe,
                        Activo = true,
                        FechaCreacion = DateTime.Now
                    });
                }
                else
                {
                    existente.Activo = true;
                    existente.FechaModificacion = DateTime.Now;
                }
            }

            foreach (var e in existentes.Where(e => !idsPayload.Contains(e.IdUsuarioJefe) && e.Activo))
            {
                e.Activo = false;
                e.FechaModificacion = DateTime.Now;
            }

            await _context.SaveChangesAsync();

            return await GetExcluidosAsync(idWorkflow);
        }

        private async Task<Dictionary<int, string>> ResolverNombresOverrideAsync<T>(
    IEnumerable<T> overrides) where T : notnull
        {
            var ids = overrides
                .Select(o => (int?)o.GetType().GetProperty("IdUsuarioJefe")!.GetValue(o))
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .Distinct()
                .ToList();

            if (ids.Count == 0)
                return new Dictionary<int, string>();

            return await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => ids.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? $"Usuario {u.IdUsuario}");
        }

        private async Task<Dictionary<int, string>> ResolverNombresJefesAsync(
            Dictionary<int, List<JefeCadenaNivelDto>> cadenas)
        {
            var ids = cadenas.Values
                .SelectMany(c => c)
                .Where(c => c.IdUsuarioJefe.HasValue)
                .Select(c => c.IdUsuarioJefe!.Value)
                .Distinct()
                .ToList();

            if (ids.Count == 0)
                return new Dictionary<int, string>();

            return await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => ids.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? $"Usuario {u.IdUsuario}");
        }
    }
}
