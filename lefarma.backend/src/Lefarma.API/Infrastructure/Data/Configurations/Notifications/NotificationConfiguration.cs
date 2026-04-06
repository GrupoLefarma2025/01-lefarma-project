using Lefarma.API.Domain.Entities.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Notifications;
public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications", "app");

        builder.HasKey(n => n.Id);
        builder.Property(n => n.Id)
            .ValueGeneratedOnAdd();

        // Property mappings
        builder.Property(n => n.Title)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(n => n.Message)
            .IsRequired();

        builder.Property(n => n.Type)
            .IsRequired()
            .HasMaxLength(50)
            .HasDefaultValue("info");

        builder.Property(n => n.Priority)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("normal");

        builder.Property(n => n.Category)
            .IsRequired()
            .HasMaxLength(100)
            .HasDefaultValue("system");

        builder.Property(n => n.TemplateId)
            .HasMaxLength(100);

        builder.Property(n => n.TemplateData)
            .HasColumnType("nvarchar(max)");

        builder.Property(n => n.CreatedBy)
            .IsRequired()
            .HasMaxLength(100)
            .HasDefaultValue("system");

        builder.Property(n => n.ScheduledFor);

        builder.Property(n => n.ExpiresAt);

        builder.Property(n => n.RetryCount)
            .HasDefaultValue(0);

        builder.Property(n => n.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(n => n.UpdatedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        // Relationships
        /// <summary>
        /// Cascade is safe here as Notification is the root entity.
        /// When a Notification is deleted, all its channels and user notifications should be deleted.
        /// </summary>
        builder.HasMany(n => n.Channels)
            .WithOne(c => c.Notification)
            .HasForeignKey(c => c.NotificationId)
            .OnDelete(DeleteBehavior.Cascade);

        /// <summary>
        /// Cascade is safe here as Notification is the root entity.
        /// When a Notification is deleted, all its user notifications should be deleted.
        /// </summary>
        builder.HasMany(n => n.UserNotifications)
            .WithOne(un => un.Notification)
            .HasForeignKey(un => un.NotificationId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(n => n.CreatedAt)
            .HasDatabaseName("IX_Notifications_CreatedAt");

        builder.HasIndex(n => n.ScheduledFor)
            .HasDatabaseName("IX_Notifications_ScheduledFor");

        builder.HasIndex(n => n.ExpiresAt)
            .HasDatabaseName("IX_Notifications_ExpiresAt");

        // For dashboard queries by type and date
        builder.HasIndex(n => new { n.Type, n.CreatedAt })
            .HasDatabaseName("IX_Notifications_Type_CreatedAt");

        // For scheduled notification processing
        builder.HasIndex(n => new { n.ScheduledFor, n.Priority })
            .HasDatabaseName("IX_Notifications_ScheduledFor_Priority");
    }
}
