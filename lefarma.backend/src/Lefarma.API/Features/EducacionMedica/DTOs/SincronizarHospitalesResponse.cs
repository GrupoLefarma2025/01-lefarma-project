namespace Lefarma.API.Features.EducacionMedica.DTOs;

/// <summary>Resumen de la sincronización de extensiones de hospitales.</summary>
public class SincronizarHospitalesResponse
{
    /// <summary>Hospitales del universo sincronizado (activos, sin Privado/Distribuidor).</summary>
    public int TotalHospitales { get; set; }

    /// <summary>Extensiones nuevas creadas en esta ejecución.</summary>
    public int Creadas { get; set; }

    /// <summary>Hospitales que ya tenían extensión (no se tocaron).</summary>
    public int YaExistian { get; set; }

    /// <summary>Nuevas extensiones que nacieron ocultas por no ser unidades de atención.</summary>
    public int OcultasNoHospital { get; set; }

    /// <summary>Nuevas extensiones que requieren revisión manual.</summary>
    public int PendientesRevision { get; set; }
}
