using ErrorOr;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Rh.Empleados.DTOs;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;

namespace Lefarma.API.Features.Rh.Empleados;

public class EmpleadoService : BaseService, IEmpleadoService
{
    private readonly IEmpleadoRepository _repository;

    protected override string EntityName => "Empleado";

    public EmpleadoService(
        IEmpleadoRepository repository,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _repository = repository;
    }

    public async Task<ErrorOr<int?>> ResolverIdUsuarioPorNominaAsync(
        long nomina,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var idUsuario = await _repository.ResolverIdUsuarioPorNominaAsync(nomina, cancellationToken);

            EnrichWideEvent("ResolverIdUsuarioPorNomina", additionalContext: new Dictionary<string, object>
            {
                ["nomina"] = nomina,
                ["resuelto"] = idUsuario.HasValue
            });

            return idUsuario;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("ResolverIdUsuarioPorNomina", exception: ex);
            return CommonErrors.DatabaseError("resolver el usuario por nómina");
        }
    }

    public async Task<ErrorOr<Dictionary<long, int>>> ResolverIdsUsuarioPorNominasAsync(
        IEnumerable<long> nominas,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var nominaList = nominas.ToList();
            var resultado = await _repository.ResolverIdsUsuarioPorNominasAsync(nominaList, cancellationToken);

            EnrichWideEvent("ResolverIdsUsuarioPorNominas", count: resultado.Count, additionalContext: new Dictionary<string, object>
            {
                ["solicitados"] = nominaList.Count,
                ["resueltos"] = resultado.Count
            });

            return resultado;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("ResolverIdsUsuarioPorNominas", exception: ex);
            return CommonErrors.DatabaseError("resolver los usuarios por nómina");
        }
    }

    public async Task<ErrorOr<EmpleadoUsuarioResponse>> ObtenerNominaPorUsuarioAsync(int idUsuario, CancellationToken cancellationToken = default)
    {
        try
        {
            var empleado = await _repository.ObtenerEmpleadoPorUsuarioAsync(idUsuario, cancellationToken);
            if (empleado == null)
                return CommonErrors.NotFound("Empleado", idUsuario.ToString());

            return new EmpleadoUsuarioResponse
            {
                Nomina = empleado.Nomina ?? 0,
                IdUsuario = idUsuario
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("ObtenerNominaPorUsuario", exception: ex);
            return CommonErrors.DatabaseError("obtener la nómina del empleado");
        }
    }

    public async Task<ErrorOr<EmpleadoChecadoResponse>> ObtenerEstadoChecadoAsync(int idUsuario, CancellationToken cancellationToken = default)
    {
        try
        {
            var empleado = await _repository.ObtenerEmpleadoPorUsuarioAsync(idUsuario, cancellationToken);
            return new EmpleadoChecadoResponse
            {
                Checa = empleado?.Checa?.Trim().Equals("Si", StringComparison.OrdinalIgnoreCase) == true
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent("ObtenerEstadoChecado", exception: ex);
            return CommonErrors.DatabaseError("obtener el estado de checado");
        }
    }
}
