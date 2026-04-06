namespace Lefarma.API.Infrastructure.Data.Seeding;
/// <summary>
/// Interface for database seeding operations.
/// </summary>
public interface IDatabaseSeeder
{
    /// <summary>
    /// Seeds the database with initial data.
    /// </summary>
    Task SeedAsync();
}
