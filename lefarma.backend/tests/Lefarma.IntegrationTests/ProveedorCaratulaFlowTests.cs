using FluentAssertions;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.Proveedores;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Shared.Logging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using ErrorOr;

namespace Lefarma.IntegrationTests;

/// <summary>
/// Pruebas de integración (EF Core InMemory) del flujo de carátula por cuenta:
/// enrutamiento por estatus, staging para autorizados, promover al autorizar,
/// y rechazar sin tocar la cuenta live.
/// </summary>
public class ProveedorCaratulaFlowTests
{
    private const string TwoBullets = "••";

    private static (ApplicationDbContext db, ProveedorService service) BuildService(string dbId)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"caratula-flow-{dbId}-{Guid.NewGuid():N}")
            .Options;
        var db = new ApplicationDbContext(options);
        var repo = new ProveedorRepository(db);
        // RegimenFiscalRepository real (sólo se toca en Create/Update validation; nunca en el flujo de carátula).
        var regimenRepo = new RegimenFiscalRepository(db);
        var logger = NullLogger<ProveedorService>.Instance;
        var config = new ConfigurationBuilder().Build();
        var service = new ProveedorService(
            repo, regimenRepo, new NullWideEventAccessor(),
            logger, config, db);
        return (db, service);
    }

    /// <summary>
    /// Crea un proveedor en el DbContext InMemory y devuelve los IDs generados (IdProveedor + IdCuenta),
    /// para que cada test use las claves reales que EF asignó (InMemory puede reasignar claves explícitas).
    /// Seedea además los catálogos referenciados (RegimenFiscal, FormaPago, Banco) para que los
    /// Include/ThenInclude del repo resuelvan correctamente en InMemory.
    /// </summary>
    private static (int idProveedor, int idCuen) SeedProveedor(ApplicationDbContext db, int estatus, bool conCaratulaExistente)
    {
        db.RegimenesFiscales.Add(new RegimenFiscal { IdRegimenFiscal = 1, Clave = "601", Descripcion = "Régimen 1", TipoPersona = "F", Activo = true });
        db.FormasPago.Add(new FormaPago { IdFormaPago = 1, Nombre = "Transferencia", NombreNormalizado = "transferencia", Activo = true });
        db.Bancos.Add(new Banco { IdBanco = 1, Nombre = "Banco X", NombreNormalizado = "banco x", Activo = true });
        db.SaveChanges();

        var proveedor = new Proveedor
        {
            RazonSocial = "FARMACIA SA",
            RazonSocialNormalizada = "FARMACIA SA",
            RFC = "XAXX010101000",
            CodigoPostal = "01000",
            RegimenFiscalId = 1,
            UsoCfdi = "G03",
            SinDatosFiscales = false,
            Estatus = estatus,
            FechaRegistro = DateTime.UtcNow,
            Detalle = new ProveedorDetalle
            {
                PersonaContactoNombre = "Juan",
                ContactoTelefono = "55",
                ContactoEmail = "j@x.com"
            }
        };
        proveedor.CuentasFormaPago.Add(new ProveedorFormaPagoCuenta
        {
            IdFormaPago = 1,
            IdBanco = 1,
            NumeroCuenta = "000000001234",
            Clabe = null,
            Beneficiario = "Ben",
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            CaratulaPath = conCaratulaExistente ? "old.pdf" : null
        });
        db.Proveedores.Add(proveedor);
        db.SaveChanges();
        db.ChangeTracker.Clear();
        return (proveedor.IdProveedor, proveedor.CuentasFormaPago.First().IdCuenta);
    }

    // ---------------------------------------------------------------------
    // Prospecto (Nuevo) → escritura directa
    // ---------------------------------------------------------------------

    [Fact]
    public async Task SubirCaratulaCuenta_Nuevo_EscribeDirecto_SinStaging()
    {
        var (db, service) = BuildService("nuevo-direct");
        var (idProv, idCuen) = SeedProveedor(db, EstatusProveedor.Nuevo, conCaratulaExistente: false);

        var result = await service.SubirCaratulaCuentaAsync(idProv, idCuen, "caratulas/cuentas/new.pdf");

        result.IsError.Should().BeFalse();
        result.Value.Should().BeTrue();

        var cuenta = await db.ProveedoresFormasPagoCuentas.SingleAsync(c => c.IdCuenta == idCuen);
        cuenta.CaratulaPath.Should().Be("caratulas/cuentas/new.pdf");

        // Sin staging, sin cambio de estatus
        db.StagingProveedores.Should().BeEmpty();
        var proveedor = await db.Proveedores.SingleAsync(p => p.IdProveedor == idProv);
        proveedor.Estatus.Should().Be(EstatusProveedor.Nuevo);
    }

    // ---------------------------------------------------------------------
    // Autorizado (Aprobado) → staging; live intacto; diff == 1
    // ---------------------------------------------------------------------

    [Fact]
    public async Task SubirCaratulaCuenta_Aprobado_VaAStaging_CuentaLiveIntacta_DiffLongitudUno()
    {
        var (db, service) = BuildService("aprobado-stage");
        var (idProv, idCuen) = SeedProveedor(db, EstatusProveedor.Aprobado, conCaratulaExistente: true);

        var result = await service.SubirCaratulaCuentaAsync(idProv, idCuen, "caratulas/cuentas/new.pdf");

        result.IsError.Should().BeFalse();

        // Estatus → EditadoPendiente
        var proveedor = await db.Proveedores.SingleAsync(p => p.IdProveedor == idProv);
        proveedor.Estatus.Should().Be(EstatusProveedor.EditadoPendiente);

        // Staging creado; cuenta LIVE intacta (sigue con old.pdf)
        db.StagingProveedores.Should().ContainSingle();
        var cuentaLive = await db.ProveedoresFormasPagoCuentas.SingleAsync(c => c.IdCuenta == idCuen);
        cuentaLive.CaratulaPath.Should().Be("old.pdf", "la cuenta live no se toca durante staging");

        // Diff == 1 (sólo la carátula)
        var staging = await service.GetStagingByProveedorIdAsync(idProv);
        staging.IsError.Should().BeFalse();
        staging.Value.Diferencias.Should().ContainSingle();
        staging.Value.Diferencias[0].Label.Should().Be($"Carátula cuenta {TwoBullets}1234 actualizada");
    }

    // ---------------------------------------------------------------------
    // Aprobado → staging → AutorizarEdicion → promover carátula a live
    // ---------------------------------------------------------------------

    [Fact]
    public async Task AutorizarEdicion_PromueveCaratulaStagingALive()
    {
        var (db, service) = BuildService("aprobado-approve");
        var (idProv, idCuen) = SeedProveedor(db, EstatusProveedor.Aprobado, conCaratulaExistente: false);

        await service.SubirCaratulaCuentaAsync(idProv, idCuen, "caratulas/cuentas/new.pdf");
        var autorizar = await service.AutorizarEdicionAsync(idProv, idUsuario: 7);

        autorizar.IsError.Should().BeFalse();

        var cuenta = await db.ProveedoresFormasPagoCuentas.SingleAsync(c => c.IdCuenta == idCuen);
        cuenta.CaratulaPath.Should().Be("caratulas/cuentas/new.pdf", "la carátula stagingada se promueve a live");

        var proveedor = await db.Proveedores.SingleAsync(p => p.IdProveedor == idProv);
        proveedor.Estatus.Should().Be(EstatusProveedor.Aprobado);
        db.StagingProveedores.Should().BeEmpty();
    }

    // ---------------------------------------------------------------------
    // Aprobado → staging → RechazarEdicion → cuenta live intacta + estatus Aprobado
    // ---------------------------------------------------------------------

    [Fact]
    public async Task RechazarEdicion_CuentaLiveQuedaIntacta()
    {
        var (db, service) = BuildService("aprobado-reject");
        var (idProv, idCuen) = SeedProveedor(db, EstatusProveedor.Aprobado, conCaratulaExistente: false);

        await service.SubirCaratulaCuentaAsync(idProv, idCuen, "caratulas/cuentas/new.pdf");
        var rechazar = await service.RechazarEdicionAsync(idProv, idUsuario: 7);

        rechazar.IsError.Should().BeFalse();

        // La cuenta live sigue SIN carátula (nunca se tocó durante staging)
        var cuenta = await db.ProveedoresFormasPagoCuentas.SingleAsync(c => c.IdCuenta == idCuen);
        cuenta.CaratulaPath.Should().BeNull("el rechazo descarta el staging sin tocar la cuenta live");

        var proveedor = await db.Proveedores.SingleAsync(p => p.IdProveedor == idProv);
        proveedor.Estatus.Should().Be(EstatusProveedor.Aprobado);
        db.StagingProveedores.Should().BeEmpty();
    }

    // ---------------------------------------------------------------------
    // Cuenta inexistente → NotFound
    // ---------------------------------------------------------------------

    [Fact]
    public async Task SubirCaratulaCuenta_CuentaInexistente_DevuelveNotFound()
    {
        var (db, service) = BuildService("cuenta-missing");
        var (idProv, _) = SeedProveedor(db, EstatusProveedor.Aprobado, conCaratulaExistente: false);

        var result = await service.SubirCaratulaCuentaAsync(idProv, 9999, "caratulas/cuentas/x.pdf");

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorOr.ErrorType.NotFound);
    }
}
