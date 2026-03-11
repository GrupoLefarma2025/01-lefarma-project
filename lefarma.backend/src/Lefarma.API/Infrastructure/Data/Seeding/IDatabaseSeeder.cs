namespace Lefarma.API.Infrastructure.Data.Seeding;

public interface IDatabaseSeeder
{
    /// <summary>
    /// Seeds the database with initial data if it doesn't exist.
    /// Should be called during application startup.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    Task SeedAsync(CancellationToken cancellationToken = default);
}
