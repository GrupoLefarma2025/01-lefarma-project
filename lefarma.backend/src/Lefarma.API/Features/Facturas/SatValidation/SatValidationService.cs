using System.Globalization;
using System.Xml.Linq;

namespace Lefarma.API.Features.Facturas.SatValidation;

/// <summary>
/// Consulta el estado de un CFDI contra el servicio SOAP público del SAT.
/// Documentación: https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc
/// </summary>
public sealed class SatValidationService : ISatValidationService
{
    private const string SatEndpoint =
        "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc";

    private const string SoapAction =
        "http://tempuri.org/IConsultaCFDIService/Consulta";

    private static readonly string SoapEnvelopeTemplate =
        """
        <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
          <s:Body>
            <Consulta xmlns="http://tempuri.org/">
              <expresionImpresa>{0}</expresionImpresa>
            </Consulta>
          </s:Body>
        </s:Envelope>
        """;

    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<SatValidationService> _logger;

    public SatValidationService(
        IHttpClientFactory httpFactory,
        ILogger<SatValidationService> logger)
    {
        _httpFactory = httpFactory;
        _logger = logger;
    }

    public async Task<SatValidacionResult> ValidarAsync(
        string uuid,
        string rfcEmisor,
        string rfcReceptor,
        decimal total,
        CancellationToken ct = default)
    {
        // El SAT requiere el total con 6 decimales y cero relleno a 12 enteros
        var totalStr = total.ToString("000000000000.000000", CultureInfo.InvariantCulture);

        // La expresión impresa corresponde al contenido del QR de la factura
        var expresion = $"?re={rfcEmisor}&rr={rfcReceptor}&tt={totalStr}&id={uuid}";

        // XML-escapar los & de la expresión antes de insertarla en el SOAP
        var expresionEscapada = System.Security.SecurityElement.Escape(expresion)!;

        var soapBody = string.Format(SoapEnvelopeTemplate, expresionEscapada);

        try
        {
            var client = _httpFactory.CreateClient("sat");

            using var req = new HttpRequestMessage(HttpMethod.Post, SatEndpoint)
            {
                Content = new StringContent(soapBody, System.Text.Encoding.UTF8, "text/xml")
            };
            req.Headers.Add("SOAPAction", $"\"{SoapAction}\"");

            using var response = await client.SendAsync(req, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            _logger.LogDebug("SAT response for UUID {Uuid}: {Body}", uuid, body);

            return ParseResponse(body);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo contactar al SAT para validar UUID {Uuid}", uuid);
            return new SatValidacionResult(
                Contactado: false,
                Estado: null,
                CodigoEstatus: null,
                EstatusCancelacion: null);
        }
    }

    private static SatValidacionResult ParseResponse(string xml)
    {
        try
        {
            var doc = XDocument.Parse(xml);

            // Localizar ConsultaResult sin importar el namespace
            var result = doc.Descendants()
                .FirstOrDefault(e => e.Name.LocalName == "ConsultaResult");

            if (result is null)
                return new SatValidacionResult(false, null, null, null);

            var estado = result.Descendants()
                .FirstOrDefault(e => e.Name.LocalName == "Estado")?.Value;

            var codigo = result.Descendants()
                .FirstOrDefault(e => e.Name.LocalName == "CodigoEstatus")?.Value;

            var cancelacion = result.Descendants()
                .FirstOrDefault(e => e.Name.LocalName == "EstatusCancelacion")?.Value;

            return new SatValidacionResult(
                Contactado: true,
                Estado: estado,
                CodigoEstatus: codigo,
                EstatusCancelacion: string.IsNullOrWhiteSpace(cancelacion) ? null : cancelacion);
        }
        catch
        {
            return new SatValidacionResult(false, null, null, null);
        }
    }
}
