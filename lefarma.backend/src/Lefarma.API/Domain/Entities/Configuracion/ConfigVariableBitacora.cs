namespace Lefarma.API.Domain.Entities.Configuracion;

/// <summary>
/// Bitácora inmutable de cambios de una variable de configuración (schema config.variables_bitacora).
/// Cada fila es una revisión global: <see cref="IdBitacora"/> es el número de revisión.
/// </summary>
public class ConfigVariableBitacora
{
    public long IdBitacora { get; set; }

    /// <summary>Identificador idempotente de la operación que generó la entrada.</summary>
    public Guid IdOperacion { get; set; }

    public long IdVariable { get; set; }

    /// <summary>Snapshot de la clave al momento del cambio.</summary>
    public string Clave { get; set; } = string.Empty;

    /// <summary>crear | actualizar | desactivar | reactivar | restaurar</summary>
    public string Accion { get; set; } = string.Empty;

    public string? DatosAnterioresJson { get; set; }

    public string DatosNuevosJson { get; set; } = "null";

    /// <summary>Entrada de bitácora restaurada (solo para la acción restaurar).</summary>
    public long? IdBitacoraOrigen { get; set; }

    public int? IdUsuario { get; set; }

    public DateTime FechaCreacion { get; set; }

    public ConfigVariable? Variable { get; set; }
}
