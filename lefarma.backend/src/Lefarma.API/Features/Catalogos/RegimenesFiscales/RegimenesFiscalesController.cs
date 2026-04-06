using FluentValidation;
using Lefarma.API.Features.Catalogos.RegimenesFiscales;
using Lefarma.API.Features.Catalogos.RegimenesFiscales.DTOs;
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
// [HasPermission(Permissions.Catalogos.View)]
public class RegimenesFiscalesController : ControllerBase
{
    private readonly IRegimenFiscalService _regimenFiscalService;

    public RegimenesFiscalesController(IRegimenFiscalService regimenFiscalService)
    {
        _regimenFiscalService = regimenFiscalService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los regímenes fiscales", Description = "Retorna el catálogo SAT de regímenes fiscales")]
    public async Task<IActionResult> GetAll([FromQuery] RegimenFiscalRequest query)
    {
        var result = await _regimenFiscalService.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<RegimenFiscalResponse>>
        {
            Success = true,
            Message = "Regímenes fiscales obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener régimen fiscal por ID", Description = "Retorna un régimen fiscal específico por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único del régimen fiscal", Required = true)] int id)
    {
        var result = await _regimenFiscalService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<RegimenFiscalResponse>
        {
            Success = true,
            Message = "Régimen fiscal obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nuevo régimen fiscal", Description = "Crea un régimen fiscal con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos del régimen fiscal a crear", Required = true)] CreateRegimenFiscalRequest request)
    {
        var result = await _regimenFiscalService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdRegimenFiscal },
            new ApiResponse<RegimenFiscalResponse>
            {
                Success = true,
                Message = "Régimen fiscal creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar régimen fiscal", Description = "Actualiza los datos de un régimen fiscal existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador del régimen fiscal a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados del régimen fiscal", Required = true)] UpdateRegimenFiscalRequest request)
    {
        var result = await _regimenFiscalService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<RegimenFiscalResponse>
        {
            Success = true,
            Message = "Régimen fiscal actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar régimen fiscal", Description = "Elimina un régimen fiscal por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador del régimen fiscal a eliminar", Required = true)] int id)
    {
        var result = await _regimenFiscalService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Régimen fiscal eliminado exitosamente.",
            Data = null
        }));
    }
}
