namespace Lefarma.API.Domain.Interfaces.EducacionMedica;

public class EquipoPareoFiltro
{
    /// <summary>true = solo vigentes, false = solo inactivos, null = todos</summary>
    public bool? SoloVigentes { get; set; }

    /// <summary>Busqueda por nombre del ejecutivo o especialista (se aplica en servicio tras resolver nombres de Asokam)</summary>
    public string? Busqueda { get; set; }

    /// <summary>Id de usuario: equipos donde es ejecutivo o especialista</summary>
    public int? IdUsuario { get; set; }

    /// <summary>Rango de vigencia: equipos cuya vigencia se traslapa con [FechaInicio, FechaFin]</summary>
    public DateOnly? FechaInicio { get; set; }
    public DateOnly? FechaFin { get; set; }
}
