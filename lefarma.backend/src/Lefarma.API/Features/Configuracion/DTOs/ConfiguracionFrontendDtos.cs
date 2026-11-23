using System.Text.Json;

namespace Lefarma.API.Features.Configuracion.DTOs;

public sealed class FrontendConsultarRequest
{
    public List<FrontendConsultaClave> Variables { get; set; } = new();
}

public sealed class FrontendConsultaClave
{
    public string Clave { get; set; } = string.Empty;

    public long? Revision { get; set; }
}

public sealed class FrontendSyncRequest
{
    public long Desde { get; set; }

    public List<string> Claves { get; set; } = new();
}

public sealed class FrontendSyncResponse
{
    public long RevisionActual { get; set; }

    public List<FrontendVariableEntry> Variables { get; set; } = new();

    public List<string> Eliminadas { get; set; } = new();
}

public sealed class FrontendVariableEntry
{
    public string Clave { get; set; } = string.Empty;

    public string TipoDato { get; set; } = string.Empty;

    public JsonElement Valor { get; set; }

    public long Revision { get; set; }
}
