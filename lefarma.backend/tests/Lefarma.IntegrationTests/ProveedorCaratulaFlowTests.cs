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
        var regimenRepo = new RegimenFiscalRepository(db);
        var logger = NullLogger<ProveedorService>.Instance;
        var config = new ConfigurationBuilder().Build();
        var service = new ProveedorService(
            repo, regimenRepo, new NullWideEventAccessor(),
            logger, config, db);
        return (db, service);
    }

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

        db.StagingProveedores.Should().BeEmpty();
        var proveedor = await db.Proveedores.SingleAsync(p => p.IdProveedor == idProv);
        proveedor.Estatus.Should().Be(EstatusProveedor.Nuevo);
    }

[Fact]
    public async Task SubirCaratulaCuenta_Aprobado_VaAStaging_CuentaLiveIntacta_DiffLongitudUno()
    {
        var (db, service) = BuildService("aprobado-stage");
        var (idProv, idCuen) = SeedProveedor(db, EstatusProveedor.Aprobado, conCaratulaExistente: true);

        var result = await service.SubirCaratulaCuentaAsync(idProv, idCuen, "caratulas/cuentas/new.pdf");

        result.IsError.Should().BeFalse();

        var proveedor = await db.Proveedores.SingleAsync(p => p.IdProveedor == idProv);
        proveedor.Estatus.Should().Be(EstatusProveedor.EditadoPendiente);

        db.StagingProveedores.Should().ContainSingle();
        var cuentaLive = await db.ProveedoresFormasPagoCuentas.SingleAsync(c => c.IdCuenta == idCuen);
        cuentaLive.CaratulaPath.Should().Be("old.pdf", "la cuenta live no se toca durante staging");

        var staging = await service.GetStagingByProveedorIdAsync(idProv);
        staging.IsError.Should().BeFalse();
        staging.Value.Diferencias.Should().ContainSingle();
        staging.Value.Diferencias[0].Label.Should().Be($"Carátula cuenta {TwoBullets}1234 actualizada");
    }

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

[Fact]
    public async Task RechazarEdicion_CuentaLiveQuedaIntacta()
    {
        var (db, service) = BuildService("aprobado-reject");
        var (idProv, idCuen) = SeedProveedor(db, EstatusProveedor.Aprobado, conCaratulaExistente: false);

        await service.SubirCaratulaCuentaAsync(idProv, idCuen, "caratulas/cuentas/new.pdf");
        var rechazar = await service.RechazarEdicionAsync(idProv, idUsuario: 7);

        rechazar.IsError.Should().BeFalse();

        var cuenta = await db.ProveedoresFormasPagoCuentas.SingleAsync(c => c.IdCuenta == idCuen);
        cuenta.CaratulaPath.Should().BeNull("el rechazo descarta el staging sin tocar la cuenta live");

        var proveedor = await db.Proveedores.SingleAsync(p => p.IdProveedor == idProv);
        proveedor.Estatus.Should().Be(EstatusProveedor.Aprobado);
        db.StagingProveedores.Should().BeEmpty();
    }

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
