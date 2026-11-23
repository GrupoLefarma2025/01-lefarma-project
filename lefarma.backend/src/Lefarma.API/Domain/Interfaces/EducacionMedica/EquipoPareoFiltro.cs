namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public class EquipoPareoFiltro
{
    public bool? SoloVigentes { get; set; }

    public string? Busqueda { get; set; }

    public int? IdUsuario { get; set; }

    public DateOnly? FechaInicio { get; set; }
    public DateOnly? FechaFin { get; set; }
}
