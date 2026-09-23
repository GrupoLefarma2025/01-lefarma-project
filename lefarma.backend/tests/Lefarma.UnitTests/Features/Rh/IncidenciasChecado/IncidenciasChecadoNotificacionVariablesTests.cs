using FluentAssertions;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.IncidenciasChecado;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Shared.Helpers;

namespace Lefarma.UnitTests.Features.Rh.IncidenciasChecado;

public class IncidenciasChecadoNotificacionVariablesTests
{
    private static readonly DateTime FechaInicio = new(2026, 9, 1);
    private static readonly DateTime FechaFin = new(2026, 9, 30);

    private static IncidenciaCalculadaDto Incidencia(
        string tipo,
        string nombre,
        bool descuento,
        bool teorico,
        int cantidad,
        int? posicion,
        string etiquetaPeriodo) => new()
    {
        TipoIncidencia = tipo,
        Nombre = nombre,
        GeneraDescuento = descuento,
        GeneraDescuentoTeorico = teorico,
        CantidadAcumulada = cantidad,
        PosicionAcumulacion = posicion,
        EtiquetaPeriodo = etiquetaPeriodo
    };

    private static NotificarIncidenciaItemRequest Item(
        DateTime fecha,
        bool justificada,
        bool descuento,
        params IncidenciaCalculadaDto[] incidencias) => new()
    {
        Nomina = 1313127,
        Fecha = fecha,
        Nombre = "EMPLEADO PRUEBA",
        Empresa = "ARTRICENTER",
        Departamento = "GERENCIA",
        Puesto = "GERENTE DE SUCURSAL",
        Justificada = justificada,
        Descuento = descuento,
        IncidenciasCalculadas = incidencias.ToList()
    };

    private static List<NotificarIncidenciaItemRequest> ItemsDeEjemplo() =>
    [
        // Omisión de checado (entrada y salida) con descuento
        Item(
            new DateTime(2026, 9, 1),
            justificada: false,
            descuento: true,
            Incidencia("OMISION_ENTRADA", "Omisión de entrada", true, true, 1, 1, "1.ª quincena de septiembre de 2026"),
            Incidencia("OMISION_SALIDA", "Omisión de salida", true, true, 1, 1, "1.ª quincena de septiembre de 2026")),
        // Retardo 2.º de 3 sin descuento
        Item(
            new DateTime(2026, 9, 9),
            justificada: false,
            descuento: false,
            Incidencia("TARDANZA_ENTRADA", "Retardo de entrada menor a 20 min", false, true, 3, 2, "septiembre de 2026")),
        // Retardo 3.º de 3 que genera el descuento
        Item(
            new DateTime(2026, 9, 12),
            justificada: false,
            descuento: true,
            Incidencia("TARDANZA_ENTRADA", "Retardo de entrada menor a 20 min", true, false, 3, 3, "septiembre de 2026")),
        // Día justificado que en teoría habría generado descuento
        Item(
            new DateTime(2026, 9, 16),
            justificada: true,
            descuento: false,
            Incidencia("TARDANZA_ENTRADA", "Retardo de entrada mayor o igual a 20 min", false, true, 1, null, "2.ª quincena de septiembre de 2026"))
    ];

    private static Dictionary<string, string> Construir(List<NotificarIncidenciaItemRequest> items) =>
        IncidenciasChecadoNotificacionService.ConstruirVariables(
            items,
            "jzarco - OSCAR JESUS ZARCO DOMINGUEZ",
            FechaInicio,
            FechaFin,
            "mes-anterior",
            limiteDescuentosJustificados: 2,
            reglasDescuento: "Se generan descuentos por acumulación.",
            tablaHtml: "<table></table>");

    [Fact]
    public void ConstruirVariables_Debe_Calcular_Descuentos_Con_La_Semantica_Actual()
    {
        var variables = Construir(ItemsDeEjemplo());

        variables["TotalIncidencias"].Should().Be("5");
        variables["DescuentosPorJustificar"].Should().Be("2");
        variables["TotalDescuentos"].Should().Be("2");
        variables["DescuentosJustificados"].Should().Be("1");
        variables["DescuentosEnTramite"].Should().Be("0");
        variables["LimiteDescuentosJustificados"].Should().Be("2");
        variables["DescuentosRestantes"].Should().Be("1");
    }

    [Fact]
    public void ConstruirVariables_Debe_Incluir_Dias_Fechas_Y_Conteos_Por_Tipo()
    {
        var variables = Construir(ItemsDeEjemplo());

        variables["DiasConDescuento"].Should().Be("2");
        variables["FechasConDescuento"].Should().Be("1 y 12 de septiembre de 2026");
        variables["Retardos"].Should().Be("3");
        variables["Omisiones"].Should().Be("2");
        variables["SalidasAnticipadas"].Should().Be("0");
        variables["Periodo"].Should().Be("mes-anterior");
        variables["FechasConDescuento"].Should().NotContain("16");
    }

    [Fact]
    public void ConstruirVariables_Sin_Descuentos_Debe_Indicar_Ninguno()
    {
        var items = new List<NotificarIncidenciaItemRequest>
        {
            Item(
                new DateTime(2026, 9, 9),
                justificada: false,
                descuento: false,
                Incidencia("TARDANZA_ENTRADA", "Retardo de entrada menor a 20 min", false, false, 3, 2, "septiembre de 2026"))
        };

        var variables = Construir(items);

        variables["FechasConDescuento"].Should().Be("ninguno");
        variables["DiasConDescuento"].Should().Be("0");
    }

    [Fact]
    public void AplicarVariablesResumen_Debe_Reemplazar_Todas_Las_Variables()
    {
        var variables = Construir(ItemsDeEjemplo());

        var plantilla =
            "{{Nombre}}|{{Nomina}}|{{Empresa}}|{{Departamento}}|{{Puesto}}|{{FechaInicio}}|{{FechaFin}}|" +
            "{{Periodo}}|{{TotalIncidencias}}|{{TotalDescuentos}}|{{DescuentosPorJustificar}}|" +
            "{{DescuentosJustificados}}|{{DescuentosEnTramite}}|{{LimiteDescuentosJustificados}}|" +
            "{{DescuentosRestantes}}|{{DiasConDescuento}}|{{FechasConDescuento}}|{{Retardos}}|" +
            "{{Omisiones}}|{{SalidasAnticipadas}}|{{ReglasDescuento}}|{{TablaIncidencias}}";

        var resultado = IncidenciasChecadoNotificacionService.AplicarVariablesResumen(plantilla, variables);

        resultado.Should().NotContain("{{");
        resultado.Should().Contain("jzarco - OSCAR JESUS ZARCO DOMINGUEZ|1313127|ARTRICENTER|GERENCIA|GERENTE DE SUCURSAL|01/09/2026|30/09/2026");
        resultado.Should().Contain("|mes-anterior|5|2|2|1|0|2|1|2|1 y 12 de septiembre de 2026|3|2|0|Se generan descuentos por acumulación.|<table></table>");
    }

    [Fact]
    public void BuildTablaIncidenciasHtml_Debe_Incluir_Acumulado_Y_Motivo()
    {
        var html = IncidenciasChecadoNotificacionService.BuildTablaIncidenciasHtml(ItemsDeEjemplo());

        html.Should().Contain("Acumulado");
        html.Should().Contain("Motivo");
        html.Should().Contain("2/3");
        html.Should().Contain("3.º acumulado · septiembre de 2026");
        html.Should().Contain("2.º de 3 · septiembre de 2026");
        html.Should().Contain("Justificado, no cuenta");
    }

    [Fact]
    public void ReglasDescuentoHelper_Debe_Describir_Acumulacion_Y_Periodo()
    {
        var reglas = new List<IncidenciaChecadoConfig>
        {
            new()
            {
                IdConfig = 1,
                Nombre = "Retardo de entrada menor a 20 min",
                Descripcion = "Retardo de entrada menor a 20 min",
                TipoIncidencia = "TARDANZA_ENTRADA",
                CantidadAcumulada = 3,
                Periodo = "mes",
                Prioridad = 10,
                Activo = true
            },
            new()
            {
                IdConfig = 2,
                Nombre = "Omisión de salida",
                Descripcion = "Omisión de salida",
                TipoIncidencia = "OMISION_SALIDA",
                CantidadAcumulada = 1,
                Periodo = "quincena",
                Prioridad = 40,
                Activo = true
            }
        };

        var texto = ReglasDescuentoHelper.FormatearTexto(reglas);

        texto.Should().Be(
            "Cada \"Omisión de salida\" genera 1 descuento; cada 3 \"Retardo de entrada menor a 20 min\" en el mes generan 1 descuento.");
    }
}
