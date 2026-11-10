using System.Text.Json;
using ErrorOr;
using FluentAssertions;
using Lefarma.API.Features.Auth;
using Lefarma.API.Features.Configuracion;
using Lefarma.API.Features.Configuracion.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Lefarma.UnitTests.Features.Configuracion;

public class ConfiguracionServiceTests
{
    private static (ConfiguracionService Servicio, ApplicationDbContext Contexto) Crear()
    {
        var opciones = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var contexto = new ApplicationDbContext(opciones);

        var runtime = new Mock<IConfiguracionRuntimeService>();
        var sse = new Mock<ISseService>();
        sse.Setup(s => s.BroadcastAsync(It.IsAny<string>(), It.IsAny<object>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var servicio = new ConfiguracionService(
            contexto,
            runtime.Object,
            sse.Object,
            NullLogger<ConfiguracionService>.Instance);

        return (servicio, contexto);
    }

    private static JsonElement Json(string json)
    {
        using var documento = JsonDocument.Parse(json);
        return documento.RootElement.Clone();
    }

    private static CreateConfigVariableRequest SolicitudCrear(
        string clave = "app.tema",
        string tipo = "string",
        string valor = "\"claro\"",
        Guid? idOperacion = null,
        bool disponibleFrontend = true) => new()
    {
        IdOperacion = idOperacion ?? Guid.NewGuid(),
        Clave = clave,
        Nombre = "Tema de la aplicación",
        Descripcion = "Tema visual",
        TipoDato = tipo,
        Valor = Json(valor),
        DisponibleBackend = true,
        DisponibleFrontend = disponibleFrontend
    };

    private static UpdateConfigVariableRequest SolicitudActualizar(
        string valor = "\"oscuro\"",
        long versionEsperada = 1,
        string? clave = null,
        Guid? idOperacion = null) => new()
    {
        IdOperacion = idOperacion ?? Guid.NewGuid(),
        VersionEsperada = versionEsperada,
        Clave = clave,
        Nombre = "Tema actualizado",
        Descripcion = "Descripción actualizada",
        Valor = Json(valor),
        DisponibleBackend = true,
        DisponibleFrontend = true
    };

    // ------------------------------------------------------------------ crear

    [Fact]
    public async Task Crear_Guarda_Version_Uno_Y_Bitacora_Con_Snapshot()
    {
        var (servicio, contexto) = Crear();
        var idOperacion = Guid.NewGuid();

        var resultado = await servicio.CrearAsync(SolicitudCrear(idOperacion: idOperacion), 42);

        resultado.IsError.Should().BeFalse();
        var variable = resultado.Value;
        variable.IdVariable.Should().BeGreaterThan(0);
        variable.Version.Should().Be(1);
        variable.Activo.Should().BeTrue();
        variable.Valor.GetString().Should().Be("claro");
        variable.IdUsuarioCreacion.Should().Be(42);

        var bitacora = await contexto.ConfigVariablesBitacora.SingleAsync();
        bitacora.Accion.Should().Be(ConfiguracionAcciones.Crear);
        bitacora.IdOperacion.Should().Be(idOperacion);
        bitacora.IdVariable.Should().Be(variable.IdVariable);
        bitacora.DatosAnterioresJson.Should().BeNull();
        bitacora.DatosNuevosJson.Should().Contain("\"clave\":\"app.tema\"");
        bitacora.DatosNuevosJson.Should().Contain("\"valor\":\"claro\"");
        bitacora.DatosNuevosJson.Should().Contain("\"version\":1");
    }

    [Fact]
    public async Task Crear_Es_Idempotente_Por_IdOperacion()
    {
        var (servicio, contexto) = Crear();
        var idOperacion = Guid.NewGuid();

        var primero = await servicio.CrearAsync(SolicitudCrear(idOperacion: idOperacion), 1);
        var segundo = await servicio.CrearAsync(SolicitudCrear(idOperacion: idOperacion), 1);

        primero.IsError.Should().BeFalse();
        segundo.IsError.Should().BeFalse();
        segundo.Value.IdVariable.Should().Be(primero.Value.IdVariable);

        (await contexto.ConfigVariables.CountAsync()).Should().Be(1);
        (await contexto.ConfigVariablesBitacora.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Crear_Sin_Destinos_Falla()
    {
        var (servicio, _) = Crear();
        var solicitud = SolicitudCrear();
        solicitud.DisponibleBackend = false;
        solicitud.DisponibleFrontend = false;

        var resultado = await servicio.CrearAsync(solicitud, 1);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public async Task Crear_Con_Clave_Duplicada_Devuelve_Conflicto()
    {
        var (servicio, _) = Crear();

        await servicio.CrearAsync(SolicitudCrear("app.tema"), 1);
        var resultado = await servicio.CrearAsync(SolicitudCrear("app.tema"), 1);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Type.Should().Be(ErrorType.Conflict);
    }

    [Fact]
    public async Task Crear_Valida_El_Valor_Contra_El_Tipo()
    {
        var (servicio, _) = Crear();

        var resultado = await servicio.CrearAsync(
            SolicitudCrear("app.puerto", "integer", "\"no-es-numero\""),
            1);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Type.Should().Be(ErrorType.Validation);
    }

    // ------------------------------------------------------------- actualizar

    [Fact]
    public async Task Actualizar_Rechaza_Cambio_De_Clave()
    {
        var (servicio, _) = Crear();
        var creada = (await servicio.CrearAsync(SolicitudCrear(), 1)).Value;

        var resultado = await servicio.ActualizarAsync(
            creada.IdVariable,
            SolicitudActualizar(clave: "otra.clave"),
            1);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Code.Should().Be("Validation.clave");
    }

    [Fact]
    public async Task Actualizar_Rechaza_Version_Distinta_Con_Conflicto()
    {
        var (servicio, _) = Crear();
        var creada = (await servicio.CrearAsync(SolicitudCrear(), 1)).Value;

        var resultado = await servicio.ActualizarAsync(
            creada.IdVariable,
            SolicitudActualizar(versionEsperada: 99),
            1);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Type.Should().Be(ErrorType.Conflict);
    }

    [Fact]
    public async Task Actualizar_Incrementa_Version_Y_Registra_Bitacora()
    {
        var (servicio, contexto) = Crear();
        var creada = (await servicio.CrearAsync(SolicitudCrear(), 1)).Value;

        var resultado = await servicio.ActualizarAsync(creada.IdVariable, SolicitudActualizar(), 7);

        resultado.IsError.Should().BeFalse();
        resultado.Value.Version.Should().Be(2);
        resultado.Value.Valor.GetString().Should().Be("oscuro");
        resultado.Value.Nombre.Should().Be("Tema actualizado");

        var bitacora = await contexto.ConfigVariablesBitacora
            .OrderByDescending(b => b.IdBitacora)
            .FirstAsync();

        bitacora.Accion.Should().Be(ConfiguracionAcciones.Actualizar);
        bitacora.IdUsuario.Should().Be(7);
        bitacora.DatosAnterioresJson.Should().Contain("\"valor\":\"claro\"");
        bitacora.DatosNuevosJson.Should().Contain("\"valor\":\"oscuro\"");
    }

    [Fact]
    public async Task Actualizar_Es_Idempotente_Por_IdOperacion()
    {
        var (servicio, contexto) = Crear();
        var creada = (await servicio.CrearAsync(SolicitudCrear(), 1)).Value;
        var idOperacion = Guid.NewGuid();

        var primero = await servicio.ActualizarAsync(
            creada.IdVariable,
            SolicitudActualizar(idOperacion: idOperacion),
            1);

        var segundo = await servicio.ActualizarAsync(
            creada.IdVariable,
            SolicitudActualizar(idOperacion: idOperacion),
            1);

        primero.IsError.Should().BeFalse();
        segundo.IsError.Should().BeFalse();
        segundo.Value.Version.Should().Be(primero.Value.Version);
        (await contexto.ConfigVariablesBitacora.CountAsync()).Should().Be(2);
    }

    // --------------------------------------------------------------- estado

    [Fact]
    public async Task Desactivar_No_Borra_Y_Registra_Bitacora()
    {
        var (servicio, contexto) = Crear();
        var creada = (await servicio.CrearAsync(SolicitudCrear(), 1)).Value;

        var resultado = await servicio.DesactivarAsync(
            creada.IdVariable,
            new CambiarEstadoVariableRequest { IdOperacion = Guid.NewGuid(), VersionEsperada = 1 },
            3);

        resultado.IsError.Should().BeFalse();
        resultado.Value.Activo.Should().BeFalse();
        resultado.Value.Version.Should().Be(2);

        (await contexto.ConfigVariables.CountAsync()).Should().Be(1);

        var bitacora = await contexto.ConfigVariablesBitacora
            .OrderByDescending(b => b.IdBitacora)
            .FirstAsync();

        bitacora.Accion.Should().Be(ConfiguracionAcciones.Desactivar);

        var reactivada = await servicio.ReactivarAsync(
            creada.IdVariable,
            new CambiarEstadoVariableRequest { IdOperacion = Guid.NewGuid(), VersionEsperada = 2 },
            3);

        reactivada.IsError.Should().BeFalse();
        reactivada.Value.Activo.Should().BeTrue();
        reactivada.Value.Version.Should().Be(3);
    }

    // ------------------------------------------------------------ restaurar

    [Fact]
    public async Task Restaurar_Aplica_Solo_Campos_Editables_Y_Crea_Nueva_Revision()
    {
        var (servicio, contexto) = Crear();
        var creada = (await servicio.CrearAsync(SolicitudCrear(), 1)).Value;

        await servicio.ActualizarAsync(creada.IdVariable, SolicitudActualizar(), 1);

        var origen = await contexto.ConfigVariablesBitacora
            .OrderBy(b => b.IdBitacora)
            .FirstAsync();

        var resultado = await servicio.RestaurarAsync(
            creada.IdVariable,
            new RestaurarVariableRequest
            {
                IdOperacion = Guid.NewGuid(),
                IdBitacoraOrigen = origen.IdBitacora,
                VersionEsperada = 2
            },
            9);

        resultado.IsError.Should().BeFalse();
        var restaurada = resultado.Value;

        restaurada.Clave.Should().Be("app.tema");
        restaurada.TipoDato.Should().Be("string");
        restaurada.Valor.GetString().Should().Be("claro");
        restaurada.Version.Should().Be(3);
        restaurada.Activo.Should().BeTrue();

        var bitacora = await contexto.ConfigVariablesBitacora
            .OrderByDescending(b => b.IdBitacora)
            .FirstAsync();

        bitacora.Accion.Should().Be(ConfiguracionAcciones.Restaurar);
        bitacora.IdBitacoraOrigen.Should().Be(origen.IdBitacora);
        bitacora.IdUsuario.Should().Be(9);
    }

    [Fact]
    public async Task Restaurar_No_Reactiva_La_Variable()
    {
        var (servicio, contexto) = Crear();
        var creada = (await servicio.CrearAsync(SolicitudCrear(), 1)).Value;

        await servicio.DesactivarAsync(
            creada.IdVariable,
            new CambiarEstadoVariableRequest { IdOperacion = Guid.NewGuid(), VersionEsperada = 1 },
            1);

        var origen = await contexto.ConfigVariablesBitacora
            .OrderByDescending(b => b.IdBitacora)
            .FirstAsync();

        var resultado = await servicio.RestaurarAsync(
            creada.IdVariable,
            new RestaurarVariableRequest
            {
                IdOperacion = Guid.NewGuid(),
                IdBitacoraOrigen = origen.IdBitacora,
                VersionEsperada = 2
            },
            1);

        resultado.IsError.Should().BeFalse();
        resultado.Value.Activo.Should().BeFalse();
    }

    [Fact]
    public async Task Restaurar_Rechaza_Version_Distinta()
    {
        var (servicio, contexto) = Crear();
        var creada = (await servicio.CrearAsync(SolicitudCrear(), 1)).Value;

        var origen = await contexto.ConfigVariablesBitacora.SingleAsync();

        var resultado = await servicio.RestaurarAsync(
            creada.IdVariable,
            new RestaurarVariableRequest
            {
                IdOperacion = Guid.NewGuid(),
                IdBitacoraOrigen = origen.IdBitacora,
                VersionEsperada = 5
            },
            1);

        resultado.IsError.Should().BeTrue();
        resultado.FirstError.Type.Should().Be(ErrorType.Conflict);
    }

    // -------------------------------------------------------------- historial

    [Fact]
    public async Task Historial_Devuelve_Mas_Reciente_Primero()
    {
        var (servicio, _) = Crear();
        var creada = (await servicio.CrearAsync(SolicitudCrear(), 1)).Value;
        await servicio.ActualizarAsync(creada.IdVariable, SolicitudActualizar(), 1);

        var historial = await servicio.ObtenerHistorialAsync(creada.IdVariable);

        historial.IsError.Should().BeFalse();
        historial.Value.Should().HaveCount(2);
        historial.Value[0].Accion.Should().Be(ConfiguracionAcciones.Actualizar);
        historial.Value[1].Accion.Should().Be(ConfiguracionAcciones.Crear);

        var detalle = await servicio.ObtenerHistorialDetalleAsync(
            creada.IdVariable,
            historial.Value[1].IdBitacora);

        detalle.IsError.Should().BeFalse();
        detalle.Value.DatosNuevos.GetProperty("clave").GetString().Should().Be("app.tema");
    }

    // --------------------------------------------------------------- frontend

    [Fact]
    public async Task ConsultarFrontend_Devuelve_Vigentes_Y_Eliminadas()
    {
        var (servicio, _) = Crear();

        var visible = (await servicio.CrearAsync(SolicitudCrear("app.tema"), 1)).Value;
        var soloBackend = (await servicio.CrearAsync(
            SolicitudCrear("app.secreto", disponibleFrontend: false),
            1)).Value;

        var consulta = new FrontendConsultarRequest
        {
            Variables =
            [
                new FrontendConsultaClave { Clave = "app.tema" },
                new FrontendConsultaClave { Clave = "app.secreto" },
                new FrontendConsultaClave { Clave = "app.inexistente" }
            ]
        };

        var resultado = await servicio.ConsultarFrontendAsync(consulta);

        resultado.IsError.Should().BeFalse();
        var respuesta = resultado.Value;
        respuesta.RevisionActual.Should().BeGreaterThan(0);
        respuesta.Variables.Should().ContainSingle();
        respuesta.Variables[0].Clave.Should().Be(visible.Clave);
        respuesta.Variables[0].Revision.Should().BeGreaterThan(0);
        respuesta.Eliminadas.Should().BeEquivalentTo(new[] { "app.secreto", "app.inexistente" });

        await servicio.DesactivarAsync(
            visible.IdVariable,
            new CambiarEstadoVariableRequest { IdOperacion = Guid.NewGuid(), VersionEsperada = 1 },
            1);

        var despues = await servicio.ConsultarFrontendAsync(consulta);
        despues.Value.Variables.Should().BeEmpty();
        despues.Value.Eliminadas.Should().Contain("app.tema");

        soloBackend.IdVariable.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task SyncFrontend_Devuelve_Solo_Cambios_Posteriores()
    {
        var (servicio, _) = Crear();

        var creada = (await servicio.CrearAsync(SolicitudCrear("app.tema"), 1)).Value;

        var revisionInicial = await servicio.ObtenerHistorialAsync(creada.IdVariable);
        var desde = revisionInicial.Value[0].IdBitacora;

        await servicio.ActualizarAsync(creada.IdVariable, SolicitudActualizar(), 1);

        var resultado = await servicio.SincronizarFrontendAsync(new FrontendSyncRequest
        {
            Desde = desde,
            Claves = ["app.tema"]
        });

        resultado.IsError.Should().BeFalse();
        resultado.Value.Variables.Should().ContainSingle();
        resultado.Value.Variables[0].Valor.GetString().Should().Be("oscuro");
        resultado.Value.Variables[0].Revision.Should().BeGreaterThan(desde);
        resultado.Value.Eliminadas.Should().BeEmpty();

        var sinCambios = await servicio.SincronizarFrontendAsync(new FrontendSyncRequest
        {
            Desde = resultado.Value.RevisionActual,
            Claves = ["app.tema"]
        });

        sinCambios.Value.Variables.Should().BeEmpty();
    }
}
