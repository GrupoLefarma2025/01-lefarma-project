namespace Lefarma.API.Domain.Entities.Viaticos;

/// <summary>
/// Catálogo propio de municipios (viaticos.municipios_cat).
/// Asokam no expone municipios; se llena y actualiza con OpenStreetMap
/// mediante el job semanal SP_Jobs_ActualizaMunicipios.
/// codigo_estado es FK lógica -> Asokam.genEstadosCat.
/// </summary>
public class Municipio
{
    public int IdMunicipio { get; set; }
    public int CodigoEstado { get; set; }
    public string Nombre { get; set; } = string.Empty;

    /// <summary>Identificador de OpenStreetMap (admin_level=8). Null para altas manuales.</summary>
    public string? ClaveMunicipio { get; set; }

    /// <summary>Centroide del municipio según OpenStreetMap; sirve para centrar el mapa del selector.</summary>
    public double? Latitud { get; set; }
    public double? Longitud { get; set; }

    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }
}