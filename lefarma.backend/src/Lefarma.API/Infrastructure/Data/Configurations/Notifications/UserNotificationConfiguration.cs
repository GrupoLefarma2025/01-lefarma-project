using Lefarma.API.Domain.Entities.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Lefarma.API.Infrastructure.Data.Configurations.Notifications;

public class UserNotificationConfiguration : IEntityTypeConfiguration<UserNotification>
{
    public void Configure(EntityTypeBuilder<UserNotification> builder)
    {
        builder.ToTable("UserNotifications");

        builder.HasKey(un => un.Id);
        builder.Property(un => un.Id)
            .ValueGeneratedOnAdd();

        // Property mappings
        builder.Property(un => un.NotificationId)
            .IsRequired();

        builder.Property(un => un.UserId)
            .IsRequired();

        builder.Property(un => un.IsRead)
            .HasDefaultValue(false);

        builder.Property(un => un.ReadAt);

        builder.Property(un => un.ReceivedVia)
            .IsRequired()
            .HasDefaultValue("[]")
            .HasColumnType("nvarchar(max)");

        builder.Property(un => un.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("GETUTCDATE()");

        // Relationships
        /// <summary>
        /// ClientCascade prevents SQL Server multiple cascade paths error.
        /// EF Core handles cascading in memory before deletion.
        /// </summary>
        builder.HasOne(un => un.Notification)
            .WithMany(n => n.UserNotifications)
            .HasForeignKey(un => un.NotificationId)
            .OnDelete(DeleteBehavior.ClientCascade);

        // Indexes
        builder.HasIndex(un => un.UserId)
            .HasDatabaseName("IX_UserNotifications_UserId");

        builder.HasIndex(un => new { un.UserId, un.NotificationId })
            .HasDatabaseName("IX_UserNotifications_UserId_NotificationId");

        builder.HasIndex(un => un.IsRead)
            .HasDatabaseName("IX_UserNotifications_IsRead");
    }
}
