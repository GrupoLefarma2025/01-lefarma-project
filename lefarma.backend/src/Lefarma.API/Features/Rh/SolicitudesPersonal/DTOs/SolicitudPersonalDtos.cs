using Lefarma.API.Domain.Entities.Rh;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs
{
    public class SolicitudPersonalResponse
    {
        public int IdSolicitud { get; set; }
        public string Folio { get; set; } = string.Empty;
        public int IdEmpresa { get; set; }
        public string? EmpresaNombre { get; set; }
        public int IdSucursal { get; set; }
        public string? SucursalNombre { get; set; }
        public int IdArea { get; set; }
        public string? AreaNombre { get; set; }
        public int? IdEstado { get; set; }
        public string? EstadoNombre { get; set; }
        public string? EstadoColor { get; set; }
        public int? IdWorkflow { get; set; }
        public int? IdPasoActual { get; set; }
        public string? PasoActual { get; set; }
        public int IdUsuarioCreador { get; set; }
        public string? SolicitanteNombre { get; set; }
        public string? SolicitantePuesto { get; set; }

        public int IdTipoSolicitud { get; set; }
        public string? TipoSolicitudNombre { get; set; }
        public string Categoria { get; set; } = string.Empty;

        public string? LugarComision { get; set; }
        public string? Motivo { get; set; }
        public DateTime? FechaEnvio { get; set; }
        public DateTime? FechaInicio { get; set; }
        public DateTime? FechaFin { get; set; }
        public DateTime? FechaReposicion { get; set; }
        public int? DiasSolicitados { get; set; }
        public DateTime? FechaRegreso { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
        public List<SolicitudPersonalDetalleDto> Detalle { get; set; } = new();
    }

    public class SolicitudPersonalRequest
    {
        public int? IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public int? IdArea { get; set; }
        public int? IdEstado { get; set; }
        public bool VerTodas { get; set; }
        public int? IdUsuarioCreador { get; set; }
        public int? IdTipoSolicitud { get; set; }
        public string? Categoria { get; set; }
        public string? Estados { get; set; }
        public string? IdsEstados { get; set; }
        public DateTime? FechaCreacionDesde { get; set; }
        public DateTime? FechaCreacionHasta { get; set; }
        public DateTime? FechaDiasDesde { get; set; }
        public DateTime? FechaDiasHasta { get; set; }
        public string? Busqueda { get; set; }
        public int? Max { get; set; }
        public string? OrderBy { get; set; } = "FechaCreacion";
        public string? OrderDirection { get; set; } = "asc";
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }
    public class CreateSolicitudPersonalRequest
    {
        public int IdSolicitud { get; set; }
        public int IdEmpresa { get; set; }
        public int IdSucursal { get; set; }
        public int IdArea { get; set; }
        public int IdTipoSolicitud { get; set; }
        public string? Motivo { get; set; }
        public string? LugarComision { get; set; }
        public DateTime? FechaInicio { get; set; }
        public DateTime? FechaFin { get; set; }
        public int? DiasSolicitados { get; set; }
        public DateTime? FechaRegreso { get; set; }
        public DateTime? FechaReposicion { get; set; }
        public List<SolicitudPersonalDetalleDto> Detalle { get; set; } = new();
    }

    public class SolicitudPersonalDetalleDto
    {
        public DateTime Fecha { get; set; }
        public string? Comentario { get; set; }
    }
}
