using System.Data;

namespace Lefarma.API.Features.Sigma;

/// <summary>
/// Reglas de acceso a documentos del flujo. Los usuarios de AD quedan acotados por los
/// propios SP (reciben su usuario); el visitante externo sólo puede operar sobre los
/// documentos/pasos en los que es creador o aprobador.
/// </summary>
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

    /// <summary>true si el actor puede consultar/descargar el documento del flujo.</summary>
    public async Task<bool> PuedeAccederAsync(Guid idDocumento, SigmaActor actor, CancellationToken ct = default)
    {
        // Los usuarios autenticados de AD se rigen por los filtros de los SP.
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
