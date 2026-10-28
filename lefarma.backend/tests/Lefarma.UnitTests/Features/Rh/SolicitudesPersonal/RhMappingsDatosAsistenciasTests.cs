using FluentAssertions;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Shared.Extensions;

namespace Lefarma.UnitTests.Features.Rh.SolicitudesPersonal;

/// <summary>
/// Los formatos de RH deben imprimir empresa, área, puesto y ubicación del empleado desde
/// Asistencias (vwEmpleados.empresareal / departamento / puesto / ubicacion), no desde los
/// catálogos de Lefarma, que están desalineados. Evidencia: usuario 54 (Adriana Gutiérrez
/// Espinosa, nómina 1627181) tiene empresa Artricenter y área nula en config.usuario_detalle,
/// mientras Asistencias devuelve ASOKAM / CALIDAD / ANALISTA DE METODOS Y PROCEDIMIENTOS.
/// </summary>
public class RhMappingsDatosAsistenciasTests
{
    private const int IdSolicitante = 54;

    private static SolicitudPersonal NuevaSolicitud() => new()
    {
        IdSolicitud = 1,
        Folio = "VAC-0001",
        IdEmpresa = 1,
        IdSucursal = 2,
        IdArea = null,
        IdUsuarioCreador = IdSolicitante,
        IdUsuarioSolicitante = IdSolicitante,
        IdEstado = 1,
        IdWorkflow = 1,
        IdTipoSolicitud = 1,
        FechaCreacion = new DateTime(2026, 10, 28),
        Empresa = new Empresa { IdEmpresa = 1, Nombre = "Artricenter" },
        Area = null
    };

    [Fact]
    public void Con_Datos_De_Asistencias_Sustituye_Empresa_Area_Puesto_Y_Ubicacion()
    {
        var usuariosInfo = new Dictionary<int, RhMappings.UsuarioInfo>
        {
            [IdSolicitante] = new("Adriana Gutierrez Espinosa", "Sin asignar")
        };
        var empleadosInfo = new Dictionary<int, RhMappings.EmpleadoAsistenciasInfo>
        {
            [IdSolicitante] = new(
                "ASOKAM",
                "CALIDAD",
                "ANALISTA DE METODOS Y PROCEDIMIENTOS",
                "ANTONIO MAURA",
                "GRUPO LEFARMA")
        };

        var response = NuevaSolicitud().ToResponse(
            tipo: null,
            usuariosInfo: usuariosInfo,
            empleadosInfo: empleadosInfo);

        response.EmpresaNombre.Should().Be("ASOKAM");
        response.AreaNombre.Should().Be("CALIDAD");
        response.SolicitantePuesto.Should().Be("ANALISTA DE METODOS Y PROCEDIMIENTOS");
        response.SucursalNombre.Should().Be("ANTONIO MAURA");
        response.Ubicacion.Should().Be("GRUPO LEFARMA");
    }

    [Fact]
    public void Sin_Datos_De_Asistencias_Conserva_Los_Catalogos()
    {
        var usuariosInfo = new Dictionary<int, RhMappings.UsuarioInfo>
        {
            [IdSolicitante] = new("Adriana Gutierrez Espinosa", "Sin asignar")
        };

        var response = NuevaSolicitud().ToResponse(
            tipo: null,
            usuariosInfo: usuariosInfo,
            empleadosInfo: new Dictionary<int, RhMappings.EmpleadoAsistenciasInfo>());

        response.EmpresaNombre.Should().Be("Artricenter");
        response.AreaNombre.Should().BeNull();
        response.SolicitantePuesto.Should().Be("Sin asignar");
        response.Ubicacion.Should().BeNull();
    }

    [Fact]
    public void Datos_Parciales_De_Asistencias_Usan_Fallback_Por_Campo()
    {
        var usuariosInfo = new Dictionary<int, RhMappings.UsuarioInfo>
        {
            [IdSolicitante] = new("Adriana Gutierrez Espinosa", "Sin asignar")
        };
        var empleadosInfo = new Dictionary<int, RhMappings.EmpleadoAsistenciasInfo>
        {
            [IdSolicitante] = new(null, "CALIDAD", null, null, null)
        };

        var response = NuevaSolicitud().ToResponse(
            tipo: null,
            usuariosInfo: usuariosInfo,
            empleadosInfo: empleadosInfo);

        response.EmpresaNombre.Should().Be("Artricenter");
        response.AreaNombre.Should().Be("CALIDAD");
        response.SolicitantePuesto.Should().Be("Sin asignar");
    }

    [Fact]
    public void Datos_Vacios_No_Sustituyen_El_Catalogo()
    {
        var usuariosInfo = new Dictionary<int, RhMappings.UsuarioInfo>
        {
            [IdSolicitante] = new("Adriana Gutierrez Espinosa", "Sin asignar")
        };
        var empleadosInfo = new Dictionary<int, RhMappings.EmpleadoAsistenciasInfo>
        {
            [IdSolicitante] = new("  ", "", "   ", null, null)
        };

        var response = NuevaSolicitud().ToResponse(
            tipo: null,
            usuariosInfo: usuariosInfo,
            empleadosInfo: empleadosInfo);

        response.EmpresaNombre.Should().Be("Artricenter");
        response.AreaNombre.Should().BeNull();
        response.SolicitantePuesto.Should().Be("Sin asignar");
    }

    [Fact]
    public void El_Solicitante_Manda_Sobre_El_Creador_Cuando_Difieren()
    {
        // RH captura para otro empleado: el formato debe llevar los datos del solicitante.
        const int idCreador = 75;
        var solicitud = NuevaSolicitud();
        solicitud.IdUsuarioCreador = idCreador;

        var empleadosInfo = new Dictionary<int, RhMappings.EmpleadoAsistenciasInfo>
        {
            [idCreador] = new("GRUPO LEFARMA", "RECURSOS HUMANOS", "JEFE DE RH", "OFICINAS CENTRALES", "GRUPO LEFARMA"),
            [IdSolicitante] = new("ASOKAM", "CALIDAD", "ANALISTA DE METODOS Y PROCEDIMIENTOS", "ANTONIO MAURA", "GRUPO LEFARMA")
        };

        var response = solicitud.ToResponse(
            tipo: null,
            empleadosInfo: empleadosInfo);

        response.EmpresaNombre.Should().Be("ASOKAM");
        response.AreaNombre.Should().Be("CALIDAD");
        response.SolicitantePuesto.Should().Be("ANALISTA DE METODOS Y PROCEDIMIENTOS");
        response.SucursalNombre.Should().Be("ANTONIO MAURA");
    }
}
