using Lefarma.API.Features.Catalogos.UnidadesMedida.DTOs;

namespace Lefarma.API.Features.Catalogos.Gastos.DTOs
{
public class GastoResponse
    {
        public int IdGasto { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string NombreNormalizado { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string DescripcionNormalizada { get; set; } = string.Empty;
        public string Clave { get; set; } = string.Empty;
        public string Concepto { get; set; } = string.Empty;
        public string Cuenta { get; set; } = string.Empty;
        public string SubCuenta { get; set; } = string.Empty;
        public string Analitica { get; set; } = string.Empty;
        public string Integracion { get; set; } = string.Empty;
        public string CuentaCatalogo { get; set; } = string.Empty;
        public bool RequiereComprobacionPago { get; set; }
        public bool RequiereComprobacionGasto { get; set; }
        public bool PermiteSinDatosFiscales { get; set; }
        public int? DiasLimiteComprobacion { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
        public List<UnidadMedidaGastoResponse> UnidadesMedida { get; set; } = [];
    }

    public class UnidadMedidaGastoResponse
    {
        public int IdUnidadMedida { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Abreviatura { get; set; } = string.Empty;
        public bool Activo { get; set; }
    }

    public class CreateGastoRequest
    {
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public string? Concepto { get; set; }
        public string? Cuenta { get; set; }
        public string? SubCuenta { get; set; }
        public string? Analitica { get; set; }
        public string? Integracion { get; set; }
        public bool RequiereComprobacionPago { get; set; } = true;
        public bool RequiereComprobacionGasto { get; set; } = true;
        public bool PermiteSinDatosFiscales { get; set; }
        public int? DiasLimiteComprobacion { get; set; }
        public bool Activo { get; set; } = true;
        public List<int> UnidadesMedida { get; set; } = [];
    }

    public class UpdateGastoRequest
    {
        public required int IdGasto { get; set; }
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public string? Clave { get; set; }
        public string? Concepto { get; set; }
        public string? Cuenta { get; set; }
        public string? SubCuenta { get; set; }
        public string? Analitica { get; set; }
        public string? Integracion { get; set; }
        public bool RequiereComprobacionPago { get; set; }
        public bool RequiereComprobacionGasto { get; set; }
        public bool PermiteSinDatosFiscales { get; set; }
        public int? DiasLimiteComprobacion { get; set; }
        public bool Activo { get; set; }
        public List<int> UnidadesMedida { get; set; } = [];
    }

    public class GastoRequest
    {
        public string? Nombre { get; set; }
        public bool? RequiereComprobacionPago { get; set; }
        public bool? RequiereComprobacionGasto { get; set; }
        public bool? Activo { get; set; }
        public string? OrderBy { get; set; }
        public string? OrderDirection { get; set; }
    }
}
