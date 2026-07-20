namespace Lefarma.API.Features.Catalogos.Proveedores.DTOs;

public class ProveedorResponse
{
    public int IdProveedor { get; set; }
    public string RazonSocial { get; set; } = string.Empty;
    public string? RazonSocialNormalizada { get; set; }
    public string? RFC { get; set; }
    public string? CodigoPostal { get; set; }
    public int? RegimenFiscalId { get; set; }
    public string? RegimenFiscalDescripcion { get; set; }
    public string? UsoCfdi { get; set; }
    public bool SinDatosFiscales { get; set; }
    public int Estatus { get; set; }
    public int? CambioEstatusPor { get; set; }
    public DateTime FechaRegistro { get; set; }
    public DateTime? FechaModificacion { get; set; }

    public ProveedorDetalleResponse? Detalle { get; set; }
    public List<ProveedorFormaPagoCuentaResponse> CuentasFormaPago { get; set; } = new();
}

public class ProveedorDetalleResponse
{
    public int IdDetalle { get; set; }
    public int IdProveedor { get; set; }
    public string? PersonaContactoNombre { get; set; }
    public string? ContactoTelefono { get; set; }
    public string? ContactoEmail { get; set; }
    public string? Comentario { get; set; }
    public string? CaratulaUrl { get; set; }
}

public class CreateProveedorRequest
{
    public required string RazonSocial { get; set; }
    public string? RFC { get; set; }
    public string? CodigoPostal { get; set; }
    public int? RegimenFiscalId { get; set; }
    public string? UsoCfdi { get; set; }
    public bool SinDatosFiscales { get; set; }
    public CreateProveedorDetalleRequest? Detalle { get; set; }
    public List<CreateProveedorFormaPagoCuentaRequest>? CuentasFormaPago { get; set; }
}

public class CreateProveedorDetalleRequest
{
    public string? PersonaContactoNombre { get; set; }
    public string? ContactoTelefono { get; set; }
    public string? ContactoEmail { get; set; }
    public string? Comentario { get; set; }
    public string? CaratulaUrl { get; set; }
}

public class CreateProveedorFormaPagoCuentaRequest
{
    public int IdCuenta { get; set; }  // 0 = nueva cuenta, >0 = cuenta existente
    public int IdFormaPago { get; set; }
    public int? IdBanco { get; set; }
    public string? NumeroCuenta { get; set; }
    public string? Clabe { get; set; }
    public string? NumeroTarjeta { get; set; }
    public string? Beneficiario { get; set; }
    public string? CorreoNotificacion { get; set; }
    public bool Activo { get; set; } = true;

    /// <summary>
    /// Ruta relativa de la carátula asociada a esta cuenta (cuando la carátula viaja
    /// dentro de un edit normal). El frontend sube el archivo antes y manda la ruta aquí.
    /// </summary>
    public string? CaratulaUrl { get; set; }
}

public class UpdateProveedorRequest
{
    public required int IdProveedor { get; set; }
    public required string RazonSocial { get; set; }
    public string? RFC { get; set; }
    public string? CodigoPostal { get; set; }
    public int? RegimenFiscalId { get; set; }
    public string? UsoCfdi { get; set; }
    public bool SinDatosFiscales { get; set; }
    public UpdateProveedorDetalleRequest? Detalle { get; set; }
    public List<CreateProveedorFormaPagoCuentaRequest>? CuentasFormaPago { get; set; }
}

public class UpdateProveedorDetalleRequest
{
    public string? PersonaContactoNombre { get; set; }
    public string? ContactoTelefono { get; set; }
    public string? ContactoEmail { get; set; }
    public string? Comentario { get; set; }
    public string? CaratulaUrl { get; set; }
}

public class ProveedorFormaPagoCuentaResponse
{
    public int IdCuenta { get; set; }
    public int IdProveedor { get; set; }
    public int IdFormaPago { get; set; }
    public string? FormaPagoNombre { get; set; }
    public int? IdBanco { get; set; }
    public string? BancoNombre { get; set; }
    public string? NumeroCuenta { get; set; }
    public string? Clabe { get; set; }
    public string? NumeroTarjeta { get; set; }
    public string? Beneficiario { get; set; }
    public string? CorreoNotificacion { get; set; }
    public bool Activo { get; set; }
    public bool TieneOrdenes { get; set; }
    public string? CaratulaUrl { get; set; }
}

public class ProveedorRequest
{
    public string? RazonSocial { get; set; }
    public string? RFC { get; set; }
    public int? Estatus { get; set; }
    public string? OrderBy { get; set; }
    public string? OrderDirection { get; set; }
}

public static class EstatusProveedor
{
    public const int Nuevo = 1;
    public const int Aprobado = 2;
    public const int Rechazado = 3;
    public const int EditadoPendiente = 4;

    public static string GetDescripcion(int estatus) => estatus switch
    {
        Nuevo => "Nuevo",
        Aprobado => "Aprobado",
        Rechazado => "Rechazado",
        EditadoPendiente => "Edición Pendiente",
        _ => "Desconocido"
    };
}

public class CampoDiff
{
    public string Campo { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? ValorAnterior { get; set; }
    public string? ValorNuevo { get; set; }
}

public class StagingProveedorResponse
{
    public int IdStaging { get; set; }
    public int IdProveedor { get; set; }
    public string RazonSocial { get; set; } = string.Empty;
    public string? RazonSocialNormalizada { get; set; }
    public string? RFC { get; set; }
    public string? CodigoPostal { get; set; }
    public int? RegimenFiscalId { get; set; }
    public string? RegimenFiscalNombre { get; set; }
    public string? UsoCfdi { get; set; }
    public bool SinDatosFiscales { get; set; }
    public DateTime FechaStaging { get; set; }
    public int? EditadoPor { get; set; }
    public StagingProveedorDetalleResponse? Detalle { get; set; }
    public List<StagingProveedorFormaPagoCuentaResponse> CuentasFormaPago { get; set; } = new();
    public List<CampoDiff> Diferencias { get; set; } = new();
}

public class StagingProveedorDetalleResponse
{
    public int IdStagingDetalle { get; set; }
    public string? PersonaContactoNombre { get; set; }
    public string? ContactoTelefono { get; set; }
    public string? ContactoEmail { get; set; }
    public string? Comentario { get; set; }
    public string? CaratulaPath { get; set; }
}

public class StagingProveedorFormaPagoCuentaResponse
{
    public int IdStagingCuenta { get; set; }
    public int? IdCuenta { get; set; }
    public int IdFormaPago { get; set; }
    public string? FormaPagoNombre { get; set; }
    public int? IdBanco { get; set; }
    public string? BancoNombre { get; set; }
    public string? NumeroCuenta { get; set; }
    public string? Clabe { get; set; }
    public string? NumeroTarjeta { get; set; }
    public string? Beneficiario { get; set; }
    public string? CorreoNotificacion { get; set; }
    public bool Activo { get; set; }
    public string? CaratulaUrl { get; set; }
}

/// <summary>
/// Carátula de una cuenta bancaria, para el modal "Ver carátulas" del listado.
/// </summary>
public class CaratulaCuentaResponse
{
    public int CuentaId { get; set; }
    public string Ultimos4 { get; set; } = string.Empty;
    public string? CaratulaUrl { get; set; }
}

public class BulkUploadCsvRow
{
    public string? RazonSocial { get; set; }
    public string? RFC { get; set; }
    public string? CodigoPostal { get; set; }
    public string? RegimenFiscalId { get; set; }
    public string? UsoCfdi { get; set; }
    public string? PersonaContactoNombre { get; set; }
    public string? ContactoTelefono { get; set; }
    public string? ContactoEmail { get; set; }
    public string? Comentario { get; set; }
    public string? FormaPagoId { get; set; }
    public string? BancoId { get; set; }
    public string? NumeroCuenta { get; set; }
    public string? CLABE { get; set; }
    public string? NumeroTarjeta { get; set; }
    public string? Beneficiario { get; set; }
    public string? CorreoNotificacion { get; set; }
}

public class BulkUploadRowError
{
    public int RowNumber { get; set; }
    public string? Field { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class BulkUploadResultResponse
{
    public int TotalRows { get; set; }
    public int ProveedoresImported { get; set; }
    public int CuentasImported { get; set; }
    public int FailedRows { get; set; }
    public List<BulkUploadRowError> Errors { get; set; } = new();
}

public static class BulkUploadColumns
{
    public const string RazonSocial = "RazonSocial";
    public const string RFC = "RFC";
    public const string CodigoPostal = "CodigoPostal";
    public const string RegimenFiscalId = "RegimenFiscalId";
    public const string UsoCfdi = "UsoCfdi";
    public const string PersonaContactoNombre = "PersonaContactoNombre";
    public const string ContactoTelefono = "ContactoTelefono";
    public const string ContactoEmail = "ContactoEmail";
    public const string Comentario = "Comentario";
    public const string FormaPagoId = "FormaPagoId";
    public const string BancoId = "BancoId";
    public const string NumeroCuenta = "NumeroCuenta";
    public const string CLABE = "CLABE";
    public const string NumeroTarjeta = "NumeroTarjeta";
    public const string Beneficiario = "Beneficiario";
    public const string CorreoNotificacion = "CorreoNotificacion";

    public static readonly IReadOnlyList<string> OrderedColumns = new[]
    {
        RazonSocial, RFC, CodigoPostal, RegimenFiscalId, UsoCfdi,
        PersonaContactoNombre, ContactoTelefono, ContactoEmail, Comentario,
        FormaPagoId, BancoId, NumeroCuenta, CLABE, NumeroTarjeta,
        Beneficiario, CorreoNotificacion
    };

    public static readonly IReadOnlySet<string> RequiredColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        RazonSocial
    };

    /// <summary>
    /// Cleans header text by stripping " (requerido)" / " (opcional)" suffixes
    /// so user-friendly plantilla headers map back to the canonical column names.
    /// </summary>
    public static string NormalizeHeader(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var clean = raw.Trim();
        var parenIndex = clean.IndexOf(" (", StringComparison.Ordinal);
        if (parenIndex > 0) clean = clean[..parenIndex];
        return clean.Trim();
    }
}
