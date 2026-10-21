namespace Lefarma.API.Features.EducacionMedica.DTOs;

/// <summary>
/// Resumen agregado del dashboard de Educación Médica (ADR-00012, Fase 2):
/// todo lo que compone la landing en una sola llamada.
/// </summary>
public class DashboardResumenDto
{
    /// <summary>Periodo solicitado en formato YYYY-MM.</summary>
    public string Periodo { get; set; } = string.Empty;

    /// <summary>Equipo y talleres del usuario (null si no tiene talleres.puede_ver).</summary>
    public MisTalleresResponse? MisTalleres { get; set; }

    /// <summary>Visitas confirmadas del mes (vacío si no tiene talleres.puede_capturar).</summary>
    public List<AsignacionDto> Asignaciones { get; set; } = [];

    /// <summary>Documentos en pasos de firma donde participa el usuario.</summary>
    public List<PendienteAprobacionDto> Pendientes { get; set; } = [];

    /// <summary>Matrices generales del periodo (vacío si no tiene talleres.puede_ver).</summary>
    public List<MatrizGeneralResumenDto> Matrices { get; set; } = [];

    /// <summary>Todos los talleres de las matrices del periodo (para la tabla de últimos talleres).</summary>
    public List<TallerDto> TalleresPeriodo { get; set; } = [];

    /// <summary>Subconjunto de talleres con solicitud de cambio pendiente.</summary>
    public List<TallerDto> Solicitudes { get; set; } = [];
}
