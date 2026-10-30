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
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Wizard de solicitudes de viáticos. Endpoints centrados en el
/// solicitante (crear / cotizar / consultar). Las transiciones
/// autorizadas/ajustes viven en AprobacionesController (otro worker).
///
/// Reglas duras:
///  - <c>id_usuario_solicitante</c> SIEMPRE de <c>User.GetUserId()</c>,
///    NUNCA del body.
///  - <c>periodo</c> SIEMPRE derivado del servidor (yyyy-MM, UTC).
///  - <c>gerencia</c> del body si llega; si no, <see cref="GerenciaPorDefecto"/>
///    (documentado en DoneClaim como supuesto).
///  - PUT de cotizacion exige <c>url_compra</c> y <c>fuente</c> en cada
///    opcion; <c>precio:null</c> solo si <c>fuente</c> contiene "estimado".
///
/// Transiciones que escribe este controller (ninguna otra):
///  - <c>borrador</c> --(PUT opciones)--> <c>enviada</c>. Guardar la cotizacion
///    ES el envio: no hay un endpoint aparte de "enviar" y, sin esta
///    transicion, la solicitud se quedaba en <c>borrador</c> para siempre y
///    <c>AprobacionesController</c> la rechazaba con 409, dejando la bandeja
///    autorizable vacia. El resto de estados (<c>autorizada</c>,
///    <c>autorizada_con_ajustes</c>, <c>rechazada</c>) los pone
///    <c>AprobacionesController</c> y este controller no los toca.
/// </summary>
[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class SolicitudesController : ControllerBase
{
    /// <summary>
    /// Valor por defecto de gerencia cuando el solicitante no manda una
    /// y el backend todavía no tiene un catálogo de empleados
    /// (siguiente incremento: leer de <c>Asokam.genEmpleadosCat</c>).
    /// Documentado como supuesto en el DoneClaim.
    /// </summary>
    public const string GerenciaPorDefecto = "Sin asignar";

    /// <summary>Estado en el que nace toda solicitud (POST /solicitudes).</summary>
    public const string EstadoBorrador = "borrador";

    /// <summary>
    /// Estado al que pasa la solicitud al guardar sus opciones. Es el unico
    /// estado que <c>AprobacionesController</c> acepta para autorizar o
    /// rechazar; cualquier otro devuelve 409.
    /// </summary>
    public const string EstadoEnviada = "enviada";

    /// <summary>Sistema de origen por defecto (wizard de viáticos).</summary>
    public const string SistemaOrigenViaticos = "viaticos";

    /// <summary>Sistema de origen para las solicitudes creadas desde Educación Médica.</summary>
    public const string SistemaOrigenEducacionMedica = "educacion_medica";

    /// <summary>Valores aceptados en <c>sistema_origen</c>.</summary>
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

    // ----------------------------------------------------------------
    // POST /api/viaticos/solicitudes
    // ----------------------------------------------------------------
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

        // El folio se calcula ANTES del INSERT (consecutivo de la secuencia +
        // SamAccountName del viajero), asi la fila nace con folio y no hay
        // UPDATE posterior dependiente del IDENTITY.
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

        // El evento viaja por la navegacion: EF inserta solicitud + evento en la
        // MISMA transaccion y resuelve id_solicitud con el id generado.
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

    // ----------------------------------------------------------------
    // POST /api/viaticos/solicitudes/desde-educacion-medica
    // ----------------------------------------------------------------
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

        // La búsqueda de duplicados, el bloqueo y la inserción corren dentro de
        // una transacción serializable en SQL Server: dos solicitudes simultáneas
        // no pueden cotizar la misma visita. Los proveedores no relacionales
        // (EF InMemory en las pruebas) no soportan transacciones y se omiten.
        var ruta = await _context.Rutas
            .AsNoTracking()
            .Where(r => r.IdRuta == request.IdRuta)
            .Select(r => new { r.IdRuta, r.IdEspecialista, r.IdSeleccionMensual, r.Estado })
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
        var gerencia = string.IsNullOrWhiteSpace(request.Gerencia) ? GerenciaPorDefecto : request.Gerencia.Trim();

        // 1) Reutilizar un borrador propio con la misma ruta y el conjunto exacto
        // de visitas. El borrador legado (sin filas en la tabla liga) no entra.
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

        // 2) Bloquear visitas que ya estén en una cotización activa del usuario.
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

        // 3) Crear el borrador. Las filas de la liga viajan por la navegación:
        // EF inserta solicitud + liga en el mismo SaveChanges (atómico).
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

    // ----------------------------------------------------------------
    // GET /api/viaticos/solicitudes/por-ruta/{idRuta}
    // ----------------------------------------------------------------
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
            .Select(s => new SolicitudOrigenEmResumenDto
            {
                IdSolicitud = s.IdSolicitud,
                Folio = s.Folio,
                Estado = s.Estado,
                NumPuntos = s.NumPuntos,
                Total = LeerTotalDeDatos(s.DatosJson) ?? CalcularTotalOpciones(s),
                FechaCreacion = s.FechaCreacion,
                IdRutaVisitas = s.OrigenEmVisitas
                    .Where(l => l.IdRuta == idRuta)
                    .Select(l => l.IdRutaVisita)
                    .OrderBy(id => id)
                    .ToList(),
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
        Description = "Lista las solicitudes del usuario autenticado, ordenado por fecha de creación desc.")]
    [SwaggerResponse(200, "Listado", typeof(ApiResponse<List<SolicitudDto>>))]
    [SwaggerResponse(401, "Sin token")]
    public async Task<IActionResult> MisSolicitudes(CancellationToken ct)
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

        var rows = await _context.Solicitudes
            .AsNoTracking()
            .Include(s => s.Opciones)
            .Where(s => s.IdUsuarioSolicitante == userId && s.Activo)
            .OrderByDescending(s => s.FechaCreacion)
            .ToListAsync(ct);

        // Un solo query al directorio para resolver el nombre del creador de
        // todas las filas (evita N+1). Un usuario dado de baja cae al
        // fallback "Usuario #{id}".
        var idsCreadores = rows.Select(s => s.IdUsuarioCreacion).Distinct().ToList();
        var directorio = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => u.EsActivo && idsCreadores.Contains(u.IdUsuario))
            .Select(u => new { u.IdUsuario, u.NombreCompleto })
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, ct);

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

    // ----------------------------------------------------------------
    // GET /api/viaticos/solicitudes/gerencia-sugerida
    // ----------------------------------------------------------------
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

    // ----------------------------------------------------------------
    // GET /api/viaticos/solicitudes/{id}
    // ----------------------------------------------------------------
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

    // ----------------------------------------------------------------
    // PUT /api/viaticos/solicitudes/{id}/opciones
    // ----------------------------------------------------------------
    [HttpPut("solicitudes/{id:int}/opciones")]
    [SwaggerOperation(
        Summary = "Persistir cotización (vuelo/hotel) y enviar la solicitud",
        Description = "Recibe { cotizacion: { opciones: [...] } }. " +
                      "Cada opción requiere url_compra y fuente. " +
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

        // 1) Validar el JSON de cotización antes de tocar la BD.
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

        // 2) Cargar la solicitud (con verificación de dueño).
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

        // 2.1) Persistir el total del wizard en datos.total. Aprobaciones y el
        // resumen de cotizaciones por ruta lo leen de ahi (ADR-00014).
        if (request.Cotizacion.ValueKind == JsonValueKind.Object
            && request.Cotizacion.TryGetProperty("total", out var totalEl)
            && totalEl.ValueKind == JsonValueKind.Number
            && totalEl.TryGetDecimal(out var total))
        {
            solicitud.DatosJson = ConTotalEnDatos(solicitud.DatosJson, total);
        }

        // 3) Reemplazar las opciones existentes (regla de UX: la última cotización gana).
        if (solicitud.Opciones.Count > 0)
        {
            _context.SolicitudOpciones.RemoveRange(solicitud.Opciones);
        }
        foreach (var nueva in nuevasOpciones)
        {
            _context.SolicitudOpciones.Add(nueva);
        }

        // 4) Transición borrador -> enviada. Guardar la cotización ES el envío:
        // es el único punto donde una solicitud entra a la bandeja autorizable,
        // porque AprobacionesController solo acepta 'enviada' y responde 409 en
        // cualquier otro estado. Va en el MISMO SaveChangesAsync que las
        // opciones y la bitácora, así que las tres escrituras son atómicas:
        // no queda una solicitud enviada sin cotización ni al revés.
        // Una solicitud en cualquier otro estado (autorizada, rechazada, ...)
        // conserva el suyo: aquí no se inventa ni se retrocede ningún estado.
        var hayQueEnviar = solicitud.Estado == EstadoBorrador;
        if (hayQueEnviar)
        {
            solicitud.Estado = EstadoEnviada;
        }

        // 5) Bitácora
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
        await _context.SaveChangesAsync(ct);

        // Recargar con las nuevas opciones para responder con el detalle completo.
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

    // ----------------------------------------------------------------
    // PUT /api/viaticos/solicitudes/{id}  (solo borrador)
    // ----------------------------------------------------------------
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

    // ----------------------------------------------------------------
    // DELETE /api/viaticos/solicitudes/{id}  (soft delete, solo borrador)
    // ----------------------------------------------------------------
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

    // ----------------------------------------------------------------
    // POST /api/viaticos/solicitudes/{id}/enviar  (borrador -> enviada)
    // ----------------------------------------------------------------
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
        // Nota: la regla de "una solicitud enviada por usuario y periodo" se
        // relajo en la base de datos (script 0012) para permitir varias
        // solicitudes enviadas; por eso aqui no se bloquea el envio.
        await _context.SaveChangesAsync(ct);

        var dto = MapearDto(solicitud, opciones: true, eventos: false);
        return Ok(new ApiResponse<SolicitudDto>
        {
            Success = true,
            Message = "Solicitud enviada a concentrado.",
            Data = dto
        });
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    /// <summary>
    /// Guarda el cálculo de la ruta (el que se hizo al enviar) dentro del
    /// snapshot, en <c>datos.calculo</c>. Reemplaza el cálculo anterior: la
    /// última ruta calculada es la que manda.
    /// </summary>
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

        return new SolicitudDto
        {
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
            Opciones = opciones
                ? s.Opciones
                    .OrderBy(o => o.IdOpcion)
                    .Select(o => new SolicitudOpcionDto
                    {
                        IdOpcion = o.IdOpcion,
                        Tipo = o.Tipo,
                        Linea = o.Linea,
                        Precio = o.Precio,
                        Moneda = o.Moneda,
                        UrlCompra = o.UrlCompra,
                        Fuente = o.Fuente,
                        FueElegida = o.FueElegida,
                        RutaCaptura = o.RutaCaptura,
                    }).ToList()
                : new List<SolicitudOpcionDto>(),
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

    /// <summary>
    /// Carga una solicitud activa del usuario y valida que siga en borrador.
    /// Devuelve el error HTTP listo para retornar cuando no cumple.
    /// </summary>
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

    /// <summary>Cuenta los destinos/puntos del snapshot JSON (array `destinos`).</summary>
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

    /// <summary>Lee `datos.total`; null si no existe o no es numérico.</summary>
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
            // datos_json corrupto: el resumen no debe romper.
        }
        return null;
    }

    /// <summary>
    /// Total de respaldo: suma de las opciones elegidas con precio. Se usa
    /// cuando la cotización no persistió `datos.total` (p. ej. cotizaciones
    /// capturadas por la API antes de ADR-00014).
    /// </summary>
    private static decimal? CalcularTotalOpciones(Solicitud s)
    {
        var elegidas = s.Opciones
            .Where(o => o.FueElegida && o.Precio.HasValue)
            .Sum(o => o.Precio!.Value);
        return elegidas > 0 ? elegidas : null;
    }

    /// <summary>Agrega/reemplaza `total` en datos_json sin perder el resto del snapshot.</summary>
    private static string ConTotalEnDatos(string datosJson, decimal total)
    {
        Dictionary<string, JsonElement>? datos = null;
        try
        {
            datos = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(datosJson);
        }
        catch (JsonException)
        {
            // Si el snapshot no es un objeto válido, se reemplaza por uno mínimo.
        }
        datos ??= new Dictionary<string, JsonElement>();
        datos["total"] = JsonSerializer.SerializeToElement(total);
        return JsonSerializer.Serialize(datos);
    }

    /// <summary>
    /// Siguiente consecutivo del folio del viaje. En SQL Server sale de
    /// <c>[viaticos].[seq_folio_viaje]</c> (<c>NEXT VALUE FOR</c>, sin bloqueos),
    /// de modo que el folio se conoce antes del INSERT y la fila nace completa.
    /// Los proveedores no relacionales (EF InMemory en las pruebas) no tienen
    /// secuencias: ahi se toma el siguiente numero libre del propio folio.
    /// </summary>
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

            // La cotización desde EM abre una transacción local; el comando
            // crudo comparte la conexión del DbContext y debe enlistarse en
            // esa transacción (si no, SqlClient lanza InvalidOperationException).
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

    /// <summary>Lee la persona del snapshot del wizard (modo, empleado y nombre).</summary>
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

    /// <summary>
    /// Resuelve el nombre del solicitante y del viajero contra el directorio de
    /// Asokam (app.Usuarios) y el SamAccountName del viajero para el folio.
    /// Si el directorio no responde, usa el nombre del snapshot y el id.
    /// </summary>
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

    private static string NombreDesdeDirectorio(IReadOnlyDictionary<int, string?> directorio, int idUsuario)
        => directorio.TryGetValue(idUsuario, out var nombre) && !string.IsNullOrWhiteSpace(nombre)
            ? nombre.Trim()
            : $"Usuario #{idUsuario}";

    /// <summary>Nombre visible del creador; cae al fallback "Usuario #{id}".</summary>
    private async Task<string> NombreCreadorAsync(int idUsuario, CancellationToken ct)
    {
        var nombre = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => u.IdUsuario == idUsuario && u.EsActivo)
            .Select(u => u.NombreCompleto)
            .FirstOrDefaultAsync(ct);
        return string.IsNullOrWhiteSpace(nombre) ? $"Usuario #{idUsuario}" : nombre.Trim();
    }

    /// <summary>
    /// Convierte un *_json de la BD a <see cref="JsonElement"/> sin romper el
    /// detalle: null / vacio / JSON invalido devuelven <c>null</c>.
    /// </summary>
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
