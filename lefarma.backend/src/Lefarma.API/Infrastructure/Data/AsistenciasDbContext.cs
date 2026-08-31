using Lefarma.API.Domain.Entities.Asistencias;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Infrastructure.Data;
public class AsistenciasDbContext : DbContext
{
    public AsistenciasDbContext(DbContextOptions<AsistenciasDbContext> options) : base(options)
    {
    }

    public DbSet<VwEmpleado> VwEmpleados { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<VwEmpleado>(entity =>
        {
            entity.HasNoKey();
            entity.ToView("vwEmpleados", "dbo");
            entity.Property(e => e.Correo).HasColumnName("correo");
            entity.Property(e => e.Puesto).HasColumnName("puesto");
        });
    }
}
