using System.Globalization;
using System.Text.Json;
using Lefarma.API.Domain.Entities.Viaticos;
using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Endpoints de la bandeja de aprobacion de solicitudes de viaticos
/// (autorizar / rechazar / ajustar). El resto del ciclo de vida del
/// wizard vive en <c>SolicitudesController</c>; este controller solo
/// expone las acciones del admin sobre solicitudes que ya estan en
/// estado <c>enviada</c> o <c>autorizada</c>.
///
/// Acceso a datos: todo va por LINQ de EF Core (igual que
/// <c>SolicitudesController</c>), no por SQL crudo. Cada endpoint
/// muta y persiste con un unico <c>SaveChangesAsync</c>, que el
/// proveedor relacional envuelve en una transaccion implicita: la
/// escritura y su evento quedan atomicos sin BEGIN/COMMIT explicito.
/// </summary>
[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class AprobacionesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;

    public AprobacionesController(ApplicationDbContext context, AsokamDbContext asokamContext)
    {
        _context = context;
        _asokamContext = asokamContext;
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
        // La bandeja es la pantalla donde se autoriza: sin el permiso no se
        // expone. Antes se recortaba a las solicitudes propias, pero eso
        // dejaba la pantalla abierta a cualquiera por URL.
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

        // Un solo query extra al directorio para resolver los nombres de
        // todos los solicitantes de la pagina (evita N+1). Se filtra por
        // EsActivo: un usuario dado de baja no debe exponer su nombre en la
        // bandeja del admin; en ese caso cae al fallback "Usuario #{id}".
        //
        // El directorio NO vive en la BD de Lefarma: `app.Usuarios` esta en la
        // BD Asokam (igual que en SolicitudesController). Consultarlo con
        // ApplicationDbContext revienta con "Invalid object name 'app.Usuarios'"
        // y la bandeja entera responde 500.
        var idsSolicitantes = filas
            .Select(f => f.IdUsuarioSolicitante)
            .Distinct()
            .ToList();

        var directorio = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => u.EsActivo && idsSolicitantes.Contains(u.IdUsuario))
            .Select(u => new { u.IdUsuario, u.NombreCompleto })
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, ct);

        var bandeja = filas.Select(f =>
        {
            // El snapshot se parsea UNA vez por fila; cada clave se lee con el
            // mismo lector tolerante (null si falta, no es numerica o el JSON
            // no parsea).
            var datos = ParsearDatosJson(f.DatosJson);
            var (fechaSalida, fechaRegreso) = LeerRangoViajeDesdeJson(datos);
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
                Gerencia = f.Gerencia,
                Estado = f.Estado,
                Destino = LeerDestinosDesdeJson(datos),
                Origen = LeerOrigenDesdeJson(datos),
                Fecha = ComponerRangoFecha(fechaSalida, fechaRegreso),
                FechaSalida = fechaSalida,
                FechaRegreso = fechaRegreso,
                Autobus = LeerDecimal(datos, "autobus"),
                Avion = LeerDecimal(datos, "avion"),
                Gasolina = LeerDecimal(datos, "gasolina"),
                Casetas = LeerDecimal(datos, "casetas"),
                VehiculoPropio = LeerDecimal(datos, "vehiculo_propio"),
                Hospedaje = LeerDecimal(datos, "hospedaje"),
                Comida = LeerDecimal(datos, "comida"),
                Taxi = LeerDecimal(datos, "taxi"),
                Total = LeerTotalDesdeJson(datos),
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
        Description = "Transiciona la solicitud de 'enviada' a 'autorizada'. Requiere viaticos.autorizar.")]
    [SwaggerResponse(200, "Solicitud autorizada", typeof(ApiResponse<object>))]
    [SwaggerResponse(403, "Sin permiso viaticos.autorizar.")]
    [SwaggerResponse(404, "Solicitud no encontrada.")]
    [SwaggerResponse(409, "La solicitud no esta en estado 'enviada'.")]
    public async Task<IActionResult> Autorizar(int id, CancellationToken ct)
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

        // Filtro por estado en el propio Update: si otra peticion movio la
        // solicitud entre la lectura y aqui, el SaveChanges no afecta filas
        // y se devuelve 409 en vez de pisar la transicion ajena.
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

        solicitud.Estado = "autorizada";
        solicitud.FechaModificacion = ahora;
        _context.SolicitudEventos.Add(NuevoEvento(id, "autorizada", null, idUsuario, ahora));

        await _context.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Solicitud autorizada exitosamente.",
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

        // Un ajuste sin `campo` no dice QUE se cambio: se guardaria una fila
        // vacia que el historial no puede mostrar. Mismo criterio que el motivo.
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

        // valor_anterior se conserva: el INSERT agrega una fila nueva, no
        // toca ninguna anterior. Si id_opcion = 0 se persiste NULL (ajuste
        // a un campo del wizard, no a una opcion concreta).
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

        // Solo cambia el estado si seguimos en 'autorizada'; si ya esta
        // en 'autorizada_con_ajustes' se queda.
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

    // -------- helpers --------

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

    // -------- lectura tolerante del snapshot datos_json --------

    /// <summary>
    /// Parsea <c>solicitudes.datos_json</c> una sola vez por fila. Se lee en
    /// memoria a proposito: la version anterior usaba
    /// <c>ISNULL(TRY_CAST(JSON_VALUE(...) AS DECIMAL(18,2)), 0)</c> sobre
    /// SQL crudo, pero EF Core no traduce <c>JSON_VALUE</c> a una expresion
    /// LINQ consultable. El filtro y el orden de la bandeja siguen siendo
    /// 100% traducibles a SQL; solo la proyeccion del snapshot se resuelve en
    /// el cliente. NO "optimizar" esto de vuelta a SQL crudo.
    /// Devuelve <c>null</c> —nunca lanza— si el JSON es vacio, invalido o la
    /// raiz no es un objeto: un snapshot incompleto no rompe la bandeja.
    /// </summary>
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

    /// <summary>
    /// Lee una clave numerica del snapshot (<c>$.clave</c>). Devuelve
    /// <c>null</c> si la clave no existe, no es un numero o el JSON no parseo:
    /// el concentrado FOR-008 imprime "—" para <c>null</c> y NUNCA un $0.00
    /// inventado. Lo usan tanto el desglose por concepto como el total.
    /// </summary>
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

    /// <summary>
    /// Total de la bandeja: <c>$.total</c>. <c>null</c> significa "no se conoce"
    /// (la clave no existe, no es numerica o el JSON no parsea): el concentrado
    /// lo imprime como "—" y NUNCA lo coacciona a un $0.00 inventado. Nunca
    /// lanza.
    /// </summary>
    private static decimal? LeerTotalDesdeJson(JsonElement? snapshot)
        => LeerDecimal(snapshot, "total");

    /// <summary>
    /// Extrae una clave de texto del snapshot <c>solicitudes.datos_json</c>
    /// (<c>$.destino</c>, <c>$.origen</c>, <c>$.fecha_salida</c>, ...). Es el
    /// unico lector de strings del snapshot: lo comparten el destino, el origen
    /// y las fechas del viaje. Devuelve <c>null</c> —nunca lanza— si el JSON es
    /// vacio, invalido, no es un objeto o la clave no es un string no vacio: la
    /// bandeja no se rompe por un snapshot incompleto.
    /// </summary>
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

    /// <summary>
    /// <summary>
    /// Origen de la ruta. El snapshot actual (<c>solicitud-v2</c>) lo guarda
    /// como objeto (<c>$.origen.punto</c>); el flujo anterior lo guardaba como
    /// texto en <c>$.origen</c>. Se lee la ciudad del punto
    /// (<c>municipio</c>, y si falta <c>nombre</c>) porque el concentrado
    /// FOR-008 imprime la ciudad, no la direccion completa. Devuelve
    /// <c>null</c> —nunca lanza— cuando no hay origen legible.
    /// </summary>
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

    /// <summary>
    /// Destinos de la ruta en una sola linea, como los imprime el FOR-008
    /// (<c>"CHIHUAHUA-CD.JUAREZ"</c>). El snapshot actual los guarda en
    /// <c>$.destinos[]</c> (cada uno con su <c>$.punto</c>); el flujo anterior
    /// usaba un unico texto en <c>$.destino</c>. Los puntos se unen con
    /// <c>" - "</c> en el orden del itinerario y sin repetir el mismo lugar.
    /// Devuelve <c>null</c> —nunca lanza— cuando no hay ningun destino legible:
    /// el concentrado imprime "—", nunca un texto inventado.
    /// </summary>
    private static string? LeerDestinosDesdeJson(JsonElement? snapshot)
    {
        if (snapshot is not { } raiz)
        {
            return null;
        }

        var texto = LeerTextoDesdeJson(raiz, "destino");
        if (texto is not null)
        {
            return texto;
        }

        if (!raiz.TryGetProperty("destinos", out var destinos) || destinos.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var puntos = new List<string>();
        foreach (var destino in destinos.EnumerateArray())
        {
            var punto = LeerPunto(destino);
            if (punto is not null && !puntos.Contains(punto, StringComparer.OrdinalIgnoreCase))
            {
                puntos.Add(punto);
            }
        }

        return puntos.Count > 0 ? string.Join(" - ", puntos) : null;
    }

    /// <summary>
    /// Ciudad de un punto del itinerario. Acepta tanto el destino completo
    /// (<c>{"punto":{...}}</c>) como el punto suelto (<c>$.origen.punto</c>).
    /// Prioriza <c>municipio</c> y cae a <c>nombre</c>: el concentrado imprime
    /// ciudades, no direcciones.
    /// </summary>
    private static string? LeerPunto(JsonElement contenedor)
    {
        var punto = contenedor.TryGetProperty("punto", out var anidado) && anidado.ValueKind == JsonValueKind.Object
            ? anidado
            : contenedor;

        return LeerTextoDesdeJson(punto, "municipio") ?? LeerTextoDesdeJson(punto, "nombre");
    }

    /// <summary>
    /// ¿El snapshot trae el cálculo de la ruta (<c>datos.calculo</c>)? Es lo que
    /// guarda el envío desde los cálculos; sin él no hay casetas, hoteles ni
    /// tiempos que revisar.
    /// </summary>
    private static bool TieneCalculo(JsonElement? snapshot)
        => snapshot is { } raiz
           && raiz.TryGetProperty("calculo", out var calculo)
           && calculo.ValueKind == JsonValueKind.Object;

    /// <summary>
    /// Rango de fechas del viaje para la columna "Fecha" del concentrado
    /// FOR-008. Se compone con el formato que documenta el componente de
    /// impresion (<c>ConcentradoViaticosPrint.tsx</c>):
    /// <c>"05/10/2026 AL 09/10/2026"</c>. Devuelve <c>null</c> —nunca lanza— si
    /// no hay ninguna fecha, no son strings o el JSON no parseo: el
    /// concentrado imprime "—". Un valor que no parsea como fecha ISO se
    /// conserva tal cual, sin perder el dato.
    /// </summary>
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

    /// <summary>
    /// Fechas reales del viaje en ISO (<c>aaaa-mm-dd</c>), en el orden en que
    /// las busca:
    /// <list type="number">
    ///   <item><c>$.rango.inicio</c>/<c>$.rango.fin</c>: el rango explicito del
    ///   wizard actual (<c>solicitud-v2</c>), la fuente que manda.</item>
    ///   <item><c>$.fecha_salida</c>/<c>$.fecha_regreso</c>: snapshots del flujo
    ///   anterior.</item>
    ///   <item>Los dias comprometidos de cada destino
    ///   (<c>$.destinos[].debeEstarFecha</c>, o <c>saleFecha</c>): el menor y el
    ///   mayor son el viaje completo.</item>
    /// </list>
    /// Devuelve <c>(null, null)</c> —nunca lanza— cuando el snapshot no trae
    /// ninguna fecha legible: el filtro por fecha de viaje no puede afirmar que
    /// ese viaje caiga en un rango.
    /// </summary>
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
