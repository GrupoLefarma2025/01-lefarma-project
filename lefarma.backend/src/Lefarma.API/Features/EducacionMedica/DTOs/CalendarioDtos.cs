namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class CalendarioFiltro
{
    public int? IdSeleccion { get; set; }
    public int? Version { get; set; }
    public DateOnly? Desde { get; set; }
    public DateOnly? Hasta { get; set; }
    public int? IdGerencia { get; set; }
    public List<int>? IdGerencias { get; set; }
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
    public int? IdTipoGerencia { get; set; }
    public int? IdTaller { get; set; }
    public bool TieneTalleres { get; set; }
    public int TalleresCount { get; set; }
    public int? IdSeleccionHospital { get; set; }
    public int? IdHospital { get; set; }
    public string? Hospital { get; set; }
    public string? Region { get; set; }
    public string Gerencia { get; set; } = string.Empty;
    public string EstadoRuta { get; set; } = string.Empty;
    public string? Institucion { get; set; }
    public string? CiudadMunicipio { get; set; }
    public string? EntidadFederativa { get; set; }
    public DateOnly Fecha { get; set; }
    public int Orden { get; set; }
    public TimeOnly? Hora { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public int? IdTipoVisita { get; set; }
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

public class ActividadVisitaDto
{
    public int IdRutaVisita { get; set; }
    public int IdRuta { get; set; }
    public string? Hospital { get; set; }
    public DateOnly FechaVisita { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public bool CandadoPuesto { get; set; }
    public List<ActividadVisitaTallerDto> Talleres { get; set; } = [];
    public List<ActividadVisitaEventoDto> Eventos { get; set; } = [];
}

public class ActividadVisitaTallerDto
{
    public int IdTaller { get; set; }
    public string? Tema { get; set; }
    public string? Producto { get; set; }
    public DateOnly? FechaTaller { get; set; }
    public TimeOnly? HoraTaller { get; set; }
    public string Estado { get; set; } = string.Empty;
    public DateTime FechaCreacion { get; set; }
    public int? IdEjecutivo { get; set; }
    public string? NombreEjecutivo { get; set; }
    public int? IdEspecialista { get; set; }
    public string? NombreEspecialista { get; set; }
    public bool EsIntegranteEquipo { get; set; }
    public bool CandadoPuesto { get; set; }
    public int? IdSolicitudPendiente { get; set; }
}

public class ActividadVisitaEventoDto
{
    public string Tipo { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public int? IdTaller { get; set; }
    public int? IdSolicitud { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string? Detalle { get; set; }
    public string? Actor { get; set; }
    public string? EstadoAnterior { get; set; }
    public string? EstadoNuevo { get; set; }
    public string? Antes { get; set; }
    public string? Despues { get; set; }
    public string? Motivo { get; set; }
}
