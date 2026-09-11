namespace Lefarma.API.Domain.Entities.EducacionMedica;

public class Producto
{
    public int CodigoProducto { get; set; }
    public string? NombreInternoProducto { get; set; }
    public string? CodigoFactura { get; set; }
    public string? DescripcionLarga { get; set; }
    public string? Tipo { get; set; }
    public string? TipoAsokam { get; set; }
    public byte? SeVende { get; set; }
    public byte? SeCompra { get; set; }
    public byte? EsGasto { get; set; }
    public string? CodigoBarras { get; set; }
    public string? RegistroSanitario { get; set; }
    public DateTime? VigenciaRegistroSanitario { get; set; }
    public string? DescripcionFactura { get; set; }
    public string? DescripcionCorta { get; set; }
    public string? DescripcionUnificada { get; set; }
    public string? Presentacion { get; set; }
    public int? Empaque { get; set; }
    public int? CodigoProductoSAT { get; set; }
    public int? CantidadInsumos { get; set; }
    public int? CodigoListaMaterial { get; set; }
    public string? ListaMateriales { get; set; }
    public string? IdsMensajes { get; set; }
    public int? CodigoUnidadDeMedida { get; set; }
    public string? DescripcionUnidadDeMedida { get; set; }
    public int? AniosDeCaducidad { get; set; }
    public string? MarcaIMSS { get; set; }
    public string? DescripcionIMSS { get; set; }
    public string? DescripcionBienestar { get; set; }
    public int? CodigoProductoProductoCat { get; set; }
    public string? CodigoProductoBaseBase { get; set; }
    public string? TipoProductoInterno { get; set; }
    public decimal? UnidadEquivalenteProduccion { get; set; }
    public DateTime? FechaCreacion { get; set; }
    public int? CodigoUsuarioCreo { get; set; }
    public DateTime? FechaActualizacion { get; set; }
    public int? CodigoUsuarioActualizo { get; set; }
    public int? CodigoProductoBase { get; set; }
}
