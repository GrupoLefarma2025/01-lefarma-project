using Lefarma.API.Domain.Entities.Rh;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Rh
{
    public class GenCalendarioRegConfiguration : IEntityTypeConfiguration<GenCalendarioReg>
    {
        public void Configure(EntityTypeBuilder<GenCalendarioReg> builder)
        {
            builder.ToTable("genCalendarioReg", "dbo");
            builder.HasKey(c => c.Fecha);

            builder.Property(c => c.Fecha).HasColumnName("fecha");
            builder.Property(c => c.AñoMes).HasColumnName("añoMes");
            builder.Property(c => c.Año).HasColumnName("año");
            builder.Property(c => c.Mes).HasColumnName("mes");
            builder.Property(c => c.Dia).HasColumnName("dia");
            builder.Property(c => c.SemanaRetail).HasColumnName("semanaRetail");
            builder.Property(c => c.SemanaAsokam).HasColumnName("semanaAsokam");
            builder.Property(c => c.Laborable).HasColumnName("laborable");
            builder.Property(c => c.DiaSemana).HasColumnName("diaSemana");
            builder.Property(c => c.EntreSemana).HasColumnName("entreSemana");
            builder.Property(c => c.FinDeSemana).HasColumnName("finDeSemana");
            builder.Property(c => c.AparicionDiaSemanaEnMes).HasColumnName("aparicionDiaSemanaEnMes");
            builder.Property(c => c.NombreDiaSemana).HasColumnName("nombreDiaSemana").HasMaxLength(10);
            builder.Property(c => c.NombreMes).HasColumnName("nombreMes").HasMaxLength(10);
            builder.Property(c => c.SemanasAsokamEnMes).HasColumnName("semanasAsokamEnMes");
            builder.Property(c => c.AñoSemana).HasColumnName("añosemana");
        }
    }
}
