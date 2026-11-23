namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class SincronizarHospitalesResponse
{
    public int TotalHospitales { get; set; }

    public int Creadas { get; set; }

    public int YaExistian { get; set; }

    public int OcultasNoHospital { get; set; }

    public int PendientesRevision { get; set; }
}
