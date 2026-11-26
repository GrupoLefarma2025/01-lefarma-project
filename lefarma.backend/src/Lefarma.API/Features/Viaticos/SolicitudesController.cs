using System.Data;
using System.Globalization;
using System.Text.Json;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class SolicitudesController : ControllerBase
{
    public const string GerenciaPorDefecto = "Sin asignar";

    public const string EstadoBorrador = "borrador";

    public const string EstadoEnviada = "enviada";

    public const string SistemaOrigenViaticos = "viaticos";

    public const string SistemaOrigenEducacionMedica = "educacion_medica";

    private static readonly string[] SistemasOrigenValidos =
    {
        SistemaOrigenViaticos,
        SistemaOrigenEducacionMedica,
    };

    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly ILogger<SolicitudesController> _logger;

    public SolicitudesController(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        ILogger<SolicitudesController> logger)
    {
        _context = context;
        _asokamContext = asokamContext;
        _logger = logger;
    }

    [HttpPost("solicitudes")]
    [SwaggerOperation(
        Summary = "Crear solicitud de viáticos (borrador)",
        Description = "Crea una solicitud en estado 'borrador' a nombre del usuario autenticado. " +
                      "id_usuario_solicitante SIEMPRE viene del claim NameIdentifier; " +
                      "el body no puede sobrescribirlo. " +
                      "periodo (yyyy-MM) y gerencia se derivan del servidor.")]
    [SwaggerResponse(201, "Solicitud creada", typeof(ApiResponse<SolicitudDto>))]
    [SwaggerResponse(400, "Body inválido")]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "Sin permiso viaticos.solicitar")]
    public async Task<IActionResult> Crear([FromBody] CrearSolicitudRequest? request, CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
        {
            return Forbid();
        }
        if (request is null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Body requerido."
            });
        }

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        var ahora = DateTime.UtcNow;
        var gerencia = string.IsNullOrWhiteSpace(request.Gerencia) ? GerenciaPorDefecto : request.Gerencia.Trim();

        var sistemaOrigen = string.IsNullOrWhiteSpace(request.SistemaOrigen)
            ? SistemaOrigenViaticos
            : request.SistemaOrigen.Trim().ToLowerInvariant();
        if (!SistemasOrigenValidos.Contains(sistemaOrigen))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = $"sistema_origen inválido. Valores permitidos: {string.Join(", ", SistemasOrigenValidos)}."
            });
        }

        var numPuntos = ContarDestinos(request.Datos);
        var personaSnapshot = LeerPersonaDelSnapshot(request.Datos);
        var personas = await ResolverPersonasAsync(userId, personaSnapshot, ct);

        var numeroFolio = await SiguienteNumeroFolioAsync(ct);
        var samFolio = personas.SamViajero.Length > 40 ? personas.SamViajero[..40] : personas.SamViajero;
        var folio = $"VIA-{samFolio}-{numeroFolio:D4}";

        var solicitud = new Solicitud
        {
            IdUsuarioSolicitante = userId,
            IdUsuarioCreacion = userId,
            SistemaOrigen = sistemaOrigen,
            NumPuntos = numPuntos,
            PersonaSolicitante = personas.Solicitante,
            PersonaViajera = personas.Viajero,
            Periodo = ahora.ToString("yyyy-MM"),
            Gerencia = gerencia,
            Estado = EstadoBorrador,
            Folio = folio,
            DatosJson = request.Datos.ValueKind == JsonValueKind.Undefined || request.Datos.ValueKind == JsonValueKind.Null
                ? "{}"
                : request.Datos.GetRawText(),
            Activo = true,
            FechaCreacion = ahora,
            FechaModificacion = ahora,
        };

        solicitud.Eventos.Add(new SolicitudEvento
        {
            Tipo = "creada",
            PayloadJson = JsonSerializer.Serialize(new
            {
                estado = solicitud.Estado,
                gerencia,
                sistema_origen = sistemaOrigen,
                num_puntos = numPuntos,
                folio,
                persona_solicitante = solicitud.PersonaSolicitante,
                persona_viajera = solicitud.PersonaViajera,
            }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });

        _context.Solicitudes.Add(solicitud);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Solicitud viaticos {Id} creada por usuario {UserId} (periodo {Periodo}).",
            solicitud.IdSolicitud, userId, solicitud.Periodo);

        var dto = MapearDto(solicitud, opciones: false, eventos: false);
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = "Solicitud creada en borrador.",
            Data = dto
        });
    }

    [HttpPost("solicitudes/desde-educacion-medica")]
    [SwaggerOperation(
        Summary = "Crear o reutilizar una cotización desde una ruta de Educación Médica",
        Description = "Crea un borrador de viáticos ligado a las visitas seleccionadas de una ruta. " +
                      "Reutiliza un borrador del mismo usuario si la ruta y el conjunto exacto de " +
                      "visitas coinciden. Responde 409 si alguna visita ya pertenece a una cotización " +
                      "activa (borrador, enviada, autorizada o autorizada_con_ajustes).")]
    [SwaggerResponse(201, "Cotización creada", typeof(ApiResponse<SolicitudDesdeEducacionMedicaDto>))]
    [SwaggerResponse(200, "Cotización existente reutilizada", typeof(ApiResponse<SolicitudDesdeEducacionMedicaDto>))]
    [SwaggerResponse(400, "Body inválido")]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "Sin permiso viaticos.solicitar")]
    [SwaggerResponse(409, "Alguna visita ya está en una cotización activa")]
    public async Task<IActionResult> CrearDesdeEducacionMedica(
        [FromBody] CrearSolicitudDesdeEducacionMedicaRequest? request,
        CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
        {
            return Forbid();
        }

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        if (request is null || request.IdRuta <= 0)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "id_ruta es obligatorio."
            });
        }

        var visitasSolicitadas = request.IdRutaVisitas
            .Where(id => id > 0)
            .Distinct()
            .OrderBy(id => id)
            .ToList();
        if (visitasSolicitadas.Count == 0)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Selecciona al menos una visita con coordenadas."
            });
        }

        var ruta = await _context.Rutas
            .AsNoTracking()
            .Where(r => r.IdRuta == request.IdRuta)
            .Select(r => new { r.IdRuta, r.IdEspecialista, r.IdSeleccionMensual, r.IdRutaVersion, r.Estado })
            .FirstOrDefaultAsync(ct);
        if (ruta is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"La ruta {request.IdRuta} no existe."
            });
        }

        if (ruta.Estado is Ruta.EstadoArchivada or Ruta.EstadoCancelada or Ruta.EstadoRechazada)
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = $"La ruta está {ruta.Estado}; no se puede cotizar. Selecciona una versión vigente."
            });
        }

        var visitasRuta = await _context.RutasVisitas
            .AsNoTracking()
            .Where(v => v.IdRuta == request.IdRuta && visitasSolicitadas.Contains(v.IdRutaVisita))
            .Select(v => new { v.IdRutaVisita, v.IdEspecialista })
            .ToListAsync(ct);
        if (visitasRuta.Count != visitasSolicitadas.Count)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Todas las visitas seleccionadas deben pertenecer a la ruta indicada."
            });
        }
        if (!ruta.IdEspecialista.HasValue)
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = "La ruta no tiene especialista asignado; corrige la ruta antes de cotizar."
            });
        }
        if (visitasRuta.Any(v => v.IdEspecialista != ruta.IdEspecialista))
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = "La ruta contiene visitas de especialistas distintos; corrige la asignación antes de cotizar."
            });
        }

        await using var transaccion = _context.Database.IsRelational()
            ? await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct)
            : null;

        var ahora = DateTime.UtcNow;
        int? idTipoGerencia = null;
        if (ruta.IdRutaVersion is int idRutaVersion)
        {
            idTipoGerencia = await _context.RutasVersiones
                .Where(v => v.IdRutaVersion == idRutaVersion)
                .Select(v => v.IdTipoGerencia)
                .FirstOrDefaultAsync(ct);
        }
        if (idTipoGerencia is null)
        {
            idTipoGerencia = await _context.SeleccionesMensuales
                .Where(s => s.IdSeleccionMensual == ruta.IdSeleccionMensual)
                .Select(s => s.IdTipoGerencia)
                .FirstOrDefaultAsync(ct);
        }
        var gerenciaRuta = idTipoGerencia is int idTipo
            ? await _context.TiposGerencia
                .Where(t => t.IdTipoGerencia == idTipo && t.Activo)
                .Select(t => t.Descripcion)
                .FirstOrDefaultAsync(ct)
            : null;
        var gerencia = !string.IsNullOrWhiteSpace(gerenciaRuta)
            ? gerenciaRuta
            : (!string.IsNullOrWhiteSpace(request.Gerencia) ? request.Gerencia.Trim() : GerenciaPorDefecto);

        var borradores = await _context.Solicitudes
            .AsNoTracking()
            .Include(s => s.OrigenEmVisitas)
            .Where(s => s.IdUsuarioSolicitante == userId
                        && s.Activo
                        && s.SistemaOrigen == SistemaOrigenEducacionMedica
                        && s.Estado == EstadoBorrador)
            .ToListAsync(ct);

        var reutilizable = borradores.FirstOrDefault(s =>
        {
            var deLaRuta = s.OrigenEmVisitas
                .Where(l => l.IdRuta == request.IdRuta)
                .Select(l => l.IdRutaVisita)
                .OrderBy(id => id)
                .ToList();
            return deLaRuta.SequenceEqual(visitasSolicitadas);
        });

        if (reutilizable is not null)
        {
            return Ok(new ApiResponse<SolicitudDesdeEducacionMedicaDto>
            {
                Success = true,
                Message = "Se reutilizó la cotización en borrador existente.",
                Data = new SolicitudDesdeEducacionMedicaDto
                {
                    IdSolicitud = reutilizable.IdSolicitud,
                    Folio = reutilizable.Folio,
                    Reutilizado = true,
                }
            });
        }

        var estadosActivos = new[] { EstadoBorrador, EstadoEnviada, "autorizada", "autorizada_con_ajustes" };
        var activas = await (
            from liga in _context.SolicitudOrigenEmVisitas
            join s in _context.Solicitudes on liga.IdSolicitud equals s.IdSolicitud
            where liga.IdRuta == request.IdRuta
                  && visitasSolicitadas.Contains(liga.IdRutaVisita)
                  && s.IdUsuarioSolicitante == userId
                  && s.Activo
                  && estadosActivos.Contains(s.Estado)
            select new
            {
                liga.IdRutaVisita,
                s.IdSolicitud,
                s.Folio,
                s.Estado,
            })
            .AsNoTracking()
            .ToListAsync(ct);

        if (activas.Count > 0)
        {
            var detalle = activas
                .GroupBy(a => a.IdRutaVisita)
                .Select(g => new
                {
                    id_ruta_visita = g.Key,
                    id_solicitud = g.First().IdSolicitud,
                    folio = g.First().Folio,
                    estado = g.First().Estado,
                })
                .ToList();
            var folios = string.Join(", ", detalle.Select(d => d.folio).Where(f => !string.IsNullOrWhiteSpace(f)).Distinct());
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = folios.Length > 0
                    ? $"Algunas visitas ya están en una cotización activa ({folios}). Elimina esa cotización o ajusta la selección."
                    : "Algunas visitas ya están en una cotización activa. Elimínala o ajusta la selección.",
                Data = detalle
            });
        }

        var personaSnapshot = LeerPersonaDelSnapshot(request.Datos);
        var personas = await ResolverPersonasAsync(userId, personaSnapshot, ct);
        var numeroFolio = await SiguienteNumeroFolioAsync(ct);
        var samFolio = personas.SamViajero.Length > 40 ? personas.SamViajero[..40] : personas.SamViajero;
        var folioNuevo = $"VIA-{samFolio}-{numeroFolio:D4}";

        var solicitud = new Solicitud
        {
            IdUsuarioSolicitante = userId,
            IdUsuarioCreacion = userId,
            SistemaOrigen = SistemaOrigenEducacionMedica,
            NumPuntos = visitasSolicitadas.Count,
            PersonaSolicitante = personas.Solicitante,
            PersonaViajera = personas.Viajero,
            Periodo = ahora.ToString("yyyy-MM"),
            Gerencia = gerencia,
            Estado = EstadoBorrador,
            Folio = folioNuevo,
            DatosJson = request.Datos.ValueKind == JsonValueKind.Undefined || request.Datos.ValueKind == JsonValueKind.Null
                ? "{}"
                : request.Datos.GetRawText(),
            Activo = true,
            FechaCreacion = ahora,
            FechaModificacion = ahora,
        };

        foreach (var idVisita in visitasSolicitadas)
        {
            solicitud.OrigenEmVisitas.Add(new SolicitudOrigenEmVisita
            {
                IdRuta = request.IdRuta,
                IdRutaVisita = idVisita,
                IdSeleccionMensual = request.IdSeleccionMensual,
                FechaCreacion = ahora,
            });
        }

        solicitud.Eventos.Add(new SolicitudEvento
        {
            Tipo = "creada",
            PayloadJson = JsonSerializer.Serialize(new
            {
                estado = solicitud.Estado,
                gerencia,
                sistema_origen = SistemaOrigenEducacionMedica,
                num_puntos = solicitud.NumPuntos,
                folio = folioNuevo,
                id_ruta = request.IdRuta,
                id_seleccion_mensual = request.IdSeleccionMensual,
                id_ruta_visitas = visitasSolicitadas,
            }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });

        _context.Solicitudes.Add(solicitud);
        await _context.SaveChangesAsync(ct);
        if (transaccion is not null)
        {
            await transaccion.CommitAsync(ct);
        }

        _logger.LogInformation(
            "Cotización de viáticos {Id} creada desde Educación Médica (ruta {IdRuta}, {Visitas} visita(s)) por usuario {UserId}.",
            solicitud.IdSolicitud, request.IdRuta, visitasSolicitadas.Count, userId);

        return StatusCode(StatusCodes.Status201Created, new ApiResponse<SolicitudDesdeEducacionMedicaDto>
        {
            Success = true,
            Message = "Cotización creada en borrador.",
            Data = new SolicitudDesdeEducacionMedicaDto
            {
                IdSolicitud = solicitud.IdSolicitud,
                Folio = solicitud.Folio,
                Reutilizado = false,
            }
        });
    }

    [HttpGet("solicitudes/por-ruta/{idRuta:int}")]
    [SwaggerOperation(
        Summary = "Cotizaciones de viáticos ligadas a una ruta de Educación Médica",
        Description = "Devuelve todas las cotizaciones activas ligadas a la ruta, con sus visitas, " +
                      "folio, estado y total (null si aún no tiene precios). El dueño ve las suyas; " +
                      "viaticos.ver_todos ve las de todos.")]
    [SwaggerResponse(200, "Cotizaciones", typeof(ApiResponse<List<SolicitudOrigenEmResumenDto>>))]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "Sin permiso viaticos.solicitar o viaticos.ver_todos")]
    public async Task<IActionResult> PorRuta([FromRoute] int idRuta, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        var esVerTodos = User.TienePermiso(Permissions.Viaticos.VerTodos);
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar) && !esVerTodos)
        {
            return Forbid();
        }

        if (idRuta <= 0)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "idRuta inválido."
            });
        }

        var solicitudes = await _context.Solicitudes
            .AsNoTracking()
            .Include(s => s.Opciones)
            .Include(s => s.OrigenEmVisitas)
            .Where(s => s.Activo
                        && s.SistemaOrigen == SistemaOrigenEducacionMedica
                        && (esVerTodos || s.IdUsuarioSolicitante == userId)
                        && s.OrigenEmVisitas.Any(l => l.IdRuta == idRuta))
            .OrderByDescending(s => s.FechaCreacion)
            .ToListAsync(ct);

        var data = solicitudes
            .Select(s =>
            {
                var totales = TotalesCotizacion.Calcular(s.Opciones);
                var guardados = TotalesCotizacion.LeerDeDatos(s.DatosJson);
                return new SolicitudOrigenEmResumenDto
                {
                    IdSolicitud = s.IdSolicitud,
                    Folio = s.Folio,
                    Estado = s.Estado,
                    NumPuntos = s.NumPuntos,
                    Total = guardados.Total
                        ?? LeerTotalDeDatos(s.DatosJson)
                        ?? totales.Total
                        ?? CalcularTotalOpciones(s),
                    TotalCotizado = totales.Cotizado ?? guardados.Cotizado,
                    TotalEstimado = totales.Estimado ?? guardados.Estimado,
                    FechaCreacion = s.FechaCreacion,
                    IdRutaVisitas = s.OrigenEmVisitas
                        .Where(l => l.IdRuta == idRuta)
                        .Select(l => l.IdRutaVisita)
                        .OrderBy(id => id)
                        .ToList(),
                };
            })
            .ToList();

        return Ok(new ApiResponse<List<SolicitudOrigenEmResumenDto>>
        {
            Success = true,
            Message = "Cotizaciones obtenidas.",
            Data = data
        });
    }

[HttpGet("solicitudes/mis")]
    [SwaggerOperation(
        Summary = "Mis solicitudes de viáticos",
        Description = "Lista las solicitudes del usuario autenticado, ordenado por fecha de creación desc. " +
                      "Con todas=true y el permiso viaticos.ver_todos devuelve las de todos los usuarios " +
                      "(incluidos los borradores ajenos).")]
    [SwaggerResponse(200, "Listado", typeof(ApiResponse<List<SolicitudDto>>))]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "todas=true sin permiso viaticos.ver_todos")]
    public async Task<IActionResult> MisSolicitudes(
        [FromQuery] bool todas = false,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        if (todas && !User.TienePermiso(Permissions.Viaticos.VerTodos))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = $"No tiene permiso para ver las solicitudes de todos los usuarios ({Permissions.Viaticos.VerTodos}).",
                Data = null
            });
        }

        var rows = await _context.Solicitudes
            .AsNoTracking()
            .Include(s => s.Opciones)
            .Where(s => s.Activo && (todas || s.IdUsuarioSolicitante == userId))
            .OrderByDescending(s => s.FechaCreacion)
            .ToListAsync(ct);

        var directorio = await DirectorioDeCreadoresAsync(rows, ct);

        var data = rows
            .Select(s => MapearDto(
                s,
                opciones: true,
                eventos: false,
                nombreCreador: NombreDesdeDirectorio(directorio, s.IdUsuarioCreacion)))
            .ToList();
        return Ok(new ApiResponse<List<SolicitudDto>>
        {
            Success = true,
            Message = "Listado obtenido.",
            Data = data
        });
    }

    [HttpGet("solicitudes/por-autorizar")]
    [SwaggerOperation(
        Summary = "Solicitudes pendientes de autorizar",
        Description = "Lista las solicitudes en estado 'enviada' de todos los usuarios. Es la cola de la " +
                      "pantalla de autorizaciones (paso previo al concentrado) y exige viaticos.autorizar.")]
    [SwaggerResponse(200, "Solicitudes pendientes", typeof(ApiResponse<List<SolicitudDto>>))]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "Sin permiso viaticos.autorizar")]
    public async Task<IActionResult> PorAutorizar(CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Autorizar))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = $"No tiene permiso para autorizar solicitudes de viáticos ({Permissions.Viaticos.Autorizar}).",
                Data = null
            });
        }

        var rows = await _context.Solicitudes
            .AsNoTracking()
            .Include(s => s.Opciones)
            .Where(s => s.Activo && s.Estado == EstadoEnviada)
            .OrderByDescending(s => s.FechaCreacion)
            .ToListAsync(ct);

        var directorio = await DirectorioDeCreadoresAsync(rows, ct);

        var data = rows
            .Select(s => MapearDto(
                s,
                opciones: true,
                eventos: false,
                nombreCreador: NombreDesdeDirectorio(directorio, s.IdUsuarioCreacion)))
            .ToList();

        return Ok(new ApiResponse<List<SolicitudDto>>
        {
            Success = true,
            Message = "Solicitudes pendientes de autorizar obtenidas.",
            Data = data
        });
    }

    [HttpGet("solicitudes/autorizadas")]
    [SwaggerOperation(
        Summary = "Solicitudes autorizadas",
        Description = "Lista las solicitudes que ya se autorizaron y pasaron al concentrado. Es la pestana " +
                      "'Autorizados' de la pantalla de autorizaciones y exige viaticos.autorizar.")]
    [SwaggerResponse(200, "Solicitudes autorizadas", typeof(ApiResponse<List<SolicitudDto>>))]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "Sin permiso viaticos.autorizar")]
    public async Task<IActionResult> Autorizadas(CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Autorizar))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = $"No tiene permiso para consultar solicitudes autorizadas de viáticos ({Permissions.Viaticos.Autorizar}).",
                Data = null
            });
        }

        var rows = await _context.Solicitudes
            .AsNoTracking()
            .Include(s => s.Opciones)
            .Where(s => s.Activo && (s.Estado == "autorizada" || s.Estado == "autorizada_con_ajustes"))
            .OrderByDescending(s => s.FechaModificacion)
            .ToListAsync(ct);

        var directorio = await DirectorioDeCreadoresAsync(rows, ct);

        var data = rows
            .Select(s => MapearDto(
                s,
                opciones: true,
                eventos: false,
                nombreCreador: NombreDesdeDirectorio(directorio, s.IdUsuarioCreacion)))
            .ToList();

        return Ok(new ApiResponse<List<SolicitudDto>>
        {
            Success = true,
            Message = "Solicitudes autorizadas obtenidas.",
            Data = data
        });
    }

    [HttpGet("solicitudes/gerencia-sugerida")]
    [SwaggerOperation(
        Summary = "Gerencia sugerida para el wizard",
        Description = "Devuelve la ultima gerencia con la que el usuario clasifico una solicitud propia. " +
                      "El wizard la usa como valor inicial del combo; null cuando aun no tiene ninguna.")]
    [SwaggerResponse(200, "Gerencia sugerida", typeof(ApiResponse<GerenciaSugeridaDto>))]
    [SwaggerResponse(401, "Sin token")]
    public async Task<IActionResult> GerenciaSugerida(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        var gerencia = await _context.Solicitudes
            .AsNoTracking()
            .Where(s => s.IdUsuarioSolicitante == userId
                && s.Activo
                && s.Gerencia != null
                && s.Gerencia != ""
                && s.Gerencia != GerenciaPorDefecto)
            .OrderByDescending(s => s.FechaCreacion)
            .Select(s => s.Gerencia)
            .FirstOrDefaultAsync(ct);

        return Ok(new ApiResponse<GerenciaSugeridaDto>
        {
            Success = true,
            Message = "Gerencia sugerida obtenida.",
            Data = new GerenciaSugeridaDto { Gerencia = gerencia }
        });
    }

    [HttpGet("solicitudes/{id:int}")]
    [SwaggerOperation(
        Summary = "Detalle de una solicitud",
        Description = "Incluye opciones y eventos. Solo el dueño puede verla, " +
                      "salvo que el solicitante tenga viaticos.ver_todos.")]
    [SwaggerResponse(200, "Detalle", typeof(ApiResponse<SolicitudDto>))]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "No es el dueño y no tiene viaticos.ver_todos")]
    [SwaggerResponse(404, "No existe")]
    public async Task<IActionResult> Detalle([FromRoute] int id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        var esVerTodos = User.TienePermiso(Permissions.Viaticos.VerTodos);
        var query = _context.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .AsNoTracking()
            .Where(s => s.IdSolicitud == id && s.Activo);

        var solicitud = await query.FirstOrDefaultAsync(ct);
        if (solicitud is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Solicitud no encontrada."
            });
        }

        if (solicitud.IdUsuarioSolicitante != userId && !esVerTodos)
        {
            return Forbid();
        }

        var dto = MapearDto(solicitud, opciones: true, eventos: true, nombreCreador: await NombreCreadorAsync(solicitud.IdUsuarioCreacion, ct));
        return Ok(new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = "Detalle obtenido.",
            Data = dto
        });
    }

    [HttpPut("solicitudes/{id:int}/opciones")]
    [SwaggerOperation(
        Summary = "Persistir cotización (vuelo/hotel) y enviar la solicitud",
        Description = "Recibe { cotizacion: { opciones: [...] } }. " +
                      "Cada opción requiere fuente; url_compra es opcional (sin enlace se guarda null). " +
                      "precio solo puede ser null si fuente contiene 'estimado'. " +
                      "Si la solicitud ya tenía opciones del mismo tipo, se reemplazan. " +
                      "Si la solicitud estaba en 'borrador', la misma transacción la pasa a 'enviada' " +
                      "y registra el evento 'enviada' junto al 'cotizacion_guardada'; " +
                      "guardar la cotización ES el envío. " +
                      "Una solicitud que ya no está en 'borrador' conserva su estado.")]
    [SwaggerResponse(200, "Cotización persistida", typeof(ApiResponse<SolicitudDto>))]
    [SwaggerResponse(400, "Cotización inválida (campo faltante o precio sin fuente estimado)")]
    [SwaggerResponse(401, "Sin token")]
    [SwaggerResponse(403, "No es el dueño y no tiene viaticos.ver_todos")]
    [SwaggerResponse(404, "Solicitud no existe")]
    public async Task<IActionResult> GuardarOpciones(
        [FromRoute] int id,
        [FromBody] CotizacionRequest request,
        CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
        {
            return Forbid();
        }
        if (request is null || request.Cotizacion.ValueKind == JsonValueKind.Undefined || request.Cotizacion.ValueKind == JsonValueKind.Null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Body requerido con campo 'cotizacion'."
            });
        }

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        if (!request.Cotizacion.TryGetProperty("opciones", out var opcionesEl))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "El campo 'opciones' debe ser un array."
            });
        }

        var ahora = DateTime.UtcNow;
        var (nuevasOpciones, errorOpciones) = SolicitudOpcionesParser.Parsear(id, opcionesEl, ahora);
        if (errorOpciones is not null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = errorOpciones
            });
        }

        var solicitud = await _context.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .FirstOrDefaultAsync(s => s.IdSolicitud == id && s.Activo, ct);
        if (solicitud is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Solicitud no encontrada."
            });
        }

        var esVerTodos = User.TienePermiso(Permissions.Viaticos.VerTodos);
        if (solicitud.IdUsuarioSolicitante != userId && !esVerTodos)
        {
            return Forbid();
        }

        var totales = TotalesCotizacion.Calcular(nuevasOpciones);
        decimal? totalCliente = null;
        if (request.Cotizacion.ValueKind == JsonValueKind.Object
            && request.Cotizacion.TryGetProperty("total", out var totalEl)
            && totalEl.ValueKind == JsonValueKind.Number
            && totalEl.TryGetDecimal(out var totalLeido))
        {
            totalCliente = totalLeido;
        }
        solicitud.DatosJson = TotalesCotizacion.EscribirEnDatos(
            solicitud.DatosJson,
            totales.Cotizado,
            totales.Estimado,
            totalCliente ?? totales.Total);

        if (solicitud.Opciones.Count > 0)
        {
            _context.SolicitudOpciones.RemoveRange(solicitud.Opciones);
        }
        foreach (var nueva in nuevasOpciones)
        {
            _context.SolicitudOpciones.Add(nueva);
        }

        var hayQueEnviar = solicitud.Estado == EstadoBorrador;
        if (hayQueEnviar)
        {
            solicitud.Estado = EstadoEnviada;
        }

        _context.SolicitudEventos.Add(new SolicitudEvento
        {
            IdSolicitud = id,
            Tipo = "cotizacion_guardada",
            PayloadJson = JsonSerializer.Serialize(new
            {
                opciones = nuevasOpciones.Count,
                ids = nuevasOpciones.Select(o => new { o.Tipo, o.FueElegida }).ToArray(),
            }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });

        if (hayQueEnviar)
        {
            _context.SolicitudEventos.Add(new SolicitudEvento
            {
                IdSolicitud = id,
                Tipo = EstadoEnviada,
                PayloadJson = JsonSerializer.Serialize(new
                {
                    estado_anterior = EstadoBorrador,
                    estado = EstadoEnviada,
                    opciones = nuevasOpciones.Count,
                }),
                IdUsuario = userId,
                FechaCreacion = ahora,
            });
        }

        solicitud.FechaModificacion = ahora;
        AplicarCalculo(solicitud, request.Calculo);

        var cola = HttpContext.RequestServices.GetService<IDeteccionAutomaticaQueue>();
        if (cola is not null)
        {
            foreach (var nueva in nuevasOpciones.Where(EsCandidataDeteccion))
            {
                nueva.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(
                    nueva.DatosJson, "pendiente");
            }
        }

        await _context.SaveChangesAsync(ct);

        if (cola is not null)
        {
            foreach (var nueva in nuevasOpciones.Where(EsCandidataDeteccion))
            {
                await cola.EnqueueAsync(
                    new DeteccionAutomaticaJob(id, nueva.IdOpcion, userId), ct);
            }
        }

        var recargada = await _context.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .AsNoTracking()
            .FirstAsync(s => s.IdSolicitud == id, ct);

        var dto = MapearDto(recargada, opciones: true, eventos: true, nombreCreador: await NombreCreadorAsync(recargada.IdUsuarioCreacion, ct));
        return Ok(new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = $"Cotización persistida ({nuevasOpciones.Count} opción(es)).",
            Data = dto
        });
    }

    [HttpPut("solicitudes/{id:int}/opciones/{idOpcion:int}/precio")]
    [SwaggerOperation(
        Summary = "Registrar el precio real de una opción cotizada",
        Description = "Convierte una opción estimada en cotizada: exige precio > 0, " +
                      "fuente real (sin 'estimado'), URL http/https y una captura ya " +
                      "generada o subida. Recalcula total_cotizado/total_estimado/total " +
                      "y deja el evento 'precio_real_capturado'.")]
    [SwaggerResponse(200, "Precio real registrado", typeof(ApiResponse<SolicitudDto>))]
    [SwaggerResponse(400, "Precio, fuente, URL o captura inválidos")]
    [SwaggerResponse(403, "No es el dueño y no tiene viaticos.ver_todos")]
    [SwaggerResponse(404, "Solicitud u opción no encontrada")]
    [SwaggerResponse(409, "La solicitud ya no está en borrador o enviada")]
    public async Task<IActionResult> RegistrarPrecioReal(
        [FromRoute] int id,
        [FromRoute] int idOpcion,
        [FromBody] PrecioRealRequest? request,
        CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
        {
            return Forbid();
        }
        if (request is null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Body requerido con el precio real."
            });
        }

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object>
            {
                Success = false,
                Message = "Token sin id de usuario válido."
            });
        }

        var solicitud = await _context.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .FirstOrDefaultAsync(s => s.IdSolicitud == id && s.Activo, ct);
        if (solicitud is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Solicitud no encontrada."
            });
        }

        var esVerTodos = User.TienePermiso(Permissions.Viaticos.VerTodos);
        if (solicitud.IdUsuarioSolicitante != userId && !esVerTodos)
        {
            return Forbid();
        }

        if (solicitud.Estado is not (EstadoBorrador or EstadoEnviada))
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = $"La solicitud está en estado '{solicitud.Estado}'. " +
                          "El precio real solo se captura en borrador o enviada."
            });
        }

        var opcion = solicitud.Opciones.FirstOrDefault(o => o.IdOpcion == idOpcion);
        if (opcion is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"La opción {idOpcion} no pertenece a la solicitud {id}."
            });
        }

        var ahora = DateTime.UtcNow;

        if (request.Precio <= 0m || request.Precio > 1_000_000m)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "El precio real debe ser mayor que 0 y menor o igual a 1,000,000."
            });
        }

        var linea = request.Linea?.Trim() ?? string.Empty;
        if (linea.Length == 0
            || linea.Contains("estimado", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Indica la aerolínea o línea real; no puede quedar como 'estimado'."
            });
        }

        var fuente = request.Fuente?.Trim() ?? string.Empty;
        if (fuente.Length == 0
            || fuente.Contains("estimado", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La fuente del precio real es obligatoria y no puede declarar 'estimado'."
            });
        }

        var url = request.UrlCompra?.Trim();
        if (string.IsNullOrWhiteSpace(url)
            || !Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "La URL de compra debe ser http/https y no puede quedar vacía."
            });
        }

        var rutaCaptura = string.IsNullOrWhiteSpace(request.RutaCaptura)
            ? opcion.RutaCaptura?.Trim()
            : request.RutaCaptura.Trim();
        if (string.IsNullOrWhiteSpace(rutaCaptura)
            || !rutaCaptura.StartsWith(CapturasService.CarpetaPublica + "/", StringComparison.Ordinal)
            || rutaCaptura.Contains("..", StringComparison.Ordinal))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "El precio real exige una captura de la página. " +
                          "Genera o sube la captura antes de guardarlo."
            });
        }

        var precioAnterior = opcion.Precio;
        opcion.Linea = linea;
        opcion.Precio = request.Precio;
        opcion.Moneda = string.IsNullOrWhiteSpace(request.Moneda)
            ? "MXN"
            : request.Moneda.Trim().ToUpperInvariant();
        opcion.UrlCompra = url;
        opcion.Fuente = fuente;
        opcion.RutaCaptura = rutaCaptura;
        opcion.CapturadaEn = ahora;
        opcion.DatosJson = TotalesCotizacion.MarcarPrecioReal(
            opcion.DatosJson, request.Salida, request.Llegada, ahora, userId);
        opcion.DatosJson = TotalesCotizacion.MarcarEstadoDeteccion(
            opcion.DatosJson, "aplicado");

        var totales = TotalesCotizacion.Calcular(solicitud.Opciones);
        solicitud.DatosJson = TotalesCotizacion.EscribirEnDatos(
            solicitud.DatosJson, totales.Cotizado, totales.Estimado, totales.Total);
        solicitud.FechaModificacion = ahora;

        _context.SolicitudEventos.Add(new SolicitudEvento
        {
            IdSolicitud = id,
            Tipo = "precio_real_capturado",
            PayloadJson = JsonSerializer.Serialize(new
            {
                id_opcion = opcion.IdOpcion,
                tipo = opcion.Tipo,
                linea = opcion.Linea,
                precio_anterior = precioAnterior,
                precio = opcion.Precio,
                moneda = opcion.Moneda,
                fuente,
                url_compra = url,
                ruta_captura = rutaCaptura,
            }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });

        await _context.SaveChangesAsync(ct);

        var recargada = await _context.Solicitudes
            .Include(s => s.Opciones)
            .Include(s => s.Eventos)
            .AsNoTracking()
            .FirstAsync(s => s.IdSolicitud == id, ct);

        var dto = MapearDto(
            recargada,
            opciones: true,
            eventos: true,
            nombreCreador: await NombreCreadorAsync(recargada.IdUsuarioCreacion, ct));
        return Ok(new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = $"Precio real registrado para {opcion.Linea}.",
            Data = dto
        });
    }

    [HttpPut("solicitudes/{id:int}")]
    [SwaggerOperation(
        Summary = "Actualizar un borrador de viáticos",
        Description = "Reemplaza el snapshot del wizard de una solicitud en estado 'borrador' del usuario autenticado. " +
                      "No cambia el folio ni el sistema de origen.")]
    [SwaggerResponse(200, "Borrador actualizado", typeof(ApiResponse<SolicitudDto>))]
    [SwaggerResponse(403, "No es el dueño o sin permiso")]
    [SwaggerResponse(404, "No existe o está eliminada")]
    [SwaggerResponse(409, "La solicitud ya no está en borrador")]
    public async Task<IActionResult> Actualizar(
        [FromRoute] int id,
        [FromBody] CrearSolicitudRequest? request,
        CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
        {
            return Forbid();
        }
        if (request is null)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = "Body requerido." });
        }

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Token sin id de usuario válido." });
        }

        var (solicitud, error) = await ObtenerBorradorPropioAsync(id, userId, ct);
        if (error is not null)
        {
            return error;
        }

        var ahora = DateTime.UtcNow;
        var personaSnapshot = LeerPersonaDelSnapshot(request.Datos);
        var personas = await ResolverPersonasAsync(userId, personaSnapshot, ct);
        var numPuntos = ContarDestinos(request.Datos);

        solicitud!.DatosJson = request.Datos.ValueKind == JsonValueKind.Undefined || request.Datos.ValueKind == JsonValueKind.Null
            ? "{}"
            : request.Datos.GetRawText();
        solicitud.PersonaSolicitante = personas.Solicitante;
        solicitud.PersonaViajera = personas.Viajero;
        solicitud.NumPuntos = numPuntos;
        if (!string.IsNullOrWhiteSpace(request.Gerencia))
        {
            solicitud.Gerencia = request.Gerencia.Trim();
        }
        solicitud.FechaModificacion = ahora;

        _context.SolicitudEventos.Add(new SolicitudEvento
        {
            IdSolicitud = id,
            Tipo = "actualizada",
            PayloadJson = JsonSerializer.Serialize(new { folio = solicitud.Folio, num_puntos = numPuntos }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });
        await _context.SaveChangesAsync(ct);

        var dto = MapearDto(solicitud, opciones: false, eventos: false);
        return Ok(new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = "Borrador actualizado.",
            Data = dto
        });
    }

    [HttpDelete("solicitudes/{id:int}")]
    [SwaggerOperation(
        Summary = "Eliminar (soft) un borrador de viáticos",
        Description = "Marca activo = 0. Solo el dueño y solo si la solicitud está en 'borrador'.")]
    [SwaggerResponse(200, "Solicitud eliminada")]
    [SwaggerResponse(403, "No es el dueño o sin permiso")]
    [SwaggerResponse(404, "No existe o ya está eliminada")]
    [SwaggerResponse(409, "La solicitud ya no está en borrador")]
    public async Task<IActionResult> Eliminar([FromRoute] int id, CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
        {
            return Forbid();
        }

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Token sin id de usuario válido." });
        }

        var (solicitud, error) = await ObtenerBorradorPropioAsync(id, userId, ct);
        if (error is not null)
        {
            return error;
        }

        var ahora = DateTime.UtcNow;
        solicitud!.Activo = false;
        solicitud.FechaModificacion = ahora;

        _context.SolicitudEventos.Add(new SolicitudEvento
        {
            IdSolicitud = id,
            Tipo = "eliminada",
            PayloadJson = JsonSerializer.Serialize(new { estado_anterior = EstadoBorrador, folio = solicitud.Folio }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });
        await _context.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object> { Success = true, Message = "Solicitud eliminada." });
    }

    [HttpPost("solicitudes/{id:int}/enviar")]
    [SwaggerOperation(
        Summary = "Enviar un borrador a concentrado",
        Description = "Transiciona 'borrador' -> 'enviada'. Solo el dueño.")]
    [SwaggerResponse(200, "Solicitud enviada", typeof(ApiResponse<SolicitudDto>))]
    [SwaggerResponse(403, "No es el dueño o sin permiso")]
    [SwaggerResponse(404, "No existe o está eliminada")]
    [SwaggerResponse(409, "La solicitud ya no está en borrador")]
    public async Task<IActionResult> Enviar([FromRoute] int id, [FromBody] EnviarSolicitudRequest? request, CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Solicitar))
        {
            return Forbid();
        }

        var userId = User.GetUserId();
        if (userId <= 0)
        {
            return Unauthorized(new ApiResponse<object> { Success = false, Message = "Token sin id de usuario válido." });
        }

        var (solicitud, error) = await ObtenerBorradorPropioAsync(id, userId, ct);
        if (error is not null)
        {
            return error;
        }

        var ahora = DateTime.UtcNow;
        solicitud!.Estado = EstadoEnviada;
        solicitud.FechaModificacion = ahora;
        AplicarCalculo(solicitud, request?.Calculo);

        _context.SolicitudEventos.Add(new SolicitudEvento
        {
            IdSolicitud = id,
            Tipo = EstadoEnviada,
            PayloadJson = JsonSerializer.Serialize(new { estado_anterior = EstadoBorrador, estado = EstadoEnviada, folio = solicitud.Folio }),
            IdUsuario = userId,
            FechaCreacion = ahora,
        });
        await _context.SaveChangesAsync(ct);

        var dto = MapearDto(solicitud, opciones: true, eventos: false);
        return Ok(new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = "Solicitud enviada a concentrado.",
            Data = dto
        });
    }

private static void AplicarCalculo(Solicitud solicitud, JsonElement? calculo)
    {
        if (calculo is null || calculo.Value.ValueKind != JsonValueKind.Object) return;
        try
        {
            var baseJson = string.IsNullOrWhiteSpace(solicitud.DatosJson) ? "{}" : solicitud.DatosJson;
            using var doc = JsonDocument.Parse(baseJson);
            using var buffer = new MemoryStream();
            using (var writer = new Utf8JsonWriter(buffer))
            {
                writer.WriteStartObject();
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (prop.NameEquals("calculo")) continue;
                    prop.WriteTo(writer);
                }
                writer.WritePropertyName("calculo");
                calculo.Value.WriteTo(writer);
                writer.WriteEndObject();
            }
            solicitud.DatosJson = System.Text.Encoding.UTF8.GetString(buffer.ToArray());
        }
        catch (JsonException)
        {
            solicitud.DatosJson = JsonSerializer.Serialize(new { calculo = calculo.Value });
        }
    }

    private static SolicitudDto MapearDto(Solicitud s, bool opciones, bool eventos, string? nombreCreador = null)
    {
        JsonElement? datos = null;
        if (!string.IsNullOrWhiteSpace(s.DatosJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(s.DatosJson);
                datos = doc.RootElement.Clone();
            }
            catch (JsonException)
            {
                datos = null;
            }
        }

        var totales = TotalesCotizacion.Calcular(s.Opciones);
        var totalGuardado = TotalesCotizacion.LeerDeDatos(datos).Total;

        var enlaces = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var opcionesDto = new List<SolicitudOpcionDto>();
        if (opciones)
        {
            foreach (var o in s.Opciones.OrderBy(o => o.IdOpcion))
            {
                var urlCompra = EnlacesCompra.Canonicalizar(o.UrlCompra, datos, o.DatosJson);
                if (!string.IsNullOrWhiteSpace(o.UrlCompra)
                    && !string.IsNullOrWhiteSpace(urlCompra)
                    && !string.Equals(o.UrlCompra, urlCompra, StringComparison.Ordinal))
                {
                    enlaces[o.UrlCompra] = urlCompra;
                }
                opcionesDto.Add(new SolicitudOpcionDto
                {
                    IdOpcion = o.IdOpcion,
                    Tipo = o.Tipo,
                    Linea = o.Linea,
                    Precio = o.Precio,
                    Moneda = o.Moneda,
                    UrlCompra = urlCompra,
                    Fuente = o.Fuente,
                    FueElegida = o.FueElegida,
                    RutaCaptura = o.RutaCaptura,
                    Datos = ParsearJsonTolerante(o.DatosJson),
                });
            }
            datos = EnlacesCompra.ReemplazarEnlaces(datos, enlaces);
        }

        return new SolicitudDto
        {
            TotalCotizado = totales.Cotizado,
            TotalEstimado = totales.Estimado,
            Total = totalGuardado ?? totales.Total,
            IdSolicitud = s.IdSolicitud,
            IdUsuarioSolicitante = s.IdUsuarioSolicitante,
            Periodo = s.Periodo,
            Gerencia = s.Gerencia,
            Estado = s.Estado,
            Folio = s.Folio,
            PersonaSolicitante = s.PersonaSolicitante,
            PersonaViajera = s.PersonaViajera,
            SistemaOrigen = s.SistemaOrigen,
            IdUsuarioCreacion = s.IdUsuarioCreacion,
            NumPuntos = s.NumPuntos,
            NombreCreador = nombreCreador,
            Activo = s.Activo,
            FechaCreacion = s.FechaCreacion,
            FechaModificacion = s.FechaModificacion,
            Datos = datos,
            Opciones = opcionesDto,
            Eventos = eventos
                ? s.Eventos
                    .OrderBy(ev => ev.FechaCreacion)
                    .Select(ev => new SolicitudEventoDto
                    {
                        IdEvento = ev.IdEvento,
                        Tipo = ev.Tipo,
                        IdUsuario = ev.IdUsuario,
                        FechaCreacion = ev.FechaCreacion,
                        Payload = ParsearJsonTolerante(ev.PayloadJson),
                    }).ToList()
                : new List<SolicitudEventoDto>(),
        };
    }

    private async Task<(Solicitud? Solicitud, IActionResult? Error)> ObtenerBorradorPropioAsync(
        int id,
        int userId,
        CancellationToken ct)
    {
        var solicitud = await _context.Solicitudes
            .Include(s => s.Opciones)
            .FirstOrDefaultAsync(s => s.IdSolicitud == id && s.Activo, ct);

        if (solicitud is null)
        {
            return (null, NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = "Solicitud no encontrada."
            }));
        }
        if (solicitud.IdUsuarioSolicitante != userId)
        {
            return (null, Forbid());
        }
        if (solicitud.Estado != EstadoBorrador)
        {
            return (null, Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = "Solo se pueden modificar solicitudes en borrador."
            }));
        }
        return (solicitud, null);
    }

    private static int ContarDestinos(JsonElement datos)
    {
        if (datos.ValueKind != JsonValueKind.Object
            || !datos.TryGetProperty("destinos", out var destinos)
            || destinos.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }
        return destinos.GetArrayLength();
    }

    private static decimal? LeerTotalDeDatos(string datosJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("total", out var total)
                && total.ValueKind == JsonValueKind.Number
                && total.TryGetDecimal(out var valor))
            {
                return valor;
            }
        }
        catch (JsonException)
        {
        }
        return null;
    }

    private static bool EsCandidataDeteccion(SolicitudOpcion opcion) =>
        opcion.FueElegida
        && TotalesCotizacion.EsTipoDetectable(opcion.Tipo)
        && !string.IsNullOrWhiteSpace(opcion.UrlCompra)
        && !TotalesCotizacion.EsCotizada(opcion)
        && !(string.Equals(opcion.Tipo?.Trim(), "hotel", StringComparison.OrdinalIgnoreCase)
             && opcion.Linea.StartsWith("Hotel en ", StringComparison.OrdinalIgnoreCase));

    private static decimal? CalcularTotalOpciones(Solicitud s)
    {
        var elegidas = s.Opciones
            .Where(o => o.FueElegida && o.Precio.HasValue)
            .Sum(o => o.Precio!.Value);
        return elegidas > 0 ? elegidas : null;
    }

    private async Task<int> SiguienteNumeroFolioAsync(CancellationToken ct)
    {
        if (!_context.Database.IsSqlServer())
        {
            var folios = await _context.Solicitudes
                .AsNoTracking()
                .Where(s => s.Folio != null && s.Folio != string.Empty)
                .Select(s => s.Folio)
                .ToListAsync(ct);

            return folios
                .Select(f => f is not null && int.TryParse(f[(f.LastIndexOf('-') + 1)..], out var numero) ? numero : 0)
                .DefaultIfEmpty(0)
                .Max() + 1;
        }

        var conexion = _context.Database.GetDbConnection();
        var abrir = conexion.State != ConnectionState.Open;
        if (abrir)
        {
            await conexion.OpenAsync(ct);
        }

        try
        {
            await using var comando = conexion.CreateCommand();
            comando.CommandText = "SELECT NEXT VALUE FOR [viaticos].[seq_folio_viaje];";

            var transaccionActual = _context.Database.CurrentTransaction;
            if (transaccionActual is not null)
            {
                comando.Transaction = transaccionActual.GetDbTransaction();
            }

            var valor = await comando.ExecuteScalarAsync(ct);
            return Convert.ToInt32(valor, CultureInfo.InvariantCulture);
        }
        finally
        {
            if (abrir)
            {
                await conexion.CloseAsync();
            }
        }
    }

    private static (bool EsOtra, int EmpleadoId, string? Nombre) LeerPersonaDelSnapshot(JsonElement datos)
    {
        if (datos.ValueKind != JsonValueKind.Object
            || !datos.TryGetProperty("persona", out var persona)
            || persona.ValueKind != JsonValueKind.Object)
        {
            return (false, 0, null);
        }

        var modo = persona.TryGetProperty("modo", out var modoEl) && modoEl.ValueKind == JsonValueKind.String
            ? modoEl.GetString()
            : null;
        var nombre = persona.TryGetProperty("nombre", out var nombreEl) && nombreEl.ValueKind == JsonValueKind.String
            ? nombreEl.GetString()?.Trim()
            : null;
        var empleadoId = persona.TryGetProperty("empleadoId", out var empleadoEl)
            && empleadoEl.ValueKind == JsonValueKind.Number
            && empleadoEl.TryGetInt32(out var id)
                ? id
                : 0;

        return (modo == "otra", empleadoId, string.IsNullOrWhiteSpace(nombre) ? null : nombre);
    }

    private async Task<(string Solicitante, string Viajero, string SamViajero)> ResolverPersonasAsync(
        int userId,
        (bool EsOtra, int EmpleadoId, string? Nombre) persona,
        CancellationToken ct)
    {
        var idViajero = persona.EsOtra && persona.EmpleadoId > 0 ? persona.EmpleadoId : userId;
        var solicitante = !persona.EsOtra && persona.Nombre is not null ? persona.Nombre : $"Usuario #{userId}";
        var viajero = persona.Nombre ?? solicitante;
        var sam = idViajero.ToString();

        try
        {
            var ids = new[] { userId, idViajero }.Distinct().ToList();
            var directorio = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => ids.Contains(u.IdUsuario))
                .Select(u => new { u.IdUsuario, u.NombreCompleto, u.SamAccountName })
                .ToDictionaryAsync(u => u.IdUsuario, u => u, ct);

            if (directorio.TryGetValue(userId, out var infoSolicitante)
                && !string.IsNullOrWhiteSpace(infoSolicitante.NombreCompleto))
            {
                solicitante = infoSolicitante.NombreCompleto.Trim();
            }

            if (directorio.TryGetValue(idViajero, out var infoViajero))
            {
                if (!string.IsNullOrWhiteSpace(infoViajero.NombreCompleto))
                {
                    viajero = infoViajero.NombreCompleto.Trim();
                }
                if (!string.IsNullOrWhiteSpace(infoViajero.SamAccountName))
                {
                    sam = infoViajero.SamAccountName.Trim();
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudieron resolver los nombres de las personas para la solicitud de viáticos.");
        }

        return (solicitante, viajero, sam);
    }

    private async Task<Dictionary<int, string?>> DirectorioDeCreadoresAsync(
        IEnumerable<Solicitud> filas,
        CancellationToken ct)
    {
        var idsCreadores = filas.Select(s => s.IdUsuarioCreacion).Distinct().ToList();
        if (idsCreadores.Count == 0)
        {
            return new Dictionary<int, string?>();
        }

        return await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => u.EsActivo && idsCreadores.Contains(u.IdUsuario))
            .Select(u => new { u.IdUsuario, u.NombreCompleto })
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, ct);
    }

    private static string NombreDesdeDirectorio(IReadOnlyDictionary<int, string?> directorio, int idUsuario)
        => directorio.TryGetValue(idUsuario, out var nombre) && !string.IsNullOrWhiteSpace(nombre)
            ? nombre.Trim()
            : $"Usuario #{idUsuario}";

    private async Task<string> NombreCreadorAsync(int idUsuario, CancellationToken ct)
    {
        var nombre = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => u.IdUsuario == idUsuario && u.EsActivo)
            .Select(u => u.NombreCompleto)
            .FirstOrDefaultAsync(ct);
        return string.IsNullOrWhiteSpace(nombre) ? $"Usuario #{idUsuario}" : nombre.Trim();
    }

    private static JsonElement? ParsearJsonTolerante(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
