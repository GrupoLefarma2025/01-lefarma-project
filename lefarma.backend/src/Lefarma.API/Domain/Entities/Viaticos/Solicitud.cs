namespace Lefarma.API.Domain.Entities.Viaticos;

public class Solicitud
{
    public int IdSolicitud { get; set; }
    public int IdUsuarioSolicitante { get; set; }
    public string Periodo { get; set; } = string.Empty;
    public string Gerencia { get; set; } = string.Empty;
    public string Estado { get; set; } = "borrador";
    public string DatosJson { get; set; } = "{}";
    public string? Folio { get; set; }
    public string? PersonaSolicitante { get; set; }
    public string? PersonaViajera { get; set; }
    public string SistemaOrigen { get; set; } = "viaticos";
    public int IdUsuarioCreacion { get; set; }
    public int NumPuntos { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }

    public List<SolicitudOpcion> Opciones { get; set; } = new();
    public List<SolicitudAjuste> Ajustes { get; set; } = new();
    public List<SolicitudEvento> Eventos { get; set; } = new();
    public List<SolicitudOrigenEmVisita> OrigenEmVisitas { get; set; } = new();
}

public class SolicitudOpcion
{
    public int IdOpcion { get; set; }
    public int IdSolicitud { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Linea { get; set; } = string.Empty;
    public string? DatosJson { get; set; }
    public decimal? Precio { get; set; }
    public string? Moneda { get; set; }
    public string? UrlCompra { get; set; }
    public string Fuente { get; set; } = string.Empty;
    public bool FueElegida { get; set; }
    public string? RutaCaptura { get; set; }
    public DateTime? CapturadaEn { get; set; }
}

public class SolicitudAjuste
{
    public int IdAjuste { get; set; }
    public int IdSolicitud { get; set; }
    public int? IdOpcion { get; set; }
    public string Campo { get; set; } = string.Empty;
    public string? ValorAnterior { get; set; }
    public string? ValorNuevo { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public int IdUsuarioAdmin { get; set; }
    public DateTime FechaCreacion { get; set; }
}

public class SolicitudEvento
{
    public int IdEvento { get; set; }
    public int IdSolicitud { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
    public int IdUsuario { get; set; }
    public DateTime FechaCreacion { get; set; }
}
