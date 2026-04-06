using Lefarma.API.Shared.Extensions;

namespace Lefarma.API.Domain.Entities.Catalogos;

public class TipoImpuesto
{
    public int IdTipoImpuesto { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? NombreNormalizado { get; set; }
    public string Clave { get; set; } = string.Empty;
    public decimal Tasa { get; set; }
    public string? Descripcion { get; set; }
    public string? DescripcionNormalizada { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaModificacion { get; set; }

    // Métodos de dominio (opcional - DDD)
    public void Activar() => Activo = true;
    public void Desactivar() => Activo = false;
    public void ActualizarNombreNormalizado()
    {
        NombreNormalizado = Nombre?.ToLowerInvariant().RemoveDiacritics();
    }
    public void ActualizarDescripcionNormalizada()
    {
        DescripcionNormalizada = Descripcion?.ToLowerInvariant().RemoveDiacritics();
    }
}
