using FluentAssertions;
using Lefarma.API.Domain.Entities.Asistencias;
using Lefarma.API.Features.OrdenesCompra.Captura;

namespace Lefarma.UnitTests;

/// <summary>
/// The 'Puesto' shown in OC PDFs must come from Asistencias.dbo.vwEmpleados because
/// app.Usuarios.Puesto defaults to 'Sin asignar'. Match key: full email,
/// app.Usuarios.Correo == vwEmpleados.correo, compared case-insensitively.
/// Evidence row: user 25 'Adriana Arredondo Ortiz' (Correo '1a41@asokam.mx') maps to
/// vwEmpleados id 26 with puesto 'AUXILIAR DE COMPRAS'.
/// </summary>
public class PuestoAsistenciasTests
{
    private static OrdenCompraService.UsuarioInfo NewInfo(string? correo) =>
        new("Adriana Arredondo Ortiz", "Sin asignar", correo);

    [Fact]
    public void Cruce_Por_Correo_Insensible_A_Mayusculas_Sustituye_Puesto()
    {
        var usuariosInfo = new Dictionary<int, OrdenCompraService.UsuarioInfo>
        {
            [25] = NewInfo("1a41@asokam.mx")
        };
        var empleados = new List<VwEmpleado>
        {
            new() { Correo = "1A41@ASOKAM.MX", Puesto = "AUXILIAR DE COMPRAS" }
        };

        OrdenCompraService.AplicarPuestosDeAsistencias(usuariosInfo, empleados);

        usuariosInfo[25].Puesto.Should().Be("AUXILIAR DE COMPRAS");
        usuariosInfo[25].Nombre.Should().Be("Adriana Arredondo Ortiz");
    }

    [Fact]
    public void Sin_Correspondencia_Conserva_Puesto_Original()
    {
        var usuariosInfo = new Dictionary<int, OrdenCompraService.UsuarioInfo>
        {
            [25] = NewInfo("1a41@asokam.mx")
        };
        var empleados = new List<VwEmpleado>
        {
            new() { Correo = "otro@asokam.mx", Puesto = "OTRO PUESTO" }
        };

        OrdenCompraService.AplicarPuestosDeAsistencias(usuariosInfo, empleados);

        usuariosInfo[25].Puesto.Should().Be("Sin asignar");
    }

    [Fact]
    public void Puesto_Vacio_O_Nulo_No_Sustituye()
    {
        var usuariosInfo = new Dictionary<int, OrdenCompraService.UsuarioInfo>
        {
            [25] = NewInfo("1a41@asokam.mx"),
            [26] = NewInfo("1a31@asokam.mx")
        };
        var empleados = new List<VwEmpleado>
        {
            new() { Correo = "1a41@asokam.mx", Puesto = " " },
            new() { Correo = "1a31@asokam.mx", Puesto = null }
        };

        OrdenCompraService.AplicarPuestosDeAsistencias(usuariosInfo, empleados);

        usuariosInfo[25].Puesto.Should().Be("Sin asignar");
        usuariosInfo[26].Puesto.Should().Be("Sin asignar");
    }

    [Fact]
    public void Correo_Nulo_O_Vacio_No_Explota()
    {
        var usuariosInfo = new Dictionary<int, OrdenCompraService.UsuarioInfo>
        {
            [25] = NewInfo(null),
            [26] = NewInfo("   ")
        };
        var empleados = new List<VwEmpleado>
        {
            new() { Correo = "1a41@asokam.mx", Puesto = "AUXILIAR DE COMPRAS" }
        };

        OrdenCompraService.AplicarPuestosDeAsistencias(usuariosInfo, empleados);

        usuariosInfo[25].Puesto.Should().Be("Sin asignar");
        usuariosInfo[26].Puesto.Should().Be("Sin asignar");
    }
}
