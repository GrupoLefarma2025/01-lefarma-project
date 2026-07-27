using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Domain.Entities.Asistencias
{
    [Keyless]
    public class VwEmpleado
    {
        public int Id { get; set; }
        public DateTime? FechaAlta { get; set; }
        public DateTime? Ultimocambio { get; set; }
        public long? Nomina { get; set; }
        public string Nombre { get; set; } = null!;
        public string Apellidos { get; set; } = null!;
        public string? Correo { get; set; }
        public string? Genero { get; set; }
        public DateTime? Fechanacimiento { get; set; }
        public int? Edad { get; set; }
        public DateTime? Fechaingreso { get; set; }
        public int? Antiguedad { get; set; }

        [Column("vacacionesxantiguedad")]
        public decimal? Vacacionesxantiguedad { get; set; }

        public string? Cp { get; set; }
        public string? Telefonooficina { get; set; }
        public string? Celularoficina { get; set; }
        public string? Telefonopersonal { get; set; }
        public string? Empresa { get; set; }
        public string? Departamento { get; set; }
        public string? Puesto { get; set; }
        public string? Lugarregistro { get; set; }
        public string? Ciudad { get; set; }
        public string? Direccion { get; set; }
        public string? Ubicacionesautorizadas { get; set; }
        public string? Checa { get; set; }
    }
}
