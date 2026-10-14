using System.Security.Claims;
using FluentAssertions;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Cubre los helpers extraidos de AprobacionesController a
/// <see cref="ClaimsPrincipalExtensions"/>.
/// Mismo patron historico que Educacion Medica: claims tipo <c>permission</c>.
/// </summary>
public class PermisosHelperTests
{
    [Fact]
    public void TienePermiso_ConClaim_RetornaTrue()
    {
        var principal = PrincipalConPermisos("viaticos.autorizar");

        principal.TienePermiso(Permissions.Viaticos.Autorizar).Should().BeTrue();
    }

    [Fact]
    public void TienePermiso_SinClaim_RetornaFalse()
    {
        var principal = PrincipalConPermisos("viaticos.solicitar");

        principal.TienePermiso(Permissions.Viaticos.Autorizar).Should().BeFalse();
    }

    [Fact]
    public void TienePermiso_PrincipalSinAutenticar_RetornaFalse()
    {
        var anonimo = new ClaimsPrincipal(new ClaimsIdentity()); // sin autenticacion

        anonimo.TienePermiso(Permissions.Viaticos.Autorizar).Should().BeFalse();
    }

    [Fact]
    public void GetUserId_ConNameIdentifierValido_RetornaId()
    {
        var principal = PrincipalConPermisos(userId: 4242);

        principal.GetUserId().Should().Be(4242);
    }

    [Fact]
    public void GetUserId_SinNameIdentifier_RetornaCero()
    {
        var identity = new ClaimsIdentity(
            new[] { new Claim("permission", Permissions.Viaticos.Autorizar) },
            authenticationType: "Test");
        var principal = new ClaimsPrincipal(identity);

        principal.GetUserId().Should().Be(0);
    }

    private static ClaimsPrincipal PrincipalConPermisos(params string[] permisos)
        => PrincipalConPermisos(userId: 0, permisos);

    private static ClaimsPrincipal PrincipalConPermisos(int userId, params string[] permisos)
    {
        var claims = new List<Claim>();
        if (userId > 0)
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, userId.ToString()));
        }

        foreach (var permiso in permisos)
        {
            claims.Add(new Claim("permission", permiso));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType: "Test"));
    }
}