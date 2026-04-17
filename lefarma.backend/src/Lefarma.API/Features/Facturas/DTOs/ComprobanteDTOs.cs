namespace Lefarma.API.Features.Facturas.DTOs;

// ── Requests ───────────────────────────────────────────────────────────────

public record SubirComprobanteRequest(
    int IdEmpresa,
    int IdUsuario,
    int? IdOrden,
    int? IdPasoWorkflow,
    string TipoComprobante,   // 'cfdi','ticket','nota','recibo','manual','spei','cheque','transferencia'
    string Categoria,         // 'gasto' | 'pago'
    decimal? TotalManual,     // requerido si no es CFDI
    string? Notas,
    string? NombrePaso,
    string? NombreAccion,
    // Campos exclusivos de pago
    string? ReferenciaPago,
    DateTime? FechaPago,
    decimal? MontoPago
);

public record AsignarPartidasRequest(
    List<AsignacionItemRequest> Asignaciones
);

public record AsignacionItemRequest(
    int? IdConcepto,
    int IdPartida,
    decimal CantidadAsignada,
    decimal ImporteAsignado,
    string? Notas
);

// ── Responses ──────────────────────────────────────────────────────────────

public record ComprobanteResponse(
    int IdComprobante,
    string Categoria,
    string TipoComprobante,
    bool EsCfdi,
    string? UuidCfdi,
    string? RfcEmisor,
    string? NombreEmisor,
    decimal Total,
    int Estado,
    string EstadoDescripcion,
    DateTime FechaCreacion,
    string? ReferenciaPago,
    DateTime? FechaPago,
    decimal? MontoPago,
    List<ComprobanteConceptoResponse> Conceptos
);

public record ComprobanteConceptoResponse(
    int IdConcepto,
    int NumeroConcepto,
    string Descripcion,
    decimal Cantidad,
    decimal ValorUnitario,
    decimal Importe,
    decimal? TasaIva,
    decimal CantidadAsignada,
    decimal ImporteAsignado,
    decimal CantidadPendiente,
    decimal ImportePendiente
);

public record CfdiPreviewResponse(
    string? Uuid,
    string? Version,
    string? Serie,
    string? FolioCfdi,
    DateTime? FechaEmision,
    string? RfcEmisor,
    string? NombreEmisor,
    string? RfcReceptor,
    string? NombreReceptor,
    string? UsoCfdi,
    string? MetodoPago,
    string? FormaPago,
    string? Moneda,
    decimal Subtotal,
    decimal Descuento,
    decimal TotalIva,
    decimal TotalRetenciones,
    decimal Total,
    List<CfdiConceptoPreviewDto> Conceptos
);

public record CfdiConceptoPreviewDto(
    int Numero,
    string? ClaveProdServ,
    string? ClaveUnidad,
    string Descripcion,
    decimal Cantidad,
    decimal ValorUnitario,
    decimal Descuento,
    decimal Importe,
    decimal? TasaIva,
    decimal? ImporteIva
);

public record PartidaPendienteResponse(
    int IdPartida,
    int NumeroPartida,
    string DescripcionPartida,
    string FolioOrden,
    decimal Cantidad,
    decimal PrecioUnitario,
    decimal CantidadFacturada,
    decimal ImporteFacturado,
    decimal CantidadPendiente,
    decimal ImportePendiente,
    int EstadoFacturacion
);

public record PartidaFacturacionResponse(
    int IdPartida,
    int EstadoFacturacion,
    decimal CantidadFacturada,
    decimal ImporteFacturado,
    List<ComprobanteAsignacionResponse> Asignaciones
);

public record ComprobanteAsignacionResponse(
    int IdAsignacion,
    int IdComprobante,
    string TipoComprobante,
    string? UuidCfdi,
    decimal CantidadAsignada,
    decimal ImporteAsignado,
    DateTime FechaAsignacion,
    string? Notas
);
