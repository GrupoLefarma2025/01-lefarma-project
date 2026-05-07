using System.Security.Claims;
using FluentValidation;
using Lefarma.API.Features.Catalogos.Proveedores;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;
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
public class ProveedoresController : ControllerBase
{
    private readonly IProveedorService _proveedorService;
    private readonly IConfiguration _configuration;

    public ProveedoresController(IProveedorService proveedorService, IConfiguration configuration)
    {
        _proveedorService = proveedorService;
        _configuration = configuration;
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

    [HttpGet]
    [SwaggerOperation(Summary = "Obtener todos los proveedores", Description = "Retorna la lista completa de proveedores con filtros opcionales")]
    public async Task<IActionResult> GetAll(ProveedorRequest? query)
    {
        if (query == null)
        {
            query = new ProveedorRequest();
        }
        var result = await _proveedorService.GetAllAsync(query);

        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<ProveedorResponse>>
        {
            Success = true,
            Message = "Proveedores obtenidos exitosamente.",
            Data = data
        }));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "Obtener proveedor por ID", Description = "Retorna un proveedor específico por su identificador")]
    public async Task<IActionResult> GetById(
        [SwaggerParameter(Description = "Identificador único del proveedor", Required = true)] int id)
    {
        var result = await _proveedorService.GetByIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Proveedor obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Crear nuevo proveedor", Description = "Crea un proveedor con los datos proporcionados")]
    public async Task<IActionResult> Create(
        [SwaggerRequestBody(Description = "Datos del proveedor a crear", Required = true)] CreateProveedorRequest request)
    {
        var result = await _proveedorService.CreateAsync(request);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetById),
            new { id = data.IdProveedor },
            new ApiResponse<ProveedorResponse>
            {
                Success = true,
                Message = "Proveedor creado exitosamente.",
                Data = data
            }));
    }

    [HttpPut("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Actualizar proveedor", Description = "Actualiza los datos de un proveedor existente")]
    public async Task<IActionResult> Update(
        [SwaggerParameter(Description = "Identificador del proveedor a actualizar", Required = true)] int id,
        [SwaggerRequestBody(Description = "Datos actualizados del proveedor", Required = true)] UpdateProveedorRequest request)
    {
        var result = await _proveedorService.UpdateAsync(id, request);

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Proveedor actualizado exitosamente.",
            Data = data
        }));
    }

    [HttpDelete("{id}")]
//    [HasPermission(Permissions.Catalogos.Manage)]
    [SwaggerOperation(Summary = "Eliminar proveedor", Description = "Elimina un proveedor por su identificador")]
    public async Task<IActionResult> Delete(
        [SwaggerParameter(Description = "Identificador del proveedor a eliminar", Required = true)] int id)
    {
        var result = await _proveedorService.DeleteAsync(id);

        return result.ToActionResult(this, success => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Proveedor eliminado exitosamente.",
            Data = null
        }));
    }

    [HttpPost("{id}/autorizar")]
//    [HasPermission(Permissions.Proveedores.Autorizar)]
    [SwaggerOperation(Summary = "Autorizar proveedor por CxP", Description = "Marca un proveedor como autorizado por el área de Cuentas por Pagar")]
    public async Task<IActionResult> Autorizar(
        [SwaggerParameter(Description = "Identificador del proveedor a autorizar", Required = true)] int id)
    {
        var result = await _proveedorService.AutorizarAsync(id, GetUserId());

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Proveedor autorizado exitosamente.",
            Data = data
        }));
    }

    [HttpPost("{id}/rechazar")]
//    [HasPermission(Permissions.Proveedores.Rechazar)]
    [SwaggerOperation(Summary = "Rechazar proveedor por CxP", Description = "Rechaza un proveedor con un motivo")]
    public async Task<IActionResult> Rechazar(
        [SwaggerParameter(Description = "Identificador del proveedor a rechazar", Required = true)] int id,
        [SwaggerRequestBody(Description = "Motivo del rechazo", Required = true)] RechazarProveedorRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await _proveedorService.RechazarAsync(id, request.Motivo, GetUserId());

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Proveedor rechazado exitosamente.",
            Data = data
        }));
    }

    [HttpPost("{id}/caratula")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10_000_000)]
    [SwaggerOperation(Summary = "Subir caratula de proveedor", Description = "Sube una imagen de caratula para un proveedor existente")]
    public async Task<IActionResult> UploadCaratula(
        [SwaggerParameter(Description = "Identificador del proveedor", Required = true)] int id,
        [SwaggerRequestBody(Description = "Archivo de imagen para la caratula", Required = true)] IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "No se proporciono ningun archivo",
                Data = null
            });
        }

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf" };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(extension) || !allowedExtensions.Contains(extension))
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "Solo se permiten archivos de imagen (jpg, jpeg, png, gif, webp) o PDF",
                Data = null
            });
        }

        var basePath = _configuration["ArchivosSettings:BasePath"] ?? "wwwroot/media/archivos";
        var fileName = $"caratula_proveedor_{id}_{Guid.NewGuid()}{extension}";
        var relativePath = Path.Combine("caratulas", fileName);
        var fullDir = Path.GetFullPath(Path.Combine(basePath, "caratulas"));
        var fullPath = Path.Combine(fullDir, fileName);

        if (!Directory.Exists(fullDir))
        {
            Directory.CreateDirectory(fullDir);
        }

        await using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var result = await _proveedorService.UpdateCaratulaAsync(id, relativePath.Replace("\\", "/"));

        return result.ToActionResult(this, _ => Ok(new ApiResponse<CaratulaUploadResponse>
        {
            Success = true,
            Message = "Caratula subida exitosamente",
            Data = new CaratulaUploadResponse
            {
                FileName = fileName,
                Url = $"/media/archivos/{relativePath.Replace("\\", "/")}",
                ContentType = file.ContentType,
                Size = file.Length
            }
        }));
    }

    [HttpDelete("{id}/caratula")]
    [SwaggerOperation(Summary = "Eliminar caratula de proveedor", Description = "Elimina la imagen de caratula de un proveedor existente")]
    public async Task<IActionResult> DeleteCaratula(
        [SwaggerParameter(Description = "Identificador del proveedor", Required = true)] int id)
    {
        var result = await _proveedorService.DeleteCaratulaAsync(id);

        return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
        {
            Success = true,
            Message = "Caratula eliminada exitosamente",
            Data = null
        }));
    }

    [HttpGet("{id}/staging")]
    [SwaggerOperation(Summary = "Obtener staging de proveedor", Description = "Retorna los datos staging (edición pendiente) de un proveedor con diff de cambios")]
    public async Task<IActionResult> GetStaging(
        [SwaggerParameter(Description = "Identificador del proveedor", Required = true)] int id)
    {
        var result = await _proveedorService.GetStagingByProveedorIdAsync(id);

        return result.ToActionResult(this, data => Ok(new ApiResponse<StagingProveedorResponse>
        {
            Success = true,
            Message = "Staging obtenido exitosamente.",
            Data = data
        }));
    }

    [HttpPost("{id}/autorizar-edicion")]
    [SwaggerOperation(Summary = "Autorizar edición de proveedor", Description = "Aplica los cambios del staging al registro original y elimina el staging")]
    public async Task<IActionResult> AutorizarEdicion(
        [SwaggerParameter(Description = "Identificador del proveedor", Required = true)] int id)
    {
        var result = await _proveedorService.AutorizarEdicionAsync(id, GetUserId());

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Edición de proveedor autorizada exitosamente.",
            Data = data
        }));
    }

    [HttpPost("{id}/rechazar-edicion")]
    [SwaggerOperation(Summary = "Rechazar edición de proveedor", Description = "Elimina el staging y restaura el estatus del proveedor a aprobado")]
    public async Task<IActionResult> RechazarEdicion(
        [SwaggerParameter(Description = "Identificador del proveedor", Required = true)] int id)
    {
        var result = await _proveedorService.RechazarEdicionAsync(id, GetUserId());

        return result.ToActionResult(this, data => Ok(new ApiResponse<ProveedorResponse>
        {
            Success = true,
            Message = "Edición de proveedor rechazada.",
            Data = data
        }));
    }
}
