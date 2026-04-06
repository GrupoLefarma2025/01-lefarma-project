using Lefarma.API.Features.Admin.DTOs;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Admin;
[Route("api/[controller]")]
[ApiController]
[EndpointGroupName("Admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    #region Usuarios

    [HttpGet("usuarios")]
    [SwaggerOperation(Summary = "Obtener todos los usuarios")]
    public async Task<IActionResult> GetUsuarios()
    {
        var result = await _adminService.GetAllUsuariosAsync();
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<UsuarioResponse>>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpGet("usuarios/{id}")]
    [SwaggerOperation(Summary = "Obtener usuario por ID")]
    public async Task<IActionResult> GetUsuario(int id)
    {
        var result = await _adminService.GetUsuarioByIdAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<UsuarioResponse>
        {
            Success = true,
            Data = data
        }));
    }

    //[HttpPost("usuarios")]
    //[SwaggerOperation(Summary = "Crear usuario")]
    //public async Task<IActionResult> CreateUsuario([FromBody] CreateUsuarioRequest request)
    //{
    //    var result = await _adminService.CreateUsuarioAsync(request);
    //    return result.ToActionResult(this, data => CreatedAtAction(
    //        nameof(GetUsuario),
    //        new { id = data.IdUsuario },
    //        new ApiResponse<UsuarioResponse>
    //        {
    //            Success = true,
    //            Data = data
    //        }));
    //}

    [HttpPut("usuarios/{id}")]
    [SwaggerOperation(Summary = "Actualizar usuario")]
    public async Task<IActionResult> UpdateUsuario(int id, [FromBody] UpdateUsuarioRequest request)
    {
        var result = await _adminService.UpdateUsuarioAsync(id, request);
        return result.ToActionResult(this, data => Ok(new ApiResponse<UsuarioResponse>
        {
            Success = true,
            Data = data
        }));
    }

    #endregion

    #region Roles

    [HttpGet("roles")]
    [SwaggerOperation(Summary = "Obtener todos los roles")]
    public async Task<IActionResult> GetRoles()
    {
        var result = await _adminService.GetAllRolesAsync();
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<RolResponse>>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpGet("roles/{id}")]
    [SwaggerOperation(Summary = "Obtener rol por ID")]
    public async Task<IActionResult> GetRol(int id)
    {
        var result = await _adminService.GetRolByIdAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<RolResponse>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpGet("roles/{id}/usuarios")]
    [SwaggerOperation(Summary = "Obtener rol con lista de usuarios")]
    public async Task<IActionResult> GetRolWithUsuarios(int id)
    {
        var result = await _adminService.GetRolWithUsuariosAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<RolConUsuariosResponse>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpPost("roles")]
    [SwaggerOperation(Summary = "Crear rol")]
    public async Task<IActionResult> CreateRol([FromBody] CreateRolRequest request)
    {
        var result = await _adminService.CreateRolAsync(request);
        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetRol),
            new { id = data.IdRol },
            new ApiResponse<RolResponse>
            {
                Success = true,
                Data = data
            }));
    }

    [HttpPut("roles/{id}")]
    [SwaggerOperation(Summary = "Actualizar rol")]
    public async Task<IActionResult> UpdateRol(int id, [FromBody] UpdateRolRequest request)
    {
        var result = await _adminService.UpdateRolAsync(id, request);
        return result.ToActionResult(this, data => Ok(new ApiResponse<RolResponse>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpPut("roles/{id}/usuarios")]
    [SwaggerOperation(Summary = "Actualizar usuarios de un rol")]
    public async Task<IActionResult> UpdateRolUsuarios(int id, [FromBody] AsignarUsuariosRequest request)
    {
        var result = await _adminService.UpdateRolUsuariosAsync(id, request);
        return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
        {
            Success = true,
            Message = "Usuarios actualizados exitosamente"
        }));
    }

    [HttpDelete("roles/{id}")]
    [SwaggerOperation(Summary = "Eliminar rol")]
    public async Task<IActionResult> DeleteRol(int id)
    {
        var result = await _adminService.DeleteRolAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
        {
            Success = true,
            Message = "Rol eliminado exitosamente"
        }));
    }

    #endregion

    #region Permisos

    [HttpGet("permisos")]
    [SwaggerOperation(Summary = "Obtener todos los permisos")]
    public async Task<IActionResult> GetPermisos()
    {
        var result = await _adminService.GetAllPermisosAsync();
        return result.ToActionResult(this, data => Ok(new ApiResponse<IEnumerable<PermisoResponse>>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpGet("permisos/{id}")]
    [SwaggerOperation(Summary = "Obtener permiso por ID")]
    public async Task<IActionResult> GetPermiso(int id)
    {
        var result = await _adminService.GetPermisoByIdAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<PermisoResponse>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpPost("permisos")]
    [SwaggerOperation(Summary = "Crear permiso")]
    public async Task<IActionResult> CreatePermiso([FromBody] CreatePermisoRequest request)
    {
        var result = await _adminService.CreatePermisoAsync(request);
        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(GetPermiso),
            new { id = data.IdPermiso },
            new ApiResponse<PermisoResponse>
            {
                Success = true,
                Data = data
            }));
    }

    [HttpPut("permisos/{id}")]
    [SwaggerOperation(Summary = "Actualizar permiso")]
    public async Task<IActionResult> UpdatePermiso(int id, [FromBody] UpdatePermisoRequest request)
    {
        var result = await _adminService.UpdatePermisoAsync(id, request);
        return result.ToActionResult(this, data => Ok(new ApiResponse<PermisoResponse>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpDelete("permisos/{id}")]
    [SwaggerOperation(Summary = "Eliminar permiso")]
    public async Task<IActionResult> DeletePermiso(int id)
    {
        var result = await _adminService.DeletePermisoAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
        {
            Success = true,
            Message = "Permiso eliminado exitosamente"
        }));
    }

    [HttpGet("permisos/{id}/relaciones")]
    [SwaggerOperation(Summary = "Obtener permiso con roles y usuarios")]
    public async Task<IActionResult> GetPermisoConRelaciones(int id)
    {
        var result = await _adminService.GetPermisoConRelacionesAsync(id);
        return result.ToActionResult(this, data => Ok(new ApiResponse<PermisoConRolesYUsuariosResponse>
        {
            Success = true,
            Data = data
        }));
    }

    [HttpPut("permisos/{id}/roles")]
    [SwaggerOperation(Summary = "Actualizar roles de un permiso")]
    public async Task<IActionResult> UpdatePermisoRoles(int id, [FromBody] AsignarRolesAPermisoRequest request)
    {
        var result = await _adminService.UpdatePermisoRolesAsync(id, request);
        return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
        {
            Success = true,
            Message = "Roles actualizados exitosamente"
        }));
    }

    [HttpPut("permisos/{id}/usuarios")]
    [SwaggerOperation(Summary = "Actualizar usuarios de un permiso")]
    public async Task<IActionResult> UpdatePermisoUsuarios(int id, [FromBody] AsignarUsuariosAPermisoRequest request)
    {
        var result = await _adminService.UpdatePermisoUsuariosAsync(id, request);
        return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
        {
            Success = true,
            Message = "Usuarios actualizados exitosamente"
        }));
    }

    #endregion

    #region Asignaciones

    //[HttpPost("usuarios/{usuarioId}/roles")]
    //[SwaggerOperation(Summary = "Asignar roles a usuario")]
    //public async Task<IActionResult> AsignarRolesAUsuario(int usuarioId, [FromBody] AsignarRolesRequest request)
    //{
    //    var result = await _adminService.AsignarRolesAUsuarioAsync(usuarioId, request.RolesIds);
    //    return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
    //    {
    //        Success = true,
    //        Message = "Roles asignados exitosamente"
    //    }));
    //}

    //[HttpPost("roles/{rolId}/permisos")]
    //[SwaggerOperation(Summary = "Asignar permisos a rol")]
    //public async Task<IActionResult> AsignarPermisosARol(int rolId, [FromBody] AsignarPermisosRequest request)
    //{
    //    var result = await _adminService.AsignarPermisosARolAsync(rolId, request.PermisosIds);
    //    return result.ToActionResult(this, data => Ok(new ApiResponse<bool>
    //    {
    //        Success = true,
    //        Message = "Permisos asignados exitosamente"
    //    }));
    //}

    #endregion
}