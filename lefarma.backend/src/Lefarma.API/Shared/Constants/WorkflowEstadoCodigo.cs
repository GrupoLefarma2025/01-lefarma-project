namespace Lefarma.API.Shared.Constants;

/// <summary>
/// Códigos de estado de workflow usados en toda la aplicación.
/// Los IDs numéricos varían por ambiente, pero estos códigos son fijos.
/// </summary>
public static class WorkflowEstadoCodigo
{
    public const string CREADA = "CREADA";
    public const string REVISION = "REVISION";
    public const string APROBACION = "APROBACION";
    public const string TESORERIA = "TESORERIA";
    public const string PAGADA = "PAGADA";
    public const string COMPROBACION = "COMPROBACION";
    public const string CERRADA = "CERRADA";
    public const string RECHAZADA = "RECHAZADA";
    public const string CANCELADA = "CANCELADA";
    public const string DEVUELTA = "DEVUELTA";
    public const string PREPARACION = "PREPARACION";
    public const string REVISION_DIRECTOR = "REVISION_DIRECTOR";
}
