namespace Lefarma.API.Features.Facturas.SatValidation;

public class SatValidationSettings
{
    public bool Enabled { get; set; } = true;

    public string Endpoint { get; set; } =
        "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc";

    public string SoapAction { get; set; } =
        "http://tempuri.org/IConsultaCFDIService/Consulta";
}
