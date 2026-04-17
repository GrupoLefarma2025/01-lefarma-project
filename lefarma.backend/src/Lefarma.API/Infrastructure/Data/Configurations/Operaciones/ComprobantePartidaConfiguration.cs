using Lefarma.API.Domain.Entities.Operaciones;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Operaciones;

public class ComprobantePartidaConfiguration : IEntityTypeConfiguration<ComprobantePartida>
{
    public void Configure(EntityTypeBuilder<ComprobantePartida> builder)
    {
        builder.ToTable("comprobantes_partidas", "operaciones");
        builder.HasKey(c => c.IdAsignacion);
        builder.Property(c => c.IdAsignacion).HasColumnName("id_asignacion").ValueGeneratedOnAdd();
        builder.Property(c => c.IdComprobante).HasColumnName("id_comprobante").IsRequired();
        builder.Property(c => c.IdConcepto).HasColumnName("id_concepto");
        builder.Property(c => c.IdPartida).HasColumnName("id_partida").IsRequired();
        builder.Property(c => c.IdUsuarioAsigno).HasColumnName("id_usuario_asigno").IsRequired();
        builder.Property(c => c.IdPasoWorkflow).HasColumnName("id_paso_workflow");
        builder.Property(c => c.CantidadAsignada).HasColumnName("cantidad_asignada").HasColumnType("decimal(18,6)").IsRequired();
        builder.Property(c => c.ImporteAsignado).HasColumnName("importe_asignado").HasColumnType("decimal(18,2)").IsRequired();
        builder.Property(c => c.Notas).HasColumnName("notas").HasMaxLength(500);
        builder.Property(c => c.FechaAsignacion).HasColumnName("fecha_asignacion").HasDefaultValueSql("GETDATE()");

        builder.HasOne(cp => cp.Partida)
            .WithMany()
            .HasForeignKey(cp => cp.IdPartida)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
