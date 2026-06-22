using ErrorOr;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.SolicitudesPersonal;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal
{
    public class SolicitudPersonalService : BaseService, ISolicitudPersonalService
    {
        private readonly ISolicitudPersonalRepository _repository;
        private readonly IWorkflowResolver _workflowResolver;
        private readonly ApplicationDbContext _context;
        private readonly AsokamDbContext _asokamContext;
        protected override string EntityName => "SolicitudPersonal";

        public SolicitudPersonalService(
            ISolicitudPersonalRepository repository,
            IWorkflowResolver workflowResolver,
            ApplicationDbContext context,
            AsokamDbContext asokamContext,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _repository = repository;
            _workflowResolver = workflowResolver;
            _context = context;
            _asokamContext = asokamContext;
        }

        public async Task<ErrorOr<IEnumerable<SolicitudPersonalResponse>>> GetAllAsync(
            SolicitudPersonalRequest request, int idUsuario, IEnumerable<int> rolesUsuario, bool puedeVerTodas)
        {
            try
            {
                var q = _repository.GetQueryable()
                    .Include(x => x.Estado)
                    .Include(x => x.Empresa)
                    .Include(x => x.Sucursal)
                    .Include(x => x.Area)
                    .AsQueryable();

                if (request.IdEmpresa.HasValue)
                    q = q.Where(x => x.IdEmpresa == request.IdEmpresa.Value);
                if (request.IdSucursal.HasValue)
                    q = q.Where(x => x.IdSucursal == request.IdSucursal.Value);
                if (request.IdArea.HasValue)
                    q = q.Where(x => x.IdArea == request.IdArea.Value);
                if (request.IdEstado.HasValue)
                    q = q.Where(x => x.IdEstado == request.IdEstado.Value);
                if (request.IdUsuarioCreador.HasValue)
                    q = q.Where(x => x.IdUsuarioCreador == request.IdUsuarioCreador.Value);
                if (request.IdTipoSolicitud.HasValue)
                    q = q.Where(x => x.IdTipoSolicitud == request.IdTipoSolicitud.Value);

                if (!puedeVerTodas)
                {
                    var rolesLista = rolesUsuario.ToList();

                    var pasosParticipante = await _context.WorkflowParticipantes
                        .Where(p => p.Activo && (
                            p.IdUsuario == idUsuario ||
                            (p.IdRol != null && rolesLista.Contains(p.IdRol.Value))
                        ))
                        .Select(p => p.IdPaso)
                        .Distinct()
                        .ToListAsync();

                    q = q.Where(x =>
                        x.IdUsuarioCreador == idUsuario ||
                        (pasosParticipante.Contains(x.IdPasoActual ?? 0) &&
                         x.IdEstado != 1)); // Creada
                }

                q = request.OrderBy?.ToLower() switch
                {
                    "folio" => request.OrderDirection?.ToLower() == "asc"
                        ? q.OrderBy(x => x.Folio)
                        : q.OrderByDescending(x => x.Folio),
                    "fechacreacion" => request.OrderDirection?.ToLower() == "asc"
                        ? q.OrderBy(x => x.FechaCreacion)
                        : q.OrderByDescending(x => x.FechaCreacion),
                    _ => q.OrderByDescending(x => x.FechaCreacion)
                };

                if (request.Max.HasValue && request.Max.Value > 0)
                    q = q.Take(request.Max.Value);

                var items = await q.ToListAsync();

                var result = new List<SolicitudPersonalResponse>();
                foreach (var item in items)
                {
                    var dto = await MapToDto(item, null, item.Estado?.Codigo, null);
                    result.Add(dto);
                }

                EnrichWideEvent("GetAll", count: result.Count);
                return result;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener las solicitudes de personal");
            }
        }

        public async Task<ErrorOr<SolicitudPersonalResponse>> GetByIdAsync(int id)
        {
            try
            {
                var soli = await _repository.GetWithDetalleAsync(id);

                if (soli is null)
                {
                    EnrichWideEvent("GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("SolicitudPersonal", id.ToString());
                }

                var paso = soli.IdPasoActual.HasValue
                    ? await _context.WorkflowPasos
                        .Where(p => p.IdPaso == soli.IdPasoActual.Value)
                        .Select(p => p.NombrePaso)
                        .FirstOrDefaultAsync()
                    : null;

                var usuarioCreador = await _asokamContext.Usuarios
                    .Where(u => u.IdUsuario == soli.IdUsuarioCreador)
                    .Select(u => u.NombreCompleto)
                    .FirstOrDefaultAsync();

                EnrichWideEvent("GetById", entityId: id);
                return await MapToDto(soli, paso, soli.Estado?.Codigo, usuarioCreador);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError("obtener la solicitud de personal");
            }
        }

        public async Task<ErrorOr<SolicitudPersonalResponse>> CreateAsync(
            CreateSolicitudPersonalRequest request, int idUsuario, CancellationToken ct = default)
        {
            try
            {
                var tipo = await _repository.GetTipoSolicitudAsync(request.IdTipoSolicitud);
                if (tipo is null)
                    return CommonErrors.NotFound("TipoSolicitud", request.IdTipoSolicitud.ToString());

                var workflow = await _workflowResolver.ResolveWorkflowIdAsync(
                    CodigoProceso.SOLICITUD_PERSONAL,
                    idUsuario,
                    request.IdEmpresa,
                    request.IdSucursal,
                    request.IdArea);
                if (workflow is null)
                    return CommonErrors.NotFound("Workflow", CodigoProceso.SOLICITUD_PERSONAL);

                if (tipo.RequiereFechaFin && !request.FechaFin.HasValue)
                    return CommonErrors.Validation("FechaFin", "Este tipo de solicitud requiere fecha fin.");
                if (tipo.RequiereFechaRegreso && !request.FechaRegreso.HasValue)
                    return CommonErrors.Validation("FechaRegreso", "Este tipo de solicitud requiere fecha de regreso.");
                if (tipo.RequiereLugarComision && string.IsNullOrWhiteSpace(request.LugarComision))
                    return CommonErrors.Validation("LugarComision", "Este tipo de solicitud requiere lugar de comisión.");
                if (tipo.RequiereReposicionTiempo && !request.FechaReposicion.HasValue)
                    return CommonErrors.Validation("FechaReposicion", "Este tipo de solicitud requiere fecha de reposición.");

                var pasoInicial = workflow.Pasos.FirstOrDefault(p => p.EsInicio && p.Activo);
                if (pasoInicial is null)
                    return CommonErrors.Conflict("Workflow", "El workflow no tiene paso inicial.");

                var estadoInicial = await _context.WorkflowEstados
                    .FirstOrDefaultAsync(e => e.Codigo == "CREADA" && e.Activo);
                if (estadoInicial is null)
                    return CommonErrors.NotFound("WorkflowEstado", "CREADA");

                var folio = await _repository.GenerarFolioAsync(tipo.Categoria);

                var solicitud = new SolicitudPersonal
                {
                    Folio = folio,
                    IdWorkflow = workflow.IdWorkflow,
                    IdPasoActual = pasoInicial.IdPaso,
                    IdEstado = estadoInicial.IdEstado,
                    IdUsuarioCreador = idUsuario,
                    IdTipoSolicitud = request.IdTipoSolicitud,
                    IdEmpresa = request.IdEmpresa,
                    IdSucursal = request.IdSucursal,
                    IdArea = request.IdArea,
                    Motivo = request.Motivo,
                    LugarComision = request.LugarComision,
                    FechaReposicion = request.FechaReposicion,
                    FechaRegreso = request.FechaRegreso,
                    FechaCreacion = DateTime.Now
                };

                var detalleSoli = request.Detalle.Select(d => new SolicitudPersonalDetalle
                {
                    IdSolicitud = solicitud.IdSolicitud,
                    Fecha = d.Fecha,
                    Comentario = d.Comentario,
                    FechaCreacion = DateTime.Now
                }).ToList();

                if (detalleSoli.Any())
                {
                    solicitud.Detalle = new List<SolicitudPersonalDetalle>(detalleSoli);
                    CalcularFechas(solicitud, tipo, detalleSoli);
                }
                else
                {
                    solicitud.FechaInicio = request.FechaInicio;
                    solicitud.FechaFin = request.FechaFin;
                    solicitud.DiasSolicitados = request.DiasSolicitados;
                    solicitud.FechaRegreso = request.FechaRegreso;
                }

                await _repository.AddAsync(solicitud);

                EnrichWideEvent("Create", entityId: solicitud.IdSolicitud, nombre: solicitud.Folio);
                return await MapToDto(solicitud, pasoInicial.NombrePaso, estadoInicial.Codigo, null);
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent("Create", exception: ex);
                return CommonErrors.DatabaseError("guardar la solicitud de personal");
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Create", exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al crear la solicitud de personal.");
            }
        }

        public async Task<ErrorOr<SolicitudPersonalResponse>> UpdateAsync(
            int id, CreateSolicitudPersonalRequest request, int idUsuario, CancellationToken ct = default)
        {
            try
            {
                var soli = await _repository.GetWithDetalleAsync(id);
                if (soli == null)
                    return CommonErrors.NotFound("SolicitudPersonal", id.ToString());

                if (soli.IdUsuarioCreador != idUsuario)
                    return CommonErrors.Conflict("SolicitudPersonal", "Solo el creador de la solicitud puede modificarla.");

                if (soli.Estado?.IdEstado != 1)
                    return CommonErrors.Conflict("SolicitudPersonal", "Solo se pueden editar solicitudes en estado Creada.");

                soli.IdTipoSolicitud = request.IdTipoSolicitud;
                soli.Motivo = request.Motivo;
                soli.LugarComision = request.LugarComision;
                soli.FechaReposicion = request.FechaReposicion;
                soli.FechaModificacion = DateTime.Now;
                soli.FechaRegreso = request.FechaRegreso;

                var nuevos = request.Detalle.Select(d => new SolicitudPersonalDetalle
                {
                    IdSolicitud = id,
                    Fecha = d.Fecha,
                    Comentario = d.Comentario,
                    FechaCreacion = DateTime.Now
                }).ToList();

                if (nuevos.Any())
                {
                    soli.Detalle = nuevos;
                    var tipoActual = await _repository.GetTipoSolicitudAsync(soli.IdTipoSolicitud);
                    if (tipoActual is not null)
                        CalcularFechas(soli, tipoActual, nuevos);
                }
                else
                {
                    soli.Detalle = new List<SolicitudPersonalDetalle>();
                    soli.FechaInicio = request.FechaInicio;
                    soli.FechaFin = request.FechaFin;
                    soli.DiasSolicitados = request.DiasSolicitados;
                }

                await _repository.UpdateAsync(soli);

                EnrichWideEvent("Update", entityId: soli.IdSolicitud, nombre: soli.Folio);
                return await MapToDto(soli, null, null, null);
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent("Update", exception: ex);
                return CommonErrors.DatabaseError("actualizar la solicitud de personal");
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Update", exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al actualizar la solicitud de personal.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var soli = await _repository.GetWithDetalleAsync(id);
                if (soli is null)
                {
                    EnrichWideEvent("Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("SolicitudPersonal", id.ToString());
                }

                if (soli.FechaEnvio.HasValue)
                    return CommonErrors.Conflict("SolicitudPersonal", "No se pueden eliminar solicitudes enviadas.");

                var eliminado = await _repository.DeleteAsync(soli);
                if (!eliminado)
                {
                    EnrichWideEvent("Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("SolicitudPersonal");
                }

                EnrichWideEvent("Delete", entityId: id, nombre: soli.Folio);
                return true;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Delete", entityId: id, exception: ex);
                return CommonErrors.DatabaseError("eliminar la solicitud de personal");
            }
        }

        public async Task<ErrorOr<IEnumerable<TipoSolicitudResponse>>> ListarTiposAsync()
        {
            try
            {
                var tipos = await _repository.GetTiposActivosAsync();

                var response = tipos.Select(t => new TipoSolicitudResponse
                {
                    IdTipoSolicitud = t.IdTipoSolicitud,
                    Nombre = t.Nombre,
                    Clave = t.Clave,
                    Categoria = t.Categoria.ToString(),
                    Descripcion = t.Descripcion,
                    RequiereReposicionTiempo = t.RequiereReposicionTiempo,
                    RequiereFechaFin = t.RequiereFechaFin,
                    RequiereFechaRegreso = t.RequiereFechaRegreso,
                    RequiereLugarComision = t.RequiereLugarComision,
                    DescuentaNomina = t.DescuentaNomina,
                    DescuentaVacaciones = t.DescuentaVacaciones,
                    RequiereDocumentacion = t.RequiereDocumentacion,
                }).ToList();

                EnrichWideEvent("ListarTipos", count: response.Count);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("ListarTipos", exception: ex);
                return CommonErrors.DatabaseError("obtener los tipos de solicitud");
            }
        }

        private static void CalcularFechas(
            SolicitudPersonal solicitud, TipoSolicitud tipo, List<SolicitudPersonalDetalle> detalle)
        {
            if (!detalle.Any()) return;

            var fechas = detalle.Select(d => d.Fecha.Date).OrderBy(f => f).ToList();

            solicitud.FechaInicio = fechas.First();

            if (tipo.RequiereFechaFin)
                solicitud.FechaFin = fechas.Last();

            solicitud.DiasSolicitados = fechas.Count;

            if (tipo.RequiereFechaRegreso && !solicitud.FechaRegreso.HasValue)
            {
                solicitud.FechaRegreso = fechas.Last().AddDays(1);
            }
        }

        private async Task<SolicitudPersonalResponse> MapToDto(
            SolicitudPersonal s, string? paso, string? estado, string? usuario)
        {
            var tipo = await _repository.GetTipoSolicitudAsync(s.IdTipoSolicitud);

            return new SolicitudPersonalResponse
            {
                IdSolicitud = s.IdSolicitud,
                Folio = s.Folio,
                IdEmpresa = s.IdEmpresa,
                EmpresaNombre = s.Empresa?.NombreNormalizado ?? s.Empresa?.Nombre,
                IdSucursal = s.IdSucursal,
                SucursalNombre = s.Sucursal?.NombreNormalizado ?? s.Sucursal?.Nombre,
                IdArea = s.IdArea,
                AreaNombre = s.Area?.NombreNormalizado ?? s.Area?.Nombre,
                IdTipoSolicitud = s.IdTipoSolicitud,
                TipoSolicitudNombre = tipo?.Nombre,
                Categoria = tipo?.Categoria ?? CategoriaSolicitud.Permiso,
                IdEstado = s.IdEstado,
                EstadoNombre = estado ?? s.Estado?.Codigo,
                EstadoColor = s.Estado?.ColorHex,
                IdWorkflow = s.IdWorkflow,
                IdPasoActual = s.IdPasoActual,
                PasoActual = paso,
                IdUsuarioCreador = s.IdUsuarioCreador,
                UsuarioCreador = usuario,
                LugarComision = s.LugarComision,
                Motivo = s.Motivo,
                FechaEnvio = s.FechaEnvio,
                FechaInicio = s.FechaInicio,
                FechaFin = s.FechaFin,
                FechaReposicion = s.FechaReposicion,
                DiasSolicitados = s.DiasSolicitados,
                FechaRegreso = s.FechaRegreso,
                FechaCreacion = s.FechaCreacion,
                FechaModificacion = s.FechaModificacion,
                Detalle = s.Detalle?
                    .OrderBy(d => d.Fecha)
                    .Select(d => new SolicitudPersonalDetalleDto
                    {
                        Fecha = d.Fecha,
                        Comentario = d.Comentario
                    }).ToList() ?? new List<SolicitudPersonalDetalleDto>()
            };
        }
    }
}
