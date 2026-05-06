using ErrorOr;
using Lefarma.API.Features.OrdenesCompra.Firmas;
using Lefarma.API.Features.OrdenesCompra.Firmas.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.OrdenesCompra.Integraciones
{
    [ApiController]
    [Route("api/ordenes/envio-concentrado")]
    public class EnvioConcentradoExternoController : ControllerBase
    {
        private readonly IFirmasService _firmasService;

        public EnvioConcentradoExternoController(IFirmasService firmasService)
        {
            _firmasService = firmasService;
        }

        [HttpPost("respuesta")]
        public async Task<IActionResult> RecibirRespuesta([FromBody] RespuestaConcentradoExternoRequest request)
        {
            var result = await _firmasService.ProcesarRespuestaConcentradoAsync(request);
            return result.Match(
                onValue: response => Ok(new { exitoso = response.Fallidas == 0, response }),
                onError: errors => Problem(errors.First().Description, statusCode: 400)
            );
        }
    }
}
