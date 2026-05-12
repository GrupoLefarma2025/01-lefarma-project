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
using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Facturas;

public class ComprobanteService : IComprobanteService
{
    private const decimal Tolerancia = 0.01m;

    private static readonly JsonSerializerOptions _jsonUtf8 = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        WriteIndented = false,
    };

    private static readonly JsonSerializerOptions _jsonRead = new()
    {
        PropertyNameCaseInsensitive = true,
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
            return CommonErrors.Validation("XmlInvalido", "El XML no es un CFDI valido o esta malformado");
        }

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
            catch (FormatException) { return CommonErrors.Validation("XmlInvalido", "El XML no es un CFDI valido o esta malformado"); }

            if (cfdi.Uuid != null && await _repo.UuidExisteAsync(cfdi.Uuid, ct))
                return CommonErrors.Conflict("Comprobante", "Ya existe una factura registrada con este UUID CFDI");

            if (cfdi.Uuid is not null && cfdi.RfcEmisor is not null && cfdi.RfcReceptor is not null)
            {
                var sat = await _sat.ValidarAsync(cfdi.Uuid, cfdi.RfcEmisor, cfdi.RfcReceptor, cfdi.Total, ct);
                if (!sat.Contactado)
                    return CommonErrors.Failure("Comprobante", "No fue posible validar el CFDI con el SAT.");
                if (!sat.EsVigente)
                    return CommonErrors.Validation("SatNoVigente", $"El CFDI no puede ser registrado. Estado SAT: {sat.Estado ?? "Desconocido"}");
            }
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var total = cfdi?.Total ?? request.TotalManual ?? request.MontoPago ?? 0m;

            var comprobante = new Comprobante
            {
                IdEmpresa        = request.IdEmpresa,
                IdUsuarioSubio   = idUsuario,
                IdPasoWorkflow   = request.IdPasoWorkflow,
                IdMedioPago      = request.IdMedioPago,
                Categoria        = request.Categoria,
                TipoComprobante  = request.TipoComprobante,
                Total            = total,
                DatosAdicionales = BuildJson(cfdi, request),
                ReferenciaPago   = request.ReferenciaPago,
                FechaPago        = request.FechaPago,
                MontoPago        = request.MontoPago,
                Estado           = 0,
                FechaCreacion    = DateTime.UtcNow
            };

            _db.Comprobantes.Add(comprobante);
            await _db.SaveChangesAsync(ct);

            // Obtener folio y contar archivos previos para nombrar archivos
            var folio = (await _db.OrdenesCompra
                .Where(o => o.IdOrden == request.IdOrden)
                .Select(o => o.Folio)
                .FirstOrDefaultAsync(ct)) ?? $"OC-{request.IdOrden}";

            var countPrevios = await _db.Comprobantes
                .CountAsync(c => c.Categoria == request.Categoria
                    && _db.ComprobantesPartidas.Any(cp => cp.IdComprobante == c.IdComprobante && cp.Partida!.IdOrden == request.IdOrden), ct);

            var prefijo = esPago ? "Pago" : "Gasto";
            var n = countPrevios + 1;

            // Subir XML si CFDI
            if (esCfdi && xmlContent != null && xmlFileName != null)
            {
                var xmlName = $"{folio}-{prefijo}-{n}.xml";
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
                    monto         = total,
                    paso          = request.IdPasoWorkflow,
                    nombrePaso    = request.NombrePaso,
                    nombreAccion  = request.NombreAccion
                }, _jsonUtf8);
                await _archivoService.SubirAsync(
                    xmlMs, xmlName, "application/xml",
                    new SubirArchivoRequest
                    {
                        EntidadTipo = "OrdenCompra",
                        EntidadId   = request.IdOrden!.Value,
                        Carpeta     = "comprobantes",
                        Metadata    = meta
                    },
                    idUsuario, ct);
            }

            if (archivoStream != null && archivoFileName != null && archivoContentType != null)
            {
                var archivoTipo = esCfdi ? "pdf" : "imagen";
                var ext = Path.GetExtension(archivoFileName);
                var pdfName = $"{folio}-{prefijo}-{n}{ext}";
                var meta = JsonSerializer.Serialize(new
                {
                    modulo        = "ordenes_compra",
                    origen        = "workflow",
                    tipo          = esPago ? "comprobante_pago" : "comprobante_gasto",
                    idOrden       = request.IdOrden,
                    idComprobante = comprobante.IdComprobante,
                    subtipo       = request.TipoComprobante,
                    archivo       = archivoTipo,
                    monto         = total,
                    paso          = request.IdPasoWorkflow,
                    nombrePaso    = request.NombrePaso,
                    nombreAccion  = request.NombreAccion
                }, _jsonUtf8);
                await _archivoService.SubirAsync(
                    archivoStream, pdfName, archivoContentType,
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
        var c = await _repo.GetByIdConAsignacionesAsync(idComprobante, ct);
        if (c is null) return CommonErrors.NotFound("Comprobante");
        return MapToResponse(c);
    }

    public async Task<ErrorOr<List<ComprobanteConceptoResponse>>> GetConceptosAsync(int idComprobante, CancellationToken ct = default)
    {
        var c = await _repo.GetByIdConAsignacionesAsync(idComprobante, ct);
        if (c is null) return CommonErrors.NotFound("Comprobante");
        return ParseConceptos(c).ToList();
    }

    public async Task<ErrorOr<List<PartidaPendienteResponse>>> GetPartidasPendientesAsync(int idOrden, string categoria = "gasto", CancellationToken ct = default)
    {
        if (categoria == "pago")
        {
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
                        Total:              p.Total,
                        CantidadFacturada:  0m,
                        ImporteFacturado:   importePagado,
                        CantidadPendiente:  importePendiente > 0 ? p.Cantidad : 0m,
                        ImportePendiente:   importePendiente,
                        EstadoFacturacion:  importePendiente <= 0 ? 2 : (importePagado > 0 ? 1 : 0)
                    );
                })
                .ToList();
        }

        var gastoPartidas = await _db.OrdenesCompraPartidas
            .Include(p => p.Orden)
            .Where(p => p.IdOrden == idOrden)
            .ToListAsync(ct);

        return gastoPartidas.Select(p =>
        {
            var cantFacturada   = p.CantidadFacturada ?? 0m;
            var importeFacturado = p.ImporteFacturado ?? 0m;
            return new PartidaPendienteResponse(
                IdPartida:          p.IdPartida,
                NumeroPartida:      p.NumeroPartida,
                DescripcionPartida: p.Descripcion,
                FolioOrden:         p.Orden?.Folio ?? "",
                Cantidad:           p.Cantidad,
                PrecioUnitario:     p.PrecioUnitario,
                Total:              p.Total,
                CantidadFacturada:  cantFacturada,
                ImporteFacturado:   importeFacturado,
                CantidadPendiente:  p.Cantidad - cantFacturada,
                ImportePendiente:   p.Total - importeFacturado,
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
        var comprobante = await _repo.GetByIdConAsignacionesAsync(idComprobante, ct);
        if (comprobante is null) return CommonErrors.NotFound("Comprobante");

        bool esCfdi = comprobante.TipoComprobante == "cfdi";

        // Pre-validar cada partida
        foreach (var item in request.Asignaciones)
        {
            var partida = await _db.OrdenesCompraPartidas
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdPartida == item.IdPartida, ct);

            if (partida is null) return CommonErrors.NotFound("Partida", item.IdPartida.ToString());

            if (comprobante.Categoria == "pago")
            {
                var importeYaPagado = await _db.ComprobantesPartidas
                    .Where(cp => cp.IdPartida == item.IdPartida
                              && cp.IdComprobante != idComprobante
                              && cp.Comprobante!.Categoria == "pago")
                    .SumAsync(cp => cp.ImporteAsignado, ct);
                var importePendientePago = partida.Total - importeYaPagado;
                if (item.ImporteAsignado > importePendientePago + Tolerancia)
                    return CommonErrors.Validation("SobreImporte", $"El importe asignado excede el pendiente en la partida {item.IdPartida}");
            }
            else
            {
                var importePendientePartida = partida.Total - (partida.ImporteFacturado ?? 0m);

                if (esCfdi)
                {
                    var cantPendientePartida = partida.Cantidad - (partida.CantidadFacturada ?? 0m);
                    if (item.CantidadAsignada > cantPendientePartida + Tolerancia)
                        return CommonErrors.Validation("SobreCantidad", $"La cantidad asignada excede la pendiente en la partida {item.IdPartida}");
                }

                if (item.ImporteAsignado > importePendientePartida + Tolerancia)
                    return CommonErrors.Validation("SobreImporte", $"El importe asignado excede el pendiente en la partida {item.IdPartida}");
            }
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            foreach (var item in request.Asignaciones)
            {
                var asignacion = new ComprobantePartida
                {
                    IdComprobante    = idComprobante,
                    IdPartida        = item.IdPartida,
                    IdUsuarioAsigno  = idUsuario,
                    IdPasoWorkflow   = idPasoWorkflow,
                    CantidadAsignada = item.CantidadAsignada,
                    ImporteAsignado  = item.ImporteAsignado,
                    Notas            = item.Notas,
                    FechaAsignacion  = DateTime.UtcNow
                };
                _db.ComprobantesPartidas.Add(asignacion);

                if (esCfdi)
                {
                    await _db.OrdenesCompraPartidas
                        .Where(p => p.IdPartida == item.IdPartida)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(p => p.CantidadFacturada,
                                p => (p.CantidadFacturada ?? 0m) + item.CantidadAsignada)
                            .SetProperty(p => p.ImporteFacturado,
                                p => (p.ImporteFacturado ?? 0m) + item.ImporteAsignado),
                            ct);
                    await RecalcularEstadoPartidaAsync(item.IdPartida, ct);
                }
                else if (comprobante.Categoria != "pago")
                {
                    await _db.OrdenesCompraPartidas
                        .Where(p => p.IdPartida == item.IdPartida)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(p => p.ImporteFacturado,
                                p => (p.ImporteFacturado ?? 0m) + item.ImporteAsignado),
                            ct);
                    await RecalcularEstadoPartidaAsync(item.IdPartida, ct);
                }
            }

            // Actualizar estado del comprobante: siempre Aplicado cuando todas las asignaciones estan hechas
            comprobante.Estado = 2;
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
            Asignaciones: asignaciones.Select(a =>
            {
                var cfdi = TryParseCfdi(a.Comprobante?.DatosAdicionales);
                return new ComprobanteAsignacionResponse(
                    IdAsignacion:      a.IdAsignacion,
                    IdComprobante:     a.IdComprobante,
                    TipoComprobante:   a.Comprobante?.TipoComprobante ?? "",
                    UuidCfdi:          cfdi?.Uuid,
                    CantidadAsignada:  a.CantidadAsignada,
                    ImporteAsignado:   a.ImporteAsignado,
                    FechaAsignacion:   a.FechaAsignacion,
                    Notas:             a.Notas
                );
            }).ToList()
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task RecalcularEstadoPartidaAsync(int idPartida, CancellationToken ct)
    {
        var p = await _db.OrdenesCompraPartidas
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdPartida == idPartida, ct);
        if (p is null) return;

        var cantFacturada    = p.CantidadFacturada ?? 0m;
        var importeFacturado = p.ImporteFacturado  ?? 0m;

        byte estado = (cantFacturada >= p.Cantidad - Tolerancia || importeFacturado >= p.Total - Tolerancia)
            ? (byte)2
            : (cantFacturada > 0m || importeFacturado > 0m)
                ? (byte)1
                : (byte)0;

        await _db.OrdenesCompraPartidas
            .Where(x => x.IdPartida == idPartida)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.EstadoFacturacion, estado), ct);
    }

    private static string? BuildJson(CfdiPreviewResponse? cfdi, SubirComprobanteRequest request)
    {
        if (cfdi is null && request.IdMedioPago is null) return null;

        var obj = new Dictionary<string, object?>();

        if (cfdi is not null)
        {
            obj["cfdi"] = new
            {
                uuid           = cfdi.Uuid,
                version        = cfdi.Version,
                serie          = cfdi.Serie,
                folio          = cfdi.FolioCfdi,
                fechaEmision   = cfdi.FechaEmision,
                emisor         = new { rfc = cfdi.RfcEmisor, nombre = cfdi.NombreEmisor },
                receptor       = new { rfc = cfdi.RfcReceptor, nombre = cfdi.NombreReceptor },
                usoCfdi        = cfdi.UsoCfdi,
                metodoPago     = cfdi.MetodoPago,
                formaPago      = cfdi.FormaPago,
                moneda         = cfdi.Moneda,
                totales        = new { subtotal = cfdi.Subtotal, descuento = cfdi.Descuento, iva = cfdi.TotalIva, retenciones = cfdi.TotalRetenciones }
            };

            obj["conceptos"] = cfdi.Conceptos.Select(c => new
            {
                numero         = c.Numero,
                claveProdServ  = c.ClaveProdServ,
                claveUnidad    = c.ClaveUnidad,
                descripcion    = c.Descripcion,
                cantidad       = c.Cantidad,
                valorUnitario  = c.ValorUnitario,
                descuento      = c.Descuento,
                importe        = c.Importe,
                tasaIva        = c.TasaIva,
                importeIva     = c.ImporteIva
            });
        }

        return obj.Count > 0 ? JsonSerializer.Serialize(obj, _jsonUtf8) : null;
    }

    private static CfdiData? TryParseCfdi(string? datosAdicionales)
    {
        if (string.IsNullOrWhiteSpace(datosAdicionales)) return null;
        try
        {
            var doc = JsonDocument.Parse(datosAdicionales);
            if (!doc.RootElement.TryGetProperty("cfdi", out var cfdiEl)) return null;
            return JsonSerializer.Deserialize<CfdiData>(cfdiEl.GetRawText(), _jsonRead);
        }
        catch { return null; }
    }

    private static List<ComprobanteConceptoResponse> ParseConceptos(Comprobante c)
    {
        var result = new List<ComprobanteConceptoResponse>();
        if (string.IsNullOrWhiteSpace(c.DatosAdicionales)) return result;

        try
        {
            var doc = JsonDocument.Parse(c.DatosAdicionales);
            if (!doc.RootElement.TryGetProperty("conceptos", out var arr)) return result;

            int idx = 0;
            foreach (var item in arr.EnumerateArray())
            {
                idx++;
                result.Add(new ComprobanteConceptoResponse(
                    IdConcepto:        idx,
                    NumeroConcepto:    idx,
                    Descripcion:       item.TryGetProperty("descripcion", out var d) ? d.GetString() ?? "" : "",
                    Cantidad:          item.TryGetProperty("cantidad", out var ct) ? ct.GetDecimal() : 0,
                    ValorUnitario:     item.TryGetProperty("valorUnitario", out var vu) ? vu.GetDecimal() : 0,
                    Importe:           item.TryGetProperty("importe", out var im) ? im.GetDecimal() : 0,
                    TasaIva:           item.TryGetProperty("tasaIva", out var ti) ? ti.GetDecimal() : null,
                    CantidadAsignada:  0,
                    ImporteAsignado:   0,
                    CantidadPendiente: item.TryGetProperty("cantidad", out var cta) ? cta.GetDecimal() : 0,
                    ImportePendiente:  item.TryGetProperty("importe", out var imp) ? imp.GetDecimal() : 0
                ));
            }
        }
        catch { /* JSON invalido */ }

        return result;
    }

    private static ComprobanteResponse MapToResponse(Comprobante c)
    {
        var cfdi   = TryParseCfdi(c.DatosAdicionales);
        var esCfdi = c.TipoComprobante == "cfdi";

        return new ComprobanteResponse(
            IdComprobante:     c.IdComprobante,
            Categoria:         c.Categoria,
            TipoComprobante:   c.TipoComprobante,
            EsCfdi:            esCfdi,
            UuidCfdi:          cfdi?.Uuid,
            RfcEmisor:         cfdi?.Emisor?.Rfc,
            NombreEmisor:      cfdi?.Emisor?.Nombre,
            Total:             c.Total,
            Estado:            c.Estado,
            EstadoDescripcion: c.Estado switch { 0 => "Pendiente", 1 => "Parcial", 2 => "Aplicado", 3 => "Rechazado", _ => "" },
            FechaCreacion:     c.FechaCreacion,
            ReferenciaPago:    c.ReferenciaPago,
            FechaPago:         c.FechaPago,
            MontoPago:         c.MontoPago,
            IdMedioPago:       c.IdMedioPago,
            MedioPagoNombre:   c.MedioPago?.Nombre,
            DatosAdicionales:  c.DatosAdicionales,
            Conceptos:         ParseConceptos(c).ToList()
        );
    }

    private class CfdiData
    {
        public string? Uuid { get; set; }
        public EmisorData? Emisor { get; set; }
        public ReceptorData? Receptor { get; set; }
    }

    private class EmisorData
    {
        public string? Rfc { get; set; }
        public string? Nombre { get; set; }
    }

    private class ReceptorData
    {
        public string? Rfc { get; set; }
        public string? Nombre { get; set; }
    }
}
