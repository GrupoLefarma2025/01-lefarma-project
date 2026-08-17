namespace Lefarma.API.Features.Rh.Vacaciones.DTOs
{
    public class DiaHabilRequest
    {
        public int? IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public int? Anio { get; set; }
        public int? Mes { get; set; }
    }

    public class DiaHabilResponse
    {
        public int IdDiaHabil { get; set; }
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
        public bool ConsumeSaldo { get; set; }
        public bool PermiteSaldoNegativo { get; set; }
    }

    public class CargaDiasHabilesRequest
    {
        public int IdEmpresa { get; set; }
        public int? IdSucursal { get; set; }
        public List<DiaHabilFechaRequest> Fechas { get; set; } = new();
        public string? DescripcionGeneral { get; set; }
    }

    public class DiaHabilFechaRequest
    {
        public int Anio { get; set; }
        public int Mes { get; set; }
        public int Dia { get; set; }
        public string? Descripcion { get; set; }
        public bool ConsumeSaldo { get; set; }
        public bool PermiteSaldoNegativo { get; set; }
    }

    public class CargaDiasHabilesCsvRow
    {
        public int Dia { get; set; }
        public int Mes { get; set; }
        public int Anio { get; set; }
        public string? Descripcion { get; set; }
        public bool ConsumeSaldo { get; set; }
        public bool PermiteSaldoNegativo { get; set; }
    }

    public class BulkUploadRowError
    {
        public int RowNumber { get; set; }
        public string RowData { get; set; } = string.Empty;
        public string Error { get; set; } = string.Empty;
    }

    public class CargaDiasHabilesResultResponse
    {
        public int TotalRows { get; set; }
        public int SuccessCount { get; set; }
        public int ErrorCount { get; set; }
        public List<BulkUploadRowError> Errors { get; set; } = new();
        public int UsuariosAfectados { get; set; }
        public int VacacionesGeneradas { get; set; }
    }

    public class UsuarioAfectadoResponse
    {
        public int IdUsuario { get; set; }
        public string? NombreCompleto { get; set; }
        public string? NumeroEmpleado { get; set; }
        public string? Puesto { get; set; }
        public int IdEmpresa { get; set; }
        public string? EmpresaNombre { get; set; }
        public int? IdSucursal { get; set; }
        public string? SucursalNombre { get; set; }
        public bool Activo { get; set; }
    }
}
