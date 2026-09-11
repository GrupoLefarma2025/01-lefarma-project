using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class HospitalConfiguration : IEntityTypeConfiguration<Hospital>
{
    public void Configure(EntityTypeBuilder<Hospital> builder)
    {
        builder.ToTable("genContactosCat", "dbo");
        builder.HasKey(e => e.CodigoContacto);

        builder.Property(e => e.CodigoContacto).HasColumnName("codigoContacto");
        builder.Property(e => e.NombreContacto).HasColumnName("nombreContacto").HasMaxLength(100);
        builder.Property(e => e.Rfc).HasColumnName("rfc").HasMaxLength(13);
        builder.Property(e => e.Calle).HasColumnName("calle").HasMaxLength(100);
        builder.Property(e => e.Colonia).HasColumnName("colonia").HasMaxLength(50);
        builder.Property(e => e.Ciudad).HasColumnName("ciudad").HasMaxLength(100);
        builder.Property(e => e.CodigoEstado).HasColumnName("codigoEstado").HasMaxLength(100);
        builder.Property(e => e.Cp).HasColumnName("cp").HasMaxLength(6);
        builder.Property(e => e.CodigoEtiqueta).HasColumnName("codigoEtiqueta");
        builder.Property(e => e.RequiereAutorizacionCxC).HasColumnName("requiereAutorizacionCxC");
        builder.Property(e => e.CodigoClasificacion).HasColumnName("codigoClasificacion");
        builder.Property(e => e.CodigoSubClasificacion).HasColumnName("codigoSubClasificacion");
        builder.Property(e => e.Tipo).HasColumnName("tipo").HasMaxLength(20);
        builder.Property(e => e.CodigoListaDePrecios).HasColumnName("codigoListaDePrecios");
        builder.Property(e => e.CodigoRegimenFiscal).HasColumnName("codigoRegimenFiscal").HasMaxLength(5);
        builder.Property(e => e.CodigoUsoDelCFDI).HasColumnName("codigoUsoDelCFDI").HasMaxLength(5);
        builder.Property(e => e.CodigoFormaDePago).HasColumnName("codigoFormaDePago");
        builder.Property(e => e.CodigoTerminoDePago).HasColumnName("codigoTerminoDePago");
        builder.Property(e => e.Zona).HasColumnName("zona").HasMaxLength(20);
        builder.Property(e => e.Representante).HasColumnName("representante").HasMaxLength(30);
        builder.Property(e => e.Email).HasColumnName("email").HasMaxLength(100);
        builder.Property(e => e.Clues).HasColumnName("clues").HasMaxLength(150);
        builder.Property(e => e.VentaConLicitacion).HasColumnName("ventaConLicitacion");
        builder.Property(e => e.CodigoContactoPrincipal).HasColumnName("codigoContactoPrincipal");
        builder.Property(e => e.Latitud).HasColumnName("latitud").HasPrecision(9, 6);
        builder.Property(e => e.Longitud).HasColumnName("longitud").HasPrecision(9, 6);
        builder.Property(e => e.Activo).HasColumnName("activo");
        builder.Property(e => e.NombreCorto).HasColumnName("nombreCorto").HasMaxLength(100);
        builder.Property(e => e.FechaCreacion).HasColumnName("fechacreacion");
        builder.Property(e => e.CodigoUsuarioCreo).HasColumnName("codigoUsuarioCreo");
        builder.Property(e => e.FechaActualizacion).HasColumnName("fechaActualizacion");
        builder.Property(e => e.CodigoUsuarioActualizo).HasColumnName("codigoUsuarioActualizo");

        builder.HasIndex(e => e.Clues);
        builder.HasIndex(e => e.CodigoContactoPrincipal);
        builder.HasIndex(e => e.Activo);
    }
}
