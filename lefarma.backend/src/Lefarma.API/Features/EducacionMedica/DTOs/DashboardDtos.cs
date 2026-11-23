namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class DashboardResumenDto
{
    public string Periodo { get; set; } = string.Empty;

    public MisTalleresResponse? MisTalleres { get; set; }

    public List<AsignacionDto> Asignaciones { get; set; } = [];

    public List<PendienteAprobacionDto> Pendientes { get; set; } = [];

    public List<MatrizGeneralResumenDto> Matrices { get; set; } = [];

    public List<TallerDto> TalleresPeriodo { get; set; } = [];

    public List<TallerDto> Solicitudes { get; set; } = [];
}
