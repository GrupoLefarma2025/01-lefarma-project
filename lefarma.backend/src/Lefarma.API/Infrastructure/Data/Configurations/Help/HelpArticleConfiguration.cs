using Lefarma.API.Domain.Entities.Help;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Help;
public class HelpArticleConfiguration : IEntityTypeConfiguration<HelpArticle>
{
    public void Configure(EntityTypeBuilder<HelpArticle> builder)
    {
        builder.ToTable("HelpArticles", schema: "help");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        builder.Property(x => x.Titulo)
            .HasColumnName("titulo")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Contenido)
            .HasColumnName("contenido")
            .IsRequired();

        builder.Property(x => x.Resumen)
            .HasColumnName("resumen")
            .HasMaxLength(500);

        builder.Property(x => x.ModuloId)
            .HasColumnName("modulo_id");

        builder.Property(x => x.Modulo)
            .HasColumnName("modulo")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.Tipo)
            .HasColumnName("tipo")
            .HasMaxLength(50)
            .IsRequired()
            .HasDefaultValue("usuario");

        builder.Property(x => x.Categoria)
            .HasColumnName("categoria")
            .HasMaxLength(100);

        builder.Property(x => x.Orden)
            .HasColumnName("orden")
            .HasDefaultValue(0);

        builder.Property(x => x.Activo)
            .HasColumnName("activo")
            .HasDefaultValue(true);

        builder.Property(x => x.FechaCreacion)
            .HasColumnName("fecha_creacion")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(x => x.FechaActualizacion)
            .HasColumnName("fecha_actualizacion")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(x => x.CreadoPor)
            .HasColumnName("creado_por")
            .HasMaxLength(100);

        builder.Property(x => x.ActualizadoPor)
            .HasColumnName("actualizado_por")
            .HasMaxLength(100);

        builder.HasIndex(x => new { x.Modulo, x.Activo })
            .HasDatabaseName("IX_HelpArticles_modulo_activo");

        builder.HasIndex(x => new { x.Tipo, x.Activo })
            .HasDatabaseName("IX_HelpArticles_tipo_activo");

        builder.HasIndex(x => new { x.Categoria, x.Activo })
            .HasDatabaseName("IX_HelpArticles_categoria_activo")
            .HasFilter("[categoria] IS NOT NULL");

        builder.HasOne(x => x.ModuloNavigation)
            .WithMany(m => m.Articulos)
            .HasForeignKey(x => x.ModuloId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
