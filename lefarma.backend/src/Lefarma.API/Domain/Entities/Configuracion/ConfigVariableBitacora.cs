namespace Lefarma.API.Domain.Entities.Configuracion;

public class ConfigVariableBitacora
{
    public long IdBitacora { get; set; }

    public Guid IdOperacion { get; set; }

    public long IdVariable { get; set; }

    public string Clave { get; set; } = string.Empty;

    public string Accion { get; set; } = string.Empty;

    public string? DatosAnterioresJson { get; set; }

    public string DatosNuevosJson { get; set; } = "null";

    public long? IdBitacoraOrigen { get; set; }

    public int? IdUsuario { get; set; }

    public DateTime FechaCreacion { get; set; }

    public ConfigVariable? Variable { get; set; }
}
