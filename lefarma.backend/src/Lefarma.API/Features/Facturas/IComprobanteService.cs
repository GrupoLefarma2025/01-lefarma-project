using ErrorOr;
using Lefarma.API.Features.Facturas.DTOs;

namespace Lefarma.API.Features.Facturas;

public interface IComprobanteService
{
    Task<ErrorOr<CfdiPreviewResponse>> ParsearXmlAsync(string xmlContent);

    Task<ErrorOr<ComprobanteResponse>> SubirAsync(
        SubirComprobanteRequest request,
        string? xmlContent, string? xmlFileName,
        Stream? archivoStream, string? archivoFileName, string? archivoContentType,
        int idUsuario,
        CancellationToken ct = default);

    Task<ErrorOr<ComprobanteResponse>> GetByIdAsync(int idComprobante, CancellationToken ct = default);

    Task<ErrorOr<List<ComprobanteConceptoResponse>>> GetConceptosAsync(int idComprobante, CancellationToken ct = default);

    Task<ErrorOr<List<PartidaPendienteResponse>>> GetPartidasPendientesAsync(int idOrden, string categoria = "gasto", CancellationToken ct = default);

    Task<ErrorOr<ComprobanteResponse>> AsignarPartidasAsync(
        int idComprobante,
        AsignarPartidasRequest request,
        int idUsuario,
        int? idPasoWorkflow,
        CancellationToken ct = default);

    Task<ErrorOr<PartidaFacturacionResponse>> GetFacturacionPartidaAsync(int idPartida, CancellationToken ct = default);
}
