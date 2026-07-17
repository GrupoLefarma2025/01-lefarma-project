namespace Lefarma.API.Features.Rh.Empleados.DTOs;

public class ResolverIdUsuarioPorNominaRequest
{
    public long Nomina { get; set; }
}

public class ResolverIdsUsuarioPorNominasRequest
{
    public List<long> Nominas { get; set; } = new();
}

public class EmpleadoUsuarioResponse
{
    public long Nomina { get; set; }
    public int IdUsuario { get; set; }
}
