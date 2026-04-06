using FluentValidation;
using Lefarma.API.Features.Catalogos.Empresas;
using Lefarma.API.Features.Catalogos.Empresas.DTOs;
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
public class EmpresasController : ControllerBase
{
    private readonly IEmpresaService _empresaService;

    public EmpresasController(IEmpresaService empresaService)
    {
        _empresaService = empresaService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todas las empresas con filtros", Description = "Retorna la lista de empresas aplicando filtros opcionales")]
    public async Task<IActionResult> GetAll(EmpresaRequest? query)
    {
        if(query == null) { 
            query = new EmpresaRequest();
        }
        var result = await _empresaService.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<EmpresaResponse>>
        {
            Success = true,
            Message = "Empresas obtenidas exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener empresa por ID", Description = "Retorna una empresa específica por su identificador")]
    public async Task<IActionResult> GetById(
        [SwaggerParameter(Description = "Identificador único de la empresa", Required = true)] int id)
    {
        var result = await _empresaService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<EmpresaResponse>
        {
            Success = true,
            Message = "Empresa obtenida exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nueva empresa", Description = "Crea una empresa con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [SwaggerRequestBody(Description = "Datos de la empresa a crear", Required = true)] CreateEmpresaRequest request)
    {
        var result = await _empresaService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdEmpresa },
            new ApiResponse<EmpresaResponse>
            {
                Success = true,
                Message = "Empresa creada exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar empresa", Description = "Actualiza los datos de una empresa existente")]
    public async Task<IActionResult> Update(
        [SwaggerParameter(Description = "Identificador de la empresa a actualizar", Required = true)] int id,
        [SwaggerRequestBody(Description = "Datos actualizados de la empresa", Required = true)] UpdateEmpresaRequest request)
    {
        var result = await _empresaService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<EmpresaResponse>
        {
            Success = true,
            Message = "Empresa actualizada exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
    //[HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar empresa", Description = "Elimina una empresa por su identificador")]
    public async Task<IActionResult> Delete(
        [SwaggerParameter(Description = "Identificador de la empresa a eliminar", Required = true)] int id)
    {
        var result = await _empresaService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Empresa eliminada exitosamente.",
            Data = null
        }));
    }
}
