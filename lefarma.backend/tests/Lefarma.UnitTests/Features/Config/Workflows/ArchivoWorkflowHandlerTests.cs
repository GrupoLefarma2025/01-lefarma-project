using FluentAssertions;
using Lefarma.API.Domain.Entities.Archivos;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Features.Config.Workflows.Handlers;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.UnitTests.Features.Config.Workflows;

public class ArchivoWorkflowHandlerTests
{
    private static ApplicationDbContext CrearContexto()
        => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static WorkflowHandlerContext CrearContextoHandler(
        bool requerido = true,
        string nombreTecnico = "acta_matrimonio",
        int idEntidad = 10,
        WorkflowCampo? campo = null,
        int? idPaso = 3,
        Dictionary<string, object>? datosAdicionales = null)
        => new(
            Entidad: null!,
            IdEntidad: idEntidad,
            TipoEntidad: CodigoProceso.SOLICITUD_PERSONAL,
            IdAccion: 1,
            IdUsuario: 1,
            Comentario: null,
            DatosAdicionales: datosAdicionales,
            Handler: new WorkflowAccionHandler
            {
                IdHandler = 1,
                IdAccion = 1,
                HandlerKey = "Archivo",
                Requerido = requerido,
                Campo = campo ?? new WorkflowCampo
                {
                    IdWorkflowCampo = 1,
                    NombreTecnico = nombreTecnico,
                    EtiquetaUsuario = "Acta de matrimonio",
                    TipoControl = "Archivo"
                }
            },
            IdPaso: idPaso);

    private static void SembrarArchivo(
        ApplicationDbContext ctx, string metadata, bool activo = true, int idEntidad = 10)
        => ctx.Archivos.Add(new Archivo
        {
            EntidadTipo = "SolicitudPersonal",
            EntidadId = idEntidad,
            Carpeta = "solicitudes-personal",
            NombreOriginal = "acta.pdf",
            NombreFisico = "acta.pdf",
            Extension = ".pdf",
            TipoMime = "application/pdf",
            TamanoBytes = 1,
            Metadata = metadata,
            FechaCreacion = DateTime.Now,
            Activo = activo
        });

    [Fact]
    public async Task Requerido_Con_Archivo_De_Tipo_Correcto_Retorna_Exito()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, """{"tipo":"acta_matrimonio"}""");
        await ctx.SaveChangesAsync();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(CrearContextoHandler(), null);

        result.Exitoso.Should().BeTrue();
    }

    [Fact]
    public async Task Requerido_Sin_Archivos_Retorna_Error()
    {
        await using var ctx = CrearContexto();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(CrearContextoHandler(), null);

        result.Exitoso.Should().BeFalse();
        result.Error.Should().Contain("Acta de matrimonio");
    }

    [Fact]
    public async Task Requerido_Con_Archivo_De_Otro_Tipo_Retorna_Error()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, """{"tipo":"comprobante_domicilio"}""");
        await ctx.SaveChangesAsync();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(CrearContextoHandler(), null);

        result.Exitoso.Should().BeFalse();
    }

    [Fact]
    public async Task Requerido_Con_Archivo_Inactivo_Retorna_Error()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, """{"tipo":"acta_matrimonio"}""", activo: false);
        await ctx.SaveChangesAsync();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(CrearContextoHandler(), null);

        result.Exitoso.Should().BeFalse();
    }

    [Fact]
    public async Task No_Requerido_Sin_Archivos_Retorna_Exito()
    {
        await using var ctx = CrearContexto();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(
            CrearContextoHandler(requerido: false), null);

        result.Exitoso.Should().BeTrue();
    }

    [Fact]
    public async Task Handler_Sin_Campo_Retorna_Error()
    {
        await using var ctx = CrearContexto();
        var contexto = CrearContextoHandler() with
        {
            Handler = new WorkflowAccionHandler { IdHandler = 1, IdAccion = 1, HandlerKey = "Archivo" }
        };

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(contexto, null);

        result.Exitoso.Should().BeFalse();
        result.Error.Should().Contain("no tiene un campo vinculado");
    }

    [Fact]
    public async Task Metadata_Invalida_No_Cuenta_Como_Archivo_Valido()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, "no-es-json");
        await ctx.SaveChangesAsync();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(CrearContextoHandler(), null);

        result.Exitoso.Should().BeFalse();
    }

    [Fact]
    public async Task Archivo_De_Otra_Entidad_No_Cuenta()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, """{"tipo":"acta_matrimonio"}""", idEntidad: 99);
        await ctx.SaveChangesAsync();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(CrearContextoHandler(), null);

        result.Exitoso.Should().BeFalse();
    }

    [Fact]
    public async Task RequiereRevision_Sin_Marcar_Retorna_Error()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, """{"tipo":"acta_matrimonio"}""");
        await ctx.SaveChangesAsync();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(
            CrearContextoHandler(), """{"requiereRevision":true}""");

        result.Exitoso.Should().BeFalse();
        result.Error.Should().Contain("revisado");
    }

    [Fact]
    public async Task RequiereRevision_Marcada_Registra_Revision_Y_Retorna_Exito()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, """{"tipo":"acta_matrimonio","observaciones":"previo"}""");
        await ctx.SaveChangesAsync();

        var contexto = CrearContextoHandler(datosAdicionales: new Dictionary<string, object>
        {
            ["revision_acta_matrimonio"] = true
        });

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(
            contexto, """{"requiereRevision":true}""");

        result.Exitoso.Should().BeTrue();

        var metadata = ctx.Archivos.Single().Metadata!;
        metadata.Should().Contain("\"tipo\":\"acta_matrimonio\"");
        metadata.Should().Contain("\"observaciones\":\"previo\"");
        metadata.Should().Contain("\"revisiones\"");
        metadata.Should().Contain("\"3\"");
        metadata.Should().Contain("\"revisado\":true");
    }

    [Fact]
    public async Task RequiereRevision_Ya_Revisado_Retorna_Exito_Sin_Marcar()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, """{"tipo":"acta_matrimonio","revisiones":{"3":{"revisado":true}}}""");
        await ctx.SaveChangesAsync();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(
            CrearContextoHandler(), """{"requiereRevision":true}""");

        result.Exitoso.Should().BeTrue();
    }

    [Fact]
    public async Task RequiereRevision_De_Otro_Paso_No_Cuenta()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, """{"tipo":"acta_matrimonio","revisiones":{"5":{"revisado":true}}}""");
        await ctx.SaveChangesAsync();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(
            CrearContextoHandler(), """{"requiereRevision":true}""");

        result.Exitoso.Should().BeFalse();
    }

    [Fact]
    public async Task Sin_RequiereRevision_No_Exige_Marcar_Revisado()
    {
        await using var ctx = CrearContexto();
        SembrarArchivo(ctx, """{"tipo":"acta_matrimonio"}""");
        await ctx.SaveChangesAsync();

        var result = await new ArchivoWorkflowHandler(ctx).ProcessAsync(
            CrearContextoHandler(), """{"mensaje":"Sube el acta"}""");

        result.Exitoso.Should().BeTrue();
    }
}
