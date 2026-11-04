using System.Text.Json;

namespace Lefarma.API.Features.Configuracion.DTOs;

/// <summary>Consulta puntual de variables para el frontend.</summary>
public sealed class FrontendConsultarRequest
{
    public List<FrontendConsultaClave> Variables { get; set; } = new();
}

public sealed class FrontendConsultaClave
{
    public string Clave { get; set; } = string.Empty;

    /// <summary>Revisión que ya tiene el cliente (informativa).</summary>
    public long? Revision { get; set; }
}

/// <summary>Sincronización incremental: todo lo que cambió después de <see cref="Desde"/>.</summary>
public sealed class FrontendSyncRequest
{
    public long Desde { get; set; }

    public List<string> Claves { get; set; } = new();
}

/// <summary>Respuesta de sincronización para el frontend.</summary>
public sealed class FrontendSyncResponse
{
    /// <summary>Máximo id_bitacora global al momento de responder.</summary>
    public long RevisionActual { get; set; }

    public List<FrontendVariableEntry> Variables { get; set; } = new();

    /// <summary>Claves que dejaron de existir, se desactivaron o perdieron disponibilidad para frontend.</summary>
    public List<string> Eliminadas { get; set; } = new();
}

/// <summary>Variable vigente para el frontend.</summary>
public sealed class FrontendVariableEntry
{
    public string Clave { get; set; } = string.Empty;

    public string TipoDato { get; set; } = string.Empty;

    public JsonElement Valor { get; set; }

    /// <summary>Última revisión (id_bitacora) de esta variable.</summary>
    public long Revision { get; set; }
}
