using ErrorOr;
using Lefarma.API.Features.Admin.DTOs;

namespace Lefarma.API.Features.Admin;
public interface IAdminService
{
    // Usuarios
    Task<ErrorOr<IEnumerable<UsuarioResponse>>> GetAllUsuariosAsync();
    Task<ErrorOr<UsuarioResponse>> GetUsuarioByIdAsync(int id);
    Task<ErrorOr<UsuarioResponse>> CreateUsuarioAsync(CreateUsuarioRequest request);
    Task<ErrorOr<UsuarioResponse>> UpdateUsuarioAsync(int id, UpdateUsuarioRequest request);

    // Roles
    Task<ErrorOr<IEnumerable<RolResponse>>> GetAllRolesAsync();
    Task<ErrorOr<RolResponse>> GetRolByIdAsync(int id);
    Task<ErrorOr<RolConUsuariosResponse>> GetRolWithUsuariosAsync(int id);
    Task<ErrorOr<RolResponse>> CreateRolAsync(CreateRolRequest request);
    Task<ErrorOr<RolResponse>> UpdateRolAsync(int id, UpdateRolRequest request);
    Task<ErrorOr<bool>> UpdateRolUsuariosAsync(int id, AsignarUsuariosRequest request);
    Task<ErrorOr<bool>> DeleteRolAsync(int id);

    // Permisos
    Task<ErrorOr<IEnumerable<PermisoResponse>>> GetAllPermisosAsync();
    Task<ErrorOr<PermisoResponse>> GetPermisoByIdAsync(int id);
    Task<ErrorOr<PermisoConRolesYUsuariosResponse>> GetPermisoConRelacionesAsync(int id);
    Task<ErrorOr<PermisoResponse>> CreatePermisoAsync(CreatePermisoRequest request);
    Task<ErrorOr<PermisoResponse>> UpdatePermisoAsync(int id, UpdatePermisoRequest request);
    Task<ErrorOr<bool>> UpdatePermisoRolesAsync(int id, AsignarRolesAPermisoRequest request);
    Task<ErrorOr<bool>> UpdatePermisoUsuariosAsync(int id, AsignarUsuariosAPermisoRequest request);
    Task<ErrorOr<bool>> DeletePermisoAsync(int id);
}
