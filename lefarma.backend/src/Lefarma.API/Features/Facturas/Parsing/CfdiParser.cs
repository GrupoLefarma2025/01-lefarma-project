using System.Xml.Linq;
using Lefarma.API.Features.Facturas.DTOs;

namespace Lefarma.API.Features.Facturas.Parsing;

public static class CfdiParser
{
    private static readonly XNamespace NsCfdi = "http://www.sat.gob.mx/cfd/4";
    private static readonly XNamespace NsTfd  = "http://www.sat.gob.mx/TimbreFiscalDigital";

    public static CfdiPreviewResponse Parse(string xmlContent)
    {
        XDocument doc;
        try
        {
            doc = XDocument.Parse(xmlContent);
        }
        catch (Exception ex)
        {
            throw new FormatException($"XML malformado: {ex.Message}");
        }

        var comprobante = doc.Root ?? throw new FormatException("XML sin elemento raíz");

        if (comprobante.Name.LocalName != "Comprobante")
            throw new FormatException("El XML no es un CFDI (elemento raíz debe ser 'Comprobante')");

        // TimbreFiscalDigital
        var tfd = comprobante
            .Descendants(NsTfd + "TimbreFiscalDigital")
            .FirstOrDefault();

        var uuid = tfd?.Attribute("UUID")?.Value;

        // Emisor / Receptor
        var emisor   = comprobante.Element(NsCfdi + "Emisor");
        var receptor = comprobante.Element(NsCfdi + "Receptor");

        // Impuestos globales
        var impuestos = comprobante.Element(NsCfdi + "Impuestos");
        var totalIva  = ParseDecimal(
            impuestos?.Elements(NsCfdi + "Traslados")
                      .Elements(NsCfdi + "Traslado")
                      .FirstOrDefault(t => t.Attribute("Impuesto")?.Value == "002")
                      ?.Attribute("Importe")?.Value);

        var totalRetenciones = ParseDecimal(impuestos?.Attribute("TotalImpuestosRetenidos")?.Value);

        // Conceptos
        var conceptosXml = comprobante
            .Element(NsCfdi + "Conceptos")?
            .Elements(NsCfdi + "Concepto")
            .ToList() ?? [];

        var conceptos = conceptosXml.Select((c, i) =>
        {
            var traslados = c.Element(NsCfdi + "Impuestos")
                             ?.Element(NsCfdi + "Traslados")
                             ?.Elements(NsCfdi + "Traslado")
                             .FirstOrDefault(t => t.Attribute("Impuesto")?.Value == "002");

            var tasaIva    = ParseDecimalNullable(traslados?.Attribute("TasaOCuota")?.Value);
            var importeIva = ParseDecimalNullable(traslados?.Attribute("Importe")?.Value);

            return new CfdiConceptoPreviewDto(
                Numero:        i + 1,
                ClaveProdServ: c.Attribute("ClaveProdServ")?.Value,
                ClaveUnidad:   c.Attribute("ClaveUnidad")?.Value,
                Descripcion:   c.Attribute("Descripcion")?.Value ?? "",
                Cantidad:      ParseDecimal(c.Attribute("Cantidad")?.Value),
                ValorUnitario: ParseDecimal(c.Attribute("ValorUnitario")?.Value),
                Descuento:     ParseDecimal(c.Attribute("Descuento")?.Value),
                Importe:       ParseDecimal(c.Attribute("Importe")?.Value),
                TasaIva:       tasaIva,
                ImporteIva:    importeIva
            );
        }).ToList();

        return new CfdiPreviewResponse(
            Uuid:              uuid,
            Version:           comprobante.Attribute("Version")?.Value,
            Serie:             comprobante.Attribute("Serie")?.Value,
            FolioCfdi:         comprobante.Attribute("Folio")?.Value,
            FechaEmision:      ParseDateTimeNullable(comprobante.Attribute("Fecha")?.Value),
            RfcEmisor:         emisor?.Attribute("Rfc")?.Value,
            NombreEmisor:      emisor?.Attribute("Nombre")?.Value,
            RfcReceptor:       receptor?.Attribute("Rfc")?.Value,
            NombreReceptor:    receptor?.Attribute("Nombre")?.Value,
            UsoCfdi:           receptor?.Attribute("UsoCFDI")?.Value,
            MetodoPago:        comprobante.Attribute("MetodoPago")?.Value,
            FormaPago:         comprobante.Attribute("FormaPago")?.Value,
            Moneda:            comprobante.Attribute("Moneda")?.Value ?? "MXN",
            Subtotal:          ParseDecimal(comprobante.Attribute("SubTotal")?.Value),
            Descuento:         ParseDecimal(comprobante.Attribute("Descuento")?.Value),
            TotalIva:          totalIva,
            TotalRetenciones:  totalRetenciones,
            Total:             ParseDecimal(comprobante.Attribute("Total")?.Value),
            Conceptos:         conceptos
        );
    }

    private static decimal ParseDecimal(string? value)
        => decimal.TryParse(value, System.Globalization.NumberStyles.Any,
               System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : 0m;

    private static decimal? ParseDecimalNullable(string? value)
        => decimal.TryParse(value, System.Globalization.NumberStyles.Any,
               System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : null;

    private static DateTime? ParseDateTimeNullable(string? value)
        => DateTime.TryParse(value, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt)
            ? dt : null;
}
