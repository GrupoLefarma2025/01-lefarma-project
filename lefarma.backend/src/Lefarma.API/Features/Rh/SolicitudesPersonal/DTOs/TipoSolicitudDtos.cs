using Lefarma.API.Domain.Entities.Rh;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs
{
    public class TipoSolicitudResponse
    {
        public int IdTipoSolicitud { get; set; }
        public string Nombre { get; set; }
        public string Clave { get; set; }
        public string Categoria { get; set; }
        public string? Descripcion { get; set; }
        public bool EsIncidencia { get; set; }
        public bool EsPermiso { get; set; }
        public bool RequiereReposicionTiempo { get; set; }
        public bool RequiereFechaFin { get; set; }
        public bool RequiereFechaRegreso { get; set; }
        public bool RequiereLugarComision { get; set; }
        public bool DescuentaNomina { get; set; }
        public bool DescuentaVacaciones { get; set; }
        public bool RequiereDocumentacion { get; set; }
        public int? LimitePorPeriodo { get; set; }
        public string? PeriodoLimite { get; set; }
        public int? TotalParaDescuento { get; set; }
        public bool RequiereValidacionRH { get; set; }
        public bool RequiereValidacionJefeDirecto { get; set; }
        public bool RequiereValidacionGerencia { get; set; }
        public bool RequiereValidacionDirector { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class TipoSolicitudRequest
    {
        public string? Nombre { get; set; }
        public string? Clave { get; set; }
        public string? Categoria { get; set; }
        public bool? Activo { get; set; }
        public string? OrderBy { get; set; } = "Nombre";
        public string? OrderDirection { get; set; } = "asc";
    }

    public class CreateTipoSolicitudRequest
    {
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public required string Clave { get; set; }
        public required string Categoria { get; set; }
        public bool RequiereReposicionTiempo { get; set; }
        public bool RequiereFechaFin { get; set; }
        public bool RequiereFechaRegreso { get; set; }
        public bool RequiereLugarComision { get; set; }
        public bool DescuentaNomina { get; set; }
        public bool DescuentaVacaciones { get; set; }
        public bool RequiereDocumentacion { get; set; }
        public int? LimitePorPeriodo { get; set; }
        public string? PeriodoLimite { get; set; }
        public int? TotalParaDescuento { get; set; }
        public bool Activo { get; set; } = true;
    }

    public class UpdateTipoSolicitudRequest
    {
        public required int IdTipoSolicitud { get; set; }
        public required string Nombre { get; set; }
        public string? Descripcion { get; set; }
        public required string Clave { get; set; }
        public required string Categoria { get; set; }
        public bool RequiereReposicionTiempo { get; set; }
        public bool RequiereFechaFin { get; set; }
        public bool RequiereFechaRegreso { get; set; }
        public bool RequiereLugarComision { get; set; }
        public bool DescuentaNomina { get; set; }
        public bool DescuentaVacaciones { get; set; }
        public bool RequiereDocumentacion { get; set; }
        public int? LimitePorPeriodo { get; set; }
        public string? PeriodoLimite { get; set; }
        public int? TotalParaDescuento { get; set; }
        public bool Activo { get; set; }
    }

    public class LimitePorTipoResponse
    {
        public int IdTipoSolicitud { get; set; }
        public string Tipo { get; set; } = null!;
        public int Limite { get; set; }
        public int Usado { get; set; }
        public int Disponible { get; set; }
        public string Periodo { get; set; } = null!;
        public DateTime PeriodoInicio { get; set; }
        public DateTime PeriodoFin { get; set; }
    }

    public class MisLimitesResponse
    {
        public string PeriodoActual { get; set; } = null!;
        public DateTime PeriodoInicio { get; set; }
        public DateTime PeriodoFin { get; set; }
        public List<LimitePorTipoResponse> LimitesPorTipo { get; set; } = new();
    }

    public class CalendarioGlobalRequest
    {
        public int Anio { get; set; }
        public int Mes { get; set; }
        public int? IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public int? IdArea { get; set; }
        public int? IdTipoSolicitud { get; set; }
        public string? AgruparPor { get; set; }
        public List<string>? Estados { get; set; }
    }

    public class CalendarioGlobalEvento
    {
        public int IdSolicitud { get; set; }
        public string Folio { get; set; } = null!;
        public DateTime Fecha { get; set; }
        public int IdTipoSolicitud { get; set; }
        public string Tipo { get; set; } = null!;
        public string Categoria { get; set; } = null!;
        public string Estado { get; set; } = null!;
        public string? EstadoColor { get; set; }
        public int IdEmpresa { get; set; }
        public string? EmpresaNombre { get; set; }
        public int IdSucursal { get; set; }
        public string? SucursalNombre { get; set; }
        public int IdArea { get; set; }
        public string? AreaNombre { get; set; }
        public int IdUsuarioCreador { get; set; }
        public string? SolicitanteNombre { get; set; }
        public string? GrupoClave { get; set; }
        public string? GrupoNombre { get; set; }
    }
}
