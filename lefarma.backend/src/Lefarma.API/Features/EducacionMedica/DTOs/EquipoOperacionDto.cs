namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class EquipoOperacionDto
{
    public int IdEquipo { get; set; }
    public string NombreEjecutivo { get; set; } = string.Empty;
    public string NombreEspecialista { get; set; } = string.Empty;
    public DateOnly FechaInicio { get; set; }
    public DateOnly? FechaFin { get; set; }
    public bool Activo { get; set; }
    public int TotalSelecciones { get; set; }
    public int TotalVisitasConfirmadas { get; set; }
    public List<EquipoParticipacionDto> Participaciones { get; set; } = [];
}

public class EquipoParticipacionDto
{
    public int IdSeleccionMensual { get; set; }
    public DateOnly FechaSeleccion { get; set; }
    public string EstadoSeleccion { get; set; } = string.Empty;
    public List<EquipoRegionOperadaDto> Regiones { get; set; } = [];
    public List<EquipoRutaOperadaDto> Rutas { get; set; } = [];
}

public class EquipoRegionOperadaDto
{
    public int IdRegion { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int CantidadHospitales { get; set; }
}

public class EquipoRutaOperadaDto
{
    public int IdRuta { get; set; }
    public int Version { get; set; }
    public string Estado { get; set; } = string.Empty;
    public DateTime? FechaConfirmacion { get; set; }
    public int TotalVisitas { get; set; }
}
