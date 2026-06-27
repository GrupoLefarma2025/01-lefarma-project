    using System.Security.Claims;
    using Lefarma.API.Features.OrdenesCompra.Firmas;
    using Lefarma.API.Features.OrdenesCompra.Firmas.DTOs;
    using Lefarma.API.Shared.Extensions;
    using Lefarma.API.Shared.Models;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;

    namespace Lefarma.API.Features.OrdenesCompra.Integraciones
    {
        [Route("api/ordenes/envio-concentrado")]
        [ApiController]
        [Authorize]
        public class EnvioConcentradoExternoController : ControllerBase
        {
            private readonly IFirmasService _firmasService;

            public EnvioConcentradoExternoController(IFirmasService firmasService)
            {
                _firmasService = firmasService;
            }

            private int GetUserId() =>
                int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

            [HttpPost("pdf")]
            public async Task<IActionResult> EnvioConcentradoConPdf([FromForm] EnvioConcentradoConPdfRequest request)
            {
                var result = await _firmasService.EnvioConcentradoConPdfAsync(request, GetUserId());
                return result.ToActionResult(this, data => Ok(new ApiResponse<EnvioConcentradoResponse>
                {
                    Success = true,
                    Message = "Envio concentrado completado.",
                    Data = data
                }));
            }

            [HttpPost("respuesta")]
            [AllowAnonymous]
            public async Task<IActionResult> RecibirRespuesta(RespuestaConcentradoExternoRequest request)
            {
                var result = await _firmasService.ProcesarRespuestaConcentradoAsync(request);
                return result.ToActionResult(this, data => Ok(new ApiResponse<RespuestaConcentradoResponse>
                {
                    Success = true,
                    Message = "Respuesta procesada.",
                    Data = data
                }));
            }
        }
    }
