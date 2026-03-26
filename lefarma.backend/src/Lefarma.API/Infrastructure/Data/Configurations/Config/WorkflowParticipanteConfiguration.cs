using Lefarma.API.Domain.Entities.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Config
{
    public class WorkflowParticipanteConfiguration : IEntityTypeConfiguration<WorkflowParticipante>
    {
        public void Configure(EntityTypeBuilder<WorkflowParticipante> builder)
        {
            builder.ToTable("workflow_participantes", "config");
            builder.HasKey(p => p.IdParticipante);
            builder.Property(p => p.IdParticipante).HasColumnName("id_participante").ValueGeneratedOnAdd();
            builder.Property(p => p.IdPaso).HasColumnName("id_paso");
            builder.Property(p => p.IdRol).HasColumnName("id_rol");
            builder.Property(p => p.IdUsuario).HasColumnName("id_usuario");
        }
    }
}
