using System.Diagnostics;
using System.Globalization;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using ErrorOr;
using FluentValidation;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Catalogos.Proveedores;

public partial class ProveedorService
{
    private const int MaxBulkUploadFileBytes = 5_000_000;
    private const int MaxBulkUploadRows = 10_000;

    public async Task<ErrorOr<BulkUploadResultResponse>> BulkUploadAsync(Stream csvStream, string fileName)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = new BulkUploadResultResponse();

        try
        {
            if (!fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            {
                return CommonErrors.Validation("file", "El archivo debe tener extensión .csv");
            }

            var csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                HasHeaderRecord = true,
                HeaderValidated = null,
                MissingFieldFound = null,
                TrimOptions = TrimOptions.Trim,
                PrepareHeaderForMatch = args => BulkUploadColumns.NormalizeHeader(args.Header),
                BadDataFound = null,
            };

            using var reader = new StreamReader(csvStream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            using var csv = new CsvReader(reader, csvConfig);

            await csv.ReadAsync();
            csv.ReadHeader();

            var headerRecord = csv.HeaderRecord ?? Array.Empty<string>();
            var normalizedHeaders = headerRecord.Select(BulkUploadColumns.NormalizeHeader).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missingRequired = BulkUploadColumns.RequiredColumns.Where(req => !normalizedHeaders.Contains(req)).ToList();
            if (missingRequired.Count > 0)
            {
                return CommonErrors.Validation("headers", $"Faltan columnas requeridas: {string.Join(", ", missingRequired)}");
            }

            var rows = new List<BulkUploadCsvRow>();
            while (await csv.ReadAsync())
            {
                if (rows.Count >= MaxBulkUploadRows)
                {
                    return CommonErrors.Validation("rows", $"El archivo excede el máximo de {MaxBulkUploadRows} filas permitidas");
                }
                rows.Add(csv.GetRecord<BulkUploadCsvRow>()!);
            }

            result.TotalRows = rows.Count;

            if (rows.Count == 0)
            {
                return CommonErrors.Validation("file", "El archivo CSV no contiene filas de datos");
            }

            var validRegimenIds = await _dbContext.RegimenesFiscales
                .AsNoTracking()
                .Select(r => r.IdRegimenFiscal)
                .ToHashSetAsync();

            var validFormaPagoIds = await _dbContext.FormasPago
                .AsNoTracking()
                .Select(fp => fp.IdFormaPago)
                .ToHashSetAsync();

            var validBancoIds = await _dbContext.Bancos
                .AsNoTracking()
                .Select(b => b.IdBanco)
                .ToHashSetAsync();

            var existingRazonesSociales = await _dbContext.Proveedores
                .AsNoTracking()
                .Select(p => p.RazonSocial)
                .ToHashSetAsync(StringComparer.OrdinalIgnoreCase);

            var existingRFCs = await _dbContext.Proveedores
                .AsNoTracking()
                .Where(p => p.RFC != null)
                .Select(p => p.RFC!)
                .ToHashSetAsync(StringComparer.OrdinalIgnoreCase);

            var validator = new CreateProveedorRequestValidator();
            var seenRazonesSociales = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var seenRFCs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            BulkUploadCsvRow? previousRow = null;
            Proveedor? currentProveedor = null;
            var proveedoresToInsert = new List<Proveedor>();

            for (int i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                var rowNumber = i + 2; 

                bool isContinuation = IsContinuationRow(row, previousRow);

                if (isContinuation && currentProveedor != null)
                {
                    TryAddCuentaToProveedor(currentProveedor, row, rowNumber, validFormaPagoIds, validBancoIds, result);
                }
                else
                {
                    currentProveedor = await TryCreateProveedorFromRowAsync(
                        row, rowNumber, validator,
                        validRegimenIds, validFormaPagoIds, validBancoIds,
                        existingRazonesSociales, existingRFCs,
                        seenRazonesSociales, seenRFCs,
                        result);

                    if (currentProveedor != null)
                    {
                        proveedoresToInsert.Add(currentProveedor);
                    }
                }

                previousRow = row;
            }

            if (proveedoresToInsert.Count > 0)
            {
                await using var tx = await _dbContext.Database.BeginTransactionAsync();
                _dbContext.Proveedores.AddRange(proveedoresToInsert);
                await _dbContext.SaveChangesAsync();
                await tx.CommitAsync();

                result.ProveedoresImported = proveedoresToInsert.Count;
                result.CuentasImported = proveedoresToInsert.Sum(p => p.CuentasFormaPago.Count);
            }

            result.FailedRows = result.Errors.Count;

            EnrichWideEvent(action: "BulkUpload", additionalContext: new Dictionary<string, object>
            {
                ["fileName"] = fileName,
                ["totalRows"] = result.TotalRows,
                ["proveedoresImported"] = result.ProveedoresImported,
                ["cuentasImported"] = result.CuentasImported,
                ["failedRows"] = result.FailedRows,
                ["durationMs"] = stopwatch.ElapsedMilliseconds,
            });

            return result;
        }
        catch (DbUpdateException ex)
        {
            EnrichWideEvent(action: "BulkUpload", error: ex.GetDetailedMessage());
            return CommonErrors.DatabaseError("guardar la carga masiva de proveedores");
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "BulkUpload", error: ex.GetDetailedMessage());
            return CommonErrors.InternalServerError($"Error inesperado durante la carga masiva: {ex.Message}");
        }
    }

    private static bool IsContinuationRow(BulkUploadCsvRow current, BulkUploadCsvRow? previous)
    {
        if (previous is null) return false;

        var currentRazon = current.RazonSocial?.Trim() ?? string.Empty;
        var previousRazon = previous.RazonSocial?.Trim() ?? string.Empty;
        if (!string.Equals(currentRazon, previousRazon, StringComparison.OrdinalIgnoreCase))
            return false;

        var currentRfcEmpty = string.IsNullOrWhiteSpace(current.RFC);
        var previousRfcEmpty = string.IsNullOrWhiteSpace(previous.RFC);
        if (currentRfcEmpty && previousRfcEmpty) return true;
        if (currentRfcEmpty != previousRfcEmpty) return false;

        return string.Equals(current.RFC!.Trim(), previous.RFC!.Trim(), StringComparison.OrdinalIgnoreCase);
    }

private async Task<Proveedor?> TryCreateProveedorFromRowAsync(
        BulkUploadCsvRow row,
        int rowNumber,
        CreateProveedorRequestValidator validator,
        HashSet<int> validRegimenIds,
        HashSet<int> validFormaPagoIds,
        HashSet<int> validBancoIds,
        HashSet<string> existingRazonesSociales,
        HashSet<string> existingRFCs,
        HashSet<string> seenRazonesSociales,
        HashSet<string> seenRFCs,
        BulkUploadResultResponse result)
    {
        var razonSocial = row.RazonSocial?.Trim();
        if (string.IsNullOrWhiteSpace(razonSocial))
        {
            result.Errors.Add(new BulkUploadRowError
            {
                RowNumber = rowNumber,
                Field = nameof(BulkUploadColumns.RazonSocial),
                Message = "La razón social es obligatoria"
            });
            return null;
        }

        var rfc = string.IsNullOrWhiteSpace(row.RFC) ? null : row.RFC.Trim().ToUpperInvariant();

        if (seenRazonesSociales.Contains(razonSocial))
        {
            result.Errors.Add(new BulkUploadRowError
            {
                RowNumber = rowNumber,
                Field = nameof(BulkUploadColumns.RazonSocial),
                Message = $"Duplicado dentro del archivo CSV — si quieres agregar más cuentas bancarias al mismo proveedor '{razonSocial}', las filas deben estar consecutivas"
            });
            return null;
        }

        if (existingRazonesSociales.Contains(razonSocial))
        {
            result.Errors.Add(new BulkUploadRowError
            {
                RowNumber = rowNumber,
                Field = nameof(BulkUploadColumns.RazonSocial),
                Message = $"Ya existe un proveedor con razón social '{razonSocial}'"
            });
            return null;
        }

        if (rfc != null)
        {
            if (seenRFCs.Contains(rfc))
            {
                result.Errors.Add(new BulkUploadRowError
                {
                    RowNumber = rowNumber,
                    Field = nameof(BulkUploadColumns.RFC),
                    Message = $"Duplicado dentro del archivo CSV — si quieres agregar más cuentas bancarias al mismo proveedor con RFC '{rfc}', las filas deben estar consecutivas"
                });
                return null;
            }

            if (existingRFCs.Contains(rfc))
            {
                result.Errors.Add(new BulkUploadRowError
                {
                    RowNumber = rowNumber,
                    Field = nameof(BulkUploadColumns.RFC),
                    Message = $"Ya existe un proveedor con RFC '{rfc}'"
                });
                return null;
            }
        }

        int? regimenFiscalId = null;
        if (!string.IsNullOrWhiteSpace(row.RegimenFiscalId))
        {
            if (!int.TryParse(row.RegimenFiscalId.Trim(), out var parsed))
            {
                result.Errors.Add(new BulkUploadRowError
                {
                    RowNumber = rowNumber,
                    Field = nameof(BulkUploadColumns.RegimenFiscalId),
                    Message = $"RegimenFiscalId '{row.RegimenFiscalId}' no es un número válido"
                });
                return null;
            }
            if (!validRegimenIds.Contains(parsed))
            {
                result.Errors.Add(new BulkUploadRowError
                {
                    RowNumber = rowNumber,
                    Field = nameof(BulkUploadColumns.RegimenFiscalId),
                    Message = $"Régimen fiscal con id {parsed} no existe"
                });
                return null;
            }
            regimenFiscalId = parsed;
        }

        var createRequest = new CreateProveedorRequest
        {
            RazonSocial = razonSocial,
            RFC = rfc,
            CodigoPostal = string.IsNullOrWhiteSpace(row.CodigoPostal) ? null : row.CodigoPostal.Trim(),
            RegimenFiscalId = regimenFiscalId,
            UsoCfdi = string.IsNullOrWhiteSpace(row.UsoCfdi) ? null : row.UsoCfdi.Trim(),
            Detalle = HasDetalleData(row) ? new CreateProveedorDetalleRequest
            {
                PersonaContactoNombre = string.IsNullOrWhiteSpace(row.PersonaContactoNombre) ? null : row.PersonaContactoNombre.Trim(),
                ContactoTelefono = string.IsNullOrWhiteSpace(row.ContactoTelefono) ? null : row.ContactoTelefono.Trim(),
                ContactoEmail = string.IsNullOrWhiteSpace(row.ContactoEmail) ? null : row.ContactoEmail.Trim(),
                Comentario = string.IsNullOrWhiteSpace(row.Comentario) ? null : row.Comentario.Trim(),
            } : null,
        };

        var validation = await validator.ValidateAsync(createRequest);
        if (!validation.IsValid)
        {
            foreach (var failure in validation.Errors)
            {
                result.Errors.Add(new BulkUploadRowError
                {
                    RowNumber = rowNumber,
                    Field = failure.PropertyName,
                    Message = failure.ErrorMessage
                });
            }
            return null;
        }

        var proveedor = new Proveedor
        {
            RazonSocial = createRequest.RazonSocial,
            RazonSocialNormalizada = StringExtensions.RemoveDiacritics(createRequest.RazonSocial),
            RFC = createRequest.RFC,
            CodigoPostal = createRequest.CodigoPostal,
            RegimenFiscalId = createRequest.RegimenFiscalId,
            UsoCfdi = createRequest.UsoCfdi,
            SinDatosFiscales = createRequest.SinDatosFiscales,
            FechaRegistro = DateTime.UtcNow,
            Estatus = EstatusProveedor.Nuevo,
            Detalle = createRequest.Detalle != null ? new ProveedorDetalle
            {
                PersonaContactoNombre = createRequest.Detalle.PersonaContactoNombre,
                ContactoTelefono = createRequest.Detalle.ContactoTelefono,
                ContactoEmail = createRequest.Detalle.ContactoEmail,
                Comentario = createRequest.Detalle.Comentario,
                FechaCreacion = DateTime.UtcNow,
            } : null,
        };

        seenRazonesSociales.Add(razonSocial);
        if (rfc != null) seenRFCs.Add(rfc);

        TryAddCuentaToProveedor(proveedor, row, rowNumber, validFormaPagoIds, validBancoIds, result);

        return proveedor;
    }

    private static void TryAddCuentaToProveedor(
        Proveedor proveedor,
        BulkUploadCsvRow row,
        int rowNumber,
        HashSet<int> validFormaPagoIds,
        HashSet<int> validBancoIds,
        BulkUploadResultResponse result)
    {
        if (string.IsNullOrWhiteSpace(row.FormaPagoId))
        {
            return;
        }

        if (!int.TryParse(row.FormaPagoId.Trim(), out var idFormaPago))
        {
            result.Errors.Add(new BulkUploadRowError
            {
                RowNumber = rowNumber,
                Field = nameof(BulkUploadColumns.FormaPagoId),
                Message = $"FormaPagoId '{row.FormaPagoId}' no es un número válido"
            });
            return;
        }

        if (!validFormaPagoIds.Contains(idFormaPago))
        {
            result.Errors.Add(new BulkUploadRowError
            {
                RowNumber = rowNumber,
                Field = nameof(BulkUploadColumns.FormaPagoId),
                Message = $"Forma de pago con id {idFormaPago} no existe"
            });
            return;
        }

        int? idBanco = null;
        if (!string.IsNullOrWhiteSpace(row.BancoId))
        {
            if (!int.TryParse(row.BancoId.Trim(), out var parsedBanco))
            {
                result.Errors.Add(new BulkUploadRowError
                {
                    RowNumber = rowNumber,
                    Field = nameof(BulkUploadColumns.BancoId),
                    Message = $"BancoId '{row.BancoId}' no es un número válido"
                });
                return;
            }
            if (!validBancoIds.Contains(parsedBanco))
            {
                result.Errors.Add(new BulkUploadRowError
                {
                    RowNumber = rowNumber,
                    Field = nameof(BulkUploadColumns.BancoId),
                    Message = $"Banco con id {parsedBanco} no existe"
                });
                return;
            }
            idBanco = parsedBanco;
        }

        proveedor.CuentasFormaPago.Add(new ProveedorFormaPagoCuenta
        {
            IdFormaPago = idFormaPago,
            IdBanco = idBanco,
            NumeroCuenta = string.IsNullOrWhiteSpace(row.NumeroCuenta) ? null : row.NumeroCuenta.Replace(" ", ""),
            Clabe = string.IsNullOrWhiteSpace(row.CLABE) ? null : row.CLABE.Replace(" ", ""),
            NumeroTarjeta = string.IsNullOrWhiteSpace(row.NumeroTarjeta) ? null : row.NumeroTarjeta.Trim(),
            Beneficiario = string.IsNullOrWhiteSpace(row.Beneficiario) ? null : row.Beneficiario.Trim(),
            CorreoNotificacion = string.IsNullOrWhiteSpace(row.CorreoNotificacion) ? null : row.CorreoNotificacion.Trim(),
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
        });
    }

    private static bool HasDetalleData(BulkUploadCsvRow row) =>
        !string.IsNullOrWhiteSpace(row.PersonaContactoNombre) ||
        !string.IsNullOrWhiteSpace(row.ContactoTelefono) ||
        !string.IsNullOrWhiteSpace(row.ContactoEmail) ||
        !string.IsNullOrWhiteSpace(row.Comentario);
}
