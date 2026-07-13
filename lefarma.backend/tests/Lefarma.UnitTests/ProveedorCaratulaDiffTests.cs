using FluentAssertions;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.Proveedores;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;

namespace Lefarma.UnitTests;

/// <summary>
/// Pruebas puras (sin DB) de la lógica de diff de carátula por cuenta y del enrutamiento
/// por estatus. Cubre los escenarios de spec.md (labels exactos con ••{last4}) y el
/// invariante "standalone authorized upload → diff length == 1".
/// </summary>
public class ProveedorCaratulaDiffTests
{
    private const string TwoBullets = "••"; // dos U+2022 literales

    // ---------------------------------------------------------------------
    // Helpers de construcción de entidades (sólo los campos que GenerarDiff lee)
    // ---------------------------------------------------------------------

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
        IdCuen = idCuen,
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
        IdCuen = idCuen,
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

    // ---------------------------------------------------------------------
    // GenerarDiff — labels exactos de carátula
    // ---------------------------------------------------------------------

    [Fact]
    public void GenerarDiff_CaratulaActualizada_ContieneLabelExactoConUltimos4()
    {
        // Cuenta con CLABE terminada en 1234, carátula reemplazada
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
        // Cuenta existente que NO tenía carátula y ahora sí → "agregada"
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
        // Cuenta NUEVA (sin IdCuen en staging) que trae carátula → "agregada"
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
        s.RazonSocial = "FARMACIA SA DE CV"; // cambio adicional
        s.CuentasFormaPago.Add(StagingCuenta(10, clabe: null, numeroCuenta: "1234", caratula: "new.pdf"));

        var diffs = ProveedorService.GenerarDiff(p, s);

        diffs.Should().HaveCount(2);
        diffs.Should().Contain(d => d.Label == "Razón Social");
        diffs.Should().Contain(d => d.Label == $"Carátula cuenta {TwoBullets}1234 actualizada");
    }

    /// <summary>
    /// Invariante clave del diseño §4.3 / riesgo #6: una subida standalone a un proveedor
    /// autorizado debe producir un diff de longitud EXACTAMENTE 1 (sólo la carátula).
    /// StagearCaratulaAsync clona todo el estado live a staging; aquí simulamos ese clon
    /// y verificamos que GenerarDiff lo reduce a una sola entrada de carátula.
    /// </summary>
    [Fact]
    public void GenerarDiff_StandaloneAuthorizedUploadClone_DiffLengthEsUno()
    {
        // Live: 2 cuentas, sólo la cuenta objetivo tiene carátula vieja
        var p = NewProveedor(1, EstatusProveedor.Aprobado);
        p.CuentasFormaPago.Add(Cuenta(10, clabe: null, numeroCuenta: "1234", caratula: "old.pdf"));
        p.CuentasFormaPago.Add(Cuenta(20, clabe: null, numeroCuenta: "5678", caratula: null));

        // Staging = clon idéntico del live, EXCEPTO la cuenta objetivo cuya caratula cambia
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

    // ---------------------------------------------------------------------
    // Ultimos4 — preferencia CLABE > NumeroCuenta > "????"
    // ---------------------------------------------------------------------

    [Theory]
    [InlineData("0321800000000001234", null, "1234")]            // CLABE preferida
    [InlineData(null, "000000001234", "1234")]                    // fallback a número de cuenta
    [InlineData("  ", "1234", "1234")]                            // CLABE en blanco → cuenta
    [InlineData(null, null, "????")]                              // sin nada → ????
    [InlineData(null, "12", "12")]                                // menos de 4 → tal cual
    public void Ultimos4_DerivaCorrectamente(string? clabe, string? cuenta, string esperado)
    {
        ProveedorService.Ultimos4(clabe, cuenta).Should().Be(esperado);
    }

    // ---------------------------------------------------------------------
    // DeterminarRutaCaratula — tabla de decisión estatus (binding rules #2/#6)
    // ---------------------------------------------------------------------

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
