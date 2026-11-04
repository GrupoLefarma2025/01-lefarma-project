using System.Security.Claims;
using Lefarma.API.Features.Configuracion.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Administración de variables globales de configuración: CRUD, bitácora,
/// restauración de versiones y sincronización con el frontend.
/// </summary>
[ApiController]
[Route("api/configuracion/variables")]
[EndpointGroupName("Configuracion")]
[Authorize]
public class ConfiguracionController : ControllerBase
{
    private readonly IConfiguracionService _service;

    public ConfiguracionController(IConfiguracionService service)
    {
        _service = service;
    }

    /// <summary>Lista las variables de configuración con filtros opcionales.</summary>
    [HttpGet]
    [HasPermission(Permissions.Configuracion.View)]
    [SwaggerOperation(
        Summary = "Listar variables de configuración",
        Description = "Devuelve las variables globales ordenadas por clave. Filtros opcionales: buscar, tipo, destino y activo.")]
    [SwaggerResponse(200, "Variables obtenidas", typeof(ApiResponse<List<ConfigVariableResponse>>))]
    [SwaggerResponse(403, "Sin permiso configuracion.view")]
    public async Task<IActionResult> Listar(
        [FromQuery] string? buscar,
        [FromQuery] string? tipo,
        [FromQuery] string? destino,
        [FromQuery] bool? activo,
        CancellationToken ct)
    {
        var filtros = new ConfiguracionFiltros
        {
            Buscar = buscar,
            Tipo = tipo,
            Destino = destino,
            Activo = activo
        };

        var result = await _service.ListarAsync(filtros, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<List<ConfigVariableResponse>>
        {
            Success = true,
            Message = "Variables de configuración obtenidas exitosamente.",
            Data = data
        }));
    }

    /// <summary>Obtiene una variable por su identificador.</summary>
    [HttpGet("{id:long}")]
    [HasPermission(Permissions.Configuracion.View)]
    [SwaggerOperation(
        Summary = "Obtener una variable de configuración",
        Description = "Devuelve el detalle de una variable global por su identificador.")]
    [SwaggerResponse(200, "Variable obtenida", typeof(ApiResponse<ConfigVariableResponse>))]
    [SwaggerResponse(404, "Variable no encontrada")]
    public async Task<IActionResult> Obtener(long id, CancellationToken ct)
    {
        var result = await _service.ObtenerAsync(id, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigVariableResponse>
        {
            Success = true,
            Message = "Variable de configuración obtenida exitosamente.",
            Data = data
        }));
    }

    /// <summary>Crea una variable de configuración.</summary>
    [HttpPost]
    [HasPermission(Permissions.Configuracion.Create)]
    [SwaggerOperation(
        Summary = "Crear variable de configuración",
        Description = "Crea una variable global. Requiere clave y tipo de dato inmutables, valor JSON válido y al menos un destino.")]
    [SwaggerResponse(200, "Variable creada", typeof(ApiResponse<ConfigVariableResponse>))]
    [SwaggerResponse(400, "Datos inválidos")]
    [SwaggerResponse(409, "La clave ya existe")]
    public async Task<IActionResult> Crear(
        [FromBody] CreateConfigVariableRequest request,
        CancellationToken ct)
    {
        var result = await _service.CrearAsync(request, ObtenerIdUsuario(), ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigVariableResponse>
        {
            Success = true,
            Message = "Variable de configuración creada exitosamente.",
            Data = data
        }));
    }

    /// <summary>Actualiza una variable de configuración existente.</summary>
    [HttpPut("{id:long}")]
    [HasPermission(Permissions.Configuracion.Update)]
    [SwaggerOperation(
        Summary = "Actualizar variable de configuración",
        Description = "Actualiza nombre, descripción, valor, esquema y disponibilidades. La clave y el tipo de dato no se pueden cambiar. Valida versionEsperada (409 si difiere).")]
    [SwaggerResponse(200, "Variable actualizada", typeof(ApiResponse<ConfigVariableResponse>))]
    [SwaggerResponse(400, "Datos inválidos o intento de cambiar clave/tipo")]
    [SwaggerResponse(404, "Variable no encontrada")]
    [SwaggerResponse(409, "Conflicto de versión")]
    public async Task<IActionResult> Actualizar(
        long id,
        [FromBody] UpdateConfigVariableRequest request,
        CancellationToken ct)
    {
        var result = await _service.ActualizarAsync(id, request, ObtenerIdUsuario(), ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigVariableResponse>
        {
            Success = true,
            Message = "Variable de configuración actualizada exitosamente.",
            Data = data
        }));
    }

    /// <summary>Desactiva una variable (nunca se elimina físicamente).</summary>
    [HttpPost("{id:long}/desactivar")]
    [HasPermission(Permissions.Configuracion.Update)]
    [SwaggerOperation(
        Summary = "Desactivar variable de configuración",
        Description = "Marca la variable como inactiva y registra la acción en la bitácora. No borra el registro.")]
    [SwaggerResponse(200, "Variable desactivada", typeof(ApiResponse<ConfigVariableResponse>))]
    [SwaggerResponse(404, "Variable no encontrada")]
    [SwaggerResponse(409, "Conflicto de versión")]
    public async Task<IActionResult> Desactivar(
        long id,
        [FromBody] CambiarEstadoVariableRequest request,
        CancellationToken ct)
    {
        var result = await _service.DesactivarAsync(id, request, ObtenerIdUsuario(), ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigVariableResponse>
        {
            Success = true,
            Message = "Variable de configuración desactivada exitosamente.",
            Data = data
        }));
    }

    /// <summary>Reactiva una variable desactivada.</summary>
    [HttpPost("{id:long}/reactivar")]
    [HasPermission(Permissions.Configuracion.Update)]
    [SwaggerOperation(
        Summary = "Reactivar variable de configuración",
        Description = "Marca la variable como activa y registra la acción en la bitácora.")]
    [SwaggerResponse(200, "Variable reactivada", typeof(ApiResponse<ConfigVariableResponse>))]
    [SwaggerResponse(404, "Variable no encontrada")]
    [SwaggerResponse(409, "Conflicto de versión")]
    public async Task<IActionResult> Reactivar(
        long id,
        [FromBody] CambiarEstadoVariableRequest request,
        CancellationToken ct)
    {
        var result = await _service.ReactivarAsync(id, request, ObtenerIdUsuario(), ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigVariableResponse>
        {
            Success = true,
            Message = "Variable de configuración reactivada exitosamente.",
            Data = data
        }));
    }

    /// <summary>Historial de cambios de una variable (más reciente primero).</summary>
    [HttpGet("{id:long}/historial")]
    [HasPermission(Permissions.Configuracion.History)]
    [SwaggerOperation(
        Summary = "Historial de una variable",
        Description = "Lista las entradas de bitácora de la variable ordenadas de la más reciente a la más antigua.")]
    [SwaggerResponse(200, "Historial obtenido", typeof(ApiResponse<List<BitacoraResumenResponse>>))]
    [SwaggerResponse(404, "Variable no encontrada")]
    public async Task<IActionResult> Historial(long id, CancellationToken ct)
    {
        var result = await _service.ObtenerHistorialAsync(id, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<List<BitacoraResumenResponse>>
        {
            Success = true,
            Message = "Historial de la variable obtenido exitosamente.",
            Data = data
        }));
    }

    /// <summary>Detalle de una entrada de bitácora.</summary>
    [HttpGet("{id:long}/historial/{idBitacora:long}")]
    [HasPermission(Permissions.Configuracion.History)]
    [SwaggerOperation(
        Summary = "Detalle de una entrada de bitácora",
        Description = "Devuelve los snapshots anterior y nuevo de una revisión concreta.")]
    [SwaggerResponse(200, "Entrada obtenida", typeof(ApiResponse<BitacoraDetalleResponse>))]
    [SwaggerResponse(404, "Entrada no encontrada")]
    public async Task<IActionResult> HistorialDetalle(long id, long idBitacora, CancellationToken ct)
    {
        var result = await _service.ObtenerHistorialDetalleAsync(id, idBitacora, ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<BitacoraDetalleResponse>
        {
            Success = true,
            Message = "Entrada de bitácora obtenida exitosamente.",
            Data = data
        }));
    }

    /// <summary>Restaura una versión anterior como un cambio nuevo.</summary>
    [HttpPost("{id:long}/restaurar")]
    [HasPermission(Permissions.Configuracion.Restore)]
    [SwaggerOperation(
        Summary = "Restaurar una versión de la variable",
        Description = "Aplica nombre, descripción, valor, esquema y disponibilidades de la revisión indicada. Conserva clave y tipo de dato, incrementa la versión y registra una nueva entrada de bitácora con la acción restaurar.")]
    [SwaggerResponse(200, "Versión restaurada", typeof(ApiResponse<ConfigVariableResponse>))]
    [SwaggerResponse(400, "La versión no es válida con el tipo actual")]
    [SwaggerResponse(404, "Variable o entrada de bitácora no encontrada")]
    [SwaggerResponse(409, "Conflicto de versión")]
    public async Task<IActionResult> Restaurar(
        long id,
        [FromBody] RestaurarVariableRequest request,
        CancellationToken ct)
    {
        var result = await _service.RestaurarAsync(id, request, ObtenerIdUsuario(), ct);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ConfigVariableResponse>
        {
            Success = true,
            Message = "Versión de la variable restaurada exitosamente.",
            Data = data
        }));
    }

    private int? ObtenerIdUsuario()
        => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) && id > 0
            ? id
            : null;
}
