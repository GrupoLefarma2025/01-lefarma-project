namespace Lefarma.API.Domain.Entities.Viaticos;

/// <summary>
/// Maestro del wizard de viáticos. Una fila por solicitud. Mapea la tabla
/// [viaticos].[solicitudes] creada por el script
/// lefarma.database/viaticos/0003_20261007-0000_viaticos_schema-solicitudes.lefarma.sql.
/// Estado del wizard serializado en <see cref="DatosJson"/>; aquí vive la
/// fuente de verdad para el concentrado y el listado del admin.
/// </summary>
public class Solicitud
{
    public int IdSolicitud { get; set; }
    public int IdUsuarioSolicitante { get; set; }
    public string Periodo { get; set; } = string.Empty;
    public string Gerencia { get; set; } = string.Empty;
    public string Estado { get; set; } = "borrador";
    public string DatosJson { get; set; } = "{}";
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; }
    public DateTime FechaModificacion { get; set; }

    public List<SolicitudOpcion> Opciones { get; set; } = new();
    public List<SolicitudAjuste> Ajustes { get; set; } = new();
    public List<SolicitudEvento> Eventos { get; set; } = new();
}

/// <summary>
/// Opciones de vuelo/hotel adjuntas a una solicitud. Mapea
/// [viaticos].[solicitud_opciones]. <see cref="FueElegida"/> marca la
/// ganadora (la app garantiza máximo 1 por (id_solicitud, tipo)).
/// </summary>
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

/// <summary>
/// Ajustes manuales hechos por admin al transicionar a
/// 'autorizada_con_ajustes'. Mapea [viaticos].[solicitud_ajustes].
/// <see cref="Motivo"/> es obligatorio (sin DEFAULT) para dejar rastro.
/// </summary>
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

/// <summary>
/// Bitácora append-only de transiciones del workflow. Mapea
/// [viaticos].[solicitud_eventos]. Sin activo: cuando la solicitud se
/// borra, los eventos se van con ella (ON DELETE CASCADE).
/// </summary>
public class SolicitudEvento
{
    public int IdEvento { get; set; }
    public int IdSolicitud { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
    public int IdUsuario { get; set; }
    public DateTime FechaCreacion { get; set; }
}
