namespace Lefarma.API.Features.Rh.Vacaciones.DTOs
{
    public class SaldoVacacionesRequest
    {
        public int? IdEmpresa { get; set; }
        public int? IdUsuario { get; set; }
        public int? Anio { get; set; }
    }

    public class SaldoVacacionesCreateRequest
    {
        public int IdUsuario { get; set; }
        public int IdEmpresa { get; set; }
        public int Anio { get; set; }
        public decimal DiasGenerados { get; set; }
        public decimal DiasVencidos { get; set; }
        public decimal DiasCompensados { get; set; }
        public decimal DiasAjustados { get; set; }
        public decimal DiasTomados { get; set; }
    }

    public class SincronizarSaldosRequest
    {
        public int? Anio { get; set; }
    }

    public class SincronizarSaldosResponse
    {
        public int Anio { get; set; }
        public int Total { get; set; }
        public int Creados { get; set; }
        public int Actualizados { get; set; }
        public int Omitidos { get; set; }
    }

    public class SaldoVacacionesResponse
    {
        public int IdSaldo { get; set; }
        public int IdUsuario { get; set; }
        public string? UsuarioNombre { get; set; }
        public long? Nomina { get; set; }
        public int IdEmpresa { get; set; }
        public string? EmpresaNombre { get; set; }
        public int Anio { get; set; }
        public decimal DiasGenerados { get; set; }
        public decimal DiasVencidos { get; set; }
        public decimal DiasCompensados { get; set; }
        public decimal DiasAjustados { get; set; }
        public decimal DiasTomados { get; set; }
        public decimal DiasPendientes { get; set; }
        public bool Activo { get; set; }
    }

    public class SaldoVacacionesDetalleResponse
    {
        public int IdSaldo { get; set; }
        public int IdUsuario { get; set; }
        public string? UsuarioNombre { get; set; }
        public string? Correo { get; set; }
        public long? Nomina { get; set; }
        public int IdEmpresa { get; set; }
        public string? EmpresaNombre { get; set; }
        public int Anio { get; set; }
        public string? Puesto { get; set; }
        public string? Departamento { get; set; }
        public string? EmpleadoEmpresa { get; set; }
        public DateTime? FechaIngreso { get; set; }
        public int? Antiguedad { get; set; }
        public decimal? VacacionesPorAntiguedad { get; set; }
        public decimal DiasGenerados { get; set; }
        public decimal DiasVencidos { get; set; }
        public decimal DiasCompensados { get; set; }
        public decimal DiasAjustados { get; set; }
        public decimal DiasTomados { get; set; }
        public decimal DiasPendientes { get; set; }
        public DateTime? FechaModificacion { get; set; }
        public string? AjustadoPor { get; set; }
        public string? MotivoAjuste { get; set; }
        public int DiasEnTramite { get; set; }
        public decimal DiasPendientesProyectado { get; set; }
        public List<SolicitudVacacionesDetalleDto> Solicitudes { get; set; } = new();
        public List<SaldoVacacionesHistorialDto> Historial { get; set; } = new();
    }

    public class SaldoVacacionesHistorialDto
    {
        public int IdSaldo { get; set; }
        public int Anio { get; set; }
        public decimal DiasGenerados { get; set; }
        public decimal DiasVencidos { get; set; }
        public decimal DiasCompensados { get; set; }
        public decimal DiasAjustados { get; set; }
        public decimal DiasTomados { get; set; }
        public decimal DiasPendientes { get; set; }
    }

    public class SolicitudVacacionesDetalleDto
    {
        public int IdSolicitud { get; set; }
        public string Folio { get; set; } = string.Empty;
        public string? EstadoCodigo { get; set; }
        public string? EstadoNombre { get; set; }
        public bool EnTramite { get; set; }
        public DateTime FechaInicio { get; set; }
        public DateTime FechaFin { get; set; }
        public int Dias { get; set; }
        public List<DateTime> Fechas { get; set; } = new();
    }

    public class SaldoVacacionesAjusteRequest
    {
        public decimal? DiasAjustados { get; set; }
        public decimal? DiasVencidos { get; set; }
        public decimal? DiasCompensados { get; set; }
        public string Motivo { get; set; } = string.Empty;
    }
}
