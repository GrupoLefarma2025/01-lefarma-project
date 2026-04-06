using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Catalogos;

namespace Lefarma.API.Domain.Interfaces.Admin;
/// <summary>
/// Repositorio para operaciones de administración de usuarios, roles y permisos.
/// </summary>
public interface IAdminRepository
{
    #region Usuario Operations

    Task<IEnumerable<Usuario>> GetAllUsuariosAsync();
    Task<Usuario?> GetUsuarioByIdAsync(int id);
    Task<Usuario?> GetUsuarioByIdConRelacionesAsync(int id);
    Task<bool> ExisteUsuarioAsync(string samAccountName, string dominio);
    Task<Usuario> CreateUsuarioAsync(Usuario usuario);
    Task UpdateUsuarioAsync(Usuario usuario);
    Task<IEnumerable<UsuarioDetalle>> GetUsuariosDetalleAsync(List<int> usuariosIds);
    Task<UsuarioDetalle?> GetUsuarioDetalleAsync(int idUsuario);
    Task CreateUsuarioDetalleAsync(UsuarioDetalle detalle);
    Task UpdateUsuarioDetalleAsync(UsuarioDetalle detalle);

    #endregion

    #region Rol Operations

    Task<IEnumerable<Rol>> GetAllRolesAsync();
    Task<Rol?> GetRolByIdAsync(int id);
    Task<Rol?> GetRolByIdConRelacionesAsync(int id);
    Task<bool> ExisteRolAsync(string nombreRol);
    Task<bool> ExisteOtroRolAsync(string nombreRol, int idRol);
    Task<Rol> CreateRolAsync(Rol rol);
    Task UpdateRolAsync(Rol rol);
    Task DeleteRolAsync(Rol rol);

    #endregion

    #region Permiso Operations

    Task<IEnumerable<Permiso>> GetAllPermisosAsync();
    Task<Permiso?> GetPermisoByIdAsync(int id);
    Task<Permiso?> GetPermisoByIdConRelacionesAsync(int id);
    Task<bool> ExistePermisoAsync(string codigoPermiso);
    Task<bool> ExisteOtroPermisoAsync(string codigoPermiso, int idPermiso);
    Task<Permiso> CreatePermisoAsync(Permiso permiso);
    Task UpdatePermisoAsync(Permiso permiso);
    Task DeletePermisoAsync(Permiso permiso);

    #endregion

    #region Asignaciones

    Task AsignarRolesAUsuarioAsync(int usuarioId, List<int> rolesIds);
    Task AsignarPermisosAUsuarioAsync(int usuarioId, List<int> permisosIds);
    Task AsignarPermisosARolAsync(int rolId, List<int> permisosIds);
    Task AsignarUsuariosARolAsync(int rolId, List<int> usuariosIds);
    Task AsignarRolesAPermisoAsync(int permisoId, List<int> rolesIds);
    Task AsignarUsuariosAPermisoAsync(int permisoId, List<int> usuariosIds);
    Task<bool> RolTieneUsuariosAsync(int rolId);
    Task<bool> PermisoTieneRolesAsync(int permisoId);
    Task<bool> RolExisteYActivoAsync(int rolId);
    Task<bool> PermisoExisteYActivoAsync(int permisoId);
    Task<bool> UsuarioExisteYActivoAsync(int usuarioId);

    #endregion

    #region Transaction Management

    Task<int> SaveChangesAsync();

    #endregion
}
