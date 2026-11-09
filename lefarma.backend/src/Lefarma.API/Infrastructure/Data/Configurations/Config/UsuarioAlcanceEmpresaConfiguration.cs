using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class UsuarioAlcanceEmpresaConfiguration : IEntityTypeConfiguration<UsuarioAlcanceEmpresa>
    {
        public void Configure(EntityTypeBuilder<UsuarioAlcanceEmpresa> builder)
        {
            builder.ToTable("usuario_alcance_empresa", "config");

            // PK compuesta: un usuario no repite la misma empresa.
            builder.HasKey(a => new { a.IdUsuario, a.IdEmpresa });

            builder.Property(a => a.IdUsuario)
                .HasColumnName("id_usuario")
                .IsRequired();

            builder.Property(a => a.IdEmpresa)
                .HasColumnName("id_empresa")
                .IsRequired();

            builder.Property(a => a.Activo)
                .HasColumnName("activo")
                .HasDefaultValue(true);

            builder.Property(a => a.FechaCreacion)
                .HasColumnName("fecha_creacion")
                .HasDefaultValueSql("GETDATE()")
                .IsRequired();

            builder.Property(a => a.FechaModificacion)
                .HasColumnName("fecha_modificacion");

            builder.HasOne(a => a.Empresa)
                .WithMany()
                .HasForeignKey(a => a.IdEmpresa)
                .HasConstraintName("FK_usuario_alcance_empresa_empresas")
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(a => a.IdUsuario);
        }
    }
}
