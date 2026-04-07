using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Catalogos.Proveedores.DTOs
{
    public class RechazarProveedorRequest
    {
        [Required(ErrorMessage = "El motivo es requerido")]
        [MinLength(10, ErrorMessage = "El motivo debe tener al menos 10 caracteres")]
        public string Motivo { get; set; } = string.Empty;
    }
}
