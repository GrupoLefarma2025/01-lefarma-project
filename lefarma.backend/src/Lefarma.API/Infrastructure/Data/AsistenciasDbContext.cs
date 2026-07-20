using Lefarma.API.Domain.Entities.Asistencias;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data
{
    public class AsistenciasDbContext : DbContext
    {
        public AsistenciasDbContext(DbContextOptions<AsistenciasDbContext> options) : base(options) { }

        public DbSet<VwEmpleado> VwEmpleados { get; set; }
        public DbSet<VwEmpleadoYJefe> VwEmpleadosYJefes { get; set; }
        public DbSet<VwIncidenciasChecado> VwIncidenciasChecados { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<VwEmpleado>().HasNoKey().ToView("vwEmpleados", "dbo");
            modelBuilder.Entity<VwEmpleadoYJefe>().HasNoKey().ToView("vwEmpleadosYJefes", "dbo");
            modelBuilder.Entity<VwIncidenciasChecado>().HasNoKey().ToView("IncidenciasChecadoDev", "dbo");
        }
    }
}
