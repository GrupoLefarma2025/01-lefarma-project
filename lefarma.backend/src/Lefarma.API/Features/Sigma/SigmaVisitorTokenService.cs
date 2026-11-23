using System.Security.Cryptography;
using System.Text;

namespace Lefarma.API.Features.Sigma;

public sealed class SigmaVisitorTokenService
{
    public const string HeaderName = "X-Sigma-Visitor";

    private static readonly TimeSpan Vigencia = TimeSpan.FromHours(8);
    private readonly byte[] _clave;
    private readonly ILogger<SigmaVisitorTokenService> _logger;

    public SigmaVisitorTokenService(IConfiguration configuration, ILogger<SigmaVisitorTokenService> logger)
    {
        _logger = logger;

        var secreto = configuration["JwtSettings:SecretKey"];
        if (string.IsNullOrWhiteSpace(secreto) || Encoding.UTF8.GetByteCount(secreto) < 32)
        {
            throw new InvalidOperationException(
                "JwtSettings:SecretKey no está configurada o tiene menos de 32 bytes: el ticket de visitante necesita HMAC-SHA256.");
        }

        _clave = Encoding.UTF8.GetBytes(secreto);
    }

    public string Issue(int idUsuario, string correo)
    {
        var expira = DateTimeOffset.UtcNow.Add(Vigencia).ToUnixTimeSeconds();
        var payload = $"{idUsuario}|{correo}|{expira}";
        var bytesPayload = Encoding.UTF8.GetBytes(payload);
        var firma = HMACSHA256.HashData(_clave, bytesPayload);
        return $"{Base64Url(bytesPayload)}.{Base64Url(firma)}";
    }

    public bool TryValidate(string? token, out SigmaVisitor visitante)
    {
        visitante = default!;

        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        var partes = token.Split('.');
        if (partes.Length != 2)
        {
            return false;
        }

        byte[] bytesPayload;
        byte[] firmaRecibida;
        try
        {
            bytesPayload = FromBase64Url(partes[0]);
            firmaRecibida = FromBase64Url(partes[1]);
        }
        catch (FormatException)
        {
            _logger.LogWarning("Ticket de visitante con formato inválido");
            return false;
        }

        var firmaEsperada = HMACSHA256.HashData(_clave, bytesPayload);
        if (!CryptographicOperations.FixedTimeEquals(firmaRecibida, firmaEsperada))
        {
            _logger.LogWarning("Ticket de visitante con firma inválida");
            return false;
        }

        var payload = Encoding.UTF8.GetString(bytesPayload);
        var campos = payload.Split('|');
        if (campos.Length != 3
            || !int.TryParse(campos[0], out var idUsuario)
            || !long.TryParse(campos[2], out var expira)
            || DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expira)
        {
            _logger.LogWarning("Ticket de visitante inválido o expirado");
            return false;
        }

        visitante = new SigmaVisitor(idUsuario, campos[1], campos[1]);
        return true;
    }

    private static string Base64Url(byte[] valor) =>
        Convert.ToBase64String(valor).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromBase64Url(string valor)
    {
        var normalizado = valor.Replace('-', '+').Replace('_', '/');
        normalizado = normalizado.PadRight(normalizado.Length + ((4 - (normalizado.Length % 4)) % 4), '=');
        return Convert.FromBase64String(normalizado);
    }
}

public sealed record SigmaVisitor(int IdUsuario, string Correo, string Nombre);

public sealed record SigmaActor(int? IdUsuario, string Usuario, bool EsAnonimo, string Nombre);
