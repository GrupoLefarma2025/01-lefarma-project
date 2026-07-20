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
}
