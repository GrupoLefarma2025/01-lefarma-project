using FluentValidation;
using Lefarma.API.Features.Catalogos.EstatusOrden;
using Lefarma.API.Features.Catalogos.EstatusOrden.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Catalogos;
[Route("api/catalogos/[controller]")]
[ApiController]
[EndpointGroupName("Catalogos")]
//[HasPermission(Permissions.Catalogos.View)]
public class EstatusOrdenController : ControllerBase
{
    private readonly IEstatusOrdenService _estatusOrdenService;

    public EstatusOrdenController(IEstatusOrdenService estatusOrdenService)
    {
        _estatusOrdenService = estatusOrdenService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los estatus de orden", Description = "Retorna la lista completa de estatus de orden (READ-ONLY)")]
    public async Task<IActionResult> GetAll([FromQuery] EstatusOrdenRequest query)
    {
        var result = await _estatusOrdenService.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<EstatusOrdenResponse>>
        {
            Success = true,
            Message = "Estatus de orden obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener estatus de orden por ID", Description = "Retorna un estatus de orden específico por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único del estatus de orden", Required = true)] int id)
    {
        var result = await _estatusOrdenService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<EstatusOrdenResponse>
        {
            Success = true,
            Message = "Estatus de orden obtenido exitosamente.",
            Data = data
        }));
    }
}
