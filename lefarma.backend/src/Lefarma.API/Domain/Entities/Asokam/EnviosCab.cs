namespace Lefarma.API.Domain.Entities.Asokam;

public class EnviosCab
{
    public int CodigoEnvio { get; set; }
    public string? NombreTraslado { get; set; }
    public string? TipoTraslado { get; set; }
    public string? Estado { get; set; }
    public DateTime? FechaHoraSalida { get; set; }
    public DateTime? FechaHoraLlegada { get; set; }
}
