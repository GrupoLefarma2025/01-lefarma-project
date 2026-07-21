namespace Lefarma.API.Features.Rh.Vacaciones.DTOs
{
    public class DiaNoHabilRequest
    {
        public int? IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public int? Anio { get; set; }
        public int? Mes { get; set; }
    }

    public class DiaNoHabilResponse
    {
        public int IdDiaNoHabil { get; set; }
        public int IdEmpresa { get; set; }
        public string? EmpresaNombre { get; set; }
        public int? IdSucursal { get; set; }
        public string? SucursalNombre { get; set; }
        public int Anio { get; set; }
        public int Mes { get; set; }
        public int Dia { get; set; }
        public DateTime Fecha { get; set; }
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
    }

    public class CargaDiasNoHabilesRequest
    {
        public int IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public List<DiaNoHabilFechaRequest> Fechas { get; set; } = new();
        public string? DescripcionGeneral { get; set; }
    }

    public class DiaNoHabilFechaRequest
    {
        public int Anio { get; set; }
        public int Mes { get; set; }
        public int Dia { get; set; }
        public string? Descripcion { get; set; }
    }

    public class CargaDiasNoHabilesCsvRow
    {
        public int Dia { get; set; }
        public int Mes { get; set; }
        public int Anio { get; set; }
        public string? Descripcion { get; set; }
    }

    public class BulkUploadRowError
    {
        public int RowNumber { get; set; }
        public string RowData { get; set; } = string.Empty;
        public string Error { get; set; } = string.Empty;
    }

    public class CargaDiasNoHabilesResultResponse
    {
        public int TotalRows { get; set; }
        public int SuccessCount { get; set; }
        public int ErrorCount { get; set; }
        public List<BulkUploadRowError> Errors { get; set; } = new();
        public int UsuariosAfectados { get; set; }
        public int VacacionesGeneradas { get; set; }
    }

    public class DiaUsuarioRequest
    {
        public int IdUsuario { get; set; }
        public int? Anio { get; set; }
    }

    public class DiaUsuarioResponse
    {
        public int IdDiaUsuario { get; set; }
        public int IdUsuario { get; set; }
        public string? UsuarioNombre { get; set; }
        public int IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public DateTime Fecha { get; set; }
        public int IdTipoDia { get; set; }
        public string? TipoDiaNombre { get; set; }
        public string Origen { get; set; } = string.Empty;
        public string? Estado { get; set; }
        public bool ConsumeSaldo { get; set; }
        public int? IdDiaNoHabil { get; set; }
        public string? Comentarios { get; set; }
    }
}
