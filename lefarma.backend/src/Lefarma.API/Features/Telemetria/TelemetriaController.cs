using Lefarma.API.Features.Telemetria.Almacen;
using Lefarma.API.Features.Telemetria.Cola;
using Lefarma.API.Features.Telemetria.Escritor;
using Lefarma.API.Features.Telemetria.Ingesta;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Telemetria;

[ApiController]
[Route("api/telemetria")]
[EndpointGroupName("Telemetria")]
public sealed class TelemetriaController : ControllerBase
{
    private readonly TelemetriaRepositorio _repositorio;
    private readonly TelemetriaOpciones _opciones;
    private readonly TelemetriaCola _cola;
    private readonly TelemetriaEscritor _escritor;
    private readonly TelemetriaIngesta _ingesta;

    public TelemetriaController(
        TelemetriaRepositorio repositorio,
        IOptions<TelemetriaOpciones> opciones,
        TelemetriaCola cola,
        TelemetriaEscritor escritor,
        TelemetriaIngesta ingesta)
    {
        _repositorio = repositorio;
        _opciones = opciones.Value;
        _cola = cola;
        _escritor = escritor;
        _ingesta = ingesta;
    }

    [HttpGet("estado")]
    [Authorize]
    [SwaggerOperation(
        Summary = "Estado del módulo de telemetría",
        Description = "Base de datos destino, filas por tabla, cola pendiente y contadores del escritor.")]
    public async Task<ActionResult<ApiResponse<EstadoTelemetria>>> GetEstado(CancellationToken cancellationToken)
    {
        var almacen = await _repositorio.ObtenerEstadoAsync(_opciones.Habilitada, cancellationToken);

        var estado = new EstadoTelemetria(
            almacen,
            _cola.ObtenerEstado(),
            _escritor.ObtenerEstado(),
            DateTime.UtcNow);

        return Ok(new ApiResponse<EstadoTelemetria>
        {
            Success = true,
            Message = "Estado del módulo de telemetría.",
            Data = estado
        });
    }

    [HttpPost("eventos")]
    [Authorize]
    [EnableRateLimiting(TelemetriaRateLimit.Politica)]
    [RequestSizeLimit(262_144)]
    [SwaggerOperation(
        Summary = "Recibe un lote de eventos de telemetría",
        Description = "Errores, clics, mapa de calor y visitas. El usuario se toma del token y se guarda seudonimizado.")]
    [ProducesResponseType(typeof(ApiResponse<RespuestaIngesta>), StatusCodes.Status202Accepted)]
    public async Task<ActionResult<ApiResponse<RespuestaIngesta>>> PostEventos([FromBody] SobreTelemetriaDto sobre, CancellationToken cancellationToken)
    {
        var resultado = await _ingesta.IngresarAsync(sobre, User, anonimo: false, cancellationToken);
        return Aceptado(resultado);
    }

    [HttpPost("eventos-anonimos")]
    [AllowAnonymous]
    [EnableRateLimiting(TelemetriaRateLimit.PoliticaAnonima)]
    [RequestSizeLimit(65_536)]
    [SwaggerOperation(
        Summary = "Recibe errores anónimos de arranque o login",
        Description = "Máximo 5 eventos por lote y solo tipo error con tipoError=arranque.")]
    [ProducesResponseType(typeof(ApiResponse<RespuestaIngesta>), StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<RespuestaIngesta>>> PostEventosAnonimos([FromBody] SobreTelemetriaDto sobre, CancellationToken cancellationToken)
    {
        var resultado = await _ingesta.IngresarAsync(sobre, User, anonimo: true, cancellationToken);
        return resultado.Resultado == ResultadoIngesta.Rechazado
            ? BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = resultado.Mensaje
            })
            : Aceptado(resultado);
    }

    private ActionResult<ApiResponse<RespuestaIngesta>> Aceptado(RespuestaIngesta resultado) =>
        StatusCode(StatusCodes.Status202Accepted, new ApiResponse<RespuestaIngesta>
        {
            Success = true,
            Message = resultado.Mensaje,
            Data = resultado
        });
}
