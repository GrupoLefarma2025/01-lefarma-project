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
        public int? IdArea { get; set; }
        public string? AreaNombre { get; set; }
        public int? IdEstado { get; set; }
        public string? EstadoNombre { get; set; }
        public string? EstadoColor { get; set; }
        public int? IdWorkflow { get; set; }
        public int? IdPasoActual { get; set; }
        public string? PasoActual { get; set; }
        public int IdUsuarioCreador { get; set; }
        public string? CreadorNombre { get; set; }
        public int? IdUsuarioSolicitante { get; set; }
        public string? SolicitanteNombre { get; set; }
        public string? SolicitantePuesto { get; set; }
        /// <summary>Ubicación del empleado según Asistencias (vwEmpleados.ubicacion).</summary>
        public string? Ubicacion { get; set; }

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
        public SaldoVacacionesSolicitudDto? SaldoVacaciones { get; set; }
    }

    public class SaldoVacacionesSolicitudDto
    {
        public int Anio { get; set; }
        public decimal DiasPendientes { get; set; }
        public int DiasQueDescuentan { get; set; }
        public decimal SaldoResultante { get; set; }
        public bool QuedaNegativo { get; set; }
    }

    public class SolicitudPersonalRequest
    {
        public int? IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public int? IdArea { get; set; }
        public int? IdEstado { get; set; }
        public bool VerTodas { get; set; }
        public int? IdUsuarioCreador { get; set; }
        public int? IdUsuarioSolicitante { get; set; }
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
        public bool SoloConteo { get; set; }
        /// <summary>
        /// Lista de la pestaña "En trámite": solo solicitudes no terminales, incluyendo
        /// las propias de este mes y el anterior y todas las que el usuario debe firmar.
        /// </summary>
        public bool SoloPendientes { get; set; }

        // Filtros adicionales estilo incidencias de checado
        public string? Periodo { get; set; }
        public DateTime? FechaInicio { get; set; }
        public DateTime? FechaFin { get; set; }
        public long? Nomina { get; set; }
        public string? Nombre { get; set; }
        public string? Departamento { get; set; }
        public string? Puesto { get; set; }
    }
    public class CreateSolicitudPersonalRequest
    {
        public int IdSolicitud { get; set; }
        public int IdEmpresa { get; set; }
        public int IdSucursal { get; set; }
        public int IdArea { get; set; }
        public int IdTipoSolicitud { get; set; }
        public int? IdUsuarioSolicitante { get; set; }
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
        public TimeSpan? Entrada { get; set; }
        public TimeSpan? Entro { get; set; }
        public TimeSpan? Salida { get; set; }
        public TimeSpan? Salio { get; set; }
    }

    /// <summary>
    /// Solicitudes (incidencias, permisos y demás categorías) del equipo del usuario cuyo
    /// día cae en el mes indicado. Se cuentan por el día de la incidencia (no por el día
    /// de la firma) y se excluyen las canceladas y rechazadas.
    /// </summary>
    public class AutorizacionesIncidenciasResponse
    {
        public int Anio { get; set; }
        public int Mes { get; set; }
        public int Total { get; set; }
        public List<AutorizacionIncidenciaPorEmpleado> PorEmpleado { get; set; } = new();
        public List<AutorizacionIncidenciaDetalle> Detalle { get; set; } = new();
    }

    public class AutorizacionIncidenciaPorEmpleado
    {
        public int IdUsuario { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public int Total { get; set; }
    }

    public class AutorizacionIncidenciaDetalle
    {
        public int IdSolicitud { get; set; }
        public string Folio { get; set; } = string.Empty;
        public int IdUsuarioSolicitante { get; set; }
        public string EmpleadoNombre { get; set; } = string.Empty;
        public string TipoSolicitud { get; set; } = string.Empty;
        public string? Motivo { get; set; }
        /// <summary>Fecha del día justificado (el eje del conteo).</summary>
        public DateTime? FechaIncidencia { get; set; }
        /// <summary>Día en que el jefe firmó la solicitud; nulo si aún no la ha firmado.</summary>
        public DateTime? FechaAutorizacion { get; set; }
        public string? EstadoNombre { get; set; }
    }
}
