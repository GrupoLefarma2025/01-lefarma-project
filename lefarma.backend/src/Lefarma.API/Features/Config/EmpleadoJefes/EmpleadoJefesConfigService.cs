using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Features.Config.EmpleadoJefes.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Config.EmpleadoJefes
{
    public class EmpleadoJefesConfigService : IEmpleadoJefesConfigService
    {
        private const int MaxNivel = 5; // hoy la vista tiene 5 niveles; cambiar aquí si crece
        private readonly ApplicationDbContext _context;
        private readonly AsokamDbContext _asokamContext;

        public EmpleadoJefesConfigService(ApplicationDbContext context, AsokamDbContext asokamContext)
        {
            _context = context;
            _asokamContext = asokamContext;
        }

        public async Task<ErrorOr<List<EmpleadoJefesConfigListItem>>> GetListAsync()
        {
            // Solo usuarios con al menos una fila activa en empleado_jefes_config
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

            var niveles = await _context.EmpleadoJefesConfig
                .AsNoTracking()
                .Where(c => c.Activo && idsConfigurados.Contains(c.IdUsuario))
                .OrderBy(c => c.IdUsuario).ThenBy(c => c.Nivel)
                .Select(c => new { c.IdUsuario, c.Nivel, c.Aplica })
                .ToListAsync();

            var resultado = idsConfigurados
                .Select(id => new EmpleadoJefesConfigListItem
                {
                    IdUsuario = id,
                    NumeroEmpleado = detalles.FirstOrDefault(d => d.IdUsuario == id)?.NumeroEmpleado,
                    Puesto = detalles.FirstOrDefault(d => d.IdUsuario == id)?.Puesto,
                    NombreCompleto = nombres.FirstOrDefault(n => n.IdUsuario == id)?.NombreCompleto,
                    Niveles = niveles
                        .Where(n => n.IdUsuario == id)
                        .Select(n => new EmpleadoJefeConfigItemDto { Nivel = n.Nivel, Aplica = n.Aplica })
                        .ToList()
                })
                .OrderBy(x => x.NumeroEmpleado)
                .ThenBy(x => x.NombreCompleto)
                .ToList();

            return resultado;
        }

        public async Task<ErrorOr<EmpleadoJefesConfigResponse>> GetByUsuarioAsync(int idUsuario)
        {
            var filas = await _context.EmpleadoJefesConfig
                .AsNoTracking()
                .Where(c => c.IdUsuario == idUsuario && c.Activo)
                .OrderBy(c => c.Nivel)
                .ToListAsync();

            return new EmpleadoJefesConfigResponse
            {
                IdUsuario = idUsuario,
                EsConfigPorDefecto = filas.Count == 0,
                Niveles = filas.Count == 0
                    ? new() { new() { Nivel = 1, Aplica = true } }   // default legacy visible para la UI
                    : filas.Select(f => new EmpleadoJefeConfigItemDto { Nivel = f.Nivel, Aplica = f.Aplica }).ToList()
            };
        }

        public async Task<ErrorOr<EmpleadoJefesConfigResponse>> UpdateAsync(int idUsuario, UpdateEmpleadoJefesConfigRequest request)
        {
            if (request.Niveles.Any(n => n.Nivel < 1 || n.Nivel > MaxNivel))
                return CommonErrors.Validation("Nivel", $"Los niveles deben estar entre 1 y {MaxNivel}.");

            if (request.Niveles.Select(n => n.Nivel).Distinct().Count() != request.Niveles.Count)
                return CommonErrors.Validation("Nivel", "Hay niveles duplicados en la solicitud.");

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

            // Borrado lógico de niveles ausentes en el payload
            foreach (var e in existentes.Where(e => !nivelesPayload.Contains(e.Nivel) && e.Activo))
            {
                e.Activo = false;
                e.FechaModificacion = DateTime.Now;
            }

            await _context.SaveChangesAsync();

            return await GetByUsuarioAsync(idUsuario);
        }

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
    }
}
