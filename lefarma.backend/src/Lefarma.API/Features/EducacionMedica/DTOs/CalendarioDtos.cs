namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class CalendarioFiltro
{
    public int? IdSeleccion { get; set; }
    public DateOnly? Desde { get; set; }
    public DateOnly? Hasta { get; set; }
    public int? IdGerencia { get; set; }
    public int? IdRegion { get; set; }
    public int? IdEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? Estado { get; set; }
    public string? TipoVisita { get; set; }
}

public class CalendarioItemDto
{
    public int IdRutaVisita { get; set; }
    public int IdRuta { get; set; }
    public int IdSeleccionMensual { get; set; }
    public int? IdTaller { get; set; }
    public int? IdSeleccionHospital { get; set; }
    public int? IdHospital { get; set; }
    public string? Hospital { get; set; }
    public string? Region { get; set; }
    public string Gerencia { get; set; } = string.Empty;
    public string EstadoRuta { get; set; } = string.Empty;
    public string? Institucion { get; set; }
    public string? CiudadMunicipio { get; set; }
    public DateOnly Fecha { get; set; }
    public int Orden { get; set; }
    public TimeOnly? Hora { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public string TipoVisita { get; set; } = "Taller";
    public string? Tema { get; set; }
    public string? Producto { get; set; }
    public int? Cantidad { get; set; }
    public decimal? Costo { get; set; }
    public int? Participantes { get; set; }
    public string Estado { get; set; } = "SinTaller";
    public bool EsExtraordinario { get; set; }
    public bool Bloqueado { get; set; }
    public bool SolicitudCambioPendiente { get; set; }
    public List<string> Conflictos { get; set; } = [];
}
