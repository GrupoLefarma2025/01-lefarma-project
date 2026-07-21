using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Config.Workflows.DTOs;
using Lefarma.API.Features.Profile;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Features.Rh.Vacaciones.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Helpers;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Models;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal
{
    public class SolicitudPersonalService : BaseService, ISolicitudPersonalService
    {
        private readonly ISolicitudPersonalRepository _repository;
        private readonly ITipoSolicitudRepository _tipoRepository;
        private readonly IWorkflowResolver _workflowResolver;
        private readonly ApplicationDbContext _context;
        private readonly AsokamDbContext _asokamContext;
        private readonly IJefeInmediatoResolver _jefeInmediatoResolver;
        private readonly ISolicitudPersonalFirmasService _firmasService;
        private readonly IEmpleadoRepository _empleadoRepository;
        private readonly IIncidenciasChecadoRepository _incidenciasRepository;
        private readonly IProfileService _profileService;
        protected override string EntityName => "SolicitudPersonal";

        public SolicitudPersonalService(
            ISolicitudPersonalRepository repository,
            ITipoSolicitudRepository tipoRepository,
            IWorkflowResolver workflowResolver,
            ApplicationDbContext context,
            AsokamDbContext asokamContext,
            IJefeInmediatoResolver jefeInmediatoResolver,
            ISolicitudPersonalFirmasService firmasService,
            IEmpleadoRepository empleadoRepository,
            IIncidenciasChecadoRepository incidenciasRepository,
            IProfileService profileService,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _repository = repository;
            _tipoRepository = tipoRepository;
            _workflowResolver = workflowResolver;
            _context = context;
            _asokamContext = asokamContext;
            _jefeInmediatoResolver = jefeInmediatoResolver;
            _firmasService = firmasService;
            _empleadoRepository = empleadoRepository;
            _incidenciasRepository = incidenciasRepository;
            _profileService = profileService;
        }

        public async Task<ErrorOr<PagedResult<SolicitudPersonalResponse>>> GetAllAsync(
            SolicitudPersonalRequest request, int idUsuario, IEnumerable<int> rolesUsuario, bool puedeVerTodas)
        {
            try
            {
                var q = _repository.GetQueryable()
                    .Include(x => x.Estado)
                    .Include(x => x.Empresa)
                    .Include(x => x.Sucursal)
                    .Include(x => x.Area)
                    .Include(x => x.TipoSolicitud)
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

                if (!string.IsNullOrWhiteSpace(request.Categoria) && int.TryParse(request.Categoria, out var categoriaInt))
                    q = q.Where(x => x.TipoSolicitud != null && (int)x.TipoSolicitud.Categoria == categoriaInt);

                if (!string.IsNullOrWhiteSpace(request.Estados))
                {
                    var estados = request.Estados
                        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Select(e => e.ToUpperInvariant())
                        .Where(e => !string.IsNullOrWhiteSpace(e))
                        .ToList();
                    q = q.Where(x => x.Estado != null && x.Estado.Codigo != null && estados.Contains(x.Estado.Codigo!.ToUpperInvariant()));
                }

                if (!string.IsNullOrWhiteSpace(request.IdsEstados))
                {
                    var idsEstados = request.IdsEstados
                        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Select(v => int.TryParse(v, out var id) ? id : (int?)null)
                        .Where(id => id.HasValue)
                        .Select(id => id!.Value)
                        .ToList();
                    if (idsEstados.Count > 0)
                        q = q.Where(x => idsEstados.Contains(x.IdEstado));
                }

                if (request.FechaCreacionDesde.HasValue)
                {
                    var desde = request.FechaCreacionDesde.Value.Date;
                    q = q.Where(x => x.FechaCreacion.Date >= desde);
                }
                if (request.FechaCreacionHasta.HasValue)
                {
                    var hasta = request.FechaCreacionHasta.Value.Date;
                    q = q.Where(x => x.FechaCreacion.Date <= hasta);
                }

                if (request.FechaDiasDesde.HasValue || request.FechaDiasHasta.HasValue)
                {
                    var desde = request.FechaDiasDesde?.Date;
                    var hasta = request.FechaDiasHasta?.Date;

                    if (desde.HasValue && hasta.HasValue)
                    {
                        var d = desde.Value;
                        var h = hasta.Value;
                        q = q.Where(x =>
                            x.FechaInicio.HasValue && x.FechaInicio.Value.Date <= h &&
                            (x.FechaFin.HasValue ? x.FechaFin.Value.Date >= d : x.FechaInicio.Value.Date >= d));
                    }
                    else if (desde.HasValue)
                    {
                        var d = desde.Value;
                        q = q.Where(x =>
                            (x.FechaInicio.HasValue && x.FechaInicio.Value.Date >= d) ||
                            (x.FechaFin.HasValue && x.FechaFin.Value.Date >= d));
                    }
                    else if (hasta.HasValue)
                    {
                        var h = hasta.Value;
                        q = q.Where(x =>
                            (x.FechaInicio.HasValue && x.FechaInicio.Value.Date <= h) ||
                            (x.FechaFin.HasValue && x.FechaFin.Value.Date <= h));
                    }
                }

                if (!string.IsNullOrWhiteSpace(request.Busqueda))
                {
                    var term = request.Busqueda.Trim();
                    q = q.Where(x => x.Folio != null && x.Folio.Contains(term));
                }

                // Si no tiene el permiso de ver todas y la solicitud no pide ver todas
                if (!puedeVerTodas || (puedeVerTodas && !request.VerTodas))
                {
                    var rolesLista = rolesUsuario.ToList();

                    // Obtener los pasos en los que el usuario es participante o tiene un rol participante
                    var pasosParticipante = await _context.WorkflowParticipantes
                        .Where(p => p.Activo && (
                            p.IdUsuario == idUsuario ||
                            (p.IdRol != null && rolesLista.Contains(p.IdRol.Value))
                        ))
                        .Select(p => p.IdPaso)
                        .Distinct()
                        .ToListAsync();

                    // Obtener los pasos que requieren jefe inmediato y verificar si el usuario es jefe inmediato
                    // de los creadores de las solicitudes en esos pasos
                    var pasosConJefeInmediato = await _context.WorkflowParticipantes
                        .Where(p => p.Activo && p.RequiereJefeInmediato)
                        .Select(p => p.IdPaso)
                        .Distinct()
                        .ToListAsync();

                    var usuariosDelJefe = new HashSet<int>();

                    if (pasosConJefeInmediato.Count > 0)
                    {
                        // Obtener los creadores de solicitudes que están en pasos que requieren jefe inmediato
                        var solicitudesEnPasosJefe = await _context.SolicitudesPersonal
                            .Where(s => pasosConJefeInmediato.Contains(s.IdPasoActual ?? 0))
                            .Select(s => s.IdUsuarioCreador)
                            .Distinct()
                            .ToListAsync();

                        // Verificar si el usuario es jefe inmediato de los creadores de las solicitudes 
                        // y agregarlos a la lista de usuarios del jefe
                        foreach (var idCreador in solicitudesEnPasosJefe)
                        {
                            var idJefe = await _jefeInmediatoResolver.ResolverIdUsuarioJefeAsync(idCreador);
                            if (idJefe == idUsuario)
                                usuariosDelJefe.Add(idCreador);
                        }
                    }

                    q = q.Where(x =>
                        x.IdUsuarioCreador == idUsuario ||
                        (
                            // La solicitud está en un paso que requiere jefe inmediato
                            // y usuario es jefe inmediato
                            x.IdPasoActual != null &&
                            pasosConJefeInmediato.Contains(x.IdPasoActual.Value) &&
                            usuariosDelJefe.Contains(x.IdUsuarioCreador)
                        ) ||
                        (
                            // usuario es participante del paso actual y que no en esté en estado "creada"
                            pasosParticipante.Contains(x.IdPasoActual ?? 0) &&
                            x.IdEstado != 1 // creada
                        )
                    );
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

                var page = Math.Max(1, request.Page);
                var pageSize = Math.Clamp(request.PageSize, 1, 100);

                var totalCount = await q.CountAsync();
                var items = await q
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                var userIds = items.Select(o => o.IdUsuarioCreador).Distinct().ToList();
                var usuariosInfo = await _asokamContext.Usuarios.AsNoTracking()
                    .Where(u => userIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => new RhMappings.UsuarioInfo(u.NombreCompleto ?? u.SamAccountName ?? $"Usuario {u.IdUsuario}", u.Puesto));

                var pasoIds = items.Select(o => o.IdPasoActual).Distinct().ToList();

                var pasoNombre = pasoIds.Any()
                    ? await _context.WorkflowPasos
                        .Where(u => pasoIds.Contains(u.IdPaso))
                        .Select(p => p.NombrePaso)
                        .FirstOrDefaultAsync()
                    : null;

                var result = new List<SolicitudPersonalResponse>();
                foreach (var item in items)
                {
                    var tipo = await _tipoRepository.GetByIdAsync(item.IdTipoSolicitud);
                    var dto = item.ToResponse(tipo, usuariosInfo, pasoNombre, item.Estado?.Codigo);
                    result.Add(dto);
                }

                EnrichWideEvent("GetAll", count: result.Count);
                return new PagedResult<SolicitudPersonalResponse>
                {
                    Items = result,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                };
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

                var userIds = new List<int> { soli.IdUsuarioCreador };
                var usuariosInfo = await _asokamContext.Usuarios.AsNoTracking()
                    .Where(u => userIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => new RhMappings.UsuarioInfo(u.NombreCompleto ?? u.SamAccountName ?? $"Usuario {u.IdUsuario}", u.Puesto));


                var tipo = await _tipoRepository.GetByIdAsync(soli.IdTipoSolicitud);

                EnrichWideEvent("GetById", entityId: id);
                return soli.ToResponse(tipo, usuariosInfo, paso, soli.Estado?.Codigo);
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
                var firmaValidacion = await ValidarFirmaUsuarioAsync(idUsuario);
                if (firmaValidacion.IsError)
                    return firmaValidacion.Errors;

                var tipo = await _tipoRepository.GetByIdAsync(request.IdTipoSolicitud);
                if (tipo is null)
                    return CommonErrors.NotFound("TipoSolicitud", request.IdTipoSolicitud.ToString());

                if (tipo.PideDiasSolicitados)
                {
                    if (!request.DiasSolicitados.HasValue || request.DiasSolicitados.Value < 1)
                        return CommonErrors.Validation("DiasSolicitados", "Debe indicar al menos 1 día solicitado.");
                    if (!request.FechaInicio.HasValue)
                        return CommonErrors.Validation("FechaInicio", "La fecha de inicio es requerida.");

                    var fechaFinCalculada = request.FechaInicio.Value.Date.AddDays(request.DiasSolicitados.Value - 1);
                    request.FechaFin = fechaFinCalculada;
                    request.Detalle = ExpandirDiasSolicitados(request.FechaInicio.Value, request.DiasSolicitados.Value);
                }

                var validacionLimite = await ValidarLimitePorPeriodoAsync(idUsuario, tipo);
                if (validacionLimite.IsError)
                    return validacionLimite.FirstError;

                //las claves de este diccionario deben coincidir con WorkflowScopeType.Codigo
                var workflow = await _workflowResolver.ResolveWorkflowIdAsync(
                    CodigoProceso.SOLICITUD_PERSONAL,
                    new Dictionary<string, int?>
                    {
                        ["USUARIO"] = idUsuario,
                        ["EMPRESA"] = request.IdEmpresa,
                        ["SUCURSAL"] = request.IdSucursal,
                        ["AREA"] = request.IdArea,
                        ["CATEGORIA"] = (int)tipo.Categoria,
                        ["TIPO_SOLICITUD"] = request.IdTipoSolicitud
                    });
                if (workflow is null)
                    return CommonErrors.NotFound("Workflow", CodigoProceso.SOLICITUD_PERSONAL);

                if (tipo.RequiereFechaFin && !tipo.PideDiasSolicitados && !request.FechaFin.HasValue)
                    return CommonErrors.Validation("FechaFin", "Este tipo de solicitud requiere fecha fin.");
                if (tipo.RequiereFechaRegreso && !request.FechaRegreso.HasValue)
                    return CommonErrors.Validation("FechaRegreso", "Este tipo de solicitud requiere fecha de regreso.");
                if (tipo.RequiereLugarComision && string.IsNullOrWhiteSpace(request.LugarComision))
                    return CommonErrors.Validation("LugarComision", "Este tipo de solicitud requiere lugar de comisión.");
                if (tipo.RequiereReposicionTiempo && !request.FechaReposicion.HasValue)
                    return CommonErrors.Validation("FechaReposicion", "Este tipo de solicitud requiere fecha de reposición.");

                var validacionFechas = await ValidarFechasPermitidas(tipo, request.Detalle.Select(d => d.Fecha), idUsuario, ct);
                if (validacionFechas.IsError)
                    return validacionFechas.FirstError;

                if (request.FechaInicio.HasValue)
                {
                    validacionFechas = await ValidarFechasPermitidas(tipo, new[] { request.FechaInicio.Value }, idUsuario, ct);
                    if (validacionFechas.IsError)
                        return validacionFechas.FirstError;
                }

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
                    solicitud.FechaRegreso = request.FechaRegreso;

                    if (solicitud.FechaInicio.HasValue && solicitud.FechaFin.HasValue)
                    {
                        var dias = (solicitud.FechaFin.Value.Date - solicitud.FechaInicio.Value.Date).Days + 1;
                        solicitud.DiasSolicitados = dias > 0 ? dias : 1;
                    }
                    else if (solicitud.FechaInicio.HasValue)
                    {
                        solicitud.DiasSolicitados = 1;
                    }
                }

                var validacionSaldo = await ValidarSaldoVacacionesAsync(idUsuario, solicitud, tipo);
                if (validacionSaldo.IsError)
                    return validacionSaldo.FirstError;

                await _repository.AddAsync(solicitud);

                var accionInicial = pasoInicial.AccionesOrigen?.OrderBy(a => a.IdAccion).FirstOrDefault();

                if (accionInicial is not null)
                {
                    var snapshot = new Dictionary<string, object?>
                    {
                        ["idWorkflow"] = workflow.IdWorkflow,
                        ["idPasoAnterior"] = null,
                        ["idPasoNuevo"] = solicitud.IdPasoActual,
                        ["idEstadoNuevo"] = solicitud.IdEstado,
                        ["datosAdicionales"] = null
                    };

                    _context.WorkflowBitacoras.Add(new WorkflowBitacora
                    {
                        TipoEntidad = CodigoProceso.SOLICITUD_PERSONAL,
                        IdEntidad = solicitud.IdSolicitud,
                        IdOrden = null,
                        IdWorkflow = workflow.IdWorkflow,
                        IdPaso = pasoInicial.IdPaso,
                        IdAccion = accionInicial.IdAccion,
                        IdUsuario = idUsuario,
                        Comentario = "Solicitud de personal creada",
                        DatosSnapshot = System.Text.Json.JsonSerializer.Serialize(snapshot),
                        FechaEvento = solicitud.FechaCreacion
                    });

                    await _context.SaveChangesAsync(ct);
                }

                var accionEnviar = pasoInicial.AccionesOrigen?
                    .Where(a => a.Activo && a.TipoAccion?.Codigo == "ENVIAR")
                    .OrderBy(a => a.IdAccion)
                    .FirstOrDefault();

                if (accionEnviar is not null && !tipo.RequiereDocumentacion)
                {
                    var firmaResult = await _firmasService.FirmarAsync(
                        solicitud.IdSolicitud,
                        new FirmarRequest
                        {
                            IdAccion = accionEnviar.IdAccion,
                            Comentario = "Envío automático al crear"
                        },
                        idUsuario);

                    if (firmaResult.IsError)
                        return firmaResult.Errors;
                }

                var userIds = new List<int> { solicitud.IdUsuarioCreador };
                var usuariosInfo = await _asokamContext.Usuarios.AsNoTracking()
                    .Where(u => userIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => new RhMappings.UsuarioInfo(u.NombreCompleto ?? u.SamAccountName ?? $"Usuario {u.IdUsuario}", u.Puesto));

                var estadoFinal = await _context.WorkflowEstados.FindAsync(solicitud.IdEstado);
                var pasoFinal = solicitud.IdPasoActual.HasValue
                    ? await _context.WorkflowPasos
                        .Where(p => p.IdPaso == solicitud.IdPasoActual.Value)
                        .Select(p => p.NombrePaso)
                        .FirstOrDefaultAsync(ct)
                    : null;

                if (estadoFinal is not null)
                    solicitud.Estado = estadoFinal;

                EnrichWideEvent("Create", entityId: solicitud.IdSolicitud, nombre: solicitud.Folio);
                return solicitud.ToResponse(tipo, usuariosInfo, pasoFinal, estadoFinal?.Codigo);
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
                var firmaValidacion = await ValidarFirmaUsuarioAsync(idUsuario);
                if (firmaValidacion.IsError)
                    return firmaValidacion.Errors;

                var soli = await _repository.GetWithDetalleAsync(id);
                if (soli == null)
                    return CommonErrors.NotFound("SolicitudPersonal", id.ToString());

                if (soli.IdUsuarioCreador != idUsuario)
                    return CommonErrors.Conflict("SolicitudPersonal", "Solo el creador de la solicitud puede modificarla.");

                if (soli.Estado?.IdEstado != 1)
                    return CommonErrors.Conflict("SolicitudPersonal", "Solo se pueden editar solicitudes en estado Creada.");

                var tipo = await _tipoRepository.GetByIdAsync(request.IdTipoSolicitud);
                if (tipo is null)
                    return CommonErrors.NotFound("TipoSolicitud", request.IdTipoSolicitud.ToString());

                if (tipo.PideDiasSolicitados)
                {
                    if (!request.DiasSolicitados.HasValue || request.DiasSolicitados.Value < 1)
                        return CommonErrors.Validation("DiasSolicitados", "Debe indicar al menos 1 día solicitado.");
                    if (!request.FechaInicio.HasValue)
                        return CommonErrors.Validation("FechaInicio", "La fecha de inicio es requerida.");

                    var fechaFinCalculada = request.FechaInicio.Value.Date.AddDays(request.DiasSolicitados.Value - 1);
                    request.FechaFin = fechaFinCalculada;
                    request.Detalle = ExpandirDiasSolicitados(request.FechaInicio.Value, request.DiasSolicitados.Value);
                }

                var validacionFechasUpdate = await ValidarFechasPermitidas(tipo, request.Detalle.Select(d => d.Fecha), idUsuario, ct);
                if (validacionFechasUpdate.IsError)
                    return validacionFechasUpdate.FirstError;

                if (request.FechaInicio.HasValue)
                {
                    validacionFechasUpdate = await ValidarFechasPermitidas(tipo, new[] { request.FechaInicio.Value }, idUsuario, ct);
                    if (validacionFechasUpdate.IsError)
                        return validacionFechasUpdate.FirstError;
                }

                if (soli.IdTipoSolicitud != request.IdTipoSolicitud)
                {
                    var validacionLimite = await ValidarLimitePorPeriodoAsync(idUsuario, tipo, soli.IdSolicitud);
                    if (validacionLimite.IsError)
                        return validacionLimite.FirstError;
                }

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
                    var tipoActual = await _tipoRepository.GetByIdAsync(soli.IdTipoSolicitud);
                    if (tipoActual is not null)
                        CalcularFechas(soli, tipoActual, nuevos);
                }
                else
                {
                    soli.Detalle = new List<SolicitudPersonalDetalle>();
                    soli.FechaInicio = request.FechaInicio;
                    soli.FechaFin = request.FechaFin;

                    if (soli.FechaInicio.HasValue && soli.FechaFin.HasValue)
                    {
                        var dias = (soli.FechaFin.Value.Date - soli.FechaInicio.Value.Date).Days + 1;
                        soli.DiasSolicitados = dias > 0 ? dias : 1;
                    }
                    else if (soli.FechaInicio.HasValue)
                    {
                        soli.DiasSolicitados = 1;
                    }
                    else
                    {
                        soli.DiasSolicitados = null;
                    }
                }

                var validacionSaldoUpdate = await ValidarSaldoVacacionesAsync(idUsuario, soli, tipo, soli.IdSolicitud);
                if (validacionSaldoUpdate.IsError)
                    return validacionSaldoUpdate.FirstError;

                await _repository.UpdateAsync(soli);

                EnrichWideEvent("Update", entityId: soli.IdSolicitud, nombre: soli.Folio);
                return soli.ToResponse(tipo, null, null, null);
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

        private async Task<ErrorOr<Success>> ValidarFirmaUsuarioAsync(int idUsuario)
        {
            var tieneFirma = await _profileService.HasFirmaAsync(idUsuario);
            if (tieneFirma.IsError)
                return tieneFirma.Errors;

            if (!tieneFirma.Value)
                return CommonErrors.Validation("Firma", "El usuario no tiene una firma digital registrada. Cárguela en Configuración > Perfil para continuar.");

            return Result.Success;
        }

        private async Task<ErrorOr<Success>> ValidarFechasPermitidas(
            TipoSolicitud tipo,
            IEnumerable<DateTime> fechas,
            int idUsuario,
            CancellationToken ct = default)
        {
            var fechasLista = fechas.Select(f => f.Date).Distinct().ToList();
            if (!fechasLista.Any())
                return Result.Success;

            var hoy = DateTime.Today;

            var empleado = tipo.TomaEnCuentaChecado
                ? await _empleadoRepository.ObtenerEmpleadoPorUsuarioAsync(idUsuario, ct)
                : null;

            bool aplicaRestriccionesFechas = !(tipo.TomaEnCuentaChecado &&
                empleado?.Checa?.Trim().Equals("No", StringComparison.OrdinalIgnoreCase) == true);

            if (aplicaRestriccionesFechas)
            {
                foreach (var fecha in fechasLista)
                {
                    if (!tipo.PermiteFechasPasadas && fecha.Date <= hoy)
                        return CommonErrors.Validation("Fecha", $"El tipo de solicitud '{tipo.Nombre}' no permite fechas pasadas.");
                    if (!tipo.PermiteFechasFuturas && fecha.Date > hoy)
                        return CommonErrors.Validation("Fecha", $"El tipo de solicitud '{tipo.Nombre}' no permite fechas futuras.");
                }
            }

            if (tipo.RequiereIncidenciasExistentes)
            {
                var nomina = await _empleadoRepository.ResolverNominaPorUsuarioAsync(idUsuario, ct);
                if (!nomina.HasValue)
                    return CommonErrors.Validation("Empleado", "No se encontró la nómina del empleado para validar incidencias.");

                var fechaMin = fechasLista.Min();
                var fechaMax = fechasLista.Max();

                var fechasConIncidencias = await _incidenciasRepository.GetQueryable()
                    .Where(i => i.Nomina == nomina.Value
                        && i.Fecha >= fechaMin
                        && i.Fecha <= fechaMax
                        && ((i.MsgError != null && i.MsgError != "")
                            || (i.IncidenciaEntrada != null && i.IncidenciaEntrada != "")
                            || (i.IncidenciaSalida != null && i.IncidenciaSalida != "")))
                    .Select(i => i.Fecha.Date)
                    .Distinct()
                    .ToListAsync(ct);

                var fechasSinIncidencias = fechasLista
                    .Where(f => !fechasConIncidencias.Contains(f))
                    .ToList();

                if (fechasSinIncidencias.Any())
                {
                    var fechasTexto = string.Join(", ", fechasSinIncidencias.Select(f => f.ToString("yyyy-MM-dd")));
                    return CommonErrors.Validation("Fecha", $"Las siguientes fechas no tienen incidencias registradas: {fechasTexto}.");
                }
            }

            return Result.Success;
        }

        private static List<SolicitudPersonalDetalleDto> ExpandirDiasSolicitados(
            DateTime fechaInicio, int diasSolicitados)
        {
            var fechas = new List<SolicitudPersonalDetalleDto>();
            var current = fechaInicio.Date;
            for (var i = 0; i < diasSolicitados; i++)
            {
                fechas.Add(new SolicitudPersonalDetalleDto { Fecha = current });
                current = current.AddDays(1);
            }
            return fechas;
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

        private async Task<ErrorOr<Success>> ValidarLimitePorPeriodoAsync(
            int idUsuario, TipoSolicitud tipo, int? excluirIdSolicitud = null)
        {
            if (!tipo.LimitePorPeriodo.HasValue)
                return Result.Success;

            var (inicio, fin, _) = PeriodoHelper.ObtenerPeriodoActual(
                DateTime.Now, tipo.PeriodoLimite ?? PeriodoHelper.Quincena);

            var cerradas = await _tipoRepository.ContarSolicitudesCerradasEnPeriodoAsync(
                idUsuario,
                tipo.IdTipoSolicitud,
                inicio,
                fin,
                WorkflowEstadoCodigo.CERRADA,
                excluirIdSolicitud);

            if (cerradas >= tipo.LimitePorPeriodo.Value)
            {
                return CommonErrors.Validation(
                    "LimitePorPeriodo",
                    $"Has alcanzado el límite de {tipo.LimitePorPeriodo} solicitudes de tipo '{tipo.Nombre}' para el periodo actual.");
            }

            return Result.Success;
        }

        private async Task<ErrorOr<Success>> ValidarSaldoVacacionesAsync(
            int idUsuario, SolicitudPersonal solicitud, TipoSolicitud tipo, int? excluirIdSolicitud = null)
        {
            if (tipo is null || !string.Equals(tipo.Clave, "vacaciones", StringComparison.OrdinalIgnoreCase))
                return Result.Success;

            if (!solicitud.FechaInicio.HasValue || !solicitud.FechaFin.HasValue)
                return Result.Success;

            var anio = solicitud.FechaInicio.Value.Year;
            var saldo = await _context.SaldosVacacionesAnuales
                .FirstOrDefaultAsync(s => s.IdUsuario == idUsuario && s.Anio == anio && s.Activo);

            if (saldo is null)
                return CommonErrors.NotFound("SaldoVacacionesAnual", $"usuario {idUsuario} / año {anio}");

            var diasSolicitados = (solicitud.FechaFin.Value - solicitud.FechaInicio.Value).Days + 1;

            if (saldo.DiasPendientes < diasSolicitados)
            {
                return CommonErrors.Validation("saldo",
                    $"Saldo insuficiente de vacaciones. Disponible: {saldo.DiasPendientes}, Solicitado: {diasSolicitados}.");
            }

            return Result.Success;
        }

        public async Task<ErrorOr<MisLimitesResponse>> ObtenerLimitesSolicitudesAsync(int idUsuario, int idUsuarioObjetivo, bool puedeVerTodas)
        {
            try
            {
                if (idUsuarioObjetivo != idUsuario && !puedeVerTodas)
                {
                    return Error.Forbidden("solicitud_personal.puede_ver_todas", "No tiene permiso para consultar los límites de otros usuarios.");
                }

                var tipos = await _tipoRepository.GetTiposActivosAsync();
                var ahora = DateTime.Now;

                var limites = new List<LimitePorTipoResponse>();
                foreach (var tipo in tipos.Where(t => t.LimitePorPeriodo.HasValue))
                {
                    var (inicio, fin, etiqueta) = PeriodoHelper.ObtenerPeriodoActual(
                        ahora, tipo.PeriodoLimite ?? PeriodoHelper.Quincena);

                    var usado = await _tipoRepository.ContarSolicitudesCerradasEnPeriodoAsync(
                        idUsuarioObjetivo,
                        tipo.IdTipoSolicitud,
                        inicio,
                        fin,
                        WorkflowEstadoCodigo.CERRADA);

                    limites.Add(new LimitePorTipoResponse
                    {
                        IdTipoSolicitud = tipo.IdTipoSolicitud,
                        Tipo = tipo.Nombre,
                        Limite = tipo.LimitePorPeriodo.Value,
                        Usado = usado,
                        Disponible = Math.Max(0, tipo.LimitePorPeriodo.Value - usado),
                        Periodo = etiqueta,
                        PeriodoInicio = inicio,
                        PeriodoFin = fin
                    });
                }

                var (periodoInicio, periodoFin, periodoEtiqueta) = PeriodoHelper.ObtenerPeriodoActual(
                    ahora, PeriodoHelper.Quincena);

                var anioActual = ahora.Year;
                var saldos = await _context.SaldosVacacionesAnuales
                    .AsNoTracking()
                    .Where(s => s.IdUsuario == idUsuarioObjetivo && s.Anio == anioActual && s.Activo)
                    .Select(s => new SaldoVacacionesResponse
                    {
                        IdSaldo = s.IdSaldo,
                        IdUsuario = s.IdUsuario,
                        IdEmpresa = s.IdEmpresa,
                        Anio = s.Anio,
                        DiasGenerados = s.DiasGenerados,
                        DiasVencidos = s.DiasVencidos,
                        DiasCompensados = s.DiasCompensados,
                        DiasAjustados = s.DiasAjustados,
                        DiasTomados = s.DiasTomados,
                        DiasPendientes = s.DiasPendientes,
                        Activo = s.Activo
                    })
                    .ToListAsync();

                return new MisLimitesResponse
                {
                    PeriodoActual = periodoEtiqueta,
                    PeriodoInicio = periodoInicio,
                    PeriodoFin = periodoFin,
                    LimitesPorTipo = limites,
                    SaldosVacaciones = saldos
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("ObtenerLimitesSolicitudes", exception: ex);
                return CommonErrors.DatabaseError("obtener los límites de solicitudes");
            }
        }
        public async Task<ErrorOr<IEnumerable<CalendarioGlobalEvento>>> ObtenerCalendarioAsync(
            CalendarioGlobalRequest request, int idUsuarioActual)
        {
            try
            {
                var estados = (request.Estados != null && request.Estados.Any())
                    ? request.Estados
                    : new List<string> { "CERRADA" };

                var query = _repository.GetQueryableConDetalles()
                    .Where(s => s.Estado != null && estados.Contains(s.Estado.Codigo))
                    .Where(s => s.IdUsuarioCreador == idUsuarioActual);

                if (request.IdEmpresa.HasValue)
                    query = query.Where(s => s.IdEmpresa == request.IdEmpresa.Value);
                if (request.IdSucursal.HasValue)
                    query = query.Where(s => s.IdSucursal == request.IdSucursal.Value);
                if (request.IdArea.HasValue)
                    query = query.Where(s => s.IdArea == request.IdArea.Value);
                if (request.IdTipoSolicitud.HasValue)
                    query = query.Where(s => s.IdTipoSolicitud == request.IdTipoSolicitud.Value);

                var solicitudes = await query.ToListAsync();

                var userIds = solicitudes.Select(s => s.IdUsuarioCreador).Distinct().ToList();
                var usuarios = await _asokamContext.Usuarios.AsNoTracking()
                    .Where(u => userIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(
                        u => u.IdUsuario,
                        u => u.NombreCompleto ?? u.SamAccountName ?? $"Usuario {u.IdUsuario}");

                var eventos = new List<CalendarioGlobalEvento>();
                var agruparPor = request.AgruparPor?.ToLowerInvariant();

                foreach (var s in solicitudes)
                {
                    var fechas = ExpandirFechasEnMes(s, request.Anio, request.Mes);
                    var solicitante = usuarios.TryGetValue(s.IdUsuarioCreador, out var nombre) ? nombre : null;

                    foreach (var fecha in fechas)
                    {
                        var (grupoClave, grupoNombre) = agruparPor switch
                        {
                            "empresa" => (s.IdEmpresa.ToString(), s.Empresa?.NombreNormalizado ?? s.Empresa?.Nombre),
                            "sucursal" => (s.IdSucursal.ToString(), s.Sucursal?.NombreNormalizado ?? s.Sucursal?.Nombre),
                            "area" => (s.IdArea.ToString(), s.Area?.NombreNormalizado ?? s.Area?.Nombre),
                            "tipo" => (s.IdTipoSolicitud.ToString(), s.TipoSolicitud?.Nombre),
                            "usuario" => (s.IdUsuarioCreador.ToString(), solicitante),
                            _ => (null, null)
                        };

                        eventos.Add(new CalendarioGlobalEvento
                        {
                            IdSolicitud = s.IdSolicitud,
                            Folio = s.Folio,
                            Fecha = fecha,
                            IdTipoSolicitud = s.IdTipoSolicitud,
                            Tipo = s.TipoSolicitud?.Nombre ?? "",
                            Categoria = ((int)(s.TipoSolicitud?.Categoria ?? CategoriaSolicitud.Permiso)).ToString(),
                            Estado = s.Estado?.Codigo ?? "",
                            EstadoColor = s.Estado?.ColorHex,
                            IdEmpresa = s.IdEmpresa,
                            EmpresaNombre = s.Empresa?.NombreNormalizado ?? s.Empresa?.Nombre,
                            IdSucursal = s.IdSucursal,
                            SucursalNombre = s.Sucursal?.NombreNormalizado ?? s.Sucursal?.Nombre,
                            IdArea = s.IdArea,
                            AreaNombre = s.Area?.NombreNormalizado ?? s.Area?.Nombre,
                            IdUsuarioCreador = s.IdUsuarioCreador,
                            SolicitanteNombre = solicitante,
                            GrupoClave = grupoClave,
                            GrupoNombre = grupoNombre
                        });
                    }
                }

                var resultado = eventos
                    .OrderBy(e => e.Fecha)
                    .ThenBy(e => e.GrupoNombre)
                    .ThenBy(e => e.Folio)
                    .ToList();

                EnrichWideEvent("ObtenerCalendario", count: resultado.Count);
                return resultado;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("ObtenerCalendario", exception: ex);
                return CommonErrors.DatabaseError("obtener el calendario de solicitudes");
            }
        }

        private static List<DateTime> ExpandirFechasEnMes(SolicitudPersonal s, int anio, int mes)
        {
            var inicioMes = new DateTime(anio, mes, 1);
            var finMes = inicioMes.AddMonths(1).AddDays(-1);

            if (s.Detalle != null && s.Detalle.Any())
            {
                return s.Detalle
                    .Where(d => d.Fecha.Year == anio && d.Fecha.Month == mes)
                    .Select(d => d.Fecha.Date)
                    .Distinct()
                    .ToList();
            }

            if (s.FechaInicio.HasValue && s.FechaFin.HasValue)
            {
                var inicio = s.FechaInicio.Value.Date > inicioMes.Date
                    ? s.FechaInicio.Value.Date
                    : inicioMes.Date;
                var fin = s.FechaFin.Value.Date < finMes.Date
                    ? s.FechaFin.Value.Date
                    : finMes.Date;

                var fechas = new List<DateTime>();
                var current = inicio;
                while (current <= fin)
                {
                    fechas.Add(current);
                    current = current.AddDays(1);
                }
                return fechas;
            }

            if (s.FechaInicio.HasValue
                && s.FechaInicio.Value.Year == anio
                && s.FechaInicio.Value.Month == mes)
            {
                return new List<DateTime> { s.FechaInicio.Value.Date };
            }

            return new List<DateTime>();
        }
    }
}
