using FluentAssertions;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Workflows.Handlers;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.UnitTests.Features.Config.Workflows;

public class HandlerConditionEvaluatorTests
{
    private static ApplicationDbContext CrearContexto()
        => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static SolicitudPersonal Solicitud(
        int tipo = 5, int empresa = 1, int sucursal = 1, int? area = 2)
        => new()
        {
            IdSolicitud = 1,
            Folio = "SOL-1",
            IdEmpresa = empresa,
            IdSucursal = sucursal,
            IdArea = area,
            IdWorkflow = 1,
            IdEstado = 1,
            IdUsuarioCreador = 1,
            IdUsuarioSolicitante = 1,
            IdTipoSolicitud = tipo,
            FechaCreacion = DateTime.Now
        };

    private static void SembrarTipo(ApplicationDbContext ctx, int id, CategoriaSolicitud categoria)
        => ctx.TiposSolicitud.Add(new TipoSolicitud
        {
            IdTipoSolicitud = id,
            Nombre = $"Tipo {id}",
            Descripcion = $"Tipo {id}",
            Clave = $"tipo{id}",
            Categoria = categoria,
            Activo = true
        });

    private static OrdenCompra Orden(
        int empresa = 1, int sucursal = 1, int area = 1, int tipoGasto = 1, int? proveedor = 10)
        => new()
        {
            IdOrden = 1,
            Folio = "OC-1",
            IdEmpresa = empresa,
            IdSucursal = sucursal,
            IdArea = area,
            IdTipoGasto = tipoGasto,
            IdProveedor = proveedor,
            IdWorkflow = 1,
            FechaCreacion = DateTime.Now
        };

    private static SeleccionMensual Seleccion(int? tipoGerencia = 1)
        => new()
        {
            IdSeleccionMensual = 1,
            IdTipoGerencia = tipoGerencia,
            FechaCreacion = DateTime.Now,
            FechaModificacion = DateTime.Now
        };

    private static RutaVersion Ruta(int? tipoGerencia = 1)
        => new()
        {
            IdRutaVersion = 1,
            IdSeleccionMensual = 1,
            Version = 1,
            IdTipoGerencia = tipoGerencia,
            FechaCreacion = DateTime.Now,
            FechaModificacion = DateTime.Now
        };

    private static Task<bool> Evaluar(
        ApplicationDbContext ctx, string? json, IWorkflowEntity? entidad,
        string tipoEntidad = CodigoProceso.SOLICITUD_PERSONAL)
        => new HandlerConditionEvaluator(ctx).AplicaAsync(json, entidad!, tipoEntidad);

    [Fact]
    public async Task Sin_Aplica_Retorna_True()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(ctx, null, Solicitud());

        result.Should().BeTrue();
    }

    [Fact]
    public async Task Json_Invalido_Retorna_True()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(ctx, "no-es-json", Solicitud());

        result.Should().BeTrue();
    }

    [Fact]
    public async Task Tipo_Incluido_Retorna_True()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(ctx, """{"aplica":{"tipoSolicitud":[5,7]}}""", Solicitud(tipo: 5));

        result.Should().BeTrue();
    }

    [Fact]
    public async Task Tipo_No_Incluido_Retorna_False()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(ctx, """{"aplica":{"tipoSolicitud":[7]}}""", Solicitud(tipo: 5));

        result.Should().BeFalse();
    }

    [Fact]
    public async Task Categoria_Coincide_Retorna_True()
    {
        await using var ctx = CrearContexto();
        SembrarTipo(ctx, 5, CategoriaSolicitud.Incidencia);
        await ctx.SaveChangesAsync();

        var result = await Evaluar(
            ctx, """{"aplica":{"categoria":[1]}}""", Solicitud(tipo: 5));

        result.Should().BeTrue();
    }

    [Fact]
    public async Task Categoria_No_Coincide_Retorna_False()
    {
        await using var ctx = CrearContexto();
        SembrarTipo(ctx, 5, CategoriaSolicitud.Incidencia);
        await ctx.SaveChangesAsync();

        var result = await Evaluar(
            ctx, """{"aplica":{"categoria":[2]}}""", Solicitud(tipo: 5));

        result.Should().BeFalse();
    }

    [Fact]
    public async Task Claves_Distintas_Se_Combinan_Con_And()
    {
        await using var ctx = CrearContexto();

        // tipo coincide pero empresa no → false
        var result = await Evaluar(
            ctx, """{"aplica":{"tipoSolicitud":[5],"empresa":[99]}}""",
            Solicitud(tipo: 5, empresa: 1));

        result.Should().BeFalse();
    }

    [Fact]
    public async Task Listas_Vacias_Retornan_True()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(ctx, """{"aplica":{"tipoSolicitud":[]}}""", Solicitud());

        result.Should().BeTrue();
    }

    [Fact]
    public async Task Sucursal_Y_Area_Se_Evaluan()
    {
        await using var ctx = CrearContexto();

        var coincide = await Evaluar(
            ctx, """{"aplica":{"sucursal":[3],"area":[4]}}""",
            Solicitud(sucursal: 3, area: 4));
        coincide.Should().BeTrue();

        var noCoincide = await Evaluar(
            ctx, """{"aplica":{"sucursal":[9]}}""",
            Solicitud(sucursal: 3));
        noCoincide.Should().BeFalse();
    }

    [Fact]
    public async Task Otro_Proceso_Retorna_True()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(
            ctx, """{"aplica":{"tipoSolicitud":[7]}}""", Solicitud(tipo: 5),
            tipoEntidad: CodigoProceso.ORDEN_COMPRA);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task Entidad_Nula_Retorna_True()
    {
        await using var ctx = CrearContexto();

        var result = await new HandlerConditionEvaluator(ctx)
            .AplicaAsync("""{"aplica":{"tipoSolicitud":[7]}}""", null!, CodigoProceso.SOLICITUD_PERSONAL);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task TieneCondiciones_Detecta_Aplica_Con_Listas()
    {
        HandlerConditionEvaluator.TieneCondiciones("""{"mensaje":"x"}""").Should().BeFalse();
        HandlerConditionEvaluator.TieneCondiciones("""{"aplica":{"tipoSolicitud":[]}}""").Should().BeFalse();
        HandlerConditionEvaluator.TieneCondiciones("""{"aplica":{"tipoSolicitud":[1]}}""").Should().BeTrue();
    }

    [Fact]
    public async Task OrdenCompra_TipoGasto_No_Incluido_Retorna_False()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(
            ctx, """{"aplica":{"tipoGasto":[9]}}""", Orden(tipoGasto: 1),
            CodigoProceso.ORDEN_COMPRA);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task OrdenCompra_Empresa_Y_TipoGasto_Se_Combinan_Con_And()
    {
        await using var ctx = CrearContexto();

        var coincide = await Evaluar(
            ctx, """{"aplica":{"empresa":[1],"tipoGasto":[2]}}""",
            Orden(empresa: 1, tipoGasto: 2), CodigoProceso.ORDEN_COMPRA);
        coincide.Should().BeTrue();

        var noCoincide = await Evaluar(
            ctx, """{"aplica":{"empresa":[1],"tipoGasto":[9]}}""",
            Orden(empresa: 1, tipoGasto: 2), CodigoProceso.ORDEN_COMPRA);
        noCoincide.Should().BeFalse();
    }

    [Fact]
    public async Task OrdenCompra_Proveedor_Nulo_No_Coincide()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(
            ctx, """{"aplica":{"proveedor":[10]}}""", Orden(proveedor: null),
            CodigoProceso.ORDEN_COMPRA);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task OrdenCompra_Proveedor_Coincide()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(
            ctx, """{"aplica":{"proveedor":[10]}}""", Orden(proveedor: 10),
            CodigoProceso.ORDEN_COMPRA);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task EducacionMedicaSeleccion_TipoGerencia_Se_Evalua()
    {
        await using var ctx = CrearContexto();

        var coincide = await Evaluar(
            ctx, """{"aplica":{"tipoGerencia":[1]}}""", Seleccion(tipoGerencia: 1),
            CodigoProceso.EDUCACION_MEDICA_SELECCION);
        coincide.Should().BeTrue();

        var noCoincide = await Evaluar(
            ctx, """{"aplica":{"tipoGerencia":[2]}}""", Seleccion(tipoGerencia: 1),
            CodigoProceso.EDUCACION_MEDICA_SELECCION);
        noCoincide.Should().BeFalse();

        var nulo = await Evaluar(
            ctx, """{"aplica":{"tipoGerencia":[1]}}""", Seleccion(tipoGerencia: null),
            CodigoProceso.EDUCACION_MEDICA_SELECCION);
        nulo.Should().BeFalse();
    }

    [Fact]
    public async Task EducacionMedicaRutas_TipoGerencia_Se_Evalua()
    {
        await using var ctx = CrearContexto();

        var coincide = await Evaluar(
            ctx, """{"aplica":{"tipoGerencia":[1]}}""", Ruta(tipoGerencia: 1),
            CodigoProceso.EDUCACION_MEDICA_RUTAS);
        coincide.Should().BeTrue();

        var noCoincide = await Evaluar(
            ctx, """{"aplica":{"tipoGerencia":[2]}}""", Ruta(tipoGerencia: 1),
            CodigoProceso.EDUCACION_MEDICA_RUTAS);
        noCoincide.Should().BeFalse();
    }

    [Fact]
    public async Task Proceso_No_Soportado_Con_Aplica_Retorna_True()
    {
        await using var ctx = CrearContexto();

        var result = await Evaluar(
            ctx, """{"aplica":{"tipoGasto":[9]}}""", Orden(tipoGasto: 1), "OTRO_PROCESO");

        result.Should().BeTrue();
    }
}
