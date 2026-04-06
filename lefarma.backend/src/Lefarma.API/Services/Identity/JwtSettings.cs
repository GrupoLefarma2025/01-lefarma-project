namespace Lefarma.API.Services.Identity;
/// <summary>
/// Configuration options for JWT token generation and validation.
/// </summary>
public class JwtSettings
{
    /// <summary>
    /// The secret key used to sign JWT tokens.
    /// Must be at least 32 characters (256 bits) for HMAC-SHA256.
    /// </summary>
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>
    /// The issuer of the JWT token (e.g., "Lefarma").
    /// </summary>
    public string Issuer { get; set; } = string.Empty;

    /// <summary>
    /// The intended audience for the JWT token (e.g., "Lefarma").
    /// </summary>
    public string Audience { get; set; } = string.Empty;

    /// <summary>
    /// Access token expiration time in minutes.
    /// Default: 60 minutes.
    /// </summary>
    public int AccessTokenExpirationMinutes { get; set; } = 60;

    /// <summary>
    /// Refresh token expiration time in days.
    /// Default: 7 days.
    /// </summary>
    public int RefreshTokenExpirationDays { get; set; } = 7;
}
