using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Domain.Entities.Asistencias
{
    [Keyless]
    public class VwEmpleado
    {
        public long? Nomina { get; set; }
        public string Nombre { get; set; } = null!;
        public string Apellidos { get; set; } = null!;
        public string? Correo { get; set; }
    }
}
