namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class Hospital
{
    public int CodigoContacto { get; set; }
    public string? NombreContacto { get; set; }
    public string? Rfc { get; set; }
    public string? Calle { get; set; }
    public string? Colonia { get; set; }
    public string? Ciudad { get; set; }
    public string? CodigoEstado { get; set; }
    public string? Cp { get; set; }
    public int? CodigoEtiqueta { get; set; }
    public byte? RequiereAutorizacionCxC { get; set; }
    public int? CodigoClasificacion { get; set; }
    public int? CodigoSubClasificacion { get; set; }
    public string? Tipo { get; set; }
    public int? CodigoListaDePrecios { get; set; }
    public string? CodigoRegimenFiscal { get; set; }
    public string? CodigoUsoDelCFDI { get; set; }
    public int? CodigoFormaDePago { get; set; }
    public int? CodigoTerminoDePago { get; set; }
    public string? Zona { get; set; }
    public string? Representante { get; set; }
    public string? Email { get; set; }
    public string? Clues { get; set; }
    public byte? VentaConLicitacion { get; set; }
    public int? CodigoContactoPrincipal { get; set; }
    public decimal? Latitud { get; set; }
    public decimal? Longitud { get; set; }
    public byte? Activo { get; set; }
    public string? NombreCorto { get; set; }
    public DateTime? FechaCreacion { get; set; }
    public int? CodigoUsuarioCreo { get; set; }
    public DateTime? FechaActualizacion { get; set; }
    public int? CodigoUsuarioActualizo { get; set; }
}
