using System.Globalization;
using System.Text.Json;
using Lefarma.API.Domain.Entities.Asistencias;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class AprobacionesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IEmpleadoRepository _empleadoRepository;
    private readonly ILogger<AprobacionesController> _logger;

    public AprobacionesController(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IEmpleadoRepository empleadoRepository,
        ILogger<AprobacionesController> logger)
    {
        _context = context;
        _asokamContext = asokamContext;
        _empleadoRepository = empleadoRepository;
        _logger = logger;
    }

    [HttpGet("solicitudes")]
    [SwaggerOperation(
        Summary = "Bandeja de solicitudes de viaticos",
        Description = "Lista TODAS las solicitudes filtradas por periodo, estado y gerencia. Es la pantalla de autorizacion: requiere el permiso viaticos.autorizar.")]
    [SwaggerResponse(200, "Bandeja obtenida", typeof(ApiResponse<List<SolicitudBandejaDto>>))]
    [SwaggerResponse(401, "Sin token valido.")]
    [SwaggerResponse(403, "Sin permiso viaticos.autorizar.")]
    public async Task<IActionResult> GetSolicitudes(
        [FromQuery] string? periodo,
        [FromQuery] string? estado,
        [FromQuery] string? gerencia,
        CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Autorizar))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = $"No tiene permiso para revisar solicitudes de viáticos ({Permissions.Viaticos.Autorizar}).",
                Data = null
            });
        }

        var consulta = _context.Solicitudes
            .AsNoTracking()
            .Where(s => s.Activo);

        if (periodo is not null)
        {
            consulta = consulta.Where(s => s.Periodo == periodo);
        }

        if (estado is not null)
        {
            consulta = consulta.Where(s => s.Estado == estado);
        }

        if (gerencia is not null)
        {
            consulta = consulta.Where(s => s.Gerencia == gerencia);
        }

        var filas = await consulta
            .OrderByDescending(s => s.FechaCreacion)
            .Select(s => new
            {
                s.IdSolicitud,
                s.Folio,
                s.IdUsuarioSolicitante,
                s.Periodo,
                s.Gerencia,
                s.Estado,
                s.DatosJson,
                s.FechaCreacion,
                s.FechaModificacion,
                TieneOpciones = s.Opciones.Any(),
            })
            .ToListAsync(ct);

        var idsSolicitudes = filas.Select(f => f.IdSolicitud).ToList();
        var opcionesElegidas = await _context.SolicitudOpciones
            .AsNoTracking()
            .Where(o => idsSolicitudes.Contains(o.IdSolicitud) && o.FueElegida)
            .Select(o => new { o.IdSolicitud, o.Tipo, o.Precio, o.Moneda, o.DatosJson, o.Fuente })
            .ToListAsync(ct);
        var totalPorOpciones = opcionesElegidas
            .GroupBy(o => o.IdSolicitud)
            .ToDictionary(
                g => g.Key,
                g => TotalDeOpcionesElegidas(g.Select(o => (o.Precio, o.Moneda))));
        var tiposOpcionPorSolicitud = opcionesElegidas
            .GroupBy(o => o.IdSolicitud)
            .ToDictionary(
                g => g.Key,
                g => g.Select(o => o.Tipo).ToList());
        var preciosPendientesPorSolicitud = opcionesElegidas
            .GroupBy(o => o.IdSolicitud)
            .ToDictionary(
                g => g.Key,
                g => g.Count(o => TotalesCotizacion.VueloSinPrecioReal(
                    o.Tipo, o.Precio, o.DatosJson, o.Fuente)));
        var totalesPorOpciones = opcionesElegidas
            .GroupBy(o => o.IdSolicitud)
            .ToDictionary(
                g => g.Key,
                g => TotalesCotizacion.Calcular(
                    g.Select(o => (o.Precio, o.DatosJson, o.Fuente))));

        var idsSolicitantes = filas
            .Select(f => f.IdUsuarioSolicitante)
            .Distinct()
            .ToList();

        var directorio = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => u.EsActivo && idsSolicitantes.Contains(u.IdUsuario))
            .Select(u => new { u.IdUsuario, u.NombreCompleto })
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, ct);

        var empleados = new Dictionary<int, VwEmpleado>();
        try
        {
            empleados = await _empleadoRepository.ObtenerEmpleadosPorUsuariosAsync(
                idsSolicitantes,
                ct);
        }
        catch (Exception excepcion) when (excepcion is not OperationCanceledException)
        {
            _logger.LogWarning(
                excepcion,
                "No se pudieron resolver los empleados del directorio de asistencias para la bandeja de viaticos.");
        }

        var datosPorSolicitud = filas.ToDictionary(
            f => f.IdSolicitud,
            f => ParsearDatosJson(f.DatosJson));

        var idViajeroPorSolicitud = filas.ToDictionary(
            f => f.IdSolicitud,
            f => LeerIdViajero(datosPorSolicitud[f.IdSolicitud], f.IdUsuarioSolicitante));
        var idsViajeros = idViajeroPorSolicitud.Values.Distinct().ToList();
        var gerenciasRecientes = await _context.Solicitudes
            .AsNoTracking()
            .Where(s => s.Activo
                && idsViajeros.Contains(s.IdUsuarioSolicitante)
                && s.Gerencia != null
                && s.Gerencia != ""
                && s.Gerencia != SolicitudesController.GerenciaPorDefecto)
            .OrderByDescending(s => s.FechaCreacion)
            .Select(s => new { s.IdUsuarioSolicitante, s.Gerencia })
            .ToListAsync(ct);
        var gerenciaPorUsuario = gerenciasRecientes
            .GroupBy(g => g.IdUsuarioSolicitante)
            .ToDictionary(g => g.Key, g => g.First().Gerencia);

        var bandeja = filas.Select(f =>
        {
            var datos = datosPorSolicitud[f.IdSolicitud];
            var totales = TotalesCotizacion.LeerDeDatos(datos);
            var (fechaSalida, fechaRegreso) = LeerRangoViajeDesdeJson(datos);
            var persona = LeerObjeto(datos, "persona");
            var empleado = EsPersonaMia(datos)
                           && empleados.TryGetValue(f.IdUsuarioSolicitante, out var empleadoSolicitante)
                ? empleadoSolicitante
                : null;
            return new SolicitudBandejaDto
            {
                IdSolicitud = f.IdSolicitud,
                Folio = f.Folio,
                IdUsuarioSolicitante = f.IdUsuarioSolicitante,
                NombreSolicitante = directorio.TryGetValue(f.IdUsuarioSolicitante, out var nombre)
                    && !string.IsNullOrWhiteSpace(nombre)
                        ? nombre.Trim()
                        : $"Usuario #{f.IdUsuarioSolicitante}",
                Periodo = f.Periodo,
                Gerencia = ResolverGerenciaEfectiva(
                    f.Gerencia,
                    idViajeroPorSolicitud[f.IdSolicitud],
                    gerenciaPorUsuario),
                Estado = f.Estado,
                Destino = LeerDestinosDesdeJson(datos),
                Origen = LeerOrigenDesdeJson(datos),
                Fecha = ComponerRangoFecha(fechaSalida, fechaRegreso),
                FechaSalida = fechaSalida,
                FechaRegreso = fechaRegreso,
                Autobus = LeerConcepto(datos, "autobus"),
                Avion = LeerConcepto(datos, "avion"),
                Gasolina = LeerConcepto(datos, "gasolina"),
                Casetas = LeerConcepto(datos, "casetas"),
                VehiculoPropio = LeerConcepto(datos, "vehiculo_propio"),
                Hospedaje = LeerConcepto(datos, "hospedaje"),
                Comida = LeerConcepto(datos, "comida"),
                Taxi = LeerConcepto(datos, "taxi"),
                Total = LeerTotalDesdeJson(datos)
                    ?? totales.Total
                    ?? totalPorOpciones.GetValueOrDefault(f.IdSolicitud),
                TotalCotizado = totales.Cotizado
                    ?? totalesPorOpciones.GetValueOrDefault(f.IdSolicitud).Cotizado,
                TotalEstimado = totales.Estimado
                    ?? totalesPorOpciones.GetValueOrDefault(f.IdSolicitud).Estimado,
                PreciosPendientes = preciosPendientesPorSolicitud.GetValueOrDefault(f.IdSolicitud),
                TipoTransporte = ResolverTipoTransporte(
                    datos,
                    tiposOpcionPorSolicitud.GetValueOrDefault(f.IdSolicitud)),
                PersonaNombre = LeerTextoDesdeJson(persona, "nombre"),
                Motivo = LeerTextoDesdeJson(persona, "motivo"),
                Puesto = string.IsNullOrWhiteSpace(empleado?.Puesto)
                    ? null
                    : empleado.Puesto.Trim(),
                FechaNacimiento = empleado?.Fechanacimiento?.ToString(
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture),
                Trayectos = ComponerTrayectos(datos, fechaSalida, fechaRegreso),
                FechaCreacion = f.FechaCreacion,
                FechaModificacion = f.FechaModificacion,
                Recalculada = f.TieneOpciones || TieneCalculo(datos),
            };
        }).ToList();

        return Ok(new ApiResponse<List<SolicitudBandejaDto>>
        {
            Success = true,
            Message = "Bandeja de solicitudes obtenida exitosamente.",
            Data = bandeja
        });
    }

    [HttpPost("solicitudes/{id:int}/autorizar")]
    [SwaggerOperation(
        Summary = "Autorizar una solicitud de viaticos",
        Description = "Transiciona la solicitud de 'enviada' a 'autorizada'. Requiere viaticos.autorizar. " +
                      "Sin body autoriza la ruta que ya tenia la solicitud. Con { calculo } guarda esa version " +
                      "como 'ruta autorizada' y, si llegan opciones, reemplaza la cotizacion vigente.")]
    [SwaggerResponse(200, "Solicitud autorizada", typeof(ApiResponse<object>))]
    [SwaggerResponse(400, "Cotizacion invalida.")]
    [SwaggerResponse(403, "Sin permiso viaticos.autorizar.")]
    [SwaggerResponse(404, "Solicitud no encontrada.")]
    [SwaggerResponse(409, "La solicitud no esta en estado 'enviada'.")]
    public async Task<IActionResult> Autorizar(
        int id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AutorizarSolicitudRequest? body,
        CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Autorizar))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = $"No tiene permiso para autorizar solicitudes ({Permissions.Viaticos.Autorizar}).",
                Data = null
            });
        }

        var estadoActual = await GetEstadoSolicitudAsync(id, ct);
        if (estadoActual is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"No existe la solicitud {id}.",
                Data = null
            });
        }
        if (estadoActual != "enviada")
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = $"La solicitud {id} esta en estado '{estadoActual}'. Solo se autorizan solicitudes en estado 'enviada'.",
                Data = null
            });
        }

        var idUsuario = User.GetUserId();
        var ahora = DateTime.UtcNow;

        List<SolicitudOpcion>? nuevasOpciones = null;
        if (body?.Opciones is { } opcionesElement
            && opcionesElement.ValueKind is not (JsonValueKind.Undefined or JsonValueKind.Null))
        {
            var (opciones, errorOpciones) = SolicitudOpcionesParser.Parsear(id, opcionesElement, ahora);
            if (errorOpciones is not null)
            {
                return BadRequest(new ApiResponse<object>
                {
                    Success = false,
                    Message = errorOpciones,
                    Data = null
                });
            }
            nuevasOpciones = opciones;
        }

        var solicitud = await _context.Solicitudes
            .Include(s => s.Opciones)
            .FirstOrDefaultAsync(s => s.IdSolicitud == id && s.Estado == "enviada", ct);
        if (solicitud is null)
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = $"La solicitud {id} cambio de estado durante la operacion.",
                Data = null
            });
        }

        var opcionesParaAutorizar = nuevasOpciones ?? solicitud.Opciones;
        var vuelosPendientes = TotalesCotizacion.VuelosSinPrecioReal(opcionesParaAutorizar);
        if (vuelosPendientes.Count > 0)
        {
            var lineas = string.Join(" · ", vuelosPendientes.Take(3).Select(v => v.Linea));
            var sufijo = vuelosPendientes.Count > 3 ? "…" : string.Empty;
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = $"Faltan precios reales de {vuelosPendientes.Count} vuelo(s): " +
                          $"{lineas}{sufijo}. Captura el precio de la página antes de autorizar.",
                Data = null
            });
        }

        if (nuevasOpciones is not null)
        {
            if (solicitud.Opciones.Count > 0
                && LeerPropiedadSnapshot(solicitud.DatosJson, "opciones_originales") is null)
            {
                EscribirPropiedadSnapshot(
                    solicitud,
                    "opciones_originales",
                    SerializarOpciones(solicitud.Opciones));
            }

            if (solicitud.Opciones.Count > 0)
            {
                _context.SolicitudOpciones.RemoveRange(solicitud.Opciones);
            }
            _context.SolicitudOpciones.AddRange(nuevasOpciones);
        }

        var calculoAutorizado = AplicarCalculoAutorizado(solicitud, body?.Calculo);

        var opcionesAutorizadas = nuevasOpciones ?? solicitud.Opciones;
        var totalesAutorizados = TotalesCotizacion.Calcular(opcionesAutorizadas);
        solicitud.DatosJson = TotalesCotizacion.EscribirSplitEnDatos(
            solicitud.DatosJson,
            totalesAutorizados.Cotizado,
            totalesAutorizados.Estimado);

        GuardarResumenAutorizado(solicitud, opcionesAutorizadas, calculoAutorizado);

        solicitud.Estado = "autorizada";
        solicitud.FechaModificacion = ahora;

        var rutaNueva = body?.Calculo is { ValueKind: JsonValueKind.Object };
        var payload = JsonSerializer.Serialize(new
        {
            estado_anterior = "enviada",
            estado = "autorizada",
            ruta = rutaNueva ? "nueva" : "elegida",
            opciones = nuevasOpciones?.Count,
        });
        _context.SolicitudEventos.Add(NuevoEvento(id, "autorizada", payload, idUsuario, ahora));

        await _context.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = rutaNueva
                ? "Ruta autorizada exitosamente."
                : "Solicitud autorizada exitosamente.",
            Data = null
        });
    }

    [HttpPost("solicitudes/{id:int}/rechazar")]
    [SwaggerOperation(
        Summary = "Rechazar una solicitud de viaticos",
        Description = "Transiciona la solicitud de 'enviada' a 'rechazada'. El motivo es obligatorio y se persiste como evento. Requiere viaticos.autorizar.")]
    [SwaggerResponse(200, "Solicitud rechazada", typeof(ApiResponse<object>))]
    [SwaggerResponse(400, "Motivo es obligatorio.")]
    [SwaggerResponse(403, "Sin permiso viaticos.autorizar.")]
    [SwaggerResponse(404, "Solicitud no encontrada.")]
    [SwaggerResponse(409, "La solicitud no esta en estado 'enviada'.")]
    public async Task<IActionResult> Rechazar(int id, [FromBody] RechazoSolicitudRequest? body, CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Autorizar))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = $"No tiene permiso para rechazar solicitudes ({Permissions.Viaticos.Autorizar}).",
                Data = null
            });
        }

        var motivo = body?.Motivo?.Trim();
        if (string.IsNullOrWhiteSpace(motivo))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "El motivo del rechazo es obligatorio.",
                Data = null
            });
        }

        var estadoActual = await GetEstadoSolicitudAsync(id, ct);
        if (estadoActual is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"No existe la solicitud {id}.",
                Data = null
            });
        }
        if (estadoActual != "enviada")
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = $"La solicitud {id} esta en estado '{estadoActual}'. Solo se rechazan solicitudes en estado 'enviada'.",
                Data = null
            });
        }

        var idUsuario = User.GetUserId();
        var ahora = DateTime.UtcNow;
        var payload = JsonSerializer.Serialize(new { motivo });

        var solicitud = await _context.Solicitudes
            .FirstOrDefaultAsync(s => s.IdSolicitud == id && s.Estado == "enviada", ct);
        if (solicitud is null)
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = $"La solicitud {id} cambio de estado durante la operacion.",
                Data = null
            });
        }

        solicitud.Estado = "rechazada";
        solicitud.FechaModificacion = ahora;
        _context.SolicitudEventos.Add(NuevoEvento(id, "rechazada", payload, idUsuario, ahora));

        await _context.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Solicitud rechazada exitosamente.",
            Data = null
        });
    }

    [HttpPost("solicitudes/{id:int}/ajustes")]
    [SwaggerOperation(
        Summary = "Registrar un ajuste manual sobre una solicitud autorizada",
        Description = "Inserta una fila en solicitud_ajustes y un evento en solicitud_eventos; transiciona la solicitud a 'autorizada_con_ajustes' si estaba en 'autorizada'. El motivo y el campo son obligatorios. Requiere viaticos.ajustar.")]
    [SwaggerResponse(200, "Ajuste registrado", typeof(ApiResponse<object>))]
    [SwaggerResponse(400, "El motivo o el campo del ajuste es obligatorio.")]
    [SwaggerResponse(403, "Sin permiso viaticos.ajustar.")]
    [SwaggerResponse(404, "Solicitud no encontrada.")]
    [SwaggerResponse(409, "La solicitud no esta en estado 'autorizada' o 'autorizada_con_ajustes'.")]
    public async Task<IActionResult> AplicarAjuste(int id, [FromBody] AjusteSolicitudRequest? body, CancellationToken ct)
    {
        if (!User.TienePermiso(Permissions.Viaticos.Ajustar))
        {
            return StatusCode(403, new ApiResponse<object>
            {
                Success = false,
                Message = $"No tiene permiso para ajustar solicitudes ({Permissions.Viaticos.Ajustar}).",
                Data = null
            });
        }

        var motivo = body?.Motivo?.Trim();
        if (string.IsNullOrWhiteSpace(motivo))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "El motivo del ajuste es obligatorio.",
                Data = null
            });
        }

        var campo = (body?.Campo ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(campo))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "El campo del ajuste es obligatorio.",
                Data = null
            });
        }

        var estadoActual = await GetEstadoSolicitudAsync(id, ct);
        if (estadoActual is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"No existe la solicitud {id}.",
                Data = null
            });
        }
        if (estadoActual != "autorizada" && estadoActual != "autorizada_con_ajustes")
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = $"La solicitud {id} esta en estado '{estadoActual}'. Solo se ajustan solicitudes en estado 'autorizada' o 'autorizada_con_ajustes'.",
                Data = null
            });
        }

        var idUsuario = User.GetUserId();
        var ahora = DateTime.UtcNow;
        var valorAnterior = body!.ValorAnterior ?? string.Empty;
        var valorNuevo = body.ValorNuevo ?? string.Empty;
        var idOpcion = body.IdOpcion;
        var payload = JsonSerializer.Serialize(new
        {
            campo,
            valor_anterior = valorAnterior,
            valor_nuevo = valorNuevo,
            motivo,
            id_opcion = idOpcion == 0 ? (int?)null : idOpcion
        });

        _context.SolicitudAjustes.Add(new SolicitudAjuste
        {
            IdSolicitud = id,
            IdOpcion = idOpcion == 0 ? null : idOpcion,
            Campo = campo,
            ValorAnterior = valorAnterior,
            ValorNuevo = valorNuevo,
            Motivo = motivo,
            IdUsuarioAdmin = idUsuario,
            FechaCreacion = ahora,
        });

        if (estadoActual == "autorizada")
        {
            var solicitud = await _context.Solicitudes
                .FirstOrDefaultAsync(s => s.IdSolicitud == id && s.Estado == "autorizada", ct);
            if (solicitud is not null)
            {
                solicitud.Estado = "autorizada_con_ajustes";
                solicitud.FechaModificacion = ahora;
            }
        }

        _context.SolicitudEventos.Add(NuevoEvento(id, "ajuste_aplicado", payload, idUsuario, ahora));

        await _context.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Ajuste registrado exitosamente.",
            Data = null
        });
    }

private async Task<string?> GetEstadoSolicitudAsync(int idSolicitud, CancellationToken ct)
    {
        return await _context.Solicitudes
            .AsNoTracking()
            .Where(s => s.IdSolicitud == idSolicitud)
            .Select(s => s.Estado)
            .FirstOrDefaultAsync(ct);
    }

    private static SolicitudEvento NuevoEvento(
        int idSolicitud,
        string tipo,
        string? payloadJson,
        int idUsuario,
        DateTime ahora) => new()
        {
            IdSolicitud = idSolicitud,
            Tipo = tipo,
            PayloadJson = payloadJson,
            IdUsuario = idUsuario,
            FechaCreacion = ahora,
        };

private static string ResolverGerenciaEfectiva(
        string? gerencia,
        int idViajero,
        IReadOnlyDictionary<int, string> gerenciaPorUsuario)
    {
        if (!string.IsNullOrWhiteSpace(gerencia)
            && !string.Equals(
                gerencia.Trim(),
                SolicitudesController.GerenciaPorDefecto,
                StringComparison.OrdinalIgnoreCase))
        {
            return gerencia.Trim();
        }

        return gerenciaPorUsuario.TryGetValue(idViajero, out var reciente)
               && !string.IsNullOrWhiteSpace(reciente)
            ? reciente.Trim()
            : SolicitudesController.GerenciaPorDefecto;
    }

    private static int LeerIdViajero(JsonElement? snapshot, int idSolicitante)
    {
        if (snapshot is not { } raiz
            || !raiz.TryGetProperty("persona", out var persona)
            || persona.ValueKind != JsonValueKind.Object
            || LeerTextoDesdeJson(persona, "modo") != "otra")
        {
            return idSolicitante;
        }

        return persona.TryGetProperty("empleadoId", out var empleadoId)
               && empleadoId.ValueKind == JsonValueKind.Number
               && empleadoId.TryGetInt32(out var id)
               && id > 0
            ? id
            : idSolicitante;
    }

    private static JsonElement? AplicarCalculoAutorizado(Solicitud solicitud, JsonElement? calculo)
    {
        var autorizado = calculo is { ValueKind: JsonValueKind.Object }
            ? calculo
            : LeerPropiedadSnapshot(solicitud.DatosJson, "calculo");

        if (autorizado is { ValueKind: JsonValueKind.Object })
        {
            EscribirPropiedadSnapshot(solicitud, "calculo_autorizado", autorizado.Value);
            return autorizado;
        }

        return null;
    }

    private static JsonElement SerializarOpciones(IEnumerable<SolicitudOpcion> opciones)
    {
        var lista = opciones
            .OrderBy(o => o.IdOpcion)
            .Select(o => new Dictionary<string, object?>
            {
                ["id_opcion"] = o.IdOpcion,
                ["tipo"] = o.Tipo,
                ["linea"] = o.Linea,
                ["precio"] = o.Precio,
                ["moneda"] = o.Moneda,
                ["url_compra"] = o.UrlCompra,
                ["fuente"] = o.Fuente,
                ["fue_elegida"] = o.FueElegida,
                ["ruta_captura"] = o.RutaCaptura,
                ["datos"] = ParsearDatosJson(o.DatosJson),
            })
            .ToList();

        return JsonSerializer.SerializeToElement(lista);
    }

    private static void GuardarResumenAutorizado(
        Solicitud solicitud,
        IEnumerable<SolicitudOpcion> opciones,
        JsonElement? calculo)
    {
        var elegidas = opciones.Where(o => o.FueElegida).ToList();

        decimal? autobus = SumarOpciones(elegidas, "autobus");
        decimal? avion = SumarOpciones(elegidas, "vuelo", "avion");
        decimal? hospedaje = SumarOpciones(elegidas, "hotel");
        decimal? taxi = SumarOpciones(elegidas, "taxi");
        decimal? gasolina = null;
        decimal? casetas = null;
        var desglosaAuto = EsModoPropio(calculo);
        foreach (var opcion in elegidas.Where(o =>
            o.Precio.HasValue
            && (string.Equals(o.Tipo, "auto", StringComparison.OrdinalIgnoreCase)
                || string.Equals(o.Tipo, "renta", StringComparison.OrdinalIgnoreCase))))
        {
            var componentes = desglosaAuto ? LeerComponentesAuto(opcion) : null;
            if (componentes is null)
            {
                gasolina = (gasolina ?? 0m) + opcion.Precio!.Value;
            }
            else
            {
                gasolina = (gasolina ?? 0m) + componentes.Combustible;
                casetas = (casetas ?? 0m) + componentes.Casetas;
            }
        }

        decimal? comida = LeerDecimal(ParsearDatosJson(solicitud.DatosJson), "comida");
        var conceptos = new[] { autobus, avion, gasolina, casetas, hospedaje, comida, taxi };
        decimal? total = conceptos.Any(c => c.HasValue)
            ? conceptos.Sum(c => c ?? 0m)
            : null;

        EscribirPropiedadSnapshot(
            solicitud,
            "resumen_autorizado",
            JsonSerializer.SerializeToElement(new
            {
                autobus,
                avion,
                gasolina,
                casetas,
                hospedaje,
                comida,
                taxi,
                total,
            }));
    }

    private sealed record ComponentesAuto(decimal Combustible, decimal Casetas);

    private static ComponentesAuto? LeerComponentesAuto(SolicitudOpcion opcion)
    {
        if (!string.Equals(opcion.Tipo, "auto", StringComparison.OrdinalIgnoreCase)
            || opcion.Precio is not { } precio
            || string.IsNullOrWhiteSpace(opcion.DatosJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(opcion.DatosJson);
            var datos = doc.RootElement;
            if (datos.ValueKind != JsonValueKind.Object
                || !datos.TryGetProperty("combustible", out var combustibleEl)
                || combustibleEl.ValueKind != JsonValueKind.Number
                || !combustibleEl.TryGetDecimal(out var combustible)
                || !datos.TryGetProperty("casetas_estimadas", out var casetasEl)
                || casetasEl.ValueKind != JsonValueKind.Number
                || !casetasEl.TryGetDecimal(out var casetas)
                || !datos.TryGetProperty("source", out var sourceEl)
                || sourceEl.ValueKind != JsonValueKind.String
                || string.IsNullOrWhiteSpace(sourceEl.GetString())
                || combustible < 0
                || casetas < 0
                || Math.Abs(combustible + casetas - precio) > 0.02m)
            {
                return null;
            }
            return new ComponentesAuto(combustible, casetas);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static decimal? SumarOpciones(IEnumerable<SolicitudOpcion> opciones, params string[] tipos)
    {
        decimal? total = null;
        foreach (var opcion in opciones)
        {
            if (opcion.Precio is not { } precio)
            {
                continue;
            }

            var tipo = opcion.Tipo?.Trim();
            if (!tipos.Any(t => string.Equals(t, tipo, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            total = (total ?? 0m) + precio;
        }

        return total;
    }

    private static bool EsModoPropio(JsonElement? calculo)
        => calculo is { ValueKind: JsonValueKind.Object } raiz
           && LeerTextoDesdeJson(raiz, "modo_transporte") is { } modo
           && string.Equals(modo, "propio", StringComparison.OrdinalIgnoreCase);

    private static JsonElement? LeerPropiedadSnapshot(string? datosJson, string clave)
    {
        if (string.IsNullOrWhiteSpace(datosJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                   && doc.RootElement.TryGetProperty(clave, out var valor)
                ? valor.Clone()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static void EscribirPropiedadSnapshot(Solicitud solicitud, string clave, JsonElement valor)
    {
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
                    if (prop.NameEquals(clave)) continue;
                    prop.WriteTo(writer);
                }
                writer.WritePropertyName(clave);
                valor.WriteTo(writer);
                writer.WriteEndObject();
            }
            solicitud.DatosJson = System.Text.Encoding.UTF8.GetString(buffer.ToArray());
        }
        catch (JsonException)
        {
            solicitud.DatosJson = JsonSerializer.Serialize(new Dictionary<string, JsonElement>
            {
                [clave] = valor,
            });
        }
    }

    private static JsonElement? ParsearDatosJson(string? datosJson)
    {
        if (string.IsNullOrWhiteSpace(datosJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(datosJson);
            return doc.RootElement.ValueKind == JsonValueKind.Object
                ? doc.RootElement.Clone()
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static decimal? LeerDecimal(JsonElement? snapshot, string clave)
    {
        if (snapshot is not { } raiz
            || !raiz.TryGetProperty(clave, out var elemento)
            || elemento.ValueKind != JsonValueKind.Number)
        {
            return null;
        }

        return elemento.TryGetDecimal(out var valor) ? valor : null;
    }

    private static decimal? LeerConcepto(JsonElement? snapshot, string clave)
    {
        if (snapshot is { } raiz
            && raiz.TryGetProperty("resumen_autorizado", out var resumen)
            && resumen.ValueKind == JsonValueKind.Object
            && resumen.TryGetProperty(clave, out var valorAutorizado))
        {
            return valorAutorizado.ValueKind == JsonValueKind.Number
                   && valorAutorizado.TryGetDecimal(out var numero)
                ? numero
                : null;
        }

        return LeerDecimal(snapshot, clave);
    }

    private static decimal? LeerTotalDesdeJson(JsonElement? snapshot)
        => LeerConcepto(snapshot, "total");

    private static decimal? TotalDeOpcionesElegidas(IEnumerable<(decimal? Precio, string? Moneda)> opciones)
    {
        var conPrecio = opciones.Where(o => o.Precio.HasValue).ToList();
        if (conPrecio.Count == 0)
        {
            return null;
        }

        var monedas = conPrecio
            .Select(o => string.IsNullOrWhiteSpace(o.Moneda) ? "MXN" : o.Moneda!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (monedas.Count > 1)
        {
            return null;
        }

        return conPrecio.Sum(o => o.Precio!.Value);
    }

    private static string? LeerTextoDesdeJson(JsonElement? snapshot, string clave)
    {
        if (snapshot is not { } raiz
            || !raiz.TryGetProperty(clave, out var elemento)
            || elemento.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var valor = elemento.GetString()?.Trim();
        return string.IsNullOrWhiteSpace(valor) ? null : valor;
    }

    private static string? LeerOrigenDesdeJson(JsonElement? snapshot)
    {
        if (snapshot is not { } raiz)
        {
            return null;
        }

        var texto = LeerTextoDesdeJson(raiz, "origen");
        if (texto is not null)
        {
            return texto;
        }

        return raiz.TryGetProperty("origen", out var origen) && origen.ValueKind == JsonValueKind.Object
            ? LeerPunto(origen)
            : null;
    }

    private static string? LeerDestinosDesdeJson(JsonElement? snapshot)
    {
        var puntos = LeerPuntosDestino(snapshot);
        return puntos.Count > 0 ? string.Join(" - ", puntos) : null;
    }

    private static List<string> LeerPuntosDestino(JsonElement? snapshot)
    {
        var puntos = new List<string>();
        if (snapshot is not { } raiz)
        {
            return puntos;
        }

        var texto = LeerTextoDesdeJson(raiz, "destino");
        if (texto is not null)
        {
            puntos.Add(texto);
            return puntos;
        }

        if (!raiz.TryGetProperty("destinos", out var destinos) || destinos.ValueKind != JsonValueKind.Array)
        {
            return puntos;
        }

        foreach (var destino in destinos.EnumerateArray())
        {
            var punto = LeerPunto(destino);
            if (punto is not null && !puntos.Contains(punto, StringComparer.OrdinalIgnoreCase))
            {
                puntos.Add(punto);
            }
        }

        return puntos;
    }

    private static string? LeerPunto(JsonElement contenedor)
    {
        var punto = contenedor.TryGetProperty("punto", out var anidado) && anidado.ValueKind == JsonValueKind.Object
            ? anidado
            : contenedor;

        return LeerTextoDesdeJson(punto, "municipio") ?? LeerTextoDesdeJson(punto, "nombre");
    }

    private static bool TieneCalculo(JsonElement? snapshot)
        => snapshot is { } raiz
           && raiz.TryGetProperty("calculo", out var calculo)
           && calculo.ValueKind == JsonValueKind.Object;

    private static JsonElement? LeerObjeto(JsonElement? snapshot, string clave)
    {
        if (snapshot is not { } raiz
            || !raiz.TryGetProperty(clave, out var valor)
            || valor.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return valor;
    }

    private static JsonElement? LeerCalculo(JsonElement? snapshot)
        => LeerObjeto(snapshot, "calculo_autorizado") ?? LeerObjeto(snapshot, "calculo");

    private static List<JsonElement> LeerTramos(JsonElement? calculo)
    {
        var tramos = new List<JsonElement>();
        if (calculo is not { } raiz
            || !raiz.TryGetProperty("tramos", out var lista)
            || lista.ValueKind != JsonValueKind.Array)
        {
            return tramos;
        }

        foreach (var tramo in lista.EnumerateArray())
        {
            if (tramo.ValueKind == JsonValueKind.Object)
            {
                tramos.Add(tramo);
            }
        }

        return tramos;
    }

    private static bool EsPersonaMia(JsonElement? snapshot)
    {
        var modo = LeerTextoDesdeJson(LeerObjeto(snapshot, "persona"), "modo");
        return modo is null || string.Equals(modo, "mia", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HayRetorno(JsonElement? snapshot)
    {
        var retorno = LeerObjeto(snapshot, "retorno");
        return retorno is { } objeto
               && objeto.TryGetProperty("necesario", out var necesario)
               && necesario.ValueKind == JsonValueKind.True;
    }

    private static string ResolverTipoTransporte(
        JsonElement? snapshot,
        IReadOnlyCollection<string>? tiposOpcion)
    {
        if (LeerDecimal(snapshot, "avion") is not null)
        {
            return "aereo";
        }

        if (LeerDecimal(snapshot, "autobus") is not null)
        {
            return "autobus";
        }

        if (LeerDecimal(snapshot, "gasolina") is not null
            || LeerDecimal(snapshot, "vehiculo_propio") is not null)
        {
            return "propio";
        }

        var tipos = (tiposOpcion ?? Array.Empty<string>())
            .Select(tipo => tipo.Trim().ToLowerInvariant())
            .ToList();
        if (tipos.Contains("vuelo") || tipos.Contains("avion"))
        {
            return "aereo";
        }

        if (tipos.Contains("autobus"))
        {
            return "autobus";
        }

        if (tipos.Contains("auto") || tipos.Contains("renta"))
        {
            return "propio";
        }

        var modo = LeerTextoDesdeJson(LeerCalculo(snapshot), "modo_transporte")
                   ?? LeerTextoDesdeJson(LeerObjeto(snapshot, "transporte"), "modo");
        if (string.Equals(modo, "propio", StringComparison.OrdinalIgnoreCase))
        {
            return "propio";
        }

        if (string.Equals(modo, "solicitado", StringComparison.OrdinalIgnoreCase))
        {
            return "solicitado";
        }

        return "sin-clasificar";
    }

    private static List<TrayectoBandejaDto> ComponerTrayectos(
        JsonElement? snapshot,
        string? fechaSalida,
        string? fechaRegreso)
    {
        var trayectos = new List<TrayectoBandejaDto>();
        var tramos = LeerTramos(LeerCalculo(snapshot));
        var origen = LeerOrigenDesdeJson(snapshot);
        var destinos = LeerPuntosDestino(snapshot);

        var ida = new TrayectoBandejaDto
        {
            Fecha = fechaSalida,
            Origen = origen,
            Destino = destinos.Count > 0 ? destinos[0] : null,
        };
        var vuelta = new TrayectoBandejaDto
        {
            Fecha = fechaRegreso,
            Origen = destinos.Count > 0 ? destinos[^1] : null,
            Destino = origen,
        };

        if (tramos.Count > 0)
        {
            var primerTramo = tramos[0];
            ida.Fecha = LeerTextoDesdeJson(primerTramo, "salida_fecha") ?? ida.Fecha;
            ida.Hora = LeerTextoDesdeJson(primerTramo, "salida_hora");
            ida.Origen = LeerTextoDesdeJson(primerTramo, "de") ?? ida.Origen;
            ida.Destino = LeerTextoDesdeJson(primerTramo, "a") ?? ida.Destino;
        }

        if (tramos.Count > 1)
        {
            var ultimoTramo = tramos[^1];
            vuelta.Fecha = LeerTextoDesdeJson(ultimoTramo, "salida_fecha") ?? vuelta.Fecha;
            vuelta.Hora = LeerTextoDesdeJson(ultimoTramo, "salida_hora");
            vuelta.Origen = LeerTextoDesdeJson(ultimoTramo, "de") ?? vuelta.Origen;
            var destinoCalculado = LeerTextoDesdeJson(ultimoTramo, "a");
            if (destinoCalculado is not null
                && !string.Equals(destinoCalculado, "Regreso al origen", StringComparison.OrdinalIgnoreCase))
            {
                vuelta.Destino = destinoCalculado;
            }
        }

        if (TieneDatosTrayecto(ida))
        {
            trayectos.Add(ida);
        }

        if (TieneDatosTrayecto(vuelta) && (tramos.Count > 1 || HayRetorno(snapshot)))
        {
            trayectos.Add(vuelta);
        }

        return trayectos;
    }

    private static bool TieneDatosTrayecto(TrayectoBandejaDto trayecto)
        => trayecto.Fecha is not null
           || trayecto.Hora is not null
           || trayecto.Origen is not null
           || trayecto.Destino is not null;

    private static string? ComponerRangoFecha(string? salida, string? regreso)
    {
        var salidaTexto = FormatearFecha(salida);
        var regresoTexto = FormatearFecha(regreso);

        return (salidaTexto, regresoTexto) switch
        {
            (null, null) => null,
            (not null, null) => salidaTexto,
            (null, not null) => regresoTexto,
            _ => $"{salidaTexto} AL {regresoTexto}",
        };

        static string? FormatearFecha(string? valor)
            => valor is not null
               && DateOnly.TryParse(valor, CultureInfo.InvariantCulture, out var fecha)
                ? fecha.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)
                : valor;
    }

    private static (string? Salida, string? Regreso) LeerRangoViajeDesdeJson(JsonElement? snapshot)
    {
        if (snapshot is { } raiz)
        {
            if (raiz.TryGetProperty("rango", out var rango) && rango.ValueKind == JsonValueKind.Object)
            {
                var inicio = LeerTextoDesdeJson(rango, "inicio");
                var fin = LeerTextoDesdeJson(rango, "fin");
                if (inicio is not null || fin is not null)
                {
                    return (inicio, fin);
                }
            }

            var salida = LeerTextoDesdeJson(raiz, "fecha_salida");
            var regreso = LeerTextoDesdeJson(raiz, "fecha_regreso");
            if (salida is not null || regreso is not null)
            {
                return (salida, regreso);
            }

            if (raiz.TryGetProperty("destinos", out var destinos) && destinos.ValueKind == JsonValueKind.Array)
            {
                var dias = new List<string>();
                foreach (var destino in destinos.EnumerateArray())
                {
                    var dia = LeerTextoDesdeJson(destino, "debeEstarFecha")
                              ?? LeerTextoDesdeJson(destino, "saleFecha");
                    if (dia is not null)
                    {
                        dias.Add(dia);
                    }
                }

                if (dias.Count > 0)
                {
                    dias.Sort(StringComparer.Ordinal);
                    return (dias[0], dias[^1]);
                }
            }
        }

        return (null, null);
    }
}
