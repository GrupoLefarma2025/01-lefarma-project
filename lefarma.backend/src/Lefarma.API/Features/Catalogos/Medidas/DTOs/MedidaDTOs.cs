using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.UnidadesMedida.DTOs;

namespace Lefarma.API.Features.Catalogos.Medidas.DTOs
{
    public class MedidaResponse
    {
        public int IdMedida { get; set; }
        public string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
        public ICollection<UnidadMedidaResponse> UnidadesMedida { get; set; } = new List<UnidadMedidaResponse>();
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }
    }

    public class CreateMedidaRequest
    {
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public bool Activo { get; set; } = true;
        public List<int> UnidadesMedida { get; set; } = [];
    }

    public class UpdateMedidaRequest
    {
        public required int IdMedida { get; set; }
        public required string Nombre { get; set; } = null!;
        public string? Descripcion { get; set; }
        public bool Activo { get; set; }
        public List<int> UnidadesMedida { get; set; } = [];
    }
}
