using Lefarma.API.Domain.Entities.Auth;
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
/// procesos de Educación Médica sembrados: workflows LINEALES por gerencia con el patrón
/// Creada -> firmas -> Cerrada/Rechazada/Cancelada (ADR-00006), ruteo por mappings de scope
/// TIPO_GERENCIA, para probar los servicios.
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

    // Matriz de talleres (IMSS = principal; Desc. para el resolver y la bandeja)
    public required Workflow WfMatriz { get; init; }
    public required Workflow WfMatrizDesc { get; init; }
    public Dictionary<string, int> PasosMatriz { get; } = new();
    public Dictionary<string, int> AccionesMatriz { get; } = new();

    public int UsuarioGg { get; init; } = 10;
    public int UsuarioGvImss { get; init; } = 20;
    public int UsuarioGvDesc { get; init; } = 30;
    public int UsuarioCa { get; init; } = 40;
    public int UsuarioDc { get; init; } = 50;
    public int UsuarioAem { get; init; } = 60;

    public static WorkflowTestHarness Crear()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var context = new ApplicationDbContext(options);

        var asokamOptions = new DbContextOptionsBuilder<AsokamDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var asokam = new AsokamDbContext(asokamOptions);

        // CodigoProceso es requerido por la configuración EF (los tipos EM son por proceso).
        const string procesoEm = CodigoProceso.EDUCACION_MEDICA_SELECCION;
        var tipoEnviar = new WorkflowTipoAccion { Codigo = "ENVIAR", Nombre = "Envío", CambiaEstado = true, Activo = true, CodigoProceso = procesoEm };
        var tipoAutorizar = new WorkflowTipoAccion { Codigo = "AUTORIZAR", Nombre = "Autorización", CambiaEstado = true, Activo = true, CodigoProceso = procesoEm };
        var tipoDevolver = new WorkflowTipoAccion { Codigo = "DEVOLVER", Nombre = "Devolución", CambiaEstado = true, Activo = true, CodigoProceso = procesoEm };
        var tipoCancelar = new WorkflowTipoAccion { Codigo = "CANCELAR", Nombre = "Cancelación", CambiaEstado = true, Activo = true, CodigoProceso = procesoEm };
        var tipoCerrar = new WorkflowTipoAccion { Codigo = "CERRAR", Nombre = "Cierre", CambiaEstado = true, Activo = true, CodigoProceso = procesoEm };
        var tipoRechazar = new WorkflowTipoAccion { Codigo = "RECHAZAR", Nombre = "Rechazo", CambiaEstado = true, Activo = true, CodigoProceso = procesoEm };
        context.WorkflowTiposAccion.AddRange(tipoEnviar, tipoAutorizar, tipoDevolver, tipoCancelar, tipoCerrar, tipoRechazar);

        var estadoCreada = new WorkflowEstados { Codigo = "CREADA", Nombre = "Creada", Activo = true };
        var estadoRevision = new WorkflowEstados { Codigo = "REVISION", Nombre = "En revisión", Activo = true };
        var estadoCerrada = new WorkflowEstados { Codigo = "CERRADA", Nombre = "Cerrada", Activo = true };
        var estadoRechazada = new WorkflowEstados { Codigo = "RECHAZADA", Nombre = "Rechazada", Activo = true };
        var estadoCancelada = new WorkflowEstados { Codigo = "CANCELADA", Nombre = "Cancelada", Activo = true };
        var estadoPreparacion = new WorkflowEstados { Codigo = "PREPARACION", Nombre = "Preparación", Activo = true };
        var estadoRevisionDirector = new WorkflowEstados { Codigo = "REVISION_DIRECTOR", Nombre = "Revisión Director", Activo = true };
        context.WorkflowEstados.AddRange(
            estadoCreada, estadoRevision, estadoCerrada, estadoRechazada, estadoCancelada,
            estadoPreparacion, estadoRevisionDirector);
        context.SaveChanges();

        // ----- Selección · 'Selección mensual - IMSS'
        //       Creada -> Firma GG -> Firma GV IMSS -> Cerrada / Rechazada / Cancelada -----
        var wfSelImss = NuevoWorkflow(context, "Selección mensual - IMSS", CodigoProceso.EDUCACION_MEDICA_SELECCION);
        var siCreada = NuevoPaso(context, wfSelImss.IdWorkflow, 0, "Creada", estadoCreada.IdEstado, esInicio: true);
        var siGg = NuevoPaso(context, wfSelImss.IdWorkflow, 10, "Firma Gerencia General", estadoRevision.IdEstado, requiereFirma: true);
        var siGv = NuevoPaso(context, wfSelImss.IdWorkflow, 20, "Firma Gerente de Ventas - IMSS", estadoRevision.IdEstado, requiereFirma: true);
        var siFin = NuevoPaso(context, wfSelImss.IdWorkflow, 30, "Cerrada", estadoCerrada.IdEstado, esFinal: true);
        var siRech = NuevoPaso(context, wfSelImss.IdWorkflow, 40, "Rechazada", estadoRechazada.IdEstado, esFinal: true);
        var siCan = NuevoPaso(context, wfSelImss.IdWorkflow, 50, "Cancelada", estadoCancelada.IdEstado, esFinal: true);

        var accSiEnviar = NuevaAccion(context, siCreada.IdPaso, siGg.IdPaso, tipoEnviar.IdTipoAccion);
        var accSiCancelar = NuevaAccion(context, siCreada.IdPaso, siCan.IdPaso, tipoCancelar.IdTipoAccion);
        var accSiGgAutorizar = NuevaAccion(context, siGg.IdPaso, siGv.IdPaso, tipoAutorizar.IdTipoAccion);
        var accSiGgDevolver = NuevaAccion(context, siGg.IdPaso, siCreada.IdPaso, tipoDevolver.IdTipoAccion);
        var accSiGgRechazar = NuevaAccion(context, siGg.IdPaso, siRech.IdPaso, tipoRechazar.IdTipoAccion);
        var accSiGgCancelar = NuevaAccion(context, siGg.IdPaso, siCan.IdPaso, tipoCancelar.IdTipoAccion);
        var accSiGvCerrar = NuevaAccion(context, siGv.IdPaso, siFin.IdPaso, tipoCerrar.IdTipoAccion);
        var accSiGvDevolver = NuevaAccion(context, siGv.IdPaso, siCreada.IdPaso, tipoDevolver.IdTipoAccion);
        var accSiGvRechazar = NuevaAccion(context, siGv.IdPaso, siRech.IdPaso, tipoRechazar.IdTipoAccion);
        context.SaveChanges();

        // ----- Selección · 'Selección mensual - Descentralizado' -----
        var wfSelDesc = NuevoWorkflow(context, "Selección mensual - Descentralizado", CodigoProceso.EDUCACION_MEDICA_SELECCION);
        var sdCreada = NuevoPaso(context, wfSelDesc.IdWorkflow, 0, "Creada", estadoCreada.IdEstado, esInicio: true);
        var sdGg = NuevoPaso(context, wfSelDesc.IdWorkflow, 10, "Firma Gerencia General", estadoRevision.IdEstado, requiereFirma: true);
        var sdGv = NuevoPaso(context, wfSelDesc.IdWorkflow, 20, "Firma Gerente de Ventas - Descentralizado", estadoRevision.IdEstado, requiereFirma: true);
        var sdFin = NuevoPaso(context, wfSelDesc.IdWorkflow, 30, "Cerrada", estadoCerrada.IdEstado, esFinal: true);
        var sdRech = NuevoPaso(context, wfSelDesc.IdWorkflow, 40, "Rechazada", estadoRechazada.IdEstado, esFinal: true);
        var sdCan = NuevoPaso(context, wfSelDesc.IdWorkflow, 50, "Cancelada", estadoCancelada.IdEstado, esFinal: true);

        var accSdEnviar = NuevaAccion(context, sdCreada.IdPaso, sdGg.IdPaso, tipoEnviar.IdTipoAccion);
        var accSdCancelar = NuevaAccion(context, sdCreada.IdPaso, sdCan.IdPaso, tipoCancelar.IdTipoAccion);
        var accSdGgAutorizar = NuevaAccion(context, sdGg.IdPaso, sdGv.IdPaso, tipoAutorizar.IdTipoAccion);
        var accSdGgDevolver = NuevaAccion(context, sdGg.IdPaso, sdCreada.IdPaso, tipoDevolver.IdTipoAccion);
        var accSdGgRechazar = NuevaAccion(context, sdGg.IdPaso, sdRech.IdPaso, tipoRechazar.IdTipoAccion);
        var accSdGvCerrar = NuevaAccion(context, sdGv.IdPaso, sdFin.IdPaso, tipoCerrar.IdTipoAccion);
        var accSdGvDevolver = NuevaAccion(context, sdGv.IdPaso, sdCreada.IdPaso, tipoDevolver.IdTipoAccion);
        var accSdGvRechazar = NuevaAccion(context, sdGv.IdPaso, sdRech.IdPaso, tipoRechazar.IdTipoAccion);
        context.SaveChanges();

        // ----- Rutas · 'Rutas - IMSS'
        //       Creada -> Firma GV IMSS -> CA -> DC -> Cerrada / Rechazada / Cancelada -----
        var wfRutImss = NuevoWorkflow(context, "Rutas - IMSS", CodigoProceso.EDUCACION_MEDICA_RUTAS);
        var riCreada = NuevoPaso(context, wfRutImss.IdWorkflow, 0, "Creada", estadoCreada.IdEstado, esInicio: true);
        var riGv = NuevoPaso(context, wfRutImss.IdWorkflow, 10, "Firma Gerente de Ventas - IMSS", estadoRevision.IdEstado, requiereFirma: true);
        var riCa = NuevoPaso(context, wfRutImss.IdWorkflow, 20, "Revisión Coordinador Administrativo", estadoPreparacion.IdEstado, requiereFirma: true);
        var riDc = NuevoPaso(context, wfRutImss.IdWorkflow, 30, "Autorización Dirección Corporativa", estadoRevisionDirector.IdEstado, requiereFirma: true);
        var riFin = NuevoPaso(context, wfRutImss.IdWorkflow, 40, "Cerrada", estadoCerrada.IdEstado, esFinal: true);
        var riRech = NuevoPaso(context, wfRutImss.IdWorkflow, 50, "Rechazada", estadoRechazada.IdEstado, esFinal: true);
        var riCan = NuevoPaso(context, wfRutImss.IdWorkflow, 60, "Cancelada", estadoCancelada.IdEstado, esFinal: true);

        var accRiEnviar = NuevaAccion(context, riCreada.IdPaso, riGv.IdPaso, tipoEnviar.IdTipoAccion);
        var accRiCancelar = NuevaAccion(context, riCreada.IdPaso, riCan.IdPaso, tipoCancelar.IdTipoAccion);
        var accRiGv = NuevaAccion(context, riGv.IdPaso, riCa.IdPaso, tipoAutorizar.IdTipoAccion);
        var accRiGvDevolver = NuevaAccion(context, riGv.IdPaso, riCreada.IdPaso, tipoDevolver.IdTipoAccion);
        var accRiGvRechazar = NuevaAccion(context, riGv.IdPaso, riRech.IdPaso, tipoRechazar.IdTipoAccion);
        var accRiCa = NuevaAccion(context, riCa.IdPaso, riDc.IdPaso, tipoAutorizar.IdTipoAccion);
        var accRiCaDevolver = NuevaAccion(context, riCa.IdPaso, riCreada.IdPaso, tipoDevolver.IdTipoAccion);
        var accRiCaRechazar = NuevaAccion(context, riCa.IdPaso, riRech.IdPaso, tipoRechazar.IdTipoAccion);
        var accRiDc = NuevaAccion(context, riDc.IdPaso, riFin.IdPaso, tipoCerrar.IdTipoAccion);
        var accRiDcDevolver = NuevaAccion(context, riDc.IdPaso, riCreada.IdPaso, tipoDevolver.IdTipoAccion);
        var accRiDcRechazar = NuevaAccion(context, riDc.IdPaso, riRech.IdPaso, tipoRechazar.IdTipoAccion);
        context.SaveChanges();

        // ----- Rutas · 'Rutas - Descentralizado' (para el resolver) -----
        var wfRutDesc = NuevoWorkflow(context, "Rutas - Descentralizado", CodigoProceso.EDUCACION_MEDICA_RUTAS);
        var rdCreada = NuevoPaso(context, wfRutDesc.IdWorkflow, 0, "Creada", estadoCreada.IdEstado, esInicio: true);
        var rdGv = NuevoPaso(context, wfRutDesc.IdWorkflow, 10, "Firma Gerente de Ventas - Descentralizado", estadoRevision.IdEstado, requiereFirma: true);
        context.SaveChanges();

        // ----- Matriz · 'Matriz de talleres - IMSS'
        //       Creada -> Firma GV IMSS -> Costos AEM -> CA -> DC -> Cerrada / Rechazada / Cancelada -----
        var wfMatImss = NuevoWorkflow(context, "Matriz de talleres - IMSS", CodigoProceso.EDUCACION_MEDICA_MATRIZ);
        var miCreada = NuevoPaso(context, wfMatImss.IdWorkflow, 0, "Creada", estadoCreada.IdEstado, esInicio: true);
        var miGv = NuevoPaso(context, wfMatImss.IdWorkflow, 10, "Firma Gerente de Ventas - IMSS", estadoRevision.IdEstado, requiereFirma: true);
        var miAem = NuevoPaso(context, wfMatImss.IdWorkflow, 20, "Registro de costos - AEM", estadoPreparacion.IdEstado);
        var miCa = NuevoPaso(context, wfMatImss.IdWorkflow, 30, "Revisión de costos - CA", estadoRevision.IdEstado, requiereFirma: true);
        var miDc = NuevoPaso(context, wfMatImss.IdWorkflow, 40, "Autorización - DC", estadoRevisionDirector.IdEstado, requiereFirma: true);
        var miFin = NuevoPaso(context, wfMatImss.IdWorkflow, 50, "Cerrada", estadoCerrada.IdEstado, esFinal: true);
        var miR = NuevoPaso(context, wfMatImss.IdWorkflow, 60, "Rechazada", estadoRechazada.IdEstado, esFinal: true);
        var miCan = NuevoPaso(context, wfMatImss.IdWorkflow, 70, "Cancelada", estadoCancelada.IdEstado, esFinal: true);

        var accMiEnviar = NuevaAccion(context, miCreada.IdPaso, miGv.IdPaso, tipoEnviar.IdTipoAccion);
        var accMiCancelar = NuevaAccion(context, miCreada.IdPaso, miCan.IdPaso, tipoCancelar.IdTipoAccion);
        var accMiGvAutorizar = NuevaAccion(context, miGv.IdPaso, miAem.IdPaso, tipoAutorizar.IdTipoAccion);
        var accMiGvDevolver = NuevaAccion(context, miGv.IdPaso, miCreada.IdPaso, tipoDevolver.IdTipoAccion);
        var accMiGvRechazar = NuevaAccion(context, miGv.IdPaso, miR.IdPaso, tipoRechazar.IdTipoAccion);
        var accMiAemEnviar = NuevaAccion(context, miAem.IdPaso, miCa.IdPaso, tipoEnviar.IdTipoAccion);
        var accMiAemDevolver = NuevaAccion(context, miAem.IdPaso, miCreada.IdPaso, tipoDevolver.IdTipoAccion);
        var accMiAemRechazar = NuevaAccion(context, miAem.IdPaso, miR.IdPaso, tipoRechazar.IdTipoAccion);
        var accMiCaAutorizar = NuevaAccion(context, miCa.IdPaso, miDc.IdPaso, tipoAutorizar.IdTipoAccion);
        var accMiCaDevolver = NuevaAccion(context, miCa.IdPaso, miAem.IdPaso, tipoDevolver.IdTipoAccion);
        var accMiCaRechazar = NuevaAccion(context, miCa.IdPaso, miR.IdPaso, tipoRechazar.IdTipoAccion);
        var accMiDcCerrar = NuevaAccion(context, miDc.IdPaso, miFin.IdPaso, tipoCerrar.IdTipoAccion);
        var accMiDcDevolver = NuevaAccion(context, miDc.IdPaso, miCa.IdPaso, tipoDevolver.IdTipoAccion);
        var accMiDcRechazar = NuevaAccion(context, miDc.IdPaso, miR.IdPaso, tipoRechazar.IdTipoAccion);
        context.SaveChanges();

        // ----- Matriz · 'Matriz de talleres - Descentralizado' (para el resolver) -----
        var wfMatDesc = NuevoWorkflow(context, "Matriz de talleres - Descentralizado", CodigoProceso.EDUCACION_MEDICA_MATRIZ);
        var mdCreada = NuevoPaso(context, wfMatDesc.IdWorkflow, 0, "Creada", estadoCreada.IdEstado, esInicio: true);
        var mdGv = NuevoPaso(context, wfMatDesc.IdWorkflow, 10, "Firma Gerente de Ventas - Descentralizado", estadoRevision.IdEstado, requiereFirma: true);
        context.SaveChanges();

        // Participantes (usuarios directos)
        context.WorkflowParticipantes.AddRange(
            new WorkflowParticipante { IdPaso = siGg.IdPaso, IdUsuario = 10, Activo = true },
            new WorkflowParticipante { IdPaso = siGv.IdPaso, IdUsuario = 20, Activo = true },
            new WorkflowParticipante { IdPaso = sdGg.IdPaso, IdUsuario = 10, Activo = true },
            new WorkflowParticipante { IdPaso = sdGv.IdPaso, IdUsuario = 30, Activo = true },
            new WorkflowParticipante { IdPaso = riGv.IdPaso, IdUsuario = 20, Activo = true },
            new WorkflowParticipante { IdPaso = riCa.IdPaso, IdUsuario = 40, Activo = true },
            new WorkflowParticipante { IdPaso = riDc.IdPaso, IdUsuario = 50, Activo = true },
            new WorkflowParticipante { IdPaso = miCreada.IdPaso, IdUsuario = 20, Activo = true },
            new WorkflowParticipante { IdPaso = miGv.IdPaso, IdUsuario = 20, Activo = true },
            new WorkflowParticipante { IdPaso = miAem.IdPaso, IdUsuario = 60, Activo = true },
            new WorkflowParticipante { IdPaso = miCa.IdPaso, IdUsuario = 40, Activo = true },
            new WorkflowParticipante { IdPaso = miDc.IdPaso, IdUsuario = 50, Activo = true });
        context.SaveChanges();

        // Navegaciones en memoria para el resolver (los servicios resuelven pasos iniciales y acciones)
        wfSelImss.Pasos = [siCreada, siGg, siGv, siFin, siRech, siCan];
        siCreada.AccionesOrigen = [accSiEnviar, accSiCancelar];
        siGg.AccionesOrigen = [accSiGgAutorizar, accSiGgDevolver, accSiGgRechazar, accSiGgCancelar];
        siGv.AccionesOrigen = [accSiGvCerrar, accSiGvDevolver, accSiGvRechazar];
        siFin.AccionesOrigen = [];
        siRech.AccionesOrigen = [];
        siCan.AccionesOrigen = [];

        wfSelDesc.Pasos = [sdCreada, sdGg, sdGv, sdFin, sdRech, sdCan];
        sdCreada.AccionesOrigen = [accSdEnviar, accSdCancelar];
        sdGg.AccionesOrigen = [accSdGgAutorizar, accSdGgDevolver, accSdGgRechazar];
        sdGv.AccionesOrigen = [accSdGvCerrar, accSdGvDevolver, accSdGvRechazar];
        sdFin.AccionesOrigen = [];
        sdRech.AccionesOrigen = [];
        sdCan.AccionesOrigen = [];

        wfRutImss.Pasos = [riCreada, riGv, riCa, riDc, riFin, riRech, riCan];
        riCreada.AccionesOrigen = [accRiEnviar, accRiCancelar];
        riGv.AccionesOrigen = [accRiGv, accRiGvDevolver, accRiGvRechazar];
        riCa.AccionesOrigen = [accRiCa, accRiCaDevolver, accRiCaRechazar];
        riDc.AccionesOrigen = [accRiDc, accRiDcDevolver, accRiDcRechazar];
        riFin.AccionesOrigen = [];
        riRech.AccionesOrigen = [];
        riCan.AccionesOrigen = [];

        wfRutDesc.Pasos = [rdCreada, rdGv];
        rdCreada.AccionesOrigen = [];

        wfMatImss.Pasos = [miCreada, miGv, miAem, miCa, miDc, miFin, miR, miCan];
        miCreada.AccionesOrigen = [accMiEnviar, accMiCancelar];
        miGv.AccionesOrigen = [accMiGvAutorizar, accMiGvDevolver, accMiGvRechazar];
        miAem.AccionesOrigen = [accMiAemEnviar, accMiAemDevolver, accMiAemRechazar];
        miCa.AccionesOrigen = [accMiCaAutorizar, accMiCaDevolver, accMiCaRechazar];
        miDc.AccionesOrigen = [accMiDcCerrar, accMiDcDevolver, accMiDcRechazar];
        miFin.AccionesOrigen = [];
        miR.AccionesOrigen = [];
        miCan.AccionesOrigen = [];

        wfMatDesc.Pasos = [mdCreada, mdGv];
        mdCreada.AccionesOrigen = [];

        var jefeMock = new Mock<IJefeInmediatoResolver>();
        var provider = new ServiceCollection().BuildServiceProvider();
        var repo = new WorkflowRepository(context);
        var engine = new WorkflowEngine(repo, context, asokam, provider, jefeMock.Object, new HandlerConditionEvaluator(context));

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
            WfMatriz = wfMatImss,
            WfMatrizDesc = wfMatDesc,
        };

        harness.PasosSeleccion["Inicio"] = siCreada.IdPaso;
        harness.PasosSeleccion["Creada"] = siCreada.IdPaso;
        harness.PasosSeleccion["Gg"] = siGg.IdPaso;
        harness.PasosSeleccion["GvImss"] = siGv.IdPaso;
        harness.PasosSeleccion["Final"] = siFin.IdPaso;
        harness.PasosSeleccion["Rechazada"] = siRech.IdPaso;
        harness.PasosSeleccion["Cancelada"] = siCan.IdPaso;
        harness.AccionesSeleccion["Enviar"] = accSiEnviar.IdAccion;
        harness.AccionesSeleccion["Cancelar"] = accSiCancelar.IdAccion;
        harness.AccionesSeleccion["GgAutorizar"] = accSiGgAutorizar.IdAccion;
        harness.AccionesSeleccion["GgDevolver"] = accSiGgDevolver.IdAccion;
        harness.AccionesSeleccion["GgRechazar"] = accSiGgRechazar.IdAccion;
        harness.AccionesSeleccion["GgCancelar"] = accSiGgCancelar.IdAccion;
        harness.AccionesSeleccion["GvImssCerrar"] = accSiGvCerrar.IdAccion;
        harness.AccionesSeleccion["GvImssDevolver"] = accSiGvDevolver.IdAccion;
        harness.AccionesSeleccion["GvImssRechazar"] = accSiGvRechazar.IdAccion;

        harness.PasosSeleccionDesc["Inicio"] = sdCreada.IdPaso;
        harness.PasosSeleccionDesc["Creada"] = sdCreada.IdPaso;
        harness.PasosSeleccionDesc["Gg"] = sdGg.IdPaso;
        harness.PasosSeleccionDesc["GvDesc"] = sdGv.IdPaso;
        harness.PasosSeleccionDesc["Final"] = sdFin.IdPaso;
        harness.AccionesSeleccionDesc["Enviar"] = accSdEnviar.IdAccion;
        harness.AccionesSeleccionDesc["Cancelar"] = accSdCancelar.IdAccion;
        harness.AccionesSeleccionDesc["GgAutorizar"] = accSdGgAutorizar.IdAccion;
        harness.AccionesSeleccionDesc["GgDevolver"] = accSdGgDevolver.IdAccion;
        harness.AccionesSeleccionDesc["GvDescCerrar"] = accSdGvCerrar.IdAccion;
        harness.AccionesSeleccionDesc["GvDescDevolver"] = accSdGvDevolver.IdAccion;

        harness.PasosRutas["Creada"] = riCreada.IdPaso;
        harness.PasosRutas["Draft"] = riCreada.IdPaso;
        harness.PasosRutas["GvImss"] = riGv.IdPaso;
        harness.PasosRutas["Ca"] = riCa.IdPaso;
        harness.PasosRutas["Dc"] = riDc.IdPaso;
        harness.PasosRutas["Final"] = riFin.IdPaso;
        harness.PasosRutas["Rechazada"] = riRech.IdPaso;
        harness.PasosRutas["Cancelada"] = riCan.IdPaso;
        harness.AccionesRutas["Enviar"] = accRiEnviar.IdAccion;
        harness.AccionesRutas["Cancelar"] = accRiCancelar.IdAccion;
        harness.AccionesRutas["GvImssAutorizar"] = accRiGv.IdAccion;
        harness.AccionesRutas["GvImssDevolver"] = accRiGvDevolver.IdAccion;
        harness.AccionesRutas["GvImssRechazar"] = accRiGvRechazar.IdAccion;
        harness.AccionesRutas["CaAutorizar"] = accRiCa.IdAccion;
        harness.AccionesRutas["CaDevolver"] = accRiCaDevolver.IdAccion;
        harness.AccionesRutas["CaRechazar"] = accRiCaRechazar.IdAccion;
        harness.AccionesRutas["DcCerrar"] = accRiDc.IdAccion;
        harness.AccionesRutas["DcDevolver"] = accRiDcDevolver.IdAccion;
        harness.AccionesRutas["DcRechazar"] = accRiDcRechazar.IdAccion;

        harness.PasosMatriz["Concentracion"] = miCreada.IdPaso;
        harness.PasosMatriz["Creada"] = miCreada.IdPaso;
        harness.PasosMatriz["GvImss"] = miGv.IdPaso;
        harness.PasosMatriz["Aem"] = miAem.IdPaso;
        harness.PasosMatriz["Ca"] = miCa.IdPaso;
        harness.PasosMatriz["Dc"] = miDc.IdPaso;
        harness.PasosMatriz["Final"] = miFin.IdPaso;
        harness.PasosMatriz["Rechazada"] = miR.IdPaso;
        harness.PasosMatriz["Cancelada"] = miCan.IdPaso;
        harness.AccionesMatriz["Enviar"] = accMiEnviar.IdAccion;
        harness.AccionesMatriz["Cancelar"] = accMiCancelar.IdAccion;
        harness.AccionesMatriz["GvImssAutorizar"] = accMiGvAutorizar.IdAccion;
        harness.AccionesMatriz["GvImssDevolver"] = accMiGvDevolver.IdAccion;
        harness.AccionesMatriz["GvImssRechazar"] = accMiGvRechazar.IdAccion;
        harness.AccionesMatriz["AemEnviar"] = accMiAemEnviar.IdAccion;
        harness.AccionesMatriz["AemDevolver"] = accMiAemDevolver.IdAccion;
        harness.AccionesMatriz["AemRechazar"] = accMiAemRechazar.IdAccion;
        harness.AccionesMatriz["CaAutorizar"] = accMiCaAutorizar.IdAccion;
        harness.AccionesMatriz["CaDevolver"] = accMiCaDevolver.IdAccion;
        harness.AccionesMatriz["CaRechazar"] = accMiCaRechazar.IdAccion;
        harness.AccionesMatriz["DcCerrar"] = accMiDcCerrar.IdAccion;
        harness.AccionesMatriz["DcDevolver"] = accMiDcDevolver.IdAccion;
        harness.AccionesMatriz["DcRechazar"] = accMiDcRechazar.IdAccion;

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
        bool esFinal = false,
        bool requiereFirma = false)
    {
        var paso = new WorkflowPaso
        {
            IdWorkflow = idWorkflow,
            Orden = orden,
            NombrePaso = nombre,
            IdEstado = idEstado,
            EsInicio = esInicio,
            EsFinal = esFinal,
            RequiereFirma = requiereFirma,
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
                    CodigoProceso.EDUCACION_MEDICA_MATRIZ => esDesc ? WfMatrizDesc : WfMatriz,
                    _ => null,
                };
            });
        return mock;
    }

    private int _siguienteIdRolPermiso = 9000;

    /// <summary>
    /// Otorga permisos a un usuario en Asokam (rol sintético + RolPermiso), para las
    /// validaciones finas de servicio (p. ej. puede_ajustar, captura asistida).
    /// </summary>
    public void OtorgarPermiso(int idUsuario, params string[] codigosPermiso)
    {
        var idRol = _siguienteIdRolPermiso++;
        var rol = new Rol
        {
            IdRol = idRol,
            NombreRol = $"Rol-Permisos-{idUsuario}",
            EsActivo = true,
        };
        Asokam.Roles.Add(rol);
        Asokam.UsuariosRoles.Add(new UsuarioRol
        {
            IdUsuarioRol = _siguienteIdRolPermiso++,
            IdUsuario = idUsuario,
            IdRol = idRol,
            Rol = rol,
        });

        foreach (var codigo in codigosPermiso)
        {
            var idPermiso = _siguienteIdRolPermiso++;
            var permiso = new Permiso
            {
                IdPermiso = idPermiso,
                CodigoPermiso = codigo,
                NombrePermiso = codigo,
                EsActivo = true,
            };
            Asokam.Permisos.Add(permiso);
            Asokam.RolesPermisos.Add(new RolPermiso
            {
                IdRolPermiso = _siguienteIdRolPermiso++,
                IdRol = idRol,
                IdPermiso = idPermiso,
                Rol = rol,
                Permiso = permiso,
            });
        }

        Asokam.SaveChanges();
    }
}
