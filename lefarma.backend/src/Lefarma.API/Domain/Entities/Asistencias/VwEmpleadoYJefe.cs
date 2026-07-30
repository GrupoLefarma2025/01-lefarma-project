using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Domain.Entities.Asistencias
{
    [Keyless]
    public class VwEmpleadoYJefe
    {
        public long? Nomina { get; set; }
        public long? NominaJefe { get; set; }
        public long? NominaJefe2 { get; set; }
        public long? NominaJefe3 { get; set; }
        public long? NominaJefe4 { get; set; }
        public long? NominaJefe5 { get; set; }
    }
}
