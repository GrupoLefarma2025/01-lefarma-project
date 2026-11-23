using FluentAssertions;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.Proveedores;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;

namespace Lefarma.UnitTests;

public class ProveedorCaratulaDiffTests
{
    private const string TwoBullets = "••"; 

private static Proveedor NewProveedor(int id, int estatus, string razon = "FARMACIA SA") => new()
    {
        IdProveedor = id,
        RazonSocial = razon,
        RazonSocialNormalizada = razon,
        RFC = "XAXX010101000",
        CodigoPostal = "01000",
        RegimenFiscalId = 1,
        UsoCfdi = "G03",
        SinDatosFiscales = false,
        Estatus = estatus,
        Detalle = new ProveedorDetalle
        {
            IdDetalle = id * 10,
            IdProveedor = id,
            PersonaContactoNombre = "Juan",
            ContactoTelefono = "55",
            ContactoEmail = "j@x.com",
            Comentario = null
        }
    };

    private static ProveedorFormaPagoCuenta Cuenta(
        int idCuen, string? clabe, string? numeroCuenta, string? caratula = null, bool activo = true) => new()
    {
        IdCuenta = idCuen,
        IdFormaPago = 1,
        IdBanco = 1,
        NumeroCuenta = numeroCuenta,
        Clabe = clabe,
        NumeroTarjeta = null,
        Beneficiario = "Ben",
        CorreoNotificacion = null,
        Activo = activo,
        CaratulaPath = caratula
    };

    private static StagingProveedor StagingCloneOf(Proveedor p) => new()
    {
        IdStaging = p.IdProveedor * 100,
        IdProveedor = p.IdProveedor,
        RazonSocial = p.RazonSocial,
        RazonSocialNormalizada = p.RazonSocialNormalizada,
        RFC = p.RFC,
        CodigoPostal = p.CodigoPostal,
        RegimenFiscalId = p.RegimenFiscalId,
        UsoCfdi = p.UsoCfdi,
        SinDatosFiscales = p.SinDatosFiscales,
        Detalle = p.Detalle is null ? null : new StagingProveedorDetalle
        {
            IdStagingDetalle = p.Detalle.IdDetalle,
            IdDetalle = p.Detalle.IdDetalle,
            PersonaContactoNombre = p.Detalle.PersonaContactoNombre,
            ContactoTelefono = p.Detalle.ContactoTelefono,
            ContactoEmail = p.Detalle.ContactoEmail,
            Comentario = p.Detalle.Comentario
        }
    };

    private static StagingProveedorFormaPagoCuenta StagingCuenta(
        int? idCuen, string? clabe, string? numeroCuenta, string? caratula = null, bool activo = true) => new()
    {
        IdStagingCuenta = (idCuen ?? 0) + 1,
        IdCuenta = idCuen,
        IdFormaPago = 1,
        IdBanco = 1,
        NumeroCuenta = numeroCuenta,
        Clabe = clabe,
        NumeroTarjeta = null,
        Beneficiario = "Ben",
        CorreoNotificacion = null,
        Activo = activo,
        CaratulaPath = caratula
    };

[Fact]
    public void GenerarDiff_CaratulaActualizada_ContieneLabelExactoConUltimos4()
    {
        var p = NewProveedor(1, EstatusProveedor.Aprobado);
        p.CuentasFormaPago.Add(Cuenta(10, clabe: "0321800000000001234", numeroCuenta: null, caratula: "old.pdf"));

        var s = StagingCloneOf(p);
        s.CuentasFormaPago.Add(StagingCuenta(10, clabe: "0321800000000001234", numeroCuenta: null, caratula: "new.pdf"));

        var diffs = ProveedorService.GenerarDiff(p, s);

        diffs.Should().ContainSingle()
            .Which.Label.Should().Be($"Carátula cuenta {TwoBullets}1234 actualizada");
    }

    [Fact]
    public void GenerarDiff_CaratulaAgregadaEnCuentaExistente_ContieneLabelAgregada()
    {
        var p = NewProveedor(1, EstatusProveedor.Aprobado);
        p.CuentasFormaPago.Add(Cuenta(10, clabe: null, numeroCuenta: "000000001234", caratula: null));

        var s = StagingCloneOf(p);
        s.CuentasFormaPago.Add(StagingCuenta(10, clabe: null, numeroCuenta: "000000001234", caratula: "new.pdf"));

        var diffs = ProveedorService.GenerarDiff(p, s);

        diffs.Should().ContainSingle()
            .Which.Label.Should().Be($"Carátula cuenta {TwoBullets}1234 agregada");
    }

    [Fact]
    public void GenerarDiff_CaratulaEliminada_ContieneLabelEliminada()
    {
        var p = NewProveedor(1, EstatusProveedor.Aprobado);
        p.CuentasFormaPago.Add(Cuenta(10, clabe: null, numeroCuenta: "9999", caratula: "old.pdf"));

        var s = StagingCloneOf(p);
        s.CuentasFormaPago.Add(StagingCuenta(10, clabe: null, numeroCuenta: "9999", caratula: null));

        var diffs = ProveedorService.GenerarDiff(p, s);

        diffs.Should().ContainSingle()
            .Which.Label.Should().Be($"Carátula cuenta {TwoBullets}9999 eliminada");
    }

    [Fact]
    public void GenerarDiff_CuentaNuevaConCaratula_ContieneLabelAgregada()
    {
        var p = NewProveedor(1, EstatusProveedor.Aprobado);

        var s = StagingCloneOf(p);
        s.CuentasFormaPago.Add(StagingCuenta(idCuen: null, clabe: null, numeroCuenta: "000000005678", caratula: "new.pdf"));

        var diffs = ProveedorService.GenerarDiff(p, s);

        diffs.Should().ContainSingle()
            .Which.Label.Should().Be($"Carátula cuenta {TwoBullets}5678 agregada");
    }

    [Fact]
    public void GenerarDiff_CaratulaYRazonSocialCambian_DiffTieneDosEntradas()
    {
        var p = NewProveedor(1, EstatusProveedor.Aprobado);
        p.CuentasFormaPago.Add(Cuenta(10, clabe: null, numeroCuenta: "1234", caratula: "old.pdf"));

        var s = StagingCloneOf(p);
        s.RazonSocial = "FARMACIA SA DE CV"; 
        s.CuentasFormaPago.Add(StagingCuenta(10, clabe: null, numeroCuenta: "1234", caratula: "new.pdf"));

        var diffs = ProveedorService.GenerarDiff(p, s);

        diffs.Should().HaveCount(2);
        diffs.Should().Contain(d => d.Label == "Razón Social");
        diffs.Should().Contain(d => d.Label == $"Carátula cuenta {TwoBullets}1234 actualizada");
    }

    [Fact]
    public void GenerarDiff_StandaloneAuthorizedUploadClone_DiffLengthEsUno()
    {
        var p = NewProveedor(1, EstatusProveedor.Aprobado);
        p.CuentasFormaPago.Add(Cuenta(10, clabe: null, numeroCuenta: "1234", caratula: "old.pdf"));
        p.CuentasFormaPago.Add(Cuenta(20, clabe: null, numeroCuenta: "5678", caratula: null));

        var s = StagingCloneOf(p);
        s.CuentasFormaPago.Add(StagingCuenta(10, clabe: null, numeroCuenta: "1234", caratula: "new.pdf"));
        s.CuentasFormaPago.Add(StagingCuenta(20, clabe: null, numeroCuenta: "5678", caratula: null));

        var diffs = ProveedorService.GenerarDiff(p, s);

        diffs.Should().ContainSingle();
        diffs[0].Label.Should().Be($"Carátula cuenta {TwoBullets}1234 actualizada");
    }

    [Fact]
    public void GenerarDiff_SinCambios_NoEmiteCaratula()
    {
        var p = NewProveedor(1, EstatusProveedor.Aprobado);
        p.CuentasFormaPago.Add(Cuenta(10, clabe: null, numeroCuenta: "1234", caratula: "same.pdf"));

        var s = StagingCloneOf(p);
        s.CuentasFormaPago.Add(StagingCuenta(10, clabe: null, numeroCuenta: "1234", caratula: "same.pdf"));

        var diffs = ProveedorService.GenerarDiff(p, s);

        diffs.Should().BeEmpty();
    }

[Theory]
    [InlineData("0321800000000001234", null, "1234")]            
    [InlineData(null, "000000001234", "1234")]                    
    [InlineData("  ", "1234", "1234")]                            
    [InlineData(null, null, "????")]                              
    [InlineData(null, "12", "12")]                                
    public void Ultimos4_DerivaCorrectamente(string? clabe, string? cuenta, string esperado)
    {
        ProveedorService.Ultimos4(clabe, cuenta).Should().Be(esperado);
    }

[Theory]
    [InlineData(EstatusProveedor.Nuevo, ProveedorService.RutaCaratula.Directo)]
    [InlineData(EstatusProveedor.Rechazado, ProveedorService.RutaCaratula.Directo)]
    [InlineData(EstatusProveedor.Aprobado, ProveedorService.RutaCaratula.Staging)]
    [InlineData(EstatusProveedor.EditadoPendiente, ProveedorService.RutaCaratula.Staging)]
    internal void DeterminarRutaCaratula_EstatusConocidos_RutaCorrecta(int estatus, ProveedorService.RutaCaratula esperado)
    {
        ProveedorService.DeterminarRutaCaratula(estatus).Should().Be(esperado);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(5)]
    [InlineData(99)]
    [InlineData(-1)]
    public void DeterminarRutaCaratula_EstatusDesconocido_DevuelveConflict(int estatus)
    {
        ProveedorService.DeterminarRutaCaratula(estatus).Should().Be(ProveedorService.RutaCaratula.Conflict);
    }
}
