using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Features.Config.Engine;
using Lefarma.API.Features.Config.Workflows.Handlers;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories.Config;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Lefarma.UnitTests.Features.EducacionMedica;

/// <summary>
/// Motor de workflow REAL (WorkflowEngine + WorkflowRepository) sobre una BD InMemory con los
/// procesos de Educación Médica sembrados: workflows LINEALES por gerencia (ADR-00006,
/// ruteo por mappings de scope TIPO_GERENCIA), para probar los servicios.
/// </summary>
internal sealed class WorkflowTestHarness
{
    public required ApplicationDbContext Context { get; init; }
    public required AsokamDbContext Asokam { get; init; }
    public required WorkflowRepository WorkflowRepo { get; init; }
    public required WorkflowEngine Engine { get; init; }
    public required Mock<IJefeInmediatoResolver> JefeResolverMock { get; init; }

    // Selección (IMSS = principal; Desc. para el ruteo por gerencia)
    public required Workflow WfSeleccion { get; init; }
    public required Workflow WfSeleccionDesc { get; init; }
    public Dictionary<string, int> PasosSeleccion { get; } = new();
    public Dictionary<string, int> AccionesSeleccion { get; } = new();
    public Dictionary<string, int> PasosSeleccionDesc { get; } = new();
    public Dictionary<string, int> AccionesSeleccionDesc { get; } = new();

    // Rutas (IMSS = principal; Desc. solo para el resolver)
    public required Workflow WfRutas { get; init; }
    public required Workflow WfRutasDesc { get; init; }
    public Dictionary<string, int> PasosRutas { get; } = new();
    public Dictionary<string, int> AccionesRutas { get; } = new();

    public int UsuarioGg { get; init; } = 10;
    public int UsuarioGvImss { get; init; } = 20;
    public int UsuarioGvDesc { get; init; } = 30;
    public int UsuarioCa { get; init; } = 40;
    public int UsuarioDc { get; init; } = 50;

    public static WorkflowTestHarness Crear()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var context = new ApplicationDbContext(options);

        var asokamOptions = new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var asokam = new AsokamDbContext(asokamOptions);

        var tipoEnviar = new WorkflowTipoAccion { Codigo = "ENVIAR", Nombre = "Envío", CambiaEstado = true, Activo = true };
        var tipoAutorizar = new WorkflowTipoAccion { Codigo = "AUTORIZAR", Nombre = "Autorización", CambiaEstado = true, Activo = true };
        var tipoDevolver = new WorkflowTipoAccion { Codigo = "DEVOLVER", Nombre = "Devolución", CambiaEstado = true, Activo = true };
        var tipoCancelar = new WorkflowTipoAccion { Codigo = "CANCELAR", Nombre = "Cancelación", CambiaEstado = true, Activo = true };
        context.WorkflowTiposAccion.AddRange(tipoEnviar, tipoAutorizar, tipoDevolver, tipoCancelar);

        var estadoBorrador = new WorkflowEstados { Codigo = "CREADA", Nombre = "Creada", Activo = true };
        var estadoRevision = new WorkflowEstados { Codigo = "REVISION", Nombre = "En revisión", Activo = true };
        var estadoAprobacion = new WorkflowEstados { Codigo = "APROBACION", Nombre = "Aprobación", Activo = true };
        var estadoPreparacion = new WorkflowEstados { Codigo = "PREPARACION", Nombre = "Preparación", Activo = true };
        var estadoRevisionDirector = new WorkflowEstados { Codigo = "REVISION_DIRECTOR", Nombre = "Revisión Director", Activo = true };
        var estadoCancelada = new WorkflowEstados { Codigo = "CANCELADA", Nombre = "Cancelada", Activo = true };
        context.WorkflowEstados.AddRange(estadoBorrador, estadoRevision, estadoAprobacion, estadoPreparacion, estadoRevisionDirector, estadoCancelada);
        context.SaveChanges();

        // ----- Selección · 'Selección mensual - IMSS': Inicio -> GG -> GV IMSS -> Autorizada -----
        var wfSelImss = NuevoWorkflow(context, "Selección mensual - IMSS", CodigoProceso.EDUCACION_MEDICA_SELECCION);
        var siInicio = NuevoPaso(context, wfSelImss.IdWorkflow, 0, "Borrador", estadoBorrador.IdEstado, esInicio: true);
        var siGg = NuevoPaso(context, wfSelImss.IdWorkflow, 10, "Firma Gerencia General", estadoRevision.IdEstado);
        var siGv = NuevoPaso(context, wfSelImss.IdWorkflow, 20, "Firma Gerente de Ventas - IMSS", estadoRevision.IdEstado);
        var siFin = NuevoPaso(context, wfSelImss.IdWorkflow, 30, "Autorizada", estadoAprobacion.IdEstado, esFinal: true);
        var accSiEnviar = NuevaAccion(context, siInicio.IdPaso, siGg.IdPaso, tipoEnviar.IdTipoAccion);
        var accSiGgAutorizar = NuevaAccion(context, siGg.IdPaso, siGv.IdPaso, tipoAutorizar.IdTipoAccion);
        var accSiGgDevolver = NuevaAccion(context, siGg.IdPaso, siInicio.IdPaso, tipoDevolver.IdTipoAccion);
        var accSiGvAutorizar = NuevaAccion(context, siGv.IdPaso, siFin.IdPaso, tipoAutorizar.IdTipoAccion);
        var accSiGvDevolver = NuevaAccion(context, siGv.IdPaso, siInicio.IdPaso, tipoDevolver.IdTipoAccion);
        context.SaveChanges();

        // ----- Selección · 'Selección mensual - Descentralizado': Inicio -> GG -> GV Desc. -> Autorizada -----
        var wfSelDesc = NuevoWorkflow(context, "Selección mensual - Descentralizado", CodigoProceso.EDUCACION_MEDICA_SELECCION);
        var sdInicio = NuevoPaso(context, wfSelDesc.IdWorkflow, 0, "Borrador", estadoBorrador.IdEstado, esInicio: true);
        var sdGg = NuevoPaso(context, wfSelDesc.IdWorkflow, 10, "Firma Gerencia General", estadoRevision.IdEstado);
        var sdGv = NuevoPaso(context, wfSelDesc.IdWorkflow, 20, "Firma Gerente de Ventas - Descentralizado", estadoRevision.IdEstado);
        var sdFin = NuevoPaso(context, wfSelDesc.IdWorkflow, 30, "Autorizada", estadoAprobacion.IdEstado, esFinal: true);
        var accSdEnviar = NuevaAccion(context, sdInicio.IdPaso, sdGg.IdPaso, tipoEnviar.IdTipoAccion);
        var accSdGgAutorizar = NuevaAccion(context, sdGg.IdPaso, sdGv.IdPaso, tipoAutorizar.IdTipoAccion);
        var accSdGgDevolver = NuevaAccion(context, sdGg.IdPaso, sdInicio.IdPaso, tipoDevolver.IdTipoAccion);
        var accSdGvAutorizar = NuevaAccion(context, sdGv.IdPaso, sdFin.IdPaso, tipoAutorizar.IdTipoAccion);
        context.SaveChanges();

        // ----- Rutas · 'Rutas - IMSS': Draft -> GV IMSS -> CA -> DC -> Confirmada / Cancelada -----
        var wfRutImss = NuevoWorkflow(context, "Rutas - IMSS", CodigoProceso.EDUCACION_MEDICA_RUTAS);
        var riDraft = NuevoPaso(context, wfRutImss.IdWorkflow, 0, "Draft (en captura)", estadoBorrador.IdEstado, esInicio: true);
        var riGv = NuevoPaso(context, wfRutImss.IdWorkflow, 10, "Firma Gerente de Ventas - IMSS", estadoRevision.IdEstado);
        var riCa = NuevoPaso(context, wfRutImss.IdWorkflow, 20, "Revisión Coordinador Administrativo", estadoPreparacion.IdEstado);
        var riDc = NuevoPaso(context, wfRutImss.IdWorkflow, 30, "Autorización Dirección Corporativa", estadoRevisionDirector.IdEstado);
        var riFin = NuevoPaso(context, wfRutImss.IdWorkflow, 40, "Confirmada", estadoAprobacion.IdEstado, esFinal: true);
        var riCan = NuevoPaso(context, wfRutImss.IdWorkflow, 50, "Cancelada", estadoCancelada.IdEstado, esFinal: true);
        var accRiEnviar = NuevaAccion(context, riDraft.IdPaso, riGv.IdPaso, tipoEnviar.IdTipoAccion);
        var accRiGv = NuevaAccion(context, riGv.IdPaso, riCa.IdPaso, tipoAutorizar.IdTipoAccion);
        var accRiCa = NuevaAccion(context, riCa.IdPaso, riDc.IdPaso, tipoAutorizar.IdTipoAccion);
        var accRiDc = NuevaAccion(context, riDc.IdPaso, riFin.IdPaso, tipoAutorizar.IdTipoAccion);
        var accRiGvDevolver = NuevaAccion(context, riGv.IdPaso, riDraft.IdPaso, tipoDevolver.IdTipoAccion);
        var accRiCancelar = NuevaAccion(context, riDraft.IdPaso, riCan.IdPaso, tipoCancelar.IdTipoAccion);
        context.SaveChanges();

        // ----- Rutas · 'Rutas - Descentralizado' (para el resolver) -----
        var wfRutDesc = NuevoWorkflow(context, "Rutas - Descentralizado", CodigoProceso.EDUCACION_MEDICA_RUTAS);
        NuevoPaso(context, wfRutDesc.IdWorkflow, 0, "Draft (en captura)", estadoBorrador.IdEstado, esInicio: true);
        NuevoPaso(context, wfRutDesc.IdWorkflow, 10, "Firma Gerente de Ventas - Descentralizado", estadoRevision.IdEstado);
        context.SaveChanges();

        // Participantes (usuarios directos)
        context.WorkflowParticipantes.AddRange(
            new WorkflowParticipante { IdPaso = siGg.IdPaso, IdUsuario = 10, Activo = true },
            new WorkflowParticipante { IdPaso = siGv.IdPaso, IdUsuario = 20, Activo = true },
            new WorkflowParticipante { IdPaso = sdGg.IdPaso, IdUsuario = 10, Activo = true },
            new WorkflowParticipante { IdPaso = sdGv.IdPaso, IdUsuario = 30, Activo = true },
            new WorkflowParticipante { IdPaso = riGv.IdPaso, IdUsuario = 20, Activo = true },
            new WorkflowParticipante { IdPaso = riCa.IdPaso, IdUsuario = 40, Activo = true },
            new WorkflowParticipante { IdPaso = riDc.IdPaso, IdUsuario = 50, Activo = true });
        context.SaveChanges();

        // Navegaciones en memoria para el resolver (los servicios resuelven pasos iniciales y acciones)
        wfSelImss.Pasos = [siInicio, siGg, siGv, siFin];
        siInicio.AccionesOrigen = [accSiEnviar];
        siGg.AccionesOrigen = [accSiGgAutorizar, accSiGgDevolver];
        siGv.AccionesOrigen = [accSiGvAutorizar, accSiGvDevolver];
        siFin.AccionesOrigen = [];

        wfSelDesc.Pasos = [sdInicio, sdGg, sdGv, sdFin];
        sdInicio.AccionesOrigen = [accSdEnviar];
        sdGg.AccionesOrigen = [accSdGgAutorizar, accSdGgDevolver];
        sdGv.AccionesOrigen = [accSdGvAutorizar];

        wfRutImss.Pasos = [riDraft, riGv, riCa, riDc, riFin, riCan];
        riDraft.AccionesOrigen = [accRiEnviar, accRiCancelar];

        var jefeMock = new Mock<IJefeInmediatoResolver>();
        var provider = new ServiceCollection().BuildServiceProvider();
        var repo = new WorkflowRepository(context);
        var engine = new WorkflowEngine(repo, context, asokam, provider, jefeMock.Object,
            new HandlerConditionEvaluator(context));

        var harness = new WorkflowTestHarness
        {
            Context = context,
            Asokam = asokam,
            WorkflowRepo = repo,
            Engine = engine,
            JefeResolverMock = jefeMock,
            WfSeleccion = wfSelImss,
            WfSeleccionDesc = wfSelDesc,
            WfRutas = wfRutImss,
            WfRutasDesc = wfRutDesc,
        };

        harness.PasosSeleccion["Inicio"] = siInicio.IdPaso;
        harness.PasosSeleccion["Gg"] = siGg.IdPaso;
        harness.PasosSeleccion["GvImss"] = siGv.IdPaso;
        harness.PasosSeleccion["Final"] = siFin.IdPaso;
        harness.AccionesSeleccion["Enviar"] = accSiEnviar.IdAccion;
        harness.AccionesSeleccion["GgAutorizar"] = accSiGgAutorizar.IdAccion;
        harness.AccionesSeleccion["GgDevolver"] = accSiGgDevolver.IdAccion;
        harness.AccionesSeleccion["GvImssAutorizar"] = accSiGvAutorizar.IdAccion;

        harness.PasosSeleccionDesc["Inicio"] = sdInicio.IdPaso;
        harness.PasosSeleccionDesc["Gg"] = sdGg.IdPaso;
        harness.PasosSeleccionDesc["GvDesc"] = sdGv.IdPaso;
        harness.PasosSeleccionDesc["Final"] = sdFin.IdPaso;
        harness.AccionesSeleccionDesc["Enviar"] = accSdEnviar.IdAccion;
        harness.AccionesSeleccionDesc["GgAutorizar"] = accSdGgAutorizar.IdAccion;
        harness.AccionesSeleccionDesc["GvDescAutorizar"] = accSdGvAutorizar.IdAccion;

        harness.PasosRutas["Draft"] = riDraft.IdPaso;
        harness.PasosRutas["GvImss"] = riGv.IdPaso;
        harness.PasosRutas["Ca"] = riCa.IdPaso;
        harness.PasosRutas["Dc"] = riDc.IdPaso;
        harness.PasosRutas["Final"] = riFin.IdPaso;
        harness.PasosRutas["Cancelada"] = riCan.IdPaso;
        harness.AccionesRutas["Enviar"] = accRiEnviar.IdAccion;
        harness.AccionesRutas["GvImssAutorizar"] = accRiGv.IdAccion;
        harness.AccionesRutas["CaAutorizar"] = accRiCa.IdAccion;
        harness.AccionesRutas["DcAutorizar"] = accRiDc.IdAccion;
        harness.AccionesRutas["GvImssDevolver"] = accRiGvDevolver.IdAccion;
        harness.AccionesRutas["Cancelar"] = accRiCancelar.IdAccion;

        return harness;
    }

    private static Workflow NuevoWorkflow(ApplicationDbContext context, string nombre, string codigoProceso)
    {
        var workflow = new Workflow
        {
            Nombre = nombre,
            CodigoProceso = codigoProceso,
            Version = 1,
            Activo = true,
            FechaCreacion = DateTime.Now,
        };
        context.Workflows.Add(workflow);
        context.SaveChanges();
        return workflow;
    }

    private static WorkflowPaso NuevoPaso(
        ApplicationDbContext context,
        int idWorkflow,
        int orden,
        string nombre,
        int idEstado,
        bool esInicio = false,
        bool esFinal = false)
    {
        var paso = new WorkflowPaso
        {
            IdWorkflow = idWorkflow,
            Orden = orden,
            NombrePaso = nombre,
            IdEstado = idEstado,
            EsInicio = esInicio,
            EsFinal = esFinal,
            Activo = true,
        };
        context.WorkflowPasos.Add(paso);
        return paso;
    }

    private static WorkflowAccion NuevaAccion(ApplicationDbContext context, int idPasoOrigen, int idPasoDestino, int idTipoAccion)
    {
        var accion = new WorkflowAccion
        {
            IdPasoOrigen = idPasoOrigen,
            IdPasoDestino = idPasoDestino,
            IdTipoAccion = idTipoAccion,
            Activo = true,
        };
        context.WorkflowAcciones.Add(accion);
        return accion;
    }

    /// <summary>Mock del resolver: elige la variante por el scope TIPO_GERENCIA (1 = IMSS, 2 = Descentralizado).</summary>
    public Mock<IWorkflowResolver> CreateResolverMock()
    {
        var mock = new Mock<IWorkflowResolver>();
        mock.Setup(r => r.ResolveWorkflowIdAsync(It.IsAny<string>(), It.IsAny<Dictionary<string, int?>>()))
            .ReturnsAsync((string codigo, Dictionary<string, int?> scopes) =>
            {
                scopes.TryGetValue(WorkflowScope.TIPO_GERENCIA, out var gerencia);
                var esDesc = gerencia == 2;

                return codigo switch
                {
                    CodigoProceso.EDUCACION_MEDICA_SELECCION => esDesc ? WfSeleccionDesc : WfSeleccion,
                    CodigoProceso.EDUCACION_MEDICA_RUTAS => esDesc ? WfRutasDesc : WfRutas,
                    _ => null,
                };
            });
        return mock;
    }
}
