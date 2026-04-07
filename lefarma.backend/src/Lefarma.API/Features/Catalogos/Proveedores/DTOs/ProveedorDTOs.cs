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
}

public class ProveedorDetalleResponse
{
    public int IdDetalle { get; set; }
    public int IdProveedor { get; set; }
    public string? PersonaContactoNombre { get; set; }
    public string? ContactoTelefono { get; set; }
    public string? ContactoEmail { get; set; }
    public string? Comentario { get; set; }
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
}

public class CreateProveedorDetalleRequest
{
    public string? PersonaContactoNombre { get; set; }
    public string? ContactoTelefono { get; set; }
    public string? ContactoEmail { get; set; }
    public string? Comentario { get; set; }
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
}

public class UpdateProveedorDetalleRequest
{
    public string? PersonaContactoNombre { get; set; }
    public string? ContactoTelefono { get; set; }
    public string? ContactoEmail { get; set; }
    public string? Comentario { get; set; }
}

public class ProveedorRequest
{
    public string? RazonSocial { get; set; }
    public string? RFC { get; set; }
    public string? OrderBy { get; set; }
    public string? OrderDirection { get; set; }
}

public static class EstatusProveedor
{
    public const int Nuevo = 1;
    public const int Aprobado = 2;
    public const int Rechazado = 3;

    public static string GetDescripcion(int estatus) => estatus switch
    {
        Nuevo => "Nuevo",
        Aprobado => "Aprobado",
        Rechazado => "Rechazado",
        _ => "Desconocido"
    };
}
