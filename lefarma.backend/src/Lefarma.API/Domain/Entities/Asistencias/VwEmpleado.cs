namespace Lefarma.API.Domain.Entities.Asistencias;

/// <summary>
/// Read-only projection of Asistencias.dbo.vwEmpleados.
/// Only the columns needed for the puesto lookup are mapped (keyless view).
/// </summary>
public class VwEmpleado
{
    public string? Correo { get; set; }

    public string? Puesto { get; set; }
}
