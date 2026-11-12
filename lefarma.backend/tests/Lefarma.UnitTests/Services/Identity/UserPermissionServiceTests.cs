using FluentAssertions;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Lefarma.UnitTests.Services.Identity;

/// <summary>
/// app.UsuariosPermisos admite filas con EsConcedido = 0 que actúan como denegación
/// explícita: restan el permiso que el usuario recibiría por sus roles, igual que
/// app.sp_ObtenerPermisosUsuario en el sistema anterior.
/// </summary>
public class UserPermissionServiceTests
{
    private const int IdUsuario = 73;
    private const int IdRol = 2;

    private static Permiso Permiso(int id, string codigo) =>
        new() { IdPermiso = id, CodigoPermiso = codigo, NombrePermiso = codigo };

    private static (AsokamDbContext Contexto, UserPermissionService Servicio) CrearArnes(
        Action<AsokamDbContext, Dictionary<string, Permiso>> sembrar)
    {
        var contexto = new AsokamDbContext(new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase($"permisos-{Guid.NewGuid()}")
            .Options);

        var pSubir = Permiso(32, "documentos.subir");
        var pEliminar = Permiso(34, "documentos.eliminar");
        var pVer = Permiso(35, "documentos.ver_todos");
        var pMenu = Permiso(1, "menu.home");
        contexto.Permisos.AddRange(pSubir, pEliminar, pVer, pMenu);

        var rol = new Rol { IdRol = IdRol, NombreRol = "Usuario Estandar" };
        contexto.Roles.Add(rol);

        var usuario = new Usuario { IdUsuario = IdUsuario, NombreCompleto = "Marco Polo Narvaez Oropeza" };
        contexto.Usuarios.Add(usuario);

        // El rol concede los tres permisos de documentos más el menú base.
        contexto.RolesPermisos.AddRange(
            new RolPermiso { IdRol = IdRol, IdPermiso = pSubir.IdPermiso, Rol = rol, Permiso = pSubir },
            new RolPermiso { IdRol = IdRol, IdPermiso = pEliminar.IdPermiso, Rol = rol, Permiso = pEliminar },
            new RolPermiso { IdRol = IdRol, IdPermiso = pVer.IdPermiso, Rol = rol, Permiso = pVer },
            new RolPermiso { IdRol = IdRol, IdPermiso = pMenu.IdPermiso, Rol = rol, Permiso = pMenu });

        contexto.UsuariosRoles.Add(new UsuarioRol
        {
            IdUsuario = IdUsuario,
            IdRol = IdRol,
            Usuario = usuario,
            Rol = rol
        });

        sembrar(contexto, new Dictionary<string, Permiso>
        {
            [pSubir.CodigoPermiso] = pSubir,
            [pEliminar.CodigoPermiso] = pEliminar,
            [pVer.CodigoPermiso] = pVer,
            [pMenu.CodigoPermiso] = pMenu
        });

        contexto.SaveChanges();

        var servicio = new UserPermissionService(contexto, new MemoryCache(new MemoryCacheOptions()));
        return (contexto, servicio);
    }

    [Fact]
    public async Task DenegacionDirecta_RestaElPermisoQueVieneDelRol()
    {
        var (contexto, servicio) = CrearArnes((ctx, permisos) =>
        {
            ctx.UsuariosPermisos.Add(new UsuarioPermiso
            {
                IdUsuario = IdUsuario,
                IdPermiso = permisos["documentos.subir"].IdPermiso,
                Permiso = permisos["documentos.subir"],
                EsConcedido = false
            });
            ctx.UsuariosPermisos.Add(new UsuarioPermiso
            {
                IdUsuario = IdUsuario,
                IdPermiso = permisos["documentos.eliminar"].IdPermiso,
                Permiso = permisos["documentos.eliminar"],
                EsConcedido = false
            });
        });

        using (contexto)
        {
            var resultado = await servicio.RefreshAsync(IdUsuario);

            resultado.Should().NotContain("documentos.subir");
            resultado.Should().NotContain("documentos.eliminar");
            resultado.Should().Contain("documentos.ver_todos",
                "la denegación solo aplica al permiso que la tiene");
            resultado.Should().Contain("menu.home");
        }
    }

    [Fact]
    public async Task ConcesionDirecta_AgregaUnPermisoQueNoVieneDelRol()
    {
        var (contexto, servicio) = CrearArnes((ctx, permisos) =>
        {
            var pExtra = Permiso(65, "orden_compra.puede_cambiar_empresa");
            ctx.Permisos.Add(pExtra);
            ctx.UsuariosPermisos.Add(new UsuarioPermiso
            {
                IdUsuario = IdUsuario,
                IdPermiso = pExtra.IdPermiso,
                Permiso = pExtra,
                EsConcedido = true
            });
        });

        using (contexto)
        {
            var resultado = await servicio.RefreshAsync(IdUsuario);

            resultado.Should().Contain("orden_compra.puede_cambiar_empresa");
            resultado.Should().Contain("documentos.subir");
        }
    }

    [Fact]
    public async Task DenegacionExpirada_NoRestaElPermisoDelRol()
    {
        var (contexto, servicio) = CrearArnes((ctx, permisos) =>
        {
            ctx.UsuariosPermisos.Add(new UsuarioPermiso
            {
                IdUsuario = IdUsuario,
                IdPermiso = permisos["documentos.subir"].IdPermiso,
                Permiso = permisos["documentos.subir"],
                EsConcedido = false,
                FechaExpiracion = DateTime.UtcNow.AddDays(-1)
            });
        });

        using (contexto)
        {
            var resultado = await servicio.RefreshAsync(IdUsuario);

            resultado.Should().Contain("documentos.subir");
        }
    }

    [Fact]
    public async Task UsuarioSinDenegaciones_ConservaTodosLosPermisosDelRol()
    {
        var (contexto, servicio) = CrearArnes((_, _) => { });

        using (contexto)
        {
            var resultado = await servicio.RefreshAsync(IdUsuario);

            resultado.Should().BeEquivalentTo(new[]
            {
                "documentos.subir",
                "documentos.eliminar",
                "documentos.ver_todos",
                "menu.home"
            });
        }
    }
}
