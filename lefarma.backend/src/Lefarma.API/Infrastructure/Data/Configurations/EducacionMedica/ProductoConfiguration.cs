using Lefarma.API.Domain.Entities.EducacionMedica;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.EducacionMedica;

public class ProductoConfiguration : IEntityTypeConfiguration<Producto>
{
    public void Configure(EntityTypeBuilder<Producto> builder)
    {
        builder.ToTable("genProductosCat", "dbo");
        builder.HasKey(e => e.CodigoProducto);

        builder.Property(e => e.CodigoProducto).HasColumnName("codigoProducto");
        builder.Property(e => e.NombreInternoProducto).HasColumnName("nombreInternoProducto").HasMaxLength(50);
        builder.Property(e => e.CodigoFactura).HasColumnName("codigoFactura").HasMaxLength(30);
        builder.Property(e => e.DescripcionLarga).HasColumnName("descripcionLarga");
        builder.Property(e => e.Tipo).HasColumnName("tipo").HasMaxLength(20);
        builder.Property(e => e.TipoAsokam).HasColumnName("tipoAsokam").HasMaxLength(20);
        builder.Property(e => e.SeVende).HasColumnName("seVende");
        builder.Property(e => e.SeCompra).HasColumnName("seCompra");
        builder.Property(e => e.EsGasto).HasColumnName("esGasto");
        builder.Property(e => e.CodigoBarras).HasColumnName("codigoBarras").HasMaxLength(30);
        builder.Property(e => e.RegistroSanitario).HasColumnName("registroSanitario").HasMaxLength(20);
        builder.Property(e => e.VigenciaRegistroSanitario).HasColumnName("vigenciaRegistroSanitario");
        builder.Property(e => e.DescripcionFactura).HasColumnName("descripcionFactura").HasMaxLength(40);
        builder.Property(e => e.DescripcionCorta).HasColumnName("descripcionCorta").HasMaxLength(100);
        builder.Property(e => e.DescripcionUnificada).HasColumnName("descripcionUnificada").HasMaxLength(100);
        builder.Property(e => e.Presentacion).HasColumnName("presentacion").HasMaxLength(20);
        builder.Property(e => e.Empaque).HasColumnName("empaque");
        builder.Property(e => e.CodigoProductoSAT).HasColumnName("codigoProductoSAT");
        builder.Property(e => e.CantidadInsumos).HasColumnName("cantidadInsumos");
        builder.Property(e => e.CodigoListaMaterial).HasColumnName("codigoListaMaterial");
        builder.Property(e => e.ListaMateriales).HasColumnName("listaMateriales").HasMaxLength(50);
        builder.Property(e => e.IdsMensajes).HasColumnName("idsMensajes").HasMaxLength(100);
        builder.Property(e => e.CodigoUnidadDeMedida).HasColumnName("codigoUnidadDeMedida");
        builder.Property(e => e.DescripcionUnidadDeMedida).HasColumnName("descripcionUnidadDeMedida").HasMaxLength(30);
        builder.Property(e => e.AniosDeCaducidad).HasColumnName("añosDeCaducidad");
        builder.Property(e => e.MarcaIMSS).HasColumnName("marcaIMSS").HasMaxLength(50);
        builder.Property(e => e.DescripcionIMSS).HasColumnName("descripcionIMSS").HasMaxLength(100);
        builder.Property(e => e.DescripcionBienestar).HasColumnName("descripcionBienestar").HasMaxLength(2048);
        builder.Property(e => e.CodigoProductoProductoCat).HasColumnName("codigoProductoProductoCat");
        builder.Property(e => e.CodigoProductoBaseBase).HasColumnName("codigoProductoBaseBase").HasMaxLength(10);
        builder.Property(e => e.TipoProductoInterno).HasColumnName("tipoProductoInterno").HasMaxLength(30);
        builder.Property(e => e.UnidadEquivalenteProduccion).HasColumnName("unidadEquivalenteProduccion").HasPrecision(13, 2);
        builder.Property(e => e.FechaCreacion).HasColumnName("fechaCreacion");
        builder.Property(e => e.CodigoUsuarioCreo).HasColumnName("codigoUsuarioCreo");
        builder.Property(e => e.FechaActualizacion).HasColumnName("fechaActualizacion");
        builder.Property(e => e.CodigoUsuarioActualizo).HasColumnName("codigoUsuarioActualizo");
        builder.Property(e => e.CodigoProductoBase).HasColumnName("codigoProductoBase");

        builder.HasIndex(e => e.Tipo);
        builder.HasIndex(e => e.TipoAsokam);
    }
}
