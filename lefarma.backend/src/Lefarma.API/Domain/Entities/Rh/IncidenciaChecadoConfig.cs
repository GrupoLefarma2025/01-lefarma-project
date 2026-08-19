namespace Lefarma.API.Domain.Entities.Rh;

public class IncidenciaChecadoConfig
{
    public int IdConfig { get; set; }
    public string Nombre { get; set; } = null!;
    public string? NombreNormalizado { get; set; }
    public string Descripcion { get; set; } = null!;
    public string? DescripcionNormalizada { get; set; }
    public string TipoIncidencia { get; set; } = null!;
    public int? MinutosMin { get; set; }
    public int? MinutosMax { get; set; }
    public int CantidadAcumulada { get; set; }
    public string Periodo { get; set; } = null!;
    public int Prioridad { get; set; }
    public bool RegistroEntrada { get; set; }
    public bool RegistroSalida { get; set; }
    public bool Activo { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaModificacion { get; set; }
}
