using FluentValidation;
using Lefarma.API.Features.Catalogos.Bancos;
using Lefarma.API.Features.Catalogos.Bancos.DTOs;
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
public class BancosController : ControllerBase
{
    private readonly IBancoService _bancoService;

    public BancosController(IBancoService bancoService)
    {
        _bancoService = bancoService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los bancos", Description = "Retorna la lista completa de bancos")]
    public async Task<IActionResult> GetAll()
    {
        var result = await _bancoService.GetAllAsync();

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<BancoResponse>>
        {
            Success = true,
            Message = "Bancos obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener banco por ID", Description = "Retorna un banco específico por su identificador")]
    public async Task<IActionResult> GetById(
        [FromRoute][SwaggerParameter(Description = "Identificador único del banco", Required = true)] int id)
    {
        var result = await _bancoService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<BancoResponse>
        {
            Success = true,
            Message = "Banco obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nuevo banco", Description = "Crea un banco con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [FromBody][SwaggerRequestBody(Description = "Datos del banco a crear", Required = true)] CreateBancoRequest request)
    {
        var result = await _bancoService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdBanco },
            new ApiResponse<BancoResponse>
            {
                Success = true,
                Message = "Banco creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar banco", Description = "Actualiza los datos de un banco existente")]
    public async Task<IActionResult> Update(
        [FromRoute][SwaggerParameter(Description = "Identificador del banco a actualizar", Required = true)] int id,
        [FromBody][SwaggerRequestBody(Description = "Datos actualizados del banco", Required = true)] UpdateBancoRequest request)
    {
        var result = await _bancoService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<BancoResponse>
        {
            Success = true,
            Message = "Banco actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar banco", Description = "Elimina un banco por su identificador")]
    public async Task<IActionResult> Delete(
        [FromRoute][SwaggerParameter(Description = "Identificador del banco a eliminar", Required = true)] int id)
    {
        var result = await _bancoService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Banco eliminado exitosamente.",
            Data = null
        }));
    }
}
