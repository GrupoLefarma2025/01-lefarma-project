using System.Data;

namespace Lefarma.API.Features.Sigma;

public sealed class SigmaDocumentAccess
{
    private const string SqlPertenencia = """
        SELECT CASE WHEN
            EXISTS (
                SELECT 1
                FROM app.DocumentosConFlujo d
                WHERE d.IdDocumento = @IdDocumento
                  AND d.CreadoPor = @Usuario
            )
            OR EXISTS (
                SELECT 1
                FROM app.PasosFlujo p
                INNER JOIN app.DocumentosConFlujo d ON d.IdDocumento = p.IdDocumento
                WHERE p.UsuarioAprobador = @Usuario
                  AND d.IdGrupo = (SELECT IdGrupo FROM app.DocumentosConFlujo WHERE IdDocumento = @IdDocumento)
            )
        THEN 1 ELSE 0 END
        """;

    private readonly SigmaDb _db;

    public SigmaDocumentAccess(SigmaDb db)
    {
        _db = db;
    }

    public async Task<bool> PuedeAccederAsync(Guid idDocumento, SigmaActor actor, CancellationToken ct = default)
    {
        if (!actor.EsAnonimo)
        {
            return true;
        }

        var permitido = await _db.ExecuteScalarAsync<int>(
            SqlPertenencia,
            new { IdDocumento = idDocumento, Usuario = actor.Usuario },
            CommandType.Text,
            ct);

        return permitido == 1;
    }
}
