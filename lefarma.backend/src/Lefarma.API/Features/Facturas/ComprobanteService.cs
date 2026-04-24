using ErrorOr;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Lefarma.API.Features.Archivos.DTOs;
using Lefarma.API.Features.Archivos.Services;
using Lefarma.API.Features.Facturas.DTOs;
using Lefarma.API.Features.Facturas.Parsing;
using Lefarma.API.Features.Facturas.SatValidation;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Microsoft.EntityFrameworkCore;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace Lefarma.API.Features.Facturas;

public class ComprobanteService : IComprobanteService
{
    private const decimal Tolerancia = 0.01m;

    private static readonly JsonSerializerOptions _jsonUtf8 = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        WriteIndented = false,
    };

    private readonly ApplicationDbContext _db;
    private readonly IComprobanteRepository _repo;
    private readonly IArchivoService _archivoService;
    private readonly ISatValidationService _sat;
    private readonly ILogger<ComprobanteService> _logger;

    public ComprobanteService(
        ApplicationDbContext db,
        IComprobanteRepository repo,
        IArchivoService archivoService,
        ISatValidationService sat,
        ILogger<ComprobanteService> logger)
    {
        _db = db;
        _repo = repo;
        _archivoService = archivoService;
        _sat = sat;
        _logger = logger;
    }

    public async Task<ErrorOr<CfdiPreviewResponse>> ParsearXmlAsync(string xmlContent)
    {
        CfdiPreviewResponse preview;
        try
        {
            preview = CfdiParser.Parse(xmlContent);
        }
        catch (FormatException)
        {
            return CommonErrors.Validation("XmlInvalido", "El XML no es un CFDI válido o está malformado");
        }

        // Consultar estado en el SAT si el CFDI tiene los campos mínimos
        if (preview.Uuid is not null && preview.RfcEmisor is not null && preview.RfcReceptor is not null)
        {
            var sat = await _sat.ValidarAsync(preview.Uuid, preview.RfcEmisor, preview.RfcReceptor, preview.Total);
            preview = preview with
            {
                SatContactado    = sat.Contactado,
                SatEstado        = sat.Estado,
                SatCodigoEstatus = sat.CodigoEstatus,
                SatCancelacion   = sat.EstatusCancelacion,
            };
        }

        return preview;
    }

    public async Task<ErrorOr<ComprobanteResponse>> SubirAsync(
        SubirComprobanteRequest request,
        string? xmlContent, string? xmlFileName,
        Stream? archivoStream, string? archivoFileName, string? archivoContentType,
        int idUsuario,
        CancellationToken ct = default)
    {
        CfdiPreviewResponse? cfdi = null;

        bool esCfdi = request.TipoComprobante == "cfdi";
        bool esPago = request.Categoria == "pago";

        if (esCfdi && !string.IsNullOrEmpty(xmlContent))
        {
            try { cfdi = CfdiParser.Parse(xmlContent); }
            catch (FormatException) { return CommonErrors.Validation("XmlInvalido", "El XML no es un CFDI válido o está malformado"); }

            if (cfdi.Uuid != null && await _repo.UuidExisteAsync(cfdi.Uuid, ct))
                return CommonErrors.Conflict("Comprobante", "Ya existe una factura registrada con este UUID CFDI");

            // Validación obligatoria con el SAT
            if (cfdi.Uuid is not null && cfdi.RfcEmisor is not null && cfdi.RfcReceptor is not null)
            {
                var sat = await _sat.ValidarAsync(cfdi.Uuid, cfdi.RfcEmisor, cfdi.RfcReceptor, cfdi.Total, ct);
                if (!sat.Contactado)
                    return CommonErrors.Failure("Comprobante", "No fue posible validar el CFDI con el SAT. Verifique su conexión a internet o intente nuevamente.");
                if (!sat.EsVigente)
                    return CommonErrors.Validation("SatNoVigente", $"El CFDI no puede ser registrado. Estado SAT: {sat.Estado ?? "Desconocido"}. Solo se aceptan CFDIs con estado Vigente.");
            }
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var comprobante = new Comprobante
            {
                IdEmpresa        = request.IdEmpresa,
                IdUsuarioSubio   = idUsuario,
                IdPasoWorkflow   = request.IdPasoWorkflow,
                Categoria        = request.Categoria,
                TipoComprobante  = request.TipoComprobante,
                EsCfdi           = esCfdi,
                UuidCfdi         = cfdi?.Uuid,
                VersionCfdi      = cfdi?.Version,
                Serie            = cfdi?.Serie,
                FolioCfdi        = cfdi?.FolioCfdi,
                FechaEmision     = cfdi?.FechaEmision,
                RfcEmisor        = cfdi?.RfcEmisor,
                NombreEmisor     = cfdi?.NombreEmisor,
                RfcReceptor      = cfdi?.RfcReceptor,
                NombreReceptor   = cfdi?.NombreReceptor,
                UsoCfdi          = cfdi?.UsoCfdi,
                MetodoPago       = cfdi?.MetodoPago,
                FormaPagoCfdi    = cfdi?.FormaPago,
                Moneda           = cfdi?.Moneda ?? "MXN",
                Subtotal         = cfdi?.Subtotal ?? 0m,
                Descuento        = cfdi?.Descuento ?? 0m,
                TotalIva         = cfdi?.TotalIva ?? 0m,
                TotalRetenciones = cfdi?.TotalRetenciones ?? 0m,
                Total            = cfdi?.Total ?? request.TotalManual ?? request.MontoPago ?? 0m,
                XmlOriginal      = xmlContent,
                ReferenciaPago   = request.ReferenciaPago,
                FechaPago        = request.FechaPago,
                MontoPago        = request.MontoPago,
                Estado           = 0,
                FechaCreacion    = DateTime.UtcNow
            };

            _db.Comprobantes.Add(comprobante);
            await _db.SaveChangesAsync(ct);

            // Conceptos CFDI
            if (esCfdi && cfdi != null)
            {
                const int maxDescripcionLength = 1000;
                var conceptos = cfdi.Conceptos.Select(c => new ComprobanteConcepto
                {
                    IdComprobante  = comprobante.IdComprobante,
                    NumeroConcepto = c.Numero,
                    ClaveProdServ  = c.ClaveProdServ,
                    ClaveUnidad    = c.ClaveUnidad,
                    Descripcion    = c.Descripcion?.Length > maxDescripcionLength
                        ? c.Descripcion[..maxDescripcionLength]
                        : c.Descripcion ?? "",
                    Cantidad       = c.Cantidad,
                    ValorUnitario  = c.ValorUnitario,
                    Descuento      = c.Descuento,
                    Importe        = c.Importe,
                    TasaIva        = c.TasaIva,
                    ImporteIva     = c.ImporteIva
                }).ToList();

                _db.ComprobantesConceptos.AddRange(conceptos);
                await _db.SaveChangesAsync(ct);
                comprobante.Conceptos = conceptos;
            }

            // Subir XML si CFDI
            if (esCfdi && xmlContent != null && xmlFileName != null)
            {
                using var xmlMs = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(xmlContent));
                var meta = JsonSerializer.Serialize(new
                {
                    modulo        = "ordenes_compra",
                    origen        = "workflow",
                    tipo          = esPago ? "comprobante_pago" : "comprobante_gasto",
                    idOrden       = request.IdOrden,
                    idComprobante = comprobante.IdComprobante,
                    subtipo       = request.TipoComprobante,
                    archivo       = "xml",
                    monto         = comprobante.Total,
                    paso          = request.IdPasoWorkflow,
                    nombrePaso    = request.NombrePaso,
                    nombreAccion  = request.NombreAccion
                }, _jsonUtf8);
                await _archivoService.SubirAsync(
                    xmlMs, xmlFileName, "application/xml",
                    new SubirArchivoRequest
                    {
                        EntidadTipo = "OrdenCompra",
                        EntidadId   = request.IdOrden!.Value,
                        Carpeta     = "comprobantes",
                        Metadata    = meta
                    },
                    idUsuario, ct);
            }

            // Subir archivo adicional (PDF, imagen, etc.)
            if (archivoStream != null && archivoFileName != null && archivoContentType != null)
            {
                var archivoTipo = esCfdi ? "pdf" : "imagen";
                var meta = JsonSerializer.Serialize(new
                {
                    modulo        = "ordenes_compra",
                    origen        = "workflow",
                    tipo          = esPago ? "comprobante_pago" : "comprobante_gasto",
                    idOrden       = request.IdOrden,
                    idComprobante = comprobante.IdComprobante,
                    subtipo       = request.TipoComprobante,
                    archivo       = archivoTipo,
                    monto         = comprobante.Total,
                    paso          = request.IdPasoWorkflow,
                    nombrePaso    = request.NombrePaso,
                    nombreAccion  = request.NombreAccion
                }, _jsonUtf8);
                await _archivoService.SubirAsync(
                    archivoStream, archivoFileName, archivoContentType,
                    new SubirArchivoRequest
                    {
                        EntidadTipo = "OrdenCompra",
                        EntidadId   = request.IdOrden!.Value,
                        Carpeta     = "comprobantes",
                        Metadata    = meta
                    },
                    idUsuario, ct);
            }

            await tx.CommitAsync(ct);

            return MapToResponse(comprobante);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            _logger.LogError(ex, "Error al subir comprobante");
            throw;
        }
    }

    public async Task<ErrorOr<ComprobanteResponse>> GetByIdAsync(int idComprobante, CancellationToken ct = default)
    {
        var c = await _repo.GetWithConceptosAsync(idComprobante, ct);
        if (c is null) return CommonErrors.NotFound("Comprobante");
        return MapToResponse(c);
    }

    public async Task<ErrorOr<List<ComprobanteConceptoResponse>>> GetConceptosAsync(int idComprobante, CancellationToken ct = default)
    {
        var c = await _repo.GetWithConceptosAsync(idComprobante, ct);
        if (c is null) return CommonErrors.NotFound("Comprobante");
        return c.Conceptos.Select(MapConcepto).ToList();
    }

    public async Task<ErrorOr<List<PartidaPendienteResponse>>> GetPartidasPendientesAsync(int idOrden, string categoria = "gasto", CancellationToken ct = default)
    {
        if (categoria == "pago")
        {
            // Para comprobantes de pago: mostrar TODAS las partidas de la orden.
            // El importe pendiente se calcula en base a los pagos ya asignados (independiente de facturación).
            var partidas = await _db.OrdenesCompraPartidas
                .Include(p => p.Orden)
                .Where(p => p.IdOrden == idOrden)
                .ToListAsync(ct);

            var idPartidas = partidas.Select(p => p.IdPartida).ToList();
            var pagadoPorPartida = await _db.ComprobantesPartidas
                .Where(cp => idPartidas.Contains(cp.IdPartida) && cp.Comprobante!.Categoria == "pago")
                .GroupBy(cp => cp.IdPartida)
                .Select(g => new { IdPartida = g.Key, ImportePagado = g.Sum(cp => cp.ImporteAsignado) })
                .ToDictionaryAsync(x => x.IdPartida, x => x.ImportePagado, ct);

            return partidas
                .Select(p =>
                {
                    var importePagado = pagadoPorPartida.TryGetValue(p.IdPartida, out var pag) ? pag : 0m;
                    var importePendiente = Math.Max(0m, p.Total - importePagado);
                    return new PartidaPendienteResponse(
                        IdPartida:          p.IdPartida,
                        NumeroPartida:      p.NumeroPartida,
                        DescripcionPartida: p.Descripcion,
                        FolioOrden:         p.Orden?.Folio ?? "",
                        Cantidad:           p.Cantidad,
                        PrecioUnitario:     p.PrecioUnitario,
                        CantidadFacturada:  0m,
                        ImporteFacturado:   importePagado,
                        CantidadPendiente:  importePendiente > 0 ? p.Cantidad : 0m,
                        ImportePendiente:   importePendiente,
                        EstadoFacturacion:  importePendiente <= 0 ? 2 : (importePagado > 0 ? 1 : 0)
                    );
                })
                .Where(p => p.ImportePendiente > 0)
                .ToList();
        }

        // Gasto: todas las partidas con importe pendiente (sin filtrar por RequiereFactura)
        var gastoPartidas = await _db.OrdenesCompraPartidas
            .Include(p => p.Orden)
            .Where(p => p.IdOrden == idOrden && p.EstadoFacturacion < 2)
            .ToListAsync(ct);

        return gastoPartidas.Select(p =>
        {
            var cantFacturada  = p.CantidadFacturada ?? 0m;
            var importeFacturado = p.ImporteFacturado ?? 0m;
            var importeTotal   = p.Total;
            return new PartidaPendienteResponse(
                IdPartida:          p.IdPartida,
                NumeroPartida:      p.NumeroPartida,
                DescripcionPartida: p.Descripcion,
                FolioOrden:         p.Orden?.Folio ?? "",
                Cantidad:           p.Cantidad,
                PrecioUnitario:     p.PrecioUnitario,
                CantidadFacturada:  cantFacturada,
                ImporteFacturado:   importeFacturado,
                CantidadPendiente:  p.Cantidad - cantFacturada,
                ImportePendiente:   importeTotal - importeFacturado,
                EstadoFacturacion:  p.EstadoFacturacion
            );
        }).ToList();
    }

    public async Task<ErrorOr<ComprobanteResponse>> AsignarPartidasAsync(
        int idComprobante,
        AsignarPartidasRequest request,
        int idUsuario,
        int? idPasoWorkflow,
        CancellationToken ct = default)
    {
        var comprobante = await _repo.GetWithConceptosAsync(idComprobante, ct);
        if (comprobante is null) return CommonErrors.NotFound("Comprobante");

        // Pre-validar
        foreach (var item in request.Asignaciones)
        {
            var partida = await _db.OrdenesCompraPartidas
                .FirstOrDefaultAsync(p => p.IdPartida == item.IdPartida, ct);

            if (partida is null) return CommonErrors.NotFound("Partida", item.IdPartida.ToString());

            if (comprobante.Categoria == "pago")
            {
                // Para pagos: validar contra el total pagado en esta partida (independiente de facturación)
                var importeYaPagado = await _db.ComprobantesPartidas
                    .Where(cp => cp.IdPartida == item.IdPartida
                              && cp.IdComprobante != idComprobante
                              && cp.Comprobante!.Categoria == "pago")
                    .SumAsync(cp => cp.ImporteAsignado, ct);
                var importePendientePago = partida.Total - importeYaPagado;
                if (item.ImporteAsignado > importePendientePago + Tolerancia)
                    return CommonErrors.Validation("SobreImporte", $"El importe asignado excede el importe pendiente en la partida {item.IdPartida}");
            }
            else
            {
                var importePendientePartida = partida.Total - (partida.ImporteFacturado ?? 0m);

                // Para CFDI: validar también cantidad
                if (comprobante.EsCfdi)
                {
                    var cantPendientePartida = partida.Cantidad - (partida.CantidadFacturada ?? 0m);
                    if (item.CantidadAsignada > cantPendientePartida + Tolerancia)
                        return CommonErrors.Validation("SobreCantidad", $"La cantidad asignada excede la cantidad pendiente en la partida {item.IdPartida}");
                }

                if (item.ImporteAsignado > importePendientePartida + Tolerancia)
                    return CommonErrors.Validation("SobreImporte", $"El importe asignado excede el importe pendiente en la partida {item.IdPartida}");
            }

            if (item.IdConcepto.HasValue)
            {
                var concepto = comprobante.Conceptos
                    .FirstOrDefault(c => c.IdConcepto == item.IdConcepto.Value);

                if (concepto is null) return CommonErrors.NotFound("Concepto", item.IdConcepto.Value.ToString());

                var cantPendienteConcepto = concepto.Cantidad - concepto.CantidadAsignada;
                if (item.CantidadAsignada > cantPendienteConcepto + Tolerancia)
                    return CommonErrors.Validation("SobreConcepto", $"La cantidad asignada excede la cantidad pendiente del concepto {item.IdConcepto.Value}");
            }
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            foreach (var item in request.Asignaciones)
            {
                // Insertar asignación
                var asignacion = new ComprobantePartida
                {
                    IdComprobante    = idComprobante,
                    IdConcepto       = item.IdConcepto,
                    IdPartida        = item.IdPartida,
                    IdUsuarioAsigno  = idUsuario,
                    IdPasoWorkflow   = idPasoWorkflow,
                    CantidadAsignada = item.CantidadAsignada,
                    ImporteAsignado  = item.ImporteAsignado,
                    Notas            = item.Notas,
                    FechaAsignacion  = DateTime.UtcNow
                };
                _db.ComprobantesPartidas.Add(asignacion);

                // Actualizar acumulados en concepto
                if (item.IdConcepto.HasValue)
                {
                    var concepto = comprobante.Conceptos
                        .First(c => c.IdConcepto == item.IdConcepto.Value);
                    concepto.CantidadAsignada += item.CantidadAsignada;
                    concepto.ImporteAsignado  += item.ImporteAsignado;
                }

                // Actualizar acumulados en partida
                // Para CFDI: acumular cantidad + importe (facturación).
                // Para pagos: NO tocar ImporteFacturado (ese campo es de facturación/gasto, no de pagos).
                if (comprobante.EsCfdi)
                {
                    await _db.OrdenesCompraPartidas
                        .Where(p => p.IdPartida == item.IdPartida)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(p => p.CantidadFacturada,
                                p => (p.CantidadFacturada ?? 0m) + item.CantidadAsignada)
                            .SetProperty(p => p.ImporteFacturado,
                                p => (p.ImporteFacturado ?? 0m) + item.ImporteAsignado),
                            ct);
                    // Recalcular estado_facturacion de la partida
                    await RecalcularEstadoPartidaAsync(item.IdPartida, ct);
                }
                else if (comprobante.Categoria != "pago")
                {
                    // Comprobante de gasto sin CFDI (ticket, nota, recibo): actualizar importe
                    await _db.OrdenesCompraPartidas
                        .Where(p => p.IdPartida == item.IdPartida)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(p => p.ImporteFacturado,
                                p => (p.ImporteFacturado ?? 0m) + item.ImporteAsignado),
                            ct);
                    await RecalcularEstadoPartidaAsync(item.IdPartida, ct);
                }
                // Para comprobantes de pago: solo guardar la asignación, sin tocar facturación
            }

            // Actualizar estado del comprobante
            comprobante.Estado = comprobante.EsCfdi
                ? (byte)(comprobante.Conceptos.All(c => c.Cantidad - c.CantidadAsignada <= Tolerancia) ? 2 : 1)
                : (byte)2;

            comprobante.FechaModificacion = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return MapToResponse(comprobante);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            _logger.LogError(ex, "Error al asignar partidas al comprobante {Id}", idComprobante);
            throw;
        }
    }

    public async Task<ErrorOr<PartidaFacturacionResponse>> GetFacturacionPartidaAsync(int idPartida, CancellationToken ct = default)
    {
        var partida = await _db.OrdenesCompraPartidas
            .FirstOrDefaultAsync(p => p.IdPartida == idPartida, ct);
        if (partida is null) return CommonErrors.NotFound("Partida", idPartida.ToString());

        var asignaciones = await _repo.GetAsignacionesByPartidaAsync(idPartida, ct);

        return new PartidaFacturacionResponse(
            IdPartida:         idPartida,
            EstadoFacturacion: partida.EstadoFacturacion,
            CantidadFacturada: partida.CantidadFacturada ?? 0m,
            ImporteFacturado:  partida.ImporteFacturado  ?? 0m,
            Asignaciones: asignaciones.Select(a => new ComprobanteAsignacionResponse(
                IdAsignacion:    a.IdAsignacion,
                IdComprobante:   a.IdComprobante,
                TipoComprobante: a.Comprobante?.TipoComprobante ?? "",
                UuidCfdi:        a.Comprobante?.UuidCfdi,
                CantidadAsignada: a.CantidadAsignada,
                ImporteAsignado:  a.ImporteAsignado,
                FechaAsignacion:  a.FechaAsignacion,
                Notas:            a.Notas
            )).ToList()
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task RecalcularEstadoPartidaAsync(int idPartida, CancellationToken ct)
    {
        var p = await _db.OrdenesCompraPartidas
            .FirstOrDefaultAsync(x => x.IdPartida == idPartida, ct);
        if (p is null) return;

        var cantFacturada   = p.CantidadFacturada ?? 0m;
        var importeFacturado = p.ImporteFacturado  ?? 0m;

        // Estado 2 (completo) si: cantidad cubierta (CFDI) O importe cubierto (pagos)
        byte estado = (cantFacturada >= p.Cantidad - Tolerancia || importeFacturado >= p.Total - Tolerancia)
            ? (byte)2
            : (cantFacturada > 0m || importeFacturado > 0m)
                ? (byte)1
                : (byte)0;

        await _db.OrdenesCompraPartidas
            .Where(x => x.IdPartida == idPartida)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.EstadoFacturacion, estado), ct);
    }

    private static ComprobanteResponse MapToResponse(Comprobante c) => new(
        IdComprobante:    c.IdComprobante,
        Categoria:        c.Categoria,
        TipoComprobante:  c.TipoComprobante,
        EsCfdi:           c.EsCfdi,
        UuidCfdi:         c.UuidCfdi,
        RfcEmisor:        c.RfcEmisor,
        NombreEmisor:     c.NombreEmisor,
        Total:            c.Total,
        Estado:           c.Estado,
        EstadoDescripcion: c.Estado switch { 0 => "Pendiente", 1 => "Parcial", 2 => "Aplicado", 3 => "Rechazado", _ => "" },
        FechaCreacion:    c.FechaCreacion,
        ReferenciaPago:   c.ReferenciaPago,
        FechaPago:        c.FechaPago,
        MontoPago:        c.MontoPago,
        Conceptos: c.Conceptos.Select(MapConcepto).ToList()
    );

    private static ComprobanteConceptoResponse MapConcepto(ComprobanteConcepto c) => new(
        IdConcepto:        c.IdConcepto,
        NumeroConcepto:    c.NumeroConcepto,
        Descripcion:       c.Descripcion,
        Cantidad:          c.Cantidad,
        ValorUnitario:     c.ValorUnitario,
        Importe:           c.Importe,
        TasaIva:           c.TasaIva,
        CantidadAsignada:  c.CantidadAsignada,
        ImporteAsignado:   c.ImporteAsignado,
        CantidadPendiente: c.Cantidad - c.CantidadAsignada,
        ImportePendiente:  c.Importe  - c.ImporteAsignado
    );
}
