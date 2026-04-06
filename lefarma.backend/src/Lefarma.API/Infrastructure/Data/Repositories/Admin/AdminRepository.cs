using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Admin;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data.Repositories.Admin;
/// <summary>
/// Repositorio para operaciones de administración de usuarios, roles y permisos.
/// Maneja dos contextos: AsokamDbContext (auth) y ApplicationDbContext (catalogos).
/// </summary>
public class AdminRepository : IAdminRepository
{
    private readonly AsokamDbContext _asokamContext;
    private readonly ApplicationDbContext _appContext;

    public AdminRepository(AsokamDbContext asokamContext, ApplicationDbContext appContext)
    {
        _asokamContext = asokamContext;
        _appContext = appContext;
    }

    #region Usuario Operations

    public async Task<IEnumerable<Usuario>> GetAllUsuariosAsync()
    {
        return await _asokamContext.Usuarios
            .Include(u => u.UsuariosRoles)
                .ThenInclude(ur => ur.Rol)
            .Include(u => u.UsuariosPermisos)
                .ThenInclude(up => up.Permiso)
            .OrderBy(u => u.NombreCompleto)
            .ToListAsync();
    }

    public async Task<Usuario?> GetUsuarioByIdAsync(int id)
    {
        return await _asokamContext.Usuarios.FindAsync(id);
    }

    public async Task<Usuario?> GetUsuarioByIdConRelacionesAsync(int id)
    {
        return await _asokamContext.Usuarios
            .Include(u => u.UsuariosRoles)
                .ThenInclude(ur => ur.Rol)
            .Include(u => u.UsuariosPermisos)
                .ThenInclude(up => up.Permiso)
            .FirstOrDefaultAsync(u => u.IdUsuario == id);
    }

    public async Task<bool> ExisteUsuarioAsync(string samAccountName, string dominio)
    {
        return await _asokamContext.Usuarios
            .AnyAsync(u => u.SamAccountName == samAccountName && u.Dominio == dominio);
    }

    public async Task<Usuario> CreateUsuarioAsync(Usuario usuario)
    {
        _asokamContext.Usuarios.Add(usuario);
        await _asokamContext.SaveChangesAsync();
        return usuario;
    }

    public async Task UpdateUsuarioAsync(Usuario usuario)
    {
        _asokamContext.Usuarios.Update(usuario);
        await _asokamContext.SaveChangesAsync();
    }

    public async Task<IEnumerable<UsuarioDetalle>> GetUsuariosDetalleAsync(List<int> usuariosIds)
    {
        return await _appContext.UsuariosDetalle
            .Where(ud => usuariosIds.Contains(ud.IdUsuario))
            .ToListAsync();
    }

    public async Task<UsuarioDetalle?> GetUsuarioDetalleAsync(int idUsuario)
    {
        return await _appContext.UsuariosDetalle.FindAsync(idUsuario);
    }

    public async Task CreateUsuarioDetalleAsync(UsuarioDetalle detalle)
    {
        _appContext.UsuariosDetalle.Add(detalle);
        await _appContext.SaveChangesAsync();
    }

    public async Task UpdateUsuarioDetalleAsync(UsuarioDetalle detalle)
    {
        _appContext.UsuariosDetalle.Update(detalle);
        await _appContext.SaveChangesAsync();
    }

    #endregion

    #region Rol Operations

    public async Task<IEnumerable<Rol>> GetAllRolesAsync()
    {
        return await _asokamContext.Roles
            .Include(r => r.RolesPermisos)
                .ThenInclude(rp => rp.Permiso)
            .Include(r => r.UsuariosRoles)
            .OrderBy(r => r.NombreRol)
            .ToListAsync();
    }

    public async Task<Rol?> GetRolByIdAsync(int id)
    {
        return await _asokamContext.Roles.FindAsync(id);
    }

    public async Task<Rol?> GetRolByIdConRelacionesAsync(int id)
    {
        return await _asokamContext.Roles
            .Include(r => r.RolesPermisos)
                .ThenInclude(rp => rp.Permiso)
            .Include(r => r.UsuariosRoles)
            .FirstOrDefaultAsync(r => r.IdRol == id);
    }

    public async Task<bool> ExisteRolAsync(string nombreRol)
    {
        return await _asokamContext.Roles.AnyAsync(r => r.NombreRol == nombreRol);
    }

    public async Task<bool> ExisteOtroRolAsync(string nombreRol, int idRol)
    {
        return await _asokamContext.Roles.AnyAsync(r => r.NombreRol == nombreRol && r.IdRol != idRol);
    }

    public async Task<Rol> CreateRolAsync(Rol rol)
    {
        _asokamContext.Roles.Add(rol);
        await _asokamContext.SaveChangesAsync();
        return rol;
    }

    public async Task UpdateRolAsync(Rol rol)
    {
        _asokamContext.Roles.Update(rol);
        await _asokamContext.SaveChangesAsync();
    }

    public async Task DeleteRolAsync(Rol rol)
    {
        _asokamContext.Roles.Remove(rol);
        await _asokamContext.SaveChangesAsync();
    }

    #endregion

    #region Permiso Operations

    public async Task<IEnumerable<Permiso>> GetAllPermisosAsync()
    {
        return await _asokamContext.Permisos
            .Include(p => p.RolesPermisos)
            .OrderBy(p => p.Categoria)
            .ThenBy(p => p.NombrePermiso)
            .ToListAsync();
    }

    public async Task<Permiso?> GetPermisoByIdAsync(int id)
    {
        return await _asokamContext.Permisos.FindAsync(id);
    }

    public async Task<Permiso?> GetPermisoByIdConRelacionesAsync(int id)
    {
        return await _asokamContext.Permisos
            .Include(p => p.RolesPermisos)
            .FirstOrDefaultAsync(p => p.IdPermiso == id);
    }

    public async Task<bool> ExistePermisoAsync(string codigoPermiso)
    {
        return await _asokamContext.Permisos.AnyAsync(p => p.CodigoPermiso == codigoPermiso);
    }

    public async Task<bool> ExisteOtroPermisoAsync(string codigoPermiso, int idPermiso)
    {
        return await _asokamContext.Permisos.AnyAsync(p => p.CodigoPermiso == codigoPermiso && p.IdPermiso != idPermiso);
    }

    public async Task<Permiso> CreatePermisoAsync(Permiso permiso)
    {
        _asokamContext.Permisos.Add(permiso);
        await _asokamContext.SaveChangesAsync();
        return permiso;
    }

    public async Task UpdatePermisoAsync(Permiso permiso)
    {
        _asokamContext.Permisos.Update(permiso);
        await _asokamContext.SaveChangesAsync();
    }

    public async Task DeletePermisoAsync(Permiso permiso)
    {
        _asokamContext.Permisos.Remove(permiso);
        await _asokamContext.SaveChangesAsync();
    }

    #endregion

    #region Asignaciones

    public async Task AsignarRolesAUsuarioAsync(int usuarioId, List<int> rolesIds)
    {
        var usuario = await _asokamContext.Usuarios
            .Include(u => u.UsuariosRoles)
            .FirstOrDefaultAsync(u => u.IdUsuario == usuarioId);

        if (usuario == null)
            throw new InvalidOperationException($"Usuario con ID {usuarioId} no encontrado");

        // Eliminar roles existentes
        _asokamContext.UsuariosRoles.RemoveRange(usuario.UsuariosRoles);

        // Agregar nuevos roles
        foreach (var rolId in rolesIds)
        {
            var rolExiste = await RolExisteYActivoAsync(rolId);
            if (rolExiste)
            {
                _asokamContext.UsuariosRoles.Add(new UsuarioRol
                {
                    IdUsuario = usuarioId,
                    IdRol = rolId,
                    FechaAsignacion = DateTime.UtcNow
                });
            }
        }

        await _asokamContext.SaveChangesAsync();
    }

    public async Task AsignarPermisosAUsuarioAsync(int usuarioId, List<int> permisosIds)
    {
        var usuario = await _asokamContext.Usuarios
            .Include(u => u.UsuariosPermisos)
            .FirstOrDefaultAsync(u => u.IdUsuario == usuarioId);

        if (usuario == null)
            throw new InvalidOperationException($"Usuario con ID {usuarioId} no encontrado");

        // Eliminar permisos existentes
        _asokamContext.UsuariosPermisos.RemoveRange(usuario.UsuariosPermisos);

        // Agregar nuevos permisos
        foreach (var permisoId in permisosIds)
        {
            var permisoExiste = await PermisoExisteYActivoAsync(permisoId);
            if (permisoExiste)
            {
                _asokamContext.UsuariosPermisos.Add(new UsuarioPermiso
                {
                    IdUsuario = usuarioId,
                    IdPermiso = permisoId,
                    FechaAsignacion = DateTime.UtcNow
                });
            }
        }

        await _asokamContext.SaveChangesAsync();
    }

    public async Task AsignarPermisosARolAsync(int rolId, List<int> permisosIds)
    {
        var rol = await _asokamContext.Roles
            .Include(r => r.RolesPermisos)
            .FirstOrDefaultAsync(r => r.IdRol == rolId);

        if (rol == null)
            throw new InvalidOperationException($"Rol con ID {rolId} no encontrado");

        // Eliminar permisos existentes
        _asokamContext.RolesPermisos.RemoveRange(rol.RolesPermisos);

        // Agregar nuevos permisos
        foreach (var permisoId in permisosIds)
        {
            var permisoExiste = await PermisoExisteYActivoAsync(permisoId);
            if (permisoExiste)
            {
                _asokamContext.RolesPermisos.Add(new RolPermiso
                {
                    IdRol = rolId,
                    IdPermiso = permisoId
                });
            }
        }

        await _asokamContext.SaveChangesAsync();
    }

    public async Task AsignarUsuariosARolAsync(int rolId, List<int> usuariosIds)
    {
        var rol = await _asokamContext.Roles
            .Include(r => r.UsuariosRoles)
            .FirstOrDefaultAsync(r => r.IdRol == rolId);

        if (rol == null)
            throw new InvalidOperationException($"Rol con ID {rolId} no encontrado");

        // Eliminar asignaciones existentes
        _asokamContext.UsuariosRoles.RemoveRange(rol.UsuariosRoles);

        // Agregar nuevas asignaciones
        foreach (var usuarioId in usuariosIds)
        {
            var usuarioExiste = await UsuarioExisteYActivoAsync(usuarioId);
            if (usuarioExiste)
            {
                _asokamContext.UsuariosRoles.Add(new UsuarioRol
                {
                    IdRol = rolId,
                    IdUsuario = usuarioId,
                    FechaAsignacion = DateTime.UtcNow
                });
            }
        }

        await _asokamContext.SaveChangesAsync();
    }

    public async Task<bool> RolTieneUsuariosAsync(int rolId)
    {
        return await _asokamContext.UsuariosRoles.AnyAsync(ur => ur.IdRol == rolId);
    }

    public async Task<bool> PermisoTieneRolesAsync(int permisoId)
    {
        return await _asokamContext.RolesPermisos.AnyAsync(rp => rp.IdPermiso == permisoId);
    }

    public async Task<bool> RolExisteYActivoAsync(int rolId)
    {
        return await _asokamContext.Roles.AnyAsync(r => r.IdRol == rolId && r.EsActivo);
    }

    public async Task<bool> PermisoExisteYActivoAsync(int permisoId)
    {
        return await _asokamContext.Permisos.AnyAsync(p => p.IdPermiso == permisoId && p.EsActivo);
    }

    public async Task<bool> UsuarioExisteYActivoAsync(int usuarioId)
    {
        return await _asokamContext.Usuarios.AnyAsync(u => u.IdUsuario == usuarioId && u.EsActivo);
    }

    public async Task AsignarRolesAPermisoAsync(int permisoId, List<int> rolesIds)
    {
        var permiso = await _asokamContext.Permisos
            .Include(p => p.RolesPermisos)
            .FirstOrDefaultAsync(p => p.IdPermiso == permisoId);

        if (permiso == null)
            throw new InvalidOperationException($"Permiso con ID {permisoId} no encontrado");

        // Eliminar asignaciones existentes
        _asokamContext.RolesPermisos.RemoveRange(permiso.RolesPermisos);

        // Agregar nuevas asignaciones
        foreach (var rolId in rolesIds)
        {
            var rolExiste = await RolExisteYActivoAsync(rolId);
            if (rolExiste)
            {
                _asokamContext.RolesPermisos.Add(new RolPermiso
                {
                    IdRol = rolId,
                    IdPermiso = permisoId,
                    FechaAsignacion = DateTime.UtcNow
                });
            }
        }

        await _asokamContext.SaveChangesAsync();
    }

    public async Task AsignarUsuariosAPermisoAsync(int permisoId, List<int> usuariosIds)
    {
        var permiso = await _asokamContext.Permisos
            .Include(p => p.UsuariosPermisos)
            .FirstOrDefaultAsync(p => p.IdPermiso == permisoId);

        if (permiso == null)
            throw new InvalidOperationException($"Permiso con ID {permisoId} no encontrado");

        // Eliminar asignaciones existentes
        _asokamContext.UsuariosPermisos.RemoveRange(permiso.UsuariosPermisos);

        // Agregar nuevas asignaciones
        foreach (var usuarioId in usuariosIds)
        {
            var usuarioExiste = await UsuarioExisteYActivoAsync(usuarioId);
            if (usuarioExiste)
            {
                _asokamContext.UsuariosPermisos.Add(new UsuarioPermiso
                {
                    IdUsuario = usuarioId,
                    IdPermiso = permisoId,
                    FechaAsignacion = DateTime.UtcNow
                });
            }
        }

        await _asokamContext.SaveChangesAsync();
    }

    #endregion

    #region Transaction Management

    public async Task<int> SaveChangesAsync()
    {
        return await _asokamContext.SaveChangesAsync();
    }

    #endregion
}
