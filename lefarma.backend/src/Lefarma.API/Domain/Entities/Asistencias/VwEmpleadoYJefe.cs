using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Domain.Entities.Asistencias
{
    [Keyless]
    public class VwEmpleadoYJefe
    {
        public long? Nomina { get; set; }  
        public long? NominaJefe { get; set; }

        
        // public int? Nominajefe2 { get; set; }
        // public int? Nominajefe3 { get; set; }
        // public int? Nominajefe4 { get; set; }
        // public int? Nominajefe5 { get; set; }
    }
}
